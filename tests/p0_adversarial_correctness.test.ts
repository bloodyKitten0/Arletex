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
  EthicalBoundariesSecurityEngine,
  rootLogger,
} from '@arletex/core';
import { ApeRepository, DatabaseService, MigrationRunner } from '@arletex/database';
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
    await expect(safeAgency.writeFile(testFile, 'malicious overwrite')).rejects.toThrow(
      /Authorization denied/,
    );
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
    expect(ActionPermissionController.isPrivateOrLoopbackHost('metadata.google.internal')).toBe(
      true,
    );
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
    const deniedResult = await telegramBridge.sendMessage(
      '99999999',
      'Unauthorized exfiltration attempt',
    );
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

  // 14. Approval token scope and user identity validation
  it('14. Approval token scope and user binding: rejects tokens with scope or user mismatch', () => {
    const action: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'execute_command',
      payload: { command: 'code /tmp/safe.txt', userId: 'Proof' },
      rationale: 'Open safe text file in code editor',
      expectedOutcome: 'Editor opened',
      riskLevel: 'high',
      requiresExplicitApproval: true,
      createdAt: new Date().toISOString(),
    };

    const digest = ActionPermissionController.computeActionDigest(action);
    const target = ActionPermissionController.extractTargetResource(action);

    // 14a. Token issued for 'system_read_file' scope presented for 'execute_command'
    const wrongScopeToken = permissionController.createApprovalToken({
      actionDigest: digest,
      targetResource: target,
      scope: 'action:system_read_file',
      userId: 'Proof',
    });

    const scopeMismatchRes = permissionController.evaluate({
      ...action,
      payload: { ...action.payload, approvalToken: wrongScopeToken.token },
    });
    expect(scopeMismatchRes.decision).toBe('denied');
    expect(scopeMismatchRes.reason).toContain(
      'Approval token rejected: Approval token is bound to a different scope',
    );

    // 14b. Token issued for a different user
    const otherUserToken = permissionController.createApprovalToken({
      actionDigest: digest,
      targetResource: target,
      scope: 'action:execute_command',
      userId: 'bloodyKitten0',
    });

    const userMismatchRes = permissionController.evaluate({
      ...action,
      payload: { ...action.payload, userId: 'Proof', approvalToken: otherUserToken.token },
    });
    expect(userMismatchRes.decision).toBe('denied');
    expect(userMismatchRes.reason).toContain(
      'Approval token is bound to a different user identity',
    );
  });

  // 15. Recursive canonicalization invariance
  it('15. Recursive canonicalization invariance: nested object key order variations produce identical digests', () => {
    const action1: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: 'task-1',
      stepIndex: 0,
      type: 'execute_command',
      payload: {
        config: { z: 1, a: 2, nested: { b: 20, a: 10 } },
        items: [1, 2, { y: 2, x: 1 }],
      },
      rationale: 'Test canonicalization',
      expectedOutcome: 'Deterministic digest',
      riskLevel: 'low',
      requiresExplicitApproval: false,
      createdAt: '2026-11-19T00:00:00.000Z',
    };

    const action2: ActionProposal = {
      ...action1,
      payload: {
        items: [1, 2, { x: 1, y: 2 }],
        config: { a: 2, nested: { a: 10, b: 20 }, z: 1 },
      },
    };

    const digest1 = ActionPermissionController.computeActionDigest(action1);
    const digest2 = ActionPermissionController.computeActionDigest(action2);
    expect(digest1).toBe(digest2);
  });

  // 16. Universal execution boundary routes filesystem and commands through closed-loop verification
  it('16. Universal execution boundary: executes and empirically verifies filesystem and command operations', async () => {
    const mockFiles = new Map<string, string>();
    const mockComputer = {
      launchApp: async () => ({ pid: 1234, isRunning: true, windowFound: true }),
      getActiveWindow: async () => ({ title: 'Code - safe.txt', appName: 'Code' }),
      focusWindow: async () => true,
      captureScreen: async () => ({ imageBase64: 'base64data', width: 1920, height: 1080 }),
      readFile: async (fp: string) => mockFiles.get(fp) || `Content of ${fp}`,
      writeFile: async (fp: string, content: string) => {
        mockFiles.set(fp, content);
        return { success: true, sizeBytes: content.length };
      },
      listFiles: async () => ['file1.txt', 'file2.txt'],
      executeCommand: async (cmd: string) => ({
        exitCode: 0,
        stdout: `Executed ${cmd}`,
        stderr: '',
      }),
    };

    const verificationEngine = new VerificationEngine(rootLogger);
    const localPermissionController = new ActionPermissionController({
      allowedApplications: ['echo', 'code'],
    });
    const agency = new ClosedLoopAgencyService({
      permissionController: localPermissionController,
      computerProvider: mockComputer,
      verificationEngine,
      logger: rootLogger,
    });

    // Write file action
    const writeAction: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'system_write_file',
      payload: { filePath: '/tmp/test.txt', content: 'hello world' },
      rationale: 'Write test file',
      expectedOutcome: 'File written safely',
      riskLevel: 'medium',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    };

    const writeObs = await agency.executeAction(writeAction);
    expect(writeObs.success).toBe(true);
    expect(writeObs.data?.sizeBytes).toBe(11);

    const writeVer = verificationEngine.verify(writeAction, writeObs);
    expect(writeVer.verified).toBe(true);
    expect(writeVer.status).toBe('verified_successful');

    // Read file action
    const readAction: ActionProposal = {
      ...writeAction,
      id: crypto.randomUUID(),
      type: 'system_read_file',
    };
    const readObs = await agency.executeAction(readAction);
    expect(readObs.success).toBe(true);
    const readVer = verificationEngine.verify(readAction, readObs);
    expect(readVer.verified).toBe(true);
    expect(readVer.observedOutcome).toContain('File content read');

    // Command exec action
    const cmdAction: ActionProposal = {
      ...writeAction,
      id: crypto.randomUUID(),
      type: 'execute_command',
      payload: { command: 'echo hello' },
    };
    const cmdObs = await agency.executeAction(cmdAction);
    expect(cmdObs.success).toBe(true);
    const cmdVer = verificationEngine.verify(cmdAction, cmdObs);
    expect(cmdVer.verified).toBe(true);
    expect(cmdVer.status).toBe('verified_successful');
  });

  // 17. Application launch verification fails when window is missing
  it('17. App launch verification: fails when process starts but window is not detected', () => {
    const verificationEngine = new VerificationEngine(rootLogger);
    const action: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'app_launch',
      payload: { appName: 'google-chrome' },
      rationale: 'Launch Chrome browser',
      expectedOutcome: 'Window opens with title Google Chrome',
      riskLevel: 'medium',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    };

    // Observation with process running but windowFound: false
    const failedObservation = {
      id: crypto.randomUUID(),
      taskId: action.taskId,
      actionId: action.id,
      source: 'process_table' as const,
      timestamp: new Date().toISOString(),
      success: true,
      confidence: 1.0,
      provenance: 'ComputerProvider.launchApp',
      data: {
        appName: 'google-chrome',
        pid: 4321,
        isRunning: true,
        windowFound: false,
      },
    };

    const ver = verificationEngine.verify(action, failedObservation);
    expect(ver.verified).toBe(false);
    expect(ver.status).toBe('partially_successful');
    expect(ver.failureReason).toContain(
      "Application window for 'google-chrome' not visible or failed to map",
    );
  });

  // 18. Token double-consumption and scope grammar unification (code_modify <-> code_modification)
  it('18. Token double-consumption & scope grammar: passes ethical gate without premature nonce consumption', () => {
    const permController = new ActionPermissionController();
    const ethicalEngine = apeService.ethicalBoundariesSecurityEngine;
    permController.setEthicalBoundariesEngine(ethicalEngine);
    ethicalEngine.setActionPermissionController(permController);

    const action: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'code_modify',
      payload: {
        filePath: 'packages/core/src/ape/ethicalBoundariesSecurityEngine.ts',
        changes: 'test modification',
      },
      rationale: 'Modify core engine code',
      expectedOutcome: 'Code modified',
      riskLevel: 'critical',
      requiresExplicitApproval: true,
      createdAt: new Date().toISOString(),
    };

    const digest = ActionPermissionController.computeActionDigest(action);
    const target = ActionPermissionController.extractTargetResource(action);

    // Issue approval token with canonical scope 'code_modification'
    const approval = permController.createApprovalToken({
      actionDigest: digest,
      targetResource: target,
      scope: 'code_modification',
      userId: 'Proof',
    });

    const approvedAction: ActionProposal = {
      ...action,
      payload: { ...action.payload, approvalToken: approval.token },
    };

    // Evaluate action through permission controller (which queries ethicalEngine first, then validates token)
    const result = permController.evaluate(approvedAction);
    expect(result.decision).toBe('granted');

    // Second evaluation with the same token must fail due to nonce consumption
    const replayResult = permController.evaluate(approvedAction);
    expect(replayResult.decision).toBe('denied');
    expect(replayResult.reason).toContain('replay attack detected');
  });

  // 19. timingSafeEqual buffer length mismatch guard
  it('19. timingSafeEqual guard: malformed or truncated HMAC token signature returns false without panic', () => {
    const permController = new ActionPermissionController();
    const digest = 'a'.repeat(64);
    const target = '/tmp/safe.txt';

    // Normal token
    const tokenObj = permController.createApprovalToken({
      actionDigest: digest,
      targetResource: target,
      scope: 'action:test',
      userId: 'Proof',
    });

    const [body, _hmac] = tokenObj.token.split('.');

    // 19a. Truncated HMAC signature
    const truncatedToken = `${body}.deadbeef`;
    const checkTruncated = permController.validateApprovalToken(
      truncatedToken,
      digest,
      target,
      'action:test',
      'Proof',
    );
    expect(checkTruncated.valid).toBe(false);
    expect(checkTruncated.reason).toContain('signature verification failed');

    // 19b. Oversized HMAC signature
    const oversizedToken = `${body}.${'f'.repeat(128)}`;
    const checkOversized = permController.validateApprovalToken(
      oversizedToken,
      digest,
      target,
      'action:test',
      'Proof',
    );
    expect(checkOversized.valid).toBe(false);
    expect(checkOversized.reason).toContain('signature verification failed');

    // 19c. Empty signature
    const emptySigToken = `${body}.`;
    const checkEmpty = permController.validateApprovalToken(
      emptySigToken,
      digest,
      target,
      'action:test',
      'Proof',
    );
    expect(checkEmpty.valid).toBe(false);
  });

  // 20. Filesystem write SHA-256 read-back failure detection
  it('20. Filesystem write SHA-256 read-back: fails when disk contents differ from written payload', async () => {
    const mockCorruptedComputer = {
      writeFile: async () => ({ success: true, sizeBytes: 11 }),
      readFile: async () => 'tampered or corrupted content on disk',
    };

    const verificationEngine = new VerificationEngine(rootLogger);
    const agency = new ClosedLoopAgencyService({
      permissionController: new ActionPermissionController({ allowedFilesystemPaths: ['/tmp'] }),
      computerProvider: mockCorruptedComputer as any,
      verificationEngine,
      logger: rootLogger,
    });

    const writeAction: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'system_write_file',
      payload: { filePath: '/tmp/safe.txt', content: 'hello world' },
      rationale: 'Write test file with integrity check',
      expectedOutcome: 'File written safely',
      riskLevel: 'low',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    };

    const obs = await agency.executeAction(writeAction);
    expect(obs.success).toBe(false);
    expect(obs.error).toContain('SHA-256 hash mismatch');

    const ver = verificationEngine.verify(writeAction, obs);
    expect(ver.verified).toBe(false);
    expect(ver.status).toBe('failed');
  });

  // 21. Fake-success elimination for unconfigured providers
  it('21. Fake-success elimination: desktop and telegram fail closed when providers are not configured', async () => {
    const emptyAgency = new ClosedLoopAgencyService({
      permissionController: new ActionPermissionController(),
      logger: rootLogger,
    });

    // Desktop input without provider
    const desktopAction: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'desktop_mouse_click',
      payload: { x: 100, y: 200 },
      rationale: 'Click mouse',
      expectedOutcome: 'Mouse clicked',
      riskLevel: 'low',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    };
    const desktopObs = await emptyAgency.executeAction(desktopAction);
    expect(desktopObs.success).toBe(false);
    expect(desktopObs.confidence).toBe(0.0);
    expect(desktopObs.error).toContain('DeviceAgency provider not configured');

    // Telegram dispatch without provider
    const telegramAction: ActionProposal = {
      id: crypto.randomUUID(),
      taskId: crypto.randomUUID(),
      stepIndex: 0,
      type: 'telegram_send_message',
      payload: { chatId: '12345', text: 'Hello Proof' },
      rationale: 'Send message',
      expectedOutcome: 'Message delivered',
      riskLevel: 'low',
      requiresExplicitApproval: false,
      createdAt: new Date().toISOString(),
    };
    const telegramObs = await emptyAgency.executeAction(telegramAction);
    expect(telegramObs.success).toBe(false);
    expect(telegramObs.confidence).toBe(0.0);
    expect(telegramObs.error).toContain('TelegramBridge provider not configured');
  });

  // 22. Durable idempotency atomic claim and crash recovery
  it('22. Durable idempotency & crash recovery: recovers interrupted in-flight events across restarts', async () => {
    // Simulate in-flight claim before simulated crash
    const claimResult = apeRepo.claimInFlightEvent({
      idempotencyKey: 'test_event:user:crash_demo',
      eventId: 'event-crash-123',
      eventType: 'user_message',
      source: 'user',
    });
    expect(claimResult.claimed).toBe(true);

    // Verify event is in in_flight state
    const inFlightRecord = apeRepo.getIdempotencyRecord('test_event:user:crash_demo');
    expect(inFlightRecord?.state).toBe('in_flight');

    // Re-claiming the same key while in-flight is denied
    const secondClaim = apeRepo.claimInFlightEvent({
      idempotencyKey: 'test_event:user:crash_demo',
      eventId: 'event-crash-123',
      eventType: 'user_message',
      source: 'user',
    });
    expect(secondClaim.claimed).toBe(false);

    // Simulate process crash and restart: call recoverInFlightEvents()
    const recovered = apeRepo.recoverInFlightEvents();
    expect(recovered.length).toBe(1);
    expect(recovered[0]?.idempotencyKey).toBe('test_event:user:crash_demo');
    expect(recovered[0]?.eventId).toBe('event-crash-123');

    // Verify event transitioned to failed with crash recovery provenance
    const postRecovery = apeRepo.getIdempotencyRecord('test_event:user:crash_demo');
    expect(postRecovery?.state).toBe('failed');
    expect(postRecovery?.result?.error).toContain('InterruptedByCrashRecovery');
  });
});
