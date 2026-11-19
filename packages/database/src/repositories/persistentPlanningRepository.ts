import Database from 'better-sqlite3';
import {
  MultiStagePlan,
  MultiStagePlanStatus,
  LongTermCommitment,
  LongTermCommitmentStatus,
  assertMultiStagePlanIntegrity,
} from '@arletex/contracts';
import { DatabaseError, IPersistentPlanningRepository } from '@arletex/core';

export class SqlitePersistentPlanningRepository implements IPersistentPlanningRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public savePlan(plan: MultiStagePlan): void {
    assertMultiStagePlanIntegrity(plan);
    try {
      this.db
        .prepare(
          `INSERT INTO persistent_plans (
            id, goal_id, title, description, stages_json,
            overall_priority, overall_progress, status, scheduled_start,
            target_completion, revisions_history_json, recovery_state_json,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            goal_id = excluded.goal_id,
            title = excluded.title,
            description = excluded.description,
            stages_json = excluded.stages_json,
            overall_priority = excluded.overall_priority,
            overall_progress = excluded.overall_progress,
            status = excluded.status,
            scheduled_start = excluded.scheduled_start,
            target_completion = excluded.target_completion,
            revisions_history_json = excluded.revisions_history_json,
            recovery_state_json = excluded.recovery_state_json,
            updated_at = excluded.updated_at`,
        )
        .run(
          plan.id,
          plan.goalId,
          plan.title,
          plan.description,
          JSON.stringify(plan.stages || []),
          plan.overallPriority,
          plan.overallProgress,
          plan.status,
          plan.scheduledStart,
          plan.targetCompletion,
          JSON.stringify(plan.revisionsHistory || []),
          plan.recoveryState ? JSON.stringify(plan.recoveryState) : null,
          plan.createdAt,
          plan.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save multi-stage plan ${plan.id}: ${err.message}`, err);
    }
  }

  public getPlanById(id: string): MultiStagePlan | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM persistent_plans WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapPlanRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get plan ${id}: ${err.message}`, err);
    }
  }

  public getPlanByGoalId(goalId: string): MultiStagePlan | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM persistent_plans WHERE goal_id = ? ORDER BY created_at DESC LIMIT 1`)
        .get(goalId) as any;
      if (!row) return null;
      return this.mapPlanRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get plan by goalId ${goalId}: ${err.message}`, err);
    }
  }

  public listPlans(filter?: { status?: MultiStagePlanStatus; limit?: number }): MultiStagePlan[] {
    try {
      let query = `SELECT * FROM persistent_plans WHERE 1=1`;
      const params: any[] = [];

      if (filter?.status) {
        query += ` AND status = ?`;
        params.push(filter.status);
      }

      query += ` ORDER BY overall_priority DESC, created_at DESC LIMIT ?`;
      params.push(filter?.limit ?? 100);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapPlanRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list plans: ${err.message}`, err);
    }
  }

  public deletePlan(id: string): void {
    try {
      this.db.prepare(`DELETE FROM persistent_plans WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete plan ${id}: ${err.message}`, err);
    }
  }

  public saveCommitment(commitment: LongTermCommitment): void {
    try {
      this.db
        .prepare(
          `INSERT INTO long_term_commitments (
            id, title, stakeholder, promise_statement, associated_plan_id,
            due_timestamp, status, fulfillment_evidence, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            stakeholder = excluded.stakeholder,
            promise_statement = excluded.promise_statement,
            associated_plan_id = excluded.associated_plan_id,
            due_timestamp = excluded.due_timestamp,
            status = excluded.status,
            fulfillment_evidence = excluded.fulfillment_evidence,
            updated_at = excluded.updated_at`,
        )
        .run(
          commitment.id,
          commitment.title,
          commitment.stakeholder,
          commitment.promiseStatement,
          commitment.associatedPlanId ?? null,
          commitment.dueTimestamp ?? null,
          commitment.status,
          commitment.fulfillmentEvidence ?? null,
          commitment.createdAt,
          commitment.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save commitment ${commitment.id}: ${err.message}`, err);
    }
  }

  public getCommitmentById(id: string): LongTermCommitment | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM long_term_commitments WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapCommitmentRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get commitment ${id}: ${err.message}`, err);
    }
  }

  public listCommitments(filter?: {
    stakeholder?: string;
    status?: LongTermCommitmentStatus;
    limit?: number;
  }): LongTermCommitment[] {
    try {
      let query = `SELECT * FROM long_term_commitments WHERE 1=1`;
      const params: any[] = [];

      if (filter?.stakeholder) {
        query += ` AND stakeholder = ?`;
        params.push(filter.stakeholder);
      }
      if (filter?.status) {
        query += ` AND status = ?`;
        params.push(filter.status);
      }

      query += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(filter?.limit ?? 100);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapCommitmentRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list commitments: ${err.message}`, err);
    }
  }

  public deleteCommitment(id: string): void {
    try {
      this.db.prepare(`DELETE FROM long_term_commitments WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete commitment ${id}: ${err.message}`, err);
    }
  }

  private mapPlanRow(row: any): MultiStagePlan {
    return {
      id: row.id,
      goalId: row.goal_id,
      title: row.title,
      description: row.description,
      stages: JSON.parse(row.stages_json || '[]'),
      overallPriority: Number(row.overall_priority),
      overallProgress: Number(row.overall_progress),
      status: row.status as MultiStagePlanStatus,
      scheduledStart: row.scheduled_start,
      targetCompletion: row.target_completion,
      revisionsHistory: JSON.parse(row.revisions_history_json || '[]'),
      recoveryState: row.recovery_state_json ? JSON.parse(row.recovery_state_json) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCommitmentRow(row: any): LongTermCommitment {
    return {
      id: row.id,
      title: row.title,
      stakeholder: row.stakeholder,
      promiseStatement: row.promise_statement,
      associatedPlanId: row.associated_plan_id || undefined,
      dueTimestamp: row.due_timestamp || undefined,
      status: row.status as LongTermCommitmentStatus,
      fulfillmentEvidence: row.fulfillment_evidence || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
