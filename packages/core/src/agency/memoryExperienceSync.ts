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

      let verifiedCount = 0;
      let failureCount = 0;
      let partialCount = 0;
      const observedOutcomes: string[] = [];

      // Extract facts ONLY from genuinely verified results
      for (const ver of verifications) {
        if (ver.verified && ver.observedOutcome) {
          verifiedFacts.push(ver.observedOutcome);
          verifiedCount++;
        } else if (ver.status === 'partially_successful') {
          partialCount++;
          observedOutcomes.push(`[Partial] ${ver.observedOutcome}`);
        } else if (!ver.verified) {
          failureCount++;
          observedOutcomes.push(`[Failed] ${ver.failureReason || ver.observedOutcome}`);
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

      // Record honest outcome summary based on genuine verification outcomes
      if (verifiedCount > 0 && failureCount === 0 && partialCount === 0) {
        outcomeSummary = `Completed execution of objective "${task.objective}". Verified ${verifiedFacts.length} outcome milestone(s).`;
      } else if (partialCount > 0 || (verifiedCount > 0 && failureCount > 0)) {
        outcomeSummary = `Partially executed objective "${task.objective}". Verified ${verifiedCount} milestone(s), but encountered unverified/stalled steps: ${observedOutcomes.slice(0, 2).join('; ')}.`;
      } else if (failureCount > 0) {
        outcomeSummary = `Execution of objective "${task.objective}" failed verification: ${observedOutcomes.slice(0, 2).join('; ')}.`;
      } else if (task.status === 'completed') {
        outcomeSummary = `Execution of objective "${task.objective}" completed without active verification probes.`;
      } else {
        outcomeSummary = `Execution of objective "${task.objective}" was not completed (status: ${task.status}).`;
      }
    } else {
      outcomeSummary = String(planOrSummary);
      discoveries = (observationsOrDiscoveries as string[]) || [];
      lessonsLearned = (verificationsOrLessons as string[]) || [];
      verifiedFacts = task.status === 'completed' ? [`Accomplished: ${task.title}`] : [];
    }

    const isFullyVerified = verifiedFacts.length > 0 && task.status === 'completed';
    const experience: DigitalExperience = {
      id,
      taskId: task.id,
      objective: task.objective,
      initiator: task.initiator,
      success: isFullyVerified,
      actionsCount: task.totalSteps,
      outcomeSummary,
      discoveries,
      lessonsLearned,
      verifiedFacts,
      relatedUrl,
      timestamp,
    };

    const statusText = isFullyVerified
      ? 'Successfully accomplished and verified'
      : task.status === 'completed'
        ? 'Completed (unverified)'
        : 'Attempted and unresolved';

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

    // Calibrate confidence honestly based on verification outcome:
    // Never assign high confidence merely because a memory was automatically generated.
    let confidence = 0.5; // Baseline for unverified
    let provenance = 'unverified_execution';

    if (isFullyVerified) {
      confidence = 0.95;
      provenance = 'verified_fact';
    } else if (task.status === 'completed') {
      confidence = 0.7;
      provenance = 'autobiographical_experience';
    } else if (verifiedFacts.length > 0) {
      confidence = 0.65;
      provenance = 'uncertain_information';
    } else {
      confidence = 0.8; // High confidence in the recorded failure
      provenance = 'raw_observation';
    }

    try {
      if (typeof this.memorySink.create === 'function') {
        await this.memorySink.create({
          type: 'episodic',
          content: memoryContent,
          importance: isFullyVerified ? 0.85 : 0.5,
          confidence,
          provenance,
          tags: ['digital_agency', task.initiator, task.status, ...(isFullyVerified ? ['verified'] : ['unverified']), ...(relatedUrl ? ['web'] : [])],
          metadata: {
            taskId: task.id,
            verifiedFacts,
            outcomeSummary,
            isFullyVerified,
          },
        });
      } else if (typeof this.memorySink.createMemory === 'function') {
        await this.memorySink.createMemory({
          category: 'episodic',
          content: memoryContent,
          summary: `${statusText}: ${task.title}`,
          source: provenance,
          importanceScore: isFullyVerified ? 0.85 : 0.5,
          tags: ['digital_agency', task.initiator, task.status, ...(isFullyVerified ? ['verified'] : ['unverified']), ...(relatedUrl ? ['web'] : [])],
        });
      }
      this.logger.info(`Distilled experience recorded for task ${task.id}`);
    } catch (err: any) {
      this.logger.warn(`Failed to store episodic experience memory: ${err.message}`);
    }

    return experience;
  }
}
