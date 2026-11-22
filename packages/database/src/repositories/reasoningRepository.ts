import Database from 'better-sqlite3';
import { ReasoningParadigm, ReasoningTask } from '@arletex/contracts';
import { DatabaseError, IReasoningRepository } from '@arletex/core';

export class SqliteReasoningRepository implements IReasoningRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveTask(task: ReasoningTask): void {
    try {
      this.db
        .prepare(
          `INSERT INTO reasoning_tasks (
            id, query, domain, primary_paradigm, premises, steps,
            final_conclusion, composite_confidence, uncertainty_level,
            argument_evaluation, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            query = excluded.query,
            domain = excluded.domain,
            primary_paradigm = excluded.primary_paradigm,
            premises = excluded.premises,
            steps = excluded.steps,
            final_conclusion = excluded.final_conclusion,
            composite_confidence = excluded.composite_confidence,
            uncertainty_level = excluded.uncertainty_level,
            argument_evaluation = excluded.argument_evaluation,
            timestamp = excluded.timestamp`,
        )
        .run(
          task.id,
          task.query,
          task.domain,
          task.primaryParadigm,
          JSON.stringify(task.premises),
          JSON.stringify(task.steps),
          task.finalConclusion,
          task.compositeConfidence,
          task.uncertaintyLevel,
          task.argumentEvaluation ? JSON.stringify(task.argumentEvaluation) : null,
          task.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save reasoning task ${task.id}: ${err.message}`, err);
    }
  }

  public getTaskById(id: string): ReasoningTask | null {
    try {
      const row = this.db.prepare('SELECT * FROM reasoning_tasks WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapRowToTask(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get reasoning task ${id}: ${err.message}`, err);
    }
  }

  public listTasks(filter?: {
    domain?: string;
    paradigm?: ReasoningParadigm;
    limit?: number;
  }): ReasoningTask[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.domain) {
        conditions.push('domain = ?');
        params.push(filter.domain);
      }
      if (filter?.paradigm) {
        conditions.push('primary_paradigm = ?');
        params.push(filter.paradigm);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filter?.limit ?? 50;

      const rows = this.db
        .prepare(`SELECT * FROM reasoning_tasks ${whereClause} ORDER BY timestamp DESC LIMIT ?`)
        .all(...params, limit) as any[];

      return rows.map((r) => this.mapRowToTask(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list reasoning tasks: ${err.message}`, err);
    }
  }

  public deleteTask(id: string): void {
    try {
      this.db.prepare('DELETE FROM reasoning_tasks WHERE id = ?').run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete reasoning task ${id}: ${err.message}`, err);
    }
  }

  private mapRowToTask(row: any): ReasoningTask {
    return {
      id: row.id,
      query: row.query,
      domain: row.domain,
      primaryParadigm: row.primary_paradigm,
      premises: typeof row.premises === 'string' ? JSON.parse(row.premises) : (row.premises ?? []),
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : (row.steps ?? []),
      finalConclusion: row.final_conclusion,
      compositeConfidence: row.composite_confidence,
      uncertaintyLevel: row.uncertainty_level,
      argumentEvaluation: row.argument_evaluation
        ? typeof row.argument_evaluation === 'string'
          ? JSON.parse(row.argument_evaluation)
          : row.argument_evaluation
        : undefined,
      timestamp: row.timestamp,
    };
  }
}
