import Database from 'better-sqlite3';

export interface WhatsAppDeduplicationRecord {
  messageId: string;
  deviceId: string;
  senderJid: string;
  receivedAt: string;
  processedAt: string;
}

export interface WhatsAppOutboundRecord {
  id: string;
  messageId?: string;
  recipientJid: string;
  text: string;
  deliveryStatus: string;
  sentAt: string;
  deliveredAt?: string;
  error?: string;
}

export class WhatsAppRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public isProcessed(messageId: string): boolean {
    const row = this.db
      .prepare('SELECT message_id FROM whatsapp_deduplication WHERE message_id = ?')
      .get(messageId);
    return Boolean(row);
  }

  public markProcessed(record: WhatsAppDeduplicationRecord): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO whatsapp_deduplication (message_id, device_id, sender_jid, received_at, processed_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        record.messageId,
        record.deviceId,
        record.senderJid,
        record.receivedAt,
        record.processedAt,
      );
  }

  public logOutbound(record: WhatsAppOutboundRecord): void {
    this.db
      .prepare(
        `INSERT INTO whatsapp_outbound_audit (id, message_id, recipient_jid, text, delivery_status, sent_at, delivered_at, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.id,
        record.messageId || null,
        record.recipientJid,
        record.text,
        record.deliveryStatus,
        record.sentAt,
        record.deliveredAt || null,
        record.error || null,
      );
  }

  public updateOutboundStatus(
    id: string,
    status: string,
    deliveredAt?: string,
    error?: string,
  ): void {
    this.db
      .prepare(
        `UPDATE whatsapp_outbound_audit
         SET delivery_status = ?, delivered_at = COALESCE(?, delivered_at), error = ?
         WHERE id = ?`,
      )
      .run(status, deliveredAt || null, error || null, id);
  }

  public getOutboundRecords(limit = 50): WhatsAppOutboundRecord[] {
    const rows = this.db
      .prepare(
        'SELECT id, message_id, recipient_jid, text, delivery_status, sent_at, delivered_at, error FROM whatsapp_outbound_audit ORDER BY sent_at DESC LIMIT ?',
      )
      .all(limit) as any[];

    return rows.map((r) => ({
      id: r.id,
      messageId: r.message_id || undefined,
      recipientJid: r.recipient_jid,
      text: r.text,
      deliveryStatus: r.delivery_status,
      sentAt: r.sent_at,
      deliveredAt: r.delivered_at || undefined,
      error: r.error || undefined,
    }));
  }
}
