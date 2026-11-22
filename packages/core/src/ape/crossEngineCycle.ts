import {
  ApeAppraisal,
  ApeDevelopmentState,
  ApeEvent,
  ApeMasterState,
  ApeMotivationalState,
  ApePersonalityState,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ApeRelationshipState,
  ApeSelfModel,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';
import { AppraisalEngine } from './appraisalEngine.js';
import { AffectiveTransitionEngine } from './affectiveTransitionEngine.js';
import { PersonalityEngine } from './personalityEngine.js';
import { MotivationalEngine } from './motivationalEngine.js';
import { RelationshipEngine } from './relationshipEngine.js';
import { SelfModelEngine } from './selfModelEngine.js';
import { DevelopmentEngine } from './developmentEngine.js';

export interface CrossEngineCycleResult {
  processed: boolean;
  appraisal: ApeAppraisal;
  affective: ApePsychologicalState;
  personality: ApePersonalityState;
  motivational: ApeMotivationalState;
  relationship: ApeRelationshipState;
  selfModel: ApeSelfModel;
  development: ApeDevelopmentState;
}

export class CrossEngineCognitiveCycle {
  private readonly repo: IApeRepository;
  private readonly logger: ILogger;
  private readonly appraisalEngine: AppraisalEngine;
  private readonly affectiveEngine: AffectiveTransitionEngine;
  private readonly personalityEngine: PersonalityEngine;
  private readonly motivationalEngine: MotivationalEngine;
  private readonly relationshipEngine: RelationshipEngine;
  private readonly selfModelEngine: SelfModelEngine;
  private readonly developmentEngine: DevelopmentEngine;

  constructor(
    repo: IApeRepository,
    appraisalEngine: AppraisalEngine,
    affectiveEngine: AffectiveTransitionEngine,
    personalityEngine: PersonalityEngine,
    motivationalEngine: MotivationalEngine,
    relationshipEngine: RelationshipEngine,
    selfModelEngine: SelfModelEngine,
    developmentEngine: DevelopmentEngine,
    logger: ILogger = rootLogger,
  ) {
    this.repo = repo;
    this.appraisalEngine = appraisalEngine;
    this.affectiveEngine = affectiveEngine;
    this.personalityEngine = personalityEngine;
    this.motivationalEngine = motivationalEngine;
    this.relationshipEngine = relationshipEngine;
    this.selfModelEngine = selfModelEngine;
    this.developmentEngine = developmentEngine;
    this.logger = logger;
  }

  /**
   * Executes the full cross-engine cognitive processing cycle.
   */
  public async executeCycle(
    event: ApeEvent,
    currentAffective: ApePsychologicalState,
    relationshipConfig: ApeRelationshipConfig,
  ): Promise<CrossEngineCycleResult> {
    // 1. Initial semantic appraisal (Async with LLM assistance if nuanced)
    const rawAppraisal = await this.appraisalEngine.appraiseAsync(
      event,
      currentAffective,
      relationshipConfig,
    );

    // 2. Sequential 6-Engine Causal Appraisal Modulation:
    // A: Personality Engine modulates (Arlecchino composure, Fischer drive, Anko autonomy)
    const modulatedByPersonality = this.personalityEngine.modulateAppraisal(rawAppraisal, event);

    // B: Motivational Engine modulates (Curiosity drive, Competence need, Rest balance, Intimacy)
    const modulatedByMotivation = this.motivationalEngine.modulateAppraisal(
      modulatedByPersonality,
      event,
    );

    // C: Relationship Engine modulates (Partner trust, attachment security, conflict history)
    const modulatedByRelationship = this.relationshipEngine.modulateAppraisal(
      modulatedByMotivation,
      event,
    );

    // D: Self Model Engine modulates (Known capabilities, empirical limitations, existential salience)
    const modulatedBySelfModel = this.selfModelEngine.modulateAppraisal(
      modulatedByRelationship,
      event,
    );

    // E: Development Engine modulates (Active interests depth/mastery)
    const appraisal = this.developmentEngine.modulateAppraisal(modulatedBySelfModel, event);

    // 3. Synchronous Atomic Transaction across all six persistent engines
    return this.repo.transaction(() => {
      // Step A: Affective Engine transitions
      const affective = this.affectiveEngine.applyAppraisal(
        appraisal,
        event,
        currentAffective,
        relationshipConfig,
      );

      // Step B: Motivational Engine updates needs & evaluates drives
      const motivational = this.motivationalEngine.updateNeedsOnEvent(event, appraisal);

      // Step C: Relationship Engine processes interpersonal impact
      const relationship = this.relationshipEngine.processInteraction(event, appraisal);

      // Step D: Self Model records reflection, verified experiences, and behavioral shifts
      if (
        event.eventKind === 'action_outcome' ||
        event.category === 'success' ||
        event.category === 'failure' ||
        event.payload?.verifiedOutcome !== undefined
      ) {
        const domain = (event.payload?.domain as string) || event.type || 'operational_task';
        const operation =
          (event.payload?.operation as string) ||
          (event.payload?.taskTitle as string) ||
          event.type;
        const success =
          event.category === 'failure'
            ? false
            : Boolean(event.payload?.success ?? event.category === 'success');
        const evidence =
          (event.payload?.evidence as string) ||
          appraisal.supportingEvidence?.[0] ||
          'Execution recorded';
        const provenance = (event.payload?.provenance as string) || 'cycle_event';
        this.selfModelEngine.applyVerifiedExperience({
          domain,
          operation,
          success,
          evidence,
          provenance,
          eventId: event.id,
          error: event.payload?.error as string | undefined,
        });
      }

      this.selfModelEngine.reflectOnEvent(event, appraisal);
      this.selfModelEngine.detectBehavioralChanges();
      const selfModel = this.selfModelEngine.getState();

      // Step E: Development Engine checks for interest evolution and developmental milestones
      this.developmentEngine.evaluateEventDevelopment(event, appraisal);
      const development = this.developmentEngine.getState();

      // Step F: Retrieve updated personality state and record evidence
      if (event.category === 'goal_achievement' || event.category === 'success') {
        this.personalityEngine.recordTraitEvidence('competitiveness', {
          isSupporting: true,
          explanation: `Demonstrated competitive competence on ${event.type}`,
        });
      }
      const personality = this.personalityEngine.getState();

      // Step G: Mark event processed in SQLite journal
      this.repo.saveEventProcessingStatus(event.id, 'processed');

      this.logger.info(
        `CrossEngineCycle committed transaction for "${event.type}" [Method: ${appraisal.appraisalMethod}] | Mood: ${affective.currentMood} | Trust: ${(relationship.trustLevel * 100).toFixed(0)}%`,
      );

      return {
        processed: true,
        appraisal,
        affective,
        personality,
        motivational,
        relationship,
        selfModel,
        development,
      };
    });
  }

  /**
   * Retrieves full unified state across all six engines.
   */
  public getMasterState(): ApeMasterState {
    return {
      affective: this.repo.getAffectiveState(),
      personality: this.personalityEngine.getState(),
      motivational: this.motivationalEngine.getState(),
      relationship: this.relationshipEngine.getState(),
      selfModel: this.selfModelEngine.getState(),
      development: this.developmentEngine.getState(),
    };
  }
}
