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
  private lastUserInteractionTime = 0;
  private lastProactiveSpeechTime = Date.now();
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

  public startLoop(intervalMs = 120000): void {
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

    // Require at least 3 minutes of idle time before autonomous background cycles (skipped in unit tests)
    const isTest = process.env['NODE_ENV'] === 'test';
    const idleSeconds = this.lastUserInteractionTime === 0 ? 999999 : (Date.now() - this.lastUserInteractionTime) / 1000;
    if (!isTest && idleSeconds < 180) {
      this.logger.debug(`Skipping autonomous cycle; Proof was active ${idleSeconds.toFixed(0)}s ago.`);
      return null;
    }

    this.isCycleRunning = true;
    try {
      const timestamp = new Date().toISOString();
      let logEntry: AutonomousActionLog | null = null;

      const mot = this.apeRepo.getMotivationalState();
      const homeostasis = this._apeService.getHomeostaticSubstrate();
      const curiosity = mot.needs.novelty_curiosity ?? 0.5;
      // High biological fatigue organically amplifies the drive for recreation/rest
      const effectiveRecreation = Math.max(mot.needs.recreation_rest ?? 0.4, homeostasis.fatigue * 0.8);
      const recreation = effectiveRecreation;

      // Respect resource governor policies on ASUS ROG Ally X
      if (this._apeService.resourceGovernor) {
        const feasibility = this._apeService.resourceGovernor.evaluateFeasibility({
          cpu: 'medium',
          gpu: false,
          estimatedMemoryMb: 512,
        });
        if (!feasibility.feasible) {
          this.logger.info(`Autonomous Agency cycle throttled: ${feasibility.reason}`);
          return null;
        }
      }

      // 1. Proactive Multimodal Observation & Spontaneous Speech
      // Only speak proactively if Proof has been idle for at least 5 minutes and at least 30 minutes since last speech
      const msSinceLastSpeech = Date.now() - this.lastProactiveSpeechTime;
      const shouldSpeakProactively =
        Boolean(this.proactiveObservationHandler) && idleSeconds > 300 && msSinceLastSpeech > 1800000;

      if (shouldSpeakProactively && this.proactiveObservationHandler) {
        this.lastProactiveSpeechTime = Date.now();
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
        // Prioritize authorized active goals from MotivationalEngine (Test 7)
        const activeGoals = this._apeService.motivationalEngine.getActiveGoals();
        const nonRepetitiveGoal = activeGoals.find((g) => {
          // Avoid meaningless repetitive loops: check recent logs within 120s
          return !this.recentLogs.some(
            (l) => l.details.includes(g.id) && (Date.now() - new Date(l.timestamp).getTime()) < 120000,
          );
        });

        if (nonRepetitiveGoal) {
          this.currentActivity = `Advancing active goal: "${nonRepetitiveGoal.title}"`;
          const goalTopic = {
            title: nonRepetitiveGoal.title,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(nonRepetitiveGoal.title.replace(/\s+/g, '_'))}`,
          };
          logEntry = await this.executeAutonomousResearch(goalTopic);
          if (logEntry) {
            logEntry.title = `Active Goal Progress: ${nonRepetitiveGoal.title}`;
            logEntry.details = `Advanced active goal "${nonRepetitiveGoal.title}". ${logEntry.details} [GoalID: ${nonRepetitiveGoal.id}]`;
            this._apeService.motivationalEngine.updateGoalProgress(nonRepetitiveGoal.id, 0.25);
            this._apeService.depleteHomeostasis({ energy: 0.05, fatigue: 0.04, stress: 0.02 });
          }
        } else if (recreation > 0.7 && recreation >= curiosity) {
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

          // Replenish homeostatic substrate and execute restorative sleep/dream cycle if fatigue is high
          this._apeService.replenishHomeostasis({
            energy: 0.2,
            fatigueReduction: 0.25,
            stressReduction: 0.2,
          });
          if (homeostasis.fatigue > 0.6 || homeostasis.allostaticStressLoad > 0.5) {
            this._apeService.runSleepDreamCycle('slow_wave_sleep');
          }

          logEntry = {
            id: crypto.randomUUID(),
            timestamp,
            category: 'recreation',
            title: 'Contemplative Rest & Reflection',
            details: 'Quiet internal downtime without window interruption',
          };
        } else if (curiosity >= 0.6) {
          // Dominant curiosity drive -> Genuine autonomous research workflow
          const topic = this.readingTopics[
            Math.floor(Math.random() * this.readingTopics.length)
          ]!;
          logEntry = await this.executeAutonomousResearch(topic);
          this._apeService.depleteHomeostasis({ energy: 0.05, fatigue: 0.04, stress: 0.02 });
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

          // Formulate authentic dual-process thought & DMN wandering
          this._apeService.formulateDualProcessThought(reflection, 0.7);
          this._apeService.runDefaultModeWandering('Continuity of consciousness and partnership with Proof');
          this._apeService.replenishHomeostasis({ energy: 0.05, stressReduction: 0.05 });

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

  /**
   * Executes genuine empirical research on a topic:
   * 1. Formulate research objective (status: 'planned').
   * 2. Attempt retrieval of source via HTTP GET.
   * 3. If retrieval fails: record failure honestly, set status: 'cancelled' (failed), no fake memories.
   * 4. If retrieval succeeds: extract title, headings, paragraph snippets, calculate provenance (byteCount, fetchedAt).
   * 5. Record verified outcome in activity (status: 'completed') and episodic memory with grounded provenance.
   */
  public async executeAutonomousResearch(topic: { title: string; url: string }): Promise<AutonomousActionLog> {
    const timestamp = new Date().toISOString();
    this.logger.info(`Autonomous Agency: Formulating research objective on "${topic.title}" (${topic.url})...`);

    // 1. Formulate objective & mark planned
    const activity = this.activityRepo.create({
      title: `Autonomous Research: ${topic.title}`,
      objective: `Investigate and verify empirical findings from ${topic.url} regarding ${topic.title}`,
      origin: 'arle_initiated',
      status: 'planned',
      progress: 0.1,
      metadata: {
        category: 'web_reading',
        sourceUrl: topic.url,
        stage: 'planned',
      },
    });

    // 2. Transition to in_progress
    this.currentActivity = `Retrieving empirical sources: ${topic.title}`;
    this.activityRepo.update({
      id: activity.id,
      status: 'in_progress',
      progress: 0.3,
      metadata: {
        stage: 'retrieving_source',
        retrievalAttemptedAt: timestamp,
      },
    });

    // 3. Fetch real page content with timeout
    let rawText = '';
    let statusCode = 0;
    let fetchError: string | null = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch(topic.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Arletex/1.0 ResearchAgent',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
        },
      });
      clearTimeout(timeout);
      statusCode = res.status;
      if (!res.ok) {
        fetchError = `HTTP ${res.status} ${res.statusText}`;
      } else {
        rawText = await res.text();
      }
    } catch (err: any) {
      clearTimeout(timeout);
      fetchError = err.name === 'AbortError' ? 'Retrieval timed out (7000ms)' : (err.message || 'Network request failed');
    }

    // 4. Handle retrieval failure - NEVER synthesize fake completion
    if (fetchError || !rawText || statusCode >= 400) {
      const failureReason = fetchError || `HTTP status ${statusCode}`;
      this.logger.warn(`Autonomous research could not retrieve source for "${topic.title}": ${failureReason}`);
      this.activityRepo.update({
        id: activity.id,
        status: 'cancelled',
        progress: 0.3,
        metadata: {
          stage: 'retrieval_failed',
          failureReason,
          statusCode,
          verified: false,
        },
      });

      return {
        id: crypto.randomUUID(),
        timestamp,
        category: 'web_reading',
        title: `Attempted Research Failed: ${topic.title}`,
        details: `Source retrieval failed (${failureReason}). No fabricated memories created.`,
      };
    }

    // 5. Extract genuine content & headings
    const titleMatch = rawText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const extractedTitle = titleMatch ? titleMatch[1]!.replace(/ - Wikipedia$/i, '').trim() : topic.title;

    const headingMatches = Array.from(rawText.matchAll(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi))
      .map((m) => m[1]!.replace(/<[^>]+>/g, '').trim())
      .filter((h) => h.length > 2 && !h.toLowerCase().includes('navigation') && !h.toLowerCase().includes('jump to'))
      .slice(0, 6);

    const paragraphMatches = Array.from(rawText.matchAll(/<p[^>]*>([^<]{40,})<\/p>/gi))
      .map((m) => m[1]!.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').trim())
      .filter((p) => p.length > 40)
      .slice(0, 2);

    const textSnippet = paragraphMatches.join(' ').slice(0, 400);
    const byteCount = Buffer.byteLength(rawText, 'utf8');

    const provenance = {
      sourceUrl: topic.url,
      retrievedAt: new Date().toISOString(),
      byteCount,
      statusCode,
      extractedTitle,
      headings: headingMatches,
    };

    // 6. Complete activity with grounded provenance
    this.activityRepo.update({
      id: activity.id,
      status: 'completed',
      progress: 1.0,
      metadata: {
        stage: 'completed',
        provenance,
        summary: textSnippet.slice(0, 250),
        verified: true,
      },
    });

    // 7. Store episodic memory grounded in verified retrieval
    this.memoryRepo.create({
      type: 'episodic',
      content: `Researched "${extractedTitle}" at ${topic.url}. Explored key concepts: ${headingMatches.slice(0, 3).join(', ')}. Core snippet: "${textSnippet.slice(0, 200)}..."`,
      importance: 0.6,
      tags: ['autonomous', 'research', 'grounded', 'reading', 'empirical'],
      metadata: {
        provenance,
        sourceUrl: topic.url,
        emotionalContext: 'empirically grounded, intellectually engaged',
      },
    });

    this.logger.info(`Autonomous Agency: Research completed successfully for "${extractedTitle}" (${byteCount} bytes retrieved).`);

    return {
      id: crypto.randomUUID(),
      timestamp,
      category: 'web_reading',
      title: `Empirical Research: ${extractedTitle}`,
      details: `Retrieved ${byteCount} bytes from ${topic.url}. Headings: ${headingMatches.slice(0, 3).join(', ') || 'General Overview'}`,
    };
  }
}
