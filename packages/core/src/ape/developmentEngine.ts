import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeDevelopmentState,
  ApeEvent,
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
   * Manages interest lifecycle: 'emerging' -> 'deep' -> 'mastery' -> 'fading' -> 'dormant'.
   */
  public developInterest(topic: string, action: 'explore' | 'master' | 'fade' | 'revive' = 'explore'): void {
    const state = this.getState();
    const now = new Date().toISOString();
    let interest = state.interests.find((i) => i.topic.toLowerCase() === topic.toLowerCase());

    if (!interest) {
      interest = {
        topic,
        level: 'emerging',
        developedAt: now,
      };
      state.interests.push(interest);
      this.logger.info(`New emerging interest acquired: "${topic}"`);
    } else {
      const prevLevel = interest.level;
      if (action === 'explore' && interest.level === 'emerging') {
        interest.level = 'deep';
      } else if (action === 'master') {
        // Mastery requires prior sustained deep practice; cannot jump directly from emerging
        if (interest.level === 'deep') {
          interest.level = 'mastery';
        } else {
          interest.level = 'deep';
        }
      } else if (action === 'fade') {
        interest.level = interest.level === 'mastery' ? 'deep' : interest.level === 'deep' ? 'fading' : 'dormant';
      } else if (action === 'revive') {
        interest.level = 'emerging';
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
      this.logger.info(`Development: Successful practice recorded for "${topic}": ${params.evidence}`);
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
    if (event.category === 'unexpected_discovery' || event.category === 'personal_project_progress') {
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
