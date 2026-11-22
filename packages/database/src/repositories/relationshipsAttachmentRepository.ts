import Database from 'better-sqlite3';
import {
  AttachmentBond,
  SharedHistoryEvent,
  RelationalConflict,
  ApologyAndRepair,
  ConflictStatus,
  TrustEventLog,
  ObservedBehaviorVsIntent,
  RelationalExpectation,
  RelationalMemoryControl,
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

  // =========================================================================
  // Pillar 1.6: Trust lineage, behavioral intent, expectations, and memory control
  // =========================================================================

  public saveTrustEventLog(log: TrustEventLog): void {
    try {
      this.db
        .prepare(
          `INSERT INTO relationship_trust_event_logs (
            id, person_id, dimension, previous_score, updated_score,
            delta, reason, evidence_event_id, is_reversal, reversal_of_log_id, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            dimension = excluded.dimension,
            previous_score = excluded.previous_score,
            updated_score = excluded.updated_score,
            delta = excluded.delta,
            reason = excluded.reason,
            evidence_event_id = excluded.evidence_event_id,
            is_reversal = excluded.is_reversal,
            reversal_of_log_id = excluded.reversal_of_log_id,
            timestamp = excluded.timestamp`,
        )
        .run(
          log.id,
          log.personId,
          log.dimension,
          log.previousScore,
          log.updatedScore,
          log.delta,
          log.reason,
          log.evidenceEventId || null,
          log.isReversal ? 1 : 0,
          log.reversalOfLogId || null,
          log.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save trust event log ${log.id}: ${err.message}`, err);
    }
  }

  public listTrustEventLogs(personId: string, limit: number = 50): TrustEventLog[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM relationship_trust_event_logs WHERE person_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?`,
        )
        .all(personId, limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        personId: r.person_id,
        dimension: r.dimension,
        previousScore: r.previous_score,
        updatedScore: r.updated_score,
        delta: r.delta,
        reason: r.reason,
        evidenceEventId: r.evidence_event_id || undefined,
        isReversal: Boolean(r.is_reversal),
        reversalOfLogId: r.reversal_of_log_id || undefined,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list trust event logs for ${personId}: ${err.message}`, err);
    }
  }

  public getTrustEventLog(id: string): TrustEventLog | null {
    try {
      const r = this.db
        .prepare(`SELECT * FROM relationship_trust_event_logs WHERE id = ?`)
        .get(id) as any;
      if (!r) return null;
      return {
        id: r.id,
        personId: r.person_id,
        dimension: r.dimension,
        previousScore: r.previous_score,
        updatedScore: r.updated_score,
        delta: r.delta,
        reason: r.reason,
        evidenceEventId: r.evidence_event_id || undefined,
        isReversal: Boolean(r.is_reversal),
        reversalOfLogId: r.reversal_of_log_id || undefined,
        timestamp: r.timestamp,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get trust event log ${id}: ${err.message}`, err);
    }
  }

  public saveBehaviorIntentEvaluation(record: ObservedBehaviorVsIntent): void {
    try {
      this.db
        .prepare(
          `INSERT INTO relationship_behavior_intent_evaluations (
            id, person_id, observed_fact, context,
            inferred_intent_candidates, selected_interpretation,
            is_hostile_or_betrayal, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            observed_fact = excluded.observed_fact,
            context = excluded.context,
            inferred_intent_candidates = excluded.inferred_intent_candidates,
            selected_interpretation = excluded.selected_interpretation,
            is_hostile_or_betrayal = excluded.is_hostile_or_betrayal,
            timestamp = excluded.timestamp`,
        )
        .run(
          record.id,
          record.personId,
          record.observedFact,
          record.context,
          JSON.stringify(record.inferredIntentCandidates),
          record.selectedInterpretation,
          record.isHostileOrBetrayal ? 1 : 0,
          record.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save behavior intent evaluation ${record.id}: ${err.message}`, err);
    }
  }

  public listBehaviorIntentEvaluations(personId: string, limit: number = 50): ObservedBehaviorVsIntent[] {
    try {
      const rows = this.db
        .prepare(
          `SELECT * FROM relationship_behavior_intent_evaluations WHERE person_id = ? ORDER BY timestamp DESC, rowid DESC LIMIT ?`,
        )
        .all(personId, limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        personId: r.person_id,
        observedFact: r.observed_fact,
        context: r.context,
        inferredIntentCandidates: JSON.parse(r.inferred_intent_candidates),
        selectedInterpretation: r.selected_interpretation,
        isHostileOrBetrayal: Boolean(r.is_hostile_or_betrayal),
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list behavior intent evaluations for ${personId}: ${err.message}`, err);
    }
  }

  public saveExpectation(expectation: RelationalExpectation): void {
    try {
      this.db
        .prepare(
          `INSERT INTO relationship_expectations (
            id, person_id, category, description, agreed_upon, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            category = excluded.category,
            description = excluded.description,
            agreed_upon = excluded.agreed_upon,
            created_at = excluded.created_at`,
        )
        .run(
          expectation.id,
          expectation.personId,
          expectation.category,
          expectation.description,
          expectation.agreedUpon ? 1 : 0,
          expectation.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save relationship expectation ${expectation.id}: ${err.message}`, err);
    }
  }

  public listExpectations(personId: string): RelationalExpectation[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM relationship_expectations WHERE person_id = ? ORDER BY created_at ASC`)
        .all(personId) as any[];
      return rows.map((r) => ({
        id: r.id,
        personId: r.person_id,
        category: r.category,
        description: r.description,
        agreedUpon: Boolean(r.agreed_upon),
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list relationship expectations for ${personId}: ${err.message}`, err);
    }
  }

  public saveMemoryControlRecord(record: RelationalMemoryControl): void {
    try {
      this.db
        .prepare(
          `INSERT INTO relationship_memory_controls (
            id, person_id, memory_id, action, reason, correction_text, lineage_previous_id, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            action = excluded.action,
            reason = excluded.reason,
            correction_text = excluded.correction_text,
            lineage_previous_id = excluded.lineage_previous_id,
            timestamp = excluded.timestamp`,
        )
        .run(
          record.id,
          record.personId,
          record.memoryId,
          record.action,
          record.reason,
          record.correctionText || null,
          record.lineagePreviousId || null,
          record.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save relationship memory control ${record.id}: ${err.message}`, err);
    }
  }

  public listMemoryControlRecords(personId: string): RelationalMemoryControl[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM relationship_memory_controls WHERE person_id = ? ORDER BY timestamp DESC, rowid DESC`)
        .all(personId) as any[];
      return rows.map((r) => ({
        id: r.id,
        personId: r.person_id,
        memoryId: r.memory_id,
        action: r.action,
        reason: r.reason,
        correctionText: r.correction_text || undefined,
        lineagePreviousId: r.lineage_previous_id || undefined,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list relationship memory control records for ${personId}: ${err.message}`, err);
    }
  }
}
