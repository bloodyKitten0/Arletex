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

export interface SystemLoadMetrics {
  cpuUsagePercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  batteryPercent: number | null;
  isCharging: boolean | null;
}

export class ResourceGovernor {
  private profile: ResourceExecutionProfile;
  private readonly logger: ILogger;
  private lastUserInteractionTimestamp: number = 0;
  private consecutiveIdleCycles: number = 0;
  private systemMetrics: SystemLoadMetrics;

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
    this.systemMetrics = {
      cpuUsagePercent: 0,
      ramUsedMb: 0,
      ramTotalMb: 24576, // 24GB unified memory on ROG Ally X
      batteryPercent: null,
      isCharging: null,
    };
  }

  public getProfile(): ResourceExecutionProfile {
    return { ...this.profile };
  }

  public updateProfile(updates: Partial<ResourceExecutionProfile>): void {
    this.profile = { ...this.profile, ...updates };
    this.logger.info(`ResourceGovernor profile updated: CPU budget=${this.profile.cpuBudget}, GPU=${this.profile.gpuAllowed}`);
  }

  public updateSystemMetrics(metrics: Partial<SystemLoadMetrics>): void {
    this.systemMetrics = {
      ...this.systemMetrics,
      ...metrics,
    };
  }

  public getSystemMetrics(): SystemLoadMetrics {
    return { ...this.systemMetrics };
  }

  public isSystemOverloaded(): { overloaded: boolean; reason?: string } {
    // 1. High CPU pressure (> 80%)
    if (this.systemMetrics.cpuUsagePercent > 80) {
      return {
        overloaded: true,
        reason: `High CPU utilization (${this.systemMetrics.cpuUsagePercent.toFixed(1)}% > 80%)`,
      };
    }

    // 2. High memory pressure (> 88% of total unified memory)
    if (this.systemMetrics.ramTotalMb > 0) {
      const memFraction = this.systemMetrics.ramUsedMb / this.systemMetrics.ramTotalMb;
      if (memFraction > 0.88) {
        return {
          overloaded: true,
          reason: `High RAM utilization (${(memFraction * 100).toFixed(1)}% > 88% ceiling)`,
        };
      }
    }

    // 3. Handheld battery preservation (battery < 15% and discharging)
    if (
      this.systemMetrics.batteryPercent !== null &&
      this.systemMetrics.batteryPercent < 15 &&
      this.systemMetrics.isCharging === false
    ) {
      return {
        overloaded: true,
        reason: `Low battery reservation (${this.systemMetrics.batteryPercent}% discharging)`,
      };
    }

    return { overloaded: false };
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

    // 2. System overload check (CPU/RAM/Battery governor)
    const overload = this.isSystemOverloaded();
    if (overload.overloaded) {
      return {
        feasible: false,
        throttleRecommended: true,
        backoffMs: 60000,
        reason: `Target hardware resource pressure: ${overload.reason}; pausing optional autonomy to preserve responsiveness.`,
      };
    }

    // 3. High CPU requirement while profile budget is low
    if (req.cpu === 'high' && this.profile.cpuBudget === 'low') {
      return {
        feasible: false,
        throttleRecommended: true,
        backoffMs: 45000,
        reason: 'High CPU requirement exceeds current power-saving budget on ROG Ally X.',
      };
    }

    // 4. GPU requirement when GPU compute is restricted (e.g. handheld on battery throttle)
    if (req.gpu && !this.profile.gpuAllowed) {
      return {
        feasible: false,
        throttleRecommended: true,
        backoffMs: 60000,
        reason: 'GPU acceleration is currently disabled or restricted for background workloads.',
      };
    }

    // 5. Memory ceiling check
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
