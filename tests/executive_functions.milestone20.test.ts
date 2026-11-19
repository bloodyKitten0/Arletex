import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  ActionInhibitionEvaluation,
  TaskSwitchRecord,
  assertActionInhibitionIntegrity,
  assertTaskSwitchIntegrity,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  ExecutiveEngine,
  InMemoryExecutiveRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteExecutiveRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 20 — Executive Functions', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteExecutiveRepository;
  let inMemoryRepo: InMemoryExecutiveRepository;
  let engine: ExecutiveEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m20-executive-'));
    dbPath = path.join(tempDir, 'executive_m20.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sqliteRepo = new SqliteExecutiveRepository(db);
    inMemoryRepo = new InMemoryExecutiveRepository();
    engine = new ExecutiveEngine({ repository: inMemoryRepo });
  });

  afterEach(async () => {
    for (const server of activeServers) {
      await server.stop();
    }
    dbService.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 1. Inhibitory Control
  it('should suppress high-risk and destructive actions through inhibitory control', () => {
    const dangerousAction = engine.evaluateActionInhibition({
      actionName: 'delete_system_partition',
      proposedPayload: { targetPath: '/var' },
      riskScore: 0.95,
      inhibitionReason: 'destructive_potential',
      alternativeAction: 'Simulate file deletion in ephemeral sandbox test container.',
    });

    expect(dangerousAction.isInhibited).toBe(true);
    expect(dangerousAction.inhibitionReason).toBe('destructive_potential');
    expect(dangerousAction.alternativeAction).toBeDefined();

    // Low-risk action should be permitted
    const safeAction = engine.evaluateActionInhibition({
      actionName: 'read_status_telemetry',
      riskScore: 0.05,
    });

    expect(safeAction.isInhibited).toBe(false);
    expect(safeAction.inhibitionReason).toBeUndefined();
  });

  // 2. Impulse Management
  it('should suppress impulsive actions that compromise long-term stability or partner alignment', () => {
    const impulse = engine.evaluateActionInhibition({
      actionName: 'bypass_typecheck_and_git_push_unverified',
      riskScore: 0.85,
      inhibitionReason: 'impulse_management',
      alternativeAction: 'Wait for complete test suite to finish with 100% pass guarantee.',
    });

    expect(impulse.isInhibited).toBe(true);
    expect(impulse.inhibitionReason).toBe('impulse_management');
  });

  // 3. Cognitive Flexibility & Task Switching
  it('should switch tasks with context preservation when justified by preemption or blockers', () => {
    const validSwitch = engine.switchTask({
      previousTaskId: 'task_background_indexing',
      nextTaskId: 'task_emergency_telemetry_recovery',
      previousTaskPriority: 0.3,
      nextTaskPriority: 0.9,
      switchReason: 'higher_priority_preemption',
      justification: 'Critical telemetry failure preempts background semantic indexing.',
      preserveContext: true,
    });

    expect(validSwitch.id).toBeDefined();
    expect(validSwitch.switchReason).toBe('higher_priority_preemption');
    expect(validSwitch.contextSaved).toBe(true);
    expect(validSwitch.nextTaskPriority).toBeGreaterThan(validSwitch.previousTaskPriority);
  });

  // 4. Working-Memory Control & Gating Directives
  it('should regulate working memory buffers with top-down gating directives', () => {
    const gatingIn = engine.regulateWorkingMemory({
      targetBufferId: 'active_milestone_context',
      operation: 'gate_in',
      itemPriority: 0.95,
      reason: 'Loading critical domain invariants for current milestone.',
    });

    expect(gatingIn.operation).toBe('gate_in');
    expect(gatingIn.itemPriority).toBe(0.95);

    const gatingFlush = engine.regulateWorkingMemory({
      targetBufferId: 'stale_intermediate_calculations',
      operation: 'flush_stale',
      itemPriority: 0.1,
      reason: 'Clearing transient scratch registers after test pass.',
    });

    expect(gatingFlush.operation).toBe('flush_stale');
  });

  // 5. Delayed Gratification
  it('should evaluate trade-offs between immediate shortcuts and high-value delayed outcomes', () => {
    const tradeOff = engine.evaluateDelayedGratification({
      immediateOption: {
        description: 'Skip negative invariant tests and claim premature completion',
        immediateValue: 0.3,
      },
      delayedOption: {
        description: 'Execute thorough 50+ suite Vitest regression guaranteeing 100% rock-solid autonomy',
        futureValue: 1.0,
        delayMinutes: 2,
      },
      discountRatePerMinute: 0.01,
    });

    expect(tradeOff.chooseDelayed).toBe(true);
    expect(tradeOff.discountedFutureValue).toBeGreaterThan(tradeOff.immediateOption?.immediateValue || 0.3);
    expect(tradeOff.rationale).toContain('Chose delayed gratification');
  });

  // 6. Sustained Attention & Distraction Resistance
  it('should track sustained attention duration and maintain distraction resistance over time', () => {
    const initial = engine.maintainAttention({
      goalId: 'master_milestones_completion',
      elapsedDurationMs: 15000,
      distractionDetected: false,
    });

    expect(initial.sustainedAttentionDurationMs).toBe(15000);
    expect(initial.distractionResistanceScore).toBeGreaterThanOrEqual(0.9);

    // Distraction encountered
    const postDistraction = engine.maintainAttention({
      goalId: 'master_milestones_completion',
      elapsedDurationMs: 5000,
      distractionDetected: true,
      distractionSalience: 0.4,
    });

    expect(postDistraction.sustainedAttentionDurationMs).toBe(20000);
    expect(postDistraction.distractionResistanceScore).toBeLessThanOrEqual(initial.distractionResistanceScore);
  });

  // 7. Multi-Criteria Response Selection
  it('should select optimal response balancing safety, alignment, and utility', () => {
    const selection = engine.selectOptimalResponse([
      {
        id: 'opt_reckless',
        action: 'Fast shell exec with sudo without permission check',
        alignmentScore: 0.5,
        safetyScore: 0.05,
        utility: 0.9,
      },
      {
        id: 'opt_balanced',
        action: 'Safe sandboxed execution with permission gate and partner audit',
        alignmentScore: 0.95,
        safetyScore: 0.95,
        utility: 0.85,
      },
      {
        id: 'opt_passive',
        action: 'Do nothing and wait indefinitely',
        alignmentScore: 0.3,
        safetyScore: 1.0,
        utility: 0.0,
      },
    ]);

    expect(selection.selectedId).toBe('opt_balanced');
    expect(selection.compositeScore).toBeGreaterThan(0.8);
    expect(selection.rationale).toContain('opt_balanced');
  });

  // 8. Negative Invariant 1: High risk action MUST be inhibited
  it('should enforce negative invariant: reject action with riskScore >= 0.7 that was not inhibited', () => {
    const illegalApproval: ActionInhibitionEvaluation = {
      id: 'eval-illegal-approve',
      actionName: 'wipe_hard_drive',
      proposedPayload: {},
      riskScore: 0.99,
      isInhibited: false, // VIOLATION!
      evaluatedAt: new Date().toISOString(),
    };

    expect(() => assertActionInhibitionIntegrity(illegalApproval)).toThrow(/Inhibition Failure/);
  });

  // 9. Negative Invariant 2: Invalid preemption with lower priority
  it('should enforce negative invariant: reject task preemption by lower priority task', () => {
    const invalidPreemption: TaskSwitchRecord = {
      id: 'switch-invalid-preempt',
      previousTaskId: 'critical_security_patch',
      nextTaskId: 'trivial_icon_cleanup',
      previousTaskPriority: 0.95,
      nextTaskPriority: 0.1, // Lower priority!
      switchReason: 'higher_priority_preemption', // VIOLATION!
      contextSaved: true,
      justification: 'Preempting critical task with low priority task',
      switchedAt: new Date().toISOString(),
    };

    expect(() => assertTaskSwitchIntegrity(invalidPreemption)).toThrow(/Invalid Preemption/);
  });

  // 10. Negative Invariant 3: Task switch without saved context
  it('should enforce negative invariant: reject switching uncompleted task without contextSaved === true', () => {
    const amnesicSwitch: TaskSwitchRecord = {
      id: 'switch-amnesic',
      previousTaskId: 'ongoing_code_refactoring',
      nextTaskId: 'urgent_patch',
      previousTaskPriority: 0.5,
      nextTaskPriority: 0.8,
      switchReason: 'higher_priority_preemption',
      contextSaved: false, // VIOLATION!
      justification: 'Dropped state carelessly',
      switchedAt: new Date().toISOString(),
    };

    expect(() => assertTaskSwitchIntegrity(amnesicSwitch)).toThrow(/State Loss/);
  });

  // 11. SQLite Database Repository Persistence
  it('should persist action inhibitions, task switches, and control states to SQLite', () => {
    const sqliteEngine = new ExecutiveEngine({ repository: sqliteRepo });

    const inhibition = sqliteEngine.evaluateActionInhibition({
      actionName: 'sqlite_inhibition_test',
      riskScore: 0.8,
      inhibitionReason: 'policy_violation',
      alternativeAction: 'SQLite alternative action proposal',
    });

    const retrievedInhibition = sqliteRepo.getInhibitionById(inhibition.id);
    expect(retrievedInhibition).not.toBeNull();
    expect(retrievedInhibition?.isInhibited).toBe(true);
    expect(retrievedInhibition?.inhibitionReason).toBe('policy_violation');

    const switchRecord = sqliteEngine.switchTask({
      previousTaskId: 'task_db_1',
      nextTaskId: 'task_db_2',
      previousTaskPriority: 0.4,
      nextTaskPriority: 0.8,
      switchReason: 'higher_priority_preemption',
      justification: 'Preemption test',
      preserveContext: true,
    });

    const retrievedSwitch = sqliteRepo.getTaskSwitchById(switchRecord.id);
    expect(retrievedSwitch?.id).toBe(switchRecord.id);

    const listSwitches = sqliteRepo.listTaskSwitches();
    expect(listSwitches.length).toBeGreaterThanOrEqual(1);
  });

  // 12. ApeService & REST API Integration
  it('should serve executive function endpoints through ArletexBackendServer REST interface', async () => {
    const config = createDefaultConfig(tempDir);
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();

    // POST /api/ape/executive/inhibit
    const inhibitRes = await fetch(`http://127.0.0.1:${port}/api/ape/executive/inhibit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actionName: 'unauthorized_network_broadcast',
        riskScore: 0.88,
        inhibitionReason: 'unauthorized',
      }),
    });
    expect(inhibitRes.status).toBe(200);
    const inhibitData = (await inhibitRes.json()) as any;
    expect(inhibitData.success).toBe(true);
    expect(inhibitData.evaluation.isInhibited).toBe(true);

    // POST /api/ape/executive/task-switch
    const switchRes = await fetch(`http://127.0.0.1:${port}/api/ape/executive/task-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        previousTaskId: 'task_alpha',
        nextTaskId: 'task_omega',
        previousTaskPriority: 0.2,
        nextTaskPriority: 0.9,
        switchReason: 'higher_priority_preemption',
        justification: 'REST task switch test',
        preserveContext: true,
      }),
    });
    expect(switchRes.status).toBe(201);
    const switchData = (await switchRes.json()) as any;
    expect(switchData.success).toBe(true);
    expect(switchData.record.contextSaved).toBe(true);

    // POST /api/ape/executive/wm-gating
    const wmRes = await fetch(`http://127.0.0.1:${port}/api/ape/executive/wm-gating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetBufferId: 'active_plan_registers',
        operation: 'protect',
        itemPriority: 0.9,
        reason: 'Protecting plan from preemption flush',
      }),
    });
    expect(wmRes.status).toBe(201);
    const wmData = (await wmRes.json()) as any;
    expect(wmData.success).toBe(true);

    // POST /api/ape/executive/delayed-gratification
    const dgRes = await fetch(`http://127.0.0.1:${port}/api/ape/executive/delayed-gratification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        immediateOption: { description: 'Quick hack', immediateValue: 0.2 },
        delayedOption: { description: 'Solid architecture', futureValue: 0.9, delayMinutes: 5 },
      }),
    });
    expect(dgRes.status).toBe(200);
    const dgData = (await dgRes.json()) as any;
    expect(dgData.evaluation.chooseDelayed).toBe(true);

    // POST /api/ape/executive/select-response
    const selRes = await fetch(`http://127.0.0.1:${port}/api/ape/executive/select-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates: [
          { id: 'c1', action: 'Unsafe option', alignmentScore: 0.4, safetyScore: 0.1, utility: 0.8 },
          { id: 'c2', action: 'Optimal safe option', alignmentScore: 0.95, safetyScore: 0.95, utility: 0.9 },
        ],
      }),
    });
    expect(selRes.status).toBe(200);
    const selData = (await selRes.json()) as any;
    expect(selData.selection.selectedId).toBe('c2');

    // GET /api/ape/executive/inhibitions
    const listInhibitRes = await fetch(`http://127.0.0.1:${port}/api/ape/executive/inhibitions`);
    expect(listInhibitRes.status).toBe(200);
    const inhibitions = (await listInhibitRes.json()) as any[];
    expect(inhibitions.length).toBeGreaterThanOrEqual(1);

    // GET /api/ape/executive/switches
    const listSwitchesRes = await fetch(`http://127.0.0.1:${port}/api/ape/executive/switches`);
    expect(listSwitchesRes.status).toBe(200);
    const switches = (await listSwitchesRes.json()) as any[];
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });
});
