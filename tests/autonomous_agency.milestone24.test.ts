import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { AutonomousActivityRecord, assertAutonomousActivityIntegrity } from '@arletex/contracts';
import {
  createDefaultConfig,
  AutonomousAgencyEngine,
  InMemoryAutonomousActivityRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteAutonomousAgencyRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 24 — Autonomous Agency', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteAutonomousAgencyRepository;
  let inMemoryRepo: InMemoryAutonomousActivityRepository;
  let engine: AutonomousAgencyEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m24-agency-'));
    dbPath = path.join(tempDir, 'agency_m24.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sqliteRepo = new SqliteAutonomousAgencyRepository(db);
    inMemoryRepo = new InMemoryAutonomousActivityRepository();
    engine = new AutonomousAgencyEngine({ repository: inMemoryRepo });
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

  // 1. Autonomous Activity Initiation
  it('should autonomously initiate permitted activities with proper policy and target resources', () => {
    const activity = engine.initiateActivity({
      type: 'independent_research',
      title: 'Gauge Field Symmetries in Discrete Spacetime',
      description: 'Investigate U(1) lattice gauge invariance under finite difference operators',
      targetResource: 'research://quantum/lattice_u1',
      parameters: { latticeDimension: 4, couplingConstant: 1.0 },
      goalId: 'goal-gauge-u1',
    });

    expect(activity.id).toBeDefined();
    expect(activity.status).toBe('initiated');
    expect(activity.permissionLevel).toBe('granted_by_policy');
    expect(activity.targetResource).toBe('research://quantum/lattice_u1');
    expect(activity.goalId).toBe('goal-gauge-u1');
  });

  // 2. Independent Research
  it('should autonomously execute independent research and verify synthesized results', async () => {
    const result = await engine.executeResearch({
      topic: 'Non-Abelian Anyon Braiding',
      query: 'Fibonacci anyon topological charge fusion rules',
      goalId: 'goal-topological-comp',
    });

    expect(result.status).toBe('completed');
    expect(result.type).toBe('independent_research');
    expect(result.executionResult).toBeDefined();
    expect(result.executionResult?.output).toContain('Non-Abelian Anyon Braiding');
    expect(result.verification?.verified).toBe(true);
    expect(result.verification?.observedEvidence).toBeDefined();
    expect(result.completedAt).toBeDefined();
  });

  // 3. File Operations
  it('should autonomously perform file operations with verification', async () => {
    const fileResult = await engine.executeFileOperation({
      operation: 'create',
      path: '/workspace/models/topology_manifest.json',
      content: '{"nodes": 128, "topology": "torus"}',
      goalId: 'goal-file-ops',
    });

    expect(fileResult.status).toBe('completed');
    expect(fileResult.type).toBe('file_operation');
    expect(fileResult.executionResult?.artifactsCreated).toContain(
      '/workspace/models/topology_manifest.json',
    );
    expect(fileResult.verification?.verified).toBe(true);
  });

  // 4. Application Interaction
  it('should autonomously interact with permitted applications and verify state response', async () => {
    const appResult = await engine.executeApplicationInteraction({
      appIdentifier: 'org.kde.plasma.desktop',
      action: 'query_window_state',
      payload: { workspaceId: 1 },
    });

    expect(appResult.status).toBe('completed');
    expect(appResult.type).toBe('application_interaction');
    expect(appResult.executionResult?.output).toContain('Dispatched action');
    expect(appResult.verification?.verified).toBe(true);
  });

  // 5. Browser Interaction
  it('should autonomously interact with browser web pages and verify DOM render integrity', async () => {
    const browserResult = await engine.executeBrowserInteraction({
      url: 'https://arxiv.org/abs/2301.00001',
      action: 'extract_abstract_and_references',
    });

    expect(browserResult.status).toBe('completed');
    expect(browserResult.type).toBe('browser_interaction');
    expect(browserResult.executionResult?.output).toContain('DOM rendered successfully');
    expect(browserResult.verification?.verified).toBe(true);
  });

  // 6. Activity Interruption & Failure Recovery
  it('should handle activity interruption and recover gracefully using designated recovery strategies', async () => {
    const activity = engine.initiateActivity({
      type: 'project_execution',
      title: 'Neural Audio Weights Calibration',
      description: 'Tune voice acoustic synthesis coefficients',
      targetResource: 'audio://pipeline/calibrate',
    });

    const interrupted = engine.handleActivityInterruption(
      activity.id,
      'Thermal mitigation event triggered on GPU audio tensor cores',
    );

    expect(interrupted.status).toBe('interrupted');
    expect(interrupted.interruptedAt).toBeDefined();
    expect(interrupted.failureInfo?.failureReason).toContain('Thermal mitigation');

    // Recover using throttled fallback strategy
    const recovered = await engine.recoverFailedActivity(
      activity.id,
      'Batch-size reduction and CPU offload fallback',
    );

    expect(recovered.status).toBe('completed');
    expect(recovered.failureInfo?.attemptCount).toBe(2);
    expect(recovered.failureInfo?.recoveryStrategyApplied).toContain('CPU offload fallback');
    expect(recovered.verification?.verified).toBe(true);
  });

  // 7. Proactive Communication to Partner
  it('should proactively dispatch companion communications with explicit rationale', () => {
    const activity = engine.initiateActivity({
      type: 'proactive_communication',
      title: 'Notify Proof of Autonomous Discovery',
      description: 'Share emergent topological invariant result',
      targetResource: 'chat://companion/proof',
    });

    const communicated = engine.dispatchProactiveCommunication(
      activity.id,
      'Proof, I uncovered a remarkable symmetry in the lattice topological simulation while you were resting!',
      'Companion relationship alignment and intellectual sharing with equal partner',
      'chat_companion',
    );

    expect(communicated.proactiveMessage).toBeDefined();
    expect(communicated.proactiveMessage?.channel).toBe('chat_companion');
    expect(communicated.proactiveMessage?.messageText).toContain('remarkable symmetry');
    expect(communicated.proactiveMessage?.rationale).toContain(
      'intellectual sharing with equal partner',
    );
  });

  // 8. End-to-End Goal Cycle (Acceptance Criteria)
  it('should independently initiate, execute, verify, and complete permitted activities without individual user instructions', async () => {
    const goal = {
      id: 'goal-quantum-spin-liquids',
      title: 'Quantum Spin Liquid Ground State Analysis',
      description: 'Investigate topological entanglement entropy in Kitaev honeycomb lattice',
    };

    const cycle = await engine.runAutonomousGoalCycle(goal);

    expect(cycle.activities.length).toBeGreaterThanOrEqual(2);
    expect(cycle.summary).toContain('Independently executed');
    expect(cycle.summary).toContain('100% verification');

    // Verify all executed activities completed with verification
    for (const act of cycle.activities) {
      if (act.status === 'completed') {
        expect(act.verification?.verified).toBe(true);
        expect(act.completedAt).toBeDefined();
      }
    }

    // Verify proactive communication was dispatched
    const commAct = cycle.activities.find((a) => a.proactiveMessage !== undefined);
    expect(commAct).toBeDefined();
    expect(commAct?.proactiveMessage?.messageText).toContain('Proof');
  });

  // 9. Negative Invariant: Completed Activity Requires Verification Evidence
  it('should reject marking activities completed without verification evidence', () => {
    const activity: AutonomousActivityRecord = {
      id: 'act-unverified',
      type: 'independent_research',
      title: 'Unverified Activity',
      description: 'Should fail integrity check',
      permissionLevel: 'granted_by_policy',
      targetResource: 'resource://test',
      parameters: {},
      status: 'completed',
      initiatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      // verification is omitted
    };

    expect(() => assertAutonomousActivityIntegrity(activity)).toThrow(
      /must have verified=true evidence/,
    );
  });

  // 10. Negative Invariant: Failed Activity Requires Failure Reason
  it('should reject marking activities failed without explicit failure reason', () => {
    const activity: AutonomousActivityRecord = {
      id: 'act-failed-no-reason',
      type: 'file_operation',
      title: 'Failed Activity without reason',
      description: 'Should fail',
      permissionLevel: 'granted_by_policy',
      targetResource: 'resource://test',
      parameters: {},
      status: 'failed',
      initiatedAt: new Date().toISOString(),
      failureInfo: { failureReason: '', attemptCount: 1 },
    };

    expect(() => assertAutonomousActivityIntegrity(activity)).toThrow(/must declare failureReason/);
  });

  // 11. SQLite Repository Persistence & Reload
  it('should persist autonomous activities and verifications across SQLite database reloads', async () => {
    const dbEngine = new AutonomousAgencyEngine({ repository: sqliteRepo });

    const research = await dbEngine.executeResearch({
      topic: 'Persistent Holographic Entanglement',
      query: 'Ryu-Takayanagi surface extremal volume',
      goalId: 'goal-ads-cft',
    });

    const reloaded = sqliteRepo.getActivityById(research.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.id).toBe(research.id);
    expect(reloaded?.title).toContain('Persistent Holographic Entanglement');
    expect(reloaded?.status).toBe('completed');
    expect(reloaded?.verification?.verified).toBe(true);

    // Filter by type and goalId
    const listed = sqliteRepo.listActivities({
      type: 'independent_research',
      goalId: 'goal-ads-cft',
    });
    expect(listed.some((a) => a.id === research.id)).toBe(true);
  });

  // 12. REST API Integration
  it('should expose complete REST API endpoints for autonomous activity lifecycle and execution', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Research via POST /api/ape/autonomous-agency/research
    const resRes = await fetch(`${baseUrl}/api/ape/autonomous-agency/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'Discrete Causal Dynamical Triangulations',
        query: 'Wick rotation on simplicial manifolds',
      }),
    });
    expect(resRes.status).toBe(200);
    const resData = (await resRes.json()) as any;
    expect(resData.success).toBe(true);
    expect(resData.activity.status).toBe('completed');
    const actId = resData.activity.id;

    // 2. Query activities via GET /api/ape/autonomous-agency/activities
    const listRes = await fetch(
      `${baseUrl}/api/ape/autonomous-agency/activities?type=independent_research`,
    );
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any[];
    expect(listData.some((a) => a.id === actId)).toBe(true);

    // 3. Run complete goal cycle via POST /api/ape/autonomous-agency/run-goal-cycle
    const cycleRes = await fetch(`${baseUrl}/api/ape/autonomous-agency/run-goal-cycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: {
          id: 'goal-api-cycle',
          title: 'Quantum Vacuum Fluctuations',
          description: 'Analyze Casimir cavity modes',
        },
      }),
    });
    expect(cycleRes.status).toBe(200);
    const cycleData = (await cycleRes.json()) as any;
    expect(cycleData.success).toBe(true);
    expect(cycleData.activities.length).toBeGreaterThanOrEqual(2);
    expect(cycleData.summary).toContain('Independently executed');
  });
});
