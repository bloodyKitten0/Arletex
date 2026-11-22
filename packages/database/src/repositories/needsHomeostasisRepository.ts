import Database from 'better-sqlite3';
import {
  HomeostaticNeedDefinition,
  HomeostaticNeedCategory,
  DriveState,
  HomeostaticActionResolution,
  assertNoFabricatedBiologicalNeed,
} from '@arletex/contracts';
import { DatabaseError, IHomeostasisRepository } from '@arletex/core';

export class SqliteNeedsHomeostasisRepository implements IHomeostasisRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveNeed(need: HomeostaticNeedDefinition): void {
    assertNoFabricatedBiologicalNeed(need.description);
    try {
      this.db
        .prepare(
          `INSERT INTO homeostatic_needs (
            id, category, name, description, target_optimal_level,
            current_level, deficit, urgency_weight, priority_score,
            last_satisfied_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(category) DO UPDATE SET
            id = excluded.id,
            name = excluded.name,
            description = excluded.description,
            target_optimal_level = excluded.target_optimal_level,
            current_level = excluded.current_level,
            deficit = excluded.deficit,
            urgency_weight = excluded.urgency_weight,
            priority_score = excluded.priority_score,
            last_satisfied_at = excluded.last_satisfied_at,
            updated_at = excluded.updated_at`,
        )
        .run(
          need.id,
          need.category,
          need.name,
          need.description,
          need.targetOptimalLevel,
          need.currentLevel,
          need.deficit,
          need.urgencyWeight,
          need.priorityScore,
          need.lastSatisfiedAt,
          need.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save homeostatic need ${need.category}: ${err.message}`,
        err,
      );
    }
  }

  public getNeedByCategory(category: HomeostaticNeedCategory): HomeostaticNeedDefinition | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM homeostatic_needs WHERE category = ?`)
        .get(category) as any;
      if (!row) return null;
      return this.mapNeedRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get need by category ${category}: ${err.message}`, err);
    }
  }

  public listNeeds(): HomeostaticNeedDefinition[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM homeostatic_needs ORDER BY priority_score DESC`)
        .all() as any[];
      return rows.map((r) => this.mapNeedRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list homeostatic needs: ${err.message}`, err);
    }
  }

  public saveDrive(drive: DriveState): void {
    assertNoFabricatedBiologicalNeed(drive.behavioralDirective);
    try {
      this.db
        .prepare(
          `INSERT INTO homeostatic_drives (
            id, need_category, drive_label, intensity,
            action_tendency, behavioral_directive, generated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            need_category = excluded.need_category,
            drive_label = excluded.drive_label,
            intensity = excluded.intensity,
            action_tendency = excluded.action_tendency,
            behavioral_directive = excluded.behavioral_directive,
            generated_at = excluded.generated_at`,
        )
        .run(
          drive.id,
          drive.needCategory,
          drive.driveLabel,
          drive.intensity,
          drive.actionTendency,
          drive.behavioralDirective,
          drive.generatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save drive ${drive.id}: ${err.message}`, err);
    }
  }

  public getActiveDrives(limit: number = 20): DriveState[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM homeostatic_drives ORDER BY intensity DESC, generated_at DESC LIMIT ?`,
        )
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        needCategory: r.need_category,
        driveLabel: r.drive_label,
        intensity: r.intensity,
        actionTendency: r.action_tendency,
        behavioralDirective: r.behavioral_directive,
        generatedAt: r.generated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to get active homeostatic drives: ${err.message}`, err);
    }
  }

  public recordResolution(res: HomeostaticActionResolution): void {
    assertNoFabricatedBiologicalNeed(res.actionTaken);
    try {
      this.db
        .prepare(
          `INSERT INTO homeostatic_action_resolutions (
            id, need_category, action_taken, pre_deficit,
            post_deficit, deficit_reduction, resource_freed_bytes, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          res.id,
          res.needCategory,
          res.actionTaken,
          res.preDeficit,
          res.postDeficit,
          res.deficitReduction,
          res.resourceFreedBytes ?? null,
          res.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to record action resolution ${res.id}: ${err.message}`, err);
    }
  }

  public listResolutions(limit: number = 50): HomeostaticActionResolution[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM homeostatic_action_resolutions ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        needCategory: r.need_category,
        actionTaken: r.action_taken,
        preDeficit: r.pre_deficit,
        postDeficit: r.post_deficit,
        deficitReduction: r.deficit_reduction,
        resourceFreedBytes: r.resource_freed_bytes ?? undefined,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list homeostatic action resolutions: ${err.message}`, err);
    }
  }

  private mapNeedRow(row: any): HomeostaticNeedDefinition {
    return {
      id: row.id,
      category: row.category,
      name: row.name,
      description: row.description,
      targetOptimalLevel: row.target_optimal_level,
      currentLevel: row.current_level,
      deficit: row.deficit,
      urgencyWeight: row.urgency_weight,
      priorityScore: row.priority_score,
      lastSatisfiedAt: row.last_satisfied_at,
      updatedAt: row.updated_at,
    };
  }
}
