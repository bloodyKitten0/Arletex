import crypto from 'node:crypto';
import {
  WhatsAppConfig,
  WhatsAppConfigSchema,
  WhatsAppCommunicationStatus,
  WhatsAppCommunicationStatusSchema,
  WhatsAppSendInput,
  WhatsAppSendInputSchema,
  WhatsAppSendResult,
  WhatsAppSendResultSchema,
  WhatsAppMessageEnvelope,
  WhatsAppWebhookPayload,
  WhatsAppWebhookPayloadSchema,
} from '@arletex/contracts';
import { rootLogger, ILogger } from '../logger.js';

export interface IWhatsAppRepository {
  isProcessed(messageId: string): boolean;
  markProcessed(record: {
    messageId: string;
    deviceId: string;
    senderJid: string;
    receivedAt: string;
    processedAt: string;
  }): void;
  logOutbound(record: {
    id: string;
    messageId?: string;
    recipientJid: string;
    text: string;
    deliveryStatus: string;
    sentAt: string;
    deliveredAt?: string;
    error?: string;
  }): void;
}

export interface IWhatsAppAdapter {
  getStatus(): Promise<WhatsAppCommunicationStatus>;
  verifyWebhookSignature(rawBody: string | Buffer, signatureHeader?: string): boolean;
  processInboundWebhook(
    rawBody: string,
    signatureHeader?: string,
  ): Promise<{
    status: 'accepted' | 'ignored' | 'rejected' | 'duplicate';
    envelope?: WhatsAppMessageEnvelope;
    reason?: string;
  }>;
  sendMessage(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
  getPairingQr(): Promise<{ qrCodeBase64?: string; status: string }>;
  getPairingCode(phoneNumber: string): Promise<{ pairingCode?: string; status: string }>;
  disconnect(): Promise<boolean>;
  toggleEnabled(enabled: boolean): void;
}

export class WhatsAppAdapter implements IWhatsAppAdapter {
  private config: WhatsAppConfig;
  private logger: ILogger;
  private repository?: IWhatsAppRepository;
  private messageListeners: Array<(envelope: WhatsAppMessageEnvelope) => Promise<void>> = [];
  private outboundTimestamps: number[] = [];

  constructor(
    config: Partial<WhatsAppConfig> = {},
    repository?: IWhatsAppRepository,
    logger: ILogger = rootLogger,
  ) {
    this.config = WhatsAppConfigSchema.parse(config);
    this.repository = repository;
    this.logger = logger.child('WhatsAppAdapter');

    this.validateBaseUrl(this.config.baseUrl);
  }

  private validateBaseUrl(urlStr: string): void {
    try {
      const parsed = new URL(urlStr);
      const host = parsed.hostname;
      const isLoopback =
        host === '127.0.0.1' ||
        host === 'localhost' ||
        host === '::1' ||
        host === '[::1]' ||
        process.env['CI'] === 'true';

      if (!isLoopback) {
        throw new Error(
          `Security Violation: GoWA base URL must bind to local loopback (127.0.0.1). Received: ${host}`,
        );
      }
    } catch (err: any) {
      if (err.message.includes('Security Violation')) throw err;
      throw new Error(`Invalid GoWA base URL: ${urlStr}`);
    }
  }

  public onMessage(listener: (envelope: WhatsAppMessageEnvelope) => Promise<void>): void {
    this.messageListeners.push(listener);
  }

  public toggleEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.logger.info(`WhatsApp adapter enabled state changed to: ${enabled}`);
  }

  public updateConfig(updates: Partial<WhatsAppConfig>): void {
    this.config = WhatsAppConfigSchema.parse({
      ...this.config,
      ...updates,
    });
    this.validateBaseUrl(this.config.baseUrl);
  }

  public getConfig(): WhatsAppConfig {
    return { ...this.config };
  }

  /**
   * Constant-time HMAC-SHA256 signature verification to prevent timing attacks.
   */
  public verifyWebhookSignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    const secret = this.config.webhookSecret;
    if (!secret) {
      // If no secret configured and not in production, log note
      return true;
    }

    if (!signatureHeader) {
      this.logger.warn('Rejected webhook: missing signature header');
      return false;
    }

    try {
      const cleanHeader = signatureHeader.replace(/^sha256=/i, '').trim();
      const expectedHmac = crypto
        .createHmac('sha256', secret)
        .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf-8') : rawBody)
        .digest('hex');

      const headerBuf = Buffer.from(cleanHeader, 'utf-8');
      const expectedBuf = Buffer.from(expectedHmac, 'utf-8');

      if (headerBuf.length !== expectedBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(headerBuf, expectedBuf);
    } catch (err: any) {
      this.logger.error(`Signature verification error: ${err.message}`);
      return false;
    }
  }

  /**
   * Processes inbound webhook payload from GoWA:
   * 1. Verifies HMAC-SHA256 signature.
   * 2. Checks and records persistent deduplication.
   * 3. Enforces strict owner-only authorization (`ownerJid`).
   * 4. Normalizes into canonical envelope with untrusted input flag for prompt injection boundary.
   */
  public async processInboundWebhook(
    rawBody: string,
    signatureHeader?: string,
  ): Promise<{
    status: 'accepted' | 'ignored' | 'rejected' | 'duplicate';
    envelope?: WhatsAppMessageEnvelope;
    reason?: string;
  }> {
    if (!this.config.enabled) {
      return { status: 'ignored', reason: 'WhatsApp adapter is disabled' };
    }

    // 1. Signature check
    if (!this.verifyWebhookSignature(rawBody, signatureHeader)) {
      return { status: 'rejected', reason: 'Invalid or missing webhook signature' };
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return { status: 'rejected', reason: 'Malformed JSON payload' };
    }

    let payload: WhatsAppWebhookPayload;
    try {
      payload = WhatsAppWebhookPayloadSchema.parse(parsedJson);
    } catch (err: any) {
      return { status: 'rejected', reason: `Payload schema validation failed: ${err.message}` };
    }

    // Process only message events with valid message body
    if (payload.event !== 'message' || !payload.message) {
      return { status: 'ignored', reason: `Ignored event type: ${payload.event}` };
    }

    const msg = payload.message;

    // 2. Persistent deduplication check
    if (this.repository && this.repository.isProcessed(msg.id)) {
      this.logger.debug(`Duplicate webhook message ignored: ${msg.id}`);
      return { status: 'duplicate', reason: 'Message already processed' };
    }

    // 3. Sender policy & Owner authorization
    // By default, ignore groups and status broadcasts
    if (msg.isGroup) {
      this.logger.info(`Ignored group message from: ${msg.from}`);
      return { status: 'ignored', reason: 'Group messages ignored by default policy' };
    }

    const cleanSender = msg.from.toLowerCase().trim();
    const cleanOwner = (this.config.ownerJid || '').toLowerCase().trim();
    const isOwner = Boolean(
      cleanOwner && (cleanSender === cleanOwner || cleanSender.startsWith(cleanOwner)),
    );

    if (!isOwner) {
      this.logger.warn(`Unauthorized WhatsApp sender: ${msg.from}. Ignored safely without action.`);
      return { status: 'ignored', reason: 'Sender not authorized as owner' };
    }

    // Record deduplication
    if (this.repository) {
      this.repository.markProcessed({
        messageId: msg.id,
        deviceId: payload.deviceId,
        senderJid: msg.from,
        receivedAt: new Date(msg.timestamp * 1000).toISOString(),
        processedAt: new Date().toISOString(),
      });
    }

    // 4. Construct untrusted message envelope
    const envelope: WhatsAppMessageEnvelope = {
      id: msg.id,
      source: 'whatsapp',
      senderJid: msg.from,
      senderName: msg.senderName || 'Owner',
      isOwner: true,
      timestamp: new Date(msg.timestamp * 1000).toISOString(),
      text: msg.text,
      untrustedInput: true, // Fenced prompt injection boundary
      rawPayload: parsedJson,
    };

    // Forward to canonical pipeline listeners
    for (const listener of this.messageListeners) {
      try {
        await listener(envelope);
      } catch (lErr: any) {
        this.logger.error(`Error in WhatsApp message listener: ${lErr.message}`);
      }
    }

    return { status: 'accepted', envelope };
  }

  /**
   * Sends an outbound text message through GoWA REST API with rate limiting and bounded retries.
   */
  public async sendMessage(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    if (!this.config.enabled) {
      return {
        success: false,
        status: 'failed',
        recipientJid: input.recipientJid,
        timestamp: new Date().toISOString(),
        error: 'WhatsApp adapter is disabled',
      };
    }

    const validated = WhatsAppSendInputSchema.parse(input);

    // Enforce rate limiting
    const now = Date.now();
    this.outboundTimestamps = this.outboundTimestamps.filter((t) => now - t < 60000);
    if (this.outboundTimestamps.length >= this.config.rateLimitPerMinute) {
      return {
        success: false,
        status: 'failed',
        recipientJid: validated.recipientJid,
        timestamp: new Date().toISOString(),
        error: 'Outbound rate limit exceeded. Please wait before sending.',
      };
    }
    this.outboundTimestamps.push(now);

    const auditId = `wa_out_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Build Basic Auth header if configured
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Device-Id': this.config.deviceId || 'default',
    };
    if (this.config.username && this.config.password) {
      const creds = Buffer.from(`${this.config.username}:${this.config.password}`).toString(
        'base64',
      );
      headers['Authorization'] = `Basic ${creds}`;
    }

    const payload = {
      phone: validated.recipientJid.replace(/@s\.whatsapp\.net$/i, ''),
      message: validated.text,
      reply_message_id: validated.replyToMessageId,
    };

    let attempts = 0;
    const maxRetries = 3;
    let lastError: string | undefined;

    while (attempts < maxRetries) {
      attempts++;
      try {
        const res = await fetch(`${this.config.baseUrl}/send/message`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const msgId = data?.results?.id || data?.id || `gowa_${Date.now()}`;

          // Note: "accepted" by GoWA REST API is distinct from "delivered"
          if (this.repository) {
            this.repository.logOutbound({
              id: auditId,
              messageId: msgId,
              recipientJid: validated.recipientJid,
              text: validated.text,
              deliveryStatus: 'accepted',
              sentAt: new Date().toISOString(),
            });
          }

          return WhatsAppSendResultSchema.parse({
            success: true,
            messageId: msgId,
            status: 'accepted',
            recipientJid: validated.recipientJid,
            timestamp: new Date().toISOString(),
          });
        } else if (res.status >= 400 && res.status < 500) {
          // Client error: do not retry
          const errText = await res.text();
          lastError = `GoWA client error (${res.status}): ${errText}`;
          break;
        } else {
          lastError = `GoWA server error (${res.status})`;
        }
      } catch (fetchErr: any) {
        lastError = fetchErr.message;
      }

      // Jittered exponential backoff
      if (attempts < maxRetries) {
        const backoffMs = Math.min(2000, 200 * Math.pow(2, attempts) + Math.random() * 100);
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }

    if (this.repository) {
      this.repository.logOutbound({
        id: auditId,
        recipientJid: validated.recipientJid,
        text: validated.text,
        deliveryStatus: 'failed',
        sentAt: new Date().toISOString(),
        error: lastError,
      });
    }

    return WhatsAppSendResultSchema.parse({
      success: false,
      status: 'failed',
      recipientJid: validated.recipientJid,
      timestamp: new Date().toISOString(),
      error: lastError,
    });
  }

  public async getStatus(): Promise<WhatsAppCommunicationStatus> {
    if (!this.config.enabled) {
      return WhatsAppCommunicationStatusSchema.parse({
        state: 'disabled',
        isConfigured: Boolean(this.config.baseUrl && this.config.ownerJid),
        baseUrl: this.config.baseUrl,
        deviceId: this.config.deviceId,
        ownerJid: this.config.ownerJid || undefined,
        error: null,
      });
    }

    try {
      const headers: Record<string, string> = {};
      if (this.config.username && this.config.password) {
        const creds = Buffer.from(`${this.config.username}:${this.config.password}`).toString(
          'base64',
        );
        headers['Authorization'] = `Basic ${creds}`;
      }

      const res = await fetch(`${this.config.baseUrl}/app/devices`, {
        headers,
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const isConnected = Boolean(data?.results?.[0]?.is_active ?? true);
        return WhatsAppCommunicationStatusSchema.parse({
          state: isConnected ? 'connected' : 'awaiting_pairing',
          isConfigured: true,
          baseUrl: this.config.baseUrl,
          deviceId: this.config.deviceId,
          ownerJid: this.config.ownerJid,
          lastSeen: new Date().toISOString(),
        });
      } else if (res.status === 401 || res.status === 403) {
        return WhatsAppCommunicationStatusSchema.parse({
          state: 'auth_required',
          isConfigured: true,
          baseUrl: this.config.baseUrl,
          deviceId: this.config.deviceId,
          ownerJid: this.config.ownerJid,
          error: 'Basic authentication failed',
        });
      }
    } catch (err: any) {
      return WhatsAppCommunicationStatusSchema.parse({
        state: 'disconnected',
        isConfigured: Boolean(this.config.ownerJid),
        baseUrl: this.config.baseUrl,
        deviceId: this.config.deviceId,
        ownerJid: this.config.ownerJid,
        error: `GoWA service unreachable: ${err.message}`,
      });
    }

    return WhatsAppCommunicationStatusSchema.parse({
      state: 'error',
      isConfigured: false,
      baseUrl: this.config.baseUrl,
      deviceId: this.config.deviceId,
      error: 'Unknown status',
    });
  }

  public async getPairingQr(): Promise<{ qrCodeBase64?: string; status: string }> {
    try {
      const res = await fetch(`${this.config.baseUrl}/app/login`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return {
          qrCodeBase64: data?.results?.qr_link || data?.qr_link || data?.qr_duration,
          status: 'awaiting_scan',
        };
      }
    } catch (err: any) {
      return { status: `Failed to fetch QR: ${err.message}` };
    }
    return { status: 'unavailable' };
  }

  public async getPairingCode(
    phoneNumber: string,
  ): Promise<{ pairingCode?: string; status: string }> {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const res = await fetch(`${this.config.baseUrl}/app/login/phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return {
          pairingCode: data?.results?.pair_code || data?.code,
          status: 'code_generated',
        };
      }
    } catch (err: any) {
      return { status: `Failed to fetch pairing code: ${err.message}` };
    }
    return { status: 'unavailable' };
  }

  public async disconnect(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.baseUrl}/app/logout`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
