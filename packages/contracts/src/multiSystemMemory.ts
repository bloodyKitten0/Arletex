import { z } from 'zod';

// ==========================================
// Milestone 12: Multi-System Memory Contracts
// Objective: Establish a differentiated memory architecture.
// Acceptance criteria: Arle must retrieve the correct kind of memory for a given situation
// and preserve the origin and reliability of remembered information.
// ==========================================

export const MultiSystemMemoryTypeSchema = z.enum([
  'episodic',
  'autobiographical',
  'semantic',
  'procedural',
  'prospective',
  'perceptual',
  'emotional',
  'working',
  'source',
]);
export type MultiSystemMemoryType = z.infer<typeof MultiSystemMemoryTypeSchema>;

export const MemorySourceRecordSchema = z.object({
  id: z.string().uuid(),
  sourceOrigin: z.string(),
  author: z.string(),
  channel: z.string(),
  isEmpiricallyVerified: z.boolean().default(false),
  reliabilityScore: z.number().min(0).max(1).default(0.8),
  timestamp: z.string(),
});
export type MemorySourceRecord = z.infer<typeof MemorySourceRecordSchema>;

export const MemoryCorrectionRecordSchema = z.object({
  timestamp: z.string(),
  previousContent: z.string(),
  reason: z.string(),
  correctedBy: z.string().default('arle'),
});
export type MemoryCorrectionRecord = z.infer<typeof MemoryCorrectionRecordSchema>;

export const MultiSystemMemoryEntrySchema = z.object({
  id: z.string().uuid(),
  systemType: MultiSystemMemoryTypeSchema,
  content: z.string().min(1),
  summary: z.string().optional(),
  source: MemorySourceRecordSchema,
  confidence: z.number().min(0).max(1).default(0.8),
  importance: z.number().min(0).max(1).default(0.5),
  decayFactor: z.number().min(0).max(1).default(0.05),
  tags: z.array(z.string()).default([]),
  associations: z.array(z.string()).default([]),
  contradictionWithId: z.string().nullable().optional(),
  correctionTrail: z.array(MemoryCorrectionRecordSchema).default([]),
  isProtected: z.boolean().default(false), // Protected memories (e.g. relation to Proof) never decay or get forgotten
  isArchived: z.boolean().default(false),
  createdAt: z.string(),
  lastRetrievedAt: z.string(),
});
export type MultiSystemMemoryEntry = z.infer<typeof MultiSystemMemoryEntrySchema>;

export const MemoryContradictionSchema = z.object({
  id: z.string().uuid(),
  memoryIdA: z.string().uuid(),
  memoryIdB: z.string().uuid(),
  conflictDescription: z.string(),
  detectedAt: z.string(),
  status: z.enum(['open', 'resolved', 'epistemic_uncertainty']).default('open'),
  resolutionStrategy: z.string().optional(),
});
export type MemoryContradiction = z.infer<typeof MemoryContradictionSchema>;

export const MultiSystemQueryOptionsSchema = z.object({
  systemTypes: z.array(MultiSystemMemoryTypeSchema).optional(),
  queryText: z.string().optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  minImportance: z.number().min(0).max(1).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional().default(20),
  includeArchived: z.boolean().optional().default(false),
});
export type MultiSystemQueryOptions = z.input<typeof MultiSystemQueryOptionsSchema>;

export const MultiSystemRetrievalResultSchema = z.object({
  entries: z.array(MultiSystemMemoryEntrySchema),
  systemCounts: z.record(MultiSystemMemoryTypeSchema, z.number()),
  consolidatedContext: z.string(),
});
export type MultiSystemRetrievalResult = z.infer<typeof MultiSystemRetrievalResultSchema>;

/**
 * Invariant Validator: Ensures that multi-system memories strictly retain their source
 * provenance, confidence, and system classification.
 */
export function assertMultiSystemMemoryIntegrity(entry: MultiSystemMemoryEntry): void {
  if (!entry.source || !entry.source.sourceOrigin || !entry.source.author) {
    throw new Error('Negative Invariant Violated: Memory entry lacks mandatory source provenance.');
  }

  // Foundational invariant: Memories relating to intimate partner commitment to Proof must be protected
  const lower = `${entry.content} ${entry.tags.join(' ')}`.toLowerCase();
  if (lower.includes('proof') && (lower.includes('partner') || lower.includes('commitment') || lower.includes('equal'))) {
    if (!entry.isProtected) {
      throw new Error(
        'Negative Invariant Violated: Memory concerning foundational partner commitment to Proof must have isProtected=true.',
      );
    }
  }
}
