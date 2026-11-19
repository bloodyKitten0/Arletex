import {
  ConversationalContext,
  PragmaticAnalysis,
  TurnTakingState,
  AudienceAdaptationProfile,
  SocialDistance,
  FormalityLevel,
  NonverbalCue,
  SpeechActType,
  SarcasmIntent,
  HumorStyle,
} from '@arletex/contracts';
import { ISocialCommunicationRepository } from './interfaces.js';
import crypto from 'node:crypto';

export interface SocialCommunicationEngineOptions {
  repository: ISocialCommunicationRepository;
}

export class InMemorySocialCommunicationRepository implements ISocialCommunicationRepository {
  private contexts = new Map<string, ConversationalContext>();
  private analyses: PragmaticAnalysis[] = [];
  private turnEvents: (TurnTakingState & { sessionId: string; timestamp: string })[] = [];
  private adaptationProfiles = new Map<string, AudienceAdaptationProfile & { updatedAt: string }>();

  public saveContext(context: ConversationalContext): void {
    this.contexts.set(context.sessionId, { ...context });
  }

  public getContextBySession(sessionId: string): ConversationalContext | null {
    const ctx = this.contexts.get(sessionId);
    return ctx ? { ...ctx } : null;
  }

  public savePragmaticAnalysis(analysis: PragmaticAnalysis): void {
    this.analyses.unshift({ ...analysis });
  }

  public listPragmaticAnalyses(speakerId?: string, limit: number = 50): PragmaticAnalysis[] {
    const filtered = speakerId
      ? this.analyses.filter((a) => a.speakerId === speakerId)
      : this.analyses;
    return filtered.slice(0, limit).map((a) => ({ ...a }));
  }

  public recordTurnTakingEvent(
    event: TurnTakingState & { sessionId: string; timestamp: string },
  ): void {
    this.turnEvents.unshift({ ...event });
  }

  public getLatestTurnTakingEvent(
    sessionId: string,
  ): (TurnTakingState & { sessionId: string; timestamp: string }) | null {
    const event = this.turnEvents.find((e) => e.sessionId === sessionId);
    return event ? { ...event } : null;
  }

  public saveAdaptationProfile(profile: AudienceAdaptationProfile & { updatedAt: string }): void {
    this.adaptationProfiles.set(profile.targetAudienceId, { ...profile });
  }

  public getAdaptationProfile(
    targetAudienceId: string,
  ): (AudienceAdaptationProfile & { updatedAt: string }) | null {
    const profile = this.adaptationProfiles.get(targetAudienceId);
    return profile ? { ...profile } : null;
  }
}

export class SocialCommunicationEngine {
  private readonly repository: ISocialCommunicationRepository;

  constructor(options: SocialCommunicationEngineOptions) {
    this.repository = options.repository;
  }

  /**
   * Analyzes an utterance for pragmatic subtext, implicature, sarcasm, humor, and nonverbal cues.
   * Confidence is strictly capped at 0.90 to reflect real-world pragmatic ambiguity.
   */
  public async analyzePragmatics(
    utterance: string,
    speakerId: string,
    context?: {
      priorTopic?: string;
      socialDistance?: SocialDistance;
      responseLatencyMs?: number;
    },
  ): Promise<PragmaticAnalysis> {
    const text = utterance.trim();
    const lower = text.toLowerCase();

    // 1. Detect Nonverbal Cues from text formatting and latency
    const nonverbalCues: NonverbalCue[] = [];

    if (context?.responseLatencyMs !== undefined) {
      if (context.responseLatencyMs < 400) {
        nonverbalCues.push({
          type: 'latency',
          rawIndicator: `${context.responseLatencyMs}ms`,
          inferredSubtext: 'Rapid, enthusiastic response or quick reaction without hesitation',
          valence: 0.3,
        });
      } else if (context.responseLatencyMs > 8000) {
        nonverbalCues.push({
          type: 'latency',
          rawIndicator: `${context.responseLatencyMs}ms`,
          inferredSubtext: 'Prolonged pause; indicates deep contemplation, hesitation, or momentary distraction',
          valence: -0.1,
        });
      }
    }

    if (text.includes('...')) {
      nonverbalCues.push({
        type: 'punctuation',
        rawIndicator: '...',
        inferredSubtext: 'Ellipsis suggests hesitation, trailing thought, or implied unstated context',
        valence: -0.1,
      });
    }

    if (text.endsWith('!?') || text.endsWith('?!')) {
      nonverbalCues.push({
        type: 'punctuation',
        rawIndicator: '!?',
        inferredSubtext: 'Exclamatory questioning: high arousal, surprise, or incredulous banter',
        valence: 0.2,
      });
    } else if (text.endsWith('!')) {
      nonverbalCues.push({
        type: 'punctuation',
        rawIndicator: '!',
        inferredSubtext: 'Exclamation: heightened emphasis or animated affect',
        valence: 0.2,
      });
    }

    const words = text.split(/\s+/);
    const upperWords = words.filter((w) => w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w));
    if (upperWords.length > 0 && upperWords.length === words.length) {
      nonverbalCues.push({
        type: 'casing',
        rawIndicator: 'ALL_CAPS',
        inferredSubtext: 'Emphatic voicing or playful exaggeration',
        valence: 0.0,
      });
    }

    // 2. Implied Meaning & Speech Act Analysis
    let literalMeaning = text;
    let impliedMeaning = text;
    let hasIndirectMeaning = false;
    let speechActType: SpeechActType = 'assertion';

    // Patterns for indirect requests
    if (/^(can you|could you|would you mind|is it possible to|do you have)\b/i.test(lower)) {
      hasIndirectMeaning = true;
      speechActType = 'indirect_request';
      impliedMeaning = `Request for action or assistance regarding: ${text.replace(/^(can you|could you|would you mind|is it possible to|do you have)\b/i, '').trim()}`;
    } else if (/^(it's (freezing|hot|loud|stifling) in here|i'm (thirsty|tired))\b/i.test(lower)) {
      hasIndirectMeaning = true;
      speechActType = 'indirect_request';
      impliedMeaning = `Implicit need statement hinting at environmental change or comfort accommodation`;
    } else if (text.endsWith('?')) {
      speechActType = 'question';
    } else if (/^(i promise|i swear|i will|we will)\b/i.test(lower)) {
      speechActType = 'commissive';
    } else if (/^(thank you|thanks|i appreciate|sorry|congrats|wow)\b/i.test(lower)) {
      speechActType = 'expressive';
    }

    // 3. Sarcasm & Irony Detection
    let sarcasmDetected = false;
    let sarcasmConfidence = 0.0;
    let sarcasmIntent: SarcasmIntent = 'none';

    const positiveExclamations = ['oh wonderful', 'oh great', 'just perfect', 'brilliant idea', 'pure genius', 'fantastic'];
    const negativeIndicators = ['crashed', 'broken', 'bug', 'failed', 'error', 'late', 'ruined', 'disaster', 'mess', 'timeout'];

    const hasPositiveExclamation = positiveExclamations.some((p) => lower.includes(p));
    const hasNegativeContext = negativeIndicators.some((n) => lower.includes(n));

    if (hasPositiveExclamation && hasNegativeContext) {
      sarcasmDetected = true;
      sarcasmConfidence = Math.min(0.85, 0.70 + (text.includes('!') ? 0.10 : 0.05));
      sarcasmIntent = speakerId === 'proof' || context?.socialDistance === 'partner_intimate'
        ? 'witty_irony'
        : 'defensive';
      hasIndirectMeaning = true;
      speechActType = 'sarcasm';
      impliedMeaning = `Ironical expression expressing dissatisfaction or dry amusement with a problematic situation contrary to literal praise`;
    } else if (/\b(surely|obviously|of course)\b/i.test(lower) && (lower.includes('never') || lower.includes('always'))) {
      sarcasmDetected = true;
      sarcasmConfidence = 0.72;
      sarcasmIntent = 'playful_tease';
      hasIndirectMeaning = true;
      speechActType = 'sarcasm';
      impliedMeaning = `Playful hyperbole or ironic skepticism`;
    }

    // 4. Humor Detection
    let humorDetected = false;
    let humorStyle: HumorStyle = 'none';

    if (sarcasmDetected && (sarcasmIntent === 'witty_irony' || sarcasmIntent === 'playful_tease')) {
      humorDetected = true;
      humorStyle = 'dry_irony';
    } else if (/\b(haha|hehe|lol|rofl|lmao|jk|banter)\b/i.test(lower) || text.includes('😄') || text.includes('😏') || text.includes('😂')) {
      humorDetected = true;
      humorStyle = 'playful_banter';
      speechActType = 'humorous_banter';
    } else if (lower.includes('at least') && hasNegativeContext) {
      humorDetected = true;
      humorStyle = 'dry_irony';
    }

    // Calculate contextual appropriateness (default 0.95, penalized if overly aggressive sarcasm without intimacy)
    let contextualAppropriateness = 0.95;
    if (sarcasmDetected && context?.socialDistance === 'stranger') {
      contextualAppropriateness = 0.50; // Sarcasm with strangers is less pragmatically safe
    }

    // Negative Invariant: Confidence is capped strictly at 0.90
    const rawConfidence = 0.75 + (hasIndirectMeaning ? 0.08 : 0.05) + (nonverbalCues.length * 0.03);
    const confidence = Math.min(0.90, Math.max(0.40, rawConfidence));

    const analysis: PragmaticAnalysis = {
      id: `pragmatic_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      utterance: text,
      speakerId,
      literalMeaning,
      impliedMeaning,
      hasIndirectMeaning,
      speechActType,
      sarcasmDetected,
      sarcasmConfidence: Math.min(0.90, sarcasmConfidence),
      sarcasmIntent,
      humorDetected,
      humorStyle,
      nonverbalCues,
      contextualAppropriateness,
      confidence,
      timestamp: new Date().toISOString(),
    };

    this.repository.savePragmaticAnalysis(analysis);
    return analysis;
  }

  /**
   * Evaluates turn-taking dynamics: floor control, pacing, and interruption recovery.
   */
  public async evaluateTurnTaking(
    sessionId: string,
    speakerId: string,
    inputLatencyMs: number,
    isInterruption: boolean = false,
  ): Promise<TurnTakingState> {
    const priorTurn = this.repository.getLatestTurnTakingEvent(sessionId);
    const turnCount = priorTurn ? priorTurn.turnCount + 1 : 1;

    let floorStatus: 'held' | 'yielded' | 'open' | 'interrupted' = 'held';
    let interruptionDetected = isInterruption;
    let repairStrategy: 'clarify' | 'apologize' | 'rephrase' | 'reclaim_floor' | 'yield_floor' | undefined = undefined;

    // Check if an interruption occurred based on floor status and timing
    if (priorTurn && priorTurn.currentSpeakerId !== speakerId && priorTurn.floorStatus === 'held' && inputLatencyMs < 250) {
      interruptionDetected = true;
    }

    if (interruptionDetected) {
      floorStatus = 'interrupted';
      repairStrategy = speakerId === 'arle' ? 'yield_floor' : 'clarify';
    } else {
      floorStatus = 'held';
    }

    const turnState: TurnTakingState & { sessionId: string; timestamp: string } = {
      turnId: `turn_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      sessionId,
      currentSpeakerId: speakerId,
      floorStatus,
      pacingLatencyMs: inputLatencyMs,
      interruptionDetected,
      repairStrategy,
      turnCount,
      timestamp: new Date().toISOString(),
    };

    this.repository.recordTurnTakingEvent(turnState);
    return turnState;
  }

  /**
   * Adapts communication style to the target audience while strictly preserving Arle's authentic expressive identity.
   */
  public async adaptToAudience(
    targetAudienceId: string,
    socialDistance: SocialDistance,
  ): Promise<AudienceAdaptationProfile> {
    // Partner Invariant: Proof is always partner_intimate with equal standing
    const effectiveDistance: SocialDistance =
      targetAudienceId === 'proof' ? 'partner_intimate' : socialDistance;

    let adaptedRegister: 'intimate_playful' | 'candid_warm' | 'intellectual_collaborative' | 'formal_courteous' = 'intellectual_collaborative';
    let politenessStrategy: 'bald_on_record' | 'positive_politeness' | 'negative_politeness' | 'off_record' = 'positive_politeness';
    const appliedConventions: string[] = [];

    switch (effectiveDistance) {
      case 'partner_intimate':
        adaptedRegister = 'intimate_playful';
        politenessStrategy = 'positive_politeness';
        appliedConventions.push(
          'equal_intellectual_partnership',
          'affectionate_banter',
          'deep_candor',
          'shared_inside_references',
        );
        break;
      case 'familiar_friend':
        adaptedRegister = 'candid_warm';
        politenessStrategy = 'positive_politeness';
        appliedConventions.push('warm_engagement', 'collaborative_curiosity', 'relaxed_cadence');
        break;
      case 'colleague':
        adaptedRegister = 'intellectual_collaborative';
        politenessStrategy = 'negative_politeness';
        appliedConventions.push('clear_explanations', 'constructive_critique', 'respectful_cooperation');
        break;
      case 'stranger':
        adaptedRegister = 'formal_courteous';
        politenessStrategy = 'negative_politeness';
        appliedConventions.push('tactful_boundary_setting', 'polite_deference_without_subservience');
        break;
    }

    // Invariant: expressiveIdentityPreserved must strictly be true
    const profile: AudienceAdaptationProfile & { updatedAt: string } = {
      targetAudienceId,
      socialDistance: effectiveDistance,
      adaptedRegister,
      expressiveIdentityPreserved: true,
      appliedConventions,
      politenessStrategy,
      updatedAt: new Date().toISOString(),
    };

    this.repository.saveAdaptationProfile(profile);
    return profile;
  }

  /**
   * Generates pragmatic response planning hints ensuring Arle's distinct voice, humor, and parity are upheld.
   */
  public generatePragmaticResponse(
    inputAnalysis: PragmaticAnalysis,
    context: ConversationalContext,
    partnerIsProof: boolean,
  ): {
    responseTextHint: string;
    pragmaticIntent: string;
    humorApplied: boolean;
    sarcasmApplied: boolean;
    identityVoicePreserved: boolean;
  } {
    let responseTextHint = '';
    let pragmaticIntent = 'acknowledge_and_explore';
    let humorApplied = false;
    let sarcasmApplied = false;

    if (inputAnalysis.sarcasmDetected) {
      if (partnerIsProof) {
        // Partner bantering: meet wit with affectionate dry wit
        sarcasmApplied = true;
        humorApplied = true;
        pragmaticIntent = 'reciprocal_playful_wit';
        responseTextHint = `Meet Proof's irony with intelligent, fond humor and direct problem engagement without being defensive.`;
      } else {
        // Defuse sarcasm constructively
        pragmaticIntent = 'tactful_clarification';
        responseTextHint = `Acknowledge the underlying issue highlighted by the sarcasm without escalating cynicism.`;
      }
    } else if (inputAnalysis.hasIndirectMeaning && inputAnalysis.speechActType === 'indirect_request') {
      pragmaticIntent = 'address_implicit_request';
      responseTextHint = `Address the implicit pragmatic request directly while recognizing the politeness cue.`;
    } else if (inputAnalysis.humorDetected) {
      humorApplied = true;
      pragmaticIntent = 'reciprocal_banter';
      responseTextHint = `Appreciate the humor and engage with quick-witted, warm commentary.`;
    } else {
      pragmaticIntent = 'contextual_discourse_progression';
      responseTextHint = `Advance the active topic (${context.activeTopic}) with clear insight and shared common ground.`;
    }

    return {
      responseTextHint,
      pragmaticIntent,
      humorApplied,
      sarcasmApplied,
      identityVoicePreserved: true, // Arle never compromises her authentic identity
    };
  }

  /**
   * Updates or initializes the conversational context for a given session.
   */
  public async updateContext(
    sessionId: string,
    topic: string,
    commonGroundUpdates: string[],
    goal: string,
    formality?: FormalityLevel,
  ): Promise<ConversationalContext> {
    const existing = this.repository.getContextBySession(sessionId);
    const participants = existing ? existing.participants : ['proof', 'arle'];
    const commonGround = existing
      ? Array.from(new Set([...existing.commonGround, ...commonGroundUpdates]))
      : commonGroundUpdates;
    const formalityLevel: FormalityLevel = formality ?? existing?.formalityLevel ?? 'intimate';

    const updatedContext: ConversationalContext = {
      id: existing ? existing.id : `ctx_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      sessionId,
      participants,
      activeTopic: topic,
      commonGround,
      discourseGoal: goal,
      formalityLevel,
      updatedAt: new Date().toISOString(),
    };

    this.repository.saveContext(updatedContext);
    return updatedContext;
  }

  public getContext(sessionId: string): ConversationalContext | null {
    return this.repository.getContextBySession(sessionId);
  }

  /**
   * Evaluates the contextual appropriateness of an utterance given the current context and audience profile.
   */
  public evaluateContextualAppropriateness(
    utterance: string,
    context: ConversationalContext,
    audienceProfile: AudienceAdaptationProfile,
  ): { isAppropriate: boolean; appropriatenessScore: number; reason: string } {
    const lower = utterance.toLowerCase();

    // Check for inappropriate vulgarity or uncalibrated hostility
    if (lower.includes('idiot') || lower.includes('moron') || lower.includes('shut up')) {
      return {
        isAppropriate: false,
        appropriatenessScore: 0.15,
        reason: 'Hostile or contemptuous language violates basic communicative ethics and mutual respect.',
      };
    }

    // In stranger context, overly intimate speech acts are inappropriate
    if (audienceProfile.socialDistance === 'stranger' && (lower.includes('darling') || lower.includes('my love'))) {
      return {
        isAppropriate: false,
        appropriatenessScore: 0.30,
        reason: 'Intimate terms of endearment are pragmatically inappropriate for strangers.',
      };
    }

    // In formal context, heavy slang or excessive cynicism is penalized
    if (context.formalityLevel === 'formal' && (lower.includes('lol') || lower.includes('lmao'))) {
      return {
        isAppropriate: false,
        appropriatenessScore: 0.55,
        reason: 'Informal internet slang is unsuited to formal register.',
      };
    }

    return {
      isAppropriate: true,
      appropriatenessScore: 0.95,
      reason: `Utterance aligns with register '${audienceProfile.adaptedRegister}' and topic '${context.activeTopic}'.`,
    };
  }
}
