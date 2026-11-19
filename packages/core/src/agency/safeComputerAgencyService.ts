import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { ILogger, rootLogger } from '../logger.js';
import { IComputerProvider } from './interfaces.js';
import { ActionPermissionController } from './actionPermissionController.js';
import { ProcessSupervisor } from './processSupervisor.js';

export const SUPPORTED_APPLICATIONS = new Set([
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'firefox',
  'steam',
  'spotify',
  'xdg-open',
  'open',
  'discord',
  'telegram-desktop',
  'obs',
  'gimp',
  'blender',
  'gwenview',
  'haruna',
  'okular',
  'kate',
  'kwrite',
  'dolphin',
  'konsole',
  'vlc',
  'code',
  'spectacle',
  'flatpak',
]);

export class SafeComputerAgencyService implements IComputerProvider {
  private logger: ILogger;
  private permissionController: ActionPermissionController;
  private display: string;
  private processSupervisor?: ProcessSupervisor;

  constructor(
    permissionController: ActionPermissionController,
    display = ':0',
    logger: ILogger = rootLogger,
    processSupervisor?: ProcessSupervisor,
  ) {
    this.permissionController = permissionController;
    this.display = display;
    this.logger = logger.child('SafeComputerAgencyService');
    this.processSupervisor = processSupervisor;
  }

  public setProcessSupervisor(supervisor: ProcessSupervisor): void {
    this.processSupervisor = supervisor;
  }

  public getPermissionController(): ActionPermissionController {
    return this.permissionController;
  }

  /**
   * Launches an application using argument arrays (spawn), completely eliminating shell string injection.
   * Validates against the supported applications allowlist and detects immediate process startup failure.
   */
  public async launchApp(appName: string, args: string[] = []): Promise<{ pid: number; isRunning: boolean }> {
    const auth = this.permissionController.authorize({
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'app_launch',
      payload: { appName, application: appName, args },
      rationale: `SafeComputerAgencyService launchApp: ${appName}`,
      expectedOutcome: 'Launch application safely',
      riskLevel: 'medium',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    });

    if (!SUPPORTED_APPLICATIONS.has(appName)) {
      const err = new Error(
        `Unsupported application: "${appName}". Only authorized applications in the supported allowlist may be launched: [${Array.from(SUPPORTED_APPLICATIONS).join(', ')}]`,
      );
      this.logger.error(err.message);
      throw err;
    }

    if (!auth.allowed) {
      const err = new Error(
        `Authorization denied for launchApp("${appName}"): ${auth.denialReason || 'Blocked by security policy'}`,
      );
      this.logger.error(err.message);
      throw err;
    }

    this.logger.info(`Safely launching application: ${appName} with args: [${args.join(', ')}]`);

    return new Promise((resolve, reject) => {
      let settled = false;
      try {
        const env = {
          ...process.env,
          DISPLAY: this.display,
          WAYLAND_DISPLAY: process.env['WAYLAND_DISPLAY'] || 'wayland-1',
          XDG_RUNTIME_DIR: process.env['XDG_RUNTIME_DIR'] || '/run/user/1000',
        };

        const child = spawn(appName, args, {
          detached: true,
          stdio: 'ignore',
          env,
        });

        child.on('error', (err) => {
          if (!settled) {
            settled = true;
            this.logger.error(`Failed to launch ${appName}`, err);
            reject(err);
          }
        });

        child.on('exit', (code, signal) => {
          if (!settled) {
            settled = true;
            const msg = `Application "${appName}" failed startup and exited immediately with code ${code ?? 'null'} (signal: ${signal ?? 'none'}).`;
            this.logger.error(msg);
            reject(new Error(msg));
          }
        });

        const pid = child.pid || 0;
        if (this.processSupervisor && pid > 0) {
          this.processSupervisor.register({
            pid,
            appName,
            args,
            startedAt: new Date().toISOString(),
            childProcess: child,
          });
        }
        child.unref();

        // Verification probe: detect premature startup failure and check active window presence
        setTimeout(async () => {
          if (!settled) {
            settled = true;
            let windowFound: boolean | undefined = undefined;
            try {
              const win = await this.getActiveWindow();
              if (
                win &&
                (win.appName.toLowerCase().includes(appName.toLowerCase()) ||
                  win.title.toLowerCase().includes(appName.toLowerCase()))
              ) {
                windowFound = true;
              } else {
                windowFound = false;
              }
            } catch {
              windowFound = false;
            }
            resolve({ pid, isRunning: pid > 0, windowFound } as any);
          }
        }, 400);
      } catch (err: any) {
        if (!settled) {
          settled = true;
          reject(err);
        }
      }
    });
  }

  /**
   * Queries active window state via KWin / Wayland or XWayland.
   */
  public async getActiveWindow(): Promise<{ title: string; appName: string; windowId?: string }> {
    try {
      // Safe argument execution
      const child = spawn('xdotool', ['getactivewindow', 'getwindowname'], {
        env: { ...process.env, DISPLAY: this.display },
      });

      return new Promise((resolve) => {
        let stdout = '';
        child.stdout?.on('data', (d) => (stdout += d.toString()));
        child.on('close', () => {
          const title = stdout.trim() || 'Desktop Workspace';
          resolve({ title, appName: 'KWin/Plasma' });
        });
        child.on('error', () => {
          resolve({ title: 'KDE Plasma Desktop', appName: 'KWin' });
        });
      });
    } catch {
      return { title: 'Desktop Workspace', appName: 'KWin' };
    }
  }

  /**
   * Focuses an active window by title or application name.
   */
  public async focusWindow(titleOrApp: string): Promise<boolean> {
    this.logger.info(`Focusing window matching: "${titleOrApp}"`);
    return new Promise((resolve) => {
      try {
        const child = spawn('xdotool', ['search', '--onlyvisible', '--name', titleOrApp, 'windowactivate'], {
          env: { ...process.env, DISPLAY: this.display },
        });

        child.on('close', (code) => {
          resolve(code === 0);
        });
        child.on('error', () => resolve(false));
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Captures screen using spectacle (KDE Wayland) or ffmpeg (X11) safely.
   */
  public async captureScreen(): Promise<{ imagePath: string; imageBase64: string; width: number; height: number }> {
    const tempDir = '/tmp/arletex_vision';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const outputPath = path.join(tempDir, `screen_${Date.now()}.png`);

    return new Promise((resolve, reject) => {
      // Use spectacle on KDE Wayland
      const spec = spawn('spectacle', ['-b', '-n', '-f', '-o', outputPath]);

      spec.on('close', async (code) => {
        if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
          const buf = await fs.promises.readFile(outputPath);
          resolve({
            imagePath: outputPath,
            imageBase64: buf.toString('base64'),
            width: 1920,
            height: 1080,
          });
        } else {
          // Fallback to ffmpeg x11grab
          const ff = spawn('ffmpeg', [
            '-y',
            '-f',
            'x11grab',
            '-i',
            `${this.display}.0`,
            '-vframes',
            '1',
            outputPath,
          ]);

          ff.on('close', async (fCode) => {
            if (fCode === 0 && fs.existsSync(outputPath)) {
              const buf = await fs.promises.readFile(outputPath);
              resolve({
                imagePath: outputPath,
                imageBase64: buf.toString('base64'),
                width: 1920,
                height: 1080,
              });
            } else {
              reject(new Error('Screen capture failed'));
            }
          });
          ff.on('error', reject);
        }
      });
      spec.on('error', () => {
        // Fallback directly to ffmpeg
        const ff = spawn('ffmpeg', [
          '-y',
          '-f',
          'x11grab',
          '-i',
          `${this.display}.0`,
          '-vframes',
          '1',
          outputPath,
        ]);
        ff.on('close', async () => {
          if (fs.existsSync(outputPath)) {
            const buf = await fs.promises.readFile(outputPath);
            resolve({
              imagePath: outputPath,
              imageBase64: buf.toString('base64'),
              width: 1920,
              height: 1080,
            });
          } else {
            reject(new Error('Screen capture failed'));
          }
        });
        ff.on('error', reject);
      });
    });
  }

  /**
   * Safely reads a file with size limits. Gated through ActionPermissionController.
   */
  public async readFile(filePath: string): Promise<string> {
    const auth = this.permissionController.authorize({
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'system_read_file',
      payload: { filePath, path: filePath },
      rationale: 'SafeComputerAgencyService readFile',
      expectedOutcome: 'Read file contents safely',
      riskLevel: 'low',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    });

    if (!auth.allowed) {
      const err = new Error(
        `Authorization denied for readFile("${filePath}"): ${auth.denialReason || 'Blocked by security policy'}`,
      );
      this.logger.error(err.message);
      throw err;
    }

    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${resolved}`);
    }
    const stat = await fs.promises.stat(resolved);
    if (stat.size > 2 * 1024 * 1024) {
      throw new Error(`File exceeds maximum size limit (2MB): ${stat.size} bytes`);
    }
    return fs.promises.readFile(resolved, 'utf-8');
  }

  /**
   * Safely writes a file, checking overwrite permissions. Gated through ActionPermissionController.
   */
  public async writeFile(
    filePath: string,
    content: string,
    overwrite = false,
  ): Promise<{ success: boolean; sizeBytes: number }> {
    const auth = this.permissionController.authorize({
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'system_write_file',
      payload: { filePath, path: filePath, content, overwrite },
      rationale: 'SafeComputerAgencyService writeFile',
      expectedOutcome: 'Write file contents safely',
      riskLevel: 'medium',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    });

    if (!auth.allowed) {
      const err = new Error(
        `Authorization denied for writeFile("${filePath}"): ${auth.denialReason || 'Blocked by security policy'}`,
      );
      this.logger.error(err.message);
      throw err;
    }

    const resolved = path.resolve(filePath);
    if (fs.existsSync(resolved) && !overwrite) {
      throw new Error(`File already exists and overwrite=false: ${resolved}`);
    }
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(resolved, content, 'utf-8');
    const stat = await fs.promises.stat(resolved);
    return { success: true, sizeBytes: stat.size };
  }

  /**
   * Safely lists files in directory. Gated through ActionPermissionController.
   */
  public async listFiles(dirPath: string): Promise<string[]> {
    const auth = this.permissionController.authorize({
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'system_list_directory',
      payload: { dirPath, path: dirPath },
      rationale: 'SafeComputerAgencyService listFiles',
      expectedOutcome: 'List directory entries safely',
      riskLevel: 'low',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    });

    if (!auth.allowed) {
      const err = new Error(
        `Authorization denied for listFiles("${dirPath}"): ${auth.denialReason || 'Blocked by security policy'}`,
      );
      this.logger.error(err.message);
      throw err;
    }

    const resolved = path.resolve(dirPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Directory not found: ${resolved}`);
    }
    return fs.promises.readdir(resolved);
  }

  /**
   * Safely executes an argument-based command without shell string interpolation. Gated through ActionPermissionController.
   */
  public async executeCommand(
    command: string,
    args: string[] = [],
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const auth = this.permissionController.authorize({
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'execute_command',
      payload: { command, executable: command, args },
      rationale: `SafeComputerAgencyService executeCommand: ${command}`,
      expectedOutcome: 'Execute command safely',
      riskLevel: 'high',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    });

    if (!auth.allowed) {
      const err = new Error(
        `Authorization denied for executeCommand("${command}"): ${auth.denialReason || 'Blocked by security policy'}`,
      );
      this.logger.error(err.message);
      throw err;
    }

    return new Promise((resolve) => {
      const child = spawn(command, args, {
        env: {
          ...process.env,
          DISPLAY: this.display,
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (d) => (stdout += d.toString()));
      child.stderr?.on('data', (d) => (stderr += d.toString()));

      child.on('close', (code) => {
        resolve({
          exitCode: code ?? 0,
          stdout,
          stderr,
        });
      });

      child.on('error', (err) => {
        resolve({
          exitCode: 1,
          stdout,
          stderr: err.message,
        });
      });
    });
  }
}
