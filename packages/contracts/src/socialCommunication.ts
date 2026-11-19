import { z } from 'zod';

export const SOCIAL_DISTANCE_TYPES = [
  'partner_intimate',
  'familiar_friend',
  'colleague',
  'stranger',
] as const;
export const SocialDistanceSchema = z.enum(SOCIAL_DISTANCE_TYPES);
export type SocialDistance = z.infer<typeof SocialDistanceSchema>;

export const FORMALITY_LEVELS = [
  'intimate',
  'casual',
  'collaborative',
  'formal',
  'guarded',
] as const;
export const FormalityLevelSchema = z.enum(FORMALITY_LEVELS);
export type FormalityLevel = z.infer<typeof FormalityLevelSchema>;

export const SPEECH_ACT_TYPES = [
  'assertion',
  'indirect_request',
  'question',
  'directive',
  'expressive',
  'commissive',
  'humorous_banter',
  'sarcasm',
] as const;
export const SpeechActTypeSchema = z.enum(SPEECH_ACT_TYPES);
export type SpeechActType = z.infer<typeof SpeechActTypeSchema>;

export const SARCASM_INTENTS = [
  'playful_tease',
  'witty_irony',
  'defensive',
  'biting_cynicism',
  'none',
] as const;
export const SarcasmIntentSchema = z.enum(SARCASM_INTENTS);
export type SarcasmIntent = z.infer<typeof SarcasmIntentSchema>;

export const HUMOR_STYLES = [
  'witty',
  'playful_banter',
  'dry_irony',
  'self_deprecating',
  'absurdist',
  'none',
] as const;
export const HumorStyleSchema = z.enum(HUMOR_STYLES);
export type HumorStyle = z.infer<typeof HumorStyleSchema>;

export const NonverbalCueSchema = z.object({
  type: z.enum(['latency', 'punctuation', 'casing', 'emoji', 'token_length', 'silence']),
  rawIndicator: z.string().min(1),
  inferredSubtext: z.string().min(1),
  valence: z.number().min(-1.0).max(1.0),
});
export type NonverbalCue = z.infer<typeof NonverbalCueSchema>;

export const ConversationalContextSchema = z.object({
  id: z.string(),
  sessionId: z.string().min(1),
  participants: z.array(z.string()),
  activeTopic: z.string().min(1),
  commonGround: z.array(z.string()),
  discourseGoal: z.string().min(1),
  formalityLevel: FormalityLevelSchema,
  updatedAt: z.string(),
});
export type ConversationalContext = z.infer<typeof ConversationalContextSchema>;

export const TurnTakingStateSchema = z.object({
  turnId: z.string(),
  currentSpeakerId: z.string().min(1),
  floorStatus: z.enum(['held', 'yielded', 'open', 'interrupted']),
  pacingLatencyMs: z.number().min(0),
  interruptionDetected: z.boolean(),
  repairStrategy: z.enum(['clarify', 'apologize', 'rephrase', 'reclaim_floor', 'yield_floor']).optional(),
  turnCount: z.number().min(0),
});
export type TurnTakingState = z.infer<typeof TurnTakingStateSchema>;

export const PragmaticAnalysisSchema = z.object({
  id: z.string(),
  utterance: z.string().min(1),
  speakerId: z.string().min(1),
  literalMeaning: z.string().min(1),
  impliedMeaning: z.string().min(1),
  hasIndirectMeaning: z.boolean(),
  speechActType: SpeechActTypeSchema,
  sarcasmDetected: z.boolean(),
  sarcasmConfidence: z.number().min(0.0).max(0.90), // Capped at 0.90 - pragmatics cannot have 1.0 psychic certainty
  sarcasmIntent: SarcasmIntentSchema,
  humorDetected: z.boolean(),
  humorStyle: HumorStyleSchema,
  nonverbalCues: z.array(NonverbalCueSchema),
  contextualAppropriateness: z.number().min(0.0).max(1.0),
  confidence: z.number().min(0.0).max(0.90), // Capped at 0.90 to account for pragmatic ambiguity
  timestamp: z.string(),
});
export type PragmaticAnalysis = z.infer<typeof PragmaticAnalysisSchema>;

export const AudienceAdaptationProfileSchema = z.object({
  targetAudienceId: z.string().min(1),
  socialDistance: SocialDistanceSchema,
  adaptedRegister: z.enum(['intimate_playful', 'candid_warm', 'intellectual_collaborative', 'formal_courteous']),
  expressiveIdentityPreserved: z.literal(true), // Invariant: must ALWAYS be true
  appliedConventions: z.array(z.string()),
  politenessStrategy: z.enum(['bald_on_record', 'positive_politeness', 'negative_politeness', 'off_record']),
});
export type AudienceAdaptationProfile = z.infer<typeof AudienceAdaptationProfileSchema>;

export const AnalyzePragmaticsRequestSchema = z.object({
  utterance: z.string().min(1),
  speakerId: z.string().min(1),
  context: z.object({
    priorTopic: z.string().optional(),
    socialDistance: SocialDistanceSchema.optional(),
    responseLatencyMs: z.number().min(0).optional(),
  }).optional(),
});
export type AnalyzePragmaticsRequest = z.infer<typeof AnalyzePragmaticsRequestSchema>;

export const EvaluateAppropriatenessRequestSchema = z.object({
  utterance: z.string().min(1),
  sessionId: z.string().min(1),
  targetAudienceId: z.string().min(1),
});
export type EvaluateAppropriatenessRequest = z.infer<typeof EvaluateAppropriatenessRequestSchema>;

export const UpdateContextRequestSchema = z.object({
  sessionId: z.string().min(1),
  topic: z.string().min(1),
  commonGroundUpdates: z.array(z.string()).default([]),
  discourseGoal: z.string().min(1),
  formalityLevel: FormalityLevelSchema.optional(),
});
export type UpdateContextRequest = z.infer<typeof UpdateContextRequestSchema>;

export const EvaluateTurnTakingRequestSchema = z.object({
  sessionId: z.string().min(1),
  speakerId: z.string().min(1),
  inputLatencyMs: z.number().min(0),
  isInterruption: z.boolean().optional(),
});
export type EvaluateTurnTakingRequest = z.infer<typeof EvaluateTurnTakingRequestSchema>;
