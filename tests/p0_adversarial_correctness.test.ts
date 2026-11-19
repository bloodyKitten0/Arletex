import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ActionPermissionController,
  SafeComputerAgencyService,
  ClosedLoopAgencyService,
  VerificationEngine,
  CognitiveControlBus,
  ApeService,
  rootLogger,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
} from '@arletex/database';
import { TelegramBridgeService } from '../apps/desktop/src/backend/telegramBridgeService.js';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';
import { ActionProposal } from '@arletex/contracts';

describe('P0 Adversarial Correctness and Security Boundary Suite', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let apeService: ApeService;
  let permissionController: ActionPermissionController;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p0-adversarial-'));
    dbPath = path.join(tempDir, 'p0_test.sqlite');

    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo, undefined, rootLogger);
    permissionController = new ActionPermissionController();
  });

  afterEach(async () => {
    for (const server of activeServers) {
      try {
        await server.stop();
      } catch {}
    }
    activeServers = [];

    if (dbService) {
      dbService.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 1. Missing browser provider -> navigation fails; no synthetic page/playing result
  it('1. Missing browser provider: navigation fails with explicit error and zero fabricated playback', async () => {
    const agency = new ClosedLoopAgencyService({
      permissionController,
      // browserProvider intentionally omitted
    });

    const result = await agency.executeAction({
      type: 'web_navigate',
      parameters: { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No browserProvider available');
    expect((result as any).mock).toBeUndefined();
    expect((result as any).isPlaying).toBeUndefined();
  });

  // 2. Missing computer provider -> launch/screenshot fails; no fake PID or image
  it('2. Missing computer provider: app_launch and screenshot fail with zero fake PIDs or image data', async () => {
    const agency = new ClosedLoopAgencyService({
      permissionController,
      // computerProvider intentionally omitted
    });

    const launchResult = await agency.executeAction({
      type: 'app_launch',
      parameters: { appName: 'google-chrome' },
    });
    expect(launchResult.success).toBe(false);
    expect(launchResult.error).toContain('No computerProvider available');
    expect((launchResult as any).pid).toBeUndefined();

    const screenResult = await agency.executeAction({
      type: 'desktop_take_screenshot',
      parameters: {},
    });
    expect(screenResult.success).toBe(false);
    expect(screenResult.error).toContain('No computerProvider available');
    expect((screenResult as any).imageBase64).toBeUndefined();
  });

  // 3. Unsupported action -> denied or rejected; never returns success
  it('3. Unsupported action type: rejected fail-closed, never returns success', async () => {
    const agency = new ClosedLoopAgencyService({
      permissionController,
    });

    const result = await agency.executeAction({
      type: 'unsupported_exploit_opcode' as any,
      parameters: { exploit: true },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported agency action type');
  });

  // 4. Empty plan -> rejected as invalid; never completed
  it('4. Empty plan: rejected as invalid, cannot complete successfully', async () => {
    const agency = new ClosedLoopAgencyService({
      permissionController,
    });

    // Formulate empty plan
    const emptyPlan = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      objective: 'Empty task',
      steps: [],
      estimatedDurationMs: 0,
      requiresElevation: false,
    };

    const execution = await agency.executePlan(emptyPlan as any);
    expect(execution.allStepsSucceeded).toBe(false);
    expect(execution.failureReason).toContain('cannot execute empty plan');
  });

  // 5. Action executes but independent verification fails -> task is unverified/failed
  it('5. Independent verification failure: marks executed_unverified with verified=false', async () => {
    const verificationEngine = new VerificationEngine();

    const verified = await verificationEngine.verifyStep(
      {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'app_launch',
        parameters: { appName: 'google-chrome' },
        expectedOutcome: 'Window opens with title Google Chrome',
      },
      {
        actionType: 'app_launch',
        success: true,
        data: { pid: 9999, windowFound: false }, // Execution reported success, but independent observation found no window
      },
    );

    expect(verified.verified).toBe(false);
    expect(['partially_successful', 'executed_unverified']).toContain(verified.status);
  });

  // 6. Required authorization with missing controller -> denied fail-closed
  it('6. Missing permission controller when authorization required: denies fail-closed', async () => {
    const bus = new CognitiveControlBus({
      apeService,
      // permissionController intentionally omitted
      logger: rootLogger,
    });

    const cycle = await bus.dispatch({
      id: crypto.randomUUID(),
      type: 'user_message',
      source: 'user',
      timestamp: new Date().toISOString(),
      payload: {
        text: 'Run malicious admin command',
        actionProposal: {
          id: crypto.randomUUID(),
          taskId: crypto.randomUUID(),
          stepIndex: 0,
          type: 'execute_command',
          payload: { command: 'rm -rf /' },
          rationale: 'Execute destructive command',
          expectedOutcome: 'System wiped',
          riskLevel: 'critical',
          requiresExplicitApproval: true,
          createdAt: new Date().toISOString(),
        },
      },
      provenance: 'user_statement',
    });

    expect(cycle.pipelineCompleted).toBe(true);
    expect(cycle.actionAttempted).toBe(true);
    expect(cycle.actionExecuted).toBe(false);
    expect(cycle.taskSucceeded).toBe(false);
    expect(cycle.stagesCompleted).toContain('permission_assessment');
  });

  // 7. Unknown action category or category mapping mismatch -> denied
  it('7. Unknown action type or malformed action: denied by default security policy', () => {
    const action: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'arbitrary_unregistered_action' as any,
      payload: { target: '/root' },
      rationale: 'Bypass authorization via unknown type',
      expectedOutcome: 'Bypass check',
      riskLevel: 'high',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    };

    const res = permissionController.evaluate(action);
    expect(res.decision).toBe('denied');
    expect(res.reason).toContain('unrecognized and denied by default');
  });

  // 8. Direct service calls without authorization -> denied fail-closed
  it('8. Direct SafeComputerAgencyService calls: fail closed when emergency shutdown is active or unauthorized', async () => {
    const safeAgency = new SafeComputerAgencyService(permissionController);

    // Normal safe file read in /tmp succeeds
    const testFile = path.join(tempDir, 'safe_test.txt');
    fs.writeFileSync(testFile, 'hello safe world');
    const content = await safeAgency.readFile(testFile);
    expect(content).toBe('hello safe world');

    // Trigger emergency shutdown on the universal security boundary
    permissionController.emergencyShutdown('Adversarial intrusion detected');

    // All subsequent direct calls MUST fail closed immediately
    await expect(safeAgency.readFile(testFile)).rejects.toThrow(/Authorization denied/);
    await expect(safeAgency.writeFile(testFile, 'malicious overwrite')).rejects.toThrow(/Authorization denied/);
    await expect(safeAgency.listFiles(tempDir)).rejects.toThrow(/Authorization denied/);
    await expect(safeAgency.launchApp('google-chrome')).rejects.toThrow(/Authorization denied/);
    await expect(safeAgency.executeCommand('ls', [])).rejects.toThrow(/Authorization denied/);
  });

  // 9. Expired, replayed, mismatched, or naked userApproved approval tokens -> denied
  it('9. Approval Token validation: rejects expired, replayed, mismatched, and naked boolean approvals', () => {
    const action: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'execute_command',
      payload: { command: 'code /tmp/safe.txt' },
      rationale: 'Open safe text file in code editor',
      expectedOutcome: 'Editor opened',
      riskLevel: 'high',
      requiresExplicitApproval: true,
      createdAt: new Date().toISOString(),
    };

    const digest = ActionPermissionController.computeActionDigest(action);
    const target = ActionPermissionController.extractTargetResource(action);

    // 9a. Naked userApproved boolean without token -> DENIED fail-closed
    const nakedAction: ActionProposal = {
      ...action,
      payload: { ...action.payload, userApproved: true },
    };
    const nakedRes = permissionController.evaluate(nakedAction);
    expect(nakedRes.decision).toBe('denied');
    expect(nakedRes.reason).toContain('Naked boolean userApproved is rejected fail-closed');

    // 9b. Valid token -> GRANTED
    const approval = permissionController.createApprovalToken({
      actionDigest: digest,
      targetResource: target,
      scope: 'action:execute_command',
      userId: 'Proof',
      ttlMs: 60000,
    });

    const validAction: ActionProposal = {
      ...action,
      payload: { ...action.payload, approvalToken: approval.token },
    };
    const validRes = permissionController.evaluate(validAction);
    expect(validRes.decision).toBe('granted');

    // 9c. Replay attack: using the exact same token a second time -> DENIED (consumed nonce)
    const replayRes = permissionController.evaluate(validAction);
    expect(replayRes.decision).toBe('denied');
    expect(replayRes.reason).toContain('replay attack detected');

    // 9d. Expired token -> DENIED
    const expiredApproval = permissionController.createApprovalToken({
      actionDigest: digest,
      targetResource: target,
      scope: 'action:execute_command',
      userId: 'Proof',
      ttlMs: -1000, // expired 1s ago
    });
    const expiredAction: ActionProposal = {
      ...action,
      payload: { ...action.payload, approvalToken: expiredApproval.token },
    };
    const expiredRes = permissionController.evaluate(expiredAction);
    expect(expiredRes.decision).toBe('denied');
    expect(expiredRes.reason).toContain('Approval token has expired');

    // 9e. Mismatched action parameters -> DENIED
    const tamperedAction: ActionProposal = {
      ...action,
      payload: { command: 'code /tmp/tampered.txt' }, // different parameters -> digest mismatch
    };
    const tamperedDigest = ActionPermissionController.computeActionDigest(tamperedAction);
    const tamperedApproval = permissionController.createApprovalToken({
      actionDigest: tamperedDigest,
      targetResource: 'exec://other',
      scope: 'action:execute_command',
      userId: 'Proof',
    });
    const mismatchedRes = permissionController.evaluate({
      ...action, // evaluates original action with token generated for different target
      payload: { ...action.payload, approvalToken: tamperedApproval.token },
    });
    expect(mismatchedRes.decision).toBe('denied');
    expect(mismatchedRes.reason).toContain('mismatched action');
  });

  // 10. DNS rebinding, loopback, private IPs, and cloud metadata -> denied
  it('10. SSRF, metadata, and private IP rejection: blocks loopback, cloud metadata, and encoded IPs', () => {
    expect(ActionPermissionController.isPrivateOrLoopbackHost('localhost')).toBe(true);
    expect(ActionPermissionController.isPrivateOrLoopbackHost('127.0.0.1')).toBe(true);
    expect(ActionPermissionController.isPrivateOrLoopbackHost('0.0.0.0')).toBe(true);
    expect(ActionPermissionController.isPrivateOrLoopbackHost('169.254.169.254')).toBe(true); // AWS/GCP metadata
    expect(ActionPermissionController.isPrivateOrLoopbackHost('metadata.google.internal')).toBe(true);
    expect(ActionPermissionController.isPrivateOrLoopbackHost('10.0.0.1')).toBe(true);
    expect(ActionPermissionController.isPrivateOrLoopbackHost('192.168.1.1')).toBe(true);
    expect(ActionPermissionController.isPrivateOrLoopbackHost('172.16.0.1')).toBe(true);
    // Decimal encoded IP (2130706433 = 127.0.0.1)
    expect(ActionPermissionController.isPrivateOrLoopbackHost('2130706433')).toBe(true);
    // Hex encoded IP (0x7f000001 = 127.0.0.1)
    expect(ActionPermissionController.isPrivateOrLoopbackHost('0x7f000001')).toBe(true);

    // Public domain passes
    expect(ActionPermissionController.isPrivateOrLoopbackHost('google.com')).toBe(false);
    expect(ActionPermissionController.isPrivateOrLoopbackHost('wikipedia.org')).toBe(false);
  });

  // 11. Outbound Telegram to unallowlisted chat -> denied fail-closed
  it('11. Outbound Telegram: unallowlisted destination chat is denied fail-closed', async () => {
    const telegramBridge = new TelegramBridgeService();
    telegramBridge.configure('test-bot-token-xyz', '12345678', ['12345678'], [100]);

    // Send to authorized chat (will fail network call, but passes authorization check)
    // Send to unallowlisted chat -> denied fail-closed without network attempt
    const deniedResult = await telegramBridge.sendMessage('99999999', 'Unauthorized exfiltration attempt');
    expect(deniedResult).toBe(false);
  });

  // 12. Empty backend auth token -> fail closed
  it('12. Empty backend auth token in enforcement mode: startup fails closed', async () => {
    const prevEnforce = process.env['ARLETEX_ENFORCE_AUTH'];
    const prevToken = process.env['ARLETEX_AUTH_TOKEN'];

    try {
      process.env['ARLETEX_ENFORCE_AUTH'] = '1';
      delete process.env['ARLETEX_AUTH_TOKEN'];

      const server = new ArletexBackendServer({
        port: 0,
        host: '127.0.0.1',
        dataDirectory: tempDir,
        databasePath: dbPath,
        inference: {
          adapters: {},
          defaultModelId: 'test-model',
          embeddingModelId: 'test-embed',
          timeoutMs: 5000,
          maxRetries: 1,
        },
      });

      await expect(server.start(0)).rejects.toThrow(/ARLETEX_AUTH_TOKEN must be specified/);
    } finally {
      if (prevEnforce !== undefined) process.env['ARLETEX_ENFORCE_AUTH'] = prevEnforce;
      else delete process.env['ARLETEX_ENFORCE_AUTH'];
      if (prevToken !== undefined) process.env['ARLETEX_AUTH_TOKEN'] = prevToken;
      else delete process.env['ARLETEX_AUTH_TOKEN'];
    }
  });

  // 13. Emergency stop while action is running -> subsequent actions blocked
  it('13. Emergency stop blocks subsequent actions across all routes', () => {
    permissionController.emergencyShutdown('Adversarial event triggered emergency stop');
    expect(permissionController.isEmergencyShutdown()).toBe(true);

    const action: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'desktop_take_screenshot',
      payload: {},
      rationale: 'Take screenshot',
      expectedOutcome: 'Image data',
      riskLevel: 'low',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    };

    const res = permissionController.evaluate(action);
    expect(res.decision).toBe('denied');
    expect(res.reason).toContain('Emergency shutdown is active');

    // Reactivation requires exact confirmation token
    const badReset = permissionController.reactivateAutonomy('wrong-token');
    expect(badReset.success).toBe(false);
    expect(permissionController.isEmergencyShutdown()).toBe(true);

    const goodReset = permissionController.reactivateAutonomy('CONFIRM_REACTIVATION');
    expect(goodReset.success).toBe(true);
    expect(permissionController.isEmergencyShutdown()).toBe(false);
  });
});
