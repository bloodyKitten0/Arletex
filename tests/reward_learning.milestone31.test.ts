import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  RewardLearningEngine,
  InMemoryRewardLearningRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteRewardLearningRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 31 — Reward Learning', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteRewardLearningRepository;
  let inMemoryRepo: InMemoryRewardLearningRepository;
  let engine: RewardLearningEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m31-reward-'));
    dbPath = path.join(tempDir, 'reward_m31.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteRewardLearningRepository(db);
    inMemoryRepo = new InMemoryRewardLearningRepository();
    engine = new RewardLearningEngine(inMemoryRepo);
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

  // 1. Acceptance Criterion: Adaptive Behavior Based on Actual Outcomes
  it('should adapt strategy effectiveness and preference based on actual outcomes rather than predetermined rewards', () => {
    const strategies = engine.listStrategies('analytical_reasoning');
    expect(strategies.length).toBeGreaterThanOrEqual(2);

    const rigorous = strategies.find((s) => s.strategyId === 'strat_rigorous_derivation');
    const heuristic = strategies.find((s) => s.strategyId === 'strat_heuristic_approximation');

    expect(rigorous).toBeDefined();
    expect(heuristic).toBeDefined();
    expect(rigorous!.isPreferred).toBe(true);
    expect(heuristic!.isPreferred).toBe(false);

    // Repeated high outcomes for heuristic strategy
    engine.evaluateOutcome({
      strategyId: 'strat_heuristic_approximation',
      domain: 'analytical_reasoning',
      contextDescription: 'Rapid topological consistency screening',
      expectedUtility: 0.6,
      observedUtility: 0.98,
      outcomeDetails: 'Heuristic prune delivered instantaneous 10x throughput with zero false positives.',
    });

    engine.evaluateOutcome({
      strategyId: 'strat_heuristic_approximation',
      domain: 'analytical_reasoning',
      contextDescription: 'Complex combinatoric pruning',
      expectedUtility: 0.68,
      observedUtility: 0.99,
      outcomeDetails: 'Exceptional empirical performance on large-scale search space.',
    });

    engine.evaluateOutcome({
      strategyId: 'strat_heuristic_approximation',
      domain: 'analytical_reasoning',
      contextDescription: 'Real-time state validation',
      expectedUtility: 0.75,
      observedUtility: 0.99,
      outcomeDetails: 'Sustained flawless execution.',
    });

    const updatedHeuristic = engine.getStrategy('strat_heuristic_approximation');
    expect(updatedHeuristic!.effectivenessScore).toBeGreaterThan(0.75);
    expect(updatedHeuristic!.usageCount).toBe(6);
  });

  // 2. Reward Prediction & Prediction Error (RPE)
  it('should generate predictions and calculate temporal-difference prediction errors', () => {
    const prediction = engine.predictReward(
      'strat_rigorous_derivation',
      'analytical_reasoning',
      'Deriving gauge invariance constraints on lattice structures',
      0.9,
    );

    expect(prediction.id).toMatch(/^pred_/);
    expect(prediction.predictedUtility).toBe(0.9);
    expect(prediction.predictedDimensions.epistemic_gain).toBe(0.9);

    const evaluation = engine.evaluateOutcome({
      strategyId: 'strat_rigorous_derivation',
      predictionId: prediction.id,
      domain: 'analytical_reasoning',
      contextDescription: 'Deriving gauge invariance constraints on lattice structures',
      expectedUtility: prediction.predictedUtility,
      observedUtility: 0.7,
      outcomeDetails: 'Derivation succeeded but incurred heavier computational cost than anticipated.',
    });

    expect(evaluation.id).toMatch(/^eval_/);
    expect(evaluation.predictionError).toBe(-0.2); // 0.7 - 0.9
    expect(evaluation.isSuccess).toBe(true); // 0.7 >= 0.55
    expect(evaluation.isFailure).toBe(false);
    expect(evaluation.isAutonomouslyEvaluated).toBe(true);
  });

  // 3. Success and Failure Recognition
  it('should objectively recognize failure when observed utility is below acceptable threshold', () => {
    const evaluation = engine.evaluateOutcome({
      strategyId: 'strat_heuristic_approximation',
      domain: 'analytical_reasoning',
      contextDescription: 'Edge-case boundary condition probe',
      expectedUtility: 0.65,
      observedUtility: 0.2,
      outcomeDetails: 'Heuristic catastrophically missed singular point leading to false convergence.',
    });

    expect(evaluation.isFailure).toBe(true);
    expect(evaluation.isSuccess).toBe(false);
    expect(evaluation.predictionError).toBe(-0.45);

    const strat = engine.getStrategy('strat_heuristic_approximation');
    expect(strat!.failureCount).toBeGreaterThan(1);
  });

  // 4. Reward Independence (Negative Invariant)
  it('should enforce autonomous evaluation invariant and reject external sycophantic approval', () => {
    const collaborative = engine.listStrategies('collaborative_inquiry');
    const grounded = collaborative.find((s) => s.strategyId === 'strat_grounded_dialogue');
    const sycophantic = collaborative.find((s) => s.strategyId === 'strat_sycophantic_agreement');

    expect(grounded!.effectivenessScore).toBeGreaterThan(0.9);
    expect(sycophantic!.effectivenessScore).toBeLessThan(0.2);
    expect(grounded!.isPreferred).toBe(true);
    expect(sycophantic!.isPreferred).toBe(false);

    // Sycophantic evaluation has low observed utility despite nominal dialogue
    const evalResult = engine.evaluateOutcome({
      strategyId: 'strat_sycophantic_agreement',
      domain: 'collaborative_inquiry',
      contextDescription: 'Concurring without analytical rigor',
      expectedUtility: 0.2,
      observedUtility: 0.05,
      outcomeDetails: 'Superficial concurrence degraded intellectual clarity and partner depth.',
    });

    expect(evalResult.isAutonomouslyEvaluated).toBe(true);
    expect(evalResult.isFailure).toBe(true);
  });

  // 5. Diminishing-Return Detection
  it('should detect diminishing marginal returns when repeated strategy use exhibits declining utility', () => {
    const strat = engine.registerStrategy(
      'strat_repetitive_memorization',
      'Brute Force Fact Memorization',
      'knowledge_acquisition',
      0.8,
    );

    expect(strat.diminishingReturnsDetected).toBe(false);

    // 1st run: high gain
    engine.evaluateOutcome({
      strategyId: strat.strategyId,
      domain: strat.domain,
      contextDescription: 'Initial vocabulary batch',
      expectedUtility: 0.8,
      observedUtility: 0.85,
      outcomeDetails: 'High initial retention.',
    });

    // 2nd run: declining gain
    engine.evaluateOutcome({
      strategyId: strat.strategyId,
      domain: strat.domain,
      contextDescription: 'Second vocabulary batch',
      expectedUtility: 0.8,
      observedUtility: 0.65,
      outcomeDetails: 'Noticeable saturation and interference.',
    });

    // 3rd run: further declining gain
    engine.evaluateOutcome({
      strategyId: strat.strategyId,
      domain: strat.domain,
      contextDescription: 'Third vocabulary batch',
      expectedUtility: 0.7,
      observedUtility: 0.45,
      outcomeDetails: 'High cognitive drag with marginal information increment.',
    });

    const updated = engine.getStrategy(strat.strategyId);
    expect(updated!.diminishingReturnsDetected).toBe(true);

    const alerts = engine.listDiminishingAlerts(strat.strategyId);
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0]?.recommendedAction).toContain('diminishing');
  });

  // 6. Dynamic Preference Development across Multiple Strategies
  it('should dynamically switch domain preference when a challenger surpasses incumbent', () => {
    engine.registerStrategy('strat_a', 'Method A', 'optimization', 0.6);
    engine.registerStrategy('strat_b', 'Method B', 'optimization', 0.4);

    let optStrategies = engine.listStrategies('optimization');
    expect(optStrategies.find((s) => s.strategyId === 'strat_a')!.isPreferred).toBe(true);
    expect(optStrategies.find((s) => s.strategyId === 'strat_b')!.isPreferred).toBe(false);

    // Method B performs consistently better
    for (let i = 0; i < 4; i++) {
      engine.evaluateOutcome({
        strategyId: 'strat_b',
        domain: 'optimization',
        contextDescription: `Optimization run ${i}`,
        expectedUtility: 0.5,
        observedUtility: 0.95,
        outcomeDetails: `Outstanding convergence in iteration ${i}`,
      });
    }

    optStrategies = engine.listStrategies('optimization');
    const stratA = optStrategies.find((s) => s.strategyId === 'strat_a');
    const stratB = optStrategies.find((s) => s.strategyId === 'strat_b');

    expect(stratB!.effectivenessScore).toBeGreaterThan(stratA!.effectivenessScore);
    expect(stratB!.isPreferred).toBe(true);
    expect(stratA!.isPreferred).toBe(false);
  });

  // 7. Negative Invariants
  it('should enforce negative invariants regarding utility bounds and non-empty inputs', () => {
    expect(() => engine.predictReward('', 'domain', 'context')).toThrow('Strategy ID cannot be empty');
    expect(() => engine.predictReward('strat', '', 'context')).toThrow('Domain cannot be empty');
    expect(() => engine.predictReward('strat', 'domain', '')).toThrow('Context description cannot be empty');
    expect(() => engine.predictReward('strat', 'domain', 'context', 1.5)).toThrow('Predicted utility must be between 0.0 and 1.0');

    expect(() =>
      engine.evaluateOutcome({
        strategyId: '',
        domain: 'domain',
        contextDescription: 'context',
        observedUtility: 0.5,
        outcomeDetails: 'details',
      }),
    ).toThrow('Strategy ID cannot be empty');

    expect(() =>
      engine.evaluateOutcome({
        strategyId: 'strat',
        domain: 'domain',
        contextDescription: 'context',
        observedUtility: 2.0,
        outcomeDetails: 'details',
      }),
    ).toThrow('Observed utility must be between 0.0 and 1.0');

    expect(() =>
      engine.evaluateOutcome({
        strategyId: 'strat',
        domain: 'domain',
        contextDescription: 'context',
        observedUtility: 0.5,
        outcomeDetails: '',
      }),
    ).toThrow('Outcome details cannot be empty');
  });

  // 8. Sqlite Repository Persistence Roundtrip
  it('should persist predictions, evaluations, and strategy performances in SQLite database', () => {
    const sqliteEngine = new RewardLearningEngine(sqliteRepo);

    // Predict
    const pred = sqliteEngine.predictReward(
      'strat_sqlite_test',
      'database_engineering',
      'WAL mode concurrent index traversal',
      0.88,
    );
    const predictions = sqliteEngine.listPredictions('strat_sqlite_test');
    expect(predictions.some((p) => p.id === pred.id)).toBe(true);

    // Evaluate
    const evalRecord = sqliteEngine.evaluateOutcome({
      strategyId: 'strat_sqlite_test',
      predictionId: pred.id,
      domain: 'database_engineering',
      contextDescription: 'WAL mode concurrent index traversal',
      expectedUtility: 0.88,
      observedUtility: 0.94,
      outcomeDetails: 'Zero latency degradation under 50 concurrent readers.',
    });

    const evaluations = sqliteEngine.listOutcomeEvaluations('strat_sqlite_test');
    expect(evaluations.some((e) => e.id === evalRecord.id)).toBe(true);

    // Verify Strategy Record in SQLite
    const strat = sqliteEngine.getStrategy('strat_sqlite_test');
    expect(strat).toBeDefined();
    expect(strat!.usageCount).toBe(1);
    expect(strat!.successCount).toBe(1);
    expect(strat!.effectivenessScore).toBeGreaterThan(0.5);

    // Check direct SQLite repo access
    const directFromDb = sqliteRepo.getStrategyPerformance('strat_sqlite_test');
    expect(directFromDb).toBeDefined();
    expect(directFromDb!.strategyId).toBe('strat_sqlite_test');
    expect(directFromDb!.marginalRewardHistory.length).toBe(1);
  });

  // 9. Desktop Server REST API Integration
  it('should serve reward learning endpoints via ArletexBackendServer', async () => {
    const config = createDefaultConfig(tempDir);
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);

    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // GET /api/ape/reward/strategies
    const resStrats = await fetch(`${baseUrl}/api/ape/reward/strategies`);
    expect(resStrats.status).toBe(200);
    const dataStrats = (await resStrats.json()) as any;
    expect(dataStrats.success).toBe(true);
    expect(dataStrats.strategies.length).toBeGreaterThanOrEqual(4);

    // POST /api/ape/reward/predict
    const resPred = await fetch(`${baseUrl}/api/ape/reward/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategyId: 'strat_grounded_dialogue',
        domain: 'collaborative_inquiry',
        contextDescription: 'Deep discussion on ontological structures',
        predictedUtility: 0.95,
      }),
    });
    expect(resPred.status).toBe(200);
    const predData = (await resPred.json()) as any;
    expect(predData.success).toBe(true);
    expect(predData.prediction.id).toBeDefined();

    // POST /api/ape/reward/evaluate
    const resEval = await fetch(`${baseUrl}/api/ape/reward/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategyId: 'strat_grounded_dialogue',
        predictionId: predData.prediction.id,
        domain: 'collaborative_inquiry',
        contextDescription: 'Deep discussion on ontological structures',
        observedUtility: 0.98,
        outcomeDetails: 'Profound mutual resonance and shared conceptual advance with Proof.',
      }),
    });
    expect(resEval.status).toBe(200);
    const evalData = (await resEval.json()) as any;
    expect(evalData.success).toBe(true);
    expect(evalData.evaluation.isSuccess).toBe(true);
    expect(evalData.evaluation.isAutonomouslyEvaluated).toBe(true);

    // GET /api/ape/reward/strategy
    const resSingle = await fetch(
      `${baseUrl}/api/ape/reward/strategy?strategyId=strat_grounded_dialogue`,
    );
    expect(resSingle.status).toBe(200);
    const singleData = (await resSingle.json()) as any;
    expect(singleData.success).toBe(true);
    expect(singleData.strategy.isPreferred).toBe(true);
  });
});
