import { z } from 'zod';

// ==========================================
// Milestone 11: Working Memory Contracts
// Objective: Establish temporary cognitive information management.
// Acceptance criteria: Arle must retain and manipulate relevant information
// during complex tasks without depending exclusively on an increasingly large prompt.
// ==========================================

export const WorkingMemoryCategorySchema = z.enum([
  'task_variable',
  'hypothesis',
  'intermediate_step',
  'constraint',
  'perceptual_chunk',
  'decision_candidate',
]);
export type WorkingMemoryCategory = z.infer<typeof WorkingMemoryCategorySchema>;

export const WorkingMemoryItemSchema = z.object({
  id: z.string().uuid(),
  slotKey: z.string(),
  category: WorkingMemoryCategorySchema,
  content: z.any(),
  summary: z.string(),
  priority: z.number().min(0).max(1).default(0.5),
  createdAt: z.string(),
  lastAccessedAt: z.string(),
  version: z.number().int().min(1).default(1),
  ttlSeconds: z.number().int().positive().optional(),
});
export type WorkingMemoryItem = z.infer<typeof WorkingMemoryItemSchema>;

export const IntermediateReasoningStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  goal: z.string(),
  premise: z.string(),
  intermediateConclusion: z.string(),
  confidence: z.number().min(0).max(1).default(1.0),
  derivationNotes: z.string().optional(),
});
export type IntermediateReasoningStep = z.infer<typeof IntermediateReasoningStepSchema>;

export const WorkingMemoryBufferSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string(),
  goalTitle: z.string(),
  items: z.array(WorkingMemoryItemSchema),
  intermediateSteps: z.array(IntermediateReasoningStepSchema),
  considerations: z.array(z.string()),
  maxCapacity: z.number().int().min(1).default(7),
  usedSlots: z.number().int().min(0),
  updatedAt: z.string(),
});
export type WorkingMemoryBuffer = z.infer<typeof WorkingMemoryBufferSchema>;

export const WorkingMemorySnapshotSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  taskId: z.string(),
  buffer: WorkingMemoryBufferSchema,
  consolidatedSummary: z.string(),
  reason: z.string(),
});
export type WorkingMemorySnapshot = z.infer<typeof WorkingMemorySnapshotSchema>;

/**
 * Invariant Validator: Ensures that active working memory strictly respects capacity limits (7 +/- 2)
 * and does not allow unbounded item accumulation without eviction/consolidation.
 */
export function assertWorkingMemoryCapacityIntegrity(buffer: WorkingMemoryBuffer): void {
  if (buffer.items.length > buffer.maxCapacity) {
    throw new Error(
      `Negative Invariant Violated: Working memory exceeded capacity limit (${buffer.items.length} > ${buffer.maxCapacity}) without consolidation or eviction.`,
    );
  }
}
