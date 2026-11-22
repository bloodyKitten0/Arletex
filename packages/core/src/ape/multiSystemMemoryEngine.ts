import crypto from 'node:crypto';
import {
  MemoryContradiction,
  MemorySourceRecord,
  MultiSystemMemoryEntry,
  MultiSystemMemoryType,
  MultiSystemQueryOptions,
  MultiSystemRetrievalResult,
  assertMultiSystemMemoryIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IMultiSystemMemoryRepository } from './interfaces.js';

export interface MultiSystemEngineOptions {
  repository: IMultiSystemMemoryRepository;
  logger?: ILogger;
}

export class MultiSystemMemoryEngine {
  private readonly repo: IMultiSystemMemoryRepository;
  private readonly logger: ILogger;

  constructor(options: MultiSystemEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('MultiSystemMemoryEngine');
  }

  // ==========================================
  // 1. Encoding & Deduplication
  // ==========================================

  public encode(input: {
    systemType: MultiSystemMemoryType;
    content: string;
    summary?: string;
    source: Omit<MemorySourceRecord, 'id' | 'timestamp'> & { id?: string; timestamp?: string };
    confidence?: number;
    importance?: number;
    tags?: string[];
    associations?: string[];
    isProtected?: boolean;
  }): MultiSystemMemoryEntry {
    const now = new Date().toISOString();

    const source: MemorySourceRecord = {
      id: input.source.id || crypto.randomUUID(),
      sourceOrigin: input.source.sourceOrigin,
      author: input.source.author,
      channel: input.source.channel,
      isEmpiricallyVerified: input.source.isEmpiricallyVerified ?? false,
      reliabilityScore: Math.max(0, Math.min(1, input.source.reliabilityScore ?? 0.8)),
      timestamp: input.source.timestamp || now,
    };

    // Duplicate detection: check if exact same content exists in this system
    const existingList = this.repo.listEntries({
      systemTypes: [input.systemType],
      limit: 100,
    });
    const duplicate = existingList.find(
      (e) => e.content.trim().toLowerCase() === input.content.trim().toLowerCase(),
    );

    if (duplicate) {
      this.logger.info(
        `Duplicate detected in system '${input.systemType}'. Updating confidence and timestamp on ${duplicate.id}`,
      );
      const updated: MultiSystemMemoryEntry = {
        ...duplicate,
        confidence: Math.min(1.0, duplicate.confidence + 0.05),
        lastRetrievedAt: now,
      };
      this.repo.updateEntry(updated);
      return updated;
    }

    const lower = `${input.content} ${(input.tags || []).join(' ')}`.toLowerCase();
    const isPartnerCommitment =
      lower.includes('proof') &&
      (lower.includes('partner') ||
        lower.includes('commitment') ||
        lower.includes('equal') ||
        lower.includes('love'));

    const entry: MultiSystemMemoryEntry = {
      id: crypto.randomUUID(),
      systemType: input.systemType,
      content: input.content,
      summary: input.summary,
      source,
      confidence: Math.max(
        0,
        Math.min(1, input.confidence ?? (source.isEmpiricallyVerified ? 0.95 : 0.8)),
      ),
      importance: Math.max(0, Math.min(1, input.importance ?? (isPartnerCommitment ? 1.0 : 0.5))),
      decayFactor: isPartnerCommitment ? 0.0 : 0.05,
      tags: input.tags || [],
      associations: input.associations || [],
      correctionTrail: [],
      isProtected: input.isProtected ?? isPartnerCommitment,
      isArchived: false,
      createdAt: now,
      lastRetrievedAt: now,
    };

    // Invariant validation
    assertMultiSystemMemoryIntegrity(entry);

    this.repo.createEntry(entry);
    this.logger.info(
      `Encoded [${entry.systemType}] memory: "${entry.content.substring(0, 40)}..." (source: ${source.author})`,
    );
    return entry;
  }

  // ==========================================
  // 2. Retrieval & Relevance Scoring
  // ==========================================

  public retrieve(options: MultiSystemQueryOptions): MultiSystemRetrievalResult {
    const rawEntries = this.repo.listEntries(options);
    const now = Date.now();

    // Score and rank entries
    const scored = rawEntries.map((entry) => {
      let textMatch = 0.5;
      if (options.queryText) {
        const queryLower = options.queryText.toLowerCase();
        const contentLower =
          `${entry.content} ${entry.summary || ''} ${entry.tags.join(' ')}`.toLowerCase();
        if (contentLower.includes(queryLower)) {
          textMatch = 1.0;
        } else {
          const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
          const matchCount = queryWords.filter((w) => contentLower.includes(w)).length;
          textMatch = queryWords.length > 0 ? matchCount / queryWords.length : 0.5;
        }
      }

      // Temporal recency: decay over 7 days
      const ageHours = (now - new Date(entry.createdAt).getTime()) / (3600 * 1000);
      const recency = Math.max(0.1, 1 - ageHours / 168);

      const relevanceScore = textMatch * 0.5 + entry.importance * 0.3 + recency * 0.2;
      return { entry, relevanceScore };
    });

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const selected = scored.slice(0, options.limit || 20).map((s) => s.entry);

    // Update lastRetrievedAt
    const nowIso = new Date().toISOString();
    for (const item of selected) {
      item.lastRetrievedAt = nowIso;
      this.repo.updateEntry(item);
    }

    const systemCounts: Record<MultiSystemMemoryType, number> = {
      episodic: 0,
      autobiographical: 0,
      semantic: 0,
      procedural: 0,
      prospective: 0,
      perceptual: 0,
      emotional: 0,
      working: 0,
      source: 0,
    };

    for (const item of selected) {
      systemCounts[item.systemType] = (systemCounts[item.systemType] || 0) + 1;
    }

    const consolidatedContext = selected
      .slice(0, 5)
      .map(
        (e) =>
          `[${e.systemType.toUpperCase()}] ${e.content} (source: ${e.source.author}, confidence: ${(e.confidence * 100).toFixed(0)}%)`,
      )
      .join('\n');

    return {
      entries: selected,
      systemCounts,
      consolidatedContext,
    };
  }

  // ==========================================
  // 3. Consolidation from Working Memory
  // ==========================================

  public consolidateWorkingMemory(params: {
    slotKey: string;
    content: string;
    summary?: string;
    targetSystem: 'semantic' | 'autobiographical' | 'procedural' | 'episodic';
    author?: string;
    importance?: number;
    tags?: string[];
  }): MultiSystemMemoryEntry {
    return this.encode({
      systemType: params.targetSystem,
      content: params.content,
      summary: params.summary,
      source: {
        sourceOrigin: `working_memory:${params.slotKey}`,
        author: params.author || 'Arle & Proof',
        channel: 'working_memory_consolidation',
        isEmpiricallyVerified: true,
        reliabilityScore: 0.95,
      },
      importance: params.importance ?? 0.8,
      tags: [...(params.tags || []), 'consolidated', params.slotKey],
    });
  }

  // ==========================================
  // 4. Memory Decay & Forgetting
  // ==========================================

  public applyMemoryDecay(elapsedHours: number): {
    decayedCount: number;
    archivedCount: number;
    protectedCount: number;
  } {
    const all = this.repo.listEntries({ includeArchived: false, limit: 500 });
    let decayedCount = 0;
    let archivedCount = 0;
    let protectedCount = 0;

    for (const entry of all) {
      if (entry.isProtected) {
        protectedCount++;
        continue; // Protected memories (e.g. partner commitments) NEVER decay!
      }

      // Non-protected memories decay
      const decayAmount = entry.decayFactor * (elapsedHours / 24);
      entry.confidence = Math.max(0.05, Number((entry.confidence - decayAmount).toFixed(3)));
      decayedCount++;

      // If confidence falls below 0.2 and importance is low, archive it (forgetting)
      if (entry.confidence < 0.2 && entry.importance < 0.3) {
        entry.isArchived = true;
        archivedCount++;
      }

      this.repo.updateEntry(entry);
    }

    this.logger.info(
      `Applied memory decay: ${decayedCount} decayed, ${archivedCount} archived, ${protectedCount} protected`,
    );
    return { decayedCount, archivedCount, protectedCount };
  }

  // ==========================================
  // 5. Memory Correction with Audit Trail
  // ==========================================

  public correctMemory(
    memoryId: string,
    newContent: string,
    reason: string,
  ): MultiSystemMemoryEntry {
    const existing = this.repo.getEntryById(memoryId);
    if (!existing) {
      throw new Error(`Memory entry ${memoryId} not found for correction.`);
    }

    const now = new Date().toISOString();
    existing.correctionTrail.push({
      timestamp: now,
      previousContent: existing.content,
      reason,
      correctedBy: 'arle',
    });

    existing.content = newContent;
    existing.lastRetrievedAt = now;
    this.repo.updateEntry(existing);
    this.logger.info(`Corrected memory ${memoryId} (reason: ${reason})`);
    return existing;
  }

  // ==========================================
  // 6. Contradiction Management
  // ==========================================

  public detectContradiction(
    memoryIdA: string,
    memoryIdB: string,
    conflictDescription: string,
  ): MemoryContradiction {
    const now = new Date().toISOString();
    const contradiction: MemoryContradiction = {
      id: crypto.randomUUID(),
      memoryIdA,
      memoryIdB,
      conflictDescription,
      detectedAt: now,
      status: 'open',
    };

    // Update memory entries to link to contradiction
    const memA = this.repo.getEntryById(memoryIdA);
    if (memA) {
      memA.contradictionWithId = memoryIdB;
      this.repo.updateEntry(memA);
    }
    const memB = this.repo.getEntryById(memoryIdB);
    if (memB) {
      memB.contradictionWithId = memoryIdA;
      this.repo.updateEntry(memB);
    }

    this.repo.recordContradiction(contradiction);
    this.logger.warn(
      `Contradiction detected between ${memoryIdA} and ${memoryIdB}: ${conflictDescription}`,
    );
    return contradiction;
  }

  public resolveContradiction(
    contradictionId: string,
    strategy: 'override_with_verified' | 'epistemic_uncertainty',
    winningMemoryId?: string,
  ): MemoryContradiction {
    const contradiction = this.repo.getContradictionById(contradictionId);
    if (!contradiction) {
      throw new Error(`Contradiction ${contradictionId} not found.`);
    }

    contradiction.status =
      strategy === 'override_with_verified' ? 'resolved' : 'epistemic_uncertainty';
    contradiction.resolutionStrategy = strategy;

    if (strategy === 'override_with_verified' && winningMemoryId) {
      const losingId =
        winningMemoryId === contradiction.memoryIdA
          ? contradiction.memoryIdB
          : contradiction.memoryIdA;
      const losing = this.repo.getEntryById(losingId);
      if (losing) {
        losing.confidence = 0.2;
        losing.isArchived = true;
        this.repo.updateEntry(losing);
      }
    }

    this.repo.updateContradiction(contradiction);
    this.logger.info(`Resolved contradiction ${contradictionId} via strategy '${strategy}'`);
    return contradiction;
  }

  // ==========================================
  // 7. Multi-System Summary
  // ==========================================

  public getMultiSystemSummary(): {
    totalMemories: number;
    systemCounts: Record<MultiSystemMemoryType, number>;
    protectedCount: number;
    openContradictions: number;
  } {
    const entries = this.repo.listEntries({ limit: 1000 });
    const contradictions = this.repo.listContradictions('open');

    const systemCounts: Record<MultiSystemMemoryType, number> = {
      episodic: 0,
      autobiographical: 0,
      semantic: 0,
      procedural: 0,
      prospective: 0,
      perceptual: 0,
      emotional: 0,
      working: 0,
      source: 0,
    };

    let protectedCount = 0;
    for (const e of entries) {
      systemCounts[e.systemType] = (systemCounts[e.systemType] || 0) + 1;
      if (e.isProtected) protectedCount++;
    }

    return {
      totalMemories: entries.length,
      systemCounts,
      protectedCount,
      openContradictions: contradictions.length,
    };
  }
}

// ==========================================
// In-Memory Repository for Tests & Unit Isolation
// ==========================================

export class InMemoryMultiSystemMemoryRepository implements IMultiSystemMemoryRepository {
  private entries: MultiSystemMemoryEntry[] = [];
  private contradictions: MemoryContradiction[] = [];

  public createEntry(entry: MultiSystemMemoryEntry): void {
    const idx = this.entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      this.entries[idx] = JSON.parse(JSON.stringify(entry));
    } else {
      this.entries.push(JSON.parse(JSON.stringify(entry)));
    }
  }

  public getEntryById(id: string): MultiSystemMemoryEntry | null {
    const entry = this.entries.find((e) => e.id === id);
    return entry ? JSON.parse(JSON.stringify(entry)) : null;
  }

  public updateEntry(entry: MultiSystemMemoryEntry): void {
    this.createEntry(entry);
  }

  public listEntries(options?: MultiSystemQueryOptions): MultiSystemMemoryEntry[] {
    let result = [...this.entries];

    if (!options?.includeArchived) {
      result = result.filter((e) => !e.isArchived);
    }
    if (options?.systemTypes && options.systemTypes.length > 0) {
      result = result.filter((e) => options.systemTypes!.includes(e.systemType));
    }
    if (options?.minConfidence !== undefined) {
      result = result.filter((e) => e.confidence >= options.minConfidence!);
    }
    if (options?.minImportance !== undefined) {
      result = result.filter((e) => e.importance >= options.minImportance!);
    }
    if (options?.queryText) {
      const q = options.queryText.toLowerCase();
      result = result.filter(
        (e) =>
          e.content.toLowerCase().includes(q) || (e.summary && e.summary.toLowerCase().includes(q)),
      );
    }

    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result.slice(0, options?.limit || 50).map((e) => JSON.parse(JSON.stringify(e)));
  }

  public deleteEntry(id: string): void {
    this.entries = this.entries.filter((e) => e.id !== id);
  }

  public recordContradiction(contradiction: MemoryContradiction): void {
    const idx = this.contradictions.findIndex((c) => c.id === contradiction.id);
    if (idx >= 0) {
      this.contradictions[idx] = JSON.parse(JSON.stringify(contradiction));
    } else {
      this.contradictions.push(JSON.parse(JSON.stringify(contradiction)));
    }
  }

  public getContradictionById(id: string): MemoryContradiction | null {
    const c = this.contradictions.find((x) => x.id === id);
    return c ? JSON.parse(JSON.stringify(c)) : null;
  }

  public listContradictions(status?: MemoryContradiction['status']): MemoryContradiction[] {
    let list = [...this.contradictions];
    if (status) {
      list = list.filter((c) => c.status === status);
    }
    return list.map((c) => JSON.parse(JSON.stringify(c)));
  }

  public updateContradiction(contradiction: MemoryContradiction): void {
    this.recordContradiction(contradiction);
  }
}
