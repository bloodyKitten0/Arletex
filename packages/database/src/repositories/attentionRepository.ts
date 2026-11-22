import Database from 'better-sqlite3';
import {
  AttentionalFocusState,
  AttentionalStimulus,
  AttentionSwitchEvent,
  SalienceBreakdown,
} from '@arletex/contracts';
import { DatabaseError, IAttentionRepository } from '@arletex/core';

export class AttentionRepository implements IAttentionRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Attentional Focus Snapshots
  // ==========================================

  public saveFocusState(state: AttentionalFocusState): void {
    try {
      this.db
        .prepare(
          `INSERT INTO attentional_focus_snapshots (
            id, timestamp, focal_target, peripheral_targets,
            total_stimuli_evaluated, filtered_stimuli_count,
            is_overloaded, attention_capacity, available_capacity,
            active_goals, active_interests, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            focal_target = excluded.focal_target,
            peripheral_targets = excluded.peripheral_targets,
            total_stimuli_evaluated = excluded.total_stimuli_evaluated,
            filtered_stimuli_count = excluded.filtered_stimuli_count,
            is_overloaded = excluded.is_overloaded,
            attention_capacity = excluded.attention_capacity,
            available_capacity = excluded.available_capacity,
            active_goals = excluded.active_goals,
            active_interests = excluded.active_interests`,
        )
        .run(
          state.id,
          state.timestamp,
          state.focalTarget ? JSON.stringify(state.focalTarget) : null,
          JSON.stringify(state.peripheralTargets),
          state.totalStimuliEvaluated,
          state.filteredStimuliCount,
          state.isOverloaded ? 1 : 0,
          state.attentionCapacity,
          state.availableCapacity,
          JSON.stringify(state.activeGoals),
          JSON.stringify(state.activeInterests),
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save attentional focus state ${state.id}: ${err.message}`,
        err,
      );
    }
  }

  public getLatestFocusState(): AttentionalFocusState | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM attentional_focus_snapshots ORDER BY timestamp DESC LIMIT 1')
        .get() as any;
      if (!row) return null;
      return this.mapFocusStateRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest attentional focus state: ${err.message}`, err);
    }
  }

  public listFocusStates(limit = 20): AttentionalFocusState[] {
    try {
      const rows = this.db
        .prepare('SELECT * FROM attentional_focus_snapshots ORDER BY timestamp DESC LIMIT ?')
        .all(limit) as any[];
      return rows.map((r) => this.mapFocusStateRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list attentional focus states: ${err.message}`, err);
    }
  }

  // ==========================================
  // Attention Switch Events
  // ==========================================

  public recordSwitchEvent(event: AttentionSwitchEvent): void {
    try {
      this.db
        .prepare(
          `INSERT INTO attention_switch_events (
            id, timestamp, previous_target_id, new_target_id,
            switch_reason, switching_cost_ms, forced_by_urgency, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.timestamp,
          event.previousTargetId ?? null,
          event.newTargetId,
          event.switchReason,
          event.switchingCostMs,
          event.forcedByUrgency ? 1 : 0,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to record attention switch event ${event.id}: ${err.message}`,
        err,
      );
    }
  }

  public listSwitchEvents(limit = 50): AttentionSwitchEvent[] {
    try {
      const rows = this.db
        .prepare('SELECT * FROM attention_switch_events ORDER BY timestamp DESC LIMIT ?')
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        previousTargetId: r.previous_target_id ?? null,
        newTargetId: r.new_target_id,
        switchReason: r.switch_reason,
        switchingCostMs: Number(r.switching_cost_ms),
        forcedByUrgency: Boolean(r.forced_by_urgency),
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list attention switch events: ${err.message}`, err);
    }
  }

  // ==========================================
  // Attentional Stimuli Records
  // ==========================================

  public recordStimulusEvaluation(
    stimulus: AttentionalStimulus,
    salience: SalienceBreakdown,
    wasAttended: boolean,
  ): void {
    try {
      this.db
        .prepare(
          `INSERT INTO attentional_stimuli_records (
            id, timestamp, stimulus_type, source,
            summary, content, salience_breakdown,
            was_attended, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            salience_breakdown = excluded.salience_breakdown,
            was_attended = excluded.was_attended`,
        )
        .run(
          stimulus.id,
          stimulus.timestamp,
          stimulus.type,
          stimulus.source,
          stimulus.summary,
          stimulus.content ? JSON.stringify(stimulus.content) : null,
          JSON.stringify(salience),
          wasAttended ? 1 : 0,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to record stimulus evaluation ${stimulus.id}: ${err.message}`,
        err,
      );
    }
  }

  public listStimulusEvaluations(filter?: {
    wasAttended?: boolean;
    stimulusType?: string;
    limit?: number;
  }): Array<{
    id: string;
    timestamp: string;
    stimulusType: string;
    source: string;
    summary: string;
    content?: any;
    salience: SalienceBreakdown;
    wasAttended: boolean;
  }> {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.wasAttended !== undefined) {
        conditions.push('was_attended = ?');
        params.push(filter.wasAttended ? 1 : 0);
      }
      if (filter?.stimulusType) {
        conditions.push('stimulus_type = ?');
        params.push(filter.stimulusType);
      }

      let query = 'SELECT * FROM attentional_stimuli_records';
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(filter?.limit ?? 50);

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        stimulusType: r.stimulus_type,
        source: r.source,
        summary: r.summary,
        content: r.content ? JSON.parse(r.content) : undefined,
        salience: JSON.parse(r.salience_breakdown),
        wasAttended: Boolean(r.was_attended),
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list stimulus evaluations: ${err.message}`, err);
    }
  }

  private mapFocusStateRow(row: any): AttentionalFocusState {
    return {
      id: row.id,
      timestamp: row.timestamp,
      focalTarget: row.focal_target ? JSON.parse(row.focal_target) : null,
      peripheralTargets: JSON.parse(row.peripheral_targets || '[]'),
      totalStimuliEvaluated: Number(row.total_stimuli_evaluated),
      filteredStimuliCount: Number(row.filtered_stimuli_count),
      isOverloaded: Boolean(row.is_overloaded),
      attentionCapacity: Number(row.attention_capacity),
      availableCapacity: Number(row.available_capacity),
      activeGoals: JSON.parse(row.active_goals || '[]'),
      activeInterests: JSON.parse(row.active_interests || '[]'),
    };
  }
}
