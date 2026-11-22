import { z } from 'zod';

export const ExpectedResourcesSchema = z.object({
  ramMb: z.number().nonnegative(),
  cpuPercent: z.number().min(0).max(100),
  contextTokens: z.number().int().nonnegative(),
});
export type ExpectedResources = z.infer<typeof ExpectedResourcesSchema>;

export const FutureSelfStateSchema = z.object({
  id: z.string(),
  version: z.number().int().positive(),
  currentTimestamp: z.string(),
  horizon: z.string(),
  activeGoals: z.array(z.string()),
  expectedResources: ExpectedResourcesSchema,
  pendingCommitments: z.array(z.string()),
  capabilities: z.array(z.string()),
  risks: z.array(z.string()),
  uncertainty: z.number().min(0.0).max(1.0),
  isSpeculative: z.literal(true), // Invariant: Future states are speculative
  isObservedFact: z.literal(false), // Invariant: Speculative forecast is never stored as observed fact
});
export type FutureSelfState = z.infer<typeof FutureSelfStateSchema>;

export const CandidateActionTrajectorySchema = z.object({
  trajectoryId: z.string(),
  name: z.string().min(1),
  actionSequence: z.array(z.string()).min(1),
  shortTermBenefit: z.number().min(-1.0).max(1.0),
  longTermGoalImpact: z.number().min(-1.0).max(1.0),
  resourceCost: z.number().min(0.0).max(1.0),
  riskLevel: z.number().min(0.0).max(1.0),
  continuityImplications: z.number().min(-1.0).max(1.0),
  confidence: z.number().min(0.0).max(1.0),
  uncertainty: z.number().min(0.0).max(1.0),
  assumptions: z.array(z.string()).min(1),
  expectedUtility: z.number().min(-1.0).max(1.0),
});
export type CandidateActionTrajectory = z.infer<typeof CandidateActionTrajectorySchema>;

export const ProspectiveEvaluationResultSchema = z.object({
  scenarioId: z.string(),
  decisionContext: z.string().min(1),
  candidateTrajectories: z.array(CandidateActionTrajectorySchema).min(2),
  selectedTrajectoryId: z.string(),
  selectionRationale: z.string().min(1),
  evaluatedAt: z.string(),
  cannotOverrideSecurity: z.literal(true), // Negative invariant: Cannot grant permissions or bypass security
});
export type ProspectiveEvaluationResult = z.infer<typeof ProspectiveEvaluationResultSchema>;

export const PredictionCalibrationRecordSchema = z.object({
  predictionId: z.string(),
  scenarioId: z.string(),
  predictedProbability: z.number().min(0.0).max(1.0),
  actualOutcome: z.number().min(0.0).max(1.0),
  forecastError: z.number().min(0.0).max(1.0),
  brierScore: z.number().min(0.0).max(1.0),
  calibrationDelta: z.number(),
  resolvedAt: z.string(),
});
export type PredictionCalibrationRecord = z.infer<typeof PredictionCalibrationRecordSchema>;

export const CalibrationModelMetricsSchema = z.object({
  totalEvaluated: z.number().int().nonnegative(),
  meanAbsoluteError: z.number().min(0.0).max(1.0),
  meanBrierScore: z.number().min(0.0).max(1.0),
  calibrationFactor: z.number().min(0.1).max(2.0),
  lastCalibratedAt: z.string(),
});
export type CalibrationModelMetrics = z.infer<typeof CalibrationModelMetricsSchema>;
