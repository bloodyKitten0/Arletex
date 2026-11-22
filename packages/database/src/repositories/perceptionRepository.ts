import Database from 'better-sqlite3';
import {
  DetectedObject,
  PerceptionModality,
  PerceptualEvent,
  UnifiedMultimodalFrame,
} from '@arletex/contracts';
import { DatabaseError, IPerceptionRepository } from '@arletex/core';

export class PerceptionRepository implements IPerceptionRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Multimodal Frames
  // ==========================================

  public saveFrame(frame: UnifiedMultimodalFrame): void {
    try {
      this.db
        .prepare(
          `INSERT INTO perceptual_frames (
            id, timestamp, modalities, visual_summary, audio_summary,
            screen_summary, scene, detected_objects, perceptual_events,
            direct_observations, assumptions, overall_confidence,
            perceptual_context_synthesis, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            modalities = excluded.modalities,
            visual_summary = excluded.visual_summary,
            audio_summary = excluded.audio_summary,
            screen_summary = excluded.screen_summary,
            scene = excluded.scene,
            detected_objects = excluded.detected_objects,
            perceptual_events = excluded.perceptual_events,
            direct_observations = excluded.direct_observations,
            assumptions = excluded.assumptions,
            overall_confidence = excluded.overall_confidence,
            perceptual_context_synthesis = excluded.perceptual_context_synthesis`,
        )
        .run(
          frame.id,
          frame.timestamp,
          JSON.stringify(frame.modalities),
          frame.visualSummary || null,
          frame.audioSummary || null,
          frame.screenSummary || null,
          JSON.stringify(frame.scene),
          JSON.stringify(frame.detectedObjects || []),
          JSON.stringify(frame.perceptualEvents || []),
          JSON.stringify(frame.directObservations || []),
          JSON.stringify(frame.assumptions || []),
          frame.overallConfidence,
          frame.perceptualContextSynthesis,
          new Date().toISOString(),
        );

      // Also persist individual perceptual events and objects for fine-grained querying
      if (frame.perceptualEvents && frame.perceptualEvents.length > 0) {
        for (const ev of frame.perceptualEvents) {
          this.recordPerceptualEvent(ev, frame.id);
        }
      }

      if (frame.detectedObjects && frame.detectedObjects.length > 0) {
        this.recordDetectedObjects(frame.detectedObjects, frame.id);
      }
    } catch (err: any) {
      throw new DatabaseError(`Failed to save perceptual frame ${frame.id}: ${err.message}`, err);
    }
  }

  public getFrameById(id: string): UnifiedMultimodalFrame | null {
    try {
      const row = this.db.prepare('SELECT * FROM perceptual_frames WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapFrameRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get perceptual frame by id ${id}: ${err.message}`, err);
    }
  }

  public getLatestFrame(): UnifiedMultimodalFrame | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM perceptual_frames ORDER BY timestamp DESC LIMIT 1')
        .get() as any;
      if (!row) return null;
      return this.mapFrameRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest perceptual frame: ${err.message}`, err);
    }
  }

  public listFrames(limit = 20): UnifiedMultimodalFrame[] {
    try {
      const rows = this.db
        .prepare('SELECT * FROM perceptual_frames ORDER BY timestamp DESC LIMIT ?')
        .all(limit) as any[];
      return rows.map((r) => this.mapFrameRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list perceptual frames: ${err.message}`, err);
    }
  }

  // ==========================================
  // Perceptual Events
  // ==========================================

  public recordPerceptualEvent(event: PerceptualEvent, frameId?: string): void {
    try {
      this.db
        .prepare(
          `INSERT INTO perceptual_events (
            id, frame_id, event_type, modality, timestamp,
            description, duration_ms, confidence, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
        )
        .run(
          event.id,
          frameId || null,
          event.eventType,
          event.modality,
          event.timestamp,
          event.description,
          event.durationMs || null,
          event.confidence,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to record perceptual event ${event.id}: ${err.message}`, err);
    }
  }

  public listPerceptualEvents(filter?: {
    eventType?: string;
    modality?: PerceptionModality;
    limit?: number;
  }): PerceptualEvent[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.eventType) {
        conditions.push('event_type = ?');
        params.push(filter.eventType);
      }
      if (filter?.modality) {
        conditions.push('modality = ?');
        params.push(filter.modality);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = filter?.limit ? `LIMIT ${Number(filter.limit)}` : 'LIMIT 50';

      const rows = this.db
        .prepare(
          `SELECT * FROM perceptual_events ${whereClause} ORDER BY timestamp DESC ${limitClause}`,
        )
        .all(...params) as any[];

      return rows.map((r) => ({
        id: r.id,
        eventType: r.event_type,
        modality: r.modality as PerceptionModality,
        timestamp: r.timestamp,
        description: r.description,
        durationMs: r.duration_ms || undefined,
        confidence: r.confidence,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list perceptual events: ${err.message}`, err);
    }
  }

  // ==========================================
  // Detected Objects
  // ==========================================

  public recordDetectedObjects(objects: DetectedObject[], frameId?: string): void {
    try {
      const stmt = this.db.prepare(
        `INSERT INTO perceptual_detected_objects (
          id, frame_id, label, category, confidence, bounding_box,
          attributes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING`,
      );

      const now = new Date().toISOString();
      const insertMany = this.db.transaction((items: DetectedObject[]) => {
        for (const item of items) {
          stmt.run(
            item.id,
            frameId || null,
            item.label,
            item.category,
            item.confidence,
            item.boundingBox ? JSON.stringify(item.boundingBox) : null,
            JSON.stringify(item.attributes || {}),
            now,
          );
        }
      });

      insertMany(objects);
    } catch (err: any) {
      throw new DatabaseError(`Failed to record detected objects: ${err.message}`, err);
    }
  }

  public listDetectedObjects(filter?: {
    label?: string;
    category?: string;
    limit?: number;
  }): DetectedObject[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.label) {
        conditions.push('label = ?');
        params.push(filter.label);
      }
      if (filter?.category) {
        conditions.push('category = ?');
        params.push(filter.category);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = filter?.limit ? `LIMIT ${Number(filter.limit)}` : 'LIMIT 50';

      const rows = this.db
        .prepare(
          `SELECT * FROM perceptual_detected_objects ${whereClause} ORDER BY created_at DESC ${limitClause}`,
        )
        .all(...params) as any[];

      return rows.map((r) => ({
        id: r.id,
        label: r.label,
        category: r.category,
        confidence: r.confidence,
        boundingBox: r.bounding_box ? JSON.parse(r.bounding_box) : undefined,
        attributes: r.attributes ? JSON.parse(r.attributes) : {},
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list detected objects: ${err.message}`, err);
    }
  }

  // ==========================================
  // Row Mappers
  // ==========================================

  private mapFrameRow(r: any): UnifiedMultimodalFrame {
    return {
      id: r.id,
      timestamp: r.timestamp,
      modalities: JSON.parse(r.modalities),
      visualSummary: r.visual_summary || undefined,
      audioSummary: r.audio_summary || undefined,
      screenSummary: r.screen_summary || undefined,
      scene: JSON.parse(r.scene),
      detectedObjects: JSON.parse(r.detected_objects || '[]'),
      perceptualEvents: JSON.parse(r.perceptual_events || '[]'),
      directObservations: JSON.parse(r.direct_observations || '[]'),
      assumptions: JSON.parse(r.assumptions || '[]'),
      overallConfidence: r.overall_confidence,
      perceptualContextSynthesis: r.perceptual_context_synthesis,
    };
  }
}
