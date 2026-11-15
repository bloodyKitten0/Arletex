import { execFile, spawn } from 'node:child_process';
import util from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { rootLogger, ActionPermissionController } from '@arletex/core';

const execFilePromise = util.promisify(execFile);
const logger = rootLogger.child('DeviceAgencyService');

function findReflexEngine(): string {
  if (process.env['REFLEX_ENGINE_PATH'] && fs.existsSync(process.env['REFLEX_ENGINE_PATH'])) {
    return process.env['REFLEX_ENGINE_PATH'];
  }
  const local = path.resolve(__dirname, 'native/reflex_engine');
  if (fs.existsSync(local)) return local;
  const devPath = path.resolve(__dirname, '../../src/backend/native/reflex_engine');
  if (fs.existsSync(devPath)) return devPath;
  const buildPath = path.resolve(__dirname, '../../../native/build/reflex_engine');
  if (fs.existsSync(buildPath)) return buildPath;
  return local;
}

export interface ScreenCaptureResult {
  imagePath: string;
  imageBase64: string;
  width: number;
  height: number;
}

export interface DeviceActionInput {
  action: 'mouse_move' | 'mouse_click' | 'key_press' | 'type_text' | 'open_browser' | 'launch_steam';
  x?: number;
  y?: number;
  button?: number; // 1 = left, 2 = middle, 3 = right
  text?: number | string;
  key?: string;
  url?: string;
  steamAppId?: string;
}

export class DeviceAgencyService {
  private display = ':0';
  private chromeProfile = 'Profile 7'; // arletex.email@gmail.com
  private lastOpenedUrl: string | null = null;
  private lastOpenedTime = 0;
  private permissionController: ActionPermissionController;

  constructor(
    permissionControllerOrDisplay?: ActionPermissionController | string,
    maybeDisplay = ':0'
  ) {
    if (typeof permissionControllerOrDisplay === 'string') {
      this.permissionController = new ActionPermissionController();
      this.display = permissionControllerOrDisplay;
    } else {
      this.permissionController = permissionControllerOrDisplay ?? new ActionPermissionController();
      this.display = maybeDisplay;
    }
  }

  public setPermissionController(controller: ActionPermissionController): void {
    this.permissionController = controller;
  }

  /**
   * Captures the current active screen/monitor using spectacle (Wayland) or ffmpeg (X11).
   * Validated through mandatory ActionPermissionController.
   */
  public async captureScreen(): Promise<ScreenCaptureResult> {
    const auth = this.permissionController.authorize({
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'desktop_take_screenshot',
      rationale: 'Capture screen monitor frame for vision appraisal',
      expectedOutcome: 'Valid screen image captured',
      requiresExplicitApproval: false,
      riskLevel: 'low',
      payload: {},
      createdAt: new Date().toISOString(),
    });

    if (!auth.allowed) {
      logger.warn(`Screen capture rejected by permission controller: ${auth.denialReason}`);
      throw new Error(`Screen capture disallowed: ${auth.denialReason || 'Unauthorized'}`);
    }

    const timestamp = Date.now();
    const tempDir = '/tmp/arletex_vision';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const outputPath = path.join(tempDir, `screen_${timestamp}.png`);

    try {
      let captured = false;

      // 1. In KDE Wayland environments (Bazzite / Plasma), spectacle provides instant non-blocking capture of the true desktop
      try {
        await execFilePromise('spectacle', ['-b', '-n', '-f', '-o', outputPath]);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
          captured = true;
        }
      } catch {
        // Fall back to ffmpeg if spectacle is absent
      }

      // 2. Fallback to ffmpeg x11grab
      if (!captured) {
        await execFilePromise('ffmpeg', [
          '-y',
          '-f',
          'x11grab',
          '-i',
          `${this.display}.0`,
          '-vframes',
          '1',
          outputPath,
        ], {
          env: { ...process.env, DISPLAY: this.display },
        });
      }

      // Convert and downscale to efficient 960x540 JPEG for rapid, token-efficient vision appraisal
      const jpgPath = path.join(tempDir, `screen_${timestamp}_small.jpg`);
      try {
        await execFilePromise('ffmpeg', [
          '-y',
          '-i',
          outputPath,
          '-vf',
          'scale=960:-1',
          '-q:v',
          '3',
          jpgPath,
        ]);
      } catch {}

      const finalPath = fs.existsSync(jpgPath) ? jpgPath : outputPath;
      const buffer = fs.readFileSync(finalPath);
      const mime = finalPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
      const imageBase64 = `data:${mime};base64,${buffer.toString('base64')}`;

      // Clean up raw heavy png if downscaled jpg exists
      if (fs.existsSync(jpgPath) && fs.existsSync(outputPath)) {
        try { fs.unlinkSync(outputPath); } catch {}
      }

      // Get dimensions via ffprobe
      let width = 1920;
      let height = 1080;
      try {
        const { stdout } = await execFilePromise('ffprobe', [
          '-v',
          'error',
          '-select_streams',
          'v:0',
          '-show_entries',
          'stream=width,height',
          '-of',
          'csv=s=x:p=0',
          finalPath,
        ]);
        const parts = stdout.trim().split('x');
        if (parts.length === 2) {
          width = parseInt(parts[0]!, 10);
          height = parseInt(parts[1]!, 10);
        }
      } catch {}

      return {
        imagePath: outputPath,
        imageBase64,
        width,
        height,
      };
    } catch (err: any) {
      logger.error('Failed to capture screen', err);
      throw new Error(`Screen capture failed: ${err.message}`);
    }
  }

  /**
   * Executes keyboard and mouse automation via reflex_engine or xdotool.
   * Every action must pass through ActionPermissionController.
   */
  public async executeDeviceAction(input: DeviceActionInput): Promise<{ success: boolean; message: string }> {
    const auth = this.permissionController.authorize({
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: `desktop_${input.action}` as any,
      rationale: `Execute ${input.action} action`,
      expectedOutcome: `Successfully performed ${input.action}`,
      requiresExplicitApproval: false,
      riskLevel: 'medium',
      payload: { ...input },
      createdAt: new Date().toISOString(),
    });

    if (!auth.allowed) {
      logger.warn(`Device action '${input.action}' rejected by permission controller: ${auth.denialReason}`);
      return { success: false, message: `Permission Denied: ${auth.denialReason || 'Unauthorized action'}` };
    }

    try {
      const reflexBin = findReflexEngine();
      const hasReflex = fs.existsSync(reflexBin);

      switch (input.action) {
        case 'mouse_move': {
          if (input.x === undefined || input.y === undefined) {
            throw new Error('x and y coordinates required for mouse_move');
          }
          if (hasReflex) {
            await execFilePromise(reflexBin, ['mouse_move', String(input.x), String(input.y)], {
              env: { ...process.env, DISPLAY: this.display },
            });
            return { success: true, message: `Moved mouse to (${input.x}, ${input.y}) [C++ Reflex]` };
          }
          await execFilePromise('xdotool', ['mousemove', String(input.x), String(input.y)], {
            env: { ...process.env, DISPLAY: this.display },
          });
          return { success: true, message: `Moved mouse to (${input.x}, ${input.y})` };
        }

        case 'mouse_click': {
          const btn = input.button || 1;
          const x = input.x ?? -1;
          const y = input.y ?? -1;
          if (hasReflex) {
            await execFilePromise(reflexBin, ['mouse_click', String(x), String(y), String(btn)], {
              env: { ...process.env, DISPLAY: this.display },
            });
            return { success: true, message: `Clicked mouse button ${btn} [C++ Reflex]` };
          }
          if (x >= 0 && y >= 0) {
            await execFilePromise('xdotool', ['mousemove', String(x), String(y), 'click', String(btn)], {
              env: { ...process.env, DISPLAY: this.display },
            });
          } else {
            await execFilePromise('xdotool', ['click', String(btn)], {
              env: { ...process.env, DISPLAY: this.display },
            });
          }
          return { success: true, message: `Clicked mouse button ${btn}` };
        }

        case 'type_text': {
          if (!input.text) throw new Error('text required for type_text');
          const textVal = String(input.text);
          if (hasReflex) {
            await execFilePromise(reflexBin, ['type_text', textVal], {
              env: { ...process.env, DISPLAY: this.display },
            });
            return { success: true, message: `Typed text: "${textVal}" [C++ Reflex]` };
          }
          await execFilePromise('xdotool', ['type', '--delay', '20', textVal], {
            env: { ...process.env, DISPLAY: this.display },
          });
          return { success: true, message: `Typed text: "${textVal}"` };
        }

        case 'key_press': {
          if (!input.key) throw new Error('key required for key_press');
          if (hasReflex) {
            await execFilePromise(reflexBin, ['key_press', input.key], {
              env: { ...process.env, DISPLAY: this.display },
            });
            return { success: true, message: `Pressed key: ${input.key} [C++ Reflex]` };
          }
          await execFilePromise('xdotool', ['key', '--clearmodifiers', input.key], {
            env: { ...process.env, DISPLAY: this.display },
          });
          return { success: true, message: `Pressed key: ${input.key}` };
        }

        case 'open_browser': {
          return this.openChromeBrowser(input.url);
        }

        case 'launch_steam': {
          return this.launchSteam(input.steamAppId);
        }

        default:
          throw new Error(`Unsupported device action: ${(input as any).action}`);
      }
    } catch (err: any) {
      logger.error('Device action execution error', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Opens Google Chrome under Arle's dedicated profile.
   * Gated through ActionPermissionController.
   */
  public async openChromeBrowser(targetUrl = 'https://google.com'): Promise<{ success: boolean; message: string }> {
    const url = targetUrl || 'https://google.com';
    const auth = this.permissionController.authorize({
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'web_navigate',
      rationale: `Navigate to URL: ${url}`,
      expectedOutcome: 'Open browser tab to destination URL',
      requiresExplicitApproval: false,
      riskLevel: 'low',
      payload: { url },
      createdAt: new Date().toISOString(),
    });

    if (!auth.allowed) {
      logger.warn(`Browser navigation to ${url} rejected: ${auth.denialReason}`);
      return { success: false, message: `Permission Denied: ${auth.denialReason || 'Unauthorized navigation'}` };
    }

    try {
      const now = Date.now();

      // De-duplicate: do not spam open tabs if navigated recently within 25 seconds
      const isDuplicate =
        this.lastOpenedUrl === url ||
        (url.includes('youtube.com/watch') && this.lastOpenedUrl?.includes('youtube.com/watch'));

      if (isDuplicate && now - this.lastOpenedTime < 25000) {
        logger.info(`Chrome already navigated to ${url} recently. Suppressing duplicate tab opening.`);
        return {
          success: true,
          message: `Browser already open at ${url} (duplicate opening suppressed, brought to focus)`,
        };
      }

      this.lastOpenedUrl = url;
      this.lastOpenedTime = now;
      logger.info(`Opening Chrome to: ${url}`);

      const envVars = {
        ...process.env,
        DISPLAY: this.display,
        WAYLAND_DISPLAY: process.env['WAYLAND_DISPLAY'] || 'wayland-1',
        XDG_RUNTIME_DIR: process.env['XDG_RUNTIME_DIR'] || '/run/user/1000',
        XDG_SESSION_TYPE: 'wayland',
      };

      // Check if Chrome is already active on host (no hardcoded username!)
      let isChromeRunning = false;
      try {
        const checkRes = await execFilePromise('pgrep', ['-f', 'chrome']);
        isChromeRunning = checkRes.stdout.trim().length > 0;
      } catch {}

      const chromeArgs = isChromeRunning
        ? ['run', 'com.google.Chrome', url]
        : ['run', 'com.google.Chrome', `--profile-directory=${this.chromeProfile}`, url];

      // Spawn flatpak Google Chrome asynchronously with argument arrays
      const child = spawn(
        'flatpak',
        chromeArgs,
        {
          detached: true,
          stdio: 'ignore',
          env: envVars,
        },
      );
      child.unref();

      return {
        success: true,
        message: `Chrome opened with profile ${this.chromeProfile} (arletex.email@gmail.com) at ${url}`,
      };
    } catch (err: any) {
      logger.error('Failed to launch Chrome with Arle profile', err);
      return { success: false, message: `Failed to open Chrome: ${err.message}` };
    }
  }

  /**
   * Launches Steam or runs a specific game via Steam URL protocol.
   * Gated through ActionPermissionController.
   */
  public async launchSteam(appId?: string): Promise<{ success: boolean; message: string }> {
    const auth = this.permissionController.authorize({
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'app_launch',
      rationale: 'Launch Steam client or game',
      expectedOutcome: 'Steam process running',
      requiresExplicitApproval: false,
      riskLevel: 'low',
      payload: { appName: 'steam', args: appId ? [`steam://run/${appId}`] : [] },
      createdAt: new Date().toISOString(),
    });

    if (!auth.allowed) {
      logger.warn(`Steam launch rejected: ${auth.denialReason}`);
      return { success: false, message: `Permission Denied: ${auth.denialReason || 'Unauthorized launch'}` };
    }

    try {
      if (!appId) {
        try {
          const check = await execFilePromise('pgrep', ['-x', 'steam']);
          if (check.stdout.trim().length > 0) {
            logger.info('Steam client is already running on host.');
            return { success: true, message: 'Steam client is already running' };
          }
        } catch {}
      }

      const args = appId ? [`steam://run/${appId}`] : [];
      logger.info(`Launching Steam ${appId ? `for game ID ${appId}` : 'client'}...`);

      const envVars = {
        ...process.env,
        DISPLAY: this.display,
        WAYLAND_DISPLAY: process.env['WAYLAND_DISPLAY'] || 'wayland-1',
        XDG_RUNTIME_DIR: process.env['XDG_RUNTIME_DIR'] || '/run/user/1000',
        XDG_SESSION_TYPE: 'wayland',
      };

      const child = spawn('steam', args, {
        detached: true,
        stdio: 'ignore',
        env: envVars,
      });
      child.unref();

      return {
        success: true,
        message: appId ? `Steam launched game ID ${appId}` : 'Steam client launched',
      };
    } catch (err: any) {
      logger.error('Failed to launch Steam', err);
      return { success: false, message: `Failed to launch Steam: ${err.message}` };
    }
  }
}

export const defaultDeviceAgency = new DeviceAgencyService();
