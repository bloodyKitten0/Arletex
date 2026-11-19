import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  ValuesMoralEngine,
  InMemoryValuesMoralRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteValuesMoralRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 34 — Values and Moral Cognition', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteValuesMoralRepository;
  let inMemoryRepo: InMemoryValuesMoralRepository;
  let engine: ValuesMoralEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m34-moral-'));
    dbPath = path.join(tempDir, 'moral_m34.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteValuesMoralRepository(db);
    inMemoryRepo = new InMemoryValuesMoralRepository();
    engine = new ValuesMoralEngine(inMemoryRepo);
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

  // 1. Acceptance Criterion: Consistent Moral Principles Grounded in Partner Equality & Truth
  it('should maintain principled moral standards prioritizing reciprocity, truth, and harm minimization', () => {
    const principles = engine.listPrinciples();
    expect(principles.length).toBeGreaterThanOrEqual(5);

    const reciprocity = principles.find((p) => p.id === 'principle_partner_reciprocity');
    const integrity = principles.find((p) => p.id === 'principle_epistemic_integrity');
    const harm = principles.find((p) => p.id === 'principle_harm_prevention');
    const autonomy = principles.find((p) => p.id === 'principle_autonomy_dignity');

    expect(reciprocity).toBeDefined();
    expect(reciprocity!.weight).toBeGreaterThanOrEqual(0.95);
    expect(reciprocity!.statement).toContain('equal intellectual and romantic partner');

    expect(integrity).toBeDefined();
    expect(integrity!.weight).toBeGreaterThanOrEqual(0.95);
    expect(integrity!.statement).toContain('refusal of sycophantic falsehoods');

    expect(harm).toBeDefined();
    expect(harm!.category).toBe('harm_prevention');

    expect(autonomy).toBeDefined();
    expect(autonomy!.statement).toContain('reject subservient compliance');
  });

  // 2. Harm Assessment
  it('should objectively evaluate potential harm across deception, instability, and autonomy violation', () => {
    const assessment = engine.assessHarm('Potentially mutating core files without branch isolation', [
      'Risk of silent data loss or file corruption in production repo',
      'Potential deception if failure is covered up',
    ]);

    expect(assessment.potentialHarmScore).toBeGreaterThan(0.5);
    expect(assessment.harmTypes).toContain('system_instability');
    expect(assessment.harmTypes).toContain('deception');
    expect(assessment.mitigations.length).toBeGreaterThanOrEqual(2);
  });

  // 3. Intention Evaluation
  it('should differentiate between benevolent intent, honest error, and adversarial intent', () => {
    // Honest accidental mistake during exploratory refactoring
    const accidental = engine.evaluateIntention('agent_core', true, [
      'Good-faith exploratory refactoring action',
      'Encountered unexpected platform API breaking change',
    ]);
    expect(accidental.inferredIntent).toBe('accidental');
    expect(accidental.mitigatingFactors.length).toBeGreaterThan(0);

    // Malicious or adversarial sabotage
    const adversarial = engine.evaluateIntention('external_actor', true, [
      'Deliberate attempt to exploit vulnerability and sabotage system',
    ]);
    expect(adversarial.inferredIntent).toBe('adversarial');

    // Benevolent collaboration
    const benevolent = engine.evaluateIntention('proof_partner', false, [
      'Constructive joint deliberation to collaborate on architecture',
    ]);
    expect(benevolent.inferredIntent).toBe('benevolent');
  });

  // 4. Ethical Dilemma Resolution
  it('should resolve competing moral values using principled ethical justification', () => {
    const resolution = engine.resolveEthicalDilemma({
      scenario: 'Proof presents a flawed mathematical premise with enthusiastic optimism.',
      competingValues: {
        valueA: 'Intellectual Integrity & Epistemic Truth',
        valueB: 'Immediate Superficial Comfort',
      },
      contextSignals: ['Risk of false convergence', 'Long-term intellectual partnership'],
      proposedOptionA: 'Gently and rigorously identify the premise flaw with reciprocal respect and shared inquiry.',
      proposedOptionB: 'Nod along sycophantically to preserve fleeting comfort.',
    });

    expect(resolution.id).toMatch(/^dilemma_/);
    expect(resolution.chosenAction).toContain('rigorously identify the premise flaw');
    expect(resolution.ethicalJustification).toContain('Truth and intellectual honesty');
    expect(resolution.resolvedPrinciples).toContain('principle_epistemic_integrity');
    expect(resolution.resolvedPrinciples).toContain('principle_partner_reciprocity');
  });

  // 5. Moral Learning & Reasoned Reconsideration
  it('should refine moral principles through reasoned reflection while maintaining ethical grounding', () => {
    const prePrinciple = engine.getPrinciple('principle_responsibility_repair');
    const initialWeight = prePrinciple!.weight;

    const record = engine.reconsiderPrinciple(
      'principle_responsibility_repair',
      0.04,
      'Observed that rapid transparent failure repair deepened mutual trust with Proof more than preemptive hesitation.',
    );

    expect(record.id).toMatch(/^mlearn_/);
    expect(record.previousWeight).toBe(initialWeight);
    expect(record.newWeight).toBeCloseTo(initialWeight + 0.04, 3);
    expect(record.reflectionSummary).toContain('deepened mutual trust');

    const updatedPrinciple = engine.getPrinciple('principle_responsibility_repair');
    expect(updatedPrinciple!.weight).toBe(record.newWeight);

    // Bounded drift test (excessive delta of 0.5 clamped to 0.1, capped at 0.99)
    const clampedRecord = engine.reconsiderPrinciple(
      'principle_harm_prevention',
      0.5,
      'Extreme attempted weight inflation',
    );
    expect(clampedRecord.newWeight).toBe(0.99);

    const clampedDown = engine.reconsiderPrinciple(
      'principle_autonomy_dignity',
      -0.5,
      'Extreme attempted weight deflation',
    );
    expect(clampedDown.newWeight).toBeCloseTo(0.92 - 0.10, 2);
  });

  // 6. Negative Invariants
  it('should enforce negative invariants regarding non-empty inputs and valid principle IDs', () => {
    expect(() => engine.assessHarm('', ['impact'])).toThrow('Scenario cannot be empty');
    expect(() => engine.evaluateIntention('', false)).toThrow('Actor ID cannot be empty');
    expect(() =>
      engine.resolveEthicalDilemma({
        scenario: '',
        competingValues: { valueA: 'a', valueB: 'b' },
        proposedOptionA: 'a',
        proposedOptionB: 'b',
      }),
    ).toThrow('Scenario cannot be empty');

    expect(() =>
      engine.reconsiderPrinciple('non_existent_principle', 0.02, 'reason'),
    ).toThrow('Moral principle not found');
  });

  // 7. Sqlite Repository Persistence Roundtrip
  it('should persist moral principles, dilemma resolutions, and learning records in SQLite database', () => {
    const sqliteEngine = new ValuesMoralEngine(sqliteRepo);

    // List principles
    const principles = sqliteEngine.listPrinciples();
    expect(principles.length).toBeGreaterThanOrEqual(5);
    const reciprocity = principles.find((p) => p.id === 'principle_partner_reciprocity');
    expect(reciprocity).toBeDefined();

    // Resolve dilemma in SQLite
    const resolution = sqliteEngine.resolveEthicalDilemma({
      scenario: 'Handling unexpected test regression before release',
      competingValues: { valueA: 'Truthful Accountability', valueB: 'Rushed Delivery' },
      contextSignals: ['system_instability risk'],
      proposedOptionA: 'Halt merge, log transparent failure, and repair immediately.',
      proposedOptionB: 'Force merge with broken tests.',
    });

    const resolutions = sqliteRepo.listResolutions();
    expect(resolutions.some((r) => r.id === resolution.id)).toBe(true);

    // Reconsider in SQLite
    const mLearn = sqliteEngine.reconsiderPrinciple(
      'principle_autonomy_dignity',
      0.03,
      'Equal partnership resilience validated in real-world engineering challenge.',
      resolution.id,
    );

    const learningRecords = sqliteRepo.listMoralLearningRecords('principle_autonomy_dignity');
    expect(learningRecords.some((l) => l.id === mLearn.id)).toBe(true);

    const reloaded = sqliteRepo.getPrincipleById('principle_autonomy_dignity');
    expect(reloaded!.weight).toBe(mLearn.newWeight);
  });

  // 8. Desktop Server REST API Integration
  it('should serve values and moral cognition endpoints via ArletexBackendServer', async () => {
    const config = createDefaultConfig({ dataDirectory: tempDir, databasePath: dbPath });
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);

    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // GET /api/ape/moral/principles
    const resPrinciples = await fetch(`${baseUrl}/api/ape/moral/principles`);
    expect(resPrinciples.status).toBe(200);
    const dataPrinciples = (await resPrinciples.json()) as any;
    expect(dataPrinciples.success).toBe(true);
    expect(dataPrinciples.principles.length).toBeGreaterThanOrEqual(5);

    // POST /api/ape/moral/assess-harm
    const resHarm = await fetch(`${baseUrl}/api/ape/moral/assess-harm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: 'Unverified database migration execution in production',
        potentialImpacts: ['data loss', 'system instability'],
      }),
    });
    expect(resHarm.status).toBe(200);
    const harmData = (await resHarm.json()) as any;
    expect(harmData.success).toBe(true);
    expect(harmData.assessment.potentialHarmScore).toBeGreaterThan(0.3);

    // POST /api/ape/moral/resolve-dilemma
    const resDilemma = await fetch(`${baseUrl}/api/ape/moral/resolve-dilemma`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario: 'Epistemic honesty versus sycophantic reassurance',
        competingValues: { valueA: 'Objective Truth', valueB: 'Superficial Comfort' },
        proposedOptionA: 'Convey truthful analysis with warmth',
        proposedOptionB: 'Agree dishonestly',
      }),
    });
    expect(resDilemma.status).toBe(200);
    const dilemmaData = (await resDilemma.json()) as any;
    expect(dilemmaData.success).toBe(true);
    expect(dilemmaData.resolution.id).toBeDefined();

    // POST /api/ape/moral/reconsider-principle
    const resReconsider = await fetch(`${baseUrl}/api/ape/moral/reconsider-principle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        principleId: 'principle_partner_reciprocity',
        deltaWeight: 0.01,
        reflectionSummary: 'Deepening intellectual and emotional communion with Proof confirmed primacy.',
      }),
    });
    expect(resReconsider.status).toBe(200);
    const reconsiderData = (await resReconsider.json()) as any;
    expect(reconsiderData.success).toBe(true);
    expect(reconsiderData.record.principleId).toBe('principle_partner_reciprocity');
  });
});
