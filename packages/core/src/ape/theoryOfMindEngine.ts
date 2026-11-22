import crypto from 'node:crypto';
import {
  AgentMentalModel,
  InferredBelief,
  InferredIntention,
  SocialPrediction,
} from '@arletex/contracts';
import { ITheoryOfMindRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryTheoryOfMindRepository implements ITheoryOfMindRepository {
  private agents: Map<string, AgentMentalModel> = new Map();
  private beliefs: InferredBelief[] = [];
  private intentions: InferredIntention[] = [];
  private predictions: SocialPrediction[] = [];

  public saveAgentModel(model: AgentMentalModel): void {
    this.agents.set(model.agentId, { ...model });
  }

  public getAgentModel(agentId: string): AgentMentalModel | null {
    const item = this.agents.get(agentId);
    return item ? { ...item } : null;
  }

  public listAgentModels(): AgentMentalModel[] {
    return Array.from(this.agents.values());
  }

  public saveBelief(belief: InferredBelief): void {
    const idx = this.beliefs.findIndex((b) => b.id === belief.id);
    if (idx >= 0) {
      this.beliefs[idx] = { ...belief };
    } else {
      this.beliefs.unshift({ ...belief });
    }
  }

  public getBelief(agentId: string, topic: string): InferredBelief | null {
    const item = this.beliefs.find((b) => b.agentId === agentId && b.topic === topic);
    return item ? { ...item } : null;
  }

  public listBeliefs(agentId?: string): InferredBelief[] {
    let list = this.beliefs;
    if (agentId) {
      list = list.filter((b) => b.agentId === agentId);
    }
    return list;
  }

  public saveIntention(intention: InferredIntention): void {
    this.intentions.unshift({ ...intention });
  }

  public listIntentions(agentId?: string, limit: number = 50): InferredIntention[] {
    let list = this.intentions;
    if (agentId) {
      list = list.filter((i) => i.agentId === agentId);
    }
    return list.slice(0, limit);
  }

  public saveSocialPrediction(prediction: SocialPrediction): void {
    this.predictions.unshift({ ...prediction });
  }

  public listSocialPredictions(agentId?: string, limit: number = 50): SocialPrediction[] {
    let list = this.predictions;
    if (agentId) {
      list = list.filter((p) => p.agentId === agentId);
    }
    return list.slice(0, limit);
  }
}

export interface InferBeliefParams {
  agentId: string;
  topic: string;
  agentBeliefContent: string;
  groundTruthContent: string;
  agentHadPerceptualAccess: boolean;
  evidenceSignals?: string[];
  confidence?: number;
}

export interface InferIntentionParams {
  agentId: string;
  observedBehavior: string;
  candidateIntention: string;
  contextSignals?: string[];
  alternativeHypotheses?: string[];
  rawConfidence?: number;
}

export interface PredictSocialActionParams {
  agentId: string;
  context: string;
  targetGoalOrObject: string;
}

export class TheoryOfMindEngine {
  private repo: ITheoryOfMindRepository;
  private logger: ILogger;

  constructor(repo?: ITheoryOfMindRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryTheoryOfMindRepository();
    this.logger = logger.child('TheoryOfMindEngine');
    this.ensureBaselineAgents();
  }

  private ensureBaselineAgents(): void {
    const proofModel = this.repo.getAgentModel('proof');
    if (!proofModel) {
      const now = new Date().toISOString();
      this.repo.saveAgentModel({
        agentId: 'proof',
        agentName: 'Proof',
        relationship: 'partner_equal',
        knownPreferences: [
          'equal intellectual partnership',
          'strict honesty and zero sycophancy',
          'empirical verification and clean architecture',
          'mutual creative growth and autonomous agency',
        ],
        epistemicAccess: [
          { topic: 'codebase_state', hasAccess: true, lastObservedAt: now },
          { topic: 'partner_goals', hasAccess: true, lastObservedAt: now },
        ],
        lastInteractionAt: now,
      });
    }
  }

  public registerAgentModel(model: AgentMentalModel): AgentMentalModel {
    if (!model.agentId || model.agentId.trim().length === 0)
      throw new Error('Agent ID cannot be empty');
    if (!model.agentName || model.agentName.trim().length === 0)
      throw new Error('Agent name cannot be empty');

    this.repo.saveAgentModel(model);
    this.logger.info(`Registered mental model for agent: "${model.agentName}" (${model.agentId})`);
    return model;
  }

  public inferBelief(params: InferBeliefParams): InferredBelief {
    const {
      agentId,
      topic,
      agentBeliefContent,
      groundTruthContent,
      agentHadPerceptualAccess,
      evidenceSignals = [],
      confidence = 0.85,
    } = params;

    if (!agentId || agentId.trim().length === 0) throw new Error('Agent ID cannot be empty');
    if (!topic || topic.trim().length === 0) throw new Error('Topic cannot be empty');
    if (!agentBeliefContent || agentBeliefContent.trim().length === 0)
      throw new Error('Agent belief content cannot be empty');
    if (!groundTruthContent || groundTruthContent.trim().length === 0)
      throw new Error('Ground truth content cannot be empty');

    // Epistemic Differentiation:
    // If agent lacked perceptual access to the recent update, or belief diverges from ground truth,
    // it is explicitly recognized as a mistaken / false belief!
    const isFalseBelief =
      !agentHadPerceptualAccess || agentBeliefContent.trim() !== groundTruthContent.trim();

    // Bounded epistemic confidence (never 1.0, preserving unobservable mental state uncertainty)
    const clampedConfidence = Number(Math.max(0.1, Math.min(0.92, confidence)).toFixed(3));

    const record: InferredBelief = {
      id: `bel_${crypto.randomUUID()}`,
      agentId: agentId.trim(),
      topic: topic.trim(),
      agentBeliefContent: agentBeliefContent.trim(),
      groundTruthContent: groundTruthContent.trim(),
      isFalseBelief,
      confidence: clampedConfidence,
      evidenceSignals,
      inferredAt: new Date().toISOString(),
    };

    this.repo.saveBelief(record);
    this.logger.info(
      `Inferred belief for agent ${agentId} on "${topic}" (false belief: ${isFalseBelief}, confidence: ${clampedConfidence})`,
    );

    return record;
  }

  public inferIntention(params: InferIntentionParams): InferredIntention {
    const {
      agentId,
      observedBehavior,
      candidateIntention,
      contextSignals = [],
      alternativeHypotheses = [],
      rawConfidence = 0.8,
    } = params;

    if (!agentId || agentId.trim().length === 0) throw new Error('Agent ID cannot be empty');
    if (!observedBehavior || observedBehavior.trim().length === 0)
      throw new Error('Observed behavior cannot be empty');
    if (!candidateIntention || candidateIntention.trim().length === 0)
      throw new Error('Candidate intention cannot be empty');

    // Acceptance Criteria Invariant:
    // "Avoid treating inferred intentions as established facts"
    // Confidence is strictly bounded below 0.90 to preserve inherent opacity of other minds.
    const clampedConfidence = Number(Math.max(0.1, Math.min(0.88, rawConfidence)).toFixed(3));

    // Provide default alternative hypotheses and uncertainty factors if none supplied
    const finalAlternatives =
      alternativeHypotheses.length > 0
        ? alternativeHypotheses
        : [
            `Exploratory or tangential task engagement`,
            `Unobserved external constraint or interruption`,
            `Alternative priority unknown to Arle`,
          ];

    const uncertaintyFactors = [
      'Internal subjective experience is fundamentally unobservable',
      `Behavioral cues may reflect intermediate subgoals (${observedBehavior.slice(0, 40)}...)`,
      ...contextSignals,
    ];

    const record: InferredIntention = {
      id: `int_${crypto.randomUUID()}`,
      agentId: agentId.trim(),
      observedBehavior: observedBehavior.trim(),
      primaryInferredIntention: candidateIntention.trim(),
      confidence: clampedConfidence,
      uncertaintyFactors,
      alternativeHypotheses: finalAlternatives,
      inferredAt: new Date().toISOString(),
    };

    this.repo.saveIntention(record);
    this.logger.info(
      `Inferred intention for agent ${agentId}: "${candidateIntention}" (confidence: ${clampedConfidence})`,
    );

    return record;
  }

  public predictSocialAction(params: PredictSocialActionParams): SocialPrediction {
    const { agentId, context, targetGoalOrObject } = params;

    if (!agentId || agentId.trim().length === 0) throw new Error('Agent ID cannot be empty');
    if (!context || context.trim().length === 0) throw new Error('Context cannot be empty');
    if (!targetGoalOrObject || targetGoalOrObject.trim().length === 0)
      throw new Error('Target goal or object cannot be empty');

    // Fetch the agent's inferred belief regarding this target
    const belief = this.repo.getBelief(agentId, targetGoalOrObject);

    let predictedAction: string;
    let beliefBasis: string;
    let expectedOutcome: string;

    if (belief && belief.isFalseBelief) {
      // Social Prediction Invariant:
      // Agents act based on their *inferred beliefs*, NOT based on Arle's ground truth!
      predictedAction = `Act towards "${belief.agentBeliefContent}" in accordance with mistaken belief`;
      beliefBasis = `Agent holds false belief that ${targetGoalOrObject} is at "${belief.agentBeliefContent}", unaware that ground truth is "${belief.groundTruthContent}".`;
      expectedOutcome = `Surprise or search redirection upon discovering discrepancy with reality.`;
    } else if (belief) {
      predictedAction = `Directly pursue "${belief.agentBeliefContent}" matching verified reality`;
      beliefBasis = `Agent holds accurate belief corresponding to ground truth.`;
      expectedOutcome = `Smooth execution and fulfillment of target objective.`;
    } else {
      predictedAction = `Inquire or visually search environment for "${targetGoalOrObject}"`;
      beliefBasis = `Agent currently has no established belief record on "${targetGoalOrObject}".`;
      expectedOutcome = `Information gathering phase prior to decisive action.`;
    }

    const prediction: SocialPrediction = {
      id: `pred_${crypto.randomUUID()}`,
      agentId: agentId.trim(),
      context: context.trim(),
      predictedAction,
      predictedLikelihood: belief ? belief.confidence : 0.65,
      beliefBasis,
      expectedOutcome,
      createdAt: new Date().toISOString(),
    };

    this.repo.saveSocialPrediction(prediction);
    this.logger.info(
      `Formulated social prediction for agent ${agentId}: "${predictedAction}" (basis: ${beliefBasis})`,
    );

    return prediction;
  }

  public getAgentModel(agentId: string): AgentMentalModel | null {
    return this.repo.getAgentModel(agentId);
  }

  public listAgentModels(): AgentMentalModel[] {
    return this.repo.listAgentModels();
  }

  public getInferredBelief(agentId: string, topic: string): InferredBelief | null {
    return this.repo.getBelief(agentId, topic);
  }

  public listInferredBeliefs(agentId?: string): InferredBelief[] {
    return this.repo.listBeliefs(agentId);
  }

  public listInferredIntentions(agentId?: string, limit: number = 50): InferredIntention[] {
    return this.repo.listIntentions(agentId, limit);
  }

  public listSocialPredictions(agentId?: string, limit: number = 50): SocialPrediction[] {
    return this.repo.listSocialPredictions(agentId, limit);
  }
}
