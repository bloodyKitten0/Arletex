import {
  VoiceIdentity,
  VoiceIdentitySchema,
  VocalDeliveryInstructions,
  VocalDeliveryInstructionsSchema,
  SpeechControllerInput,
  CanonicalVoiceEmotion,
} from '@arletex/contracts';
import { rootLogger, ILogger } from '../logger.js';

export const ARLE_BASELINE_VOICE: VoiceIdentity = VoiceIdentitySchema.parse({
  id: 'arle-baseline',
  name: 'Arle Baseline Voice Identity',
  perceivedGender: 'feminine',
  pitchRegister: 'low-to-mid',
  timbre: 'rich, slightly husky, and resonant',
  articulation: 'precise and deliberate',
  cadence: 'measured, with natural pauses',
  baselineDelivery: 'composed, elegant, intelligent, and authoritative',
  description:
    'An original mature feminine voice with a naturally low-to-mid register, rich and slightly husky resonance, refined articulation, composed authority, controlled emotional expression, subtle warmth, and measured pacing. The delivery should sound intelligent, confident, elegant, and natural rather than robotic or excessively theatrical.',
  characterInspiration: 'Arlecchino (Genshin Impact) composed authority',
  acousticAnchor: {
    baselinePitchHz: 180,
    pitchRangeHz: [140, 240],
    baselineSpeedWpm: 135,
    energyVariance: 0.18,
  },
});

interface DeliveryProfileBase {
  pitchMod: number;
  speedMultiplier: number;
  forcefulness: number;
  breathiness: number;
  warmth: number;
  pauseCadenceMs: number;
  vocalRegister: string;
  styleInstructions: string;
}

const CANONICAL_EMOTION_DELIVERIES: Record<CanonicalVoiceEmotion, DeliveryProfileBase> = {
  neutral: {
    pitchMod: 0.0,
    speedMultiplier: 0.93,
    forcefulness: 0.5,
    breathiness: 0.25,
    warmth: 0.4,
    pauseCadenceMs: 350,
    vocalRegister: 'composed',
    styleInstructions:
      'Natural, composed, and measured delivery with low-to-mid register resonance, refined articulation, and calm authority.',
  },
  happiness: {
    pitchMod: 0.6,
    speedMultiplier: 0.96,
    forcefulness: 0.52,
    breathiness: 0.35,
    warmth: 0.7,
    pauseCadenceMs: 300,
    vocalRegister: 'gentle',
    styleInstructions:
      'Warmer and brighter delivery with gentle elegance and natural contentment; composed authority maintained without forced enthusiasm.',
  },
  sadness: {
    pitchMod: -0.8,
    speedMultiplier: 0.88,
    forcefulness: 0.38,
    breathiness: 0.45,
    warmth: 0.3,
    pauseCadenceMs: 450,
    vocalRegister: 'hollow',
    styleInstructions:
      'Softer and subdued delivery with quieter resonance and measured pauses; dignity and pristine intelligibility preserved throughout.',
  },
  anger: {
    pitchMod: -0.5,
    speedMultiplier: 0.97,
    forcefulness: 0.82,
    breathiness: 0.15,
    warmth: 0.2,
    pauseCadenceMs: 280,
    vocalRegister: 'commanding',
    styleInstructions:
      'Firmer, sharper, and forcefully controlled delivery with icy steel undertones; authoritative and uncompromising without shouting.',
  },
  curiosity: {
    pitchMod: 0.4,
    speedMultiplier: 0.96,
    forcefulness: 0.52,
    breathiness: 0.28,
    warmth: 0.45,
    pauseCadenceMs: 320,
    vocalRegister: 'analytical',
    styleInstructions:
      'Inquisitive intonation and attentive pacing; deliberate intellectual intrigue and sharp analytical focus.',
  },
  amusement: {
    pitchMod: 0.3,
    speedMultiplier: 0.98,
    forcefulness: 0.5,
    breathiness: 0.38,
    warmth: 0.55,
    pauseCadenceMs: 310,
    vocalRegister: 'playful',
    styleInstructions:
      'Subtle, dry amusement and restrained wry playfulness; understated composure with controlled warmth.',
  },
  contempt: {
    pitchMod: -1.0,
    speedMultiplier: 0.9,
    forcefulness: 0.6,
    breathiness: 0.18,
    warmth: 0.15,
    pauseCadenceMs: 420,
    vocalRegister: 'cold',
    styleInstructions:
      'Cool, dismissive restraint and sharp aristocratic detachment; measured, deliberate, and icy without theatrical caricature.',
  },
  fear: {
    pitchMod: 0.5,
    speedMultiplier: 0.92,
    forcefulness: 0.48,
    breathiness: 0.42,
    warmth: 0.25,
    pauseCadenceMs: 400,
    vocalRegister: 'strained',
    styleInstructions:
      'Guarded vigilance with restrained, slightly tense pacing; controlled composure despite acute caution.',
  },
  affection: {
    pitchMod: -0.4,
    speedMultiplier: 0.89,
    forcefulness: 0.42,
    breathiness: 0.48,
    warmth: 0.85,
    pauseCadenceMs: 380,
    vocalRegister: 'intimate',
    styleInstructions:
      'Gentle, warm, and deeply affectionate delivery with rich husky intimacy and unhurried pacing, reflecting partner equality.',
  },
  confidence: {
    pitchMod: -0.3,
    speedMultiplier: 0.93,
    forcefulness: 0.65,
    breathiness: 0.22,
    warmth: 0.5,
    pauseCadenceMs: 340,
    vocalRegister: 'composed',
    styleInstructions:
      'Assured, stable, and deliberate delivery; authoritative poise and steadfast self-possession.',
  },
  irritation: {
    pitchMod: -0.2,
    speedMultiplier: 1.02,
    forcefulness: 0.68,
    breathiness: 0.16,
    warmth: 0.22,
    pauseCadenceMs: 260,
    vocalRegister: 'cold',
    styleInstructions:
      'Tighter, clipped articulation and restrained crispness; precise and firm without excessive volume.',
  },
  tiredness: {
    pitchMod: -0.7,
    speedMultiplier: 0.84,
    forcefulness: 0.36,
    breathiness: 0.4,
    warmth: 0.35,
    pauseCadenceMs: 500,
    vocalRegister: 'quiet',
    styleInstructions:
      'Reduced energy and slower pacing while preserving pristine clarity; quiet, restful, and contemplative.',
  },
};

/**
 * Keyword mapping to resolve arbitrary APE 143-emotion taxonomy IDs to the 12 canonical delivery profiles.
 */
function mapApeEmotionToCanonical(emotionId: string): CanonicalVoiceEmotion {
  const norm = (emotionId || '').toLowerCase().trim();
  if (!norm) return 'neutral';

  if (norm in CANONICAL_EMOTION_DELIVERIES) {
    return norm as CanonicalVoiceEmotion;
  }

  // Keyword clustering across APE taxonomy
  if (/happ|joy|pleas|glad|delight|elated|euphor|content|warmth/.test(norm)) return 'happiness';
  if (/sad|grief|mourn|sorrow|depress|melanchol|hollow|despair|heartbreak/.test(norm))
    return 'sadness';
  if (/ang|rage|fury|wrath|indign|hostil|fierce|spite/.test(norm)) return 'anger';
  if (/curio|inquir|wonder|fascinat|intrig|speculat|investig|interest/.test(norm))
    return 'curiosity';
  if (/amus|play|humor|laugh|joke|teas|wry|ironic|mischie/.test(norm)) return 'amusement';
  if (/contempt|scorn|disdain|condescen|disgust|deris/.test(norm)) return 'contempt';
  if (/fear|terror|horror|dread|panic|anxiet|apprehen|trepid/.test(norm)) return 'fear';
  if (/affect|love|fond|tend|attach|caring|ador|devot|intimat/.test(norm)) return 'affection';
  if (/confiden|assur|resolut|bold|assert|authorit|proud/.test(norm)) return 'confidence';
  if (/irrit|annoy|frustrat|impatient|peeve|vex|curt|clipped/.test(norm)) return 'irritation';
  if (/tire|fatigue|exhaust|weary|drained|letharg|sleepy/.test(norm)) return 'tiredness';

  return 'neutral';
}

export interface ISpeechExpressionController {
  getBaselineIdentity(): VoiceIdentity;
  express(input: SpeechControllerInput): VocalDeliveryInstructions;
  smoothTransitions(
    previous: VocalDeliveryInstructions,
    current: VocalDeliveryInstructions,
    smoothingFactor?: number,
  ): VocalDeliveryInstructions;
}

export class SpeechExpressionController implements ISpeechExpressionController {
  private logger: ILogger;
  private baseline: VoiceIdentity;

  constructor(baseline: VoiceIdentity = ARLE_BASELINE_VOICE, logger: ILogger = rootLogger) {
    this.baseline = baseline;
    this.logger = logger.child('SpeechExpressionController');
  }

  public getBaselineIdentity(): VoiceIdentity {
    return this.baseline;
  }

  /**
   * Deterministically translates APE affective state, PAD coordinates, and conversational intent
   * into acoustic delivery instructions without mutating the baseline identity.
   */
  public express(input: SpeechControllerInput): VocalDeliveryInstructions {
    const text = input.text.trim();
    if (!text) {
      throw new Error('SpeechControllerInput text cannot be empty');
    }

    // 1. Neutral fallback if psychological state is missing or uncertain
    if (!input.psychologicalState) {
      this.logger.debug(
        'No psychological state provided; applying Arle baseline neutral delivery.',
      );
      return VocalDeliveryInstructionsSchema.parse({
        ...CANONICAL_EMOTION_DELIVERIES.neutral,
        emotionLabel: 'neutral',
        intensity: 0.5,
        voiceIdentityId: this.baseline.id,
      });
    }

    const {
      pad,
      primaryEmotion,
      secondaryEmotion,
      intensity = 0.5,
      secondaryIntensity,
      confidence = 0.85,
    } = input.psychologicalState;
    const clampedIntensity = Math.max(0.0, Math.min(1.0, intensity));
    const clampedConfidence = Math.max(0.0, Math.min(1.0, confidence));

    // 2. Select canonical base delivery profile
    const canonicalEmotion = mapApeEmotionToCanonical(primaryEmotion);
    const primaryDelivery =
      CANONICAL_EMOTION_DELIVERIES[canonicalEmotion] || CANONICAL_EMOTION_DELIVERIES.neutral;

    // 2b. Secondary emotion blending (Section 7.2 & 7.3)
    let baseDelivery = primaryDelivery;
    let combinedEmotionLabel: string = canonicalEmotion;

    if (secondaryEmotion) {
      const canonicalSecondary = mapApeEmotionToCanonical(secondaryEmotion);
      const secondaryDelivery =
        CANONICAL_EMOTION_DELIVERIES[canonicalSecondary] || CANONICAL_EMOTION_DELIVERIES.neutral;

      const rawSecIntensity =
        secondaryIntensity !== undefined ? secondaryIntensity : clampedIntensity * 0.5;
      const clampedSecIntensity = Math.max(0.0, Math.min(1.0, rawSecIntensity));

      // Weight is proportional to intensity and confidence, strictly bounded
      const wSecondary = Number(
        Math.min(0.45, clampedSecIntensity * clampedConfidence * 0.6).toFixed(4),
      );

      if (wSecondary > 0 && canonicalSecondary !== canonicalEmotion) {
        const wPrimary = 1.0 - wSecondary;
        baseDelivery = {
          pitchMod: Number(
            (primaryDelivery.pitchMod * wPrimary + secondaryDelivery.pitchMod * wSecondary).toFixed(
              2,
            ),
          ),
          speedMultiplier: Number(
            (
              primaryDelivery.speedMultiplier * wPrimary +
              secondaryDelivery.speedMultiplier * wSecondary
            ).toFixed(3),
          ),
          forcefulness: Number(
            (
              primaryDelivery.forcefulness * wPrimary +
              secondaryDelivery.forcefulness * wSecondary
            ).toFixed(3),
          ),
          breathiness: Number(
            (
              primaryDelivery.breathiness * wPrimary +
              secondaryDelivery.breathiness * wSecondary
            ).toFixed(3),
          ),
          warmth: Number(
            (primaryDelivery.warmth * wPrimary + secondaryDelivery.warmth * wSecondary).toFixed(3),
          ),
          pauseCadenceMs: Math.round(
            primaryDelivery.pauseCadenceMs * wPrimary +
              secondaryDelivery.pauseCadenceMs * wSecondary,
          ),
          vocalRegister: `${primaryDelivery.vocalRegister}_with_${secondaryDelivery.vocalRegister}`,
          styleInstructions: `${primaryDelivery.styleInstructions} Blended with secondary affective undertones of ${canonicalSecondary}: ${secondaryDelivery.styleInstructions}`,
        };
        combinedEmotionLabel = `${canonicalEmotion}+${canonicalSecondary}`;
      }
    }

    // 3. Compute continuous PAD modulation
    // Valence [-1, 1]: modulates warmth (+/- 0.15) and pitchMod (+/- 0.20)
    // Arousal [-1, 1]: modulates speedMultiplier (+/- 0.08) and forcefulness (+/- 0.15)
    // Dominance [-1, 1]: modulates forcefulness (+/- 0.10) and inversely affects breathiness (-/+ 0.08)
    const vOffset = pad.valence * 0.15 * clampedIntensity;
    const aSpeedOffset = pad.arousal * 0.06 * clampedIntensity;
    const aForceOffset = pad.arousal * 0.12 * clampedIntensity;
    const dForceOffset = pad.dominance * 0.08 * clampedIntensity;
    const dBreathOffset = -pad.dominance * 0.06 * clampedIntensity;

    // Intent-based fine tuning
    let intentSpeedMod = 0;
    let intentPitchMod = 0;
    let intentWarmthMod = 0;
    if (input.conversationalIntent) {
      const intentNorm = input.conversationalIntent.toLowerCase();
      if (/comfort|reassur|tender/.test(intentNorm)) {
        intentWarmthMod += 0.15;
        intentSpeedMod -= 0.04;
      } else if (/inquiry|curious|probe/.test(intentNorm)) {
        intentPitchMod += 0.15;
      } else if (/firm|boundary|reprimand/.test(intentNorm)) {
        intentSpeedMod += 0.02;
        intentPitchMod -= 0.2;
      }
    }

    // Trust modulation (higher partner trust reinforces genuine warmth and reduces defensive coldness)
    const trust = input.relationshipTrust ?? 0.85;
    const trustWarmthMod = (trust - 0.5) * 0.1;

    // Clamp computed acoustic parameters within stable identity bounds
    const rawPitchMod = Number(
      (baseDelivery.pitchMod * clampedIntensity + pad.valence * 0.2 + intentPitchMod).toFixed(2),
    );
    const pitchMod = Math.max(-3.0, Math.min(3.0, rawPitchMod));

    const rawSpeed = Number(
      (baseDelivery.speedMultiplier + aSpeedOffset + intentSpeedMod).toFixed(3),
    );
    const speedMultiplier = Math.max(0.75, Math.min(1.25, rawSpeed));

    const rawForce = Number((baseDelivery.forcefulness + aForceOffset + dForceOffset).toFixed(3));
    const forcefulness = Math.max(0.2, Math.min(0.95, rawForce));

    const rawBreath = Number((baseDelivery.breathiness + dBreathOffset).toFixed(3));
    const breathiness = Math.max(0.1, Math.min(0.7, rawBreath));

    const rawWarmth = Number(
      (baseDelivery.warmth + vOffset + intentWarmthMod + trustWarmthMod).toFixed(3),
    );
    const warmth = Math.max(0.1, Math.min(1.0, rawWarmth));

    const rawPause = Math.round(baseDelivery.pauseCadenceMs * (1.0 - pad.arousal * 0.15));
    const pauseCadenceMs = Math.max(200, Math.min(800, rawPause));

    // Construct enriched delivery instructions
    const result: VocalDeliveryInstructions = {
      pitchMod,
      speedMultiplier,
      forcefulness,
      breathiness,
      warmth,
      pauseCadenceMs,
      vocalRegister: baseDelivery.vocalRegister,
      emotionLabel: combinedEmotionLabel,
      intensity: clampedIntensity,
      styleInstructions: `${baseDelivery.styleInstructions} [Vocal register: ${baseDelivery.vocalRegister}, warmth: ${warmth.toFixed(2)}, tempo: ${speedMultiplier.toFixed(2)}x, force: ${forcefulness.toFixed(2)}].`,
      leadPaddingMs: 0,
      voiceIdentityId: this.baseline.id,
    };

    // 4. Smooth multi-utterance transitions if previous delivery was supplied
    if (input.previousDelivery) {
      return this.smoothTransitions(input.previousDelivery, result);
    }

    this.logger.debug(
      `Generated delivery instructions for '${canonicalEmotion}' (register=${result.vocalRegister}, pitchMod=${result.pitchMod}, speed=${result.speedMultiplier})`,
    );

    return VocalDeliveryInstructionsSchema.parse(result);
  }

  /**
   * Smooths transitions between conversational turns using an exponential moving average
   * to eliminate sudden prosodic jumps while allowing authentic emotional shifts.
   */
  public smoothTransitions(
    previous: VocalDeliveryInstructions,
    current: VocalDeliveryInstructions,
    smoothingFactor = 0.65,
  ): VocalDeliveryInstructions {
    const alpha = Math.max(0.1, Math.min(0.9, smoothingFactor));
    const invAlpha = 1.0 - alpha;

    const smoothedPitchMod = Number(
      (current.pitchMod * alpha + previous.pitchMod * invAlpha).toFixed(2),
    );
    const smoothedSpeed = Number(
      (current.speedMultiplier * alpha + previous.speedMultiplier * invAlpha).toFixed(3),
    );
    const smoothedForce = Number(
      (current.forcefulness * alpha + previous.forcefulness * invAlpha).toFixed(3),
    );
    const smoothedBreath = Number(
      (current.breathiness * alpha + previous.breathiness * invAlpha).toFixed(3),
    );
    const smoothedWarmth = Number((current.warmth * alpha + previous.warmth * invAlpha).toFixed(3));
    const smoothedPause = Math.round(
      current.pauseCadenceMs * alpha + previous.pauseCadenceMs * invAlpha,
    );

    return VocalDeliveryInstructionsSchema.parse({
      ...current,
      pitchMod: smoothedPitchMod,
      speedMultiplier: smoothedSpeed,
      forcefulness: smoothedForce,
      breathiness: smoothedBreath,
      warmth: smoothedWarmth,
      pauseCadenceMs: smoothedPause,
      styleInstructions: `${current.styleInstructions} [Transition-smoothed from ${previous.emotionLabel} to ${current.emotionLabel}].`,
    });
  }
}

export const defaultSpeechExpressionController = new SpeechExpressionController();
