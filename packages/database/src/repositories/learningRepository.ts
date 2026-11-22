import Database from 'better-sqlite3';
import {
  BehavioralAdaptationRule,
  LearningExperience,
  LearningExperienceFilter,
} from '@arletex/contracts';
import { DatabaseError, ILearningRepository } from '@arletex/core';

export class SqliteLearningRepository implements ILearningRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Learning Experiences
  // ==========================================

  public recordExperience(experience: LearningExperience): void {
    try {
      this.db
        .prepare(
          `INSERT INTO learning_experiences (
            id, channel, domain, context, action_taken, outcome,
            outcome_details, reward_score, lessons_learned, metadata, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            channel = excluded.channel,
            domain = excluded.domain,
            context = excluded.context,
            action_taken = excluded.action_taken,
            outcome = excluded.outcome,
            outcome_details = excluded.outcome_details,
            reward_score = excluded.reward_score,
            lessons_learned = excluded.lessons_learned,
            metadata = excluded.metadata,
            timestamp = excluded.timestamp`,
        )
        .run(
          experience.id,
          experience.channel,
          experience.domain,
          experience.context,
          experience.actionTaken,
          experience.outcome,
          experience.outcomeDetails,
          experience.rewardScore,
          JSON.stringify(experience.lessonsLearned ?? []),
          experience.metadata ? JSON.stringify(experience.metadata) : null,
          experience.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to record learning experience ${experience.id}: ${err.message}`,
        err,
      );
    }
  }

  public getExperienceById(id: string): LearningExperience | null {
    try {
      const row = this.db.prepare('SELECT * FROM learning_experiences WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapRowToExperience(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get learning experience ${id}: ${err.message}`, err);
    }
  }

  public listExperiences(filter?: LearningExperienceFilter): LearningExperience[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.channel) {
        conditions.push('channel = ?');
        params.push(filter.channel);
      }
      if (filter?.domain) {
        conditions.push('domain = ?');
        params.push(filter.domain);
      }
      if (filter?.outcome) {
        conditions.push('outcome = ?');
        params.push(filter.outcome);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filter?.limit ?? 50;

      const rows = this.db
        .prepare(
          `SELECT * FROM learning_experiences ${whereClause} ORDER BY timestamp DESC LIMIT ?`,
        )
        .all(...params, limit) as any[];

      return rows.map((r) => this.mapRowToExperience(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list learning experiences: ${err.message}`, err);
    }
  }

  // ==========================================
  // Behavioral Adaptation Rules
  // ==========================================

  public saveRule(rule: BehavioralAdaptationRule): void {
    try {
      this.db
        .prepare(
          `INSERT INTO behavioral_adaptation_rules (
            id, source_experience_ids, domain, condition, recommended_strategy,
            avoid_strategy, confidence, success_rate, sample_count, is_generalization,
            transfer_domains, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            source_experience_ids = excluded.source_experience_ids,
            domain = excluded.domain,
            condition = excluded.condition,
            recommended_strategy = excluded.recommended_strategy,
            avoid_strategy = excluded.avoid_strategy,
            confidence = excluded.confidence,
            success_rate = excluded.success_rate,
            sample_count = excluded.sample_count,
            is_generalization = excluded.is_generalization,
            transfer_domains = excluded.transfer_domains,
            updated_at = excluded.updated_at`,
        )
        .run(
          rule.id,
          JSON.stringify(rule.sourceExperienceIds),
          rule.domain,
          rule.condition,
          rule.recommendedStrategy,
          rule.avoidStrategy ?? null,
          rule.confidence,
          rule.successRate,
          rule.sampleCount,
          rule.isGeneralization ? 1 : 0,
          JSON.stringify(rule.transferDomains ?? []),
          rule.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save adaptation rule ${rule.id}: ${err.message}`, err);
    }
  }

  public getRuleById(id: string): BehavioralAdaptationRule | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM behavioral_adaptation_rules WHERE id = ?')
        .get(id) as any;
      if (!row) return null;
      return this.mapRowToRule(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get adaptation rule ${id}: ${err.message}`, err);
    }
  }

  public listRules(filter?: {
    domain?: string;
    minConfidence?: number;
  }): BehavioralAdaptationRule[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.domain) {
        conditions.push('(domain = ? OR transfer_domains LIKE ?)');
        params.push(filter.domain, `%"${filter.domain}"%`);
      }
      if (filter?.minConfidence !== undefined) {
        conditions.push('confidence >= ?');
        params.push(filter.minConfidence);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = this.db
        .prepare(
          `SELECT * FROM behavioral_adaptation_rules ${whereClause} ORDER BY confidence DESC, success_rate DESC`,
        )
        .all(...params) as any[];

      return rows.map((r) => this.mapRowToRule(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list adaptation rules: ${err.message}`, err);
    }
  }

  public updateRule(rule: BehavioralAdaptationRule): void {
    this.saveRule(rule);
  }

  public deleteRule(id: string): void {
    try {
      this.db.prepare('DELETE FROM behavioral_adaptation_rules WHERE id = ?').run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete adaptation rule ${id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Helper Mappers
  // ==========================================

  private mapRowToExperience(row: any): LearningExperience {
    return {
      id: row.id,
      channel: row.channel,
      domain: row.domain,
      context: row.context,
      actionTaken: row.action_taken,
      outcome: row.outcome,
      outcomeDetails: row.outcome_details,
      rewardScore: row.reward_score,
      lessonsLearned:
        typeof row.lessons_learned === 'string'
          ? JSON.parse(row.lessons_learned)
          : (row.lessons_learned ?? []),
      metadata: row.metadata
        ? typeof row.metadata === 'string'
          ? JSON.parse(row.metadata)
          : row.metadata
        : undefined,
      timestamp: row.timestamp,
    };
  }

  private mapRowToRule(row: any): BehavioralAdaptationRule {
    return {
      id: row.id,
      sourceExperienceIds:
        typeof row.source_experience_ids === 'string'
          ? JSON.parse(row.source_experience_ids)
          : (row.source_experience_ids ?? []),
      domain: row.domain,
      condition: row.condition,
      recommendedStrategy: row.recommended_strategy,
      avoidStrategy: row.avoid_strategy ?? undefined,
      confidence: row.confidence,
      successRate: row.success_rate,
      sampleCount: row.sample_count,
      isGeneralization: row.is_generalization === 1 || row.is_generalization === true,
      transferDomains:
        typeof row.transfer_domains === 'string'
          ? JSON.parse(row.transfer_domains)
          : (row.transfer_domains ?? []),
      updatedAt: row.updated_at,
    };
  }
}
