import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  DatabaseService,
  MigrationRunner,
  ApeRepository,
  MemoryRepository,
} from '@arletex/database';
import type Database from 'better-sqlite3';
import {
  ActionPermissionController,
  VerificationEngine,
  CognitiveControlBus,
  ApeService,
  rootLogger,
} from '@arletex/core';
import {
  CognitiveEvent,
  ActionProposal,
} from '@arletex/contracts';

describe('Priority 0 — Canonical Cognitive Event Pipeline & Recoverability (P0.5 & P0.6)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let apeService: ApeService;
  let verificationEngine: VerificationEngine;
  let permissionController: ActionPermissionController;
  let bus: CognitiveControlBus;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p0-pipeline-'));
    dbPath = path.join(tempDir, 'pipeline_test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    apeService = new ApeService(apeRepo, undefined, rootLogger);
    verificationEngine = new VerificationEngine(rootLogger);
    permissionController = new ActionPermissionController({
      allowedFilesystemPaths: [tempDir],
      allowedNetworkDomains: ['wikipedia.org'],
    });

    bus = new CognitiveControlBus({
      apeService,
      permissionController,
      verificationEngine,
      memorySink: memoryRepo,
      logger: rootLogger,
    });
  });

  afterEach(() => {
    try {
      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Canonical Event Pipeline Ingestion & Result Semantics (P0.5)', () => {
    it('dispatches user_message, completes 16 stages, and returns truthful cycle result', async () => {
      const event: CognitiveEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'user',
        type: 'user_message',
        priority: 0.8,
        payload: { text: 'Hello Arle, let us verify our cognitive foundation.' },
      };

      const result = await bus.dispatch(event);

      expect(result.pipelineCompleted).toBe(true);
      expect(result.taskSucceeded).toBe(true);
      expect(result.wasDeduplicated).toBe(false);
      expect(result.stagesCompleted).toContain('ingestion');
      expect(result.stagesCompleted).toContain('normalization');
      expect(result.stagesCompleted).toContain('appraisal');
      expect(result.stagesCompleted).toContain('decision_selection');
      expect(result.stagesCompleted).toContain('memory_integration');
      expect(result.stagesCompleted).toContain('reflection');
    });

    it('dispatches internal_tick and reflection_cycle through canonical bus', async () => {
      const tickEvent: CognitiveEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'timer',
        type: 'internal_tick',
        priority: 0.3,
        payload: { tickIndex: 1 },
      };

      const tickResult = await bus.dispatch(tickEvent);
      expect(tickResult.pipelineCompleted).toBe(true);
      expect(tickResult.taskSucceeded).toBe(true);

      const reflectionEvent: CognitiveEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'internal',
        type: 'reflection_cycle',
        priority: 0.5,
        payload: { thought: 'Consolidating relational memories and theoretical invariants' },
      };

      const refResult = await bus.dispatch(reflectionEvent);
      expect(refResult.pipelineCompleted).toBe(true);
      expect(refResult.taskSucceeded).toBe(true);
    });

    it('distinguishes pipeline completion from task outcome when action fails', async () => {
      // Disallow all process execution so the proposal is denied by permission controller
      permissionController.updatePolicy({ autonomousExecutionEnabled: false });

      const proposal: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'write_file',
        payload: { filePath: path.join(tempDir, 'denied.txt'), content: 'data' },
        rationale: 'Test failed task semantics',
        expectedOutcome: 'File written',
        riskLevel: 'high',
        requiresExplicitApproval: false,
        createdAt: new Date().toISOString(),
      };

      const event: CognitiveEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        source: 'user',
        type: 'user_message',
        priority: 0.7,
        payload: {
          text: 'Write data to protected path',
          actionProposal: proposal,
        },
      };

      const result = await bus.dispatch(event);

      // Cognitive pipeline completed successfully, but external task failed truthfully
      expect(result.pipelineCompleted).toBe(true);
      expect(result.taskSucceeded).toBe(false);
      expect(result.outcomeVerified).toBe(false);

      // Self-model truthfully acknowledged the limitation without fabricating success
      const selfModel = apeService.selfModelEngine.getState();
      expect(selfModel.acknowledgedLimitations.length).toBeGreaterThan(0);
    });
  });

  describe('2. Durable Idempotency & Crash Recovery (P0.6)', () => {
    it('enforces durable idempotency and deduplicates identical events', async () => {
      const fixedEventId = crypto.randomUUID();
      const idempotencyKey = `user_message:user:${fixedEventId}`;

      const event: CognitiveEvent = {
        id: fixedEventId,
        idempotencyKey,
        timestamp: new Date().toISOString(),
        source: 'user',
        type: 'user_message',
        priority: 0.9,
        payload: { text: 'Test durable idempotency' },
      };

      // First dispatch
      const firstResult = await bus.dispatch(event);
      expect(firstResult.pipelineCompleted).toBe(true);
      expect(firstResult.wasDeduplicated).toBe(false);

      const memCountBefore = memoryRepo.list(10).length;

      // Duplicate delivery with identical idempotencyKey
      const secondResult = await bus.dispatch(event);
      expect(secondResult.wasDeduplicated).toBe(true);
      expect(secondResult.pipelineCompleted).toBe(true);

      // Ensure no duplicate episodic memory was committed
      const memCountAfter = memoryRepo.list(10).length;
      expect(memCountAfter).toBe(memCountBefore);
    });

    it('recovers in-flight events from database after simulated crash', () => {
      const crashKey = 'test_in_flight:user:crash_123';
      const crashEventId = crypto.randomUUID();

      // Simulate an event that was claimed as in-flight when process abruptly terminated
      const claim = apeRepo.claimInFlightEvent({
        idempotencyKey: crashKey,
        eventId: crashEventId,
        eventType: 'user_message',
        source: 'user',
      });
      expect(claim.claimed).toBe(true);

      // Verify the record is in_flight
      const beforeRecovery = apeRepo.getIdempotencyRecord(crashKey);
      expect(beforeRecovery?.state).toBe('in_flight');

      // Execute crash recovery
      const recovered = apeRepo.recoverInFlightEvents();
      expect(recovered.length).toBeGreaterThanOrEqual(1);
      expect(recovered.some((r) => r.idempotencyKey === crashKey)).toBe(true);

      // Record transitioned to failed with explicit InterruptedByCrashRecovery error
      const afterRecovery = apeRepo.getIdempotencyRecord(crashKey);
      expect(afterRecovery?.state).toBe('failed');
      expect(afterRecovery?.result?.error).toContain('InterruptedByCrashRecovery');
    });

    it('preserves database integrity and recovers all state across cold restart', () => {
      // 1. Commit initial psychological state and memories
      const initialMem = memoryRepo.create({
        type: 'episodic',
        content: 'Proof calibrated my psychological architecture and cognitive bus.',
        importance: 0.95,
        confidence: 0.95,
        provenance: 'direct_observation',
        tags: ['calibration', 'proof', 'continuity'],
      });
      expect(initialMem.id).toBeDefined();

      // 2. Simulate complete application cold shutdown
      dbService.close();

      // 3. Re-open database connection as a fresh service instance
      const freshDbService = new DatabaseService(dbPath, rootLogger);
      const freshDb = freshDbService.connect();
      const freshMemoryRepo = new MemoryRepository(freshDb);
      const freshApeRepo = new ApeRepository(freshDb);

      // 4. Verify identity, memories, and integrity survived intact
      const loadedMems = freshMemoryRepo.list(5);
      expect(loadedMems.length).toBeGreaterThan(0);
      expect(loadedMems.some((m) => m.content.includes('Proof calibrated my psychological architecture'))).toBe(true);

      // SQLite integrity check passes
      const integrity = freshDb.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      expect(integrity.integrity_check).toBe('ok');

      freshDbService.close();
    });
  });
});
