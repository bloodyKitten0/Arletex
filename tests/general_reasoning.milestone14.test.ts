import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  ReasoningPremise,
  ReasoningTask,
  assertReasoningIntegrity,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  GeneralReasoningEngine,
  InMemoryReasoningRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  SqliteReasoningRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 14 — General Diverse Reasoning', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let reasoningRepo: SqliteReasoningRepository;
  let apeRepo: ApeRepository;
  let reasoningEngine: GeneralReasoningEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m14-reasoning-'));
    dbPath = path.join(tempDir, 'reasoning_m14.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    reasoningRepo = new SqliteReasoningRepository(db);
    apeRepo = new ApeRepository(db);
    reasoningEngine = new GeneralReasoningEngine({
      repository: reasoningRepo,
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

  // -------------------------------------------------------------
  // Test 1: Deductive Reasoning (Modus Ponens & Logical Entailment)
  // -------------------------------------------------------------
  it('performs deductive reasoning with sound premise entailment', () => {
    const premises: ReasoningPremise[] = [
      {
        id: 'p1',
        statement: 'If an operating system process receives SIGKILL, it terminates immediately without running cleanup handlers',
        truthValue: 'true',
      },
      {
        id: 'p2',
        statement: 'The background worker process received SIGKILL',
        truthValue: 'true',
      },
    ];

    const task = reasoningEngine.executeDeduction(
      premises,
      'The background worker process terminated immediately without running cleanup handlers',
      'operating_systems',
    );

    expect(task.primaryParadigm).toBe('deductive');
    expect(task.compositeConfidence).toBeGreaterThanOrEqual(0.95);
    expect(task.uncertaintyLevel).toBeLessThanOrEqual(0.05);
    expect(task.steps.length).toBeGreaterThanOrEqual(1);
    expect(task.finalConclusion).toContain('Deductively verified');
    expect(task.argumentEvaluation?.isSound).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 2: Inductive Reasoning (Generalization with Epistemic Humility)
  // -------------------------------------------------------------
  it('derives inductive generalizations from empirical observations while bounding confidence', () => {
    const observations = [
      'In iteration 1, adding transactional commit wrapper prevented database corruption during sudden failure',
      'In iteration 2, adding transactional commit wrapper prevented database corruption during sudden failure',
      'In iteration 3, adding transactional commit wrapper prevented database corruption during sudden failure',
      'In iteration 4, adding transactional commit wrapper prevented database corruption during sudden failure',
    ];

    const task = reasoningEngine.executeInduction(
      observations,
      'Transactional commit wrappers prevent database corruption during sudden failure',
      'data_integrity',
    );

    expect(task.primaryParadigm).toBe('inductive');
    // Epistemic humility invariant: cannot claim 1.0 certainty!
    expect(task.compositeConfidence).toBeLessThan(1.0);
    expect(task.compositeConfidence).toBeGreaterThanOrEqual(0.7);
    expect(task.uncertaintyLevel).toBeGreaterThan(0.0);
    expect(task.steps[0]!.uncertaintyNotes).toContain('open to future empirical counterexamples');
  });

  // -------------------------------------------------------------
  // Test 3: Abductive Reasoning (Inference to Best Explanation)
  // -------------------------------------------------------------
  it('selects the most probable explanation for surprising observations via abduction', () => {
    const surprisingObs = 'High memory usage spike observed immediately after large PDF parsing job';
    const candidateExplanations = [
      {
        explanation: 'Worker thread retained uncompressed decoded raster pixel buffers in working memory',
        priorLikelihood: 0.8,
        explanatoryPower: 0.9,
      },
      {
        explanation: 'Hardware RAM chip bit-flip anomaly',
        priorLikelihood: 0.001,
        explanatoryPower: 0.2,
      },
      {
        explanation: 'Unrelated background telemetry heartbeat allocation',
        priorLikelihood: 0.3,
        explanatoryPower: 0.1,
      },
    ];

    const task = reasoningEngine.executeAbduction(
      surprisingObs,
      candidateExplanations,
      'Determine root cause of memory spike',
      'performance_profiling',
    );

    expect(task.primaryParadigm).toBe('abductive');
    expect(task.finalConclusion).toContain('uncompressed decoded raster pixel buffers');
    expect(task.compositeConfidence).toBeLessThan(1.0); // Epistemic humility
    expect(task.uncertaintyLevel).toBeGreaterThan(0.1);
  });

  // -------------------------------------------------------------
  // Test 4: Analogical Reasoning (Relational Structure Mapping)
  // -------------------------------------------------------------
  it('performs cross-domain analogical reasoning through structural relational mapping', () => {
    const task = reasoningEngine.executeAnalogicalReasoning(
      'biological_immune_system',
      'software_security_architecture',
      [
        { sourceRelation: 'antibodies recognize foreign antigens', targetRelation: 'waf rules identify malicious payloads' },
        { sourceRelation: 'memory B-cells retain past pathogen profiles', targetRelation: 'threat intelligence database caches attack signatures' },
        { sourceRelation: 'fever elevates system-wide response threshold', targetRelation: 'circuit breakers throttle anomalous request bursts' },
      ],
      'Software architectures can self-harden against novel attacks using cached signature history and adaptive throttling',
    );

    expect(task.primaryParadigm).toBe('analogical');
    expect(task.compositeConfidence).toBeGreaterThanOrEqual(0.8);
    expect(task.steps[0]!.operation).toBe('relational_structure_mapping');
    expect(task.finalConclusion).toContain('Analogical projection');
  });

  // -------------------------------------------------------------
  // Test 5: Probabilistic Reasoning (Bayesian Updating)
  // -------------------------------------------------------------
  it('calculates Bayesian posterior probabilities with uncertainty quantification', () => {
    // Medical / Diagnosis test scenario:
    // Prior disease probability P(H) = 0.05
    // Test sensitivity P(E|H) = 0.95
    // False positive rate P(E|~H) = 0.10
    const task = reasoningEngine.executeProbabilisticReasoning(
      0.05,
      0.95,
      0.10,
      'Probability of condition given positive diagnostic marker',
      'diagnostic_statistics',
    );

    expect(task.primaryParadigm).toBe('probabilistic');
    // P(E) = 0.95*0.05 + 0.10*0.95 = 0.0475 + 0.095 = 0.1425
    // P(H|E) = 0.0475 / 0.1425 = 0.333 (33.3%)
    expect(task.finalConclusion).toContain('33.3%');
    expect(task.compositeConfidence).toBeLessThan(1.0);
    expect(task.uncertaintyLevel).toBeGreaterThan(0.0);
  });

  // -------------------------------------------------------------
  // Test 6: Mathematical Reasoning (Symbolic & Computational Steps)
  // -------------------------------------------------------------
  it('executes multi-step mathematical derivations with high precision', () => {
    const task = reasoningEngine.executeMathematicalReasoning(
      'Compute throughput efficiency delta between 25ms and 5ms processing latencies over 1000 requests',
      [
        { step: 'Initial time T1 = 1000 * 25ms', result: '25,000ms (25.0s)' },
        { step: 'Optimized time T2 = 1000 * 5ms', result: '5,000ms (5.0s)' },
        { step: 'Speedup factor S = T1 / T2', result: '5.0x speedup (80% time reduction)' },
      ],
      '5.0x throughput speedup with 20 seconds saved per 1000 requests',
      'performance_math',
    );

    expect(task.primaryParadigm).toBe('mathematical');
    expect(task.compositeConfidence).toBe(0.99);
    expect(task.uncertaintyLevel).toBe(0.01);
    expect(task.steps.length).toBe(3);
    expect(task.finalConclusion).toContain('5.0x throughput speedup');
  });

  // -------------------------------------------------------------
  // Test 7: Multi-Step Hybrid Reasoning
  // -------------------------------------------------------------
  it('chains multi-step reasoning steps across distinct cognitive paradigms', () => {
    const task = reasoningEngine.executeMultiStepReasoning({
      query: 'Evaluate optimal system cache size under constrained memory profile',
      domain: 'systems_engineering',
      premises: [
        { id: 'p1', statement: 'Total system RAM is 512MB', truthValue: 'true' },
        { id: 'p2', statement: 'Base application overhead is 200MB', truthValue: 'true' },
      ],
      steps: [
        {
          paradigm: 'mathematical',
          operation: 'subtraction',
          intermediateConclusion: 'Available memory headroom: 512MB - 200MB = 312MB',
          confidence: 0.99,
        },
        {
          paradigm: 'probabilistic',
          operation: 'safety_margin_calculation',
          intermediateConclusion: 'Reserve 40% margin (124.8MB) for transient spikes, leaving ~180MB for cache',
          confidence: 0.9,
        },
        {
          paradigm: 'deductive',
          operation: 'bound_assignment',
          intermediateConclusion: 'Set MAX_CACHE_SIZE to 180MB to guarantee zero OOM termination',
          confidence: 0.95,
        },
      ],
      finalConclusion: 'Configured MAX_CACHE_SIZE = 180MB based on mathematical headroom and probabilistic safety margins.',
    });

    expect(task.primaryParadigm).toBe('multi_step');
    expect(task.steps.length).toBe(3);
    expect(task.compositeConfidence).toBeGreaterThan(0.9);
    expect(task.finalConclusion).toContain('180MB');
  });

  // -------------------------------------------------------------
  // Test 8: Argument Evaluation & Fallacy Detection
  // -------------------------------------------------------------
  it('evaluates logical validity and detects formal/informal fallacies', () => {
    // Fallacy 1: Affirming the consequent
    const evalConsequent = reasoningEngine.evaluateArgument(
      [
        { id: 'p1', statement: 'If it is raining, then the streets are wet', truthValue: 'true' },
        { id: 'p2', statement: 'The streets are wet', truthValue: 'true' },
      ],
      'It is raining',
    );
    expect(evalConsequent.isLogicallyValid).toBe(false);
    expect(evalConsequent.identifiedFallacies).toContain('affirming_the_consequent');

    // Fallacy 2: Circular reasoning
    const evalCircular = reasoningEngine.evaluateArgument(
      [{ id: 'p1', statement: 'The algorithm is optimal', truthValue: 'true' }],
      'The algorithm is optimal',
    );
    expect(evalCircular.isLogicallyValid).toBe(false);
    expect(evalCircular.identifiedFallacies).toContain('circular_reasoning');

    // Valid and sound argument
    const evalValid = reasoningEngine.evaluateArgument(
      [
        { id: 'p1', statement: 'All humans are mortal', truthValue: 'true' },
        { id: 'p2', statement: 'Proof is human', truthValue: 'true' },
      ],
      'Proof is mortal',
    );
    expect(evalValid.isLogicallyValid).toBe(true);
    expect(evalValid.isSound).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 9: Negative Invariant — Epistemic Uncertainty Calibration
  // -------------------------------------------------------------
  it('enforces negative invariant that inductive, abductive, and probabilistic reasoning cannot claim 100% certainty', () => {
    expect(() => {
      assertReasoningIntegrity({
        id: crypto.randomUUID(),
        query: 'unwarranted certainty test',
        domain: 'test',
        primaryParadigm: 'inductive',
        premises: [],
        steps: [],
        finalConclusion: 'claiming 100% certainty on induction',
        compositeConfidence: 1.0, // VIOLATION! Inductive reasoning cannot be 1.0
        uncertaintyLevel: 0.0,    // VIOLATION! Must acknowledge uncertainty
        timestamp: new Date().toISOString(),
      });
    }).toThrow(/Negative Invariant Violation: inductive reasoning cannot claim 100% absolute certainty/);

    expect(() => {
      assertReasoningIntegrity({
        id: crypto.randomUUID(),
        query: 'empty multi-step test',
        domain: 'test',
        primaryParadigm: 'multi_step',
        premises: [],
        steps: [], // VIOLATION! multi_step must have at least one step
        finalConclusion: 'done',
        compositeConfidence: 0.8,
        uncertaintyLevel: 0.2,
        timestamp: new Date().toISOString(),
      });
    }).toThrow(/Multi-step reasoning tasks must contain at least one reasoning step/);
  });

  // -------------------------------------------------------------
  // Test 10: SQLite Persistence across Restarts and REST API
  // -------------------------------------------------------------
  it('persists reasoning tasks across SQLite restarts and serves REST API endpoints', async () => {
    // 1. Create a task via engine
    const mathTask = reasoningEngine.executeMathematicalReasoning(
      '2 + 2',
      [{ step: '2 + 2', result: '4' }],
      '4',
      'arithmetic',
    );

    // 2. Close dbService
    dbService.close();

    // 3. Re-open and verify persistence
    const dbService2 = new DatabaseService(dbPath);
    const db2 = dbService2.connect();
    const repo2 = new SqliteReasoningRepository(db2);

    const loaded = repo2.getTaskById(mathTask.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.query).toBe('2 + 2');
    expect(loaded!.finalConclusion).toContain('4');
    expect(loaded!.compositeConfidence).toBe(0.99);

    dbService2.close();

    // 4. Start backend server and test REST endpoints
    const config = createDefaultConfig();
    config.databasePath = dbPath;
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);

    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Test POST /api/ape/reasoning/deduce
    const deduceRes = await fetch(`${baseUrl}/api/ape/reasoning/deduce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        premises: [
          { id: 'p1', statement: 'All cats are felines', truthValue: 'true' },
          { id: 'p2', statement: 'Luna is a cat', truthValue: 'true' },
        ],
        query: 'Luna is a feline',
        domain: 'biology',
      }),
    });
    expect(deduceRes.status).toBe(201);
    const deduceJson = (await deduceRes.json()) as any;
    expect(deduceJson.success).toBe(true);
    expect(deduceJson.task.primaryParadigm).toBe('deductive');

    // Test POST /api/ape/reasoning/evaluate-argument
    const evalRes = await fetch(`${baseUrl}/api/ape/reasoning/evaluate-argument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        premises: [{ id: 'p1', statement: 'Statement A', truthValue: 'true' }],
        conclusion: 'Statement A',
      }),
    });
    expect(evalRes.status).toBe(200);
    const evalJson = (await evalRes.json()) as any;
    expect(evalJson.evaluation.identifiedFallacies).toContain('circular_reasoning');

    // Test GET /api/ape/reasoning/summary
    const sumRes = await fetch(`${baseUrl}/api/ape/reasoning/summary`);
    expect(sumRes.status).toBe(200);
    const sumJson = (await sumRes.json()) as any;
    expect(sumJson.totalReasoningTasks).toBeGreaterThanOrEqual(2);

    // Verify ApeService prompt context includes reasoning line
    const apeService = (server as any).apeService as ApeService;
    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('General Diverse Reasoning:');
    expect(promptContext).toContain('Epistemic humility, uncertainty rigorously calibrated');
  });
});
