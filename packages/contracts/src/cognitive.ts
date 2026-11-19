import { z } from 'zod';

export const CognitiveEventTypeSchema = z.enum([
  'user_message',
  'telegram_message',
  'telegram_media',
  'media_perceived',
  'agency_observation',
  'action_executed',
  'task_outcome',
  'goal_activated',
  'goal_progress',
  'goal_failed',
  'goal_completed',
  'project_milestone',
  'intellectual_question',
  'belief_formed',
  'belief_revised',
  'environmental_change',
  'internal_tick',
  'reflection_cycle',
]);

export type CognitiveEventType = z.infer<typeof CognitiveEventTypeSchema>;

export const CognitivePipelineStageSchema = z.enum([
  'ingestion',
  'normalization',
  'provenance_validation',
  'perception_interpretation',
  'appraisal',
  'psychological_evaluation',
  'motivational_evaluation',
  'goal_evaluation',
  'decision_selection',
  'permission_assessment',
  'action_execution',
  'outcome_verification',
  'memory_integration',
  'reflection',
  'development_update',
  'state_persistence',
]);

export type CognitivePipelineStage = z.infer<typeof CognitivePipelineStageSchema>;

export const CognitiveEventSchema = z.object({
  id: z.string().uuid(),
  type: CognitiveEventTypeSchema,
  timestamp: z.string().datetime(),
  source: z.enum(['user', 'telegram', 'agency', 'timer', 'internal', 'environment']),
  actor: z.enum(['user', 'arle', 'environment', 'system']),
  causalParentEventId: z.string().uuid().optional(),
  causalDepth: z.number().int().nonnegative().default(0),
  payload: z.record(z.unknown()).default({}),
  idempotencyKey: z.string().min(1),
  status: z.enum(['pending', 'processing', 'processed', 'failed', 'ignored']).default('pending'),
  processedStages: z.array(CognitivePipelineStageSchema).default([]),
  error: z.string().optional(),
});

export type CognitiveEvent = z.infer<typeof CognitiveEventSchema>;

export const CognitiveDecisionSchema = z.object({
  id: z.string().uuid(),
  eventId: z.string().uuid(),
  actionType: z.enum([
    'speak',
    'execute_agency_task',
    'start_project',
    'research',
    'reflect',
    'rest',
    'decline',
  ]),
  target: z.string().optional(),
  chosenAlternativeReason: z.string(),
  rejectedAlternatives: z.array(
    z.object({
      actionType: z.string(),
      reason: z.string(),
    }),
  ).default([]),
  confidence: z.number().min(0).max(1).default(1.0),
  riskAssessment: z.enum(['low', 'moderate', 'high']).default('low'),
  permissionRequired: z.boolean().default(false),
  resourceEstimate: z.object({
    cpu: z.enum(['low', 'medium', 'high']).default('low'),
    gpu: z.boolean().default(false),
    timeoutMs: z.number().int().positive().default(5000),
  }).default({ cpu: 'low', gpu: false, timeoutMs: 5000 }),
  timestamp: z.string().datetime(),
});

export type CognitiveDecision = z.infer<typeof CognitiveDecisionSchema>;

export const CognitiveCycleResultSchema = z.object({
  eventId: z.string().uuid(),
  idempotencyKey: z.string(),
  wasDeduplicated: z.boolean().default(false),
  stagesCompleted: z.array(CognitivePipelineStageSchema).default([]),
  appraisalSummary: z.string().optional(),
  activeMood: z.string().optional(),
  activeEmotionCount: z.number().int().nonnegative().optional(),
  decision: CognitiveDecisionSchema.optional(),
  memoriesCommitted: z.array(z.string()).default([]),
  reflectionRecorded: z.string().optional(),
  developmentMilestoneRecorded: z.string().optional(),
  // Explicit Outcome Model (P0.1)
  pipelineCompleted: z.boolean().default(true),
  actionAttempted: z.boolean().default(false),
  actionExecuted: z.boolean().default(false),
  outcomeObserved: z.boolean().default(false),
  outcomeVerified: z.boolean().default(false),
  taskSucceeded: z.boolean().default(false),
  success: z.boolean().default(true),
  error: z.string().optional(),
});

export type CognitiveCycleResult = z.infer<typeof CognitiveCycleResultSchema>;
