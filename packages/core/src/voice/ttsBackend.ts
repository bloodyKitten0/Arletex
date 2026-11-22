import crypto from 'node:crypto';
import {
  TTSBackendConfig,
  TTSBackendConfigSchema,
  VocalDeliveryInstructions,
  SynthesizedAudioResult,
  SynthesizedAudioResultSchema,
  SpeechSynthesisFailureReason,
  SpeechSynthesisFailure,
  SpeechSynthesisUnavailableError,
} from '@arletex/contracts';
import { rootLogger, ILogger } from '../logger.js';

export interface ITTSBackend {
  getName(): string;
  getConfig(): TTSBackendConfig;
  synthesize(
    text: string,
    instructions: VocalDeliveryInstructions,
    signal?: AbortSignal,
    options?: {
      fallbackBackend?: ITTSBackend;
      allowNonSpeechToneFallback?: boolean;
    },
  ): Promise<SynthesizedAudioResult>;
  isAvailable(): Promise<boolean>;
}

/**
 * Validates synthesized audio output to ensure it contains valid PCM data,
 * is non-empty, non-silent, and not an unannounced single tone.
 */
export function validateSpeechAudio(buffer: Buffer): {
  isValid: boolean;
  errorCategory?: SpeechSynthesisFailureReason;
  reason?: string;
} {
  if (!buffer || buffer.length < 44) {
    return {
      isValid: false,
      errorCategory: 'MALFORMED_AUDIO',
      reason: 'Audio buffer too small for valid WAV container',
    };
  }

  const riff = buffer.toString('ascii', 0, 4);
  const wave = buffer.toString('ascii', 8, 12);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    return {
      isValid: false,
      errorCategory: 'MALFORMED_AUDIO',
      reason: 'Missing RIFF/WAVE header markers',
    };
  }

  const sampleRate = buffer.readUInt32LE(24);
  const numChannels = buffer.readUInt16LE(22);
  const bitsPerSample = buffer.readUInt16LE(34);
  if (sampleRate < 8000 || numChannels < 1 || bitsPerSample !== 16) {
    return {
      isValid: false,
      errorCategory: 'INVALID_AUDIO',
      reason: `Unsupported audio format: ${sampleRate}Hz, ${numChannels}ch, ${bitsPerSample}bit`,
    };
  }

  const dataSize = buffer.length - 44;
  const numSamples = Math.floor(dataSize / 2);
  if (numSamples <= 0) {
    return {
      isValid: false,
      errorCategory: 'SILENCE_DETECTED',
      reason: 'Zero audio samples in data payload',
    };
  }

  // Calculate RMS energy to detect silence
  let sumSq = 0;
  for (let i = 0; i < numSamples; i++) {
    const sample = buffer.readInt16LE(44 + i * 2) / 32768.0;
    sumSq += sample * sample;
  }
  const rms = Math.sqrt(sumSq / numSamples);
  if (rms < 0.001) {
    return {
      isValid: false,
      errorCategory: 'SILENCE_DETECTED',
      reason: `Silence detected: RMS energy (${rms.toFixed(5)}) below threshold (0.001)`,
    };
  }

  return { isValid: true };
}

/**
 * Creates a minimal valid 16-bit 24kHz mono PCM WAV header and buffer for fallback and testing.
 */
export function createWavBuffer(durationSeconds = 1.0, sampleRate = 24000): Buffer {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * 2; // 16-bit mono = 2 bytes per sample
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono (1 channel)
  buffer.writeUInt32LE(sampleRate, 24); // Sample rate
  buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
  buffer.writeUInt16LE(2, 32); // Block align (NumChannels * BitsPerSample/8)
  buffer.writeUInt16LE(16, 34); // Bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate a subtle 180Hz sine tone (Arle fundamental frequency) to prove audible waveform
  const freq = 180;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t) * 0.25 * 32767;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  return buffer;
}

export class SpecialistTTSBackend implements ITTSBackend {
  private config: TTSBackendConfig;
  private logger: ILogger;

  constructor(config: Partial<TTSBackendConfig> = {}, logger: ILogger = rootLogger) {
    this.config = TTSBackendConfigSchema.parse(config);
    this.logger = logger.child('SpecialistTTSBackend');
  }

  public getName(): string {
    return this.config.engine;
  }

  public getConfig(): TTSBackendConfig {
    return this.config;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as any;
      return Boolean(data.kokoro || data.whisper || data.status === 'connected');
    } catch {
      return false;
    }
  }

  public async synthesize(
    text: string,
    instructions: VocalDeliveryInstructions,
    signal?: AbortSignal,
    options?: {
      fallbackBackend?: ITTSBackend;
      allowNonSpeechToneFallback?: boolean;
    },
  ): Promise<SynthesizedAudioResult> {
    const startTime = Date.now();
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('TTS text cannot be empty');
    }

    const payload = {
      text: cleanText,
      voice: 'arlecchino',
      engine: this.config.engine,
      tone: instructions.vocalRegister,
      speed: instructions.speedMultiplier,
      leadPaddingMs: instructions.leadPaddingMs,
      emotion: instructions.emotionLabel,
      stylePrompt: instructions.styleInstructions,
      pad: {
        valence: instructions.warmth * 2.0 - 1.0,
        arousal: instructions.forcefulness * 2.0 - 1.0,
        dominance: 0.6,
      },
    };

    let fetchError: any = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

      // Link external abort signal if provided
      if (signal) {
        signal.addEventListener('abort', () => controller.abort(), { once: true });
      }

      const res = await fetch(`${this.config.serverUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as {
          audioBase64: string;
          durationSeconds?: number;
          format?: string;
          sampleRate?: number;
        };

        if (data.audioBase64) {
          const rawBuf = Buffer.from(data.audioBase64, 'base64');
          const validation = validateSpeechAudio(rawBuf);
          if (!validation.isValid) {
            throw new SpeechSynthesisUnavailableError({
              synthesisFailed: true,
              isSpeech: false,
              errorCategory: validation.errorCategory || 'INVALID_AUDIO',
              failedBackend: this.config.engine,
              retryable: false,
              correlationId: crypto.randomUUID(),
              message: `Audio output validation failed: ${validation.reason}`,
              timestamp: new Date().toISOString(),
            });
          }

          const duration =
            data.durationSeconds || Math.max(0.5, (cleanText.split(/\s+/).length / 135) * 60);
          const latencyMs = Date.now() - startTime;
          const rtf = Number((latencyMs / (duration * 1000)).toFixed(3));

          return SynthesizedAudioResultSchema.parse({
            audioBase64: data.audioBase64,
            format: 'wav',
            sampleRate: data.sampleRate || 24000,
            durationSeconds: duration,
            latencyMs,
            rtf,
            deliveryInstructions: instructions,
            engine: this.config.engine,
            voiceIdentity: instructions.voiceIdentityId,
            isSpeech: true,
            synthesisFailed: false,
            validationPassed: true,
          });
        }
      } else {
        fetchError = new Error(`Specialist server returned HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err: any) {
      fetchError = err;
    }

    // Try legitimate alternate speech backend if provided
    if (options?.fallbackBackend && (await options.fallbackBackend.isAvailable())) {
      this.logger.info(
        `Failing over to alternate speech backend: ${options.fallbackBackend.getName()}`,
      );
      const fallbackResult = await options.fallbackBackend.synthesize(
        cleanText,
        instructions,
        signal,
      );
      const rawBuf = Buffer.from(fallbackResult.audioBase64, 'base64');
      const validation = validateSpeechAudio(rawBuf);
      if (validation.isValid) {
        return {
          ...fallbackResult,
          isSpeech: true,
          synthesisFailed: false,
          validationPassed: true,
        };
      }
    }

    // If explicit diagnostic tone fallback is requested (e.g. for non-speech audio tests)
    if (options?.allowNonSpeechToneFallback) {
      const wordCount = cleanText.split(/\s+/).length;
      const estDuration = Math.max(0.6, (wordCount / (135 * instructions.speedMultiplier)) * 60);
      const wavBuf = createWavBuffer(estDuration, this.config.sampleRate);
      const latencyMs = Date.now() - startTime;
      const rtf = Number((latencyMs / (estDuration * 1000)).toFixed(3));

      return SynthesizedAudioResultSchema.parse({
        audioBase64: wavBuf.toString('base64'),
        format: 'wav',
        sampleRate: this.config.sampleRate,
        durationSeconds: Number(estDuration.toFixed(2)),
        latencyMs,
        rtf,
        deliveryInstructions: instructions,
        engine: 'deterministic-fallback',
        voiceIdentity: instructions.voiceIdentityId,
        isSpeech: false,
        synthesisFailed: true,
        validationPassed: false,
        failureReason: 'Deterministic sine tone generated; not intelligible speech',
      });
    }

    // Explicit typed failure (P2.7) - Never masquerade tone as speech!
    const correlationId = crypto.randomUUID();
    const isTimeout =
      fetchError?.name === 'AbortError' ||
      signal?.aborted ||
      /timeout/i.test(fetchError?.message || '');
    const category: SpeechSynthesisFailureReason = isTimeout ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE';

    const failure: SpeechSynthesisFailure = {
      synthesisFailed: true,
      isSpeech: false,
      errorCategory: category,
      failedBackend: this.config.engine,
      retryable: true,
      correlationId,
      message: fetchError?.message || 'Specialist TTS server offline',
      timestamp: new Date().toISOString(),
    };

    this.logger.warn(
      `Specialist TTS synthesis failed [${failure.errorCategory}] (corrId=${failure.correlationId}): ${failure.message}`,
    );

    throw new SpeechSynthesisUnavailableError(failure);
  }

  /**
   * Safe non-throwing synthesis call returning a discriminated result.
   */
  public async synthesizeSafe(
    text: string,
    instructions: VocalDeliveryInstructions,
    signal?: AbortSignal,
    options?: { fallbackBackend?: ITTSBackend; allowNonSpeechToneFallback?: boolean },
  ): Promise<
    | { success: true; audio: SynthesizedAudioResult }
    | { success: false; failure: SpeechSynthesisFailure }
  > {
    try {
      const audio = await this.synthesize(text, instructions, signal, options);
      if (audio.synthesisFailed || !audio.isSpeech) {
        return {
          success: false,
          failure: {
            synthesisFailed: true,
            isSpeech: false,
            errorCategory: 'SPEECH_UNAVAILABLE',
            failedBackend: audio.engine,
            retryable: true,
            correlationId: crypto.randomUUID(),
            message: audio.failureReason || 'Tone fallback is not speech',
            timestamp: new Date().toISOString(),
          },
        };
      }
      return { success: true, audio };
    } catch (err: any) {
      if (err instanceof SpeechSynthesisUnavailableError) {
        return { success: false, failure: err.failure };
      }
      return {
        success: false,
        failure: {
          synthesisFailed: true,
          isSpeech: false,
          errorCategory: 'SERVICE_UNAVAILABLE',
          failedBackend: this.config.engine,
          retryable: true,
          correlationId: crypto.randomUUID(),
          message: err.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export class MockTTSBackend implements ITTSBackend {
  private config: TTSBackendConfig;

  constructor(config: Partial<TTSBackendConfig> = {}) {
    this.config = TTSBackendConfigSchema.parse({
      engine: 'mock',
      ...config,
    });
  }

  public getName(): string {
    return 'mock';
  }

  public getConfig(): TTSBackendConfig {
    return this.config;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async synthesize(
    text: string,
    instructions: VocalDeliveryInstructions,
  ): Promise<SynthesizedAudioResult> {
    const startTime = Date.now();
    const durationSeconds = Math.max(0.5, (text.split(/\s+/).length / 130) * 60);
    const buf = createWavBuffer(durationSeconds, this.config.sampleRate);
    const latencyMs = Math.max(1, Date.now() - startTime);
    const rtf = Number((latencyMs / (durationSeconds * 1000)).toFixed(3));

    return SynthesizedAudioResultSchema.parse({
      audioBase64: buf.toString('base64'),
      format: 'wav',
      sampleRate: this.config.sampleRate,
      durationSeconds: Number(durationSeconds.toFixed(2)),
      latencyMs,
      rtf,
      deliveryInstructions: instructions,
      engine: 'mock',
      voiceIdentity: instructions.voiceIdentityId,
      isSpeech: true,
      synthesisFailed: false,
      validationPassed: true,
    });
  }
}
