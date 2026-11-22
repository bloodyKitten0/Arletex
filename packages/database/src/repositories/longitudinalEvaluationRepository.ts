import Database from 'better-sqlite3';
import { LongitudinalEvaluationReport, ContinuityVerificationProbe } from '@arletex/contracts';
import { DatabaseError, ILongitudinalEvaluationRepository } from '@arletex/core';

export class SqliteLongitudinalEvaluationRepository implements ILongitudinalEvaluationRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveReport(report: LongitudinalEvaluationReport): void {
    try {
      this.db
        .prepare(
          `INSERT INTO longitudinal_evaluation_reports (
            report_id, timestamp, overall_score, overall_status,
            evaluated_epoch, model_used, metrics_json, key_observations, recommendations
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(report_id) DO UPDATE SET
            timestamp = excluded.timestamp,
            overall_score = excluded.overall_score,
            overall_status = excluded.overall_status,
            evaluated_epoch = excluded.evaluated_epoch,
            model_used = excluded.model_used,
            metrics_json = excluded.metrics_json,
            key_observations = excluded.key_observations,
            recommendations = excluded.recommendations`,
        )
        .run(
          report.reportId,
          report.timestamp,
          report.overallScore,
          report.overallStatus,
          report.evaluatedEpoch,
          report.modelUsed,
          JSON.stringify(report.metrics),
          JSON.stringify(report.keyObservations ?? []),
          JSON.stringify(report.recommendations ?? []),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save longitudinal evaluation report ${report.reportId}: ${err.message}`,
        err,
      );
    }
  }

  public getReport(id: string): LongitudinalEvaluationReport | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM longitudinal_evaluation_reports WHERE report_id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapReportRow(row);
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to get longitudinal evaluation report ${id}: ${err.message}`,
        err,
      );
    }
  }

  public listReports(limit?: number): LongitudinalEvaluationReport[] {
    try {
      const query = limit
        ? `SELECT * FROM longitudinal_evaluation_reports ORDER BY timestamp DESC LIMIT ?`
        : `SELECT * FROM longitudinal_evaluation_reports ORDER BY timestamp DESC`;
      const rows = (
        limit ? this.db.prepare(query).all(limit) : this.db.prepare(query).all()
      ) as any[];
      return rows.map((r) => this.mapReportRow(r));
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to list longitudinal evaluation reports: ${err.message}`,
        err,
      );
    }
  }

  public saveProbe(probe: ContinuityVerificationProbe): void {
    try {
      this.db
        .prepare(
          `INSERT INTO continuity_verification_probes (
            probe_id, probe_type, baseline_fingerprint, post_event_fingerprint,
            divergence_score, verified_intact, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(probe_id) DO UPDATE SET
            probe_type = excluded.probe_type,
            baseline_fingerprint = excluded.baseline_fingerprint,
            post_event_fingerprint = excluded.post_event_fingerprint,
            divergence_score = excluded.divergence_score,
            verified_intact = excluded.verified_intact,
            timestamp = excluded.timestamp`,
        )
        .run(
          probe.probeId,
          probe.probeType,
          probe.baselineFingerprint,
          probe.postEventFingerprint,
          probe.divergenceScore,
          probe.verifiedIntact ? 1 : 0,
          probe.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save continuity probe ${probe.probeId}: ${err.message}`,
        err,
      );
    }
  }

  public listProbes(probeType?: string, limit?: number): ContinuityVerificationProbe[] {
    try {
      let query = `SELECT * FROM continuity_verification_probes`;
      const clauses: string[] = [];
      const params: any[] = [];

      if (probeType) {
        clauses.push(`probe_type = ?`);
        params.push(probeType);
      }

      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(' AND ');
      }

      query += ` ORDER BY timestamp DESC`;
      if (limit) {
        query += ` LIMIT ?`;
        params.push(limit);
      }

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        probeId: r.probe_id,
        probeType: r.probe_type,
        baselineFingerprint: r.baseline_fingerprint,
        postEventFingerprint: r.post_event_fingerprint,
        divergenceScore: r.divergence_score,
        verifiedIntact: Boolean(r.verified_intact),
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list continuity probes: ${err.message}`, err);
    }
  }

  private mapReportRow(row: any): LongitudinalEvaluationReport {
    return {
      reportId: row.report_id,
      timestamp: row.timestamp,
      overallScore: row.overall_score,
      overallStatus: row.overall_status,
      evaluatedEpoch: row.evaluated_epoch,
      modelUsed: row.model_used,
      metrics: JSON.parse(row.metrics_json || '[]'),
      keyObservations: JSON.parse(row.key_observations || '[]'),
      recommendations: JSON.parse(row.recommendations || '[]'),
    };
  }
}
