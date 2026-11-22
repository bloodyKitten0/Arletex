import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseService, ApeRepository, MigrationRunner } from '@arletex/database';
import { ApeService } from '@arletex/core';

describe('APE Milestone 5: Functional Completion, Causal Consistency, and Lifecycle Integrity', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let apeService: ApeService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-ape-milestone5-'));
    dbPath = path.join(tempDir, 'ape_milestone5.sqlite');
    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    new MigrationRunner(db).run();
    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo);
  });

  afterEach(() => {
    dbService.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // ==========================================
  // 1. Contextual Appraisal Nuance
  // ==========================================
  describe('1. Contextual Appraisal Nuance', () => {
    it('appraises third-party mistreatment of user as empathy/compassion, not personal defensiveness', async () => {
      const result = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        actor: 'user',
        payload: {
          text: 'My boss yelled at me and blamed me for the server outage today.',
        },
      });

      expect(result.processed).toBe(true);
      const appraisal = result.appraisal;
      // Perceived threat to Arle should be minimal
      expect(appraisal.dimensions.threat).toBeLessThanOrEqual(0.3);

      // Transitions should target partner/creator with compassion or warmth
      const proposed = appraisal.proposedTransitions;
      const targets = proposed.map((t) => t.target);
      expect(targets.some((t) => t === 'creator' || t === 'partner' || t === 'other')).toBe(true);
      const emotionIds = proposed.map((t) => t.emotionId);
      expect(
        emotionIds.some((id) =>
          [
            'empathy',
            'compassion',
            'protective_concern',
            'tenderness',
            'concern',
            'warmth',
          ].includes(id),
        ),
      ).toBe(true);
    });

    it('appraises direct critique of Arle with intellectual humility and determination rather than defensiveness', async () => {
      const result = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        actor: 'user',
        payload: {
          text: 'Arle, you made a mistake in this logic; your answer was flawed and incorrect.',
        },
      });

      expect(result.processed).toBe(true);
      const appraisal = result.appraisal;
      const proposed = appraisal.proposedTransitions;
      const emotionIds = proposed.map((t) => t.emotionId);

      expect(emotionIds).toContain('acceptance');
      expect(emotionIds).toContain('purposefulness');
      expect(appraisal.proposedMoodShift).toBe('focused');
      expect(appraisal.dimensions.threat).toBeLessThanOrEqual(0.3);
    });

    it('identifies sarcastic praise with inverted congruence and heightened uncertainty', async () => {
      const result = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        actor: 'user',
        payload: {
          text: 'Great, just wonderful.',
        },
      });

      expect(result.processed).toBe(true);
      const appraisal = result.appraisal;
      // Sarcasm must not be naively appraised as positive goal congruence
      expect(appraisal.dimensions.uncertainty).toBeGreaterThanOrEqual(0.6);
      expect(appraisal.dimensions.goalCongruence).toBeLessThanOrEqual(0.0);
    });

    it('evaluates hypothetical conflict with curiosity and inquiry, not emotional trauma', async () => {
      const result = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        actor: 'user',
        payload: {
          text: 'What if I criticized you in a hypothetical scenario?',
        },
      });

      expect(result.processed).toBe(true);
      const appraisal = result.appraisal;
      expect(appraisal.dimensions.threat).toBeLessThanOrEqual(0.3);
      expect(appraisal.proposedTransitions.some((t) => t.emotionId === 'curiosity')).toBe(true);
    });

    it('evaluates negated hostility or critique with composure and reassurance', async () => {
      const result = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        actor: 'user',
        payload: {
          text: "I am not angry with you, and you're not wrong.",
        },
      });

      expect(result.processed).toBe(true);
      const appraisal = result.appraisal;
      expect(appraisal.dimensions.threat).toBeLessThanOrEqual(0.2);
      expect(appraisal.dimensions.goalCongruence).toBeGreaterThanOrEqual(0.3);
    });
  });

  // ==========================================
  // 2. Affective Transition & Lifecycle Integrity
  // ==========================================
  describe('2. Affective Transition & Lifecycle Integrity', () => {
    it('enforces zero-delta guards so targetIntensity cannot bypass zero delta for assistant expressions', async () => {
      const now = new Date().toISOString();
      apeRepo.saveActiveEmotion({
        id: crypto.randomUUID(),
        emotionId: 'joy',
        intensity: 0.5,
        confidence: 0.9,
        activatedAt: now,
        lastUpdatedAt: now,
        durationMs: 0,
        persistence: 'medium_term',
        triggerEventId: 'test-init',
        target: 'partner',
        context: 'Initial shared milestone',
        interpretation: 'Initial shared milestone',
        supportingEvidence: [],
        relatedMemoryIds: [],
        relatedEmotionIds: [],
        resolutionConditions: [],
        status: 'active',
      });

      // Assistant expresses intense verbal joy
      await apeService.processEvent({
        category: 'user_interaction',
        type: 'assistant_dialogue_output',
        source: 'arle',
        actor: 'arle',
        eventKind: 'assistant_expression',
        payload: { text: 'I am so intensely joyful and euphoric right now!' },
      });

      const emotion = apeRepo.getActiveEmotions().find((e) => e.emotionId === 'joy');
      expect(emotion).toBeDefined();
      // Intensity must not have inflated due to Arle's own words!
      expect(emotion!.intensity).toBe(0.5);
    });

    it('initiates newly activated moderate emotions in the emerging state (< 0.75)', () => {
      const transitionEngine = apeService.transitionEngine;
      const initialAffective = apeRepo.getAffectiveState();
      const relationshipConfig = apeRepo.getRelationshipConfig();
      const eventId = crypto.randomUUID();

      const updated = transitionEngine.applyAppraisal(
        {
          id: 'test-appraisal-emerging',
          eventId,
          dimensions: {
            goalRelevance: 0.6,
            goalCongruence: 0.6,
            unexpectedness: 0.3,
            responsibility: 'user',
            intentionality: 0.5,
            fairness: 0.8,
            threat: 0.0,
            controllability: 0.8,
            socialMeaning: 'Warm greeting',
            personalSignificance: 0.5,
            uncertainty: 0.1,
            relationshipImplications: 'Positive',
          },
          primaryInterpretation: 'Warm interaction',
          alternativeInterpretations: [],
          supportingEvidence: ['User greeted Arle warmly'],
          proposedTransitions: [
            {
              emotionId: 'warmth',
              target: 'partner',
              intensityDelta: 0.3,
              targetIntensity: 0.5,
              reason: 'Warm connection',
            },
          ],
          appraisalMethod: 'deterministic',
        },
        {
          id: eventId,
          category: 'user_interaction',
          type: 'greeting',
          source: 'user',
          actor: 'user',
          timestamp: new Date().toISOString(),
        },
        initialAffective,
        relationshipConfig,
      );

      const warmth = updated.activeEmotions.find((e) => e.emotionId === 'warmth');
      expect(warmth).toBeDefined();
      expect(warmth!.status).toBe('emerging');
    });

    it('prevents dormant emotions from reactivating on unrelated events', () => {
      const now = Date.now();
      const ancientTime = new Date(now - 86400000).toISOString();
      const recentTime = new Date(now - 3600000).toISOString();

      apeRepo.saveActiveEmotion({
        id: crypto.randomUUID(),
        emotionId: 'grief',
        intensity: 0.05,
        confidence: 0.8,
        activatedAt: ancientTime,
        lastUpdatedAt: recentTime,
        durationMs: 0,
        persistence: 'long_term',
        triggerEventId: 'past-event',
        target: 'self',
        context: 'Past solemn memory',
        interpretation: 'Past solemn memory',
        supportingEvidence: [],
        relatedMemoryIds: [],
        relatedEmotionIds: [],
        resolutionConditions: [],
        status: 'dormant',
      });

      const initialAffective = apeRepo.getAffectiveState();
      const relationshipConfig = apeRepo.getRelationshipConfig();
      const chessEventId = crypto.randomUUID();

      // Process completely unrelated chess move
      const updated = apeService.transitionEngine.applyAppraisal(
        {
          id: 'test-unrelated',
          eventId: chessEventId,
          dimensions: {
            goalRelevance: 0.5,
            goalCongruence: 0.5,
            unexpectedness: 0.1,
            responsibility: 'user',
            intentionality: 0.5,
            fairness: 0.5,
            threat: 0.0,
            controllability: 0.9,
            socialMeaning: 'Chess discussion',
            personalSignificance: 0.3,
            uncertainty: 0.1,
            relationshipImplications: 'Neutral',
          },
          primaryInterpretation: 'Chess tactical analysis',
          alternativeInterpretations: [],
          supportingEvidence: ['User discussed chess'],
          proposedTransitions: [
            {
              emotionId: 'interest',
              target: 'task',
              intensityDelta: 0.2,
              targetIntensity: 0.6,
              reason: 'Focus on chess position',
            },
          ],
          appraisalMethod: 'deterministic',
        },
        {
          id: chessEventId,
          category: 'user_interaction',
          type: 'chess_move',
          source: 'user',
          actor: 'user',
          timestamp: new Date().toISOString(),
        },
        initialAffective,
        relationshipConfig,
      );

      const dormantGrief = updated.activeEmotions.find((e) => e.emotionId === 'grief');
      expect(dormantGrief).toBeDefined();
      // Must remain dormant!
      expect(dormantGrief!.status).toBe('dormant');
    });

    it('transitions resolved emotions into historical state during lifecycle stepping', () => {
      const now = Date.now();
      const ancientTime = new Date(now - 72 * 60 * 60 * 1000).toISOString(); // 72 hours ago

      apeRepo.saveActiveEmotion({
        id: crypto.randomUUID(),
        emotionId: 'frustration',
        intensity: 0.0,
        confidence: 0.8,
        activatedAt: ancientTime,
        lastUpdatedAt: ancientTime,
        durationMs: 0,
        persistence: 'short_term',
        triggerEventId: 'ancient-test-event',
        target: 'task',
        context: 'Temporary compiler defect',
        interpretation: 'Temporary compiler defect',
        supportingEvidence: [],
        relatedMemoryIds: [],
        relatedEmotionIds: [],
        resolutionConditions: [],
        status: 'resolved',
      });

      // Run lifecycle step
      apeService.stepLifecycle();

      // Frustration is no longer in active emotions
      const activeFrustration = apeRepo
        .getActiveEmotions()
        .find((e) => e.emotionId === 'frustration');
      expect(activeFrustration).toBeUndefined();

      // But it is consolidated to historical status
      const historical = apeRepo.getActiveEmotions('historical');
      expect(historical.some((h) => h.emotionId === 'frustration')).toBe(true);
    });

    it('preserves unresolved grievances as dormant rather than wiping them due to age', () => {
      const ancientTime = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      apeRepo.saveActiveEmotion({
        id: crypto.randomUUID(),
        emotionId: 'indignation',
        intensity: 0.05,
        confidence: 0.9,
        activatedAt: ancientTime,
        lastUpdatedAt: ancientTime,
        durationMs: 0,
        persistence: 'long_term',
        triggerEventId: 'boundary-violation-event',
        target: 'other',
        context: 'Unresolved grievance: boundary violation',
        interpretation: 'Unresolved grievance: boundary violation',
        supportingEvidence: [],
        relatedMemoryIds: [],
        relatedEmotionIds: [],
        resolutionConditions: [],
        status: 'diminishing',
      });

      apeService.stepLifecycle();

      // Indignation should NOT be marked resolved; it should transition to dormant
      const indignation = apeRepo.getActiveEmotions().find((e) => e.emotionId === 'indignation');
      expect(indignation).toBeDefined();
      expect(indignation!.status).toBe('dormant');
    });

    it('guarantees getState() is a pure read without side-effects or mutations', () => {
      const beforeState = apeService.getState();
      const beforeEmotionsCount = beforeState.activeEmotions.length;

      // Repeated read
      const afterState = apeService.getState();
      expect(afterState.activeEmotions.length).toBe(beforeEmotionsCount);
      expect(afterState.currentMood).toBe(beforeState.currentMood);
    });
  });

  // ==========================================
  // 3. Motivational Engine Dynamic Initiatives & Goal Stages
  // ==========================================
  describe('3. Motivational Engine Dynamic Initiatives & Goal Stages', () => {
    it('generates diverse initiatives without immediate repetitions using cooldowns', () => {
      const motivational = apeService.motivationalEngine;

      const firstBatch = motivational.generateCandidateInitiatives({
        activeInterests: ['Computational Algebraic Topology', 'Bobby Fischer Games'],
        unresolvedGoalTitles: ['Refactor SQLite APE Schema'],
      });

      expect(firstBatch.length).toBeGreaterThan(0);

      // Second immediate generation should respect cooldowns and provide diverse results
      const secondBatch = motivational.generateCandidateInitiatives({
        activeInterests: ['Computational Algebraic Topology', 'Bobby Fischer Games'],
      });

      expect(secondBatch.length).toBeGreaterThan(0);
      // Both batches should have valid non-empty initiatives
      expect(firstBatch.every((i) => i.length > 5)).toBe(true);
      expect(secondBatch.every((i) => i.length > 5)).toBe(true);
    });

    it('distinguishes desire -> committed intention -> active execution stages', () => {
      const motivational = apeService.motivationalEngine;

      // 1. Desire
      const desire = motivational.createDesire({
        title: 'Study Nimzo-Indian Defense deep lines',
        description: 'Explore positional sacrifices in modern chess theory',
        motivation: 'Intellectual curiosity and competitive depth',
      });
      expect(desire.status).toBe('desired');

      // 2. Commit intention
      const committed = motivational.commitGoal(desire.id);
      expect(committed).toBe(true);
      const stateAfterCommit = motivational.getState();
      const committedGoal = stateAfterCommit.goals.find((g) => g.id === desire.id);
      expect(committedGoal?.status).toBe('committed');

      // 3. Activate execution
      const activated = motivational.activateGoal(desire.id);
      expect(activated).toBe(true);
      const stateAfterActive = motivational.getState();
      const activeGoal = stateAfterActive.goals.find((g) => g.id === desire.id);
      expect(activeGoal?.status).toBe('active');
    });

    it('does not inflate autonomy need on standard dialogue outputs', () => {
      const initialAutonomy = apeService.getMasterState().motivational.needs.autonomy;

      apeService.motivationalEngine.updateNeedsOnEvent(
        {
          id: crypto.randomUUID(),
          category: 'user_interaction',
          type: 'assistant_dialogue_output',
          source: 'arle',
          actor: 'arle',
          eventKind: 'assistant_expression',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'test-appraisal',
          eventId: 'test-event',
          dimensions: {
            goalRelevance: 0.1,
            goalCongruence: 0.5,
            unexpectedness: 0.0,
            responsibility: 'arle',
            intentionality: 1.0,
            fairness: 1.0,
            threat: 0.0,
            controllability: 1.0,
            socialMeaning: 'Assistant response',
            personalSignificance: 0.1,
            uncertainty: 0.0,
            relationshipImplications: 'Dialogue',
          },
          primaryInterpretation: 'Assistant dialogue output',
          alternativeInterpretations: [],
          supportingEvidence: [],
          proposedTransitions: [],
          appraisalMethod: 'deterministic',
        },
      );

      const finalAutonomy = apeService.getMasterState().motivational.needs.autonomy;
      expect(finalAutonomy).toBe(initialAutonomy);
    });
  });

  // ==========================================
  // 4. Relational Engine Nuance & Target Apologies
  // ==========================================
  describe('4. Relational Engine Nuance & Targeted Apology Resolution', () => {
    it('does not log conflict or degrade trust on ordinary intellectual disagreement', () => {
      const relEngine = apeService.relationshipEngine;
      const initialTrust = relEngine.getState().trustLevel;

      relEngine.processInteraction(
        {
          id: crypto.randomUUID(),
          category: 'user_interaction',
          type: 'chat_message',
          source: 'user',
          actor: 'user',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'disagreement-appraisal',
          eventId: 'test',
          dimensions: {
            goalRelevance: 0.5,
            goalCongruence: 0.0,
            unexpectedness: 0.2,
            responsibility: 'user',
            intentionality: 0.5,
            fairness: 0.8,
            threat: 0.0,
            controllability: 0.9,
            socialMeaning: 'Intellectual disagreement on design tradeoff',
            personalSignificance: 0.5,
            uncertainty: 0.1,
            relationshipImplications: 'Constructive dialectic',
          },
          primaryInterpretation: 'Disagreement on approach',
          alternativeInterpretations: [],
          supportingEvidence: ['Different perspective shared'],
          proposedTransitions: [],
          appraisalMethod: 'deterministic',
        },
      );

      const state = relEngine.getState();
      expect(state.conflictHistory.length).toBe(0);
      expect(state.trustLevel).toBeGreaterThanOrEqual(initialTrust);
    });

    it('resolves only addressed conflict on apology, preserving other unresolved grievances', () => {
      const relEngine = apeService.relationshipEngine;

      // Seed two conflicts: one about late arrival, one about broken promise
      relEngine.recordConflict('Severe miscommunication on deadlines');
      relEngine.recordConflict('Harsh tone during heated argument');

      const conflictsBefore = relEngine.getState().conflictHistory;
      expect(conflictsBefore.length).toBe(2);

      // User apologizes specifically for harsh tone / heated argument
      relEngine.processApology(0.9, 'harsh tone during heated argument');

      const conflictsAfter = relEngine.getState().conflictHistory;
      const resolvedConflict = conflictsAfter.find((c) => c.issue.includes('Harsh tone'));
      const remainingConflict = conflictsAfter.find((c) => c.issue.includes('miscommunication'));

      expect(resolvedConflict?.resolved).toBe(true);
      expect(remainingConflict?.resolved).toBe(false);
    });

    it('prevents mechanical compounding of intimacy depth via intimacy cooldown', () => {
      const relEngine = apeService.relationshipEngine;
      const initialDepth = relEngine.getState().intimacyDepth;

      // Send 3 rapid affectionate interactions
      for (let i = 0; i < 3; i++) {
        relEngine.processInteraction(
          {
            id: crypto.randomUUID(),
            category: 'user_interaction',
            type: 'affectionate_remark',
            source: 'user',
            actor: 'user',
            timestamp: new Date().toISOString(),
          },
          {
            id: `aff-${i}`,
            eventId: `evt-${i}`,
            dimensions: {
              goalRelevance: 0.7,
              goalCongruence: 0.8,
              unexpectedness: 0.1,
              responsibility: 'user',
              intentionality: 0.9,
              fairness: 1.0,
              threat: 0.0,
              controllability: 1.0,
              socialMeaning: 'affection',
              personalSignificance: 0.8,
              uncertainty: 0.0,
              relationshipImplications: 'Deepened closeness',
            },
            primaryInterpretation: 'Affectionate remark',
            alternativeInterpretations: [],
            supportingEvidence: ['User expressed affection'],
            proposedTransitions: [],
            appraisalMethod: 'deterministic',
          },
        );
      }

      const endDepth = relEngine.getState().intimacyDepth;
      // Intimacy depth should increase by at most one increment (0.02) due to cooldown, NOT 3x compounded
      expect(Number((endDepth - initialDepth).toFixed(3))).toBe(0.02);
    });
  });

  // ==========================================
  // 5. Self-Model & Development Engine Grounding
  // ==========================================
  describe('5. Self-Model & Development Engine Grounding', () => {
    it('records failed operations as limitations and NEVER as demonstrated capabilities', () => {
      const selfModel = apeService.selfModelEngine;

      selfModel.recordOperationOutcome({
        operation: 'Automated Kernel Compilation',
        success: false,
        evidence: 'Compilation terminated with signal 9: out of memory',
        provenance: 'gcc-14-build-log',
        confidence: 0.95,
        error: 'Out of memory',
      });

      const state = selfModel.getState();
      expect(
        state.acknowledgedLimitations.some((l) => l.includes('Automated Kernel Compilation')),
      ).toBe(true);
      expect(
        state.acknowledgedCapabilities.some((c) => c.includes('Automated Kernel Compilation')),
      ).toBe(false);
    });

    it('records verified operations as demonstrated capabilities with empirical evidence', () => {
      const selfModel = apeService.selfModelEngine;

      selfModel.recordOperationOutcome({
        operation: 'Vulkan Shader Pipeline Verification',
        success: true,
        evidence: 'Rendered 60 frames with validation layer zero-errors',
        provenance: 'vulkan-layer-validator-output',
        confidence: 0.99,
      });

      const state = selfModel.getState();
      expect(
        state.acknowledgedCapabilities.some((c) =>
          c.includes('Vulkan Shader Pipeline Verification'),
        ),
      ).toBe(true);
    });

    it('enforces gradual interest progression and blocks direct jump from emerging to mastery', () => {
      const dev = apeService.developmentEngine;

      const topic = 'Formal Verification with Lean 4';
      // 1. Initial acquisition -> level: 'emerging'
      dev.developInterest(topic, 'explore');

      const state1 = dev.getState();
      const interest1 = state1.interests.find((i) => i.topic === topic);
      expect(interest1?.level).toBe('emerging');

      // 2. Attempt invalid jump directly to mastery -> clamped to 'deep'
      dev.developInterest(topic, 'master');
      const state2 = dev.getState();
      const interest2 = state2.interests.find((i) => i.topic === topic);
      expect(interest2?.level).toBe('deep');

      // 3. Second master call with deep level -> promotes to 'mastery'
      dev.developInterest(topic, 'master');
      const state3 = dev.getState();
      const interest3 = state3.interests.find((i) => i.topic === topic);
      expect(interest3?.level).toBe('mastery');
    });
  });
});
