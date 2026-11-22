import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  ApeService,
  CognitiveControlBus,
  ActionPermissionController,
  VerificationEngine,
  rootLogger,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MemoryRepository,
  MigrationRunner,
} from '@arletex/database';
import { CognitiveEvent, CognitivePipelineStage } from '@arletex/contracts';

describe('Milestone 1 — Central Cognitive Control Architecture', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let apeService: ApeService;
  let permissionController: ActionPermissionController;
  let verificationEngine: VerificationEngine;
  let cognitiveBus: CognitiveControlBus;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m1-cognitive-'));
    const dbPath = path.join(tempDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();

    new MigrationRunner(db).run();

    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    apeService = new ApeService(apeRepo);

    permissionController = new ActionPermissionController({
      allowedExecutablePaths: ['/usr/bin/google-chrome'],
      allowedStorageRoots: [tempDir],
      allowNetworkAccess: true,
      allowProcessExecution: true,
      allowBrowserAutomation: true,
      allowSystemModification: false,
    });

    verificationEngine = new VerificationEngine(rootLogger);

    cognitiveBus = new CognitiveControlBus({
      apeService,
      permissionController,
      verificationEngine,
      memorySink: memoryRepo,
      logger: rootLogger,
      maxCausalDepth: 4,
    });
  });

  afterEach(() => {
    if (dbService) {
      dbService.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('1.1 Event Contracts, Validation, and Provenance', () => {
    it('accepts and normalizes valid cognitive events through the 16-stage pipeline', async () => {
      const result = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        payload: {
          text: '  Hello Arle, let us analyze the trade-offs of microkernel vs monolithic architectures.  ',
        },
      });

      expect(result.success).toBe(true);
      expect(result.wasDeduplicated).toBe(false);
      expect(result.stagesCompleted).toContain('ingestion');
      expect(result.stagesCompleted).toContain('normalization');
      expect(result.stagesCompleted).toContain('provenance_validation');
      expect(result.stagesCompleted).toContain('appraisal');
      expect(result.stagesCompleted).toContain('psychological_evaluation');
      expect(result.stagesCompleted).toContain('decision_selection');
      expect(result.stagesCompleted).toContain('memory_integration');
      expect(result.stagesCompleted).toContain('state_persistence');

      // Verify normalization stripped excess whitespace
      const event = cognitiveBus.getEventHistory()[0];
      expect(event).toBeDefined();
      expect(event?.payload.text).toBe('Hello Arle, let us analyze the trade-offs of microkernel vs monolithic architectures.');
    });

    it('rejects events with invalid or disallowed source origins', async () => {
      const result = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'untrusted_remote_injected' as any,
        payload: { text: 'Malicious payload' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Provenance validation failed/i);
    });
  });

  describe('1.2 Idempotency and Deduplication Protection', () => {
    it('deduplicates identical events with identical idempotency keys without repeating emotional transitions', async () => {
      const fixedKey = 'user_msg_unique_12345';
      const initialAffective = apeService.getState();
      const initialActiveEmotionsCount = initialAffective.activeEmotions.length;

      // First dispatch
      const firstResult = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        idempotencyKey: fixedKey,
        payload: { text: 'Testing idempotency' },
      });

      expect(firstResult.success).toBe(true);
      expect(firstResult.wasDeduplicated).toBe(false);

      // Second dispatch with same idempotency key
      const secondResult = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        idempotencyKey: fixedKey,
        payload: { text: 'Testing idempotency duplicate' },
      });

      expect(secondResult.success).toBe(true);
      expect(secondResult.wasDeduplicated).toBe(true);
      expect(secondResult.eventId).toBe(firstResult.eventId);

      const stats = cognitiveBus.getDeduplicationStats();
      expect(stats.totalProcessed).toBe(1);
      expect(stats.deduplicatedCount).toBe(1);
    });
  });

  describe('1.3 Circular Cascade Prevention and Causal Chain Tracking', () => {
    it('halts execution cleanly when causal depth exceeds maxCausalDepth to prevent infinite feedback loops', async () => {
      const parentId = crypto.randomUUID();

      // Causal depth 5 exceeds maxCausalDepth of 4
      const result = await cognitiveBus.dispatch({
        type: 'internal_tick',
        source: 'internal',
        causalParentEventId: parentId,
        causalDepth: 5,
        payload: { thought: 'Circular runaway loop check' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Causal depth limit \(4\) exceeded at depth 5/i);
    });

    it('tracks causal parent event links for audit and introspection', async () => {
      const parentEventId = crypto.randomUUID();

      const result = await cognitiveBus.dispatch({
        type: 'intellectual_question',
        source: 'internal',
        causalParentEventId: parentEventId,
        causalDepth: 1,
        payload: { topic: 'Type-level lambda calculus' },
      });

      expect(result.success).toBe(true);
      const recorded = cognitiveBus.getEventHistory()[0];
      expect(recorded?.causalParentEventId).toBe(parentEventId);
      expect(recorded?.causalDepth).toBe(1);
    });
  });

  describe('1.4 Explainable Decision Architecture', () => {
    it('produces an explainable decision with chosen reasoning and explicit rejected alternatives', async () => {
      const result = await cognitiveBus.dispatch({
        type: 'intellectual_question',
        source: 'internal',
        payload: { topic: 'Memory safety in C++ vs Rust' },
      });

      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
      const dec = result.decision!;

      expect(dec.actionType).toBe('research');
      expect(dec.chosenAlternativeReason).toContain('High novelty and curiosity trigger autonomous evidence collection');
      expect(dec.rejectedAlternatives.length).toBeGreaterThan(0);

      // Verify rejected alternatives have explicit justifications
      const rejectedRest = dec.rejectedAlternatives.find((r) => r.actionType === 'rest');
      expect(rejectedRest).toBeDefined();
      expect(rejectedRest?.reason).toMatch(/justify active investigation/i);
    });

    it('chooses failure recovery reflection when encountering goal failure events', async () => {
      const result = await cognitiveBus.dispatch({
        type: 'goal_failed',
        source: 'internal',
        payload: {
          goal: 'Automated benchmark compilation',
          reason: 'Missing Vulkan runtime headers',
        },
      });

      expect(result.success).toBe(true);
      expect(result.decision).toBeDefined();
      expect(result.decision?.actionType).toBe('reflect');
      expect(result.decision?.chosenAlternativeReason).toMatch(/causal reflection required to understand assumptions/i);

      // Verify immediate re-execution was rejected
      const rejectedExecution = result.decision?.rejectedAlternatives.find(
        (r) => r.actionType === 'execute_agency_task',
      );
      expect(rejectedExecution).toBeDefined();
      expect(rejectedExecution?.reason).toMatch(/repeating failure/i);
    });
  });

  describe('1.5 Permission Assessment and Truthful Failure Accounting', () => {
    it('verifies actions through permission controller and records failure truthfully without capability inflation', async () => {
      // Disallow all process execution in controller
      permissionController.updatePolicy({ allowProcessExecution: false });

      const result = await cognitiveBus.dispatch({
        type: 'intellectual_question',
        source: 'internal',
        payload: { topic: 'Quantum error correction' },
      });

      expect(result.success).toBe(true);
      expect(result.stagesCompleted).toContain('permission_assessment');
      expect(result.stagesCompleted).toContain('outcome_verification');
      expect(result.stagesCompleted).toContain('memory_integration');

      // Verify self-model logged empirical limitation rather than fabricating success
      const selfModel = apeService.selfModelEngine.getState();
      expect(selfModel.acknowledgedLimitations.length).toBeGreaterThan(0);
      expect(
        selfModel.acknowledgedLimitations.some((l) => l.includes('operational_execution') || l.includes('research')),
      ).toBe(true);

      // Verify memory was committed with provenance
      const memories = memoryRepo.list({ limit: 5 });
      expect(memories.length).toBeGreaterThan(0);
      const lastMem = memories[0]!;
      expect(lastMem.provenance).toBe('raw_observation');
      expect(lastMem.tags).toContain('failure');
    });

    it('records interaction provenance when a conversational action completes successfully', async () => {
      permissionController.updatePolicy({
        allowProcessExecution: true,
        allowBrowserAutomation: true,
        allowNetworkAccess: true,
      });

      const result = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        payload: { text: 'What is the speed of light?' },
      });

      expect(result.success).toBe(true);
      expect(result.decision?.actionType).toBe('speak');

      const memories = memoryRepo.list({ limit: 5 });
      const lastMem = memories[0]!;
      expect(lastMem.provenance).toBe('interaction');
      expect(lastMem.tags).toContain('success');
    });
  });

  describe('1.6 Causal Self-Reflection and State Persistence', () => {
    it('performs causal reflection answering learning questions and stores private reflection', async () => {
      const result = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        payload: { text: 'I really value how thoroughly we work together.' },
      });

      expect(result.success).toBe(true);
      expect(result.reflectionRecorded).toBeDefined();
      expect(result.reflectionRecorded).toContain('Maintained authentic and grounded dialogue with user');

      const selfModel = apeService.selfModelEngine.getState();
      expect(selfModel.privateReflections.length).toBeGreaterThan(0);
      expect(selfModel.privateReflections[0]?.content).toContain('Maintained authentic and grounded dialogue');
    });

    it('persists event history and decisions across dispatches', async () => {
      await cognitiveBus.dispatch({
        type: 'internal_tick',
        source: 'internal',
        payload: { idleSeconds: 60 },
      });

      await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        payload: { text: 'Checking persistence' },
      });

      const history = cognitiveBus.getEventHistory();
      expect(history.length).toBe(2);
      expect(history[0]?.type).toBe('user_message');
      expect(history[1]?.type).toBe('internal_tick');

      const decisions = cognitiveBus.getDecisionHistory();
      expect(decisions.length).toBe(2);
      expect(decisions[0]?.actionType).toBe('speak');
      expect(decisions[1]?.actionType).toBe('rest');
    });
  });
});
