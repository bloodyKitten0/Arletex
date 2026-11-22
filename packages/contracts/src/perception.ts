import { z } from 'zod';

// ==========================================
// Milestone 06: Multimodal Perception Contracts
// ==========================================

export const PerceptionModalitySchema = z.enum([
  'visual_image',
  'audio_waveform',
  'speech_audio',
  'video_clip',
  'screen_capture',
  'multimodal_stream',
]);
export type PerceptionModality = z.infer<typeof PerceptionModalitySchema>;

export const PerceptionEpistemicClassSchema = z.enum([
  'direct_observation',
  'grounded_inference',
  'speculative_assumption',
]);
export type PerceptionEpistemicClass = z.infer<typeof PerceptionEpistemicClassSchema>;

export const DetectedObjectSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  category: z.string().default('general'),
  confidence: z.number().min(0.0).max(1.0).default(0.85),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  attributes: z.record(z.unknown()).default({}),
});
export type DetectedObject = z.infer<typeof DetectedObjectSchema>;

export const PerceptualEventSchema = z.object({
  id: z.string().uuid(),
  eventType: z.string().min(1), // e.g. 'speech_onset', 'acoustic_spike', 'window_focus', 'scene_transition', 'button_click'
  modality: PerceptionModalitySchema,
  timestamp: z.string(),
  description: z.string().min(1),
  durationMs: z.number().optional(),
  confidence: z.number().min(0.0).max(1.0).default(0.9),
});
export type PerceptualEvent = z.infer<typeof PerceptualEventSchema>;

export const SceneUnderstandingSchema = z.object({
  sceneType: z.string().min(1), // e.g. 'coding_workspace', 'terminal_console', 'media_playback', 'idle_desktop', 'outdoor_nature'
  confidence: z.number().min(0.0).max(1.0).default(0.85),
  salientElements: z.array(z.string()).default([]),
  description: z.string().min(1),
});
export type SceneUnderstanding = z.infer<typeof SceneUnderstandingSchema>;

export const PerceptualInterpretationSchema = z.object({
  directObservations: z.array(z.string()).min(1),
  groundedInferences: z
    .array(
      z.object({
        inference: z.string(),
        confidence: z.number().min(0.0).max(1.0),
        basedOnObservations: z.array(z.string()),
      }),
    )
    .default([]),
  assumptions: z
    .array(
      z.object({
        assumption: z.string(),
        confidence: z.number().min(0.0).max(1.0),
        requiresVerification: z.boolean().default(true),
      }),
    )
    .default([]),
  confidence: z.number().min(0.0).max(1.0).default(0.85),
  ambiguityScore: z.number().min(0.0).max(1.0).default(0.1),
});
export type PerceptualInterpretation = z.infer<typeof PerceptualInterpretationSchema>;

// 1. Image Interpretation
export const ImageInterpretationResultSchema = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  dominantColors: z.array(z.string()).default([]),
  detectedObjects: z.array(DetectedObjectSchema).default([]),
  scene: SceneUnderstandingSchema,
  interpretation: PerceptualInterpretationSchema,
  rawFeatures: z.record(z.unknown()).default({}),
});
export type ImageInterpretationResult = z.infer<typeof ImageInterpretationResultSchema>;

export const InterpretImageInputSchema = z.object({
  imageBase64: z.string().optional(),
  imagePath: z.string().optional(),
  mimeType: z.string().optional().default('image/png'),
  contextHint: z.string().optional(),
  knownObjects: z.array(z.string()).optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});
export type InterpretImageInput = z.input<typeof InterpretImageInputSchema>;

// 2. Audio Perception
export const AudioPerceptionResultSchema = z.object({
  durationSeconds: z.number().min(0),
  rmsEnergy: z.number().min(0).max(1.0),
  spectralCentroidHz: z.number().min(0),
  acousticClass: z.enum(['silence', 'gentle_ambient', 'loud_spike', 'chaotic_noise']),
  speechDetected: z.boolean(),
  transcript: z.string().optional(),
  language: z.string().optional(),
  events: z.array(PerceptualEventSchema).default([]),
  interpretation: PerceptualInterpretationSchema,
});
export type AudioPerceptionResult = z.infer<typeof AudioPerceptionResultSchema>;

export const InterpretAudioInputSchema = z.object({
  audioPath: z.string().optional(),
  audioBase64: z.string().optional(),
  wavBuffer: z.any().optional(),
  durationSeconds: z.number().optional(),
  transcript: z.string().optional(),
  language: z.string().optional(),
  contextHint: z.string().optional(),
});
export type InterpretAudioInput = z.input<typeof InterpretAudioInputSchema>;

// 3. Video Interpretation
export const VideoInterpretationResultSchema = z.object({
  durationSeconds: z.number().min(0),
  keyframesCount: z.number().int().min(0),
  visualEvents: z.array(PerceptualEventSchema).default([]),
  audioEvents: z.array(PerceptualEventSchema).default([]),
  detectedObjects: z.array(DetectedObjectSchema).default([]),
  sceneEvolution: z.array(SceneUnderstandingSchema).default([]),
  synchronizedTranscript: z.string().optional(),
  interpretation: PerceptualInterpretationSchema,
});
export type VideoInterpretationResult = z.infer<typeof VideoInterpretationResultSchema>;

export const InterpretVideoInputSchema = z.object({
  videoPath: z.string().optional(),
  videoBase64: z.string().optional(),
  durationSeconds: z.number().optional(),
  keyframesBase64: z.array(z.string()).optional(),
  transcript: z.string().optional(),
  contextHint: z.string().optional(),
});
export type InterpretVideoInput = z.input<typeof InterpretVideoInputSchema>;

// 4. Screen Interpretation
export const ScreenInterpretationResultSchema = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  activeWindows: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        client: z.string(),
        isFocused: z.boolean(),
      }),
    )
    .default([]),
  detectedTextBlocks: z.array(z.string()).default([]),
  detectedInteractiveElements: z
    .array(
      z.object({
        label: z.string(),
        type: z.string(), // e.g. 'button', 'input', 'tab', 'terminal'
        region: z.string().optional(),
      }),
    )
    .default([]),
  scene: SceneUnderstandingSchema,
  interpretation: PerceptualInterpretationSchema,
});
export type ScreenInterpretationResult = z.infer<typeof ScreenInterpretationResultSchema>;

export const InterpretScreenInputSchema = z.object({
  imagePath: z.string().optional(),
  imageBase64: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  visibleWindows: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        client: z.string(),
        desktop: z.number().optional(),
      }),
    )
    .optional(),
  focusedWindowTitle: z.string().optional(),
  detectedDialogue: z.array(z.string()).optional(),
  interactiveHints: z
    .array(z.object({ element: z.string(), x: z.number().optional(), y: z.number().optional() }))
    .optional(),
});
export type InterpretScreenInput = z.input<typeof InterpretScreenInputSchema>;

// 5. Unified Multimodal Frame (Cross-modal integration)
export const UnifiedMultimodalFrameSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  modalities: z.array(PerceptionModalitySchema).min(1),
  visualSummary: z.string().optional(),
  audioSummary: z.string().optional(),
  screenSummary: z.string().optional(),
  scene: SceneUnderstandingSchema,
  detectedObjects: z.array(DetectedObjectSchema).default([]),
  perceptualEvents: z.array(PerceptualEventSchema).default([]),
  directObservations: z.array(z.string()).default([]),
  assumptions: z
    .array(
      z.object({
        assumption: z.string(),
        confidence: z.number().min(0.0).max(1.0),
        isAssumption: z.literal(true).default(true),
        requiresVerification: z.boolean().default(true),
      }),
    )
    .default([]),
  overallConfidence: z.number().min(0.0).max(1.0).default(0.85),
  perceptualContextSynthesis: z.string().min(1),
});
export type UnifiedMultimodalFrame = z.infer<typeof UnifiedMultimodalFrameSchema>;

export const FuseMultimodalInputSchema = z.object({
  imageResult: ImageInterpretationResultSchema.optional(),
  audioResult: AudioPerceptionResultSchema.optional(),
  videoResult: VideoInterpretationResultSchema.optional(),
  screenResult: ScreenInterpretationResultSchema.optional(),
  contextHint: z.string().optional(),
});
export type FuseMultimodalInput = z.input<typeof FuseMultimodalInputSchema>;

// 6. Specialist OCR & Layout Recognition
export const OcrTaskTypeSchema = z.enum(['text', 'formula', 'table', 'form', 'document']);
export type OcrTaskType = z.infer<typeof OcrTaskTypeSchema>;

export const OcrInspectionResultSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  mediaId: z.string().optional(),
  task: OcrTaskTypeSchema,
  status: z.enum(['completed', 'failed', 'unavailable']),
  text: z.string(),
  model: z.string(),
  confidence: z.number().min(0.0).max(1.0).default(0.95),
  provenance: z.object({
    prompt: z.string(),
    imageDimensions: z
      .object({
        width: z.number().optional(),
        height: z.number().optional(),
      })
      .optional(),
    offsetMs: z.number().optional(),
    sourcePath: z.string().optional(),
  }),
  error: z.string().optional(),
});
export type OcrInspectionResult = z.infer<typeof OcrInspectionResultSchema>;

export const PerformOcrInputSchema = z.object({
  imageBase64: z.string().optional(),
  imagePath: z.string().optional(),
  mediaId: z.string().optional(),
  task: OcrTaskTypeSchema.default('text'),
  prompt: z.string().optional(),
  maxTokens: z.number().int().positive().optional().default(512),
  offsetMs: z.number().optional(),
});
export type PerformOcrInput = z.input<typeof PerformOcrInputSchema>;

// ==========================================
// Empirical Observation Availability & Truth
// ==========================================

export const ObservationAvailabilitySchema = z.enum([
  'OBSERVATION_AVAILABLE',
  'OBSERVATION_STALE',
  'OBSERVATION_UNAVAILABLE',
  'OBSERVATION_FAILED',
]);
export type ObservationAvailability = z.infer<typeof ObservationAvailabilitySchema>;

export const ScreenObservationContextSchema = z.object({
  status: ObservationAvailabilitySchema,
  timestamp: z.string().optional(),
  source: z.string().optional(),
  freshnessSeconds: z.number().optional(),
  error: z.string().optional(),
  visibleWindows: z.array(z.string()).optional(),
  activeWindow: z.string().optional(),
});
export type ScreenObservationContext = z.infer<typeof ScreenObservationContextSchema>;
