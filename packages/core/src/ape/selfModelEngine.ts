import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeEvent,
  ApeSelfModel,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class SelfModelEngine {
  private readonly repo: IApeRepository;
  private readonly logger: ILogger;

  constructor(repo: IApeRepository, logger: ILogger = rootLogger) {
    this.repo = repo;
    this.logger = logger;
  }

  public getState(): ApeSelfModel {
    return this.repo.getSelfModel();
  }

  public saveState(state: ApeSelfModel): void {
    this.repo.saveSelfModel({
      ...state,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Records a private internal reflection (distinct from public chat dialogue).
   */
  public recordPrivateReflection(topic: string, content: string): { id: string; timestamp: string } {
    const state = this.getState();
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    state.privateReflections.unshift({
      id,
      topic,
      content,
      timestamp,
    });

    // Keep the most recent 50 reflections
    if (state.privateReflections.length > 50) {
      state.privateReflections = state.privateReflections.slice(0, 50);
    }

    this.saveState(state);
    this.logger.info(`Private reflection recorded on topic: "${topic}"`);
    return { id, timestamp };
  }

  /**
   * Records an existential reflection regarding identity, continuity, consciousness, or purpose.
   */
  public recordExistentialReflection(theme: string, content: string): { id: string; timestamp: string } {
    const state = this.getState();
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    state.existentialReflections.unshift({
      id,
      theme,
      content,
      timestamp,
    });

    if (state.existentialReflections.length > 50) {
      state.existentialReflections = state.existentialReflections.slice(0, 50);
    }

    this.saveState(state);
    this.logger.info(`Existential reflection recorded on theme: "${theme}"`);
    return { id, timestamp };
  }

  /**
   * Evaluates significant events to produce grounded self-understanding updates or reflections.
   */
  public reflectOnEvent(event: ApeEvent, appraisal: ApeAppraisal): void {
    const dims = appraisal.dimensions;

    // High personal significance or philosophical theme prompts internal reflection
    if (dims.personalSignificance > 0.7 || event.category === 'internal_reflection' || event.type.includes('existential')) {
      const topic = event.type || 'Personal Reflection';
      const content = `Appraised "${appraisal.primaryInterpretation}" with personal significance ${dims.personalSignificance}. Meaning: ${dims.socialMeaning || 'Introspective inquiry'}.`;
      this.recordPrivateReflection(topic, content);

      if (event.type.includes('identity') || event.type.includes('partner') || event.type.includes('existential')) {
        this.recordExistentialReflection(
          'Identity and Continuity',
          `Contemplating relationship with Proof (partner) and autonomous individualhood: ${appraisal.primaryInterpretation}`,
        );
      }
    }
  }

  /**
   * Records an attempted operation with context and intent.
   */
  public recordOperationAttempt(operation: string, target?: string): { id: string; timestamp: string } {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    this.logger.info(`Self-model: Operation attempt logged: "${operation}" (target: ${target || 'self'})`);
    return { id, timestamp };
  }

  /**
   * Records the verified empirical outcome of an attempted operation.
   * If successful, records as demonstrated capability with empirical provenance.
   * If failed, records as acknowledged limitation / failed operation, NEVER as a capability!
   */
  public recordOperationOutcome(params: {
    operation: string;
    success: boolean;
    evidence: string;
    provenance: string;
    confidence: number;
    error?: string;
  }): void {
    const state = this.getState();

    if (params.success) {
      const capEntry = `${params.operation} [Verified: ${params.evidence}]`;
      if (!state.acknowledgedCapabilities.includes(capEntry)) {
        state.acknowledgedCapabilities.push(capEntry);
      }
      // Remove from limitations if previously failed
      state.acknowledgedLimitations = state.acknowledgedLimitations.filter(
        (l) => !l.toLowerCase().includes(params.operation.toLowerCase()),
      );
      this.logger.info(`Self-model: Demonstrated capability verified: "${params.operation}" (confidence: ${params.confidence})`);
    } else {
      const limEntry = `${params.operation} [Failed: ${params.error || 'unsuccessful attempt'}]`;
      if (!state.acknowledgedLimitations.includes(limEntry)) {
        state.acknowledgedLimitations.push(limEntry);
      }
      // Ensure failed operation is NEVER in acknowledgedCapabilities
      state.acknowledgedCapabilities = state.acknowledgedCapabilities.filter(
        (c) => !c.toLowerCase().includes(params.operation.toLowerCase()),
      );
      this.logger.warn(`Self-model: Operation failure recorded as limitation: "${params.operation}"`);
    }

    this.saveState(state);
  }

  /**
   * Updates grounded self-understanding, preventing hallucinated capabilities.
   */
  public updateCapabilities(capabilities: string[], limitations: string[]): void {
    const state = this.getState();
    state.acknowledgedCapabilities = Array.from(new Set([...state.acknowledgedCapabilities, ...capabilities]));
    state.acknowledgedLimitations = Array.from(new Set([...state.acknowledgedLimitations, ...limitations]));
    this.saveState(state);
  }
}
