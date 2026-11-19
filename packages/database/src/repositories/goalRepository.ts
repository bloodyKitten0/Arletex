import Database from 'better-sqlite3';
import {
  SelfGeneratedGoal,
  SelfGeneratedGoalStatus,
  GoalOriginType,
  assertSelfGeneratedGoalIntegrity,
} from '@arletex/contracts';
import { DatabaseError, ISelfGeneratedGoalRepository } from '@arletex/core';

export class SqliteSelfGeneratedGoalRepository implements ISelfGeneratedGoalRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveGoal(goal: SelfGeneratedGoal): void {
    assertSelfGeneratedGoalIntegrity(goal);
    try {
      this.db
        .prepare(
          `INSERT INTO self_generated_goals (
            id, title, description, origin, source_ref_id,
            priority, status, success_criteria_json, estimated_effort_hours,
            modifications_history_json, abandonment_reason, created_at, updated_at,
            abandoned_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            description = excluded.description,
            origin = excluded.origin,
            source_ref_id = excluded.source_ref_id,
            priority = excluded.priority,
            status = excluded.status,
            success_criteria_json = excluded.success_criteria_json,
            estimated_effort_hours = excluded.estimated_effort_hours,
            modifications_history_json = excluded.modifications_history_json,
            abandonment_reason = excluded.abandonment_reason,
            updated_at = excluded.updated_at,
            abandoned_at = excluded.abandoned_at,
            completed_at = excluded.completed_at`,
        )
        .run(
          goal.id,
          goal.title,
          goal.description,
          goal.origin,
          goal.sourceRefId ?? null,
          goal.priority,
          goal.status,
          JSON.stringify(goal.successCriteria || []),
          goal.estimatedEffortHours,
          JSON.stringify(goal.modificationsHistory || []),
          goal.abandonmentReason ?? null,
          goal.createdAt,
          goal.updatedAt,
          goal.abandonedAt ?? null,
          goal.completedAt ?? null,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save self-generated goal ${goal.id}: ${err.message}`, err);
    }
  }

  public getGoalById(id: string): SelfGeneratedGoal | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM self_generated_goals WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapGoalRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get self-generated goal ${id}: ${err.message}`, err);
    }
  }

  public listGoals(filter?: {
    status?: SelfGeneratedGoalStatus;
    origin?: GoalOriginType;
    limit?: number;
  }): SelfGeneratedGoal[] {
    try {
      let query = `SELECT * FROM self_generated_goals WHERE 1=1`;
      const params: any[] = [];

      if (filter?.status) {
        query += ` AND status = ?`;
        params.push(filter.status);
      }
      if (filter?.origin) {
        query += ` AND origin = ?`;
        params.push(filter.origin);
      }

      query += ` ORDER BY priority DESC, created_at DESC LIMIT ?`;
      params.push(filter?.limit ?? 100);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapGoalRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list self-generated goals: ${err.message}`, err);
    }
  }

  public deleteGoal(id: string): void {
    try {
      this.db.prepare(`DELETE FROM self_generated_goals WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete self-generated goal ${id}: ${err.message}`, err);
    }
  }

  public recordTrigger(trigger: {
    id: string;
    triggerType: string;
    sourceEntityId?: string;
    generatedGoalId: string;
    rationale: string;
    createdAt: string;
  }): void {
    try {
      this.db
        .prepare(
          `INSERT INTO goal_generation_triggers (
            id, trigger_type, source_entity_id, generated_goal_id, rationale, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          trigger.id,
          trigger.triggerType,
          trigger.sourceEntityId ?? null,
          trigger.generatedGoalId,
          trigger.rationale,
          trigger.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to record goal trigger: ${err.message}`, err);
    }
  }

  public listTriggers(generatedGoalId?: string): Array<{
    id: string;
    triggerType: string;
    sourceEntityId?: string;
    generatedGoalId: string;
    rationale: string;
    createdAt: string;
  }> {
    try {
      if (generatedGoalId) {
        const rows = this.db
          .prepare(`SELECT * FROM goal_generation_triggers WHERE generated_goal_id = ? ORDER BY created_at DESC`)
          .all(generatedGoalId) as any[];
        return rows.map((r) => this.mapTriggerRow(r));
      }
      const rows = this.db
        .prepare(`SELECT * FROM goal_generation_triggers ORDER BY created_at DESC LIMIT 100`)
        .all() as any[];
      return rows.map((r) => this.mapTriggerRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list goal triggers: ${err.message}`, err);
    }
  }

  private mapGoalRow(row: any): SelfGeneratedGoal {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      origin: row.origin as GoalOriginType,
      sourceRefId: row.source_ref_id || undefined,
      priority: Number(row.priority),
      status: row.status as SelfGeneratedGoalStatus,
      successCriteria: JSON.parse(row.success_criteria_json || '[]'),
      estimatedEffortHours: Number(row.estimated_effort_hours),
      modificationsHistory: JSON.parse(row.modifications_history_json || '[]'),
      abandonmentReason: row.abandonment_reason || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      abandonedAt: row.abandoned_at || undefined,
      completedAt: row.completed_at || undefined,
    };
  }

  private mapTriggerRow(row: any): {
    id: string;
    triggerType: string;
    sourceEntityId?: string;
    generatedGoalId: string;
    rationale: string;
    createdAt: string;
  } {
    return {
      id: row.id,
      triggerType: row.trigger_type,
      sourceEntityId: row.source_entity_id || undefined,
      generatedGoalId: row.generated_goal_id,
      rationale: row.rationale,
      createdAt: row.created_at,
    };
  }
}
