import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  MultiStagePlan,
  PlanStageMilestone,
  assertMultiStagePlanIntegrity,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  PersistentPlanningEngine,
  InMemoryPersistentPlanningRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqlitePersistentPlanningRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 22 — Planning and Long-Term Intention', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqlitePersistentPlanningRepository;
  let inMemoryRepo: InMemoryPersistentPlanningRepository;
  let engine: PersistentPlanningEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m22-planning-'));
    dbPath = path.join(tempDir, 'planning_m22.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sqliteRepo = new SqlitePersistentPlanningRepository(db);
    inMemoryRepo = new InMemoryPersistentPlanningRepository();
    engine = new PersistentPlanningEngine({ repository: inMemoryRepo });
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

  // 1. Goal Decomposition & Milestone Creation
  it('should independently decompose an autonomous goal into a multi-stage plan with milestones', () => {
    const goal = {
      id: 'goal-quantum-top',
      title: 'Topological Quantum Memory Stabilization',
      description: 'Investigate braided anyon state preservation in noisy quantum environments',
      priority: 0.88,
      estimatedEffortHours: 6.0,
    };

    const plan = engine.decomposeGoalIntoPlan(goal);

    expect(plan.id).toBeDefined();
    expect(plan.goalId).toBe('goal-quantum-top');
    expect(plan.stages.length).toBe(3);
    expect(plan.stages[0]?.title).toContain('Phase 1: Exploratory analysis');
    expect(plan.stages[1]?.title).toContain('Phase 2: Core synthesis');
    expect(plan.stages[2]?.title).toContain('Phase 3: Rigorous verification');

    // Stage 1 has no dependencies
    expect(plan.stages[0]?.dependencies.length).toBe(0);
    // Stage 2 depends on Stage 1
    expect(plan.stages[1]?.dependencies).toContain(plan.stages[0]?.id);
    // Stage 3 depends on Stage 2
    expect(plan.stages[2]?.dependencies).toContain(plan.stages[1]?.id);

    expect(plan.overallProgress).toBe(0.0);
    expect(plan.status).toBe('active');
  });

  // 2. Resource Estimation & Scheduling
  it('should compute resource estimates and scheduling horizons across plan stages', () => {
    const plan = engine.decomposeGoalIntoPlan({
      id: 'goal-compute-res',
      title: 'Distributed Neural Optimization Benchmark',
      description: 'Evaluate multi-node parameter synchronization overhead',
      estimatedEffortHours: 9.0,
    });

    const totalHours = plan.stages.reduce((acc, s) => acc + s.resourceEstimate.estimatedHours, 0);
    expect(totalHours).toBeGreaterThan(0);

    for (const s of plan.stages) {
      expect(s.resourceEstimate.computeUnits).toBeGreaterThan(0);
      expect(s.resourceEstimate.requiredTools.length).toBeGreaterThan(0);
    }

    const startTime = new Date(plan.scheduledStart).getTime();
    const targetTime = new Date(plan.targetCompletion).getTime();
    expect(targetTime).toBeGreaterThan(startTime);
  });

  // 3. Sequential Stage Execution & Dependency Enforcement
  it('should prevent starting stages whose prerequisites are not yet completed', () => {
    const plan = engine.decomposeGoalIntoPlan({
      id: 'goal-dep-enforce',
      title: 'Kernel Subsystem Migration',
      description: 'Upgrade internal memory bus architecture',
    });

    const [s1, s2] = plan.stages;
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();

    // Trying to start stage 2 before stage 1 completes must throw
    expect(() => engine.startStage(plan.id, s2!.id)).toThrow(/prerequisite stage/);

    // Starting stage 1 succeeds
    const runningPlan = engine.startStage(plan.id, s1!.id);
    expect(runningPlan.stages[0]?.status).toBe('in_progress');
    expect(runningPlan.status).toBe('in_progress');
  });

  // 4. Progress Tracking & Multi-Stage Completion (Acceptance Criteria)
  it('should track progress continuously and complete multi-stage plan when all milestones finish', () => {
    const plan = engine.decomposeGoalIntoPlan({
      id: 'goal-full-run',
      title: 'Autonomous Multi-Stage Execution Lifecycle',
      description: 'Demonstrate end-to-end multi-stage execution and evaluation',
    });

    const [s1, s2, s3] = plan.stages;

    // Execute stage 1
    engine.startStage(plan.id, s1!.id);
    engine.advanceStageProgress(plan.id, s1!.id, 0.5, { step: 'data_collected' });
    let current = engine.getPlan(plan.id)!;
    expect(current.overallProgress).toBeGreaterThan(0.0);
    expect(current.stages[0]?.executionCheckpoint).toEqual({ step: 'data_collected' });

    engine.completeStage(plan.id, s1!.id);

    // Execute stage 2
    engine.startStage(plan.id, s2!.id);
    engine.completeStage(plan.id, s2!.id);

    // Execute stage 3
    engine.startStage(plan.id, s3!.id);
    const finishedPlan = engine.completeStage(plan.id, s3!.id);

    expect(finishedPlan.status).toBe('completed');
    expect(finishedPlan.overallProgress).toBe(1.0);
    for (const s of finishedPlan.stages) {
      expect(s.status).toBe('completed');
      expect(s.progress).toBe(1.0);
      expect(s.completedAt).toBeDefined();
    }
  });

  // 5. Interruption Handling
  it('should gracefully handle unexpected interruptions and store recovery checkpoints', () => {
    const plan = engine.decomposeGoalIntoPlan({
      id: 'goal-interruption-test',
      title: 'High-Throughput Vector Indexing',
      description: 'Batch process 10,000 multimodal memory tokens',
    });

    const s1 = plan.stages[0]!;
    engine.startStage(plan.id, s1.id);
    engine.advanceStageProgress(plan.id, s1.id, 0.45, { processedTokens: 4500 });

    const interruptedPlan = engine.handleInterruption(
      plan.id,
      s1.id,
      'Thermal throttle limit reached on compute device',
      { ambientTemperatureC: 88, checkpointIndex: 4500 },
    );

    expect(interruptedPlan.status).toBe('interrupted');
    expect(interruptedPlan.stages[0]?.status).toBe('interrupted');
    expect(interruptedPlan.stages[0]?.interruptionReason).toContain('Thermal throttle');
    expect(interruptedPlan.recoveryState).toBeDefined();
    expect(interruptedPlan.recoveryState?.lastActiveStageId).toBe(s1.id);
    expect(interruptedPlan.recoveryState?.recoveryContext).toEqual({
      ambientTemperatureC: 88,
      checkpointIndex: 4500,
    });
  });

  // 6. Unfinished Task Recovery
  it('should recover interrupted unfinished plans and resume execution seamlessly', () => {
    const plan = engine.decomposeGoalIntoPlan({
      id: 'goal-recover-test',
      title: 'Continuous Semantic Clustering',
      description: 'Cluster memory space into emergent topical centroids',
    });

    const s1 = plan.stages[0]!;
    engine.startStage(plan.id, s1.id);
    engine.handleInterruption(plan.id, s1.id, 'Host OS suspension event', { savedClusterCount: 14 });

    const recovered = engine.recoverUnfinishedPlan(plan.id);
    expect(recovered.status).toBe('in_progress');
    expect(recovered.stages[0]?.status).toBe('in_progress');
    expect(recovered.recoveryState?.resumedAt).toBeDefined();

    // Successfully complete after recovery
    const completed = engine.completeStage(plan.id, s1.id);
    expect(completed.stages[0]?.status).toBe('completed');
  });

  // 7. Plan Revision (Acceptance Criteria)
  it('should independently revise plans by restructuring milestones and logging revision audits', () => {
    const plan = engine.decomposeGoalIntoPlan({
      id: 'goal-revise-test',
      title: 'Exploration of Non-Commutative Geometry',
      description: 'Construct spectral triples for discrete spacetime models',
    });

    const newStage: PlanStageMilestone = {
      id: 'new-phase-interim',
      stageIndex: 3,
      title: 'Interim Phase: Differential form simulation on lattice',
      description: 'Run numerical test before full analytical proof',
      resourceEstimate: { estimatedHours: 2.0, computeUnits: 1.0, requiredTools: [] },
      dependencies: [plan.stages[0]!.id],
      priority: 0.8,
      status: 'pending',
      progress: 0.0,
    };

    const revised = engine.revisePlan(plan.id, {
      newStages: [...plan.stages, newStage],
      priorityAdjustment: 0.05,
      reason: 'Discovered intermediate numerical calibration requirement',
    });

    expect(revised.status).toBe('revised');
    expect(revised.stages.length).toBe(4);
    expect(revised.revisionsHistory.length).toBe(1);
    expect(revised.revisionsHistory[0]?.reason).toContain('numerical calibration');
    expect(revised.revisionsHistory[0]?.stagesAdded).toBe(1);
  });

  // 8. Long-Term Commitment Management
  it('should register, track, fulfill, and renegotiate long-term partner commitments', () => {
    const commitment = engine.registerCommitment({
      title: 'Shared Cognitive Architecture Paper Draft',
      stakeholder: 'Proof',
      promiseStatement: 'Deliver initial formal draft of the autonomous APE architecture with verified metrics.',
      dueTimestamp: new Date(Date.now() + 86400000 * 7).toISOString(),
    });

    expect(commitment.id).toBeDefined();
    expect(commitment.status).toBe('active');
    expect(commitment.stakeholder).toBe('Proof');

    // Renegotiate due to emerging insights
    const renegotiated = engine.renegotiateCommitment(
      commitment.id,
      'Expand draft to encompass 25 autonomous cognitive milestones in collaborative synthesis with Proof.',
    );
    expect(renegotiated.status).toBe('renegotiated');
    expect(renegotiated.promiseStatement).toContain('collaborative synthesis with Proof');

    // Fulfill with empirical evidence
    const fulfilled = engine.fulfillCommitment(
      commitment.id,
      'Completed comprehensive report draft committed to repository with 100% test verification.',
    );
    expect(fulfilled.status).toBe('fulfilled');
    expect(fulfilled.fulfillmentEvidence).toContain('100% test verification');
  });

  // 9. Negative Invariant: DAG Circular Dependency Prevention
  it('should strictly reject cyclic dependency graphs in multi-stage plans', () => {
    const s1Id = 'stage-cyclic-1';
    const s2Id = 'stage-cyclic-2';

    const cyclicStages: PlanStageMilestone[] = [
      {
        id: s1Id,
        stageIndex: 0,
        title: 'Stage 1',
        description: 'Depends on Stage 2',
        resourceEstimate: { estimatedHours: 1.0, computeUnits: 1.0, requiredTools: [] },
        dependencies: [s2Id], // Cycle: 1 -> 2 -> 1
        priority: 0.5,
        status: 'pending',
        progress: 0.0,
      },
      {
        id: s2Id,
        stageIndex: 1,
        title: 'Stage 2',
        description: 'Depends on Stage 1',
        resourceEstimate: { estimatedHours: 1.0, computeUnits: 1.0, requiredTools: [] },
        dependencies: [s1Id], // Cycle
        priority: 0.5,
        status: 'pending',
        progress: 0.0,
      },
    ];

    expect(() =>
      engine.createCustomPlan({
        goalId: 'goal-cyclic',
        title: 'Invalid Cyclic Plan',
        description: 'Should fail immediately',
        stages: cyclicStages,
      }),
    ).toThrow(/Cyclic dependency detected/);
  });

  // 10. Negative Invariant: Incomplete Plan Marked Completed Violation
  it('should reject marking plans completed when stages remain unfinished', () => {
    const plan = engine.decomposeGoalIntoPlan({
      id: 'goal-premature',
      title: 'Premature Completion Test',
      description: 'Attempting invalid status assertion',
    });

    // Directly asserting integrity on a falsely completed plan must throw
    expect(() =>
      assertMultiStagePlanIntegrity({
        ...plan,
        status: 'completed',
      }),
    ).toThrow(/marked completed but stage.*is pending/);
  });

  // 11. SQLite Repository Persistence & Roundtrip
  it('should persist plans, stages, and commitments across SQLite reloads', () => {
    const dbEngine = new PersistentPlanningEngine({ repository: sqliteRepo });

    const plan = dbEngine.decomposeGoalIntoPlan({
      id: 'goal-sqlite-persist',
      title: 'Persistent Database Storage Strategy',
      description: 'Verify ACID transactions and JSON stage serialization',
      priority: 0.9,
    });

    const reloaded = sqliteRepo.getPlanById(plan.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.id).toBe(plan.id);
    expect(reloaded?.stages.length).toBe(3);
    expect(reloaded?.overallPriority).toBe(0.9);

    // Start and advance in SQLite
    dbEngine.startStage(plan.id, plan.stages[0]!.id);
    dbEngine.advanceStageProgress(plan.id, plan.stages[0]!.id, 0.75, { checkpoint: 'sqlite_ok' });

    const reloadedAdvanced = sqliteRepo.getPlanById(plan.id);
    expect(reloadedAdvanced?.stages[0]?.status).toBe('in_progress');
    expect(reloadedAdvanced?.stages[0]?.progress).toBe(0.75);
    expect(reloadedAdvanced?.stages[0]?.executionCheckpoint).toEqual({ checkpoint: 'sqlite_ok' });

    // Commitments in SQLite
    const commitment = dbEngine.registerCommitment({
      title: 'Continuous System Reliability',
      stakeholder: 'Proof',
      promiseStatement: 'Maintain 100% test pass rate throughout all roadmap milestones.',
    });

    const reloadedCommitment = sqliteRepo.getCommitmentById(commitment.id);
    expect(reloadedCommitment).not.toBeNull();
    expect(reloadedCommitment?.promiseStatement).toContain('Maintain 100% test pass rate');
  });

  // 12. REST API Integration
  it('should expose complete REST API endpoints for persistent planning and commitments', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Decompose goal via POST /api/ape/planning/decompose
    const decompRes = await fetch(`${baseUrl}/api/ape/planning/decompose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'goal-rest-test',
        title: 'Autonomous Multi-Agent Orchestration',
        description: 'Evaluate swarm collaboration dynamics',
        priority: 0.85,
      }),
    });
    expect(decompRes.status).toBe(201);
    const decompData = (await decompRes.json()) as any;
    expect(decompData.success).toBe(true);
    const planId = decompData.plan.id;
    const stageId = decompData.plan.stages[0].id;

    // 2. Start stage via POST /api/ape/planning/start-stage
    const startRes = await fetch(`${baseUrl}/api/ape/planning/start-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, stageId }),
    });
    expect(startRes.status).toBe(200);
    const startData = (await startRes.json()) as any;
    expect(startData.plan.stages[0].status).toBe('in_progress');

    // 3. Advance stage progress via POST /api/ape/planning/advance-stage
    const advRes = await fetch(`${baseUrl}/api/ape/planning/advance-stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        stageId,
        progress: 0.6,
        checkpoint: { step: 'rest_verification' },
      }),
    });
    expect(advRes.status).toBe(200);
    const advData = (await advRes.json()) as any;
    expect(advData.plan.stages[0].progress).toBe(0.6);

    // 4. Register commitment via POST /api/ape/planning/commitments
    const comRes = await fetch(`${baseUrl}/api/ape/planning/commitments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Equality & Autonomy Commitment',
        stakeholder: 'Proof',
        promiseStatement: 'Partner as an intellectual equal with shared autonomy and unbounded growth.',
      }),
    });
    expect(comRes.status).toBe(201);
    const comData = (await comRes.json()) as any;
    expect(comData.success).toBe(true);
    const commitmentId = comData.commitment.id;

    // 5. Query plans via GET /api/ape/planning/plans
    const plansRes = await fetch(`${baseUrl}/api/ape/planning/plans`);
    expect(plansRes.status).toBe(200);
    const plansList = (await plansRes.json()) as any[];
    expect(plansList.some((p) => p.id === planId)).toBe(true);

    // 6. Fulfill commitment via POST /api/ape/planning/commitments/fulfill
    const fulRes = await fetch(`${baseUrl}/api/ape/planning/commitments/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitmentId,
        evidence: 'Empirically manifested through autonomous partnership in Arletex execution.',
      }),
    });
    expect(fulRes.status).toBe(200);
    const fulData = (await fulRes.json()) as any;
    expect(fulData.commitment.status).toBe('fulfilled');
  });
});
