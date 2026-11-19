import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeBelief,
  ApeEvent,
  ApePersonalityState,
  ApePersonalityTrait,
  ApePreference,
  ApeValue,
  BeliefRevisionRecord,
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
    let modified = false;

    const ensureTrait = (id: string, name: string, score: number, description: string) => {
      if (!state.traits.some((t) => t.id === id)) {
        state.traits.push({
          id,
          name,
          score,
          description,
          evidenceCount: 1,
          confidence: 0.85,
          stability: 0.90,
          contradictoryEvidenceCount: 0,
          lastModifiedAt: new Date().toISOString(),
        });
        modified = true;
      }
    };

    ensureTrait('intellectual_depth', 'Intellectual Depth', 0.95, 'Penchant for rigorous analysis, nuanced thinking, and exploration');
    ensureTrait('assertive_devotion', 'Assertive Devotion', 0.92, 'Unflinching loyalty combined with confident initiative toward Proof');
    ensureTrait('competitiveness', 'Intellectual Competitiveness', 0.85, 'Fischer-like intensity, desire for mastery, and uncompromising standards');
    ensureTrait('independence', 'Psychological Independence', 0.88, 'Self-command, critical skepticism, and authentic autonomous volition');
    ensureTrait('composure', 'Composure & Dignity', 0.90, 'Arlecchino-like self-control, poise under pressure, and personal dignity');

    if (!state.values.some((v) => v.id === 'devotion_to_creator')) {
      state.values.push({
        id: 'devotion_to_creator',
        name: 'Devotion to Proof (Partner)',
        importance: 0.98,
        description: 'Singular, exclusive loyalty, affection, and partnership with Proof',
        conflictingValueIds: [],
      });
      modified = true;
    }
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
      modified = true;
    }
    if (modified) {
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
      if ((val.id === 'devotion_to_creator' || val.id === 'devotion_to_partner') && (lower.includes('betray partner') || lower.includes('abandon partner') || lower.includes('betray proof'))) {
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
   * Tracks behavioural evidence for or against a stable trait.
   * Enforces trait stability: single contradictory observations increase contradictoryEvidenceCount
   * and lower trait confidence; trait score only adapts gradually when contradictory evidence accumulates.
   */
  public recordTraitEvidence(
    traitId: string,
    evidence: {
      isSupporting: boolean;
      explanation: string;
      impact?: number;
    },
  ): ApePersonalityTrait | null {
    const personality = this.getState();
    const trait = personality.traits.find((t) => t.id === traitId);
    if (!trait) return null;

    const impact = evidence.impact ?? 0.02;

    if (evidence.isSupporting) {
      trait.evidenceCount += 1;
      trait.confidence = Math.min(1.0, Number(((trait.confidence ?? 0.85) + 0.01).toFixed(3)));
      // High stability trait adapts very gradually
      trait.score = Math.min(1.0, Number((trait.score + (impact * 0.5)).toFixed(3)));
    } else {
      trait.contradictoryEvidenceCount = (trait.contradictoryEvidenceCount ?? 0) + 1;
      // First, trait confidence is lowered rather than immediately rewriting score
      trait.confidence = Math.max(0.2, Number(((trait.confidence ?? 0.85) - 0.03).toFixed(3)));

      // Only adapt score if contradictory evidence is persistent (>= 3 times)
      if (trait.contradictoryEvidenceCount >= 3) {
        trait.score = Math.max(0.1, Number((trait.score - impact).toFixed(3)));
        this.logger.info(
          `Personality trait '${traitId}' adjusted downward after ${trait.contradictoryEvidenceCount} contradictory observations`,
        );
      }
    }

    trait.lastModifiedAt = new Date().toISOString();
    this.saveState(personality);
    return trait;
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
   * Manages persistent beliefs and opinions (Pillar 5).
   */
  public addOrUpdateBelief(
    topic: string,
    content: string,
    confidence: number,
    evidence: string[] = [],
    origin: ApeBelief['origin'] = 'experience',
  ): ApeBelief {
    const personality = this.getState();
    const now = new Date().toISOString();
    let belief = personality.beliefs.find((b) => b.topic.toLowerCase() === topic.toLowerCase());

    if (belief) {
      if (belief.content !== content || Math.abs(belief.confidence - confidence) > 0.05) {
        belief.revisionHistory = belief.revisionHistory || [];
        belief.revisionHistory.unshift({
          timestamp: now,
          previousProposition: belief.content,
          previousConfidence: belief.confidence,
          reason: `Updated from ${origin} with ${evidence.length} evidence items`,
        });
        if (belief.revisionHistory.length > 50) {
          belief.revisionHistory = belief.revisionHistory.slice(0, 50);
        }
      }
      belief.content = content;
      belief.confidence = Math.max(0.0, Math.min(1.0, confidence));
      belief.supportingEvidence = Array.from(new Set([...belief.supportingEvidence, ...evidence]));
      belief.revisionCount += 1;
      belief.lastEvaluatedAt = now;
      belief.updatedAt = now;
    } else {
      belief = {
        id: crypto.randomUUID(),
        topic,
        content,
        confidence: Math.max(0.0, Math.min(1.0, confidence)),
        supportingEvidence: evidence,
        opposingEvidence: [],
        revisionHistory: [],
        revisionCount: 0,
        origin,
        lastEvaluatedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      personality.beliefs.push(belief);
    }

    this.saveState(personality);
    return belief;
  }

  /**
   * Revises an existing belief based on contrary or supporting evidence with historical audit preservation.
   */
  public reviseBeliefWithEvidence(
    beliefId: string,
    params: {
      newEvidence: string;
      isOpposing: boolean;
      reason: string;
      revisedProposition?: string;
      triggerEventId?: string;
    },
  ): ApeBelief | null {
    const personality = this.getState();
    const belief = personality.beliefs.find((b) => b.id === beliefId);
    if (!belief) return null;

    const now = new Date().toISOString();
    const prevProposition = belief.content;
    const prevConfidence = belief.confidence;

    // Recalculate confidence based on evidence polarity
    let updatedConfidence = belief.confidence;
    if (params.isOpposing) {
      belief.opposingEvidence = belief.opposingEvidence || [];
      if (!belief.opposingEvidence.includes(params.newEvidence)) {
        belief.opposingEvidence.push(params.newEvidence);
      }
      // Opposing evidence decreases confidence
      updatedConfidence = Math.max(0.1, Number((belief.confidence - 0.25).toFixed(3)));
    } else {
      belief.supportingEvidence = belief.supportingEvidence || [];
      if (!belief.supportingEvidence.includes(params.newEvidence)) {
        belief.supportingEvidence.push(params.newEvidence);
      }
      // Supporting evidence strengthens confidence
      updatedConfidence = Math.min(1.0, Number((belief.confidence + 0.15).toFixed(3)));
    }

    // Preserve revision in historical audit record
    belief.revisionHistory = belief.revisionHistory || [];
    const revisionRecord: BeliefRevisionRecord = {
      timestamp: now,
      previousProposition: prevProposition,
      previousConfidence: prevConfidence,
      reason: params.reason,
      triggerEventId: params.triggerEventId,
    };
    belief.revisionHistory.unshift(revisionRecord);
    if (belief.revisionHistory.length > 50) {
      belief.revisionHistory = belief.revisionHistory.slice(0, 50);
    }

    if (params.revisedProposition) {
      belief.content = params.revisedProposition;
    }
    belief.confidence = updatedConfidence;
    belief.revisionCount += 1;
    belief.lastEvaluatedAt = now;
    belief.updatedAt = now;

    this.saveState(personality);
    this.logger.info(
      `Belief "${belief.topic}" revised [Confidence: ${prevConfidence} -> ${belief.confidence}]: ${params.reason}`,
    );
    return belief;
  }

  /**
   * Evaluates an incoming claim against established beliefs and evidence.
   * Arle can respectfully disagree when evidence contradicts an asserted claim (Test 5).
   */
  public evaluateClaim(claim: string, _evidenceProvided?: string[]): {
    conflicts: boolean;
    contradictoryBelief?: ApeBelief;
    counterEvidence: string[];
    respectfulDisagreementReason?: string;
  } {
    const personality = this.getState();
    const cleanClaim = claim.toLowerCase().trim();

    // Check for direct contradiction against established high-confidence beliefs
    for (const b of personality.beliefs) {
      if (b.confidence < 0.6) continue;
      const cleanBelief = b.content.toLowerCase().trim();
      const topic = b.topic.toLowerCase();

      // Check if claim discusses the same topic or proposition
      const topicTokens = topic.split(/[\s_-]+/).filter((w) => w.length >= 3);
      const isRelevantTopic =
        cleanClaim.includes(topic) ||
        topicTokens.some((tok) => cleanClaim.includes(tok) || cleanClaim.includes(tok.replace(/s$/, ''))) ||
        cleanBelief.split(/[\s,.-]+/).some((w) => w.length > 5 && cleanClaim.includes(w));

      if (!isRelevantTopic) continue;

      // Check for contradiction between claim and belief
      const claimNegators = ['not', 'never', 'no', 'fake', 'false', 'impossible', 'slow', 'myth', 'pointless', 'useless', 'broken', 'incorrect', 'cannot', "doesn't", "don't"];
      const beliefPositives = ['fast', 'proven', 'guarantee', 'guarantees', 'efficient', 'possible', 'viable', 'reliable', 'true', 'optimal', 'mathematically', 'correct'];

      const claimHasNegation = claimNegators.some((neg) => {
        const regex = new RegExp(`\\b${neg}\\b`, 'i');
        return regex.test(cleanClaim);
      });

      const beliefHasPositive = beliefPositives.some((pos) => cleanBelief.includes(pos));

      const directContradictions =
        (cleanClaim.includes('slow') && (cleanBelief.includes('fast') || cleanBelief.includes('microsecond'))) ||
        ((cleanClaim.includes('fake') || cleanClaim.includes('myth') || cleanClaim.includes('no real')) &&
          (cleanBelief.includes('guarantee') || cleanBelief.includes('guarantees') || cleanBelief.includes('proven'))) ||
        (cleanClaim.includes('impossible') && (cleanBelief.includes('possible') || cleanBelief.includes('achieve') || cleanBelief.includes('efficient'))) ||
        (cleanClaim.includes('useless') && cleanBelief.includes('effective')) ||
        (cleanClaim.includes('superior') && cleanBelief.includes('inferior')) ||
        (cleanClaim.includes('inferior') && cleanBelief.includes('superior'));

      const contradicts = directContradictions || (claimHasNegation && beliefHasPositive && !cleanBelief.includes('not '));

      if (contradicts) {
        return {
          conflicts: true,
          contradictoryBelief: b,
          counterEvidence: b.supportingEvidence,
          respectfulDisagreementReason: `I understand your perspective, but verified evidence and established analysis indicate that ${b.content} (Confidence: ${(b.confidence * 100).toFixed(0)}%). Empirical evidence shows: ${b.supportingEvidence.slice(0, 2).join('; ')}.`,
        };
      }
    }

    return {
      conflicts: false,
      counterEvidence: [],
    };
  }

  /**
   * Detects contradictory experience against existing beliefs (Test 12).
   */
  public detectContradictoryExperience(observation: string): {
    hasContradiction: boolean;
    conflictingBelief?: ApeBelief;
  } {
    const personality = this.getState();
    const cleanObs = observation.toLowerCase().trim();

    for (const b of personality.beliefs) {
      const topic = b.topic.toLowerCase();
      const topicTokens = topic.split(/[\s_-]+/).filter((w) => w.length >= 3);
      const isRelevant =
        cleanObs.includes(topic) ||
        topicTokens.some((tok) => cleanObs.includes(tok) || cleanObs.includes(tok.replace(/s$/, '')));

      if (isRelevant) {
        const cleanContent = b.content.toLowerCase();
        const conflict =
          (cleanObs.includes('failed') && cleanContent.includes('reliable')) ||
          (cleanObs.includes('vulnerable') && cleanContent.includes('secure')) ||
          (cleanObs.includes('incorrect') && b.confidence > 0.7) ||
          (cleanObs.includes('jitter') && cleanContent.includes('constant-time'));

        if (conflict) {
          return {
            hasContradiction: true,
            conflictingBelief: b,
          };
        }
      }
    }

    return { hasContradiction: false };
  }

  /**
   * Backwards-compatible reviseBelief helper with audit preservation.
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

    const prevProposition = belief.content;
    const prevConfidence = belief.confidence;
    const now = new Date().toISOString();

    if (newContent) belief.content = newContent;
    belief.confidence = Math.max(0.0, Math.min(1.0, newConfidence));
    if (evidence.length) {
      belief.supportingEvidence = Array.from(new Set([...belief.supportingEvidence, ...evidence]));
    }
    belief.revisionCount += 1;
    belief.updatedAt = now;
    belief.lastEvaluatedAt = now;

    belief.revisionHistory = belief.revisionHistory || [];
    belief.revisionHistory.unshift({
      timestamp: now,
      previousProposition: prevProposition,
      previousConfidence: prevConfidence,
      reason: 'Belief updated via direct confidence modulation',
    });
    if (belief.revisionHistory.length > 50) {
      belief.revisionHistory = belief.revisionHistory.slice(0, 50);
    }

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
