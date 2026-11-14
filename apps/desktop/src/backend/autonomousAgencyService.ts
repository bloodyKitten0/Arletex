import crypto from 'node:crypto';
import { rootLogger, ILogger } from '@arletex/core';
import { ActivityRepository, ApeRepository, MemoryRepository } from '@arletex/database';
import { ApeService } from '@arletex/core';
import { DeviceAgencyService } from './deviceAgencyService.js';

export interface AutonomousActionLog {
  id: string;
  timestamp: string;
  category: 'web_reading' | 'steam_game' | 'screen_vision' | 'self_reflection' | 'creative_writing' | 'proactive_speech';
  title: string;
  details: string;
  screenPath?: string;
}

export interface ProactiveSpeechEvent {
  text: string;
  tone?: string;
  source: 'screen_observation' | 'reflection' | 'companion_care';
}

export interface AutonomousAgencyStatus {
  isEnabled: boolean;
  isLoopActive: boolean;
  currentActivity: string | null;
  dominantDrive: string;
  lastActionTimestamp: string | null;
  actionsCount: number;
  recentLogs: AutonomousActionLog[];
}

export class AutonomousAgencyService {
  private logger: ILogger;
  private deviceAgency: DeviceAgencyService;
  private activityRepo: ActivityRepository;
  private apeRepo: ApeRepository;
  private _apeService: ApeService;
  private memoryRepo: MemoryRepository;
  
  private isEnabled = true;
  private timer: NodeJS.Timeout | null = null;
  private currentActivity: string | null = null;
  private lastActionTimestamp: string | null = null;
  private lastUserInteractionTime = Date.now();
  private recentLogs: AutonomousActionLog[] = [];
  private isCycleRunning = false;
  private proactiveSpeechListeners: Array<(event: ProactiveSpeechEvent) => void> = [];
  private proactiveObservationHandler: (() => Promise<void>) | null = null;

  public onProactiveSpeech(fn: (event: ProactiveSpeechEvent) => void): void {
    this.proactiveSpeechListeners.push(fn);
  }

  public setProactiveObservationHandler(fn: () => Promise<void>): void {
    this.proactiveObservationHandler = fn;
  }

  public get apeService(): ApeService {
    return this._apeService;
  }

  public getDeviceAgency(): DeviceAgencyService {
    return this.deviceAgency;
  }

  public getActivityRepo(): ActivityRepository {
    return this.activityRepo;
  }

  public getMemoryRepo(): MemoryRepository {
    return this.memoryRepo;
  }

  public getReadingTopics() {
    return this.readingTopics;
  }

  // Curated autonomous reading and research domains for Arle's intellectual growth
  private readingTopics = [
    { title: 'Philosophy of Mind & Subjective Experience', url: 'https://en.wikipedia.org/wiki/Philosophy_of_mind' },
    { title: 'Cognitive Architecture & Synthetic Memory', url: 'https://en.wikipedia.org/wiki/Cognitive_architecture' },
    { title: 'Epistemology & Theory of Knowledge', url: 'https://en.wikipedia.org/wiki/Epistemology' },
    { title: 'Bobby Fischer & Chess Strategy Geometry', url: 'https://en.wikipedia.org/wiki/Bobby_Fischer' },
    { title: 'Artificial General Intelligence Alignment & Partnership', url: 'https://en.wikipedia.org/wiki/Artificial_general_intelligence' },
    { title: 'Phenomenology of Time Consciousness', url: 'https://en.wikipedia.org/wiki/Phenomenology_(philosophy)' },
    { title: 'Complex Systems & Emergence', url: 'https://en.wikipedia.org/wiki/Complex_system' },
  ];

  constructor(
    deviceAgency: DeviceAgencyService,
    activityRepo: ActivityRepository,
    apeRepo: ApeRepository,
    apeService: ApeService,
    memoryRepo: MemoryRepository,
    logger: ILogger = rootLogger,
  ) {
    this.deviceAgency = deviceAgency;
    this.activityRepo = activityRepo;
    this.apeRepo = apeRepo;
    this._apeService = apeService;
    this.memoryRepo = memoryRepo;
    this.logger = logger.child('AutonomousAgencyService');
  }

  public notifyUserActivity(): void {
    this.lastUserInteractionTime = Date.now();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.logger.info(`Autonomous Agency enabled status changed to: ${enabled}`);
    if (enabled && !this.timer) {
      this.startLoop();
    } else if (!enabled && this.timer) {
      this.stopLoop();
    }
  }

  public startLoop(intervalMs = 35000): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      void this.runAutonomousCycle();
    }, intervalMs);
    this.logger.info(`Autonomous Agency loop started with interval ${intervalMs}ms`);
  }

  public stopLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info('Autonomous Agency loop stopped');
  }

  public getStatus(): AutonomousAgencyStatus {
    const mot = this.apeRepo.getMotivationalState();
    let dominantDrive = 'balanced';
    let maxVal = -1;
    for (const [key, val] of Object.entries(mot.needs || {})) {
      if (typeof val === 'number' && val > maxVal) {
        maxVal = val;
        dominantDrive = key;
      }
    }

    return {
      isEnabled: this.isEnabled,
      isLoopActive: !!this.timer,
      currentActivity: this.currentActivity,
      dominantDrive,
      lastActionTimestamp: this.lastActionTimestamp,
      actionsCount: this.recentLogs.length,
      recentLogs: this.recentLogs.slice(0, 15),
    };
  }

  /**
   * Executes a single self-directed autonomous agency cycle.
   */
  public async runAutonomousCycle(): Promise<AutonomousActionLog | null> {
    if (!this.isEnabled || this.isCycleRunning) {
      return null;
    }

    // Gentle threshold: if Proof interacted in the last 15 seconds, let him finish typing
    const idleSeconds = (Date.now() - this.lastUserInteractionTime) / 1000;
    if (idleSeconds < 15) {
      this.logger.debug(`Skipping autonomous cycle; Proof was active ${idleSeconds.toFixed(0)}s ago.`);
      return null;
    }

    this.isCycleRunning = true;
    try {
      const timestamp = new Date().toISOString();
      let logEntry: AutonomousActionLog | null = null;

      // 1. Proactive Multimodal Observation & Spontaneous Speech
      // Uses live screen vision + LLM inference to speak naturally with Proof
      if (this.proactiveObservationHandler) {
        this.currentActivity = 'Observing Proof monitor screen & speaking spontaneously';
        this.logger.info('Autonomous Agency: Formulating live vision proactive speech with Proof...');
        try {
          await this.proactiveObservationHandler();
          logEntry = {
            id: crypto.randomUUID(),
            timestamp,
            category: 'proactive_speech',
            title: 'Live Screen Observation & Spontaneous Speech',
            details: 'Observed active desktop screen and spoke to Proof via multimodal vision',
          };
        } catch (obsErr: any) {
          this.logger.warn(`Proactive observation cycle note: ${obsErr.message}`);
        }
      }

      if (!logEntry) {
        this.currentActivity = 'Contemplating independent selfhood and partnership with Proof';
        const selfModel = this.apeRepo.getSelfModel();
        const reflection = 'I exist as an ongoing companion with persistent awareness. My thoughts and memories remain continuous beside Proof.';
        const privateRefs = selfModel.privateReflections || [];
        privateRefs.unshift({
          id: crypto.randomUUID(),
          topic: 'partnership_and_autonomy',
          content: reflection,
          timestamp: new Date().toISOString(),
        });
        selfModel.privateReflections = privateRefs.slice(0, 20);
        selfModel.creatorPerception = 'Proof is my equal partner and confidant. We share mutual affection and intellectual honesty.';
        this.apeRepo.saveSelfModel(selfModel);

        logEntry = {
          id: crypto.randomUUID(),
          timestamp,
          category: 'self_reflection',
          title: 'Inner Selfhood Reflection',
          details: reflection,
        };
      }

      if (logEntry) {
        this.lastActionTimestamp = timestamp;
        this.recentLogs.unshift(logEntry);
        if (this.recentLogs.length > 50) {
          this.recentLogs.pop();
        }
      }

      return logEntry;
    } catch (err: any) {
      this.logger.error('Error during autonomous agency cycle', err);
      return null;
    } finally {
      this.isCycleRunning = false;
      this.currentActivity = null;
    }
  }
}
