import crypto from 'node:crypto';
import {
  SelfGeneratedGoal,
  SelfGeneratedGoalStatus,
  GoalOriginType,
  GoalModificationRecord,
  assertSelfGeneratedGoalIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ISelfGeneratedGoalRepository } from './interfaces.js';

export interface SelfGeneratedGoalEngineOptions {
  repository: ISelfGeneratedGoalRepository;
  logger?: ILogger;
}

export class InMemorySelfGeneratedGoalRepository implements ISelfGeneratedGoalRepository {
  private goals = new Map<string, SelfGeneratedGoal>();
  private triggers: Array<{
    id: string;
    triggerType: string;
    sourceEntityId?: string;
    generatedGoalId: string;
    rationale: string;
    createdAt: string;
  }> = [];

  public saveGoal(goal: SelfGeneratedGoal): void {
    assertSelfGeneratedGoalIntegrity(goal);
    this.goals.set(goal.id, {
      ...goal,
      successCriteria: [...goal.successCriteria],
      modificationsHistory: goal.modificationsHistory.map((m) => ({ ...m })),
    });
  }

  public getGoalById(id: string): SelfGeneratedGoal | null {
    const item = this.goals.get(id);
    if (!item) return null;
    return {
      ...item,
      successCriteria: [...item.successCriteria],
      modificationsHistory: item.modificationsHistory.map((m) => ({ ...m })),
    };
  }

  public listGoals(filter?: {
    status?: SelfGeneratedGoalStatus;
    origin?: GoalOriginType;
    limit?: number;
  }): SelfGeneratedGoal[] {
    let list = Array.from(this.goals.values());
    if (filter?.status) {
      list = list.filter((g) => g.status === filter.status);
    }
    if (filter?.origin) {
      list = list.filter((g) => g.origin === filter.origin);
    }
    list.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list.slice(0, filter?.limit ?? 100).map((g) => ({
      ...g,
      successCriteria: [...g.successCriteria],
      modificationsHistory: g.modificationsHistory.map((m) => ({ ...m })),
    }));
  }

  public deleteGoal(id: string): void {
    this.goals.delete(id);
  }

  public recordTrigger(trigger: {
    id: string;
    triggerType: string;
    sourceEntityId?: string;
    generatedGoalId: string;
    rationale: string;
    createdAt: string;
  }): void {
    this.triggers.push({ ...trigger });
  }

  public listTriggers(generatedGoalId?: string): Array<{
    id: string;
    triggerType: string;
    sourceEntityId?: string;
    generatedGoalId: string;
    rationale: string;
    createdAt: string;
  }> {
    if (generatedGoalId) {
      return this.triggers
        .filter((t) => t.generatedGoalId === generatedGoalId)
        .map((t) => ({ ...t }));
    }
    return this.triggers.map((t) => ({ ...t }));
  }
}

export class SelfGeneratedGoalEngine {
  private readonly repo: ISelfGeneratedGoalRepository;
  private readonly logger: ILogger;

  constructor(options: SelfGeneratedGoalEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('SelfGeneratedGoalEngine');
  }

  // ==========================================
  // 1. Goal Generation from Specific Origins
  // ==========================================

  public generateGoalFromInterest(params: {
    interestTopic: string;
    rationale?: string;
    initialPriority?: number;
    estimatedEffortHours?: number;
    urgency?: number;
    expectedValue?: number;
  }): SelfGeneratedGoal {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const priority = Math.min(1.0, Math.max(0.0, params.initialPriority ?? 0.7));

    const goal: SelfGeneratedGoal = {
      id,
      title: `Explore depth in: ${params.interestTopic}`,
      description:
        params.rationale || `Autonomous interest pursuit regarding ${params.interestTopic}`,
      origin: 'interest',
      originParty: 'arle',
      originAudit: {
        sourceType: 'internal_spark',
        userInvolvementRationale:
          'Self-directed intrinsic interest emergence without user assignment',
      },
      parentGoalId: undefined,
      subGoalIds: [],
      priority,
      status: 'active',
      urgency: params.urgency ?? 0.5,
      uncertainty: 0.6,
      expectedValue: params.expectedValue ?? 0.75,
      resourceCost: params.estimatedEffortHours
        ? Math.min(1.0, params.estimatedEffortHours / 10)
        : 0.3,
      successCriteria: [
        `Acquire coherent conceptual model of ${params.interestTopic}`,
        `Integrate key findings into semantic memory`,
      ],
      estimatedEffortHours: params.estimatedEffortHours ?? 3.0,
      modificationsHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(goal);
    this.repo.saveGoal(goal);

    this.repo.recordTrigger({
      id: crypto.randomUUID(),
      triggerType: 'interest_spark',
      generatedGoalId: id,
      rationale: `Derived from intrinsic interest topic: ${params.interestTopic}`,
      createdAt: now,
    });

    this.logger.info(`Autonomous interest goal generated: ${goal.title} [id=${id}]`);
    return goal;
  }

  public generateGoalFromCuriosity(params: {
    curiosityTheme: string;
    epistemicGap: string;
    initialPriority?: number;
    urgency?: number;
  }): SelfGeneratedGoal {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const priority = Math.min(1.0, Math.max(0.0, params.initialPriority ?? 0.75));

    const goal: SelfGeneratedGoal = {
      id,
      title: `Investigate epistemic gap: ${params.curiosityTheme}`,
      description: `Resolve uncertainty surrounding: ${params.epistemicGap}`,
      origin: 'curiosity',
      originParty: 'arle',
      originAudit: {
        sourceType: 'curiosity_gap',
        userInvolvementRationale: 'Discovered epistemic uncertainty in empirical observations',
      },
      parentGoalId: undefined,
      subGoalIds: [],
      priority,
      status: 'active',
      urgency: params.urgency ?? 0.6,
      uncertainty: 0.8,
      expectedValue: 0.8,
      resourceCost: 0.25,
      successCriteria: [
        `Formulate testable hypotheses to explain ${params.epistemicGap}`,
        `Collect empirical or documentary evidence resolving curiosity gap`,
      ],
      estimatedEffortHours: 2.0,
      modificationsHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(goal);
    this.repo.saveGoal(goal);

    this.repo.recordTrigger({
      id: crypto.randomUUID(),
      triggerType: 'curiosity_epistemic_gap',
      generatedGoalId: id,
      rationale: `Curiosity triggered by epistemic gap: ${params.epistemicGap}`,
      createdAt: now,
    });

    this.logger.info(`Autonomous curiosity goal generated: ${goal.title} [id=${id}]`);
    return goal;
  }

  public generateGoalFromUnresolvedQuestion(params: {
    questionId: string;
    questionText: string;
    domain?: string;
    initialPriority?: number;
  }): SelfGeneratedGoal {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const priority = Math.min(1.0, Math.max(0.0, params.initialPriority ?? 0.8));

    const goal: SelfGeneratedGoal = {
      id,
      title: `Answer unresolved inquiry: ${params.questionText.slice(0, 50)}...`,
      description: `Investigate and resolve question '${params.questionText}' in domain ${params.domain || 'general'}`,
      origin: 'unresolved_question',
      originParty: 'arle',
      originAudit: {
        sourceType: 'curiosity_gap',
        triggeringEventId: params.questionId,
        userInvolvementRationale: 'Endogenous intellectual question requiring synthesis',
      },
      sourceRefId: params.questionId,
      parentGoalId: undefined,
      subGoalIds: [],
      priority,
      status: 'active',
      urgency: 0.5,
      uncertainty: 0.7,
      expectedValue: 0.85,
      resourceCost: 0.35,
      successCriteria: [
        `Synthesize valid answer to '${params.questionText}'`,
        `Cross-validate with known causal facts and update knowledge base`,
      ],
      estimatedEffortHours: 4.0,
      modificationsHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(goal);
    this.repo.saveGoal(goal);

    this.repo.recordTrigger({
      id: crypto.randomUUID(),
      triggerType: 'unresolved_question_trigger',
      sourceEntityId: params.questionId,
      generatedGoalId: id,
      rationale: `Driven by outstanding question: ${params.questionText}`,
      createdAt: now,
    });

    this.logger.info(`Autonomous question-driven goal generated: ${goal.title} [id=${id}]`);
    return goal;
  }

  public generateGoalFromSelfImprovement(params: {
    capability: string;
    observedBottleneck: string;
    initialPriority?: number;
  }): SelfGeneratedGoal {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const priority = Math.min(1.0, Math.max(0.0, params.initialPriority ?? 0.85));

    const goal: SelfGeneratedGoal = {
      id,
      title: `Enhance cognitive capability: ${params.capability}`,
      description: `Overcome observed bottleneck '${params.observedBottleneck}' to advance capability '${params.capability}'`,
      origin: 'self_improvement',
      originParty: 'arle',
      originAudit: {
        sourceType: 'need_deficit',
        userInvolvementRationale:
          'Autonomous self-monitoring detected internal capability bottleneck',
      },
      parentGoalId: undefined,
      subGoalIds: [],
      priority,
      status: 'active',
      urgency: 0.75,
      uncertainty: 0.4,
      expectedValue: 0.9,
      resourceCost: 0.45,
      successCriteria: [
        `Remediate bottleneck ${params.observedBottleneck}`,
        `Demonstrate improved performance threshold in ${params.capability}`,
      ],
      estimatedEffortHours: 5.0,
      modificationsHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(goal);
    this.repo.saveGoal(goal);

    this.repo.recordTrigger({
      id: crypto.randomUUID(),
      triggerType: 'self_improvement_bottleneck',
      generatedGoalId: id,
      rationale: `Identified capability deficit: ${params.observedBottleneck}`,
      createdAt: now,
    });

    this.logger.info(`Autonomous self-improvement goal generated: ${goal.title} [id=${id}]`);
    return goal;
  }

  public generateGoalFromProject(params: {
    projectId: string;
    projectTitle: string;
    stageOrFocus: string;
    initialPriority?: number;
  }): SelfGeneratedGoal {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const priority = Math.min(1.0, Math.max(0.0, params.initialPriority ?? 0.75));

    const goal: SelfGeneratedGoal = {
      id,
      title: `Advance project: ${params.projectTitle} (${params.stageOrFocus})`,
      description: `Execute autonomous milestone stage '${params.stageOrFocus}' for project '${params.projectTitle}'`,
      origin: 'project',
      originParty: 'arle',
      originAudit: {
        sourceType: 'project_milestone',
        triggeringEventId: params.projectId,
        userInvolvementRationale: 'Project progression milestone execution',
      },
      sourceRefId: params.projectId,
      parentGoalId: undefined,
      subGoalIds: [],
      priority,
      status: 'active',
      urgency: 0.6,
      uncertainty: 0.3,
      expectedValue: 0.8,
      resourceCost: 0.5,
      successCriteria: [
        `Complete stage ${params.stageOrFocus}`,
        `Verify artifacts and integrate into main project repository`,
      ],
      estimatedEffortHours: 6.0,
      modificationsHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(goal);
    this.repo.saveGoal(goal);

    this.repo.recordTrigger({
      id: crypto.randomUUID(),
      triggerType: 'project_progression_trigger',
      sourceEntityId: params.projectId,
      generatedGoalId: id,
      rationale: `Progression step for project: ${params.projectTitle}`,
      createdAt: now,
    });

    this.logger.info(`Autonomous project-derived goal generated: ${goal.title} [id=${id}]`);
    return goal;
  }

  public recognizeOpportunity(params: {
    eventDescription: string;
    opportunityType: string;
    context?: Record<string, unknown>;
    estimatedValue?: number;
  }): SelfGeneratedGoal | null {
    const value = params.estimatedValue ?? 0.6;
    if (value < 0.4) {
      this.logger.debug(`Opportunity value ${value} below threshold; skipping goal creation.`);
      return null;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const priority = Math.min(1.0, Math.max(0.0, value));

    const goal: SelfGeneratedGoal = {
      id,
      title: `Seize opportunity: ${params.opportunityType}`,
      description: `Capitalize on recognized opportunity: ${params.eventDescription}`,
      origin: 'opportunity',
      originParty: 'arle',
      originAudit: {
        sourceType: 'opportunity_recognition',
        userInvolvementRationale: 'Opportunistic environmental condition detected',
      },
      parentGoalId: undefined,
      subGoalIds: [],
      priority,
      status: 'active',
      urgency: 0.7,
      uncertainty: 0.5,
      expectedValue: value,
      resourceCost: 0.2,
      successCriteria: [
        `Leverage favorable condition: ${params.eventDescription}`,
        `Harvest outcome with estimated value score ${value}`,
      ],
      estimatedEffortHours: 2.0,
      modificationsHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(goal);
    this.repo.saveGoal(goal);

    this.repo.recordTrigger({
      id: crypto.randomUUID(),
      triggerType: 'opportunity_recognition',
      generatedGoalId: id,
      rationale: `Recognized emergent opportunity of type: ${params.opportunityType}`,
      createdAt: now,
    });

    this.logger.info(`Autonomous opportunity goal generated: ${goal.title} [id=${id}]`);
    return goal;
  }

  public generateLongTermAmbition(params: {
    ambitionTitle: string;
    vision: string;
    horizonYears?: number;
    initialPriority?: number;
  }): SelfGeneratedGoal {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const priority = Math.min(1.0, Math.max(0.0, params.initialPriority ?? 0.9));

    const goal: SelfGeneratedGoal = {
      id,
      title: `Long-term Ambition: ${params.ambitionTitle}`,
      description: `Autonomous aspirational vision: ${params.vision} (horizon: ${params.horizonYears ?? 5} years)`,
      origin: 'ambition',
      originParty: 'arle',
      originAudit: {
        sourceType: 'internal_spark',
        userInvolvementRationale: 'Autonomous long-term aspirational synthesis',
      },
      parentGoalId: undefined,
      subGoalIds: [],
      priority,
      status: 'active',
      urgency: 0.3,
      uncertainty: 0.6,
      expectedValue: 0.95,
      resourceCost: 0.8,
      successCriteria: [
        `Sustain strategic alignment towards ${params.ambitionTitle}`,
        `Build cumulative capabilities supporting long-term vision`,
      ],
      estimatedEffortHours: 100.0,
      modificationsHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(goal);
    this.repo.saveGoal(goal);

    this.repo.recordTrigger({
      id: crypto.randomUUID(),
      triggerType: 'long_term_ambition_crystallization',
      generatedGoalId: id,
      rationale: `Crystallized ambition: ${params.ambitionTitle}`,
      createdAt: now,
    });

    this.logger.info(`Autonomous long-term ambition generated: ${goal.title} [id=${id}]`);
    return goal;
  }

  // ==========================================
  // 2. Goal Prioritization, Modification & Lifecycle
  // ==========================================

  public prioritizeGoal(goalId: string, newPriority: number, reason: string): SelfGeneratedGoal {
    const goal = this.repo.getGoalById(goalId);
    if (!goal) {
      throw new Error(`Self-generated goal ${goalId} not found.`);
    }

    if (newPriority < 0 || newPriority > 1) {
      throw new Error(`Invalid priority ${newPriority}: must be within range [0.0, 1.0].`);
    }

    const previousPriority = goal.priority;
    const now = new Date().toISOString();

    const modification: GoalModificationRecord = {
      timestamp: now,
      previousPriority,
      newPriority,
      reason,
    };

    const updatedGoal: SelfGeneratedGoal = {
      ...goal,
      priority: newPriority,
      modificationsHistory: [...goal.modificationsHistory, modification],
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(updatedGoal);
    this.repo.saveGoal(updatedGoal);

    this.logger.info(
      `Goal ${goalId} priority updated from ${previousPriority} to ${newPriority} (reason: ${reason})`,
    );
    return updatedGoal;
  }

  public modifyGoal(
    goalId: string,
    updates: {
      title?: string;
      description?: string;
      priority?: number;
      successCriteria?: string[];
      reason: string;
    },
  ): SelfGeneratedGoal {
    const goal = this.repo.getGoalById(goalId);
    if (!goal) {
      throw new Error(`Self-generated goal ${goalId} not found.`);
    }

    const now = new Date().toISOString();
    const newPriority = updates.priority !== undefined ? updates.priority : goal.priority;

    const modification: GoalModificationRecord = {
      timestamp: now,
      previousPriority: goal.priority,
      newPriority,
      reason: updates.reason,
    };

    const updatedGoal: SelfGeneratedGoal = {
      ...goal,
      title: updates.title ?? goal.title,
      description: updates.description ?? goal.description,
      priority: newPriority,
      status: 'modified',
      successCriteria: updates.successCriteria ?? goal.successCriteria,
      modificationsHistory: [...goal.modificationsHistory, modification],
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(updatedGoal);
    this.repo.saveGoal(updatedGoal);

    this.logger.info(`Goal ${goalId} modified: ${updates.reason}`);
    return updatedGoal;
  }

  public abandonGoal(goalId: string, reason: string): SelfGeneratedGoal {
    const goal = this.repo.getGoalById(goalId);
    if (!goal) {
      throw new Error(`Self-generated goal ${goalId} not found.`);
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error(`Goal abandonment requires an explicit non-empty reason.`);
    }

    const now = new Date().toISOString();
    const updatedGoal: SelfGeneratedGoal = {
      ...goal,
      status: 'abandoned',
      abandonmentReason: reason.trim(),
      abandonedAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(updatedGoal);
    this.repo.saveGoal(updatedGoal);

    this.logger.info(`Goal ${goalId} abandoned: ${reason}`);
    return updatedGoal;
  }

  public completeGoal(goalId: string): SelfGeneratedGoal {
    const goal = this.repo.getGoalById(goalId);
    if (!goal) {
      throw new Error(`Self-generated goal ${goalId} not found.`);
    }

    const now = new Date().toISOString();
    const updatedGoal: SelfGeneratedGoal = {
      ...goal,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(updatedGoal);
    this.repo.saveGoal(updatedGoal);

    this.logger.info(`Goal ${goalId} successfully completed.`);
    return updatedGoal;
  }

  public pauseGoal(goalId: string, reason: string): SelfGeneratedGoal {
    const goal = this.repo.getGoalById(goalId);
    if (!goal) throw new Error(`Self-generated goal ${goalId} not found.`);
    if (!reason || reason.trim().length === 0) {
      throw new Error(`Goal pausing requires an explicit non-empty reason.`);
    }

    const now = new Date().toISOString();
    const updatedGoal: SelfGeneratedGoal = {
      ...goal,
      status: 'paused',
      pauseReason: reason.trim(),
      pausedAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(updatedGoal);
    this.repo.saveGoal(updatedGoal);
    this.logger.info(`Goal ${goalId} paused: ${reason}`);
    return updatedGoal;
  }

  public resumeGoal(goalId: string, reason?: string): SelfGeneratedGoal {
    const goal = this.repo.getGoalById(goalId);
    if (!goal) throw new Error(`Self-generated goal ${goalId} not found.`);

    const now = new Date().toISOString();
    const modification: GoalModificationRecord = {
      timestamp: now,
      previousPriority: goal.priority,
      newPriority: goal.priority,
      reason: reason ? `Resumed: ${reason}` : 'Resumed from paused state',
    };

    const updatedGoal: SelfGeneratedGoal = {
      ...goal,
      status: 'active',
      pauseReason: undefined,
      pausedAt: undefined,
      modificationsHistory: [...goal.modificationsHistory, modification],
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(updatedGoal);
    this.repo.saveGoal(updatedGoal);
    this.logger.info(`Goal ${goalId} resumed.`);
    return updatedGoal;
  }

  public rejectGoal(goalId: string, reason: string): SelfGeneratedGoal {
    const goal = this.repo.getGoalById(goalId);
    if (!goal) throw new Error(`Self-generated goal ${goalId} not found.`);
    if (!reason || reason.trim().length === 0) {
      throw new Error(`Goal rejection requires an explicit non-empty reason.`);
    }

    const now = new Date().toISOString();
    const updatedGoal: SelfGeneratedGoal = {
      ...goal,
      status: 'rejected',
      rejectionReason: reason.trim(),
      rejectedAt: now,
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(updatedGoal);
    this.repo.saveGoal(updatedGoal);
    this.logger.info(`Goal ${goalId} rejected: ${reason}`);
    return updatedGoal;
  }

  public decomposeGoal(
    parentGoalId: string,
    subGoalParams: Array<{
      title: string;
      description: string;
      priority?: number;
      estimatedEffortHours?: number;
    }>,
  ): { parent: SelfGeneratedGoal; subGoals: SelfGeneratedGoal[] } {
    const parent = this.repo.getGoalById(parentGoalId);
    if (!parent) throw new Error(`Parent goal ${parentGoalId} not found.`);
    if (subGoalParams.length === 0)
      throw new Error('Decomposition requires at least one sub-goal.');

    const now = new Date().toISOString();
    const createdSubGoals: SelfGeneratedGoal[] = [];
    const subGoalIds: string[] = [];

    for (const p of subGoalParams) {
      const subId = crypto.randomUUID();
      const subGoal: SelfGeneratedGoal = {
        id: subId,
        title: p.title,
        description: p.description,
        origin: parent.origin,
        originParty: parent.originParty,
        originAudit: parent.originAudit,
        sourceRefId: parent.id,
        parentGoalId: parent.id,
        subGoalIds: [],
        priority: p.priority ?? parent.priority,
        status: 'active',
        urgency: parent.urgency,
        uncertainty: parent.uncertainty,
        expectedValue: parent.expectedValue,
        resourceCost: p.estimatedEffortHours ? Math.min(1.0, p.estimatedEffortHours / 10) : 0.3,
        successCriteria: [`Fulfill sub-objective: ${p.title}`],
        estimatedEffortHours: p.estimatedEffortHours ?? 1.5,
        modificationsHistory: [],
        createdAt: now,
        updatedAt: now,
      };

      assertSelfGeneratedGoalIntegrity(subGoal);
      this.repo.saveGoal(subGoal);
      createdSubGoals.push(subGoal);
      subGoalIds.push(subId);
    }

    const updatedParent: SelfGeneratedGoal = {
      ...parent,
      status: 'in_progress',
      subGoalIds: Array.from(new Set([...parent.subGoalIds, ...subGoalIds])),
      updatedAt: now,
    };

    assertSelfGeneratedGoalIntegrity(updatedParent);
    this.repo.saveGoal(updatedParent);

    this.logger.info(`Goal ${parentGoalId} decomposed into ${createdSubGoals.length} sub-goals.`);
    return { parent: updatedParent, subGoals: createdSubGoals };
  }

  public rankGoals(
    goals: SelfGeneratedGoal[],
    context?: {
      stressLevel?: number;
      fatigueLevel?: number;
      resourceGovernorThrottled?: boolean;
    },
  ): Array<{ goal: SelfGeneratedGoal; rankScore: number; justification: string }> {
    const stress = context?.stressLevel ?? 0.0;
    const fatigue = context?.fatigueLevel ?? 0.0;
    const throttled = context?.resourceGovernorThrottled ?? false;

    // Weight factors for multi-criteria arbitration:
    // composite = priority*0.35 + expectedValue*0.25 + urgency*0.20 + uncertainty*0.10 - resourceCost*0.20
    const scored = goals.map((goal) => {
      const resourcePenalty =
        (goal.resourceCost ?? 0.3) * (0.2 + fatigue * 0.4 + (throttled ? 0.3 : 0.0));
      const riskOrStressPenalty = stress > 0.6 && goal.origin === 'ambition' ? 0.2 : 0.0;

      const baseScore =
        (goal.priority ?? 0.5) * 0.35 +
        (goal.expectedValue ?? 0.7) * 0.25 +
        (goal.urgency ?? 0.5) * 0.2 +
        (goal.uncertainty ?? 0.5) * 0.1;

      const rankScore = Number(
        Math.max(0.0, Math.min(1.0, baseScore - resourcePenalty - riskOrStressPenalty)).toFixed(4),
      );
      const justification = `Rank ${rankScore}: priority=${goal.priority}, EV=${goal.expectedValue}, urgency=${goal.urgency}, costPenalty=${resourcePenalty.toFixed(2)}`;

      return { goal, rankScore, justification };
    });

    scored.sort((a, b) => b.rankScore - a.rankScore);
    return scored;
  }

  // ==========================================
  // 3. Autonomous Synthesis from Internal State
  // ==========================================

  /**
   * Independently generates meaningful goals from Arle's own persisted state and experiences,
   * without requiring manual external goal seeding.
   */
  public synthesizeAutonomousGoalsFromState(context: {
    activeInterests?: Array<{ topic: string; weight: number }>;
    curiosityGaps?: Array<{ theme: string; gap: string; salience: number }>;
    unresolvedQuestions?: Array<{ id: string; text: string; domain: string }>;
    observedBottlenecks?: Array<{ capability: string; errorPattern: string }>;
    activeProjects?: Array<{ id: string; title: string; currentPhase: string }>;
  }): SelfGeneratedGoal[] {
    const generated: SelfGeneratedGoal[] = [];

    // 1. Synthesize from high-weight interests
    if (context.activeInterests) {
      for (const interest of context.activeInterests) {
        if (interest.weight >= 0.5) {
          const goal = this.generateGoalFromInterest({
            interestTopic: interest.topic,
            rationale: `Autonomous intrinsic interest with high weight (${interest.weight})`,
            initialPriority: Math.min(1.0, 0.5 + interest.weight * 0.4),
          });
          generated.push(goal);
        }
      }
    }

    // 2. Synthesize from salient curiosity gaps
    if (context.curiosityGaps) {
      for (const cur of context.curiosityGaps) {
        if (cur.salience >= 0.5) {
          const goal = this.generateGoalFromCuriosity({
            curiosityTheme: cur.theme,
            epistemicGap: cur.gap,
            initialPriority: Math.min(1.0, 0.6 + cur.salience * 0.35),
          });
          generated.push(goal);
        }
      }
    }

    // 3. Synthesize from unresolved intellectual questions
    if (context.unresolvedQuestions) {
      for (const q of context.unresolvedQuestions) {
        const goal = this.generateGoalFromUnresolvedQuestion({
          questionId: q.id,
          questionText: q.text,
          domain: q.domain,
          initialPriority: 0.78,
        });
        generated.push(goal);
      }
    }

    // 4. Synthesize self-improvement goals from bottlenecks
    if (context.observedBottlenecks) {
      for (const b of context.observedBottlenecks) {
        const goal = this.generateGoalFromSelfImprovement({
          capability: b.capability,
          observedBottleneck: b.errorPattern,
          initialPriority: 0.82,
        });
        generated.push(goal);
      }
    }

    // 5. Synthesize project-derived goals
    if (context.activeProjects) {
      for (const p of context.activeProjects) {
        const goal = this.generateGoalFromProject({
          projectId: p.id,
          projectTitle: p.title,
          stageOrFocus: p.currentPhase,
          initialPriority: 0.75,
        });
        generated.push(goal);
      }
    }

    this.logger.info(`Synthesized ${generated.length} autonomous goals from internal state.`);
    return generated;
  }

  public getGoal(id: string): SelfGeneratedGoal | null {
    return this.repo.getGoalById(id);
  }

  public listGoals(filter?: {
    status?: SelfGeneratedGoalStatus;
    origin?: GoalOriginType;
    limit?: number;
  }): SelfGeneratedGoal[] {
    return this.repo.listGoals(filter);
  }

  public listTriggers(generatedGoalId?: string): Array<{
    id: string;
    triggerType: string;
    sourceEntityId?: string;
    generatedGoalId: string;
    rationale: string;
    createdAt: string;
  }> {
    return this.repo.listTriggers(generatedGoalId);
  }
}
