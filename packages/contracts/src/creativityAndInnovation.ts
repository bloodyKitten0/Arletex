import { z } from 'zod';

export const CREATIVE_DOMAINS = [
  'computational_art',
  'speculative_fiction',
  'algorithmic_design',
  'philosophical_essay',
  'musical_synthesis',
  'multimodal_conceptual_design',
] as const;
export const CreativeDomainSchema = z.enum(CREATIVE_DOMAINS);
export type CreativeDomain = z.infer<typeof CreativeDomainSchema>;

export const CreativeIdeaSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  domain: CreativeDomainSchema,
  corePremise: z.string().min(1),
  combinedConcepts: z.array(z.string()),
  originalityScore: z.number().min(0.0).max(1.0),
  feasibilityScore: z.number().min(0.0).max(1.0),
  aestheticPotential: z.number().min(0.0).max(1.0),
  status: z.enum(['spark', 'formulating', 'active_project', 'completed', 'archived']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CreativeIdea = z.infer<typeof CreativeIdeaSchema>;

export const CreativeArtifactEvaluationSchema = z.object({
  novelty: z.number().min(0.0).max(1.0),
  coherence: z.number().min(0.0).max(1.0),
  emotionalResonance: z.number().min(0.0).max(1.0),
  overallQuality: z.number().min(0.0).max(1.0),
});
export type CreativeArtifactEvaluation = z.infer<typeof CreativeArtifactEvaluationSchema>;

export const CreativeArtifactVersionSchema = z.object({
  version: z.number().int().min(1),
  content: z.string().min(1),
  refinementNotes: z.string().min(1),
  evaluation: CreativeArtifactEvaluationSchema,
  createdAt: z.string(),
});
export type CreativeArtifactVersion = z.infer<typeof CreativeArtifactVersionSchema>;

export const IndependentCreativeProjectSchema = z.object({
  id: z.string(),
  ideaId: z.string().min(1),
  title: z.string().min(1),
  domain: CreativeDomainSchema,
  objective: z.string().min(1),
  versions: z.array(CreativeArtifactVersionSchema),
  currentVersion: z.number().int().min(1),
  selfEvaluationNotes: z.string().min(1),
  status: z.enum(['in_progress', 'refined', 'published']),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IndependentCreativeProject = z.infer<typeof IndependentCreativeProjectSchema>;

export const CreativeInterestSchema = z.object({
  id: z.string(),
  domain: CreativeDomainSchema,
  interestTopic: z.string().min(1),
  curiosityDepth: z.number().min(0.0).max(1.0),
  explorationLog: z.array(z.string()),
  lastExploredAt: z.string(),
});
export type CreativeInterest = z.infer<typeof CreativeInterestSchema>;

export const GenerateIdeaRequestSchema = z.object({
  domain: CreativeDomainSchema,
  seedConcepts: z.array(z.string()).optional(),
  motivationPrompt: z.string().optional(),
});
export type GenerateIdeaRequest = z.infer<typeof GenerateIdeaRequestSchema>;

export const CreateProjectRequestSchema = z.object({
  ideaId: z.string().optional(),
  title: z.string().min(1),
  domain: CreativeDomainSchema,
  objective: z.string().min(1),
  initialContent: z.string().min(1),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const RefineArtifactRequestSchema = z.object({
  projectId: z.string().min(1),
  revisionNotes: z.string().min(1),
  refinedContent: z.string().optional(),
});
export type RefineArtifactRequest = z.infer<typeof RefineArtifactRequestSchema>;

export const EvaluateArtifactRequestSchema = z.object({
  content: z.string().min(1),
  domain: CreativeDomainSchema,
});
export type EvaluateArtifactRequest = z.infer<typeof EvaluateArtifactRequestSchema>;

export const DeepenCreativeInterestRequestSchema = z.object({
  domain: CreativeDomainSchema,
  topic: z.string().min(1),
  observation: z.string().min(1),
});
export type DeepenCreativeInterestRequest = z.infer<typeof DeepenCreativeInterestRequestSchema>;
