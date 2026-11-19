import Database from 'better-sqlite3';
import {
  OfflineActivityRecord,
  OfflineActivityType,
  ConsolidationRun,
  UnfinishedWorkItem,
  ProactiveNotificationProposal,
} from '@arletex/contracts';
import { DatabaseError, IOfflineCognitiveActivityRepository } from '@arletex/core';

export class SqliteOfflineCognitiveActivityRepository implements IOfflineCognitiveActivityRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveActivity(activity: OfflineActivityRecord): void {
    try {
      this.db
        .prepare(
          `INSERT INTO offline_activities (
            id, activity_type, title, rationale, source_goal_id,
            source_project_id, source_question_id, cpu_tokens_estimated,
            memory_intensity, status, is_simulation, simulation_context,
            progress, insights, resulting_artifacts, scheduled_at,
            started_at, completed_at, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            activity_type = excluded.activity_type,
            title = excluded.title,
            rationale = excluded.rationale,
            source_goal_id = excluded.source_goal_id,
            source_project_id = excluded.source_project_id,
            source_question_id = excluded.source_question_id,
            cpu_tokens_estimated = excluded.cpu_tokens_estimated,
            memory_intensity = excluded.memory_intensity,
            status = excluded.status,
            is_simulation = excluded.is_simulation,
            simulation_context = excluded.simulation_context,
            progress = excluded.progress,
            insights = excluded.insights,
            resulting_artifacts = excluded.resulting_artifacts,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at,
            metadata = excluded.metadata`,
        )
        .run(
          activity.id,
          activity.activityType,
          activity.title,
          activity.rationale,
          activity.sourceGoalId ?? null,
          activity.sourceProjectId ?? null,
          activity.sourceQuestionId ?? null,
          activity.resourceCost?.cpuTokensEstimated ?? 100,
          activity.resourceCost?.memoryIntensity ?? 'low',
          activity.status,
          activity.isSimulation ? 1 : 0,
          activity.simulationContext ?? null,
          activity.progress,
          JSON.stringify(activity.insights ?? []),
          JSON.stringify(activity.resultingArtifacts ?? []),
          activity.scheduledAt,
          activity.startedAt ?? null,
          activity.completedAt ?? null,
          JSON.stringify(activity.metadata ?? {}),
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save offline activity ${activity.id}: ${err.message}`,
        err,
      );
    }
  }

  public getActivity(id: string): OfflineActivityRecord | null {
    try {
      const row = this.db.prepare(`SELECT * FROM offline_activities WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return this.mapActivityRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get offline activity ${id}: ${err.message}`, err);
    }
  }

  public listActivities(filter?: {
    activityType?: OfflineActivityType;
    status?: string;
    limit?: number;
  }): OfflineActivityRecord[] {
    try {
      let query = `SELECT * FROM offline_activities`;
      const clauses: string[] = [];
      const params: any[] = [];

      if (filter?.activityType) {
        clauses.push(`activity_type = ?`);
        params.push(filter.activityType);
      }
      if (filter?.status) {
        clauses.push(`status = ?`);
        params.push(filter.status);
      }

      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(' AND ');
      }

      query += ` ORDER BY scheduled_at DESC`;
      if (filter?.limit) {
        query += ` LIMIT ?`;
        params.push(filter.limit);
      }

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapActivityRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list offline activities: ${err.message}`, err);
    }
  }

  public saveConsolidationRun(run: ConsolidationRun): void {
    try {
      this.db
        .prepare(
          `INSERT INTO consolidation_runs (
            id, run_type, memories_examined, memories_consolidated,
            beliefs_reassessed, intentions_preserved, summary, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            run_type = excluded.run_type,
            memories_examined = excluded.memories_examined,
            memories_consolidated = excluded.memories_consolidated,
            beliefs_reassessed = excluded.beliefs_reassessed,
            intentions_preserved = excluded.intentions_preserved,
            summary = excluded.summary,
            timestamp = excluded.timestamp`,
        )
        .run(
          run.id,
          run.runType,
          run.memoriesExamined,
          run.memoriesConsolidated,
          run.beliefsReassessed,
          run.intentionsPreserved,
          run.summary,
          run.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save consolidation run ${run.id}: ${err.message}`,
        err,
      );
    }
  }

  public listConsolidationRuns(limit?: number): ConsolidationRun[] {
    try {
      const query = limit
        ? `SELECT * FROM consolidation_runs ORDER BY timestamp DESC LIMIT ?`
        : `SELECT * FROM consolidation_runs ORDER BY timestamp DESC`;
      const rows = (limit ? this.db.prepare(query).all(limit) : this.db.prepare(query).all()) as any[];

      return rows.map((r) => ({
        id: r.id,
        runType: r.run_type,
        memoriesExamined: r.memories_examined,
        memoriesConsolidated: r.memories_consolidated,
        beliefsReassessed: r.beliefs_reassessed,
        intentionsPreserved: r.intentions_preserved,
        summary: r.summary,
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list consolidation runs: ${err.message}`, err);
    }
  }

  public saveUnfinishedWorkItem(item: UnfinishedWorkItem): void {
    try {
      this.db
        .prepare(
          `INSERT INTO unfinished_work_items (
            id, work_type, reference_id, title, last_active_at, recovery_state, recovery_plan
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            work_type = excluded.work_type,
            reference_id = excluded.reference_id,
            title = excluded.title,
            last_active_at = excluded.last_active_at,
            recovery_state = excluded.recovery_state,
            recovery_plan = excluded.recovery_plan`,
        )
        .run(
          item.id,
          item.workType,
          item.referenceId,
          item.title,
          item.lastActiveAt,
          item.recoveryState,
          item.recoveryPlan,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save unfinished work item ${item.id}: ${err.message}`,
        err,
      );
    }
  }

  public listUnfinishedWorkItems(status?: string): UnfinishedWorkItem[] {
    try {
      const query = status
        ? `SELECT * FROM unfinished_work_items WHERE recovery_state = ? ORDER BY last_active_at DESC`
        : `SELECT * FROM unfinished_work_items ORDER BY last_active_at DESC`;
      const rows = (status ? this.db.prepare(query).all(status) : this.db.prepare(query).all()) as any[];

      return rows.map((r) => ({
        id: r.id,
        workType: r.work_type,
        referenceId: r.reference_id,
        title: r.title,
        lastActiveAt: r.last_active_at,
        recoveryState: r.recovery_state,
        recoveryPlan: r.recovery_plan,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list unfinished work items: ${err.message}`, err);
    }
  }

  public saveProactiveProposal(proposal: ProactiveNotificationProposal): void {
    try {
      this.db
        .prepare(
          `INSERT INTO proactive_proposals (
            id, urgency, topic, message, reasoning, should_deliver_immediately, delivered, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            urgency = excluded.urgency,
            topic = excluded.topic,
            message = excluded.message,
            reasoning = excluded.reasoning,
            should_deliver_immediately = excluded.should_deliver_immediately,
            delivered = excluded.delivered,
            created_at = excluded.created_at`,
        )
        .run(
          proposal.id,
          proposal.urgency,
          proposal.topic,
          proposal.message,
          proposal.reasoning,
          proposal.shouldDeliverImmediately ? 1 : 0,
          proposal.delivered ? 1 : 0,
          proposal.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save proactive proposal ${proposal.id}: ${err.message}`,
        err,
      );
    }
  }

  public listProactiveProposals(delivered?: boolean): ProactiveNotificationProposal[] {
    try {
      const query = delivered !== undefined
        ? `SELECT * FROM proactive_proposals WHERE delivered = ? ORDER BY created_at DESC`
        : `SELECT * FROM proactive_proposals ORDER BY created_at DESC`;
      const rows = (
        delivered !== undefined
          ? this.db.prepare(query).all(delivered ? 1 : 0)
          : this.db.prepare(query).all()
      ) as any[];

      return rows.map((r) => ({
        id: r.id,
        urgency: r.urgency,
        topic: r.topic,
        message: r.message,
        reasoning: r.reasoning,
        shouldDeliverImmediately: Boolean(r.should_deliver_immediately),
        delivered: Boolean(r.delivered),
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list proactive proposals: ${err.message}`, err);
    }
  }

  private mapActivityRow(row: any): OfflineActivityRecord {
    return {
      id: row.id,
      activityType: row.activity_type,
      title: row.title,
      rationale: row.rationale,
      sourceGoalId: row.source_goal_id ?? undefined,
      sourceProjectId: row.source_project_id ?? undefined,
      sourceQuestionId: row.source_question_id ?? undefined,
      resourceCost: {
        cpuTokensEstimated: row.cpu_tokens_estimated,
        memoryIntensity: row.memory_intensity,
      },
      status: row.status,
      isSimulation: Boolean(row.is_simulation),
      simulationContext: row.simulation_context ?? undefined,
      progress: row.progress,
      insights: JSON.parse(row.insights || '[]'),
      resultingArtifacts: JSON.parse(row.resulting_artifacts || '[]'),
      scheduledAt: row.scheduled_at,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      metadata: JSON.parse(row.metadata || '{}'),
    };
  }
}
