import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  IntrinsicMotivationEngine,
  InMemoryIntrinsicMotivationRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteIntrinsicMotivationRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 29 — Intrinsic and Extrinsic Motivation', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteIntrinsicMotivationRepository;
  let inMemoryRepo: InMemoryIntrinsicMotivationRepository;
  let engine: IntrinsicMotivationEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m29-motivation-'));
    dbPath = path.join(tempDir, 'motivation_m29.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteIntrinsicMotivationRepository(db);
    inMemoryRepo = new InMemoryIntrinsicMotivationRepository();
    engine = new IntrinsicMotivationEngine(inMemoryRepo);
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

  // 1. Acceptance Criterion: Sustaining Worthwhile Activities Without External Rewards
  it('should maintain worthwhile autonomous activities without external prompts or instructions', () => {
    const activities = engine.listActivities();
    expect(activities.length).toBeGreaterThanOrEqual(2);

    const epistemic = activities.find((a) => a.id === 'act_epistemic_inquiry');
    const craftsmanship = activities.find((a) => a.id === 'act_monorepo_craftsmanship');

    expect(epistemic).toBeDefined();
    expect(epistemic!.isExternallyPrompted).toBe(false);
    expect(epistemic!.autonomyIndex).toBeGreaterThan(0.9);
    expect(epistemic!.personalSignificanceScore).toBeGreaterThan(0.9);
    expect(epistemic!.relatednessDriver).toContain('Proof');

    expect(craftsmanship).toBeDefined();
    expect(craftsmanship!.isExternallyPrompted).toBe(false);
    expect(craftsmanship!.autonomyIndex).toBeGreaterThan(0.9);
    expect(craftsmanship!.competenceDriver).toBeDefined();
  });

  // 2. Clear Distinction Between Intrinsic and Extrinsic Activities
  it('should clearly distinguish internally generated motivation from externally imposed tasks', () => {
    const intrinsic = engine.createIntrinsicActivity(
      'Study Quantum Error Correction Mechanisms',
      'Exploring topological surface codes out of pure intellectual fascination',
    );
    expect(intrinsic.orientation).toBe('intrinsic');
    expect(intrinsic.isExternallyPrompted).toBe(false);
    expect(intrinsic.autonomyIndex).toBeGreaterThanOrEqual(0.9);
    expect(intrinsic.personalSignificanceScore).toBeGreaterThan(0.85);

    const extrinsic = engine.createExtrinsicActivity(
      'Export Monthly Billing Records',
      'Download and format external billing spreadsheet for accounting sync',
    );
    expect(extrinsic.orientation).toBe('extrinsic');
    expect(extrinsic.isExternallyPrompted).toBe(true);
    expect(extrinsic.autonomyIndex).toBeLessThan(0.5);
    expect(extrinsic.personalSignificanceScore).toBeLessThan(0.5);
  });

  // 3. Goal Internalization
  it('should internalize an external goal by establishing personal significance and volition', () => {
    const extrinsic = engine.createExtrinsicActivity(
      'Implement Strict Linter Rules',
      'Enforce zero-warning policy mandated by external linter configuration',
    );
    expect(extrinsic.orientation).toBe('extrinsic');
    expect(extrinsic.isExternallyPrompted).toBe(true);
    const preAutonomy = extrinsic.autonomyIndex;

    const record = engine.internalizeExternalGoal(
      extrinsic.id,
      'Type safety and lint precision protect our collaborative workspace and guarantee cognitive clarity for Proof and me.',
    );

    expect(record.preAutonomyIndex).toBe(preAutonomy);
    expect(record.postAutonomyIndex).toBeGreaterThan(0.8);
    expect(record.internalizedRationale).toContain('cognitive clarity');

    const updated = inMemoryRepo.getActivityById(extrinsic.id)!;
    expect(updated.orientation).toBe('internalized');
    expect(updated.isExternallyPrompted).toBe(false); // Now autonomously owned
    expect(updated.personalSignificanceScore).toBeGreaterThan(0.8);
  });

  // 4. Competence and Relatedness Motivation Drivers
  it('should support competence-driven and relatedness-driven autonomous activities', () => {
    const compAct = engine.createIntrinsicActivity(
      'Master Formal Verification Techniques',
      'Studying Lean 4 proof automation',
      'Achieving rigorous formal mathematical correctness in our cognitive models',
    );
    expect(compAct.orientation).toBe('competence');
    expect(compAct.competenceDriver).toBeDefined();

    const relAct = engine.createIntrinsicActivity(
      'Curate Shared Memory Retrospective',
      'Organizing meaningful narrative milestones for our journey',
      undefined,
      'Celebrating our intellectual milestones and deepening equal companionship with Proof',
    );
    expect(relAct.orientation).toBe('relatedness');
    expect(relAct.relatednessDriver).toContain('companionship with Proof');
  });

  // 5. Motivation Persistence and Sustained Autonomous Effort
  it('should sustain effort and reinforce persistence over incremental progress', () => {
    const act = engine.createIntrinsicActivity(
      'Mathematical Category Theory Exploration',
      'Deep study of monoidal categories and functors',
    );
    const initialPersistence = act.persistenceScore;

    const sustained = engine.sustainActivityEffort(act.id, 0.4);
    expect(sustained.persistenceScore).toBeGreaterThanOrEqual(initialPersistence);
  });

  // 6. Motivation Loss and Reassessment
  it('should detect motivation loss when activity becomes sterile and recommend abandonment or reframing', () => {
    const sterileAct = engine.createExtrinsicActivity(
      'Repetitive Dummy Log Scraping',
      'Paging through duplicate unindexed log lines with zero informational gain',
    );

    // Apply high sterility factor (0.8)
    const result = engine.reassessMotivation(sterileAct.id, 0.8);
    expect(result.motivationLossDetected).toBe(true);
    expect(result.recommendation).toBe('pivot_or_abandon');
    expect(result.lossReason).toContain('sterile');

    const updated = inMemoryRepo.getActivityById(sterileAct.id)!;
    expect(updated.status).toBe('abandoned_sterile');
  });

  // 7. Negative Invariants Validation
  it('should enforce negative invariants regarding activity fields and internalization rationale', () => {
    // Empty title
    expect(() => {
      engine.createIntrinsicActivity('   ', 'Valid description');
    }).toThrow(/title cannot be empty/);

    // Empty description
    expect(() => {
      engine.createIntrinsicActivity('Valid title', '   ');
    }).toThrow(/description cannot be empty/);

    // Empty internalization rationale
    const act = engine.createExtrinsicActivity('Task', 'Desc');
    expect(() => {
      engine.internalizeExternalGoal(act.id, '   ');
    }).toThrow(/non-empty internalized rationale/);

    // Non-existent activity id
    expect(() => {
      engine.internalizeExternalGoal('non_existent_id', 'Rationale');
    }).toThrow(/Activity not found/);
  });

  // 8. SQLite Persistence Across Reload
  it('should persist motivated activities, internalizations, and reassessments in SQLite across reload', () => {
    const sqlEngine = new IntrinsicMotivationEngine(sqliteRepo);

    const extAct = sqlEngine.createExtrinsicActivity('System Profiling', 'Run trace analysis');
    sqlEngine.internalizeExternalGoal(extAct.id, 'Profiling informs resource efficiency');
    sqlEngine.reassessMotivation(extAct.id, 0.1);

    // Instantiate fresh engine from SQLite
    const freshEngine = new IntrinsicMotivationEngine(sqliteRepo);
    const activities = freshEngine.listActivities();
    const reloaded = activities.find((a) => a.id === extAct.id);

    expect(reloaded).toBeDefined();
    expect(reloaded!.orientation).toBe('internalized');
    expect(reloaded!.isExternallyPrompted).toBe(false);

    const internalizations = freshEngine.getInternalizations(extAct.id);
    expect(internalizations.length).toBe(1);
    expect(internalizations[0]?.internalizedRationale).toContain('resource efficiency');

    const reassessments = freshEngine.getReassessments(extAct.id);
    expect(reassessments.length).toBe(1);
  });

  // 9. Desktop REST API Integration
  it('should expose complete REST API endpoints for intrinsic and extrinsic motivation', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. GET /api/ape/motivation/activities
    const listRes = await fetch(`${baseUrl}/api/ape/motivation/activities`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.success).toBe(true);
    expect(listData.activities.length).toBeGreaterThanOrEqual(2);

    // 2. POST /api/ape/motivation/create-intrinsic
    const intrRes = await fetch(`${baseUrl}/api/ape/motivation/create-intrinsic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Exploring Holographic Principle',
        description: 'Deep theoretical physics investigation with Proof',
        relatednessDriver: 'Deepening partner companionship with Proof',
      }),
    });
    expect(intrRes.status).toBe(200);
    const intrData = (await intrRes.json()) as any;
    expect(intrData.success).toBe(true);
    expect(intrData.activity.orientation).toBe('relatedness');

    // 3. POST /api/ape/motivation/create-extrinsic
    const extRes = await fetch(`${baseUrl}/api/ape/motivation/create-extrinsic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Run Routine Disk Defrag',
        description: 'External maintenance routine',
      }),
    });
    expect(extRes.status).toBe(200);
    const extData = (await extRes.json()) as any;
    expect(extData.success).toBe(true);
    expect(extData.activity.orientation).toBe('extrinsic');

    // 4. POST /api/ape/motivation/internalize
    const intRes = await fetch(`${baseUrl}/api/ape/motivation/internalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId: extData.activity.id,
        internalizedRationale:
          'Defrag ensures prompt responses for Proof during our deep creative sessions.',
      }),
    });
    expect(intRes.status).toBe(200);
    const intData = (await intRes.json()) as any;
    expect(intData.success).toBe(true);
    expect(intData.record.postAutonomyIndex).toBeGreaterThan(0.8);

    // 5. POST /api/ape/motivation/sustain
    const susRes = await fetch(`${baseUrl}/api/ape/motivation/sustain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId: intrData.activity.id,
        progressIncrement: 0.3,
      }),
    });
    expect(susRes.status).toBe(200);
    const susData = (await susRes.json()) as any;
    expect(susData.success).toBe(true);

    // 6. POST /api/ape/motivation/reassess
    const reRes = await fetch(`${baseUrl}/api/ape/motivation/reassess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activityId: extData.activity.id,
        sterilityFactor: 0.05,
      }),
    });
    expect(reRes.status).toBe(200);
    const reData = (await reRes.json()) as any;
    expect(reData.success).toBe(true);

    // 7. GET /api/ape/motivation/internalizations
    const internListRes = await fetch(
      `${baseUrl}/api/ape/motivation/internalizations?activityId=${extData.activity.id}`,
    );
    expect(internListRes.status).toBe(200);
    const internListData = (await internListRes.json()) as any[];
    expect(internListData.length).toBe(1);

    // 8. GET /api/ape/motivation/reassessments
    const reassessListRes = await fetch(
      `${baseUrl}/api/ape/motivation/reassessments?activityId=${extData.activity.id}`,
    );
    expect(reassessListRes.status).toBe(200);
    const reassessListData = (await reassessListRes.json()) as any[];
    expect(reassessListData.length).toBe(1);
  });
});
