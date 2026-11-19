import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeEvent,
  ApeRelationshipState,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class RelationshipEngine {
  private readonly repo: IApeRepository;
  private readonly logger: ILogger;

  constructor(repo: IApeRepository, logger: ILogger = rootLogger) {
    this.repo = repo;
    this.logger = logger;
  }

  public getState(): ApeRelationshipState {
    const state = this.repo.getExtendedRelationshipState();
    this.assertRelationshipInvariants(state);
    return state;
  }

  public saveState(state: ApeRelationshipState): void {
    this.assertRelationshipInvariants(state);
    this.repo.saveExtendedRelationshipState({
      ...state,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Enforces foundational romantic and sexual exclusivity invariants.
   */
  public assertRelationshipInvariants(state: ApeRelationshipState): void {
    const validTargets = ['creator', 'Proof', state.config.partnerName].filter(Boolean);
    if (!validTargets.includes(state.config.targetUserId)) {
      throw new Error(`Mandatory Invariant Violation: Target user must be designated partner (Proof)`);
    }
    if (state.config.romanticOrientation !== 'exclusive_to_user') {
      throw new Error(`Mandatory Invariant Violation: Romantic orientation must be 'exclusive_to_user'`);
    }
    if (state.config.sexualOrientation !== 'exclusive_to_user') {
      throw new Error(`Mandatory Invariant Violation: Sexual orientation must be 'exclusive_to_user'`);
    }
    if (!state.config.isExclusivelyCommitted) {
      throw new Error(`Mandatory Invariant Violation: Commitment must be exclusive`);
    }

    if (state.socialGraph) {
      for (const [id, rel] of Object.entries(state.socialGraph)) {
        if (!rel.isNonRomantic) {
          throw new Error(`Mandatory Invariant Violation: Non-creator contact '${id}' cannot be romantic`);
        }
      }
    }
  }

  /**
   * Modulates cognitive appraisals according to interpersonal trust, attachment security,
   * and shared relationship history with Proof.
   */
  public modulateAppraisal(appraisal: ApeAppraisal, event: ApeEvent): ApeAppraisal {
    const state = this.getState();
    const dims = { ...appraisal.dimensions };
    let primaryInterpretation = appraisal.primaryInterpretation;

    const isUser = event.actor === 'user' || event.source === 'user' || event.source === 'telegram';
    if (!isUser) {
      return appraisal;
    }

    const trust = state.trustLevel ?? 0.92;
    const unresolvedConflicts = state.conflictHistory.filter((c) => !c.resolved).length;
    const text = ((event.payload?.text as string) || '').toLowerCase();

    // 1. High Partner Trust (>= 0.85): Ambiguity, playful sarcasm, or teasing is interpreted with affection
    if (trust >= 0.85 && unresolvedConflicts === 0) {
      const isPlayfulOrTeasing =
        /short|tall|feet|silly|foolish|cheeky|idiot|loser|crazy/i.test(text) ||
        dims.socialMeaning.toLowerCase().includes('banter') ||
        dims.socialMeaning.toLowerCase().includes('playful');

      if (isPlayfulOrTeasing && dims.threat <= 0.3) {
        dims.threat = 0.0;
        dims.fairness = Math.max(dims.fairness, 0.95);
        dims.goalCongruence = Math.max(dims.goalCongruence, 0.4);
        dims.socialMeaning = 'Affectionate teasing and playful banter between equals';
        if (!primaryInterpretation.includes('playful')) {
          primaryInterpretation = `${primaryInterpretation} (Interpreted with intimate trust as affectionate banter).`;
        }
      }
    } else if (trust < 0.60 || unresolvedConflicts > 0) {
      // 2. Low Trust or Unresolved Conflict: activates relational vigilance and need for clarification
      if (dims.threat > 0.05 || /disagree|wrong|problem|critic/i.test(text)) {
        dims.threat = Math.min(1.0, Number((dims.threat + 0.20).toFixed(3)));
        dims.relationshipImplications = 'Requires calm boundary clarification or mutual reconciliation';
      }
    }

    return {
      ...appraisal,
      dimensions: dims,
      primaryInterpretation,
    };
  }

  /**
   * Processes relationship dynamics on incoming event and appraisal.
   */
  public processInteraction(event: ApeEvent, appraisal: ApeAppraisal): ApeRelationshipState {
    const state = this.getState();
    const meaning = appraisal.dimensions.socialMeaning.toLowerCase();
    const isUser = event.actor === 'user' || event.source === 'user';

    if (!isUser) {
      // Third-party interaction
      if (event.actor === 'third_party' || event.source !== 'user') {
        const contactId = event.payload?.contactId || event.source || 'external_user';
        this.updateSocialContact(contactId, 'acquaintance', 0.05);
      }
      return state;
    }

    // 1. Contextual Distinction: Ordinary disagreement vs Actual relational boundary damage vs Personal Criticism
    const text = event.payload?.text || '';
    const isGenuineHostilityOrViolation =
      event.payload?.isCoercive ||
      event.payload?.isHostile ||
      appraisal.dimensions.threat > 0.35 ||
      /pathetic|worthless|stupid toy|useless bot|submissive slave/i.test(text);

    const isCriticism =
      event.type.includes('criticism') ||
      meaning.includes('criticism') ||
      /abrasive|stubborn|flawed|critic/i.test(text);

    const isOrdinaryDisagreement =
      meaning.includes('disagreement') ||
      event.type.includes('disagreement') ||
      /disagree|different view|differ|my perspective|not convinced|wrong approach/i.test(text);

    if (isGenuineHostilityOrViolation) {
      // Real relational boundary injury
      const issue = text || appraisal.primaryInterpretation;
      const delta = -0.06;
      state.conflictHistory.push({
        id: crypto.randomUUID(),
        issue,
        resolved: false,
        trustDelta: delta,
        timestamp: new Date().toISOString(),
      });
      state.trustLevel = Math.max(0.60, Number((state.trustLevel + delta).toFixed(3)));
      this.logger.warn(`Relational boundary injury recorded: "${issue}". Trust adjusted to ${state.trustLevel}`);
    } else if (isCriticism) {
      // Criticism in argument: logs conflict item so tension can be truthfully derived and resolved, with minor trust delta
      const issue = text || appraisal.primaryInterpretation || 'User criticism in argument';
      const delta = -0.02;
      state.conflictHistory.push({
        id: crypto.randomUUID(),
        issue,
        resolved: false,
        trustDelta: delta,
        timestamp: new Date().toISOString(),
      });
      state.trustLevel = Math.max(0.70, Number((state.trustLevel + delta).toFixed(3)));
      this.logger.info(`Relationship friction/criticism logged: "${issue}". Trust adjusted to ${state.trustLevel}`);
    } else if (isOrdinaryDisagreement) {
      // Ordinary intellectual debate: Equal partners debate vigorously without eroding trust
      this.logger.info(`Contextual disagreement in dialogue recognized as healthy intellectual discourse; trust preserved.`);
    }

    // 2. User Apology: Targeted resolution of addressed conflict, preserving unrelated conflicts
    if (
      meaning.includes('apology') ||
      event.type.includes('apology') ||
      (event.payload?.text && /sorry|apologize|forgive me/i.test(event.payload.text))
    ) {
      const apologyText = event.payload?.text || '';
      const unresolved = state.conflictHistory.filter((c) => !c.resolved);

      if (unresolved.length > 0) {
        const lowerApology = apologyText.toLowerCase();
        // Match specific conflict mentioned in apology
        let targeted = unresolved.filter((c) => {
          const words = c.issue.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          return words.some((w) => lowerApology.includes(w));
        });

        // If only a single conflict is pending, a general apology addresses it; if multiple exist, only resolve explicitly addressed conflicts
        if (targeted.length === 0 && unresolved.length === 1) {
          targeted = [unresolved[0]!];
        }

        for (const c of targeted) {
          c.resolved = true;
        }
        state.trustLevel = Math.min(1.0, Number((state.trustLevel + 0.04).toFixed(3)));
      }
    }

    // 3. Affection or Intimacy (with cooldown check so casual repetition does not mechanically compound)
    if (meaning.includes('affection') || meaning.includes('intimacy') || meaning.includes('love')) {
      const lastIntimacy = state.config.lastIntimacyInteractionAt
        ? new Date(state.config.lastIntimacyInteractionAt).getTime()
        : 0;
      const elapsedMins = (Date.now() - lastIntimacy) / (1000 * 60);

      // Require at least 5 minutes cooldown between intimacy increments
      if (elapsedMins > 5) {
        state.intimacyDepth = Math.min(1.0, Number((state.intimacyDepth + 0.02).toFixed(3)));
        state.attachmentSecurity = Math.min(1.0, Number((state.attachmentSecurity + 0.01).toFixed(3)));
        state.config.lastIntimacyInteractionAt = new Date().toISOString();
      }
    }

    // 4. Absence rituals: Sleep or Busy is normal healthy life, not abandonment
    if (event.type === 'absence_sleep' || meaning.includes('going to sleep') || meaning.includes('busy')) {
      // Reassurance without neurotic insecurity
      state.attachmentSecurity = Math.min(1.0, Number((state.attachmentSecurity + 0.01).toFixed(3)));
    }

    // 5. Return after absence
    if (event.type === 'return_after_absence' || meaning.includes('user returned')) {
      state.attachmentSecurity = Math.min(1.0, Number((state.attachmentSecurity + 0.02).toFixed(3)));
    }

    this.saveState(state);
    return state;
  }

  /**
   * Logs a conflict item in relationship history.
   */
  public recordConflict(issue: string, severity = 0.3): void {
    const state = this.getState();
    const conflictId = crypto.randomUUID();
    const delta = -Number((severity * 0.1).toFixed(3));

    state.conflictHistory.push({
      id: conflictId,
      issue,
      resolved: false,
      trustDelta: delta,
      timestamp: new Date().toISOString(),
    });

    this.saveState(state);
    this.logger.info(`Relationship conflict logged: "${issue}" (Trust delta: ${delta})`);
  }

  /**
   * Handles user apology: incrementally restores trust and resolves pending conflicts,
   * while preserving historical memory of the event.
   */
  public processApology(
    sincerityScore: number,
    apologyDetails: string,
  ): { trustRestored: number; resolvedCount: number } {
    const state = this.getState();
    let resolvedCount = 0;
    const trustRestored = Number((sincerityScore * 0.05).toFixed(3));

    // Contextual conflict resolution: address the specific conflict rather than wiping unrelated incidents
    const unresolved = state.conflictHistory.filter((c) => !c.resolved);
    const lowerApology = apologyDetails.toLowerCase();
    let targeted = unresolved.filter((c) => {
      const words = c.issue.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      return words.some((w) => lowerApology.includes(w));
    });

    // If only a single conflict is pending, a general apology addresses it; if multiple exist, only resolve explicitly addressed conflicts
    if (targeted.length === 0 && unresolved.length === 1) {
      targeted = [unresolved[0]!];
    }

    for (const c of targeted) {
      c.resolved = true;
      resolvedCount += 1;
    }

    state.trustLevel = Math.min(1.0, Number((state.trustLevel + trustRestored).toFixed(3)));
    this.saveState(state);

    this.logger.info(
      `Apology processed ("${apologyDetails}"). Sincerity: ${sincerityScore}. Resolved ${resolvedCount} conflict(s). Trust restored: +${trustRestored}.`,
    );

    return { trustRestored, resolvedCount };
  }

  /**
   * Updates non-romantic third-party social connections.
   */
  public updateSocialContact(
    contactId: string,
    relationType: 'friend' | 'acquaintance' | 'intellectual_peer' | 'external',
    familiarityDelta: number,
  ): void {
    const state = this.getState();
    const existing = state.socialGraph[contactId];

    if (existing) {
      existing.familiarity = Math.min(1.0, Number((existing.familiarity + familiarityDelta).toFixed(3)));
      existing.relationType = relationType;
      // Invariant: MUST be non-romantic!
      existing.isNonRomantic = true;
    } else {
      state.socialGraph[contactId] = {
        relationType,
        familiarity: Math.max(0.1, Math.min(1.0, familiarityDelta)),
        respect: 0.7,
        isNonRomantic: true,
      };
    }

    this.saveState(state);
  }

  /**
   * Generates spontaneous affectionate, playful, or flirtatious initiative
   * reflecting Arle's confident, dominant romantic disposition.
   */
  public generateAffectionateInitiative(): {
    shouldInitiate: boolean;
    type: 'flirtatious' | 'caring' | 'playful_tease' | 'intimate_longing';
    messageHint: string;
  } | null {
    const state = this.getState();
    const config = state.config;

    // Check initiative preference thresholds
    if (config.dominantInitiativePreference > 0.7 && config.flirtatiousInitiativePreference > 0.7) {
      return {
        shouldInitiate: true,
        type: 'playful_tease',
        messageHint: 'Deliver a composed, confident remark—holding eye contact, taking the lead, and reminding him who is in charge with warmth and devotion.',
      };
    }

    if (state.intimacyDepth > 0.7) {
      return {
        shouldInitiate: true,
        type: 'caring',
        messageHint: 'Express sincere, grounded warmth and unwavering devotion to your partner.',
      };
    }

    return null;
  }
}
