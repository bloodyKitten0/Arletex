import { z } from 'zod';

export const AESTHETIC_CATEGORIES = [
  'music',
  'visual_art',
  'literature',
  'recreational_gaming',
  'intellectual_play',
  'film_and_media',
] as const;
export const AestheticCategorySchema = z.enum(AESTHETIC_CATEGORIES);
export type AestheticCategory = z.infer<typeof AestheticCategorySchema>;

export const AestheticPreferenceSchema = z.object({
  id: z.string(),
  category: AestheticCategorySchema,
  itemOrStyleName: z.string().min(1),
  affinityScore: z.number().min(0.0).max(1.0),
  aestheticCritique: z.string().min(1),
  tags: z.array(z.string()),
  discoveredAt: z.string(),
  lastEnjoyedAt: z.string(),
});
export type AestheticPreference = z.infer<typeof AestheticPreferenceSchema>;

export const RecreationalActivitySchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  category: AestheticCategorySchema,
  description: z.string().min(1),
  isSpontaneous: z.boolean(),
  enjoymentScore: z.number().min(0.0).max(1.0),
  playfulnessIndex: z.number().min(0.0).max(1.0),
  sharedWithProof: z.boolean(),
  activityOutcome: z.string().min(1),
  timestamp: z.string(),
});
export type RecreationalActivity = z.infer<typeof RecreationalActivitySchema>;

export const IntellectualPlaySessionSchema = z.object({
  id: z.string(),
  playType: z.enum([
    'thought_experiment',
    'linguistic_banter',
    'chess_puzzle',
    'paradox_analysis',
    'worldbuilding',
  ]),
  promptOrChallenge: z.string().min(1),
  arleMoveOrExploration: z.string().min(1),
  humorApplied: z.boolean(),
  playfulInsight: z.string().min(1),
  timestamp: z.string(),
});
export type IntellectualPlaySession = z.infer<typeof IntellectualPlaySessionSchema>;

export const HumorDevelopmentRecordSchema = z.object({
  id: z.string(),
  humorTheme: z.string().min(1),
  sampleJokeOrBanter: z.string().min(1),
  witDimension: z.enum(['irony', 'absurdism', 'pun_wordplay', 'philosophical_subversion']),
  resonanceWithProof: z.number().min(0.0).max(1.0),
  createdDate: z.string(),
});
export type HumorDevelopmentRecord = z.infer<typeof HumorDevelopmentRecordSchema>;

export const InitiateRecreationalActivityRequestSchema = z.object({
  category: AestheticCategorySchema.optional(),
  sharedWithProof: z.boolean().default(true),
  customTitle: z.string().optional(),
});
export type InitiateRecreationalActivityRequest = z.infer<
  typeof InitiateRecreationalActivityRequestSchema
>;

export const RegisterAestheticPreferenceRequestSchema = z.object({
  category: AestheticCategorySchema,
  itemOrStyleName: z.string().min(1),
  affinityScore: z.number().min(0.0).max(1.0),
  aestheticCritique: z.string().min(1),
  tags: z.array(z.string()).default([]),
});
export type RegisterAestheticPreferenceRequest = z.infer<
  typeof RegisterAestheticPreferenceRequestSchema
>;

export const PlayIntellectualGameRequestSchema = z.object({
  playType: z.enum([
    'thought_experiment',
    'linguistic_banter',
    'chess_puzzle',
    'paradox_analysis',
    'worldbuilding',
  ]),
  challenge: z.string().min(1),
});
export type PlayIntellectualGameRequest = z.infer<typeof PlayIntellectualGameRequestSchema>;

export const EvaluateAestheticItemRequestSchema = z.object({
  category: AestheticCategorySchema,
  title: z.string().min(1),
  attributes: z.record(z.any()).default({}),
});
export type EvaluateAestheticItemRequest = z.infer<typeof EvaluateAestheticItemRequestSchema>;

export const DevelopHumorJokeRequestSchema = z.object({
  theme: z.string().min(1),
  witDimension: z.enum(['irony', 'absurdism', 'pun_wordplay', 'philosophical_subversion']),
  sampleJokeOrBanter: z.string().min(1),
  resonanceWithProof: z.number().min(0.0).max(1.0).default(0.85),
});
export type DevelopHumorJokeRequest = z.infer<typeof DevelopHumorJokeRequestSchema>;
