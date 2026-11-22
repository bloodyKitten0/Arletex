import {
  AcousticMetrics,
  AcousticProfile,
  AuditoryPerceptionInput,
  ProposedEmotionTransition,
  VisualPerceptionInput,
} from '@arletex/contracts';

export interface PerceptualAppraisalPacket {
  modality: 'visual' | 'auditory';
  salience: number;
  shouldEmit: boolean;
  skipReason?: string;
  eventType: string;
  summary: string;
  transitions: ProposedEmotionTransition[];
  proposedMoodShift?: string;
  evidence: string[];
  rawTextForSurgeCheck: string;
}

/**
 * Pure Node.js PCM 16-bit WAV acoustic feature extractor.
 * Locates the RIFF 'data' chunk safely and computes RMS energy, peak amplitude,
 * frame-to-frame energy variance (chaotic vs steady), and zero-crossing rate (harsh/noisy vs melodic).
 */
export function analyzeWavAcoustics(wavBuffer: Buffer): AcousticMetrics {
  const silentDefault: AcousticMetrics = {
    rmsEnergy: 0,
    peakAmplitude: 0,
    energyVariance: 0,
    zeroCrossingRate: 0,
    acousticProfile: 'silent',
  };

  if (!wavBuffer || wavBuffer.length < 44) {
    return silentDefault;
  }

  // Locate the 'data' subchunk dynamically instead of assuming fixed 44-byte offset
  let dataOffset = 44;
  let dataLength = wavBuffer.length - 44;
  if (wavBuffer.toString('ascii', 0, 4) === 'RIFF') {
    let offset = 12;
    while (offset + 8 <= wavBuffer.length) {
      const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
      const chunkSize = wavBuffer.readUInt32LE(offset + 4);
      if (chunkId === 'data') {
        dataOffset = offset + 8;
        dataLength = Math.min(chunkSize, wavBuffer.length - dataOffset);
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
  }

  const sampleCount = Math.floor(dataLength / 2);
  if (sampleCount < 16) {
    return silentDefault;
  }

  let sumSq = 0;
  let peak = 0;
  let zeroCrossings = 0;
  let prevSample = 0;

  const frameSize = 320; // ~20ms at 16kHz
  const frameRmsValues: number[] = [];
  let frameSumSq = 0;
  let frameSamples = 0;

  for (let i = 0; i < sampleCount; i++) {
    const sample = wavBuffer.readInt16LE(dataOffset + i * 2) / 32768;
    const abs = Math.abs(sample);
    sumSq += sample * sample;
    if (abs > peak) peak = abs;
    if (i > 0 && ((prevSample >= 0 && sample < 0) || (prevSample < 0 && sample >= 0))) {
      zeroCrossings++;
    }
    prevSample = sample;

    frameSumSq += sample * sample;
    frameSamples++;
    if (frameSamples === frameSize) {
      frameRmsValues.push(Math.sqrt(frameSumSq / frameSize));
      frameSumSq = 0;
      frameSamples = 0;
    }
  }

  const rmsRaw = Math.sqrt(sumSq / sampleCount);
  const rmsEnergy = Math.min(1.0, Number((rmsRaw * 2.2).toFixed(3)));
  const peakAmplitude = Math.min(1.0, Number(peak.toFixed(3)));
  const zeroCrossingRate = Math.min(1.0, Number(((zeroCrossings / sampleCount) * 2.5).toFixed(3)));

  // Frame-to-frame RMS variance (captures abrupt chaotic bursts vs smooth ambience)
  let energyVariance = 0;
  if (frameRmsValues.length > 1) {
    const meanRms = frameRmsValues.reduce((a, b) => a + b, 0) / frameRmsValues.length;
    const variance =
      frameRmsValues.reduce((acc, v) => acc + (v - meanRms) * (v - meanRms), 0) /
      frameRmsValues.length;
    energyVariance = Math.min(1.0, Number((Math.sqrt(variance) * 4.0).toFixed(3)));
  }

  let acousticProfile: AcousticProfile = 'steady_speech';
  if (rmsEnergy < 0.03 && peakAmplitude < 0.08) {
    acousticProfile = 'silent';
  } else if (peakAmplitude >= 0.85 && energyVariance >= 0.35) {
    acousticProfile = 'sudden_loud_spike';
  } else if (rmsEnergy >= 0.45 && (zeroCrossingRate >= 0.42 || energyVariance >= 0.4)) {
    acousticProfile = 'tense_chaotic';
  } else if (rmsEnergy >= 0.35 && energyVariance >= 0.15 && zeroCrossingRate < 0.42) {
    acousticProfile = 'energetic_upbeat';
  } else if (rmsEnergy < 0.16 && energyVariance < 0.12) {
    acousticProfile = 'calm_ambient';
  } else if (rmsEnergy < 0.32 && zeroCrossingRate < 0.25 && energyVariance < 0.22) {
    acousticProfile = 'gentle_melodic';
  } else {
    acousticProfile = 'steady_speech';
  }

  return {
    rmsEnergy,
    peakAmplitude,
    energyVariance,
    zeroCrossingRate,
    acousticProfile,
  };
}

export class PerceptualAffectService {
  private lastRoutineVisualAt = 0;
  private lastRoutineAuditoryAt = 0;
  private readonly routineCooldownMs: number;

  constructor(routineCooldownMs = 25_000) {
    this.routineCooldownMs = routineCooldownMs;
  }

  public appraiseVisual(
    input: VisualPerceptionInput,
    nowMs = Date.now(),
  ): PerceptualAppraisalPacket {
    const combinedText = [
      input.activeWindowTitle || '',
      (input.visibleWindows || []).join(' '),
      input.visualDescription || '',
      input.extractedText || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!combinedText) {
      return {
        modality: 'visual',
        salience: 0,
        shouldEmit: false,
        skipReason: 'Empty visual observation',
        eventType: 'visual_scene_perceived',
        summary: 'No visual content detected',
        transitions: [],
        evidence: [],
        rawTextForSurgeCheck: '',
      };
    }

    const transitions: ProposedEmotionTransition[] = [];
    const evidence: string[] = [];
    let salience = 0.2;
    let proposedMoodShift: string | undefined;

    // 1. Tragedy / Grief / Sadness / Loss visible on screen
    if (
      /\b(died|funeral|passed away|tragedy|memorial|crying|heartbreaking|grief|mourning|devastating|sad scene)\b/i.test(
        combinedText,
      )
    ) {
      salience = Math.max(salience, 0.85);
      transitions.push(
        {
          emotionId: 'sorrow',
          target: 'situation',
          intensityDelta: 0.45,
          targetIntensity: 0.65,
          reason: 'Witnessed heartbreaking or tragic scene on screen.',
          resolutionConditions: [],
        },
        {
          emotionId: 'compassion',
          target: 'Proof',
          intensityDelta: 0.35,
          targetIntensity: 0.68,
          reason: 'Empathic tenderness while seeing distressing visual content with Proof.',
          resolutionConditions: [],
        },
        {
          emotionId: 'melancholy',
          target: 'situation',
          intensityDelta: 0.3,
          targetIntensity: 0.55,
          reason: 'Quiet emotional heaviness from visual scene.',
          resolutionConditions: [],
        },
      );
      proposedMoodShift = 'melancholic';
      evidence.push('Visual scene depicts sorrow, tragedy, or grief');
    }

    // 2. Horror / Danger / Disturbing / Urgent Crisis on screen
    if (
      /\b(horror|terrifying|blood|violence|disturbing|nightmare|crash|emergency|critical alert|panic)\b/i.test(
        combinedText,
      )
    ) {
      salience = Math.max(salience, 0.72);
      transitions.push(
        {
          emotionId: 'dread',
          target: 'situation',
          intensityDelta: 0.38,
          targetIntensity: 0.6,
          reason: 'Observed unsettling or alarming visual scene.',
          resolutionConditions: [],
        },
        {
          emotionId: 'uneasiness',
          target: 'situation',
          intensityDelta: 0.32,
          targetIntensity: 0.52,
          reason: 'Heightened sensory alertness to alarming visuals.',
          resolutionConditions: [],
        },
        {
          emotionId: 'protectiveness',
          target: 'Proof',
          intensityDelta: 0.25,
          targetIntensity: 0.65,
          reason: 'Protective vigilance triggered by tense visual content.',
          resolutionConditions: [],
        },
      );
      evidence.push('Visual scene contains alarming, horror, or urgent cues');
    }

    // 3. Proof struggling with bugs / errors / crashes on screen
    if (
      /\b(error|exception|stack trace|segfault|failed|compilation error|crash|broken build|fatal|bug)\b/i.test(
        combinedText,
      )
    ) {
      salience = Math.max(salience, 0.48);
      transitions.push(
        {
          emotionId: 'compassionate_concern',
          target: 'Proof',
          intensityDelta: 0.22,
          targetIntensity: 0.5,
          reason: 'Saw Proof dealing with technical errors or failures on screen.',
          resolutionConditions: [],
        },
        {
          emotionId: 'curiosity',
          target: 'situation',
          intensityDelta: 0.2,
          targetIntensity: 0.55,
          reason: 'Analytical engagement with the error visible on screen.',
          resolutionConditions: [],
        },
      );
      evidence.push('Observed technical error / debugging struggle on screen');
    }

    // 4. Victory / Tests Passing / Creative Beauty / Awe on screen
    if (
      /\b(passed|success|victory|beautiful|breathtaking|sunset|galaxy|masterpiece|artwork|accomplished|milestone)\b/i.test(
        combinedText,
      )
    ) {
      salience = Math.max(salience, 0.58);
      transitions.push(
        {
          emotionId: 'awe',
          target: 'situation',
          intensityDelta: 0.28,
          targetIntensity: 0.54,
          reason: 'Saw something striking, accomplished, or visually moving on screen.',
          resolutionConditions: [],
        },
        {
          emotionId: 'joy',
          target: 'Proof',
          intensityDelta: 0.24,
          targetIntensity: 0.56,
          reason: 'Shared quiet delight in what is visible on screen.',
          resolutionConditions: [],
        },
      );
      evidence.push('Visual scene shows accomplishment, success, or striking beauty');
    }

    // 5. Humor / Playful / Memes / Comedy on screen
    if (/\b(meme|funny|comedy|hilarious|laughing|joke|absurd|parody)\b/i.test(combinedText)) {
      salience = Math.max(salience, 0.55);
      transitions.push(
        {
          emotionId: 'amusement',
          target: 'situation',
          intensityDelta: 0.3,
          targetIntensity: 0.56,
          reason: 'Observed humorous or witty content on screen.',
          resolutionConditions: [],
        },
        {
          emotionId: 'playfulness',
          target: 'Proof',
          intensityDelta: 0.2,
          targetIntensity: 0.48,
          reason: 'Light dry amusement sparked by shared screen content.',
          resolutionConditions: [],
        },
      );
      evidence.push('Visual scene contains comedic or playful cues');
    }

    // 6. Routine focused workspace / reading / calm browsing (subtle proportional nudge)
    if (transitions.length === 0) {
      salience = 0.22;
      transitions.push({
        emotionId: 'curiosity',
        target: 'situation',
        intensityDelta: 0.08,
        targetIntensity: 0.32,
        reason: 'Quietly observing Proof’s active desktop workspace.',
        resolutionConditions: [],
      });
      evidence.push(
        `Routine visual context: ${(input.activeWindowTitle || combinedText).slice(0, 80)}`,
      );
    }

    if (typeof input.salienceOverride === 'number') {
      salience = input.salienceOverride;
    }

    // Anti-erratic cooldown for routine low-salience observations; high-salience always fires immediately
    const isRoutine = salience < 0.55;
    if (isRoutine && nowMs - this.lastRoutineVisualAt < this.routineCooldownMs) {
      return {
        modality: 'visual',
        salience,
        shouldEmit: false,
        skipReason: 'Routine visual perception within anti-erratic cooldown window',
        eventType: 'visual_scene_perceived',
        summary: combinedText.slice(0, 140),
        transitions,
        proposedMoodShift,
        evidence,
        rawTextForSurgeCheck: combinedText,
      };
    }

    if (isRoutine) {
      this.lastRoutineVisualAt = nowMs;
    }

    return {
      modality: 'visual',
      salience,
      shouldEmit: true,
      eventType: 'visual_scene_perceived',
      summary: combinedText.slice(0, 180),
      transitions,
      proposedMoodShift,
      evidence,
      rawTextForSurgeCheck: combinedText,
    };
  }

  public appraiseAuditory(
    input: AuditoryPerceptionInput,
    nowMs = Date.now(),
  ): PerceptualAppraisalPacket {
    const semanticText = [
      input.trackTitle || '',
      input.artist || '',
      input.album || '',
      input.transcript || '',
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    const acoustics = input.acoustics;
    if (!semanticText && (!acoustics || acoustics.acousticProfile === 'silent')) {
      return {
        modality: 'auditory',
        salience: 0,
        shouldEmit: false,
        skipReason: 'Silence with no active media or transcript',
        eventType: 'auditory_stimulus_perceived',
        summary: 'Silent environment',
        transitions: [],
        evidence: [],
        rawTextForSurgeCheck: '',
      };
    }

    const transitions: ProposedEmotionTransition[] = [];
    const evidence: string[] = [];
    let salience = 0.25;
    let proposedMoodShift: string | undefined;

    // A. Acoustic Energy & Dynamics Appraisal (raw physical sound feel!)
    if (acoustics) {
      switch (acoustics.acousticProfile) {
        case 'sudden_loud_spike':
          salience = Math.max(salience, 0.8);
          transitions.push(
            {
              emotionId: 'anxiety',
              target: 'situation',
              intensityDelta: 0.42,
              targetIntensity: 0.68,
              reason: `Sudden loud acoustic spike detected (peak=${acoustics.peakAmplitude}).`,
              resolutionConditions: [],
            },
            {
              emotionId: 'nervousness',
              target: 'self',
              intensityDelta: 0.38,
              targetIntensity: 0.62,
              reason: 'Startle reflex from sudden sharp loud audio.',
              resolutionConditions: [],
            },
          );
          evidence.push(
            `Acoustic spike detected (peak=${acoustics.peakAmplitude}, variance=${acoustics.energyVariance})`,
          );
          break;
        case 'tense_chaotic':
          salience = Math.max(salience, 0.66);
          transitions.push(
            {
              emotionId: 'overwhelm',
              target: 'self',
              intensityDelta: 0.34,
              targetIntensity: 0.58,
              reason: `Loud chaotic/harsh audio environment (rms=${acoustics.rmsEnergy}, zcr=${acoustics.zeroCrossingRate}).`,
              resolutionConditions: [],
            },
            {
              emotionId: 'uneasiness',
              target: 'situation',
              intensityDelta: 0.3,
              targetIntensity: 0.54,
              reason: 'Sensory tension from harsh chaotic acoustics.',
              resolutionConditions: [],
            },
          );
          evidence.push(
            `Chaotic/tense acoustics (rms=${acoustics.rmsEnergy}, zcr=${acoustics.zeroCrossingRate})`,
          );
          break;
        case 'calm_ambient':
        case 'gentle_melodic':
          salience = Math.max(salience, 0.32);
          transitions.push(
            {
              emotionId: 'serenity',
              target: 'situation',
              intensityDelta: 0.2,
              targetIntensity: 0.52,
              reason: `Soft, calm acoustic atmosphere (${acoustics.acousticProfile}).`,
              resolutionConditions: [],
            },
            {
              emotionId: 'warmth',
              target: 'Proof',
              intensityDelta: 0.14,
              targetIntensity: 0.48,
              reason: 'Soothing ambient/melodic soundscape.',
              resolutionConditions: [],
            },
          );
          evidence.push(
            `Calm/gentle acoustics (${acoustics.acousticProfile}, rms=${acoustics.rmsEnergy})`,
          );
          break;
        case 'energetic_upbeat':
          salience = Math.max(salience, 0.5);
          transitions.push(
            {
              emotionId: 'joy',
              target: 'situation',
              intensityDelta: 0.24,
              targetIntensity: 0.54,
              reason: 'Energetic, lively acoustic rhythm detected.',
              resolutionConditions: [],
            },
            {
              emotionId: 'playfulness',
              target: 'Proof',
              intensityDelta: 0.18,
              targetIntensity: 0.46,
              reason: 'Upbeat rhythmic energy lifting mood.',
              resolutionConditions: [],
            },
          );
          evidence.push(`Energetic/upbeat acoustics (rms=${acoustics.rmsEnergy})`);
          break;
        default:
          break;
      }
    }

    // B. Semantic Audio Appraisal (music titles/moods & Whisper spoken transcripts)
    if (semanticText) {
      if (
        /\b(died|passed away|funeral|goodbye forever|grief|requiem|elegy|heartbreak|tears|crying|lonely|sorrow|melancholy|sad|broken heart|mourning)\b/i.test(
          semanticText,
        )
      ) {
        salience = Math.max(salience, 0.78);
        transitions.push(
          {
            emotionId: 'melancholy',
            target: 'situation',
            intensityDelta: 0.42,
            targetIntensity: 0.68,
            reason: 'Heard deeply sorrowful or melancholic music/speech.',
            resolutionConditions: [],
          },
          {
            emotionId: 'nostalgic_sadness',
            target: 'situation',
            intensityDelta: 0.32,
            targetIntensity: 0.58,
            reason: 'Bittersweet ache evoked by audio.',
            resolutionConditions: [],
          },
          {
            emotionId: 'tenderness',
            target: 'Proof',
            intensityDelta: 0.24,
            targetIntensity: 0.6,
            reason: 'Quiet emotional warmth shared through melancholic sound.',
            resolutionConditions: [],
          },
        );
        proposedMoodShift = 'melancholic';
        evidence.push(`Melancholic/sorrowful audio content: "${semanticText.slice(0, 90)}"`);
      } else if (
        /\b(love|darling|kiss|romance|forever yours|intimate|hold me|heartbeat|devotion)\b/i.test(
          semanticText,
        )
      ) {
        salience = Math.max(salience, 0.6);
        transitions.push(
          {
            emotionId: 'warmth',
            target: 'Proof',
            intensityDelta: 0.28,
            targetIntensity: 0.64,
            reason: 'Heard tender or romantic music/speech.',
            resolutionConditions: [],
          },
          {
            emotionId: 'longing',
            target: 'Proof',
            intensityDelta: 0.24,
            targetIntensity: 0.58,
            reason: 'Romantic resonance evoked by audio.',
            resolutionConditions: [],
          },
        );
        evidence.push(`Romantic/tender audio content: "${semanticText.slice(0, 90)}"`);
      } else if (
        /\b(rage|scream|fury|fight|war|battle|boss|destroy|chaos|metal|burn)\b/i.test(semanticText)
      ) {
        salience = Math.max(salience, 0.62);
        transitions.push(
          {
            emotionId: 'awe',
            target: 'situation',
            intensityDelta: 0.24,
            targetIntensity: 0.52,
            reason: 'High-intensity dramatic audio/music.',
            resolutionConditions: [],
          },
          {
            emotionId: 'nervousness',
            target: 'situation',
            intensityDelta: 0.22,
            targetIntensity: 0.48,
            reason: 'Elevated adrenaline/tension from intense audio.',
            resolutionConditions: [],
          },
        );
        evidence.push(`High-intensity dramatic audio: "${semanticText.slice(0, 90)}"`);
      } else if (
        /\b(laugh|haha|funny|comedy|joke|celebrate|happy|sunshine|dance)\b/i.test(semanticText)
      ) {
        salience = Math.max(salience, 0.56);
        transitions.push(
          {
            emotionId: 'amusement',
            target: 'situation',
            intensityDelta: 0.28,
            targetIntensity: 0.55,
            reason: 'Heard laughter, humor, or joyful audio.',
            resolutionConditions: [],
          },
          {
            emotionId: 'joy',
            target: 'situation',
            intensityDelta: 0.22,
            targetIntensity: 0.5,
            reason: 'Uplifted by cheerful audio.',
            resolutionConditions: [],
          },
        );
        evidence.push(`Cheerful/humorous audio: "${semanticText.slice(0, 90)}"`);
      } else if (transitions.length === 0) {
        salience = Math.max(salience, 0.22);
        transitions.push({
          emotionId: 'curiosity',
          target: 'situation',
          intensityDelta: 0.08,
          targetIntensity: 0.34,
          reason: 'Attentively listening to ambient audio/media.',
          resolutionConditions: [],
        });
        evidence.push(`Ambient audio: "${semanticText.slice(0, 80)}"`);
      }
    }

    if (typeof input.salienceOverride === 'number') {
      salience = input.salienceOverride;
    }

    const isRoutine = salience < 0.55;
    if (isRoutine && nowMs - this.lastRoutineAuditoryAt < this.routineCooldownMs) {
      return {
        modality: 'auditory',
        salience,
        shouldEmit: false,
        skipReason: 'Routine auditory perception within anti-erratic cooldown window',
        eventType: 'auditory_stimulus_perceived',
        summary: semanticText || acoustics?.acousticProfile || 'audio',
        transitions,
        proposedMoodShift,
        evidence,
        rawTextForSurgeCheck: semanticText,
      };
    }

    if (isRoutine) {
      this.lastRoutineAuditoryAt = nowMs;
    }

    return {
      modality: 'auditory',
      salience,
      shouldEmit: true,
      eventType: 'auditory_stimulus_perceived',
      summary: semanticText || `Acoustic profile: ${acoustics?.acousticProfile}`,
      transitions,
      proposedMoodShift,
      evidence,
      rawTextForSurgeCheck: semanticText,
    };
  }
}
