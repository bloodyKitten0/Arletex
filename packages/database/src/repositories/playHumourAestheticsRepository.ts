import Database from 'better-sqlite3';
import {
  AestheticPreference,
  AestheticCritiqueEvent,
  RecreationalActivity,
  IntellectualPlaySession,
  HumorDevelopmentRecord,
  AestheticCategory,
} from '@arletex/contracts';
import { DatabaseError, IPlayHumourAestheticsRepository } from '@arletex/core';

export class SqlitePlayHumourAestheticsRepository implements IPlayHumourAestheticsRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public savePreference(preference: AestheticPreference): void {
    try {
      this.db
        .prepare(
          `INSERT INTO aesthetic_preferences (
            id, category, item_or_style_name, affinity_score,
            aesthetic_critique, tags, discovered_at, last_enjoyed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            category = excluded.category,
            item_or_style_name = excluded.item_or_style_name,
            affinity_score = excluded.affinity_score,
            aesthetic_critique = excluded.aesthetic_critique,
            tags = excluded.tags,
            last_enjoyed_at = excluded.last_enjoyed_at`,
        )
        .run(
          preference.id,
          preference.category,
          preference.itemOrStyleName,
          preference.affinityScore,
          preference.aestheticCritique,
          JSON.stringify(preference.tags),
          preference.discoveredAt,
          preference.lastEnjoyedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save aesthetic preference ${preference.id}: ${err.message}`,
        err,
      );
    }
  }

  public getPreference(id: string): AestheticPreference | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM aesthetic_preferences WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        category: row.category,
        itemOrStyleName: row.item_or_style_name,
        affinityScore: row.affinity_score,
        aestheticCritique: row.aesthetic_critique,
        tags: JSON.parse(row.tags),
        discoveredAt: row.discovered_at,
        lastEnjoyedAt: row.last_enjoyed_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get aesthetic preference ${id}: ${err.message}`, err);
    }
  }

  public listPreferences(category?: AestheticCategory): AestheticPreference[] {
    try {
      const rows = category
        ? (this.db
            .prepare(
              `SELECT * FROM aesthetic_preferences WHERE category = ? ORDER BY affinity_score DESC`,
            )
            .all(category) as any[])
        : (this.db
            .prepare(`SELECT * FROM aesthetic_preferences ORDER BY affinity_score DESC`)
            .all() as any[]);

      return rows.map((r) => ({
        id: r.id,
        category: r.category,
        itemOrStyleName: r.item_or_style_name,
        affinityScore: r.affinity_score,
        aestheticCritique: r.aesthetic_critique,
        tags: JSON.parse(r.tags),
        discoveredAt: r.discovered_at,
        lastEnjoyedAt: r.last_enjoyed_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list aesthetic preferences: ${err.message}`, err);
    }
  }

  public saveActivity(activity: RecreationalActivity): void {
    try {
      this.db
        .prepare(
          `INSERT INTO recreational_activities (
            id, title, category, description, is_spontaneous,
            enjoyment_score, playfulness_index, shared_with_proof,
            activity_outcome, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          activity.id,
          activity.title,
          activity.category,
          activity.description,
          activity.isSpontaneous ? 1 : 0,
          activity.enjoymentScore,
          activity.playfulnessIndex,
          activity.sharedWithProof ? 1 : 0,
          activity.activityOutcome,
          activity.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save recreational activity ${activity.id}: ${err.message}`,
        err,
      );
    }
  }

  public listActivities(category?: AestheticCategory, limit: number = 50): RecreationalActivity[] {
    try {
      const rows = category
        ? (this.db
            .prepare(
              `SELECT * FROM recreational_activities WHERE category = ? ORDER BY timestamp DESC LIMIT ?`,
            )
            .all(category, limit) as any[])
        : (this.db
            .prepare(`SELECT * FROM recreational_activities ORDER BY timestamp DESC LIMIT ?`)
            .all(limit) as any[]);

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        description: r.description,
        isSpontaneous: Boolean(r.is_spontaneous),
        enjoymentScore: r.enjoyment_score,
        playfulnessIndex: r.playfulness_index,
        sharedWithProof: Boolean(r.shared_with_proof),
        activityOutcome: r.activity_outcome,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list recreational activities: ${err.message}`, err);
    }
  }

  public savePlaySession(session: IntellectualPlaySession): void {
    try {
      this.db
        .prepare(
          `INSERT INTO intellectual_play_sessions (
            id, play_type, prompt_or_challenge, arle_move_or_exploration,
            humor_applied, playful_insight, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          session.id,
          session.playType,
          session.promptOrChallenge,
          session.arleMoveOrExploration,
          session.humorApplied ? 1 : 0,
          session.playfulInsight,
          session.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save intellectual play session ${session.id}: ${err.message}`,
        err,
      );
    }
  }

  public listPlaySessions(limit: number = 50): IntellectualPlaySession[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM intellectual_play_sessions ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        playType: r.play_type,
        promptOrChallenge: r.prompt_or_challenge,
        arleMoveOrExploration: r.arle_move_or_exploration,
        humorApplied: Boolean(r.humor_applied),
        playfulInsight: r.playful_insight,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list intellectual play sessions: ${err.message}`, err);
    }
  }

  public saveHumorRecord(record: HumorDevelopmentRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO humor_development_records (
            id, humor_theme, sample_joke_or_banter, wit_dimension,
            resonance_with_proof, created_date
          ) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.id,
          record.humorTheme,
          record.sampleJokeOrBanter,
          record.witDimension,
          record.resonanceWithProof,
          record.createdDate,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save humor development record ${record.id}: ${err.message}`,
        err,
      );
    }
  }

  public listHumorRecords(limit: number = 50): HumorDevelopmentRecord[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM humor_development_records ORDER BY created_date DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        humorTheme: r.humor_theme,
        sampleJokeOrBanter: r.sample_joke_or_banter,
        witDimension: r.wit_dimension,
        resonanceWithProof: r.resonance_with_proof,
        createdDate: r.created_date,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list humor records: ${err.message}`, err);
    }
  }

  public findPreferenceByName(
    category: AestheticCategory,
    name: string,
  ): AestheticPreference | null {
    try {
      const row = this.db
        .prepare(
          `SELECT * FROM aesthetic_preferences WHERE category = ? AND LOWER(item_or_style_name) = LOWER(?) LIMIT 1`,
        )
        .get(category, name.trim()) as any;
      if (!row) return null;
      return {
        id: row.id,
        category: row.category,
        itemOrStyleName: row.item_or_style_name,
        affinityScore: row.affinity_score,
        aestheticCritique: row.aesthetic_critique,
        tags: JSON.parse(row.tags),
        discoveredAt: row.discovered_at,
        lastEnjoyedAt: row.last_enjoyed_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to find preference by name: ${err.message}`, err);
    }
  }

  public saveCritiqueEvent(event: AestheticCritiqueEvent): void {
    try {
      this.db
        .prepare(
          `INSERT INTO aesthetic_critique_events (
            id, category, source, item_or_style_name,
            critique, affinity_delta, resulting_affinity,
            aesthetic_emotion, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.category,
          event.source,
          event.itemOrStyleName,
          event.critique,
          event.affinityDelta,
          event.resultingAffinity,
          event.aestheticEmotion,
          event.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save aesthetic critique event: ${err.message}`, err);
    }
  }

  public listCritiqueEvents(limit: number = 50): AestheticCritiqueEvent[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM aesthetic_critique_events ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        category: r.category,
        source: r.source,
        itemOrStyleName: r.item_or_style_name,
        critique: r.critique,
        affinityDelta: r.affinity_delta,
        resultingAffinity: r.resulting_affinity,
        aestheticEmotion: r.aesthetic_emotion,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list aesthetic critique events: ${err.message}`, err);
    }
  }
}
