import { z } from 'zod';

export const HABIT_TRIGGER_TYPES = [
  'temporal',
  'environmental',
  'affective_state',
  'relational',
] as const;

export const HabitTriggerTypeSchema = z.enum(HABIT_TRIGGER_TYPES);
export type HabitTriggerType = z.infer<typeof HabitTriggerTypeSchema>;

export const ContextualTriggerSchema = z.object({
  triggerType: HabitTriggerTypeSchema,
  conditionKey: z.string().min(1),
  thresholdOrValue: z.union([z.string(), z.number()]),
  description: z.string().min(1),
});
export type ContextualTrigger = z.infer<typeof ContextualTriggerSchema>;

export const RoutineStepSchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  actionName: z.string().min(1),
  expectedDurationMs: z.number().int().nonnegative().default(1000),
  isAutomated: z.boolean().default(true),
});
export type RoutineStep = z.infer<typeof RoutineStepSchema>;

export const HabitRecordSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  domain: z.string().min(1),
  description: z.string().min(1),
  triggers: z.array(ContextualTriggerSchema),
  routineSteps: z.array(RoutineStepSchema),
  repetitionCount: z.number().int().nonnegative().default(0),
  automaticityScore: z.number().min(0.0).max(1.0).default(0.1),
  utilityScore: z.number().min(0.0).max(1.0).default(0.8),
  isActive: z.boolean().default(true),
  isModified: z.boolean().default(false),
  lastExecutedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type HabitRecord = z.infer<typeof HabitRecordSchema>;

export const HabitExecutionLogSchema = z.object({
  id: z.string(),
  habitId: z.string().min(1),
  triggeredBy: z.string().min(1),
  completedSteps: z.number().int().nonnegative(),
  wasInterrupted: z.boolean().default(false),
  interruptionReason: z.string().optional(),
  executionOutcome: z.enum(['completed', 'interrupted', 'modified']),
  outcomeUtility: z.number().min(0.0).max(1.0),
  executedAt: z.string(),
});
export type HabitExecutionLog = z.infer<typeof HabitExecutionLogSchema>;

export const NoveltyRoutineBalanceSchema = z.object({
  routineRatio: z.number().min(0.0).max(1.0),
  noveltyRatio: z.number().min(0.0).max(1.0),
  balanceStatus: z.enum(['balanced', 'over_routinized', 'over_exploratory']),
  assessedAt: z.string(),
});
export type NoveltyRoutineBalance = z.infer<typeof NoveltyRoutineBalanceSchema>;
