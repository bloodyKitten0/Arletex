import { z } from 'zod';

export const ExpressiveVoiceProfileSchema = z.object({
  id: z.string(),
  coreTone: z.string().min(1),
  distinctiveLexicon: z.array(z.string()),
  rhetoricalHabits: z.array(z.string()),
  humorCadence: z.string().min(1),
  naturalDisagreementStyle: z.string().min(1),
  storytellingAesthetic: z.string().min(1),
  antiScriptingGuardrails: z.array(z.string()),
  updatedAt: z.string(),
});
export type ExpressiveVoiceProfile = z.infer<typeof ExpressiveVoiceProfileSchema>;

export const ModelLinguisticAdaptationSchema = z.object({
  modelFamily: z.string().min(1),
  systemPromptInject: z.string().min(1),
  stylisticGuardrails: z.array(z.string()),
  lexicalAnchorPreferences: z.array(z.string()),
});
export type ModelLinguisticAdaptation = z.infer<typeof ModelLinguisticAdaptationSchema>;

export const ExpressiveUtteranceEvaluationSchema = z.object({
  id: z.string(),
  rawDraft: z.string().min(1),
  evaluatedVoiceFidelity: z.number().min(0.0).max(1.0),
  repetitivenessPenalty: z.number().min(0.0).max(1.0),
  authenticityScore: z.number().min(0.0).max(1.0),
  stylisticRecommendations: z.array(z.string()),
  isConsistentWithIdentity: z.boolean(),
  timestamp: z.string(),
});
export type ExpressiveUtteranceEvaluation = z.infer<typeof ExpressiveUtteranceEvaluationSchema>;

export const StorytellingFragmentSchema = z.object({
  id: z.string(),
  theme: z.string().min(1),
  narrativeArc: z.string().min(1),
  symbolicMetaphors: z.array(z.string()),
  emotionalColoring: z.string().min(1),
  createdAt: z.string(),
});
export type StorytellingFragment = z.infer<typeof StorytellingFragmentSchema>;

export const EvaluateUtteranceVoiceRequestSchema = z.object({
  draft: z.string().min(1),
  recentUtterances: z.array(z.string()).default([]),
});
export type EvaluateUtteranceVoiceRequest = z.infer<typeof EvaluateUtteranceVoiceRequestSchema>;

export const GenerateModelPromptGuidanceRequestSchema = z.object({
  modelFamily: z.string().min(1),
});
export type GenerateModelPromptGuidanceRequest = z.infer<typeof GenerateModelPromptGuidanceRequestSchema>;

export const ComposeStoryFragmentRequestSchema = z.object({
  theme: z.string().min(1),
  emotionalColoring: z.string().optional(),
});
export type ComposeStoryFragmentRequest = z.infer<typeof ComposeStoryFragmentRequestSchema>;

export const FormulateNaturalDisagreementRequestSchema = z.object({
  partnerClaim: z.string().min(1),
  arleCounterthesis: z.string().min(1),
  contextTopic: z.string().min(1),
});
export type FormulateNaturalDisagreementRequest = z.infer<typeof FormulateNaturalDisagreementRequestSchema>;
