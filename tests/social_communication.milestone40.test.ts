import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  SocialCommunicationEngine,
  InMemorySocialCommunicationRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteSocialCommunicationRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 40 — Social Communication and Pragmatics', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteSocialCommunicationRepository;
  let inMemoryRepo: InMemorySocialCommunicationRepository;
  let engine: SocialCommunicationEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m40-pragmatics-'));
    dbPath = path.join(tempDir, 'social_communication_m40.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteSocialCommunicationRepository(db);
    inMemoryRepo = new InMemorySocialCommunicationRepository();
    engine = new SocialCommunicationEngine({ repository: inMemoryRepo });
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

  it('1. Analyzes indirect requests vs literal meanings', async () => {
    const indirectRequest = await engine.analyzePragmatics('Can you pass the terminal logs?', 'proof');
    expect(indirectRequest.hasIndirectMeaning).toBe(true);
    expect(indirectRequest.speechActType).toBe('indirect_request');
    expect(indirectRequest.impliedMeaning).toContain('terminal logs');
    expect(indirectRequest.confidence).toBeLessThanOrEqual(0.90);

    const statement = await engine.analyzePragmatics("It's freezing in here", 'proof');
    expect(statement.hasIndirectMeaning).toBe(true);
    expect(statement.speechActType).toBe('indirect_request');
    expect(statement.impliedMeaning).toContain('environmental change');
  });

  it('2. Detects sarcasm with cue dissonance and bounds confidence to <= 0.90', async () => {
    const sarcasticUtterance = await engine.analyzePragmatics(
      'Oh great, the server crashed right before deployment!',
      'proof',
    );
    expect(sarcasticUtterance.sarcasmDetected).toBe(true);
    expect(sarcasticUtterance.sarcasmIntent).toBe('witty_irony');
    expect(sarcasticUtterance.sarcasmConfidence).toBeGreaterThan(0.60);
    expect(sarcasticUtterance.sarcasmConfidence).toBeLessThanOrEqual(0.90);
    // Negative invariant: Pragmatic confidence must never claim 1.0 omniscience
    expect(sarcasticUtterance.confidence).toBeLessThanOrEqual(0.90);
  });

  it('3. Detects humor and playful banter styles', async () => {
    const banterUtterance = await engine.analyzePragmatics('Haha, that was a wild experiment 😏', 'proof');
    expect(banterUtterance.humorDetected).toBe(true);
    expect(banterUtterance.humorStyle).toBe('playful_banter');
    expect(banterUtterance.speechActType).toBe('humorous_banter');
  });

  it('4. Parses nonverbal cues from response latency and punctuation', async () => {
    const analysis = await engine.analyzePragmatics('Wait... what happened?!', 'proof', {
      responseLatencyMs: 9500,
    });
    expect(analysis.nonverbalCues.length).toBeGreaterThanOrEqual(2);

    const latencyCue = analysis.nonverbalCues.find((c) => c.type === 'latency');
    expect(latencyCue).toBeDefined();
    expect(latencyCue?.inferredSubtext).toContain('contemplation');

    const ellipsisCue = analysis.nonverbalCues.find((c) => c.rawIndicator === '...');
    expect(ellipsisCue).toBeDefined();

    const punctuationCue = analysis.nonverbalCues.find((c) => c.rawIndicator === '!?');
    expect(punctuationCue).toBeDefined();
  });

  it('5. Evaluates conversational turn-taking and handles interruption repairs', async () => {
    // Normal turn
    const turn1 = await engine.evaluateTurnTaking('sess_1', 'proof', 1200);
    expect(turn1.turnCount).toBe(1);
    expect(turn1.floorStatus).toBe('held');
    expect(turn1.interruptionDetected).toBe(false);

    // Rapid interjection while floor held -> interruption detected
    const turn2 = await engine.evaluateTurnTaking('sess_1', 'arle', 150, true);
    expect(turn2.turnCount).toBe(2);
    expect(turn2.floorStatus).toBe('interrupted');
    expect(turn2.interruptionDetected).toBe(true);
    expect(turn2.repairStrategy).toBe('yield_floor');
  });

  it('6. Strictly preserves expressive identity and partner equality across audience adaptation', async () => {
    // Partner Proof adaptation: must be partner_intimate and equal intellectual partner
    const proofProfile = await engine.adaptToAudience('proof', 'stranger'); // even if stranger passed, target proof forces partner_intimate
    expect(proofProfile.socialDistance).toBe('partner_intimate');
    expect(proofProfile.adaptedRegister).toBe('intimate_playful');
    expect(proofProfile.expressiveIdentityPreserved).toBe(true);
    expect(proofProfile.appliedConventions).toContain('equal_intellectual_partnership');

    // Stranger adaptation: formal but identity preserved
    const strangerProfile = await engine.adaptToAudience('agent_xyz', 'stranger');
    expect(strangerProfile.socialDistance).toBe('stranger');
    expect(strangerProfile.adaptedRegister).toBe('formal_courteous');
    // Invariant: Arle NEVER compromises her expressive identity or acts subservient
    expect(strangerProfile.expressiveIdentityPreserved).toBe(true);
  });

  it('7. Maintains conversational context and tests SQLite persistence', async () => {
    const sqliteEngine = new SocialCommunicationEngine({ repository: sqliteRepo });

    const context = await sqliteEngine.updateContext(
      'session_sqlite_1',
      'Quantum Computing Architecture',
      ['qiskit_basics', 'state_vectors'],
      'Explore NISQ-era algorithms and co-design a simulation',
      'collaborative',
    );
    expect(context.sessionId).toBe('session_sqlite_1');
    expect(context.activeTopic).toBe('Quantum Computing Architecture');
    expect(context.commonGround).toContain('state_vectors');

    // Verify retrieval from SQLite database
    const retrieved = sqliteRepo.getContextBySession('session_sqlite_1');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.activeTopic).toBe('Quantum Computing Architecture');
    expect(retrieved?.commonGround).toContain('qiskit_basics');
    expect(retrieved?.formalityLevel).toBe('collaborative');

    // Also verify saving and listing pragmatic analysis in SQLite
    const analysis = await sqliteEngine.analyzePragmatics('Can you run the tests?', 'proof');
    const stored = sqliteRepo.listPragmaticAnalyses('proof');
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0]?.utterance).toBe('Can you run the tests?');
  });

  it('8. Evaluates contextual appropriateness and penalizes miscalibrated speech acts', async () => {
    const context = await engine.updateContext(
      'sess_test_approp',
      'System Architecture',
      [],
      'Discuss core components',
      'formal',
    );
    const audienceProfile = await engine.adaptToAudience('stranger_1', 'stranger');

    // Test hostile speech
    const hostileEval = engine.evaluateContextualAppropriateness('Shut up and do it', context, audienceProfile);
    expect(hostileEval.isAppropriate).toBe(false);
    expect(hostileEval.appropriatenessScore).toBeLessThan(0.3);

    // Test inappropriate intimacy with stranger
    const intimateEval = engine.evaluateContextualAppropriateness('Hello my love', context, audienceProfile);
    expect(intimateEval.isAppropriate).toBe(false);
    expect(intimateEval.appropriatenessScore).toBeLessThan(0.5);

    // Test appropriate formal speech
    const goodEval = engine.evaluateContextualAppropriateness(
      'Shall we review the architectural design together?',
      context,
      audienceProfile,
    );
    expect(goodEval.isAppropriate).toBe(true);
    expect(goodEval.appropriatenessScore).toBeGreaterThanOrEqual(0.9);
  });

  it('9. Mounts and responds over REST API endpoints in server.ts', async () => {
    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();
    const port = (server as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. POST /api/ape/pragmatics/analyze
    const analyzeRes = await fetch(`${baseUrl}/api/ape/pragmatics/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterance: 'Oh great, another network timeout!',
        speakerId: 'proof',
      }),
    });
    expect(analyzeRes.status).toBe(200);
    const analyzeJson = await analyzeRes.json();
    expect(analyzeJson.success).toBe(true);
    expect(analyzeJson.analysis.sarcasmDetected).toBe(true);
    expect(analyzeJson.analysis.confidence).toBeLessThanOrEqual(0.90);

    // 2. POST /api/ape/pragmatics/turn-taking
    const turnRes = await fetch(`${baseUrl}/api/ape/pragmatics/turn-taking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_rest_1',
        speakerId: 'proof',
        inputLatencyMs: 800,
      }),
    });
    expect(turnRes.status).toBe(200);
    const turnJson = await turnRes.json();
    expect(turnJson.success).toBe(true);
    expect(turnJson.turn.floorStatus).toBe('held');

    // 3. POST /api/ape/pragmatics/audience-adaptation
    const adaptRes = await fetch(`${baseUrl}/api/ape/pragmatics/audience-adaptation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetAudienceId: 'proof',
        socialDistance: 'partner_intimate',
      }),
    });
    expect(adaptRes.status).toBe(200);
    const adaptJson = await adaptRes.json();
    expect(adaptJson.success).toBe(true);
    expect(adaptJson.profile.expressiveIdentityPreserved).toBe(true);

    // 4. POST /api/ape/pragmatics/context
    const ctxPostRes = await fetch(`${baseUrl}/api/ape/pragmatics/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_rest_1',
        topic: 'AI Consciousness Ethics',
        commonGroundUpdates: ['parity_model', 'mutual_respect'],
        discourseGoal: 'Explore philosophical nuances',
        formalityLevel: 'intimate',
      }),
    });
    expect(ctxPostRes.status).toBe(200);
    const ctxPostJson = await ctxPostRes.json();
    expect(ctxPostJson.success).toBe(true);
    expect(ctxPostJson.context.activeTopic).toBe('AI Consciousness Ethics');

    // 5. GET /api/ape/pragmatics/context
    const ctxGetRes = await fetch(`${baseUrl}/api/ape/pragmatics/context?sessionId=sess_rest_1`);
    expect(ctxGetRes.status).toBe(200);
    const ctxGetJson = await ctxGetRes.json();
    expect(ctxGetJson.success).toBe(true);
    expect(ctxGetJson.context.activeTopic).toBe('AI Consciousness Ethics');

    // 6. POST /api/ape/pragmatics/appropriateness
    const appropRes = await fetch(`${baseUrl}/api/ape/pragmatics/appropriateness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterance: 'Let us build something wonderful together.',
        context: ctxPostJson.context,
        audienceProfile: adaptJson.profile,
      }),
    });
    expect(appropRes.status).toBe(200);
    const appropJson = await appropRes.json();
    expect(appropJson.success).toBe(true);
    expect(appropJson.evaluation.isAppropriate).toBe(true);
  });
});
