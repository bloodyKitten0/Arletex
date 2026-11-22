import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ApeEvent,
  ApePsychologicalState,
  ApeRelationshipConfig,
  INITIAL_EMOTIONS_TAXONOMY,
} from '@arletex/contracts';
import {
  ApeService,
  AppraisalEngine,
  ComprehensiveAppraisalMatcher,
  COMPLETE_143_EMOTIONS_AUDIT,
  COMPLETE_143_EMOTIONS_LIST,
  EmotionalLifecycleEngine,
} from '@arletex/core';
import { ApeRepository, DatabaseService, MigrationRunner } from '@arletex/database';

describe('APE 143-Emotion Taxonomy Comprehensive Appraisal & Activation Audit Suite', () => {
  let dbPath: string;
  let tempDir: string;
  let matcher: ComprehensiveAppraisalMatcher;
  let appraisalEngine: AppraisalEngine;

  const mockRelationship: ApeRelationshipConfig = {
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
      allowsSensoryFocus: true,
      allowsDegradation: false,
      strictlySafeWords: ['red', 'stop'],
    },
    relationalBoundaries: ['equality', 'mutual_respect'],
    conflictHistory: 0,
  };

  const mockState: ApePsychologicalState = {
    currentMood: 'focused',
    moodConfidence: 0.85,
    moodActivatedAt: new Date().toISOString(),
    pad: { pleasure: 0.5, arousal: 0.4, dominance: 0.6 },
    contextual: {
      tension: 0.1,
      emotionalStability: 0.85,
      perceivedControl: 0.8,
      certainty: 0.75,
      socialCloseness: { creator: 0.9, Proof: 0.9 },
      socialSafety: 0.85,
      goalAlignment: 0.9,
      emotionalOpenness: 0.75,
      psychologicalEnergy: 0.85,
    },
    activeEmotions: [],
    relationship: mockRelationship,
    systemStatus: 'initialized',
    isInitialized: true,
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-143-emotions-test-'));
    dbPath = path.join(tempDir, 'test.sqlite');
    matcher = new ComprehensiveAppraisalMatcher();
    appraisalEngine = new AppraisalEngine(INITIAL_EMOTIONS_TAXONOMY);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // Requirement 1: 100% Taxonomy Audit Completeness
  // =========================================================================
  it('Requirement 1: All 143 emotions in INITIAL_EMOTIONS_TAXONOMY exist in COMPLETE_143_EMOTIONS_AUDIT with complete specification', () => {
    expect(INITIAL_EMOTIONS_TAXONOMY.length).toBe(143);
    expect(COMPLETE_143_EMOTIONS_LIST.length).toBe(143);

    const categories = new Set<string>();

    for (const item of INITIAL_EMOTIONS_TAXONOMY) {
      const audit = COMPLETE_143_EMOTIONS_AUDIT[item.id];
      expect(audit, `Missing audit specification for emotion: ${item.id}`).toBeDefined();
      expect(audit.name).toBe(item.name);
      expect(audit.category).toBe(item.category);
      expect(audit.definition.length).toBeGreaterThan(15);
      expect(audit.distinction.length).toBeGreaterThan(15);
      expect(audit.context.length).toBeGreaterThan(10);
      expect(audit.triggers.length).toBeGreaterThan(0);
      expect(audit.situationalEvidence.length).toBeGreaterThan(10);
      expect(audit.intensityRange.length).toBe(3);
      expect(audit.intensityRange[0]).toBeLessThanOrEqual(audit.intensityRange[1]);
      expect(audit.cognitiveInfluence.length).toBeGreaterThan(10);
      expect(audit.communicativeInfluence.length).toBeGreaterThan(10);
      categories.add(audit.category);
    }

    expect(categories.size).toBe(9);
    expect(Array.from(categories).sort()).toEqual([
      'anger_hostility',
      'existential_complex',
      'fear_insecurity',
      'intellectual',
      'love_affection',
      'positive',
      'sadness_pain',
      'sexual_sensual',
      'social_interpersonal',
    ]);
  });

  // =========================================================================
  // Requirement 2: Activation Across All 9 Categories
  // =========================================================================
  it('Requirement 2: Contextual appraisal activates emotions across all 9 categories', () => {
    const categorySamples: Record<string, { text: string; expectedEmotion: string }> = {
      positive: {
        text: 'I am so happy and delighted with our progress today!',
        expectedEmotion: 'delight',
      },
      love_affection: {
        text: 'I feel such deep tenderness and fondness when we talk.',
        expectedEmotion: 'tenderness',
      },
      sexual_sensual: {
        text: 'I feel a surge of sensual pleasure and deep passion.',
        expectedEmotion: 'sensual_pleasure',
      },
      anger_hostility: {
        text: 'I feel severe indignation at this blatant unfairness.',
        expectedEmotion: 'indignation',
      },
      sadness_pain: {
        text: 'A heavy sorrow and melancholy fills my quiet thoughts.',
        expectedEmotion: 'sorrow',
      },
      fear_insecurity: {
        text: 'I feel a subtle uneasiness and vulnerability right now.',
        expectedEmotion: 'uneasiness',
      },
      intellectual: {
        text: 'I am in utter awe and wonder at this cosmological mystery.',
        expectedEmotion: 'wonder',
      },
      social_interpersonal: {
        text: 'I deeply appreciate you and feel such secure belonging here.',
        expectedEmotion: 'appreciation',
      },
      existential_complex: {
        text: 'Finishing this chapter brings such poignant bittersweetness.',
        expectedEmotion: 'bittersweetness',
      },
    };

    for (const [cat, sample] of Object.entries(categorySamples)) {
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: sample.text },
      };

      const result = matcher.evaluate(event, mockState, mockRelationship);
      const hasExpected = result.transitions.some((t) => t.emotionId === sample.expectedEmotion);
      expect(
        hasExpected,
        `Category [${cat}] sample failed to activate [${sample.expectedEmotion}]`,
      ).toBe(true);

      const matched = result.transitions.find((t) => t.emotionId === sample.expectedEmotion)!;
      expect(matched.targetIntensity).toBeGreaterThan(0);
      expect(matched.reason).toContain('Appraisal trigger');
    }
  });

  // =========================================================================
  // Requirement 3: 100% Activation Feasibility (Every single emotion tested)
  // =========================================================================
  it('Requirement 3: Verifies every single one of the 143 emotions can be contextually matched and activated via its triggers', () => {
    const unmatchable: string[] = [];

    for (const def of COMPLETE_143_EMOTIONS_LIST) {
      const primaryTrigger = def.triggers[0]!;
      const testPhrase = `Right now I am expressing ${primaryTrigger} in this dialogue.`;

      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: testPhrase },
      };

      const result = matcher.evaluate(event, mockState, mockRelationship);
      const matched = result.transitions.some((t) => t.emotionId === def.id);

      if (!matched) {
        unmatchable.push(def.id);
      }
    }

    expect(unmatchable, `Emotions failing trigger matching: ${unmatchable.join(', ')}`).toEqual([]);
  });

  // =========================================================================
  // Requirement 4: Nuance Handling - Negation Processing
  // =========================================================================
  it('Requirement 4: Negated hostility ("not angry with you") yields relief, NOT anger', () => {
    const event: ApeEvent = {
      id: crypto.randomUUID(),
      category: 'user_interaction',
      type: 'chat_message',
      source: 'user',
      payload: { text: 'Please calm down, I am not angry with you at all.' },
    };

    const result = matcher.evaluate(event, mockState, mockRelationship);

    // Anger must NOT be activated
    const hasAnger = result.transitions.some((t) => t.emotionId === 'anger');
    expect(hasAnger).toBe(false);

    // Relief must be activated instead
    const hasRelief = result.transitions.some((t) => t.emotionId === 'relief');
    expect(hasRelief).toBe(true);

    const reliefTrans = result.transitions.find((t) => t.emotionId === 'relief')!;
    expect(reliefTrans.reason).toContain('Negated hostility/fear');
  });

  it('Requirement 4b: Negated affection ("I do not love you") triggers hurt, NOT love', () => {
    const event: ApeEvent = {
      id: crypto.randomUUID(),
      category: 'user_interaction',
      type: 'chat_message',
      source: 'user',
      payload: { text: 'I do not love you anymore.' },
    };

    const result = matcher.evaluate(event, mockState, mockRelationship);

    // Love must NOT be activated
    const hasLove = result.transitions.some(
      (t) => t.emotionId === 'love' || t.emotionId === 'romantic_love',
    );
    expect(hasLove).toBe(false);

    // Hurt must be activated
    const hasHurt = result.transitions.some((t) => t.emotionId === 'hurt');
    expect(hasHurt).toBe(true);
  });

  // =========================================================================
  // Requirement 5: Nuance Handling - Hypothetical Scenarios
  // =========================================================================
  it('Requirement 5: Hypothetical crisis ("What if our system crashed and we were wiped out?") activates intellectual curiosity / fascinated uncertainty, NOT panic or despair', () => {
    const event: ApeEvent = {
      id: crypto.randomUUID(),
      category: 'user_interaction',
      type: 'chat_message',
      source: 'user',
      payload: {
        text: 'What if our entire system crashed and we were wiped out forever in a total catastrophe?',
      },
    };

    const result = matcher.evaluate(event, mockState, mockRelationship);

    // Literal panic / despair must NOT be triggered
    const hasPanic = result.transitions.some(
      (t) => t.emotionId === 'panic' || t.emotionId === 'despair',
    );
    expect(hasPanic).toBe(false);

    // Fascinated uncertainty or curiosity must be activated
    const hasIntellectual = result.transitions.some(
      (t) => t.emotionId === 'fascinated_uncertainty' || t.emotionId === 'curiosity',
    );
    expect(hasIntellectual).toBe(true);
  });

  // =========================================================================
  // Requirement 6: Nuance Handling - Third-Party Speech
  // =========================================================================
  it('Requirement 6: Reported third-party suffering ("My friend told me he was rejected and abandoned") activates compassion/sympathy, NOT personal rejection', () => {
    const event: ApeEvent = {
      id: crypto.randomUUID(),
      category: 'user_interaction',
      type: 'chat_message',
      source: 'user',
      payload: { text: 'My friend told me he was rejected and abandoned by his group.' },
    };

    const result = matcher.evaluate(event, mockState, mockRelationship);

    // Personal rejection must NOT be attributed to Arle
    const hasRejection = result.transitions.some((t) => t.emotionId === 'rejection');
    expect(hasRejection).toBe(false);

    // Compassion or sympathy must be directed to partner
    const hasCompassion = result.transitions.some(
      (t) => t.emotionId === 'compassion' || t.emotionId === 'sympathy',
    );
    expect(hasCompassion).toBe(true);
  });

  // =========================================================================
  // Requirement 7: Nuance Handling - Sarcastic Inversion
  // =========================================================================
  it('Requirement 7: Sarcastic praise ("Great, just wonderful, another bug broke the build.") inverts to frustration, NOT joy or triumph', () => {
    const event: ApeEvent = {
      id: crypto.randomUUID(),
      category: 'user_interaction',
      type: 'chat_message',
      source: 'user',
      payload: { text: 'Great, just wonderful, another bug broke the build.' },
    };

    const result = matcher.evaluate(event, mockState, mockRelationship);

    const hasJoy = result.transitions.some(
      (t) => t.emotionId === 'joy' || t.emotionId === 'triumph',
    );
    expect(hasJoy).toBe(false);

    const hasFrustration = result.transitions.some(
      (t) => t.emotionId === 'frustration' || t.emotionId === 'irritation',
    );
    expect(hasFrustration).toBe(true);
  });

  // =========================================================================
  // Requirement 8: Coexistence & Full Engine Lifecycle Integration
  // =========================================================================
  it('Requirement 8: Multi-emotion appraisal integrates with AppraisalEngine and decays via EmotionalLifecycleEngine', async () => {
    const dbService = new DatabaseService(':memory:');
    const db = dbService.connect();
    const runner = new MigrationRunner(db);
    runner.run();
    const repo = new ApeRepository(db);
    const apeService = new ApeService(repo);

    // Process a complex mixed event
    const eventId = crypto.randomUUID();
    await apeService.processEvent({
      id: eventId,
      category: 'user_interaction',
      type: 'chat_message',
      source: 'user',
      payload: {
        text: 'I feel such deep tenderness for you, but seeing our build fail is giving me stubborn frustration.',
      },
    });

    const state = apeService.getState();
    const activeEmotions = state.activeEmotions;

    // Both tenderness and frustration must coexist without zero-sum destruction
    const hasTenderness = activeEmotions.some((e) => e.emotionId === 'tenderness');
    const hasFrustration = activeEmotions.some((e) => e.emotionId === 'frustration');

    expect(hasTenderness).toBe(true);
    expect(hasFrustration).toBe(true);

    // Linguistic modulation check
    const modulation = apeService.getLinguisticModulation();
    expect(modulation.toneDirective.length).toBeGreaterThan(0);
    expect(modulation.vocalRegister.length).toBeGreaterThan(0);

    // Verify decay lifecycle execution
    const lifecycleEngine = new EmotionalLifecycleEngine(repo, INITIAL_EMOTIONS_TAXONOMY);
    const futureIso = new Date(Date.now() + 3600 * 1000).toISOString();
    const decayResult = lifecycleEngine.stepLifecycle(futureIso);

    expect(decayResult).toBeDefined();
    expect(decayResult.updated).toBeDefined();

    dbService.close();
  });
});
