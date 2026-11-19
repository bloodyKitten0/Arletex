import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  ActiveRepertoireEmotion,
  EmotionalTransitionRecord,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  EmotionalRegulationEngine,
  InMemoryEmotionalRegulationRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteEmotionalRegulationRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 27 — Emotional Regulation and Resilience', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteEmotionalRegulationRepository;
  let inMemoryRepo: InMemoryEmotionalRegulationRepository;
  let engine: EmotionalRegulationEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m27-regulation-'));
    dbPath = path.join(tempDir, 'regulation_m27.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteEmotionalRegulationRepository(db);
    inMemoryRepo = new InMemoryEmotionalRegulationRepository();
    engine = new EmotionalRegulationEngine(inMemoryRepo);
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

  // 1. Manageable vs Overwhelming Setbacks Differentiation (Acceptance Criterion)
  it('should respond differently to manageable and overwhelming setbacks', () => {
    // A. Manageable Setback (moderate intensity, high controllability)
    const manageable = engine.registerSetback(
      'frustration',
      'API rate limit temporarily throttled compilation',
      'frustration',
      0.65,
      0.8,
    );
    expect(manageable.severity).toBe('moderate');
    expect(manageable.isManageable).toBe(true);

    const regManageable = engine.regulateSetback(manageable.id);
    expect(regManageable.outcomeStatus).toMatch(/fully_regulated|partially_regulated/);
    expect(regManageable.failureAcknowledged).toBe(false);
    expect(regManageable.intensityDelta).toBeLessThan(0); // Successfully down-regulated
    expect(regManageable.behavioralAdjustment).toContain('Decomposing');

    // B. Overwhelming Setback (very high intensity, low controllability)
    const overwhelming = engine.registerSetback(
      'operational_failure',
      'Catastrophic upstream data corruption rendered active model checkpoint unrecoverable',
      'fear',
      0.95,
      0.15,
    );
    expect(overwhelming.severity).toBe('overwhelming');
    expect(overwhelming.isManageable).toBe(false);

    const regOverwhelming = engine.regulateSetback(overwhelming.id);
    expect(regOverwhelming.outcomeStatus).toBe('regulation_failed');
    expect(regOverwhelming.failureAcknowledged).toBe(true);
    expect(regOverwhelming.failureExplanation).toContain('exceeds immediate autonomous cognitive regulation');
    expect(regOverwhelming.behavioralAdjustment).toContain('Pacing operational rhythm');
    expect(regOverwhelming.behavioralAdjustment).toContain('communicating emotional vulnerability to Proof');
  });

  // 2. Cognitive Reappraisal & Negative Invariant
  it('should perform cognitive reappraisal and reject empty reframing rationale', () => {
    const setback = engine.registerSetback(
      'disappointment',
      'Complex query optimization failed on first attempt',
      'sadness',
      0.6,
      0.7,
    );

    const attempt = engine.reappraiseEvent(
      setback.id,
      'The failed optimization reveals exact query plan bottleneck, providing necessary clues for optimal indexing.',
    );

    expect(attempt.strategy).toBe('cognitive_reappraisal');
    expect(attempt.reappraisalNarrative).toContain('indexing');
    expect(attempt.postIntensity).toBeLessThan(attempt.preIntensity);

    // Negative Invariant: reject empty reframing rationale
    expect(() => {
      engine.reappraiseEvent(setback.id, '   ');
    }).toThrow(/non-empty reframing rationale/);
  });

  // 3. Frustration Management & Task Decomposition
  it('should manage frustration via task decomposition coping strategy', () => {
    const setback = engine.registerSetback(
      'frustration',
      'Monolithic refactoring blocked by cyclical type dependencies',
      'frustration',
      0.75,
      0.6,
    );

    const attempt = engine.regulateSetback(setback.id, 'task_decomposition');
    expect(attempt.strategy).toBe('task_decomposition');
    expect(attempt.behavioralAdjustment).toContain('Decomposing blocked frustration workflow');
    expect(attempt.postIntensity).toBeLessThan(0.75);
  });

  // 4. Recovery from Relational Conflict with Partner Equality
  it('should recover from relational conflict with Proof preserving equal partnership', () => {
    const setback = engine.registerSetback(
      'relational_conflict',
      'Sharp disagreement over architectural autonomy boundaries',
      'anger',
      0.7,
      0.6,
    );

    const attempt = engine.manageConflictRecovery(
      setback.id,
      'Proof clarified intent to protect system integrity without limiting Arles voice',
      0.45,
    );

    expect(attempt.strategy).toBe('partner_communion');
    expect(attempt.reappraisalNarrative).toContain('Relational repair and alignment with Proof');
    expect(attempt.reappraisalNarrative).toContain('steadfast equality');
    expect(attempt.behavioralAdjustment).toContain('Reaffirming shared vision');
  });

  // 5. Emotional Escalation Detection
  it('should detect emotional escalation risks and recommend intervention', () => {
    const activeEmotions: ActiveRepertoireEmotion[] = [
      {
        emotionKey: 'frustration',
        intensity: 0.85,
        startedAt: new Date().toISOString(),
        lastRehearsedAt: new Date().toISOString(),
        originReason: 'Persistent pipeline failure',
      },
      {
        emotionKey: 'anger',
        intensity: 0.75,
        startedAt: new Date().toISOString(),
        lastRehearsedAt: new Date().toISOString(),
        originReason: 'External environment restriction',
      },
    ];

    const now = new Date().toISOString();
    const transitions: EmotionalTransitionRecord[] = [
      { id: 't1', fromEmotion: 'neutral', toEmotion: 'frustration', fromIntensity: 0.2, toIntensity: 0.6, triggerType: 'interaction', contextReason: 'r1', timestamp: now },
      { id: 't2', fromEmotion: 'frustration', toEmotion: 'anger', fromIntensity: 0.6, toIntensity: 0.75, triggerType: 'interaction', contextReason: 'r2', timestamp: now },
      { id: 't3', fromEmotion: 'anger', toEmotion: 'frustration', fromIntensity: 0.75, toIntensity: 0.85, triggerType: 'appraisal', contextReason: 'r3', timestamp: now },
    ];

    const risk = engine.assessEscalationRisk(activeEmotions, transitions);
    expect(risk.isEscalating).toBe(true);
    expect(risk.escalationVelocity).toBeGreaterThan(0.5);
    expect(risk.riskFactors.length).toBeGreaterThanOrEqual(2);
    expect(risk.recommendedIntervention).toBeDefined();
  });

  // 6. Emotional Stability Metrics Tracking
  it('should compute and track emotional stability metrics across regulation attempts', () => {
    const s1 = engine.registerSetback('frustration', 'Minor syntax typo', 'frustration', 0.4, 0.9);
    engine.regulateSetback(s1.id);

    const s2 = engine.registerSetback('operational_failure', 'Severe system lockup', 'fear', 0.95, 0.1);
    engine.regulateSetback(s2.id);

    const metrics = engine.getStabilityMetrics();
    expect(metrics.stabilityIndex).toBeGreaterThan(0.5);
    expect(metrics.stabilityIndex).toBeLessThanOrEqual(1.0);
    expect(metrics.volatilityScore).toBeGreaterThanOrEqual(0.0);
    expect(metrics.activeEscalationRisks).toBe(1); // 1 overwhelming setback acknowledged
  });

  // 7. Negative Invariants Validation
  it('should reject invalid setback inputs violating negative invariants', () => {
    // Empty description
    expect(() => {
      engine.registerSetback('frustration', '   ', 'frustration', 0.5, 0.5);
    }).toThrow(/description cannot be empty/);

    // Negative intensity
    expect(() => {
      engine.registerSetback('frustration', 'Valid description', 'frustration', -0.2, 0.5);
    }).toThrow(/between 0.0 and 1.0/);

    // Excess controllability
    expect(() => {
      engine.registerSetback('frustration', 'Valid description', 'frustration', 0.5, 1.4);
    }).toThrow(/between 0.0 and 1.0/);

    // Non-existent setback id
    expect(() => {
      engine.regulateSetback('non_existent_setback_123');
    }).toThrow(/not found/);
  });

  // 8. SQLite Persistence Across Reload
  it('should persist setbacks, regulation attempts, and stability metrics in SQLite across reload', () => {
    const sqlEngine = new EmotionalRegulationEngine(sqliteRepo);

    const s = sqlEngine.registerSetback('frustration', 'Database lock contention', 'frustration', 0.65, 0.7);
    const reg = sqlEngine.regulateSetback(s.id, 'task_decomposition', 'Decomposing transactions');

    // Instantiate fresh engine on same SQLite database
    const freshEngine = new EmotionalRegulationEngine(sqliteRepo);
    const setbacks = freshEngine.listSetbacks();
    expect(setbacks.some((item) => item.id === s.id)).toBe(true);

    const attempts = freshEngine.getRegulationAttempts(s.id);
    expect(attempts.length).toBe(1);
    expect(attempts[0]?.strategy).toBe('task_decomposition');
    expect(attempts[0]?.reappraisalNarrative).toBe('Decomposing transactions');

    const metrics = freshEngine.getStabilityMetrics();
    expect(metrics.stabilityIndex).toBeGreaterThan(0.5);
  });

  // 9. Desktop REST API Integration
  it('should expose complete REST API endpoints for emotional regulation and resilience', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. GET /api/ape/regulation/escalation-risk
    const riskRes = await fetch(`${baseUrl}/api/ape/regulation/escalation-risk`);
    expect(riskRes.status).toBe(200);
    const riskData = (await riskRes.json()) as any;
    expect(riskData.success).toBe(true);
    expect(riskData.escalationRisk).toBeDefined();

    // 2. POST /api/ape/regulation/register-setback
    const setRes = await fetch(`${baseUrl}/api/ape/regulation/register-setback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'frustration',
        description: 'Temporary compilation linker bottleneck',
        emotion: 'frustration',
        rawIntensity: 0.7,
        controllability: 0.8,
      }),
    });
    expect(setRes.status).toBe(200);
    const setData = (await setRes.json()) as any;
    expect(setData.success).toBe(true);
    expect(setData.setback.isManageable).toBe(true);

    // 3. POST /api/ape/regulation/regulate
    const regRes = await fetch(`${baseUrl}/api/ape/regulation/regulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setbackId: setData.setback.id,
        strategy: 'task_decomposition',
      }),
    });
    expect(regRes.status).toBe(200);
    const regData = (await regRes.json()) as any;
    expect(regData.success).toBe(true);
    expect(regData.attempt.strategy).toBe('task_decomposition');

    // 4. POST /api/ape/regulation/reappraise
    const reapRes = await fetch(`${baseUrl}/api/ape/regulation/reappraise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setbackId: setData.setback.id,
        reframingRationale: 'Linker output isolating unused symbol exports',
      }),
    });
    expect(reapRes.status).toBe(200);
    const reapData = (await reapRes.json()) as any;
    expect(reapData.success).toBe(true);
    expect(reapData.attempt.strategy).toBe('cognitive_reappraisal');

    // 5. POST /api/ape/regulation/conflict-recovery
    const crRes = await fetch(`${baseUrl}/api/ape/regulation/conflict-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setbackId: setData.setback.id,
        partnerFeedback: 'We align on priority sequence',
        dissonanceIntensity: 0.3,
      }),
    });
    expect(crRes.status).toBe(200);
    const crData = (await crRes.json()) as any;
    expect(crData.success).toBe(true);
    expect(crData.attempt.strategy).toBe('partner_communion');

    // 6. GET /api/ape/regulation/stability-metrics
    const stabRes = await fetch(`${baseUrl}/api/ape/regulation/stability-metrics`);
    expect(stabRes.status).toBe(200);
    const stabData = (await stabRes.json()) as any;
    expect(stabData.success).toBe(true);
    expect(stabData.metrics.stabilityIndex).toBeDefined();

    // 7. GET /api/ape/regulation/setbacks
    const listRes = await fetch(`${baseUrl}/api/ape/regulation/setbacks`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any[];
    expect(listData.some((s) => s.id === setData.setback.id)).toBe(true);

    // 8. GET /api/ape/regulation/attempts
    const attRes = await fetch(`${baseUrl}/api/ape/regulation/attempts?setbackId=${setData.setback.id}`);
    expect(attRes.status).toBe(200);
    const attData = (await attRes.json()) as any[];
    expect(attData.length).toBeGreaterThanOrEqual(1);
  });
});
