import Database from 'better-sqlite3';
import {
  HabitExecutionLog,
  HabitRecord,
  NoveltyRoutineBalance,
} from '@arletex/contracts';
import { DatabaseError, IHabitsAndRoutinesRepository } from '@arletex/core';

export class SqliteHabitsAndRoutinesRepository implements IHabitsAndRoutinesRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveHabit(habit: HabitRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO habit_records (
            id, name, domain, description,
            triggers_json, routine_steps_json, repetition_count,
            automaticity_score, utility_score, is_active,
            is_modified, last_executed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            domain = excluded.domain,
            description = excluded.description,
            triggers_json = excluded.triggers_json,
            routine_steps_json = excluded.routine_steps_json,
            repetition_count = excluded.repetition_count,
            automaticity_score = excluded.automaticity_score,
            utility_score = excluded.utility_score,
            is_active = excluded.is_active,
            is_modified = excluded.is_modified,
            last_executed_at = excluded.last_executed_at,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at`,
        )
        .run(
          habit.id,
          habit.name,
          habit.domain,
          habit.description,
          JSON.stringify(habit.triggers),
          JSON.stringify(habit.routineSteps),
          habit.repetitionCount,
          habit.automaticityScore,
          habit.utilityScore,
          habit.isActive ? 1 : 0,
          habit.isModified ? 1 : 0,
          habit.lastExecutedAt || null,
          habit.createdAt,
          habit.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save habit ${habit.id}: ${err.message}`, err);
    }
  }

  public getHabitById(id: string): HabitRecord | null {
    try {
      const row = this.db.prepare(`SELECT * FROM habit_records WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        domain: row.domain,
        description: row.description,
        triggers: JSON.parse(row.triggers_json || '[]'),
        routineSteps: JSON.parse(row.routine_steps_json || '[]'),
        repetitionCount: row.repetition_count,
        automaticityScore: row.automaticity_score,
        utilityScore: row.utility_score,
        isActive: Boolean(row.is_active),
        isModified: Boolean(row.is_modified),
        lastExecutedAt: row.last_executed_at || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get habit ${id}: ${err.message}`, err);
    }
  }

  public listHabits(domain?: string, activeOnly: boolean = false, limit: number = 50): HabitRecord[] {
    try {
      let query = `SELECT * FROM habit_records`;
      const clauses: string[] = [];
      const params: any[] = [];

      if (domain) {
        clauses.push(`domain = ?`);
        params.push(domain);
      }
      if (activeOnly) {
        clauses.push(`is_active = 1`);
      }
      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(' AND ');
      }
      query += ` ORDER BY automaticity_score DESC, updated_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        domain: r.domain,
        description: r.description,
        triggers: JSON.parse(r.triggers_json || '[]'),
        routineSteps: JSON.parse(r.routine_steps_json || '[]'),
        repetitionCount: r.repetition_count,
        automaticityScore: r.automaticity_score,
        utilityScore: r.utility_score,
        isActive: Boolean(r.is_active),
        isModified: Boolean(r.is_modified),
        lastExecutedAt: r.last_executed_at || undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list habits: ${err.message}`, err);
    }
  }

  public saveExecutionLog(log: HabitExecutionLog): void {
    try {
      this.db
        .prepare(
          `INSERT INTO habit_execution_logs (
            id, habit_id, triggered_by, completed_steps,
            was_interrupted, interruption_reason, execution_outcome,
            outcome_utility, executed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            habit_id = excluded.habit_id,
            triggered_by = excluded.triggered_by,
            completed_steps = excluded.completed_steps,
            was_interrupted = excluded.was_interrupted,
            interruption_reason = excluded.interruption_reason,
            execution_outcome = excluded.execution_outcome,
            outcome_utility = excluded.outcome_utility,
            executed_at = excluded.executed_at`,
        )
        .run(
          log.id,
          log.habitId,
          log.triggeredBy,
          log.completedSteps,
          log.wasInterrupted ? 1 : 0,
          log.interruptionReason || null,
          log.executionOutcome,
          log.outcomeUtility,
          log.executedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save habit execution log ${log.id}: ${err.message}`, err);
    }
  }

  public listExecutionLogs(habitId?: string, limit: number = 50): HabitExecutionLog[] {
    try {
      let query = `SELECT * FROM habit_execution_logs`;
      const params: any[] = [];
      if (habitId) {
        query += ` WHERE habit_id = ?`;
        params.push(habitId);
      }
      query += ` ORDER BY executed_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        habitId: r.habit_id,
        triggeredBy: r.triggered_by,
        completedSteps: r.completed_steps,
        wasInterrupted: Boolean(r.was_interrupted),
        interruptionReason: r.interruption_reason || undefined,
        executionOutcome: r.execution_outcome,
        outcomeUtility: r.outcome_utility,
        executedAt: r.executed_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list habit execution logs: ${err.message}`, err);
    }
  }

  public saveBalance(balance: NoveltyRoutineBalance): void {
    try {
      this.db
        .prepare(
          `INSERT INTO novelty_routine_balance (
            id, routine_ratio, novelty_ratio, balance_status, assessed_at
          ) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          `bal_${Date.now()}`,
          balance.routineRatio,
          balance.noveltyRatio,
          balance.balanceStatus,
          balance.assessedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save novelty routine balance: ${err.message}`, err);
    }
  }

  public getLatestBalance(): NoveltyRoutineBalance | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM novelty_routine_balance ORDER BY assessed_at DESC LIMIT 1`)
        .get() as any;
      if (!row) return null;
      return {
        routineRatio: row.routine_ratio,
        noveltyRatio: row.novelty_ratio,
        balanceStatus: row.balance_status,
        assessedAt: row.assessed_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest balance: ${err.message}`, err);
    }
  }
}
