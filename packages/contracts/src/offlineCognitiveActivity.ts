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
  resourceCost: OfflineResourceCostSchema.default({ cpuTokensEstimated: 100, memoryIntensity: 'low' }),
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

export const ProactiveNotificationProposalSchema = z.object({
  id: z.string().uuid(),
  urgency: z.enum(['low', 'medium', 'high']),
  topic: z.string(),
  message: z.string(),
  reasoning: z.string(),
  shouldDeliverImmediately: z.boolean().default(false),
  delivered: z.boolean().default(false),
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
