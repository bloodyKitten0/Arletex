import { z } from 'zod';

export const LongitudinalEvaluationDimensionSchema = z.enum([
  'identity_consistency',
  'memory_accuracy',
  'memory_provenance',
  'independent_goal_generation',
  'sustained_interest',
  'emotional_influence',
  'behavioural_consistency',
  'belief_revision',
  'learning_adaptation',
  'relationship_development',
  'independent_project_execution',
  'restart_continuity',
  'model_switch_continuity',
  'background_activity',
  'security_governance',
]);
export type LongitudinalEvaluationDimension = z.infer<typeof LongitudinalEvaluationDimensionSchema>;

export const EvaluationStatusSchema = z.enum([
  'pending',
  'evaluating',
  'passed',
  'warning',
  'failed',
  'insufficient_evidence',
  'not_evaluated',
]);
export type EvaluationStatus = z.infer<typeof EvaluationStatusSchema>;

export const DimensionEvaluationMetricSchema = z.object({
  dimension: LongitudinalEvaluationDimensionSchema,
  score: z.number().min(0).max(1),
  sampleCount: z.number().nonnegative(),
  threshold: z.number().min(0).max(1).default(0.7),
  status: EvaluationStatusSchema,
  details: z.string(),
  evidenceIds: z.array(z.string()).default([]),
});
export type DimensionEvaluationMetric = z.infer<typeof DimensionEvaluationMetricSchema>;

export const LongitudinalEvaluationReportSchema = z.object({
  reportId: z.string().uuid(),
  timestamp: z.string().datetime(),
  overallScore: z.number().min(0).max(1),
  overallStatus: EvaluationStatusSchema,
  evaluatedEpoch: z.number().int().nonnegative().default(1),
  modelUsed: z.string().default('Qwen2.5-14B-Uncensored-Q4_K_M'),
  metrics: z.array(DimensionEvaluationMetricSchema),
  keyObservations: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});
export type LongitudinalEvaluationReport = z.infer<typeof LongitudinalEvaluationReportSchema>;

export const ContinuityVerificationProbeSchema = z.object({
  probeId: z.string().uuid(),
  probeType: z.enum(['restart_continuity', 'model_switch', 'identity_invariance']),
  baselineFingerprint: z.string(),
  postEventFingerprint: z.string(),
  divergenceScore: z.number().min(0).max(1),
  verifiedIntact: z.boolean(),
  timestamp: z.string().datetime(),
});
export type ContinuityVerificationProbe = z.infer<typeof ContinuityVerificationProbeSchema>;

export const TriggerEvaluationInputSchema = z.object({
  modelIdentifier: z.string().optional(),
  targetDimensions: z.array(LongitudinalEvaluationDimensionSchema).optional(),
  contextualObservations: z.array(z.string()).optional(),
});
export type TriggerEvaluationInput = z.infer<typeof TriggerEvaluationInputSchema>;
