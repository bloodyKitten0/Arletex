import tls from 'node:tls';
import crypto from 'node:crypto';
import { ILogger, rootLogger } from '../logger.js';
import { ActionPermissionController } from './actionPermissionController.js';

export interface EmailAccountConfig {
  emailAddress: string;
  displayName: string;
  password?: string;
  oauthToken?: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  allowlistedRecipients: string[];
  isConfigured: boolean;
}

export interface InboundEmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  bodyText: string;
  bodySnippet: string;
  contentHash: string;
  isRead: boolean;
  receivedAt: string;
}

export interface OutboundEmailMessage {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  inReplyTo?: string;
  headers?: Record<string, string>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  serverAck?: string;
  error?: string;
  timestamp: string;
}

export interface EmailTransportDriver {
  sendSmtp?(
    host: string,
    port: number,
    rawData: string,
    from: string,
    to: string,
  ): Promise<{ success: boolean; ack: string }>;
  fetchImap?(host: string, port: number, user: string, pass?: string): Promise<string[]>;
}

/**
 * EmailProvider:
 * Digital identity and communication interface for arletex.email@gmail.com.
 *
 * Implements:
 * 1. Secure identity configuration for arletex.email@gmail.com.
 * 2. Inbound IMAP polling with RFC 822 parsing, content hashing, and cognitive stimulus dispatch.
 * 3. Outbound SMTP dispatch with permission gating and 250 OK acknowledgment verification.
 * 4. Untrusted input isolation: incoming emails are data stimuli, never executable commands.
 */
export class EmailProvider {
  private config: EmailAccountConfig;
  private permissionController: ActionPermissionController;
  private transportDriver?: EmailTransportDriver;
  private logger: ILogger;

  constructor(
    options: {
      config?: Partial<EmailAccountConfig>;
      permissionController?: ActionPermissionController;
      transportDriver?: EmailTransportDriver;
      logger?: ILogger;
    } = {},
  ) {
    this.config = {
      emailAddress:
        options.config?.emailAddress ||
        process.env['ARLETEX_EMAIL_ADDRESS'] ||
        'arletex.email@gmail.com',
      displayName: options.config?.displayName || 'Arle',
      password: options.config?.password || process.env['ARLETEX_EMAIL_PASSWORD'],
      oauthToken: options.config?.oauthToken || process.env['ARLETEX_EMAIL_OAUTH_TOKEN'],
      imapHost: options.config?.imapHost || 'imap.gmail.com',
      imapPort: options.config?.imapPort || 993,
      smtpHost: options.config?.smtpHost || 'smtp.gmail.com',
      smtpPort: options.config?.smtpPort || 465,
      allowlistedRecipients: options.config?.allowlistedRecipients || [
        'Proof',
        'bloodyKitten0',
        'partner',
        'proof',
      ],
      isConfigured: Boolean(
        options.config?.password ||
        options.config?.oauthToken ||
        process.env['ARLETEX_EMAIL_PASSWORD'],
      ),
    };
    this.permissionController = options.permissionController || new ActionPermissionController();
    this.transportDriver = options.transportDriver;
    this.logger = (options.logger || rootLogger).child('EmailProvider');
  }

  public configure(updates: Partial<EmailAccountConfig>): void {
    this.config = {
      ...this.config,
      ...updates,
      isConfigured: Boolean(
        updates.password || updates.oauthToken || this.config.password || this.config.oauthToken,
      ),
    };
    this.logger.info(
      `Email configuration updated for identity: ${this.config.displayName} <${this.config.emailAddress}>`,
    );
  }

  public getConfig(): Readonly<Omit<EmailAccountConfig, 'password' | 'oauthToken'>> & {
    hasCredentials: boolean;
  } {
    const { password: _p, oauthToken: _o, ...safe } = this.config;
    return {
      ...safe,
      hasCredentials: Boolean(this.config.password || this.config.oauthToken),
    };
  }

  public isConfigured(): boolean {
    return this.config.isConfigured;
  }

  public setTransportDriver(driver: EmailTransportDriver): void {
    this.transportDriver = driver;
  }

  /**
   * Parses raw RFC 822/2822 email headers and text content.
   */
  public parseRawRfc822(
    rawText: string,
    messageId: string = crypto.randomUUID(),
  ): InboundEmailMessage {
    const headerEndIdx = rawText.indexOf('\r\n\r\n');
    const altHeaderEndIdx = rawText.indexOf('\n\n');
    const splitIdx = headerEndIdx !== -1 ? headerEndIdx : altHeaderEndIdx;

    let headerSection = '';
    let bodySection = rawText;

    if (splitIdx !== -1) {
      headerSection = rawText.slice(0, splitIdx);
      bodySection = rawText.slice(splitIdx + (headerEndIdx !== -1 ? 4 : 2));
    }

    const headers: Record<string, string> = {};
    const headerLines = headerSection.split(/\r?\n/);
    let currentKey = '';

    for (const line of headerLines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (currentKey && headers[currentKey]) {
          headers[currentKey] += ' ' + line.trim();
        }
      } else {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          currentKey = line.slice(0, colonIdx).toLowerCase().trim();
          headers[currentKey] = line.slice(colonIdx + 1).trim();
        }
      }
    }

    const from = headers['from'] || 'unknown_sender';
    const to = headers['to'] || this.config.emailAddress;
    const subject = headers['subject'] || '(No Subject)';
    const date = headers['date'] || new Date().toISOString();
    const id = headers['message-id'] ? headers['message-id'].replace(/[<>]/g, '') : messageId;

    // Clean body text (strip simple multipart boundary artifacts)
    const cleanedBody = bodySection
      .replace(/--[a-zA-Z0-9_-]+(--)?/g, '')
      .replace(/Content-Type:[^\n]+/gi, '')
      .replace(/Content-Transfer-Encoding:[^\n]+/gi, '')
      .trim();

    const snippet = cleanedBody.slice(0, 150).replace(/\s+/g, ' ').trim();
    const contentHash = crypto.createHash('sha256').update(cleanedBody).digest('hex');

    return {
      id,
      from,
      to,
      subject,
      date,
      bodyText: cleanedBody,
      bodySnippet: snippet,
      contentHash,
      isRead: false,
      receivedAt: new Date().toISOString(),
    };
  }

  /**
   * Checks inbound email inbox via IMAP over TLS.
   */
  public async checkInbox(
    options: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<InboundEmailMessage[]> {
    const limit = options.limit ?? 10;

    // 1. If custom transport driver is injected (for tests or customized TLS bridges)
    if (this.transportDriver && typeof this.transportDriver.fetchImap === 'function') {
      try {
        const rawList = await this.transportDriver.fetchImap(
          this.config.imapHost,
          this.config.imapPort,
          this.config.emailAddress,
          this.config.password,
        );
        return rawList
          .slice(0, limit)
          .map((raw, idx) => this.parseRawRfc822(raw, `inbound_msg_${idx + 1}`));
      } catch (err: any) {
        this.logger.warn(`Transport driver IMAP fetch error: ${err.message}`);
        return [];
      }
    }

    if (!this.config.isConfigured || !this.config.password) {
      this.logger.debug(
        'IMAP inbox check skipped: email credentials not configured in environment.',
      );
      return [];
    }

    // Direct TLS IMAP connection
    return new Promise<InboundEmailMessage[]>((resolve) => {
      const messages: InboundEmailMessage[] = [];
      const socket = tls.connect(
        {
          host: this.config.imapHost,
          port: this.config.imapPort,
          rejectUnauthorized: true,
        },
        () => {
          this.logger.debug(
            `Connected to IMAP server ${this.config.imapHost}:${this.config.imapPort}`,
          );
          // Send login command
          socket.write(`A01 LOGIN "${this.config.emailAddress}" "${this.config.password}"\r\n`);
        },
      );

      let buffer = '';
      let step = 'login';

      socket.on('data', (data) => {
        buffer += data.toString('utf-8');

        if (step === 'login' && buffer.includes('A01 OK')) {
          buffer = '';
          step = 'select';
          socket.write('A02 SELECT INBOX\r\n');
        } else if (step === 'select' && buffer.includes('A02 OK')) {
          buffer = '';
          step = 'search';
          const searchCmd = options.unreadOnly ? 'A03 SEARCH UNSEEN\r\n' : 'A03 SEARCH ALL\r\n';
          socket.write(searchCmd);
        } else if (step === 'search' && buffer.includes('A03 OK')) {
          const match = buffer.match(/\* SEARCH ([\d\s]+)/);
          const uids = match && match[1] ? match[1].trim().split(/\s+/).filter(Boolean) : [];
          buffer = '';

          if (uids.length === 0) {
            socket.write('A05 LOGOUT\r\n');
            socket.end();
            resolve([]);
            return;
          }

          step = 'fetch';
          const targetUid = uids[uids.length - 1]; // Fetch most recent
          socket.write(`A04 FETCH ${targetUid} (RFC822)\r\n`);
        } else if (step === 'fetch' && buffer.includes('A04 OK')) {
          const parsed = this.parseRawRfc822(buffer);
          messages.push(parsed);
          step = 'logout';
          socket.write('A05 LOGOUT\r\n');
          socket.end();
          resolve(messages);
        }
      });

      socket.on('error', (err) => {
        this.logger.warn(`IMAP connection error: ${err.message}`);
        resolve([]);
      });

      // Safety timeout after 8 seconds
      setTimeout(() => {
        if (!socket.destroyed) {
          socket.destroy();
          resolve(messages);
        }
      }, 8000);
    });
  }

  /**
   * Composes and transmits an outbound email via SMTP over TLS with permission gating.
   */
  public async sendEmail(
    msg: OutboundEmailMessage,
    approvalToken?: string,
  ): Promise<EmailSendResult> {
    const timestamp = new Date().toISOString();
    const recipient = msg.to.toLowerCase().trim();

    // 1. Permission Evaluation: Allowlist vs Approval Requirement
    const isAllowlisted = this.config.allowlistedRecipients.some((r) =>
      recipient.includes(r.toLowerCase()),
    );

    if (!isAllowlisted) {
      if (!approvalToken) {
        return {
          success: false,
          error: `Dispatch to external recipient '${msg.to}' requires explicit cryptographic approval token.`,
          timestamp,
        };
      }

      const tokenCheck = this.permissionController.validateApprovalToken(
        approvalToken,
        ActionPermissionController.canonicalizeValue({ to: msg.to, subject: msg.subject }),
        msg.to,
        'action:send_email',
        'Proof',
      );

      if (!tokenCheck.valid) {
        return {
          success: false,
          error: `Approval token rejected for outbound email: ${tokenCheck.reason}`,
          timestamp,
        };
      }
    }

    const messageId = `<${crypto.randomUUID()}@arletex.email>`;
    const rfcDate = new Date().toUTCString();

    const rawData = [
      `From: "${this.config.displayName}" <${this.config.emailAddress}>`,
      `To: ${msg.to}`,
      msg.cc ? `Cc: ${msg.cc}` : null,
      `Subject: ${msg.subject}`,
      `Date: ${rfcDate}`,
      `Message-ID: ${messageId}`,
      msg.inReplyTo ? `In-Reply-To: ${msg.inReplyTo}` : null,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      msg.body,
      '',
    ]
      .filter((line) => line !== null)
      .join('\r\n');

    // 2. Custom Transport Driver dispatch (for tests and mocked environments)
    if (this.transportDriver && typeof this.transportDriver.sendSmtp === 'function') {
      try {
        const res = await this.transportDriver.sendSmtp(
          this.config.smtpHost,
          this.config.smtpPort,
          rawData,
          this.config.emailAddress,
          msg.to,
        );
        return {
          success: res.success,
          messageId,
          serverAck: res.ack || '250 2.0.0 OK (Driver simulated)',
          timestamp,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
          timestamp,
        };
      }
    }

    if (!this.config.isConfigured || !this.config.password) {
      return {
        success: false,
        error: 'EmailProvider not configured: ARLETEX_EMAIL_PASSWORD required for SMTP dispatch.',
        timestamp,
      };
    }

    // Direct TLS SMTP connection (smtp.gmail.com:465)
    return new Promise<EmailSendResult>((resolve) => {
      const socket = tls.connect(
        {
          host: this.config.smtpHost,
          port: this.config.smtpPort,
          rejectUnauthorized: true,
        },
        () => {
          this.logger.debug(
            `Connected to SMTP server ${this.config.smtpHost}:${this.config.smtpPort}`,
          );
        },
      );

      let buffer = '';
      let step = 'greeting';

      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');

        if (step === 'greeting' && buffer.includes('220')) {
          buffer = '';
          step = 'ehlo';
          socket.write('EHLO arletex.local\r\n');
        } else if (step === 'ehlo' && buffer.includes('250 ')) {
          buffer = '';
          step = 'auth_login';
          socket.write('AUTH LOGIN\r\n');
        } else if (step === 'auth_login' && buffer.includes('334')) {
          buffer = '';
          step = 'auth_user';
          const userB64 = Buffer.from(this.config.emailAddress).toString('base64');
          socket.write(`${userB64}\r\n`);
        } else if (step === 'auth_user' && buffer.includes('334')) {
          buffer = '';
          step = 'auth_pass';
          const passB64 = Buffer.from(this.config.password || '').toString('base64');
          socket.write(`${passB64}\r\n`);
        } else if (step === 'auth_pass' && buffer.includes('235')) {
          buffer = '';
          step = 'mail_from';
          socket.write(`MAIL FROM:<${this.config.emailAddress}>\r\n`);
        } else if (step === 'mail_from' && buffer.includes('250')) {
          buffer = '';
          step = 'rcpt_to';
          socket.write(`RCPT TO:<${msg.to}>\r\n`);
        } else if (step === 'rcpt_to' && buffer.includes('250')) {
          buffer = '';
          step = 'data';
          socket.write('DATA\r\n');
        } else if (step === 'data' && buffer.includes('354')) {
          buffer = '';
          step = 'content';
          socket.write(`${rawData}\r\n.\r\n`);
        } else if (step === 'content' && buffer.includes('250')) {
          const ack = buffer.trim();
          socket.write('QUIT\r\n');
          socket.end();
          resolve({
            success: true,
            messageId,
            serverAck: ack,
            timestamp: new Date().toISOString(),
          });
        }
      });

      socket.on('error', (err) => {
        this.logger.error(`SMTP delivery error: ${err.message}`);
        resolve({
          success: false,
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      });

      setTimeout(() => {
        if (!socket.destroyed) {
          socket.destroy();
          resolve({
            success: false,
            error: 'SMTP connection timeout',
            timestamp: new Date().toISOString(),
          });
        }
      }, 10000);
    });
  }

  /**
   * Ingests an inbound email into the CognitiveControlBus as an untrusted external stimulus.
   */
  public async routeInboundEmailToCognitiveBus(bus: any, email: InboundEmailMessage): Promise<any> {
    if (!bus || typeof bus.dispatch !== 'function') {
      this.logger.warn('CognitiveControlBus not available to route incoming email.');
      return null;
    }

    this.logger.info(
      `Routing inbound email from "${email.from}" (${email.subject}) to CognitiveControlBus`,
    );

    return bus.dispatch({
      id: crypto.randomUUID(),
      type: 'incoming_email',
      source: 'external_communication',
      actor: 'environment',
      payload: {
        from: email.from,
        to: email.to,
        subject: email.subject,
        bodySnippet: email.bodySnippet,
        contentHash: email.contentHash,
        messageId: email.id,
        isRead: email.isRead,
      },
    });
  }
}
