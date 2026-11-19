import crypto from 'node:crypto';
import {
  ActionProposal,
  ActionType,
  ApeAppraisal,
  ApeEvent,
  ApeEventCategory,
  ApeEventKind,
  ApePsychologicalState,
  CognitiveCycleResult,
  CognitiveCycleResultSchema,
  CognitiveDecision,
  CognitiveDecisionSchema,
  CognitiveEvent,
  CognitiveEventSchema,
  CognitiveEventType,
  CognitivePipelineStage,
  MemoryProvenance,
  RiskLevel,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ApeService } from '../ape/apeService.js';
import { ActionPermissionController } from '../agency/actionPermissionController.js';
import { VerificationEngine } from '../agency/verificationEngine.js';
import { IExperienceMemorySink } from '../agency/memoryExperienceSync.js';
import { IntentTaskManager } from '../agency/intentTaskManager.js';
import { AutobiographicalMemoryService } from '../memory/autobiographicalMemoryService.js';
import { ClosedLoopAgencyService } from '../agency/closedLoopAgencyService.js';

export interface CognitiveControlBusDependencies {
  apeService: ApeService;
  permissionController?: ActionPermissionController;
  verificationEngine?: VerificationEngine;
  memorySink?: IExperienceMemorySink;
  autobiographicalMemoryService?: AutobiographicalMemoryService;
  intentTaskManager?: IntentTaskManager;
  closedLoopAgency?: ClosedLoopAgencyService;
  logger?: ILogger;
  maxCausalDepth?: number;
}

export class CognitiveControlBus {
  private readonly apeService: ApeService;
  private readonly permissionController?: ActionPermissionController;
  private readonly verificationEngine?: VerificationEngine;
  private readonly memorySink?: IExperienceMemorySink;
  private readonly autobiographicalMemoryService?: AutobiographicalMemoryService;
  private readonly intentTaskManager?: IntentTaskManager;
  private readonly closedLoopAgency?: ClosedLoopAgencyService;
  private readonly logger: ILogger;
  private readonly maxCausalDepth: number;

  private readonly eventHistory: CognitiveEvent[] = [];
  private readonly decisionHistory: CognitiveDecision[] = [];
  private readonly idempotencyCache = new Map<string, CognitiveCycleResult>();

  private totalEventsProcessed = 0;
  private totalDeduplicated = 0;
  private processingQueue: Promise<void> = Promise.resolve();

  constructor(deps: CognitiveControlBusDependencies) {
    this.apeService = deps.apeService;
    this.permissionController = deps.permissionController;
    this.verificationEngine = deps.verificationEngine;
    this.memorySink = deps.memorySink;
    this.autobiographicalMemoryService = deps.autobiographicalMemoryService;
    this.intentTaskManager = deps.intentTaskManager;
    this.closedLoopAgency = deps.closedLoopAgency;
    this.logger = (deps.logger || rootLogger).child('CognitiveControlBus');
    this.maxCausalDepth = deps.maxCausalDepth ?? 4;
  }

  /**
   * Main entry point: dispatches an event through the individual-level cognitive control pipeline.
   * Concurrently queued serially to guarantee strict event ordering, transaction safety, and crash recovery.
   */
  public dispatch(
    input: Partial<CognitiveEvent> & {
      type: CognitiveEventType;
      source: CognitiveEvent['source'];
      payload?: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ): Promise<CognitiveCycleResult> {
    return new Promise<CognitiveCycleResult>((resolve, reject) => {
      this.processingQueue = this.processingQueue
        .catch(() => {}) // never poison the queue on error
        .then(() => this.dispatchInternal(input))
        .then(resolve, reject);
    });
  }

  private async dispatchInternal(
    input: Partial<CognitiveEvent> & {
      type: CognitiveEventType;
      source: CognitiveEvent['source'];
      payload?: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ): Promise<CognitiveCycleResult> {
    const timestamp = input.timestamp || new Date().toISOString();
    const eventId = input.id || crypto.randomUUID();
    const idempotencyKey =
      input.idempotencyKey ||
      `${input.type}:${input.source}:${input.timestamp || timestamp}:${JSON.stringify(input.payload || {})}`;

    // 1. Idempotency Check (Deduplication) - Memory cache
    if (this.idempotencyCache.has(idempotencyKey)) {
      this.totalDeduplicated++;
      this.logger.info(`Deduplicated event [${input.type}] with key "${idempotencyKey}" (in-memory)`);
      const cached = this.idempotencyCache.get(idempotencyKey)!;
      return {
        ...cached,
        wasDeduplicated: true,
      };
    }

    // Check durable SQLite idempotency repository
    const repo = (this.apeService as any)?.repo;
    if (repo && typeof repo.getIdempotencyRecord === 'function') {
      const persisted = repo.getIdempotencyRecord(idempotencyKey);
      if (persisted) {
        this.totalDeduplicated++;
        this.logger.info(`Deduplicated event [${input.type}] with key "${idempotencyKey}" (durable SQLite)`);
        this.idempotencyCache.set(idempotencyKey, persisted);
        return {
          ...persisted,
          wasDeduplicated: true,
        };
      }
    }

    // 2. Circular Cascade Protection
    const causalDepth = input.causalDepth ?? 0;
    if (causalDepth > this.maxCausalDepth) {
      const errMsg = `Causal depth limit (${this.maxCausalDepth}) exceeded at depth ${causalDepth}. Halting to prevent circular cognitive cascades.`;
      this.logger.warn(errMsg, { eventId, type: input.type, parent: input.causalParentEventId });
      return {
        eventId,
        idempotencyKey,
        wasDeduplicated: false,
        stagesCompleted: [],
        pipelineCompleted: false,
        actionAttempted: false,
        actionExecuted: false,
        outcomeObserved: false,
        outcomeVerified: false,
        taskSucceeded: false,
        success: false,
        error: errMsg,
        memoriesCommitted: [],
      };
    }

    const stagesCompleted: CognitivePipelineStage[] = ['ingestion'];

    const parseResult = CognitiveEventSchema.safeParse({
      id: eventId,
      type: input.type,
      timestamp,
      source: input.source,
      actor: input.actor || (input.source === 'user' || input.source === 'telegram' ? 'user' : 'arle'),
      causalParentEventId: input.causalParentEventId,
      causalDepth,
      payload: input.payload || {},
      idempotencyKey,
      status: 'processing',
      processedStages: stagesCompleted,
    });

    if (!parseResult.success) {
      const errMsg = `Provenance validation failed: schema validation error: ${parseResult.error.message}`;
      this.logger.warn(errMsg, { eventId, source: input.source });
      return {
        eventId,
        idempotencyKey,
        wasDeduplicated: false,
        stagesCompleted,
        pipelineCompleted: false,
        actionAttempted: false,
        actionExecuted: false,
        outcomeObserved: false,
        outcomeVerified: false,
        taskSucceeded: false,
        success: false,
        error: errMsg,
        memoriesCommitted: [],
      };
    }

    const event: CognitiveEvent = parseResult.data;
    const memoriesCommitted: string[] = [];
    let decision: CognitiveDecision | undefined;
    let appraisal: ApeAppraisal | undefined;
    let reflectionText: string | undefined;
    const milestoneId: string | undefined = undefined;

    try {
      // Stage 2: Normalization
      stagesCompleted.push('normalization');
      event.payload = this.normalizePayload(event.payload);
      event.processedStages = [...stagesCompleted];

      // Stage 3: Provenance Validation
      stagesCompleted.push('provenance_validation');
      const isProvenanceValid = this.validateProvenance(event);
      if (!isProvenanceValid) {
        throw new Error(`Provenance validation failed for event ${event.id} from source ${event.source}`);
      }
      event.processedStages = [...stagesCompleted];

      // Stage 4: Perception & Interpretation
      stagesCompleted.push('perception_interpretation');
      const interpretation = this.interpretPerception(event, event.payload);

      // Associative autobiographical memory retrieval
      let associativeMemories: any[] = [];
      if (this.autobiographicalMemoryService) {
        const queryText = (event.payload?.text as string) || (event.payload?.topic as string) || interpretation;
        associativeMemories = this.autobiographicalMemoryService.retrieveAssociativeContext(queryText, { limit: 3 });
      }

      // Stage 5: Appraisal
      stagesCompleted.push('appraisal');
      const apeEvent: ApeEvent = {
        id: event.id,
        category: (event.payload?.originalApeCategory as ApeEventCategory) || this.mapCognitiveTypeToApeCategory(event.type),
        type: (event.payload?.originalApeType as string) || event.type,
        source: event.source,
        actor: event.actor,
        eventKind: this.mapCognitiveSourceToApeKind(event.source),
        payload: {
          ...event.payload,
          _fromCognitiveBus: true,
          interpretation,
          associativeMemories,
        },
        processed: false,
        timestamp: event.timestamp,
      };

      const apeState = this.apeService.getState();
      const relationshipConfig = this.apeService.getRelationshipConfig();

      // Execute full 6-engine cross-engine cognitive cycle
      const cycleResult = await this.apeService.crossEngineCycle.executeCycle(
        apeEvent,
        apeState,
        relationshipConfig,
      );
      appraisal = cycleResult.appraisal;

      // Stage 6: Psychological State Evaluation
      stagesCompleted.push('psychological_evaluation');
      this.apeService.stepLifecycle(timestamp);

      // Stage 7: Motivational Evaluation
      stagesCompleted.push('motivational_evaluation');
      if (event.source === 'user') {
        this.apeService.resourceGovernor.recordUserActivity();
      }
      this.apeService.motivationalEngine.resolveMotivationalConflicts({
        isUserInteracting: event.source === 'user',
        highFatigue: (apeState.contextual.psychologicalEnergy ?? 0.8) < 0.3,
      });

      // Stage 8: Goal Evaluation
      stagesCompleted.push('goal_evaluation');
      this.apeService.personalProjectService.rankActiveProjects();
      const candidateInitiatives = this.apeService.motivationalEngine.generateCandidateInitiatives({
        activeInterests: this.apeService.developmentEngine.getState().interests.map((i) => i.topic),
        unresolvedGoalTitles: this.apeService.motivationalEngine.getState().goals
          .filter((g) => g.status === 'active' || g.status === 'committed')
          .map((g) => g.title),
      });

      // Stage 9: Decision Selection (Explainable Decision Architecture)
      stagesCompleted.push('decision_selection');
      decision = this.formulateDecision(event, appraisal, candidateInitiatives, apeState);
      this.decisionHistory.unshift(decision);
      if (this.decisionHistory.length > 100) this.decisionHistory.pop();

      // Stage 10: Permission Assessment
      stagesCompleted.push('permission_assessment');
      let isAuthorized = true;
      let permissionReason = 'No special permission required for internal decision';
      const proposal = this.buildActionProposal(decision, event);

      if (decision.permissionRequired) {
        if (!this.permissionController) {
          isAuthorized = false;
          permissionReason = 'Permission controller not configured; action denied fail-closed';
          this.logger.warn(`Decision ${decision.id} denied: no permission controller configured`);
        } else if (!proposal) {
          isAuthorized = false;
          permissionReason = 'Action proposal missing for permission evaluation; denied fail-closed';
          this.logger.warn(`Decision ${decision.id} denied: missing action proposal`);
        } else {
          const check = this.permissionController.evaluate(proposal);
          isAuthorized = check.decision === 'granted';
          permissionReason = check.reason;
          if (!isAuthorized) {
            this.logger.warn(`Decision ${decision.id} denied by permission controller: ${permissionReason}`);
          }
        }
      }

      // Stage 11: Action Execution
      stagesCompleted.push('action_execution');
      let actionOutcomeSuccess = isAuthorized;
      let actionExecuted = false;
      let outcomeObserved = false;
      let outcomeVerified = false;
      let verifiedFact: string | undefined;

      if (!isAuthorized) {
        actionOutcomeSuccess = false;
      } else if (proposal && this.closedLoopAgency && (decision.actionType === 'execute_agency_task' || decision.actionType === 'research')) {
        actionExecuted = true;
        const agencyObjective = (event.payload?.objective as string) || (event.payload?.topic as string) || decision.chosenAlternativeReason;
        const loopRes = await this.closedLoopAgency.executeClosedLoop(agencyObjective, 'arle', {
          eventId: event.id,
          decisionId: decision.id,
        });
        actionOutcomeSuccess = loopRes.success;
        outcomeObserved = loopRes.observations.length > 0;
        if (loopRes.verifications.length > 0) {
          const lastVer = loopRes.verifications[loopRes.verifications.length - 1];
          if (lastVer && lastVer.verified) {
            verifiedFact = lastVer.observedOutcome;
            outcomeVerified = true;
          }
        }
      } else if (!proposal) {
        actionExecuted = true;
        actionOutcomeSuccess = true;
      }

      // Stage 12: Outcome Verification (Empirical Evidence Verification - No Synthetic Observations)
      stagesCompleted.push('outcome_verification');
      if (proposal) {
        if (!isAuthorized) {
          actionOutcomeSuccess = false;
          outcomeVerified = false;
          verifiedFact = undefined;
        } else if (!outcomeVerified || !verifiedFact) {
          // An external agency or research action proposal requires empirical verification
          // If no empirical observation verified the outcome, verification fails closed
          actionOutcomeSuccess = false;
          outcomeVerified = false;
          verifiedFact = undefined;
          this.logger.warn(
            `Action proposal ${proposal.id} for decision ${decision.id} completed without empirical observation; verification failed closed.`,
          );
        }
      }
      // Note: If no external action proposal (internal cognitive/expressive action), verifiedFact remains undefined!

      // Stage 13: Memory Integration (Truthful Epistemic Provenance)
      stagesCompleted.push('memory_integration');
      const memContent = this.formatMemoryContent(event, decision, actionOutcomeSuccess, verifiedFact);

      if (this.autobiographicalMemoryService) {
        let autoProvenance: MemoryProvenance;
        if (proposal) {
          autoProvenance = outcomeVerified && actionOutcomeSuccess
            ? 'verified_fact'
            : (actionExecuted ? 'digital_agency' : 'inferred_interpretation');
        } else if (event.source === 'user' || event.source === 'telegram') {
          autoProvenance = 'user_statement';
        } else if (decision.actionType === 'speak') {
          autoProvenance = 'interaction';
        } else {
          autoProvenance = 'autobiographical_experience';
        }

        const mem = this.autobiographicalMemoryService.recordExperience({
          type: 'autobiographical',
          content: memContent,
          rawObservation: verifiedFact,
          provenance: autoProvenance,
          confidence: actionOutcomeSuccess ? 0.95 : 0.60,
          importance: appraisal.dimensions.personalSignificance || 0.6,
          tags: ['cognitive_bus', event.type, decision.actionType, actionOutcomeSuccess ? 'success' : 'failure'],
          metadata: {
            eventId: event.id,
            decisionId: decision.id,
            actionOutcomeSuccess,
            permissionReason,
            pipelineCompleted: true,
            actionAttempted: Boolean(proposal),
            actionExecuted,
            outcomeObserved,
            outcomeVerified,
            taskSucceeded: proposal ? actionOutcomeSuccess : true,
          },
        });
        if (mem && mem.id) {
          memoriesCommitted.push(mem.id);
        }
      } else if (this.memorySink) {
        let sinkProvenance: MemoryProvenance;
        if (proposal) {
          sinkProvenance = outcomeVerified && actionOutcomeSuccess ? 'verified_fact' : 'raw_observation';
        } else if (actionOutcomeSuccess) {
          sinkProvenance = 'verified_fact';
        } else if (event.source === 'user' || event.source === 'telegram') {
          sinkProvenance = 'user_statement';
        } else {
          sinkProvenance = 'raw_observation';
        }

        const mem = await this.memorySink.create?.({
          type: 'episodic',
          content: memContent,
          importance: appraisal.dimensions.personalSignificance || 0.6,
          confidence: actionOutcomeSuccess ? 0.95 : 0.8,
          provenance: sinkProvenance,
          tags: ['cognitive_bus', event.type, decision.actionType, actionOutcomeSuccess ? 'success' : 'failure'],
          metadata: {
            eventId: event.id,
            decisionId: decision.id,
            actionOutcomeSuccess,
            permissionReason,
          },
        });
        if (mem && mem.id) {
          memoriesCommitted.push(mem.id);
        }
      }

      // Stage 14: Reflection (Causal Self-Reflection)
      stagesCompleted.push('reflection');
      reflectionText = this.performCausalReflection(event, decision, actionOutcomeSuccess);
      if (reflectionText) {
        const selfModel = this.apeService.selfModelEngine.getState();
        selfModel.privateReflections = selfModel.privateReflections || [];
        selfModel.privateReflections.unshift({
          id: crypto.randomUUID(),
          topic: event.type,
          content: reflectionText,
          timestamp: new Date().toISOString(),
        });
        if (selfModel.privateReflections.length > 50) {
          selfModel.privateReflections = selfModel.privateReflections.slice(0, 50);
        }

        // If action failed, truthfully log limitation without capability inflation
        if (!actionOutcomeSuccess && decision.actionType !== 'rest' && decision.actionType !== 'speak') {
          selfModel.acknowledgedLimitations = selfModel.acknowledgedLimitations || [];
          const limDesc = `Encountered obstacle or failure executing ${decision.actionType} for event ${event.type}`;
          if (!selfModel.acknowledgedLimitations.includes(limDesc)) {
            selfModel.acknowledgedLimitations.unshift(limDesc);
          }
        }
        this.apeService.selfModelEngine.saveState(selfModel);
      }

      // Stage 15: Development Update
      stagesCompleted.push('development_update');
      const topicHint = (event.payload?.topic as string) || (decision.target as string);
      if (topicHint) {
        this.apeService.developmentEngine.recordPracticeAttempt({
          skillOrTopic: topicHint,
          success: actionOutcomeSuccess,
          evidence: `Cognitive event ${event.type} outcome: ${actionOutcomeSuccess ? 'success' : 'failed'}`,
        });
      }

      // Stage 16: State Persistence
      stagesCompleted.push('state_persistence');
      event.status = 'processed';
      event.processedStages = [...stagesCompleted];

      const currentAffectiveState = this.apeService.getState();
      const taskSucceeded = proposal ? actionOutcomeSuccess : true;
      const result: CognitiveCycleResult = {
        eventId: event.id,
        idempotencyKey,
        wasDeduplicated: false,
        stagesCompleted,
        appraisalSummary: appraisal.primaryInterpretation || `Appraised ${event.type}`,
        activeMood: currentAffectiveState.currentMood,
        activeEmotionCount: currentAffectiveState.activeEmotions.length,
        decision,
        memoriesCommitted,
        reflectionRecorded: reflectionText,
        developmentMilestoneRecorded: milestoneId,
        // Explicit Outcome Model (P0.1)
        pipelineCompleted: true,
        actionAttempted: Boolean(proposal),
        actionExecuted,
        outcomeObserved,
        outcomeVerified,
        taskSucceeded,
        success: true,
      };

      // Store in bounded LRU cache
      this.idempotencyCache.set(idempotencyKey, result);
      if (this.idempotencyCache.size > 200) {
        const oldestKey = this.idempotencyCache.keys().next().value;
        if (oldestKey) this.idempotencyCache.delete(oldestKey);
      }

      // Persist durable idempotency record into SQLite repository if available
      const repo = (this.apeService as any)?.repo;
      if (repo && typeof repo.saveIdempotencyRecord === 'function') {
        try {
          repo.saveIdempotencyRecord({
            idempotencyKey,
            eventId: event.id,
            eventType: event.type,
            source: event.source,
            result,
          });
        } catch (e: any) {
          this.logger.warn(`Failed to persist durable idempotency record: ${e.message}`);
        }
      }

      this.eventHistory.unshift(event);
      if (this.eventHistory.length > 100) this.eventHistory.pop();
      this.totalEventsProcessed++;

      return CognitiveCycleResultSchema.parse(result);
    } catch (err: any) {
      event.status = 'failed';
      event.error = err.message;
      this.logger.error(`Error in cognitive control bus pipeline for event ${event.id}:`, err);

      const failResult: CognitiveCycleResult = {
        eventId: event.id,
        idempotencyKey,
        wasDeduplicated: false,
        stagesCompleted,
        pipelineCompleted: false,
        actionAttempted: false,
        actionExecuted: false,
        outcomeObserved: false,
        outcomeVerified: false,
        taskSucceeded: false,
        success: false,
        error: err.message,
        memoriesCommitted,
      };
      return failResult;
    }
  }

  private normalizePayload(payload: Record<string, unknown>): Record<string, unknown> {
    const normalized: Record<string, unknown> = { ...payload };
    if (typeof normalized.text === 'string') {
      normalized.text = normalized.text.trim();
    }
    return normalized;
  }

  private validateProvenance(event: CognitiveEvent): boolean {
    if (!event.source) return false;
    const allowedSources = ['user', 'telegram', 'agency', 'timer', 'internal', 'environment'];
    return allowedSources.includes(event.source);
  }

  private interpretPerception(event: CognitiveEvent, payload: Record<string, unknown>): string {
    if (payload.interpretation && typeof payload.interpretation === 'string') {
      return payload.interpretation;
    }
    if (payload.text && typeof payload.text === 'string') {
      const claimEval = this.apeService.personalityEngine.evaluateClaim(payload.text);
      if (claimEval.conflicts && claimEval.contradictoryBelief) {
        return `${payload.text} (Intellectual independence: claim conflicts with verified belief on ${claimEval.contradictoryBelief.topic})`;
      }
      return payload.text;
    }
    return `Perceived cognitive event [${event.type}] from [${event.source}]`;
  }

  private mapCognitiveTypeToApeCategory(type: CognitiveEventType): ApeEventCategory {
    switch (type) {
      case 'user_message':
      case 'telegram_message':
      case 'telegram_media':
        return 'user_interaction';
      case 'agency_observation':
      case 'environmental_change':
        return 'environmental_event';
      case 'action_executed':
      case 'task_outcome':
        return 'success';
      case 'goal_activated':
      case 'goal_progress':
      case 'goal_completed':
        return 'goal_achievement';
      case 'goal_failed':
        return 'goal_obstruction';
      case 'intellectual_question':
      case 'project_milestone':
        return 'unexpected_discovery';
      case 'user_departure_under_arousal':
        return 'user_departure_under_arousal';
      case 'user_return':
      case 'relationship_event':
      case 'separation_loneliness':
        return 'relationship_event';
      case 'social_interaction':
        return 'social_interaction';
      case 'conversation_outcome':
        return 'conversation_outcome';
      case 'failure_recovery':
        return 'failure';
      case 'internal_tick':
      case 'reflection_cycle':
      case 'belief_formed':
      case 'belief_revised':
      default:
        return 'internal_reflection';
    }
  }

  private mapCognitiveSourceToApeKind(source: CognitiveEvent['source']): ApeEventKind {
    switch (source) {
      case 'user':
      case 'telegram':
        return 'external_stimulus';
      case 'agency':
        return 'action_outcome';
      case 'environment':
        return 'external_stimulus';
      case 'timer':
        return 'system_lifecycle';
      case 'internal':
      default:
        return 'internal_reflection';
    }
  }

  private formulateDecision(
    event: CognitiveEvent,
    appraisal: ApeAppraisal,
    candidateInitiatives: string[],
    apeState?: ApePsychologicalState,
  ): CognitiveDecision {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const rejectedAlternatives: Array<{ actionType: string; reason: string }> = [];

    // Psychological energy and affective state checks
    const psychEnergy = apeState?.contextual?.psychologicalEnergy ?? 0.8;
    const mood = apeState?.currentMood || 'neutral';
    const motState = this.apeService.motivationalEngine.getState();
    const restNeed = motState.needs.recreation_rest ?? 0.4;
    const isFatigued = psychEnergy < 0.25 || restNeed > 0.85 || mood === 'fatigued' || mood === 'exhausted';

    // Explicit agency action proposal takes precedence
    if (event.payload?.actionProposal) {
      const prop = event.payload.actionProposal as ActionProposal;
      if (isFatigued && prop.riskLevel !== 'low') {
        rejectedAlternatives.push({ actionType: 'execute_agency_task', reason: `High fatigue (${psychEnergy.toFixed(2)}) and elevated rest need (${restNeed.toFixed(2)}) require pausing heavy execution` });
        return CognitiveDecisionSchema.parse({
          id,
          eventId: event.id,
          actionType: 'rest',
          target: prop.type,
          chosenAlternativeReason: `Psychological energy depleted (${psychEnergy.toFixed(2)}); prioritizing cognitive rest and equilibrium before executing ${prop.type}`,
          rejectedAlternatives,
          confidence: 0.90,
          riskAssessment: 'low',
          permissionRequired: false,
          resourceEstimate: { cpu: 'low', gpu: false, timeoutMs: 3000 },
          timestamp,
        });
      }
      rejectedAlternatives.push({ actionType: 'speak', reason: 'Explicit agency action requested; prioritization over plain conversational response' });
      rejectedAlternatives.push({ actionType: 'rest', reason: 'Active agency task must be processed and authorized' });
      return CognitiveDecisionSchema.parse({
        id,
        eventId: event.id,
        actionType: 'execute_agency_task',
        target: prop.type,
        chosenAlternativeReason: `Execute proposed agency task: ${prop.type}`,
        rejectedAlternatives,
        confidence: 0.95,
        riskAssessment: (prop.riskLevel === 'critical' || prop.riskLevel === 'high') ? 'high' : 'moderate',
        permissionRequired: true,
        resourceEstimate: { cpu: 'medium', gpu: false, timeoutMs: 15000 },
        timestamp,
      });
    }

    // Conversational stimulus requires speech
    if (event.type === 'user_message' || event.type === 'telegram_message') {
      rejectedAlternatives.push({ actionType: 'rest', reason: 'User communicated directly; active social engagement required' });
      rejectedAlternatives.push({ actionType: 'execute_agency_task', reason: 'No unverified background task requested in simple dialogue' });
      const userText = (event.payload?.text as string) || '';
      const claimEval = this.apeService.personalityEngine.evaluateClaim(userText);
      const chosenReason = claimEval.conflicts && claimEval.contradictoryBelief
        ? `Respectfully communicate intellectual divergence backed by verified evidence for ${claimEval.contradictoryBelief.topic}`
        : 'Respond directly and authentically to user communication';

      return CognitiveDecisionSchema.parse({
        id,
        eventId: event.id,
        actionType: 'speak',
        target: 'user',
        chosenAlternativeReason: chosenReason,
        rejectedAlternatives,
        confidence: 0.95,
        riskAssessment: 'low',
        permissionRequired: false,
        resourceEstimate: { cpu: 'low', gpu: true, timeoutMs: 8000 },
        timestamp,
      });
    }

    // High curiosity or intellectual discovery triggers research
    if (event.type === 'intellectual_question' || appraisal.dimensions.unexpectedness > 0.7) {
      rejectedAlternatives.push({ actionType: 'rest', reason: 'High novelty and curiosity justify active investigation' });
      rejectedAlternatives.push({ actionType: 'decline', reason: 'Intellectual drive urges exploration of unknown topic' });
      const targetTopic = (event.payload.topic as string) || (candidateInitiatives[0] || 'intellectual_inquiry');
      return CognitiveDecisionSchema.parse({
        id,
        eventId: event.id,
        actionType: 'research',
        target: targetTopic,
        chosenAlternativeReason: 'High novelty and curiosity trigger autonomous evidence collection and investigation',
        rejectedAlternatives,
        confidence: 0.88,
        riskAssessment: 'low',
        permissionRequired: true,
        resourceEstimate: { cpu: 'medium', gpu: false, timeoutMs: 15000 },
        timestamp,
      });
    }

    // Goal failure triggers reflection or strategy reconsideration
    if (event.type === 'goal_failed' || appraisal.dimensions.goalCongruence < -0.3) {
      rejectedAlternatives.push({ actionType: 'execute_agency_task', reason: 'Immediate re-execution without causal reflection risks repeating failure' });
      return CognitiveDecisionSchema.parse({
        id,
        eventId: event.id,
        actionType: 'reflect',
        target: 'failure_recovery',
        chosenAlternativeReason: 'Encountered failure or obstacle; causal reflection required to understand assumptions and update self-model',
        rejectedAlternatives,
        confidence: 0.9,
        riskAssessment: 'low',
        permissionRequired: false,
        resourceEstimate: { cpu: 'low', gpu: false, timeoutMs: 4000 },
        timestamp,
      });
    }

    // Separation / Loneliness / User Departure: causal emotional reflection
    if (
      event.type === 'user_departure_under_arousal' ||
      event.type === 'separation_loneliness' ||
      event.type === 'relationship_event'
    ) {
      rejectedAlternatives.push({ actionType: 'execute_agency_task', reason: 'Emotional appraisal of relational state prioritizes internal consolidation' });
      rejectedAlternatives.push({ actionType: 'rest', reason: 'Relational state requires active emotional processing' });
      return CognitiveDecisionSchema.parse({
        id,
        eventId: event.id,
        actionType: 'reflect',
        target: 'relationship_continuity',
        chosenAlternativeReason: `Processing relational event [${event.type}]; maintaining emotional stability, attachment continuity, and self-regulation`,
        rejectedAlternatives,
        confidence: 0.92,
        riskAssessment: 'low',
        permissionRequired: false,
        resourceEstimate: { cpu: 'low', gpu: false, timeoutMs: 4000 },
        timestamp,
      });
    }

    // Endogenous initiative pursuit triggered by self-generated thoughts or autonomous agency
    if (
      (event.payload?.autonomousInitiative === true || (event.type as string) === 'self_generated_thought') &&
      candidateInitiatives.length > 0 &&
      !isFatigued
    ) {
      const topInitiative = candidateInitiatives[0]!;
      rejectedAlternatives.push({ actionType: 'rest', reason: 'Curiosity drive and healthy energy reserves prioritize endogenous initiative over idle rest' });
      rejectedAlternatives.push({ actionType: 'decline', reason: 'Self-generated goal aligns with active developmental interests' });
      return CognitiveDecisionSchema.parse({
        id,
        eventId: event.id,
        actionType: 'research',
        target: topInitiative,
        chosenAlternativeReason: `Autonomous initiative triggered by intrinsic motivation: ${topInitiative}`,
        rejectedAlternatives,
        confidence: 0.88,
        riskAssessment: 'low',
        permissionRequired: true,
        resourceEstimate: { cpu: 'medium', gpu: false, timeoutMs: 15000 },
        timestamp,
      });
    }

    // Default / idle tick
    rejectedAlternatives.push({ actionType: 'speak', reason: 'No user present; unsolicited chatter avoided' });
    rejectedAlternatives.push({ actionType: 'execute_agency_task', reason: 'No urgent high-priority candidate goals active' });

    return CognitiveDecisionSchema.parse({
      id,
      eventId: event.id,
      actionType: 'rest',
      target: 'internal_equilibrium',
      chosenAlternativeReason: 'No urgent stimulus or high-priority goals; maintaining quiet internal presence and resource equilibrium',
      rejectedAlternatives,
      confidence: 1.0,
      riskAssessment: 'low',
      permissionRequired: false,
      resourceEstimate: { cpu: 'low', gpu: false, timeoutMs: 1000 },
      timestamp,
    });
  }

  private buildActionProposal(decision: CognitiveDecision, event?: CognitiveEvent): ActionProposal | null {
    if (event?.payload?.actionProposal) {
      return event.payload.actionProposal as ActionProposal;
    }
    if (decision.actionType !== 'execute_agency_task' && decision.actionType !== 'research') {
      return null;
    }
    const typeMap: Record<string, ActionType> = {
      execute_agency_task: 'app_launch',
      research: 'web_search',
    };
    return {
      id: crypto.randomUUID(),
      taskId: this.intentTaskManager ? this.intentTaskManager.listTasks()[0]?.id || crypto.randomUUID() : crypto.randomUUID(),
      stepIndex: 0,
      type: typeMap[decision.actionType] || 'web_search',
      payload: { target: decision.target },
      rationale: decision.chosenAlternativeReason,
      expectedOutcome: `Successfully execute ${decision.actionType}`,
      riskLevel: (decision.riskAssessment as RiskLevel) || 'low',
      requiresExplicitApproval: decision.permissionRequired,
      createdAt: decision.timestamp,
    };
  }

  private performCausalReflection(
    event: CognitiveEvent,
    decision: CognitiveDecision,
    outcomeSuccess: boolean,
  ): string {
    if (decision.actionType === 'rest') return '';

    if (!outcomeSuccess) {
      return `Action [${decision.actionType}] for event [${event.type}] encountered an issue. Expected outcome was not achieved. Learning: need to adjust assumptions and verify permissions/resources before next attempt.`;
    }

    if (decision.actionType === 'research') {
      return `Successfully conducted research on [${decision.target || 'topic'}]. Curiosity satisfied with verified empirical evidence.`;
    }

    if (decision.actionType === 'speak') {
      return `Maintained authentic and grounded dialogue with user. Relational continuity preserved.`;
    }

    return `Executed decision [${decision.actionType}] with verified outcome: ${outcomeSuccess ? 'success' : 'failure'}.`;
  }

  private formatMemoryContent(
    _event: CognitiveEvent,
    decision: CognitiveDecision,
    success: boolean,
    verifiedFact?: string,
  ): string {
    const outcomeStr = success ? 'succeeded' : 'failed';
    const detail = verifiedFact ? ` Verified fact: "${verifiedFact}".` : '';
    return `[Cognitive Cycle] ${decision.chosenAlternativeReason}. Decision: ${decision.actionType} (${outcomeStr}).${detail}`;
  }

  public getEventHistory(limit = 20): CognitiveEvent[] {
    return this.eventHistory.slice(0, limit);
  }

  public getDecisionHistory(limit = 20): CognitiveDecision[] {
    return this.decisionHistory.slice(0, limit);
  }

  public getVerificationEngine(): VerificationEngine | undefined {
    return this.verificationEngine;
  }

  public getDeduplicationStats(): { totalProcessed: number; deduplicatedCount: number } {
    return {
      totalProcessed: this.totalEventsProcessed,
      deduplicatedCount: this.totalDeduplicated,
    };
  }

  public clearHistory(): void {
    this.eventHistory.length = 0;
    this.decisionHistory.length = 0;
    this.idempotencyCache.clear();
    this.totalEventsProcessed = 0;
    this.totalDeduplicated = 0;
  }
}
