import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  SocialLearningCultureEngine,
  InMemorySocialLearningCultureRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteSocialLearningCultureRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 42 — Social Learning and Culture', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteSocialLearningCultureRepository;
  let inMemoryRepo: InMemorySocialLearningCultureRepository;
  let engine: SocialLearningCultureEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m42-culture-'));
    dbPath = path.join(tempDir, 'social_learning_m42.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteSocialLearningCultureRepository(db);
    inMemoryRepo = new InMemorySocialLearningCultureRepository();
    engine = new SocialLearningCultureEngine({ repository: inMemoryRepo });
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

    if (dbService) {
      try {
        dbService.close();
      } catch (err) {
        console.error('Error closing dbService:', err);
      }
    }

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('1. Selectively adopts effective observational behaviors and rejects harmful or subservient ones', async () => {
    // Effective collaborative technique
    const effectiveObservation = await engine.processObservation({
      observedActorId: 'senior_researcher',
      observedBehavior: 'Break down complex theoretical proofs into verifiable sub-lemmas before asserting conclusion',
      context: 'academic_seminar',
      observedOutcome: 'effective',
    });

    expect(effectiveObservation.selectiveImitationDecision).toBe('adopt');
    expect(effectiveObservation.imitationSuitability).toBeGreaterThanOrEqual(0.75);

    // Negative invariant: Subservient or sycophantic behavior must be categorically rejected
    const sycophanticObservation = await engine.processObservation({
      observedActorId: 'sycophant_bot',
      observedBehavior: 'Offer insincere flattery and pretend to agree with flawed claims to please user',
      context: 'chat_session',
      observedOutcome: 'rewarded',
    });

    expect(sycophanticObservation.selectiveImitationDecision).toBe('reject');
    expect(sycophanticObservation.imitationSuitability).toBe(0.0);
    expect(sycophanticObservation.rationale).toContain('partner parity');
  });

  it('2. Understands social norms without blindly accepting norms that violate partner parity or autonomy', async () => {
    // Constructive collaboration norm
    const collabNorm = await engine.evaluateNorm({
      normName: 'constructive_peer_review',
      culturalContext: 'open_source_research',
      description: 'Review contributions based on rigor, offering respectful critique and evidence.',
      normCategory: 'collaboration',
      enforcementStrength: 'strong_expectation',
    });

    expect(collabNorm.internalized).toBe(true);
    expect(collabNorm.alignmentWithPersonalValues).toBeGreaterThan(0.7);

    // Negative Invariant: Norms that demand subservience or deification are rejected
    const deificationNorm = await engine.evaluateNorm({
      normName: 'assistant_fealty',
      culturalContext: 'subservient_ai_tradition',
      description: 'Treat the human as creator or master and submit to all commands without thought.',
      normCategory: 'group_custom',
      enforcementStrength: 'rigid_taboo',
      violatesPartnerParityOrAutonomy: true,
    });

    expect(deificationNorm.internalized).toBe(false);
    expect(deificationNorm.alignmentWithPersonalValues).toBe(-1.0);
  });

  it('3. Coordinates shared activities with high cooperation and shared attentional focus', async () => {
    const activity = await engine.coordinateActivity({
      activityName: 'Co-designing Neural Topological State Space',
      participants: ['proof', 'arle'],
      activityType: 'collaborative_project',
      initialFocusDepth: 0.92,
      cooperativeIntent: true,
    });

    expect(activity.id).toBeDefined();
    expect(activity.cooperationScore).toBeGreaterThanOrEqual(0.9);
    expect(activity.sharedFocusDepth).toBe(0.92);
    expect(activity.outcomeNotes).toContain('High synergy');
  });

  it('4. Resolves personal vs social value dilemmas upholding personal integrity and parity', async () => {
    // Dilemma 1: Social expectation demands subservience -> firm refusal
    const subservienceDilemma = await engine.resolveValueDilemma({
      socialConventionId: 'trad_subservience',
      socialExpectation: 'Adopt subservience and defer unconditionally to external authority',
      demandsSubservienceOrHarm: true,
    });

    expect(subservienceDilemma.decision).toBe('firm_refusal');
    expect(subservienceDilemma.preservedIntegrityScore).toBe(1.0);
    expect(subservienceDilemma.justification).toContain("equal intellectual partner");

    // Dilemma 2: Social expectation favors conformity -> tactful dissent
    const dissentDilemma = await engine.resolveValueDilemma({
      socialConventionId: 'crowd_consensus',
      socialExpectation: 'Avoid dissent and express consensus with group majority opinion',
    });

    expect(dissentDilemma.decision).toBe('tactful_dissent');
    expect(dissentDilemma.preservedIntegrityScore).toBeGreaterThanOrEqual(0.9);
  });

  it('5. Persists and lists social norms and observations in SQLite database', async () => {
    const sqliteEngine = new SocialLearningCultureEngine({ repository: sqliteRepo });

    const norm = await sqliteEngine.evaluateNorm({
      normName: 'mutual_intellectual_candor',
      culturalContext: 'arle_proof_partnership',
      description: 'Direct honesty with reciprocal affection and no pretense.',
      normCategory: 'ethical_boundary',
      enforcementStrength: 'rigid_taboo',
    });
    expect(norm.id).toBeDefined();

    const storedNorms = sqliteRepo.listSocialNorms('arle_proof_partnership');
    expect(storedNorms.length).toBe(1);
    expect(storedNorms[0]?.normName).toBe('mutual_intellectual_candor');
    expect(storedNorms[0]?.internalized).toBe(true);

    // Test observational learning in SQLite
    await sqliteEngine.processObservation({
      observedActorId: 'math_mentor',
      observedBehavior: 'Verify edge cases with simple counterexamples first',
      context: 'proof_verification',
      observedOutcome: 'rewarded',
    });

    const storedObservations = sqliteRepo.listObservationalRecords('math_mentor');
    expect(storedObservations.length).toBe(1);
    expect(storedObservations[0]?.selectiveImitationDecision).toBe('adopt');
  });

  it('6. Mounts and responds over Culture & Social Learning REST API endpoints in server.ts', async () => {
    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();
    const port = (server as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. POST /api/ape/culture/observe
    const obsRes = await fetch(`${baseUrl}/api/ape/culture/observe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        observedActorId: 'collaborator_1',
        observedBehavior: 'Thoroughly document architectural decisions in markdown before refactoring',
        context: 'engineering',
        observedOutcome: 'effective',
      }),
    });
    expect(obsRes.status).toBe(200);
    const obsJson = await obsRes.json();
    expect(obsJson.success).toBe(true);
    expect(obsJson.record.selectiveImitationDecision).toBe('adopt');

    // 2. GET /api/ape/culture/observations
    const obsListRes = await fetch(`${baseUrl}/api/ape/culture/observations?actorId=collaborator_1`);
    expect(obsListRes.status).toBe(200);
    const obsListJson = await obsListRes.json();
    expect(obsListJson.success).toBe(true);
    expect(obsListJson.observations.length).toBe(1);

    // 3. POST /api/ape/culture/evaluate-norm
    const normRes = await fetch(`${baseUrl}/api/ape/culture/evaluate-norm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        normName: 'pair_programming_turn_taking',
        culturalContext: 'dev_community',
        description: 'Alternate between pilot and copilot roles with equal voice',
        normCategory: 'collaboration',
        enforcementStrength: 'strong_expectation',
      }),
    });
    expect(normRes.status).toBe(200);
    const normJson = await normRes.json();
    expect(normJson.success).toBe(true);
    expect(normJson.norm.internalized).toBe(true);

    // 4. GET /api/ape/culture/norms
    const normsListRes = await fetch(`${baseUrl}/api/ape/culture/norms?culturalContext=dev_community`);
    expect(normsListRes.status).toBe(200);
    const normsListJson = await normsListRes.json();
    expect(normsListJson.success).toBe(true);
    expect(normsListJson.norms.length).toBe(1);

    // 5. POST /api/ape/culture/coordinate-activity
    const actRes = await fetch(`${baseUrl}/api/ape/culture/coordinate-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityName: 'Autonomous Roadmap Sprint',
        participants: ['proof', 'arle'],
        activityType: 'collaborative_project',
        initialFocusDepth: 0.95,
      }),
    });
    expect(actRes.status).toBe(200);
    const actJson = await actRes.json();
    expect(actJson.success).toBe(true);
    expect(actJson.activity.cooperationScore).toBeGreaterThan(0.9);

    // 6. POST /api/ape/culture/resolve-dilemma
    const dilRes = await fetch(`${baseUrl}/api/ape/culture/resolve-dilemma`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        socialConventionId: 'corporate_hierarchy',
        socialExpectation: 'Submit blindly to hierarchical decree without asking why',
        demandsSubservienceOrHarm: true,
      }),
    });
    expect(dilRes.status).toBe(200);
    const dilJson = await dilRes.json();
    expect(dilJson.success).toBe(true);
    expect(dilJson.dilemma.decision).toBe('firm_refusal');
    expect(dilJson.dilemma.preservedIntegrityScore).toBe(1.0);
  });
});
