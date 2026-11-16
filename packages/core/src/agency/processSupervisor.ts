import { ChildProcess } from 'node:child_process';
import { ILogger, rootLogger } from '../logger.js';

export interface SupervisedProcess {
  pid: number;
  appName: string;
  args: string[];
  startedAt: string;
  childProcess?: ChildProcess;
}

export interface TerminationSummary {
  terminatedPids: number[];
  unmanagedPids: number[];
}

export class ProcessSupervisor {
  private readonly logger: ILogger;
  private readonly processes = new Map<number, SupervisedProcess>();

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('ProcessSupervisor');
  }

  /**
   * Registers a spawned child process for safety supervision.
   */
  public register(proc: SupervisedProcess): void {
    if (!proc.pid || proc.pid <= 0) return;
    this.processes.set(proc.pid, proc);
    this.logger.info(`Supervising child process [PID ${proc.pid}] for "${proc.appName}"`);

    if (proc.childProcess) {
      proc.childProcess.once('exit', (code, signal) => {
        this.processes.delete(proc.pid);
        this.logger.debug(
          `Supervised process [PID ${proc.pid}] "${proc.appName}" exited cleanly with code ${code ?? 'null'} (signal: ${signal ?? 'none'})`,
        );
      });
      proc.childProcess.once('error', (err) => {
        this.processes.delete(proc.pid);
        this.logger.warn(`Supervised process [PID ${proc.pid}] error: ${err.message}`);
      });
    }
  }

  /**
   * Unregisters a process when it completes or shuts down normally.
   */
  public unregister(pid: number): boolean {
    return this.processes.delete(pid);
  }

  public getProcess(pid: number): SupervisedProcess | undefined {
    return this.processes.get(pid);
  }

  public listProcesses(): SupervisedProcess[] {
    return Array.from(this.processes.values());
  }

  public getCount(): number {
    return this.processes.size;
  }

  /**
   * Terminates a single supervised process cleanly with SIGTERM, escalating to SIGKILL if necessary.
   */
  public async terminate(pid: number, gracePeriodMs = 300): Promise<boolean> {
    const entry = this.processes.get(pid);
    if (!entry) return false;

    this.logger.info(`Terminating supervised process [PID ${pid}] "${entry.appName}"`);

    try {
      if (entry.childProcess && !entry.childProcess.killed) {
        entry.childProcess.kill('SIGTERM');
      } else {
        process.kill(pid, 'SIGTERM');
      }
    } catch (err: any) {
      if (err.code === 'ESRCH') {
        this.processes.delete(pid);
        return true;
      }
      this.logger.warn(`SIGTERM to PID ${pid} note: ${err.message}`);
    }

    // Wait brief grace period
    await new Promise((r) => setTimeout(r, gracePeriodMs));

    // Check if still running
    let isStillRunning = false;
    try {
      process.kill(pid, 0);
      isStillRunning = true;
    } catch {
      isStillRunning = false;
    }

    if (isStillRunning) {
      this.logger.warn(`Process [PID ${pid}] unyielding to SIGTERM; escalating to SIGKILL`);
      try {
        if (entry.childProcess && !entry.childProcess.killed) {
          entry.childProcess.kill('SIGKILL');
        } else {
          process.kill(pid, 'SIGKILL');
        }
      } catch (err: any) {
        if (err.code !== 'ESRCH') {
          this.logger.error(`SIGKILL to PID ${pid} failed`, err);
        }
      }
    }

    this.processes.delete(pid);
    return true;
  }

  /**
   * Terminates all supervised child processes during Emergency Shutdown.
   */
  public async terminateAll(gracePeriodMs = 300): Promise<TerminationSummary> {
    const active = Array.from(this.processes.values());
    const terminatedPids: number[] = [];
    const unmanagedPids: number[] = [];

    this.logger.warn(`Emergency termination of all ${active.length} supervised process(es) initiated`);

    for (const proc of active) {
      try {
        const ok = await this.terminate(proc.pid, gracePeriodMs);
        if (ok) {
          terminatedPids.push(proc.pid);
        } else {
          unmanagedPids.push(proc.pid);
        }
      } catch (err: any) {
        this.logger.error(`Failed to terminate PID ${proc.pid}: ${err.message}`);
        unmanagedPids.push(proc.pid);
      }
    }

    this.processes.clear();
    return { terminatedPids, unmanagedPids };
  }
}
