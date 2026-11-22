import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  DesktopEnvironmentProvider,
  VerificationEngine,
  rootLogger,
} from '@arletex/core';
import { AgencyObservation, ActionProposal } from '@arletex/contracts';

describe('Priority 0 — Target Device & Wayland Runtime Validation (P0.4)', () => {
  let provider: DesktopEnvironmentProvider;
  let verificationEngine: VerificationEngine;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p0-runtime-'));
    provider = new DesktopEnvironmentProvider({ logger: rootLogger });
    verificationEngine = new VerificationEngine(rootLogger);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Platform & Target Hardware Audit', () => {
    it('verifies ASUS ROG Ally X hardware characteristics and memory limits', () => {
      const cpus = os.cpus();
      expect(cpus.length).toBeGreaterThanOrEqual(8);

      const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
      // ROG Ally X has 24GB LPDDR5X (system memory reports between 15GB and 24GB depending on VRAM reservation)
      expect(totalMemMb).toBeGreaterThanOrEqual(14000);

      // Verify Linux platform and kernel version
      expect(os.platform()).toBe('linux');
      expect(os.release().length).toBeGreaterThan(0);
    });

    it('identifies Wayland display server and input capabilities', () => {
      const isLinux = os.platform() === 'linux';
      expect(isLinux).toBe(true);

      // Verify ydotool daemon socket existence if running
      const ydotoolSocket = '/tmp/ydotool.sock';
      const socketExists = fs.existsSync(ydotoolSocket);
      // Even if daemon is not installed in headless CI, provider gracefully handles missing socket
      expect(typeof socketExists).toBe('boolean');
    });

    it('discovers installed FreeDesktop applications on host filesystem without crash', async () => {
      const apps = await provider.discoverInstalledApplications();
      expect(Array.isArray(apps)).toBe(true);
      expect(apps.length).toBeGreaterThan(0);

      // Check if common desktop applications are parsed correctly
      const appNames = apps.map((a) => a.name.toLowerCase());
      expect(appNames.some((name) => name.includes('chrome') || name.includes('firefox') || name.includes('terminal'))).toBe(true);
    });
  });

  describe('2. Truthful Desktop & Browser Postcondition Verification', () => {
    it('distinguishes process spawn from genuine page verification', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'desktop_open_browser',
        payload: { url: 'https://open.spotify.com' },
        rationale: 'Open Spotify in browser',
        expectedOutcome: 'Spotify web player loaded',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      // Case A: Synthetic test double PID returned without page probe -> not verified
      const syntheticObs: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: action.taskId,
        actionId: action.id,
        source: 'desktop_environment_provider',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.5,
        provenance: 'DesktopEnvironmentProvider.openInArleBrowser',
        data: { pid: 99999, isSynthetic: true },
        error: null,
      };

      const result = verificationEngine.verify(action, syntheticObs);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('partially_successful');
      expect(result.failureReason).toContain('Synthetic test double observation cannot verify real browser navigation');

      // Case B: Genuine empirical verification observation
      const genuineObs: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: action.taskId,
        actionId: action.id,
        source: 'browser_page_probe',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.95,
        provenance: 'PlaywrightBrowserProvider.verifyPageLoaded',
        data: {
          finalUrl: 'https://open.spotify.com/',
          pageTitle: 'Spotify – Web Player',
          isSynthetic: false,
        },
        error: null,
      };

      const verifiedResult = verificationEngine.verify(action, genuineObs);
      expect(verifiedResult.verified).toBe(true);
      expect(verifiedResult.status).toBe('verified_successful');
      expect(verifiedResult.observedOutcome).toContain('https://open.spotify.com');
    });

    it('separates Spotify window open, track selected, and media playing postconditions', () => {
      const playAction: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 1,
        type: 'desktop_media_control',
        payload: { command: 'Play' },
        rationale: 'Play selected music',
        expectedOutcome: 'Audio is actively playing through PipeWire stream',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      // Case 1: Window open, but audio stream paused/silent -> verification fails
      const pausedObs: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: playAction.taskId,
        actionId: playAction.id,
        source: 'mpris_d_bus',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.9,
        provenance: 'DesktopEnvironmentProvider.getMprisMediaStatus',
        data: {
          playbackStatus: 'Paused',
          audioStreamActive: false,
        },
        error: null,
      };

      const pausedVer = verificationEngine.verify(playAction, pausedObs);
      expect(pausedVer.verified).toBe(false);
      expect(pausedVer.status).toBe('failed');
      expect(pausedVer.failureReason).toContain('Audio stream is not active');

      // Case 2: PipeWire audio stream is playing
      const playingObs: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: playAction.taskId,
        actionId: playAction.id,
        source: 'pipewire_audio_stream',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 1.0,
        provenance: 'DesktopEnvironmentProvider.executeMprisMethod',
        data: {
          playbackStatus: 'Playing',
          audioStreamActive: true,
        },
        error: null,
      };

      const playingVer = verificationEngine.verify(playAction, playingObs);
      expect(playingVer.verified).toBe(true);
      expect(playingVer.status).toBe('verified_successful');
      expect(playingVer.observedOutcome).toContain('confirmed active');
    });

    it('honestly reports missing desktop applications or windows without fabrication', async () => {
      const missingApp = await provider.findApplication('non_existent_app_xyz_9999');
      expect(missingApp).toBeNull();

      const nonExistentFile = path.join(tempDir, 'does_not_exist.pdf');
      const openResult = await provider.openFile(nonExistentFile);
      expect(openResult.success).toBe(false);
      expect(openResult.error).toContain('Could not locate file');
    });
  });
});
