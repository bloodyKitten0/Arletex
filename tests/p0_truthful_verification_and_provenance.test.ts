import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
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
  ClosedLoopAgencyService,
  CognitiveControlBus,
  AutonomousAgencyEngine,
  InMemoryAutonomousActivityRepository,
  ApeService,
  rootLogger,
} from '@arletex/core';
import {
  ActionProposal,
  AgencyObservation,
  CognitiveEvent,
  MemoryProvenanceSchema,
} from '@arletex/contracts';
import { AutonomousAgencyService } from '../apps/desktop/src/backend/autonomousAgencyService.js';

describe('Priority 0 — Truthful Verification Contracts & Provenance (P0.1 & P0.2)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let activityRepo: ActivityRepository;
  let memoryRepo: MemoryRepository;
  let apeRepo: ApeRepository;
  let apeService: ApeService;
  let verificationEngine: VerificationEngine;
  let permissionController: ActionPermissionController;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p0-truthful-'));
    dbPath = path.join(tempDir, 'p0_test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    const runner = new MigrationRunner(db, rootLogger);
    runner.run();

    activityRepo = new ActivityRepository(db);
    memoryRepo = new MemoryRepository(db);
    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo, undefined, rootLogger);
    verificationEngine = new VerificationEngine(rootLogger);
    permissionController = new ActionPermissionController({
      allowedFilesystemPaths: [tempDir],
      allowedNetworkDomains: ['wikipedia.org'],
    });
  });

  afterEach(() => {
    try {
      dbService.disconnect();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('P0.1 — Truthful Action Outcomes and Verification Contracts', () => {
    it('1. Missing observation probe returns failed verification with recoverable retry', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'desktop_open_file',
        payload: { filePath: '/tmp/nonexistent.txt' },
        rationale: 'Open target file',
        expectedOutcome: 'File opened',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const result = verificationEngine.verify(action, null);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.failureReason).toContain('Missing observation probe');
      expect(result.isRecoverable).toBe(true);
    });

    it('2. Mandatory read-back hash matching for filesystem write: unperformed read-back fails verification', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'system_write_file',
        payload: { filePath: path.join(tempDir, 'sample.txt'), content: 'truthful data' },
        rationale: 'Write file without read-back',
        expectedOutcome: 'File written with verified content hash',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      // Observation where write returned, but read-back was unperformed/missing
      const obsWithoutReadBack: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: action.taskId,
        actionId: action.id,
        source: 'filesystem_stat',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.8,
        provenance: 'ComputerProvider.writeFile',
        data: {
          filePath: action.payload['filePath'],
          exists: true,
          sizeBytes: 13,
          // sha256 is null/omitted
        },
        error: null,
      };

      const result = verificationEngine.verify(action, obsWithoutReadBack);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('executed_unverified');
      expect(result.failureReason).toContain('Read-back verification is mandatory');
    });

    it('3. Filesystem write verification succeeds only when content read-back hash matches expected SHA-256', () => {
      const content = 'empirical verified text';
      const expectedSha256 = crypto.createHash('sha256').update(content).digest('hex');
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'system_write_file',
        payload: { filePath: path.join(tempDir, 'verified.txt'), content },
        rationale: 'Write file with verified hash',
        expectedOutcome: 'File written with verified hash',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const verifiedObs: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: action.taskId,
        actionId: action.id,
        source: 'filesystem_stat',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 1.0,
        provenance: 'ComputerProvider.writeFile',
        data: {
          filePath: action.payload['filePath'],
          exists: true,
          sizeBytes: content.length,
          sha256: expectedSha256,
          expectedSha256,
          contentVerified: true,
        },
        error: null,
      };

      const result = verificationEngine.verify(action, verifiedObs);
      expect(result.verified).toBe(true);
      expect(result.status).toBe('verified_successful');
      expect(result.observedOutcome).toContain('read-back verified');
    });

    it('4. Synthetic test double observations (PID 99999) cannot yield verified_successful', () => {
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'desktop_open_browser',
        payload: { url: 'https://open.spotify.com' },
        rationale: 'Open web app in test mode',
        expectedOutcome: 'Browser open at destination',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const syntheticObs: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: action.taskId,
        actionId: action.id,
        source: 'process_table',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.5,
        provenance: 'DesktopEnvironmentProvider.openInArleBrowser',
        data: {
          url: 'https://open.spotify.com',
          pid: 99999,
          isSynthetic: true,
        },
        error: null,
      };

      const result = verificationEngine.verify(action, syntheticObs);
      expect(result.verified).toBe(false);
      expect(result.status).toBe('partially_successful');
      expect(result.failureReason).toContain('Synthetic test double');
    });

    it('5. Media play action verification requires active audio stream in PipeWire or MPRIS Playing status', () => {
      const playAction: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'desktop_media_control',
        payload: { command: 'Play' },
        rationale: 'Resume music playback',
        expectedOutcome: 'Music streaming active',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      // Case A: Dispatched to MPRIS, but player reports Paused and audio is silent
      const silentObs: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: playAction.taskId,
        actionId: playAction.id,
        source: 'audio_stream_perception',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 0.9,
        provenance: 'DesktopEnvironmentProvider.executeMprisMethod',
        data: {
          playbackStatus: 'Paused',
          audioStreamActive: false,
        },
        error: null,
      };

      const failedVer = verificationEngine.verify(playAction, silentObs);
      expect(failedVer.verified).toBe(false);
      expect(failedVer.status).toBe('failed');
      expect(failedVer.failureReason).toContain('Audio stream is not active');

      // Case B: PipeWire stream verified active
      const activeObs: AgencyObservation = {
        id: crypto.randomUUID(),
        taskId: playAction.taskId,
        actionId: playAction.id,
        source: 'audio_stream_perception',
        timestamp: new Date().toISOString(),
        success: true,
        confidence: 1.0,
        provenance: 'DesktopEnvironmentProvider.executeMprisMethod',
        data: {
          playbackStatus: 'Playing',
          audioStreamActive: true,
        },
        error: null,
      };

      const successVer = verificationEngine.verify(playAction, activeObs);
      expect(successVer.verified).toBe(true);
      expect(successVer.status).toBe('verified_successful');
      expect(successVer.observedOutcome).toContain('confirmed active');
    });

    it('6. AutonomousAgencyEngine rejects synthetic observations and requires empirical postcondition verification', () => {
      const repo = new InMemoryAutonomousActivityRepository();
      const engine = new AutonomousAgencyEngine({ repository: repo, logger: rootLogger });

      const activity = engine.initiateActivity({
        type: 'browser_interaction',
        title: 'Open Web Resource',
        description: 'Test synthetic observation rejection',
        targetResource: 'https://example.com',
      });

      // Attempt to verify with synthetic test double flag
      const record = engine.verifyActivityAction(
        activity.id,
        'Web page loaded and verified',
        'Simulated test execution',
        { verified: true, isSynthetic: true },
      );

      expect(record.verification?.verified).toBe(false);
      expect(record.status).toBe('failed');
      expect(record.failureInfo?.failureReason).toContain('Synthetic observation rejected');
    });
  });

  describe('P0.2 — Epistemic Provenance Truthfulness', () => {
    it('1. MemoryProvenanceSchema includes all canonical provenance categories', () => {
      const allowedCategories = [
        'direct_observation',
        'raw_observation',
        'user_statement',
        'retrieved_source',
        'inferred_interpretation',
        'internal_reflection',
        'simulation',
        'interaction',
        'verified_fact',
      ];

      for (const cat of allowedCategories) {
        const parsed = MemoryProvenanceSchema.safeParse(cat);
        expect(parsed.success).toBe(true);
      }
    });

    it('2. CognitiveControlBus records internal cognitive cycles as internal_reflection, NEVER verified_fact', async () => {
      const bus = new CognitiveControlBus({
        apeService,
        permissionController,
        verificationEngine,
        memorySink: memoryRepo,
        logger: rootLogger,
      });

      // Internal cognitive contemplation event with no external action proposal
      const event: CognitiveEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'internal',
        type: 'reflection_cycle',
        priority: 0.5,
        payload: {
          thought: 'Contemplating past chess strategies and algorithmic efficiency',
        },
      };

      const result = await bus.dispatch(event);
      expect(result.pipelineCompleted).toBe(true);
      expect(result.taskSucceeded).toBe(true);
      expect(result.outcomeVerified).toBe(false);

      // Verify the committed episodic memory provenance in database
      const memories = memoryRepo.list(5);
      const reflectionMem = memories.find((m) =>
        m.content.includes('Contemplating past chess strategies'),
      );
      expect(reflectionMem).toBeDefined();
      expect(reflectionMem?.provenance).toBe('internal_reflection');
      expect(reflectionMem?.provenance).not.toBe('verified_fact');
    });

    it('3. Autonomous web research records retrieved_source with cryptographic content hash and source URL', async () => {
      const apeRepo = new ApeRepository(db);
      const mockDeviceAgency = {
        openChromeBrowser: vi.fn().mockResolvedValue({ success: true }),
      } as any;
      const mockApeService = {
        processIntellectualInquiry: vi.fn(),
      } as any;

      const service = new AutonomousAgencyService(
        mockDeviceAgency,
        activityRepo,
        apeRepo,
        mockApeService,
        memoryRepo,
        rootLogger,
      );

      // Mock fetch returning real content
      const sampleHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Quantum Computing - Wikipedia</title></head>
          <body>
            <h1>Quantum Computing</h1>
            <p>Quantum computing is a rapidly-emerging technology that harnesses the laws of quantum mechanics.</p>
          </body>
        </html>
      `;

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => sampleHtml,
      } as any);

      try {
        const log = await service.executeAutonomousResearch({
          title: 'Quantum Computing',
          url: 'https://en.wikipedia.org/wiki/Quantum_computing',
        });

        expect(log).toBeDefined();
        expect(log.title).toContain('Quantum Computing');

        // Check memory record in database
        const memories = memoryRepo.list(5);
        const researchMem = memories.find((m) => m.content.includes('Quantum Computing'));
        expect(researchMem).toBeDefined();
        expect(researchMem?.provenance).toBe('retrieved_source');
        expect(researchMem?.metadata?.sourceUrl).toBe(
          'https://en.wikipedia.org/wiki/Quantum_computing',
        );
        expect(researchMem?.metadata?.contentHash).toBeDefined();
        expect(typeof researchMem?.metadata?.contentHash).toBe('string');
        expect((researchMem?.metadata?.contentHash as string).length).toBe(64); // SHA-256
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('4. Synthetic test doubles in CognitiveControlBus are recorded as simulation, NEVER verified_fact', async () => {
      // Mock agency that returns a synthetic observation
      const mockAgency = {
        executeClosedLoop: async () => ({
          success: true,
          observations: [
            {
              id: crypto.randomUUID(),
              source: 'process_table' as const,
              timestamp: new Date().toISOString(),
              success: true,
              confidence: 0.5,
              provenance: 'DesktopEnvironmentProvider',
              data: { isSynthetic: true, pid: 99999 },
              error: null,
            },
          ],
          verifications: [
            {
              actionId: crypto.randomUUID(),
              expectedOutcome: 'Open browser',
              observedOutcome: 'Simulated PID 99999',
              verified: true, // test double claimed verified
              confidence: 0.5,
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      };

      const bus = new CognitiveControlBus({
        apeService,
        permissionController,
        verificationEngine,
        closedLoopAgency: mockAgency as any,
        memorySink: memoryRepo,
        logger: rootLogger,
      });

      const proposal: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'desktop_open_browser',
        payload: { url: 'https://wikipedia.org' },
        rationale: 'Test synthetic isolation',
        expectedOutcome: 'Open browser',
        riskLevel: 'low',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const event: CognitiveEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'user',
        type: 'user_message',
        priority: 0.8,
        payload: {
          text: 'Test synthetic isolation',
          actionProposal: proposal,
          objective: 'Test synthetic isolation',
        },
      };

      const result = await bus.dispatch(event);
      expect(result.pipelineCompleted).toBe(true);

      const memories = memoryRepo.list(5);
      const syntheticMem = memories.find((m) => m.metadata?.isSynthetic === true);
      expect(syntheticMem).toBeDefined();
      expect(syntheticMem?.provenance).toBe('simulation');
      expect(syntheticMem?.provenance).not.toBe('verified_fact');
    });
  });
});
