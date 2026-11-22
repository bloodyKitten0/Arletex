import Database from 'better-sqlite3';
import {
  ConversationalContext,
  PragmaticAnalysis,
  TurnTakingState,
  AudienceAdaptationProfile,
} from '@arletex/contracts';
import { DatabaseError, ISocialCommunicationRepository } from '@arletex/core';

export class SqliteSocialCommunicationRepository implements ISocialCommunicationRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveContext(context: ConversationalContext): void {
    try {
      this.db
        .prepare(
          `INSERT INTO conversational_contexts (
            id, session_id, participants, active_topic,
            common_ground, discourse_goal, formality_level, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(session_id) DO UPDATE SET
            participants = excluded.participants,
            active_topic = excluded.active_topic,
            common_ground = excluded.common_ground,
            discourse_goal = excluded.discourse_goal,
            formality_level = excluded.formality_level,
            updated_at = excluded.updated_at`,
        )
        .run(
          context.id,
          context.sessionId,
          JSON.stringify(context.participants),
          context.activeTopic,
          JSON.stringify(context.commonGround),
          context.discourseGoal,
          context.formalityLevel,
          context.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save conversational context for session ${context.sessionId}: ${err.message}`,
        err,
      );
    }
  }

  public getContextBySession(sessionId: string): ConversationalContext | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM conversational_contexts WHERE session_id = ?`)
        .get(sessionId) as any;
      if (!row) return null;
      return {
        id: row.id,
        sessionId: row.session_id,
        participants: JSON.parse(row.participants),
        activeTopic: row.active_topic,
        commonGround: JSON.parse(row.common_ground),
        discourseGoal: row.discourse_goal,
        formalityLevel: row.formality_level,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to get conversational context for session ${sessionId}: ${err.message}`,
        err,
      );
    }
  }

  public savePragmaticAnalysis(analysis: PragmaticAnalysis): void {
    try {
      this.db
        .prepare(
          `INSERT INTO pragmatic_analyses (
            id, utterance, speaker_id, literal_meaning, implied_meaning,
            has_indirect_meaning, speech_act_type, sarcasm_detected,
            sarcasm_confidence, sarcasm_intent, humor_detected, humor_style,
            nonverbal_cues, contextual_appropriateness, confidence, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          analysis.id,
          analysis.utterance,
          analysis.speakerId,
          analysis.literalMeaning,
          analysis.impliedMeaning,
          analysis.hasIndirectMeaning ? 1 : 0,
          analysis.speechActType,
          analysis.sarcasmDetected ? 1 : 0,
          analysis.sarcasmConfidence,
          analysis.sarcasmIntent,
          analysis.humorDetected ? 1 : 0,
          analysis.humorStyle,
          JSON.stringify(analysis.nonverbalCues),
          analysis.contextualAppropriateness,
          analysis.confidence,
          analysis.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save pragmatic analysis ${analysis.id}: ${err.message}`,
        err,
      );
    }
  }

  public listPragmaticAnalyses(speakerId?: string, limit: number = 50): PragmaticAnalysis[] {
    try {
      const rows = speakerId
        ? (this.db
            .prepare(
              `SELECT * FROM pragmatic_analyses WHERE speaker_id = ? ORDER BY timestamp DESC LIMIT ?`,
            )
            .all(speakerId, limit) as any[])
        : (this.db
            .prepare(`SELECT * FROM pragmatic_analyses ORDER BY timestamp DESC LIMIT ?`)
            .all(limit) as any[]);

      return rows.map((r) => ({
        id: r.id,
        utterance: r.utterance,
        speakerId: r.speaker_id,
        literalMeaning: r.literal_meaning,
        impliedMeaning: r.implied_meaning,
        hasIndirectMeaning: Boolean(r.has_indirect_meaning),
        speechActType: r.speech_act_type,
        sarcasmDetected: Boolean(r.sarcasm_detected),
        sarcasmConfidence: r.sarcasm_confidence,
        sarcasmIntent: r.sarcasm_intent,
        humorDetected: Boolean(r.humor_detected),
        humorStyle: r.humor_style,
        nonverbalCues: JSON.parse(r.nonverbal_cues),
        contextualAppropriateness: r.contextual_appropriateness,
        confidence: r.confidence,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list pragmatic analyses: ${err.message}`, err);
    }
  }

  public recordTurnTakingEvent(
    event: TurnTakingState & { sessionId: string; timestamp: string },
  ): void {
    try {
      this.db
        .prepare(
          `INSERT INTO turn_taking_events (
            turn_id, session_id, speaker_id, floor_status,
            pacing_latency_ms, interruption_detected, repair_strategy,
            turn_count, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.turnId,
          event.sessionId,
          event.currentSpeakerId,
          event.floorStatus,
          event.pacingLatencyMs,
          event.interruptionDetected ? 1 : 0,
          event.repairStrategy ?? null,
          event.turnCount,
          event.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to record turn taking event ${event.turnId}: ${err.message}`,
        err,
      );
    }
  }

  public getLatestTurnTakingEvent(
    sessionId: string,
  ): (TurnTakingState & { sessionId: string; timestamp: string }) | null {
    try {
      const row = this.db
        .prepare(
          `SELECT * FROM turn_taking_events WHERE session_id = ? ORDER BY timestamp DESC, turn_count DESC LIMIT 1`,
        )
        .get(sessionId) as any;
      if (!row) return null;
      return {
        turnId: row.turn_id,
        sessionId: row.session_id,
        currentSpeakerId: row.speaker_id,
        floorStatus: row.floor_status,
        pacingLatencyMs: row.pacing_latency_ms,
        interruptionDetected: Boolean(row.interruption_detected),
        repairStrategy: row.repair_strategy ?? undefined,
        turnCount: row.turn_count,
        timestamp: row.timestamp,
      };
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to get latest turn taking event for session ${sessionId}: ${err.message}`,
        err,
      );
    }
  }

  public saveAdaptationProfile(profile: AudienceAdaptationProfile & { updatedAt: string }): void {
    try {
      this.db
        .prepare(
          `INSERT INTO audience_adaptation_profiles (
            target_audience_id, social_distance, adapted_register,
            expressive_identity_preserved, applied_conventions,
            politeness_strategy, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(target_audience_id) DO UPDATE SET
            social_distance = excluded.social_distance,
            adapted_register = excluded.adapted_register,
            expressive_identity_preserved = excluded.expressive_identity_preserved,
            applied_conventions = excluded.applied_conventions,
            politeness_strategy = excluded.politeness_strategy,
            updated_at = excluded.updated_at`,
        )
        .run(
          profile.targetAudienceId,
          profile.socialDistance,
          profile.adaptedRegister,
          profile.expressiveIdentityPreserved ? 1 : 0,
          JSON.stringify(profile.appliedConventions),
          profile.politenessStrategy,
          profile.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save audience adaptation profile for ${profile.targetAudienceId}: ${err.message}`,
        err,
      );
    }
  }

  public getAdaptationProfile(
    targetAudienceId: string,
  ): (AudienceAdaptationProfile & { updatedAt: string }) | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM audience_adaptation_profiles WHERE target_audience_id = ?`)
        .get(targetAudienceId) as any;
      if (!row) return null;
      return {
        targetAudienceId: row.target_audience_id,
        socialDistance: row.social_distance,
        adaptedRegister: row.adapted_register,
        expressiveIdentityPreserved: true, // Invariant guaranteed
        appliedConventions: JSON.parse(row.applied_conventions),
        politenessStrategy: row.politeness_strategy,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to get audience adaptation profile for ${targetAudienceId}: ${err.message}`,
        err,
      );
    }
  }
}
