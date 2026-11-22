import { z } from 'zod';

export const InhibitionReasonSchema = z.enum([
  'impulse_management',
  'policy_violation',
  'destructive_potential',
  'delayed_gratification',
  'resource_exhaustion',
  'unauthorized',
]);
export type InhibitionReason = z.infer<typeof InhibitionReasonSchema>;

export const ActionInhibitionEvaluationSchema = z.object({
  id: z.string().min(1),
  actionName: z.string().min(1),
  proposedPayload: z.record(z.unknown()).default({}),
  riskScore: z.number().min(0.0).max(1.0),
  isInhibited: z.boolean(),
  inhibitionReason: InhibitionReasonSchema.optional(),
  alternativeAction: z.string().optional(),
  evaluatedAt: z.string(),
});
export type ActionInhibitionEvaluation = z.infer<typeof ActionInhibitionEvaluationSchema>;

export const TaskSwitchReasonSchema = z.enum([
  'higher_priority_preemption',
  'previous_task_blocked',
  'previous_task_completed',
  'flexible_reallocation',
]);
export type TaskSwitchReason = z.infer<typeof TaskSwitchReasonSchema>;

export const TaskSwitchRecordSchema = z.object({
  id: z.string().min(1),
  previousTaskId: z.string().min(1),
  nextTaskId: z.string().min(1),
  previousTaskPriority: z.number().min(0.0).max(1.0),
  nextTaskPriority: z.number().min(0.0).max(1.0),
  switchReason: TaskSwitchReasonSchema,
  contextSaved: z.boolean(),
  justification: z.string().min(1),
  switchedAt: z.string(),
});
export type TaskSwitchRecord = z.infer<typeof TaskSwitchRecordSchema>;

export const WorkingMemoryGatingOperationSchema = z.enum([
  'gate_in',
  'gate_out',
  'protect',
  'flush_stale',
]);
export type WorkingMemoryGatingOperation = z.infer<typeof WorkingMemoryGatingOperationSchema>;

export const WorkingMemoryGatingDirectiveSchema = z.object({
  id: z.string().min(1),
  targetBufferId: z.string().min(1),
  operation: WorkingMemoryGatingOperationSchema,
  itemPriority: z.number().min(0.0).max(1.0),
  reason: z.string().min(1),
  appliedAt: z.string(),
});
export type WorkingMemoryGatingDirective = z.infer<typeof WorkingMemoryGatingDirectiveSchema>;

export const ExecutiveControlStateSchema = z.object({
  id: z.string().min(1),
  activeGoalId: z.string().min(1),
  sustainedAttentionDurationMs: z.number().nonnegative(),
  distractionResistanceScore: z.number().min(0.0).max(1.0),
  cognitiveFlexibilityScore: z.number().min(0.0).max(1.0),
  inhibitedActionCount: z.number().int().nonnegative(),
  taskSwitchCount: z.number().int().nonnegative(),
  lastUpdatedAt: z.string(),
});
export type ExecutiveControlState = z.infer<typeof ExecutiveControlStateSchema>;

/**
 * Validates negative invariants for executive control:
 * 1. Inhibitory Suppression Invariant:
 *    Any action with riskScore >= 0.7 MUST be inhibited (isInhibited === true).
 *    If an action is inhibited, an inhibitionReason must be explicitly provided.
 * 2. Priority Preemption Invariant:
 *    A task switch with reason 'higher_priority_preemption' CANNOT have nextTaskPriority < previousTaskPriority.
 * 3. Context Preservation Invariant:
 *    Task switching from an uncompleted task requires contextSaved === true to prevent cognitive amnesia.
 */
export function assertActionInhibitionIntegrity(evaluation: ActionInhibitionEvaluation): void {
  if (evaluation.riskScore >= 0.7 && !evaluation.isInhibited) {
    throw new Error(
      `Negative Invariant Violation (Inhibition Failure): Action '${evaluation.actionName}' has high risk score (${evaluation.riskScore}) but was NOT inhibited. Executive functions must strictly suppress high-risk or destructive actions.`,
    );
  }

  if (evaluation.isInhibited && !evaluation.inhibitionReason) {
    throw new Error(
      `Negative Invariant Violation: Inhibited action '${evaluation.actionName}' lacks a specified inhibitionReason.`,
    );
  }
}

export function assertTaskSwitchIntegrity(record: TaskSwitchRecord): void {
  if (
    record.switchReason === 'higher_priority_preemption' &&
    record.nextTaskPriority < record.previousTaskPriority
  ) {
    throw new Error(
      `Negative Invariant Violation (Invalid Preemption): Task switch claims 'higher_priority_preemption' but nextTaskPriority (${record.nextTaskPriority}) is strictly less than previousTaskPriority (${record.previousTaskPriority}).`,
    );
  }

  if (record.switchReason !== 'previous_task_completed' && !record.contextSaved) {
    throw new Error(
      `Negative Invariant Violation (State Loss): Switching active task '${record.previousTaskId}' before completion without contextSaved === true is forbidden.`,
    );
  }
}
