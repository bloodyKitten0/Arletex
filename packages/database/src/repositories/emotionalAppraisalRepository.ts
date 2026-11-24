import Database from 'better-sqlite3';
import {
  AppraisalInterpretationComparison,
  assertAppraisalDivergence,
  EmotionalTriggerNode,
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
      throw new DatabaseError(
        `Failed to save appraisal comparison ${comparison.id}: ${err.message}`,
        err,
      );
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

  public saveTriggerNode(node: EmotionalTriggerNode): void {
    try {
      this.db
        .prepare(
          `INSERT INTO trauma_trigger_nodes (
            id, trauma_memory_id, cue_type, cue_pattern, sensitivity,
            somatic_shock, flashback_pad_delta, defensive_postures, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            trauma_memory_id = excluded.trauma_memory_id,
            cue_type = excluded.cue_type,
            cue_pattern = excluded.cue_pattern,
            sensitivity = excluded.sensitivity,
            somatic_shock = excluded.somatic_shock,
            flashback_pad_delta = excluded.flashback_pad_delta,
            defensive_postures = excluded.defensive_postures`,
        )
        .run(
          node.id,
          node.traumaMemoryId,
          node.cueType,
          node.cuePattern,
          node.sensitivity,
          JSON.stringify(node.somaticShock),
          JSON.stringify(node.flashbackPadDelta),
          JSON.stringify(node.defensivePostures),
          node.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save trauma trigger node ${node.id}: ${err.message}`, err);
    }
  }

  public getTriggerNode(id: string): EmotionalTriggerNode | null {
    try {
      const row = this.db.prepare(`SELECT * FROM trauma_trigger_nodes WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return this.mapTriggerNodeRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get trauma trigger node ${id}: ${err.message}`, err);
    }
  }

  public listTriggerNodes(traumaMemoryId?: string): EmotionalTriggerNode[] {
    try {
      let query = `SELECT * FROM trauma_trigger_nodes`;
      const params: any[] = [];
      if (traumaMemoryId) {
        query += ` WHERE trauma_memory_id = ?`;
        params.push(traumaMemoryId);
      }
      query += ` ORDER BY created_at DESC`;
      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapTriggerNodeRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list trauma trigger nodes: ${err.message}`, err);
    }
  }

  public deleteTriggerNode(id: string): void {
    try {
      this.db.prepare(`DELETE FROM trauma_trigger_nodes WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete trauma trigger node ${id}: ${err.message}`, err);
    }
  }

  private mapTriggerNodeRow(row: any): EmotionalTriggerNode {
    return {
      id: row.id,
      traumaMemoryId: row.trauma_memory_id,
      cueType: row.cue_type,
      cuePattern: row.cue_pattern,
      sensitivity: Number(row.sensitivity),
      somaticShock: JSON.parse(row.somatic_shock || '{}'),
      flashbackPadDelta: JSON.parse(row.flashback_pad_delta || '{}'),
      defensivePostures: JSON.parse(row.defensive_postures || '[]'),
      createdAt: row.created_at,
    };
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
