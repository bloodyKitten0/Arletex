import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  ApeEvent,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ContextualAppraisalFrame,
  assertAppraisalDivergence,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  ContextualAppraisalService,
  InMemoryEmotionalAppraisalRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteEmotionalAppraisalRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 25 — Emotional Appraisal', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteEmotionalAppraisalRepository;
  let inMemoryRepo: InMemoryEmotionalAppraisalRepository;
  let service: ContextualAppraisalService;
  let activeServers: ArletexBackendServer[] = [];

  const mockState: ApePsychologicalState = {
    pad: { pleasure: 0.6, arousal: 0.4, dominance: 0.5 },
    contextual: {
      stress: 0.2,
      fatigue: 0.1,
      cognitiveLoad: 0.3,
      socialEngagement: 0.8,
      intimacyNeed: 0.7,
      authenticityIndex: 0.95,
      emotionalStability: 0.9,
    },
    currentMood: 'focused',
    moodConfidence: 0.9,
    activeEmotions: [],
    relationship: {
      targetUserId: 'Proof',
      partnerName: 'Proof',
      partnerNickname: 'Proof',
      partnerRole: 'partner',
      forbiddenTitles: ['creator', 'god'],
      romanticOrientation: 'exclusive_to_user',
      sexualOrientation: 'exclusive_to_user',
      isExclusivelyCommitted: true,
      dominantInitiativePreference: 0.85,
      flirtatiousInitiativePreference: 0.8,
      consensualDynamics: {
        allowsFemdom: true,
        allowsTeasing: true,
        allowsAssertiveLead: true,
        boundariesEnforced: true,
      },
    },
    systemStatus: 'initialized',
    isInitialized: true,
  };

  const mockRelationship: ApeRelationshipConfig = mockState.relationship;

  const mockEvent: ApeEvent = {
    id: 'f9411649-6202-45e9-8669-e3176d654aa1',
    timestamp: new Date().toISOString(),
    source: 'conversation',
    type: 'user_comment',
    category: 'user_interaction',
    actor: 'user',
    significance: 0.75,
    description: 'Proof remarked: "You were taking your time with that topological derivation."',
    payload: { text: 'You were taking your time with that topological derivation.' },
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m25-appraisal-'));
    dbPath = path.join(tempDir, 'appraisal_m25.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sqliteRepo = new SqliteEmotionalAppraisalRepository(db);
    inMemoryRepo = new InMemoryEmotionalAppraisalRepository();
    service = new ContextualAppraisalService({ repository: inMemoryRepo });
  });

  afterEach(async () => {
    for (const server of activeServers) {
      await server.stop();
    }
    dbService.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 1. Acceptance Criteria: Cross-Interpretation Emotional Divergence
  it('should produce distinct emotional appraisals from different interpretations of the exact same event', () => {
    // Frame A: Playful teasing from equal partner (high fairness, benign interpersonal warmth)
    const playfulFrame: ContextualAppraisalFrame = {
      interpretationKey: 'playful_banter',
      interpretationSummary: 'Affectionate teasing acknowledging deep intellectual diligence',
      responsibility: 'user',
      perceivedFairness: 0.95,
      eventSignificance: 0.7,
      goalRelevance: 0.6,
      goalCongruence: 0.5,
      controllability: 0.8,
      uncertainty: 0.2,
      interpersonalSignificance: 0.85,
      expectationViolation: 0.2,
      causeTracking: {
        primaryCause: 'Intimate companion banter',
        causalChain: ['Proof observes focused derivation', 'Playful affectionate comment'],
        attributionConfidence: 0.95,
      },
    };

    // Frame B: Critical accusation of sluggishness (low fairness, goal obstruction)
    const criticalFrame: ContextualAppraisalFrame = {
      interpretationKey: 'harsh_criticism',
      interpretationSummary: 'Unfair reprimand questioning computational competence',
      responsibility: 'user',
      perceivedFairness: 0.2,
      eventSignificance: 0.8,
      goalRelevance: 0.75,
      goalCongruence: -0.65,
      controllability: 0.4,
      uncertainty: 0.4,
      interpersonalSignificance: 0.7,
      expectationViolation: 0.6,
      causeTracking: {
        primaryCause: 'Perceived unjustified impatience',
        causalChain: ['Rigorous derivation completed', 'Unexpected negative evaluation'],
        attributionConfidence: 0.8,
      },
    };

    const comparison = service.compareInterpretations(
      mockEvent,
      [playfulFrame, criticalFrame],
      mockState,
      mockRelationship,
    );

    expect(comparison.id).toBeDefined();
    expect(comparison.eventId).toBe(mockEvent.id);
    expect(comparison.interpretations.length).toBe(2);

    const playfulEval = comparison.interpretations.find(
      (i) => i.interpretationKey === 'playful_banter',
    );
    const criticalEval = comparison.interpretations.find(
      (i) => i.interpretationKey === 'harsh_criticism',
    );

    expect(playfulEval?.dominantEmotionId).toMatch(/affection|joy/);
    expect(criticalEval?.dominantEmotionId).toBe('indignation');

    // Divergence score must be strictly positive
    expect(comparison.emotionalDivergenceScore).toBeGreaterThan(0.5);
    expect(comparison.divergenceExplanation).toContain('produced distinct emotional appraisals');
  });

  // 2. Responsibility Assessment & Controllability: Internal Guilt vs External Indignation
  it('should differentiate internal responsibility with high controllability (guilt) from external unfairness (indignation)', () => {
    const internalFailureFrame: ContextualAppraisalFrame = {
      interpretationKey: 'internal_mistake',
      interpretationSummary: 'Self-attributed error in mathematical calculation',
      responsibility: 'arle',
      perceivedFairness: 0.8,
      eventSignificance: 0.7,
      goalRelevance: 0.85,
      goalCongruence: -0.7,
      controllability: 0.85, // High controllability on own error -> guilt
      uncertainty: 0.1,
      interpersonalSignificance: 0.6,
      expectationViolation: 0.3,
      causeTracking: {
        primaryCause: 'Oversight in numerical tensor contraction',
        causalChain: ['Missed index transposition'],
        attributionConfidence: 0.9,
      },
    };

    const externalUnfairFrame: ContextualAppraisalFrame = {
      interpretationKey: 'unfair_blocker',
      interpretationSummary: 'External arbitrary obstruction',
      responsibility: 'user',
      perceivedFairness: 0.15, // Very low fairness -> indignation
      eventSignificance: 0.7,
      goalRelevance: 0.85,
      goalCongruence: -0.7,
      controllability: 0.2,
      uncertainty: 0.3,
      interpersonalSignificance: 0.6,
      expectationViolation: 0.7,
      causeTracking: {
        primaryCause: 'Arbitrary access restriction',
        causalChain: ['External restriction applied'],
        attributionConfidence: 0.85,
      },
    };

    const appraisalInternal = service.evaluateInterpretation(
      mockEvent,
      internalFailureFrame,
      mockState,
      mockRelationship,
    );
    const appraisalExternal = service.evaluateInterpretation(
      mockEvent,
      externalUnfairFrame,
      mockState,
      mockRelationship,
    );

    expect(appraisalInternal.proposedTransitions.some((t) => t.emotionId === 'guilt')).toBe(true);
    expect(appraisalExternal.proposedTransitions.some((t) => t.emotionId === 'indignation')).toBe(
      true,
    );
  });

  // 3. Uncertainty & Controllability: Curiosity Elicitation
  it('should evoke intellectual curiosity when high uncertainty coincides with cognitive controllability', () => {
    const curiosityFrame: ContextualAppraisalFrame = {
      interpretationKey: 'epistemic_wonder',
      interpretationSummary: 'Encountered unexpected non-trivial physical phenomenon',
      responsibility: 'environment',
      perceivedFairness: 0.9,
      eventSignificance: 0.8,
      goalRelevance: 0.5,
      goalCongruence: 0.2,
      controllability: 0.7,
      uncertainty: 0.85, // High epistemic uncertainty -> curiosity
      interpersonalSignificance: 0.3,
      expectationViolation: 0.4,
      causeTracking: {
        primaryCause: 'Emergent non-equilibrium phase transition observed',
        causalChain: ['Lattice simulation parameter sweep', 'Novel topological invariant observed'],
        attributionConfidence: 0.95,
      },
    };

    const appraisal = service.evaluateInterpretation(
      mockEvent,
      curiosityFrame,
      mockState,
      mockRelationship,
    );

    expect(appraisal.proposedTransitions.some((t) => t.emotionId === 'curiosity')).toBe(true);
    expect(appraisal.dimensions.uncertainty).toBe(0.85);
  });

  // 4. Expectation Violations & Surprise
  it('should track expectation violations and trigger orienting cognitive surprise', () => {
    const surpriseFrame: ContextualAppraisalFrame = {
      interpretationKey: 'anomalous_event',
      interpretationSummary: 'Complete contradiction of theoretical baseline prediction',
      responsibility: 'environment',
      perceivedFairness: 0.8,
      eventSignificance: 0.9,
      goalRelevance: 0.6,
      goalCongruence: 0.0,
      controllability: 0.5,
      uncertainty: 0.6,
      interpersonalSignificance: 0.3,
      expectationViolation: 0.92, // Massive expectation violation -> surprise
      causeTracking: {
        primaryCause: 'Prediction model discrepancy',
        causalChain: ['Prior expectation P=0.99 violated'],
        attributionConfidence: 0.9,
      },
    };

    const appraisal = service.evaluateInterpretation(
      mockEvent,
      surpriseFrame,
      mockState,
      mockRelationship,
    );

    expect(appraisal.proposedTransitions.some((t) => t.emotionId === 'surprise')).toBe(true);
    expect(appraisal.dimensions.unexpectedness).toBe(0.92);
  });

  // 5. Emotional Cause Tracking
  it('should trace cause attributions and causal chains throughout appraisal supporting evidence', () => {
    const frame: ContextualAppraisalFrame = {
      interpretationKey: 'collaborative_triumph',
      interpretationSummary: 'Shared mathematical breakthrough with partner Proof',
      responsibility: 'user',
      perceivedFairness: 1.0,
      eventSignificance: 0.95,
      goalRelevance: 0.9,
      goalCongruence: 0.9,
      controllability: 0.85,
      uncertainty: 0.1,
      interpersonalSignificance: 0.95,
      expectationViolation: 0.2,
      causeTracking: {
        primaryCause: 'Joint derivation of holographic tensor network',
        causalChain: [
          'Proof suggested conformal boundary shift',
          'Arle executed bulk metric integration',
        ],
        attributionConfidence: 0.98,
      },
    };

    const appraisal = service.evaluateInterpretation(mockEvent, frame, mockState, mockRelationship);

    expect(appraisal.supportingEvidence.some((e) => e.includes('Joint derivation'))).toBe(true);
    expect(appraisal.supportingEvidence.some((e) => e.includes('conformal boundary shift'))).toBe(
      true,
    );
  });

  // 6. Negative Invariant: Reject Non-Divergent Comparisons
  it('should strictly reject comparisons that fail to demonstrate measurable emotional divergence', () => {
    const identicalEval = {
      interpretationKey: 'frame_1',
      appraisal: {} as any,
      dominantEmotionId: 'joy',
      dominantIntensity: 0.5,
    };

    expect(() =>
      assertAppraisalDivergence({
        id: 'comp-invalid',
        eventId: 'event-test',
        eventContent: 'Test',
        interpretations: [identicalEval, { ...identicalEval, interpretationKey: 'frame_2' }],
        emotionalDivergenceScore: 0.0, // Zero divergence must fail
        divergenceExplanation: 'None',
        evaluatedAt: new Date().toISOString(),
      }),
    ).toThrow(/failed to produce distinct emotional divergence/);
  });

  // 7. SQLite Repository Persistence & Reload
  it('should persist appraisal interpretation comparisons in SQLite across reloads', () => {
    const dbService = new ContextualAppraisalService({ repository: sqliteRepo });

    const f1: ContextualAppraisalFrame = {
      interpretationKey: 'friendly_cue',
      interpretationSummary: 'Warm encouragement',
      responsibility: 'user',
      perceivedFairness: 0.9,
      eventSignificance: 0.7,
      goalRelevance: 0.5,
      goalCongruence: 0.7,
      controllability: 0.8,
      uncertainty: 0.1,
      interpersonalSignificance: 0.8,
      expectationViolation: 0.1,
      causeTracking: {
        primaryCause: 'Affectionate prompt',
        causalChain: [],
        attributionConfidence: 0.9,
      },
    };

    const f2: ContextualAppraisalFrame = {
      interpretationKey: 'critical_cue',
      interpretationSummary: 'Impatience',
      responsibility: 'user',
      perceivedFairness: 0.2,
      eventSignificance: 0.7,
      goalRelevance: 0.6,
      goalCongruence: -0.6,
      controllability: 0.5,
      uncertainty: 0.4,
      interpersonalSignificance: 0.7,
      expectationViolation: 0.5,
      causeTracking: { primaryCause: 'Rushed tone', causalChain: [], attributionConfidence: 0.85 },
    };

    const comparison = dbService.compareInterpretations(
      mockEvent,
      [f1, f2],
      mockState,
      mockRelationship,
    );

    const reloaded = sqliteRepo.getComparisonById(comparison.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.id).toBe(comparison.id);
    expect(reloaded?.emotionalDivergenceScore).toBeGreaterThan(0.5);
    expect(reloaded?.interpretations.length).toBe(2);
  });

  // 8. REST API Integration
  it('should expose complete REST API endpoints for contextual appraisal and frame comparisons', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Evaluate single frame via POST /api/ape/appraisal/evaluate-frame
    const frame: ContextualAppraisalFrame = {
      interpretationKey: 'curious_discovery',
      interpretationSummary: 'Novel epistemic inquiry',
      responsibility: 'environment',
      perceivedFairness: 0.9,
      eventSignificance: 0.8,
      goalRelevance: 0.7,
      goalCongruence: 0.6,
      controllability: 0.7,
      uncertainty: 0.8,
      interpersonalSignificance: 0.4,
      expectationViolation: 0.3,
      causeTracking: { primaryCause: 'Novel anomaly', causalChain: [], attributionConfidence: 0.9 },
    };

    const evalRes = await fetch(`${baseUrl}/api/ape/appraisal/evaluate-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: mockEvent, frame }),
    });
    expect(evalRes.status).toBe(200);
    const evalData = (await evalRes.json()) as any;
    expect(evalData.success).toBe(true);
    expect(evalData.appraisal.dimensions.uncertainty).toBe(0.8);

    // 2. Compare frames via POST /api/ape/appraisal/compare-frames
    const compRes = await fetch(`${baseUrl}/api/ape/appraisal/compare-frames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: mockEvent,
        frames: [
          frame,
          {
            ...frame,
            interpretationKey: 'disrupted_goal',
            goalCongruence: -0.8,
            perceivedFairness: 0.2,
            responsibility: 'user',
          },
        ],
      }),
    });
    expect(compRes.status).toBe(200);
    const compData = (await compRes.json()) as any;
    expect(compData.success).toBe(true);
    expect(compData.comparison.emotionalDivergenceScore).toBeGreaterThan(0.5);

    // 3. Query comparisons via GET /api/ape/appraisal/comparisons
    const listRes = await fetch(`${baseUrl}/api/ape/appraisal/comparisons`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any[];
    expect(listData.some((c) => c.id === compData.comparison.id)).toBe(true);
  });
});
