import Database from 'better-sqlite3';
import {
  InteractionStrategy,
  SensorimotorActionRecord,
  SpatialCalibration,
} from '@arletex/contracts';
import { DatabaseError, ISensorimotorRepository } from '@arletex/core';

export class SensorimotorRepository implements ISensorimotorRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Sensorimotor Action Records
  // ==========================================

  public recordAction(record: SensorimotorActionRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO sensorimotor_action_records (
            id, session_id, intention_id, action_type, spatial_target,
            intended_outcome, attempted_payload, executed_at,
            execution_status, verification, distinction_analysis,
            duration_ms, retry_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            execution_status = excluded.execution_status,
            verification = excluded.verification,
            distinction_analysis = excluded.distinction_analysis,
            duration_ms = excluded.duration_ms,
            retry_count = excluded.retry_count`,
        )
        .run(
          record.id,
          record.sessionId,
          record.intentionId || null,
          record.actionType,
          JSON.stringify(record.spatialTarget),
          record.intendedOutcome,
          JSON.stringify(record.attemptedPayload),
          record.executedAt,
          record.executionStatus,
          JSON.stringify(record.verification),
          record.distinctionAnalysis,
          record.durationMs,
          record.retryCount,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to record sensorimotor action ${record.id}: ${err.message}`,
        err,
      );
    }
  }

  public getActionRecordById(id: string): SensorimotorActionRecord | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM sensorimotor_action_records WHERE id = ?')
        .get(id) as any;
      if (!row) return null;
      return this.mapActionRecordRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get action record ${id}: ${err.message}`, err);
    }
  }

  public listActionRecords(filter?: {
    sessionId?: string;
    actionType?: string;
    status?: string;
    limit?: number;
  }): SensorimotorActionRecord[] {
    try {
      let query = 'SELECT * FROM sensorimotor_action_records WHERE 1=1';
      const params: any[] = [];

      if (filter?.sessionId) {
        query += ' AND session_id = ?';
        params.push(filter.sessionId);
      }
      if (filter?.actionType) {
        query += ' AND action_type = ?';
        params.push(filter.actionType);
      }
      if (filter?.status) {
        query += ' AND execution_status = ?';
        params.push(filter.status);
      }

      query += ' ORDER BY executed_at DESC LIMIT ?';
      params.push(filter?.limit || 50);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapActionRecordRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list action records: ${err.message}`, err);
    }
  }

  // ==========================================
  // Interaction Strategies
  // ==========================================

  public saveStrategy(strategy: InteractionStrategy): void {
    try {
      this.db
        .prepare(
          `INSERT INTO interaction_strategies (
            id, target_app_or_context, goal_type, primary_sequence,
            fallback_sequence, success_count, failure_count,
            empirical_reliability, last_used_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            primary_sequence = excluded.primary_sequence,
            fallback_sequence = excluded.fallback_sequence,
            success_count = excluded.success_count,
            failure_count = excluded.failure_count,
            empirical_reliability = excluded.empirical_reliability,
            last_used_at = excluded.last_used_at,
            updated_at = excluded.updated_at`,
        )
        .run(
          strategy.id,
          strategy.targetAppOrContext,
          strategy.goalType,
          JSON.stringify(strategy.primarySequence),
          strategy.fallbackSequence ? JSON.stringify(strategy.fallbackSequence) : null,
          strategy.successCount,
          strategy.failureCount,
          strategy.empiricalReliability,
          strategy.lastUsedAt,
          new Date().toISOString(),
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save interaction strategy ${strategy.id}: ${err.message}`,
        err,
      );
    }
  }

  public getStrategy(targetAppOrContext: string, goalType: string): InteractionStrategy | null {
    try {
      const row = this.db
        .prepare(
          'SELECT * FROM interaction_strategies WHERE target_app_or_context = ? AND goal_type = ? ORDER BY empirical_reliability DESC LIMIT 1',
        )
        .get(targetAppOrContext, goalType) as any;
      if (!row) return null;
      return this.mapStrategyRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get strategy: ${err.message}`, err);
    }
  }

  public listStrategies(targetAppOrContext?: string): InteractionStrategy[] {
    try {
      let query = 'SELECT * FROM interaction_strategies';
      const params: any[] = [];
      if (targetAppOrContext) {
        query += ' WHERE target_app_or_context = ?';
        params.push(targetAppOrContext);
      }
      query += ' ORDER BY empirical_reliability DESC';
      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapStrategyRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list strategies: ${err.message}`, err);
    }
  }

  // ==========================================
  // Spatial Calibrations
  // ==========================================

  public saveSpatialCalibration(calibration: SpatialCalibration): void {
    try {
      const id = crypto.randomUUID();
      this.db
        .prepare(
          `INSERT INTO sensorimotor_spatial_calibrations (
            id, display_id, screen_width, screen_height, scale_factor, active_windows, calibrated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          calibration.displayId || 'primary',
          calibration.screenWidth,
          calibration.screenHeight,
          calibration.scaleFactor,
          JSON.stringify(calibration.activeWindows || []),
          calibration.calibratedAt || new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save spatial calibration: ${err.message}`, err);
    }
  }

  public getLatestSpatialCalibration(displayId: string = 'primary'): SpatialCalibration | null {
    try {
      const row = this.db
        .prepare(
          'SELECT * FROM sensorimotor_spatial_calibrations WHERE display_id = ? ORDER BY calibrated_at DESC LIMIT 1',
        )
        .get(displayId) as any;
      if (!row) return null;
      return {
        displayId: row.display_id,
        screenWidth: row.screen_width,
        screenHeight: row.screen_height,
        scaleFactor: row.scale_factor,
        activeWindows: JSON.parse(row.active_windows || '[]'),
        calibratedAt: row.calibrated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest spatial calibration: ${err.message}`, err);
    }
  }

  // ==========================================
  // Row Mappers
  // ==========================================

  private mapActionRecordRow(row: any): SensorimotorActionRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      intentionId: row.intention_id || null,
      actionType: row.action_type,
      spatialTarget: JSON.parse(row.spatial_target),
      intendedOutcome: row.intended_outcome,
      attemptedPayload: JSON.parse(row.attempted_payload),
      executedAt: row.executed_at,
      executionStatus: row.execution_status,
      verification: JSON.parse(row.verification),
      distinctionAnalysis: row.distinction_analysis,
      durationMs: row.duration_ms,
      retryCount: row.retry_count,
    };
  }

  private mapStrategyRow(row: any): InteractionStrategy {
    return {
      id: row.id,
      targetAppOrContext: row.target_app_or_context,
      goalType: row.goal_type,
      primarySequence: JSON.parse(row.primary_sequence),
      fallbackSequence: row.fallback_sequence ? JSON.parse(row.fallback_sequence) : undefined,
      successCount: row.success_count,
      failureCount: row.failure_count,
      empiricalReliability: row.empirical_reliability,
      lastUsedAt: row.last_used_at,
    };
  }
}
