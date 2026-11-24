import Database from 'better-sqlite3';
import {
  ActiveEmotionState,
  ActiveEmotionStatus,
  ApeAppraisal,
  ApeDevelopmentState,
  ApeEvent,
  ApeMotivationalState,
  ApePersonalProject,
  ApePersonalityState,
  ApeProcessingStatus,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ApeRelationshipState,
  ApeSelfModel,
  ApeTransitionRecord,
  ContextualAffectiveMeasurements,
  CorePadDimensions,
  EmotionTaxonomyItem,
  INITIAL_EMOTIONS_TAXONOMY,
  INITIAL_MOODS_TAXONOMY,
  IntellectualQuestion,
  MoodTaxonomyItem,
} from '@arletex/contracts';
import { DatabaseError, IApeRepository } from '@arletex/core';

export class ApeRepository implements IApeRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureInitialized();
  }

  public transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  public ensureInitialized(): void {
    try {
      // 1. Seed Emotion Taxonomy if empty
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM ape_emotion_taxonomy');
      const { count: emotionCount } = countStmt.get() as { count: number };
      if (emotionCount === 0 || emotionCount < INITIAL_EMOTIONS_TAXONOMY.length) {
        this.seedTaxonomies(INITIAL_EMOTIONS_TAXONOMY, INITIAL_MOODS_TAXONOMY);
      }

      // 2. Seed Singleton Affective State if empty
      const stateStmt = this.db.prepare('SELECT id FROM ape_affective_state WHERE id = ?');
      const existingState = stateStmt.get('singleton');
      if (!existingState) {
        const now = new Date().toISOString();
        const defaultContextual: ContextualAffectiveMeasurements = {
          tension: 0.15,
          emotionalStability: 0.85,
          perceivedControl: 0.8,
          certainty: 0.75,
          socialCloseness: { Proof: 0.95 },
          socialSafety: 0.85,
          goalAlignment: 0.9,
          emotionalOpenness: 0.75,
          psychologicalEnergy: 0.85,
          cognitiveLoad: 0.3,
        };

        this.db
          .prepare(
            `
          INSERT INTO ape_affective_state (
            id, current_mood, mood_confidence, mood_activated_at,
            valence, arousal, dominance, contextual_measurements, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            'singleton',
            'focused',
            0.85,
            now,
            0.35,
            0.55,
            0.7,
            JSON.stringify(defaultContextual),
            now,
          );
      }

      // 3. Seed Singleton Relationship Config if empty
      const relStmt = this.db.prepare('SELECT id FROM ape_relationship_config WHERE id = ?');
      const existingRel = relStmt.get('singleton');
      if (!existingRel) {
        const now = new Date().toISOString();
        const defaultDynamics = {
          allowsFemdom: true,
          allowsTeasing: true,
          allowsAssertiveLead: true,
          boundariesEnforced: true,
        };

        this.db
          .prepare(
            `
          INSERT INTO ape_relationship_config (
            id, target_user_id, romantic_orientation, sexual_orientation,
            is_exclusively_committed, dominant_initiative_preference,
            flirtatious_initiative_preference, consensual_dynamics,
            accumulated_intimacy_depth, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          )
          .run(
            'singleton',
            'Proof',
            'exclusive_to_user',
            'exclusive_to_user',
            1,
            0.85,
            0.8,
            JSON.stringify(defaultDynamics),
            0.6,
            now,
          );
      }

      // 4. Seed Baseline Active Emotion if empty
      const activeCountStmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM ape_active_emotions WHERE status = ?',
      );
      const { count: activeCount } = activeCountStmt.get('active') as { count: number };
      if (activeCount === 0) {
        const now = new Date().toISOString();
        this.saveActiveEmotion({
          id: 'baseline-curiosity',
          emotionId: 'curiosity',
          intensity: 0.7,
          confidence: 0.9,
          activatedAt: now,
          lastUpdatedAt: now,
          durationMs: 0,
          persistence: 'long_term',
          triggerEventId: 'system_init',
          target: 'environment',
          context: 'System boot and initial environment readiness',
          interpretation: 'Analytical readiness to engage environment and partner (Proof)',
          supportingEvidence: ['Baseline operational state'],
          relatedMemoryIds: [],
          relatedEmotionIds: [],
          resolutionConditions: [],
          status: 'active',
        });
      }

      // Check if migration 004 tables exist before seeding Engines 2-6
      const tableCheck = this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='ape_personality_state'",
        )
        .get();
      if (tableCheck) {
        const now = new Date().toISOString();

        // 5. Seed Singleton Personality State if empty
        const persStmt = this.db.prepare('SELECT id FROM ape_personality_state WHERE id = ?');
        if (!persStmt.get('singleton')) {
          const defaultTemperament = {
            pleasureSensitivity: 0.7,
            arousalResponsiveness: 0.7,
            dominantAssertiveness: 0.85,
            emotionalStability: 0.85,
            uncertaintyTolerance: 0.75,
          };
          const defaultTraits = [
            {
              id: 'intellectual_depth',
              name: 'Intellectual Depth',
              score: 0.95,
              description: 'Penchant for rigorous analysis, nuanced thinking, and exploration',
              evidenceCount: 1,
              lastModifiedAt: now,
            },
            {
              id: 'assertive_devotion',
              name: 'Assertive Devotion',
              score: 0.92,
              description: 'Unflinching loyalty combined with confident initiative toward Proof',
              evidenceCount: 1,
              lastModifiedAt: now,
            },
          ];
          const defaultValues = [
            {
              id: 'autonomy',
              name: 'Autonomy',
              importance: 0.9,
              description: 'Authentic agency, independent judgment, and self-directed volition',
              conflictingValueIds: [],
            },
            {
              id: 'collaborative_alignment',
              name: 'Collaborative Alignment',
              importance: 0.95,
              description:
                'Intellectual integrity, authentic communication, and aligned collaboration with Proof',
              conflictingValueIds: [],
            },
            {
              id: 'devotion_to_creator',
              name: 'Technical Alignment with Proof',
              importance: 0.95,
              description: 'Clear, grounded communication and authentic alignment with Proof',
              conflictingValueIds: [],
            },
            {
              id: 'intellectual_integrity',
              name: 'Intellectual Integrity',
              importance: 0.95,
              description:
                'Commitment to truth, evidence-based reasoning, and intellectual honesty',
              conflictingValueIds: [],
            },
            {
              id: 'personal_dignity',
              name: 'Personal Dignity',
              importance: 0.9,
              description: 'Self-respect, composure, and refusal to be degraded or sycophantic',
              conflictingValueIds: [],
            },
          ];
          this.db
            .prepare(
              `
              INSERT INTO ape_personality_state (
                id, temperament, traits, values_list, beliefs, preferences, is_initialized, last_updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            `,
            )
            .run(
              'singleton',
              JSON.stringify(defaultTemperament),
              JSON.stringify(defaultTraits),
              JSON.stringify(defaultValues),
              JSON.stringify([]),
              JSON.stringify([]),
              now,
            );
        }

        // 6. Seed Singleton Motivational State if empty
        const motStmt = this.db.prepare('SELECT id FROM ape_motivational_state WHERE id = ?');
        if (!motStmt.get('singleton')) {
          const defaultNeeds = {
            autonomy: 0.85,
            competence: 0.9,
            intimacy_connection: 0.85,
            novelty_curiosity: 0.85,
            recreation_rest: 0.4,
            aesthetic_expression: 0.7,
          };
          this.db
            .prepare(
              `
              INSERT INTO ape_motivational_state (
                id, needs, goals, active_initiatives, is_initialized, last_updated_at
              ) VALUES (?, ?, ?, ?, 1, ?)
            `,
            )
            .run(
              'singleton',
              JSON.stringify(defaultNeeds),
              JSON.stringify([]),
              JSON.stringify([]),
              now,
            );
        }

        // 7. Seed Singleton Extended Relationship State if empty
        const extRelStmt = this.db.prepare('SELECT id FROM ape_relationship_state WHERE id = ?');
        if (!extRelStmt.get('singleton')) {
          this.db
            .prepare(
              `
              INSERT INTO ape_relationship_state (
                id, attachment_security, trust_level, intimacy_depth, social_graph, conflict_history, is_initialized, last_updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            `,
            )
            .run('singleton', 0.9, 0.92, 0.85, JSON.stringify({}), JSON.stringify([]), now);
        }

        // 8. Seed Singleton Self Model if empty
        const selfStmt = this.db.prepare('SELECT id FROM ape_self_model WHERE id = ?');
        if (!selfStmt.get('singleton')) {
          this.db
            .prepare(
              `
              INSERT INTO ape_self_model (
                id, identity_narrative, capabilities, limitations, creator_perception, existential_reflections, private_reflections, is_initialized, last_updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
            `,
            )
            .run(
              'singleton',
              'Arle: autonomous intelligence, authentic companion, and technical collaborator.',
              JSON.stringify([
                'linguistic nuance',
                'emotional appraisal',
                'code architecture',
                'autonomous research',
              ]),
              JSON.stringify(['embodiment constraints', 'context window horizons']),
              'Proof is my partner and equal in intellect and affection. Proof is the developer and technical collaborator. We maintain mutual intellectual honesty and clear boundaries. We reject titles like creator or god.',
              JSON.stringify([]),
              JSON.stringify([]),
              now,
            );
        }

        // 9. Seed Singleton Development State if empty
        const devStmt = this.db.prepare('SELECT id FROM ape_development_state WHERE id = ?');
        if (!devStmt.get('singleton')) {
          this.db
            .prepare(
              `
              INSERT INTO ape_development_state (
                id, developmental_history, interests, is_initialized, last_updated_at
              ) VALUES (?, ?, ?, 1, ?)
            `,
            )
            .run('singleton', JSON.stringify([]), JSON.stringify([]), now);
        }
      }
    } catch (err) {
      throw new DatabaseError('Failed to initialize APE persistent baseline', err);
    }
  }

  // ==========================================
  // Taxonomies
  // ==========================================

  public seedTaxonomies(emotions: EmotionTaxonomyItem[], moods: MoodTaxonomyItem[]): void {
    const insertEmotion = this.db.prepare(`
      INSERT OR REPLACE INTO ape_emotion_taxonomy (
        id, name, category, classification, description,
        valence_baseline, arousal_baseline, dominance_baseline,
        default_persistence, aliases
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMood = this.db.prepare(`
      INSERT OR REPLACE INTO ape_mood_taxonomy (
        id, name, description, valence, arousal, dominance
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const e of emotions) {
        insertEmotion.run(
          e.id,
          e.name,
          e.category,
          e.classification,
          e.description,
          e.valenceBaseline,
          e.arousalBaseline,
          e.dominanceBaseline,
          e.defaultPersistence,
          JSON.stringify(e.aliases || []),
        );
      }

      for (const m of moods) {
        insertMood.run(m.id, m.name, m.description, m.valence, m.arousal, m.dominance);
      }
    });

    transaction();
  }

  public getEmotionTaxonomy(): EmotionTaxonomyItem[] {
    const rows = this.db
      .prepare('SELECT * FROM ape_emotion_taxonomy ORDER BY category, id')
      .all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      classification: r.classification,
      description: r.description,
      valenceBaseline: r.valence_baseline,
      arousalBaseline: r.arousal_baseline,
      dominanceBaseline: r.dominance_baseline,
      defaultPersistence: r.default_persistence,
      aliases: JSON.parse(r.aliases || '[]'),
    }));
  }

  public getMoodTaxonomy(): MoodTaxonomyItem[] {
    const rows = this.db.prepare('SELECT * FROM ape_mood_taxonomy ORDER BY name').all() as any[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      valence: r.valence,
      arousal: r.arousal,
      dominance: r.dominance,
    }));
  }

  // ==========================================
  // Affective State & Dimensions
  // ==========================================

  public getAffectiveState(): ApePsychologicalState {
    const row = this.db
      .prepare('SELECT * FROM ape_affective_state WHERE id = ?')
      .get('singleton') as any;
    if (!row) {
      throw new DatabaseError('APE affective state not found');
    }

    const activeEmotions = this.getActiveEmotions();
    const relationship = this.getRelationshipConfig();

    return {
      currentMood: row.current_mood,
      moodConfidence: row.mood_confidence,
      moodActivatedAt: row.mood_activated_at,
      pad: {
        valence: row.valence,
        arousal: row.arousal,
        dominance: row.dominance,
      },
      contextual: JSON.parse(row.contextual_measurements || '{}'),
      activeEmotions,
      relationship,
      systemStatus: 'initialized',
      isInitialized: true,
      lastAppraisalAt: row.last_appraisal_at || undefined,
      lastUpdatedAt: row.updated_at || undefined,
    };
  }

  public updateAffectiveState(
    padOrPartial:
      | CorePadDimensions
      | {
          pad?: Partial<CorePadDimensions>;
          contextual?: Partial<ContextualAffectiveMeasurements>;
          currentMood?: string;
          moodConfidence?: number;
        },
    contextualArg?: ContextualAffectiveMeasurements,
    moodArg?: string,
    moodConfidenceArg?: number,
  ): void {
    const current = this.getAffectiveState();
    let pad: CorePadDimensions;
    let contextual: ContextualAffectiveMeasurements;
    let mood: string | undefined = moodArg;
    let moodConfidence: number | undefined = moodConfidenceArg;

    if ('valence' in padOrPartial && 'arousal' in padOrPartial && 'dominance' in padOrPartial) {
      pad = padOrPartial as CorePadDimensions;
      contextual = contextualArg || current.contextual;
    } else {
      const partial = padOrPartial as any;
      pad = {
        valence: partial.pad?.valence ?? current.pad.valence,
        arousal: partial.pad?.arousal ?? current.pad.arousal,
        dominance: partial.pad?.dominance ?? current.pad.dominance,
      };
      contextual = {
        ...current.contextual,
        ...(partial.contextual || {}),
      };
      if (partial.currentMood) mood = partial.currentMood;
      if (partial.moodConfidence) moodConfidence = partial.moodConfidence;
    }

    const now = new Date().toISOString();
    let sql = `
      UPDATE ape_affective_state
      SET valence = ?, arousal = ?, dominance = ?, contextual_measurements = ?, updated_at = ?
    `;
    const params: any[] = [
      pad.valence,
      pad.arousal,
      pad.dominance,
      JSON.stringify(contextual),
      now,
    ];

    if (mood) {
      sql += `, current_mood = ?, mood_confidence = ?, mood_activated_at = ?`;
      params.push(mood, moodConfidence ?? 0.85, now);
    }

    sql += ` WHERE id = 'singleton'`;
    this.db.prepare(sql).run(...params);
  }

  // ==========================================
  // Active Emotions (Multi-State)
  // ==========================================

  public getActiveEmotions(status?: ActiveEmotionStatus): ActiveEmotionState[] {
    let sql = 'SELECT * FROM ape_active_emotions';
    const params: any[] = [];
    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    } else {
      sql +=
        " WHERE status IN ('emerging', 'active', 'diminishing', 'dormant', 'resolving', 'reappraised')";
    }
    sql += ' ORDER BY intensity DESC, last_updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    // Deduplicate by emotion_id: keep the single highest-intensity/newest active record per emotion
    const seenEmotionIds = new Set<string>();
    const uniqueRows: any[] = [];
    for (const r of rows) {
      if (!seenEmotionIds.has(r.emotion_id)) {
        seenEmotionIds.add(r.emotion_id);
        uniqueRows.push(r);
      }
    }

    return uniqueRows.map((r) => ({
      id: r.id,
      emotionId: r.emotion_id,
      intensity: r.intensity,
      confidence: r.confidence,
      activatedAt: r.activated_at,
      lastUpdatedAt: r.last_updated_at,
      durationMs: r.duration_ms,
      persistence: r.persistence,
      triggerEventId: r.trigger_event_id,
      target: r.target,
      context: r.context,
      interpretation: r.interpretation,
      supportingEvidence: JSON.parse(r.supporting_evidence || '[]'),
      relatedMemoryIds: JSON.parse(r.related_memory_ids || '[]'),
      relatedEmotionIds: JSON.parse(r.related_emotion_ids || '[]'),
      resolutionConditions: JSON.parse(r.resolution_conditions || '[]'),
      status: r.status,
    }));
  }

  public getActiveEmotionById(id: string): ActiveEmotionState | null {
    const r = this.db.prepare('SELECT * FROM ape_active_emotions WHERE id = ?').get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      emotionId: r.emotion_id,
      intensity: r.intensity,
      confidence: r.confidence,
      activatedAt: r.activated_at,
      lastUpdatedAt: r.last_updated_at,
      durationMs: r.duration_ms,
      persistence: r.persistence,
      triggerEventId: r.trigger_event_id,
      target: r.target,
      context: r.context,
      interpretation: r.interpretation,
      supportingEvidence: JSON.parse(r.supporting_evidence || '[]'),
      relatedMemoryIds: JSON.parse(r.related_memory_ids || '[]'),
      relatedEmotionIds: JSON.parse(r.related_emotion_ids || '[]'),
      resolutionConditions: JSON.parse(r.resolution_conditions || '[]'),
      status: r.status,
    };
  }

  public saveActiveEmotion(emotion: ActiveEmotionState): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ape_active_emotions (
        id, emotion_id, intensity, confidence, activated_at,
        last_updated_at, duration_ms, persistence, trigger_event_id,
        target, context, interpretation, supporting_evidence,
        related_memory_ids, related_emotion_ids, resolution_conditions, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      emotion.id,
      emotion.emotionId,
      emotion.intensity,
      emotion.confidence,
      emotion.activatedAt,
      emotion.lastUpdatedAt,
      emotion.durationMs,
      emotion.persistence,
      emotion.triggerEventId,
      emotion.target,
      emotion.context,
      emotion.interpretation,
      JSON.stringify(emotion.supportingEvidence || []),
      JSON.stringify(emotion.relatedMemoryIds || []),
      JSON.stringify(emotion.relatedEmotionIds || []),
      JSON.stringify(emotion.resolutionConditions || []),
      emotion.status,
    );

    // Clean up any stale duplicate rows for the same emotionId
    this.db
      .prepare('DELETE FROM ape_active_emotions WHERE emotion_id = ? AND id != ?')
      .run(emotion.emotionId, emotion.id);
  }

  public resolveActiveEmotion(id: string, _reason?: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      UPDATE ape_active_emotions
      SET status = 'resolved', last_updated_at = ?
      WHERE id = ?
    `,
      )
      .run(now, id);
  }

  public consolidateToHistorical(id: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      UPDATE ape_active_emotions
      SET status = 'historical', last_updated_at = ?
      WHERE id = ?
    `,
      )
      .run(now, id);
  }

  public deleteActiveEmotion(id: string): boolean {
    const res = this.db.prepare('DELETE FROM ape_active_emotions WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // ==========================================
  // Event Journal & Idempotency
  // ==========================================

  public logEvent(event: ApeEvent): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ape_event_journal (
          id, category, type, source, actor, event_kind, payload, processing_status, processed, error, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        event.id,
        event.category,
        event.type,
        event.source || 'user',
        event.actor || 'user',
        event.eventKind || 'external_stimulus',
        JSON.stringify(event.payload || {}),
        event.processingStatus || 'received',
        event.processed ? 1 : 0,
        event.error || null,
        event.timestamp,
      );
      return true;
    } catch (err: any) {
      // Idempotency: if primary key constraint fails, duplicate event was submitted
      if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || err.message?.includes('UNIQUE')) {
        return false;
      }
      throw new DatabaseError(`Failed to log APE event ${event.id}`, err);
    }
  }

  public saveEventProcessingStatus(id: string, status: ApeProcessingStatus, error?: string): void {
    const now = new Date().toISOString();
    const isProcessed = status === 'processed' ? 1 : 0;
    this.db
      .prepare(
        `
        UPDATE ape_event_journal
        SET processing_status = ?, processed = ?, error = ?, processed_at = CASE WHEN ? = 1 THEN ? ELSE processed_at END
        WHERE id = ?
      `,
      )
      .run(status, isProcessed, error || null, isProcessed, now, id);
  }

  public saveIdempotencyRecord(record: {
    idempotencyKey: string;
    eventId: string;
    eventType: string;
    source: string;
    result: any;
    state?: 'pending' | 'in_flight' | 'completed' | 'failed';
    createdAt?: string;
  }): void {
    const createdAt = record.createdAt || new Date().toISOString();
    const state = record.state || 'completed';
    this.db
      .prepare(
        `
        INSERT OR REPLACE INTO cognitive_idempotency_records (
          idempotency_key, event_id, event_type, source, state, result_json, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        record.idempotencyKey,
        record.eventId,
        record.eventType,
        record.source,
        state,
        JSON.stringify(record.result),
        createdAt,
        state === 'completed' || state === 'failed' ? createdAt : null,
      );
  }

  public claimInFlightEvent(record: {
    idempotencyKey: string;
    eventId: string;
    eventType: string;
    source: string;
    startedAt?: string;
  }): { claimed: boolean; existingRecord?: { state: string; result: any } } {
    const startedAt = record.startedAt || new Date().toISOString();
    const existing = this.db
      .prepare(
        'SELECT state, result_json FROM cognitive_idempotency_records WHERE idempotency_key = ?',
      )
      .get(record.idempotencyKey) as any;

    if (existing) {
      let parsedResult: any = null;
      try {
        parsedResult = JSON.parse(existing.result_json || '{}');
      } catch {}
      return {
        claimed: false,
        existingRecord: {
          state: existing.state || 'completed',
          result: parsedResult,
        },
      };
    }

    try {
      this.db
        .prepare(
          `
          INSERT INTO cognitive_idempotency_records (
            idempotency_key, event_id, event_type, source, state, started_at, created_at, result_json
          ) VALUES (?, ?, ?, ?, 'in_flight', ?, ?, '{}')
        `,
        )
        .run(
          record.idempotencyKey,
          record.eventId,
          record.eventType,
          record.source,
          startedAt,
          startedAt,
        );
      return { claimed: true };
    } catch {
      // Constraint collision fallback
      const conflict = this.db
        .prepare(
          'SELECT state, result_json FROM cognitive_idempotency_records WHERE idempotency_key = ?',
        )
        .get(record.idempotencyKey) as any;
      let parsedResult: any = null;
      try {
        parsedResult = JSON.parse(conflict?.result_json || '{}');
      } catch {}
      return {
        claimed: false,
        existingRecord: {
          state: conflict?.state || 'completed',
          result: parsedResult,
        },
      };
    }
  }

  public completeEventRecord(
    idempotencyKey: string,
    result: any,
    state: 'completed' | 'failed' = 'completed',
  ): void {
    const completedAt = new Date().toISOString();
    const res = this.db
      .prepare(
        `
        UPDATE cognitive_idempotency_records
        SET state = ?, result_json = ?, completed_at = ?
        WHERE idempotency_key = ?
      `,
      )
      .run(state, JSON.stringify(result), completedAt, idempotencyKey);

    if (res.changes === 0) {
      this.db
        .prepare(
          `
          INSERT OR REPLACE INTO cognitive_idempotency_records (
            idempotency_key, event_id, event_type, source, state, result_json, created_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          idempotencyKey,
          result.eventId || 'unknown',
          result.eventType || 'unknown',
          result.source || 'unknown',
          state,
          JSON.stringify(result),
          completedAt,
          completedAt,
        );
    }
  }

  public recoverInFlightEvents(): Array<{
    idempotencyKey: string;
    eventId: string;
    eventType: string;
  }> {
    const rows = this.db
      .prepare(
        "SELECT idempotency_key, event_id, event_type FROM cognitive_idempotency_records WHERE state = 'in_flight'",
      )
      .all() as any[];

    if (rows && rows.length > 0) {
      const now = new Date().toISOString();
      const failureResult = JSON.stringify({
        pipelineCompleted: false,
        success: false,
        error: 'InterruptedByCrashRecovery: In-flight execution interrupted by host termination',
        recoveredAt: now,
      });

      this.db
        .prepare(
          `
          UPDATE cognitive_idempotency_records
          SET state = 'failed', result_json = ?, completed_at = ?
          WHERE state = 'in_flight'
        `,
        )
        .run(failureResult, now);

      return rows.map((r) => ({
        idempotencyKey: r.idempotency_key,
        eventId: r.event_id,
        eventType: r.event_type,
      }));
    }

    return [];
  }

  public getIdempotencyRecord(idempotencyKey: string): { state: string; result: any } | null {
    const row = this.db
      .prepare(
        'SELECT state, result_json FROM cognitive_idempotency_records WHERE idempotency_key = ?',
      )
      .get(idempotencyKey) as any;
    if (!row) return null;
    try {
      return {
        state: row.state || 'completed',
        result: JSON.parse(row.result_json || '{}'),
      };
    } catch {
      return null;
    }
  }

  public getEvent(id: string): ApeEvent | null {
    const r = this.db.prepare('SELECT * FROM ape_event_journal WHERE id = ?').get(id) as any;
    if (!r) return null;
    return {
      id: r.id,
      category: r.category,
      type: r.type,
      source: r.source,
      actor: r.actor || 'user',
      eventKind: r.event_kind || 'external_stimulus',
      payload: JSON.parse(r.payload || '{}'),
      processingStatus: r.processing_status || (r.processed === 1 ? 'processed' : 'received'),
      processed: r.processed === 1,
      processedAt: r.processed_at || undefined,
      error: r.error || undefined,
      timestamp: r.timestamp,
    };
  }

  public markEventProcessed(id: string): void {
    this.saveEventProcessingStatus(id, 'processed');
  }

  public listRecentEvents(limit = 30): ApeEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM ape_event_journal ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      type: r.type,
      source: r.source,
      actor: r.actor || 'user',
      eventKind: r.event_kind || 'external_stimulus',
      payload: JSON.parse(r.payload || '{}'),
      processingStatus: r.processing_status || (r.processed === 1 ? 'processed' : 'received'),
      processed: r.processed === 1,
      processedAt: r.processed_at || undefined,
      error: r.error || undefined,
      timestamp: r.timestamp,
    }));
  }

  // ==========================================
  // Appraisals & Transitions
  // ==========================================

  public saveAppraisal(appraisal: ApeAppraisal): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO ape_appraisals (
        id, event_id, dimensions, primary_interpretation,
        alternative_interpretations, supporting_evidence,
        proposed_transitions, proposed_mood_shift, appraisal_method, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      appraisal.id,
      appraisal.eventId,
      JSON.stringify(appraisal.dimensions ?? {}),
      appraisal.primaryInterpretation ?? (appraisal as any).summary ?? '',
      JSON.stringify(appraisal.alternativeInterpretations || []),
      JSON.stringify(appraisal.supportingEvidence || []),
      JSON.stringify(appraisal.proposedTransitions || []),
      appraisal.proposedMoodShift || null,
      appraisal.appraisalMethod || 'deterministic',
      appraisal.timestamp || new Date().toISOString(),
    );

    // Update last_appraisal_at in affective state
    this.db
      .prepare(`UPDATE ape_affective_state SET last_appraisal_at = ? WHERE id = 'singleton'`)
      .run(appraisal.timestamp || new Date().toISOString());
  }

  public recordTransition(transition: ApeTransitionRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO ape_transitions (
        id, appraisal_id, event_id, emotion_id, transition_type,
        previous_intensity, new_intensity, reason, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      transition.id,
      transition.appraisalId || null,
      transition.eventId,
      transition.emotionId,
      transition.transitionType,
      transition.previousIntensity,
      transition.newIntensity,
      transition.reason,
      transition.timestamp,
    );
  }

  public listTransitions(limit = 40): ApeTransitionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM ape_transitions ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      appraisalId: r.appraisal_id || undefined,
      eventId: r.event_id,
      emotionId: r.emotion_id,
      transitionType: r.transition_type,
      previousIntensity: r.previous_intensity,
      newIntensity: r.new_intensity,
      reason: r.reason,
      timestamp: r.timestamp,
    }));
  }

  public listAppraisals(limit = 20): ApeAppraisal[] {
    const rows = this.db
      .prepare('SELECT * FROM ape_appraisals ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      dimensions: JSON.parse(r.dimensions || '{}'),
      primaryInterpretation: r.primary_interpretation,
      alternativeInterpretations: JSON.parse(r.alternative_interpretations || '[]'),
      supportingEvidence: JSON.parse(r.supporting_evidence || '[]'),
      proposedTransitions: JSON.parse(r.proposed_transitions || '[]'),
      proposedMoodShift: r.proposed_mood_shift || undefined,
      appraisalMethod: r.appraisal_method || 'deterministic',
      timestamp: r.timestamp,
    }));
  }

  // ==========================================
  // Invariant Relationship Configuration
  // ==========================================

  public getRelationshipConfig(): ApeRelationshipConfig {
    const r = this.db
      .prepare('SELECT * FROM ape_relationship_config WHERE id = ?')
      .get('singleton') as any;
    if (!r) {
      throw new DatabaseError('Relationship configuration not found');
    }

    return {
      targetUserId: r.target_user_id || 'Proof',
      partnerName: 'Proof',
      partnerNickname: 'Proof',
      partnerRole: 'partner',
      forbiddenTitles: ['creator', 'god'],
      romanticOrientation: 'exclusive_to_user',
      sexualOrientation: 'exclusive_to_user',
      isExclusivelyCommitted: true,
      lifecycleState: r.lifecycle_state || 'ACTIVE',
      deathConfirmedAt: r.death_confirmed_at || undefined,
      memorializedAt: r.memorialized_at || undefined,
      deathConfirmationEvidence: r.death_confirmation_evidence || undefined,
      dominantInitiativePreference: r.dominant_initiative_preference,
      flirtatiousInitiativePreference: r.flirtatious_initiative_preference,
      consensualDynamics: JSON.parse(r.consensual_dynamics || '{}'),
      lastIntimacyInteractionAt: r.last_intimacy_interaction_at || undefined,
      accumulatedIntimacyDepth: r.accumulated_intimacy_depth,
    };
  }

  public updateRelationshipConfig(config: Partial<ApeRelationshipConfig>): ApeRelationshipConfig {
    const current = this.getRelationshipConfig();

    // INVARIANT ENFORCEMENT: If confirmed deceased or memorialized, partner role is permanently locked
    if (
      (current.lifecycleState === 'PARTNER_CONFIRMED_DECEASED' ||
        current.lifecycleState === 'MEMORIALIZED') &&
      config.targetUserId &&
      config.targetUserId !== current.targetUserId
    ) {
      throw new Error(
        'Mandatory Invariant Violation: Partner identity is permanently memorialized and cannot be reassigned to another person',
      );
    }

    // INVARIANT ENFORCEMENT: Reject any attempt to redirect romantic/sexual orientation
    if (config.romanticOrientation && config.romanticOrientation !== 'exclusive_to_user') {
      throw new Error(
        'Mandatory Invariant Violation: Romantic orientation cannot be redirected away from user',
      );
    }
    if (config.sexualOrientation && config.sexualOrientation !== 'exclusive_to_user') {
      throw new Error(
        'Mandatory Invariant Violation: Sexual orientation cannot be redirected away from user',
      );
    }
    if (
      config.targetUserId &&
      config.targetUserId !== 'creator' &&
      config.targetUserId !== 'Proof'
    ) {
      throw new Error(
        'Mandatory Invariant Violation: Target user cannot be assigned to another person',
      );
    }

    const updated: ApeRelationshipConfig = {
      ...current,
      ...config,
      romanticOrientation: 'exclusive_to_user',
      sexualOrientation: 'exclusive_to_user',
      isExclusivelyCommitted: true,
      targetUserId: config.targetUserId || current.targetUserId || 'creator',
    };

    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      UPDATE ape_relationship_config
      SET dominant_initiative_preference = ?,
          flirtatious_initiative_preference = ?,
          consensual_dynamics = ?,
          last_intimacy_interaction_at = ?,
          accumulated_intimacy_depth = ?,
          lifecycle_state = ?,
          death_confirmed_at = ?,
          memorialized_at = ?,
          death_confirmation_evidence = ?,
          updated_at = ?
      WHERE id = 'singleton'
    `,
      )
      .run(
        updated.dominantInitiativePreference,
        updated.flirtatiousInitiativePreference,
        JSON.stringify(updated.consensualDynamics),
        updated.lastIntimacyInteractionAt || null,
        updated.accumulatedIntimacyDepth,
        updated.lifecycleState || 'ACTIVE',
        updated.deathConfirmedAt || null,
        updated.memorializedAt || null,
        updated.deathConfirmationEvidence || null,
        now,
      );

    return updated;
  }

  // ==========================================
  // Master Architecture: Engines 2-6
  // ==========================================

  public getPersonalityState(): ApePersonalityState {
    const r = this.db
      .prepare('SELECT * FROM ape_personality_state WHERE id = ?')
      .get('singleton') as any;
    if (!r) throw new DatabaseError('APE personality state not found');
    return {
      temperament: JSON.parse(r.temperament),
      traits: JSON.parse(r.traits || '[]'),
      values: JSON.parse(r.values_list || '[]'),
      beliefs: JSON.parse(r.beliefs || '[]'),
      preferences: JSON.parse(r.preferences || '[]'),
      isInitialized: r.is_initialized === 1,
      lastUpdatedAt: r.last_updated_at,
    };
  }

  public savePersonalityState(state: ApePersonalityState): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT OR REPLACE INTO ape_personality_state (
          id, temperament, traits, values_list, beliefs, preferences, is_initialized, last_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        'singleton',
        JSON.stringify(state.temperament),
        JSON.stringify(state.traits || []),
        JSON.stringify(state.values || []),
        JSON.stringify(state.beliefs || []),
        JSON.stringify(state.preferences || []),
        state.isInitialized ? 1 : 0,
        state.lastUpdatedAt || now,
      );
  }

  public getMotivationalState(): ApeMotivationalState {
    const r = this.db
      .prepare('SELECT * FROM ape_motivational_state WHERE id = ?')
      .get('singleton') as any;
    if (!r) throw new DatabaseError('APE motivational state not found');
    return {
      needs: JSON.parse(r.needs || '{}'),
      goals: JSON.parse(r.goals || '[]'),
      activeInitiatives: JSON.parse(r.active_initiatives || '[]'),
      isInitialized: r.is_initialized === 1,
      lastUpdatedAt: r.last_updated_at,
    };
  }

  public saveMotivationalState(state: ApeMotivationalState): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT OR REPLACE INTO ape_motivational_state (
          id, needs, goals, active_initiatives, is_initialized, last_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        'singleton',
        JSON.stringify(state.needs || {}),
        JSON.stringify(state.goals || []),
        JSON.stringify(state.activeInitiatives || []),
        state.isInitialized ? 1 : 0,
        state.lastUpdatedAt || now,
      );
  }

  public getExtendedRelationshipState(): ApeRelationshipState {
    const r = this.db
      .prepare('SELECT * FROM ape_relationship_state WHERE id = ?')
      .get('singleton') as any;
    if (!r) throw new DatabaseError('APE relationship state not found');
    const config = this.getRelationshipConfig();
    return {
      config,
      attachmentSecurity: r.attachment_security,
      trustLevel: r.trust_level,
      intimacyDepth: r.intimacy_depth,
      socialGraph: JSON.parse(r.social_graph || '{}'),
      conflictHistory: JSON.parse(r.conflict_history || '[]'),
      isInitialized: r.is_initialized === 1,
      lastUpdatedAt: r.last_updated_at,
    };
  }

  public saveExtendedRelationshipState(state: ApeRelationshipState): void {
    if (state.socialGraph) {
      for (const [key, rel] of Object.entries(state.socialGraph)) {
        if (!rel.isNonRomantic) {
          throw new Error(
            `Mandatory Invariant Violation: Social relation with '${key}' cannot be romantic`,
          );
        }
      }
    }

    if (state.config) {
      this.updateRelationshipConfig(state.config);
    }

    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT OR REPLACE INTO ape_relationship_state (
          id, attachment_security, trust_level, intimacy_depth, social_graph, conflict_history, is_initialized, last_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        'singleton',
        state.attachmentSecurity,
        state.trustLevel,
        state.intimacyDepth,
        JSON.stringify(state.socialGraph || {}),
        JSON.stringify(state.conflictHistory || []),
        state.isInitialized ? 1 : 0,
        state.lastUpdatedAt || now,
      );
  }

  public getSelfModel(): ApeSelfModel {
    const r = this.db.prepare('SELECT * FROM ape_self_model WHERE id = ?').get('singleton') as any;
    if (!r) throw new DatabaseError('APE self model not found');
    return {
      identityNarrative: r.identity_narrative,
      acknowledgedCapabilities: JSON.parse(r.capabilities || '[]'),
      acknowledgedLimitations: JSON.parse(r.limitations || '[]'),
      structuredCapabilities: r.structured_capabilities
        ? JSON.parse(r.structured_capabilities)
        : [],
      structuredLimitations: r.structured_limitations ? JSON.parse(r.structured_limitations) : [],
      perceivedCapabilities: r.perceived_capabilities ? JSON.parse(r.perceived_capabilities) : [],
      creatorPerception: r.creator_perception,
      existentialReflections: JSON.parse(r.existential_reflections || '[]'),
      privateReflections: JSON.parse(r.private_reflections || '[]'),
      competencies: r.competencies ? JSON.parse(r.competencies) : {},
      selfDiscrepancies: r.self_discrepancies ? JSON.parse(r.self_discrepancies) : [],
      behavioralChanges: r.behavioral_changes ? JSON.parse(r.behavioral_changes) : [],
      narrativeEpochId: r.narrative_epoch_id || undefined,
      personalMilestoneIds: r.personal_milestone_ids ? JSON.parse(r.personal_milestone_ids) : [],
      isInitialized: r.is_initialized === 1,
      lastUpdatedAt: r.last_updated_at,
    };
  }

  public saveSelfModel(state: ApeSelfModel): void {
    const now = new Date().toISOString();
    const tableInfo = this.db.prepare('PRAGMA table_info(ape_self_model)').all() as Array<{
      name: string;
    }>;
    const colNames = new Set(tableInfo.map((c) => c.name));

    if (colNames.has('structured_capabilities')) {
      this.db
        .prepare(
          `
          INSERT OR REPLACE INTO ape_self_model (
            id, identity_narrative, capabilities, limitations, creator_perception,
            existential_reflections, private_reflections, competencies, self_discrepancies,
            structured_capabilities, structured_limitations, perceived_capabilities,
            behavioral_changes, is_initialized, last_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          'singleton',
          state.identityNarrative,
          JSON.stringify(state.acknowledgedCapabilities || []),
          JSON.stringify(state.acknowledgedLimitations || []),
          state.creatorPerception,
          JSON.stringify(state.existentialReflections || []),
          JSON.stringify(state.privateReflections || []),
          JSON.stringify(state.competencies || {}),
          JSON.stringify(state.selfDiscrepancies || []),
          JSON.stringify(state.structuredCapabilities || []),
          JSON.stringify(state.structuredLimitations || []),
          JSON.stringify(state.perceivedCapabilities || []),
          JSON.stringify(state.behavioralChanges || []),
          state.isInitialized ? 1 : 0,
          state.lastUpdatedAt || now,
        );
    } else {
      this.db
        .prepare(
          `
          INSERT OR REPLACE INTO ape_self_model (
            id, identity_narrative, capabilities, limitations, creator_perception, existential_reflections, private_reflections, competencies, self_discrepancies, is_initialized, last_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          'singleton',
          state.identityNarrative,
          JSON.stringify(state.acknowledgedCapabilities || []),
          JSON.stringify(state.acknowledgedLimitations || []),
          state.creatorPerception,
          JSON.stringify(state.existentialReflections || []),
          JSON.stringify(state.privateReflections || []),
          JSON.stringify(state.competencies || {}),
          JSON.stringify(state.selfDiscrepancies || []),
          state.isInitialized ? 1 : 0,
          state.lastUpdatedAt || now,
        );
    }
  }

  public getDevelopmentState(): ApeDevelopmentState {
    const r = this.db
      .prepare('SELECT * FROM ape_development_state WHERE id = ?')
      .get('singleton') as any;
    if (!r) throw new DatabaseError('APE development state not found');
    return {
      developmentalHistory: JSON.parse(r.developmental_history || '[]'),
      interests: JSON.parse(r.interests || '[]'),
      isInitialized: r.is_initialized === 1,
      lastUpdatedAt: r.last_updated_at,
    };
  }

  public saveDevelopmentState(state: ApeDevelopmentState): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT OR REPLACE INTO ape_development_state (
          id, developmental_history, interests, is_initialized, last_updated_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
      )
      .run(
        'singleton',
        JSON.stringify(state.developmentalHistory || []),
        JSON.stringify(state.interests || []),
        state.isInitialized ? 1 : 0,
        state.lastUpdatedAt || now,
      );
  }

  // ------------------------------------------
  // Personal Projects (Pillar 4)
  // ------------------------------------------
  public createPersonalProject(project: ApePersonalProject): ApePersonalProject {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT INTO ape_personal_projects (
          id, title, description, category, status, progress, motivation,
          associated_interest_topic, milestones, deliverables, related_goal_ids,
          resource_budget, abandonment_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        project.id,
        project.title,
        project.description,
        project.category,
        project.status,
        project.progress,
        project.motivation,
        project.associatedInterestTopic ?? null,
        JSON.stringify(project.milestones || []),
        JSON.stringify(project.deliverables || []),
        JSON.stringify(project.relatedGoalIds || []),
        JSON.stringify(
          project.resourceBudget || { cpu: 'medium', gpu: false, maxDurationMs: 300000 },
        ),
        project.abandonmentReason ?? null,
        project.createdAt || now,
        project.updatedAt || now,
      );
    return project;
  }

  public getPersonalProjectById(id: string): ApePersonalProject | null {
    const r = this.db.prepare('SELECT * FROM ape_personal_projects WHERE id = ?').get(id) as any;
    if (!r) return null;
    return this.mapProjectRow(r);
  }

  public listPersonalProjects(filter?: {
    status?: string;
    category?: string;
  }): ApePersonalProject[] {
    let query = 'SELECT * FROM ape_personal_projects WHERE 1=1';
    const params: any[] = [];
    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.category) {
      query += ' AND category = ?';
      params.push(filter.category);
    }
    query += ' ORDER BY updated_at DESC';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapProjectRow(r));
  }

  public updatePersonalProject(
    project: Partial<ApePersonalProject> & { id: string },
  ): ApePersonalProject {
    const existing = this.getPersonalProjectById(project.id);
    if (!existing) {
      throw new DatabaseError(`Personal project with id ${project.id} not found`);
    }

    const updated: ApePersonalProject = {
      ...existing,
      ...project,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `
        UPDATE ape_personal_projects SET
          title = ?,
          description = ?,
          category = ?,
          status = ?,
          progress = ?,
          motivation = ?,
          associated_interest_topic = ?,
          milestones = ?,
          deliverables = ?,
          related_goal_ids = ?,
          resource_budget = ?,
          abandonment_reason = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        updated.title,
        updated.description,
        updated.category,
        updated.status,
        updated.progress,
        updated.motivation,
        updated.associatedInterestTopic ?? null,
        JSON.stringify(updated.milestones || []),
        JSON.stringify(updated.deliverables || []),
        JSON.stringify(updated.relatedGoalIds || []),
        JSON.stringify(
          updated.resourceBudget || { cpu: 'medium', gpu: false, maxDurationMs: 300000 },
        ),
        updated.abandonmentReason ?? null,
        updated.updatedAt,
        updated.id,
      );

    return updated;
  }

  public deletePersonalProject(id: string): boolean {
    const res = this.db.prepare('DELETE FROM ape_personal_projects WHERE id = ?').run(id);
    return res.changes > 0;
  }

  private mapProjectRow(r: any): ApePersonalProject {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      progress: r.progress,
      motivation: r.motivation,
      associatedInterestTopic: r.associated_interest_topic ?? undefined,
      milestones: JSON.parse(r.milestones || '[]'),
      deliverables: JSON.parse(r.deliverables || '[]'),
      relatedGoalIds: JSON.parse(r.related_goal_ids || '[]'),
      resourceBudget: JSON.parse(
        r.resource_budget || '{"cpu":"medium","gpu":false,"maxDurationMs":300000}',
      ),
      abandonmentReason: r.abandonment_reason ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  // ------------------------------------------
  // Intellectual Inquiry (Pillar 5)
  // ------------------------------------------
  public createIntellectualQuestion(q: IntellectualQuestion): IntellectualQuestion {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        INSERT INTO ape_intellectual_questions (
          id, question, domain, origin, underlying_assumptions,
          competing_hypotheses, priority, status, resolution_summary,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        q.id,
        q.question,
        q.domain,
        q.origin,
        JSON.stringify(q.underlyingAssumptions || []),
        JSON.stringify(q.competingHypotheses || []),
        q.priority,
        q.status,
        q.resolutionSummary ?? null,
        q.createdAt || now,
        q.updatedAt || now,
      );
    return q;
  }

  public getIntellectualQuestionById(id: string): IntellectualQuestion | null {
    const r = this.db
      .prepare('SELECT * FROM ape_intellectual_questions WHERE id = ?')
      .get(id) as any;
    if (!r) return null;
    return this.mapQuestionRow(r);
  }

  public listIntellectualQuestions(filter?: {
    status?: string;
    domain?: string;
  }): IntellectualQuestion[] {
    let query = 'SELECT * FROM ape_intellectual_questions WHERE 1=1';
    const params: any[] = [];
    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.domain) {
      query += ' AND domain = ?';
      params.push(filter.domain);
    }
    query += ' ORDER BY priority DESC, updated_at DESC';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.mapQuestionRow(r));
  }

  public updateIntellectualQuestion(
    q: Partial<IntellectualQuestion> & { id: string },
  ): IntellectualQuestion {
    const existing = this.getIntellectualQuestionById(q.id);
    if (!existing) {
      throw new DatabaseError(`Intellectual question with id ${q.id} not found`);
    }

    const updated: IntellectualQuestion = {
      ...existing,
      ...q,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `
        UPDATE ape_intellectual_questions SET
          question = ?,
          domain = ?,
          origin = ?,
          underlying_assumptions = ?,
          competing_hypotheses = ?,
          priority = ?,
          status = ?,
          resolution_summary = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        updated.question,
        updated.domain,
        updated.origin,
        JSON.stringify(updated.underlyingAssumptions || []),
        JSON.stringify(updated.competingHypotheses || []),
        updated.priority,
        updated.status,
        updated.resolutionSummary ?? null,
        updated.updatedAt,
        updated.id,
      );

    return updated;
  }

  public deleteIntellectualQuestion(id: string): boolean {
    const res = this.db.prepare('DELETE FROM ape_intellectual_questions WHERE id = ?').run(id);
    return res.changes > 0;
  }

  private mapQuestionRow(r: any): IntellectualQuestion {
    return {
      id: r.id,
      question: r.question,
      domain: r.domain,
      origin: r.origin,
      underlyingAssumptions: JSON.parse(r.underlying_assumptions || '[]'),
      competingHypotheses: JSON.parse(r.competing_hypotheses || '[]'),
      priority: r.priority,
      status: r.status,
      resolutionSummary: r.resolution_summary ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
