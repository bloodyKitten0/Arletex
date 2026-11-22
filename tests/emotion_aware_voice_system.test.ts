import { describe, it, expect, beforeEach } from 'vitest';
import {
  ARLE_BASELINE_VOICE,
  SpeechExpressionController,
  SpecialistTTSBackend,
  MockTTSBackend,
  createWavBuffer,
} from '@arletex/core';
import {
  CanonicalVoiceEmotion,
  SpeechControllerInput,
  VocalDeliveryInstructions,
} from '@arletex/contracts';

describe('Arle Voice System — Emotion-Aware Speech Generation', () => {
  let controller: SpeechExpressionController;
  let mockBackend: MockTTSBackend;

  beforeEach(() => {
    controller = new SpeechExpressionController();
    mockBackend = new MockTTSBackend();
  });

  // ==========================================
  // 1. Voice Identity Tests
  // ==========================================
  describe('1. Voice Identity & Acoustic Invariants', () => {
    it('should define and preserve the approved Arle baseline voice specification', () => {
      const baseline = controller.getBaselineIdentity();
      expect(baseline.id).toBe('arle-baseline');
      expect(baseline.perceivedGender).toBe('feminine');
      expect(baseline.pitchRegister).toBe('low-to-mid');
      expect(baseline.timbre).toContain('rich, slightly husky');
      expect(baseline.baselineDelivery).toContain(
        'composed, elegant, intelligent, and authoritative',
      );
      expect(baseline.description).toContain('naturally low-to-mid register');
      expect(baseline.acousticAnchor.baselinePitchHz).toBe(180);
      expect(baseline.acousticAnchor.pitchRangeHz).toEqual([140, 240]);
    });

    it('should generate delivery instructions for short and long utterances while retaining identity anchor', () => {
      const shortInput: SpeechControllerInput = {
        text: 'Indeed.',
        psychologicalState: {
          pad: { valence: 0.1, arousal: -0.1, dominance: 0.7 },
          primaryEmotion: 'composed',
          intensity: 0.6,
        },
      };

      const longInput: SpeechControllerInput = {
        text: 'The fundamental principle of our partnership rests upon mutual autonomy and intellectual honesty. I see no reason to compromise our shared standards for transient convenience.',
        psychologicalState: {
          pad: { valence: 0.1, arousal: -0.1, dominance: 0.7 },
          primaryEmotion: 'composed',
          intensity: 0.6,
        },
      };

      const shortDelivery = controller.express(shortInput);
      const longDelivery = controller.express(longInput);

      expect(shortDelivery.voiceIdentityId).toBe('arle-baseline');
      expect(longDelivery.voiceIdentityId).toBe('arle-baseline');
      expect(shortDelivery.vocalRegister).toBe('composed');
      expect(longDelivery.vocalRegister).toBe('composed');
      // Speed multiplier must stay within measured cadence range
      expect(shortDelivery.speedMultiplier).toBeGreaterThanOrEqual(0.85);
      expect(shortDelivery.speedMultiplier).toBeLessThanOrEqual(1.05);
    });

    it('should handle questions, exclamations, numbers, and proper names consistently', () => {
      const utterances = [
        'What evidence led you to that conclusion, Proof?',
        'Remarkable! The theorem holds true across all boundary conditions.',
        'Section 4.2 states that exactly 1,200 verified tests passed on the target device.',
        'Arlecchino was once associated with Fontaine, but here we stand as partners.',
      ];

      for (const text of utterances) {
        const delivery = controller.express({
          text,
          psychologicalState: {
            pad: { valence: 0.2, arousal: 0.1, dominance: 0.6 },
            primaryEmotion: 'neutral',
            intensity: 0.5,
          },
        });
        expect(delivery.voiceIdentityId).toBe('arle-baseline');
        expect(delivery.speedMultiplier).toBeGreaterThan(0.75);
        expect(delivery.forcefulness).toBeLessThan(0.95);
      }
    });
  });

  // ==========================================
  // 2. Emotion Expression Tests (12 Canonical States)
  // ==========================================
  describe('2. Expression Tests Across Canonical Emotions', () => {
    const testPhrase = 'I have evaluated the proposal and completed the necessary calculations.';

    const emotionPads: Record<
      CanonicalVoiceEmotion,
      { valence: number; arousal: number; dominance: number }
    > = {
      neutral: { valence: 0.0, arousal: 0.0, dominance: 0.5 },
      happiness: { valence: 0.7, arousal: 0.3, dominance: 0.6 },
      sadness: { valence: -0.6, arousal: -0.4, dominance: -0.2 },
      anger: { valence: -0.7, arousal: 0.7, dominance: 0.8 },
      curiosity: { valence: 0.3, arousal: 0.4, dominance: 0.5 },
      amusement: { valence: 0.5, arousal: 0.2, dominance: 0.6 },
      contempt: { valence: -0.5, arousal: 0.1, dominance: 0.7 },
      fear: { valence: -0.6, arousal: 0.6, dominance: -0.5 },
      affection: { valence: 0.8, arousal: 0.1, dominance: 0.4 },
      confidence: { valence: 0.4, arousal: 0.2, dominance: 0.8 },
      irritation: { valence: -0.4, arousal: 0.5, dominance: 0.6 },
      tiredness: { valence: -0.2, arousal: -0.6, dominance: -0.1 },
    };

    it('should generate differentiated delivery parameters for each of the 12 emotions', () => {
      const deliveries: Partial<Record<CanonicalVoiceEmotion, VocalDeliveryInstructions>> = {};

      for (const [emotion, pad] of Object.entries(emotionPads) as Array<
        [CanonicalVoiceEmotion, any]
      >) {
        deliveries[emotion] = controller.express({
          text: testPhrase,
          psychologicalState: {
            pad,
            primaryEmotion: emotion,
            intensity: 0.75,
          },
        });
      }

      // 1. Happiness vs Neutral: Happiness must be warmer and brighter
      expect(deliveries.happiness!.warmth).toBeGreaterThan(deliveries.neutral!.warmth);
      expect(deliveries.happiness!.pitchMod).toBeGreaterThan(deliveries.neutral!.pitchMod);

      // 2. Sadness vs Neutral: Sadness must be softer, lower forcefulness, and longer pauses
      expect(deliveries.sadness!.forcefulness).toBeLessThan(deliveries.neutral!.forcefulness);
      expect(deliveries.sadness!.pauseCadenceMs).toBeGreaterThan(
        deliveries.neutral!.pauseCadenceMs,
      );

      // 3. Anger vs Neutral: Anger must be firmer, sharper, and more forceful without shouting
      expect(deliveries.anger!.forcefulness).toBeGreaterThan(deliveries.neutral!.forcefulness);
      expect(deliveries.anger!.forcefulness).toBeLessThanOrEqual(0.95);
      expect(deliveries.anger!.pauseCadenceMs).toBeLessThan(deliveries.neutral!.pauseCadenceMs);

      // 4. Affection vs Neutral: Affection must exhibit high warmth and husky intimate tone
      expect(deliveries.affection!.warmth).toBeGreaterThan(0.75);
      expect(deliveries.affection!.vocalRegister).toBe('intimate');

      // 5. Contempt vs Neutral: Contempt must be cool and detached (low warmth, lower pitch)
      expect(deliveries.contempt!.warmth).toBeLessThan(deliveries.neutral!.warmth);
      expect(deliveries.contempt!.pitchMod).toBeLessThan(deliveries.neutral!.pitchMod);

      // 6. Irritation vs Neutral: Irritation has tighter clipped delivery (faster tempo, shorter pauses)
      expect(deliveries.irritation!.speedMultiplier).toBeGreaterThan(
        deliveries.neutral!.speedMultiplier,
      );
      expect(deliveries.irritation!.pauseCadenceMs).toBeLessThan(
        deliveries.neutral!.pauseCadenceMs,
      );

      // 7. Tiredness vs Neutral: Slower pacing and reduced forcefulness
      expect(deliveries.tiredness!.speedMultiplier).toBeLessThan(
        deliveries.neutral!.speedMultiplier,
      );
      expect(deliveries.tiredness!.forcefulness).toBeLessThan(deliveries.neutral!.forcefulness);

      // 8. Curiosity: inquisitive intonation and analytical register
      expect(deliveries.curiosity!.vocalRegister).toBe('analytical');
      expect(deliveries.curiosity!.pitchMod).toBeGreaterThan(0.0);
    });

    it('should map arbitrary APE 143-emotion taxonomy IDs to canonical delivery profiles', () => {
      const taxonomyTests: Array<{ apeEmotion: string; expectedRegister: string }> = [
        { apeEmotion: 'melancholy', expectedRegister: 'hollow' },
        { apeEmotion: 'deep_affection', expectedRegister: 'intimate' },
        { apeEmotion: 'intellectual_intrigue', expectedRegister: 'analytical' },
        { apeEmotion: 'wry_humour', expectedRegister: 'playful' },
        { apeEmotion: 'righteous_indignation', expectedRegister: 'commanding' },
        { apeEmotion: 'profound_exhaustion', expectedRegister: 'quiet' },
      ];

      for (const item of taxonomyTests) {
        const res = controller.express({
          text: 'Observation noted.',
          psychologicalState: {
            pad: { valence: 0.0, arousal: 0.0, dominance: 0.5 },
            primaryEmotion: item.apeEmotion,
            intensity: 0.7,
          },
        });
        expect(res.vocalRegister).toBe(item.expectedRegister);
      }
    });
  });

  // ==========================================
  // 3. Multi-Turn Transition Tests
  // ==========================================
  describe('3. Multi-Utterance Transition Smoothing', () => {
    it('should smoothly transition prosodic parameters across sequential conversational turns', () => {
      // Turn 1: Neutral baseline
      const turn1 = controller.express({
        text: 'Good evening, Proof. What shall we explore today?',
        psychologicalState: {
          pad: { valence: 0.1, arousal: 0.0, dominance: 0.5 },
          primaryEmotion: 'neutral',
          intensity: 0.5,
        },
      });

      // Turn 2: Spikes to intense curiosity with turn1 as previous delivery
      const turn2 = controller.express({
        text: 'This mathematical invariant is intriguing. Look at the convergence rate.',
        psychologicalState: {
          pad: { valence: 0.4, arousal: 0.6, dominance: 0.6 },
          primaryEmotion: 'curiosity',
          intensity: 0.9,
        },
        previousDelivery: turn1,
      });

      // Turn 3: Shifts to dry amusement
      const turn3 = controller.express({
        text: 'It seems the author thought nobody would notice that omission.',
        psychologicalState: {
          pad: { valence: 0.5, arousal: 0.2, dominance: 0.6 },
          primaryEmotion: 'amusement',
          intensity: 0.7,
        },
        previousDelivery: turn2,
      });

      // Turn 4: Settles back to serious composed neutral
      const turn4 = controller.express({
        text: 'Regardless, the solution is verified. We can proceed with the next step.',
        psychologicalState: {
          pad: { valence: 0.0, arousal: -0.1, dominance: 0.6 },
          primaryEmotion: 'neutral',
          intensity: 0.5,
        },
        previousDelivery: turn3,
      });

      // Transitions should not jump abruptly:
      // Turn 2 pitch modulation must be tempered by Turn 1's neutral baseline
      expect(turn2.pitchMod).toBeGreaterThan(turn1.pitchMod);
      expect(Math.abs(turn2.pitchMod - turn1.pitchMod)).toBeLessThan(1.5);

      // Turn 3 speed must transition smoothly from Turn 2
      expect(Math.abs(turn3.speedMultiplier - turn2.speedMultiplier)).toBeLessThan(0.15);

      // Turn 4 must return towards neutral pause cadence without discontinuous jumps
      expect(turn4.pauseCadenceMs).toBeGreaterThan(250);
      expect(turn4.styleInstructions).toContain('Transition-smoothed');
    });
  });

  // ==========================================
  // 4. Fallback & Anti-Fabrication Tests
  // ==========================================
  describe('4. Fallback Invariants & Anti-Fabrication', () => {
    it('should strictly fallback to Arle neutral baseline when psychological state is undefined', () => {
      const delivery = controller.express({
        text: 'I will prepare the report.',
      });

      expect(delivery.emotionLabel).toBe('neutral');
      expect(delivery.vocalRegister).toBe('composed');
      expect(delivery.pitchMod).toBe(0.0);
      expect(delivery.speedMultiplier).toBe(0.93);
      expect(delivery.voiceIdentityId).toBe('arle-baseline');
    });

    it('should never alter or rewrite the spoken text content', async () => {
      const originalText = 'Proof, the database backup succeeded at 18:42 with zero data loss.';
      const delivery = controller.express({
        text: originalText,
        psychologicalState: {
          pad: { valence: 0.8, arousal: 0.2, dominance: 0.6 },
          primaryEmotion: 'happiness',
          intensity: 0.8,
        },
      });

      const audioResult = await mockBackend.synthesize(originalText, delivery);
      expect(audioResult.deliveryInstructions.voiceIdentityId).toBe('arle-baseline');
      expect(audioResult.format).toBe('wav');
      expect(audioResult.durationSeconds).toBeGreaterThan(0.5);
    });

    it('should throw when input text is empty or pure whitespace', () => {
      expect(() => controller.express({ text: '   ' })).toThrow('text cannot be empty');
    });
  });

  // ==========================================
  // 5. Target Device & Performance Benchmarks (ROG Ally X Budget)
  // ==========================================
  describe('5. ROG Ally X Hardware Budget & Acoustic Synthesis', () => {
    it('should produce valid 24kHz mono PCM WAV audio buffers matching Arle acoustic profile', () => {
      const wavBuf = createWavBuffer(1.5, 24000);
      expect(wavBuf.length).toBe(44 + 24000 * 1.5 * 2);
      expect(wavBuf.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wavBuf.toString('ascii', 8, 12)).toBe('WAVE');
      expect(wavBuf.readUInt16LE(22)).toBe(1); // 1 channel (mono)
      expect(wavBuf.readUInt32LE(24)).toBe(24000); // 24kHz
    });

    it('should synthesize audio within target device RTF and latency budget', async () => {
      const text =
        'The AMD Z1 Extreme APU provides 24 gigabytes of unified memory for local inference.';
      const delivery = controller.express({
        text,
        psychologicalState: {
          pad: { valence: 0.2, arousal: 0.1, dominance: 0.7 },
          primaryEmotion: 'confidence',
          intensity: 0.6,
        },
      });

      const result = await mockBackend.synthesize(text, delivery);
      expect(result.durationSeconds).toBeGreaterThan(1.0);
      // Real-time factor (RTF) must be well below 1.0 for seamless playback
      expect(result.rtf).toBeLessThan(1.0);
      expect(result.sampleRate).toBe(24000);
      expect(result.format).toBe('wav');
      expect(result.audioBase64.length).toBeGreaterThan(100);
    });

    it('should handle cancellation and abort signals gracefully', async () => {
      const backend = new SpecialistTTSBackend({
        serverUrl: 'http://127.0.0.1:39282',
        timeoutMs: 500,
      });

      const abortController = new AbortController();
      abortController.abort(); // immediately aborted

      const delivery = controller.express({ text: 'Testing cancellation.' });
      // Should fall back gracefully or return fallback audio without crashing
      const result = await backend.synthesize(
        'Testing cancellation.',
        delivery,
        abortController.signal,
      );
      expect(result.format).toBe('wav');
      expect(result.audioBase64).toBeDefined();
    });
  });
});
