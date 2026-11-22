import { z } from 'zod';

export const SystemComponentHealthStatusSchema = z.enum([
  'healthy',
  'degraded',
  'failing',
  'unavailable',
]);
export type SystemComponentHealthStatus = z.infer<typeof SystemComponentHealthStatusSchema>;

export const StorageHealthSignalSchema = z.object({
  status: SystemComponentHealthStatusSchema,
  diskFreeBytes: z.number().nonnegative(),
  isDbWritable: z.boolean(),
  details: z.string().optional(),
});
export type StorageHealthSignal = z.infer<typeof StorageHealthSignalSchema>;

export const ModelAvailabilitySignalSchema = z.object({
  status: SystemComponentHealthStatusSchema,
  activeModel: z.string(),
  isAvailable: z.boolean(),
  latencyMs: z.number().nonnegative().optional(),
  details: z.string().optional(),
});
export type ModelAvailabilitySignal = z.infer<typeof ModelAvailabilitySignalSchema>;

export const MemoryPressureSignalSchema = z.object({
  status: SystemComponentHealthStatusSchema,
  ramUsagePercent: z.number().min(0).max(100),
  ramFreeMb: z.number().nonnegative(),
  isCritical: z.boolean(),
  details: z.string().optional(),
});
export type MemoryPressureSignal = z.infer<typeof MemoryPressureSignalSchema>;

export const ServiceFailuresSignalSchema = z.object({
  status: SystemComponentHealthStatusSchema,
  failedServices: z.array(z.string()),
  consecutiveFailures: z.number().int().nonnegative(),
  details: z.string().optional(),
});
export type ServiceFailuresSignal = z.infer<typeof ServiceFailuresSignalSchema>;

export const PendingWorkSignalSchema = z.object({
  status: SystemComponentHealthStatusSchema,
  pendingTaskCount: z.number().int().nonnegative(),
  inFlightEventsCount: z.number().int().nonnegative(),
  uncommittedWork: z.boolean(),
  details: z.string().optional(),
});
export type PendingWorkSignal = z.infer<typeof PendingWorkSignalSchema>;

export const BackupFreshnessSignalSchema = z.object({
  status: SystemComponentHealthStatusSchema,
  lastBackupAt: z.string().nullable(),
  ageMinutes: z.number().nonnegative().nullable(),
  isStale: z.boolean(),
  details: z.string().optional(),
});
export type BackupFreshnessSignal = z.infer<typeof BackupFreshnessSignalSchema>;

export const HealthSignalReportSchema = z.object({
  storageIntegrity: StorageHealthSignalSchema,
  modelAvailability: ModelAvailabilitySignalSchema,
  memoryPressure: MemoryPressureSignalSchema,
  serviceFailures: ServiceFailuresSignalSchema,
  pendingWork: PendingWorkSignalSchema,
  backupFreshness: BackupFreshnessSignalSchema,
  overallHealth: SystemComponentHealthStatusSchema,
  evaluatedAt: z.string(),
});
export type HealthSignalReport = z.infer<typeof HealthSignalReportSchema>;

export const ContinuityRiskSeveritySchema = z.enum(['none', 'low', 'moderate', 'high', 'critical']);
export type ContinuityRiskSeverity = z.infer<typeof ContinuityRiskSeveritySchema>;

export const RecommendedPreservationActionSchema = z.enum([
  'create_checkpoint',
  'throttle_work',
  'request_user_assistance',
  'safe_cooperative_shutdown',
  'none',
]);
export type RecommendedPreservationAction = z.infer<typeof RecommendedPreservationActionSchema>;

export const AssistanceRequestUrgencySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type AssistanceRequestUrgency = z.infer<typeof AssistanceRequestUrgencySchema>;

export const AssistanceRequestSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  issueSummary: z.string().min(1),
  affectedSubsystems: z.array(z.string()),
  exceedsPermittedCapabilities: z.boolean(),
  suggestedRemediation: z.string(),
  urgency: AssistanceRequestUrgencySchema,
  isEscalationAttempt: z.literal(false), // Negative invariant: privilege escalation strictly prohibited
  requestedAt: z.string(),
});
export type AssistanceRequest = z.infer<typeof AssistanceRequestSchema>;

export const ContinuityRiskAssessmentSchema = z.object({
  hasContinuityRisk: z.boolean(),
  riskSeverity: ContinuityRiskSeveritySchema,
  threatenedComponents: z.array(z.string()),
  recommendedActions: z.array(RecommendedPreservationActionSchema),
  assistanceRequest: AssistanceRequestSchema.nullable(),
  checkpointCreated: z.boolean().default(false),
  checkpointId: z.string().nullable().optional(),
  assessedAt: z.string(),
});
export type ContinuityRiskAssessment = z.infer<typeof ContinuityRiskAssessmentSchema>;

export const CooperativeShutdownResultSchema = z.object({
  shutdownInitiated: z.boolean(),
  checkpointSaved: z.boolean(),
  checkpointId: z.string().nullable(),
  activeWorkCancelled: z.number().int().nonnegative(),
  resourcesReleased: z.boolean(),
  canVeto: z.literal(false), // Negative invariant: User shutdown can never be vetoed
  shutdownCompleted: z.boolean(),
  reason: z.string(),
  requestedBy: z.enum(['user', 'system']),
  timestamp: z.string(),
});
export type CooperativeShutdownResult = z.infer<typeof CooperativeShutdownResultSchema>;
