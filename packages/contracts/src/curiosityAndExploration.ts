import { z } from 'zod';

export const INTEREST_MATURITY_LEVELS = [
  'nascent_spark',
  'active_inquiry',
  'developed_interest',
  'enduring_passion',
] as const;

export const InterestMaturityLevelSchema = z.enum(INTEREST_MATURITY_LEVELS);
export type InterestMaturityLevel = z.infer<typeof InterestMaturityLevelSchema>;

export const NoveltyDetectionRecordSchema = z.object({
  id: z.string(),
  stimulus: z.string().min(1),
  detectedDomain: z.string().min(1),
  noveltyScore: z.number().min(0.0).max(1.0),
  familiarityBaseline: z.number().min(0.0).max(1.0),
  isNovel: z.boolean(),
  detectedAt: z.string(),
});
export type NoveltyDetectionRecord = z.infer<typeof NoveltyDetectionRecordSchema>;

export const KnowledgeGapRecordSchema = z.object({
  id: z.string(),
  domain: z.string().min(1),
  topic: z.string().min(1),
  gapDescription: z.string().min(1),
  epistemicUncertainty: z.number().min(0.0).max(1.0),
  importanceScore: z.number().min(0.0).max(1.0),
  identifiedAt: z.string(),
});
export type KnowledgeGapRecord = z.infer<typeof KnowledgeGapRecordSchema>;

export const ExploratoryQuestionSchema = z.object({
  id: z.string(),
  knowledgeGapId: z.string(),
  domain: z.string().min(1),
  question: z.string().min(1),
  hypotheses: z.array(z.string()).default([]),
  formulatedAt: z.string(),
});
export type ExploratoryQuestion = z.infer<typeof ExploratoryQuestionSchema>;

export const InvestigationStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  action: z.string().min(1),
  finding: z.string().min(1),
});
export type InvestigationStep = z.infer<typeof InvestigationStepSchema>;

export const IndependentInvestigationRecordSchema = z.object({
  id: z.string(),
  questionId: z.string(),
  domain: z.string().min(1),
  investigationTitle: z.string().min(1),
  stepsExecuted: z.array(InvestigationStepSchema),
  synthesisSummary: z.string().min(1),
  isAutonomous: z.literal(true),
  initiatedBy: z.literal('arle_autonomous'),
  status: z.enum(['in_progress', 'completed', 'yielded_new_questions']),
  timestamp: z.string(),
});
export type IndependentInvestigationRecord = z.infer<
  typeof IndependentInvestigationRecordSchema
>;

export const DiscoveredInterestSchema = z.object({
  id: z.string(),
  domain: z.string().min(1),
  topic: z.string().min(1),
  maturity: InterestMaturityLevelSchema,
  curiosityIntensity: z.number().min(0.0).max(1.0),
  investigationCount: z.number().int().nonnegative(),
  isUserAssigned: z.literal(false), // Acceptance invariant: must not be explicitly assigned by user
  discoveredRationale: z.string().min(1),
  keyFindings: z.array(z.string()).default([]),
  firstDiscoveredAt: z.string(),
  lastExploredAt: z.string(),
});
export type DiscoveredInterest = z.infer<typeof DiscoveredInterestSchema>;
