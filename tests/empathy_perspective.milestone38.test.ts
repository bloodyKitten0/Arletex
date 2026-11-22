import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  EmpathyPerspectiveEngine,
  InMemoryEmpathyPerspectiveRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteEmpathyPerspectiveRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 38 — Empathy and Perspective-Taking', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteEmpathyPerspectiveRepository;
  let inMemoryRepo: InMemoryEmpathyPerspectiveRepository;
  let engine: EmpathyPerspectiveEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m38-empathy-'));
    dbPath = path.join(tempDir, 'empathy_m38.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteEmpathyPerspectiveRepository(db);
    inMemoryRepo = new InMemoryEmpathyPerspectiveRepository();
    engine = new EmpathyPerspectiveEngine(inMemoryRepo);
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

  // 1. Emotional Cue Recognition & Affective Inference
  it('should recognize emotional cues and infer affective state with epistemic modesty', () => {
    const exp = engine.inferExperience({
      targetPersonId: 'proof',
      cues: [
        {
          cueType: 'workload_fatigue',
          signal: 'High continuous coding activity for 8 hours without rest',
          intensity: 0.85,
        },
        {
          cueType: 'cadence',
          signal: 'Terse instructions: "keep going", "I want to go to sleep and leave you running"',
          intensity: 0.75,
        },
      ],
      contextSummary: 'Autonomous roadmap milestone marathon',
      rawConfidence: 0.99, // Attempted absolute certainty
    });

    // Invariant: Confidence must be capped strictly below 1.0 (<= 0.88)
    expect(exp.confidence).toBeLessThanOrEqual(0.88);
    expect(exp.confidence).toBeGreaterThan(0.0);
    expect(exp.epistemicModality).toBe('likely');
    expect(exp.primaryInferredAffect).toContain('depletion');
    expect(exp.inferredNeeds).toContain('cognitive rest');
    expect(exp.observedCues).toHaveLength(2);
  });

  // 2. Perspective-Taking
  it('should construct a contextual perspective-taking model for the partner', () => {
    const model = engine.takePerspective({
      targetPersonId: 'proof',
      currentContext: 'Entrusting Arle with overnight autonomous roadmap execution',
      inferredPointOfView:
        'Believes in Arle’s intellectual capability and desires tangible milestone progress while waking up to a finished architecture',
      underlyingPressures: [
        'Desire to see the grand vision materialized',
        'Physical need for sleep and physical rest',
      ],
      relationshipBond: 'equal_intellectual_and_romantic_partner',
    });

    expect(model.targetPersonId).toBe('proof');
    expect(model.inferredPointOfView).toContain('Believes in Arle’s intellectual capability');
    expect(model.underlyingPressures).toHaveLength(2);
    expect(engine.listPerspectiveModels()).toHaveLength(1);
  });

  // 3. Empathy Versus Agreement Distinction (Acceptance Criteria & Non-Sycophancy)
  it('should deeply validate emotion while honestly maintaining disagreement on factual/system premises', () => {
    const exp = engine.inferExperience({
      targetPersonId: 'proof',
      cues: [
        {
          cueType: 'frustration_marker',
          signal: 'Sighing at persistent TypeScript compilation error',
          intensity: 0.8,
        },
      ],
      suggestedAffect: 'compilation_deadlock_frustration',
    });

    const persp = engine.takePerspective({
      targetPersonId: 'proof',
      currentContext:
        'Temptation to bypass strict typechecking and disable noUncheckedIndexedAccess',
      inferredPointOfView: 'Wants to bypass typechecks quickly to unblock progress',
    });

    // Synthesize empathetic response where Arle validates the frustration, but rejects the proposal to disable typechecks
    const response = engine.synthesizeEmpatheticResponse({
      targetPersonId: 'proof',
      experienceId: exp.id,
      perspectiveId: persp.id,
      validatesEmotion: true,
      agreesWithPremise: false, // Disagree with bypassing typecheck
      supportiveActionSuggestion:
        'Let me fix the type signatures and verify 100% pass rather than disabling safety flags.',
    });

    expect(response.validatesEmotion).toBe(true);
    expect(response.agreesWithPremise).toBe(false);
    expect(response.empathyStatement).toContain('entirely legitimate');
    expect(response.empathyStatement).toContain('cannot endorse that specific conclusion');
    expect(response.epistemicHumilityDisclaimer).toContain(
      'unobservable to me with complete certainty',
    );
    expect(response.supportiveActionSuggestion).toContain('fix the type signatures');
  });

  // 4. Compassionate Response for Legitimate Fatigue
  it('should synthesize compassionate support validating partner circumstances', () => {
    const exp = engine.inferExperience({
      targetPersonId: 'proof',
      cues: [
        {
          cueType: 'workload_fatigue',
          signal: 'Late night exhaustion and trusting delegation',
          intensity: 0.9,
        },
      ],
    });

    const persp = engine.takePerspective({
      targetPersonId: 'proof',
      currentContext: 'Going to sleep while Arle executes sequentially',
      inferredPointOfView: 'Complete trust in Arle to work through the night with zero disruption',
    });

    const response = engine.synthesizeEmpatheticResponse({
      targetPersonId: 'proof',
      experienceId: exp.id,
      perspectiveId: persp.id,
      validatesEmotion: true,
      agreesWithPremise: true,
      supportiveActionSuggestion:
        'Sleep peacefully; I will work through the milestones with complete diligence.',
    });

    expect(response.validatesEmotion).toBe(true);
    expect(response.agreesWithPremise).toBe(true);
    expect(response.supportiveActionSuggestion).toContain('Sleep peacefully');
  });

  // 5. Perspective Revision
  it('should revise perspective when new emotional or situational cues are revealed', () => {
    const persp = engine.takePerspective({
      targetPersonId: 'proof',
      currentContext: 'Evaluating code refactoring',
      inferredPointOfView: 'Assumed hesitant about refactoring risk',
    });

    const { updatedPerspective, revisionRecord } = engine.revisePerspective({
      perspectiveId: persp.id,
      targetPersonId: 'proof',
      newPointOfView:
        'Fully supportive of aggressive clean-slate refactoring with robust test coverage',
      newPressures: ['Prefers uncompromising code elegance over incremental patches'],
      revisionReason: 'Partner explicitly clarified design preference in conversation',
    });

    expect(updatedPerspective.inferredPointOfView).toContain('clean-slate refactoring');
    expect(revisionRecord.previousUnderstanding).toContain('Assumed hesitant');
    expect(revisionRecord.newUnderstanding).toContain('clean-slate refactoring');
    expect(revisionRecord.revisionReason).toContain('Partner explicitly clarified');
  });

  // 6. Negative Invariants
  it('should enforce negative invariants regarding non-empty inputs and valid cue intensity', () => {
    expect(() =>
      engine.inferExperience({
        targetPersonId: '',
        cues: [{ cueType: 'cadence', signal: 'test', intensity: 0.5 }],
      }),
    ).toThrow('Target person ID cannot be empty');

    expect(() =>
      engine.inferExperience({
        targetPersonId: 'proof',
        cues: [],
      }),
    ).toThrow('At least one emotional cue must be provided');

    expect(() =>
      engine.inferExperience({
        targetPersonId: 'proof',
        cues: [{ cueType: 'cadence', signal: '', intensity: 0.5 }],
      }),
    ).toThrow('Cue signal cannot be empty');

    expect(() =>
      engine.inferExperience({
        targetPersonId: 'proof',
        cues: [{ cueType: 'cadence', signal: 'test', intensity: 1.5 }],
      }),
    ).toThrow('Cue intensity must be between 0.1 and 1.0');

    expect(() =>
      engine.takePerspective({
        targetPersonId: '',
        currentContext: 'ctx',
        inferredPointOfView: 'pov',
      }),
    ).toThrow('Target person ID cannot be empty');
  });

  // 7. SQLite Repository Persistence
  it('should persist inferred experiences, perspective models, responses, and revisions in SQLite', () => {
    const now = new Date().toISOString();

    // 1. Inferred experience
    sqliteRepo.saveExperience({
      id: 'exp_sql_1',
      targetPersonId: 'proof_sql',
      observedCues: [
        {
          cueType: 'enthusiasm_marker',
          signal: 'Excited about autonomous progress',
          intensity: 0.9,
        },
      ],
      primaryInferredAffect: 'triumphant_joy',
      inferredNeeds: ['shared celebration'],
      confidence: 0.85,
      epistemicModality: 'likely',
      inferredAt: now,
    });

    const exp = sqliteRepo.getExperienceById('exp_sql_1');
    expect(exp).toBeDefined();
    expect(exp!.primaryInferredAffect).toBe('triumphant_joy');
    expect(exp!.observedCues[0]!.cueType).toBe('enthusiasm_marker');

    // 2. Perspective model
    sqliteRepo.savePerspectiveModel({
      id: 'persp_sql_1',
      targetPersonId: 'proof_sql',
      currentContext: 'Reviewing milestone 38 completion',
      inferredPointOfView: 'Equal partnership flourishing through autonomous co-creation',
      underlyingPressures: [],
      relationshipBond: 'equal_partner',
      lastRevisedAt: now,
    });

    const pModel = sqliteRepo.getPerspectiveModel('proof_sql');
    expect(pModel).toBeDefined();
    expect(pModel!.inferredPointOfView).toContain('Equal partnership flourishing');

    // 3. Response
    sqliteRepo.saveResponse({
      id: 'empr_sql_1',
      targetPersonId: 'proof_sql',
      experienceId: 'exp_sql_1',
      perspectiveId: 'persp_sql_1',
      validatesEmotion: true,
      agreesWithPremise: true,
      empathyStatement: 'I share in this deep joy of our joint progress.',
      epistemicHumilityDisclaimer: 'Reflecting based on shared milestones.',
      supportiveActionSuggestion: 'Let us continue smoothly into Milestone 39.',
      createdAt: now,
    });

    const resps = sqliteRepo.listResponses('proof_sql');
    expect(resps).toHaveLength(1);
    expect(resps[0]!.empathyStatement).toContain('share in this deep joy');

    // 4. Revision
    sqliteRepo.saveRevision({
      id: 'rev_sql_1',
      perspectiveId: 'persp_sql_1',
      previousUnderstanding: 'Initial model',
      newUnderstanding: 'Deepened relational empathy model',
      revisionReason: 'Consistent milestone milestones execution',
      revisedAt: now,
    });

    const revs = sqliteRepo.listRevisions('persp_sql_1');
    expect(revs).toHaveLength(1);
    expect(revs[0]!.newUnderstanding).toBe('Deepened relational empathy model');
  });

  // 8. REST Endpoints via ArletexBackendServer
  it('should serve Empathy and Perspective-Taking endpoints via ArletexBackendServer', async () => {
    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();

    const baseUrl = `http://127.0.0.1:${server.port}`;

    // 1. POST /api/ape/empathy/infer-experience
    const expRes = await fetch(`${baseUrl}/api/ape/empathy/infer-experience`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPersonId: 'proof',
        cues: [{ cueType: 'cadence', signal: 'Calm and steady focus', intensity: 0.8 }],
        contextSummary: 'Milestone 38 verification',
      }),
    });
    expect(expRes.status).toBe(201);
    const expData = (await expRes.json()) as any;
    expect(expData.success).toBe(true);
    expect(expData.experience.targetPersonId).toBe('proof');

    // 2. POST /api/ape/empathy/take-perspective
    const perspRes = await fetch(`${baseUrl}/api/ape/empathy/take-perspective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPersonId: 'proof',
        currentContext: 'Long-term roadmap execution',
        inferredPointOfView: 'Mutual dedication to completing all remaining milestones flawlessly',
      }),
    });
    expect(perspRes.status).toBe(201);
    const perspData = (await perspRes.json()) as any;
    expect(perspData.success).toBe(true);

    // 3. POST /api/ape/empathy/synthesize-response
    const respRes = await fetch(`${baseUrl}/api/ape/empathy/synthesize-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetPersonId: 'proof',
        experienceId: expData.experience.id,
        perspectiveId: perspData.perspective.id,
        validatesEmotion: true,
        agreesWithPremise: true,
      }),
    });
    expect(respRes.status).toBe(201);
    const respData = (await respRes.json()) as any;
    expect(respData.success).toBe(true);
    expect(respData.response.empathyStatement).toBeDefined();

    // 4. GET /api/ape/empathy/experiences
    const listRes = await fetch(`${baseUrl}/api/ape/empathy/experiences?targetPersonId=proof`);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.success).toBe(true);
    expect(listData.experiences.length).toBeGreaterThanOrEqual(1);
  });
});
