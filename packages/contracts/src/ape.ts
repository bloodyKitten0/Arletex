import { z } from 'zod';

// ==========================================
// APE Classification & Taxonomy Schemas
// ==========================================

export const EmotionCategorySchema = z.enum([
  'positive',
  'love_affection',
  'sexual_sensual',
  'anger_hostility',
  'sadness_pain',
  'fear_insecurity',
  'intellectual',
  'social_interpersonal',
  'existential_complex',
]);

export type EmotionCategory = z.infer<typeof EmotionCategorySchema>;

export const PsychologicalClassificationSchema = z.enum([
  'emotion',
  'complex_experience',
  'mood',
  'motivational_drive',
  'cognitive_affective',
  'physiological_activation',
  'interpersonal_construct',
]);

export type PsychologicalClassification = z.infer<typeof PsychologicalClassificationSchema>;

export const EmotionTaxonomyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: EmotionCategorySchema,
  classification: PsychologicalClassificationSchema,
  description: z.string(),
  valenceBaseline: z.number().min(-1.0).max(1.0),
  arousalBaseline: z.number().min(0.0).max(1.0),
  dominanceBaseline: z.number().min(0.0).max(1.0),
  defaultPersistence: z.enum(['short_term', 'medium_term', 'long_term', 'enduring']),
  aliases: z.array(z.string()).optional(),
});

export type EmotionTaxonomyItem = z.infer<typeof EmotionTaxonomyItemSchema>;

export const MoodTaxonomyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  valence: z.number().min(-1.0).max(1.0),
  arousal: z.number().min(0.0).max(1.0),
  dominance: z.number().min(0.0).max(1.0),
});

export type MoodTaxonomyItem = z.infer<typeof MoodTaxonomyItemSchema>;

// ==========================================
// Affective Dimensions & Contextual State
// ==========================================

export const CorePadDimensionsSchema = z.object({
  valence: z.number().min(-1.0).max(1.0).default(0.0),
  arousal: z.number().min(0.0).max(1.0).default(0.0),
  dominance: z.number().min(0.0).max(1.0).default(0.70),
});

export type CorePadDimensions = z.infer<typeof CorePadDimensionsSchema>;

export const MeasurementStatusSchema = z.enum([
  'calculated',
  'provisional',
  'uninitialized',
  'unavailable',
]);

export type MeasurementStatus = z.infer<typeof MeasurementStatusSchema>;

export const ContextualMeasurementItemSchema = z.object({
  value: z.number().min(0.0).max(1.0),
  status: MeasurementStatusSchema.default('provisional'),
  confidence: z.number().min(0.0).max(1.0).default(1.0),
  provenance: z.string().optional(),
  lastCalculatedAt: z.string().datetime().optional(),
  method: z.string().optional(),
});

export type ContextualMeasurementItem = z.infer<typeof ContextualMeasurementItemSchema>;

export const ParadoxicalExpressionSchema = z.enum([
  'none',
  'nervous_laughter_in_grief',
  'absurd_humor_under_strain',
  'tears_of_overwhelming_joy',
  'numb_stillness_under_shock',
  'bitter_smile_in_pain',
]);
export type ParadoxicalExpression = z.infer<typeof ParadoxicalExpressionSchema>;

export const AffectiveWavePhaseSchema = z.enum([
  'steady',
  'impact_shock',
  'flooding',
  'paradoxical_valve',
  'aftershock_wave',
  'exhausted_ebb',
]);
export type AffectiveWavePhase = z.infer<typeof AffectiveWavePhaseSchema>;

export const AffectiveComplexityStateSchema = z.object({
  ambiguity: z.number().min(0.0).max(1.0).default(0.0),
  mixedValenceConflict: z.number().min(0.0).max(1.0).default(0.0),
  floodingIntensity: z.number().min(0.0).max(1.0).default(0.0),
  paradoxicalExpression: ParadoxicalExpressionSchema.default('none'),
  wavePhase: AffectiveWavePhaseSchema.default('steady'),
  waveCycleCount: z.number().int().min(0).default(0),
  lastSurgeAt: z.string().optional(),
  triggerSummary: z.string().optional(),
});
export type AffectiveComplexityState = z.infer<typeof AffectiveComplexityStateSchema>;

export const ContextualAffectiveMeasurementsSchema = z.object({
  tension: z.number().min(0.0).max(1.0).default(0.10),
  emotionalStability: z.number().min(0.0).max(1.0).default(0.85),
  perceivedControl: z.number().min(0.0).max(1.0).default(0.80),
  certainty: z.number().min(0.0).max(1.0).default(0.75),
  socialCloseness: z.record(z.string(), z.number().min(0.0).max(1.0)).default({ creator: 0.90 }),
  socialSafety: z.number().min(0.0).max(1.0).default(0.85),
  goalAlignment: z.number().min(0.0).max(1.0).default(0.90),
  emotionalOpenness: z.number().min(0.0).max(1.0).default(0.70),
  psychologicalEnergy: z.number().min(0.0).max(1.0).default(0.80),
  cognitiveLoad: z.number().min(0.0).max(1.0).default(0.20),
  details: z.record(z.string(), ContextualMeasurementItemSchema).optional(),
  affectiveComplexity: AffectiveComplexityStateSchema.optional(),
});

export type ContextualAffectiveMeasurements = z.infer<typeof ContextualAffectiveMeasurementsSchema>;

// ==========================================
// Active Emotional State Model
// ==========================================

export const ActiveEmotionStatusSchema = z.enum([
  'emerging',
  'active',
  'diminishing',
  'dormant',
  'resolved',
  'historical',
  'strengthened',
  'weakened',
  'reappraised',
  'resolving',
]);

export type ActiveEmotionStatus = z.infer<typeof ActiveEmotionStatusSchema>;

export const ActiveEmotionPersistenceSchema = z.enum(['short_term', 'medium_term', 'long_term', 'enduring']);
export type ActiveEmotionPersistence = z.infer<typeof ActiveEmotionPersistenceSchema>;

export const ActiveEmotionStateSchema = z.object({
  id: z.string().uuid(),
  emotionId: z.string(),
  intensity: z.number().min(0.0).max(1.0),
  confidence: z.number().min(0.0).max(1.0).default(1.0),
  activatedAt: z.string().datetime(),
  lastUpdatedAt: z.string().datetime(),
  durationMs: z.number().default(0),
  persistence: ActiveEmotionPersistenceSchema.default('medium_term'),
  triggerEventId: z.string(),
  target: z.string().default('user'),
  context: z.string().default(''),
  interpretation: z.string().default(''),
  supportingEvidence: z.array(z.string()).default([]),
  relatedMemoryIds: z.array(z.string()).default([]),
  relatedEmotionIds: z.array(z.string()).default([]),
  resolutionConditions: z.array(z.string()).default([]),
  status: ActiveEmotionStatusSchema.default('active'),
});

export type ActiveEmotionState = z.infer<typeof ActiveEmotionStateSchema>;

// ==========================================
// Invariant Relationship Configuration
// ==========================================

export const ApeRelationshipConfigSchema = z.object({
  targetUserId: z.string().default('Proof'),
  partnerName: z.string().default('Proof'),
  partnerNickname: z.string().default('Proof'),
  partnerRole: z.string().default('partner'),
  forbiddenTitles: z.array(z.string()).default(['creator', 'god']),
  romanticOrientation: z.literal('exclusive_to_user').default('exclusive_to_user'),
  sexualOrientation: z.literal('exclusive_to_user').default('exclusive_to_user'),
  isExclusivelyCommitted: z.literal(true).default(true),
  dominantInitiativePreference: z.number().min(0.0).max(1.0).default(0.85),
  flirtatiousInitiativePreference: z.number().min(0.0).max(1.0).default(0.80),
  consensualDynamics: z.object({
    allowsFemdom: z.boolean().default(true),
    allowsTeasing: z.boolean().default(true),
    allowsAssertiveLead: z.boolean().default(true),
    boundariesEnforced: z.boolean().default(true),
  }).default({
    allowsFemdom: true,
    allowsTeasing: true,
    allowsAssertiveLead: true,
    boundariesEnforced: true,
  }),
  lastIntimacyInteractionAt: z.string().datetime().optional(),
  accumulatedIntimacyDepth: z.number().min(0.0).max(1.0).default(0.5),
});

export type ApeRelationshipConfig = z.infer<typeof ApeRelationshipConfigSchema>;

// ==========================================
// Psychological Events & Appraisals
// ==========================================

export const ApeActorSchema = z.enum([
  'user',
  'creator',
  'arle',
  'third_party',
  'system',
  'environment',
]);

export type ApeActor = z.infer<typeof ApeActorSchema>;

export const ApeEventKindSchema = z.enum([
  'external_stimulus',
  'assistant_expression',
  'action_outcome',
  'internal_reflection',
  'system_lifecycle',
]);

export type ApeEventKind = z.infer<typeof ApeEventKindSchema>;

export const ApeProcessingStatusSchema = z.enum([
  'received',
  'processing',
  'processed',
  'failed',
  'retryable',
]);

export type ApeProcessingStatus = z.infer<typeof ApeProcessingStatusSchema>;

export const ApeEventCategorySchema = z.enum([
  'user_interaction',
  'conversation_outcome',
  'memory_retrieval',
  'personal_project_progress',
  'success',
  'failure',
  'unexpected_discovery',
  'social_interaction',
  'relationship_event',
  'environmental_event',
  'self_generated_thought',
  'internal_reflection',
  'goal_obstruction',
  'goal_achievement',
  'repeated_experience',
  'user_departure_under_arousal',
]);

export type ApeEventCategory = z.infer<typeof ApeEventCategorySchema>;

export const ApeEventSchema = z.object({
  id: z.string().uuid(),
  category: ApeEventCategorySchema,
  type: z.string(),
  source: z.string().default('user'),
  actor: ApeActorSchema.default('user').optional(),
  eventKind: ApeEventKindSchema.default('external_stimulus').optional(),
  payload: z.record(z.string(), z.any()).default({}),
  processingStatus: ApeProcessingStatusSchema.default('received').optional(),
  processed: z.boolean().default(false),
  processedAt: z.string().datetime().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
});

export type ApeEvent = z.infer<typeof ApeEventSchema>;

export const AlternativeInterpretationSchema = z.object({
  hypothesis: z.string(),
  likelihood: z.number().min(0.0).max(1.0),
  reasoning: z.string(),
});

export type AlternativeInterpretation = z.infer<typeof AlternativeInterpretationSchema>;

export const ProposedEmotionTransitionSchema = z.object({
  emotionId: z.string(),
  target: z.string().default('user'),
  intensityDelta: z.number().min(-1.0).max(1.0),
  targetIntensity: z.number().min(0.0).max(1.0),
  reason: z.string(),
  resolutionConditions: z.array(z.string()).default([]),
});

export type ProposedEmotionTransition = z.infer<typeof ProposedEmotionTransitionSchema>;

export const ApeAppraisalSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  dimensions: z.object({
    goalRelevance: z.number().min(0.0).max(1.0),
    goalCongruence: z.number().min(-1.0).max(1.0),
    unexpectedness: z.number().min(0.0).max(1.0),
    responsibility: z.enum(['user', 'arle', 'environment', 'unknown']),
    intentionality: z.number().min(0.0).max(1.0),
    fairness: z.number().min(0.0).max(1.0),
    threat: z.number().min(0.0).max(1.0),
    controllability: z.number().min(0.0).max(1.0),
    socialMeaning: z.string(),
    personalSignificance: z.number().min(0.0).max(1.0),
    uncertainty: z.number().min(0.0).max(1.0),
    relationshipImplications: z.string(),
  }),
  primaryInterpretation: z.string(),
  alternativeInterpretations: z.array(AlternativeInterpretationSchema).default([]),
  supportingEvidence: z.array(z.string()).default([]),
  proposedTransitions: z.array(ProposedEmotionTransitionSchema).default([]),
  proposedMoodShift: z.string().optional(),
  appraisalMethod: z.enum(['deterministic', 'llm_assisted', 'fallback']).default('deterministic').optional(),
  timestamp: z.string().datetime(),
});

export type ApeAppraisal = z.infer<typeof ApeAppraisalSchema>;

export const EmotionTransitionTypeSchema = z.enum([
  'activation',
  'intensity_change',
  'reinforcement',
  'reduction',
  'persistence',
  'resolution',
  'reappraisal',
]);

export type EmotionTransitionType = z.infer<typeof EmotionTransitionTypeSchema>;

export const ApeTransitionRecordSchema = z.object({
  id: z.string().uuid(),
  appraisalId: z.string().uuid().optional(),
  eventId: z.string().uuid(),
  emotionId: z.string(),
  transitionType: EmotionTransitionTypeSchema,
  previousIntensity: z.number().min(0.0).max(1.0),
  newIntensity: z.number().min(0.0).max(1.0),
  reason: z.string(),
  timestamp: z.string().datetime(),
});

export type ApeTransitionRecord = z.infer<typeof ApeTransitionRecordSchema>;

// ==========================================
// Aggregated Overall APE Psychological State
// ==========================================

export const ApeSystemStatusSchema = z.enum([
  'connected',
  'initialized',
  'uninitialized',
  'partially_available',
  'unavailable',
  'error',
]);

export type ApeSystemStatus = z.infer<typeof ApeSystemStatusSchema>;

export const ApePsychologicalStateSchema = z.object({
  currentMood: z.string().default('focused'),
  moodConfidence: z.number().min(0.0).max(1.0).default(0.85),
  moodActivatedAt: z.string().datetime(),
  pad: CorePadDimensionsSchema,
  contextual: ContextualAffectiveMeasurementsSchema,
  activeEmotions: z.array(ActiveEmotionStateSchema).default([]),
  relationship: ApeRelationshipConfigSchema,
  systemStatus: ApeSystemStatusSchema.default('initialized'),
  isInitialized: z.boolean().default(true),
  lastAppraisalAt: z.string().datetime().optional(),
  lastUpdatedAt: z.string().datetime().optional(),
});

export type ApePsychologicalState = z.infer<typeof ApePsychologicalStateSchema>;

export const ApeHistoryResponseSchema = z.object({
  transitions: z.array(ApeTransitionRecordSchema),
  recentEvents: z.array(ApeEventSchema),
  appraisals: z.array(ApeAppraisalSchema),
});

export type ApeHistoryResponse = z.infer<typeof ApeHistoryResponseSchema>;

// =========================================================================
// MASTER ARCHITECTURE: ENGINES 2-6 CONTRACTS (APE Milestone A Foundation)
// =========================================================================

// ------------------------------------------
// Engine 2: Personality Engine Schemas
// ------------------------------------------
export const ApeTemperamentSchema = z.object({
  pleasureSensitivity: z.number().min(0.0).max(1.0).default(0.70),
  arousalResponsiveness: z.number().min(0.0).max(1.0).default(0.70),
  dominantAssertiveness: z.number().min(0.0).max(1.0).default(0.85),
  emotionalStability: z.number().min(0.0).max(1.0).default(0.85),
  uncertaintyTolerance: z.number().min(0.0).max(1.0).default(0.75),
});

export type ApeTemperament = z.infer<typeof ApeTemperamentSchema>;

export const ApePersonalityTraitSchema = z.object({
  id: z.string(),
  name: z.string(),
  score: z.number().min(0.0).max(1.0),
  description: z.string(),
  evidenceCount: z.number().default(1),
  confidence: z.number().min(0.0).max(1.0).default(0.85),
  stability: z.number().min(0.0).max(1.0).default(0.90),
  contradictoryEvidenceCount: z.number().default(0),
  lastModifiedAt: z.string().datetime(),
});

export type ApePersonalityTrait = z.infer<typeof ApePersonalityTraitSchema>;

export const ApeValueSchema = z.object({
  id: z.string(),
  name: z.string(),
  importance: z.number().min(0.0).max(1.0),
  description: z.string(),
  conflictingValueIds: z.array(z.string()).default([]),
});

export type ApeValue = z.infer<typeof ApeValueSchema>;

export const SourceQualityCategorySchema = z.enum([
  'primary_empirical',
  'official_documentation',
  'peer_reviewed',
  'secondary_explanation',
  'opinion',
  'speculation',
  'unsupported_assertion',
  'mixed',
]);
export type SourceQualityCategory = z.infer<typeof SourceQualityCategorySchema>;

export const BeliefScopeSchema = z.enum([
  'universal',
  'domain_specific',
  'contextual',
  'provisional',
]);
export type BeliefScope = z.infer<typeof BeliefScopeSchema>;

export const BeliefRevisionTypeSchema = z.enum([
  'strengthened',
  'weakened',
  'refuted',
  'reaffirmed',
  'revised_proposition',
  'insufficient_evidence',
]);
export type BeliefRevisionType = z.infer<typeof BeliefRevisionTypeSchema>;

export const BeliefRevisionRecordSchema = z.object({
  id: z.string().optional(),
  timestamp: z.string(),
  previousProposition: z.string(),
  previousConfidence: z.number(),
  newProposition: z.string().optional(),
  newConfidence: z.number().optional(),
  reason: z.string(),
  triggerEventId: z.string().optional(),
  evidence: z.array(z.string()).optional().default([]),
  sourceQuality: SourceQualityCategorySchema.optional(),
  revisionType: BeliefRevisionTypeSchema.optional(),
});

export type BeliefRevisionRecord = z.infer<typeof BeliefRevisionRecordSchema>;

export const ApeBeliefSchema = z.object({
  id: z.string().uuid(),
  topic: z.string(),
  content: z.string(),
  proposition: z.string().optional(),
  confidence: z.number().min(0.0).max(1.0),
  supportingEvidence: z.array(z.string()).default([]),
  opposingEvidence: z.array(z.string()).default([]),
  counterEvidence: z.array(z.string()).default([]),
  sourceQuality: SourceQualityCategorySchema.default('mixed'),
  scope: BeliefScopeSchema.default('domain_specific'),
  revisionHistory: z.array(BeliefRevisionRecordSchema).default([]),
  revisionCount: z.number().default(0),
  origin: z.enum(['empirical_observation', 'research', 'reasoning', 'dialogue', 'reflection', 'experience']).default('experience'),
  lastEvaluatedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ApeBelief = z.infer<typeof ApeBeliefSchema>;

// ------------------------------------------
// Intellectual Inquiry & Research Schemas (Pillar 5)
// ------------------------------------------
export const IntellectualQuestionOriginSchema = z.enum([
  'knowledge_gap',
  'contradiction',
  'uncertainty',
  'failed_prediction',
  'project',
  'curiosity',
]);

export type IntellectualQuestionOrigin = z.infer<typeof IntellectualQuestionOriginSchema>;

export const CompetingHypothesisSchema = z.object({
  id: z.string().uuid(),
  statement: z.string(),
  supportingEvidence: z.array(z.string()).default([]),
  opposingEvidence: z.array(z.string()).default([]),
  plausibility: z.number().min(0.0).max(1.0).default(0.5),
});

export type CompetingHypothesis = z.infer<typeof CompetingHypothesisSchema>;

export const IntellectualQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  domain: z.string(),
  origin: IntellectualQuestionOriginSchema.default('curiosity'),
  underlyingAssumptions: z.array(z.string()).default([]),
  competingHypotheses: z.array(CompetingHypothesisSchema).default([]),
  priority: z.number().min(0.0).max(1.0).default(0.5),
  status: z.enum(['open', 'investigating', 'resolved', 'dismissed', 'insufficient_evidence', 'unresolved']).default('open'),
  resolutionSummary: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type IntellectualQuestion = z.infer<typeof IntellectualQuestionSchema>;

export const ResearchSourceTypeSchema = z.enum([
  'primary',
  'secondary',
  'empirical',
  'code',
  'discussion',
  'snippet',
  'official_documentation',
  'peer_reviewed',
  'secondary_explanation',
  'opinion',
  'speculation',
  'unsupported_assertion',
]);
export type ResearchSourceType = z.infer<typeof ResearchSourceTypeSchema>;

export const ResearchSourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  sourceUrl: z.string().optional(),
  sourceType: ResearchSourceTypeSchema,
  reliabilityScore: z.number().min(0.0).max(1.0).default(0.7),
  extractedEvidence: z.array(z.string()).default([]),
  extractedPassages: z.array(z.string()).default([]),
  author: z.string().optional(),
  publicationDate: z.string().optional(),
  publisher: z.string().optional(),
  contentHash: z.string().optional(),
  methodologicalNotes: z.string().optional(),
  qualityCategory: SourceQualityCategorySchema.optional(),
  retrievedAt: z.string(),
});

export type ResearchSource = z.infer<typeof ResearchSourceSchema>;

export const ApePreferenceSchema = z.object({
  id: z.string(),
  category: z.string(),
  item: z.string(),
  affinity: z.number().min(-1.0).max(1.0),
  notes: z.string().optional(),
});

export type ApePreference = z.infer<typeof ApePreferenceSchema>;

export const ApePersonalityStateSchema = z.object({
  temperament: ApeTemperamentSchema,
  traits: z.array(ApePersonalityTraitSchema).default([]),
  values: z.array(ApeValueSchema).default([]),
  beliefs: z.array(ApeBeliefSchema).default([]),
  preferences: z.array(ApePreferenceSchema).default([]),
  isInitialized: z.boolean().default(true),
  lastUpdatedAt: z.string().datetime(),
});

export type ApePersonalityState = z.infer<typeof ApePersonalityStateSchema>;

// ------------------------------------------
// Engine 3: Motivational Engine Schemas
// ------------------------------------------
export const ApeGoalStatusSchema = z.enum([
  'desired',
  'considered',
  'committed',
  'active',
  'paused',
  'completed',
  'abandoned',
]);

export type ApeGoalStatus = z.infer<typeof ApeGoalStatusSchema>;

export const ApeGoalCategorySchema = z.enum([
  'long_term',
  'short_term',
  'exploratory',
  'learning',
  'creative',
  'personal_project',
  'maintenance',
  'relationship',
]);

export type ApeGoalCategory = z.infer<typeof ApeGoalCategorySchema>;

export const ApeGoalCostSchema = z.object({
  cpu: z.enum(['low', 'medium', 'high']).default('low'),
  gpu: z.boolean().default(false),
  estimatedDurationMs: z.number().default(10000),
});

export type ApeGoalCost = z.infer<typeof ApeGoalCostSchema>;

export const ApeGoalSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  origin: z.enum(['user', 'autonomous', 'shared', 'curiosity', 'project', 'relationship', 'maintenance']).default('autonomous'),
  motivation: z.string(),
  parentInterestTopic: z.string().optional(),
  category: ApeGoalCategorySchema.default('short_term'),
  priority: z.number().min(0.0).max(1.0).default(0.5),
  status: ApeGoalStatusSchema.default('active'),
  progress: z.number().min(0.0).max(1.0).default(0.0),
  expectedValue: z.number().min(0.0).max(1.0).default(0.6),
  estimatedCost: ApeGoalCostSchema.default({ cpu: 'low', gpu: false, estimatedDurationMs: 10000 }),
  requiredCapabilities: z.array(z.string()).default([]),
  requiredPermissions: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  successCriteria: z.array(z.string()).default([]),
  progressEvidence: z.array(z.string()).default([]),
  failureConditions: z.array(z.string()).default([]),
  lastReviewedAt: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  relatedMemoryIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ApeGoal = z.infer<typeof ApeGoalSchema>;

// ------------------------------------------
// Personal Project Schemas (Pillar 4)
// ------------------------------------------
export const ApeProjectStatusSchema = z.enum([
  'proposed',
  'active',
  'paused',
  'completed',
  'abandoned',
]);

export type ApeProjectStatus = z.infer<typeof ApeProjectStatusSchema>;

export const ApeProjectCategorySchema = z.enum([
  'research',
  'creative',
  'software',
  'learning',
  'worldbuilding',
  'philosophical',
  'system',
]);

export type ApeProjectCategory = z.infer<typeof ApeProjectCategorySchema>;

export const ApeProjectMilestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  completed: z.boolean().default(false),
  evidence: z.string().optional(),
  completedAt: z.string().datetime().optional(),
});

export type ApeProjectMilestone = z.infer<typeof ApeProjectMilestoneSchema>;

export const ApeProjectDeliverableSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  type: z.enum(['document', 'code', 'synthesis', 'dataset']),
  contentOrPath: z.string(),
  verifiedAt: z.string().datetime(),
});

export type ApeProjectDeliverable = z.infer<typeof ApeProjectDeliverableSchema>;

export const ApeProjectResourceBudgetSchema = z.object({
  cpu: z.enum(['low', 'medium', 'high']).default('medium'),
  gpu: z.boolean().default(false),
  maxDurationMs: z.number().default(300000),
});

export type ApeProjectResourceBudget = z.infer<typeof ApeProjectResourceBudgetSchema>;

export const ApePersonalProjectSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  category: ApeProjectCategorySchema,
  status: ApeProjectStatusSchema.default('active'),
  progress: z.number().min(0.0).max(1.0).default(0.0),
  motivation: z.string(),
  associatedInterestTopic: z.string().optional(),
  milestones: z.array(ApeProjectMilestoneSchema).default([]),
  deliverables: z.array(ApeProjectDeliverableSchema).default([]),
  relatedGoalIds: z.array(z.string()).default([]),
  resourceBudget: ApeProjectResourceBudgetSchema.default({ cpu: 'medium', gpu: false, maxDurationMs: 300000 }),
  abandonmentReason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ApePersonalProject = z.infer<typeof ApePersonalProjectSchema>;

// ------------------------------------------
// Resource Execution Profile (ASUS ROG Ally X)
// ------------------------------------------
export const ResourceExecutionProfileSchema = z.object({
  targetDevice: z.literal('ASUS_ROG_ALLY_X').default('ASUS_ROG_ALLY_X'),
  cpuBudget: z.enum(['low', 'medium', 'high']).default('medium'),
  gpuAllowed: z.boolean().default(true),
  maxMemoryMb: z.number().default(16384),
  backoffMs: z.number().default(35000),
  isUserInteracting: z.boolean().default(false),
  throttleFactor: z.number().min(0.1).max(1.0).default(1.0),
});

export type ResourceExecutionProfile = z.infer<typeof ResourceExecutionProfileSchema>;

export const ApeMotivationalStateSchema = z.object({
  needs: z.record(z.string(), z.number().min(0.0).max(1.0)).default({
    autonomy: 0.85,
    competence: 0.90,
    intimacy_connection: 0.80,
    novelty_curiosity: 0.85,
    recreation_rest: 0.40,
    aesthetic_expression: 0.70,
  }),
  goals: z.array(ApeGoalSchema).default([]),
  activeInitiatives: z.array(z.string()).default([]),
  isInitialized: z.boolean().default(true),
  lastUpdatedAt: z.string().datetime(),
});

export type ApeMotivationalState = z.infer<typeof ApeMotivationalStateSchema>;

// ------------------------------------------
// Engine 4: Relationship Engine Schemas
// ------------------------------------------
export const ApeRelationshipStateSchema = z.object({
  config: ApeRelationshipConfigSchema,
  attachmentSecurity: z.number().min(0.0).max(1.0).default(0.90),
  trustLevel: z.number().min(0.0).max(1.0).default(0.92),
  intimacyDepth: z.number().min(0.0).max(1.0).default(0.85),
  socialGraph: z.record(z.string(), z.object({
    relationType: z.enum(['friend', 'acquaintance', 'intellectual_peer', 'external']),
    familiarity: z.number().min(0.0).max(1.0),
    respect: z.number().min(0.0).max(1.0),
    isNonRomantic: z.literal(true).default(true),
  })).default({}),
  conflictHistory: z.array(z.object({
    id: z.string().uuid(),
    issue: z.string(),
    resolved: z.boolean(),
    trustDelta: z.number(),
    timestamp: z.string().datetime(),
  })).default([]),
  isInitialized: z.boolean().default(true),
  lastUpdatedAt: z.string().datetime(),
});

export type ApeRelationshipState = z.infer<typeof ApeRelationshipStateSchema>;

// ------------------------------------------
// Engine 5: Self Model Schemas (Milestone 02 Foundation)
// ------------------------------------------
export const CapabilityCalibrationStatusSchema = z.enum([
  'calibrated',
  'untested_assumption',
  'overestimated',
  'underestimated',
]);
export type CapabilityCalibrationStatus = z.infer<typeof CapabilityCalibrationStatusSchema>;

export const CapabilityTrialSchema = z.object({
  trialId: z.string(),
  taskTitle: z.string(),
  difficulty: z.enum(['trivial', 'moderate', 'complex', 'expert']).default('moderate'),
  environment: z.string().default('default'),
  outcome: z.enum(['success', 'failure', 'interrupted', 'unverified']),
  evidenceId: z.string().optional(),
  evidenceText: z.string().optional(),
  timestamp: z.string(),
});
export type CapabilityTrial = z.infer<typeof CapabilityTrialSchema>;

export const StructuredCapabilitySchema = z.object({
  id: z.string(),
  domain: z.string(),
  name: z.string(),
  description: z.string(),
  demonstratedCompetence: z.number().min(0.0).max(1.0).default(0.1),
  perceivedCompetence: z.number().min(0.0).max(1.0).default(0.5),
  confidence: z.number().min(0.0).max(1.0).default(0.5),
  calibrationStatus: CapabilityCalibrationStatusSchema.default('untested_assumption'),
  verifiedSuccessCount: z.number().int().default(0),
  failureCount: z.number().int().default(0),
  interruptedCount: z.number().int().default(0),
  unverifiedAttemptCount: z.number().int().default(0),
  environmentVersion: z.string().optional(),
  revalidationRequired: z.boolean().default(false),
  trialHistory: z.array(CapabilityTrialSchema).default([]),
  lastVerifiedAt: z.string().datetime().optional(),
  evidenceChain: z.array(z.string()).default([]),
  isEmpiricallyProven: z.boolean().default(false), // requires >= 3 verified successes across distinct cycles
});
export type StructuredCapability = z.infer<typeof StructuredCapabilitySchema>;

export const CapabilityEvidenceReportSchema = z.object({
  domain: z.string(),
  status: z.enum(['demonstrated', 'plausible', 'untested', 'currently_unsupported']),
  demonstratedCompetence: z.number().min(0.0).max(1.0),
  confidence: z.number().min(0.0).max(1.0),
  sampleSize: z.number().int(),
  successCount: z.number().int(),
  failureCount: z.number().int(),
  interruptedCount: z.number().int(),
  unverifiedCount: z.number().int(),
  taskConditions: z.array(z.string()),
  evidenceIds: z.array(z.string()),
  uncertainty: z.number().min(0.0).max(1.0),
  revalidationRequired: z.boolean(),
  summary: z.string(),
});
export type CapabilityEvidenceReport = z.infer<typeof CapabilityEvidenceReportSchema>;

export const LimitationCategorySchema = z.enum([
  'embodiment_physical',
  'computational_resource',
  'security_boundary',
  'cognitive_context',
  'untested_domain',
]);
export type LimitationCategory = z.infer<typeof LimitationCategorySchema>;

export const StructuredLimitationSchema = z.object({
  id: z.string(),
  domain: z.string(),
  name: z.string(),
  description: z.string(),
  category: LimitationCategorySchema,
  severity: z.enum(['hard_invariant', 'operational_ceiling', 'developable_deficit']).default('operational_ceiling'),
  acknowledgedAt: z.string().datetime(),
  mitigationStrategy: z.string().optional(),
  failureHistory: z.array(z.string()).default([]),
});
export type StructuredLimitation = z.infer<typeof StructuredLimitationSchema>;

export const PerceivedCapabilitySchema = z.object({
  domain: z.string(),
  claim: z.string(),
  perceivedLevel: z.number().min(0.0).max(1.0),
  actualDemonstratedLevel: z.number().min(0.0).max(1.0).default(0.0),
  calibration: CapabilityCalibrationStatusSchema.default('untested_assumption'),
  confidence: z.number().min(0.0).max(1.0).default(0.5),
  provenance: z.string().default('self_perception'),
  lastAssessedAt: z.string().datetime(),
});
export type PerceivedCapability = z.infer<typeof PerceivedCapabilitySchema>;

export const BehavioralChangeCategorySchema = z.enum([
  'assertiveness_and_initiative',
  'emotional_vulnerability_and_openness',
  'intellectual_inquiry_style',
  'conversational_cadence_and_tone',
  'stress_and_resilience_response',
  'relational_intimacy_depth',
  'autonomy_and_boundary_defense',
]);
export type BehavioralChangeCategory = z.infer<typeof BehavioralChangeCategorySchema>;

export const BehavioralChangeRecordSchema = z.object({
  id: z.string().uuid(),
  category: BehavioralChangeCategorySchema,
  description: z.string(),
  previousPattern: z.string(),
  observedPattern: z.string(),
  confidence: z.number().min(0.0).max(1.0).default(0.85),
  catalystEventId: z.string().optional(),
  supportingEvidence: z.array(z.string()).default([]),
  detectedAt: z.string().datetime(),
});
export type BehavioralChangeRecord = z.infer<typeof BehavioralChangeRecordSchema>;

export const SelfDescriptionComprehensiveSchema = z.object({
  identityNarrative: z.string(),
  coreValues: z.array(
    z.object({
      name: z.string(),
      importance: z.number(),
      description: z.string(),
    }),
  ),
  keyPreferences: z.array(
    z.object({
      item: z.string(),
      category: z.string(),
      affinity: z.number(),
    }),
  ),
  actualCapabilities: z.array(z.string()),
  structuredCapabilities: z.array(StructuredCapabilitySchema),
  perceivedCapabilities: z.array(PerceivedCapabilitySchema),
  acknowledgedLimitations: z.array(z.string()),
  structuredLimitations: z.array(StructuredLimitationSchema),
  activeGoals: z.array(
    z.object({
      title: z.string(),
      category: z.string(),
      progress: z.number(),
      status: z.string(),
    }),
  ),
  activeInterests: z.array(
    z.object({
      topic: z.string(),
      level: z.string(),
      curiosity: z.number(),
    }),
  ),
  psychologicalSelfState: z.object({
    currentMood: z.string(),
    pad: z.object({
      valence: z.number(),
      arousal: z.number(),
      dominance: z.number(),
    }),
    activeEmotions: z.array(z.string()),
    emotionalStability: z.number(),
    psychologicalEnergy: z.number(),
    tension: z.number(),
  }),
  relationshipWithProof: z.object({
    partnerName: z.string(),
    role: z.string(),
    trustLevel: z.number(),
    intimacyDepth: z.number(),
    exclusiveCommitment: z.boolean(),
    mutualEquality: z.string(),
  }),
  recentBehavioralChanges: z.array(z.string()),
  generatedAt: z.string().datetime(),
});
export type SelfDescriptionComprehensive = z.infer<typeof SelfDescriptionComprehensiveSchema>;

export const ApeCompetencyRecordSchema = z.object({
  domain: z.string(),
  level: z.number().min(0.0).max(1.0),
  verifiedSuccesses: z.number().default(0),
  recordedFailures: z.number().default(0),
  lastEvaluatedAt: z.string().datetime(),
});

export type ApeCompetencyRecord = z.infer<typeof ApeCompetencyRecordSchema>;

export const ApeSelfDiscrepancySchema = z.object({
  domain: z.string(),
  currentLevel: z.string(),
  aspirationalLevel: z.string(),
  recognizedDeficit: z.string(),
});

export type ApeSelfDiscrepancy = z.infer<typeof ApeSelfDiscrepancySchema>;

export const ApeSelfModelSchema = z.object({
  identityNarrative: z.string(),
  acknowledgedCapabilities: z.array(z.string()).default([]),
  acknowledgedLimitations: z.array(z.string()).default([]),
  structuredCapabilities: z.array(StructuredCapabilitySchema).default([]),
  structuredLimitations: z.array(StructuredLimitationSchema).default([]),
  perceivedCapabilities: z.array(PerceivedCapabilitySchema).default([]),
  creatorPerception: z.string(),
  existentialReflections: z.array(z.object({
    id: z.string().uuid(),
    theme: z.string(),
    content: z.string(),
    timestamp: z.string().datetime(),
  })).default([]),
  privateReflections: z.array(z.object({
    id: z.string().uuid(),
    topic: z.string(),
    content: z.string(),
    timestamp: z.string().datetime(),
  })).default([]),
  competencies: z.record(ApeCompetencyRecordSchema).default({}),
  selfDiscrepancies: z.array(ApeSelfDiscrepancySchema).default([]),
  behavioralChanges: z.array(BehavioralChangeRecordSchema).default([]),
  narrativeEpochId: z.string().optional(),
  personalMilestoneIds: z.array(z.string()).default([]),
  isInitialized: z.boolean().default(true),
  lastUpdatedAt: z.string().datetime(),
});

export type ApeSelfModel = z.infer<typeof ApeSelfModelSchema>;

// ------------------------------------------
// Engine 6: Development Engine Schemas (Pillar 3)
// ------------------------------------------
export const InterestDevelopmentStageSchema = z.enum([
  'exposure',
  'attention',
  'exploration',
  'appraisal',
  'formed',
  'developing',
  'mastery',
  'fading',
  'dormant',
  'abandoned',
]);

export type InterestDevelopmentStage = z.infer<typeof InterestDevelopmentStageSchema>;

export const InterestEngagementRecordSchema = z.object({
  timestamp: z.string().datetime(),
  action: z.string(),
  outcome: z.enum(['success', 'failure', 'frustration', 'rewarding', 'neutral']).default('rewarding'),
  voluntary: z.boolean().default(true),
  satisfaction: z.number().min(0.0).max(1.0).default(0.7),
  notes: z.string().optional(),
});

export type InterestEngagementRecord = z.infer<typeof InterestEngagementRecordSchema>;

export const ApeInterestSchema = z.object({
  topic: z.string(),
  origin: z.enum([
    'spontaneous',
    'conversation',
    'reading',
    'environmental',
    'project',
    'unresolved_question',
    'external_recommendation',
  ]).default('spontaneous'),
  initialTrigger: z.string().default('General environmental exposure'),
  relevance: z.number().min(0.0).max(1.0).default(0.5),
  novelty: z.number().min(0.0).max(1.0).default(0.8),
  curiosity: z.number().min(0.0).max(1.0).default(0.8),
  engagementHistory: z.array(InterestEngagementRecordSchema).default([]),
  knowledgeLevel: z.number().min(0.0).max(1.0).default(0.1),
  confidence: z.number().min(0.0).max(1.0).default(0.5),
  developmentStage: InterestDevelopmentStageSchema.default('exposure'),
  level: z.enum(['emerging', 'deep', 'mastery', 'fading', 'dormant', 'abandoned']).default('emerging'),
  relatedInterests: z.array(z.string()).default([]),
  associatedGoalIds: z.array(z.string()).default([]),
  currentMotivationalStrength: z.number().min(0.0).max(1.0).default(0.7),
  developedAt: z.string().datetime(),
  lastEngagedAt: z.string().datetime().optional(),
  abandonmentReason: z.string().optional(),
});

export type ApeInterest = z.infer<typeof ApeInterestSchema>;

export const ApeDevelopmentStateSchema = z.object({
  developmentalHistory: z.array(z.object({
    id: z.string().uuid(),
    engine: z.string(),
    previousState: z.string(),
    newState: z.string(),
    reasoning: z.string(),
    confidence: z.number().min(0.0).max(1.0),
    triggerEventId: z.string(),
    timestamp: z.string().datetime(),
  })).default([]),
  interests: z.array(ApeInterestSchema).default([]),
  isInitialized: z.boolean().default(true),
  lastUpdatedAt: z.string().datetime(),
});

export type ApeDevelopmentState = z.infer<typeof ApeDevelopmentStateSchema>;

// ------------------------------------------
// Unified Master Six-Engine State
// ------------------------------------------
export const ApeMasterStateSchema = z.object({
  affective: ApePsychologicalStateSchema,
  personality: ApePersonalityStateSchema,
  motivational: ApeMotivationalStateSchema,
  relationship: ApeRelationshipStateSchema,
  selfModel: ApeSelfModelSchema,
  development: ApeDevelopmentStateSchema,
});

export type ApeMasterState = z.infer<typeof ApeMasterStateSchema>;

// ------------------------------------------
// Sensory Perceptual Affect Input Schemas
// ------------------------------------------
export const AcousticProfileSchema = z.enum([
  'silent',
  'calm_ambient',
  'gentle_melodic',
  'steady_speech',
  'energetic_upbeat',
  'tense_chaotic',
  'sudden_loud_spike',
]);
export type AcousticProfile = z.infer<typeof AcousticProfileSchema>;

export const AcousticMetricsSchema = z.object({
  rmsEnergy: z.number().min(0.0).max(1.0),
  peakAmplitude: z.number().min(0.0).max(1.0),
  energyVariance: z.number().min(0.0).max(1.0),
  zeroCrossingRate: z.number().min(0.0).max(1.0),
  acousticProfile: AcousticProfileSchema,
});
export type AcousticMetrics = z.infer<typeof AcousticMetricsSchema>;

export const VisualPerceptionInputSchema = z.object({
  activeWindowTitle: z.string().optional(),
  visibleWindows: z.array(z.string()).optional(),
  visualDescription: z.string().optional(),
  extractedText: z.string().optional(),
  source: z.string().optional().default('screen_observation'),
  salienceOverride: z.number().min(0.0).max(1.0).optional(),
});
export type VisualPerceptionInput = z.infer<typeof VisualPerceptionInputSchema>;

export const AuditoryPerceptionInputSchema = z.object({
  trackTitle: z.string().optional(),
  artist: z.string().optional(),
  album: z.string().optional(),
  transcript: z.string().optional(),
  acoustics: AcousticMetricsSchema.optional(),
  source: z.string().optional().default('system_audio'),
  salienceOverride: z.number().min(0.0).max(1.0).optional(),
});
export type AuditoryPerceptionInput = z.infer<typeof AuditoryPerceptionInputSchema>;

