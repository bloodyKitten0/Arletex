import { z } from 'zod';

// ==========================================
// Milestone 05: World Model Contracts
// ==========================================

export const WorldEntityTypeSchema = z.enum([
  'person',
  'agent',
  'system',
  'object',
  'location',
  'digital_artifact',
  'service',
]);
export type WorldEntityType = z.infer<typeof WorldEntityTypeSchema>;

export const WorldRelationTypeSchema = z.enum([
  'located_at',
  'contains',
  'owns',
  'controls',
  'interacts_with',
  'depends_on',
  'created_by',
  'partner_of',
  'executes_on',
  'communicates_with',
  'causes',
  'associated_with',
]);
export type WorldRelationType = z.infer<typeof WorldRelationTypeSchema>;

export const EpistemicCertaintySchema = z.enum([
  'verified_fact',
  'empirical_observation',
  'inferred_hypothesis',
  'unverified_claim',
  'stale',
]);
export type EpistemicCertainty = z.infer<typeof EpistemicCertaintySchema>;

export const WorldEntitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: z.string().default('general'),
  entityType: WorldEntityTypeSchema,
  properties: z.record(z.unknown()).default({}),
  locationId: z.string().optional(),
  certainty: EpistemicCertaintySchema.default('empirical_observation'),
  confidence: z.number().min(0.0).max(1.0).default(0.8),
  sourceProvenance: z.string().default('direct_observation'),
  lastObservedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorldEntity = z.infer<typeof WorldEntitySchema>;

export const CreateWorldEntityInputSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional().default('general'),
  entityType: WorldEntityTypeSchema,
  properties: z.record(z.unknown()).optional().default({}),
  locationId: z.string().optional(),
  certainty: EpistemicCertaintySchema.optional().default('empirical_observation'),
  confidence: z.number().min(0.0).max(1.0).optional().default(0.8),
  sourceProvenance: z.string().optional().default('direct_observation'),
});
export type CreateWorldEntityInput = z.input<typeof CreateWorldEntityInputSchema>;

export const WorldRelationSchema = z.object({
  id: z.string().uuid(),
  sourceEntityId: z.string(),
  targetEntityId: z.string(),
  relationType: WorldRelationTypeSchema,
  properties: z.record(z.unknown()).default({}),
  confidence: z.number().min(0.0).max(1.0).default(0.8),
  certainty: EpistemicCertaintySchema.default('empirical_observation'),
  isBidirectional: z.boolean().default(false),
  lastObservedAt: z.string(),
  createdAt: z.string(),
});
export type WorldRelation = z.infer<typeof WorldRelationSchema>;

export const CreateWorldRelationInputSchema = z.object({
  sourceEntityId: z.string(),
  targetEntityId: z.string(),
  relationType: WorldRelationTypeSchema,
  properties: z.record(z.unknown()).optional().default({}),
  confidence: z.number().min(0.0).max(1.0).optional().default(0.8),
  certainty: EpistemicCertaintySchema.optional().default('empirical_observation'),
  isBidirectional: z.boolean().optional().default(false),
});
export type CreateWorldRelationInput = z.input<typeof CreateWorldRelationInputSchema>;

export const WorldEnvironmentalChangeSchema = z.object({
  id: z.string().uuid(),
  entityId: z.string().optional(),
  changeType: z.string().min(1), // e.g., 'state_mutation', 'file_change', 'process_start', 'device_connect'
  previousState: z.record(z.unknown()).optional(),
  newState: z.record(z.unknown()).default({}),
  observedAt: z.string(),
  source: z.string().default('environmental_telemetry'),
  description: z.string().min(1),
});
export type WorldEnvironmentalChange = z.infer<typeof WorldEnvironmentalChangeSchema>;

export const RecordEnvironmentalChangeInputSchema = z.object({
  entityId: z.string().optional(),
  changeType: z.string().min(1),
  previousState: z.record(z.unknown()).optional(),
  newState: z.record(z.unknown()).optional().default({}),
  source: z.string().optional().default('environmental_telemetry'),
  description: z.string().min(1),
});
export type RecordEnvironmentalChangeInput = z.input<typeof RecordEnvironmentalChangeInputSchema>;

export const CausalRelationshipSchema = z.object({
  id: z.string().uuid(),
  causeEntityId: z.string(),
  effectEntityId: z.string(),
  condition: z.string().optional(),
  mechanism: z.string().min(1),
  empiricalReliability: z.number().min(0.0).max(1.0).default(0.9),
  confidence: z.number().min(0.0).max(1.0).default(0.85),
  createdAt: z.string(),
});
export type CausalRelationship = z.infer<typeof CausalRelationshipSchema>;

export const CreateCausalRelationshipInputSchema = z.object({
  causeEntityId: z.string(),
  effectEntityId: z.string(),
  condition: z.string().optional(),
  mechanism: z.string().min(1),
  empiricalReliability: z.number().min(0.0).max(1.0).optional().default(0.9),
  confidence: z.number().min(0.0).max(1.0).optional().default(0.85),
});
export type CreateCausalRelationshipInput = z.input<typeof CreateCausalRelationshipInputSchema>;

export const UnknownStatusSchema = z.enum(['open', 'investigating', 'resolved']);
export type UnknownStatus = z.infer<typeof UnknownStatusSchema>;

export const EpistemicUnknownSchema = z.object({
  id: z.string().uuid(),
  topic: z.string().min(1),
  question: z.string().min(1),
  domain: z.string().default('general'),
  priority: z.number().min(0.0).max(1.0).default(0.5),
  status: UnknownStatusSchema.default('open'),
  resolutionEvidence: z.string().optional(),
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
});
export type EpistemicUnknown = z.infer<typeof EpistemicUnknownSchema>;

export const CreateEpistemicUnknownInputSchema = z.object({
  topic: z.string().min(1),
  question: z.string().min(1),
  domain: z.string().optional().default('general'),
  priority: z.number().min(0.0).max(1.0).optional().default(0.5),
});
export type CreateEpistemicUnknownInput = z.input<typeof CreateEpistemicUnknownInputSchema>;

export const ResolveEpistemicUnknownInputSchema = z.object({
  unknownId: z.string().uuid(),
  resolutionEvidence: z.string().min(1),
});
export type ResolveEpistemicUnknownInput = z.infer<typeof ResolveEpistemicUnknownInputSchema>;

export const WorldObservationInputSchema = z.object({
  entityName: z.string().min(1),
  entityType: WorldEntityTypeSchema,
  category: z.string().optional().default('general'),
  properties: z.record(z.unknown()).optional().default({}),
  relationWith: z.string().optional(), // name or id of entity to link to
  relationType: WorldRelationTypeSchema.optional(),
  locationName: z.string().optional(),
  observedState: z.record(z.unknown()).optional(),
  sourceProvenance: z.string().optional().default('direct_observation'),
  confidence: z.number().min(0.0).max(1.0).optional().default(0.85),
  certainty: EpistemicCertaintySchema.optional().default('empirical_observation'),
});
export type WorldObservationInput = z.input<typeof WorldObservationInputSchema>;

export const EpistemicAnalysisSchema = z.object({
  totalKnownFacts: z.number().int(),
  totalEmpiricalObservations: z.number().int(),
  totalHypotheses: z.number().int(),
  totalUnverifiedClaims: z.number().int(),
  openInquiriesCount: z.number().int(),
  resolvedInquiriesCount: z.number().int(),
  knownVsUnknownRatio: z.number(),
  epistemicFrontierDescription: z.string(),
});
export type EpistemicAnalysis = z.infer<typeof EpistemicAnalysisSchema>;

export const WorldModelOverviewSchema = z.object({
  totalEntities: z.number().int(),
  totalRelations: z.number().int(),
  totalLocations: z.number().int(),
  totalObjects: z.number().int(),
  recentChanges: z.array(WorldEnvironmentalChangeSchema),
  epistemicAnalysis: EpistemicAnalysisSchema,
  worldSummary: z.string(),
});
export type WorldModelOverview = z.infer<typeof WorldModelOverviewSchema>;
