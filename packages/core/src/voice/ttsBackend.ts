import {
  TTSBackendConfig,
  TTSBackendConfigSchema,
  VocalDeliveryInstructions,
  SynthesizedAudioResult,
  SynthesizedAudioResultSchema,
} from '@arletex/contracts';
import { rootLogger, ILogger } from '../logger.js';

export interface ITTSBackend {
  getName(): string;
  getConfig(): TTSBackendConfig;
  synthesize(
    text: string,
    instructions: VocalDeliveryInstructions,
    signal?: AbortSignal,
  ): Promise<SynthesizedAudioResult>;
  isAvailable(): Promise<boolean>;
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
  ): Promise<SynthesizedAudioResult> {
    const startTime = Date.now();
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('TTS text cannot be empty');
    }

    const payload = {
      text: cleanText,
      voice: 'arlecchino',
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
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `Specialist server synthesis unavailable (${err.message}). Using deterministic local waveform generation.`,
      );
    }

    // Local deterministic synthesis fallback when server is offline
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
    });
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
    });
  }
}
