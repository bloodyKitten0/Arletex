import Database from 'better-sqlite3';
import {
  CreativeIdea,
  IndependentCreativeProject,
  CreativeInterest,
  CreativeDomain,
} from '@arletex/contracts';
import { DatabaseError, ICreativityRepository } from '@arletex/core';

export class SqliteCreativityRepository implements ICreativityRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveIdea(idea: CreativeIdea): void {
    try {
      this.db
        .prepare(
          `INSERT INTO creative_ideas (
            id, title, domain, core_premise, combined_concepts,
            originality_score, feasibility_score, aesthetic_potential,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            domain = excluded.domain,
            core_premise = excluded.core_premise,
            combined_concepts = excluded.combined_concepts,
            originality_score = excluded.originality_score,
            feasibility_score = excluded.feasibility_score,
            aesthetic_potential = excluded.aesthetic_potential,
            status = excluded.status,
            updated_at = excluded.updated_at`,
        )
        .run(
          idea.id,
          idea.title,
          idea.domain,
          idea.corePremise,
          JSON.stringify(idea.combinedConcepts),
          idea.originalityScore,
          idea.feasibilityScore,
          idea.aestheticPotential,
          idea.status,
          idea.createdAt,
          idea.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save creative idea ${idea.id}: ${err.message}`, err);
    }
  }

  public getIdea(id: string): CreativeIdea | null {
    try {
      const row = this.db.prepare(`SELECT * FROM creative_ideas WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        title: row.title,
        domain: row.domain,
        corePremise: row.core_premise,
        combinedConcepts: JSON.parse(row.combined_concepts),
        originalityScore: row.originality_score,
        feasibilityScore: row.feasibility_score,
        aestheticPotential: row.aesthetic_potential,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get creative idea ${id}: ${err.message}`, err);
    }
  }

  public listIdeas(domain?: CreativeDomain, status?: string): CreativeIdea[] {
    try {
      let query = `SELECT * FROM creative_ideas`;
      const conditions: string[] = [];
      const params: any[] = [];
      if (domain) {
        conditions.push(`domain = ?`);
        params.push(domain);
      }
      if (status) {
        conditions.push(`status = ?`);
        params.push(status);
      }
      if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
      }
      query += ` ORDER BY updated_at DESC`;

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        domain: r.domain,
        corePremise: r.core_premise,
        combinedConcepts: JSON.parse(r.combined_concepts),
        originalityScore: r.originality_score,
        feasibilityScore: r.feasibility_score,
        aestheticPotential: r.aesthetic_potential,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list creative ideas: ${err.message}`, err);
    }
  }

  public saveProject(project: IndependentCreativeProject): void {
    try {
      this.db
        .prepare(
          `INSERT INTO independent_creative_projects (
            id, idea_id, title, domain, objective,
            versions, current_version, self_evaluation_notes,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            objective = excluded.objective,
            versions = excluded.versions,
            current_version = excluded.current_version,
            self_evaluation_notes = excluded.self_evaluation_notes,
            status = excluded.status,
            updated_at = excluded.updated_at`,
        )
        .run(
          project.id,
          project.ideaId,
          project.title,
          project.domain,
          project.objective,
          JSON.stringify(project.versions),
          project.currentVersion,
          project.selfEvaluationNotes,
          project.status,
          project.createdAt,
          project.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save independent creative project ${project.id}: ${err.message}`,
        err,
      );
    }
  }

  public getProject(id: string): IndependentCreativeProject | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM independent_creative_projects WHERE id = ?`)
        .get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        ideaId: row.idea_id,
        title: row.title,
        domain: row.domain,
        objective: row.objective,
        versions: JSON.parse(row.versions),
        currentVersion: row.current_version,
        selfEvaluationNotes: row.self_evaluation_notes,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get creative project ${id}: ${err.message}`, err);
    }
  }

  public listProjects(domain?: CreativeDomain): IndependentCreativeProject[] {
    try {
      const rows = domain
        ? (this.db
            .prepare(
              `SELECT * FROM independent_creative_projects WHERE domain = ? ORDER BY updated_at DESC`,
            )
            .all(domain) as any[])
        : (this.db
            .prepare(`SELECT * FROM independent_creative_projects ORDER BY updated_at DESC`)
            .all() as any[]);

      return rows.map((r) => ({
        id: r.id,
        ideaId: r.idea_id,
        title: r.title,
        domain: r.domain,
        objective: r.objective,
        versions: JSON.parse(r.versions),
        currentVersion: r.current_version,
        selfEvaluationNotes: r.self_evaluation_notes,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list creative projects: ${err.message}`, err);
    }
  }

  public saveInterest(interest: CreativeInterest): void {
    try {
      this.db
        .prepare(
          `INSERT INTO creative_interests (
            id, domain, interest_topic, curiosity_depth,
            exploration_log, last_explored_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            interest_topic = excluded.interest_topic,
            curiosity_depth = excluded.curiosity_depth,
            exploration_log = excluded.exploration_log,
            last_explored_at = excluded.last_explored_at`,
        )
        .run(
          interest.id,
          interest.domain,
          interest.interestTopic,
          interest.curiosityDepth,
          JSON.stringify(interest.explorationLog),
          interest.lastExploredAt,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save creative interest ${interest.id}: ${err.message}`,
        err,
      );
    }
  }

  public getInterest(id: string): CreativeInterest | null {
    try {
      const row = this.db.prepare(`SELECT * FROM creative_interests WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        domain: row.domain,
        interestTopic: row.interest_topic,
        curiosityDepth: row.curiosity_depth,
        explorationLog: JSON.parse(row.exploration_log),
        lastExploredAt: row.last_explored_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get creative interest ${id}: ${err.message}`, err);
    }
  }

  public listInterests(domain?: CreativeDomain): CreativeInterest[] {
    try {
      const rows = domain
        ? (this.db
            .prepare(
              `SELECT * FROM creative_interests WHERE domain = ? ORDER BY curiosity_depth DESC`,
            )
            .all(domain) as any[])
        : (this.db
            .prepare(`SELECT * FROM creative_interests ORDER BY curiosity_depth DESC`)
            .all() as any[]);

      return rows.map((r) => ({
        id: r.id,
        domain: r.domain,
        interestTopic: r.interest_topic,
        curiosityDepth: r.curiosity_depth,
        explorationLog: JSON.parse(r.exploration_log),
        lastExploredAt: r.last_explored_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list creative interests: ${err.message}`, err);
    }
  }
}
