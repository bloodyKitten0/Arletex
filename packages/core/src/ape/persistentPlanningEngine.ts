import crypto from 'node:crypto';
import {
  MultiStagePlan,
  MultiStagePlanStatus,
  PlanStageMilestone,
  PlanRevisionRecord,
  LongTermCommitment,
  LongTermCommitmentStatus,
  assertMultiStagePlanIntegrity,
  SelfGeneratedGoal,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IPersistentPlanningRepository } from './interfaces.js';

export interface PersistentPlanningEngineOptions {
  repository: IPersistentPlanningRepository;
  logger?: ILogger;
}

export class InMemoryPersistentPlanningRepository implements IPersistentPlanningRepository {
  private plans = new Map<string, MultiStagePlan>();
  private commitments = new Map<string, LongTermCommitment>();

  public savePlan(plan: MultiStagePlan): void {
    assertMultiStagePlanIntegrity(plan);
    this.plans.set(plan.id, {
      ...plan,
      stages: plan.stages.map((s) => ({ ...s, dependencies: [...s.dependencies] })),
      revisionsHistory: plan.revisionsHistory.map((r) => ({ ...r })),
      recoveryState: plan.recoveryState ? { ...plan.recoveryState } : undefined,
    });
  }

  public getPlanById(id: string): MultiStagePlan | null {
    const item = this.plans.get(id);
    if (!item) return null;
    return {
      ...item,
      stages: item.stages.map((s) => ({ ...s, dependencies: [...s.dependencies] })),
      revisionsHistory: item.revisionsHistory.map((r) => ({ ...r })),
      recoveryState: item.recoveryState ? { ...item.recoveryState } : undefined,
    };
  }

  public getPlanByGoalId(goalId: string): MultiStagePlan | null {
    const list = Array.from(this.plans.values()).filter((p) => p.goalId === goalId);
    if (list.length === 0) return null;
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const top = list[0]!;
    return {
      ...top,
      stages: top.stages.map((s) => ({ ...s, dependencies: [...s.dependencies] })),
      revisionsHistory: top.revisionsHistory.map((r) => ({ ...r })),
      recoveryState: top.recoveryState ? { ...top.recoveryState } : undefined,
    };
  }

  public listPlans(filter?: { status?: MultiStagePlanStatus; limit?: number }): MultiStagePlan[] {
    let list = Array.from(this.plans.values());
    if (filter?.status) {
      list = list.filter((p) => p.status === filter.status);
    }
    list.sort((a, b) => {
      if (b.overallPriority !== a.overallPriority) {
        return b.overallPriority - a.overallPriority;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list.slice(0, filter?.limit ?? 100).map((p) => ({
      ...p,
      stages: p.stages.map((s) => ({ ...s, dependencies: [...s.dependencies] })),
      revisionsHistory: p.revisionsHistory.map((r) => ({ ...r })),
      recoveryState: p.recoveryState ? { ...p.recoveryState } : undefined,
    }));
  }

  public deletePlan(id: string): void {
    this.plans.delete(id);
  }

  public saveCommitment(commitment: LongTermCommitment): void {
    this.commitments.set(commitment.id, { ...commitment });
  }

  public getCommitmentById(id: string): LongTermCommitment | null {
    const item = this.commitments.get(id);
    if (!item) return null;
    return { ...item };
  }

  public listCommitments(filter?: {
    stakeholder?: string;
    status?: LongTermCommitmentStatus;
    limit?: number;
  }): LongTermCommitment[] {
    let list = Array.from(this.commitments.values());
    if (filter?.stakeholder) {
      list = list.filter((c) => c.stakeholder === filter.stakeholder);
    }
    if (filter?.status) {
      list = list.filter((c) => c.status === filter.status);
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.slice(0, filter?.limit ?? 100).map((c) => ({ ...c }));
  }

  public deleteCommitment(id: string): void {
    this.commitments.delete(id);
  }
}

export class PersistentPlanningEngine {
  private readonly repo: IPersistentPlanningRepository;
  private readonly logger: ILogger;

  constructor(options: PersistentPlanningEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('PersistentPlanningEngine');
  }

  // ==========================================
  // 1. Goal Decomposition & Plan Formulation
  // ==========================================

  /**
   * Independently decomposes an autonomous self-generated goal into a multi-stage plan
   * with scheduled milestones, resource estimates, and DAG dependency linkages.
   */
  public decomposeGoalIntoPlan(
    goal:
      | SelfGeneratedGoal
      | {
          id: string;
          title: string;
          description: string;
          priority?: number;
          estimatedEffortHours?: number;
        },
  ): MultiStagePlan {
    const planId = crypto.randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();

    const effort = goal.estimatedEffortHours ?? 4.0;
    const stageDurationHours = Math.max(1.0, effort / 3.0);

    const s1Id = crypto.randomUUID();
    const s2Id = crypto.randomUUID();
    const s3Id = crypto.randomUUID();

    const stage1: PlanStageMilestone = {
      id: s1Id,
      stageIndex: 0,
      title: `Phase 1: Exploratory analysis & scoping for ${goal.title}`,
      description: `Investigate background domain, collect prerequisite data, and formalize specifications.`,
      resourceEstimate: {
        estimatedHours: Number(stageDurationHours.toFixed(1)),
        computeUnits: 1.0,
        requiredTools: ['codebase_search', 'read_file'],
      },
      dependencies: [],
      priority: Math.min(1.0, (goal.priority ?? 0.7) + 0.05),
      status: 'pending',
      progress: 0.0,
    };

    const stage2: PlanStageMilestone = {
      id: s2Id,
      stageIndex: 1,
      title: `Phase 2: Core synthesis & architecture execution for ${goal.title}`,
      description: `Construct essential models, run simulations or implementations, and calibrate outputs.`,
      resourceEstimate: {
        estimatedHours: Number((stageDurationHours * 1.5).toFixed(1)),
        computeUnits: 2.0,
        requiredTools: ['run_command', 'write_file'],
      },
      dependencies: [s1Id], // Depends strictly on Stage 1
      priority: goal.priority ?? 0.7,
      status: 'pending',
      progress: 0.0,
    };

    const stage3: PlanStageMilestone = {
      id: s3Id,
      stageIndex: 2,
      title: `Phase 3: Rigorous verification, reflection & partner synthesis`,
      description: `Evaluate criteria, verify negative invariants, reflect on outcome, and communicate results to Proof.`,
      resourceEstimate: {
        estimatedHours: Number((stageDurationHours * 0.8).toFixed(1)),
        computeUnits: 1.0,
        requiredTools: ['vitest_runner', 'partner_dialogue'],
      },
      dependencies: [s2Id], // Depends strictly on Stage 2
      priority: Math.min(1.0, (goal.priority ?? 0.7) + 0.1),
      status: 'pending',
      progress: 0.0,
    };

    const targetCompletion = new Date(now.getTime() + effort * 3600 * 1000).toISOString();

    const plan: MultiStagePlan = {
      id: planId,
      goalId: goal.id,
      title: `Multi-Stage Execution Plan: ${goal.title}`,
      description: `Autonomous staged operationalization for: ${goal.description}`,
      stages: [stage1, stage2, stage3],
      overallPriority: goal.priority ?? 0.7,
      overallProgress: 0.0,
      status: 'active',
      scheduledStart: nowIso,
      targetCompletion,
      revisionsHistory: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    assertMultiStagePlanIntegrity(plan);
    this.repo.savePlan(plan);
    this.logger.info(`Decomposed goal ${goal.id} into 3-stage plan [id=${planId}].`);
    return plan;
  }

  public createCustomPlan(params: {
    goalId: string;
    title: string;
    description: string;
    stages: PlanStageMilestone[];
    overallPriority?: number;
    scheduledStart?: string;
    targetCompletion?: string;
  }): MultiStagePlan {
    const planId = crypto.randomUUID();
    const now = new Date().toISOString();

    const plan: MultiStagePlan = {
      id: planId,
      goalId: params.goalId,
      title: params.title,
      description: params.description,
      stages: params.stages,
      overallPriority: params.overallPriority ?? 0.7,
      overallProgress: 0.0,
      status: 'active',
      scheduledStart: params.scheduledStart || now,
      targetCompletion: params.targetCompletion || now,
      revisionsHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    assertMultiStagePlanIntegrity(plan);
    this.repo.savePlan(plan);
    return plan;
  }

  // ==========================================
  // 2. Stage Execution & Progress Tracking
  // ==========================================

  public startStage(planId: string, stageId: string): MultiStagePlan {
    const plan = this.repo.getPlanById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found.`);

    const stage = plan.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error(`Stage ${stageId} not found in plan ${planId}.`);

    // Verify dependencies are completed
    for (const depId of stage.dependencies) {
      const depStage = plan.stages.find((s) => s.id === depId);
      if (!depStage || depStage.status !== 'completed') {
        throw new Error(
          `Cannot start stage ${stageId}: prerequisite stage ${depId} is not completed (status: ${depStage?.status}).`,
        );
      }
    }

    const now = new Date().toISOString();
    stage.status = 'in_progress';
    stage.startedAt = stage.startedAt || now;

    plan.status = 'in_progress';
    plan.updatedAt = now;

    assertMultiStagePlanIntegrity(plan);
    this.repo.savePlan(plan);
    this.logger.info(`Started stage ${stageId} of plan ${planId}.`);
    return plan;
  }

  public advanceStageProgress(
    planId: string,
    stageId: string,
    progress: number,
    checkpoint?: Record<string, unknown>,
  ): MultiStagePlan {
    const plan = this.repo.getPlanById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found.`);

    const stage = plan.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error(`Stage ${stageId} not found in plan ${planId}.`);

    if (progress < 0 || progress > 1) {
      throw new Error(`Invalid stage progress ${progress}: must be in range [0.0, 1.0].`);
    }

    stage.progress = progress;
    if (checkpoint) {
      stage.executionCheckpoint = checkpoint;
    }

    // Recompute overall plan progress
    const totalProgress = plan.stages.reduce((acc, s) => acc + s.progress, 0);
    plan.overallProgress = Number((totalProgress / plan.stages.length).toFixed(3));
    plan.updatedAt = new Date().toISOString();

    assertMultiStagePlanIntegrity(plan);
    this.repo.savePlan(plan);
    return plan;
  }

  public completeStage(planId: string, stageId: string): MultiStagePlan {
    const plan = this.repo.getPlanById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found.`);

    const stage = plan.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error(`Stage ${stageId} not found in plan ${planId}.`);

    const now = new Date().toISOString();
    stage.status = 'completed';
    stage.progress = 1.0;
    stage.completedAt = now;

    // Recompute overall plan progress
    const totalProgress = plan.stages.reduce((acc, s) => acc + s.progress, 0);
    plan.overallProgress = Number((totalProgress / plan.stages.length).toFixed(3));
    plan.updatedAt = now;

    const allFinished = plan.stages.every(
      (s) => s.status === 'completed' || s.status === 'skipped',
    );
    if (allFinished) {
      plan.status = 'completed';
      plan.overallProgress = 1.0;
      this.logger.info(`Multi-stage plan ${planId} fully accomplished!`);
    }

    assertMultiStagePlanIntegrity(plan);
    this.repo.savePlan(plan);
    return plan;
  }

  // ==========================================
  // 3. Interruption Handling & Task Recovery
  // ==========================================

  public handleInterruption(
    planId: string,
    stageId: string,
    reason: string,
    context?: Record<string, unknown>,
  ): MultiStagePlan {
    const plan = this.repo.getPlanById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found.`);

    const stage = plan.stages.find((s) => s.id === stageId);
    if (!stage) throw new Error(`Stage ${stageId} not found in plan ${planId}.`);

    const now = new Date().toISOString();
    stage.status = 'interrupted';
    stage.interruptedAt = now;
    stage.interruptionReason = reason;

    plan.status = 'interrupted';
    plan.recoveryState = {
      lastActiveStageId: stageId,
      interruptionTimestamp: now,
      recoveryContext: context || {},
    };
    plan.updatedAt = now;

    assertMultiStagePlanIntegrity(plan);
    this.repo.savePlan(plan);
    this.logger.warn(`Plan ${planId} stage ${stageId} interrupted: ${reason}`);
    return plan;
  }

  public recoverUnfinishedPlan(planId: string): MultiStagePlan {
    const plan = this.repo.getPlanById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found.`);

    if (!plan.recoveryState) {
      throw new Error(`Plan ${planId} does not possess an active recovery state.`);
    }

    const { lastActiveStageId } = plan.recoveryState;
    const stage = plan.stages.find((s) => s.id === lastActiveStageId);
    if (!stage) throw new Error(`Interrupted stage ${lastActiveStageId} not found.`);

    const now = new Date().toISOString();
    stage.status = 'in_progress';
    plan.status = 'in_progress';
    plan.recoveryState.resumedAt = now;
    plan.updatedAt = now;

    assertMultiStagePlanIntegrity(plan);
    this.repo.savePlan(plan);
    this.logger.info(
      `Successfully recovered unfinished stage ${lastActiveStageId} of plan ${planId}.`,
    );
    return plan;
  }

  // ==========================================
  // 4. Plan Revision
  // ==========================================

  public revisePlan(
    planId: string,
    updates: {
      newStages?: PlanStageMilestone[];
      priorityAdjustment?: number;
      reason: string;
    },
  ): MultiStagePlan {
    const plan = this.repo.getPlanById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found.`);

    const now = new Date().toISOString();
    const prevProgress = plan.overallProgress;

    let stagesAdded = 0;
    let stagesRemoved = 0;

    if (updates.newStages) {
      stagesAdded = Math.max(0, updates.newStages.length - plan.stages.length);
      stagesRemoved = Math.max(0, plan.stages.length - updates.newStages.length);
      plan.stages = updates.newStages;
    }

    if (updates.priorityAdjustment !== undefined) {
      plan.overallPriority = Math.min(
        1.0,
        Math.max(0.0, plan.overallPriority + updates.priorityAdjustment),
      );
    }

    const revision: PlanRevisionRecord = {
      revisionId: crypto.randomUUID(),
      revisedAt: now,
      reason: updates.reason,
      stagesAdded,
      stagesRemoved,
      previousProgress: prevProgress,
    };

    plan.status = 'revised';
    plan.revisionsHistory.push(revision);
    plan.updatedAt = now;

    // Recalculate progress with updated stages
    const totalProgress = plan.stages.reduce((acc, s) => acc + s.progress, 0);
    plan.overallProgress =
      plan.stages.length > 0 ? Number((totalProgress / plan.stages.length).toFixed(3)) : 0.0;

    assertMultiStagePlanIntegrity(plan);
    this.repo.savePlan(plan);
    this.logger.info(`Plan ${planId} revised: ${updates.reason}`);
    return plan;
  }

  // ==========================================
  // 5. Long-Term Commitment Management
  // ==========================================

  public registerCommitment(params: {
    title: string;
    stakeholder: string;
    promiseStatement: string;
    associatedPlanId?: string;
    dueTimestamp?: string;
  }): LongTermCommitment {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const commitment: LongTermCommitment = {
      id,
      title: params.title,
      stakeholder: params.stakeholder,
      promiseStatement: params.promiseStatement,
      associatedPlanId: params.associatedPlanId,
      dueTimestamp: params.dueTimestamp,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.repo.saveCommitment(commitment);
    this.logger.info(`Registered commitment ${id}: "${params.title}" for ${params.stakeholder}`);
    return commitment;
  }

  public fulfillCommitment(commitmentId: string, evidence: string): LongTermCommitment {
    const commitment = this.repo.getCommitmentById(commitmentId);
    if (!commitment) throw new Error(`Commitment ${commitmentId} not found.`);

    const now = new Date().toISOString();
    const updated: LongTermCommitment = {
      ...commitment,
      status: 'fulfilled',
      fulfillmentEvidence: evidence,
      updatedAt: now,
    };

    this.repo.saveCommitment(updated);
    this.logger.info(`Commitment ${commitmentId} fulfilled with evidence: ${evidence}`);
    return updated;
  }

  public renegotiateCommitment(
    commitmentId: string,
    newStatement: string,
    newDue?: string,
  ): LongTermCommitment {
    const commitment = this.repo.getCommitmentById(commitmentId);
    if (!commitment) throw new Error(`Commitment ${commitmentId} not found.`);

    const now = new Date().toISOString();
    const updated: LongTermCommitment = {
      ...commitment,
      promiseStatement: newStatement,
      dueTimestamp: newDue ?? commitment.dueTimestamp,
      status: 'renegotiated',
      updatedAt: now,
    };

    this.repo.saveCommitment(updated);
    this.logger.info(`Commitment ${commitmentId} renegotiated.`);
    return updated;
  }

  public evaluatePlanProgress(planId: string): {
    plan: MultiStagePlan;
    completedStages: number;
    remainingStages: number;
    isBlocked: boolean;
    canResume: boolean;
  } {
    const plan = this.repo.getPlanById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found.`);

    const completedStages = plan.stages.filter(
      (s) => s.status === 'completed' || s.status === 'skipped',
    ).length;
    const remainingStages = plan.stages.length - completedStages;
    const isBlocked = plan.stages.some((s) => s.status === 'interrupted');
    const canResume = Boolean(plan.recoveryState && plan.status === 'interrupted');

    return {
      plan,
      completedStages,
      remainingStages,
      isBlocked,
      canResume,
    };
  }

  public getPlan(id: string): MultiStagePlan | null {
    return this.repo.getPlanById(id);
  }

  public getPlanByGoalId(goalId: string): MultiStagePlan | null {
    return this.repo.getPlanByGoalId(goalId);
  }

  public listPlans(filter?: { status?: MultiStagePlanStatus; limit?: number }): MultiStagePlan[] {
    return this.repo.listPlans(filter);
  }

  public getCommitment(id: string): LongTermCommitment | null {
    return this.repo.getCommitmentById(id);
  }

  public listCommitments(filter?: {
    stakeholder?: string;
    status?: LongTermCommitmentStatus;
    limit?: number;
  }): LongTermCommitment[] {
    return this.repo.listCommitments(filter);
  }
}
