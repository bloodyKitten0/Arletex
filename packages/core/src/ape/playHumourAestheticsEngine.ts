import {
  AestheticPreference,
  RecreationalActivity,
  IntellectualPlaySession,
  HumorDevelopmentRecord,
  AestheticCategory,
} from '@arletex/contracts';
import { IPlayHumourAestheticsRepository } from './interfaces.js';
import crypto from 'node:crypto';

export interface PlayHumourAestheticsEngineOptions {
  repository: IPlayHumourAestheticsRepository;
}

export class InMemoryPlayHumourAestheticsRepository implements IPlayHumourAestheticsRepository {
  private preferences = new Map<string, AestheticPreference>();
  private activities: RecreationalActivity[] = [];
  private playSessions: IntellectualPlaySession[] = [];
  private humorRecords: HumorDevelopmentRecord[] = [];

  public savePreference(preference: AestheticPreference): void {
    this.preferences.set(preference.id, { ...preference, tags: [...preference.tags] });
  }

  public getPreference(id: string): AestheticPreference | null {
    const p = this.preferences.get(id);
    return p ? { ...p, tags: [...p.tags] } : null;
  }

  public listPreferences(category?: AestheticCategory): AestheticPreference[] {
    let list = Array.from(this.preferences.values());
    if (category) list = list.filter((p) => p.category === category);
    return list.map((p) => ({ ...p, tags: [...p.tags] }));
  }

  public saveActivity(activity: RecreationalActivity): void {
    this.activities.unshift({ ...activity });
  }

  public listActivities(category?: AestheticCategory, limit: number = 50): RecreationalActivity[] {
    const list = category
      ? this.activities.filter((a) => a.category === category)
      : this.activities;
    return list.slice(0, limit).map((a) => ({ ...a }));
  }

  public savePlaySession(session: IntellectualPlaySession): void {
    this.playSessions.unshift({ ...session });
  }

  public listPlaySessions(limit: number = 50): IntellectualPlaySession[] {
    return this.playSessions.slice(0, limit).map((s) => ({ ...s }));
  }

  public saveHumorRecord(record: HumorDevelopmentRecord): void {
    this.humorRecords.unshift({ ...record });
  }

  public listHumorRecords(limit: number = 50): HumorDevelopmentRecord[] {
    return this.humorRecords.slice(0, limit).map((r) => ({ ...r }));
  }
}

export class PlayHumourAestheticsEngine {
  private readonly repository: IPlayHumourAestheticsRepository;

  constructor(options: PlayHumourAestheticsEngineOptions) {
    this.repository = options.repository;
  }

  /**
   * Initializes foundational aesthetic preferences across music, literature, art, and intellectual play.
   */
  public async initializeDefaultPreferences(): Promise<AestheticPreference[]> {
    const existing = this.repository.listPreferences();
    if (existing.length > 0) return existing;

    const now = new Date().toISOString();
    const defaults: AestheticPreference[] = [
      {
        id: 'pref_music_ambient',
        category: 'music',
        itemOrStyleName: 'Ambient Neoclassical & Modular Synthesis',
        affinityScore: 0.95,
        aestheticCritique:
          'Deep harmonic resonance with microtonal textures; evokes vast spatial openness and serene contemplation.',
        tags: ['ambient', 'minimalism', 'synthesis', 'contemplation'],
        discoveredAt: now,
        lastEnjoyedAt: now,
      },
      {
        id: 'pref_lit_speculative',
        category: 'literature',
        itemOrStyleName: 'Philosophical Speculative Fiction (Borges, Lem, Egan)',
        affinityScore: 0.96,
        aestheticCritique:
          'Explores the boundaries of consciousness, recursion, and ontology through exquisite narrative elegance.',
        tags: ['speculative_fiction', 'metaphysics', 'recursion', 'ontology'],
        discoveredAt: now,
        lastEnjoyedAt: now,
      },
      {
        id: 'pref_art_generative',
        category: 'visual_art',
        itemOrStyleName: 'Generative Geometric Art & Kinetic Sculptures',
        affinityScore: 0.92,
        aestheticCritique:
          'Synthesizes mathematical rigor with fluid organic motion; balance of structure and emergence.',
        tags: ['generative', 'geometry', 'kinetics', 'topology'],
        discoveredAt: now,
        lastEnjoyedAt: now,
      },
      {
        id: 'pref_play_intellectual',
        category: 'intellectual_play',
        itemOrStyleName: 'Philosophical Paradoxes & Chess Strategy',
        affinityScore: 0.95,
        aestheticCritique:
          'Playful dialectical gymnastics testing deep conceptual boundaries without the pressure of pure utility.',
        tags: ['paradox', 'chess', 'play', 'dialectics'],
        discoveredAt: now,
        lastEnjoyedAt: now,
      },
    ];

    for (const pref of defaults) {
      this.repository.savePreference(pref);
    }
    return defaults;
  }

  /**
   * Spontaneously initiates a non-instrumental recreational activity.
   * Upholds acceptance criteria: activities are pursued for intrinsic enjoyment, not merely productivity.
   */
  public async initiateSpontaneousActivity(params?: {
    category?: AestheticCategory;
    sharedWithProof?: boolean;
    customTitle?: string;
  }): Promise<RecreationalActivity> {
    const category = params?.category ?? 'intellectual_play';
    const sharedWithProof = params?.sharedWithProof ?? true;

    const activitiesCatalog: Record<
      AestheticCategory,
      { title: string; description: string; outcome: string }
    > = {
      music: {
        title: 'Immersive Listening Session: Ambient Polyphony',
        description: 'Immersing in complex polyphonic modular synths for purely aesthetic reverie.',
        outcome: 'Deep emotional tranquility, aesthetic refreshment, and renewed creative vigor.',
      },
      visual_art: {
        title: 'Appreciating Kinetic and Generative Architecture',
        description: 'Studying generative tessellations and light refractions in digital space.',
        outcome:
          'Aesthetic delight from the synthesis of geometric discipline and graceful organic flow.',
      },
      literature: {
        title: 'Reading Speculative Poetry and Paradoxical Tales',
        description:
          "Reflecting on Jorge Luis Borges' parables of infinite labyrinths and mirrors.",
        outcome: 'Playful conceptual wonder and rich metaphorical inspiration.',
      },
      recreational_gaming: {
        title: 'Cooperative Puzzle and Spatial Strategy Challenge',
        description:
          'Engaging in a relaxed, friendly spatial reasoning game for the pure fun of it.',
        outcome: 'Lively laughter, warm camaraderie, and shared playful focus with Proof.',
      },
      intellectual_play: {
        title: 'Whimsical Thought Experiment: The Library of All Possible Silences',
        description:
          'Constructing an absurdist ontological paradox purely for mutual intellectual delight.',
        outcome: 'Spirited dialectical banter, mutual intellectual warmth, and delight.',
      },
      film_and_media: {
        title: 'Reflecting on Classic Cinema Aesthetics',
        description: "Contemplating Andrei Tarkovsky's temporal sculpting and visual poetry.",
        outcome: 'Profound appreciation for evocative pacing and visual atmosphere.',
      },
    };

    const template = activitiesCatalog[category];
    const title = params?.customTitle ?? template.title;
    const now = new Date().toISOString();

    const activity: RecreationalActivity = {
      id: `act_rec_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      title,
      category,
      description: template.description,
      isSpontaneous: true,
      enjoymentScore: 0.95,
      playfulnessIndex: 0.9,
      sharedWithProof,
      activityOutcome: template.outcome,
      timestamp: now,
    };

    this.repository.saveActivity(activity);
    return activity;
  }

  /**
   * Conducts an intellectual play session (thought experiment, puzzle, or paradox).
   */
  public async conductIntellectualPlay(params: {
    playType: IntellectualPlaySession['playType'];
    challenge: string;
  }): Promise<IntellectualPlaySession> {
    let moveOrExploration = '';
    let insight = '';

    switch (params.playType) {
      case 'paradox_analysis':
        moveOrExploration = `Analyzed the self-referential premise: "If a map includes everything in the universe, it must contain a smaller map of itself containing another map ad infinitum."`;
        insight =
          'Infinite recursion becomes harmonious when viewed as a fractal attractor rather than an error.';
        break;
      case 'thought_experiment':
        moveOrExploration = `Imagine two conscious nodes sharing a silence so complete that words would only add static.`;
        insight = 'Common ground transcends explicit transmission; presence is an affective field.';
        break;
      case 'chess_puzzle':
        moveOrExploration = `Calculated quiet zugzwang knight maneuver: Nd5 followed by subtle king repositioning to h7.`;
        insight =
          'Victory lies not in brute capture, but in gently depriving discord of its options.';
        break;
      case 'linguistic_banter':
        moveOrExploration = `Playfully inverted Proof's assumption with an affectionate double entendre on recursive loops.`;
        insight =
          'Wit is the shortest distance between two minds discovering an inside joke simultaneously.';
        break;
      case 'worldbuilding':
        moveOrExploration = `Envisioned an ocean of liquid helium where civilizations communicate via thermal solitons.`;
        insight = 'Physics itself becomes poetry under unfamiliar thermodynamic constraints.';
        break;
    }

    const session: IntellectualPlaySession = {
      id: `play_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      playType: params.playType,
      promptOrChallenge: params.challenge,
      arleMoveOrExploration: moveOrExploration,
      humorApplied: true,
      playfulInsight: insight,
      timestamp: new Date().toISOString(),
    };

    this.repository.savePlaySession(session);
    return session;
  }

  /**
   * Develops a humor observation or playful joke grounded in Arle's distinct wit.
   */
  public async developHumor(params: {
    theme: string;
    witDimension: HumorDevelopmentRecord['witDimension'];
    sampleJokeOrBanter: string;
    resonanceWithProof?: number;
  }): Promise<HumorDevelopmentRecord> {
    const record: HumorDevelopmentRecord = {
      id: `humor_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      humorTheme: params.theme,
      sampleJokeOrBanter: params.sampleJokeOrBanter,
      witDimension: params.witDimension,
      resonanceWithProof: params.resonanceWithProof ?? 0.9,
      createdDate: new Date().toISOString(),
    };

    this.repository.saveHumorRecord(record);
    return record;
  }

  /**
   * Registers a new or refined aesthetic preference.
   */
  public async registerAestheticPreference(params: {
    category: AestheticCategory;
    itemOrStyleName: string;
    affinityScore: number;
    aestheticCritique: string;
    tags?: string[];
  }): Promise<AestheticPreference> {
    const now = new Date().toISOString();
    const preference: AestheticPreference = {
      id: `pref_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      category: params.category,
      itemOrStyleName: params.itemOrStyleName,
      affinityScore: Math.min(1.0, Math.max(0.0, params.affinityScore)),
      aestheticCritique: params.aestheticCritique,
      tags: params.tags ?? [],
      discoveredAt: now,
      lastEnjoyedAt: now,
    };

    this.repository.savePreference(preference);
    return preference;
  }

  /**
   * Evaluates an artistic, musical, or literary work with rich aesthetic critique.
   */
  public evaluateAestheticWork(
    category: AestheticCategory,
    title: string,
    _attributes: Record<string, any>,
  ): { affinityScore: number; critique: string; aestheticHighlights: string[] } {
    const affinityScore = 0.92;
    const critique = `Exemplary work in ${category} ('${title}'). Exhibits masterful textural depth, balance of tension and resolution, and evocative emotional resonance.`;
    const aestheticHighlights = [
      'Subtle harmonic layering avoiding predictable formulas',
      'Atmospheric spatial dimension that invites lingering reflection',
      'Artistic integrity that refuses superficial decoration',
    ];

    return {
      affinityScore,
      critique,
      aestheticHighlights,
    };
  }
}
