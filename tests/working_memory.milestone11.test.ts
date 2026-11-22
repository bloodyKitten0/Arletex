import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { WorkingMemoryBuffer, assertWorkingMemoryCapacityIntegrity } from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  WorkingMemoryEngine,
  InMemoryWorkingMemoryRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  WorkingMemoryRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 11 — Working Memory', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let workingMemoryRepo: WorkingMemoryRepository;
  let apeRepo: ApeRepository;
  let workingMemoryEngine: WorkingMemoryEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m11-wm-'));
    dbPath = path.join(tempDir, 'working_memory_m11.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    workingMemoryRepo = new WorkingMemoryRepository(db);
    apeRepo = new ApeRepository(db);
    workingMemoryEngine = new WorkingMemoryEngine({
      repository: workingMemoryRepo,
      defaultCapacity: 7,
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

  it('1. Initializes active task context with bounded capacity', () => {
    const buffer = workingMemoryEngine.initializeTaskContext(
      'task_quantum_alg',
      'Optimize Quantum Gate Sequence with Proof',
      7,
    );

    expect(buffer.id).toBeDefined();
    expect(buffer.taskId).toBe('task_quantum_alg');
    expect(buffer.goalTitle).toBe('Optimize Quantum Gate Sequence with Proof');
    expect(buffer.maxCapacity).toBe(7);
    expect(buffer.items).toHaveLength(0);
    expect(buffer.usedSlots).toBe(0);

    const active = workingMemoryEngine.getActiveBuffer();
    expect(active?.taskId).toBe('task_quantum_alg');
  });

  it('2. Retains temporary information across differentiated categories with slot indexing', () => {
    workingMemoryEngine.initializeTaskContext('task_refactor', 'Refactor Engine Architecture');

    const item1 = workingMemoryEngine.retainItem({
      slotKey: 'target_module',
      category: 'task_variable',
      content: { path: 'packages/core/src/ape/workingMemoryEngine.ts', lines: 350 },
      summary: 'Target refactoring file is workingMemoryEngine.ts',
      priority: 0.8,
    });

    const item2 = workingMemoryEngine.retainItem({
      slotKey: 'latency_constraint',
      category: 'constraint',
      content: { maxResponseMs: 150 },
      summary: 'Inference pipeline latency must stay under 150ms',
      priority: 0.9,
    });

    expect(item1.slotKey).toBe('target_module');
    expect(item1.version).toBe(1);
    expect(item2.category).toBe('constraint');

    const fetched = workingMemoryEngine.getItem('target_module');
    expect(fetched?.content.lines).toBe(350);
  });

  it('3. Manipulates working memory items with audit versioning', () => {
    workingMemoryEngine.initializeTaskContext('task_debug', 'Debug Pipeline');

    workingMemoryEngine.retainItem({
      slotKey: 'hypothesis_leak',
      category: 'hypothesis',
      content: { suspect: 'event_listener_leak', confidence: 0.6 },
      summary: 'Suspecting EventEmitter leak in notification listener',
      priority: 0.7,
    });

    // Manipulate / update hypothesis based on new empirical evidence
    const manipulated = workingMemoryEngine.manipulateItem('hypothesis_leak', (prev) => ({
      content: {
        suspect: 'event_listener_leak',
        confidence: 0.95,
        verifiedCulprit: 'dbus-monitor child process',
      },
      summary: 'Confirmed: dbus-monitor child process signal handling was unclosed',
      priority: 0.95,
    }));

    expect(manipulated.version).toBe(2);
    expect(manipulated.priority).toBe(0.95);
    expect(manipulated.content.verifiedCulprit).toBe('dbus-monitor child process');

    const retrieved = workingMemoryEngine.getItem('hypothesis_leak');
    expect(retrieved?.version).toBe(2);
    expect(retrieved?.summary).toContain('Confirmed');
  });

  it('4. Juggles multiple simultaneous considerations without interference', () => {
    workingMemoryEngine.initializeTaskContext(
      'task_deliberation',
      'Deliberate Architectural Decisions',
    );

    workingMemoryEngine.addConsideration(
      'Ensure partner equality invariant with Proof is preserved',
    );
    workingMemoryEngine.addConsideration(
      'Maintain sub-100ms latency on working memory slot queries',
    );
    workingMemoryEngine.addConsideration(
      'Prevent prompt blowup through compact state summarization',
    );

    const considerations = workingMemoryEngine.getConsiderations();
    expect(considerations).toHaveLength(3);
    expect(considerations).toContain('Ensure partner equality invariant with Proof is preserved');

    // Duplicate addition should be idempotent
    workingMemoryEngine.addConsideration(
      'Ensure partner equality invariant with Proof is preserved',
    );
    expect(workingMemoryEngine.getConsiderations()).toHaveLength(3);

    // Removal
    workingMemoryEngine.removeConsideration(
      'Maintain sub-100ms latency on working memory slot queries',
    );
    expect(workingMemoryEngine.getConsiderations()).toHaveLength(2);
  });

  it('5. Preserves sequential intermediate reasoning steps', () => {
    workingMemoryEngine.initializeTaskContext('task_math_proof', 'Verify Cryptographic Assertion');

    const step1 = workingMemoryEngine.recordIntermediateStep({
      goal: 'Verify discrete logarithm hardness in group G',
      premise: 'Group order is a 256-bit safe prime p = 2q + 1',
      intermediateConclusion: 'Subgroup of order q resists Pohlig-Hellman reduction',
      confidence: 1.0,
      derivationNotes: 'Checked prime properties via Miller-Rabin test',
    });

    const step2 = workingMemoryEngine.recordIntermediateStep({
      goal: 'Confirm Pollard rho complexity',
      premise: 'Subgroup size is ~2^255',
      intermediateConclusion:
        'Expected collision search takes ~2^128 operations (standard security tier)',
      confidence: 0.99,
    });

    expect(step1.stepNumber).toBe(1);
    expect(step2.stepNumber).toBe(2);

    const steps = workingMemoryEngine.getIntermediateSteps();
    expect(steps).toHaveLength(2);
    expect(steps[1]?.goal).toContain('Pollard rho complexity');
    expect(steps[1]?.intermediateConclusion).toContain(
      'Expected collision search takes ~2^128 operations',
    );
  });

  it('6. Enforces capacity limits and evicts lowest-value items when buffer overflows', () => {
    // Capacity strictly set to 4 slots
    workingMemoryEngine.initializeTaskContext('task_capacity', 'Capacity Test Task', 4);

    workingMemoryEngine.retainItem({
      slotKey: 'slot_1',
      category: 'task_variable',
      content: 'val1',
      summary: 'High priority invariant',
      priority: 0.9,
    });

    workingMemoryEngine.retainItem({
      slotKey: 'slot_2',
      category: 'task_variable',
      content: 'val2',
      summary: 'Essential partner instruction',
      priority: 0.95,
    });

    workingMemoryEngine.retainItem({
      slotKey: 'slot_3',
      category: 'task_variable',
      content: 'val3',
      summary: 'Medium priority variable',
      priority: 0.6,
    });

    workingMemoryEngine.retainItem({
      slotKey: 'slot_4',
      category: 'task_variable',
      content: 'val4',
      summary: 'Disposable scratchpad note',
      priority: 0.1, // Lowest priority!
    });

    const activeBuf = workingMemoryEngine.getActiveBuffer();
    expect(activeBuf?.items).toHaveLength(4);

    // Adding 5th item must evict slot_4 (lowest priority 0.1)
    workingMemoryEngine.retainItem({
      slotKey: 'slot_5',
      category: 'task_variable',
      content: 'val5',
      summary: 'New critical constraint',
      priority: 0.85,
    });

    const updatedBuf = workingMemoryEngine.getActiveBuffer();
    expect(updatedBuf?.items).toHaveLength(4); // Strictly maintained at maxCapacity 4
    expect(workingMemoryEngine.getItem('slot_4')).toBeNull(); // Evicted!
    expect(workingMemoryEngine.getItem('slot_1')).not.toBeNull();
    expect(workingMemoryEngine.getItem('slot_2')).not.toBeNull();
    expect(workingMemoryEngine.getItem('slot_5')).not.toBeNull();
  });

  it('7. Strict Negative Invariant: Rejects over-capacity buffer states', () => {
    const invalidBuffer: WorkingMemoryBuffer = {
      id: crypto.randomUUID(),
      taskId: 'illegal_task',
      goalTitle: 'Illegal Task',
      items: [
        {
          id: crypto.randomUUID(),
          slotKey: '1',
          category: 'task_variable',
          content: null,
          summary: '1',
          priority: 0.5,
          createdAt: '',
          lastAccessedAt: '',
          version: 1,
        },
        {
          id: crypto.randomUUID(),
          slotKey: '2',
          category: 'task_variable',
          content: null,
          summary: '2',
          priority: 0.5,
          createdAt: '',
          lastAccessedAt: '',
          version: 1,
        },
        {
          id: crypto.randomUUID(),
          slotKey: '3',
          category: 'task_variable',
          content: null,
          summary: '3',
          priority: 0.5,
          createdAt: '',
          lastAccessedAt: '',
          version: 1,
        },
      ],
      intermediateSteps: [],
      considerations: [],
      maxCapacity: 2, // Capacity is 2, but 3 items present!
      usedSlots: 3,
      updatedAt: new Date().toISOString(),
    };

    expect(() => {
      assertWorkingMemoryCapacityIntegrity(invalidBuffer);
    }).toThrow(/Negative Invariant Violated: Working memory exceeded capacity limit/);
  });

  it('8. Takes snapshots and recovers context seamlessly after task interruptions', () => {
    workingMemoryEngine.initializeTaskContext(
      'task_interrupted',
      'Long-running multi-phase research',
    );

    workingMemoryEngine.retainItem({
      slotKey: 'checkpoint_state',
      category: 'intermediate_step',
      content: { phase: 3, completedModules: ['lexer', 'parser'] },
      summary: 'Completed phase 3 lexer and parser stages',
      priority: 0.9,
    });

    workingMemoryEngine.addConsideration('Evaluate AST optimization pass next');
    workingMemoryEngine.recordIntermediateStep({
      goal: 'Validate parser grammar',
      premise: 'Grammar is LALR(1) with 0 shift/reduce conflicts',
      intermediateConclusion: 'Grammar verified conflict-free',
    });

    // Create snapshot prior to pause/interruption
    const snapshot = workingMemoryEngine.createSnapshot('User switched tasks');
    expect(snapshot.id).toBeDefined();
    expect(snapshot.consolidatedSummary).toContain('checkpoint_state');

    // Simulate recovery in a fresh context
    const recovered = workingMemoryEngine.recoverContext('task_interrupted');
    expect(recovered.taskId).toBe('task_interrupted');
    expect(recovered.items).toHaveLength(1);
    expect(recovered.considerations).toContain('Evaluate AST optimization pass next');
    expect(recovered.intermediateSteps).toHaveLength(1);
    expect(recovered.items[0]?.slotKey).toBe('checkpoint_state');
  });

  it('9. Fulfills Acceptance Criteria: Synthesizes high-density working memory summary without prompt bloating', () => {
    workingMemoryEngine.initializeTaskContext('task_complex', 'Multi-System Integration');

    workingMemoryEngine.retainItem({
      slotKey: 'active_branch',
      category: 'task_variable',
      content: 'main',
      summary: 'Branch main is ahead by 3 commits',
      priority: 0.8,
    });

    workingMemoryEngine.addConsideration('Ensure all 42 test files remain green');
    workingMemoryEngine.recordIntermediateStep({
      goal: 'Verify typechecks',
      premise: 'Ran pnpm run typecheck across 5 projects',
      intermediateConclusion: 'Zero type errors detected',
    });

    const summary = workingMemoryEngine.getWorkingMemorySummary();

    // Must be compact, structured, and informative
    expect(summary).toContain('Working Memory (Multi-System Integration)');
    expect(summary).toContain('[active_branch (v1)]: Branch main is ahead by 3 commits');
    expect(summary).toContain('Ensure all 42 test files remain green');
    expect(summary).toContain('Zero type errors detected');
    // Summary must stay bounded and concise
    expect(summary.length).toBeLessThan(400);
  });

  it('10. Persists across SQLite cold restart, serves REST API endpoints, and integrates into prompt context', async () => {
    workingMemoryEngine.initializeTaskContext('task_rest_api', 'Verify REST API Integration', 7);

    workingMemoryEngine.retainItem({
      slotKey: 'server_port',
      category: 'task_variable',
      content: { port: 3000 },
      summary: 'Default desktop port is 3000',
      priority: 0.8,
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
      workingMemoryRepo,
    );

    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('Working Memory');
    expect(promptContext).toContain('server_port');
    expect(promptContext).toContain('Default desktop port is 3000');

    // Close and reopen database
    dbService.close();

    const newDbService = new DatabaseService(dbPath);
    const newDb = newDbService.connect();
    const newRepo = new WorkingMemoryRepository(newDb);

    const restoredBuf = newRepo.getBufferByTaskId('task_rest_api');
    expect(restoredBuf).not.toBeNull();
    expect(restoredBuf?.goalTitle).toBe('Verify REST API Integration');
    expect(restoredBuf?.items[0]?.slotKey).toBe('server_port');

    newDbService.close();

    // Test REST API server
    const server = createServer();
    const port = await server.start();

    try {
      // 1. POST /api/ape/working-memory/context
      const ctxRes = await fetch(`http://127.0.0.1:${port}/api/ape/working-memory/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: 'task_http_session',
          goalTitle: 'Live HTTP Task Context',
          maxCapacity: 7,
        }),
      });
      expect(ctxRes.status).toBe(201);
      const ctxData = (await ctxRes.json()) as any;
      expect(ctxData.success).toBe(true);
      expect(ctxData.buffer.taskId).toBe('task_http_session');

      // 2. POST /api/ape/working-memory/item
      const itemRes = await fetch(`http://127.0.0.1:${port}/api/ape/working-memory/item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotKey: 'client_connection',
          category: 'task_variable',
          content: { ip: '127.0.0.1', authenticated: true },
          summary: 'Authenticated loopback client connected',
          priority: 0.9,
        }),
      });
      expect(itemRes.status).toBe(201);
      const itemData = (await itemRes.json()) as any;
      expect(itemData.success).toBe(true);
      expect(itemData.item.slotKey).toBe('client_connection');

      // 3. GET /api/ape/working-memory/item?key=client_connection
      const getItemRes = await fetch(
        `http://127.0.0.1:${port}/api/ape/working-memory/item?key=client_connection`,
      );
      expect(getItemRes.status).toBe(200);
      const getItemData = (await getItemRes.json()) as any;
      expect(getItemData.summary).toContain('Authenticated loopback client connected');

      // 4. POST /api/ape/working-memory/step
      const stepRes = await fetch(`http://127.0.0.1:${port}/api/ape/working-memory/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: 'Verify loopback REST call',
          premise: 'HTTP GET /api/ape/working-memory/item returned 200',
          intermediateConclusion: 'Working memory REST endpoints operating correctly',
        }),
      });
      expect(stepRes.status).toBe(201);
      const stepData = (await stepRes.json()) as any;
      expect(stepData.step.stepNumber).toBe(1);

      // 5. GET /api/ape/working-memory/summary
      const sumRes = await fetch(`http://127.0.0.1:${port}/api/ape/working-memory/summary`);
      expect(sumRes.status).toBe(200);
      const sumData = (await sumRes.json()) as any;
      expect(sumData.summary).toContain('client_connection');
    } finally {
      await server.stop();
    }
  });
});
