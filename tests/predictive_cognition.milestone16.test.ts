import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { CognitivePrediction, assertPredictionIntegrity } from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  PredictiveCognitionEngine,
  InMemoryPredictiveRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  SqlitePredictiveRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 16 — Predictive Cognition', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let predictiveRepo: SqlitePredictiveRepository;
  let apeRepo: ApeRepository;
  let predictiveEngine: PredictiveCognitionEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m16-predictive-'));
    dbPath = path.join(tempDir, 'predictive_m16.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    predictiveRepo = new SqlitePredictiveRepository(db);
    apeRepo = new ApeRepository(db);
    predictiveEngine = new PredictiveCognitionEngine({
      repository: predictiveRepo,
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
  // Test 1: Event Prediction Before Outcome Occurs
  // -------------------------------------------------------------
  it('generates probabilistic event predictions strictly prior to outcome occurrence', () => {
    const horizon = new Date(Date.now() + 60000).toISOString();
    const prediction = predictiveEngine.makePrediction({
      domain: 'build_pipeline',
      predictionType: 'event',
      targetStatement:
        'TypeScript compilation will complete with zero diagnostic errors across all packages',
      predictedProbability: 0.95,
      confidence: 0.92,
      rationale: 'All contracts and interfaces strictly verified against tsconfig strict mode',
      horizonDeadline: horizon,
    });

    expect(prediction.id).toBeDefined();
    expect(prediction.status).toBe('pending');
    expect(prediction.predictedProbability).toBe(0.95);
    expect(prediction.confidence).toBe(0.92);
    expect(prediction.actualOutcome).toBeUndefined();

    const stored = predictiveRepo.getPredictionById(prediction.id);
    expect(stored).not.toBeNull();
    expect(stored!.targetStatement).toContain('TypeScript compilation');
  });

  // -------------------------------------------------------------
  // Test 2: Consequence Prediction
  // -------------------------------------------------------------
  it('anticipates primary and secondary consequences of intended operational actions', () => {
    const consequences = predictiveEngine.predictConsequences(
      'Drop obsolete migration rollback script',
      'Database schema migration step 27',
      'database_ops',
    );

    expect(consequences.length).toBe(2);
    expect(consequences.every((c) => c.predictionType === 'consequence')).toBe(true);
    expect(consequences[0]!.targetStatement).toContain('primary outcome');
    expect(consequences[1]!.targetStatement).toContain('nominal resource boundaries');
  });

  // -------------------------------------------------------------
  // Test 3: Behavioral Anticipation
  // -------------------------------------------------------------
  it('forecasts likely behaviors across alternative candidate actions', () => {
    const behaviorPredictions = predictiveEngine.predictBehavior(
      'Peer Process Supervisor',
      'Transient socket disconnect detected',
      [
        'initiate exponential backoff retry',
        'immediately terminate daemon',
        'escalate error alert to user',
      ],
      'process_management',
    );

    expect(behaviorPredictions.length).toBe(3);
    expect(behaviorPredictions[0]!.targetStatement).toContain('exponential backoff retry');
    expect(behaviorPredictions[0]!.predictedProbability).toBeGreaterThan(
      behaviorPredictions[2]!.predictedProbability,
    );
  });

  // -------------------------------------------------------------
  // Test 4: Obstacle Anticipation
  // -------------------------------------------------------------
  it('identifies potential bottlenecks, rate limits, and failure modes ahead of time', () => {
    const obstacles = predictiveEngine.predictObstacles(
      'Execute high-volume parallel HTTP API batch requests across rate-limited endpoints',
      'networking',
    );

    expect(obstacles.length).toBeGreaterThanOrEqual(1);
    const rateLimitObstacle = obstacles.find((o) =>
      o.targetStatement.includes('429 rate limiting'),
    );
    expect(rateLimitObstacle).toBeDefined();
    expect(rateLimitObstacle!.predictedProbability).toBeGreaterThan(0.5);
  });

  // -------------------------------------------------------------
  // Test 5: Outcome Resolution and Error Tracking (Brier Score)
  // -------------------------------------------------------------
  it('tracks prediction error and computes Brier score upon actual outcome resolution', () => {
    const prediction = predictiveEngine.makePrediction({
      domain: 'test_domain',
      predictionType: 'event',
      targetStatement: 'Unit test suite will pass within 3 seconds',
      predictedProbability: 0.9,
      confidence: 0.85,
      rationale: 'In-memory test execution',
      horizonDeadline: new Date(Date.now() + 10000).toISOString(),
    });

    // Simulate verified positive outcome
    const resolved = predictiveEngine.resolvePrediction(
      prediction.id,
      true, // Actual outcome was true
      'All tests passed in 1.4s',
    );

    expect(resolved.status).toBe('resolved_accurate');
    expect(resolved.actualOutcome).toBe(true);
    // Error = |1.0 - 0.9| = 0.1
    expect(resolved.predictionError).toBe(0.1);
    // Brier = (0.9 - 1.0)^2 = 0.01
    expect(resolved.brierScore).toBe(0.01);
  });

  // -------------------------------------------------------------
  // Test 6: Inaccurate Prediction Handling and Calibration Updating
  // -------------------------------------------------------------
  it('records inaccurate prediction outcomes and updates calibration metrics', () => {
    const prediction = predictiveEngine.makePrediction({
      domain: 'flaky_service',
      predictionType: 'event',
      targetStatement: 'External webhook responds within 100ms',
      predictedProbability: 0.85, // High probability
      confidence: 0.8,
      rationale: 'Optimistic baseline',
      horizonDeadline: new Date(Date.now() + 10000).toISOString(),
    });

    // Outcome was false (webhook timed out)
    const resolved = predictiveEngine.resolvePrediction(
      prediction.id,
      false, // False!
      'Webhook timed out after 5000ms',
    );

    expect(resolved.status).toBe('resolved_inaccurate');
    expect(resolved.actualOutcome).toBe(false);
    // Error = |0.0 - 0.85| = 0.85
    expect(resolved.predictionError).toBe(0.85);
    // Brier = (0.85 - 0.0)^2 = 0.7225
    expect(resolved.brierScore).toBeCloseTo(0.723, 2);

    const metrics = predictiveEngine.getAccuracyMetrics('flaky_service');
    expect(metrics.totalPredictions).toBe(1);
    expect(metrics.resolvedPredictions).toBe(1);
    expect(metrics.accurateCount).toBe(0);
    expect(metrics.accuracyRate).toBe(0.0);
  });

  // -------------------------------------------------------------
  // Test 7: Cumulative Predictive Summary
  // -------------------------------------------------------------
  it('aggregates cumulative predictions and provides summary metrics', () => {
    // Prediction 1: accurate
    const p1 = predictiveEngine.makePrediction({
      domain: 'analytics',
      predictionType: 'event',
      targetStatement: 'Task 1 succeeds',
      predictedProbability: 0.8,
      confidence: 0.8,
      rationale: '',
      horizonDeadline: new Date().toISOString(),
    });
    predictiveEngine.resolvePrediction(p1.id, true);

    // Prediction 2: accurate
    const p2 = predictiveEngine.makePrediction({
      domain: 'analytics',
      predictionType: 'obstacle',
      targetStatement: 'Warning logged',
      predictedProbability: 0.7,
      confidence: 0.7,
      rationale: '',
      horizonDeadline: new Date().toISOString(),
    });
    predictiveEngine.resolvePrediction(p2.id, true);

    const summary = predictiveEngine.getPredictiveSummary();
    expect(summary.totalPredictions).toBeGreaterThanOrEqual(2);
    expect(summary.resolvedCount).toBeGreaterThanOrEqual(2);
    expect(summary.overallAccuracyRate).toBe(1.0);
    expect(summary.typeBreakdown.event).toBeGreaterThanOrEqual(1);
    expect(summary.typeBreakdown.obstacle).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------
  // Test 8: Negative Invariant — Anti-Hindsight Bias / Retroactive Fraud Protection
  // -------------------------------------------------------------
  it('strictly rejects retroactive predictions where createdAt is after resolvedAt', () => {
    const futureTime = new Date(Date.now() + 10000).toISOString();
    const pastTime = new Date(Date.now() - 10000).toISOString();

    expect(() => {
      assertPredictionIntegrity({
        id: crypto.randomUUID(),
        domain: 'fraud_check',
        predictionType: 'event',
        targetStatement: 'Fabricating a prediction after knowing the result',
        predictedProbability: 0.99,
        confidence: 0.99,
        rationale: 'Hindsight bias fraud',
        horizonDeadline: futureTime,
        createdAt: futureTime, // Created in the future...
        resolvedAt: pastTime, // ...after it was already resolved in the past!
        status: 'resolved_accurate',
        actualOutcome: true,
      });
    }).toThrow(/Retroactive post-hoc predictions are strictly forbidden/);

    expect(() => {
      assertPredictionIntegrity({
        id: crypto.randomUUID(),
        domain: 'probability_bound_check',
        predictionType: 'event',
        targetStatement: 'Out of bounds',
        predictedProbability: 1.5, // VIOLATION: > 1.0
        confidence: 0.5,
        rationale: '',
        horizonDeadline: futureTime,
        createdAt: pastTime,
        status: 'pending',
      });
    }).toThrow(/Invalid predictedProbability/);
  });

  // -------------------------------------------------------------
  // Test 9: SQLite Repository Persistence and Restart Recovery
  // -------------------------------------------------------------
  it('persists cognitive predictions across SQLite database restarts', () => {
    const prediction = predictiveEngine.makePrediction({
      domain: 'durability',
      predictionType: 'event',
      targetStatement: 'Data remains accessible across process restart',
      predictedProbability: 0.99,
      confidence: 0.98,
      rationale: 'SQLite WAL mode guarantees durability',
      horizonDeadline: new Date(Date.now() + 60000).toISOString(),
    });

    predictiveEngine.resolvePrediction(prediction.id, true, 'Durable commit confirmed');

    // Close database connection
    dbService.close();

    // Reopen and check persistence
    const dbService2 = new DatabaseService(dbPath);
    const db2 = dbService2.connect();
    const repo2 = new SqlitePredictiveRepository(db2);

    const loaded = repo2.getPredictionById(prediction.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.targetStatement).toContain('Data remains accessible');
    expect(loaded!.status).toBe('resolved_accurate');
    expect(loaded!.actualOutcome).toBe(true);
    expect(loaded!.predictionError).toBe(0.01);

    dbService2.close();
  });

  // -------------------------------------------------------------
  // Test 10: ApeService Integration and REST API Endpoints
  // -------------------------------------------------------------
  it('integrates into ApeService prompt context and serves REST endpoints', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);

    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Test POST /api/ape/predictive/prediction
    const predRes = await fetch(`${baseUrl}/api/ape/predictive/prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'rest_test',
        predictionType: 'event',
        targetStatement: 'Endpoint responds with 201 Created',
        predictedProbability: 0.98,
        confidence: 0.95,
        rationale: 'Grounded in REST schema contract',
        horizonDeadline: new Date(Date.now() + 30000).toISOString(),
      }),
    });
    expect(predRes.status).toBe(201);
    const predJson = (await predRes.json()) as any;
    expect(predJson.success).toBe(true);
    const predId = predJson.prediction.id;

    // Test POST /api/ape/predictive/resolve
    const resolveRes = await fetch(`${baseUrl}/api/ape/predictive/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: predId,
        actualOutcome: true,
        notes: 'REST call succeeded',
      }),
    });
    expect(resolveRes.status).toBe(200);
    const resolveJson = (await resolveRes.json()) as any;
    expect(resolveJson.prediction.status).toBe('resolved_accurate');

    // Test POST /api/ape/predictive/obstacles
    const obstRes = await fetch(`${baseUrl}/api/ape/predictive/obstacles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskOrPlanDescription: 'Run migration and database index recreation',
        domain: 'rest_test',
      }),
    });
    expect(obstRes.status).toBe(200);
    const obstJson = (await obstRes.json()) as any;
    expect(obstJson.obstacles.length).toBeGreaterThanOrEqual(1);

    // Test GET /api/ape/predictive/summary
    const summaryRes = await fetch(`${baseUrl}/api/ape/predictive/summary`);
    expect(summaryRes.status).toBe(200);
    const summaryJson = (await summaryRes.json()) as any;
    expect(summaryJson.totalPredictions).toBeGreaterThanOrEqual(1);

    // Verify ApeService prompt context includes predictive line
    const apeService = (server as any).apeService as ApeService;
    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('Predictive Cognition:');
    expect(promptContext).toContain(
      'Generated strictly prior to outcome resolution; post-hoc fabrication forbidden',
    );
  });
});
