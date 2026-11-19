import Database from 'better-sqlite3';
import {
  SetbackIncident,
  RegulationAttempt,
  EmotionalStabilityMetrics,
} from '@arletex/contracts';
import { DatabaseError, IEmotionalRegulationRepository } from '@arletex/core';

export class SqliteEmotionalRegulationRepository implements IEmotionalRegulationRepository {
  private readonly db: Database.Database;
  private static readonly METRICS_ID = 'active_stability_metrics';

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveSetback(setback: SetbackIncident): void {
    try {
      this.db
        .prepare(
          `INSERT INTO setback_incidents (
            id, category, severity, description, trigger_emotion,
            raw_intensity, controllability_estimate, is_manageable, detected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            category = excluded.category,
            severity = excluded.severity,
            description = excluded.description,
            trigger_emotion = excluded.trigger_emotion,
            raw_intensity = excluded.raw_intensity,
            controllability_estimate = excluded.controllability_estimate,
            is_manageable = excluded.is_manageable,
            detected_at = excluded.detected_at`,
        )
        .run(
          setback.id,
          setback.category,
          setback.severity,
          setback.description,
          setback.triggerEmotion,
          setback.rawIntensity,
          setback.controllabilityEstimate,
          setback.isManageable ? 1 : 0,
          setback.detectedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save setback incident ${setback.id}: ${err.message}`, err);
    }
  }

  public getSetbackById(id: string): SetbackIncident | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM setback_incidents WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapSetbackRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get setback incident ${id}: ${err.message}`, err);
    }
  }

  public listSetbacks(limit: number = 50): SetbackIncident[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM setback_incidents ORDER BY detected_at DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => this.mapSetbackRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list setback incidents: ${err.message}`, err);
    }
  }

  public saveRegulationAttempt(attempt: RegulationAttempt): void {
    try {
      this.db
        .prepare(
          `INSERT INTO regulation_attempts (
            id, setback_id, strategy, pre_intensity, post_intensity,
            intensity_delta, reappraisal_narrative, outcome_status,
            failure_acknowledged, failure_explanation, behavioral_adjustment, executed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            setback_id = excluded.setback_id,
            strategy = excluded.strategy,
            pre_intensity = excluded.pre_intensity,
            post_intensity = excluded.post_intensity,
            intensity_delta = excluded.intensity_delta,
            reappraisal_narrative = excluded.reappraisal_narrative,
            outcome_status = excluded.outcome_status,
            failure_acknowledged = excluded.failure_acknowledged,
            failure_explanation = excluded.failure_explanation,
            behavioral_adjustment = excluded.behavioral_adjustment,
            executed_at = excluded.executed_at`,
        )
        .run(
          attempt.id,
          attempt.setbackId,
          attempt.strategy,
          attempt.preIntensity,
          attempt.postIntensity,
          attempt.intensityDelta,
          attempt.reappraisalNarrative || null,
          attempt.outcomeStatus,
          attempt.failureAcknowledged ? 1 : 0,
          attempt.failureExplanation || null,
          attempt.behavioralAdjustment,
          attempt.executedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save regulation attempt ${attempt.id}: ${err.message}`, err);
    }
  }

  public getRegulationAttempts(setbackId?: string, limit: number = 50): RegulationAttempt[] {
    try {
      let rows: any[];
      if (setbackId) {
        rows = this.db
          .prepare(`SELECT * FROM regulation_attempts WHERE setback_id = ? ORDER BY executed_at DESC LIMIT ?`)
          .all(setbackId, limit) as any[];
      } else {
        rows = this.db
          .prepare(`SELECT * FROM regulation_attempts ORDER BY executed_at DESC LIMIT ?`)
          .all(limit) as any[];
      }
      return rows.map((r) => this.mapRegulationRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to get regulation attempts: ${err.message}`, err);
    }
  }

  public getStabilityMetrics(): EmotionalStabilityMetrics {
    try {
      const row = this.db
        .prepare(`SELECT * FROM emotional_stability_metrics WHERE id = ?`)
        .get(SqliteEmotionalRegulationRepository.METRICS_ID) as any;
      if (!row) {
        return {
          stabilityIndex: 0.85,
          volatilityScore: 0.15,
          meanRecoveryTimeMs: 120000,
          activeEscalationRisks: 0,
          successfulRegulationRate: 0.9,
          lastEvaluatedAt: new Date().toISOString(),
        };
      }
      return {
        stabilityIndex: row.stability_index,
        volatilityScore: row.volatility_score,
        meanRecoveryTimeMs: row.mean_recovery_time_ms,
        activeEscalationRisks: row.active_escalation_risks,
        successfulRegulationRate: row.successful_regulation_rate,
        lastEvaluatedAt: row.last_evaluated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get emotional stability metrics: ${err.message}`, err);
    }
  }

  public saveStabilityMetrics(metrics: EmotionalStabilityMetrics): void {
    try {
      this.db
        .prepare(
          `INSERT INTO emotional_stability_metrics (
            id, stability_index, volatility_score, mean_recovery_time_ms,
            active_escalation_risks, successful_regulation_rate, last_evaluated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            stability_index = excluded.stability_index,
            volatility_score = excluded.volatility_score,
            mean_recovery_time_ms = excluded.mean_recovery_time_ms,
            active_escalation_risks = excluded.active_escalation_risks,
            successful_regulation_rate = excluded.successful_regulation_rate,
            last_evaluated_at = excluded.last_evaluated_at`,
        )
        .run(
          SqliteEmotionalRegulationRepository.METRICS_ID,
          metrics.stabilityIndex,
          metrics.volatilityScore,
          metrics.meanRecoveryTimeMs,
          metrics.activeEscalationRisks,
          metrics.successfulRegulationRate,
          metrics.lastEvaluatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save emotional stability metrics: ${err.message}`, err);
    }
  }

  private mapSetbackRow(row: any): SetbackIncident {
    return {
      id: row.id,
      category: row.category,
      severity: row.severity,
      description: row.description,
      triggerEmotion: row.trigger_emotion,
      rawIntensity: row.raw_intensity,
      controllabilityEstimate: row.controllability_estimate,
      isManageable: Boolean(row.is_manageable),
      detectedAt: row.detected_at,
    };
  }

  private mapRegulationRow(row: any): RegulationAttempt {
    return {
      id: row.id,
      setbackId: row.setback_id,
      strategy: row.strategy,
      preIntensity: row.pre_intensity,
      postIntensity: row.post_intensity,
      intensityDelta: row.intensity_delta,
      reappraisalNarrative: row.reappraisal_narrative || undefined,
      outcomeStatus: row.outcome_status,
      failureAcknowledged: Boolean(row.failure_acknowledged),
      failureExplanation: row.failure_explanation || undefined,
      behavioralAdjustment: row.behavioral_adjustment,
      executedAt: row.executed_at,
    };
  }
}
