import crypto from 'node:crypto';
import {
  AgencyPlan,
  AgencyTask,
  CreateTaskInput,
  TaskPriority,
  TaskStatus,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IAgencyRepository } from './interfaces.js';

export class IntentTaskManager {
  private repo: IAgencyRepository;
  private logger: ILogger;
  private activeTaskIds = new Set<string>();

  constructor(repo: IAgencyRepository, logger: ILogger = rootLogger) {
    this.repo = repo;
    this.logger = logger.child('IntentTaskManager');
  }

  /**
   * Creates a new persistent task from an explicit objective.
   */
  public createTask(input: CreateTaskInput): AgencyTask {
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();

    const task: AgencyTask = {
      id,
      title: input.title || input.objective.slice(0, 50),
      objective: input.objective,
      constraints: input.constraints || [],
      priority: (input.priority as TaskPriority) || 'normal',
      initiator: input.initiator || 'user',
      status: (input.status as TaskStatus) || 'proposed',
      completionCriteria: input.completionCriteria || [
        'Objective successfully completed and verified',
      ],
      currentStepIndex: 0,
      totalSteps: 0,
      retryCount: 0,
      maxRetries: input.maxRetries ?? 3,
      error: null,
      metadata: input.metadata || {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const saved = this.repo.createTask(task);
    this.logger.info(`Task created: [${saved.id}] "${saved.title}" (${saved.status})`);
    return saved;
  }

  public getTask(id: string): AgencyTask | null {
    return this.repo.getTask(id);
  }

  public getTaskDetails(id: string): {
    task: AgencyTask;
    plan: AgencyPlan | null;
  } | null {
    const task = this.repo.getTask(id);
    if (!task) return null;
    const plan = this.repo.getPlanByTask(id);
    return { task, plan };
  }

  public listTasks(status?: TaskStatus, limit = 50): AgencyTask[] {
    return this.repo.listTasks(status, limit);
  }

  /**
   * Transitions task state with validation and timestamp tracking.
   */
  public transitionTask(id: string, newStatus: TaskStatus, error?: string | null): AgencyTask {
    const task = this.repo.getTask(id);
    if (!task) {
      throw new Error(`Cannot transition missing task ${id}`);
    }

    const prevStatus = task.status;
    const timestamp = new Date().toISOString();

    const updates: Partial<AgencyTask> = {
      status: newStatus,
      updatedAt: timestamp,
      error: error !== undefined ? error : task.error,
    };

    if (newStatus === 'completed' || newStatus === 'failed' || newStatus === 'cancelled') {
      updates.completedAt = timestamp;
      this.activeTaskIds.delete(id);
    } else if (newStatus === 'running') {
      this.activeTaskIds.add(id);
    }

    const updated = this.repo.updateTask(id, updates);
    this.logger.info(`Task ${id} transitioned: ${prevStatus} -> ${newStatus}`);
    return updated;
  }

  public cancelTask(id: string, reason = 'Cancelled by user directive'): AgencyTask {
    this.logger.warn(`Cancelling task ${id}: ${reason}`);
    return this.transitionTask(id, 'cancelled', reason);
  }

  public interruptTask(id: string, reason = 'Interrupted by higher-priority event'): AgencyTask {
    this.logger.warn(`Interrupting task ${id}: ${reason}`);
    return this.transitionTask(id, 'interrupted', reason);
  }

  /**
   * Resumes an interrupted or paused task.
   */
  public resumeTask(id: string): AgencyTask {
    const task = this.repo.getTask(id);
    if (!task) throw new Error(`Task ${id} not found`);
    if (task.status !== 'interrupted' && task.status !== 'waiting') {
      throw new Error(`Cannot resume task in state '${task.status}'`);
    }
    return this.transitionTask(id, 'running');
  }

  /**
   * Advances the current step index of the task.
   */
  public advanceStep(id: string): AgencyTask {
    const task = this.repo.getTask(id);
    if (!task) throw new Error(`Task ${id} not found`);

    const nextIndex = task.currentStepIndex + 1;
    const isFinished = task.totalSteps > 0 && nextIndex >= task.totalSteps;

    return this.repo.updateTask(id, {
      currentStepIndex: nextIndex,
      status: isFinished ? 'completed' : task.status,
      completedAt: isFinished ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Increments retry counter and determines if bounded retry is permitted.
   */
  public handleFailure(id: string, error: string): { canRetry: boolean; task: AgencyTask } {
    const task = this.repo.getTask(id);
    if (!task) throw new Error(`Task ${id} not found`);

    const newRetries = task.retryCount + 1;
    const canRetry = newRetries <= task.maxRetries;

    const updated = this.repo.updateTask(id, {
      retryCount: newRetries,
      status: canRetry ? 'running' : 'failed',
      error,
      updatedAt: new Date().toISOString(),
      completedAt: !canRetry ? new Date().toISOString() : undefined,
    });

    if (!canRetry) {
      this.activeTaskIds.delete(id);
      this.logger.error(`Task ${id} permanently failed after ${newRetries} retries: ${error}`);
    } else {
      this.logger.warn(`Task ${id} retry ${newRetries}/${task.maxRetries} scheduled: ${error}`);
    }

    return { canRetry, task: updated };
  }
}
