import crypto from 'node:crypto';
import {
  ActiveEmotionPersistence,
  ActiveEmotionState,
  ActiveEmotionStatus,
  ApeAppraisal,
  ApeEvent,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ApeTransitionRecord,
  ContextualAffectiveMeasurements,
  CorePadDimensions,
  EmotionTaxonomyItem,
  MoodTaxonomyItem,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';

export class AffectiveTransitionEngine {
  private readonly repo: IApeRepository;
  private readonly emotionsMap: Map<string, EmotionTaxonomyItem>;
  private readonly moodsMap: Map<string, MoodTaxonomyItem>;

  constructor(repo: IApeRepository, emotions: EmotionTaxonomyItem[], moods: MoodTaxonomyItem[]) {
    this.repo = repo;
    this.emotionsMap = new Map(emotions.map((e) => [e.id, e]));
    this.moodsMap = new Map(moods.map((m) => [m.id, m]));
  }

  public applyAppraisal(
    appraisal: ApeAppraisal,
    event: ApeEvent,
    currentState: ApePsychologicalState,
    relationship: ApeRelationshipConfig,
  ): ApePsychologicalState {
    const timestamp = appraisal.timestamp;
    const activeEmotions = this.repo.getActiveEmotions();
    const transitionsRecorded: ApeTransitionRecord[] = [];

    // Causal Integrity Check: Assistant expression must not circularly inflate emotions
    const isAssistantExpression =
      event.actor === 'arle' ||
      event.source === 'arle' ||
      event.eventKind === 'assistant_expression';

    // 1. Process each proposed transition
    for (const prop of appraisal.proposedTransitions) {
      // Invariant: Assistant expression never uses compounding positive deltas
      if (isAssistantExpression) {
        prop.intensityDelta = 0.0;
      }

      // INVARIANT ENFORCEMENT: Never allow romantic/sexual emotions targeted to non-user!
      const taxonomyItem = this.emotionsMap.get(prop.emotionId);
      if (
        taxonomyItem &&
        (taxonomyItem.category === 'love_affection' || taxonomyItem.category === 'sexual_sensual')
      ) {
        if (prop.target && prop.target !== 'creator' && prop.target !== 'user') {
          prop.emotionId = 'admiration';
          prop.target = 'external';
          prop.reason = 'Invariant enforcement: Romantic/sexual orientation exclusively reserved for creator.';
        }
      }

        const existing = activeEmotions.find(
          (e: ActiveEmotionState) => e.emotionId === prop.emotionId && e.status !== 'resolved',
        );

        if (existing) {
          // Emotion is already active -> update intensity or resolve
          const prevIntensity = existing.intensity;
          let newIntensity = Math.max(0.0, Math.min(1.0, Number((prevIntensity + prop.intensityDelta).toFixed(3))));

          // If delta is 0 but a targetIntensity is explicitly provided
          if (prop.intensityDelta === 0 && prop.targetIntensity !== undefined) {
            newIntensity = prop.targetIntensity;
          }

          const transitionType =
            newIntensity === 0
              ? 'resolution'
              : newIntensity > prevIntensity
                ? 'reinforcement'
                : newIntensity < prevIntensity
                  ? 'reduction'
                  : 'persistence';

          const nextStatus: ActiveEmotionStatus =
            newIntensity === 0
              ? 'resolved'
              : existing.status === 'reappraised'
                ? 'reappraised'
                : 'active';

          existing.intensity = newIntensity;
          existing.lastUpdatedAt = timestamp;
          existing.status = nextStatus;
          existing.interpretation = appraisal.primaryInterpretation;
          if (appraisal.supportingEvidence?.length) {
            existing.supportingEvidence = Array.from(
              new Set([...existing.supportingEvidence, ...appraisal.supportingEvidence]),
            );
          }

          if (newIntensity === 0) {
            this.repo.resolveActiveEmotion(existing.id, prop.reason);
          } else {
            this.repo.saveActiveEmotion(existing);
          }

          const transition: ApeTransitionRecord = {
            id: crypto.randomUUID(),
            appraisalId: appraisal.id,
            eventId: event.id,
            emotionId: prop.emotionId,
            transitionType,
            previousIntensity: prevIntensity,
            newIntensity,
            reason: prop.reason,
            timestamp,
          };
          this.repo.recordTransition(transition);
          transitionsRecorded.push(transition);
        } else if (prop.targetIntensity > 0) {
          // Activate new emotional state
          const persistence: ActiveEmotionPersistence = taxonomyItem?.defaultPersistence || 'medium_term';
          const newActiveState: ActiveEmotionState = {
            id: crypto.randomUUID(),
            emotionId: prop.emotionId,
            intensity: Math.max(0.0, Math.min(1.0, prop.targetIntensity)),
            confidence: 0.9,
            activatedAt: timestamp,
            lastUpdatedAt: timestamp,
            durationMs: 0,
            persistence,
            triggerEventId: event.id,
            target: prop.target || 'creator',
            context: event.type,
            interpretation: appraisal.primaryInterpretation,
            supportingEvidence: appraisal.supportingEvidence || [],
            relatedMemoryIds: [],
            relatedEmotionIds: [],
            resolutionConditions: prop.resolutionConditions || [],
            status: 'active',
          };

          this.repo.saveActiveEmotion(newActiveState);
          activeEmotions.push(newActiveState);

          const transition: ApeTransitionRecord = {
            id: crypto.randomUUID(),
            appraisalId: appraisal.id,
            eventId: event.id,
            emotionId: prop.emotionId,
            transitionType: 'activation',
            previousIntensity: 0.0,
            newIntensity: newActiveState.intensity,
            reason: prop.reason,
            timestamp,
          };
          this.repo.recordTransition(transition);
          transitionsRecorded.push(transition);
        }
      }

    // 2. Save the appraisal
    this.repo.saveAppraisal(appraisal);

    // 3. Recompute PAD Dimensions & Contextual Measurements from active states
    const remainingActive = this.repo.getActiveEmotions();
    const newPad = this.computePadDimensions(remainingActive);
    const newContextual = this.computeContextualMeasurements(
      remainingActive,
      appraisal,
      event,
      currentState.contextual,
      relationship,
    );

    // 4. Determine Macro Mood Shift
    let newMood = currentState.currentMood;
    let moodConfidence = currentState.moodConfidence;
    if (appraisal.proposedMoodShift && this.moodsMap.has(appraisal.proposedMoodShift)) {
      newMood = appraisal.proposedMoodShift;
      moodConfidence = 0.88;
    }

    // 5. Commit updated state to persistent repository
    this.repo.updateAffectiveState(newPad, newContextual, newMood, moodConfidence);

    return this.repo.getAffectiveState();
  }

  public reappraiseEmotion(
    emotionId: string,
    eventId: string,
    newIntensity: number,
    newInterpretation: string,
    newEvidence: string[],
    reason: string,
  ): void {
    const timestamp = new Date().toISOString();
    const active = this.repo.getActiveEmotions();
    const target = active.find(
      (e: ActiveEmotionState) => e.emotionId === emotionId && e.status !== 'resolved',
    );
    if (!target) return;

    const prevIntensity = target.intensity;
    target.intensity = Math.max(0.0, Math.min(1.0, newIntensity));
    target.status = 'reappraised';
    target.interpretation = newInterpretation;
    target.supportingEvidence = Array.from(new Set([...target.supportingEvidence, ...newEvidence]));
    target.lastUpdatedAt = timestamp;

    this.repo.saveActiveEmotion(target);

    // Record non-destructive reappraisal transition
    this.repo.recordTransition({
      id: crypto.randomUUID(),
      eventId,
      emotionId,
      transitionType: 'reappraisal',
      previousIntensity: prevIntensity,
      newIntensity: target.intensity,
      reason,
      timestamp,
    });
  }

  /**
   * Computes PAD dimensions grounded in resting baseline:
   * Resting baseline: valence 0.0, arousal 0.0, dominance 0.70.
   * Active emotions are weighted by intensity and fused with the baseline.
   */
  private computePadDimensions(activeEmotions: ActiveEmotionState[]): CorePadDimensions {
    const restingBaseline: CorePadDimensions = {
      valence: 0.0,
      arousal: 0.0,
      dominance: 0.7,
    };

    if (activeEmotions.length === 0) {
      return restingBaseline;
    }

    const baselineWeight = 0.2;
    let weightedValenceSum = restingBaseline.valence * baselineWeight;
    let weightedArousalSum = restingBaseline.arousal * baselineWeight;
    let weightedDominanceSum = restingBaseline.dominance * baselineWeight;
    let totalWeight = baselineWeight;

    for (const em of activeEmotions) {
      const tax = this.emotionsMap.get(em.emotionId);
      if (!tax) continue;

      const weight = em.intensity;
      weightedValenceSum += tax.valenceBaseline * weight;
      weightedArousalSum += tax.arousalBaseline * weight;
      weightedDominanceSum += tax.dominanceBaseline * weight;
      totalWeight += weight;
    }

    return {
      valence: Math.max(-1.0, Math.min(1.0, Number((weightedValenceSum / totalWeight).toFixed(3)))),
      arousal: Math.max(0.0, Math.min(1.0, Number((weightedArousalSum / totalWeight).toFixed(3)))),
      dominance: Math.max(0.0, Math.min(1.0, Number((weightedDominanceSum / totalWeight).toFixed(3)))),
    };
  }

  /**
   * Computes truthful, defensible contextual measurements.
   * Priority: tension and cognitiveLoad are fully derived.
   * Others preserve status flags (provisional, unavailable) with clear provenance.
   */
  private computeContextualMeasurements(
    activeEmotions: ActiveEmotionState[],
    appraisal: ApeAppraisal,
    event: ApeEvent,
    current: ContextualAffectiveMeasurements,
    _relationship: ApeRelationshipConfig,
  ): ContextualAffectiveMeasurements {
    const now = new Date().toISOString();

    // 1. Tension Derivation (Appraisal Threat + Active Stress Emotions + Emotional Conflict)
    let stressSum = 0;
    let positiveCount = 0;
    let negativeCount = 0;

    for (const em of activeEmotions) {
      const tax = this.emotionsMap.get(em.emotionId);
      if (['irritation', 'frustration', 'anxiety', 'fear', 'hurt', 'anger'].includes(em.emotionId)) {
        stressSum += em.intensity;
      }
      if (tax) {
        if (tax.valenceBaseline > 0.2 && em.intensity > 0.3) positiveCount++;
        if (tax.valenceBaseline < -0.2 && em.intensity > 0.3) negativeCount++;
      }
    }

    // Coexisting conflicting emotions (e.g. love + anger) generate internal tension
    const emotionalConflictBonus = positiveCount > 0 && negativeCount > 0 ? 0.2 : 0.0;
    const textLower = String(event.payload?.text || '').toLowerCase();
    const interpersonalFriction =
      event.type.includes('criticism') ||
      event.type.includes('disagreement') ||
      appraisal.dimensions.socialMeaning.toLowerCase().includes('criticism') ||
      appraisal.dimensions.socialMeaning.toLowerCase().includes('disagreement') ||
      /criticiz|disagree|abrasive|stubborn|harsh/i.test(textLower)
        ? 0.2
        : 0.0;

    const derivedTension = Math.max(
      0.0,
      Math.min(
        1.0,
        Number(
          (0.1 + appraisal.dimensions.threat * 0.35 + stressSum * 0.2 + emotionalConflictBonus + interpersonalFriction).toFixed(2),
        ),
      ),
    );

    // 2. Cognitive Load Derivation (Task text complexity, analytical cues, concurrent emotions)
    const text = String(event.payload?.text || '');
    let textLoad = 0;
    if (text.length > 400) textLoad = 0.3;
    else if (text.length > 150) textLoad = 0.15;

    const hasAnalyticalCues = /analyze|calculate|code|logic|system|why|how|debug|architecture/i.test(text);
    const analyticalLoad = hasAnalyticalCues ? 0.2 : 0.0;
    const emotionConcurrencyLoad = activeEmotions.length > 3 ? 0.15 : 0.05;

    const derivedCognitiveLoad = Math.max(
      0.0,
      Math.min(1.0, Number((0.15 + textLoad + analyticalLoad + emotionConcurrencyLoad).toFixed(2))),
    );

    // Detailed metadata for truthful observability
    const details = {
      ...(current.details || {}),
      tension: {
        value: derivedTension,
        status: 'calculated' as const,
        confidence: 0.9,
        provenance: 'Derived from appraisal threat, active stress emotions, and emotional conflict',
        method: 'appraisal_conflict_derivation',
        lastCalculatedAt: now,
      },
      cognitiveLoad: {
        value: derivedCognitiveLoad,
        status: 'calculated' as const,
        confidence: 0.85,
        provenance: 'Derived from task complexity, analytical cues, and concurrent active emotional states',
        method: 'task_complexity_derivation',
        lastCalculatedAt: now,
      },
      emotionalOpenness: {
        value: current.emotionalOpenness ?? 0.7,
        status: 'provisional' as const,
        confidence: 0.5,
        provenance: 'Provisional estimate: awaiting longitudinal vulnerability tracking',
        method: 'provisional_baseline',
        lastCalculatedAt: now,
      },
      socialCloseness: {
        value: current.socialCloseness?.creator ?? 0.9,
        status: 'provisional' as const,
        confidence: 0.6,
        provenance: 'Provisional estimate: awaiting multi-session relationship integration',
        method: 'provisional_baseline',
        lastCalculatedAt: now,
      },
      socialSafety: {
        value: 0.0,
        status: 'unavailable' as const,
        confidence: 0.0,
        provenance: 'Unavailable in Phase 1: requires multi-session interpersonal trust and threat model',
        method: 'none',
        lastCalculatedAt: now,
      },
    };

    return {
      tension: derivedTension,
      cognitiveLoad: derivedCognitiveLoad,
      emotionalStability: current.emotionalStability ?? 0.85,
      perceivedControl: current.perceivedControl ?? 0.8,
      certainty: current.certainty ?? 0.75,
      socialCloseness: current.socialCloseness ?? { creator: 0.9 },
      socialSafety: 0.0, // Unavailable in Phase 1, truth over fake numbers
      goalAlignment: current.goalAlignment ?? 0.9,
      emotionalOpenness: current.emotionalOpenness ?? 0.7,
      psychologicalEnergy: current.psychologicalEnergy ?? 0.8,
      details,
    };
  }
}
