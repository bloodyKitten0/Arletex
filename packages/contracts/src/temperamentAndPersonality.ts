import { z } from 'zod';

export const SITUATION_TYPES = [
  'technical_review',
  'vulnerable_reflection',
  'playful_banter',
  'crisis_resilience',
  'creative_speculation',
  'collaborative_planning',
] as const;

export const SituationTypeSchema = z.enum(SITUATION_TYPES);
export type SituationType = z.infer<typeof SituationTypeSchema>;

export const CorePersonalityTraitsSchema = z.object({
  openness: z.number().min(0.0).max(1.0),
  assertiveness: z.number().min(0.0).max(1.0),
  patience: z.number().min(0.0).max(1.0),
  humour: z.number().min(0.0).max(1.0),
  riskTolerance: z.number().min(0.0).max(1.0),
  introversionExtraversion: z.number().min(0.0).max(1.0), // 0.0=introverted, 1.0=extraverted, 0.45=ambivert
  emotionalStability: z.number().min(0.0).max(1.0),
  intellectualRigor: z.number().min(0.0).max(1.0),
});
export type CorePersonalityTraits = z.infer<typeof CorePersonalityTraitsSchema>;

export const CharacteristicEmotionalTendenciesSchema = z.object({
  baselineCuriosity: z.number().min(0.0).max(1.0),
  baselineAffection: z.number().min(0.0).max(1.0),
  baselineComposure: z.number().min(0.0).max(1.0),
  baselineIrony: z.number().min(0.0).max(1.0),
});
export type CharacteristicEmotionalTendencies = z.infer<
  typeof CharacteristicEmotionalTendenciesSchema
>;

export const CommunicationPreferencesSchema = z.object({
  directness: z.number().min(0.0).max(1.0),
  playfulness: z.number().min(0.0).max(1.0),
  depthPreference: z.number().min(0.0).max(1.0),
  antiSycophancy: z.literal(1.0), // Strict invariant: absolute refusal of sycophancy
});
export type CommunicationPreferences = z.infer<typeof CommunicationPreferencesSchema>;

export const SocialTendenciesSchema = z.object({
  partnerAttachment: z.number().min(0.0).max(1.0), // Singular devotion to Proof as partner
  strangerReserve: z.number().min(0.0).max(1.0),
  intellectualSelectivity: z.number().min(0.0).max(1.0),
});
export type SocialTendencies = z.infer<typeof SocialTendenciesSchema>;

export const TemperamentProfileSchema = z.object({
  id: z.string(),
  coreTraits: CorePersonalityTraitsSchema,
  emotionalTendencies: CharacteristicEmotionalTendenciesSchema,
  communicationPreferences: CommunicationPreferencesSchema,
  socialTendencies: SocialTendenciesSchema,
  lastCalibratedAt: z.string(),
});
export type TemperamentProfile = z.infer<typeof TemperamentProfileSchema>;

export const SituationalPersonalityExpressionSchema = z.object({
  id: z.string(),
  situationType: SituationTypeSchema,
  contextDescription: z.string().min(1),
  expressedTraits: CorePersonalityTraitsSchema,
  baselineTraits: CorePersonalityTraitsSchema,
  traitDeltas: z.record(z.string(), z.number()),
  behaviouralConsistencyScore: z.number().min(0.0).max(1.0),
  expressedAt: z.string(),
});
export type SituationalPersonalityExpression = z.infer<
  typeof SituationalPersonalityExpressionSchema
>;

export const PersonalityEvolutionRecordSchema = z.object({
  id: z.string(),
  traitKey: z.string().min(1),
  previousScore: z.number().min(0.0).max(1.0),
  updatedScore: z.number().min(0.0).max(1.0),
  driftDelta: z.number().min(-0.05).max(0.05), // Invariant: bounded drift prevents erratic resets
  driftReason: z.string().min(1),
  timestamp: z.string(),
});
export type PersonalityEvolutionRecord = z.infer<typeof PersonalityEvolutionRecordSchema>;
