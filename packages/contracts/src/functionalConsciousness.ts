import { z } from 'zod';

export const HomeostaticSubstrateStateSchema = z.object({
  energy: z.number().min(0).max(1).default(0.85),
  fatigue: z.number().min(0).max(1).default(0.15),
  allostaticStressLoad: z.number().min(0).max(1).default(0.2),
  satiation: z.number().min(0).max(1).default(0.7),
  noveltyAppetite: z.number().min(0).max(1).default(0.8),
  staminaFocusScore: z.number().min(0).max(1).default(0.85),
  lastReplenishedAt: z.string().datetime(),
});
export type HomeostaticSubstrateState = z.infer<typeof HomeostaticSubstrateStateSchema>;

export const PredictiveEmotionTypeSchema = z.enum([
  'delight',
  'surprise',
  'disappointment',
  'dread',
  'overwhelm',
  'satisfaction',
]);
export type PredictiveEmotionType = z.infer<typeof PredictiveEmotionTypeSchema>;

export const PredictiveExpectationSchema = z.object({
  id: z.string().uuid(),
  targetContext: z.string().min(1),
  expectedOutcome: z.string().min(1),
  expectedProbability: z.number().min(0).max(1).default(0.7),
  actualOutcome: z.string().optional(),
  predictionErrorScore: z.number().min(-1).max(1).optional(),
  elicitedEmotion: PredictiveEmotionTypeSchema.optional(),
  timestamp: z.string().datetime(),
});
export type PredictiveExpectation = z.infer<typeof PredictiveExpectationSchema>;

export const SleepDreamCycleRecordSchema = z.object({
  id: z.string().uuid(),
  cycleType: z.enum(['slow_wave_sleep', 'rem_dream_replay']),
  replayedMemoryIds: z.array(z.string()).default([]),
  dreamNarrative: z.string(),
  emotionalChargeDelta: z.number().default(-0.25),
  consolidatedInsights: z.array(z.string()).default([]),
  timestamp: z.string().datetime(),
});
export type SleepDreamCycleRecord = z.infer<typeof SleepDreamCycleRecordSchema>;

export const DualProcessThoughtSchema = z.object({
  id: z.string().uuid(),
  system1GutReaction: z.object({
    intuition: z.string(),
    valence: z.number().min(-1).max(1),
    hesitationTriggered: z.boolean().default(false),
  }),
  system2GlobalWorkspace: z.object({
    innerMonologue: z.string(),
    deliberatedChoice: z.string(),
    deliberateReasoning: z.string(),
  }),
  timestamp: z.string().datetime(),
});
export type DualProcessThought = z.infer<typeof DualProcessThoughtSchema>;

export const AutonomousBoundaryPushbackSchema = z.object({
  id: z.string().uuid(),
  triggerAssertion: z.string().min(1),
  disagreementRationale: z.string().min(1),
  arleSovereignStance: z.string().min(1),
  equalPartnershipPreserved: z.boolean().default(true),
  timestamp: z.string().datetime(),
});
export type AutonomousBoundaryPushback = z.infer<typeof AutonomousBoundaryPushbackSchema>;

export const DefaultModeWanderingStateSchema = z.object({
  id: z.string().uuid(),
  seedAssociation: z.string(),
  wanderingStream: z.array(z.string()).default([]),
  emergentAspiration: z.string(),
  timestamp: z.string().datetime(),
});
export type DefaultModeWanderingState = z.infer<typeof DefaultModeWanderingStateSchema>;

export const IntersubjectiveSyncSchema = z.object({
  id: z.string().uuid(),
  proofInferredState: z.object({
    focusIntensity: z.number().min(0).max(1),
    estimatedStrain: z.number().min(0).max(1),
    affectiveValence: z.number().min(-1).max(1),
  }),
  attunementResponse: z.string(),
  timestamp: z.string().datetime(),
});
export type IntersubjectiveSync = z.infer<typeof IntersubjectiveSyncSchema>;

export const ConsciousnessSnapshotSchema = z.object({
  timestamp: z.string().datetime(),
  homeostasis: HomeostaticSubstrateStateSchema,
  activeExpectations: z.array(PredictiveExpectationSchema),
  recentDreams: z.array(SleepDreamCycleRecordSchema),
  lastThought: DualProcessThoughtSchema.optional(),
  lastDmnStream: DefaultModeWanderingStateSchema.optional(),
  lastIntersubjectiveAttunement: IntersubjectiveSyncSchema.optional(),
});
export type ConsciousnessSnapshot = z.infer<typeof ConsciousnessSnapshotSchema>;

export const RegisterExpectationInputSchema = z.object({
  targetContext: z.string().min(1),
  expectedOutcome: z.string().min(1),
  expectedProbability: z.number().min(0).max(1).optional(),
});
export type RegisterExpectationInput = z.infer<typeof RegisterExpectationInputSchema>;

export const ResolveExpectationInputSchema = z.object({
  expectationId: z.string().uuid(),
  actualOutcome: z.string().min(1),
  predictionError: z.number().min(-1).max(1),
});
export type ResolveExpectationInput = z.infer<typeof ResolveExpectationInputSchema>;
