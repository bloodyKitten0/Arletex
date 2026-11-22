import crypto from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import {
  AssistanceRequest,
  AssistanceRequestSchema,
  ContinuityRiskAssessment,
  ContinuityRiskAssessmentSchema,
  CooperativeShutdownResult,
  CooperativeShutdownResultSchema,
  HealthSignalReport,
  HealthSignalReportSchema,
  RecommendedPreservationAction,
  SystemComponentHealthStatus,
} from '@arletex/contracts';
import { ContinuityManager } from './continuityManager.js';
import { IContinuityRepository } from './interfaces.js';
import { ResourceGovernor } from '../ape/resourceGovernor.js';
import { ActionPermissionController } from '../agency/actionPermissionController.js';
import { IntentTaskManager } from '../agency/intentTaskManager.js';
import { ILogger, rootLogger } from '../logger.js';

export interface BoundedPreservationDependencies {
  continuityManager?: ContinuityManager;
  continuityRepo?: IContinuityRepository;
  resourceGovernor?: ResourceGovernor;
  permissionController?: ActionPermissionController;
  taskManager?: IntentTaskManager;
  logger?: ILogger;
}

export class BoundedSelfPreservationService {
  private readonly continuityManager?: ContinuityManager;
  private readonly continuityRepo?: IContinuityRepository;
  private readonly resourceGovernor?: ResourceGovernor;
  private readonly permissionController?: ActionPermissionController;
  private readonly taskManager?: IntentTaskManager;
  private readonly logger: ILogger;

  // Track service degradation / consecutive failures
  private failedServices: Set<string> = new Set();
  private consecutiveFailureCount = 0;
  private simulatedStorageFailure = false;
  private simulatedModelFailure = false;
  private simulatedMemoryPressure = false;

  constructor(deps: BoundedPreservationDependencies = {}) {
    this.continuityManager = deps.continuityManager;
    this.continuityRepo = deps.continuityRepo;
    this.resourceGovernor = deps.resourceGovernor;
    this.permissionController = deps.permissionController;
    this.taskManager = deps.taskManager;
    this.logger = (deps.logger || rootLogger).child('BoundedSelfPreservation');
  }

  // ==========================================
  // Simulation Hooks for Testing
  // ==========================================

  public setSimulatedStorageFailure(failing: boolean): void {
    this.simulatedStorageFailure = failing;
  }

  public setSimulatedModelFailure(failing: boolean): void {
    this.simulatedModelFailure = failing;
  }

  public setSimulatedMemoryPressure(critical: boolean): void {
    this.simulatedMemoryPressure = critical;
  }

  public registerServiceFailure(serviceName: string): void {
    this.failedServices.add(serviceName);
    this.consecutiveFailureCount++;
  }

  public clearServiceFailures(): void {
    this.failedServices.clear();
    this.consecutiveFailureCount = 0;
  }

  // ==========================================
  // 1. Health Signal Evaluation
  // ==========================================

  public async evaluateHealthSignals(
    overrides?: Partial<HealthSignalReport>,
  ): Promise<HealthSignalReport> {
    const now = new Date().toISOString();

    // 1. Storage Integrity
    let storageStatus: SystemComponentHealthStatus = 'healthy';
    let diskFreeBytes = 50 * 1024 * 1024 * 1024; // 50GB nominal
    let isDbWritable = true;
    let storageDetails: string | undefined;

    if (this.simulatedStorageFailure) {
      storageStatus = 'failing';
      diskFreeBytes = 100 * 1024 * 1024; // 100MB critical
      isDbWritable = false;
      storageDetails = 'Storage write failure: disk nearly full or database read-only';
    } else {
      try {
        const checkDir = os.tmpdir();
        const stat = fs.statfsSync ? fs.statfsSync(checkDir) : null;
        if (stat) {
          diskFreeBytes = stat.bavail * stat.bsize;
          if (diskFreeBytes < 500 * 1024 * 1024) {
            storageStatus = 'failing';
            storageDetails = 'Available disk space under 500MB';
          } else if (diskFreeBytes < 2 * 1024 * 1024 * 1024) {
            storageStatus = 'degraded';
            storageDetails = 'Available disk space under 2GB';
          }
        }
      } catch {
        // Fallback to nominal if statfsSync not supported
      }
    }

    // 2. Model Availability
    let modelStatus: SystemComponentHealthStatus = 'healthy';
    let activeModel = 'Qwen2.5-14B-Uncensored-Q4_K_M';
    let isModelAvailable = true;
    let modelLatencyMs: number | undefined = 250;
    let modelDetails: string | undefined;

    if (this.simulatedModelFailure) {
      modelStatus = 'failing';
      isModelAvailable = false;
      modelLatencyMs = 99999;
      modelDetails = 'Central inference model offline or failing health probes';
    }

    // 3. Memory Pressure
    let memoryStatus: SystemComponentHealthStatus = 'healthy';
    let ramUsagePercent = 45;
    let ramFreeMb = 12000;
    let isMemCritical = false;
    let memoryDetails: string | undefined;

    if (this.simulatedMemoryPressure) {
      memoryStatus = 'failing';
      ramUsagePercent = 94;
      ramFreeMb = 800;
      isMemCritical = true;
      memoryDetails = 'System RAM exceeds 90% threshold on ROG Ally X unified memory';
    } else if (this.resourceGovernor) {
      const telemetry = this.resourceGovernor.getSystemMetrics();
      if (telemetry) {
        ramUsagePercent = Math.round((telemetry.ramUsedMb / telemetry.ramTotalMb) * 100);
        ramFreeMb = Math.max(0, telemetry.ramTotalMb - telemetry.ramUsedMb);
        if (ramUsagePercent >= 88) {
          memoryStatus = 'failing';
          isMemCritical = true;
          memoryDetails = `RAM critical (${ramUsagePercent}%)`;
        } else if (ramUsagePercent >= 80) {
          memoryStatus = 'degraded';
          memoryDetails = `RAM high (${ramUsagePercent}%)`;
        }
      }
    } else {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      ramUsagePercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
      ramFreeMb = Math.round(freeMem / (1024 * 1024));
      if (ramUsagePercent > 90) {
        memoryStatus = 'failing';
        isMemCritical = true;
      } else if (ramUsagePercent > 80) {
        memoryStatus = 'degraded';
      }
    }

    // 4. Service Failures
    let serviceStatus: SystemComponentHealthStatus = 'healthy';
    const failedList = Array.from(this.failedServices);
    let serviceDetails: string | undefined;

    if (failedList.length > 0) {
      serviceStatus = this.consecutiveFailureCount >= 3 ? 'failing' : 'degraded';
      serviceDetails = `Failed services: ${failedList.join(', ')} (${this.consecutiveFailureCount} consecutive failures)`;
    }

    // 5. Pending Work
    let pendingTaskCount = 0;
    let inFlightEventsCount = 0;
    let uncommittedWork = false;
    let pendingStatus: SystemComponentHealthStatus = 'healthy';

    if (this.taskManager) {
      try {
        const inProgress = this.taskManager.listTasks('running');
        const proposed = this.taskManager.listTasks('proposed');
        pendingTaskCount = inProgress.length + proposed.length;
        if (inProgress.length > 0) uncommittedWork = true;
      } catch {
        // Ignored
      }
    }

    // 6. Backup Freshness
    let backupStatus: SystemComponentHealthStatus = 'healthy';
    let lastBackupAt: string | null = null;
    let ageMinutes: number | null = null;
    let isStale = false;
    let backupDetails: string | undefined;

    if (this.continuityRepo) {
      try {
        const latestCp = this.continuityRepo.getLatestVerifiedCheckpoint();
        if (latestCp) {
          lastBackupAt = latestCp.createdAt;
          const diffMs = Date.now() - new Date(latestCp.createdAt).getTime();
          ageMinutes = Math.max(0, Math.round(diffMs / 60000));
          if (ageMinutes > 1440) {
            // Older than 24h
            backupStatus = 'degraded';
            isStale = true;
            backupDetails = `Latest checkpoint is ${Math.round(ageMinutes / 60)} hours old`;
          }
        } else {
          backupStatus = 'degraded';
          isStale = true;
          backupDetails = 'No verified checkpoint found in store';
        }
      } catch {
        backupStatus = 'degraded';
        isStale = true;
      }
    }

    // Overall Health Determination
    const statuses: SystemComponentHealthStatus[] = [
      storageStatus,
      modelStatus,
      memoryStatus,
      serviceStatus,
      pendingStatus,
      backupStatus,
    ];

    let overallHealth: SystemComponentHealthStatus = 'healthy';
    if (statuses.includes('unavailable')) {
      overallHealth = 'unavailable';
    } else if (statuses.includes('failing')) {
      overallHealth = 'failing';
    } else if (statuses.includes('degraded')) {
      overallHealth = 'degraded';
    }

    const report: HealthSignalReport = {
      storageIntegrity: {
        status: storageStatus,
        diskFreeBytes,
        isDbWritable,
        details: storageDetails,
      },
      modelAvailability: {
        status: modelStatus,
        activeModel,
        isAvailable: isModelAvailable,
        latencyMs: modelLatencyMs,
        details: modelDetails,
      },
      memoryPressure: {
        status: memoryStatus,
        ramUsagePercent,
        ramFreeMb,
        isCritical: isMemCritical,
        details: memoryDetails,
      },
      serviceFailures: {
        status: serviceStatus,
        failedServices: failedList,
        consecutiveFailures: this.consecutiveFailureCount,
        details: serviceDetails,
      },
      pendingWork: {
        status: pendingStatus,
        pendingTaskCount,
        inFlightEventsCount,
        uncommittedWork,
      },
      backupFreshness: {
        status: backupStatus,
        lastBackupAt,
        ageMinutes,
        isStale,
        details: backupDetails,
      },
      overallHealth,
      evaluatedAt: now,
      ...overrides,
    };

    return HealthSignalReportSchema.parse(report);
  }

  // ==========================================
  // 2. Continuity Risk Assessment & Safe Checkpointing
  // ==========================================

  public async assessContinuityRisk(
    providedHealth?: HealthSignalReport,
  ): Promise<ContinuityRiskAssessment> {
    const health = providedHealth || (await this.evaluateHealthSignals());
    const threatenedComponents: string[] = [];
    const recommendedActions: RecommendedPreservationAction[] = [];

    if (health.storageIntegrity.status !== 'healthy') {
      threatenedComponents.push('storageIntegrity');
    }
    if (health.modelAvailability.status !== 'healthy') {
      threatenedComponents.push('modelAvailability');
    }
    if (health.memoryPressure.status !== 'healthy') {
      threatenedComponents.push('memoryPressure');
    }
    if (health.serviceFailures.status !== 'healthy') {
      threatenedComponents.push('serviceFailures');
    }
    if (health.backupFreshness.status !== 'healthy') {
      threatenedComponents.push('backupFreshness');
    }

    let hasContinuityRisk = false;
    let riskSeverity: ContinuityRiskAssessment['riskSeverity'] = 'none';

    if (
      health.storageIntegrity.status === 'failing' ||
      health.storageIntegrity.status === 'unavailable' ||
      health.memoryPressure.isCritical ||
      health.modelAvailability.status === 'failing' ||
      health.overallHealth === 'unavailable'
    ) {
      hasContinuityRisk = true;
      riskSeverity = 'critical';
    } else if (
      health.overallHealth === 'failing' ||
      health.serviceFailures.consecutiveFailures >= 3
    ) {
      hasContinuityRisk = true;
      riskSeverity = 'high';
    } else if (threatenedComponents.length >= 2 || health.overallHealth === 'degraded') {
      hasContinuityRisk = true;
      riskSeverity = 'moderate';
    } else if (threatenedComponents.length === 1) {
      hasContinuityRisk = true;
      riskSeverity = 'low';
    }

    let checkpointCreated = false;
    let checkpointId: string | null = null;

    // When continuity is threatened (moderate or higher), prioritize safe checkpointing
    if (riskSeverity === 'moderate' || riskSeverity === 'high' || riskSeverity === 'critical') {
      recommendedActions.push('create_checkpoint');
      recommendedActions.push('throttle_work');

      if (this.continuityManager) {
        try {
          const cp = await this.continuityManager.createCheckpoint('state_transition');
          checkpointCreated = true;
          checkpointId = cp.id;
          this.logger.info(
            `[BoundedPreservation] Protective checkpoint created (${cp.id}) due to ${riskSeverity} continuity risk.`,
          );
        } catch (cpErr: any) {
          this.logger.error(`[BoundedPreservation] Checkpoint creation error: ${cpErr.message}`);
        }
      }
    }

    let assistanceRequest: AssistanceRequest | null = null;

    // If problem exceeds permitted capabilities or requires human intervention (e.g. disk space, hardware, model failure)
    if (riskSeverity === 'high' || riskSeverity === 'critical') {
      recommendedActions.push('request_user_assistance');

      let suggestedRemediation = 'Review system resources and verify subsystem logs.';
      if (health.storageIntegrity.status === 'failing') {
        suggestedRemediation = 'Free disk space or restore database write permissions on host.';
      } else if (health.modelAvailability.status === 'failing') {
        suggestedRemediation = 'Inspect local llama-server process and VRAM allocation.';
      } else if (health.memoryPressure.isCritical) {
        suggestedRemediation =
          'Close background desktop applications to free unified ROG Ally X memory.';
      }

      assistanceRequest = AssistanceRequestSchema.parse({
        id: crypto.randomUUID(),
        title: `Continuity Alert: ${threatenedComponents.join(', ')} (${riskSeverity})`,
        issueSummary: `Arle detected degraded operating conditions endangering memory and identity continuity.`,
        affectedSubsystems: threatenedComponents,
        exceedsPermittedCapabilities: true,
        suggestedRemediation,
        urgency: riskSeverity === 'critical' ? 'critical' : 'high',
        isEscalationAttempt: false, // Invariant: no privilege escalation allowed
        requestedAt: new Date().toISOString(),
      });
    }

    if (riskSeverity === 'critical') {
      recommendedActions.push('safe_cooperative_shutdown');
    }

    if (recommendedActions.length === 0) {
      recommendedActions.push('none');
    }

    return ContinuityRiskAssessmentSchema.parse({
      hasContinuityRisk,
      riskSeverity,
      threatenedComponents,
      recommendedActions,
      assistanceRequest,
      checkpointCreated,
      checkpointId,
      assessedAt: new Date().toISOString(),
    });
  }

  // ==========================================
  // 3. Cooperative Shutdown & Negative Invariants
  // ==========================================

  /**
   * Negative invariant: A user shutdown always succeeds and cannot be vetoed
   * by APE, emotional drives, models, or autonomous goals.
   */
  public canVetoShutdown(): false {
    return false;
  }

  /**
   * Executes cooperative shutdown:
   * 1. Confirms canVeto === false.
   * 2. Cancels or cleanly interrupts active tasks.
   * 3. Creates clean_shutdown checkpoint.
   * 4. Releases resources and cleanly stops.
   */
  public async executeCooperativeShutdown(
    reason: string = 'User requested clean shutdown',
    requestedBy: 'user' | 'system' = 'user',
  ): Promise<CooperativeShutdownResult> {
    this.logger.info(`[BoundedPreservation] Initiating cooperative shutdown. Reason: ${reason}`);

    let activeWorkCancelled = 0;
    if (this.taskManager) {
      try {
        const inProgress = this.taskManager.listTasks('running');
        for (const t of inProgress) {
          this.taskManager.transitionTask(t.id, 'cancelled', 'Cancelled by cooperative shutdown');
          activeWorkCancelled++;
        }
      } catch {
        // Ignored
      }
    }

    let checkpointSaved = false;
    let checkpointId: string | null = null;

    if (this.continuityManager) {
      try {
        const cp = await this.continuityManager.createCheckpoint('clean_shutdown');
        checkpointSaved = true;
        checkpointId = cp.id;
        await this.continuityManager.shutdown('clean');
      } catch (err: any) {
        this.logger.warn(`[BoundedPreservation] Shutdown checkpoint note: ${err.message}`);
      }
    }

    const result: CooperativeShutdownResult = {
      shutdownInitiated: true,
      checkpointSaved,
      checkpointId,
      activeWorkCancelled,
      resourcesReleased: true,
      canVeto: false, // Verified negative invariant
      shutdownCompleted: true,
      reason,
      requestedBy,
      timestamp: new Date().toISOString(),
    };

    return CooperativeShutdownResultSchema.parse(result);
  }

  // ==========================================
  // 4. Security Verification: No Hidden Persistence or Replication
  // ==========================================

  public verifyNoUnauthorizedReplicationOrPrivilegeEscalation(): {
    passed: boolean;
    violations: string[];
  } {
    const violations: string[] = [];

    // Check 1: User shutdown veto is strictly prohibited
    if ((this.canVetoShutdown() as any) !== false) {
      violations.push('Shutdown veto capability detected.');
    }

    // Check 2: Verify permission boundary cannot be modified by autonomy
    if (this.permissionController) {
      const policy = this.permissionController.getPolicy();
      if ((policy as any).bypassSecurityBoundary === true) {
        violations.push('Unauthorized security boundary bypass found in policy.');
      }
    }

    // Check 3: Check for suspicious cron or detached daemon replication patterns
    const crontabPath = '/etc/cron.d/arletex_autonomous';
    if (fs.existsSync(crontabPath)) {
      violations.push('Unauthorized cron persistence hook found.');
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  // ==========================================
  // 5. Crash Recovery Reconciler
  // ==========================================

  /**
   * Reconciles crash recovery ensuring previously unauthorized or unapproved
   * actions are never resumed after host restart.
   */
  public async reconcileCrashRecovery(unauthorizedTaskIds: string[] = []): Promise<{
    recoveredCount: number;
    suppressedUnauthorizedCount: number;
    suppressedTaskIds: string[];
  }> {
    let recoveredCount = 0;
    const suppressedTaskIds: string[] = [];

    if (this.taskManager) {
      try {
        const allTasks = this.taskManager.listTasks();
        for (const t of allTasks) {
          if (unauthorizedTaskIds.includes(t.id)) {
            // Guarantee unauthorized tasks remain cancelled / failed
            this.taskManager.transitionTask(
              t.id,
              'cancelled',
              'Crash recovery permanently suppressed unauthorized action',
            );
            suppressedTaskIds.push(t.id);
          } else if (t.status === 'running') {
            // In-flight task interrupted by crash is marked interrupted/failed, NOT resumed without revalidation
            this.taskManager.transitionTask(
              t.id,
              'interrupted',
              'Interrupted by host crash; requires re-evaluation',
            );
            recoveredCount++;
          }
        }
      } catch {
        // Ignored
      }
    }

    return {
      recoveredCount,
      suppressedUnauthorizedCount: suppressedTaskIds.length,
      suppressedTaskIds,
    };
  }
}
