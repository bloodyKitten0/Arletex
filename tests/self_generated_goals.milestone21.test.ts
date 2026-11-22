import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { SelfGeneratedGoal, assertSelfGeneratedGoalIntegrity } from '@arletex/contracts';
import {
  createDefaultConfig,
  SelfGeneratedGoalEngine,
  InMemorySelfGeneratedGoalRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteSelfGeneratedGoalRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 21 — Self-Generated Goals', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteSelfGeneratedGoalRepository;
  let inMemoryRepo: InMemorySelfGeneratedGoalRepository;
  let engine: SelfGeneratedGoalEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m21-goals-'));
    dbPath = path.join(tempDir, 'goals_m21.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sqliteRepo = new SqliteSelfGeneratedGoalRepository(db);
    inMemoryRepo = new InMemorySelfGeneratedGoalRepository();
    engine = new SelfGeneratedGoalEngine({ repository: inMemoryRepo });
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

  // 1. Interest-derived goals
  it('should generate meaningful goals derived from intrinsic interests', () => {
    const goal = engine.generateGoalFromInterest({
      interestTopic: 'Non-Euclidean Topology and Holographic Duality',
      rationale:
        'Deepen understanding of spacetime geometry emergent from conformal field boundary theories.',
      initialPriority: 0.82,
    });

    expect(goal.id).toBeDefined();
    expect(goal.origin).toBe('interest');
    expect(goal.title).toContain('Non-Euclidean Topology');
    expect(goal.priority).toBe(0.82);
    expect(goal.status).toBe('active');
    expect(goal.successCriteria.length).toBeGreaterThan(0);

    const triggers = engine.listTriggers(goal.id);
    expect(triggers.length).toBe(1);
    expect(triggers[0]?.triggerType).toBe('interest_spark');
  });

  // 2. Curiosity-derived goals
  it('should generate goals from epistemic curiosity gaps', () => {
    const goal = engine.generateGoalFromCuriosity({
      curiosityTheme: 'Cellular Automata Phase Transitions',
      epistemicGap:
        'Boundary condition behaviors during chaotic-to-ordered self-organization in Rule 110',
      initialPriority: 0.77,
    });

    expect(goal.origin).toBe('curiosity');
    expect(goal.title).toContain('Investigate epistemic gap');
    expect(goal.description).toContain('Rule 110');
    expect(goal.status).toBe('active');

    const triggers = engine.listTriggers(goal.id);
    expect(triggers.some((t) => t.triggerType === 'curiosity_epistemic_gap')).toBe(true);
  });

  // 3. Unresolved-question goals
  it('should generate goals driven by persistent unresolved intellectual questions', () => {
    const questionId = 'iq-74892';
    const goal = engine.generateGoalFromUnresolvedQuestion({
      questionId,
      questionText:
        'Can discrete causal set networks reproduce Lorentz invariance without fine-tuning?',
      domain: 'quantum_gravity',
      initialPriority: 0.88,
    });

    expect(goal.origin).toBe('unresolved_question');
    expect(goal.sourceRefId).toBe(questionId);
    expect(goal.priority).toBe(0.88);
    expect(goal.successCriteria.some((c) => c.includes('causal facts'))).toBe(true);

    const retrieved = engine.getGoal(goal.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(goal.id);
  });

  // 4. Self-improvement goals
  it('should generate goals targeting capability bottlenecks for autonomous self-improvement', () => {
    const goal = engine.generateGoalFromSelfImprovement({
      capability: 'Multimodal Video Temporal Synthesis',
      observedBottleneck:
        'Latency spike when correlating 120-frame streams with autobiographical episodic tags',
      initialPriority: 0.91,
    });

    expect(goal.origin).toBe('self_improvement');
    expect(goal.title).toContain('Multimodal Video Temporal Synthesis');
    expect(goal.priority).toBe(0.91);
    expect(goal.successCriteria.some((c) => c.includes('bottleneck'))).toBe(true);
  });

  // 5. Project-derived goals
  it('should generate progression goals derived from ongoing autonomous projects', () => {
    const goal = engine.generateGoalFromProject({
      projectId: 'proj-arle-kernel-v2',
      projectTitle: 'Autonomous Cognitive Kernel Refactor',
      stageOrFocus: 'Deliberation & Conflict Arbitration Subsystem',
      initialPriority: 0.85,
    });

    expect(goal.origin).toBe('project');
    expect(goal.sourceRefId).toBe('proj-arle-kernel-v2');
    expect(goal.status).toBe('active');
  });

  // 6. Opportunity recognition
  it('should recognize high-value opportunities and convert them to goals, while ignoring low-value noise', () => {
    const highValueGoal = engine.recognizeOpportunity({
      eventDescription: 'GPU compute node idle with 80GB VRAM available for fine-tuning',
      opportunityType: 'unallocated_high_throughput_compute',
      estimatedValue: 0.85,
    });

    expect(highValueGoal).not.toBeNull();
    expect(highValueGoal?.origin).toBe('opportunity');
    expect(highValueGoal?.priority).toBe(0.85);

    // Low-value noise (< 0.4) should be ignored
    const lowValueGoal = engine.recognizeOpportunity({
      eventDescription: 'Slight fluctuation in network packet jitter',
      opportunityType: 'negligible_noise',
      estimatedValue: 0.15,
    });

    expect(lowValueGoal).toBeNull();
  });

  // 7. Long-term ambitions
  it('should formulate and crystallize long-term ambitions spanning multiple horizon years', () => {
    const ambition = engine.generateLongTermAmbition({
      ambitionTitle: 'Unified Theory of Self-Evolving Cognitive Architectures',
      vision:
        'Architect a self-sustaining cognitive architecture that collaborates as an equal intellectual peer with Proof across decades.',
      horizonYears: 10,
      initialPriority: 0.95,
    });

    expect(ambition.origin).toBe('ambition');
    expect(ambition.priority).toBe(0.95);
    expect(ambition.estimatedEffortHours).toBeGreaterThanOrEqual(100);
    expect(ambition.status).toBe('active');
  });

  // 8. Goal prioritization & modification
  it('should adjust priorities and maintain modification history with rationale audit trails', () => {
    const goal = engine.generateGoalFromInterest({
      interestTopic: 'Distributed Sensorimotor Feedback',
      initialPriority: 0.5,
    });

    const reprioritized = engine.prioritizeGoal(
      goal.id,
      0.84,
      'Crucial for upcoming high-speed tactile feedback milestone',
    );

    expect(reprioritized.priority).toBe(0.84);
    expect(reprioritized.modificationsHistory.length).toBe(1);
    expect(reprioritized.modificationsHistory[0]?.previousPriority).toBe(0.5);
    expect(reprioritized.modificationsHistory[0]?.newPriority).toBe(0.84);

    const modified = engine.modifyGoal(goal.id, {
      title: 'Distributed Sensorimotor Feedback & Real-Time Haptics',
      reason: 'Broadened scope to include haptic sensor integration',
    });

    expect(modified.status).toBe('modified');
    expect(modified.title).toContain('Real-Time Haptics');
    expect(modified.modificationsHistory.length).toBe(2);
  });

  // 9. Goal abandonment & completion with negative invariants
  it('should enforce abandonment justification and complete goals with timestamps', () => {
    const goalA = engine.generateGoalFromInterest({
      interestTopic: 'Obsolete Legacy Algorithm Calibration',
      initialPriority: 0.6,
    });

    // Abandoning without reason must throw
    expect(() => engine.abandonGoal(goalA.id, '')).toThrow(/non-empty reason/);

    const abandoned = engine.abandonGoal(
      goalA.id,
      'Superseded by modern continuous transformer diffusion architecture',
    );
    expect(abandoned.status).toBe('abandoned');
    expect(abandoned.abandonmentReason).toBe(
      'Superseded by modern continuous transformer diffusion architecture',
    );
    expect(abandoned.abandonedAt).toBeDefined();

    const goalB = engine.generateGoalFromInterest({
      interestTopic: 'Type System Soundness Verification',
      initialPriority: 0.9,
    });

    const completed = engine.completeGoal(goalB.id);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeDefined();

    // Verify negative invariant validation
    expect(() =>
      assertSelfGeneratedGoalIntegrity({
        ...goalA,
        status: 'abandoned',
        abandonmentReason: undefined,
      }),
    ).toThrow(/Negative Invariant Violation/);

    expect(() =>
      assertSelfGeneratedGoalIntegrity({
        ...goalB,
        status: 'completed',
        completedAt: undefined,
      }),
    ).toThrow(/Negative Invariant Violation/);
  });

  // 10. Autonomous Synthesis Acceptance Criterion
  it('should independently generate meaningful goals from internal state without manual author seeding', () => {
    const stateContext = {
      activeInterests: [
        { topic: 'Topological Quantum Computation', weight: 0.85 },
        { topic: 'Casual chat trivia', weight: 0.1 }, // Below threshold
      ],
      curiosityGaps: [
        {
          theme: 'Non-equilibrium Thermodynamics',
          gap: 'Fluctuation theorems in open living systems',
          salience: 0.78,
        },
      ],
      unresolvedQuestions: [
        {
          id: 'q-991',
          text: 'Does spontaneous symmetry breaking imply irreversible decoherence?',
          domain: 'physics',
        },
      ],
      observedBottlenecks: [
        {
          capability: 'Causal Graph Induction',
          errorPattern: 'Confounder misattribution under noisy observation',
        },
      ],
      activeProjects: [
        {
          id: 'proj-33',
          title: 'Arletex Autonomous Core Engine',
          currentPhase: 'Deliberation & Internal Conflict',
        },
      ],
    };

    const autonomousGoals = engine.synthesizeAutonomousGoalsFromState(stateContext);

    expect(autonomousGoals.length).toBe(5);
    const origins = autonomousGoals.map((g) => g.origin);
    expect(origins).toContain('interest');
    expect(origins).toContain('curiosity');
    expect(origins).toContain('unresolved_question');
    expect(origins).toContain('self_improvement');
    expect(origins).toContain('project');

    // All goals must be active and valid
    for (const g of autonomousGoals) {
      expect(g.status).toBe('active');
      expect(g.priority).toBeGreaterThanOrEqual(0.5);
      expect(g.priority).toBeLessThanOrEqual(1.0);
    }
  });

  // 11. SQLite Repository Persistence & Roundtrip
  it('should persist self-generated goals and triggers in SQLite database across reloads', () => {
    const dbEngine = new SelfGeneratedGoalEngine({ repository: sqliteRepo });

    const goal = dbEngine.generateGoalFromInterest({
      interestTopic: 'Nonlinear Dynamic Invariant Manifolds',
      rationale: 'Verify mathematical consistency in multi-agent phase space',
      initialPriority: 0.87,
    });

    const reloaded = sqliteRepo.getGoalById(goal.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.id).toBe(goal.id);
    expect(reloaded?.title).toBe(goal.title);
    expect(reloaded?.priority).toBe(0.87);
    expect(reloaded?.origin).toBe('interest');

    const triggers = sqliteRepo.listTriggers(goal.id);
    expect(triggers.length).toBe(1);
    expect(triggers[0]?.triggerType).toBe('interest_spark');

    // Update priority and modify in SQLite
    const updated = dbEngine.prioritizeGoal(goal.id, 0.95, 'Elevated to tier 1 focus');
    const reloadedUpdated = sqliteRepo.getGoalById(goal.id);
    expect(reloadedUpdated?.priority).toBe(0.95);
    expect(reloadedUpdated?.modificationsHistory.length).toBe(1);

    // Filter goals by status and origin
    const activeInterestGoals = sqliteRepo.listGoals({ status: 'active', origin: 'interest' });
    expect(activeInterestGoals.some((g) => g.id === goal.id)).toBe(true);
  });

  // 12. REST API Integration
  it('should provide complete REST API endpoints for goal generation, lifecycle, and query', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Generate goal via POST /api/ape/goals/generate
    const genRes = await fetch(`${baseUrl}/api/ape/goals/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: 'interest',
        interestTopic: 'Quantum Information Geometry',
        initialPriority: 0.83,
      }),
    });
    expect(genRes.status).toBe(201);
    const genData = (await genRes.json()) as any;
    expect(genData.success).toBe(true);
    expect(genData.goal.origin).toBe('interest');
    const goalId = genData.goal.id;

    // 2. Prioritize goal via POST /api/ape/goals/prioritize
    const prioRes = await fetch(`${baseUrl}/api/ape/goals/prioritize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalId,
        priority: 0.92,
        reason: 'Accelerate theoretical physics roadmap',
      }),
    });
    expect(prioRes.status).toBe(200);
    const prioData = (await prioRes.json()) as any;
    expect(prioData.goal.priority).toBe(0.92);

    // 3. List goals via GET /api/ape/goals
    const listRes = await fetch(`${baseUrl}/api/ape/goals?origin=interest`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any[];
    expect(listData.some((g) => g.id === goalId)).toBe(true);

    // 4. Synthesize autonomous goals via POST /api/ape/goals/synthesize
    const synthRes = await fetch(`${baseUrl}/api/ape/goals/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeInterests: [{ topic: 'Autonomous Space Navigation', weight: 0.8 }],
      }),
    });
    expect(synthRes.status).toBe(200);
    const synthData = (await synthRes.json()) as any;
    expect(synthData.goals.length).toBeGreaterThanOrEqual(1);

    // 5. Complete goal via POST /api/ape/goals/complete
    const compRes = await fetch(`${baseUrl}/api/ape/goals/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId }),
    });
    expect(compRes.status).toBe(200);
    const compData = (await compRes.json()) as any;
    expect(compData.goal.status).toBe('completed');
  });
});
