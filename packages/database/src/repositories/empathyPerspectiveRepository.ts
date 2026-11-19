import Database from 'better-sqlite3';
import {
  EmpatheticResponse,
  InferredExperience,
  PerspectiveRevisionRecord,
  PerspectiveTakingModel,
} from '@arletex/contracts';
import { DatabaseError, IEmpathyPerspectiveRepository } from '@arletex/core';

export class SqliteEmpathyPerspectiveRepository implements IEmpathyPerspectiveRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveExperience(experience: InferredExperience): void {
    try {
      this.db
        .prepare(
          `INSERT INTO empathy_inferred_experiences (
            id, target_person_id, observed_cues_json,
            primary_inferred_affect, inferred_needs_json,
            confidence, epistemic_modality, inferred_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            target_person_id = excluded.target_person_id,
            observed_cues_json = excluded.observed_cues_json,
            primary_inferred_affect = excluded.primary_inferred_affect,
            inferred_needs_json = excluded.inferred_needs_json,
            confidence = excluded.confidence,
            epistemic_modality = excluded.epistemic_modality,
            inferred_at = excluded.inferred_at`,
        )
        .run(
          experience.id,
          experience.targetPersonId,
          JSON.stringify(experience.observedCues || []),
          experience.primaryInferredAffect,
          JSON.stringify(experience.inferredNeeds || []),
          experience.confidence,
          experience.epistemicModality,
          experience.inferredAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save inferred experience ${experience.id}: ${err.message}`, err);
    }
  }

  public getExperienceById(id: string): InferredExperience | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM empathy_inferred_experiences WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        targetPersonId: row.target_person_id,
        observedCues: JSON.parse(row.observed_cues_json || '[]'),
        primaryInferredAffect: row.primary_inferred_affect,
        inferredNeeds: JSON.parse(row.inferred_needs_json || '[]'),
        confidence: row.confidence,
        epistemicModality: row.epistemic_modality,
        inferredAt: row.inferred_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get inferred experience ${id}: ${err.message}`, err);
    }
  }

  public listExperiences(targetPersonId?: string, limit: number = 50): InferredExperience[] {
    try {
      let query = `SELECT * FROM empathy_inferred_experiences`;
      const params: any[] = [];
      if (targetPersonId) {
        query += ` WHERE target_person_id = ?`;
        params.push(targetPersonId);
      }
      query += ` ORDER BY inferred_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        targetPersonId: r.target_person_id,
        observedCues: JSON.parse(r.observed_cues_json || '[]'),
        primaryInferredAffect: r.primary_inferred_affect,
        inferredNeeds: JSON.parse(r.inferred_needs_json || '[]'),
        confidence: r.confidence,
        epistemicModality: r.epistemic_modality,
        inferredAt: r.inferred_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list inferred experiences: ${err.message}`, err);
    }
  }

  public savePerspectiveModel(model: PerspectiveTakingModel): void {
    try {
      this.db
        .prepare(
          `INSERT INTO empathy_perspective_models (
            id, target_person_id, current_context,
            inferred_point_of_view, underlying_pressures_json,
            relationship_bond, last_revised_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            target_person_id = excluded.target_person_id,
            current_context = excluded.current_context,
            inferred_point_of_view = excluded.inferred_point_of_view,
            underlying_pressures_json = excluded.underlying_pressures_json,
            relationship_bond = excluded.relationship_bond,
            last_revised_at = excluded.last_revised_at`,
        )
        .run(
          model.id,
          model.targetPersonId,
          model.currentContext,
          model.inferredPointOfView,
          JSON.stringify(model.underlyingPressures || []),
          model.relationshipBond,
          model.lastRevisedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save perspective model ${model.id}: ${err.message}`, err);
    }
  }

  public getPerspectiveModel(targetPersonId: string): PerspectiveTakingModel | null {
    try {
      const row = this.db
        .prepare(
          `SELECT * FROM empathy_perspective_models WHERE target_person_id = ? ORDER BY last_revised_at DESC LIMIT 1`,
        )
        .get(targetPersonId) as any;
      if (!row) return null;
      return {
        id: row.id,
        targetPersonId: row.target_person_id,
        currentContext: row.current_context,
        inferredPointOfView: row.inferred_point_of_view,
        underlyingPressures: JSON.parse(row.underlying_pressures_json || '[]'),
        relationshipBond: row.relationship_bond,
        lastRevisedAt: row.last_revised_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get perspective model: ${err.message}`, err);
    }
  }

  public listPerspectiveModels(): PerspectiveTakingModel[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM empathy_perspective_models ORDER BY last_revised_at DESC`)
        .all() as any[];
      return rows.map((r) => ({
        id: r.id,
        targetPersonId: r.target_person_id,
        currentContext: r.current_context,
        inferredPointOfView: r.inferred_point_of_view,
        underlyingPressures: JSON.parse(r.underlying_pressures_json || '[]'),
        relationshipBond: r.relationship_bond,
        lastRevisedAt: r.last_revised_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list perspective models: ${err.message}`, err);
    }
  }

  public saveResponse(response: EmpatheticResponse): void {
    try {
      this.db
        .prepare(
          `INSERT INTO empathy_responses (
            id, target_person_id, experience_id, perspective_id,
            validates_emotion, agrees_with_premise, empathy_statement,
            epistemic_humility_disclaimer, supportive_action_suggestion, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            target_person_id = excluded.target_person_id,
            experience_id = excluded.experience_id,
            perspective_id = excluded.perspective_id,
            validates_emotion = excluded.validates_emotion,
            agrees_with_premise = excluded.agrees_with_premise,
            empathy_statement = excluded.empathy_statement,
            epistemic_humility_disclaimer = excluded.epistemic_humility_disclaimer,
            supportive_action_suggestion = excluded.supportive_action_suggestion,
            created_at = excluded.created_at`,
        )
        .run(
          response.id,
          response.targetPersonId,
          response.experienceId,
          response.perspectiveId,
          response.validatesEmotion ? 1 : 0,
          response.agreesWithPremise ? 1 : 0,
          response.empathyStatement,
          response.epistemicHumilityDisclaimer,
          response.supportiveActionSuggestion,
          response.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save empathetic response ${response.id}: ${err.message}`, err);
    }
  }

  public listResponses(targetPersonId?: string, limit: number = 50): EmpatheticResponse[] {
    try {
      let query = `SELECT * FROM empathy_responses`;
      const params: any[] = [];
      if (targetPersonId) {
        query += ` WHERE target_person_id = ?`;
        params.push(targetPersonId);
      }
      query += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        targetPersonId: r.target_person_id,
        experienceId: r.experience_id,
        perspectiveId: r.perspective_id,
        validatesEmotion: Boolean(r.validates_emotion),
        agreesWithPremise: Boolean(r.agrees_with_premise),
        empathyStatement: r.empathy_statement,
        epistemicHumilityDisclaimer: r.epistemic_humility_disclaimer,
        supportiveActionSuggestion: r.supportive_action_suggestion,
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list empathetic responses: ${err.message}`, err);
    }
  }

  public saveRevision(revision: PerspectiveRevisionRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO empathy_perspective_revisions (
            id, perspective_id, previous_understanding,
            new_understanding, revision_reason, revised_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            perspective_id = excluded.perspective_id,
            previous_understanding = excluded.previous_understanding,
            new_understanding = excluded.new_understanding,
            revision_reason = excluded.revision_reason,
            revised_at = excluded.revised_at`,
        )
        .run(
          revision.id,
          revision.perspectiveId,
          revision.previousUnderstanding,
          revision.newUnderstanding,
          revision.revisionReason,
          revision.revisedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save perspective revision ${revision.id}: ${err.message}`, err);
    }
  }

  public listRevisions(perspectiveId?: string, limit: number = 50): PerspectiveRevisionRecord[] {
    try {
      let query = `SELECT * FROM empathy_perspective_revisions`;
      const params: any[] = [];
      if (perspectiveId) {
        query += ` WHERE perspective_id = ?`;
        params.push(perspectiveId);
      }
      query += ` ORDER BY revised_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        perspectiveId: r.perspective_id,
        previousUnderstanding: r.previous_understanding,
        newUnderstanding: r.new_understanding,
        revisionReason: r.revision_reason,
        revisedAt: r.revised_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list perspective revisions: ${err.message}`, err);
    }
  }
}
