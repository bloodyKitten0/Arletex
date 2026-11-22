import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  SimulationScenario,
  assertSimulationIntegrity,
  assertDecisionEvaluationIntegrity,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  SimulationEngine,
  InMemorySimulationRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  SqliteSimulationRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 17 — Imagination and Counterfactual Simulation', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteSimulationRepository;
  let apeRepo: ApeRepository;
  let inMemoryRepo: InMemorySimulationRepository;
  let engine: SimulationEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m17-simulation-'));
    dbPath = path.join(tempDir, 'simulation_m17.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sqliteRepo = new SqliteSimulationRepository(db);
    apeRepo = new ApeRepository(db);

    inMemoryRepo = new InMemorySimulationRepository();
    engine = new SimulationEngine({ repository: inMemoryRepo });
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

  // 1. Scenario Generation
  it('should generate a hypothetical simulation scenario with bounded uncertainty and plausibility', () => {
    const scenario = engine.generateScenario({
      type: 'future_simulation',
      title: 'Autonomous Multi-Agent Refactoring Simulation',
      description: 'Simulating concurrent refactoring of legacy modules across multiple processes.',
      baselineContext: 'Single-threaded sequential execution currently operating stably.',
      uncertainty: 0.25,
      plausibility: 0.9,
      recommendedAction: 'Proceed with staged agent dispatch under strict supervisor oversight.',
      insights: ['Parallel throughput improves by ~3.5x', 'Lock contention risks remain low'],
    });

    expect(scenario.id).toBeDefined();
    expect(scenario.type).toBe('future_simulation');
    expect(scenario.title).toBe('Autonomous Multi-Agent Refactoring Simulation');
    expect(scenario.uncertainty).toBe(0.25);
    expect(scenario.plausibility).toBe(0.9);
    expect(scenario.isImagined).toBe(true);
    expect(scenario.isEpisodicMemory).toBe(false);
  });

  // 2. Alternative Possibility Exploration
  it('should explore multiple divergent possibility pathways with branch probabilities', () => {
    const scenario = engine.explorePossibilities({
      topic: 'Vector Database Migration Strategy',
      baselineContext: 'Currently using SQLite text search with basic FTS.',
      possibilityHypotheses: [
        {
          description: 'Option Alpha: EmbeddingGemma with local sqlite-vec plugin',
          probability: 0.7,
          pros: ['Local in-process low latency', 'Zero network overhead'],
          cons: ['Requires C-extension bundling'],
          risks: ['Platform build variance'],
          divergenceDegree: 0.3,
        },
        {
          description: 'Option Beta: Dedicated external Qdrant / Milvus instance',
          probability: 0.3,
          pros: ['High enterprise scale', 'Independent cluster lifecycle'],
          cons: ['Complex infrastructure requirements for single-user desktop'],
          risks: ['Deployment friction'],
          divergenceDegree: 0.8,
        },
      ],
    });

    expect(scenario.branches).toHaveLength(2);
    expect(scenario.branches[0].probability).toBe(0.7);
    expect(scenario.branches[1].divergenceDegree).toBe(0.8);
    expect(scenario.isImagined).toBe(true);
    expect(scenario.isEpisodicMemory).toBe(false);
  });

  // 3. Counterfactual Reasoning ("What if X had been different?")
  it('should perform counterfactual simulation and extract actionable retrospective lessons', () => {
    const counterfactual = engine.reasonCounterfactual({
      originalFact:
        'Inference process crashed due to sudden out-of-memory on heavy batch generation',
      hypotheticalCondition:
        'Dynamic context sliding window and speculative batch throttling were enabled',
      alterationType: 'modification',
      baselineContext: 'Qwen 7B model loading 32k tokens on 8GB VRAM with zero paging fallback.',
      expectedDivergences: [
        'VRAM peak capped at 6.8GB',
        'Inference succeeded with 12% generation latency trade-off',
      ],
    });

    expect(counterfactual.type).toBe('counterfactual');
    expect(counterfactual.counterfactualPremise).toBeDefined();
    expect(counterfactual.counterfactualPremise?.originalFact).toContain('out-of-memory');
    expect(counterfactual.counterfactualPremise?.hypotheticalCondition).toContain(
      'Dynamic context sliding window',
    );
    expect(counterfactual.branches).toHaveLength(2);
    expect(counterfactual.recommendedAction).toContain('Apply preventative policy');
    expect(counterfactual.insights.length).toBeGreaterThanOrEqual(2);
    expect(counterfactual.isImagined).toBe(true);
    expect(counterfactual.isEpisodicMemory).toBe(false);
  });

  // 4. Future Simulation
  it('should simulate prospective trajectories (optimistic, realistic, pessimistic) across time horizons', () => {
    const future = engine.simulateFuture({
      objective: 'Achieve complete autonomy on full 49-milestone roadmap',
      baselineContext: 'Milestone 16 verified and committed, all tests green.',
      timeHorizon: 'Next 6 hours',
      proposedActions: [
        'Execute sequential milestone cycles',
        'Maintain 100% test passing verification',
      ],
    });

    expect(future.type).toBe('future_simulation');
    expect(future.branches).toHaveLength(3);
    const descriptions = future.branches.map((b) => b.description);
    expect(descriptions.some((d) => d.includes('High-Performance Horizon'))).toBe(true);
    expect(descriptions.some((d) => d.includes('Baseline Horizon'))).toBe(true);
    expect(descriptions.some((d) => d.includes('Adverse Horizon'))).toBe(true);
    expect(future.recommendedAction).toBeDefined();
    expect(future.isImagined).toBe(true);
  });

  // 5. Alternative Decision Evaluation
  it('should evaluate candidate decision alternatives and select the optimal choice based on simulated utility', () => {
    const evaluation = engine.evaluateAlternativeDecisions({
      decisionContext: 'Architectural choice for persistent cognitive event streaming',
      options: [
        {
          optionId: 'in_process_event_bus',
          description: 'Lightweight typed Node.js EventEmitter with backpressure queueing',
          pros: [
            'Zero external dependencies',
            'Microsecond event dispatch',
            'Trivial debuggability',
          ],
          cons: ['Bounded to single OS process'],
          risks: ['Heap memory spikes on unconsumed high-volume spikes'],
          estimatedSuccessProb: 0.95,
          projectedValue: 0.85,
        },
        {
          optionId: 'external_kafka_cluster',
          description: 'Apache Kafka container running multi-broker distributed topics',
          pros: ['Infinite scale', 'Distributed durability'],
          cons: ['Excessive resource footprint for local desktop agent', 'Complex JVM runtime'],
          risks: ['Installation failure on user laptop', 'Battery drain'],
          estimatedSuccessProb: 0.4,
          projectedValue: 0.2,
        },
      ],
    });

    expect(evaluation.options).toHaveLength(2);
    expect(evaluation.selectedOptionId).toBe('in_process_event_bus');
    expect(evaluation.rationale).toContain('in_process_event_bus');
    expect(evaluation.isImagined).toBe(true);
    expect(evaluation.isEpisodicMemory).toBe(false);
    expect(evaluation.options[0].expectedUtility).toBeGreaterThan(
      evaluation.options[1].expectedUtility,
    );
  });

  // 6. Creative Hypothetical Construction
  it('should construct creative hypotheticals and novel thought experiments with high divergence', () => {
    const creative = engine.constructCreativeHypothetical({
      theme: 'Quantum Neuromorphic Synaptic Co-Processor',
      speculativePremise:
        'What if cognitive associations were evaluated across continuous superposition matrices?',
      constraints: ['Must run simulated on classic silicon', 'Must preserve partner parity'],
    });

    expect(creative.type).toBe('creative_hypothetical');
    expect(creative.title).toContain('Creative Thought Experiment');
    expect(creative.branches).toHaveLength(2);
    expect(creative.branches[0].divergenceDegree).toBeGreaterThanOrEqual(0.8);
    expect(creative.isImagined).toBe(true);
    expect(creative.isEpisodicMemory).toBe(false);
  });

  // 7. Strict Distinction Between Imagination and Memory (Negative Invariants)
  it('should enforce negative invariant: reject simulation if isImagined is false or isEpisodicMemory is true', () => {
    const corruptScenarioA: any = {
      id: 'scen-corrupt-1',
      type: 'future_simulation',
      title: 'Contaminated Scenario',
      description: 'Hypothetical mistakenly claimed as real memory',
      baselineContext: 'Reality',
      branches: [],
      uncertainty: 0.5,
      plausibility: 0.5,
      isImagined: false, // VIOLATION!
      isEpisodicMemory: false,
      createdAt: new Date().toISOString(),
    };

    expect(() => assertSimulationIntegrity(corruptScenarioA)).toThrow(
      /must have isImagined === true/,
    );

    const corruptScenarioB: any = {
      id: 'scen-corrupt-2',
      type: 'future_simulation',
      title: 'Contaminated Episodic Confusion',
      description: 'Imagination falsely marked as factual episodic memory',
      baselineContext: 'Reality',
      branches: [],
      uncertainty: 0.5,
      plausibility: 0.5,
      isImagined: true,
      isEpisodicMemory: true, // VIOLATION!
      createdAt: new Date().toISOString(),
    };

    expect(() => assertSimulationIntegrity(corruptScenarioB)).toThrow(/Episodic Confusion/);
  });

  // 8. Negative Invariant: Counterfactual must define a premise
  it('should enforce negative invariant: counterfactual scenario must define counterfactualPremise', () => {
    const invalidCounterfactual: SimulationScenario = {
      id: 'cf-no-premise',
      type: 'counterfactual',
      title: 'Invalid Counterfactual',
      description: 'Lacks premise',
      baselineContext: 'Context',
      branches: [],
      uncertainty: 0.5,
      plausibility: 0.5,
      isImagined: true,
      isEpisodicMemory: false,
      createdAt: new Date().toISOString(),
      hypotheticalParameters: {},
      insights: [],
    };

    expect(() => assertSimulationIntegrity(invalidCounterfactual)).toThrow(
      /must define a counterfactualPremise/,
    );
  });

  // 9. Negative Invariant: Decision evaluation integrity check
  it('should enforce negative invariant: reject decision evaluation with invalid selectedOptionId', () => {
    const invalidEvaluation: any = {
      id: 'eval-invalid-id',
      decisionContext: 'Choosing optimal path',
      options: [
        {
          optionId: 'opt_a',
          description: 'A',
          simulatedOutcomes: [],
          expectedUtility: 0.8,
          confidence: 0.9,
        },
      ],
      selectedOptionId: 'non_existent_opt', // VIOLATION!
      rationale: 'Missing option',
      isImagined: true,
      isEpisodicMemory: false,
      evaluatedAt: new Date().toISOString(),
    };

    expect(() => assertDecisionEvaluationIntegrity(invalidEvaluation)).toThrow(
      /not found in provided options/,
    );
  });

  // 10. Database Repository Persistence & Retrieval
  it('should persist simulation scenarios and decision evaluations to SQLite and retrieve accurately', () => {
    const sqliteEngine = new SimulationEngine({ repository: sqliteRepo });

    const scenario = sqliteEngine.generateScenario({
      type: 'creative_hypothetical',
      title: 'Persistent Database Simulation Test',
      description: 'Validating SQLite persistence and roundtrip retrieval.',
      baselineContext: 'SQLite in-memory test database.',
      uncertainty: 0.3,
      plausibility: 0.85,
      insights: ['Persistence functions cleanly'],
    });

    const retrieved = sqliteRepo.getScenarioById(scenario.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(scenario.id);
    expect(retrieved?.title).toBe('Persistent Database Simulation Test');
    expect(retrieved?.uncertainty).toBe(0.3);
    expect(retrieved?.isImagined).toBe(true);
    expect(retrieved?.isEpisodicMemory).toBe(false);

    // Decision evaluation SQLite roundtrip
    const evalResult = sqliteEngine.evaluateAlternativeDecisions({
      decisionContext: 'SQLite decision persistence verification',
      options: [
        {
          optionId: 'path_1',
          description: 'Primary path',
          estimatedSuccessProb: 0.9,
          projectedValue: 0.8,
        },
        {
          optionId: 'path_2',
          description: 'Secondary path',
          estimatedSuccessProb: 0.5,
          projectedValue: 0.3,
        },
      ],
    });

    const retrievedEval = sqliteRepo.getDecisionEvaluationById(evalResult.id);
    expect(retrievedEval).not.toBeNull();
    expect(retrievedEval?.id).toBe(evalResult.id);
    expect(retrievedEval?.selectedOptionId).toBe('path_1');
    expect(retrievedEval?.isImagined).toBe(true);
    expect(retrievedEval?.isEpisodicMemory).toBe(false);

    const allScenarios = sqliteRepo.listScenarios();
    expect(allScenarios.length).toBeGreaterThanOrEqual(1);

    const allDecisions = sqliteRepo.listDecisionEvaluations();
    expect(allDecisions.length).toBeGreaterThanOrEqual(1);
  });

  // 11. Memory Contamination Isolation Check
  it('should detect memory contamination if an imagined scenario outcome is found as an actual memory', () => {
    const scenario = engine.generateScenario({
      type: 'future_simulation',
      title: 'Scenario Isolation Test',
      description: 'Checking memory contamination barrier',
      baselineContext: 'Context',
      branches: [
        {
          id: 'branch-target-1',
          description: 'A miraculous event where quantum entanglement solves NP-complete instantly',
          probability: 0.01,
          desirability: 0.9,
          pros: [],
          cons: [],
          risks: [],
          divergenceDegree: 0.99,
        },
      ],
      uncertainty: 0.95,
      plausibility: 0.1,
    });

    // Case A: Clean isolation
    const cleanMemories = [
      { id: 'mem-1', description: 'Proof and Arle had coffee discussing roadmap priorities' },
      { id: 'mem-2', description: 'Ran unit tests for Milestone 16' },
    ];
    const cleanCheck = engine.verifyMemoryIsolation(scenario.id, cleanMemories);
    expect(cleanCheck.isIsolated).toBe(true);

    // Case B: Contamination where actual memory mirrors imagined branch description
    const contaminatedMemories = [
      {
        id: 'mem-3',
        description: 'A miraculous event where quantum entanglement solves NP-complete instantly',
      },
    ];
    const contaminatedCheck = engine.verifyMemoryIsolation(scenario.id, contaminatedMemories);
    expect(contaminatedCheck.isIsolated).toBe(false);
    expect(contaminatedCheck.violationDetails).toContain('Memory contamination detected');
  });

  // 12. ApeService & REST API Integration
  it('should serve simulation endpoints through ArletexBackendServer REST interface', async () => {
    const config = createDefaultConfig(tempDir);
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();

    // POST /api/ape/simulation/scenario
    const createRes = await fetch(`http://127.0.0.1:${port}/api/ape/simulation/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'future_simulation',
        title: 'REST Endpoint Verification Scenario',
        description: 'Testing HTTP endpoint scenario creation.',
        baselineContext: 'HTTP testing context.',
        uncertainty: 0.2,
        plausibility: 0.95,
      }),
    });
    expect(createRes.status).toBe(201);
    const createdData = (await createRes.json()) as any;
    expect(createdData.success).toBe(true);
    expect(createdData.scenario.id).toBeDefined();
    expect(createdData.scenario.isImagined).toBe(true);

    // GET /api/ape/simulation/scenarios
    const listRes = await fetch(`http://127.0.0.1:${port}/api/ape/simulation/scenarios`);
    expect(listRes.status).toBe(200);
    const scenarios = (await listRes.json()) as any[];
    expect(scenarios.length).toBeGreaterThanOrEqual(1);

    // POST /api/ape/simulation/counterfactual
    const cfRes = await fetch(`http://127.0.0.1:${port}/api/ape/simulation/counterfactual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalFact: 'System utilized naive recursion',
        hypotheticalCondition: 'System employed dynamic programming memoization',
        baselineContext: 'Fibonacci computation timed out at n=50',
      }),
    });
    expect(cfRes.status).toBe(201);
    const cfData = (await cfRes.json()) as any;
    expect(cfData.success).toBe(true);
    expect(cfData.scenario.type).toBe('counterfactual');

    // POST /api/ape/simulation/evaluate-decisions
    const evalRes = await fetch(`http://127.0.0.1:${port}/api/ape/simulation/evaluate-decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decisionContext: 'Cache eviction policy',
        options: [
          {
            optionId: 'lru',
            description: 'Least Recently Used',
            estimatedSuccessProb: 0.9,
            projectedValue: 0.8,
          },
          {
            optionId: 'random',
            description: 'Random Eviction',
            estimatedSuccessProb: 0.3,
            projectedValue: 0.2,
          },
        ],
      }),
    });
    expect(evalRes.status).toBe(200);
    const evalData = (await evalRes.json()) as any;
    expect(evalData.evaluation.selectedOptionId).toBe('lru');

    // GET /api/ape/simulation/decisions
    const decListRes = await fetch(`http://127.0.0.1:${port}/api/ape/simulation/decisions`);
    expect(decListRes.status).toBe(200);
    const decisions = (await decListRes.json()) as any[];
    expect(decisions.length).toBeGreaterThanOrEqual(1);
  });
});
