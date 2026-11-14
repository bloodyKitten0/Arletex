import { exec, spawn } from 'node:child_process';
import util from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { rootLogger } from '@arletex/core';

const execPromise = util.promisify(exec);
const logger = rootLogger.child('DeviceAgencyService');
const reflexEnginePath = path.resolve('/home/proof/Documents/A man\'s dream will never die/projects/Arletex/apps/desktop/src/backend/native/reflex_engine');

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

  constructor(display = ':0') {
    this.display = display;
  }

  /**
   * Captures the current active screen/monitor using spectacle (Wayland) or ffmpeg (X11).
   * Returns base64 image data suitable for vision appraisal.
   */
  public async captureScreen(): Promise<ScreenCaptureResult> {
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
        await execPromise(`spectacle -b -n -f -o "${outputPath}"`);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
          captured = true;
        }
      } catch {
        // Fall back to ffmpeg if spectacle is absent
      }

      // 2. Fallback to ffmpeg x11grab
      if (!captured) {
        const cmd = `DISPLAY=${this.display} ffmpeg -y -f x11grab -i ${this.display}.0 -vframes 1 "${outputPath}"`;
        await execPromise(cmd);
      }

      // Convert and downscale to efficient 960x540 JPEG for rapid, token-efficient vision appraisal
      const jpgPath = path.join(tempDir, `screen_${timestamp}_small.jpg`);
      try {
        await execPromise(`ffmpeg -y -i "${outputPath}" -vf scale=960:-1 -q:v 3 "${jpgPath}" 2>/dev/null`);
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
        const probeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${outputPath}"`;
        const { stdout } = await execPromise(probeCmd);
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
   * Executes keyboard and mouse automation using xdotool.
   */
  public async executeDeviceAction(input: DeviceActionInput): Promise<{ success: boolean; message: string }> {
    try {
      const hasReflex = fs.existsSync(reflexEnginePath);
      switch (input.action) {
        case 'mouse_move': {
          if (input.x === undefined || input.y === undefined) {
            throw new Error('x and y coordinates required for mouse_move');
          }
          if (hasReflex) {
            await execPromise(`DISPLAY=${this.display} "${reflexEnginePath}" mouse_move ${input.x} ${input.y}`);
            return { success: true, message: `Moved mouse to (${input.x}, ${input.y}) [C++ Reflex]` };
          }
          await execPromise(`DISPLAY=${this.display} xdotool mousemove ${input.x} ${input.y}`);
          return { success: true, message: `Moved mouse to (${input.x}, ${input.y})` };
        }

        case 'mouse_click': {
          const btn = input.button || 1;
          const x = input.x ?? -1;
          const y = input.y ?? -1;
          if (hasReflex) {
            await execPromise(`DISPLAY=${this.display} "${reflexEnginePath}" mouse_click ${x} ${y} ${btn}`);
            return { success: true, message: `Clicked mouse button ${btn} [C++ Reflex]` };
          }
          if (x >= 0 && y >= 0) {
            await execPromise(`DISPLAY=${this.display} xdotool mousemove ${x} ${y} click ${btn}`);
          } else {
            await execPromise(`DISPLAY=${this.display} xdotool click ${btn}`);
          }
          return { success: true, message: `Clicked mouse button ${btn}` };
        }

        case 'type_text': {
          if (!input.text) throw new Error('text required for type_text');
          const sanitized = String(input.text).replace(/"/g, '\\"');
          if (hasReflex) {
            await execPromise(`DISPLAY=${this.display} "${reflexEnginePath}" type_text "${sanitized}"`);
            return { success: true, message: `Typed text: "${input.text}" [C++ Reflex]` };
          }
          await execPromise(`DISPLAY=${this.display} xdotool type --delay 20 "${sanitized}"`);
          return { success: true, message: `Typed text: "${input.text}"` };
        }

        case 'key_press': {
          if (!input.key) throw new Error('key required for key_press');
          if (hasReflex) {
            await execPromise(`DISPLAY=${this.display} "${reflexEnginePath}" key_press "${input.key}"`);
            return { success: true, message: `Pressed key: ${input.key} [C++ Reflex]` };
          }
          await execPromise(`DISPLAY=${this.display} xdotool key --clearmodifiers "${input.key}"`);
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
   * Opens Google Chrome under Arle's dedicated profile (Profile 7 - arletex.email@gmail.com).
   */
  public async openChromeBrowser(targetUrl = 'https://google.com'): Promise<{ success: boolean; message: string }> {
    try {
      const url = targetUrl || 'https://google.com';
      const now = Date.now();

      // De-duplicate: do not spam open tabs if navigated recently within 25 seconds
      const isDuplicate =
        this.lastOpenedUrl === url ||
        (url.includes('youtube.com/watch') && this.lastOpenedUrl?.includes('youtube.com/watch'));

      if (isDuplicate && now - this.lastOpenedTime < 25000) {
        logger.info(`Chrome already navigated to ${url} recently. Suppressing duplicate tab opening.`);
        // Ensure Chrome is brought to the foreground (click Chrome icon on KDE panel at 278, 1060)
        if (fs.existsSync(reflexEnginePath)) {
          await execPromise(`DISPLAY=${this.display} "${reflexEnginePath}" mouse_click 278 1060 1`).catch(() => {});
        } else {
          await execPromise(`DISPLAY=${this.display} xdotool mousemove 278 1060 click 1`).catch(() => {});
        }
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

      // Check if Chrome is already active on host
      const checkRes = await execPromise(`pgrep -u proof -f chrome 2>/dev/null || true`);
      const isChromeRunning = checkRes.stdout.trim().length > 0;

      const chromeArgs = isChromeRunning
        ? ['run', 'com.google.Chrome', url]
        : ['run', 'com.google.Chrome', `--profile-directory=${this.chromeProfile}`, url];

      // Spawn flatpak Google Chrome asynchronously so it does not block the backend process
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

      // Ensure Chrome window is focused on screen
      setTimeout(async () => {
        // Bring Chrome to the front by clicking Chrome on KDE panel (278, 1060)
        if (fs.existsSync(reflexEnginePath)) {
          await execPromise(`DISPLAY=${this.display} "${reflexEnginePath}" mouse_click 278 1060 1`).catch(() => {});
        } else {
          await execPromise(`DISPLAY=${this.display} xdotool mousemove 278 1060 click 1`).catch(() => {});
        }
        // If media/youtube, trigger spacebar to initiate playback
        if (url.includes('youtube.com')) {
          setTimeout(async () => {
            if (fs.existsSync(reflexEnginePath)) {
              await execPromise(`DISPLAY=${this.display} "${reflexEnginePath}" key_press "space"`).catch(() => {});
            } else {
              await execPromise(`DISPLAY=${this.display} xdotool key space`).catch(() => {});
            }
          }, 1200);
        }
      }, 700);

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
   */
  public async launchSteam(appId?: string): Promise<{ success: boolean; message: string }> {
    try {
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
