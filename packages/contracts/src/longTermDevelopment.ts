import { z } from 'zod';

export const PSYCHOLOGICAL_DIMENSIONS = [
  'interest',
  'preference',
  'personality',
  'value',
  'emotional_learning',
  'reasoning',
  'goal',
  'habit',
] as const;

export const PsychologicalDimensionSchema = z.enum(PSYCHOLOGICAL_DIMENSIONS);
export type PsychologicalDimension = z.infer<typeof PsychologicalDimensionSchema>;

export const DevelopmentHistoryEntrySchema = z.object({
  id: z.string(),
  dimension: PsychologicalDimensionSchema,
  targetKey: z.string().min(1),
  previousState: z.string(),
  newState: z.string(),
  adaptationDriver: z.string().min(1),
  plasticityScore: z.number().min(0.0).max(1.0),
  timestamp: z.string(),
});
export type DevelopmentHistoryEntry = z.infer<typeof DevelopmentHistoryEntrySchema>;

export const IdentityAnchorSchema = z.object({
  id: z.string(),
  anchorKey: z.string().min(1),
  description: z.string().min(1),
  stabilityWeight: z.number().min(0.9).max(1.0).default(0.98),
  isImmutable: z.boolean().default(true),
  lastVerifiedAt: z.string(),
});
export type IdentityAnchor = z.infer<typeof IdentityAnchorSchema>;

export const DevelopmentEpochSchema = z.object({
  id: z.string(),
  epochName: z.string().min(1),
  summary: z.string().min(1),
  keyMilestones: z.array(z.string()).default([]),
  startedAt: z.string(),
  endedAt: z.string().nullable().default(null),
});
export type DevelopmentEpoch = z.infer<typeof DevelopmentEpochSchema>;

export const PsychologicalDevelopmentOverviewSchema = z.object({
  currentEpoch: DevelopmentEpochSchema,
  overallPlasticityIndex: z.number().min(0.0).max(1.0),
  identityStabilityScore: z.number().min(0.0).max(1.0),
  anchors: z.array(IdentityAnchorSchema),
  recentHistory: z.array(DevelopmentHistoryEntrySchema),
  evolutionMetrics: z.object({
    totalChangesLogged: z.number().int().min(0),
    changesByDimension: z.record(z.number().int().min(0)),
    daysEvolving: z.number().min(0),
  }),
});
export type PsychologicalDevelopmentOverview = z.infer<
  typeof PsychologicalDevelopmentOverviewSchema
>;
