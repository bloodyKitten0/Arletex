import Database from 'better-sqlite3';
import {
  CognitivePrediction,
  PredictionStatus,
  PredictionType,
} from '@arletex/contracts';
import { DatabaseError, IPredictiveRepository } from '@arletex/core';

export class SqlitePredictiveRepository implements IPredictiveRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public createPrediction(prediction: CognitivePrediction): void {
    try {
      this.db
        .prepare(
          `INSERT INTO cognitive_predictions (
            id, domain, prediction_type, target_statement, predicted_probability,
            confidence, rationale, horizon_deadline, created_at, status,
            actual_outcome, actual_outcome_notes, resolved_at, prediction_error, brier_score
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            domain = excluded.domain,
            prediction_type = excluded.prediction_type,
            target_statement = excluded.target_statement,
            predicted_probability = excluded.predicted_probability,
            confidence = excluded.confidence,
            rationale = excluded.rationale,
            horizon_deadline = excluded.horizon_deadline,
            created_at = excluded.created_at,
            status = excluded.status,
            actual_outcome = excluded.actual_outcome,
            actual_outcome_notes = excluded.actual_outcome_notes,
            resolved_at = excluded.resolved_at,
            prediction_error = excluded.prediction_error,
            brier_score = excluded.brier_score`,
        )
        .run(
          prediction.id,
          prediction.domain,
          prediction.predictionType,
          prediction.targetStatement,
          prediction.predictedProbability,
          prediction.confidence,
          prediction.rationale,
          prediction.horizonDeadline,
          prediction.createdAt,
          prediction.status,
          prediction.actualOutcome !== undefined ? (prediction.actualOutcome ? 1 : 0) : null,
          prediction.actualOutcomeNotes ?? null,
          prediction.resolvedAt ?? null,
          prediction.predictionError !== undefined ? prediction.predictionError : null,
          prediction.brierScore !== undefined ? prediction.brierScore : null,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save prediction ${prediction.id}: ${err.message}`, err);
    }
  }

  public getPredictionById(id: string): CognitivePrediction | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM cognitive_predictions WHERE id = ?')
        .get(id) as any;
      if (!row) return null;
      return this.mapRowToPrediction(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get prediction ${id}: ${err.message}`, err);
    }
  }

  public updatePrediction(prediction: CognitivePrediction): void {
    this.createPrediction(prediction);
  }

  public listPredictions(filter?: {
    domain?: string;
    status?: PredictionStatus;
    predictionType?: PredictionType;
    limit?: number;
  }): CognitivePrediction[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.domain) {
        conditions.push('domain = ?');
        params.push(filter.domain);
      }
      if (filter?.status) {
        conditions.push('status = ?');
        params.push(filter.status);
      }
      if (filter?.predictionType) {
        conditions.push('prediction_type = ?');
        params.push(filter.predictionType);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filter?.limit ?? 100;

      const rows = this.db
        .prepare(`SELECT * FROM cognitive_predictions ${whereClause} ORDER BY created_at DESC LIMIT ?`)
        .all(...params, limit) as any[];

      return rows.map((r) => this.mapRowToPrediction(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list cognitive predictions: ${err.message}`, err);
    }
  }

  public deletePrediction(id: string): void {
    try {
      this.db.prepare('DELETE FROM cognitive_predictions WHERE id = ?').run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete prediction ${id}: ${err.message}`, err);
    }
  }

  private mapRowToPrediction(row: any): CognitivePrediction {
    return {
      id: row.id,
      domain: row.domain,
      predictionType: row.prediction_type,
      targetStatement: row.target_statement,
      predictedProbability: row.predicted_probability,
      confidence: row.confidence,
      rationale: row.rationale,
      horizonDeadline: row.horizon_deadline,
      createdAt: row.created_at,
      status: row.status,
      actualOutcome: row.actual_outcome === null || row.actual_outcome === undefined
        ? undefined
        : (row.actual_outcome === 1 || row.actual_outcome === true),
      actualOutcomeNotes: row.actual_outcome_notes ?? undefined,
      resolvedAt: row.resolved_at ?? undefined,
      predictionError: row.prediction_error !== null && row.prediction_error !== undefined ? row.prediction_error : undefined,
      brierScore: row.brier_score !== null && row.brier_score !== undefined ? row.brier_score : undefined,
    };
  }
}
