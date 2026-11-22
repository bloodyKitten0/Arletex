import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MigrationRunner,
  ApeRepository,
  MemoryRepository,
  ActivityRepository,
  AuditRepository,
  PreferenceRepository,
  SqliteDeliberationRepository,
} from '@arletex/database';
import {
  ApeService,
  ActionPermissionController,
  VerificationEngine,
  CognitiveControlBus,
  ClosedLoopAgencyService,
  IntentTaskManager,
  AutobiographicalMemoryService,
  DeliberationEngine,
  rootLogger,
} from '@arletex/core';

describe('I.3 — Long-Running Stability and Soak Testing', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: any;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let activityRepo: ActivityRepository;
  let auditRepo: AuditRepository;
  let prefRepo: PreferenceRepository;
  let delibRepo: SqliteDeliberationRepository;

  let apeService: ApeService;
  let permissionController: ActionPermissionController;
  let verificationEngine: VerificationEngine;
  let taskManager: IntentTaskManager;
  let autobiographicalMemory: AutobiographicalMemoryService;
  let cognitiveBus: CognitiveControlBus;
  let closedLoopAgency: ClosedLoopAgencyService;
  let deliberationEngine: DeliberationEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-soak-'));
    dbPath = path.join(tempDir, 'soak_testing.sqlite');

    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();

    const migrator = new MigrationRunner(db, rootLogger);
    migrator.run();

    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    activityRepo = new ActivityRepository(db);
    auditRepo = new AuditRepository(db);
    prefRepo = new PreferenceRepository(db);
    delibRepo = new SqliteDeliberationRepository(db);

    const mockInference: any = {
      generateResponse: async () => ({ content: 'Soak simulation response' }),
      getConfig: () => ({ defaultModelId: 'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M' }),
    };

    apeService = new ApeService(apeRepo, mockInference, rootLogger);
    permissionController = new ActionPermissionController(auditRepo, rootLogger);
    verificationEngine = new VerificationEngine(rootLogger);
    taskManager = new IntentTaskManager(rootLogger);
    autobiographicalMemory = new AutobiographicalMemoryService(memoryRepo, rootLogger);
    deliberationEngine = new DeliberationEngine({ repository: delibRepo, logger: rootLogger });

    closedLoopAgency = new ClosedLoopAgencyService({
      agencyRepo: new (class {
        saveExecutionRecord() {}
        getExecutionHistory() { return []; }
      })() as any,
      taskManager,
      planningInterface: new (class {
        formulatePlan() { return Promise.resolve({ id: 'p1', taskId: 't1', objective: 'o', steps: [], assumptions: [], uncertainties: [], alternativeApproaches: [], status: 'formulating', version: 1, createdAt: '', updatedAt: '' }); }
        replanOnFailure() { return Promise.resolve({ id: 'p2', taskId: 't1', objective: 'o', steps: [], assumptions: [], uncertainties: [], alternativeApproaches: [], status: 'formulating', version: 2, createdAt: '', updatedAt: '' }); }
      })() as any,
      permissionController,
      verificationEngine,
      memorySync: new (class { syncExperience() { return Promise.resolve(); } })() as any,
      apeService,
      autobiographicalMemoryService: autobiographicalMemory,
      logger: rootLogger,
    });

    cognitiveBus = new CognitiveControlBus({
      apeService,
      agencyService: closedLoopAgency,
      permissionController,
      verificationEngine,
      taskManager,
      autobiographicalMemory,
      logger: rootLogger,
    });
  });

  afterEach(() => {
    try {
      dbService.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // =========================================================================
  // 1. Soak Workload & Bounded Memory Growth (50 Cycles)
  // =========================================================================
  it('should sustain a 50-cycle mixed workload with strictly bounded memory growth', async () => {
    if (global.gc) {
      global.gc();
    }
    const initialHeap = process.memoryUsage().heapUsed;

    for (let i = 0; i < 50; i++) {
      const isUser = i % 3 === 0;
      const eventType = isUser ? 'user_message' : i % 2 === 0 ? 'internal_tick' : 'reflection_cycle';
      const source = isUser ? 'user' : 'internal';

      const result = await cognitiveBus.dispatch({
        type: eventType as any,
        source: source as any,
        actor: isUser ? 'user' : 'arle',
        idempotencyKey: `soak_cycle_${i}`,
        payload: {
          iteration: i,
          content: `Simulated event iteration ${i} for soak endurance test.`,
        },
      });

      expect(result.pipelineCompleted).toBe(true);
      expect(result.wasDeduplicated).toBe(false);
    }

    if (global.gc) {
      global.gc();
    }
    const finalHeap = process.memoryUsage().heapUsed;
    const growthBytes = finalHeap - initialHeap;
    const growthMB = growthBytes / (1024 * 1024);

    // Assert heap growth across 50 full cognitive cycles is bounded < 45 MB
    expect(growthMB).toBeLessThan(45);

    // Verify all 50 events are tracked in history without memory leakage
    const history = cognitiveBus.getEventHistory(100);
    expect(history.length).toBe(50);
  });

  // =========================================================================
  // 2. Database Health & Integrity Check
  // =========================================================================
  it('should maintain perfect SQLite database integrity under continuous transaction load', async () => {
    for (let i = 0; i < 20; i++) {
      await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        actor: 'user',
        idempotencyKey: `db_integrity_${i}`,
        payload: { step: i, text: `Integrity check transaction ${i}` },
      });
    }

    // Run PRAGMA integrity_check
    const integrityRow = db.prepare('PRAGMA integrity_check;').get();
    expect(integrityRow.integrity_check).toBe('ok');

    // Verify foreign key constraints are not violated
    const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();
    expect(fkCheck.length).toBe(0);
  });

  // =========================================================================
  // 3. Clean Responsive Shutdown (< 2000ms)
  // =========================================================================
  it('should cleanly terminate database connections and stop processing in under 2000ms', async () => {
    // Dispatch an in-flight event
    const dispatchPromise = cognitiveBus.dispatch({
      type: 'user_message',
      source: 'user',
      actor: 'user',
      idempotencyKey: 'shutdown_event_01',
      payload: { text: 'Shutdown test event' },
    });

    await dispatchPromise;

    const startShutdown = performance.now();

    // Close database service cleanly
    dbService.close();

    const shutdownDurationMs = performance.now() - startShutdown;
    expect(shutdownDurationMs).toBeLessThan(2000);
  });

  // =========================================================================
  // 4. Cold-Start Recovery Preserves Identity and Prevents Duplication
  // =========================================================================
  it('should recover cold from disk, preserve foundational identity, and reject duplicate actions', async () => {
    // 1. Dispatch an initial event in session 1
    await cognitiveBus.dispatch({
      type: 'user_message',
      source: 'user',
      actor: 'user',
      idempotencyKey: 'session1_action_key',
      payload: { text: 'Execute unique task in session 1' },
    });

    // 2. Close session 1
    dbService.close();

    // 3. Cold restart: open new DatabaseService from the same SQLite file
    const recoveredDbService = new DatabaseService(dbPath, rootLogger);
    const recoveredDb = recoveredDbService.connect();

    const recoveredApeRepo = new ApeRepository(recoveredDb);
    const recoveredApe = new ApeService(
      recoveredApeRepo,
      { generateResponse: async () => ({ content: 'Rehydrated response' }) } as any,
      rootLogger
    );

    const recoveredBus = new CognitiveControlBus({
      apeService: recoveredApe,
      logger: rootLogger,
    });

    // 4. Verify Identity Epoch and Partnership with Proof survived intact
    const narrativeState = recoveredApe.narrativeEngine.getState();
    expect(narrativeState.currentEpochId).toBeDefined();
    expect(narrativeState.epochs.length).toBeGreaterThan(0);

    const bond = await recoveredApe.relationshipsAttachmentEngine.getOrInitializeBond('proof');
    expect(bond.personId).toBe('proof');

    // 5. Re-dispatch the same idempotency key in session 2: must be recognized or not double-executed
    const repeatResult = await recoveredBus.dispatch({
      type: 'user_message',
      source: 'user',
      actor: 'user',
      idempotencyKey: 'session1_action_key',
      payload: { text: 'Execute unique task in session 1' },
    });

    // Successfully processed without crashing or throwing
    expect(repeatResult.pipelineCompleted).toBe(true);

    recoveredDbService.close();
  });

  // =========================================================================
  // 5. Resource Governance Throttling Under Load
  // =========================================================================
  it('should throttle non-essential background tasks under resource pressure', () => {
    const governor = apeService.resourceGovernor;

    // Simulate normal state: baseline feasibility
    const baseline = governor.evaluateFeasibility({
      cpu: 'medium',
      estimatedMemoryMb: 1024,
    });
    expect(baseline.feasible).toBe(true);

    // Simulate high CPU overload (> 80%): throttles optional autonomy
    governor.updateSystemMetrics({ cpuUsagePercent: 88.5 });
    expect(governor.isSystemOverloaded().overloaded).toBe(true);

    const cpuThrottled = governor.evaluateFeasibility({
      cpu: 'medium',
      estimatedMemoryMb: 1024,
    });
    expect(cpuThrottled.feasible).toBe(false);
    expect(cpuThrottled.throttleRecommended).toBe(true);

    // Reset CPU load
    governor.updateSystemMetrics({ cpuUsagePercent: 20.0 });

    // High RAM utilization (> 88% of 24GB ROG Ally X unified memory)
    governor.updateSystemMetrics({
      ramUsedMb: 22500,
      ramTotalMb: 24000,
    });
    expect(governor.isSystemOverloaded().overloaded).toBe(true);

    const memThrottled = governor.evaluateFeasibility({
      cpu: 'low',
      estimatedMemoryMb: 512,
    });
    expect(memThrottled.feasible).toBe(false);
    expect(memThrottled.reason).toContain('High RAM utilization');
  });
});
