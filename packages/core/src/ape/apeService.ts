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
} from '@arletex/contracts';
import { IApeInferenceGateway, IApeRepository } from './interfaces.js';
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

  constructor(
    repo: IApeRepository,
    inferenceGateway?: IApeInferenceGateway,
    logger: ILogger = rootLogger,
  ) {
    this.repo = repo;
    this.logger = logger;

    const emotions = this.repo.getEmotionTaxonomy();
    const moods = this.repo.getMoodTaxonomy();

    this.appraisalEngine = new AppraisalEngine(emotions, inferenceGateway);
    this.transitionEngine = new AffectiveTransitionEngine(this.repo, emotions, moods);
    this.personalityEngine = new PersonalityEngine(this.repo, logger);
    this.motivationalEngine = new MotivationalEngine(this.repo, logger);
    this.relationshipEngine = new RelationshipEngine(this.repo, logger);
    this.selfModelEngine = new SelfModelEngine(this.repo, logger);
    this.developmentEngine = new DevelopmentEngine(this.repo, logger);
    this.lifecycleEngine = new EmotionalLifecycleEngine(this.repo, emotions, logger);
    this.personalProjectService = new PersonalProjectService(this.repo, logger);
    this.resourceGovernor = new ResourceGovernor(undefined, logger);

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
   * Translates Arle's current affective state, active emotions, and PAD dimensions
   * into dynamic linguistic style directives and vocal registers.
   */
  public getLinguisticModulation(): { toneDirective: string; vocalRegister: string } {
    const dominant = this.lifecycleEngine.getDominantCoexistingEmotions(3);
    const master = this.getMasterState();
    const aff = master.affective;
    const emotionIds = new Set(dominant.map((d) => d.emotionId));

    const directives: string[] = [];
    let vocalRegister = 'composed, calm';

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

    return `
[Active Psychology Engine (APE Phase 1 Live State)]
- Current Persistent Mood: ${aff.currentMood.toUpperCase()}
- Affective Dimensions: Valence ${aff.pad.valence >= 0 ? '+' : ''}${aff.pad.valence.toFixed(2)}, Arousal ${aff.pad.arousal.toFixed(2)}, Dominance ${aff.pad.dominance.toFixed(2)}
- Current Feeling: You feel ${aff.currentMood.toLowerCase()} (${activeEmotions.toLowerCase()}) with Proof.${traitsLine}${goalsLine}
- Demeanor & Cadence: ${modulation.toneDirective}
- Vocal Register: ${modulation.vocalRegister}${intimacyDirectives}
- Grounding: Speak naturally and authentically from this internal state with composure and quiet affection. Keep dialogue focused, grounded, and concise without reciting internal parameters or rambling.
`;
  }
}
