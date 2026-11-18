import Database from 'better-sqlite3';
import {
  CausalRelationship,
  EpistemicCertainty,
  EpistemicUnknown,
  UnknownStatus,
  WorldEntity,
  WorldEntityType,
  WorldEnvironmentalChange,
  WorldRelation,
  WorldRelationType,
} from '@arletex/contracts';
import { DatabaseError, IWorldRepository } from '@arletex/core';

export class WorldRepository implements IWorldRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Entities
  // ==========================================

  public getEntityById(id: string): WorldEntity | null {
    try {
      const row = this.db.prepare('SELECT * FROM world_entities WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapEntityRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get world entity by id ${id}: ${err.message}`, err);
    }
  }

  public getEntityByName(name: string): WorldEntity | null {
    try {
      const row = this.db.prepare('SELECT * FROM world_entities WHERE LOWER(name) = LOWER(?)').get(name) as any;
      if (!row) return null;
      return this.mapEntityRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get world entity by name ${name}: ${err.message}`, err);
    }
  }

  public listEntities(filter?: {
    entityType?: WorldEntityType;
    category?: string;
    locationId?: string;
    limit?: number;
  }): WorldEntity[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.entityType) {
        conditions.push('entity_type = ?');
        params.push(filter.entityType);
      }
      if (filter?.category) {
        conditions.push('category = ?');
        params.push(filter.category);
      }
      if (filter?.locationId) {
        conditions.push('location_id = ?');
        params.push(filter.locationId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = filter?.limit ? `LIMIT ${Number(filter.limit)}` : '';

      const rows = this.db
        .prepare(`SELECT * FROM world_entities ${whereClause} ORDER BY name ASC ${limitClause}`)
        .all(...params) as any[];

      return rows.map((r) => this.mapEntityRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list world entities: ${err.message}`, err);
    }
  }

  public saveEntity(entity: WorldEntity): void {
    try {
      this.db
        .prepare(
          `INSERT INTO world_entities (
            id, name, category, entity_type, properties, location_id,
            certainty, confidence, source_provenance, last_observed_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            entity_type = excluded.entity_type,
            properties = excluded.properties,
            location_id = excluded.location_id,
            certainty = excluded.certainty,
            confidence = excluded.confidence,
            source_provenance = excluded.source_provenance,
            last_observed_at = excluded.last_observed_at,
            updated_at = excluded.updated_at`,
        )
        .run(
          entity.id,
          entity.name,
          entity.category,
          entity.entityType,
          JSON.stringify(entity.properties || {}),
          entity.locationId || null,
          entity.certainty,
          entity.confidence,
          entity.sourceProvenance,
          entity.lastObservedAt,
          entity.createdAt,
          entity.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save world entity ${entity.id}: ${err.message}`, err);
    }
  }

  public deleteEntity(id: string): boolean {
    try {
      const info = this.db.prepare('DELETE FROM world_entities WHERE id = ?').run(id);
      return info.changes > 0;
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete world entity ${id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Relations
  // ==========================================

  public getRelationById(id: string): WorldRelation | null {
    try {
      const row = this.db.prepare('SELECT * FROM world_relations WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapRelationRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get world relation by id ${id}: ${err.message}`, err);
    }
  }

  public listRelations(filter?: {
    sourceEntityId?: string;
    targetEntityId?: string;
    relationType?: WorldRelationType;
  }): WorldRelation[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.sourceEntityId) {
        conditions.push('(source_entity_id = ? OR (is_bidirectional = 1 AND target_entity_id = ?))');
        params.push(filter.sourceEntityId, filter.sourceEntityId);
      }
      if (filter?.targetEntityId) {
        conditions.push('(target_entity_id = ? OR (is_bidirectional = 1 AND source_entity_id = ?))');
        params.push(filter.targetEntityId, filter.targetEntityId);
      }
      if (filter?.relationType) {
        conditions.push('relation_type = ?');
        params.push(filter.relationType);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = this.db
        .prepare(`SELECT * FROM world_relations ${whereClause} ORDER BY created_at DESC`)
        .all(...params) as any[];

      return rows.map((r) => this.mapRelationRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list world relations: ${err.message}`, err);
    }
  }

  public saveRelation(relation: WorldRelation): void {
    try {
      this.db
        .prepare(
          `INSERT INTO world_relations (
            id, source_entity_id, target_entity_id, relation_type,
            properties, confidence, certainty, is_bidirectional,
            last_observed_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            source_entity_id = excluded.source_entity_id,
            target_entity_id = excluded.target_entity_id,
            relation_type = excluded.relation_type,
            properties = excluded.properties,
            confidence = excluded.confidence,
            certainty = excluded.certainty,
            is_bidirectional = excluded.is_bidirectional,
            last_observed_at = excluded.last_observed_at`,
        )
        .run(
          relation.id,
          relation.sourceEntityId,
          relation.targetEntityId,
          relation.relationType,
          JSON.stringify(relation.properties || {}),
          relation.confidence,
          relation.certainty,
          relation.isBidirectional ? 1 : 0,
          relation.lastObservedAt,
          relation.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save world relation ${relation.id}: ${err.message}`, err);
    }
  }

  public deleteRelation(id: string): boolean {
    try {
      const info = this.db.prepare('DELETE FROM world_relations WHERE id = ?').run(id);
      return info.changes > 0;
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete world relation ${id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Environmental Changes
  // ==========================================

  public recordEnvironmentalChange(change: WorldEnvironmentalChange): void {
    try {
      this.db
        .prepare(
          `INSERT INTO world_environmental_changes (
            id, entity_id, change_type, previous_state, new_state,
            observed_at, source, description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          change.id,
          change.entityId || null,
          change.changeType,
          change.previousState ? JSON.stringify(change.previousState) : null,
          JSON.stringify(change.newState || {}),
          change.observedAt,
          change.source,
          change.description,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to record environmental change: ${err.message}`, err);
    }
  }

  public listEnvironmentalChanges(filter?: { entityId?: string; limit?: number }): WorldEnvironmentalChange[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.entityId) {
        conditions.push('entity_id = ?');
        params.push(filter.entityId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitClause = filter?.limit ? `LIMIT ${Number(filter.limit)}` : 'LIMIT 100';

      const rows = this.db
        .prepare(`SELECT * FROM world_environmental_changes ${whereClause} ORDER BY observed_at DESC ${limitClause}`)
        .all(...params) as any[];

      return rows.map((r) => ({
        id: r.id,
        entityId: r.entity_id || undefined,
        changeType: r.change_type,
        previousState: r.previous_state ? JSON.parse(r.previous_state) : undefined,
        newState: r.new_state ? JSON.parse(r.new_state) : {},
        observedAt: r.observed_at,
        source: r.source,
        description: r.description,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list environmental changes: ${err.message}`, err);
    }
  }

  // ==========================================
  // Causal Relationships
  // ==========================================

  public saveCausalRelationship(relationship: CausalRelationship): void {
    try {
      this.db
        .prepare(
          `INSERT INTO world_causal_relationships (
            id, cause_entity_id, effect_entity_id, condition,
            mechanism, empirical_reliability, confidence, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            cause_entity_id = excluded.cause_entity_id,
            effect_entity_id = excluded.effect_entity_id,
            condition = excluded.condition,
            mechanism = excluded.mechanism,
            empirical_reliability = excluded.empirical_reliability,
            confidence = excluded.confidence`,
        )
        .run(
          relationship.id,
          relationship.causeEntityId,
          relationship.effectEntityId,
          relationship.condition || null,
          relationship.mechanism,
          relationship.empiricalReliability,
          relationship.confidence,
          relationship.createdAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save causal relationship: ${err.message}`, err);
    }
  }

  public listCausalRelationships(filter?: {
    causeEntityId?: string;
    effectEntityId?: string;
  }): CausalRelationship[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.causeEntityId) {
        conditions.push('cause_entity_id = ?');
        params.push(filter.causeEntityId);
      }
      if (filter?.effectEntityId) {
        conditions.push('effect_entity_id = ?');
        params.push(filter.effectEntityId);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = this.db
        .prepare(`SELECT * FROM world_causal_relationships ${whereClause} ORDER BY created_at DESC`)
        .all(...params) as any[];

      return rows.map((r) => ({
        id: r.id,
        causeEntityId: r.cause_entity_id,
        effectEntityId: r.effect_entity_id,
        condition: r.condition || undefined,
        mechanism: r.mechanism,
        empiricalReliability: r.empirical_reliability,
        confidence: r.confidence,
        createdAt: r.created_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list causal relationships: ${err.message}`, err);
    }
  }

  // ==========================================
  // Epistemic Unknowns
  // ==========================================

  public getUnknownById(id: string): EpistemicUnknown | null {
    try {
      const row = this.db.prepare('SELECT * FROM world_epistemic_unknowns WHERE id = ?').get(id) as any;
      if (!row) return null;
      return this.mapUnknownRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get epistemic unknown by id ${id}: ${err.message}`, err);
    }
  }

  public listUnknowns(filter?: { status?: UnknownStatus; domain?: string }): EpistemicUnknown[] {
    try {
      const conditions: string[] = [];
      const params: any[] = [];

      if (filter?.status) {
        conditions.push('status = ?');
        params.push(filter.status);
      }
      if (filter?.domain) {
        conditions.push('domain = ?');
        params.push(filter.domain);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const rows = this.db
        .prepare(`SELECT * FROM world_epistemic_unknowns ${whereClause} ORDER BY priority DESC, created_at DESC`)
        .all(...params) as any[];

      return rows.map((r) => this.mapUnknownRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list epistemic unknowns: ${err.message}`, err);
    }
  }

  public saveUnknown(unknown: EpistemicUnknown): void {
    try {
      this.db
        .prepare(
          `INSERT INTO world_epistemic_unknowns (
            id, topic, question, domain, priority, status,
            resolution_evidence, created_at, resolved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            topic = excluded.topic,
            question = excluded.question,
            domain = excluded.domain,
            priority = excluded.priority,
            status = excluded.status,
            resolution_evidence = excluded.resolution_evidence,
            resolved_at = excluded.resolved_at`,
        )
        .run(
          unknown.id,
          unknown.topic,
          unknown.question,
          unknown.domain,
          unknown.priority,
          unknown.status,
          unknown.resolutionEvidence || null,
          unknown.createdAt,
          unknown.resolvedAt || null,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save epistemic unknown ${unknown.id}: ${err.message}`, err);
    }
  }

  public deleteUnknown(id: string): boolean {
    try {
      const info = this.db.prepare('DELETE FROM world_epistemic_unknowns WHERE id = ?').run(id);
      return info.changes > 0;
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete epistemic unknown ${id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Row Mappers
  // ==========================================

  private mapEntityRow(r: any): WorldEntity {
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      entityType: r.entity_type as WorldEntityType,
      properties: r.properties ? JSON.parse(r.properties) : {},
      locationId: r.location_id || undefined,
      certainty: r.certainty as EpistemicCertainty,
      confidence: r.confidence,
      sourceProvenance: r.source_provenance,
      lastObservedAt: r.last_observed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapRelationRow(r: any): WorldRelation {
    return {
      id: r.id,
      sourceEntityId: r.source_entity_id,
      targetEntityId: r.target_entity_id,
      relationType: r.relation_type as WorldRelationType,
      properties: r.properties ? JSON.parse(r.properties) : {},
      confidence: r.confidence,
      certainty: r.certainty as EpistemicCertainty,
      isBidirectional: r.is_bidirectional === 1,
      lastObservedAt: r.last_observed_at,
      createdAt: r.created_at,
    };
  }

  private mapUnknownRow(r: any): EpistemicUnknown {
    return {
      id: r.id,
      topic: r.topic,
      question: r.question,
      domain: r.domain,
      priority: r.priority,
      status: r.status as UnknownStatus,
      resolutionEvidence: r.resolution_evidence || undefined,
      createdAt: r.created_at,
      resolvedAt: r.resolved_at || undefined,
    };
  }
}
