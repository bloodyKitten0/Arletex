import Database from 'better-sqlite3';
import {
  ActivityStatus,
  EnvironmentalEvent,
  EventLayer,
  OperationalActivity,
  SituationalContextSnapshot,
} from '@arletex/contracts';
import { DatabaseError, ISituationalRepository } from '@arletex/core';

export class SituationalRepository implements ISituationalRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Operational Activities
  // ==========================================

  public saveActivity(activity: OperationalActivity): void {
    try {
      this.db
        .prepare(
          `INSERT INTO operational_activities (
            id, title, description, category, status,
            started_at, last_active_at, active_application,
            associated_goal_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            category = excluded.category,
            status = excluded.status,
            last_active_at = excluded.last_active_at,
            active_application = excluded.active_application,
            associated_goal_id = excluded.associated_goal_id`,
        )
        .run(
          activity.id,
          activity.title,
          activity.description,
          activity.category,
          activity.status,
          activity.startedAt,
          activity.lastActiveAt,
          JSON.stringify(activity.activeApplication),
          activity.associatedGoalId ?? null,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save operational activity ${activity.id}: ${err.message}`,
        err,
      );
    }
  }

  public getActivityById(id: string): OperationalActivity | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM operational_activities WHERE id = ?')
        .get(id) as any;
      if (!row) return null;
      return this.mapActivityRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get activity ${id}: ${err.message}`, err);
    }
  }

  public getActiveActivity(): OperationalActivity | null {
    try {
      const row = this.db
        .prepare(
          'SELECT * FROM operational_activities WHERE status = ? ORDER BY last_active_at DESC LIMIT 1',
        )
        .get('active') as any;
      if (!row) return null;
      return this.mapActivityRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get active operational activity: ${err.message}`, err);
    }
  }

  public listActivities(status?: ActivityStatus, limit = 50): OperationalActivity[] {
    try {
      let query = 'SELECT * FROM operational_activities';
      const params: any[] = [];
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      query += ' ORDER BY last_active_at DESC LIMIT ?';
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapActivityRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list operational activities: ${err.message}`, err);
    }
  }

  // ==========================================
  // Environmental Events
  // ==========================================

  public recordEnvironmentalEvent(event: EnvironmentalEvent): void {
    try {
      this.db
        .prepare(
          `INSERT INTO environmental_events (
            id, timestamp, event_type, layer, description,
            source, relevance_score, is_interruption,
            interrupted_activity_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            relevance_score = excluded.relevance_score,
            is_interruption = excluded.is_interruption,
            interrupted_activity_id = excluded.interrupted_activity_id`,
        )
        .run(
          event.id,
          event.timestamp,
          event.eventType,
          event.layer,
          event.description,
          event.source,
          event.relevanceScore,
          event.isInterruption ? 1 : 0,
          event.interruptedActivityId ?? null,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to record environmental event ${event.id}: ${err.message}`,
        err,
      );
    }
  }

  public getEnvironmentalEventById(id: string): EnvironmentalEvent | null {
    try {
      const row = this.db.prepare('SELECT * FROM environmental_events WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapEventRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get environmental event ${id}: ${err.message}`, err);
    }
  }

  public listEnvironmentalEvents(filter?: {
    layer?: EventLayer;
    isInterruption?: boolean;
    minRelevance?: number;
    limit?: number;
  }): EnvironmentalEvent[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.layer) {
        conditions.push('layer = ?');
        params.push(filter.layer);
      }
      if (filter?.isInterruption !== undefined) {
        conditions.push('is_interruption = ?');
        params.push(filter.isInterruption ? 1 : 0);
      }
      if (filter?.minRelevance !== undefined) {
        conditions.push('relevance_score >= ?');
        params.push(filter.minRelevance);
      }

      let query = 'SELECT * FROM environmental_events';
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(filter?.limit ?? 50);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapEventRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list environmental events: ${err.message}`, err);
    }
  }

  // ==========================================
  // Situational Context Snapshots
  // ==========================================

  public saveSnapshot(snapshot: SituationalContextSnapshot): void {
    try {
      this.db
        .prepare(
          `INSERT INTO situational_snapshots (
            id, timestamp, current_activity_id, snapshot_data,
            situational_narrative, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            situational_narrative = excluded.situational_narrative,
            snapshot_data = excluded.snapshot_data`,
        )
        .run(
          snapshot.id,
          snapshot.timestamp,
          snapshot.currentActivity.id,
          JSON.stringify(snapshot),
          snapshot.situationalNarrative,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save situational snapshot ${snapshot.id}: ${err.message}`,
        err,
      );
    }
  }

  public getSnapshotById(id: string): SituationalContextSnapshot | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM situational_snapshots WHERE id = ?')
        .get(id) as any;
      if (!row) return null;
      return JSON.parse(row.snapshot_data);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get situational snapshot ${id}: ${err.message}`, err);
    }
  }

  public getLatestSnapshot(): SituationalContextSnapshot | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM situational_snapshots ORDER BY timestamp DESC LIMIT 1')
        .get() as any;
      if (!row) return null;
      return JSON.parse(row.snapshot_data);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest situational snapshot: ${err.message}`, err);
    }
  }

  public listSnapshots(limit = 20): SituationalContextSnapshot[] {
    try {
      const rows = this.db
        .prepare('SELECT * FROM situational_snapshots ORDER BY timestamp DESC LIMIT ?')
        .all(limit) as any[];
      return rows.map((r) => JSON.parse(r.snapshot_data));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list situational snapshots: ${err.message}`, err);
    }
  }

  // ==========================================
  // Row Mappers
  // ==========================================

  private mapActivityRow(row: any): OperationalActivity {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      status: row.status,
      startedAt: row.started_at,
      lastActiveAt: row.last_active_at,
      activeApplication: JSON.parse(row.active_application),
      associatedGoalId: row.associated_goal_id ?? undefined,
    };
  }

  private mapEventRow(row: any): EnvironmentalEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      layer: row.layer,
      description: row.description,
      source: row.source,
      relevanceScore: Number(row.relevance_score),
      isInterruption: Boolean(row.is_interruption),
      interruptedActivityId: row.interrupted_activity_id ?? undefined,
    };
  }
}
