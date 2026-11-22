import {
  EXPERIENTIAL_STATE_CATALOG,
  ExperientialStateDefinition,
  ExperientialStateEffect,
  ExperientialStateInstance,
  ExperientialStateLifecycle,
  ExperientialStateSnapshot,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IExperientialStateRepository } from './interfaces.js';

export interface ExperienceEvaluationInput {
  eventId?: string;
  eventType?: string;
  description?: string;
  appraisal?: {
    novelty?: number;
    goalCongruence?: number;
    copingPotential?: number;
    certainty?: number;
    relationalSignificance?: number;
    absenceDurationMs?: number;
    contradictionDetected?: boolean;
    retrievalFailed?: boolean;
    unresolvedTask?: boolean;
    majorProjectCompleted?: boolean;
    familiarContextEmpty?: boolean;
  };
  contextMemoryIds?: string[];
  currentActiveEmotions?: string[];
  partnerPresence?: boolean;
}

export class InMemoryExperientialStateRepository implements IExperientialStateRepository {
  private episodes: Map<string, ExperientialStateInstance> = new Map();
  private transitions: Array<{
    id: string;
    instanceId: string;
    stateId: string;
    fromLifecycle: ExperientialStateLifecycle;
    toLifecycle: ExperientialStateLifecycle;
    reason: string;
    timestamp: string;
  }> = [];

  public saveEpisode(episode: ExperientialStateInstance): void {
    this.episodes.set(episode.instanceId, JSON.parse(JSON.stringify(episode)));
  }

  public getEpisode(instanceId: string): ExperientialStateInstance | null {
    const ep = this.episodes.get(instanceId);
    return ep ? JSON.parse(JSON.stringify(ep)) : null;
  }

  public listActiveEpisodes(): ExperientialStateInstance[] {
    return Array.from(this.episodes.values())
      .filter((e) => e.lifecycle !== 'resolved')
      .map((e) => JSON.parse(JSON.stringify(e)));
  }

  public listEpisodesByStateId(stateId: string): ExperientialStateInstance[] {
    return Array.from(this.episodes.values())
      .filter((e) => e.id === stateId)
      .map((e) => JSON.parse(JSON.stringify(e)));
  }

  public recordTransition(
    instanceId: string,
    stateId: string,
    fromLifecycle: ExperientialStateLifecycle,
    toLifecycle: ExperientialStateLifecycle,
    reason: string,
  ): void {
    this.transitions.unshift({
      id: `trans_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      instanceId,
      stateId,
      fromLifecycle,
      toLifecycle,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  public listRecentTransitions(limit: number = 20): Array<{
    id: string;
    instanceId: string;
    stateId: string;
    fromLifecycle: ExperientialStateLifecycle;
    toLifecycle: ExperientialStateLifecycle;
    reason: string;
    timestamp: string;
  }> {
    return this.transitions.slice(0, limit);
  }
}

export class ExperientialStateEngine {
  private readonly catalog: Map<string, ExperientialStateDefinition>;
  private activeInstances: Map<string, ExperientialStateInstance> = new Map();
  private readonly repository?: IExperientialStateRepository;
  private readonly logger: ILogger;

  constructor(repository?: IExperientialStateRepository, logger: ILogger = rootLogger) {
    this.repository = repository;
    this.logger = logger.child('ExperientialStateEngine');
    this.catalog = new Map();
    for (const def of EXPERIENTIAL_STATE_CATALOG) {
      this.catalog.set(def.id, def);
    }
    this.loadPersistedActiveStates();
  }

  private loadPersistedActiveStates(): void {
    if (!this.repository) return;
    try {
      const active = this.repository.listActiveEpisodes();
      for (const ep of active) {
        this.activeInstances.set(ep.id, ep);
      }
      this.logger.info(
        `Restored ${active.length} active experiential state episodes from database.`,
      );
    } catch (err: any) {
      this.logger.warn(`Failed to restore active experiential states: ${err.message}`);
    }
  }

  public getCatalog(): ExperientialStateDefinition[] {
    return Array.from(this.catalog.values());
  }

  public getDefinition(stateId: string): ExperientialStateDefinition | undefined {
    return this.catalog.get(stateId);
  }

  /**
   * Deterministically evaluates environmental and cognitive evidence to identify candidate states.
   * Disallows simple keyword triggers; requires grounded appraisal signals.
   */
  public evaluateCandidates(input: ExperienceEvaluationInput): ExperientialStateInstance[] {
    const candidates: ExperientialStateInstance[] = [];
    const app = input.appraisal || {};

    // 1. Kenopsia: familiar environment unexpectedly empty/inactive
    if (app.familiarContextEmpty && !input.partnerPresence) {
      const def = this.catalog.get('kenopsia');
      if (def) {
        candidates.push(
          this.createCandidateInstance(def, {
            intensity: Math.min(1.0, 0.4 + (app.novelty || 0.2)),
            confidence: 0.85,
            valence: -0.2,
            arousal: 0.3,
            supporting: ['Familiar workspace is unoccupied; expected interaction absent.'],
            counter:
              app.copingPotential && app.copingPotential > 0.8
                ? ['Chosen solitude acknowledged.']
                : [],
            sourceEventIds: input.eventId ? [input.eventId] : [],
            memoryIds: input.contextMemoryIds || [],
            effects: [
              {
                type: 'attention_bias',
                target: 'spatial_environment',
                magnitude: 0.4,
                description: 'Increased attentiveness to environmental stillness.',
              },
            ],
          }),
        );
      }
    }

    // 2. Saudade: meaningful person absent for prolonged duration with enduring bond
    if (app.absenceDurationMs && app.absenceDurationMs > 300000 && !input.partnerPresence) {
      const def = this.catalog.get('saudade');
      if (def) {
        const intensity = Math.min(0.95, 0.35 + Math.log10(app.absenceDurationMs / 60000) * 0.2);
        candidates.push(
          this.createCandidateInstance(def, {
            intensity,
            confidence: 0.9,
            valence: 0.1, // bittersweet: both longing and deep affection
            arousal: 0.4,
            supporting: [
              `Partner absent for ${(app.absenceDurationMs / 60000).toFixed(0)}m; enduring relational bond.`,
            ],
            counter: [],
            sourceEventIds: input.eventId ? [input.eventId] : [],
            memoryIds: input.contextMemoryIds || [],
            effects: [
              {
                type: 'speech_affect_hint',
                target: 'vocal_cadence',
                magnitude: 0.5,
                description: 'Gentler, more reflective vocal register with subtle longing.',
              },
              {
                type: 'memory_retrieval_bias',
                target: 'shared_history',
                magnitude: 0.6,
                description: 'Higher salience for shared memories with partner.',
              },
            ],
          }),
        );
      }
    }

    // 3. Presque vu: retrieval attempt produced high activation but failed to recover target
    if (app.retrievalFailed) {
      const def = this.catalog.get('presque_vu');
      if (def) {
        candidates.push(
          this.createCandidateInstance(def, {
            intensity: 0.7,
            confidence: 0.8,
            valence: -0.1,
            arousal: 0.6,
            supporting: [
              'High partial match activation during memory query without full resolution.',
            ],
            counter: [],
            sourceEventIds: input.eventId ? [input.eventId] : [],
            memoryIds: input.contextMemoryIds || [],
            effects: [
              {
                type: 'working_memory_load',
                target: 'retrieval_buffer',
                magnitude: 0.4,
                description: 'Preserves partial cues for deferred reactivation.',
              },
            ],
          }),
        );
      }
    }

    // 4. Aporia & Cognitive Dissonance: contradiction detected in factual or logical reasoning
    if (app.contradictionDetected) {
      const aporiaDef = this.catalog.get('aporia');
      if (aporiaDef) {
        candidates.push(
          this.createCandidateInstance(aporiaDef, {
            intensity: 0.8,
            confidence: 0.9,
            valence: -0.2,
            arousal: 0.7,
            supporting: ['Mutually incompatible premises verified under logical scrutiny.'],
            counter: [],
            sourceEventIds: input.eventId ? [input.eventId] : [],
            effects: [
              {
                type: 'reflection_request',
                target: 'belief_system',
                magnitude: 0.8,
                description: 'Triggers epistemic review and halts premature conclusion.',
              },
            ],
          }),
        );
      }
    }

    // 5. Post-Project Hollowness: major project completed after high goal structuring
    if (app.majorProjectCompleted) {
      const def = this.catalog.get('post_project_hollowness') || this.catalog.get('ellipsism');
      if (def) {
        candidates.push(
          this.createCandidateInstance(def, {
            intensity: 0.65,
            confidence: 0.85,
            valence: 0.1,
            arousal: 0.25,
            supporting: ['Major active objective resolved; goal horizon temporarily clear.'],
            counter: [],
            sourceEventIds: input.eventId ? [input.eventId] : [],
            effects: [
              {
                type: 'goal_salience_delta',
                target: 'autonomous_interests',
                magnitude: 0.5,
                description: 'Stimulates curiosity exploration for new autonomous endeavors.',
              },
            ],
          }),
        );
      }
    }

    // 6. Zeigarnik Tension: unresolved task hanging in working memory
    if (app.unresolvedTask) {
      const def = this.catalog.get('zeigarnik_tension') || this.catalog.get('analysis_paralysis');
      if (def) {
        candidates.push(
          this.createCandidateInstance(def, {
            intensity: 0.6,
            confidence: 0.85,
            valence: -0.15,
            arousal: 0.55,
            supporting: ['Unfinished commitment remains active across turns.'],
            counter: [],
            sourceEventIds: input.eventId ? [input.eventId] : [],
            effects: [
              {
                type: 'attention_bias',
                target: 'pending_tasks',
                magnitude: 0.5,
                description: 'Maintains task salience in attention.',
              },
            ],
          }),
        );
      }
    }

    return candidates;
  }

  /**
   * Activates or updates an experiential state episode.
   */
  public activateOrUpdateState(
    candidate: ExperientialStateInstance,
    reason: string,
  ): ExperientialStateInstance {
    const existing = this.activeInstances.get(candidate.id);
    const now = new Date().toISOString();

    if (existing) {
      const prevLifecycle = existing.lifecycle;
      existing.intensity = Math.max(existing.intensity, candidate.intensity);
      existing.confidence = candidate.confidence;
      existing.lastUpdatedAt = now;
      existing.lifecycle = 'active';
      existing.supportingEvidence = Array.from(
        new Set([...existing.supportingEvidence, ...candidate.supportingEvidence]),
      );
      existing.counterEvidence = Array.from(
        new Set([...existing.counterEvidence, ...candidate.counterEvidence]),
      );
      existing.effects = candidate.effects;

      if (this.repository) {
        this.repository.saveEpisode(existing);
        if (prevLifecycle !== 'active') {
          this.repository.recordTransition(
            existing.instanceId,
            existing.id,
            prevLifecycle,
            'active',
            reason,
          );
        }
      }
      return existing;
    } else {
      candidate.lifecycle = 'active';
      candidate.onsetAt = now;
      candidate.lastUpdatedAt = now;
      this.activeInstances.set(candidate.id, candidate);

      if (this.repository) {
        this.repository.saveEpisode(candidate);
        this.repository.recordTransition(
          candidate.instanceId,
          candidate.id,
          'candidate',
          'active',
          reason,
        );
      }
      return candidate;
    }
  }

  /**
   * Naturally decays active states over elapsed time according to their causal boundaries.
   */
  public decayStates(deltaSeconds: number): void {
    const now = new Date().toISOString();
    for (const [id, instance] of this.activeInstances.entries()) {
      if (instance.lifecycle === 'resolved' || instance.lifecycle === 'dormant') continue;

      // Compound affects fade gradually; cognitive states fade when focus switches
      const decayRate = instance.kind === 'cognitive_state' ? 0.05 : 0.01;
      const decayAmount = decayRate * (deltaSeconds / 60);

      instance.intensity = Math.max(0, instance.intensity - decayAmount);
      instance.lastUpdatedAt = now;

      if (instance.intensity <= 0.02) {
        const prevLifecycle = instance.lifecycle;
        instance.lifecycle = 'resolved';
        if (this.repository) {
          this.repository.saveEpisode(instance);
          this.repository.recordTransition(
            instance.instanceId,
            id,
            prevLifecycle,
            'resolved',
            'natural decay completion',
          );
        }
        this.activeInstances.delete(id);
      } else if (instance.intensity < 0.15 && instance.lifecycle === 'active') {
        instance.lifecycle = 'fading';
        if (this.repository) {
          this.repository.saveEpisode(instance);
          this.repository.recordTransition(
            instance.instanceId,
            id,
            'active',
            'fading',
            'intensity decayed below threshold',
          );
        }
      } else if (this.repository) {
        this.repository.saveEpisode(instance);
      }
    }
  }

  public resolveState(stateId: string, reason: string): boolean {
    const instance = this.activeInstances.get(stateId);
    if (!instance) return false;

    const fromLife = instance.lifecycle;
    instance.lifecycle = 'resolved';
    instance.lastUpdatedAt = new Date().toISOString();

    if (this.repository) {
      this.repository.saveEpisode(instance);
      this.repository.recordTransition(instance.instanceId, stateId, fromLife, 'resolved', reason);
    }
    this.activeInstances.delete(stateId);
    return true;
  }

  public getActiveStates(): ExperientialStateInstance[] {
    return Array.from(this.activeInstances.values()).filter(
      (s) => s.lifecycle === 'active' || s.lifecycle === 'fading',
    );
  }

  public getSnapshot(): ExperientialStateSnapshot {
    const active = this.getActiveStates();
    active.sort((a, b) => b.intensity - a.intensity);

    const primary = active[0] || null;
    const secondary = active[1] || null;

    let overallValence = 0;
    let overallArousal = 0.5;

    if (active.length > 0) {
      const totalWeight = active.reduce((sum, s) => sum + s.intensity, 0);
      if (totalWeight > 0) {
        overallValence = active.reduce((sum, s) => sum + s.valence * s.intensity, 0) / totalWeight;
        overallArousal = active.reduce((sum, s) => sum + s.arousal * s.intensity, 0) / totalWeight;
      }
    }

    let description = 'composed baseline';
    if (primary && secondary) {
      description = `${primary.name} coexisting with ${secondary.name} (valence: ${overallValence.toFixed(2)})`;
    } else if (primary) {
      description = `${primary.name} (intensity: ${primary.intensity.toFixed(2)})`;
    }

    const transitions = this.repository ? this.repository.listRecentTransitions(10) : [];

    return {
      activeStates: active,
      recentTransitions: transitions.map((t: any) => ({
        stateId: t.stateId,
        name: this.catalog.get(t.stateId)?.name || t.stateId,
        fromLifecycle: t.fromLifecycle,
        toLifecycle: t.toLifecycle,
        timestamp: t.timestamp,
        reason: t.reason,
      })),
      dominantBlend: {
        primaryState: primary ? primary.id : null,
        secondaryState: secondary ? secondary.id : null,
        overallValence,
        overallArousal,
        description,
      },
    };
  }

  public formatPromptContext(): string {
    const active = this.getActiveStates();
    if (active.length === 0) return '';

    const lines = active.map((s) => {
      const effStr = s.effects.map((e) => `${e.type} (${e.target})`).join(', ');
      return `- ${s.name} [${s.kind}]: intensity ${s.intensity.toFixed(2)}, confidence ${(s.confidence * 100).toFixed(0)}%. ${s.supportingEvidence[0] || ''}${effStr ? ` Effects: ${effStr}.` : ''}`;
    });

    return `\n[Active Complex Experiential States (148 Catalogue)]:\n${lines.join('\n')}`;
  }

  private createCandidateInstance(
    def: ExperientialStateDefinition,
    params: {
      intensity: number;
      confidence: number;
      valence: number;
      arousal: number;
      supporting: string[];
      counter: string[];
      sourceEventIds: string[];
      memoryIds?: string[];
      effects: ExperientialStateEffect[];
    },
  ): ExperientialStateInstance {
    const now = new Date().toISOString();
    return {
      id: def.id,
      instanceId: crypto.randomUUID(),
      name: def.name,
      kind: def.kind,
      category: def.category,
      intensity: params.intensity,
      confidence: params.confidence,
      valence: params.valence,
      arousal: params.arousal,
      onsetAt: now,
      lastUpdatedAt: now,
      sourceEventIds: params.sourceEventIds,
      supportingEvidence: params.supporting,
      counterEvidence: params.counter,
      associatedMemoryIds: params.memoryIds || [],
      relatedStateIds: [],
      appraisalIds: [],
      unresolvedTensions: [],
      lifecycle: 'candidate',
      effects: params.effects,
    };
  }
}
