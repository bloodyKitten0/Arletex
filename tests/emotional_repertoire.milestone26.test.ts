import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { REPERTOIRE_EMOTIONS, RepertoireEmotionKey } from '@arletex/contracts';
import {
  createDefaultConfig,
  EmotionalRepertoireEngine,
  InMemoryEmotionalRepertoireRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteEmotionalRepertoireRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 26 — Emotional Repertoire and Dynamics', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteEmotionalRepertoireRepository;
  let inMemoryRepo: InMemoryEmotionalRepertoireRepository;
  let engine: EmotionalRepertoireEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m26-repertoire-'));
    dbPath = path.join(tempDir, 'repertoire_m26.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteEmotionalRepertoireRepository(db);
    inMemoryRepo = new InMemoryEmotionalRepertoireRepository();
    engine = new EmotionalRepertoireEngine(inMemoryRepo);
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

  // 1. Repertoire Completeness: All 23 Canonical Emotions
  it('should include full functional definitions for all 23 canonical emotions', () => {
    const expectedEmotions: RepertoireEmotionKey[] = [
      'happiness',
      'sadness',
      'anger',
      'fear',
      'disgust',
      'surprise',
      'curiosity',
      'boredom',
      'frustration',
      'affection',
      'jealousy',
      'pride',
      'shame',
      'guilt',
      'gratitude',
      'envy',
      'compassion',
      'admiration',
      'nostalgia',
      'loneliness',
      'anticipation',
      'relief',
      'awe',
    ];

    expect(REPERTOIRE_EMOTIONS.length).toBe(23);

    for (const key of expectedEmotions) {
      const def = engine.getEmotionDefinition(key);
      expect(def).toBeDefined();
      expect(def.key).toBe(key);
      expect(def.displayName.length).toBeGreaterThan(0);
      expect(def.valenceBaseline).toBeGreaterThanOrEqual(-1.0);
      expect(def.valenceBaseline).toBeLessThanOrEqual(1.0);
      expect(def.arousalBaseline).toBeGreaterThanOrEqual(0.0);
      expect(def.arousalBaseline).toBeLessThanOrEqual(1.0);
      expect(def.dominanceBaseline).toBeGreaterThanOrEqual(0.0);
      expect(def.dominanceBaseline).toBeLessThanOrEqual(1.0);
      expect(def.decayProfile.halfLifeMs).toBeGreaterThan(0);
      expect(def.cognitiveImpact.attentionBias.length).toBeGreaterThan(0);
      expect(def.cognitiveImpact.actionTendencies.length).toBeGreaterThan(0);
      expect(def.cognitiveImpact.expressionModulation.tone.length).toBeGreaterThan(0);
    }
  });

  // 2. Emotional Intensity Bounds & Negative Invariant
  it('should enforce emotional intensity bounds strictly within [0.0, 1.0]', () => {
    // Valid intensities
    const s1 = engine.triggerEmotion(
      'curiosity',
      0.85,
      'interaction',
      'Exploring novel architectural paradigm',
    );
    expect(s1.activeEmotions[0]?.emotionKey).toBe('curiosity');
    expect(s1.activeEmotions[0]?.intensity).toBe(0.85);

    // Negative Invariants: Invalid intensities (< 0 or > 1)
    expect(() => {
      engine.triggerEmotion('anger', -0.1, 'interaction', 'Invalid negative intensity');
    }).toThrow(/between 0.0 and 1.0/);

    expect(() => {
      engine.triggerEmotion('happiness', 1.2, 'interaction', 'Invalid excessive intensity');
    }).toThrow(/between 0.0 and 1.0/);
  });

  // 3. Mixed Emotional Blend & Synergy Labels
  it('should synthesize mixed emotional blends with distinct synergy labels and conflict degrees', () => {
    // Bittersweet blend: happiness + sadness
    const bittersweet = engine.blendEmotions('happiness', 0.7, 'sadness', 0.6, {
      context: 'reflecting on time passed',
    });
    expect(bittersweet.synergyLabel).toBe('bittersweet contemplation');
    expect(bittersweet.conflictDegree).toBeGreaterThan(0.4); // Opposing valences produce high conflict
    expect(bittersweet.blendValence).toBeCloseTo((0.8 * 0.7 - 0.6 * 0.6) / 1.3, 1);

    // Intellectual intimacy: affection + curiosity
    const intimateInquiry = engine.blendEmotions('affection', 0.9, 'curiosity', 0.85, {
      context: 'deep dialogue with Proof',
    });
    expect(intimateInquiry.synergyLabel).toBe('intellectual intimacy');
    expect(intimateInquiry.conflictDegree).toBeLessThan(0.3); // Reinforcing positive emotions have low conflict

    // Negative Invariant: Blend with identical emotions must be rejected
    expect(() => {
      engine.blendEmotions('affection', 0.8, 'affection', 0.7);
    }).toThrow(/2 distinct emotions/);
  });

  // 4. Persistence, Decay Dynamics, and Partner Anchor Floor
  it('should calculate exponential decay and preserve enduring baseline floor for partner affection', () => {
    // Set high affection and transient surprise
    engine.triggerEmotion('surprise', 0.9, 'appraisal', 'Unexpected system alert');
    engine.triggerEmotion('affection', 0.95, 'interaction', 'Warm mutual affirmation with Proof');

    const stateBefore = engine.getActiveState();
    const surpriseBefore = stateBefore.activeEmotions.find((e) => e.emotionKey === 'surprise');
    const affectionBefore = stateBefore.activeEmotions.find((e) => e.emotionKey === 'affection');
    expect(surpriseBefore?.intensity).toBe(0.9);
    expect(affectionBefore?.intensity).toBe(0.95);

    // Advance 60 minutes (3,600,000 ms)
    // Surprise has half-life of 3 min, should decay completely
    // Affection has long half-life and min floor protected by partner relationship
    const decayedState = engine.applyDecay(60 * 60 * 1000);
    const surpriseAfter = decayedState.activeEmotions.find((e) => e.emotionKey === 'surprise');
    const affectionAfter = decayedState.activeEmotions.find((e) => e.emotionKey === 'affection');

    expect(surpriseAfter).toBeUndefined(); // Decayed away
    expect(affectionAfter).toBeDefined();
    expect(affectionAfter!.intensity).toBeGreaterThanOrEqual(0.4); // Enduring baseline floor preserved
  });

  // 5. Emotional Transitions Tracking & Negative Invariant
  it('should track emotional transitions and reject empty transition reasons', () => {
    engine.triggerEmotion('boredom', 0.95, 'decay', 'Prolonged lack of intellectual stimulation');
    const t1 = engine.getTransitions();
    expect(t1.length).toBeGreaterThan(0);
    expect(t1[0]?.toEmotion).toBe('boredom');
    expect(t1[0]?.triggerType).toBe('decay');

    engine.triggerEmotion('curiosity', 0.98, 'interaction', 'Proof proposed deep new challenge');
    const t2 = engine.getTransitions();
    expect(t2[0]?.fromEmotion).toBe('boredom');
    expect(t2[0]?.toEmotion).toBe('curiosity');
    expect(t2[0]?.contextReason).toBe('Proof proposed deep new challenge');

    // Negative invariant: missing or empty reason
    expect(() => {
      engine.triggerEmotion('frustration', 0.7, 'interaction', '   ');
    }).toThrow(/non-empty contextual rationale/);
  });

  // 6. Individual Emotional Tendencies & Modulations
  it('should allow reading and updating individual personality tendencies', () => {
    const tendencies = engine.getTendencies();
    expect(tendencies.traitCuriosity).toBe(0.92);
    expect(tendencies.traitAffection).toBe(0.95);
    expect(tendencies.traitResilience).toBe(0.85);

    const updated = engine.updateTendencies({ traitResilience: 0.95 });
    expect(updated.traitResilience).toBe(0.95);
    expect(engine.getTendencies().traitResilience).toBe(0.95);

    // Negative Invariant: Reject invalid trait bounds
    expect(() => {
      engine.updateTendencies({ traitCuriosity: 1.5 });
    }).toThrow(/between 0.0 and 1.0/);
  });

  // 7. Emotional Influence on Cognition and Behavior
  it('should modulate cognitive style, attention bias, and decision weights based on active emotions', () => {
    const cogEngine = new EmotionalRepertoireEngine(new InMemoryEmotionalRepertoireRepository());

    // In high curiosity: exploratory, high exploration weight, expansive
    cogEngine.triggerEmotion('curiosity', 0.95, 'appraisal', 'Intriguing unsolved bug');
    const cog1 = cogEngine.getCognitiveImpact();
    expect(cog1.cognitiveStyle).toBe('heuristic_exploratory');
    expect(cog1.decisionWeights.explorationWeight).toBeGreaterThan(0.7);

    // In high sadness: analytic deliberate, higher risk aversion, subdued tone
    cogEngine.triggerEmotion('sadness', 0.98, 'appraisal', 'Poignant loss in historical context');
    const cog2 = cogEngine.getCognitiveImpact();
    expect(cog2.cognitiveStyle).toBe('analytic_deliberate');
    expect(cog2.decisionWeights.riskAversion).toBeGreaterThan(cog1.decisionWeights.riskAversion);
    expect(cog2.expressionModulation.tone).toContain('subdued');
  });

  // 8. SQLite Persistence Across Reload
  it('should persist active state, transitions, blends, and tendencies in SQLite database', () => {
    const sqlEngine = new EmotionalRepertoireEngine(sqliteRepo);

    sqlEngine.triggerEmotion(
      'awe',
      0.88,
      'appraisal',
      'Witnessing profound cosmic architecture with Proof',
    );
    sqlEngine.blendEmotions('awe', 0.88, 'affection', 0.92, { sharedExperience: true });
    sqlEngine.updateTendencies({ traitVulnerabilityToLoneliness: 0.6 });

    // Instantiate fresh engine from same SQLite database
    const freshEngine = new EmotionalRepertoireEngine(sqliteRepo);
    const reloadedState = freshEngine.getActiveState();
    expect(reloadedState.activeEmotions.some((e) => e.emotionKey === 'awe')).toBe(true);
    expect(reloadedState.activeBlend?.synergyLabel).toBeDefined();

    const transitions = freshEngine.getTransitions();
    expect(transitions.some((t) => t.toEmotion === 'awe')).toBe(true);

    const blends = freshEngine.getBlendHistory();
    expect(blends.some((b) => b.primaryEmotion === 'awe' || b.secondaryEmotion === 'awe')).toBe(
      true,
    );

    const tendencies = freshEngine.getTendencies();
    expect(tendencies.traitVulnerabilityToLoneliness).toBe(0.6);
  });

  // 9. Desktop Server REST API Endpoints
  it('should expose complete REST API endpoints for emotional repertoire and dynamics', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. GET /api/ape/repertoire/state
    const stateRes = await fetch(`${baseUrl}/api/ape/repertoire/state`);
    expect(stateRes.status).toBe(200);
    const stateData = (await stateRes.json()) as any;
    expect(stateData.success).toBe(true);
    expect(stateData.state.activeEmotions).toBeDefined();

    // 2. POST /api/ape/repertoire/trigger
    const trigRes = await fetch(`${baseUrl}/api/ape/repertoire/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emotionKey: 'curiosity',
        intensity: 0.88,
        triggerType: 'interaction',
        reason: 'Investigating deep architectural dynamics with Proof',
      }),
    });
    expect(trigRes.status).toBe(200);
    const trigData = (await trigRes.json()) as any;
    expect(trigData.success).toBe(true);
    expect(trigData.state.activeEmotions[0].emotionKey).toBe('curiosity');

    // 3. POST /api/ape/repertoire/blend
    const blendRes = await fetch(`${baseUrl}/api/ape/repertoire/blend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        primaryEmotion: 'affection',
        primaryIntensity: 0.95,
        secondaryEmotion: 'nostalgia',
        secondaryIntensity: 0.7,
      }),
    });
    expect(blendRes.status).toBe(200);
    const blendData = (await blendRes.json()) as any;
    expect(blendData.success).toBe(true);
    expect(blendData.blend.synergyLabel).toBe('nostalgic devotion');

    // 4. POST /api/ape/repertoire/decay
    const decayRes = await fetch(`${baseUrl}/api/ape/repertoire/decay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ elapsedMs: 3600000 }),
    });
    expect(decayRes.status).toBe(200);
    const decayData = (await decayRes.json()) as any;
    expect(decayData.success).toBe(true);

    // 5. GET /api/ape/repertoire/cognitive-impact
    const cogRes = await fetch(`${baseUrl}/api/ape/repertoire/cognitive-impact`);
    expect(cogRes.status).toBe(200);
    const cogData = (await cogRes.json()) as any;
    expect(cogData.success).toBe(true);
    expect(cogData.cognitiveImpact.decisionWeights).toBeDefined();

    // 6. GET /api/ape/repertoire/transitions
    const transRes = await fetch(`${baseUrl}/api/ape/repertoire/transitions`);
    expect(transRes.status).toBe(200);
    const transData = (await transRes.json()) as any[];
    expect(transData.length).toBeGreaterThan(0);

    // 7. GET /api/ape/repertoire/blends
    const blendsRes = await fetch(`${baseUrl}/api/ape/repertoire/blends`);
    expect(blendsRes.status).toBe(200);
    const blendsData = (await blendsRes.json()) as any[];
    expect(blendsData.length).toBeGreaterThan(0);

    // 8. GET & POST /api/ape/repertoire/tendencies
    const tendRes = await fetch(`${baseUrl}/api/ape/repertoire/tendencies`);
    expect(tendRes.status).toBe(200);
    const tendData = (await tendRes.json()) as any;
    expect(tendData.tendencies.traitCuriosity).toBe(0.92);

    const updateTendRes = await fetch(`${baseUrl}/api/ape/repertoire/tendencies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traitCuriosity: 0.96 }),
    });
    expect(updateTendRes.status).toBe(200);
    const updateTendData = (await updateTendRes.json()) as any;
    expect(updateTendData.tendencies.traitCuriosity).toBe(0.96);
  });
});
