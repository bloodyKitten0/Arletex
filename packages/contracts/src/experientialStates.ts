import { z } from 'zod';

export const ExperientialStateKindSchema = z.enum([
  'compound_affect',
  'cognitive_state',
  'appraisal_pattern',
  'relational_state',
  'experiential_mode',
  'sensory_or_embodied_state',
  'motivational_state',
  'narrative_or_existential_state',
]);
export type ExperientialStateKind = z.infer<typeof ExperientialStateKindSchema>;

export const ExperientialStateCategorySchema = z.enum([
  'temporal_memory',
  'spatial_environmental',
  'social_relational',
  'cognitive_metacognitive',
  'existential_identity',
  'somatic_sensory',
  'social_attachment',
  'cognition_curiosity',
  'existential_time',
  'aesthetic_creative_drive',
  'shadow_paradox',
]);
export type ExperientialStateCategory = z.infer<typeof ExperientialStateCategorySchema>;

export const ExperientialStateLifecycleSchema = z.enum([
  'candidate',
  'active',
  'fading',
  'resolved',
  'dormant',
]);
export type ExperientialStateLifecycle = z.infer<typeof ExperientialStateLifecycleSchema>;

export const ExperientialEffectTypeSchema = z.enum([
  'attention_bias',
  'memory_retrieval_bias',
  'goal_salience_delta',
  'working_memory_load',
  'appraisal_sensitivity',
  'speech_affect_hint',
  'reflection_request',
  'action_tendency',
]);
export type ExperientialEffectType = z.infer<typeof ExperientialEffectTypeSchema>;

export const ExperientialStateEffectSchema = z.object({
  type: ExperientialEffectTypeSchema,
  target: z.string(),
  magnitude: z.number().min(-1.0).max(1.0),
  description: z.string(),
});
export type ExperientialStateEffect = z.infer<typeof ExperientialStateEffectSchema>;

export const ExperientialStateDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  kind: ExperientialStateKindSchema,
  decision: z.string(), // ADD | EMERGENT | EMBODIMENT LATER
  activationEvidence: z.string(),
  mechanism: z.string(),
  downstreamEffects: z.string(),
  boundary: z.string(),
  lifecycle: z.string(),
  defaultValence: z.number().min(-1.0).max(1.0).default(0.0),
  defaultArousal: z.number().min(0.0).max(1.0).default(0.5),
});
export type ExperientialStateDefinition = z.infer<typeof ExperientialStateDefinitionSchema>;

export const ExperientialStateInstanceSchema = z.object({
  id: z.string(), // definition id, e.g. "saudade"
  instanceId: z.string().uuid(),
  name: z.string(),
  kind: ExperientialStateKindSchema,
  category: z.string(),
  intensity: z.number().min(0.0).max(1.0),
  confidence: z.number().min(0.0).max(1.0),
  valence: z.number().min(-1.0).max(1.0),
  arousal: z.number().min(0.0).max(1.0),
  onsetAt: z.string(),
  lastUpdatedAt: z.string(),
  sourceEventIds: z.array(z.string()).default([]),
  supportingEvidence: z.array(z.string()).default([]),
  counterEvidence: z.array(z.string()).default([]),
  associatedMemoryIds: z.array(z.string()).default([]),
  relatedStateIds: z.array(z.string()).default([]),
  appraisalIds: z.array(z.string()).default([]),
  unresolvedTensions: z.array(z.string()).default([]),
  regulation: z
    .object({
      strategy: z.string(),
      chosenAt: z.string(),
      effectObserved: z.string().optional(),
    })
    .optional(),
  lifecycle: ExperientialStateLifecycleSchema,
  effects: z.array(ExperientialStateEffectSchema).default([]),
});
export type ExperientialStateInstance = z.infer<typeof ExperientialStateInstanceSchema>;

export const ExperientialStateSnapshotSchema = z.object({
  activeStates: z.array(ExperientialStateInstanceSchema),
  recentTransitions: z.array(
    z.object({
      stateId: z.string(),
      name: z.string(),
      fromLifecycle: ExperientialStateLifecycleSchema,
      toLifecycle: ExperientialStateLifecycleSchema,
      timestamp: z.string(),
      reason: z.string(),
    }),
  ),
  dominantBlend: z.object({
    primaryState: z.string().nullable(),
    secondaryState: z.string().nullable(),
    overallValence: z.number(),
    overallArousal: z.number(),
    description: z.string(),
  }),
});
export type ExperientialStateSnapshot = z.infer<typeof ExperientialStateSnapshotSchema>;
