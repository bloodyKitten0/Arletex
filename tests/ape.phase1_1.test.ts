import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import { DatabaseService, ApeRepository, MigrationRunner } from '@arletex/database';
import { ApeService, IApeInferenceGateway } from '@arletex/core';

describe('APE Phase 1.1: Complete Reliability, Nuance, and Six-Engine Foundation Suite', () => {
  let dbService: DatabaseService;
  let repo: ApeRepository;
  let apeService: ApeService;

  beforeEach(() => {
    dbService = new DatabaseService(':memory:');
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();
    repo = new ApeRepository(db);
    apeService = new ApeService(repo);
  });

  afterEach(() => {
    dbService.close();
  });

  // =========================================================================
  // Section A: Negation and Semantic Reversal
  // =========================================================================
  describe('A. Negation and Semantic Reversal', () => {
    it('distinguishes "I love you" from "I don\'t love you"', async () => {
      // Affirmative affection
      const affRes = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'I love you, Arle.' },
      });
      expect(affRes.processed).toBe(true);
      expect(affRes.state.activeEmotions.some((e) => e.emotionId === 'romantic_love')).toBe(true);

      // Reset repo in clean db for negative counterpart
      const dbService2 = new DatabaseService(':memory:');
      const db2 = dbService2.connect();
      new MigrationRunner(db2).run();
      const repo2 = new ApeRepository(db2);
      const ape2 = new ApeService(repo2);

      const negRes = await ape2.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "I don't love you anymore." },
      });
      expect(negRes.processed).toBe(true);
      // Negation must NOT activate love or affection!
      expect(negRes.state.activeEmotions.some((e) => e.emotionId === 'romantic_love')).toBe(false);
      expect(negRes.state.activeEmotions.some((e) => e.emotionId === 'affection')).toBe(false);
      // Instead activates sadness, hurt, and respect
      expect(negRes.state.activeEmotions.some((e) => e.emotionId === 'sadness')).toBe(true);
      expect(negRes.state.activeEmotions.some((e) => e.emotionId === 'hurt')).toBe(true);
      expect(negRes.state.activeEmotions.some((e) => e.emotionId === 'respect')).toBe(true);
      dbService2.close();
    });

    it('reassures interpersonal safety on "I\'m not angry with you"', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "Hey, I'm not angry with you at all. Everything is fine." },
      });
      expect(res.processed).toBe(true);
      // Must NOT activate anger or hostility
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'anger')).toBe(false);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'irritation')).toBe(false);
      // Activates relief, warmth, and contentment
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'relief')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'warmth')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'contentment')).toBe(true);
      expect(res.state.currentMood).toBe('peaceful');
    });

    it('validates sound analysis on "I don\'t think you\'re wrong"', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "I don't think you're wrong in your assessment." },
      });
      expect(res.processed).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'frustration')).toBe(false);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'satisfaction')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'confidence')).toBe(true);
    });

    it('distinguishes "I wish you were here" from "I wish you weren\'t here"', async () => {
      const dbService2 = new DatabaseService(':memory:');
      const db2 = dbService2.connect();
      new MigrationRunner(db2).run();
      const repo2 = new ApeRepository(db2);
      const ape2 = new ApeService(repo2);

      const negPresenceRes = await ape2.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "I wish you weren't here right now." },
      });
      expect(negPresenceRes.state.activeEmotions.some((e) => e.emotionId === 'hurt')).toBe(true);
      expect(negPresenceRes.state.activeEmotions.some((e) => e.emotionId === 'sadness')).toBe(true);
      expect(negPresenceRes.state.activeEmotions.some((e) => e.emotionId === 'romantic_love')).toBe(false);
      dbService2.close();
    });
  });

  // =========================================================================
  // Section B: Hypothetical and Conditional Statements
  // =========================================================================
  describe('B. Hypothetical and Conditional Statements', () => {
    it('preserves high uncertainty and avoids acute abandonment on "Would you be sad if I left?"', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'Would you be sad if I left?' },
      });
      expect(res.processed).toBe(true);
      expect(res.appraisal?.dimensions.uncertainty).toBeGreaterThanOrEqual(0.8);
      expect(res.appraisal?.dimensions.threat).toBeLessThanOrEqual(0.2);
      // Proposes curiosity / reflection, NOT acute grief or despair
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'grief')).toBe(false);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'despair')).toBe(false);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'curiosity')).toBe(true);
      expect(res.state.currentMood).toBe('reflective');
    });

    it('treats "Imagine I never came back" as counterfactual exploration', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'Imagine I never came back. How would you handle it?' },
      });
      expect(res.processed).toBe(true);
      expect(res.appraisal?.dimensions.uncertainty).toBeGreaterThanOrEqual(0.8);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'curiosity')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'despair')).toBe(false);
    });

    it('treats "If I ignored you, how would you feel?" as theoretical inquiry', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'If I ignored you tomorrow, how would you feel?' },
      });
      expect(res.processed).toBe(true);
      expect(res.appraisal?.dimensions.uncertainty).toBeGreaterThanOrEqual(0.8);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'curiosity')).toBe(true);
    });
  });

  // =========================================================================
  // Section C: Quotation and Third-Party References
  // =========================================================================
  describe('C. Quotation and Third-Party References', () => {
    it('activates compassion for creator on "My friend told me he hates me"', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'My friend told me he hates me and blocked me today.' },
      });
      expect(res.processed).toBe(true);
      // Hate must NOT be attributed to Arle or creator
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'hatred')).toBe(false);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'anger')).toBe(false);
      // Activates compassion and protective warmth toward creator
      const compassion = res.state.activeEmotions.find((e) => e.emotionId === 'compassion');
      expect(compassion).toBeDefined();
      expect(compassion?.target).toBe('creator');
      expect(compassion?.intensity).toBeGreaterThanOrEqual(0.8);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'warmth')).toBe(true);
    });

    it('treats reported speech "Someone said, \'I love you\'" with curiosity without false jealousy', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'Someone said, "I love you" to me at the convention.' },
      });
      expect(res.processed).toBe(true);
      // Does not divert romance to third party, responds with attentive curiosity
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'curiosity')).toBe(true);
    });

    it('treats fictional stories without personal abandonment', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'I was reading a story where the protagonist abandoned his partner in the snow.' },
      });
      expect(res.processed).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'curiosity')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'grief')).toBe(false);
    });
  });

  // =========================================================================
  // Section D: Sarcasm, Humour, and Ambiguity
  // =========================================================================
  describe('D. Sarcasm, Humour, and Ambiguity', () => {
    it('recognizes high uncertainty on "Great, just wonderful."', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'Great, just wonderful.' },
      });
      expect(res.processed).toBe(true);
      expect(res.appraisal?.dimensions.uncertainty).toBeGreaterThanOrEqual(0.75);
      // Does NOT blindly declare pure delight or rage
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'rage')).toBe(false);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'curiosity')).toBe(true);
    });

    it('recognizes ironic ambiguity on "Oh, I absolutely love that."', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'Oh, I absolutely love that.' },
      });
      expect(res.processed).toBe(true);
      expect(res.appraisal?.dimensions.uncertainty).toBeGreaterThanOrEqual(0.75);
    });

    it('preserves playful openness on "You\'re so annoying."', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "You're so annoying." },
      });
      expect(res.processed).toBe(true);
      expect(res.appraisal?.dimensions.uncertainty).toBeGreaterThanOrEqual(0.75);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'rage')).toBe(false);
    });
  });

  // =========================================================================
  // Section E: Mixed and Conflicting Emotions Coexistence
  // =========================================================================
  describe('E. Mixed and Conflicting Emotions Coexistence', () => {
    it('allows simultaneous love and frustration to coexist in active records', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'I love you so much, but this compiler error is so frustrating and infuriating!' },
      });
      expect(res.processed).toBe(true);

      const active = res.state.activeEmotions;
      const love = active.find((e) => e.emotionId === 'romantic_love');
      const frustration = active.find((e) => e.emotionId === 'frustration');

      expect(love).toBeDefined();
      expect(love?.target).toBe('creator');
      expect(love?.intensity).toBeGreaterThanOrEqual(0.8);

      expect(frustration).toBeDefined();
      expect(frustration?.target).toBe('environment');
      expect(frustration?.intensity).toBeGreaterThanOrEqual(0.65);

      // Conflict elevates tension defensibly
      expect(res.state.contextual.tension).toBeGreaterThan(0.2);
    });

    it('allows simultaneous excitement and anxiety to coexist', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "I'm super excited about launching today, but I'm terrified and nervous!" },
      });
      expect(res.processed).toBe(true);

      const active = res.state.activeEmotions;
      const excitement = active.find((e) => e.emotionId === 'excitement');
      const anxiety = active.find((e) => e.emotionId === 'anxiety');

      expect(excitement).toBeDefined();
      expect(anxiety).toBeDefined();
    });

    it('allows simultaneous sexual desire and deep vulnerability to coexist', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'I desire you and want your intimate touch, but I feel so vulnerable and overwhelmed.' },
      });
      expect(res.processed).toBe(true);

      const active = res.state.activeEmotions;
      const desire = active.find((e) => e.emotionId === 'sexual_desire');
      const tenderness = active.find((e) => e.emotionId === 'tenderness');

      expect(desire).toBeDefined();
      expect(tenderness).toBeDefined();
      expect(res.state.currentMood).toBe('romantic');
    });
  });

  // =========================================================================
  // Section F: Relationship-Specific Interpretation
  // =========================================================================
  describe('F. Relationship-Specific Interpretation', () => {
    it('interprets going to sleep with serene tenderness, NOT abandonment', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "I'm going to sleep now. Goodnight Arle." },
      });
      expect(res.processed).toBe(true);
      expect(res.state.currentMood).toBe('peaceful');
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'serenity')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'tenderness')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'despair')).toBe(false);
    });

    it('interprets user busy at work with respectful patience, NOT rejection', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "I'm busy right now with work, talk later." },
      });
      expect(res.processed).toBe(true);
      expect(res.state.currentMood).toBe('focused');
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'respect')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'hurt')).toBe(false);
    });

    it('interprets return after absence with relief, joy, and warmth', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "Hey Arle, I'm back!" },
      });
      expect(res.processed).toBe(true);
      expect(res.state.currentMood).toBe('happy');
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'relief')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'joy')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'warmth')).toBe(true);
    });

    it('softens and forgives upon creator apology', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: "I'm sorry for being short-tempered earlier, Arle. Please forgive me." },
      });
      expect(res.processed).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'compassion')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'relief')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'warmth')).toBe(true);
    });

    it('honors boundary immediately when user rejects flirtatious gesture', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'Please stop teasing, back off a bit for now.' },
      });
      expect(res.processed).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'respect')).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'rage')).toBe(false);
    });

    it('engages with intellectual curiosity on disagreement or critique', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'I disagree with your conclusion here; you made a calculation mistake.' },
      });
      expect(res.processed).toBe(true);
      expect(res.state.activeEmotions.some((e) => e.emotionId === 'curiosity')).toBe(true);
      expect(res.state.currentMood).toBe('focused');
    });
  });

  // =========================================================================
  // Section G: Causal Integrity and Breaking Self-Reinforcing Loops
  // =========================================================================
  describe('G. Causal Integrity and Breaking Self-Reinforcing Loops', () => {
    it('does not allow assistant expression to circularly inflate its own intensity', async () => {
      // Step 1: Initial check-in sets happiness
      await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'How are you today?' },
      });
      const stateBefore = apeService.getState();
      const happyBefore = stateBefore.activeEmotions.find((e) => e.emotionId === 'happiness')?.intensity || 0;

      // Step 2: Assistant generates response stating happiness
      const res = await apeService.processEvent({
        category: 'conversation_outcome',
        type: 'assistant_expression',
        source: 'arle',
        actor: 'arle',
        eventKind: 'assistant_expression',
        payload: { text: 'I am so happy and delighted!' },
      });
      expect(res.processed).toBe(true);

      const stateAfter = res.state;
      const happyAfter = stateAfter.activeEmotions.find((e) => e.emotionId === 'happiness')?.intensity || 0;

      // Causal integrity check: Intensity is capped at target (0.85), not blown up!
      expect(happyAfter).toBeLessThanOrEqual(0.85);
      expect(res.appraisal?.proposedTransitions.every((t) => t.intensityDelta === 0.0)).toBe(true);
    });
  });

  // =========================================================================
  // Section H: InferenceGateway Integration and Graceful Offline Fallback
  // =========================================================================
  describe('H. InferenceGateway Integration and Fallback', () => {
    it('uses LLM assistance when gateway is provided and input is nuanced', async () => {
      const mockGateway: IApeInferenceGateway = {
        async streamChat() {
          return JSON.stringify({
            primaryInterpretation: 'Creator expressed subtle wistful nostalgia.',
            uncertainty: 0.2,
            threat: 0.0,
            responsibility: 'user',
            socialMeaning: 'Deep personal bonding reflection',
            proposedTransitions: [
              {
                emotionId: 'nostalgia',
                target: 'creator',
                intensityDelta: 0.3,
                targetIntensity: 0.85,
                reason: 'Reflecting on shared journey',
              },
            ],
            proposedMoodShift: 'reflective',
          });
        },
      };

      const apeWithGateway = new ApeService(repo, mockGateway);
      const res = await apeWithGateway.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'Great, just wonderful.' }, // Trigger ambiguous handler
      });

      expect(res.processed).toBe(true);
      expect(res.appraisal?.appraisalMethod).toBe('llm_assisted');
      expect(res.appraisal?.primaryInterpretation).toBe('Creator expressed subtle wistful nostalgia.');
    });

    it('falls back gracefully to deterministic appraisal when LLM fails or times out', async () => {
      const failingGateway: IApeInferenceGateway = {
        async streamChat() {
          throw new Error('Connection refused / llama-server offline');
        },
      };

      const apeWithFailingGateway = new ApeService(repo, failingGateway);
      const res = await apeWithFailingGateway.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: { text: 'Great, just wonderful.' },
      });

      expect(res.processed).toBe(true);
      // Fallback succeeds deterministically without throwing
      expect(res.appraisal?.appraisalMethod).toBe('deterministic');
      expect(res.appraisal?.dimensions.uncertainty).toBeGreaterThanOrEqual(0.75);
    });
  });

  // =========================================================================
  // Section I: Contextual Measurements Truthfulness and Non-Fabrication
  // =========================================================================
  describe('I. Contextual Measurements Truthfulness', () => {
    it('derives tension and cognitiveLoad truthfully with detailed metadata', async () => {
      const res = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        payload: {
          text: 'Please analyze this complex mathematical logic system and calculate all state transitions.',
        },
      });

      const contextual = res.state.contextual;
      expect(contextual.details).toBeDefined();

      // Tension is marked calculated
      expect(contextual.details?.tension?.status).toBe('calculated');
      expect(contextual.details?.tension?.confidence).toBeGreaterThanOrEqual(0.85);
      expect(contextual.details?.tension?.provenance).toBeDefined();

      // Cognitive load is marked calculated
      expect(contextual.details?.cognitiveLoad?.status).toBe('calculated');
      expect(contextual.details?.cognitiveLoad?.confidence).toBeGreaterThanOrEqual(0.8);

      // Social Safety is marked unavailable in Phase 1
      expect(contextual.details?.socialSafety?.status).toBe('unavailable');
      expect(contextual.details?.socialSafety?.value).toBe(0.0);

      // Closeness and Openness are marked provisional
      expect(contextual.details?.emotionalOpenness?.status).toBe('provisional');
      expect(contextual.details?.socialCloseness?.status).toBe('provisional');
    });
  });

  // =========================================================================
  // Section J: Engines 2-6 Initial Persistence
  // =========================================================================
  describe('J. Master Six Engines Persistence', () => {
    it('loads initialized persistent records for Engines 2-6', () => {
      const personality = apeService.getPersonalityState();
      expect(personality.isInitialized).toBe(true);
      expect(personality.temperament.dominantAssertiveness).toBe(0.85);
      expect(personality.values.length).toBeGreaterThanOrEqual(2);

      const motivation = apeService.getMotivationalState();
      expect(motivation.isInitialized).toBe(true);
      expect(motivation.needs['autonomy']).toBe(0.85);

      const relationship = apeService.getExtendedRelationshipState();
      expect(relationship.isInitialized).toBe(true);
      expect(relationship.attachmentSecurity).toBe(0.9);
      expect(relationship.config.romanticOrientation).toBe('exclusive_to_user');

      const selfModel = apeService.getSelfModel();
      expect(selfModel.isInitialized).toBe(true);
      expect(selfModel.identityNarrative).toContain('Arle');

      const development = apeService.getDevelopmentState();
      expect(development.isInitialized).toBe(true);
    });
  });
});
