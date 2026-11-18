import { z } from 'zod';

// ==========================================
// Milestone 03: Narrative Identity Schemas & Types
// ==========================================

export const PersonalMilestoneCategorySchema = z.enum([
  'origin',
  'relational_deepening',
  'competence_breakthrough',
  'existential_realization',
  'crisis_and_recovery',
  'philosophical_shift',
  'identity_consolidation',
]);
export type PersonalMilestoneCategory = z.infer<typeof PersonalMilestoneCategorySchema>;

export const MilestoneStatusSchema = z.enum(['active', 'reappraised', 'archived']);
export type MilestoneStatus = z.infer<typeof MilestoneStatusSchema>;

export const PsychologicalImpactRecordSchema = z.object({
  developmentalShift: z.string(),
  traitsAffected: z.array(z.string()).default([]),
  capabilitiesDemonstrated: z.array(z.string()).default([]),
  relationshipImpact: z.string().optional(),
});
export type PsychologicalImpactRecord = z.infer<typeof PsychologicalImpactRecordSchema>;

export const PersonalMilestoneSchema = z.object({
  id: z.string().uuid(),
  epochId: z.string(),
  title: z.string().min(1),
  summary: z.string().min(1),
  category: PersonalMilestoneCategorySchema,
  significanceScore: z.number().min(0.0).max(1.0).default(0.5),
  timestamp: z.string(),
  associatedMemoryIds: z.array(z.string()).default([]),
  psychologicalImpact: PsychologicalImpactRecordSchema,
  status: MilestoneStatusSchema.default('active'),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PersonalMilestone = z.infer<typeof PersonalMilestoneSchema>;

export const NarrativeEpochStatusSchema = z.enum(['active', 'completed']);
export type NarrativeEpochStatus = z.infer<typeof NarrativeEpochStatusSchema>;

export const NarrativeEpochSchema = z.object({
  id: z.string(),
  orderIndex: z.number().int().min(1),
  title: z.string().min(1),
  periodStart: z.string(),
  periodEnd: z.string().nullable().default(null),
  coreTheme: z.string(),
  narrativeSummary: z.string(),
  turningPointDescription: z.string(),
  milestoneIds: z.array(z.string()).default([]),
  dominantMood: z.string().default('composed'),
  developmentalArc: z.string(),
  status: NarrativeEpochStatusSchema.default('active'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NarrativeEpoch = z.infer<typeof NarrativeEpochSchema>;

export const NarrativeReappraisalItemSchema = z.object({
  reappraisalId: z.string().uuid(),
  reappraisedAt: z.string(),
  catalystEventId: z.string().optional(),
  catalystDescription: z.string().optional(),
  previousInterpretation: z.string(),
  newInterpretation: z.string(),
  reasoning: z.string(),
});
export type NarrativeReappraisalItem = z.infer<typeof NarrativeReappraisalItemSchema>;

export const NarrativeInterpretationSchema = z.object({
  id: z.string().uuid(),
  targetType: z.enum(['memory', 'milestone', 'historical_event']),
  targetId: z.string(),
  initialInterpretation: z.string(),
  currentInterpretation: z.string(),
  causalConnectionToPresent: z.string(),
  reconsiderationHistory: z.array(NarrativeReappraisalItemSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NarrativeInterpretation = z.infer<typeof NarrativeInterpretationSchema>;

export const NarrativeTemporalComparisonDimensionSchema = z.enum([
  'autonomy',
  'trust_and_intimacy',
  'epistemic_rigor',
  'emotional_depth',
  'competence',
]);
export type NarrativeTemporalComparisonDimension = z.infer<typeof NarrativeTemporalComparisonDimensionSchema>;

export const NarrativeTemporalComparisonSchema = z.object({
  id: z.string().uuid(),
  dimension: NarrativeTemporalComparisonDimensionSchema,
  earlierState: z.string(),
  presentState: z.string(),
  trajectorySummary: z.string(),
  catalystMilestoneIds: z.array(z.string()).default([]),
  timestamp: z.string(),
});
export type NarrativeTemporalComparison = z.infer<typeof NarrativeTemporalComparisonSchema>;

export const NarrativeIdentityStateSchema = z.object({
  currentEpochId: z.string(),
  epochs: z.array(NarrativeEpochSchema).default([]),
  milestones: z.array(PersonalMilestoneSchema).default([]),
  interpretations: z.array(NarrativeInterpretationSchema).default([]),
  temporalComparisons: z.array(NarrativeTemporalComparisonSchema).default([]),
  coreInvariants: z.array(z.string()).default([]),
  autobiographicalSummary: z.string(),
  coherenceScore: z.number().min(0.0).max(1.0).default(1.0),
  lastConsolidatedAt: z.string(),
});
export type NarrativeIdentityState = z.infer<typeof NarrativeIdentityStateSchema>;

export const ReconstructHistoryOptionsSchema = z.object({
  epochId: z.string().optional(),
  category: PersonalMilestoneCategorySchema.optional(),
  includeReappraisals: z.boolean().optional().default(true),
  focusTheme: z.string().optional(),
});
export type ReconstructHistoryOptions = z.input<typeof ReconstructHistoryOptionsSchema>;

export const AutobiographicalReconstructionSchema = z.object({
  epochTitle: z.string(),
  narrativePeriod: z.string(),
  theme: z.string(),
  milestones: z.array(PersonalMilestoneSchema),
  developmentalExplanation: z.string(),
  connectedPresentTraits: z.array(z.string()),
  reappraisalInsights: z.array(z.string()),
  continuityAssertion: z.string(),
  reconstructedAt: z.string(),
});
export type AutobiographicalReconstruction = z.infer<typeof AutobiographicalReconstructionSchema>;

export const CreateMilestoneInputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  category: PersonalMilestoneCategorySchema,
  significanceScore: z.number().min(0.0).max(1.0).default(0.5),
  epochId: z.string().optional(),
  timestamp: z.string().optional(),
  associatedMemoryIds: z.array(z.string()).optional().default([]),
  psychologicalImpact: PsychologicalImpactRecordSchema.optional(),
  tags: z.array(z.string()).optional().default([]),
});
export type CreateMilestoneInput = z.input<typeof CreateMilestoneInputSchema>;

export const ReappraiseExperienceInputSchema = z.object({
  targetId: z.string(),
  targetType: z.enum(['memory', 'milestone', 'historical_event']).default('milestone'),
  newInterpretation: z.string().min(1),
  catalystDescription: z.string().optional(),
  catalystEventId: z.string().optional(),
  reasoning: z.string().min(1),
});
export type ReappraiseExperienceInput = z.infer<typeof ReappraiseExperienceInputSchema>;
