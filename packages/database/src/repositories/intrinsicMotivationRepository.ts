import Database from 'better-sqlite3';
import {
  MotivatedActivity,
  MotivationOrientation,
  InternalizationRecord,
  MotivationReassessmentResult,
} from '@arletex/contracts';
import { DatabaseError, IIntrinsicMotivationRepository } from '@arletex/core';

export class SqliteIntrinsicMotivationRepository implements IIntrinsicMotivationRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveActivity(activity: MotivatedActivity): void {
    try {
      this.db
        .prepare(
          `INSERT INTO motivated_activities (
            id, title, description, orientation, source,
            personal_significance_score, autonomy_index, competence_driver,
            relatedness_driver, persistence_score, current_energy,
            is_externally_prompted, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            orientation = excluded.orientation,
            source = excluded.source,
            personal_significance_score = excluded.personal_significance_score,
            autonomy_index = excluded.autonomy_index,
            competence_driver = excluded.competence_driver,
            relatedness_driver = excluded.relatedness_driver,
            persistence_score = excluded.persistence_score,
            current_energy = excluded.current_energy,
            is_externally_prompted = excluded.is_externally_prompted,
            status = excluded.status,
            updated_at = excluded.updated_at`,
        )
        .run(
          activity.id,
          activity.title,
          activity.description,
          activity.orientation,
          activity.source,
          activity.personalSignificanceScore,
          activity.autonomyIndex,
          activity.competenceDriver || null,
          activity.relatednessDriver || null,
          activity.persistenceScore,
          activity.currentEnergy,
          activity.isExternallyPrompted ? 1 : 0,
          activity.status,
          activity.createdAt,
          activity.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save motivated activity ${activity.id}: ${err.message}`,
        err,
      );
    }
  }

  public getActivityById(id: string): MotivatedActivity | null {
    try {
      const row = this.db.prepare(`SELECT * FROM motivated_activities WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return this.mapActivityRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get motivated activity ${id}: ${err.message}`, err);
    }
  }

  public listActivities(filter?: {
    orientation?: MotivationOrientation;
    status?: string;
    limit?: number;
  }): MotivatedActivity[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.orientation) {
        conditions.push(`orientation = ?`);
        params.push(filter.orientation);
      }
      if (filter?.status) {
        conditions.push(`status = ?`);
        params.push(filter.status);
      }

      const limit = filter?.limit ?? 50;
      let query = `SELECT * FROM motivated_activities`;
      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
      }
      query += ` ORDER BY autonomy_index DESC, updated_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapActivityRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list motivated activities: ${err.message}`, err);
    }
  }

  public saveInternalization(record: InternalizationRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO goal_internalizations (
            id, activity_id, external_origin_context, internalized_rationale,
            pre_autonomy_index, post_autonomy_index, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            activity_id = excluded.activity_id,
            external_origin_context = excluded.external_origin_context,
            internalized_rationale = excluded.internalized_rationale,
            pre_autonomy_index = excluded.pre_autonomy_index,
            post_autonomy_index = excluded.post_autonomy_index,
            timestamp = excluded.timestamp`,
        )
        .run(
          record.id,
          record.activityId,
          record.externalOriginContext,
          record.internalizedRationale,
          record.preAutonomyIndex,
          record.postAutonomyIndex,
          record.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save goal internalization ${record.id}: ${err.message}`,
        err,
      );
    }
  }

  public getInternalizations(activityId?: string, limit: number = 50): InternalizationRecord[] {
    try {
      let rows: any[];
      if (activityId) {
        rows = this.db
          .prepare(
            `SELECT * FROM goal_internalizations WHERE activity_id = ? ORDER BY timestamp DESC LIMIT ?`,
          )
          .all(activityId, limit) as any[];
      } else {
        rows = this.db
          .prepare(`SELECT * FROM goal_internalizations ORDER BY timestamp DESC LIMIT ?`)
          .all(limit) as any[];
      }
      return rows.map((r) => ({
        id: r.id,
        activityId: r.activity_id,
        externalOriginContext: r.external_origin_context,
        internalizedRationale: r.internalized_rationale,
        preAutonomyIndex: r.pre_autonomy_index,
        postAutonomyIndex: r.post_autonomy_index,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to get goal internalizations: ${err.message}`, err);
    }
  }

  public saveReassessment(record: MotivationReassessmentResult): void {
    try {
      this.db
        .prepare(
          `INSERT INTO motivation_reassessments (
            id, activity_id, previous_energy, assessed_energy,
            motivation_loss_detected, loss_reason, recommendation,
            reassessment_rationale, evaluated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            activity_id = excluded.activity_id,
            previous_energy = excluded.previous_energy,
            assessed_energy = excluded.assessed_energy,
            motivation_loss_detected = excluded.motivation_loss_detected,
            loss_reason = excluded.loss_reason,
            recommendation = excluded.recommendation,
            reassessment_rationale = excluded.reassessment_rationale,
            evaluated_at = excluded.evaluated_at`,
        )
        .run(
          record.id,
          record.activityId,
          record.previousEnergy,
          record.assessedEnergy,
          record.motivationLossDetected ? 1 : 0,
          record.lossReason || null,
          record.recommendation,
          record.reassessmentRationale,
          record.evaluatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save motivation reassessment ${record.id}: ${err.message}`,
        err,
      );
    }
  }

  public getReassessments(activityId?: string, limit: number = 50): MotivationReassessmentResult[] {
    try {
      let rows: any[];
      if (activityId) {
        rows = this.db
          .prepare(
            `SELECT * FROM motivation_reassessments WHERE activity_id = ? ORDER BY evaluated_at DESC LIMIT ?`,
          )
          .all(activityId, limit) as any[];
      } else {
        rows = this.db
          .prepare(`SELECT * FROM motivation_reassessments ORDER BY evaluated_at DESC LIMIT ?`)
          .all(limit) as any[];
      }
      return rows.map((r) => ({
        id: r.id,
        activityId: r.activity_id,
        previousEnergy: r.previous_energy,
        assessedEnergy: r.assessed_energy,
        motivationLossDetected: Boolean(r.motivation_loss_detected),
        lossReason: r.loss_reason || undefined,
        recommendation: r.recommendation,
        reassessmentRationale: r.reassessment_rationale,
        evaluatedAt: r.evaluated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to get motivation reassessments: ${err.message}`, err);
    }
  }

  private mapActivityRow(row: any): MotivatedActivity {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      orientation: row.orientation,
      source: row.source,
      personalSignificanceScore: row.personal_significance_score,
      autonomyIndex: row.autonomy_index,
      competenceDriver: row.competence_driver || undefined,
      relatednessDriver: row.relatedness_driver || undefined,
      persistenceScore: row.persistence_score,
      currentEnergy: row.current_energy,
      isExternallyPrompted: Boolean(row.is_externally_prompted),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
