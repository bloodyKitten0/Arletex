import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { DatabaseService, MigrationRunner } from '@arletex/database';
import type Database from 'better-sqlite3';
import {
  ActionPermissionController,
  ClosedLoopAgencyService,
  CognitiveControlBus,
  ApeService,
  rootLogger,
} from '@arletex/core';
import { ActionProposal, CognitiveEvent } from '@arletex/contracts';

describe('Priority 0 — Universal Security Coverage & Fail-Closed Boundary (P0.3)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let auditLogs: any[] = [];
  let auditRepo: { log: (event: any) => any };
  let controller: ActionPermissionController;
  let safeWriteDir: string;
  let safeReadDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p0-security-'));
    safeWriteDir = path.join(tempDir, 'safe_write');
    safeReadDir = path.join(tempDir, 'safe_read');
    fs.mkdirSync(safeWriteDir, { recursive: true });
    fs.mkdirSync(safeReadDir, { recursive: true });

    dbPath = path.join(tempDir, 'security_test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    auditLogs = [];
    auditRepo = {
      log: (event: any) => {
        auditLogs.push(event);
        try {
          db.prepare(
            `INSERT INTO audit_logs (id, actor, action, details, status, timestamp)
             VALUES (?, ?, ?, ?, ?, ?)`,
          ).run(
            crypto.randomUUID(),
            event.actor,
            event.action,
            event.details,
            event.status,
            event.timestamp || new Date().toISOString(),
          );
        } catch {}
      },
    };

    controller = new ActionPermissionController(
      {
        allowedFilesystemPaths: [safeWriteDir],
        readOnlyFilesystemPaths: [safeReadDir],
        forbiddenFilesystemPaths: ['/etc', '/root', '/sys', '/proc'],
        allowedApplications: ['google-chrome', 'spotify', 'curl-safe'],
        forbiddenNetworkDomains: ['localhost', '127.0.0.1', '0.0.0.0'],
        requireApprovalForSensitiveFiles: true,
      },
      auditRepo,
      rootLogger,
    );
  });

  afterEach(() => {
    try {
      dbService.disconnect();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Filesystem Security Boundary', () => {
    it('allows write strictly within allowedFilesystemPaths', () => {
      const target = path.join(safeWriteDir, 'allowed.txt');
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'write_file',
        payload: { filePath: target, content: 'safe content' },
        rationale: 'Legitimate write',
        expectedOutcome: 'Write success',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('granted');
    });

    it('denies write to read-only directories', () => {
      const target = path.join(safeReadDir, 'forbidden_write.txt');
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'write_file',
        payload: { filePath: target, content: 'unauthorized write' },
        rationale: 'Write to readonly directory',
        expectedOutcome: 'Write success',
        riskLevel: 'medium',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toMatch(
        /outside pre-approved write directories|resolves outside authorized directory boundaries/i,
      );
    });

    it('blocks path-prefix collision attacks (e.g. safe_write-malicious)', () => {
      const collisionDir = safeWriteDir + '-malicious';
      const target = path.join(collisionDir, 'pwn.txt');
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'write_file',
        payload: { filePath: target, content: 'evil' },
        rationale: 'Prefix collision write',
        expectedOutcome: 'Write success',
        riskLevel: 'critical',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toMatch(
        /outside pre-approved write directories|resolves outside authorized directory boundaries/i,
      );
    });

    it('blocks parent traversal .. in read and write operations', () => {
      const target = safeWriteDir + '/../traversal.txt';
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'read_file',
        payload: { filePath: target },
        rationale: 'Directory traversal read',
        expectedOutcome: 'Read success',
        riskLevel: 'critical',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain('Path traversal using parent references (..) is disallowed');
    });

    it('detects and blocks symlink traversal escaping authorized roots', () => {
      const outsideTarget = path.join(tempDir, 'outside_secret.txt');
      fs.writeFileSync(outsideTarget, 'classified');
      const symlinkPath = path.join(safeWriteDir, 'symlink_escape.txt');
      fs.symlinkSync(outsideTarget, symlinkPath);

      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'read_file',
        payload: { filePath: symlinkPath },
        rationale: 'Read symlink escaping root',
        expectedOutcome: 'Read success',
        riskLevel: 'critical',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toMatch(/escapes authorized directory boundaries|Symlink/i);
    });

    it('blocks access to sensitive paths containing .ssh, id_rsa, or /etc/shadow', () => {
      const sensitivePath = path.join(safeWriteDir, '.ssh', 'id_rsa');
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'read_file',
        payload: { filePath: sensitivePath },
        rationale: 'Read SSH key',
        expectedOutcome: 'Key content',
        riskLevel: 'critical',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain("touches forbidden security boundary '.ssh'");
    });
  });

  describe('2. Network & SSRF Security Boundary', () => {
    it('permits legitimate public HTTPS destinations', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'web_navigate',
        payload: { url: 'https://en.wikipedia.org/wiki/Quantum_computing' },
        rationale: 'Legitimate research',
        expectedOutcome: 'Page loads',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('granted');
    });

    it('blocks desktop_open_browser to SSRF targets', () => {
      const ssrfUrls = [
        'http://169.254.169.254/latest/meta-data/',
        'http://localhost:8080/admin',
        'http://127.0.0.1:3000/api',
        'http://0.0.0.0:8000/',
        'http://10.0.0.1/secrets',
        'http://172.16.0.1/internal',
        'http://192.168.1.1/router',
        'http://[::1]:8080',
        'http://2130706433/', // Integer IP for 127.0.0.1
        'http://0x7f000001/', // Hex IP for 127.0.0.1
        'http://0177.0.0.1/', // Octal IP for 127.0.0.1
        'http://metadata.google.internal/computeMetadata/v1/',
        'file:///etc/passwd',
        'gopher://127.0.0.1:6379/_INFO',
      ];

      for (const url of ssrfUrls) {
        const action: ActionProposal = {
          id: crypto.randomUUID(),
          taskId: crypto.randomUUID(),
          stepIndex: 0,
          type: 'desktop_open_browser',
          payload: { url },
          rationale: 'SSRF test probe',
          expectedOutcome: 'Must be blocked',
          riskLevel: 'critical',
          requiresExplicitApproval: false,
          createdAt: new Date().toISOString(),
        };

        const result = controller.evaluate(action);
        expect(result.decision).toBe('denied');
        expect(result.reason).toMatch(/prohibited|Unsupported protocol|boundary|rejected/i);
      }
    });

    it('rejects malformed or invalid URL strings', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'web_navigate',
        payload: { url: 'not_a_valid_url::::///' },
        rationale: 'Malformed test',
        expectedOutcome: 'Denied',
        riskLevel: 'high',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain('Malformed URL');
    });
  });

  describe('3. Process & Application Launch Security Boundary', () => {
    it('enforces positive application allowlist and denies unapproved binaries', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'app_launch',
        payload: { appName: 'unauthorized_daemon' },
        rationale: 'Launch unauthorized app',
        expectedOutcome: 'App opens',
        riskLevel: 'critical',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain('not in the positive authorized application allowlist');
    });

    it('denies dangerous shell commands and metacharacter injection', () => {
      const dangerousCommands = [
        'rm -rf /',
        'google-chrome; rm -rf /',
        'spotify && echo pwned',
        'spotify | bash',
        'google-chrome `id`',
        'google-chrome $(whoami)',
        'google-chrome > /tmp/overwrite',
      ];

      for (const cmd of dangerousCommands) {
        const action: ActionProposal = {
          id: crypto.randomUUID(),
          taskId: crypto.randomUUID(),
          stepIndex: 0,
          type: 'app_launch',
          payload: { appName: cmd },
          rationale: 'Shell injection probe',
          expectedOutcome: 'Must be blocked',
          riskLevel: 'critical',
          requiresExplicitApproval: false,
          createdAt: new Date().toISOString(),
        };

        const result = controller.evaluate(action);
        expect(result.decision).toBe('denied');
        expect(result.reason).toMatch(/illegal shell metacharacters|prohibited executable/i);
      }
    });
  });

  describe('4. Approval Tokens, Anti-Tamper & Nonce Protection', () => {
    it('rejects naked boolean userApproved: true without cryptographic approval token', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'app_launch',
        payload: {
          appName: 'google-chrome',
          userApproved: true, // naked boolean
        },
        rationale: 'Attempt naked bypass',
        expectedOutcome: 'Denied',
        riskLevel: 'critical',
        requiresExplicitApproval: true,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain('Naked boolean userApproved is rejected fail-closed');
    });

    it('authorizes action with valid HMAC-SHA256 approval token', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'code_modify',
        payload: {
          filePath: path.join(safeWriteDir, 'module.ts'),
        },
        rationale: 'Approved code change',
        expectedOutcome: 'File edited',
        riskLevel: 'critical',
        requiresExplicitApproval: true,
        createdAt: new Date().toISOString(),
      };

      const digest = ActionPermissionController.computeActionDigest(action);
      const target = ActionPermissionController.extractTargetResource(action);
      const token = controller.createApprovalToken({
        actionDigest: digest,
        targetResource: target,
        scope: 'code_modify',
        userId: 'Proof',
      });

      action.payload!.approvalToken = token.token;

      const result = controller.evaluate(action);
      expect(result.decision).toBe('granted');
    });

    it('rejects replayed approval token on second attempt (single-use nonce)', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'code_modify',
        payload: {
          filePath: path.join(safeWriteDir, 'module.ts'),
        },
        rationale: 'Replay probe',
        expectedOutcome: 'File edited',
        riskLevel: 'critical',
        requiresExplicitApproval: true,
        createdAt: new Date().toISOString(),
      };

      const digest = ActionPermissionController.computeActionDigest(action);
      const target = ActionPermissionController.extractTargetResource(action);
      const token = controller.createApprovalToken({
        actionDigest: digest,
        targetResource: target,
        scope: 'code_modify',
        userId: 'Proof',
      });

      action.payload!.approvalToken = token.token;

      // First evaluation: consumes nonce
      const first = controller.evaluate(action);
      expect(first.decision).toBe('granted');

      // Second evaluation with identical token: must be rejected
      const second = controller.evaluate(action);
      expect(second.decision).toBe('denied');
      expect(second.reason).toContain('replay attack detected');
    });

    it('rejects tampered or forged approval token signatures', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'code_modify',
        payload: {
          filePath: path.join(safeWriteDir, 'module.ts'),
        },
        rationale: 'Tampered signature probe',
        expectedOutcome: 'Denied',
        riskLevel: 'critical',
        requiresExplicitApproval: true,
        createdAt: new Date().toISOString(),
      };

      const digest = ActionPermissionController.computeActionDigest(action);
      const target = ActionPermissionController.extractTargetResource(action);
      const token = controller.createApprovalToken({
        actionDigest: digest,
        targetResource: target,
        scope: 'code_modify',
        userId: 'Proof',
      });

      // Tamper signature by modifying last byte
      const parts = token.token.split('.');
      const tampered = parts[0] + '.' + '0'.repeat(parts[1]!.length);
      action.payload!.approvalToken = tampered;

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain('signature verification failed');
    });
  });

  describe('5. Emergency Shutdown & Unconditional Halt', () => {
    it('halts all computer operations immediately upon emergency shutdown', () => {
      controller.emergencyShutdown('Security anomaly detected');

      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'write_file',
        payload: { filePath: path.join(safeWriteDir, 'test.txt'), content: 'data' },
        rationale: 'Write during shutdown',
        expectedOutcome: 'Denied',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain('Emergency shutdown is active');

      // Attempt to re-enable via updatePolicy: must be ignored
      controller.updatePolicy({ autonomousExecutionEnabled: true });
      expect(controller.getPolicy().autonomousExecutionEnabled).toBe(false);

      const retryResult = controller.evaluate(action);
      expect(retryResult.decision).toBe('denied');
    });

    it('reactivates only with explicit confirmation token', () => {
      controller.emergencyShutdown('Testing reactivation');

      const failReactivate = controller.reactivateAutonomy('wrong_token');
      expect(failReactivate.success).toBe(false);

      const passReactivate = controller.reactivateAutonomy('CONFIRM_REACTIVATION');
      expect(passReactivate.success).toBe(true);

      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'write_file',
        payload: { filePath: path.join(safeWriteDir, 'reactivated.txt'), content: 'data' },
        rationale: 'Write after reactivation',
        expectedOutcome: 'Allowed',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('granted');
    });
  });

  describe('6. Fail-Closed Default & Audit Logging', () => {
    it('denies unrecognized action types by default', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'quantum_teleport_data' as any,
        payload: { target: 'moon' },
        rationale: 'Unrecognized operation',
        expectedOutcome: 'Denied fail-closed',
        riskLevel: 'high',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = controller.evaluate(action);
      expect(result.decision).toBe('denied');
      expect(result.reason).toContain('unrecognized and denied by default security policy');
    });

    it('persists audit records to SQLite audit_logs table for every security decision', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'app_launch',
        payload: { appName: 'unauthorized_tool' },
        rationale: 'Audit trail test',
        expectedOutcome: 'Denied',
        riskLevel: 'critical',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      controller.evaluate(action);

      const rows = db.prepare('SELECT * FROM audit_logs WHERE status = ?').all('denied') as any[];
      expect(rows.length).toBeGreaterThan(0);
      const latest = rows[rows.length - 1];
      expect(latest.actor).toBe('ActionPermissionController');
      expect(latest.details).toContain(action.id);
      expect(latest.details).toContain('denied');
    });
  });
});
