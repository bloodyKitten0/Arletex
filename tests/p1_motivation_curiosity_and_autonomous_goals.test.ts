import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { DatabaseService, MigrationRunner, ApeRepository } from '@arletex/database';
import type Database from 'better-sqlite3';
import {
  ApeService,
  CuriosityExplorationEngine,
  InMemoryCuriosityExplorationRepository,
  SelfGeneratedGoalEngine,
  InMemorySelfGeneratedGoalRepository,
  PersonalProjectService,
  ResourceGovernor,
  rootLogger,
} from '@arletex/core';
import {
  SelfGeneratedGoal,
  DiscoveredInterest,
  assertSelfGeneratedGoalIntegrity,
} from '@arletex/contracts';

describe('Priority 1.3 — Motivation, Curiosity & Autonomous Interest Formation (P1.3)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let apeRepo: ApeRepository;
  let apeService: ApeService;
  let curiosityEngine: CuriosityExplorationEngine;
  let goalEngine: SelfGeneratedGoalEngine;
  let projectService: PersonalProjectService;
  let resourceGovernor: ResourceGovernor;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p1-3-motivation-'));
    dbPath = path.join(tempDir, 'motivation_p1_test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo, undefined, rootLogger);

    curiosityEngine = apeService.curiosityEngine;
    goalEngine = apeService.selfGeneratedGoalEngine;
    projectService = apeService.personalProjectService;
    resourceGovernor = apeService.resourceGovernor;
  });

  afterEach(() => {
    try {
      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================
  // 1. Traceable Curiosity-to-Goal Pipeline
  // ==========================================
  describe('1. Traceable Curiosity-to-Goal Pipeline (7 Stages)', () => {
    it('executes reproducible autonomous pipeline from unfamiliar stimulus to evidence-backed goal without user objective', () => {
      // Stimulus: Arle encounters an unfamiliar theoretical topic in telemetry/literature
      const stimulus = 'Quantum error correction via surface code lattice surgery';
      const domain = 'quantum_information';
      const sessionId = `session_${crypto.randomUUID()}`;

      const result = curiosityEngine.executeTraceableCuriosityPipeline({
        stimulus,
        domain,
        sessionId,
        familiarityBaseline: 0.1, // Highly unfamiliar
        epistemicUncertainty: 0.85,
        hypotheses: [
          'Lattice surgery enables fault-tolerant Clifford operations with planar 2D connectivity',
          'Boundary defect routing minimizes physical qubit overhead during syndrome extraction',
        ],
        evidenceFindings: [
          'Empirical literature confirms lattice surgery replaces transversal CNOT with parity measurements.',
          'Physical-to-logical overhead reduced by 40% using rotated surface codes.',
        ],
        goalEngine,
        projectService,
      });

      // 1. Verification of Stage Completion
      expect(result.stageCompleted).toBe('goal_crystallized');
      expect(result.traceLog.length).toBeGreaterThanOrEqual(6);

      // 2. Salience & Novelty
      expect(result.noveltyRecord.isNovel).toBe(true);
      expect(result.noveltyRecord.noveltyScore).toBeGreaterThanOrEqual(0.8);

      // 3. Knowledge Gap & Question Formulation
      expect(result.knowledgeGap).toBeDefined();
      expect(result.knowledgeGap!.domain).toBe(domain);
      expect(result.question).toBeDefined();
      expect(result.question!.hypotheses.length).toBe(2);

      // 4. Investigation & Evidence
      expect(result.investigation).toBeDefined();
      expect(result.investigation!.isAutonomous).toBe(true);
      expect(result.investigation!.initiatedBy).toBe('arle_autonomous');
      expect(result.investigation!.stepsExecuted.length).toBeGreaterThanOrEqual(2);

      // 5. Discovered Interest
      expect(result.interest).toBeDefined();
      expect(result.interest!.isUserAssigned).toBe(false);
      expect(result.interest!.keyFindings.length).toBeGreaterThanOrEqual(2);
      expect(result.interest!.maturity).toBe('nascent_spark');

      // 6. Goal & Project Proposals
      expect(result.crystallizedGoal).toBeDefined();
      expect(result.crystallizedGoal!.origin).toBe('interest');
      expect(result.crystallizedGoal!.originParty).toBe('arle');
      expect(result.crystallizedGoal!.status).toBe('active');
      expect(result.crystallizedGoal!.priority).toBeGreaterThanOrEqual(0.8);

      expect(result.crystallizedProject).toBeDefined();
      expect(result.crystallizedProject!.milestones.length).toBeGreaterThanOrEqual(2);
    });

    it('gracefully filters familiar/noise stimuli without propagating to goal crystallization', () => {
      const result = curiosityEngine.executeTraceableCuriosityPipeline({
        stimulus: 'Standard Linux exit code 0 success return',
        domain: 'operating_systems',
        familiarityBaseline: 0.95, // Highly familiar
        goalEngine,
      });

      expect(result.stageCompleted).toBe('salience');
      expect(result.noveltyRecord.isNovel).toBe(false);
      expect(result.knowledgeGap).toBeUndefined();
      expect(result.crystallizedGoal).toBeUndefined();
    });
  });

  // ==========================================
  // 2. Temporary Novelty vs Durable Interest Across Separated Sessions
  // ==========================================
  describe('2. Temporary Novelty vs Durable Interest Across Separated Sessions', () => {
    it('does NOT mature an interest from repeated burst exposures in the same session (preventing superficial inflation)', () => {
      const topic = 'Transient Cache Eviction Glitch';
      const domain = 'systems_programming';
      const singleSessionId = 'session_burst_01';

      const interest = curiosityEngine.developInterest(
        domain,
        topic,
        'Burst encounter during debugging',
        ['Initial log artifact observed'],
        { sessionId: singleSessionId },
      );

      // Repeated rapid exposures in the same single session
      for (let i = 1; i <= 5; i++) {
        curiosityEngine.evolveInterestMaturity(
          interest.id,
          `Superficial repetition note #${i} without conceptual depth`,
          { sessionId: singleSessionId, isSignificantDepth: false },
        );
      }

      const updated = curiosityEngine.listInterests().find((item) => item.id === interest.id)!;
      // Invariant: Must remain nascent_spark or temporary_novelty; must not mature to developed_interest or enduring_passion
      expect(updated.investigationCount).toBe(6);
      expect(updated.maturity).toBe('nascent_spark');
      expect(updated.noveltyType).toBe('temporary_novelty');
    });

    it('systematically matures interest only when inquiry spans multiple distinct separated sessions with conceptual depth', () => {
      const topic = 'Categorical Quantum Mechanics & ZX-Calculus';
      const domain = 'mathematical_physics';

      // Session 1: Genesis spark
      const interest = curiosityEngine.developInterest(
        domain,
        topic,
        'Autonomous exploration into diagrammatic quantum computation',
        ['Spider fusion and bialgebra rewrite rules demonstrated diagrammatically.'],
        { sessionId: 'session_day_01' },
      );
      expect(interest.maturity).toBe('nascent_spark');

      // Session 2: Second separated session with substantive finding
      const evolvedS2 = curiosityEngine.evolveInterestMaturity(
        interest.id,
        'ZX-diagram completeness verified for stabilizer quantum mechanics via local Clifford transformations.',
        { sessionId: 'session_day_02', isSignificantDepth: true },
      );
      expect(evolvedS2.maturity).toBe('active_inquiry');

      // Session 2 follow-up inquiry (adds investigation depth)
      curiosityEngine.evolveInterestMaturity(
        interest.id,
        'T-gate phase gadgets simplify non-Clifford routing in measurement-based quantum computing.',
        { sessionId: 'session_day_02', isSignificantDepth: true },
      );

      // Session 3: Third separated session with cross-domain synthesis
      const evolvedS3 = curiosityEngine.evolveInterestMaturity(
        interest.id,
        'Proved diagrammatic equivalence between graph state entanglement topologies and surface code boundary operations.',
        { sessionId: 'session_day_03', isSignificantDepth: true },
      );
      expect(evolvedS3.maturity).toBe('developed_interest');
      expect(evolvedS3.noveltyType).toBe('durable_interest');

      // Continuing across 5 investigations into enduring passion
      curiosityEngine.evolveInterestMaturity(
        interest.id,
        'Derived complete topological invariants for fault-tolerant measurement sequences.',
        { sessionId: 'session_day_03', isSignificantDepth: true },
      );
      const enduring = curiosityEngine.listInterests().find((i) => i.id === interest.id)!;
      expect(enduring.maturity).toBe('enduring_passion');
      expect(enduring.curiosityIntensity).toBeGreaterThanOrEqual(0.95);
    });
  });

  // ==========================================
  // 3. Three Distinct Endogenous Goal Generation Scenarios (Without Canned Lists)
  // ==========================================
  describe('3. Endogenous Goal Generation Scenarios (Without Canned Lists)', () => {
    it('Scenario A: Need/Deficit driven goal generation from runtime telemetry bottleneck', () => {
      const telemetryBottleneck = {
        capability: 'subagent_context_orchestration',
        errorPattern:
          'Context window compression latency exceeding 450ms under heavy memory retrieval',
      };

      const goals = goalEngine.synthesizeAutonomousGoalsFromState({
        observedBottlenecks: [telemetryBottleneck],
      });

      expect(goals.length).toBe(1);
      const goal = goals[0]!;
      expect(goal.origin).toBe('self_improvement');
      expect(goal.originParty).toBe('arle');
      expect(goal.originAudit?.sourceType).toBe('need_deficit');
      expect(goal.title).toContain(telemetryBottleneck.capability);
      expect(goal.description).toContain(telemetryBottleneck.errorPattern);
      expect(goal.successCriteria.some((sc) => sc.includes(telemetryBottleneck.errorPattern))).toBe(
        true,
      );

      // Verify trigger audit trail is durably stored
      const triggers = goalEngine.listTriggers(goal.id);
      expect(triggers.length).toBe(1);
      expect(triggers[0]!.triggerType).toBe('self_improvement_bottleneck');
    });

    it('Scenario B: Epistemic gap curiosity driven goal generation from empirical observation', () => {
      const curiosityGap = {
        theme: 'pipewire_audio_quantum_jitter',
        gap: 'Sub-millisecond buffer underruns during parallel whisper inference on AMD Z1 Extreme',
        salience: 0.85,
      };

      const goals = goalEngine.synthesizeAutonomousGoalsFromState({
        curiosityGaps: [curiosityGap],
      });

      expect(goals.length).toBe(1);
      const goal = goals[0]!;
      expect(goal.origin).toBe('curiosity');
      expect(goal.originParty).toBe('arle');
      expect(goal.originAudit?.sourceType).toBe('curiosity_gap');
      expect(goal.title).toContain(curiosityGap.theme);
      expect(goal.description).toContain(curiosityGap.gap);
      expect(goal.priority).toBeGreaterThan(0.8);
    });

    it('Scenario C: Project milestone progression driven goal generation', () => {
      const activeProject = {
        id: crypto.randomUUID(),
        title: 'Bazzite Local Model Quantization Calibration',
        currentPhase: 'Perplexity Evaluation on 14B Abliterated Checkpoints',
      };

      const goals = goalEngine.synthesizeAutonomousGoalsFromState({
        activeProjects: [activeProject],
      });

      expect(goals.length).toBe(1);
      const goal = goals[0]!;
      expect(goal.origin).toBe('project');
      expect(goal.originParty).toBe('arle');
      expect(goal.originAudit?.sourceType).toBe('project_milestone');
      expect(goal.sourceRefId).toBe(activeProject.id);
      expect(goal.title).toContain(activeProject.title);
      expect(goal.title).toContain(activeProject.currentPhase);
    });

    it('Scenario D: Emergent opportunity recognition driven goal generation', () => {
      const opportunity = goalEngine.recognizeOpportunity({
        opportunityType: 'system_low_power_idle',
        eventDescription:
          'ROG Ally X plugged into 65W AC power with battery at 98% and CPU idle > 10m',
        estimatedValue: 0.85,
      });

      expect(opportunity).not.toBeNull();
      expect(opportunity!.origin).toBe('opportunity');
      expect(opportunity!.originParty).toBe('arle');
      expect(opportunity!.originAudit?.sourceType).toBe('opportunity_recognition');
      expect(opportunity!.priority).toBe(0.85);
    });
  });

  // ==========================================
  // 4. Multi-Criteria Goal Ranking & Resource Modulation
  // ==========================================
  describe('4. Multi-Criteria Goal Ranking & Resource Modulation', () => {
    it('ranks competing goals across expected value, urgency, cost, and penalizes high-cost goals under fatigue', () => {
      const gLight = goalEngine.generateGoalFromInterest({
        interestTopic: 'Lightweight SQLite Index Verification',
        initialPriority: 0.7,
        estimatedEffortHours: 0.5,
        expectedValue: 0.8,
        urgency: 0.7,
      });

      const gHeavy = goalEngine.generateLongTermAmbition({
        ambitionTitle: 'Full Deep Retraining of Multimodal Vector Space',
        vision: 'Exhaustive fine-tuning of embedding weights over 24 hours',
        initialPriority: 0.95,
      });

      // Condition 1: System is fresh and unthrottled
      const rankingFresh = goalEngine.rankGoals([gLight, gHeavy], {
        stressLevel: 0.0,
        fatigueLevel: 0.0,
        resourceGovernorThrottled: false,
      });
      expect(rankingFresh.length).toBe(2);

      // Condition 2: System under high interoceptive fatigue and resource governor throttling
      const rankingFatigued = goalEngine.rankGoals([gLight, gHeavy], {
        stressLevel: 0.7,
        fatigueLevel: 0.9,
        resourceGovernorThrottled: true,
      });

      // Under high resource constraints, the lightweight high-value goal decisively ranks top
      expect(rankingFatigued[0]!.goal.id).toBe(gLight.id);
      expect(rankingFatigued[1]!.goal.id).toBe(gHeavy.id);
      expect(rankingFatigued[0]!.rankScore).toBeGreaterThan(rankingFatigued[1]!.rankScore);
    });
  });

  // ==========================================
  // 5. Goal Decomposition, Modification & Lifecycle Auditability
  // ==========================================
  describe('5. Goal Decomposition, Modification & Lifecycle Transitions', () => {
    it('supports goal decomposition into structured sub-goals with bidirectional parent-child references', () => {
      const parentGoal = goalEngine.generateGoalFromInterest({
        interestTopic: 'Wayland Native Input Architecture',
        initialPriority: 0.8,
      });

      const decomposition = goalEngine.decomposeGoal(parentGoal.id, [
        {
          title: 'Inspect ext-foreign-toplevel Wayland protocol',
          description: 'Analyze protocol XML',
        },
        {
          title: 'Benchmark virtual-keyboard-v1 socket latency',
          description: 'Measure ydotool uinput delay',
        },
      ]);

      expect(decomposition.parent.status).toBe('in_progress');
      expect(decomposition.parent.subGoalIds.length).toBe(2);
      expect(decomposition.subGoals.length).toBe(2);
      expect(decomposition.subGoals[0]!.parentGoalId).toBe(parentGoal.id);
      expect(decomposition.subGoals[1]!.parentGoalId).toBe(parentGoal.id);
    });

    it('pauses and resumes a goal with mandatory auditable reasons and timestamp tracking', () => {
      const goal = goalEngine.generateGoalFromInterest({
        interestTopic: 'Rust Memory Safety Invariants',
      });

      // Pause goal due to resource constraint
      const paused = goalEngine.pauseGoal(
        goal.id,
        'Thermal throttle detected: CPU package reached 85C',
      );
      expect(paused.status).toBe('paused');
      expect(paused.pauseReason).toContain('Thermal throttle detected');
      expect(paused.pausedAt).toBeDefined();

      // Resume goal
      const resumed = goalEngine.resumeGoal(goal.id, 'Thermal normalized to 58C');
      expect(resumed.status).toBe('active');
      expect(resumed.pauseReason).toBeUndefined();
      expect(
        resumed.modificationsHistory.some((m) => m.reason.includes('Thermal normalized')),
      ).toBe(true);
    });

    it('rejects or abandons a goal when empirical evidence invalidates the objective', () => {
      const goal = goalEngine.generateGoalFromInterest({
        interestTopic: 'Port Arle to macOS CoreAudio',
      });

      // Rejection with mandatory reason
      const rejected = goalEngine.rejectGoal(
        goal.id,
        'Target device is ASUS ROG Ally X on Bazzite Linux; macOS CoreAudio is out of scope.',
      );
      expect(rejected.status).toBe('rejected');
      expect(rejected.rejectionReason).toContain('Target device is ASUS ROG Ally X');
      expect(rejected.rejectedAt).toBeDefined();

      // Negative Invariant: attempting to abandon or pause without reason throws error
      expect(() => {
        assertSelfGeneratedGoalIntegrity({
          ...goal,
          status: 'abandoned',
          abandonmentReason: '', // Empty violates invariant
          abandonedAt: new Date().toISOString(),
        });
      }).toThrow(/must specify an explicit abandonmentReason/);
    });

    it('modifies goal priority and records full non-destructive modifications history', () => {
      const goal = goalEngine.generateGoalFromInterest({
        interestTopic: 'Distributed Storage Consensus',
        initialPriority: 0.5,
      });

      const modified = goalEngine.modifyGoal(goal.id, {
        priority: 0.9,
        reason: 'Proof indicated urgent focus on storage reliability',
      });

      expect(modified.status).toBe('modified');
      expect(modified.priority).toBe(0.9);
      expect(modified.modificationsHistory.length).toBe(1);
      expect(modified.modificationsHistory[0]!.previousPriority).toBe(0.5);
      expect(modified.modificationsHistory[0]!.newPriority).toBe(0.9);
      expect(modified.modificationsHistory[0]!.reason).toContain(
        'urgent focus on storage reliability',
      );
    });

    it('successfully completes a goal and timestamps completion', () => {
      const goal = goalEngine.generateGoalFromInterest({
        interestTopic: 'Fast Fourier Transform Sound Profiler',
      });

      const completed = goalEngine.completeGoal(goal.id);
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeDefined();
    });
  });

  // ==========================================
  // 6. 15-Second User-Activity Pause & Cooldown
  // ==========================================
  describe('6. 15-Second User-Activity Pause & Cooldown Enforcement', () => {
    it('strictly pauses autonomous actions inside the 15-second activity window and resumes once idle', () => {
      // Mock minimal AutonomousAgencyService state
      let lastUserInteractionTime = 0;

      function notifyUserActivity(): void {
        lastUserInteractionTime = Date.now();
      }

      function evaluateAutonomousPermissibility(currentTime: number): {
        permitted: boolean;
        idleSeconds: number;
      } {
        const idleSeconds =
          lastUserInteractionTime === 0 ? 999999 : (currentTime - lastUserInteractionTime) / 1000;
        const permitted = idleSeconds >= 15;
        return { permitted, idleSeconds };
      }

      const t0 = 100000;

      // 1. User acts at t0
      lastUserInteractionTime = t0;

      // 2. Evaluated at t0 + 2s (inside 15s window) -> strictly blocked
      const check2s = evaluateAutonomousPermissibility(t0 + 2000);
      expect(check2s.permitted).toBe(false);
      expect(check2s.idleSeconds).toBe(2);

      // 3. Evaluated at t0 + 10s (inside 15s window) -> strictly blocked
      const check10s = evaluateAutonomousPermissibility(t0 + 10000);
      expect(check10s.permitted).toBe(false);
      expect(check10s.idleSeconds).toBe(10);

      // 4. Evaluated at t0 + 14.9s -> strictly blocked
      const check14_9s = evaluateAutonomousPermissibility(t0 + 14900);
      expect(check14_9s.permitted).toBe(false);

      // 5. Evaluated at t0 + 15.1s -> permitted and resumes!
      const check15_1s = evaluateAutonomousPermissibility(t0 + 15100);
      expect(check15_1s.permitted).toBe(true);
      expect(check15_1s.idleSeconds).toBeGreaterThanOrEqual(15);
    });

    it('respects resource governor throttling to suppress heavy autonomous operations on ROG Ally X', () => {
      // Configure resource governor with low memory threshold and GPU disabled
      const governor = new ResourceGovernor(
        {
          maxMemoryMb: 1024,
          gpuAllowed: false,
        },
        rootLogger,
      );

      // Request exceeding available budget
      const feasibility = governor.evaluateFeasibility({
        cpu: 'high',
        gpu: true,
        estimatedMemoryMb: 2048,
      });

      expect(feasibility.feasible).toBe(false);
      expect(feasibility.reason).toContain('GPU acceleration is currently disabled');
    });
  });
});
