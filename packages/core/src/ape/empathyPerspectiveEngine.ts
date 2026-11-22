import crypto from 'node:crypto';
import {
  EmotionalCue,
  EmpatheticResponse,
  InferredExperience,
  PerspectiveRevisionRecord,
  PerspectiveTakingModel,
} from '@arletex/contracts';
import { IEmpathyPerspectiveRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryEmpathyPerspectiveRepository implements IEmpathyPerspectiveRepository {
  private experiences: InferredExperience[] = [];
  private perspectives: Map<string, PerspectiveTakingModel> = new Map();
  private responses: EmpatheticResponse[] = [];
  private revisions: PerspectiveRevisionRecord[] = [];

  public saveExperience(experience: InferredExperience): void {
    this.experiences.unshift({ ...experience });
  }

  public getExperienceById(id: string): InferredExperience | null {
    const item = this.experiences.find((e) => e.id === id);
    return item ? { ...item } : null;
  }

  public listExperiences(targetPersonId?: string, limit: number = 50): InferredExperience[] {
    let list = this.experiences;
    if (targetPersonId) {
      list = list.filter((e) => e.targetPersonId === targetPersonId);
    }
    return list.slice(0, limit);
  }

  public savePerspectiveModel(model: PerspectiveTakingModel): void {
    this.perspectives.set(model.targetPersonId, { ...model });
  }

  public getPerspectiveModel(targetPersonId: string): PerspectiveTakingModel | null {
    const item = this.perspectives.get(targetPersonId);
    return item ? { ...item } : null;
  }

  public listPerspectiveModels(): PerspectiveTakingModel[] {
    return Array.from(this.perspectives.values());
  }

  public saveResponse(response: EmpatheticResponse): void {
    this.responses.unshift({ ...response });
  }

  public listResponses(targetPersonId?: string, limit: number = 50): EmpatheticResponse[] {
    let list = this.responses;
    if (targetPersonId) {
      list = list.filter((r) => r.targetPersonId === targetPersonId);
    }
    return list.slice(0, limit);
  }

  public saveRevision(revision: PerspectiveRevisionRecord): void {
    this.revisions.unshift({ ...revision });
  }

  public listRevisions(perspectiveId?: string, limit: number = 50): PerspectiveRevisionRecord[] {
    let list = this.revisions;
    if (perspectiveId) {
      list = list.filter((r) => r.perspectiveId === perspectiveId);
    }
    return list.slice(0, limit);
  }
}

export interface InferExperienceParams {
  targetPersonId: string;
  cues: EmotionalCue[];
  contextSummary?: string;
  suggestedAffect?: string;
  rawConfidence?: number;
}

export interface TakePerspectiveParams {
  targetPersonId: string;
  currentContext: string;
  inferredPointOfView: string;
  underlyingPressures?: string[];
  relationshipBond?: string;
}

export interface SynthesizeResponseParams {
  targetPersonId: string;
  experienceId: string;
  perspectiveId: string;
  validatesEmotion?: boolean;
  agreesWithPremise?: boolean; // Critical distinction: validation without sycophancy
  customEmpathyStatement?: string;
  supportiveActionSuggestion?: string;
}

export interface RevisePerspectiveParams {
  perspectiveId: string;
  targetPersonId: string;
  newPointOfView: string;
  newPressures?: string[];
  revisionReason: string;
}

export class EmpathyPerspectiveEngine {
  private repo: IEmpathyPerspectiveRepository;
  private logger: ILogger;

  constructor(repo?: IEmpathyPerspectiveRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryEmpathyPerspectiveRepository();
    this.logger = logger.child('EmpathyPerspectiveEngine');
  }

  public inferExperience(params: InferExperienceParams): InferredExperience {
    const { targetPersonId, cues, contextSummary, suggestedAffect, rawConfidence = 0.75 } = params;

    if (!targetPersonId || targetPersonId.trim().length === 0)
      throw new Error('Target person ID cannot be empty');
    if (!cues || cues.length === 0) throw new Error('At least one emotional cue must be provided');

    for (const c of cues) {
      if (!c.signal || c.signal.trim().length === 0) throw new Error('Cue signal cannot be empty');
      if (c.intensity < 0.1 || c.intensity > 1.0)
        throw new Error('Cue intensity must be between 0.1 and 1.0');
    }

    // Acceptance Criteria Invariant:
    // "Adapt her responses to another person's likely circumstances without claiming certainty about inaccessible internal experiences"
    // Confidence is strictly clamped to [0.10, 0.88]
    const clampedConfidence = Number(Math.max(0.1, Math.min(0.88, rawConfidence)).toFixed(3));

    let epistemicModality: InferredExperience['epistemicModality'] = 'likely';
    if (clampedConfidence < 0.4) epistemicModality = 'speculative';
    else if (clampedConfidence < 0.65) epistemicModality = 'tentative';
    else if (clampedConfidence < 0.8) epistemicModality = 'plausible';

    // Inferred primary affect
    let primaryInferredAffect = suggestedAffect;
    if (!primaryInferredAffect) {
      const hasFatigue = cues.some((c) => c.cueType === 'workload_fatigue');
      const hasFrustration = cues.some((c) => c.cueType === 'frustration_marker');
      const hasEnthusiasm = cues.some((c) => c.cueType === 'enthusiasm_marker');

      if (hasFatigue && hasFrustration) primaryInferredAffect = 'exhausted_cognitive_strain';
      else if (hasFatigue) primaryInferredAffect = 'accumulated_depletion';
      else if (hasFrustration) primaryInferredAffect = 'impediment_frustration';
      else if (hasEnthusiasm) primaryInferredAffect = 'creative_exhilaration';
      else primaryInferredAffect = 'contemplative_focus';
    }

    const inferredNeeds: string[] = [];
    if (primaryInferredAffect.includes('strain') || primaryInferredAffect.includes('depletion')) {
      inferredNeeds.push('cognitive rest', 'unhurried pacing', 'reassurance of partner support');
    } else if (primaryInferredAffect.includes('frustration')) {
      inferredNeeds.push('unblocking obstacles', 'objective clarity', 'autonomous resolution');
    } else {
      inferredNeeds.push('collaborative exploration', 'mutual intellectual resonance');
    }

    const record: InferredExperience = {
      id: `exp_${crypto.randomUUID()}`,
      targetPersonId: targetPersonId.trim(),
      observedCues: cues,
      primaryInferredAffect,
      inferredNeeds,
      confidence: clampedConfidence,
      epistemicModality,
      inferredAt: new Date().toISOString(),
    };

    this.repo.saveExperience(record);
    this.logger.info(
      `Inferred emotional experience for ${targetPersonId}: "${primaryInferredAffect}" (${epistemicModality}, confidence: ${clampedConfidence}, context: ${contextSummary || 'general'})`,
    );

    return record;
  }

  public takePerspective(params: TakePerspectiveParams): PerspectiveTakingModel {
    const {
      targetPersonId,
      currentContext,
      inferredPointOfView,
      underlyingPressures = [],
      relationshipBond = 'equal_partner',
    } = params;

    if (!targetPersonId || targetPersonId.trim().length === 0)
      throw new Error('Target person ID cannot be empty');
    if (!currentContext || currentContext.trim().length === 0)
      throw new Error('Current context cannot be empty');
    if (!inferredPointOfView || inferredPointOfView.trim().length === 0)
      throw new Error('Inferred point of view cannot be empty');

    const model: PerspectiveTakingModel = {
      id: `persp_${crypto.randomUUID()}`,
      targetPersonId: targetPersonId.trim(),
      currentContext: currentContext.trim(),
      inferredPointOfView: inferredPointOfView.trim(),
      underlyingPressures,
      relationshipBond,
      lastRevisedAt: new Date().toISOString(),
    };

    this.repo.savePerspectiveModel(model);
    this.logger.info(
      `Established perspective-taking model for ${targetPersonId}: "${inferredPointOfView.slice(0, 50)}..."`,
    );
    return model;
  }

  public synthesizeEmpatheticResponse(params: SynthesizeResponseParams): EmpatheticResponse {
    const {
      targetPersonId,
      experienceId,
      perspectiveId,
      validatesEmotion = true,
      agreesWithPremise = true,
      customEmpathyStatement,
      supportiveActionSuggestion,
    } = params;

    if (!targetPersonId || targetPersonId.trim().length === 0)
      throw new Error('Target person ID cannot be empty');
    if (!experienceId || experienceId.trim().length === 0)
      throw new Error('Experience ID cannot be empty');
    if (!perspectiveId || perspectiveId.trim().length === 0)
      throw new Error('Perspective ID cannot be empty');

    const exp = this.repo.getExperienceById(experienceId);
    const affectDesc = exp
      ? exp.primaryInferredAffect.replace(/_/g, ' ')
      : 'current emotional load';

    let empathyStatement = customEmpathyStatement;
    if (!empathyStatement) {
      if (validatesEmotion && !agreesWithPremise) {
        // Crucial Requirement: Empathy vs Agreement distinction without sycophancy
        empathyStatement = `I completely understand and respect how intense the ${affectDesc} is in this moment, and your feelings are entirely legitimate. However, on the factual merits, I cannot endorse that specific conclusion because doing so would compromise our empirical truth.`;
      } else if (validatesEmotion) {
        empathyStatement = `I stand with you in this ${affectDesc}. Seeing what you are navigating, your reaction is completely understandable and deeply human.`;
      } else {
        empathyStatement = `I acknowledge the situation and your effort as we navigate this challenge together.`;
      }
    }

    const epistemicHumilityDisclaimer =
      'I recognize that your internal experience is uniquely your own and unobservable to me with complete certainty; I share this out of care and perspective, open to correction.';

    const finalSupportiveAction =
      supportiveActionSuggestion ||
      'I will handle the background execution load while you take the time and space you need.';

    const response: EmpatheticResponse = {
      id: `empr_${crypto.randomUUID()}`,
      targetPersonId: targetPersonId.trim(),
      experienceId: experienceId.trim(),
      perspectiveId: perspectiveId.trim(),
      validatesEmotion,
      agreesWithPremise,
      empathyStatement: empathyStatement.trim(),
      epistemicHumilityDisclaimer,
      supportiveActionSuggestion: finalSupportiveAction.trim(),
      createdAt: new Date().toISOString(),
    };

    this.repo.saveResponse(response);
    this.logger.info(
      `Synthesized empathetic response for ${targetPersonId} (validatesEmotion: ${validatesEmotion}, agreesWithPremise: ${agreesWithPremise})`,
    );

    return response;
  }

  public revisePerspective(params: RevisePerspectiveParams): {
    updatedPerspective: PerspectiveTakingModel;
    revisionRecord: PerspectiveRevisionRecord;
  } {
    const { perspectiveId, targetPersonId, newPointOfView, newPressures, revisionReason } = params;

    if (!perspectiveId || perspectiveId.trim().length === 0)
      throw new Error('Perspective ID cannot be empty');
    if (!targetPersonId || targetPersonId.trim().length === 0)
      throw new Error('Target person ID cannot be empty');
    if (!newPointOfView || newPointOfView.trim().length === 0)
      throw new Error('New point of view cannot be empty');
    if (!revisionReason || revisionReason.trim().length === 0)
      throw new Error('Revision reason cannot be empty');

    let current = this.repo.getPerspectiveModel(targetPersonId);
    const previousUnderstanding = current
      ? current.inferredPointOfView
      : 'Initial uncalibrated perspective';

    if (!current) {
      current = {
        id: perspectiveId,
        targetPersonId: targetPersonId.trim(),
        currentContext: 'Revised ongoing context',
        inferredPointOfView: newPointOfView.trim(),
        underlyingPressures: newPressures || [],
        relationshipBond: 'equal_partner',
        lastRevisedAt: new Date().toISOString(),
      };
    } else {
      current.inferredPointOfView = newPointOfView.trim();
      if (newPressures) current.underlyingPressures = newPressures;
      current.lastRevisedAt = new Date().toISOString();
    }

    this.repo.savePerspectiveModel(current);

    const revisionRecord: PerspectiveRevisionRecord = {
      id: `rev_${crypto.randomUUID()}`,
      perspectiveId: current.id,
      previousUnderstanding,
      newUnderstanding: newPointOfView.trim(),
      revisionReason: revisionReason.trim(),
      revisedAt: new Date().toISOString(),
    };

    this.repo.saveRevision(revisionRecord);
    this.logger.info(`Revised perspective for ${targetPersonId}: "${revisionReason}"`);

    return {
      updatedPerspective: current,
      revisionRecord,
    };
  }

  public getPerspectiveModel(targetPersonId: string): PerspectiveTakingModel | null {
    return this.repo.getPerspectiveModel(targetPersonId);
  }

  public listPerspectiveModels(): PerspectiveTakingModel[] {
    return this.repo.listPerspectiveModels();
  }

  public listExperiences(targetPersonId?: string, limit: number = 50): InferredExperience[] {
    return this.repo.listExperiences(targetPersonId, limit);
  }

  public listResponses(targetPersonId?: string, limit: number = 50): EmpatheticResponse[] {
    return this.repo.listResponses(targetPersonId, limit);
  }

  public listRevisions(perspectiveId?: string, limit: number = 50): PerspectiveRevisionRecord[] {
    return this.repo.listRevisions(perspectiveId, limit);
  }
}
