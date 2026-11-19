import { z } from 'zod';

export const AutonomousActivityTypeSchema = z.enum([
  'independent_research',
  'project_execution',
  'application_interaction',
  'browser_interaction',
  'file_operation',
  'proactive_communication',
]);
export type AutonomousActivityType = z.infer<typeof AutonomousActivityTypeSchema>;

export const AutonomousActivityStatusSchema = z.enum([
  'initiated',
  'in_progress',
  'verifying',
  'completed',
  'interrupted',
  'failed',
  'recovered',
]);
export type AutonomousActivityStatus = z.infer<typeof AutonomousActivityStatusSchema>;

export const ActivityVerificationRecordSchema = z.object({
  verified: z.boolean(),
  criteria: z.string().min(1),
  observedEvidence: z.string().min(1),
  verifiedAt: z.string(),
});
export type ActivityVerificationRecord = z.infer<typeof ActivityVerificationRecordSchema>;

export const ActivityFailureInfoSchema = z.object({
  failureReason: z.string().min(1),
  attemptCount: z.number().int().min(1).default(1),
  recoveryStrategyApplied: z.string().optional(),
});
export type ActivityFailureInfo = z.infer<typeof ActivityFailureInfoSchema>;

export const ProactiveCommunicationEventSchema = z.object({
  messageText: z.string().min(1),
  channel: z.string().min(1).default('chat_companion'),
  rationale: z.string().min(1),
  communicatedAt: z.string(),
});
export type ProactiveCommunicationEvent = z.infer<typeof ProactiveCommunicationEventSchema>;

export const AutonomousActivityRecordSchema = z.object({
  id: z.string().min(1),
  goalId: z.string().optional(),
  planId: z.string().optional(),
  type: AutonomousActivityTypeSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  permissionLevel: z.enum(['granted_by_policy', 'interactive_consent']).default('granted_by_policy'),
  targetResource: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
  executionResult: z
    .object({
      output: z.string(),
      exitCode: z.number().optional(),
      artifactsCreated: z.array(z.string()).default([]),
    })
    .optional(),
  verification: ActivityVerificationRecordSchema.optional(),
  failureInfo: ActivityFailureInfoSchema.optional(),
  proactiveMessage: ProactiveCommunicationEventSchema.optional(),
  status: AutonomousActivityStatusSchema.default('initiated'),
  initiatedAt: z.string(),
  completedAt: z.string().optional(),
  interruptedAt: z.string().optional(),
});
export type AutonomousActivityRecord = z.infer<typeof AutonomousActivityRecordSchema>;

/**
 * Validates negative invariants for autonomous agency:
 * 1. Verification Invariant: Completed activity must possess valid verification evidence.
 * 2. Failure Invariant: Failed activity must document a failureReason.
 * 3. Interruption Invariant: Interrupted activity must have interruptedAt timestamp.
 */
export function assertAutonomousActivityIntegrity(activity: AutonomousActivityRecord): void {
  if (activity.status === 'completed') {
    if (!activity.verification || !activity.verification.verified) {
      throw new Error(
        `Negative Invariant Violation: Completed autonomous activity ${activity.id} must have verified=true evidence.`,
      );
    }
    if (!activity.completedAt) {
      throw new Error(
        `Negative Invariant Violation: Completed autonomous activity ${activity.id} missing completedAt timestamp.`,
      );
    }
  }

  if (activity.status === 'failed') {
    if (!activity.failureInfo || activity.failureInfo.failureReason.trim().length === 0) {
      throw new Error(
        `Negative Invariant Violation: Failed activity ${activity.id} must declare failureReason.`,
      );
    }
  }

  if (activity.status === 'interrupted' && !activity.interruptedAt) {
    throw new Error(
      `Negative Invariant Violation: Interrupted activity ${activity.id} missing interruptedAt timestamp.`,
    );
  }
}
