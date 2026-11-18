import { z } from 'zod';

export const LearningChannelSchema = z.enum([
  'direct_experience',
  'observation',
  'instruction',
  'mistake',
  'success',
  'pattern_recognition',
]);
export type LearningChannel = z.infer<typeof LearningChannelSchema>;

export const LearningOutcomeTypeSchema = z.enum([
  'success',
  'failure',
  'partial',
  'neutral',
]);
export type LearningOutcomeType = z.infer<typeof LearningOutcomeTypeSchema>;

export const LearningExperienceSchema = z.object({
  id: z.string().min(1),
  channel: LearningChannelSchema,
  domain: z.string().min(1),
  context: z.string().min(1),
  actionTaken: z.string().min(1),
  outcome: LearningOutcomeTypeSchema,
  outcomeDetails: z.string(),
  rewardScore: z.number().min(-1.0).max(1.0),
  lessonsLearned: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string(),
});
export type LearningExperience = z.infer<typeof LearningExperienceSchema>;

export const BehavioralAdaptationRuleSchema = z.object({
  id: z.string().min(1),
  sourceExperienceIds: z.array(z.string()).min(1, 'Rule must originate from at least one empirical experience'),
  domain: z.string().min(1),
  condition: z.string().min(1),
  recommendedStrategy: z.string().min(1),
  avoidStrategy: z.string().optional(),
  confidence: z.number().min(0.0).max(1.0),
  successRate: z.number().min(0.0).max(1.0),
  sampleCount: z.number().int().min(1),
  isGeneralization: z.boolean().default(false),
  transferDomains: z.array(z.string()).default([]),
  updatedAt: z.string(),
});
export type BehavioralAdaptationRule = z.infer<typeof BehavioralAdaptationRuleSchema>;

export const PatternRecognitionSchema = z.object({
  patternId: z.string().min(1),
  domain: z.string().min(1),
  description: z.string().min(1),
  occurrences: z.number().int().min(1),
  confidence: z.number().min(0.0).max(1.0),
  relatedExperienceIds: z.array(z.string()).default([]),
  implications: z.array(z.string()).default([]),
});
export type PatternRecognition = z.infer<typeof PatternRecognitionSchema>;

export const StrategyRecommendationSchema = z.object({
  context: z.string().min(1),
  domain: z.string().min(1),
  recommendedRules: z.array(BehavioralAdaptationRuleSchema),
  avoidStrategies: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0.0).max(1.0),
  expectedSuccessImprovement: z.number().min(0.0).max(1.0),
});
export type StrategyRecommendation = z.infer<typeof StrategyRecommendationSchema>;

export const LearningExperienceFilterSchema = z.object({
  channel: LearningChannelSchema.optional(),
  domain: z.string().optional(),
  outcome: LearningOutcomeTypeSchema.optional(),
  limit: z.number().int().positive().optional().default(50),
});
export type LearningExperienceFilter = z.input<typeof LearningExperienceFilterSchema>;

export const LearningSummarySchema = z.object({
  totalExperiences: z.number().int().nonnegative(),
  channelCounts: z.record(z.number().int().nonnegative()),
  totalRules: z.number().int().nonnegative(),
  generalizationCount: z.number().int().nonnegative(),
  averageRuleConfidence: z.number().min(0.0).max(1.0),
  averageRuleSuccessRate: z.number().min(0.0).max(1.0),
  dominantDomains: z.array(z.string()),
});
export type LearningSummary = z.infer<typeof LearningSummarySchema>;

/**
 * Validates negative invariants for empirical learning and adaptation:
 * 1. An adaptation rule must never be artificially inserted without empirical experiences.
 * 2. Confidence and success rates must reside within [0.0, 1.0].
 * 3. Sample count must be positive.
 */
export function assertLearningIntegrity(rule: BehavioralAdaptationRule): void {
  if (!rule.sourceExperienceIds || rule.sourceExperienceIds.length === 0) {
    throw new Error('Negative Invariant Violation: Rules cannot be artificially synthesized without empirical source experiences.');
  }
  if (rule.confidence < 0 || rule.confidence > 1) {
    throw new Error(`Invalid confidence value ${rule.confidence}: must be in range [0, 1].`);
  }
  if (rule.successRate < 0 || rule.successRate > 1) {
    throw new Error(`Invalid successRate value ${rule.successRate}: must be in range [0, 1].`);
  }
  if (rule.sampleCount < 1) {
    throw new Error(`Invalid sampleCount ${rule.sampleCount}: must be >= 1.`);
  }
}
