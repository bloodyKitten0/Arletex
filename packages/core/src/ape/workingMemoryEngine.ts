import crypto from 'node:crypto';
import {
  IntermediateReasoningStep,
  WorkingMemoryBuffer,
  WorkingMemoryCategory,
  WorkingMemoryItem,
  WorkingMemorySnapshot,
  assertWorkingMemoryCapacityIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IWorkingMemoryRepository } from './interfaces.js';

export interface WorkingMemoryEngineOptions {
  repository: IWorkingMemoryRepository;
  logger?: ILogger;
  defaultCapacity?: number; // default: 7 (Miller's law 7 +/- 2)
}

export class WorkingMemoryEngine {
  private readonly repo: IWorkingMemoryRepository;
  private readonly logger: ILogger;
  private readonly defaultCapacity: number;
  private currentBuffer: WorkingMemoryBuffer | null = null;

  constructor(options: WorkingMemoryEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('WorkingMemoryEngine');
    this.defaultCapacity = options.defaultCapacity ?? 7;
  }

  // ==========================================
  // 1. Task Context Management
  // ==========================================

  public initializeTaskContext(
    taskId: string,
    goalTitle: string,
    maxCapacity = this.defaultCapacity,
  ): WorkingMemoryBuffer {
    const now = new Date().toISOString();
    const buffer: WorkingMemoryBuffer = {
      id: crypto.randomUUID(),
      taskId,
      goalTitle,
      items: [],
      intermediateSteps: [],
      considerations: [],
      maxCapacity,
      usedSlots: 0,
      updatedAt: now,
    };

    this.currentBuffer = buffer;
    this.repo.saveBuffer(buffer);
    this.logger.info(
      `Initialized working memory buffer for task '${taskId}' (${goalTitle}), capacity: ${maxCapacity}`,
    );
    return buffer;
  }

  public getActiveBuffer(): WorkingMemoryBuffer | null {
    if (!this.currentBuffer) {
      this.currentBuffer = this.repo.getLatestBuffer();
    }
    return this.currentBuffer;
  }

  // ==========================================
  // 2. Information Retention & Eviction
  // ==========================================

  public retainItem(itemInput: {
    slotKey: string;
    category: WorkingMemoryCategory;
    content: any;
    summary: string;
    priority?: number;
    ttlSeconds?: number;
  }): WorkingMemoryItem {
    const buffer = this.ensureActiveBuffer();
    const now = new Date().toISOString();

    // Check if slotKey already exists -> update instead of inserting
    const existingIdx = buffer.items.findIndex((i) => i.slotKey === itemInput.slotKey);
    if (existingIdx >= 0 && buffer.items[existingIdx]) {
      const existing = buffer.items[existingIdx];
      const updated: WorkingMemoryItem = {
        ...existing,
        category: itemInput.category,
        content: itemInput.content,
        summary: itemInput.summary,
        priority: itemInput.priority ?? existing.priority,
        lastAccessedAt: now,
        version: existing.version + 1,
        ttlSeconds: itemInput.ttlSeconds ?? existing.ttlSeconds,
      };
      buffer.items[existingIdx] = updated;
      buffer.updatedAt = now;
      this.repo.saveBuffer(buffer);
      this.logger.info(
        `Updated existing working memory slot '${itemInput.slotKey}' (v${updated.version})`,
      );
      return updated;
    }

    // Capacity constraint enforcement: if buffer is full, evict lowest value item
    if (buffer.items.length >= buffer.maxCapacity) {
      this.evictLowestValueItem(buffer);
    }

    const newItem: WorkingMemoryItem = {
      id: crypto.randomUUID(),
      slotKey: itemInput.slotKey,
      category: itemInput.category,
      content: itemInput.content,
      summary: itemInput.summary,
      priority: Math.max(0, Math.min(1, itemInput.priority ?? 0.5)),
      createdAt: now,
      lastAccessedAt: now,
      version: 1,
      ttlSeconds: itemInput.ttlSeconds,
    };

    buffer.items.push(newItem);
    buffer.usedSlots = buffer.items.length;
    buffer.updatedAt = now;

    // Strict Invariant Check
    assertWorkingMemoryCapacityIntegrity(buffer);

    this.repo.saveBuffer(buffer);
    this.logger.info(
      `Retained item in slot '${newItem.slotKey}' [${newItem.category}]. Used: ${buffer.usedSlots}/${buffer.maxCapacity}`,
    );
    return newItem;
  }

  // ==========================================
  // 3. Information Manipulation
  // ==========================================

  public manipulateItem(
    slotKey: string,
    mutation: (prev: WorkingMemoryItem) => {
      content?: any;
      summary?: string;
      priority?: number;
      category?: WorkingMemoryCategory;
    },
  ): WorkingMemoryItem {
    const buffer = this.ensureActiveBuffer();
    const idx = buffer.items.findIndex((i) => i.slotKey === slotKey);
    if (idx < 0 || !buffer.items[idx]) {
      throw new Error(
        `Working memory slot '${slotKey}' not found in active task context '${buffer.taskId}'`,
      );
    }

    const current = buffer.items[idx];
    const changes = mutation(current);
    const now = new Date().toISOString();

    const updated: WorkingMemoryItem = {
      ...current,
      category: changes.category ?? current.category,
      content: changes.content !== undefined ? changes.content : current.content,
      summary: changes.summary ?? current.summary,
      priority:
        changes.priority !== undefined
          ? Math.max(0, Math.min(1, changes.priority))
          : current.priority,
      lastAccessedAt: now,
      version: current.version + 1,
    };

    buffer.items[idx] = updated;
    buffer.updatedAt = now;
    this.repo.saveBuffer(buffer);
    this.logger.info(`Manipulated working memory slot '${slotKey}' -> v${updated.version}`);
    return updated;
  }

  public getItem(slotKey: string): WorkingMemoryItem | null {
    const buffer = this.getActiveBuffer();
    if (!buffer) return null;
    const item = buffer.items.find((i) => i.slotKey === slotKey);
    if (item) {
      item.lastAccessedAt = new Date().toISOString();
      this.repo.saveBuffer(buffer);
      return { ...item };
    }
    return null;
  }

  public removeItem(slotKey: string): boolean {
    const buffer = this.getActiveBuffer();
    if (!buffer) return false;
    const initialLen = buffer.items.length;
    buffer.items = buffer.items.filter((i) => i.slotKey !== slotKey);
    if (buffer.items.length < initialLen) {
      buffer.usedSlots = buffer.items.length;
      buffer.updatedAt = new Date().toISOString();
      this.repo.saveBuffer(buffer);
      this.logger.info(`Removed slot '${slotKey}' from working memory`);
      return true;
    }
    return false;
  }

  // ==========================================
  // 4. Multiple Simultaneous Considerations
  // ==========================================

  public addConsideration(consideration: string): string[] {
    const buffer = this.ensureActiveBuffer();
    if (!buffer.considerations.includes(consideration)) {
      buffer.considerations.push(consideration);
      buffer.updatedAt = new Date().toISOString();
      this.repo.saveBuffer(buffer);
      this.logger.info(
        `Added consideration: "${consideration}" (${buffer.considerations.length} active)`,
      );
    }
    return [...buffer.considerations];
  }

  public removeConsideration(consideration: string): string[] {
    const buffer = this.ensureActiveBuffer();
    buffer.considerations = buffer.considerations.filter((c) => c !== consideration);
    buffer.updatedAt = new Date().toISOString();
    this.repo.saveBuffer(buffer);
    return [...buffer.considerations];
  }

  public getConsiderations(): string[] {
    const buffer = this.getActiveBuffer();
    return buffer ? [...buffer.considerations] : [];
  }

  // ==========================================
  // 5. Intermediate Reasoning Preservation
  // ==========================================

  public recordIntermediateStep(stepInput: {
    goal: string;
    premise: string;
    intermediateConclusion: string;
    confidence?: number;
    derivationNotes?: string;
  }): IntermediateReasoningStep {
    const buffer = this.ensureActiveBuffer();
    const stepNumber = buffer.intermediateSteps.length + 1;

    const step: IntermediateReasoningStep = {
      stepNumber,
      goal: stepInput.goal,
      premise: stepInput.premise,
      intermediateConclusion: stepInput.intermediateConclusion,
      confidence: Math.max(0, Math.min(1, stepInput.confidence ?? 1.0)),
      derivationNotes: stepInput.derivationNotes,
    };

    buffer.intermediateSteps.push(step);
    buffer.updatedAt = new Date().toISOString();
    this.repo.saveBuffer(buffer);
    this.logger.info(
      `Preserved intermediate reasoning step #${stepNumber}: "${step.intermediateConclusion}"`,
    );
    return step;
  }

  public getIntermediateSteps(): IntermediateReasoningStep[] {
    const buffer = this.getActiveBuffer();
    return buffer ? [...buffer.intermediateSteps] : [];
  }

  // ==========================================
  // 6. Context Snapshots & Recovery
  // ==========================================

  public createSnapshot(reason: string): WorkingMemorySnapshot {
    const buffer = this.ensureActiveBuffer();
    const now = new Date().toISOString();

    const summary = [
      `Task: ${buffer.goalTitle} (${buffer.taskId})`,
      `Items (${buffer.items.length}/${buffer.maxCapacity}): ${buffer.items.map((i) => `${i.slotKey}=${i.summary}`).join(', ') || 'None'}`,
      `Considerations (${buffer.considerations.length}): ${buffer.considerations.join('; ') || 'None'}`,
      `Steps (${buffer.intermediateSteps.length}): ${
        buffer.intermediateSteps
          .slice(-2)
          .map((s) => `#${s.stepNumber} ${s.intermediateConclusion}`)
          .join('; ') || 'None'
      }`,
    ].join(' | ');

    const snapshot: WorkingMemorySnapshot = {
      id: crypto.randomUUID(),
      timestamp: now,
      taskId: buffer.taskId,
      buffer: JSON.parse(JSON.stringify(buffer)),
      consolidatedSummary: summary,
      reason,
    };

    this.repo.saveSnapshot(snapshot);
    this.logger.info(`Created working memory snapshot for task '${buffer.taskId}' (${reason})`);
    return snapshot;
  }

  public recoverContext(taskId: string): WorkingMemoryBuffer {
    // 1. Try to fetch existing active buffer
    let buffer = this.repo.getBufferByTaskId(taskId);

    // 2. Fall back to latest snapshot for this task
    if (!buffer) {
      const snap = this.repo.getLatestSnapshot(taskId);
      if (snap) {
        buffer = snap.buffer;
        this.repo.saveBuffer(buffer);
      }
    }

    if (!buffer) {
      throw new Error(
        `Cannot recover working memory context: no state or snapshot found for task '${taskId}'`,
      );
    }

    this.currentBuffer = buffer;
    this.logger.info(
      `Recovered working memory context for task '${taskId}' (${buffer.items.length} items, ${buffer.intermediateSteps.length} steps)`,
    );
    return buffer;
  }

  // ==========================================
  // 7. Compact Prompt Context Representation
  // ==========================================

  /**
   * Fulfills acceptance criteria:
   * Arle must retain and manipulate relevant information during complex tasks
   * without depending exclusively on an increasingly large prompt.
   */
  public getWorkingMemorySummary(): string {
    const buffer = this.getActiveBuffer();
    if (!buffer || buffer.items.length === 0) {
      return 'Working Memory: Empty / Idle buffer.';
    }

    const itemsSummary = buffer.items
      .map((i) => `[${i.slotKey} (v${i.version})]: ${i.summary}`)
      .join('; ');

    const considerationsSummary = buffer.considerations.length
      ? ` | Considerations: ${buffer.considerations.join(', ')}`
      : '';

    const latestStep = buffer.intermediateSteps.slice(-1)[0];
    const stepsSummary = latestStep
      ? ` | Latest Step #${latestStep.stepNumber}: ${latestStep.intermediateConclusion}`
      : '';

    return `Working Memory (${buffer.goalTitle}) [${buffer.items.length}/${buffer.maxCapacity}]: ${itemsSummary}${considerationsSummary}${stepsSummary}`;
  }

  // ==========================================
  // Internal Helpers
  // ==========================================

  private ensureActiveBuffer(): WorkingMemoryBuffer {
    if (!this.currentBuffer) {
      this.currentBuffer = this.repo.getLatestBuffer();
    }
    if (!this.currentBuffer) {
      return this.initializeTaskContext('default_task', 'Default Operational Task');
    }
    return this.currentBuffer;
  }

  private evictLowestValueItem(buffer: WorkingMemoryBuffer): void {
    if (buffer.items.length === 0) return;

    // Lowest score calculated from priority (70%) and recency (30%)
    const now = Date.now();
    let lowestIdx = 0;
    let lowestScore = Infinity;

    for (let i = 0; i < buffer.items.length; i++) {
      const item = buffer.items[i]!;
      const ageMs = now - new Date(item.lastAccessedAt).getTime();
      const recencyScore = Math.max(0, 1 - ageMs / (3600 * 1000));
      const valueScore = item.priority * 0.7 + recencyScore * 0.3;

      if (valueScore < lowestScore) {
        lowestScore = valueScore;
        lowestIdx = i;
      }
    }

    const evicted = buffer.items.splice(lowestIdx, 1)[0];
    if (evicted) {
      this.logger.warn(
        `Working memory capacity reached (${buffer.maxCapacity}). Evicted slot '${evicted.slotKey}' (priority ${evicted.priority.toFixed(2)})`,
      );
    }
  }
}

// ==========================================
// In-Memory Repository for Tests & Unit Isolation
// ==========================================

export class InMemoryWorkingMemoryRepository implements IWorkingMemoryRepository {
  private buffers: WorkingMemoryBuffer[] = [];
  private snapshots: WorkingMemorySnapshot[] = [];

  public saveBuffer(buffer: WorkingMemoryBuffer): void {
    const idx = this.buffers.findIndex((b) => b.id === buffer.id || b.taskId === buffer.taskId);
    if (idx >= 0) {
      this.buffers[idx] = JSON.parse(JSON.stringify(buffer));
    } else {
      this.buffers.push(JSON.parse(JSON.stringify(buffer)));
    }
  }

  public getBufferByTaskId(taskId: string): WorkingMemoryBuffer | null {
    const buf = this.buffers.find((b) => b.taskId === taskId);
    return buf ? JSON.parse(JSON.stringify(buf)) : null;
  }

  public getLatestBuffer(): WorkingMemoryBuffer | null {
    if (this.buffers.length === 0) return null;
    const sorted = [...this.buffers].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sorted[0] ? JSON.parse(JSON.stringify(sorted[0])) : null;
  }

  public deleteBuffer(taskId: string): void {
    this.buffers = this.buffers.filter((b) => b.taskId !== taskId);
  }

  public saveSnapshot(snapshot: WorkingMemorySnapshot): void {
    this.snapshots.push(JSON.parse(JSON.stringify(snapshot)));
  }

  public getLatestSnapshot(taskId?: string): WorkingMemorySnapshot | null {
    let list = [...this.snapshots];
    if (taskId) {
      list = list.filter((s) => s.taskId === taskId);
    }
    if (list.length === 0) return null;
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return list[0] ? JSON.parse(JSON.stringify(list[0])) : null;
  }

  public listSnapshots(taskId?: string, limit = 20): WorkingMemorySnapshot[] {
    let list = [...this.snapshots];
    if (taskId) {
      list = list.filter((s) => s.taskId === taskId);
    }
    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return list.slice(0, limit).map((s) => JSON.parse(JSON.stringify(s)));
  }
}
