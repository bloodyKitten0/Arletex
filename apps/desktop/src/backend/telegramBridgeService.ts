import { rootLogger, ILogger } from '@arletex/core';

export interface InboundTelegramMessage {
  messageId: number;
  chatId: number;
  fromId: number;
  fromName: string;
  username?: string;
  text: string;
  date: number;
}

export type TelegramMessageCallback = (msg: InboundTelegramMessage) => Promise<void> | void;

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

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('TelegramBridgeService');
  }

  public configure(botToken: string, targetChatId?: string, allowedChatIds?: (string | number)[]): void {
    this.botToken = botToken.trim() || null;
    if (targetChatId) {
      this.targetChatId = targetChatId.trim();
      this.allowedChatIds.add(this.targetChatId);
    }
    if (allowedChatIds) {
      for (const id of allowedChatIds) {
        this.allowedChatIds.add(String(id).trim());
      }
    }
    this.logger.info(
      `Telegram configured. Token present: ${!!this.botToken}, Target Chat ID: ${this.targetChatId || 'Not set'}, Allowlisted Chats: ${Array.from(this.allowedChatIds).join(', ') || 'None'}`
    );
  }

  public setAllowlist(chatIds: (string | number)[], userIds?: number[]): void {
    this.allowedChatIds = new Set(chatIds.map((id) => String(id).trim()));
    if (userIds) {
      this.allowedUserIds = new Set(userIds);
    }
    this.logger.info(`Updated Telegram allowlist: ${this.allowedChatIds.size} chats, ${this.allowedUserIds.size} users`);
  }

  public getStatus(): { isConfigured: boolean; isPolling: boolean; targetChatId: string | null } {
    return {
      isConfigured: !!this.botToken,
      isPolling: this.isPolling,
      targetChatId: this.targetChatId,
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
              if (update.message && update.message.text) {
                const msg = update.message;
                const inbound: InboundTelegramMessage = {
                  messageId: msg.message_id,
                  chatId: msg.chat.id,
                  fromId: msg.from?.id,
                  fromName: `${msg.from?.first_name || ''} ${msg.from?.last_name || ''}`.trim() || 'Partner',
                  username: msg.from?.username,
                  text: msg.text,
                  date: msg.date,
                };

                // Strict privacy boundary: Only process messages from allowlisted chats / users
                const chatIdStr = String(inbound.chatId);
                const isChatAllowed = this.allowedChatIds.size === 0 || this.allowedChatIds.has(chatIdStr);
                const isUserAllowed = this.allowedUserIds.size === 0 || (inbound.fromId && this.allowedUserIds.has(inbound.fromId));

                if (!isChatAllowed || !isUserAllowed) {
                  this.logger.warn(
                    `Rejected unauthorized inbound Telegram message from user=${inbound.fromId} (${inbound.fromName}) in chat=${inbound.chatId}. Not in allowlist.`
                  );
                  continue;
                }

                // If targetChatId is not set, set it from first verified allowlisted message
                if (!this.targetChatId && this.allowedChatIds.has(chatIdStr)) {
                  this.targetChatId = chatIdStr;
                }

                this.logger.info(`Received Telegram message from authorized ${inbound.fromName}: "${inbound.text}"`);

                for (const listener of this.messageListeners) {
                  try {
                    await listener(inbound);
                  } catch (listenerErr) {
                    this.logger.error('Error in Telegram message listener', listenerErr);
                  }
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
   * Sends an outbound message to Telegram chat.
   */
  public async sendMessage(chatId: string | number, text: string): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn('Cannot send Telegram message: bot token not configured.');
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
