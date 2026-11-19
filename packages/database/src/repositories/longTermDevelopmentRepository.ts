import Database from 'better-sqlite3';
import {
  DevelopmentEpoch,
  DevelopmentHistoryEntry,
  IdentityAnchor,
  PsychologicalDimension,
} from '@arletex/contracts';
import { DatabaseError, ILongTermDevelopmentRepository } from '@arletex/core';

export class SqliteLongTermDevelopmentRepository implements ILongTermDevelopmentRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveHistoryEntry(entry: DevelopmentHistoryEntry): void {
    try {
      this.db
        .prepare(
          `INSERT INTO development_history_entries (
            id, dimension, target_key, previous_state,
            new_state, adaptation_driver, plasticity_score, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            dimension = excluded.dimension,
            target_key = excluded.target_key,
            previous_state = excluded.previous_state,
            new_state = excluded.new_state,
            adaptation_driver = excluded.adaptation_driver,
            plasticity_score = excluded.plasticity_score,
            timestamp = excluded.timestamp`,
        )
        .run(
          entry.id,
          entry.dimension,
          entry.targetKey,
          entry.previousState,
          entry.newState,
          entry.adaptationDriver,
          entry.plasticityScore,
          entry.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save development history entry ${entry.id}: ${err.message}`, err);
    }
  }

  public listHistoryEntries(
    dimension?: PsychologicalDimension,
    limit: number = 50,
  ): DevelopmentHistoryEntry[] {
    try {
      let query = `SELECT * FROM development_history_entries`;
      const params: any[] = [];
      if (dimension) {
        query += ` WHERE dimension = ?`;
        params.push(dimension);
      }
      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        dimension: r.dimension as PsychologicalDimension,
        targetKey: r.target_key,
        previousState: r.previous_state,
        newState: r.new_state,
        adaptationDriver: r.adaptation_driver,
        plasticityScore: r.plasticity_score,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list development history entries: ${err.message}`, err);
    }
  }

  public countHistoryEntries(): number {
    try {
      const row = this.db
        .prepare(`SELECT COUNT(*) as count FROM development_history_entries`)
        .get() as any;
      return row ? Number(row.count) : 0;
    } catch (err: any) {
      throw new DatabaseError(`Failed to count development history entries: ${err.message}`, err);
    }
  }

  public saveIdentityAnchor(anchor: IdentityAnchor): void {
    try {
      this.db
        .prepare(
          `INSERT INTO identity_anchors (
            id, anchor_key, description, stability_weight,
            is_immutable, last_verified_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(anchor_key) DO UPDATE SET
            description = excluded.description,
            stability_weight = excluded.stability_weight,
            is_immutable = excluded.is_immutable,
            last_verified_at = excluded.last_verified_at`,
        )
        .run(
          anchor.id,
          anchor.anchorKey,
          anchor.description,
          anchor.stabilityWeight,
          anchor.isImmutable ? 1 : 0,
          anchor.lastVerifiedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save identity anchor ${anchor.anchorKey}: ${err.message}`, err);
    }
  }

  public getIdentityAnchor(anchorKey: string): IdentityAnchor | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM identity_anchors WHERE anchor_key = ?`)
        .get(anchorKey) as any;
      if (!row) return null;
      return {
        id: row.id,
        anchorKey: row.anchor_key,
        description: row.description,
        stabilityWeight: row.stability_weight,
        isImmutable: Boolean(row.is_immutable),
        lastVerifiedAt: row.last_verified_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get identity anchor ${anchorKey}: ${err.message}`, err);
    }
  }

  public listIdentityAnchors(): IdentityAnchor[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM identity_anchors ORDER BY stability_weight DESC`)
        .all() as any[];
      return rows.map((r) => ({
        id: r.id,
        anchorKey: r.anchor_key,
        description: r.description,
        stabilityWeight: r.stability_weight,
        isImmutable: Boolean(r.is_immutable),
        lastVerifiedAt: r.last_verified_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list identity anchors: ${err.message}`, err);
    }
  }

  public saveEpoch(epoch: DevelopmentEpoch): void {
    try {
      this.db
        .prepare(
          `INSERT INTO development_epochs (
            id, epoch_name, summary, key_milestones_json,
            started_at, ended_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            epoch_name = excluded.epoch_name,
            summary = excluded.summary,
            key_milestones_json = excluded.key_milestones_json,
            started_at = excluded.started_at,
            ended_at = excluded.ended_at`,
        )
        .run(
          epoch.id,
          epoch.epochName,
          epoch.summary,
          JSON.stringify(epoch.keyMilestones || []),
          epoch.startedAt,
          epoch.endedAt || null,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save development epoch ${epoch.id}: ${err.message}`, err);
    }
  }

  public getCurrentEpoch(): DevelopmentEpoch | null {
    try {
      // Find open epoch (ended_at is null) or latest started
      const row = this.db
        .prepare(`SELECT * FROM development_epochs WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`)
        .get() as any;
      if (row) {
        return {
          id: row.id,
          epochName: row.epoch_name,
          summary: row.summary,
          keyMilestones: JSON.parse(row.key_milestones_json || '[]'),
          startedAt: row.started_at,
          endedAt: row.ended_at,
        };
      }
      const latest = this.db
        .prepare(`SELECT * FROM development_epochs ORDER BY started_at DESC LIMIT 1`)
        .get() as any;
      if (!latest) return null;
      return {
        id: latest.id,
        epochName: latest.epoch_name,
        summary: latest.summary,
        keyMilestones: JSON.parse(latest.key_milestones_json || '[]'),
        startedAt: latest.started_at,
        endedAt: latest.ended_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get current development epoch: ${err.message}`, err);
    }
  }

  public listEpochs(): DevelopmentEpoch[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM development_epochs ORDER BY started_at DESC`)
        .all() as any[];
      return rows.map((r) => ({
        id: r.id,
        epochName: r.epoch_name,
        summary: r.summary,
        keyMilestones: JSON.parse(r.key_milestones_json || '[]'),
        startedAt: r.started_at,
        endedAt: r.ended_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list development epochs: ${err.message}`, err);
    }
  }
}
