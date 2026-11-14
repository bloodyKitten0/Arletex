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
});

export type ContextualAffectiveMeasurements = z.infer<typeof ContextualAffectiveMeasurementsSchema>;

// ==========================================
// Active Emotional State Model
// ==========================================

export const ActiveEmotionStatusSchema = z.enum([
  'active',
  'strengthened',
  'weakened',
  'reappraised',
  'resolving',
  'resolved',
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

export const ApeBeliefSchema = z.object({
  id: z.string().uuid(),
  topic: z.string(),
  content: z.string(),
  confidence: z.number().min(0.0).max(1.0),
  supportingEvidence: z.array(z.string()).default([]),
  revisionCount: z.number().default(0),
  origin: z.string().default('experience'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ApeBelief = z.infer<typeof ApeBeliefSchema>;

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

export const ApeGoalSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  origin: z.enum(['user', 'autonomous', 'shared']).default('autonomous'),
  motivation: z.string(),
  priority: z.number().min(0.0).max(1.0).default(0.5),
  status: ApeGoalStatusSchema.default('active'),
  progress: z.number().min(0.0).max(1.0).default(0.0),
  dependencies: z.array(z.string()).default([]),
  relatedMemoryIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ApeGoal = z.infer<typeof ApeGoalSchema>;

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
// Engine 5: Self Model Schemas
// ------------------------------------------
export const ApeSelfModelSchema = z.object({
  identityNarrative: z.string(),
  acknowledgedCapabilities: z.array(z.string()).default([]),
  acknowledgedLimitations: z.array(z.string()).default([]),
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
  isInitialized: z.boolean().default(true),
  lastUpdatedAt: z.string().datetime(),
});

export type ApeSelfModel = z.infer<typeof ApeSelfModelSchema>;

// ------------------------------------------
// Engine 6: Development Engine Schemas
// ------------------------------------------
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
  interests: z.array(z.object({
    topic: z.string(),
    level: z.enum(['emerging', 'deep', 'mastery', 'fading', 'dormant']),
    developedAt: z.string().datetime(),
  })).default([]),
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

