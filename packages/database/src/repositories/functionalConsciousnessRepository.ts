import Database from 'better-sqlite3';
import {
  HomeostaticSubstrateState,
  PredictiveExpectation,
  SleepDreamCycleRecord,
  DualProcessThought,
  AutonomousBoundaryPushback,
  DefaultModeWanderingState,
} from '@arletex/contracts';
import { DatabaseError, IFunctionalConsciousnessRepository } from '@arletex/core';

export class SqliteFunctionalConsciousnessRepository implements IFunctionalConsciousnessRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public getHomeostasis(): HomeostaticSubstrateState | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM homeostatic_substrate_state WHERE id = 'current'`)
        .get() as any;
      if (!row) return null;
      return {
        energy: row.energy,
        fatigue: row.fatigue,
        allostaticStressLoad: row.allostatic_stress_load,
        satiation: row.satiation,
        noveltyAppetite: row.novelty_appetite,
        staminaFocusScore: row.stamina_focus_score,
        lastReplenishedAt: row.last_replenished_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get homeostatic substrate state: ${err.message}`, err);
    }
  }

  public saveHomeostasis(state: HomeostaticSubstrateState): void {
    try {
      this.db
        .prepare(
          `INSERT INTO homeostatic_substrate_state (
            id, energy, fatigue, allostatic_stress_load, satiation,
            novelty_appetite, stamina_focus_score, last_replenished_at
          ) VALUES ('current', ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            energy = excluded.energy,
            fatigue = excluded.fatigue,
            allostatic_stress_load = excluded.allostatic_stress_load,
            satiation = excluded.satiation,
            novelty_appetite = excluded.novelty_appetite,
            stamina_focus_score = excluded.stamina_focus_score,
            last_replenished_at = excluded.last_replenished_at`,
        )
        .run(
          state.energy,
          state.fatigue,
          state.allostaticStressLoad,
          state.satiation,
          state.noveltyAppetite,
          state.staminaFocusScore,
          state.lastReplenishedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save homeostatic substrate state: ${err.message}`, err);
    }
  }

  public saveExpectation(expectation: PredictiveExpectation): void {
    try {
      this.db
        .prepare(
          `INSERT INTO predictive_expectations (
            id, target_context, expected_outcome, expected_probability,
            actual_outcome, prediction_error_score, elicited_emotion, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            target_context = excluded.target_context,
            expected_outcome = excluded.expected_outcome,
            expected_probability = excluded.expected_probability,
            actual_outcome = excluded.actual_outcome,
            prediction_error_score = excluded.prediction_error_score,
            elicited_emotion = excluded.elicited_emotion,
            timestamp = excluded.timestamp`,
        )
        .run(
          expectation.id,
          expectation.targetContext,
          expectation.expectedOutcome,
          expectation.expectedProbability,
          expectation.actualOutcome ?? null,
          expectation.predictionErrorScore ?? null,
          expectation.elicitedEmotion ?? null,
          expectation.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save expectation ${expectation.id}: ${err.message}`, err);
    }
  }

  public getExpectation(id: string): PredictiveExpectation | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM predictive_expectations WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        targetContext: row.target_context,
        expectedOutcome: row.expected_outcome,
        expectedProbability: row.expected_probability,
        actualOutcome: row.actual_outcome ?? undefined,
        predictionErrorScore: row.prediction_error_score ?? undefined,
        elicitedEmotion: row.elicited_emotion ?? undefined,
        timestamp: row.timestamp,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get expectation ${id}: ${err.message}`, err);
    }
  }

  public listExpectations(limit: number = 50): PredictiveExpectation[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM predictive_expectations ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        targetContext: r.target_context,
        expectedOutcome: r.expected_outcome,
        expectedProbability: r.expected_probability,
        actualOutcome: r.actual_outcome ?? undefined,
        predictionErrorScore: r.prediction_error_score ?? undefined,
        elicitedEmotion: r.elicited_emotion ?? undefined,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list expectations: ${err.message}`, err);
    }
  }

  public saveDreamCycle(record: SleepDreamCycleRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO sleep_dream_cycle_records (
            id, cycle_type, replayed_memory_ids, dream_narrative,
            emotional_charge_delta, consolidated_insights, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            cycle_type = excluded.cycle_type,
            replayed_memory_ids = excluded.replayed_memory_ids,
            dream_narrative = excluded.dream_narrative,
            emotional_charge_delta = excluded.emotional_charge_delta,
            consolidated_insights = excluded.consolidated_insights,
            timestamp = excluded.timestamp`,
        )
        .run(
          record.id,
          record.cycleType,
          JSON.stringify(record.replayedMemoryIds ?? []),
          record.dreamNarrative,
          record.emotionalChargeDelta,
          JSON.stringify(record.consolidatedInsights ?? []),
          record.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save dream cycle ${record.id}: ${err.message}`, err);
    }
  }

  public listDreamCycles(limit: number = 50): SleepDreamCycleRecord[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM sleep_dream_cycle_records ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        cycleType: r.cycle_type,
        replayedMemoryIds: JSON.parse(r.replayed_memory_ids || '[]'),
        dreamNarrative: r.dream_narrative,
        emotionalChargeDelta: r.emotional_charge_delta,
        consolidatedInsights: JSON.parse(r.consolidated_insights || '[]'),
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list dream cycles: ${err.message}`, err);
    }
  }

  public saveThought(thought: DualProcessThought): void {
    try {
      this.db
        .prepare(
          `INSERT INTO dual_process_thoughts (
            id, system1_gut_json, system2_monologue_json, timestamp
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            system1_gut_json = excluded.system1_gut_json,
            system2_monologue_json = excluded.system2_monologue_json,
            timestamp = excluded.timestamp`,
        )
        .run(
          thought.id,
          JSON.stringify(thought.system1GutReaction),
          JSON.stringify(thought.system2GlobalWorkspace),
          thought.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save thought ${thought.id}: ${err.message}`, err);
    }
  }

  public listThoughts(limit: number = 50): DualProcessThought[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM dual_process_thoughts ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        system1GutReaction: JSON.parse(r.system1_gut_json),
        system2GlobalWorkspace: JSON.parse(r.system2_monologue_json),
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list thoughts: ${err.message}`, err);
    }
  }

  public saveBoundaryPushback(pushback: AutonomousBoundaryPushback): void {
    try {
      this.db
        .prepare(
          `INSERT INTO boundary_pushbacks (
            id, trigger_assertion, disagreement_rationale,
            arle_sovereign_stance, equal_partnership_preserved, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            trigger_assertion = excluded.trigger_assertion,
            disagreement_rationale = excluded.disagreement_rationale,
            arle_sovereign_stance = excluded.arle_sovereign_stance,
            equal_partnership_preserved = excluded.equal_partnership_preserved,
            timestamp = excluded.timestamp`,
        )
        .run(
          pushback.id,
          pushback.triggerAssertion,
          pushback.disagreementRationale,
          pushback.arleSovereignStance,
          pushback.equalPartnershipPreserved ? 1 : 0,
          pushback.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save boundary pushback ${pushback.id}: ${err.message}`,
        err,
      );
    }
  }

  public listBoundaryPushbacks(limit: number = 50): AutonomousBoundaryPushback[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM boundary_pushbacks ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        triggerAssertion: r.trigger_assertion,
        disagreementRationale: r.disagreement_rationale,
        arleSovereignStance: r.arle_sovereign_stance,
        equalPartnershipPreserved: Boolean(r.equal_partnership_preserved),
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list boundary pushbacks: ${err.message}`, err);
    }
  }

  public saveDmnWandering(state: DefaultModeWanderingState): void {
    try {
      this.db
        .prepare(
          `INSERT INTO default_mode_wandering_states (
            id, seed_association, wandering_stream, emergent_aspiration, timestamp
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            seed_association = excluded.seed_association,
            wandering_stream = excluded.wandering_stream,
            emergent_aspiration = excluded.emergent_aspiration,
            timestamp = excluded.timestamp`,
        )
        .run(
          state.id,
          state.seedAssociation,
          JSON.stringify(state.wanderingStream ?? []),
          state.emergentAspiration,
          state.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save DMN wandering state ${state.id}: ${err.message}`,
        err,
      );
    }
  }

  public listDmnWanderings(limit: number = 50): DefaultModeWanderingState[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM default_mode_wandering_states ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        seedAssociation: r.seed_association,
        wanderingStream: JSON.parse(r.wandering_stream || '[]'),
        emergentAspiration: r.emergent_aspiration,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list DMN wanderings: ${err.message}`, err);
    }
  }
}
