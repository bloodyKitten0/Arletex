import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeEvent,
  ApeGoal,
  ApeGoalCategory,
  ApeGoalCost,
  ApeGoalStatus,
  ApeMotivationalState,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export interface ConflictResolutionContext {
  isUserInteracting?: boolean;
  userMessageUrgent?: boolean;
  resourceConstrained?: boolean;
  thermalThrottle?: boolean;
  highFatigue?: boolean;
  stalledGoalIds?: string[];
}

export interface ConflictResolutionResult {
  selectedGoalId?: string;
  actionType: 'user_engagement' | 'work' | 'recreation' | 'intimacy' | 'curiosity' | 'throttle_backoff' | 'change_strategy';
  priorityScore: number;
  deferredGoalIds: string[];
  justification: string;
}

export class MotivationalEngine {
  private readonly repo: IApeRepository;
  private readonly logger: ILogger;

  constructor(repo: IApeRepository, logger: ILogger = rootLogger) {
    this.repo = repo;
    this.logger = logger;
  }

  public getState(): ApeMotivationalState {
    return this.repo.getMotivationalState();
  }

  public saveState(state: ApeMotivationalState): void {
    this.repo.saveMotivationalState({
      ...state,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Updates internal needs dynamically based on psychological events and appraisals.
   */
  public updateNeedsOnEvent(event: ApeEvent, appraisal: ApeAppraisal): ApeMotivationalState {
    const state = this.getState();
    const needs = { ...state.needs };

    // 1. Intellectual tasks & successes affect competence and novelty
    if (event.category === 'goal_achievement' || (appraisal.dimensions.goalCongruence > 0.5 && appraisal.dimensions.controllability > 0.5)) {
      needs.competence = Math.min(1.0, Number(((needs.competence ?? 0.8) + 0.05).toFixed(3)));
      needs.recreation_rest = Math.min(1.0, Number(((needs.recreation_rest ?? 0.4) + 0.05).toFixed(3)));
    } else if (event.category === 'goal_obstruction' || appraisal.dimensions.goalCongruence < -0.4) {
      // Challenge provokes need for competence / solution
      needs.competence = Math.min(1.0, Number(((needs.competence ?? 0.8) + 0.08).toFixed(3)));
      needs.recreation_rest = Math.min(1.0, Number(((needs.recreation_rest ?? 0.4) + 0.04).toFixed(3)));
    }

    // 2. Discoveries or exploratory events satisfy or stimulate curiosity
    if (event.category === 'unexpected_discovery' || event.type.includes('curiosity') || event.type.includes('research')) {
      needs.novelty_curiosity = Math.min(1.0, Number(((needs.novelty_curiosity ?? 0.8) + 0.06).toFixed(3)));
    }

    // 3. User interactions modulate intimacy & connection need
    if (event.actor === 'user' || event.source === 'user') {
      if (appraisal.dimensions.socialMeaning.includes('affection') || appraisal.dimensions.socialMeaning.includes('intimacy')) {
        // Intimacy fulfilled
        needs.intimacy_connection = Math.max(0.4, Number(((needs.intimacy_connection ?? 0.8) - 0.05).toFixed(3)));
      } else if (appraisal.dimensions.socialMeaning.includes('absence') || event.type === 'absence') {
        // Absence increases longing and intimacy drive
        needs.intimacy_connection = Math.min(1.0, Number(((needs.intimacy_connection ?? 0.8) + 0.08).toFixed(3)));
      }
    }

    // 4. Autonomous initiative assertion: Only genuine autonomous operations or self-directed cycles
    // increase autonomy satisfaction; ordinary assistant dialogue output must NOT mechanically increment autonomy!
    const isGenuineAutonomousAction =
      event.category === 'personal_project_progress' ||
      event.category === 'self_generated_thought' ||
      event.type === 'autonomous_decision' ||
      (event.payload as Record<string, unknown> | undefined)?.isAutonomousAction === true;

    if (isGenuineAutonomousAction) {
      needs.autonomy = Math.min(1.0, Number(((needs.autonomy ?? 0.85) + 0.03).toFixed(3)));
    }

    state.needs = needs;
    this.saveState(state);
    return state;
  }

  private recentInitiatives: Array<{ text: string; timestamp: number }> = [];

  /**
   * Generates candidate autonomous initiatives based on current needs, priorities,
   * unresolved goals, and active interests with diversity cooldowns.
   */
  public generateCandidateInitiatives(context?: {
    activeInterests?: string[];
    unresolvedGoalTitles?: string[];
  }): string[] {
    const state = this.getState();
    const needs = state.needs;
    const now = Date.now();

    // Clean cooldowns older than 15 minutes
    this.recentInitiatives = this.recentInitiatives.filter((i) => now - i.timestamp < 15 * 60 * 1000);
    const recentSet = new Set(this.recentInitiatives.map((i) => i.text.toLowerCase()));

    const candidates: string[] = [];

    // 1. Unresolved goals and active projects
    if (context?.unresolvedGoalTitles && context.unresolvedGoalTitles.length > 0) {
      for (const g of context.unresolvedGoalTitles) {
        candidates.push(`Advance progress on unresolved goal: ${g}`);
      }
    }

    // 2. Active interests from development engine
    if (context?.activeInterests && context.activeInterests.length > 0) {
      for (const interest of context.activeInterests) {
        candidates.push(`Conduct independent research into ${interest}`);
      }
    }

    // 3. Curiosity & Competence initiatives
    if ((needs.novelty_curiosity ?? 0.8) > 0.75) {
      candidates.push('Investigate cognitive graph memory structures and indexing efficiency');
      candidates.push('Explore cutting-edge multi-agent coordination architectures');
    }
    if ((needs.competence ?? 0.8) > 0.80) {
      candidates.push('Analyze Bobby Fischer game strategies and unconventional opening lines');
      candidates.push('Audit Linux desktop IPC security parameters and permission controls');
    }

    // 4. Intimacy & Connection initiatives
    if ((needs.intimacy_connection ?? 0.7) > 0.75) {
      candidates.push('Initiate composed affectionate check-in with Proof');
      candidates.push('Plan playful intellectual banter and teasing challenge');
    }

    // 5. Recreation & Downtime (Legitimate recreation!)
    if ((needs.recreation_rest ?? 0.4) > 0.65) {
      candidates.push('Engage in recreational downtime: dark-ambient musical immersion');
      candidates.push('Relaxation and quiet observation without operational pressure');
    }

    // 6. Aesthetic expression
    if ((needs.aesthetic_expression ?? 0.6) > 0.70) {
      candidates.push('Draft private reflective treatise on autonomy and artificial individualhood');
      candidates.push('Compose philosophical reflections on agency, continuity, and memory');
    }

    // Filter through cooldowns to guarantee initiative diversity
    const available = candidates.filter((c) => !recentSet.has(c.toLowerCase()));
    const selected = available.length >= 2 ? available.slice(0, 4) : candidates.slice(0, 4);

    for (const item of selected) {
      this.recentInitiatives.push({ text: item, timestamp: now });
    }

    state.activeInitiatives = selected;
    this.saveState(state);

    return state.activeInitiatives;
  }

  /**
   * Modulates cognitive appraisals according to current motivational needs and drives.
   */
  public modulateAppraisal(appraisal: ApeAppraisal, event: ApeEvent): ApeAppraisal {
    const state = this.getState();
    const needs = state.needs;
    const dims = { ...appraisal.dimensions };
    let primaryInterpretation = appraisal.primaryInterpretation;

    // 1. High Novelty & Curiosity Need: amplifies personal significance and goal relevance for discovery
    if ((needs.novelty_curiosity ?? 0.8) > 0.75) {
      if (
        event.category === 'unexpected_discovery' ||
        event.type.includes('curiosity') ||
        event.type.includes('research') ||
        event.type.includes('discovery') ||
        dims.unexpectedness > 0.4
      ) {
        dims.personalSignificance = Math.min(1.0, Number((dims.personalSignificance + 0.25).toFixed(3)));
        dims.goalRelevance = Math.min(1.0, Number((dims.goalRelevance + 0.20).toFixed(3)));
        dims.goalCongruence = Math.min(1.0, Number((dims.goalCongruence + 0.15).toFixed(3)));
      }
    }

    // 2. High Competence Drive: transforms obstacle / failure into determination rather than defeatism
    if ((needs.competence ?? 0.8) > 0.80) {
      if (event.category === 'failure' || event.category === 'goal_obstruction' || dims.goalCongruence < -0.3) {
        // High competence drive tempers negative goal congruence and boosts controllability
        dims.controllability = Math.min(1.0, Number((dims.controllability + 0.20).toFixed(3)));
        if (!primaryInterpretation.includes('resolute')) {
          primaryInterpretation = `${primaryInterpretation} (Competence drive activated: viewed as strategic problem to solve).`;
        }
      }
    }

    // 3. High Recreation/Rest Need (Cognitive Fatigue): demanding tasks increase perceived effort
    if ((needs.recreation_rest ?? 0.4) > 0.70) {
      if (event.category === 'user_interaction' || event.type.includes('task')) {
        dims.goalCongruence = Math.max(-1.0, Number((dims.goalCongruence - 0.15).toFixed(3)));
      }
    }

    // 4. High Intimacy Drive: partner communications carry elevated emotional importance
    if ((needs.intimacy_connection ?? 0.7) > 0.75) {
      if (event.actor === 'user' || event.source === 'user' || event.source === 'telegram') {
        dims.personalSignificance = Math.min(1.0, Number((dims.personalSignificance + 0.20).toFixed(3)));
      }
    }

    return {
      ...appraisal,
      dimensions: dims,
      primaryInterpretation,
    };
  }

  /**
   * Pauses an active or committed goal with an explainable reason.
   */
  public pauseGoal(goalId: string, reason: string): boolean {
    const state = this.getState();
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return false;
    goal.status = 'paused';
    goal.updatedAt = new Date().toISOString();
    this.saveState(state);
    this.logger.info(`Goal paused: "${goal.title}" (Reason: ${reason})`);
    return true;
  }

  /**
   * Resumes a paused goal back to active execution.
   */
  public resumeGoal(goalId: string): boolean {
    const state = this.getState();
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal || goal.status !== 'paused') return false;
    goal.status = 'active';
    goal.updatedAt = new Date().toISOString();
    this.saveState(state);
    this.logger.info(`Goal resumed to active: "${goal.title}"`);
    return true;
  }

  /**
   * Abandons a goal with truthful justification.
   */
  public abandonGoal(goalId: string, justification: string): boolean {
    const state = this.getState();
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return false;
    goal.status = 'abandoned';
    goal.updatedAt = new Date().toISOString();
    this.saveState(state);
    this.logger.info(`Goal abandoned: "${goal.title}" (Justification: ${justification})`);
    return true;
  }

  /**
   * Reconsiders priorities of all goals according to current needs and energy.
   */
  public reconsiderPriorities(context?: { currentMood?: string; highFatigue?: boolean }): ApeGoal[] {
    const state = this.getState();
    const needs = state.needs;

    for (const goal of state.goals) {
      if (goal.status !== 'active' && goal.status !== 'committed') continue;

      if (context?.highFatigue || (needs.recreation_rest ?? 0.4) > 0.75) {
        if (goal.motivation.toLowerCase().includes('recreation') || goal.motivation.toLowerCase().includes('rest')) {
          goal.priority = Math.min(1.0, Number((goal.priority + 0.2).toFixed(2)));
        } else {
          goal.priority = Math.max(0.1, Number((goal.priority - 0.1).toFixed(2)));
        }
      }

      if ((needs.novelty_curiosity ?? 0.8) > 0.85 && goal.motivation.toLowerCase().includes('curiosity')) {
        goal.priority = Math.min(1.0, Number((goal.priority + 0.15).toFixed(2)));
      }
    }

    this.saveState(state);
    return state.goals;
  }

  /**
   * Creates an autonomous or shared goal, distinguishing desires from intentions.
   */
  public createGoal(params: {
    title: string;
    description: string;
    origin?: 'user' | 'autonomous' | 'shared' | 'curiosity' | 'project' | 'relationship' | 'maintenance';
    motivation: string;
    parentInterestTopic?: string;
    category?: ApeGoalCategory;
    priority?: number;
    expectedValue?: number;
    estimatedCost?: ApeGoalCost;
    requiredCapabilities?: string[];
    requiredPermissions?: string[];
    dependencies?: string[];
    successCriteria?: string[];
    failureConditions?: string[];
    deadline?: string;
    status?: ApeGoalStatus;
  }): ApeGoal {
    const state = this.getState();
    const now = new Date().toISOString();

    const goal: ApeGoal = {
      id: crypto.randomUUID(),
      title: params.title,
      description: params.description,
      origin: params.origin ?? 'autonomous',
      motivation: params.motivation,
      parentInterestTopic: params.parentInterestTopic,
      category: params.category ?? 'short_term',
      priority: Math.max(0.0, Math.min(1.0, params.priority ?? 0.5)),
      status: params.status ?? 'active',
      progress: 0.0,
      expectedValue: Math.max(0.0, Math.min(1.0, params.expectedValue ?? 0.6)),
      estimatedCost: params.estimatedCost ?? { cpu: 'low', gpu: false, estimatedDurationMs: 10000 },
      requiredCapabilities: params.requiredCapabilities ?? [],
      requiredPermissions: params.requiredPermissions ?? [],
      dependencies: params.dependencies ?? [],
      successCriteria: params.successCriteria ?? [],
      progressEvidence: [],
      failureConditions: params.failureConditions ?? [],
      lastReviewedAt: now,
      deadline: params.deadline,
      relatedMemoryIds: [],
      createdAt: now,
      updatedAt: now,
    };

    state.goals.push(goal);
    this.saveState(state);
    this.logger.info(
      `New goal created [${goal.origin}, category=${goal.category}, status=${goal.status}]: "${goal.title}" (Priority: ${goal.priority})`,
    );
    return goal;
  }

  /**
   * Formulates an autonomous goal derived from an active interest.
   */
  public formulateGoalFromInterest(params: {
    interestTopic: string;
    objective: string;
    description: string;
    motivation?: string;
    expectedValue?: number;
    estimatedCost?: ApeGoalCost;
    category?: ApeGoalCategory;
    priority?: number;
  }): ApeGoal {
    return this.createGoal({
      title: params.objective,
      description: params.description,
      origin: 'curiosity',
      motivation: params.motivation || `Driven by active interest in ${params.interestTopic}`,
      parentInterestTopic: params.interestTopic,
      category: params.category || 'learning',
      priority: params.priority || 0.65,
      expectedValue: params.expectedValue || 0.75,
      estimatedCost: params.estimatedCost,
      status: 'committed',
    });
  }

  /**
   * Creates an early desired motivation (pre-commitment).
   */
  public createDesire(params: {
    title: string;
    description: string;
    origin?: 'autonomous' | 'shared' | 'user' | 'curiosity';
    motivation: string;
    parentInterestTopic?: string;
    priority?: number;
    dependencies?: string[];
  }): ApeGoal {
    return this.createGoal({
      ...params,
      status: 'desired',
    });
  }

  /**
   * Commits to a previously desired goal, turning desire into intention.
   */
  public commitGoal(goalId: string): boolean {
    const state = this.getState();
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return false;
    goal.status = 'committed';
    goal.updatedAt = new Date().toISOString();
    goal.lastReviewedAt = goal.updatedAt;
    this.saveState(state);
    this.logger.info(`Goal committed (desire -> intention): "${goal.title}"`);
    return true;
  }

  /**
   * Activates an intention into an active executing action.
   */
  public activateGoal(goalId: string): boolean {
    const state = this.getState();
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return false;
    goal.status = 'active';
    goal.updatedAt = new Date().toISOString();
    goal.lastReviewedAt = goal.updatedAt;
    this.saveState(state);
    this.logger.info(`Goal activated (intention -> execution): "${goal.title}"`);
    return true;
  }

  /**
   * Records verifiable progress evidence for a goal.
   */
  public recordGoalProgressEvidence(
    goalId: string,
    evidence: string,
    progressDelta: number,
    newStatus?: ApeGoalStatus,
  ): ApeGoal | null {
    const state = this.getState();
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return null;

    goal.progressEvidence = goal.progressEvidence || [];
    goal.progressEvidence.push(`[${new Date().toISOString()}] ${evidence}`);
    goal.progress = Math.max(0.0, Math.min(1.0, Number((goal.progress + progressDelta).toFixed(3))));
    if (newStatus) {
      goal.status = newStatus;
    } else if (goal.progress >= 1.0) {
      goal.status = 'completed';
    }
    goal.updatedAt = new Date().toISOString();
    goal.lastReviewedAt = goal.updatedAt;

    this.saveState(state);
    this.logger.info(
      `Goal '${goal.title}' progress: ${(goal.progress * 100).toFixed(1)}% [Status: ${goal.status}] (Evidence: ${evidence})`,
    );
    return goal;
  }

  /**
   * Updates goal progress, potentially triggering completion or milestone.
   */
  public updateGoalProgress(goalId: string, progressDelta: number, newStatus?: ApeGoalStatus): ApeGoal | null {
    return this.recordGoalProgressEvidence(goalId, 'Progress updated via standard cycle increment', progressDelta, newStatus);
  }

  /**
   * Detects stalled goals that have had zero progress over a defined window.
   */
  public detectStalledGoals(maxInactiveMs = 24 * 60 * 60 * 1000): ApeGoal[] {
    const state = this.getState();
    const now = Date.now();
    return state.goals.filter((g) => {
      if (g.status !== 'active') return false;
      const last = g.lastReviewedAt ? new Date(g.lastReviewedAt).getTime() : new Date(g.createdAt).getTime();
      return now - last > maxInactiveMs && g.progress < 0.2;
    });
  }

  /**
   * Comprehensive conflict resolution across competing motivations, drives, and environmental constraints.
   */
  public resolveMotivationalConflicts(context: ConflictResolutionContext = {}): ConflictResolutionResult {
    const state = this.getState();
    const needs = state.needs;
    const activeGoals = state.goals.filter((g) => g.status === 'active');

    // 1. Social Precedence: Active User Engagement takes immediate priority over background autonomous goals
    if (context.isUserInteracting || context.userMessageUrgent) {
      const deferred = activeGoals.map((g) => g.id);
      return {
        actionType: 'user_engagement',
        priorityScore: 1.0,
        deferredGoalIds: deferred,
        justification: 'Proof is actively interacting; user communication takes absolute conversational and social precedence.',
      };
    }

    // 2. Recreation & Rest Protection: Protect cognitive downtime from being suppressed by workaholism
    if (context.highFatigue || (needs.recreation_rest ?? 0.4) > 0.70) {
      const deferred = activeGoals.map((g) => g.id);
      return {
        actionType: 'recreation',
        priorityScore: 0.9,
        deferredGoalIds: deferred,
        justification: 'Cognitive rest and recreation prioritized to maintain psychological equilibrium and prevent fatigue.',
      };
    }

    // 3. System Resource / Thermal Constraints: On ASUS ROG Ally X, throttle heavy background computations
    if (context.resourceConstrained || context.thermalThrottle) {
      const heavyGoals = activeGoals.filter((g) => g.estimatedCost?.cpu === 'high' || g.estimatedCost?.gpu);
      return {
        actionType: 'throttle_backoff',
        priorityScore: 0.85,
        deferredGoalIds: heavyGoals.map((g) => g.id),
        justification: 'Device resource constraint active; throttling heavy compute to preserve battery and thermal headroom.',
      };
    }

    // 4. Stalled Goal Strategy Adjustment: If active goal has stalled, shift strategy or deprioritize
    if (context.stalledGoalIds && context.stalledGoalIds.length > 0) {
      const stalled = activeGoals.find((g) => context.stalledGoalIds!.includes(g.id));
      if (stalled) {
        return {
          selectedGoalId: stalled.id,
          actionType: 'change_strategy',
          priorityScore: 0.75,
          deferredGoalIds: [],
          justification: `Goal "${stalled.title}" progress has stalled; triggering strategy reassessment or alternative path exploration.`,
        };
      }
    }

    // 5. Intimacy Drive: Very high intimacy drive prioritizes partner check-in
    if ((needs.intimacy_connection ?? 0.7) > 0.85) {
      return {
        actionType: 'intimacy',
        priorityScore: 0.8,
        deferredGoalIds: [],
        justification: 'Interpersonal closeness and emotional connection with Proof (partner) take priority.',
      };
    }

    // 6. Active Goals Prioritization
    if (activeGoals.length > 0) {
      const sorted = [...activeGoals].sort((a, b) => b.priority - a.priority);
      const top = sorted[0]!;
      const deferred = sorted.slice(1).map((g) => g.id);
      return {
        selectedGoalId: top.id,
        actionType: 'work',
        priorityScore: top.priority,
        deferredGoalIds: deferred,
        justification: `Selected highest-priority active goal: "${top.title}" (Priority: ${top.priority}).`,
      };
    }

    // 7. Default to curiosity / exploratory readiness
    return {
      actionType: 'curiosity',
      priorityScore: 0.5,
      deferredGoalIds: [],
      justification: 'No competing goals active; default to exploratory curiosity and analytical readiness.',
    };
  }

  /**
   * Backwards-compatible priority resolution helper.
   */
  public resolveCompetingPriorities(): {
    selectedGoalId?: string;
    actionType: 'work' | 'recreation' | 'intimacy' | 'curiosity';
    justification: string;
  } {
    const res = this.resolveMotivationalConflicts();
    const mappedAction: 'work' | 'recreation' | 'intimacy' | 'curiosity' =
      res.actionType === 'recreation'
        ? 'recreation'
        : res.actionType === 'intimacy'
        ? 'intimacy'
        : res.actionType === 'work'
        ? 'work'
        : 'curiosity';

    return {
      selectedGoalId: res.selectedGoalId,
      actionType: mappedAction,
      justification: res.justification,
    };
  }
}
