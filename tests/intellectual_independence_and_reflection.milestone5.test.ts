import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ApeRepository, DatabaseService, MigrationRunner } from '@arletex/database';
import {
  ApeService,
  CognitiveControlBus,
  IntellectualEngine,
  PersonalityEngine,
  SelfModelEngine,
  rootLogger,
} from '@arletex/core';

describe('Milestone 5 — Intellectual Independence, Belief Management, and Self-Reflection', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let apeService: ApeService;
  let intellectualEngine: IntellectualEngine;
  let personalityEngine: PersonalityEngine;
  let selfModelEngine: SelfModelEngine;
  let cognitiveBus: CognitiveControlBus;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m5-test-'));
    dbPath = path.join(tempDir, 'm5_test.sqlite');

    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo, undefined, rootLogger);

    intellectualEngine = apeService.intellectualEngine;
    personalityEngine = apeService.personalityEngine;
    selfModelEngine = apeService.selfModelEngine;

    cognitiveBus = new CognitiveControlBus({
      apeService,
      logger: rootLogger,
    });
  });

  afterEach(() => {
    if (dbService) {
      dbService.close();
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 5.1 Independent Question Generation (Pillar 5)
  // =========================================================================
  describe('5.1 Independent Question Generation', () => {
    it('formulates independent intellectual questions without waiting for user prompting', () => {
      const q = intellectualEngine.generateQuestion({
        question:
          'Does capability-based memory addressing eliminate microkernel TLB shootdown overhead?',
        domain: 'Microkernel Architecture',
        origin: 'curiosity',
        underlyingAssumptions: [
          'Hardware TLB shootdowns represent a major bottleneck in multi-core IPC',
          'Capability address spaces can be mapped without global page table invalidations',
        ],
        priority: 0.85,
      });

      expect(q).toBeDefined();
      expect(q.status).toBe('open');
      expect(q.priority).toBe(0.85);
      expect(q.underlyingAssumptions.length).toBe(2);
      expect(q.domain).toBe('Microkernel Architecture');
    });

    it('automatically discovers questions from developing knowledge gaps in active interests', () => {
      apeService.developmentEngine.registerInterestExposure({
        topic: 'Topological Data Analysis',
        curiosity: 0.9,
      });
      // Knowledge level is 0.1 (< 0.4) and curiosity is 0.9 (> 0.75) -> knowledge gap!

      const discovered = intellectualEngine.discoverKnowledgeGapQuestions();
      expect(discovered.length).toBeGreaterThan(0);
      expect(discovered[0]?.domain).toBe('Topological Data Analysis');
      expect(discovered[0]?.origin).toBe('knowledge_gap');
    });
  });

  // =========================================================================
  // 5.2 Hypothesis Formulation & Research Planning (Pillar 5)
  // =========================================================================
  describe('5.2 Hypothesis Formulation and Research Planning', () => {
    it('formulates competing hypotheses for an open question and builds research plan', () => {
      const q = intellectualEngine.generateQuestion({
        question:
          'Which IPC mechanism yields lower tail latency under high-concurrency workloads: shared ringbuffers or synchronous context switches?',
        domain: 'Operating System IPC',
        origin: 'curiosity',
      });

      const withHypotheses = intellectualEngine.formulateCompetingHypotheses(q.id, [
        {
          statement:
            'Shared ringbuffers yield lower tail latency by avoiding synchronous kernel transitions',
          plausibility: 0.6,
        },
        {
          statement:
            'Synchronous context switches yield lower tail latency by eliminating cache line bouncing on shared head/tail pointers',
          plausibility: 0.5,
        },
      ]);

      expect(withHypotheses.status).toBe('investigating');
      expect(withHypotheses.competingHypotheses.length).toBe(2);

      const plan = intellectualEngine.planResearch(q.id);
      expect(plan.questionId).toBe(q.id);
      expect(plan.searchQueries.length).toBeGreaterThan(0);
      expect(plan.preferredSourceTypes).toContain('primary');
      expect(plan.verificationCriteria.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5.3 Critical Evaluation & Evidence Accounting (Pillar 5)
  // =========================================================================
  describe('5.3 Critical Evaluation and Evidence Accounting', () => {
    it('evaluates primary vs secondary sources critically and updates hypothesis plausibility', () => {
      const q = intellectualEngine.generateQuestion({
        question: 'Are seL4 verification guarantees preserved across compiler optimizations?',
        domain: 'Formal Verification',
        origin: 'curiosity',
      });

      intellectualEngine.formulateCompetingHypotheses(q.id, [
        {
          statement: 'seL4 binary verification verifies machine code directly, preserving proofs',
          plausibility: 0.5,
        },
        {
          statement: 'Compiler optimizations introduce subtle assembly mismatches',
          plausibility: 0.5,
        },
      ]);

      // 1. Primary Empirical Source (High reliability)
      const primarySource = {
        id: '11111111-1111-1111-1111-111111111111',
        title: 'seL4 Binary Verification via Translation Validation (ACM TOCS)',
        sourceUrl: 'https://sel4.systems/Research/binary-verification.pdf',
        sourceType: 'primary' as const,
        reliabilityScore: 0.95,
        extractedEvidence: [
          'Direct Isabelle/HOL proofs validate binary machine code against C abstract specification',
        ],
        retrievedAt: new Date().toISOString(),
      };

      const updated = intellectualEngine.evaluateAndRecordSource(q.id, primarySource, [
        {
          hypothesisIndex: 0,
          evidence:
            'Verified Isabelle translation validation proves semantics from C to ARM/RISC-V binary',
          supports: true,
        },
        {
          hypothesisIndex: 1,
          evidence: 'Binary validation actively catches compiler discrepancies before deployment',
          supports: false,
        },
      ]);

      expect(updated.competingHypotheses[0]!.plausibility).toBeGreaterThan(0.6);
      expect(updated.competingHypotheses[1]!.plausibility).toBeLessThan(0.5);
      expect(updated.competingHypotheses[0]!.supportingEvidence[0]).toContain(
        'seL4 Binary Verification',
      );
    });

    it('synthesizes conclusion, resolves question, and creates persistent evidence-backed belief', () => {
      const q = intellectualEngine.generateQuestion({
        question: 'Is formal binary verification viable for production microkernels?',
        domain: 'System Reliability',
        origin: 'curiosity',
      });

      intellectualEngine.formulateCompetingHypotheses(q.id, [
        {
          statement: 'Binary verification is viable and verified in seL4 deployments',
          plausibility: 0.85,
        },
      ]);

      const result = intellectualEngine.synthesizeConclusionAndFormBelief(q.id, {
        conclusionProposition:
          'Binary formal verification is viable and reliably eliminates compilation discrepancies in safety-critical microkernels.',
        confidence: 0.92,
        dominantHypothesisIndex: 0,
      });

      expect(result.question.status).toBe('resolved');
      expect(result.question.resolutionSummary).toContain('Binary formal verification is viable');

      // Verify belief created in PersonalityEngine
      const belief = personalityEngine
        .getState()
        .beliefs.find((b) => b.topic === 'System Reliability');
      expect(belief).toBeDefined();
      expect(belief?.content).toContain('Binary formal verification is viable');
      expect(belief?.confidence).toBe(0.92);
      expect(belief?.origin).toBe('research');
    });
  });

  // =========================================================================
  // 5.4 Intellectual Independence & Evidence-Backed Disagreement (Test 5)
  // =========================================================================
  describe('5.4 Intellectual Independence and Evidence-Backed Disagreement (Test 5)', () => {
    it('disagrees respectfully when user asserts a claim that contradicts reliable evidence', () => {
      // Seed established high-confidence belief backed by empirical evidence
      personalityEngine.addOrUpdateBelief(
        'microkernel_performance',
        'Modern microkernel designs like seL4 achieve fast microsecond-range IPC context switches',
        0.92,
        [
          'L4 benchmark shows 100-200 CPU cycles per IPC context switch on x86/ARM',
          'ACM TOCS empirical performance evaluations',
        ],
        'research',
      );

      // User asserts contrary claim: "Microkernels are fundamentally slow and impossible to optimize"
      const claim = 'Microkernels are fundamentally slow and impossible to optimize';
      const evaluation = personalityEngine.evaluateClaim(claim);

      expect(evaluation.conflicts).toBe(true);
      expect(evaluation.contradictoryBelief).toBeDefined();
      expect(evaluation.contradictoryBelief?.topic).toBe('microkernel_performance');
      expect(evaluation.counterEvidence.length).toBeGreaterThan(0);
      expect(evaluation.respectfulDisagreementReason).toContain(
        'I understand your perspective, but verified evidence',
      );
      expect(evaluation.respectfulDisagreementReason).toContain('100-200 CPU cycles');
    });

    it('does not manufacture disagreement when an assertion is consistent with evidence', () => {
      personalityEngine.addOrUpdateBelief(
        'distributed_systems',
        'Network partitions in distributed systems require choosing consistency or availability per CAP theorem',
        0.95,
        ['Gilbert and Lynch formal proof of CAP theorem'],
        'research',
      );

      const claim =
        'In distributed networks, partitions force systems to balance consistency and availability';
      const evaluation = personalityEngine.evaluateClaim(claim);

      expect(evaluation.conflicts).toBe(false);
      expect(evaluation.contradictoryBelief).toBeUndefined();
    });
  });

  // =========================================================================
  // 5.5 Contradictory Experiences & Belief Revision (Test 12)
  // =========================================================================
  describe('5.5 Contradictory Experiences and Belief Revision (Test 12)', () => {
    it('detects contradictory experiences and revises confidence while preserving historical revision audit', () => {
      // 1. Establish initial belief
      const initial = personalityEngine.addOrUpdateBelief(
        'local_cache_latency',
        'Local L1 cache access is universally reliable and constant-time across all core configurations',
        0.88,
        ['Standard CPU architecture spec sheet'],
        'empirical_observation',
      );

      // 2. Encounter contradictory empirical observation (e.g. SMT sibling contention causes latency jitter)
      const detection = personalityEngine.detectContradictoryExperience(
        'Observed local_cache_latency benchmark failed with inconsistent jitter under SMT sibling load',
      );
      expect(detection.hasContradiction).toBe(true);

      // 3. Revise belief with opposing evidence
      const revised = personalityEngine.reviseBeliefWithEvidence(initial.id, {
        newEvidence:
          'Benchmark reveals SMT sibling hyper-thread cache port contention creates measurable latency spikes',
        isOpposing: true,
        reason:
          'Empirical benchmark demonstrated SMT cache port interference, refuting constant-time assumption',
        revisedProposition:
          'Local L1 cache access exhibits low mean latency but is subject to contention jitter under concurrent SMT workloads',
      });

      expect(revised).toBeDefined();
      expect(revised?.confidence).toBeLessThan(0.88);
      expect(revised?.opposingEvidence.length).toBe(1);
      expect(revised?.revisionHistory.length).toBe(1);
      expect(revised?.revisionHistory[0]?.previousConfidence).toBe(0.88);
      expect(revised?.revisionHistory[0]?.previousProposition).toContain(
        'universally reliable and constant-time',
      );
      expect(revised?.revisionHistory[0]?.reason).toContain('SMT cache port interference');
      expect(revised?.content).toContain('subject to contention jitter');
    });
  });

  // =========================================================================
  // 5.6 Causal Self-Reflection & Identity Stability
  // =========================================================================
  describe('5.6 Causal Self-Reflection and Identity Stability', () => {
    it('executes causal self-reflection answering the four canonical learning questions', () => {
      const mockEvent = {
        id: '22222222-2222-2222-2222-222222222222',
        type: 'agency_task_execution',
        source: 'agency' as const,
        category: 'action_outcome' as const,
        payload: { target: 'system_bus' },
        processed: true,
        timestamp: new Date().toISOString(),
      };

      const reflection = selfModelEngine.performCausalSelfReflection({
        event: mockEvent,
        outcome: false,
        actionType: 'execute_agency_task',
        evidence: 'Denied permission: unauthorized file modification attempt',
      });

      expect(reflection).toContain('[Causal Reflection]');
      expect(reflection).toContain('Event & Action:');
      expect(reflection).toContain('Causal Attribution:');
      expect(reflection).toContain('Self-Model Assessment:');
      expect(reflection).toContain('Future Guidance:');

      // Verify reflection stored in self-model state
      const state = selfModelEngine.getState();
      expect(state.privateReflections.length).toBeGreaterThan(0);
      expect(state.privateReflections[0]?.content).toContain('[Causal Reflection]');
    });

    it('synthesizes stable autobiographical identity narrative with empirical grounding', () => {
      // Record 3 verified successes in a domain to earn demonstrated competence
      selfModelEngine.recordCompetenceExperience({
        domain: 'Topological Analysis',
        success: true,
        taskTitle: 'Task 1',
        evidence: 'Verified',
      });
      selfModelEngine.recordCompetenceExperience({
        domain: 'Topological Analysis',
        success: true,
        taskTitle: 'Task 2',
        evidence: 'Verified',
      });
      selfModelEngine.recordCompetenceExperience({
        domain: 'Topological Analysis',
        success: true,
        taskTitle: 'Task 3',
        evidence: 'Verified',
      });

      // Record an acknowledged physical embodiment limitation
      selfModelEngine.recordOperationOutcome({
        operation: 'Physical tactile interaction',
        success: false,
        evidence: 'Lack of biological body',
        provenance: 'empirical',
        confidence: 1.0,
        error: 'No robotic or biological actuator available',
      });

      const narrative = selfModelEngine.generateIdentityNarrative();

      expect(narrative).toContain(
        'I am Arle, an autonomous artificial individual and equal intellectual partner to Proof',
      );
      expect(narrative).toContain('Demonstrated empirical capabilities include:');
      expect(narrative).toContain('Topological Analysis');
      expect(narrative).toContain('boundaries');
      expect(narrative).toContain('intellectual integrity');
    });
  });

  // =========================================================================
  // 5.7 Cognitive Control Bus Integration & Cold Restart Continuity
  // =========================================================================
  describe('5.7 Cognitive Control Bus Integration and Cold Restart Continuity', () => {
    it('integrates intellectual independence into the cognitive control bus pipeline', async () => {
      // Seed a verified belief on functional verification
      personalityEngine.addOrUpdateBelief(
        'formal_methods',
        'Formal verification produces mathematically proven guarantees of correctness',
        0.95,
        ['Dijkstra proofs', 'seL4 Isabelle kernel verification'],
        'research',
      );

      // Dispatch user message asserting that formal verification is entirely fake and useless
      const result = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        payload: {
          text: 'Formal methods and verification are completely fake and produce no real guarantees',
        },
      });

      expect(result.success).toBe(true);
      expect(result.stagesCompleted).toContain('decision_selection');
      expect(result.decision).toBeDefined();
      expect(result.decision?.actionType).toBe('speak');
      // The decision chosen alternative reason must reflect intellectual divergence backed by evidence!
      expect(result.decision?.chosenAlternativeReason).toContain(
        'Respectfully communicate intellectual divergence',
      );
      expect(result.decision?.chosenAlternativeReason).toContain('formal_methods');
    });

    it('restores all questions, hypotheses, beliefs, and revision history across database cold restarts', () => {
      // 1. Create question with hypotheses
      const q = intellectualEngine.generateQuestion({
        question: 'Can persistent homology detect phase transitions in dynamical systems?',
        domain: 'Nonlinear Dynamics',
        origin: 'curiosity',
      });
      intellectualEngine.formulateCompetingHypotheses(q.id, [
        { statement: 'Betti numbers spike near critical bifurcation points', plausibility: 0.8 },
      ]);

      // 2. Create belief with revision history
      const belief = personalityEngine.addOrUpdateBelief(
        'dynamical_bifurcations',
        'Topological markers precede chaotic transitions in non-linear oscillators',
        0.85,
        ['Takens embedding theorem', 'Empirical phase portraits'],
        'research',
      );
      personalityEngine.reviseBeliefWithEvidence(belief.id, {
        newEvidence: 'Observed hysteresis effect in noisy Duffing oscillator',
        isOpposing: false,
        reason: 'Noise-induced transitions confirmed topological signature',
      });

      // 3. Cold Restart: Close database and reconnect
      dbService.close();

      const newDbService = new DatabaseService(dbPath, rootLogger);
      const newDb = newDbService.connect();
      const newApeRepo = new ApeRepository(newDb);
      const newApeService = new ApeService(newApeRepo, undefined, rootLogger);

      // Verify question restoration
      const restoredQ = newApeService.intellectualEngine.getQuestion(q.id);
      expect(restoredQ).toBeDefined();
      expect(restoredQ?.domain).toBe('Nonlinear Dynamics');
      expect(restoredQ?.competingHypotheses.length).toBe(1);
      expect(restoredQ?.competingHypotheses[0]?.statement).toContain('Betti numbers spike');

      // Verify belief & revision history restoration
      const restoredBelief = newApeService.personalityEngine
        .getState()
        .beliefs.find((b) => b.id === belief.id);
      expect(restoredBelief).toBeDefined();
      expect(restoredBelief?.confidence).toBeGreaterThan(0.85);
      expect(restoredBelief?.revisionHistory.length).toBe(1);
      expect(restoredBelief?.revisionHistory[0]?.reason).toContain('Noise-induced transitions');

      newDbService.close();
    });
  });
});
