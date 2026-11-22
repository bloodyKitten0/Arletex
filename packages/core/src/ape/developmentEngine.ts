import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeDevelopmentState,
  ApeEvent,
  ApeInterest,
  InterestDevelopmentStage,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class DevelopmentEngine {
  private readonly repo: IApeRepository;
  private readonly logger: ILogger;

  constructor(repo: IApeRepository, logger: ILogger = rootLogger) {
    this.repo = repo;
    this.logger = logger;
  }

  public getState(): ApeDevelopmentState {
    return this.repo.getDevelopmentState();
  }

  public saveState(state: ApeDevelopmentState): void {
    this.repo.saveDevelopmentState({
      ...state,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Modulates cognitive appraisals according to Arle's evolving interests and competencies.
   */
  public modulateAppraisal(appraisal: ApeAppraisal, event: ApeEvent): ApeAppraisal {
    const state = this.getState();
    const dims = { ...appraisal.dimensions };
    let primaryInterpretation = appraisal.primaryInterpretation;

    const topicCandidate = (
      (event.payload?.topic as string) ||
      (event.payload?.text as string) ||
      event.type ||
      ''
    ).toLowerCase();

    const matchedInterest = state.interests.find(
      (i) =>
        topicCandidate.includes(i.topic.toLowerCase()) ||
        i.topic.toLowerCase().includes(topicCandidate),
    );

    if (matchedInterest) {
      if (matchedInterest.level === 'deep' || matchedInterest.level === 'mastery') {
        dims.goalRelevance = Math.min(1.0, Number((dims.goalRelevance + 0.25).toFixed(3)));
        dims.personalSignificance = Math.min(
          1.0,
          Number((dims.personalSignificance + 0.25).toFixed(3)),
        );
        dims.goalCongruence = Math.min(1.0, Number((dims.goalCongruence + 0.15).toFixed(3)));
        if (!primaryInterpretation.includes('interest')) {
          primaryInterpretation = `${primaryInterpretation} (Directly engages established ${matchedInterest.level} interest in "${matchedInterest.topic}").`;
        }
      } else if (matchedInterest.level === 'emerging') {
        dims.personalSignificance = Math.min(
          1.0,
          Number((dims.personalSignificance + 0.15).toFixed(3)),
        );
      }
    }

    return {
      ...appraisal,
      dimensions: dims,
      primaryInterpretation,
    };
  }

  /**
   * Records a developmental milestone marking significant growth, belief shift, or relationship maturation.
   */
  public recordDevelopmentalMilestone(params: {
    engine: string;
    previousState: string;
    newState: string;
    reasoning: string;
    confidence: number;
    triggerEventId: string;
  }): { id: string; timestamp: string } {
    const state = this.getState();
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    state.developmentalHistory.unshift({
      id,
      engine: params.engine,
      previousState: params.previousState,
      newState: params.newState,
      reasoning: params.reasoning,
      confidence: Math.max(0.0, Math.min(1.0, params.confidence)),
      triggerEventId: params.triggerEventId,
      timestamp,
    });

    if (state.developmentalHistory.length > 100) {
      state.developmentalHistory = state.developmentalHistory.slice(0, 100);
    }

    this.saveState(state);
    this.logger.info(
      `Developmental milestone logged [Engine: ${params.engine}]: "${params.previousState}" -> "${params.newState}" (Reason: ${params.reasoning})`,
    );
    return { id, timestamp };
  }

  /**
   * Registers a new interest upon initial stimulus or environmental exposure.
   */
  public registerInterestExposure(params: {
    topic: string;
    origin?:
      | 'spontaneous'
      | 'conversation'
      | 'reading'
      | 'environmental'
      | 'project'
      | 'unresolved_question'
      | 'external_recommendation';
    initialTrigger?: string;
    relevance?: number;
    novelty?: number;
    curiosity?: number;
  }): ApeInterest {
    const state = this.getState();
    const now = new Date().toISOString();
    let interest = state.interests.find(
      (i) => i.topic.toLowerCase() === params.topic.toLowerCase(),
    );

    if (!interest) {
      interest = {
        topic: params.topic,
        origin: params.origin ?? 'spontaneous',
        initialTrigger: params.initialTrigger ?? 'Initial stimulus exposure',
        relevance: params.relevance ?? 0.5,
        novelty: params.novelty ?? 0.8,
        curiosity: params.curiosity ?? 0.8,
        engagementHistory: [],
        knowledgeLevel: 0.1,
        confidence: 0.5,
        developmentStage: 'exposure',
        level: 'emerging',
        relatedInterests: [],
        associatedGoalIds: [],
        currentMotivationalStrength: params.curiosity ?? 0.7,
        developedAt: now,
        lastEngagedAt: now,
      };
      state.interests.push(interest);
      this.logger.info(
        `Interest registered at 'exposure' stage: "${params.topic}" (Origin: ${interest.origin})`,
      );
    } else {
      interest.novelty = Math.min(1.0, Number(((interest.novelty ?? 0.7) + 0.1).toFixed(2)));
      interest.relevance = Math.min(1.0, Number(((interest.relevance ?? 0.5) + 0.1).toFixed(2)));
      interest.lastEngagedAt = now;
    }

    this.saveState(state);
    return interest;
  }

  /**
   * Records an active engagement with an interest (voluntary vs forced, outcome, satisfaction).
   * Does NOT equate involuntary repeated exposure with genuine interest!
   */
  public recordInterestEngagement(params: {
    topic: string;
    action: string;
    outcome: 'success' | 'failure' | 'frustration' | 'rewarding' | 'neutral';
    voluntary?: boolean;
    satisfaction?: number;
    notes?: string;
  }): ApeInterest {
    const state = this.getState();
    const now = new Date().toISOString();
    let interest = state.interests.find(
      (i) => i.topic.toLowerCase() === params.topic.toLowerCase(),
    );

    if (!interest) {
      this.registerInterestExposure({
        topic: params.topic,
        origin: params.voluntary ? 'spontaneous' : 'environmental',
      });
      interest = state.interests.find((i) => i.topic.toLowerCase() === params.topic.toLowerCase())!;
    }

    const voluntary = params.voluntary ?? true;
    const satisfaction = Math.max(
      0.0,
      Math.min(
        1.0,
        params.satisfaction ??
          (params.outcome === 'rewarding' || params.outcome === 'success' ? 0.8 : 0.4),
      ),
    );

    interest.engagementHistory = interest.engagementHistory || [];
    interest.engagementHistory.push({
      timestamp: now,
      action: params.action,
      outcome: params.outcome,
      voluntary,
      satisfaction,
      notes: params.notes,
    });
    if (interest.engagementHistory.length > 50) {
      interest.engagementHistory = interest.engagementHistory.slice(
        interest.engagementHistory.length - 50,
      );
    }
    interest.lastEngagedAt = now;

    // Epistemic integrity: involuntary exposure does NOT inflate genuine intrinsic interest
    if (!voluntary) {
      this.logger.info(
        `Involuntary engagement for "${interest.topic}" recorded without intrinsic interest inflation.`,
      );
      interest.knowledgeLevel = Math.min(
        1.0,
        Number(((interest.knowledgeLevel ?? 0.1) + 0.02).toFixed(3)),
      );
      this.saveState(state);
      return interest;
    }

    // Voluntary engagement: evaluate outcome and satisfaction
    if (params.outcome === 'rewarding' || params.outcome === 'success') {
      interest.knowledgeLevel = Math.min(
        1.0,
        Number(((interest.knowledgeLevel ?? 0.1) + 0.05).toFixed(3)),
      );
      interest.confidence = Math.min(1.0, Number(((interest.confidence ?? 0.5) + 0.04).toFixed(3)));
      interest.currentMotivationalStrength = Math.min(
        1.0,
        Number(((interest.currentMotivationalStrength ?? 0.7) + 0.06).toFixed(3)),
      );

      // Advance development stage through the canonical 8-stage lifecycle:
      // Exposure -> Attention -> Exploration -> Appraisal -> Formed -> Developing -> Mastery
      const stageProgression: Record<InterestDevelopmentStage, InterestDevelopmentStage> = {
        exposure: 'attention',
        attention: 'exploration',
        exploration: 'appraisal',
        appraisal: 'formed',
        formed: 'developing',
        developing: (interest.knowledgeLevel ?? 0) > 0.75 ? 'mastery' : 'developing',
        mastery: 'mastery',
        fading: 'developing',
        dormant: 'exploration',
        abandoned: 'exposure',
      };

      const oldStage = interest.developmentStage;
      interest.developmentStage = stageProgression[interest.developmentStage] || 'formed';
      if (interest.developmentStage === 'mastery') {
        interest.level = 'mastery';
      } else if (['formed', 'developing'].includes(interest.developmentStage)) {
        interest.level = 'deep';
      } else {
        interest.level = 'emerging';
      }

      this.logger.info(
        `Voluntary rewarding engagement for "${interest.topic}": Stage '${oldStage}' -> '${interest.developmentStage}' (Level: ${interest.level})`,
      );
    } else if (params.outcome === 'frustration' || params.outcome === 'failure') {
      interest.confidence = Math.max(0.1, Number(((interest.confidence ?? 0.5) - 0.05).toFixed(3)));
      if (satisfaction < 0.3) {
        interest.currentMotivationalStrength = Math.max(
          0.1,
          Number(((interest.currentMotivationalStrength ?? 0.7) - 0.08).toFixed(3)),
        );
      }
      this.logger.warn(
        `Engagement frustration for "${interest.topic}": motivational strength adjusted to ${interest.currentMotivationalStrength}`,
      );
    }

    this.saveState(state);
    return interest;
  }

  /**
   * Explicitly weakens an interest due to disengagement, shifting focus, or setback.
   */
  public weakenInterest(topic: string, reason?: string): ApeInterest | null {
    const state = this.getState();
    const interest = state.interests.find((i) => i.topic.toLowerCase() === topic.toLowerCase());
    if (!interest) return null;

    interest.currentMotivationalStrength = Math.max(
      0.1,
      Number(((interest.currentMotivationalStrength ?? 0.7) - 0.2).toFixed(2)),
    );
    if (interest.currentMotivationalStrength < 0.3) {
      interest.developmentStage = 'fading';
      interest.level = 'fading';
    }
    this.logger.info(`Interest "${topic}" weakened (Reason: ${reason || 'Inactivity/Setback'})`);
    this.saveState(state);
    return interest;
  }

  /**
   * Abandons an interest with truthful justification.
   */
  public abandonInterest(topic: string, reason: string): ApeInterest | null {
    const state = this.getState();
    const interest = state.interests.find((i) => i.topic.toLowerCase() === topic.toLowerCase());
    if (!interest) return null;

    interest.developmentStage = 'abandoned';
    interest.level = 'abandoned';
    interest.abandonmentReason = reason;
    interest.currentMotivationalStrength = 0.0;
    this.logger.info(`Interest "${topic}" abandoned: ${reason}`);
    this.saveState(state);
    return interest;
  }

  /**
   * Connects two related interests, establishing conceptual link.
   */
  public connectInterests(topicA: string, topicB: string): void {
    const state = this.getState();
    const a = state.interests.find((i) => i.topic.toLowerCase() === topicA.toLowerCase());
    const b = state.interests.find((i) => i.topic.toLowerCase() === topicB.toLowerCase());

    if (a && b) {
      a.relatedInterests = a.relatedInterests || [];
      b.relatedInterests = b.relatedInterests || [];
      if (!a.relatedInterests.includes(b.topic)) a.relatedInterests.push(b.topic);
      if (!b.relatedInterests.includes(a.topic)) b.relatedInterests.push(a.topic);
      this.saveState(state);
      this.logger.info(`Connected interests: "${a.topic}" <-> "${b.topic}"`);
    }
  }

  public getInterest(topic: string): ApeInterest | null {
    const state = this.getState();
    return state.interests.find((i) => i.topic.toLowerCase() === topic.toLowerCase()) || null;
  }

  public listInterests(stage?: InterestDevelopmentStage): ApeInterest[] {
    const state = this.getState();
    if (stage) {
      return state.interests.filter((i) => i.developmentStage === stage);
    }
    return state.interests;
  }

  /**
   * Manages interest lifecycle: 'emerging' -> 'deep' -> 'mastery' -> 'fading' -> 'dormant'.
   */
  public developInterest(
    topic: string,
    action: 'explore' | 'master' | 'fade' | 'revive' = 'explore',
  ): void {
    const state = this.getState();
    const now = new Date().toISOString();
    let interest = state.interests.find((i) => i.topic.toLowerCase() === topic.toLowerCase());

    if (!interest) {
      interest = {
        topic,
        origin: 'spontaneous',
        initialTrigger: 'Spontaneous exploration',
        relevance: 0.5,
        novelty: 0.8,
        curiosity: 0.8,
        engagementHistory: [],
        knowledgeLevel: 0.1,
        confidence: 0.5,
        developmentStage: 'exploration',
        level: 'emerging',
        relatedInterests: [],
        associatedGoalIds: [],
        currentMotivationalStrength: 0.75,
        developedAt: now,
        lastEngagedAt: now,
      };
      state.interests.push(interest);
      this.logger.info(`New emerging interest acquired: "${topic}"`);
    } else {
      const prevLevel = interest.level;
      if (action === 'explore') {
        interest.developmentStage = 'developing';
        interest.level = interest.level === 'emerging' ? 'deep' : interest.level;
      } else if (action === 'master') {
        if (interest.level === 'deep') {
          interest.level = 'mastery';
          interest.developmentStage = 'mastery';
        } else {
          interest.level = 'deep';
          interest.developmentStage = 'developing';
        }
      } else if (action === 'fade') {
        interest.level =
          interest.level === 'mastery' ? 'deep' : interest.level === 'deep' ? 'fading' : 'dormant';
        interest.developmentStage = interest.level === 'fading' ? 'fading' : 'dormant';
      } else if (action === 'revive') {
        interest.level = 'emerging';
        interest.developmentStage = 'exploration';
      }
      this.logger.info(`Interest in "${topic}" evolved from '${prevLevel}' to '${interest.level}'`);
    }

    this.saveState(state);
  }

  /**
   * Records practice attempts, outcomes, and setbacks toward mastery.
   */
  public recordPracticeAttempt(params: {
    skillOrTopic: string;
    success: boolean;
    evidence: string;
    notes?: string;
  }): void {
    const topic = params.skillOrTopic;
    if (params.success) {
      this.developInterest(topic, 'explore');
      this.logger.info(
        `Development: Successful practice recorded for "${topic}": ${params.evidence}`,
      );
    } else {
      this.logger.warn(`Development: Practice setback recorded for "${topic}": ${params.evidence}`);
    }
  }

  /**
   * Evaluates event for developmental growth or pattern crystallization.
   */
  public evaluateEventDevelopment(event: ApeEvent, appraisal: ApeAppraisal): void {
    const dims = appraisal.dimensions;

    // 1. Intellectual mastery or discovery events
    if (
      event.category === 'unexpected_discovery' ||
      event.category === 'personal_project_progress'
    ) {
      const topic = event.payload?.topic || event.type;
      this.developInterest(topic, 'explore');

      if (dims.personalSignificance > 0.8) {
        this.recordDevelopmentalMilestone({
          engine: 'motivational',
          previousState: 'General curiosity',
          newState: `Focused deep exploration in ${topic}`,
          reasoning: `High personal significance discovery (${dims.personalSignificance}): ${appraisal.primaryInterpretation}`,
          confidence: 0.9,
          triggerEventId: event.id,
        });
      }
    }

    // 2. Relationship milestones (e.g. overcoming conflict, deep vulnerability, reconciliation)
    if (
      event.type.includes('apology') ||
      event.category === 'relationship_event' ||
      /sorry|apolog/i.test(event.payload?.text || '')
    ) {
      if (
        dims.socialMeaning.includes('reconciliation') ||
        dims.socialMeaning.includes('apology') ||
        dims.socialMeaning.includes('repair') ||
        appraisal.primaryInterpretation.toLowerCase().includes('apolog')
      ) {
        this.recordDevelopmentalMilestone({
          engine: 'relationship',
          previousState: 'Active conflict / strained trust',
          newState: 'Constructive reconciliation and emotional deepening',
          reasoning: `Processed apology with restored trust and emotional stability`,
          confidence: 0.92,
          triggerEventId: event.id,
        });
      }
    }
  }
}
