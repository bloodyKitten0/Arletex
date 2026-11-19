import { z } from 'zod';

export const MOTIVATION_ORIENTATIONS = [
  'intrinsic',
  'extrinsic',
  'internalized',
  'competence',
  'relatedness',
] as const;

export const MotivationOrientationSchema = z.enum(MOTIVATION_ORIENTATIONS);
export type MotivationOrientation = z.infer<typeof MotivationOrientationSchema>;

export const MOTIVATION_SOURCES = [
  'self_intellectual_interest',
  'self_creative_drive',
  'partner_shared_inquiry',
  'external_request',
  'system_requirement',
] as const;

export const MotivationSourceSchema = z.enum(MOTIVATION_SOURCES);
export type MotivationSource = z.infer<typeof MotivationSourceSchema>;

export const MotivatedActivityStatusSchema = z.enum([
  'active',
  'completed',
  'paused',
  'abandoned_sterile',
  'internalized',
]);
export type MotivatedActivityStatus = z.infer<typeof MotivatedActivityStatusSchema>;

export const MotivatedActivitySchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  orientation: MotivationOrientationSchema,
  source: MotivationSourceSchema,
  personalSignificanceScore: z.number().min(0.0).max(1.0),
  autonomyIndex: z.number().min(0.0).max(1.0),
  competenceDriver: z.string().optional(),
  relatednessDriver: z.string().optional(),
  persistenceScore: z.number().min(0.0).max(1.0),
  currentEnergy: z.number().min(0.0).max(1.0),
  isExternallyPrompted: z.boolean(),
  status: MotivatedActivityStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MotivatedActivity = z.infer<typeof MotivatedActivitySchema>;

export const InternalizationRecordSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  externalOriginContext: z.string(),
  internalizedRationale: z.string().min(1),
  preAutonomyIndex: z.number().min(0.0).max(1.0),
  postAutonomyIndex: z.number().min(0.0).max(1.0),
  timestamp: z.string(),
});
export type InternalizationRecord = z.infer<typeof InternalizationRecordSchema>;

export const MotivationReassessmentRecommendationSchema = z.enum([
  'continue_sustained',
  'reframe_and_internalize',
  'pivot_or_abandon',
]);
export type MotivationReassessmentRecommendation = z.infer<
  typeof MotivationReassessmentRecommendationSchema
>;

export const MotivationReassessmentResultSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  previousEnergy: z.number().min(0.0).max(1.0),
  assessedEnergy: z.number().min(0.0).max(1.0),
  motivationLossDetected: z.boolean(),
  lossReason: z.string().optional(),
  recommendation: MotivationReassessmentRecommendationSchema,
  reassessmentRationale: z.string().min(1),
  evaluatedAt: z.string(),
});
export type MotivationReassessmentResult = z.infer<typeof MotivationReassessmentResultSchema>;
