import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeEvent,
  ApeGoal,
  ApeGoalStatus,
  ApeMotivationalState,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

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
   * Creates an autonomous or shared goal, distinguishing desires from intentions.
   */
  public createGoal(params: {
    title: string;
    description: string;
    origin?: 'user' | 'autonomous' | 'shared';
    motivation: string;
    priority?: number;
    dependencies?: string[];
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
      priority: Math.max(0.0, Math.min(1.0, params.priority ?? 0.5)),
      status: params.status ?? 'active',
      progress: 0.0,
      dependencies: params.dependencies ?? [],
      relatedMemoryIds: [],
      createdAt: now,
      updatedAt: now,
    };

    state.goals.push(goal);
    this.saveState(state);
    this.logger.info(`New goal created [${goal.origin}, status=${goal.status}]: "${goal.title}" (Priority: ${goal.priority})`);
    return goal;
  }

  /**
   * Creates an early desired motivation (pre-commitment).
   */
  public createDesire(params: {
    title: string;
    description: string;
    origin?: 'autonomous' | 'shared' | 'user';
    motivation: string;
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
    this.saveState(state);
    this.logger.info(`Goal activated (intention -> execution): "${goal.title}"`);
    return true;
  }

  /**
   * Updates goal progress, potentially triggering completion or milestone.
   */
  public updateGoalProgress(goalId: string, progressDelta: number, newStatus?: ApeGoalStatus): ApeGoal | null {
    const state = this.getState();
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return null;

    goal.progress = Math.max(0.0, Math.min(1.0, Number((goal.progress + progressDelta).toFixed(3))));
    if (newStatus) {
      goal.status = newStatus;
    } else if (goal.progress >= 1.0) {
      goal.status = 'completed';
    }
    goal.updatedAt = new Date().toISOString();

    this.saveState(state);
    this.logger.info(`Goal '${goal.title}' progress: ${(goal.progress * 100).toFixed(1)}% [Status: ${goal.status}]`);
    return goal;
  }

  /**
   * Resolves competing motivations when multiple drives or goals collide.
   * Explicitly protects legitimate recreation from being suppressed by pure workaholism.
   */
  public resolveCompetingPriorities(): {
    selectedGoalId?: string;
    actionType: 'work' | 'recreation' | 'intimacy' | 'curiosity';
    justification: string;
  } {
    const state = this.getState();
    const needs = state.needs;
    const activeGoals = state.goals.filter((g) => g.status === 'active');

    // If recreation need is high (> 0.70), validate rest as legitimate autonomy
    if ((needs.recreation_rest ?? 0.4) > 0.70) {
      return {
        actionType: 'recreation',
        justification: 'Cognitive rest and recreation prioritized to maintain psychological equilibrium and prevent fatigue.',
      };
    }

    // If intimacy drive is very high (> 0.85), prioritize partner connection
    if ((needs.intimacy_connection ?? 0.7) > 0.85) {
      return {
        actionType: 'intimacy',
        justification: 'Interpersonal closeness and emotional connection with Proof (partner) take priority.',
      };
    }

    // Otherwise, choose highest priority active goal
    if (activeGoals.length > 0) {
      const sorted = [...activeGoals].sort((a, b) => b.priority - a.priority);
      const top = sorted[0];
      if (top) {
        return {
          selectedGoalId: top.id,
          actionType: 'work',
          justification: `Selected highest-priority active goal: "${top.title}".`,
        };
      }
    }

    return {
      actionType: 'curiosity',
      justification: 'No competing goals active; default to exploratory curiosity and analytical readiness.',
    };
  }
}
