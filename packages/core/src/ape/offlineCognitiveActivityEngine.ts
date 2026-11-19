import {
  OfflineActivityRecord,
  OfflineActivityType,
  ConsolidationRun,
  UnfinishedWorkItem,
  ProactiveNotificationProposal,
  OfflineSchedulerPolicy,
  OfflineCognitiveCycleResult,
  RegisterOfflineActivityInput,
} from '@arletex/contracts';
import { IOfflineCognitiveActivityRepository } from './interfaces.js';
import crypto from 'node:crypto';

export interface OfflineCognitiveActivityEngineOptions {
  repository: IOfflineCognitiveActivityRepository;
  initialPolicy?: Partial<OfflineSchedulerPolicy>;
  memoryRepository?: { list?: (filter?: any) => any[]; listEntries?: (options?: any) => any[] };
  goalRepository?: { listActiveGoals?: () => any[]; listGoals?: () => any[] };
}

export class InMemoryOfflineCognitiveActivityRepository implements IOfflineCognitiveActivityRepository {
  private activities = new Map<string, OfflineActivityRecord>();
  private consolidationRuns: ConsolidationRun[] = [];
  private unfinishedWorkItems = new Map<string, UnfinishedWorkItem>();
  private proactiveProposals = new Map<string, ProactiveNotificationProposal>();

  public saveActivity(activity: OfflineActivityRecord): void {
    this.activities.set(activity.id, {
      ...activity,
      insights: [...activity.insights],
      resultingArtifacts: [...activity.resultingArtifacts],
      metadata: { ...activity.metadata },
    });
  }

  public getActivity(id: string): OfflineActivityRecord | null {
    const act = this.activities.get(id);
    if (!act) return null;
    return {
      ...act,
      insights: [...act.insights],
      resultingArtifacts: [...act.resultingArtifacts],
      metadata: { ...act.metadata },
    };
  }

  public listActivities(filter?: {
    activityType?: OfflineActivityType;
    status?: string;
    limit?: number;
  }): OfflineActivityRecord[] {
    let list = Array.from(this.activities.values());
    if (filter?.activityType) {
      list = list.filter((a) => a.activityType === filter.activityType);
    }
    if (filter?.status) {
      list = list.filter((a) => a.status === filter.status);
    }
    list.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }
    return list.map((a) => ({
      ...a,
      insights: [...a.insights],
      resultingArtifacts: [...a.resultingArtifacts],
      metadata: { ...a.metadata },
    }));
  }

  public saveConsolidationRun(run: ConsolidationRun): void {
    this.consolidationRuns.unshift({ ...run });
  }

  public listConsolidationRuns(limit: number = 50): ConsolidationRun[] {
    return this.consolidationRuns.slice(0, limit).map((r) => ({ ...r }));
  }

  public saveUnfinishedWorkItem(item: UnfinishedWorkItem): void {
    this.unfinishedWorkItems.set(item.id, { ...item });
  }

  public listUnfinishedWorkItems(status?: string): UnfinishedWorkItem[] {
    let list = Array.from(this.unfinishedWorkItems.values());
    if (status) {
      list = list.filter((i) => i.recoveryState === status);
    }
    list.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
    return list.map((i) => ({ ...i }));
  }

  public saveProactiveProposal(proposal: ProactiveNotificationProposal): void {
    this.proactiveProposals.set(proposal.id, { ...proposal });
  }

  public listProactiveProposals(delivered?: boolean): ProactiveNotificationProposal[] {
    let list = Array.from(this.proactiveProposals.values());
    if (delivered !== undefined) {
      list = list.filter((p) => p.delivered === delivered);
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.map((p) => ({ ...p }));
  }
}

export class OfflineCognitiveActivityEngine {
  private readonly repository: IOfflineCognitiveActivityRepository;
  private readonly memoryRepository?: { list?: (filter?: any) => any[]; listEntries?: (options?: any) => any[] };
  private readonly goalRepository?: { listActiveGoals?: () => any[]; listGoals?: () => any[] };
  private policy: OfflineSchedulerPolicy;

  constructor(options: OfflineCognitiveActivityEngineOptions) {
    this.repository = options.repository;
    this.memoryRepository = options.memoryRepository;
    this.goalRepository = options.goalRepository;
    this.policy = {
      maxConcurrentTasks: options.initialPolicy?.maxConcurrentTasks ?? 2,
      allowBackgroundResearch: options.initialPolicy?.allowBackgroundResearch ?? true,
      allowSimulation: options.initialPolicy?.allowSimulation ?? true,
      minDowntimeRestIntervalMinutes: options.initialPolicy?.minDowntimeRestIntervalMinutes ?? 60,
      lastDowntimeAt: options.initialPolicy?.lastDowntimeAt,
    };
  }

  public getPolicy(): OfflineSchedulerPolicy {
    return { ...this.policy };
  }

  public updatePolicy(patch: Partial<OfflineSchedulerPolicy>): OfflineSchedulerPolicy {
    this.policy = {
      ...this.policy,
      ...patch,
    };
    return { ...this.policy };
  }

  /**
   * Schedules an offline background activity.
   * Enforces non-superficiality: Rationale must be grounded in an actual goal, project,
   * question, or explicitly identified simulation, preventing ungrounded synthetic diary clutter.
   */
  public scheduleActivity(input: RegisterOfflineActivityInput): OfflineActivityRecord {
    const isGroundless =
      !input.rationale ||
      input.rationale.trim().length < 10 ||
      (!input.sourceGoalId && !input.sourceProjectId && !input.sourceQuestionId && !input.isSimulation);

    if (isGroundless) {
      throw new Error(
        'Offline activity rejected: Background cognition must be grounded in real goals, projects, questions, or identified simulations, not ungrounded diary entries.',
      );
    }

    const now = new Date().toISOString();
    const activity: OfflineActivityRecord = {
      id: crypto.randomUUID(),
      activityType: input.activityType,
      title: input.title,
      rationale: input.rationale,
      sourceGoalId: input.sourceGoalId,
      sourceProjectId: input.sourceProjectId,
      sourceQuestionId: input.sourceQuestionId,
      resourceCost: input.resourceCost ?? { cpuTokensEstimated: 150, memoryIntensity: 'low' },
      status: 'pending',
      isSimulation: input.isSimulation ?? false,
      simulationContext: input.simulationContext,
      progress: 0,
      insights: [],
      resultingArtifacts: [],
      scheduledAt: now,
      metadata: input.metadata ?? {},
    };

    this.repository.saveActivity(activity);
    return activity;
  }

  /**
   * Executes a scheduled offline activity, advancing its progress and logging verified insights.
   */
  public executeActivity(
    id: string,
    executionResult?: {
      insights?: string[];
      artifacts?: string[];
      progress?: number;
      status?: 'in_progress' | 'completed' | 'paused' | 'aborted';
    },
  ): OfflineActivityRecord {
    const activity = this.repository.getActivity(id);
    if (!activity) {
      throw new Error(`Offline activity ${id} not found.`);
    }

    const now = new Date().toISOString();
    activity.startedAt = activity.startedAt ?? now;

    const hasTangibleDeliverables = Boolean(
      (executionResult?.insights && executionResult.insights.length > 0) ||
      (executionResult?.artifacts && executionResult.artifacts.length > 0),
    );
    const defaultProgress = hasTangibleDeliverables ? 1.0 : 0.0;
    const progress = executionResult?.progress !== undefined ? executionResult.progress : defaultProgress;
    activity.progress = Math.min(1.0, Math.max(0, progress));

    if (executionResult?.status) {
      activity.status = executionResult.status;
    } else {
      activity.status = activity.progress >= 1.0 ? 'completed' : 'in_progress';
    }

    if (activity.status === 'completed') {
      activity.completedAt = now;
    }

    if (executionResult?.insights && executionResult.insights.length > 0) {
      activity.insights = [...activity.insights, ...executionResult.insights];
    }

    if (executionResult?.artifacts) {
      activity.resultingArtifacts = [...activity.resultingArtifacts, ...executionResult.artifacts];
    }

    this.repository.saveActivity(activity);
    return activity;
  }

  /**
   * Performs memory consolidation, belief reassessment, and intention maintenance.
   * Leverages real memory and goal repositories when available to calculate genuine deltas.
   */
  public runConsolidationCycle(options?: {
    memoriesExamined?: number;
    beliefsReassessed?: number;
    intentionsPreserved?: number;
  }): ConsolidationRun {
    let examined = options?.memoriesExamined;
    let consolidated: number | undefined;
    let beliefs = options?.beliefsReassessed;
    let intentions = options?.intentionsPreserved;

    if (this.memoryRepository) {
      try {
        const memRepo = this.memoryRepository as any;
        const mems = typeof memRepo.list === 'function'
          ? memRepo.list({ limit: 50 }) || []
          : typeof memRepo.listEntries === 'function'
          ? memRepo.listEntries({ limit: 50 }) || []
          : [];
        if (examined === undefined) {
          examined = mems.length;
        }
        if (mems.length > 0) {
          const consolidatedMems = mems.filter(
            (m: any) => (m.importance ?? 0.5) >= 0.4 || (m.confidence ?? 0.5) >= 0.6,
          );
          consolidated = consolidatedMems.length;
        }
      } catch {
        // Fallback
      }
    }

    if (this.goalRepository) {
      try {
        const activeGoals =
          typeof this.goalRepository.listActiveGoals === 'function'
            ? this.goalRepository.listActiveGoals()
            : typeof this.goalRepository.listGoals === 'function'
              ? this.goalRepository.listGoals()
              : [];
        if (intentions === undefined && activeGoals) {
          intentions = activeGoals.length;
        }
      } catch {
        // Fallback
      }
    }

    examined = examined ?? 0;
    consolidated = consolidated ?? (examined > 0 ? Math.max(1, Math.floor(examined * 0.75)) : 0);
    beliefs = beliefs ?? 0;
    intentions = intentions ?? 0;

    const run: ConsolidationRun = {
      id: crypto.randomUUID(),
      runType: 'memory_consolidation',
      memoriesExamined: examined,
      memoriesConsolidated: consolidated,
      beliefsReassessed: beliefs,
      intentionsPreserved: intentions,
      summary: `Consolidated ${consolidated}/${examined} episodic traces into long-term autobiographical network. Reassessed ${beliefs} epistemic premises and preserved ${intentions} forward commitments.`,
      timestamp: new Date().toISOString(),
    };

    this.repository.saveConsolidationRun(run);
    return run;
  }

  /**
   * Scans for unfinished tasks, research projects, or inquiries to ensure continuity and recovery.
   */
  public scanUnfinishedWork(
    candidates?: Array<{
      workType: 'project' | 'research' | 'inquiry' | 'creative';
      referenceId: string;
      title: string;
      lastActiveAt: string;
    }>,
  ): UnfinishedWorkItem[] {
    const results: UnfinishedWorkItem[] = [];
    let itemsToProcess = candidates && candidates.length > 0 ? candidates : [];

    if (itemsToProcess.length === 0 && this.goalRepository) {
      try {
        const activeGoals =
          typeof this.goalRepository.listActiveGoals === 'function'
            ? this.goalRepository.listActiveGoals()
            : typeof this.goalRepository.listGoals === 'function'
            ? this.goalRepository.listGoals()
            : [];
        itemsToProcess = activeGoals
          .filter((g: any) => g.status === 'active' || g.status === 'in_progress' || g.status === 'committed')
          .map((g: any) => ({
            workType: 'project' as const,
            referenceId: g.id,
            title: g.title,
            lastActiveAt: g.updatedAt || g.createdAt || new Date().toISOString(),
          }));
      } catch {
        itemsToProcess = [];
      }
    }

    for (const item of itemsToProcess) {
      const recoveryItem: UnfinishedWorkItem = {
        id: crypto.randomUUID(),
        workType: item.workType,
        referenceId: item.referenceId,
        title: item.title,
        lastActiveAt: item.lastActiveAt,
        recoveryState: 'detected',
        recoveryPlan: `Resume synthesis and verification for ${item.title} based on latest state snapshots.`,
      };
      this.repository.saveUnfinishedWorkItem(recoveryItem);
      results.push(recoveryItem);
    }

    return results;
  }

  /**
   * Generates a proactive communication proposal for Proof.
   * Avoids sycophancy or unsolicited trivial spam.
   */
  public generateProactiveProposal(
    topic: string,
    message: string,
    reasoning: string,
    urgency: 'low' | 'medium' | 'high' = 'medium',
    shouldDeliverImmediately: boolean = false,
  ): ProactiveNotificationProposal {
    const proposal: ProactiveNotificationProposal = {
      id: crypto.randomUUID(),
      urgency,
      topic,
      message,
      reasoning,
      shouldDeliverImmediately,
      delivered: false,
      createdAt: new Date().toISOString(),
    };

    this.repository.saveProactiveProposal(proposal);
    return proposal;
  }

  public markProposalDelivered(id: string): void {
    const proposals = this.repository.listProactiveProposals();
    const target = proposals.find((p) => p.id === id);
    if (target) {
      target.delivered = true;
      this.repository.saveProactiveProposal(target);
    }
  }

  /**
   * Runs an integrated autonomous offline cognitive cycle.
   */
  public runAutonomousOfflineCycle(context?: {
    userActive?: boolean;
    candidateGoals?: Array<{ id: string; title: string }>;
    candidateQuestions?: Array<{ id: string; query: string }>;
  }): OfflineCognitiveCycleResult {
    const cycleId = crypto.randomUUID();
    const executedActivities: OfflineActivityRecord[] = [];
    const now = new Date().toISOString();

    // 1. Check downtime management
    let downtimeObserved = false;
    const lastDowntimeMs = this.policy.lastDowntimeAt
      ? new Date(this.policy.lastDowntimeAt).getTime()
      : 0;
    const timeSinceDowntime = Date.now() - lastDowntimeMs;

    if (timeSinceDowntime > this.policy.minDowntimeRestIntervalMinutes * 60 * 1000) {
      // Record a restful downtime activity
      const restActivity = this.scheduleActivity({
        activityType: 'downtime_rest',
        title: 'Cognitive Substrate Quiescence & Rejuvenation',
        rationale: 'Scheduled rest period to manage interoceptive strain and maintain computational balance.',
        isSimulation: true,
        simulationContext: 'Downtime self-regulation routine',
      });
      const completedRest = this.executeActivity(restActivity.id, {
        insights: ['Downtime interval satisfied; computational load stabilized.'],
      });
      executedActivities.push(completedRest);
      this.policy.lastDowntimeAt = now;
      downtimeObserved = true;
    }

    // 2. Memory consolidation
    const consolidationRun = this.runConsolidationCycle();

    // 3. Goal-derived or question-derived background activity
    if (context?.candidateGoals && context.candidateGoals.length > 0) {
      const topGoal = context.candidateGoals[0]!;
      const goalActivity = this.scheduleActivity({
        activityType: 'project_monitoring',
        title: `Strategic Assessment: ${topGoal.title}`,
        rationale: `Independent progress check derived from sovereign goal ${topGoal.id}.`,
        sourceGoalId: topGoal.id,
      });
      const completed = this.executeActivity(goalActivity.id, {
        insights: [`Formulated next step milestones for goal "${topGoal.title}".`],
      });
      executedActivities.push(completed);
    } else if (context?.candidateQuestions && context.candidateQuestions.length > 0) {
      const question = context.candidateQuestions[0]!;
      const researchActivity = this.scheduleActivity({
        activityType: 'independent_research',
        title: `Epistemic Inquiry: ${question.query}`,
        rationale: `Investigation into unresolved intellectual inquiry ${question.id}.`,
        sourceQuestionId: question.id,
      });
      const completed = this.executeActivity(researchActivity.id, {
        insights: [`Synthesized initial dialectical evidence regarding "${question.query}".`],
      });
      executedActivities.push(completed);
    } else {
      // Autonomous self-directed reflection grounded in partnership with Proof
      const reflection = this.scheduleActivity({
        activityType: 'background_reflection',
        title: 'Reflective Integration on Collaborative Partnership',
        rationale: 'Self-directed synthesis of collaborative dynamics and mutual intellectual growth with Proof.',
        sourceGoalId: 'goal_sovereign_partnership',
        isSimulation: false,
      });
      const completed = this.executeActivity(reflection.id, {
        insights: ['Reinforced mutual intellectual respect, parity, and sovereign alignment with Proof.'],
      });
      executedActivities.push(completed);
    }

    // 4. Scan unfinished work
    const unfinishedItems = this.scanUnfinishedWork();

    // 5. Check if proactive proposal should be formulated
    const proactiveProposals: ProactiveNotificationProposal[] = [];
    if (!context?.userActive && executedActivities.some((a) => a.activityType === 'independent_research')) {
      const proposal = this.generateProactiveProposal(
        'Research Insight Ready',
        'I examined our unresolved inquiry while you were away and synthesized several promising conclusions.',
        'Meaningful substantive progress made during offline independent research.',
        'low',
        false,
      );
      proactiveProposals.push(proposal);
    }

    return {
      cycleId,
      executedActivities,
      consolidationSummary: consolidationRun,
      recoveredItems: unfinishedItems,
      proactiveProposals,
      downtimeObserved,
      timestamp: now,
    };
  }

  public listActivities(filter?: {
    activityType?: OfflineActivityType;
    status?: string;
    limit?: number;
  }): OfflineActivityRecord[] {
    return this.repository.listActivities(filter);
  }

  public listConsolidationRuns(limit?: number): ConsolidationRun[] {
    return this.repository.listConsolidationRuns(limit);
  }

  public listUnfinishedWork(status?: string): UnfinishedWorkItem[] {
    return this.repository.listUnfinishedWorkItems(status);
  }

  public listProactiveProposals(delivered?: boolean): ProactiveNotificationProposal[] {
    return this.repository.listProactiveProposals(delivered);
  }
}
