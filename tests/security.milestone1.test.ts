import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ActionPermissionController } from '@arletex/core';
import {
  validateMediaFilePath,
  isAuthorizedSender,
} from '../apps/desktop/src/main/mediaSecurity.js';
import { NotificationListenerService } from '../apps/desktop/src/backend/notificationListenerService.js';
import { ScreenReadingService } from '../apps/desktop/src/backend/screenReadingService.js';
import { TelegramBridgeService } from '../apps/desktop/src/backend/telegramBridgeService.js';

describe('Milestone 1 — Security Foundation Verification', () => {
  let tempDir: string;
  let approvedMediaDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m1-security-'));
    approvedMediaDir = path.join(tempDir, 'approved_media');
    fs.mkdirSync(approvedMediaDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('2.1 — Media Protocol Traversal & Containment Validation', () => {
    it('approves legitimate media files residing within approved storage roots', () => {
      const testImg = path.join(approvedMediaDir, 'screenshot.png');
      fs.writeFileSync(testImg, 'fake-png-content');

      const res = validateMediaFilePath(testImg, [approvedMediaDir]);
      expect(res.allowed).toBe(true);
      expect(res.canonicalPath).toBe(fs.realpathSync(testImg));
      expect(res.mimeType).toBe('image/png');
    });

    it('rejects attempts to disclose arbitrary system files like /etc/passwd', () => {
      const res = validateMediaFilePath('/etc/passwd', [approvedMediaDir]);
      expect(res.allowed).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.reason).toMatch(/outside approved media storage roots|Disallowed/i);
    });

    it('rejects path traversal attempts containing parent directory references (..)', () => {
      const traversalTarget = `${approvedMediaDir}/../etc/passwd`;
      const res = validateMediaFilePath(traversalTarget, [approvedMediaDir]);
      expect(res.allowed).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.reason).toMatch(/traversal/i);
    });

    it('rejects null byte injection (%00 / \\0)', () => {
      const nullByteTarget = `${approvedMediaDir}/test.png\0/etc/passwd`;
      const res = validateMediaFilePath(nullByteTarget, [approvedMediaDir]);
      expect(res.allowed).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.reason).toMatch(/traversal or malformed/i);
    });

    it('rejects disallowed file extensions even if placed within approved roots', () => {
      const evilScript = path.join(approvedMediaDir, 'malicious.sh');
      fs.writeFileSync(evilScript, '#!/bin/sh\necho pwned');

      const res = validateMediaFilePath(evilScript, [approvedMediaDir]);
      expect(res.allowed).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.reason).toMatch(/Disallowed media file extension/i);
    });

    it('detects and rejects symlink breakouts pointing outside approved directories', () => {
      const symlinkPath = path.join(approvedMediaDir, 'breakout_symlink.png');
      const targetSystemFile = fs.existsSync('/etc/os-release') ? '/etc/os-release' : '/etc/hosts';
      try {
        fs.symlinkSync(targetSystemFile, symlinkPath);
      } catch (e) {
        // Skip symlink test if filesystem permissions disallow creating symlinks in temp
        return;
      }

      const res = validateMediaFilePath(symlinkPath, [approvedMediaDir]);
      expect(res.allowed).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.reason).toMatch(/outside approved media storage roots|Disallowed/i);
    });
  });

  describe('2.2 — Shell Injection Prevention', () => {
    it('safely handles malicious shell metacharacters in notify-send without executing subshells', async () => {
      const notifService = new NotificationListenerService();
      const markerFile = path.join(tempDir, 'pwned_marker.txt');

      // Attempt command substitution and chaining injection
      const maliciousPayload = `Normal Title"; touch "${markerFile}"; echo "pwned`;
      const maliciousBody = `Message $(touch "${markerFile}") \`touch "${markerFile}"\` && touch "${markerFile}"`;

      await notifService.sendDesktopNotification(maliciousPayload, maliciousBody, 'low');

      // The marker file MUST NOT have been created by a shell
      expect(fs.existsSync(markerFile)).toBe(false);
    });

    it('rejects non-numeric window IDs in screenReadingService.focusWindow to prevent injection', async () => {
      const screenService = new ScreenReadingService();
      const maliciousWindowId = '12345; touch /tmp/pwned; echo 1';

      const res = await screenService.focusWindow(maliciousWindowId);
      expect(res).toBe(false);
      expect(fs.existsSync('/tmp/pwned')).toBe(false);
    });
  });

  describe('2.3 — Telegram Authorization Fail-Closed Boundary', () => {
    it('fails closed when allowedChatIds is empty (nobody authorized)', async () => {
      const bridge = new TelegramBridgeService();
      bridge.configure('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', undefined, [], [99999]);

      const status = bridge.getStatus();
      expect(status.hasValidAllowlist).toBe(false);
      expect(status.allowedChatCount).toBe(0);

      // Verify credentials are masked in getStatus()
      expect(status.botTokenMasked).toBe('1234...ew11');
      expect(status.botTokenMasked).not.toContain('ABC-DEF1234ghIkl');
    });

    it('fails closed when allowedUserIds is empty (nobody authorized)', async () => {
      const bridge = new TelegramBridgeService();
      bridge.configure('123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11', undefined, ['10001'], []);

      const status = bridge.getStatus();
      expect(status.hasValidAllowlist).toBe(false);
      expect(status.allowedUserCount).toBe(0);
    });

    it('masks token when configuring new credentials', () => {
      const bridge = new TelegramBridgeService();
      bridge.configure('987654:XYZ-ABC-SECRET-TOKEN', undefined, ['10001'], [55555]);

      const status = bridge.getStatus();
      expect(status.botTokenMasked).toBe('9876...OKEN');
      expect(status.botTokenMasked).not.toContain('SECRET');
      expect(status.hasValidAllowlist).toBe(true);
    });
  });

  describe('2.4 & 2.5 — ActionPermissionController Unified Agency Authorization', () => {
    let controller: ActionPermissionController;

    beforeEach(() => {
      controller = new ActionPermissionController({
        autonomousExecutionEnabled: true,
        allowedFilesystemPaths: [tempDir],
        forbiddenFilesystemPaths: ['/etc', '/root', path.join(os.homedir(), '.ssh')],
        forbiddenNetworkDomains: ['localhost', '127.0.0.1'],
      });
    });

    it('denies dangerous binaries (rm, sudo, dd, bash, systemctl) by default', () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo su',
        'dd if=/dev/zero',
        'bash -c "whoami"',
        'systemctl stop firewalld',
      ];

      for (const cmd of dangerousCommands) {
        const auth = controller.authorize({
          id: 'test-act-id',
          type: 'app_launch',
          target: cmd,
          payload: { appName: cmd },
          riskLevel: 'critical',
          requiresExplicitApproval: false,
        });
        expect(auth.allowed).toBe(false);
        expect(auth.decision).toBe('denied');
      }
    });

    it('denies filesystem traversal attempts (..) across read and write operations', () => {
      const traversalTarget = `${tempDir}/../other/secret.txt`;
      const auth = controller.authorize({
        id: 'test-act-id',
        type: 'system_read_file',
        target: 'traversal',
        payload: { filePath: traversalTarget },
        riskLevel: 'high',
        requiresExplicitApproval: false,
      });
      expect(auth.allowed).toBe(false);
      expect(auth.decision).toBe('denied');
      expect(auth.denialReason).toMatch(/traversal/i);
    });

    it('denies access to forbidden path substrings (.ssh, id_rsa, /etc/shadow, wallet.dat)', () => {
      const sensitiveTargets = [
        path.join(os.homedir(), '.ssh', 'id_rsa'),
        '/etc/shadow',
        path.join(tempDir, 'wallet.dat'),
      ];

      for (const target of sensitiveTargets) {
        const auth = controller.authorize({
          id: 'test-act-id',
          type: 'system_read_file',
          target,
          payload: { filePath: target },
          riskLevel: 'critical',
          requiresExplicitApproval: false,
        });
        expect(auth.allowed).toBe(false);
        expect(auth.decision).toBe('denied');
      }
    });

    it('denies SSRF and internal network probing (localhost, private IPs, .local)', () => {
      const blockedHosts = [
        'http://localhost:8080/admin',
        'http://127.0.0.1:39281/secret',
        'http://192.168.1.1/router',
        'http://10.0.0.5:80',
        'http://internal-host.local/api',
      ];

      for (const targetUrl of blockedHosts) {
        const auth = controller.authorize({
          id: 'test-act-id',
          type: 'web_navigate',
          target: targetUrl,
          payload: { url: targetUrl },
          riskLevel: 'high',
          requiresExplicitApproval: false,
        });
        expect(auth.allowed).toBe(false);
        expect(auth.decision).toBe('denied');
        expect(auth.denialReason).toMatch(/prohibited|internal|loopback/i);
      }
    });

    it('allows valid public internet web navigation', () => {
      const auth = controller.authorize({
        id: 'test-act-id',
        type: 'web_navigate',
        target: 'https://github.com',
        payload: { url: 'https://github.com' },
        riskLevel: 'low',
        requiresExplicitApproval: false,
      });
      expect(auth.allowed).toBe(true);
      expect(auth.decision).toBe('granted');
    });
  });

  describe('2.6 — Emergency Shutdown & Safe Explicit Reactivation', () => {
    let controller: ActionPermissionController;

    beforeEach(() => {
      controller = new ActionPermissionController({
        autonomousExecutionEnabled: true,
      });
    });

    it('immediately denies all action proposals when emergency shutdown is active', () => {
      expect(controller.isAutonomyEnabled()).toBe(true);
      expect(controller.isEmergencyShutdown()).toBe(false);

      controller.emergencyShutdown('User hit emergency stop button');

      expect(controller.isEmergencyShutdown()).toBe(true);
      expect(controller.isAutonomyEnabled()).toBe(false);

      const info = controller.getEmergencyShutdownInfo();
      expect(info.active).toBe(true);
      expect(info.reason).toBe('User hit emergency stop button');

      // Even low risk, valid operations must be denied immediately
      const auth = controller.authorize({
        id: 'test-act-id',
        type: 'web_navigate',
        target: 'https://google.com',
        payload: { url: 'https://google.com' },
        riskLevel: 'low',
        requiresExplicitApproval: false,
      });

      expect(auth.allowed).toBe(false);
      expect(auth.decision).toBe('denied');
      expect(auth.denialReason).toMatch(/Emergency shutdown is active/i);
    });

    it('prevents standard policy updates from bypassing active emergency shutdown', () => {
      controller.emergencyShutdown('Critical safety incident');

      // Attempting to simply toggle the configuration flag
      controller.updatePolicy({ autonomousExecutionEnabled: true });

      // Autonomy must remain disabled
      expect(controller.isAutonomyEnabled()).toBe(false);
      expect(controller.isEmergencyShutdown()).toBe(true);
    });

    it('requires the explicit confirmation token "CONFIRM_REACTIVATION" to reactivate', () => {
      controller.emergencyShutdown('Manual stop');

      // Invalid tokens fail
      const failRes1 = controller.reactivateAutonomy('yes');
      expect(failRes1.success).toBe(false);
      expect(controller.isEmergencyShutdown()).toBe(true);

      const failRes2 = controller.reactivateAutonomy('true');
      expect(failRes2.success).toBe(false);
      expect(controller.isEmergencyShutdown()).toBe(true);

      // Valid token succeeds
      const successRes = controller.reactivateAutonomy('CONFIRM_REACTIVATION');
      expect(successRes.success).toBe(true);
      expect(controller.isEmergencyShutdown()).toBe(false);
      expect(controller.isAutonomyEnabled()).toBe(true);

      // Actions are permitted again
      const auth = controller.authorize({
        id: 'test-act-id',
        type: 'web_navigate',
        target: 'https://google.com',
        payload: { url: 'https://google.com' },
        riskLevel: 'low',
        requiresExplicitApproval: false,
      });
      expect(auth.allowed).toBe(true);
    });
  });

  describe('IPC Sender Origin Validation', () => {
    it('rejects IPC events when target window is null or undefined', () => {
      const event = { sender: { id: 10 } };
      expect(isAuthorizedSender(event, null)).toBe(false);
    });

    it('rejects IPC events when target window has been destroyed', () => {
      const fakeWindow = {
        isDestroyed: () => true,
        webContents: { id: 10 },
      };
      const event = { sender: { id: 10 } };
      expect(isAuthorizedSender(event, fakeWindow)).toBe(false);
    });

    it('rejects IPC events from sender IDs not matching the target window webContents', () => {
      const fakeWindow = {
        isDestroyed: () => false,
        webContents: { id: 10 },
      };
      const foreignEvent = { sender: { id: 99 } };
      expect(isAuthorizedSender(foreignEvent, fakeWindow)).toBe(false);
    });

    it('authorizes IPC events from matching main window webContents', () => {
      const fakeWindow = {
        isDestroyed: () => false,
        webContents: { id: 42 },
      };
      const validEvent = { sender: { id: 42 } };
      expect(isAuthorizedSender(validEvent, fakeWindow)).toBe(true);
    });
  });
});
