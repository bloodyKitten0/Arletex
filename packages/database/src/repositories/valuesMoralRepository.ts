import Database from 'better-sqlite3';
import {
  EthicalDilemmaResolution,
  MoralLearningRecord,
  MoralPrinciple,
  MoralPrincipleCategory,
} from '@arletex/contracts';
import { DatabaseError, IValuesMoralRepository } from '@arletex/core';

export class SqliteValuesMoralRepository implements IValuesMoralRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public savePrinciple(principle: MoralPrinciple): void {
    try {
      this.db
        .prepare(
          `INSERT INTO moral_principles (
            id, category, statement, weight,
            rationale, is_revisable, last_reconsidered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            category = excluded.category,
            statement = excluded.statement,
            weight = excluded.weight,
            rationale = excluded.rationale,
            is_revisable = excluded.is_revisable,
            last_reconsidered_at = excluded.last_reconsidered_at`,
        )
        .run(
          principle.id,
          principle.category,
          principle.statement,
          principle.weight,
          principle.rationale,
          principle.isRevisable ? 1 : 0,
          principle.lastReconsideredAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save moral principle ${principle.id}: ${err.message}`,
        err,
      );
    }
  }

  public getPrincipleById(id: string): MoralPrinciple | null {
    try {
      const row = this.db.prepare(`SELECT * FROM moral_principles WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        category: row.category as MoralPrincipleCategory,
        statement: row.statement,
        weight: row.weight,
        rationale: row.rationale,
        isRevisable: Boolean(row.is_revisable),
        lastReconsideredAt: row.last_reconsidered_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get moral principle ${id}: ${err.message}`, err);
    }
  }

  public listPrinciples(category?: MoralPrincipleCategory, limit: number = 50): MoralPrinciple[] {
    try {
      let query = `SELECT * FROM moral_principles`;
      const params: any[] = [];
      if (category) {
        query += ` WHERE category = ?`;
        params.push(category);
      }
      query += ` ORDER BY weight DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        category: r.category as MoralPrincipleCategory,
        statement: r.statement,
        weight: r.weight,
        rationale: r.rationale,
        isRevisable: Boolean(r.is_revisable),
        lastReconsideredAt: r.last_reconsidered_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list moral principles: ${err.message}`, err);
    }
  }

  public saveResolution(resolution: EthicalDilemmaResolution): void {
    try {
      this.db
        .prepare(
          `INSERT INTO ethical_dilemma_resolutions (
            id, scenario, competing_values_json, harm_assessment_json,
            intention_evaluation_json, chosen_action, ethical_justification,
            resolved_principles_json, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            scenario = excluded.scenario,
            competing_values_json = excluded.competing_values_json,
            harm_assessment_json = excluded.harm_assessment_json,
            intention_evaluation_json = excluded.intention_evaluation_json,
            chosen_action = excluded.chosen_action,
            ethical_justification = excluded.ethical_justification,
            resolved_principles_json = excluded.resolved_principles_json,
            timestamp = excluded.timestamp`,
        )
        .run(
          resolution.id,
          resolution.scenario,
          JSON.stringify(resolution.competingValues),
          JSON.stringify(resolution.harmAssessment),
          JSON.stringify(resolution.intentionEvaluation),
          resolution.chosenAction,
          resolution.ethicalJustification,
          JSON.stringify(resolution.resolvedPrinciples),
          resolution.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save ethical dilemma resolution ${resolution.id}: ${err.message}`,
        err,
      );
    }
  }

  public getResolutionById(id: string): EthicalDilemmaResolution | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM ethical_dilemma_resolutions WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        scenario: row.scenario,
        competingValues: JSON.parse(row.competing_values_json),
        harmAssessment: JSON.parse(row.harm_assessment_json),
        intentionEvaluation: JSON.parse(row.intention_evaluation_json),
        chosenAction: row.chosen_action,
        ethicalJustification: row.ethical_justification,
        resolvedPrinciples: JSON.parse(row.resolved_principles_json || '[]'),
        timestamp: row.timestamp,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get ethical resolution ${id}: ${err.message}`, err);
    }
  }

  public listResolutions(limit: number = 50): EthicalDilemmaResolution[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM ethical_dilemma_resolutions ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        scenario: r.scenario,
        competingValues: JSON.parse(r.competing_values_json),
        harmAssessment: JSON.parse(r.harm_assessment_json),
        intentionEvaluation: JSON.parse(r.intention_evaluation_json),
        chosenAction: r.chosen_action,
        ethicalJustification: r.ethical_justification,
        resolvedPrinciples: JSON.parse(r.resolved_principles_json || '[]'),
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list ethical resolutions: ${err.message}`, err);
    }
  }

  public saveMoralLearning(record: MoralLearningRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO moral_learning_records (
            id, dilemma_id, principle_id, previous_weight,
            new_weight, reflection_summary, reconsidered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.id,
          record.dilemmaId || null,
          record.principleId,
          record.previousWeight,
          record.newWeight,
          record.reflectionSummary,
          record.reconsideredAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save moral learning record ${record.id}: ${err.message}`,
        err,
      );
    }
  }

  public listMoralLearningRecords(principleId?: string, limit: number = 50): MoralLearningRecord[] {
    try {
      let query = `SELECT * FROM moral_learning_records`;
      const params: any[] = [];
      if (principleId) {
        query += ` WHERE principle_id = ?`;
        params.push(principleId);
      }
      query += ` ORDER BY reconsidered_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        dilemmaId: r.dilemma_id || undefined,
        principleId: r.principle_id,
        previousWeight: r.previous_weight,
        newWeight: r.new_weight,
        reflectionSummary: r.reflection_summary,
        reconsideredAt: r.reconsidered_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list moral learning records: ${err.message}`, err);
    }
  }
}
