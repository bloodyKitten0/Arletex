import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import {
  ChannelOrigin,
  ChannelPresence,
  CheckpointType,
  IdentityCheckpoint,
  IdentitySession,
  ShutdownType,
} from '@arletex/contracts';
import { DatabaseError, IContinuityRepository } from '@arletex/core';

export class ContinuityRepository implements IContinuityRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // 1. Session Continuity & Heartbeats
  // ==========================================

  public createSession(data: {
    id?: string;
    channelOrigin?: ChannelOrigin;
    activeInferenceModel?: string;
    memoryCount?: number;
    activeEmotionsCount?: number;
    downtimeFromPreviousMs?: number;
    metadata?: Record<string, unknown>;
  }): IdentitySession {
    try {
      const now = new Date().toISOString();
      const id = data.id || `session_${crypto.randomUUID()}`;
      const channelOrigin = data.channelOrigin || 'desktop';
      const activeInferenceModel = data.activeInferenceModel || 'qwen-2.5-7b';
      const memoryCount = data.memoryCount ?? 0;
      const activeEmotionsCount = data.activeEmotionsCount ?? 0;
      const downtimeFromPreviousMs = data.downtimeFromPreviousMs ?? 0;
      const metadataStr = JSON.stringify(data.metadata || {});

      const stmt = this.db.prepare(`
        INSERT INTO identity_sessions (
          id, started_at, last_heartbeat_at, ended_at, shutdown_type,
          channel_origin, active_inference_model, memory_count,
          active_emotions_count, downtime_from_previous_ms, metadata
        ) VALUES (?, ?, ?, NULL, 'active', ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        now,
        now,
        channelOrigin,
        activeInferenceModel,
        memoryCount,
        activeEmotionsCount,
        downtimeFromPreviousMs,
        metadataStr,
      );

      return {
        id,
        startedAt: now,
        lastHeartbeatAt: now,
        endedAt: null,
        shutdownType: 'active',
        channelOrigin,
        activeInferenceModel,
        memoryCount,
        activeEmotionsCount,
        downtimeFromPreviousMs,
        metadata: data.metadata || {},
      };
    } catch (err) {
      throw new DatabaseError('Failed to create identity session', err);
    }
  }

  public updateHeartbeat(sessionId: string): void {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        UPDATE identity_sessions
        SET last_heartbeat_at = ?
        WHERE id = ? AND shutdown_type = 'active'
      `);
      stmt.run(now, sessionId);
    } catch (err) {
      throw new DatabaseError(`Failed to update heartbeat for session ${sessionId}`, err);
    }
  }

  public endSession(
    sessionId: string,
    shutdownType: 'clean' | 'interrupted',
    metadata?: Record<string, unknown>,
  ): void {
    try {
      const now = new Date().toISOString();
      let sql = `
        UPDATE identity_sessions
        SET ended_at = ?, shutdown_type = ?
      `;
      const params: any[] = [now, shutdownType];

      if (metadata) {
        sql += `, metadata = ?`;
        params.push(JSON.stringify(metadata));
      }

      sql += ` WHERE id = ?`;
      params.push(sessionId);

      this.db.prepare(sql).run(...params);
    } catch (err) {
      throw new DatabaseError(`Failed to end identity session ${sessionId}`, err);
    }
  }

  public markUnexpectedShutdown(sessionId: string, endedAt?: string): void {
    try {
      const ended = endedAt || new Date().toISOString();
      this.db
        .prepare(
          `
        UPDATE identity_sessions
        SET ended_at = ?, shutdown_type = 'unexpected_crash'
        WHERE id = ?
      `,
        )
        .run(ended, sessionId);
    } catch (err) {
      throw new DatabaseError(`Failed to mark unexpected shutdown for session ${sessionId}`, err);
    }
  }

  public getActiveSession(): IdentitySession | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM identity_sessions
        WHERE shutdown_type = 'active'
        ORDER BY started_at DESC
        LIMIT 1
      `);
      const row = stmt.get() as any;
      return row ? this.mapSessionRow(row) : null;
    } catch (err) {
      throw new DatabaseError('Failed to get active identity session', err);
    }
  }

  public getLatestSession(): IdentitySession | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM identity_sessions
        ORDER BY started_at DESC
        LIMIT 1
      `);
      const row = stmt.get() as any;
      return row ? this.mapSessionRow(row) : null;
    } catch (err) {
      throw new DatabaseError('Failed to get latest identity session', err);
    }
  }

  public listSessions(limit = 20): IdentitySession[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM identity_sessions
        ORDER BY started_at DESC
        LIMIT ?
      `);
      const rows = stmt.all(limit) as any[];
      return rows.map((r) => this.mapSessionRow(r));
    } catch (err) {
      throw new DatabaseError('Failed to list identity sessions', err);
    }
  }

  // ==========================================
  // 2. Cryptographic State Checkpoints
  // ==========================================

  public createCheckpoint(data: {
    id?: string;
    sessionId: string;
    checkpointType: CheckpointType;
    stateHash: string;
    masterStateJson: string;
    memoryCount: number;
    schemaVersion?: number;
    isVerifiedValid?: boolean;
  }): IdentityCheckpoint {
    try {
      const now = new Date().toISOString();
      const id = data.id || `chk_${crypto.randomUUID()}`;
      const schemaVersion = data.schemaVersion ?? 12;
      const isVerifiedValid = data.isVerifiedValid ?? true;

      const stmt = this.db.prepare(`
        INSERT INTO identity_checkpoints (
          id, session_id, checkpoint_type, state_hash, master_state_json,
          memory_count, schema_version, is_verified_valid, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        data.sessionId,
        data.checkpointType,
        data.stateHash,
        data.masterStateJson,
        data.memoryCount,
        schemaVersion,
        isVerifiedValid ? 1 : 0,
        now,
      );

      return {
        id,
        sessionId: data.sessionId,
        checkpointType: data.checkpointType,
        stateHash: data.stateHash,
        masterStateJson: data.masterStateJson,
        memoryCount: data.memoryCount,
        schemaVersion,
        isVerifiedValid,
        createdAt: now,
      };
    } catch (err) {
      throw new DatabaseError('Failed to create identity checkpoint', err);
    }
  }

  public getLatestVerifiedCheckpoint(): IdentityCheckpoint | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM identity_checkpoints
        WHERE is_verified_valid = 1
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const row = stmt.get() as any;
      return row ? this.mapCheckpointRow(row) : null;
    } catch (err) {
      throw new DatabaseError('Failed to get latest verified checkpoint', err);
    }
  }

  public getCheckpointById(id: string): IdentityCheckpoint | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM identity_checkpoints
        WHERE id = ?
      `);
      const row = stmt.get(id) as any;
      return row ? this.mapCheckpointRow(row) : null;
    } catch (err) {
      throw new DatabaseError(`Failed to get checkpoint ${id}`, err);
    }
  }

  public listCheckpoints(limit = 20): IdentityCheckpoint[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM identity_checkpoints
        ORDER BY created_at DESC
        LIMIT ?
      `);
      const rows = stmt.all(limit) as any[];
      return rows.map((r) => this.mapCheckpointRow(r));
    } catch (err) {
      throw new DatabaseError('Failed to list identity checkpoints', err);
    }
  }

  public markCheckpointInvalid(id: string): void {
    try {
      this.db
        .prepare(
          `
        UPDATE identity_checkpoints
        SET is_verified_valid = 0
        WHERE id = ?
      `,
        )
        .run(id);
    } catch (err) {
      throw new DatabaseError(`Failed to invalidate checkpoint ${id}`, err);
    }
  }

  // ==========================================
  // 3. Cross-Channel Presence & State Versions
  // ==========================================

  public updateChannelPresence(channel: ChannelOrigin, summary = ''): void {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO channel_presences (
          channel, last_interaction_at, interaction_count, active_context_summary, updated_at
        ) VALUES (?, ?, 1, ?, ?)
        ON CONFLICT(channel) DO UPDATE SET
          last_interaction_at = excluded.last_interaction_at,
          interaction_count = channel_presences.interaction_count + 1,
          active_context_summary = CASE WHEN excluded.active_context_summary != '' THEN excluded.active_context_summary ELSE channel_presences.active_context_summary END,
          updated_at = excluded.updated_at
      `);
      stmt.run(channel, now, summary, now);
    } catch (err) {
      throw new DatabaseError(`Failed to update channel presence for ${channel}`, err);
    }
  }

  public getChannelPresences(): ChannelPresence[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM channel_presences ORDER BY updated_at DESC');
      const rows = stmt.all() as any[];
      return rows.map((r) => ({
        channel: r.channel as ChannelOrigin,
        lastInteractionAt: r.last_interaction_at,
        interactionCount: Number(r.interaction_count),
        activeContextSummary: r.active_context_summary,
        updatedAt: r.updated_at,
      }));
    } catch (err) {
      throw new DatabaseError('Failed to get channel presences', err);
    }
  }

  public getStateVersion(component: string): number {
    try {
      const stmt = this.db.prepare('SELECT version FROM system_state_versions WHERE component = ?');
      const row = stmt.get(component) as { version: number } | undefined;
      return row ? Number(row.version) : 0;
    } catch (err) {
      throw new DatabaseError(`Failed to get state version for ${component}`, err);
    }
  }

  public setStateVersion(component: string, version: number): void {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO system_state_versions (component, version, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(component) DO UPDATE SET
          version = excluded.version,
          updated_at = excluded.updated_at
      `);
      stmt.run(component, version, now);
    } catch (err) {
      throw new DatabaseError(`Failed to set state version for ${component}`, err);
    }
  }

  // ==========================================
  // Helper Mappers
  // ==========================================

  private mapSessionRow(row: any): IdentitySession {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(row.metadata || '{}');
    } catch {}

    return {
      id: row.id,
      startedAt: row.started_at,
      lastHeartbeatAt: row.last_heartbeat_at,
      endedAt: row.ended_at,
      shutdownType: row.shutdown_type as ShutdownType,
      channelOrigin: row.channel_origin as ChannelOrigin,
      activeInferenceModel: row.active_inference_model,
      memoryCount: Number(row.memory_count),
      activeEmotionsCount: Number(row.active_emotions_count),
      downtimeFromPreviousMs: Number(row.downtime_from_previous_ms),
      metadata,
    };
  }

  private mapCheckpointRow(row: any): IdentityCheckpoint {
    return {
      id: row.id,
      sessionId: row.session_id,
      checkpointType: row.checkpoint_type as CheckpointType,
      stateHash: row.state_hash,
      masterStateJson: row.master_state_json,
      memoryCount: Number(row.memory_count),
      schemaVersion: Number(row.schema_version),
      isVerifiedValid: Number(row.is_verified_valid) === 1,
      createdAt: row.created_at,
    };
  }
}
