import Database from 'better-sqlite3';
import {
  NoveltyDetectionRecord,
  KnowledgeGapRecord,
  ExploratoryQuestion,
  IndependentInvestigationRecord,
  DiscoveredInterest,
} from '@arletex/contracts';
import { DatabaseError, ICuriosityExplorationRepository } from '@arletex/core';

export class SqliteCuriosityExplorationRepository implements ICuriosityExplorationRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveNovelty(record: NoveltyDetectionRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO novelty_detections (
            id, stimulus, detected_domain, novelty_score,
            familiarity_baseline, is_novel, detected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            stimulus = excluded.stimulus,
            detected_domain = excluded.detected_domain,
            novelty_score = excluded.novelty_score,
            familiarity_baseline = excluded.familiarity_baseline,
            is_novel = excluded.is_novel,
            detected_at = excluded.detected_at`,
        )
        .run(
          record.id,
          record.stimulus,
          record.detectedDomain,
          record.noveltyScore,
          record.familiarityBaseline,
          record.isNovel ? 1 : 0,
          record.detectedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save novelty detection ${record.id}: ${err.message}`, err);
    }
  }

  public listNoveltyDetections(limit: number = 50): NoveltyDetectionRecord[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM novelty_detections ORDER BY detected_at DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        stimulus: r.stimulus,
        detectedDomain: r.detected_domain,
        noveltyScore: r.novelty_score,
        familiarityBaseline: r.familiarity_baseline,
        isNovel: Boolean(r.is_novel),
        detectedAt: r.detected_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list novelty detections: ${err.message}`, err);
    }
  }

  public saveKnowledgeGap(gap: KnowledgeGapRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO knowledge_gaps (
            id, domain, topic, gap_description,
            epistemic_uncertainty, importance_score, identified_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            domain = excluded.domain,
            topic = excluded.topic,
            gap_description = excluded.gap_description,
            epistemic_uncertainty = excluded.epistemic_uncertainty,
            importance_score = excluded.importance_score,
            identified_at = excluded.identified_at`,
        )
        .run(
          gap.id,
          gap.domain,
          gap.topic,
          gap.gapDescription,
          gap.epistemicUncertainty,
          gap.importanceScore,
          gap.identifiedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save knowledge gap ${gap.id}: ${err.message}`, err);
    }
  }

  public listKnowledgeGaps(domain?: string, limit: number = 50): KnowledgeGapRecord[] {
    try {
      let rows: any[];
      if (domain) {
        rows = this.db
          .prepare(`SELECT * FROM knowledge_gaps WHERE domain = ? ORDER BY epistemic_uncertainty DESC, identified_at DESC LIMIT ?`)
          .all(domain, limit) as any[];
      } else {
        rows = this.db
          .prepare(`SELECT * FROM knowledge_gaps ORDER BY epistemic_uncertainty DESC, identified_at DESC LIMIT ?`)
          .all(limit) as any[];
      }
      return rows.map((r) => ({
        id: r.id,
        domain: r.domain,
        topic: r.topic,
        gapDescription: r.gap_description,
        epistemicUncertainty: r.epistemic_uncertainty,
        importanceScore: r.importance_score,
        identifiedAt: r.identified_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list knowledge gaps: ${err.message}`, err);
    }
  }

  public saveQuestion(question: ExploratoryQuestion): void {
    try {
      this.db
        .prepare(
          `INSERT INTO exploratory_questions (
            id, knowledge_gap_id, domain, question, hypotheses_json, formulated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            knowledge_gap_id = excluded.knowledge_gap_id,
            domain = excluded.domain,
            question = excluded.question,
            hypotheses_json = excluded.hypotheses_json,
            formulated_at = excluded.formulated_at`,
        )
        .run(
          question.id,
          question.knowledgeGapId,
          question.domain,
          question.question,
          JSON.stringify(question.hypotheses || []),
          question.formulatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save exploratory question ${question.id}: ${err.message}`, err);
    }
  }

  public listQuestions(knowledgeGapId?: string, limit: number = 50): ExploratoryQuestion[] {
    try {
      let rows: any[];
      if (knowledgeGapId) {
        rows = this.db
          .prepare(`SELECT * FROM exploratory_questions WHERE knowledge_gap_id = ? ORDER BY formulated_at DESC LIMIT ?`)
          .all(knowledgeGapId, limit) as any[];
      } else {
        rows = this.db
          .prepare(`SELECT * FROM exploratory_questions ORDER BY formulated_at DESC LIMIT ?`)
          .all(limit) as any[];
      }
      return rows.map((r) => ({
        id: r.id,
        knowledgeGapId: r.knowledge_gap_id,
        domain: r.domain,
        question: r.question,
        hypotheses: JSON.parse(r.hypotheses_json || '[]'),
        formulatedAt: r.formulated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list exploratory questions: ${err.message}`, err);
    }
  }

  public saveInvestigation(inv: IndependentInvestigationRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO independent_investigations (
            id, question_id, domain, investigation_title,
            steps_json, synthesis_summary, is_autonomous, initiated_by, status, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            question_id = excluded.question_id,
            domain = excluded.domain,
            investigation_title = excluded.investigation_title,
            steps_json = excluded.steps_json,
            synthesis_summary = excluded.synthesis_summary,
            is_autonomous = excluded.is_autonomous,
            initiated_by = excluded.initiated_by,
            status = excluded.status,
            timestamp = excluded.timestamp`,
        )
        .run(
          inv.id,
          inv.questionId,
          inv.domain,
          inv.investigationTitle,
          JSON.stringify(inv.stepsExecuted || []),
          inv.synthesisSummary,
          inv.isAutonomous ? 1 : 0,
          inv.initiatedBy,
          inv.status,
          inv.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save independent investigation ${inv.id}: ${err.message}`, err);
    }
  }

  public listInvestigations(domain?: string, limit: number = 50): IndependentInvestigationRecord[] {
    try {
      let rows: any[];
      if (domain) {
        rows = this.db
          .prepare(`SELECT * FROM independent_investigations WHERE domain = ? ORDER BY timestamp DESC LIMIT ?`)
          .all(domain, limit) as any[];
      } else {
        rows = this.db
          .prepare(`SELECT * FROM independent_investigations ORDER BY timestamp DESC LIMIT ?`)
          .all(limit) as any[];
      }
      return rows.map((r) => ({
        id: r.id,
        questionId: r.question_id,
        domain: r.domain,
        investigationTitle: r.investigation_title,
        stepsExecuted: JSON.parse(r.steps_json || '[]'),
        synthesisSummary: r.synthesis_summary,
        isAutonomous: true as const,
        initiatedBy: 'arle_autonomous' as const,
        status: r.status,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list independent investigations: ${err.message}`, err);
    }
  }

  public saveInterest(interest: DiscoveredInterest): void {
    try {
      this.db
        .prepare(
          `INSERT INTO discovered_interests (
            id, domain, topic, maturity, curiosity_intensity,
            investigation_count, is_user_assigned, discovered_rationale,
            key_findings_json, first_discovered_at, last_explored_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            domain = excluded.domain,
            topic = excluded.topic,
            maturity = excluded.maturity,
            curiosity_intensity = excluded.curiosity_intensity,
            investigation_count = excluded.investigation_count,
            is_user_assigned = excluded.is_user_assigned,
            discovered_rationale = excluded.discovered_rationale,
            key_findings_json = excluded.key_findings_json,
            last_explored_at = excluded.last_explored_at`,
        )
        .run(
          interest.id,
          interest.domain,
          interest.topic,
          interest.maturity,
          interest.curiosityIntensity,
          interest.investigationCount,
          interest.isUserAssigned ? 1 : 0,
          interest.discoveredRationale,
          JSON.stringify(interest.keyFindings || []),
          interest.firstDiscoveredAt,
          interest.lastExploredAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save discovered interest ${interest.id}: ${err.message}`, err);
    }
  }

  public getInterestById(id: string): DiscoveredInterest | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM discovered_interests WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapInterestRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get discovered interest ${id}: ${err.message}`, err);
    }
  }

  public listInterests(limit: number = 50): DiscoveredInterest[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM discovered_interests ORDER BY curiosity_intensity DESC, last_explored_at DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => this.mapInterestRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list discovered interests: ${err.message}`, err);
    }
  }

  private mapInterestRow(row: any): DiscoveredInterest {
    return {
      id: row.id,
      domain: row.domain,
      topic: row.topic,
      maturity: row.maturity,
      curiosityIntensity: row.curiosity_intensity,
      investigationCount: row.investigation_count,
      isUserAssigned: false as const,
      discoveredRationale: row.discovered_rationale,
      keyFindings: JSON.parse(row.key_findings_json || '[]'),
      firstDiscoveredAt: row.first_discovered_at,
      lastExploredAt: row.last_explored_at,
    };
  }
}
