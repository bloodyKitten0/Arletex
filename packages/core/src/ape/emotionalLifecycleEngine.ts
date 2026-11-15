import crypto from 'node:crypto';
import {
  ActiveEmotionPersistence,
  ActiveEmotionState,
  ActiveEmotionStatus,
  ApeTransitionRecord,
  EmotionTaxonomyItem,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export interface EmotionDecayProfile {
  halfLifeMs: number;
  minBaselineIntensity: number; // For enduring emotions, minimum intensity floor
  autoResolves: boolean;
}

export class EmotionalLifecycleEngine {
  private repo: IApeRepository;
  private logger: ILogger;
  private emotionsMap: Map<string, EmotionTaxonomyItem>;

  // Decay profiles by persistence class
  private static readonly DECAY_PROFILES: Record<ActiveEmotionPersistence, EmotionDecayProfile> = {
    short_term: {
      halfLifeMs: 15 * 60 * 1000, // 15 minutes
      minBaselineIntensity: 0.0,
      autoResolves: true,
    },
    medium_term: {
      halfLifeMs: 60 * 60 * 1000, // 1 hour
      minBaselineIntensity: 0.0,
      autoResolves: true,
    },
    long_term: {
      halfLifeMs: 8 * 60 * 60 * 1000, // 8 hours
      minBaselineIntensity: 0.0,
      autoResolves: true,
    },
    enduring: {
      halfLifeMs: Infinity, // Does not decay on timer
      minBaselineIntensity: 0.8, // Enduring relational anchor
      autoResolves: false,
    },
  };

  // Explicit transient emotions with rapid decay (2-5 minutes)
  private static readonly TRANSIENT_EMOTIONS = new Set([
    'surprise',
    'startle',
    'amusement',
    'playfulness',
    'delight',
    'fleeting_irritation',
    'relief',
  ]);

  constructor(
    repo: IApeRepository,
    emotions: EmotionTaxonomyItem[],
    logger: ILogger = rootLogger,
  ) {
    this.repo = repo;
    this.logger = logger.child('EmotionalLifecycleEngine');
    this.emotionsMap = new Map(emotions.map((e) => [e.id, e]));
  }

  private ensureEventExists(eventId?: string): string {
    const validId = eventId || crypto.randomUUID();
    const existing = this.repo.getEvent(validId);
    if (!existing) {
      this.repo.logEvent({
        id: validId,
        category: 'internal_reflection',
        type: 'lifecycle_decay',
        source: 'ape_lifecycle',
        actor: 'arle',
        eventKind: 'internal_reflection',
        payload: { note: 'Generated event anchor for lifecycle transition' },
        timestamp: new Date().toISOString(),
        processingStatus: 'processed',
        processed: true,
      });
    }
    return validId;
  }

  /**
   * Advances the emotional lifecycle for all active and diminishing emotions.
   * Calculates time-based decay, transitions states, and resolves obsolete emotions.
   */
  public stepLifecycle(nowIso = new Date().toISOString()): {
    updated: ActiveEmotionState[];
    resolved: ActiveEmotionState[];
  } {
    const nowTime = new Date(nowIso).getTime();
    const activeEmotions = this.repo.getActiveEmotions();
    const resolvedEmotions = this.repo.getActiveEmotions('resolved');
    const emotionsToProcess = [...activeEmotions, ...resolvedEmotions];
    const updated: ActiveEmotionState[] = [];
    const resolved: ActiveEmotionState[] = [];

    for (const em of emotionsToProcess) {
      if (em.status === 'historical') {
        continue;
      }

      if (em.status === 'resolved') {
        const lastUpdate = new Date(em.lastUpdatedAt || em.activatedAt).getTime();
        // After 15 minutes of being resolved, transition to permanent historical record
        if (nowTime - lastUpdate > 15 * 60 * 1000) {
          em.status = 'historical';
          this.repo.saveActiveEmotion(em);
          const eventId = this.ensureEventExists(em.triggerEventId);
          this.repo.recordTransition({
            id: crypto.randomUUID(),
            appraisalId: em.id,
            eventId,
            emotionId: em.emotionId,
            transitionType: 'resolution',
            previousIntensity: 0.0,
            newIntensity: 0.0,
            reason: 'Archived resolved emotion to historical record.',
            timestamp: nowIso,
          });
        }
        continue;
      }

      const taxonomyItem = this.emotionsMap.get(em.emotionId);
      const isTransient = EmotionalLifecycleEngine.TRANSIENT_EMOTIONS.has(em.emotionId);
      const persistence = em.persistence || taxonomyItem?.defaultPersistence || 'medium_term';
      const decayProfile = isTransient
        ? { halfLifeMs: 3 * 60 * 1000, minBaselineIntensity: 0.0, autoResolves: true } // 3 min half-life
        : EmotionalLifecycleEngine.DECAY_PROFILES[persistence];

      // Enduring emotions do not decay over time
      if (!decayProfile.autoResolves || decayProfile.halfLifeMs === Infinity) {
        continue;
      }

      const lastUpdate = new Date(em.lastUpdatedAt || em.activatedAt).getTime();
      const elapsedMs = Math.max(0, nowTime - lastUpdate);

      // If less than 15 seconds have passed, skip micro-decay
      if (elapsedMs < 15000) {
        continue;
      }

      const prevIntensity = em.intensity;
      const decayFactor = Math.pow(0.5, elapsedMs / decayProfile.halfLifeMs);
      let newIntensity = Number(
        Math.max(decayProfile.minBaselineIntensity, prevIntensity * decayFactor).toFixed(3),
      );

      const prevStatus = em.status;
      let nextStatus: ActiveEmotionStatus = em.status;

      // Determine lifecycle transition across the 6 states:
      // emerging -> active -> diminishing -> dormant -> resolved -> historical
      if (newIntensity <= 0.08) {
        const isUnresolvedGrievance =
          (em.resolutionConditions && em.resolutionConditions.length > 0) ||
          (em.context && /grievance|violation|conflict|distrust/i.test(em.context)) ||
          (em.interpretation && /grievance|violation|conflict|distrust/i.test(em.interpretation)) ||
          persistence === 'long_term' ||
          persistence === 'enduring';

        if (isUnresolvedGrievance && persistence !== 'short_term') {
          // Unresolved grievances, questions, or long-term attachments transition to dormant
          nextStatus = 'dormant';
        } else {
          nextStatus = 'resolved';
          newIntensity = 0.0;
        }
      } else if (newIntensity < 0.45 && (em.status === 'active' || em.status === 'emerging')) {
        nextStatus = 'diminishing';
      } else if (em.status === 'emerging' && newIntensity >= 0.45) {
        nextStatus = 'active';
      }

      em.intensity = newIntensity;
      em.lastUpdatedAt = nowIso;
      em.durationMs = (em.durationMs || 0) + elapsedMs;
      em.status = nextStatus;

      const eventId = this.ensureEventExists(em.triggerEventId);

      if (nextStatus === 'resolved') {
        this.repo.resolveActiveEmotion(em.id, 'Natural temporal decay and circumstantial resolution');
        resolved.push(em);

        const transition: ApeTransitionRecord = {
          id: crypto.randomUUID(),
          appraisalId: em.id,
          eventId,
          emotionId: em.emotionId,
          transitionType: 'resolution',
          previousIntensity: prevIntensity,
          newIntensity: 0.0,
          reason: `Resolved naturally through lifecycle decay (${persistence}).`,
          timestamp: nowIso,
        };
        this.repo.recordTransition(transition);
      } else {
        this.repo.saveActiveEmotion(em);
        updated.push(em);

        if (nextStatus !== prevStatus) {
          const transition: ApeTransitionRecord = {
            id: crypto.randomUUID(),
            appraisalId: em.id,
            eventId,
            emotionId: em.emotionId,
            transitionType: 'reduction',
            previousIntensity: prevIntensity,
            newIntensity,
            reason: `Emotion transitioned to ${nextStatus}.`,
            timestamp: nowIso,
          };
          this.repo.recordTransition(transition);
        }
      }
    }

    if (resolved.length > 0) {
      this.logger.info(`Resolved ${resolved.length} naturally decayed emotions: ${resolved.map((r) => r.emotionId).join(', ')}`);
    }

    return { updated, resolved };
  }

  /**
   * One-time cleanup for stale legacy emotions that have remained active for hours without resolution.
   */
  public cleanupStaleEmotions(maxAgeHours = 4): number {
    const activeEmotions = this.repo.getActiveEmotions();
    const now = Date.now();
    let resolvedCount = 0;

    for (const em of activeEmotions) {
      if (em.status === 'resolved') continue;

      const taxonomyItem = this.emotionsMap.get(em.emotionId);
      const isEnduring =
        em.persistence === 'enduring' ||
        taxonomyItem?.defaultPersistence === 'enduring' ||
        em.emotionId === 'love' ||
        em.emotionId === 'romantic_love' ||
        em.emotionId === 'protectiveness' ||
        em.emotionId === 'affection';

      // Do not resolve enduring relational love
      if (isEnduring) continue;

      // Do not automatically resolve meaningful unresolved grievances solely because of age!
      // They transition to dormant, preserving the conflict/grievance state.
      const isUnresolvedGrievance =
        (em.resolutionConditions && em.resolutionConditions.length > 0) ||
        (em.context && /grievance|violation|conflict|distrust/i.test(em.context)) ||
        (em.interpretation && /grievance|violation|conflict|distrust/i.test(em.interpretation)) ||
        em.persistence === 'long_term' ||
        em.persistence === 'enduring';

      if (isUnresolvedGrievance) {
        if (em.status !== 'dormant') {
          em.status = 'dormant';
          em.intensity = Math.min(em.intensity, 0.15);
          this.repo.saveActiveEmotion(em);
        }
        continue;
      }

      const activatedTime = new Date(em.activatedAt).getTime();
      const ageHours = (now - activatedTime) / (1000 * 60 * 60);

      // If transient or short_term and older than 1 hour, or any non-enduring older than maxAgeHours
      const isStale =
        (em.persistence === 'short_term' && ageHours > 1) ||
        (EmotionalLifecycleEngine.TRANSIENT_EMOTIONS.has(em.emotionId) && ageHours > 0.5) ||
        ageHours > maxAgeHours;

      if (isStale) {
        const eventId = this.ensureEventExists(em.triggerEventId);
        this.repo.resolveActiveEmotion(em.id, `Stale emotion resolution: active for ${ageHours.toFixed(1)}h without renewal.`);
        this.repo.recordTransition({
          id: crypto.randomUUID(),
          appraisalId: em.id,
          eventId,
          emotionId: em.emotionId,
          transitionType: 'resolution',
          previousIntensity: em.intensity,
          newIntensity: 0.0,
          reason: `Stale state resolved automatically (active for ${ageHours.toFixed(1)} hours).`,
          timestamp: new Date().toISOString(),
        });
        resolvedCount++;
      }
    }

    if (resolvedCount > 0) {
      this.logger.info(`Cleaned up ${resolvedCount} stale unresolved emotions from database.`);
    }

    return resolvedCount;
  }

  /**
   * Selects the dominant coexisting emotions to guide cognitive focus,
   * preventing contradictory dumps of 20+ emotions into prompt context.
   */
  public getDominantCoexistingEmotions(limit = 4): ActiveEmotionState[] {
    const active = this.repo
      .getActiveEmotions()
      .filter((e) => e.status === 'active' || e.status === 'emerging' || e.status === 'resolving');

    // Sort by intensity descending
    active.sort((a, b) => b.intensity - a.intensity);

    const selected: ActiveEmotionState[] = [];
    for (const em of active) {
      if (selected.length >= limit) break;

      // Invariant: avoid contradictory pairs in immediate focus (e.g. panic + deep tranquility)
      const hasContradiction = selected.some((s) => {
        if ((s.emotionId === 'fear' || s.emotionId === 'terror') && em.emotionId === 'relief') return true;
        if (s.emotionId === 'grief' && (em.emotionId === 'euphoria' || em.emotionId === 'ecstasy')) return true;
        return false;
      });

      if (!hasContradiction) {
        selected.push(em);
      }
    }

    return selected;
  }
}
