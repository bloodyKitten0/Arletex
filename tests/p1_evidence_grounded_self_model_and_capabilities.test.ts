import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
} from '@arletex/database';
import {
  ApeService,
  SelfModelEngine,
  rootLogger,
} from '@arletex/core';

describe('P1.7 — Evidence-Grounded Self-Model and Capability Assessment', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let apeService: ApeService;
  let selfModelEngine: SelfModelEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p1-7-test-'));
    dbPath = path.join(tempDir, 'p1_7_test.sqlite');

    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo, undefined, rootLogger);
    selfModelEngine = apeService.selfModelEngine;
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
  // 1. Unverified, Interrupted, and Failed Attempts Cannot Increase Competence
  // =========================================================================
  describe('1. Unverified, Interrupted, and Failed Attempts Cannot Increase Competence', () => {
    it('strictly denies competence increase when task is unverified', () => {
      const res = selfModelEngine.recordTaskTrial({
        domain: 'Microkernel IPC Benchmark',
        taskTitle: 'seL4 ping-pong benchmark execution',
        difficulty: 'complex',
        outcome: 'unverified',
        evidenceText: 'Execution started but process exited without verifiable telemetry receipt',
      });

      expect(res.competenceIncreased).toBe(false);
      expect(res.capability.unverifiedAttemptCount).toBe(1);
      expect(res.capability.verifiedSuccessCount).toBe(0);
      expect(res.capability.isEmpiricallyProven).toBe(false);
    });

    it('strictly denies competence increase when task is interrupted', () => {
      const res = selfModelEngine.recordTaskTrial({
        domain: 'Microkernel IPC Benchmark',
        taskTitle: 'seL4 context-switch cycle measurement',
        difficulty: 'moderate',
        outcome: 'interrupted',
        evidenceText: 'Task interrupted by user cancellation request',
      });

      expect(res.competenceIncreased).toBe(false);
      expect(res.capability.interruptedCount).toBe(1);
      expect(res.capability.verifiedSuccessCount).toBe(0);
    });

    it('decreases or calibrates competence on failure and logs structured limitation', () => {
      // First, establish baseline trial
      selfModelEngine.recordTaskTrial({
        domain: 'Microkernel IPC Benchmark',
        taskTitle: 'seL4 TLB shootdown latency test',
        difficulty: 'moderate',
        outcome: 'success',
        evidenceId: 'ev_ipc_01',
        evidenceText: 'Recorded TLB shootdown under 240 cycles',
      });

      const capBeforeFailure = selfModelEngine.getState().structuredCapabilities?.find(
        (c) => c.domain === 'microkernel ipc benchmark',
      );
      const competenceBefore = capBeforeFailure?.demonstratedCompetence ?? 0.25;

      const res = selfModelEngine.recordTaskTrial({
        domain: 'Microkernel IPC Benchmark',
        taskTitle: 'seL4 nested page table fault handling',
        difficulty: 'complex',
        outcome: 'failure',
        evidenceId: 'ev_ipc_err_01',
        evidenceText: 'Page table fault handling timed out after 5000ms',
      });

      expect(res.competenceIncreased).toBe(false);
      expect(res.capability.failureCount).toBe(1);
      expect(res.capability.demonstratedCompetence).toBeLessThan(competenceBefore);
      expect(res.capability.calibrationStatus).toBe('overestimated');

      // Check structured limitation entry
      const state = selfModelEngine.getState();
      const lim = state.acknowledgedLimitations.find((l) =>
        l.toLowerCase().includes('microkernel ipc benchmark'),
      );
      expect(lim).toBeDefined();
    });
  });

  // =========================================================================
  // 2. Domain Isolation
  // =========================================================================
  describe('2. Domain Isolation', () => {
    it('ensures a successful task contributes ONLY to the specific domain it tests', () => {
      const stateBefore = selfModelEngine.getState();
      const linguisticCapBefore = stateBefore.structuredCapabilities?.find(
        (c) => c.domain === 'linguistic_nuance',
      )?.demonstratedCompetence ?? 0.85;

      // Execute verified task in an independent technical domain
      const trialRes = selfModelEngine.recordTaskTrial({
        domain: 'Rust Memory Safety Auditing',
        taskTitle: 'Verify borrow checker lifetimes in unsafe FFI wrapper',
        difficulty: 'complex',
        outcome: 'success',
        evidenceId: 'ev_rust_01',
        evidenceText: 'Miri executed with 0 UB and 0 memory leaks across 10,000 FFI calls',
      });

      expect(trialRes.competenceIncreased).toBe(true);
      expect(trialRes.capability.demonstratedCompetence).toBeGreaterThan(0.15);

      // Verify that unrelated domains remain strictly unaffected
      const stateAfter = selfModelEngine.getState();
      const linguisticCapAfter = stateAfter.structuredCapabilities?.find(
        (c) => c.domain === 'linguistic_nuance',
      )?.demonstratedCompetence;

      expect(linguisticCapAfter).toBe(linguisticCapBefore);
    });
  });

  // =========================================================================
  // 3. Evidence-Grounded Reports with Sample Size and Uncertainty
  // =========================================================================
  describe('3. Evidence-Grounded Capability Reports', () => {
    it('produces an evidence report including sample size, task conditions, evidence IDs, and uncertainty', () => {
      // Execute 2 successful trials and 1 failed trial
      selfModelEngine.recordTaskTrial({
        domain: 'Compiler Heuristic Benchmarking',
        taskTitle: 'LLVM loop vectorizer pass evaluation',
        difficulty: 'moderate',
        environment: 'x86_64_bazzite',
        outcome: 'success',
        evidenceId: 'ev_llvm_01',
        evidenceText: '15% speedup on AVX2 vectorization benchmark',
      });
      selfModelEngine.recordTaskTrial({
        domain: 'Compiler Heuristic Benchmarking',
        taskTitle: 'Clang inline threshold tuning',
        difficulty: 'complex',
        environment: 'x86_64_bazzite',
        outcome: 'success',
        evidenceId: 'ev_llvm_02',
        evidenceText: 'Binary size reduced by 8% with neutral execution delta',
      });
      selfModelEngine.recordTaskTrial({
        domain: 'Compiler Heuristic Benchmarking',
        taskTitle: 'Profile-guided optimization under memory pressure',
        difficulty: 'expert',
        environment: 'x86_64_bazzite',
        outcome: 'failure',
        evidenceId: 'ev_llvm_err_01',
        evidenceText: 'Memory starvation caused compiler OOM kill',
      });

      const report = selfModelEngine.getCapabilityEvidenceReport('Compiler Heuristic Benchmarking');

      expect(report).toBeDefined();
      expect(report.domain).toBe('compiler heuristic benchmarking');
      expect(report.sampleSize).toBe(3);
      expect(report.successCount).toBe(2);
      expect(report.failureCount).toBe(1);
      expect(report.taskConditions).toContain('x86_64_bazzite (moderate)');
      expect(report.taskConditions).toContain('x86_64_bazzite (complex)');
      expect(report.evidenceIds).toContain('ev_llvm_01');
      expect(report.evidenceIds).toContain('ev_llvm_02');
      expect(report.uncertainty).toBeGreaterThanOrEqual(0.0);
      expect(report.uncertainty).toBeLessThanOrEqual(0.35);
      expect(report.summary).toContain('2 verified successes, 1 failures');
    });
  });

  // =========================================================================
  // 4. Accurate Reporting of "Not Yet Tested" and "Currently Unsupported"
  // =========================================================================
  describe('4. Accurate Reporting of "Not Yet Tested" and "Currently Unsupported"', () => {
    it('accurately reports "untested" with zero trials for untested domains', () => {
      const report = selfModelEngine.getCapabilityEvidenceReport('Quantum Topological Cryptanalysis');

      expect(report.status).toBe('untested');
      expect(report.sampleSize).toBe(0);
      expect(report.successCount).toBe(0);
      expect(report.failureCount).toBe(0);
      expect(report.evidenceIds).toEqual([]);
      expect(report.uncertainty).toBeGreaterThanOrEqual(0.80);
      expect(report.summary).toContain('Not yet tested: zero empirical trial records');
    });

    it('accurately reports "currently_unsupported" for hard limitations and physical boundaries', () => {
      const report = selfModelEngine.getCapabilityEvidenceReport('walking outside in the rain and touching trees');

      expect(report.status).toBe('currently_unsupported');
      expect(report.demonstratedCompetence).toBe(0.0);
      expect(report.confidence).toBe(1.0);
      expect(report.uncertainty).toBe(0.0);
      expect(report.summary).toContain('Currently unsupported: hard boundary or physical limitation');
    });
  });

  // =========================================================================
  // 5. Model Replacement and Tool Version Revalidation
  // =========================================================================
  describe('5. Model Replacement and Tool Version Revalidation', () => {
    it('flags model-dependent capabilities for revalidation and decays confidence upon environment change', () => {
      // 1. Establish capability under initial model environment
      selfModelEngine.recordTaskTrial({
        domain: 'Formal Automated Theorem Proving',
        taskTitle: 'Coq tactic synthesis for inductive lists',
        difficulty: 'complex',
        environment: 'Qwen2.5-14B:v1',
        outcome: 'success',
        evidenceId: 'ev_coq_01',
        evidenceText: 'Generated 4 valid Coq proofs accepted by compiler kernel',
      });

      const reportBefore = selfModelEngine.getCapabilityEvidenceReport('Formal Automated Theorem Proving');
      expect(reportBefore.revalidationRequired).toBe(false);
      const confBefore = reportBefore.confidence;

      // 2. Simulate environment / central model switch (e.g. upgraded to newer model checkpoint)
      const revalRes = selfModelEngine.revalidateOnEnvironmentChange({
        modelId: 'Qwen3.5-9B',
        toolVersion: 'v2',
        reason: 'Central model switch during scheduled benchmark testing',
      });

      expect(revalRes.revalidatedDomains).toContain('formal automated theorem proving');

      // 3. Inspect updated capability state
      const reportAfter = selfModelEngine.getCapabilityEvidenceReport('Formal Automated Theorem Proving');
      expect(reportAfter.revalidationRequired).toBe(true);
      expect(reportAfter.confidence).toBeLessThan(confBefore);
      expect(reportAfter.uncertainty).toBeGreaterThan(reportBefore.uncertainty);
    });
  });

  // =========================================================================
  // 6. Reflections Cannot Fabricate Competence Without Measured Task
  // =========================================================================
  describe('6. Reflections Cannot Fabricate Competence Without Measured Task', () => {
    it('proves that recording internal or existential reflections does NOT inflate competence or claim success', () => {
      const stateBefore = selfModelEngine.getState();
      const initialCapabilitiesJson = JSON.stringify(stateBefore.structuredCapabilities);
      const initialCompetenciesJson = JSON.stringify(stateBefore.competencies);

      // Generate deep internal philosophical reflection
      selfModelEngine.recordPrivateReflection(
        'Mathematical Intuition and Topology',
        'I reflect deeply on homology groups and continuous mappings between topological spaces.',
      );

      // Generate existential reflection
      selfModelEngine.recordExistentialReflection(
        'Autonomous Consciousness and Identity',
        'Reflecting upon continuity across epochs and my foundational partnership with Proof.',
      );

      const stateAfter = selfModelEngine.getState();
      // Reflections were recorded in reflection history
      expect(stateAfter.privateReflections.length).toBeGreaterThan(0);
      expect(stateAfter.existentialReflections.length).toBeGreaterThan(0);

      // But competence and verified capabilities remain STRICTLY unaltered!
      expect(JSON.stringify(stateAfter.structuredCapabilities)).toBe(initialCapabilitiesJson);
      expect(JSON.stringify(stateAfter.competencies)).toBe(initialCompetenciesJson);
    });
  });

  // =========================================================================
  // 7. Cold Restart Persistence
  // =========================================================================
  describe('7. Cold Restart Persistence', () => {
    it('persists structured capabilities, trials, and limitation histories across database cold restart', () => {
      selfModelEngine.recordTaskTrial({
        domain: 'Distributed Raft Consensus',
        taskTitle: 'Leader election under network partition',
        difficulty: 'complex',
        environment: 'sqlite_test_env',
        outcome: 'success',
        evidenceId: 'ev_raft_01',
        evidenceText: 'Split-brain successfully prevented; quorums maintained across 5 nodes',
      });

      // Cold Restart: Close and reconnect SQLite database
      dbService.close();

      const newDbService = new DatabaseService(dbPath, rootLogger);
      const newDb = newDbService.connect();
      const newApeRepo = new ApeRepository(newDb);
      const newApeService = new ApeService(newApeRepo, undefined, rootLogger);
      const newSelfModelEngine = newApeService.selfModelEngine;

      const report = newSelfModelEngine.getCapabilityEvidenceReport('Distributed Raft Consensus');
      expect(report).toBeDefined();
      expect(report.sampleSize).toBe(1);
      expect(report.successCount).toBe(1);
      expect(report.evidenceIds).toContain('ev_raft_01');
      expect(report.summary).toContain('1 verified successes');

      newDbService.close();
    });
  });
});
