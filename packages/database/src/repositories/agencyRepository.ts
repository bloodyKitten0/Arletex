import type Database from 'better-sqlite3';
import { AgencyObservation, AgencyPlan, AgencyTask, VerificationResult } from '@arletex/contracts';

export class AgencyRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public createTask(task: AgencyTask): AgencyTask {
    const stmt = this.db.prepare(`
      INSERT INTO agency_tasks (
        id, title, objective, constraints, priority, initiator, status,
        completion_criteria, plan_id, current_step_index, total_steps,
        retry_count, max_retries, error, metadata, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.title,
      task.objective,
      JSON.stringify(task.constraints || []),
      task.priority,
      task.initiator,
      task.status,
      JSON.stringify(task.completionCriteria || []),
      task.planId || null,
      task.currentStepIndex,
      task.totalSteps,
      task.retryCount,
      task.maxRetries,
      task.error || null,
      JSON.stringify(task.metadata || {}),
      task.createdAt,
      task.updatedAt,
      task.completedAt || null,
    );

    return task;
  }

  public getTask(id: string): AgencyTask | null {
    const stmt = this.db.prepare(`SELECT * FROM agency_tasks WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;

    return this.mapTaskRow(row);
  }

  public updateTask(id: string, updates: Partial<AgencyTask>): AgencyTask {
    const current = this.getTask(id);
    if (!current) throw new Error(`Task ${id} not found`);

    const updated: AgencyTask = {
      ...current,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    };

    const stmt = this.db.prepare(`
      UPDATE agency_tasks SET
        title = ?, objective = ?, constraints = ?, priority = ?, initiator = ?,
        status = ?, completion_criteria = ?, plan_id = ?, current_step_index = ?,
        total_steps = ?, retry_count = ?, max_retries = ?, error = ?, metadata = ?,
        updated_at = ?, completed_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updated.title,
      updated.objective,
      JSON.stringify(updated.constraints || []),
      updated.priority,
      updated.initiator,
      updated.status,
      JSON.stringify(updated.completionCriteria || []),
      updated.planId || null,
      updated.currentStepIndex,
      updated.totalSteps,
      updated.retryCount,
      updated.maxRetries,
      updated.error || null,
      JSON.stringify(updated.metadata || {}),
      updated.updatedAt,
      updated.completedAt || null,
      id,
    );

    return updated;
  }

  public listTasks(status?: string, limit = 50): AgencyTask[] {
    let query = `SELECT * FROM agency_tasks`;
    const params: any[] = [];

    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }

    query += ` ORDER BY updated_at DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapTaskRow(r));
  }

  public savePlan(plan: AgencyPlan): AgencyPlan {
    const existing = this.db.prepare(`SELECT id FROM agency_plans WHERE id = ?`).get(plan.id);

    if (existing) {
      const stmt = this.db.prepare(`
        UPDATE agency_plans SET
          objective = ?, assumptions = ?, uncertainties = ?, steps = ?,
          alternative_approaches = ?, status = ?, version = ?, updated_at = ?
        WHERE id = ?
      `);
      stmt.run(
        plan.objective,
        JSON.stringify(plan.assumptions || []),
        JSON.stringify(plan.uncertainties || []),
        JSON.stringify(plan.steps || []),
        JSON.stringify(plan.alternativeApproaches || []),
        plan.status,
        plan.version,
        plan.updatedAt,
        plan.id,
      );
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO agency_plans (
          id, task_id, objective, assumptions, uncertainties, steps,
          alternative_approaches, status, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        plan.id,
        plan.taskId,
        plan.objective,
        JSON.stringify(plan.assumptions || []),
        JSON.stringify(plan.uncertainties || []),
        JSON.stringify(plan.steps || []),
        JSON.stringify(plan.alternativeApproaches || []),
        plan.status,
        plan.version,
        plan.createdAt,
        plan.updatedAt,
      );
    }

    return plan;
  }

  public getPlanByTask(taskId: string): AgencyPlan | null {
    const stmt = this.db.prepare(
      `SELECT * FROM agency_plans WHERE task_id = ? ORDER BY version DESC LIMIT 1`,
    );
    const row = stmt.get(taskId) as any;
    if (!row) return null;

    return {
      id: row.id,
      taskId: row.task_id,
      objective: row.objective,
      assumptions: JSON.parse(row.assumptions || '[]'),
      uncertainties: JSON.parse(row.uncertainties || '[]'),
      steps: JSON.parse(row.steps || '[]'),
      alternativeApproaches: JSON.parse(row.alternative_approaches || '[]'),
      status: row.status,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public saveObservation(obs: AgencyObservation): AgencyObservation {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agency_observations (
        id, task_id, action_id, source, timestamp, success, confidence,
        provenance, data, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      obs.id,
      obs.taskId || null,
      obs.actionId || null,
      obs.source,
      obs.timestamp,
      obs.success ? 1 : 0,
      obs.confidence,
      obs.provenance,
      JSON.stringify(obs.data || {}),
      obs.error || null,
    );

    return obs;
  }

  public getObservation(id: string): AgencyObservation | null {
    const stmt = this.db.prepare(`SELECT * FROM agency_observations WHERE id = ?`);
    const row = stmt.get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      taskId: row.task_id || undefined,
      actionId: row.action_id || undefined,
      source: row.source,
      timestamp: row.timestamp,
      success: Boolean(row.success),
      confidence: row.confidence,
      provenance: row.provenance,
      data: JSON.parse(row.data || '{}'),
      error: row.error || null,
    };
  }

  public saveVerification(ver: VerificationResult): VerificationResult {
    const stmt = this.db.prepare(`
      INSERT INTO agency_verifications (
        id, action_id, expected_outcome, observed_outcome, verified,
        confidence, failure_reason, is_recoverable, recommended_strategy, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      ver.actionId + '_' + Date.now(),
      ver.actionId,
      ver.expectedOutcome,
      ver.observedOutcome,
      ver.verified ? 1 : 0,
      ver.confidence,
      ver.failureReason || null,
      ver.isRecoverable ? 1 : 0,
      ver.recommendedStrategy || null,
      ver.timestamp,
    );

    return ver;
  }

  private mapTaskRow(row: any): AgencyTask {
    return {
      id: row.id,
      title: row.title,
      objective: row.objective,
      constraints: JSON.parse(row.constraints || '[]'),
      priority: row.priority,
      initiator: row.initiator,
      status: row.status,
      completionCriteria: JSON.parse(row.completion_criteria || '[]'),
      planId: row.plan_id || undefined,
      currentStepIndex: row.current_step_index,
      totalSteps: row.total_steps,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      error: row.error || null,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at || undefined,
    };
  }
}
