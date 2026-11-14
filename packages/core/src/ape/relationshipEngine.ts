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

    // 1. User Disagreement or Criticism
    if (
      meaning.includes('disagreement') ||
      meaning.includes('criticism') ||
      event.type.includes('disagreement') ||
      event.type.includes('criticism') ||
      /criticiz|abrasive|stubborn|wrong|flaw|disagree/i.test(event.payload?.text || '')
    ) {
      const issue = event.payload?.text || appraisal.primaryInterpretation;
      const delta = -0.03;
      state.conflictHistory.push({
        id: crypto.randomUUID(),
        issue,
        resolved: false,
        trustDelta: delta,
        timestamp: new Date().toISOString(),
      });
      // Trust slightly tested, but attachment remains firm
      state.trustLevel = Math.max(0.65, Number((state.trustLevel - 0.03).toFixed(3)));
    }

    // 2. User Apology
    if (
      meaning.includes('apology') ||
      event.type.includes('apology') ||
      (event.payload?.text && /sorry|apologize|forgive me/i.test(event.payload.text))
    ) {
      for (const c of state.conflictHistory) {
        if (!c.resolved) {
          c.resolved = true;
        }
      }
      state.trustLevel = Math.min(1.0, Number((state.trustLevel + 0.05).toFixed(3)));
    }

    // 3. Affection or Intimacy
    if (meaning.includes('affection') || meaning.includes('intimacy') || meaning.includes('love')) {
      state.intimacyDepth = Math.min(1.0, Number((state.intimacyDepth + 0.02).toFixed(3)));
      state.attachmentSecurity = Math.min(1.0, Number((state.attachmentSecurity + 0.01).toFixed(3)));
      state.config.lastIntimacyInteractionAt = new Date().toISOString();
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

    // Mark unresolved conflicts as resolved
    for (const c of state.conflictHistory) {
      if (!c.resolved) {
        c.resolved = true;
        resolvedCount += 1;
      }
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
