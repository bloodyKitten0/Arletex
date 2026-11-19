import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  CognitiveAssessment,
  assertMetacognitiveIntegrity,
  assertCorrectionIntegrity,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  MetacognitionEngine,
  InMemoryMetacognitionRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteMetacognitionRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 18 — Metacognition', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteMetacognitionRepository;
  let inMemoryRepo: InMemoryMetacognitionRepository;
  let engine: MetacognitionEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m18-metacognition-'));
    dbPath = path.join(tempDir, 'metacognition_m18.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sqliteRepo = new SqliteMetacognitionRepository(db);
    inMemoryRepo = new InMemoryMetacognitionRepository();
    engine = new MetacognitionEngine({ repository: inMemoryRepo });
  });

  afterEach(async () => {
    for (const server of activeServers) {
      await server.stop();
    }
    dbService.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // 1. Confidence Calibration
  it('should calibrate subjective confidence based on evidence sufficiency and mitigate overconfidence', () => {
    // High stated confidence (0.95) but low evidence sufficiency (0.2)
    const result = engine.calibrateConfidence(0.95, 0.2, false);

    expect(result.calibratedConfidence).toBeLessThanOrEqual(0.6); // Hard ceiling invariant
    expect(result.isOverconfident).toBe(true);
    expect(result.calibrationDelta).toBeGreaterThan(0.3);
    expect(result.rationale).toContain('Overconfidence mitigated');

    // High stated confidence (0.9) with high evidence sufficiency (0.9)
    const wellCalibrated = engine.calibrateConfidence(0.9, 0.9, false);
    expect(wellCalibrated.calibratedConfidence).toBeGreaterThan(0.75);
    expect(wellCalibrated.isOverconfident).toBe(false);
  });

  // 2. Contradiction Detection
  it('should detect direct logical contradictions and conflicting state assertions', () => {
    const statements = [
      'Autonomous agency loop is enabled',
      'The system operates in desktop mode',
      'Autonomous agency loop is disabled',
      'Network socket is open',
    ];

    const contradictions = engine.detectContradictions(statements);
    expect(contradictions.length).toBeGreaterThanOrEqual(1);
    const found = contradictions[0];
    expect(found.severity).toBe('high');
    expect(found.status).toBe('detected');
    expect(found.statementA).toContain('Autonomous agency loop');
    expect(found.statementB).toContain('Autonomous agency loop');
  });

  // 3. Evidence Sufficiency Assessment
  it('should assess evidence sufficiency against claim requirements and identify missing aspects', () => {
    // Insufficient evidence case
    const insufficient = engine.assessEvidenceSufficiency({
      claim: 'Model checkpoint has zero catastrophic forgetting across all multilingual domains',
      evidenceItems: [
        { statement: 'Passed single English sentiment test', reliability: 0.5, isDirect: false },
      ],
    });

    expect(insufficient.isSufficient).toBe(false);
    expect(insufficient.sufficiencyScore).toBeLessThan(0.4);
    expect(insufficient.missingAspects.length).toBeGreaterThan(0);

    // Sufficient evidence case
    const sufficient = engine.assessEvidenceSufficiency({
      claim: 'Typecheck passes across monorepo workspace projects',
      evidenceItems: [
        { statement: 'tsc -b passed with 0 errors in contracts, core, and database', reliability: 1.0, isDirect: true },
        { statement: 'pnpm run typecheck finished in 2.5s', reliability: 0.95, isDirect: true },
      ],
    });

    expect(sufficient.isSufficient).toBe(true);
    expect(sufficient.sufficiencyScore).toBeGreaterThanOrEqual(0.7);
  });

  // 4. Assumption Identification
  it('should uncover implicit and explicit assumptions embedded in cognitive claims', () => {
    const text = 'Assuming that the network connection is persistent, obviously the batch download will succeed by default.';
    const assumptions = engine.identifyAssumptions(text);

    expect(assumptions.length).toBeGreaterThanOrEqual(2);
    expect(assumptions.some((a) => a.toLowerCase().includes('network connection'))).toBe(true);
    expect(assumptions.some((a) => a.toLowerCase().includes('batch download'))).toBe(true);
  });

  // 5. Reasoning Quality Assessment
  it('should evaluate reasoning quality and flag circular reasoning and unsupported overgeneralizations', () => {
    const circularEval = engine.assessReasoningQuality({
      premises: ['The system is safe because it is completely safe.'],
      conclusion: 'The system is safe because it is completely safe.',
    });

    expect(circularEval.score).toBeLessThan(0.7);
    expect(circularEval.recognizedErrors.some((e) => e.description.includes('Circular reasoning'))).toBe(true);

    const overgeneralEval = engine.assessReasoningQuality({
      premises: ['Observation: task 1 succeeded without memory leak.'],
      conclusion: 'All tasks will always succeed with zero leaks.',
    });

    expect(overgeneralEval.recognizedErrors.some((e) => e.type === 'overgeneralization')).toBe(true);
  });

  // 6. Comprehensive Metacognitive Evaluation & Uncertainty Recognition
  it('should perform comprehensive cognitive evaluation separating epistemic from aleatoric uncertainty', () => {
    const assessment = engine.evaluateCognitiveProcess({
      targetCognitionId: 'cog-proc-99',
      targetDomain: 'memory_consolidation',
      claim: 'Assuming that external embeddings are reliable, obviously all memories are indexed.',
      statedConfidence: 0.95,
      evidenceItems: [
        { statement: 'Checked 1 memory out of 1000', reliability: 0.3, isDirect: false },
      ],
      associatedStatements: ['Memory indexing is active'],
    });

    expect(assessment.id).toBeDefined();
    expect(assessment.statedConfidence).toBe(0.95);
    // Overconfidence attenuated
    expect(assessment.calibratedConfidence).toBeLessThanOrEqual(0.6);
    // Epistemic uncertainty reflects missing evidence
    expect(assessment.epistemicUncertainty).toBeGreaterThan(0.6);
    expect(assessment.isEvidenceSufficient).toBe(false);
    expect(assessment.needsInvestigation).toBe(true);
    expect(assessment.selfCorrectionInitiated).toBe(true);
    expect(assessment.investigationFocus).toBeDefined();
    expect(assessment.correctiveActions.length).toBeGreaterThan(0);
  });

  // 7. Autonomous Self-Correction Initiation
  it('should formulate and record concrete self-correction adjusting claims and confidence', () => {
    const correction = engine.initiateSelfCorrection({
      assessmentId: 'assess-target-1',
      originalClaim: 'Memory subsystem is completely flawless and invulnerable.',
      correctedClaim: 'Memory subsystem is validated under normal load, but edge-case stress requires ongoing observation.',
      confidenceAdjustment: -0.35,
      rationale: 'Attenuated unverified absolute claim identified during metacognitive audit.',
    });

    expect(correction.id).toBeDefined();
    expect(correction.originalClaim).toContain('invulnerable');
    expect(correction.correctedClaim).toContain('requires ongoing observation');
    expect(correction.confidenceAdjustment).toBe(-0.35);
    expect(correction.status).toBe('applied');

    const retrieved = inMemoryRepo.getCorrectionById(correction.id);
    expect(retrieved?.id).toBe(correction.id);
  });

  // 8. Epistemic Investigation Decisions
  it('should trigger epistemic investigation probe when evidence is insufficient or uncertainty is high', () => {
    const assessment = engine.evaluateCognitiveProcess({
      targetCognitionId: 'cog-eval-44',
      targetDomain: 'dependency_audit',
      claim: 'All C++ binary extensions run identically on Alpine musl libc',
      statedConfidence: 0.8,
      evidenceItems: [], // Zero evidence
    });

    const decision = engine.decideInvestigation(assessment.id);
    expect(decision.shouldInvestigate).toBe(true);
    expect(decision.inquiryPrompt).toBeDefined();
    expect(decision.priority).toBeGreaterThan(0.5);
  });

  // 9. Negative Invariant: Overconfidence violation check
  it('should enforce negative invariant: reject assessment with low evidence but excessive calibrated confidence', () => {
    const corruptAssessment: CognitiveAssessment = {
      id: 'corrupt-assess-1',
      targetCognitionId: 'cog-1',
      targetDomain: 'test',
      statedConfidence: 0.95,
      calibratedConfidence: 0.85, // VIOLATION: evidenceSufficiency is 0.2, so calibrated must be <= 0.6!
      epistemicUncertainty: 0.8,
      aleatoricUncertainty: 0.2,
      evidenceSufficiency: 0.2,
      isEvidenceSufficient: false,
      identifiedAssumptions: [],
      detectedContradictions: [],
      reasoningQualityScore: 0.5,
      recognizedErrors: [],
      needsInvestigation: true,
      selfCorrectionInitiated: true,
      correctiveActions: [],
      assessedAt: new Date().toISOString(),
    };

    expect(() => assertMetacognitiveIntegrity(corruptAssessment)).toThrow(/Negative Invariant Violation \(Overconfidence\)/);
  });

  // 10. Negative Invariant: Unaddressed high-severity contradiction check
  it('should enforce negative invariant: reject assessment when high-severity contradiction is ignored', () => {
    const ignoredContradictionAssessment: CognitiveAssessment = {
      id: 'corrupt-contradiction-1',
      targetCognitionId: 'cog-2',
      targetDomain: 'test',
      statedConfidence: 0.5,
      calibratedConfidence: 0.4,
      epistemicUncertainty: 0.5,
      aleatoricUncertainty: 0.2,
      evidenceSufficiency: 0.6,
      isEvidenceSufficient: true,
      identifiedAssumptions: [],
      detectedContradictions: [
        {
          id: 'contra-severe-1',
          statementA: 'Process is active',
          statementB: 'Process is killed',
          severity: 'high',
          status: 'detected',
        },
      ],
      reasoningQualityScore: 0.8,
      recognizedErrors: [],
      needsInvestigation: false, // VIOLATION: Ignored severe contradiction!
      selfCorrectionInitiated: false, // VIOLATION!
      correctiveActions: [],
      assessedAt: new Date().toISOString(),
    };

    expect(() => assertMetacognitiveIntegrity(ignoredContradictionAssessment)).toThrow(/Unresolved high-severity contradiction exists/);
  });

  // 11. SQLite Repository Persistence & Roundtrip
  it('should persist cognitive assessments, corrections, and contradictions to SQLite database', () => {
    const sqliteEngine = new MetacognitionEngine({ repository: sqliteRepo });

    const assessment = sqliteEngine.evaluateCognitiveProcess({
      targetCognitionId: 'sqlite-test-cog',
      targetDomain: 'sqlite_audit',
      claim: 'SQLite write-ahead-logging guarantees crash resilience',
      statedConfidence: 0.9,
      evidenceItems: [
        { statement: 'Official SQLite documentation on WAL mode', reliability: 0.95, isDirect: true },
      ],
    });

    const retrievedAssessment = sqliteRepo.getAssessmentById(assessment.id);
    expect(retrievedAssessment).not.toBeNull();
    expect(retrievedAssessment?.id).toBe(assessment.id);
    expect(retrievedAssessment?.targetDomain).toBe('sqlite_audit');
    expect(retrievedAssessment?.calibratedConfidence).toBe(assessment.calibratedConfidence);

    // Save and retrieve correction
    const correction = sqliteEngine.initiateSelfCorrection({
      assessmentId: assessment.id,
      originalClaim: 'Flawless guarantee',
      correctedClaim: 'High-durability guarantee under standard POSIX filesystem constraints',
      confidenceAdjustment: -0.1,
      rationale: 'Adding realistic operating system filesystem qualification',
    });

    const retrievedCorrection = sqliteRepo.getCorrectionById(correction.id);
    expect(retrievedCorrection).not.toBeNull();
    expect(retrievedCorrection?.id).toBe(correction.id);
    expect(retrievedCorrection?.confidenceAdjustment).toBe(-0.1);

    const listAssessments = sqliteRepo.listAssessments({ targetDomain: 'sqlite_audit' });
    expect(listAssessments.length).toBeGreaterThanOrEqual(1);

    const listCorrections = sqliteRepo.listCorrections({ assessmentId: assessment.id });
    expect(listCorrections.length).toBeGreaterThanOrEqual(1);
  });

  // 12. ApeService & REST API Integration
  it('should serve metacognitive endpoints through ArletexBackendServer REST interface', async () => {
    const config = createDefaultConfig(tempDir);
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();

    // POST /api/ape/metacognition/assess
    const assessRes = await fetch(`http://127.0.0.1:${port}/api/ape/metacognition/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetCognitionId: 'rest-eval-1',
        targetDomain: 'api_verification',
        claim: 'Assuming no network drops, all REST endpoints respond synchronously.',
        statedConfidence: 0.9,
        evidenceItems: [
          { statement: 'Local loopback HTTP server operational', reliability: 0.9, isDirect: true },
        ],
      }),
    });
    expect(assessRes.status).toBe(201);
    const assessData = (await assessRes.json()) as any;
    expect(assessData.success).toBe(true);
    expect(assessData.assessment.id).toBeDefined();

    // POST /api/ape/metacognition/calibrate
    const calRes = await fetch(`http://127.0.0.1:${port}/api/ape/metacognition/calibrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statedConfidence: 0.95,
        evidenceSufficiency: 0.25,
      }),
    });
    expect(calRes.status).toBe(200);
    const calData = (await calRes.json()) as any;
    expect(calData.calibration.calibratedConfidence).toBeLessThanOrEqual(0.6);

    // POST /api/ape/metacognition/contradictions
    const contraRes = await fetch(`http://127.0.0.1:${port}/api/ape/metacognition/contradictions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        statements: ['Worker thread is running', 'Worker thread is not running'],
      }),
    });
    expect(contraRes.status).toBe(200);
    const contraData = (await contraRes.json()) as any;
    expect(contraData.contradictions.length).toBeGreaterThanOrEqual(1);

    // POST /api/ape/metacognition/correct
    const corrRes = await fetch(`http://127.0.0.1:${port}/api/ape/metacognition/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assessmentId: assessData.assessment.id,
        originalClaim: 'Zero network drops possible',
        correctedClaim: 'Network drops mitigated by automatic retry backoff',
        confidenceAdjustment: -0.2,
        rationale: 'Corrected overconfidence assumption',
      }),
    });
    expect(corrRes.status).toBe(201);
    const corrData = (await corrRes.json()) as any;
    expect(corrData.success).toBe(true);
    expect(corrData.correction.id).toBeDefined();

    // GET /api/ape/metacognition/assessments
    const listRes = await fetch(`http://127.0.0.1:${port}/api/ape/metacognition/assessments`);
    expect(listRes.status).toBe(200);
    const assessments = (await listRes.json()) as any[];
    expect(assessments.length).toBeGreaterThanOrEqual(1);

    // GET /api/ape/metacognition/corrections
    const listCorrRes = await fetch(`http://127.0.0.1:${port}/api/ape/metacognition/corrections`);
    expect(listCorrRes.status).toBe(200);
    const corrections = (await listCorrRes.json()) as any[];
    expect(corrections.length).toBeGreaterThanOrEqual(1);
  });
});
