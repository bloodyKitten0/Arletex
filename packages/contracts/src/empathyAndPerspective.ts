import { z } from 'zod';

export const EmotionalCueTypeSchema = z.enum([
  'lexical',
  'cadence',
  'workload_fatigue',
  'frustration_marker',
  'enthusiasm_marker',
  'silence_pause',
]);
export type EmotionalCueType = z.infer<typeof EmotionalCueTypeSchema>;

export const EmotionalCueSchema = z.object({
  cueType: EmotionalCueTypeSchema,
  signal: z.string().min(1),
  intensity: z.number().min(0.1).max(1.0),
});
export type EmotionalCue = z.infer<typeof EmotionalCueSchema>;

export const InferredExperienceSchema = z.object({
  id: z.string(),
  targetPersonId: z.string().min(1),
  observedCues: z.array(EmotionalCueSchema).default([]),
  primaryInferredAffect: z.string().min(1),
  inferredNeeds: z.array(z.string()).default([]),
  confidence: z.number().min(0.05).max(0.88), // strictly capped below 1.0 to preserve uncertainty about inaccessible internal experiences
  epistemicModality: z.enum(['tentative', 'likely', 'plausible', 'speculative']),
  inferredAt: z.string(),
});
export type InferredExperience = z.infer<typeof InferredExperienceSchema>;

export const PerspectiveTakingModelSchema = z.object({
  id: z.string(),
  targetPersonId: z.string().min(1),
  currentContext: z.string().min(1),
  inferredPointOfView: z.string().min(1),
  underlyingPressures: z.array(z.string()).default([]),
  relationshipBond: z.string().min(1),
  lastRevisedAt: z.string(),
});
export type PerspectiveTakingModel = z.infer<typeof PerspectiveTakingModelSchema>;

export const EmpatheticResponseSchema = z.object({
  id: z.string(),
  targetPersonId: z.string().min(1),
  experienceId: z.string(),
  perspectiveId: z.string(),
  validatesEmotion: z.boolean().default(true),
  agreesWithPremise: z.boolean().default(true), // Explicit distinction between emotional empathy and factual agreement
  empathyStatement: z.string().min(1),
  epistemicHumilityDisclaimer: z.string().min(1),
  supportiveActionSuggestion: z.string().min(1),
  createdAt: z.string(),
});
export type EmpatheticResponse = z.infer<typeof EmpatheticResponseSchema>;

export const PerspectiveRevisionRecordSchema = z.object({
  id: z.string(),
  perspectiveId: z.string().min(1),
  previousUnderstanding: z.string().min(1),
  newUnderstanding: z.string().min(1),
  revisionReason: z.string().min(1),
  revisedAt: z.string(),
});
export type PerspectiveRevisionRecord = z.infer<typeof PerspectiveRevisionRecordSchema>;
