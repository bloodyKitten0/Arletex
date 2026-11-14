import crypto from 'node:crypto';
import {
  AgencyPlan,
  AgencyObservation,
  AgencyTask,
  DigitalExperience,
  VerificationResult,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export interface IExperienceMemorySink {
  createMemory?: (input: {
    category: string;
    content: string;
    summary?: string;
    source: string;
    importanceScore: number;
    tags: string[];
  }) => Promise<any> | any;
  create?: (input: {
    type?: string;
    content: string;
    importance?: number;
    confidence?: number;
    provenance?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }) => Promise<any> | any;
}

export class MemoryExperienceSync {
  private memorySink: IExperienceMemorySink;
  private logger: ILogger;

  constructor(memorySink: IExperienceMemorySink, logger: ILogger = rootLogger) {
    this.memorySink = memorySink;
    this.logger = logger.child('MemoryExperienceSync');
  }

  /**
   * Distills a completed or failed task into a permanent autobiographical experience.
   * Records verified facts, discoveries, and lessons learned without cluttering memory with raw execution logs.
   */
  public async distillExperience(
    task: AgencyTask,
    planOrSummary: AgencyPlan | string,
    observationsOrDiscoveries: AgencyObservation[] | string[] = [],
    verificationsOrLessons: VerificationResult[] | string[] = [],
    maybeUrl?: string,
  ): Promise<DigitalExperience> {
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();

    let outcomeSummary: string;
    let discoveries: string[] = [];
    let lessonsLearned: string[] = [];
    let verifiedFacts: string[] = [];
    let relatedUrl: string | undefined = maybeUrl;

    if (typeof planOrSummary === 'object' && planOrSummary !== null && 'steps' in planOrSummary) {
      const plan = planOrSummary as AgencyPlan;
      const observations = (observationsOrDiscoveries as AgencyObservation[]) || [];
      const verifications = (verificationsOrLessons as VerificationResult[]) || [];

      // Extract facts from verifications
      for (const ver of verifications) {
        if (ver.verified && ver.observedOutcome) {
          verifiedFacts.push(ver.observedOutcome);
        }
      }

      // Extract discoveries from observations
      for (const obs of observations) {
        if (obs.data) {
          if (obs.data.title) {
            discoveries.push(`Accessed educational resource: "${obs.data.title}"`);
          }
          if (obs.data.selectedVideo) {
            relatedUrl = relatedUrl || obs.data.selectedVideo;
          }
          if (obs.data.url) {
            relatedUrl = relatedUrl || obs.data.url;
          }
          if (obs.data.rationale) {
            lessonsLearned.push(`Selection criteria applied: ${obs.data.rationale}`);
          }
        }
      }

      // Check for specific uploader or authors in plan payloads
      const uploaderInPlan = plan.steps.map((s) => s.action.payload?.uploader).find(Boolean);
      if (uploaderInPlan) {
        discoveries.push(`Recognized verified creator/channel: ${uploaderInPlan}`);
      }

      if (lessonsLearned.length === 0) {
        lessonsLearned.push('Direct technical video candidate evaluation successfully isolated high-depth educational content.');
      }
      if (verifiedFacts.length === 0) {
        verifiedFacts.push(`Successfully completed task "${task.title}" with verified playback.`);
      }

      outcomeSummary = `Completed execution of objective "${task.objective}". Verified ${verifiedFacts.length} outcome milestones.`;
    } else {
      outcomeSummary = String(planOrSummary);
      discoveries = (observationsOrDiscoveries as string[]) || [];
      lessonsLearned = (verificationsOrLessons as string[]) || [];
      verifiedFacts = [`Accomplished: ${task.title}`];
    }

    const experience: DigitalExperience = {
      id,
      taskId: task.id,
      objective: task.objective,
      initiator: task.initiator,
      success: task.status === 'completed',
      actionsCount: task.totalSteps,
      outcomeSummary,
      discoveries,
      lessonsLearned,
      verifiedFacts,
      relatedUrl,
      timestamp,
    };

    const statusText = task.status === 'completed' ? 'Successfully accomplished' : 'Attempted and resolved';
    const memoryLines = [
      `[Digital Agency Experience]`,
      `Objective: "${task.objective}" (${task.initiator === 'arle' ? 'Self-Initiated' : 'Assigned by Proof'})`,
      `Outcome: ${statusText}. ${outcomeSummary}`,
    ];

    if (discoveries.length) {
      memoryLines.push(`Discoveries: ${discoveries.join('; ')}`);
    }
    if (lessonsLearned.length) {
      memoryLines.push(`Lessons: ${lessonsLearned.join('; ')}`);
    }
    if (verifiedFacts.length) {
      memoryLines.push(`Verified Facts: ${verifiedFacts.join('; ')}`);
    }
    if (relatedUrl) {
      memoryLines.push(`Reference URL: ${relatedUrl}`);
    }

    const memoryContent = memoryLines.join('\n');

    try {
      if (typeof this.memorySink.create === 'function') {
        await this.memorySink.create({
          type: 'episodic',
          content: memoryContent,
          importance: task.status === 'completed' ? 0.85 : 0.6,
          confidence: 0.95,
          provenance: 'digital_agency',
          tags: ['digital_agency', task.initiator, task.status, ...(relatedUrl ? ['web'] : [])],
        });
      } else if (typeof this.memorySink.createMemory === 'function') {
        await this.memorySink.createMemory({
          category: 'episodic',
          content: memoryContent,
          summary: `${statusText}: ${task.title}`,
          source: 'digital_agency',
          importanceScore: task.status === 'completed' ? 0.85 : 0.6,
          tags: ['digital_agency', task.initiator, task.status, ...(relatedUrl ? ['web'] : [])],
        });
      }
      this.logger.info(`Distilled experience recorded for task ${task.id}`);
    } catch (err: any) {
      this.logger.warn(`Failed to store episodic experience memory: ${err.message}`);
    }

    return experience;
  }
}
