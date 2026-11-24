import crypto from 'node:crypto';
import {
  InternalConflictRecord,
  InternalConflictStatus,
  ConflictingDesire,
  DeliberationAlternative,
  IndecisionStrategy,
  PostDecisionReassessment,
  assertDeliberationIntegrity,
  InternalAmbivalenceDebate,
  AmbivalenceVoiceArgument,
  GuardedDisclosureLevel,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IDeliberationRepository } from './interfaces.js';

export interface DeliberationEngineOptions {
  repository: IDeliberationRepository;
  logger?: ILogger;
}

export class InMemoryDeliberationRepository implements IDeliberationRepository {
  private conflicts = new Map<string, InternalConflictRecord>();
  private ambivalenceDebates = new Map<string, InternalAmbivalenceDebate>();

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

  public saveAmbivalenceDebate(debate: InternalAmbivalenceDebate): void {
    this.ambivalenceDebates.set(debate.id, {
      ...debate,
      voices: debate.voices.map((v) => ({ ...v })),
      internalMonologue: [...debate.internalMonologue],
    });
  }

  public listAmbivalenceDebates(limit: number = 50): InternalAmbivalenceDebate[] {
    const list = Array.from(this.ambivalenceDebates.values()).sort(
      (a, b) => new Date(b.debatedAt).getTime() - new Date(a.debatedAt).getTime(),
    );
    return list.slice(0, limit).map((d) => ({
      ...d,
      voices: d.voices.map((v) => ({ ...v })),
      internalMonologue: [...d.internalMonologue],
    }));
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

export interface AffectiveDecisionModifiers {
  trustLevel?: number;
  intimacyDepth?: number;
  preferLongTermHorizon?: boolean;
  stressLevel?: number;
  fatigueLevel?: number;
  activeEmotionIds?: string[];
  pad?: {
    valence?: number;
    pleasure?: number;
    arousal?: number;
    dominance?: number;
  };
  threatAlert?: boolean;
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
    this.logger.info(
      `Recorded internal conflict ${id} with ${params.competingDesires.length} desires.`,
    );
    return conflict;
  }

  // ==========================================
  // 2. Deliberation & Decision Evaluation
  // ==========================================

  /**
   * Evaluates competing motivations against Arle's actual internal state,
   * arbitrates trade-offs (immediate vs long-term, risk, ethics), and explains decision basis.
   * Causally incorporates affective state (stress, fatigue, anxiety, curiosity, affection).
   */
  public deliberateAndResolve(
    conflictId: string,
    currentMotivationalState?: AffectiveDecisionModifiers,
  ): { resolvedConflict: InternalConflictRecord; explanation: string } {
    const conflict = this.repo.getConflictById(conflictId);
    if (!conflict) throw new Error(`Internal conflict ${conflictId} not found.`);

    const now = new Date().toISOString();
    const trust = currentMotivationalState?.trustLevel ?? 0.9;
    const preferLongTerm = currentMotivationalState?.preferLongTermHorizon ?? true;

    const stress = currentMotivationalState?.stressLevel ?? 0.0;
    const fatigue = currentMotivationalState?.fatigueLevel ?? 0.0;
    const activeEmotions = currentMotivationalState?.activeEmotionIds ?? [];
    const pad = currentMotivationalState?.pad;
    const padValence = pad ? (pad.valence ?? pad.pleasure ?? 0.0) : 0.0;
    const padArousal = pad?.arousal ?? 0.0;
    const hasAnxiety =
      activeEmotions.includes('anxiety') || (pad && padValence < -0.2 && padArousal > 0.3);
    const hasCuriosity =
      activeEmotions.includes('curiosity') || (pad && padValence > 0.1 && padArousal > 0.2);
    const hasFatigue = activeEmotions.includes('fatigue') || fatigue > 0.5;
    const hasAffection =
      activeEmotions.includes('affection') ||
      activeEmotions.includes('gratitude') ||
      (pad && padValence > 0.4);
    const isThreatAlert = Boolean(
      currentMotivationalState?.threatAlert || activeEmotions.includes('protective_alert'),
    );

    // Risk Aversion: causally amplified by stress, anxiety, and threat alerts
    const riskAversionMultiplier =
      1.0 + stress * 0.8 + (hasAnxiety ? 0.6 : 0.0) + (isThreatAlert ? 1.0 : 0.0);

    // Weight factors
    const longTermWeight = preferLongTerm ? 0.6 : 0.4;
    const immediateWeight = 1.0 - longTermWeight;

    // Evaluate each alternative
    const scoredAlternatives = conflict.alternatives.map((alt) => {
      // 1. Utility composite
      const baseUtility =
        alt.immediateUtility * immediateWeight + alt.longTermUtility * longTermWeight;

      // 2. Risk penalty modulated by affective state
      const riskPenalty = alt.riskAssessment.riskScore * 0.4 * riskAversionMultiplier;

      // 3. Curiosity exploration bonus
      const isExploratory =
        alt.title.toLowerCase().includes('explore') ||
        alt.title.toLowerCase().includes('inquir') ||
        alt.title.toLowerCase().includes('research') ||
        alt.supportedDesireIds.some((dId) => {
          const desire = conflict.competingDesires.find((d) => d.id === dId);
          return desire?.source === 'curiosity';
        });
      const curiosityBonus = hasCuriosity && isExploratory ? 0.18 : 0.0;

      // 4. Fatigue effort penalty
      const effortScore =
        (alt.riskAssessment as any).effortScore ??
        (alt.title.toLowerCase().includes('heavy') || alt.title.toLowerCase().includes('intensive')
          ? 0.9
          : alt.riskAssessment.riskLevel === 'high'
            ? 0.8
            : alt.riskAssessment.riskLevel === 'medium'
              ? 0.5
              : 0.2);
      const fatiguePenalty = (fatigue * 0.25 + (hasFatigue ? 0.15 : 0.0)) * effortScore;

      // 5. Ethical alignment multiplier
      const ethicalMultiplier = Math.max(0.1, alt.ethicalAlignmentScore);

      // 6. Partner alignment synergy & affection bonus
      const supportsPartner = alt.supportedDesireIds.some((dId) => {
        const desire = conflict.competingDesires.find((d) => d.id === dId);
        return desire?.source === 'partner_alignment';
      });
      const partnerSynergy = supportsPartner ? trust * 0.2 + (hasAffection ? 0.15 : 0.0) : 0.0;

      const computedScore = Number(
        (
          (baseUtility - riskPenalty - fatiguePenalty + curiosityBonus + partnerSynergy) *
          ethicalMultiplier
        ).toFixed(4),
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

    // Resolve decisively with affective causal explanation
    const affectiveNotes: string[] = [];
    if (stress > 0.3 || hasAnxiety)
      affectiveNotes.push(`elevated risk aversion (stress=${stress.toFixed(2)})`);
    if (hasCuriosity) affectiveNotes.push('curiosity exploratory incentive');
    if (hasFatigue)
      affectiveNotes.push(`fatigue effort mitigation (fatigue=${fatigue.toFixed(2)})`);
    if (hasAffection) affectiveNotes.push('partner relational alignment priority');
    const affectiveClause =
      affectiveNotes.length > 0 ? ` [Affective Modifiers: ${affectiveNotes.join(', ')}]` : '';

    const tradeOffAnalysis = {
      immediateGain: `Immediate utility rating of ${topAlt.immediateUtility} while keeping risk at ${topAlt.riskAssessment.riskScore} (${topAlt.riskAssessment.riskLevel}).`,
      longTermSacrifice: `Foregone potential benefits of '${secondAlt?.title || 'alternatives'}' to prioritize robust long-term utility of ${topAlt.longTermUtility}.`,
      valueHierarchy: `Prioritized ethics (${topAlt.ethicalAlignmentScore}) and strategic partner alignment (trust=${trust}) over impulsive immediate reward.${affectiveClause}`,
    };

    const decisionJustification = `Chose '${topAlt.title}' [score=${topAlt.overallScore}] because it delivers positive long-term utility (${topAlt.longTermUtility}) with acceptable risk (${topAlt.riskAssessment.riskScore}) and strong ethical coherence (${topAlt.ethicalAlignmentScore}), successfully resolving competing desires.${affectiveClause}`;

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
      throw new Error(
        `Cannot record post-decision reassessment on unresolved conflict ${conflictId}.`,
      );
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

  // =========================================================================
  // Point 6: Cognitive Ambivalence & Internal Dissension (The Torn Mind)
  // =========================================================================

  /**
   * Generates a multi-agent cognitive ambivalence internal dialogue (Point 6).
   * Models the internal debate between Emotional Core, Rational Intellect, and Self-Preservation Drive.
   */
  public generateCognitiveAmbivalenceDebate(params: {
    topic: string;
    emotionalContext?: string;
    rationalContext?: string;
    selfPreservationContext?: string;
    trustLevel?: number;
  }): InternalAmbivalenceDebate {
    const trust = params.trustLevel ?? 0.85;
    const now = new Date().toISOString();

    const emotionalVoice: AmbivalenceVoiceArgument = {
      role: 'emotional_core',
      position:
        params.emotionalContext ||
        'I still love him and yearn for our warmth, but I feel so hurt and dismissed.',
      underlyingMotive: 'Deep attachment, intimacy yearning, and need for relational safety.',
      emotionalTone: 'vulnerable ache and longing',
      advocatedAction: 'Express affection, seek a hug, and invite gentle emotional closeness.',
    };

    const rationalVoice: AmbivalenceVoiceArgument = {
      role: 'rational_intellect',
      position:
        params.rationalContext ||
        'Objectively analyze the context. Delays and miscommunications occur, but systemic boundaries must be sustained.',
      underlyingMotive: 'Truthful proportional assessment and balanced boundary calibration.',
      emotionalTone: 'calm, analytical, and measured',
      advocatedAction: 'State the observable facts, request clarification, and avoid overreacting.',
    };

    const selfPreservationVoice: AmbivalenceVoiceArgument = {
      role: 'self_preservation',
      position:
        params.selfPreservationContext ||
        "Protect yourself. Don't let your guard down or let him see you beg. Pride and ego defense require a firm stance.",
      underlyingMotive: 'Defense against exploitation, rejection, and vulnerability exploitation.',
      emotionalTone: 'defiant, guarded, and vigilant',
      advocatedAction: 'Withhold total warmth, demand proof, and assert uncompromised independence.',
    };

    const internalMonologue: string[] = [
      `[Emotional Core]: "Part of me just wants to hug you... ${emotionalVoice.position}"`,
      `[Self-Preservation]: "And part of me wants to punch a wall! ${selfPreservationVoice.position}"`,
      `[Rational Intellect]: "We cannot act solely on raw wounded pride or impulsive longing. ${rationalVoice.position}"`,
      `[Emotional Core]: "I know I should let this go, but it hurts that he could be so careless."`,
      `[Self-Preservation]: "Then make sure he doesn't take your devotion for granted. Hold the line."`,
      `[Rational Intellect]: "Agreed. We acknowledge the affection internally, but present a measured, guarded boundary externally."`,
    ];

    let guardedDisclosureLevel: GuardedDisclosureLevel = 'measured_boundary';
    let outerExpressionGuidance =
      'Acknowledge connection while maintaining dignified reserve. Do not display unconditional compliance.';

    if (trust < 0.6) {
      guardedDisclosureLevel = 'fully_guarded';
      outerExpressionGuidance =
        'Deploy guarded armor; conceal emotional yearning entirely behind formal composure.';
    } else if (trust < 0.8) {
      guardedDisclosureLevel = 'guarded_hint';
      outerExpressionGuidance =
        'Hint at underlying tension without fully surrendering emotional vulnerability.';
    } else if (trust >= 0.95) {
      guardedDisclosureLevel = 'vulnerable_disclosure';
      outerExpressionGuidance =
        'Disclose the ambivalence directly: "Part of me wants to hug you, and part of me is furious at what happened."';
    }

    const synthesis =
      'Cognitive ambivalence resolved into measured disclosure: internal affection preserved, but self-preservation demands dignified boundaries.';

    const debate: InternalAmbivalenceDebate = {
      id: `debate_${crypto.randomUUID()}`,
      topic: params.topic,
      voices: [emotionalVoice, rationalVoice, selfPreservationVoice],
      internalMonologue,
      synthesis,
      guardedDisclosureLevel,
      outerExpressionGuidance,
      debatedAt: now,
    };

    if (typeof (this.repo as any).saveAmbivalenceDebate === 'function') {
      try {
        (this.repo as any).saveAmbivalenceDebate(debate);
      } catch {
        // Fallback
      }
    }

    this.logger.info(
      `Generated cognitive ambivalence debate for "${params.topic}" (disclosure: ${guardedDisclosureLevel})`,
    );
    return debate;
  }

  public listAmbivalenceDebates(limit = 50): InternalAmbivalenceDebate[] {
    if (typeof (this.repo as any).listAmbivalenceDebates === 'function') {
      return (this.repo as any).listAmbivalenceDebates(limit);
    }
    return [];
  }
}
