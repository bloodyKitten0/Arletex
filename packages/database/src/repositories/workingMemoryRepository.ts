import Database from 'better-sqlite3';
import {
  WorkingMemoryBuffer,
  WorkingMemorySnapshot,
} from '@arletex/contracts';
import { DatabaseError, IWorkingMemoryRepository } from '@arletex/core';

export class WorkingMemoryRepository implements IWorkingMemoryRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Working Memory Buffers
  // ==========================================

  public saveBuffer(buffer: WorkingMemoryBuffer): void {
    try {
      this.db
        .prepare(
          `INSERT INTO working_memory_buffers (
            id, task_id, goal_title, items,
            intermediate_steps, considerations,
            max_capacity, used_slots, updated_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            task_id = excluded.task_id,
            goal_title = excluded.goal_title,
            items = excluded.items,
            intermediate_steps = excluded.intermediate_steps,
            considerations = excluded.considerations,
            max_capacity = excluded.max_capacity,
            used_slots = excluded.used_slots,
            updated_at = excluded.updated_at`,
        )
        .run(
          buffer.id,
          buffer.taskId,
          buffer.goalTitle,
          JSON.stringify(buffer.items),
          JSON.stringify(buffer.intermediateSteps),
          JSON.stringify(buffer.considerations),
          buffer.maxCapacity,
          buffer.usedSlots,
          buffer.updatedAt,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save working memory buffer ${buffer.id}: ${err.message}`, err);
    }
  }

  public getBufferByTaskId(taskId: string): WorkingMemoryBuffer | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM working_memory_buffers WHERE task_id = ? ORDER BY updated_at DESC LIMIT 1')
        .get(taskId) as any;
      if (!row) return null;
      return this.mapBufferRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get working memory buffer for task ${taskId}: ${err.message}`, err);
    }
  }

  public getLatestBuffer(): WorkingMemoryBuffer | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM working_memory_buffers ORDER BY updated_at DESC LIMIT 1')
        .get() as any;
      if (!row) return null;
      return this.mapBufferRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest working memory buffer: ${err.message}`, err);
    }
  }

  public deleteBuffer(taskId: string): void {
    try {
      this.db.prepare('DELETE FROM working_memory_buffers WHERE task_id = ?').run(taskId);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete working memory buffer for task ${taskId}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Working Memory Snapshots
  // ==========================================

  public saveSnapshot(snapshot: WorkingMemorySnapshot): void {
    try {
      this.db
        .prepare(
          `INSERT INTO working_memory_snapshots (
            id, timestamp, task_id, buffer_data,
            consolidated_summary, reason, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          snapshot.id,
          snapshot.timestamp,
          snapshot.taskId,
          JSON.stringify(snapshot.buffer),
          snapshot.consolidatedSummary,
          snapshot.reason,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save working memory snapshot ${snapshot.id}: ${err.message}`, err);
    }
  }

  public getLatestSnapshot(taskId?: string): WorkingMemorySnapshot | null {
    try {
      let query = 'SELECT * FROM working_memory_snapshots';
      const params: any[] = [];
      if (taskId) {
        query += ' WHERE task_id = ?';
        params.push(taskId);
      }
      query += ' ORDER BY timestamp DESC LIMIT 1';

      const row = this.db.prepare(query).get(...params) as any;
      if (!row) return null;
      return this.mapSnapshotRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest working memory snapshot: ${err.message}`, err);
    }
  }

  public listSnapshots(taskId?: string, limit = 20): WorkingMemorySnapshot[] {
    try {
      let query = 'SELECT * FROM working_memory_snapshots';
      const params: any[] = [];
      if (taskId) {
        query += ' WHERE task_id = ?';
        params.push(taskId);
      }
      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapSnapshotRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list working memory snapshots: ${err.message}`, err);
    }
  }

  private mapBufferRow(row: any): WorkingMemoryBuffer {
    return {
      id: row.id,
      taskId: row.task_id,
      goalTitle: row.goal_title,
      items: JSON.parse(row.items || '[]'),
      intermediateSteps: JSON.parse(row.intermediate_steps || '[]'),
      considerations: JSON.parse(row.considerations || '[]'),
      maxCapacity: Number(row.max_capacity),
      usedSlots: Number(row.used_slots),
      updatedAt: row.updated_at,
    };
  }

  private mapSnapshotRow(row: any): WorkingMemorySnapshot {
    return {
      id: row.id,
      timestamp: row.timestamp,
      taskId: row.task_id,
      buffer: JSON.parse(row.buffer_data),
      consolidatedSummary: row.consolidated_summary,
      reason: row.reason,
    };
  }
}
