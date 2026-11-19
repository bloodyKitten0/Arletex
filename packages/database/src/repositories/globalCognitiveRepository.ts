import Database from 'better-sqlite3';
import {
  GlobalCognitiveCycleEvent,
  GlobalCognitiveSnapshot,
  assertGlobalCycleIntegrity,
} from '@arletex/contracts';
import { DatabaseError, IGlobalCognitiveRepository } from '@arletex/core';

export class SqliteGlobalCognitiveRepository implements IGlobalCognitiveRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveCycle(cycle: GlobalCognitiveCycleEvent): void {
    assertGlobalCycleIntegrity(cycle);
    try {
      this.db
        .prepare(
          `INSERT INTO global_cognitive_cycles (
            id, trace_id, origin_subsystem, event_type, description,
            context_snapshot_json, phase_executions_json, subsystems_involved_json,
            is_coherent, started_at, completed_at, total_latency_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            trace_id = excluded.trace_id,
            origin_subsystem = excluded.origin_subsystem,
            event_type = excluded.event_type,
            description = excluded.description,
            context_snapshot_json = excluded.context_snapshot_json,
            phase_executions_json = excluded.phase_executions_json,
            subsystems_involved_json = excluded.subsystems_involved_json,
            is_coherent = excluded.is_coherent,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            total_latency_ms = excluded.total_latency_ms`,
        )
        .run(
          cycle.id,
          cycle.traceId,
          cycle.originSubsystem,
          cycle.eventType,
          cycle.description,
          JSON.stringify(cycle.contextSnapshot ?? {}),
          JSON.stringify(cycle.phaseExecutions ?? []),
          JSON.stringify(cycle.subsystemsInvolved ?? []),
          cycle.isCoherent ? 1 : 0,
          cycle.startedAt,
          cycle.completedAt,
          cycle.totalLatencyMs,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save global cognitive cycle ${cycle.id}: ${err.message}`, err);
    }
  }

  public getCycleById(id: string): GlobalCognitiveCycleEvent | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM global_cognitive_cycles WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapCycleRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get global cognitive cycle ${id}: ${err.message}`, err);
    }
  }

  public getCycleByTraceId(traceId: string): GlobalCognitiveCycleEvent | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM global_cognitive_cycles WHERE trace_id = ? ORDER BY started_at DESC LIMIT 1`)
        .get(traceId) as any;
      if (!row) return null;
      return this.mapCycleRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get cycle by traceId ${traceId}: ${err.message}`, err);
    }
  }

  public listCycles(limit: number = 50): GlobalCognitiveCycleEvent[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM global_cognitive_cycles ORDER BY started_at DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => this.mapCycleRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list global cognitive cycles: ${err.message}`, err);
    }
  }

  public deleteCycle(id: string): void {
    try {
      this.db.prepare(`DELETE FROM global_cognitive_cycles WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete global cognitive cycle ${id}: ${err.message}`, err);
    }
  }

  public saveSnapshot(snapshot: GlobalCognitiveSnapshot): void {
    try {
      this.db
        .prepare(
          `INSERT INTO global_cognitive_snapshots (snapshot_id, timestamp, snapshot_data_json)
           VALUES (?, ?, ?)
           ON CONFLICT(snapshot_id) DO UPDATE SET
             timestamp = excluded.timestamp,
             snapshot_data_json = excluded.snapshot_data_json`,
        )
        .run(snapshot.snapshotId, snapshot.timestamp, JSON.stringify(snapshot));
    } catch (err: any) {
      throw new DatabaseError(`Failed to save global cognitive snapshot ${snapshot.snapshotId}: ${err.message}`, err);
    }
  }

  public getLatestSnapshot(): GlobalCognitiveSnapshot | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM global_cognitive_snapshots ORDER BY timestamp DESC LIMIT 1`)
        .get() as any;
      if (!row) return null;
      return JSON.parse(row.snapshot_data_json);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest global cognitive snapshot: ${err.message}`, err);
    }
  }

  private mapCycleRow(row: any): GlobalCognitiveCycleEvent {
    return {
      id: row.id,
      traceId: row.trace_id,
      originSubsystem: row.origin_subsystem as any,
      eventType: row.event_type,
      description: row.description,
      contextSnapshot: JSON.parse(row.context_snapshot_json || '{}'),
      phaseExecutions: JSON.parse(row.phase_executions_json || '[]'),
      subsystemsInvolved: JSON.parse(row.subsystems_involved_json || '[]'),
      isCoherent: Boolean(row.is_coherent),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      totalLatencyMs: Number(row.total_latency_ms),
    };
  }
}
