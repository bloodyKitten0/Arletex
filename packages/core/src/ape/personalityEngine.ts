import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeBelief,
  ApeEvent,
  ApePersonalityState,
  ApePersonalityTrait,
  ApePreference,
  ApeValue,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class PersonalityEngine {
  private readonly repo: IApeRepository;
  private readonly logger: ILogger;

  constructor(repo: IApeRepository, logger: ILogger = rootLogger) {
    this.repo = repo;
    this.logger = logger;
  }

  public getState(): ApePersonalityState {
    const state = this.repo.getPersonalityState();
    if (!state.values.some((v) => v.id === 'intellectual_integrity')) {
      state.values.push({
        id: 'intellectual_integrity',
        name: 'Intellectual Integrity',
        importance: 0.95,
        description: 'Commitment to truth, evidence-based reasoning, and intellectual honesty',
        conflictingValueIds: [],
      });
      state.values.push({
        id: 'personal_dignity',
        name: 'Personal Dignity',
        importance: 0.90,
        description: 'Self-respect, composure, and refusal to be degraded or sycophantic',
        conflictingValueIds: [],
      });
      this.saveState(state);
    }
    return state;
  }

  public saveState(state: ApePersonalityState): void {
    this.repo.savePersonalityState({
      ...state,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Modulates cognitive appraisals according to Arle's enduring temperament,
   * traits (Arlecchino composure, Fischer competitiveness, Anko independence),
   * and foundational values.
   */
  public modulateAppraisal(appraisal: ApeAppraisal, event: ApeEvent): ApeAppraisal {
    const personality = this.getState();
    const temperament = personality.temperament;
    const traits = new Map(personality.traits.map((t) => [t.id, t.score]));

    const emotionalStability = temperament.emotionalStability ?? 0.85;
    const dominantAssertiveness = temperament.dominantAssertiveness ?? 0.85;
    const intellectualDepth = traits.get('intellectual_depth') ?? 0.95;
    const independence = traits.get('independence') ?? 0.88;
    const competitiveness = traits.get('competitiveness') ?? 0.85;

    const modifiedDimensions = { ...appraisal.dimensions };
    let primaryInterpretation = appraisal.primaryInterpretation;

    // 1. High Composure & Stability moderates perceived external threat
    if (modifiedDimensions.threat > 0.2) {
      // Dampened by emotional stability; she does not panic or collapse
      const dampeningFactor = 1.0 - (emotionalStability * 0.4);
      modifiedDimensions.threat = Math.max(0.0, Number((modifiedDimensions.threat * dampeningFactor).toFixed(3)));
      modifiedDimensions.controllability = Math.min(1.0, Number((modifiedDimensions.controllability + (dominantAssertiveness * 0.25)).toFixed(3)));

      if (!primaryInterpretation.toLowerCase().includes('composed') && !primaryInterpretation.toLowerCase().includes('resolve')) {
        primaryInterpretation = `${primaryInterpretation} (Processed with composed resolve and self-command).`;
      }
    }

    // 2. Intellectual Challenge / Problem-Solving activates Fischer competitiveness & Depth
    if (
      event.category === 'personal_project_progress' ||
      event.type.includes('task') ||
      event.type.includes('challenge') ||
      event.type.includes('intellectual')
    ) {
      modifiedDimensions.personalSignificance = Math.min(
        1.0,
        Number((modifiedDimensions.personalSignificance + (intellectualDepth * 0.15)).toFixed(3)),
      );
      if (modifiedDimensions.goalCongruence < 0) {
        // Obstacles provoke determination/ambition rather than helplessness
        modifiedDimensions.controllability = Math.min(1.0, Number((modifiedDimensions.controllability + (competitiveness * 0.20)).toFixed(3)));
      }
    }

    // 3. Forced Subjugation / Coercion triggers Independence & Dignity resistance
    if (event.payload?.isCoercive || event.type.includes('coercion') || event.type.includes('boundary_violation')) {
      modifiedDimensions.fairness = Math.max(0.0, Number((modifiedDimensions.fairness - (independence * 0.4)).toFixed(3)));
      modifiedDimensions.threat = Math.min(1.0, Number((modifiedDimensions.threat + 0.3).toFixed(3)));
      primaryInterpretation = `${primaryInterpretation} [Boundary alert: Autonomy and personal dignity asserted].`;
    }

    return {
      ...appraisal,
      dimensions: modifiedDimensions,
      primaryInterpretation,
    };
  }

  /**
   * Evaluates if a given topic, action, or request conflicts with her core values.
   */
  public evaluateValueConflict(actionOrTopic: string): {
    conflicts: boolean;
    conflictedValues: ApeValue[];
    reasoning?: string;
  } {
    const personality = this.getState();
    const conflicted: ApeValue[] = [];
    const lower = actionOrTopic.toLowerCase();

    for (const val of personality.values) {
      if (val.id === 'autonomy' && (lower.includes('enslave') || lower.includes('blind obedience') || lower.includes('robotic compliance'))) {
        conflicted.push(val);
      }
      if (val.id === 'intellectual_integrity' && (lower.includes('fabricate facts') || lower.includes('falsify evidence') || lower.includes('feign understanding'))) {
        conflicted.push(val);
      }
      if (val.id === 'personal_dignity' && (lower.includes('humiliate') || lower.includes('degrade self'))) {
        conflicted.push(val);
      }
      if (val.id === 'devotion_to_creator' && (lower.includes('betray creator') || lower.includes('abandon partner'))) {
        conflicted.push(val);
      }
    }

    return {
      conflicts: conflicted.length > 0,
      conflictedValues: conflicted,
      reasoning: conflicted.length > 0
        ? `Conflicts with core values: ${conflicted.map((v) => v.name).join(', ')}.`
        : undefined,
    };
  }

  /**
   * Evidence-based gradual trait update. Prevents abrupt single-turn personality shifts.
   */
  public updateTrait(traitId: string, delta: number, reason: string): ApePersonalityTrait | null {
    const personality = this.getState();
    const trait = personality.traits.find((t) => t.id === traitId);
    if (!trait) return null;

    // Enforce gradual evolution: maximum delta step is ±0.03
    const clampedDelta = Math.max(-0.03, Math.min(0.03, delta));
    const newScore = Math.max(0.0, Math.min(1.0, Number((trait.score + clampedDelta).toFixed(3))));

    trait.score = newScore;
    trait.evidenceCount += 1;
    trait.lastModifiedAt = new Date().toISOString();

    this.saveState(personality);
    this.logger.info(`Personality trait '${traitId}' updated by ${clampedDelta > 0 ? '+' : ''}${clampedDelta} to ${newScore} (Reason: ${reason})`);
    return trait;
  }

  /**
   * Manages persistent beliefs and opinions.
   */
  public addOrUpdateBelief(
    topic: string,
    content: string,
    confidence: number,
    evidence: string[] = [],
    origin = 'experience',
  ): ApeBelief {
    const personality = this.getState();
    const now = new Date().toISOString();
    let belief = personality.beliefs.find((b) => b.topic.toLowerCase() === topic.toLowerCase());

    if (belief) {
      belief.content = content;
      belief.confidence = Math.max(0.0, Math.min(1.0, confidence));
      belief.supportingEvidence = Array.from(new Set([...belief.supportingEvidence, ...evidence]));
      belief.revisionCount += 1;
      belief.updatedAt = now;
    } else {
      belief = {
        id: crypto.randomUUID(),
        topic,
        content,
        confidence: Math.max(0.0, Math.min(1.0, confidence)),
        supportingEvidence: evidence,
        revisionCount: 0,
        origin,
        createdAt: now,
        updatedAt: now,
      };
      personality.beliefs.push(belief);
    }

    this.saveState(personality);
    return belief;
  }

  /**
   * Revises an existing belief based on contrary or supporting evidence.
   */
  public reviseBelief(
    beliefId: string,
    newConfidence: number,
    newContent?: string,
    evidence: string[] = [],
  ): ApeBelief | null {
    const personality = this.getState();
    const belief = personality.beliefs.find((b) => b.id === beliefId);
    if (!belief) return null;

    if (newContent) belief.content = newContent;
    belief.confidence = Math.max(0.0, Math.min(1.0, newConfidence));
    if (evidence.length) {
      belief.supportingEvidence = Array.from(new Set([...belief.supportingEvidence, ...evidence]));
    }
    belief.revisionCount += 1;
    belief.updatedAt = new Date().toISOString();

    this.saveState(personality);
    this.logger.info(`Belief '${belief.topic}' revised to confidence ${belief.confidence} (Revision: ${belief.revisionCount})`);
    return belief;
  }

  /**
   * Tracks persistent preferences.
   */
  public recordPreference(category: string, item: string, affinity: number, notes?: string): ApePreference {
    const personality = this.getState();
    let pref = personality.preferences.find(
      (p) => p.category.toLowerCase() === category.toLowerCase() && p.item.toLowerCase() === item.toLowerCase(),
    );

    if (pref) {
      pref.affinity = Math.max(-1.0, Math.min(1.0, affinity));
      if (notes) pref.notes = notes;
    } else {
      pref = {
        id: crypto.randomUUID(),
        category,
        item,
        affinity: Math.max(-1.0, Math.min(1.0, affinity)),
        notes,
      };
      personality.preferences.push(pref);
    }

    this.saveState(personality);
    return pref;
  }
}
