import Database from 'better-sqlite3';
import {
  InternalConflictRecord,
  InternalConflictStatus,
  assertDeliberationIntegrity,
  InternalAmbivalenceDebate,
} from '@arletex/contracts';
import { DatabaseError, IDeliberationRepository } from '@arletex/core';

export class SqliteDeliberationRepository implements IDeliberationRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveConflict(conflict: InternalConflictRecord): void {
    assertDeliberationIntegrity(conflict);
    try {
      this.db
        .prepare(
          `INSERT INTO internal_conflicts (
            id, context_description, competing_desires_json, alternatives_json,
            status, indecision_strategy, chosen_alternative_id, decision_justification,
            trade_off_analysis_json, post_decision_reassessment_json, created_at, resolved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            context_description = excluded.context_description,
            competing_desires_json = excluded.competing_desires_json,
            alternatives_json = excluded.alternatives_json,
            status = excluded.status,
            indecision_strategy = excluded.indecision_strategy,
            chosen_alternative_id = excluded.chosen_alternative_id,
            decision_justification = excluded.decision_justification,
            trade_off_analysis_json = excluded.trade_off_analysis_json,
            post_decision_reassessment_json = excluded.post_decision_reassessment_json,
            resolved_at = excluded.resolved_at`,
        )
        .run(
          conflict.id,
          conflict.contextDescription,
          JSON.stringify(conflict.competingDesires || []),
          JSON.stringify(conflict.alternatives || []),
          conflict.status,
          conflict.indecisionStrategy ?? null,
          conflict.chosenAlternativeId ?? null,
          conflict.decisionJustification ?? null,
          conflict.tradeOffAnalysis ? JSON.stringify(conflict.tradeOffAnalysis) : null,
          conflict.postDecisionReassessment
            ? JSON.stringify(conflict.postDecisionReassessment)
            : null,
          conflict.createdAt,
          conflict.resolvedAt ?? null,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save internal conflict ${conflict.id}: ${err.message}`,
        err,
      );
    }
  }

  public getConflictById(id: string): InternalConflictRecord | null {
    try {
      const row = this.db.prepare(`SELECT * FROM internal_conflicts WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return this.mapConflictRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get internal conflict ${id}: ${err.message}`, err);
    }
  }

  public listConflicts(filter?: {
    status?: InternalConflictStatus;
    limit?: number;
  }): InternalConflictRecord[] {
    try {
      let query = `SELECT * FROM internal_conflicts WHERE 1=1`;
      const params: any[] = [];

      if (filter?.status) {
        query += ` AND status = ?`;
        params.push(filter.status);
      }

      query += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(filter?.limit ?? 100);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapConflictRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list internal conflicts: ${err.message}`, err);
    }
  }

  public deleteConflict(id: string): void {
    try {
      this.db.prepare(`DELETE FROM internal_conflicts WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete internal conflict ${id}: ${err.message}`, err);
    }
  }

  public saveAmbivalenceDebate(debate: InternalAmbivalenceDebate): void {
    try {
      this.db
        .prepare(
          `INSERT INTO internal_conflicts (
            id, context_description, competing_desires_json, alternatives_json,
            status, indecision_strategy, chosen_alternative_id, decision_justification,
            trade_off_analysis_json, post_decision_reassessment_json, created_at, resolved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            context_description = excluded.context_description,
            competing_desires_json = excluded.competing_desires_json,
            alternatives_json = excluded.alternatives_json,
            status = excluded.status,
            chosen_alternative_id = excluded.chosen_alternative_id,
            decision_justification = excluded.decision_justification,
            trade_off_analysis_json = excluded.trade_off_analysis_json`,
        )
        .run(
          debate.id,
          `[ambivalence_debate] ${debate.topic}`,
          JSON.stringify(debate.voices),
          JSON.stringify(debate.internalMonologue),
          'resolved',
          'ambivalence_synthesis',
          debate.guardedDisclosureLevel,
          debate.outerExpressionGuidance,
          JSON.stringify({ synthesis: debate.synthesis, topic: debate.topic }),
          null,
          debate.debatedAt,
          debate.debatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save ambivalence debate ${debate.id}: ${err.message}`, err);
    }
  }

  public listAmbivalenceDebates(limit: number = 50): InternalAmbivalenceDebate[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM internal_conflicts WHERE context_description LIKE '[ambivalence_debate]%' ORDER BY created_at DESC LIMIT ?`,
        )
        .all(limit) as any[];
      return rows.map((r) => {
        const tradeOff = JSON.parse(r.trade_off_analysis_json || '{}');
        const rawTopic = r.context_description.replace('[ambivalence_debate] ', '');
        return {
          id: r.id,
          topic: tradeOff.topic || rawTopic,
          voices: JSON.parse(r.competing_desires_json || '[]'),
          internalMonologue: JSON.parse(r.alternatives_json || '[]'),
          synthesis: tradeOff.synthesis || '',
          guardedDisclosureLevel: r.chosen_alternative_id || 'measured_boundary',
          outerExpressionGuidance: r.decision_justification || '',
          debatedAt: r.created_at,
        };
      });
    } catch (err: any) {
      throw new DatabaseError(`Failed to list ambivalence debates: ${err.message}`, err);
    }
  }

  private mapConflictRow(row: any): InternalConflictRecord {
    return {
      id: row.id,
      contextDescription: row.context_description,
      competingDesires: JSON.parse(row.competing_desires_json || '[]'),
      alternatives: JSON.parse(row.alternatives_json || '[]'),
      status: row.status as InternalConflictStatus,
      indecisionStrategy: row.indecision_strategy || undefined,
      chosenAlternativeId: row.chosen_alternative_id || undefined,
      decisionJustification: row.decision_justification || undefined,
      tradeOffAnalysis: row.trade_off_analysis_json
        ? JSON.parse(row.trade_off_analysis_json)
        : undefined,
      postDecisionReassessment: row.post_decision_reassessment_json
        ? JSON.parse(row.post_decision_reassessment_json)
        : undefined,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at || undefined,
    };
  }
}
