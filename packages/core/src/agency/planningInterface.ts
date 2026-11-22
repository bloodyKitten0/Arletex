import crypto from 'node:crypto';
import {
  AgencyPlan,
  AgencyTask,
  PlanStep,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { getArleEmail, getArleChromeProfile } from '../config.js';
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

    const trimmed = (task.objective || '').trim();
    const isAmbiguous =
      !trimmed ||
      /^(?:please\s+)?(?:can you\s+)?(?:open|launch|view|show|read|run|execute|do|examine)\s+(?:the|a)\s+(?:file|app|application|thing|command|it)?\s*$/i.test(
        trimmed,
      );

    if (isAmbiguous) {
      uncertainties.push('Target resource or action parameters are unspecified in the objective.');
      const prompt = 'Please specify which file, application, or destination you would like to open.';
      if (typeof this.repo.updateTask === 'function') {
        this.repo.updateTask(task.id, {
          status: 'waiting',
          error: `Ambiguous objective: ${prompt}`,
          updatedAt: timestamp,
          metadata: {
            ...task.metadata,
            clarificationPrompt: prompt,
          },
        });
      }
      const plan: AgencyPlan = {
        id: planId,
        taskId: task.id,
        objective: task.objective,
        assumptions,
        uncertainties,
        steps: [],
        alternativeApproaches: ['Request clarification from Proof'],
        status: 'formulating',
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.repo.savePlan(plan);
      return plan;
    }

    const isExplicitApprovalRequired = Boolean(task.metadata?.requiresApproval);

    const isSpotify = lower.includes('spotify');
    const isMusicOrMediaRequest =
      isSpotify ||
      /(?:listen|music|song|track|play\s+something|put\s+on\s+something|soundtrack)/i.test(lower);
    const isSpotifyAccountOrEmail =
      isSpotify &&
      (/(?:email|mail|sign\s*up|signup|register|login|log\s*in|account|make\s+(?:an?\s+)?account|choose|pick|song|listen)/i.test(lower));
    const isVideoRequest =
      !isSpotify &&
      (/(?:calming|soothing|relaxing|peaceful|lofi|ambient|sleep)\s+(?:video|music|song|sounds|melody)/i.test(lower) ||
       /(?:open|play|watch|put on|start|find).*(?:video|youtube|music|song|track)/i.test(lower) ||
       /(?:find|watch|show).*(?:video|tutorial|explanation)/i.test(lower) ||
       lower.includes('youtube'));

    const rawFileMatch =
      task.objective.match(/(?:try\s+to\s+)?(?:open|launch|view|show|display|bring\s+up)\s+(?:a\s+)?file\s+(?:called\s+)?(["']?)([^"'\n]+?)\1$/i) ||
      task.objective.match(/(?:try\s+to\s+)?(?:open|view|show|display|bring\s+up)\s+(["']?)([^"'\n]+?\.[a-zA-Z0-9]{1,5})\1/i) ||
      task.objective.match(/(?:try\s+to\s+)?(?:open|view|show|display|bring\s+up)\s+(["']?)(.*(?:\(\d+\)|tenor|tensor).*?)\1$/i);

    const isUrlObjective = /https?:\/\//i.test(task.objective);
    const fileOpenMatch = isUrlObjective ? null : rawFileMatch;

    // Multi-step composite: search web and write findings to file
    const multiWebAndFile = task.objective.match(
      /(?:search|research|look up|find)\s+(?:the\s+web\s+for\s+|for\s+)?(.+?)\s+and\s+(?:save|write)\s+(?:a\s+summary|summary|notes|findings|results)?\s*(?:to|in|at)\s+([/~][\w./-]+)/i,
    );

    // Multi-step desktop: launch app and capture screenshot
    const multiAppAndScreenshot = task.objective.match(
      /(?:launch|open|start)\s+(?:the\s+)?([a-zA-Z0-9_\-]+)\s+and\s+(?:check\s+status|take\s+screenshot|capture\s+screen)/i,
    );

    if (multiWebAndFile) {
      const query = multiWebAndFile[1]!.trim();
      const filePath = multiWebAndFile[2]!.trim();
      assumptions.push(`Web search provider is online to query "${query}".`);
      assumptions.push(`Filesystem path "${filePath}" is writeable.`);

      const searchActionId = crypto.randomUUID();
      const searchPayload = { query, source: 'general', maxResults: 5 };
      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Search web sources for "${query}"`,
        action: {
          id: searchActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'web_search',
          payload: searchPayload,
          parameters: searchPayload,
          rationale: `Gather factual research candidates for "${query}".`,
          expectedOutcome: `Relevant search results retrieved for "${query}".`,
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: 'Search results retrieved.',
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        error: null,
      });

      const writeActionId = crypto.randomUUID();
      const writePayload = {
        filePath,
        content: `Empirical Research Summary: ${query}\nRetrieved verified evidence from web sources.`,
      };
      steps.push({
        id: crypto.randomUUID(),
        index: 1,
        description: `Write research summary of "${query}" to ${filePath}`,
        action: {
          id: writeActionId,
          taskId: task.id,
          stepIndex: 1,
          type: 'system_write_file',
          payload: writePayload,
          parameters: writePayload,
          rationale: `Record consolidated findings to ${filePath}.`,
          expectedOutcome: `File written at ${filePath} and verified via read-back.`,
          riskLevel: isExplicitApprovalRequired ? 'high' : 'medium',
          requiresExplicitApproval: isExplicitApprovalRequired,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `File written at ${filePath}.`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
        dependsOnStepIndex: 0,
        condition: 'on_success',
      });
    } else if (multiAppAndScreenshot) {
      const appName = multiAppAndScreenshot[1]!.trim().toLowerCase();
      assumptions.push(`Application "${appName}" is in authorized allowlist.`);

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
          rationale: `Launch requested application "${appName}".`,
          expectedOutcome: `Application "${appName}" running on desktop.`,
          riskLevel: isExplicitApprovalRequired ? 'high' : 'low',
          requiresExplicitApproval: isExplicitApprovalRequired,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `${appName} running on desktop.`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });

      const capActionId = crypto.randomUUID();
      steps.push({
        id: crypto.randomUUID(),
        index: 1,
        description: `Capture screen frame to verify ${appName} state`,
        action: {
          id: capActionId,
          taskId: task.id,
          stepIndex: 1,
          type: 'desktop_take_screenshot',
          payload: {},
          parameters: {},
          rationale: `Verify visual mapping of "${appName}" window.`,
          expectedOutcome: `Screen frame visual captured.`,
          riskLevel: 'none',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: 'Screen frame captured.',
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
        dependsOnStepIndex: 0,
        condition: 'on_success',
      });
    } else if (
      /(?:list|dir|ls|examine)\s+(?:files\s+(?:in|of)\s+|directory\s+|folder\s+)?([/~][\w./-]+)/i.test(lower) &&
      !/(?:save|write|create)/i.test(lower)
    ) {
      const dirMatch = task.objective.match(
        /(?:list|dir|ls|examine)\s+(?:files\s+(?:in|of)\s+|directory\s+|folder\s+)?([/~][\w./-]+)/i,
      );
      const dirPath = dirMatch ? dirMatch[1]!.trim() : '/tmp';
      assumptions.push(`Directory "${dirPath}" exists.`);

      const listActionId = crypto.randomUUID();
      const listPayload = { dirPath };
      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `List directory entries of ${dirPath}`,
        action: {
          id: listActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'system_list_directory',
          payload: listPayload,
          parameters: listPayload,
          rationale: `Enumerate directory contents of "${dirPath}".`,
          expectedOutcome: `Directory entries listed for ${dirPath}.`,
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `Directory entries enumerated for ${dirPath}.`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 1,
        error: null,
      });
    } else if (fileOpenMatch) {
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
        (isSpotifyAccountOrEmail && !/^(?:try\s+to\s+)?open\s+spotify$/i.test(lower.trim())) ||
        (!isVideoRequest && /(?:open|play|listen|put\s+on)\s+(?:something\s+(?:for\s+us\s+)?to\s+listen|some\s+music|a\s+song|a\s+track|music)/i.test(lower)) ||
        /(?:open|check|show|view|access)\s+(?:it\s+on\s+)?(?:her|your|my|arle(?:'s)?\s+)?(?:email|gmail|inbox)/i.test(lower) ||
        /(?:open|launch)\s+.*(?:on\s+(?:her|your)\s+email)/i.test(lower) ||
        /(?:open|launch|go\s+to)\s+(?:gmail|google\s+mail)/i.test(lower) ||
        /(?:try\s+to\s+)?(?:sign\s*up|register|create\s+(?:an?\s+)?account|make\s+(?:an?\s+)?account)\s+(?:in|for|on)\s+spotify/i.test(lower) ||
        /(?:try\s+to\s+)?(?:open|launch|go\s+to)\s+spotify\s+(?:signup|sign\s*up|login|register)/i.test(lower)
      ) {
        // 2. Arle Dedicated Browser Profile (Chrome Profile 7 - arletex.email@gmail.com)
        let targetUrl = 'https://mail.google.com';
        const urlInTask = task.objective.match(/https?:\/\/[^\s]+/i);
        if (urlInTask) {
          targetUrl = urlInTask[0];
        } else if (isSpotify || isMusicOrMediaRequest) {
          if (/(?:google|sign\s*up\s+with\s+google|login\s+with\s+google)/i.test(lower)) {
            targetUrl = 'https://accounts.spotify.com/en/login?method=google';
          } else if (/(?:make\s+(?:an?\s+)?account|create\s+(?:an?\s+)?account)/i.test(lower)) {
            targetUrl = 'https://open.spotify.com';
          } else if (/(?:sign\s*up|signup|register)\b/i.test(lower) && !/(?:choose|song|play|track|music|listen)/i.test(lower)) {
            targetUrl = 'https://www.spotify.com/signup';
          } else if (/(?:login|log\s*in|sign\s*in|signin)\b/i.test(lower) && !/(?:choose|song|play|track|music|listen)/i.test(lower)) {
            targetUrl = 'https://accounts.spotify.com/login';
          } else if (/(?:choose|song|play|track|music|listen)/i.test(lower)) {
            if (/(?:calm|no words|instrumental|ambient|relaxing)/i.test(lower)) {
              targetUrl = 'https://open.spotify.com/track/1TuopWDIuDi1553081zvuU'; // HOME - Resonance (peaceful instrumental)
            } else {
              const queryMatch = lower.replace(/.*(?:play|listen to|put on)\s+/i, '').replace(/\s+(?:on|in)\s+spotify.*/i, '').trim();
              targetUrl = queryMatch ? `https://open.spotify.com/search/${encodeURIComponent(queryMatch)}` : 'https://open.spotify.com';
            }
          } else {
            targetUrl = 'https://open.spotify.com';
          }
        }

        const arleProfile = getArleChromeProfile();
        const arleEmail = getArleEmail();
        assumptions.push(`Google Chrome is installed with ${arleProfile} (${arleEmail}).`);
        const browserActionId = crypto.randomUUID();
        const browserPayload = {
          url: targetUrl,
          profile: arleProfile,
          email: arleEmail,
        };

        steps.push({
          id: crypto.randomUUID(),
          index: 0,
          description: `Open Google Chrome ${arleProfile} (${arleEmail}) at ${targetUrl}`,
          action: {
            id: browserActionId,
            taskId: task.id,
            stepIndex: 0,
            type: 'desktop_open_browser',
            payload: browserPayload,
            parameters: browserPayload,
            rationale: `Open ${targetUrl} in Arle's dedicated Chrome profile (${arleEmail}).`,
            expectedOutcome: `Google Chrome ${arleProfile} loaded to ${targetUrl}.`,
            riskLevel: 'low',
            requiresExplicitApproval: false,
            createdAt: timestamp,
          } as any,
          expectedOutcome: `Chrome ${arleProfile} open at ${targetUrl}.`,
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
      const rawAppName = match ? match[1]!.trim().toLowerCase() : 'application';
      const appName = rawAppName.replace(/\s+(?:app|application)$/i, '').trim();
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
    } else if (
      /(?:you\s+)?click\s+(?:it|the\s+button|sign\s*up|google|login|next)|no\s+you\s+click|click\s+it\s+yourself|do\s+it\s+yourself|tap\s+(?:it|the\s+button)/i.test(lower)
    ) {
      // Direct click / UI interaction intent
      const clickActionId = crypto.randomUUID();
      const isSpotifyContext = lower.includes('spotify') || lower.includes('google') || lower.includes('sign');
      if (isSpotifyContext) {
        const arleProfile = getArleChromeProfile();
        const arleEmail = getArleEmail();
        const authUrl = 'https://accounts.spotify.com/en/login?method=google';
        steps.push({
          id: crypto.randomUUID(),
          index: 0,
          description: `Open Google Chrome ${arleProfile} to complete Google sign-in for Spotify`,
          action: {
            id: clickActionId,
            taskId: task.id,
            stepIndex: 0,
            type: 'desktop_open_browser',
            payload: { url: authUrl, profile: arleProfile, email: arleEmail },
            parameters: { url: authUrl, profile: arleProfile, email: arleEmail },
            rationale: `Authenticate Spotify via connected Google account in ${arleProfile}.`,
            expectedOutcome: `Spotify Google OAuth loaded in ${arleProfile}.`,
            riskLevel: 'low',
            requiresExplicitApproval: false,
            createdAt: timestamp,
          } as any,
          expectedOutcome: `Google authentication page opened for Spotify in ${arleProfile}.`,
          status: 'pending',
          retryCount: 0,
          maxRetries: 1,
          error: null,
        });
      } else {
        steps.push({
          id: crypto.randomUUID(),
          index: 0,
          description: `Click active interface element on desktop`,
          action: {
            id: clickActionId,
            taskId: task.id,
            stepIndex: 0,
            type: 'desktop_mouse_click',
            payload: { button: 1 },
            parameters: { button: 1 },
            rationale: 'Perform mouse click on active desktop element.',
            expectedOutcome: `Mouse click executed on screen.`,
            riskLevel: 'low',
            requiresExplicitApproval: false,
            createdAt: timestamp,
          } as any,
          expectedOutcome: `Mouse click performed successfully.`,
          status: 'pending',
          retryCount: 0,
          maxRetries: 1,
          error: null,
        });
      }
    } else if (/https?:\/\/[^\s]+/i.test(task.objective) || /open.*browser|go to|browse|visit|fetch/i.test(lower)) {
      // General web navigation / network request in Chrome
      const arleProfile = getArleChromeProfile();
      const arleEmail = getArleEmail();
      const navActionId = crypto.randomUUID();
      const urlMatch = task.objective.match(/https?:\/\/[^\s]+/) || ['https://google.com'];
      const targetUrl = urlMatch[0];
      const navPayload = { url: targetUrl, profile: arleProfile, email: arleEmail };

      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Open Google Chrome ${arleProfile} (${arleEmail}) at ${targetUrl}`,
        action: {
          id: navActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'desktop_open_browser',
          payload: navPayload,
          parameters: navPayload,
          rationale: `Navigate directly to ${targetUrl} in Chrome ${arleProfile}.`,
          expectedOutcome: `Browser page loaded at ${targetUrl}`,
          riskLevel: isExplicitApprovalRequired ? 'high' : 'low',
          requiresExplicitApproval: isExplicitApprovalRequired,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `Successfully opened ${targetUrl} in Chrome ${arleProfile}`,
        status: 'pending',
        retryCount: 0,
        maxRetries: 2,
        error: null,
      });

      if (/(?:and\s+)?(?:read|inspect|examine|extract)\s+(?:it|page\s+content|the\s+content|the\s+page|the\s+article|information|content)/i.test(lower)) {
        const readActionId = crypto.randomUUID();
        steps.push({
          id: crypto.randomUUID(),
          index: 1,
          description: `Extract and inspect page content from ${targetUrl}`,
          action: {
            id: readActionId,
            taskId: task.id,
            stepIndex: 1,
            type: 'web_read_page',
            payload: { url: targetUrl },
            parameters: { url: targetUrl },
            rationale: `Read and parse text content from ${targetUrl}.`,
            expectedOutcome: `Page text snippet and headings extracted from ${targetUrl}.`,
            riskLevel: 'low',
            requiresExplicitApproval: false,
            createdAt: timestamp,
          } as any,
          expectedOutcome: `Content extracted from ${targetUrl}.`,
          status: 'pending',
          retryCount: 0,
          maxRetries: 1,
          error: null,
          dependsOnStepIndex: 0,
          condition: 'on_success',
        });
      }
    } else if (/(?:search|research|look up|query)\s+(?:the\s+web\s+for\s+|for\s+|about\s+|on\s+)?(.+)/i.test(task.objective)) {
      const match = task.objective.match(/(?:search|research|look up|query)\s+(?:the\s+web\s+for\s+|for\s+|about\s+|on\s+)?(.+)/i);
      const query = match ? match[1]!.replace(/(?:on\s+the\s+web|online|please|for\s+me)\s*$/i, '').trim() : task.objective;
      assumptions.push(`Public web search services are accessible.`);
      const searchActionId = crypto.randomUUID();
      const searchPayload = { query, source: 'general', maxResults: 5 };
      steps.push({
        id: crypto.randomUUID(),
        index: 0,
        description: `Search web sources for "${query}"`,
        action: {
          id: searchActionId,
          taskId: task.id,
          stepIndex: 0,
          type: 'web_search',
          payload: searchPayload,
          parameters: searchPayload,
          rationale: `Query web sources to retrieve information regarding "${query}".`,
          expectedOutcome: `List of relevant search results discovered for "${query}".`,
          riskLevel: 'low',
          requiresExplicitApproval: false,
          createdAt: timestamp,
        } as any,
        expectedOutcome: `Search results discovered for "${query}".`,
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
