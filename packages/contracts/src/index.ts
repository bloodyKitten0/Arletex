import { z } from 'zod';

// ==========================================
// IPC Channels
// ==========================================
export const IPC_CHANNELS = {
  CONVERSATIONS_LIST: 'arletex:conversations:list',
  CONVERSATIONS_GET: 'arletex:conversations:get',
  CONVERSATIONS_CREATE: 'arletex:conversations:create',
  CONVERSATIONS_UPDATE: 'arletex:conversations:update',
  CONVERSATIONS_DELETE: 'arletex:conversations:delete',
  MESSAGES_LIST: 'arletex:messages:list',
  INFERENCE_HEALTH: 'arletex:inference:health',
  INFERENCE_STREAM_START: 'arletex:inference:stream:start',
  INFERENCE_STREAM_CHUNK: 'arletex:inference:stream:chunk',
  INFERENCE_STREAM_CANCEL: 'arletex:inference:stream:cancel',
  CONFIG_GET: 'arletex:config:get',
  CONFIG_UPDATE: 'arletex:config:update',
  AUDIT_LOG_LIST: 'arletex:audit:list',

  // Memory Channels
  MEMORIES_LIST: 'arletex:memories:list',
  MEMORIES_GET: 'arletex:memories:get',
  MEMORIES_CREATE: 'arletex:memories:create',
  MEMORIES_UPDATE: 'arletex:memories:update',
  MEMORIES_DELETE: 'arletex:memories:delete',
  MEMORIES_QUERY: 'arletex:memories:query',

  // Activities Channels
  ACTIVITIES_LIST: 'arletex:activities:list',
  ACTIVITIES_CREATE: 'arletex:activities:create',
  ACTIVITIES_UPDATE: 'arletex:activities:update',
  ACTIVITIES_DELETE: 'arletex:activities:delete',

  // Device Telemetry
  TELEMETRY_GET: 'arletex:telemetry:get',

  // Voice Pipeline (Whisper & Kokoro)
  VOICE_TRANSCRIBE: 'arletex:voice:transcribe',
  VOICE_SYNTHESIZE: 'arletex:voice:synthesize',

  // Preferences & Vision & Video
  PREFERENCES_GET: 'arletex:preferences:get',
  PREFERENCES_SET: 'arletex:preferences:set',
  VISION_INSPECT: 'arletex:vision:inspect',
  VIDEO_INSPECT: 'arletex:video:inspect',

  // APE (Artificial Psychology Engine) Channels
  APE_STATE_GET: 'arletex:ape:state:get',
  APE_EVENT_PROCESS: 'arletex:ape:event:process',
  APE_HISTORY_GET: 'arletex:ape:history:get',
  APE_TAXONOMY_GET: 'arletex:ape:taxonomy:get',
  APE_RELATIONSHIP_GET: 'arletex:ape:relationship:get',
  APE_RELATIONSHIP_UPDATE: 'arletex:ape:relationship:update',
  APE_PERSONALITY_GET: 'arletex:ape:personality:get',
  APE_PERSONALITY_UPDATE: 'arletex:ape:personality:update',
  APE_MOTIVATIONAL_GET: 'arletex:ape:motivational:get',
  APE_MOTIVATIONAL_UPDATE: 'arletex:ape:motivational:update',
  APE_RELATIONSHIP_EXT_GET: 'arletex:ape:relationship_ext:get',
  APE_RELATIONSHIP_EXT_UPDATE: 'arletex:ape:relationship_ext:update',
  APE_SELF_MODEL_GET: 'arletex:ape:self_model:get',
  APE_SELF_MODEL_UPDATE: 'arletex:ape:self_model:update',
  APE_DEVELOPMENT_GET: 'arletex:ape:development:get',
  APE_DEVELOPMENT_UPDATE: 'arletex:ape:development:update',
  APE_MASTER_STATE_GET: 'arletex:ape:master_state:get',
  APE_NARRATIVE_STATE_GET: 'arletex:ape:narrative:state:get',
  APE_NARRATIVE_HISTORY_RECONSTRUCT: 'arletex:ape:narrative:history:reconstruct',
  APE_NARRATIVE_MILESTONES_GET: 'arletex:ape:narrative:milestones:get',
  APE_NARRATIVE_MILESTONE_CREATE: 'arletex:ape:narrative:milestone:create',
  APE_NARRATIVE_REAPPRAISE: 'arletex:ape:narrative:reappraise',

  // Temporal Cognition Channels (Milestone 04)
  APE_TEMPORAL_OVERVIEW_GET: 'arletex:ape:temporal:overview:get',
  APE_TEMPORAL_CLASSIFY: 'arletex:ape:temporal:classify',
  APE_TEMPORAL_TIMELINE_GET: 'arletex:ape:temporal:timeline:get',
  APE_TEMPORAL_INTENTION_CREATE: 'arletex:ape:temporal:intention:create',
  APE_TEMPORAL_COMMITMENT_CREATE: 'arletex:ape:temporal:commitment:create',
  APE_TEMPORAL_PLAN_CREATE: 'arletex:ape:temporal:plan:create',

  // Autonomous Agency & Device Control Channels
  AUTONOMY_STATUS_GET: 'arletex:autonomy:status:get',
  AUTONOMY_TOGGLE: 'arletex:autonomy:toggle',
  AUTONOMY_CYCLE_TRIGGER: 'arletex:autonomy:cycle:trigger',
  DEVICE_SCREEN_CAPTURE: 'arletex:device:screen:capture',
  DEVICE_ACTION_EXECUTE: 'arletex:device:action:execute',
  DEVICE_BROWSER_OPEN: 'arletex:device:browser:open',
  DEVICE_STEAM_LAUNCH: 'arletex:device:steam:launch',
  SCREEN_READ_ANALYZE: 'arletex:screen:read:analyze',
  SCREEN_WINDOWS_GET: 'arletex:screen:windows:get',
  SCREEN_INTERACT: 'arletex:screen:interact',
  NOTIFICATIONS_STATUS_GET: 'arletex:notifications:status:get',
  NOTIFICATIONS_SIMULATE: 'arletex:notifications:simulate',
  TELEGRAM_STATUS_GET: 'arletex:telegram:status:get',
  TELEGRAM_CONFIGURE: 'arletex:telegram:configure',
  TELEGRAM_SEND: 'arletex:telegram:send',

  // Digital Agency Channels
  AGENCY_TASKS_LIST: 'arletex:agency:tasks:list',
  AGENCY_TASK_GET: 'arletex:agency:task:get',
  AGENCY_TASK_SUBMIT: 'arletex:agency:task:submit',
  AGENCY_TASK_CANCEL: 'arletex:agency:task:cancel',
  AGENCY_POLICY_GET: 'arletex:agency:policy:get',
  AGENCY_POLICY_UPDATE: 'arletex:agency:policy:update',
  AGENCY_TASK_EXECUTE: 'arletex:agency:task:execute',
} as const;

export type IPCChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

// ==========================================
// Conversation Schemas & Types
// ==========================================
export const ConversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  isPinned: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).default({}),
});

export type Conversation = z.infer<typeof ConversationSchema>;

export const CreateConversationInputSchema = z.object({
  title: z.string().min(1).max(255).default('New Conversation'),
  isPinned: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateConversationInput = z.input<typeof CreateConversationInputSchema>;

export const UpdateConversationInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  isPinned: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateConversationInput = z.infer<typeof UpdateConversationInputSchema>;

// ==========================================
// Message Schemas & Types
// ==========================================
export const MessageRoleSchema = z.enum(['system', 'user', 'assistant']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string(),
  tokenCount: z.number().int().nonnegative().nullable().default(null),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).default({}),
});

export type Message = z.infer<typeof MessageSchema>;

export const CreateMessageInputSchema = z.object({
  conversationId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>;

// ==========================================
// Memory Schemas & Types
// ==========================================
export const MemoryTypeSchema = z.enum([
  'episodic',
  'semantic',
  'procedural',
  'autobiographical',
  'relationship',
  'project',
  'emotional',
  'prospective',
  'developmental',
]);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const MemoryCorrectionSchema = z.object({
  timestamp: z.string(),
  previousContent: z.string(),
  reason: z.string().optional(),
});

export type MemoryCorrection = z.infer<typeof MemoryCorrectionSchema>;

export const MemoryProvenanceSchema = z.enum([
  'raw_observation',
  'user_statement',
  'user_reported',
  'inferred_interpretation',
  'verified_fact',
  'autobiographical_experience',
  'uncertain_information',
  'conflicting_information',
  'interaction',
  'digital_agency',
  'historical_consolidation',
]);
export type MemoryProvenance = z.infer<typeof MemoryProvenanceSchema>;

export const EmbeddingStatusSchema = z.enum([
  'pending',
  'indexed',
  'stale',
  'failed',
]);
export type EmbeddingStatus = z.infer<typeof EmbeddingStatusSchema>;

export const MemoryEmbeddingRecordSchema = z.object({
  memoryId: z.string().uuid(),
  modelName: z.string(),
  dimensions: z.number(),
  status: EmbeddingStatusSchema,
  vector: z.instanceof(Float32Array).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  errorMessage: z.string().nullable().optional(),
});
export type MemoryEmbeddingRecord = z.infer<typeof MemoryEmbeddingRecordSchema>;

export const MemorySchema = z.object({
  id: z.string().uuid(),
  type: MemoryTypeSchema,
  content: z.string().min(1),
  rawObservation: z.string().nullable().default(null),
  interpretation: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1).default(0.75),
  importance: z.number().min(0).max(1).default(0.5),
  timestamp: z.string(),
  provenance: z.string().default('interaction'),
  sourceConversationId: z.string().uuid().nullable().default(null),
  sourceMessageId: z.string().uuid().nullable().default(null),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  correctionHistory: z.array(MemoryCorrectionSchema).default([]),
  isArchived: z.boolean().default(false),
  isDeleted: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
  similarityScore: z.number().optional(),
});

export type Memory = z.infer<typeof MemorySchema>;

export const CreateMemoryInputSchema = z.object({
  type: MemoryTypeSchema.default('episodic'),
  content: z.string().min(1),
  rawObservation: z.string().optional(),
  interpretation: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  importance: z.number().min(0).max(1).optional().default(0.5),
  timestamp: z.string().optional(),
  provenance: z.string().optional().default('interaction'),
  sourceConversationId: z.string().uuid().optional(),
  sourceMessageId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type CreateMemoryInput = z.input<typeof CreateMemoryInputSchema>;

export const UpdateMemoryInputSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1).optional(),
  interpretation: z.string().optional(),
  importance: z.number().min(0).max(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  provenance: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  isArchived: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
  reason: z.string().optional(),
});

export type UpdateMemoryInput = z.infer<typeof UpdateMemoryInputSchema>;

export const QueryMemoriesInputSchema = z.object({
  query: z.string().optional(),
  type: MemoryTypeSchema.optional(),
  limit: z.number().int().positive().optional(),
  minImportance: z.number().min(0).max(1).optional(),
  includeArchived: z.boolean().optional(),
});

export type QueryMemoriesInput = z.infer<typeof QueryMemoriesInputSchema>;

// ==========================================
// Activities Schemas & Types
// ==========================================
export const ActivityOriginSchema = z.enum(['arle_initiated', 'user_assigned']);
export type ActivityOrigin = z.infer<typeof ActivityOriginSchema>;

export const ActivityStatusSchema = z.enum([
  'planned',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
]);
export type ActivityStatus = z.infer<typeof ActivityStatusSchema>;

export const ActivitySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255),
  objective: z.string().min(1),
  origin: ActivityOriginSchema,
  status: ActivityStatusSchema,
  progress: z.number().min(0).max(1).default(0.0),
  associatedMemories: z.array(z.string()).default([]),
  relevantActions: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Activity = z.infer<typeof ActivitySchema>;

export const CreateActivityInputSchema = z.object({
  title: z.string().min(1).max(255),
  objective: z.string().min(1),
  origin: ActivityOriginSchema.default('user_assigned'),
  status: ActivityStatusSchema.default('planned'),
  progress: z.number().min(0).max(1).default(0.0),
  associatedMemories: z.array(z.string()).optional().default([]),
  relevantActions: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type CreateActivityInput = z.input<typeof CreateActivityInputSchema>;

export const UpdateActivityInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  objective: z.string().min(1).optional(),
  status: ActivityStatusSchema.optional(),
  progress: z.number().min(0).max(1).optional(),
  associatedMemories: z.array(z.string()).optional(),
  relevantActions: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type UpdateActivityInput = z.infer<typeof UpdateActivityInputSchema>;

// ==========================================
// Telemetry Schemas & Types
// ==========================================
export const DeviceTelemetrySchema = z.object({
  timestamp: z.string(),
  cpu: z.object({
    usagePercent: z.number().nullable(),
    frequencyMhz: z.number().nullable(),
    temperatureC: z.number().nullable(),
    model: z.string().nullable(),
  }),
  memory: z.object({
    totalBytes: z.number(),
    usedBytes: z.number(),
    freeBytes: z.number(),
    availableBytes: z.number(),
    usagePercent: z.number(),
    swapTotalBytes: z.number(),
    swapUsedBytes: z.number(),
  }),
  gpu: z.object({
    available: z.boolean(),
    name: z.string().nullable(),
    usagePercent: z.number().nullable(),
    temperatureC: z.number().nullable(),
    vramTotalBytes: z.number().nullable(),
    vramUsedBytes: z.number().nullable(),
    vramFreeBytes: z.number().nullable(),
  }),
  storage: z.object({
    totalBytes: z.number(),
    usedBytes: z.number(),
    freeBytes: z.number(),
    usagePercent: z.number(),
  }),
  battery: z.object({
    available: z.boolean(),
    percent: z.number().nullable(),
    isCharging: z.boolean().nullable(),
    powerWatts: z.number().nullable(),
  }),
  inference: z.object({
    activeModel: z.string().nullable(),
    provider: z.string().nullable(),
    lastTtftMs: z.number().nullable(),
    lastTps: z.number().nullable(),
    isGenerating: z.boolean(),
  }),
  services: z.object({
    backend: z.boolean(),
    database: z.boolean(),
    llamaServer: z.boolean(),
    embeddingGemma: z.boolean(),
    whisper: z.boolean(),
    kokoro: z.boolean(),
  }),
});

export type DeviceTelemetry = z.infer<typeof DeviceTelemetrySchema>;

// ==========================================
// Voice & Vision Schemas & Types
// ==========================================
export const TranscribeAudioInputSchema = z.object({
  audioBase64: z.string(),
  format: z.string().default('webm'),
});

export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

export const SynthesizeSpeechInputSchema = z.object({
  text: z.string().min(1),
  voice: z.string().optional().default('arlecchino'),
  speed: z.number().min(0.5).max(2.0).optional().default(0.93),
  tone: z.string().optional(),
  leadPaddingMs: z.number().optional().default(0),
  useRvc: z.boolean().optional(),
  pad: z.object({
    valence: z.number(),
    arousal: z.number(),
    dominance: z.number(),
  }).optional(),
  emotion: z.string().optional(),
  vocalRegister: z.string().optional(),
});

export type SynthesizeSpeechInput = z.infer<typeof SynthesizeSpeechInputSchema>;

export const VisionInspectInputSchema = z.object({
  imageBase64: z.string(),
  mimeType: z.string().default('image/png'),
  prompt: z.string().optional(),
});

export type VisionInspectInput = z.infer<typeof VisionInspectInputSchema>;

export const VisionInspectResultSchema = z.object({
  description: z.string(),
  extractedText: z.string().nullable(),
  objects: z.array(z.string()).default([]),
  confidence: z.number().default(1.0),
});

export type VisionInspectResult = z.infer<typeof VisionInspectResultSchema>;

export const VideoInspectInputSchema = z.object({
  videoBase64: z.string().optional(),
  videoPath: z.string().optional(),
  mimeType: z.string().default('video/mp4'),
  maxFrames: z.number().int().min(1).max(12).default(6),
});

export type VideoInspectInput = z.infer<typeof VideoInspectInputSchema>;

export const VideoInspectResultSchema = z.object({
  durationSeconds: z.number(),
  framesBase64: z.array(z.string()),
  transcript: z.string().nullable(),
  description: z.string().optional(),
});

export type VideoInspectResult = z.infer<typeof VideoInspectResultSchema>;

// ==========================================
// Inference Schemas & Types
// ==========================================
export const InferenceProviderTypeSchema = z.enum(['colibri', 'llama.cpp']);
export type InferenceProviderType = z.infer<typeof InferenceProviderTypeSchema>;

export const SpecialistCodingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  provider: InferenceProviderTypeSchema.default('llama.cpp'),
  serverUrl: z.string().url().default('http://127.0.0.1:8080'),
  modelId: z.string().default('Qwen3.5-9B-Heretic-Q4_K_M'),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().positive().default(4096),
});

export type SpecialistCodingConfig = z.infer<typeof SpecialistCodingConfigSchema>;

export const InferenceConfigSchema = z.object({
  provider: InferenceProviderTypeSchema.default('llama.cpp'),
  serverUrl: z.string().url().default('http://127.0.0.1:8080'),
  defaultModelId: z.string().default('Qwen2.5-14B-Uncensored-Q4_K_M'),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).default(0.9),
  maxTokens: z.number().int().positive().default(2048),
  repeatPenalty: z.number().min(1.0).max(2.0).default(1.18),
  frequencyPenalty: z.number().min(0.0).max(2.0).default(0.5),
  presencePenalty: z.number().min(0.0).max(2.0).default(0.3),
  stopSequences: z.array(z.string()).default([]),
  contextSize: z.number().int().positive().default(8192),

  specialistCoding: SpecialistCodingConfigSchema.default({
    enabled: false,
    provider: 'llama.cpp',
    serverUrl: 'http://127.0.0.1:8080',
    modelId: 'Qwen2.5-14B-Uncensored-Q4_K_M',
    temperature: 0.2,
    maxTokens: 4096,
  }),

  fallbackEnabled: z.boolean().default(false),
  fallbackProvider: InferenceProviderTypeSchema.default('llama.cpp'),
  fallbackServerUrl: z.string().url().default('http://127.0.0.1:8080'),
  fallbackModelId: z.string().default('Qwen2.5-14B-Uncensored-Q4_K_M'),
});

export type InferenceConfig = z.infer<typeof InferenceConfigSchema>;

export const UpdateInferenceConfigInputSchema = InferenceConfigSchema.partial();
export type UpdateInferenceConfigInput = z.infer<typeof UpdateInferenceConfigInputSchema>;

export const ServerHealthStatusSchema = z.enum(['connected', 'disconnected', 'checking', 'error']);
export type ServerHealthStatus = z.infer<typeof ServerHealthStatusSchema>;

export const InferenceHealthResultSchema = z.object({
  status: ServerHealthStatusSchema,
  provider: InferenceProviderTypeSchema.default('llama.cpp'),
  url: z.string(),
  latencyMs: z.number().nullable(),
  modelLoaded: z.string().nullable(),
  error: z.string().nullable(),
  isFallback: z.boolean().default(false),
  specialistCoding: z
    .object({
      status: ServerHealthStatusSchema,
      url: z.string(),
      modelLoaded: z.string().nullable(),
      latencyMs: z.number().nullable(),
    })
    .optional(),
});

export type InferenceHealthResult = z.infer<typeof InferenceHealthResultSchema>;

export const StartInferenceStreamInputSchema = z.object({
  requestId: z.string().uuid().optional(),
  conversationId: z.string().uuid(),
  userMessageContent: z.string().min(1),
  imageBase64: z.string().optional(),
  videoBase64: z.string().optional(),
  videoPath: z.string().optional(),
  videoMimeType: z.string().optional(),
  imagesBase64: z.array(z.string()).optional(),
  systemPromptOverride: z.string().optional(),
  temperatureOverride: z.number().min(0).max(2).optional(),
});

export type StartInferenceStreamInput = z.infer<typeof StartInferenceStreamInputSchema>;

export const CancelInferenceInputSchema = z.object({
  requestId: z.string().uuid(),
});

export type CancelInferenceInput = z.infer<typeof CancelInferenceInputSchema>;

export const StreamChunkSchema = z.object({
  requestId: z.string().uuid(),
  conversationId: z.string().uuid(),
  delta: z.string(),
  reasoningDelta: z.string().optional(),
  fullContent: z.string(),
  fullReasoning: z.string().optional(),
  isDone: z.boolean(),
  error: z.string().nullable().default(null),
  finishReason: z.string().nullable().default(null),
  specialistStage: z.enum(['central', 'coding_specialist', 'synthesis', 'watching_video']).optional(),
  specialistModel: z.string().optional(),
  ttftMs: z.number().optional(),
  tokensPerSecond: z.number().optional(),
  usage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
});

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

// ==========================================
// Application Configuration & Audit
// ==========================================
export const AppConfigSchema = z.object({
  databasePath: z.string(),
  inference: InferenceConfigSchema,
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  dataDirectory: z.string(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  actor: z.string(),
  action: z.string(),
  details: z.string(),
  status: z.enum(['success', 'denied', 'error']),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

export type IPCResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// ==========================================
// APE (Artificial Psychology Engine) Exports
// ==========================================
export * from './ape.js';
export * from './apeTaxonomyData.js';

// ==========================================
// Digital Agency Contracts
// ==========================================
export * from './agency.js';

// ==========================================
// Persistent Individual Continuity Contracts
// ==========================================
export * from './continuity.js';

// ==========================================
// Central Cognitive Control Contracts
// ==========================================
export * from './cognitive.js';

// ==========================================
// Narrative Identity Contracts (Milestone 03)
// ==========================================
export * from './narrative.js';

// ==========================================
// Temporal Cognition Contracts (Milestone 04)
// ==========================================
export * from './temporal.js';

// ==========================================
// World Model Contracts (Milestone 05)
// ==========================================
export * from './world.js';

// ==========================================
// Multimodal Perception Contracts (Milestone 06)
// ==========================================
export * from './perception.js';

// ==========================================
// Embodiment & Interoception Contracts (Milestone 07)
// ==========================================
export * from './embodiment.js';

// ==========================================
// Sensorimotor and Action Grounding (Milestone 08)
// ==========================================
export * from './sensorimotor.js';

// ==========================================
// Situational Awareness Contracts (Milestone 09)
// ==========================================
export * from './situational.js';

// ==========================================
// Attention and Salience Contracts (Milestone 10)
// ==========================================
export * from './attention.js';

// ==========================================
// Working Memory Contracts (Milestone 11)
// ==========================================
export * from './workingMemory.js';

// ==========================================
// Multi-System Memory Contracts (Milestone 12)
// ==========================================
export * from './multiSystemMemory.js';

// ==========================================
// Learning and Adaptation Contracts (Milestone 13)
// ==========================================
export * from './learning.js';

// ==========================================
// General Reasoning Contracts (Milestone 14)
// ==========================================
export * from './reasoning.js';

// ==========================================
// Causal Reasoning Contracts (Milestone 15)
// ==========================================
export * from './causal.js';

// ==========================================
// Predictive Cognition Contracts (Milestone 16)
// ==========================================
export * from './predictive.js';

// ==========================================
// Imagination and Simulation Contracts (Milestone 17)
// ==========================================
export * from './simulation.js';

// ==========================================
// Metacognition Contracts (Milestone 18)
// ==========================================
export * from './metacognition.js';

// ==========================================
// Global Cognitive Integration Contracts (Milestone 19)
// ==========================================
export * from './globalCognitiveIntegration.js';

// ==========================================
// Executive Functions Contracts (Milestone 20)
// ==========================================
export * from './executiveFunctions.js';

// ==========================================
// Self-Generated Goals Contracts (Milestone 21)
// ==========================================
export * from './selfGeneratedGoals.js';

// ==========================================
// Planning and Long-Term Intention Contracts (Milestone 22)
// ==========================================
export * from './persistentPlanning.js';

// ==========================================
// Deliberation and Internal Conflict Contracts (Milestone 23)
// ==========================================
export * from './deliberationAndConflict.js';

// ==========================================
// Autonomous Agency Contracts (Milestone 24)
// ==========================================
export * from './autonomousAgency.js';

// ==========================================
// Emotional Appraisal Contracts (Milestone 25)
// ==========================================
export * from './emotionalAppraisal.js';

// ==========================================
// Emotional Repertoire and Dynamics Contracts (Milestone 26)
// ==========================================
export * from './emotionalRepertoire.js';

// ==========================================
// Emotional Regulation and Resilience Contracts (Milestone 27)
// ==========================================
export * from './emotionalRegulation.js';

// ==========================================
// Needs, Drives and Homeostasis Contracts (Milestone 28)
// ==========================================
export * from './needsAndHomeostasis.js';

// ==========================================
// Intrinsic and Extrinsic Motivation Contracts (Milestone 29)
// ==========================================
export * from './intrinsicMotivation.js';

// ==========================================
// Curiosity and Exploration Contracts (Milestone 30)
// ==========================================
export * from './curiosityAndExploration.js';

// ==========================================
// Reward Learning Contracts (Milestone 31)
// ==========================================
export * from './rewardLearning.js';

// ==========================================
// Habits and Routines Contracts (Milestone 32)
// ==========================================
export * from './habitsAndRoutines.js';

// ==========================================
// Temperament and Personality Contracts (Milestone 33)
// ==========================================
export * from './temperamentAndPersonality.js';

// ==========================================
// Values and Moral Cognition Contracts (Milestone 34)
// ==========================================
export * from './valuesAndMoralCognition.js';

// ==========================================
// Self-Evaluation and Self-Efficacy Contracts (Milestone 35)
// ==========================================
export * from './selfEvaluationAndEfficacy.js';

// ==========================================
// Long-Term Psychological Development Contracts (Milestone 36)
// ==========================================
export * from './longTermDevelopment.js';







