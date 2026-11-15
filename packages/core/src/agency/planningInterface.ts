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

    // 1. Dynamic Video and Media Requests (Any topic, artist, tutorial, or genre)
    const isVideoRequest =
      /(?:calming|soothing|relaxing|peaceful|lofi|ambient|sleep)\s+(?:video|music|song|sounds|melody)/i.test(lower) ||
      /(?:open|play|watch|put on|start|find).*(?:video|youtube|music|song|track)/i.test(lower) ||
      /(?:find|watch|show).*(?:video|tutorial|explanation)/i.test(lower) ||
      lower.includes('youtube');

    if (isVideoRequest) {
      assumptions.push('YouTube and web video portals are publicly accessible.');
      assumptions.push('HTML5 video streams are supported.');
      uncertainties.push('Whether live candidate search results meet user criteria.');
      alternativeApproaches.push('Direct web article study if video streams are blocked.');

      // Dynamically extract the core topic query from the user's objective
      let cleanQuery = task.objective
        .replace(/^(?:please\s+)?(?:can you\s+)?(?:open\s+(?:up\s+)?(?:youtube\s+(?:for\s+)?)?|play\s+|find\s+(?:me\s+)?(?:a\s+)?(?:good\s+)?(?:video\s+(?:on\s+|about\s+)?|explanation\s+of\s+|tutorial\s+on\s+)?|watch\s+|listen\s+to\s+)/i, '')
        .replace(/\s+and\s+open\s+(?:the\s+)?(?:most\s+useful\s+video|it)/i, '')
        .replace(/\s+on\s+youtube$/i, '')
        .replace(/\s+for\s+me$/i, '')
        .trim();

      if (!cleanQuery || cleanQuery.length < 2) {
        cleanQuery = task.objective;
      }

      // Step 0: Search live video candidates on YouTube
      const searchActionId = crypto.randomUUID();
      const searchPayload = {
        query: cleanQuery,
        topicQuery: cleanQuery,
        source: 'youtube',
        maxResults: 6,
      };

      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Search video repositories dynamically for candidates matching "${cleanQuery}"`,
        action: {
          id: searchActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'web_search',
          payload: searchPayload,
          parameters: searchPayload,
          rationale: `Retrieve competing live video candidates for "${cleanQuery}".`,
          expectedOutcome: `List of candidate videos retrieved with titles, uploaders, and URLs for "${cleanQuery}".`,
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: 'Multiple live candidate videos retrieved.',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        error: null,
      });

      // Step 1: Evaluate candidates and open highest-ranked winner
      const selectActionId = crypto.randomUUID();
      const selectPayload = {
        topicQuery: cleanQuery,
        targetUrl: '', // Dynamically bound to the highest-ranking candidate from Step 0 at execution time
        videoTitle: '',
        selectionRationale: 'Evaluate candidates by relevance, depth, duration, and credibility, then launch and verify the winner.',
        expectedPlayback: true,
      };

      steps.push({
        id: crypto.randomUUID(),
        index: 1,
        description: `Evaluate candidates by relevance, depth, and credibility, then open and verify the winner`,
        action: {
          id: selectActionId,
          taskId: task.id,
          stepIndex: 1,
          type: 'web_select_video',
          payload: selectPayload,
          parameters: selectPayload,
          rationale: 'Select highest-scoring video candidate matching objective.',
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
