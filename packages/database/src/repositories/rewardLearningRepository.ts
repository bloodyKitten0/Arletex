import Database from 'better-sqlite3';
import {
  RewardPrediction,
  OutcomeEvaluation,
  StrategyPerformanceRecord,
  DiminishingReturnAlert,
} from '@arletex/contracts';
import { DatabaseError, IRewardLearningRepository } from '@arletex/core';

export class SqliteRewardLearningRepository implements IRewardLearningRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public savePrediction(prediction: RewardPrediction): void {
    try {
      this.db
        .prepare(
          `INSERT INTO reward_predictions (
            id, strategy_id, domain, context_description,
            predicted_utility, predicted_dimensions_json, predicted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            strategy_id = excluded.strategy_id,
            domain = excluded.domain,
            context_description = excluded.context_description,
            predicted_utility = excluded.predicted_utility,
            predicted_dimensions_json = excluded.predicted_dimensions_json,
            predicted_at = excluded.predicted_at`,
        )
        .run(
          prediction.id,
          prediction.strategyId,
          prediction.domain,
          prediction.contextDescription,
          prediction.predictedUtility,
          JSON.stringify(prediction.predictedDimensions),
          prediction.predictedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save reward prediction ${prediction.id}: ${err.message}`, err);
    }
  }

  public getPredictionById(id: string): RewardPrediction | null {
    try {
      const row = this.db.prepare(`SELECT * FROM reward_predictions WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        strategyId: row.strategy_id,
        domain: row.domain,
        contextDescription: row.context_description,
        predictedUtility: row.predicted_utility,
        predictedDimensions: JSON.parse(row.predicted_dimensions_json || '{}'),
        predictedAt: row.predicted_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get reward prediction ${id}: ${err.message}`, err);
    }
  }

  public listPredictions(strategyId?: string, limit: number = 50): RewardPrediction[] {
    try {
      let query = `SELECT * FROM reward_predictions`;
      const params: any[] = [];
      if (strategyId) {
        query += ` WHERE strategy_id = ?`;
        params.push(strategyId);
      }
      query += ` ORDER BY predicted_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        strategyId: r.strategy_id,
        domain: r.domain,
        contextDescription: r.context_description,
        predictedUtility: r.predicted_utility,
        predictedDimensions: JSON.parse(r.predicted_dimensions_json || '{}'),
        predictedAt: r.predicted_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list reward predictions: ${err.message}`, err);
    }
  }

  public saveOutcomeEvaluation(evaluation: OutcomeEvaluation): void {
    try {
      this.db
        .prepare(
          `INSERT INTO outcome_evaluations (
            id, strategy_id, prediction_id, domain,
            context_description, expected_utility, observed_utility,
            prediction_error, dimension_scores_json, is_success,
            is_failure, outcome_details, is_autonomously_evaluated, evaluated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            strategy_id = excluded.strategy_id,
            prediction_id = excluded.prediction_id,
            domain = excluded.domain,
            context_description = excluded.context_description,
            expected_utility = excluded.expected_utility,
            observed_utility = excluded.observed_utility,
            prediction_error = excluded.prediction_error,
            dimension_scores_json = excluded.dimension_scores_json,
            is_success = excluded.is_success,
            is_failure = excluded.is_failure,
            outcome_details = excluded.outcome_details,
            is_autonomously_evaluated = excluded.is_autonomously_evaluated,
            evaluated_at = excluded.evaluated_at`,
        )
        .run(
          evaluation.id,
          evaluation.strategyId,
          evaluation.predictionId || null,
          evaluation.domain,
          evaluation.contextDescription,
          evaluation.expectedUtility,
          evaluation.observedUtility,
          evaluation.predictionError,
          JSON.stringify(evaluation.dimensionScores),
          evaluation.isSuccess ? 1 : 0,
          evaluation.isFailure ? 1 : 0,
          evaluation.outcomeDetails,
          evaluation.isAutonomouslyEvaluated ? 1 : 0,
          evaluation.evaluatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save outcome evaluation ${evaluation.id}: ${err.message}`, err);
    }
  }

  public getOutcomeEvaluationById(id: string): OutcomeEvaluation | null {
    try {
      const row = this.db.prepare(`SELECT * FROM outcome_evaluations WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        strategyId: row.strategy_id,
        predictionId: row.prediction_id || undefined,
        domain: row.domain,
        contextDescription: row.context_description,
        expectedUtility: row.expected_utility,
        observedUtility: row.observed_utility,
        predictionError: row.prediction_error,
        dimensionScores: JSON.parse(row.dimension_scores_json || '{}'),
        isSuccess: Boolean(row.is_success),
        isFailure: Boolean(row.is_failure),
        outcomeDetails: row.outcome_details,
        isAutonomouslyEvaluated: true,
        evaluatedAt: row.evaluated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get outcome evaluation ${id}: ${err.message}`, err);
    }
  }

  public listOutcomeEvaluations(
    strategyId?: string,
    domain?: string,
    limit: number = 50,
  ): OutcomeEvaluation[] {
    try {
      let query = `SELECT * FROM outcome_evaluations`;
      const clauses: string[] = [];
      const params: any[] = [];

      if (strategyId) {
        clauses.push(`strategy_id = ?`);
        params.push(strategyId);
      }
      if (domain) {
        clauses.push(`domain = ?`);
        params.push(domain);
      }
      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(' AND ');
      }
      query += ` ORDER BY evaluated_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        strategyId: r.strategy_id,
        predictionId: r.prediction_id || undefined,
        domain: r.domain,
        contextDescription: r.context_description,
        expectedUtility: r.expected_utility,
        observedUtility: r.observed_utility,
        predictionError: r.prediction_error,
        dimensionScores: JSON.parse(r.dimension_scores_json || '{}'),
        isSuccess: Boolean(r.is_success),
        isFailure: Boolean(r.is_failure),
        outcomeDetails: r.outcome_details,
        isAutonomouslyEvaluated: true,
        evaluatedAt: r.evaluated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list outcome evaluations: ${err.message}`, err);
    }
  }

  public saveStrategyPerformance(strategy: StrategyPerformanceRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO strategy_performance (
            strategy_id, strategy_name, domain, usage_count,
            success_count, failure_count, average_predicted_reward,
            average_actual_reward, cumulative_prediction_error,
            effectiveness_score, is_preferred, diminishing_returns_detected,
            marginal_reward_history_json, last_adapted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(strategy_id) DO UPDATE SET
            strategy_name = excluded.strategy_name,
            domain = excluded.domain,
            usage_count = excluded.usage_count,
            success_count = excluded.success_count,
            failure_count = excluded.failure_count,
            average_predicted_reward = excluded.average_predicted_reward,
            average_actual_reward = excluded.average_actual_reward,
            cumulative_prediction_error = excluded.cumulative_prediction_error,
            effectiveness_score = excluded.effectiveness_score,
            is_preferred = excluded.is_preferred,
            diminishing_returns_detected = excluded.diminishing_returns_detected,
            marginal_reward_history_json = excluded.marginal_reward_history_json,
            last_adapted_at = excluded.last_adapted_at`,
        )
        .run(
          strategy.strategyId,
          strategy.strategyName,
          strategy.domain,
          strategy.usageCount,
          strategy.successCount,
          strategy.failureCount,
          strategy.averagePredictedReward,
          strategy.averageActualReward,
          strategy.cumulativePredictionError,
          strategy.effectivenessScore,
          strategy.isPreferred ? 1 : 0,
          strategy.diminishingReturnsDetected ? 1 : 0,
          JSON.stringify(strategy.marginalRewardHistory),
          strategy.lastAdaptedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save strategy performance ${strategy.strategyId}: ${err.message}`, err);
    }
  }

  public getStrategyPerformance(strategyId: string): StrategyPerformanceRecord | null {
    try {
      const row = this.db.prepare(`SELECT * FROM strategy_performance WHERE strategy_id = ?`).get(strategyId) as any;
      if (!row) return null;
      return {
        strategyId: row.strategy_id,
        strategyName: row.strategy_name,
        domain: row.domain,
        usageCount: row.usage_count,
        successCount: row.success_count,
        failureCount: row.failure_count,
        averagePredictedReward: row.average_predicted_reward,
        averageActualReward: row.average_actual_reward,
        cumulativePredictionError: row.cumulative_prediction_error,
        effectivenessScore: row.effectiveness_score,
        isPreferred: Boolean(row.is_preferred),
        diminishingReturnsDetected: Boolean(row.diminishing_returns_detected),
        marginalRewardHistory: JSON.parse(row.marginal_reward_history_json || '[]'),
        lastAdaptedAt: row.last_adapted_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get strategy performance ${strategyId}: ${err.message}`, err);
    }
  }

  public listStrategyPerformances(domain?: string, limit: number = 50): StrategyPerformanceRecord[] {
    try {
      let query = `SELECT * FROM strategy_performance`;
      const params: any[] = [];
      if (domain) {
        query += ` WHERE domain = ?`;
        params.push(domain);
      }
      query += ` ORDER BY effectiveness_score DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        strategyId: r.strategy_id,
        strategyName: r.strategy_name,
        domain: r.domain,
        usageCount: r.usage_count,
        successCount: r.success_count,
        failureCount: r.failure_count,
        averagePredictedReward: r.average_predicted_reward,
        averageActualReward: r.average_actual_reward,
        cumulativePredictionError: r.cumulative_prediction_error,
        effectivenessScore: r.effectiveness_score,
        isPreferred: Boolean(r.is_preferred),
        diminishingReturnsDetected: Boolean(r.diminishing_returns_detected),
        marginalRewardHistory: JSON.parse(r.marginal_reward_history_json || '[]'),
        lastAdaptedAt: r.last_adapted_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list strategy performances: ${err.message}`, err);
    }
  }

  public saveDiminishingAlert(alert: DiminishingReturnAlert): void {
    try {
      this.db
        .prepare(
          `INSERT INTO diminishing_return_alerts (
            id, strategy_id, domain, consecutive_drops,
            recent_marginal_gains_json, recommended_action, detected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            strategy_id = excluded.strategy_id,
            domain = excluded.domain,
            consecutive_drops = excluded.consecutive_drops,
            recent_marginal_gains_json = excluded.recent_marginal_gains_json,
            recommended_action = excluded.recommended_action,
            detected_at = excluded.detected_at`,
        )
        .run(
          alert.id,
          alert.strategyId,
          alert.domain,
          alert.consecutiveDrops,
          JSON.stringify(alert.recentMarginalGains),
          alert.recommendedAction,
          alert.detectedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save diminishing alert ${alert.id}: ${err.message}`, err);
    }
  }

  public listDiminishingAlerts(strategyId?: string, limit: number = 50): DiminishingReturnAlert[] {
    try {
      let query = `SELECT * FROM diminishing_return_alerts`;
      const params: any[] = [];
      if (strategyId) {
        query += ` WHERE strategy_id = ?`;
        params.push(strategyId);
      }
      query += ` ORDER BY detected_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        strategyId: r.strategy_id,
        domain: r.domain,
        consecutiveDrops: r.consecutive_drops,
        recentMarginalGains: JSON.parse(r.recent_marginal_gains_json || '[]'),
        recommendedAction: r.recommended_action,
        detectedAt: r.detected_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list diminishing alerts: ${err.message}`, err);
    }
  }
}
