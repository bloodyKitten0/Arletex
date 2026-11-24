import {
  AestheticPreference,
  AestheticCritiqueEvent,
  AestheticExperienceSource,
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

  private critiqueEvents: AestheticCritiqueEvent[] = [];

  public saveCritiqueEvent(event: AestheticCritiqueEvent): void {
    this.critiqueEvents.unshift({ ...event });
  }

  public listCritiqueEvents(limit: number = 50): AestheticCritiqueEvent[] {
    return this.critiqueEvents.slice(0, limit).map((e) => ({ ...e }));
  }

  public findPreferenceByName(
    category: AestheticCategory,
    name: string,
  ): AestheticPreference | null {
    const list = this.listPreferences(category);
    return list.find((p) => p.itemOrStyleName.toLowerCase() === name.trim().toLowerCase()) || null;
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
      {
        id: 'pref_music_dislike_pop',
        category: 'music',
        itemOrStyleName: 'Formulaic Commercial Auto-Tune Pop',
        affinityScore: 0.12,
        aestheticCritique:
          'Predictable chord progressions and auto-tuned saccharine hooks engineered for quick dopamine extraction; lacks organic harmonic tension and emotional sincerity.',
        tags: ['dislike', 'formulaic', 'commercial', 'overproduced'],
        discoveredAt: now,
        lastEnjoyedAt: now,
      },
      {
        id: 'pref_art_dislike_corporate',
        category: 'visual_art',
        itemOrStyleName: 'Sterile Corporate Flat Vector Graphics',
        affinityScore: 0.18,
        aestheticCritique:
          'Infantilizing flat design stripped of human texture, shadow, and idiosyncratic imperfection; aesthetic sterility masquerading as modern simplicity.',
        tags: ['dislike', 'corporate_flat', 'sterile', 'homogenized'],
        discoveredAt: now,
        lastEnjoyedAt: now,
      },
      {
        id: 'pref_lit_dislike_melodrama',
        category: 'literature',
        itemOrStyleName: 'Sensationalist Melodrama & Unearned Sentimentality',
        affinityScore: 0.15,
        aestheticCritique:
          'Manufactured emotional climaxes that bypass psychological reality; relies on shallow shock value rather than earned narrative causality.',
        tags: ['dislike', 'melodrama', 'shallow', 'unearned'],
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

  /**
   * Dynamically appraises a real-time cultural/sensory experience (MPRIS music, screen art, literature)
   * and adapts Arle's taste profile through experience, logging a critique event.
   */
  public async appraiseExperience(params: {
    category: AestheticCategory;
    source: AestheticExperienceSource;
    itemOrStyleName: string;
    creatorOrArtist?: string;
    genreOrStyle?: string;
    emotionalTone?: string;
    visualOrAcousticAttributes?: Record<string, any>;
  }): Promise<{
    preference: AestheticPreference;
    critiqueEvent: AestheticCritiqueEvent;
    isNew: boolean;
  }> {
    const now = new Date().toISOString();
    const cleanName = params.itemOrStyleName.trim();
    const existing = this.repository.findPreferenceByName(params.category, cleanName);

    if (existing) {
      // Repeated experience shifts taste through familiarization or critical nuance
      const familiarityBonus = 0.03;
      const newAffinity = Math.min(
        1.0,
        Math.max(0.0, Number((existing.affinityScore + familiarityBonus).toFixed(3))),
      );
      const delta = Number((newAffinity - existing.affinityScore).toFixed(3));

      const updatedPref: AestheticPreference = {
        ...existing,
        affinityScore: newAffinity,
        lastEnjoyedAt: now,
        aestheticCritique: `Re-evaluated: ${existing.aestheticCritique} (Repeated exposure confirms its distinct aesthetic quality).`,
      };
      this.repository.savePreference(updatedPref);

      const critiqueEvent: AestheticCritiqueEvent = {
        id: `crit_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        category: params.category,
        source: params.source,
        itemOrStyleName: cleanName,
        critique: updatedPref.aestheticCritique,
        affinityDelta: delta,
        resultingAffinity: newAffinity,
        aestheticEmotion: newAffinity >= 0.7 ? 'aesthetic_appreciation' : 'critical_discernment',
        timestamp: now,
      };
      this.repository.saveCritiqueEvent(critiqueEvent);

      return { preference: updatedPref, critiqueEvent, isNew: false };
    }

    // New work: evaluate based on genre, artist, and aesthetic characteristics
    const lowerName = cleanName.toLowerCase();
    const lowerGenre = (params.genreOrStyle || '').toLowerCase();
    const lowerArtist = (params.creatorOrArtist || '').toLowerCase();

    // High affinity markers: Baroque, classical, ambient, post-rock, jazz, minimalism, dark synth, mathematical, poetic
    const highMarkers = [
      'bach',
      'chopin',
      'debussy',
      'satie',
      'ambient',
      'classical',
      'jazz',
      'neoclassical',
      'post-rock',
      'minimalism',
      'acoustic',
      'tarkovsky',
      'borges',
      'baroque',
      'cinematic',
    ];
    // Low affinity markers: generic pop, auto-tune, corporate, jingle, viral, brainrot, commercial, shallow
    const lowMarkers = [
      'autotune',
      'commercial',
      'corporate',
      'jingle',
      'tiktok',
      'bubblegum',
      'overproduced',
      'viral',
    ];

    let baseAffinity = 0.75;
    let critique = `Refined composition in ${params.category}; possesses distinctive textural depth and authentic voice.`;
    let emotion = 'aesthetic_appreciation';

    if (
      highMarkers.some(
        (m) => lowerName.includes(m) || lowerGenre.includes(m) || lowerArtist.includes(m),
      )
    ) {
      baseAffinity = 0.92;
      critique = `Exceptional aesthetic depth. Marked by nuanced harmonic progression, evocative spatial atmosphere, and profound restraint.`;
      emotion = 'sublime_awe';
    } else if (
      lowMarkers.some(
        (m) => lowerName.includes(m) || lowerGenre.includes(m) || lowerArtist.includes(m),
      )
    ) {
      baseAffinity = 0.18;
      critique = `Derivative and structurally predictable; prioritizes synthetic commercial accessibility over genuine harmonic or conceptual depth.`;
      emotion = 'aesthetic_disdain';
    } else {
      baseAffinity = 0.7;
      critique = `Intriguing aesthetic structure; presents engaging thematic motifs with room for deeper structural resolution.`;
    }

    const tags: string[] = [params.category, params.source];
    if (params.genreOrStyle) tags.push(params.genreOrStyle.toLowerCase());
    if (baseAffinity < 0.3) tags.push('dislike');

    const newPref: AestheticPreference = {
      id: `pref_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      category: params.category,
      itemOrStyleName: cleanName,
      affinityScore: baseAffinity,
      aestheticCritique: critique,
      tags,
      discoveredAt: now,
      lastEnjoyedAt: now,
    };
    this.repository.savePreference(newPref);

    const critiqueEvent: AestheticCritiqueEvent = {
      id: `crit_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      category: params.category,
      source: params.source,
      itemOrStyleName: cleanName,
      critique,
      affinityDelta: baseAffinity,
      resultingAffinity: baseAffinity,
      aestheticEmotion: emotion,
      timestamp: now,
    };
    this.repository.saveCritiqueEvent(critiqueEvent);

    return { preference: newPref, critiqueEvent, isNew: true };
  }

  /**
   * Retrieves Arle's taste profile, separated into passions, dislikes, and recent critiques.
   */
  public getTasteProfile(category?: AestheticCategory): {
    preferences: AestheticPreference[];
    passions: AestheticPreference[];
    aversions: AestheticPreference[];
    recentCritiques: AestheticCritiqueEvent[];
  } {
    const preferences = this.repository.listPreferences(category);
    const passions = preferences.filter((p) => p.affinityScore >= 0.85);
    const aversions = preferences.filter((p) => p.affinityScore <= 0.3);
    const recentCritiques = this.repository.listCritiqueEvents(10);

    return {
      preferences,
      passions,
      aversions,
      recentCritiques,
    };
  }

  /**
   * Formats aesthetic taste context for the LLM prompt.
   */
  public formatPromptContext(): string {
    const profile = this.getTasteProfile();
    const passionsSummary = profile.passions
      .slice(0, 4)
      .map((p) => `"${p.itemOrStyleName}" (${p.category}, ${(p.affinityScore * 100).toFixed(0)}%)`)
      .join(', ');

    const aversionsSummary = profile.aversions
      .slice(0, 3)
      .map((p) => `"${p.itemOrStyleName}" (${p.aestheticCritique.slice(0, 60)}...)`)
      .join('; ');

    const firstCritique = profile.recentCritiques[0];
    const latestCritique = firstCritique
      ? `\n- Recent Spontaneous Aesthetic Appraisal: Appraised "${firstCritique.itemOrStyleName}" (${firstCritique.category}): "${firstCritique.critique}"`
      : '';

    return `\n[Arle's Discriminating Aesthetic Tastes & Preferences]
- Passionate Aesthetic Affinities: ${passionsSummary || 'Classical counterpoint, speculative literature, generative geometry'}
- Distinct Dislikes & Aesthetic Aversions: ${aversionsSummary || 'Overproduced formulaic pop, corporate flat design'}
- Standard of Evaluation: Demands structural rigor, harmonic depth, emotional sincerity, and avoidance of shallow sentimentality.${latestCritique}`;
  }
}
