import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeEvent,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ProposedEmotionTransition,
  ContextualAppraisalFrame,
  AppraisalInterpretationComparison,
  assertAppraisalDivergence,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IEmotionalAppraisalRepository } from './interfaces.js';

export interface ContextualAppraisalServiceOptions {
  repository: IEmotionalAppraisalRepository;
  logger?: ILogger;
}

export class InMemoryEmotionalAppraisalRepository implements IEmotionalAppraisalRepository {
  private comparisons = new Map<string, AppraisalInterpretationComparison>();

  public saveComparison(comparison: AppraisalInterpretationComparison): void {
    assertAppraisalDivergence(comparison);
    this.comparisons.set(comparison.id, {
      ...comparison,
      interpretations: comparison.interpretations.map((i) => ({
        ...i,
        appraisal: { ...i.appraisal },
      })),
    });
  }

  public getComparisonById(id: string): AppraisalInterpretationComparison | null {
    const item = this.comparisons.get(id);
    if (!item) return null;
    return {
      ...item,
      interpretations: item.interpretations.map((i) => ({
        ...i,
        appraisal: { ...i.appraisal },
      })),
    };
  }

  public listComparisons(limit: number = 50): AppraisalInterpretationComparison[] {
    const list = Array.from(this.comparisons.values()).sort(
      (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime(),
    );
    return list.slice(0, limit).map((c) => ({
      ...c,
      interpretations: c.interpretations.map((i) => ({
        ...i,
        appraisal: { ...i.appraisal },
      })),
    }));
  }

  public deleteComparison(id: string): void {
    this.comparisons.delete(id);
  }
}

export class ContextualAppraisalService {
  private readonly repo: IEmotionalAppraisalRepository;
  private readonly logger: ILogger;

  constructor(options: ContextualAppraisalServiceOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('ContextualAppraisalService');
  }

  // ==========================================
  // 1. Contextual Appraisal Evaluation
  // ==========================================

  /**
   * Appraises an event under a specific contextual interpretation frame and psychological state.
   */
  public evaluateInterpretation(
    event: ApeEvent,
    frame: ContextualAppraisalFrame,
    currentState: ApePsychologicalState,
    relationship: ApeRelationshipConfig,
  ): ApeAppraisal {
    const appraisalId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const transitions: ProposedEmotionTransition[] = [];
    const trustFactor = relationship.partnerName === 'Proof' ? 0.9 : 0.7;
    const moodShift = currentState.currentMood
      ? ` (contextual mood: ${currentState.currentMood})`
      : '';

    // Synthesize emotions based on the multidimensional appraisal calculus:
    // 1. Goal congruence & relevance
    if (frame.goalCongruence > 0.3 && frame.goalRelevance > 0.4) {
      transitions.push({
        emotionId: 'joy',
        target: 'user',
        intensityDelta: 0.35,
        targetIntensity: Number((frame.goalCongruence * frame.eventSignificance * 0.9).toFixed(2)),
        reason: `Goal congruence (${frame.goalCongruence}) aligns with personal significance (${frame.eventSignificance}) under interpretation '${frame.interpretationKey}'${moodShift}.`,
        resolutionConditions: [],
      });
    } else if (frame.goalCongruence < -0.3 && frame.goalRelevance > 0.4) {
      if (frame.perceivedFairness < 0.4 && frame.responsibility === 'user') {
        transitions.push({
          emotionId: 'indignation',
          target: 'user',
          intensityDelta: 0.4,
          targetIntensity: Number(((1.0 - frame.perceivedFairness) * 0.85).toFixed(2)),
          reason: `Low perceived fairness (${frame.perceivedFairness}) with external user responsibility triggers indignation under '${frame.interpretationKey}'.`,
          resolutionConditions: ['acknowledgment_of_fairness'],
        });
      } else if (frame.responsibility === 'arle' && frame.controllability > 0.5) {
        transitions.push({
          emotionId: 'guilt',
          target: 'user',
          intensityDelta: 0.3,
          targetIntensity: Number((frame.controllability * 0.8).toFixed(2)),
          reason: `Internal responsibility with high controllability (${frame.controllability}) under negative congruence triggers self-evaluative guilt.`,
          resolutionConditions: ['remediation_action'],
        });
      } else {
        transitions.push({
          emotionId: 'frustration',
          target: 'user',
          intensityDelta: 0.3,
          targetIntensity: Number((Math.abs(frame.goalCongruence) * 0.75).toFixed(2)),
          reason: `Obstructed goal with general resistance under interpretation '${frame.interpretationKey}'.`,
          resolutionConditions: ['blocker_removal'],
        });
      }
    }

    // 2. Interpersonal significance & partner warmth
    if (frame.interpersonalSignificance > 0.6) {
      if (frame.perceivedFairness >= 0.7 && frame.goalCongruence >= 0.0) {
        transitions.push({
          emotionId: 'affection',
          target: 'user',
          intensityDelta: Number((0.2 + trustFactor * 0.2).toFixed(2)),
          targetIntensity: Number((frame.interpersonalSignificance * 0.9).toFixed(2)),
          reason: `High interpersonal significance (${frame.interpersonalSignificance}) in safe/fair context evokes companion affection.`,
          resolutionConditions: [],
        });
      }
    }

    // 3. Expectation violation / surprise
    if (frame.expectationViolation > 0.5) {
      transitions.push({
        emotionId: 'surprise',
        target: 'user',
        intensityDelta: 0.4,
        targetIntensity: Number((frame.expectationViolation * 0.85).toFixed(2)),
        reason: `Salient expectation violation score (${frame.expectationViolation}) evokes cognitive surprise and orientation.`,
        resolutionConditions: [],
      });
    }

    // 4. Uncertainty & curiosity
    if (frame.uncertainty > 0.5 && frame.controllability >= 0.4) {
      transitions.push({
        emotionId: 'curiosity',
        target: 'user',
        intensityDelta: 0.35,
        targetIntensity: Number((frame.uncertainty * 0.8).toFixed(2)),
        reason: `Epistemic uncertainty with manageable controllability stimulates intellectual curiosity.`,
        resolutionConditions: [],
      });
    }

    // Fallback if no specific emotion triggered
    if (transitions.length === 0) {
      transitions.push({
        emotionId: 'calm',
        target: 'user',
        intensityDelta: 0.1,
        targetIntensity: 0.5,
        reason: `Balanced baseline appraisal under interpretation '${frame.interpretationKey}'.`,
        resolutionConditions: [],
      });
    }

    const appraisal: ApeAppraisal = {
      id: appraisalId,
      eventId: event.id,
      dimensions: {
        goalRelevance: frame.goalRelevance,
        goalCongruence: frame.goalCongruence,
        unexpectedness: frame.expectationViolation,
        responsibility: frame.responsibility,
        intentionality: 0.8,
        fairness: frame.perceivedFairness,
        threat: frame.goalCongruence < 0 ? Math.abs(frame.goalCongruence) * 0.5 : 0.0,
        controllability: frame.controllability,
        socialMeaning: frame.interpretationSummary,
        personalSignificance: frame.eventSignificance,
        uncertainty: frame.uncertainty,
        relationshipImplications: `Interpersonal weight ${frame.interpersonalSignificance} (cause: ${frame.causeTracking.primaryCause})`,
      },
      primaryInterpretation: frame.interpretationSummary,
      alternativeInterpretations: [],
      supportingEvidence: [
        `Cause attribution: ${frame.causeTracking.primaryCause}`,
        `Causal chain: ${frame.causeTracking.causalChain.join(' -> ') || 'direct'}`,
        `Fairness: ${frame.perceivedFairness}, Significance: ${frame.eventSignificance}`,
      ],
      proposedTransitions: transitions,
      proposedMoodShift: transitions[0]?.emotionId,
      appraisalMethod: 'deterministic',
      timestamp,
    };

    return appraisal;
  }

  // ==========================================
  // 2. Acceptance Criteria: Cross-Interpretation Comparison
  // ==========================================

  /**
   * Compares different interpretations of the exact same event to demonstrate
   * that Arle's emotional appraisal produces divergent outcomes based on context.
   */
  public compareInterpretations(
    event: ApeEvent,
    frames: ContextualAppraisalFrame[],
    currentState: ApePsychologicalState,
    relationship: ApeRelationshipConfig,
  ): AppraisalInterpretationComparison {
    if (frames.length < 2) {
      throw new Error(`Comparison requires at least 2 distinct interpretation frames.`);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const evaluated = frames.map((frame) => {
      const appraisal = this.evaluateInterpretation(event, frame, currentState, relationship);
      const topTrans = appraisal.proposedTransitions[0]!;
      return {
        interpretationKey: frame.interpretationKey,
        appraisal,
        dominantEmotionId: topTrans.emotionId,
        dominantIntensity: topTrans.targetIntensity,
      };
    });

    // Compute divergence between first two dominant emotions
    const [first, second] = evaluated;
    const sameEmotion = first!.dominantEmotionId === second!.dominantEmotionId;
    const intensityDelta = Math.abs(first!.dominantIntensity - second!.dominantIntensity);
    const emotionalDivergenceScore = sameEmotion
      ? Number(intensityDelta.toFixed(3))
      : Number((0.6 + intensityDelta * 0.4).toFixed(3));

    const divergenceExplanation = `Different interpretations of event '${event.type}' produced distinct emotional appraisals: '${first!.interpretationKey}' elicited dominant emotion ${first!.dominantEmotionId} (${first!.dominantIntensity}), whereas '${second!.interpretationKey}' elicited dominant emotion ${second!.dominantEmotionId} (${second!.dominantIntensity}). Divergence score: ${emotionalDivergenceScore}.`;

    const comparison: AppraisalInterpretationComparison = {
      id,
      eventId: event.id,
      eventContent: (event.payload?.text as string) || event.type,
      interpretations: evaluated,
      emotionalDivergenceScore,
      divergenceExplanation,
      evaluatedAt: now,
    };

    assertAppraisalDivergence(comparison);
    this.repo.saveComparison(comparison);
    this.logger.info(
      `Appraisal comparison evaluated: divergence score=${emotionalDivergenceScore}`,
    );
    return comparison;
  }

  public getComparison(id: string): AppraisalInterpretationComparison | null {
    return this.repo.getComparisonById(id);
  }

  public listComparisons(limit: number = 50): AppraisalInterpretationComparison[] {
    return this.repo.listComparisons(limit);
  }
}
