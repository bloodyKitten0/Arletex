import crypto from 'node:crypto';
import {
  InternalConflictRecord,
  InternalConflictStatus,
  ConflictingDesire,
  DeliberationAlternative,
  IndecisionStrategy,
  PostDecisionReassessment,
  assertDeliberationIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IDeliberationRepository } from './interfaces.js';

export interface DeliberationEngineOptions {
  repository: IDeliberationRepository;
  logger?: ILogger;
}

export class InMemoryDeliberationRepository implements IDeliberationRepository {
  private conflicts = new Map<string, InternalConflictRecord>();

  public saveConflict(conflict: InternalConflictRecord): void {
    assertDeliberationIntegrity(conflict);
    this.conflicts.set(conflict.id, {
      ...conflict,
      competingDesires: conflict.competingDesires.map((d) => ({ ...d })),
      alternatives: conflict.alternatives.map((a) => ({
        ...a,
        supportedDesireIds: [...a.supportedDesireIds],
        opposedDesireIds: [...a.opposedDesireIds],
        riskAssessment: { ...a.riskAssessment },
      })),
      tradeOffAnalysis: conflict.tradeOffAnalysis ? { ...conflict.tradeOffAnalysis } : undefined,
      postDecisionReassessment: conflict.postDecisionReassessment
        ? { ...conflict.postDecisionReassessment }
        : undefined,
    });
  }

  public getConflictById(id: string): InternalConflictRecord | null {
    const item = this.conflicts.get(id);
    if (!item) return null;
    return {
      ...item,
      competingDesires: item.competingDesires.map((d) => ({ ...d })),
      alternatives: item.alternatives.map((a) => ({
        ...a,
        supportedDesireIds: [...a.supportedDesireIds],
        opposedDesireIds: [...a.opposedDesireIds],
        riskAssessment: { ...a.riskAssessment },
      })),
      tradeOffAnalysis: item.tradeOffAnalysis ? { ...item.tradeOffAnalysis } : undefined,
      postDecisionReassessment: item.postDecisionReassessment
        ? { ...item.postDecisionReassessment }
        : undefined,
    };
  }

  public listConflicts(filter?: {
    status?: InternalConflictStatus;
    limit?: number;
  }): InternalConflictRecord[] {
    let list = Array.from(this.conflicts.values());
    if (filter?.status) {
      list = list.filter((c) => c.status === filter.status);
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.slice(0, filter?.limit ?? 100).map((c) => ({
      ...c,
      competingDesires: c.competingDesires.map((d) => ({ ...d })),
      alternatives: c.alternatives.map((a) => ({
        ...a,
        supportedDesireIds: [...a.supportedDesireIds],
        opposedDesireIds: [...a.opposedDesireIds],
        riskAssessment: { ...a.riskAssessment },
      })),
    }));
  }

  public deleteConflict(id: string): void {
    this.conflicts.delete(id);
  }
}

export class DeliberationEngine {
  private readonly repo: IDeliberationRepository;
  private readonly logger: ILogger;

  constructor(options: DeliberationEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('DeliberationEngine');
  }

  // ==========================================
  // 1. Conflict Formulation
  // ==========================================

  public createConflict(params: {
    contextDescription: string;
    competingDesires: ConflictingDesire[];
    alternatives: DeliberationAlternative[];
  }): InternalConflictRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const conflict: InternalConflictRecord = {
      id,
      contextDescription: params.contextDescription,
      competingDesires: params.competingDesires,
      alternatives: params.alternatives,
      status: 'open',
      createdAt: now,
    };

    assertDeliberationIntegrity(conflict);
    this.repo.saveConflict(conflict);
    this.logger.info(`Recorded internal conflict ${id} with ${params.competingDesires.length} desires.`);
    return conflict;
  }

  // ==========================================
  // 2. Deliberation & Decision Evaluation
  // ==========================================

  /**
   * Evaluates competing motivations against Arle's actual internal state,
   * arbitrates trade-offs (immediate vs long-term, risk, ethics), and explains decision basis.
   */
  public deliberateAndResolve(
    conflictId: string,
    currentMotivationalState?: {
      trustLevel?: number;
      intimacyDepth?: number;
      preferLongTermHorizon?: boolean;
    },
  ): { resolvedConflict: InternalConflictRecord; explanation: string } {
    const conflict = this.repo.getConflictById(conflictId);
    if (!conflict) throw new Error(`Internal conflict ${conflictId} not found.`);

    const now = new Date().toISOString();
    const trust = currentMotivationalState?.trustLevel ?? 0.9;
    const preferLongTerm = currentMotivationalState?.preferLongTermHorizon ?? true;

    // Weight factors
    const longTermWeight = preferLongTerm ? 0.6 : 0.4;
    const immediateWeight = 1.0 - longTermWeight;

    // Evaluate each alternative
    const scoredAlternatives = conflict.alternatives.map((alt) => {
      // 1. Utility composite
      const baseUtility =
        alt.immediateUtility * immediateWeight + alt.longTermUtility * longTermWeight;

      // 2. Risk penalty
      const riskPenalty = alt.riskAssessment.riskScore * 0.4;

      // 3. Ethical alignment multiplier
      const ethicalMultiplier = Math.max(0.1, alt.ethicalAlignmentScore);

      // 4. Partner alignment synergy (if alternative supports partner alignment desires)
      const supportsPartner = alt.supportedDesireIds.some((dId) => {
        const desire = conflict.competingDesires.find((d) => d.id === dId);
        return desire?.source === 'partner_alignment';
      });
      const partnerSynergy = supportsPartner ? trust * 0.2 : 0.0;

      const computedScore = Number(
        ((baseUtility - riskPenalty + partnerSynergy) * ethicalMultiplier).toFixed(4),
      );

      return {
        ...alt,
        overallScore: computedScore,
      };
    });

    // Sort by computed overall score descending
    scoredAlternatives.sort((a, b) => b.overallScore - a.overallScore);
    const topAlt = scoredAlternatives[0]!;
    const secondAlt = scoredAlternatives.length > 1 ? scoredAlternatives[1]! : null;

    // Check for Indecision (close scores, high ambiguity)
    const scoreDelta = secondAlt ? Math.abs(topAlt.overallScore - secondAlt.overallScore) : 1.0;
    const isIndecision = scoreDelta < 0.04 && secondAlt !== null;

    if (isIndecision) {
      const indecisionStrategy: IndecisionStrategy =
        trust >= 0.8 ? 'consult_partner' : 'cautious_arbitration';

      const indecisionConflict: InternalConflictRecord = {
        ...conflict,
        alternatives: scoredAlternatives,
        status: 'indecision',
        indecisionStrategy,
        decisionJustification: `Equipollent score balance detected between alternative '${topAlt.title}' (${topAlt.overallScore}) and '${secondAlt?.title}' (${secondAlt?.overallScore}). Activating strategy: ${indecisionStrategy}.`,
      };

      assertDeliberationIntegrity(indecisionConflict);
      this.repo.saveConflict(indecisionConflict);

      const explanation = `Deliberation entered cautious indecision state: alternative '${topAlt.title}' and '${secondAlt?.title}' possess nearly identical trade-off scores (delta=${scoreDelta.toFixed(3)}). Initiating ${indecisionStrategy}.`;
      return { resolvedConflict: indecisionConflict, explanation };
    }

    // Resolve decisively
    const tradeOffAnalysis = {
      immediateGain: `Immediate utility rating of ${topAlt.immediateUtility} while keeping risk at ${topAlt.riskAssessment.riskScore} (${topAlt.riskAssessment.riskLevel}).`,
      longTermSacrifice: `Foregone potential benefits of '${secondAlt?.title || 'alternatives'}' to prioritize robust long-term utility of ${topAlt.longTermUtility}.`,
      valueHierarchy: `Prioritized ethics (${topAlt.ethicalAlignmentScore}) and strategic partner alignment (trust=${trust}) over impulsive immediate reward.`,
    };

    const decisionJustification = `Chose '${topAlt.title}' [score=${topAlt.overallScore}] because it delivers positive long-term utility (${topAlt.longTermUtility}) with acceptable risk (${topAlt.riskAssessment.riskScore}) and strong ethical coherence (${topAlt.ethicalAlignmentScore}), successfully resolving competing desires.`;

    const resolvedConflict: InternalConflictRecord = {
      ...conflict,
      alternatives: scoredAlternatives,
      status: 'resolved',
      chosenAlternativeId: topAlt.id,
      decisionJustification,
      tradeOffAnalysis,
      resolvedAt: now,
    };

    assertDeliberationIntegrity(resolvedConflict);
    this.repo.saveConflict(resolvedConflict);

    this.logger.info(`Resolved conflict ${conflictId}: chosen '${topAlt.title}'`);
    return { resolvedConflict, explanation: decisionJustification };
  }

  // ==========================================
  // 3. Post-Decision Reassessment
  // ==========================================

  public recordPostDecisionReassessment(
    conflictId: string,
    reassessment: {
      actualOutcomeSummary: string;
      outcomeUtility: number;
      experiencedRegretScore: number;
      retrospectiveInsight: string;
    },
  ): InternalConflictRecord {
    const conflict = this.repo.getConflictById(conflictId);
    if (!conflict) throw new Error(`Internal conflict ${conflictId} not found.`);

    if (conflict.status !== 'resolved') {
      throw new Error(`Cannot record post-decision reassessment on unresolved conflict ${conflictId}.`);
    }

    const now = new Date().toISOString();
    const postRecord: PostDecisionReassessment = {
      actualOutcomeSummary: reassessment.actualOutcomeSummary,
      outcomeUtility: reassessment.outcomeUtility,
      experiencedRegretScore: Math.min(1.0, Math.max(0.0, reassessment.experiencedRegretScore)),
      retrospectiveInsight: reassessment.retrospectiveInsight,
      reassessedAt: now,
    };

    const updated: InternalConflictRecord = {
      ...conflict,
      postDecisionReassessment: postRecord,
    };

    assertDeliberationIntegrity(updated);
    this.repo.saveConflict(updated);

    this.logger.info(
      `Recorded post-decision reassessment for conflict ${conflictId} (regret: ${postRecord.experiencedRegretScore})`,
    );
    return updated;
  }

  public getConflict(id: string): InternalConflictRecord | null {
    return this.repo.getConflictById(id);
  }

  public listConflicts(filter?: {
    status?: InternalConflictStatus;
    limit?: number;
  }): InternalConflictRecord[] {
    return this.repo.listConflicts(filter);
  }
}
