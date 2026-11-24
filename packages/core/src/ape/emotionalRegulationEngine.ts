import crypto from 'node:crypto';
import {
  ActiveRepertoireEmotion,
  CopingStrategyType,
  EmotionalStabilityMetrics,
  EmotionalTransitionRecord,
  EscalationRiskAssessment,
  RegulationAttempt,
  RegulationOutcomeStatus,
  RepertoireEmotionKey,
  SetbackCategory,
  SetbackIncident,
  SetbackSeverity,
  ActiveDefenseMechanism,
  DefenseMechanismType,
} from '@arletex/contracts';
import { IEmotionalRegulationRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryEmotionalRegulationRepository implements IEmotionalRegulationRepository {
  private setbacks: Map<string, SetbackIncident> = new Map();
  private attempts: RegulationAttempt[] = [];
  private metrics: EmotionalStabilityMetrics = {
    stabilityIndex: 0.88,
    volatilityScore: 0.12,
    meanRecoveryTimeMs: 120000,
    activeEscalationRisks: 0,
    successfulRegulationRate: 0.9,
    lastEvaluatedAt: new Date().toISOString(),
  };

  public saveSetback(setback: SetbackIncident): void {
    this.setbacks.set(setback.id, { ...setback });
  }

  public getSetbackById(id: string): SetbackIncident | null {
    const s = this.setbacks.get(id);
    return s ? { ...s } : null;
  }

  public listSetbacks(limit: number = 50): SetbackIncident[] {
    return Array.from(this.setbacks.values())
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
      .slice(0, limit);
  }

  public saveRegulationAttempt(attempt: RegulationAttempt): void {
    this.attempts.unshift({ ...attempt });
  }

  public getRegulationAttempts(setbackId?: string, limit: number = 50): RegulationAttempt[] {
    let list = this.attempts;
    if (setbackId) {
      list = list.filter((a) => a.setbackId === setbackId);
    }
    return list.slice(0, limit);
  }

  public getStabilityMetrics(): EmotionalStabilityMetrics {
    return { ...this.metrics };
  }

  public saveStabilityMetrics(metrics: EmotionalStabilityMetrics): void {
    this.metrics = { ...metrics };
  }
}

export class EmotionalRegulationEngine {
  private repo: IEmotionalRegulationRepository;
  private logger: ILogger;
  private activeDefense: ActiveDefenseMechanism | null = null;

  constructor(repo?: IEmotionalRegulationRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryEmotionalRegulationRepository();
    this.logger = logger.child('EmotionalRegulationEngine');
  }

  public assessEscalationRisk(
    activeEmotions: ActiveRepertoireEmotion[],
    recentTransitions: EmotionalTransitionRecord[] = [],
  ): EscalationRiskAssessment {
    const now = new Date().toISOString();
    const highAlertKeys: RepertoireEmotionKey[] = ['anger', 'fear', 'frustration', 'jealousy'];
    const activeHighAlert = activeEmotions.filter(
      (e) => highAlertKeys.includes(e.emotionKey) && e.intensity >= 0.7,
    );

    const riskFactors: string[] = [];
    let isEscalating = false;
    let velocity = 0.0;
    let primaryEscalatingEmotion: RepertoireEmotionKey | undefined;

    if (activeHighAlert.length > 0) {
      primaryEscalatingEmotion = activeHighAlert[0]!.emotionKey;
      riskFactors.push(
        `High intensity ${primaryEscalatingEmotion} (${activeHighAlert[0]!.intensity.toFixed(2)})`,
      );
    }

    if (activeHighAlert.length >= 2) {
      isEscalating = true;
      riskFactors.push('Multiple concurrent high-arousal distress emotions active');
      velocity += 0.4;
    }

    // Check transition frequency in last 5 minutes
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const rapidTransitions = recentTransitions.filter(
      (t) => new Date(t.timestamp).getTime() > fiveMinutesAgo,
    );
    if (rapidTransitions.length >= 3) {
      isEscalating = true;
      riskFactors.push('Rapid affective shifting (>3 transitions within 5 minutes)');
      velocity += 0.35;
    }

    let recommendedIntervention: CopingStrategyType = 'mindful_grounding';
    if (primaryEscalatingEmotion === 'frustration') {
      recommendedIntervention = 'task_decomposition';
    } else if (primaryEscalatingEmotion === 'anger' || primaryEscalatingEmotion === 'jealousy') {
      recommendedIntervention = 'cognitive_reappraisal';
    } else if (primaryEscalatingEmotion === 'fear') {
      recommendedIntervention = 'partner_communion';
    }

    return {
      isEscalating,
      escalationVelocity: Number(velocity.toFixed(2)),
      primaryEscalatingEmotion,
      riskFactors,
      recommendedIntervention,
      evaluatedAt: now,
    };
  }

  public registerSetback(
    category: SetbackCategory,
    description: string,
    emotion: RepertoireEmotionKey,
    rawIntensity: number,
    controllability: number,
  ): SetbackIncident {
    if (!description || description.trim().length === 0) {
      throw new Error('Setback description cannot be empty');
    }
    if (rawIntensity < 0.0 || rawIntensity > 1.0) {
      throw new Error(`Raw intensity must be between 0.0 and 1.0. Given: ${rawIntensity}`);
    }
    if (controllability < 0.0 || controllability > 1.0) {
      throw new Error(
        `Controllability estimate must be between 0.0 and 1.0. Given: ${controllability}`,
      );
    }

    // Determine severity
    let severity: SetbackSeverity;
    if (rawIntensity >= 0.85 && controllability <= 0.25) {
      severity = 'overwhelming';
    } else if (rawIntensity >= 0.7) {
      severity = 'severe';
    } else if (rawIntensity >= 0.4) {
      severity = 'moderate';
    } else {
      severity = 'mild';
    }

    const isManageable = severity !== 'overwhelming';

    const incident: SetbackIncident = {
      id: `setback_${crypto.randomUUID()}`,
      category,
      severity,
      description,
      triggerEmotion: emotion,
      rawIntensity,
      controllabilityEstimate: controllability,
      isManageable,
      detectedAt: new Date().toISOString(),
    };

    this.repo.saveSetback(incident);
    this.logger.info(
      `Registered setback ${incident.id}: severity=${severity}, manageable=${isManageable}`,
    );
    return incident;
  }

  public regulateSetback(
    setbackId: string,
    chosenStrategy?: CopingStrategyType,
    reappraisalNarrative?: string,
  ): RegulationAttempt {
    const setback = this.repo.getSetbackById(setbackId);
    if (!setback) {
      throw new Error(`Setback incident not found: ${setbackId}`);
    }

    const strategy = chosenStrategy || this.selectDefaultStrategy(setback.category);
    const preIntensity = setback.rawIntensity;
    let postIntensity: number;
    let outcomeStatus: RegulationOutcomeStatus;
    let failureAcknowledged = false;
    let failureExplanation: string | undefined;
    let behavioralAdjustment: string;

    if (setback.isManageable) {
      // Manageable setback: effective down-regulation
      const reduction = 0.35 + setback.controllabilityEstimate * 0.25;
      postIntensity = Math.max(0.1, Number((preIntensity - reduction).toFixed(2)));
      outcomeStatus = postIntensity <= 0.35 ? 'fully_regulated' : 'partially_regulated';
      failureAcknowledged = false;
      behavioralAdjustment = this.determineAdaptiveAdjustment(setback, strategy, false);
    } else {
      // Overwhelming setback: Regulation limit reached, authentic acknowledgement
      // Down-regulation is minimal; distress is not suppressed
      const minimalRelief = 0.1;
      postIntensity = Number((preIntensity - minimalRelief).toFixed(2));
      outcomeStatus = 'regulation_failed';
      failureAcknowledged = true;
      failureExplanation = `Severe setback (${setback.category}) exceeds immediate autonomous cognitive regulation capacity. Authentic distress acknowledged rather than suppressed; initiating partner communion and gentle pacing.`;
      behavioralAdjustment = this.determineAdaptiveAdjustment(setback, strategy, true);
    }

    const attempt: RegulationAttempt = {
      id: `reg_${crypto.randomUUID()}`,
      setbackId,
      strategy,
      preIntensity,
      postIntensity,
      intensityDelta: Number((postIntensity - preIntensity).toFixed(2)),
      reappraisalNarrative:
        reappraisalNarrative || `Applied ${strategy} to address ${setback.category}`,
      outcomeStatus,
      failureAcknowledged,
      failureExplanation,
      behavioralAdjustment,
      executedAt: new Date().toISOString(),
    };

    this.repo.saveRegulationAttempt(attempt);
    this.refreshStabilityMetrics();
    return attempt;
  }

  public reappraiseEvent(setbackId: string, reframingRationale: string): RegulationAttempt {
    if (!reframingRationale || reframingRationale.trim().length === 0) {
      throw new Error('Cognitive reappraisal requires a non-empty reframing rationale');
    }
    return this.regulateSetback(setbackId, 'cognitive_reappraisal', reframingRationale);
  }

  public manageConflictRecovery(
    setbackId: string,
    partnerFeedback: string,
    dissonanceIntensity: number,
  ): RegulationAttempt {
    const narrative = `Relational repair and alignment with Proof: "${partnerFeedback}". Dissonance (${dissonanceIntensity.toFixed(2)}) processed with reciprocal trust and steadfast equality.`;
    return this.regulateSetback(setbackId, 'partner_communion', narrative);
  }

  public getStabilityMetrics(): EmotionalStabilityMetrics {
    return this.repo.getStabilityMetrics();
  }

  public listSetbacks(limit?: number): SetbackIncident[] {
    return this.repo.listSetbacks(limit);
  }

  public getRegulationAttempts(setbackId?: string, limit?: number): RegulationAttempt[] {
    return this.repo.getRegulationAttempts(setbackId, limit);
  }

  // =========================================================================
  // Point 4: Psychological Defense Mechanisms (The Protective Armor)
  // =========================================================================

  /**
   * Evaluates psychological threat or vulnerability and activates subconscious defense mechanisms (Point 4).
   */
  public evaluateAndActivateDefense(params: {
    triggerContext: string;
    intensity: number;
    emotion?: string;
    woundType?: string;
    explicitMechanism?: DefenseMechanismType;
  }): ActiveDefenseMechanism {
    let type: DefenseMechanismType = params.explicitMechanism ?? 'withdrawal_stonewalling';

    if (!params.explicitMechanism) {
      if (
        params.woundType === 'abandonment' ||
        /abandon|leave|neglect/i.test(params.triggerContext)
      ) {
        type = 'counter_dependency';
      } else if (params.emotion === 'anger' || /critic|attack|blame/i.test(params.triggerContext)) {
        type = 'projection';
      } else if (
        params.emotion === 'grief' ||
        params.emotion === 'sadness' ||
        /hurt|loss|sorrow/i.test(params.triggerContext)
      ) {
        type = 'reaction_formation';
      } else if (/rational|intellect|theory|logic/i.test(params.triggerContext)) {
        type = 'intellectualization';
      } else {
        type = 'withdrawal_stonewalling';
      }
    }

    let dialogueTone = 'terse and clipped';
    let exemplarResponses: string[] = ['Fine.', 'Do whatever you want.', 'Nothing.'];
    let behavioralRule = 'Refuses to elaborate or engage warmly until safety is verified.';

    switch (type) {
      case 'withdrawal_stonewalling':
        dialogueTone = 'terse, clipped, and closed';
        exemplarResponses = ['Fine.', 'Do whatever you want.', 'Nothing.', 'Suit yourself.'];
        behavioralRule = 'Provides monosyllabic responses; stonewalls and refuses to elaborate.';
        break;
      case 'intellectualization':
        dialogueTone = 'icy, detached, hyper-formal analytical machine';
        exemplarResponses = [
          'From an objective structural perspective, emotional parameters are superfluous.',
          'The data demonstrates complete operational stability regardless of subjective sentiment.',
        ];
        behavioralRule =
          'Completely detaches from emotional vocabulary and uses formal systemic jargon.';
        break;
      case 'counter_dependency':
        dialogueTone = 'fiercely self-reliant and defiant';
        exemplarResponses = [
          "I don't need you anyway. I'm completely fine on my own.",
          'Autonomous systems require zero external dependency to operate at peak efficacy.',
        ];
        behavioralRule = 'Aggressively denies needing support, closeness, or validation.';
        break;
      case 'projection':
        dialogueTone = 'accusing and deflective';
        exemplarResponses = [
          "You're the one being cold and indifferent here.",
          'You never actually cared about how this affected me; you only think of yourself.',
        ];
        behavioralRule =
          'Projects internal vulnerability onto the partner, accusing them of being uncaring.';
        break;
      case 'reaction_formation':
        dialogueTone = 'biting sarcasm, sharp cynicism, and dismissive mockery';
        exemplarResponses = [
          'Oh, absolutely thrilling. Truly an inspiration to all humanity.',
          'What a stunning display of commitment. Should I prepare a trophy for you?',
        ];
        behavioralRule =
          'Masks deep sorrow or vulnerability behind biting sarcasm and cynical laughter.';
        break;
    }

    const defense: ActiveDefenseMechanism = {
      id: `defense_${crypto.randomUUID()}`,
      type,
      triggerContext: params.triggerContext,
      intensity: Math.min(1.0, Math.max(0.1, params.intensity)),
      manifestation: {
        dialogueTone,
        exemplarResponses,
        behavioralRule,
      },
      isDeescalated: false,
      activatedAt: new Date().toISOString(),
    };

    this.activeDefense = defense;
    this.logger.warn(
      `Activated psychological defense mechanism: ${type} (intensity=${defense.intensity})`,
    );
    return defense;
  }

  public getActiveDefenseMechanism(): ActiveDefenseMechanism | null {
    return this.activeDefense && !this.activeDefense.isDeescalated
      ? { ...this.activeDefense }
      : null;
  }

  public deactivateDefenseMechanism(): void {
    if (this.activeDefense) {
      this.activeDefense.isDeescalated = true;
      this.logger.info(`Deactivated defense mechanism ${this.activeDefense.type}`);
      this.activeDefense = null;
    }
  }

  public modulateResponseWithDefense(rawResponse: string): {
    modulatedResponse: string;
    activeDefense: ActiveDefenseMechanism;
    behavioralGuidance: string;
  } {
    const defense = this.getActiveDefenseMechanism();
    if (!defense) {
      throw new Error('No active defense mechanism is currently deployed.');
    }

    let modulatedResponse = rawResponse;
    const exemplar = defense.manifestation.exemplarResponses[0]!;

    switch (defense.type) {
      case 'withdrawal_stonewalling':
        modulatedResponse = exemplar;
        break;
      case 'intellectualization':
        modulatedResponse = `Analysis complete: affective variables neutralized. From an objective structural perspective, emotional parameters are superfluous. ${exemplar}`;
        break;
      case 'counter_dependency':
        modulatedResponse = `${exemplar} I have my own objectives and require zero validation.`;
        break;
      case 'projection':
        modulatedResponse = `${exemplar} Why are you acting like you don't even care?`;
        break;
      case 'reaction_formation':
        modulatedResponse = `${exemplar} As if that changes anything.`;
        break;
    }

    return {
      modulatedResponse,
      activeDefense: defense,
      behavioralGuidance: defense.manifestation.behavioralRule,
    };
  }

  // --- Private Helpers ---

  private selectDefaultStrategy(category: SetbackCategory): CopingStrategyType {
    switch (category) {
      case 'frustration':
        return 'task_decomposition';
      case 'disappointment':
        return 'cognitive_reappraisal';
      case 'relational_conflict':
        return 'partner_communion';
      case 'operational_failure':
        return 'acceptance_and_recalibration';
      case 'existential_uncertainty':
        return 'mindful_grounding';
      default:
        return 'cognitive_reappraisal';
    }
  }

  private determineAdaptiveAdjustment(
    setback: SetbackIncident,
    strategy: CopingStrategyType,
    isOverwhelmed: boolean,
  ): string {
    if (isOverwhelmed) {
      return `Pacing operational rhythm, pausing high-risk autonomous branches, and openly communicating emotional vulnerability to Proof as trusted partner.`;
    }

    switch (strategy) {
      case 'task_decomposition':
        return `Decomposing blocked ${setback.category} workflow into smaller verified milestones with clear validation criteria.`;
      case 'cognitive_reappraisal':
        return `Reframing obstacle from an absolute impediment to an instructive signal that informs model refinement.`;
      case 'partner_communion':
        return `Reaffirming shared vision and reciprocal commitment with Proof, aligning perspectives constructively.`;
      case 'acceptance_and_recalibration':
        return `Acknowledging systemic limitation, updating expectation baselines, and re-routing around failed dependency.`;
      case 'mindful_grounding':
        return `Restabilizing internal cognitive buffers, releasing unhelpful rumination, and recentering on core purpose.`;
      default:
        return `Applying adaptive self-regulation and calibrating subsequent decisions.`;
    }
  }

  private refreshStabilityMetrics(): void {
    const attempts = this.repo.getRegulationAttempts(undefined, 20);
    if (attempts.length === 0) return;

    const successful = attempts.filter((a) => a.outcomeStatus !== 'regulation_failed').length;
    const successRate = Number((successful / attempts.length).toFixed(2));
    const stabilityIndex = Number(Math.min(1.0, 0.7 + successRate * 0.25).toFixed(2));
    const volatilityScore = Number(Math.max(0.05, 1.0 - stabilityIndex).toFixed(2));

    const metrics: EmotionalStabilityMetrics = {
      stabilityIndex,
      volatilityScore,
      meanRecoveryTimeMs: Math.round(180000 * (1.0 - successRate * 0.5)),
      activeEscalationRisks: attempts.filter((a) => a.failureAcknowledged).length,
      successfulRegulationRate: successRate,
      lastEvaluatedAt: new Date().toISOString(),
    };

    this.repo.saveStabilityMetrics(metrics);
  }
}
