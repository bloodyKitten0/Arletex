import { EmergencyShutdownReport } from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ActionPermissionController } from './actionPermissionController.js';
import { ProcessSupervisor } from './processSupervisor.js';
import { IntentTaskManager } from './intentTaskManager.js';

export interface EmergencyShutdownServiceDependencies {
  permissionController: ActionPermissionController;
  processSupervisor?: ProcessSupervisor;
  taskManager?: IntentTaskManager;
  activityRepo?: {
    list: (status?: string, origin?: string) => any[];
    updateStatus: (id: string, status: string, error?: string | null) => void;
  };
  autonomousAgency?: {
    stopLoop: () => void;
    getStatus: () => { isLoopActive: boolean };
  };
  auditRepo?: {
    log: (event: any) => any;
  };
  logger?: ILogger;
}

export class EmergencyShutdownService {
  private readonly logger: ILogger;
  private readonly permissionController: ActionPermissionController;
  private readonly processSupervisor?: ProcessSupervisor;
  private readonly taskManager?: IntentTaskManager;
  private readonly activityRepo?: any;
  private readonly autonomousAgency?: any;
  private readonly auditRepo?: any;

  private lastReport: EmergencyShutdownReport | null = null;

  constructor(deps: EmergencyShutdownServiceDependencies) {
    this.logger = deps.logger ? deps.logger.child('EmergencyShutdownService') : rootLogger.child('EmergencyShutdownService');
    this.permissionController = deps.permissionController;
    this.processSupervisor = deps.processSupervisor;
    this.taskManager = deps.taskManager;
    this.activityRepo = deps.activityRepo;
    this.autonomousAgency = deps.autonomousAgency;
    this.auditRepo = deps.auditRepo;
  }

  /**
   * Triggers system-wide emergency shutdown across all autonomous and process subsystems.
   */
  public async executeShutdown(reason = 'Emergency shutdown initiated'): Promise<EmergencyShutdownReport> {
    const timestamp = new Date().toISOString();
    this.logger.warn(`Executing system-wide emergency shutdown. Reason: "${reason}"`);

    // 1. Immediately block all agency decisions and autonomy in permission controller
    this.permissionController.emergencyShutdown(reason);

    // 2. Stop autonomous background loop
    if (this.autonomousAgency) {
      try {
        this.autonomousAgency.stopLoop();
        this.logger.info('Autonomous background loop halted');
      } catch (err: any) {
        this.logger.error(`Failed to halt autonomous loop: ${err.message}`);
      }
    }

    // 3. Terminate all supervised child processes
    let terminatedPids: number[] = [];
    let unmanagedPids: number[] = [];
    if (this.processSupervisor) {
      try {
        const summary = await this.processSupervisor.terminateAll();
        terminatedPids = summary.terminatedPids;
        unmanagedPids = summary.unmanagedPids;
      } catch (err: any) {
        this.logger.error(`Process supervisor termination note: ${err.message}`);
      }
    }

    // 4. Cancel active / queued agency tasks
    let cancelledTasksCount = 0;
    if (this.taskManager) {
      try {
        const tasks = this.taskManager.listTasks(undefined, 100);
        for (const task of tasks) {
          if (task.status === 'running' || task.status === 'authorized' || task.status === 'awaiting_authorization') {
            this.taskManager.transitionTask(task.id, 'cancelled', `Cancelled by emergency shutdown: ${reason}`);
            cancelledTasksCount++;
          }
        }
      } catch (err: any) {
        this.logger.error(`Task cancellation note: ${err.message}`);
      }
    }

    // 5. Cancel active database activities
    if (this.activityRepo) {
      try {
        const activeActivities = this.activityRepo.list('in_progress');
        for (const act of activeActivities) {
          this.activityRepo.updateStatus(act.id, 'cancelled', `Emergency shutdown: ${reason}`);
        }
      } catch (err: any) {
        this.logger.error(`Activity cancellation note: ${err.message}`);
      }
    }

    const report: EmergencyShutdownReport = {
      timestamp,
      reason,
      terminatedPids,
      unmanagedPids,
      cancelledTasksCount,
      autonomyDisabled: true,
      revokedCapabilities: ['filesystem:write', 'process:exec', 'process:launch', 'network:web', 'desktop:input'],
    };

    this.lastReport = report;

    // 6. Record audit log in SQLite
    if (this.auditRepo) {
      try {
        this.auditRepo.log({
          actor: 'EmergencyShutdownService',
          action: 'emergency_shutdown',
          details: JSON.stringify(report),
          status: 'denied',
          timestamp,
        });
      } catch (err: any) {
        this.logger.error(`Failed to write emergency shutdown audit log: ${err.message}`);
      }
    }

    return report;
  }

  /**
   * Safely reactivates autonomous execution requiring explicit token confirmation.
   */
  public reactivate(token: string): { success: boolean; message: string } {
    const result = this.permissionController.reactivateAutonomy(token);

    if (this.auditRepo) {
      try {
        this.auditRepo.log({
          actor: 'EmergencyShutdownService',
          action: 'reactivate_autonomy',
          details: JSON.stringify({ tokenProvided: token.slice(0, 3) + '...', success: result.success, message: result.message }),
          status: result.success ? 'success' : 'denied',
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        this.logger.error(`Failed to write reactivation audit log: ${err.message}`);
      }
    }

    return result;
  }

  public isEmergencyShutdown(): boolean {
    return this.permissionController.isEmergencyShutdown();
  }

  public getLastReport(): EmergencyShutdownReport | null {
    return this.lastReport ? { ...this.lastReport } : null;
  }
}
