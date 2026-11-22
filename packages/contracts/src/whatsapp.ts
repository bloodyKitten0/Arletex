import { z } from 'zod';

export const WhatsAppConfigSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().url().default('http://127.0.0.1:3000'),
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  deviceId: z.string().optional().default('default'),
  webhookSecret: z.string().optional().default(''),
  ownerJid: z.string().optional().default(''),
  allowedSenders: z.array(z.string()).default([]),
  autoReply: z.boolean().default(false),
  rateLimitPerMinute: z.number().min(1).max(120).default(30),
});

export type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;

export const WhatsAppMediaTypeEnum = z.enum([
  'text',
  'image',
  'photo',
  'video',
  'audio',
  'voice',
  'document',
  'unsupported',
]);

export type WhatsAppMediaType = z.infer<typeof WhatsAppMediaTypeEnum>;

export const WhatsAppWebhookMessageSchema = z.object({
  id: z.string(),
  from: z.string(), // e.g. "1234567890@s.whatsapp.net"
  senderName: z.string().optional(),
  isGroup: z.boolean().default(false),
  groupJid: z.string().optional(),
  timestamp: z.number(),
  text: z.string().default(''),
  mediaType: WhatsAppMediaTypeEnum.default('text'),
  mediaUrl: z.string().optional(),
  mediaData: z.string().optional(),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  quotedMessageId: z.string().optional(),
});

export type WhatsAppWebhookMessage = z.infer<typeof WhatsAppWebhookMessageSchema>;

export const WhatsAppWebhookPayloadSchema = z.object({
  event: z.string(), // e.g. "message", "device.status", "pairing"
  deviceId: z.string().default('default'),
  timestamp: z.number(),
  message: WhatsAppWebhookMessageSchema.optional(),
  raw: z.record(z.any()).optional(),
});

export type WhatsAppWebhookPayload = z.infer<typeof WhatsAppWebhookPayloadSchema>;

export const WhatsAppSendInputSchema = z.object({
  recipientJid: z.string().min(1),
  text: z.string().min(1),
  replyToMessageId: z.string().optional(),
  mediaPath: z.string().optional(),
  mediaType: z.enum(['image', 'video', 'audio', 'document']).optional(),
});

export type WhatsAppSendInput = z.infer<typeof WhatsAppSendInputSchema>;

export const WhatsAppDeliveryStatusEnum = z.enum([
  'accepted',
  'sent',
  'delivered',
  'read',
  'failed',
]);

export type WhatsAppDeliveryStatus = z.infer<typeof WhatsAppDeliveryStatusEnum>;

export const WhatsAppSendResultSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  status: WhatsAppDeliveryStatusEnum,
  recipientJid: z.string(),
  timestamp: z.string(),
  error: z.string().optional(),
});

export type WhatsAppSendResult = z.infer<typeof WhatsAppSendResultSchema>;

export const WhatsAppConnectionStateEnum = z.enum([
  'disabled',
  'starting',
  'awaiting_pairing',
  'connected',
  'disconnected',
  'reconnecting',
  'auth_required',
  'error',
]);

export type WhatsAppConnectionState = z.infer<typeof WhatsAppConnectionStateEnum>;

export const WhatsAppCommunicationStatusSchema = z.object({
  state: WhatsAppConnectionStateEnum,
  isConfigured: z.boolean(),
  baseUrl: z.string(),
  deviceId: z.string(),
  ownerJid: z.string().optional(),
  qrCodeBase64: z.string().nullable().optional(),
  pairingCode: z.string().nullable().optional(),
  lastSeen: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export type WhatsAppCommunicationStatus = z.infer<typeof WhatsAppCommunicationStatusSchema>;

export const WhatsAppMessageEnvelopeSchema = z.object({
  id: z.string(),
  source: z.literal('whatsapp').default('whatsapp'),
  senderJid: z.string(),
  senderName: z.string().default(''),
  isOwner: z.boolean(),
  timestamp: z.string(),
  text: z.string(),
  mediaType: WhatsAppMediaTypeEnum.default('text'),
  mediaUrl: z.string().optional(),
  mediaData: z.string().optional(),
  mediaPath: z.string().optional(),
  mimeType: z.string().optional(),
  fileName: z.string().optional(),
  untrustedInput: z.literal(true).default(true), // prompt injection defense flag
  rawPayload: z.record(z.any()).optional(),
});

export type WhatsAppMessageEnvelope = z.infer<typeof WhatsAppMessageEnvelopeSchema>;
