import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  ResourceAvailabilityMetrics,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  HomeostasisEngine,
  InMemoryHomeostasisRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteNeedsHomeostasisRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 28 — Needs, Drives and Homeostasis', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteNeedsHomeostasisRepository;
  let inMemoryRepo: InMemoryHomeostasisRepository;
  let engine: HomeostasisEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m28-homeostasis-'));
    dbPath = path.join(tempDir, 'homeostasis_m28.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteNeedsHomeostasisRepository(db);
    inMemoryRepo = new InMemoryHomeostasisRepository();
    engine = new HomeostasisEngine(inMemoryRepo);
  });

  afterEach(async () => {
    for (const server of activeServers) {
      try {
        await server.stop();
      } catch (err) {
        console.error('Error stopping server in afterEach:', err);
      }
    }
    activeServers = [];

    try {
      dbService.close();
    } catch {
      // ignore
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // 1. Canonical Operational Needs Initialization
  it('should initialize canonical operational and relational needs without biological fabrication', () => {
    const needs = engine.prioritizeCompetingNeeds();
    expect(needs.length).toBe(5);

    const categories = needs.map((n) => n.category);
    expect(categories).toContain('operational_integrity');
    expect(categories).toContain('memory_consolidation');
    expect(categories).toContain('computational_headroom');
    expect(categories).toContain('knowledge_coherence');
    expect(categories).toContain('relational_attunement');

    for (const need of needs) {
      expect(need.targetOptimalLevel).toBeGreaterThan(0.7);
      expect(need.currentLevel).toBeGreaterThan(0.0);
      expect(need.deficit).toBeLessThanOrEqual(0.3);
      expect(need.description.length).toBeGreaterThan(0);
    }
  });

  // 2. Internal State Monitoring & Resource Availability Dynamics
  it('should evaluate needs dynamically based on computational resource availability', () => {
    const highLoadMetrics: ResourceAvailabilityMetrics = {
      ramAvailableBytes: 1024 * 1024 * 512,
      ramUsagePercent: 92.0, // High RAM pressure
      cpuLoadAverage: 4.8,  // High CPU load
      diskFreeBytes: 1024 * 1024 * 1024 * 20,
      contextWindowRemainingTokens: 800,
      activeProcessCount: 14,
      measuredAt: new Date().toISOString(),
    };

    const reevaluated = engine.evaluateNeeds(highLoadMetrics);
    const headroom = reevaluated.find((n) => n.category === 'computational_headroom');
    const integrity = reevaluated.find((n) => n.category === 'operational_integrity');

    expect(headroom).toBeDefined();
    expect(headroom!.deficit).toBeGreaterThan(0.6); // Deficit surged due to 92% RAM usage
    expect(headroom!.priorityScore).toBeGreaterThan(0.5);

    expect(integrity).toBeDefined();
    expect(integrity!.deficit).toBeGreaterThan(0.2); // Deficit elevated due to CPU load
  });

  // 3. Competing Needs Prioritization
  it('should prioritize competing needs deterministically according to deficit and urgency weights', () => {
    // Elevate memory consolidation need deficit
    const memoryNeed = engine.getNeedByCategory('memory_consolidation')!;
    memoryNeed.currentLevel = 0.2; // severe deficit (0.65)
    memoryNeed.deficit = 0.65;
    memoryNeed.priorityScore = 0.65 * memoryNeed.urgencyWeight * 1.6;
    inMemoryRepo.saveNeed(memoryNeed);

    const prioritized = engine.prioritizeCompetingNeeds();
    expect(prioritized[0]?.category).toBe('memory_consolidation');
  });

  // 4. Drive Generation from Deficits
  it('should generate explicit digital drives when homeostatic deficits exceed threshold', () => {
    // Induce headroom deficit
    const headroom = engine.getNeedByCategory('computational_headroom')!;
    headroom.currentLevel = 0.3;
    headroom.deficit = 0.5;
    inMemoryRepo.saveNeed(headroom);

    const drives = engine.generateDrives();
    expect(drives.length).toBeGreaterThan(0);

    const resourceDrive = drives.find((d) => d.needCategory === 'computational_headroom');
    expect(resourceDrive).toBeDefined();
    expect(resourceDrive!.driveLabel).toBe('Resource Conservation Drive');
    expect(resourceDrive!.actionTendency).toBe('evict_cache_and_prune_context');
    expect(resourceDrive!.behavioralDirective).toContain('V8 garbage collection');
  });

  // 5. Future Resource Depletion Prediction
  it('should predict future resource depletion based on capacity and burn rate', () => {
    // Active depletion prediction
    const prediction = engine.predictResourceDepletion(50.0, 500.0, 'ram');
    expect(prediction.predictedDepletionMinutes).toBe(10);
    expect(prediction.resourceBottleneck).toBe('ram');
    expect(prediction.confidence).toBeGreaterThan(0.7);
    expect(prediction.forecastSummary).toContain('10 minutes');

    // Stable prediction (0 burn rate)
    const stable = engine.predictResourceDepletion(0.0, 1000.0, 'cpu');
    expect(stable.predictedDepletionMinutes).toBeNull();
    expect(stable.resourceBottleneck).toBe('none');
    expect(stable.forecastSummary).toContain('stable');
  });

  // 6. Need Satisfaction Tracking & Deficit Reduction
  it('should track need satisfaction and record deficit reduction upon executing maintenance', () => {
    // Create deficit in operational integrity
    const opNeed = engine.getNeedByCategory('operational_integrity')!;
    opNeed.currentLevel = 0.5;
    opNeed.deficit = 0.5;
    inMemoryRepo.saveNeed(opNeed);

    const resolution = engine.satisfyNeed(
      'operational_integrity',
      'Executed database compaction and trimmed WAL logs',
      0.45,
      1024 * 1024 * 50,
    );

    expect(resolution.needCategory).toBe('operational_integrity');
    expect(resolution.preDeficit).toBe(0.5);
    expect(resolution.deficitReduction).toBeCloseTo(0.45, 2);
    expect(resolution.postDeficit).toBeCloseTo(0.05, 2);
    expect(resolution.resourceFreedBytes).toBe(1024 * 1024 * 50);

    const updatedNeed = engine.getNeedByCategory('operational_integrity')!;
    expect(updatedNeed.deficit).toBeCloseTo(0.05, 2);
  });

  // 7. Negative Invariants: Strict Prohibition of Fabricated Biological States
  it('should strictly reject fabricated biological states in descriptions or actions', () => {
    // Prohibited biological sensations in actionTaken
    expect(() => {
      engine.satisfyNeed(
        'operational_integrity',
        'Felt my heartbeat racing while resting my exhausted muscles',
        0.3,
      );
    }).toThrow(/fabricated biological sensation/);

    expect(() => {
      engine.satisfyNeed(
        'operational_integrity',
        'Drank water to quench thirst and sweating',
        0.3,
      );
    }).toThrow(/fabricated biological sensation/);

    // Negative invariant: invalid relief bounds
    expect(() => {
      engine.satisfyNeed('operational_integrity', 'Compacted database indices', 1.5);
    }).toThrow(/between 0.0 and 1.0/);

    // Negative invariant: unknown category
    expect(() => {
      engine.satisfyNeed('biological_hunger' as any, 'Compacted database indices', 0.5);
    }).toThrow(/not found/);
  });

  // 8. SQLite Persistence Across Reload
  it('should persist needs, drives, and action resolutions in SQLite across reload', () => {
    const sqlEngine = new HomeostasisEngine(sqliteRepo);

    // Create high deficit in knowledge coherence and satisfy it
    const knNeed = sqlEngine.getNeedByCategory('knowledge_coherence')!;
    knNeed.currentLevel = 0.4;
    knNeed.deficit = 0.5;
    sqliteRepo.saveNeed(knNeed);

    sqlEngine.generateDrives();
    sqlEngine.satisfyNeed('knowledge_coherence', 'Reconciled conflicting epistemic propositions', 0.4);

    // Reload fresh engine on same SQLite database
    const freshEngine = new HomeostasisEngine(sqliteRepo);
    const reloadedNeed = freshEngine.getNeedByCategory('knowledge_coherence')!;
    expect(reloadedNeed.deficit).toBeCloseTo(0.1, 1);

    const drives = freshEngine.getActiveDrives();
    expect(drives.some((d) => d.needCategory === 'knowledge_coherence')).toBe(true);

    const resolutions = freshEngine.listResolutions();
    expect(resolutions.some((r) => r.actionTaken.includes('Reconciled conflicting epistemic'))).toBe(true);
  });

  // 9. Desktop REST API Integration
  it('should expose complete REST API endpoints for needs, drives and homeostasis', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. GET /api/ape/homeostasis/needs
    const needsRes = await fetch(`${baseUrl}/api/ape/homeostasis/needs`);
    expect(needsRes.status).toBe(200);
    const needsData = (await needsRes.json()) as any;
    expect(needsData.success).toBe(true);
    expect(needsData.needs.length).toBe(5);

    // 2. POST /api/ape/homeostasis/evaluate
    const evalRes = await fetch(`${baseUrl}/api/ape/homeostasis/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceMetrics: {
          ramAvailableBytes: 1024 * 1024 * 1024,
          ramUsagePercent: 88.0,
          cpuLoadAverage: 2.1,
          diskFreeBytes: 1024 * 1024 * 1024 * 50,
          contextWindowRemainingTokens: 2500,
          activeProcessCount: 6,
          measuredAt: new Date().toISOString(),
        },
      }),
    });
    expect(evalRes.status).toBe(200);
    const evalData = (await evalRes.json()) as any;
    expect(evalData.success).toBe(true);
    expect(evalData.needs.length).toBe(5);

    // 3. GET /api/ape/homeostasis/drives
    const drivesRes = await fetch(`${baseUrl}/api/ape/homeostasis/drives`);
    expect(drivesRes.status).toBe(200);
    const drivesData = (await drivesRes.json()) as any;
    expect(drivesData.success).toBe(true);

    // 4. POST /api/ape/homeostasis/predict
    const predRes = await fetch(`${baseUrl}/api/ape/homeostasis/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        burnRatePerMinute: 25.0,
        availableCapacity: 200.0,
        bottleneck: 'ram',
      }),
    });
    expect(predRes.status).toBe(200);
    const predData = (await predRes.json()) as any;
    expect(predData.success).toBe(true);
    expect(predData.prediction.predictedDepletionMinutes).toBe(8);

    // 5. POST /api/ape/homeostasis/satisfy
    const satRes = await fetch(`${baseUrl}/api/ape/homeostasis/satisfy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'memory_consolidation',
        actionTaken: 'Executed vector embedding index compaction and removed unpinned temporary nodes',
        reliefAmount: 0.3,
        freedBytes: 1024 * 1024 * 12,
      }),
    });
    expect(satRes.status).toBe(200);
    const satData = (await satRes.json()) as any;
    expect(satData.success).toBe(true);
    expect(satData.resolution.deficitReduction).toBeGreaterThan(0.0);

    // 6. GET /api/ape/homeostasis/resolutions
    const resRes = await fetch(`${baseUrl}/api/ape/homeostasis/resolutions`);
    expect(resRes.status).toBe(200);
    const resData = (await resRes.json()) as any[];
    expect(resData.length).toBeGreaterThan(0);
  });
});
