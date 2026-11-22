import { z } from 'zod';

// ==========================================
// Model Registry & Benchmark Contracts (P2.4)
// ==========================================

export const ModelBenchmarkResultSchema = z.object({
  tokensPerSecond: z.number().positive(),
  ttftMs: z.number().positive(),
  contextStabilityScore: z.number().min(0.0).max(1.0),
  toolAdherenceScore: z.number().min(0.0).max(1.0),
  jsonValidityScore: z.number().min(0.0).max(1.0),
  reasoningScore: z.number().min(0.0).max(1.0),
  conversationalQualityScore: z.number().min(0.0).max(1.0),
  uncertaintyCalibrationScore: z.number().min(0.0).max(1.0),
  peakMemoryBytes: z.number().positive(),
  testedAt: z.string(),
});
export type ModelBenchmarkResult = z.infer<typeof ModelBenchmarkResultSchema>;

export const ModelDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  filePath: z.string().min(1),
  architecture: z.string().min(1),
  parameters: z.string().min(1),
  quantization: z.string().min(1),
  contextLimit: z.number().int().positive(),
  inputModalities: z.array(z.enum(['text', 'image', 'audio', 'video'])).min(1),
  outputModalities: z.array(z.enum(['text', 'audio'])).min(1),
  supportsTools: z.boolean().default(true),
  supportsVision: z.boolean().default(false),
  visionProjectorPath: z.string().optional(),
  memoryRequirementBytes: z.number().positive(),
  runtimeCompatibility: z.array(z.string()).min(1),
  isInstalled: z.boolean().default(false),
  benchmarks: ModelBenchmarkResultSchema.optional(),
});
export type ModelDefinition = z.infer<typeof ModelDefinitionSchema>;

export const ModelResolutionDecisionSchema = z.object({
  requestedModelId: z.string(),
  resolvedModelId: z.string(),
  isFallback: z.boolean(),
  fallbackReason: z.string().optional(),
  activeProvider: z.string(),
  status: z.enum(['ready', 'degraded', 'unavailable']),
  modelDetails: ModelDefinitionSchema.optional(),
});
export type ModelResolutionDecision = z.infer<typeof ModelResolutionDecisionSchema>;

export const ModelComparisonSchema = z.object({
  candidateA: ModelDefinitionSchema,
  candidateB: ModelDefinitionSchema,
  winnerId: z.string(),
  selectionReason: z.string(),
  comparisons: z.record(z.object({
    candidateAValue: z.number(),
    candidateBValue: z.number(),
    advantage: z.enum(['candidateA', 'candidateB', 'tie']),
  })),
});
export type ModelComparison = z.infer<typeof ModelComparisonSchema>;
