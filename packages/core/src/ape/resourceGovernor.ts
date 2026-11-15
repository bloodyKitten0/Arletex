import {
  ApeGoal,
  ResourceExecutionProfile,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export interface ResourceRequirement {
  cpu?: 'low' | 'medium' | 'high';
  gpu?: boolean;
  estimatedMemoryMb?: number;
  estimatedDurationMs?: number;
}

export interface ResourceFeasibilityResult {
  feasible: boolean;
  throttleRecommended: boolean;
  backoffMs: number;
  reason: string;
}

export class ResourceGovernor {
  private profile: ResourceExecutionProfile;
  private readonly logger: ILogger;
  private lastUserInteractionTimestamp: number = Date.now();
  private consecutiveIdleCycles: number = 0;

  constructor(
    customProfile?: Partial<ResourceExecutionProfile>,
    logger: ILogger = rootLogger,
  ) {
    this.logger = logger.child('ResourceGovernor');
    this.profile = {
      targetDevice: 'ASUS_ROG_ALLY_X',
      cpuBudget: customProfile?.cpuBudget ?? 'medium',
      gpuAllowed: customProfile?.gpuAllowed ?? true,
      maxMemoryMb: customProfile?.maxMemoryMb ?? 16384,
      backoffMs: customProfile?.backoffMs ?? 35000,
      isUserInteracting: customProfile?.isUserInteracting ?? false,
      throttleFactor: customProfile?.throttleFactor ?? 1.0,
    };
  }

  public getProfile(): ResourceExecutionProfile {
    return { ...this.profile };
  }

  public updateProfile(updates: Partial<ResourceExecutionProfile>): void {
    this.profile = { ...this.profile, ...updates };
    this.logger.info(`ResourceGovernor profile updated: CPU budget=${this.profile.cpuBudget}, GPU=${this.profile.gpuAllowed}`);
  }

  /**
   * Tracks user interaction events (typing, voice, message dispatch).
   */
  public recordUserActivity(): void {
    this.lastUserInteractionTimestamp = Date.now();
    this.consecutiveIdleCycles = 0;
    this.profile.isUserInteracting = true;
  }

  /**
   * Evaluates if Proof is actively interacting (grace window of 20 seconds).
   * If user is active, background autonomous tasks must yield.
   */
  public checkUserActivityState(graceWindowMs = 20000): { isUserActive: boolean; shouldYield: boolean } {
    const elapsed = Date.now() - this.lastUserInteractionTimestamp;
    const isUserActive = elapsed < graceWindowMs;
    this.profile.isUserInteracting = isUserActive;
    return {
      isUserActive,
      shouldYield: isUserActive,
    };
  }

  /**
   * Evaluates whether a planned goal or background task can run given target ASUS ROG Ally X constraints.
   */
  public evaluateFeasibility(req: ResourceRequirement): ResourceFeasibilityResult {
    const userState = this.checkUserActivityState();

    // 1. User is actively interacting -> yield immediate priority to user conversation
    if (userState.shouldYield) {
      return {
        feasible: false,
        throttleRecommended: true,
        backoffMs: 15000,
        reason: 'User is actively interacting; yielding compute and UI focus to user dialogue.',
      };
    }

    // 2. High CPU requirement while profile budget is low
    if (req.cpu === 'high' && this.profile.cpuBudget === 'low') {
      return {
        feasible: false,
        throttleRecommended: true,
        backoffMs: 45000,
        reason: 'High CPU requirement exceeds current power-saving budget on ROG Ally X.',
      };
    }

    // 3. GPU requirement when GPU compute is restricted (e.g. handheld on battery throttle)
    if (req.gpu && !this.profile.gpuAllowed) {
      return {
        feasible: false,
        throttleRecommended: true,
        backoffMs: 60000,
        reason: 'GPU acceleration is currently disabled or restricted for background workloads.',
      };
    }

    // 4. Memory ceiling check
    const requestedMem = req.estimatedMemoryMb ?? 512;
    if (requestedMem > this.profile.maxMemoryMb) {
      return {
        feasible: false,
        throttleRecommended: true,
        backoffMs: 60000,
        reason: `Requested memory ${requestedMem}MB exceeds safety ceiling ${this.profile.maxMemoryMb}MB.`,
      };
    }

    // Feasible
    return {
      feasible: true,
      throttleRecommended: this.profile.cpuBudget === 'low',
      backoffMs: this.profile.backoffMs,
      reason: 'Workload within ROG Ally X thermal and resource operating envelope.',
    };
  }

  /**
   * Calculates execution priority score [0.0 to 1.0] for an autonomous goal.
   */
  public calculateExecutionPriority(goal: ApeGoal, dominantDrive: string): number {
    let score = goal.priority;

    // Boost goals matching dominant drive
    if (goal.motivation.toLowerCase().includes(dominantDrive.toLowerCase())) {
      score = Math.min(1.0, score + 0.2);
    }

    // Low cost goals get slight scheduling preference during equilibrium
    if (goal.estimatedCost?.cpu === 'low') {
      score = Math.min(1.0, score + 0.05);
    }

    // If user is active, deprioritize background goals
    if (this.checkUserActivityState().isUserActive) {
      score = Math.max(0.0, score - 0.5);
    }

    return Number(score.toFixed(3));
  }

  /**
   * Calculates bounded idle backoff to avoid continuous spin loops.
   */
  public calculateIdleBackoff(incrementCycle = true): number {
    if (incrementCycle) {
      this.consecutiveIdleCycles++;
    }
    // Base backoff 35s, scaling up to max 120s
    const base = this.profile.backoffMs;
    const factor = Math.min(4, 1 + this.consecutiveIdleCycles * 0.5);
    const backoff = Math.min(120000, Math.round(base * factor));
    return backoff;
  }

  /**
   * Resets idle backoff when real work or user activity occurs.
   */
  public resetIdleBackoff(): void {
    this.consecutiveIdleCycles = 0;
  }
}
