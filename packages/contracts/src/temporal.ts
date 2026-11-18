import { z } from 'zod';

// ==========================================
// Milestone 04: Temporal Cognition Contracts
// ==========================================

export const TemporalHorizonSchema = z.enum(['past', 'present', 'future']);
export type TemporalHorizon = z.infer<typeof TemporalHorizonSchema>;

export const TemporalEntityTypeSchema = z.enum([
  'memory',
  'activity',
  'event',
  'intention',
  'commitment',
  'milestone',
  'goal',
  'plan',
]);
export type TemporalEntityType = z.infer<typeof TemporalEntityTypeSchema>;

export const TemporalEntityInputSchema = z.object({
  id: z.string(),
  entityType: TemporalEntityTypeSchema,
  title: z.string().min(1),
  timestamp: z.string(),
  targetDate: z.string().optional(),
  completedDate: z.string().optional(),
  status: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type TemporalEntityInput = z.infer<typeof TemporalEntityInputSchema>;

export const TemporalClassificationResultSchema = z.object({
  entityId: z.string(),
  entityType: TemporalEntityTypeSchema,
  horizon: TemporalHorizonSchema,
  temporalAnchor: z.string(),
  reasoning: z.string(),
  relativeToNow: z.string(),
  isHistorical: z.boolean(),
  isCurrentActivity: z.boolean(),
  isFutureIntention: z.boolean(),
});
export type TemporalClassificationResult = z.infer<typeof TemporalClassificationResultSchema>;

export const TemporalRelationSchema = z.enum([
  'before',
  'after',
  'simultaneous',
  'overlaps',
  'causes',
  'leads_to',
]);
export type TemporalRelation = z.infer<typeof TemporalRelationSchema>;

export const ChronologicalEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  horizon: TemporalHorizonSchema,
  startTime: z.string(),
  endTime: z.string().optional(),
  durationMs: z.number().optional(),
  relations: z.array(z.object({
    targetEventId: z.string(),
    relation: TemporalRelationSchema,
  })).default([]),
});
export type ChronologicalEvent = z.infer<typeof ChronologicalEventSchema>;

export const FutureIntentionStatusSchema = z.enum([
  'pending',
  'in_progress',
  'fulfilled',
  'cancelled',
]);
export type FutureIntentionStatus = z.infer<typeof FutureIntentionStatusSchema>;

export const FutureIntentionOriginSchema = z.enum([
  'spontaneous',
  'shared_with_proof',
  'goal_derived',
  'autonomous_reflection',
]);
export type FutureIntentionOrigin = z.infer<typeof FutureIntentionOriginSchema>;

export const FutureIntentionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  intendedFor: z.string(),
  triggerCondition: z.string().optional(),
  priority: z.number().min(0.0).max(1.0).default(0.5),
  status: FutureIntentionStatusSchema.default('pending'),
  origin: FutureIntentionOriginSchema.default('spontaneous'),
  associatedGoalId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FutureIntention = z.infer<typeof FutureIntentionSchema>;

export const CreateFutureIntentionInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  intendedFor: z.string(),
  triggerCondition: z.string().optional(),
  priority: z.number().min(0.0).max(1.0).optional().default(0.5),
  origin: FutureIntentionOriginSchema.optional().default('spontaneous'),
  associatedGoalId: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
});
export type CreateFutureIntentionInput = z.input<typeof CreateFutureIntentionInputSchema>;

export const CommitmentDeadlineTypeSchema = z.enum([
  'hard_deadline',
  'soft_target',
  'flexible',
]);
export type CommitmentDeadlineType = z.infer<typeof CommitmentDeadlineTypeSchema>;

export const CommitmentStatusSchema = z.enum([
  'active',
  'fulfilled',
  'renegotiated',
  'broken',
]);
export type CommitmentStatus = z.infer<typeof CommitmentStatusSchema>;

export const UnfinishedCommitmentSchema = z.object({
  id: z.string().uuid(),
  partnerName: z.string().default('Proof'),
  commitmentText: z.string().min(1),
  context: z.string().default(''),
  committedAt: z.string(),
  targetFulfillmentTime: z.string().optional(),
  deadlineType: CommitmentDeadlineTypeSchema.default('soft_target'),
  status: CommitmentStatusSchema.default('active'),
  verificationCriteria: z.string().min(1),
  fulfillmentEvidence: z.string().optional(),
  fulfilledAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UnfinishedCommitment = z.infer<typeof UnfinishedCommitmentSchema>;

export const CreateCommitmentInputSchema = z.object({
  partnerName: z.string().optional().default('Proof'),
  commitmentText: z.string().min(1),
  context: z.string().optional().default(''),
  committedAt: z.string().optional(),
  targetFulfillmentTime: z.string().optional(),
  deadlineType: CommitmentDeadlineTypeSchema.optional().default('soft_target'),
  verificationCriteria: z.string().min(1),
});
export type CreateCommitmentInput = z.input<typeof CreateCommitmentInputSchema>;

export const PlanHorizonSchema = z.enum([
  'short_term',
  'medium_term',
  'long_term',
  'epochal',
]);
export type PlanHorizon = z.infer<typeof PlanHorizonSchema>;

export const PlanMilestoneItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  targetDate: z.string(),
  isCompleted: z.boolean().default(false),
  dependencies: z.array(z.string()).default([]),
  completedAt: z.string().optional(),
});
export type PlanMilestoneItem = z.infer<typeof PlanMilestoneItemSchema>;

export const LongTermPlanStatusSchema = z.enum([
  'drafting',
  'active',
  'accomplished',
  'revised',
  'abandoned',
]);
export type LongTermPlanStatus = z.infer<typeof LongTermPlanStatusSchema>;

export const LongTermPlanSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  visionStatement: z.string().min(1),
  horizon: PlanHorizonSchema.default('medium_term'),
  milestones: z.array(PlanMilestoneItemSchema).default([]),
  contingencyPlans: z.array(z.object({
    risk: z.string(),
    mitigation: z.string(),
  })).default([]),
  status: LongTermPlanStatusSchema.default('active'),
  targetCompletionDate: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LongTermPlan = z.infer<typeof LongTermPlanSchema>;

export const CreateLongTermPlanInputSchema = z.object({
  title: z.string().min(1),
  visionStatement: z.string().min(1),
  horizon: PlanHorizonSchema.optional().default('medium_term'),
  milestones: z.array(PlanMilestoneItemSchema).optional().default([]),
  contingencyPlans: z.array(z.object({
    risk: z.string(),
    mitigation: z.string(),
  })).optional().default([]),
  targetCompletionDate: z.string(),
});
export type CreateLongTermPlanInput = z.input<typeof CreateLongTermPlanInputSchema>;

export const DurationProfileSchema = z.object({
  operationKey: z.string(),
  sampleCount: z.number().int().min(0).default(0),
  averageDurationMs: z.number().min(0).default(0),
  minDurationMs: z.number().min(0).default(0),
  maxDurationMs: z.number().min(0).default(0),
  standardDeviationMs: z.number().min(0).default(0),
  confidenceScore: z.number().min(0.0).max(1.0).default(0.5),
  lastCalibratedAt: z.string(),
});
export type DurationProfile = z.infer<typeof DurationProfileSchema>;

export const ImpendingDeadlineAlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['commitment', 'goal', 'plan_milestone']),
  deadline: z.string(),
  remainingHours: z.number(),
  urgency: z.number().min(0.0).max(1.0),
  isOverdue: z.boolean(),
});
export type ImpendingDeadlineAlert = z.infer<typeof ImpendingDeadlineAlertSchema>;

export const TemporalCognitionOverviewSchema = z.object({
  currentTime: z.string(),
  activeTemporalHorizon: TemporalHorizonSchema,
  activeCommitmentsCount: z.number().int(),
  pendingIntentionsCount: z.number().int(),
  impendingDeadlines: z.array(ImpendingDeadlineAlertSchema),
  activePlansCount: z.number().int(),
  currentActivitiesCount: z.number().int(),
  temporalContinuityStatement: z.string(),
});
export type TemporalCognitionOverview = z.infer<typeof TemporalCognitionOverviewSchema>;
