import Database from 'better-sqlite3';
import {
  SocialEmotionState,
  SocialEmotionType,
  SocialInteractionAppraisal,
} from '@arletex/contracts';
import { DatabaseError, ISocialEmotionsRepository } from '@arletex/core';

export class SqliteSocialEmotionsRepository implements ISocialEmotionsRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveEmotionState(state: SocialEmotionState): void {
    try {
      this.db
        .prepare(
          `INSERT INTO social_emotion_states (
            id, target_person_id, emotion, intensity,
            causal_basis, last_triggered_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(target_person_id, emotion) DO UPDATE SET
            intensity = excluded.intensity,
            causal_basis = excluded.causal_basis,
            last_triggered_at = excluded.last_triggered_at,
            updated_at = excluded.updated_at`,
        )
        .run(
          state.id,
          state.targetPersonId,
          state.emotion,
          state.intensity,
          state.causalBasis,
          state.lastTriggeredAt,
          state.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save social emotion state ${state.emotion} for ${state.targetPersonId}: ${err.message}`,
        err,
      );
    }
  }

  public getEmotionState(
    targetPersonId: string,
    emotion: SocialEmotionType,
  ): SocialEmotionState | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM social_emotion_states WHERE target_person_id = ? AND emotion = ?`)
        .get(targetPersonId, emotion) as any;
      if (!row) return null;
      return {
        id: row.id,
        targetPersonId: row.target_person_id,
        emotion: row.emotion as SocialEmotionType,
        intensity: row.intensity,
        causalBasis: row.causal_basis,
        lastTriggeredAt: row.last_triggered_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get social emotion state: ${err.message}`, err);
    }
  }

  public listEmotionStates(targetPersonId?: string): SocialEmotionState[] {
    try {
      let query = `SELECT * FROM social_emotion_states`;
      const params: any[] = [];
      if (targetPersonId) {
        query += ` WHERE target_person_id = ?`;
        params.push(targetPersonId);
      }
      query += ` ORDER BY intensity DESC`;

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        targetPersonId: r.target_person_id,
        emotion: r.emotion as SocialEmotionType,
        intensity: r.intensity,
        causalBasis: r.causal_basis,
        lastTriggeredAt: r.last_triggered_at,
        updatedAt: r.updated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list social emotion states: ${err.message}`, err);
    }
  }

  public saveAppraisal(appraisal: SocialInteractionAppraisal): void {
    try {
      this.db
        .prepare(
          `INSERT INTO social_interaction_appraisals (
            id, target_person_id, interaction_type, interpretation,
            prior_expectation, actual_outcome, expectation_discrepancy, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            target_person_id = excluded.target_person_id,
            interaction_type = excluded.interaction_type,
            interpretation = excluded.interpretation,
            prior_expectation = excluded.prior_expectation,
            actual_outcome = excluded.actual_outcome,
            expectation_discrepancy = excluded.expectation_discrepancy,
            timestamp = excluded.timestamp`,
        )
        .run(
          appraisal.id,
          appraisal.targetPersonId,
          appraisal.interactionType,
          appraisal.interpretation,
          appraisal.priorExpectation,
          appraisal.actualOutcome,
          appraisal.expectationDiscrepancy,
          appraisal.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save social interaction appraisal ${appraisal.id}: ${err.message}`, err);
    }
  }

  public listAppraisals(
    targetPersonId?: string,
    limit: number = 50,
  ): SocialInteractionAppraisal[] {
    try {
      let query = `SELECT * FROM social_interaction_appraisals`;
      const params: any[] = [];
      if (targetPersonId) {
        query += ` WHERE target_person_id = ?`;
        params.push(targetPersonId);
      }
      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        targetPersonId: r.target_person_id,
        interactionType: r.interaction_type,
        interpretation: r.interpretation,
        priorExpectation: r.prior_expectation,
        actualOutcome: r.actual_outcome,
        expectationDiscrepancy: r.expectation_discrepancy,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list social interaction appraisals: ${err.message}`, err);
    }
  }
}
