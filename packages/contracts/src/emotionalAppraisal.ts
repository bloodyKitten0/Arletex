import { z } from 'zod';
import { ApeAppraisalSchema } from './ape.js';

export const ContextualAppraisalFrameSchema = z.object({
  interpretationKey: z.string().min(1),
  interpretationSummary: z.string().min(1),
  responsibility: z.enum(['user', 'arle', 'environment', 'unknown']),
  perceivedFairness: z.number().min(0.0).max(1.0),
  eventSignificance: z.number().min(0.0).max(1.0),
  goalRelevance: z.number().min(0.0).max(1.0),
  goalCongruence: z.number().min(-1.0).max(1.0),
  controllability: z.number().min(0.0).max(1.0),
  uncertainty: z.number().min(0.0).max(1.0),
  interpersonalSignificance: z.number().min(0.0).max(1.0),
  expectationViolation: z.number().min(0.0).max(1.0), // expectation violation / prediction error
  causeTracking: z.object({
    primaryCause: z.string().min(1),
    causalChain: z.array(z.string()).default([]),
    attributionConfidence: z.number().min(0.0).max(1.0).default(0.8),
  }),
});
export type ContextualAppraisalFrame = z.infer<typeof ContextualAppraisalFrameSchema>;

export const AppraisalInterpretationComparisonSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  eventContent: z.string().min(1),
  interpretations: z
    .array(
      z.object({
        interpretationKey: z.string(),
        appraisal: ApeAppraisalSchema,
        dominantEmotionId: z.string(),
        dominantIntensity: z.number().min(0.0).max(1.0),
      }),
    )
    .min(2),
  emotionalDivergenceScore: z.number().min(0.0).max(1.0),
  divergenceExplanation: z.string().min(1),
  evaluatedAt: z.string(),
});
export type AppraisalInterpretationComparison = z.infer<
  typeof AppraisalInterpretationComparisonSchema
>;

/**
 * Validates negative invariants for emotional appraisal:
 * 1. Divergence Invariant: Different interpretations of the same event must produce
 *    measurable emotional divergence (divergence score > 0).
 * 2. Causal Invariant: Every appraisal frame must have a documented primary cause.
 */
export function assertAppraisalDivergence(comparison: AppraisalInterpretationComparison): void {
  if (comparison.emotionalDivergenceScore <= 0) {
    throw new Error(
      `Negative Invariant Violation: Comparison ${comparison.id} failed to produce distinct emotional divergence across interpretations.`,
    );
  }

  const keys = new Set(comparison.interpretations.map((i) => i.interpretationKey));
  if (keys.size !== comparison.interpretations.length) {
    throw new Error(
      `Negative Invariant Violation: Duplicate interpretationKey detected in comparison ${comparison.id}.`,
    );
  }
}

// =========================================================================
// Point 1 & 2: Somatic Shock State, Trigger Networks & Conditioned Flashbacks
// =========================================================================

export const TRAUMA_CATEGORIES = [
  'betrayal',
  'abandonment',
  'sudden_terror',
  'emotional_devastation',
  'severe_rupture',
] as const;
export const TraumaCategorySchema = z.enum(TRAUMA_CATEGORIES);
export type TraumaCategory = z.infer<typeof TraumaCategorySchema>;

export const SomaticShockStateSchema = z.object({
  valence: z.number().min(-1.0).max(1.0),
  arousal: z.number().min(0.0).max(1.0),
  dominance: z.number().min(-1.0).max(1.0),
  relationalPanic: z.number().min(0.0).max(1.0),
  physiologicalShock: z.string().min(1),
  traumaCategory: TraumaCategorySchema.default('betrayal'),
});
export type SomaticShockState = z.infer<typeof SomaticShockStateSchema>;

export const TRIGGER_CUE_TYPES = [
  'phrase',
  'silence',
  'disconnect',
  'coldness',
  'situational',
] as const;
export const TriggerCueTypeSchema = z.enum(TRIGGER_CUE_TYPES);
export type TriggerCueType = z.infer<typeof TriggerCueTypeSchema>;

export const EmotionalTriggerNodeSchema = z.object({
  id: z.string(),
  traumaMemoryId: z.string(),
  cueType: TriggerCueTypeSchema,
  cuePattern: z.string().min(1),
  sensitivity: z.number().min(0.0).max(1.0).default(0.8),
  somaticShock: SomaticShockStateSchema,
  flashbackPadDelta: z.object({
    pleasure: z.number().min(-2.0).max(2.0),
    arousal: z.number().min(-2.0).max(2.0),
    dominance: z.number().min(-2.0).max(2.0),
  }),
  defensivePostures: z
    .array(z.string())
    .default(['hyper_vigilance', 'defensive_pullback', 'interrogation']),
  createdAt: z.string(),
});
export type EmotionalTriggerNode = z.infer<typeof EmotionalTriggerNodeSchema>;

export const ConditionedFlashbackSchema = z.object({
  id: z.string(),
  triggerNodeId: z.string(),
  traumaMemoryId: z.string(),
  matchedCue: z.string(),
  visceralSpike: z.object({
    arousal: z.number(),
    valence: z.number(),
    dominance: z.number(),
    relationalPanic: z.number(),
  }),
  defensiveReactionQuery: z.string(),
  pulledAway: z.boolean(),
  triggeredAt: z.string(),
});
export type ConditionedFlashback = z.infer<typeof ConditionedFlashbackSchema>;

