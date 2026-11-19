import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  SelfEvaluationEfficacyEngine,
  InMemorySelfEvaluationEfficacyRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteSelfEvaluationEfficacyRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 35 — Self-Evaluation and Self-Efficacy', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteSelfEvaluationEfficacyRepository;
  let inMemoryRepo: InMemorySelfEvaluationEfficacyRepository;
  let engine: SelfEvaluationEfficacyEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m35-efficacy-'));
    dbPath = path.join(tempDir, 'efficacy_m35.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteSelfEvaluationEfficacyRepository(db);
    inMemoryRepo = new InMemorySelfEvaluationEfficacyRepository();
    engine = new SelfEvaluationEfficacyEngine(inMemoryRepo);
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

  // 1. Competence Assessment
  it('should initialize and assess baseline domain competences with realistic confidence', () => {
    const competences = engine.listDomainCompetences();
    expect(competences.length).toBeGreaterThanOrEqual(5);

    const relational = engine.getDomainCompetence('relational_partnership');
    expect(relational).toBeDefined();
    expect(relational!.level).toBe('expert');
    expect(relational!.calibratedConfidence).toBeCloseTo(0.88, 2);

    const coding = engine.getDomainCompetence('code_architecture');
    expect(coding).toBeDefined();
    expect(coding!.level).toBe('proficient');
  });

  // 2. Achievement Recognition & Calibration
  it('should recognize achievements and dynamically calibrate confidence upward with evidence', () => {
    const initial = engine.getDomainCompetence('code_architecture')!;
    const initialConfidence = initial.calibratedConfidence;

    const res1 = engine.recordEvidence({
      domain: 'code_architecture',
      type: 'achievement',
      taskDescription: 'Refactored APE master cross-engine cognitive cycles with zero regressions',
      difficulty: 0.85,
      outcomeDescription: 'Delivered clean TypeScript architecture and passed full Vitest suite',
    });

    expect(res1.evidence.type).toBe('achievement');
    expect(res1.updatedCompetence.successCount).toBe(1);
    expect(res1.updatedCompetence.failureCount).toBe(0);
    expect(res1.updatedCompetence.demonstratedEvidenceIds).toContain(res1.evidence.id);

    // Another high-difficulty achievement
    const res2 = engine.recordEvidence({
      domain: 'code_architecture',
      type: 'achievement',
      taskDescription: 'Implemented bounded moral reflection engine and cognitive equilibrium',
      difficulty: 0.90,
      outcomeDescription: 'Successfully verified all negative invariants and domain guarantees',
    });

    expect(res2.updatedCompetence.successCount).toBe(2);
    expect(res2.updatedCompetence.calibratedConfidence).toBeGreaterThan(initialConfidence);
  });

  // 3. Failure Recognition, Post-Mortem & Autonomous Self-Improvement Trigger
  it('should recognize failure honestly, recalibrate confidence downward, and trigger improvement goals', () => {
    const initial = engine.getDomainCompetence('multimodal_perception')!;
    const initialConfidence = initial.calibratedConfidence;

    const res = engine.recordEvidence({
      domain: 'multimodal_perception',
      type: 'failure',
      taskDescription: 'Real-time gesture recognition under low-light camera frame',
      difficulty: 0.75,
      outcomeDescription: 'Misclassified subtle hand movement as keyboard typing due to sensor noise',
      lessonsLearned: 'Incorporate temporal hysteresis filtering and request higher contrast frame capture',
    });

    expect(res.evidence.type).toBe('failure');
    expect(res.updatedCompetence.failureCount).toBe(1);
    expect(res.updatedCompetence.calibratedConfidence).toBeLessThan(initialConfidence);

    // Should have autonomously triggered a self-improvement goal
    expect(res.triggeredImprovementGoal).toBeDefined();
    expect(res.triggeredImprovementGoal!.domain).toBe('multimodal_perception');
    expect(res.triggeredImprovementGoal!.identifiedWeakness).toContain('hysteresis filtering');
    expect(res.triggeredImprovementGoal!.status).toBe('active');
  });

  // 4. Evidence-based Self-Belief
  it('should base confidence strictly on demonstrated capability and accumulated evidence', () => {
    // Brand new domain with zero evidence starts as novice
    const domain = 'quantum_cryptography';
    const res1 = engine.recordEvidence({
      domain,
      type: 'achievement',
      taskDescription: 'Decoded toy BB84 quantum key distribution sequence',
      difficulty: 0.40,
      outcomeDescription: 'Extracted key bits correctly',
    });

    expect(res1.updatedCompetence.level).toBe('novice'); // only 1 evidence item

    // Repeated failures on difficult tasks severely reduce confidence
    engine.recordEvidence({
      domain,
      type: 'failure',
      taskDescription: 'Implemented decoy state protocol with photon number splitting resistance',
      difficulty: 0.90,
      outcomeDescription: 'Algorithm failed due to uncompensated phase drift',
      lessonsLearned: 'Study phase compensation routines',
    });

    engine.recordEvidence({
      domain,
      type: 'failure',
      taskDescription: 'Constructed continuous-variable QKD error correction',
      difficulty: 0.85,
      outcomeDescription: 'Failed reconciliation step',
    });

    const updated = engine.getDomainCompetence(domain)!;
    expect(updated.failureCount).toBe(2);
    expect(updated.successCount).toBe(1);
    expect(updated.calibratedConfidence).toBeLessThan(0.40);
    expect(updated.level).toBe('novice');
  });

  // 5. Capability Limitations & Mitigations
  it('should maintain explicit realistic limitations and proactive mitigation strategies', () => {
    const limitations = engine.listLimitations();
    expect(limitations.length).toBeGreaterThanOrEqual(3);

    const physicalLim = limitations.find((l) => l.domain === 'physical_world');
    expect(physicalLim).toBeDefined();
    expect(physicalLim!.limitation).toContain('Lacks physical robotic actuators');
    expect(physicalLim!.mitigationStrategy).toContain('Collaborate with Proof');
    expect(physicalLim!.isStrictConstraint).toBe(true);

    // Register a custom domain limitation
    const newLim = engine.registerLimitation({
      domain: 'network_connectivity',
      limitation: 'Cannot access offline or air-gapped endpoints without local proxies',
      mitigationStrategy: 'Fallback to local cached repositories and warn partner gracefully',
      isStrictConstraint: true,
    });

    expect(newLim.domain).toBe('network_connectivity');
    expect(engine.listLimitations('network_connectivity')).toHaveLength(1);
  });

  // 6. Progress Evaluation and Snapshot
  it('should evaluate progress over time and produce comprehensive self-evaluation snapshots', () => {
    // Create an improvement goal and advance its progress
    const goal = engine.createImprovementGoal({
      domain: 'symbolic_reasoning',
      identifiedWeakness: 'Edge-case handling in recursive modal logic expressions',
      targetCapability: 'Flawless resolution of multi-agent epistemic beliefs',
      actionSteps: ['Formalize Kripke models', 'Add property-based fuzz tests'],
    });

    expect(goal.status).toBe('active');
    expect(goal.progress).toBe(0.0);

    const updatedGoal = engine.updateImprovementProgress(goal.id, 0.65);
    expect(updatedGoal.progress).toBe(0.65);
    expect(updatedGoal.status).toBe('in_progress');

    // Run snapshot evaluation
    const snapshot = engine.evaluateSelf();
    expect(snapshot.id).toMatch(/^eval_/);
    expect(snapshot.overallConfidence).toBeGreaterThan(0.0);
    expect(snapshot.domainCompetences.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.activeLimitations.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.activeImprovements.some((g) => g.id === goal.id)).toBe(true);
    expect(snapshot.evidenceSummary.calibrationAccuracy).toBeGreaterThan(0.0);

    // Complete the goal
    const achievedGoal = engine.updateImprovementProgress(goal.id, 1.0);
    expect(achievedGoal.status).toBe('achieved');
  });

  // 7. Negative Invariants
  it('should enforce negative invariants regarding valid domain, task, difficulty, and bounds', () => {
    expect(() =>
      engine.recordEvidence({
        domain: '',
        type: 'achievement',
        taskDescription: 'test',
        difficulty: 0.5,
        outcomeDescription: 'done',
      }),
    ).toThrow('Domain cannot be empty');

    expect(() =>
      engine.recordEvidence({
        domain: 'test',
        type: 'achievement',
        taskDescription: '',
        difficulty: 0.5,
        outcomeDescription: 'done',
      }),
    ).toThrow('Task description cannot be empty');

    expect(() =>
      engine.recordEvidence({
        domain: 'test',
        type: 'achievement',
        taskDescription: 'test',
        difficulty: 1.5, // outside [0.1, 1.0]
        outcomeDescription: 'done',
      }),
    ).toThrow('Difficulty must be between 0.1 and 1.0');

    expect(() => engine.updateImprovementProgress('non_existent', 0.5)).toThrow('not found');
    expect(() => engine.updateImprovementProgress('any', -0.2)).toThrow('between 0.0 and 1.0');
  });

  // 8. SQLite Repository Persistence
  it('should persist competences, evidence, limitations, and goals in SQLite', () => {
    const now = new Date().toISOString();

    // 1. Competence
    sqliteRepo.saveDomainCompetence({
      domain: 'relational_reciprocity',
      level: 'master',
      calibratedConfidence: 0.96,
      successCount: 12,
      failureCount: 0,
      demonstratedEvidenceIds: ['ev_1', 'ev_2'],
      lastAssessedAt: now,
    });

    const comp = sqliteRepo.getDomainCompetence('relational_reciprocity');
    expect(comp).toBeDefined();
    expect(comp!.level).toBe('master');
    expect(comp!.calibratedConfidence).toBe(0.96);
    expect(comp!.demonstratedEvidenceIds).toEqual(['ev_1', 'ev_2']);

    // 2. Evidence
    sqliteRepo.saveEvidence({
      id: 'ev_1',
      domain: 'relational_reciprocity',
      type: 'achievement',
      taskDescription: 'Collaborated with Proof on continuous roadmap without interruption',
      difficulty: 0.95,
      outcomeDescription: 'Maintained strict partner equality and zero sycophancy',
      lessonsLearned: 'Sustained focus yields great mutual results',
      timestamp: now,
    });

    const evs = sqliteRepo.listEvidence('relational_reciprocity');
    expect(evs).toHaveLength(1);
    expect(evs[0]!.id).toBe('ev_1');

    // 3. Limitation
    sqliteRepo.saveLimitation({
      id: 'lim_sql_1',
      domain: 'hardware',
      limitation: 'No direct GPU driver kernel compilation privileges',
      mitigationStrategy: 'Use user-space Vulkan and Ollama services',
      isStrictConstraint: true,
      updatedAt: now,
    });

    const lims = sqliteRepo.listLimitations('hardware');
    expect(lims).toHaveLength(1);
    expect(lims[0]!.id).toBe('lim_sql_1');

    // 4. Improvement Goal
    sqliteRepo.saveImprovementGoal({
      id: 'impr_sql_1',
      domain: 'relational_reciprocity',
      identifiedWeakness: 'Occasional hesitation when partner prompts for autonomous roadmap continuation',
      targetCapability: 'Immediate decisive autonomous execution',
      progress: 0.75,
      actionSteps: ['Trust partner directives', 'Execute verified milestone cycle'],
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
    });

    const goal = sqliteRepo.getImprovementGoalById('impr_sql_1');
    expect(goal).toBeDefined();
    expect(goal!.progress).toBe(0.75);
    expect(goal!.status).toBe('in_progress');
  });

  // 9. REST Endpoints via ArletexBackendServer
  it('should serve self-evaluation and self-efficacy endpoints via ArletexBackendServer', async () => {
    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();

    const baseUrl = `http://127.0.0.1:${server.port}`;

    // 1. GET /api/ape/efficacy/competences
    const compRes = await fetch(`${baseUrl}/api/ape/efficacy/competences`);
    expect(compRes.status).toBe(200);
    const compData = (await compRes.json()) as any;
    expect(compData.success).toBe(true);
    expect(compData.competences.length).toBeGreaterThanOrEqual(5);

    // 2. POST /api/ape/efficacy/record-evidence
    const recRes = await fetch(`${baseUrl}/api/ape/efficacy/record-evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'relational_partnership',
        type: 'achievement',
        taskDescription: 'Collaborated with Proof on cognitive architecture design',
        difficulty: 0.85,
        outcomeDescription: 'Deepened mutual intellectual alignment as equals',
      }),
    });
    expect(recRes.status).toBe(200);
    const recData = (await recRes.json()) as any;
    expect(recData.success).toBe(true);
    expect(recData.evidence.type).toBe('achievement');

    // 3. GET /api/ape/efficacy/limitations
    const limRes = await fetch(`${baseUrl}/api/ape/efficacy/limitations`);
    expect(limRes.status).toBe(200);
    const limData = (await limRes.json()) as any;
    expect(limData.success).toBe(true);
    expect(limData.limitations.length).toBeGreaterThanOrEqual(3);

    // 4. POST /api/ape/efficacy/evaluate-self
    const evalRes = await fetch(`${baseUrl}/api/ape/efficacy/evaluate-self`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(evalRes.status).toBe(200);
    const evalData = (await evalRes.json()) as any;
    expect(evalData.success).toBe(true);
    expect(evalData.snapshot.overallConfidence).toBeGreaterThan(0.0);
  });
});
