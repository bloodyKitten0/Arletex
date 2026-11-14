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

    // 2. Personality Engine modulates appraisal (Arlecchino composure, Fischer drive, Anko autonomy)
    const appraisal = this.personalityEngine.modulateAppraisal(rawAppraisal, event);

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

      // Step D: Self Model records reflection if event is personally/existentially significant
      this.selfModelEngine.reflectOnEvent(event, appraisal);
      const selfModel = this.selfModelEngine.getState();

      // Step E: Development Engine checks for interest evolution and developmental milestones
      this.developmentEngine.evaluateEventDevelopment(event, appraisal);
      const development = this.developmentEngine.getState();

      // Step F: Retrieve updated personality state
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
