import Database from 'better-sqlite3';
import {
  CommitmentDeadlineType,
  CommitmentStatus,
  DurationProfile,
  FutureIntention,
  FutureIntentionOrigin,
  FutureIntentionStatus,
  LongTermPlan,
  LongTermPlanStatus,
  PlanHorizon,
  UnfinishedCommitment,
} from '@arletex/contracts';
import { DatabaseError, ITemporalRepository } from '@arletex/core';

export class TemporalRepository implements ITemporalRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Future Intentions
  // ==========================================

  public getIntentionById(id: string): FutureIntention | null {
    try {
      const row = this.db.prepare('SELECT * FROM future_intentions WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapIntentionRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get future intention ${id}: ${err.message}`, err);
    }
  }

  public listIntentions(filter?: { status?: FutureIntentionStatus; limit?: number }): FutureIntention[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.status) {
        conditions.push('status = ?');
        params.push(filter.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = filter?.limit ? `LIMIT ${Number(filter.limit)}` : '';

      const rows = this.db
        .prepare(`SELECT * FROM future_intentions ${whereClause} ORDER BY intended_for ASC ${limitClause}`)
        .all(...params) as any[];

      return rows.map((r) => this.mapIntentionRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list future intentions: ${err.message}`, err);
    }
  }

  public saveIntention(intention: FutureIntention): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO future_intentions (
          id, title, description, intended_for, trigger_condition,
          priority, status, origin, associated_goal_id, tags,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          intended_for = excluded.intended_for,
          trigger_condition = excluded.trigger_condition,
          priority = excluded.priority,
          status = excluded.status,
          origin = excluded.origin,
          associated_goal_id = excluded.associated_goal_id,
          tags = excluded.tags,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        intention.id,
        intention.title,
        intention.description,
        intention.intendedFor,
        intention.triggerCondition ?? null,
        intention.priority,
        intention.status,
        intention.origin,
        intention.associatedGoalId ?? null,
        JSON.stringify(intention.tags || []),
        intention.createdAt,
        intention.updatedAt,
      );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save future intention ${intention.id}: ${err.message}`, err);
    }
  }

  public deleteIntention(id: string): boolean {
    try {
      const res = this.db.prepare('DELETE FROM future_intentions WHERE id = ?').run(id);
      return res.changes > 0;
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete future intention ${id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Unfinished Commitments
  // ==========================================

  public getCommitmentById(id: string): UnfinishedCommitment | null {
    try {
      const row = this.db.prepare('SELECT * FROM unfinished_commitments WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapCommitmentRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get commitment ${id}: ${err.message}`, err);
    }
  }

  public listCommitments(filter?: { status?: CommitmentStatus; partnerName?: string }): UnfinishedCommitment[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.status) {
        conditions.push('status = ?');
        params.push(filter.status);
      }
      if (filter?.partnerName) {
        conditions.push('partner_name = ?');
        params.push(filter.partnerName);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = this.db
        .prepare(`SELECT * FROM unfinished_commitments ${whereClause} ORDER BY committed_at DESC`)
        .all(...params) as any[];

      return rows.map((r) => this.mapCommitmentRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list commitments: ${err.message}`, err);
    }
  }

  public saveCommitment(commitment: UnfinishedCommitment): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO unfinished_commitments (
          id, partner_name, commitment_text, context, committed_at,
          target_fulfillment_time, deadline_type, status,
          verification_criteria, fulfillment_evidence, fulfilled_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          partner_name = excluded.partner_name,
          commitment_text = excluded.commitment_text,
          context = excluded.context,
          committed_at = excluded.committed_at,
          target_fulfillment_time = excluded.target_fulfillment_time,
          deadline_type = excluded.deadline_type,
          status = excluded.status,
          verification_criteria = excluded.verification_criteria,
          fulfillment_evidence = excluded.fulfillment_evidence,
          fulfilled_at = excluded.fulfilled_at,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        commitment.id,
        commitment.partnerName,
        commitment.commitmentText,
        commitment.context,
        commitment.committedAt,
        commitment.targetFulfillmentTime ?? null,
        commitment.deadlineType,
        commitment.status,
        commitment.verificationCriteria,
        commitment.fulfillmentEvidence ?? null,
        commitment.fulfilledAt ?? null,
        commitment.createdAt,
        commitment.updatedAt,
      );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save commitment ${commitment.id}: ${err.message}`, err);
    }
  }

  public deleteCommitment(id: string): boolean {
    try {
      const res = this.db.prepare('DELETE FROM unfinished_commitments WHERE id = ?').run(id);
      return res.changes > 0;
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete commitment ${id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Long Term Plans
  // ==========================================

  public getPlanById(id: string): LongTermPlan | null {
    try {
      const row = this.db.prepare('SELECT * FROM long_term_plans WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapPlanRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get long-term plan ${id}: ${err.message}`, err);
    }
  }

  public listPlans(filter?: { status?: LongTermPlanStatus }): LongTermPlan[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.status) {
        conditions.push('status = ?');
        params.push(filter.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = this.db
        .prepare(`SELECT * FROM long_term_plans ${whereClause} ORDER BY created_at DESC`)
        .all(...params) as any[];

      return rows.map((r) => this.mapPlanRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list long-term plans: ${err.message}`, err);
    }
  }

  public savePlan(plan: LongTermPlan): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO long_term_plans (
          id, title, vision_statement, horizon, milestones,
          contingency_plans, status, target_completion_date,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          vision_statement = excluded.vision_statement,
          horizon = excluded.horizon,
          milestones = excluded.milestones,
          contingency_plans = excluded.contingency_plans,
          status = excluded.status,
          target_completion_date = excluded.target_completion_date,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        plan.id,
        plan.title,
        plan.visionStatement,
        plan.horizon,
        JSON.stringify(plan.milestones || []),
        JSON.stringify(plan.contingencyPlans || []),
        plan.status,
        plan.targetCompletionDate,
        plan.createdAt,
        plan.updatedAt,
      );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save long-term plan ${plan.id}: ${err.message}`, err);
    }
  }

  public deletePlan(id: string): boolean {
    try {
      const res = this.db.prepare('DELETE FROM long_term_plans WHERE id = ?').run(id);
      return res.changes > 0;
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete long-term plan ${id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Duration Profiles
  // ==========================================

  public getDurationProfile(operationKey: string): DurationProfile | null {
    try {
      const row = this.db.prepare('SELECT * FROM duration_profiles WHERE operation_key = ?').get(operationKey) as any;
      if (!row) return null;
      return this.mapDurationRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get duration profile ${operationKey}: ${err.message}`, err);
    }
  }

  public listDurationProfiles(): DurationProfile[] {
    try {
      const rows = this.db.prepare('SELECT * FROM duration_profiles ORDER BY operation_key ASC').all() as any[];
      return rows.map((r) => this.mapDurationRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list duration profiles: ${err.message}`, err);
    }
  }

  public saveDurationProfile(profile: DurationProfile): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO duration_profiles (
          operation_key, sample_count, average_duration_ms, min_duration_ms,
          max_duration_ms, standard_deviation_ms, confidence_score, last_calibrated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(operation_key) DO UPDATE SET
          sample_count = excluded.sample_count,
          average_duration_ms = excluded.average_duration_ms,
          min_duration_ms = excluded.min_duration_ms,
          max_duration_ms = excluded.max_duration_ms,
          standard_deviation_ms = excluded.standard_deviation_ms,
          confidence_score = excluded.confidence_score,
          last_calibrated_at = excluded.last_calibrated_at
      `);

      stmt.run(
        profile.operationKey,
        profile.sampleCount,
        profile.averageDurationMs,
        profile.minDurationMs,
        profile.maxDurationMs,
        profile.standardDeviationMs,
        profile.confidenceScore,
        profile.lastCalibratedAt,
      );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save duration profile ${profile.operationKey}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Internal Mapping Helpers
  // ==========================================

  private mapIntentionRow(row: any): FutureIntention {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      intendedFor: row.intended_for,
      triggerCondition: row.trigger_condition ?? undefined,
      priority: row.priority,
      status: row.status as FutureIntentionStatus,
      origin: row.origin as FutureIntentionOrigin,
      associatedGoalId: row.associated_goal_id ?? undefined,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapCommitmentRow(row: any): UnfinishedCommitment {
    return {
      id: row.id,
      partnerName: row.partner_name,
      commitmentText: row.commitment_text,
      context: row.context || '',
      committedAt: row.committed_at,
      targetFulfillmentTime: row.target_fulfillment_time ?? undefined,
      deadlineType: row.deadline_type as CommitmentDeadlineType,
      status: row.status as CommitmentStatus,
      verificationCriteria: row.verification_criteria,
      fulfillmentEvidence: row.fulfillment_evidence ?? undefined,
      fulfilledAt: row.fulfilled_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapPlanRow(row: any): LongTermPlan {
    return {
      id: row.id,
      title: row.title,
      visionStatement: row.vision_statement,
      horizon: row.horizon as PlanHorizon,
      milestones: JSON.parse(row.milestones || '[]'),
      contingencyPlans: JSON.parse(row.contingency_plans || '[]'),
      status: row.status as LongTermPlanStatus,
      targetCompletionDate: row.target_completion_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapDurationRow(row: any): DurationProfile {
    return {
      operationKey: row.operation_key,
      sampleCount: row.sample_count,
      averageDurationMs: row.average_duration_ms,
      minDurationMs: row.min_duration_ms,
      maxDurationMs: row.max_duration_ms,
      standardDeviationMs: row.standard_deviation_ms,
      confidenceScore: row.confidence_score,
      lastCalibratedAt: row.last_calibrated_at,
    };
  }
}
