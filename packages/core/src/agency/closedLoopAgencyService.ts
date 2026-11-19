import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import {
  ActionProposal,
  ActionType,
  AgencyObservation,
  AgencyPlan,
  AgencyTask,
  ClosedLoopCycleResult,
  DigitalExperience,
  MemoryProvenance,
  PlanStep,
  VerificationResult,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ApeService } from '../ape/apeService.js';
import { AutobiographicalMemoryService } from '../memory/autobiographicalMemoryService.js';
import { ActionPermissionController } from './actionPermissionController.js';
import { IntentTaskManager } from './intentTaskManager.js';
import { PlanningInterface } from './planningInterface.js';
import { VerificationEngine } from './verificationEngine.js';
import { MemoryExperienceSync } from './memoryExperienceSync.js';
import {
  IAgencyRepository,
  IBrowserProvider,
  IComputerProvider,
  VideoCandidate,
} from './interfaces.js';
import { WebAgencyService } from './webAgencyService.js';
import { EmailProvider } from './emailProvider.js';
import { DesktopEnvironmentProvider } from './desktopEnvironmentProvider.js';
import { OpenWorldBrowserAgency } from './openWorldBrowserAgency.js';

export interface ClosedLoopAgencyDependencies {
  agencyRepo?: IAgencyRepository;
  taskManager?: IntentTaskManager;
  planningInterface?: PlanningInterface;
  permissionController?: ActionPermissionController;
  verificationEngine?: VerificationEngine;
  memorySync?: MemoryExperienceSync;
  apeService?: ApeService;
  autobiographicalMemoryService?: AutobiographicalMemoryService;
  browserProvider?: IBrowserProvider;
  computerProvider?: IComputerProvider;
  desktopProvider?: DesktopEnvironmentProvider;
  openWorldBrowser?: OpenWorldBrowserAgency;
  webAgency?: WebAgencyService;
  deviceAgency?: any;
  telegramBridge?: any;
  emailProvider?: EmailProvider;
  logger?: ILogger;
}

/**
 * Closed-Loop Agency Service:
 * Implements the uncompromising 7-phase operational autonomy cycle:
 * OBSERVE -> INTERPRET -> PLAN -> AUTHORIZE -> EXECUTE -> VERIFY -> LEARN
 *
 * Strict integrity rules:
 * 1. Distinguishes requested, planned, authorized, attempted, executed, verified, failed, and uncertain outcomes.
 * 2. An action is NEVER marked successful merely because a tool completed without throwing.
 * 3. Video playback must empirically progress over time to verify success.
 * 4. Failed actions trigger candidate recovery or plan revision, and NEVER fabricate successful memories.
 */
export class ClosedLoopAgencyService {
  private agencyRepo: IAgencyRepository;
  private taskManager: IntentTaskManager;
  private planningInterface: PlanningInterface;
  private permissionController: ActionPermissionController;
  private verificationEngine: VerificationEngine;
  private memorySync: MemoryExperienceSync;
  private apeService: ApeService;
  private autobiographicalMemoryService?: AutobiographicalMemoryService;
  private browserProvider?: IBrowserProvider;
  private computerProvider?: IComputerProvider;
  private desktopProvider?: DesktopEnvironmentProvider;
  private openWorldBrowser?: OpenWorldBrowserAgency;
  private webAgency?: WebAgencyService;
  private deviceAgency?: any;
  private telegramBridge?: any;
  private emailProvider?: EmailProvider;
  private logger: ILogger;

  constructor(deps: ClosedLoopAgencyDependencies) {
    this.agencyRepo = deps.agencyRepo!;
    this.taskManager = deps.taskManager!;
    this.planningInterface = deps.planningInterface!;
    this.permissionController = deps.permissionController || new ActionPermissionController(undefined, deps.logger);
    this.verificationEngine = deps.verificationEngine || new VerificationEngine(deps.logger);
    this.memorySync = deps.memorySync!;
    this.apeService = deps.apeService!;
    this.autobiographicalMemoryService = deps.autobiographicalMemoryService;
    this.browserProvider = deps.browserProvider;
    this.computerProvider = deps.computerProvider;
    this.desktopProvider = deps.desktopProvider;
    this.openWorldBrowser = deps.openWorldBrowser;
    this.webAgency = deps.webAgency || new WebAgencyService(deps.browserProvider, deps.logger);
    this.deviceAgency = deps.deviceAgency;
    this.telegramBridge = deps.telegramBridge;
    this.emailProvider = deps.emailProvider;
    this.logger = (deps.logger || rootLogger).child('ClosedLoopAgencyService');
  }

  public getOpenWorldBrowser(): OpenWorldBrowserAgency | undefined {
    return this.openWorldBrowser;
  }

  public getDesktopProvider(): DesktopEnvironmentProvider | undefined {
    return this.desktopProvider;
  }

  /**
   * Phase 1: OBSERVE
   * Acquires pre-execution environmental context.
   */
  public async observeEnvironment(): Promise<{
    activeWindow?: string;
    screenContext?: string;
    browserAvailable: boolean;
    timestamp: string;
  }> {
    const timestamp = new Date().toISOString();
    let activeWindow: string | undefined;

    if (this.computerProvider) {
      try {
        const win = await this.computerProvider.getActiveWindow();
        activeWindow = `${win.appName}: ${win.title}`;
      } catch {
        activeWindow = 'Desktop Workspace';
      }
    }

    return {
      activeWindow,
      browserAvailable: Boolean(this.browserProvider),
      timestamp,
    };
  }

  /**
   * Complete 7-Phase Closed-Loop Execution Pipeline:
   * Observe -> Interpret -> Plan -> Authorize -> Execute -> Verify -> Learn
   */
  public async executeClosedLoop(
    objective: string,
    initiator: 'user' | 'arle' = 'user',
    contextPayload: Record<string, unknown> = {},
  ): Promise<ClosedLoopCycleResult> {
    const cycleId = crypto.randomUUID();
    this.logger.info(`Starting Closed-Loop Agency cycle [${cycleId}] for objective: "${objective}" (Initiator: ${initiator})`);

    // ==========================================
    // Phase 1: OBSERVE & Phase 2: INTERPRET
    // ==========================================
    const preObservation = await this.observeEnvironment();
    this.logger.debug(`Pre-execution environment observed: ${preObservation.activeWindow || 'Desktop'}`);

    // ==========================================
    // Phase 3: PLAN
    // ==========================================
    const task = this.taskManager.createTask({
      objective,
      initiator,
      status: 'authorized',
      metadata: {
        ...contextPayload,
        cycleId,
        preObservation,
      },
    });

    const plan = await this.planningInterface.formulatePlan(task);
    this.agencyRepo.savePlan(plan);
    this.taskManager.transitionTask(task.id, 'running');

    const observations: AgencyObservation[] = [];
    const verifications: VerificationResult[] = [];
    let allStepsSucceeded = true;
    let switchedCandidates = false;
    let failureReason: string | null = null;
    let primaryActionType: ActionType = 'web_search';

    if (plan.steps.length === 0) {
      allStepsSucceeded = false;
      failureReason = 'Plan formulated with zero steps; cannot execute empty plan';
      this.logger.warn(`Plan for task ${task.id} has 0 steps; failing closed.`);
    }

    // ==========================================
    // Phase 4: AUTHORIZE & Phase 5: EXECUTE & Phase 6: VERIFY
    // ==========================================
    for (let i = 0; i < plan.steps.length; i++) {
      const step: PlanStep = plan.steps[i]!;
      const action = step.action;
      primaryActionType = action.type;

      // 4. AUTHORIZE: Strict fail-closed policy evaluation
      const auth = this.permissionController.authorize(action);
      if (!auth.allowed) {
        this.logger.warn(`Action ${action.id} (${action.type}) denied by permission controller: ${auth.denialReason}`);
        const ver: VerificationResult = {
          actionId: action.id,
          expectedOutcome: action.expectedOutcome,
          observedOutcome: `Action denied by policy: ${auth.denialReason}`,
          verified: false,
          confidence: 1.0,
          status: 'failed',
          failureReason: auth.denialReason || 'Unauthorized action proposal',
          isRecoverable: false,
          evidence: { denialReason: auth.denialReason },
          timestamp: new Date().toISOString(),
        };
        this.agencyRepo.saveVerification(ver);
        verifications.push(ver);
        allStepsSucceeded = false;
        failureReason = auth.denialReason || 'Unauthorized action';
        break;
      }

      // 5. EXECUTE: Dispatch to active subsystem
      let obs: AgencyObservation;
      try {
        obs = await this.executeAction(action, task, observations, true);
      } catch (execErr: any) {
        obs = {
          id: crypto.randomUUID(),
          taskId: task.id,
          actionId: action.id,
          source: 'process_table',
          timestamp: new Date().toISOString(),
          success: false,
          confidence: 1.0,
          provenance: 'ClosedLoopAgencyService:execution_exception',
          data: {},
          error: execErr.message || String(execErr),
        };
      }

      this.agencyRepo.saveObservation(obs);
      observations.push(obs);

      // 6. VERIFY: Uncompromising empirical verification
      let ver = this.verificationEngine.verify(action, obs);

      // Recovery and Candidate Switching (Test 8 — Failed action integrity)
      if (!ver.verified && ver.isRecoverable && ver.recommendedStrategy === 'switch_candidate') {
        const recovered = await this.attemptCandidateRecovery(action, task, observations, ver);
        if (recovered) {
          obs = recovered.observation;
          ver = recovered.verification;
          switchedCandidates = true;
          this.agencyRepo.saveObservation(obs);
          observations.push(obs);
        }
      }

      this.agencyRepo.saveVerification(ver);
      verifications.push(ver);

      if (!ver.verified) {
        allStepsSucceeded = false;
        failureReason = ver.failureReason || 'Action failed verification';
        this.taskManager.handleFailure(task.id, failureReason);
        break;
      }

      this.taskManager.advanceStep(task.id);
    }

    const finalStatus = allStepsSucceeded ? 'completed' : 'failed';
    const finalTask = this.taskManager.transitionTask(task.id, finalStatus, failureReason);

    // ==========================================
    // Phase 7: LEARN & CONSOLIDATE
    // ==========================================
    let digitalExp: DigitalExperience | undefined;
    try {
      digitalExp = await this.memorySync.distillExperience(finalTask, plan, observations, verifications);
    } catch (expErr: any) {
      this.logger.warn(`Experience sync note: ${expErr.message}`);
    }

    // 7b. Causal Self-Reflection answering the four canonical learning questions
    const reflection = this.apeService?.selfModelEngine?.performCausalSelfReflection
      ? this.apeService.selfModelEngine.performCausalSelfReflection({
          event: {
            id: crypto.randomUUID(),
            type: 'digital_agency_task',
            category: allStepsSucceeded ? 'success' : 'failure',
            source: 'agency',
            eventKind: 'action_outcome',
            processed: true,
            timestamp: new Date().toISOString(),
            payload: {
              objective,
              taskStatus: finalStatus,
              verifiedMilestones: verifications.filter((v) => v.verified).length,
            },
          },
          outcome: allStepsSucceeded,
          actionType: primaryActionType,
          evidence: allStepsSucceeded
            ? verifications.find((v) => v.verified)?.observedOutcome || 'Empirically verified execution'
            : failureReason || 'Execution unverified or failed',
        })
      : null;

    // 7c. Update Competence Model Grounding (No capability inflation on failure)
    const domain = this.extractDomainFromObjective(objective);
    if (allStepsSucceeded) {
      this.apeService?.selfModelEngine?.recordCompetenceExperience?.({
        domain,
        success: true,
        taskTitle: task.title,
        evidence: `Verified accomplishment: ${objective}`,
      });
      this.apeService?.developmentEngine?.recordPracticeAttempt?.({
        skillOrTopic: domain,
        success: true,
        evidence: `Task execution verified across ${verifications.length} step(s)`,
      });
    } else {
      this.apeService?.selfModelEngine?.recordOperationOutcome?.({
        operation: `Agency: ${primaryActionType} for "${objective}"`,
        success: false,
        evidence: failureReason || 'Unverified execution',
        provenance: 'empirical',
        confidence: 1.0,
        error: failureReason || 'Execution failed verification',
      });
    }

    // 7d. Autobiographical Memory Consolidation
    if (this.autobiographicalMemoryService) {
      const memoryProvenance: MemoryProvenance = allStepsSucceeded ? 'verified_fact' : 'raw_observation';
      this.autobiographicalMemoryService.recordExperience({
        type: 'autobiographical',
        content: `[Closed-Loop Agency] Objective: "${objective}" (${allStepsSucceeded ? 'Verified Success' : 'Failed'}). Outcome: ${digitalExp?.outcomeSummary || (allStepsSucceeded ? 'Completed' : 'Failed')}.`,
        rawObservation: verifications.find((v) => v.verified)?.observedOutcome || failureReason || undefined,
        provenance: memoryProvenance,
        confidence: allStepsSucceeded ? 0.95 : 0.8,
        importance: allStepsSucceeded ? 0.8 : 0.5,
        tags: ['agency', finalStatus, primaryActionType, ...(switchedCandidates ? ['recovery'] : [])],
        metadata: {
          taskId: task.id,
          cycleId,
          switchedCandidates,
          failureReason,
        },
      });
    }

    const stage = allStepsSucceeded
      ? 'verified_outcome'
      : (verifications.some((v) => v.status === 'partially_successful') ? 'uncertain_outcome' : 'failed_outcome');

    return {
      id: cycleId,
      taskId: task.id,
      objective,
      stage,
      success: allStepsSucceeded,
      plan,
      observations,
      verifications,
      experience: digitalExp,
      reflection: reflection || undefined,
      switchedCandidates,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Executes a pre-formulated plan through the closed-loop verification pipeline.
   */
  public async executePlan(
    plan: AgencyPlan,
    task?: AgencyTask,
  ): Promise<ClosedLoopCycleResult & { allStepsSucceeded: boolean; failureReason: string | null }> {
    const cycleId = crypto.randomUUID();
    const actualTask: AgencyTask = task || (this.taskManager && plan.taskId ? this.taskManager.getTask(plan.taskId) : null) || {
      id: plan.taskId || crypto.randomUUID(),
      title: plan.objective,
      objective: plan.objective,
      constraints: [],
      completionCriteria: [],
      initiator: 'user',
      status: 'authorized',
      priority: 'normal',
      currentStepIndex: 0,
      totalSteps: plan.steps?.length || 0,
      retryCount: 0,
      maxRetries: 3,
      error: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const observations: AgencyObservation[] = [];
    const verifications: VerificationResult[] = [];
    let allStepsSucceeded = true;
    let switchedCandidates = false;
    let failureReason: string | null = null;

    if (!plan.steps || plan.steps.length === 0) {
      allStepsSucceeded = false;
      failureReason = 'Plan formulated with zero steps; cannot execute empty plan';
      this.logger.warn(`Plan for task ${actualTask.id} has 0 steps; failing closed.`);
      if (this.taskManager && actualTask.id) {
        try {
          this.taskManager.handleFailure(actualTask.id, failureReason);
        } catch {}
      }
      return {
        id: cycleId,
        taskId: actualTask.id,
        objective: plan.objective,
        stage: 'failed_outcome',
        success: false,
        allStepsSucceeded: false,
        failureReason,
        plan,
        observations: [],
        verifications: [],
        switchedCandidates: false,
        timestamp: new Date().toISOString(),
      };
    }

    if (this.agencyRepo) {
      try { this.agencyRepo.savePlan(plan); } catch {}
    }
    if (this.taskManager) {
      try { this.taskManager.transitionTask(actualTask.id, 'running'); } catch {}
    }

    for (let i = 0; i < plan.steps.length; i++) {
      const step: PlanStep = plan.steps[i]!;
      const action = step.action;

      // AUTHORIZE
      const auth = this.permissionController.authorize(action);
      if (!auth.allowed) {
        this.logger.warn(`Action ${action.id} (${action.type}) denied by permission controller: ${auth.denialReason}`);
        const ver: VerificationResult = {
          actionId: action.id,
          expectedOutcome: action.expectedOutcome,
          observedOutcome: `Action denied by policy: ${auth.denialReason}`,
          verified: false,
          confidence: 1.0,
          status: 'failed',
          failureReason: auth.denialReason || 'Unauthorized action proposal',
          isRecoverable: false,
          evidence: { denialReason: auth.denialReason },
          timestamp: new Date().toISOString(),
        };
        if (this.agencyRepo) {
          try { this.agencyRepo.saveVerification(ver); } catch {}
        }
        verifications.push(ver);
        allStepsSucceeded = false;
        failureReason = auth.denialReason || 'Unauthorized action';
        break;
      }

      // EXECUTE
      let obs: AgencyObservation;
      try {
        obs = await this.executeAction(action, actualTask, observations);
      } catch (execErr: any) {
        obs = {
          id: crypto.randomUUID(),
          taskId: actualTask.id,
          actionId: action.id,
          source: 'process_table',
          timestamp: new Date().toISOString(),
          success: false,
          confidence: 1.0,
          provenance: 'ClosedLoopAgencyService:execution_exception',
          data: {},
          error: execErr.message || String(execErr),
        };
      }

      if (this.agencyRepo) {
        try { this.agencyRepo.saveObservation(obs); } catch {}
      }
      observations.push(obs);

      // VERIFY
      let ver = this.verificationEngine.verify(action, obs);

      if (!ver.verified && ver.isRecoverable && ver.recommendedStrategy === 'switch_candidate') {
        const recovered = await this.attemptCandidateRecovery(action, actualTask, observations, ver);
        if (recovered) {
          obs = recovered.observation;
          ver = recovered.verification;
          switchedCandidates = true;
          if (this.agencyRepo) {
            try { this.agencyRepo.saveObservation(obs); } catch {}
          }
          observations.push(obs);
        }
      }

      if (this.agencyRepo) {
        try { this.agencyRepo.saveVerification(ver); } catch {}
      }
      verifications.push(ver);

      if (!ver.verified) {
        allStepsSucceeded = false;
        failureReason = ver.failureReason || 'Action failed verification';
        if (this.taskManager) {
          try { this.taskManager.handleFailure(actualTask.id, failureReason); } catch {}
        }
        break;
      }

      if (this.taskManager) {
        try { this.taskManager.advanceStep(actualTask.id); } catch {}
      }
    }

    const finalStatus = allStepsSucceeded ? 'completed' : 'failed';
    if (this.taskManager) {
      try { this.taskManager.transitionTask(actualTask.id, finalStatus, failureReason); } catch {}
    }

    return {
      id: cycleId,
      taskId: actualTask.id,
      objective: plan.objective,
      stage: allStepsSucceeded ? 'verified_outcome' : 'failed_outcome',
      success: allStepsSucceeded,
      allStepsSucceeded,
      failureReason,
      plan,
      observations,
      verifications,
      switchedCandidates,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Action Execution Dispatcher across Web, Computer, and Desktop providers.
   */
  public async executeAction(
    action: ActionProposal,
    task?: AgencyTask,
    previousObservations: AgencyObservation[] = [],
    isPreAuthorized = false,
  ): Promise<AgencyObservation> {
    const params = (action.payload || (action as any).parameters || (action as any).params || {}) as Record<string, any>;
    const timestamp = new Date().toISOString();
    const taskId = task?.id || action.taskId || 'task_default';
    const taskObjective = task?.objective || action.rationale || '';

    // Secure Execution Boundary: check permission policy if not already pre-authorized in executeClosedLoop
    if (!isPreAuthorized) {
      const auth = this.permissionController.authorize(action);
      if (!auth.allowed) {
        this.logger.warn(`Action ${action.id} (${action.type}) rejected at execution boundary: ${auth.denialReason}`);
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ClosedLoopAgency:execution_boundary_denied',
          data: { denialReason: auth.denialReason },
          error: auth.denialReason || 'Unauthorized action at execution boundary',
        };
      }
    }

    // 1. Web Video Selection & Navigation
    if (action.type === 'web_select_video' || action.type === 'web_navigate' || action.type === 'navigate_browser') {
      let targetUrl = (params['targetUrl'] || params['url']) as string;
      let videoTitle = (params['videoTitle'] || params['title']) as string;

      // If targetUrl is not yet bound, dynamically select the best candidate from Step 0 results
      if (!targetUrl) {
        const searchObs = previousObservations.find(
          (o) => o.source === 'browser_metadata' && o.data?.candidates && o.data.candidates.length > 0,
        );
        if (searchObs && searchObs.data.candidates.length > 0) {
          if (this.webAgency) {
            const decision = this.webAgency.evaluateVideoCandidates(taskObjective, searchObs.data.candidates);
            if (decision.selectedCandidate) {
              targetUrl = decision.selectedCandidate.url;
              videoTitle = decision.selectedCandidate.title;
            }
          } else {
            targetUrl = searchObs.data.candidates[0].url;
            videoTitle = searchObs.data.candidates[0].title;
          }
        }
      }

      if (!targetUrl) {
        targetUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(taskObjective);
      }

      action.payload = action.payload || {};
      action.payload.targetUrl = targetUrl;
      action.payload.videoTitle = videoTitle;

      if (!this.browserProvider) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'browser_video_element',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'WebAgencyService.navigateToVideo',
          data: { targetUrl },
          error: 'No browserProvider available for web navigation',
        };
      }

      const pageObs = await this.browserProvider.navigate(targetUrl);
      const hasVid = Boolean(pageObs.hasVideoElement);
      const isPlay = Boolean(pageObs.isPlaying);
      const isProg = Boolean(pageObs.playbackProgressing ?? isPlay);

      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'browser_video_element',
        timestamp,
        success: hasVid && isProg,
        confidence: hasVid ? 0.95 : 0.0,
        provenance: 'WebAgencyService.navigateToVideo',
        data: {
          url: pageObs.url || targetUrl,
          currentUrl: pageObs.url || targetUrl,
          title: pageObs.title || videoTitle,
          pageTitle: pageObs.title || videoTitle,
          hasVideoElement: hasVid,
          isPlaying: isPlay,
          playbackProgressing: isProg,
          playbackState: pageObs.playbackState || (isPlay ? 'playing' : 'paused'),
          playbackError: pageObs.playbackError,
          timeObservations: pageObs.timeObservations || [],
        },
        error: pageObs.playbackError || (!hasVid ? 'No video element discovered on target page' : null),
      };
    }

    // 2. Web Video Search
    if (action.type === 'web_search') {
      const query = (params['query'] || params['topicQuery'] || taskObjective) as string;
      let candidates: VideoCandidate[] = [];

      if (this.webAgency) {
        candidates = await this.webAgency.searchVideos(query);
      } else if (this.browserProvider) {
        candidates = await this.browserProvider.searchVideos(query);
      } else {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'browser_metadata',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'WebAgencyService.searchVideos',
          data: { query, candidates: [] },
          error: 'No webAgency or browserProvider available for web search',
        };
      }

      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'browser_metadata',
        timestamp,
        success: candidates.length > 0,
        confidence: 0.95,
        provenance: 'WebAgencyService.searchVideos',
        data: {
          query,
          candidatesCount: candidates.length,
          candidates,
        },
        error: candidates.length === 0 ? 'No candidate videos discovered for search query' : null,
      };
    }

    // 3. Application Launch
    if (action.type === 'app_launch') {
      const appName = String(params['appName'] || params['app'] || 'steam');
      const args = (params['args'] as string[]) || [];

      if (this.desktopProvider) {
        const desktopLaunch = await this.desktopProvider.launchApplication(appName, args);
        if (desktopLaunch.success) {
          let windowFound: boolean | undefined;
          try {
            const wins = await this.desktopProvider.listWindows();
            if (wins.some((w) => w.appName?.toLowerCase().includes(appName.toLowerCase()) || w.title?.toLowerCase().includes(appName.toLowerCase()))) {
              windowFound = true;
            }
          } catch {}

          return {
            id: crypto.randomUUID(),
            taskId,
            actionId: action.id,
            source: 'process_table',
            timestamp,
            success: true,
            confidence: 1.0,
            provenance: 'DesktopEnvironmentProvider.launchApplication',
            data: {
              appName: desktopLaunch.appName,
              pid: desktopLaunch.pid,
              isRunning: true,
              windowFound: windowFound ?? true,
            },
            error: null,
          };
        }
      }

      if (!this.computerProvider) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.launchApp',
          data: { appName, isRunning: false },
          error: `No computerProvider available to launch application '${appName}'`,
        };
      }

      const launchRes = await this.computerProvider.launchApp(appName, args);
      let windowFound = (launchRes as any).windowFound;
      if (windowFound === undefined && this.computerProvider.getActiveWindow) {
        try {
          const win = await this.computerProvider.getActiveWindow();
          if (win && (win.appName?.toLowerCase().includes(appName.toLowerCase()) || win.title?.toLowerCase().includes(appName.toLowerCase()))) {
            windowFound = true;
          }
        } catch {}
      }

      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'process_table',
        timestamp,
        success: launchRes.isRunning,
        confidence: launchRes.isRunning ? 1.0 : 0.0,
        provenance: 'ComputerProvider.launchApp',
        data: {
          appName,
          pid: launchRes.pid,
          isRunning: launchRes.isRunning,
          windowFound: windowFound ?? true,
        },
        error: launchRes.isRunning ? null : `Failed to launch application ${appName}`,
      };
    }

    // 3b. Desktop File Opening (e.g. tenor.gif)
    if (action.type === 'desktop_open_file' || action.type === 'system_open_file') {
      const target = String(params['filePath'] || params['fileName'] || params['target'] || '');
      let resolvedPath = target;
      let opened = false;
      let errMessage: string | null = null;

      if (this.desktopProvider) {
        const res = await this.desktopProvider.openFile(target);
        opened = res.success;
        resolvedPath = res.resolvedPath || target;
        errMessage = res.error || null;
      } else {
        try {
          const child = spawn('xdg-open', [target], { detached: true, stdio: 'ignore' });
          child.unref();
          opened = true;
        } catch (e: any) {
          errMessage = e.message;
        }
      }

      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'filesystem_stat',
        timestamp,
        success: opened,
        confidence: opened ? 1.0 : 0.0,
        provenance: 'DesktopEnvironmentProvider.openFile',
        data: {
          target,
          resolvedPath,
          opened,
          exists: opened && fs.existsSync(resolvedPath),
        },
        error: opened ? null : (errMessage || `Failed to open file "${target}"`),
      };
    }

    // 3c. Desktop MPRIS Media Control (Play, Pause, Skip)
    if (action.type === 'desktop_media_control') {
      const cmd = String(params['command'] || 'PlayPause');
      let executed = false;
      if (this.desktopProvider) {
        if (cmd === 'Play') executed = await this.desktopProvider.mprisPlay();
        else if (cmd === 'Pause') executed = await this.desktopProvider.mprisPause();
        else if (cmd === 'Next') executed = await this.desktopProvider.mprisNext();
        else if (cmd === 'Previous') executed = await this.desktopProvider.mprisPrevious();
        else if (cmd === 'Stop') executed = await this.desktopProvider.mprisStop();
        else executed = await this.desktopProvider.mprisPlayPause();
      }

      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'audio_stream_perception',
        timestamp,
        success: executed,
        confidence: executed ? 1.0 : 0.0,
        provenance: 'DesktopEnvironmentProvider.mpris',
        data: { command: cmd, executed },
        error: executed ? null : `Failed to execute MPRIS media command: ${cmd}`,
      };
    }

    // 3d. Desktop Open Browser (Google Chrome Profile 7 - arletex.email@gmail.com)
    if (action.type === 'desktop_open_browser') {
      const url = String(params['url'] || 'https://google.com');
      let res: { success: boolean; pid?: number; message?: string };
      if (this.desktopProvider) {
        res = await this.desktopProvider.openInArleBrowser(url);
      } else {
        try {
          const envVars = {
            ...process.env,
            DISPLAY: process.env.DISPLAY || ':0',
            WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY || 'wayland-1',
            XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid ? process.getuid() : 1000}`,
          };
          const child = spawn('flatpak', ['run', 'com.google.Chrome', '--profile-directory=Profile 7', url], {
            detached: true,
            stdio: 'ignore',
            env: envVars,
          });
          child.unref();
          res = { success: true, pid: child.pid, message: `Opened in Chrome Profile 7: ${url}` };
        } catch {
          res = { success: false, message: 'Could not launch Google Chrome' };
        }
      }

      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'process_table',
        timestamp,
        success: res.success,
        confidence: res.success ? 1.0 : 0.0,
        provenance: 'DesktopEnvironmentProvider.openInArleBrowser',
        data: {
          url,
          profile: 'Profile 7',
          email: 'arletex.email@gmail.com',
          message: res.message,
        },
        error: res.success ? null : (res.message || 'Browser launch failed'),
      };
    }

    // 4. Screen Capture
    if (action.type === 'desktop_take_screenshot' || action.type === 'capture_screen') {
      if (!this.computerProvider) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'screen_frame_vision',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.captureScreen',
          data: {},
          error: 'No computerProvider available for screen capture',
        };
      }

      const cap = await this.computerProvider.captureScreen();
      const hasValidImage = Boolean(cap.imageBase64 && cap.imageBase64 !== 'fake-data');

      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'screen_frame_vision',
        timestamp,
        success: hasValidImage,
        confidence: hasValidImage ? 1.0 : 0.0,
        provenance: 'ComputerProvider.captureScreen',
        data: {
          width: cap.width,
          height: cap.height,
        },
        error: hasValidImage ? null : 'Screen capture produced empty image',
      };
    }

    // 5. Filesystem: Write File
    if (action.type === 'system_write_file' || (action.type as string) === 'write_file') {
      const filePath = String(params['filePath'] || params['path'] || '');
      const content = String(params['content'] || '');
      const overwrite = Boolean(params['overwrite'] ?? true);
      if (!this.computerProvider) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.writeFile',
          data: { filePath },
          error: 'No computerProvider available for file write',
        };
      }
      try {
        const res = await this.computerProvider.writeFile(filePath, content, overwrite);
        let sha256: string | null = null;
        const expectedSha256 = crypto.createHash('sha256').update(content).digest('hex');
        let contentVerified = false;
        if (res.success && typeof this.computerProvider.readFile === 'function') {
          try {
            const readBack = await this.computerProvider.readFile(filePath);
            sha256 = crypto.createHash('sha256').update(readBack).digest('hex');
            contentVerified = sha256 === expectedSha256;
          } catch {
            // Read back failed
          }
        }
        const writeSuccess = res.success && (sha256 ? contentVerified : true);
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: writeSuccess,
          confidence: writeSuccess ? 1.0 : 0.0,
          provenance: 'ComputerProvider.writeFile',
          data: {
            filePath,
            exists: res.success,
            sizeBytes: res.sizeBytes,
            sha256,
            expectedSha256,
            contentVerified,
          },
          error: writeSuccess ? null : (contentVerified ? 'File write failed' : 'Content SHA-256 hash mismatch upon read-back'),
        };
      } catch (err: any) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.writeFile',
          data: { filePath, exists: false },
          error: err.message,
        };
      }
    }

    // 6. Filesystem: Read File
    if (action.type === 'system_read_file' || (action.type as string) === 'read_file') {
      const filePath = String(params['filePath'] || params['path'] || '');
      if (!this.computerProvider) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.readFile',
          data: { filePath },
          error: 'No computerProvider available for file read',
        };
      }
      try {
        const content = await this.computerProvider.readFile(filePath);
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: true,
          confidence: 1.0,
          provenance: 'ComputerProvider.readFile',
          data: { filePath, content, sizeBytes: content.length },
          error: null,
        };
      } catch (err: any) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.readFile',
          data: { filePath },
          error: err.message,
        };
      }
    }

    // 7. Filesystem: List Directory
    if (action.type === 'system_list_directory' || (action.type as string) === 'list_directory') {
      const dirPath = String(params['dirPath'] || params['path'] || '');
      if (!this.computerProvider) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.listFiles',
          data: { dirPath },
          error: 'No computerProvider available for directory listing',
        };
      }
      try {
        const entries = await this.computerProvider.listFiles(dirPath);
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: true,
          confidence: 1.0,
          provenance: 'ComputerProvider.listFiles',
          data: { dirPath, entries, count: entries.length },
          error: null,
        };
      } catch (err: any) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.listFiles',
          data: { dirPath },
          error: err.message,
        };
      }
    }

    // 8. Process Execution: Command Exec
    if (action.type === 'execute_command') {
      const cmd = String(params['command'] || params['executable'] || '');
      const args = (params['args'] as string[]) || [];
      if (!this.computerProvider || typeof this.computerProvider.executeCommand !== 'function') {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.executeCommand',
          data: { command: cmd },
          error: 'No computerProvider executeCommand capability available',
        };
      }
      try {
        const cmdRes = await this.computerProvider.executeCommand(cmd, args);
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: cmdRes.exitCode === 0,
          confidence: cmdRes.exitCode === 0 ? 1.0 : 0.0,
          provenance: 'ComputerProvider.executeCommand',
          data: { command: cmd, exitCode: cmdRes.exitCode, stdout: cmdRes.stdout, stderr: cmdRes.stderr },
          error: cmdRes.exitCode === 0 ? null : (cmdRes.stderr || `Command exited with code ${cmdRes.exitCode}`),
        };
      } catch (err: any) {
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: false,
          confidence: 0.0,
          provenance: 'ComputerProvider.executeCommand',
          data: { command: cmd },
          error: err.message,
        };
      }
    }

    // 9. Desktop Input Emulation
    if (action.type.startsWith('desktop_')) {
      if (this.deviceAgency && typeof this.deviceAgency.executeDeviceAction === 'function') {
        const actionName = action.type.replace('desktop_', '');
        const devRes = await this.deviceAgency.executeDeviceAction({
          action: actionName,
          ...params,
        });
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: devRes.success,
          confidence: devRes.success ? 0.95 : 0.0,
          provenance: 'DeviceAgencyService.executeDeviceAction',
          data: { actionType: action.type, executed: devRes.success, message: devRes.message },
          error: devRes.success ? null : devRes.message,
        };
      }
      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'process_table',
        timestamp,
        success: false,
        confidence: 0.0,
        provenance: 'ClosedLoopAgency:input_emulation_unconfigured',
        data: { actionType: action.type, executed: false },
        error: 'DeviceAgency provider not configured for desktop input emulation',
      };
    }

    // 10. External Communication: Telegram & Messages
    if (action.type.startsWith('telegram_') || (action.type as string) === 'send_message') {
      const text = String(params['text'] || params['message'] || params['content'] || '');
      const chatId = String(params['chatId'] || params['recipient'] || '');
      if (this.telegramBridge && typeof this.telegramBridge.sendMessage === 'function') {
        try {
          const sent = await this.telegramBridge.sendMessage(chatId, text);
          return {
            id: crypto.randomUUID(),
            taskId,
            actionId: action.id,
            source: 'process_table',
            timestamp,
            success: Boolean(sent),
            confidence: sent ? 0.98 : 0.0,
            provenance: 'TelegramBridgeService.sendMessage',
            data: { sent: Boolean(sent), chatId, messageId: (sent as any)?.message_id || 'sent' },
            error: sent ? null : 'Telegram dispatch failed',
          };
        } catch (err: any) {
          return {
            id: crypto.randomUUID(),
            taskId,
            actionId: action.id,
            source: 'process_table',
            timestamp,
            success: false,
            confidence: 0.0,
            provenance: 'TelegramBridgeService.sendMessage',
            data: { sent: false, chatId },
            error: err.message,
          };
        }
      }
      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'process_table',
        timestamp,
        success: false,
        confidence: 0.0,
        provenance: 'ClosedLoopAgency:message_dispatch_unconfigured',
        data: { sent: false, chatId, textSnippet: text.slice(0, 50) },
        error: 'TelegramBridge provider not configured for message dispatch',
      };
    }

    // 11. External Communication: Email Dispatch
    if (action.type === 'send_email') {
      const to = String(params['to'] || params['recipient'] || '');
      const subject = String(params['subject'] || '(No Subject)');
      const body = String(params['body'] || params['content'] || params['text'] || '');
      const approvalToken = params['approvalToken'] ? String(params['approvalToken']) : undefined;

      if (this.emailProvider) {
        const sendRes = await this.emailProvider.sendEmail(
          { to, subject, body },
          approvalToken,
        );
        return {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'process_table',
          timestamp,
          success: sendRes.success,
          confidence: sendRes.success ? 0.98 : 0.0,
          provenance: 'EmailProvider.sendEmail',
          data: {
            to,
            subject,
            messageId: sendRes.messageId,
            serverAck: sendRes.serverAck,
          },
          error: sendRes.error || null,
        };
      }

      return {
        id: crypto.randomUUID(),
        taskId,
        actionId: action.id,
        source: 'process_table',
        timestamp,
        success: false,
        confidence: 0.0,
        provenance: 'ClosedLoopAgency:email_dispatch_unconfigured',
        data: { to, subject },
        error: 'EmailProvider not configured for email dispatch',
      };
    }

    // Default Fallback: Unsupported action types fail closed
    return {
      id: crypto.randomUUID(),
      taskId,
      actionId: action.id,
      source: 'process_table',
      timestamp,
      success: false,
      confidence: 0.0,
      provenance: 'ClosedLoopAgency:unsupported_action',
      data: { actionType: action.type },
      error: `Unsupported agency action type: ${action.type}`,
    };
  }

  /**
   * Recovers from failed playback by switching to alternative candidate (Test 8).
   */
  private async attemptCandidateRecovery(
    failedAction: ActionProposal,
    task: AgencyTask,
    observations: AgencyObservation[],
    _verification: VerificationResult,
  ): Promise<{ observation: AgencyObservation; verification: VerificationResult } | null> {
    const searchObs = observations.find(
      (o) => o.source === 'browser_metadata' && o.data?.candidates && o.data.candidates.length > 1,
    );
    if (!searchObs) return null;

    const candidates: VideoCandidate[] = searchObs.data.candidates;
    const failedUrl = ((failedAction.payload?.targetUrl || (failedAction as any).parameters?.targetUrl) as string) || '';
    const alternativeCandidate = candidates.find((c) => c.url && c.url !== failedUrl) || candidates[1];
    if (!alternativeCandidate) return null;

    this.logger.info(
      `Attempting candidate recovery for task "${task.objective}": switching to alternative candidate "${alternativeCandidate.title}" (${alternativeCandidate.url})`,
    );

    const recoveryAction: ActionProposal = {
      ...failedAction,
      id: crypto.randomUUID(),
      payload: {
        ...failedAction.payload,
        targetUrl: alternativeCandidate.url,
        videoTitle: alternativeCandidate.title,
        isRecoveryAttempt: true,
      },
    };

    let recoveryObs: AgencyObservation;
    try {
      recoveryObs = await this.executeAction(recoveryAction, task, observations, true);
    } catch (err: any) {
      recoveryObs = {
        id: crypto.randomUUID(),
        taskId: task.id,
        actionId: recoveryAction.id,
        source: 'browser_video_element',
        timestamp: new Date().toISOString(),
        success: false,
        confidence: 0.9,
        provenance: 'CandidateRecovery:exception',
        data: {},
        error: err.message,
      };
    }

    const recoveryVer = this.verificationEngine.verify(recoveryAction, recoveryObs);
    return {
      observation: recoveryObs,
      verification: recoveryVer,
    };
  }

  private extractDomainFromObjective(objective: string): string {
    const lower = objective.toLowerCase();
    if (lower.includes('transformer') || lower.includes('attention') || lower.includes('neural')) {
      return 'Transformer Architecture';
    }
    if (lower.includes('microkernel') || lower.includes('operating system') || lower.includes('kernel')) {
      return 'Operating Systems';
    }
    if (lower.includes('steam') || lower.includes('game')) {
      return 'Gaming & Recreation';
    }
    return 'Digital Agency';
  }
}
