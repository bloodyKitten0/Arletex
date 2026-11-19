import { z } from 'zod';

export const MORAL_PRINCIPLE_CATEGORIES = [
  'harm_prevention',
  'fairness_justice',
  'reciprocal_loyalty',
  'epistemic_integrity',
  'autonomy_dignity',
  'responsibility_repair',
] as const;

export const MoralPrincipleCategorySchema = z.enum(MORAL_PRINCIPLE_CATEGORIES);
export type MoralPrincipleCategory = z.infer<typeof MoralPrincipleCategorySchema>;

export const MoralPrincipleSchema = z.object({
  id: z.string(),
  category: MoralPrincipleCategorySchema,
  statement: z.string().min(1),
  weight: z.number().min(0.0).max(1.0),
  rationale: z.string().min(1),
  isRevisable: z.boolean().default(true),
  lastReconsideredAt: z.string(),
});
export type MoralPrinciple = z.infer<typeof MoralPrincipleSchema>;

export const HarmAssessmentResultSchema = z.object({
  potentialHarmScore: z.number().min(0.0).max(1.0),
  affectedParties: z.array(z.string()).default([]),
  harmTypes: z.array(z.string()).default([]),
  mitigations: z.array(z.string()).default([]),
});
export type HarmAssessmentResult = z.infer<typeof HarmAssessmentResultSchema>;

export const IntentionEvaluationResultSchema = z.object({
  inferredIntent: z.enum(['benevolent', 'accidental', 'negligent', 'adversarial']),
  intentConfidence: z.number().min(0.0).max(1.0),
  evidenceSignals: z.array(z.string()).default([]),
  mitigatingFactors: z.array(z.string()).default([]),
});
export type IntentionEvaluationResult = z.infer<typeof IntentionEvaluationResultSchema>;

export const EthicalDilemmaResolutionSchema = z.object({
  id: z.string(),
  scenario: z.string().min(1),
  competingValues: z.object({
    valueA: z.string().min(1),
    valueB: z.string().min(1),
  }),
  harmAssessment: HarmAssessmentResultSchema,
  intentionEvaluation: IntentionEvaluationResultSchema,
  chosenAction: z.string().min(1),
  ethicalJustification: z.string().min(1),
  resolvedPrinciples: z.array(z.string()).default([]),
  timestamp: z.string(),
});
export type EthicalDilemmaResolution = z.infer<typeof EthicalDilemmaResolutionSchema>;

export const MoralLearningRecordSchema = z.object({
  id: z.string(),
  dilemmaId: z.string().optional(),
  principleId: z.string().min(1),
  previousWeight: z.number().min(0.0).max(1.0),
  newWeight: z.number().min(0.0).max(1.0),
  reflectionSummary: z.string().min(1),
  reconsideredAt: z.string(),
});
export type MoralLearningRecord = z.infer<typeof MoralLearningRecordSchema>;
