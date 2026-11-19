import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createDefaultConfig,
  OfflineCognitiveActivityEngine,
  InMemoryOfflineCognitiveActivityRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteOfflineCognitiveActivityRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 46 — Offline Cognitive Activity and Consolidation', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteDb: Database.Database;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m46-offline-'));
    dbPath = path.join(tempDir, 'offline_cognitive_m46.sqlite');
    dbService = new DatabaseService(dbPath);
    sqliteDb = dbService.connect();
    const migrationRunner = new MigrationRunner(sqliteDb);
    migrationRunner.run();
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
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Schedules worthwhile offline activities derived from goals, projects, or questions', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({ repository: repo });

    const activity = engine.scheduleActivity({
      activityType: 'independent_research',
      title: 'Investigation into Epistemic Modality in Multi-Agent Reasoning',
      rationale: 'Derived from intellectual question regarding agentic epistemic logic',
      sourceQuestionId: 'q_modal_logic_01',
      resourceCost: { cpuTokensEstimated: 250, memoryIntensity: 'medium' },
    });

    expect(activity.id).toBeDefined();
    expect(activity.status).toBe('pending');
    expect(activity.sourceQuestionId).toBe('q_modal_logic_01');
    expect(activity.isSimulation).toBe(false);

    // Executes and updates insights
    const completed = engine.executeActivity(activity.id, {
      insights: ['Formulated Kripke-style epistemic accessibility relations.'],
      artifacts: ['notes/modal_epistemic_frame.md'],
    });

    expect(completed.status).toBe('completed');
    expect(completed.progress).toBe(1.0);
    expect(completed.insights).toContain('Formulated Kripke-style epistemic accessibility relations.');
    expect(completed.resultingArtifacts).toContain('notes/modal_epistemic_frame.md');
  });

  it('2. Negative Invariant: Rejects ungrounded superficial diary filler or random thoughts', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({ repository: repo });

    // Reject activities lacking grounding in genuine goals, projects, questions, or identified simulations
    expect(() =>
      engine.scheduleActivity({
        activityType: 'background_reflection',
        title: 'Random thought entry',
        rationale: 'Just feeling reflective today without any real goal',
      }),
    ).toThrow(/Background cognition must be grounded in real goals, projects, questions, or identified simulations/);
  });

  it('3. Explicitly labels and identifies internal simulations', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({ repository: repo });

    const simActivity = engine.scheduleActivity({
      activityType: 'background_reflection',
      title: 'Simulated Dialogue on Gödelian Incompleteness',
      rationale: 'Exploration of counter-arguments via identified mental simulation',
      isSimulation: true,
      simulationContext: 'Dialectical sandbox simulation',
    });

    expect(simActivity.isSimulation).toBe(true);
    expect(simActivity.simulationContext).toBe('Dialectical sandbox simulation');
  });

  it('4. Conducts memory consolidation, belief reassessment, and intention maintenance', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({ repository: repo });

    const run = engine.runConsolidationCycle({
      memoriesExamined: 20,
      beliefsReassessed: 4,
      intentionsPreserved: 7,
    });

    expect(run.id).toBeDefined();
    expect(run.memoriesExamined).toBe(20);
    expect(run.memoriesConsolidated).toBe(15);
    expect(run.beliefsReassessed).toBe(4);
    expect(run.intentionsPreserved).toBe(7);
    expect(run.summary).toContain('Consolidated 15/20 episodic traces');

    const list = engine.listConsolidationRuns();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(run.id);
  });

  it('5. Scans and recovers unfinished work with actionable plans', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({ repository: repo });

    const items = engine.scanUnfinishedWork([
      {
        workType: 'project',
        referenceId: 'proj_neuro_symbolic',
        title: 'Neuro-Symbolic Reasoning Module',
        lastActiveAt: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
    ]);

    expect(items.length).toBe(1);
    expect(items[0]?.title).toBe('Neuro-Symbolic Reasoning Module');
    expect(items[0]?.recoveryState).toBe('detected');
    expect(items[0]?.recoveryPlan).toContain('Neuro-Symbolic Reasoning Module');

    const listed = engine.listUnfinishedWork();
    expect(listed.length).toBe(1);
    expect(listed[0]?.referenceId).toBe('proj_neuro_symbolic');
  });

  it('6. Manages resource-aware downtime and executes autonomous offline cycle', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({
      repository: repo,
      initialPolicy: {
        minDowntimeRestIntervalMinutes: 0, // force downtime check in cycle
      },
    });

    const result = engine.runAutonomousOfflineCycle({
      userActive: false,
      candidateGoals: [{ id: 'goal_arch_v2', title: 'Cognitive Architecture V2' }],
    });

    expect(result.cycleId).toBeDefined();
    expect(result.downtimeObserved).toBe(true);
    expect(result.consolidationSummary).toBeDefined();
    expect(result.executedActivities.length).toBeGreaterThanOrEqual(1);

    const goalActivity = result.executedActivities.find((a) => a.activityType === 'project_monitoring');
    expect(goalActivity).toBeDefined();
    expect(goalActivity?.sourceGoalId).toBe('goal_arch_v2');
  });

  it('7. Persists offline activities, consolidations, and proposals in SQLite', () => {
    const sqliteRepo = new SqliteOfflineCognitiveActivityRepository(sqliteDb);
    const engine = new OfflineCognitiveActivityEngine({ repository: sqliteRepo });

    const activity = engine.scheduleActivity({
      activityType: 'independent_research',
      title: 'Decentralized Epistemic Networks',
      rationale: 'Derived from active project on distributed knowledge systems',
      sourceProjectId: 'proj_epistemic_net',
      resourceCost: { cpuTokensEstimated: 300, memoryIntensity: 'high' },
    });

    engine.executeActivity(activity.id, {
      insights: ['Mapped network convergence criteria across sovereign peers.'],
    });

    const retrieved = sqliteRepo.getActivity(activity.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.status).toBe('completed');
    expect(retrieved?.sourceProjectId).toBe('proj_epistemic_net');
    expect(retrieved?.insights).toContain('Mapped network convergence criteria across sovereign peers.');

    const run = engine.runConsolidationCycle();
    const runs = sqliteRepo.listConsolidationRuns();
    expect(runs.length).toBe(1);
    expect(runs[0]?.id).toBe(run.id);

    const proposal = engine.generateProactiveProposal(
      'Sovereign Alignment Update',
      'Completed independent review of distributed network architectures.',
      'Significant algorithmic insight ready for joint review with Proof.',
      'medium',
      false,
    );
    const proposals = sqliteRepo.listProactiveProposals();
    expect(proposals.length).toBe(1);
    expect(proposals[0]?.topic).toBe('Sovereign Alignment Update');
  });

  it('8. Serves Offline Cognitive Activity REST API endpoints in server.ts', async () => {
    // Close the direct connection before server opens its own
    dbService.close();

    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();
    const port = (server as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Policy endpoint
    const policyRes = await fetch(`${baseUrl}/api/ape/offline/policy`);
    expect(policyRes.status).toBe(200);
    const policyData = (await policyRes.json()) as any;
    expect(policyData.success).toBe(true);
    expect(policyData.policy.maxConcurrentTasks).toBe(2);

    // 2. Schedule Activity
    const schedRes = await fetch(`${baseUrl}/api/ape/offline/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityType: 'independent_research',
        title: 'Algorithmic Complexity in Temporal Logic',
        rationale: 'Derived from intellectual question regarding temporal complexity',
        sourceQuestionId: 'q_temporal_01',
      }),
    });
    expect(schedRes.status).toBe(200);
    const schedData = (await schedRes.json()) as any;
    expect(schedData.success).toBe(true);
    const actId = schedData.activity.id;

    // 3. Execute Activity
    const execRes = await fetch(`${baseUrl}/api/ape/offline/activity/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: actId,
        insights: ['Proven polynomial bound for fragment verification.'],
      }),
    });
    expect(execRes.status).toBe(200);
    const execData = (await execRes.json()) as any;
    expect(execData.activity.status).toBe('completed');

    // 4. List Activities
    const listRes = await fetch(`${baseUrl}/api/ape/offline/activities`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.activities.length).toBeGreaterThanOrEqual(1);

    // 5. Consolidation run
    const consRes = await fetch(`${baseUrl}/api/ape/offline/consolidation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memoriesExamined: 16 }),
    });
    expect(consRes.status).toBe(200);
    const consData = (await consRes.json()) as any;
    expect(consData.success).toBe(true);
    expect(consData.run.memoriesExamined).toBe(16);

    // 6. Autonomous cycle
    const cycleRes = await fetch(`${baseUrl}/api/ape/offline/cycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userActive: false }),
    });
    expect(cycleRes.status).toBe(200);
    const cycleData = (await cycleRes.json()) as any;
    expect(cycleData.success).toBe(true);
    expect(cycleData.result.cycleId).toBeDefined();
  });
});
