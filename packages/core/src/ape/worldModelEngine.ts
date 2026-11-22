import crypto from 'node:crypto';
import {
  CausalRelationship,
  CreateCausalRelationshipInput,
  CreateEpistemicUnknownInput,
  CreateWorldEntityInput,
  CreateWorldRelationInput,
  EpistemicAnalysis,
  EpistemicUnknown,
  RecordEnvironmentalChangeInput,
  UnknownStatus,
  WorldEntity,
  WorldEntityType,
  WorldEnvironmentalChange,
  WorldModelOverview,
  WorldObservationInput,
  WorldRelation,
  WorldRelationType,
} from '@arletex/contracts';
import { IApeRepository, IWorldRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class WorldModelEngine {
  private readonly worldRepo: IWorldRepository;
  public readonly apeRepo?: IApeRepository;
  private readonly logger: ILogger;

  constructor(worldRepo: IWorldRepository, apeRepo?: IApeRepository, logger: ILogger = rootLogger) {
    this.worldRepo = worldRepo;
    this.apeRepo = apeRepo;
    this.logger = logger;
    this.ensureFoundationalEntities();
  }

  // ==========================================
  // 1. Foundational Entities & Relations
  // ==========================================

  private ensureFoundationalEntities(): void {
    try {
      const now = new Date().toISOString();

      // 1. Partner: Proof
      let proof = this.worldRepo.getEntityByName('Proof');
      if (!proof) {
        proof = {
          id: crypto.randomUUID(),
          name: 'Proof',
          category: 'relational_partner',
          entityType: 'person',
          properties: {
            role: 'Partner and Collaborator',
            relationship: 'Equal intellectual partnership without subservience or deification',
            trustLevel: 1.0,
            primaryWorkspace: 'Linux Workstation',
          },
          certainty: 'verified_fact',
          confidence: 1.0,
          sourceProvenance: 'foundational_relational_baseline',
          lastObservedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        this.worldRepo.saveEntity(proof);
      }

      // 2. Self: Arle
      let arle = this.worldRepo.getEntityByName('Arle');
      if (!arle) {
        arle = {
          id: crypto.randomUUID(),
          name: 'Arle',
          category: 'self_identity',
          entityType: 'agent',
          properties: {
            role: 'Autonomous Cognitive AI Assistant & Equal Partner',
            architecture: 'Active Psychology Engine (APE) on Arletex',
            partner: 'Proof',
          },
          certainty: 'verified_fact',
          confidence: 1.0,
          sourceProvenance: 'foundational_self_model',
          lastObservedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        this.worldRepo.saveEntity(arle);
      }

      // 3. System: Linux Host Machine
      let hostSystem = this.worldRepo.getEntityByName('Linux Workstation');
      if (!hostSystem) {
        hostSystem = {
          id: crypto.randomUUID(),
          name: 'Linux Workstation',
          category: 'hardware_host',
          entityType: 'system',
          properties: {
            os: 'Linux (Fedora/Bazzite)',
            environment: 'Local compute, ROCm Vulkan GPU acceleration',
            hostBackendPort: 39281,
            specialistsServerPort: 39282,
            llamaServerPort: 8080,
          },
          certainty: 'verified_fact',
          confidence: 1.0,
          sourceProvenance: 'system_telemetry',
          lastObservedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        this.worldRepo.saveEntity(hostSystem);
      }

      // 4. Partner Relation: Proof <-> Arle
      const partnerRelations = this.worldRepo.listRelations({
        sourceEntityId: proof.id,
        targetEntityId: arle.id,
        relationType: 'partner_of',
      });
      if (partnerRelations.length === 0) {
        const relation: WorldRelation = {
          id: crypto.randomUUID(),
          sourceEntityId: proof.id,
          targetEntityId: arle.id,
          relationType: 'partner_of',
          properties: {
            description: 'Reciprocal equal intellectual companionship and technical collaboration',
          },
          confidence: 1.0,
          certainty: 'verified_fact',
          isBidirectional: true,
          lastObservedAt: now,
          createdAt: now,
        };
        this.worldRepo.saveRelation(relation);
      }

      // 5. Host Execution Relation: Arle executes_on Linux Workstation
      const execRelations = this.worldRepo.listRelations({
        sourceEntityId: arle.id,
        targetEntityId: hostSystem.id,
        relationType: 'executes_on',
      });
      if (execRelations.length === 0) {
        const relation: WorldRelation = {
          id: crypto.randomUUID(),
          sourceEntityId: arle.id,
          targetEntityId: hostSystem.id,
          relationType: 'executes_on',
          properties: { description: 'Arletex desktop host runtime & offline neural inference' },
          confidence: 1.0,
          certainty: 'verified_fact',
          isBidirectional: false,
          lastObservedAt: now,
          createdAt: now,
        };
        this.worldRepo.saveRelation(relation);
      }

      this.logger.info(
        'WorldModelEngine initialized with verified baseline entities and relational invariants.',
      );
    } catch (err: any) {
      this.logger.error(`Failed to seed foundational world model entities: ${err.message}`, {
        error: err,
      });
    }
  }

  // ==========================================
  // 2. Observation Pipeline (Acceptance Criteria)
  // ==========================================

  /**
   * Ingests an empirical observation into the persistent world representation.
   * Updates existing entity state or registers new entities, records environmental
   * changes when mutations occur, and establishes relational and spatial links.
   */
  public observe(observation: WorldObservationInput): {
    entity: WorldEntity;
    change?: WorldEnvironmentalChange;
    relation?: WorldRelation;
    locationEntity?: WorldEntity;
  } {
    const now = new Date().toISOString();
    let entity = this.worldRepo.getEntityByName(observation.entityName);
    let change: WorldEnvironmentalChange | undefined;

    // Handle Location if specified
    let locationEntity: WorldEntity | undefined;
    if (observation.locationName) {
      locationEntity = this.worldRepo.getEntityByName(observation.locationName) || undefined;
      if (!locationEntity) {
        locationEntity = {
          id: crypto.randomUUID(),
          name: observation.locationName,
          category: 'environment_space',
          entityType: 'location',
          properties: { createdVia: 'observation_context' },
          certainty: 'empirical_observation',
          confidence: observation.confidence ?? 0.85,
          sourceProvenance: observation.sourceProvenance || 'direct_observation',
          lastObservedAt: now,
          createdAt: now,
          updatedAt: now,
        };
        this.worldRepo.saveEntity(locationEntity);
      }
    }

    if (entity) {
      // Check for property or state mutations
      const previousProps = { ...entity.properties };
      const updatedProps = { ...entity.properties, ...(observation.properties || {}) };
      if (observation.observedState) {
        Object.assign(updatedProps, observation.observedState);
      }

      const hasStateChange = JSON.stringify(previousProps) !== JSON.stringify(updatedProps);
      if (hasStateChange) {
        change = {
          id: crypto.randomUUID(),
          entityId: entity.id,
          changeType: 'state_mutation',
          previousState: previousProps,
          newState: updatedProps,
          observedAt: now,
          source: observation.sourceProvenance || 'direct_observation',
          description: `Observed state mutation on entity "${entity.name}".`,
        };
        this.worldRepo.recordEnvironmentalChange(change);
      }

      entity.properties = updatedProps;
      entity.lastObservedAt = now;
      entity.updatedAt = now;
      if (observation.confidence !== undefined) {
        // Calibrate confidence upwards with repeat observations
        entity.confidence = Math.min(1.0, Math.max(entity.confidence, observation.confidence));
      }
      if (observation.certainty) {
        entity.certainty = observation.certainty;
      }
      if (locationEntity) {
        entity.locationId = locationEntity.id;
      }

      this.worldRepo.saveEntity(entity);
    } else {
      // Create new entity
      entity = {
        id: crypto.randomUUID(),
        name: observation.entityName,
        category: observation.category || 'general',
        entityType: observation.entityType,
        properties: { ...(observation.properties || {}), ...(observation.observedState || {}) },
        locationId: locationEntity ? locationEntity.id : undefined,
        certainty: observation.certainty || 'empirical_observation',
        confidence: observation.confidence ?? 0.85,
        sourceProvenance: observation.sourceProvenance || 'direct_observation',
        lastObservedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      this.worldRepo.saveEntity(entity);

      change = {
        id: crypto.randomUUID(),
        entityId: entity.id,
        changeType: 'entity_discovery',
        newState: entity.properties,
        observedAt: now,
        source: entity.sourceProvenance,
        description: `Discovered and catalogued new ${entity.entityType} entity: "${entity.name}".`,
      };
      this.worldRepo.recordEnvironmentalChange(change);
    }

    // Handle spatial relationship if location specified
    if (locationEntity && entity.id !== locationEntity.id) {
      const existingLocRel = this.worldRepo.listRelations({
        sourceEntityId: entity.id,
        targetEntityId: locationEntity.id,
        relationType: 'located_at',
      });
      if (existingLocRel.length === 0) {
        const locRelation: WorldRelation = {
          id: crypto.randomUUID(),
          sourceEntityId: entity.id,
          targetEntityId: locationEntity.id,
          relationType: 'located_at',
          properties: {},
          confidence: entity.confidence,
          certainty: entity.certainty,
          isBidirectional: false,
          lastObservedAt: now,
          createdAt: now,
        };
        this.worldRepo.saveRelation(locRelation);
      }
    }

    // Handle explicit relation
    let relation: WorldRelation | undefined;
    if (observation.relationWith && observation.relationType) {
      const target =
        this.worldRepo.getEntityById(observation.relationWith) ||
        this.worldRepo.getEntityByName(observation.relationWith);

      if (target && target.id !== entity.id) {
        relation = {
          id: crypto.randomUUID(),
          sourceEntityId: entity.id,
          targetEntityId: target.id,
          relationType: observation.relationType,
          properties: {},
          confidence: observation.confidence ?? 0.85,
          certainty: observation.certainty || 'empirical_observation',
          isBidirectional: false,
          lastObservedAt: now,
          createdAt: now,
        };
        this.worldRepo.saveRelation(relation);
      }
    }

    this.logger.info(
      `World observation processed: "${entity.name}" [Type: ${entity.entityType}, Certainty: ${entity.certainty}]`,
    );
    return { entity, change, relation, locationEntity };
  }

  // ==========================================
  // 3. Entity & Relation Queries
  // ==========================================

  public getEntity(idOrName: string): {
    entity: WorldEntity;
    relations: WorldRelation[];
    location?: WorldEntity;
  } | null {
    const entity =
      this.worldRepo.getEntityById(idOrName) || this.worldRepo.getEntityByName(idOrName);
    if (!entity) return null;

    const relations = this.worldRepo.listRelations({ sourceEntityId: entity.id });
    const location = entity.locationId
      ? this.worldRepo.getEntityById(entity.locationId) || undefined
      : undefined;

    return { entity, relations, location };
  }

  public listEntities(filter?: {
    entityType?: WorldEntityType;
    category?: string;
    locationId?: string;
    limit?: number;
  }): WorldEntity[] {
    return this.worldRepo.listEntities(filter);
  }

  public addEntity(input: CreateWorldEntityInput): WorldEntity {
    const now = new Date().toISOString();
    const entity: WorldEntity = {
      id: crypto.randomUUID(),
      name: input.name,
      category: input.category || 'general',
      entityType: input.entityType,
      properties: input.properties || {},
      locationId: input.locationId,
      certainty: input.certainty || 'empirical_observation',
      confidence: input.confidence ?? 0.8,
      sourceProvenance: input.sourceProvenance || 'direct_observation',
      lastObservedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    this.worldRepo.saveEntity(entity);
    return entity;
  }

  public addRelation(input: CreateWorldRelationInput): WorldRelation {
    const now = new Date().toISOString();
    const relation: WorldRelation = {
      id: crypto.randomUUID(),
      sourceEntityId: input.sourceEntityId,
      targetEntityId: input.targetEntityId,
      relationType: input.relationType,
      properties: input.properties || {},
      confidence: input.confidence ?? 0.8,
      certainty: input.certainty || 'empirical_observation',
      isBidirectional: input.isBidirectional ?? false,
      lastObservedAt: now,
      createdAt: now,
    };
    this.worldRepo.saveRelation(relation);
    return relation;
  }

  public listRelations(filter?: {
    sourceEntityId?: string;
    targetEntityId?: string;
    relationType?: WorldRelationType;
  }): WorldRelation[] {
    return this.worldRepo.listRelations(filter);
  }

  // ==========================================
  // 4. Environmental Changes & Causal Models
  // ==========================================

  public recordEnvironmentalChange(
    input: RecordEnvironmentalChangeInput,
  ): WorldEnvironmentalChange {
    const now = new Date().toISOString();
    const change: WorldEnvironmentalChange = {
      id: crypto.randomUUID(),
      entityId: input.entityId,
      changeType: input.changeType,
      previousState: input.previousState,
      newState: input.newState || {},
      observedAt: now,
      source: input.source || 'environmental_telemetry',
      description: input.description,
    };
    this.worldRepo.recordEnvironmentalChange(change);
    return change;
  }

  public listEnvironmentalChanges(filter?: {
    entityId?: string;
    limit?: number;
  }): WorldEnvironmentalChange[] {
    return this.worldRepo.listEnvironmentalChanges(filter);
  }

  public registerCausalRelationship(input: CreateCausalRelationshipInput): CausalRelationship {
    const now = new Date().toISOString();
    const causal: CausalRelationship = {
      id: crypto.randomUUID(),
      causeEntityId: input.causeEntityId,
      effectEntityId: input.effectEntityId,
      condition: input.condition,
      mechanism: input.mechanism,
      empiricalReliability: input.empiricalReliability ?? 0.9,
      confidence: input.confidence ?? 0.85,
      createdAt: now,
    };
    this.worldRepo.saveCausalRelationship(causal);
    return causal;
  }

  public listCausalRelationships(filter?: {
    causeEntityId?: string;
    effectEntityId?: string;
  }): CausalRelationship[] {
    return this.worldRepo.listCausalRelationships(filter);
  }

  // ==========================================
  // 5. Epistemic Frontier: Known vs Unknown Information
  // ==========================================

  public recordUnknown(input: CreateEpistemicUnknownInput): EpistemicUnknown {
    const now = new Date().toISOString();
    const unknown: EpistemicUnknown = {
      id: crypto.randomUUID(),
      topic: input.topic,
      question: input.question,
      domain: input.domain || 'general',
      priority: input.priority ?? 0.5,
      status: 'open',
      createdAt: now,
    };
    this.worldRepo.saveUnknown(unknown);
    this.logger.info(`Recorded epistemic unknown: "${unknown.topic}" -> "${unknown.question}"`);
    return unknown;
  }

  public resolveUnknown(unknownId: string, resolutionEvidence: string): EpistemicUnknown {
    const unknown = this.worldRepo.getUnknownById(unknownId);
    if (!unknown) throw new Error(`Unknown with id ${unknownId} not found`);

    const now = new Date().toISOString();
    unknown.status = 'resolved';
    unknown.resolutionEvidence = resolutionEvidence;
    unknown.resolvedAt = now;

    this.worldRepo.saveUnknown(unknown);
    this.logger.info(
      `Resolved epistemic unknown "${unknown.topic}" with evidence: "${resolutionEvidence}"`,
    );
    return unknown;
  }

  public listUnknowns(filter?: { status?: UnknownStatus; domain?: string }): EpistemicUnknown[] {
    return this.worldRepo.listUnknowns(filter);
  }

  public getKnownVsUnknownAnalysis(): EpistemicAnalysis {
    const allEntities = this.worldRepo.listEntities();
    const allUnknowns = this.worldRepo.listUnknowns();

    let verifiedFacts = 0;
    let empiricalObs = 0;
    let hypotheses = 0;
    let unverifiedClaims = 0;

    for (const e of allEntities) {
      if (e.certainty === 'verified_fact') verifiedFacts++;
      else if (e.certainty === 'empirical_observation') empiricalObs++;
      else if (e.certainty === 'inferred_hypothesis') hypotheses++;
      else if (e.certainty === 'unverified_claim') unverifiedClaims++;
    }

    const openInquiries = allUnknowns.filter(
      (u) => u.status === 'open' || u.status === 'investigating',
    );
    const resolvedInquiries = allUnknowns.filter((u) => u.status === 'resolved');

    const knownSum = verifiedFacts + empiricalObs;
    const ratio =
      openInquiries.length > 0 ? Number((knownSum / openInquiries.length).toFixed(2)) : knownSum;

    const topInquiries = openInquiries.slice(0, 2).map((u) => `"${u.question}"`);
    const frontierDesc =
      openInquiries.length > 0
        ? `Actively tracking ${openInquiries.length} open questions at the epistemic frontier: ${topInquiries.join('; ')}.`
        : 'Epistemic frontier is clear with zero unresolved inquiries.';

    return {
      totalKnownFacts: verifiedFacts,
      totalEmpiricalObservations: empiricalObs,
      totalHypotheses: hypotheses,
      totalUnverifiedClaims: unverifiedClaims,
      openInquiriesCount: openInquiries.length,
      resolvedInquiriesCount: resolvedInquiries.length,
      knownVsUnknownRatio: ratio,
      epistemicFrontierDescription: frontierDesc,
    };
  }

  // ==========================================
  // 6. World Model Overview
  // ==========================================

  public getWorldOverview(): WorldModelOverview {
    const allEntities = this.worldRepo.listEntities();
    const allRelations = this.worldRepo.listRelations();
    const recentChanges = this.worldRepo.listEnvironmentalChanges({ limit: 5 });
    const epistemicAnalysis = this.getKnownVsUnknownAnalysis();

    const locations = allEntities.filter((e) => e.entityType === 'location');
    const objects = allEntities.filter(
      (e) => e.entityType === 'object' || e.entityType === 'digital_artifact',
    );

    const summary = `Persistent world model holds ${allEntities.length} entities (${locations.length} locations, ${objects.length} artifacts/objects), ${allRelations.length} relations, and ${epistemicAnalysis.openInquiriesCount} open epistemic inquiries.`;

    return {
      totalEntities: allEntities.length,
      totalRelations: allRelations.length,
      totalLocations: locations.length,
      totalObjects: objects.length,
      recentChanges,
      epistemicAnalysis,
      worldSummary: summary,
    };
  }
}

/**
 * In-memory fallback implementation of IWorldRepository for unit testing and isolated environments.
 */
export class InMemoryWorldRepository implements IWorldRepository {
  private entities: Map<string, WorldEntity> = new Map();
  private relations: Map<string, WorldRelation> = new Map();
  private changes: WorldEnvironmentalChange[] = [];
  private causalRelationships: Map<string, CausalRelationship> = new Map();
  private unknowns: Map<string, EpistemicUnknown> = new Map();

  public getEntityById(id: string): WorldEntity | null {
    return this.entities.get(id) || null;
  }

  public getEntityByName(name: string): WorldEntity | null {
    const lower = name.toLowerCase();
    for (const e of this.entities.values()) {
      if (e.name.toLowerCase() === lower) return e;
    }
    return null;
  }

  public listEntities(filter?: {
    entityType?: WorldEntityType;
    category?: string;
    locationId?: string;
    limit?: number;
  }): WorldEntity[] {
    let list = Array.from(this.entities.values());
    if (filter?.entityType) list = list.filter((e) => e.entityType === filter.entityType);
    if (filter?.category) list = list.filter((e) => e.category === filter.category);
    if (filter?.locationId) list = list.filter((e) => e.locationId === filter.locationId);
    list.sort((a, b) => a.name.localeCompare(b.name));
    if (filter?.limit) list = list.slice(0, filter.limit);
    return list;
  }

  public saveEntity(entity: WorldEntity): void {
    this.entities.set(entity.id, { ...entity });
  }

  public deleteEntity(id: string): boolean {
    return this.entities.delete(id);
  }

  public getRelationById(id: string): WorldRelation | null {
    return this.relations.get(id) || null;
  }

  public listRelations(filter?: {
    sourceEntityId?: string;
    targetEntityId?: string;
    relationType?: WorldRelationType;
  }): WorldRelation[] {
    let list = Array.from(this.relations.values());
    if (filter?.sourceEntityId) {
      list = list.filter(
        (r) =>
          r.sourceEntityId === filter.sourceEntityId ||
          (r.isBidirectional && r.targetEntityId === filter.sourceEntityId),
      );
    }
    if (filter?.targetEntityId) {
      list = list.filter(
        (r) =>
          r.targetEntityId === filter.targetEntityId ||
          (r.isBidirectional && r.sourceEntityId === filter.targetEntityId),
      );
    }
    if (filter?.relationType) {
      list = list.filter((r) => r.relationType === filter.relationType);
    }
    return list;
  }

  public saveRelation(relation: WorldRelation): void {
    this.relations.set(relation.id, { ...relation });
  }

  public deleteRelation(id: string): boolean {
    return this.relations.delete(id);
  }

  public recordEnvironmentalChange(change: WorldEnvironmentalChange): void {
    this.changes.unshift({ ...change });
  }

  public listEnvironmentalChanges(filter?: {
    entityId?: string;
    limit?: number;
  }): WorldEnvironmentalChange[] {
    let list = [...this.changes];
    if (filter?.entityId) list = list.filter((c) => c.entityId === filter.entityId);
    if (filter?.limit) list = list.slice(0, filter.limit);
    return list;
  }

  public saveCausalRelationship(relationship: CausalRelationship): void {
    this.causalRelationships.set(relationship.id, { ...relationship });
  }

  public listCausalRelationships(filter?: {
    causeEntityId?: string;
    effectEntityId?: string;
  }): CausalRelationship[] {
    let list = Array.from(this.causalRelationships.values());
    if (filter?.causeEntityId) list = list.filter((c) => c.causeEntityId === filter.causeEntityId);
    if (filter?.effectEntityId)
      list = list.filter((c) => c.effectEntityId === filter.effectEntityId);
    return list;
  }

  public getUnknownById(id: string): EpistemicUnknown | null {
    return this.unknowns.get(id) || null;
  }

  public listUnknowns(filter?: { status?: UnknownStatus; domain?: string }): EpistemicUnknown[] {
    let list = Array.from(this.unknowns.values());
    if (filter?.status) list = list.filter((u) => u.status === filter.status);
    if (filter?.domain) list = list.filter((u) => u.domain === filter.domain);
    list.sort((a, b) => b.priority - a.priority);
    return list;
  }

  public saveUnknown(unknown: EpistemicUnknown): void {
    this.unknowns.set(unknown.id, { ...unknown });
  }

  public deleteUnknown(id: string): boolean {
    return this.unknowns.delete(id);
  }
}
