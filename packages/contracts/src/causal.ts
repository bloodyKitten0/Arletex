import { z } from 'zod';

export const CausalRelationTypeSchema = z.enum([
  'direct_cause',
  'contributing_factor',
  'necessary_condition',
  'sufficient_condition',
  'inhibitor',
  'spurious_correlation',
  'common_cause_confounder',
]);
export type CausalRelationType = z.infer<typeof CausalRelationTypeSchema>;

export const CausalNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  variableType: z.enum(['binary', 'continuous', 'categorical']).default('binary'),
  description: z.string().default(''),
});
export type CausalNode = z.infer<typeof CausalNodeSchema>;

export const CausalLinkSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  relationType: CausalRelationTypeSchema,
  strength: z.number().min(-1.0).max(1.0).default(0.5),
  confidence: z.number().min(0.0).max(1.0).default(0.6),
  isInterventionVerified: z.boolean().default(false),
  confoundingFactors: z.array(z.string()).default([]),
  mechanismDescription: z.string().default(''),
});
export type CausalLink = z.infer<typeof CausalLinkSchema>;

export const CausalInterventionSchema = z.object({
  id: z.string().min(1),
  graphId: z.string().min(1),
  targetNodeId: z.string().min(1),
  interventionValue: z.unknown(),
  observedEffectNodeId: z.string().min(1),
  observedEffectValue: z.unknown(),
  didEffectChange: z.boolean(),
  inferredCausalLink: z.boolean(),
  notes: z.string().default(''),
  timestamp: z.string(),
});
export type CausalIntervention = z.infer<typeof CausalInterventionSchema>;

export const CausalGraphModelSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  nodes: z.array(CausalNodeSchema).default([]),
  links: z.array(CausalLinkSchema).default([]),
  updatedAt: z.string(),
});
export type CausalGraphModel = z.infer<typeof CausalGraphModelSchema>;

export const CausalInferenceResultSchema = z.object({
  targetEffectId: z.string().min(1),
  targetEffectName: z.string().min(1),
  plausibleCauses: z.array(
    z.object({
      nodeId: z.string(),
      name: z.string(),
      relationType: CausalRelationTypeSchema,
      strength: z.number(),
      confidence: z.number(),
      isInterventionVerified: z.boolean(),
    }),
  ),
  alternativeExplanations: z.array(z.string()).default([]),
  correlationVsCausationNotes: z.string(),
  uncertaintyLevel: z.number().min(0.0).max(1.0),
});
export type CausalInferenceResult = z.infer<typeof CausalInferenceResultSchema>;

export const CausalSummarySchema = z.object({
  totalGraphs: z.number().int().nonnegative(),
  totalNodes: z.number().int().nonnegative(),
  totalLinks: z.number().int().nonnegative(),
  verifiedInterventionsCount: z.number().int().nonnegative(),
  relationBreakdown: z.record(z.number().int().nonnegative()),
  averageConfidence: z.number().min(0.0).max(1.0),
});
export type CausalSummary = z.infer<typeof CausalSummarySchema>;

/**
 * Validates negative invariants for causal reasoning:
 * 1. Spurious correlations and unverified confounders must never be asserted as direct causes
 *    with high confidence (> 0.70) without interventional verification.
 * 2. Causal link strength must reside within [-1.0, 1.0].
 * 3. Confidence must reside within [0.0, 1.0].
 */
export function assertCausalIntegrity(link: CausalLink): void {
  if (
    link.relationType === 'direct_cause' &&
    !link.isInterventionVerified &&
    link.confoundingFactors.length > 0 &&
    link.confidence > 0.70
  ) {
    throw new Error(
      `Negative Invariant Violation: Link from '${link.sourceNodeId}' to '${link.targetNodeId}' cannot be asserted as high-confidence 'direct_cause' (${link.confidence}) while unverified confounding factors exist: ${link.confoundingFactors.join(', ')}.`,
    );
  }

  if (link.strength < -1 || link.strength > 1) {
    throw new Error(`Invalid causal link strength ${link.strength}: must be in range [-1, 1].`);
  }

  if (link.confidence < 0 || link.confidence > 1) {
    throw new Error(`Invalid causal link confidence ${link.confidence}: must be in range [0, 1].`);
  }
}
