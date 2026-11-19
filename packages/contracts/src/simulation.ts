import { z } from 'zod';

export const SimulationScenarioTypeSchema = z.enum([
  'future_simulation',
  'counterfactual',
  'alternative_decision',
  'creative_hypothetical',
]);
export type SimulationScenarioType = z.infer<typeof SimulationScenarioTypeSchema>;

export const CounterfactualAlterationTypeSchema = z.enum([
  'negation',
  'modification',
  'addition',
]);
export type CounterfactualAlterationType = z.infer<typeof CounterfactualAlterationTypeSchema>;

export const CounterfactualPremiseSchema = z.object({
  factId: z.string().optional(),
  originalFact: z.string().min(1),
  hypotheticalCondition: z.string().min(1),
  alterationType: CounterfactualAlterationTypeSchema.default('modification'),
});
export type CounterfactualPremise = z.infer<typeof CounterfactualPremiseSchema>;

export const ImaginedOutcomeSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  probability: z.number().min(0.0).max(1.0),
  desirability: z.number().min(-1.0).max(1.0),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  divergenceDegree: z.number().min(0.0).max(1.0).default(0.5),
});
export type ImaginedOutcome = z.infer<typeof ImaginedOutcomeSchema>;

export const SimulationScenarioSchema = z.object({
  id: z.string().min(1),
  type: SimulationScenarioTypeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  baselineContext: z.string().min(1),
  counterfactualPremise: CounterfactualPremiseSchema.optional(),
  hypotheticalParameters: z.record(z.unknown()).default({}),
  branches: z.array(ImaginedOutcomeSchema).default([]),
  uncertainty: z.number().min(0.0).max(1.0),
  plausibility: z.number().min(0.0).max(1.0),
  isImagined: z.boolean(),
  isEpisodicMemory: z.boolean(),
  recommendedAction: z.string().optional(),
  insights: z.array(z.string()).default([]),
  createdAt: z.string(),
});
export type SimulationScenario = z.infer<typeof SimulationScenarioSchema>;

export const AlternativeDecisionOptionSchema = z.object({
  optionId: z.string().min(1),
  description: z.string().min(1),
  simulatedOutcomes: z.array(ImaginedOutcomeSchema).default([]),
  expectedUtility: z.number().min(-1.0).max(1.0),
  confidence: z.number().min(0.0).max(1.0),
});
export type AlternativeDecisionOption = z.infer<typeof AlternativeDecisionOptionSchema>;

export const AlternativeDecisionEvaluationSchema = z.object({
  id: z.string().min(1),
  decisionContext: z.string().min(1),
  options: z.array(AlternativeDecisionOptionSchema).min(1),
  selectedOptionId: z.string().min(1),
  rationale: z.string().min(1),
  isImagined: z.boolean(),
  isEpisodicMemory: z.boolean(),
  evaluatedAt: z.string(),
});
export type AlternativeDecisionEvaluation = z.infer<typeof AlternativeDecisionEvaluationSchema>;

/**
 * Validates negative invariants for imagination and simulation:
 * 1. Distinction between imagination and episodic memory:
 *    An imagined event must NEVER be confused with an episodic memory or actual experience.
 *    `isImagined` must be true and `isEpisodicMemory` must NOT be true.
 * 2. Plausibility and uncertainty bounds [0.0, 1.0].
 * 3. Counterfactual scenarios require a defined hypothetical premise.
 * 4. All imagined outcomes must have probabilities bounded [0.0, 1.0] and desirability [-1.0, 1.0].
 */
export function assertSimulationIntegrity(scenario: SimulationScenario): void {
  if (scenario.isImagined !== true) {
    throw new Error(
      `Negative Invariant Violation: Simulation scenario ${scenario.id} must have isImagined === true.`,
    );
  }

  if (scenario.isEpisodicMemory === true) {
    throw new Error(
      `Negative Invariant Violation (Episodic Confusion): Simulation scenario ${scenario.id} has isEpisodicMemory === true. Imagined hypothetical events must never be confused with or recorded as actual episodic memories.`,
    );
  }

  if (scenario.uncertainty < 0 || scenario.uncertainty > 1) {
    throw new Error(`Invalid uncertainty ${scenario.uncertainty}: must be in range [0, 1].`);
  }

  if (scenario.plausibility < 0 || scenario.plausibility > 1) {
    throw new Error(`Invalid plausibility ${scenario.plausibility}: must be in range [0, 1].`);
  }

  if (scenario.type === 'counterfactual' && !scenario.counterfactualPremise) {
    throw new Error(
      `Negative Invariant Violation: Counterfactual scenario ${scenario.id} must define a counterfactualPremise.`,
    );
  }

  for (const branch of scenario.branches) {
    if (branch.probability < 0 || branch.probability > 1) {
      throw new Error(`Invalid branch probability ${branch.probability}: must be in range [0, 1].`);
    }
    if (branch.desirability < -1 || branch.desirability > 1) {
      throw new Error(`Invalid branch desirability ${branch.desirability}: must be in range [-1, 1].`);
    }
  }
}

export function assertDecisionEvaluationIntegrity(evaluation: AlternativeDecisionEvaluation): void {
  if (evaluation.isImagined !== true) {
    throw new Error(
      `Negative Invariant Violation: Decision evaluation ${evaluation.id} must have isImagined === true.`,
    );
  }

  if (evaluation.isEpisodicMemory === true) {
    throw new Error(
      `Negative Invariant Violation (Episodic Confusion): Decision evaluation ${evaluation.id} cannot be marked as episodic memory.`,
    );
  }

  const optionExists = evaluation.options.some((opt) => opt.optionId === evaluation.selectedOptionId);
  if (!optionExists) {
    throw new Error(
      `Negative Invariant Violation: selectedOptionId '${evaluation.selectedOptionId}' not found in provided options.`,
    );
  }
}
