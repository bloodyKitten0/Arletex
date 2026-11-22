import Database from 'better-sqlite3';
import {
  MemoryContradiction,
  MultiSystemMemoryEntry,
  MultiSystemQueryOptions,
} from '@arletex/contracts';
import { DatabaseError, IMultiSystemMemoryRepository } from '@arletex/core';

export class MultiSystemMemoryRepository implements IMultiSystemMemoryRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Multi-System Memory Entries
  // ==========================================

  public createEntry(entry: MultiSystemMemoryEntry): void {
    try {
      this.db
        .prepare(
          `INSERT INTO multi_system_memory_entries (
            id, system_type, content, summary, source_data,
            confidence, importance, decay_factor, tags, associations,
            contradiction_with_id, correction_trail, is_protected,
            is_archived, created_at, last_retrieved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            content = excluded.content,
            summary = excluded.summary,
            confidence = excluded.confidence,
            importance = excluded.importance,
            decay_factor = excluded.decay_factor,
            tags = excluded.tags,
            associations = excluded.associations,
            contradiction_with_id = excluded.contradiction_with_id,
            correction_trail = excluded.correction_trail,
            is_protected = excluded.is_protected,
            is_archived = excluded.is_archived,
            last_retrieved_at = excluded.last_retrieved_at`,
        )
        .run(
          entry.id,
          entry.systemType,
          entry.content,
          entry.summary ?? null,
          JSON.stringify(entry.source),
          entry.confidence,
          entry.importance,
          entry.decayFactor,
          JSON.stringify(entry.tags),
          JSON.stringify(entry.associations),
          entry.contradictionWithId ?? null,
          JSON.stringify(entry.correctionTrail),
          entry.isProtected ? 1 : 0,
          entry.isArchived ? 1 : 0,
          entry.createdAt,
          entry.lastRetrievedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to create multi-system memory entry ${entry.id}: ${err.message}`,
        err,
      );
    }
  }

  public getEntryById(id: string): MultiSystemMemoryEntry | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM multi_system_memory_entries WHERE id = ?')
        .get(id) as any;
      if (!row) return null;
      return this.mapEntryRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get multi-system memory entry ${id}: ${err.message}`, err);
    }
  }

  public updateEntry(entry: MultiSystemMemoryEntry): void {
    this.createEntry(entry);
  }

  public listEntries(options?: MultiSystemQueryOptions): MultiSystemMemoryEntry[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (!options?.includeArchived) {
        conditions.push('is_archived = 0');
      }

      if (options?.systemTypes && options.systemTypes.length > 0) {
        const placeholders = options.systemTypes.map(() => '?').join(', ');
        conditions.push(`system_type IN (${placeholders})`);
        params.push(...options.systemTypes);
      }

      if (options?.minConfidence !== undefined) {
        conditions.push('confidence >= ?');
        params.push(options.minConfidence);
      }

      if (options?.minImportance !== undefined) {
        conditions.push('importance >= ?');
        params.push(options.minImportance);
      }

      if (options?.queryText) {
        conditions.push('(content LIKE ? OR summary LIKE ?)');
        const wild = `%${options.queryText}%`;
        params.push(wild, wild);
      }

      let query = 'SELECT * FROM multi_system_memory_entries';
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(options?.limit ?? 50);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapEntryRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list multi-system memory entries: ${err.message}`, err);
    }
  }

  public deleteEntry(id: string): void {
    try {
      this.db.prepare('DELETE FROM multi_system_memory_entries WHERE id = ?').run(id);
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to delete multi-system memory entry ${id}: ${err.message}`,
        err,
      );
    }
  }

  // ==========================================
  // Memory Contradictions
  // ==========================================

  public recordContradiction(contradiction: MemoryContradiction): void {
    try {
      this.db
        .prepare(
          `INSERT INTO memory_contradictions (
            id, memory_id_a, memory_id_b, conflict_description,
            detected_at, status, resolution_strategy, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            resolution_strategy = excluded.resolution_strategy`,
        )
        .run(
          contradiction.id,
          contradiction.memoryIdA,
          contradiction.memoryIdB,
          contradiction.conflictDescription,
          contradiction.detectedAt,
          contradiction.status,
          contradiction.resolutionStrategy ?? null,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to record memory contradiction ${contradiction.id}: ${err.message}`,
        err,
      );
    }
  }

  public getContradictionById(id: string): MemoryContradiction | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM memory_contradictions WHERE id = ?')
        .get(id) as any;
      if (!row) return null;
      return this.mapContradictionRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get contradiction ${id}: ${err.message}`, err);
    }
  }

  public listContradictions(status?: MemoryContradiction['status']): MemoryContradiction[] {
    try {
      let query = 'SELECT * FROM memory_contradictions';
      const params: any[] = [];
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      query += ' ORDER BY detected_at DESC';

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapContradictionRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list memory contradictions: ${err.message}`, err);
    }
  }

  public updateContradiction(contradiction: MemoryContradiction): void {
    this.recordContradiction(contradiction);
  }

  private mapEntryRow(row: any): MultiSystemMemoryEntry {
    return {
      id: row.id,
      systemType: row.system_type,
      content: row.content,
      summary: row.summary ?? undefined,
      source: JSON.parse(row.source_data),
      confidence: Number(row.confidence),
      importance: Number(row.importance),
      decayFactor: Number(row.decay_factor),
      tags: JSON.parse(row.tags || '[]'),
      associations: JSON.parse(row.associations || '[]'),
      contradictionWithId: row.contradiction_with_id ?? undefined,
      correctionTrail: JSON.parse(row.correction_trail || '[]'),
      isProtected: Boolean(row.is_protected),
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at,
      lastRetrievedAt: row.last_retrieved_at,
    };
  }

  private mapContradictionRow(row: any): MemoryContradiction {
    return {
      id: row.id,
      memoryIdA: row.memory_id_a,
      memoryIdB: row.memory_id_b,
      conflictDescription: row.conflict_description,
      detectedAt: row.detected_at,
      status: row.status,
      resolutionStrategy: row.resolution_strategy ?? undefined,
    };
  }
}
