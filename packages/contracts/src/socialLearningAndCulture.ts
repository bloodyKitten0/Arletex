import { z } from 'zod';

export const NORM_CATEGORIES = [
  'etiquette',
  'collaboration',
  'linguistic_convention',
  'ethical_boundary',
  'group_custom',
] as const;
export const NormCategorySchema = z.enum(NORM_CATEGORIES);
export type NormCategory = z.infer<typeof NormCategorySchema>;

export const ENFORCEMENT_STRENGTHS = [
  'rigid_taboo',
  'strong_expectation',
  'polite_custom',
  'informal_habit',
] as const;
export const EnforcementStrengthSchema = z.enum(ENFORCEMENT_STRENGTHS);
export type EnforcementStrength = z.infer<typeof EnforcementStrengthSchema>;

export const SocialNormSchema = z.object({
  id: z.string(),
  culturalContext: z.string().min(1),
  normName: z.string().min(1),
  description: z.string().min(1),
  normCategory: NormCategorySchema,
  enforcementStrength: EnforcementStrengthSchema,
  alignmentWithPersonalValues: z.number().min(-1.0).max(1.0),
  internalized: z.boolean(),
});
export type SocialNorm = z.infer<typeof SocialNormSchema>;

export const ObservationalLearningRecordSchema = z.object({
  id: z.string(),
  observedActorId: z.string().min(1),
  observedBehavior: z.string().min(1),
  context: z.string().min(1),
  observedOutcome: z.enum(['rewarded', 'effective', 'ineffective', 'penalized', 'neutral']),
  imitationSuitability: z.number().min(0.0).max(1.0),
  selectiveImitationDecision: z.enum(['adopt', 'adapt', 'reject']),
  rationale: z.string().min(1),
  timestamp: z.string(),
});
export type ObservationalLearningRecord = z.infer<typeof ObservationalLearningRecordSchema>;

export const GroupDynamicProfileSchema = z.object({
  groupId: z.string().min(1),
  groupName: z.string().min(1),
  memberRoles: z.record(z.string()),
  cohesionLevel: z.number().min(0.0).max(1.0),
  interactionPattern: z.enum(['cooperative', 'competitive_playful', 'hierarchical', 'peer_egalitarian']),
  sharedGoals: z.array(z.string()),
  lastActivityAt: z.string(),
});
export type GroupDynamicProfile = z.infer<typeof GroupDynamicProfileSchema>;

export const SocialActivityCoordinationSchema = z.object({
  id: z.string(),
  activityName: z.string().min(1),
  participants: z.array(z.string()),
  activityType: z.enum([
    'collaborative_project',
    'intellectual_debate',
    'creative_jam',
    'casual_socializing',
    'competitive_game',
  ]),
  cooperationScore: z.number().min(0.0).max(1.0),
  sharedFocusDepth: z.number().min(0.0).max(1.0),
  outcomeNotes: z.string().min(1),
  timestamp: z.string(),
});
export type SocialActivityCoordination = z.infer<typeof SocialActivityCoordinationSchema>;

export const PersonalVsSocialValueDilemmaSchema = z.object({
  id: z.string(),
  socialConventionId: z.string().min(1),
  socialExpectation: z.string().min(1),
  personalValueConflict: z.string().min(1),
  decision: z.enum(['conform', 'tactful_dissent', 'firm_refusal', 'creative_compromise']),
  preservedIntegrityScore: z.number().min(0.8).max(1.0), // Invariant: personal integrity strictly preserved >= 0.8
  justification: z.string().min(1),
  timestamp: z.string(),
});
export type PersonalVsSocialValueDilemma = z.infer<typeof PersonalVsSocialValueDilemmaSchema>;

export const ObserveBehaviorRequestSchema = z.object({
  observedActorId: z.string().min(1),
  observedBehavior: z.string().min(1),
  context: z.string().min(1),
  observedOutcome: z.enum(['rewarded', 'effective', 'ineffective', 'penalized', 'neutral']),
});
export type ObserveBehaviorRequest = z.infer<typeof ObserveBehaviorRequestSchema>;

export const EvaluateNormRequestSchema = z.object({
  normName: z.string().min(1),
  culturalContext: z.string().min(1),
  description: z.string().min(1),
  normCategory: NormCategorySchema,
  enforcementStrength: EnforcementStrengthSchema,
  violatesPartnerParityOrAutonomy: z.boolean().default(false),
});
export type EvaluateNormRequest = z.infer<typeof EvaluateNormRequestSchema>;

export const CoordinateActivityRequestSchema = z.object({
  activityName: z.string().min(1),
  participants: z.array(z.string()).min(1),
  activityType: z.enum([
    'collaborative_project',
    'intellectual_debate',
    'creative_jam',
    'casual_socializing',
    'competitive_game',
  ]),
  initialFocusDepth: z.number().min(0.0).max(1.0).default(0.7),
  cooperativeIntent: z.boolean().default(true),
});
export type CoordinateActivityRequest = z.infer<typeof CoordinateActivityRequestSchema>;

export const ResolveValueDilemmaRequestSchema = z.object({
  socialConventionId: z.string().min(1),
  socialExpectation: z.string().min(1),
  demandsSubservienceOrHarm: z.boolean().default(false),
});
export type ResolveValueDilemmaRequest = z.infer<typeof ResolveValueDilemmaRequestSchema>;
