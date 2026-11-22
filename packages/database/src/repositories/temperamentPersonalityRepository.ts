import Database from 'better-sqlite3';
import {
  PersonalityEvolutionRecord,
  SituationalPersonalityExpression,
  TemperamentProfile,
} from '@arletex/contracts';
import { DatabaseError, ITemperamentPersonalityRepository } from '@arletex/core';

export class SqliteTemperamentPersonalityRepository implements ITemperamentPersonalityRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveProfile(profile: TemperamentProfile): void {
    try {
      this.db
        .prepare(
          `INSERT INTO temperament_profiles (
            id, core_traits_json, emotional_tendencies_json,
            communication_preferences_json, social_tendencies_json,
            last_calibrated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            core_traits_json = excluded.core_traits_json,
            emotional_tendencies_json = excluded.emotional_tendencies_json,
            communication_preferences_json = excluded.communication_preferences_json,
            social_tendencies_json = excluded.social_tendencies_json,
            last_calibrated_at = excluded.last_calibrated_at`,
        )
        .run(
          profile.id,
          JSON.stringify(profile.coreTraits),
          JSON.stringify(profile.emotionalTendencies),
          JSON.stringify(profile.communicationPreferences),
          JSON.stringify(profile.socialTendencies),
          profile.lastCalibratedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save temperament profile ${profile.id}: ${err.message}`,
        err,
      );
    }
  }

  public getProfile(id: string = 'profile_arle_core'): TemperamentProfile | null {
    try {
      const row = this.db.prepare(`SELECT * FROM temperament_profiles WHERE id = ?`).get(id) as any;
      if (!row) {
        // Fallback to latest
        const fallback = this.db
          .prepare(`SELECT * FROM temperament_profiles ORDER BY last_calibrated_at DESC LIMIT 1`)
          .get() as any;
        if (!fallback) return null;
        return {
          id: fallback.id,
          coreTraits: JSON.parse(fallback.core_traits_json),
          emotionalTendencies: JSON.parse(fallback.emotional_tendencies_json),
          communicationPreferences: JSON.parse(fallback.communication_preferences_json),
          socialTendencies: JSON.parse(fallback.social_tendencies_json),
          lastCalibratedAt: fallback.last_calibrated_at,
        };
      }
      return {
        id: row.id,
        coreTraits: JSON.parse(row.core_traits_json),
        emotionalTendencies: JSON.parse(row.emotional_tendencies_json),
        communicationPreferences: JSON.parse(row.communication_preferences_json),
        socialTendencies: JSON.parse(row.social_tendencies_json),
        lastCalibratedAt: row.last_calibrated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get temperament profile: ${err.message}`, err);
    }
  }

  public saveSituationalExpression(expression: SituationalPersonalityExpression): void {
    try {
      this.db
        .prepare(
          `INSERT INTO situational_personality_expressions (
            id, situation_type, context_description,
            expressed_traits_json, baseline_traits_json,
            trait_deltas_json, behavioural_consistency_score,
            expressed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            situation_type = excluded.situation_type,
            context_description = excluded.context_description,
            expressed_traits_json = excluded.expressed_traits_json,
            baseline_traits_json = excluded.baseline_traits_json,
            trait_deltas_json = excluded.trait_deltas_json,
            behavioural_consistency_score = excluded.behavioural_consistency_score,
            expressed_at = excluded.expressed_at`,
        )
        .run(
          expression.id,
          expression.situationType,
          expression.contextDescription,
          JSON.stringify(expression.expressedTraits),
          JSON.stringify(expression.baselineTraits),
          JSON.stringify(expression.traitDeltas),
          expression.behaviouralConsistencyScore,
          expression.expressedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save situational expression ${expression.id}: ${err.message}`,
        err,
      );
    }
  }

  public listSituationalExpressions(
    situationType?: string,
    limit: number = 50,
  ): SituationalPersonalityExpression[] {
    try {
      let query = `SELECT * FROM situational_personality_expressions`;
      const params: any[] = [];
      if (situationType) {
        query += ` WHERE situation_type = ?`;
        params.push(situationType);
      }
      query += ` ORDER BY expressed_at DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        situationType: r.situation_type,
        contextDescription: r.context_description,
        expressedTraits: JSON.parse(r.expressed_traits_json),
        baselineTraits: JSON.parse(r.baseline_traits_json),
        traitDeltas: JSON.parse(r.trait_deltas_json),
        behaviouralConsistencyScore: r.behavioural_consistency_score,
        expressedAt: r.expressed_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list situational expressions: ${err.message}`, err);
    }
  }

  public saveEvolutionRecord(record: PersonalityEvolutionRecord): void {
    try {
      const payload = {
        reason: record.driftReason,
        evidence: record.evidence || [],
        version: record.version || 1,
        confidence: record.confidence ?? 0.9,
        catalystEventId: record.catalystEventId,
      };
      this.db
        .prepare(
          `INSERT INTO personality_evolution_records (
            id, trait_key, previous_score, updated_score,
            drift_delta, drift_reason, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          record.id,
          record.traitKey,
          record.previousScore,
          record.updatedScore,
          record.driftDelta,
          JSON.stringify(payload),
          record.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save personality evolution record ${record.id}: ${err.message}`,
        err,
      );
    }
  }

  public listEvolutionRecords(traitKey?: string, limit: number = 50): PersonalityEvolutionRecord[] {
    try {
      let query = `SELECT * FROM personality_evolution_records`;
      const params: any[] = [];
      if (traitKey) {
        query += ` WHERE trait_key = ?`;
        params.push(traitKey);
      }
      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => {
        let reason = r.drift_reason;
        let evidence: string[] = [];
        let confidence = 0.9;
        let version = 1;
        let catalystEventId: string | undefined = undefined;

        if (
          typeof r.drift_reason === 'string' &&
          r.drift_reason.startsWith('{') &&
          r.drift_reason.endsWith('}')
        ) {
          try {
            const parsed = JSON.parse(r.drift_reason);
            reason = parsed.reason ?? r.drift_reason;
            evidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];
            confidence = parsed.confidence ?? 0.9;
            version = parsed.version ?? 1;
            catalystEventId = parsed.catalystEventId;
          } catch {
            // Keep fallback defaults
          }
        }

        return {
          id: r.id,
          traitKey: r.trait_key,
          previousScore: r.previous_score,
          updatedScore: r.updated_score,
          driftDelta: r.drift_delta,
          driftReason: reason,
          evidence,
          confidence,
          version,
          catalystEventId,
          timestamp: r.timestamp,
        };
      });
    } catch (err: any) {
      throw new DatabaseError(`Failed to list evolution records: ${err.message}`, err);
    }
  }
}
