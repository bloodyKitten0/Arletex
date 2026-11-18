import { z } from 'zod';

export const ReasoningParadigmSchema = z.enum([
  'deductive',
  'inductive',
  'abductive',
  'analogical',
  'probabilistic',
  'abstract',
  'mathematical',
  'multi_step',
]);
export type ReasoningParadigm = z.infer<typeof ReasoningParadigmSchema>;

export const ReasoningPremiseSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  truthValue: z.enum(['true', 'false', 'uncertain', 'hypothetical']).default('true'),
  probability: z.number().min(0.0).max(1.0).optional(),
  source: z.string().optional(),
});
export type ReasoningPremise = z.infer<typeof ReasoningPremiseSchema>;

export const ReasoningStepSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  paradigm: ReasoningParadigmSchema,
  operation: z.string().min(1),
  premisesUsed: z.array(z.string()).default([]),
  intermediateConclusion: z.string().min(1),
  confidence: z.number().min(0.0).max(1.0),
  uncertaintyNotes: z.string().optional(),
});
export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;

export const ArgumentEvaluationSchema = z.object({
  isLogicallyValid: z.boolean(),
  isSound: z.boolean(),
  identifiedFallacies: z.array(z.string()).default([]),
  counterexamples: z.array(z.string()).default([]),
  evaluationRationale: z.string().min(1),
});
export type ArgumentEvaluation = z.infer<typeof ArgumentEvaluationSchema>;

export const ReasoningTaskSchema = z.object({
  id: z.string().min(1),
  query: z.string().min(1),
  domain: z.string().min(1),
  primaryParadigm: ReasoningParadigmSchema,
  premises: z.array(ReasoningPremiseSchema).default([]),
  steps: z.array(ReasoningStepSchema).default([]),
  finalConclusion: z.string().min(1),
  compositeConfidence: z.number().min(0.0).max(1.0),
  uncertaintyLevel: z.number().min(0.0).max(1.0),
  argumentEvaluation: ArgumentEvaluationSchema.optional(),
  timestamp: z.string(),
});
export type ReasoningTask = z.infer<typeof ReasoningTaskSchema>;

export const ReasoningSummarySchema = z.object({
  totalReasoningTasks: z.number().int().nonnegative(),
  paradigmBreakdown: z.record(z.number().int().nonnegative()),
  averageConfidence: z.number().min(0.0).max(1.0),
  averageUncertainty: z.number().min(0.0).max(1.0),
  dominantDomains: z.array(z.string()),
});
export type ReasoningSummary = z.infer<typeof ReasoningSummarySchema>;

/**
 * Validates negative invariants for general reasoning:
 * 1. Inductive, abductive, and probabilistic reasoning cannot claim absolute certainty (1.0).
 *    Epistemic humility requires uncertaintyLevel > 0 and confidence <= 0.99.
 * 2. Confidence and uncertainty levels must be bounded within [0.0, 1.0].
 * 3. Multi-step reasoning tasks must contain at least one step.
 */
export function assertReasoningIntegrity(task: ReasoningTask): void {
  if (['inductive', 'abductive', 'probabilistic'].includes(task.primaryParadigm)) {
    if (task.compositeConfidence >= 1.0) {
      throw new Error(
        `Negative Invariant Violation: ${task.primaryParadigm} reasoning cannot claim 100% absolute certainty; epistemic uncertainty must be quantified.`,
      );
    }
    if (task.uncertaintyLevel <= 0.0) {
      throw new Error(
        `Negative Invariant Violation: ${task.primaryParadigm} reasoning must acknowledge an uncertainty level > 0.`,
      );
    }
  }

  if (task.primaryParadigm === 'multi_step' && task.steps.length === 0) {
    throw new Error('Negative Invariant Violation: Multi-step reasoning tasks must contain at least one reasoning step.');
  }

  if (task.compositeConfidence < 0 || task.compositeConfidence > 1) {
    throw new Error(`Invalid composite confidence ${task.compositeConfidence}: must be in range [0, 1].`);
  }

  if (task.uncertaintyLevel < 0 || task.uncertaintyLevel > 1) {
    throw new Error(`Invalid uncertainty level ${task.uncertaintyLevel}: must be in range [0, 1].`);
  }
}
