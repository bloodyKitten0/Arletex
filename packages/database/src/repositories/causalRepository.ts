import Database from 'better-sqlite3';
import { CausalGraphModel, CausalIntervention } from '@arletex/contracts';
import { DatabaseError, ICausalRepository } from '@arletex/core';

export class SqliteCausalRepository implements ICausalRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  // ==========================================
  // Causal Graph Models
  // ==========================================

  public saveGraph(graph: CausalGraphModel): void {
    try {
      this.db
        .prepare(
          `INSERT INTO causal_graph_models (
            id, domain, nodes, links, updated_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            domain = excluded.domain,
            nodes = excluded.nodes,
            links = excluded.links,
            updated_at = excluded.updated_at`,
        )
        .run(
          graph.id,
          graph.domain,
          JSON.stringify(graph.nodes),
          JSON.stringify(graph.links),
          graph.updatedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save causal graph ${graph.id}: ${err.message}`, err);
    }
  }

  public getGraphById(id: string): CausalGraphModel | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM causal_graph_models WHERE id = ?')
        .get(id) as any;
      if (!row) return null;
      return this.mapRowToGraph(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get causal graph ${id}: ${err.message}`, err);
    }
  }

  public getGraphByDomain(domain: string): CausalGraphModel | null {
    try {
      const row = this.db
        .prepare('SELECT * FROM causal_graph_models WHERE domain = ? ORDER BY updated_at DESC LIMIT 1')
        .get(domain) as any;
      if (!row) return null;
      return this.mapRowToGraph(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get causal graph by domain ${domain}: ${err.message}`, err);
    }
  }

  public listGraphs(): CausalGraphModel[] {
    try {
      const rows = this.db
        .prepare('SELECT * FROM causal_graph_models ORDER BY updated_at DESC')
        .all() as any[];
      return rows.map((r) => this.mapRowToGraph(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list causal graphs: ${err.message}`, err);
    }
  }

  public deleteGraph(id: string): void {
    try {
      this.db.prepare('DELETE FROM causal_graph_models WHERE id = ?').run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete causal graph ${id}: ${err.message}`, err);
    }
  }

  // ==========================================
  // Causal Interventions
  // ==========================================

  public recordIntervention(intervention: CausalIntervention): void {
    try {
      this.db
        .prepare(
          `INSERT INTO causal_interventions (
            id, graph_id, target_node_id, intervention_value, observed_effect_node_id,
            observed_effect_value, did_effect_change, inferred_causal_link, notes, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            graph_id = excluded.graph_id,
            target_node_id = excluded.target_node_id,
            intervention_value = excluded.intervention_value,
            observed_effect_node_id = excluded.observed_effect_node_id,
            observed_effect_value = excluded.observed_effect_value,
            did_effect_change = excluded.did_effect_change,
            inferred_causal_link = excluded.inferred_causal_link,
            notes = excluded.notes,
            timestamp = excluded.timestamp`,
        )
        .run(
          intervention.id,
          intervention.graphId,
          intervention.targetNodeId,
          JSON.stringify(intervention.interventionValue),
          intervention.observedEffectNodeId,
          JSON.stringify(intervention.observedEffectValue),
          intervention.didEffectChange ? 1 : 0,
          intervention.inferredCausalLink ? 1 : 0,
          intervention.notes,
          intervention.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to record causal intervention ${intervention.id}: ${err.message}`, err);
    }
  }

  public listInterventions(graphId?: string): CausalIntervention[] {
    try {
      let query = 'SELECT * FROM causal_interventions';
      const params: any[] = [];
      if (graphId) {
        query += ' WHERE graph_id = ?';
        params.push(graphId);
      }
      query += ' ORDER BY timestamp DESC';
      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapRowToIntervention(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list causal interventions: ${err.message}`, err);
    }
  }

  // ==========================================
  // Helper Mappers
  // ==========================================

  private mapRowToGraph(row: any): CausalGraphModel {
    return {
      id: row.id,
      domain: row.domain,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : (row.nodes ?? []),
      links: typeof row.links === 'string' ? JSON.parse(row.links) : (row.links ?? []),
      updatedAt: row.updated_at,
    };
  }

  private mapRowToIntervention(row: any): CausalIntervention {
    return {
      id: row.id,
      graphId: row.graph_id,
      targetNodeId: row.target_node_id,
      interventionValue: typeof row.intervention_value === 'string' ? JSON.parse(row.intervention_value) : row.intervention_value,
      observedEffectNodeId: row.observed_effect_node_id,
      observedEffectValue: typeof row.observed_effect_value === 'string' ? JSON.parse(row.observed_effect_value) : row.observed_effect_value,
      didEffectChange: row.did_effect_change === 1 || row.did_effect_change === true,
      inferredCausalLink: row.inferred_causal_link === 1 || row.inferred_causal_link === true,
      notes: row.notes ?? '',
      timestamp: row.timestamp,
    };
  }
}
