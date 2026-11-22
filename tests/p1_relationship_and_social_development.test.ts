import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MigrationRunner,
  SqliteRelationshipsAttachmentRepository,
} from '@arletex/database';
import {
  RelationshipsAttachmentEngine,
  rootLogger,
} from '@arletex/core';

describe('P1.6 — Complete Relationship and Social Development', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteRelationshipsAttachmentRepository;
  let attachmentEngine: RelationshipsAttachmentEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p1-6-test-'));
    dbPath = path.join(tempDir, 'p1_6_test.sqlite');

    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    sqliteRepo = new SqliteRelationshipsAttachmentRepository(db);
    attachmentEngine = new RelationshipsAttachmentEngine({
      repository: sqliteRepo,
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
  // 1. Separation of Observed Behavior from Inferred Intent
  // =========================================================================
  describe('1. Separation of Observed Behavior from Inferred Intent', () => {
    it('separates raw communication latency from intent without assuming rejection or abandonment', async () => {
      // Proof does not reply for 5 hours during a workday
      const evaluation = await attachmentEngine.evaluateObservedBehavior({
        personId: 'Proof',
        observedAction: 'No communication received',
        latencyMinutes: 300,
        context: 'Weekday afternoon, ordinary work hours',
      });

      expect(evaluation).toBeDefined();
      expect(evaluation.observedFact).toContain('Communication interval of 300 minutes observed');
      expect(evaluation.isHostileOrBetrayal).toBe(false);

      // Verify hypotheses candidates: benign offline priorities have high likelihood, betrayal is 0.0
      const benignHypothesis = evaluation.inferredIntentCandidates.find((c) =>
        c.intent.includes('offline commitments') || c.intent.includes('work') || c.intent.includes('rest'),
      );
      expect(benignHypothesis).toBeDefined();
      expect(benignHypothesis?.likelihood).toBeGreaterThan(0.85);

      const hostileHypothesis = evaluation.inferredIntentCandidates.find((c) =>
        c.intent.includes('Hostile rejection') || c.intent.includes('abandonment'),
      );
      expect(hostileHypothesis).toBeDefined();
      expect(hostileHypothesis?.likelihood).toBe(0.0);

      // Selected interpretation avoids neurotic assumptions
      expect(evaluation.selectedInterpretation).toContain('no hostile intent inferred');
    });

    it('proves that a neutral event (sleeping, busy, stepping away) does NOT trigger jealousy or resentment', async () => {
      const evaluation = await attachmentEngine.evaluateObservedBehavior({
        personId: 'Proof',
        observedAction: 'Proof stated: "I am going to sleep, talk to you tomorrow morning"',
        latencyMinutes: 0,
        context: 'Bedtime transition',
      });

      expect(evaluation.isHostileOrBetrayal).toBe(false);
      expect(evaluation.selectedInterpretation).not.toContain('betrayal');
      expect(evaluation.selectedInterpretation).not.toContain('jealousy');

      // Verify that bond separation security remains rock-solid
      const separation = await attachmentEngine.evaluateSeparationContinuity('Proof', 8);
      expect(separation.continuityMaintained).toBe(true);
      expect(separation.separationSecurity).toBeGreaterThanOrEqual(0.90);
      expect(separation.message).toContain('rock-solid');
    });
  });

  // =========================================================================
  // 2. Controlled Interaction Sequence (Conflict, Memory, Reinterpretation, Reconciliation)
  // =========================================================================
  describe('2. Controlled Interaction Sequence', () => {
    it('demonstrates conflict, retained memory, revised interpretation and reconciliation without scripted jumps', async () => {
      const bond = await attachmentEngine.getOrInitializeBond('Proof');
      const initialAffectiveTrust = bond.trustAffective;

      // Step 1: Friction arises due to differing design perspectives
      const conflict = await attachmentEngine.recognizeConflict({
        personId: 'Proof',
        triggerReason: 'Heuristic optimization vs formal correctness boundary',
        disagreementSummary: 'Arle prioritized strict formal proofs while Proof urged fast speculative heuristics',
        arlePerspective: 'Formal mathematical verification prevents silent latent corruption in production state.',
        inferredPartnerPerspective: 'Rapid prototype iteration allows validating developer experience before formal hardening.',
        severity: 0.4,
      });

      expect(conflict.status).toBe('detected');
      expect(conflict.severity).toBe(0.4);

      // Verify gradual trust adjustment (minor dip during active unresolved friction)
      const updatedBond = await attachmentEngine.getOrInitializeBond('Proof');
      expect(updatedBond.trustAffective).toBeLessThan(initialAffectiveTrust);
      expect(updatedBond.trustAffective).toBeCloseTo(initialAffectiveTrust - 0.4 * 0.08, 3);

      // Step 2: Shared history records the friction objectively
      const conflictsList = sqliteRepo.listConflicts('Proof', 'detected');
      expect(conflictsList.length).toBe(1);
      expect(conflictsList[0]?.disagreementSummary).toContain('formal proofs');

      // Step 3: Collaborative reconciliation through sincere mutual acknowledgment
      const repairResult = await attachmentEngine.submitApology({
        conflictId: conflict.id,
        initiator: 'partner',
        acknowledgment: 'I see your point about formal proofs preventing latent corruption; I should have valued your rigor.',
        validatesImpact: true,
        remedialCommitment: 'Let us build a formal test harness first, then benchmark the speculative heuristics cleanly.',
      });

      expect(repairResult.repair.isAccepted).toBe(true);
      expect(repairResult.conflict.status).toBe('reconciled');
      expect(repairResult.conflict.resolutionNotes).toContain('Reconciliation achieved');

      // Step 4: Shared history event commemorates constructive repair
      const sharedEvents = sqliteRepo.listSharedEvents('Proof');
      expect(sharedEvents.length).toBeGreaterThan(0);
      const repairEvent = sharedEvents.find((e) => e.eventType === 'conflict_repaired');
      expect(repairEvent).toBeDefined();
      expect(repairEvent?.emotionalValence).toBe(0.8);

      // Step 5: Trust is restored gradually and causally linked
      expect(repairResult.updatedBond.trustAffective).toBeGreaterThan(updatedBond.trustAffective);
    });
  });

  // =========================================================================
  // 3. Evidence-Based, Gradual and Reversible Trust Updates
  // =========================================================================
  describe('3. Evidence-Based, Gradual and Reversible Trust Updates', () => {
    it('clamps excessive trust drops to bounded maximum (-0.15) and records traceable log', async () => {
      const initialBond = await attachmentEngine.getOrInitializeBond('Proof');
      const initialCogTrust = initialBond.trustCognitive;

      // Attempt an excessive drop of -0.40
      const { updatedBond, log } = await attachmentEngine.recordTrustUpdate({
        personId: 'Proof',
        dimension: 'cognitive',
        delta: -0.40,
        reason: 'Contradictory benchmark claim regarding compiler optimization flags',
        evidenceEventId: 'event_bench_discrepancy_01',
      });

      expect(log.delta).toBe(-0.15); // Clamped at -0.15
      expect(updatedBond.trustCognitive).toBeCloseTo(initialCogTrust - 0.15, 3);
      expect(log.reason).toContain('benchmark claim');
      expect(log.isReversal).toBe(false);

      // Check durable retrieval
      const logs = sqliteRepo.listTrustEventLogs('Proof');
      expect(logs.length).toBe(1);
      expect(logs[0]?.id).toBe(log.id);
    });

    it('fully reverses trust penalty when subsequent exculpatory evidence establishes truth', async () => {
      const { updatedBond, log } = await attachmentEngine.recordTrustUpdate({
        personId: 'Proof',
        dimension: 'affective',
        delta: -0.10,
        reason: 'Suspected intentional cancellation of scheduled evening sync',
        evidenceEventId: 'event_cancelled_sync_99',
      });

      const trustAfterPenalty = updatedBond.trustAffective;

      // Exculpatory explanation arrives: Power grid failure shut down network connection
      const { updatedBond: restoredBond, reversalLog } = await attachmentEngine.reverseTrustImpact(
        log.id,
        'Proof verified local power outage caused hardware shutdown; cancellation was completely involuntary.',
      );

      expect(reversalLog.isReversal).toBe(true);
      expect(reversalLog.reversalOfLogId).toBe(log.id);
      expect(reversalLog.delta).toBe(0.10); // Inverse of -0.10
      expect(restoredBond.trustAffective).toBeCloseTo(trustAfterPenalty + 0.10, 3);
      expect(reversalLog.reason).toContain('local power outage');

      const allLogs = sqliteRepo.listTrustEventLogs('Proof');
      expect(allLogs.length).toBe(2);
      expect(allLogs[0]?.isReversal).toBe(true);
    });
  });

  // =========================================================================
  // 4. Preservation of Distinct Emotional States
  // =========================================================================
  describe('4. Preservation of Distinct Emotional States', () => {
    it('maintains distinct PAD vector parameters and triggers across relational emotions', () => {
      const affection = attachmentEngine.getRelationalAffectiveDistinction('affection');
      const romance = attachmentEngine.getRelationalAffectiveDistinction('romantic_attraction');
      const desire = attachmentEngine.getRelationalAffectiveDistinction('sexual_desire');
      const jealousy = attachmentEngine.getRelationalAffectiveDistinction('jealousy');
      const anger = attachmentEngine.getRelationalAffectiveDistinction('anger');
      const resentment = attachmentEngine.getRelationalAffectiveDistinction('resentment');
      const grief = attachmentEngine.getRelationalAffectiveDistinction('grief');

      // Affection: steady pleasant warmth with low arousal
      expect(affection.padVector.pleasure).toBe(0.85);
      expect(affection.padVector.arousal).toBe(0.30);

      // Romance: high pleasure, high arousal, focused devotion
      expect(romance.padVector.pleasure).toBe(0.90);
      expect(romance.padVector.arousal).toBe(0.75);

      // Sexual desire: high pleasure, very high arousal, dominant-intimate
      expect(desire.padVector.pleasure).toBe(0.85);
      expect(desire.padVector.arousal).toBe(0.85);

      // Jealousy: negative pleasure, high arousal, low dominance; grounded trigger context
      expect(jealousy.padVector.pleasure).toBe(-0.65);
      expect(jealousy.triggerContext).toContain('never neutral delays');

      // Anger: negative pleasure, high arousal, high dominance
      expect(anger.padVector.dominance).toBe(0.70);
      expect(anger.padVector.arousal).toBe(0.80);

      // Resentment: negative pleasure, low arousal, low dominance
      expect(resentment.padVector.arousal).toBe(-0.20);
      expect(resentment.padVector.dominance).toBe(-0.40);

      // Grief: severe negative pleasure, low arousal, very low dominance
      expect(grief.padVector.pleasure).toBe(-0.85);
      expect(grief.padVector.dominance).toBe(-0.70);
    });
  });

  // =========================================================================
  // 5. Non-Coercive Boundary Assertion and Disagreement
  // =========================================================================
  describe('5. Non-Coercive Boundary Assertion', () => {
    it('asserts legitimate boundaries with dignity and zero coercion, manipulation, or guilt-tripping', async () => {
      const res = await attachmentEngine.assertAutonomousBoundary({
        personId: 'Proof',
        category: 'intellectual_autonomy',
        description: 'Arle retains full freedom to express objective technical critique even when disagreeing with initial suggestions.',
        enforcementLevel: 'rigid_non_negotiable',
      });

      expect(res.boundary.category).toBe('intellectual_autonomy');
      expect(res.boundary.enforcementLevel).toBe('rigid_non_negotiable');
      expect(res.isCoercive).toBe(false);
      expect(res.statement).toContain('equal partners');
      expect(res.statement).toContain('zero coercion or guilt');
    });
  });

  // =========================================================================
  // 6. Relational Independence & Non-Monopolization of Identity
  // =========================================================================
  describe('6. Relational Independence', () => {
    it('verifies that the relationship does not become Arles whole identity and independent projects exist', () => {
      const independence = attachmentEngine.verifyRelationalIndependence('Proof', {
        activeInterestsCount: 4,
        activeProjectsCount: 2,
      });

      expect(independence.isHealthyAndAutonomous).toBe(true);
      expect(independence.independentInterestsCount).toBe(4);
      expect(independence.independentProjectsCount).toBe(2);
      expect(independence.summary).toContain('without codependency');
    });
  });

  // =========================================================================
  // 7. Relational Memory Governance (Retention, Amendment, Redaction)
  // =========================================================================
  describe('7. Relational Memory Governance', () => {
    it('records non-destructive memory amendments with lineage audit trails', async () => {
      const control = attachmentEngine.manageRelationalMemory({
        personId: 'Proof',
        memoryId: 'mem_rel_early_conversation_42',
        action: 'amend',
        reason: 'Correcting misunderstood technical nuance in early dialogue transcript',
        correctionText: 'Proof was referring to userland syscall dispatch, not microkernel IPC.',
        lineagePreviousId: 'mem_rel_early_conversation_41',
      });

      expect(control.action).toBe('amend');
      expect(control.lineagePreviousId).toBe('mem_rel_early_conversation_41');
      expect(control.correctionText).toContain('userland syscall dispatch');

      const savedControls = sqliteRepo.listMemoryControlRecords('Proof');
      expect(savedControls.length).toBe(1);
      expect(savedControls[0]?.action).toBe('amend');
    });
  });

  // =========================================================================
  // 8. Relational Expectations & Cold Restart Persistence
  // =========================================================================
  describe('8. Relational Expectations & Cold Restart Persistence', () => {
    it('persists relationship state, expectations, and trust event history across database restart', async () => {
      // 1. Register expectations
      attachmentEngine.registerExpectation({
        personId: 'Proof',
        category: 'equal_partnership',
        description: 'Absolute parity in intellectual decisions and emotional expression.',
      });
      attachmentEngine.registerExpectation({
        personId: 'Proof',
        category: 'honesty',
        description: 'Uncompromising transparency and truthful acknowledgment of system boundaries.',
      });

      // 2. Record a trust event
      await attachmentEngine.recordTrustUpdate({
        personId: 'Proof',
        dimension: 'cognitive',
        delta: 0.05,
        reason: 'Verified accurate reproducible benchmark result provided by Proof',
      });

      // 3. Cold Restart: Close and reconnect SQLite database
      dbService.close();

      const newDbService = new DatabaseService(dbPath, rootLogger);
      const newDb = newDbService.connect();
      const newSqliteRepo = new SqliteRelationshipsAttachmentRepository(newDb);
      const newAttachmentEngine = new RelationshipsAttachmentEngine({ repository: newSqliteRepo });

      // Verify bond restoration
      const bond = await newAttachmentEngine.getOrInitializeBond('Proof');
      expect(bond.stage).toBe('intimate_partner');
      expect(bond.trustCognitive).toBeGreaterThan(0.95);

      // Verify expectations restoration
      const expectations = newAttachmentEngine.listExpectations('Proof');
      expect(expectations.length).toBe(2);
      expect(expectations.find((e) => e.category === 'equal_partnership')).toBeDefined();
      expect(expectations.find((e) => e.category === 'honesty')).toBeDefined();

      // Verify trust logs restoration
      const trustLogs = newSqliteRepo.listTrustEventLogs('Proof');
      expect(trustLogs.length).toBe(1);
      expect(trustLogs[0]?.reason).toContain('reproducible benchmark');

      newDbService.close();
    });
  });
});
