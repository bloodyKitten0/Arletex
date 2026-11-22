import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  ActivityRepository,
  ApeRepository,
  MemoryRepository,
  ConversationRepository,
  MessageRepository,
  PreferenceRepository,
  MigrationRunner,
} from '@arletex/database';
import type Database from 'better-sqlite3';
import {
  ActionPermissionController,
  VerificationEngine,
  WebAgencyService,
  SafeComputerAgencyService,
  SUPPORTED_APPLICATIONS,
  ApeService,
  rootLogger,
} from '@arletex/core';
import { ExecutionStatusSchema, ActionProposal, AgencyObservation } from '@arletex/contracts';
import { AutonomousAgencyService } from '../apps/desktop/src/backend/autonomousAgencyService.js';
import { ScreenReadingService } from '../apps/desktop/src/backend/screenReadingService.js';
import { DeviceAgencyService } from '../apps/desktop/src/backend/deviceAgencyService.js';

describe('Milestone 2 — Observation and Verification (Priority II)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let activityRepo: ActivityRepository;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let apeService: ApeService;
  let permissionController: ActionPermissionController;
  let verificationEngine: VerificationEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m2-verification-'));
    dbPath = path.join(tempDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    const runner = new MigrationRunner(db, rootLogger);
    runner.run();

    activityRepo = new ActivityRepository(db);
    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    const convRepo = new ConversationRepository(db);
    const prefRepo = new PreferenceRepository(db);

    permissionController = new ActionPermissionController({
      allowedActions: [
        'desktop_take_screenshot',
        'mouse_click',
        'type_text',
        'key_press',
        'app_launch',
      ],
      autonomousAllowedActions: [
        'desktop_take_screenshot',
        'mouse_click',
        'type_text',
        'key_press',
        'app_launch',
      ],
      maxRiskForAutonomous: 'high',
      requireExplicitApprovalForHighRisk: false,
    });

    verificationEngine = new VerificationEngine(rootLogger);
    apeService = new ApeService(apeRepo, undefined, rootLogger);
  });

  afterEach(() => {
    try {
      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    vi.restoreAllMocks();
  });

  describe('3.1 — Consistent Execution and Verification Model', () => {
    it('defines and validates all 10 uncompromising execution statuses', () => {
      const statuses = [
        'planned',
        'awaiting_authorization',
        'authorized',
        'executing',
        'executed_unverified',
        'verified_successful',
        'partially_successful',
        'failed',
        'cancelled',
        'timed_out',
      ];

      for (const st of statuses) {
        expect(ExecutionStatusSchema.safeParse(st).success).toBe(true);
      }
      expect(ExecutionStatusSchema.safeParse('magical_success').success).toBe(false);
    });

    it('rejects missing observations with failed status and recoverable retry', () => {
      const action: ActionProposal = {
        id: 'act-nav-1',
        taskId: 'task-1',
        stepIndex: 0,
        type: 'web_navigate',
        rationale: 'Navigate to target URL',
        expectedOutcome: 'Page loaded with HTTP 200',
        requiresExplicitApproval: false,
        riskLevel: 'low',
        payload: { targetUrl: 'https://example.com' },
        createdAt: new Date().toISOString(),
      };

      const result = verificationEngine.verify(action, null);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.failureReason).toContain('Missing observation probe');
      expect(result.isRecoverable).toBe(true);
    });

    it('distinguishes process spawning from application window presence', () => {
      const action: ActionProposal = {
        id: 'act-app-1',
        taskId: 'task-1',
        stepIndex: 0,
        type: 'app_launch',
        rationale: 'Launch text editor',
        expectedOutcome: 'Kate editor open with visible window',
        requiresExplicitApproval: false,
        riskLevel: 'medium',
        payload: { appName: 'kate' },
        createdAt: new Date().toISOString(),
      };

      // Case A: Process spawned in process table, but window is NOT detected in window manager
      const unmappedObs: AgencyObservation = {
        id: 'obs-1',
        actionId: 'act-app-1',
        source: 'system_process',
        success: true,
        data: { pid: 48291, isRunning: true, windowFound: false },
        timestamp: new Date().toISOString(),
      };

      const unmappedResult = verificationEngine.verify(action, unmappedObs);
      expect(unmappedResult.verified).toBe(false);
      expect(unmappedResult.status).toBe('partially_successful');
      expect(unmappedResult.observedOutcome).toContain('application window was not detected');

      // Case B: Process confirmed and window confirmed visible
      const mappedObs: AgencyObservation = {
        id: 'obs-2',
        actionId: 'act-app-1',
        source: 'system_process',
        success: true,
        data: { pid: 48291, isRunning: true, windowFound: true },
        timestamp: new Date().toISOString(),
      };

      const mappedResult = verificationEngine.verify(action, mappedObs);
      expect(mappedResult.verified).toBe(true);
      expect(mappedResult.status).toBe('verified_successful');
    });

    it('distinguishes a web search query issued from completed research', () => {
      const action: ActionProposal = {
        id: 'act-search-1',
        taskId: 'task-1',
        stepIndex: 0,
        type: 'web_search',
        rationale: 'Search for quantum computing overview',
        expectedOutcome: 'Relevant candidates retrieved for study',
        requiresExplicitApproval: false,
        riskLevel: 'low',
        payload: { query: 'quantum computing overview' },
        createdAt: new Date().toISOString(),
      };

      const obsWithResults: AgencyObservation = {
        id: 'obs-search-1',
        actionId: 'act-search-1',
        source: 'browser_page',
        success: true,
        data: { candidatesEvaluated: 4 },
        timestamp: new Date().toISOString(),
      };

      const result = verificationEngine.verify(action, obsWithResults);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('verified_successful');
      expect(result.observedOutcome).toContain('Discovered 4 relevant search candidate(s)');
    });
  });

  describe('3.2 — YouTube and Video Playback Verification', () => {
    it('distinguishes a visible video element from progressing playback', () => {
      const action: ActionProposal = {
        id: 'act-play-1',
        taskId: 'task-1',
        stepIndex: 1,
        type: 'web_select_video',
        rationale: 'Verify video playback',
        expectedOutcome: 'Video player initialized and advancing playback',
        requiresExplicitApproval: false,
        riskLevel: 'low',
        payload: { candidateUrl: 'https://youtube.com/watch?v=demo' },
        createdAt: new Date().toISOString(),
      };

      // Sub-case 1: Video element present, but playback is paused / stalled
      const stalledObs: AgencyObservation = {
        id: 'obs-stalled',
        actionId: 'act-play-1',
        source: 'browser_page',
        success: true,
        data: {
          hasVideoElement: true,
          isPlaying: false,
          playbackProgressing: false,
          playbackState: 'paused',
        },
        timestamp: new Date().toISOString(),
      };

      const stalledResult = verificationEngine.verify(action, stalledObs);
      expect(stalledResult.verified).toBe(false);
      expect(stalledResult.status).toBe('partially_successful');
      expect(stalledResult.observedOutcome).toContain('playback is paused');

      // Sub-case 2: Playback progressing across multiple time observations
      const progressingObs: AgencyObservation = {
        id: 'obs-progressing',
        actionId: 'act-play-1',
        source: 'browser_page',
        success: true,
        data: {
          hasVideoElement: true,
          isPlaying: true,
          playbackProgressing: true,
          playbackState: 'playing',
        },
        timestamp: new Date().toISOString(),
      };

      const progressingResult = verificationEngine.verify(action, progressingObs);
      expect(progressingResult.verified).toBe(true);
      expect(progressingResult.status).toBe('verified_successful');
      expect(progressingResult.observedOutcome).toContain('progressing playback confirmed');
    });

    it('returns selectedCandidate: null when all candidates fail criteria without falling back to candidates[0]', () => {
      const mockBrowser: any = {
        navigate: vi.fn(),
        getPageDetails: vi.fn(),
        searchYouTube: vi.fn(),
      };
      const webAgency = new WebAgencyService(mockBrowser, rootLogger);

      const poorCandidates = [
        {
          id: 'bad-1',
          title: 'Off topic random cooking video',
          channel: 'Cooking Channel',
          url: 'https://youtube.com/watch?v=bad1',
          duration: '3:00',
        },
        {
          id: 'bad-2',
          title: 'Funny cat compilation #99',
          channel: 'CatLovers',
          url: 'https://youtube.com/watch?v=bad2',
          duration: '1:12',
        },
      ];

      const decision = webAgency.evaluateAndSelectBestVideo(
        poorCandidates,
        'Quantum mechanics wave particle duality lecture',
      );

      // Must be null, not falling back to poorCandidates[0]!
      expect(decision.selectedCandidate).toBeNull();
      expect(decision.confidence).toBe(0);
      expect(decision.rationale).toMatch(/failed quality\/topical criteria/i);
    });

    it('reports partiallySuccessful when player initialized but playback is unverified in openAndVerifyVideo', async () => {
      const mockBrowser: any = {
        navigate: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=test1234',
          title: 'Test Video',
          hasVideoElement: true,
          isPlaying: false,
          playbackProgressing: false,
          playbackState: 'paused',
          textSnippet: '',
          headings: [],
          links: [],
        }),
      };
      const webAgency = new WebAgencyService(mockBrowser, rootLogger);

      const candidate = {
        id: 'cand-1',
        title: 'Test Video',
        url: 'https://www.youtube.com/watch?v=test1234',
        channel: 'Test Channel',
      };

      const result = await webAgency.openAndVerifyVideo(candidate);
      expect(result.verified).toBe(false);
      expect(result.partiallySuccessful).toBe(true);
      expect(result.rationale).toContain('Partially successful');
      expect(result.rationale).toContain('progress unverified');
    });
  });

  describe('3.3 — Application Launching & Computer Control', () => {
    it('rejects unsupported applications not in the allowlist', async () => {
      const computerAgency = new SafeComputerAgencyService(permissionController, ':0', rootLogger);

      await expect(computerAgency.launchApp('malicious_exploit_binary', [])).rejects.toThrow(
        /Unsupported application: "malicious_exploit_binary"/,
      );
      await expect(computerAgency.launchApp('rm', ['-rf', '/'])).rejects.toThrow(
        /Unsupported application: "rm"/,
      );
    });

    it('recognizes supported applications in the allowlist', () => {
      expect(SUPPORTED_APPLICATIONS.has('google-chrome')).toBe(true);
      expect(SUPPORTED_APPLICATIONS.has('chromium')).toBe(true);
      expect(SUPPORTED_APPLICATIONS.has('steam')).toBe(true);
      expect(SUPPORTED_APPLICATIONS.has('kate')).toBe(true);
      expect(SUPPORTED_APPLICATIONS.has('spectacle')).toBe(true);
      expect(SUPPORTED_APPLICATIONS.has('dolphin')).toBe(true);
    });

    it('halts typing immediately when focus acquisition fails in ScreenReadingService.typeAndSend', async () => {
      const mockDeviceAgency: any = {
        executeDeviceAction: vi.fn(),
      };
      const screenReader = new ScreenReadingService(mockDeviceAgency, ':0', rootLogger);

      // Mock focusWindow to simulate failure to focus target window
      vi.spyOn(screenReader, 'focusWindow').mockResolvedValue(false);

      const result = await screenReader.typeAndSend('Sensitive command to send', {
        windowTitle: 'Nonexistent Application Window',
      });

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Focus acquisition failed/i);
      expect(mockDeviceAgency.executeDeviceAction).not.toHaveBeenCalled();
    });

    it('proceeds with typing when focus acquisition succeeds', async () => {
      const mockDeviceAgency: any = {
        executeDeviceAction: vi
          .fn()
          .mockResolvedValue({ success: true, message: 'Action succeeded' }),
      };
      const screenReader = new ScreenReadingService(mockDeviceAgency, ':0', rootLogger);

      vi.spyOn(screenReader, 'focusWindow').mockResolvedValue(true);

      const result = await screenReader.typeAndSend('Hello from Arle', {
        windowTitle: 'Kate',
        sendEnter: true,
      });

      expect(result.success).toBe(true);
      expect(mockDeviceAgency.executeDeviceAction).toHaveBeenCalledWith({
        action: 'type_text',
        text: 'Hello from Arle',
      });
      expect(mockDeviceAgency.executeDeviceAction).toHaveBeenCalledWith({
        action: 'key_press',
        key: 'Return',
      });
    });
  });

  describe('3.4 — Real Research Workflow in Autonomous Agency', () => {
    it('executes genuine empirical research: fetches live content, extracts headings, and records grounded provenance', async () => {
      const mockDeviceAgency: any = {};
      const autonomousAgency = new AutonomousAgencyService(
        mockDeviceAgency,
        activityRepo,
        apeRepo,
        apeService,
        memoryRepo,
        rootLogger,
      );

      // Mock global fetch returning real structured HTML
      const fakeHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Philosophy of Mind & Subjective Experience - Wikipedia</title></head>
          <body>
            <h1>Philosophy of Mind</h1>
            <h2>Dualism and Physicalism</h2>
            <p>Philosophy of mind is a branch of philosophy that investigates the nature of the mind and its relationship to the brain.</p>
            <h2>The Hard Problem of Consciousness</h2>
            <p>The hard problem of consciousness is the problem of explaining how and why sentient organisms have qualia or phenomenal experiences.</p>
          </body>
        </html>
      `;

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => fakeHtml,
      } as any);

      const topic = {
        title: 'Philosophy of Mind & Subjective Experience',
        url: 'https://en.wikipedia.org/wiki/Philosophy_of_mind',
      };

      const log = await autonomousAgency.executeAutonomousResearch(topic);

      expect(log.title).toContain('Empirical Research: Philosophy of Mind');
      expect(log.category).toBe('web_reading');

      // Verify activity in database transitioned to 'completed' with provenance
      const activities = activityRepo.list();
      const researchActivity = activities.find((a) => a.title.includes('Philosophy of Mind'));
      expect(researchActivity).toBeDefined();
      expect(researchActivity?.status).toBe('completed');
      expect(researchActivity?.progress).toBe(1.0);
      expect(researchActivity?.metadata?.provenance).toBeDefined();
      expect(researchActivity?.metadata?.provenance.sourceUrl).toBe(topic.url);
      expect(researchActivity?.metadata?.provenance.byteCount).toBeGreaterThan(0);

      // Verify episodic memory was created with grounded provenance
      const memories = memoryRepo.list({ type: 'episodic' });
      const researchMemory = memories.find((m) => m.content.includes('Philosophy of Mind'));
      expect(researchMemory).toBeDefined();
      expect(researchMemory?.tags).toContain('grounded');
      expect(researchMemory?.tags).toContain('empirical');
      expect(researchMemory?.metadata?.provenance).toBeDefined();
    });

    it('records failed research honestly and creates NO fabricated memories when retrieval fails', async () => {
      const mockDeviceAgency: any = {};
      const autonomousAgency = new AutonomousAgencyService(
        mockDeviceAgency,
        activityRepo,
        apeRepo,
        apeService,
        memoryRepo,
        rootLogger,
      );

      // Mock global fetch failing with HTTP 404
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '404 Not Found',
      } as any);

      const initialMemoriesCount = memoryRepo.list().length;

      const topic = {
        title: 'Nonexistent Research Document',
        url: 'https://example.com/nonexistent-doc',
      };

      const log = await autonomousAgency.executeAutonomousResearch(topic);

      expect(log.title).toContain('Attempted Research Failed');
      expect(log.details).toContain('HTTP 404');

      // Verify activity was recorded as cancelled/failed
      const activities = activityRepo.list();
      const failedActivity = activities.find((a) =>
        a.title.includes('Nonexistent Research Document'),
      );
      expect(failedActivity).toBeDefined();
      expect(failedActivity?.status).toBe('cancelled');
      expect(failedActivity?.metadata?.stage).toBe('retrieval_failed');

      // Crucial: NO fabricated memories created on failure!
      const finalMemoriesCount = memoryRepo.list().length;
      expect(finalMemoriesCount).toBe(initialMemoriesCount);
    });
  });
});
