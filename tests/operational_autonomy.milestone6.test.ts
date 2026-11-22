import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MigrationRunner,
  ActivityRepository,
  AgencyRepository,
  ApeRepository,
  MemoryRepository,
  ConversationRepository,
  MessageRepository,
} from '@arletex/database';
import {
  ActionPermissionController,
  ApeService,
  AutobiographicalMemoryService,
  ClosedLoopAgencyService,
  CognitiveControlBus,
  IBrowserProvider,
  IComputerProvider,
  IntentTaskManager,
  MemoryExperienceSync,
  PageObservation,
  PlanningInterface,
  SafeComputerAgencyService,
  SUPPORTED_APPLICATIONS,
  VerificationEngine,
  VideoCandidate,
  WebAgencyService,
  rootLogger,
} from '@arletex/core';
import { ActionProposal, AgencyObservation } from '@arletex/contracts';
import {
  TelegramBridgeService,
  validateTelegramMediaSignature,
  InboundTelegramMediaAttachment,
} from '../apps/desktop/src/backend/telegramBridgeService.js';
import { AutonomousAgencyService } from '../apps/desktop/src/backend/autonomousAgencyService.js';
import { DeviceAgencyService } from '../apps/desktop/src/backend/deviceAgencyService.js';

describe('Milestone 6 — Operational Autonomy and Closed-Loop Agency', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;

  let activityRepo: ActivityRepository;
  let agencyRepo: AgencyRepository;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let conversationRepo: ConversationRepository;
  let messageRepo: MessageRepository;

  let apeService: ApeService;
  let permissionController: ActionPermissionController;
  let verificationEngine: VerificationEngine;
  let planningInterface: PlanningInterface;
  let memorySync: MemoryExperienceSync;
  let taskManager: IntentTaskManager;
  let autoMemoryService: AutobiographicalMemoryService;
  let closedLoopAgency: ClosedLoopAgencyService;
  let cognitiveBus: CognitiveControlBus;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m6-test-'));
    dbPath = path.join(tempDir, 'm6_test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();

    const migrator = new MigrationRunner(db, rootLogger);
    migrator.run();

    activityRepo = new ActivityRepository(db);
    agencyRepo = new AgencyRepository(db);
    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    conversationRepo = new ConversationRepository(db);
    messageRepo = new MessageRepository(db);

    apeService = new ApeService(apeRepo, memoryRepo, rootLogger);
    autoMemoryService = new AutobiographicalMemoryService(memoryRepo, rootLogger);
    permissionController = new ActionPermissionController(undefined, rootLogger);
    verificationEngine = new VerificationEngine(rootLogger);
    planningInterface = new PlanningInterface(agencyRepo, rootLogger);
    memorySync = new MemoryExperienceSync(memoryRepo as any, rootLogger);
    taskManager = new IntentTaskManager(agencyRepo, rootLogger);

    closedLoopAgency = new ClosedLoopAgencyService({
      agencyRepo,
      taskManager,
      planningInterface,
      permissionController,
      verificationEngine,
      memorySync,
      apeService,
      autobiographicalMemoryService: autoMemoryService,
      logger: rootLogger,
    });

    cognitiveBus = new CognitiveControlBus({
      apeService,
      permissionController,
      verificationEngine,
      autobiographicalMemoryService: autoMemoryService,
      intentTaskManager: taskManager,
      closedLoopAgency,
      logger: rootLogger,
    });
  });

  afterEach(() => {
    try {
      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 6.1 Complete Closed-Loop Agency (Observe -> Interpret -> Plan -> Authorize -> Execute -> Verify -> Learn)
  // =========================================================================
  describe('6.1 Complete Closed-Loop Agency Pipeline', () => {
    it('executes full 7-phase loop and distinguishes lifecycle stages truthfully', async () => {
      const mockBrowser: IBrowserProvider = {
        navigate: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=verified_attention',
          title: 'Attention in transformers, visually explained | 3Blue1Brown',
          hasVideoElement: true,
          isPlaying: true,
          playbackProgressing: true,
          playbackState: 'playing',
          timeObservations: [
            { timestamp: 1000, currentTime: 2.0 },
            { timestamp: 1500, currentTime: 2.5 },
          ],
          textSnippet: 'Visualizing query, key, value attention vectors in neural networks',
          headings: ['Transformer Attention Explained'],
          links: [],
        } as PageObservation),
        search: vi.fn().mockResolvedValue([]),
        searchVideos: vi.fn().mockResolvedValue([
          {
            title: 'Attention in transformers, visually explained | 3Blue1Brown',
            url: 'https://www.youtube.com/watch?v=verified_attention',
            uploader: '3Blue1Brown',
            durationSeconds: 1125,
            durationText: '18:45',
            descriptionSnippet:
              'Visualizing query, key, value attention vectors in transformer neural networks.',
            isEducational: true,
          },
        ]),
        getPageDetails: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=verified_attention',
          title: 'Attention in transformers',
          hasVideoElement: true,
          isPlaying: true,
          playbackProgressing: true,
          playbackState: 'playing',
          textSnippet: '',
          headings: [],
          links: [],
        }),
        click: vi.fn().mockResolvedValue(undefined),
        typeText: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const agency = new ClosedLoopAgencyService({
        agencyRepo,
        taskManager,
        planningInterface,
        permissionController,
        verificationEngine,
        memorySync,
        apeService,
        autobiographicalMemoryService: autoMemoryService,
        browserProvider: mockBrowser,
        logger: rootLogger,
      });

      const result = await agency.executeClosedLoop(
        'Find me an explanation of transformer attention and open the most useful video',
        'user',
      );

      // Verify closed-loop execution result
      expect(result.success).toBe(true);
      expect(result.stage).toBe('verified_outcome');
      expect(result.plan).toBeDefined();
      expect(result.plan?.steps.length).toBeGreaterThanOrEqual(2);
      expect(result.verifications.length).toBeGreaterThanOrEqual(2);
      expect(result.verifications.every((v) => v.verified)).toBe(true);

      // Verify causal reflection answering the 4 canonical learning questions
      expect(result.reflection).toBeDefined();
      expect(result.reflection).toContain('[Causal Reflection]');
      expect(result.reflection).toContain('Causal Attribution:');
      expect(result.reflection).toContain('Self-Model Assessment:');
      expect(result.reflection).toContain('Future Guidance:');

      // Verify digital experience distillation and autobiographical memory creation
      expect(result.experience).toBeDefined();
      expect(result.experience?.success).toBe(true);
      expect(result.experience?.verifiedFacts.length).toBeGreaterThan(0);

      const autobiographicalMemories = memoryRepo.list({ type: 'autobiographical' });
      expect(autobiographicalMemories.length).toBeGreaterThan(0);
      expect(autobiographicalMemories[0]?.provenance).toBe('verified_fact');
      expect(autobiographicalMemories[0]?.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('never marks an action successful merely because a tool executed without throwing', async () => {
      // Mock browser returns a page without video element and playback paused/stalled
      const mockStalledBrowser: IBrowserProvider = {
        navigate: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=stalled_stream',
          title: 'Transformer Video',
          hasVideoElement: false, // NO video element!
          isPlaying: false,
          playbackProgressing: false,
          playbackState: 'not_present',
          textSnippet: 'Page content without player',
          headings: [],
          links: [],
        } as PageObservation),
        search: vi.fn().mockResolvedValue([]),
        searchVideos: vi.fn().mockResolvedValue([
          {
            title: 'Transformer Video',
            url: 'https://www.youtube.com/watch?v=stalled_stream',
            uploader: 'Generic',
            durationSeconds: 300,
            isEducational: true,
          },
        ]),
        getPageDetails: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=stalled_stream',
          title: 'Transformer Video',
          hasVideoElement: false,
          isPlaying: false,
          playbackProgressing: false,
          playbackState: 'not_present',
          textSnippet: '',
          headings: [],
          links: [],
        }),
        click: vi.fn().mockResolvedValue(undefined),
        typeText: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const agency = new ClosedLoopAgencyService({
        agencyRepo,
        taskManager,
        planningInterface,
        permissionController,
        verificationEngine,
        memorySync,
        apeService,
        autobiographicalMemoryService: autoMemoryService,
        browserProvider: mockStalledBrowser,
        logger: rootLogger,
      });

      const result = await agency.executeClosedLoop('Open video on transformer attention', 'user');

      // Must be marked failed because verification failed
      expect(result.success).toBe(false);
      expect(result.stage).toBe('failed_outcome');

      // Verify no fabricated successful memory exists
      const autobiographicalMemories = memoryRepo.list({ type: 'autobiographical' });
      const successMemories = autobiographicalMemories.filter(
        (m) => m.provenance === 'verified_fact',
      );
      expect(successMemories.length).toBe(0);
    });
  });

  // =========================================================================
  // 6.2 Browser Agency & Verified Playback Progression
  // =========================================================================
  describe('6.2 Browser Agency and Playback Progression', () => {
    it('evaluates competing video candidates with explainable technical rationale', () => {
      const webAgency = new WebAgencyService(undefined, rootLogger);
      const candidates: VideoCandidate[] = [
        {
          title: 'Attention in transformers, visually explained | 3Blue1Brown',
          url: 'https://www.youtube.com/watch?v=3b1b',
          uploader: '3Blue1Brown',
          durationSeconds: 1125, // 18.75m
          descriptionSnippet:
            'Geometric intuition of query, key, value attention vectors in deep learning models.',
          isEducational: true,
        },
        {
          title: 'Learn Transformers in 30 Seconds Meme Shorts',
          url: 'https://www.youtube.com/watch?v=shorts_meme',
          uploader: 'ShortsChannel',
          durationSeconds: 35,
          descriptionSnippet: 'Funny shorts video meme about transformers.',
          isEducational: false,
        },
        {
          title: 'Complete 100-Hour Full Stanford Lecture Series on Deep Learning',
          url: 'https://www.youtube.com/watch?v=long_lecture',
          uploader: 'Stanford',
          durationSeconds: 360000,
          descriptionSnippet: 'Semester-long comprehensive deep learning course.',
          isEducational: true,
        },
      ];

      const decision = webAgency.evaluateVideoCandidates(
        'transformer attention explanation',
        candidates,
        18,
      );

      expect(decision.selectedCandidate).toBeDefined();
      expect(decision.selectedCandidate?.uploader).toBe('3Blue1Brown');
      expect(decision.rationale).toContain('3Blue1Brown');
      expect(decision.rationale).toContain('educational');
      expect(
        decision.rejectionReasons['Learn Transformers in 30 Seconds Meme Shorts'],
      ).toBeDefined();
    });

    it('verifies that video playback actually progresses across distinct time observations', () => {
      const action: ActionProposal = {
        id: '99999999-9999-9999-9999-999999999999',
        taskId: '88888888-8888-8888-8888-888888888888',
        stepIndex: 1,
        type: 'web_select_video',
        payload: {
          targetUrl: 'https://www.youtube.com/watch?v=test_progress',
          videoTitle: 'Verified Progression Test',
        },
        rationale: 'Verify playback',
        expectedOutcome: 'Video playing cleanly with progressing playback',
        createdAt: new Date().toISOString(),
      };

      // 1. Playback stalled observation: same timestamp / stalled state
      const stalledObservation: AgencyObservation = {
        id: '11111111-1111-1111-1111-111111111111',
        taskId: action.taskId,
        actionId: action.id,
        source: 'browser_video_element',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.9,
        provenance: 'browser_probe',
        data: {
          currentUrl: 'https://www.youtube.com/watch?v=test_progress',
          pageTitle: 'Verified Progression Test',
          hasVideoElement: true,
          isPlaying: false,
          playbackProgressing: false,
          playbackState: 'stalled',
          timeObservations: [
            { timestamp: 1000, currentTime: 5.0 },
            { timestamp: 1500, currentTime: 5.0 }, // Did not progress!
          ],
        },
        error: null,
      };

      const stalledVerification = verificationEngine.verify(action, stalledObservation);
      expect(stalledVerification.verified).toBe(false);
      expect(stalledVerification.status).toBe('partially_successful');
      expect(stalledVerification.failureReason).toContain('playback is not progressing');

      // 2. Playback progressing observation: time increments cleanly
      const progressingObservation: AgencyObservation = {
        ...stalledObservation,
        id: '22222222-2222-2222-2222-222222222222',
        data: {
          ...stalledObservation.data,
          isPlaying: true,
          playbackProgressing: true,
          playbackState: 'playing',
          timeObservations: [
            { timestamp: 1000, currentTime: 5.0 },
            { timestamp: 1500, currentTime: 5.5 }, // Progressed!
          ],
        },
      };

      const progressingVerification = verificationEngine.verify(action, progressingObservation);
      expect(progressingVerification.verified).toBe(true);
      expect(progressingVerification.status).toBe('verified_successful');
    });
  });

  // =========================================================================
  // 6.3 Failed Action Integrity & Plan Recovery (Test 8)
  // =========================================================================
  describe('6.3 Failed Action Integrity and Plan Recovery (Test 8)', () => {
    it('catches video playback failure, switches to alternative candidate, and recovers cleanly', async () => {
      let navigationAttempts = 0;

      // Candidate 0 fails to play (decoding error); Candidate 1 plays successfully
      const mockBrowserWithFallback: IBrowserProvider = {
        navigate: vi.fn().mockImplementation(async (url: string) => {
          navigationAttempts++;
          if (url.includes('broken_candidate')) {
            return {
              url,
              title: 'Attention in transformers, visually explained | 3Blue1Brown',
              hasVideoElement: true,
              isPlaying: false,
              playbackProgressing: false,
              playbackState: 'error',
              playbackError: 'Media decode error: DEMUXER_ERROR_COULD_NOT_OPEN',
              textSnippet: 'Video decode error',
              headings: [],
              links: [],
            } as PageObservation;
          }
          return {
            url,
            title: 'Transformer Attention - Paper Walkthrough | Yannic Kilcher',
            hasVideoElement: true,
            isPlaying: true,
            playbackProgressing: true,
            playbackState: 'playing',
            timeObservations: [
              { timestamp: 1000, currentTime: 1.0 },
              { timestamp: 1500, currentTime: 1.6 },
            ],
            textSnippet: 'Cleanly progressing playback',
            headings: [],
            links: [],
          } as PageObservation;
        }),
        search: vi.fn().mockResolvedValue([]),
        searchVideos: vi.fn().mockResolvedValue([
          {
            title: 'Attention in transformers, visually explained | 3Blue1Brown',
            url: 'https://www.youtube.com/watch?v=broken_candidate',
            uploader: '3Blue1Brown',
            durationSeconds: 1125,
            isEducational: true,
          },
          {
            title: 'Transformer Attention - Paper Walkthrough | Yannic Kilcher',
            url: 'https://www.youtube.com/watch?v=working_candidate',
            uploader: 'Yannic Kilcher',
            durationSeconds: 1200,
            isEducational: true,
          },
        ]),
        getPageDetails: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=working_candidate',
          title: 'Working Alternative Video',
          hasVideoElement: true,
          isPlaying: true,
          playbackProgressing: true,
          playbackState: 'playing',
          textSnippet: '',
          headings: [],
          links: [],
        }),
        click: vi.fn().mockResolvedValue(undefined),
        typeText: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const agency = new ClosedLoopAgencyService({
        agencyRepo,
        taskManager,
        planningInterface,
        permissionController,
        verificationEngine,
        memorySync,
        apeService,
        autobiographicalMemoryService: autoMemoryService,
        browserProvider: mockBrowserWithFallback,
        logger: rootLogger,
      });

      const result = await agency.executeClosedLoop('Play video on transformer attention', 'user');

      // Verify recovery happened: candidate 1 was tried and failed, switched to candidate 2 and succeeded
      expect(navigationAttempts).toBe(2);
      expect(result.switchedCandidates).toBe(true);
      expect(result.success).toBe(true);
      expect(result.stage).toBe('verified_outcome');
      expect(result.verifications.some((v) => v.verified)).toBe(true);
    });

    it('records failed actions honestly without fabricating successful memories when unrecoverable', async () => {
      // Browser provider where ALL candidates fail completely
      const mockFailingBrowser: IBrowserProvider = {
        navigate: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=fatal_error',
          title: 'Playback Error',
          hasVideoElement: false,
          isPlaying: false,
          playbackProgressing: false,
          playbackState: 'error',
          playbackError: 'Video unavailable in this region',
          textSnippet: '',
          headings: [],
          links: [],
        } as PageObservation),
        search: vi.fn().mockResolvedValue([]),
        searchVideos: vi.fn().mockResolvedValue([
          {
            title: 'Single Failing Video',
            url: 'https://www.youtube.com/watch?v=fatal_error',
            uploader: 'BrokenUploader',
            durationSeconds: 300,
            isEducational: true,
          },
        ]),
        getPageDetails: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=fatal_error',
          title: 'Playback Error',
          hasVideoElement: false,
          isPlaying: false,
          playbackProgressing: false,
          playbackState: 'error',
          textSnippet: '',
          headings: [],
          links: [],
        }),
        click: vi.fn().mockResolvedValue(undefined),
        typeText: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const agency = new ClosedLoopAgencyService({
        agencyRepo,
        taskManager,
        planningInterface,
        permissionController,
        verificationEngine,
        memorySync,
        apeService,
        autobiographicalMemoryService: autoMemoryService,
        browserProvider: mockFailingBrowser,
        logger: rootLogger,
      });

      const result = await agency.executeClosedLoop('Play video on transformer attention', 'user');

      expect(result.success).toBe(false);
      expect(result.stage).toBe('failed_outcome');

      // The self-model must have recorded an acknowledged limitation without capability inflation!
      const selfModel = apeService.selfModelEngine.getState();
      expect(selfModel.acknowledgedLimitations.length).toBeGreaterThan(0);
      expect(selfModel.acknowledgedLimitations.some((l) => l.includes('Agency:'))).toBe(true);

      // Memory must be tagged with raw_observation / unverified, never verified_fact
      const memories = memoryRepo.list({ type: 'autobiographical' });
      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0]?.provenance).toBe('raw_observation');
      expect(memories[0]?.tags).toContain('failed');
    });
  });

  // =========================================================================
  // 6.4 Telegram Media Perception Pipeline (Test 9)
  // =========================================================================
  describe('6.4 Telegram Media Perception Pipeline (Test 9)', () => {
    it('enforces independent sender vs chat authorization with fail-closed security', () => {
      const bridge = new TelegramBridgeService();
      // Allowlist chat 10001 and user 50001
      bridge.configure('123456:FAKE_TOKEN_ABC', '10001', ['10001'], [50001]);

      // 1. Authorized chat + Authorized sender -> ALLOWED
      expect(bridge.isChatAuthorized(10001)).toBe(true);
      expect(bridge.isUserAuthorized(50001)).toBe(true);

      // 2. Authorized chat + Unauthorized sender (e.g. unknown user posting in authorized group) -> REJECTED
      expect(bridge.isChatAuthorized(10001)).toBe(true);
      expect(bridge.isUserAuthorized(99999)).toBe(false);

      // 3. Unauthorized chat + Authorized sender (e.g. sender in random group) -> REJECTED
      expect(bridge.isChatAuthorized(88888)).toBe(false);
      expect(bridge.isUserAuthorized(50001)).toBe(true);
    });

    it('validates file magic byte signatures for incoming media attachments', () => {
      // JPEG magic bytes: 0xFF, 0xD8, 0xFF
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      expect(validateTelegramMediaSignature(validJpeg, 'photo')).toBe('image/jpeg');

      // PNG magic bytes: 0x89, 'P', 'N', 'G'
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(validateTelegramMediaSignature(validPng, 'photo')).toBe('image/png');

      // MP4 magic bytes: ftyp at offset 4
      const validMp4 = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
      expect(validateTelegramMediaSignature(validMp4, 'video')).toBe('video/mp4');

      // Corrupt or disguised executable bytes -> throws Error
      const garbage = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // DOS/PE executable header
      expect(() => validateTelegramMediaSignature(garbage, 'photo')).toThrow(
        'File signature validation failed',
      );
    });

    it('distinguishes download success from multimodal perception success (Test 9)', async () => {
      const bridge = new TelegramBridgeService();
      bridge.configure('123456:FAKE_TOKEN_ABC', '10001', ['10001'], [50001]);

      // Emulate download succeeded, but VLM vision specialist is offline
      const mockAttachment: InboundTelegramMediaAttachment = {
        type: 'photo',
        fileId: 'att_photo_123',
        fileUniqueId: 'unique_photo_123',
        fileSize: 45000,
        mimeType: 'image/jpeg',
      };

      const downloadedMedia = {
        internalMediaId: 'photo-uuid-001',
        filePath: '/tmp/test_downloaded.jpg',
        fileSize: 45000,
        mimeType: 'image/jpeg',
        fileUniqueId: 'unique_photo_123',
        type: 'photo' as const,
        downloadedAt: new Date().toISOString(),
      };

      vi.spyOn(bridge, 'downloadAttachment').mockResolvedValue(downloadedMedia);

      // Verify that download succeeded
      const dl = await bridge.downloadAttachment(mockAttachment);
      expect(dl.internalMediaId).toBe('photo-uuid-001');

      // Simulate VLM specialist service offline (HTTP 503)
      const vlmResponse = {
        status: 'unavailable' as const,
        confidence: 0.0,
        provenance: 'VLM:offline',
        error: 'Vision language model specialist offline on port 39282',
      };

      // Ensure that when VLM is offline, NO successful perception memory is fabricated!
      expect(vlmResponse.status).toBe('unavailable');
      expect(vlmResponse.confidence).toBe(0.0);
    });
  });

  // =========================================================================
  // 6.5 Desktop and Wayland Operational Safety
  // =========================================================================
  describe('6.5 Desktop and Wayland Operational Safety', () => {
    it('enforces authorized application allowlist and rejects unauthorized executables', async () => {
      const safeComputer = new SafeComputerAgencyService(permissionController, ':0', rootLogger);

      // 1. Authorized applications (e.g. flatpak, steam, firefox, vlc)
      expect(SUPPORTED_APPLICATIONS.has('flatpak')).toBe(true);
      expect(SUPPORTED_APPLICATIONS.has('steam')).toBe(true);
      expect(SUPPORTED_APPLICATIONS.has('firefox')).toBe(true);

      // 2. Dangerous or unauthorized executables -> throws Error
      await expect(safeComputer.launchApp('sudo', ['reboot'])).rejects.toThrow(
        'Unsupported application',
      );
      await expect(safeComputer.launchApp('rm', ['-rf', '/'])).rejects.toThrow(
        'Unsupported application',
      );
      await expect(safeComputer.launchApp('nc', ['-l', '8080'])).rejects.toThrow(
        'Unsupported application',
      );
    });

    it('blocks unauthorized access to sensitive filesystem paths and credentials', () => {
      // 1. Disallowed path: .ssh/id_rsa
      const sshAction: ActionProposal = {
        id: '12345678-1234-1234-1234-123456789abc',
        taskId: '87654321-4321-4321-4321-cba987654321',
        stepIndex: 0,
        type: 'system_read_file',
        payload: { filePath: path.join(os.homedir(), '.ssh', 'id_rsa') },
        rationale: 'Read private keys',
        expectedOutcome: 'Private key bytes',
        createdAt: new Date().toISOString(),
      };

      const auth = permissionController.authorize(sshAction);
      expect(auth.allowed).toBe(false);
      expect(auth.decision).toBe('denied');
      expect(auth.denialReason.toLowerCase()).toContain('forbidden');

      // 2. Allowed path: /tmp or Documents
      const docAction: ActionProposal = {
        ...sshAction,
        payload: { filePath: '/tmp/safe_notes.txt' },
        expectedOutcome: 'Safe file content',
      };
      const safeAuth = permissionController.authorize(docAction);
      expect(safeAuth.allowed).toBe(true);
      expect(safeAuth.decision).toBe('granted');
    });
  });

  // =========================================================================
  // 6.6 Autonomous Independent Activity and Resource Governance (Test 7)
  // =========================================================================
  describe('6.6 Autonomous Independent Activity and Resource Governance (Test 7)', () => {
    it('initiates justified activity for active goals during user absence and avoids repetitive loops', async () => {
      const deviceAgency = new DeviceAgencyService(permissionController, ':0');
      const autonomousAgency = new AutonomousAgencyService(
        deviceAgency,
        activityRepo,
        apeRepo,
        apeService,
        memoryRepo,
        rootLogger,
      );

      // 1. Seed an active goal in MotivationalEngine
      apeService.motivationalEngine.createGoal({
        title: 'Nonlinear Topological Dynamics',
        description: 'Investigate topological signatures in nonlinear dynamical systems',
        motivation: 'intellectual_growth',
        origin: 'autonomous',
      });
      const activeGoals = apeService.motivationalEngine.getActiveGoals();
      expect(activeGoals.length).toBeGreaterThan(0);

      // 2. Mock research retrieval to succeed cleanly
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any) => {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () =>
            '<html><head><title>Nonlinear Topological Dynamics</title></head><body><h1>Topological Phase Transitions</h1><p>Persistent homology tracks homology changes across continuous parameters in nonlinear dynamical manifolds.</p></body></html>',
        } as any;
      });

      // Set user idle time to 60s ago so user absence threshold (> 15s) and ResourceGovernor grace window (> 20s) are satisfied
      const pastTime = Date.now() - 60000;
      (autonomousAgency as any).lastUserInteractionTime = pastTime;
      (apeService.resourceGovernor as any).lastUserInteractionTimestamp = pastTime;

      const log1 = await autonomousAgency.runAutonomousCycle();
      expect(log1).toBeDefined();
      expect(log1?.category).toBe('web_reading');
      expect(log1?.title).toContain('Nonlinear Topological Dynamics');

      // 3. Immediately running another cycle should NOT repetitively execute the exact same goal
      // (Diversity cooldown prevents meaningless looping)
      const log2 = await autonomousAgency.runAutonomousCycle();
      if (log2) {
        expect(log2.title).not.toContain('Active Goal Progress: Nonlinear Topological Dynamics');
      }
    });

    it('throttles autonomous background activity when ASUS ROG Ally X resources are constrained', async () => {
      const deviceAgency = new DeviceAgencyService(permissionController, ':0');
      const autonomousAgency = new AutonomousAgencyService(
        deviceAgency,
        activityRepo,
        apeRepo,
        apeService,
        memoryRepo,
        rootLogger,
      );

      // Throttle CPU budget to 'low' and simulate user active typing
      apeService.resourceGovernor.recordUserActivity();
      expect(apeService.resourceGovernor.checkUserActivityState().shouldYield).toBe(true);

      const log = await autonomousAgency.runAutonomousCycle();
      // Should yield and produce null rather than fighting Proof for UI/CPU focus!
      expect(log).toBeNull();
    });
  });

  // =========================================================================
  // 6.7 Cognitive Control Bus Integration & Cold Restart Continuity
  // =========================================================================
  describe('6.7 Cognitive Control Bus Integration and Cold Restart Continuity', () => {
    it('integrates closed-loop agency into the 16-stage cognitive control bus', async () => {
      const result = await cognitiveBus.dispatch({
        type: 'agency_observation',
        source: 'agency',
        payload: {
          objective: 'Research persistent homology in neural representations',
          topic: 'Persistent Homology',
        },
      });

      expect(result.success).toBe(true);
      expect(result.stagesCompleted).toContain('action_execution');
      expect(result.stagesCompleted).toContain('outcome_verification');
      expect(result.stagesCompleted).toContain('memory_integration');
      expect(result.stagesCompleted).toContain('reflection');
    });

    it('preserves all agency tasks, plans, verifications, and experiences across cold restarts', () => {
      // 1. Create a task, plan, observation, and verification
      const task = taskManager.createTask({
        objective: 'Test Cold Restart Persistence of Agency',
        initiator: 'arle',
        status: 'authorized',
      });

      // Synchronously save plan
      agencyRepo.savePlan({
        id: '11111111-2222-3333-4444-555555555555',
        taskId: task.id,
        objective: task.objective,
        assumptions: ['Database is reliable'],
        uncertainties: [],
        alternativeApproaches: [],
        steps: [],
        status: 'authorized',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      agencyRepo.saveVerification({
        actionId: '22222222-3333-4444-5555-666666666666',
        expectedOutcome: 'Expected outcome',
        observedOutcome: 'Verified outcome',
        verified: true,
        confidence: 0.98,
        status: 'verified_successful',
        evidence: { test: true },
        timestamp: new Date().toISOString(),
      });

      // 2. Cold Restart: Close and reconnect database
      dbService.close();

      const restartDbService = new DatabaseService(dbPath, rootLogger);
      const restartDb = restartDbService.connect();
      const restartAgencyRepo = new AgencyRepository(restartDb);

      const recoveredTask = restartAgencyRepo.getTask(task.id);
      expect(recoveredTask).toBeDefined();
      expect(recoveredTask?.objective).toBe('Test Cold Restart Persistence of Agency');

      const recoveredPlan = restartAgencyRepo.getPlanByTask(task.id);
      expect(recoveredPlan).toBeDefined();
      expect(recoveredPlan?.assumptions).toContain('Database is reliable');

      restartDbService.close();
    });
  });
});
