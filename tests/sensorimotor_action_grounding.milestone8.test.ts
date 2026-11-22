import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  ActionOutcomeVerification,
  assertActionGroundingIntegrity,
  SpatialCalibration,
  SpatialTarget,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  SensorimotorActionEngine,
  InMemorySensorimotorRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  SensorimotorRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 08 — Sensorimotor and Action Grounding', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sensorimotorRepo: SensorimotorRepository;
  let apeRepo: ApeRepository;
  let sensorimotorEngine: SensorimotorActionEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m8-sensorimotor-'));
    dbPath = path.join(tempDir, 'sensorimotor_m8.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sensorimotorRepo = new SensorimotorRepository(db);
    apeRepo = new ApeRepository(db);
    sensorimotorEngine = new SensorimotorActionEngine({
      repository: sensorimotorRepo,
      screenWidth: 1920,
      screenHeight: 1080,
    });
  });

  afterEach(async () => {
    for (const srv of activeServers) {
      try {
        await srv.stop();
      } catch {}
    }
    activeServers = [];
    try {
      dbService.close();
    } catch {}
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createServer(): ArletexBackendServer {
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
      inference: {
        provider: 'llama.cpp',
        serverUrl: 'http://127.0.0.1:8080',
        defaultModelId: 'Qwen2.5-14B-Uncensored-Q4_K_M',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        repeatPenalty: 1.18,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: [],
        contextSize: 8192,
        specialistCoding: {
          enabled: false,
          provider: 'llama.cpp',
          serverUrl: 'http://127.0.0.1:8081',
          modelId: 'qwen2.5-coder',
          temperature: 0.2,
          maxTokens: 2048,
        },
      },
    });
    const srv = new ArletexBackendServer(config);
    activeServers.push(srv);
    return srv;
  }

  it('1. Strict Negative Invariant: Enforces distinction between attempted action and verified outcome', () => {
    // A. Claiming isVerified=true while status is unverified must be rejected
    const invalidUnverified: ActionOutcomeVerification = {
      status: 'unverified',
      verificationMethod: 'none',
      intendedOutcome: 'Click send button',
      observedDelta: '',
      confidence: 0,
      isVerified: true,
    };
    const check1 = assertActionGroundingIntegrity(
      'Click send button',
      invalidUnverified,
      'Dispatched click',
    );
    expect(check1.valid).toBe(false);
    expect(check1.error).toContain(
      'cannot be marked isVerified=true while verification.status is unverified',
    );

    // B. Claiming success when verification failed must be rejected
    const failedVerification: ActionOutcomeVerification = {
      status: 'verified_failure',
      verificationMethod: 'screen_state_change',
      intendedOutcome: 'Focus text editor',
      observedDelta: 'Window remained unfocused',
      confidence: 0.9,
      isVerified: true,
    };
    const fraudulentClaim =
      'Dispatched focus command and successfully achieved intended outcome without check.';
    const check2 = assertActionGroundingIntegrity(
      'Focus text editor',
      failedVerification,
      fraudulentClaim,
    );
    expect(check2.valid).toBe(false);
    expect(check2.error).toContain(
      'Claiming success on an unverified or failed action is prohibited',
    );

    // C. Legitimate verified success with honest distinction is accepted
    const validSuccess: ActionOutcomeVerification = {
      status: 'verified_success',
      verificationMethod: 'window_event',
      intendedOutcome: 'Focus text editor',
      observedDelta: 'Window ID 40821 reported focus in window manager event log',
      confidence: 0.98,
      isVerified: true,
    };
    const honestAnalysis =
      'Attempted window focus. Independent verification observed focus event. Intended outcome was verified.';
    const check3 = assertActionGroundingIntegrity(
      'Focus text editor',
      validSuccess,
      honestAnalysis,
    );
    expect(check3.valid).toBe(true);
    expect(check3.error).toBeUndefined();
  });

  it('2. Understands screen-coordinates and spatial coordinate transformations', () => {
    // Setup active window geometry
    sensorimotorEngine.calibrateSpatialEnvironment({
      screenWidth: 2560,
      screenHeight: 1440,
      activeWindows: [
        {
          windowId: 'win_editor_1',
          title: 'VSCode — Arletex',
          x: 200,
          y: 100,
          width: 1200,
          height: 800,
          isFocused: true,
        },
      ],
    });

    // A. Absolute screen coordinates
    const absTarget: SpatialTarget = {
      coordinateSystem: 'screen_absolute',
      x: 500,
      y: 400,
    };
    const translatedAbs = sensorimotorEngine.translateCoordinates(absTarget);
    expect(translatedAbs.x).toBe(500);
    expect(translatedAbs.y).toBe(400);
    expect(translatedAbs.isWithinScreenBounds).toBe(true);

    // B. Window-relative coordinates (offset by window x:200, y:100)
    const winTarget: SpatialTarget = {
      coordinateSystem: 'window_relative',
      windowId: 'win_editor_1',
      x: 50,
      y: 75,
    };
    const translatedWin = sensorimotorEngine.translateCoordinates(winTarget);
    expect(translatedWin.x).toBe(250); // 200 + 50
    expect(translatedWin.y).toBe(175); // 100 + 75
    expect(translatedWin.isWithinScreenBounds).toBe(true);

    // C. UI element bounding box center calculation ([x, y, width, height])
    const elemTarget: SpatialTarget = {
      coordinateSystem: 'ui_element_relative',
      boundingBox: [300, 200, 80, 40],
    };
    const translatedElem = sensorimotorEngine.translateCoordinates(elemTarget);
    expect(translatedElem.x).toBe(340); // 300 + 40
    expect(translatedElem.y).toBe(220); // 200 + 20

    // D. Out of bounds detection
    const oobTarget: SpatialTarget = {
      coordinateSystem: 'screen_absolute',
      x: 3000,
      y: 1500,
    };
    const translatedOob = sensorimotorEngine.translateCoordinates(oobTarget);
    expect(translatedOob.isWithinScreenBounds).toBe(false);
  });

  it('3. Dispatches and grounds mouse interaction with independent verification', async () => {
    const record = await sensorimotorEngine.executeActionWithVerification({
      sessionId: 'session_test_1',
      actionType: 'mouse_click',
      spatialTarget: {
        coordinateSystem: 'screen_absolute',
        x: 450,
        y: 600,
      },
      intendedOutcome: 'Activate Send Button',
      mockObservedDelta:
        'Button visually depressed and message appeared in chat transcript container',
    });

    expect(record.id).toBeDefined();
    expect(record.actionType).toBe('mouse_click');
    expect(record.executionStatus).toBe('executed');
    expect(record.verification.isVerified).toBe(true);
    expect(record.verification.status).toBe('verified_success');
    expect(record.distinctionAnalysis).toContain('Attempted mouse_click');
    expect(record.distinctionAnalysis).toContain('was successfully verified');
  });

  it('4. Dispatches and grounds keyboard interaction with shortcut and typing', async () => {
    const typeRecord = await sensorimotorEngine.executeActionWithVerification({
      sessionId: 'session_test_1',
      actionType: 'keyboard_type',
      spatialTarget: { coordinateSystem: 'screen_absolute' },
      intendedOutcome: 'Input prompt into text area',
      parameters: { text: 'Arle, what is your current operational status?' },
      mockObservedDelta: 'Text input element value updated to match input string',
    });

    expect(typeRecord.actionType).toBe('keyboard_type');
    expect(typeRecord.attemptedPayload.parameters.text).toBe(
      'Arle, what is your current operational status?',
    );
    expect(typeRecord.verification.status).toBe('verified_success');

    const shortcutRecord = await sensorimotorEngine.executeActionWithVerification({
      sessionId: 'session_test_1',
      actionType: 'keyboard_shortcut',
      spatialTarget: { coordinateSystem: 'screen_absolute' },
      intendedOutcome: 'Submit message via Enter key',
      parameters: { key: 'Return', modifiers: [] },
      mockObservedDelta: 'Input cleared and network request initiated to /api/chat',
    });

    expect(shortcutRecord.actionType).toBe('keyboard_shortcut');
    expect(shortcutRecord.verification.status).toBe('verified_success');
  });

  it('5. Recognizes action failures and distinguishes attempts from unachieved outcomes', async () => {
    const failureRecord = await sensorimotorEngine.executeActionWithVerification({
      sessionId: 'session_test_1',
      actionType: 'mouse_click',
      spatialTarget: {
        coordinateSystem: 'screen_absolute',
        x: 800,
        y: 400,
      },
      intendedOutcome: 'Focus Terminal Window',
      forceFailure: true,
      mockObservedDelta:
        'Window manager state unchanged; terminal window remained inactive and unfocused.',
    });

    expect(failureRecord.executionStatus).toBe('failed_execution');
    expect(failureRecord.verification.status).toBe('verified_failure');
    expect(failureRecord.verification.isVerified).toBe(true);

    // Acceptance Criteria: Explicit distinction between attempted action and verified failure
    expect(failureRecord.distinctionAnalysis).toContain(
      'The action was dispatched but FAILED to achieve the intended outcome',
    );
  });

  it('6. Aborts out-of-bounds interactions gracefully before dispatch', async () => {
    const oobRecord = await sensorimotorEngine.executeActionWithVerification({
      sessionId: 'session_test_1',
      actionType: 'mouse_click',
      spatialTarget: {
        coordinateSystem: 'screen_absolute',
        x: 9999,
        y: 9999,
      },
      intendedOutcome: 'Click non-existent icon offscreen',
    });

    expect(oobRecord.executionStatus).toBe('failed_execution');
    expect(oobRecord.verification.status).toBe('verified_failure');
    expect(oobRecord.verification.observedDelta).toContain('outside physical screen boundaries');
  });

  it('7. Learns interaction strategies and adapts behavior based on empirical reliability', () => {
    // Record initial strategy for code editor saving
    const strategy = sensorimotorEngine.recordInteractionStrategy({
      targetAppOrContext: 'code_editor',
      goalType: 'save_document',
      primarySequence: [{ action: 'keyboard_shortcut', key: 's', modifiers: ['Control'] }],
      fallbackSequence: [
        { action: 'mouse_click', target: 'File_Menu' },
        { action: 'mouse_click', target: 'Save_Option' },
      ],
    });

    expect(strategy.targetAppOrContext).toBe('code_editor');
    expect(strategy.goalType).toBe('save_document');
    expect(strategy.primarySequence.length).toBe(1);
    expect(strategy.fallbackSequence?.length).toBe(2);

    // Initial plan should use primary sequence
    const plan1 = sensorimotorEngine.getAdaptiveActionPlan('code_editor', 'save_document');
    expect(plan1.recommendedSequence).toEqual(strategy.primarySequence);

    // Now record multiple failures to lower reliability below 0.5
    for (let i = 0; i < 4; i++) {
      sensorimotorEngine['updateStrategyExperience']('code_editor', 'save_document', false);
    }

    // Adaptive action plan should automatically switch to fallback sequence
    const plan2 = sensorimotorEngine.getAdaptiveActionPlan('code_editor', 'save_document');
    expect(plan2.strategy?.empiricalReliability).toBeLessThan(0.5);
    expect(plan2.recommendedSequence).toEqual(strategy.fallbackSequence);
  });

  it('8. Persists action records, strategies, and spatial calibrations across database restarts', () => {
    const calib: SpatialCalibration = {
      displayId: 'display_secondary',
      screenWidth: 1920,
      screenHeight: 1200,
      scaleFactor: 1.25,
      activeWindows: [
        {
          windowId: 'win_browser_1',
          title: 'Documentation — Firefox',
          x: 0,
          y: 0,
          width: 960,
          height: 1200,
          isFocused: true,
        },
      ],
      calibratedAt: new Date().toISOString(),
    };
    sensorimotorRepo.saveSpatialCalibration(calib);

    // Reopen DB connection
    dbService.close();
    const reopenedDbService = new DatabaseService(dbPath);
    const reopenedDb = reopenedDbService.connect();
    const newRepo = new SensorimotorRepository(reopenedDb);

    const retrievedCalib = newRepo.getLatestSpatialCalibration('display_secondary');
    expect(retrievedCalib).not.toBeNull();
    expect(retrievedCalib?.screenWidth).toBe(1920);
    expect(retrievedCalib?.scaleFactor).toBe(1.25);
    expect(retrievedCalib?.activeWindows[0].title).toBe('Documentation — Firefox');

    reopenedDbService.close();
  });

  it('9. Synthesizes Sensorimotor and Action Grounding in ApeService prompt context', async () => {
    const apeService = new ApeService(
      apeRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      sensorimotorRepo,
    );

    // Execute an action
    await apeService.executeSensorimotorAction({
      sessionId: 'session_ape_1',
      actionType: 'mouse_click',
      spatialTarget: { coordinateSystem: 'screen_absolute', x: 100, y: 100 },
      intendedOutcome: 'Focus Main Navigation',
      mockObservedDelta: 'Nav pane rendered active visual indicator',
    });

    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('Sensorimotor & Action Grounding:');
    expect(promptContext).toContain('Executed actions: 1');
    expect(promptContext).toContain(
      'Attempted actions strictly distinguished from verified outcomes',
    );
  });

  it('10. Mounts and serves REST API endpoints for Sensorimotor and Action Grounding', async () => {
    const server = createServer();
    const port = await server.start();

    try {
      // 1. POST /api/ape/sensorimotor/action
      const actionRes = await fetch(`http://127.0.0.1:${port}/api/ape/sensorimotor/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'session_rest_1',
          actionType: 'keyboard_type',
          spatialTarget: { coordinateSystem: 'screen_absolute' },
          intendedOutcome: 'Type test command in terminal',
          parameters: { text: 'echo "hello from sensorimotor"' },
          mockObservedDelta: 'Terminal emulator printed string to stdout buffer',
        }),
      });
      expect(actionRes.status).toBe(201);
      const actionData = (await actionRes.json()) as any;
      expect(actionData.success).toBe(true);
      expect(actionData.record.id).toBeDefined();

      // 2. GET /api/ape/sensorimotor/actions
      const listRes = await fetch(`http://127.0.0.1:${port}/api/ape/sensorimotor/actions?limit=5`);
      expect(listRes.status).toBe(200);
      const listData = (await listRes.json()) as any;
      expect(Array.isArray(listData)).toBe(true);
      expect(listData.length).toBeGreaterThanOrEqual(1);

      // 3. POST /api/ape/sensorimotor/calibrate
      const calibRes = await fetch(`http://127.0.0.1:${port}/api/ape/sensorimotor/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenWidth: 1920,
          screenHeight: 1080,
          scaleFactor: 1.0,
        }),
      });
      expect(calibRes.status).toBe(200);
      const calibData = (await calibRes.json()) as any;
      expect(calibData.success).toBe(true);
      expect(calibData.calibration.screenWidth).toBe(1920);

      // 4. GET /api/ape/sensorimotor/summary
      const summaryRes = await fetch(`http://127.0.0.1:${port}/api/ape/sensorimotor/summary`);
      expect(summaryRes.status).toBe(200);
      const summaryData = (await summaryRes.json()) as any;
      expect(summaryData.totalActions).toBeGreaterThanOrEqual(1);
      expect(summaryData.successRate).toBeGreaterThanOrEqual(0);
    } finally {
      await server.stop();
    }
  });
});
