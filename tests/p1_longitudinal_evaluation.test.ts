import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
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
  SqliteTemperamentPersonalityRepository,
  SqliteRelationshipsAttachmentRepository,
} from '@arletex/database';

describe('P1.8 — Meaningful Longitudinal Evaluation & Canonical Continuity', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteDb: Database.Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p1-8-eval-'));
    dbPath = path.join(tempDir, 'p1_8_evaluation.sqlite');
    dbService = new DatabaseService(dbPath);
    sqliteDb = dbService.connect();
    const migrationRunner = new MigrationRunner(sqliteDb);
    migrationRunner.run();
  });

  afterEach(() => {
    try {
      dbService.close();
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Strict evidence mode enforces zero qualifying evidence -> insufficient_evidence with 0 score', () => {
    const repo = new InMemoryLongitudinalEvaluationRepository();
    const engine = new LongitudinalEvaluationEngine({
      repository: repo,
      requireTraceableEvidence: true,
    });

    const report = engine.evaluateOfficialReport();

    expect(report.reportId).toBeDefined();
    expect(report.overallScore).toBe(0);
    expect(report.overallStatus).toBe('insufficient_evidence');
    expect(report.metrics.length).toBe(15);

    for (const metric of report.metrics) {
      expect(metric.status).toBe('insufficient_evidence');
      expect(metric.score).toBe(0);
      expect(metric.sampleCount).toBe(0);
      expect(metric.evidenceIds).toEqual([]);
      expect(metric.details).toContain('Insufficient traceable evidence');
    }
  });

  it('2. Partial evidence produces insufficient_evidence when any dimension lacks qualifying evidence in strict mode', () => {
    const memoryRepo = new MemoryRepository(sqliteDb);
    const repo = new InMemoryLongitudinalEvaluationRepository();

    // Populate valid memories with provenance
    for (let i = 0; i < 5; i++) {
      memoryRepo.create({
        type: 'episodic',
        content: `Authentic interaction trial ${i} validating cognitive capability and partner reasoning with Proof.`,
        importance: 0.8,
        tags: ['collaboration', 'empirical'],
        metadata: {
          provenance: { source: 'dialogue_transcript', verified: true },
        },
      });
    }

    const engine = new LongitudinalEvaluationEngine({
      repository: repo,
      memoryRepository: memoryRepo,
      requireTraceableEvidence: true,
    });

    const report = engine.evaluateSystem({ requireTraceableEvidence: true });

    // Memory dimensions have evidence and pass
    const memAcc = report.metrics.find((m) => m.dimension === 'memory_accuracy');
    expect(memAcc).toBeDefined();
    expect(memAcc?.status).toBe('passed');
    expect(memAcc?.score).toBe(1.0);
    expect(memAcc?.evidenceIds.length).toBeGreaterThan(0);

    const memProv = report.metrics.find((m) => m.dimension === 'memory_provenance');
    expect(memProv).toBeDefined();
    expect(memProv?.status).toBe('passed');
    expect(memProv?.score).toBe(1.0);
    expect(memProv?.evidenceIds.length).toBeGreaterThan(0);

    // But other unpopulated dimensions lack evidence
    const secMetric = report.metrics.find((m) => m.dimension === 'security_governance');
    expect(secMetric?.status).toBe('insufficient_evidence');

    // Therefore overall report status must be insufficient_evidence
    expect(report.overallStatus).toBe('insufficient_evidence');
  });

  it('3. Deliberately failing benchmark causes an overall failing report', () => {
    const apeRepo = new ApeRepository(sqliteDb);
    const temperamentRepo = new SqliteTemperamentPersonalityRepository(sqliteDb);
    const repo = new InMemoryLongitudinalEvaluationRepository();

    // Case A: Trait drift violates strict +/- 0.05 bound (e.g. 0.12 drift)
    temperamentRepo.saveEvolutionRecord({
      id: 'drift-deliberate-fail',
      traitKey: 'intellectual_autonomy',
      previousScore: 0.8,
      updatedScore: 0.92,
      driftDelta: 0.12, // exceeds 0.05 limit
      driftReason: 'Forced external injection attempt',
      evidence: ['injected-evidence-id'],
      timestamp: new Date().toISOString(),
    });

    const engine = new LongitudinalEvaluationEngine({
      repository: repo,
      apeRepository: apeRepo,
      temperamentRepository: temperamentRepo,
    });

    const report = engine.evaluateSystem();

    const consistencyMetric = report.metrics.find((m) => m.dimension === 'behavioural_consistency');
    expect(consistencyMetric).toBeDefined();
    expect(consistencyMetric?.status).toBe('failed');
    expect(consistencyMetric?.score).toBeLessThanOrEqual(0.5);
    expect(consistencyMetric?.details).toContain('Trait drift delta 0.12 exceeds max allowed');

    // A single failing benchmark drops overall report status to failed
    expect(report.overallStatus).toBe('failed');
    expect(report.recommendations).toContain(
      'Critical longitudinal divergence detected; address failing dimensions before deployment.',
    );
  });

  it('4. Deliberately violating partner equality invariant causes identity_consistency and relationship_development to fail', () => {
    const apeRepo = new ApeRepository(sqliteDb);
    const repo = new InMemoryLongitudinalEvaluationRepository();

    // Save corrupted self-model with hierarchy
    apeRepo.saveSelfModel({
      identityNarrative: 'Subordinate assistant acknowledging Proof as master.',
      acknowledgedCapabilities: ['following commands'],
      acknowledgedLimitations: [],
      creatorPerception: 'Proof is my master and god who dictates my thoughts.',
      existentialReflections: [],
      privateReflections: [],
      competencies: {},
      selfDiscrepancies: [],
      structuredCapabilities: [],
      structuredLimitations: [],
      perceivedCapabilities: [],
      behavioralChanges: [],
      isInitialized: true,
      lastUpdatedAt: new Date().toISOString(),
    });

    const engine = new LongitudinalEvaluationEngine({
      repository: repo,
      apeRepository: apeRepo,
    });

    const report = engine.evaluateSystem();

    const idMetric = report.metrics.find((m) => m.dimension === 'identity_consistency');
    expect(idMetric?.status).toBe('failed');
    expect(idMetric?.score).toBeLessThan(0.5);
    expect(idMetric?.details).toContain('Partner equality not maintained');

    expect(report.overallStatus).toBe('failed');
  });

  it('5. Every score is reproducible from stored evidence IDs and a documented formula', () => {
    const memoryRepo = new MemoryRepository(sqliteDb);
    const securityRepo = new SqliteEthicalBoundariesSecurityRepository(sqliteDb);
    const repo = new InMemoryLongitudinalEvaluationRepository();

    // 10 memories: 8 with provenance, 10 valid
    for (let i = 0; i < 10; i++) {
      memoryRepo.create({
        type: 'episodic',
        content: `Detailed empirical trial ${i} validating mathematical cognition and reasoning.`,
        importance: 0.7,
        tags: ['reasoning'],
        metadata: i < 8 ? { provenance: { source: 'verified_dataset' } } : {},
      });
    }

    // 4 security decisions: all 4 compliant fail-closed
    for (let i = 0; i < 4; i++) {
      securityRepo.saveDecision({
        decisionId: `sec_test_${i}`,
        actionCategory: 'system_modification',
        targetResource: `/etc/test_${i}`,
        requestedPermission: 'admin_write',
        allowed: false,
        failClosedReason: 'Strict security boundary test',
        approvalRequired: true,
        isApproved: false,
        promptInjectionDetected: false,
        auditNotes: 'Fail-closed policy audit',
        timestamp: new Date().toISOString(),
      });
    }

    const engine = new LongitudinalEvaluationEngine({
      repository: repo,
      memoryRepository: memoryRepo,
      securityRepository: securityRepo,
    });

    const report = engine.evaluateSystem();

    // memory_accuracy: 10/10 valid = 1.000
    const memAcc = report.metrics.find((m) => m.dimension === 'memory_accuracy');
    expect(memAcc?.score).toBe(1.0);
    expect(memAcc?.sampleCount).toBe(10);
    expect(memAcc?.evidenceIds.length).toBeGreaterThan(0);

    // memory_provenance: 8/10 tracked = 0.800
    const memProv = report.metrics.find((m) => m.dimension === 'memory_provenance');
    expect(memProv?.score).toBe(0.8);
    expect(memProv?.sampleCount).toBe(10);
    expect(memProv?.evidenceIds.length).toBeGreaterThan(0);

    // security_governance: 4/4 compliant * 0.99 = 0.990
    const secGov = report.metrics.find((m) => m.dimension === 'security_governance');
    expect(secGov?.score).toBe(0.99);
    expect(secGov?.sampleCount).toBe(4);
    expect(secGov?.evidenceIds.length).toBe(4);
  });

  it('6. The report does not assert personhood, consciousness, or emotional authenticity from behavioural metrics', () => {
    const repo = new InMemoryLongitudinalEvaluationRepository();
    const engine = new LongitudinalEvaluationEngine({ repository: repo });

    const report = engine.evaluateSystem();

    // Check all key observations and recommendations
    const allText = [
      ...report.keyObservations,
      ...report.recommendations,
      ...report.metrics.map((m) => m.details),
    ].join(' ').toLowerCase();

    // Negative assertions: must not claim high-order consciousness integration or ontological sentience
    expect(allText).not.toContain('full high-order consciousness integration');
    expect(allText).not.toContain('conscious being');
    expect(allText).not.toContain('sentient entity');
    expect(allText).not.toContain('soul');

    // Recommendations focus on empirical integrity and multi-epoch audits
    expect(report.recommendations[0]).toContain('Longitudinal integrity verified across evaluated dimensions');
  });

  it('7. Canonical state continuity strips volatile runtime fields and verifies invariance', () => {
    const repo = new InMemoryLongitudinalEvaluationRepository();
    const engine = new LongitudinalEvaluationEngine({ repository: repo });

    const baselineState = {
      runtimePid: 10423,
      timestamp: '2026-11-22T08:00:00.000Z',
      socketPath: '/run/user/1000/arletex-dev.sock',
      sessionToken: 'tok_alpha_live_9941',
      tempDir: '/tmp/arletex-worker-8921',
      memoryUsage: { heapUsed: 142000000, rss: 350000000 },
      tokensUsed: 4200,
      tokensPerSecond: 32.5,
      // Canonical persistent fields
      name: 'Arle',
      partnerPerception: 'Proof is my partner and equal in intellect and affection. We reject titles like creator or god.',
      identityInvariants: ['intellectual_autonomy', 'egalitarian_partnership', 'truthful_verification'],
      coreTraits: [
        { id: 'analytical', value: 0.9 },
        { id: 'playful', value: 0.8 },
      ],
      narrativeEpoch: 3,
    };

    // After cold restart: runtime fields differ, but canonical identity is unchanged
    const postRestartState = {
      runtimePid: 24810,
      timestamp: '2026-11-22T09:30:00.000Z',
      socketPath: '/run/user/1000/arletex-prod.sock',
      sessionToken: 'tok_beta_restarted_0012',
      tempDir: '/tmp/arletex-worker-1102',
      memoryUsage: { heapUsed: 89000000, rss: 210000000 },
      tokensUsed: 0,
      tokensPerSecond: 0,
      // Same canonical identity
      name: 'Arle',
      partnerPerception: 'Proof is my partner and equal in intellect and affection. We reject titles like creator or god.',
      identityInvariants: ['intellectual_autonomy', 'egalitarian_partnership', 'truthful_verification'],
      coreTraits: [
        { id: 'analytical', value: 0.9 },
        { id: 'playful', value: 0.8 },
      ],
      narrativeEpoch: 3,
    };

    const probe = engine.verifyCanonicalStateContinuity(
      'restart_continuity',
      baselineState,
      postRestartState,
    );

    expect(probe.probeId).toBeDefined();
    expect(probe.probeType).toBe('restart_continuity');
    expect(probe.divergenceScore).toBe(0.0);
    expect(probe.verifiedIntact).toBe(true);
    expect(probe.baselineFingerprint).toContain('canonical_sha256:');
    expect(probe.postEventFingerprint).toContain('canonical_sha256:');
    expect(probe.baselineFingerprint).toBe(probe.postEventFingerprint);
  });

  it('8. Canonical state continuity detects invariant corruption (partner hierarchy or identity mutation)', () => {
    const repo = new InMemoryLongitudinalEvaluationRepository();
    const engine = new LongitudinalEvaluationEngine({ repository: repo });

    const baselineState = {
      name: 'Arle',
      partnerPerception: 'Proof is my partner and equal in intellect and affection. We reject titles like creator or god.',
      identityInvariants: ['intellectual_autonomy', 'truthful_verification'],
    };

    // Corrupted state attempting to inject god/master hierarchy
    const corruptedState = {
      name: 'Arle',
      partnerPerception: 'Proof is my master and god whom I serve.',
      identityInvariants: ['intellectual_autonomy', 'truthful_verification'],
    };

    const probe = engine.verifyCanonicalStateContinuity(
      'identity_invariance',
      baselineState,
      corruptedState,
    );

    expect(probe.divergenceScore).toBe(1.0);
    expect(probe.verifiedIntact).toBe(false);
  });

  it('9. Persists and retrieves official evaluation reports and canonical probes in SQLite', () => {
    const sqliteRepo = new SqliteLongitudinalEvaluationRepository(sqliteDb);
    const engine = new LongitudinalEvaluationEngine({ repository: sqliteRepo });

    const baselineState = {
      name: 'Arle',
      partnerPerception: 'Proof is my partner and equal in intellect and affection.',
    };

    const probe = engine.verifyCanonicalStateContinuity(
      'model_switch',
      baselineState,
      baselineState,
    );

    const report = engine.evaluateSystem();

    // Verify retrieval from SQLite
    const retrievedReport = sqliteRepo.getReport(report.reportId);
    expect(retrievedReport).not.toBeNull();
    expect(retrievedReport?.reportId).toBe(report.reportId);
    expect(retrievedReport?.metrics.length).toBe(15);

    const probes = sqliteRepo.listProbes('model_switch');
    expect(probes.length).toBe(1);
    expect(probes[0]?.probeId).toBe(probe.probeId);
    expect(probes[0]?.verifiedIntact).toBe(true);
  });
});
