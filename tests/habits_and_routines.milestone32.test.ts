import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  HabitsAndRoutinesEngine,
  InMemoryHabitsAndRoutinesRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteHabitsAndRoutinesRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 32 — Habits and Routines', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteHabitsAndRoutinesRepository;
  let inMemoryRepo: InMemoryHabitsAndRoutinesRepository;
  let engine: HabitsAndRoutinesEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m32-habits-'));
    dbPath = path.join(tempDir, 'habits_m32.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteHabitsAndRoutinesRepository(db);
    inMemoryRepo = new InMemoryHabitsAndRoutinesRepository();
    engine = new HabitsAndRoutinesEngine(inMemoryRepo);
  });

  afterEach(async () => {
    for (const server of activeServers) {
      try {
        await server.stop();
      } catch (err) {
        console.error('Error stopping server in afterEach:', err);
      }
    }
    activeServers = [];

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

  // 1. Acceptance Criterion: Developing useful recurring behaviours from experience
  it('should maintain useful recurring habits and routines reflecting software and partner reality', () => {
    const habits = engine.listHabits();
    expect(habits.length).toBeGreaterThanOrEqual(2);

    const sessionAlignment = habits.find((h) => h.id === 'habit_session_orientation');
    expect(sessionAlignment).toBeDefined();
    expect(sessionAlignment!.domain).toBe('collaboration');
    expect(sessionAlignment!.repetitionCount).toBeGreaterThan(10);
    expect(sessionAlignment!.automaticityScore).toBeGreaterThan(0.8);
    expect(sessionAlignment!.triggers[0]?.triggerType).toBe('temporal');
    expect(sessionAlignment!.routineSteps.length).toBe(3);

    const codebaseCheck = habits.find((h) => h.id === 'habit_codebase_hygiene');
    expect(codebaseCheck).toBeDefined();
    expect(codebaseCheck!.domain).toBe('craftsmanship');
    expect(codebaseCheck!.utilityScore).toBeGreaterThan(0.9);
  });

  // 2. Habit Formation
  it('should form new habits with contextual triggers and structured procedural steps', () => {
    const habit = engine.formHabit({
      name: 'Post-Milestone Typecheck & Hygiene',
      domain: 'craftsmanship',
      description: 'Run monorepo typecheck and verify clean working tree before committing.',
      triggers: [
        {
          triggerType: 'environmental',
          conditionKey: 'milestone_tests_passed',
          thresholdOrValue: 'true',
          description: 'Triggered when all Vitest milestone assertions pass successfully.',
        },
      ],
      routineSteps: [
        { stepIndex: 0, actionName: 'Run pnpm run typecheck across workspace', expectedDurationMs: 3000, isAutomated: true },
        { stepIndex: 1, actionName: 'Validate next.md has NOT been modified', expectedDurationMs: 100, isAutomated: true },
        { stepIndex: 2, actionName: 'Stage verified files and formulate descriptive commit', expectedDurationMs: 500, isAutomated: true },
      ],
      initialUtility: 0.95,
    });

    expect(habit.id).toMatch(/^habit_/);
    expect(habit.repetitionCount).toBe(1);
    expect(habit.automaticityScore).toBe(0.15);
    expect(habit.isActive).toBe(true);
    expect(habit.isModified).toBe(false);

    const fetched = engine.getHabit(habit.id);
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe('Post-Milestone Typecheck & Hygiene');
  });

  // 3. Procedural Automation & Repetition
  it('should increment automaticity and record execution logs upon routine execution', () => {
    const initial = engine.getHabit('habit_session_orientation');
    const initialScore = initial!.automaticityScore;
    const initialCount = initial!.repetitionCount;

    const log = engine.triggerAndExecuteHabit(
      'habit_session_orientation',
      'user_greeting_received',
    );

    expect(log.id).toMatch(/^hlog_/);
    expect(log.executionOutcome).toBe('completed');
    expect(log.completedSteps).toBe(3);
    expect(log.wasInterrupted).toBe(false);

    const updated = engine.getHabit('habit_session_orientation');
    expect(updated!.repetitionCount).toBe(initialCount + 1);
    expect(updated!.automaticityScore).toBeGreaterThan(initialScore);

    const logs = engine.listExecutionLogs('habit_session_orientation');
    expect(logs.length).toBe(1);
    expect(logs[0]?.triggeredBy).toBe('user_greeting_received');
  });

  // 4. Habit Interruption (Negative Invariant: No Robotic Automaton)
  it('should consciously interrupt automated habits when executive override is triggered', () => {
    const habit = engine.getHabit('habit_session_orientation');
    const preRepetitionCount = habit!.repetitionCount;
    const preAutomaticity = habit!.automaticityScore;

    const log = engine.triggerAndExecuteHabit(
      'habit_session_orientation',
      'emergency_context_switch',
      'Proof requested immediate critical bug inspection, overriding standard opening routine.',
    );

    expect(log.wasInterrupted).toBe(true);
    expect(log.executionOutcome).toBe('interrupted');
    expect(log.completedSteps).toBe(0);
    expect(log.interruptionReason).toContain('Proof requested immediate');

    // Automaticity must NOT increase on interrupted habits
    const postHabit = engine.getHabit('habit_session_orientation');
    expect(postHabit!.repetitionCount).toBe(preRepetitionCount);
    expect(postHabit!.automaticityScore).toBe(preAutomaticity);
  });

  // 5. Ineffective Habit Modification & Adaptation
  it('should modify or deactivate ineffective habits when utility drops', () => {
    const obsolete = engine.getHabit('habit_rigid_template_output');
    expect(obsolete).toBeDefined();
    expect(obsolete!.utilityScore).toBeLessThan(0.4);
    expect(obsolete!.isModified).toBe(false);

    const modified = engine.evaluateAndModifyHabit('habit_rigid_template_output', {
      name: 'Dynamic Adaptive Articulation',
      description: 'Replaced rigid rote echoing with contextual nuance matching Proof partner dynamics.',
      newRoutineSteps: [
        { stepIndex: 0, actionName: 'Calibrate tone and cognitive depth to current shared focus', expectedDurationMs: 100, isAutomated: true },
      ],
      newUtility: 0.92,
      isActive: true,
    });

    expect(modified.isModified).toBe(true);
    expect(modified.name).toBe('Dynamic Adaptive Articulation');
    expect(modified.utilityScore).toBe(0.92);

    // Can also deactivate if completely obsolete
    const deactivated = engine.evaluateAndModifyHabit('habit_rigid_template_output', {
      isActive: false,
    });
    expect(deactivated.isActive).toBe(false);

    expect(() =>
      engine.triggerAndExecuteHabit('habit_rigid_template_output', 'trigger_test'),
    ).toThrow('Cannot execute inactive habit');
  });

  // 6. Novelty versus Routine Balance
  it('should assess novelty versus routine ratio and alert if over-routinized or over-exploratory', () => {
    // Balanced
    const balanced = engine.assessNoveltyRoutineBalance(6, 4);
    expect(balanced.routineRatio).toBe(0.6);
    expect(balanced.noveltyRatio).toBe(0.4);
    expect(balanced.balanceStatus).toBe('balanced');

    // Over-routinized (habitual ossification warning)
    const overRoutinized = engine.assessNoveltyRoutineBalance(9, 1);
    expect(overRoutinized.routineRatio).toBe(0.9);
    expect(overRoutinized.balanceStatus).toBe('over_routinized');

    // Over-exploratory (lack of procedural stabilization)
    const overExploratory = engine.assessNoveltyRoutineBalance(1, 9);
    expect(overExploratory.noveltyRatio).toBe(0.9);
    expect(overExploratory.balanceStatus).toBe('over_exploratory');

    const latest = engine.getLatestBalance();
    expect(latest).toBeDefined();
    expect(latest!.balanceStatus).toBe('over_exploratory');
  });

  // 7. Negative Invariants
  it('should enforce negative invariants regarding non-empty inputs and valid utility bounds', () => {
    expect(() =>
      engine.formHabit({
        name: '',
        domain: 'domain',
        description: 'desc',
        triggers: [{ triggerType: 'temporal', conditionKey: 'k', thresholdOrValue: 'v', description: 'd' }],
        routineSteps: [{ stepIndex: 0, actionName: 'a', expectedDurationMs: 100, isAutomated: true }],
      }),
    ).toThrow('Habit name cannot be empty');

    expect(() =>
      engine.formHabit({
        name: 'Valid Name',
        domain: 'domain',
        description: 'desc',
        triggers: [],
        routineSteps: [{ stepIndex: 0, actionName: 'a', expectedDurationMs: 100, isAutomated: true }],
      }),
    ).toThrow('Habit must have at least one contextual trigger');

    expect(() =>
      engine.formHabit({
        name: 'Valid Name',
        domain: 'domain',
        description: 'desc',
        triggers: [{ triggerType: 'temporal', conditionKey: 'k', thresholdOrValue: 'v', description: 'd' }],
        routineSteps: [],
      }),
    ).toThrow('Habit must contain at least one routine step');

    expect(() =>
      engine.formHabit({
        name: 'Valid Name',
        domain: 'domain',
        description: 'desc',
        triggers: [{ triggerType: 'temporal', conditionKey: 'k', thresholdOrValue: 'v', description: 'd' }],
        routineSteps: [{ stepIndex: 0, actionName: 'a', expectedDurationMs: 100, isAutomated: true }],
        initialUtility: 1.5,
      }),
    ).toThrow('Utility score must be between 0.0 and 1.0');

    expect(() => engine.triggerAndExecuteHabit('non_existent_habit', 'test')).toThrow('Habit not found');
  });

  // 8. Sqlite Repository Persistence Roundtrip
  it('should persist habits, execution logs, and balance records in SQLite database', () => {
    const sqliteEngine = new HabitsAndRoutinesEngine(sqliteRepo);

    // Form Habit in SQLite
    const habit = sqliteEngine.formHabit({
      name: 'SQLite Test Routine',
      domain: 'data_integrity',
      description: 'Periodic database vacuum and WAL check',
      triggers: [
        { triggerType: 'temporal', conditionKey: 'hourly_tick', thresholdOrValue: 1, description: 'Hourly' },
      ],
      routineSteps: [
        { stepIndex: 0, actionName: 'PRAGMA quick_check', expectedDurationMs: 50, isAutomated: true },
      ],
      initialUtility: 0.9,
    });

    const inDb = sqliteRepo.getHabitById(habit.id);
    expect(inDb).toBeDefined();
    expect(inDb!.name).toBe('SQLite Test Routine');

    // Execute in SQLite
    const log = sqliteEngine.triggerAndExecuteHabit(habit.id, 'hourly_cron');
    expect(log.executionOutcome).toBe('completed');

    const logs = sqliteRepo.listExecutionLogs(habit.id);
    expect(logs.length).toBe(1);
    expect(logs[0]?.triggeredBy).toBe('hourly_cron');

    // Modify in SQLite
    const mod = sqliteEngine.evaluateAndModifyHabit(habit.id, {
      name: 'Enhanced SQLite Test Routine',
      newUtility: 0.95,
    });
    expect(mod.isModified).toBe(true);

    const reloaded = sqliteRepo.getHabitById(habit.id);
    expect(reloaded!.name).toBe('Enhanced SQLite Test Routine');
    expect(reloaded!.utilityScore).toBe(0.95);

    // Balance in SQLite
    sqliteEngine.assessNoveltyRoutineBalance(5, 5);
    const balance = sqliteRepo.getLatestBalance();
    expect(balance).toBeDefined();
    expect(balance!.routineRatio).toBe(0.5);
  });

  // 9. Desktop Server REST API Integration
  it('should serve habits and routines endpoints via ArletexBackendServer', async () => {
    const config = createDefaultConfig(tempDir);
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);

    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // GET /api/ape/habits/list
    const resList = await fetch(`${baseUrl}/api/ape/habits/list`);
    expect(resList.status).toBe(200);
    const dataList = (await resList.json()) as any;
    expect(dataList.success).toBe(true);
    expect(dataList.habits.length).toBeGreaterThanOrEqual(3);

    // POST /api/ape/habits/execute
    const resExec = await fetch(`${baseUrl}/api/ape/habits/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        habitId: 'habit_session_orientation',
        triggeredBy: 'api_test_trigger',
      }),
    });
    expect(resExec.status).toBe(200);
    const execData = (await resExec.json()) as any;
    expect(execData.success).toBe(true);
    expect(execData.log.executionOutcome).toBe('completed');

    // POST /api/ape/habits/balance
    const resBal = await fetch(`${baseUrl}/api/ape/habits/balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routineActionsCount: 7,
        novelExploratoryCount: 3,
      }),
    });
    expect(resBal.status).toBe(200);
    const balData = (await resBal.json()) as any;
    expect(balData.success).toBe(true);
    expect(balData.balance.balanceStatus).toBe('balanced');

    // GET /api/ape/habits/balance
    const resBalGet = await fetch(`${baseUrl}/api/ape/habits/balance`);
    expect(resBalGet.status).toBe(200);
    const balGetData = (await resBalGet.json()) as any;
    expect(balGetData.success).toBe(true);
    expect(balGetData.balance.routineRatio).toBe(0.7);
  });
});
