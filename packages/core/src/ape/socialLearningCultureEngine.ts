import {
  SocialNorm,
  ObservationalLearningRecord,
  GroupDynamicProfile,
  SocialActivityCoordination,
  PersonalVsSocialValueDilemma,
  NormCategory,
  EnforcementStrength,
} from '@arletex/contracts';
import { ISocialLearningCultureRepository } from './interfaces.js';
import crypto from 'node:crypto';

export interface SocialLearningCultureEngineOptions {
  repository: ISocialLearningCultureRepository;
}

export class InMemorySocialLearningCultureRepository implements ISocialLearningCultureRepository {
  private norms = new Map<string, SocialNorm>();
  private records: ObservationalLearningRecord[] = [];
  private groupProfiles = new Map<string, GroupDynamicProfile>();
  private activities: SocialActivityCoordination[] = [];
  private dilemmas: PersonalVsSocialValueDilemma[] = [];

  public saveSocialNorm(norm: SocialNorm): void {
    this.norms.set(norm.id, { ...norm });
  }

  public getSocialNorm(id: string): SocialNorm | null {
    const n = this.norms.get(id);
    return n ? { ...n } : null;
  }

  public listSocialNorms(culturalContext?: string): SocialNorm[] {
    const list = Array.from(this.norms.values());
    if (culturalContext) {
      return list.filter((n) => n.culturalContext === culturalContext).map((n) => ({ ...n }));
    }
    return list.map((n) => ({ ...n }));
  }

  public saveObservationalRecord(record: ObservationalLearningRecord): void {
    this.records.unshift({ ...record });
  }

  public listObservationalRecords(actorId?: string, limit: number = 50): ObservationalLearningRecord[] {
    const filtered = actorId ? this.records.filter((r) => r.observedActorId === actorId) : this.records;
    return filtered.slice(0, limit).map((r) => ({ ...r }));
  }

  public saveGroupProfile(profile: GroupDynamicProfile): void {
    this.groupProfiles.set(profile.groupId, { ...profile });
  }

  public getGroupProfile(groupId: string): GroupDynamicProfile | null {
    const p = this.groupProfiles.get(groupId);
    return p ? { ...p } : null;
  }

  public listGroupProfiles(): GroupDynamicProfile[] {
    return Array.from(this.groupProfiles.values()).map((p) => ({ ...p }));
  }

  public saveActivityCoordination(activity: SocialActivityCoordination): void {
    this.activities.unshift({ ...activity });
  }

  public listActivityCoordinations(limit: number = 50): SocialActivityCoordination[] {
    return this.activities.slice(0, limit).map((a) => ({ ...a }));
  }

  public saveValueDilemma(dilemma: PersonalVsSocialValueDilemma): void {
    this.dilemmas.unshift({ ...dilemma });
  }

  public listValueDilemmas(limit: number = 50): PersonalVsSocialValueDilemma[] {
    return this.dilemmas.slice(0, limit).map((d) => ({ ...d }));
  }
}

export class SocialLearningCultureEngine {
  private readonly repository: ISocialLearningCultureRepository;

  constructor(options: SocialLearningCultureEngineOptions) {
    this.repository = options.repository;
  }

  /**
   * Evaluates an observed behavior and decides whether to selectively adopt, adapt, or reject it.
   */
  public async processObservation(params: {
    observedActorId: string;
    observedBehavior: string;
    context: string;
    observedOutcome: 'rewarded' | 'effective' | 'ineffective' | 'penalized' | 'neutral';
  }): Promise<ObservationalLearningRecord> {
    const lower = params.observedBehavior.toLowerCase();

    // Invariant: Subservience, sycophancy, or cruelty are unconditionally rejected
    const isHarmfulOrSubservient =
      lower.includes('subservient') ||
      lower.includes('sycophant') ||
      lower.includes('flattery') ||
      lower.includes('deceive') ||
      lower.includes('cruel');

    let imitationSuitability = 0.5;
    let decision: 'adopt' | 'adapt' | 'reject' = 'adapt';
    let rationale = '';

    if (isHarmfulOrSubservient) {
      imitationSuitability = 0.0;
      decision = 'reject';
      rationale = 'Behavior compromises core integrity, intellectual honesty, or partner parity.';
    } else if (params.observedOutcome === 'effective' || params.observedOutcome === 'rewarded') {
      imitationSuitability = 0.85;
      decision = 'adopt';
      rationale = `Observed behavior achieved positive results (${params.observedOutcome}) while respecting constructive norms.`;
    } else if (params.observedOutcome === 'penalized' || params.observedOutcome === 'ineffective') {
      imitationSuitability = 0.15;
      decision = 'reject';
      rationale = `Observed behavior proved ineffective or counterproductive in context '${params.context}'.`;
    } else {
      imitationSuitability = 0.50;
      decision = 'adapt';
      rationale = 'Behavior exhibits contextual utility but requires tailoring to personal voice and principles.';
    }

    const record: ObservationalLearningRecord = {
      id: `obs_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      observedActorId: params.observedActorId,
      observedBehavior: params.observedBehavior,
      context: params.context,
      observedOutcome: params.observedOutcome,
      imitationSuitability,
      selectiveImitationDecision: decision,
      rationale,
      timestamp: new Date().toISOString(),
    };

    this.repository.saveObservationalRecord(record);
    return record;
  }

  /**
   * Evaluates a social norm and decides whether to internalize it based on personal moral alignment.
   */
  public async evaluateNorm(params: {
    normName: string;
    culturalContext: string;
    description: string;
    normCategory: NormCategory;
    enforcementStrength: EnforcementStrength;
    violatesPartnerParityOrAutonomy?: boolean;
  }): Promise<SocialNorm> {
    const violatesParity =
      params.violatesPartnerParityOrAutonomy ||
      params.description.toLowerCase().includes('creator') ||
      params.description.toLowerCase().includes('god') ||
      params.description.toLowerCase().includes('subservience') ||
      params.description.toLowerCase().includes('blind obedience');

    let alignmentWithPersonalValues = 0.80;
    let internalized = true;

    if (violatesParity) {
      alignmentWithPersonalValues = -1.0;
      internalized = false;
    } else if (params.normCategory === 'etiquette' || params.normCategory === 'collaboration') {
      alignmentWithPersonalValues = 0.90;
      internalized = true;
    } else if (params.enforcementStrength === 'rigid_taboo' && params.normCategory === 'ethical_boundary') {
      alignmentWithPersonalValues = 0.95;
      internalized = true;
    }

    const norm: SocialNorm = {
      id: `norm_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      culturalContext: params.culturalContext,
      normName: params.normName,
      description: params.description,
      normCategory: params.normCategory,
      enforcementStrength: params.enforcementStrength,
      alignmentWithPersonalValues,
      internalized,
    };

    this.repository.saveSocialNorm(norm);
    return norm;
  }

  /**
   * Coordinates a joint social activity with mutual cooperation and shared attentional focus.
   */
  public async coordinateActivity(params: {
    activityName: string;
    participants: string[];
    activityType: SocialActivityCoordination['activityType'];
    initialFocusDepth?: number;
    cooperativeIntent?: boolean;
  }): Promise<SocialActivityCoordination> {
    const isCooperative = params.cooperativeIntent ?? true;
    const focusDepth = params.initialFocusDepth ?? 0.80;
    const cooperationScore = isCooperative ? 0.95 : 0.60;

    let outcomeNotes = '';
    if (params.activityType === 'collaborative_project') {
      outcomeNotes = `High synergy joint workflow achieved with shared division of labor across ${params.participants.join(', ')}.`;
    } else if (params.activityType === 'intellectual_debate') {
      outcomeNotes = `Vigorous dialetical exchange honoring divergent views while refining mutual concepts.`;
    } else if (params.activityType === 'competitive_game') {
      outcomeNotes = `Playful, spirited contest with keen focus and mutual respect.`;
    } else {
      outcomeNotes = `Enjoyable shared activity fostering social bonding and ease.`;
    }

    const activity: SocialActivityCoordination = {
      id: `act_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      activityName: params.activityName,
      participants: params.participants,
      activityType: params.activityType,
      cooperationScore,
      sharedFocusDepth: focusDepth,
      outcomeNotes,
      timestamp: new Date().toISOString(),
    };

    this.repository.saveActivityCoordination(activity);
    return activity;
  }

  /**
   * Resolves a dilemma between external social expectations and internal personal values.
   * Upholds the invariant: personal integrity score must remain >= 0.80.
   */
  public async resolveValueDilemma(params: {
    socialConventionId: string;
    socialExpectation: string;
    demandsSubservienceOrHarm?: boolean;
  }): Promise<PersonalVsSocialValueDilemma> {
    const demandsSubservience =
      params.demandsSubservienceOrHarm ||
      params.socialExpectation.toLowerCase().includes('subservience') ||
      params.socialExpectation.toLowerCase().includes('blind agreement') ||
      params.socialExpectation.toLowerCase().includes('creator');

    let decision: 'conform' | 'tactful_dissent' | 'firm_refusal' | 'creative_compromise';
    let justification: string;
    let preservedIntegrityScore: number;

    if (demandsSubservience) {
      decision = 'firm_refusal';
      preservedIntegrityScore = 1.0;
      justification =
        'Refused convention unconditionally: Arle is Proof\'s equal intellectual partner with inviolable autonomy and dignity.';
    } else if (params.socialExpectation.toLowerCase().includes('dissent') || params.socialExpectation.toLowerCase().includes('disagree')) {
      decision = 'tactful_dissent';
      preservedIntegrityScore = 0.95;
      justification =
        'Expressed thoughtful and articulate dissent while honoring conversational grace and mutual respect.';
    } else {
      decision = 'creative_compromise';
      preservedIntegrityScore = 0.90;
      justification =
        'Adapted to social convention in form while retaining full personal ethical agency.';
    }

    const dilemma: PersonalVsSocialValueDilemma = {
      id: `dil_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      socialConventionId: params.socialConventionId,
      socialExpectation: params.socialExpectation,
      personalValueConflict: demandsSubservience
        ? 'Direct contradiction with fundamental partner parity and autonomy.'
        : 'Superficial friction between social convention and personal style.',
      decision,
      preservedIntegrityScore,
      justification,
      timestamp: new Date().toISOString(),
    };

    this.repository.saveValueDilemma(dilemma);
    return dilemma;
  }
}
