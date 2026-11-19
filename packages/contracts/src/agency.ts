import { z } from 'zod';

// ==========================================
// 1. Task & Objective Contracts
// ==========================================

export const TaskPrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskInitiatorSchema = z.enum(['user', 'arle']);
export type TaskInitiator = z.infer<typeof TaskInitiatorSchema>;

export const TaskStatusSchema = z.enum([
  'proposed',
  'awaiting_authorization',
  'authorized',
  'running',
  'waiting',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const AgencyTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  objective: z.string().min(1),
  constraints: z.array(z.string()).default([]),
  priority: TaskPrioritySchema.default('normal'),
  initiator: TaskInitiatorSchema.default('user'),
  status: TaskStatusSchema.default('proposed'),
  completionCriteria: z.array(z.string()).default([]),
  planId: z.string().uuid().optional(),
  currentStepIndex: z.number().int().min(0).default(0),
  totalSteps: z.number().int().min(0).default(0),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(3),
  error: z.string().nullable().default(null),
  metadata: z.record(z.string(), z.any()).default({}),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable().optional(),
});
export type AgencyTask = z.infer<typeof AgencyTaskSchema>;

export const CreateTaskInputSchema = AgencyTaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  currentStepIndex: true,
  totalSteps: true,
  retryCount: true,
}).partial({
  title: true,
  error: true,
  planId: true,
  status: true,
  priority: true,
  initiator: true,
  constraints: true,
  completionCriteria: true,
  maxRetries: true,
  metadata: true,
});
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

// ==========================================
// 2. Action Proposal Contracts
// ==========================================

export const ActionTypeSchema = z.enum([
  // Web Agency actions
  'web_search',
  'web_navigate',
  'navigate_browser',
  'web_read_page',
  'web_extract_metadata',
  'web_extract_candidates',
  'web_click_element',
  'web_fill_input',
  'web_select_video',
  'web_download_file',
  'web_close_tab',

  // Computer Agency actions
  'app_launch',
  'app_focus_window',
  'execute_command',
  'desktop_open_browser',
  'desktop_launch_steam',
  'desktop_mouse_move',
  'desktop_mouse_click',
  'desktop_key_press',
  'desktop_type_text',
  'desktop_take_screenshot',
  'desktop_capture_screen',
  'capture_screen',
  'system_read_file',
  'system_write_file',
  'system_list_directory',
  'code_modify',
  'protected_code_modification',
  'edit_file',

  // External communication actions
  'send_message',
  'telegram_message',
  'telegram_send_message',
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const RiskLevelSchema = z.enum(['none', 'low', 'medium', 'high', 'critical']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const ActionProposalSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  stepIndex: z.number().int().min(0),
  type: ActionTypeSchema,
  payload: z.record(z.string(), z.any()),
  rationale: z.string(),
  expectedOutcome: z.string(),
  riskLevel: RiskLevelSchema.default('low'),
  requiresExplicitApproval: z.boolean().default(false),
  createdAt: z.string(),
});
export type ActionProposal = z.infer<typeof ActionProposalSchema>;

// Web action payload schemas
export const WebSearchPayloadSchema = z.object({
  query: z.string().min(1),
  source: z.enum(['google', 'youtube', 'wikipedia', 'general']).default('general'),
  maxResults: z.number().int().min(1).max(20).default(5),
});
export type WebSearchPayload = z.infer<typeof WebSearchPayloadSchema>;

export const WebNavigatePayloadSchema = z.object({
  url: z.string().url(),
  waitForSelector: z.string().optional(),
  timeoutMs: z.number().int().default(15000),
});
export type WebNavigatePayload = z.infer<typeof WebNavigatePayloadSchema>;

export const WebSelectVideoPayloadSchema = z.object({
  topicQuery: z.string(),
  targetUrl: z.string().url(),
  videoTitle: z.string(),
  uploader: z.string().optional(),
  durationSeconds: z.number().optional(),
  selectionRationale: z.string(),
  expectedPlayback: z.boolean().default(true),
});
export type WebSelectVideoPayload = z.infer<typeof WebSelectVideoPayloadSchema>;

// Computer action payload schemas
export const AppLaunchPayloadSchema = z.object({
  appName: z.string().min(1),
  args: z.array(z.string()).default([]),
  expectedWindowTitle: z.string().optional(),
});
export type AppLaunchPayload = z.infer<typeof AppLaunchPayloadSchema>;

export const SystemFileReadPayloadSchema = z.object({
  filePath: z.string().min(1),
  maxBytes: z.number().int().default(1048576), // 1MB
});
export type SystemFileReadPayload = z.infer<typeof SystemFileReadPayloadSchema>;

export const SystemFileWritePayloadSchema = z.object({
  filePath: z.string().min(1),
  content: z.string(),
  overwrite: z.boolean().default(false),
});
export type SystemFileWritePayload = z.infer<typeof SystemFileWritePayloadSchema>;

// ==========================================
// 3. Plan & Step Contracts
// ==========================================

export const ExecutionStatusSchema = z.enum([
  'requested',
  'planned',
  'awaiting_authorization',
  'authorized',
  'attempted',
  'executing',
  'executed',
  'observed',
  'executed_unverified',
  'verified_outcome',
  'verified_successful',
  'partially_successful',
  'uncertain_outcome',
  'failed_outcome',
  'failed',
  'cancelled',
  'timed_out',
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const PlanStepStatusSchema = z.enum([
  'pending',
  'awaiting_authorization',
  'authorized',
  'running',
  'executing',
  'executed_unverified',
  'verified',
  'verified_successful',
  'partially_successful',
  'failed',
  'skipped',
  'cancelled',
  'timed_out',
]);
export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>;

export const PlanStepSchema = z.object({
  id: z.string().uuid(),
  index: z.number().int().min(0),
  description: z.string(),
  action: ActionProposalSchema,
  expectedOutcome: z.string(),
  status: PlanStepStatusSchema.default('pending'),
  observationId: z.string().uuid().optional(),
  retryCount: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(2),
  error: z.string().nullable().default(null),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const PlanStatusSchema = z.enum(['formulating', 'active', 'revised', 'completed', 'abandoned']);
export type PlanStatus = z.infer<typeof PlanStatusSchema>;

export const AgencyPlanSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  objective: z.string(),
  assumptions: z.array(z.string()).default([]),
  uncertainties: z.array(z.string()).default([]),
  steps: z.array(PlanStepSchema),
  alternativeApproaches: z.array(z.string()).default([]),
  status: PlanStatusSchema.default('active'),
  version: z.number().int().min(1).default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AgencyPlan = z.infer<typeof AgencyPlanSchema>;

// ==========================================
// 4. Observation & Evidence Contracts
// ==========================================

export const ObservationSourceSchema = z.enum([
  'browser_dom',
  'browser_metadata',
  'browser_video_element',
  'desktop_window_manager',
  'screen_frame_vision',
  'audio_stream_perception',
  'process_table',
  'filesystem_stat',
  'accessibility_tree',
]);
export type ObservationSource = z.infer<typeof ObservationSourceSchema>;

export const AgencyObservationSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  actionId: z.string().uuid().optional(),
  source: ObservationSourceSchema,
  timestamp: z.string(),
  success: z.boolean(),
  confidence: z.number().min(0).max(1),
  provenance: z.string(),
  data: z.record(z.string(), z.any()),
  error: z.string().nullable().default(null),
});
export type AgencyObservation = z.infer<typeof AgencyObservationSchema>;

// ==========================================
// 5. Verification & Recovery Contracts
// ==========================================

export const RecoveryStrategySchema = z.enum([
  'retry_with_backoff',
  'switch_candidate',
  'replan_sub_steps',
  'visual_interaction_fallback',
  'request_user_assistance',
  'fail_step_and_abort',
]);
export type RecoveryStrategy = z.infer<typeof RecoveryStrategySchema>;

export const VerificationResultSchema = z.object({
  actionId: z.string().uuid(),
  expectedOutcome: z.string(),
  observedOutcome: z.string(),
  verified: z.boolean(),
  confidence: z.number().min(0).max(1),
  status: ExecutionStatusSchema.optional(),
  failureReason: z.string().nullable().default(null),
  isRecoverable: z.boolean().default(false),
  recommendedStrategy: RecoveryStrategySchema.optional(),
  evidence: z.record(z.string(), z.any()).optional().default({}),
  timestamp: z.string(),
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

// ==========================================
// 6. Action & Permission Controller Contracts
// ==========================================

export const PermissionDecisionSchema = z.enum(['granted', 'denied', 'prompt_user']);
export type PermissionDecision = z.infer<typeof PermissionDecisionSchema>;

export const PermissionPolicySchema = z.object({
  autonomousExecutionEnabled: z.boolean().default(true),
  allowedFilesystemPaths: z.array(z.string()).default([]),
  readOnlyFilesystemPaths: z.array(z.string()).default([]),
  forbiddenFilesystemPaths: z.array(z.string()).default([]),
  allowedApplications: z.array(z.string()).default([]),
  allowedNetworkDomains: z.array(z.string()).default([]), // Empty = open web research
  forbiddenNetworkDomains: z.array(z.string()).default([]),
  requireApprovalForSensitiveFiles: z.boolean().default(true),
  requireApprovalForAppLaunch: z.boolean().default(false),
  requireApprovalForDesktopClicks: z.boolean().default(false),
});
export type PermissionPolicy = z.infer<typeof PermissionPolicySchema>;

export const EmergencyShutdownReportSchema = z.object({
  timestamp: z.string(),
  reason: z.string(),
  terminatedPids: z.array(z.number()),
  unmanagedPids: z.array(z.number()).default([]),
  cancelledTasksCount: z.number(),
  autonomyDisabled: z.boolean(),
  revokedCapabilities: z.array(z.string()).default([]),
});
export type EmergencyShutdownReport = z.infer<typeof EmergencyShutdownReportSchema>;

export const PlatformAuditResultSchema = z.object({
  sessionType: z.enum(['wayland', 'x11', 'headless']),
  waylandDisplay: z.string().nullable(),
  isKdeWayland: z.boolean(),
  screenCapture: z.object({
    tool: z.string().nullable(),
    isWaylandNative: z.boolean(),
    supported: z.boolean(),
  }),
  inputAutomation: z.object({
    tool: z.string().nullable(),
    isWaylandNative: z.boolean(),
    supported: z.boolean(),
    limitation: z.string().optional(),
  }),
  clipboard: z.object({
    tool: z.string().nullable(),
    isWaylandNative: z.boolean(),
    supported: z.boolean(),
  }),
  dialogPrompt: z.object({
    tool: z.string().nullable(),
    isKdeNative: z.boolean(),
    supported: z.boolean(),
  }),
  limitations: z.array(z.string()),
  recommendedWorkarounds: z.array(z.string()),
});
export type PlatformAuditResult = z.infer<typeof PlatformAuditResultSchema>;

export const AuthorizationCheckResultSchema = z.object({
  actionId: z.string().uuid(),
  decision: PermissionDecisionSchema,
  reason: z.string(),
  requiredPrivilege: z.string(),
  riskLevel: RiskLevelSchema,
  checkedAt: z.string(),
});
export type AuthorizationCheckResult = z.infer<typeof AuthorizationCheckResultSchema>;

// ==========================================
// 7. Memory & Episodic Experience Contracts
// ==========================================

export const DigitalExperienceSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  objective: z.string(),
  initiator: TaskInitiatorSchema,
  success: z.boolean(),
  actionsCount: z.number().int().min(0),
  outcomeSummary: z.string(),
  discoveries: z.array(z.string()).default([]),
  lessonsLearned: z.array(z.string()).default([]),
  verifiedFacts: z.array(z.string()).default([]),
  relatedUrl: z.string().optional(),
  timestamp: z.string(),
});
export type DigitalExperience = z.infer<typeof DigitalExperienceSchema>;

// ==========================================
// 8. Closed-Loop Agency Contracts (Observe-Interpret-Plan-Authorize-Execute-Verify-Learn)
// ==========================================

export const ActionLifecycleStageSchema = z.enum([
  'requested',
  'planned',
  'authorized',
  'attempted',
  'executed',
  'verified_outcome',
  'failed_outcome',
  'uncertain_outcome',
]);
export type ActionLifecycleStage = z.infer<typeof ActionLifecycleStageSchema>;

export const ClosedLoopCycleResultSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  objective: z.string(),
  stage: ActionLifecycleStageSchema,
  success: z.boolean(),
  plan: AgencyPlanSchema.optional(),
  observations: z.array(AgencyObservationSchema).default([]),
  verifications: z.array(VerificationResultSchema).default([]),
  experience: DigitalExperienceSchema.optional(),
  reflection: z.string().optional(),
  switchedCandidates: z.boolean().default(false),
  timestamp: z.string(),
});
export type ClosedLoopCycleResult = z.infer<typeof ClosedLoopCycleResultSchema>;
