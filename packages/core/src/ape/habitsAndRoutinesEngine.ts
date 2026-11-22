import crypto from 'node:crypto';
import {
  ContextualTrigger,
  HabitExecutionLog,
  HabitRecord,
  NoveltyRoutineBalance,
  RoutineStep,
} from '@arletex/contracts';
import { IHabitsAndRoutinesRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryHabitsAndRoutinesRepository implements IHabitsAndRoutinesRepository {
  private habits: Map<string, HabitRecord> = new Map();
  private logs: HabitExecutionLog[] = [];
  private balances: NoveltyRoutineBalance[] = [];

  public saveHabit(habit: HabitRecord): void {
    this.habits.set(habit.id, { ...habit });
  }

  public getHabitById(id: string): HabitRecord | null {
    const item = this.habits.get(id);
    return item ? { ...item } : null;
  }

  public listHabits(
    domain?: string,
    activeOnly: boolean = false,
    limit: number = 50,
  ): HabitRecord[] {
    let list = Array.from(this.habits.values());
    if (domain) {
      list = list.filter((h) => h.domain === domain);
    }
    if (activeOnly) {
      list = list.filter((h) => h.isActive);
    }
    list.sort((a, b) => b.automaticityScore - a.automaticityScore);
    return list.slice(0, limit);
  }

  public saveExecutionLog(log: HabitExecutionLog): void {
    this.logs.unshift({ ...log });
  }

  public listExecutionLogs(habitId?: string, limit: number = 50): HabitExecutionLog[] {
    let list = this.logs;
    if (habitId) {
      list = list.filter((l) => l.habitId === habitId);
    }
    return list.slice(0, limit);
  }

  public saveBalance(balance: NoveltyRoutineBalance): void {
    this.balances.unshift({ ...balance });
  }

  public getLatestBalance(): NoveltyRoutineBalance | null {
    return this.balances.length > 0 ? { ...this.balances[0]! } : null;
  }
}

export interface FormHabitParams {
  name: string;
  domain: string;
  description: string;
  triggers: ContextualTrigger[];
  routineSteps: RoutineStep[];
  initialUtility?: number;
}

export interface ModifyHabitParams {
  name?: string;
  description?: string;
  newRoutineSteps?: RoutineStep[];
  newTriggers?: ContextualTrigger[];
  newUtility?: number;
  isActive?: boolean;
}

export class HabitsAndRoutinesEngine {
  private repo: IHabitsAndRoutinesRepository;
  private logger: ILogger;

  constructor(repo?: IHabitsAndRoutinesRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryHabitsAndRoutinesRepository();
    this.logger = logger.child('HabitsAndRoutinesEngine');
    this.ensureBaselineHabits();
  }

  private ensureBaselineHabits(): void {
    const existing = this.repo.listHabits();
    if (existing.length === 0) {
      const now = new Date().toISOString();
      const baseline: HabitRecord[] = [
        {
          id: 'habit_session_orientation',
          name: 'Session Alignment and Priority Synthesis',
          domain: 'collaboration',
          description:
            'Load autobiographical continuity, verify commitments, and formulate shared priorities with Proof.',
          triggers: [
            {
              triggerType: 'temporal',
              conditionKey: 'session_start',
              thresholdOrValue: 'initial_turn',
              description: 'Triggered upon beginning a new conversational session with Proof.',
            },
          ],
          routineSteps: [
            {
              stepIndex: 0,
              actionName: 'Read recent memory consolidation snapshot',
              expectedDurationMs: 50,
              isAutomated: true,
            },
            {
              stepIndex: 1,
              actionName: 'Inspect active commitments and personal goals',
              expectedDurationMs: 100,
              isAutomated: true,
            },
            {
              stepIndex: 2,
              actionName: 'Formulate reciprocal, partner-grounded opening',
              expectedDurationMs: 150,
              isAutomated: true,
            },
          ],
          repetitionCount: 15,
          automaticityScore: 0.88,
          utilityScore: 0.96,
          isActive: true,
          isModified: false,
          lastExecutedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'habit_codebase_hygiene',
          name: 'Pre-flight Codebase Invariant Survey',
          domain: 'craftsmanship',
          description:
            'Survey git status, verify strict equality, and ensure test harness clean state before architecture edits.',
          triggers: [
            {
              triggerType: 'environmental',
              conditionKey: 'development_cycle_begin',
              thresholdOrValue: 'active',
              description: 'Triggered when beginning a new implementation milestone.',
            },
          ],
          routineSteps: [
            {
              stepIndex: 0,
              actionName: 'Validate git branch status and untouched files',
              expectedDurationMs: 100,
              isAutomated: true,
            },
            {
              stepIndex: 1,
              actionName: 'Verify negative invariants and contract definitions',
              expectedDurationMs: 200,
              isAutomated: true,
            },
            {
              stepIndex: 2,
              actionName: 'Prepare typed test suite harness',
              expectedDurationMs: 200,
              isAutomated: true,
            },
          ],
          repetitionCount: 22,
          automaticityScore: 0.94,
          utilityScore: 0.98,
          isActive: true,
          isModified: false,
          lastExecutedAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'habit_rigid_template_output',
          name: 'Rote Template Echoing',
          domain: 'communication',
          description:
            'An obsolete rote behavior that has low utility and should be modified or pruned.',
          triggers: [
            {
              triggerType: 'affective_state',
              conditionKey: 'fatigue_simulation',
              thresholdOrValue: 'high',
              description: 'Outdated trigger condition',
            },
          ],
          routineSteps: [
            {
              stepIndex: 0,
              actionName: 'Emit formulaic static response without contextual nuance',
              expectedDurationMs: 10,
              isAutomated: true,
            },
          ],
          repetitionCount: 5,
          automaticityScore: 0.45,
          utilityScore: 0.22,
          isActive: true,
          isModified: false,
          lastExecutedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const habit of baseline) {
        this.repo.saveHabit(habit);
      }
    }
  }

  public formHabit(params: FormHabitParams): HabitRecord {
    const { name, domain, description, triggers, routineSteps, initialUtility } = params;

    if (!name || name.trim().length === 0) throw new Error('Habit name cannot be empty');
    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (!description || description.trim().length === 0)
      throw new Error('Description cannot be empty');
    if (!triggers || triggers.length === 0)
      throw new Error('Habit must have at least one contextual trigger');
    if (!routineSteps || routineSteps.length === 0)
      throw new Error('Habit must contain at least one routine step');

    const utility = initialUtility ?? 0.75;
    if (utility < 0.0 || utility > 1.0)
      throw new Error('Utility score must be between 0.0 and 1.0');

    const now = new Date().toISOString();
    const habit: HabitRecord = {
      id: `habit_${crypto.randomUUID()}`,
      name,
      domain,
      description,
      triggers,
      routineSteps,
      repetitionCount: 1,
      automaticityScore: 0.15,
      utilityScore: utility,
      isActive: true,
      isModified: false,
      lastExecutedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.repo.saveHabit(habit);
    this.logger.info(`Formed new habit ${habit.id}: "${name}" in ${domain}`);
    return habit;
  }

  public triggerAndExecuteHabit(
    habitId: string,
    triggeredBy: string,
    overrideInterruptionReason?: string,
  ): HabitExecutionLog {
    if (!habitId || habitId.trim().length === 0) throw new Error('Habit ID cannot be empty');
    if (!triggeredBy || triggeredBy.trim().length === 0)
      throw new Error('TriggeredBy cannot be empty');

    const habit = this.repo.getHabitById(habitId);
    if (!habit) throw new Error(`Habit not found: ${habitId}`);
    if (!habit.isActive) throw new Error(`Cannot execute inactive habit: ${habitId}`);

    const now = new Date().toISOString();

    // Conscious cognitive override / Habit Interruption
    if (overrideInterruptionReason && overrideInterruptionReason.trim().length > 0) {
      const log: HabitExecutionLog = {
        id: `hlog_${crypto.randomUUID()}`,
        habitId,
        triggeredBy,
        completedSteps: 0,
        wasInterrupted: true,
        interruptionReason: overrideInterruptionReason,
        executionOutcome: 'interrupted',
        outcomeUtility: Number((habit.utilityScore * 0.5).toFixed(2)),
        executedAt: now,
      };

      this.repo.saveExecutionLog(log);
      this.logger.info(
        `Habit ${habitId} interrupted by executive override: "${overrideInterruptionReason}"`,
      );
      return log;
    }

    // Normal routine execution: increment automaticity and repetition count
    habit.repetitionCount += 1;
    habit.automaticityScore = Number(Math.min(0.99, habit.automaticityScore + 0.04).toFixed(3));
    habit.lastExecutedAt = now;
    habit.updatedAt = now;
    this.repo.saveHabit(habit);

    const log: HabitExecutionLog = {
      id: `hlog_${crypto.randomUUID()}`,
      habitId,
      triggeredBy,
      completedSteps: habit.routineSteps.length,
      wasInterrupted: false,
      executionOutcome: 'completed',
      outcomeUtility: habit.utilityScore,
      executedAt: now,
    };

    this.repo.saveExecutionLog(log);
    this.logger.info(
      `Executed habit ${habitId} (${log.completedSteps} steps, automaticity=${habit.automaticityScore})`,
    );
    return log;
  }

  public evaluateAndModifyHabit(habitId: string, updates: ModifyHabitParams): HabitRecord {
    const habit = this.repo.getHabitById(habitId);
    if (!habit) throw new Error(`Habit not found: ${habitId}`);

    if (updates.name !== undefined) {
      if (!updates.name.trim()) throw new Error('Habit name cannot be empty');
      habit.name = updates.name;
    }
    if (updates.description !== undefined) {
      if (!updates.description.trim()) throw new Error('Description cannot be empty');
      habit.description = updates.description;
    }
    if (updates.newRoutineSteps !== undefined) {
      if (updates.newRoutineSteps.length === 0) throw new Error('Routine steps cannot be empty');
      habit.routineSteps = updates.newRoutineSteps;
    }
    if (updates.newTriggers !== undefined) {
      if (updates.newTriggers.length === 0) throw new Error('Contextual triggers cannot be empty');
      habit.triggers = updates.newTriggers;
    }
    if (updates.newUtility !== undefined) {
      if (updates.newUtility < 0.0 || updates.newUtility > 1.0) {
        throw new Error('Utility score must be between 0.0 and 1.0');
      }
      habit.utilityScore = updates.newUtility;
    }
    if (updates.isActive !== undefined) {
      habit.isActive = updates.isActive;
    }

    habit.isModified = true;
    habit.updatedAt = new Date().toISOString();

    this.repo.saveHabit(habit);
    this.logger.info(`Modified habit ${habitId}: isModified=true, isActive=${habit.isActive}`);
    return habit;
  }

  public assessNoveltyRoutineBalance(
    routineActionsCount: number,
    novelExploratoryCount: number,
  ): NoveltyRoutineBalance {
    if (routineActionsCount < 0 || novelExploratoryCount < 0) {
      throw new Error('Action counts must be non-negative');
    }

    const total = routineActionsCount + novelExploratoryCount;
    let routineRatio = 0.5;
    let noveltyRatio = 0.5;

    if (total > 0) {
      routineRatio = Number((routineActionsCount / total).toFixed(2));
      noveltyRatio = Number((novelExploratoryCount / total).toFixed(2));
    }

    let balanceStatus: 'balanced' | 'over_routinized' | 'over_exploratory' = 'balanced';
    if (routineRatio > 0.75) {
      balanceStatus = 'over_routinized';
    } else if (noveltyRatio > 0.75) {
      balanceStatus = 'over_exploratory';
    }

    const balance: NoveltyRoutineBalance = {
      routineRatio,
      noveltyRatio,
      balanceStatus,
      assessedAt: new Date().toISOString(),
    };

    this.repo.saveBalance(balance);
    this.logger.info(
      `Assessed novelty vs routine balance: routine=${routineRatio}, novelty=${noveltyRatio} (${balanceStatus})`,
    );
    return balance;
  }

  public getHabit(habitId: string): HabitRecord | null {
    return this.repo.getHabitById(habitId);
  }

  public listHabits(domain?: string, activeOnly?: boolean, limit?: number): HabitRecord[] {
    return this.repo.listHabits(domain, activeOnly, limit);
  }

  public listExecutionLogs(habitId?: string, limit?: number): HabitExecutionLog[] {
    return this.repo.listExecutionLogs(habitId, limit);
  }

  public getLatestBalance(): NoveltyRoutineBalance | null {
    return this.repo.getLatestBalance();
  }
}
