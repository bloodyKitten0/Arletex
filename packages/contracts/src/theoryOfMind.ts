import { z } from 'zod';

export const EpistemicAccessSchema = z.object({
  topic: z.string().min(1),
  hasAccess: z.boolean(),
  lastObservedAt: z.string().optional(),
});
export type EpistemicAccess = z.infer<typeof EpistemicAccessSchema>;

export const AgentMentalModelSchema = z.object({
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  relationship: z.string().min(1),
  knownPreferences: z.array(z.string()).default([]),
  epistemicAccess: z.array(EpistemicAccessSchema).default([]),
  lastInteractionAt: z.string(),
});
export type AgentMentalModel = z.infer<typeof AgentMentalModelSchema>;

export const InferredBeliefSchema = z.object({
  id: z.string(),
  agentId: z.string().min(1),
  topic: z.string().min(1),
  agentBeliefContent: z.string().min(1),
  groundTruthContent: z.string().min(1),
  isFalseBelief: z.boolean(),
  confidence: z.number().min(0.05).max(0.95), // strictly < 1.0, preserving epistemic uncertainty
  evidenceSignals: z.array(z.string()).default([]),
  inferredAt: z.string(),
});
export type InferredBelief = z.infer<typeof InferredBeliefSchema>;

export const InferredIntentionSchema = z.object({
  id: z.string(),
  agentId: z.string().min(1),
  observedBehavior: z.string().min(1),
  primaryInferredIntention: z.string().min(1),
  confidence: z.number().min(0.05).max(0.95), // strictly capped below 1.0 to avoid treating inferences as established facts
  uncertaintyFactors: z.array(z.string()).default([]),
  alternativeHypotheses: z.array(z.string()).default([]),
  inferredAt: z.string(),
});
export type InferredIntention = z.infer<typeof InferredIntentionSchema>;

export const SocialPredictionSchema = z.object({
  id: z.string(),
  agentId: z.string().min(1),
  context: z.string().min(1),
  predictedAction: z.string().min(1),
  predictedLikelihood: z.number().min(0.05).max(0.95),
  beliefBasis: z.string().min(1),
  expectedOutcome: z.string().min(1),
  createdAt: z.string(),
});
export type SocialPrediction = z.infer<typeof SocialPredictionSchema>;
