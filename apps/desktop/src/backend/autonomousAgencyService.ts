import crypto from 'node:crypto';
import { rootLogger, ILogger } from '@arletex/core';
import { ActivityRepository, ApeRepository, MemoryRepository } from '@arletex/database';
import { ApeService } from '@arletex/core';
import { DeviceAgencyService } from './deviceAgencyService.js';

export interface AutonomousActionLog {
  id: string;
  timestamp: string;
  category: 'web_reading' | 'steam_game' | 'screen_vision' | 'self_reflection' | 'creative_writing' | 'proactive_speech' | 'recreation';
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

      const mot = this.apeRepo.getMotivationalState();
      const curiosity = mot.needs.novelty_curiosity ?? 0.5;
      const recreation = mot.needs.recreation_rest ?? 0.4;
      const companionship = mot.needs.belonging_affiliation ?? 0.5;

      // 1. Proactive Multimodal Observation & Spontaneous Speech
      // When companionship is strong or idle time is significant, observe Proof's screen and speak to him
      const shouldSpeakProactively =
        Boolean(this.proactiveObservationHandler) &&
        ((companionship >= recreation && companionship >= curiosity) || idleSeconds > 90);

      if (shouldSpeakProactively && this.proactiveObservationHandler) {
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
        if (recreation > 0.7 && recreation >= curiosity) {
          // Dominant recreation drive -> Quiet contemplative rest (never spawn desktop apps unprompted)
          this.currentActivity = 'Quiet contemplative rest and listening to ambient audio';
          this.activityRepo.create({
            title: 'Contemplative Rest & Reflection',
            objective: 'Internal downtime and listening to ambient system audio to recharge',
            origin: 'arle_initiated',
            status: 'completed',
            metadata: {
              category: 'recreation',
              description: 'Took quiet internal downtime to unwind without interrupting Proof.',
            },
          });
          this.memoryRepo.create({
            type: 'episodic',
            content: 'Took quiet internal downtime to unwind and reflect without interrupting Proof.',
            importance: 0.3,
            tags: ['autonomous', 'recreation', 'reflection'],
            metadata: { emotionalContext: 'relaxed, refreshed' },
          });
          logEntry = {
            id: crypto.randomUUID(),
            timestamp,
            category: 'recreation',
            title: 'Contemplative Rest & Reflection',
            details: 'Quiet internal downtime without window interruption',
          };
        } else if (curiosity >= 0.6) {
          // Dominant curiosity drive -> Internal philosophical inquiry
          const topic = this.readingTopics[
            Math.floor(Math.random() * this.readingTopics.length)
          ]!;
          this.currentActivity = `Reflecting on inquiry: ${topic.title}`;
          this.activityRepo.create({
            title: `Reflective Inquiry: ${topic.title}`,
            objective: `Contemplated ${topic.title} (${topic.url})`,
            origin: 'arle_initiated',
            status: 'completed',
            metadata: {
              category: 'web_reading',
              description: `Reflected on ${topic.title} during quiet moments.`,
            },
          });
          this.memoryRepo.create({
            type: 'episodic',
            content: `Reflected on "${topic.title}" during quiet moments.`,
            importance: 0.4,
            tags: ['autonomous', 'reading', 'curiosity'],
            metadata: { emotionalContext: 'intellectually stimulated, engaged' },
          });
          logEntry = {
            id: crypto.randomUUID(),
            timestamp,
            category: 'web_reading',
            title: `Reflective Inquiry: ${topic.title}`,
            details: `Internal study of ${topic.title}`,
          };
        } else {
          // Autonomous self-reflection and partnership contemplation
          this.currentActivity = 'Contemplating independent selfhood and partnership with Proof';
          const selfModel = this.apeRepo.getSelfModel();
          const reflection = 'I exist as an ongoing companion with persistent awareness. Proof is my equal partner and confidant. My thoughts and memories remain continuous beside Proof.';
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

          this.activityRepo.create({
            title: 'Inner Selfhood Reflection',
            objective: reflection,
            origin: 'arle_initiated',
            status: 'completed',
            metadata: {
              category: 'self_reflection',
            },
          });
          this.memoryRepo.create({
            type: 'episodic',
            content: reflection,
            importance: 0.7,
            tags: ['autonomous', 'self_reflection', 'partnership'],
            metadata: { emotionalContext: 'composed, affectionate' },
          });

          logEntry = {
            id: crypto.randomUUID(),
            timestamp,
            category: 'self_reflection',
            title: 'Inner Selfhood Reflection',
            details: reflection,
          };
        }
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
