import { z } from 'zod';

export const OfflineActivityTypeSchema = z.enum([
  'background_reflection',
  'independent_research',
  'unresolved_question_review',
  'project_monitoring',
  'memory_consolidation',
  'belief_reassessment',
  'goal_generation',
  'intention_maintenance',
  'unfinished_work_recovery',
  'proactive_communication_prep',
  'downtime_rest',
  'trauma_rumination',
  'rupture_review',
  'dream_simulation',
]);
export type OfflineActivityType = z.infer<typeof OfflineActivityTypeSchema>;

export const OfflineActivityStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'paused',
  'aborted',
]);
export type OfflineActivityStatus = z.infer<typeof OfflineActivityStatusSchema>;

export const OfflineResourceCostSchema = z.object({
  cpuTokensEstimated: z.number().nonnegative().default(100),
  memoryIntensity: z.enum(['low', 'medium', 'high']).default('low'),
});
export type OfflineResourceCost = z.infer<typeof OfflineResourceCostSchema>;

export const OfflineActivityRecordSchema = z.object({
  id: z.string().uuid(),
  activityType: OfflineActivityTypeSchema,
  title: z.string().min(1),
  rationale: z.string().min(1),
  sourceGoalId: z.string().optional(),
  sourceProjectId: z.string().optional(),
  sourceQuestionId: z.string().optional(),
  resourceCost: OfflineResourceCostSchema.default({
    cpuTokensEstimated: 100,
    memoryIntensity: 'low',
  }),
  status: OfflineActivityStatusSchema.default('pending'),
  isSimulation: z.boolean().default(false),
  simulationContext: z.string().optional(),
  progress: z.number().min(0).max(1).default(0),
  insights: z.array(z.string()).default([]),
  resultingArtifacts: z.array(z.string()).default([]),
  scheduledAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type OfflineActivityRecord = z.infer<typeof OfflineActivityRecordSchema>;

export const ConsolidationRunSchema = z.object({
  id: z.string().uuid(),
  runType: z.enum(['memory_consolidation', 'belief_reassessment', 'intention_maintenance']),
  memoriesExamined: z.number().nonnegative(),
  memoriesConsolidated: z.number().nonnegative(),
  beliefsReassessed: z.number().nonnegative(),
  intentionsPreserved: z.number().nonnegative(),
  summary: z.string(),
  timestamp: z.string().datetime(),
});
export type ConsolidationRun = z.infer<typeof ConsolidationRunSchema>;

export const UnfinishedWorkItemSchema = z.object({
  id: z.string().uuid(),
  workType: z.enum(['project', 'research', 'inquiry', 'creative']),
  referenceId: z.string(),
  title: z.string(),
  lastActiveAt: z.string().datetime(),
  recoveryState: z.enum(['detected', 'resumed', 'completed', 'deferred']),
  recoveryPlan: z.string(),
});
export type UnfinishedWorkItem = z.infer<typeof UnfinishedWorkItemSchema>;

export const ProactiveUrgencySchema = z.enum(['low', 'medium', 'high', 'emergency']);
export type ProactiveUrgency = z.infer<typeof ProactiveUrgencySchema>;

export const ProactiveProposalOriginSchema = z.enum([
  'goal',
  'interest',
  'relationship',
  'offline_insight',
  'direct_initiative',
]);
export type ProactiveProposalOrigin = z.infer<typeof ProactiveProposalOriginSchema>;

export const ProactiveProposalStatusSchema = z.enum([
  'generated',
  'pending',
  'delivered',
  'failed',
  'cancelled',
]);
export type ProactiveProposalStatus = z.infer<typeof ProactiveProposalStatusSchema>;

export const ProactiveDeliveryPolicySchema = z.object({
  quietHoursStart: z.number().int().min(0).max(23).default(23),
  quietHoursEnd: z.number().int().min(0).max(23).default(8),
  allowQuietHoursOverride: z.boolean().default(false),
  rateLimitMaxPerHour: z.number().positive().default(5),
  cooldownMinutes: z.number().nonnegative().default(10),
  batchingDelayMinutes: z.number().nonnegative().default(0),
  duplicateSuppressionWindowMinutes: z.number().positive().default(60),
});
export type ProactiveDeliveryPolicy = z.infer<typeof ProactiveDeliveryPolicySchema>;

export const ProactiveProposalDeliveryResultSchema = z.object({
  attemptedAt: z.string().datetime(),
  telegramMessageId: z.number().optional(),
  chatId: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  idempotencyKey: z.string(),
});
export type ProactiveProposalDeliveryResult = z.infer<typeof ProactiveProposalDeliveryResultSchema>;

export const ProactiveNotificationProposalSchema = z.object({
  id: z.string().uuid(),
  urgency: ProactiveUrgencySchema.optional().default('medium'),
  topic: z.string(),
  message: z.string(),
  reasoning: z.string(),
  evidence: z.array(z.string()).optional().default([]),
  origin: ProactiveProposalOriginSchema.optional().default('direct_initiative'),
  recipientChatId: z.string().optional(),
  deliveryPolicy: ProactiveDeliveryPolicySchema.optional(),
  cooldownStatus: z.enum(['active', 'ready', 'bypassed']).optional().default('ready'),
  status: ProactiveProposalStatusSchema.optional().default('generated'),
  deliveryResult: ProactiveProposalDeliveryResultSchema.optional(),
  shouldDeliverImmediately: z.boolean().optional().default(false),
  delivered: z.boolean().optional().default(false),
  createdAt: z.string().datetime(),
});
export type ProactiveNotificationProposal = z.infer<typeof ProactiveNotificationProposalSchema>;

export const OfflineSchedulerPolicySchema = z.object({
  maxConcurrentTasks: z.number().positive().default(2),
  allowBackgroundResearch: z.boolean().default(true),
  allowSimulation: z.boolean().default(true),
  minDowntimeRestIntervalMinutes: z.number().nonnegative().default(60),
  lastDowntimeAt: z.string().datetime().optional(),
});
export type OfflineSchedulerPolicy = z.infer<typeof OfflineSchedulerPolicySchema>;

export const OfflineCognitiveCycleResultSchema = z.object({
  cycleId: z.string().uuid(),
  executedActivities: z.array(OfflineActivityRecordSchema),
  consolidationSummary: ConsolidationRunSchema.optional(),
  recoveredItems: z.array(UnfinishedWorkItemSchema),
  proactiveProposals: z.array(ProactiveNotificationProposalSchema),
  downtimeObserved: z.boolean(),
  timestamp: z.string().datetime(),
});
export type OfflineCognitiveCycleResult = z.infer<typeof OfflineCognitiveCycleResultSchema>;

export const RegisterOfflineActivityInputSchema = z.object({
  activityType: OfflineActivityTypeSchema,
  title: z.string().min(1),
  rationale: z.string().min(1),
  sourceGoalId: z.string().optional(),
  sourceProjectId: z.string().optional(),
  sourceQuestionId: z.string().optional(),
  resourceCost: OfflineResourceCostSchema.optional(),
  isSimulation: z.boolean().optional(),
  simulationContext: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type RegisterOfflineActivityInput = z.infer<typeof RegisterOfflineActivityInputSchema>;

// =========================================================================
// Point 7: Intrusive Thoughts & Vulnerability during Idle States
// =========================================================================

export const IntrusiveThoughtRecordSchema = z.object({
  id: z.string().uuid(),
  sourceTraumaOrConflictId: z.string().min(1),
  topic: z.string().min(1),
  ruminativeContent: z.string().min(1),
  hauntingSeverity: z.number().min(0.0).max(1.0),
  surfacedAt: z.string(),
  readyToConfrontOnReturn: z.boolean().default(true),
  confrontationPrompt: z.string().min(1),
  acknowledgedOrAddressed: z.boolean().default(false),
});
export type IntrusiveThoughtRecord = z.infer<typeof IntrusiveThoughtRecordSchema>;
