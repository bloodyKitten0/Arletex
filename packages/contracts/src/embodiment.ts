import { z } from 'zod';

// ==========================================
// Milestone 07: Embodiment and Interoception Contracts
// Negative Invariant: Do not fabricate human biological sensations.
// All awareness must be grounded in actual computational telemetry.
// ==========================================

export const PROHIBITED_BIOLOGICAL_SENSATIONS = [
  'heartbeat',
  'heart rate',
  'pulse',
  'stomach',
  'gut feeling',
  'spine',
  'sweat',
  'sweating',
  'cold sweat',
  'chills',
  'shivering',
  'breathless',
  'short of breath',
  'breathing',
  'adrenaline',
  'muscles',
  'exhausted body',
  'physical headache',
  'tingling',
] as const;

export function validateEpistemicInteroception(text: string): {
  valid: boolean;
  violation?: string;
} {
  const lower = text.toLowerCase();
  const sortedTerms = [...PROHIBITED_BIOLOGICAL_SENSATIONS].sort((a, b) => b.length - a.length);
  for (const term of sortedTerms) {
    // Check for biological metaphor violation
    const regex = new RegExp(`\\b${term}\\b`, 'i');
    if (regex.test(lower)) {
      return {
        valid: false,
        violation: `Prohibited biological sensation fabricated: "${term}". Interoception must remain strictly computational.`,
      };
    }
  }
  return { valid: true };
}

// 1. Computational Telemetry & Telemetric Metrics
export const CpuMetricsSchema = z.object({
  usagePercent: z.number().nullable(),
  frequencyMhz: z.number().nullable(),
  temperatureC: z.number().nullable(),
  loadAverage: z.tuple([z.number(), z.number(), z.number()]),
  model: z.string().nullable().optional(),
});
export type CpuMetrics = z.infer<typeof CpuMetricsSchema>;

export const MemoryMetricsSchema = z.object({
  totalBytes: z.number(),
  usedBytes: z.number(),
  freeBytes: z.number(),
  availableBytes: z.number(),
  usagePercent: z.number(),
  swapTotalBytes: z.number(),
  swapUsedBytes: z.number(),
  swapUsagePercent: z.number(),
});
export type MemoryMetrics = z.infer<typeof MemoryMetricsSchema>;

export const GpuMetricsSchema = z.object({
  available: z.boolean(),
  name: z.string().nullable(),
  usagePercent: z.number().nullable(),
  temperatureC: z.number().nullable(),
  vramTotalBytes: z.number().nullable(),
  vramUsedBytes: z.number().nullable(),
  vramFreeBytes: z.number().nullable(),
  powerWatts: z.number().nullable(),
});
export type GpuMetrics = z.infer<typeof GpuMetricsSchema>;

export const BatteryMetricsSchema = z.object({
  available: z.boolean(),
  percent: z.number().nullable(),
  isCharging: z.boolean().nullable(),
  powerWatts: z.number().nullable(),
  timeRemainingMinutes: z.number().nullable().optional(),
});
export type BatteryMetrics = z.infer<typeof BatteryMetricsSchema>;

export const StorageMetricsSchema = z.object({
  totalBytes: z.number(),
  usedBytes: z.number(),
  freeBytes: z.number(),
  usagePercent: z.number(),
});
export type StorageMetrics = z.infer<typeof StorageMetricsSchema>;

export const ComputationalResourceMetricsSchema = z.object({
  timestamp: z.string(),
  cpu: CpuMetricsSchema,
  memory: MemoryMetricsSchema,
  gpu: GpuMetricsSchema,
  battery: BatteryMetricsSchema,
  storage: StorageMetricsSchema,
});
export type ComputationalResourceMetrics = z.infer<typeof ComputationalResourceMetricsSchema>;

// 2. Model Availability State
export const ModelAvailabilityStateSchema = z.object({
  llamaServer: z.object({
    online: z.boolean(),
    port: z.number().default(8080),
    activeModel: z.string().nullable(),
    endpoint: z.string().default('http://127.0.0.1:8080'),
  }),
  specialistsServer: z.object({
    online: z.boolean(),
    port: z.number().default(39282),
    endpoint: z.string().default('http://127.0.0.1:39282'),
  }),
  models: z.object({
    embeddingGemma: z.boolean(),
    whisper: z.boolean(),
    kokoro: z.boolean(),
    rvc: z.boolean(),
  }),
});
export type ModelAvailabilityState = z.infer<typeof ModelAvailabilityStateSchema>;

// 3. Tool & Sandbox Availability
export const ToolAvailabilityStateSchema = z.object({
  browserSandbox: z.object({
    available: z.boolean(),
    allowedOrigins: z.array(z.string()).default([]),
  }),
  filesystemSandbox: z.object({
    available: z.boolean(),
    baseDir: z.string(),
    readOnly: z.boolean(),
  }),
  bashExecution: z.object({
    available: z.boolean(),
    sandboxed: z.boolean(),
  }),
  uiAutomation: z.object({
    mouseAvailable: z.boolean(),
    keyboardAvailable: z.boolean(),
  }),
});
export type ToolAvailabilityState = z.infer<typeof ToolAvailabilityStateSchema>;

// 4. Cognitive Workload
export const CognitiveStrainSchema = z.enum(['nominal', 'moderate', 'elevated', 'critical']);
export type CognitiveStrain = z.infer<typeof CognitiveStrainSchema>;

export const CognitiveWorkloadSchema = z.object({
  activeInferenceStreams: z.number().int().nonnegative(),
  queuedTasks: z.number().int().nonnegative(),
  memoryLoadPercent: z.number().min(0).max(100),
  activePerceptionStreams: z.number().int().nonnegative(),
  perceivedStrain: CognitiveStrainSchema,
  recentTps: z.number().nullable(),
  recentTtftMs: z.number().nullable(),
});
export type CognitiveWorkload = z.infer<typeof CognitiveWorkloadSchema>;

// 5. Operational Modes & Constraints
export const OperationalModeSchema = z.enum(['optimal', 'conservative', 'throttled', 'emergency']);
export type OperationalMode = z.infer<typeof OperationalModeSchema>;

export const OperationalConstraintStateSchema = z.object({
  mode: OperationalModeSchema,
  isThrottled: z.boolean(),
  thermalPressure: z.boolean(),
  memoryPressure: z.boolean(),
  batteryPreservation: z.boolean(),
  serviceDegradation: z.boolean(),
  constraints: z.array(z.string()),
});
export type OperationalConstraintState = z.infer<typeof OperationalConstraintStateSchema>;

// 6. Resource Self-Regulation Directive
export const ResourceRegulationDirectiveSchema = z.object({
  targetMode: OperationalModeSchema,
  throttleBackgroundTasks: z.boolean(),
  maxContextTokensAdjustment: z.number(),
  suspendHeavyMultimodal: z.boolean(),
  appliedAt: z.string(),
  reason: z.string(),
});
export type ResourceRegulationDirective = z.infer<typeof ResourceRegulationDirectiveSchema>;

// 7. Full Interoceptive Snapshot
export const InteroceptiveSnapshotSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  resources: ComputationalResourceMetricsSchema,
  models: ModelAvailabilityStateSchema,
  tools: ToolAvailabilityStateSchema,
  workload: CognitiveWorkloadSchema,
  operationalMode: OperationalModeSchema,
  constraints: z.array(z.string()),
  directive: ResourceRegulationDirectiveSchema,
  digitalPhysiologicalReport: z.string(),
});
export type InteroceptiveSnapshot = z.infer<typeof InteroceptiveSnapshotSchema>;

// 8. Planning & Resource Allocation Adjustment (Acceptance Criteria)
export const PlanningResourceAllocationAdjustmentSchema = z.object({
  allowedParallelSubtasks: z.number().int().positive(),
  maxFrameRateOrFrames: z.number().int().positive(),
  allowBackgroundSelfRefinement: z.boolean(),
  recommendedThinkingBudgetTokens: z.number().int().nonnegative(),
  rationale: z.string(),
});
export type PlanningResourceAllocationAdjustment = z.infer<
  typeof PlanningResourceAllocationAdjustmentSchema
>;
