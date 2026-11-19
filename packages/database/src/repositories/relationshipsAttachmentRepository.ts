import Database from 'better-sqlite3';
import {
  AttachmentBond,
  SharedHistoryEvent,
  RelationalConflict,
  ApologyAndRepair,
  ConflictStatus,
} from '@arletex/contracts';
import { DatabaseError, IRelationshipsAttachmentRepository } from '@arletex/core';

export class SqliteRelationshipsAttachmentRepository implements IRelationshipsAttachmentRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveBond(bond: AttachmentBond): void {
    try {
      this.db
        .prepare(
          `INSERT INTO relationship_attachment_bonds (
            person_id, stage, attachment_style, trust_cognitive,
            trust_affective, affection_depth, familiarity_score,
            reciprocity_ratio, separation_security, established_boundaries,
            last_interacted_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(person_id) DO UPDATE SET
            stage = excluded.stage,
            attachment_style = excluded.attachment_style,
            trust_cognitive = excluded.trust_cognitive,
            trust_affective = excluded.trust_affective,
            affection_depth = excluded.affection_depth,
            familiarity_score = excluded.familiarity_score,
            reciprocity_ratio = excluded.reciprocity_ratio,
            separation_security = excluded.separation_security,
            established_boundaries = excluded.established_boundaries,
            last_interacted_at = excluded.last_interacted_at,
            updated_at = excluded.updated_at`,
        )
        .run(
          bond.personId,
          bond.stage,
          bond.attachmentStyle,
          bond.trustCognitive,
          bond.trustAffective,
          bond.affectionDepth,
          bond.familiarityScore,
          bond.reciprocityRatio,
          bond.separationSecurity,
          JSON.stringify(bond.establishedBoundaries),
          bond.lastInteractedAt,
          bond.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save attachment bond for ${bond.personId}: ${err.message}`,
        err,
      );
    }
  }

  public getBond(personId: string): AttachmentBond | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM relationship_attachment_bonds WHERE person_id = ?`)
        .get(personId) as any;
      if (!row) return null;
      return {
        personId: row.person_id,
        stage: row.stage,
        attachmentStyle: row.attachment_style,
        trustCognitive: row.trust_cognitive,
        trustAffective: row.trust_affective,
        affectionDepth: row.affection_depth,
        familiarityScore: row.familiarity_score,
        reciprocityRatio: row.reciprocity_ratio,
        separationSecurity: row.separation_security,
        establishedBoundaries: JSON.parse(row.established_boundaries),
        lastInteractedAt: row.last_interacted_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to get attachment bond for ${personId}: ${err.message}`,
        err,
      );
    }
  }

  public listBonds(): AttachmentBond[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM relationship_attachment_bonds ORDER BY updated_at DESC`)
        .all() as any[];
      return rows.map((row) => ({
        personId: row.person_id,
        stage: row.stage,
        attachmentStyle: row.attachment_style,
        trustCognitive: row.trust_cognitive,
        trustAffective: row.trust_affective,
        affectionDepth: row.affection_depth,
        familiarityScore: row.familiarity_score,
        reciprocityRatio: row.reciprocity_ratio,
        separationSecurity: row.separation_security,
        establishedBoundaries: JSON.parse(row.established_boundaries),
        lastInteractedAt: row.last_interacted_at,
        updatedAt: row.updated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list attachment bonds: ${err.message}`, err);
    }
  }

  public saveSharedEvent(event: SharedHistoryEvent): void {
    try {
      this.db
        .prepare(
          `INSERT INTO shared_history_events (
            id, person_id, title, event_type, significance,
            narrative_summary, emotional_valence, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            event_type = excluded.event_type,
            significance = excluded.significance,
            narrative_summary = excluded.narrative_summary,
            emotional_valence = excluded.emotional_valence,
            timestamp = excluded.timestamp`,
        )
        .run(
          event.id,
          event.personId,
          event.title,
          event.eventType,
          event.significance,
          event.narrativeSummary,
          event.emotionalValence,
          event.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save shared history event ${event.id}: ${err.message}`,
        err,
      );
    }
  }

  public listSharedEvents(personId: string, limit: number = 50): SharedHistoryEvent[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM shared_history_events WHERE person_id = ? ORDER BY timestamp DESC LIMIT ?`,
        )
        .all(personId, limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        personId: r.person_id,
        title: r.title,
        eventType: r.event_type,
        significance: r.significance,
        narrativeSummary: r.narrative_summary,
        emotionalValence: r.emotional_valence,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to list shared history events for ${personId}: ${err.message}`,
        err,
      );
    }
  }

  public saveConflict(conflict: RelationalConflict): void {
    try {
      this.db
        .prepare(
          `INSERT INTO relational_conflicts (
            id, person_id, trigger_reason, status, severity,
            disagreement_summary, arle_perspective, inferred_partner_perspective,
            resolution_notes, reconciliation_timestamp, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            trigger_reason = excluded.trigger_reason,
            status = excluded.status,
            severity = excluded.severity,
            disagreement_summary = excluded.disagreement_summary,
            arle_perspective = excluded.arle_perspective,
            inferred_partner_perspective = excluded.inferred_partner_perspective,
            resolution_notes = excluded.resolution_notes,
            reconciliation_timestamp = excluded.reconciliation_timestamp,
            updated_at = excluded.updated_at`,
        )
        .run(
          conflict.id,
          conflict.personId,
          conflict.triggerReason,
          conflict.status,
          conflict.severity,
          conflict.disagreementSummary,
          conflict.arlePerspective,
          conflict.inferredPartnerPerspective,
          conflict.resolutionNotes ?? null,
          conflict.reconciliationTimestamp ?? null,
          conflict.createdAt,
          conflict.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save relational conflict ${conflict.id}: ${err.message}`,
        err,
      );
    }
  }

  public getConflict(id: string): RelationalConflict | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM relational_conflicts WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        personId: row.person_id,
        triggerReason: row.trigger_reason,
        status: row.status,
        severity: row.severity,
        disagreementSummary: row.disagreement_summary,
        arlePerspective: row.arle_perspective,
        inferredPartnerPerspective: row.inferred_partner_perspective,
        resolutionNotes: row.resolution_notes ?? undefined,
        reconciliationTimestamp: row.reconciliation_timestamp ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get conflict ${id}: ${err.message}`, err);
    }
  }

  public listConflicts(personId?: string, status?: ConflictStatus): RelationalConflict[] {
    try {
      let query = `SELECT * FROM relational_conflicts`;
      const params: any[] = [];
      const conditions: string[] = [];

      if (personId) {
        conditions.push(`person_id = ?`);
        params.push(personId);
      }
      if (status) {
        conditions.push(`status = ?`);
        params.push(status);
      }
      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
      }
      query += ` ORDER BY created_at DESC`;

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        personId: r.person_id,
        triggerReason: r.trigger_reason,
        status: r.status,
        severity: r.severity,
        disagreementSummary: r.disagreement_summary,
        arlePerspective: r.arle_perspective,
        inferredPartnerPerspective: r.inferred_partner_perspective,
        resolutionNotes: r.resolution_notes ?? undefined,
        reconciliationTimestamp: r.reconciliation_timestamp ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list conflicts: ${err.message}`, err);
    }
  }

  public saveApologyRepair(repair: ApologyAndRepair): void {
    try {
      this.db
        .prepare(
          `INSERT INTO apology_repairs (
            id, conflict_id, initiator, acknowledgment, validates_impact,
            remedial_commitment, is_accepted, repaired_trust_increment, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            is_accepted = excluded.is_accepted,
            repaired_trust_increment = excluded.repaired_trust_increment`,
        )
        .run(
          repair.id,
          repair.conflictId,
          repair.initiator,
          repair.acknowledgment,
          repair.validatesImpact ? 1 : 0,
          repair.remedialCommitment,
          repair.isAccepted ? 1 : 0,
          repair.repairedTrustIncrement,
          repair.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save apology repair ${repair.id}: ${err.message}`,
        err,
      );
    }
  }

  public listApologyRepairs(conflictId: string): ApologyAndRepair[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM apology_repairs WHERE conflict_id = ? ORDER BY timestamp DESC`,
        )
        .all(conflictId) as any[];
      return rows.map((r) => ({
        id: r.id,
        conflictId: r.conflict_id,
        initiator: r.initiator,
        acknowledgment: r.acknowledgment,
        validatesImpact: Boolean(r.validates_impact),
        remedialCommitment: r.remedial_commitment,
        isAccepted: Boolean(r.is_accepted),
        repairedTrustIncrement: r.repaired_trust_increment,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to list apology repairs for conflict ${conflictId}: ${err.message}`,
        err,
      );
    }
  }
}
