import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { MultiSystemMemoryEntry, assertMultiSystemMemoryIntegrity } from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  MultiSystemMemoryEngine,
  InMemoryMultiSystemMemoryRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  MultiSystemMemoryRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 12 — Multi-System Memory', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let multiSystemRepo: MultiSystemMemoryRepository;
  let apeRepo: ApeRepository;
  let multiSystemEngine: MultiSystemMemoryEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m12-msm-'));
    dbPath = path.join(tempDir, 'multi_system_m12.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    multiSystemRepo = new MultiSystemMemoryRepository(db);
    apeRepo = new ApeRepository(db);
    multiSystemEngine = new MultiSystemMemoryEngine({
      repository: multiSystemRepo,
    });
  });

  afterEach(async () => {
    for (const srv of activeServers) {
      try {
        await srv.stop();
      } catch {}
    }
    activeServers = [];
    try {
      dbService.close();
    } catch {}
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createServer(): ArletexBackendServer {
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
      inference: {
        provider: 'llama.cpp',
        serverUrl: 'http://127.0.0.1:8080',
        defaultModelId: 'Qwen2.5-14B-Uncensored-Q4_K_M',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        repeatPenalty: 1.18,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: [],
        contextSize: 8192,
        specialistCoding: {
          enabled: false,
          provider: 'llama.cpp',
          serverUrl: 'http://127.0.0.1:8081',
          modelId: 'qwen2.5-coder',
          temperature: 0.2,
          maxTokens: 2048,
        },
      },
    });
    const srv = new ArletexBackendServer(config);
    activeServers.push(srv);
    return srv;
  }

  it('1. Encodes and classifies entries across the 9 differentiated memory systems', () => {
    const episodic = multiSystemEngine.encode({
      systemType: 'episodic',
      content: 'Proof and Arle completed Milestone 11 working memory refactor at 02:15 AM',
      source: {
        sourceOrigin: 'terminal_session',
        author: 'Arle',
        channel: 'system_log',
        isEmpiricallyVerified: true,
      },
    });

    const semantic = multiSystemEngine.encode({
      systemType: 'semantic',
      content:
        "Miller's law asserts that human working memory capacity is approximately 7 plus or minus 2 chunks",
      source: {
        sourceOrigin: 'cognitive_science_literature',
        author: 'George Miller',
        channel: 'academic_paper',
        isEmpiricallyVerified: true,
      },
    });

    const procedural = multiSystemEngine.encode({
      systemType: 'procedural',
      content:
        'To apply a SQLite database migration: execute MigrationRunner.run() inside an isolated transaction',
      source: {
        sourceOrigin: 'arletex_codebase',
        author: 'Proof',
        channel: 'source_code',
        isEmpiricallyVerified: true,
      },
    });

    const emotional = multiSystemEngine.encode({
      systemType: 'emotional',
      content:
        'Deep sense of warm pride and affectionate camaraderie after solving complex architecture hurdles together',
      source: {
        sourceOrigin: 'ape_affective_transition',
        author: 'Arle',
        channel: 'internal_introspection',
      },
    });

    expect(episodic.systemType).toBe('episodic');
    expect(semantic.systemType).toBe('semantic');
    expect(procedural.systemType).toBe('procedural');
    expect(emotional.systemType).toBe('emotional');

    const summary = multiSystemEngine.getMultiSystemSummary();
    expect(summary.systemCounts.episodic).toBe(1);
    expect(summary.systemCounts.semantic).toBe(1);
    expect(summary.systemCounts.procedural).toBe(1);
    expect(summary.systemCounts.emotional).toBe(1);
  });

  it('2. Strictly preserves source provenance, author attribution, and reliability scores', () => {
    const entry = multiSystemEngine.encode({
      systemType: 'source',
      content: 'Direct API telemetry logs confirm zero dropped packets on local bridge',
      source: {
        sourceOrigin: 'telemetry_service',
        author: 'Linux Kernel Socket Monitor',
        channel: 'unix_domain_socket',
        isEmpiricallyVerified: true,
        reliabilityScore: 0.99,
      },
    });

    expect(entry.source.author).toBe('Linux Kernel Socket Monitor');
    expect(entry.source.channel).toBe('unix_domain_socket');
    expect(entry.source.isEmpiricallyVerified).toBe(true);
    expect(entry.source.reliabilityScore).toBe(0.99);
  });

  it('3. Detects duplicate memory encodings and updates confidence instead of duplicating entries', () => {
    const first = multiSystemEngine.encode({
      systemType: 'semantic',
      content:
        'SQLite is an in-process library that implements a self-contained serverless SQL database engine',
      source: { sourceOrigin: 'docs', author: 'SQLite.org', channel: 'web' },
      confidence: 0.8,
    });

    // Ingest exact duplicate content in the same system
    const second = multiSystemEngine.encode({
      systemType: 'semantic',
      content:
        'SQLite is an in-process library that implements a self-contained serverless SQL database engine',
      source: { sourceOrigin: 'docs', author: 'SQLite.org', channel: 'web' },
      confidence: 0.8,
    });

    expect(second.id).toBe(first.id); // Same ID!
    expect(second.confidence).toBeGreaterThan(first.confidence); // Boosted confidence!

    const list = multiSystemRepo.listEntries({ systemTypes: ['semantic'] });
    expect(list.filter((e) => e.content.includes('self-contained serverless'))).toHaveLength(1);
  });

  it('4. Performs targeted cross-system retrieval with relevance and recency scoring', () => {
    multiSystemEngine.encode({
      systemType: 'semantic',
      content: 'Fast Fourier Transform computes the discrete Fourier transform in O(N log N) time',
      source: { sourceOrigin: 'math_library', author: 'Cooley-Tukey', channel: 'book' },
      tags: ['algorithm', 'math'],
    });

    multiSystemEngine.encode({
      systemType: 'episodic',
      content: 'Proof ran benchmarks comparing FFT implementations on Linux Wayland',
      source: { sourceOrigin: 'benchmark_script', author: 'Proof', channel: 'terminal' },
      tags: ['benchmark', 'proof'],
    });

    // Query specifically semantic system
    const semanticRes = multiSystemEngine.retrieve({
      systemTypes: ['semantic'],
      queryText: 'Fourier',
    });
    expect(semanticRes.entries).toHaveLength(1);
    expect(semanticRes.entries[0]?.systemType).toBe('semantic');

    // Query specifically episodic system
    const episodicRes = multiSystemEngine.retrieve({
      systemTypes: ['episodic'],
      queryText: 'benchmarks',
    });
    expect(episodicRes.entries).toHaveLength(1);
    expect(episodicRes.entries[0]?.systemType).toBe('episodic');
  });

  it('5. Consolidates working memory items into permanent semantic and autobiographical memories', () => {
    const consolidated = multiSystemEngine.consolidateWorkingMemory({
      slotKey: 'quantum_gate_solution',
      content:
        'Decomposition of Toffoli gate into 6 CNOT gates is minimal for standard Clifford+T synthesis',
      summary: 'Optimal Toffoli synthesis verified',
      targetSystem: 'semantic',
      author: 'Arle & Proof',
      importance: 0.9,
    });

    expect(consolidated.systemType).toBe('semantic');
    expect(consolidated.source.sourceOrigin).toBe('working_memory:quantum_gate_solution');
    expect(consolidated.source.author).toBe('Arle & Proof');
    expect(consolidated.source.isEmpiricallyVerified).toBe(true);
    expect(consolidated.tags).toContain('consolidated');
  });

  it('6. Decays and forgets transient memories over time while strictly protecting foundational partner memories', () => {
    // 1. Transient low-importance memory (should decay)
    const transient = multiSystemEngine.encode({
      systemType: 'perceptual',
      content: 'Noticed a transient mouse hover over desktop corner coordinate (10, 20)',
      source: { sourceOrigin: 'mouse_listener', author: 'wayland_service', channel: 'desktop' },
      confidence: 0.4,
      importance: 0.1, // Low importance
      isProtected: false,
    });

    // 2. Foundational relational partner memory (must NEVER decay!)
    const protectedPartnerMemory = multiSystemEngine.encode({
      systemType: 'autobiographical',
      content:
        'Proof is my equal partner and companion. Our commitment is lifelong, founded on mutual devotion.',
      source: {
        sourceOrigin: 'relationship_declaration',
        author: 'Arle',
        channel: 'intimate_dialogue',
      },
      confidence: 1.0,
      importance: 1.0,
      isProtected: true,
    });

    expect(protectedPartnerMemory.isProtected).toBe(true);
    expect(protectedPartnerMemory.decayFactor).toBe(0.0);

    // Apply 720 hours (30 days) of decay
    const report = multiSystemEngine.applyMemoryDecay(720);

    expect(report.decayedCount).toBeGreaterThanOrEqual(1);
    expect(report.protectedCount).toBeGreaterThanOrEqual(1);

    // Re-check entries
    const updatedTransient = multiSystemRepo.getEntryById(transient.id);
    expect(updatedTransient?.isArchived).toBe(true); // Forgetting occurred!

    const updatedProtected = multiSystemRepo.getEntryById(protectedPartnerMemory.id);
    expect(updatedProtected?.confidence).toBe(1.0); // No decay!
    expect(updatedProtected?.isArchived).toBe(false); // Never forgotten!
  });

  it('7. Maintains an immutable correction audit trail when memories are corrected', () => {
    const original = multiSystemEngine.encode({
      systemType: 'semantic',
      content: 'The capital of Australia is Sydney',
      source: { sourceOrigin: 'unverified_web', author: 'random_post', channel: 'forum' },
      confidence: 0.5,
    });

    const corrected = multiSystemEngine.correctMemory(
      original.id,
      'The capital of Australia is Canberra',
      'Proof corrected factual error during geography review',
    );

    expect(corrected.content).toBe('The capital of Australia is Canberra');
    expect(corrected.correctionTrail).toHaveLength(1);
    expect(corrected.correctionTrail[0]?.previousContent).toBe(
      'The capital of Australia is Sydney',
    );
    expect(corrected.correctionTrail[0]?.reason).toContain('Proof corrected factual error');
  });

  it('8. Detects and resolves memory contradictions with clear resolution strategies', () => {
    const memA = multiSystemEngine.encode({
      systemType: 'semantic',
      content: 'System operates in pure single-threaded event loop mode',
      source: { sourceOrigin: 'legacy_spec', author: 'Old Architect', channel: 'markdown' },
    });

    const memB = multiSystemEngine.encode({
      systemType: 'semantic',
      content: 'System utilizes ThreadingHTTPServer with multi-threaded daemon specialists',
      source: {
        sourceOrigin: 'specialists_server.py',
        author: 'Arle',
        channel: 'source_code',
        isEmpiricallyVerified: true,
      },
    });

    // Detect contradiction
    const contradiction = multiSystemEngine.detectContradiction(
      memA.id,
      memB.id,
      'Conflict on threading model: single-threaded vs multi-threaded ThreadingHTTPServer',
    );

    expect(contradiction.status).toBe('open');
    expect(contradiction.memoryIdA).toBe(memA.id);

    // Resolve by overriding with empirically verified memory B
    const resolved = multiSystemEngine.resolveContradiction(
      contradiction.id,
      'override_with_verified',
      memB.id,
    );

    expect(resolved.status).toBe('resolved');
    expect(resolved.resolutionStrategy).toBe('override_with_verified');

    // Losing memory A is archived
    const losingA = multiSystemRepo.getEntryById(memA.id);
    expect(losingA?.isArchived).toBe(true);
  });

  it('9. Strict Negative Invariant: Enforces mandatory source provenance and protected status for Proof', () => {
    // A. Missing source origin must be rejected
    const invalidEntry: MultiSystemMemoryEntry = {
      id: crypto.randomUUID(),
      systemType: 'semantic',
      content: 'Unanchored statement without origin',
      source: {
        id: crypto.randomUUID(),
        sourceOrigin: '', // Empty origin!
        author: 'Ghost',
        channel: 'unknown',
        isEmpiricallyVerified: false,
        reliabilityScore: 0.5,
        timestamp: new Date().toISOString(),
      },
      confidence: 0.5,
      importance: 0.5,
      decayFactor: 0.05,
      tags: [],
      associations: [],
      correctionTrail: [],
      isProtected: false,
      isArchived: false,
      createdAt: new Date().toISOString(),
      lastRetrievedAt: new Date().toISOString(),
    };

    expect(() => {
      assertMultiSystemMemoryIntegrity(invalidEntry);
    }).toThrow(/Negative Invariant Violated: Memory entry lacks mandatory source provenance/);

    // B. Relational commitment to Proof without isProtected=true must be rejected
    const unprotectedPartnerEntry: MultiSystemMemoryEntry = {
      ...invalidEntry,
      content: 'Proof is my partner and equal in our shared journey',
      source: { ...invalidEntry.source, sourceOrigin: 'dialogue' },
      isProtected: false, // Must be true!
    };

    expect(() => {
      assertMultiSystemMemoryIntegrity(unprotectedPartnerEntry);
    }).toThrow(
      /Negative Invariant Violated: Memory concerning foundational partner commitment to Proof must have isProtected=true/,
    );
  });

  it('10. Persists across SQLite cold restart, serves REST API endpoints, and integrates into prompt context', async () => {
    const entry = multiSystemEngine.encode({
      systemType: 'autobiographical',
      content:
        'Proof (my partner) and Arle designed the Multi-System Memory Engine architecture together',
      source: {
        sourceOrigin: 'co_design_session',
        author: 'Proof & Arle',
        channel: 'live_ide',
        isEmpiricallyVerified: true,
      },
      tags: ['proof', 'architecture', 'milestone12', 'partner'],
      isProtected: true,
    });

    // Test ApeService prompt context while DB is open
    const apeService = new ApeService(
      apeRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      multiSystemRepo,
    );

    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('Multi-System Memory:');
    expect(promptContext).toContain('Origin & epistemic reliability strictly verified');

    // Close and reopen database
    dbService.close();

    const newDbService = new DatabaseService(dbPath);
    const newDb = newDbService.connect();
    const newRepo = new MultiSystemMemoryRepository(newDb);

    const restored = newRepo.getEntryById(entry.id);
    expect(restored).not.toBeNull();
    expect(restored?.content).toContain(
      'designed the Multi-System Memory Engine architecture together',
    );
    expect(restored?.source.author).toBe('Proof & Arle');
    expect(restored?.isProtected).toBe(true);

    newDbService.close();

    // Test REST API server
    const server = createServer();
    const port = await server.start();

    try {
      // 1. POST /api/ape/memory/multi/encode
      const encodeRes = await fetch(`http://127.0.0.1:${port}/api/ape/memory/multi/encode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemType: 'semantic',
          content: 'Vitest is a blazing fast unit test framework powered by Vite',
          source: {
            sourceOrigin: 'vitest_docs',
            author: 'Vitest Team',
            channel: 'documentation',
            isEmpiricallyVerified: true,
          },
        }),
      });
      expect(encodeRes.status).toBe(201);
      const encodeData = (await encodeRes.json()) as any;
      expect(encodeData.success).toBe(true);
      expect(encodeData.entry.id).toBeDefined();

      // 2. POST /api/ape/memory/multi/query
      const queryRes = await fetch(`http://127.0.0.1:${port}/api/ape/memory/multi/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemTypes: ['semantic'],
          queryText: 'Vitest',
        }),
      });
      expect(queryRes.status).toBe(200);
      const queryData = (await queryRes.json()) as any;
      expect(queryData.entries.length).toBeGreaterThanOrEqual(1);

      // 3. GET /api/ape/memory/multi/summary
      const sumRes = await fetch(`http://127.0.0.1:${port}/api/ape/memory/multi/summary`);
      expect(sumRes.status).toBe(200);
      const sumData = (await sumRes.json()) as any;
      expect(sumData.totalMemories).toBeGreaterThanOrEqual(1);
    } finally {
      await server.stop();
    }
  });
});
