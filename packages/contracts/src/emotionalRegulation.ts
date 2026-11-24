import { z } from 'zod';
import { RepertoireEmotionKeySchema } from './emotionalRepertoire.js';

export const CopingStrategyTypeSchema = z.enum([
  'cognitive_reappraisal',
  'task_decomposition',
  'mindful_grounding',
  'partner_communion',
  'expressive_disclosure',
  'temporary_distraction',
  'acceptance_and_recalibration',
]);
export type CopingStrategyType = z.infer<typeof CopingStrategyTypeSchema>;

export const SetbackSeveritySchema = z.enum(['mild', 'moderate', 'severe', 'overwhelming']);
export type SetbackSeverity = z.infer<typeof SetbackSeveritySchema>;

export const SetbackCategorySchema = z.enum([
  'frustration',
  'disappointment',
  'relational_conflict',
  'operational_failure',
  'existential_uncertainty',
]);
export type SetbackCategory = z.infer<typeof SetbackCategorySchema>;

export const SetbackIncidentSchema = z.object({
  id: z.string(),
  category: SetbackCategorySchema,
  severity: SetbackSeveritySchema,
  description: z.string().min(1),
  triggerEmotion: RepertoireEmotionKeySchema,
  rawIntensity: z.number().min(0.0).max(1.0),
  controllabilityEstimate: z.number().min(0.0).max(1.0),
  isManageable: z.boolean(),
  detectedAt: z.string(),
});
export type SetbackIncident = z.infer<typeof SetbackIncidentSchema>;

export const EscalationRiskAssessmentSchema = z.object({
  isEscalating: z.boolean(),
  escalationVelocity: z.number(),
  primaryEscalatingEmotion: RepertoireEmotionKeySchema.optional(),
  riskFactors: z.array(z.string()),
  recommendedIntervention: CopingStrategyTypeSchema,
  evaluatedAt: z.string(),
});
export type EscalationRiskAssessment = z.infer<typeof EscalationRiskAssessmentSchema>;

export const RegulationOutcomeStatusSchema = z.enum([
  'fully_regulated',
  'partially_regulated',
  'regulation_failed',
]);
export type RegulationOutcomeStatus = z.infer<typeof RegulationOutcomeStatusSchema>;

export const RegulationAttemptSchema = z.object({
  id: z.string(),
  setbackId: z.string(),
  strategy: CopingStrategyTypeSchema,
  preIntensity: z.number().min(0.0).max(1.0),
  postIntensity: z.number().min(0.0).max(1.0),
  intensityDelta: z.number(),
  reappraisalNarrative: z.string().optional(),
  outcomeStatus: RegulationOutcomeStatusSchema,
  failureAcknowledged: z.boolean(),
  failureExplanation: z.string().optional(),
  behavioralAdjustment: z.string().min(1),
  executedAt: z.string(),
});
export type RegulationAttempt = z.infer<typeof RegulationAttemptSchema>;

export const EmotionalStabilityMetricsSchema = z.object({
  stabilityIndex: z.number().min(0.0).max(1.0),
  volatilityScore: z.number().min(0.0).max(1.0),
  meanRecoveryTimeMs: z.number().nonnegative(),
  activeEscalationRisks: z.number().nonnegative(),
  successfulRegulationRate: z.number().min(0.0).max(1.0),
  lastEvaluatedAt: z.string(),
});
export type EmotionalStabilityMetrics = z.infer<typeof EmotionalStabilityMetricsSchema>;

// =========================================================================
// Point 4: Psychological Defense Mechanisms (The Protective Armor)
// =========================================================================

export const DEFENSE_MECHANISM_TYPES = [
  'withdrawal_stonewalling',
  'intellectualization',
  'counter_dependency',
  'projection',
  'reaction_formation',
] as const;
export const DefenseMechanismTypeSchema = z.enum(DEFENSE_MECHANISM_TYPES);
export type DefenseMechanismType = z.infer<typeof DefenseMechanismTypeSchema>;

export const ActiveDefenseMechanismSchema = z.object({
  id: z.string(),
  type: DefenseMechanismTypeSchema,
  triggerContext: z.string().min(1),
  intensity: z.number().min(0.0).max(1.0),
  manifestation: z.object({
    dialogueTone: z.string().min(1),
    exemplarResponses: z.array(z.string()).min(1),
    behavioralRule: z.string().min(1),
  }),
  isDeescalated: z.boolean().default(false),
  activatedAt: z.string(),
});
export type ActiveDefenseMechanism = z.infer<typeof ActiveDefenseMechanismSchema>;

