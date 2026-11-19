import Database from 'better-sqlite3';
import {
  ActionInhibitionEvaluation,
  TaskSwitchRecord,
  WorkingMemoryGatingDirective,
  ExecutiveControlState,
  assertActionInhibitionIntegrity,
  assertTaskSwitchIntegrity,
} from '@arletex/contracts';
import { DatabaseError, IExecutiveRepository } from '@arletex/core';

export class SqliteExecutiveRepository implements IExecutiveRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveInhibition(inhibition: ActionInhibitionEvaluation): void {
    assertActionInhibitionIntegrity(inhibition);
    try {
      this.db
        .prepare(
          `INSERT INTO action_inhibitions (
            id, action_name, proposed_payload_json, risk_score,
            is_inhibited, inhibition_reason, alternative_action, evaluated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            action_name = excluded.action_name,
            proposed_payload_json = excluded.proposed_payload_json,
            risk_score = excluded.risk_score,
            is_inhibited = excluded.is_inhibited,
            inhibition_reason = excluded.inhibition_reason,
            alternative_action = excluded.alternative_action,
            evaluated_at = excluded.evaluated_at`,
        )
        .run(
          inhibition.id,
          inhibition.actionName,
          JSON.stringify(inhibition.proposedPayload || {}),
          inhibition.riskScore,
          inhibition.isInhibited ? 1 : 0,
          inhibition.inhibitionReason ?? null,
          inhibition.alternativeAction ?? null,
          inhibition.evaluatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save action inhibition ${inhibition.id}: ${err.message}`, err);
    }
  }

  public getInhibitionById(id: string): ActionInhibitionEvaluation | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM action_inhibitions WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapInhibitionRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get action inhibition ${id}: ${err.message}`, err);
    }
  }

  public listInhibitions(limit: number = 50): ActionInhibitionEvaluation[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM action_inhibitions ORDER BY evaluated_at DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => this.mapInhibitionRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list action inhibitions: ${err.message}`, err);
    }
  }

  public saveTaskSwitch(record: TaskSwitchRecord): void {
    assertTaskSwitchIntegrity(record);
    try {
      this.db
        .prepare(
          `INSERT INTO executive_task_switches (
            id, previous_task_id, next_task_id, previous_task_priority,
            next_task_priority, switch_reason, context_saved, justification, switched_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            previous_task_id = excluded.previous_task_id,
            next_task_id = excluded.next_task_id,
            previous_task_priority = excluded.previous_task_priority,
            next_task_priority = excluded.next_task_priority,
            switch_reason = excluded.switch_reason,
            context_saved = excluded.context_saved,
            justification = excluded.justification,
            switched_at = excluded.switched_at`,
        )
        .run(
          record.id,
          record.previousTaskId,
          record.nextTaskId,
          record.previousTaskPriority,
          record.nextTaskPriority,
          record.switchReason,
          record.contextSaved ? 1 : 0,
          record.justification,
          record.switchedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save task switch ${record.id}: ${err.message}`, err);
    }
  }

  public getTaskSwitchById(id: string): TaskSwitchRecord | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM executive_task_switches WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapTaskSwitchRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get task switch ${id}: ${err.message}`, err);
    }
  }

  public listTaskSwitches(limit: number = 50): TaskSwitchRecord[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM executive_task_switches ORDER BY switched_at DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => this.mapTaskSwitchRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list task switches: ${err.message}`, err);
    }
  }

  public saveMemoryGating(gating: WorkingMemoryGatingDirective): void {
    try {
      this.db
        .prepare(
          `INSERT INTO executive_memory_gatings (
            id, target_buffer_id, operation, item_priority, reason, applied_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            target_buffer_id = excluded.target_buffer_id,
            operation = excluded.operation,
            item_priority = excluded.item_priority,
            reason = excluded.reason,
            applied_at = excluded.applied_at`,
        )
        .run(
          gating.id,
          gating.targetBufferId,
          gating.operation,
          gating.itemPriority,
          gating.reason,
          gating.appliedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save memory gating directive ${gating.id}: ${err.message}`, err);
    }
  }

  public listMemoryGatings(targetBufferId?: string, limit: number = 50): WorkingMemoryGatingDirective[] {
    try {
      let query = `SELECT * FROM executive_memory_gatings`;
      const params: any[] = [];
      if (targetBufferId) {
        query += ` WHERE target_buffer_id = ?`;
        params.push(targetBufferId);
      }
      query += ` ORDER BY applied_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        targetBufferId: r.target_buffer_id,
        operation: r.operation as any,
        itemPriority: Number(r.item_priority),
        reason: r.reason,
        appliedAt: r.applied_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list memory gatings: ${err.message}`, err);
    }
  }

  public saveControlState(state: ExecutiveControlState): void {
    try {
      this.db
        .prepare(
          `INSERT INTO executive_control_states (
            id, active_goal_id, sustained_attention_duration_ms,
            distraction_resistance_score, cognitive_flexibility_score,
            inhibited_action_count, task_switch_count, last_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            active_goal_id = excluded.active_goal_id,
            sustained_attention_duration_ms = excluded.sustained_attention_duration_ms,
            distraction_resistance_score = excluded.distraction_resistance_score,
            cognitive_flexibility_score = excluded.cognitive_flexibility_score,
            inhibited_action_count = excluded.inhibited_action_count,
            task_switch_count = excluded.task_switch_count,
            last_updated_at = excluded.last_updated_at`,
        )
        .run(
          state.id,
          state.activeGoalId,
          state.sustainedAttentionDurationMs,
          state.distractionResistanceScore,
          state.cognitiveFlexibilityScore,
          state.inhibitedActionCount,
          state.taskSwitchCount,
          state.lastUpdatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save executive control state: ${err.message}`, err);
    }
  }

  public getControlState(): ExecutiveControlState | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM executive_control_states ORDER BY last_updated_at DESC LIMIT 1`)
        .get() as any;
      if (!row) return null;
      return {
        id: row.id,
        activeGoalId: row.active_goal_id,
        sustainedAttentionDurationMs: Number(row.sustained_attention_duration_ms),
        distractionResistanceScore: Number(row.distraction_resistance_score),
        cognitiveFlexibilityScore: Number(row.cognitive_flexibility_score),
        inhibitedActionCount: Number(row.inhibited_action_count),
        taskSwitchCount: Number(row.task_switch_count),
        lastUpdatedAt: row.last_updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get executive control state: ${err.message}`, err);
    }
  }

  private mapInhibitionRow(row: any): ActionInhibitionEvaluation {
    return {
      id: row.id,
      actionName: row.action_name,
      proposedPayload: JSON.parse(row.proposed_payload_json || '{}'),
      riskScore: Number(row.risk_score),
      isInhibited: Boolean(row.is_inhibited),
      inhibitionReason: row.inhibition_reason || undefined,
      alternativeAction: row.alternative_action || undefined,
      evaluatedAt: row.evaluated_at,
    };
  }

  private mapTaskSwitchRow(row: any): TaskSwitchRecord {
    return {
      id: row.id,
      previousTaskId: row.previous_task_id,
      nextTaskId: row.next_task_id,
      previousTaskPriority: Number(row.previous_task_priority),
      nextTaskPriority: Number(row.next_task_priority),
      switchReason: row.switch_reason as any,
      contextSaved: Boolean(row.context_saved),
      justification: row.justification,
      switchedAt: row.switched_at,
    };
  }
}
