import { z } from 'zod';

export const ShutdownTypeSchema = z.enum([
  'active',
  'clean',
  'unexpected_crash',
  'interrupted',
]);
export type ShutdownType = z.infer<typeof ShutdownTypeSchema>;

export const ChannelOriginSchema = z.enum([
  'desktop',
  'telegram',
  'cli',
  'unified',
  'system',
]);
export type ChannelOrigin = z.infer<typeof ChannelOriginSchema>;

export const IdentitySessionSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  lastHeartbeatAt: z.string(),
  endedAt: z.string().nullable(),
  shutdownType: ShutdownTypeSchema,
  channelOrigin: ChannelOriginSchema,
  activeInferenceModel: z.string(),
  memoryCount: z.number(),
  activeEmotionsCount: z.number(),
  downtimeFromPreviousMs: z.number(),
  metadata: z.record(z.unknown()).default({}),
});
export type IdentitySession = z.infer<typeof IdentitySessionSchema>;

export const CheckpointTypeSchema = z.enum([
  'periodic',
  'clean_shutdown',
  'pre_recovery',
  'manual',
  'state_transition',
]);
export type CheckpointType = z.infer<typeof CheckpointTypeSchema>;

export const IdentityCheckpointSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  checkpointType: CheckpointTypeSchema,
  stateHash: z.string(),
  masterStateJson: z.string(),
  memoryCount: z.number(),
  schemaVersion: z.number(),
  isVerifiedValid: z.boolean(),
  createdAt: z.string(),
});
export type IdentityCheckpoint = z.infer<typeof IdentityCheckpointSchema>;

export const ChannelPresenceSchema = z.object({
  channel: ChannelOriginSchema,
  lastInteractionAt: z.string(),
  interactionCount: z.number(),
  activeContextSummary: z.string(),
  updatedAt: z.string(),
});
export type ChannelPresence = z.infer<typeof ChannelPresenceSchema>;

export const ContinuityStatusSchema = z.object({
  currentSession: IdentitySessionSchema.nullable(),
  lastShutdownType: ShutdownTypeSchema.nullable(),
  wasUnexpectedShutdown: z.boolean(),
  downtimeMs: z.number(),
  totalSessionsCount: z.number(),
  latestCheckpoint: IdentityCheckpointSchema.nullable(),
  channelPresences: z.array(ChannelPresenceSchema),
  stateIntegrityValid: z.boolean(),
  memoryCount: z.number(),
});
export type ContinuityStatus = z.infer<typeof ContinuityStatusSchema>;

export const CreateCheckpointInputSchema = z.object({
  type: CheckpointTypeSchema.optional().default('manual'),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateCheckpointInput = z.infer<typeof CreateCheckpointInputSchema>;

export const RestoreCheckpointInputSchema = z.object({
  checkpointId: z.string().optional(),
});
export type RestoreCheckpointInput = z.infer<typeof RestoreCheckpointInputSchema>;
