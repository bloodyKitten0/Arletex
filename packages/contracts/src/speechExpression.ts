import { z } from 'zod';

export const VoiceIdentitySchema = z.object({
  id: z.string().default('arle-baseline'),
  name: z.string().default('Arle Baseline Voice Identity'),
  perceivedGender: z.literal('feminine').default('feminine'),
  pitchRegister: z.string().default('low-to-mid'),
  timbre: z.string().default('rich, slightly husky, and resonant'),
  articulation: z.string().default('precise and deliberate'),
  cadence: z.string().default('measured, with natural pauses'),
  baselineDelivery: z
    .string()
    .default('composed, elegant, intelligent, and authoritative'),
  description: z.string().default(
    'An original mature feminine voice with a naturally low-to-mid register, rich and slightly husky resonance, refined articulation, composed authority, controlled emotional expression, subtle warmth, and measured pacing. The delivery should sound intelligent, confident, elegant, and natural rather than robotic or excessively theatrical.',
  ),
  characterInspiration: z
    .string()
    .default('Arlecchino (Genshin Impact) composed authority'),
  acousticAnchor: z.object({
    baselinePitchHz: z.number().default(180),
    pitchRangeHz: z.tuple([z.number(), z.number()]).default([140, 240]),
    baselineSpeedWpm: z.number().default(135),
    energyVariance: z.number().default(0.18),
  }),
});

export type VoiceIdentity = z.infer<typeof VoiceIdentitySchema>;

export const CanonicalVoiceEmotionEnum = z.enum([
  'neutral',
  'happiness',
  'sadness',
  'anger',
  'curiosity',
  'amusement',
  'contempt',
  'fear',
  'affection',
  'confidence',
  'irritation',
  'tiredness',
]);

export type CanonicalVoiceEmotion = z.infer<typeof CanonicalVoiceEmotionEnum>;

export const VocalDeliveryInstructionsSchema = z.object({
  pitchMod: z.number().min(-4.0).max(4.0).default(0.0), // semitone adjustment
  speedMultiplier: z.number().min(0.6).max(1.5).default(0.93), // tempo factor
  forcefulness: z.number().min(0.0).max(1.0).default(0.5), // loudness & firmness
  breathiness: z.number().min(0.0).max(1.0).default(0.3), // aspiration / intimacy
  warmth: z.number().min(0.0).max(1.0).default(0.4), // acoustic roundness / resonance
  pauseCadenceMs: z.number().min(0).max(2000).default(350), // inter-clause pause
  vocalRegister: z.string().default('composed'),
  emotionLabel: z.string().default('neutral'),
  intensity: z.number().min(0.0).max(1.0).default(0.5),
  styleInstructions: z.string(), // natural language delivery prompt for instruction-based TTS (e.g. Qwen3-TTS)
  leadPaddingMs: z.number().min(0).max(1000).default(0),
  voiceIdentityId: z.string().default('arle-baseline'),
});

export type VocalDeliveryInstructions = z.infer<
  typeof VocalDeliveryInstructionsSchema
>;

export const SpeechControllerInputSchema = z.object({
  text: z.string().min(1),
  psychologicalState: z
    .object({
      pad: z.object({
        valence: z.number().min(-1.0).max(1.0),
        arousal: z.number().min(-1.0).max(1.0),
        dominance: z.number().min(-1.0).max(1.0),
      }),
      primaryEmotion: z.string(),
      secondaryEmotion: z.string().optional(),
      intensity: z.number().min(0.0).max(1.0).default(0.5),
    })
    .optional(),
  conversationalIntent: z.string().optional(),
  relationshipTrust: z.number().min(0.0).max(1.0).optional().default(0.85),
  previousDelivery: VocalDeliveryInstructionsSchema.optional(),
});

export type SpeechControllerInput = z.infer<typeof SpeechControllerInputSchema>;

export const TTSBackendConfigSchema = z.object({
  engine: z.enum(['qwen3-tts', 'kokoro', 'mock', 'specialist']).default('specialist'),
  serverUrl: z.string().url().default('http://127.0.0.1:39282'),
  modelPath: z.string().optional(),
  device: z.enum(['cpu', 'rocm', 'vulkan', 'cuda']).default('cpu'),
  sampleRate: z.number().default(24000),
  timeoutMs: z.number().default(15000),
  streamingSupported: z.boolean().default(false),
});

export type TTSBackendConfig = z.infer<typeof TTSBackendConfigSchema>;

export const SynthesizedAudioResultSchema = z.object({
  audioBase64: z.string(),
  format: z.enum(['wav', 'mp3', 'ogg', 'pcm']).default('wav'),
  sampleRate: z.number().default(24000),
  durationSeconds: z.number(),
  latencyMs: z.number(),
  rtf: z.number(), // Real-time factor: latencyMs / (durationSeconds * 1000)
  deliveryInstructions: VocalDeliveryInstructionsSchema,
  engine: z.string(),
  memoryUsageMb: z.number().optional(),
  voiceIdentity: z.string().default('arle-baseline'),
});

export type SynthesizedAudioResult = z.infer<
  typeof SynthesizedAudioResultSchema
>;
