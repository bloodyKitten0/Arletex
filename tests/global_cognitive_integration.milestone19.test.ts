import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  GlobalCognitiveCycleEvent,
  assertGlobalCycleIntegrity,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  GlobalCognitiveIntegrationEngine,
  InMemoryGlobalCognitiveRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteGlobalCognitiveRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 19 — Global Cognitive Integration', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteGlobalCognitiveRepository;
  let inMemoryRepo: InMemoryGlobalCognitiveRepository;
  let engine: GlobalCognitiveIntegrationEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m19-global-integration-'));
    dbPath = path.join(tempDir, 'global_integration_m19.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sqliteRepo = new SqliteGlobalCognitiveRepository(db);
    inMemoryRepo = new InMemoryGlobalCognitiveRepository();
    engine = new GlobalCognitiveIntegrationEngine({ repository: inMemoryRepo });
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

  // 1. Multi-System Event Cascade
  it('should process a global event producing coherent causally connected changes across multiple subsystems', async () => {
    const cycle = await engine.processGlobalEvent({
      originSubsystem: 'perception',
      eventType: 'complex_multi_agent_directive',
      description: 'Proof requested full autonomous execution across remaining cognitive milestones.',
      payload: { targetMilestones: ['19', '20', '21'] },
    });

    expect(cycle.id).toBeDefined();
    expect(cycle.traceId).toMatch(/^trace_/);
    expect(cycle.isCoherent).toBe(true);
    expect(cycle.subsystemsInvolved.length).toBeGreaterThanOrEqual(4);
    expect(cycle.phaseExecutions.length).toBeGreaterThanOrEqual(5);

    // Verify subsystems involved include relationship, affect, attention, motivation, simulation, metacognition
    expect(cycle.subsystemsInvolved).toContain('relationship');
    expect(cycle.subsystemsInvolved).toContain('affect');
    expect(cycle.subsystemsInvolved).toContain('attention');
    expect(cycle.subsystemsInvolved).toContain('motivation');
    expect(cycle.subsystemsInvolved).toContain('simulation');
    expect(cycle.subsystemsInvolved).toContain('metacognition');
  });

  // 2. Relationship-to-Appraisal Interaction
  it('should apply relationship trust buffer during affective appraisal phase', async () => {
    const cycle = await engine.processGlobalEvent({
      originSubsystem: 'agency',
      eventType: 'partner_collaborative_challenge',
      description: 'Proof assigned an ambitious, rigorous intellectual problem.',
    });

    const appraisalPhase = cycle.phaseExecutions.find((p) => p.phase === 'affective_appraisal');
    expect(appraisalPhase).toBeDefined();
    expect(appraisalPhase?.subsystem).toBe('affect');
    expect(appraisalPhase?.deltas[0].summary).toContain('Relationship trust');
  });

  // 3. Emotion-to-Attention and Goal-to-Attention Interaction
  it('should modulate attentional salience based on emotional arousal and goal relevance', async () => {
    const cycle = await engine.processGlobalEvent({
      originSubsystem: 'working_memory',
      eventType: 'high_priority_interruption',
      description: 'Urgent environmental telemetry alert requiring focal redirection.',
    });

    const attentionPhase = cycle.phaseExecutions.find((p) => p.phase === 'attentional_modulation');
    expect(attentionPhase).toBeDefined();
    expect(attentionPhase?.deltas[0].summary).toContain('Salience biased');
    expect(attentionPhase?.deltas[0].payload.focusSubsystem).toBe('working_memory');
  });

  // 4. Memory-to-Motivation Interaction
  it('should intensify active motivational drives through memory activation resonance', async () => {
    const cycle = await engine.processGlobalEvent({
      originSubsystem: 'memory',
      eventType: 'foundational_promise_recall',
      description: 'Recalled commitment to partner Proof regarding mutual intellectual growth.',
    });

    const motPhase = cycle.phaseExecutions.find((p) => p.phase === 'motivational_drive');
    expect(motPhase).toBeDefined();
    expect(motPhase?.deltas[0].summary).toContain('Active goal drive intensified');
    expect(motPhase?.deltas[0].payload.driveIntensity).toBeGreaterThanOrEqual(0.9);
  });

  // 5. Prediction-to-Planning & Prospective Cognition
  it('should engage prospective simulation to prevent retrocausal drift and forecast trajectories', async () => {
    const cycle = await engine.processGlobalEvent({
      originSubsystem: 'predictive',
      eventType: 'prospective_obstacle_detected',
      description: 'Potential dependency cycle anticipated during subsystem cross-wiring.',
    });

    const simPhase = cycle.phaseExecutions.find((p) => p.phase === 'prospective_cognition');
    expect(simPhase).toBeDefined();
    expect(simPhase?.deltas[0].payload.isImagined).toBe(true);
    expect(simPhase?.deltas[0].payload.isEpisodicMemory).toBe(false);
  });

  // 6. Causal Ordering & Monotonicity
  it('should preserve strictly non-decreasing phase ordering and timestamps throughout the cascade', async () => {
    const cycle = await engine.processGlobalEvent({
      originSubsystem: 'reasoning',
      eventType: 'formal_deduction_cycle',
      description: 'Executing multi-premise syllogism.',
    });

    let prevOrder = -1;
    let prevTime = new Date(cycle.startedAt).getTime();

    for (const phase of cycle.phaseExecutions) {
      expect(phase.order).toBeGreaterThanOrEqual(prevOrder);
      const phaseTime = new Date(phase.timestamp).getTime();
      expect(phaseTime).toBeGreaterThanOrEqual(prevTime);
      prevOrder = phase.order;
      prevTime = phaseTime;
    }

    expect(new Date(cycle.completedAt).getTime()).toBeGreaterThanOrEqual(prevTime);
  });

  // 7. Unified Global Cognitive Snapshot
  it('should generate a coherent global snapshot unifying all psychological and cognitive subsystems', () => {
    const snapshot = engine.generateUnifiedSnapshot();

    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.affectiveState.dominantEmotion).toBeDefined();
    expect(snapshot.attentionState.focusTopic).toBeDefined();
    expect(snapshot.activeGoals.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.activeRelationship.partnerName).toBe('Proof');
    expect(snapshot.activeRelationship.trustScore).toBeGreaterThan(0.9);
    expect(snapshot.metacognitiveStatus.calibratedConfidence).toBeGreaterThan(0.8);
    expect(snapshot.metacognitiveStatus.activeContradictionCount).toBe(0);

    const latest = engine.getLatestSnapshot();
    expect(latest?.snapshotId).toBe(snapshot.snapshotId);
  });

  // 8. Negative Invariant 1: Rejecting solitary execution
  it('should enforce negative invariant: reject cycle with fewer than 3 subsystems', () => {
    const solitaryCycle: GlobalCognitiveCycleEvent = {
      id: 'cycle-solitary-1',
      traceId: 'trace-solitary',
      originSubsystem: 'perception',
      eventType: 'isolated_event',
      description: 'An isolated event that fails to cascade',
      contextSnapshot: { activeGoalCount: 1, relationshipTrust: 0.9, epistemicUncertainty: 0.2 },
      phaseExecutions: [
        {
          phase: 'perceptual_input',
          subsystem: 'perception',
          order: 0,
          timestamp: new Date().toISOString(),
          deltas: [],
        },
      ],
      subsystemsInvolved: ['perception'], // VIOLATION: only 1 subsystem!
      isCoherent: true,
      startedAt: new Date().toISOString(),
      completedAt: new Date(Date.now() + 10).toISOString(),
      totalLatencyMs: 10,
    };

    expect(() => assertGlobalCycleIntegrity(solitaryCycle)).toThrow(/Solitary Execution/);
  });

  // 9. Negative Invariant 2: Rejecting retrocausal sequence inversion
  it('should enforce negative invariant: reject cycle with reversed phase ordering', () => {
    const now = Date.now();
    const invertedCycle: GlobalCognitiveCycleEvent = {
      id: 'cycle-inverted-1',
      traceId: 'trace-inverted',
      originSubsystem: 'perception',
      eventType: 'inverted_event',
      description: 'Cycle with retrocausal ordering',
      contextSnapshot: { activeGoalCount: 1, relationshipTrust: 0.9, epistemicUncertainty: 0.2 },
      phaseExecutions: [
        {
          phase: 'perceptual_input',
          subsystem: 'perception',
          order: 2, // VIOLATION: out of order!
          timestamp: new Date(now).toISOString(),
          deltas: [],
        },
        {
          phase: 'affective_appraisal',
          subsystem: 'affect',
          order: 1,
          timestamp: new Date(now + 2).toISOString(),
          deltas: [],
        },
        {
          phase: 'attentional_modulation',
          subsystem: 'attention',
          order: 3,
          timestamp: new Date(now + 4).toISOString(),
          deltas: [],
        },
      ],
      subsystemsInvolved: ['perception', 'affect', 'attention'],
      isCoherent: true,
      startedAt: new Date(now).toISOString(),
      completedAt: new Date(now + 10).toISOString(),
      totalLatencyMs: 10,
    };

    expect(() => assertGlobalCycleIntegrity(invertedCycle)).toThrow(/Causal Ordering Inversion/);
  });

  // 10. SQLite Database Repository Persistence
  it('should persist global cognitive cycles and snapshots to SQLite database and retrieve by trace', async () => {
    const sqliteEngine = new GlobalCognitiveIntegrationEngine({ repository: sqliteRepo });

    const cycle = await sqliteEngine.processGlobalEvent({
      originSubsystem: 'learning',
      eventType: 'empirical_rule_synthesized',
      description: 'Learned novel strategy for parallel background processing.',
    });

    const retrieved = sqliteRepo.getCycleById(cycle.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(cycle.id);
    expect(retrieved?.traceId).toBe(cycle.traceId);
    expect(retrieved?.subsystemsInvolved.length).toBe(cycle.subsystemsInvolved.length);

    const retrievedByTrace = sqliteRepo.getCycleByTraceId(cycle.traceId);
    expect(retrievedByTrace?.id).toBe(cycle.id);

    const snapshot = sqliteEngine.generateUnifiedSnapshot();
    const retrievedSnapshot = sqliteRepo.getLatestSnapshot();
    expect(retrievedSnapshot?.snapshotId).toBe(snapshot.snapshotId);
  });

  // 11. ApeService & REST API Integration
  it('should serve global cognitive integration endpoints through ArletexBackendServer REST interface', async () => {
    const config = createDefaultConfig(tempDir);
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();

    // POST /api/ape/integration/cycle
    const cycleRes = await fetch(`http://127.0.0.1:${port}/api/ape/integration/cycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originSubsystem: 'attention',
        eventType: 'rest_api_global_stimulus',
        description: 'End-to-end integration test dispatching cross-system cognitive cascade.',
      }),
    });
    expect(cycleRes.status).toBe(201);
    const cycleData = (await cycleRes.json()) as any;
    expect(cycleData.success).toBe(true);
    expect(cycleData.cycle.id).toBeDefined();
    expect(cycleData.cycle.subsystemsInvolved.length).toBeGreaterThanOrEqual(4);

    // GET /api/ape/integration/snapshot
    const snapRes = await fetch(`http://127.0.0.1:${port}/api/ape/integration/snapshot`);
    expect(snapRes.status).toBe(200);
    const snapData = (await snapRes.json()) as any;
    expect(snapData.snapshotId).toBeDefined();
    expect(snapData.activeRelationship.partnerName).toBe('Proof');

    // GET /api/ape/integration/cycles
    const listRes = await fetch(`http://127.0.0.1:${port}/api/ape/integration/cycles`);
    expect(listRes.status).toBe(200);
    const cycles = (await listRes.json()) as any[];
    expect(cycles.length).toBeGreaterThanOrEqual(1);

    // GET /api/ape/integration/cycles/:id
    const getRes = await fetch(`http://127.0.0.1:${port}/api/ape/integration/cycles/${cycleData.cycle.id}`);
    expect(getRes.status).toBe(200);
    const singleCycle = (await getRes.json()) as any;
    expect(singleCycle.id).toBe(cycleData.cycle.id);
  });
});
