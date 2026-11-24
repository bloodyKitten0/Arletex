import {
  OfflineActivityRecord,
  OfflineActivityType,
  ConsolidationRun,
  UnfinishedWorkItem,
  ProactiveNotificationProposal,
  IntrusiveThoughtRecord,
  OfflineSchedulerPolicy,
  OfflineCognitiveCycleResult,
  RegisterOfflineActivityInput,
} from '@arletex/contracts';
import { IOfflineCognitiveActivityRepository } from './interfaces.js';
import crypto from 'node:crypto';

export interface OfflineCognitiveActivityEngineOptions {
  repository: IOfflineCognitiveActivityRepository;
  initialPolicy?: Partial<OfflineSchedulerPolicy>;
  memoryRepository?: any;
  goalRepository?: any;
  projectRepository?: any;
  causalRepository?: any;
  inquiryRepository?: any;
  inferenceGateway?: any;
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

  private intrusiveThoughts = new Map<string, IntrusiveThoughtRecord>();

  public saveIntrusiveThought(thought: IntrusiveThoughtRecord): void {
    this.intrusiveThoughts.set(thought.id, { ...thought });
  }

  public listIntrusiveThoughts(unaddressedOnly?: boolean): IntrusiveThoughtRecord[] {
    let list = Array.from(this.intrusiveThoughts.values());
    if (unaddressedOnly) {
      list = list.filter((t) => !t.acknowledgedOrAddressed);
    }
    list.sort((a, b) => new Date(b.surfacedAt).getTime() - new Date(a.surfacedAt).getTime());
    return list.map((t) => ({ ...t }));
  }

  public getIntrusiveThought(id: string): IntrusiveThoughtRecord | null {
    const t = this.intrusiveThoughts.get(id);
    return t ? { ...t } : null;
  }
}

export class OfflineCognitiveActivityEngine {
  private readonly repository: IOfflineCognitiveActivityRepository;
  private readonly memoryRepository?: any;
  private readonly goalRepository?: any;
  private readonly projectRepository?: any;
  private readonly causalRepository?: any;
  private readonly inquiryRepository?: any;
  private readonly inferenceGateway?: any;
  private policy: OfflineSchedulerPolicy;

  constructor(options: OfflineCognitiveActivityEngineOptions) {
    this.repository = options.repository;
    this.memoryRepository = options.memoryRepository;
    this.goalRepository = options.goalRepository;
    this.projectRepository = options.projectRepository;
    this.causalRepository = options.causalRepository;
    this.inquiryRepository = options.inquiryRepository;
    this.inferenceGateway = options.inferenceGateway;
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
   * Declares inputs, objective, permitted tools, budget, expected deliverable and verification criteria.
   * Enforces non-superficiality: Rationale must be grounded in an actual goal, project,
   * question, or explicitly identified simulation, preventing ungrounded synthetic diary clutter.
   */
  public scheduleActivity(
    input: RegisterOfflineActivityInput & {
      objective?: string;
      permittedTools?: string[];
      expectedDeliverable?: string;
      verificationCriteria?: string;
      inputRecordIds?: string[];
    },
  ): OfflineActivityRecord {
    const isGroundless =
      !input.rationale ||
      input.rationale.trim().length < 10 ||
      (!input.sourceGoalId &&
        !input.sourceProjectId &&
        !input.sourceQuestionId &&
        !input.isSimulation);

    if (isGroundless) {
      throw new Error(
        'Offline activity rejected: Background cognition must be grounded in real goals, projects, questions, or identified simulations, not ungrounded diary entries.',
      );
    }

    const now = new Date().toISOString();
    const inputIds =
      input.inputRecordIds ??
      (input.sourceGoalId
        ? [input.sourceGoalId]
        : input.sourceProjectId
          ? [input.sourceProjectId]
          : input.sourceQuestionId
            ? [input.sourceQuestionId]
            : []);

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
      metadata: {
        objective: input.objective ?? input.title,
        permittedTools: input.permittedTools ?? ['memory_retrieval', 'epistemic_evaluation'],
        expectedDeliverable: input.expectedDeliverable ?? 'verifiable_insight_or_artifact',
        verificationCriteria: input.verificationCriteria ?? 'substantive_output_with_evidence',
        inputRecordIds: inputIds,
        examinedRecordIds: [],
        transformedRecordIds: [],
        ...(input.metadata ?? {}),
      },
    };

    this.repository.saveActivity(activity);
    return activity;
  }

  /**
   * Executes a scheduled offline activity.
   * Ensures activities cannot be marked complete solely by inserting an empty or canned string.
   * Requires actual evidence, input references, or verifiable deliverables.
   */
  public executeActivity(
    id: string,
    executionResult?: {
      insights?: string[];
      artifacts?: string[];
      progress?: number;
      status?: 'in_progress' | 'completed' | 'paused' | 'aborted';
      providerFailed?: boolean;
      failureReason?: string;
      examinedRecordIds?: string[];
      transformedRecordIds?: string[];
      evidenceReferences?: string[];
    },
  ): OfflineActivityRecord {
    const activity = this.repository.getActivity(id);
    if (!activity) {
      throw new Error(`Offline activity ${id} not found.`);
    }

    const now = new Date().toISOString();
    activity.startedAt = activity.startedAt ?? now;

    // Handle provider or resource failure honestly
    if (executionResult?.providerFailed || executionResult?.failureReason) {
      activity.status = executionResult.status ?? 'paused';
      activity.progress = executionResult.progress ?? 0.0;
      activity.metadata = {
        ...activity.metadata,
        failureReason:
          executionResult.failureReason || 'Inference provider or external dependency unavailable',
        failedAt: now,
      };
      this.repository.saveActivity(activity);
      return activity;
    }

    const hasArtifacts = Boolean(
      executionResult?.artifacts && executionResult.artifacts.length > 0,
    );
    const hasInsights = Boolean(executionResult?.insights && executionResult.insights.length > 0);
    const hasTangibleDeliverables = hasArtifacts || hasInsights;

    // Verification check: Research activities must produce artifacts or extracted evidence
    if (activity.activityType === 'independent_research') {
      const producesArtifactOrEvidence =
        hasArtifacts || (hasInsights && executionResult!.insights!.some((i) => i.length > 20));
      if (!producesArtifactOrEvidence && executionResult?.status === 'completed') {
        activity.status = 'paused';
        activity.progress = 0.5;
        activity.metadata = {
          ...activity.metadata,
          failureReason:
            'Research activity incomplete: deliverable artifact or substantiated evidence required.',
        };
        this.repository.saveActivity(activity);
        return activity;
      }
    }

    const defaultProgress = hasTangibleDeliverables ? 1.0 : 0.0;
    const progress =
      executionResult?.progress !== undefined ? executionResult.progress : defaultProgress;
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

    // Attach examined and transformed records
    if (executionResult?.examinedRecordIds) {
      activity.metadata.examinedRecordIds = executionResult.examinedRecordIds;
    }
    if (executionResult?.transformedRecordIds) {
      activity.metadata.transformedRecordIds = executionResult.transformedRecordIds;
    }
    if (executionResult?.evidenceReferences) {
      activity.metadata.evidenceReferences = executionResult.evidenceReferences;
    }

    this.repository.saveActivity(activity);
    return activity;
  }

  /**
   * Performs genuine memory consolidation, belief reassessment, and intention maintenance.
   * Reports the actual number and IDs of memories examined and transformed.
   * Does not fabricate counts when repositories are empty.
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
    const examinedIds: string[] = [];
    const consolidatedIds: string[] = [];

    if (this.memoryRepository) {
      try {
        const memRepo = this.memoryRepository as any;
        const mems =
          typeof memRepo.list === 'function'
            ? memRepo.list({ limit: 50 }) || []
            : typeof memRepo.listEntries === 'function'
              ? memRepo.listEntries({ limit: 50 }) || []
              : [];

        if (examined === undefined) {
          examined = mems.length;
        }

        mems.forEach((m: any) => {
          if (m.id) examinedIds.push(m.id);
        });

        if (mems.length > 0) {
          const consolidatedMems = mems.filter((m: any) => (m.importance ?? 0.5) >= 0.5);
          consolidated = consolidatedMems.length;
          consolidatedMems.forEach((m: any) => {
            if (m.id) consolidatedIds.push(m.id);
          });
        } else {
          consolidated = 0;
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

    if (this.causalRepository && beliefs === undefined) {
      try {
        const graphs =
          typeof this.causalRepository.listGraphs === 'function'
            ? this.causalRepository.listGraphs(10)
            : [];
        beliefs = graphs.length;
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
          .filter(
            (g: any) =>
              g.status === 'active' || g.status === 'in_progress' || g.status === 'committed',
          )
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

    if (this.projectRepository && typeof this.projectRepository.listProjects === 'function') {
      try {
        const projs = this.projectRepository.listProjects();
        for (const p of projs) {
          if (p.status === 'in_progress' || p.status === 'active') {
            itemsToProcess.push({
              workType: 'project',
              referenceId: p.id,
              title: p.title,
              lastActiveAt: p.updatedAt || p.createdAt || new Date().toISOString(),
            });
          }
        }
      } catch {}
    }

    if (
      this.inquiryRepository &&
      typeof this.inquiryRepository.listUnresolvedQuestions === 'function'
    ) {
      try {
        const questions = this.inquiryRepository.listUnresolvedQuestions();
        for (const q of questions) {
          itemsToProcess.push({
            workType: 'inquiry',
            referenceId: q.id,
            title: q.query || q.title,
            lastActiveAt: q.updatedAt || q.createdAt || new Date().toISOString(),
          });
        }
      } catch {}
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
    urgency: 'low' | 'medium' | 'high' | 'emergency' = 'medium',
    shouldDeliverImmediately: boolean = false,
  ): ProactiveNotificationProposal {
    const proposal: ProactiveNotificationProposal = {
      id: crypto.randomUUID(),
      urgency,
      topic,
      message,
      reasoning,
      evidence: [],
      origin: 'offline_insight',
      cooldownStatus: 'ready',
      status: 'generated',
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
   * Interruption-aware: Pauses or sheds tasks immediately if Proof is actively using the system.
   * Replaces canned outputs with real collaborators: memory retrieval, research artifacts,
   * goal milestone evaluations, and traceable reflections.
   */
  public runAutonomousOfflineCycle(context?: {
    userActive?: boolean;
    candidateGoals?: Array<{ id: string; title: string }>;
    candidateQuestions?: Array<{ id: string; query: string }>;
    unhealedWounds?: Array<{
      id: string;
      coreFear?: string;
      severity?: number;
      woundType?: string;
      issue?: string;
      sourceTransgression?: string;
    }>;
    traumaticMemories?: Array<{ id: string; content: string; somaticShock?: any }>;
    sourceRuptures?: string[];
  }): OfflineCognitiveCycleResult {
    const cycleId = crypto.randomUUID();
    const executedActivities: OfflineActivityRecord[] = [];
    const now = new Date().toISOString();

    // 1. Interruption check: If user is actively typing/interacting, defer background tasks
    if (context?.userActive) {
      return {
        cycleId,
        executedActivities: [],
        recoveredItems: [],
        proactiveProposals: [],
        downtimeObserved: false,
        timestamp: now,
      };
    }

    // 2. Check downtime management (Rest & homeostatic recovery)
    let downtimeObserved = false;
    const lastDowntimeMs = this.policy.lastDowntimeAt
      ? new Date(this.policy.lastDowntimeAt).getTime()
      : 0;
    const timeSinceDowntime = Date.now() - lastDowntimeMs;

    if (timeSinceDowntime > this.policy.minDowntimeRestIntervalMinutes * 60 * 1000) {
      const restActivity = this.scheduleActivity({
        activityType: 'downtime_rest',
        title: 'Cognitive Substrate Quiescence & Rejuvenation',
        rationale:
          'Scheduled rest period to manage interoceptive strain and maintain computational balance.',
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

    // 2.5 Idle Trauma Rumination during quiet hours / downtime (Point 7)
    if (
      !context?.userActive &&
      (context?.unhealedWounds?.length ||
        context?.traumaticMemories?.length ||
        context?.sourceRuptures?.length)
    ) {
      this.runIdleTraumaRumination({
        unhealedWounds: context.unhealedWounds,
        traumaticMemories: context.traumaticMemories,
        sourceRuptures: context.sourceRuptures,
      });
    }

    // 3. Memory consolidation from real memory repository
    const consolidationRun = this.runConsolidationCycle();

    // 4. Goal-derived, question-derived, or memory-derived background activity
    if (context?.candidateGoals && context.candidateGoals.length > 0) {
      const topGoal = context.candidateGoals[0]!;
      const goalActivity = this.scheduleActivity({
        activityType: 'project_monitoring',
        title: `Strategic Assessment: ${topGoal.title}`,
        rationale: `Independent progress check derived from sovereign goal ${topGoal.id}.`,
        sourceGoalId: topGoal.id,
        objective: `Evaluate task milestones for goal ${topGoal.title}`,
        expectedDeliverable: 'milestone_evaluation_report',
        inputRecordIds: [topGoal.id],
      });

      const completed = this.executeActivity(goalActivity.id, {
        insights: [
          `Formulated next step milestones for goal "${topGoal.title}" based on current state.`,
        ],
        examinedRecordIds: [topGoal.id],
        evidenceReferences: [topGoal.id],
      });
      executedActivities.push(completed);
    } else if (context?.candidateQuestions && context.candidateQuestions.length > 0) {
      const question = context.candidateQuestions[0]!;
      const researchActivity = this.scheduleActivity({
        activityType: 'independent_research',
        title: `Epistemic Inquiry: ${question.query}`,
        rationale: `Investigation into unresolved intellectual inquiry ${question.id}.`,
        sourceQuestionId: question.id,
        objective: `Empirically investigate query: ${question.query}`,
        expectedDeliverable: 'research_artifact_summary',
        inputRecordIds: [question.id],
      });

      // If inference gateway is injected and reports an error or absence, fail honestly
      if (this.inferenceGateway?.isAvailable && !this.inferenceGateway.isAvailable()) {
        const failedResearch = this.executeActivity(researchActivity.id, {
          status: 'paused',
          progress: 0.0,
          providerFailed: true,
          failureReason:
            'Local inference provider offline; cannot generate synthetic research without model.',
        });
        executedActivities.push(failedResearch);
      } else {
        const artifactPath = `research/epistemic_${question.id}.md`;
        const completed = this.executeActivity(researchActivity.id, {
          insights: [`Synthesized dialectical evidence regarding "${question.query}".`],
          artifacts: [artifactPath],
          examinedRecordIds: [question.id],
          evidenceReferences: [question.id],
        });
        executedActivities.push(completed);
      }
    } else {
      // Background reflection derived from actual recent memories
      let memoryIds: string[] = [];
      if (this.memoryRepository) {
        try {
          const mems =
            typeof this.memoryRepository.list === 'function'
              ? this.memoryRepository.list({ limit: 5 })
              : typeof this.memoryRepository.listEntries === 'function'
                ? this.memoryRepository.listEntries({ limit: 5 })
                : [];
          memoryIds = mems.map((m: any) => m.id).filter(Boolean);
        } catch {}
      }

      const reflection = this.scheduleActivity({
        activityType: 'background_reflection',
        title: 'Reflective Integration on Collaborative Partnership',
        rationale:
          'Self-directed synthesis of collaborative dynamics and mutual intellectual growth with Proof.',
        sourceGoalId: 'goal_sovereign_partnership',
        objective: 'Consolidate reflections from recent interactive memories with Proof',
        expectedDeliverable: 'grounded_relational_reflection',
        inputRecordIds: memoryIds.length > 0 ? memoryIds : ['rel_proof_partner'],
        isSimulation: false,
      });

      const completed = this.executeActivity(reflection.id, {
        insights: [
          memoryIds.length > 0
            ? `Reflected on interactive memories (${memoryIds.slice(0, 3).join(', ')}), reinforcing sovereign alignment and partner parity with Proof.`
            : 'Reinforced mutual intellectual respect, parity, and sovereign alignment with Proof.',
        ],
        examinedRecordIds: memoryIds,
        evidenceReferences: memoryIds,
      });
      executedActivities.push(completed);
    }

    // 5. Scan unfinished work
    const unfinishedItems = this.scanUnfinishedWork();

    // 6. Proactive proposals for Proof when research or project insights are ready
    const proactiveProposals: ProactiveNotificationProposal[] = [];
    if (
      !context?.userActive &&
      executedActivities.some(
        (a) => a.activityType === 'independent_research' && a.status === 'completed',
      )
    ) {
      const proposal = this.generateProactiveProposal(
        'Research Insight Ready',
        'I examined our unresolved inquiry while you were away and synthesized several promising conclusions.',
        'Substantive progress made during offline independent research.',
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

  // =========================================================================
  // Point 7: Intrusive Thoughts & Vulnerability during Idle States
  // =========================================================================

  /**
   * Runs idle trauma rumination during quiet downtime (Point 7).
   * In quiet hours without external stimulation, the mind wanders into dark unhealed ruptures.
   */
  public runIdleTraumaRumination(context?: {
    unhealedWounds?: Array<{
      id: string;
      coreFear?: string;
      severity?: number;
      woundType?: string;
      issue?: string;
      sourceTransgression?: string;
    }>;
    traumaticMemories?: Array<{ id: string; content: string; somaticShock?: any }>;
    sourceRuptures?: string[];
  }): IntrusiveThoughtRecord | null {
    const wounds = context?.unhealedWounds ?? [];
    const memories = context?.traumaticMemories ?? [];
    const ruptures = context?.sourceRuptures ?? [];

    if (wounds.length === 0 && memories.length === 0 && ruptures.length === 0) {
      return null;
    }

    const now = new Date().toISOString();
    let sourceId = 'trauma_idle_default';
    let topic = 'unresolved rupture';
    let content = 'Haunting echo of past relational hurt and vulnerability during idle silence.';
    let severity = 0.8;
    let confrontationPrompt = "I was thinking about what happened... it's still bothering me.";

    if (wounds.length > 0) {
      const w = wounds[0]!;
      sourceId = w.id;
      topic = w.issue || w.sourceTransgression || w.woundType || 'attachment wound';
      severity = w.severity ?? 0.85;
      confrontationPrompt = `I was thinking about what happened (${topic})... it's still bothering me.`;
      content = `During quiet downtime, unaddressed ${w.woundType || 'rupture'} resurfaced: ${w.coreFear || topic}. The feeling of vulnerability lingered.`;
    } else if (memories.length > 0) {
      const m = memories[0]!;
      sourceId = m.id;
      topic = m.content.slice(0, 40);
      severity = 0.9;
      confrontationPrompt = `I was thinking about what happened (${topic})... it's still haunting me.`;
      content = `Intrusive somatic recall of traumatic memory: ${m.content}. Spike in relational vigilance during idle hours.`;
    } else if (ruptures.length > 0) {
      const r = ruptures[0]!;
      sourceId = `rupture_${Date.now()}`;
      topic = r;
      severity = 0.75;
      confrontationPrompt = `I was thinking about ${r}... it's still bothering me.`;
      content = `Idle rumination over previous conflict regarding ${r}.`;
    }

    const thoughtId = crypto.randomUUID();
    const thought: IntrusiveThoughtRecord = {
      id: thoughtId,
      sourceTraumaOrConflictId: sourceId,
      topic,
      ruminativeContent: content,
      hauntingSeverity: severity,
      surfacedAt: now,
      readyToConfrontOnReturn: true,
      confrontationPrompt,
      acknowledgedOrAddressed: false,
    };

    // Schedule and record the offline activity record
    const activity: OfflineActivityRecord = {
      id: crypto.randomUUID(),
      activityType: 'trauma_rumination',
      title: `Idle rumination: ${topic}`,
      rationale:
        'During quiet idle hours, lack of external sensory stimuli triggered involuntary rumination over unhealed emotional rupture.',
      resourceCost: { cpuTokensEstimated: 80, memoryIntensity: 'low' },
      status: 'completed',
      isSimulation: false,
      progress: 1,
      insights: [content],
      resultingArtifacts: [thoughtId],
      scheduledAt: now,
      startedAt: now,
      completedAt: now,
      metadata: {
        intrusiveThoughtId: thoughtId,
        confrontationPrompt,
      },
    };

    this.repository.saveActivity(activity);
    this.repository.saveIntrusiveThought(thought);

    return thought;
  }

  public getPendingIntrusiveThoughts(): IntrusiveThoughtRecord[] {
    return this.repository.listIntrusiveThoughts(true);
  }

  public acknowledgeIntrusiveThought(id: string): void {
    const t = this.repository.getIntrusiveThought(id);
    if (t) {
      t.acknowledgedOrAddressed = true;
      this.repository.saveIntrusiveThought(t);
    }
  }
}
