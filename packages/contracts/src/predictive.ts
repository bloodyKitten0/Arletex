import { z } from 'zod';

export const PredictionTypeSchema = z.enum([
  'event',
  'consequence',
  'behavior',
  'obstacle',
]);
export type PredictionType = z.infer<typeof PredictionTypeSchema>;

export const PredictionStatusSchema = z.enum([
  'pending',
  'resolved_accurate',
  'resolved_inaccurate',
  'expired',
]);
export type PredictionStatus = z.infer<typeof PredictionStatusSchema>;

export const CognitivePredictionSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  predictionType: PredictionTypeSchema,
  targetStatement: z.string().min(1),
  predictedProbability: z.number().min(0.0).max(1.0),
  confidence: z.number().min(0.0).max(1.0),
  rationale: z.string().min(1),
  horizonDeadline: z.string(),
  createdAt: z.string(),
  status: PredictionStatusSchema.default('pending'),
  actualOutcome: z.boolean().optional(),
  actualOutcomeNotes: z.string().optional(),
  resolvedAt: z.string().optional(),
  predictionError: z.number().min(0.0).max(1.0).optional(),
  brierScore: z.number().min(0.0).max(1.0).optional(),
});
export type CognitivePrediction = z.infer<typeof CognitivePredictionSchema>;

export const PredictionAccuracyMetricsSchema = z.object({
  domain: z.string().optional(),
  totalPredictions: z.number().int().nonnegative(),
  resolvedPredictions: z.number().int().nonnegative(),
  accurateCount: z.number().int().nonnegative(),
  accuracyRate: z.number().min(0.0).max(1.0),
  meanAbsoluteError: z.number().min(0.0).max(1.0),
  brierScore: z.number().min(0.0).max(1.0),
});
export type PredictionAccuracyMetrics = z.infer<typeof PredictionAccuracyMetricsSchema>;

export const PredictiveSummarySchema = z.object({
  totalPredictions: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  resolvedCount: z.number().int().nonnegative(),
  overallAccuracyRate: z.number().min(0.0).max(1.0),
  meanBrierScore: z.number().min(0.0).max(1.0),
  typeBreakdown: z.record(z.number().int().nonnegative()),
  dominantDomains: z.array(z.string()),
});
export type PredictiveSummary = z.infer<typeof PredictiveSummarySchema>;

/**
 * Validates negative invariants for predictive cognition:
 * 1. Anti-Hindsight Bias / Anti-Retrocausal Invariant:
 *    A prediction MUST be generated before the outcome is resolved.
 *    `createdAt` cannot be strictly after `resolvedAt`.
 * 2. Probabilities and confidences must reside within [0.0, 1.0].
 * 3. Prediction error and Brier score must be correctly bounded.
 */
export function assertPredictionIntegrity(prediction: CognitivePrediction): void {
  if (prediction.resolvedAt) {
    const createdTime = new Date(prediction.createdAt).getTime();
    const resolvedTime = new Date(prediction.resolvedAt).getTime();
    if (createdTime > resolvedTime) {
      throw new Error(
        `Negative Invariant Violation: Prediction ${prediction.id} has createdAt (${prediction.createdAt}) after resolvedAt (${prediction.resolvedAt}). Retroactive post-hoc predictions are strictly forbidden.`,
      );
    }
  }

  if (prediction.predictedProbability < 0 || prediction.predictedProbability > 1) {
    throw new Error(`Invalid predictedProbability ${prediction.predictedProbability}: must be in range [0, 1].`);
  }

  if (prediction.confidence < 0 || prediction.confidence > 1) {
    throw new Error(`Invalid confidence ${prediction.confidence}: must be in range [0, 1].`);
  }

  if (prediction.predictionError !== undefined && (prediction.predictionError < 0 || prediction.predictionError > 1)) {
    throw new Error(`Invalid predictionError ${prediction.predictionError}: must be in range [0, 1].`);
  }

  if (prediction.brierScore !== undefined && (prediction.brierScore < 0 || prediction.brierScore > 1)) {
    throw new Error(`Invalid brierScore ${prediction.brierScore}: must be in range [0, 1].`);
  }
}
