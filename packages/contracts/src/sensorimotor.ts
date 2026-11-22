import { z } from 'zod';

// ==========================================
// Milestone 08: Sensorimotor and Action Grounding Contracts
// Negative Invariant: Never assume an action succeeded without verification.
// Distinguish attempted actions from verified outcomes.
// ==========================================

export const SpatialCoordinateSystemSchema = z.enum([
  'screen_absolute',
  'window_relative',
  'ui_element_relative',
]);
export type SpatialCoordinateSystem = z.infer<typeof SpatialCoordinateSystemSchema>;

export const SpatialTargetSchema = z.object({
  coordinateSystem: SpatialCoordinateSystemSchema.default('screen_absolute'),
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
  windowId: z.string().nullable().optional(),
  windowTitle: z.string().nullable().optional(),
  boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable().optional(),
});
export type SpatialTarget = z.infer<typeof SpatialTargetSchema>;

export const SensorimotorActionTypeSchema = z.enum([
  'mouse_click',
  'mouse_move',
  'mouse_drag',
  'keyboard_type',
  'keyboard_shortcut',
  'window_action',
  'application_launch',
  'tool_execution',
]);
export type SensorimotorActionType = z.infer<typeof SensorimotorActionTypeSchema>;

export const ActionAttemptPayloadSchema = z.object({
  actionType: SensorimotorActionTypeSchema,
  target: SpatialTargetSchema,
  parameters: z.record(z.any()).default({}),
});
export type ActionAttemptPayload = z.infer<typeof ActionAttemptPayloadSchema>;

export const VerificationMethodSchema = z.enum([
  'screen_state_change',
  'window_event',
  'exit_code',
  'process_table',
  'none',
]);
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;

export const ActionOutcomeVerificationSchema = z.object({
  status: z.enum(['unverified', 'verified_success', 'verified_failure', 'inconclusive']),
  verificationMethod: VerificationMethodSchema,
  intendedOutcome: z.string(),
  observedDelta: z.string(),
  confidence: z.number().min(0).max(1).default(0.85),
  isVerified: z.boolean().default(false),
});
export type ActionOutcomeVerification = z.infer<typeof ActionOutcomeVerificationSchema>;

export const SensorimotorActionRecordSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  intentionId: z.string().nullable().optional(),
  actionType: SensorimotorActionTypeSchema,
  spatialTarget: SpatialTargetSchema,
  intendedOutcome: z.string(),
  attemptedPayload: ActionAttemptPayloadSchema,
  executedAt: z.string(),
  executionStatus: z.enum(['attempted', 'executed', 'failed_execution', 'blocked_permission']),
  verification: ActionOutcomeVerificationSchema,
  distinctionAnalysis: z.string(),
  durationMs: z.number().nonnegative(),
  retryCount: z.number().int().nonnegative().default(0),
});
export type SensorimotorActionRecord = z.infer<typeof SensorimotorActionRecordSchema>;

export const InteractionStrategySchema = z.object({
  id: z.string().uuid(),
  targetAppOrContext: z.string(),
  goalType: z.string(),
  primarySequence: z.array(z.record(z.any())),
  fallbackSequence: z.array(z.record(z.any())).optional(),
  successCount: z.number().int().nonnegative().default(0),
  failureCount: z.number().int().nonnegative().default(0),
  empiricalReliability: z.number().min(0).max(1).default(0.5),
  lastUsedAt: z.string(),
});
export type InteractionStrategy = z.infer<typeof InteractionStrategySchema>;

export const WindowGeometrySchema = z.object({
  windowId: z.string(),
  title: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  isFocused: z.boolean().default(false),
});
export type WindowGeometry = z.infer<typeof WindowGeometrySchema>;

export const SpatialCalibrationSchema = z.object({
  displayId: z.string().default('primary'),
  screenWidth: z.number(),
  screenHeight: z.number(),
  scaleFactor: z.number().default(1.0),
  activeWindows: z.array(WindowGeometrySchema).default([]),
  calibratedAt: z.string(),
});
export type SpatialCalibration = z.infer<typeof SpatialCalibrationSchema>;

// Strict Epistemic Invariant Validator:
// Asserts that attempted actions are strictly distinguished from verified outcomes.
export function assertActionGroundingIntegrity(
  attemptedOutcome: string,
  verification: ActionOutcomeVerification,
  distinctionAnalysis: string,
): { valid: boolean; error?: string } {
  if (!attemptedOutcome || attemptedOutcome.trim().length === 0) {
    return {
      valid: false,
      error: 'Epistemic violation: Attempted outcome description must not be empty.',
    };
  }
  if (verification.status === 'unverified' && verification.isVerified) {
    return {
      valid: false,
      error:
        'Epistemic violation: Action cannot be marked isVerified=true while verification.status is unverified.',
    };
  }
  if (
    (verification.status === 'unverified' || verification.status === 'verified_failure') &&
    distinctionAnalysis.toLowerCase().includes('successfully achieved intended outcome')
  ) {
    return {
      valid: false,
      error:
        'Epistemic violation: Claiming success on an unverified or failed action is prohibited.',
    };
  }
  return { valid: true };
}
