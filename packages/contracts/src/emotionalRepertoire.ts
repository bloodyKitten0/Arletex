import { z } from 'zod';

export const REPERTOIRE_EMOTIONS = [
  'happiness',
  'sadness',
  'anger',
  'fear',
  'disgust',
  'surprise',
  'curiosity',
  'boredom',
  'frustration',
  'affection',
  'jealousy',
  'pride',
  'shame',
  'guilt',
  'gratitude',
  'envy',
  'compassion',
  'admiration',
  'nostalgia',
  'loneliness',
  'anticipation',
  'relief',
  'awe',
] as const;

export const RepertoireEmotionKeySchema = z.enum(REPERTOIRE_EMOTIONS);
export type RepertoireEmotionKey = z.infer<typeof RepertoireEmotionKeySchema>;

export const EmotionalIntensitySchema = z.number().min(0.0).max(1.0);

export const CognitiveStyleSchema = z.enum([
  'analytic_deliberate',
  'heuristic_exploratory',
  'vigilant_protective',
  'contemplative_reminiscing',
  'expansive_creative',
  'balanced',
]);
export type CognitiveStyle = z.infer<typeof CognitiveStyleSchema>;

export const EmotionDecayProfileSchema = z.object({
  halfLifeMs: z.number().positive(),
  minBaselineFloor: z.number().min(0.0).max(1.0),
  naturalRecoveryTarget: z.number().min(0.0).max(1.0),
});
export type EmotionDecayProfile = z.infer<typeof EmotionDecayProfileSchema>;

export const DecisionWeightsImpactSchema = z.object({
  riskAversion: z.number().min(0.0).max(1.0),
  explorationWeight: z.number().min(0.0).max(1.0),
  partnerPrioritization: z.number().min(0.0).max(1.0),
  persistenceModifier: z.number().min(0.1).max(2.0),
});
export type DecisionWeightsImpact = z.infer<typeof DecisionWeightsImpactSchema>;

export const ExpressionModulationSchema = z.object({
  tone: z.string(),
  warmth: z.number().min(0.0).max(1.0),
  verbosityModifier: z.number().min(0.5).max(1.5),
  directness: z.number().min(0.0).max(1.0),
});
export type ExpressionModulation = z.infer<typeof ExpressionModulationSchema>;

export const EmotionalCognitiveImpactSchema = z.object({
  attentionBias: z.string(),
  cognitiveStyle: CognitiveStyleSchema,
  thoughtInclination: z.string(),
  actionTendencies: z.array(z.string()),
  decisionWeights: DecisionWeightsImpactSchema,
  expressionModulation: ExpressionModulationSchema,
});
export type EmotionalCognitiveImpact = z.infer<typeof EmotionalCognitiveImpactSchema>;

export const EmotionProfileDefinitionSchema = z.object({
  key: RepertoireEmotionKeySchema,
  displayName: z.string(),
  description: z.string(),
  valenceBaseline: z.number().min(-1.0).max(1.0),
  arousalBaseline: z.number().min(0.0).max(1.0),
  dominanceBaseline: z.number().min(0.0).max(1.0),
  decayProfile: EmotionDecayProfileSchema,
  cognitiveImpact: EmotionalCognitiveImpactSchema,
});
export type EmotionProfileDefinition = z.infer<typeof EmotionProfileDefinitionSchema>;

export const MixedEmotionalBlendSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  primaryEmotion: RepertoireEmotionKeySchema,
  secondaryEmotion: RepertoireEmotionKeySchema,
  tertiaryEmotion: RepertoireEmotionKeySchema.optional(),
  primaryIntensity: EmotionalIntensitySchema,
  secondaryIntensity: EmotionalIntensitySchema,
  tertiaryIntensity: EmotionalIntensitySchema.optional(),
  blendValence: z.number().min(-1.0).max(1.0),
  blendArousal: z.number().min(0.0).max(1.0),
  blendDominance: z.number().min(0.0).max(1.0),
  synergyLabel: z.string(),
  conflictDegree: z.number().min(0.0).max(1.0),
  appraisalId: z.string().optional(),
  context: z.record(z.unknown()).default({}),
});
export type MixedEmotionalBlend = z.infer<typeof MixedEmotionalBlendSchema>;

export const EmotionalTransitionTriggerSchema = z.enum([
  'appraisal',
  'decay',
  'regulation',
  'interaction',
  'internal_deliberation',
]);
export type EmotionalTransitionTrigger = z.infer<typeof EmotionalTransitionTriggerSchema>;

export const EmotionalTransitionRecordSchema = z.object({
  id: z.string(),
  fromEmotion: z.union([RepertoireEmotionKeySchema, z.literal('neutral')]),
  toEmotion: RepertoireEmotionKeySchema,
  fromIntensity: EmotionalIntensitySchema,
  toIntensity: EmotionalIntensitySchema,
  triggerType: EmotionalTransitionTriggerSchema,
  contextReason: z.string().min(1),
  timestamp: z.string(),
});
export type EmotionalTransitionRecord = z.infer<typeof EmotionalTransitionRecordSchema>;

export const IndividualEmotionalTendenciesSchema = z.object({
  traitCuriosity: z.number().min(0.0).max(1.0),
  traitAffection: z.number().min(0.0).max(1.0),
  traitResilience: z.number().min(0.0).max(1.0),
  traitVulnerabilityToLoneliness: z.number().min(0.0).max(1.0),
  traitResistanceToDisgust: z.number().min(0.0).max(1.0),
  baselineValence: z.number().min(-1.0).max(1.0),
  baselineArousal: z.number().min(0.0).max(1.0),
  baselineDominance: z.number().min(0.0).max(1.0),
});
export type IndividualEmotionalTendencies = z.infer<typeof IndividualEmotionalTendenciesSchema>;

export const ActiveRepertoireEmotionSchema = z.object({
  emotionKey: RepertoireEmotionKeySchema,
  intensity: EmotionalIntensitySchema,
  startedAt: z.string(),
  lastRehearsedAt: z.string(),
  originReason: z.string(),
});
export type ActiveRepertoireEmotion = z.infer<typeof ActiveRepertoireEmotionSchema>;

export const EmotionalRepertoireStateSchema = z.object({
  activeEmotions: z.array(ActiveRepertoireEmotionSchema),
  activeBlend: MixedEmotionalBlendSchema.optional(),
  cognitiveImpact: EmotionalCognitiveImpactSchema,
  updatedAt: z.string(),
});
export type EmotionalRepertoireState = z.infer<typeof EmotionalRepertoireStateSchema>;
