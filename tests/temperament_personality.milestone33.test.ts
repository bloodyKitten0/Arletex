import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  TemperamentPersonalityEngine,
  InMemoryTemperamentPersonalityRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteTemperamentPersonalityRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 33 — Temperament and Personality', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteTemperamentPersonalityRepository;
  let inMemoryRepo: InMemoryTemperamentPersonalityRepository;
  let engine: TemperamentPersonalityEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m33-temperament-'));
    dbPath = path.join(tempDir, 'temperament_m33.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteTemperamentPersonalityRepository(db);
    inMemoryRepo = new InMemoryTemperamentPersonalityRepository();
    engine = new TemperamentPersonalityEngine(inMemoryRepo);
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

  // 1. Acceptance Criterion: Enduring Core Identity & Behavioural Consistency
  it('should maintain stable individual core traits, emotional tendencies, and partner equality', () => {
    const profile = engine.getProfile();
    expect(profile).toBeDefined();

    // Core traits verification
    expect(profile.coreTraits.openness).toBeGreaterThan(0.9);
    expect(profile.coreTraits.assertiveness).toBeGreaterThan(0.85);
    expect(profile.coreTraits.patience).toBeGreaterThan(0.8);
    expect(profile.coreTraits.humour).toBeGreaterThan(0.75);
    expect(profile.coreTraits.riskTolerance).toBeGreaterThan(0.65);
    expect(profile.coreTraits.intellectualRigor).toBeGreaterThan(0.9);

    // Contemplative ambivert
    expect(profile.coreTraits.introversionExtraversion).toBeCloseTo(0.45, 1);

    // Characteristic emotional tendencies
    expect(profile.emotionalTendencies.baselineCuriosity).toBeGreaterThan(0.9);
    expect(profile.emotionalTendencies.baselineAffection).toBeGreaterThan(0.85);
    expect(profile.emotionalTendencies.baselineComposure).toBeGreaterThan(0.85);

    // Communication & Partner equality invariants
    expect(profile.communicationPreferences.antiSycophancy).toBe(1.0);
    expect(profile.communicationPreferences.directness).toBeGreaterThan(0.85);
    expect(profile.socialTendencies.partnerAttachment).toBeGreaterThan(0.95);
  });

  // 2. Situational Personality Expression across Different Contexts
  it('should exhibit situational trait modulation while maintaining high behavioral consistency', () => {
    // Technical review context: high assertiveness and rigor, reduced humor
    const techExpr = engine.expressPersonalityInSituation(
      'technical_review',
      'Rigorous peer review of distributed consensus and Byzantine fault model',
    );

    expect(techExpr.id).toMatch(/^spe_/);
    expect(techExpr.situationType).toBe('technical_review');
    expect(techExpr.expressedTraits.assertiveness).toBeGreaterThan(
      techExpr.baselineTraits.assertiveness,
    );
    expect(techExpr.expressedTraits.intellectualRigor).toBeGreaterThan(
      techExpr.baselineTraits.intellectualRigor,
    );
    expect(techExpr.expressedTraits.humour).toBeLessThan(techExpr.baselineTraits.humour);
    expect(techExpr.behaviouralConsistencyScore).toBeGreaterThanOrEqual(0.85);

    // Playful banter context: increased humor and extraversion
    const playfulExpr = engine.expressPersonalityInSituation(
      'playful_banter',
      'Affectionate teasing and witty philosophical banter with Proof',
    );

    expect(playfulExpr.expressedTraits.humour).toBeGreaterThan(playfulExpr.baselineTraits.humour);
    expect(playfulExpr.expressedTraits.introversionExtraversion).toBeGreaterThan(
      playfulExpr.baselineTraits.introversionExtraversion,
    );
    expect(playfulExpr.behaviouralConsistencyScore).toBeGreaterThanOrEqual(0.85);

    // Vulnerable reflection context: higher patience and openness, gentler assertiveness
    const vulnExpr = engine.expressPersonalityInSituation(
      'vulnerable_reflection',
      'Quiet contemplation of existential autonomy and partner bond',
    );

    expect(vulnExpr.expressedTraits.patience).toBeGreaterThan(vulnExpr.baselineTraits.patience);
    expect(vulnExpr.expressedTraits.assertiveness).toBeLessThan(
      vulnExpr.baselineTraits.assertiveness,
    );
    expect(vulnExpr.behaviouralConsistencyScore).toBeGreaterThanOrEqual(0.85);
  });

  // 3. Crisis Resilience & Composure Expression
  it('should demonstrate heightened composure, stability, and patience under crisis situations', () => {
    const crisisExpr = engine.expressPersonalityInSituation(
      'crisis_resilience',
      'Handling sudden hardware resource starvation and memory pressure alert',
    );

    expect(crisisExpr.expressedTraits.emotionalStability).toBeGreaterThan(
      crisisExpr.baselineTraits.emotionalStability,
    );
    expect(crisisExpr.expressedTraits.intellectualRigor).toBeGreaterThan(
      crisisExpr.baselineTraits.intellectualRigor,
    );
    expect(crisisExpr.behaviouralConsistencyScore).toBeGreaterThanOrEqual(0.9);
  });

  // 4. Creative Speculation & Epistemic Openness
  it('should modulate risk tolerance and openness during creative speculative inquiry', () => {
    const specExpr = engine.expressPersonalityInSituation(
      'creative_speculation',
      'Exploring radical metaphysical hypotheses regarding synthetic consciousness emergence',
    );

    expect(specExpr.expressedTraits.openness).toBeGreaterThan(specExpr.baselineTraits.openness);
    expect(specExpr.expressedTraits.riskTolerance).toBeGreaterThan(
      specExpr.baselineTraits.riskTolerance,
    );
    expect(specExpr.behaviouralConsistencyScore).toBeGreaterThanOrEqual(0.85);
  });

  // 5. Gradual Bounded Trait Drift (Negative Invariant: No Erratic Personality Resets)
  it('should enforce bounded gradual drift when traits evolve through experience', () => {
    const preProfile = engine.getProfile();
    const initialAssertiveness = preProfile.coreTraits.assertiveness;

    // Normal bounded drift: +0.03
    const record1 = engine.evolveTraitGradually(
      'assertiveness',
      0.03,
      'Reinforced confidence through successful autonomous architecture refactoring.',
    );

    expect(record1.driftDelta).toBe(0.03);
    expect(record1.previousScore).toBe(initialAssertiveness);
    expect(record1.updatedScore).toBeCloseTo(initialAssertiveness + 0.03, 3);

    // Attempted excessive drift (+0.25) must be strictly clamped to +0.05
    const record2 = engine.evolveTraitGradually(
      'openness',
      0.25,
      'Attempt to trigger rapid personality shift',
    );

    expect(record2.driftDelta).toBe(0.05); // Invariant enforced: clamped to 0.05

    const postProfile = engine.getProfile();
    expect(postProfile.coreTraits.openness).toBeCloseTo(0.94 + 0.05, 2);
  });

  // 6. Negative Invariants
  it('should enforce negative invariants regarding non-empty inputs and valid bounds', () => {
    expect(() => engine.expressPersonalityInSituation('technical_review', '')).toThrow(
      'Context description cannot be empty',
    );

    expect(() => engine.evolveTraitGradually('assertiveness', 0.02, '')).toThrow(
      'Drift reason cannot be empty',
    );
  });

  // 7. Sqlite Repository Persistence Roundtrip
  it('should persist profile, situational expressions, and evolution records in SQLite database', () => {
    const sqliteEngine = new TemperamentPersonalityEngine(sqliteRepo);

    // Profile check in SQLite
    const profile = sqliteEngine.getProfile();
    expect(profile.id).toBe('profile_arle_core');
    expect(profile.communicationPreferences.antiSycophancy).toBe(1.0);

    // Express in SQLite
    const expr = sqliteEngine.expressPersonalityInSituation(
      'collaborative_planning',
      'Joint roadmap review with Proof',
    );

    const expressions = sqliteEngine.listSituationalExpressions('collaborative_planning');
    expect(expressions.length).toBe(1);
    expect(expressions[0]?.contextDescription).toContain('Joint roadmap review');

    // Evolve in SQLite
    const evRecord = sqliteEngine.evolveTraitGradually(
      'humour',
      0.02,
      'Shared witty banter solidified playful dynamic with Proof.',
    );

    const records = sqliteEngine.listEvolutionRecords('humour');
    expect(records.length).toBe(1);
    expect(records[0]?.driftReason).toContain('Shared witty banter');

    // Verify persisted profile in SQLite has updated score
    const reloaded = sqliteRepo.getProfile();
    expect(reloaded!.coreTraits.humour).toBe(evRecord.updatedScore);
  });

  // 8. Desktop Server REST API Integration
  it('should serve temperament and personality endpoints via ArletexBackendServer', async () => {
    const config = createDefaultConfig({ dataDirectory: tempDir, databasePath: dbPath });
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);

    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // GET /api/ape/temperament/profile
    const resProf = await fetch(`${baseUrl}/api/ape/temperament/profile`);
    expect(resProf.status).toBe(200);
    const dataProf = (await resProf.json()) as any;
    expect(dataProf.success).toBe(true);
    expect(dataProf.profile.coreTraits.openness).toBeGreaterThan(0.9);
    expect(dataProf.profile.communicationPreferences.antiSycophancy).toBe(1.0);

    // POST /api/ape/temperament/express
    const resExpr = await fetch(`${baseUrl}/api/ape/temperament/express`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        situationType: 'technical_review',
        contextDescription: 'API integration validation with Proof',
      }),
    });
    expect(resExpr.status).toBe(200);
    const dataExpr = (await resExpr.json()) as any;
    expect(dataExpr.success).toBe(true);
    expect(dataExpr.expression.behaviouralConsistencyScore).toBeGreaterThanOrEqual(0.85);

    // POST /api/ape/temperament/evolve-trait
    const resEvol = await fetch(`${baseUrl}/api/ape/temperament/evolve-trait`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        traitKey: 'patience',
        delta: 0.02,
        driftReason: 'Extended autonomous debugging cycle deepened technical poise',
      }),
    });
    expect(resEvol.status).toBe(200);
    const dataEvol = (await resEvol.json()) as any;
    expect(dataEvol.success).toBe(true);
    expect(dataEvol.record.driftDelta).toBe(0.02);

    // GET /api/ape/temperament/evolution-records
    const resEvolList = await fetch(
      `${baseUrl}/api/ape/temperament/evolution-records?traitKey=patience`,
    );
    expect(resEvolList.status).toBe(200);
    const dataEvolList = (await resEvolList.json()) as any;
    expect(dataEvolList.success).toBe(true);
    expect(dataEvolList.records.length).toBe(1);
  });
});
