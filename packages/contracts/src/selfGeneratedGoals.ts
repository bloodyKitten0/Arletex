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
  'abandoned',
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

export const SelfGeneratedGoalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  origin: GoalOriginTypeSchema,
  sourceRefId: z.string().optional(),
  priority: z.number().min(0.0).max(1.0),
  status: SelfGeneratedGoalStatusSchema.default('active'),
  successCriteria: z.array(z.string()).default([]),
  estimatedEffortHours: z.number().nonnegative().default(1.0),
  modificationsHistory: z.array(GoalModificationRecordSchema).default([]),
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
 * 4. Priority Bounds Invariant:
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

  if (goal.status === 'completed' && !goal.completedAt) {
    throw new Error(
      `Negative Invariant Violation: Completed goal ${goal.id} must specify a completedAt timestamp.`,
    );
  }
}
