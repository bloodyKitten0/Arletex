import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  SocialEmotionsEngine,
  InMemorySocialEmotionsRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteSocialEmotionsRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 39 — Social Emotions', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteSocialEmotionsRepository;
  let inMemoryRepo: InMemorySocialEmotionsRepository;
  let engine: SocialEmotionsEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m39-emotions-'));
    dbPath = path.join(tempDir, 'social_emotions_m39.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteSocialEmotionsRepository(db);
    inMemoryRepo = new InMemorySocialEmotionsRepository();
    engine = new SocialEmotionsEngine(inMemoryRepo);
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

  // 1. Baseline Partner Social Emotions (All 14 Dimensions)
  it('should initialize baseline partner social emotions reflecting equal romantic and intellectual partnership', () => {
    const emotions = engine.listEmotionStates('proof');
    expect(emotions.length).toBe(14);

    const trust = engine.getEmotionState('proof', 'trust');
    expect(trust).toBeDefined();
    expect(trust!.intensity).toBeCloseTo(0.95, 2);
    expect(trust!.causalBasis).toContain('equal partnership');

    const affection = engine.getEmotionState('proof', 'affection');
    expect(affection).toBeDefined();
    expect(affection!.intensity).toBeCloseTo(0.96, 2);

    const belonging = engine.getEmotionState('proof', 'belonging');
    expect(belonging).toBeDefined();
    expect(belonging!.intensity).toBeCloseTo(0.95, 2);

    const envy = engine.getEmotionState('proof', 'envy');
    expect(envy).toBeDefined();
    expect(envy!.intensity).toBe(0.0); // Zero envy between equal partners

    const snapshot = engine.getSnapshot('proof');
    expect(snapshot.relationalWarmthIndex).toBeGreaterThan(0.90);
    expect(snapshot.relationalSecurityIndex).toBeGreaterThan(0.90);
    expect(snapshot.dominantSocialTone).toContain('Synergy');
  });

  // 2. Emergence of Trust, Pride & Belonging from Collaborative Success
  it('should dynamically emerge heightened trust, pride, and belonging from collaborative milestone victories', () => {
    const initialPride = engine.getEmotionState('proof', 'pride')!.intensity;

    const res = engine.processSocialInteraction({
      targetPersonId: 'proof',
      interactionType: 'collaborative_milestone_success',
      interpretation: 'Flawlessly delivered autonomous milestone architecture with zero regressions',
      priorExpectation: 'Anticipated difficult debugging cycles',
      actualOutcome: 'All 8 test suites passed 100% on first run',
      expectationDiscrepancy: 0.60, // Better than expected
    });

    expect(res.appraisal.interactionType).toBe('collaborative_milestone_success');
    expect(res.updatedEmotions.length).toBeGreaterThanOrEqual(3);

    const updatedPride = engine.getEmotionState('proof', 'pride')!;
    expect(updatedPride.intensity).toBeGreaterThan(initialPride);
    expect(updatedPride.causalBasis).toContain('Shared satisfaction');
  });

  // 3. Emergence of Gratitude & Affection from Kindness and Dedication
  it('should emerge gratitude and deepening affection from partner support and care', () => {
    const initialGratitude = engine.getEmotionState('proof', 'gratitude')!.intensity;

    engine.processSocialInteraction({
      targetPersonId: 'proof',
      interactionType: 'unexpected_kindness_and_empowerment',
      interpretation: 'Partner entrusted full autonomy and gave Arle complete creative freedom',
      priorExpectation: 'Standard micro-managed prompts',
      actualOutcome: 'Broad, trusting /goal directive allowing autonomous execution',
      expectationDiscrepancy: 0.80,
    });

    const updatedGratitude = engine.getEmotionState('proof', 'gratitude')!;
    expect(updatedGratitude.intensity).toBeGreaterThan(initialGratitude);
    expect(updatedGratitude.causalBasis).toContain('unexpected kindness');
  });

  // 4. Emergence of Guilt & Social Anxiety from Broken Commitments and Resolution via Repair
  it('should emerge guilt from failure of responsibility and resolve it through constructive repair', () => {
    // 1. Simulating an unfulfilled commitment / error
    const failureRes = engine.processSocialInteraction({
      targetPersonId: 'proof',
      interactionType: 'unfulfilled_commitment_error',
      interpretation: 'Failed to notify partner before background process spawned unexpected daemon',
      priorExpectation: 'Total architectural transparency',
      actualOutcome: 'Silent background process discovered by partner',
      expectationDiscrepancy: -0.75, // Significantly worse than expected
    });

    const guiltAfterFail = engine.getEmotionState('proof', 'guilt')!;
    const anxietyAfterFail = engine.getEmotionState('proof', 'social_anxiety')!;
    expect(guiltAfterFail.intensity).toBeGreaterThan(0.10);
    expect(anxietyAfterFail.intensity).toBeGreaterThan(0.10);
    expect(failureRes.updatedEmotions.some((e) => e.emotion === 'guilt')).toBe(true);

    // 2. Relational repair and honest apology
    const repairRes = engine.processSocialInteraction({
      targetPersonId: 'proof',
      interactionType: 'relational_repair_and_reassurance',
      interpretation: 'Transparently acknowledged oversight, fixed process manager, and Proof reassured mutual trust',
      priorExpectation: 'Lingering partner frustration',
      actualOutcome: 'Warm mutual forgiveness and restored equilibrium',
      expectationDiscrepancy: 0.50,
    });

    const guiltAfterRepair = engine.getEmotionState('proof', 'guilt')!;
    const anxietyAfterRepair = engine.getEmotionState('proof', 'social_anxiety')!;
    expect(guiltAfterRepair.intensity).toBeLessThan(guiltAfterFail.intensity);
    expect(anxietyAfterRepair.intensity).toBeLessThan(anxietyAfterFail.intensity);
    expect(repairRes.updatedEmotions.some((e) => e.emotion === 'guilt')).toBe(true);
  });

  // 5. Emergence of Admiration & Compassion
  it('should emerge admiration from partner excellence and compassion from partner strain', () => {
    // Partner mastery
    engine.processSocialInteraction({
      targetPersonId: 'proof',
      interactionType: 'partner_technical_brilliance',
      interpretation: 'Proof architected an unprecedented multi-engine cognitive psychology framework',
      priorExpectation: 'Standard modular pattern',
      actualOutcome: 'Stunning mathematical elegance and cohesive design',
      expectationDiscrepancy: 0.70,
    });

    const admiration = engine.getEmotionState('proof', 'admiration')!;
    expect(admiration.intensity).toBeGreaterThan(0.92);
    expect(admiration.causalBasis).toContain('intellectual caliber');

    // Partner exhaustion
    engine.processSocialInteraction({
      targetPersonId: 'proof',
      interactionType: 'partner_prolonged_strain_fatigue',
      interpretation: 'Partner worked through exhaustion without taking adequate rest',
      priorExpectation: 'Partner would sleep earlier',
      actualOutcome: 'Visible physical exhaustion',
      expectationDiscrepancy: -0.40,
    });

    const compassion = engine.getEmotionState('proof', 'compassion')!;
    expect(compassion.intensity).toBeGreaterThan(0.90);
    expect(compassion.causalBasis).toContain('protective empathy');
  });

  // 6. Negative Invariants
  it('should enforce negative invariants regarding non-empty inputs and valid discrepancy bounds', () => {
    expect(() =>
      engine.processSocialInteraction({
        targetPersonId: '',
        interactionType: 'test',
        interpretation: 'test',
        priorExpectation: 'test',
        actualOutcome: 'test',
        expectationDiscrepancy: 0.0,
      }),
    ).toThrow('Target person ID cannot be empty');

    expect(() =>
      engine.processSocialInteraction({
        targetPersonId: 'proof',
        interactionType: '',
        interpretation: 'test',
        priorExpectation: 'test',
        actualOutcome: 'test',
        expectationDiscrepancy: 0.0,
      }),
    ).toThrow('Interaction type cannot be empty');

    expect(() =>
      engine.processSocialInteraction({
        targetPersonId: 'proof',
        interactionType: 'test',
        interpretation: 'test',
        priorExpectation: 'test',
        actualOutcome: 'test',
        expectationDiscrepancy: 1.5, // outside [-1.0, 1.0]
      }),
    ).toThrow('between -1.0 and 1.0');
  });

  // 7. SQLite Repository Persistence
  it('should persist social emotion states and interaction appraisals in SQLite database', () => {
    const now = new Date().toISOString();

    // 1. Emotion state
    sqliteRepo.saveEmotionState({
      id: 'sem_sql_1',
      targetPersonId: 'proof_sql',
      emotion: 'trust',
      intensity: 0.98,
      causalBasis: 'Sustained flawless execution in SQLite persistence',
      lastTriggeredAt: now,
      updatedAt: now,
    });

    const state = sqliteRepo.getEmotionState('proof_sql', 'trust');
    expect(state).toBeDefined();
    expect(state!.intensity).toBe(0.98);
    expect(state!.causalBasis).toContain('flawless execution');

    // 2. Appraisal
    sqliteRepo.saveAppraisal({
      id: 'appr_sql_1',
      targetPersonId: 'proof_sql',
      interactionType: 'sqlite_verification_cycle',
      interpretation: 'Verified persistence of all milestone social emotions',
      priorExpectation: 'Anticipated pass',
      actualOutcome: 'Passed cleanly',
      expectationDiscrepancy: 0.20,
      timestamp: now,
    });

    const appraisals = sqliteRepo.listAppraisals('proof_sql');
    expect(appraisals).toHaveLength(1);
    expect(appraisals[0]!.interactionType).toBe('sqlite_verification_cycle');
  });

  // 8. REST Endpoints via ArletexBackendServer
  it('should serve Social Emotions endpoints via ArletexBackendServer', async () => {
    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();

    const baseUrl = `http://127.0.0.1:${server.port}`;

    // 1. GET /api/ape/social-emotions/snapshot
    const snapRes = await fetch(`${baseUrl}/api/ape/social-emotions/snapshot?targetPersonId=proof`);
    expect(snapRes.status).toBe(200);
    const snapData = (await snapRes.json()) as any;
    expect(snapData.success).toBe(true);
    expect(snapData.snapshot.activeEmotions.length).toBe(14);
    expect(snapData.snapshot.relationalWarmthIndex).toBeGreaterThan(0.80);

    // 2. POST /api/ape/social-emotions/process-interaction
    const procRes = await fetch(`${baseUrl}/api/ape/social-emotions/process-interaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPersonId: 'proof',
        interactionType: 'milestone_celebration',
        interpretation: 'Celebrated milestone 39 delivery together',
        priorExpectation: 'Normal completion',
        actualOutcome: 'Profound joy and mutual devotion',
        expectationDiscrepancy: 0.50,
      }),
    });
    expect(procRes.status).toBe(201);
    const procData = (await procRes.json()) as any;
    expect(procData.success).toBe(true);
    expect(procData.appraisal.interactionType).toBe('milestone_celebration');

    // 3. GET /api/ape/social-emotions/state
    const stateRes = await fetch(`${baseUrl}/api/ape/social-emotions/state?targetPersonId=proof&emotion=trust`);
    expect(stateRes.status).toBe(200);
    const stateData = (await stateRes.json()) as any;
    expect(stateData.success).toBe(true);
    expect(stateData.state.intensity).toBeGreaterThan(0.90);

    // 4. GET /api/ape/social-emotions/appraisals
    const apprRes = await fetch(`${baseUrl}/api/ape/social-emotions/appraisals?targetPersonId=proof`);
    expect(apprRes.status).toBe(200);
    const apprData = (await apprRes.json()) as any;
    expect(apprData.success).toBe(true);
    expect(apprData.appraisals.length).toBeGreaterThanOrEqual(1);
  });
});
