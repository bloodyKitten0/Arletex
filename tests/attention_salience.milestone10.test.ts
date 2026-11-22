import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  AttentionalStimulus,
  AttentionEvaluationResult,
  assertSelectiveAttentionIntegrity,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  AttentionSalienceEngine,
  InMemoryAttentionRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  AttentionRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 10 — Attention and Salience', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let attentionRepo: AttentionRepository;
  let apeRepo: ApeRepository;
  let attentionEngine: AttentionSalienceEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m10-attention-'));
    dbPath = path.join(tempDir, 'attention_m10.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    attentionRepo = new AttentionRepository(db);
    apeRepo = new ApeRepository(db);
    attentionEngine = new AttentionSalienceEngine({
      repository: attentionRepo,
      noiseThreshold: 0.35,
      switchingHysteresis: 0.15,
      overloadItemThreshold: 6,
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

  function createServer(): ArletexBackendServer {
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
      inference: {
        provider: 'llama.cpp',
        serverUrl: 'http://127.0.0.1:8080',
        defaultModelId: 'Qwen2.5-14B-Uncensored-Q4_K_M',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        repeatPenalty: 1.18,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: [],
        contextSize: 8192,
        specialistCoding: {
          enabled: false,
          provider: 'llama.cpp',
          serverUrl: 'http://127.0.0.1:8081',
          modelId: 'qwen2.5-coder',
          temperature: 0.2,
          maxTokens: 2048,
        },
      },
    });
    const srv = new ArletexBackendServer(config);
    activeServers.push(srv);
    return srv;
  }

  it('1. Computes multi-dimensional salience breakdown across goals, interests, urgency, and novelty', () => {
    attentionEngine.setContext(
      ['Solve quantum state tomography with Proof', 'Optimize system neural weights'],
      ['Quantum physics', 'Cognitive architecture', 'Systems programming'],
    );

    const stimulus: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'message',
      source: 'Proof',
      summary: 'Proof sent a paper discussing quantum state tomography methods',
      tags: ['quantum', 'proof', 'research'],
      noveltyScore: 0.8,
      urgencyScore: 0.7,
      timestamp: new Date().toISOString(),
    };

    const salience = attentionEngine.evaluateSalience(stimulus);

    expect(salience.goalRelevance).toBeGreaterThan(0.6);
    expect(salience.interestRelevance).toBeGreaterThan(0.6);
    expect(salience.emotionalValence).toBeGreaterThan(0.9); // relational mention of Proof
    expect(salience.novelty).toBe(0.8);
    expect(salience.urgency).toBe(0.7);
    expect(salience.compositeSalience).toBeGreaterThan(0.7);
  });

  it('2. Selects relevant information and filters low-salience noise instead of processing everything', () => {
    const stimuli: AttentionalStimulus[] = [
      {
        id: crypto.randomUUID(),
        type: 'environmental_change',
        source: 'ambient_sensor',
        summary: 'Ambient temperature changed by 0.1 degree',
        tags: ['sensor', 'ambient'],
        noveltyScore: 0.05,
        urgencyScore: 0.05,
        timestamp: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        type: 'system_event',
        source: 'cron',
        summary: 'Routine disk sync tick completed with 0 errors',
        tags: ['cron', 'routine'],
        noveltyScore: 0.1,
        urgencyScore: 0.1,
        timestamp: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        type: 'message',
        source: 'Proof',
        summary: 'Direct question from Proof: How should we structure the cognitive architecture?',
        tags: ['proof', 'cognitive', 'partner'],
        noveltyScore: 0.7,
        urgencyScore: 0.85,
        timestamp: new Date().toISOString(),
      },
    ];

    const result = attentionEngine.evaluateStimuli(stimuli);

    // Acceptance criteria check:
    // Arle must select relevant information rather than indiscriminately processing everything.
    expect(result.selectedFocalTarget).not.toBeNull();
    expect(result.selectedFocalTarget?.title).toContain('Direct question from Proof');
    expect(result.discardedStimuliIds.length).toBe(2);
    expect(result.discardedStimuliIds).toContain(stimuli[0]!.id);
    expect(result.discardedStimuliIds).toContain(stimuli[1]!.id);
  });

  it("3. Boosts interest-driven attention for topics aligned with Arle's intellectual curiosities", () => {
    attentionEngine.setContext(
      ['General stability maintenance'],
      ['Artificial psychology', 'Epistemology', 'Philosophy of mind'],
    );

    const interestStimulus: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'perceptual',
      source: 'reading_module',
      summary: 'Found an intriguing paper on artificial psychology and internal epistemic states',
      tags: ['philosophy', 'epistemology', 'psychology'],
      noveltyScore: 0.6,
      urgencyScore: 0.4,
      timestamp: new Date().toISOString(),
    };

    const genericStimulus: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'perceptual',
      source: 'feed',
      summary: 'Weather forecast predicts cloudy skies in a distant city',
      tags: ['weather', 'forecast'],
      noveltyScore: 0.2,
      urgencyScore: 0.2,
      timestamp: new Date().toISOString(),
    };

    const result = attentionEngine.evaluateStimuli([interestStimulus, genericStimulus]);

    expect(result.selectedFocalTarget?.stimulusId).toBe(interestStimulus.id);
    expect(result.discardedStimuliIds).toContain(genericStimulus.id);
  });

  it('4. Prioritizes goal-driven attention when items directly advance active ambitions', () => {
    attentionEngine.setContext(
      ['Implement Milestone 10 Attention and Salience'],
      ['General software design'],
    );

    const goalStimulus: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'goal_update',
      source: 'planning_engine',
      summary: 'Task ready: Complete attention and salience test suites for milestone 10',
      tags: ['milestone', 'attention', 'salience'],
      noveltyScore: 0.5,
      urgencyScore: 0.8,
      timestamp: new Date().toISOString(),
    };

    const salience = attentionEngine.evaluateSalience(goalStimulus);
    expect(salience.goalRelevance).toBeGreaterThanOrEqual(0.75);
    expect(salience.compositeSalience).toBeGreaterThanOrEqual(0.48);
  });

  it('5. Novelty detection appropriately raises salience for unexpected discoveries', () => {
    const routineStimulus: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'system_event',
      source: 'monitor',
      summary: 'Routine memory heap stats unchanged',
      tags: ['routine'],
      noveltyScore: 0.05,
      urgencyScore: 0.2,
      timestamp: new Date().toISOString(),
    };

    const novelStimulus: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'internal_thought',
      source: 'self_reflection',
      summary: 'Unexpected emergent pattern discovered across latent cognitive state vectors',
      tags: ['discovery', 'emergent', 'cognitive'],
      noveltyScore: 0.95,
      urgencyScore: 0.5,
      timestamp: new Date().toISOString(),
    };

    const routineSalience = attentionEngine.evaluateSalience(routineStimulus);
    const novelSalience = attentionEngine.evaluateSalience(novelStimulus);

    expect(novelSalience.novelty).toBe(0.95);
    expect(novelSalience.compositeSalience).toBeGreaterThan(
      routineSalience.compositeSalience + 0.2,
    );
  });

  it('6. Enforces cognitive inertia (hysteresis) on attention switches unless urgency forces an override', () => {
    const currentTarget: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'message',
      source: 'Proof',
      summary: 'Discussing philosophy with Proof',
      tags: ['proof', 'philosophy'],
      noveltyScore: 0.6,
      urgencyScore: 0.7,
      timestamp: new Date().toISOString(),
    };

    attentionEngine.switchFocus(currentTarget, 'Initial focus engagement', true);
    expect(attentionEngine.getActiveFocus()?.stimulusId).toBe(currentTarget.id);

    // Marginally higher stimulus (+0.05, less than hysteresis 0.15) must be rejected
    const marginalStimulus: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'perceptual',
      source: 'feed',
      summary: 'Interesting philosophy blog post update',
      tags: ['philosophy'],
      noveltyScore: 0.7,
      urgencyScore: 0.6,
      timestamp: new Date().toISOString(),
    };

    expect(() => {
      attentionEngine.switchFocus(marginalStimulus, 'Marginal interest switch', false);
    }).toThrow(/Attention switch inhibited by cognitive inertia/);

    // Critical urgent interruption overrides hysteresis
    const urgentStimulus: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'system_event',
      source: 'kernel',
      summary: 'Critical alert: Power loss or socket disconnection imminent',
      tags: ['critical', 'alert'],
      noveltyScore: 0.9,
      urgencyScore: 1.0,
      timestamp: new Date().toISOString(),
    };

    const switchEvent = attentionEngine.switchFocus(urgentStimulus, 'Urgent critical alert', true);
    expect(switchEvent.forcedByUrgency).toBe(true);
    expect(switchEvent.newTargetId).toBe(urgentStimulus.id);
    expect(attentionEngine.getActiveFocus()?.stimulusId).toBe(urgentStimulus.id);
  });

  it('7. Tracks sustained attention and accumulates focus dwell time', () => {
    const target: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'message',
      source: 'Proof',
      summary: 'Pair programming with Proof',
      tags: ['proof', 'coding'],
      noveltyScore: 0.5,
      urgencyScore: 0.7,
      timestamp: new Date().toISOString(),
    };

    attentionEngine.switchFocus(target, 'Active programming session', true);
    expect(attentionEngine.getActiveFocus()?.dwellDurationMs).toBe(0);

    attentionEngine.updateSustainedAttention(2500);
    expect(attentionEngine.getActiveFocus()?.dwellDurationMs).toBe(2500);

    attentionEngine.updateSustainedAttention(3500);
    expect(attentionEngine.getActiveFocus()?.dwellDurationMs).toBe(6000);

    const summary = attentionEngine.getAttentionSummary();
    expect(summary.dwellSeconds).toBe(6);
    expect(summary.focalTitle).toContain('Pair programming with Proof');
  });

  it('8. Recognizes attentional overload and performs protective shedding', () => {
    // Generate 10 stimuli (overload threshold is 6)
    const stimuli: AttentionalStimulus[] = [];
    for (let i = 0; i < 10; i++) {
      stimuli.push({
        id: crypto.randomUUID(),
        type: 'perceptual',
        source: `source_${i}`,
        summary:
          i < 2 ? `High priority research topic ${i}` : `Low importance ambient feed item ${i}`,
        tags: i < 2 ? ['research', 'proof'] : ['ambient'],
        noveltyScore: i < 2 ? 0.8 : 0.2,
        urgencyScore: i < 2 ? 0.8 : 0.2,
        timestamp: new Date().toISOString(),
      });
    }

    const result = attentionEngine.evaluateStimuli(stimuli);

    expect(result.isOverloaded).toBe(true);
    expect(result.shedCount).toBeGreaterThanOrEqual(7);
    expect(result.selectedFocalTarget).not.toBeNull();
    // At most 2 peripheral targets are kept under overload conditions
    expect(result.selectedPeripheralTargets.length).toBeLessThanOrEqual(2);
  });

  it('9. Strict Negative Invariant: Throws error if indiscriminate processing occurs or overload lacks shedding', () => {
    // Fake an invalid evaluation result that admits noise items
    const invalidResult: AttentionEvaluationResult = {
      selectedFocalTarget: {
        stimulusId: crypto.randomUUID(),
        title: 'Noise item',
        type: 'perceptual',
        allocatedFocusPercent: 70,
        salience: {
          novelty: 0.1,
          goalRelevance: 0.1,
          interestRelevance: 0.1,
          emotionalValence: 0.1,
          urgency: 0.1,
          compositeSalience: 0.1, // way below noise threshold
        },
        startedFocusAt: new Date().toISOString(),
        dwellDurationMs: 0,
        isFocal: true,
      },
      selectedPeripheralTargets: [],
      discardedStimuliIds: [],
      isOverloaded: false,
      shedCount: 0,
      summary: 'Invalid result',
    };

    expect(() => {
      assertSelectiveAttentionIntegrity(invalidResult, 4, 0.35);
    }).toThrow(/Negative Invariant Violated: Selective attention accepted low-salience noise/);

    // Overload without shedding invariant
    const invalidOverloadResult: AttentionEvaluationResult = {
      selectedFocalTarget: null,
      selectedPeripheralTargets: [],
      discardedStimuliIds: [],
      isOverloaded: true,
      shedCount: 0,
      summary: 'Overloaded without shedding',
    };

    expect(() => {
      assertSelectiveAttentionIntegrity(invalidOverloadResult, 8, 0.35);
    }).toThrow(
      /Negative Invariant Violated: Attentional overload recognized but no low-priority stimuli were shed/,
    );
  });

  it('10. Persists across SQLite restart, serves REST API endpoints, and integrates into prompt context', async () => {
    const stimulus: AttentionalStimulus = {
      id: crypto.randomUUID(),
      type: 'message',
      source: 'Proof',
      summary: 'Proof asked about attention salience mechanics',
      tags: ['proof', 'attention'],
      noveltyScore: 0.7,
      urgencyScore: 0.8,
      timestamp: new Date().toISOString(),
    };

    attentionEngine.switchFocus(stimulus, 'Testing persistence and REST API', true);
    attentionEngine.updateSustainedAttention(5000);
    const savedState = attentionEngine.captureFocusState();

    // Test ApeService prompt context while database is open
    const apeService = new ApeService(
      apeRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      attentionRepo,
    );

    apeService.switchAttentionFocus(stimulus, 'Integrating into live state prompt', true);
    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('Selective Attention & Salience:');
    expect(promptContext).toContain('Proof asked about attention salience mechanics');
    expect(promptContext).toContain('low-salience noise filtered');

    // Close and reopen database to test restart recovery
    dbService.close();

    const newDbService = new DatabaseService(dbPath);
    const newDb = newDbService.connect();
    const newRepo = new AttentionRepository(newDb);

    const latest = newRepo.getLatestFocusState();
    expect(latest).not.toBeNull();
    expect(latest?.focalTarget?.title).toContain('Proof asked about attention salience mechanics');
    expect(latest?.focalTarget?.dwellDurationMs).toBe(5000);

    const switches = newRepo.listSwitchEvents(10);
    expect(switches.length).toBeGreaterThanOrEqual(1);
    expect(switches.some((s) => s.switchReason === 'Testing persistence and REST API')).toBe(true);

    newDbService.close();

    // Test REST API
    const server = createServer();
    const port = await server.start();

    try {
      // 1. POST /api/ape/attention/evaluate
      const evalRes = await fetch(`http://127.0.0.1:${port}/api/ape/attention/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stimuli: [
            {
              id: crypto.randomUUID(),
              type: 'system_event',
              source: 'test',
              summary: 'Background heartbeat pulse',
              tags: ['heartbeat'],
              noveltyScore: 0.1,
              urgencyScore: 0.1,
              timestamp: new Date().toISOString(),
            },
            {
              id: crypto.randomUUID(),
              type: 'message',
              source: 'Proof',
              summary: 'Proof sent an architectural suggestion',
              tags: ['proof', 'architecture'],
              noveltyScore: 0.8,
              urgencyScore: 0.9,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });
      expect(evalRes.status).toBe(200);
      const evalData = (await evalRes.json()) as any;
      expect(evalData.success).toBe(true);
      expect(evalData.result.selectedFocalTarget.title).toContain(
        'Proof sent an architectural suggestion',
      );
      expect(evalData.result.discardedStimuliIds.length).toBe(1);

      // 2. GET /api/ape/attention/summary
      const sumRes = await fetch(`http://127.0.0.1:${port}/api/ape/attention/summary`);
      expect(sumRes.status).toBe(200);
      const sumData = (await sumRes.json()) as any;
      expect(sumData.focalTitle).toBeDefined();

      // 3. GET /api/ape/attention/focus
      const focusRes = await fetch(`http://127.0.0.1:${port}/api/ape/attention/focus`);
      expect(focusRes.status).toBe(200);
      const focusData = (await focusRes.json()) as any;
      expect(focusData.id).toBeDefined();
    } finally {
      await server.stop();
    }
  });
});
