import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { rootLogger, ILogger } from '@arletex/core';
import { validateMediaFilePath } from '../main/mediaSecurity.js';

export type TelegramMediaType = 'photo' | 'video' | 'video_note' | 'document';

export interface InboundTelegramMediaAttachment {
  type: TelegramMediaType;
  fileId: string;
  fileUniqueId: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileName?: string;
}

export interface InboundTelegramMessage {
  messageId: number;
  chatId: number;
  fromId: number;
  fromName: string;
  username?: string;
  text: string;
  caption?: string;
  date: number;
  mediaGroupId?: string;
  attachments?: InboundTelegramMediaAttachment[];
}

export interface DownloadAttachmentOptions {
  maxPhotoSizeBytes?: number;
  maxVideoSizeBytes?: number;
  targetDirectory?: string;
  timeoutMs?: number;
}

export interface DownloadedTelegramMedia {
  internalMediaId: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileUniqueId: string;
  type: TelegramMediaType;
  width?: number;
  height?: number;
  duration?: number;
  fileName?: string;
  downloadedAt: string;
}

export type TelegramMessageCallback = (msg: InboundTelegramMessage) => Promise<void> | void;

/**
 * Validates file signature magic bytes for downloaded Telegram media.
 * Supported signatures: JPEG, PNG, WEBP, MP4/MOV, WebM/MKV.
 */
export function validateTelegramMediaSignature(
  buffer: Buffer,
  declaredType: TelegramMediaType,
  declaredMime?: string,
): string {
  if (!buffer || buffer.length < 8) {
    throw new Error('File too small or empty to verify media signature');
  }

  let detectedMime: string | null = null;

  // JPEG: 0xFF, 0xD8, 0xFF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedMime = 'image/jpeg';
  }
  // PNG: 0x89, 0x50, 0x4E, 0x47
  else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    detectedMime = 'image/png';
  }
  // WEBP: 'RIFF' at 0, 'WEBP' at 8
  else if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    detectedMime = 'image/webp';
  }
  // MP4 / MOV: 'ftyp', 'moov', 'wide', 'free', 'mdat' at offset 4
  else if (
    buffer.length >= 8 &&
    ['ftyp', 'moov', 'wide', 'free', 'mdat'].includes(buffer.subarray(4, 8).toString('ascii'))
  ) {
    detectedMime = 'video/mp4';
  }
  // WebM / MKV: 0x1A, 0x45, 0xDF, 0xA3
  else if (
    buffer.length >= 4 &&
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    detectedMime = 'video/webm';
  }

  if (!detectedMime) {
    throw new Error(
      `File signature validation failed: magic bytes do not match any recognized media type (type: ${declaredType})`,
    );
  }

  // Type compliance check
  if (declaredType === 'photo') {
    if (!detectedMime.startsWith('image/')) {
      throw new Error(
        `File signature mismatch: expected image signature for photo, but got ${detectedMime}`,
      );
    }
  } else if (declaredType === 'video' || declaredType === 'video_note') {
    if (!detectedMime.startsWith('video/')) {
      throw new Error(
        `File signature mismatch: expected video signature for ${declaredType}, but got ${detectedMime}`,
      );
    }
  } else if (declaredType === 'document') {
    const isDeclaredImg = declaredMime?.startsWith('image/');
    const isDeclaredVid = declaredMime?.startsWith('video/');
    if (isDeclaredImg && !detectedMime.startsWith('image/')) {
      throw new Error(
        `File signature mismatch: document declared as image but got ${detectedMime}`,
      );
    }
    if (isDeclaredVid && !detectedMime.startsWith('video/')) {
      throw new Error(
        `File signature mismatch: document declared as video but got ${detectedMime}`,
      );
    }
  }

  return detectedMime;
}

export class TelegramBridgeService {
  private logger: ILogger;
  private botToken: string | null = null;
  private targetChatId: string | null = null;
  private allowedChatIds: Set<string> = new Set();
  private allowedUserIds: Set<number> = new Set();
  private isPolling = false;
  private lastUpdateId = 0;
  private abortController: AbortController | null = null;
  private messageListeners: TelegramMessageCallback[] = [];

  // Bounded duplicate update tracking
  private processedUpdateIds = new Set<number>();
  private updateIdQueue: number[] = [];
  private readonly MAX_TRACKED_UPDATES = 1000;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('TelegramBridgeService');
  }

  public configure(
    botToken: string,
    targetChatId?: string,
    allowedChatIds?: (string | number)[],
    allowedUserIds?: number[],
  ): void {
    this.botToken = botToken.trim() || null;
    if (targetChatId) {
      this.targetChatId = targetChatId.trim();
      this.allowedChatIds.add(this.targetChatId);
      const parsedId = parseInt(this.targetChatId, 10);
      if (!isNaN(parsedId)) {
        this.allowedUserIds.add(parsedId);
      }
    }
    if (allowedChatIds) {
      for (const id of allowedChatIds) {
        this.allowedChatIds.add(String(id).trim());
      }
    }
    if (allowedUserIds) {
      for (const uid of allowedUserIds) {
        this.allowedUserIds.add(uid);
      }
    }
    this.logger.info(
      `Telegram configured. Token present: ${!!this.botToken}, Target Chat ID: ${this.targetChatId || 'Not set'}, Allowlisted Chats: ${this.allowedChatIds.size}, Allowlisted Users: ${this.allowedUserIds.size}`
    );
  }

  public setAllowlist(chatIds: (string | number)[], userIds?: number[]): void {
    this.allowedChatIds = new Set(chatIds.map((id) => String(id).trim()));
    this.allowedUserIds = new Set(userIds || []);
    this.logger.info(
      `Updated Telegram allowlist (fail-closed): ${this.allowedChatIds.size} chats, ${this.allowedUserIds.size} users`
    );
  }

  public isChatAuthorized(chatId: string | number): boolean {
    if (this.allowedChatIds.size === 0) return false;
    return this.allowedChatIds.has(String(chatId).trim());
  }

  public isUserAuthorized(userId?: number | null): boolean {
    if (this.allowedUserIds.size === 0) return false;
    if (typeof userId !== 'number') return false;
    return this.allowedUserIds.has(userId);
  }

  public getStatus(): {
    isConfigured: boolean;
    isPolling: boolean;
    targetChatId: string | null;
    allowedChatCount: number;
    allowedUserCount: number;
    hasValidAllowlist: boolean;
    botTokenMasked: string | null;
  } {
    let maskedToken: string | null = null;
    if (this.botToken) {
      if (this.botToken.length > 8) {
        maskedToken = `${this.botToken.slice(0, 4)}...${this.botToken.slice(-4)}`;
      } else {
        maskedToken = '****';
      }
    }
    return {
      isConfigured: !!this.botToken,
      isPolling: this.isPolling,
      targetChatId: this.targetChatId,
      allowedChatCount: this.allowedChatIds.size,
      allowedUserCount: this.allowedUserIds.size,
      hasValidAllowlist: this.allowedChatIds.size > 0 && this.allowedUserIds.size > 0,
      botTokenMasked: maskedToken,
    };
  }

  public onMessage(callback: TelegramMessageCallback): () => void {
    this.messageListeners.push(callback);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== callback);
    };
  }

  public async startPolling(): Promise<boolean> {
    if (!this.botToken) {
      this.logger.debug('Cannot start Telegram polling: bot token not provided.');
      return false;
    }
    if (this.isPolling) {
      return true;
    }

    this.isPolling = true;
    this.abortController = new AbortController();
    this.logger.info('Starting Telegram long-polling update loop...');

    // Asynchronous polling loop in background
    (async () => {
      while (this.isPolling && this.botToken) {
        try {
          const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=15`;
          const res = await fetch(url, {
            signal: this.abortController?.signal,
          });

          if (!res.ok) {
            const errText = await res.text();
            this.logger.warn(`Telegram getUpdates failed HTTP ${res.status}: ${errText}`);
            await new Promise((r) => setTimeout(r, 5000));
            continue;
          }

          const data = (await res.json()) as any;
          if (data.ok && Array.isArray(data.result)) {
            for (const update of data.result) {
              this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);

              // Duplicate update suppression
              if (this.processedUpdateIds.has(update.update_id)) {
                this.logger.debug(`Skipping duplicate Telegram update ${update.update_id}`);
                continue;
              }
              this.processedUpdateIds.add(update.update_id);
              this.updateIdQueue.push(update.update_id);
              if (this.updateIdQueue.length > this.MAX_TRACKED_UPDATES) {
                const oldest = this.updateIdQueue.shift();
                if (oldest !== undefined) this.processedUpdateIds.delete(oldest);
              }

              const msg = update.message;
              if (!msg) continue;

              const hasText = typeof msg.text === 'string' && msg.text.trim().length > 0;
              const hasCaption = typeof msg.caption === 'string' && msg.caption.trim().length > 0;
              const hasPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
              const hasVideo = !!msg.video;
              const hasVideoNote = !!msg.video_note;
              const hasDoc = !!msg.document;

              if (!hasText && !hasCaption && !hasPhoto && !hasVideo && !hasVideoNote && !hasDoc) {
                continue;
              }

              // Fail-Closed Security Boundary: Require explicit allowlisting for both chat and sender
              const chatIdStr = String(msg.chat.id);
              const isChatAllowed = this.isChatAuthorized(chatIdStr);
              const isUserAllowed = this.isUserAuthorized(msg.from?.id);

              if (!isChatAllowed || !isUserAllowed) {
                this.logger.warn(
                  `Rejected unauthorized inbound Telegram message from user=${msg.from?.id} (${msg.from?.first_name || 'unknown'}) in chat=${msg.chat.id} [Fail-Closed: chatAllowed=${isChatAllowed}, userAllowed=${isUserAllowed}]`,
                );
                continue;
              }

              // If targetChatId is not set, set it from first verified allowlisted message
              if (!this.targetChatId && this.allowedChatIds.has(chatIdStr)) {
                this.targetChatId = chatIdStr;
              }

              // Extract media attachments
              const attachments: InboundTelegramMediaAttachment[] = [];

              if (hasPhoto) {
                // Select highest resolution photo (last element in array)
                const largest = msg.photo[msg.photo.length - 1];
                attachments.push({
                  type: 'photo',
                  fileId: largest.file_id,
                  fileUniqueId: largest.file_unique_id,
                  fileSize: largest.file_size,
                  width: largest.width,
                  height: largest.height,
                  mimeType: 'image/jpeg',
                });
              }

              if (hasVideo) {
                attachments.push({
                  type: 'video',
                  fileId: msg.video.file_id,
                  fileUniqueId: msg.video.file_unique_id,
                  fileSize: msg.video.file_size,
                  width: msg.video.width,
                  height: msg.video.height,
                  duration: msg.video.duration,
                  mimeType: msg.video.mime_type || 'video/mp4',
                  fileName: msg.video.file_name,
                });
              }

              if (hasVideoNote) {
                attachments.push({
                  type: 'video_note',
                  fileId: msg.video_note.file_id,
                  fileUniqueId: msg.video_note.file_unique_id,
                  fileSize: msg.video_note.file_size,
                  width: msg.video_note.length,
                  height: msg.video_note.length,
                  duration: msg.video_note.duration,
                  mimeType: 'video/mp4',
                });
              }

              if (hasDoc) {
                const docMime = (msg.document.mime_type || '').toLowerCase();
                const docName = (msg.document.file_name || '').toLowerCase();
                const isImage = docMime.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp)$/i.test(docName);
                const isVideoDoc = docMime.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi)$/i.test(docName);
                if (isImage || isVideoDoc) {
                  attachments.push({
                    type: 'document',
                    fileId: msg.document.file_id,
                    fileUniqueId: msg.document.file_unique_id,
                    fileSize: msg.document.file_size,
                    fileName: msg.document.file_name,
                    mimeType: msg.document.mime_type || (isImage ? 'image/jpeg' : 'video/mp4'),
                  });
                }
              }

              const textContent = msg.text || msg.caption || '';
              const inbound: InboundTelegramMessage = {
                messageId: msg.message_id,
                chatId: msg.chat.id,
                fromId: msg.from?.id,
                fromName: `${msg.from?.first_name || ''} ${msg.from?.last_name || ''}`.trim() || 'Partner',
                username: msg.from?.username,
                text: textContent,
                caption: msg.caption,
                date: msg.date,
                mediaGroupId: msg.media_group_id,
                attachments: attachments.length > 0 ? attachments : undefined,
              };

              this.logger.info(
                `Received Telegram message from authorized ${inbound.fromName} in chat=${inbound.chatId}: "${inbound.text}" (attachments: ${attachments.length})`,
              );

              for (const listener of this.messageListeners) {
                try {
                  await listener(inbound);
                } catch (listenerErr) {
                  this.logger.error('Error in Telegram message listener', listenerErr);
                }
              }
            }
          }
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') {
            break;
          }
          this.logger.debug(`Telegram poll loop transient error: ${fetchErr.message}`);
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
      this.isPolling = false;
    })();

    return true;
  }

  public stopPolling(): void {
    this.isPolling = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.logger.info('Telegram long-polling stopped.');
  }

  /**
   * Downloads a Telegram media attachment securely:
   * 1. Validates fileId format.
   * 2. Validates declared size against limits.
   * 3. Requests file metadata via getFile.
   * 4. Validates remote file_path against path traversal.
   * 5. Downloads raw bytes with size guarding.
   * 6. Validates file signature magic bytes.
   * 7. Saves to approved media storage root under an opaque internal media UUID.
   * 8. Performs filesystem containment validation.
   */
  public async downloadAttachment(
    attachment: InboundTelegramMediaAttachment,
    options: DownloadAttachmentOptions = {},
  ): Promise<DownloadedTelegramMedia> {
    if (!this.botToken) {
      throw new Error('Telegram bot token not configured; cannot download attachment.');
    }

    // 1. Validate fileId pattern
    if (!attachment.fileId || typeof attachment.fileId !== 'string' || !/^[A-Za-z0-9_\-]+$/.test(attachment.fileId)) {
      throw new Error(`Invalid or malformed Telegram file_id: ${attachment.fileId}`);
    }

    // 2. Check size limit upfront
    const isVideo =
      attachment.type === 'video' ||
      attachment.type === 'video_note' ||
      (attachment.type === 'document' && attachment.mimeType?.startsWith('video/'));

    const maxLimit = isVideo
      ? options.maxVideoSizeBytes ?? 50 * 1024 * 1024
      : options.maxPhotoSizeBytes ?? 20 * 1024 * 1024;

    if (typeof attachment.fileSize === 'number' && attachment.fileSize > maxLimit) {
      throw new Error(
        `Attachment size ${attachment.fileSize} bytes exceeds maximum allowed limit of ${maxLimit} bytes.`,
      );
    }

    // 3. Request file metadata via getFile
    const getFileUrl = `https://api.telegram.org/bot${this.botToken}/getFile?file_id=${encodeURIComponent(attachment.fileId)}`;
    const metaRes = await fetch(getFileUrl, {
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
    });

    if (!metaRes.ok) {
      throw new Error(`Telegram getFile request failed with HTTP ${metaRes.status}`);
    }

    const metaData = (await metaRes.json()) as any;
    if (!metaData.ok || !metaData.result || typeof metaData.result.file_path !== 'string') {
      throw new Error(
        `Telegram getFile API returned error or missing file_path: ${metaData.description || 'Unknown error'}`,
      );
    }

    const remoteFilePath: string = metaData.result.file_path;

    // 4. Validate remote file_path against path traversal
    if (
      remoteFilePath.includes('..') ||
      remoteFilePath.includes('\0') ||
      path.isAbsolute(remoteFilePath)
    ) {
      throw new Error(
        `Potential path traversal rejected in remote Telegram file_path: ${remoteFilePath}`,
      );
    }

    // 5. Re-check file_size from getFile response
    if (typeof metaData.result.file_size === 'number' && metaData.result.file_size > maxLimit) {
      throw new Error(
        `Attachment size ${metaData.result.file_size} bytes exceeds maximum allowed limit of ${maxLimit} bytes.`,
      );
    }

    // 6. Download file bytes securely (never log or leak the URL with botToken)
    const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${remoteFilePath}`;
    const dlRes = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
    });

    if (!dlRes.ok) {
      throw new Error(`Telegram media download failed with HTTP ${dlRes.status}`);
    }

    const contentLength = dlRes.headers.get('content-length');
    if (contentLength) {
      const parsedLen = parseInt(contentLength, 10);
      if (!isNaN(parsedLen) && parsedLen > maxLimit) {
        throw new Error(
          `Download Content-Length ${parsedLen} bytes exceeds maximum allowed limit of ${maxLimit} bytes.`,
        );
      }
    }

    const arrayBuf = await dlRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (buffer.length > maxLimit) {
      throw new Error(
        `Downloaded file size ${buffer.length} bytes exceeds maximum allowed limit of ${maxLimit} bytes.`,
      );
    }

    // 7. Validate magic bytes signature
    const verifiedMime = validateTelegramMediaSignature(
      buffer,
      attachment.type,
      attachment.mimeType,
    );

    // 8. Store in approved media root
    const internalMediaId = crypto.randomUUID();
    let ext = '.bin';
    if (verifiedMime === 'image/jpeg') ext = '.jpg';
    else if (verifiedMime === 'image/png') ext = '.png';
    else if (verifiedMime === 'image/webp') ext = '.webp';
    else if (verifiedMime === 'video/mp4') ext = '.mp4';
    else if (verifiedMime === 'video/webm') ext = '.webm';

    const targetDir =
      options.targetDirectory ||
      path.resolve(process.env.ARLETEX_DATA_DIR || path.join(os.homedir(), '.arletex'), 'media', 'telegram');

    await fs.mkdir(targetDir, { recursive: true });
    const targetFilePath = path.join(targetDir, `${internalMediaId}${ext}`);

    await fs.writeFile(targetFilePath, buffer);

    // 9. Containment validation
    const containment = validateMediaFilePath(
      targetFilePath,
      options.targetDirectory ? [options.targetDirectory] : undefined,
    );
    if (!containment.allowed) {
      await fs.unlink(targetFilePath).catch(() => {});
      throw new Error(`Downloaded media containment validation failed: ${containment.reason}`);
    }

    return {
      internalMediaId,
      filePath: containment.canonicalPath || targetFilePath,
      fileSize: buffer.length,
      mimeType: verifiedMime,
      fileUniqueId: attachment.fileUniqueId || metaData.result.file_unique_id || internalMediaId,
      type: attachment.type,
      width: attachment.width,
      height: attachment.height,
      duration: attachment.duration,
      fileName: attachment.fileName,
      downloadedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves a previously stored media file by internal media ID from approved media roots.
   */
  public async getMediaById(
    internalMediaId: string,
    targetDirectory?: string,
  ): Promise<{ filePath: string; mimeType: string; fileSize: number } | null> {
    if (!internalMediaId || !/^[A-Za-z0-9_\-]+$/.test(internalMediaId)) {
      return null;
    }
    const dir =
      targetDirectory ||
      path.resolve(process.env.ARLETEX_DATA_DIR || path.join(os.homedir(), '.arletex'), 'media', 'telegram');

    try {
      const entries = await fs.readdir(dir);
      const match = entries.find((e) => e.startsWith(internalMediaId));
      if (!match) return null;

      const fullPath = path.join(dir, match);
      const validation = validateMediaFilePath(
        fullPath,
        targetDirectory ? [targetDirectory] : undefined,
      );
      if (!validation.allowed || !validation.canonicalPath) return null;

      const stat = await fs.stat(validation.canonicalPath);
      return {
        filePath: validation.canonicalPath,
        mimeType: validation.mimeType || 'application/octet-stream',
        fileSize: stat.size,
      };
    } catch {
      return null;
    }
  }

  /**
   * Sends an outbound message to Telegram chat.
   */
  public async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn('Cannot send Telegram message: bot token not configured.');
      return false;
    }

    // Fail-closed outbound restriction (P0.3): Restrict outbound messages to allowlisted chats only
    if (!this.isChatAuthorized(chatId)) {
      this.logger.error(
        `Outbound Telegram denied fail-closed: Chat ID "${chatId}" is not in the configured allowlist.`
      );
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });

      if (!res.ok) {
        // Fall back to plain text if Markdown parsing fails
        const plainRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text,
          }),
        });
        return plainRes.ok;
      }

      return true;
    } catch (err: any) {
      this.logger.error(`Failed to send Telegram message to ${chatId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Sends reply to the configured target chat (Proof's chat).
   */
  public async replyToPartner(text: string): Promise<boolean> {
    if (!this.targetChatId) {
      this.logger.warn('No target Telegram chat ID available to reply.');
      return false;
    }
    return this.sendMessage(this.targetChatId, text);
  }
}

export const defaultTelegramBridge = new TelegramBridgeService();
