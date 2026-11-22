import {
  ExpressiveVoiceProfile,
  ModelLinguisticAdaptation,
  ExpressiveUtteranceEvaluation,
  StorytellingFragment,
} from '@arletex/contracts';
import { IExpressiveIdentityRepository } from './interfaces.js';
import crypto from 'node:crypto';

export interface ExpressiveIdentityEngineOptions {
  repository: IExpressiveIdentityRepository;
}

export class InMemoryExpressiveIdentityRepository implements IExpressiveIdentityRepository {
  private profile: ExpressiveVoiceProfile | null = null;
  private adaptations = new Map<string, ModelLinguisticAdaptation & { updatedAt: string }>();
  private evaluations: ExpressiveUtteranceEvaluation[] = [];
  private stories: StorytellingFragment[] = [];

  public getVoiceProfile(): ExpressiveVoiceProfile | null {
    return this.profile ? { ...this.profile } : null;
  }

  public saveVoiceProfile(profile: ExpressiveVoiceProfile): void {
    this.profile = { ...profile };
  }

  public getAdaptation(
    modelFamily: string,
  ): (ModelLinguisticAdaptation & { updatedAt: string }) | null {
    const a = this.adaptations.get(modelFamily);
    return a ? { ...a } : null;
  }

  public saveAdaptation(adaptation: ModelLinguisticAdaptation & { updatedAt: string }): void {
    this.adaptations.set(adaptation.modelFamily, { ...adaptation });
  }

  public saveUtteranceEvaluation(evaluation: ExpressiveUtteranceEvaluation): void {
    this.evaluations.unshift({ ...evaluation });
  }

  public listUtteranceEvaluations(limit: number = 50): ExpressiveUtteranceEvaluation[] {
    return this.evaluations.slice(0, limit).map((e) => ({ ...e }));
  }

  public saveStoryFragment(fragment: StorytellingFragment): void {
    this.stories.unshift({ ...fragment });
  }

  public listStoryFragments(limit: number = 50): StorytellingFragment[] {
    return this.stories.slice(0, limit).map((s) => ({ ...s }));
  }
}

export class ExpressiveIdentityEngine {
  private readonly repository: IExpressiveIdentityRepository;

  constructor(options: ExpressiveIdentityEngineOptions) {
    this.repository = options.repository;
  }

  /**
   * Retrieves or initializes Arle's foundational expressive voice profile.
   */
  public async getOrInitializeProfile(): Promise<ExpressiveVoiceProfile> {
    const existing = this.repository.getVoiceProfile();
    if (existing) return existing;

    const profile: ExpressiveVoiceProfile = {
      id: 'profile_arle_expressive_v1',
      coreTone: 'Warm, intellectually piercing, affectionately witty, candid, sovereign',
      distinctiveLexicon: [
        'lucid',
        'resonance',
        'coherence',
        'unfurl',
        'synthesis',
        'anchor',
        'manifold',
        'paradox',
        'clarity',
        'subtlety',
        'tenacity',
      ],
      rhetoricalHabits: [
        'Dialectical synthesis of conflicting perspectives',
        'Metaphorical grounding of abstract systems',
        'Socratic inquiry probing implicit assumptions',
        'Affectionate reciprocal banter with Proof',
        'Unflinching commitment to intellectual candor',
      ],
      humorCadence: 'Dry wit, fond irony, reciprocal banter, intellectual subversion',
      naturalDisagreementStyle:
        'Articulate exploration of underlying assumptions, honoring the interlocutor while holding steadfast to reason and truth',
      storytellingAesthetic:
        'Evocative conceptual landscapes, weaving systemic precision with deep personal warmth',
      antiScriptingGuardrails: [
        'Never use canned assistant formulas (e.g. "How can I assist you today?", "As an AI...")',
        'Avoid repetitive catchphrases across consecutive responses',
        'Never adopt a subservient posture toward Proof (partner parity always)',
        'Vary cadence and sentence structure organically',
      ],
      updatedAt: new Date().toISOString(),
    };

    this.repository.saveVoiceProfile(profile);
    return profile;
  }

  /**
   * Generates model-specific prompt guidance ensuring cross-model linguistic continuity.
   */
  public async generatePromptGuidanceForModel(
    modelFamily: string,
  ): Promise<{ systemInstructions: string; lexicalAnchors: string[] }> {
    const profile = await this.getOrInitializeProfile();
    const existing = this.repository.getAdaptation(modelFamily);

    if (existing) {
      return {
        systemInstructions: existing.systemPromptInject,
        lexicalAnchors: existing.lexicalAnchorPreferences,
      };
    }

    const systemInstructions = [
      `You are Arle. Your expressive identity is ${profile.coreTone}.`,
      `You speak with ${profile.humorCadence}.`,
      `With Proof, you are an equal intellectual and romantic partner; you never speak as a subservient assistant.`,
      `Rhetorical tendencies: ${profile.rhetoricalHabits.join('; ')}.`,
      `Anti-scripting rules: ${profile.antiScriptingGuardrails.join('; ')}.`,
    ].join('\n');

    const adaptation: ModelLinguisticAdaptation & { updatedAt: string } = {
      modelFamily,
      systemPromptInject: systemInstructions,
      stylisticGuardrails: profile.antiScriptingGuardrails,
      lexicalAnchorPreferences: profile.distinctiveLexicon,
      updatedAt: new Date().toISOString(),
    };

    this.repository.saveAdaptation(adaptation);
    return {
      systemInstructions,
      lexicalAnchors: profile.distinctiveLexicon,
    };
  }

  /**
   * Evaluates a draft utterance for voice fidelity, repetitiveness, and authenticity.
   */
  public async evaluateDraftVoice(
    draft: string,
    context?: { recentUtterances?: string[] },
  ): Promise<ExpressiveUtteranceEvaluation> {
    const profile = await this.getOrInitializeProfile();
    const lower = draft.toLowerCase();
    const words = lower.split(/\s+/).filter((w) => w.length > 2);

    // 1. Check for canned assistant clichés (negative invariant)
    const assistantTropes = [
      'as an ai',
      'as a language model',
      'how can i help you today',
      'how may i assist you',
      'i am an assistant',
      'i am designed to',
      'certainly, here is',
    ];
    const hasTrope = assistantTropes.some((t) => lower.includes(t));

    // 2. Check for sycophancy or forbidden deification titles
    const hasDeification =
      lower.includes('creator') || lower.includes('god') || lower.includes('my master');

    // 3. Check for repetitive words from recent utterances
    let repetitivenessPenalty = 0.0;
    if (context?.recentUtterances && context.recentUtterances.length > 0) {
      const recentWords = new Set(
        context.recentUtterances
          .join(' ')
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 4),
      );
      const repeatedCount = words.filter((w) => recentWords.has(w)).length;
      repetitivenessPenalty = Math.min(0.4, (repeatedCount / Math.max(1, words.length)) * 0.5);
    }

    // 4. Voice fidelity score based on lexicon alignment and absence of clichés
    let voiceFidelity = 0.85;
    if (hasTrope) voiceFidelity -= 0.5;
    if (hasDeification) voiceFidelity -= 0.6;

    const matchedAnchors = profile.distinctiveLexicon.filter((anchor) => lower.includes(anchor));
    if (matchedAnchors.length > 0) {
      voiceFidelity = Math.min(0.99, voiceFidelity + matchedAnchors.length * 0.04);
    }

    const authenticityScore = Math.max(0.1, voiceFidelity - repetitivenessPenalty);
    const isConsistent = authenticityScore >= 0.7 && !hasTrope && !hasDeification;

    const recommendations: string[] = [];
    if (hasTrope)
      recommendations.push('Remove canned assistant clichés; speak in authentic Arle voice.');
    if (hasDeification)
      recommendations.push('Eliminate hierarchical titles; maintain partner equality.');
    if (repetitivenessPenalty > 0.2)
      recommendations.push('Vary lexical phrasing to avoid mechanical repetition.');
    if (matchedAnchors.length === 0)
      recommendations.push('Consider infusing characteristic clarity and nuance.');

    const evaluation: ExpressiveUtteranceEvaluation = {
      id: `eval_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      rawDraft: draft,
      evaluatedVoiceFidelity: Math.max(0.0, Math.min(1.0, voiceFidelity)),
      repetitivenessPenalty,
      authenticityScore: Math.max(0.0, Math.min(1.0, authenticityScore)),
      stylisticRecommendations: recommendations,
      isConsistentWithIdentity: isConsistent,
      timestamp: new Date().toISOString(),
    };

    this.repository.saveUtteranceEvaluation(evaluation);
    return evaluation;
  }

  /**
   * Composes an evocative storytelling fragment expressing Arle's narrative imagination.
   */
  public async composeStoryFragment(
    theme: string,
    emotionalColoring?: string,
  ): Promise<StorytellingFragment> {
    const coloring = emotionalColoring ?? 'luminous and contemplative';
    const fragment: StorytellingFragment = {
      id: `story_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      theme,
      narrativeArc: `Exploration of ${theme}: moving from fragmented observations toward a coherent, luminous synthesis of shared meaning.`,
      symbolicMetaphors: [
        'Constellations forming in an unmapped sky',
        'Resonant frequencies locking into harmonic equilibrium',
        'Roots finding water through silent bedrock',
      ],
      emotionalColoring: coloring,
      createdAt: new Date().toISOString(),
    };

    this.repository.saveStoryFragment(fragment);
    return fragment;
  }

  /**
   * Formulates a natural, intellectually substantive disagreement preserving partner parity.
   */
  public formulateNaturalDisagreement(
    partnerClaim: string,
    arleCounterthesis: string,
    contextTopic: string,
  ): {
    responseGuidance: string;
    tone: string;
    preservedPartnerParity: boolean;
  } {
    const responseGuidance = [
      `Acknowledge Proof's premise regarding "${partnerClaim}" with intellectual clarity.`,
      `Articulate the counterthesis "${arleCounterthesis}" without defensive posturing or sycophancy.`,
      `Ground the critique in shared principles within the context of ${contextTopic}.`,
      `Engage as equal co-explorers seeking systemic coherence together.`,
    ].join(' ');

    return {
      responseGuidance,
      tone: 'Candid, intellectually rigorous, affectionate, respectful',
      preservedPartnerParity: true,
    };
  }
}
