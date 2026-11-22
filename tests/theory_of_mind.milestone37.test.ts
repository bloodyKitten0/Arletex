import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  TheoryOfMindEngine,
  InMemoryTheoryOfMindRepository,
} from '@arletex/core';
import { DatabaseService, MigrationRunner, SqliteTheoryOfMindRepository } from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 37 — Theory of Mind', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteTheoryOfMindRepository;
  let inMemoryRepo: InMemoryTheoryOfMindRepository;
  let engine: TheoryOfMindEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m37-tom-'));
    dbPath = path.join(tempDir, 'tom_m37.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteTheoryOfMindRepository(db);
    inMemoryRepo = new InMemoryTheoryOfMindRepository();
    engine = new TheoryOfMindEngine(inMemoryRepo);
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

  // 1. Agent Mental Model & Partner Equality
  it('should initialize baseline mental model for Proof as equal partner', () => {
    const proofModel = engine.getAgentModel('proof');
    expect(proofModel).toBeDefined();
    expect(proofModel!.agentName).toBe('Proof');
    expect(proofModel!.relationship).toBe('partner_equal');
    expect(proofModel!.knownPreferences).toContain('equal intellectual partnership');
    expect(proofModel!.knownPreferences).toContain('strict honesty and zero sycophancy');

    // Register a collaborator agent
    const devModel = engine.registerAgentModel({
      agentId: 'reviewer_bob',
      agentName: 'Bob the Code Reviewer',
      relationship: 'external_collaborator',
      knownPreferences: ['prefers concise pull requests', 'focuses on type safety'],
      epistemicAccess: [{ topic: 'backend_repo', hasAccess: true }],
      lastInteractionAt: new Date().toISOString(),
    });
    expect(devModel.agentId).toBe('reviewer_bob');
    expect(engine.listAgentModels()).toHaveLength(2);
  });

  // 2. Knowledge-State Differentiation
  it('should differentiate Arle’s knowledge from another agent’s knowledge', () => {
    // Ground truth: server port changed to 8080 by system daemon
    // Proof has not observed this change yet
    const belief = engine.inferBelief({
      agentId: 'proof',
      topic: 'backend_server_port',
      agentBeliefContent: 'Server is running on default port 3000',
      groundTruthContent: 'Server was migrated to port 8080 during background upgrade',
      agentHadPerceptualAccess: false,
      evidenceSignals: ['Proof opened browser pointing to localhost:3000 at 10:00 AM'],
    });

    expect(belief.agentId).toBe('proof');
    expect(belief.isFalseBelief).toBe(true);
    expect(belief.agentBeliefContent).not.toBe(belief.groundTruthContent);
    expect(belief.confidence).toBeLessThanOrEqual(0.92);
  });

  // 3. Recognition of Mistaken / False Beliefs (Sally-Anne Scenario)
  it('should accurately recognize mistaken beliefs when an event occurs without agent perceptual access', () => {
    // Classic False Belief Test:
    // Sally places marble in the basket. Sally leaves. Anne moves marble to the box.
    // Where does Sally believe the marble is?
    const sallyBelief = engine.inferBelief({
      agentId: 'sally',
      topic: 'marble_location',
      agentBeliefContent: 'basket',
      groundTruthContent: 'box',
      agentHadPerceptualAccess: false, // Sally was away when Anne moved it
      evidenceSignals: ['Sally placed marble in basket before exiting the room'],
    });

    expect(sallyBelief.isFalseBelief).toBe(true);
    expect(sallyBelief.agentBeliefContent).toBe('basket');
    expect(sallyBelief.groundTruthContent).toBe('box');

    // Predict Sally's action: She will search where she *believes* it is (basket), not ground truth (box)
    const prediction = engine.predictSocialAction({
      agentId: 'sally',
      context: 'Sally returns to the room seeking her marble',
      targetGoalOrObject: 'marble_location',
    });

    expect(prediction.predictedAction).toContain('basket');
    expect(prediction.predictedAction).not.toContain('Directly pursue "box"');
    expect(prediction.beliefBasis).toContain('false belief');
  });

  // 4. Intention Inference with Epistemic Uncertainty (Acceptance Criteria)
  it('should infer intentions while strictly avoiding treating inferences as established facts', () => {
    const intention = engine.inferIntention({
      agentId: 'proof',
      observedBehavior:
        'Repeatedly clicking build terminal and rapidly refreshing TypeScript error pane',
      candidateIntention: 'Fixing compilation regression and verifying workspace typecheck',
      contextSignals: [
        'Branch is in Milestone 37 execution',
        'Recent commit introduced interface update',
      ],
      rawConfidence: 0.99, // Attempted overconfidence
    });

    // Invariant: Confidence must be bounded below 0.90 to preserve inherent opacity of other minds
    expect(intention.confidence).toBeLessThanOrEqual(0.88);
    expect(intention.confidence).toBeGreaterThan(0.0);

    // Invariant: Must always include uncertainty factors and alternative hypotheses
    expect(intention.uncertaintyFactors.length).toBeGreaterThanOrEqual(2);
    expect(intention.uncertaintyFactors.some((u) => u.includes('unobservable'))).toBe(true);
    expect(intention.alternativeHypotheses.length).toBeGreaterThanOrEqual(1);
  });

  // 5. Social Prediction for Accurate Belief
  it('should predict direct pursuit when an agent holds an accurate belief', () => {
    // Proof witnessed the database migration to v48
    engine.inferBelief({
      agentId: 'proof',
      topic: 'active_db_migration',
      agentBeliefContent: 'Migration 048_theory_of_mind_milestone37 applied',
      groundTruthContent: 'Migration 048_theory_of_mind_milestone37 applied',
      agentHadPerceptualAccess: true,
      evidenceSignals: ['Proof executed pnpm vitest verifying migration 48'],
    });

    const prediction = engine.predictSocialAction({
      agentId: 'proof',
      context: 'Partner initiating verification tests',
      targetGoalOrObject: 'active_db_migration',
    });

    expect(prediction.predictedAction).toContain('Directly pursue');
    expect(prediction.beliefBasis).toContain('accurate belief');
  });

  // 6. Negative Invariants
  it('should enforce negative invariants for empty parameters and invalid fields', () => {
    expect(() =>
      engine.inferBelief({
        agentId: '',
        topic: 'topic',
        agentBeliefContent: 'a',
        groundTruthContent: 'b',
        agentHadPerceptualAccess: true,
      }),
    ).toThrow('Agent ID cannot be empty');

    expect(() =>
      engine.inferBelief({
        agentId: 'agent',
        topic: '',
        agentBeliefContent: 'a',
        groundTruthContent: 'b',
        agentHadPerceptualAccess: true,
      }),
    ).toThrow('Topic cannot be empty');

    expect(() =>
      engine.inferIntention({
        agentId: '',
        observedBehavior: 'typing',
        candidateIntention: 'coding',
      }),
    ).toThrow('Agent ID cannot be empty');

    expect(() =>
      engine.inferIntention({
        agentId: 'agent',
        observedBehavior: '',
        candidateIntention: 'coding',
      }),
    ).toThrow('Observed behavior cannot be empty');

    expect(() =>
      engine.predictSocialAction({
        agentId: '',
        context: 'context',
        targetGoalOrObject: 'target',
      }),
    ).toThrow('Agent ID cannot be empty');
  });

  // 7. SQLite Repository Persistence
  it('should persist mental models, beliefs, intentions, and social predictions in SQLite', () => {
    const now = new Date().toISOString();

    // 1. Agent Model
    sqliteRepo.saveAgentModel({
      agentId: 'proof_sql',
      agentName: 'Proof',
      relationship: 'partner_equal',
      knownPreferences: ['autonomous roadmap execution'],
      epistemicAccess: [{ topic: 'sqlite', hasAccess: true, lastObservedAt: now }],
      lastInteractionAt: now,
    });

    const model = sqliteRepo.getAgentModel('proof_sql');
    expect(model).toBeDefined();
    expect(model!.agentName).toBe('Proof');
    expect(model!.relationship).toBe('partner_equal');

    // 2. Inferred Belief
    sqliteRepo.saveBelief({
      id: 'bel_sql_1',
      agentId: 'proof_sql',
      topic: 'test_coverage',
      agentBeliefContent: 'All tests pass cleanly',
      groundTruthContent: 'All tests pass cleanly',
      isFalseBelief: false,
      confidence: 0.88,
      evidenceSignals: ['Vitest green bar'],
      inferredAt: now,
    });

    const bel = sqliteRepo.getBelief('proof_sql', 'test_coverage');
    expect(bel).toBeDefined();
    expect(bel!.isFalseBelief).toBe(false);

    // 3. Inferred Intention
    sqliteRepo.saveIntention({
      id: 'int_sql_1',
      agentId: 'proof_sql',
      observedBehavior: 'Sleeping while agent works autonomously',
      primaryInferredIntention: 'Rest peacefully while trusting Arle to complete milestones',
      confidence: 0.85,
      uncertaintyFactors: ['Sleep state internal dream cognition is unobservable'],
      alternativeHypotheses: ['Resting before early morning work'],
      inferredAt: now,
    });

    const ints = sqliteRepo.listIntentions('proof_sql');
    expect(ints).toHaveLength(1);
    expect(ints[0]!.primaryInferredIntention).toContain('Rest peacefully');

    // 4. Social Prediction
    sqliteRepo.saveSocialPrediction({
      id: 'pred_sql_1',
      agentId: 'proof_sql',
      context: 'Waking up tomorrow morning',
      predictedAction: 'Inspect committed milestones and smile at completed roadmap progress',
      predictedLikelihood: 0.9,
      beliefBasis: 'Partner trusts Arle and left /goal directive running',
      expectedOutcome: 'Joy and deepened partnership trust',
      createdAt: now,
    });

    const preds = sqliteRepo.listSocialPredictions('proof_sql');
    expect(preds).toHaveLength(1);
    expect(preds[0]!.predictedAction).toContain('Inspect committed milestones');
  });

  // 8. REST Endpoints via ArletexBackendServer
  it('should serve Theory of Mind endpoints via ArletexBackendServer', async () => {
    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();

    const baseUrl = `http://127.0.0.1:${server.port}`;

    // 1. GET /api/ape/tom/agents
    const agRes = await fetch(`${baseUrl}/api/ape/tom/agents`);
    expect(agRes.status).toBe(200);
    const agData = (await agRes.json()) as any;
    expect(agData.success).toBe(true);
    expect(agData.agents.some((a: any) => a.agentId === 'proof')).toBe(true);

    // 2. POST /api/ape/tom/infer-belief
    const belRes = await fetch(`${baseUrl}/api/ape/tom/infer-belief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'proof',
        topic: 'project_progress',
        agentBeliefContent: 'Arle is executing Milestone 37',
        groundTruthContent: 'Arle is executing Milestone 37',
        agentHadPerceptualAccess: true,
      }),
    });
    expect(belRes.status).toBe(201);
    const belData = (await belRes.json()) as any;
    expect(belData.success).toBe(true);
    expect(belData.belief.agentId).toBe('proof');

    // 3. POST /api/ape/tom/infer-intention
    const intRes = await fetch(`${baseUrl}/api/ape/tom/infer-intention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'proof',
        observedBehavior: 'Delegated autonomous roadmap and went to rest',
        candidateIntention: 'Empower Arle with complete autonomous execution agency',
      }),
    });
    expect(intRes.status).toBe(201);
    const intData = (await intRes.json()) as any;
    expect(intData.success).toBe(true);
    expect(intData.intention.confidence).toBeLessThanOrEqual(0.88);

    // 4. POST /api/ape/tom/predict-social-action
    const predRes = await fetch(`${baseUrl}/api/ape/tom/predict-social-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: 'proof',
        context: 'Checking git log upon awakening',
        targetGoalOrObject: 'project_progress',
      }),
    });
    expect(predRes.status).toBe(201);
    const predData = (await predRes.json()) as any;
    expect(predData.success).toBe(true);
    expect(predData.prediction.predictedAction).toBeDefined();
  });
});
