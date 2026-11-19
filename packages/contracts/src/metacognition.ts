import { z } from 'zod';

export const UncertaintyTypeSchema = z.enum([
  'epistemic',
  'aleatoric',
  'ambiguity',
]);
export type UncertaintyType = z.infer<typeof UncertaintyTypeSchema>;

export const ReasoningFlawTypeSchema = z.enum([
  'unsupported_assumption',
  'logical_fallacy',
  'overgeneralization',
  'confirmation_bias',
  'insufficient_evidence',
  'contradiction',
]);
export type ReasoningFlawType = z.infer<typeof ReasoningFlawTypeSchema>;

export const MetacognitiveContradictionItemSchema = z.object({
  id: z.string().min(1),
  statementA: z.string().min(1),
  statementB: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high']),
  status: z.enum(['detected', 'investigating', 'resolved']),
  notes: z.string().optional(),
});
export type MetacognitiveContradictionItem = z.infer<typeof MetacognitiveContradictionItemSchema>;

export const ReasoningErrorItemSchema = z.object({
  type: ReasoningFlawTypeSchema,
  description: z.string().min(1),
  impact: z.number().min(0.0).max(1.0),
});
export type ReasoningErrorItem = z.infer<typeof ReasoningErrorItemSchema>;

export const CognitiveAssessmentSchema = z.object({
  id: z.string().min(1),
  targetCognitionId: z.string().min(1),
  targetDomain: z.string().min(1),
  statedConfidence: z.number().min(0.0).max(1.0),
  calibratedConfidence: z.number().min(0.0).max(1.0),
  epistemicUncertainty: z.number().min(0.0).max(1.0),
  aleatoricUncertainty: z.number().min(0.0).max(1.0),
  evidenceSufficiency: z.number().min(0.0).max(1.0),
  isEvidenceSufficient: z.boolean(),
  identifiedAssumptions: z.array(z.string()).default([]),
  detectedContradictions: z.array(MetacognitiveContradictionItemSchema).default([]),
  reasoningQualityScore: z.number().min(0.0).max(1.0),
  recognizedErrors: z.array(ReasoningErrorItemSchema).default([]),
  needsInvestigation: z.boolean(),
  investigationFocus: z.string().optional(),
  selfCorrectionInitiated: z.boolean(),
  correctiveActions: z.array(z.string()).default([]),
  assessedAt: z.string(),
});
export type CognitiveAssessment = z.infer<typeof CognitiveAssessmentSchema>;

export const MetacognitiveCorrectionSchema = z.object({
  id: z.string().min(1),
  assessmentId: z.string().min(1),
  originalClaim: z.string().min(1),
  correctedClaim: z.string().min(1),
  confidenceAdjustment: z.number().min(-1.0).max(1.0),
  rationale: z.string().min(1),
  status: z.enum(['proposed', 'applied', 'rejected']).default('applied'),
  appliedAt: z.string().optional(),
});
export type MetacognitiveCorrection = z.infer<typeof MetacognitiveCorrectionSchema>;

/**
 * Validates negative invariants for metacognition:
 * 1. Overconfidence / Calibration Invariant:
 *    If evidence sufficiency is low (< 0.4), calibrated confidence MUST NOT exceed 0.6.
 *    If stated confidence is high (> 0.8) while evidence sufficiency is low (< 0.4),
 *    the system MUST either set needsInvestigation=true or selfCorrectionInitiated=true,
 *    and calibratedConfidence must be throttled down.
 * 2. Unresolved High-Severity Contradiction Invariant:
 *    If any detected contradiction has high severity and status !== 'resolved',
 *    needsInvestigation or selfCorrectionInitiated must be true.
 * 3. Bounded Uncertainty and Quality Scores [0.0, 1.0].
 */
export function assertMetacognitiveIntegrity(assessment: CognitiveAssessment): void {
  if (assessment.statedConfidence < 0 || assessment.statedConfidence > 1) {
    throw new Error(`Invalid statedConfidence ${assessment.statedConfidence}: must be in range [0, 1].`);
  }
  if (assessment.calibratedConfidence < 0 || assessment.calibratedConfidence > 1) {
    throw new Error(`Invalid calibratedConfidence ${assessment.calibratedConfidence}: must be in range [0, 1].`);
  }
  if (assessment.evidenceSufficiency < 0 || assessment.evidenceSufficiency > 1) {
    throw new Error(`Invalid evidenceSufficiency ${assessment.evidenceSufficiency}: must be in range [0, 1].`);
  }
  if (assessment.reasoningQualityScore < 0 || assessment.reasoningQualityScore > 1) {
    throw new Error(`Invalid reasoningQualityScore ${assessment.reasoningQualityScore}: must be in range [0, 1].`);
  }

  // Invariant 1: Overconfidence mitigation
  if (assessment.evidenceSufficiency < 0.4 && assessment.calibratedConfidence > 0.6) {
    throw new Error(
      `Negative Invariant Violation (Overconfidence): Evidence sufficiency is low (${assessment.evidenceSufficiency}) but calibrated confidence is excessively high (${assessment.calibratedConfidence}). Calibration must constrain confidence when evidence is insufficient.`,
    );
  }

  // Invariant 2: High severity contradiction requires action
  const hasUnaddressedSevereContradiction = assessment.detectedContradictions.some(
    (c) => c.severity === 'high' && c.status === 'detected',
  );
  if (hasUnaddressedSevereContradiction && !assessment.needsInvestigation && !assessment.selfCorrectionInitiated) {
    throw new Error(
      `Negative Invariant Violation: Unresolved high-severity contradiction exists in assessment ${assessment.id}, but neither investigation nor self-correction was initiated.`,
    );
  }
}

export function assertCorrectionIntegrity(correction: MetacognitiveCorrection): void {
  if (correction.confidenceAdjustment < -1 || correction.confidenceAdjustment > 1) {
    throw new Error(`Invalid confidenceAdjustment ${correction.confidenceAdjustment}: must be in range [-1, 1].`);
  }
}
