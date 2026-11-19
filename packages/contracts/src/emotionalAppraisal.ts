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
  interpretations: z.array(
    z.object({
      interpretationKey: z.string(),
      appraisal: ApeAppraisalSchema,
      dominantEmotionId: z.string(),
      dominantIntensity: z.number().min(0.0).max(1.0),
    }),
  ).min(2),
  emotionalDivergenceScore: z.number().min(0.0).max(1.0),
  divergenceExplanation: z.string().min(1),
  evaluatedAt: z.string(),
});
export type AppraisalInterpretationComparison = z.infer<typeof AppraisalInterpretationComparisonSchema>;

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
