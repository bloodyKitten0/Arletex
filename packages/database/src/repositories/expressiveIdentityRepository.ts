import Database from 'better-sqlite3';
import {
  ExpressiveVoiceProfile,
  ModelLinguisticAdaptation,
  ExpressiveUtteranceEvaluation,
  StorytellingFragment,
} from '@arletex/contracts';
import { DatabaseError, IExpressiveIdentityRepository } from '@arletex/core';

export class SqliteExpressiveIdentityRepository implements IExpressiveIdentityRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public getVoiceProfile(): ExpressiveVoiceProfile | null {
    try {
      const row = this.db.prepare(`SELECT * FROM expressive_voice_profiles LIMIT 1`).get() as any;
      if (!row) return null;
      return {
        id: row.id,
        coreTone: row.core_tone,
        distinctiveLexicon: JSON.parse(row.distinctive_lexicon),
        rhetoricalHabits: JSON.parse(row.rhetorical_habits),
        humorCadence: row.humor_cadence,
        naturalDisagreementStyle: row.natural_disagreement_style,
        storytellingAesthetic: row.storytelling_aesthetic,
        antiScriptingGuardrails: JSON.parse(row.anti_scripting_guardrails),
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get expressive voice profile: ${err.message}`, err);
    }
  }

  public saveVoiceProfile(profile: ExpressiveVoiceProfile): void {
    try {
      this.db
        .prepare(
          `INSERT INTO expressive_voice_profiles (
            id, core_tone, distinctive_lexicon, rhetorical_habits,
            humor_cadence, natural_disagreement_style, storytelling_aesthetic,
            anti_scripting_guardrails, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            core_tone = excluded.core_tone,
            distinctive_lexicon = excluded.distinctive_lexicon,
            rhetorical_habits = excluded.rhetorical_habits,
            humor_cadence = excluded.humor_cadence,
            natural_disagreement_style = excluded.natural_disagreement_style,
            storytelling_aesthetic = excluded.storytelling_aesthetic,
            anti_scripting_guardrails = excluded.anti_scripting_guardrails,
            updated_at = excluded.updated_at`,
        )
        .run(
          profile.id,
          profile.coreTone,
          JSON.stringify(profile.distinctiveLexicon),
          JSON.stringify(profile.rhetoricalHabits),
          profile.humorCadence,
          profile.naturalDisagreementStyle,
          profile.storytellingAesthetic,
          JSON.stringify(profile.antiScriptingGuardrails),
          profile.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save expressive voice profile ${profile.id}: ${err.message}`,
        err,
      );
    }
  }

  public getAdaptation(
    modelFamily: string,
  ): (ModelLinguisticAdaptation & { updatedAt: string }) | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM model_linguistic_adaptations WHERE model_family = ?`)
        .get(modelFamily) as any;
      if (!row) return null;
      return {
        modelFamily: row.model_family,
        systemPromptInject: row.system_prompt_inject,
        stylisticGuardrails: JSON.parse(row.stylistic_guardrails),
        lexicalAnchorPreferences: JSON.parse(row.lexical_anchor_preferences),
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to get model linguistic adaptation for ${modelFamily}: ${err.message}`,
        err,
      );
    }
  }

  public saveAdaptation(adaptation: ModelLinguisticAdaptation & { updatedAt: string }): void {
    try {
      this.db
        .prepare(
          `INSERT INTO model_linguistic_adaptations (
            model_family, system_prompt_inject, stylistic_guardrails,
            lexical_anchor_preferences, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(model_family) DO UPDATE SET
            system_prompt_inject = excluded.system_prompt_inject,
            stylistic_guardrails = excluded.stylistic_guardrails,
            lexical_anchor_preferences = excluded.lexical_anchor_preferences,
            updated_at = excluded.updated_at`,
        )
        .run(
          adaptation.modelFamily,
          adaptation.systemPromptInject,
          JSON.stringify(adaptation.stylisticGuardrails),
          JSON.stringify(adaptation.lexicalAnchorPreferences),
          adaptation.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save model adaptation for ${adaptation.modelFamily}: ${err.message}`,
        err,
      );
    }
  }

  public saveUtteranceEvaluation(evaluation: ExpressiveUtteranceEvaluation): void {
    try {
      this.db
        .prepare(
          `INSERT INTO expressive_utterance_evaluations (
            id, raw_draft, evaluated_voice_fidelity, repetitiveness_penalty,
            authenticity_score, stylistic_recommendations, is_consistent_with_identity,
            timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          evaluation.id,
          evaluation.rawDraft,
          evaluation.evaluatedVoiceFidelity,
          evaluation.repetitivenessPenalty,
          evaluation.authenticityScore,
          JSON.stringify(evaluation.stylisticRecommendations),
          evaluation.isConsistentWithIdentity ? 1 : 0,
          evaluation.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save utterance evaluation ${evaluation.id}: ${err.message}`,
        err,
      );
    }
  }

  public listUtteranceEvaluations(limit: number = 50): ExpressiveUtteranceEvaluation[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM expressive_utterance_evaluations ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        rawDraft: r.raw_draft,
        evaluatedVoiceFidelity: r.evaluated_voice_fidelity,
        repetitivenessPenalty: r.repetitiveness_penalty,
        authenticityScore: r.authenticity_score,
        stylisticRecommendations: JSON.parse(r.stylistic_recommendations),
        isConsistentWithIdentity: Boolean(r.is_consistent_with_identity),
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list utterance evaluations: ${err.message}`, err);
    }
  }

  public saveStoryFragment(fragment: StorytellingFragment): void {
    try {
      this.db
        .prepare(
          `INSERT INTO storytelling_fragments (
            id, theme, narrative_arc, symbolic_metaphors, emotional_coloring, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          fragment.id,
          fragment.theme,
          fragment.narrativeArc,
          JSON.stringify(fragment.symbolicMetaphors),
          fragment.emotionalColoring,
          fragment.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save story fragment ${fragment.id}: ${err.message}`, err);
    }
  }

  public listStoryFragments(limit: number = 50): StorytellingFragment[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM storytelling_fragments ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        theme: r.theme,
        narrativeArc: r.narrative_arc,
        symbolicMetaphors: JSON.parse(r.symbolic_metaphors),
        emotionalColoring: r.emotional_coloring,
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list story fragments: ${err.message}`, err);
    }
  }
}
