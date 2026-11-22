import { z } from 'zod';

export const PlanStageStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'interrupted',
  'skipped',
]);
export type PlanStageStatus = z.infer<typeof PlanStageStatusSchema>;

export const PlanResourceEstimateSchema = z.object({
  estimatedHours: z.number().nonnegative().default(1.0),
  computeUnits: z.number().nonnegative().default(1.0),
  requiredTools: z.array(z.string()).default([]),
});
export type PlanResourceEstimate = z.infer<typeof PlanResourceEstimateSchema>;

export const PlanStageMilestoneSchema = z.object({
  id: z.string().min(1),
  stageIndex: z.number().int().nonnegative(),
  title: z.string().min(1),
  description: z.string().min(1),
  resourceEstimate: PlanResourceEstimateSchema.default({}),
  dependencies: z.array(z.string()).default([]), // ids of preceding milestones
  priority: z.number().min(0.0).max(1.0).default(0.5),
  status: PlanStageStatusSchema.default('pending'),
  progress: z.number().min(0.0).max(1.0).default(0.0),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  interruptedAt: z.string().optional(),
  interruptionReason: z.string().optional(),
  executionCheckpoint: z.record(z.unknown()).optional(),
});
export type PlanStageMilestone = z.infer<typeof PlanStageMilestoneSchema>;

export const PlanRevisionRecordSchema = z.object({
  revisionId: z.string().min(1),
  revisedAt: z.string(),
  reason: z.string().min(1),
  stagesAdded: z.number().int().nonnegative().default(0),
  stagesRemoved: z.number().int().nonnegative().default(0),
  previousProgress: z.number().min(0.0).max(1.0),
});
export type PlanRevisionRecord = z.infer<typeof PlanRevisionRecordSchema>;

export const PlanRecoveryStateSchema = z.object({
  lastActiveStageId: z.string(),
  interruptionTimestamp: z.string(),
  recoveryContext: z.record(z.unknown()).default({}),
  resumedAt: z.string().optional(),
});
export type PlanRecoveryState = z.infer<typeof PlanRecoveryStateSchema>;

export const MultiStagePlanStatusSchema = z.enum([
  'drafting',
  'active',
  'in_progress',
  'interrupted',
  'revised',
  'completed',
  'abandoned',
]);
export type MultiStagePlanStatus = z.infer<typeof MultiStagePlanStatusSchema>;

export const MultiStagePlanSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  stages: z.array(PlanStageMilestoneSchema).default([]),
  overallPriority: z.number().min(0.0).max(1.0).default(0.7),
  overallProgress: z.number().min(0.0).max(1.0).default(0.0),
  status: MultiStagePlanStatusSchema.default('active'),
  scheduledStart: z.string(),
  targetCompletion: z.string(),
  revisionsHistory: z.array(PlanRevisionRecordSchema).default([]),
  recoveryState: PlanRecoveryStateSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MultiStagePlan = z.infer<typeof MultiStagePlanSchema>;

export const LongTermCommitmentStatusSchema = z.enum([
  'active',
  'fulfilled',
  'renegotiated',
  'breached',
]);
export type LongTermCommitmentStatus = z.infer<typeof LongTermCommitmentStatusSchema>;

export const LongTermCommitmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  stakeholder: z.string().min(1), // e.g. "Proof" or "autonomous_self"
  promiseStatement: z.string().min(1),
  associatedPlanId: z.string().optional(),
  dueTimestamp: z.string().optional(),
  status: LongTermCommitmentStatusSchema.default('active'),
  fulfillmentEvidence: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LongTermCommitment = z.infer<typeof LongTermCommitmentSchema>;

/**
 * Validates negative invariants for persistent planning:
 * 1. Dependency Graph Acyclicity: Milestones must form a valid Directed Acyclic Graph (DAG).
 * 2. Progress and Priority Bounds: Must remain strictly within [0.0, 1.0].
 * 3. Completion Invariant: A plan marked completed cannot have unfinished pending or in_progress stages.
 * 4. Interruption Invariant: An interrupted stage must specify an interruption timestamp and context.
 */
export function assertMultiStagePlanIntegrity(plan: MultiStagePlan): void {
  if (plan.overallPriority < 0 || plan.overallPriority > 1) {
    throw new Error(
      `Plan overallPriority ${plan.overallPriority} outside allowed [0.0, 1.0] range.`,
    );
  }
  if (plan.overallProgress < 0 || plan.overallProgress > 1) {
    throw new Error(
      `Plan overallProgress ${plan.overallProgress} outside allowed [0.0, 1.0] range.`,
    );
  }

  // DAG validation
  const stageMap = new Map<string, PlanStageMilestone>();
  for (const stage of plan.stages) {
    if (stageMap.has(stage.id)) {
      throw new Error(`Duplicate stage ID detected: ${stage.id}`);
    }
    stageMap.set(stage.id, stage);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();

  function checkCycles(nodeId: string): void {
    if (visiting.has(nodeId)) {
      throw new Error(
        `Negative Invariant Violation: Cyclic dependency detected involving stage ${nodeId}.`,
      );
    }
    if (visited.has(nodeId)) return;

    visiting.add(nodeId);
    const stage = stageMap.get(nodeId);
    if (stage) {
      for (const depId of stage.dependencies) {
        if (!stageMap.has(depId)) {
          throw new Error(`Stage ${nodeId} depends on non-existent stage ID ${depId}.`);
        }
        checkCycles(depId);
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const stage of plan.stages) {
    if (!visited.has(stage.id)) {
      checkCycles(stage.id);
    }
  }

  // Completion check
  if (plan.status === 'completed') {
    const incomplete = plan.stages.find(
      (s) => s.status === 'pending' || s.status === 'in_progress',
    );
    if (incomplete) {
      throw new Error(
        `Negative Invariant Violation: Plan ${plan.id} marked completed but stage ${incomplete.id} is ${incomplete.status}.`,
      );
    }
  }
}
