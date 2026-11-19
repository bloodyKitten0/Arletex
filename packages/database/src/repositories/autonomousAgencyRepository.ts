import Database from 'better-sqlite3';
import {
  AutonomousActivityRecord,
  AutonomousActivityStatus,
  AutonomousActivityType,
  assertAutonomousActivityIntegrity,
} from '@arletex/contracts';
import { DatabaseError, IAutonomousActivityRepository } from '@arletex/core';

export class SqliteAutonomousAgencyRepository implements IAutonomousActivityRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveActivity(activity: AutonomousActivityRecord): void {
    assertAutonomousActivityIntegrity(activity);
    try {
      this.db
        .prepare(
          `INSERT INTO autonomous_activities (
            id, goal_id, plan_id, type, title, description,
            permission_level, target_resource, parameters_json,
            execution_result_json, verification_json, failure_info_json,
            proactive_message_json, status, initiated_at, completed_at, interrupted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            goal_id = excluded.goal_id,
            plan_id = excluded.plan_id,
            type = excluded.type,
            title = excluded.title,
            description = excluded.description,
            permission_level = excluded.permission_level,
            target_resource = excluded.target_resource,
            parameters_json = excluded.parameters_json,
            execution_result_json = excluded.execution_result_json,
            verification_json = excluded.verification_json,
            failure_info_json = excluded.failure_info_json,
            proactive_message_json = excluded.proactive_message_json,
            status = excluded.status,
            completed_at = excluded.completed_at,
            interrupted_at = excluded.interrupted_at`,
        )
        .run(
          activity.id,
          activity.goalId ?? null,
          activity.planId ?? null,
          activity.type,
          activity.title,
          activity.description,
          activity.permissionLevel,
          activity.targetResource,
          JSON.stringify(activity.parameters || {}),
          activity.executionResult ? JSON.stringify(activity.executionResult) : null,
          activity.verification ? JSON.stringify(activity.verification) : null,
          activity.failureInfo ? JSON.stringify(activity.failureInfo) : null,
          activity.proactiveMessage ? JSON.stringify(activity.proactiveMessage) : null,
          activity.status,
          activity.initiatedAt,
          activity.completedAt ?? null,
          activity.interruptedAt ?? null,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save autonomous activity ${activity.id}: ${err.message}`, err);
    }
  }

  public getActivityById(id: string): AutonomousActivityRecord | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM autonomous_activities WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapActivityRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get autonomous activity ${id}: ${err.message}`, err);
    }
  }

  public listActivities(filter?: {
    status?: AutonomousActivityStatus;
    type?: AutonomousActivityType;
    goalId?: string;
    limit?: number;
  }): AutonomousActivityRecord[] {
    try {
      let query = `SELECT * FROM autonomous_activities WHERE 1=1`;
      const params: any[] = [];

      if (filter?.status) {
        query += ` AND status = ?`;
        params.push(filter.status);
      }
      if (filter?.type) {
        query += ` AND type = ?`;
        params.push(filter.type);
      }
      if (filter?.goalId) {
        query += ` AND goal_id = ?`;
        params.push(filter.goalId);
      }

      query += ` ORDER BY initiated_at DESC LIMIT ?`;
      params.push(filter?.limit ?? 100);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapActivityRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list autonomous activities: ${err.message}`, err);
    }
  }

  public deleteActivity(id: string): void {
    try {
      this.db.prepare(`DELETE FROM autonomous_activities WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete autonomous activity ${id}: ${err.message}`, err);
    }
  }

  private mapActivityRow(row: any): AutonomousActivityRecord {
    return {
      id: row.id,
      goalId: row.goal_id || undefined,
      planId: row.plan_id || undefined,
      type: row.type as AutonomousActivityType,
      title: row.title,
      description: row.description,
      permissionLevel: row.permission_level,
      targetResource: row.target_resource,
      parameters: JSON.parse(row.parameters_json || '{}'),
      executionResult: row.execution_result_json ? JSON.parse(row.execution_result_json) : undefined,
      verification: row.verification_json ? JSON.parse(row.verification_json) : undefined,
      failureInfo: row.failure_info_json ? JSON.parse(row.failure_info_json) : undefined,
      proactiveMessage: row.proactive_message_json ? JSON.parse(row.proactive_message_json) : undefined,
      status: row.status as AutonomousActivityStatus,
      initiatedAt: row.initiated_at,
      completedAt: row.completed_at || undefined,
      interruptedAt: row.interrupted_at || undefined,
    };
  }
}
