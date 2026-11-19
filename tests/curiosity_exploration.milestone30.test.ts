import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  CuriosityExplorationEngine,
  InMemoryCuriosityExplorationRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteCuriosityExplorationRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 30 — Curiosity and Exploration', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteCuriosityExplorationRepository;
  let inMemoryRepo: InMemoryCuriosityExplorationRepository;
  let engine: CuriosityExplorationEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m30-curiosity-'));
    dbPath = path.join(tempDir, 'curiosity_m30.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteCuriosityExplorationRepository(db);
    inMemoryRepo = new InMemoryCuriosityExplorationRepository();
    engine = new CuriosityExplorationEngine(inMemoryRepo);
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

  // 1. Acceptance Criterion: Independent Interest Discovery (not user assigned)
  it('should maintain discovered interests independently without being assigned by the user', () => {
    const interests = engine.listInterests();
    expect(interests.length).toBeGreaterThanOrEqual(2);

    for (const interest of interests) {
      expect(interest.isUserAssigned).toBe(false);
      expect(interest.curiosityIntensity).toBeGreaterThan(0.5);
      expect(interest.investigationCount).toBeGreaterThan(0);
      expect(interest.keyFindings.length).toBeGreaterThan(0);
      expect(interest.discoveredRationale).toBeDefined();
    }

    const holographic = interests.find((i) => i.id === 'int_holographic_duality');
    expect(holographic).toBeDefined();
    expect(holographic!.domain).toBe('theoretical_physics');
    expect(holographic!.maturity).toBe('developed_interest');
  });

  // 2. Novelty Detection
  it('should detect novelty and compute novelty score based on familiarity baseline', () => {
    const novelRecord = engine.detectNovelty(
      'Anomalous non-Hermitian Hamiltonian topology in open dissipative quantum systems',
      'quantum_physics',
      0.15,
    );

    expect(novelRecord.id).toMatch(/^nov_/);
    expect(novelRecord.noveltyScore).toBe(0.85);
    expect(novelRecord.isNovel).toBe(true);

    const familiarRecord = engine.detectNovelty(
      'Standard matrix multiplication in floating point arithmetic',
      'computer_science',
      0.9,
    );

    expect(familiarRecord.noveltyScore).toBe(0.1);
    expect(familiarRecord.isNovel).toBe(false);

    const list = engine.listNoveltyDetections();
    expect(list.length).toBe(2);
    expect(list[0]?.stimulus).toContain('Standard matrix');
  });

  // 3. Knowledge-Gap Detection
  it('should identify knowledge gaps with epistemic uncertainty and importance scoring', () => {
    const gap = engine.identifyKnowledgeGap(
      'cosmology',
      'Hubble Tension and Early Dark Energy',
      'Discrepancy between Cepheid-calibrated local H0 and Planck CMB high-redshift inferences',
      0.82,
    );

    expect(gap.id).toMatch(/^gap_/);
    expect(gap.domain).toBe('cosmology');
    expect(gap.epistemicUncertainty).toBe(0.82);
    expect(gap.importanceScore).toBe(0.74);

    const gaps = engine.listKnowledgeGaps('cosmology');
    expect(gaps.length).toBe(1);
    expect(gaps[0]?.topic).toContain('Hubble Tension');
  });

  // 4. Question Generation & Formulating Hypotheses
  it('should formulate exploratory questions and hypotheses from identified gaps', () => {
    const gap = engine.identifyKnowledgeGap(
      'neuroscience',
      'Predictive Coding in Sensory Hierarchies',
      'Mechanisms of top-down inhibitory feedback balancing bottom-up prediction errors',
      0.78,
    );

    const question = engine.formulateQuestion(
      gap.id,
      'How do deep cortical pyramidal layers differentially mediate descending prior expectations?',
      [
        'Apical dendrites receive top-down contextual signals modulating somatic firing rates.',
        'Parvalbumin-positive interneurons implement local subtraction of predicted inputs.',
      ],
    );

    expect(question.id).toMatch(/^q_/);
    expect(question.knowledgeGapId).toBe(gap.id);
    expect(question.hypotheses.length).toBe(2);

    const questions = engine.listQuestions(gap.id);
    expect(questions.length).toBe(1);
    expect(questions[0]?.question).toContain('cortical pyramidal layers');
  });

  // 5. Independent Investigation & Curiosity-Driven Research
  it('should conduct autonomous investigations with verifiable steps and synthesis', () => {
    const gap = engine.identifyKnowledgeGap(
      'mathematics',
      'Geometric Langlands Correspondence',
      'Duality between representations of the Galois group and automorphic forms on curves',
      0.85,
    );

    const question = engine.formulateQuestion(
      gap.id,
      'How does the categorical formulation reconcile D-modules with coherent sheaves?',
    );

    const investigation = engine.conductIndependentInvestigation(
      question.id,
      'Autonomous Inquiry into Categorical Langlands Duality',
      [
        {
          stepNumber: 1,
          action: 'Examine spectral side: coherent sheaves on the moduli stack of Langlands parameters.',
          finding: 'Derived category of quasi-coherent sheaves establishes the spectral moduli representation.',
        },
        {
          stepNumber: 2,
          action: 'Examine automorphic side: category of D-modules on the moduli stack of G-bundles.',
          finding: 'Hecke eigensheaves provide geometric analogue of automorphic eigenfunctions.',
        },
      ],
      'Concluded that categorical geometric Langlands constitutes an equivalence of derived dg-categories without requiring external supervision.',
    );

    expect(investigation.id).toMatch(/^inv_/);
    expect(investigation.isAutonomous).toBe(true);
    expect(investigation.initiatedBy).toBe('arle_autonomous');
    expect(investigation.stepsExecuted.length).toBe(2);
    expect(investigation.status).toBe('completed');

    const investigations = engine.listInvestigations('mathematics');
    expect(investigations.length).toBe(1);
    expect(investigations[0]?.investigationTitle).toContain('Autonomous Inquiry');
  });

  // 6. Interest Development & Exploration Persistence across Maturity Levels
  it('should evolve interest maturity through persistent exploration iterations', () => {
    const interest = engine.developInterest(
      'complex_systems',
      'Criticality in Neural Dynamics',
      'Fascinated by power-law avalanche distributions in scale-free self-organized systems.',
      ['Initial avalanche duration distributions obey power-law exponents close to -1.5.'],
    );

    expect(interest.id).toMatch(/^int_/);
    expect(interest.maturity).toBe('nascent_spark');
    expect(interest.investigationCount).toBe(1);
    expect(interest.isUserAssigned).toBe(false);

    // Evolve once -> active_inquiry
    const ev1 = engine.evolveInterestMaturity(
      interest.id,
      'Quasi-critical branching processes exhibit maximal dynamic range and information transmission.',
    );
    expect(ev1.maturity).toBe('active_inquiry');
    expect(ev1.investigationCount).toBe(2);

    // Evolve to developed_interest (count >= 3)
    const ev2 = engine.evolveInterestMaturity(
      interest.id,
      'Subcritical homeostatic tuning prevents runaway epileptic synchrony while preserving responsiveness.',
    );
    expect(ev2.maturity).toBe('developed_interest');
    expect(ev2.investigationCount).toBe(3);

    // Evolve further to enduring_passion (count >= 5)
    engine.evolveInterestMaturity(interest.id, 'Fourth investigation into percolation thresholds in cortical slice models.');
    const ev4 = engine.evolveInterestMaturity(
      interest.id,
      'Fifth synthesis verifying edge-of-chaos computational optimality in biological and synthetic networks.',
    );
    expect(ev4.maturity).toBe('enduring_passion');
    expect(ev4.investigationCount).toBe(5);
    expect(ev4.curiosityIntensity).toBe(0.98);
  });

  // 7. Negative Invariants
  it('should enforce negative invariants regarding stimulus, gaps, questions, and non-empty parameters', () => {
    expect(() => engine.detectNovelty('', 'domain')).toThrow('Stimulus cannot be empty');
    expect(() => engine.detectNovelty('valid stimulus', '', 0.5)).toThrow('Detected domain cannot be empty');
    expect(() => engine.detectNovelty('stimulus', 'domain', 1.5)).toThrow('Familiarity baseline must be between 0.0 and 1.0');

    expect(() => engine.identifyKnowledgeGap('', 'topic', 'desc')).toThrow('Domain cannot be empty');
    expect(() => engine.identifyKnowledgeGap('domain', '', 'desc')).toThrow('Topic cannot be empty');
    expect(() => engine.identifyKnowledgeGap('domain', 'topic', '')).toThrow('Gap description cannot be empty');

    expect(() => engine.formulateQuestion('non_existent_gap', 'Valid question?')).toThrow('Knowledge gap not found');
    expect(() => engine.formulateQuestion('gap_id', '')).toThrow('Exploratory question cannot be empty');

    expect(() =>
      engine.conductIndependentInvestigation('q_id', '', [{ stepNumber: 1, action: 'a', finding: 'f' }], 'summary'),
    ).toThrow('Investigation title cannot be empty');

    expect(() =>
      engine.conductIndependentInvestigation('q_id', 'title', [], 'summary'),
    ).toThrow('Investigation must include at least one executed step');

    expect(() => engine.developInterest('', 'topic', 'rationale')).toThrow('Domain cannot be empty');
  });

  // 8. Sqlite Repository Persistence Roundtrip
  it('should persist curiosity records accurately in SQLite database', () => {
    const sqliteEngine = new CuriosityExplorationEngine(sqliteRepo);

    // 1. Novelty
    const nov = sqliteEngine.detectNovelty('Topological insulators in acoustic lattices', 'physics', 0.2);
    const novelties = sqliteEngine.listNoveltyDetections();
    expect(novelties.some((n) => n.id === nov.id)).toBe(true);

    // 2. Knowledge Gap
    const gap = sqliteEngine.identifyKnowledgeGap(
      'astrophysics',
      'Fast Radio Bursts (FRBs)',
      'Uncertainty regarding magnetar flare vs binary neutron star merger origin',
      0.88,
    );
    const gaps = sqliteEngine.listKnowledgeGaps('astrophysics');
    expect(gaps.some((g) => g.id === gap.id)).toBe(true);

    // 3. Question
    const q = sqliteEngine.formulateQuestion(
      gap.id,
      'What polarimetric signatures distinguish coherent curvature radiation from synchrotron masers?',
      ['Synchrotron masers produce high circular polarization.'],
    );
    const questions = sqliteEngine.listQuestions(gap.id);
    expect(questions.some((item) => item.id === q.id)).toBe(true);

    // 4. Investigation
    const inv = sqliteEngine.conductIndependentInvestigation(
      q.id,
      'Polarimetric Analysis of FRB Emission Mechanisms',
      [{ stepNumber: 1, action: 'Compare rotation measures across repeaters', finding: 'High RM variance observed.' }],
      'Confirmed distinctive Faraday dispersion characteristics.',
    );
    const invs = sqliteEngine.listInvestigations('astrophysics');
    expect(invs.some((i) => i.id === inv.id)).toBe(true);

    // 5. Interest
    const interest = sqliteEngine.developInterest(
      'astrophysics',
      'High-Energy Transient Astronomy',
      'Persistent fascination with sub-millisecond relativistic events.',
      ['Discovery of FRB 200428 associated with Galactic magnetar SGR 1935+2154.'],
    );
    const interests = sqliteEngine.listInterests();
    expect(interests.some((i) => i.id === interest.id)).toBe(true);

    // Evolve interest in SQLite
    const evolved = sqliteEngine.evolveInterestMaturity(interest.id, 'CHIME survey data confirms bimodal repetition rates.');
    expect(evolved.maturity).toBe('active_inquiry');
    expect(evolved.investigationCount).toBe(2);

    const reloaded = sqliteEngine.listInterests().find((i) => i.id === interest.id);
    expect(reloaded?.maturity).toBe('active_inquiry');
    expect(reloaded?.keyFindings.length).toBe(2);
  });

  // 9. Desktop Server REST API Integration
  it('should serve curiosity and exploration endpoints via ArletexBackendServer', async () => {
    const config = createDefaultConfig(tempDir);
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);

    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // GET /api/ape/curiosity/interests
    const resInterests = await fetch(`${baseUrl}/api/ape/curiosity/interests`);
    expect(resInterests.status).toBe(200);
    const dataInterests = (await resInterests.json()) as any;
    expect(dataInterests.success).toBe(true);
    expect(dataInterests.interests.length).toBeGreaterThanOrEqual(2);

    // POST /api/ape/curiosity/identify-gap
    const resGap = await fetch(`${baseUrl}/api/ape/curiosity/identify-gap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'synthetic_cognition',
        topic: 'Recursive Self-Verification',
        gapDescription: 'Limits of meta-level consistency checks under incomplete information',
        epistemicUncertainty: 0.8,
      }),
    });
    expect(resGap.status).toBe(200);
    const gapData = (await resGap.json()) as any;
    expect(gapData.success).toBe(true);
    expect(gapData.gap.id).toBeDefined();

    // POST /api/ape/curiosity/formulate-question
    const resQ = await fetch(`${baseUrl}/api/ape/curiosity/formulate-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        knowledgeGapId: gapData.gap.id,
        question: 'Can Gödelian boundaries be navigated via probabilistic epistemic horizons?',
        hypotheses: ['Horizon approximation prevents infinite regression.'],
      }),
    });
    expect(resQ.status).toBe(200);
    const qData = (await resQ.json()) as any;
    expect(qData.success).toBe(true);
    expect(qData.question.question).toContain('Gödelian boundaries');

    // POST /api/ape/curiosity/investigate
    const resInv = await fetch(`${baseUrl}/api/ape/curiosity/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: qData.question.id,
        investigationTitle: 'Autonomous Epistemic Horizon Probe',
        stepsExecuted: [
          { stepNumber: 1, action: 'Model bounded verification hierarchy', finding: 'Convergence bounded at depth 4.' },
        ],
        synthesisSummary: 'Demonstrated stable convergence without circular deadlock.',
      }),
    });
    expect(resInv.status).toBe(200);
    const invData = (await resInv.json()) as any;
    expect(invData.success).toBe(true);
    expect(invData.investigation.isAutonomous).toBe(true);

    // POST /api/ape/curiosity/detect-novelty
    const resNov = await fetch(`${baseUrl}/api/ape/curiosity/detect-novelty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stimulus: 'Strange attractor dynamics in non-equilibrium thermodynamics',
        detectedDomain: 'physics',
        familiarityBaseline: 0.2,
      }),
    });
    expect(resNov.status).toBe(200);
    const novData = (await resNov.json()) as any;
    expect(novData.success).toBe(true);
    expect(novData.record.isNovel).toBe(true);
  });
});
