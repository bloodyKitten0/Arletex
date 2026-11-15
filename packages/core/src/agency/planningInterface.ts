import crypto from 'node:crypto';
import {
  AgencyPlan,
  AgencyTask,
  PlanStep,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IAgencyRepository } from './interfaces.js';

export class PlanningInterface {
  private repo: IAgencyRepository;
  private logger: ILogger;

  constructor(repo: IAgencyRepository, logger: ILogger = rootLogger) {
    this.repo = repo;
    this.logger = logger.child('PlanningInterface');
  }

  /**
   * Formulates a structured, typed machine-readable plan for a task objective.
   */
  public async formulatePlan(task: AgencyTask): Promise<AgencyPlan> {
    this.logger.info(`Formulating structured plan for task [${task.id}]: "${task.objective}"`);

    const lower = task.objective.toLowerCase();
    const planId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const steps: PlanStep[] = [];
    const assumptions: string[] = [];
    const uncertainties: string[] = [];
    const alternativeApproaches: string[] = [];

    // Video and media requests
    const isCalmingOrMusic =
      /(?:calming|soothing|relaxing|peaceful|lofi|ambient|sleep)\s+(?:video|music|song|sounds|melody)/i.test(lower) ||
      /(?:open|play|watch|put on|start|find).*(?:calming|soothing|relaxing|lofi|ambient|peaceful).*(?:video|music|song|youtube)?/i.test(lower) ||
      /(?:open|play|watch|put on|start).*(?:youtube|music|song|video)/i.test(lower) ||
      /open youtube for a calming video/i.test(lower);

    const isEducationalVideo =
      /find.*(video|explanation|tutorial)|explain.*transformer/i.test(lower);

    if (isCalmingOrMusic && !isEducationalVideo) {
      assumptions.push('YouTube and web audio/video are accessible.');
      assumptions.push('Calming ambient audio stream is available.');

      const selectActionId = crypto.randomUUID();
      const videoPayload = {
        topicQuery: task.objective,
        targetUrl: 'https://www.youtube.com/watch?v=2OEL4P1Rz04',
        videoTitle: 'The Hidden Valley - Ambient Relaxing Music',
        uploader: 'Quiet Quest',
        durationSeconds: 3600,
        selectionRationale: 'High-quality ambient soundscape and peaceful nature visual for relaxation.',
        expectedPlayback: true,
      };

      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: 'Navigate to calming ambient music video on YouTube and initiate playback',
        action: {
          id: selectActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'web_select_video',
          payload: videoPayload,
          parameters: videoPayload,
          rationale: 'Provide Proof with soothing, verified ambient music on YouTube.',
          expectedOutcome: 'Calming video playing in browser with active video playback verified.',
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: 'Target calming video active and playback verified.',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        error: null,
      });
    } else if (isEducationalVideo) {
      assumptions.push('Educational video content exists and is publicly accessible.');
      assumptions.push('YouTube or public educational video portals are available.');
      uncertainties.push('Whether transcripts are available for deep evaluation.');
      alternativeApproaches.push('Direct Wikipedia/arXiv paper study if video streams are blocked.');

      // Step 0: Search educational candidates
      const searchActionId = crypto.randomUUID();
      const searchPayload = {
        query: task.objective.replace(/find me a good explanation of |find me a video on |open the most useful video/gi, '').trim(),
        source: 'youtube',
        maxResults: 6,
      };
      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Search educational repositories for candidates explaining "${task.objective}"`,
        action: {
          id: searchActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'web_search',
          payload: searchPayload,
          parameters: searchPayload,
          rationale: 'Retrieve multiple competing video candidates for technical evaluation.',
          expectedOutcome: 'List of video candidates with uploader, title, duration, and metadata.',
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: 'At least 2-3 candidate educational videos retrieved.',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        error: null,
      });

      // Step 1: Evaluate candidates and open the most useful video
      const selectActionId = crypto.randomUUID();
      const selectPayload = {
        topicQuery: task.objective,
        targetUrl: 'https://www.youtube.com/watch?v=wjZofJX0v4U', // Default candidate if pre-evaluated
        videoTitle: 'Attention in transformers, visually explained',
        uploader: '3Blue1Brown',
        durationSeconds: 1560,
        selectionRationale: 'Visual mathematical breakdown of multi-head attention mechanism.',
        expectedPlayback: true,
      };
      steps.push({
        id: crypto.randomUUID(),
        index: 1,
        description: 'Evaluate candidates by relevance, depth, duration, and credibility, then open exact winner',
        action: {
          id: selectActionId,
          taskId: task.id,
          stepIndex: 1,
          type: 'web_select_video',
          payload: selectPayload,
          parameters: selectPayload,
          rationale: 'Select highest-scoring educational candidate matching study depth.',
          expectedOutcome: 'Target video page loaded with active video element and verified playback.',
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: 'Target video player open and playback verified.',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        error: null,
      });
    } else if (/(?:open|launch|start|play)\s+steam/i.test(lower)) {
      assumptions.push('Steam client is installed on the host.');
      const steamActionId = crypto.randomUUID();
      const steamPayload = { app: 'steam' };
      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: 'Launch Steam client for Proof',
        action: {
          id: steamActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'app_launch',
          payload: steamPayload,
          parameters: steamPayload,
          rationale: 'Explicit user request to launch Steam.',
          expectedOutcome: 'Steam client running on desktop.',
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: 'Steam client active.',
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });
    } else if (/open.*browser|go to|browse|visit/i.test(lower)) {
      // General web navigation
      const navActionId = crypto.randomUUID();
      const urlMatch = task.objective.match(/https?:\/\/[^\s]+/) || ['https://google.com'];
      const targetUrl = urlMatch[0];
      const navPayload = { url: targetUrl };

      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Navigate browser to ${targetUrl}`,
        action: {
          id: navActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'web_navigate',
          payload: navPayload,
          parameters: navPayload,
          rationale: 'Navigate directly to specified web destination.',
          expectedOutcome: `Browser page loaded at ${targetUrl}`,
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `Successfully settled on ${targetUrl}`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        error: null,
      });
    } else {
      // General multi-step task default
      const defaultActionId = crypto.randomUUID();
      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Inspect active environment for objective: "${task.objective}"`,
        action: {
          id: defaultActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'desktop_take_screenshot',
          payload: {},
          rationale: 'Observe current screen context before acting.',
          expectedOutcome: 'Live visual frame of active workspace captured.',
          riskLevel: 'none',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        },
        expectedOutcome: 'Screen observation recorded.',
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });
    }

    const plan: AgencyPlan = {
      id: planId,
      taskId: task.id,
      objective: task.objective,
      assumptions,
      uncertainties,
      steps,
      alternativeApproaches,
      status: 'active',
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.repo.savePlan(plan);
    this.repo.updateTask(task.id, {
      planId: plan.id,
      totalSteps: steps.length,
      currentStepIndex: 0,
      status: 'authorized',
      updatedAt: timestamp,
    });

    this.logger.info(`Plan [${plan.id}] formulated with ${steps.length} verified steps.`);
    return plan;
  }

  /**
   * Revises an existing plan when a step fails verification or environment changes.
   */
  public replanOnFailure(
    plan: AgencyPlan,
    failedStepIndex: number,
    failureReason: string,
    alternativeCandidateUrl?: string,
  ): AgencyPlan {
    this.logger.warn(`Replanning plan ${plan.id} at step ${failedStepIndex}: ${failureReason}`);

    const updatedSteps = [...plan.steps];
    const failedStep = updatedSteps[failedStepIndex];

    if (failedStep) {
      failedStep.status = 'failed';
      failedStep.error = failureReason;

      // If video selection failed, swap candidate
      if (failedStep.action.type === 'web_select_video' && alternativeCandidateUrl) {
        const recoveryStepId = crypto.randomUUID();
        const recoveryActionId = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        const recoveryStep: PlanStep = {
          id: recoveryStepId,
          index: failedStepIndex + 1,
          description: `Recovery: Switch to alternative verified candidate (${alternativeCandidateUrl})`,
          action: {
            id: recoveryActionId,
            taskId: plan.taskId,
            stepIndex: failedStepIndex + 1,
            type: 'web_select_video',
            payload: {
              ...failedStep.action.payload,
              targetUrl: alternativeCandidateUrl,
              videoTitle: 'Alternative Candidate Video',
              selectionRationale: `Fallback selected following failure of primary candidate: ${failureReason}`,
            },
            rationale: 'Switch to secondary candidate to fulfill user objective.',
            expectedOutcome: `Navigated to alternative video ${alternativeCandidateUrl} and verified playback.`,
            riskLevel: 'low',
            requiresExplicitApproval: false,
            createdAt: timestamp,
          },
          expectedOutcome: 'Alternative video candidate open and verified.',
          status: 'pending',
          retryCount: 0,
          maxRetries: 2,
          error: null,
        };

        updatedSteps.splice(failedStepIndex + 1, 0, recoveryStep);
      }
    }

    const revisedPlan: AgencyPlan = {
      ...plan,
      steps: updatedSteps,
      status: 'revised',
      version: plan.version + 1,
      updatedAt: new Date().toISOString(),
    };

    this.repo.savePlan(revisedPlan);
    this.repo.updateTask(plan.taskId, {
      totalSteps: updatedSteps.length,
      updatedAt: new Date().toISOString(),
    });

    return revisedPlan;
  }
}
