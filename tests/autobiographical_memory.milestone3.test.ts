import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  ApeService,
  AutobiographicalMemoryService,
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
import { MemoryType } from '@arletex/contracts';

describe('Milestone 3 — Memory and Autobiographical Integration', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let memoryRepo: MemoryRepository;
  let apeRepo: ApeRepository;
  let apeService: ApeService;
  let autoMemoryService: AutobiographicalMemoryService;
  let cognitiveBus: CognitiveControlBus;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m3-autobio-'));
    dbPath = path.join(tempDir, 'autobio_m3.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();

    new MigrationRunner(db, rootLogger).run();

    memoryRepo = new MemoryRepository(db);
    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo);
    autoMemoryService = new AutobiographicalMemoryService(memoryRepo, rootLogger);

    const permissionController = new ActionPermissionController({
      allowedExecutablePaths: ['/usr/bin/google-chrome'],
      allowedStorageRoots: [tempDir],
      allowNetworkAccess: true,
      allowProcessExecution: true,
      allowBrowserAutomation: true,
      allowSystemModification: false,
    });

    const verificationEngine = new VerificationEngine(rootLogger);

    cognitiveBus = new CognitiveControlBus({
      apeService,
      permissionController,
      verificationEngine,
      autobiographicalMemoryService: autoMemoryService,
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

  // =========================================================================
  // 3.1 All 8 Canonical Memory Categories
  // =========================================================================
  describe('3.1 All 8 Canonical Memory Categories Representation', () => {
    it('creates, persists, and lists memories across all 8 canonical categories', () => {
      const categories: MemoryType[] = [
        'episodic',
        'semantic',
        'procedural',
        'autobiographical',
        'relationship',
        'project',
        'emotional',
        'prospective',
      ];

      for (const cat of categories) {
        const mem = autoMemoryService.recordExperience({
          type: cat,
          content: `Test entry for category ${cat}`,
          importance: 0.75,
        });
        expect(mem.id).toBeDefined();
        expect(mem.type).toBe(cat);

        const fetched = memoryRepo.getById(mem.id);
        expect(fetched?.type).toBe(cat);
      }

      const list = memoryRepo.list({ limit: 20 });
      expect(list.length).toBeGreaterThanOrEqual(categories.length);
    });
  });

  // =========================================================================
  // 3.2 Memory Provenance and Epistemic Calibration
  // =========================================================================
  describe('3.2 Trustworthy Provenance and Anti-Fabrication', () => {
    it('rejects verified_fact when raw empirical observation is missing and demotes to inferred_interpretation', () => {
      const mem = autoMemoryService.recordExperience({
        content: 'Proof is unhappy with current system throughput',
        provenance: 'verified_fact', // False claim without raw observation!
        interpretation: 'User seemed quiet',
        rawObservation: undefined,
      });

      expect(mem.provenance).toBe('inferred_interpretation');
      expect(mem.confidence).toBeLessThanOrEqual(0.65);
    });

    it('records verified_fact with high confidence (0.98) when supported by raw observation', () => {
      const mem = autoMemoryService.recordExperience({
        content: 'Local llama-server confirmed running on port 8080 with Qwen 9B Vulkan backend',
        provenance: 'verified_fact',
        rawObservation: 'HTTP GET /health returned 200 OK {"status":"ready"}',
        confidence: 0.98,
        importance: 0.9,
      });

      expect(mem.provenance).toBe('verified_fact');
      expect(mem.confidence).toBe(0.98);
      expect(mem.rawObservation).toContain('HTTP GET /health');
    });

    it('records failed agency outcomes truthfully without fabricating success', () => {
      const failedMem = autoMemoryService.recordExperience({
        content: 'Failed to launch desktop browser due to missing DISPLAY variable',
        provenance: 'raw_observation',
        rawObservation: 'spawn google-chrome exited with code 1: cannot open display',
        confidence: 0.95,
        importance: 0.6,
        metadata: {
          isFullyVerified: false,
          failureReason: 'Display environment missing',
        },
      });

      expect(failedMem.content).toContain('Failed to launch');
      expect(failedMem.metadata?.isFullyVerified).toBe(false);
      expect(failedMem.content).not.toContain('Successfully');
    });
  });

  // =========================================================================
  // 3.3 Dynamic Associative Memory Retrieval
  // =========================================================================
  describe('3.3 Dynamic Associative Memory Retrieval', () => {
    it('retrieves relevant past memories based on semantic keywords and ranks by relevance', () => {
      // Seed autobiographical history
      autoMemoryService.recordExperience({
        content:
          'Proof discussed Bobby Fischer chess defense and unconventional tactical sacrifices',
        type: 'relationship',
        tags: ['chess', 'fischer', 'tactics'],
        importance: 0.9,
      });

      autoMemoryService.recordExperience({
        content: 'Implemented Linux SQLite atomic transactions for APE cognitive states',
        type: 'project',
        tags: ['sqlite', 'database', 'ape'],
        importance: 0.85,
      });

      autoMemoryService.recordExperience({
        content: 'Quiet afternoon conversation with Proof about partnership, trust, and equality',
        type: 'relationship',
        tags: ['proof', 'partnership', 'trust'],
        importance: 0.95,
      });

      // Stimulus regarding chess and tactical ideas
      const matches = autoMemoryService.retrieveAssociativeContext(
        'Bobby Fischer tactical sacrifice in chess opening',
        {
          limit: 3,
        },
      );

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]?.memory.content).toContain('Bobby Fischer');
      expect(matches[0]?.relevanceScore).toBeGreaterThanOrEqual(0.4);
    });
  });

  // =========================================================================
  // 3.4 Memory Consolidation: Deduplication, Contradictions, and Linking
  // =========================================================================
  describe('3.4 Memory Consolidation and Relationship Formation', () => {
    it('detects and merges near-duplicate memories', () => {
      const mem1 = autoMemoryService.recordExperience({
        content: 'Proof prefers concise technical explanations over verbose pleasantries',
        tags: ['preferences', 'communication'],
        importance: 0.85,
      });

      const mem2 = autoMemoryService.recordExperience({
        content: 'Proof prefers concise technical explanations over verbose pleasantries',
        tags: ['preferences', 'communication'],
        importance: 0.85,
      });

      const report = autoMemoryService.consolidateMemories();
      expect(report.duplicatesMerged).toBeGreaterThanOrEqual(1);

      // Verify that secondary was soft-deleted and primary preserved
      const fetched1 = memoryRepo.getById(mem1.id);
      expect(fetched1?.isDeleted).toBe(false);

      const fetched2 = memoryRepo.getById(mem2.id);
      expect(fetched2?.isDeleted).toBe(true);
    });

    it('detects logical contradictions and flags conflicting_information without deleting history', () => {
      autoMemoryService.recordExperience({
        content: 'System audio is enabled for text-to-speech output',
        tags: ['audio', 'configuration'],
        importance: 0.7,
      });

      autoMemoryService.recordExperience({
        content: 'System audio is disabled for text-to-speech output',
        tags: ['audio', 'configuration'],
        importance: 0.7,
      });

      const report = autoMemoryService.consolidateMemories();
      expect(report.contradictionsFlagged).toBeGreaterThanOrEqual(1);

      const all = memoryRepo.list({ limit: 10 });
      const conflicting = all.filter((m) => m.provenance === 'conflicting_information');
      expect(conflicting.length).toBeGreaterThanOrEqual(2);
      expect(conflicting[0]?.confidence).toBeLessThanOrEqual(0.45);
    });

    it('forms associative relationship links between memories sharing tags', () => {
      const memA = autoMemoryService.recordExperience({
        content: 'Investigated persistent homology topological data analysis',
        tags: ['topology', 'mathematics'],
        importance: 0.8,
      });

      const memB = autoMemoryService.recordExperience({
        content: 'Explored simplicial complex triangulation algorithms',
        tags: ['topology', 'mathematics'],
        importance: 0.8,
      });

      const report = autoMemoryService.consolidateMemories();
      expect(report.relationshipsFormed).toBeGreaterThanOrEqual(1);

      const fetchedA = memoryRepo.getById(memA.id);
      const related = (fetchedA?.metadata?.relatedMemoryIds as string[]) || [];
      expect(related).toContain(memB.id);
    });

    it('strictly preserves high-importance and core identity memories from archival', () => {
      const coreMem = autoMemoryService.recordExperience({
        content: 'Core identity anchor: Arle is an artificial individual with Proof as partner',
        type: 'relationship',
        importance: 0.98,
        metadata: { isCoreIdentity: true },
      });

      autoMemoryService.consolidateMemories();

      const fetched = memoryRepo.getById(coreMem.id);
      expect(fetched?.isArchived).toBe(false);
      expect(fetched?.isDeleted).toBe(false);
    });
  });

  // =========================================================================
  // 3.5 Cognitive Control Bus Integration with Autobiographical Memory
  // =========================================================================
  describe('3.5 Cognitive Control Bus Integration', () => {
    it('retrieves associative memories in perception stage and records grounded autobiographical experience', async () => {
      // 1. Seed prior memory
      autoMemoryService.recordExperience({
        content: 'Proof noted that microkernel designs require high-performance IPC',
        tags: ['microkernel', 'architecture'],
        importance: 0.9,
      });

      // 2. Dispatch cognitive event that resonates with the seeded memory
      const result = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        actor: 'user',
        payload: { text: 'What are the main bottlenecks in a microkernel architecture?' },
      });

      expect(result.success).toBe(true);
      expect(result.stagesCompleted).toContain('perception_interpretation');
      expect(result.stagesCompleted).toContain('memory_integration');
      expect(result.memoriesCommitted.length).toBeGreaterThan(0);

      // Verify the new memory recorded by the cognitive cycle
      const committedId = result.memoriesCommitted[0]!;
      const committedMem = memoryRepo.getById(committedId);
      expect(committedMem).toBeDefined();
      expect(committedMem?.type).toBe('autobiographical');
      expect(committedMem?.content).toContain('Cognitive Cycle');
    });
  });

  // =========================================================================
  // 3.6 Cold Restart Historical Continuity
  // =========================================================================
  describe('3.6 Cold Restart Autobiographical Continuity', () => {
    it('restores all autobiographical memories, categories, and relationship links across database restarts', () => {
      // Seed memories across categories
      const mem1 = autoMemoryService.recordExperience({
        type: 'autobiographical',
        content: 'First cold restart test memory: persistent selfhood',
        importance: 0.95,
        tags: ['identity', 'restart'],
      });

      const mem2 = autoMemoryService.recordExperience({
        type: 'project',
        content: 'Completed Milestone 2 causal six-engine dynamic wiring',
        importance: 0.9,
        tags: ['ape', 'milestone2'],
      });

      // Close database connection
      dbService.close();

      // Reopen with fresh instances
      const newDbService = new DatabaseService(dbPath, rootLogger);
      const newDb = newDbService.connect();
      const newMemRepo = new MemoryRepository(newDb);

      try {
        const restored1 = newMemRepo.getById(mem1.id);
        expect(restored1).toBeDefined();
        expect(restored1?.type).toBe('autobiographical');
        expect(restored1?.importance).toBe(0.95);

        const restored2 = newMemRepo.getById(mem2.id);
        expect(restored2).toBeDefined();
        expect(restored2?.type).toBe('project');
        expect(restored2?.importance).toBe(0.9);

        const list = newMemRepo.list({ limit: 10 });
        expect(list.some((m) => m.id === mem1.id)).toBe(true);
        expect(list.some((m) => m.id === mem2.id)).toBe(true);
      } finally {
        newDbService.close();
      }
    });
  });
});
