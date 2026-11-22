import { z } from 'zod';

export const GoalOriginTypeSchema = z.enum([
  'interest',
  'curiosity',
  'unresolved_question',
  'self_improvement',
  'project',
  'opportunity',
  'ambition',
]);
export type GoalOriginType = z.infer<typeof GoalOriginTypeSchema>;

export const SelfGeneratedGoalStatusSchema = z.enum([
  'active',
  'in_progress',
  'modified',
  'paused',
  'abandoned',
  'rejected',
  'completed',
]);
export type SelfGeneratedGoalStatus = z.infer<typeof SelfGeneratedGoalStatusSchema>;

export const GoalModificationRecordSchema = z.object({
  timestamp: z.string(),
  previousPriority: z.number().min(0.0).max(1.0),
  newPriority: z.number().min(0.0).max(1.0),
  reason: z.string().min(1),
});
export type GoalModificationRecord = z.infer<typeof GoalModificationRecordSchema>;

export const GoalOriginPartySchema = z.enum(['arle', 'user', 'joint']);
export type GoalOriginParty = z.infer<typeof GoalOriginPartySchema>;

export const GoalOriginAuditSchema = z.object({
  sourceType: z.enum([
    'internal_spark',
    'need_deficit',
    'curiosity_gap',
    'user_instruction',
    'dialogue_deliberation',
    'project_milestone',
    'opportunity_recognition',
  ]),
  triggeringEventId: z.string().optional(),
  userInvolvementRationale: z.string().optional(),
});
export type GoalOriginAudit = z.infer<typeof GoalOriginAuditSchema>;

export const SelfGeneratedGoalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  origin: GoalOriginTypeSchema,
  originParty: GoalOriginPartySchema.default('arle'),
  originAudit: GoalOriginAuditSchema.optional(),
  sourceRefId: z.string().optional(),
  parentGoalId: z.string().optional(),
  subGoalIds: z.array(z.string()).default([]),
  priority: z.number().min(0.0).max(1.0),
  status: SelfGeneratedGoalStatusSchema.default('active'),
  urgency: z.number().min(0.0).max(1.0).default(0.5),
  uncertainty: z.number().min(0.0).max(1.0).default(0.5),
  expectedValue: z.number().min(0.0).max(1.0).default(0.7),
  resourceCost: z.number().min(0.0).max(1.0).default(0.3),
  successCriteria: z.array(z.string()).default([]),
  estimatedEffortHours: z.number().nonnegative().default(1.0),
  modificationsHistory: z.array(GoalModificationRecordSchema).default([]),
  pauseReason: z.string().optional(),
  pausedAt: z.string().optional(),
  rejectionReason: z.string().optional(),
  rejectedAt: z.string().optional(),
  abandonmentReason: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  abandonedAt: z.string().optional(),
  completedAt: z.string().optional(),
});
export type SelfGeneratedGoal = z.infer<typeof SelfGeneratedGoalSchema>;

/**
 * Validates negative invariants for self-generated goals:
 * 1. Autonomous Origin Invariant:
 *    Goal origin must belong to the approved taxonomy of autonomous origins.
 * 2. Abandonment Invariant:
 *    If status === 'abandoned', both abandonmentReason and abandonedAt must be populated.
 * 3. Completion Invariant:
 *    If status === 'completed', completedAt must be populated.
 * 4. Pause Invariant:
 *    If status === 'paused', both pauseReason and pausedAt must be populated.
 * 5. Rejection Invariant:
 *    If status === 'rejected', both rejectionReason and rejectedAt must be populated.
 * 6. Priority Bounds Invariant:
 *    Priority must reside within [0.0, 1.0].
 */
export function assertSelfGeneratedGoalIntegrity(goal: SelfGeneratedGoal): void {
  if (goal.priority < 0 || goal.priority > 1) {
    throw new Error(`Invalid goal priority ${goal.priority}: must be within range [0.0, 1.0].`);
  }

  if (goal.status === 'abandoned') {
    if (!goal.abandonmentReason || goal.abandonmentReason.trim().length === 0) {
      throw new Error(
        `Negative Invariant Violation: Abandoned goal ${goal.id} must specify an explicit abandonmentReason.`,
      );
    }
    if (!goal.abandonedAt) {
      throw new Error(
        `Negative Invariant Violation: Abandoned goal ${goal.id} must specify an abandonedAt timestamp.`,
      );
    }
  }

  if (goal.status === 'paused') {
    if (!goal.pauseReason || goal.pauseReason.trim().length === 0) {
      throw new Error(
        `Negative Invariant Violation: Paused goal ${goal.id} must specify an explicit pauseReason.`,
      );
    }
    if (!goal.pausedAt) {
      throw new Error(
        `Negative Invariant Violation: Paused goal ${goal.id} must specify a pausedAt timestamp.`,
      );
    }
  }

  if (goal.status === 'rejected') {
    if (!goal.rejectionReason || goal.rejectionReason.trim().length === 0) {
      throw new Error(
        `Negative Invariant Violation: Rejected goal ${goal.id} must specify an explicit rejectionReason.`,
      );
    }
    if (!goal.rejectedAt) {
      throw new Error(
        `Negative Invariant Violation: Rejected goal ${goal.id} must specify a rejectedAt timestamp.`,
      );
    }
  }

  if (goal.status === 'completed' && !goal.completedAt) {
    throw new Error(
      `Negative Invariant Violation: Completed goal ${goal.id} must specify a completedAt timestamp.`,
    );
  }
}
