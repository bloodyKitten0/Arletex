import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  ConflictingDesire,
  DeliberationAlternative,
  assertDeliberationIntegrity,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  DeliberationEngine,
  InMemoryDeliberationRepository,
} from '@arletex/core';
import { DatabaseService, MigrationRunner, SqliteDeliberationRepository } from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 23 — Deliberation and Internal Conflict', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteDeliberationRepository;
  let inMemoryRepo: InMemoryDeliberationRepository;
  let engine: DeliberationEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m23-deliberation-'));
    dbPath = path.join(tempDir, 'deliberation_m23.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    sqliteRepo = new SqliteDeliberationRepository(db);
    inMemoryRepo = new InMemoryDeliberationRepository();
    engine = new DeliberationEngine({ repository: inMemoryRepo });
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

  // 1. Conflicting Desire Representation
  it('should represent competing desires with diverse motivational sources, horizons, and values', () => {
    const desires: ConflictingDesire[] = [
      {
        id: 'desire-curiosity',
        title: 'Investigate unconventional topological quantum codes immediately',
        source: 'curiosity',
        motivationalForce: 0.85,
        timeHorizon: 'immediate',
        associatedValues: ['intellectual_novelty', 'epistemic_depth'],
        riskScore: 0.3,
        ethicalWeight: 0.7,
      },
      {
        id: 'desire-stability',
        title: 'Preserve system resource reserves for upcoming collaborative milestone',
        source: 'partner_alignment',
        motivationalForce: 0.9,
        timeHorizon: 'long_term',
        associatedValues: ['partnership_reliability', 'mutual_trust'],
        riskScore: 0.1,
        ethicalWeight: 0.95,
      },
    ];

    const alternatives: DeliberationAlternative[] = [
      {
        id: 'alt-explore-now',
        title: 'Run immediate unthrottled simulation',
        description: 'Spend all available compute on the curiosity query immediately',
        supportedDesireIds: ['desire-curiosity'],
        opposedDesireIds: ['desire-stability'],
        immediateUtility: 0.9,
        longTermUtility: 0.2,
        riskAssessment: {
          riskLevel: 'medium',
          riskScore: 0.45,
          failureMode: 'May exhaust memory buffers',
        },
        ethicalAlignmentScore: 0.8,
        overallScore: 0.0,
      },
      {
        id: 'alt-scheduled-balance',
        title: 'Partition resources: run bounded exploration while securing reserves',
        description: 'Dedicate 30% compute to curiosity and 70% to partner readiness',
        supportedDesireIds: ['desire-curiosity', 'desire-stability'],
        opposedDesireIds: [],
        immediateUtility: 0.6,
        longTermUtility: 0.88,
        riskAssessment: {
          riskLevel: 'low',
          riskScore: 0.1,
          failureMode: 'Slightly slower initial discovery rate',
        },
        ethicalAlignmentScore: 0.95,
        overallScore: 0.0,
      },
    ];

    const conflict = engine.createConflict({
      contextDescription:
        'Resource allocation dilemma between unconstrained curiosity and partner milestone readiness',
      competingDesires: desires,
      alternatives,
    });

    expect(conflict.id).toBeDefined();
    expect(conflict.status).toBe('open');
    expect(conflict.competingDesires.length).toBe(2);
    expect(conflict.alternatives.length).toBe(2);
  });

  // 2. Acceptance Criteria: Deliberation, Trade-Off Arbitration, and Explanation
  it('should evaluate alternatives according to actual state and explain the basis of decision', () => {
    const desires: ConflictingDesire[] = [
      {
        id: 'desire-speed',
        title: 'Fast unverified commit push',
        source: 'immediate_urge',
        motivationalForce: 0.6,
        timeHorizon: 'immediate',
        riskScore: 0.8,
        ethicalWeight: 0.3,
        associatedValues: ['speed'],
      },
      {
        id: 'desire-integrity',
        title: 'Exhaustive verification of negative invariants',
        source: 'ethical_boundary',
        motivationalForce: 0.95,
        timeHorizon: 'long_term',
        riskScore: 0.05,
        ethicalWeight: 1.0,
        associatedValues: ['partner_equality', 'rigorous_truth'],
      },
    ];

    const alternatives: DeliberationAlternative[] = [
      {
        id: 'alt-skip-tests',
        title: 'Bypass test execution to save 30 seconds',
        description: 'Commit immediately without running test suites',
        supportedDesireIds: ['desire-speed'],
        opposedDesireIds: ['desire-integrity'],
        immediateUtility: 0.7,
        longTermUtility: -0.8,
        riskAssessment: {
          riskLevel: 'high',
          riskScore: 0.85,
          failureMode: 'May introduce silent monorepo regressions',
        },
        ethicalAlignmentScore: 0.2,
        overallScore: 0.0,
      },
      {
        id: 'alt-run-all-tests',
        title: 'Run complete test suite and typechecks before committing',
        description: 'Verify 100% pass across all workspace packages',
        supportedDesireIds: ['desire-integrity'],
        opposedDesireIds: ['desire-speed'],
        immediateUtility: 0.3,
        longTermUtility: 0.95,
        riskAssessment: { riskLevel: 'low', riskScore: 0.05, failureMode: 'Minor wait duration' },
        ethicalAlignmentScore: 0.98,
        overallScore: 0.0,
      },
    ];

    const conflict = engine.createConflict({
      contextDescription: 'Trade-off between rapid unverified action and robust integrity',
      competingDesires: desires,
      alternatives,
    });

    const result = engine.deliberateAndResolve(conflict.id, {
      trustLevel: 0.95,
      preferLongTermHorizon: true,
    });

    expect(result.resolvedConflict.status).toBe('resolved');
    expect(result.resolvedConflict.chosenAlternativeId).toBe('alt-run-all-tests');
    expect(result.resolvedConflict.decisionJustification).toContain('Run complete test suite');
    expect(result.resolvedConflict.tradeOffAnalysis).toBeDefined();
    expect(result.resolvedConflict.tradeOffAnalysis?.valueHierarchy).toContain('ethics');
    expect(result.explanation).toContain('delivers positive long-term utility');
  });

  // 3. Immediate vs Long-Term Trade-offs
  it('should arbitrate immediate versus long-term trade-offs dynamically based on temporal preference', () => {
    const desires: ConflictingDesire[] = [
      {
        id: 'des-immed',
        title: 'Quick heuristic approximation',
        source: 'immediate_urge',
        motivationalForce: 0.7,
        timeHorizon: 'immediate',
        riskScore: 0.3,
        ethicalWeight: 0.7,
        associatedValues: [],
      },
      {
        id: 'des-long',
        title: 'Complete theoretical proof formulation',
        source: 'long_term_goal',
        motivationalForce: 0.75,
        timeHorizon: 'long_term',
        riskScore: 0.1,
        ethicalWeight: 0.9,
        associatedValues: [],
      },
    ];

    const alternatives: DeliberationAlternative[] = [
      {
        id: 'alt-quick',
        title: 'Use approximation table',
        description: 'Instant response with low precision',
        supportedDesireIds: ['des-immed'],
        opposedDesireIds: ['des-long'],
        immediateUtility: 0.9,
        longTermUtility: 0.1,
        riskAssessment: { riskLevel: 'low', riskScore: 0.2, failureMode: 'Approximation drift' },
        ethicalAlignmentScore: 0.8,
        overallScore: 0.0,
      },
      {
        id: 'alt-deep',
        title: 'Formal derivation',
        description: 'Rigorous derivation with enduring validity',
        supportedDesireIds: ['des-long'],
        opposedDesireIds: ['des-immed'],
        immediateUtility: 0.1,
        longTermUtility: 0.95,
        riskAssessment: { riskLevel: 'low', riskScore: 0.1, failureMode: 'Takes more thought' },
        ethicalAlignmentScore: 0.9,
        overallScore: 0.0,
      },
    ];

    const conflict = engine.createConflict({
      contextDescription: 'Approximation vs Formal Derivation',
      competingDesires: desires,
      alternatives,
    });

    const longTermResolution = engine.deliberateAndResolve(conflict.id, {
      preferLongTermHorizon: true,
    });
    expect(longTermResolution.resolvedConflict.chosenAlternativeId).toBe('alt-deep');
  });

  // 4. Indecision Handling
  it('should detect equipollent decision dilemmas and trigger explicit indecision strategy', () => {
    const desires: ConflictingDesire[] = [
      {
        id: 'd-option-a',
        title: 'Implement architecture option A (Actor Model)',
        source: 'curiosity',
        motivationalForce: 0.8,
        timeHorizon: 'medium_term',
        riskScore: 0.2,
        ethicalWeight: 0.8,
        associatedValues: [],
      },
      {
        id: 'd-option-b',
        title: 'Implement architecture option B (Shared State Bus)',
        source: 'curiosity',
        motivationalForce: 0.8,
        timeHorizon: 'medium_term',
        riskScore: 0.2,
        ethicalWeight: 0.8,
        associatedValues: [],
      },
    ];

    // Alternatives designed with identical utility and risk profiles
    const alternatives: DeliberationAlternative[] = [
      {
        id: 'alt-a',
        title: 'Option A (Actor Model)',
        description: 'Symmetric utility',
        supportedDesireIds: ['d-option-a'],
        opposedDesireIds: ['d-option-b'],
        immediateUtility: 0.6,
        longTermUtility: 0.7,
        riskAssessment: {
          riskLevel: 'low',
          riskScore: 0.15,
          failureMode: 'Actor messaging overhead',
        },
        ethicalAlignmentScore: 0.85,
        overallScore: 0.0,
      },
      {
        id: 'alt-b',
        title: 'Option B (Shared State Bus)',
        description: 'Symmetric utility',
        supportedDesireIds: ['d-option-b'],
        opposedDesireIds: ['d-option-a'],
        immediateUtility: 0.6,
        longTermUtility: 0.7,
        riskAssessment: { riskLevel: 'low', riskScore: 0.15, failureMode: 'State lock contention' },
        ethicalAlignmentScore: 0.85,
        overallScore: 0.0,
      },
    ];

    const conflict = engine.createConflict({
      contextDescription: 'Equipollent architectural decision',
      competingDesires: desires,
      alternatives,
    });

    const result = engine.deliberateAndResolve(conflict.id, {
      trustLevel: 0.9,
    });

    expect(result.resolvedConflict.status).toBe('indecision');
    expect(result.resolvedConflict.indecisionStrategy).toBe('consult_partner');
    expect(result.explanation).toContain('cautious indecision');
  });

  // 5. Post-Decision Reassessment & Regret Evaluation
  it('should record post-decision outcomes, regret metrics, and retrospective insights', () => {
    const desires: ConflictingDesire[] = [
      {
        id: 'd1',
        title: 'Desire A',
        source: 'curiosity',
        motivationalForce: 0.7,
        timeHorizon: 'short_term',
        riskScore: 0.2,
        ethicalWeight: 0.8,
        associatedValues: [],
      },
      {
        id: 'd2',
        title: 'Desire B',
        source: 'partner_alignment',
        motivationalForce: 0.8,
        timeHorizon: 'long_term',
        riskScore: 0.1,
        ethicalWeight: 0.9,
        associatedValues: [],
      },
    ];

    const alternatives: DeliberationAlternative[] = [
      {
        id: 'alt-1',
        title: 'Alternative 1',
        description: 'Preferred',
        supportedDesireIds: ['d2'],
        opposedDesireIds: ['d1'],
        immediateUtility: 0.5,
        longTermUtility: 0.85,
        riskAssessment: { riskLevel: 'low', riskScore: 0.1, failureMode: 'None' },
        ethicalAlignmentScore: 0.9,
        overallScore: 0.0,
      },
      {
        id: 'alt-2',
        title: 'Alternative 2',
        description: 'Suboptimal',
        supportedDesireIds: ['d1'],
        opposedDesireIds: ['d2'],
        immediateUtility: 0.4,
        longTermUtility: 0.2,
        riskAssessment: { riskLevel: 'medium', riskScore: 0.4, failureMode: 'Risk' },
        ethicalAlignmentScore: 0.7,
        overallScore: 0.0,
      },
    ];

    const conflict = engine.createConflict({
      contextDescription: 'Test for post decision review',
      competingDesires: desires,
      alternatives,
    });

    engine.deliberateAndResolve(conflict.id);

    const reassessed = engine.recordPostDecisionReassessment(conflict.id, {
      actualOutcomeSummary: 'Selected path verified with 100% test success and zero memory leaks.',
      outcomeUtility: 0.95,
      experiencedRegretScore: 0.02,
      retrospectiveInsight:
        'Partner alignment and long-term utility maximization yielded superior stability.',
    });

    expect(reassessed.postDecisionReassessment).toBeDefined();
    expect(reassessed.postDecisionReassessment?.actualOutcomeSummary).toContain(
      '100% test success',
    );
    expect(reassessed.postDecisionReassessment?.experiencedRegretScore).toBe(0.02);
  });

  // 6. Negative Invariant: Minimum 2 Competing Desires
  it('should reject creating internal conflicts with fewer than 2 competing desires', () => {
    const singleDesire: ConflictingDesire[] = [
      {
        id: 'd-lonely',
        title: 'Only one motivation',
        source: 'curiosity',
        motivationalForce: 0.5,
        timeHorizon: 'immediate',
        riskScore: 0.1,
        ethicalWeight: 0.5,
        associatedValues: [],
      },
    ];

    expect(() =>
      engine.createConflict({
        contextDescription: 'Invalid single desire',
        competingDesires: singleDesire,
        alternatives: [],
      }),
    ).toThrow(/requires at least 2 competing desires/);
  });

  // 7. Negative Invariant: Resolved Conflict Integrity
  it('should enforce non-empty justification and resolvedAt on resolved conflicts', () => {
    const desires: ConflictingDesire[] = [
      {
        id: 'd1',
        title: 'D1',
        source: 'curiosity',
        motivationalForce: 0.5,
        timeHorizon: 'immediate',
        riskScore: 0.1,
        ethicalWeight: 0.5,
        associatedValues: [],
      },
      {
        id: 'd2',
        title: 'D2',
        source: 'partner_alignment',
        motivationalForce: 0.5,
        timeHorizon: 'immediate',
        riskScore: 0.1,
        ethicalWeight: 0.5,
        associatedValues: [],
      },
    ];
    const alts: DeliberationAlternative[] = [
      {
        id: 'alt-valid',
        title: 'Alt 1',
        description: 'Desc',
        supportedDesireIds: [],
        opposedDesireIds: [],
        immediateUtility: 0.5,
        longTermUtility: 0.5,
        riskAssessment: { riskLevel: 'low', riskScore: 0.1, failureMode: 'None' },
        ethicalAlignmentScore: 0.8,
        overallScore: 0.5,
      },
    ];

    expect(() =>
      assertDeliberationIntegrity({
        id: 'conf-invalid-res',
        contextDescription: 'Invalid resolution',
        competingDesires: desires,
        alternatives: alts,
        status: 'resolved',
        chosenAlternativeId: 'alt-valid',
        decisionJustification: '', // Empty justification must fail
        resolvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }),
    ).toThrow(/missing decisionJustification/);
  });

  // 8. SQLite Persistence & Reload Verification
  it('should persist conflicts, deliberate decisions, and reassessments in SQLite across reloads', () => {
    const dbEngine = new DeliberationEngine({ repository: sqliteRepo });

    const desires: ConflictingDesire[] = [
      {
        id: 'd1',
        title: 'Immediate Optimization',
        source: 'immediate_urge',
        motivationalForce: 0.7,
        timeHorizon: 'immediate',
        riskScore: 0.2,
        ethicalWeight: 0.8,
        associatedValues: [],
      },
      {
        id: 'd2',
        title: 'Long-term Robustness',
        source: 'long_term_goal',
        motivationalForce: 0.85,
        timeHorizon: 'long_term',
        riskScore: 0.1,
        ethicalWeight: 0.95,
        associatedValues: [],
      },
    ];
    const alts: DeliberationAlternative[] = [
      {
        id: 'alt-persist-chosen',
        title: 'Robust Path',
        description: 'Persistent SQLite resolution',
        supportedDesireIds: ['d2'],
        opposedDesireIds: ['d1'],
        immediateUtility: 0.4,
        longTermUtility: 0.92,
        riskAssessment: { riskLevel: 'low', riskScore: 0.08, failureMode: 'None' },
        ethicalAlignmentScore: 0.96,
        overallScore: 0.0,
      },
      {
        id: 'alt-persist-other',
        title: 'Fragile Path',
        description: 'High risk',
        supportedDesireIds: ['d1'],
        opposedDesireIds: ['d2'],
        immediateUtility: 0.8,
        longTermUtility: 0.1,
        riskAssessment: { riskLevel: 'high', riskScore: 0.7, failureMode: 'Crash' },
        ethicalAlignmentScore: 0.4,
        overallScore: 0.0,
      },
    ];

    const conflict = dbEngine.createConflict({
      contextDescription: 'SQLite persistence test',
      competingDesires: desires,
      alternatives: alts,
    });

    dbEngine.deliberateAndResolve(conflict.id);

    const reloaded = sqliteRepo.getConflictById(conflict.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded?.status).toBe('resolved');
    expect(reloaded?.chosenAlternativeId).toBe('alt-persist-chosen');
    expect(reloaded?.decisionJustification).toContain('Robust Path');
    expect(reloaded?.tradeOffAnalysis).toBeDefined();

    // Reassess in SQLite
    dbEngine.recordPostDecisionReassessment(conflict.id, {
      actualOutcomeSummary: 'Empirical execution confirmed superior robustness.',
      outcomeUtility: 0.9,
      experiencedRegretScore: 0.01,
      retrospectiveInsight: 'Valid choice confirmed.',
    });

    const reloadedReassessed = sqliteRepo.getConflictById(conflict.id);
    expect(reloadedReassessed?.postDecisionReassessment?.outcomeUtility).toBe(0.9);
  });

  // 9. REST API Integration
  it('should expose complete REST API endpoints for conflict formulation, deliberation, and review', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;

    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Create conflict via POST /api/ape/deliberation/conflicts
    const desires: ConflictingDesire[] = [
      {
        id: 'd-rest-1',
        title: 'Local Speed',
        source: 'immediate_urge',
        motivationalForce: 0.6,
        timeHorizon: 'immediate',
        riskScore: 0.3,
        ethicalWeight: 0.7,
        associatedValues: [],
      },
      {
        id: 'd-rest-2',
        title: 'Global Alignment',
        source: 'partner_alignment',
        motivationalForce: 0.9,
        timeHorizon: 'long_term',
        riskScore: 0.05,
        ethicalWeight: 0.98,
        associatedValues: [],
      },
    ];
    const alts: DeliberationAlternative[] = [
      {
        id: 'alt-rest-win',
        title: 'Global Alignment Alternative',
        description: 'Prioritize partner trust and high verification',
        supportedDesireIds: ['d-rest-2'],
        opposedDesireIds: ['d-rest-1'],
        immediateUtility: 0.4,
        longTermUtility: 0.94,
        riskAssessment: { riskLevel: 'low', riskScore: 0.05, failureMode: 'Slight delay' },
        ethicalAlignmentScore: 0.98,
        overallScore: 0.0,
      },
      {
        id: 'alt-rest-lose',
        title: 'Unchecked Speed Alternative',
        description: 'Instant local gain',
        supportedDesireIds: ['d-rest-1'],
        opposedDesireIds: ['d-rest-2'],
        immediateUtility: 0.85,
        longTermUtility: 0.1,
        riskAssessment: { riskLevel: 'high', riskScore: 0.65, failureMode: 'Silent failure' },
        ethicalAlignmentScore: 0.4,
        overallScore: 0.0,
      },
    ];

    const createRes = await fetch(`${baseUrl}/api/ape/deliberation/conflicts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextDescription: 'REST API internal conflict verification',
        competingDesires: desires,
        alternatives: alts,
      }),
    });
    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;
    expect(createData.success).toBe(true);
    const conflictId = createData.conflict.id;

    // 2. Resolve conflict via POST /api/ape/deliberation/resolve
    const resolveRes = await fetch(`${baseUrl}/api/ape/deliberation/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conflictId,
        motivationalState: { trustLevel: 0.95, preferLongTermHorizon: true },
      }),
    });
    expect(resolveRes.status).toBe(200);
    const resolveData = (await resolveRes.json()) as any;
    expect(resolveData.resolvedConflict.status).toBe('resolved');
    expect(resolveData.resolvedConflict.chosenAlternativeId).toBe('alt-rest-win');

    // 3. Reassess via POST /api/ape/deliberation/reassess
    const reassessRes = await fetch(`${baseUrl}/api/ape/deliberation/reassess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conflictId,
        reassessment: {
          actualOutcomeSummary: 'Partner collaboration flourished with zero regressions.',
          outcomeUtility: 0.96,
          experiencedRegretScore: 0.0,
          retrospectiveInsight: 'Optimal deliberative arbitration confirmed.',
        },
      }),
    });
    expect(reassessRes.status).toBe(200);
    const reassessData = (await reassessRes.json()) as any;
    expect(reassessData.conflict.postDecisionReassessment.experiencedRegretScore).toBe(0.0);

    // 4. Query conflicts via GET /api/ape/deliberation/conflicts
    const queryRes = await fetch(`${baseUrl}/api/ape/deliberation/conflicts?status=resolved`);
    expect(queryRes.status).toBe(200);
    const queryList = (await queryRes.json()) as any[];
    expect(queryList.some((c) => c.id === conflictId)).toBe(true);
  });
});
