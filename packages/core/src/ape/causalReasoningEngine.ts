import crypto from 'node:crypto';
import {
  CausalGraphModel,
  CausalInferenceResult,
  CausalIntervention,
  CausalLink,
  CausalNode,
  CausalRelationType,
  CausalSummary,
  assertCausalIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ICausalRepository } from './interfaces.js';

export interface CausalReasoningEngineOptions {
  repository: ICausalRepository;
  logger?: ILogger;
}

export class CausalReasoningEngine {
  private readonly repo: ICausalRepository;
  private readonly logger: ILogger;

  constructor(options: CausalReasoningEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('CausalReasoningEngine');
  }

  // ==========================================
  // 1. Causal Graph Management
  // ==========================================

  public createOrUpdateGraph(domain: string, nodes: CausalNode[], links: CausalLink[]): CausalGraphModel {
    // Validate negative invariants on every causal link
    for (const link of links) {
      assertCausalIntegrity(link);
    }

    const existing = this.repo.getGraphByDomain(domain);
    const graphId = existing ? existing.id : crypto.randomUUID();

    const graph: CausalGraphModel = {
      id: graphId,
      domain: domain.trim(),
      nodes,
      links,
      updatedAt: new Date().toISOString(),
    };

    this.repo.saveGraph(graph);
    this.logger.info(`Saved causal graph [${domain}] with ${nodes.length} nodes and ${links.length} links.`);
    return graph;
  }

  // ==========================================
  // 2. Cause-and-Effect Inference
  // ==========================================

  public inferCauses(graphId: string, effectNodeId: string): CausalInferenceResult {
    const graph = this.repo.getGraphById(graphId);
    if (!graph) {
      throw new Error(`Causal graph not found: ${graphId}`);
    }

    const effectNode = graph.nodes.find((n) => n.id === effectNodeId);
    const targetEffectName = effectNode ? effectNode.name : effectNodeId;

    const incomingLinks = graph.links.filter((l) => l.targetNodeId === effectNodeId);
    const plausibleCauses: CausalInferenceResult['plausibleCauses'] = [];
    const alternativeExplanations: string[] = [];

    let totalConfidence = 0;
    let unverifiedCount = 0;

    for (const link of incomingLinks) {
      const sourceNode = graph.nodes.find((n) => n.id === link.sourceNodeId);
      const sourceName = sourceNode ? sourceNode.name : link.sourceNodeId;

      plausibleCauses.push({
        nodeId: link.sourceNodeId,
        name: sourceName,
        relationType: link.relationType,
        strength: link.strength,
        confidence: link.confidence,
        isInterventionVerified: link.isInterventionVerified,
      });

      totalConfidence += link.confidence;
      if (!link.isInterventionVerified) {
        unverifiedCount++;
      }

      if (link.confoundingFactors.length > 0) {
        alternativeExplanations.push(
          `Candidate cause '${sourceName}' has potential confounders: ${link.confoundingFactors.join(', ')}`,
        );
      }
    }

    const avgConfidence = incomingLinks.length > 0 ? totalConfidence / incomingLinks.length : 0.5;
    // Uncertainty elevated if causes lack interventional verification
    const unverifiedPenalty = incomingLinks.length > 0 ? (unverifiedCount / incomingLinks.length) * 0.25 : 0.3;
    const uncertaintyLevel = Math.min(1.0, Math.max(0.05, 1.0 - avgConfidence + unverifiedPenalty));

    const correlationVsCausationNotes = unverifiedCount > 0
      ? `Notice: ${unverifiedCount} of ${incomingLinks.length} causal links have not been empirically verified via intervention. Statistical association does not guarantee direct causal mechanism.`
      : 'All primary upstream causal pathways verified via controlled interventional testing.';

    return {
      targetEffectId: effectNodeId,
      targetEffectName,
      plausibleCauses,
      alternativeExplanations,
      correlationVsCausationNotes,
      uncertaintyLevel: Math.round(uncertaintyLevel * 1000) / 1000,
    };
  }

  // ==========================================
  // 3. Interventional Reasoning (Do-Calculus)
  // ==========================================

  public testIntervention(
    graphId: string,
    targetNodeId: string,
    interventionValue: unknown,
    effectNodeId: string,
    observedValue: unknown,
    baselineValue: unknown,
  ): CausalIntervention {
    const graph = this.repo.getGraphById(graphId);
    if (!graph) {
      throw new Error(`Causal graph not found: ${graphId}`);
    }

    const didEffectChange = JSON.stringify(observedValue) !== JSON.stringify(baselineValue);
    const inferredCausalLink = didEffectChange;

    const notes = didEffectChange
      ? `Intervention do(${targetNodeId}=${JSON.stringify(interventionValue)}) changed effect ${effectNodeId} from ${JSON.stringify(baselineValue)} to ${JSON.stringify(observedValue)}. Causal efficacy empirically verified.`
      : `Intervention do(${targetNodeId}=${JSON.stringify(interventionValue)}) caused no change in ${effectNodeId} (remained ${JSON.stringify(baselineValue)}). Direct causal link refuted or blocked.`;

    const intervention: CausalIntervention = {
      id: crypto.randomUUID(),
      graphId,
      targetNodeId,
      interventionValue,
      observedEffectNodeId: effectNodeId,
      observedEffectValue: observedValue,
      didEffectChange,
      inferredCausalLink,
      notes,
      timestamp: new Date().toISOString(),
    };

    this.repo.recordIntervention(intervention);

    // Update graph link verification state
    const linkIndex = graph.links.findIndex(
      (l) => l.sourceNodeId === targetNodeId && l.targetNodeId === effectNodeId,
    );
    if (linkIndex >= 0) {
      const link = graph.links[linkIndex]!;
      if (didEffectChange) {
        link.isInterventionVerified = true;
        link.confidence = Math.min(1.0, Math.max(link.confidence, 0.90));
      } else {
        link.relationType = 'spurious_correlation';
        link.confidence = 0.85; // High confidence that it is NOT a direct cause!
        link.strength = 0.0;
      }
      graph.updatedAt = new Date().toISOString();
      this.repo.saveGraph(graph);
    }

    this.logger.info(`Executed intervention on ${targetNodeId} -> ${effectNodeId} (didChange: ${didEffectChange})`);
    return intervention;
  }

  // ==========================================
  // 4. Correlation vs Causation Distinction
  // ==========================================

  public distinguishCorrelationFromCausation(
    nodeAId: string,
    nodeBId: string,
    correlationCoefficient: number,
    potentialConfounders: string[] = [],
  ): {
    isDirectCausationPlausible: boolean;
    relationType: CausalRelationType;
    rationale: string;
    uncertainty: number;
  } {
    const absCorr = Math.abs(correlationCoefficient);

    if (absCorr < 0.25) {
      return {
        isDirectCausationPlausible: false,
        relationType: 'spurious_correlation',
        rationale: `Statistical correlation between '${nodeAId}' and '${nodeBId}' is negligible (r=${correlationCoefficient.toFixed(2)}).`,
        uncertainty: 0.15,
      };
    }

    if (potentialConfounders.length > 0) {
      return {
        isDirectCausationPlausible: false,
        relationType: 'common_cause_confounder',
        rationale: `High correlation (r=${correlationCoefficient.toFixed(2)}) is likely confounded by third variables: ${potentialConfounders.join(', ')}. Direct causation cannot be inferred without controlling for confounders.`,
        uncertainty: 0.70,
      };
    }

    return {
      isDirectCausationPlausible: true,
      relationType: 'contributing_factor',
      rationale: `Observed strong correlation (r=${correlationCoefficient.toFixed(2)}) without immediate known confounders. Plausible contributing factor, but requires interventional testing (do-calculus) to confirm direct causation.`,
      uncertainty: 0.35,
    };
  }

  // ==========================================
  // 5. Causal Model Updating & Belief Revision
  // ==========================================

  public reviseCausalBelief(
    graphId: string,
    sourceNodeId: string,
    targetNodeId: string,
    evidence: {
      refutedByIntervention?: boolean;
      alternativeCauseDiscovered?: string;
      newStrength?: number;
    },
  ): CausalGraphModel {
    const graph = this.repo.getGraphById(graphId);
    if (!graph) {
      throw new Error(`Causal graph not found: ${graphId}`);
    }

    const link = graph.links.find((l) => l.sourceNodeId === sourceNodeId && l.targetNodeId === targetNodeId);
    if (!link) {
      throw new Error(`Causal link not found between '${sourceNodeId}' and '${targetNodeId}'`);
    }

    if (evidence.refutedByIntervention) {
      link.relationType = 'spurious_correlation';
      link.strength = 0.0;
      link.isInterventionVerified = true;
      link.mechanismDescription = `Refuted by empirical intervention: changing ${sourceNodeId} failed to perturb ${targetNodeId}.`;
    }

    if (evidence.alternativeCauseDiscovered) {
      if (!link.confoundingFactors.includes(evidence.alternativeCauseDiscovered)) {
        link.confoundingFactors.push(evidence.alternativeCauseDiscovered);
      }
      if (link.relationType === 'direct_cause') {
        link.relationType = 'contributing_factor';
      }
      link.confidence = Math.max(0.3, link.confidence - 0.2);
    }

    if (evidence.newStrength !== undefined) {
      link.strength = Math.max(-1.0, Math.min(1.0, evidence.newStrength));
    }

    assertCausalIntegrity(link);
    graph.updatedAt = new Date().toISOString();
    this.repo.saveGraph(graph);

    this.logger.info(`Revised causal belief for link [${sourceNodeId} -> ${targetNodeId}]: new type=${link.relationType}`);
    return graph;
  }

  // ==========================================
  // 6. Causal Summary
  // ==========================================

  public getCausalSummary(): CausalSummary {
    const graphs = this.repo.listGraphs();
    const interventions = this.repo.listInterventions();

    let totalNodes = 0;
    let totalLinks = 0;
    let totalConfidence = 0;
    const relationBreakdown: Record<string, number> = {};

    for (const g of graphs) {
      totalNodes += g.nodes.length;
      totalLinks += g.links.length;
      for (const l of g.links) {
        relationBreakdown[l.relationType] = (relationBreakdown[l.relationType] ?? 0) + 1;
        totalConfidence += l.confidence;
      }
    }

    const avgConfidence = totalLinks > 0 ? totalConfidence / totalLinks : 0.0;
    const verifiedCount = interventions.filter((i) => i.inferredCausalLink).length;

    return {
      totalGraphs: graphs.length,
      totalNodes,
      totalLinks,
      verifiedInterventionsCount: verifiedCount,
      relationBreakdown,
      averageConfidence: Math.round(avgConfidence * 1000) / 1000,
    };
  }
}

// ==========================================
// In-Memory Repository for Engine Unit Tests
// ==========================================

export class InMemoryCausalRepository implements ICausalRepository {
  private graphs: CausalGraphModel[] = [];
  private interventions: CausalIntervention[] = [];

  public saveGraph(graph: CausalGraphModel): void {
    const idx = this.graphs.findIndex((g) => g.id === graph.id);
    if (idx >= 0) {
      this.graphs[idx] = JSON.parse(JSON.stringify(graph));
    } else {
      this.graphs.push(JSON.parse(JSON.stringify(graph)));
    }
  }

  public getGraphById(id: string): CausalGraphModel | null {
    const g = this.graphs.find((x) => x.id === id);
    return g ? JSON.parse(JSON.stringify(g)) : null;
  }

  public getGraphByDomain(domain: string): CausalGraphModel | null {
    const g = this.graphs.find((x) => x.domain.toLowerCase() === domain.toLowerCase());
    return g ? JSON.parse(JSON.stringify(g)) : null;
  }

  public listGraphs(): CausalGraphModel[] {
    return this.graphs.map((g) => JSON.parse(JSON.stringify(g)));
  }

  public deleteGraph(id: string): void {
    this.graphs = this.graphs.filter((g) => g.id !== id);
  }

  public recordIntervention(intervention: CausalIntervention): void {
    const idx = this.interventions.findIndex((i) => i.id === intervention.id);
    if (idx >= 0) {
      this.interventions[idx] = JSON.parse(JSON.stringify(intervention));
    } else {
      this.interventions.push(JSON.parse(JSON.stringify(intervention)));
    }
  }

  public listInterventions(graphId?: string): CausalIntervention[] {
    let result = [...this.interventions];
    if (graphId) {
      result = result.filter((i) => i.graphId === graphId);
    }
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return result.map((i) => JSON.parse(JSON.stringify(i)));
  }
}
