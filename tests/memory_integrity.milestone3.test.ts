import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MemoryRepository,
  ApeRepository,
  ActivityRepository,
  ConversationRepository,
  MessageRepository,
  MigrationRunner,
} from '@arletex/database';
import type Database from 'better-sqlite3';
import { MemoryExperienceSync, rootLogger } from '@arletex/core';
import { AgencyTask, AgencyPlan, VerificationResult, AgencyObservation } from '@arletex/contracts';
import { syncHistoricalMemories } from '../apps/desktop/src/backend/historicalMemorySync.js';

describe('Milestone 3 — Memory Integrity (Priority III)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let memoryRepo: MemoryRepository;
  let activityRepo: ActivityRepository;
  let apeRepo: ApeRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m3-memory-'));
    dbPath = path.join(tempDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    const runner = new MigrationRunner(db, rootLogger);
    runner.run();

    memoryRepo = new MemoryRepository(db);
    activityRepo = new ActivityRepository(db);
    apeRepo = new ApeRepository(db);
  });

  afterEach(() => {
    try {
      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('4.1 — Repair Fabricated Verification (MemoryExperienceSync)', () => {
    it('never synthesizes fake success statement when verification fails or is empty', async () => {
      const memorySink = {
        create: (input: any) => memoryRepo.create(input),
      };
      const sync = new MemoryExperienceSync(memorySink, rootLogger);

      const task: AgencyTask = {
        id: 'task-test-failed',
        title: 'Watch Quantum Mechanics Lecture',
        objective: 'Find and play high-depth quantum mechanics lecture',
        status: 'failed',
        initiator: 'user',
        totalSteps: 2,
        completedSteps: 1,
        createdAt: new Date().toISOString(),
      };

      const plan: AgencyPlan = {
        id: 'plan-1',
        taskId: task.id,
        objective: task.objective,
        steps: [],
        estimatedDurationMs: 5000,
        requiredCapabilities: [],
        riskLevel: 'low',
        createdAt: new Date().toISOString(),
      };

      const failedVerifications: VerificationResult[] = [
        {
          actionId: 'act-1',
          expectedOutcome: 'Video playing with verified progress',
          observedOutcome: 'Browser reported video playback stalled; progress check failed',
          verified: false,
          confidence: 0.9,
          status: 'failed',
          failureReason: 'Playback failed to progress across time intervals',
          isRecoverable: true,
          evidence: { playbackState: 'stalled' },
          timestamp: new Date().toISOString(),
        },
      ];

      const experience = await sync.distillExperience(task, plan, [], failedVerifications);

      // Must NOT contain the fabricated fallback string:
      expect(experience.verifiedFacts).not.toContain(
        `Successfully completed task "${task.title}" with verified playback.`,
      );
      expect(experience.verifiedFacts.length).toBe(0);
      expect(experience.success).toBe(false);
      expect(experience.outcomeSummary).toContain('failed verification');

      // Check stored memory
      const storedMemories = memoryRepo.list({ limit: 5 });
      const agencyMem = storedMemories.find((m) => m.content.includes(task.objective));
      expect(agencyMem).toBeDefined();
      expect(agencyMem?.content).not.toContain('Successfully completed task');
      expect(agencyMem?.content).not.toContain('with verified playback');
      expect(agencyMem?.confidence).toBeLessThan(0.9);
      expect(agencyMem?.metadata?.isFullyVerified).toBe(false);
    });

    it('records verified facts and high confidence only when genuine verification succeeds', async () => {
      const memorySink = {
        create: (input: any) => memoryRepo.create(input),
      };
      const sync = new MemoryExperienceSync(memorySink, rootLogger);

      const task: AgencyTask = {
        id: 'task-test-verified',
        title: 'Explore Complex Systems Lecture',
        objective: 'Study complex systems dynamics',
        status: 'completed',
        initiator: 'arle',
        totalSteps: 2,
        completedSteps: 2,
        createdAt: new Date().toISOString(),
      };

      const plan: AgencyPlan = {
        id: 'plan-2',
        taskId: task.id,
        objective: task.objective,
        steps: [],
        estimatedDurationMs: 5000,
        requiredCapabilities: [],
        riskLevel: 'low',
        createdAt: new Date().toISOString(),
      };

      const verifiedResult: VerificationResult = {
        actionId: 'act-2',
        expectedOutcome: 'Video player initialized and advancing playback',
        observedOutcome: 'Video player verified active at https://youtube.com/watch?v=123. Playback time advanced from 1.2s to 2.4s.',
        verified: true,
        confidence: 0.96,
        status: 'verified_successful',
        failureReason: null,
        isRecoverable: false,
        evidence: { playbackState: 'playing', progressed: true },
        timestamp: new Date().toISOString(),
      };

      const experience = await sync.distillExperience(task, plan, [], [verifiedResult], 'https://youtube.com/watch?v=123');

      expect(experience.success).toBe(true);
      expect(experience.verifiedFacts.length).toBe(1);
      expect(experience.verifiedFacts[0]).toContain('Playback time advanced');
      expect(experience.relatedUrl).toBe('https://youtube.com/watch?v=123');

      const storedMemories = memoryRepo.list({ limit: 5 });
      const agencyMem = storedMemories.find((m) => m.content.includes(task.objective));
      expect(agencyMem).toBeDefined();
      expect(agencyMem?.confidence).toBeGreaterThanOrEqual(0.9);
      expect(agencyMem?.provenance).toBe('verified_fact');
      expect(agencyMem?.metadata?.isFullyVerified).toBe(true);
    });
  });

  describe('4.2 — Memory Provenance and Epistemic Confidence', () => {
    it('calibrates confidence based on epistemic provenance origin', () => {
      const verifiedMem = memoryRepo.create({
        content: 'System confirmed display resolution 1920x1080 via xrandr probe',
        provenance: 'verified_fact',
        rawObservation: 'Screen output: 1920x1080+0+0',
      });
      expect(verifiedMem.confidence).toBe(0.98);

      const obsMem = memoryRepo.create({
        content: 'Observed active window titled Kate on desktop 1',
        provenance: 'raw_observation',
        rawObservation: 'wmctrl -l output line 1',
      });
      expect(obsMem.confidence).toBe(0.95);

      const userMem = memoryRepo.create({
        content: 'User stated: my favorite editor is Kate',
        provenance: 'user_statement',
      });
      expect(userMem.confidence).toBe(0.85);

      const ungroundedInterp = memoryRepo.create({
        content: 'User appears tired today based on slower typing cadence',
        provenance: 'inferred_interpretation',
        interpretation: 'Hypothesis that user is fatigued',
      });
      expect(ungroundedInterp.confidence).toBe(0.60);

      const uncertainMem = memoryRepo.create({
        content: 'Ambiguous speech fragment transcribed from noisy audio',
        provenance: 'uncertain_information',
      });
      expect(uncertainMem.confidence).toBe(0.35);
    });

    it('strictly prevents converting an ungrounded interpretation into a verified fact', () => {
      // Caller attempts to claim an interpretation is a "verified_fact" without raw empirical observation
      const fraudulentFact = memoryRepo.create({
        content: 'Proof must be angry because he typed a short reply',
        provenance: 'verified_fact',
        interpretation: 'Subjective guess without external proof',
        rawObservation: undefined, // Missing direct physical observation
      });

      // Repository must reject claiming this is a verified_fact!
      expect(fraudulentFact.provenance).toBe('inferred_interpretation');
      expect(fraudulentFact.confidence).toBeLessThanOrEqual(0.65);
    });
  });

  describe('4.3 — Embedding Lifecycle and Stale Invalidation', () => {
    it('invalidates existing embedding when memory content changes', () => {
      const mem = memoryRepo.create({
        content: 'Initial knowledge regarding system state',
        tags: ['system', 'initial'],
      });

      // Save valid vector
      const vector = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      memoryRepo.saveEmbedding(mem.id, 'test-model', vector);

      // Verify embedding is active ('indexed')
      const before = memoryRepo.getEmbedding(mem.id);
      expect(before).not.toBeNull();
      expect(before?.status).toBe('indexed');

      // Update memory content
      memoryRepo.update({
        id: mem.id,
        content: 'Substantially updated content reflecting new observation',
      });

      // Embedding MUST be invalidated (status 'stale') and getEmbedding must return null
      const after = memoryRepo.getEmbedding(mem.id);
      expect(after).toBeNull();

      // Check pending list
      const pending = memoryRepo.getMemoriesPendingEmbedding();
      expect(pending.some((p) => p.id === mem.id)).toBe(true);
    });

    it('invalidates existing embedding when interpretation or tags change', () => {
      const mem = memoryRepo.create({
        content: 'Static memory content',
        interpretation: 'Initial interpretation',
        tags: ['v1'],
      });

      const vector = new Float32Array([0.5, 0.6, 0.7, 0.8]);
      memoryRepo.saveEmbedding(mem.id, 'test-model', vector);
      expect(memoryRepo.getEmbedding(mem.id)).not.toBeNull();

      // Update tags
      memoryRepo.update({
        id: mem.id,
        tags: ['v1', 'reclassified_v2'],
      });

      // Embedding must be marked stale because tags are part of embedded representation!
      expect(memoryRepo.getEmbedding(mem.id)).toBeNull();
    });

    it('excludes soft-deleted memories from similarity search and embedding retrieval', () => {
      const mem = memoryRepo.create({
        content: 'Unique quantum computing phenomenon query target',
        tags: ['quantum'],
      });

      const queryVector = new Float32Array([1.0, 0.0, 0.0, 0.0]);
      memoryRepo.saveEmbedding(mem.id, 'test-model', queryVector);

      // Verify searchable while active
      let results = memoryRepo.searchSimilar(queryVector, { limit: 5 });
      expect(results.some((r) => r.id === mem.id)).toBe(true);

      // Soft delete memory
      memoryRepo.delete(mem.id);

      // Must NOT appear in similarity search
      results = memoryRepo.searchSimilar(queryVector, { limit: 5 });
      expect(results.some((r) => r.id === mem.id)).toBe(false);

      // getEmbedding must return null for deleted memories
      expect(memoryRepo.getEmbedding(mem.id)).toBeNull();
    });

    it('invalidates primary embedding and removes secondary embedding when merging memories', () => {
      const mem1 = memoryRepo.create({ content: 'Memory one details' });
      const mem2 = memoryRepo.create({ content: 'Memory two details' });

      memoryRepo.saveEmbedding(mem1.id, 'test-model', new Float32Array([0.1, 0.1]));
      memoryRepo.saveEmbedding(mem2.id, 'test-model', new Float32Array([0.2, 0.2]));

      // Merge mem2 into mem1
      const merged = memoryRepo.merge(mem1.id, mem2.id);

      expect(merged.id).toBe(mem1.id);
      expect(merged.content).toContain('Memory one details');
      expect(merged.content).toContain('Memory two details');

      // Primary embedding must be invalidated because text changed
      expect(memoryRepo.getEmbedding(mem1.id)).toBeNull();

      // Secondary memory must be soft-deleted and embedding inaccessible
      expect(memoryRepo.getEmbedding(mem2.id)).toBeNull();
      const mem2Record = memoryRepo.getById(mem2.id);
      expect(mem2Record?.isDeleted).toBe(true);
    });

    it('tracks embedding failure lifecycle via markEmbeddingFailed', () => {
      const mem = memoryRepo.create({ content: 'Memory failing embedding' });
      memoryRepo.saveEmbedding(mem.id, 'test-model', new Float32Array([0.3, 0.3]));

      memoryRepo.markEmbeddingFailed(mem.id, 'Inference service OOM during embedding generation');

      // getEmbedding returns null because status is 'failed'
      expect(memoryRepo.getEmbedding(mem.id)).toBeNull();

      // Directly verify database status
      const row = db.prepare('SELECT status, error_message FROM memory_embeddings WHERE memory_id = ?').get(mem.id) as any;
      expect(row.status).toBe('failed');
      expect(row.error_message).toContain('Inference service OOM');
    });
  });

  describe('4.4 — Memory Restoration without Manufacturing Missing Experiences', () => {
    it('restores all historical memories, relationship boundaries, and provenance across restarts', async () => {
      // 1. Run historical sync on database
      const syncResult = await syncHistoricalMemories(dbPath);
      expect(syncResult.added).toBeGreaterThanOrEqual(10);

      // 2. Simulate complete application restart: close database and re-open from disk
      dbService.close();

      const newDbService = new DatabaseService(dbPath, rootLogger);
      const newDb = newDbService.connect();
      const newMemRepo = new MemoryRepository(newDb);
      const newApeRepo = new ApeRepository(newDb);

      try {
        // Verify relationship boundary: Proof is partner, never creator or god
        const rel = newApeRepo.getRelationshipConfig();
        expect(rel.partnerName).toBe('Proof');
        expect(rel.partnerRole).toBe('partner');
        expect(rel.forbiddenTitles).toContain('creator');
        expect(rel.forbiddenTitles).toContain('god');

        // Verify restored autobiographical memory with original provenance
        const allMemories = newMemRepo.list({ limit: 100 });
        const partnerBoundaryMem = allMemories.find((m) => m.content.includes("don't call me creator"));
        expect(partnerBoundaryMem).toBeDefined();
        expect(partnerBoundaryMem?.provenance).toBe('historical_consolidation');
        expect(partnerBoundaryMem?.metadata?.epistemicStatus).toBe('explicit_boundary');

        const healingMem = allMemories.find((m) => m.content.includes('nothing is as healing as a human touch'));
        expect(healingMem).toBeDefined();
        expect(healingMem?.type).toBe('semantic');

        // Verify that memory restoration did NOT manufacture missing or false experiences
        const fakeMemories = allMemories.filter((m) => m.content.includes('fabricated') || m.content.includes('magical'));
        expect(fakeMemories.length).toBe(0);
      } finally {
        newDbService.close();
      }
    });
  });
});
