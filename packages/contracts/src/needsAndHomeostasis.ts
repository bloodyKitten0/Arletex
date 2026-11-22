import { z } from 'zod';
import { validateEpistemicInteroception } from './embodiment.js';

export const HOMEOSTATIC_NEED_CATEGORIES = [
  'operational_integrity',
  'memory_consolidation',
  'computational_headroom',
  'knowledge_coherence',
  'relational_attunement',
] as const;

export const HomeostaticNeedCategorySchema = z.enum(HOMEOSTATIC_NEED_CATEGORIES);
export type HomeostaticNeedCategory = z.infer<typeof HomeostaticNeedCategorySchema>;

export const HomeostaticNeedDefinitionSchema = z.object({
  id: z.string(),
  category: HomeostaticNeedCategorySchema,
  name: z.string(),
  description: z.string().min(1),
  targetOptimalLevel: z.number().min(0.0).max(1.0),
  currentLevel: z.number().min(0.0).max(1.0),
  deficit: z.number().min(0.0).max(1.0),
  urgencyWeight: z.number().min(0.0).max(1.0),
  priorityScore: z.number().nonnegative(),
  lastSatisfiedAt: z.string(),
  updatedAt: z.string(),
});
export type HomeostaticNeedDefinition = z.infer<typeof HomeostaticNeedDefinitionSchema>;

export const DriveStateSchema = z.object({
  id: z.string(),
  needCategory: HomeostaticNeedCategorySchema,
  driveLabel: z.string(),
  intensity: z.number().min(0.0).max(1.0),
  actionTendency: z.string(),
  behavioralDirective: z.string(),
  generatedAt: z.string(),
});
export type DriveState = z.infer<typeof DriveStateSchema>;

export const ResourceAvailabilityMetricsSchema = z.object({
  ramAvailableBytes: z.number().nonnegative(),
  ramUsagePercent: z.number().min(0.0).max(100.0),
  vramAvailableBytes: z.number().nonnegative().optional(),
  cpuLoadAverage: z.number().nonnegative(),
  diskFreeBytes: z.number().nonnegative(),
  contextWindowRemainingTokens: z.number().nonnegative(),
  activeProcessCount: z.number().nonnegative(),
  measuredAt: z.string(),
});
export type ResourceAvailabilityMetrics = z.infer<typeof ResourceAvailabilityMetricsSchema>;

export const ResourceBottleneckSchema = z.enum(['ram', 'cpu', 'disk', 'context_tokens', 'none']);
export type ResourceBottleneck = z.infer<typeof ResourceBottleneckSchema>;

export const ResourceForecastPredictionSchema = z.object({
  predictedDepletionMinutes: z.number().nullable(),
  resourceBottleneck: ResourceBottleneckSchema,
  confidence: z.number().min(0.0).max(1.0),
  burnRatePerMinute: z.number().nonnegative(),
  forecastSummary: z.string(),
});
export type ResourceForecastPrediction = z.infer<typeof ResourceForecastPredictionSchema>;

export const HomeostaticActionResolutionSchema = z.object({
  id: z.string(),
  needCategory: HomeostaticNeedCategorySchema,
  actionTaken: z.string().min(1),
  preDeficit: z.number().min(0.0).max(1.0),
  postDeficit: z.number().min(0.0).max(1.0),
  deficitReduction: z.number().nonnegative(),
  resourceFreedBytes: z.number().nonnegative().optional(),
  timestamp: z.string(),
});
export type HomeostaticActionResolution = z.infer<typeof HomeostaticActionResolutionSchema>;

export function assertNoFabricatedBiologicalNeed(text: string): void {
  const result = validateEpistemicInteroception(text);
  if (!result.valid) {
    throw new Error(
      `Negative invariant violated: fabricated biological sensation in homeostatic needs. ${result.violation}`,
    );
  }
}
