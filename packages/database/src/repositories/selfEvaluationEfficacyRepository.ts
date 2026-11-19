import Database from 'better-sqlite3';
import {
  CapabilityLimitation,
  CompetenceLevel,
  DomainCompetence,
  EfficacyEvidence,
  SelfEvaluationSnapshot,
  SelfImprovementGoal,
} from '@arletex/contracts';
import { DatabaseError, ISelfEvaluationEfficacyRepository } from '@arletex/core';

export class SqliteSelfEvaluationEfficacyRepository implements ISelfEvaluationEfficacyRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveDomainCompetence(competence: DomainCompetence): void {
    try {
      this.db
        .prepare(
          `INSERT INTO domain_competences (
            domain, level, calibrated_confidence,
            success_count, failure_count, demonstrated_evidence_ids_json,
            last_assessed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(domain) DO UPDATE SET
            level = excluded.level,
            calibrated_confidence = excluded.calibrated_confidence,
            success_count = excluded.success_count,
            failure_count = excluded.failure_count,
            demonstrated_evidence_ids_json = excluded.demonstrated_evidence_ids_json,
            last_assessed_at = excluded.last_assessed_at`,
        )
        .run(
          competence.domain,
          competence.level,
          competence.calibratedConfidence,
          competence.successCount,
          competence.failureCount,
          JSON.stringify(competence.demonstratedEvidenceIds || []),
          competence.lastAssessedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save domain competence ${competence.domain}: ${err.message}`, err);
    }
  }

  public getDomainCompetence(domain: string): DomainCompetence | null {
    try {
      const row = this.db.prepare(`SELECT * FROM domain_competences WHERE domain = ?`).get(domain) as any;
      if (!row) return null;
      return {
        domain: row.domain,
        level: row.level as CompetenceLevel,
        calibratedConfidence: row.calibrated_confidence,
        successCount: row.success_count,
        failureCount: row.failure_count,
        demonstratedEvidenceIds: JSON.parse(row.demonstrated_evidence_ids_json || '[]'),
        lastAssessedAt: row.last_assessed_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get domain competence ${domain}: ${err.message}`, err);
    }
  }

  public listDomainCompetences(): DomainCompetence[] {
    try {
      const rows = this.db.prepare(`SELECT * FROM domain_competences ORDER BY calibrated_confidence DESC`).all() as any[];
      return rows.map((r) => ({
        domain: r.domain,
        level: r.level as CompetenceLevel,
        calibratedConfidence: r.calibrated_confidence,
        successCount: r.success_count,
        failureCount: r.failure_count,
        demonstratedEvidenceIds: JSON.parse(r.demonstrated_evidence_ids_json || '[]'),
        lastAssessedAt: r.last_assessed_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list domain competences: ${err.message}`, err);
    }
  }

  public saveEvidence(evidence: EfficacyEvidence): void {
    try {
      this.db
        .prepare(
          `INSERT INTO efficacy_evidence (
            id, domain, type, task_description,
            difficulty, outcome_description, lessons_learned,
            timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            domain = excluded.domain,
            type = excluded.type,
            task_description = excluded.task_description,
            difficulty = excluded.difficulty,
            outcome_description = excluded.outcome_description,
            lessons_learned = excluded.lessons_learned,
            timestamp = excluded.timestamp`,
        )
        .run(
          evidence.id,
          evidence.domain,
          evidence.type,
          evidence.taskDescription,
          evidence.difficulty,
          evidence.outcomeDescription,
          evidence.lessonsLearned || null,
          evidence.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save efficacy evidence ${evidence.id}: ${err.message}`, err);
    }
  }

  public listEvidence(domain?: string, type?: 'achievement' | 'failure', limit: number = 50): EfficacyEvidence[] {
    try {
      let query = `SELECT * FROM efficacy_evidence`;
      const conditions: string[] = [];
      const params: any[] = [];

      if (domain) {
        conditions.push(`domain = ?`);
        params.push(domain);
      }
      if (type) {
        conditions.push(`type = ?`);
        params.push(type);
      }

      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
      }
      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        domain: r.domain,
        type: r.type,
        taskDescription: r.task_description,
        difficulty: r.difficulty,
        outcomeDescription: r.outcome_description,
        lessonsLearned: r.lessons_learned || undefined,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list efficacy evidence: ${err.message}`, err);
    }
  }

  public saveLimitation(limitation: CapabilityLimitation): void {
    try {
      this.db
        .prepare(
          `INSERT INTO capability_limitations (
            id, domain, limitation, mitigation_strategy,
            is_strict_constraint, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            domain = excluded.domain,
            limitation = excluded.limitation,
            mitigation_strategy = excluded.mitigation_strategy,
            is_strict_constraint = excluded.is_strict_constraint,
            updated_at = excluded.updated_at`,
        )
        .run(
          limitation.id,
          limitation.domain,
          limitation.limitation,
          limitation.mitigationStrategy,
          limitation.isStrictConstraint ? 1 : 0,
          limitation.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save capability limitation ${limitation.id}: ${err.message}`, err);
    }
  }

  public listLimitations(domain?: string): CapabilityLimitation[] {
    try {
      let query = `SELECT * FROM capability_limitations`;
      const params: any[] = [];
      if (domain) {
        query += ` WHERE domain = ?`;
        params.push(domain);
      }
      query += ` ORDER BY updated_at DESC`;

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        domain: r.domain,
        limitation: r.limitation,
        mitigationStrategy: r.mitigation_strategy,
        isStrictConstraint: Boolean(r.is_strict_constraint),
        updatedAt: r.updated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list capability limitations: ${err.message}`, err);
    }
  }

  public saveImprovementGoal(goal: SelfImprovementGoal): void {
    try {
      this.db
        .prepare(
          `INSERT INTO self_improvement_goals (
            id, domain, identified_weakness, target_capability,
            progress, action_steps_json, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            domain = excluded.domain,
            identified_weakness = excluded.identified_weakness,
            target_capability = excluded.target_capability,
            progress = excluded.progress,
            action_steps_json = excluded.action_steps_json,
            status = excluded.status,
            updated_at = excluded.updated_at`,
        )
        .run(
          goal.id,
          goal.domain,
          goal.identifiedWeakness,
          goal.targetCapability,
          goal.progress,
          JSON.stringify(goal.actionSteps || []),
          goal.status,
          goal.createdAt,
          goal.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save self-improvement goal ${goal.id}: ${err.message}`, err);
    }
  }

  public getImprovementGoalById(id: string): SelfImprovementGoal | null {
    try {
      const row = this.db.prepare(`SELECT * FROM self_improvement_goals WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        domain: row.domain,
        identifiedWeakness: row.identified_weakness,
        targetCapability: row.target_capability,
        progress: row.progress,
        actionSteps: JSON.parse(row.action_steps_json || '[]'),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get self-improvement goal ${id}: ${err.message}`, err);
    }
  }

  public listImprovementGoals(domain?: string, status?: string): SelfImprovementGoal[] {
    try {
      let query = `SELECT * FROM self_improvement_goals`;
      const conditions: string[] = [];
      const params: any[] = [];
      if (domain) {
        conditions.push(`domain = ?`);
        params.push(domain);
      }
      if (status) {
        conditions.push(`status = ?`);
        params.push(status);
      }
      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
      }
      query += ` ORDER BY updated_at DESC`;

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        domain: r.domain,
        identifiedWeakness: r.identified_weakness,
        targetCapability: r.target_capability,
        progress: r.progress,
        actionSteps: JSON.parse(r.action_steps_json || '[]'),
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list self-improvement goals: ${err.message}`, err);
    }
  }

  public saveSnapshot(snapshot: SelfEvaluationSnapshot): void {
    try {
      this.db
        .prepare(
          `INSERT INTO self_evaluation_snapshots (
            id, overall_confidence, domain_competences_json,
            active_limitations_json, active_improvements_json,
            evidence_summary_json, evaluated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            overall_confidence = excluded.overall_confidence,
            domain_competences_json = excluded.domain_competences_json,
            active_limitations_json = excluded.active_limitations_json,
            active_improvements_json = excluded.active_improvements_json,
            evidence_summary_json = excluded.evidence_summary_json,
            evaluated_at = excluded.evaluated_at`,
        )
        .run(
          snapshot.id,
          snapshot.overallConfidence,
          JSON.stringify(snapshot.domainCompetences),
          JSON.stringify(snapshot.activeLimitations),
          JSON.stringify(snapshot.activeImprovements),
          JSON.stringify(snapshot.evidenceSummary),
          snapshot.evaluatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save self-evaluation snapshot ${snapshot.id}: ${err.message}`, err);
    }
  }

  public getLatestSnapshot(): SelfEvaluationSnapshot | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM self_evaluation_snapshots ORDER BY evaluated_at DESC LIMIT 1`)
        .get() as any;
      if (!row) return null;
      return {
        id: row.id,
        overallConfidence: row.overall_confidence,
        domainCompetences: JSON.parse(row.domain_competences_json || '[]'),
        activeLimitations: JSON.parse(row.active_limitations_json || '[]'),
        activeImprovements: JSON.parse(row.active_improvements_json || '[]'),
        evidenceSummary: JSON.parse(row.evidence_summary_json || '{}'),
        evaluatedAt: row.evaluated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest self-evaluation snapshot: ${err.message}`, err);
    }
  }
}
