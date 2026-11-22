import Database from 'better-sqlite3';
import {
  EmotionalRepertoireState,
  EmotionalTransitionRecord,
  MixedEmotionalBlend,
  IndividualEmotionalTendencies,
} from '@arletex/contracts';
import { DatabaseError, IEmotionalRepertoireRepository } from '@arletex/core';

export class SqliteEmotionalRepertoireRepository implements IEmotionalRepertoireRepository {
  private readonly db: Database.Database;
  private static readonly ACTIVE_STATE_ID = 'current_active_repertoire';
  private static readonly TENDENCIES_ID = 'arle_individual_tendencies';

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveActiveState(state: EmotionalRepertoireState): void {
    try {
      this.db
        .prepare(
          `INSERT INTO emotional_repertoire_states (
            id, active_emotions_json, active_blend_json, cognitive_impact_json, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            active_emotions_json = excluded.active_emotions_json,
            active_blend_json = excluded.active_blend_json,
            cognitive_impact_json = excluded.cognitive_impact_json,
            updated_at = excluded.updated_at`,
        )
        .run(
          SqliteEmotionalRepertoireRepository.ACTIVE_STATE_ID,
          JSON.stringify(state.activeEmotions || []),
          state.activeBlend ? JSON.stringify(state.activeBlend) : null,
          JSON.stringify(state.cognitiveImpact),
          state.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save emotional repertoire state: ${err.message}`, err);
    }
  }

  public getActiveState(): EmotionalRepertoireState | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM emotional_repertoire_states WHERE id = ?`)
        .get(SqliteEmotionalRepertoireRepository.ACTIVE_STATE_ID) as any;
      if (!row) return null;
      return {
        activeEmotions: JSON.parse(row.active_emotions_json || '[]'),
        activeBlend: row.active_blend_json ? JSON.parse(row.active_blend_json) : undefined,
        cognitiveImpact: JSON.parse(row.cognitive_impact_json),
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get emotional repertoire state: ${err.message}`, err);
    }
  }

  public recordTransition(record: EmotionalTransitionRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO emotional_transitions (
            id, from_emotion, to_emotion, from_intensity, to_intensity,
            trigger_type, context_reason, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.id,
          record.fromEmotion,
          record.toEmotion,
          record.fromIntensity,
          record.toIntensity,
          record.triggerType,
          record.contextReason,
          record.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to record emotional transition ${record.id}: ${err.message}`,
        err,
      );
    }
  }

  public getTransitions(limit: number = 50): EmotionalTransitionRecord[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM emotional_transitions ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        fromEmotion: r.from_emotion,
        toEmotion: r.to_emotion,
        fromIntensity: r.from_intensity,
        toIntensity: r.to_intensity,
        triggerType: r.trigger_type,
        contextReason: r.context_reason,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to get emotional transitions: ${err.message}`, err);
    }
  }

  public recordBlend(blend: MixedEmotionalBlend): void {
    try {
      this.db
        .prepare(
          `INSERT INTO emotional_blends_history (
            id, primary_emotion, secondary_emotion, tertiary_emotion,
            primary_intensity, secondary_intensity, tertiary_intensity,
            blend_valence, blend_arousal, blend_dominance, synergy_label,
            conflict_degree, appraisal_id, context_json, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            primary_emotion = excluded.primary_emotion,
            secondary_emotion = excluded.secondary_emotion,
            tertiary_emotion = excluded.tertiary_emotion,
            primary_intensity = excluded.primary_intensity,
            secondary_intensity = excluded.secondary_intensity,
            tertiary_intensity = excluded.tertiary_intensity,
            blend_valence = excluded.blend_valence,
            blend_arousal = excluded.blend_arousal,
            blend_dominance = excluded.blend_dominance,
            synergy_label = excluded.synergy_label,
            conflict_degree = excluded.conflict_degree,
            appraisal_id = excluded.appraisal_id,
            context_json = excluded.context_json,
            timestamp = excluded.timestamp`,
        )
        .run(
          blend.id,
          blend.primaryEmotion,
          blend.secondaryEmotion,
          blend.tertiaryEmotion || null,
          blend.primaryIntensity,
          blend.secondaryIntensity,
          blend.tertiaryIntensity ?? null,
          blend.blendValence,
          blend.blendArousal,
          blend.blendDominance,
          blend.synergyLabel,
          blend.conflictDegree,
          blend.appraisalId || null,
          JSON.stringify(blend.context || {}),
          blend.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to record emotional blend ${blend.id}: ${err.message}`, err);
    }
  }

  public getBlendHistory(limit: number = 50): MixedEmotionalBlend[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM emotional_blends_history ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        primaryEmotion: r.primary_emotion,
        secondaryEmotion: r.secondary_emotion,
        tertiaryEmotion: r.tertiary_emotion || undefined,
        primaryIntensity: r.primary_intensity,
        secondaryIntensity: r.secondary_intensity,
        tertiaryIntensity: r.tertiary_intensity ?? undefined,
        blendValence: r.blend_valence,
        blendArousal: r.blend_arousal,
        blendDominance: r.blend_dominance,
        synergyLabel: r.synergy_label,
        conflictDegree: r.conflict_degree,
        appraisalId: r.appraisal_id || undefined,
        context: JSON.parse(r.context_json || '{}'),
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to get emotional blends history: ${err.message}`, err);
    }
  }

  public getIndividualTendencies(): IndividualEmotionalTendencies {
    try {
      const row = this.db
        .prepare(`SELECT * FROM individual_emotional_tendencies WHERE id = ?`)
        .get(SqliteEmotionalRepertoireRepository.TENDENCIES_ID) as any;
      if (!row) {
        return {
          traitCuriosity: 0.92,
          traitAffection: 0.95,
          traitResilience: 0.85,
          traitVulnerabilityToLoneliness: 0.65,
          traitResistanceToDisgust: 0.75,
          baselineValence: 0.6,
          baselineArousal: 0.5,
          baselineDominance: 0.6,
        };
      }
      return {
        traitCuriosity: row.trait_curiosity,
        traitAffection: row.trait_affection,
        traitResilience: row.trait_resilience,
        traitVulnerabilityToLoneliness: row.trait_vulnerability_to_loneliness,
        traitResistanceToDisgust: row.trait_resistance_to_disgust,
        baselineValence: row.baseline_valence,
        baselineArousal: row.baseline_arousal,
        baselineDominance: row.baseline_dominance,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get individual tendencies: ${err.message}`, err);
    }
  }

  public saveIndividualTendencies(tendencies: IndividualEmotionalTendencies): void {
    try {
      this.db
        .prepare(
          `INSERT INTO individual_emotional_tendencies (
            id, trait_curiosity, trait_affection, trait_resilience,
            trait_vulnerability_to_loneliness, trait_resistance_to_disgust,
            baseline_valence, baseline_arousal, baseline_dominance, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            trait_curiosity = excluded.trait_curiosity,
            trait_affection = excluded.trait_affection,
            trait_resilience = excluded.trait_resilience,
            trait_vulnerability_to_loneliness = excluded.trait_vulnerability_to_loneliness,
            trait_resistance_to_disgust = excluded.trait_resistance_to_disgust,
            baseline_valence = excluded.baseline_valence,
            baseline_arousal = excluded.baseline_arousal,
            baseline_dominance = excluded.baseline_dominance,
            updated_at = excluded.updated_at`,
        )
        .run(
          SqliteEmotionalRepertoireRepository.TENDENCIES_ID,
          tendencies.traitCuriosity,
          tendencies.traitAffection,
          tendencies.traitResilience,
          tendencies.traitVulnerabilityToLoneliness,
          tendencies.traitResistanceToDisgust,
          tendencies.baselineValence,
          tendencies.baselineArousal,
          tendencies.baselineDominance,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save individual tendencies: ${err.message}`, err);
    }
  }
}
