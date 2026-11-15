import { execFile } from 'node:child_process';
import util from 'node:util';
import { rootLogger, ILogger } from '@arletex/core';
import { defaultDeviceAgency, DeviceAgencyService } from './deviceAgencyService.js';

const execFilePromise = util.promisify(execFile);

export interface VisibleWindowInfo {
  id: string;
  desktop: number;
  client: string;
  title: string;
}

export interface ScreenVisualReading {
  timestamp: string;
  imagePath: string;
  imageBase64: string;
  width: number;
  height: number;
  visibleWindows: VisibleWindowInfo[];
  visualDescription: string;
  reasoning?: string;
  detectedDialogue?: string[];
  interactiveHints?: Array<{ element: string; x?: number; y?: number }>;
}

export class ScreenReadingService {
  private logger: ILogger;
  private deviceAgency: DeviceAgencyService;
  private display: string;

  constructor(
    deviceAgency: DeviceAgencyService = defaultDeviceAgency,
    display = ':0',
    logger: ILogger = rootLogger,
  ) {
    this.deviceAgency = deviceAgency;
    this.display = display;
    this.logger = logger.child('ScreenReadingService');
  }

  /**
   * Discovers active media playback on the host (e.g. YouTube in Chrome/Firefox)
   * via system MPRIS DBus interfaces in real time.
   */
  public async getActiveMediaInfo(): Promise<{ isPlaying: boolean; title?: string; artist?: string } | null> {
    try {
      let busList = '';
      try {
        const res = await execFilePromise('busctl', ['--user', 'list'], { timeout: 3000 });
        busList = res.stdout;
      } catch {
        return null;
      }
      const services = [...busList.matchAll(/org\.mpris\.MediaPlayer2\.[a-zA-Z0-9_.-]+/g)].map((m) => m[0]);

      for (const service of services) {
        try {
          // Strictly verify active playback status
          const statusRes = await execFilePromise(
            'busctl',
            ['--user', 'get-property', service, '/org/mpris/MediaPlayer2', 'org.mpris.MediaPlayer2.Player', 'PlaybackStatus'],
            { timeout: 2000 },
          );
          if (!/s\s+"Playing"/i.test(statusRes.stdout)) {
            continue;
          }

          const metaRes = await execFilePromise(
            'busctl',
            ['--user', 'get-property', service, '/org/mpris/MediaPlayer2', 'org.mpris.MediaPlayer2.Player', 'Metadata'],
            { timeout: 2000 },
          );
          const metaOut = metaRes.stdout;
          const titleMatch = metaOut.match(/"xesam:title"\s+s\s+"([^"]+)"/);
          const artistMatch = metaOut.match(/"xesam:artist"\s+as\s+\d+\s+"([^"]+)"/);

          if (titleMatch && titleMatch[1]) {
            const rawTitle = titleMatch[1].replace(/\\([0-7]{1,3})/g, (_m, oct) =>
              String.fromCharCode(parseInt(oct, 8)),
            );
            const rawArtist = artistMatch && artistMatch[1]
              ? artistMatch[1].replace(/\\([0-7]{1,3})/g, (_m, oct) =>
                  String.fromCharCode(parseInt(oct, 8)),
                )
              : 'Unknown';

            return {
              isPlaying: true,
              title: rawTitle,
              artist: rawArtist,
            };
          }
        } catch {}
      }
      return null;
    } catch (err: any) {
      this.logger.debug(`getActiveMediaInfo note: ${err.message}`);
      return null;
    }
  }

  /**
   * Retrieves list of visible application windows on the X11 desktop via wmctrl.
   */
  public async getVisibleWindows(): Promise<VisibleWindowInfo[]> {
    try {
      let stdout = '';
      try {
        const res = await execFilePromise('wmctrl', ['-l'], {
          env: { ...process.env, DISPLAY: this.display },
          timeout: 4000,
        });
        stdout = res.stdout;
      } catch {
        return [];
      }
      const lines = stdout.trim().split('\n').filter(Boolean);
      const windows: VisibleWindowInfo[] = [];

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          const id = parts[0]!;
          const desktop = parseInt(parts[1]!, 10) || 0;
          const client = parts[2]!;
          const title = parts.slice(3).join(' ');
          windows.push({ id, desktop, client, title });
        }
      }
      return windows;
    } catch (err: any) {
      this.logger.warn(`Failed to list visible windows: ${err.message}`);
      return [];
    }
  }

  /**
   * Focuses an application window by title or class name using wmctrl/xdotool.
   * Safe execution using argument arrays to prevent shell interpolation.
   */
  public async focusWindow(query: string): Promise<boolean> {
    if (!query || typeof query !== 'string') return false;
    try {
      this.logger.info(`Focusing window matching: "${query}"`);
      // 1. Try wmctrl with direct argument array
      try {
        await execFilePromise('wmctrl', ['-a', query], {
          env: { ...process.env, DISPLAY: this.display },
          timeout: 4000,
        });
        return true;
      } catch {
        // 2. Fallback to xdotool search
        try {
          const { stdout } = await execFilePromise(
            'xdotool',
            ['search', '--onlyvisible', '--name', query],
            {
              env: { ...process.env, DISPLAY: this.display },
              timeout: 4000,
            },
          );
          const firstLine = stdout.trim().split('\n')[0]?.trim();
          if (firstLine && /^\d+$/.test(firstLine)) {
            await execFilePromise('xdotool', ['windowactivate', firstLine], {
              env: { ...process.env, DISPLAY: this.display },
              timeout: 4000,
            });
            return true;
          }
        } catch {}
      }
      return false;
    } catch (err: any) {
      this.logger.warn(`Could not focus window "${query}": ${err.message}`);
      return false;
    }
  }

  /**
   * Captures screen and performs multimodal visual inspection using the local VLM (Qwen3.5 with mmproj).
   * Extracts visual state, visible messages, and interaction areas without any tokens.
   */
  public async readAndAnalyzeScreen(
    userInstruction = 'Inspect the screen. Identify open applications, visible messages from Proof, and key UI coordinates.',
  ): Promise<ScreenVisualReading> {
    this.logger.info('Performing embodied screen capture and visual reading...');

    // 1. Capture screen
    const capture = await this.deviceAgency.captureScreen();
    const visibleWindows = await this.getVisibleWindows();

    // 2. Query local VLM on port 8080 with mmproj
    let visualDescription = '';
    let reasoning = '';

    try {
      const windowSummary = visibleWindows.length > 0
        ? `Known open windows: ${visibleWindows.map((w) => `[${w.client}: ${w.title}]`).join(', ')}`
        : 'No specific window titles queried.';

      const vlmPrompt = `${userInstruction}\n\nDesktop Context:\nResolution: ${capture.width}x${capture.height}\n${windowSummary}\n\nProvide a concise analysis: what is currently displayed, any chat/dialogue text visible, and coordinates if actionable.`;

      const res = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Qwen2.5-14B-Uncensored-Q4_K_M',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: vlmPrompt },
                { type: 'image_url', image_url: { url: capture.imageBase64 } },
              ],
            },
          ],
          max_tokens: 600,
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        const msg = data.choices?.[0]?.message;
        if (msg) {
          visualDescription = msg.content?.trim() || '';
          reasoning = msg.reasoning_content?.trim() || '';
          if (!visualDescription && reasoning) {
            visualDescription = reasoning;
          }
        }
      } else {
        this.logger.warn(`VLM screen reading HTTP ${res.status}: ${await res.text()}`);
      }
    } catch (vlmErr: any) {
      this.logger.warn(`VLM screen reading error: ${vlmErr.message}`);
    }

    if (!visualDescription) {
      visualDescription = `Captured desktop monitor (${capture.width}x${capture.height}). Windows visible: ${visibleWindows.map((w) => w.title).join(', ') || 'Desktop workspace'}.`;
    }

    return {
      timestamp: new Date().toISOString(),
      imagePath: capture.imagePath,
      imageBase64: capture.imageBase64,
      width: capture.width,
      height: capture.height,
      visibleWindows,
      visualDescription,
      reasoning,
    };
  }

  /**
   * Types text and sends it to the active or specified window using physical mouse and keyboard automation.
   * Completely replaces external bot tokens with embodied desktop interaction.
   */
  public async typeAndSend(
    text: string,
    options?: { windowTitle?: string; x?: number; y?: number; sendEnter?: boolean },
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (options?.windowTitle) {
        await this.focusWindow(options.windowTitle);
        // Short pause for window focus
        await new Promise((r) => setTimeout(r, 150));
      }

      if (options?.x !== undefined && options?.y !== undefined) {
        await this.deviceAgency.executeDeviceAction({
          action: 'mouse_click',
          x: options.x,
          y: options.y,
        });
        await new Promise((r) => setTimeout(r, 100));
      }

      // Type the text with delay
      const typeResult = await this.deviceAgency.executeDeviceAction({
        action: 'type_text',
        text,
      });

      if (!typeResult.success) {
        return typeResult;
      }

      // Send Enter key unless suppressed
      if (options?.sendEnter !== false) {
        await new Promise((r) => setTimeout(r, 50));
        await this.deviceAgency.executeDeviceAction({
          action: 'key_press',
          key: 'Return',
        });
      }

      return {
        success: true,
        message: `Typed "${text.slice(0, 30)}..." and pressed Return via physical keyboard automation.`,
      };
    } catch (err: any) {
      this.logger.error('Failed to type and send via mouse/keyboard', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Clicks at specific screen coordinates using xdotool.
   */
  public async clickAt(x: number, y: number, button = 1): Promise<{ success: boolean; message: string }> {
    return this.deviceAgency.executeDeviceAction({
      action: 'mouse_click',
      x,
      y,
      button,
    });
  }
}

export const defaultScreenReadingService = new ScreenReadingService();
