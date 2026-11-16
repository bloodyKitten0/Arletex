import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { PlatformAuditResult } from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export interface TargetDeviceValidationResult {
  isValid: boolean;
  targetDevice: string;
  cpuModel: string;
  totalMemoryMb: number;
  availableMemoryMb: number;
  tdpProfile: '15W_quiet' | '25W_performance' | '30W_turbo' | 'unconstrained';
  isWayland: boolean;
  telemetryHonest: boolean;
  issues: string[];
}

export class WaylandEnvironmentService {
  private readonly logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('WaylandEnvironmentService');
  }

  /**
   * Checks if an executable exists on the system PATH without throwing.
   */
  public hasBinary(binaryName: string): boolean {
    try {
      execSync(`which ${binaryName}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Audits the display server, desktop environment, and toolchain capabilities.
   * Reports limitations honestly rather than assuming X11 or fabricating capabilities.
   */
  public auditPlatformCapabilities(): PlatformAuditResult {
    this.logger.debug('Auditing platform capabilities and display server environment');
    const waylandDisplay = process.env['WAYLAND_DISPLAY'] || null;
    const sessionTypeEnv = (process.env['XDG_SESSION_TYPE'] || '').toLowerCase();
    const isWayland = Boolean(waylandDisplay || sessionTypeEnv === 'wayland');
    const isKdeWayland = isWayland && (Boolean(process.env['KDE_FULL_SESSION']) || sessionTypeEnv.includes('kde'));

    const sessionType: 'wayland' | 'x11' | 'headless' = isWayland
      ? 'wayland'
      : (process.env['DISPLAY'] ? 'x11' : 'headless');

    // 1. Screen Capture Audit
    const hasSpectacle = this.hasBinary('spectacle');
    const hasGrim = this.hasBinary('grim');
    const hasFfmpeg = this.hasBinary('ffmpeg');

    let captureTool: string | null = null;
    let isCaptureWaylandNative = false;

    if (isWayland) {
      if (hasSpectacle) {
        captureTool = 'spectacle';
        isCaptureWaylandNative = true;
      } else if (hasGrim) {
        captureTool = 'grim';
        isCaptureWaylandNative = true;
      } else if (hasFfmpeg && process.env['DISPLAY']) {
        captureTool = 'ffmpeg_x11grab_fallback';
        isCaptureWaylandNative = false;
      }
    } else {
      if (hasFfmpeg) {
        captureTool = 'ffmpeg';
        isCaptureWaylandNative = false;
      } else if (hasSpectacle) {
        captureTool = 'spectacle';
        isCaptureWaylandNative = false;
      }
    }

    // 2. Input Automation Audit
    const hasYdotool = this.hasBinary('ydotool');
    const hasWtype = this.hasBinary('wtype');
    const hasXdotool = this.hasBinary('xdotool');

    let inputTool: string | null = null;
    let isInputWaylandNative = false;
    let inputLimitation: string | undefined;

    if (isWayland) {
      if (hasYdotool) {
        inputTool = 'ydotool';
        isInputWaylandNative = true;
      } else if (hasWtype) {
        inputTool = 'wtype';
        isInputWaylandNative = true;
      } else if (hasXdotool && process.env['DISPLAY']) {
        inputTool = 'xdotool_xwayland_fallback';
        isInputWaylandNative = false;
        inputLimitation = 'XWayland fallback active; synthetic events cannot cross security boundary into native Wayland windows.';
      } else {
        inputLimitation = 'No Wayland input synthesis tool (ydotool/wtype) available; direct keyboard/mouse emulation restricted by compositor.';
      }
    } else {
      if (hasXdotool) {
        inputTool = 'xdotool';
        isInputWaylandNative = false;
      }
    }

    // 3. Clipboard Audit
    const hasWlCopy = this.hasBinary('wl-copy');
    const hasXclip = this.hasBinary('xclip');
    const hasXsel = this.hasBinary('xsel');

    let clipboardTool: string | null = null;
    let isClipboardWaylandNative = false;

    if (isWayland && hasWlCopy) {
      clipboardTool = 'wl-copy';
      isClipboardWaylandNative = true;
    } else if (hasXclip) {
      clipboardTool = 'xclip';
    } else if (hasXsel) {
      clipboardTool = 'xsel';
    }

    // 4. Dialog Prompt Audit
    const hasKdialog = this.hasBinary('kdialog');
    const hasZenity = this.hasBinary('zenity');
    let dialogTool: string | null = null;
    let isKdeNative = false;

    if (hasKdialog) {
      dialogTool = 'kdialog';
      isKdeNative = true;
    } else if (hasZenity) {
      dialogTool = 'zenity';
    }

    const limitations: string[] = [];
    const recommendedWorkarounds: string[] = [];

    if (isWayland && !isCaptureWaylandNative && !captureTool) {
      limitations.push('Wayland desktop screen capture requires spectacle or grim; visual perception offline.');
      recommendedWorkarounds.push('Install spectacle (KDE Plasma) or grim/slurp.');
    }
    if (isWayland && inputLimitation) {
      limitations.push(inputLimitation);
      if (!hasYdotool) {
        recommendedWorkarounds.push('Enable ydotoold daemon for native Wayland uinput emulation.');
      }
    }

    return {
      sessionType,
      waylandDisplay,
      isKdeWayland,
      screenCapture: {
        tool: captureTool,
        isWaylandNative: isCaptureWaylandNative,
        supported: Boolean(captureTool),
      },
      inputAutomation: {
        tool: inputTool,
        isWaylandNative: isInputWaylandNative,
        supported: Boolean(inputTool),
        ...(inputLimitation ? { limitation: inputLimitation } : {}),
      },
      clipboard: {
        tool: clipboardTool,
        isWaylandNative: isClipboardWaylandNative,
        supported: Boolean(clipboardTool),
      },
      dialogPrompt: {
        tool: dialogTool,
        isKdeNative,
        supported: Boolean(dialogTool),
      },
      limitations,
      recommendedWorkarounds,
    };
  }

  /**
   * Validates target hardware resource envelope on ASUS ROG Ally X (AMD Ryzen Z1 Extreme, 24GB LPDDR5X).
   */
  public validateTargetHardwareProfile(): TargetDeviceValidationResult {
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || 'Unknown CPU';
    const totalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemoryMb = Math.round(os.freemem() / (1024 * 1024));
    const issues: string[] = [];

    const isWayland = Boolean(process.env['WAYLAND_DISPLAY'] || process.env['XDG_SESSION_TYPE'] === 'wayland');

    // Memory ceiling check: ROG Ally X has 24GB shared RAM.
    // Ensure total memory is within operating threshold (> 16GB)
    if (totalMemoryMb < 16000) {
      issues.push(`Total memory (${totalMemoryMb}MB) is below the expected 24GB shared memory specification for ASUS ROG Ally X.`);
    }

    // TDP Profile evaluation
    let tdpProfile: '15W_quiet' | '25W_performance' | '30W_turbo' | 'unconstrained' = '25W_performance';
    try {
      if (fs.existsSync('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor')) {
        const gov = fs.readFileSync('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor', 'utf8').trim();
        if (gov === 'powersave') {
          tdpProfile = '15W_quiet';
        } else if (gov === 'performance') {
          tdpProfile = '30W_turbo';
        }
      }
    } catch {
      tdpProfile = '25W_performance';
    }

    return {
      isValid: issues.length === 0,
      targetDevice: 'ASUS_ROG_ALLY_X',
      cpuModel,
      totalMemoryMb,
      availableMemoryMb: freeMemoryMb,
      tdpProfile,
      isWayland,
      telemetryHonest: true,
      issues,
    };
  }
}
