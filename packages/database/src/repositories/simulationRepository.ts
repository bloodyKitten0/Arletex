import Database from 'better-sqlite3';
import {
  SimulationScenario,
  SimulationScenarioType,
  AlternativeDecisionEvaluation,
  assertSimulationIntegrity,
  assertDecisionEvaluationIntegrity,
} from '@arletex/contracts';
import { DatabaseError, ISimulationRepository } from '@arletex/core';

export class SqliteSimulationRepository implements ISimulationRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveScenario(scenario: SimulationScenario): void {
    assertSimulationIntegrity(scenario);
    try {
      this.db
        .prepare(
          `INSERT INTO simulation_scenarios (
            id, type, title, description, baseline_context,
            counterfactual_premise_json, hypothetical_params_json, branches_json,
            uncertainty, plausibility, is_imagined, is_episodic_memory,
            recommended_action, insights_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            title = excluded.title,
            description = excluded.description,
            baseline_context = excluded.baseline_context,
            counterfactual_premise_json = excluded.counterfactual_premise_json,
            hypothetical_params_json = excluded.hypothetical_params_json,
            branches_json = excluded.branches_json,
            uncertainty = excluded.uncertainty,
            plausibility = excluded.plausibility,
            is_imagined = excluded.is_imagined,
            is_episodic_memory = excluded.is_episodic_memory,
            recommended_action = excluded.recommended_action,
            insights_json = excluded.insights_json,
            created_at = excluded.created_at`,
        )
        .run(
          scenario.id,
          scenario.type,
          scenario.title,
          scenario.description,
          scenario.baselineContext,
          scenario.counterfactualPremise ? JSON.stringify(scenario.counterfactualPremise) : null,
          JSON.stringify(scenario.hypotheticalParameters ?? {}),
          JSON.stringify(scenario.branches ?? []),
          scenario.uncertainty,
          scenario.plausibility,
          scenario.isImagined ? 1 : 0,
          scenario.isEpisodicMemory ? 1 : 0,
          scenario.recommendedAction ?? null,
          JSON.stringify(scenario.insights ?? []),
          scenario.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save simulation scenario ${scenario.id}: ${err.message}`,
        err,
      );
    }
  }

  public getScenarioById(id: string): SimulationScenario | null {
    try {
      const row = this.db.prepare(`SELECT * FROM simulation_scenarios WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return this.mapScenarioRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get simulation scenario ${id}: ${err.message}`, err);
    }
  }

  public listScenarios(filter?: {
    type?: SimulationScenarioType;
    limit?: number;
  }): SimulationScenario[] {
    try {
      let query = `SELECT * FROM simulation_scenarios`;
      const params: any[] = [];
      const conditions: string[] = [];

      if (filter?.type) {
        conditions.push(`type = ?`);
        params.push(filter.type);
      }

      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
      }

      query += ` ORDER BY created_at DESC`;

      if (filter?.limit) {
        query += ` LIMIT ?`;
        params.push(filter.limit);
      }

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapScenarioRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list simulation scenarios: ${err.message}`, err);
    }
  }

  public deleteScenario(id: string): void {
    try {
      this.db.prepare(`DELETE FROM simulation_scenarios WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete simulation scenario ${id}: ${err.message}`, err);
    }
  }

  public saveDecisionEvaluation(evaluation: AlternativeDecisionEvaluation): void {
    assertDecisionEvaluationIntegrity(evaluation);
    try {
      this.db
        .prepare(
          `INSERT INTO alternative_decisions (
            id, decision_context, options_json, selected_option_id,
            rationale, is_imagined, is_episodic_memory, evaluated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            decision_context = excluded.decision_context,
            options_json = excluded.options_json,
            selected_option_id = excluded.selected_option_id,
            rationale = excluded.rationale,
            is_imagined = excluded.is_imagined,
            is_episodic_memory = excluded.is_episodic_memory,
            evaluated_at = excluded.evaluated_at`,
        )
        .run(
          evaluation.id,
          evaluation.decisionContext,
          JSON.stringify(evaluation.options ?? []),
          evaluation.selectedOptionId,
          evaluation.rationale,
          evaluation.isImagined ? 1 : 0,
          evaluation.isEpisodicMemory ? 1 : 0,
          evaluation.evaluatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save alternative decision evaluation ${evaluation.id}: ${err.message}`,
        err,
      );
    }
  }

  public getDecisionEvaluationById(id: string): AlternativeDecisionEvaluation | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM alternative_decisions WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapDecisionRow(row);
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to get alternative decision evaluation ${id}: ${err.message}`,
        err,
      );
    }
  }

  public listDecisionEvaluations(limit: number = 50): AlternativeDecisionEvaluation[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM alternative_decisions ORDER BY evaluated_at DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => this.mapDecisionRow(r));
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to list alternative decision evaluations: ${err.message}`,
        err,
      );
    }
  }

  public deleteDecisionEvaluation(id: string): void {
    try {
      this.db.prepare(`DELETE FROM alternative_decisions WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to delete alternative decision evaluation ${id}: ${err.message}`,
        err,
      );
    }
  }

  private mapScenarioRow(row: any): SimulationScenario {
    return {
      id: row.id,
      type: row.type as SimulationScenarioType,
      title: row.title,
      description: row.description,
      baselineContext: row.baseline_context,
      counterfactualPremise: row.counterfactual_premise_json
        ? JSON.parse(row.counterfactual_premise_json)
        : undefined,
      hypotheticalParameters: JSON.parse(row.hypothetical_params_json || '{}'),
      branches: JSON.parse(row.branches_json || '[]'),
      uncertainty: Number(row.uncertainty),
      plausibility: Number(row.plausibility),
      isImagined: Boolean(row.is_imagined),
      isEpisodicMemory: Boolean(row.is_episodic_memory),
      recommendedAction: row.recommended_action || undefined,
      insights: JSON.parse(row.insights_json || '[]'),
      createdAt: row.created_at,
    };
  }

  private mapDecisionRow(row: any): AlternativeDecisionEvaluation {
    return {
      id: row.id,
      decisionContext: row.decision_context,
      options: JSON.parse(row.options_json || '[]'),
      selectedOptionId: row.selected_option_id,
      rationale: row.rationale,
      isImagined: Boolean(row.is_imagined),
      isEpisodicMemory: Boolean(row.is_episodic_memory),
      evaluatedAt: row.evaluated_at,
    };
  }
}
