import { z } from 'zod';

export const COMPETENCE_LEVELS = [
  'novice',
  'competent',
  'proficient',
  'expert',
  'master',
] as const;

export const CompetenceLevelSchema = z.enum(COMPETENCE_LEVELS);
export type CompetenceLevel = z.infer<typeof CompetenceLevelSchema>;

export const DomainCompetenceSchema = z.object({
  domain: z.string().min(1),
  level: CompetenceLevelSchema,
  calibratedConfidence: z.number().min(0.0).max(1.0),
  successCount: z.number().int().min(0).default(0),
  failureCount: z.number().int().min(0).default(0),
  demonstratedEvidenceIds: z.array(z.string()).default([]),
  lastAssessedAt: z.string(),
});
export type DomainCompetence = z.infer<typeof DomainCompetenceSchema>;

export const EfficacyEvidenceSchema = z.object({
  id: z.string(),
  domain: z.string().min(1),
  type: z.enum(['achievement', 'failure']),
  taskDescription: z.string().min(1),
  difficulty: z.number().min(0.1).max(1.0),
  outcomeDescription: z.string().min(1),
  lessonsLearned: z.string().optional(),
  timestamp: z.string(),
});
export type EfficacyEvidence = z.infer<typeof EfficacyEvidenceSchema>;

export const CapabilityLimitationSchema = z.object({
  id: z.string(),
  domain: z.string().min(1),
  limitation: z.string().min(1),
  mitigationStrategy: z.string().min(1),
  isStrictConstraint: z.boolean().default(true),
  updatedAt: z.string(),
});
export type CapabilityLimitation = z.infer<typeof CapabilityLimitationSchema>;

export const SelfImprovementGoalSchema = z.object({
  id: z.string(),
  domain: z.string().min(1),
  identifiedWeakness: z.string().min(1),
  targetCapability: z.string().min(1),
  progress: z.number().min(0.0).max(1.0).default(0.0),
  actionSteps: z.array(z.string()).default([]),
  status: z.enum(['active', 'in_progress', 'achieved', 'abandoned']).default('active'),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SelfImprovementGoal = z.infer<typeof SelfImprovementGoalSchema>;

export const SelfEvaluationSnapshotSchema = z.object({
  id: z.string(),
  overallConfidence: z.number().min(0.0).max(1.0),
  domainCompetences: z.array(DomainCompetenceSchema),
  activeLimitations: z.array(CapabilityLimitationSchema),
  activeImprovements: z.array(SelfImprovementGoalSchema),
  evidenceSummary: z.object({
    totalAchievements: z.number().int().min(0),
    totalFailures: z.number().int().min(0),
    calibrationAccuracy: z.number().min(0.0).max(1.0),
  }),
  evaluatedAt: z.string(),
});
export type SelfEvaluationSnapshot = z.infer<typeof SelfEvaluationSnapshotSchema>;
