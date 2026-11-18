import { z } from 'zod';

// ==========================================
// Milestone 09: Situational Awareness Contracts
// Objective: Maintain awareness of the current operational situation.
// Acceptance criteria: Arle must be able to describe what she is currently doing,
// what has changed, and which events are relevant to her active objectives.
// ==========================================

export const ActivityCategorySchema = z.enum([
  'interaction',
  'research',
  'coding',
  'system_maintenance',
  'relational_conversation',
  'idle_monitoring',
]);
export type ActivityCategory = z.infer<typeof ActivityCategorySchema>;

export const ActivityStatusSchema = z.enum([
  'active',
  'paused',
  'completed',
  'interrupted',
]);
export type ActivityStatus = z.infer<typeof ActivityStatusSchema>;

export const ActiveApplicationSchema = z.object({
  name: z.string(),
  windowTitle: z.string().optional(),
  pid: z.number().optional(),
  isForeground: z.boolean().default(false),
});
export type ActiveApplication = z.infer<typeof ActiveApplicationSchema>;

export const OperationalActivitySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  category: ActivityCategorySchema,
  status: ActivityStatusSchema,
  startedAt: z.string(),
  lastActiveAt: z.string(),
  activeApplication: ActiveApplicationSchema,
  associatedGoalId: z.string().nullable().optional(),
});
export type OperationalActivity = z.infer<typeof OperationalActivitySchema>;

export const EventLayerSchema = z.enum(['foreground', 'background']);
export type EventLayer = z.infer<typeof EventLayerSchema>;

export const EnvironmentalEventTypeSchema = z.enum([
  'window_focus_change',
  'app_lifecycle',
  'user_input',
  'notification',
  'system_alert',
  'file_mutation',
  'network_event',
]);
export type EnvironmentalEventType = z.infer<typeof EnvironmentalEventTypeSchema>;

export const EnvironmentalEventSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  eventType: EnvironmentalEventTypeSchema,
  layer: EventLayerSchema,
  description: z.string(),
  source: z.string(),
  relevanceScore: z.number().min(0).max(1).default(0.5),
  isInterruption: z.boolean().default(false),
  interruptedActivityId: z.string().nullable().optional(),
});
export type EnvironmentalEvent = z.infer<typeof EnvironmentalEventSchema>;

export const SituationalContextSnapshotSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string(),
  currentActivity: OperationalActivitySchema,
  activeApplications: z.array(ActiveApplicationSchema),
  foregroundEvents: z.array(EnvironmentalEventSchema),
  backgroundEvents: z.array(EnvironmentalEventSchema),
  activeInterruptions: z.array(EnvironmentalEventSchema),
  recentChanges: z.array(z.string()),
  situationalNarrative: z.string(),
});
export type SituationalContextSnapshot = z.infer<typeof SituationalContextSnapshotSchema>;
