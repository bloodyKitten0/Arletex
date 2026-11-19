import { z } from 'zod';

export const CognitiveSubsystemTypeSchema = z.enum([
  'perception',
  'appraisal',
  'affect',
  'attention',
  'working_memory',
  'memory',
  'motivation',
  'relationship',
  'self_model',
  'learning',
  'reasoning',
  'causal',
  'predictive',
  'simulation',
  'metacognition',
  'agency',
]);
export type CognitiveSubsystemType = z.infer<typeof CognitiveSubsystemTypeSchema>;

export const GlobalCognitiveEventPhaseSchema = z.enum([
  'perceptual_input',
  'affective_appraisal',
  'attentional_modulation',
  'memory_activation',
  'motivational_drive',
  'prospective_cognition',
  'metacognitive_reflection',
  'executive_dispatch',
]);
export type GlobalCognitiveEventPhase = z.infer<typeof GlobalCognitiveEventPhaseSchema>;

export const SubsystemStateDeltaSchema = z.object({
  subsystem: CognitiveSubsystemTypeSchema,
  entityId: z.string().optional(),
  changeType: z.enum(['created', 'updated', 'triggered', 'attenuated']),
  summary: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});
export type SubsystemStateDelta = z.infer<typeof SubsystemStateDeltaSchema>;

export const PhaseExecutionSchema = z.object({
  phase: GlobalCognitiveEventPhaseSchema,
  subsystem: CognitiveSubsystemTypeSchema,
  order: z.number().int().nonnegative(),
  timestamp: z.string(),
  deltas: z.array(SubsystemStateDeltaSchema).default([]),
});
export type PhaseExecution = z.infer<typeof PhaseExecutionSchema>;

export const GlobalCognitiveCycleEventSchema = z.object({
  id: z.string().min(1),
  traceId: z.string().min(1),
  originSubsystem: CognitiveSubsystemTypeSchema,
  eventType: z.string().min(1),
  description: z.string().min(1),
  contextSnapshot: z.object({
    activeEmotion: z.string().optional(),
    attentionFocusId: z.string().optional(),
    activeGoalCount: z.number().int().nonnegative().default(0),
    relationshipTrust: z.number().min(0.0).max(1.0).default(0.9),
    epistemicUncertainty: z.number().min(0.0).max(1.0).default(0.2),
  }),
  phaseExecutions: z.array(PhaseExecutionSchema).min(1),
  subsystemsInvolved: z.array(CognitiveSubsystemTypeSchema).min(1),
  isCoherent: z.boolean(),
  startedAt: z.string(),
  completedAt: z.string(),
  totalLatencyMs: z.number().nonnegative(),
});
export type GlobalCognitiveCycleEvent = z.infer<typeof GlobalCognitiveCycleEventSchema>;

export const GlobalCognitiveSnapshotSchema = z.object({
  snapshotId: z.string().min(1),
  timestamp: z.string(),
  affectiveState: z.object({
    pad: z.object({
      pleasure: z.number().min(-1.0).max(1.0),
      arousal: z.number().min(-1.0).max(1.0),
      dominance: z.number().min(-1.0).max(1.0),
    }),
    dominantEmotion: z.string().min(1),
  }),
  attentionState: z.object({
    focusTopic: z.string(),
    salienceScore: z.number().min(0.0).max(1.0),
  }),
  activeGoals: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      priority: z.number().min(0.0).max(1.0),
    }),
  ).default([]),
  activeRelationship: z.object({
    partnerName: z.string(),
    trustScore: z.number().min(0.0).max(1.0),
    intimacyScore: z.number().min(0.0).max(1.0),
  }),
  workingMemoryActiveCount: z.number().int().nonnegative(),
  metacognitiveStatus: z.object({
    calibratedConfidence: z.number().min(0.0).max(1.0),
    activeContradictionCount: z.number().int().nonnegative(),
  }),
});
export type GlobalCognitiveSnapshot = z.infer<typeof GlobalCognitiveSnapshotSchema>;

/**
 * Validates negative invariants for global cognitive integration:
 * 1. Multi-System Invariant:
 *    A global integration cycle MUST involve at least 3 distinct cognitive subsystems.
 *    Isolated subsystem execution cannot be claimed as global integration.
 * 2. Causal Ordering & Monotonicity Invariant:
 *    Phases must execute with non-decreasing order numbers and timestamps.
 * 3. Timing Invariant:
 *    completedAt cannot be earlier than startedAt.
 */
export function assertGlobalCycleIntegrity(cycle: GlobalCognitiveCycleEvent): void {
  const uniqueSubsystems = new Set(cycle.subsystemsInvolved);
  if (uniqueSubsystems.size < 3) {
    throw new Error(
      `Negative Invariant Violation (Solitary Execution): Global cognitive cycle ${cycle.id} only touches ${uniqueSubsystems.size} subsystem(s). Global integration requires causal propagation across at least 3 distinct cognitive subsystems.`,
    );
  }

  const startTime = new Date(cycle.startedAt).getTime();
  const endTime = new Date(cycle.completedAt).getTime();
  if (startTime > endTime) {
    throw new Error(
      `Negative Invariant Violation: Cycle ${cycle.id} startedAt (${cycle.startedAt}) is strictly after completedAt (${cycle.completedAt}).`,
    );
  }

  let prevOrder = -1;
  let prevTime = startTime;
  for (const p of cycle.phaseExecutions) {
    if (p.order < prevOrder) {
      throw new Error(
        `Negative Invariant Violation (Causal Ordering Inversion): Phase order ${p.order} is less than preceding phase order ${prevOrder}.`,
      );
    }
    const phaseTime = new Date(p.timestamp).getTime();
    if (phaseTime < prevTime) {
      throw new Error(
        `Negative Invariant Violation (Retrocausal Phase Timestamp): Phase timestamp ${p.timestamp} precedes prior stage ${prevTime}.`,
      );
    }
    prevOrder = p.order;
    prevTime = phaseTime;
  }
}
