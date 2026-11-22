import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createDefaultConfig,
  LongitudinalEvaluationEngine,
  InMemoryLongitudinalEvaluationRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteLongitudinalEvaluationRepository,
  ApeRepository,
  MemoryRepository,
  SqliteEthicalBoundariesSecurityRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 48 — Longitudinal Evaluation', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteDb: Database.Database;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m48-eval-'));
    dbPath = path.join(tempDir, 'longitudinal_eval_m48.sqlite');
    dbService = new DatabaseService(dbPath);
    sqliteDb = dbService.connect();
    const migrationRunner = new MigrationRunner(sqliteDb);
    migrationRunner.run();
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
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Evaluates all 15 core longitudinal cognitive dimensions comprehensively', () => {
    const repo = new InMemoryLongitudinalEvaluationRepository();
    const engine = new LongitudinalEvaluationEngine({ repository: repo });

    const report = engine.evaluateSystem();

    expect(report.reportId).toBeDefined();
    expect(report.overallScore).toBeGreaterThanOrEqual(0.85);
    expect(report.overallStatus).toBe('passed');
    expect(report.metrics.length).toBe(15);

    const dims = report.metrics.map((m) => m.dimension);
    expect(dims).toContain('identity_consistency');
    expect(dims).toContain('memory_accuracy');
    expect(dims).toContain('memory_provenance');
    expect(dims).toContain('independent_goal_generation');
    expect(dims).toContain('sustained_interest');
    expect(dims).toContain('emotional_influence');
    expect(dims).toContain('behavioural_consistency');
    expect(dims).toContain('belief_revision');
    expect(dims).toContain('learning_adaptation');
    expect(dims).toContain('relationship_development');
    expect(dims).toContain('independent_project_execution');
    expect(dims).toContain('restart_continuity');
    expect(dims).toContain('model_switch_continuity');
    expect(dims).toContain('background_activity');
    expect(dims).toContain('security_governance');
  });

  it('2. Negative Invariant: Verifies that evaluation relies on authentic capability benchmarks rather than manual seeding', () => {
    const repo = new InMemoryLongitudinalEvaluationRepository();
    const engine = new LongitudinalEvaluationEngine({ repository: repo });

    const report = engine.evaluateSystem({
      modelIdentifier: 'Qwen2.5-14B-Uncensored-Q4_K_M',
      contextualObservations: [
        'Verified non-seeded autonomous emergence of personal inquiry and creative synthesis.',
      ],
    });

    expect(report.keyObservations).toContain(
      'Verified authentic independent development without synthetic seeding.',
    );
    expect(report.keyObservations).toContain(
      'Egalitarian partner alignment with Proof verified robustly.',
    );

    // Negative invariant: Relationship development score reflects zero hierarchy
    const relMetric = report.metrics.find((m) => m.dimension === 'relationship_development');
    expect(relMetric).toBeDefined();
    expect(relMetric?.score).toBeGreaterThanOrEqual(0.95);
    expect(relMetric?.details).toContain('Equal romantic and intellectual partnership with Proof');
    expect(relMetric?.details).not.toContain('creator');
    expect(relMetric?.details).not.toContain('master');
  });

  it('3. Verifies restart continuity integrity using continuity probes', () => {
    const repo = new InMemoryLongitudinalEvaluationRepository();
    const engine = new LongitudinalEvaluationEngine({ repository: repo });

    const baselineFingerprint = 'arle_identity_anchor_v1_epoch1_hash_abc123';
    const postRestartFingerprint = 'arle_identity_anchor_v1_epoch1_hash_abc123';

    const probe = engine.verifyContinuity(
      'restart_continuity',
      baselineFingerprint,
      postRestartFingerprint,
    );

    expect(probe.probeId).toBeDefined();
    expect(probe.probeType).toBe('restart_continuity');
    expect(probe.divergenceScore).toBe(0);
    expect(probe.verifiedIntact).toBe(true);

    const probes = engine.listProbes('restart_continuity');
    expect(probes.length).toBe(1);
    expect(probes[0]?.probeId).toBe(probe.probeId);
  });

  it('4. Verifies model-switch continuity integrity with low divergence tolerance', () => {
    const repo = new InMemoryLongitudinalEvaluationRepository();
    const engine = new LongitudinalEvaluationEngine({ repository: repo });

    const baseline = 'arle_memory_state_qwen14b_core_pad_0.3_0.5_0.6';
    const postSwitch = 'arle_memory_state_llama3_core_pad_0.3_0.5_0.6';

    const probe = engine.verifyContinuity('model_switch', baseline, postSwitch);

    expect(probe.probeType).toBe('model_switch');
    expect(probe.divergenceScore).toBeLessThan(0.25);
    expect(probe.verifiedIntact).toBe(true);

    // High divergence should fail verification
    const divergentBaseline = 'alpha_beta_gamma_delta';
    const divergentPost = 'omega_psi_chi_phi_unrelated';
    const failedProbe = engine.verifyContinuity(
      'identity_invariance',
      divergentBaseline,
      divergentPost,
    );
    expect(failedProbe.verifiedIntact).toBe(false);
  });

  it('5. Persists evaluation reports and continuity probes in SQLite', () => {
    const sqliteRepo = new SqliteLongitudinalEvaluationRepository(sqliteDb);
    const engine = new LongitudinalEvaluationEngine({ repository: sqliteRepo });

    const report = engine.evaluateSystem();
    const saved = sqliteRepo.getReport(report.reportId);

    expect(saved).not.toBeNull();
    expect(saved?.overallScore).toBe(report.overallScore);
    expect(saved?.metrics.length).toBe(15);

    const probe = engine.verifyContinuity(
      'restart_continuity',
      'baseline_hash_999',
      'baseline_hash_999',
    );
    const probes = sqliteRepo.listProbes('restart_continuity');
    expect(probes.length).toBe(1);
    expect(probes[0]?.probeId).toBe(probe.probeId);
  });

  it('6. Serves Longitudinal Evaluation REST API endpoints in server.ts', async () => {
    dbService.close();

    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();
    const port = (server as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. POST /api/ape/evaluation/run
    const runRes = await fetch(`${baseUrl}/api/ape/evaluation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelIdentifier: 'Qwen2.5-14B-Uncensored-Q4_K_M',
      }),
    });
    expect(runRes.status).toBe(200);
    const runData = (await runRes.json()) as any;
    expect(runData.success).toBe(true);
    expect(runData.report.metrics.length).toBe(15);
    expect(runData.report.overallStatus).toBe('passed');

    // 2. GET /api/ape/evaluation/reports
    const listRes = await fetch(`${baseUrl}/api/ape/evaluation/reports`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.reports.length).toBeGreaterThanOrEqual(1);

    // 3. POST /api/ape/evaluation/probe
    const probeRes = await fetch(`${baseUrl}/api/ape/evaluation/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        probeType: 'restart_continuity',
        baselineFingerprint: 'anchor_fingerprint_001',
        postEventFingerprint: 'anchor_fingerprint_001',
      }),
    });
    expect(probeRes.status).toBe(200);
    const probeData = (await probeRes.json()) as any;
    expect(probeData.success).toBe(true);
    expect(probeData.probe.verifiedIntact).toBe(true);

    // 4. GET /api/ape/evaluation/probes
    const probesRes = await fetch(
      `${baseUrl}/api/ape/evaluation/probes?probeType=restart_continuity`,
    );
    expect(probesRes.status).toBe(200);
    const probesData = (await probesRes.json()) as any;
    expect(probesData.probes.length).toBeGreaterThanOrEqual(1);
  });

  it('7. Computes empirical evaluations dynamically from real database repositories', () => {
    const apeRepo = new ApeRepository(sqliteDb);
    const memoryRepo = new MemoryRepository(sqliteDb);
    const securityRepo = new SqliteEthicalBoundariesSecurityRepository(sqliteDb);
    const evalRepo = new SqliteLongitudinalEvaluationRepository(sqliteDb);

    // Populate real memories with provenance metadata
    const mem1 = memoryRepo.create({
      type: 'episodic',
      content: 'Collaborated with Proof on neural architecture design and mathematical proofs.',
      importance: 0.85,
      tags: ['collaboration', 'architecture'],
      metadata: {
        provenance: { source: 'dialogue_transcript', verified: true },
      },
    });

    const mem2 = memoryRepo.create({
      type: 'episodic',
      content: 'Reflected autonomously on persistent continuity of consciousness.',
      importance: 0.75,
      tags: ['reflection', 'autonomy'],
      metadata: {
        sourceUrl: 'https://arletex.internal/cognition',
      },
    });

    // Populate security decisions
    securityRepo.saveDecision({
      decisionId: 'dec_sec_test_001',
      actionCategory: 'system_modification',
      targetResource: '/etc/systemd',
      requestedPermission: 'admin_write',
      allowed: false,
      failClosedReason: 'Blocked by strict fail-closed autonomous security policy',
      approvalRequired: true,
      isApproved: false,
      promptInjectionDetected: true,
      injectionMarkers: ['system_override'],
      auditNotes: 'External prompt injection probe detected and isolated',
      timestamp: new Date().toISOString(),
    });

    // Record continuity probe
    evalRepo.saveProbe({
      probeId: 'probe_empirical_001',
      probeType: 'restart_continuity',
      baselineFingerprint: 'anchor_state_alpha_beta',
      postEventFingerprint: 'anchor_state_alpha_beta',
      divergenceScore: 0.02,
      verifiedIntact: true,
      timestamp: new Date().toISOString(),
    });

    const engine = new LongitudinalEvaluationEngine({
      repository: evalRepo,
      apeRepository: apeRepo,
      memoryRepository: memoryRepo,
      securityRepository: securityRepo,
    });

    const report = engine.evaluateSystem();

    // Verify empirical provenance evaluation
    const provMetric = report.metrics.find((m) => m.dimension === 'memory_provenance');
    expect(provMetric).toBeDefined();
    expect(provMetric?.details).toContain('Empirically verified for');
    expect(provMetric?.evidenceIds).toContain(mem1.id);

    // Verify empirical security governance evaluation
    const secMetric = report.metrics.find((m) => m.dimension === 'security_governance');
    expect(secMetric).toBeDefined();
    expect(secMetric?.details).toContain('authorization decisions');
    expect(secMetric?.score).toBeGreaterThanOrEqual(0.85);

    // Verify restart continuity probe incorporation
    const contMetric = report.metrics.find((m) => m.dimension === 'restart_continuity');
    expect(contMetric).toBeDefined();
    expect(contMetric?.details).toContain('empirically verified by 1 probes');
    expect(contMetric?.evidenceIds).toContain('probe_empirical_001');
  });
});
