import Database from 'better-sqlite3';
import { ExperientialStateInstance, ExperientialStateLifecycle } from '@arletex/contracts';
import { IExperientialStateRepository } from '@arletex/core';

export class SqliteExperientialStateRepository implements IExperientialStateRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveEpisode(episode: ExperientialStateInstance): void {
    const stmt = this.db.prepare(`
      INSERT INTO experiential_state_episodes (
        instance_id, state_id, name, kind, category, intensity, confidence,
        valence, arousal, onset_at, last_updated_at, source_event_ids,
        supporting_evidence, counter_evidence, associated_memory_ids,
        related_state_ids, appraisal_ids, unresolved_tensions, regulation_json,
        lifecycle, effects_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(instance_id) DO UPDATE SET
        intensity = excluded.intensity,
        confidence = excluded.confidence,
        valence = excluded.valence,
        arousal = excluded.arousal,
        last_updated_at = excluded.last_updated_at,
        supporting_evidence = excluded.supporting_evidence,
        counter_evidence = excluded.counter_evidence,
        associated_memory_ids = excluded.associated_memory_ids,
        related_state_ids = excluded.related_state_ids,
        unresolved_tensions = excluded.unresolved_tensions,
        regulation_json = excluded.regulation_json,
        lifecycle = excluded.lifecycle,
        effects_json = excluded.effects_json
    `);

    stmt.run(
      episode.instanceId,
      episode.id,
      episode.name,
      episode.kind,
      episode.category,
      episode.intensity,
      episode.confidence,
      episode.valence,
      episode.arousal,
      episode.onsetAt,
      episode.lastUpdatedAt,
      JSON.stringify(episode.sourceEventIds || []),
      JSON.stringify(episode.supportingEvidence || []),
      JSON.stringify(episode.counterEvidence || []),
      JSON.stringify(episode.associatedMemoryIds || []),
      JSON.stringify(episode.relatedStateIds || []),
      JSON.stringify(episode.appraisalIds || []),
      JSON.stringify(episode.unresolvedTensions || []),
      episode.regulation ? JSON.stringify(episode.regulation) : null,
      episode.lifecycle,
      JSON.stringify(episode.effects || []),
    );
  }

  public getEpisode(instanceId: string): ExperientialStateInstance | null {
    const row = this.db
      .prepare('SELECT * FROM experiential_state_episodes WHERE instance_id = ?')
      .get(instanceId) as any;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listActiveEpisodes(): ExperientialStateInstance[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM experiential_state_episodes WHERE lifecycle IN ('active', 'candidate', 'fading') ORDER BY intensity DESC",
      )
      .all() as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public listEpisodesByStateId(stateId: string): ExperientialStateInstance[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM experiential_state_episodes WHERE state_id = ? ORDER BY onset_at DESC',
      )
      .all(stateId) as any[];
    return rows.map((r) => this.mapRow(r));
  }

  public recordTransition(
    instanceId: string,
    stateId: string,
    fromLifecycle: ExperientialStateLifecycle,
    toLifecycle: ExperientialStateLifecycle,
    reason: string,
  ): void {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO experiential_state_transitions (
          id, instance_id, state_id, from_lifecycle, to_lifecycle, reason, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, instanceId, stateId, fromLifecycle, toLifecycle, reason, timestamp);
  }

  public listRecentTransitions(limit = 20): Array<{
    id: string;
    instanceId: string;
    stateId: string;
    fromLifecycle: ExperientialStateLifecycle;
    toLifecycle: ExperientialStateLifecycle;
    reason: string;
    timestamp: string;
  }> {
    const rows = this.db
      .prepare('SELECT * FROM experiential_state_transitions ORDER BY timestamp DESC LIMIT ?')
      .all(limit) as any[];
    return rows.map((r) => ({
      id: r.id,
      instanceId: r.instance_id,
      stateId: r.state_id,
      fromLifecycle: r.from_lifecycle as ExperientialStateLifecycle,
      toLifecycle: r.to_lifecycle as ExperientialStateLifecycle,
      reason: r.reason,
      timestamp: r.timestamp,
    }));
  }

  public pruneStaleManualEpisodes(): number {
    const res = this.db
      .prepare("DELETE FROM experiential_state_episodes WHERE supporting_evidence LIKE '%Manual activation%'")
      .run();
    return res.changes;
  }

  private mapRow(row: any): ExperientialStateInstance {
    return {
      instanceId: row.instance_id,
      id: row.state_id,
      name: row.name,
      kind: row.kind,
      category: row.category,
      intensity: row.intensity,
      confidence: row.confidence,
      valence: row.valence,
      arousal: row.arousal,
      onsetAt: row.onset_at,
      lastUpdatedAt: row.last_updated_at,
      sourceEventIds: JSON.parse(row.source_event_ids || '[]'),
      supportingEvidence: JSON.parse(row.supporting_evidence || '[]'),
      counterEvidence: JSON.parse(row.counter_evidence || '[]'),
      associatedMemoryIds: JSON.parse(row.associated_memory_ids || '[]'),
      relatedStateIds: JSON.parse(row.related_state_ids || '[]'),
      appraisalIds: JSON.parse(row.appraisal_ids || '[]'),
      unresolvedTensions: JSON.parse(row.unresolved_tensions || '[]'),
      regulation: row.regulation_json ? JSON.parse(row.regulation_json) : undefined,
      lifecycle: row.lifecycle,
      effects: JSON.parse(row.effects_json || '[]'),
    };
  }
}

export { SqliteExperientialStateRepository as ExperientialStateRepository };
