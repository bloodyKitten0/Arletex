import { z } from 'zod';

// ==========================================
// Milestone 10: Attention and Salience Contracts
// Objective: Establish selective attention.
// Acceptance criteria: Arle must select relevant information according to her current state,
// goals, interests, and environment rather than indiscriminately processing everything.
// ==========================================

export const StimulusTypeSchema = z.enum([
  'perceptual',
  'message',
  'goal_update',
  'environmental_change',
  'internal_thought',
  'system_event',
]);
export type StimulusType = z.infer<typeof StimulusTypeSchema>;

export const AttentionalStimulusSchema = z.object({
  id: z.string().uuid(),
  type: StimulusTypeSchema,
  source: z.string(),
  summary: z.string(),
  content: z.any().optional(),
  tags: z.array(z.string()).default([]),
  noveltyScore: z.number().min(0).max(1).default(0.5),
  urgencyScore: z.number().min(0).max(1).default(0.5),
  timestamp: z.string(),
});
export type AttentionalStimulus = z.infer<typeof AttentionalStimulusSchema>;

export const SalienceBreakdownSchema = z.object({
  novelty: z.number().min(0).max(1),
  goalRelevance: z.number().min(0).max(1),
  interestRelevance: z.number().min(0).max(1),
  emotionalValence: z.number().min(0).max(1),
  urgency: z.number().min(0).max(1),
  compositeSalience: z.number().min(0).max(1),
});
export type SalienceBreakdown = z.infer<typeof SalienceBreakdownSchema>;

export const AttentionalTargetSchema = z.object({
  stimulusId: z.string().uuid(),
  title: z.string(),
  type: StimulusTypeSchema,
  allocatedFocusPercent: z.number().min(0).max(100),
  salience: SalienceBreakdownSchema,
  startedFocusAt: z.string(),
  dwellDurationMs: z.number().min(0).default(0),
  isFocal: z.boolean().default(true),
});
export type AttentionalTarget = z.infer<typeof AttentionalTargetSchema>;

export const AttentionalFocusStateSchema = z.object({
  id: z.string().uuid(),
  focalTarget: AttentionalTargetSchema.nullable(),
  peripheralTargets: z.array(AttentionalTargetSchema),
  totalStimuliEvaluated: z.number().min(0),
  filteredStimuliCount: z.number().min(0),
  isOverloaded: z.boolean(),
  attentionCapacity: z.number().min(0).max(100).default(100),
  availableCapacity: z.number().min(0).max(100).default(100),
  activeGoals: z.array(z.string()),
  activeInterests: z.array(z.string()),
  timestamp: z.string(),
});
export type AttentionalFocusState = z.infer<typeof AttentionalFocusStateSchema>;

export const AttentionSwitchEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  previousTargetId: z.string().nullable(),
  newTargetId: z.string(),
  switchReason: z.string(),
  switchingCostMs: z.number().min(0).default(50),
  forcedByUrgency: z.boolean().default(false),
});
export type AttentionSwitchEvent = z.infer<typeof AttentionSwitchEventSchema>;

export const AttentionEvaluationResultSchema = z.object({
  selectedFocalTarget: AttentionalTargetSchema.nullable(),
  selectedPeripheralTargets: z.array(AttentionalTargetSchema),
  discardedStimuliIds: z.array(z.string()),
  isOverloaded: z.boolean(),
  shedCount: z.number().min(0),
  summary: z.string(),
});
export type AttentionEvaluationResult = z.infer<typeof AttentionEvaluationResultSchema>;

/**
 * Invariant Validator: Ensures that selective attention does not indiscriminately process
 * all stimuli equally when low-salience noise or high load is present.
 */
export function assertSelectiveAttentionIntegrity(
  result: AttentionEvaluationResult,
  evaluatedCount: number,
  noiseThreshold: number = 0.35,
): void {
  // 1. A focal target must not have composite salience below noise threshold
  if (result.selectedFocalTarget && result.selectedFocalTarget.salience.compositeSalience < noiseThreshold) {
    throw new Error(
      'Negative Invariant Violated: Selective attention accepted low-salience noise into active focus instead of filtering.',
    );
  }

  // 2. Peripheral targets must not have composite salience below noise threshold
  if (result.selectedPeripheralTargets.some((t) => t.salience.compositeSalience < noiseThreshold)) {
    throw new Error(
      'Negative Invariant Violated: Selective attention accepted low-salience noise into active focus instead of filtering.',
    );
  }

  // 3. If overloaded, shedCount must be positive
  if (result.isOverloaded && result.shedCount === 0 && evaluatedCount > 5) {
    throw new Error(
      'Negative Invariant Violated: Attentional overload recognized but no low-priority stimuli were shed.',
    );
  }
}
