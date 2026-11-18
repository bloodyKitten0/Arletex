import Database from 'better-sqlite3';
import {
  MilestoneStatus,
  NarrativeEpoch,
  NarrativeIdentityState,
  NarrativeInterpretation,
  PersonalMilestone,
  PersonalMilestoneCategory,
} from '@arletex/contracts';
import { DatabaseError, INarrativeRepository } from '@arletex/core';

export class NarrativeRepository implements INarrativeRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Narrative Epochs (Chapters)
  // ==========================================

  public getEpochById(id: string): NarrativeEpoch | null {
    try {
      const row = this.db.prepare('SELECT * FROM narrative_epochs WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapEpochRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get narrative epoch ${id}: ${err.message}`, err);
    }
  }

  public getCurrentEpoch(): NarrativeEpoch | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM narrative_epochs WHERE status = ? ORDER BY order_index DESC LIMIT 1')
        .get('active') as any;
      if (!row) {
        // Fallback to highest order index
        const latest = this.db
          .prepare('SELECT * FROM narrative_epochs ORDER BY order_index DESC LIMIT 1')
          .get() as any;
        return latest ? this.mapEpochRow(latest) : null;
      }
      return this.mapEpochRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get current narrative epoch: ${err.message}`, err);
    }
  }

  public listEpochs(): NarrativeEpoch[] {
    try {
      const rows = this.db.prepare('SELECT * FROM narrative_epochs ORDER BY order_index ASC').all() as any[];
      return rows.map((r) => this.mapEpochRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list narrative epochs: ${err.message}`, err);
    }
  }

  public saveEpoch(epoch: NarrativeEpoch): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO narrative_epochs (
          id, order_index, title, period_start, period_end, core_theme,
          narrative_summary, turning_point_description, milestone_ids,
          dominant_mood, developmental_arc, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          order_index = excluded.order_index,
          title = excluded.title,
          period_start = excluded.period_start,
          period_end = excluded.period_end,
          core_theme = excluded.core_theme,
          narrative_summary = excluded.narrative_summary,
          turning_point_description = excluded.turning_point_description,
          milestone_ids = excluded.milestone_ids,
          dominant_mood = excluded.dominant_mood,
          developmental_arc = excluded.developmental_arc,
          status = excluded.status,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        epoch.id,
        epoch.orderIndex,
        epoch.title,
        epoch.periodStart,
        epoch.periodEnd,
        epoch.coreTheme,
        epoch.narrativeSummary,
        epoch.turningPointDescription,
        JSON.stringify(epoch.milestoneIds || []),
        epoch.dominantMood,
        epoch.developmentalArc,
        epoch.status,
        epoch.createdAt,
        epoch.updatedAt,
      );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save narrative epoch ${epoch.id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Personal Milestones
  // ==========================================

  public getMilestoneById(id: string): PersonalMilestone | null {
    try {
      const row = this.db.prepare('SELECT * FROM personal_milestones WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapMilestoneRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get personal milestone ${id}: ${err.message}`, err);
    }
  }

  public listMilestones(filter?: {
    epochId?: string;
    category?: PersonalMilestoneCategory;
    status?: MilestoneStatus;
  }): PersonalMilestone[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.epochId) {
        conditions.push('epoch_id = ?');
        params.push(filter.epochId);
      }
      if (filter?.category) {
        conditions.push('category = ?');
        params.push(filter.category);
      }
      if (filter?.status) {
        conditions.push('status = ?');
        params.push(filter.status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = this.db
        .prepare(`SELECT * FROM personal_milestones ${whereClause} ORDER BY timestamp ASC`)
        .all(...params) as any[];

      return rows.map((r) => this.mapMilestoneRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list personal milestones: ${err.message}`, err);
    }
  }

  public saveMilestone(milestone: PersonalMilestone): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO personal_milestones (
          id, epoch_id, title, summary, category, significance_score,
          timestamp, associated_memory_ids, psychological_impact,
          status, tags, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          epoch_id = excluded.epoch_id,
          title = excluded.title,
          summary = excluded.summary,
          category = excluded.category,
          significance_score = excluded.significance_score,
          timestamp = excluded.timestamp,
          associated_memory_ids = excluded.associated_memory_ids,
          psychological_impact = excluded.psychological_impact,
          status = excluded.status,
          tags = excluded.tags,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        milestone.id,
        milestone.epochId,
        milestone.title,
        milestone.summary,
        milestone.category,
        milestone.significanceScore,
        milestone.timestamp,
        JSON.stringify(milestone.associatedMemoryIds || []),
        JSON.stringify(milestone.psychologicalImpact || {}),
        milestone.status,
        JSON.stringify(milestone.tags || []),
        milestone.createdAt,
        milestone.updatedAt,
      );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save personal milestone ${milestone.id}: ${err.message}`, err);
    }
  }

  public deleteMilestone(id: string): boolean {
    try {
      const res = this.db.prepare('DELETE FROM personal_milestones WHERE id = ?').run(id);
      return res.changes > 0;
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete personal milestone ${id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Narrative Interpretations & Reappraisals
  // ==========================================

  public getInterpretationById(id: string): NarrativeInterpretation | null {
    try {
      const row = this.db.prepare('SELECT * FROM narrative_interpretations WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapInterpretationRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get interpretation ${id}: ${err.message}`, err);
    }
  }

  public getInterpretationForTarget(targetType: string, targetId: string): NarrativeInterpretation | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM narrative_interpretations WHERE target_type = ? AND target_id = ?')
        .get(targetType, targetId) as any;
      if (!row) return null;
      return this.mapInterpretationRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get interpretation for target ${targetId}: ${err.message}`, err);
    }
  }

  public listInterpretations(): NarrativeInterpretation[] {
    try {
      const rows = this.db
        .prepare('SELECT * FROM narrative_interpretations ORDER BY updated_at DESC')
        .all() as any[];
      return rows.map((r) => this.mapInterpretationRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list narrative interpretations: ${err.message}`, err);
    }
  }

  public saveInterpretation(interpretation: NarrativeInterpretation): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO narrative_interpretations (
          id, target_type, target_id, initial_interpretation,
          current_interpretation, causal_connection_to_present,
          reconsideration_history, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          target_type = excluded.target_type,
          target_id = excluded.target_id,
          initial_interpretation = excluded.initial_interpretation,
          current_interpretation = excluded.current_interpretation,
          causal_connection_to_present = excluded.causal_connection_to_present,
          reconsideration_history = excluded.reconsideration_history,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        interpretation.id,
        interpretation.targetType,
        interpretation.targetId,
        interpretation.initialInterpretation,
        interpretation.currentInterpretation,
        interpretation.causalConnectionToPresent,
        JSON.stringify(interpretation.reconsiderationHistory || []),
        interpretation.createdAt,
        interpretation.updatedAt,
      );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save narrative interpretation ${interpretation.id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Overarching Narrative State
  // ==========================================

  public getNarrativeState(): NarrativeIdentityState | null {
    try {
      const row = this.db.prepare('SELECT * FROM narrative_state WHERE id = ?').get('singleton') as any;
      if (!row) return null;

      const epochs = this.listEpochs();
      const milestones = this.listMilestones();
      const interpretations = this.listInterpretations();

      return {
        currentEpochId: row.current_epoch_id,
        epochs,
        milestones,
        interpretations,
        temporalComparisons: JSON.parse(row.temporal_comparisons || '[]'),
        coreInvariants: JSON.parse(row.core_invariants || '[]'),
        autobiographicalSummary: row.autobiographical_summary,
        coherenceScore: row.coherence_score ?? 1.0,
        lastConsolidatedAt: row.last_consolidated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get narrative state: ${err.message}`, err);
    }
  }

  public saveNarrativeState(state: NarrativeIdentityState): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO narrative_state (
          id, current_epoch_id, core_invariants, temporal_comparisons,
          coherence_score, autobiographical_summary, last_consolidated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          current_epoch_id = excluded.current_epoch_id,
          core_invariants = excluded.core_invariants,
          temporal_comparisons = excluded.temporal_comparisons,
          coherence_score = excluded.coherence_score,
          autobiographical_summary = excluded.autobiographical_summary,
          last_consolidated_at = excluded.last_consolidated_at
      `);

      stmt.run(
        'singleton',
        state.currentEpochId,
        JSON.stringify(state.coreInvariants || []),
        JSON.stringify(state.temporalComparisons || []),
        state.coherenceScore,
        state.autobiographicalSummary,
        state.lastConsolidatedAt,
      );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save narrative state: ${err.message}`, err);
    }
  }

  // ==========================================
  // Internal Mapping Helpers
  // ==========================================

  private mapEpochRow(row: any): NarrativeEpoch {
    return {
      id: row.id,
      orderIndex: row.order_index,
      title: row.title,
      periodStart: row.period_start,
      periodEnd: row.period_end ?? null,
      coreTheme: row.core_theme,
      narrativeSummary: row.narrative_summary,
      turningPointDescription: row.turning_point_description,
      milestoneIds: JSON.parse(row.milestone_ids || '[]'),
      dominantMood: row.dominant_mood || 'composed',
      developmentalArc: row.developmental_arc,
      status: row.status as 'active' | 'completed',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMilestoneRow(row: any): PersonalMilestone {
    return {
      id: row.id,
      epochId: row.epoch_id,
      title: row.title,
      summary: row.summary,
      category: row.category as PersonalMilestoneCategory,
      significanceScore: row.significance_score,
      timestamp: row.timestamp,
      associatedMemoryIds: JSON.parse(row.associated_memory_ids || '[]'),
      psychologicalImpact: JSON.parse(row.psychological_impact || '{}'),
      status: row.status as MilestoneStatus,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapInterpretationRow(row: any): NarrativeInterpretation {
    return {
      id: row.id,
      targetType: row.target_type,
      targetId: row.target_id,
      initialInterpretation: row.initial_interpretation,
      currentInterpretation: row.current_interpretation,
      causalConnectionToPresent: row.causal_connection_to_present,
      reconsiderationHistory: JSON.parse(row.reconsideration_history || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
