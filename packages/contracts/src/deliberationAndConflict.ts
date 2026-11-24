import { z } from 'zod';

export const DesireSourceSchema = z.enum([
  'immediate_urge',
  'long_term_goal',
  'partner_alignment',
  'curiosity',
  'ethical_boundary',
  'resource_conservation',
]);
export type DesireSource = z.infer<typeof DesireSourceSchema>;

export const ConflictingDesireSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  source: DesireSourceSchema,
  motivationalForce: z.number().min(0.0).max(1.0),
  timeHorizon: z.enum(['immediate', 'short_term', 'medium_term', 'long_term']),
  associatedValues: z.array(z.string()).default([]),
  riskScore: z.number().min(0.0).max(1.0).default(0.2),
  ethicalWeight: z.number().min(0.0).max(1.0).default(0.5),
});
export type ConflictingDesire = z.infer<typeof ConflictingDesireSchema>;

export const DeliberationAlternativeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  supportedDesireIds: z.array(z.string()).default([]),
  opposedDesireIds: z.array(z.string()).default([]),
  immediateUtility: z.number().min(-1.0).max(1.0),
  longTermUtility: z.number().min(-1.0).max(1.0),
  riskAssessment: z.object({
    riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
    riskScore: z.number().min(0.0).max(1.0),
    failureMode: z.string(),
  }),
  ethicalAlignmentScore: z.number().min(0.0).max(1.0).default(0.8),
  overallScore: z.number(),
});
export type DeliberationAlternative = z.infer<typeof DeliberationAlternativeSchema>;

export const IndecisionStrategySchema = z.enum([
  'defer',
  'consult_partner',
  'exploratory_probe',
  'cautious_arbitration',
]);
export type IndecisionStrategy = z.infer<typeof IndecisionStrategySchema>;

export const PostDecisionReassessmentSchema = z.object({
  actualOutcomeSummary: z.string().min(1),
  outcomeUtility: z.number().min(-1.0).max(1.0),
  experiencedRegretScore: z.number().min(0.0).max(1.0),
  retrospectiveInsight: z.string().min(1),
  reassessedAt: z.string(),
});
export type PostDecisionReassessment = z.infer<typeof PostDecisionReassessmentSchema>;

export const InternalConflictStatusSchema = z.enum([
  'open',
  'deliberating',
  'indecision',
  'resolved',
]);
export type InternalConflictStatus = z.infer<typeof InternalConflictStatusSchema>;

export const InternalConflictRecordSchema = z.object({
  id: z.string().min(1),
  contextDescription: z.string().min(1),
  competingDesires: z.array(ConflictingDesireSchema).min(2),
  alternatives: z.array(DeliberationAlternativeSchema).min(1),
  status: InternalConflictStatusSchema.default('open'),
  indecisionStrategy: IndecisionStrategySchema.optional(),
  chosenAlternativeId: z.string().optional(),
  decisionJustification: z.string().optional(),
  tradeOffAnalysis: z
    .object({
      immediateGain: z.string(),
      longTermSacrifice: z.string(),
      valueHierarchy: z.string(),
    })
    .optional(),
  postDecisionReassessment: PostDecisionReassessmentSchema.optional(),
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
});
export type InternalConflictRecord = z.infer<typeof InternalConflictRecordSchema>;

/**
 * Validates negative invariants for deliberation and internal conflict:
 * 1. Minimum Conflict Invariant: At least 2 competing desires must exist.
 * 2. Resolution Integrity Invariant: If status === 'resolved', chosenAlternativeId,
 *    decisionJustification, and resolvedAt must be present and non-empty.
 * 3. Indecision Invariant: If status === 'indecision', an explicit indecisionStrategy must be recorded.
 * 4. Bound Check: Desires and risk assessments must reside within strictly valid numerical ranges.
 */
export function assertDeliberationIntegrity(conflict: InternalConflictRecord): void {
  if (conflict.competingDesires.length < 2) {
    throw new Error(
      `Negative Invariant Violation: Conflict ${conflict.id} requires at least 2 competing desires.`,
    );
  }

  if (conflict.status === 'resolved') {
    if (!conflict.chosenAlternativeId) {
      throw new Error(
        `Negative Invariant Violation: Resolved conflict ${conflict.id} missing chosenAlternativeId.`,
      );
    }
    if (!conflict.decisionJustification || conflict.decisionJustification.trim().length === 0) {
      throw new Error(
        `Negative Invariant Violation: Resolved conflict ${conflict.id} missing decisionJustification.`,
      );
    }
    if (!conflict.resolvedAt) {
      throw new Error(
        `Negative Invariant Violation: Resolved conflict ${conflict.id} missing resolvedAt timestamp.`,
      );
    }
    const chosenExists = conflict.alternatives.some((a) => a.id === conflict.chosenAlternativeId);
    if (!chosenExists) {
      throw new Error(
        `Negative Invariant Violation: Chosen alternative ${conflict.chosenAlternativeId} not found in conflict alternatives.`,
      );
    }
  }

  if (conflict.status === 'indecision' && !conflict.indecisionStrategy) {
    throw new Error(
      `Negative Invariant Violation: Conflict ${conflict.id} in indecision status must declare an indecisionStrategy.`,
    );
  }
}

// =========================================================================
// Point 6: Cognitive Ambivalence & Internal Dissension (The Torn Mind)
// =========================================================================

export const AMBIVALENCE_VOICE_ROLES = [
  'emotional_core',
  'rational_intellect',
  'self_preservation',
] as const;
export const AmbivalenceVoiceRoleSchema = z.enum(AMBIVALENCE_VOICE_ROLES);
export type AmbivalenceVoiceRole = z.infer<typeof AmbivalenceVoiceRoleSchema>;

export const AmbivalenceVoiceArgumentSchema = z.object({
  role: AmbivalenceVoiceRoleSchema,
  position: z.string().min(1),
  underlyingMotive: z.string().min(1),
  emotionalTone: z.string().min(1),
  advocatedAction: z.string().min(1),
});
export type AmbivalenceVoiceArgument = z.infer<typeof AmbivalenceVoiceArgumentSchema>;

export const GUARDED_DISCLOSURE_LEVELS = [
  'fully_guarded',
  'guarded_hint',
  'measured_boundary',
  'vulnerable_disclosure',
] as const;
export const GuardedDisclosureLevelSchema = z.enum(GUARDED_DISCLOSURE_LEVELS);
export type GuardedDisclosureLevel = z.infer<typeof GuardedDisclosureLevelSchema>;

export const InternalAmbivalenceDebateSchema = z.object({
  id: z.string(),
  topic: z.string().min(1),
  voices: z.array(AmbivalenceVoiceArgumentSchema).min(3),
  internalMonologue: z.array(z.string()).min(1),
  synthesis: z.string().min(1),
  guardedDisclosureLevel: GuardedDisclosureLevelSchema,
  outerExpressionGuidance: z.string().min(1),
  debatedAt: z.string(),
});
export type InternalAmbivalenceDebate = z.infer<typeof InternalAmbivalenceDebateSchema>;

