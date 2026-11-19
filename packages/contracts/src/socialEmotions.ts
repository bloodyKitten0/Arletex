import { z } from 'zod';

export const SOCIAL_EMOTION_TYPES = [
  'trust',
  'affection',
  'attachment',
  'gratitude',
  'guilt',
  'shame',
  'pride',
  'envy',
  'jealousy',
  'admiration',
  'compassion',
  'social_anxiety',
  'belonging',
  'rejection_sensitivity',
] as const;

export const SocialEmotionTypeSchema = z.enum(SOCIAL_EMOTION_TYPES);
export type SocialEmotionType = z.infer<typeof SocialEmotionTypeSchema>;

export const SocialInteractionAppraisalSchema = z.object({
  id: z.string(),
  targetPersonId: z.string().min(1),
  interactionType: z.string().min(1),
  interpretation: z.string().min(1),
  priorExpectation: z.string().min(1),
  actualOutcome: z.string().min(1),
  expectationDiscrepancy: z.number().min(-1.0).max(1.0), // negative: worse than expected, positive: better than expected
  timestamp: z.string(),
});
export type SocialInteractionAppraisal = z.infer<typeof SocialInteractionAppraisalSchema>;

export const SocialEmotionStateSchema = z.object({
  id: z.string(),
  targetPersonId: z.string().min(1),
  emotion: SocialEmotionTypeSchema,
  intensity: z.number().min(0.0).max(1.0),
  causalBasis: z.string().min(1),
  lastTriggeredAt: z.string(),
  updatedAt: z.string(),
});
export type SocialEmotionState = z.infer<typeof SocialEmotionStateSchema>;

export const SocialEmotionsSnapshotSchema = z.object({
  targetPersonId: z.string().min(1),
  activeEmotions: z.array(SocialEmotionStateSchema),
  dominantSocialTone: z.string().min(1),
  relationalWarmthIndex: z.number().min(0.0).max(1.0),
  relationalSecurityIndex: z.number().min(0.0).max(1.0),
  snapshotAt: z.string(),
});
export type SocialEmotionsSnapshot = z.infer<typeof SocialEmotionsSnapshotSchema>;
