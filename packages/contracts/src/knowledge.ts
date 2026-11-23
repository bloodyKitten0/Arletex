import { z } from 'zod';

export const KnowledgeDocumentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  domain: z.string(),
  sourceUri: z.string(),
  author: z.string().optional(),
  reliabilityScore: z.number().min(0).max(1).default(0.8),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
});
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;

export const KnowledgeChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  contentHash: z.string(),
  embedding: z.array(z.number()).optional(),
  createdAt: z.string(),
});
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;

export const SemanticSearchResultSchema = z.object({
  chunk: KnowledgeChunkSchema,
  score: z.number(),
  documentTitle: z.string(),
  domain: z.string(),
  sourceUri: z.string(),
  reliabilityScore: z.number(),
});
export type SemanticSearchResult = z.infer<typeof SemanticSearchResultSchema>;

export const ContradictionAnalysisSchema = z.object({
  topic: z.string(),
  hasContradiction: z.boolean(),
  conflictingClaims: z.array(
    z.object({
      claim: z.string(),
      sourceTitle: z.string(),
      reliability: z.number(),
    }),
  ),
  synthesizedResolution: z.string(),
});
export type ContradictionAnalysis = z.infer<typeof ContradictionAnalysisSchema>;

export const LoRAConfigSchema = z.object({
  rank: z.number().int().positive().default(16),
  alpha: z.number().positive().default(32),
  learningRate: z.number().positive().default(0.0002),
  epochs: z.number().int().positive().default(3),
  targetModules: z.array(z.string()).default(['q_proj', 'v_proj', 'k_proj', 'o_proj']),
  batchSize: z.number().int().positive().default(4),
});
export type LoRAConfig = z.infer<typeof LoRAConfigSchema>;

export const AdapterEvaluationMetricsSchema = z.object({
  targetDomainScore: z.number().min(0).max(1),
  generalKnowledgeRetention: z.number().min(0).max(1),
  forgettingScore: z.number().min(0).max(1),
  latencyP95Ms: z.number().positive(),
  approvedForDeployment: z.boolean(),
  notes: z.string().optional(),
});
export type AdapterEvaluationMetrics = z.infer<typeof AdapterEvaluationMetricsSchema>;

export const LoRAAdapterStatusSchema = z.enum([
  'draft',
  'training',
  'evaluating',
  'registered',
  'active',
  'rolled_back',
  'rejected',
]);
export type LoRAAdapterStatus = z.infer<typeof LoRAAdapterStatusSchema>;

export const LoRAAdapterRecordSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  domain: z.string(),
  baseModelId: z.string(),
  status: LoRAAdapterStatusSchema,
  config: LoRAConfigSchema,
  evaluationMetrics: AdapterEvaluationMetricsSchema.optional(),
  weightsPath: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LoRAAdapterRecord = z.infer<typeof LoRAAdapterRecordSchema>;

export const LearnTopicInputSchema = z.object({
  topic: z.string().min(1).max(500),
  content: z.string().optional(),
  domain: z.string().optional().default('general'),
  sourceUri: z.string().optional(),
});
export type LearnTopicInput = z.infer<typeof LearnTopicInputSchema>;

export const LearnProgressChunkSchema = z.object({
  topic: z.string(),
  stage: z.enum([
    'analyzing',
    'synthesizing',
    'embedding',
    'indexing',
    'completed',
    'failed',
  ]),
  progress: z.number().min(0).max(100),
  message: z.string(),
  documentId: z.string().optional(),
  chunkCount: z.number().optional(),
  error: z.string().optional(),
});
export type LearnProgressChunk = z.infer<typeof LearnProgressChunkSchema>;
