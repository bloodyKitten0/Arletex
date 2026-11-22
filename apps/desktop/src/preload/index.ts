import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  Activity,
  ActivityOrigin,
  ActivityStatus,
  Conversation,
  CreateActivityInput,
  CreateMemoryInput,
  DeviceTelemetry,
  InferenceConfig,
  InferenceHealthResult,
  IPC_CHANNELS,
  IPCResponse,
  Memory,
  Message,
  QueryMemoriesInput,
  StartInferenceStreamInput,
  StreamChunk,
  UpdateActivityInput,
  UpdateMemoryInput,
  VisionInspectResult,
  VideoInspectResult,
  VideoInspectInput,
  ApeAppraisal,
  ApeDevelopmentState,
  ApeHistoryResponse,
  ApeMasterState,
  ApeMotivationalState,
  ApePersonalityState,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ApeRelationshipState,
  ApeSelfModel,
  EmotionTaxonomyItem,
  MoodTaxonomyItem,
} from '@arletex/contracts';

export interface ArletexApi {
  listConversations: () => Promise<IPCResponse<Conversation[]>>;
  createConversation: (title?: string, isPinned?: boolean) => Promise<IPCResponse<Conversation>>;
  getConversation: (id: string) => Promise<IPCResponse<Conversation>>;
  updateConversation: (
    id: string,
    title?: string,
    isPinned?: boolean,
  ) => Promise<IPCResponse<Conversation>>;
  deleteConversation: (id: string) => Promise<IPCResponse<boolean>>;
  listMessages: (conversationId: string) => Promise<IPCResponse<Message[]>>;
  checkInferenceHealth: () => Promise<IPCResponse<InferenceHealthResult>>;
  updateInferenceConfig: (
    config: Partial<InferenceConfig>,
  ) => Promise<IPCResponse<InferenceConfig>>;
  startInferenceStream: (input: StartInferenceStreamInput) => Promise<IPCResponse<null>>;
  cancelInference: (requestId: string) => Promise<IPCResponse<{ cancelled: boolean }>>;
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => () => void;

  // Memory APIs
  listMemories: (options?: QueryMemoriesInput) => Promise<IPCResponse<Memory[]>>;
  createMemory: (input: CreateMemoryInput) => Promise<IPCResponse<Memory>>;
  updateMemory: (input: UpdateMemoryInput) => Promise<IPCResponse<Memory>>;
  deleteMemory: (id: string) => Promise<IPCResponse<boolean>>;
  mergeMemories: (primaryId: string, secondaryId: string) => Promise<IPCResponse<Memory>>;

  // Activities APIs
  listActivities: (
    status?: ActivityStatus,
    origin?: ActivityOrigin,
  ) => Promise<IPCResponse<Activity[]>>;
  createActivity: (input: CreateActivityInput) => Promise<IPCResponse<Activity>>;
  updateActivity: (input: UpdateActivityInput) => Promise<IPCResponse<Activity>>;
  deleteActivity: (id: string) => Promise<IPCResponse<boolean>>;

  // Device Telemetry & Preferences
  getTelemetry: () => Promise<IPCResponse<DeviceTelemetry>>;
  getPreferences: () => Promise<IPCResponse<Record<string, string>>>;
  setPreference: (key: string, value: string) => Promise<IPCResponse<boolean>>;

  // Voice & Vision
  transcribeAudio: (
    audioBase64: string,
    format?: string,
  ) => Promise<IPCResponse<{ transcript: string }>>;
  synthesizeSpeech: (
    text: string,
    voice?: string,
    tone?: string,
    leadPaddingMs?: number,
    useRvc?: boolean,
  ) => Promise<IPCResponse<{ audioBase64: string | null }>>;
  inspectVision: (
    imageBase64: string,
    mimeType?: string,
    prompt?: string,
  ) => Promise<IPCResponse<VisionInspectResult>>;
  inspectVideo: (input: VideoInspectInput) => Promise<IPCResponse<VideoInspectResult>>;

  // APE (Artificial Psychology Engine)
  getApeState: () => Promise<IPCResponse<ApePsychologicalState>>;
  getApeHistory: () => Promise<IPCResponse<ApeHistoryResponse>>;
  getApeTaxonomy: () => Promise<
    IPCResponse<{ emotions: EmotionTaxonomyItem[]; moods: MoodTaxonomyItem[] }>
  >;
  processApeEvent: (
    event: any,
  ) => Promise<IPCResponse<{ state: ApePsychologicalState; appraisal?: ApeAppraisal }>>;
  getApeRelationship: () => Promise<IPCResponse<ApeRelationshipConfig>>;
  updateApeRelationship: (
    config: Partial<ApeRelationshipConfig>,
  ) => Promise<IPCResponse<ApeRelationshipConfig>>;
  getApeMasterState: () => Promise<IPCResponse<ApeMasterState>>;
  getApePersonality: () => Promise<IPCResponse<ApePersonalityState>>;
  updateApePersonality: (
    data: Partial<ApePersonalityState>,
  ) => Promise<IPCResponse<ApePersonalityState>>;
  getApeMotivational: () => Promise<IPCResponse<ApeMotivationalState>>;
  updateApeMotivational: (
    data: Partial<ApeMotivationalState>,
  ) => Promise<IPCResponse<ApeMotivationalState>>;
  getApeExtendedRelationship: () => Promise<IPCResponse<ApeRelationshipState>>;
  updateApeExtendedRelationship: (
    data: Partial<ApeRelationshipState>,
  ) => Promise<IPCResponse<ApeRelationshipState>>;
  getApeSelfModel: () => Promise<IPCResponse<ApeSelfModel>>;
  updateApeSelfModel: (data: Partial<ApeSelfModel>) => Promise<IPCResponse<ApeSelfModel>>;
  getApeDevelopment: () => Promise<IPCResponse<ApeDevelopmentState>>;
  updateApeDevelopment: (
    data: Partial<ApeDevelopmentState>,
  ) => Promise<IPCResponse<ApeDevelopmentState>>;

  // Autonomy & Device Agency
  getAutonomyStatus: () => Promise<IPCResponse<any>>;
  toggleAutonomy: (
    enabled: boolean,
  ) => Promise<IPCResponse<{ success: boolean; isEnabled: boolean }>>;
  triggerAutonomyCycle: () => Promise<IPCResponse<{ success: boolean; actionLog: any }>>;
  captureDeviceScreen: () => Promise<
    IPCResponse<{ imagePath: string; imageBase64: string; width: number; height: number }>
  >;
  executeDeviceAction: (input: any) => Promise<IPCResponse<{ success: boolean; message: string }>>;
  openDeviceBrowser: (url?: string) => Promise<IPCResponse<{ success: boolean; message: string }>>;
  launchDeviceSteam: (
    steamAppId?: string,
  ) => Promise<IPCResponse<{ success: boolean; message: string }>>;
  readAndAnalyzeScreen: (instruction?: string) => Promise<IPCResponse<any>>;
  getVisibleWindows: () => Promise<IPCResponse<{ windows: any[] }>>;
  interactWithScreen: (input: {
    text: string;
    windowTitle?: string;
    x?: number;
    y?: number;
    sendEnter?: boolean;
  }) => Promise<IPCResponse<any>>;
  getNotificationsStatus: () => Promise<IPCResponse<{ isRunning: boolean }>>;
  simulateNotification: (input: {
    appName?: string;
    summary?: string;
    body?: string;
  }) => Promise<IPCResponse<any>>;
  getTelegramStatus: () => Promise<
    IPCResponse<{ isConfigured: boolean; isPolling: boolean; targetChatId: string | null }>
  >;
  configureTelegram: (input: {
    botToken: string;
    targetChatId?: string;
  }) => Promise<IPCResponse<any>>;
  sendTelegramMessage: (input: {
    text: string;
    chatId?: string;
  }) => Promise<IPCResponse<{ success: boolean }>>;

  // Digital Agency Subsystem
  listAgencyTasks: (status?: string) => Promise<IPCResponse<any[]>>;
  getAgencyTask: (id: string) => Promise<IPCResponse<any>>;
  submitAgencyObjective: (input: {
    objective: string;
    initiator?: 'user' | 'arle';
  }) => Promise<IPCResponse<any>>;
  executeAgencyTask: (taskId: string) => Promise<IPCResponse<any>>;
  cancelAgencyTask: (taskId: string) => Promise<IPCResponse<any>>;
  getAgencyPolicy: () => Promise<IPCResponse<any>>;
  updateAgencyPolicy: (policy: any) => Promise<IPCResponse<any>>;
  getAgencyStatus: () => Promise<IPCResponse<any>>;
  reactivateAutonomy: (confirmation: string) => Promise<IPCResponse<any>>;
  listAuditLogs: () => Promise<IPCResponse<{ events: any[] }>>;
  listModels: (installedOnly?: boolean) => Promise<IPCResponse<{ models: any[] }>>;
  getActiveModel: () => Promise<IPCResponse<any>>;
  resolveModel: (input: {
    modelId?: string;
    fallbackModelId?: string;
  }) => Promise<IPCResponse<any>>;
  triggerEmergencyShutdown: (reason?: string) => Promise<IPCResponse<any>>;
}

const api: ArletexApi = {
  listConversations: () => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_LIST),
  createConversation: (title, isPinned) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_CREATE, title, isPinned),
  getConversation: (id) => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_GET, id),
  updateConversation: (id, title, isPinned) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_UPDATE, id, title, isPinned),
  deleteConversation: (id) => ipcRenderer.invoke(IPC_CHANNELS.CONVERSATIONS_DELETE, id),
  listMessages: (conversationId) => ipcRenderer.invoke(IPC_CHANNELS.MESSAGES_LIST, conversationId),
  checkInferenceHealth: () => ipcRenderer.invoke(IPC_CHANNELS.INFERENCE_HEALTH),
  updateInferenceConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_UPDATE, config),
  startInferenceStream: (input) => ipcRenderer.invoke(IPC_CHANNELS.INFERENCE_STREAM_START, input),
  cancelInference: (requestId) =>
    ipcRenderer.invoke(IPC_CHANNELS.INFERENCE_STREAM_CANCEL, requestId),
  onStreamChunk: (callback: (chunk: StreamChunk) => void) => {
    const subscription = (_: IpcRendererEvent, chunk: StreamChunk) => callback(chunk);
    ipcRenderer.on(IPC_CHANNELS.INFERENCE_STREAM_CHUNK, subscription);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.INFERENCE_STREAM_CHUNK, subscription);
    };
  },

  listMemories: (options) => ipcRenderer.invoke(IPC_CHANNELS.MEMORIES_LIST, options),
  createMemory: (input) => ipcRenderer.invoke(IPC_CHANNELS.MEMORIES_CREATE, input),
  updateMemory: (input) => ipcRenderer.invoke(IPC_CHANNELS.MEMORIES_UPDATE, input),
  deleteMemory: (id) => ipcRenderer.invoke(IPC_CHANNELS.MEMORIES_DELETE, id),
  mergeMemories: (primaryId, secondaryId) =>
    ipcRenderer.invoke(IPC_CHANNELS.MEMORIES_QUERY, { primaryId, secondaryId }),

  listActivities: (status, origin) =>
    ipcRenderer.invoke(IPC_CHANNELS.ACTIVITIES_LIST, status, origin),
  createActivity: (input) => ipcRenderer.invoke(IPC_CHANNELS.ACTIVITIES_CREATE, input),
  updateActivity: (input) => ipcRenderer.invoke(IPC_CHANNELS.ACTIVITIES_UPDATE, input),
  deleteActivity: (id) => ipcRenderer.invoke(IPC_CHANNELS.ACTIVITIES_DELETE, id),

  getTelemetry: () => ipcRenderer.invoke(IPC_CHANNELS.TELEMETRY_GET),
  getPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_GET),
  setPreference: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_SET, key, value),

  transcribeAudio: (audioBase64, format) =>
    ipcRenderer.invoke(IPC_CHANNELS.VOICE_TRANSCRIBE, { audioBase64, format }),
  synthesizeSpeech: (text, voice, tone, leadPaddingMs, useRvc) =>
    ipcRenderer.invoke(IPC_CHANNELS.VOICE_SYNTHESIZE, { text, voice, tone, leadPaddingMs, useRvc }),
  inspectVision: (imageBase64, mimeType, prompt) =>
    ipcRenderer.invoke(IPC_CHANNELS.VISION_INSPECT, { imageBase64, mimeType, prompt }),
  inspectVideo: (input) => ipcRenderer.invoke(IPC_CHANNELS.VIDEO_INSPECT, input),

  // APE (Artificial Psychology Engine)
  getApeState: () => ipcRenderer.invoke(IPC_CHANNELS.APE_STATE_GET),
  getApeHistory: () => ipcRenderer.invoke(IPC_CHANNELS.APE_HISTORY_GET),
  getApeTaxonomy: () => ipcRenderer.invoke(IPC_CHANNELS.APE_TAXONOMY_GET),
  processApeEvent: (event) => ipcRenderer.invoke(IPC_CHANNELS.APE_EVENT_PROCESS, event),
  getApeRelationship: () => ipcRenderer.invoke(IPC_CHANNELS.APE_RELATIONSHIP_GET),
  updateApeRelationship: (config) =>
    ipcRenderer.invoke(IPC_CHANNELS.APE_RELATIONSHIP_UPDATE, config),
  getApeMasterState: () => ipcRenderer.invoke(IPC_CHANNELS.APE_MASTER_STATE_GET),
  getApePersonality: () => ipcRenderer.invoke(IPC_CHANNELS.APE_PERSONALITY_GET),
  updateApePersonality: (data) => ipcRenderer.invoke(IPC_CHANNELS.APE_PERSONALITY_UPDATE, data),
  getApeMotivational: () => ipcRenderer.invoke(IPC_CHANNELS.APE_MOTIVATIONAL_GET),
  updateApeMotivational: (data) => ipcRenderer.invoke(IPC_CHANNELS.APE_MOTIVATIONAL_UPDATE, data),
  getApeExtendedRelationship: () => ipcRenderer.invoke(IPC_CHANNELS.APE_RELATIONSHIP_EXT_GET),
  updateApeExtendedRelationship: (data) =>
    ipcRenderer.invoke(IPC_CHANNELS.APE_RELATIONSHIP_EXT_UPDATE, data),
  getApeSelfModel: () => ipcRenderer.invoke(IPC_CHANNELS.APE_SELF_MODEL_GET),
  updateApeSelfModel: (data) => ipcRenderer.invoke(IPC_CHANNELS.APE_SELF_MODEL_UPDATE, data),
  getApeDevelopment: () => ipcRenderer.invoke(IPC_CHANNELS.APE_DEVELOPMENT_GET),
  updateApeDevelopment: (data) => ipcRenderer.invoke(IPC_CHANNELS.APE_DEVELOPMENT_UPDATE, data),

  // Autonomy & Device Agency
  getAutonomyStatus: () => ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_STATUS_GET),
  toggleAutonomy: (enabled: boolean) => ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_TOGGLE, enabled),
  triggerAutonomyCycle: () => ipcRenderer.invoke(IPC_CHANNELS.AUTONOMY_CYCLE_TRIGGER),
  captureDeviceScreen: () => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_SCREEN_CAPTURE),
  executeDeviceAction: (input) => ipcRenderer.invoke(IPC_CHANNELS.DEVICE_ACTION_EXECUTE, input),
  openDeviceBrowser: (url?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICE_BROWSER_OPEN, { url }),
  launchDeviceSteam: (steamAppId?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.DEVICE_STEAM_LAUNCH, { steamAppId }),
  readAndAnalyzeScreen: (instruction?: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SCREEN_READ_ANALYZE, { instruction }),
  getVisibleWindows: () => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_WINDOWS_GET),
  interactWithScreen: (input) => ipcRenderer.invoke(IPC_CHANNELS.SCREEN_INTERACT, input),
  getNotificationsStatus: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATIONS_STATUS_GET),
  simulateNotification: (input) => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATIONS_SIMULATE, input),
  getTelegramStatus: () => ipcRenderer.invoke(IPC_CHANNELS.TELEGRAM_STATUS_GET),
  configureTelegram: (input) => ipcRenderer.invoke(IPC_CHANNELS.TELEGRAM_CONFIGURE, input),
  sendTelegramMessage: (input) => ipcRenderer.invoke(IPC_CHANNELS.TELEGRAM_SEND, input),

  // Digital Agency Subsystem
  listAgencyTasks: (status) => ipcRenderer.invoke(IPC_CHANNELS.AGENCY_TASKS_LIST, status),
  getAgencyTask: (id) => ipcRenderer.invoke(IPC_CHANNELS.AGENCY_TASK_GET, id),
  submitAgencyObjective: (input) => ipcRenderer.invoke(IPC_CHANNELS.AGENCY_TASK_SUBMIT, input),
  executeAgencyTask: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.AGENCY_TASK_EXECUTE, taskId),
  cancelAgencyTask: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.AGENCY_TASK_CANCEL, taskId),
  getAgencyPolicy: () => ipcRenderer.invoke(IPC_CHANNELS.AGENCY_POLICY_GET),
  updateAgencyPolicy: (policy) => ipcRenderer.invoke(IPC_CHANNELS.AGENCY_POLICY_UPDATE, policy),
  getAgencyStatus: () => ipcRenderer.invoke(IPC_CHANNELS.AGENCY_STATUS_GET),
  reactivateAutonomy: (confirmation) =>
    ipcRenderer.invoke(IPC_CHANNELS.AGENCY_REACTIVATE, confirmation),
  listAuditLogs: () => ipcRenderer.invoke(IPC_CHANNELS.AUDIT_LOG_LIST),
  listModels: (installedOnly) => ipcRenderer.invoke(IPC_CHANNELS.MODELS_LIST, installedOnly),
  getActiveModel: () => ipcRenderer.invoke(IPC_CHANNELS.MODELS_ACTIVE_GET),
  resolveModel: (input) => ipcRenderer.invoke(IPC_CHANNELS.MODELS_RESOLVE, input),
  triggerEmergencyShutdown: (reason) =>
    ipcRenderer.invoke(IPC_CHANNELS.EMERGENCY_SHUTDOWN, { reason }),
};

contextBridge.exposeInMainWorld('arletexApi', api);
