import Database from 'better-sqlite3';
import {
  ComputationalResourceMetrics,
  InteroceptiveSnapshot,
  OperationalMode,
  ResourceRegulationDirective,
} from '@arletex/contracts';
import { DatabaseError, IEmbodimentRepository } from '@arletex/core';

export class EmbodimentRepository implements IEmbodimentRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Interoceptive Snapshots
  // ==========================================

  public saveSnapshot(snapshot: InteroceptiveSnapshot): void {
    try {
      this.db
        .prepare(
          `INSERT INTO interoceptive_snapshots (
            id, timestamp, resource_metrics, model_availability,
            tool_availability, cognitive_workload, operational_mode,
            constraints, directive, digital_physiological_report, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            timestamp = excluded.timestamp,
            resource_metrics = excluded.resource_metrics,
            model_availability = excluded.model_availability,
            tool_availability = excluded.tool_availability,
            cognitive_workload = excluded.cognitive_workload,
            operational_mode = excluded.operational_mode,
            constraints = excluded.constraints,
            directive = excluded.directive,
            digital_physiological_report = excluded.digital_physiological_report`,
        )
        .run(
          snapshot.id,
          snapshot.timestamp,
          JSON.stringify(snapshot.resources),
          JSON.stringify(snapshot.models),
          JSON.stringify(snapshot.tools),
          JSON.stringify(snapshot.workload),
          snapshot.operationalMode,
          JSON.stringify(snapshot.constraints),
          JSON.stringify(snapshot.directive),
          snapshot.digitalPhysiologicalReport,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save interoceptive snapshot ${snapshot.id}: ${err.message}`,
        err,
      );
    }
  }

  public getSnapshotById(id: string): InteroceptiveSnapshot | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM interoceptive_snapshots WHERE id = ?')
        .get(id) as any;
      if (!row) return null;
      return this.mapSnapshotRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get interoceptive snapshot ${id}: ${err.message}`, err);
    }
  }

  public getLatestSnapshot(): InteroceptiveSnapshot | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM interoceptive_snapshots ORDER BY timestamp DESC LIMIT 1')
        .get() as any;
      if (!row) return null;
      return this.mapSnapshotRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest interoceptive snapshot: ${err.message}`, err);
    }
  }

  public listSnapshots(limit: number = 50): InteroceptiveSnapshot[] {
    try {
      const rows = this.db
        .prepare('SELECT * FROM interoceptive_snapshots ORDER BY timestamp DESC LIMIT ?')
        .all(limit) as any[];
      return rows.map((r) => this.mapSnapshotRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list interoceptive snapshots: ${err.message}`, err);
    }
  }

  // ==========================================
  // Operational Constraint Events
  // ==========================================

  public recordConstraintEvent(event: {
    id: string;
    timestamp: string;
    previousMode: OperationalMode;
    newMode: OperationalMode;
    triggerReason: string;
    resourceState: ComputationalResourceMetrics;
    directiveIssued: ResourceRegulationDirective;
  }): void {
    try {
      this.db
        .prepare(
          `INSERT INTO operational_constraint_events (
            id, timestamp, previous_mode, new_mode, trigger_reason,
            resource_state, directive_issued, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.timestamp,
          event.previousMode,
          event.newMode,
          event.triggerReason,
          JSON.stringify(event.resourceState),
          JSON.stringify(event.directiveIssued),
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to record constraint event ${event.id}: ${err.message}`, err);
    }
  }

  public listConstraintEvents(limit: number = 50): Array<{
    id: string;
    timestamp: string;
    previousMode: OperationalMode;
    newMode: OperationalMode;
    triggerReason: string;
    resourceState: ComputationalResourceMetrics;
    directiveIssued: ResourceRegulationDirective;
    createdAt: string;
  }> {
    try {
      const rows = this.db
        .prepare('SELECT * FROM operational_constraint_events ORDER BY timestamp DESC LIMIT ?')
        .all(limit) as any[];
      return rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        previousMode: r.previous_mode as OperationalMode,
        newMode: r.new_mode as OperationalMode,
        triggerReason: r.trigger_reason,
        resourceState: JSON.parse(r.resource_state),
        directiveIssued: JSON.parse(r.directive_issued),
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list constraint events: ${err.message}`, err);
    }
  }

  // ==========================================
  // Resource Regulation Directives
  // ==========================================

  public recordRegulationDirective(directive: ResourceRegulationDirective & { id?: string }): void {
    try {
      const id = directive.id || crypto.randomUUID();
      this.db
        .prepare(
          `INSERT INTO resource_regulation_history (
            id, timestamp, mode, throttle_background_tasks,
            max_context_tokens_adjustment, suspend_heavy_multimodal,
            reason, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          directive.appliedAt || new Date().toISOString(),
          directive.targetMode,
          directive.throttleBackgroundTasks ? 1 : 0,
          directive.maxContextTokensAdjustment || 0,
          directive.suspendHeavyMultimodal ? 1 : 0,
          directive.reason,
          new Date().toISOString(),
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to record regulation directive: ${err.message}`, err);
    }
  }

  public getLatestRegulationDirective(): ResourceRegulationDirective | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM resource_regulation_history ORDER BY timestamp DESC LIMIT 1')
        .get() as any;
      if (!row) return null;
      return {
        targetMode: row.mode as OperationalMode,
        throttleBackgroundTasks: Boolean(row.throttle_background_tasks),
        maxContextTokensAdjustment: row.max_context_tokens_adjustment,
        suspendHeavyMultimodal: Boolean(row.suspend_heavy_multimodal),
        appliedAt: row.timestamp,
        reason: row.reason,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get latest regulation directive: ${err.message}`, err);
    }
  }

  // ==========================================
  // Helpers
  // ==========================================

  private mapSnapshotRow(row: any): InteroceptiveSnapshot {
    return {
      id: row.id,
      timestamp: row.timestamp,
      resources: JSON.parse(row.resource_metrics),
      models: JSON.parse(row.model_availability),
      tools: JSON.parse(row.tool_availability),
      workload: JSON.parse(row.cognitive_workload),
      operationalMode: row.operational_mode as OperationalMode,
      constraints: JSON.parse(row.constraints || '[]'),
      directive: JSON.parse(row.directive),
      digitalPhysiologicalReport: row.digital_physiological_report,
    };
  }
}
