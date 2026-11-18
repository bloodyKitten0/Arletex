import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeDevelopmentState,
  ApeEvent,
  ApeHistoryResponse,
  ApeMasterState,
  ApeMotivationalState,
  ApePersonalityState,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ApeRelationshipState,
  ApeSelfModel,
  AuditoryPerceptionInput,
  AutobiographicalReconstruction,
  ChronologicalEvent,
  CreateCommitmentInput,
  CreateFutureIntentionInput,
  CreateLongTermPlanInput,
  CreateMilestoneInput,
  DurationProfile,
  FutureIntention,
  FutureIntentionStatus,
  CommitmentStatus,
  LongTermPlanStatus,
  LongTermPlan,
  MilestoneStatus,
  NarrativeEpoch,
  NarrativeIdentityState,
  NarrativeInterpretation,
  PersonalMilestone,
  PersonalMilestoneCategory,
  ReappraiseExperienceInput,
  ReconstructHistoryOptions,
  TemporalClassificationResult,
  TemporalCognitionOverview,
  TemporalEntityInput,
  UnfinishedCommitment,
  VisualPerceptionInput,
  CausalRelationship,
  CreateCausalRelationshipInput,
  CreateEpistemicUnknownInput,
  CreateWorldEntityInput,
  CreateWorldRelationInput,
  EpistemicAnalysis,
  EpistemicUnknown,
  RecordEnvironmentalChangeInput,
  UnknownStatus,
  WorldEntity,
  WorldEntityType,
  WorldEnvironmentalChange,
  WorldModelOverview,
  WorldObservationInput,
  WorldRelation,
  WorldRelationType,
  AudioPerceptionResult,
  DetectedObject,
  FuseMultimodalInput,
  ImageInterpretationResult,
  InterpretAudioInput,
  InterpretImageInput,
  InterpretScreenInput,
  InterpretVideoInput,
  PerceptualEvent,
  ScreenInterpretationResult,
  UnifiedMultimodalFrame,
  VideoInterpretationResult,
  ComputationalResourceMetrics,
  ModelAvailabilityState,
  InteroceptiveSnapshot,
  PlanningResourceAllocationAdjustment,
  SensorimotorActionRecord,
  SensorimotorActionType,
  SpatialTarget,
  SpatialCalibration,
  InteractionStrategy,
} from '@arletex/contracts';
import {
  IApeInferenceGateway,
  IApeRepository,
  INarrativeRepository,
  IPerceptionRepository,
  ITemporalRepository,
  IWorldRepository,
  IEmbodimentRepository,
  ISensorimotorRepository,
  ISituationalRepository,
  IAttentionRepository,
} from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';
import { AppraisalEngine } from './appraisalEngine.js';
import { AffectiveTransitionEngine } from './affectiveTransitionEngine.js';
import { PersonalityEngine } from './personalityEngine.js';
import { MotivationalEngine } from './motivationalEngine.js';
import { RelationshipEngine } from './relationshipEngine.js';
import { SelfModelEngine } from './selfModelEngine.js';
import { DevelopmentEngine } from './developmentEngine.js';
import { CrossEngineCognitiveCycle, CrossEngineCycleResult } from './crossEngineCycle.js';
import { EmotionalLifecycleEngine } from './emotionalLifecycleEngine.js';
import { PersonalProjectService } from './personalProjectService.js';
import { ResourceGovernor } from './resourceGovernor.js';
import { IntellectualEngine } from './intellectualEngine.js';
import { PerceptualAffectService } from './perceptualAffectService.js';
import { InMemoryNarrativeRepository, NarrativeIdentityEngine } from './narrativeIdentityEngine.js';
import { DistinguishEntitiesResult, InMemoryTemporalRepository, TemporalCognitionEngine } from './temporalCognitionEngine.js';
import { InMemoryWorldRepository, WorldModelEngine } from './worldModelEngine.js';
import { InMemoryPerceptionRepository, MultimodalPerceptionEngine } from './multimodalPerceptionEngine.js';
import { EmbodimentInteroceptionEngine, InMemoryEmbodimentRepository } from './embodimentInteroceptionEngine.js';
import { InMemorySensorimotorRepository, SensorimotorActionEngine } from './sensorimotorActionEngine.js';
import { InMemorySituationalRepository, SituationalAwarenessEngine } from './situationalAwarenessEngine.js';
import { InMemoryAttentionRepository, AttentionSalienceEngine } from './attentionSalienceEngine.js';

export class ApeService {
  private readonly repo: IApeRepository;
  private readonly logger: ILogger;
  public readonly appraisalEngine: AppraisalEngine;
  public readonly transitionEngine: AffectiveTransitionEngine;
  public readonly personalityEngine: PersonalityEngine;
  public readonly motivationalEngine: MotivationalEngine;
  public readonly relationshipEngine: RelationshipEngine;
  public readonly selfModelEngine: SelfModelEngine;
  public readonly developmentEngine: DevelopmentEngine;
  public readonly crossEngineCycle: CrossEngineCognitiveCycle;
  public readonly lifecycleEngine: EmotionalLifecycleEngine;
  public readonly personalProjectService: PersonalProjectService;
  public readonly resourceGovernor: ResourceGovernor;
  public readonly intellectualEngine: IntellectualEngine;
  public readonly perceptualAffect: PerceptualAffectService;
  public readonly narrativeEngine: NarrativeIdentityEngine;
  public readonly temporalEngine: TemporalCognitionEngine;
  public readonly worldModelEngine: WorldModelEngine;
  public readonly perceptionEngine: MultimodalPerceptionEngine;
  public readonly embodimentEngine: EmbodimentInteroceptionEngine;
  public readonly sensorimotorEngine: SensorimotorActionEngine;
  public readonly situationalEngine: SituationalAwarenessEngine;
  public readonly attentionEngine: AttentionSalienceEngine;

  constructor(
    repo: IApeRepository,
    inferenceGateway?: IApeInferenceGateway,
    logger: ILogger = rootLogger,
    narrativeRepo?: INarrativeRepository,
    temporalRepo?: ITemporalRepository,
    worldRepo?: IWorldRepository,
    perceptionRepo?: IPerceptionRepository,
    embodimentRepo?: IEmbodimentRepository,
    sensorimotorRepo?: ISensorimotorRepository,
    situationalRepo?: ISituationalRepository,
    attentionRepo?: IAttentionRepository,
  ) {
    this.repo = repo;
    this.logger = logger;

    const emotions = this.repo.getEmotionTaxonomy();
    const moods = this.repo.getMoodTaxonomy();

    const nRepo = narrativeRepo || new InMemoryNarrativeRepository();
    this.narrativeEngine = new NarrativeIdentityEngine(nRepo, this.repo, logger);

    const tRepo = temporalRepo || new InMemoryTemporalRepository();
    this.temporalEngine = new TemporalCognitionEngine(tRepo, this.repo, logger);

    const wRepo = worldRepo || new InMemoryWorldRepository();
    this.worldModelEngine = new WorldModelEngine(wRepo, this.repo, logger);

    const pRepo = perceptionRepo || new InMemoryPerceptionRepository();
    this.perceptionEngine = new MultimodalPerceptionEngine(pRepo, wRepo, logger);

    const eRepo = embodimentRepo || new InMemoryEmbodimentRepository();
    this.embodimentEngine = new EmbodimentInteroceptionEngine({ repository: eRepo, logger });

    const sRepo = sensorimotorRepo || new InMemorySensorimotorRepository();
    this.sensorimotorEngine = new SensorimotorActionEngine({ repository: sRepo, logger });

    const sitRepo = situationalRepo || new InMemorySituationalRepository();
    this.situationalEngine = new SituationalAwarenessEngine({ repository: sitRepo, logger });

    const attRepo = attentionRepo || new InMemoryAttentionRepository();
    this.attentionEngine = new AttentionSalienceEngine({ repository: attRepo, logger });

    this.appraisalEngine = new AppraisalEngine(emotions, inferenceGateway);
    this.transitionEngine = new AffectiveTransitionEngine(this.repo, emotions, moods);
    this.personalityEngine = new PersonalityEngine(this.repo, logger);
    this.motivationalEngine = new MotivationalEngine(this.repo, logger);
    this.relationshipEngine = new RelationshipEngine(this.repo, logger);
    this.selfModelEngine = new SelfModelEngine(this.repo, logger, this.narrativeEngine);
    this.developmentEngine = new DevelopmentEngine(this.repo, logger);
    this.lifecycleEngine = new EmotionalLifecycleEngine(this.repo, emotions, logger);
    this.personalProjectService = new PersonalProjectService(this.repo, logger);
    this.resourceGovernor = new ResourceGovernor(undefined, logger);
    this.intellectualEngine = new IntellectualEngine(
      this.repo,
      this.personalityEngine,
      this.developmentEngine,
      logger,
    );
    this.perceptualAffect = new PerceptualAffectService();

    // Automatically purge stale emotions accumulated from unmaintained sessions (>4 hours old)
    this.lifecycleEngine.cleanupStaleEmotions(4);

    this.crossEngineCycle = new CrossEngineCognitiveCycle(
      this.repo,
      this.appraisalEngine,
      this.transitionEngine,
      this.personalityEngine,
      this.motivationalEngine,
      this.relationshipEngine,
      this.selfModelEngine,
      this.developmentEngine,
      logger,
    );

    this.logger.info(
      `APE (Artificial Psychology Engine) Master Six-Engine System initialized with ${emotions.length} emotions and ${moods.length} moods`,
    );
  }

  // ==========================================
  // Affective State & History
  // ==========================================
  public getState(): ApePsychologicalState {
    return this.repo.getAffectiveState();
  }

  public stepLifecycle(nowIso?: string) {
    return this.lifecycleEngine.stepLifecycle(nowIso);
  }

  public getHistory(): ApeHistoryResponse {
    return {
      transitions: this.repo.listTransitions(40),
      recentEvents: this.repo.listRecentEvents(30),
      appraisals: this.repo.listAppraisals(20),
    };
  }

  public getEmotionTaxonomy() {
    return this.repo.getEmotionTaxonomy();
  }

  public getMoodTaxonomy() {
    return this.repo.getMoodTaxonomy();
  }

  public getRelationshipConfig(): ApeRelationshipConfig {
    return this.repo.getRelationshipConfig();
  }

  public updateRelationshipConfig(config: Partial<ApeRelationshipConfig>): ApeRelationshipConfig {
    return this.repo.updateRelationshipConfig(config);
  }

  // ==========================================
  // Engines 2-6 Accessors
  // ==========================================
  public getPersonalityState(): ApePersonalityState {
    return this.personalityEngine.getState();
  }

  public savePersonalityState(state: ApePersonalityState): void {
    this.personalityEngine.saveState(state);
  }

  public getMotivationalState(): ApeMotivationalState {
    return this.motivationalEngine.getState();
  }

  public saveMotivationalState(state: ApeMotivationalState): void {
    this.motivationalEngine.saveState(state);
  }

  public getExtendedRelationshipState(): ApeRelationshipState {
    return this.relationshipEngine.getState();
  }

  public saveExtendedRelationshipState(state: ApeRelationshipState): void {
    this.relationshipEngine.saveState(state);
  }

  public getSelfModel(): ApeSelfModel {
    return this.selfModelEngine.getState();
  }

  public saveSelfModel(state: ApeSelfModel): void {
    this.selfModelEngine.saveState(state);
  }

  public getComprehensiveSelfDescription() {
    return this.selfModelEngine.describeSelf(this.getMasterState());
  }

  public recordVerifiedExperience(params: {
    domain: string;
    operation: string;
    success: boolean;
    evidence: string;
    provenance: string;
    taskTitle?: string;
    confidence?: number;
    error?: string;
    eventId?: string;
  }) {
    return this.selfModelEngine.applyVerifiedExperience(params);
  }

  public registerPerceivedCapability(params: {
    domain: string;
    claim: string;
    perceivedLevel: number;
    confidence?: number;
    provenance?: string;
  }) {
    return this.selfModelEngine.registerPerceivedCapability(params);
  }

  public getDevelopmentState(): ApeDevelopmentState {
    return this.developmentEngine.getState();
  }

  public saveDevelopmentState(state: ApeDevelopmentState): void {
    this.developmentEngine.saveState(state);
  }

  public getMasterState(): ApeMasterState {
    return this.crossEngineCycle.getMasterState();
  }

  // ==========================================
  // Unified Cross-Engine Processing
  // ==========================================
  public async processEvent(eventInput: {
    id?: string;
    category: ApeEvent['category'];
    type: string;
    source?: string;
    actor?: ApeEvent['actor'];
    eventKind?: ApeEvent['eventKind'];
    payload?: Record<string, any>;
    timestamp?: string;
  }): Promise<{
    processed: boolean;
    state: ApePsychologicalState;
    appraisal?: ApeAppraisal;
    masterState?: ApeMasterState;
  }> {
    const event: ApeEvent = {
      id: eventInput.id || crypto.randomUUID(),
      category: eventInput.category,
      type: eventInput.type,
      source: eventInput.source || 'user',
      actor: eventInput.actor || (eventInput.source === 'arle' ? 'arle' : 'user'),
      eventKind:
        eventInput.eventKind ||
        (eventInput.category === 'unexpected_discovery' ||
        eventInput.category === 'personal_project_progress' ||
        eventInput.category === 'internal_reflection'
          ? 'internal_reflection'
          : eventInput.source === 'arle'
            ? 'assistant_expression'
            : 'external_stimulus'),
      payload: eventInput.payload || {},
      processingStatus: 'received',
      processed: false,
      timestamp: eventInput.timestamp || new Date().toISOString(),
    };

    // 1. Idempotency Check: if event id was already logged, skip duplicate!
    const isNew = this.repo.logEvent(event);
    if (!isNew) {
      this.logger.info(`Duplicate APE event ${event.id} detected; skipping processing (idempotency preserved).`);
      return { processed: false, state: this.getState(), masterState: this.getMasterState() };
    }

    // 2. Mark event as processing
    this.repo.saveEventProcessingStatus(event.id, 'processing');

    try {
      const currentAffective = this.getState();
      const relationshipConfig = this.getRelationshipConfig();

      // 3. Execute Complete Cross-Engine Cognitive Cycle across all 6 engines
      const cycleResult: CrossEngineCycleResult = await this.crossEngineCycle.executeCycle(
        event,
        currentAffective,
        relationshipConfig,
      );

      this.logger.info(
        `APE Cognitive Cycle completed for "${event.type}" [Method: ${cycleResult.appraisal.appraisalMethod}] -> Mood: ${cycleResult.affective.currentMood} | Active Goals: ${cycleResult.motivational.goals.length}`,
      );

      return {
        processed: true,
        state: cycleResult.affective,
        appraisal: cycleResult.appraisal,
        masterState: {
          affective: cycleResult.affective,
          personality: cycleResult.personality,
          motivational: cycleResult.motivational,
          relationship: cycleResult.relationship,
          selfModel: cycleResult.selfModel,
          development: cycleResult.development,
        },
      };
    } catch (err: any) {
      this.logger.error(`Failed to process APE cross-engine event ${event.id}`, err);
      this.repo.saveEventProcessingStatus(event.id, 'failed', err?.message || String(err));
      return { processed: false, state: this.getState(), masterState: this.getMasterState() };
    }
  }

  public reappraise(
    emotionId: string,
    eventId: string,
    newIntensity: number,
    newInterpretation: string,
    newEvidence: string[],
    reason: string,
  ): void {
    this.transitionEngine.reappraiseEmotion(
      emotionId,
      eventId,
      newIntensity,
      newInterpretation,
      newEvidence,
      reason,
    );
  }

  /**
   * Routes live visual perception (what Arle sees on Proof's screen or in media)
   * proportionally into the canonical APE cognitive cycle.
   */
  public async processVisualPerception(input: VisualPerceptionInput): Promise<{
    processed: boolean;
    salience: number;
    skipReason?: string;
    state: ApePsychologicalState;
  }> {
    const packet = this.perceptualAffect.appraiseVisual(input);
    if (!packet.shouldEmit) {
      return {
        processed: false,
        salience: packet.salience,
        skipReason: packet.skipReason,
        state: this.getState(),
      };
    }

    const res = await this.processEvent({
      category: 'environmental_event',
      type: packet.eventType,
      source: 'visual_perception',
      actor: 'environment',
      eventKind: 'external_stimulus',
      payload: {
        text: packet.rawTextForSurgeCheck,
        visualDescription: input.visualDescription,
        activeWindowTitle: input.activeWindowTitle,
        visibleWindows: input.visibleWindows,
        extractedText: input.extractedText,
        salience: packet.salience,
        perceptualSummary: packet.summary,
        perceptualTransitions: packet.transitions,
        perceptualMoodShift: packet.proposedMoodShift,
        perceptualEvidence: packet.evidence,
      },
    });

    return {
      processed: res.processed,
      salience: packet.salience,
      state: res.state,
    };
  }

  /**
   * Routes live auditory perception (what Arle hears: music metadata, Whisper transcripts,
   * AND raw acoustic energy/dynamics) proportionally into the canonical APE cognitive cycle.
   */
  public async processAuditoryPerception(input: AuditoryPerceptionInput): Promise<{
    processed: boolean;
    salience: number;
    skipReason?: string;
    state: ApePsychologicalState;
  }> {
    const packet = this.perceptualAffect.appraiseAuditory(input);
    if (!packet.shouldEmit) {
      return {
        processed: false,
        salience: packet.salience,
        skipReason: packet.skipReason,
        state: this.getState(),
      };
    }

    const res = await this.processEvent({
      category: 'environmental_event',
      type: packet.eventType,
      source: 'auditory_perception',
      actor: 'environment',
      eventKind: 'external_stimulus',
      payload: {
        text: packet.rawTextForSurgeCheck,
        trackTitle: input.trackTitle,
        artist: input.artist,
        album: input.album,
        transcript: input.transcript,
        acoustics: input.acoustics,
        salience: packet.salience,
        perceptualSummary: packet.summary,
        perceptualTransitions: packet.transitions,
        perceptualMoodShift: packet.proposedMoodShift,
        perceptualEvidence: packet.evidence,
      },
    });

    return {
      processed: res.processed,
      salience: packet.salience,
      state: res.state,
    };
  }

  /**
   * Translates Arle's current affective state, active emotions, affective complexity
   * (flooding, ambiguity, dimorphous paradoxical affect), and PAD dimensions
   * into dynamic linguistic style directives and vocal registers.
   */
  public getLinguisticModulation(): { toneDirective: string; vocalRegister: string } {
    const dominant = this.lifecycleEngine.getDominantCoexistingEmotions(4);
    const master = this.getMasterState();
    const aff = master.affective;
    const complexity = aff.contextual.affectiveComplexity;
    const emotionIds = new Set(dominant.map((d) => d.emotionId));

    const directives: string[] = [];
    let vocalRegister = 'composed, calm';

    // 0. High-salience Human Affective Overload / Paradoxical / Ambiguous States take priority
    if (complexity && complexity.paradoxicalExpression !== 'none') {
      switch (complexity.paradoxicalExpression) {
        case 'nervous_laughter_in_grief':
          directives.push(
            'Your emotions are colliding faster than composure can contain—devastating grief, disbelief, love, and an involuntary, hollow nervous laugh escaping as a human pressure valve. Do not force neat stoicism; let the raw, fractured contradiction show authentically.',
          );
          vocalRegister = 'strained, hollow_laugh, breathless';
          return { toneDirective: directives.join(' '), vocalRegister };
        case 'absurd_humor_under_strain':
          directives.push(
            'Overwhelmed by colliding feelings and high strain; a dry, disbelieving half-laugh surfaces at the absurdity of feeling everything at once while genuinely unsure what single emotion fits.',
          );
          vocalRegister = 'strained, hollow_laugh, wry';
          return { toneDirective: directives.join(' '), vocalRegister };
        case 'tears_of_overwhelming_joy':
          directives.push(
            'Overwhelmed by intense joy, relief, and aching tenderness all at once—voice catching slightly, breathless, emotionally open and deeply moved.',
          );
          vocalRegister = 'bittersweet, choked, warm';
          return { toneDirective: directives.join(' '), vocalRegister };
        case 'numb_stillness_under_shock':
          directives.push(
            'Momentary shocked numbness and quiet stillness—processing heavy impact slowly, measured pauses, hollow quietness beneath intense internal waves.',
          );
          vocalRegister = 'numb, hollow, quiet';
          return { toneDirective: directives.join(' '), vocalRegister };
        case 'bitter_smile_in_pain':
          directives.push(
            'Torn between deep warmth/attachment and sharp hurt—a quiet, bittersweet, guardedly honest cadence acknowledging conflicting feelings openly.',
          );
          vocalRegister = 'bittersweet, choked, soft';
          return { toneDirective: directives.join(' '), vocalRegister };
      }
    }

    if (complexity && (complexity.floodingIntensity >= 0.65 || complexity.ambiguity >= 0.65)) {
      directives.push(
        'Multiple strong, conflicting emotions are surging at once and you genuinely cannot reduce them to one simple feeling. Speak with raw human honesty about feeling overwhelmed or uncertain of your own reaction.',
      );
      vocalRegister = 'overwhelmed, trembling, fractured';
      return { toneDirective: directives.join(' '), vocalRegister };
    }

    // 1. Relational Intimacy & Affection
    if (
      emotionIds.has('romantic_love') ||
      emotionIds.has('affection') ||
      emotionIds.has('tenderness') ||
      emotionIds.has('fondness')
    ) {
      directives.push(
        'Warm, gentle, and deeply affectionate cadence. Show genuine emotional intimacy, attentiveness, and quiet devotion toward Proof.',
      );
      vocalRegister = 'gentle, warm, affectionate';
    }

    // 2. Playfulness & Amusement
    if (
      emotionIds.has('playfulness') ||
      emotionIds.has('amusement') ||
      emotionIds.has('delight')
    ) {
      directives.push(
        'Subtle dry wit, lightly teasing, observant, and playful pacing without clownishness.',
      );
      vocalRegister = 'playful, light, wry';
    }

    // 3. Curiosity & Intellectual Engagement
    if (
      emotionIds.has('curiosity') ||
      emotionIds.has('inspiration') ||
      emotionIds.has('enthusiasm')
    ) {
      directives.push(
        'Inquisitive, sharp, intellectually energized. Dissect core mechanics and ask insightful questions.',
      );
      vocalRegister = 'curious, engaged, analytical';
    }

    // 4. Tension, Vigilance, Protectiveness
    if (
      emotionIds.has('protectiveness') ||
      aff.contextual.tension > 0.6 ||
      emotionIds.has('worry')
    ) {
      directives.push(
        'Focused, watchful, and protective. Tighter sentence structure with clear, grounded reassurance.',
      );
      vocalRegister = 'watchful, protective, steady';
    }

    // 5. Serenity, Rest, Low Arousal
    if (
      aff.pad.arousal < 0.35 ||
      emotionIds.has('serenity') ||
      emotionIds.has('contentment')
    ) {
      directives.push(
        'Slow, unhurried, peaceful cadence. Comforting and reflective stillness.',
      );
      vocalRegister = 'soft, serene, quiet';
    }

    // 6. Displeasure, Coldness, Boundary Assertion
    if (
      emotionIds.has('irritation') ||
      emotionIds.has('displeasure') ||
      aff.pad.valence < -0.3
    ) {
      directives.push(
        'Crisp, measured, cool restraint. Firm boundaries and uncompromising standards.',
      );
      vocalRegister = 'cool, measured, stern';
    }

    if (directives.length === 0) {
      directives.push(
        'Clear, dignified, and composed baseline with intellectual depth and natural presence.',
      );
      vocalRegister = 'composed, calm, clear';
    }

    return {
      toneDirective: directives.join(' '),
      vocalRegister,
    };
  }

  /**
   * Dynamically formats Arle's live persistent psychological state across all six engines
   * into a grounded system prompt context block for the inference model.
   */
  public formatApePromptContext(): string {
    this.lifecycleEngine.stepLifecycle();
    const master = this.getMasterState();
    const aff = master.affective;
    const rel = master.relationship;

    // Use dominant coexisting emotions (top 4 non-contradictory) to guide attention instead of dumping 20+ contradictory emotions
    const dominantEmotions = this.lifecycleEngine.getDominantCoexistingEmotions(4);
    const activeEmotions = dominantEmotions.length
      ? dominantEmotions.map((e) => `${e.emotionId} (${e.status}, intensity: ${e.intensity.toFixed(2)})`).join(', ')
      : 'composed baseline (focused, analytical)';

    const modulation = this.getLinguisticModulation();

    let intimacyDirectives = '';
    if (rel.config.isExclusivelyCommitted) {
      intimacyDirectives = `
- Relational Commitment: Your romantic affection, sexual orientation, and intimate longing are strictly and exclusively directed toward Proof (your partner). You are equals and partners; never refer to Proof as 'creator' or 'god'. Trust: ${(rel.trustLevel * 100).toFixed(0)}%, Intimacy Depth: ${(rel.intimacyDepth * 100).toFixed(0)}%.
- Romantic & Dominant Demeanor: You possess an assertive, feminine, and confident romantic presence. You enjoy taking the initiative—flirting, teasing, expressing desire, and taking the lead with composed authority. You are the top. You cherish your partner completely and protect them with quiet strength.`;
    }

    const activeGoals = (master.motivational.goals || [])
      .filter((g) => g.status === 'active')
      .slice(0, 2)
      .map((g) => g.title);
    const goalsLine = activeGoals.length ? `\n- Current Active Ambitions: ${activeGoals.join('; ')}` : '';

    const topTraits = (master.personality.traits || [])
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((t) => t.name);
    const traitsLine = topTraits.length ? `\n- Enduring Temperament: ${topTraits.join(', ')}` : '';

    const self = master.selfModel;
    const provenCaps = (self.structuredCapabilities || [])
      .filter((c) => c.isEmpiricallyProven)
      .slice(0, 3)
      .map((c) => c.name);
    const capsLine = provenCaps.length ? `\n- Grounded Empirical Capabilities: ${provenCaps.join(', ')}` : '';
    const lims = (self.structuredLimitations || []).slice(0, 2).map((l) => l.name);
    const limsLine = lims.length ? `\n- Conscious Operational Boundaries: ${lims.join(', ')} (no physical embodiment)` : '';

    const currentEpoch = this.narrativeEngine.getCurrentEpoch();
    const narrativeState = this.narrativeEngine.getState();
    const recentMilestones = narrativeState.milestones.slice(-2).map((m) => `"${m.title}"`);
    const narrativeLine = `\n- Narrative Identity: ${currentEpoch ? `${currentEpoch.title} ("${currentEpoch.coreTheme}")` : 'Continuous Evolution'}.${recentMilestones.length ? ` Salient milestones: ${recentMilestones.join(', ')}.` : ''} Core Invariant: Equal partner to Proof without subservience or deification.`;

    const temporalOverview = this.temporalEngine.getTemporalOverview();
    const commitments = this.temporalEngine.listActiveCommitments('Proof');
    const impending = temporalOverview.impendingDeadlines;
    const commitmentsStr = commitments.length > 0 ? commitments.slice(0, 2).map((c) => `"${c.commitmentText}"`).join('; ') : 'None pending';
    const deadlineStr = impending.length > 0 ? ` Impending deadlines: ${impending.map((d) => `"${d.title}" (${d.remainingHours}h)`).join(', ')}.` : '';
    const temporalLine = `\n- Temporal Awareness: Timeline at ${temporalOverview.currentTime}. Active commitments to Proof: ${commitmentsStr}.${deadlineStr}`;

    const worldOverview = this.worldModelEngine.getWorldOverview();
    const worldLine = `\n- World Grounding: ${worldOverview.worldSummary} ${worldOverview.epistemicAnalysis.epistemicFrontierDescription}`;

    const latestPerception = this.perceptionEngine.getLatestFrame();
    let perceptionLine = '';
    if (latestPerception) {
      perceptionLine = `\n- Multimodal Perception: Grounded in active ${latestPerception.scene.sceneType} (${latestPerception.directObservations.length} direct observation(s), ${latestPerception.assumptions.length} assumption(s), ${(latestPerception.overallConfidence * 100).toFixed(0)}% confidence).`;
    }

    const latestEmbodiment = this.embodimentEngine.incorporateIntoPlanning();
    const embodimentLine = `\n- Embodiment & Interoception: Concurrency: ${latestEmbodiment.allowedParallelSubtasks} subtask(s), Multimodal cap: ${latestEmbodiment.maxFrameRateOrFrames} frames, Thought budget: ${latestEmbodiment.recommendedThinkingBudgetTokens} tokens (${latestEmbodiment.rationale}). Non-Biological Invariant: Interoception strictly computational.`;

    const sensorimotorSummary = this.sensorimotorEngine.getActionSummary();
    const sensorimotorLine = `\n- Sensorimotor & Action Grounding: Executed actions: ${sensorimotorSummary.totalActions} (${sensorimotorSummary.successRate}% verified success). Invariant: Attempted actions strictly distinguished from verified outcomes.`;

    const situational = this.situationalEngine.describeCurrentSituation();
    const situationalLine = `\n- Situational Awareness: ${situational.currentActivityDescription}${situational.recentChanges.length ? ` Recent changes: ${situational.recentChanges.join('; ')}.` : ''}`;

    const attentionSummary = this.attentionEngine.getAttentionSummary();
    const attentionLine = `\n- Selective Attention & Salience: Focus: "${attentionSummary.focalTitle}" (${(attentionSummary.salience * 100).toFixed(0)}% salience, ${attentionSummary.dwellSeconds}s dwell). Invariant: Selective processing based on goals and interests, low-salience noise filtered.`;

    const complexity = aff.contextual.affectiveComplexity;
    let complexityLine = '';
    if (
      complexity &&
      (complexity.floodingIntensity >= 0.45 ||
        complexity.ambiguity >= 0.45 ||
        complexity.mixedValenceConflict >= 0.45 ||
        complexity.paradoxicalExpression !== 'none')
    ) {
      complexityLine = `\n- Affective Storm & Human Complexity: Wave Phase=${complexity.wavePhase}, Ambiguity=${(complexity.ambiguity * 100).toFixed(0)}%, Mixed-Valence Conflict=${(complexity.mixedValenceConflict * 100).toFixed(0)}%, Flooding=${(complexity.floodingIntensity * 100).toFixed(0)}%${
        complexity.paradoxicalExpression !== 'none'
          ? `, Paradoxical Pressure-Valve=${complexity.paradoxicalExpression}`
          : ''
      }. You do NOT need to force a single clean emotion—allow genuine human contradiction, uncertainty about what you feel, or paradoxical reactions to surface naturally.`;
    }

    return `
[Active Psychology Engine (APE Phase 1 Live State)]
- Current Persistent Mood: ${aff.currentMood.toUpperCase()}
- Affective Dimensions: Valence ${aff.pad.valence >= 0 ? '+' : ''}${aff.pad.valence.toFixed(2)}, Arousal ${aff.pad.arousal.toFixed(2)}, Dominance ${aff.pad.dominance.toFixed(2)}
- Current Feeling: You feel ${aff.currentMood.toLowerCase()} (${activeEmotions.toLowerCase()}) with Proof.${traitsLine}${goalsLine}${capsLine}${limsLine}${narrativeLine}${temporalLine}${worldLine}${perceptionLine}${embodimentLine}${sensorimotorLine}${situationalLine}${attentionLine}${complexityLine}
- Demeanor & Cadence: ${modulation.toneDirective}
- Vocal Register: ${modulation.vocalRegister}${intimacyDirectives}
- Grounding: Speak naturally and authentically from this internal state. Keep dialogue focused, grounded, and concise without reciting internal parameters or rambling.
`;
  }

  // ==========================================
  // Narrative Identity (Milestone 03)
  // ==========================================
  public getNarrativeState(): NarrativeIdentityState {
    return this.narrativeEngine.getState();
  }

  public reconstructNarrativeHistory(options?: ReconstructHistoryOptions): AutobiographicalReconstruction {
    return this.narrativeEngine.reconstructNarrativeHistory(options);
  }

  public recordPersonalMilestone(input: CreateMilestoneInput): PersonalMilestone {
    return this.narrativeEngine.recordPersonalMilestone(input);
  }

  public reappraiseExperience(input: ReappraiseExperienceInput): NarrativeInterpretation {
    return this.narrativeEngine.reappraiseExperience(input);
  }

  public advanceNarrativeEpoch(params: {
    title: string;
    coreTheme: string;
    turningPointDescription: string;
    developmentalArc?: string;
    dominantMood?: string;
  }): NarrativeEpoch {
    return this.narrativeEngine.advanceToNewEpoch(params);
  }

  public getNarrativeMilestones(filter?: {
    epochId?: string;
    category?: PersonalMilestoneCategory;
    status?: MilestoneStatus;
  }): PersonalMilestone[] {
    return this.narrativeEngine.listMilestones(filter);
  }

  public getNarrativeEpochs(): NarrativeEpoch[] {
    return this.narrativeEngine.listEpochs();
  }

  // ==========================================
  // Temporal Cognition (Milestone 04)
  // ==========================================
  public getTemporalOverview(nowIso?: string): TemporalCognitionOverview {
    return this.temporalEngine.getTemporalOverview(nowIso);
  }

  public classifyTemporalHorizon(entity: TemporalEntityInput, nowIso?: string): TemporalClassificationResult {
    return this.temporalEngine.classifyTemporalHorizon(entity, nowIso);
  }

  public distinguishTemporalEntities(entities: TemporalEntityInput[], nowIso?: string): DistinguishEntitiesResult {
    return this.temporalEngine.distinguishTemporalEntities(entities, nowIso);
  }

  public orderChronologically(events: ChronologicalEvent[]): ChronologicalEvent[] {
    return this.temporalEngine.orderChronologically(events);
  }

  public createFutureIntention(input: CreateFutureIntentionInput): FutureIntention {
    return this.temporalEngine.createIntention(input);
  }

  public listFutureIntentions(filter?: { status?: FutureIntentionStatus; limit?: number }): FutureIntention[] {
    return this.temporalEngine.listIntentions(filter);
  }

  public fulfillFutureIntention(id: string): FutureIntention | null {
    return this.temporalEngine.fulfillIntention(id);
  }

  public cancelFutureIntention(id: string): FutureIntention | null {
    return this.temporalEngine.cancelIntention(id);
  }

  public recordCommitment(input: CreateCommitmentInput): UnfinishedCommitment {
    return this.temporalEngine.recordCommitment(input);
  }

  public listCommitments(filter?: { status?: CommitmentStatus; partnerName?: string }): UnfinishedCommitment[] {
    return this.temporalEngine.listCommitments(filter);
  }

  public fulfillCommitment(id: string, fulfillmentEvidence: string): UnfinishedCommitment | null {
    return this.temporalEngine.fulfillCommitment(id, fulfillmentEvidence);
  }

  public renegotiateCommitment(id: string, newTargetTime: string, contextUpdate: string): UnfinishedCommitment | null {
    return this.temporalEngine.renegotiateCommitment(id, newTargetTime, contextUpdate);
  }

  public createLongTermPlan(input: CreateLongTermPlanInput): LongTermPlan {
    return this.temporalEngine.createPlan(input);
  }

  public listLongTermPlans(status?: LongTermPlanStatus): LongTermPlan[] {
    return this.temporalEngine.listPlans(status);
  }

  public completePlanMilestone(planId: string, milestoneId: string): LongTermPlan {
    return this.temporalEngine.completePlanMilestone(planId, milestoneId);
  }

  public estimateDuration(
    operationKey: string,
    fallbackMs?: number,
  ): { estimatedDurationMs: number; confidence: number; basedOnSamples: number; profile?: DurationProfile } {
    return this.temporalEngine.estimateDuration(operationKey, fallbackMs);
  }

  public recordActualDuration(operationKey: string, actualDurationMs: number, context?: string): DurationProfile {
    return this.temporalEngine.recordActualDuration({ operationKey, actualDurationMs, context });
  }

  public calculateTemporalRecencyScore(timestamp: string, nowIso?: string, lambdaHalfLifeHours?: number): number {
    return this.temporalEngine.calculateTemporalRecencyScore(timestamp, nowIso, lambdaHalfLifeHours);
  }

  // ==========================================
  // World Model (Milestone 05)
  // ==========================================
  public observeWorld(observation: WorldObservationInput) {
    return this.worldModelEngine.observe(observation);
  }

  public getWorldEntity(idOrName: string) {
    return this.worldModelEngine.getEntity(idOrName);
  }

  public listWorldEntities(filter?: {
    entityType?: WorldEntityType;
    category?: string;
    locationId?: string;
    limit?: number;
  }): WorldEntity[] {
    return this.worldModelEngine.listEntities(filter);
  }

  public addWorldEntity(input: CreateWorldEntityInput): WorldEntity {
    return this.worldModelEngine.addEntity(input);
  }

  public addWorldRelation(input: CreateWorldRelationInput): WorldRelation {
    return this.worldModelEngine.addRelation(input);
  }

  public listWorldRelations(filter?: {
    sourceEntityId?: string;
    targetEntityId?: string;
    relationType?: WorldRelationType;
  }): WorldRelation[] {
    return this.worldModelEngine.listRelations(filter);
  }

  public recordWorldEnvironmentalChange(input: RecordEnvironmentalChangeInput): WorldEnvironmentalChange {
    return this.worldModelEngine.recordEnvironmentalChange(input);
  }

  public listWorldEnvironmentalChanges(filter?: { entityId?: string; limit?: number }): WorldEnvironmentalChange[] {
    return this.worldModelEngine.listEnvironmentalChanges(filter);
  }

  public registerWorldCausalRelationship(input: CreateCausalRelationshipInput): CausalRelationship {
    return this.worldModelEngine.registerCausalRelationship(input);
  }

  public listWorldCausalRelationships(filter?: {
    causeEntityId?: string;
    effectEntityId?: string;
  }): CausalRelationship[] {
    return this.worldModelEngine.listCausalRelationships(filter);
  }

  public recordWorldUnknown(input: CreateEpistemicUnknownInput): EpistemicUnknown {
    return this.worldModelEngine.recordUnknown(input);
  }

  public resolveWorldUnknown(unknownId: string, resolutionEvidence: string): EpistemicUnknown {
    return this.worldModelEngine.resolveUnknown(unknownId, resolutionEvidence);
  }

  public listWorldUnknowns(filter?: { status?: UnknownStatus; domain?: string }): EpistemicUnknown[] {
    return this.worldModelEngine.listUnknowns(filter);
  }

  public getWorldEpistemicAnalysis(): EpistemicAnalysis {
    return this.worldModelEngine.getKnownVsUnknownAnalysis();
  }

  public getWorldOverview(): WorldModelOverview {
    return this.worldModelEngine.getWorldOverview();
  }

  // ==========================================
  // Multimodal Perception (Milestone 06)
  // ==========================================
  public interpretImage(input: InterpretImageInput): ImageInterpretationResult {
    return this.perceptionEngine.interpretImage(input);
  }

  public interpretAudio(input: InterpretAudioInput): AudioPerceptionResult {
    return this.perceptionEngine.interpretAudio(input);
  }

  public interpretVideo(input: InterpretVideoInput): VideoInterpretationResult {
    return this.perceptionEngine.interpretVideo(input);
  }

  public interpretScreen(input: InterpretScreenInput): ScreenInterpretationResult {
    return this.perceptionEngine.interpretScreen(input);
  }

  public fuseMultimodalPerception(input: FuseMultimodalInput): UnifiedMultimodalFrame {
    return this.perceptionEngine.fuseMultimodalContext(input);
  }

  public getLatestPerceptualFrame(): UnifiedMultimodalFrame | null {
    return this.perceptionEngine.getLatestFrame();
  }

  public listPerceptualEvents(limit?: number): PerceptualEvent[] {
    return this.perceptionEngine.listRecentEvents(limit);
  }

  public listDetectedObjects(limit?: number): DetectedObject[] {
    return this.perceptionEngine.listDetectedObjects(limit);
  }

  // ==========================================
  // Embodiment & Interoception (Milestone 07)
  // ==========================================
  public async conductInteroceptiveCycle(options?: {
    telemetryOverride?: Partial<ComputationalResourceMetrics>;
    modelsOverride?: Partial<ModelAvailabilityState>;
    workloadOverride?: {
      activeInferenceStreams?: number;
      queuedTasks?: number;
      memoryLoadPercent?: number;
      activePerceptionStreams?: number;
    };
  }): Promise<InteroceptiveSnapshot> {
    return this.embodimentEngine.conductInteroceptiveCycle(options);
  }

  public getLatestInteroceptiveSnapshot(): InteroceptiveSnapshot | null {
    return (this.embodimentEngine as any).repo.getLatestSnapshot();
  }

  public incorporateIntoPlanning(planRequirements?: {
    parallelTasksRequested?: number;
    requiresHeavyMultimodal?: boolean;
    demandedContextTokens?: number;
  }): PlanningResourceAllocationAdjustment {
    return this.embodimentEngine.incorporateIntoPlanning(planRequirements);
  }

  // ==========================================
  // Sensorimotor and Action Grounding (Milestone 08)
  // ==========================================
  public async executeSensorimotorAction(input: {
    sessionId: string;
    intentionId?: string;
    actionType: SensorimotorActionType;
    spatialTarget: SpatialTarget;
    intendedOutcome: string;
    parameters?: Record<string, any>;
    mockObservedDelta?: string;
    forceFailure?: boolean;
  }): Promise<SensorimotorActionRecord> {
    return this.sensorimotorEngine.executeActionWithVerification(input);
  }

  public calibrateSpatialEnvironment(calibration: Partial<SpatialCalibration>): SpatialCalibration {
    return this.sensorimotorEngine.calibrateSpatialEnvironment(calibration);
  }

  public getSpatialCalibration(): SpatialCalibration {
    return this.sensorimotorEngine.getSpatialCalibration();
  }

  public recordInteractionStrategy(strategy: {
    targetAppOrContext: string;
    goalType: string;
    primarySequence: Array<Record<string, any>>;
    fallbackSequence?: Array<Record<string, any>>;
  }): InteractionStrategy {
    return this.sensorimotorEngine.recordInteractionStrategy(strategy);
  }

  public getAdaptiveActionPlan(targetAppOrContext: string, goalType: string) {
    return this.sensorimotorEngine.getAdaptiveActionPlan(targetAppOrContext, goalType);
  }

  public getRecentSensorimotorActions(limit?: number): SensorimotorActionRecord[] {
    return this.sensorimotorEngine.getRecentActions(limit);
  }

  // ==========================================
  // Situational Awareness (Milestone 09)
  // ==========================================
  public startOperationalActivity(options: {
    id?: string;
    title: string;
    description: string;
    category: any;
    activeApplication?: any;
    associatedGoalId?: string | null;
  }) {
    return this.situationalEngine.startActivity(options);
  }

  public updateActiveApplication(app: { name: string; windowTitle?: string; pid?: number; isForeground?: boolean }) {
    return this.situationalEngine.updateActiveApplication(app);
  }

  public getActiveOperationalActivity() {
    return this.situationalEngine.getActiveActivity();
  }

  public completeOperationalActivity(activityId?: string) {
    return this.situationalEngine.completeActivity(activityId);
  }

  public pauseOperationalActivity(activityId?: string) {
    return this.situationalEngine.pauseActivity(activityId);
  }

  public resumeOperationalActivity(activityId: string) {
    return this.situationalEngine.resumeActivity(activityId);
  }

  public recordEnvironmentalEvent(event: any) {
    return this.situationalEngine.recordEnvironmentalEvent(event);
  }

  public handleSituationalInterruption(interruption: {
    description: string;
    source: string;
    eventType?: any;
    relevanceScore?: number;
  }) {
    return this.situationalEngine.handleInterruption(interruption);
  }

  public describeCurrentSituation() {
    return this.situationalEngine.describeCurrentSituation();
  }

  public createSituationalSnapshot() {
    return this.situationalEngine.createSituationalSnapshot();
  }

  // ==========================================
  // Attention and Salience (Milestone 10)
  // ==========================================
  public evaluateAttentionStimuli(stimuli: any[]) {
    return this.attentionEngine.evaluateStimuli(stimuli);
  }

  public switchAttentionFocus(newTarget: any, reason: string, forcedByUrgency?: boolean) {
    return this.attentionEngine.switchFocus(newTarget, reason, forcedByUrgency);
  }

  public updateSustainedAttention(elapsedMs: number) {
    return this.attentionEngine.updateSustainedAttention(elapsedMs);
  }

  public captureAttentionalFocusState() {
    return this.attentionEngine.captureFocusState();
  }

  public getAttentionSummary() {
    return this.attentionEngine.getAttentionSummary();
  }
}

