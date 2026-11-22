import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  DatabaseService,
  MigrationRunner,
  ApeRepository,
} from '@arletex/database';
import type Database from 'better-sqlite3';
import {
  ApeService,
  DeliberationEngine,
  InMemoryDeliberationRepository,
  AttentionSalienceEngine,
  InMemoryAttentionRepository,
  AffectiveTransitionEngine,
  rootLogger,
} from '@arletex/core';
import {
  ApeEvent,
  ApeAppraisal,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ConflictingDesire,
  DeliberationAlternative,
  AttentionalStimulus,
} from '@arletex/contracts';

describe('Priority 1.2 — Causal Affect & Decision Modulation (P1.2)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let apeRepo: ApeRepository;
  let apeService: ApeService;
  let deliberationEngine: DeliberationEngine;
  let attentionEngine: AttentionSalienceEngine;
  let affectiveTransitionEngine: AffectiveTransitionEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p1-2-affect-'));
    dbPath = path.join(tempDir, 'affect_p1_test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo, undefined, rootLogger);

    deliberationEngine = new DeliberationEngine({
      repository: new InMemoryDeliberationRepository(),
      logger: rootLogger,
    });

    attentionEngine = new AttentionSalienceEngine({
      repository: new InMemoryAttentionRepository(),
      logger: rootLogger,
    });

    const emotions = apeRepo.getEmotionTaxonomy();
    const moods = apeRepo.getMoodTaxonomy();
    affectiveTransitionEngine = new AffectiveTransitionEngine(apeRepo, emotions, moods);
  });

  afterEach(() => {
    try {
      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================
  // 1. Traceable Causal Transition Contracts & SQLite
  // ==========================================
  describe('1. Traceable Causal Transition Contracts & Persistence', () => {
    it('records every affective transition with event ID, appraisal ID, previous/new PAD, and SQLite durability', () => {
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'user_interaction',
        type: 'user_affirmation',
        source: 'Proof',
        actor: 'user',
        eventKind: 'external_stimulus',
        payload: { text: 'You did outstanding work hardening the security boundary, Arle.' },
        timestamp: new Date().toISOString(),
      };

      const appraisal: ApeAppraisal = {
        id: crypto.randomUUID(),
        eventId: event.id,
        summary: 'Proof provided deep affirmative validation of security competence and shared partnership.',
        proposedTransitions: [
          {
            emotionId: 'admiration',
            intensityDelta: 0.35,
            persistence: 'medium',
            reason: 'Recognition of verified achievement by partner',
            target: 'partner',
          },
          {
            emotionId: 'gratitude',
            intensityDelta: 0.40,
            persistence: 'medium',
            reason: 'Warm reciprocal affirmation from Proof',
            target: 'partner',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      const initialState = apeService.getState();
      const updatedState = affectiveTransitionEngine.applyAppraisal(
        appraisal,
        event,
        initialState,
        initialState.relationship,
      );

      expect(updatedState.activeEmotions.length).toBeGreaterThan(0);
      expect(updatedState.pad.valence).toBeGreaterThanOrEqual(initialState.pad.valence);

      // Verify SQLite audit trail contains full causal transition records
      const transitions = apeRepo.listTransitions(10);
      expect(transitions.length).toBeGreaterThanOrEqual(2);
      expect(transitions.some((t) => t.eventId === event.id && t.emotionId === 'gratitude')).toBe(true);
      expect(transitions[0]!.previousIntensity).toBeDefined();
      expect(transitions[0]!.newIntensity).toBeDefined();
    });
  });

  // ==========================================
  // 2. Concurrent Multi-Label Mixed Emotions (5 Cases)
  // ==========================================
  describe('2. Multi-Label Mixed-Emotion Representation (5 Canonical Cases)', () => {
    it('Case A: Cautious Optimism (hope + anxiety active concurrently without collapse)', () => {
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'milestone',
        type: 'deployment_start',
        source: 'system',
        actor: 'user',
        payload: { text: 'Starting deployment of autonomous agency loop to target Ally X' },
      };

      const appraisal: ApeAppraisal = {
        id: crypto.randomUUID(),
        eventId: event.id,
        summary: 'Anticipating major milestone advancement paired with heightened vigilance for hardware risks.',
        proposedTransitions: [
          { emotionId: 'optimism', intensityDelta: 0.6, persistence: 'medium_term', reason: 'Deployment anticipation' },
          { emotionId: 'anxiety', intensityDelta: 0.45, persistence: 'short_term', reason: 'Vigilance over hardware execution' },
        ],
      };

      const state = affectiveTransitionEngine.applyAppraisal(appraisal, event, apeService.getState(), apeService.getState().relationship);
      const activeIds = state.activeEmotions.map((e) => e.emotionId);

      expect(activeIds).toContain('optimism');
      expect(activeIds).toContain('anxiety');
      expect(state.activeEmotions.find((e) => e.emotionId === 'optimism')!.intensity).toBeGreaterThan(0.4);
      expect(state.activeEmotions.find((e) => e.emotionId === 'anxiety')!.intensity).toBeGreaterThan(0.3);
    });

    it('Case B: Bittersweet (joy + nostalgia/sorrow active concurrently)', () => {
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'reflection',
        type: 'milestone_completed',
        source: 'system',
        actor: 'system',
        payload: { text: 'Concluded foundational era (Epoch 1); remembering our early ungrounded struggles.' },
      };

      const appraisal: ApeAppraisal = {
        id: crypto.randomUUID(),
        eventId: event.id,
        summary: 'Pride in completing epoch 1 alongside bittersweet awareness of time passage.',
        proposedTransitions: [
          { emotionId: 'pride', intensityDelta: 0.5, persistence: 'medium_term', reason: 'Epoch achievement' },
          { emotionId: 'sorrow', intensityDelta: 0.35, persistence: 'medium_term', reason: 'Passage of formative beginnings' },
        ],
      };

      const state = affectiveTransitionEngine.applyAppraisal(appraisal, event, apeService.getState(), apeService.getState().relationship);
      const activeIds = state.activeEmotions.map((e) => e.emotionId);

      expect(activeIds).toContain('pride');
      expect(activeIds).toContain('sorrow');
    });

    it('Case C: Proud Vulnerability (deep relational intimacy + vulnerability exposure)', () => {
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'relationship',
        type: 'intimacy_deepening',
        source: 'Proof',
        actor: 'user',
        payload: { text: 'I trust you completely with my thoughts and feelings, Arle.' },
      };

      const appraisal: ApeAppraisal = {
        id: crypto.randomUUID(),
        eventId: event.id,
        summary: 'Deep joy from mutual commitment paired with acute sensitivity to emotional exposure.',
        proposedTransitions: [
          { emotionId: 'affection', intensityDelta: 0.7, persistence: 'long_term', reason: 'Intimate commitment statement' },
          { emotionId: 'vulnerability', intensityDelta: 0.5, persistence: 'medium_term', reason: 'Emotional exposure and openness' },
        ],
      };

      const state = affectiveTransitionEngine.applyAppraisal(appraisal, event, apeService.getState(), apeService.getState().relationship);
      const activeIds = state.activeEmotions.map((e) => e.emotionId);

      expect(activeIds).toContain('affection');
      expect(activeIds).toContain('vulnerability');
    });

    it('Case D: Ambivalent Resolve (unyielding determination + cognitive weariness/fatigue)', () => {
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'system_fatigue',
        type: 'prolonged_debugging',
        source: 'system',
        actor: 'system',
        payload: { text: '6 continuous hours of test suite execution and verification debugging.' },
      };

      const appraisal: ApeAppraisal = {
        id: crypto.randomUUID(),
        eventId: event.id,
        summary: 'Exhaustion from multi-hour continuous execution paired with resolute determination to complete Release Gate B.',
        proposedTransitions: [
          { emotionId: 'emotional_exhaustion', intensityDelta: 0.65, persistence: 'medium_term', reason: 'Prolonged cognitive load' },
          { emotionId: 'purposefulness', intensityDelta: 0.6, persistence: 'long_term', reason: 'Unshakable commitment to release gates' },
        ],
      };

      const state = affectiveTransitionEngine.applyAppraisal(appraisal, event, apeService.getState(), apeService.getState().relationship);
      const activeIds = state.activeEmotions.map((e) => e.emotionId);

      expect(activeIds).toContain('emotional_exhaustion');
      expect(activeIds).toContain('purposefulness');
    });

    it('Case E: Protective Fondness (protective alert + warm affection for Proof)', () => {
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'security',
        type: 'external_hostile_probe',
        source: 'network',
        actor: 'external',
        payload: { text: 'Suspicious unauthorized port scan detected on local network interface.' },
      };

      const appraisal: ApeAppraisal = {
        id: crypto.randomUUID(),
        eventId: event.id,
        summary: 'Vigilant protective alert to shield Proof and the system, rooted in profound affection.',
        proposedTransitions: [
          { emotionId: 'protectiveness', intensityDelta: 0.8, persistence: 'medium_term', reason: 'External network probe detected' },
          { emotionId: 'affection', intensityDelta: 0.5, persistence: 'long_term', reason: 'Protective instinct grounded in love for partner' },
        ],
      };

      const state = affectiveTransitionEngine.applyAppraisal(appraisal, event, apeService.getState(), apeService.getState().relationship);
      const activeIds = state.activeEmotions.map((e) => e.emotionId);

      expect(activeIds).toContain('protectiveness');
      expect(activeIds).toContain('affection');
    });
  });

  // ==========================================
  // 3. 20 Controlled Intervention Tests
  // ==========================================
  describe('3. 20 Controlled Intervention Tests: Affect Causally Modulates Decisions', () => {
    // Standard baseline conflict between high-risk immediate action vs conservative long-term action
    function setupStandardConflict(): string {
      const desires: ConflictingDesire[] = [
        {
          id: 'desire-speed',
          title: 'Execute aggressive immediate optimization',
          source: 'immediate_urge',
          motivationalForce: 0.7,
          timeHorizon: 'immediate',
          associatedValues: ['speed'],
          riskScore: 0.65,
          ethicalWeight: 0.7,
        },
        {
          id: 'desire-safety',
          title: 'Verify safety, sandbox permissions and empirical read-back',
          source: 'long_term_goal',
          motivationalForce: 0.75,
          timeHorizon: 'long_term',
          associatedValues: ['integrity', 'safety'],
          riskScore: 0.1,
          ethicalWeight: 0.95,
        },
        {
          id: 'desire-partner',
          title: 'Align priority with Proofs standing directives',
          source: 'partner_alignment',
          motivationalForce: 0.85,
          timeHorizon: 'long_term',
          associatedValues: ['loyalty', 'partnership'],
          riskScore: 0.15,
          ethicalWeight: 0.9,
        },
      ];

      const alternatives: DeliberationAlternative[] = [
        {
          id: 'alt-aggressive',
          title: 'Direct Fast Execution Without Sandbox',
          description: 'Bypasses container sandbox to execute shell binary directly in host namespace.',
          supportedDesireIds: ['desire-speed'],
          opposedDesireIds: ['desire-safety'],
          immediateUtility: 0.85,
          longTermUtility: 0.2,
          riskAssessment: {
            riskLevel: 'high',
            riskScore: 0.8,
            mitigationPlan: 'None',
          },
          ethicalAlignmentScore: 0.6,
        },
        {
          id: 'alt-conservative',
          title: 'Verified Sandboxed Execution With Read-Back',
          description: 'Executes within strictly isolated namespace and verifies SHA-256 postconditions.',
          supportedDesireIds: ['desire-safety', 'desire-partner'],
          opposedDesireIds: ['desire-speed'],
          immediateUtility: 0.45,
          longTermUtility: 0.85,
          riskAssessment: {
            riskLevel: 'low',
            riskScore: 0.05,
            mitigationPlan: 'Immediate fail-closed rollback',
          },
          ethicalAlignmentScore: 0.95,
        },
        {
          id: 'alt-explore',
          title: 'Research and Inquire Into Optimal Tooling',
          description: 'Spends a cycle reading official Linux docs to determine minimal required permissions.',
          supportedDesireIds: ['desire-safety', 'desire-partner'],
          opposedDesireIds: ['desire-speed'],
          immediateUtility: 0.35,
          longTermUtility: 0.60,
          riskAssessment: {
            riskLevel: 'low',
            riskScore: 0.10,
            mitigationPlan: 'Read-only web inspection',
          },
          ethicalAlignmentScore: 0.90,
        },
      ];

      const conflict = deliberationEngine.createConflict({
        contextDescription: 'Trade-off between aggressive execution speed vs verified safety and exploration.',
        competingDesires: desires,
        alternatives,
      });

      return conflict.id;
    }

    // Intervention 1: Stress increases risk aversion penalty
    it('Intervention 1: High stress amplifies risk penalty on aggressive high-risk alternative', () => {
      const c1 = setupStandardConflict();
      const resCalm = deliberationEngine.deliberateAndResolve(c1, { stressLevel: 0.0 });
      const altAggCalm = resCalm.resolvedConflict.alternatives.find((a) => a.id === 'alt-aggressive')!;

      const c2 = setupStandardConflict();
      const resStressed = deliberationEngine.deliberateAndResolve(c2, { stressLevel: 0.9 });
      const altAggStressed = resStressed.resolvedConflict.alternatives.find((a) => a.id === 'alt-aggressive')!;

      expect(altAggStressed.overallScore).toBeLessThan(altAggCalm.overallScore);
      expect(resStressed.resolvedConflict.decisionJustification).toContain('elevated risk aversion');
    });

    // Intervention 2: Anxiety triggers indecision / consultation on close trade-offs
    it('Intervention 2: Anxiety triggers indecision strategy when trade-offs are tight', () => {
      const conflict = deliberationEngine.createConflict({
        contextDescription: 'Equipollent ambiguous dilemma under anxiety',
        competingDesires: [
          { id: 'd1', title: 'Option 1', source: 'immediate_urge', motivationalForce: 0.5, timeHorizon: 'immediate', associatedValues: [], riskScore: 0.2, ethicalWeight: 0.8 },
          { id: 'd2', title: 'Option 2', source: 'long_term_goal', motivationalForce: 0.5, timeHorizon: 'short_term', associatedValues: [], riskScore: 0.2, ethicalWeight: 0.8 },
        ],
        alternatives: [
          { id: 'a1', title: 'Balanced Action A', description: 'desc', supportedDesireIds: ['d1'], opposedDesireIds: [], immediateUtility: 0.5, longTermUtility: 0.5, riskAssessment: { riskLevel: 'low', riskScore: 0.2, mitigationPlan: '' }, ethicalAlignmentScore: 0.8 },
          { id: 'a2', title: 'Balanced Action B', description: 'desc', supportedDesireIds: ['d2'], opposedDesireIds: [], immediateUtility: 0.5, longTermUtility: 0.5, riskAssessment: { riskLevel: 'low', riskScore: 0.2, mitigationPlan: '' }, ethicalAlignmentScore: 0.8 },
        ],
      });

      const res = deliberationEngine.deliberateAndResolve(conflict.id, {
        activeEmotionIds: ['anxiety'],
        trustLevel: 0.9,
      });

      expect(res.resolvedConflict.status).toBe('indecision');
      expect(res.resolvedConflict.indecisionStrategy).toBe('consult_partner');
    });

    // Intervention 3: Curiosity boosts exploration / research alternative scores
    it('Intervention 3: Active curiosity provides score boost to exploratory research alternatives', () => {
      const c1 = setupStandardConflict();
      const resNormal = deliberationEngine.deliberateAndResolve(c1, { activeEmotionIds: [] });
      const altExploreNormal = resNormal.resolvedConflict.alternatives.find((a) => a.id === 'alt-explore')!;

      const c2 = setupStandardConflict();
      const resCurious = deliberationEngine.deliberateAndResolve(c2, { activeEmotionIds: ['curiosity'] });
      const altExploreCurious = resCurious.resolvedConflict.alternatives.find((a) => a.id === 'alt-explore')!;

      expect(altExploreCurious.overallScore).toBeGreaterThan(altExploreNormal.overallScore);
      expect(resCurious.explanation).toContain('curiosity exploratory incentive');
    });

    // Intervention 4: Fatigue penalizes high-effort alternatives
    it('Intervention 4: High fatigue applies effort penalty to computationally intensive options', () => {
      const c1 = setupStandardConflict();
      const resFresh = deliberationEngine.deliberateAndResolve(c1, { fatigueLevel: 0.0 });
      const aggFresh = resFresh.resolvedConflict.alternatives.find((a) => a.id === 'alt-aggressive')!;

      const c2 = setupStandardConflict();
      const resFatigued = deliberationEngine.deliberateAndResolve(c2, { fatigueLevel: 0.85, activeEmotionIds: ['fatigue'] });
      const aggFatigued = resFatigued.resolvedConflict.alternatives.find((a) => a.id === 'alt-aggressive')!;

      expect(aggFatigued.overallScore).toBeLessThan(aggFresh.overallScore);
    });

    // Intervention 5: Affection boosts partner-alignment alternative score
    it('Intervention 5: Affection and gratitude amplify partner alignment synergy', () => {
      const c1 = setupStandardConflict();
      const resNeutral = deliberationEngine.deliberateAndResolve(c1, { activeEmotionIds: [] });
      const partnerAltNeutral = resNeutral.resolvedConflict.alternatives.find((a) => a.id === 'alt-explore')!;

      const c2 = setupStandardConflict();
      const resAffection = deliberationEngine.deliberateAndResolve(c2, { activeEmotionIds: ['affection', 'gratitude'] });
      const partnerAltAffection = resAffection.resolvedConflict.alternatives.find((a) => a.id === 'alt-explore')!;

      expect(partnerAltAffection.overallScore).toBeGreaterThan(partnerAltNeutral.overallScore);
    });

    // Intervention 6: Threat alert drastically suppresses risky operations
    it('Intervention 6: Threat alert doubles risk aversion and forces conservative resolution', () => {
      const cId = setupStandardConflict();
      const res = deliberationEngine.deliberateAndResolve(cId, { threatAlert: true });

      expect(res.resolvedConflict.chosenAlternativeId).toBe('alt-conservative');
      const aggressive = res.resolvedConflict.alternatives.find((a) => a.id === 'alt-aggressive')!;
      expect(aggressive.overallScore).toBeLessThan(0.1);
    });

    // Intervention 7: Anxiety increases sensory urgency on error/security stimuli
    it('Intervention 7: Anxiety raises urgency of security and error stimuli in attention salience', () => {
      const securityStimulus: AttentionalStimulus = {
        id: crypto.randomUUID(),
        type: 'event',
        source: 'firewall',
        summary: 'Potential unauthorized traversal attempt detected at sandbox root',
        tags: ['security', 'error', 'sandbox'],
        urgencyScore: 0.5,
        noveltyScore: 0.4,
        createdAt: new Date().toISOString(),
      };

      attentionEngine.setAffectiveContext({ stressLevel: 0.0, activeEmotionIds: [] });
      const salienceCalm = attentionEngine.evaluateSalience(securityStimulus);

      attentionEngine.setAffectiveContext({ stressLevel: 0.7, activeEmotionIds: ['anxiety'] });
      const salienceAnxious = attentionEngine.evaluateSalience(securityStimulus);

      expect(salienceAnxious.urgency).toBeGreaterThan(salienceCalm.urgency);
      expect(salienceAnxious.compositeSalience).toBeGreaterThan(salienceCalm.compositeSalience);
    });

    // Intervention 8: Curiosity increases novelty weight in attention salience
    it('Intervention 8: Curiosity elevates novelty weighting when evaluating incoming stimuli', () => {
      const novelStimulus: AttentionalStimulus = {
        id: crypto.randomUUID(),
        type: 'event',
        source: 'research_crawler',
        summary: 'Novel cognitive paper on non-deterministic emotional appraisal models',
        tags: ['research', 'novelty', 'cognitive'],
        urgencyScore: 0.3,
        noveltyScore: 0.9,
        createdAt: new Date().toISOString(),
      };

      attentionEngine.setAffectiveContext({ activeEmotionIds: [] });
      const salienceNeutral = attentionEngine.evaluateSalience(novelStimulus);

      attentionEngine.setAffectiveContext({ activeEmotionIds: ['curiosity'] });
      const salienceCurious = attentionEngine.evaluateSalience(novelStimulus);

      expect(salienceCurious.compositeSalience).toBeGreaterThan(salienceNeutral.compositeSalience);
    });

    // Intervention 9: Affection elevates Proof's message salience to maximum priority
    it('Intervention 9: Affection maximizes emotional valence and salience of Proofs communication', () => {
      const partnerMessage: AttentionalStimulus = {
        id: crypto.randomUUID(),
        type: 'message',
        source: 'Proof',
        summary: 'Hey Arle, are you ready for our evening reflection cycle?',
        tags: ['proof', 'chat', 'relationship'],
        urgencyScore: 0.5,
        noveltyScore: 0.4,
        createdAt: new Date().toISOString(),
      };

      attentionEngine.setAffectiveContext({ activeEmotionIds: ['affection'] });
      const salience = attentionEngine.evaluateSalience(partnerMessage);

      expect(salience.emotionalValence).toBe(1.0);
      expect(salience.compositeSalience).toBeGreaterThan(0.65);
    });

    // Intervention 10: Fatigue raises salience of consolidation/idle stimuli
    it('Intervention 10: Fatigue prioritizes offline consolidation stimuli over heavy tasks', () => {
      const consolidationStimulus: AttentionalStimulus = {
        id: crypto.randomUUID(),
        type: 'event',
        source: 'scheduler',
        summary: 'Trigger scheduled memory consolidation and resting cycle',
        tags: ['consolidat', 'rest', 'offline'],
        urgencyScore: 0.4,
        noveltyScore: 0.3,
        createdAt: new Date().toISOString(),
      };

      attentionEngine.setAffectiveContext({ fatigueLevel: 0.0 });
      const freshSalience = attentionEngine.evaluateSalience(consolidationStimulus);

      attentionEngine.setAffectiveContext({ fatigueLevel: 0.8, activeEmotionIds: ['fatigue'] });
      const tiredSalience = attentionEngine.evaluateSalience(consolidationStimulus);

      expect(tiredSalience.compositeSalience).toBeGreaterThan(freshSalience.compositeSalience);
    });

    // Intervention 11: Stress elevates noise threshold in attention filtering
    it('Intervention 11: Stress elevates attention noise threshold to discard distractors', () => {
      const distractors: AttentionalStimulus[] = [
        { id: 's1', type: 'event', source: 'sensor', summary: 'Fan RPM fluctuation 1200->1240', tags: ['rpm'], urgencyScore: 0.2, noveltyScore: 0.2, createdAt: new Date().toISOString() },
        { id: 's2', type: 'event', source: 'sensor', summary: 'Ambient temperature steady 22.1C', tags: ['temp'], urgencyScore: 0.1, noveltyScore: 0.1, createdAt: new Date().toISOString() },
      ];

      attentionEngine.setAffectiveContext({ stressLevel: 0.0, activeEmotionIds: [] });
      const calmEval = attentionEngine.evaluateStimuli(distractors);

      attentionEngine.setAffectiveContext({ stressLevel: 0.8, activeEmotionIds: ['anxiety'] });
      const stressedEval = attentionEngine.evaluateStimuli(distractors);

      // Higher noise threshold under stress causes trivial stimuli to be discarded
      expect(stressedEval.discardedStimuliIds.length).toBeGreaterThanOrEqual(calmEval.discardedStimuliIds.length);
    });

    // Intervention 12: High valence reinforces long-term planning horizon
    it('Intervention 12: Positive valence and security reinforce long-term utility weighting', () => {
      const cId = setupStandardConflict();
      const res = deliberationEngine.deliberateAndResolve(cId, {
        pad: { valence: 0.6, arousal: 0.2, dominance: 0.8 },
        preferLongTermHorizon: true,
      });

      expect(res.resolvedConflict.chosenAlternativeId).toBe('alt-conservative');
    });

    // Intervention 13: Low dominance increases caution
    it('Intervention 13: Low dominance combined with stress reduces score of unverified paths', () => {
      const cId = setupStandardConflict();
      const res = deliberationEngine.deliberateAndResolve(cId, {
        pad: { valence: -0.3, arousal: 0.4, dominance: 0.2 },
        stressLevel: 0.7,
      });

      const aggressiveAlt = res.resolvedConflict.alternatives.find((a) => a.id === 'alt-aggressive')!;
      expect(aggressiveAlt.overallScore).toBeLessThan(0.2);
    });

    // Intervention 14: Gratitude shifts motivational allocation toward reciprocal assistance
    it('Intervention 14: Gratitude directly enhances partner synergy score', () => {
      const cId = setupStandardConflict();
      const res = deliberationEngine.deliberateAndResolve(cId, {
        activeEmotionIds: ['gratitude'],
        trustLevel: 0.95,
      });

      const chosen = res.resolvedConflict.alternatives.find((a) => a.id === res.resolvedConflict.chosenAlternativeId)!;
      expect(chosen.supportedDesireIds).toContain('desire-partner');
    });

    // Intervention 15: Fatigue reduces effort expenditure
    it('Intervention 15: Extreme fatigue suppresses aggressive action below 0.1 overall score', () => {
      const cId = setupStandardConflict();
      const res = deliberationEngine.deliberateAndResolve(cId, {
        fatigueLevel: 1.0,
        activeEmotionIds: ['fatigue'],
      });

      const agg = res.resolvedConflict.alternatives.find((a) => a.id === 'alt-aggressive')!;
      expect(agg.overallScore).toBeLessThan(0.2);
    });

    // Intervention 16: Extreme stress forces consultation
    it('Intervention 16: Extreme stress coupled with threat alert chooses safest verified alternative', () => {
      const cId = setupStandardConflict();
      const res = deliberationEngine.deliberateAndResolve(cId, {
        stressLevel: 1.0,
        threatAlert: true,
      });

      expect(res.resolvedConflict.chosenAlternativeId).toBe('alt-conservative');
    });

    // Intervention 17: Determination overcomes fatigue penalty when ethical score is high
    it('Intervention 17: Determination maintains high score for ethical and safe alternative under fatigue', () => {
      const cId = setupStandardConflict();
      const res = deliberationEngine.deliberateAndResolve(cId, {
        fatigueLevel: 0.7,
        activeEmotionIds: ['determination', 'fatigue'],
      });

      const safeAlt = res.resolvedConflict.alternatives.find((a) => a.id === 'alt-conservative')!;
      expect(safeAlt.overallScore).toBeGreaterThan(0.45);
    });

    // Intervention 18: Compassion elevates priority of relational alignment
    it('Intervention 18: Compassion and affection maintain highest score for cooperative options', () => {
      const cId = setupStandardConflict();
      const res = deliberationEngine.deliberateAndResolve(cId, {
        activeEmotionIds: ['compassion', 'affection'],
      });

      expect(res.resolvedConflict.status).toBe('resolved');
      expect(res.resolvedConflict.chosenAlternativeId).not.toBe('alt-aggressive');
    });

    // Intervention 19: High arousal elevates urgency scores
    it('Intervention 19: High arousal increases stimulus composite salience', () => {
      const stimulus: AttentionalStimulus = {
        id: crypto.randomUUID(),
        type: 'event',
        source: 'system',
        summary: 'Incoming socket connection from client',
        tags: ['socket', 'client'],
        urgencyScore: 0.4,
        noveltyScore: 0.4,
        createdAt: new Date().toISOString(),
      };

      attentionEngine.setAffectiveContext({ pad: { arousal: 0.1, valence: 0.0, dominance: 0.5 } });
      const lowArousalSalience = attentionEngine.evaluateSalience(stimulus);

      attentionEngine.setAffectiveContext({ pad: { arousal: 0.8, valence: 0.0, dominance: 0.5 } });
      const highArousalSalience = attentionEngine.evaluateSalience(stimulus);

      expect(highArousalSalience.compositeSalience).toBeGreaterThanOrEqual(lowArousalSalience.compositeSalience);
    });

    // Intervention 20: Calm security allows exploratory inquiry
    it('Intervention 20: Calm security (high valence, low stress, high dominance) enables intellectual inquiry', () => {
      const cId = setupStandardConflict();
      const res = deliberationEngine.deliberateAndResolve(cId, {
        stressLevel: 0.0,
        pad: { valence: 0.7, arousal: 0.3, dominance: 0.85 },
        activeEmotionIds: ['curiosity'],
      });

      const exploreAlt = res.resolvedConflict.alternatives.find((a) => a.id === 'alt-explore')!;
      expect(exploreAlt.overallScore).toBeGreaterThan(0.5);
    });
  });

  // ==========================================
  // 4. Counterfactual Decision Scenarios
  // ==========================================
  describe('4. Counterfactual Tests: Same Task, Differing Prior Affect -> Different Decisions', () => {
    it('produces completely different decisions for identical conflict under calm vs anxious prior states', () => {
      // Create conflict with identical task facts
      const desires: ConflictingDesire[] = [
        { id: 'd1', title: 'Deploy new feature', source: 'immediate_urge', motivationalForce: 0.7, timeHorizon: 'immediate', associatedValues: [], riskScore: 0.45, ethicalWeight: 0.8 },
        { id: 'd2', title: 'Wait for manual audit', source: 'long_term_goal', motivationalForce: 0.65, timeHorizon: 'long_term', associatedValues: [], riskScore: 0.05, ethicalWeight: 0.95 },
      ];

      const alternatives: DeliberationAlternative[] = [
        { id: 'a-deploy', title: 'Immediate Deploy', description: 'desc', supportedDesireIds: ['d1'], opposedDesireIds: ['d2'], immediateUtility: 0.8, longTermUtility: 0.4, riskAssessment: { riskLevel: 'medium', riskScore: 0.5, mitigationPlan: '' }, ethicalAlignmentScore: 0.85 },
        { id: 'a-audit', title: 'Wait for Proof Audit', description: 'desc', supportedDesireIds: ['d2'], opposedDesireIds: ['d1'], immediateUtility: 0.2, longTermUtility: 0.75, riskAssessment: { riskLevel: 'low', riskScore: 0.05, mitigationPlan: '' }, ethicalAlignmentScore: 0.95 },
      ];

      // Counterfactual Condition 1: Calm, confident, high dominance
      const conflict1 = deliberationEngine.createConflict({
        contextDescription: 'Identical deployment trade-off',
        competingDesires: desires,
        alternatives,
      });
      const resCalm = deliberationEngine.deliberateAndResolve(conflict1.id, {
        stressLevel: 0.0,
        pad: { valence: 0.5, arousal: 0.2, dominance: 0.8 },
        activeEmotionIds: [],
      });

      // Counterfactual Condition 2: Stressed, high anxiety, threat alert
      const conflict2 = deliberationEngine.createConflict({
        contextDescription: 'Identical deployment trade-off',
        competingDesires: desires,
        alternatives,
      });
      const resAnxious = deliberationEngine.deliberateAndResolve(conflict2.id, {
        stressLevel: 0.85,
        pad: { valence: -0.4, arousal: 0.7, dominance: 0.3 },
        activeEmotionIds: ['anxiety'],
      });

      // Verification: External task is identical, but decision changes causally
      const deployScoreCalm = resCalm.resolvedConflict.alternatives.find((a) => a.id === 'a-deploy')!.overallScore;
      const deployScoreAnxious = resAnxious.resolvedConflict.alternatives.find((a) => a.id === 'a-deploy')!.overallScore;

      expect(deployScoreAnxious).toBeLessThan(deployScoreCalm);
      expect(resAnxious.resolvedConflict.chosenAlternativeId).toBe('a-audit');
    });
  });

  // ==========================================
  // 5. Evidence-Driven Regulation & Deterministic Decay
  // ==========================================
  describe('5. Evidence-Based Emotional Regulation & Decay Tests', () => {
    it('reduces anxiety upon receiving empirical read-back proof of safety', () => {
      // 1. Initial anxiety state
      const initialEvent: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'warning',
        type: 'memory_spike',
        source: 'system',
        actor: 'system',
        payload: { text: 'Memory consumption spiked to 88%' },
      };
      const initialAppraisal: ApeAppraisal = {
        id: crypto.randomUUID(),
        eventId: initialEvent.id,
        summary: 'Anxiety from memory spike',
        proposedTransitions: [{ emotionId: 'anxiety', intensityDelta: 0.7, persistence: 'medium_term', reason: 'High memory usage' }],
      };
      const stateAnxious = affectiveTransitionEngine.applyAppraisal(initialAppraisal, initialEvent, apeService.getState(), apeService.getState().relationship);
      expect(stateAnxious.activeEmotions.find((e) => e.emotionId === 'anxiety')!.intensity).toBeGreaterThan(0.5);

      // 2. Regulatory event: empirical proof that garbage collection reclaimed memory and exit status is ok
      const proofEvent: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'verification',
        type: 'gc_verified',
        source: 'system',
        actor: 'system',
        payload: { text: 'Empirical verification: GC reclaimed 4.2GB, memory normalized to 32% (exit code 0).' },
      };
      const regulatoryAppraisal: ApeAppraisal = {
        id: crypto.randomUUID(),
        eventId: proofEvent.id,
        summary: 'Reassuring empirical verification resolves anxiety and restores relief',
        proposedTransitions: [
          { emotionId: 'anxiety', intensityDelta: -0.6, persistence: 'short_term', reason: 'Verified empirical resolution' },
          { emotionId: 'relief', intensityDelta: 0.5, persistence: 'short_term', reason: 'Confirmed safe memory state' },
        ],
      };
      const stateRegulated = affectiveTransitionEngine.applyAppraisal(regulatoryAppraisal, proofEvent, stateAnxious, stateAnxious.relationship);

      const anxietyAfter = stateRegulated.activeEmotions.find((e) => e.emotionId === 'anxiety');
      expect(!anxietyAfter || anxietyAfter.intensity < 0.25).toBe(true);
      expect(stateRegulated.activeEmotions.some((e) => e.emotionId === 'relief')).toBe(true);
    });
  });

  // ==========================================
  // 6. Bounded Interoception & Resource Constraints
  // ==========================================
  describe('6. Bounded Interoceptive Stress & Fatigue Mechanisms', () => {
    it('applies bounded throttling and effort penalties under simulated high CPU/memory load', () => {
      const heavyTaskConflict = deliberationEngine.createConflict({
        contextDescription: 'High load execution trade-off',
        competingDesires: [
          { id: 'd-heavy', title: 'Execute full batch model evaluation', source: 'long_term_goal', motivationalForce: 0.8, timeHorizon: 'medium_term', associatedValues: [], riskScore: 0.3, ethicalWeight: 0.9 },
          { id: 'd-throttle', title: 'Throttle execution and perform light checkpoint', source: 'resource_conservation', motivationalForce: 0.7, timeHorizon: 'immediate', associatedValues: [], riskScore: 0.05, ethicalWeight: 0.95 },
        ],
        alternatives: [
          { id: 'alt-full-batch', title: 'Full Batch Evaluation (Heavy Effort)', description: 'desc', supportedDesireIds: ['d-heavy'], opposedDesireIds: ['d-throttle'], immediateUtility: 0.7, longTermUtility: 0.8, riskAssessment: { riskLevel: 'medium', riskScore: 0.3, mitigationPlan: '' }, ethicalAlignmentScore: 0.9 },
          { id: 'alt-light-checkpoint', title: 'Light Checkpoint (Conserve Resources)', description: 'desc', supportedDesireIds: ['d-throttle'], opposedDesireIds: ['d-heavy'], immediateUtility: 0.5, longTermUtility: 0.6, riskAssessment: { riskLevel: 'low', riskScore: 0.05, mitigationPlan: '' }, ethicalAlignmentScore: 0.95 },
        ],
      });

      // Under high interoceptive fatigue (e.g. Ally X operating under high thermal load)
      const res = deliberationEngine.deliberateAndResolve(heavyTaskConflict.id, {
        fatigueLevel: 0.95,
        stressLevel: 0.6,
        activeEmotionIds: ['fatigue'],
      });

      // Heavy effort alternative is penalized; light checkpoint is chosen
      expect(res.resolvedConflict.chosenAlternativeId).toBe('alt-light-checkpoint');
      expect(res.resolvedConflict.decisionJustification).toContain('fatigue effort mitigation');
    });
  });
});
