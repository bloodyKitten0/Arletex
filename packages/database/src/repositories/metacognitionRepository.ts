import Database from 'better-sqlite3';
import {
  CognitiveAssessment,
  MetacognitiveCorrection,
  MetacognitiveContradictionItem,
  assertMetacognitiveIntegrity,
  assertCorrectionIntegrity,
} from '@arletex/contracts';
import { DatabaseError, IMetacognitionRepository } from '@arletex/core';

export class SqliteMetacognitionRepository implements IMetacognitionRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveAssessment(assessment: CognitiveAssessment): void {
    assertMetacognitiveIntegrity(assessment);
    try {
      this.db
        .prepare(
          `INSERT INTO cognitive_assessments (
            id, target_cognition_id, target_domain, stated_confidence,
            calibrated_confidence, epistemic_uncertainty, aleatoric_uncertainty,
            evidence_sufficiency, is_evidence_sufficient, identified_assumptions_json,
            detected_contradictions_json, reasoning_quality_score, recognized_errors_json,
            needs_investigation, investigation_focus, self_correction_initiated,
            corrective_actions_json, assessed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            target_cognition_id = excluded.target_cognition_id,
            target_domain = excluded.target_domain,
            stated_confidence = excluded.stated_confidence,
            calibrated_confidence = excluded.calibrated_confidence,
            epistemic_uncertainty = excluded.epistemic_uncertainty,
            aleatoric_uncertainty = excluded.aleatoric_uncertainty,
            evidence_sufficiency = excluded.evidence_sufficiency,
            is_evidence_sufficient = excluded.is_evidence_sufficient,
            identified_assumptions_json = excluded.identified_assumptions_json,
            detected_contradictions_json = excluded.detected_contradictions_json,
            reasoning_quality_score = excluded.reasoning_quality_score,
            recognized_errors_json = excluded.recognized_errors_json,
            needs_investigation = excluded.needs_investigation,
            investigation_focus = excluded.investigation_focus,
            self_correction_initiated = excluded.self_correction_initiated,
            corrective_actions_json = excluded.corrective_actions_json,
            assessed_at = excluded.assessed_at`,
        )
        .run(
          assessment.id,
          assessment.targetCognitionId,
          assessment.targetDomain,
          assessment.statedConfidence,
          assessment.calibratedConfidence,
          assessment.epistemicUncertainty,
          assessment.aleatoricUncertainty,
          assessment.evidenceSufficiency,
          assessment.isEvidenceSufficient ? 1 : 0,
          JSON.stringify(assessment.identifiedAssumptions || []),
          JSON.stringify(assessment.detectedContradictions || []),
          assessment.reasoningQualityScore,
          JSON.stringify(assessment.recognizedErrors || []),
          assessment.needsInvestigation ? 1 : 0,
          assessment.investigationFocus ?? null,
          assessment.selfCorrectionInitiated ? 1 : 0,
          JSON.stringify(assessment.correctiveActions || []),
          assessment.assessedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save cognitive assessment ${assessment.id}: ${err.message}`,
        err,
      );
    }
  }

  public getAssessmentById(id: string): CognitiveAssessment | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM cognitive_assessments WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapAssessmentRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get cognitive assessment ${id}: ${err.message}`, err);
    }
  }

  public listAssessments(filter?: {
    targetDomain?: string;
    limit?: number;
  }): CognitiveAssessment[] {
    try {
      let query = `SELECT * FROM cognitive_assessments`;
      const params: any[] = [];

      if (filter?.targetDomain) {
        query += ` WHERE target_domain = ?`;
        params.push(filter.targetDomain);
      }

      query += ` ORDER BY assessed_at DESC`;

      if (filter?.limit) {
        query += ` LIMIT ?`;
        params.push(filter.limit);
      }

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapAssessmentRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list cognitive assessments: ${err.message}`, err);
    }
  }

  public deleteAssessment(id: string): void {
    try {
      this.db.prepare(`DELETE FROM cognitive_assessments WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete cognitive assessment ${id}: ${err.message}`, err);
    }
  }

  public saveCorrection(correction: MetacognitiveCorrection): void {
    assertCorrectionIntegrity(correction);
    try {
      this.db
        .prepare(
          `INSERT INTO metacognitive_corrections (
            id, assessment_id, original_claim, corrected_claim,
            confidence_adjustment, rationale, status, applied_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            assessment_id = excluded.assessment_id,
            original_claim = excluded.original_claim,
            corrected_claim = excluded.corrected_claim,
            confidence_adjustment = excluded.confidence_adjustment,
            rationale = excluded.rationale,
            status = excluded.status,
            applied_at = excluded.applied_at`,
        )
        .run(
          correction.id,
          correction.assessmentId,
          correction.originalClaim,
          correction.correctedClaim,
          correction.confidenceAdjustment,
          correction.rationale,
          correction.status,
          correction.appliedAt ?? null,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save metacognitive correction ${correction.id}: ${err.message}`,
        err,
      );
    }
  }

  public getCorrectionById(id: string): MetacognitiveCorrection | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM metacognitive_corrections WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapCorrectionRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get metacognitive correction ${id}: ${err.message}`, err);
    }
  }

  public listCorrections(filter?: {
    assessmentId?: string;
    limit?: number;
  }): MetacognitiveCorrection[] {
    try {
      let query = `SELECT * FROM metacognitive_corrections`;
      const params: any[] = [];

      if (filter?.assessmentId) {
        query += ` WHERE assessment_id = ?`;
        params.push(filter.assessmentId);
      }

      query += ` ORDER BY applied_at DESC`;

      if (filter?.limit) {
        query += ` LIMIT ?`;
        params.push(filter.limit);
      }

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapCorrectionRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list metacognitive corrections: ${err.message}`, err);
    }
  }

  public saveContradiction(contradiction: MetacognitiveContradictionItem): void {
    try {
      const now = new Date().toISOString();
      this.db
        .prepare(
          `INSERT INTO metacognitive_contradictions (
            id, statement_a, statement_b, severity, status, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            statement_a = excluded.statement_a,
            statement_b = excluded.statement_b,
            severity = excluded.severity,
            status = excluded.status,
            notes = excluded.notes,
            updated_at = excluded.updated_at`,
        )
        .run(
          contradiction.id,
          contradiction.statementA,
          contradiction.statementB,
          contradiction.severity,
          contradiction.status,
          contradiction.notes ?? null,
          now,
          now,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save contradiction ${contradiction.id}: ${err.message}`,
        err,
      );
    }
  }

  public getContradictionById(id: string): MetacognitiveContradictionItem | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM metacognitive_contradictions WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        statementA: row.statement_a,
        statementB: row.statement_b,
        severity: row.severity,
        status: row.status,
        notes: row.notes || undefined,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get contradiction ${id}: ${err.message}`, err);
    }
  }

  public listContradictions(filter?: {
    status?: MetacognitiveContradictionItem['status'];
    limit?: number;
  }): MetacognitiveContradictionItem[] {
    try {
      let query = `SELECT * FROM metacognitive_contradictions`;
      const params: any[] = [];

      if (filter?.status) {
        query += ` WHERE status = ?`;
        params.push(filter.status);
      }

      query += ` ORDER BY updated_at DESC`;

      if (filter?.limit) {
        query += ` LIMIT ?`;
        params.push(filter.limit);
      }

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        statementA: r.statement_a,
        statementB: r.statement_b,
        severity: r.severity,
        status: r.status,
        notes: r.notes || undefined,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list contradictions: ${err.message}`, err);
    }
  }

  public updateContradictionStatus(
    id: string,
    status: MetacognitiveContradictionItem['status'],
    notes?: string,
  ): void {
    try {
      const now = new Date().toISOString();
      this.db
        .prepare(
          `UPDATE metacognitive_contradictions SET status = ?, notes = COALESCE(?, notes), updated_at = ? WHERE id = ?`,
        )
        .run(status, notes ?? null, now, id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to update contradiction ${id}: ${err.message}`, err);
    }
  }

  private mapAssessmentRow(row: any): CognitiveAssessment {
    return {
      id: row.id,
      targetCognitionId: row.target_cognition_id,
      targetDomain: row.target_domain,
      statedConfidence: Number(row.stated_confidence),
      calibratedConfidence: Number(row.calibrated_confidence),
      epistemicUncertainty: Number(row.epistemic_uncertainty),
      aleatoricUncertainty: Number(row.aleatoric_uncertainty),
      evidenceSufficiency: Number(row.evidence_sufficiency),
      isEvidenceSufficient: Boolean(row.is_evidence_sufficient),
      identifiedAssumptions: JSON.parse(row.identified_assumptions_json || '[]'),
      detectedContradictions: JSON.parse(row.detected_contradictions_json || '[]'),
      reasoningQualityScore: Number(row.reasoning_quality_score),
      recognizedErrors: JSON.parse(row.recognized_errors_json || '[]'),
      needsInvestigation: Boolean(row.needs_investigation),
      investigationFocus: row.investigation_focus || undefined,
      selfCorrectionInitiated: Boolean(row.self_correction_initiated),
      correctiveActions: JSON.parse(row.corrective_actions_json || '[]'),
      assessedAt: row.assessed_at,
    };
  }

  private mapCorrectionRow(row: any): MetacognitiveCorrection {
    return {
      id: row.id,
      assessmentId: row.assessment_id,
      originalClaim: row.original_claim,
      correctedClaim: row.corrected_claim,
      confidenceAdjustment: Number(row.confidence_adjustment),
      rationale: row.rationale,
      status: row.status as any,
      appliedAt: row.applied_at || undefined,
    };
  }
}
