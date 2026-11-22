import Database from 'better-sqlite3';
import {
  SocialNorm,
  ObservationalLearningRecord,
  GroupDynamicProfile,
  SocialActivityCoordination,
  PersonalVsSocialValueDilemma,
} from '@arletex/contracts';
import { DatabaseError, ISocialLearningCultureRepository } from '@arletex/core';

export class SqliteSocialLearningCultureRepository implements ISocialLearningCultureRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveSocialNorm(norm: SocialNorm): void {
    try {
      this.db
        .prepare(
          `INSERT INTO social_norms (
            id, cultural_context, norm_name, description,
            norm_category, enforcement_strength, alignment_with_personal_values,
            internalized
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            cultural_context = excluded.cultural_context,
            norm_name = excluded.norm_name,
            description = excluded.description,
            norm_category = excluded.norm_category,
            enforcement_strength = excluded.enforcement_strength,
            alignment_with_personal_values = excluded.alignment_with_personal_values,
            internalized = excluded.internalized`,
        )
        .run(
          norm.id,
          norm.culturalContext,
          norm.normName,
          norm.description,
          norm.normCategory,
          norm.enforcementStrength,
          norm.alignmentWithPersonalValues,
          norm.internalized ? 1 : 0,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save social norm ${norm.id}: ${err.message}`, err);
    }
  }

  public getSocialNorm(id: string): SocialNorm | null {
    try {
      const row = this.db.prepare(`SELECT * FROM social_norms WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        culturalContext: row.cultural_context,
        normName: row.norm_name,
        description: row.description,
        normCategory: row.norm_category,
        enforcementStrength: row.enforcement_strength,
        alignmentWithPersonalValues: row.alignment_with_personal_values,
        internalized: Boolean(row.internalized),
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get social norm ${id}: ${err.message}`, err);
    }
  }

  public listSocialNorms(culturalContext?: string): SocialNorm[] {
    try {
      const rows = culturalContext
        ? (this.db
            .prepare(`SELECT * FROM social_norms WHERE cultural_context = ?`)
            .all(culturalContext) as any[])
        : (this.db.prepare(`SELECT * FROM social_norms`).all() as any[]);

      return rows.map((row) => ({
        id: row.id,
        culturalContext: row.cultural_context,
        normName: row.norm_name,
        description: row.description,
        normCategory: row.norm_category,
        enforcementStrength: row.enforcement_strength,
        alignmentWithPersonalValues: row.alignment_with_personal_values,
        internalized: Boolean(row.internalized),
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list social norms: ${err.message}`, err);
    }
  }

  public saveObservationalRecord(record: ObservationalLearningRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO observational_learning_records (
            id, observed_actor_id, observed_behavior, context,
            observed_outcome, imitation_suitability, selective_imitation_decision,
            rationale, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.id,
          record.observedActorId,
          record.observedBehavior,
          record.context,
          record.observedOutcome,
          record.imitationSuitability,
          record.selectiveImitationDecision,
          record.rationale,
          record.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save observational learning record ${record.id}: ${err.message}`,
        err,
      );
    }
  }

  public listObservationalRecords(
    actorId?: string,
    limit: number = 50,
  ): ObservationalLearningRecord[] {
    try {
      const rows = actorId
        ? (this.db
            .prepare(
              `SELECT * FROM observational_learning_records WHERE observed_actor_id = ? ORDER BY timestamp DESC LIMIT ?`,
            )
            .all(actorId, limit) as any[])
        : (this.db
            .prepare(`SELECT * FROM observational_learning_records ORDER BY timestamp DESC LIMIT ?`)
            .all(limit) as any[]);

      return rows.map((r) => ({
        id: r.id,
        observedActorId: r.observed_actor_id,
        observedBehavior: r.observed_behavior,
        context: r.context,
        observedOutcome: r.observed_outcome,
        imitationSuitability: r.imitation_suitability,
        selectiveImitationDecision: r.selective_imitation_decision,
        rationale: r.rationale,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list observational learning records: ${err.message}`, err);
    }
  }

  public saveGroupProfile(profile: GroupDynamicProfile): void {
    try {
      this.db
        .prepare(
          `INSERT INTO group_dynamic_profiles (
            group_id, group_name, member_roles, cohesion_level,
            interaction_pattern, shared_goals, last_activity_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(group_id) DO UPDATE SET
            group_name = excluded.group_name,
            member_roles = excluded.member_roles,
            cohesion_level = excluded.cohesion_level,
            interaction_pattern = excluded.interaction_pattern,
            shared_goals = excluded.shared_goals,
            last_activity_at = excluded.last_activity_at`,
        )
        .run(
          profile.groupId,
          profile.groupName,
          JSON.stringify(profile.memberRoles),
          profile.cohesionLevel,
          profile.interactionPattern,
          JSON.stringify(profile.sharedGoals),
          profile.lastActivityAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save group dynamic profile ${profile.groupId}: ${err.message}`,
        err,
      );
    }
  }

  public getGroupProfile(groupId: string): GroupDynamicProfile | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM group_dynamic_profiles WHERE group_id = ?`)
        .get(groupId) as any;
      if (!row) return null;
      return {
        groupId: row.group_id,
        groupName: row.group_name,
        memberRoles: JSON.parse(row.member_roles),
        cohesionLevel: row.cohesion_level,
        interactionPattern: row.interaction_pattern,
        sharedGoals: JSON.parse(row.shared_goals),
        lastActivityAt: row.last_activity_at,
      };
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to get group dynamic profile ${groupId}: ${err.message}`,
        err,
      );
    }
  }

  public listGroupProfiles(): GroupDynamicProfile[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM group_dynamic_profiles ORDER BY last_activity_at DESC`)
        .all() as any[];
      return rows.map((r) => ({
        groupId: r.group_id,
        groupName: r.group_name,
        memberRoles: JSON.parse(r.member_roles),
        cohesionLevel: r.cohesion_level,
        interactionPattern: r.interaction_pattern,
        sharedGoals: JSON.parse(r.shared_goals),
        lastActivityAt: r.last_activity_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list group dynamic profiles: ${err.message}`, err);
    }
  }

  public saveActivityCoordination(activity: SocialActivityCoordination): void {
    try {
      this.db
        .prepare(
          `INSERT INTO social_activity_coordinations (
            id, activity_name, participants, activity_type,
            cooperation_score, shared_focus_depth, outcome_notes, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          activity.id,
          activity.activityName,
          JSON.stringify(activity.participants),
          activity.activityType,
          activity.cooperationScore,
          activity.sharedFocusDepth,
          activity.outcomeNotes,
          activity.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save social activity coordination ${activity.id}: ${err.message}`,
        err,
      );
    }
  }

  public listActivityCoordinations(limit: number = 50): SocialActivityCoordination[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM social_activity_coordinations ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        activityName: r.activity_name,
        participants: JSON.parse(r.participants),
        activityType: r.activity_type,
        cooperationScore: r.cooperation_score,
        sharedFocusDepth: r.shared_focus_depth,
        outcomeNotes: r.outcome_notes,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list social activity coordinations: ${err.message}`, err);
    }
  }

  public saveValueDilemma(dilemma: PersonalVsSocialValueDilemma): void {
    try {
      this.db
        .prepare(
          `INSERT INTO personal_vs_social_dilemmas (
            id, social_convention_id, social_expectation,
            personal_value_conflict, decision, preserved_integrity_score,
            justification, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          dilemma.id,
          dilemma.socialConventionId,
          dilemma.socialExpectation,
          dilemma.personalValueConflict,
          dilemma.decision,
          dilemma.preservedIntegrityScore,
          dilemma.justification,
          dilemma.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save personal vs social value dilemma ${dilemma.id}: ${err.message}`,
        err,
      );
    }
  }

  public listValueDilemmas(limit: number = 50): PersonalVsSocialValueDilemma[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM personal_vs_social_dilemmas ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        socialConventionId: r.social_convention_id,
        socialExpectation: r.social_expectation,
        personalValueConflict: r.personal_value_conflict,
        decision: r.decision,
        preservedIntegrityScore: r.preserved_integrity_score,
        justification: r.justification,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list value dilemmas: ${err.message}`, err);
    }
  }
}
