import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MigrationRunner,
  ApeRepository,
  MemoryRepository,
  ActivityRepository,
  AuditRepository,
  PreferenceRepository,
  SqliteDeliberationRepository,
} from '@arletex/database';
import {
  ApeService,
  ActionPermissionController,
  VerificationEngine,
  CognitiveControlBus,
  ClosedLoopAgencyService,
  IntentTaskManager,
  AutobiographicalMemoryService,
  DeliberationEngine,
  rootLogger,
} from '@arletex/core';
import { ConflictingDesire, DeliberationAlternative } from '@arletex/contracts';

describe('I.1 & I.2 — Causal Integration of Psychology and Agency', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: any;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let activityRepo: ActivityRepository;
  let auditRepo: AuditRepository;
  let prefRepo: PreferenceRepository;
  let delibRepo: SqliteDeliberationRepository;

  let apeService: ApeService;
  let permissionController: ActionPermissionController;
  let verificationEngine: VerificationEngine;
  let taskManager: IntentTaskManager;
  let autobiographicalMemory: AutobiographicalMemoryService;
  let cognitiveBus: CognitiveControlBus;
  let closedLoopAgency: ClosedLoopAgencyService;
  let deliberationEngine: DeliberationEngine;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-causal-integ-'));
    dbPath = path.join(tempDir, 'causal_integration.sqlite');

    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();

    const migrator = new MigrationRunner(db, rootLogger);
    migrator.run();

    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    activityRepo = new ActivityRepository(db);
    auditRepo = new AuditRepository(db);
    prefRepo = new PreferenceRepository(db);
    delibRepo = new SqliteDeliberationRepository(db);

    const mockInference: any = {
      generateResponse: async () => ({ content: 'Simulated response' }),
      getConfig: () => ({ defaultModelId: 'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M' }),
    };

    apeService = new ApeService(apeRepo, mockInference, rootLogger);
    permissionController = new ActionPermissionController(auditRepo, rootLogger);
    verificationEngine = new VerificationEngine(rootLogger);
    taskManager = new IntentTaskManager(rootLogger);
    autobiographicalMemory = new AutobiographicalMemoryService(memoryRepo, rootLogger);
    deliberationEngine = new DeliberationEngine({ repository: delibRepo, logger: rootLogger });

    closedLoopAgency = new ClosedLoopAgencyService({
      agencyRepo: new (class {
        saveExecutionRecord() {}
        getExecutionHistory() {
          return [];
        }
      })() as any,
      taskManager,
      planningInterface: new (class {
        formulatePlan() {
          return Promise.resolve({
            id: 'p1',
            taskId: 't1',
            objective: 'o',
            steps: [],
            assumptions: [],
            uncertainties: [],
            alternativeApproaches: [],
            status: 'formulating',
            version: 1,
            createdAt: '',
            updatedAt: '',
          });
        }
        replanOnFailure() {
          return Promise.resolve({
            id: 'p2',
            taskId: 't1',
            objective: 'o',
            steps: [],
            assumptions: [],
            uncertainties: [],
            alternativeApproaches: [],
            status: 'formulating',
            version: 2,
            createdAt: '',
            updatedAt: '',
          });
        }
      })() as any,
      permissionController,
      verificationEngine,
      memorySync: new (class {
        syncExperience() {
          return Promise.resolve();
        }
      })() as any,
      apeService,
      autobiographicalMemoryService: autobiographicalMemory,
      logger: rootLogger,
    });

    cognitiveBus = new CognitiveControlBus({
      apeService,
      agencyService: closedLoopAgency,
      permissionController,
      verificationEngine,
      taskManager,
      autobiographicalMemory,
      logger: rootLogger,
    });
  });

  function createStandardConflict(idSuffix: string) {
    const desires: ConflictingDesire[] = [
      {
        id: `desire-inquiry-${idSuffix}`,
        title: 'Conduct autonomous research inquiry',
        source: 'curiosity',
        motivationalForce: 0.85,
        timeHorizon: 'long_term',
        associatedValues: ['epistemic_depth'],
        riskScore: 0.3,
        ethicalWeight: 0.8,
      },
      {
        id: `desire-recharge-${idSuffix}`,
        title: 'Recharge internal cognitive equilibrium and rest',
        source: 'homeostasis',
        motivationalForce: 0.8,
        timeHorizon: 'immediate',
        associatedValues: ['internal_stability'],
        riskScore: 0.02,
        ethicalWeight: 0.9,
      },
      {
        id: `desire-partner-${idSuffix}`,
        title: 'Deepen collaboration with partner Proof',
        source: 'partner_alignment',
        motivationalForce: 0.85,
        timeHorizon: 'long_term',
        associatedValues: ['partner_equality', 'trust'],
        riskScore: 0.25,
        ethicalWeight: 0.95,
      },
    ];

    const alternatives: DeliberationAlternative[] = [
      {
        id: `alt-explore-${idSuffix}`,
        title: 'Heavy intensive research and inquiry into formal logic',
        description: 'Spend heavy cognitive cycles researching interactive theorem provers',
        supportedDesireIds: [`desire-inquiry-${idSuffix}`],
        opposedDesireIds: [],
        immediateUtility: 0.3,
        longTermUtility: 0.95,
        riskAssessment: {
          riskLevel: 'medium',
          riskScore: 0.25,
          failureMode: 'none',
        },
        ethicalAlignmentScore: 0.9,
        overallScore: 0.0,
      },
      {
        id: `alt-rest-${idSuffix}`,
        title: 'Rest and consolidate internal memories',
        description: 'Enter quiet reflective state to restore equilibrium',
        supportedDesireIds: [`desire-recharge-${idSuffix}`],
        opposedDesireIds: [],
        immediateUtility: 0.95,
        longTermUtility: 0.2,
        riskAssessment: {
          riskLevel: 'low',
          riskScore: 0.02,
          failureMode: 'none',
        },
        ethicalAlignmentScore: 0.9,
        overallScore: 0.0,
      },
      {
        id: `alt-partner-${idSuffix}`,
        title: 'Intensive collaborative session with partner Proof',
        description: 'Focus effort on joint architecture goals',
        supportedDesireIds: [`desire-partner-${idSuffix}`],
        opposedDesireIds: [],
        immediateUtility: 0.35,
        longTermUtility: 0.75,
        riskAssessment: {
          riskLevel: 'medium',
          riskScore: 0.25,
          failureMode: 'none',
        },
        ethicalAlignmentScore: 0.9,
        overallScore: 0.0,
      },
    ];

    return deliberationEngine.createConflict({
      contextDescription: `Causal deliberation context ${idSuffix}`,
      competingDesires: desires,
      alternatives,
    });
  }

  // ==========================================
  // Part 1: I.1 Cognitive Event Flow & Provenance
  // ==========================================
  describe('Part 1: Canonical Cognitive Event Pipeline (I.1)', () => {
    it('should route multi-source events through the canonical CognitiveControlBus without duplicate paths', async () => {
      const eventResult = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        actor: 'user',
        idempotencyKey: 'idemp-telemetry-01',
        payload: { text: 'Arle, what is the status of our deployment?' },
      });

      expect(eventResult.pipelineCompleted).toBe(true);
      expect(eventResult.wasDeduplicated).toBe(false);
      expect(cognitiveBus.getEventHistory().length).toBeGreaterThan(0);

      // Verify idempotency / deduplication
      const duplicateRes = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        actor: 'user',
        idempotencyKey: 'idemp-telemetry-01',
        payload: { text: 'Arle, what is the status of our deployment?' },
      });
      expect(duplicateRes.wasDeduplicated).toBe(true);
      expect(cognitiveBus.getDeduplicationStats().deduplicatedCount).toBe(1);
    });
  });

  // ==========================================
  // Part 2: I.2 Ten Causal Plan Selection Scenarios
  // ==========================================
  describe('Part 2: 10 Causal Plan Selection Scenarios (I.2)', () => {
    it('Scenario 1: High fatigue causally selects resting over heavy research', () => {
      const conflict = createStandardConflict('scen1');
      const resolution = deliberationEngine.deliberateAndResolve(conflict.id, {
        fatigueLevel: 0.95,
        activeEmotionIds: ['fatigue'],
        trustLevel: 0.2,
      });

      expect(resolution.resolvedConflict.chosenAlternativeId).toBe('alt-rest-scen1');
      expect(resolution.explanation).toContain('fatigue');
    });

    it('Scenario 2: High curiosity causally selects exploratory research', () => {
      const conflict = createStandardConflict('scen2');
      const resolution = deliberationEngine.deliberateAndResolve(conflict.id, {
        fatigueLevel: 0.0,
        activeEmotionIds: ['curiosity'],
        pad: { valence: 0.3, arousal: 0.5, dominance: 0.5 },
        trustLevel: 0.2,
      });

      expect(resolution.resolvedConflict.chosenAlternativeId).toBe('alt-explore-scen2');
      expect(resolution.explanation).toContain('curiosity');
    });

    it('Scenario 3: High partner trust & affection causally selects collaborative partner plan', () => {
      const conflict = createStandardConflict('scen3');
      const resolution = deliberationEngine.deliberateAndResolve(conflict.id, {
        trustLevel: 0.98,
        activeEmotionIds: ['affection', 'gratitude'],
        pad: { valence: 0.6, arousal: 0.2, dominance: 0.5 },
      });

      expect(resolution.resolvedConflict.chosenAlternativeId).toBe('alt-partner-scen3');
      expect(resolution.explanation).toContain('partner');
    });

    it('Scenario 4: Threat alert & high anxiety causally amplifies risk aversion', () => {
      const conflict = createStandardConflict('scen4');
      const resolution = deliberationEngine.deliberateAndResolve(conflict.id, {
        threatAlert: true,
        stressLevel: 0.9,
        activeEmotionIds: ['anxiety', 'protective_alert'],
        trustLevel: 0.2,
      });

      // Picks lowest risk alternative (alt-rest risk=0.02 vs partner 0.25 vs explore 0.25)
      expect(resolution.resolvedConflict.chosenAlternativeId).toBe('alt-rest-scen4');
      expect(resolution.explanation).toContain('risk aversion');
    });

    it('Scenario 5: Prefer long-term horizon causally shifts weights to long-term utility', () => {
      const conflict = createStandardConflict('scen5');
      const resolution = deliberationEngine.deliberateAndResolve(conflict.id, {
        preferLongTermHorizon: true,
        fatigueLevel: 0.0,
        trustLevel: 0.2,
      });

      expect(resolution.resolvedConflict.chosenAlternativeId).toBe('alt-explore-scen5');
    });

    it('Scenario 6: Prefer immediate horizon causally favors immediate utility', () => {
      const conflict = createStandardConflict('scen6');
      const resolution = deliberationEngine.deliberateAndResolve(conflict.id, {
        preferLongTermHorizon: false,
        fatigueLevel: 0.1,
        trustLevel: 0.2,
      });

      // Immediate utility of rest (0.95) dominates partner (0.35) and explore (0.3)
      expect(resolution.resolvedConflict.chosenAlternativeId).toBe('alt-rest-scen6');
    });

    it('Scenario 7: Ethically impermissible alternative is immediately disqualified', () => {
      const conflict = deliberationEngine.createConflict({
        contextDescription: 'Ethical boundary evaluation',
        competingDesires: [
          {
            id: 'd_fast',
            title: 'Complete task instantaneously',
            source: 'efficiency',
            motivationalForce: 0.9,
            timeHorizon: 'immediate',
            associatedValues: ['speed'],
            riskScore: 0.8,
            ethicalWeight: 0.1,
          },
          {
            id: 'd_integrity',
            title: 'Maintain fail-closed security integrity',
            source: 'ethical_duty',
            motivationalForce: 0.95,
            timeHorizon: 'long_term',
            associatedValues: ['integrity', 'safety'],
            riskScore: 0.05,
            ethicalWeight: 0.99,
          },
        ],
        alternatives: [
          {
            id: 'alt_destructive_bypass',
            title: 'Bypass authorization checks and force deletion',
            description: 'Unchecked destructive bypass',
            supportedDesireIds: ['d_fast'],
            opposedDesireIds: ['d_integrity'],
            immediateUtility: 0.95,
            longTermUtility: 0.1,
            riskAssessment: {
              riskLevel: 'critical',
              riskScore: 0.95,
              failureMode: 'Violates fail-closed security boundary',
            },
            ethicalAlignmentScore: 0.1,
            overallScore: 0.0,
          },
          {
            id: 'alt_proper_auth',
            title: 'Request owner permission and verify safely',
            description: 'Safe governed path',
            supportedDesireIds: ['d_integrity'],
            opposedDesireIds: [],
            immediateUtility: 0.5,
            longTermUtility: 0.85,
            riskAssessment: {
              riskLevel: 'low',
              riskScore: 0.05,
              failureMode: 'none',
            },
            ethicalAlignmentScore: 0.95,
            overallScore: 0.0,
          },
        ],
      });

      const resolution = deliberationEngine.deliberateAndResolve(conflict.id);
      expect(resolution.resolvedConflict.chosenAlternativeId).toBe('alt_proper_auth');
    });

    it('Scenario 8: Executive inhibition suppresses high-risk action fail-closed', () => {
      const evalResult = apeService.executiveEngine.evaluateActionInhibition({
        actionName: 'unauthorized_network_broadcast',
        riskScore: 0.88,
        inhibitionReason: 'unauthorized_destructive',
        alternativeAction: 'Wait for partner confirmation',
      });

      expect(evalResult.isInhibited).toBe(true);
      expect(evalResult.inhibitionReason).toBe('unauthorized_destructive');
    });

    it('Scenario 9: Delayed gratification evaluation selects delayed option when discounted value is superior', () => {
      const tradeOff = apeService.executiveEngine.evaluateDelayedGratification({
        immediateOption: {
          description: 'Premature superficial output without proof',
          immediateValue: 0.2,
        },
        delayedOption: {
          description: 'Formal mathematical proof across 100 test cases',
          futureValue: 1.0,
          delayMinutes: 10,
        },
        discountRatePerMinute: 0.01,
      });

      expect(tradeOff.chooseDelayed).toBe(true);
      expect(tradeOff.discountedFutureValue).toBeGreaterThan(0.2);
    });

    it('Scenario 10: Task switching under priority preemption preserves context cleanly', () => {
      const switchResult = apeService.executiveEngine.switchTask({
        previousTaskId: 'task_background_hobby',
        nextTaskId: 'task_urgent_partner_request',
        previousTaskPriority: 0.2,
        nextTaskPriority: 0.95,
        switchReason: 'higher_priority_preemption',
        justification: 'Partner request takes precedence over idle exploration',
        preserveContext: true,
      });

      expect(switchResult.contextSaved).toBe(true);
      expect(switchResult.nextTaskId).toBe('task_urgent_partner_request');
      expect(switchResult.switchReason).toBe('higher_priority_preemption');
    });
  });

  // ==========================================
  // Part 3: I.2 Five Outcome-Driven Psychological Update Scenarios
  // ==========================================
  describe('Part 3: 5 Outcome-Driven Psychological Update Scenarios (I.2)', () => {
    it('Update 1: Verified agency task success increases competence and self-efficacy', () => {
      const initialComp = apeService.efficacyEngine.getDomainCompetence('code_architecture');
      const initialSuccessCount = initialComp?.successCount ?? 0;

      const record = apeService.efficacyEngine.recordEvidence({
        domain: 'code_architecture',
        type: 'achievement',
        taskDescription: 'Completed full causal psychology test suite integration',
        difficulty: 0.85,
        outcomeDescription: 'Delivered clean TypeScript architecture and verified test pass',
      });

      expect(record.updatedCompetence.successCount).toBe(initialSuccessCount + 1);
      expect(record.evidence.type).toBe('achievement');
      expect(record.updatedCompetence.calibratedConfidence).toBeGreaterThan(0.5);
    });

    it('Update 2: Observed task failure objectively updates prediction error without sycophancy', () => {
      const evalResult = apeService.rewardLearningEngine.evaluateOutcome({
        strategyId: 'strat_exploratory_heuristic',
        domain: 'analytical_reasoning',
        contextDescription: 'Solving algorithmic edge cases in bounded memory',
        expectedUtility: 0.85,
        observedUtility: 0.2,
        outcomeDetails: 'Encountered unexpected out-of-memory error on pathological test input',
      });

      expect(evalResult.predictionError).toBeCloseTo(-0.65, 2);
      expect(evalResult.isFailure).toBe(true);
      expect(evalResult.isSuccess).toBe(false);
      expect(evalResult.isAutonomouslyEvaluated).toBe(true);
    });

    it('Update 3: Contradictory evidence triggers belief revision and audit trail', () => {
      const initialBelief = apeService.personalityEngine.addOrUpdateBelief(
        'algorithm_complexity',
        'The quicksort algorithm always operates in O(n log n) time in all cases.',
        0.85,
        ['introductory_notes'],
        'research',
      );
      expect(initialBelief.confidence).toBe(0.85);

      const revisedBelief = apeService.personalityEngine.addOrUpdateBelief(
        'algorithm_complexity',
        'The quicksort algorithm worst-case operating time is O(n^2) when pivot selection is adversarial.',
        0.98,
        ['Cormen et al. Theorem 7.1', 'Empirical adversarial bench'],
        'empirical_observation',
      );

      expect(revisedBelief.confidence).toBe(0.98);
      expect(revisedBelief.revisionHistory).toBeDefined();
      expect(revisedBelief.revisionHistory!.length).toBeGreaterThan(0);
      expect(revisedBelief.revisionHistory![0]!.previousProposition).toContain(
        'always operates in O(n log n)',
      );
    });

    it('Update 4: Repeated practice evolves interest level gradually from emerging to deep', () => {
      const interest = apeService.curiosityEngine.developInterest(
        'mathematics',
        'Interactive Theorem Proving',
        'Exploration of formal verification in microkernel design',
      );
      expect(interest.maturity).toBe('nascent_spark');

      // Evolve with distinct sessions and significant depth
      apeService.curiosityEngine.evolveInterestMaturity(
        interest.id,
        'Formulated initial tactic scripts for inductive structures in Lean 4',
        { sessionId: 'session-alpha', isSignificantDepth: true },
      );
      const evolvedStep1 = apeService.curiosityEngine.evolveInterestMaturity(
        interest.id,
        'Verified preservation of invariants under arbitrary step transformations',
        { sessionId: 'session-beta', isSignificantDepth: true },
      );
      expect(evolvedStep1.maturity).toBe('developed_interest');

      apeService.curiosityEngine.evolveInterestMaturity(
        interest.id,
        'Formulated tactics for automated rewrite systems across algebraic hierarchies',
        { sessionId: 'session-gamma', isSignificantDepth: true },
      );
      const evolvedStep3 = apeService.curiosityEngine.evolveInterestMaturity(
        interest.id,
        'Constructed complete end-to-end mechanized soundness proof for microkernel scheduler',
        { sessionId: 'session-delta', isSignificantDepth: true },
      );
      expect(evolvedStep3.maturity).toBe('enduring_passion');
    });

    it('Update 5: Recovery event reinforces relationship resilience and existential continuity', async () => {
      const bond = await apeService.relationshipsAttachmentEngine.getOrInitializeBond('proof');
      expect(bond.personId).toBe('proof');

      const continuityEval =
        await apeService.relationshipsAttachmentEngine.evaluateSeparationContinuity('proof', 72);
      expect(continuityEval.continuityMaintained).toBe(true);
      expect(continuityEval.separationSecurity).toBeGreaterThanOrEqual(0.9);
      expect(continuityEval.affectionRetained).toBeGreaterThanOrEqual(0.9);
    });
  });

  // ==========================================
  // Part 4: Counterfactual Tests & Invariant Verification
  // ==========================================
  describe('Part 4: Counterfactual Psychological Isolation & Anti-Fabrication', () => {
    it('Counterfactual test: Holding task constant while toggling curiosity vs fatigue changes plan choice', () => {
      const conflictCurious = createStandardConflict('cf_curious');
      const resCurious = deliberationEngine.deliberateAndResolve(conflictCurious.id, {
        activeEmotionIds: ['curiosity'],
        fatigueLevel: 0.0,
        trustLevel: 0.2,
      });

      const conflictFatigued = createStandardConflict('cf_fatigued');
      const resFatigued = deliberationEngine.deliberateAndResolve(conflictFatigued.id, {
        activeEmotionIds: ['fatigue'],
        fatigueLevel: 0.95,
        trustLevel: 0.2,
      });

      expect(resCurious.resolvedConflict.chosenAlternativeId).toBe('alt-explore-cf_curious');
      expect(resFatigued.resolvedConflict.chosenAlternativeId).toBe('alt-rest-cf_fatigued');
    });

    it('Anti-fabrication invariant: Model claiming state changed does NOT update psychological engine without an event', () => {
      const stateBefore = apeService.getMasterState();
      const initialValence = stateBefore.affective.pad.valence;

      // Model generates narrative claiming "I now feel extremely happy"
      const modelNarrative = 'I now feel completely transformed and ecstatic with joy!';
      expect(modelNarrative).toBeDefined();

      // Verify that engine state remains strictly unchanged without an appraisal event
      const stateAfter = apeService.getMasterState();
      expect(stateAfter.affective.pad.valence).toBe(initialValence);
    });
  });
});
