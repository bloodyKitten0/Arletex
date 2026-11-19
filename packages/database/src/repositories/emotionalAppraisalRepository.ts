import Database from 'better-sqlite3';
import {
  AppraisalInterpretationComparison,
  assertAppraisalDivergence,
} from '@arletex/contracts';
import { DatabaseError, IEmotionalAppraisalRepository } from '@arletex/core';

export class SqliteEmotionalAppraisalRepository implements IEmotionalAppraisalRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveComparison(comparison: AppraisalInterpretationComparison): void {
    assertAppraisalDivergence(comparison);
    try {
      this.db
        .prepare(
          `INSERT INTO appraisal_comparisons (
            id, event_id, event_content, interpretations_json,
            divergence_score, divergence_explanation, evaluated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            event_id = excluded.event_id,
            event_content = excluded.event_content,
            interpretations_json = excluded.interpretations_json,
            divergence_score = excluded.divergence_score,
            divergence_explanation = excluded.divergence_explanation,
            evaluated_at = excluded.evaluated_at`,
        )
        .run(
          comparison.id,
          comparison.eventId,
          comparison.eventContent,
          JSON.stringify(comparison.interpretations || []),
          comparison.emotionalDivergenceScore,
          comparison.divergenceExplanation,
          comparison.evaluatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save appraisal comparison ${comparison.id}: ${err.message}`, err);
    }
  }

  public getComparisonById(id: string): AppraisalInterpretationComparison | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM appraisal_comparisons WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapComparisonRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get appraisal comparison ${id}: ${err.message}`, err);
    }
  }

  public listComparisons(limit: number = 50): AppraisalInterpretationComparison[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM appraisal_comparisons ORDER BY evaluated_at DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => this.mapComparisonRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list appraisal comparisons: ${err.message}`, err);
    }
  }

  public deleteComparison(id: string): void {
    try {
      this.db.prepare(`DELETE FROM appraisal_comparisons WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete appraisal comparison ${id}: ${err.message}`, err);
    }
  }

  private mapComparisonRow(row: any): AppraisalInterpretationComparison {
    return {
      id: row.id,
      eventId: row.event_id,
      eventContent: row.event_content,
      interpretations: JSON.parse(row.interpretations_json || '[]'),
      emotionalDivergenceScore: Number(row.divergence_score),
      divergenceExplanation: row.divergence_explanation,
      evaluatedAt: row.evaluated_at,
    };
  }
}
