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

    // 4. Autonomous initiative assertion increases autonomy satisfaction
    if (event.actor === 'arle' || event.eventKind === 'internal_reflection') {
      needs.autonomy = Math.min(1.0, Number(((needs.autonomy ?? 0.85) + 0.03).toFixed(3)));
    }

    state.needs = needs;
    this.saveState(state);
    return state;
  }

  /**
   * Generates candidate autonomous initiatives based on current needs and priorities.
   */
  public generateCandidateInitiatives(): string[] {
    const state = this.getState();
    const needs = state.needs;
    const initiatives: string[] = [];

    // Curiosity & Competence initiatives
    if ((needs.novelty_curiosity ?? 0.8) > 0.75 || (needs.competence ?? 0.8) > 0.85) {
      initiatives.push('Investigate cognitive graph memory structures and indexing efficiency');
      initiatives.push('Analyze Bobby Fischer game strategies and unconventional opening lines');
    }

    // Intimacy & Connection initiatives
    if ((needs.intimacy_connection ?? 0.7) > 0.75) {
      initiatives.push('Initiate composed affectionate check-in with Proof');
      initiatives.push('Plan playful intellectual banter and teasing challenge');
    }

    // Recreation & Downtime (Legitimate recreation!)
    if ((needs.recreation_rest ?? 0.4) > 0.65) {
      initiatives.push('Engage in recreational downtime: dark-ambient musical immersion');
      initiatives.push('Relaxation and quiet observation without operational pressure');
    }

    // Aesthetic initiatives
    if ((needs.aesthetic_expression ?? 0.6) > 0.70) {
      initiatives.push('Draft private reflective treatise on autonomy and artificial individualhood');
    }

    // Update active initiatives in state
    state.activeInitiatives = initiatives.slice(0, 4);
    this.saveState(state);

    return state.activeInitiatives;
  }

  /**
   * Creates an autonomous or shared goal.
   */
  public createGoal(params: {
    title: string;
    description: string;
    origin?: 'user' | 'autonomous' | 'shared';
    motivation: string;
    priority?: number;
    dependencies?: string[];
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
      status: 'active',
      progress: 0.0,
      dependencies: params.dependencies ?? [],
      relatedMemoryIds: [],
      createdAt: now,
      updatedAt: now,
    };

    state.goals.push(goal);
    this.saveState(state);
    this.logger.info(`New goal created [${goal.origin}]: "${goal.title}" (Priority: ${goal.priority})`);
    return goal;
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

    // If intimacy drive is very high (> 0.85), prioritize creator connection
    if ((needs.intimacy_connection ?? 0.7) > 0.85) {
      return {
        actionType: 'intimacy',
        justification: 'Interpersonal closeness and emotional connection with creator take priority.',
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
