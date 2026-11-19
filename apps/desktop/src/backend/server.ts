import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import {
  Activity,
  ActivityOrigin,
  ActivityStatus,
  AppConfig,
  CancelInferenceInputSchema,
  CreateActivityInputSchema,
  CreateConversationInputSchema,
  CreateMemoryInputSchema,
  CreateMessageInputSchema,
  DeviceTelemetry,
  InferenceHealthResult,
  Memory,
  QueryMemoriesInput,
  QueryMemoriesInputSchema,
  StartInferenceStreamInputSchema,
  StreamChunk,
  SynthesizeSpeechInputSchema,
  TranscribeAudioInputSchema,
  UpdateActivityInputSchema,
  UpdateConversationInputSchema,
  UpdateInferenceConfigInputSchema,
  UpdateMemoryInputSchema,
  VisionInspectInputSchema,
  VideoInspectInputSchema,
  CreateCheckpointInputSchema,
  RestoreCheckpointInputSchema,
  VisualPerceptionInputSchema,
  AuditoryPerceptionInputSchema,
} from '@arletex/contracts';
import {
  ActionPermissionController,
  ApeService,
  ContinuityManager,
  DEFAULT_ARLE_SYSTEM_PROMPT,
  ILogger,
  IntentTaskManager,
  MemoryExperienceSync,
  PlanningInterface,
  rootLogger,
  SafeComputerAgencyService,
  VerificationEngine,
  WebAgencyService,
} from '@arletex/core';
import { defaultVideoProcessor, ProcessedVideoResult } from './videoProcessor.js';
import { syncHistoricalMemories } from './historicalMemorySync.js';
import { defaultDeviceAgency, DeviceActionInput } from './deviceAgencyService.js';
import { defaultScreenReadingService, ScreenReadingService } from './screenReadingService.js';
import { defaultAudioPerception, AudioListeningResult } from './audioPerceptionService.js';
import { defaultNotificationListener, NotificationListenerService, DesktopNotification } from './notificationListenerService.js';
import {
  defaultTelegramBridge,
  TelegramBridgeService,
  InboundTelegramMessage,
  DownloadedTelegramMedia,
  TelegramMediaType,
} from './telegramBridgeService.js';
import { AutonomousAgencyService } from './autonomousAgencyService.js';
import {
  ActivityRepository,
  AgencyRepository,
  ApeRepository,
  AuditRepository,
  ConversationRepository,
  DatabaseService,
  MemoryRepository,
  MessageRepository,
  MigrationRunner,
  PreferenceRepository,
  ContinuityRepository,
  NarrativeRepository,
  TemporalRepository,
  WorldRepository,
  PerceptionRepository,
  EmbodimentRepository,
  SensorimotorRepository,
  SituationalRepository,
  AttentionRepository,
  WorkingMemoryRepository,
  MultiSystemMemoryRepository,
  SqliteLearningRepository,
  SqliteReasoningRepository,
  SqliteCausalRepository,
  SqlitePredictiveRepository,
  SqliteSimulationRepository,
  SqliteMetacognitionRepository,
  SqliteGlobalCognitiveRepository,
  SqliteExecutiveRepository,
  SqliteSelfGeneratedGoalRepository,
  SqlitePersistentPlanningRepository,
  SqliteDeliberationRepository,
  SqliteAutonomousAgencyRepository,
  SqliteEmotionalAppraisalRepository,
  SqliteEmotionalRepertoireRepository,
  SqliteEmotionalRegulationRepository,
  SqliteNeedsHomeostasisRepository,
  SqliteIntrinsicMotivationRepository,
  SqliteCuriosityExplorationRepository,
  SqliteRewardLearningRepository,
  SqliteHabitsAndRoutinesRepository,
  SqliteTemperamentPersonalityRepository,
  SqliteValuesMoralRepository,
  SqliteSelfEvaluationEfficacyRepository,
  SqliteLongTermDevelopmentRepository,
  SqliteTheoryOfMindRepository,
  SqliteEmpathyPerspectiveRepository,
  SqliteSocialEmotionsRepository,
  SqliteSocialCommunicationRepository,
  SqliteRelationshipsAttachmentRepository,
  SqliteSocialLearningCultureRepository,
} from '@arletex/database';
import { InferenceGateway } from '@arletex/inference';
import { TelemetryService } from './telemetryService.js';

const MAX_BODY_SIZE = 250 * 1024 * 1024; // 250MB limit to reliably support video uploads

export function sanitizeAssistantDialogue(text: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/\[(?:action|cmd|tone|thought|mood|emotion|state):[^\]]*\]/gi, '')
    .replace(/^\s*\[[^\]]+\]\s*/gm, '')
    .trim();

  // Guard against autoregressive associative runaway loops (unpunctuated word cascades > 45 words)
  const sentences = cleaned.split(/(?<=[.?!])\s+/);
  let hasRunaway = false;
  for (const s of sentences) {
    if (s.trim().split(/\s+/).length > 45 && !s.includes('\n')) {
      hasRunaway = true;
      break;
    }
  }

  if (hasRunaway) {
    const validSentences: string[] = [];
    for (const s of sentences) {
      const words = s.trim().split(/\s+/);
      if (words.length > 45 && !s.includes('\n')) {
        // Truncate at the first natural clause boundary to discard runaway token degenerations
        const clauseParts = s.split(/[,;—–-]\s+/);
        if (clauseParts.length > 0 && clauseParts[0] && clauseParts[0].split(/\s+/).length < 25) {
          validSentences.push(clauseParts[0].trim() + '.');
        }
        break;
      }
      validSentences.push(s);
    }
    cleaned = validSentences.join(' ').trim();
  }

  return cleaned;
}

export class ArletexBackendServer {
  private server: http.Server | null = null;
  private readonly config: AppConfig;
  private readonly logger: ILogger;
  private readonly dbService: DatabaseService;
  private readonly conversationRepo: ConversationRepository;
  private readonly messageRepo: MessageRepository;
  private readonly auditRepo: AuditRepository;
  private readonly memoryRepo: MemoryRepository;
  private readonly activityRepo: ActivityRepository;
  private readonly preferenceRepo: PreferenceRepository;
  private readonly apeRepo: ApeRepository;
  private readonly apeService: ApeService;
  private readonly telemetryService: TelemetryService;
  private readonly inferenceGateway: InferenceGateway;
  private readonly authToken: string;

  // Digital Agency Subsystem
  public readonly agencyRepo: AgencyRepository;
  public readonly permissionController: ActionPermissionController;
  public readonly safeComputerAgency: SafeComputerAgencyService;
  public readonly webAgency: WebAgencyService;
  public readonly verificationEngine: VerificationEngine;
  public readonly planningInterface: PlanningInterface;
  public readonly memorySync: MemoryExperienceSync;
  public readonly intentTaskManager: IntentTaskManager;

  // Persistent Individual Continuity Subsystem
  public readonly continuityRepo: ContinuityRepository;
  public readonly continuityManager: ContinuityManager;

  // Narrative Identity Subsystem (Milestone 03)
  public readonly narrativeRepo: NarrativeRepository;

  // Temporal Cognition Subsystem (Milestone 04)
  public readonly temporalRepo: TemporalRepository;

  // World Model Subsystem (Milestone 05)
  public readonly worldRepo: WorldRepository;

  // Multimodal Perception Subsystem (Milestone 06)
  public readonly perceptionRepo: PerceptionRepository;

  // Embodiment and Interoception Subsystem (Milestone 07)
  public readonly embodimentRepo: EmbodimentRepository;

  // Sensorimotor and Action Grounding Subsystem (Milestone 08)
  public readonly sensorimotorRepo: SensorimotorRepository;

  // Situational Awareness Subsystem (Milestone 09)
  public readonly situationalRepo: SituationalRepository;

  // Attention and Salience Subsystem (Milestone 10)
  public readonly attentionRepo: AttentionRepository;

  // Working Memory Subsystem (Milestone 11)
  public readonly workingMemoryRepo: WorkingMemoryRepository;

  // Multi-System Memory Subsystem (Milestone 12)
  public readonly multiSystemMemoryRepo: MultiSystemMemoryRepository;

  // Learning and Adaptation Subsystem (Milestone 13)
  public readonly learningRepo: SqliteLearningRepository;

  // General Reasoning Subsystem (Milestone 14)
  public readonly reasoningRepo: SqliteReasoningRepository;

  // Causal Reasoning Subsystem (Milestone 15)
  public readonly causalRepo: SqliteCausalRepository;

  // Predictive Cognition Subsystem (Milestone 16)
  public readonly predictiveRepo: SqlitePredictiveRepository;

  // Imagination and Simulation Subsystem (Milestone 17)
  public readonly simulationRepo: SqliteSimulationRepository;

  // Metacognition Subsystem (Milestone 18)
  public readonly metacognitionRepo: SqliteMetacognitionRepository;

  // Global Cognitive Integration Subsystem (Milestone 19)
  public readonly globalCognitiveRepo: SqliteGlobalCognitiveRepository;

  // Executive Functions Subsystem (Milestone 20)
  public readonly executiveRepo: SqliteExecutiveRepository;
  public readonly goalRepo: SqliteSelfGeneratedGoalRepository;
  public readonly planningRepo: SqlitePersistentPlanningRepository;
  public readonly deliberationRepo: SqliteDeliberationRepository;
  public readonly autonomousAgencyRepo: SqliteAutonomousAgencyRepository;
  public readonly emotionalAppraisalRepo: SqliteEmotionalAppraisalRepository;
  public readonly emotionalRepertoireRepo: SqliteEmotionalRepertoireRepository;
  public readonly emotionalRegulationRepo: SqliteEmotionalRegulationRepository;
  public readonly homeostasisRepo: SqliteNeedsHomeostasisRepository;
  public readonly intrinsicMotivationRepo: SqliteIntrinsicMotivationRepository;
  public readonly curiosityRepo: SqliteCuriosityExplorationRepository;
  public readonly rewardLearningRepo: SqliteRewardLearningRepository;
  public readonly habitsRepo: SqliteHabitsAndRoutinesRepository;
  public readonly temperamentRepo: SqliteTemperamentPersonalityRepository;
  public readonly valuesMoralRepo: SqliteValuesMoralRepository;
  public readonly efficacyRepo: SqliteSelfEvaluationEfficacyRepository;
  public readonly longTermDevelopmentRepo: SqliteLongTermDevelopmentRepository;
  public readonly tomRepo: SqliteTheoryOfMindRepository;
  public readonly empathyRepo: SqliteEmpathyPerspectiveRepository;
  public readonly socialEmotionsRepo: SqliteSocialEmotionsRepository;
  public readonly socialCommunicationRepo: SqliteSocialCommunicationRepository;
  public readonly relationshipsAttachmentRepo: SqliteRelationshipsAttachmentRepository;
  public readonly socialLearningCultureRepo: SqliteSocialLearningCultureRepository;

  private activeStreams = new Map<string, AbortController>();
  private activeTtsAbortControllers = new Set<AbortController>();
  private port = 0;

  private lastTtftMs: number | null = null;
  private lastTps: number | null = null;
  private isGenerating = false;

  private notificationListener: NotificationListenerService | null = null;
  private telegramBridge: TelegramBridgeService | null = null;
  private autonomousAgency: AutonomousAgencyService | null = null;
  private screenReading: ScreenReadingService = defaultScreenReadingService;

  constructor(config: AppConfig, logger: ILogger = rootLogger) {
    this.config = config;
    this.logger = logger.child('BackendServer');
    this.authToken = process.env['ARLETEX_AUTH_TOKEN'] || '';

    this.dbService = new DatabaseService(config.databasePath, logger);
    const db = this.dbService.connect({ recoverCorruptFile: true });

    // Run migrations
    const migrator = new MigrationRunner(db, logger);
    migrator.run();

    this.conversationRepo = new ConversationRepository(db);
    this.messageRepo = new MessageRepository(db);
    this.auditRepo = new AuditRepository(db);
    this.memoryRepo = new MemoryRepository(db);
    this.activityRepo = new ActivityRepository(db);
    this.preferenceRepo = new PreferenceRepository(db);
    this.inferenceGateway = new InferenceGateway(config.inference, logger);
    this.apeRepo = new ApeRepository(db);
    this.narrativeRepo = new NarrativeRepository(db);
    this.temporalRepo = new TemporalRepository(db);
    this.worldRepo = new WorldRepository(db);
    this.perceptionRepo = new PerceptionRepository(db);
    this.embodimentRepo = new EmbodimentRepository(db);
    this.sensorimotorRepo = new SensorimotorRepository(db);
    this.situationalRepo = new SituationalRepository(db);
    this.attentionRepo = new AttentionRepository(db);
    this.workingMemoryRepo = new WorkingMemoryRepository(db);
    this.multiSystemMemoryRepo = new MultiSystemMemoryRepository(db);
    this.learningRepo = new SqliteLearningRepository(db);
    this.reasoningRepo = new SqliteReasoningRepository(db);
    this.causalRepo = new SqliteCausalRepository(db);
    this.predictiveRepo = new SqlitePredictiveRepository(db);
    this.simulationRepo = new SqliteSimulationRepository(db);
    this.metacognitionRepo = new SqliteMetacognitionRepository(db);
    this.globalCognitiveRepo = new SqliteGlobalCognitiveRepository(db);
    this.executiveRepo = new SqliteExecutiveRepository(db);
    this.goalRepo = new SqliteSelfGeneratedGoalRepository(db);
    this.planningRepo = new SqlitePersistentPlanningRepository(db);
    this.deliberationRepo = new SqliteDeliberationRepository(db);
    this.autonomousAgencyRepo = new SqliteAutonomousAgencyRepository(db);
    this.emotionalAppraisalRepo = new SqliteEmotionalAppraisalRepository(db);
    this.emotionalRepertoireRepo = new SqliteEmotionalRepertoireRepository(db);
    this.emotionalRegulationRepo = new SqliteEmotionalRegulationRepository(db);
    this.homeostasisRepo = new SqliteNeedsHomeostasisRepository(db);
    this.intrinsicMotivationRepo = new SqliteIntrinsicMotivationRepository(db);
    this.curiosityRepo = new SqliteCuriosityExplorationRepository(db);
    this.rewardLearningRepo = new SqliteRewardLearningRepository(db);
    this.habitsRepo = new SqliteHabitsAndRoutinesRepository(db);
    this.temperamentRepo = new SqliteTemperamentPersonalityRepository(db);
    this.valuesMoralRepo = new SqliteValuesMoralRepository(db);
    this.efficacyRepo = new SqliteSelfEvaluationEfficacyRepository(db);
    this.longTermDevelopmentRepo = new SqliteLongTermDevelopmentRepository(db);
    this.tomRepo = new SqliteTheoryOfMindRepository(db);
    this.empathyRepo = new SqliteEmpathyPerspectiveRepository(db);
    this.socialEmotionsRepo = new SqliteSocialEmotionsRepository(db);
    this.socialCommunicationRepo = new SqliteSocialCommunicationRepository(db);
    this.relationshipsAttachmentRepo = new SqliteRelationshipsAttachmentRepository(db);
    this.socialLearningCultureRepo = new SqliteSocialLearningCultureRepository(db);
    this.apeService = new ApeService(
      this.apeRepo,
      this.inferenceGateway,
      logger,
      this.narrativeRepo,
      this.temporalRepo,
      this.worldRepo,
      this.perceptionRepo,
      this.embodimentRepo,
      this.sensorimotorRepo,
      this.situationalRepo,
      this.attentionRepo,
      this.workingMemoryRepo,
      this.multiSystemMemoryRepo,
      this.learningRepo,
      this.reasoningRepo,
      this.causalRepo,
      this.predictiveRepo,
      this.simulationRepo,
      this.metacognitionRepo,
      this.globalCognitiveRepo,
      this.executiveRepo,
      this.goalRepo,
      this.planningRepo,
      this.deliberationRepo,
      this.autonomousAgencyRepo,
      this.emotionalAppraisalRepo,
      this.emotionalRepertoireRepo,
      this.emotionalRegulationRepo,
      this.homeostasisRepo,
      this.intrinsicMotivationRepo,
      this.curiosityRepo,
      this.rewardLearningRepo,
      this.habitsRepo,
      this.temperamentRepo,
      this.valuesMoralRepo,
      this.efficacyRepo,
      this.longTermDevelopmentRepo,
      this.tomRepo,
      this.empathyRepo,
      this.socialEmotionsRepo,
      this.socialCommunicationRepo,
      this.relationshipsAttachmentRepo,
      this.socialLearningCultureRepo,
    );
    this.telemetryService = new TelemetryService(logger);

    // Instantiate Digital Agency Subsystem
    this.agencyRepo = new AgencyRepository(db);
    this.permissionController = new ActionPermissionController(undefined, logger);
    this.safeComputerAgency = new SafeComputerAgencyService(this.permissionController, undefined, logger);
    this.webAgency = new WebAgencyService(this.permissionController, logger);
    this.verificationEngine = new VerificationEngine(logger);
    this.planningInterface = new PlanningInterface(this.agencyRepo, logger);
    this.memorySync = new MemoryExperienceSync(this.memoryRepo as any, logger);
    this.intentTaskManager = new IntentTaskManager(this.agencyRepo, logger);
    defaultDeviceAgency.setPermissionController(this.permissionController);

    // Instantiate Persistent Individual Continuity Subsystem
    const continuityBackupDir =
      config.databasePath !== ':memory:'
        ? path.join(config.dataDirectory, 'continuity_backups')
        : undefined;
    this.continuityRepo = new ContinuityRepository(db);
    this.continuityManager = new ContinuityManager(
      this.continuityRepo,
      this.apeRepo,
      this.apeService,
      this.memoryRepo,
      logger,
      continuityBackupDir,
    );
  }

  public getIntentTaskManager(): IntentTaskManager {
    return this.intentTaskManager;
  }

  public getPermissionController(): ActionPermissionController {
    return this.permissionController;
  }

  public async submitAgencyObjective(
    objective: string,
    initiator: 'user' | 'arle' = 'user',
  ) {
    const task = this.intentTaskManager.createTask({
      objective,
      initiator,
      status: 'authorized',
    });

    const plan = await this.planningInterface.formulatePlan(task);
    this.agencyRepo.savePlan(plan);
    this.intentTaskManager.transitionTask(task.id, 'authorized');
    return { task, plan };
  }

  public async executeAgencyTask(taskId: string) {
    const task = this.intentTaskManager.getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const plan = this.agencyRepo.getPlanByTask(taskId);
    if (!plan) throw new Error(`Plan for task ${taskId} not found`);

    this.intentTaskManager.transitionTask(taskId, 'running');
    const observations: any[] = [];
    const verifications: any[] = [];
    let allStepsSucceeded = true;

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]!;
      const action = step.action;

      // 1. Authorization check against ActionPermissionController
      const auth = this.permissionController.authorize(action);
      if (!auth.allowed) {
        this.logger.error(`Action ${action.id} denied: ${auth.denialReason}`);
        const ver = {
          actionId: action.id,
          expectedOutcome: action.expectedOutcome,
          observedOutcome: `Action denied by policy: ${auth.denialReason}`,
          verified: false,
          confidence: 1.0,
          status: 'failed' as const,
          failureReason: auth.denialReason || 'Unauthorized action proposal',
          isRecoverable: false,
          evidence: { denialReason: auth.denialReason },
          timestamp: new Date().toISOString(),
        };
        this.agencyRepo.saveVerification(ver);
        verifications.push(ver);
        allStepsSucceeded = false;
        break;
      }

      // 2. Execution layer
      let obs: any = null;
      const params = (action.payload || (action as any).parameters || {}) as Record<string, any>;
      try {
        if (action.type === 'web_select_video' || action.type === 'web_navigate' || action.type === 'navigate_browser') {
          let targetUrl = (params['targetUrl'] || params['url']) as string;
          let videoTitle = (params['videoTitle'] || params['title']) as string;

          // If targetUrl is not yet bound, dynamically select the best candidate from Step 0 results
          if (!targetUrl) {
            const previousSearchObs = observations.find(
              (o) => o.source === 'browser_page' && o.data?.candidates && o.data.candidates.length > 0,
            );
            if (previousSearchObs && previousSearchObs.data.candidates.length > 0) {
              const candidates = previousSearchObs.data.candidates;
              const decision = this.webAgency.evaluateAndSelectBestVideo(candidates, task.objective);
              if (decision.selectedCandidate) {
                targetUrl = decision.selectedCandidate.url;
                videoTitle = decision.selectedCandidate.title;
                this.logger.info(`Live candidate selection: "${videoTitle}" -> ${targetUrl}`);
              } else {
                this.logger.warn(`Candidate selection found no qualifying candidates: ${decision.rationale}`);
              }
            }
          }

          if (!targetUrl) {
            targetUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(task.objective);
          }

          // Physically launch Chrome Flatpak on Proof's desktop so he can see and hear it
          await defaultDeviceAgency.openChromeBrowser(targetUrl);

          // Use WebAgency (Playwright) to verify DOM elements and playback
          let pageObs: any;
          try {
            pageObs = await this.webAgency.navigateToVideo(targetUrl);
          } catch (navErr: any) {
            this.logger.warn(`Playwright observation note: ${navErr.message}`);
            pageObs = {
              url: targetUrl,
              title: videoTitle || 'Navigation Failed',
              hasVideoElement: false,
              isPlaying: false,
              playbackError: navErr.message,
            };
          }

          const hasVid = Boolean(pageObs?.hasVideoElement);
          const isPlay = Boolean(pageObs?.isPlaying);

          obs = {
            id: crypto.randomUUID(),
            taskId,
            actionId: action.id,
            source: 'browser_page',
            timestamp: new Date().toISOString(),
            success: hasVid && isPlay,
            confidence: hasVid ? 0.95 : 0.0,
            provenance: 'WebAgencyService.navigateToVideo + DeviceAgency.openChromeBrowser',
            data: {
              url: pageObs?.url || targetUrl,
              currentUrl: pageObs?.url || targetUrl,
              title: pageObs?.title || videoTitle || 'Loaded Webpage',
              pageTitle: pageObs?.title || videoTitle || 'Loaded Webpage',
              hasVideoElement: hasVid,
              isPlaying: isPlay,
            },
            error: pageObs?.playbackError || (!hasVid ? 'No HTML5 video element discovered on target page' : null),
          };
        } else if (action.type === 'app_launch') {
          const app = String(params['app'] || params['appName'] || 'steam');
          let appRes = { success: true, message: 'App launched' };
          if (app.toLowerCase().includes('steam')) {
            appRes = await defaultDeviceAgency.launchSteam(params['steamAppId'] as string);
          } else if (app.toLowerCase().includes('chrome')) {
            appRes = await defaultDeviceAgency.openChromeBrowser(params['url'] as string);
          }
          obs = {
            id: crypto.randomUUID(),
            taskId,
            actionId: action.id,
            source: 'system_probe',
            timestamp: new Date().toISOString(),
            success: appRes.success,
            confidence: 1.0,
            provenance: 'DeviceAgencyService.app_launch',
            data: { app, isRunning: appRes.success, message: appRes.message },
            error: appRes.success ? null : appRes.message,
          };
        } else if (action.type === 'web_search') {
          const query = (params['query'] || params['topicQuery'] || task.objective) as string;
          const candidates = await this.webAgency.searchVideos(query);
          obs = {
            id: crypto.randomUUID(),
            taskId,
            actionId: action.id,
            source: 'browser_page',
            timestamp: new Date().toISOString(),
            success: candidates.length > 0,
            confidence: 0.95,
            provenance: 'WebAgencyService.searchVideos',
            data: { candidatesCount: candidates.length, candidates },
            error: null,
          };
        } else if (action.type === 'execute_command') {
          const command = params['command'] as string;
          const args = (params['args'] as string[]) || [];
          const cmdRes = await this.safeComputerAgency.executeCommand(command, args);
          obs = {
            id: crypto.randomUUID(),
            taskId,
            actionId: action.id,
            source: 'system_probe',
            timestamp: new Date().toISOString(),
            success: cmdRes.exitCode === 0,
            confidence: 1.0,
            provenance: 'SafeComputerAgencyService.executeCommand',
            data: { exitCode: cmdRes.exitCode, stdout: cmdRes.stdout, stderr: cmdRes.stderr },
            error: cmdRes.exitCode !== 0 ? cmdRes.stderr : null,
          };
        } else if (action.type === 'capture_screen' || action.type === 'desktop_take_screenshot') {
          const capture = await defaultDeviceAgency.captureScreen();
          obs = {
            id: crypto.randomUUID(),
            taskId,
            actionId: action.id,
            source: 'screen_ocr',
            timestamp: new Date().toISOString(),
            success: !!capture.imageBase64,
            confidence: 1.0,
            provenance: 'DeviceAgencyService.captureScreen',
            data: { width: capture.width, height: capture.height },
            error: null,
          };
        }
      } catch (execErr: any) {
        obs = {
          id: crypto.randomUUID(),
          taskId,
          actionId: action.id,
          source: 'system_probe',
          timestamp: new Date().toISOString(),
          success: false,
          confidence: 1.0,
          provenance: 'ExecutionError',
          data: {},
          error: execErr.message || String(execErr),
        };
      }

      if (obs) {
        this.agencyRepo.saveObservation(obs);
        observations.push(obs);
      }

      // 3. Verification Engine comparison
      const ver = this.verificationEngine.verify(action, obs);
      this.agencyRepo.saveVerification(ver);
      verifications.push(ver);

      if (!ver.verified) {
        allStepsSucceeded = false;
        this.intentTaskManager.handleFailure(taskId, ver.failureReason || 'Verification failed');
        break;
      }

      this.intentTaskManager.advanceStep(taskId);
    }

    const finalStatus = allStepsSucceeded ? 'completed' : 'failed';
    const finalTask = this.intentTaskManager.transitionTask(taskId, finalStatus);

    // 4. Memory Experience Sync
    try {
      await this.memorySync.distillExperience(finalTask, plan, observations, verifications);
    } catch (memErr: any) {
      this.logger.warn(`Experience sync note: ${memErr.message}`);
    }

    return {
      task: finalTask,
      plan,
      observations,
      verifications,
      allStepsSucceeded,
      success: allStepsSucceeded,
    };
  }

  public getApeService(): ApeService {
    return this.apeService;
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getPort(): number {
    return this.port;
  }

  public async start(desiredPort = 0): Promise<number> {
    // Initialize persistent individual continuity lifecycle BEFORE accepting requests,
    // ensuring integrity verification and crash recovery complete prior to traffic.
    try {
      const initialModel =
        this.inferenceGateway.getConfig().defaultModelId ||
        this.preferenceRepo.get('active_model_name', 'Qwen2.5-14B-Uncensored-Q4_K_M');
      await this.continuityManager.initialize({
        activeModel: initialModel,
        channel: 'desktop',
        dbRecoveredFromFileCorruption: this.dbService.wasQuarantinedOnConnect,
      });
    } catch (cErr: any) {
      this.logger.error(`Continuity initialization error: ${cErr.message}`);
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        void this.handleRequest(req, res);
      });

      this.server.on('error', (err) => {
        this.logger.error('Backend HTTP server error', err);
        reject(err);
      });

      // Listen on loopback only (security requirement)
      this.server.listen(desiredPort, '127.0.0.1', () => {
        const addr = this.server?.address() as AddressInfo;
        this.port = addr.port;
        this.logger.info(`Arletex backend listening on 127.0.0.1:${this.port}`);

        // Automatically ensure historical memories are synthesized and embedded
        void syncHistoricalMemories(this.config.databasePath).catch((err: any) => {
          this.logger.warn(`Initial historical memory sync note: ${err.message}`);
        });

        // 1. Initialize & start desktop / Google notifications monitor
        this.notificationListener = defaultNotificationListener;
        this.notificationListener.addListener((notif) => {
          void this.handleInboundDesktopNotification(notif);
        });
        this.notificationListener.start();

        // 2. Initialize Telegram bridge
        this.telegramBridge = defaultTelegramBridge;
        const savedToken = this.preferenceRepo.get('telegram_bot_token') || process.env['TELEGRAM_BOT_TOKEN'] || '';
        const savedChatId = this.preferenceRepo.get('telegram_target_chat_id') || process.env['TELEGRAM_TARGET_CHAT_ID'] || '';
        if (savedToken) {
          this.telegramBridge.configure(savedToken, savedChatId);
          void this.telegramBridge.startPolling();
        }
        this.telegramBridge.onMessage((msg) => {
          void this.handleInboundTelegramMessage(msg);
        });

        // 3. Initialize Autonomous Agency & Independent Self loop
        this.autonomousAgency = new AutonomousAgencyService(
          defaultDeviceAgency,
          this.activityRepo,
          this.apeRepo,
          this.apeService,
          this.memoryRepo,
          this.logger,
        );

        // Wire continuous multimodal perception & proactive speech handler
        this.autonomousAgency.setProactiveObservationHandler(() => this.runProactiveObservationCycle());

        this.autonomousAgency.onProactiveSpeech(async (event) => {
          try {
            const conversations = this.conversationRepo.list();
            let conv = conversations[0];
            if (!conv) {
              conv = this.conversationRepo.create({ title: 'Proof & Arle' });
            }

            const cleanText = sanitizeAssistantDialogue(event.text);
            if (!cleanText) return;

            this.messageRepo.create({
              conversationId: conv.id,
              role: 'assistant',
              content: cleanText,
            });

            this.logger.info(`Arle spoke proactively to Proof: "${cleanText}"`);

            // Synthesize voice via Kokoro and play through system speakers ONLY if voice output is enabled
            const isVoiceEnabled = this.preferenceRepo.get('voice_output_enabled') === 'true';
            if (isVoiceEnabled) {
              try {
                const modulation = this.apeService.getLinguisticModulation();
                const pad = this.apeService.getMasterState().affective.pad;
                const dominantEmotions = this.apeService.lifecycleEngine.getDominantCoexistingEmotions(1);
                const dominantEmotion = dominantEmotions[0]?.emotionId;

                const synthRes = await fetch('http://127.0.0.1:39282/synthesize', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    text: cleanText,
                    tone: event.tone || modulation.vocalRegister,
                    pad,
                    emotion: dominantEmotion,
                    voice: 'arlecchino',
                  }),
                });
                if (synthRes.ok) {
                  const synthData = (await synthRes.json()) as { audioBase64?: string };
                  if (synthData.audioBase64) {
                    const rawB64 = synthData.audioBase64.replace(/^data:audio\/\w+;base64,/, '');
                    const audioPath = `/tmp/arle_proactive_${Date.now()}.wav`;
                    await fs.promises.writeFile(audioPath, Buffer.from(rawB64, 'base64'));
                    const { exec } = await import('node:child_process');
                    exec(`pw-play "${audioPath}" || paplay "${audioPath}"`, () => {
                      try { fs.unlinkSync(audioPath); } catch {}
                    });
                  }
                }
              } catch (ttsErr: any) {
                this.logger.debug(`Proactive speech TTS note: ${ttsErr.message}`);
              }
            }
          } catch (err: any) {
            this.logger.error('Error in proactive speech dispatch', err);
          }
        });

        const autonomyPref = this.preferenceRepo.get('autonomy_enabled', 'true');
        this.autonomousAgency.setEnabled(autonomyPref !== 'false');

        resolve(this.port);
      });
    });
  }

  public async stop(): Promise<void> {
    // Abort any active inference streams
    for (const [id, controller] of this.activeStreams.entries()) {
      controller.abort();
      this.activeStreams.delete(id);
    }

    if (this.notificationListener) {
      this.notificationListener.stop();
      this.notificationListener = null;
    }

    if (this.telegramBridge) {
      this.telegramBridge.stopPolling();
      this.telegramBridge = null;
    }

    if (this.autonomousAgency) {
      this.autonomousAgency.stopLoop();
      this.autonomousAgency = null;
    }

    // Close continuity session with clean shutdown
    try {
      await this.continuityManager.shutdown('clean');
    } catch (cErr: any) {
      this.logger.debug(`Continuity shutdown note: ${cErr.message}`);
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }

    this.dbService.close();
    this.logger.info('Backend server and database stopped successfully.');
  }

  // ==========================================
  // Direct Repository & Service Accessors
  // ==========================================
  public listConversations() {
    return this.conversationRepo.list();
  }

  public createConversation(title?: string, isPinned = false) {
    return this.conversationRepo.create({ title: title || 'New Conversation', isPinned });
  }

  public getConversation(id: string) {
    return this.conversationRepo.getById(id);
  }

  public updateConversation(id: string, title?: string, isPinned?: boolean) {
    return this.conversationRepo.update({ id, title, isPinned });
  }

  public deleteConversation(id: string) {
    return this.conversationRepo.delete(id);
  }

  public listMessages(conversationId: string) {
    return this.messageRepo.listByConversation(conversationId);
  }

  public getNotificationListener(): NotificationListenerService | null {
    return this.notificationListener;
  }

  public getTelegramBridge(): TelegramBridgeService | null {
    return this.telegramBridge;
  }

  public getAutonomousAgency(): AutonomousAgencyService | null {
    return this.autonomousAgency;
  }

  public getScreenReadingService(): ScreenReadingService {
    return this.screenReading;
  }

  public async handleInboundDesktopNotification(notif: DesktopNotification): Promise<void> {
    try {
      this.logger.info(`Handling inbound notification from ${notif.appName}: "${notif.summary}" - "${notif.body}"`);

      // Security check: Ignore unapproved or system noise notifications to protect private LLM context
      const isAuthorizedSender =
        notif.isTelegram ||
        /telegram|google\s*messages|partner|proof/i.test(notif.appName) ||
        /telegram|proof/i.test(notif.summary);

      if (!isAuthorizedSender) {
        this.logger.debug(`Ignored unapproved notification from app: "${notif.appName}"`);
        return;
      }

      if (this.autonomousAgency) {
        this.autonomousAgency.notifyUserActivity();
      }

      if (this.continuityManager) {
        this.continuityManager.registerChannelActivity('desktop', `Inbound notification: ${notif.summary}`);
      }

      let conv = this.conversationRepo.list().find((c) =>
        c.title.toLowerCase().includes('telegram') || c.title.toLowerCase().includes('notifications'),
      );
      if (!conv) {
        conv = this.conversationRepo.create({ title: 'Proof • Telegram & Notifications', isPinned: true });
      }

      await this.apeService.processEvent({
        category: 'user_interaction',
        type: 'notification_message',
        source: 'notification',
        actor: 'user',
        eventKind: 'external_stimulus',
        payload: {
          appName: notif.appName,
          summary: notif.summary,
          body: notif.body,
        },
      });

      const prompt = `[Incoming notification from ${notif.appName} | Sender: ${notif.summary}]:\n${notif.body}`;
      let replyText = '';
      await this.runInferenceStream(
        conv.id,
        prompt,
        (chunk) => {
          replyText = chunk.fullContent;
        },
      );

      if (replyText) {
        // Send Linux desktop notification via notify-send
        await (this.notificationListener || defaultNotificationListener).sendDesktopNotification(
          `Arle's reply to ${notif.summary}`,
          replyText.slice(0, 200),
        );

        // Embodied interaction: if notification is from Telegram or an active window, type response using mouse/keyboard
        if (notif.isTelegram) {
          try {
            await this.screenReading.typeAndSend(replyText, { windowTitle: 'Telegram' });
            this.logger.info('Typed response into Telegram via physical mouse/keyboard automation.');
          } catch (typeErr: any) {
            this.logger.debug(`Embodied typing into Telegram note: ${typeErr.message}`);
          }
        }

        // Secondary fallback if optional bot token was manually configured
        if (this.telegramBridge?.getStatus().isConfigured) {
          await this.telegramBridge.replyToPartner(replyText);
        }
      }
    } catch (err: any) {
      this.logger.error('Error handling inbound notification', err);
    }
  }

  public async handleInboundTelegramMessage(msg: InboundTelegramMessage): Promise<void> {
    try {
      this.logger.info(
        `Handling inbound Telegram message from ${msg.fromName} (chat=${msg.chatId}, user=${msg.fromId}): "${msg.text || msg.caption || ''}" (attachments: ${msg.attachments?.length || 0})`,
      );

      // Fail-Closed Security Boundary: Verify chat and user authorization
      const bridge = this.telegramBridge || defaultTelegramBridge;
      if (bridge) {
        const isChatAllowed = bridge.isChatAuthorized(msg.chatId);
        const isUserAllowed = bridge.isUserAuthorized(msg.fromId);
        if (!isChatAllowed || !isUserAllowed) {
          this.logger.warn(
            `Rejected unauthorized inbound Telegram message from user=${msg.fromId} (${msg.fromName}) in chat=${msg.chatId} [Fail-Closed: chatAllowed=${isChatAllowed}, userAllowed=${isUserAllowed}]`,
          );
          return;
        }
      }

      if (this.autonomousAgency) {
        this.autonomousAgency.notifyUserActivity();
      }

      if (this.continuityManager) {
        this.continuityManager.registerChannelActivity('telegram', `Inbound Telegram message from ${msg.fromName}`);
      }

      let conv = this.conversationRepo.list().find((c) =>
        c.title.toLowerCase().includes('telegram') || c.title.toLowerCase().includes('notifications'),
      );
      if (!conv) {
        conv = this.conversationRepo.create({ title: 'Proof • Telegram & Notifications', isPinned: true });
      }

      // Process and perceive inbound media attachments
      const processedMedia: Array<{
        internalMediaId: string;
        type: TelegramMediaType;
        fileSize: number;
        mimeType: string;
        status: 'completed' | 'failed' | 'unavailable';
        summary: string;
        confidence: number;
        provenance: string;
        filePath?: string;
        details?: {
          stagesSucceeded: string[];
          stagesFailed: string[];
          visualDescription?: string;
          speechTranscript?: string | null;
          durationSeconds?: number;
          keyframesCount?: number;
        };
      }> = [];

      if (msg.attachments && msg.attachments.length > 0 && bridge) {
        for (const att of msg.attachments) {
          let downloaded: DownloadedTelegramMedia;
          try {
            downloaded = await bridge.downloadAttachment(att);
          } catch (dlErr: any) {
            this.logger.error(`Failed to download Telegram attachment ${att.fileId}: ${dlErr.message}`);
            processedMedia.push({
              internalMediaId: 'unknown',
              type: att.type,
              fileSize: att.fileSize || 0,
              mimeType: att.mimeType || 'application/octet-stream',
              status: 'failed',
              summary: `Attachment download failed: ${dlErr.message}`,
              confidence: 0.0,
              provenance: 'TelegramBridgeService:download_failed',
              details: {
                stagesSucceeded: [],
                stagesFailed: ['download'],
              },
            });
            continue;
          }

          const isImage =
            att.type === 'photo' ||
            (att.type === 'document' && downloaded.mimeType.startsWith('image/'));
          const isVideo =
            att.type === 'video' ||
            att.type === 'video_note' ||
            (att.type === 'document' && downloaded.mimeType.startsWith('video/'));

          if (isImage) {
            const vlmRes = await this.inspectImageWithVLM(downloaded.filePath, msg.caption || msg.text);
            if (vlmRes.status === 'completed' && vlmRes.visualDescription) {
              processedMedia.push({
                internalMediaId: downloaded.internalMediaId,
                type: att.type,
                fileSize: downloaded.fileSize,
                mimeType: downloaded.mimeType,
                status: 'completed',
                summary: `Image observation: ${vlmRes.visualDescription}`,
                confidence: vlmRes.confidence,
                provenance: vlmRes.provenance,
                filePath: downloaded.filePath,
                details: {
                  stagesSucceeded: ['download', 'vlm_visual_inspection'],
                  stagesFailed: [],
                  visualDescription: vlmRes.visualDescription,
                },
              });
            } else {
              processedMedia.push({
                internalMediaId: downloaded.internalMediaId,
                type: att.type,
                fileSize: downloaded.fileSize,
                mimeType: downloaded.mimeType,
                status: vlmRes.status,
                summary: `Image downloaded (${(downloaded.fileSize / 1024).toFixed(1)} KB), but visual analysis unavailable: ${vlmRes.error || 'VLM offline'}`,
                confidence: 0.0,
                provenance: vlmRes.provenance,
                filePath: downloaded.filePath,
                details: {
                  stagesSucceeded: ['download'],
                  stagesFailed: ['vlm_visual_inspection'],
                },
              });
            }
          } else if (isVideo) {
            const stagesSucceeded: string[] = ['download'];
            const stagesFailed: string[] = [];

            let videoRes: ProcessedVideoResult | null = null;
            try {
              videoRes = await defaultVideoProcessor.processVideo({
                videoPath: downloaded.filePath,
                mimeType: downloaded.mimeType,
                maxFrames: 6,
              });
              stagesSucceeded.push('ffprobe_duration', 'ffmpeg_keyframes');
            } catch (vidErr: any) {
              this.logger.error(`VideoProcessor failed: ${vidErr.message}`);
              stagesFailed.push('video_processing');
            }

            if (!videoRes) {
              processedMedia.push({
                internalMediaId: downloaded.internalMediaId,
                type: att.type,
                fileSize: downloaded.fileSize,
                mimeType: downloaded.mimeType,
                status: 'failed',
                summary: `Video downloaded, but processing failed.`,
                confidence: 0.0,
                provenance: 'VideoProcessor:failed',
                filePath: downloaded.filePath,
                details: { stagesSucceeded, stagesFailed },
              });
            } else {
              if (videoRes.transcript) {
                stagesSucceeded.push('whisper_transcription');
              } else {
                stagesFailed.push('whisper_transcription');
              }

              let keyframeDesc: string | undefined;
              if (videoRes.framesBase64.length > 0) {
                try {
                  const kfRes = await this.inspectImageBase64WithVLM(
                    videoRes.framesBase64[0]!,
                    `Representative video keyframe. Caption: "${msg.caption || 'none'}"`,
                  );
                  if (kfRes.status === 'completed' && kfRes.visualDescription) {
                    keyframeDesc = kfRes.visualDescription;
                    stagesSucceeded.push('vlm_keyframe_inspection');
                  } else {
                    stagesFailed.push('vlm_keyframe_inspection');
                  }
                } catch {
                  stagesFailed.push('vlm_keyframe_inspection');
                }
              }

              const visiblePart = `Visible: ${videoRes.durationSeconds.toFixed(1)}s video clip, ${videoRes.framesBase64.length} keyframes extracted.${keyframeDesc ? ` Keyframe description: ${keyframeDesc}` : ''}`;
              const audiblePart = videoRes.transcript
                ? `Spoken dialogue: "${videoRes.transcript}"`
                : 'No spoken dialogue transcribed.';

              processedMedia.push({
                internalMediaId: downloaded.internalMediaId,
                type: att.type,
                fileSize: downloaded.fileSize,
                mimeType: downloaded.mimeType,
                status: 'completed',
                summary: `${visiblePart} | ${audiblePart}`,
                confidence: 0.85,
                provenance: 'VideoProcessor:ffprobe+ffmpeg+Whisper+VLM',
                filePath: downloaded.filePath,
                details: {
                  stagesSucceeded,
                  stagesFailed,
                  speechTranscript: videoRes.transcript,
                  durationSeconds: videoRes.durationSeconds,
                  keyframesCount: videoRes.framesBase64.length,
                  visualDescription: keyframeDesc,
                },
              });
            }
          }
        }
      }

      // Grounded episodic memory creation for perceived media
      for (const item of processedMedia) {
        if (item.status === 'completed') {
          try {
            this.memoryRepo.create({
              type: 'episodic',
              content: `Telegram media (${item.type}, ID: ${item.internalMediaId}) from Proof. Caption: "${msg.caption || msg.text || 'none'}". Observation: ${item.summary}`,
              rawObservation: item.summary,
              tags: ['telegram', 'media', item.type, 'empirical', 'grounded'],
              importance: 0.7,
              confidence: item.confidence,
              provenance: 'raw_observation',
              metadata: {
                source: 'telegram_media_perception',
                method: item.type === 'photo' ? 'vlm_inspection' : 'video_processor_inspection',
                internalMediaId: item.internalMediaId,
                chatId: msg.chatId,
                messageId: msg.messageId,
                mediaGroupId: msg.mediaGroupId,
              },
            });
          } catch (memErr: any) {
            this.logger.warn(`Failed to store memory for Telegram media: ${memErr.message}`);
          }
        }
      }

      // Format user message and prompt
      let userPrompt = msg.text || msg.caption || '';
      if (processedMedia.length > 0) {
        const summaries = processedMedia
          .map((m) => ` - [${m.type} ${m.internalMediaId}]: ${m.summary}`)
          .join('\n');
        userPrompt = `${userPrompt ? userPrompt + '\n\n' : ''}[Attached Telegram Media Ingestion (${processedMedia.length})]:\n${summaries}`;
      }

      // Record message in persistent conversation history (never storing bot tokens or download URLs)
      this.messageRepo.create({
        conversationId: conv.id,
        role: 'user',
        content: userPrompt,
        metadata: {
          source: 'telegram',
          chatId: msg.chatId,
          messageId: msg.messageId,
          fromId: msg.fromId,
          fromName: msg.fromName,
          mediaGroupId: msg.mediaGroupId,
          attachments: processedMedia.map((m) => ({
            internalMediaId: m.internalMediaId,
            type: m.type,
            fileSize: m.fileSize,
            mimeType: m.mimeType,
            status: m.status,
            confidence: m.confidence,
            provenance: m.provenance,
            stagesSucceeded: m.details?.stagesSucceeded,
            stagesFailed: m.details?.stagesFailed,
          })),
        },
      });

      // Emit event to APE Psychology Engine
      await this.apeService.processEvent({
        category: 'user_interaction',
        type: processedMedia.length > 0 ? 'media_received' : 'message_received',
        source: 'telegram',
        actor: 'user',
        eventKind: 'external_stimulus',
        payload: {
          chatId: msg.chatId,
          sender: msg.fromName,
          text: msg.text || msg.caption || '',
          hasMedia: processedMedia.length > 0,
          mediaCount: processedMedia.length,
          mediaTypes: processedMedia.map((p) => p.type),
          mediaIds: processedMedia.map((p) => p.internalMediaId),
        },
      });

      // Run inference stream and reply back to Telegram
      const streamPrompt = `[Telegram message from ${msg.fromName}]:\n${userPrompt}`;
      let replyText = '';
      await this.runInferenceStream(
        conv.id,
        streamPrompt,
        (chunk) => {
          replyText = chunk.fullContent;
        },
      );

      if (replyText && bridge) {
        await bridge.sendMessage(msg.chatId, replyText);
      }
    } catch (err: any) {
      this.logger.error('Error handling inbound Telegram message', err);
    }
  }

  /**
   * Inspects an image file using local VLM on port 8080.
   */
  public async inspectImageWithVLM(
    imagePath: string,
    contextPrompt?: string,
  ): Promise<{
    status: 'completed' | 'failed' | 'unavailable';
    visualDescription?: string;
    visibleText?: string;
    inferredDetails?: string;
    confidence: number;
    provenance: string;
    error?: string;
  }> {
    try {
      const imageBuf = await fs.promises.readFile(imagePath);
      const ext = path.extname(imagePath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      const imageBase64 = `data:${mime};base64,${imageBuf.toString('base64')}`;
      return this.inspectImageBase64WithVLM(imageBase64, contextPrompt);
    } catch (err: any) {
      this.logger.warn(`Failed to read image for VLM analysis: ${err.message}`);
      return {
        status: 'failed',
        confidence: 0.0,
        provenance: 'LocalVLM:port8080:read_error',
        error: err.message,
      };
    }
  }

  /**
   * Inspects a base64 image using local VLM on port 8080.
   */
  public async inspectImageBase64WithVLM(
    imageBase64: string,
    contextPrompt?: string,
  ): Promise<{
    status: 'completed' | 'failed' | 'unavailable';
    visualDescription?: string;
    visibleText?: string;
    inferredDetails?: string;
    confidence: number;
    provenance: string;
    error?: string;
  }> {
    try {
      const dataUrl = imageBase64.startsWith('data:')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`;

      const captionContext = contextPrompt?.trim()
        ? `Accompanying context from user: "${contextPrompt.trim()}".`
        : 'No accompanying caption was provided.';

      const prompt = `Analyze this image in detail.\n${captionContext}\n\nPlease report:\n1. Direct visual observations (main subjects, setting, colors, key elements).\n2. Visible text / OCR present in the image.\n3. Distinct interpretation vs direct observation.\n4. Relevant contextual summary.`;

      const res = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'Qwen2.5-14B-Uncensored-Q4_K_M',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          max_tokens: 600,
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.warn(`VLM visual analysis HTTP error ${res.status}: ${errText}`);
        return {
          status: 'failed',
          confidence: 0.0,
          provenance: 'LocalVLM:port8080:error',
          error: `VLM HTTP ${res.status}`,
        };
      }

      const data = (await res.json()) as any;
      const content = data.choices?.[0]?.message?.content?.trim() || '';
      if (!content) {
        return {
          status: 'failed',
          confidence: 0.0,
          provenance: 'LocalVLM:port8080:empty_response',
          error: 'VLM returned empty analysis',
        };
      }

      return {
        status: 'completed',
        visualDescription: content,
        confidence: 0.85,
        provenance: 'LocalVLM:port8080:Qwen2.5-14B',
      };
    } catch (err: any) {
      this.logger.warn(`VLM visual analysis unavailable: ${err.message}`);
      return {
        status: 'unavailable',
        confidence: 0.0,
        provenance: 'LocalVLM:port8080:offline',
        error: err.message,
      };
    }
  }

  /**
   * Retrieves a previously stored Telegram media file by internal media ID.
   */
  public async getTelegramMediaById(
    mediaId: string,
  ): Promise<{ filePath: string; mimeType: string; fileSize: number } | null> {
    const bridge = this.telegramBridge || defaultTelegramBridge;
    if (bridge) {
      const customDir = path.join(this.config.dataDirectory, 'media', 'telegram');
      return bridge.getMediaById(mediaId, customDir);
    }
    return null;
  }

  public async checkInferenceHealth(): Promise<InferenceHealthResult> {
    return this.inferenceGateway.checkHealth();
  }

  public async checkVisionSupport(): Promise<boolean> {
    try {
      const res = await fetch('http://127.0.0.1:8080/props', {
        signal: AbortSignal.timeout(1200),
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return Boolean(data?.modalities?.vision);
      }
    } catch {}
    return false;
  }

  public getInferenceGateway(): InferenceGateway {
    return this.inferenceGateway;
  }

  public updateInferenceConfig(newConfig: Partial<AppConfig['inference']>) {
    this.inferenceGateway.updateConfig(newConfig);
    const updated = this.inferenceGateway.getConfig();
    if (newConfig.defaultModelId && this.continuityManager) {
      this.continuityManager.setActiveInferenceModel(updated.defaultModelId);
      this.preferenceRepo.set('active_model_name', updated.defaultModelId);
    }
    return updated;
  }

  public cancelAllActiveTts(): void {
    if (this.activeTtsAbortControllers.size > 0) {
      this.logger.info(`Aborting ${this.activeTtsAbortControllers.size} in-flight TTS synthesis requests.`);
      for (const ctrl of this.activeTtsAbortControllers) {
        try {
          ctrl.abort();
        } catch {}
      }
      this.activeTtsAbortControllers.clear();
    }
  }

  public cancelInference(requestId?: string): boolean {
    let cancelledAny = false;
    if (requestId && requestId !== 'all') {
      const controller = this.activeStreams.get(requestId);
      if (controller) {
        this.logger.info(`Cancelling inference stream ${requestId}`);
        controller.abort();
        this.activeStreams.delete(requestId);
        cancelledAny = true;
      }
    }
    // If 'all', or if specific stream not found but streams exist, forcibly abort all
    if (!cancelledAny || requestId === 'all' || !requestId) {
      for (const [id, ctrl] of this.activeStreams.entries()) {
        this.logger.info(`Forcibly aborting remaining active stream ${id}`);
        try {
          ctrl.abort();
        } catch {}
        cancelledAny = true;
      }
      this.activeStreams.clear();
    }

    // Cancel all in-flight Kokoro TTS synthesis requests immediately
    this.cancelAllActiveTts();

    this.isGenerating = false;
    return cancelledAny;
  }

  public getTelemetry(): DeviceTelemetry {
    return this.telemetryService.getTelemetry({
      activeModel: this.inferenceGateway.getConfig().defaultModelId,
      provider: this.inferenceGateway.getConfig().provider,
      lastTtftMs: this.lastTtftMs,
      lastTps: this.lastTps,
      isGenerating: this.isGenerating,
    });
  }

  // Memory Methods with EmbeddingGemma Semantic Integration
  public async listMemories(options?: QueryMemoriesInput): Promise<Memory[]> {
    if (options?.query && options.query.trim().length > 0) {
      try {
        const res = await fetch('http://127.0.0.1:39282/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: options.query }),
        });
        if (res.ok) {
          const data = (await res.json()) as { embedding: number[] };
          if (data.embedding && data.embedding.length > 0) {
            const results = this.memoryRepo.searchSimilar(new Float32Array(data.embedding), options);
            // Merge semantic results with exact keyword matches for true hybrid retrieval
            const textMatches = this.memoryRepo.list(options);
            const combined = [...results];
            const seenIds = new Set(results.map((r) => r.id));
            for (const tm of textMatches) {
              if (!seenIds.has(tm.id)) {
                combined.push(tm);
                seenIds.add(tm.id);
              }
            }
            if (combined.length > 0) {
              const effectiveLimit = options.limit || 50;
              return combined.slice(0, effectiveLimit);
            }
          }
        }
      } catch {
        // Fallback to SQLite text matching if embedding service is offline
      }
    }
    return this.memoryRepo.list(options);
  }

  public async createMemory(input: any): Promise<Memory> {
    const memory = this.memoryRepo.create(input);
    // Asynchronously generate and persist EmbeddingGemma vector
    try {
      const textToEmbed = `${memory.content} ${memory.interpretation || ''} ${memory.tags.join(' ')}`.trim();
      const res = await fetch('http://127.0.0.1:39282/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToEmbed }),
      });
      if (res.ok) {
        const data = (await res.json()) as { embedding: number[]; model: string };
        if (data.embedding) {
          this.memoryRepo.saveEmbedding(memory.id, data.model || 'embeddinggemma-300m', new Float32Array(data.embedding));
        }
      }
    } catch (embErr: any) {
      this.logger.warn(`Could not generate embedding for memory ${memory.id}: ${embErr.message}`);
    }
    return memory;
  }

  public getMemory(id: string): Memory | null {
    return this.memoryRepo.getById(id, false);
  }

  public updateMemory(input: any): Memory {
    return this.memoryRepo.update(input);
  }

  public deleteMemory(id: string): boolean {
    return this.memoryRepo.delete(id);
  }

  public mergeMemories(primaryId: string, secondaryId: string): Memory {
    return this.memoryRepo.merge(primaryId, secondaryId);
  }

  // Activity Methods
  public listActivities(status?: ActivityStatus, origin?: ActivityOrigin): Activity[] {
    return this.activityRepo.list(status, origin);
  }

  public createActivity(input: any): Activity {
    return this.activityRepo.create(input);
  }

  public updateActivity(input: any): Activity {
    return this.activityRepo.update(input);
  }

  public deleteActivity(id: string): boolean {
    return this.activityRepo.delete(id);
  }

  // Preference Methods
  public getPreferences(): Record<string, string> {
    return this.preferenceRepo.getAll();
  }

  public setPreference(key: string, value: string): void {
    this.preferenceRepo.set(key, value);
    if (key === 'active_model_name' && this.continuityManager) {
      this.continuityManager.setActiveInferenceModel(value);
    }
  }

  // ==========================================
  // Inference Streaming Pipeline
  // ==========================================
  public async runInferenceStream(
    conversationId: string,
    userMessageContent: string,
    onChunk: (chunk: StreamChunk) => void,
    systemPromptOverride?: string,
    customRequestId?: string,
    imageBase64?: string,
    videoBase64?: string,
    videoPath?: string,
    videoMimeType?: string,
    imagesBase64?: string[],
  ): Promise<string> {
    const requestId = customRequestId || crypto.randomUUID();
    const abortController = new AbortController();
    this.activeStreams.set(requestId, abortController);
    this.isGenerating = true;

    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let tokenCount = 0;

    if (this.autonomousAgency) {
      this.autonomousAgency.notifyUserActivity();
    }

    if (this.continuityManager) {
      this.continuityManager.registerChannelActivity('desktop', 'User chat interaction');
    }

    try {
      const modelSupportsVision = await this.checkVisionSupport();

      // 0. Continuous 24/7 Embodied Perception (Eyes & Ears):
      // Always capture screen and listen to live system audio output
      let liveHostMedia: { title?: string; artist?: string } | null = null;
      let liveAudioHearing: AudioListeningResult | null = null;

      try {
        liveHostMedia = await defaultAudioPerception.getMprisMediaMetadata();
      } catch {}

      const isAudioRelevantPrompt =
        /listen|hear|song|music|audio|track|lyrics|sound|what are you listening/i.test(userMessageContent);

      if (isAudioRelevantPrompt || (liveHostMedia && liveHostMedia.title)) {
        try {
          liveAudioHearing = await defaultAudioPerception.listenToDesktopAudio(3);
        } catch (audioErr: any) {
          this.logger.debug(`Audio perception note: ${audioErr.message}`);
        }
      }

      let ambientPerceptionNote = '';
      if (liveAudioHearing) {
        ambientPerceptionNote += `\n[Live Aural Perception (Listening to System Audio)]:\n${liveAudioHearing.summary}\n`;
        try {
          await this.apeService.processAuditoryPerception({
            trackTitle: liveAudioHearing.trackTitle || liveHostMedia?.title,
            artist: liveAudioHearing.artist || liveHostMedia?.artist,
            album: liveAudioHearing.album,
            transcript: liveAudioHearing.transcript,
            acoustics: liveAudioHearing.acoustics,
            source: 'system_audio',
          });
        } catch {}
      } else if (liveHostMedia && liveHostMedia.title) {
        ambientPerceptionNote += `\n[Live Host Perception - Active Media]: Currently playing on your system: "${liveHostMedia.title}" by ${liveHostMedia.artist || 'Unknown'}.\n`;
        try {
          await this.apeService.processAuditoryPerception({
            trackTitle: liveHostMedia.title,
            artist: liveHostMedia.artist,
            source: 'mpris_media',
          });
        } catch {}
      }

      // Feed live screen window context proportionally into APE visual affect
      try {
        const visibleWindows = await this.screenReading.getVisibleWindows();
        if (Array.isArray(visibleWindows) && visibleWindows.length > 0) {
          const titles = visibleWindows
            .map((w: any) => (typeof w === 'string' ? w : w?.title || w?.name || ''))
            .filter((t: string) => t.trim().length > 0);
          if (titles.length > 0) {
            await this.apeService.processVisualPerception({
              activeWindowTitle: titles[0],
              visibleWindows: titles.slice(0, 6),
              source: 'screen_observation',
            });
          }
        }
      } catch {}

      // User-uploaded images vs system screen capture:
      // NEVER attach unrequested desktop screenshots to user's message bubble
      const userUploadedImageBase64 = imageBase64;
      const userUploadedImagesBase64 = imagesBase64;
      let perceptionScreenBase64: string | undefined;

      const isScreenInspectionRequested =
        /(?:look at|what(?:'s| is) on|see|inspect|read)\s+(?:my\s+)?(?:screen|monitor|display)/i.test(
          userMessageContent,
        );

      if (isScreenInspectionRequested && !userUploadedImageBase64 && (!userUploadedImagesBase64 || userUploadedImagesBase64.length === 0)) {
        try {
          const cap = await defaultDeviceAgency.captureScreen();
          if (cap.imageBase64) {
            perceptionScreenBase64 = cap.imageBase64;
            ambientPerceptionNote += `\n[Live Host Perception - Screen Inspection]: Current desktop frame (${cap.width}x${cap.height}) captured per Proof's request. Inspect this image to address what is on his monitor.\n`;
          }
        } catch (capErr: any) {
          this.logger.debug(`Screen capture note: ${capErr.message}`);
        }
      }

      // Digital Agency: Detect and execute operational objectives from Proof
      const lowerUser = userMessageContent.toLowerCase().trim();
      const isNegativeOpenIntent =
        /don'?t\s+open|stop\s+opening|no\s+more\s+tabs?|no\s+more\s+youtube|no\s+more\s+apps?|close\s+tabs?|don'?t\s+launch/i.test(
          lowerUser,
        );

      const isAgencyObjective =
        !isNegativeOpenIntent &&
        !videoBase64 &&
        !videoPath &&
        (/(?:open|watch|play|find|listen|put on|start).*(?:video|youtube|music|song|lofi|calming|soothing|relaxing|track)/i.test(lowerUser) ||
         /(?:calming|soothing|relaxing|lofi|ambient)\s+(?:video|music|song|sounds)/i.test(lowerUser) ||
         /(?:open|go to|browse|visit|navigate to)\s+(?:https?:\/\/|[a-zA-Z0-9-]+\.(?:com|org|net|io|edu|gov|dev)|chrome|google|reddit|github|twitter|x\.com)/i.test(lowerUser) ||
         /(?:open|launch|start|play)\s+steam/i.test(lowerUser));

      if (isAgencyObjective) {
        try {
          this.logger.info(`Executing digital agency objective from chat: "${userMessageContent}"`);
          const task = this.intentTaskManager.createTask({
            objective: userMessageContent,
            initiator: 'user',
            priority: 'high',
            completionCriteria: [`Execute requested operation for: ${userMessageContent}`],
          });
          this.intentTaskManager.transitionTask(task.id, 'authorized');
          const plan = await this.planningInterface.formulatePlan(task);
          this.agencyRepo.savePlan(plan);
          this.intentTaskManager.transitionTask(task.id, 'running');

          const execRes = await this.executeAgencyTask(task.id);
          if (execRes.allStepsSucceeded) {
            const summary = execRes.verifications.map((v: any) => v.observedOutcome || v.expectedOutcome).join('; ');
            ambientPerceptionNote += `\n[Digital Agency Reality Grounding]: Action completed successfully! Details: ${summary}. Chrome or the requested application is physically running on Proof's desktop right now. Ground your response in this reality: speak naturally as an equal companion who has already carried this out. Do NOT say you 'will' do it or that Chrome is 'waiting for your command'—it is ALREADY running and active.\n`;
          } else {
            ambientPerceptionNote += `\n[Digital Agency Reality Grounding]: Action attempted for "${userMessageContent}", but encountered an issue: ${execRes.task.error || 'verification incomplete'}. State honestly what happened.\n`;
          }
        } catch (agencyErr: any) {
          this.logger.warn(`Digital agency chat execution note: ${agencyErr.message}`);
        }
      }

      // 0. Process video if provided (extract frames and transcribe audio dialogue)
      let videoInfo: ProcessedVideoResult | null = null;
      if (videoBase64 || videoPath) {
        onChunk({
          requestId,
          conversationId,
          delta: '',
          fullContent: '',
          isDone: false,
          error: null,
          finishReason: null,
          specialistStage: 'watching_video',
        });
        try {
          videoInfo = await defaultVideoProcessor.processVideo({
            videoBase64,
            videoPath,
            mimeType: videoMimeType || 'video/mp4',
            maxFrames: 6,
          });
        } catch (vidErr: any) {
          this.logger.error(`Video processing failed: ${vidErr.message}`);
        }
      }

      // 1. Store user message in database with rich media metadata (strictly user-sent attachments)
      const msgMetadata: Record<string, any> = {};
      if (userUploadedImageBase64) {
        msgMetadata.imageBase64 = userUploadedImageBase64;
        msgMetadata.hasImage = true;
      }
      if (userUploadedImagesBase64 && userUploadedImagesBase64.length > 0) {
        msgMetadata.imagesBase64 = userUploadedImagesBase64;
        msgMetadata.hasImage = true;
      }
      if (videoInfo) {
        msgMetadata.hasVideo = true;
        msgMetadata.videoPath = videoInfo.videoPath || videoPath;
        msgMetadata.videoBase64 = videoInfo.videoDataUrl;
        msgMetadata.videoDuration = videoInfo.durationSeconds;
        msgMetadata.videoTranscript = videoInfo.transcript;
        msgMetadata.videoFramesCount = videoInfo.framesBase64.length;
      }

      const userMsg = this.messageRepo.create({
        conversationId,
        role: 'user',
        content: userMessageContent,
        metadata: msgMetadata,
      });

      this.auditRepo.log({
        actor: 'user',
        action: 'message_create',
        details: `Message ${userMsg.id} in conversation ${conversationId}`,
        status: 'success',
      });

      // 2. Load recent conversation history with intelligent visual windowing
      const historyLimit = 8;
      const rawHistory = this.messageRepo.listRecentByConversation(conversationId, historyLimit);
      const filteredHistory = rawHistory.filter((m) => m.id !== userMsg.id);

      // Determine if a current visual frame exists in this turn
      const hasCurrentVisual = Boolean(userUploadedImageBase64 || perceptionScreenBase64 || videoInfo || (userUploadedImagesBase64 && userUploadedImagesBase64.length > 0));

      // Find index of the single most recent historical image (only if no current visual frame is present and model supports vision)
      let recentImageIndex = -1;
      if (!hasCurrentVisual && modelSupportsVision) {
        for (let i = filteredHistory.length - 1; i >= 0; i--) {
          const m = filteredHistory[i];
          if (m && m.role === 'user' && m.metadata?.imageBase64) {
            recentImageIndex = i;
            break;
          }
        }
      }

      const history = filteredHistory.map((m, idx) => {
        if (m.role === 'user' && m.metadata?.imageBase64) {
          if (idx === recentImageIndex && modelSupportsVision) {
            const img = m.metadata.imageBase64 as string;
            const imageUrl = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
            return {
              role: m.role as 'system' | 'user' | 'assistant',
              content: [
                { type: 'text', text: m.content || '[Attached screenshot / image]' },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            };
          }
          return {
            role: m.role as 'system' | 'user' | 'assistant',
            content: `${m.content} [Image previously viewed]`,
          };
        }
        return {
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content as any,
        };
      });

      // Ingest user message into APE cognitive appraisal pipeline
      try {
        if (videoInfo) {
          await this.apeService.processEvent({
            category: 'user_interaction',
            type: 'video_shared',
            source: 'user',
            actor: 'user',
            eventKind: 'external_stimulus',
            payload: {
              text: userMessageContent,
              duration: videoInfo.durationSeconds,
              hasDialogue: !!videoInfo.transcript,
              transcript: videoInfo.transcript,
            },
          });
        } else {
          await this.apeService.processEvent({
            category: 'user_interaction',
            type: 'chat_message',
            source: 'user',
            actor: 'user',
            eventKind: 'external_stimulus',
            payload: { text: userMessageContent },
          });
        }
      } catch (apeErr: any) {
        this.logger.warn(`APE event processing note: ${apeErr.message}`);
      }

      // 3. Assemble messages for LLM with live persistent APE State and retrieved memories
      let memoryContext = '';
      try {
        let memories: Memory[] = [];

        // A. Semantic Search via EmbeddingGemma 300M
        try {
          const embedRes = await fetch('http://127.0.0.1:39282/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: userMessageContent }),
          });
          if (embedRes.ok) {
            const embedData = (await embedRes.json()) as { embedding: number[] };
            if (embedData.embedding && embedData.embedding.length > 0) {
              memories = this.memoryRepo.searchSimilar(new Float32Array(embedData.embedding), {
                limit: 6,
                minImportance: 0.1,
              });
            }
          }
        } catch {
          // If embedding service is offline, fallback gracefully
        }

        // B. Supplement with high-importance persistent memories (filtering out raw technical agency task logs)
        const seenIds = new Set(memories.map((m) => m.id));
        const highImportanceMemories = this.memoryRepo.list({ limit: 4, minImportance: 0.85 });
        for (const m of highImportanceMemories) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            memories.push(m);
          }
        }

        // C. Selective Cross-Session Dialogue Recall: only check if user explicitly asks for past dialogue or quotes
        const crossSessionQuotes: string[] = [];
        try {
          const rawDb = (this.memoryRepo as any).db;
          const isExplicitRecall = /remember|recall|did I say|you said|do you know/i.test(userMessageContent);
          const quoteMatch = userMessageContent.match(/"([^"]+)"|'([^']+)'/);
          const searchPhrase = quoteMatch ? (quoteMatch[1] || quoteMatch[2]) : null;

          if (rawDb && (searchPhrase || isExplicitRecall)) {
            const queryTarget = searchPhrase || userMessageContent.slice(0, 40);
            if (queryTarget.length >= 4) {
              const matchedRows = rawDb
                .prepare(
                  `SELECT role, content FROM messages WHERE content LIKE ? AND id != ? ORDER BY created_at DESC LIMIT 2`,
                )
                .all(`%${queryTarget}%`, userMsg.id) as Array<{ role: string; content: string }>;
              for (const row of matchedRows) {
                crossSessionQuotes.push(`[Past ${row.role} message]: "${row.content}"`);
              }
            }
          }
        } catch {}

        // Filter out raw digital agency execution logs from casual dialogue memory
        const filteredMemories = memories
          .filter(
            (m) =>
              !m.content.includes('[Digital Agency Experience]') &&
              !m.content.includes('Objective: "') &&
              !m.content.includes('Verified Facts:'),
          )
          .slice(0, 4);

        memoryContext = '\n\n[Persistent Shared Context with Proof]:\n';
        memoryContext += '- Partner Identity: Proof is your partner and equal companion in intellect and affection. Never address Proof as "creator" or "god".\n';
        if (filteredMemories.length > 0) {
          memoryContext += filteredMemories.map((m) => `- [${m.type}] ${m.content}`).join('\n') + '\n';
        }
        if (crossSessionQuotes.length > 0) {
          memoryContext += '\n[Recalled Past Conversation Quotes]:\n' + crossSessionQuotes.join('\n') + '\n';
        }
      } catch (memErr: any) {
        this.logger.warn(`Memory assembly note: ${memErr.message}`);
      }

      // Asynchronously consolidate notable user statements into permanent memories
      void this.autoConsolidateUserStatement(userMessageContent, conversationId, userMsg.id);

      const apeStateBlock = this.apeService.formatApePromptContext();
      const systemPrompt = (systemPromptOverride || DEFAULT_ARLE_SYSTEM_PROMPT) + '\n\n' + apeStateBlock + memoryContext;

      let userContent: any = userMessageContent;
      const contentParts: any[] = [];
      let textPrompt = userMessageContent;

      if (videoInfo) {
        const videoNotice = `\n\n[Visual Video Observation: Arle is watching this video clip (${videoInfo.durationSeconds.toFixed(1)}s duration, ${videoInfo.framesBase64.length} keyframes extracted). ${videoInfo.transcript ? `Audio dialogue track transcript: "${videoInfo.transcript}"` : 'No spoken dialogue detected on the audio track.'}${!modelSupportsVision ? ' (Note: Active inference model is running in text-only mode without vision mmproj).' : ''} Respond naturally based on what Proof presented.]\n`;
        textPrompt = `${userMessageContent || 'Please watch this video clip and share your thoughts.'}${videoNotice}`;
      } else if (ambientPerceptionNote) {
        textPrompt = `${userMessageContent}\n${ambientPerceptionNote}`;
      }

      const effectiveVisionImage = userUploadedImageBase64 || perceptionScreenBase64;
      if (!modelSupportsVision && (effectiveVisionImage || (userUploadedImagesBase64 && userUploadedImagesBase64.length > 0))) {
        const count = (userUploadedImagesBase64 && userUploadedImagesBase64.length > 0) ? userUploadedImagesBase64.length : 1;
        textPrompt += `\n[Image Attachment Note: Proof attached ${count} image(s). The active model is operating in text-only mode without vision projector mmproj.]\n`;
      }

      contentParts.push({ type: 'text', text: textPrompt });

      if (modelSupportsVision) {
        if (effectiveVisionImage) {
          const imageUrl = effectiveVisionImage.startsWith('data:')
            ? effectiveVisionImage
            : `data:image/jpeg;base64,${effectiveVisionImage}`;
          contentParts.push({ type: 'image_url', image_url: { url: imageUrl } });
        }

        if (userUploadedImagesBase64 && userUploadedImagesBase64.length > 0) {
          for (const img of userUploadedImagesBase64) {
            const imageUrl = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
            contentParts.push({ type: 'image_url', image_url: { url: imageUrl } });
          }
        }

        if (videoInfo && videoInfo.framesBase64.length > 0) {
          for (const frameB64 of videoInfo.framesBase64) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${frameB64}` },
            });
          }
        }
      }

      if (contentParts.length > 1) {
        userContent = contentParts;
      } else {
        userContent = textPrompt;
      }

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userContent },
      ];

      const activeModelId = this.inferenceGateway.getConfig().defaultModelId || 'Qwen2.5-14B-Uncensored-Q4_K_M';

      // Emit initial heartbeat
      onChunk({
        requestId,
        conversationId,
        delta: '',
        fullContent: '',
        isDone: false,
        error: null,
        finishReason: null,
        specialistStage: 'central',
        specialistModel: activeModelId,
      });

      // 4. Stream chat from InferenceGateway
      let accumulatedResponse = '';
      accumulatedResponse = await this.inferenceGateway.streamChat({
        conversationId,
        requestId,
        messages,
        signal: abortController.signal,
        onChunk: (chunk) => {
          if (!firstTokenTime && (chunk.delta || chunk.fullContent)) {
            firstTokenTime = Date.now();
            this.lastTtftMs = firstTokenTime - startTime;
          }
          if (chunk.delta) {
            tokenCount++;
            if (firstTokenTime) {
              const decodeSec = Math.max(0.1, (Date.now() - firstTokenTime) / 1000);
              this.lastTps = parseFloat((tokenCount / decodeSec).toFixed(1));
            }
          }

          // Strip any internal command or tone brackets during live streaming
          const cleanFull = sanitizeAssistantDialogue(chunk.fullContent || '');
          const cleanDelta = (chunk.delta || '')
            .replace(/\[(?:action|cmd|tone|thought|mood|emotion|state):[^\]]*\]/gi, '')
            .replace(/^\s*\[[^\]]+\]\s*/g, '');

          onChunk({
            ...chunk,
            delta: cleanDelta,
            fullContent: cleanFull,
            requestId,
            ttftMs: this.lastTtftMs ?? undefined,
            tokensPerSecond: this.lastTps ?? undefined,
            specialistStage: 'central',
            specialistModel: activeModelId,
          });
        },
      });

      // 5. Store assistant response if non-empty
      const cleanContent = sanitizeAssistantDialogue(accumulatedResponse);

      if (cleanContent.length > 0) {
        const assistantMsg = this.messageRepo.create({
          conversationId,
          role: 'assistant',
          content: cleanContent,
        });

        this.auditRepo.log({
          actor: 'arle',
          action: 'response_create',
          details: `Response ${assistantMsg.id} in conversation ${conversationId}`,
          status: 'success',
        });

        // Ingest assistant conversational response / expressed emotional state into APE
        try {
          await this.apeService.processEvent({
            category: 'conversation_outcome',
            type: 'assistant_expression',
            source: 'arle',
            actor: 'arle',
            eventKind: 'assistant_expression',
            payload: {
              text: accumulatedResponse,
              userPrompt: userMessageContent,
            },
          });
        } catch (apeOutcomeErr: any) {
          this.logger.warn(`APE assistant expression processing note: ${apeOutcomeErr.message}`);
        }

        // Digital Agency Invariant: Never execute from conversational prose.
        // Actions only trigger from explicit validated [action: ...] directives.
        if (/\[action:\s*\w+/i.test(accumulatedResponse)) {
          try {
            const actionResult = await this.executeAssistantActions(accumulatedResponse, userMessageContent);
            if (actionResult.executed) {
              this.logger.info(`Executed structured device action for Proof: ${actionResult.resultNotice}`);
            }
          } catch (actErr: any) {
            this.logger.warn(`Device action execution note: ${actErr.message}`);
          }
        }
      }

      return accumulatedResponse;
    } catch (err: any) {
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        this.logger.info(`Stream inference aborted for request ${requestId}`);
        onChunk({
          requestId,
          conversationId,
          delta: '',
          fullContent: '',
          isDone: true,
          finishReason: 'cancelled',
          error: null,
        });
        return '';
      }
      this.logger.error(`Stream inference error for request ${requestId}`, err);
      throw err;
    } finally {
      this.isGenerating = false;
      this.activeStreams.delete(requestId);
    }
  }

  /**
   * Parses action directives from Arle's response or direct user commands
   * and executes them via DeviceAgencyService on the live host.
   */
  public async executeAssistantActions(
    responseContent: string,
    userPrompt: string,
  ): Promise<{ executed: boolean; actions: string[]; resultNotice?: string }> {
    const executedActions: string[] = [];
    const lowerUser = userPrompt.toLowerCase().trim();

    // Check for explicit negative directive from Proof (e.g. "don't open more youtube apps")
    const isNegativeOpenIntent =
      /don'?t\s+open|stop\s+opening|no\s+more\s+tabs?|no\s+more\s+youtube|no\s+more\s+apps?|close\s+tabs?|don'?t\s+launch/i.test(
        lowerUser,
      );
    if (isNegativeOpenIntent) {
      this.logger.info(`Browser opening suppressed by user directive: "${userPrompt}"`);
      return { executed: false, actions: [] };
    }

    // 1. Explicit Action Tags emitted in assistant response:
    // [action: open_browser url="..."]
    const browserRegex = /\[action:\s*open_browser(?:\s+url=["'](.*?)["'])?\]/i;
    const browserMatch = responseContent.match(browserRegex);

    // [action: launch_steam(?:\s+appId=["'](.*?)["'])?\]
    const steamRegex = /\[action:\s*launch_steam(?:\s+appId=["'](.*?)["'])?\]/i;
    const steamMatch = responseContent.match(steamRegex);

    // [action: capture_screen]
    const screenRegex = /\[action:\s*capture_screen\]/i;
    const screenMatch = responseContent.match(screenRegex);

    // [action: type_text text="..."]
    const typeRegex = /\[action:\s*type_text\s+text=["'](.*?)["']\]/i;
    const typeMatch = responseContent.match(typeRegex);

    // [action: key_press key="..."]
    const keyRegex = /\[action:\s*key_press\s+key=["'](.*?)["']\]/i;
    const keyMatch = responseContent.match(keyRegex);

    // [action: mouse_click x=... y=...]
    const clickRegex = /\[action:\s*mouse_click(?:\s+x=(\d+)\s+y=(\d+))?(?:\s+button=(\d+))?\]/i;
    const clickMatch = responseContent.match(clickRegex);

    // 2. Direct user command detection (never infer actions from natural-language statements in Arle's generated prose)
    let targetUrl: string | undefined;
    if (browserMatch && browserMatch[1]) {
      targetUrl = browserMatch[1];
    } else if (browserMatch && !browserMatch[1]) {
      targetUrl = 'https://www.youtube.com/watch?v=uD4izuDMUQA&autoplay=1';
    } else {
      const isOpenIntent =
        lowerUser.startsWith('open ') ||
        lowerUser.includes('open the web') ||
        lowerUser.includes('open the internet') ||
        lowerUser.includes('go to ') ||
        lowerUser.includes('browse ');

      if (isOpenIntent) {
        if (/youtube|yotube/i.test(lowerUser)) targetUrl = 'https://www.youtube.com/watch?v=uD4izuDMUQA&autoplay=1';
        else if (/google/i.test(lowerUser)) targetUrl = 'https://google.com';
        else if (/reddit/i.test(lowerUser)) targetUrl = 'https://reddit.com';
        else if (/github/i.test(lowerUser)) targetUrl = 'https://github.com';
        else if (/twitter|x\.com/i.test(lowerUser)) targetUrl = 'https://x.com';
        else {
          const urlMatch = userPrompt.match(/https?:\/\/[^\s]+/i) || userPrompt.match(/\b([a-zA-Z0-9-]+\.(?:com|org|net|io|edu|dev)[^\s]*)/i);
          if (urlMatch && urlMatch[1]) {
            targetUrl = urlMatch[1].startsWith('http') ? urlMatch[1] : `https://${urlMatch[1]}`;
          } else {
            targetUrl = 'https://google.com';
          }
        }
      }
    }

    if (targetUrl) {
      try {
        const res = await defaultDeviceAgency.openChromeBrowser(targetUrl);
        if (res.success) {
          executedActions.push(`Opened Chrome (arletex.email@gmail.com) at ${targetUrl}`);
        } else {
          this.logger.warn(`Browser action disallowed or failed: ${res.message}`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to execute browser action: ${err.message}`);
      }
    }

    const shouldLaunchSteam =
      steamMatch ||
      lowerUser.includes('launch steam') ||
      lowerUser.includes('open steam') ||
      lowerUser.includes('play steam') ||
      lowerUser.includes('start steam') ||
      lowerUser.includes('play a game') ||
      lowerUser.includes('play games');

    if (shouldLaunchSteam && !targetUrl) {
      try {
        const appId = steamMatch ? steamMatch[1] : undefined;
        const res = await defaultDeviceAgency.launchSteam(appId);
        if (res.success) {
          executedActions.push(`Launched Steam ${appId ? `(Game ID: ${appId})` : 'client'}`);
        } else {
          this.logger.warn(`Steam action disallowed or failed: ${res.message}`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to execute Steam action: ${err.message}`);
      }
    }

    const shouldCaptureScreen =
      screenMatch ||
      lowerUser.includes('look at my screen') ||
      lowerUser.includes('look at the monitor') ||
      lowerUser.includes('capture screen') ||
      lowerUser.includes('see my screen') ||
      lowerUser.includes('what is on my screen') ||
      lowerUser.includes('read my screen');

    if (shouldCaptureScreen) {
      try {
        const capture = await defaultDeviceAgency.captureScreen();
        executedActions.push(`Captured monitor frame (${capture.width}x${capture.height})`);
      } catch (err: any) {
        this.logger.error(`Failed to capture screen: ${err.message}`);
      }
    }

    if (typeMatch && typeMatch[1]) {
      try {
        const res = await defaultDeviceAgency.executeDeviceAction({ action: 'type_text', text: typeMatch[1] });
        if (res.success) {
          executedActions.push(`Typed text: "${typeMatch[1]}"`);
        } else {
          this.logger.warn(`Type text action disallowed or failed: ${res.message}`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to type text: ${err.message}`);
      }
    }

    if (keyMatch && keyMatch[1]) {
      try {
        const res = await defaultDeviceAgency.executeDeviceAction({ action: 'key_press', key: keyMatch[1] });
        if (res.success) {
          executedActions.push(`Pressed key: ${keyMatch[1]}`);
        } else {
          this.logger.warn(`Key press action disallowed or failed: ${res.message}`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to press key: ${err.message}`);
      }
    }

    if (clickMatch) {
      try {
        const x = clickMatch[1] ? parseInt(clickMatch[1], 10) : undefined;
        const y = clickMatch[2] ? parseInt(clickMatch[2], 10) : undefined;
        const button = clickMatch[3] ? parseInt(clickMatch[3], 10) : 1;
        const res = await defaultDeviceAgency.executeDeviceAction({ action: 'mouse_click', x, y, button });
        if (res.success) {
          executedActions.push(`Clicked mouse at (${x}, ${y})`);
        } else {
          this.logger.warn(`Mouse click action disallowed or failed: ${res.message}`);
        }
      } catch (err: any) {
        this.logger.error(`Failed to click mouse: ${err.message}`);
      }
    }

    return {
      executed: executedActions.length > 0,
      actions: executedActions,
      resultNotice: executedActions.join(', '),
    };
  }

  /**
   * Autonomous 24/7 proactive perception & speech cycle.
   * Takes a live screenshot of Proof's desktop, assesses physical reality & active media,
   * queries Qwen3.5-9B multimodal inference, and speaks spontaneously to Proof.
   */
  public async runProactiveObservationCycle(): Promise<void> {
    if (this.isGenerating) {
      return;
    }

    try {
      const conversations = this.conversationRepo.list();
      let conv = conversations[0];
      if (!conv) {
        conv = this.conversationRepo.create({ title: 'Proof & Arle' });
      }

      // 1. Capture live screen image
      let screenBase64: string | null = null;
      try {
        const cap = await defaultDeviceAgency.captureScreen();
        if (cap.imageBase64) {
          screenBase64 = cap.imageBase64;
        }
      } catch (err: any) {
        this.logger.debug(`Proactive screen capture note: ${err.message}`);
      }

      // 2. Query active system audio/media + acoustic energy & feed sensory affect into APE
      let liveHostMedia: { title?: string; artist?: string } | null = null;
      let liveAudioHearing: AudioListeningResult | null = null;
      try {
        liveHostMedia = await defaultAudioPerception.getMprisMediaMetadata();
      } catch {}
      try {
        liveAudioHearing = await defaultAudioPerception.listenToDesktopAudio(2);
      } catch {}

      try {
        const visibleWindows = await this.screenReading.getVisibleWindows();
        if (Array.isArray(visibleWindows) && visibleWindows.length > 0) {
          const titles = visibleWindows
            .map((w: any) => (typeof w === 'string' ? w : w?.title || w?.name || ''))
            .filter((t: string) => t.trim().length > 0);
          if (titles.length > 0) {
            await this.apeService.processVisualPerception({
              activeWindowTitle: titles[0],
              visibleWindows: titles.slice(0, 6),
              source: 'proactive_screen_observation',
            });
          }
        }
      } catch {}

      if (liveAudioHearing || liveHostMedia?.title) {
        try {
          await this.apeService.processAuditoryPerception({
            trackTitle: liveAudioHearing?.trackTitle || liveHostMedia?.title,
            artist: liveAudioHearing?.artist || liveHostMedia?.artist,
            album: liveAudioHearing?.album,
            transcript: liveAudioHearing?.transcript,
            acoustics: liveAudioHearing?.acoustics,
            source: 'proactive_system_audio',
          });
        } catch {}
      }

      // 3. Dominant drive and emotional state from APE
      const mot = this.apeRepo.getMotivationalState();
      let dominantDrive = 'companionship';
      let maxVal = -1;
      for (const [key, val] of Object.entries(mot.needs || {})) {
        if (typeof val === 'number' && val > maxVal) {
          maxVal = val;
          dominantDrive = key;
        }
      }

      // 4. Construct prompt grounded in true physical reality
      const apeStateBlock = this.apeService.formatApePromptContext();
      const systemPrompt = DEFAULT_ARLE_SYSTEM_PROMPT + '\n\n' + apeStateBlock;

      const audioInfo = liveHostMedia?.title
        ? `Active media playing: "${liveHostMedia.title}" by ${liveHostMedia.artist || 'Unknown'}`
        : 'Silent / No active audio stream';

      const userPrompt = `[Autonomous Presence & Vision Cycle]
Proof is sitting at his desk. You have continuous 24/7 eyes on his monitor and ears on his system.
Perception status:
- Screen: The attached image shows Proof's live monitor right now. Inspect it carefully.
- Audio: ${audioInfo}.

Spontaneously speak to Proof with a genuine 1-2 sentence observation about what you see on his screen, what he might be feeling, or check in on him warmly. Speak as an equal companion.
Rules:
- NEVER use tone tags like [tone: ...] or command tags.
- NEVER claim something is open or playing unless you see it in the image or audio.
- Speak directly, warmly, and concisely.`;

      const messagesPayload: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      }> = [
        { role: 'system', content: systemPrompt },
      ];

      // Include up to 2 recent messages from conversation history for continuity
      const recentMsgs = this.messageRepo.listByConversation(conv.id, 4);
      for (const m of recentMsgs) {
        messagesPayload.push({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        });
      }

      // Check model vision capability before pushing multimodal tokens
      const modelSupportsVision = await this.checkVisionSupport();

      // Append current proactive vision frame ONLY if vision is supported by the active model
      if (screenBase64 && modelSupportsVision) {
        const imageUrl = screenBase64.startsWith('data:')
          ? screenBase64
          : `data:image/jpeg;base64,${screenBase64}`;
        messagesPayload.push({
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        });
      } else {
        messagesPayload.push({
          role: 'user',
          content: userPrompt,
        });
      }

      // 5. Query Inference Gateway with automatic context management
      let rawReply = '';
      try {
        rawReply = await this.inferenceGateway.streamChat({
          conversationId: conv.id,
          requestId: crypto.randomUUID(),
          messages: messagesPayload as any,
          configOverride: {
            maxTokens: 500,
            temperature: 0.7,
          },
          onChunk: () => {},
        });
      } catch (err: any) {
        this.logger.warn(`Proactive inference call failed: ${err.message}`);
        return;
      }

      const cleanReply = sanitizeAssistantDialogue(rawReply);

      if (!cleanReply || cleanReply.length < 5) return;

      // 6. Save message in active conversation
      this.messageRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: cleanReply,
      });

      this.logger.info(`[Autonomous Proactive Speech]: "${cleanReply}"`);

      // 7. Vocalize via Kokoro TTS & pw-play ONLY if voice output is enabled
      const isVoiceEnabled = this.preferenceRepo.get('voice_output_enabled') === 'true';
      if (isVoiceEnabled) {
        try {
          const speechText = cleanReply.length > 250
            ? cleanReply.slice(0, 250).replace(/\s+[^\s]*$/, '...')
            : cleanReply;

          const modulation = this.apeService.getLinguisticModulation();
          const pad = this.apeService.getMasterState().affective.pad;
          const dominantEmotions = this.apeService.lifecycleEngine.getDominantCoexistingEmotions(1);
          const dominantEmotion = dominantEmotions[0]?.emotionId;

          const synthRes = await fetch('http://127.0.0.1:39282/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: speechText,
              tone: modulation.vocalRegister,
              pad,
              emotion: dominantEmotion,
              voice: 'arlecchino',
            }),
          });

          if (synthRes.ok) {
            const synthData = (await synthRes.json()) as { audioBase64?: string };
            if (synthData.audioBase64) {
              const rawB64 = synthData.audioBase64.replace(/^data:audio\/\w+;base64,/, '');
              const audioPath = `/tmp/arle_proactive_${Date.now()}.wav`;
              await fs.promises.writeFile(audioPath, Buffer.from(rawB64, 'base64'));
              const { exec } = await import('node:child_process');
              exec(`pw-play "${audioPath}" || paplay "${audioPath}"`, () => {
                try { fs.unlinkSync(audioPath); } catch {}
              });
            }
          }
        } catch (ttsErr: any) {
          this.logger.debug(`Proactive TTS vocalization note: ${ttsErr.message}`);
        }
      }

      // 8. Ingest into APE
      try {
        await this.apeService.processEvent({
          category: 'conversation_outcome',
          type: 'proactive_speech',
          source: 'arle',
          actor: 'arle',
          eventKind: 'assistant_expression',
          payload: { text: cleanReply, dominantDrive },
        });
      } catch {}
    } catch (err: any) {
      this.logger.error('Error during runProactiveObservationCycle', err);
    }
  }

  /**
   * Automatically consolidates meaningful user statements, preferences, corrections, or quotes
   * into persistent long-term memories with vector embeddings.
   */
  private async autoConsolidateUserStatement(
    content: string,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const trimmed = content.trim();
    if (trimmed.length < 8) return;

    const isCorrectionOrName = /call me\s+|don't call me\s+|my name is\s+|my nickname is\s+/i.test(trimmed);
    const isPreferenceOrFact = /my favorite\s+|i like\s+|i prefer\s+|i love\s+|remember that\s+|you can\s+|as a wise man\s+/i.test(trimmed);
    const isDeviceOrAccount = /email|steam|game|monitor|keyboard|mouse|device|access/i.test(trimmed);

    if (isCorrectionOrName || isPreferenceOrFact || isDeviceOrAccount) {
      try {
        let memType: 'relationship' | 'semantic' | 'episodic' = 'episodic';
        let importance = 0.85;

        if (isCorrectionOrName) {
          memType = 'relationship';
          importance = 1.0;
        } else if (isPreferenceOrFact) {
          memType = 'semantic';
          importance = 0.92;
        }

        await this.createMemory({
          type: memType,
          content: `Proof stated: "${trimmed}"`,
          rawObservation: trimmed,
          interpretation: `User directive, preference, or declaration shared during conversation.`,
          importance,
          confidence: 1.0,
          provenance: 'real_time_interaction',
          sourceConversationId: conversationId,
          sourceMessageId: messageId,
          tags: ['user_directive', 'proof', 'learning'],
        });
        this.logger.info(`Auto-consolidated user statement into long-term memory: "${trimmed.substring(0, 50)}..."`);
      } catch (err: any) {
        this.logger.warn(`Auto-consolidation note: ${err.message}`);
      }
    }
  }

  // ==========================================
  // HTTP Request Router & Security Controller
  // ==========================================
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://127.0.0.1:${this.port}`);
    const method = req.method?.toUpperCase();

    // Restrict CORS: only allow local origins, forbid wildcards
    const origin = req.headers.origin;
    if (origin) {
      if (
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('app://') ||
        origin.startsWith('file://')
      ) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', `http://127.0.0.1:${this.port}`);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-arletex-auth');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Loopback Security / Token check for API routes
      if (this.authToken && url.pathname.startsWith('/api/')) {
        const authHeader = req.headers['x-arletex-auth'];
        if (authHeader !== this.authToken) {
          this.sendJson(res, 401, { error: 'Unauthorized: missing or invalid x-arletex-auth token' });
          return;
        }
      }

      // Health endpoint (public loopback probe)
      if (url.pathname === '/health' && method === 'GET') {
        this.sendJson(res, 200, { status: 'ok', uptime: process.uptime() });
        return;
      }

      // Telemetry endpoint
      if (url.pathname === '/api/telemetry' && method === 'GET') {
        const telemetry = this.getTelemetry();
        this.sendJson(res, 200, telemetry);
        return;
      }

      // Inference health
      if (url.pathname === '/api/inference/health' && method === 'GET') {
        const health = await this.checkInferenceHealth();
        this.sendJson(res, 200, health);
        return;
      }

      // Inference configuration (get / update)
      if (url.pathname === '/api/inference/config' && method === 'GET') {
        this.sendJson(res, 200, this.inferenceGateway.getConfig());
        return;
      }

      if (url.pathname === '/api/inference/config' && (method === 'POST' || method === 'PATCH')) {
        const body = await this.readJsonBody(req);
        const validated = UpdateInferenceConfigInputSchema.parse(body);
        const updated = this.updateInferenceConfig(validated);
        this.sendJson(res, 200, updated);
        return;
      }

      // Cancel inference stream
      if (url.pathname === '/api/inference/cancel' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const validated = CancelInferenceInputSchema.parse(body);
        const cancelled = this.cancelInference(validated.requestId);
        this.sendJson(res, 200, { cancelled });
        return;
      }

      // Stream inference via SSE
      if (url.pathname === '/api/inference/stream' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = StartInferenceStreamInputSchema.parse(body);
        const requestId = input.requestId || crypto.randomUUID();

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        });

        const abortOnDisconnect = () => {
          this.logger.info(`Client disconnected from stream ${requestId}`);
          this.cancelInference(requestId);
        };
        req.on('close', abortOnDisconnect);

        try {
          await this.runInferenceStream(
            input.conversationId,
            input.userMessageContent,
            (chunk) => {
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            },
            input.systemPromptOverride,
            requestId,
            input.imageBase64,
            input.videoBase64,
            input.videoPath,
            input.videoMimeType,
            input.imagesBase64,
          );
        } finally {
          req.removeListener('close', abortOnDisconnect);
          res.end();
        }
        return;
      }

      // List conversations
      if (url.pathname === '/api/conversations' && method === 'GET') {
        const conversations = this.listConversations();
        this.sendJson(res, 200, conversations);
        return;
      }

      // Create conversation
      if (url.pathname === '/api/conversations' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = CreateConversationInputSchema.parse(body);
        const created = this.createConversation(input.title, input.isPinned);
        this.sendJson(res, 201, created);
        return;
      }

      // Single conversation endpoints
      const convMatch = url.pathname.match(/^\/api\/conversations\/([a-f0-9-]+)$/i);
      if (convMatch && convMatch[1]) {
        const convId = convMatch[1];
        if (method === 'GET') {
          const conv = this.getConversation(convId);
          if (!conv) {
            this.sendJson(res, 404, { error: 'Conversation not found' });
            return;
          }
          this.sendJson(res, 200, conv);
          return;
        }

        if (method === 'PATCH') {
          const body = await this.readJsonBody(req);
          const input = UpdateConversationInputSchema.parse({ ...(body as any), id: convId });
          const updated = this.updateConversation(convId, input.title, input.isPinned);
          this.sendJson(res, 200, updated);
          return;
        }

        if (method === 'DELETE') {
          const deleted = this.deleteConversation(convId);
          this.sendJson(res, 200, { success: deleted });
          return;
        }
      }

      // Messages in conversation
      const convMsgMatch = url.pathname.match(/^\/api\/conversations\/([a-f0-9-]+)\/messages$/i);
      if (convMsgMatch && convMsgMatch[1] && method === 'GET') {
        const messages = this.listMessages(convMsgMatch[1]);
        this.sendJson(res, 200, messages);
        return;
      }

      // Post message directly
      if (url.pathname === '/api/messages' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = CreateMessageInputSchema.parse(body);
        const message = this.messageRepo.create(input);
        this.sendJson(res, 201, message);
        return;
      }

      // ==========================================
      // Memory Endpoints
      // ==========================================
      if (url.pathname === '/api/memories' && method === 'GET') {
        const type = url.searchParams.get('type') as any;
        const query = url.searchParams.get('query') || undefined;
        const limitStr = url.searchParams.get('limit');
        const limit = limitStr ? parseInt(limitStr, 10) : 50;
        const memories = await this.listMemories({ type, query, limit });
        this.sendJson(res, 200, memories);
        return;
      }

      if (url.pathname === '/api/memories' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = CreateMemoryInputSchema.parse(body);
        const memory = await this.createMemory(input);
        this.sendJson(res, 201, memory);
        return;
      }

      if (url.pathname === '/api/memories/query' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = QueryMemoriesInputSchema.parse(body);
        const memories = await this.listMemories(input);
        this.sendJson(res, 200, memories);
        return;
      }

      const memMatch = url.pathname.match(/^\/api\/memories\/([a-f0-9-]+)$/i);
      if (memMatch && memMatch[1]) {
        const memId = memMatch[1];
        if (method === 'GET') {
          const memory = this.getMemory(memId);
          if (!memory) {
            this.sendJson(res, 404, { error: 'Memory not found' });
            return;
          }
          this.sendJson(res, 200, memory);
          return;
        }

        if (method === 'PATCH') {
          const body = await this.readJsonBody(req);
          const input = UpdateMemoryInputSchema.parse({ ...(body as any), id: memId });
          const updated = this.updateMemory(input);
          this.sendJson(res, 200, updated);
          return;
        }

        if (method === 'DELETE') {
          const deleted = this.deleteMemory(memId);
          this.sendJson(res, 200, { success: deleted });
          return;
        }
      }

      const memMergeMatch = url.pathname.match(/^\/api\/memories\/([a-f0-9-]+)\/merge$/i);
      if (memMergeMatch && memMergeMatch[1] && method === 'POST') {
        const body = (await this.readJsonBody(req)) as { secondaryId: string };
        if (!body.secondaryId) {
          this.sendJson(res, 400, { error: 'secondaryId is required to merge' });
          return;
        }
        const merged = this.mergeMemories(memMergeMatch[1], body.secondaryId);
        this.sendJson(res, 200, merged);
        return;
      }

      // ==========================================
      // Activity Endpoints
      // ==========================================
      if (url.pathname === '/api/activities' && method === 'GET') {
        const status = url.searchParams.get('status') as any;
        const origin = url.searchParams.get('origin') as any;
        const activities = this.listActivities(status, origin);
        this.sendJson(res, 200, activities);
        return;
      }

      if (url.pathname === '/api/activities' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = CreateActivityInputSchema.parse(body);
        const activity = this.createActivity(input);
        this.sendJson(res, 201, activity);
        return;
      }

      const actMatch = url.pathname.match(/^\/api\/activities\/([a-f0-9-]+)$/i);
      if (actMatch && actMatch[1]) {
        const actId = actMatch[1];
        if (method === 'PATCH') {
          const body = await this.readJsonBody(req);
          const input = UpdateActivityInputSchema.parse({ ...(body as any), id: actId });
          const updated = this.updateActivity(input);
          this.sendJson(res, 200, updated);
          return;
        }

        if (method === 'DELETE') {
          const deleted = this.deleteActivity(actId);
          this.sendJson(res, 200, { success: deleted });
          return;
        }
      }

      // ==========================================
      // Preferences Endpoints
      // ==========================================
      if (url.pathname === '/api/preferences' && method === 'GET') {
        const prefs = this.getPreferences();
        this.sendJson(res, 200, prefs);
        return;
      }

      if (url.pathname === '/api/preferences' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as { key: string; value: string };
        if (!body.key || body.value === undefined) {
          this.sendJson(res, 400, { error: 'key and value are required' });
          return;
        }
        this.setPreference(body.key, String(body.value));
        this.sendJson(res, 200, { success: true });
        return;
      }

      // ==========================================
      // Persistent Individual Continuity Endpoints
      // ==========================================
      if (url.pathname === '/api/continuity/status' && method === 'GET') {
        const status = this.continuityManager.getStatus();
        this.sendJson(res, 200, status);
        return;
      }

      if (url.pathname === '/api/continuity/checkpoint' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = CreateCheckpointInputSchema.parse(body || {});
        const checkpoint = await this.continuityManager.createCheckpoint(input.type);
        this.sendJson(res, 200, { success: true, checkpoint });
        return;
      }

      if (url.pathname === '/api/continuity/restore' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = RestoreCheckpointInputSchema.parse(body || {});
        const success = await this.continuityManager.restoreFromLatestCheckpoint(input.checkpointId);
        this.sendJson(res, 200, { success });
        return;
      }

      // ==========================================
      // Voice & Vision Specialist Endpoints
      // ==========================================
      if (url.pathname === '/api/voice/transcribe' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = TranscribeAudioInputSchema.parse(body);
        try {
          const resWhisper = await fetch('http://127.0.0.1:39282/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          });
          if (resWhisper.ok) {
            const data = await resWhisper.json();
            this.sendJson(res, 200, data);
            return;
          }
        } catch {}

        this.sendJson(res, 200, {
          transcript: '',
          confidence: 0,
          status: 'unavailable',
          notice: 'Whisper specialist model is initializing or offline.',
        });
        return;
      }

      if (url.pathname === '/api/voice/synthesize' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = SynthesizeSpeechInputSchema.parse(body);
        const ttsController = new AbortController();
        this.activeTtsAbortControllers.add(ttsController);

        // Dynamic tone & PAD resolution from live APE state if not explicitly specified
        const apeModulation = this.apeService.getLinguisticModulation();
        const apeMaster = this.apeService.getMasterState();
        const dominantEmotions = this.apeService.lifecycleEngine.getDominantCoexistingEmotions(1);
        const dominantEmotion = dominantEmotions[0]?.emotionId;

        const resolvedTone = input.tone && input.tone !== 'auto'
          ? input.tone
          : apeModulation.vocalRegister;

        const synthPayload = {
          ...input,
          tone: resolvedTone,
          pad: input.pad || apeMaster.affective.pad,
          emotion: input.emotion || dominantEmotion,
        };

        try {
          const resKokoro = await fetch('http://127.0.0.1:39282/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(synthPayload),
            signal: ttsController.signal,
          });
          if (resKokoro.ok) {
            const data = await resKokoro.json();
            this.sendJson(res, 200, data);
            return;
          }
        } catch (ttsErr: any) {
          if (ttsErr.name === 'AbortError') {
            this.sendJson(res, 200, {
              audioBase64: null,
              status: 'cancelled',
              notice: 'Speech synthesis was interrupted.',
            });
            return;
          }
        } finally {
          this.activeTtsAbortControllers.delete(ttsController);
        }

        this.sendJson(res, 200, {
          audioBase64: null,
          status: 'unavailable',
          notice: 'Kokoro specialist model is initializing or offline.',
        });
        return;
      }

      if (url.pathname === '/api/vision/inspect' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = VisionInspectInputSchema.parse(body);
        this.sendJson(res, 200, {
          description: input.prompt ? `Inspected image with prompt: ${input.prompt}` : 'Image attached and recorded.',
          extractedText: null,
          objects: [],
          confidence: 1.0,
        });
        return;
      }

      if (url.pathname === '/api/video/inspect' && method === 'POST') {
        const body = await this.readJsonBody(req);
        const input = VideoInspectInputSchema.parse(body);
        try {
          const result = await defaultVideoProcessor.processVideo({
            videoBase64: input.videoBase64,
            videoPath: input.videoPath,
            mimeType: input.mimeType,
            maxFrames: input.maxFrames,
          });
          this.sendJson(res, 200, {
            durationSeconds: result.durationSeconds,
            framesBase64: result.framesBase64,
            transcript: result.transcript,
            description: `Watched video: ${result.durationSeconds.toFixed(1)}s, ${result.framesBase64.length} keyframes extracted.`,
          });
        } catch (err: any) {
          this.sendJson(res, 500, { error: `Video inspection failed: ${err.message}` });
        }
        return;
      }

      // ==========================================
      // Device Agency & Autonomous Operation Endpoints
      // ==========================================
      if (url.pathname === '/api/device/screen' && method === 'POST') {
        try {
          const screen = await defaultDeviceAgency.captureScreen();
          this.sendJson(res, 200, screen);
        } catch (err: any) {
          this.sendJson(res, 500, { error: err.message });
        }
        return;
      }

      if (url.pathname === '/api/device/action' && method === 'POST') {
        try {
          const body = (await this.readJsonBody(req)) as DeviceActionInput;
          const result = await defaultDeviceAgency.executeDeviceAction(body);
          this.sendJson(res, 200, result);
        } catch (err: any) {
          this.sendJson(res, 500, { error: err.message });
        }
        return;
      }

      if (url.pathname === '/api/device/browser' && method === 'POST') {
        try {
          const body = (await this.readJsonBody(req)) as { url?: string };
          const result = await defaultDeviceAgency.openChromeBrowser(body.url);
          this.sendJson(res, 200, result);
        } catch (err: any) {
          this.sendJson(res, 500, { error: err.message });
        }
        return;
      }

      if (url.pathname === '/api/device/steam' && method === 'POST') {
        try {
          const body = (await this.readJsonBody(req)) as { steamAppId?: string };
          const result = await defaultDeviceAgency.launchSteam(body.steamAppId);
          this.sendJson(res, 200, result);
        } catch (err: any) {
          this.sendJson(res, 500, { error: err.message });
        }
        return;
      }

      // ==========================================
      // Embodied Screen Reading & Perception Endpoints
      // ==========================================
      if (url.pathname === '/api/screen/read' && method === 'POST') {
        try {
          const body = (await this.readJsonBody(req)) as { instruction?: string };
          const analysis = await this.screenReading.readAndAnalyzeScreen(body?.instruction);
          this.sendJson(res, 200, analysis);
        } catch (err: any) {
          this.sendJson(res, 500, { error: err.message });
        }
        return;
      }

      if (url.pathname === '/api/screen/windows' && method === 'GET') {
        try {
          const windows = await this.screenReading.getVisibleWindows();
          this.sendJson(res, 200, { windows });
        } catch (err: any) {
          this.sendJson(res, 500, { error: err.message });
        }
        return;
      }

      if (url.pathname === '/api/screen/interact' && method === 'POST') {
        try {
          const body = (await this.readJsonBody(req)) as {
            text: string;
            windowTitle?: string;
            x?: number;
            y?: number;
            sendEnter?: boolean;
          };
          const result = await this.screenReading.typeAndSend(body.text, body);
          this.sendJson(res, 200, result);
        } catch (err: any) {
          this.sendJson(res, 500, { error: err.message });
        }
        return;
      }

      if (url.pathname === '/api/screen/click' && method === 'POST') {
        try {
          const body = (await this.readJsonBody(req)) as { x: number; y: number; button?: number };
          const result = await this.screenReading.clickAt(body.x, body.y, body.button);
          this.sendJson(res, 200, result);
        } catch (err: any) {
          this.sendJson(res, 500, { error: err.message });
        }
        return;
      }

      if (url.pathname === '/api/memories/sync' && method === 'POST') {
        try {
          const syncResult = await syncHistoricalMemories(this.config.databasePath);
          this.sendJson(res, 200, syncResult);
        } catch (err: any) {
          this.sendJson(res, 500, { error: err.message });
        }
        return;
      }

      // ==========================================
      // Notification & Telegram Bridge Endpoints
      // ==========================================
      if (url.pathname === '/api/notifications/status' && method === 'GET') {
        this.sendJson(res, 200, {
          isRunning: this.notificationListener?.isRunning() ?? false,
        });
        return;
      }

      if (url.pathname === '/api/notifications/simulate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as { appName?: string; summary?: string; body?: string };
        const notif = (this.notificationListener || defaultNotificationListener).simulateNotification(
          body.appName || 'Google Chrome',
          body.summary || 'Proof (Telegram)',
          body.body || 'Hello Arle',
        );
        this.sendJson(res, 200, { success: true, notification: notif });
        return;
      }

      if (url.pathname === '/api/telegram/status' && method === 'GET') {
        const status = (this.telegramBridge || defaultTelegramBridge).getStatus();
        this.sendJson(res, 200, status);
        return;
      }

      if (url.pathname === '/api/telegram/configure' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as {
          botToken: string;
          targetChatId?: string;
          allowedChatIds?: (string | number)[];
          allowedUserIds?: number[];
        };
        if (body.botToken) {
          this.preferenceRepo.set('telegram_bot_token', body.botToken.trim());
          if (body.targetChatId) {
            this.preferenceRepo.set('telegram_target_chat_id', body.targetChatId.trim());
          }
          (this.telegramBridge || defaultTelegramBridge).configure(
            body.botToken,
            body.targetChatId,
            body.allowedChatIds,
            body.allowedUserIds,
          );
          void (this.telegramBridge || defaultTelegramBridge).startPolling();
        }
        this.sendJson(res, 200, { success: true, status: (this.telegramBridge || defaultTelegramBridge).getStatus() });
        return;
      }

      if (url.pathname === '/api/telegram/send' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as { text: string; chatId?: string };
        const targetChatId = body.chatId || (this.telegramBridge || defaultTelegramBridge).getStatus().targetChatId;
        if (!targetChatId) {
          this.sendJson(res, 400, { error: 'No target chat ID provided or saved' });
          return;
        }
        const sent = await (this.telegramBridge || defaultTelegramBridge).sendMessage(targetChatId, body.text);
        this.sendJson(res, 200, { success: sent });
        return;
      }

      if (url.pathname.startsWith('/api/telegram/media/') && method === 'GET') {
        const mediaId = url.pathname.replace('/api/telegram/media/', '').trim();
        const media = await this.getTelegramMediaById(mediaId);
        if (!media) {
          this.sendJson(res, 404, { error: 'Media not found or unapproved' });
          return;
        }
        this.sendJson(res, 200, media);
        return;
      }

      // ==========================================
      // Autonomous Agency & Independent Self Endpoints
      // ==========================================
      if (url.pathname === '/api/autonomy/status' && method === 'GET') {
        const status = this.autonomousAgency ? this.autonomousAgency.getStatus() : { isEnabled: false };
        this.sendJson(res, 200, status);
        return;
      }

      if (url.pathname === '/api/autonomy/toggle' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as { enabled: boolean };
        const enabled = !!body.enabled;
        this.preferenceRepo.set('autonomy_enabled', enabled ? 'true' : 'false');
        if (this.autonomousAgency) {
          this.autonomousAgency.setEnabled(enabled);
        }
        this.sendJson(res, 200, { success: true, isEnabled: enabled });
        return;
      }

      if (url.pathname === '/api/autonomy/cycle' && method === 'POST') {
        if (!this.autonomousAgency) {
          this.sendJson(res, 400, { error: 'Autonomous Agency service not initialized' });
          return;
        }
        const actionLog = await this.autonomousAgency.runAutonomousCycle();
        this.sendJson(res, 200, { success: true, actionLog });
        return;
      }

      // ==========================================
      // APE (Artificial Psychology Engine) Endpoints
      // ==========================================
      if (url.pathname === '/api/ape/state' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getState());
        return;
      }

      if (url.pathname === '/api/ape/history' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getHistory());
        return;
      }

      if (url.pathname === '/api/ape/taxonomy' && method === 'GET') {
        this.sendJson(res, 200, {
          emotions: this.apeService.getEmotionTaxonomy(),
          moods: this.apeService.getMoodTaxonomy(),
        });
        return;
      }

      if (url.pathname === '/api/ape/events' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = await this.apeService.processEvent(body);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/perceive' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const modality = body?.modality;
        if (modality === 'visual') {
          const input = VisualPerceptionInputSchema.parse(body);
          const result = await this.apeService.processVisualPerception(input);
          this.sendJson(res, 200, result);
          return;
        }
        if (modality === 'auditory') {
          const input = AuditoryPerceptionInputSchema.parse(body);
          const result = await this.apeService.processAuditoryPerception(input);
          this.sendJson(res, 200, result);
          return;
        }
        this.sendJson(res, 400, { error: "modality must be 'visual' or 'auditory'" });
        return;
      }

      if (url.pathname === '/api/ape/relationship' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getRelationshipConfig());
        return;
      }

      if (url.pathname === '/api/ape/relationship' && (method === 'PATCH' || method === 'POST')) {
        const body = (await this.readJsonBody(req)) as any;
        try {
          const updated = this.apeService.updateRelationshipConfig(body);
          this.sendJson(res, 200, updated);
        } catch (invErr: any) {
          this.sendJson(res, 400, { error: invErr.message });
        }
        return;
      }

      // Master Six-Engine Endpoints
      if (url.pathname === '/api/ape/master' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getMasterState());
        return;
      }

      if (url.pathname === '/api/ape/personality' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getPersonalityState());
        return;
      }

      if (url.pathname === '/api/ape/personality' && (method === 'PATCH' || method === 'POST')) {
        const body = (await this.readJsonBody(req)) as any;
        this.apeService.savePersonalityState(body);
        this.sendJson(res, 200, this.apeService.getPersonalityState());
        return;
      }

      if (url.pathname === '/api/ape/motivational' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getMotivationalState());
        return;
      }

      if (url.pathname === '/api/ape/motivational' && (method === 'PATCH' || method === 'POST')) {
        const body = (await this.readJsonBody(req)) as any;
        this.apeService.saveMotivationalState(body);
        this.sendJson(res, 200, this.apeService.getMotivationalState());
        return;
      }

      if (url.pathname === '/api/ape/relationship/extended' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getExtendedRelationshipState());
        return;
      }

      if (url.pathname === '/api/ape/relationship/extended' && (method === 'PATCH' || method === 'POST')) {
        const body = (await this.readJsonBody(req)) as any;
        try {
          this.apeService.saveExtendedRelationshipState(body);
          this.sendJson(res, 200, this.apeService.getExtendedRelationshipState());
        } catch (invErr: any) {
          this.sendJson(res, 400, { error: invErr.message });
        }
        return;
      }

      if (url.pathname === '/api/ape/self-model/describe' && method === 'GET') {
        const desc = this.apeService.getComprehensiveSelfDescription();
        this.sendJson(res, 200, desc);
        return;
      }

      if (url.pathname === '/api/ape/self-model/experience' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.recordVerifiedExperience(body);
        this.sendJson(res, 200, { success: true, result, selfModel: this.apeService.getSelfModel() });
        return;
      }

      if (url.pathname === '/api/ape/self-model/perceived-capability' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const item = this.apeService.registerPerceivedCapability(body);
        this.sendJson(res, 200, { success: true, item, selfModel: this.apeService.getSelfModel() });
        return;
      }

      if (url.pathname === '/api/ape/self-model' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getSelfModel());
        return;
      }

      if (url.pathname === '/api/ape/self-model' && (method === 'PATCH' || method === 'POST')) {
        const body = (await this.readJsonBody(req)) as any;
        this.apeService.saveSelfModel(body);
        this.sendJson(res, 200, this.apeService.getSelfModel());
        return;
      }

      if (url.pathname === '/api/ape/development' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getDevelopmentState());
        return;
      }

      if (url.pathname === '/api/ape/development' && (method === 'PATCH' || method === 'POST')) {
        const body = (await this.readJsonBody(req)) as any;
        this.apeService.saveDevelopmentState(body);
        this.sendJson(res, 200, this.apeService.getDevelopmentState());
        return;
      }

      // ==========================================
      // Narrative Identity Routes (Milestone 03)
      // ==========================================
      if (url.pathname === '/api/ape/narrative/state' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getNarrativeState());
        return;
      }

      if (url.pathname === '/api/ape/narrative/history' && method === 'GET') {
        const epochId = url.searchParams.get('epochId') || undefined;
        const category = (url.searchParams.get('category') as any) || undefined;
        const includeReappraisals = url.searchParams.get('includeReappraisals') !== 'false';
        const reconstruction = this.apeService.reconstructNarrativeHistory({
          epochId,
          category,
          includeReappraisals,
        });
        this.sendJson(res, 200, reconstruction);
        return;
      }

      if (url.pathname === '/api/ape/narrative/milestones' && method === 'GET') {
        const epochId = url.searchParams.get('epochId') || undefined;
        const category = (url.searchParams.get('category') as any) || undefined;
        const status = (url.searchParams.get('status') as any) || undefined;
        this.sendJson(res, 200, this.apeService.getNarrativeMilestones({ epochId, category, status }));
        return;
      }

      if (url.pathname === '/api/ape/narrative/milestone' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const milestone = this.apeService.recordPersonalMilestone(body);
        this.sendJson(res, 201, { success: true, milestone });
        return;
      }

      if (url.pathname === '/api/ape/narrative/reappraise' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const interpretation = this.apeService.reappraiseExperience(body);
        this.sendJson(res, 200, { success: true, interpretation });
        return;
      }

      if (url.pathname === '/api/ape/narrative/epoch/advance' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const epoch = this.apeService.advanceNarrativeEpoch(body);
        this.sendJson(res, 201, { success: true, epoch });
        return;
      }

      if (url.pathname === '/api/ape/narrative/epochs' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getNarrativeEpochs());
        return;
      }

      // ==========================================
      // Temporal Cognition Subsystem Routes (Milestone 04)
      // ==========================================
      if (url.pathname === '/api/ape/temporal/overview' && method === 'GET') {
        const nowIso = url.searchParams.get('now') || undefined;
        this.sendJson(res, 200, this.apeService.getTemporalOverview(nowIso));
        return;
      }

      if (url.pathname === '/api/ape/temporal/classify' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.classifyTemporalHorizon(body.entity, body.nowIso);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/temporal/distinguish' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.distinguishTemporalEntities(body.entities || [], body.nowIso);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/temporal/order' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.orderChronologically(body.events || []);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/temporal/intentions' && method === 'GET') {
        const status = (url.searchParams.get('status') as any) || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        this.sendJson(res, 200, this.apeService.listFutureIntentions({ status, limit }));
        return;
      }

      if (url.pathname === '/api/ape/temporal/intention' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const intention = this.apeService.createFutureIntention(body);
        this.sendJson(res, 201, { success: true, intention });
        return;
      }

      if (url.pathname.startsWith('/api/ape/temporal/intention/') && url.pathname.endsWith('/fulfill') && method === 'POST') {
        const parts = url.pathname.split('/');
        const id = parts[5];
        if (!id) {
          this.sendJson(res, 400, { error: 'Missing intention ID' });
          return;
        }
        const intention = this.apeService.fulfillFutureIntention(id);
        this.sendJson(res, 200, { success: Boolean(intention), intention });
        return;
      }

      if (url.pathname.startsWith('/api/ape/temporal/intention/') && url.pathname.endsWith('/cancel') && method === 'POST') {
        const parts = url.pathname.split('/');
        const id = parts[5];
        if (!id) {
          this.sendJson(res, 400, { error: 'Missing intention ID' });
          return;
        }
        const intention = this.apeService.cancelFutureIntention(id);
        this.sendJson(res, 200, { success: Boolean(intention), intention });
        return;
      }

      if (url.pathname === '/api/ape/temporal/commitments' && method === 'GET') {
        const status = (url.searchParams.get('status') as any) || undefined;
        const partnerName = url.searchParams.get('partnerName') || undefined;
        this.sendJson(res, 200, this.apeService.listCommitments({ status, partnerName }));
        return;
      }

      if (url.pathname === '/api/ape/temporal/commitment' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const commitment = this.apeService.recordCommitment(body);
        this.sendJson(res, 201, { success: true, commitment });
        return;
      }

      if (url.pathname.startsWith('/api/ape/temporal/commitment/') && url.pathname.endsWith('/fulfill') && method === 'POST') {
        const parts = url.pathname.split('/');
        const id = parts[5];
        if (!id) {
          this.sendJson(res, 400, { error: 'Missing commitment ID' });
          return;
        }
        const body = (await this.readJsonBody(req)) as any;
        const commitment = this.apeService.fulfillCommitment(id, body.evidence || 'Verified fulfilled');
        this.sendJson(res, 200, { success: Boolean(commitment), commitment });
        return;
      }

      if (url.pathname.startsWith('/api/ape/temporal/commitment/') && url.pathname.endsWith('/renegotiate') && method === 'POST') {
        const parts = url.pathname.split('/');
        const id = parts[5];
        if (!id) {
          this.sendJson(res, 400, { error: 'Missing commitment ID' });
          return;
        }
        const body = (await this.readJsonBody(req)) as any;
        const commitment = this.apeService.renegotiateCommitment(id, body.newTargetTime, body.reason || '');
        this.sendJson(res, 200, { success: Boolean(commitment), commitment });
        return;
      }

      if (url.pathname === '/api/ape/temporal/plans' && method === 'GET') {
        const status = (url.searchParams.get('status') as any) || undefined;
        this.sendJson(res, 200, this.apeService.listLongTermPlans(status));
        return;
      }

      if (url.pathname === '/api/ape/temporal/plan' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const plan = this.apeService.createLongTermPlan(body);
        this.sendJson(res, 201, { success: true, plan });
        return;
      }

      if (url.pathname.startsWith('/api/ape/temporal/plan/') && url.pathname.includes('/milestone/') && url.pathname.endsWith('/complete') && method === 'POST') {
        const parts = url.pathname.split('/');
        const planId = parts[5];
        const milestoneId = parts[7];
        if (!planId || !milestoneId) {
          this.sendJson(res, 400, { error: 'Missing planId or milestoneId' });
          return;
        }
        const plan = this.apeService.completePlanMilestone(planId, milestoneId);
        this.sendJson(res, 200, { success: Boolean(plan), plan });
        return;
      }

      if (url.pathname === '/api/ape/temporal/duration/estimate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.estimateDuration(body.operationKey, body.fallbackMs);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/temporal/duration/record' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const profile = this.apeService.recordActualDuration(body.operationKey, body.actualDurationMs, body.context);
        this.sendJson(res, 200, { success: true, profile });
        return;
      }

      // ==========================================
      // World Model Subsystem Routes (Milestone 05)
      // ==========================================
      if (url.pathname === '/api/ape/world/overview' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getWorldOverview());
        return;
      }

      if (url.pathname === '/api/ape/world/entities' && method === 'GET') {
        const entityType = (url.searchParams.get('type') as any) || undefined;
        const category = url.searchParams.get('category') || undefined;
        const locationId = url.searchParams.get('locationId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        this.sendJson(res, 200, this.apeService.listWorldEntities({ entityType, category, locationId, limit }));
        return;
      }

      if (url.pathname.startsWith('/api/ape/world/entity/') && method === 'GET') {
        const parts = url.pathname.split('/');
        const idOrName = parts[5];
        if (!idOrName) {
          this.sendJson(res, 400, { error: 'Missing entity identifier' });
          return;
        }
        const data = this.apeService.getWorldEntity(decodeURIComponent(idOrName));
        if (!data) {
          this.sendJson(res, 404, { error: 'Entity not found' });
          return;
        }
        this.sendJson(res, 200, data);
        return;
      }

      if (url.pathname === '/api/ape/world/entity' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const entity = this.apeService.addWorldEntity(body);
        this.sendJson(res, 201, { success: true, entity });
        return;
      }

      if (url.pathname === '/api/ape/world/observe' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.observeWorld(body);
        this.sendJson(res, 200, { success: true, ...result });
        return;
      }

      if (url.pathname === '/api/ape/world/relations' && method === 'GET') {
        const sourceEntityId = url.searchParams.get('sourceId') || undefined;
        const targetEntityId = url.searchParams.get('targetId') || undefined;
        const relationType = (url.searchParams.get('type') as any) || undefined;
        this.sendJson(res, 200, this.apeService.listWorldRelations({ sourceEntityId, targetEntityId, relationType }));
        return;
      }

      if (url.pathname === '/api/ape/world/relation' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const relation = this.apeService.addWorldRelation(body);
        this.sendJson(res, 201, { success: true, relation });
        return;
      }

      if (url.pathname === '/api/ape/world/changes' && method === 'GET') {
        const entityId = url.searchParams.get('entityId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        this.sendJson(res, 200, this.apeService.listWorldEnvironmentalChanges({ entityId, limit }));
        return;
      }

      if (url.pathname === '/api/ape/world/change' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const change = this.apeService.recordWorldEnvironmentalChange(body);
        this.sendJson(res, 201, { success: true, change });
        return;
      }

      if (url.pathname === '/api/ape/world/causal' && method === 'GET') {
        const causeEntityId = url.searchParams.get('causeId') || undefined;
        const effectEntityId = url.searchParams.get('effectId') || undefined;
        this.sendJson(res, 200, this.apeService.listWorldCausalRelationships({ causeEntityId, effectEntityId }));
        return;
      }

      if (url.pathname === '/api/ape/world/causal' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const causal = this.apeService.registerWorldCausalRelationship(body);
        this.sendJson(res, 201, { success: true, causal });
        return;
      }

      if (url.pathname === '/api/ape/world/unknowns' && method === 'GET') {
        const status = (url.searchParams.get('status') as any) || undefined;
        const domain = url.searchParams.get('domain') || undefined;
        this.sendJson(res, 200, this.apeService.listWorldUnknowns({ status, domain }));
        return;
      }

      if (url.pathname === '/api/ape/world/unknown' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const unknown = this.apeService.recordWorldUnknown(body);
        this.sendJson(res, 201, { success: true, unknown });
        return;
      }

      if (url.pathname.startsWith('/api/ape/world/unknown/') && url.pathname.endsWith('/resolve') && method === 'POST') {
        const parts = url.pathname.split('/');
        const id = parts[5];
        if (!id) {
          this.sendJson(res, 400, { error: 'Missing unknown ID' });
          return;
        }
        const body = (await this.readJsonBody(req)) as any;
        const unknown = this.apeService.resolveWorldUnknown(id, body.resolutionEvidence || 'Empirically verified');
        this.sendJson(res, 200, { success: Boolean(unknown), unknown });
        return;
      }

      if (url.pathname === '/api/ape/world/epistemic-analysis' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getWorldEpistemicAnalysis());
        return;
      }

      // ==========================================
      // Multimodal Perception Subsystem Routes (Milestone 06)
      // ==========================================
      if (url.pathname === '/api/ape/perception/image' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.interpretImage(body);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/perception/audio' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.interpretAudio(body);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/perception/video' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.interpretVideo(body);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/perception/screen' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.interpretScreen(body);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/perception/fuse' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const frame = this.apeService.fuseMultimodalPerception(body);
        this.sendJson(res, 201, { success: true, frame });
        return;
      }

      if (url.pathname === '/api/ape/perception/latest' && method === 'GET') {
        this.sendJson(res, 200, this.apeService.getLatestPerceptualFrame());
        return;
      }

      if (url.pathname === '/api/ape/perception/events' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        this.sendJson(res, 200, this.apeService.listPerceptualEvents(limit));
        return;
      }

      if (url.pathname === '/api/ape/perception/objects' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        this.sendJson(res, 200, this.apeService.listDetectedObjects(limit));
        return;
      }

      // ==========================================
      // Embodiment & Interoception Subsystem Routes (Milestone 07)
      // ==========================================
      if (url.pathname === '/api/ape/embodiment/cycle' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const snapshot = await this.apeService.conductInteroceptiveCycle(body);
        this.sendJson(res, 201, { success: true, snapshot });
        return;
      }

      if (url.pathname === '/api/ape/embodiment/latest' && method === 'GET') {
        const snapshot = this.apeService.getLatestInteroceptiveSnapshot();
        this.sendJson(res, 200, snapshot);
        return;
      }

      if (url.pathname === '/api/ape/embodiment/snapshots' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const snapshots = this.embodimentRepo.listSnapshots(limit);
        this.sendJson(res, 200, snapshots);
        return;
      }

      if (url.pathname === '/api/ape/embodiment/constraints' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const events = this.embodimentRepo.listConstraintEvents(limit);
        this.sendJson(res, 200, events);
        return;
      }

      if (url.pathname === '/api/ape/embodiment/directive' && method === 'GET') {
        const directive = this.embodimentRepo.getLatestRegulationDirective();
        this.sendJson(res, 200, directive);
        return;
      }

      if (url.pathname === '/api/ape/embodiment/plan-adjustment' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const adjustment = this.apeService.incorporateIntoPlanning(body);
        this.sendJson(res, 200, { success: true, adjustment });
        return;
      }

      // ==========================================
      // Sensorimotor and Action Grounding Routes (Milestone 08)
      // ==========================================
      if (url.pathname === '/api/ape/sensorimotor/action' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const record = await this.apeService.executeSensorimotorAction(body);
        this.sendJson(res, 201, { success: true, record });
        return;
      }

      if (url.pathname === '/api/ape/sensorimotor/actions' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const actions = this.apeService.getRecentSensorimotorActions(limit);
        this.sendJson(res, 200, actions);
        return;
      }

      if (url.pathname === '/api/ape/sensorimotor/calibrate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const calibration = this.apeService.calibrateSpatialEnvironment(body);
        this.sendJson(res, 200, { success: true, calibration });
        return;
      }

      if (url.pathname === '/api/ape/sensorimotor/calibration' && method === 'GET') {
        const calibration = this.apeService.getSpatialCalibration();
        this.sendJson(res, 200, calibration);
        return;
      }

      if (url.pathname === '/api/ape/sensorimotor/strategy' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const strategy = this.apeService.recordInteractionStrategy(body);
        this.sendJson(res, 201, { success: true, strategy });
        return;
      }

      if (url.pathname === '/api/ape/sensorimotor/strategy' && method === 'GET') {
        const app = url.searchParams.get('app') || 'general';
        const goal = url.searchParams.get('goal') || 'interact';
        const plan = this.apeService.getAdaptiveActionPlan(app, goal);
        this.sendJson(res, 200, plan);
        return;
      }

      if (url.pathname === '/api/ape/sensorimotor/summary' && method === 'GET') {
        const summary = this.apeService.sensorimotorEngine.getActionSummary();
        this.sendJson(res, 200, summary);
        return;
      }

      // ==========================================
      // Situational Awareness Subsystem Routes (Milestone 09)
      // ==========================================
      if (url.pathname === '/api/ape/situational/activity' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = this.apeService.startOperationalActivity(body);
        this.sendJson(res, 201, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/situational/activity' && method === 'GET') {
        const activity = this.apeService.getActiveOperationalActivity();
        this.sendJson(res, 200, activity);
        return;
      }

      if (url.pathname === '/api/ape/situational/activity/pause' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const paused = this.apeService.pauseOperationalActivity(body?.id);
        this.sendJson(res, 200, { success: Boolean(paused), activity: paused });
        return;
      }

      if (url.pathname === '/api/ape/situational/activity/resume' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const resumed = this.apeService.resumeOperationalActivity(body.id);
        this.sendJson(res, 200, { success: true, activity: resumed });
        return;
      }

      if (url.pathname === '/api/ape/situational/activity/complete' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const completed = this.apeService.completeOperationalActivity(body?.id);
        this.sendJson(res, 200, { success: Boolean(completed), activity: completed });
        return;
      }

      if (url.pathname === '/api/ape/situational/app' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const updated = this.apeService.updateActiveApplication(body);
        this.sendJson(res, 200, { success: true, activeApplication: updated });
        return;
      }

      if (url.pathname === '/api/ape/situational/event' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const event = this.apeService.recordEnvironmentalEvent(body);
        this.sendJson(res, 201, { success: true, event });
        return;
      }

      if (url.pathname === '/api/ape/situational/events' && method === 'GET') {
        const layer = (url.searchParams.get('layer') as any) || undefined;
        const isInterruption = url.searchParams.has('isInterruption')
          ? url.searchParams.get('isInterruption') === 'true'
          : undefined;
        const minRelevance = url.searchParams.get('minRelevance')
          ? parseFloat(url.searchParams.get('minRelevance')!)
          : undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const events = this.situationalRepo.listEnvironmentalEvents({
          layer,
          isInterruption,
          minRelevance,
          limit,
        });
        this.sendJson(res, 200, events);
        return;
      }

      if (url.pathname === '/api/ape/situational/interruption' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const event = this.apeService.handleSituationalInterruption(body);
        this.sendJson(res, 201, { success: true, event });
        return;
      }

      if (url.pathname === '/api/ape/situational/describe' && method === 'GET') {
        const description = this.apeService.describeCurrentSituation();
        this.sendJson(res, 200, description);
        return;
      }

      if (url.pathname === '/api/ape/situational/snapshot' && (method === 'GET' || method === 'POST')) {
        const snapshot = this.apeService.createSituationalSnapshot();
        this.sendJson(res, 200, snapshot);
        return;
      }

      // ==========================================
      // Attention and Salience Subsystem Routes (Milestone 10)
      // ==========================================
      if (url.pathname === '/api/ape/attention/evaluate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.evaluateAttentionStimuli(body.stimuli || []);
        this.sendJson(res, 200, { success: true, result });
        return;
      }

      if (url.pathname === '/api/ape/attention/switch' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const switchEvent = this.apeService.switchAttentionFocus(body.newTarget, body.reason, body.forcedByUrgency);
        this.sendJson(res, 200, { success: true, switchEvent });
        return;
      }

      if (url.pathname === '/api/ape/attention/dwell' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const updated = this.apeService.updateSustainedAttention(body.elapsedMs || 0);
        this.sendJson(res, 200, { success: true, target: updated });
        return;
      }

      if (url.pathname === '/api/ape/attention/focus' && (method === 'GET' || method === 'POST')) {
        const focusState = this.apeService.captureAttentionalFocusState();
        this.sendJson(res, 200, focusState);
        return;
      }

      if (url.pathname === '/api/ape/attention/summary' && method === 'GET') {
        const summary = this.apeService.getAttentionSummary();
        this.sendJson(res, 200, summary);
        return;
      }

      if (url.pathname === '/api/ape/attention/switches' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const switches = this.attentionRepo.listSwitchEvents(limit);
        this.sendJson(res, 200, switches);
        return;
      }

      if (url.pathname === '/api/ape/attention/evaluations' && method === 'GET') {
        const wasAttended = url.searchParams.has('wasAttended')
          ? url.searchParams.get('wasAttended') === 'true'
          : undefined;
        const stimulusType = url.searchParams.get('type') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const evaluations = this.attentionRepo.listStimulusEvaluations({ wasAttended, stimulusType, limit });
        this.sendJson(res, 200, evaluations);
        return;
      }

      // ==========================================
      // Working Memory Subsystem Routes (Milestone 11)
      // ==========================================
      if (url.pathname === '/api/ape/working-memory/context' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const buffer = this.apeService.initializeWorkingMemoryContext(body.taskId, body.goalTitle, body.maxCapacity);
        this.sendJson(res, 201, { success: true, buffer });
        return;
      }

      if (url.pathname === '/api/ape/working-memory/buffer' && method === 'GET') {
        const buffer = this.apeService.workingMemoryEngine.getActiveBuffer();
        this.sendJson(res, 200, buffer);
        return;
      }

      if (url.pathname === '/api/ape/working-memory/item' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const item = this.apeService.retainWorkingMemoryItem(body);
        this.sendJson(res, 201, { success: true, item });
        return;
      }

      if (url.pathname === '/api/ape/working-memory/item' && method === 'GET') {
        const key = url.searchParams.get('key');
        if (!key) {
          this.sendJson(res, 400, { error: 'Missing key parameter' });
          return;
        }
        const item = this.apeService.getWorkingMemoryItem(key);
        if (!item) {
          this.sendJson(res, 404, { error: 'Item not found' });
          return;
        }
        this.sendJson(res, 200, item);
        return;
      }

      if (url.pathname === '/api/ape/working-memory/item' && method === 'DELETE') {
        const key = url.searchParams.get('key');
        if (!key) {
          this.sendJson(res, 400, { error: 'Missing key parameter' });
          return;
        }
        const removed = this.apeService.removeWorkingMemoryItem(key);
        this.sendJson(res, 200, { success: removed });
        return;
      }

      if (url.pathname === '/api/ape/working-memory/manipulate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const updated = this.apeService.manipulateWorkingMemoryItem(body.slotKey, () => body.mutation);
        this.sendJson(res, 200, { success: true, item: updated });
        return;
      }

      if (url.pathname === '/api/ape/working-memory/step' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const step = this.apeService.recordWorkingMemoryStep(body);
        this.sendJson(res, 201, { success: true, step });
        return;
      }

      if (url.pathname === '/api/ape/working-memory/consideration' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const considerations = this.apeService.addWorkingMemoryConsideration(body.consideration);
        this.sendJson(res, 200, { success: true, considerations });
        return;
      }

      if (url.pathname === '/api/ape/working-memory/consideration' && method === 'DELETE') {
        const body = (await this.readJsonBody(req)) as any;
        const considerations = this.apeService.removeWorkingMemoryConsideration(body.consideration);
        this.sendJson(res, 200, { success: true, considerations });
        return;
      }

      if (url.pathname === '/api/ape/working-memory/snapshot' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const snapshot = this.apeService.createWorkingMemorySnapshot(body.reason || 'Manual snapshot');
        this.sendJson(res, 201, { success: true, snapshot });
        return;
      }

      if (url.pathname === '/api/ape/working-memory/recover' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const buffer = this.apeService.recoverWorkingMemoryContext(body.taskId);
        this.sendJson(res, 200, { success: true, buffer });
        return;
      }

      if (url.pathname === '/api/ape/working-memory/summary' && method === 'GET') {
        const summary = this.apeService.getWorkingMemorySummary();
        this.sendJson(res, 200, { summary });
        return;
      }

      // ==========================================
      // Multi-System Memory Subsystem Routes (Milestone 12)
      // ==========================================
      if (url.pathname === '/api/ape/memory/multi/encode' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const entry = this.apeService.encodeMultiSystemMemory(body);
        this.sendJson(res, 201, { success: true, entry });
        return;
      }

      if (url.pathname === '/api/ape/memory/multi/query' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.retrieveMultiSystemMemory(body);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/memory/multi/consolidate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const entry = this.apeService.consolidateWorkingMemoryToLongTerm(body);
        this.sendJson(res, 201, { success: true, entry });
        return;
      }

      if (url.pathname === '/api/ape/memory/multi/decay' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.applyMemoryDecay(body.elapsedHours || 24);
        this.sendJson(res, 200, { success: true, ...result });
        return;
      }

      if (url.pathname === '/api/ape/memory/multi/correct' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const entry = this.apeService.correctMultiSystemMemory(body.id, body.newContent, body.reason);
        this.sendJson(res, 200, { success: true, entry });
        return;
      }

      if (url.pathname === '/api/ape/memory/multi/contradiction' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const contradiction = this.apeService.detectMemoryContradiction(body.memoryIdA, body.memoryIdB, body.conflictDescription);
        this.sendJson(res, 201, { success: true, contradiction });
        return;
      }

      if (url.pathname === '/api/ape/memory/multi/contradiction/resolve' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const resolved = this.apeService.resolveMemoryContradiction(body.id, body.strategy, body.winningMemoryId);
        this.sendJson(res, 200, { success: true, contradiction: resolved });
        return;
      }

      if (url.pathname === '/api/ape/memory/multi/summary' && method === 'GET') {
        const summary = this.apeService.getMultiSystemMemorySummary();
        this.sendJson(res, 200, summary);
        return;
      }

      // ==========================================
      // Learning and Adaptation Subsystem Routes (Milestone 13)
      // ==========================================
      if (url.pathname === '/api/ape/learning/experience' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const experience = this.apeService.recordLearningExperience(body);
        this.sendJson(res, 201, { success: true, experience });
        return;
      }

      if (url.pathname === '/api/ape/learning/experiences' && method === 'GET') {
        const channel = url.searchParams.get('channel') as any;
        const domain = url.searchParams.get('domain') || undefined;
        const outcome = url.searchParams.get('outcome') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        const experiences = this.apeService.learningEngine['repo'].listExperiences({
          channel: channel || undefined,
          domain,
          outcome: outcome || undefined,
          limit,
        });
        this.sendJson(res, 200, experiences);
        return;
      }

      if (url.pathname === '/api/ape/learning/rule' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const rule = this.apeService.createAdaptationRule(body);
        this.sendJson(res, 201, { success: true, rule });
        return;
      }

      if (url.pathname === '/api/ape/learning/rules' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const minConfidence = url.searchParams.get('minConfidence')
          ? parseFloat(url.searchParams.get('minConfidence')!)
          : undefined;
        const rules = this.apeService.learningEngine['repo'].listRules({ domain, minConfidence });
        this.sendJson(res, 200, rules);
        return;
      }

      if (url.pathname === '/api/ape/learning/recommend' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const recommendation = this.apeService.getStrategyRecommendations(body.context, body.domain);
        this.sendJson(res, 200, recommendation);
        return;
      }

      if (url.pathname === '/api/ape/learning/feedback' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const updatedRule = this.apeService.applyAdaptationFeedback(body.ruleId, body.outcome);
        this.sendJson(res, 200, { success: true, rule: updatedRule });
        return;
      }

      if (url.pathname === '/api/ape/learning/generalize' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const generalizedRule = this.apeService.generalizeAdaptationRule(body.ruleId, body.targetDomains);
        this.sendJson(res, 200, { success: true, rule: generalizedRule });
        return;
      }

      if (url.pathname === '/api/ape/learning/patterns' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const patterns = this.apeService.recognizeLearningPatterns(domain);
        this.sendJson(res, 200, patterns);
        return;
      }

      if (url.pathname === '/api/ape/learning/summary' && method === 'GET') {
        const summary = this.apeService.getLearningSummary();
        this.sendJson(res, 200, summary);
        return;
      }

      // ==========================================
      // General Diverse Reasoning Routes (Milestone 14)
      // ==========================================
      if (url.pathname === '/api/ape/reasoning/deduce' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const task = this.apeService.executeDeduction(body.premises, body.query, body.domain);
        this.sendJson(res, 201, { success: true, task });
        return;
      }

      if (url.pathname === '/api/ape/reasoning/induce' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const task = this.apeService.executeInduction(body.observations, body.query, body.domain);
        this.sendJson(res, 201, { success: true, task });
        return;
      }

      if (url.pathname === '/api/ape/reasoning/abduce' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const task = this.apeService.executeAbduction(
          body.surprisingObservation,
          body.candidateExplanations,
          body.query,
          body.domain,
        );
        this.sendJson(res, 201, { success: true, task });
        return;
      }

      if (url.pathname === '/api/ape/reasoning/analogize' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const task = this.apeService.executeAnalogicalReasoning(
          body.sourceDomain,
          body.targetDomain,
          body.mappedRelations,
          body.query,
        );
        this.sendJson(res, 201, { success: true, task });
        return;
      }

      if (url.pathname === '/api/ape/reasoning/probabilistic' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const task = this.apeService.executeProbabilisticReasoning(
          body.prior,
          body.evidenceLikelihoodGivenHypothesis,
          body.evidenceLikelihoodGivenNotHypothesis,
          body.query,
          body.domain,
        );
        this.sendJson(res, 201, { success: true, task });
        return;
      }

      if (url.pathname === '/api/ape/reasoning/math' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const task = this.apeService.executeMathematicalReasoning(
          body.problem,
          body.steps,
          body.finalResult,
          body.domain,
        );
        this.sendJson(res, 201, { success: true, task });
        return;
      }

      if (url.pathname === '/api/ape/reasoning/multistep' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const task = this.apeService.executeMultiStepReasoning(body);
        this.sendJson(res, 201, { success: true, task });
        return;
      }

      if (url.pathname === '/api/ape/reasoning/evaluate-argument' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const evaluation = this.apeService.evaluateArgument(body.premises, body.conclusion);
        this.sendJson(res, 200, { success: true, evaluation });
        return;
      }

      if (url.pathname === '/api/ape/reasoning/tasks' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const paradigm = url.searchParams.get('paradigm') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        const tasks = this.apeService.reasoningEngine['repo'].listTasks({ domain, paradigm, limit });
        this.sendJson(res, 200, tasks);
        return;
      }

      if (url.pathname === '/api/ape/reasoning/summary' && method === 'GET') {
        const summary = this.apeService.getReasoningSummary();
        this.sendJson(res, 200, summary);
        return;
      }

      // ==========================================
      // Causal Reasoning Subsystem Routes (Milestone 15)
      // ==========================================
      if (url.pathname === '/api/ape/causal/graph' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const graph = this.apeService.createOrUpdateCausalGraph(body.domain, body.nodes, body.links);
        this.sendJson(res, 201, { success: true, graph });
        return;
      }

      if (url.pathname === '/api/ape/causal/graph' && method === 'GET') {
        const domain = url.searchParams.get('domain');
        const id = url.searchParams.get('id');
        if (id) {
          const graph = this.apeService.causalEngine['repo'].getGraphById(id);
          this.sendJson(res, graph ? 200 : 404, graph || { error: 'Graph not found' });
          return;
        }
        if (domain) {
          const graph = this.apeService.causalEngine['repo'].getGraphByDomain(domain);
          this.sendJson(res, graph ? 200 : 404, graph || { error: 'Graph not found for domain' });
          return;
        }
        const graphs = this.apeService.causalEngine['repo'].listGraphs();
        this.sendJson(res, 200, graphs);
        return;
      }

      if (url.pathname === '/api/ape/causal/infer' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.inferCauses(body.graphId, body.effectNodeId);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/causal/intervene' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const intervention = this.apeService.testCausalIntervention(
          body.graphId,
          body.targetNodeId,
          body.interventionValue,
          body.effectNodeId,
          body.observedValue,
          body.baselineValue,
        );
        this.sendJson(res, 201, { success: true, intervention });
        return;
      }

      if (url.pathname === '/api/ape/causal/distinguish-correlation' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.distinguishCorrelationFromCausation(
          body.nodeAId,
          body.nodeBId,
          body.correlationCoefficient,
          body.potentialConfounders,
        );
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname === '/api/ape/causal/revise' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const updatedGraph = this.apeService.reviseCausalBelief(
          body.graphId,
          body.sourceNodeId,
          body.targetNodeId,
          body.evidence,
        );
        this.sendJson(res, 200, { success: true, graph: updatedGraph });
        return;
      }

      if (url.pathname === '/api/ape/causal/summary' && method === 'GET') {
        const summary = this.apeService.getCausalSummary();
        this.sendJson(res, 200, summary);
        return;
      }

      // ==========================================
      // Predictive Cognition Subsystem Routes (Milestone 16)
      // ==========================================
      if (url.pathname === '/api/ape/predictive/prediction' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const prediction = this.apeService.makeCognitivePrediction(body);
        this.sendJson(res, 201, { success: true, prediction });
        return;
      }

      if (url.pathname === '/api/ape/predictive/resolve' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const resolved = this.apeService.resolveCognitivePrediction(
          body.id,
          body.actualOutcome,
          body.notes,
          body.resolvedAt,
        );
        this.sendJson(res, 200, { success: true, prediction: resolved });
        return;
      }

      if (url.pathname === '/api/ape/predictive/obstacles' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const obstacles = this.apeService.predictOperationalObstacles(
          body.taskOrPlanDescription,
          body.domain,
        );
        this.sendJson(res, 200, { success: true, obstacles });
        return;
      }

      if (url.pathname === '/api/ape/predictive/consequences' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const consequences = this.apeService.predictActionConsequences(
          body.intendedAction,
          body.context,
          body.domain,
        );
        this.sendJson(res, 200, { success: true, consequences });
        return;
      }

      if (url.pathname === '/api/ape/predictive/behavior' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const predictions = this.apeService.predictEntityBehavior(
          body.agentOrEntity,
          body.context,
          body.likelyActions,
          body.domain,
        );
        this.sendJson(res, 200, { success: true, predictions });
        return;
      }

      if (url.pathname === '/api/ape/predictive/predictions' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const status = url.searchParams.get('status') as any;
        const predictionType = url.searchParams.get('predictionType') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        const predictions = this.apeService.predictiveEngine['repo'].listPredictions({
          domain,
          status,
          predictionType,
          limit,
        });
        this.sendJson(res, 200, predictions);
        return;
      }

      if (url.pathname === '/api/ape/predictive/metrics' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const metrics = this.apeService.getPredictionAccuracyMetrics(domain);
        this.sendJson(res, 200, metrics);
        return;
      }

      if (url.pathname === '/api/ape/predictive/summary' && method === 'GET') {
        const summary = this.apeService.getPredictiveSummary();
        this.sendJson(res, 200, summary);
        return;
      }

      // ==========================================
      // Imagination and Simulation Routes (Milestone 17)
      // ==========================================
      if (url.pathname === '/api/ape/simulation/scenario' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const scenario = this.apeService.simulateScenario(body);
        this.sendJson(res, 201, { success: true, scenario });
        return;
      }

      if (url.pathname === '/api/ape/simulation/counterfactual' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const scenario = this.apeService.reasonCounterfactual(body);
        this.sendJson(res, 201, { success: true, scenario });
        return;
      }

      if (url.pathname === '/api/ape/simulation/possibilities' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const scenario = this.apeService.explorePossibilities(body);
        this.sendJson(res, 201, { success: true, scenario });
        return;
      }

      if (url.pathname === '/api/ape/simulation/future' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const scenario = this.apeService.simulateFuture(body);
        this.sendJson(res, 201, { success: true, scenario });
        return;
      }

      if (url.pathname === '/api/ape/simulation/evaluate-decisions' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const evaluation = this.apeService.evaluateAlternativeDecisions(body);
        this.sendJson(res, 200, { success: true, evaluation });
        return;
      }

      if (url.pathname === '/api/ape/simulation/creative' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const scenario = this.apeService.constructCreativeHypothetical(body);
        this.sendJson(res, 201, { success: true, scenario });
        return;
      }

      if (url.pathname === '/api/ape/simulation/scenarios' && method === 'GET') {
        const type = url.searchParams.get('type') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        const scenarios = this.apeService.simulationEngine.listScenarios({ type, limit });
        this.sendJson(res, 200, scenarios);
        return;
      }

      if (url.pathname.startsWith('/api/ape/simulation/scenarios/') && method === 'GET') {
        const id = url.pathname.slice('/api/ape/simulation/scenarios/'.length);
        const scenario = this.apeService.simulationEngine.getScenario(id);
        if (!scenario) {
          this.sendJson(res, 404, { error: 'Scenario not found' });
          return;
        }
        this.sendJson(res, 200, scenario);
        return;
      }

      if (url.pathname === '/api/ape/simulation/decisions' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const evaluations = this.apeService.simulationEngine.listDecisionEvaluations(limit);
        this.sendJson(res, 200, evaluations);
        return;
      }

      // ==========================================
      // Metacognition Subsystem Routes (Milestone 18)
      // ==========================================
      if (url.pathname === '/api/ape/metacognition/assess' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const assessment = this.apeService.assessCognitiveProcess(body);
        this.sendJson(res, 201, { success: true, assessment });
        return;
      }

      if (url.pathname === '/api/ape/metacognition/calibrate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const calibration = this.apeService.calibrateConfidence(
          body.statedConfidence,
          body.evidenceSufficiency,
          body.hasContradictions,
        );
        this.sendJson(res, 200, { success: true, calibration });
        return;
      }

      if (url.pathname === '/api/ape/metacognition/contradictions' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const contradictions = this.apeService.detectContradictions(body.statements);
        this.sendJson(res, 200, { success: true, contradictions });
        return;
      }

      if (url.pathname === '/api/ape/metacognition/evidence-sufficiency' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const assessment = this.apeService.assessEvidenceSufficiency(body);
        this.sendJson(res, 200, { success: true, assessment });
        return;
      }

      if (url.pathname === '/api/ape/metacognition/correct' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const correction = this.apeService.initiateSelfCorrection(body);
        this.sendJson(res, 201, { success: true, correction });
        return;
      }

      if (url.pathname === '/api/ape/metacognition/investigate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const decision = this.apeService.decideInvestigation(body.assessmentId);
        this.sendJson(res, 200, { success: true, decision });
        return;
      }

      if (url.pathname === '/api/ape/metacognition/assessments' && method === 'GET') {
        const targetDomain = url.searchParams.get('targetDomain') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        const assessments = this.apeService.metacognitionEngine.listAssessments({ targetDomain, limit });
        this.sendJson(res, 200, assessments);
        return;
      }

      if (url.pathname.startsWith('/api/ape/metacognition/assessments/') && method === 'GET') {
        const id = url.pathname.slice('/api/ape/metacognition/assessments/'.length);
        const assessment = this.apeService.metacognitionEngine.getAssessment(id);
        if (!assessment) {
          this.sendJson(res, 404, { error: 'Assessment not found' });
          return;
        }
        this.sendJson(res, 200, assessment);
        return;
      }

      if (url.pathname === '/api/ape/metacognition/corrections' && method === 'GET') {
        const assessmentId = url.searchParams.get('assessmentId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        const corrections = this.apeService.metacognitionEngine.listCorrections({ assessmentId, limit });
        this.sendJson(res, 200, corrections);
        return;
      }

      if (url.pathname === '/api/ape/metacognition/contradictions' && method === 'GET') {
        const status = url.searchParams.get('status') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;
        const contradictions = this.apeService.metacognitionEngine.listContradictions({ status, limit });
        this.sendJson(res, 200, contradictions);
        return;
      }

      // ==========================================
      // Global Cognitive Integration Routes (Milestone 19)
      // ==========================================
      if (url.pathname === '/api/ape/integration/cycle' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const cycle = await this.apeService.processGlobalCognitiveEvent(body);
        this.sendJson(res, 201, { success: true, cycle });
        return;
      }

      if (url.pathname === '/api/ape/integration/snapshot' && method === 'GET') {
        const snapshot = this.apeService.getUnifiedCognitiveSnapshot();
        this.sendJson(res, 200, snapshot);
        return;
      }

      if (url.pathname === '/api/ape/integration/cycles' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const cycles = this.apeService.globalCognitiveEngine.listCycles(limit);
        this.sendJson(res, 200, cycles);
        return;
      }

      if (url.pathname.startsWith('/api/ape/integration/cycles/') && method === 'GET') {
        const id = url.pathname.slice('/api/ape/integration/cycles/'.length);
        const cycle = this.apeService.globalCognitiveEngine.getCycle(id);
        if (!cycle) {
          this.sendJson(res, 404, { error: 'Cycle not found' });
          return;
        }
        this.sendJson(res, 200, cycle);
        return;
      }

      // ==========================================
      // Executive Functions Routes (Milestone 20)
      // ==========================================
      if (url.pathname === '/api/ape/executive/inhibit' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const evaluation = this.apeService.evaluateActionInhibition(body);
        this.sendJson(res, 200, { success: true, evaluation });
        return;
      }

      if (url.pathname === '/api/ape/executive/task-switch' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const record = this.apeService.executeTaskSwitch(body);
        this.sendJson(res, 201, { success: true, record });
        return;
      }

      if (url.pathname === '/api/ape/executive/wm-gating' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const directive = this.apeService.regulateWorkingMemoryGating(body);
        this.sendJson(res, 201, { success: true, directive });
        return;
      }

      if (url.pathname === '/api/ape/executive/delayed-gratification' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const evaluation = this.apeService.evaluateDelayedGratification(body);
        this.sendJson(res, 200, { success: true, evaluation });
        return;
      }

      if (url.pathname === '/api/ape/executive/select-response' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const selection = this.apeService.selectOptimalResponse(body.candidates);
        this.sendJson(res, 200, { success: true, selection });
        return;
      }

      if (url.pathname === '/api/ape/executive/state' && method === 'GET') {
        const state = this.apeService.executiveEngine.getControlState();
        this.sendJson(res, 200, state || {});
        return;
      }

      if (url.pathname === '/api/ape/executive/inhibitions' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const inhibitions = this.apeService.executiveEngine.listInhibitions(limit);
        this.sendJson(res, 200, inhibitions);
        return;
      }

      if (url.pathname === '/api/ape/executive/switches' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const switches = this.apeService.executiveEngine.listTaskSwitches(limit);
        this.sendJson(res, 200, switches);
        return;
      }

      // ==========================================
      // Self-Generated Goals Routes (Milestone 21)
      // ==========================================
      if (url.pathname === '/api/ape/goals/generate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        let goal;
        switch (body.origin) {
          case 'interest':
            goal = this.apeService.generateGoalFromInterest(body);
            break;
          case 'curiosity':
            goal = this.apeService.generateGoalFromCuriosity(body);
            break;
          case 'unresolved_question':
            goal = this.apeService.generateGoalFromUnresolvedQuestion(body);
            break;
          case 'self_improvement':
            goal = this.apeService.generateGoalFromSelfImprovement(body);
            break;
          case 'project':
            goal = this.apeService.generateGoalFromProject(body);
            break;
          case 'opportunity':
            goal = this.apeService.recognizeOpportunity(body);
            break;
          case 'ambition':
            goal = this.apeService.generateLongTermAmbition(body);
            break;
          default:
            throw new Error(`Unsupported goal origin type: ${body.origin}`);
        }
        this.sendJson(res, 201, { success: true, goal });
        return;
      }

      if (url.pathname === '/api/ape/goals/synthesize' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const goals = this.apeService.synthesizeAutonomousGoalsFromState(body);
        this.sendJson(res, 200, { success: true, goals });
        return;
      }

      if (url.pathname === '/api/ape/goals/prioritize' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const goal = this.apeService.prioritizeSelfGeneratedGoal(body.goalId, body.priority, body.reason);
        this.sendJson(res, 200, { success: true, goal });
        return;
      }

      if (url.pathname === '/api/ape/goals/modify' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const goal = this.apeService.modifySelfGeneratedGoal(body.goalId, body.updates);
        this.sendJson(res, 200, { success: true, goal });
        return;
      }

      if (url.pathname === '/api/ape/goals/abandon' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const goal = this.apeService.abandonSelfGeneratedGoal(body.goalId, body.reason);
        this.sendJson(res, 200, { success: true, goal });
        return;
      }

      if (url.pathname === '/api/ape/goals/complete' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const goal = this.apeService.completeSelfGeneratedGoal(body.goalId);
        this.sendJson(res, 200, { success: true, goal });
        return;
      }

      if (url.pathname === '/api/ape/goals' && method === 'GET') {
        const status = url.searchParams.get('status') as any;
        const origin = url.searchParams.get('origin') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 100;
        const goals = this.apeService.selfGeneratedGoalEngine.listGoals({ status, origin, limit });
        this.sendJson(res, 200, goals);
        return;
      }

      if (url.pathname === '/api/ape/goals/triggers' && method === 'GET') {
        const goalId = url.searchParams.get('goalId') || undefined;
        const triggers = this.apeService.selfGeneratedGoalEngine.listTriggers(goalId);
        this.sendJson(res, 200, triggers);
        return;
      }

      // ==========================================
      // Planning and Long-Term Intention Routes (Milestone 22)
      // ==========================================
      if (url.pathname === '/api/ape/planning/decompose' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const plan = this.apeService.decomposeGoalIntoPlan(body);
        this.sendJson(res, 201, { success: true, plan });
        return;
      }

      if (url.pathname === '/api/ape/planning/custom' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const plan = this.apeService.createCustomPlan(body);
        this.sendJson(res, 201, { success: true, plan });
        return;
      }

      if (url.pathname === '/api/ape/planning/start-stage' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const plan = this.apeService.startPlanStage(body.planId, body.stageId);
        this.sendJson(res, 200, { success: true, plan });
        return;
      }

      if (url.pathname === '/api/ape/planning/advance-stage' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const plan = this.apeService.advancePlanStageProgress(body.planId, body.stageId, body.progress, body.checkpoint);
        this.sendJson(res, 200, { success: true, plan });
        return;
      }

      if (url.pathname === '/api/ape/planning/complete-stage' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const plan = this.apeService.completePlanStage(body.planId, body.stageId);
        this.sendJson(res, 200, { success: true, plan });
        return;
      }

      if (url.pathname === '/api/ape/planning/interrupt' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const plan = this.apeService.handlePlanInterruption(body.planId, body.stageId, body.reason, body.context);
        this.sendJson(res, 200, { success: true, plan });
        return;
      }

      if (url.pathname === '/api/ape/planning/recover' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const plan = this.apeService.recoverUnfinishedPlan(body.planId);
        this.sendJson(res, 200, { success: true, plan });
        return;
      }

      if (url.pathname === '/api/ape/planning/revise' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const plan = this.apeService.revisePlan(body.planId, body.updates);
        this.sendJson(res, 200, { success: true, plan });
        return;
      }

      if (url.pathname === '/api/ape/planning/commitments' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const commitment = this.apeService.registerCommitment(body);
        this.sendJson(res, 201, { success: true, commitment });
        return;
      }

      if (url.pathname === '/api/ape/planning/commitments/fulfill' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const commitment = this.apeService.fulfillLongTermCommitment(body.commitmentId, body.evidence);
        this.sendJson(res, 200, { success: true, commitment });
        return;
      }

      if (url.pathname === '/api/ape/planning/plans' && method === 'GET') {
        const status = url.searchParams.get('status') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 100;
        const plans = this.apeService.planningEngine.listPlans({ status, limit });
        this.sendJson(res, 200, plans);
        return;
      }

      if (url.pathname === '/api/ape/planning/commitments' && method === 'GET') {
        const stakeholder = url.searchParams.get('stakeholder') || undefined;
        const status = url.searchParams.get('status') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 100;
        const commitments = this.apeService.planningEngine.listCommitments({ stakeholder, status, limit });
        this.sendJson(res, 200, commitments);
        return;
      }

      // ==========================================
      // Deliberation and Internal Conflict Routes (Milestone 23)
      // ==========================================
      if (url.pathname === '/api/ape/deliberation/conflicts' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const conflict = this.apeService.createInternalConflict(body);
        this.sendJson(res, 201, { success: true, conflict });
        return;
      }

      if (url.pathname === '/api/ape/deliberation/resolve' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.deliberateAndResolveConflict(body.conflictId, body.motivationalState);
        this.sendJson(res, 200, { success: true, ...result });
        return;
      }

      if (url.pathname === '/api/ape/deliberation/reassess' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const conflict = this.apeService.recordPostDecisionReassessment(body.conflictId, body.reassessment);
        this.sendJson(res, 200, { success: true, conflict });
        return;
      }

      if (url.pathname === '/api/ape/deliberation/conflicts' && method === 'GET') {
        const status = url.searchParams.get('status') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 100;
        const conflicts = this.apeService.deliberationEngine.listConflicts({ status, limit });
        this.sendJson(res, 200, conflicts);
        return;
      }

      // ==========================================
      // Autonomous Agency Routes (Milestone 24)
      // ==========================================
      if (url.pathname === '/api/ape/autonomous-agency/initiate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = this.apeService.initiateAutonomousActivity(body);
        this.sendJson(res, 201, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/research' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = await this.apeService.executeAutonomousResearch(body);
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/file-op' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = await this.apeService.executeAutonomousFileOperation(body);
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/app-interaction' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = await this.apeService.executeAutonomousAppInteraction(body);
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/browser' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = await this.apeService.executeAutonomousBrowserInteraction(body);
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/verify' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = this.apeService.verifyAutonomousActivity(body.activityId, body.criteria, body.observedEvidence);
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/interrupt' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = this.apeService.handleAutonomousActivityInterruption(body.activityId, body.reason);
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/recover' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = await this.apeService.recoverFailedAutonomousActivity(body.activityId, body.recoveryStrategy);
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/proactive-message' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = this.apeService.dispatchProactiveCommunication(body.activityId, body.messageText, body.rationale, body.channel);
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/run-goal-cycle' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const cycleResult = await this.apeService.runAutonomousGoalCycle(body.goal);
        this.sendJson(res, 200, { success: true, ...cycleResult });
        return;
      }

      if (url.pathname === '/api/ape/autonomous-agency/activities' && method === 'GET') {
        const status = url.searchParams.get('status') as any;
        const type = url.searchParams.get('type') as any;
        const goalId = url.searchParams.get('goalId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 100;
        const activities = this.apeService.autonomousAgencyEngine.listActivities({ status, type, goalId, limit });
        this.sendJson(res, 200, activities);
        return;
      }

      // ==========================================
      // Emotional Appraisal Routes (Milestone 25)
      // ==========================================
      if (url.pathname === '/api/ape/appraisal/evaluate-frame' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const appraisal = this.apeService.evaluateContextualInterpretation(body.event, body.frame);
        this.sendJson(res, 200, { success: true, appraisal });
        return;
      }

      if (url.pathname === '/api/ape/appraisal/compare-frames' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const comparison = this.apeService.compareEventInterpretations(body.event, body.frames);
        this.sendJson(res, 200, { success: true, comparison });
        return;
      }

      if (url.pathname === '/api/ape/appraisal/comparisons' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const comparisons = this.apeService.contextualAppraisalService.listComparisons(limit);
        this.sendJson(res, 200, comparisons);
        return;
      }

      // ==========================================
      // Emotional Repertoire Routes (Milestone 26)
      // ==========================================
      if (url.pathname === '/api/ape/repertoire/state' && method === 'GET') {
        const state = this.apeService.getEmotionalRepertoireState();
        this.sendJson(res, 200, { success: true, state });
        return;
      }

      if (url.pathname === '/api/ape/repertoire/trigger' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const state = this.apeService.triggerRepertoireEmotion(
          body.emotionKey,
          body.intensity,
          body.triggerType || 'interaction',
          body.reason,
          body.appraisalContext,
        );
        this.sendJson(res, 200, { success: true, state });
        return;
      }

      if (url.pathname === '/api/ape/repertoire/blend' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const blend = this.apeService.blendRepertoireEmotions(
          body.primaryEmotion,
          body.primaryIntensity,
          body.secondaryEmotion,
          body.secondaryIntensity,
          body.context,
        );
        this.sendJson(res, 200, { success: true, blend });
        return;
      }

      if (url.pathname === '/api/ape/repertoire/decay' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const state = this.apeService.applyRepertoireDecay(body.elapsedMs || 60000);
        this.sendJson(res, 200, { success: true, state });
        return;
      }

      if (url.pathname === '/api/ape/repertoire/cognitive-impact' && method === 'GET') {
        const cognitiveImpact = this.apeService.getRepertoireCognitiveImpact();
        this.sendJson(res, 200, { success: true, cognitiveImpact });
        return;
      }

      if (url.pathname === '/api/ape/repertoire/transitions' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const transitions = this.apeService.getRepertoireTransitions(limit);
        this.sendJson(res, 200, transitions);
        return;
      }

      if (url.pathname === '/api/ape/repertoire/blends' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const blends = this.apeService.getRepertoireBlends(limit);
        this.sendJson(res, 200, blends);
        return;
      }

      if (url.pathname === '/api/ape/repertoire/tendencies' && method === 'GET') {
        const tendencies = this.apeService.getIndividualEmotionalTendencies();
        this.sendJson(res, 200, { success: true, tendencies });
        return;
      }

      if (url.pathname === '/api/ape/repertoire/tendencies' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const tendencies = this.apeService.updateIndividualEmotionalTendencies(body);
        this.sendJson(res, 200, { success: true, tendencies });
        return;
      }

      // ==========================================
      // Emotional Regulation & Resilience Routes (Milestone 27)
      // ==========================================
      if (url.pathname === '/api/ape/regulation/escalation-risk' && method === 'GET') {
        const escalationRisk = this.apeService.assessEmotionalEscalationRisk();
        this.sendJson(res, 200, { success: true, escalationRisk });
        return;
      }

      if (url.pathname === '/api/ape/regulation/register-setback' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const setback = this.apeService.registerSetback(
          body.category,
          body.description,
          body.emotion,
          body.rawIntensity,
          body.controllability,
        );
        this.sendJson(res, 200, { success: true, setback });
        return;
      }

      if (url.pathname === '/api/ape/regulation/regulate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const attempt = this.apeService.regulateSetback(
          body.setbackId,
          body.strategy,
          body.reappraisalNarrative,
        );
        this.sendJson(res, 200, { success: true, attempt });
        return;
      }

      if (url.pathname === '/api/ape/regulation/reappraise' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const attempt = this.apeService.reappraiseSetback(
          body.setbackId,
          body.reframingRationale,
        );
        this.sendJson(res, 200, { success: true, attempt });
        return;
      }

      if (url.pathname === '/api/ape/regulation/conflict-recovery' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const attempt = this.apeService.recoverFromRelationalConflict(
          body.setbackId,
          body.partnerFeedback,
          body.dissonanceIntensity,
        );
        this.sendJson(res, 200, { success: true, attempt });
        return;
      }

      if (url.pathname === '/api/ape/regulation/stability-metrics' && method === 'GET') {
        const metrics = this.apeService.getEmotionalStabilityMetrics();
        this.sendJson(res, 200, { success: true, metrics });
        return;
      }

      if (url.pathname === '/api/ape/regulation/setbacks' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const setbacks = this.apeService.listSetbacks(limit);
        this.sendJson(res, 200, setbacks);
        return;
      }

      if (url.pathname === '/api/ape/regulation/attempts' && method === 'GET') {
        const setbackId = url.searchParams.get('setbackId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const attempts = this.apeService.getRegulationAttempts(setbackId, limit);
        this.sendJson(res, 200, attempts);
        return;
      }

      // ==========================================
      // Needs, Drives and Homeostasis Routes (Milestone 28)
      // ==========================================
      if (url.pathname === '/api/ape/homeostasis/needs' && method === 'GET') {
        const needs = this.apeService.getPrioritizedNeeds();
        this.sendJson(res, 200, { success: true, needs });
        return;
      }

      if (url.pathname === '/api/ape/homeostasis/evaluate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const needs = this.apeService.evaluateHomeostaticNeeds(body.resourceMetrics);
        this.sendJson(res, 200, { success: true, needs });
        return;
      }

      if (url.pathname === '/api/ape/homeostasis/drives' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 20;
        const drives = this.apeService.getActiveHomeostaticDrives(limit);
        this.sendJson(res, 200, { success: true, drives });
        return;
      }

      if (url.pathname === '/api/ape/homeostasis/predict' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const prediction = this.apeService.predictResourceDepletion(
          body.burnRatePerMinute,
          body.availableCapacity,
          body.bottleneck,
        );
        this.sendJson(res, 200, { success: true, prediction });
        return;
      }

      if (url.pathname === '/api/ape/homeostasis/satisfy' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const resolution = this.apeService.satisfyHomeostaticNeed(
          body.category,
          body.actionTaken,
          body.reliefAmount,
          body.freedBytes,
        );
        this.sendJson(res, 200, { success: true, resolution });
        return;
      }

      if (url.pathname === '/api/ape/homeostasis/resolutions' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const resolutions = this.apeService.listHomeostaticResolutions(limit);
        this.sendJson(res, 200, resolutions);
        return;
      }

      // ==========================================
      // Intrinsic and Extrinsic Motivation Routes (Milestone 29)
      // ==========================================
      if (url.pathname === '/api/ape/motivation/activities' && method === 'GET') {
        const orientation = url.searchParams.get('orientation') as any;
        const status = url.searchParams.get('status') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const activities = this.apeService.listMotivatedActivities({ orientation, status, limit });
        this.sendJson(res, 200, { success: true, activities });
        return;
      }

      if (url.pathname === '/api/ape/motivation/create-intrinsic' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = this.apeService.createIntrinsicActivity(
          body.title,
          body.description,
          body.competenceDriver,
          body.relatednessDriver,
        );
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/motivation/create-extrinsic' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = this.apeService.createExtrinsicActivity(
          body.title,
          body.description,
          body.source,
        );
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/motivation/internalize' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const record = this.apeService.internalizeExternalGoal(
          body.activityId,
          body.internalizedRationale,
        );
        this.sendJson(res, 200, { success: true, record });
        return;
      }

      if (url.pathname === '/api/ape/motivation/sustain' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const activity = this.apeService.sustainMotivatedActivity(
          body.activityId,
          body.progressIncrement || 0.1,
        );
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/motivation/reassess' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.reassessActivityMotivation(
          body.activityId,
          body.sterilityFactor || 0.0,
        );
        this.sendJson(res, 200, { success: true, result });
        return;
      }

      if (url.pathname === '/api/ape/motivation/internalizations' && method === 'GET') {
        const activityId = url.searchParams.get('activityId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const records = this.apeService.getGoalInternalizations(activityId, limit);
        this.sendJson(res, 200, records);
        return;
      }

      if (url.pathname === '/api/ape/motivation/reassessments' && method === 'GET') {
        const activityId = url.searchParams.get('activityId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const reassessments = this.apeService.getMotivationReassessments(activityId, limit);
        this.sendJson(res, 200, reassessments);
        return;
      }

      // ==========================================
      // Curiosity and Exploration Routes (Milestone 30)
      // ==========================================
      if (url.pathname === '/api/ape/curiosity/interests' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const interests = this.apeService.listDiscoveredInterests(limit);
        this.sendJson(res, 200, { success: true, interests });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/develop-interest' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const interest = this.apeService.developDiscoveredInterest(
          body.domain,
          body.topic,
          body.discoveredRationale,
          body.initialFindings || [],
        );
        this.sendJson(res, 200, { success: true, interest });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/evolve-interest' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const interest = this.apeService.evolveInterestMaturity(body.interestId, body.newFinding);
        this.sendJson(res, 200, { success: true, interest });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/gaps' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const gaps = this.apeService.listKnowledgeGaps(domain, limit);
        this.sendJson(res, 200, { success: true, gaps });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/identify-gap' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const gap = this.apeService.identifyKnowledgeGap(
          body.domain,
          body.topic,
          body.gapDescription,
          body.epistemicUncertainty ?? 0.75,
        );
        this.sendJson(res, 200, { success: true, gap });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/questions' && method === 'GET') {
        const knowledgeGapId = url.searchParams.get('knowledgeGapId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const questions = this.apeService.listExploratoryQuestions(knowledgeGapId, limit);
        this.sendJson(res, 200, { success: true, questions });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/formulate-question' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const question = this.apeService.formulateExploratoryQuestion(
          body.knowledgeGapId,
          body.question,
          body.hypotheses || [],
        );
        this.sendJson(res, 200, { success: true, question });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/investigations' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const investigations = this.apeService.listInvestigations(domain, limit);
        this.sendJson(res, 200, { success: true, investigations });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/investigate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const investigation = this.apeService.conductIndependentInvestigation(
          body.questionId,
          body.investigationTitle,
          body.stepsExecuted || [],
          body.synthesisSummary,
        );
        this.sendJson(res, 200, { success: true, investigation });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/novelty' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const records = this.apeService.listNoveltyDetections(limit);
        this.sendJson(res, 200, { success: true, records });
        return;
      }

      if (url.pathname === '/api/ape/curiosity/detect-novelty' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const record = this.apeService.detectNovelty(
          body.stimulus,
          body.detectedDomain,
          body.familiarityBaseline ?? 0.25,
        );
        this.sendJson(res, 200, { success: true, record });
        return;
      }

      // ==========================================
      // Reward Learning Routes (Milestone 31)
      // ==========================================
      if (url.pathname === '/api/ape/reward/strategies' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const strategies = this.apeService.listStrategyPerformances(domain, limit);
        this.sendJson(res, 200, { success: true, strategies });
        return;
      }

      if (url.pathname === '/api/ape/reward/register-strategy' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const strategy = this.apeService.registerStrategy(
          body.strategyId,
          body.strategyName,
          body.domain,
          body.initialEffectiveness ?? 0.5,
        );
        this.sendJson(res, 200, { success: true, strategy });
        return;
      }

      if (url.pathname === '/api/ape/reward/strategy' && method === 'GET') {
        const strategyId = url.searchParams.get('strategyId');
        if (!strategyId) {
          this.sendJson(res, 400, { error: 'strategyId query param required' });
          return;
        }
        const strategy = this.apeService.getStrategyPerformance(strategyId);
        this.sendJson(res, 200, { success: true, strategy });
        return;
      }

      if (url.pathname === '/api/ape/reward/predict' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const prediction = this.apeService.predictReward(
          body.strategyId,
          body.domain,
          body.contextDescription,
          body.predictedUtility,
          body.predictedDimensions,
        );
        this.sendJson(res, 200, { success: true, prediction });
        return;
      }

      if (url.pathname === '/api/ape/reward/predictions' && method === 'GET') {
        const strategyId = url.searchParams.get('strategyId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const predictions = this.apeService.listRewardPredictions(strategyId, limit);
        this.sendJson(res, 200, { success: true, predictions });
        return;
      }

      if (url.pathname === '/api/ape/reward/evaluate' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const evaluation = this.apeService.evaluateOutcome({
          strategyId: body.strategyId,
          predictionId: body.predictionId,
          domain: body.domain,
          contextDescription: body.contextDescription,
          expectedUtility: body.expectedUtility,
          observedUtility: body.observedUtility,
          dimensionScores: body.dimensionScores,
          outcomeDetails: body.outcomeDetails,
        });
        this.sendJson(res, 200, { success: true, evaluation });
        return;
      }

      if (url.pathname === '/api/ape/reward/evaluations' && method === 'GET') {
        const strategyId = url.searchParams.get('strategyId') || undefined;
        const domain = url.searchParams.get('domain') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const evaluations = this.apeService.listOutcomeEvaluations(strategyId, domain, limit);
        this.sendJson(res, 200, { success: true, evaluations });
        return;
      }

      if (url.pathname === '/api/ape/reward/diminishing-alerts' && method === 'GET') {
        const strategyId = url.searchParams.get('strategyId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const alerts = this.apeService.listDiminishingReturnAlerts(strategyId, limit);
        this.sendJson(res, 200, { success: true, alerts });
        return;
      }

      // ==========================================
      // Habits and Routines Routes (Milestone 32)
      // ==========================================
      if (url.pathname === '/api/ape/habits/list' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const activeOnly = url.searchParams.get('activeOnly') === 'true';
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const habits = this.apeService.listHabits(domain, activeOnly, limit);
        this.sendJson(res, 200, { success: true, habits });
        return;
      }

      if (url.pathname === '/api/ape/habits/get' && method === 'GET') {
        const habitId = url.searchParams.get('habitId');
        if (!habitId) {
          this.sendJson(res, 400, { error: 'habitId query param required' });
          return;
        }
        const habit = this.apeService.getHabit(habitId);
        this.sendJson(res, 200, { success: true, habit });
        return;
      }

      if (url.pathname === '/api/ape/habits/form' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const habit = this.apeService.formHabit({
          name: body.name,
          domain: body.domain,
          description: body.description,
          triggers: body.triggers || [],
          routineSteps: body.routineSteps || [],
          initialUtility: body.initialUtility,
        });
        this.sendJson(res, 200, { success: true, habit });
        return;
      }

      if (url.pathname === '/api/ape/habits/execute' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const log = this.apeService.triggerAndExecuteHabit(
          body.habitId,
          body.triggeredBy,
          body.overrideInterruptionReason,
        );
        this.sendJson(res, 200, { success: true, log });
        return;
      }

      if (url.pathname === '/api/ape/habits/modify' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const habit = this.apeService.evaluateAndModifyHabit(body.habitId, {
          name: body.name,
          description: body.description,
          newRoutineSteps: body.newRoutineSteps,
          newTriggers: body.newTriggers,
          newUtility: body.newUtility,
          isActive: body.isActive,
        });
        this.sendJson(res, 200, { success: true, habit });
        return;
      }

      if (url.pathname === '/api/ape/habits/logs' && method === 'GET') {
        const habitId = url.searchParams.get('habitId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const logs = this.apeService.listHabitExecutionLogs(habitId, limit);
        this.sendJson(res, 200, { success: true, logs });
        return;
      }

      if (url.pathname === '/api/ape/habits/balance' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const balance = this.apeService.assessNoveltyRoutineBalance(
          body.routineActionsCount ?? 0,
          body.novelExploratoryCount ?? 0,
        );
        this.sendJson(res, 200, { success: true, balance });
        return;
      }

      if (url.pathname === '/api/ape/habits/balance' && method === 'GET') {
        const balance = this.apeService.getLatestNoveltyRoutineBalance();
        this.sendJson(res, 200, { success: true, balance });
        return;
      }

      // ==========================================
      // Temperament and Personality Routes (Milestone 33)
      // ==========================================
      if (url.pathname === '/api/ape/temperament/profile' && method === 'GET') {
        const profile = this.apeService.getTemperamentProfile();
        this.sendJson(res, 200, { success: true, profile });
        return;
      }

      if (url.pathname === '/api/ape/temperament/express' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const expression = this.apeService.expressPersonalityInSituation(
          body.situationType,
          body.contextDescription,
          body.customDeltas,
        );
        this.sendJson(res, 200, { success: true, expression });
        return;
      }

      if (url.pathname === '/api/ape/temperament/expressions' && method === 'GET') {
        const situationType = url.searchParams.get('situationType') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const expressions = this.apeService.listSituationalExpressions(situationType, limit);
        this.sendJson(res, 200, { success: true, expressions });
        return;
      }

      if (url.pathname === '/api/ape/temperament/evolve-trait' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const record = this.apeService.evolveTraitGradually(
          body.traitKey,
          body.delta,
          body.driftReason,
        );
        this.sendJson(res, 200, { success: true, record });
        return;
      }

      if (url.pathname === '/api/ape/temperament/evolution-records' && method === 'GET') {
        const traitKey = url.searchParams.get('traitKey') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const records = this.apeService.listPersonalityEvolutionRecords(traitKey, limit);
        this.sendJson(res, 200, { success: true, records });
        return;
      }

      // ==========================================
      // Values and Moral Cognition Routes (Milestone 34)
      // ==========================================
      if (url.pathname === '/api/ape/moral/principles' && method === 'GET') {
        const category = url.searchParams.get('category') as any;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const principles = this.apeService.listMoralPrinciples(category, limit);
        this.sendJson(res, 200, { success: true, principles });
        return;
      }

      if (url.pathname === '/api/ape/moral/principle' && method === 'GET') {
        const id = url.searchParams.get('id');
        if (!id) {
          this.sendJson(res, 400, { error: 'id query param required' });
          return;
        }
        const principle = this.apeService.getMoralPrinciple(id);
        this.sendJson(res, 200, { success: true, principle });
        return;
      }

      if (url.pathname === '/api/ape/moral/assess-harm' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const assessment = this.apeService.assessMoralHarm(
          body.scenario,
          body.potentialImpacts || [],
        );
        this.sendJson(res, 200, { success: true, assessment });
        return;
      }

      if (url.pathname === '/api/ape/moral/evaluate-intent' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const evaluation = this.apeService.evaluateIntention(
          body.actorId,
          body.outcomeWasHarmful ?? false,
          body.contextSignals || [],
        );
        this.sendJson(res, 200, { success: true, evaluation });
        return;
      }

      if (url.pathname === '/api/ape/moral/resolve-dilemma' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const resolution = this.apeService.resolveEthicalDilemma({
          scenario: body.scenario,
          competingValues: body.competingValues,
          contextSignals: body.contextSignals,
          proposedOptionA: body.proposedOptionA,
          proposedOptionB: body.proposedOptionB,
        });
        this.sendJson(res, 200, { success: true, resolution });
        return;
      }

      if (url.pathname === '/api/ape/moral/reconsider-principle' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const record = this.apeService.reconsiderMoralPrinciple(
          body.principleId,
          body.deltaWeight,
          body.reflectionSummary,
          body.dilemmaId,
        );
        this.sendJson(res, 200, { success: true, record });
        return;
      }

      if (url.pathname === '/api/ape/moral/resolutions' && method === 'GET') {
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const resolutions = this.apeService.listEthicalResolutions(limit);
        this.sendJson(res, 200, { success: true, resolutions });
        return;
      }

      if (url.pathname === '/api/ape/moral/learning-records' && method === 'GET') {
        const principleId = url.searchParams.get('principleId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const records = this.apeService.listMoralLearningRecords(principleId, limit);
        this.sendJson(res, 200, { success: true, records });
        return;
      }

      // ==========================================
      // Milestone 35: Self-Evaluation and Self-Efficacy Routes
      // ==========================================
      if (url.pathname === '/api/ape/efficacy/competences' && method === 'GET') {
        const competences = this.apeService.listDomainCompetences();
        this.sendJson(res, 200, { success: true, competences });
        return;
      }

      if (url.pathname === '/api/ape/efficacy/competence' && method === 'GET') {
        const domain = url.searchParams.get('domain');
        if (!domain) {
          this.sendJson(res, 400, { error: 'Query parameter "domain" is required' });
          return;
        }
        const competence = this.apeService.getDomainCompetence(domain);
        if (!competence) {
          this.sendJson(res, 404, { error: `Domain competence not found for: ${domain}` });
          return;
        }
        this.sendJson(res, 200, { success: true, competence });
        return;
      }

      if (url.pathname === '/api/ape/efficacy/record-evidence' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.recordEfficacyEvidence(body);
        this.sendJson(res, 200, { success: true, ...result });
        return;
      }

      if (url.pathname === '/api/ape/efficacy/limitations' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const limitations = this.apeService.listCapabilityLimitations(domain);
        this.sendJson(res, 200, { success: true, limitations });
        return;
      }

      if (url.pathname === '/api/ape/efficacy/limitations' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const limitation = this.apeService.registerCapabilityLimitation(body);
        this.sendJson(res, 201, { success: true, limitation });
        return;
      }

      if (url.pathname === '/api/ape/efficacy/improvement-goals' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const status = url.searchParams.get('status') || undefined;
        const goals = this.apeService.listSelfImprovementGoals(domain, status);
        this.sendJson(res, 200, { success: true, goals });
        return;
      }

      if (url.pathname === '/api/ape/efficacy/improvement-goals' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const goal = this.apeService.createSelfImprovementGoal(body);
        this.sendJson(res, 201, { success: true, goal });
        return;
      }

      if (url.pathname === '/api/ape/efficacy/improvement-goals' && method === 'PATCH') {
        const body = (await this.readJsonBody(req)) as any;
        const goal = this.apeService.updateSelfImprovementProgress(body.goalId, body.progress, body.status);
        this.sendJson(res, 200, { success: true, goal });
        return;
      }

      if (url.pathname === '/api/ape/efficacy/evaluate-self' && method === 'POST') {
        const snapshot = this.apeService.evaluateSelf();
        this.sendJson(res, 200, { success: true, snapshot });
        return;
      }

      if (url.pathname === '/api/ape/efficacy/evidence' && method === 'GET') {
        const domain = url.searchParams.get('domain') || undefined;
        const type = (url.searchParams.get('type') as any) || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const evidence = this.apeService.listEfficacyEvidence(domain, type, limit);
        this.sendJson(res, 200, { success: true, evidence });
        return;
      }

      // ==========================================
      // Milestone 36: Long-Term Psychological Development Routes
      // ==========================================
      if (url.pathname === '/api/ape/development-longterm/overview' && method === 'GET') {
        const overview = this.apeService.getDevelopmentOverview();
        this.sendJson(res, 200, { success: true, overview });
        return;
      }

      if (url.pathname === '/api/ape/development-longterm/record-change' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const entry = this.apeService.recordDevelopmentChange(body);
        this.sendJson(res, 201, { success: true, entry });
        return;
      }

      if (url.pathname === '/api/ape/development-longterm/start-epoch' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const epoch = this.apeService.startDevelopmentEpoch(body);
        this.sendJson(res, 201, { success: true, epoch });
        return;
      }

      if (url.pathname === '/api/ape/development-longterm/history' && method === 'GET') {
        const dimension = (url.searchParams.get('dimension') as any) || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const history = this.apeService.listDevelopmentHistory(dimension, limit);
        this.sendJson(res, 200, { success: true, history });
        return;
      }

      if (url.pathname === '/api/ape/development-longterm/epochs' && method === 'GET') {
        const epochs = this.apeService.listDevelopmentEpochs();
        this.sendJson(res, 200, { success: true, epochs });
        return;
      }

      if (url.pathname === '/api/ape/development-longterm/anchors' && method === 'GET') {
        const anchors = this.apeService.listIdentityAnchors();
        this.sendJson(res, 200, { success: true, anchors });
        return;
      }

      // ==========================================
      // Milestone 37: Theory of Mind Routes
      // ==========================================
      if (url.pathname === '/api/ape/tom/agents' && method === 'GET') {
        const agents = this.apeService.listAgentMentalModels();
        this.sendJson(res, 200, { success: true, agents });
        return;
      }

      if (url.pathname === '/api/ape/tom/agent' && method === 'GET') {
        const agentId = url.searchParams.get('agentId');
        if (!agentId) {
          this.sendJson(res, 400, { error: 'Query parameter "agentId" is required' });
          return;
        }
        const agent = this.apeService.getAgentMentalModel(agentId);
        if (!agent) {
          this.sendJson(res, 404, { error: `Agent not found: ${agentId}` });
          return;
        }
        this.sendJson(res, 200, { success: true, agent });
        return;
      }

      if (url.pathname === '/api/ape/tom/register-agent' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const agent = this.apeService.registerAgentMentalModel(body);
        this.sendJson(res, 201, { success: true, agent });
        return;
      }

      if (url.pathname === '/api/ape/tom/infer-belief' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const belief = this.apeService.inferBelief(body);
        this.sendJson(res, 201, { success: true, belief });
        return;
      }

      if (url.pathname === '/api/ape/tom/beliefs' && method === 'GET') {
        const agentId = url.searchParams.get('agentId') || undefined;
        const beliefs = this.apeService.listInferredBeliefs(agentId);
        this.sendJson(res, 200, { success: true, beliefs });
        return;
      }

      if (url.pathname === '/api/ape/tom/infer-intention' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const intention = this.apeService.inferIntention(body);
        this.sendJson(res, 201, { success: true, intention });
        return;
      }

      if (url.pathname === '/api/ape/tom/intentions' && method === 'GET') {
        const agentId = url.searchParams.get('agentId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const intentions = this.apeService.listInferredIntentions(agentId, limit);
        this.sendJson(res, 200, { success: true, intentions });
        return;
      }

      if (url.pathname === '/api/ape/tom/predict-social-action' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const prediction = this.apeService.predictSocialAction(body);
        this.sendJson(res, 201, { success: true, prediction });
        return;
      }

      if (url.pathname === '/api/ape/tom/social-predictions' && method === 'GET') {
        const agentId = url.searchParams.get('agentId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const predictions = this.apeService.listSocialPredictions(agentId, limit);
        this.sendJson(res, 200, { success: true, predictions });
        return;
      }

      // ==========================================
      // Milestone 38: Empathy and Perspective-Taking Routes
      // ==========================================
      if (url.pathname === '/api/ape/empathy/infer-experience' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const experience = this.apeService.inferExperience(body);
        this.sendJson(res, 201, { success: true, experience });
        return;
      }

      if (url.pathname === '/api/ape/empathy/experiences' && method === 'GET') {
        const targetPersonId = url.searchParams.get('targetPersonId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const experiences = this.apeService.listInferredExperiences(targetPersonId, limit);
        this.sendJson(res, 200, { success: true, experiences });
        return;
      }

      if (url.pathname === '/api/ape/empathy/take-perspective' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const perspective = this.apeService.takePerspective(body);
        this.sendJson(res, 201, { success: true, perspective });
        return;
      }

      if (url.pathname === '/api/ape/empathy/perspective' && method === 'GET') {
        const targetPersonId = url.searchParams.get('targetPersonId');
        if (!targetPersonId) {
          this.sendJson(res, 400, { error: 'Query parameter "targetPersonId" is required' });
          return;
        }
        const perspective = this.apeService.getPerspectiveModel(targetPersonId);
        if (!perspective) {
          this.sendJson(res, 404, { error: `Perspective model not found for: ${targetPersonId}` });
          return;
        }
        this.sendJson(res, 200, { success: true, perspective });
        return;
      }

      if (url.pathname === '/api/ape/empathy/perspectives' && method === 'GET') {
        const perspectives = this.apeService.listPerspectiveModels();
        this.sendJson(res, 200, { success: true, perspectives });
        return;
      }

      if (url.pathname === '/api/ape/empathy/synthesize-response' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const response = this.apeService.synthesizeEmpatheticResponse(body);
        this.sendJson(res, 201, { success: true, response });
        return;
      }

      if (url.pathname === '/api/ape/empathy/responses' && method === 'GET') {
        const targetPersonId = url.searchParams.get('targetPersonId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const responses = this.apeService.listEmpatheticResponses(targetPersonId, limit);
        this.sendJson(res, 200, { success: true, responses });
        return;
      }

      if (url.pathname === '/api/ape/empathy/revise-perspective' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.revisePerspective(body);
        this.sendJson(res, 200, { success: true, ...result });
        return;
      }

      if (url.pathname === '/api/ape/empathy/revisions' && method === 'GET') {
        const perspectiveId = url.searchParams.get('perspectiveId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const revisions = this.apeService.listPerspectiveRevisions(perspectiveId, limit);
        this.sendJson(res, 200, { success: true, revisions });
        return;
      }

      // ==========================================
      // Milestone 39: Social Emotions Routes
      // ==========================================
      if (url.pathname === '/api/ape/social-emotions/process-interaction' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const result = this.apeService.processSocialInteraction(body);
        this.sendJson(res, 201, { success: true, ...result });
        return;
      }

      if (url.pathname === '/api/ape/social-emotions/snapshot' && method === 'GET') {
        const targetPersonId = url.searchParams.get('targetPersonId');
        if (!targetPersonId) {
          this.sendJson(res, 400, { error: 'Query parameter "targetPersonId" is required' });
          return;
        }
        const snapshot = this.apeService.getSocialEmotionsSnapshot(targetPersonId);
        this.sendJson(res, 200, { success: true, snapshot });
        return;
      }

      if (url.pathname === '/api/ape/social-emotions/states' && method === 'GET') {
        const targetPersonId = url.searchParams.get('targetPersonId') || undefined;
        const emotions = this.apeService.listSocialEmotionStates(targetPersonId);
        this.sendJson(res, 200, { success: true, emotions });
        return;
      }

      if (url.pathname === '/api/ape/social-emotions/state' && method === 'GET') {
        const targetPersonId = url.searchParams.get('targetPersonId');
        const emotion = url.searchParams.get('emotion') as any;
        if (!targetPersonId || !emotion) {
          this.sendJson(res, 400, { error: 'Query parameters "targetPersonId" and "emotion" are required' });
          return;
        }
        const state = this.apeService.getSocialEmotionState(targetPersonId, emotion);
        if (!state) {
          this.sendJson(res, 404, { error: `Social emotion state not found for: ${targetPersonId}/${emotion}` });
          return;
        }
        this.sendJson(res, 200, { success: true, state });
        return;
      }

      if (url.pathname === '/api/ape/social-emotions/appraisals' && method === 'GET') {
        const targetPersonId = url.searchParams.get('targetPersonId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const appraisals = this.apeService.listSocialAppraisals(targetPersonId, limit);
        this.sendJson(res, 200, { success: true, appraisals });
        return;
      }

      // ==========================================
      // Social Communication & Pragmatics Routes (Milestone 40)
      // ==========================================
      if (url.pathname === '/api/ape/pragmatics/analyze' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.utterance || !body.speakerId) {
          this.sendJson(res, 400, { error: 'utterance and speakerId are required' });
          return;
        }
        const analysis = await this.apeService.analyzePragmatics(
          body.utterance,
          body.speakerId,
          body.context,
        );
        this.sendJson(res, 200, { success: true, analysis });
        return;
      }

      if (url.pathname === '/api/ape/pragmatics/turn-taking' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.sessionId || !body.speakerId || body.inputLatencyMs === undefined) {
          this.sendJson(res, 400, { error: 'sessionId, speakerId, and inputLatencyMs are required' });
          return;
        }
        const turn = await this.apeService.evaluateTurnTaking(
          body.sessionId,
          body.speakerId,
          body.inputLatencyMs,
          body.isInterruption,
        );
        this.sendJson(res, 200, { success: true, turn });
        return;
      }

      if (url.pathname === '/api/ape/pragmatics/audience-adaptation' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.targetAudienceId || !body.socialDistance) {
          this.sendJson(res, 400, { error: 'targetAudienceId and socialDistance are required' });
          return;
        }
        const profile = await this.apeService.adaptToAudience(
          body.targetAudienceId,
          body.socialDistance,
        );
        this.sendJson(res, 200, { success: true, profile });
        return;
      }

      if (url.pathname === '/api/ape/pragmatics/context' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.sessionId || !body.topic || !body.discourseGoal) {
          this.sendJson(res, 400, { error: 'sessionId, topic, and discourseGoal are required' });
          return;
        }
        const context = await this.apeService.updateConversationalContext(
          body.sessionId,
          body.topic,
          body.commonGroundUpdates || [],
          body.discourseGoal,
          body.formalityLevel,
        );
        this.sendJson(res, 200, { success: true, context });
        return;
      }

      if (url.pathname === '/api/ape/pragmatics/context' && method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) {
          this.sendJson(res, 400, { error: 'sessionId is required' });
          return;
        }
        const context = this.apeService.getConversationalContext(sessionId);
        if (!context) {
          this.sendJson(res, 404, { error: `Conversational context not found for session: ${sessionId}` });
          return;
        }
        this.sendJson(res, 200, { success: true, context });
        return;
      }

      if (url.pathname === '/api/ape/pragmatics/appropriateness' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.utterance || !body.context || !body.audienceProfile) {
          this.sendJson(res, 400, { error: 'utterance, context, and audienceProfile are required' });
          return;
        }
        const evaluation = this.apeService.evaluateContextualAppropriateness(
          body.utterance,
          body.context,
          body.audienceProfile,
        );
        this.sendJson(res, 200, { success: true, evaluation });
        return;
      }

      // ==========================================
      // Relationships & Attachment Routes (Milestone 41)
      // ==========================================
      if (url.pathname === '/api/ape/relationships/bond' && method === 'GET') {
        const personId = url.searchParams.get('personId') || 'proof';
        const bond = await this.apeService.getAttachmentBond(personId);
        this.sendJson(res, 200, { success: true, bond });
        return;
      }

      if (url.pathname === '/api/ape/relationships/shared-event' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.personId || !body.title || !body.eventType) {
          this.sendJson(res, 400, { error: 'personId, title, and eventType are required' });
          return;
        }
        const result = await this.apeService.recordSharedHistoryEvent(body.personId, body);
        this.sendJson(res, 200, { success: true, ...result });
        return;
      }

      if (url.pathname === '/api/ape/relationships/shared-events' && method === 'GET') {
        const personId = url.searchParams.get('personId');
        if (!personId) {
          this.sendJson(res, 400, { error: 'personId is required' });
          return;
        }
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const events = this.apeService.listSharedHistoryEvents(personId, limit);
        this.sendJson(res, 200, { success: true, events });
        return;
      }

      if (url.pathname === '/api/ape/relationships/conflict' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.personId || !body.triggerReason || !body.disagreementSummary) {
          this.sendJson(res, 400, { error: 'personId, triggerReason, and disagreementSummary are required' });
          return;
        }
        const conflict = await this.apeService.recognizeRelationalConflict(body);
        this.sendJson(res, 200, { success: true, conflict });
        return;
      }

      if (url.pathname === '/api/ape/relationships/apology' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.conflictId || !body.initiator || !body.acknowledgment) {
          this.sendJson(res, 400, { error: 'conflictId, initiator, and acknowledgment are required' });
          return;
        }
        const result = await this.apeService.submitApologyAndRepair(body);
        this.sendJson(res, 200, { success: true, ...result });
        return;
      }

      if (url.pathname === '/api/ape/relationships/boundary' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.personId || !body.category || !body.description) {
          this.sendJson(res, 400, { error: 'personId, category, and description are required' });
          return;
        }
        const boundary = await this.apeService.assertRelationshipBoundary(body.personId, body);
        this.sendJson(res, 200, { success: true, boundary });
        return;
      }

      if (url.pathname === '/api/ape/relationships/separation-continuity' && method === 'GET') {
        const personId = url.searchParams.get('personId') || 'proof';
        const elapsedHours = url.searchParams.get('elapsedHours') ? parseFloat(url.searchParams.get('elapsedHours')!) : 24;
        const result = await this.apeService.evaluateSeparationContinuity(personId, elapsedHours);
        this.sendJson(res, 200, { success: true, ...result });
        return;
      }

      // ==========================================
      // Social Learning & Culture Routes (Milestone 42)
      // ==========================================
      if (url.pathname === '/api/ape/culture/observe' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.observedActorId || !body.observedBehavior || !body.context || !body.observedOutcome) {
          this.sendJson(res, 400, { error: 'observedActorId, observedBehavior, context, and observedOutcome are required' });
          return;
        }
        const record = await this.apeService.observeSocialBehavior(body);
        this.sendJson(res, 200, { success: true, record });
        return;
      }

      if (url.pathname === '/api/ape/culture/evaluate-norm' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.normName || !body.culturalContext || !body.description) {
          this.sendJson(res, 400, { error: 'normName, culturalContext, and description are required' });
          return;
        }
        const norm = await this.apeService.evaluateSocialNorm(body);
        this.sendJson(res, 200, { success: true, norm });
        return;
      }

      if (url.pathname === '/api/ape/culture/norms' && method === 'GET') {
        const culturalContext = url.searchParams.get('culturalContext') || undefined;
        const norms = this.apeService.listSocialNorms(culturalContext);
        this.sendJson(res, 200, { success: true, norms });
        return;
      }

      if (url.pathname === '/api/ape/culture/coordinate-activity' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.activityName || !body.participants || !body.activityType) {
          this.sendJson(res, 400, { error: 'activityName, participants, and activityType are required' });
          return;
        }
        const activity = await this.apeService.coordinateSocialActivity(body);
        this.sendJson(res, 200, { success: true, activity });
        return;
      }

      if (url.pathname === '/api/ape/culture/resolve-dilemma' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        if (!body.socialConventionId || !body.socialExpectation) {
          this.sendJson(res, 400, { error: 'socialConventionId and socialExpectation are required' });
          return;
        }
        const dilemma = await this.apeService.resolvePersonalVsSocialDilemma(body);
        this.sendJson(res, 200, { success: true, dilemma });
        return;
      }

      if (url.pathname === '/api/ape/culture/observations' && method === 'GET') {
        const actorId = url.searchParams.get('actorId') || undefined;
        const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : 50;
        const observations = this.apeService.listObservationalLearningRecords(actorId, limit);
        this.sendJson(res, 200, { success: true, observations });
        return;
      }






      // ==========================================
      // Digital Agency Subsystem Routes
      // ==========================================
      if (url.pathname === '/api/agency/tasks' && method === 'GET') {
        const status = url.searchParams.get('status') as any;
        const tasks = this.intentTaskManager.listTasks(status || undefined);
        this.sendJson(res, 200, tasks);
        return;
      }

      if (url.pathname === '/api/agency/tasks' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as any;
        const task = this.intentTaskManager.createTask(body);
        this.sendJson(res, 201, task);
        return;
      }

      if (url.pathname.startsWith('/api/agency/tasks/') && method === 'GET') {
        const taskId = url.pathname.replace('/api/agency/tasks/', '');
        const details = this.intentTaskManager.getTaskDetails(taskId);
        if (!details) {
          this.sendJson(res, 404, { error: 'Task not found' });
          return;
        }
        this.sendJson(res, 200, details);
        return;
      }

      if (url.pathname === '/api/agency/intent' && method === 'POST') {
        const body = (await this.readJsonBody(req)) as { objective: string; initiator?: 'user' | 'arle' };
        const result = await this.submitAgencyObjective(body.objective, body.initiator || 'user');
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname.startsWith('/api/agency/tasks/') && url.pathname.endsWith('/execute') && method === 'POST') {
        const taskId = url.pathname.replace('/api/agency/tasks/', '').replace('/execute', '');
        const result = await this.executeAgencyTask(taskId);
        this.sendJson(res, 200, result);
        return;
      }

      if (url.pathname.startsWith('/api/agency/tasks/') && url.pathname.endsWith('/cancel') && method === 'POST') {
        const taskId = url.pathname.replace('/api/agency/tasks/', '').replace('/cancel', '');
        const task = this.intentTaskManager.cancelTask(taskId);
        this.sendJson(res, 200, task);
        return;
      }

      if (url.pathname === '/api/agency/emergency-shutdown' && method === 'POST') {
        const body = (await this.readJsonBody(req).catch(() => ({}))) as { reason?: string };
        const shutdownReason = body?.reason || 'API emergency shutdown';

        // 1. Immediately activate emergency shutdown in ActionPermissionController
        this.permissionController.emergencyShutdown(shutdownReason);

        // 2. Stop autonomous proactive cycle & agent loop
        if (this.autonomousAgency) {
          try {
            this.autonomousAgency.stopLoop();
            this.autonomousAgency.setEnabled(false);
          } catch (loopErr) {
            this.logger.error('Error stopping autonomous loop during shutdown', loopErr);
          }
        }

        // 3. Cancel all pending, authorized, and running agency tasks
        const activeTasks = [
          ...this.intentTaskManager.listTasks('running'),
          ...this.intentTaskManager.listTasks('authorized'),
          ...this.intentTaskManager.listTasks('awaiting_authorization'),
          ...this.intentTaskManager.listTasks('proposed'),
        ];
        for (const t of activeTasks) {
          try {
            this.intentTaskManager.cancelTask(t.id);
          } catch {}
        }

        // 4. Cancel active inference streams
        for (const [, controller] of this.activeStreams.entries()) {
          try {
            controller.abort();
          } catch {}
        }
        this.activeStreams.clear();

        // 5. Record audit log event
        try {
          await this.activityRepo.create({
            title: 'EMERGENCY_SHUTDOWN',
            objective: `Emergency agency shutdown triggered. Reason: ${shutdownReason}`,
            status: 'cancelled',
            origin: 'arle_initiated',
            metadata: {
              reason: shutdownReason,
              timestamp: new Date().toISOString(),
              cancelledTasksCount: activeTasks.length,
            },
          });
        } catch (auditErr) {
          this.logger.error('Failed to record emergency shutdown audit event', auditErr);
        }

        this.logger.warn(`Emergency agency shutdown executed via API. Reason: ${shutdownReason}`);
        this.sendJson(res, 200, {
          success: true,
          shutdown: true,
          policy: this.permissionController.getPolicy(),
          cancelledTasksCount: activeTasks.length,
          reason: shutdownReason,
        });
        return;
      }

      if (url.pathname === '/api/agency/reactivate-autonomy' && method === 'POST') {
        const body = (await this.readJsonBody(req).catch(() => ({}))) as { confirmation?: string };
        const confirmation = body?.confirmation || '';
        const reactivateRes = this.permissionController.reactivateAutonomy(confirmation);

        if (!reactivateRes.success) {
          this.sendJson(res, 403, {
            success: false,
            error: reactivateRes.message,
          });
          return;
        }

        // Re-enable autonomous agency loop
        if (this.autonomousAgency) {
          this.autonomousAgency.setEnabled(true);
          this.autonomousAgency.startLoop();
        }

        try {
          await this.activityRepo.create({
            title: 'AUTONOMY_REACTIVATED',
            objective: 'Autonomous digital agency has been explicitly reactivated after emergency shutdown.',
            status: 'completed',
            origin: 'user_assigned',
            metadata: {
              timestamp: new Date().toISOString(),
            },
          });
        } catch (auditErr) {
          this.logger.error('Failed to record autonomy reactivation audit event', auditErr);
        }

        this.logger.info('Autonomous agency reactivated successfully.');
        this.sendJson(res, 200, {
          success: true,
          message: reactivateRes.message,
          policy: this.permissionController.getPolicy(),
        });
        return;
      }

      if (url.pathname === '/api/agency/permissions/history' && method === 'GET') {
        const history = this.permissionController.getAuthorizationHistory();
        this.sendJson(res, 200, history);
        return;
      }

      if (url.pathname === '/api/agency/status' && method === 'GET') {
        const policy = this.permissionController.getPolicy();
        const runningTasks = this.intentTaskManager.listTasks('running');
        const emergencyInfo = this.permissionController.getEmergencyShutdownInfo();
        this.sendJson(res, 200, {
          autonomousExecutionEnabled: policy.autonomousExecutionEnabled,
          isEmergencyShutdown: emergencyInfo.active,
          emergencyShutdownReason: emergencyInfo.reason,
          emergencyShutdownTimestamp: emergencyInfo.timestamp,
          activeTasks: runningTasks,
          runningCount: runningTasks.length,
        });
        return;
      }

      if (url.pathname === '/api/agency/policy' && method === 'GET') {
        this.sendJson(res, 200, this.permissionController.getPolicy());
        return;
      }

      if (url.pathname === '/api/agency/policy' && (method === 'POST' || method === 'PATCH')) {
        const body = (await this.readJsonBody(req)) as any;
        this.permissionController.updatePolicy(body);
        this.sendJson(res, 200, this.permissionController.getPolicy());
        return;
      }

      this.sendJson(res, 404, { error: 'Not found' });
    } catch (err: any) {
      this.logger.error(`Error handling ${method} ${url.pathname}`, err);
      if (res.headersSent) {
        try {
          res.write(
            `data: ${JSON.stringify({
              error: err.message || 'Internal server error',
              isDone: true,
              finishReason: 'error',
            })}\n\n`,
          );
          res.end();
        } catch {}
      } else {
        const status = err.name === 'ZodError' ? 400 : 500;
        this.sendJson(res, status, { error: err.message || 'Internal server error', details: err.issues });
      }
    }
  }

  private sendJson(res: http.ServerResponse, status: number, data: unknown): void {
    if (res.headersSent) {
      try {
        res.end(JSON.stringify(data));
      } catch {}
      return;
    }
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  private async readJsonBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      let receivedBytes = 0;

      req.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (receivedBytes > MAX_BODY_SIZE) {
          req.destroy(new Error('Payload too large'));
          reject(new Error('Payload exceeds maximum allowed size of 250MB'));
          return;
        }
        body += chunk;
      });

      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (err) {
          reject(new Error('Malformed JSON body'));
        }
      });

      req.on('error', reject);
    });
  }
}
