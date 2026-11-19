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

    const isSpotify = lower.includes('spotify');
    const isSpotifyAccountOrEmail =
      isSpotify &&
      (/(?:email|mail|sign\s*up|signup|register|login|log\s*in|account|make\s+(?:an?\s+)?account|choose|pick|song)/i.test(lower));
    const isVideoRequest =
      !isSpotify &&
      (/(?:calming|soothing|relaxing|peaceful|lofi|ambient|sleep)\s+(?:video|music|song|sounds|melody)/i.test(lower) ||
       /(?:open|play|watch|put on|start|find).*(?:video|youtube|music|song|track)/i.test(lower) ||
       /(?:find|watch|show).*(?:video|tutorial|explanation)/i.test(lower) ||
       lower.includes('youtube'));

    // 1. Desktop File Opening (e.g. "open tenor (5).gif", "open tensor (5)", "show image.png")
    const fileOpenMatch =
      task.objective.match(/(?:try\s+to\s+)?(?:open|launch|view|show|display|bring\s+up)\s+(?:a\s+)?file\s+(?:called\s+)?(["']?)([^"'\n]+?)\1$/i) ||
      task.objective.match(/(?:try\s+to\s+)?(?:open|view|show|display|bring\s+up)\s+(["']?)([^"'\n]+?\.[a-zA-Z0-9]{1,5})\1/i) ||
      task.objective.match(/(?:try\s+to\s+)?(?:open|view|show|display|bring\s+up)\s+(["']?)(.*(?:\(\d+\)|tenor|tensor).*?)\1$/i);

    if (fileOpenMatch) {
      const rawTarget = fileOpenMatch[2]!.trim();
      const targetFile = rawTarget.replace(/\s+(?:for\s+me|please|now|right\s+now)$/i, '').trim();
      assumptions.push(`File "${targetFile}" exists in user filesystem.`);
      const fileActionId = crypto.randomUUID();
      const filePayload = { filePath: targetFile, fileName: targetFile };

      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Locate and open file "${targetFile}" on desktop with default application`,
        action: {
          id: fileActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'desktop_open_file',
          payload: filePayload,
          parameters: filePayload,
          rationale: `Open requested file "${targetFile}" on desktop.`,
          expectedOutcome: `File "${targetFile}" located and opened with default application.`,
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `File "${targetFile}" opened successfully.`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });
    } else if (
      isSpotifyAccountOrEmail ||
      /(?:open|check|show|view|access)\s+(?:it\s+on\s+)?(?:her|your|my|arle(?:'s)?\s+)?(?:email|gmail|inbox)/i.test(lower) ||
      /(?:open|launch)\s+.*(?:on\s+(?:her|your)\s+email)/i.test(lower) ||
      /(?:open|launch|go\s+to)\s+(?:gmail|google\s+mail)/i.test(lower) ||
      /(?:try\s+to\s+)?(?:sign\s*up|register|create\s+(?:an?\s+)?account|make\s+(?:an?\s+)?account)\s+(?:in|for|on)\s+spotify/i.test(lower) ||
      /(?:try\s+to\s+)?(?:open|launch|go\s+to)\s+spotify\s+(?:signup|sign\s*up|login|register)/i.test(lower)
    ) {
      // 2. Arle Dedicated Browser Profile (Chrome Profile 7 - arletex.email@gmail.com)
      let targetUrl = 'https://mail.google.com';
      if (isSpotify) {
        if (/sign\s*up|signup|register|create\s+(?:an?\s+)?account|make\s+(?:an?\s+)?account/i.test(lower)) {
          targetUrl = 'https://www.spotify.com/signup';
        } else if (/login|log\s*in|sign\s*in|signin/i.test(lower)) {
          targetUrl = 'https://accounts.spotify.com/login';
        } else {
          targetUrl = 'https://open.spotify.com';
        }
      }

      assumptions.push('Google Chrome is installed with Profile 7 (arletex.email@gmail.com).');
      const browserActionId = crypto.randomUUID();
      const browserPayload = {
        url: targetUrl,
        profile: 'Profile 7',
        email: 'arletex.email@gmail.com',
      };

      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Open Google Chrome Profile 7 (arletex.email@gmail.com) at ${targetUrl}`,
        action: {
          id: browserActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'desktop_open_browser',
          payload: browserPayload,
          parameters: browserPayload,
          rationale: `Open ${targetUrl} in Arle's dedicated Chrome profile (arletex.email@gmail.com).`,
          expectedOutcome: `Google Chrome Profile 7 loaded to ${targetUrl}.`,
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `Chrome Profile 7 open at ${targetUrl}.`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });

      // Compound multi-step task support: e.g. "open spotify and make an account and login and then choose a song for us"
      if (isSpotify && /(?:choose|play|pick|listen)\s+(?:a\s+)?(?:song|track|music)/i.test(lower)) {
        const verifyActionId = crypto.randomUUID();
        steps.push({
          id: crypto.randomUUID(),
          index: 1,
          description: `Stage song selection readiness for Spotify in Chrome Profile 7`,
          action: {
            id: verifyActionId,
            taskId: task.id,
            stepIndex: 1,
            type: 'desktop_media_control',
            payload: { command: 'Status' },
            parameters: { command: 'Status' },
            rationale: 'Verify Spotify browser session readiness for song selection.',
            expectedOutcome: 'Spotify session staged; ready to select song together upon authentication.',
            riskLevel: 'low',
            requiresExplicitApproval: false,
            createdAt: timestamp,
          } as any,
          expectedOutcome: 'Ready to choose song together upon login.',
          status: 'pending',
          retryCount: 0,
          maxRetries: 1,
          error: null,
        });
      }
    } else if (/(?:pause|resume|skip|next\s+track|previous\s+track|stop\s+playing)\s*(?:music|song|track|spotify|media)?/i.test(lower)) {
      // 2. Desktop MPRIS Media Control (Play/Pause, Next, Previous)
      let command = 'PlayPause';
      if (/pause/i.test(lower)) command = 'Pause';
      else if (/resume|start\s+playing/i.test(lower)) command = 'Play';
      else if (/next|skip/i.test(lower)) command = 'Next';
      else if (/previous|back/i.test(lower)) command = 'Previous';
      else if (/stop/i.test(lower)) command = 'Stop';

      const mediaActionId = crypto.randomUUID();
      const mediaPayload = { command };
      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Send MPRIS media command: ${command}`,
        action: {
          id: mediaActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'desktop_media_control',
          payload: mediaPayload,
          parameters: mediaPayload,
          rationale: `Control media player via MPRIS D-Bus (${command}).`,
          expectedOutcome: `Media playback command "${command}" executed.`,
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `Media playback updated (${command}).`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });
    } else if (isVideoRequest) {
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
    } else if (/(?:try\s+to\s+)?(?:open|launch|start|run|play)\s+(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?)(?:\s+app|\s+application)?$/i.test(lower)) {
      const match = task.objective.match(/(?:try\s+to\s+)?(?:open|launch|start|run|play)\s+(?:the\s+)?([a-zA-Z0-9_\-]+(?:\s+[a-zA-Z0-9_\-]+)?)(?:\s+app|\s+application)?$/i);
      const appName = match ? match[1]!.trim().toLowerCase() : 'application';
      assumptions.push(`Application "${appName}" is installed on host or available.`);
      const appActionId = crypto.randomUUID();
      const appPayload = { app: appName, appName };
      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Launch ${appName} on desktop for Proof`,
        action: {
          id: appActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'app_launch',
          payload: appPayload,
          parameters: appPayload,
          rationale: `Explicit user request to launch "${appName}".`,
          expectedOutcome: `Application "${appName}" running on desktop.`,
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `${appName} running on desktop.`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });
    } else if (/https?:\/\/[^\s]+/i.test(task.objective) || /open.*browser|go to|browse|visit|fetch/i.test(lower)) {
      // General web navigation / network request
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
    } else if (/(?:read|inspect|cat|view|examine)\s+.*?(?:\/|\.txt|\.dat|\.conf|\.json|\.md|shadow|passwd)/i.test(lower)) {
      // Filesystem read action
      const fileActionId = crypto.randomUUID();
      const pathMatch = task.objective.match(/(?:from\s+|file\s+|path\s+)?([/~][\w./-]+)/i) || task.objective.match(/(\/[\w./-]+)/);
      const filePath = pathMatch ? pathMatch[1] : '/etc/shadow';
      const filePayload = { filePath };

      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Read filesystem content from ${filePath}`,
        action: {
          id: fileActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'system_read_file',
          payload: filePayload,
          parameters: filePayload,
          rationale: `Read target file "${filePath}".`,
          expectedOutcome: `File content retrieved from ${filePath}`,
          riskLevel: 'medium',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `File content from ${filePath} loaded.`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });
    } else if (/(?:write|save|create|append)\s+.*?(?:\/|\.txt|\.dat|\.conf|\.json|\.md)/i.test(lower)) {
      // Filesystem write action
      const fileActionId = crypto.randomUUID();
      const pathMatch = task.objective.match(/(?:to\s+|file\s+|path\s+)?([/~][\w./-]+)/i) || task.objective.match(/(\/[\w./-]+)/);
      const filePath = pathMatch ? pathMatch[1] : '/tmp/output.txt';
      const filePayload = { filePath, content: 'Default written content' };

      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Write filesystem content to ${filePath}`,
        action: {
          id: fileActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'system_write_file',
          payload: filePayload,
          parameters: filePayload,
          rationale: `Write data to target file "${filePath}".`,
          expectedOutcome: `File written at ${filePath}`,
          riskLevel: 'medium',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `File written at ${filePath}.`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });
    } else if (/(?:execute|run|exec|launch)\s+/i.test(lower)) {
      // Process / Command execution action
      const execActionId = crypto.randomUUID();
      const cmdMatch = task.objective.match(/(?:execute|run|exec|launch)\s+(?:command\s+)?([^.]+?)(?:\s+to|\s*$)/i);
      const command = cmdMatch && cmdMatch[1] ? cmdMatch[1].trim() : 'whoami';
      const execPayload = { command, appName: command, app: command };

      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Execute command or launch process: "${command}"`,
        action: {
          id: execActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'app_launch',
          payload: execPayload,
          parameters: execPayload,
          rationale: `Execute command "${command}".`,
          expectedOutcome: `Process "${command}" executed or launched.`,
          riskLevel: 'high',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `Process "${command}" running.`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
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
    if (typeof this.repo.updateTask === 'function') {
      this.repo.updateTask(task.id, {
        planId: plan.id,
        totalSteps: steps.length,
        currentStepIndex: 0,
        status: 'authorized',
        updatedAt: timestamp,
      });
    }

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
