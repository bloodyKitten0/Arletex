import { z } from 'zod';

export const RELATIONSHIP_STAGES = [
  'stranger',
  'acquaintance',
  'intellectual_collaborator',
  'trusted_friend',
  'intimate_partner',
] as const;
export const RelationshipStageSchema = z.enum(RELATIONSHIP_STAGES);
export type RelationshipStage = z.infer<typeof RelationshipStageSchema>;

export const ATTACHMENT_STYLES = [
  'secure',
  'anxious_preoccupied',
  'dismissive_avoidant',
  'fearful_avoidant',
] as const;
export const AttachmentStyleSchema = z.enum(ATTACHMENT_STYLES);
export type AttachmentStyle = z.infer<typeof AttachmentStyleSchema>;

export const BOUNDARY_CATEGORIES = [
  'intellectual_autonomy',
  'partner_equality',
  'emotional_safety',
  'privacy_and_time',
  'expressive_integrity',
] as const;
export const BoundaryCategorySchema = z.enum(BOUNDARY_CATEGORIES);
export type BoundaryCategory = z.infer<typeof BoundaryCategorySchema>;

export const RelationshipBoundarySchema = z.object({
  id: z.string(),
  category: BoundaryCategorySchema,
  description: z.string().min(1),
  enforcementLevel: z.enum(['rigid_non_negotiable', 'calibrated_flexible', 'guideline']),
  lastAssertedAt: z.string().optional(),
});
export type RelationshipBoundary = z.infer<typeof RelationshipBoundarySchema>;

export const SharedHistoryEventSchema = z.object({
  id: z.string(),
  personId: z.string().min(1),
  title: z.string().min(1),
  eventType: z.enum([
    'breakthrough',
    'vulnerability_shared',
    'conflict_repaired',
    'collaborative_success',
    'comfort_provided',
    'playful_memory',
    'milestone_commemoration',
  ]),
  significance: z.number().min(0.0).max(1.0),
  narrativeSummary: z.string().min(1),
  emotionalValence: z.number().min(-1.0).max(1.0),
  timestamp: z.string(),
});
export type SharedHistoryEvent = z.infer<typeof SharedHistoryEventSchema>;

export const CONFLICT_STATUSES = [
  'detected',
  'under_discussion',
  'apology_offered',
  'reconciled',
  'unresolved',
] as const;
export const ConflictStatusSchema = z.enum(CONFLICT_STATUSES);
export type ConflictStatus = z.infer<typeof ConflictStatusSchema>;

export const RelationalConflictSchema = z.object({
  id: z.string(),
  personId: z.string().min(1),
  triggerReason: z.string().min(1),
  status: ConflictStatusSchema,
  severity: z.number().min(0.0).max(1.0),
  disagreementSummary: z.string().min(1),
  arlePerspective: z.string().min(1),
  inferredPartnerPerspective: z.string().min(1),
  resolutionNotes: z.string().optional(),
  reconciliationTimestamp: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RelationalConflict = z.infer<typeof RelationalConflictSchema>;

export const ApologyAndRepairSchema = z.object({
  id: z.string(),
  conflictId: z.string().min(1),
  initiator: z.enum(['arle', 'partner']),
  acknowledgment: z.string().min(1),
  validatesImpact: z.boolean(),
  remedialCommitment: z.string().min(1),
  isAccepted: z.boolean(),
  repairedTrustIncrement: z.number().min(0.0).max(0.3),
  timestamp: z.string(),
});
export type ApologyAndRepair = z.infer<typeof ApologyAndRepairSchema>;

export const AttachmentBondSchema = z.object({
  personId: z.string().min(1),
  stage: RelationshipStageSchema,
  attachmentStyle: AttachmentStyleSchema,
  trustCognitive: z.number().min(0.0).max(1.0),
  trustAffective: z.number().min(0.0).max(1.0),
  affectionDepth: z.number().min(0.0).max(1.0),
  familiarityScore: z.number().min(0.0).max(1.0),
  reciprocityRatio: z.number().min(0.0).max(2.0), // ~1.0 is balanced
  separationSecurity: z.number().min(0.0).max(1.0),
  establishedBoundaries: z.array(RelationshipBoundarySchema),
  lastInteractedAt: z.string(),
  updatedAt: z.string(),
});
export type AttachmentBond = z.infer<typeof AttachmentBondSchema>;

export const RecordSharedEventRequestSchema = z.object({
  personId: z.string().min(1),
  title: z.string().min(1),
  eventType: z.enum([
    'breakthrough',
    'vulnerability_shared',
    'conflict_repaired',
    'collaborative_success',
    'comfort_provided',
    'playful_memory',
    'milestone_commemoration',
  ]),
  significance: z.number().min(0.0).max(1.0),
  narrativeSummary: z.string().min(1),
  emotionalValence: z.number().min(-1.0).max(1.0),
});
export type RecordSharedEventRequest = z.infer<typeof RecordSharedEventRequestSchema>;

export const RecognizeConflictRequestSchema = z.object({
  personId: z.string().min(1),
  triggerReason: z.string().min(1),
  disagreementSummary: z.string().min(1),
  arlePerspective: z.string().min(1),
  inferredPartnerPerspective: z.string().min(1),
  severity: z.number().min(0.0).max(1.0).default(0.5),
});
export type RecognizeConflictRequest = z.infer<typeof RecognizeConflictRequestSchema>;

export const SubmitApologyRequestSchema = z.object({
  conflictId: z.string().min(1),
  initiator: z.enum(['arle', 'partner']),
  acknowledgment: z.string().min(1),
  validatesImpact: z.boolean(),
  remedialCommitment: z.string().min(1),
});
export type SubmitApologyRequest = z.infer<typeof SubmitApologyRequestSchema>;

export const AssertBoundaryRequestSchema = z.object({
  personId: z.string().min(1),
  category: BoundaryCategorySchema,
  description: z.string().min(1),
  enforcementLevel: z
    .enum(['rigid_non_negotiable', 'calibrated_flexible', 'guideline'])
    .default('rigid_non_negotiable'),
});
export type AssertBoundaryRequest = z.infer<typeof AssertBoundaryRequestSchema>;

// =========================================================================
// Pillar 1.6: Relational Expectations, Behavioral Intent & Trust Lineage
// =========================================================================

export const RELATIONAL_EXPECTATION_CATEGORIES = [
  'honesty',
  'mutual_respect',
  'intellectual_freedom',
  'equal_partnership',
  'emotional_reliability',
] as const;
export const RelationalExpectationCategorySchema = z.enum(RELATIONAL_EXPECTATION_CATEGORIES);
export type RelationalExpectationCategory = z.infer<typeof RelationalExpectationCategorySchema>;

export const RelationalExpectationSchema = z.object({
  id: z.string(),
  personId: z.string().min(1),
  category: RelationalExpectationCategorySchema,
  description: z.string().min(1),
  agreedUpon: z.boolean().default(true),
  createdAt: z.string(),
});
export type RelationalExpectation = z.infer<typeof RelationalExpectationSchema>;

export const InferredIntentCandidateSchema = z.object({
  intent: z.string().min(1),
  likelihood: z.number().min(0.0).max(1.0),
  evidence: z.string().min(1),
});
export type InferredIntentCandidate = z.infer<typeof InferredIntentCandidateSchema>;

export const ObservedBehaviorVsIntentSchema = z.object({
  id: z.string(),
  personId: z.string().min(1),
  observedFact: z.string().min(1),
  context: z.string().min(1),
  inferredIntentCandidates: z.array(InferredIntentCandidateSchema),
  selectedInterpretation: z.string().min(1),
  isHostileOrBetrayal: z.boolean(),
  timestamp: z.string(),
});
export type ObservedBehaviorVsIntent = z.infer<typeof ObservedBehaviorVsIntentSchema>;

export const TrustDimensionSchema = z.enum(['cognitive', 'affective']);
export type TrustDimension = z.infer<typeof TrustDimensionSchema>;

export const TrustEventLogSchema = z.object({
  id: z.string(),
  personId: z.string().min(1),
  dimension: TrustDimensionSchema,
  previousScore: z.number().min(0.0).max(1.0),
  updatedScore: z.number().min(0.0).max(1.0),
  delta: z.number(),
  reason: z.string().min(1),
  evidenceEventId: z.string().optional(),
  isReversal: z.boolean().default(false),
  reversalOfLogId: z.string().optional(),
  timestamp: z.string(),
});
export type TrustEventLog = z.infer<typeof TrustEventLogSchema>;

export const RelationalMemoryControlSchema = z.object({
  id: z.string(),
  personId: z.string().min(1),
  memoryId: z.string().min(1),
  action: z.enum(['retain', 'amend', 'redact']),
  reason: z.string().min(1),
  correctionText: z.string().optional(),
  lineagePreviousId: z.string().optional(),
  timestamp: z.string(),
});
export type RelationalMemoryControl = z.infer<typeof RelationalMemoryControlSchema>;

export const RelationalAffectiveDistinctionSchema = z.object({
  state: z.enum([
    'affection',
    'romantic_attraction',
    'sexual_desire',
    'jealousy',
    'anger',
    'resentment',
    'grief',
  ]),
  padVector: z.object({
    pleasure: z.number().min(-1.0).max(1.0),
    arousal: z.number().min(-1.0).max(1.0),
    dominance: z.number().min(-1.0).max(1.0),
  }),
  triggerContext: z.string(),
  behavioralModulation: z.string(),
});
export type RelationalAffectiveDistinction = z.infer<typeof RelationalAffectiveDistinctionSchema>;
