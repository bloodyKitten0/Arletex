import Database from 'better-sqlite3';
import {
  AgentMentalModel,
  InferredBelief,
  InferredIntention,
  SocialPrediction,
} from '@arletex/contracts';
import { DatabaseError, ITheoryOfMindRepository } from '@arletex/core';

export class SqliteTheoryOfMindRepository implements ITheoryOfMindRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveAgentModel(model: AgentMentalModel): void {
    try {
      this.db
        .prepare(
          `INSERT INTO tom_agent_mental_models (
            agent_id, agent_name, relationship,
            known_preferences_json, epistemic_access_json, last_interaction_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(agent_id) DO UPDATE SET
            agent_name = excluded.agent_name,
            relationship = excluded.relationship,
            known_preferences_json = excluded.known_preferences_json,
            epistemic_access_json = excluded.epistemic_access_json,
            last_interaction_at = excluded.last_interaction_at`,
        )
        .run(
          model.agentId,
          model.agentName,
          model.relationship,
          JSON.stringify(model.knownPreferences || []),
          JSON.stringify(model.epistemicAccess || []),
          model.lastInteractionAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save agent mental model ${model.agentId}: ${err.message}`, err);
    }
  }

  public getAgentModel(agentId: string): AgentMentalModel | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM tom_agent_mental_models WHERE agent_id = ?`)
        .get(agentId) as any;
      if (!row) return null;
      return {
        agentId: row.agent_id,
        agentName: row.agent_name,
        relationship: row.relationship,
        knownPreferences: JSON.parse(row.known_preferences_json || '[]'),
        epistemicAccess: JSON.parse(row.epistemic_access_json || '[]'),
        lastInteractionAt: row.last_interaction_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get agent mental model ${agentId}: ${err.message}`, err);
    }
  }

  public listAgentModels(): AgentMentalModel[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM tom_agent_mental_models ORDER BY last_interaction_at DESC`)
        .all() as any[];
      return rows.map((r) => ({
        agentId: r.agent_id,
        agentName: r.agent_name,
        relationship: r.relationship,
        knownPreferences: JSON.parse(r.known_preferences_json || '[]'),
        epistemicAccess: JSON.parse(r.epistemic_access_json || '[]'),
        lastInteractionAt: r.last_interaction_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list agent mental models: ${err.message}`, err);
    }
  }

  public saveBelief(belief: InferredBelief): void {
    try {
      this.db
        .prepare(
          `INSERT INTO tom_inferred_beliefs (
            id, agent_id, topic, agent_belief_content,
            ground_truth_content, is_false_belief, confidence,
            evidence_signals_json, inferred_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            agent_id = excluded.agent_id,
            topic = excluded.topic,
            agent_belief_content = excluded.agent_belief_content,
            ground_truth_content = excluded.ground_truth_content,
            is_false_belief = excluded.is_false_belief,
            confidence = excluded.confidence,
            evidence_signals_json = excluded.evidence_signals_json,
            inferred_at = excluded.inferred_at`,
        )
        .run(
          belief.id,
          belief.agentId,
          belief.topic,
          belief.agentBeliefContent,
          belief.groundTruthContent,
          belief.isFalseBelief ? 1 : 0,
          belief.confidence,
          JSON.stringify(belief.evidenceSignals || []),
          belief.inferredAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save inferred belief ${belief.id}: ${err.message}`, err);
    }
  }

  public getBelief(agentId: string, topic: string): InferredBelief | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM tom_inferred_beliefs WHERE agent_id = ? AND topic = ? ORDER BY inferred_at DESC LIMIT 1`)
        .get(agentId, topic) as any;
      if (!row) return null;
      return {
        id: row.id,
        agentId: row.agent_id,
        topic: row.topic,
        agentBeliefContent: row.agent_belief_content,
        groundTruthContent: row.ground_truth_content,
        isFalseBelief: Boolean(row.is_false_belief),
        confidence: row.confidence,
        evidenceSignals: JSON.parse(row.evidence_signals_json || '[]'),
        inferredAt: row.inferred_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get inferred belief: ${err.message}`, err);
    }
  }

  public listBeliefs(agentId?: string): InferredBelief[] {
    try {
      let query = `SELECT * FROM tom_inferred_beliefs`;
      const params: any[] = [];
      if (agentId) {
        query += ` WHERE agent_id = ?`;
        params.push(agentId);
      }
      query += ` ORDER BY inferred_at DESC`;

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        agentId: r.agent_id,
        topic: r.topic,
        agentBeliefContent: r.agent_belief_content,
        groundTruthContent: r.ground_truth_content,
        isFalseBelief: Boolean(r.is_false_belief),
        confidence: r.confidence,
        evidenceSignals: JSON.parse(r.evidence_signals_json || '[]'),
        inferredAt: r.inferred_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list inferred beliefs: ${err.message}`, err);
    }
  }

  public saveIntention(intention: InferredIntention): void {
    try {
      this.db
        .prepare(
          `INSERT INTO tom_inferred_intentions (
            id, agent_id, observed_behavior,
            primary_inferred_intention, confidence,
            uncertainty_factors_json, alternative_hypotheses_json, inferred_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            agent_id = excluded.agent_id,
            observed_behavior = excluded.observed_behavior,
            primary_inferred_intention = excluded.primary_inferred_intention,
            confidence = excluded.confidence,
            uncertainty_factors_json = excluded.uncertainty_factors_json,
            alternative_hypotheses_json = excluded.alternative_hypotheses_json,
            inferred_at = excluded.inferred_at`,
        )
        .run(
          intention.id,
          intention.agentId,
          intention.observedBehavior,
          intention.primaryInferredIntention,
          intention.confidence,
          JSON.stringify(intention.uncertaintyFactors || []),
          JSON.stringify(intention.alternativeHypotheses || []),
          intention.inferredAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save inferred intention ${intention.id}: ${err.message}`, err);
    }
  }

  public listIntentions(agentId?: string, limit: number = 50): InferredIntention[] {
    try {
      let query = `SELECT * FROM tom_inferred_intentions`;
      const params: any[] = [];
      if (agentId) {
        query += ` WHERE agent_id = ?`;
        params.push(agentId);
      }
      query += ` ORDER BY inferred_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        agentId: r.agent_id,
        observedBehavior: r.observed_behavior,
        primaryInferredIntention: r.primary_inferred_intention,
        confidence: r.confidence,
        uncertaintyFactors: JSON.parse(r.uncertainty_factors_json || '[]'),
        alternativeHypotheses: JSON.parse(r.alternative_hypotheses_json || '[]'),
        inferredAt: r.inferred_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list inferred intentions: ${err.message}`, err);
    }
  }

  public saveSocialPrediction(prediction: SocialPrediction): void {
    try {
      this.db
        .prepare(
          `INSERT INTO tom_social_predictions (
            id, agent_id, context, predicted_action,
            predicted_likelihood, belief_basis, expected_outcome, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            agent_id = excluded.agent_id,
            context = excluded.context,
            predicted_action = excluded.predicted_action,
            predicted_likelihood = excluded.predicted_likelihood,
            belief_basis = excluded.belief_basis,
            expected_outcome = excluded.expected_outcome,
            created_at = excluded.created_at`,
        )
        .run(
          prediction.id,
          prediction.agentId,
          prediction.context,
          prediction.predictedAction,
          prediction.predictedLikelihood,
          prediction.beliefBasis,
          prediction.expectedOutcome,
          prediction.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save social prediction ${prediction.id}: ${err.message}`, err);
    }
  }

  public listSocialPredictions(agentId?: string, limit: number = 50): SocialPrediction[] {
    try {
      let query = `SELECT * FROM tom_social_predictions`;
      const params: any[] = [];
      if (agentId) {
        query += ` WHERE agent_id = ?`;
        params.push(agentId);
      }
      query += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        agentId: r.agent_id,
        context: r.context,
        predictedAction: r.predicted_action,
        predictedLikelihood: r.predicted_likelihood,
        beliefBasis: r.belief_basis,
        expectedOutcome: r.expected_outcome,
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list social predictions: ${err.message}`, err);
    }
  }
}
