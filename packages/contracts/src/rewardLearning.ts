import { z } from 'zod';

export const REWARD_DIMENSIONS = [
  'epistemic_gain',
  'efficacy_progress',
  'relational_depth',
  'computational_efficiency',
  'internal_coherence',
] as const;

export const RewardDimensionSchema = z.enum(REWARD_DIMENSIONS);
export type RewardDimension = z.infer<typeof RewardDimensionSchema>;

export const RewardPredictionSchema = z.object({
  id: z.string(),
  strategyId: z.string().min(1),
  domain: z.string().min(1),
  contextDescription: z.string().min(1),
  predictedUtility: z.number().min(0.0).max(1.0),
  predictedDimensions: z.record(RewardDimensionSchema, z.number().min(0.0).max(1.0)),
  predictedAt: z.string(),
});
export type RewardPrediction = z.infer<typeof RewardPredictionSchema>;

export const OutcomeEvaluationSchema = z.object({
  id: z.string(),
  strategyId: z.string().min(1),
  predictionId: z.string().optional(),
  domain: z.string().min(1),
  contextDescription: z.string().min(1),
  expectedUtility: z.number().min(0.0).max(1.0),
  observedUtility: z.number().min(0.0).max(1.0),
  predictionError: z.number().min(-1.0).max(1.0),
  dimensionScores: z.record(RewardDimensionSchema, z.number().min(0.0).max(1.0)),
  isSuccess: z.boolean(),
  isFailure: z.boolean(),
  outcomeDetails: z.string().min(1),
  isAutonomouslyEvaluated: z.literal(true), // Invariant: evaluated by internal criteria, never sycophantic approval
  evaluatedAt: z.string(),
});
export type OutcomeEvaluation = z.infer<typeof OutcomeEvaluationSchema>;

export const StrategyPerformanceRecordSchema = z.object({
  strategyId: z.string().min(1),
  strategyName: z.string().min(1),
  domain: z.string().min(1),
  usageCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  averagePredictedReward: z.number().min(0.0).max(1.0),
  averageActualReward: z.number().min(0.0).max(1.0),
  cumulativePredictionError: z.number(),
  effectivenessScore: z.number().min(0.0).max(1.0),
  isPreferred: z.boolean(),
  diminishingReturnsDetected: z.boolean(),
  marginalRewardHistory: z.array(z.number()),
  lastAdaptedAt: z.string(),
});
export type StrategyPerformanceRecord = z.infer<typeof StrategyPerformanceRecordSchema>;

export const DiminishingReturnAlertSchema = z.object({
  id: z.string(),
  strategyId: z.string().min(1),
  domain: z.string().min(1),
  consecutiveDrops: z.number().int().positive(),
  recentMarginalGains: z.array(z.number()),
  recommendedAction: z.string().min(1),
  detectedAt: z.string(),
});
export type DiminishingReturnAlert = z.infer<typeof DiminishingReturnAlertSchema>;
