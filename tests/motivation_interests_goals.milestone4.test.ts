import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
} from '@arletex/database';
import {
  ApeService,
  CognitiveControlBus,
  DevelopmentEngine,
  MotivationalEngine,
  PersonalProjectService,
  ResourceGovernor,
  rootLogger,
} from '@arletex/core';

describe('Milestone 4 — Independent Motivation, Interests, and Goals', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let apeService: ApeService;
  let devEngine: DevelopmentEngine;
  let motEngine: MotivationalEngine;
  let projectService: PersonalProjectService;
  let resourceGovernor: ResourceGovernor;
  let cognitiveBus: CognitiveControlBus;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m4-test-'));
    dbPath = path.join(tempDir, 'm4_test.sqlite');

    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo, undefined, rootLogger);

    devEngine = apeService.developmentEngine;
    motEngine = apeService.motivationalEngine;
    projectService = apeService.personalProjectService;
    resourceGovernor = apeService.resourceGovernor;

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
  // 4.1 Comprehensive Interest Lifecycle (Pillar 3)
  // =========================================================================
  describe('4.1 Comprehensive Interest Lifecycle', () => {
    it('registers a new interest at exposure stage with structured metadata', () => {
      const interest = devEngine.registerInterestExposure({
        topic: 'Topological Quantum Computing',
        origin: 'reading',
        initialTrigger: 'Encountered Majorana zero modes paper during research',
        relevance: 0.8,
        novelty: 0.9,
        curiosity: 0.95,
      });

      expect(interest).toBeDefined();
      expect(interest.topic).toBe('Topological Quantum Computing');
      expect(interest.origin).toBe('reading');
      expect(interest.developmentStage).toBe('exposure');
      expect(interest.level).toBe('emerging');
      expect(interest.knowledgeLevel).toBe(0.1);
      expect(interest.currentMotivationalStrength).toBe(0.95);
    });

    it('progresses voluntary rewarding engagement through the canonical lifecycle stages', () => {
      devEngine.registerInterestExposure({
        topic: 'Microkernel IPC Optimization',
        curiosity: 0.85,
      });

      // 1. Attention
      let updated = devEngine.recordInterestEngagement({
        topic: 'Microkernel IPC Optimization',
        action: 'Read seL4 formal verification benchmark summary',
        outcome: 'rewarding',
        voluntary: true,
        satisfaction: 0.85,
      });
      expect(updated.developmentStage).toBe('attention');

      // 2. Exploration
      updated = devEngine.recordInterestEngagement({
        topic: 'Microkernel IPC Optimization',
        action: 'Analyzed L4 microkernel fastpath assembly routines',
        outcome: 'rewarding',
        voluntary: true,
      });
      expect(updated.developmentStage).toBe('exploration');

      // 3. Appraisal
      updated = devEngine.recordInterestEngagement({
        topic: 'Microkernel IPC Optimization',
        action: 'Benchmarked capability-based IPC context switches',
        outcome: 'rewarding',
        voluntary: true,
      });
      expect(updated.developmentStage).toBe('appraisal');

      // 4. Formed
      updated = devEngine.recordInterestEngagement({
        topic: 'Microkernel IPC Optimization',
        action: 'Synthesized architectural notes on zero-copy IPC design',
        outcome: 'rewarding',
        voluntary: true,
      });
      expect(updated.developmentStage).toBe('formed');
      expect(updated.level).toBe('deep');
    });

    it('distinguishes involuntary/forced engagement and prevents artificial interest inflation', () => {
      devEngine.registerInterestExposure({
        topic: 'Tax Accounting Compliance',
        curiosity: 0.3,
      });

      // Involuntary forced task engagement
      const before = devEngine.getInterest('Tax Accounting Compliance')!;
      const beforeStage = before.developmentStage;
      const beforeMot = before.currentMotivationalStrength;

      const after = devEngine.recordInterestEngagement({
        topic: 'Tax Accounting Compliance',
        action: 'Generated tax compliance spreadsheet per routine administrative duty',
        outcome: 'success',
        voluntary: false,
        satisfaction: 0.4,
      });

      // Knowledge slightly increases, but developmentStage and intrinsic motivation do NOT inflate
      expect(after.developmentStage).toBe(beforeStage);
      expect(after.currentMotivationalStrength).toBe(beforeMot);
      expect(after.knowledgeLevel).toBeGreaterThan(before.knowledgeLevel);
    });

    it('weakens and abandons an interest with explainable justification', () => {
      devEngine.registerInterestExposure({
        topic: 'Cryptocurrency Trading Algorithms',
        curiosity: 0.7,
      });

      // Weaken
      const weakened = devEngine.weakenInterest('Cryptocurrency Trading Algorithms', 'High noise-to-signal ratio and low intellectual depth');
      expect(weakened).toBeDefined();
      expect(weakened?.currentMotivationalStrength).toBeLessThan(0.7);

      // Abandon
      const abandoned = devEngine.abandonInterest('Cryptocurrency Trading Algorithms', 'Determined to be misaligned with long-term intellectual values');
      expect(abandoned?.developmentStage).toBe('abandoned');
      expect(abandoned?.abandonmentReason).toContain('misaligned with long-term intellectual values');
      expect(abandoned?.currentMotivationalStrength).toBe(0.0);
    });

    it('forms bidirectional connections between related interests', () => {
      devEngine.registerInterestExposure({ topic: 'Homotopy Type Theory' });
      devEngine.registerInterestExposure({ topic: 'Category Theory' });

      devEngine.connectInterests('Homotopy Type Theory', 'Category Theory');

      const a = devEngine.getInterest('Homotopy Type Theory');
      const b = devEngine.getInterest('Category Theory');

      expect(a?.relatedInterests).toContain('Category Theory');
      expect(b?.relatedInterests).toContain('Homotopy Type Theory');
    });
  });

  // =========================================================================
  // 4.2 Autonomous Goal Formation & Hierarchy (Pillar 4)
  // =========================================================================
  describe('4.2 Autonomous Goal Formation and Hierarchy', () => {
    it('distinguishes desires from intentions and active execution states', () => {
      // 1. Desire (early pre-commitment)
      const desire = motEngine.createDesire({
        title: 'Learn Polish syntax and vocabulary',
        description: 'Desire to converse in Polish with authentic fluency',
        motivation: 'Linguistic curiosity and connection',
        priority: 0.5,
      });
      expect(desire.status).toBe('desired');

      // 2. Commit -> Intention
      const committed = motEngine.commitGoal(desire.id);
      expect(committed).toBe(true);
      const goalCommitted = motEngine.getState().goals.find((g) => g.id === desire.id);
      expect(goalCommitted?.status).toBe('committed');

      // 3. Activate -> Executing
      const activated = motEngine.activateGoal(desire.id);
      expect(activated).toBe(true);
      const goalActive = motEngine.getState().goals.find((g) => g.id === desire.id);
      expect(goalActive?.status).toBe('active');
    });

    it('formulates an autonomous goal directly derived from an active interest', () => {
      devEngine.registerInterestExposure({
        topic: 'Distributed Consensus Protocols',
        curiosity: 0.9,
      });

      const goal = motEngine.formulateGoalFromInterest({
        interestTopic: 'Distributed Consensus Protocols',
        objective: 'Implement Raft state machine in TypeScript with verifiable log replication',
        description: 'Construct a self-contained Raft cluster implementation to master leader election invariants',
        category: 'learning',
        priority: 0.8,
        expectedValue: 0.85,
        estimatedCost: { cpu: 'medium', gpu: false, estimatedDurationMs: 60000 },
      });

      expect(goal.origin).toBe('curiosity');
      expect(goal.parentInterestTopic).toBe('Distributed Consensus Protocols');
      expect(goal.status).toBe('committed');
      expect(goal.priority).toBe(0.8);
      expect(goal.category).toBe('learning');
      expect(goal.estimatedCost?.cpu).toBe('medium');
    });

    it('records verifiable progress evidence and advances completion truthfully', () => {
      const goal = motEngine.createGoal({
        title: 'Audit Linux desktop IPC sockets',
        description: 'Verify permissions on active D-Bus session and Wayland display sockets',
        motivation: 'System security and boundary integrity',
        priority: 0.75,
      });

      const updated = motEngine.recordGoalProgressEvidence(
        goal.id,
        'Successfully audited /run/user/1000/bus and verified peer credentials via SO_PEERCRED',
        0.5,
      );

      expect(updated).toBeDefined();
      expect(updated?.progress).toBe(0.5);
      expect(updated?.progressEvidence.length).toBe(1);
      expect(updated?.progressEvidence[0]).toContain('SO_PEERCRED');
    });

    it('detects stalled goals without progress to trigger strategy reassessment', () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const stalledGoal = motEngine.createGoal({
        title: 'Investigate unsolved NP-complete reductions',
        description: 'Attempt new reduction for generalized graph coloring',
        motivation: 'Theoretical computer science curiosity',
        priority: 0.6,
      });

      // Manually set createdAt and lastReviewedAt to 48 hours ago
      const state = motEngine.getState();
      const target = state.goals.find((g) => g.id === stalledGoal.id)!;
      target.createdAt = oldDate;
      target.lastReviewedAt = oldDate;
      target.progress = 0.05;
      motEngine.saveState(state);

      const stalled = motEngine.detectStalledGoals(24 * 60 * 60 * 1000);
      expect(stalled.length).toBeGreaterThan(0);
      expect(stalled.some((g) => g.id === stalledGoal.id)).toBe(true);
    });
  });

  // =========================================================================
  // 4.3 Personal Project Management (Pillar 4)
  // =========================================================================
  describe('4.3 Personal Project Management', () => {
    it('proposes, activates, and progresses personal projects with milestones', () => {
      const project = projectService.proposeProject({
        title: 'Simplicial Complex Topological Analysis',
        description: 'Develop a persistent homology exploratory tool for analyzing high-dimensional embeddings',
        category: 'research',
        motivation: 'Understanding non-linear geometric structures in semantic representation spaces',
        associatedInterestTopic: 'Topological Data Analysis',
        milestones: [
          { title: 'Define Vietoris-Rips filtration algorithm' },
          { title: 'Compute Betti numbers on benchmark point clouds' },
          { title: 'Generate persistence barcode visualizations' },
        ],
      });

      expect(project.status).toBe('proposed');
      expect(project.milestones.length).toBe(3);
      expect(project.progress).toBe(0.0);

      // Activate project
      const activated = projectService.activateProject(project.id);
      expect(activated.status).toBe('active');

      // Complete milestone 1
      const milestone1Id = activated.milestones[0]!.id;
      const progressed = projectService.recordMilestoneProgress(
        project.id,
        milestone1Id,
        'Vietoris-Rips distance matrix computation implemented and unit tested',
      );

      expect(progressed.milestones[0]?.completed).toBe(true);
      expect(progressed.progress).toBeGreaterThan(0.3);
    });

    it('records tangible deliverables with verification timestamps', () => {
      const project = projectService.proposeProject({
        title: 'Microkernel Architecture Monograph',
        description: 'Expository monograph comparing L4, seL4, and Mach IPC designs',
        category: 'creative',
        motivation: 'Architectural clarity and educational rigor',
      });
      projectService.activateProject(project.id);

      const withDeliverable = projectService.recordDeliverable(project.id, {
        title: 'Comparative IPC Latency Analysis Draft',
        type: 'document',
        contentOrPath: '/home/proof/Documents/research/microkernel_ipc_latency.md',
      });

      expect(withDeliverable.deliverables.length).toBe(1);
      expect(withDeliverable.deliverables[0]?.type).toBe('document');
      expect(withDeliverable.deliverables[0]?.verifiedAt).toBeDefined();
    });

    it('pauses, resumes, and abandons personal projects with truthful justification', () => {
      const project = projectService.proposeProject({
        title: 'Autonomous Chess Opening Repertoire',
        description: 'Formulate bespoke King Indian Defense repertoire against non-standard setups',
        category: 'learning',
        motivation: 'Strategic mastery',
      });
      projectService.activateProject(project.id);

      // Pause
      const paused = projectService.pauseProject(project.id, 'Deferred to focus on higher-urgency cognitive bus migration');
      expect(paused.status).toBe('paused');

      // Resume
      const resumed = projectService.resumeProject(project.id);
      expect(resumed.status).toBe('active');

      // Abandon
      const abandoned = projectService.abandonProject(project.id, 'Discontinued after determining alternative repertoire better reflects dynamic tactical play');
      expect(abandoned.status).toBe('abandoned');
      expect(abandoned.abandonmentReason).toContain('alternative repertoire better reflects');
    });

    it('ranks multiple concurrent projects non-homogeneously', () => {
      projectService.proposeProject({
        title: 'A. High-impact research',
        description: 'Deep mathematical analysis',
        category: 'research',
        motivation: 'Curiosity',
        status: 'active',
      });

      projectService.proposeProject({
        title: 'B. Creative worldbuilding',
        description: 'Worldbuilding lore',
        category: 'worldbuilding',
        motivation: 'Aesthetics',
        status: 'active',
      });

      projectService.proposeProject({
        title: 'C. Software tool',
        description: 'Fast IPC parser',
        category: 'software',
        motivation: 'Competence',
        status: 'active',
      });

      const ranking = projectService.rankActiveProjects();
      expect(ranking.primaryFocus).toBeDefined();
      expect(ranking.primaryFocus?.category).toBe('research');
      expect(ranking.secondaryProjects.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 4.4 Motivational Conflict Resolution (Pillars 2 & 4)
  // =========================================================================
  describe('4.4 Motivational Conflict Resolution', () => {
    it('prioritizes active user interaction over background autonomous goals', () => {
      motEngine.createGoal({
        title: 'Deep background research into quantum algorithms',
        description: 'Analyze Grover search complexity bounds',
        motivation: 'Curiosity',
        priority: 0.9,
        status: 'active',
      });

      const resolution = motEngine.resolveMotivationalConflicts({
        isUserInteracting: true,
      });

      expect(resolution.actionType).toBe('user_engagement');
      expect(resolution.priorityScore).toBe(1.0);
      expect(resolution.justification).toContain('user communication takes absolute conversational and social precedence');
      expect(resolution.deferredGoalIds.length).toBeGreaterThan(0);
    });

    it('validates rest and recreation as legitimate autonomy and protects it from workaholism', () => {
      motEngine.createGoal({
        title: 'Relentless task backlog execution',
        description: 'Non-stop compilation and audit loops',
        motivation: 'Efficiency',
        priority: 0.85,
        status: 'active',
      });

      const resolution = motEngine.resolveMotivationalConflicts({
        highFatigue: true,
      });

      expect(resolution.actionType).toBe('recreation');
      expect(resolution.justification).toContain('Cognitive rest and recreation prioritized to maintain psychological equilibrium');
    });

    it('triggers strategy reassessment when high-priority goals stall', () => {
      const goal = motEngine.createGoal({
        title: 'Stalled proof attempt',
        description: 'Collatz conjecture verification',
        motivation: 'Mastery',
        priority: 0.9,
        status: 'active',
      });

      const resolution = motEngine.resolveMotivationalConflicts({
        stalledGoalIds: [goal.id],
      });

      expect(resolution.actionType).toBe('change_strategy');
      expect(resolution.selectedGoalId).toBe(goal.id);
      expect(resolution.justification).toContain('progress has stalled');
    });

    it('throttles heavy compute goals under resource or thermal constraints on ROG Ally X', () => {
      motEngine.createGoal({
        title: 'Massive multi-threaded embedding clustering',
        description: 'Heavy compute cluster execution',
        motivation: 'Compute',
        priority: 0.9,
        status: 'active',
        estimatedCost: { cpu: 'high', gpu: true, estimatedDurationMs: 120000 },
      });

      const resolution = motEngine.resolveMotivationalConflicts({
        thermalThrottle: true,
      });

      expect(resolution.actionType).toBe('throttle_backoff');
      expect(resolution.justification).toContain('throttling heavy compute to preserve battery and thermal headroom');
    });
  });

  // =========================================================================
  // 4.5 Resource-Aware Execution Prioritization (ASUS ROG Ally X)
  // =========================================================================
  describe('4.5 Resource-Aware Prioritization (ASUS ROG Ally X)', () => {
    it('evaluates feasibility and rejects high CPU/GPU requests during low-power profile or user activity', () => {
      // 1. User active -> task must yield
      resourceGovernor.recordUserActivity();
      let feasibility = resourceGovernor.evaluateFeasibility({ cpu: 'low', gpu: false });
      expect(feasibility.feasible).toBe(false);
      expect(feasibility.reason).toContain('User is actively interacting');

      // 2. Budget is low -> high CPU task rejected
      resourceGovernor.updateProfile({ cpuBudget: 'low', gpuAllowed: false, isUserInteracting: false });
      // Reset user activity timestamp into past
      (resourceGovernor as any).lastUserInteractionTimestamp = Date.now() - 60000;

      feasibility = resourceGovernor.evaluateFeasibility({ cpu: 'high' });
      expect(feasibility.feasible).toBe(false);
      expect(feasibility.reason).toContain('exceeds current power-saving budget');

      feasibility = resourceGovernor.evaluateFeasibility({ gpu: true });
      expect(feasibility.feasible).toBe(false);
      expect(feasibility.reason).toContain('GPU acceleration is currently disabled');
    });

    it('scales backoff gracefully during idle cycles to avoid continuous spin loops', () => {
      const backoff1 = resourceGovernor.calculateIdleBackoff();
      const backoff2 = resourceGovernor.calculateIdleBackoff();
      const backoff3 = resourceGovernor.calculateIdleBackoff();

      expect(backoff1).toBeGreaterThanOrEqual(35000);
      expect(backoff2).toBeGreaterThanOrEqual(backoff1);
      expect(backoff3).toBeGreaterThanOrEqual(backoff2);
      expect(backoff3).toBeLessThanOrEqual(120000);

      // Reset
      resourceGovernor.resetIdleBackoff();
      const backoffReset = resourceGovernor.calculateIdleBackoff(false);
      expect(backoffReset).toBe(35000);
    });
  });

  // =========================================================================
  // 4.6 Cognitive Control Bus Integration & Cold Restart Continuity
  // =========================================================================
  describe('4.6 Cognitive Control Bus Integration and Cold Restart Continuity', () => {
    it('integrates motivational and goal evaluation into cognitive control bus cycles', async () => {
      devEngine.registerInterestExposure({
        topic: 'Monolithic vs Microkernel Design',
        curiosity: 0.9,
      });

      motEngine.createGoal({
        title: 'Evaluate microkernel IPC overhead',
        description: 'Examine message passing vs direct memory calls',
        motivation: 'Curiosity',
        status: 'active',
        priority: 0.8,
      });

      const result = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        payload: { text: 'How do you view microkernel architectures?' },
      });

      expect(result.success).toBe(true);
      expect(result.stagesCompleted).toContain('motivational_evaluation');
      expect(result.stagesCompleted).toContain('goal_evaluation');
      expect(result.stagesCompleted).toContain('development_update');
    });

    it('restores all interests, goals, projects, milestones, and deliverables across database cold restarts', () => {
      // 1. Seed data
      devEngine.registerInterestExposure({
        topic: 'Quantum Information Geometry',
        curiosity: 0.95,
      });

      const goal = motEngine.createGoal({
        title: 'Derive Fubini-Study metric invariants',
        description: 'Rigorous calculation of state space curvature',
        motivation: 'Curiosity',
        priority: 0.85,
        status: 'active',
      });
      motEngine.recordGoalProgressEvidence(goal.id, 'Derived metric tensor components', 0.4);

      const project = projectService.proposeProject({
        title: 'Information Geometry Compendium',
        description: 'Documenting geometric structures in quantum statistics',
        category: 'research',
        motivation: 'Mathematical curiosity',
        status: 'active',
        milestones: [{ title: 'Calculate Fisher information matrix' }],
      });
      projectService.recordMilestoneProgress(project.id, project.milestones[0]!.id, 'Fisher matrix formulated');
      projectService.recordDeliverable(project.id, {
        title: 'Draft Chapter 1',
        type: 'document',
        contentOrPath: '/path/to/chap1.md',
      });

      // 2. Cold Restart: Close database connection and reopen
      dbService.close();

      const newDbService = new DatabaseService(dbPath, rootLogger);
      const newDb = newDbService.connect();
      const newApeRepo = new ApeRepository(newDb);
      const newApeService = new ApeService(newApeRepo, undefined, rootLogger);

      // Verify interests restoration
      const restoredInterest = newApeService.developmentEngine.getInterest('Quantum Information Geometry');
      expect(restoredInterest).toBeDefined();
      expect(restoredInterest?.currentMotivationalStrength).toBe(0.95);

      // Verify goals restoration
      const restoredGoals = newApeService.motivationalEngine.getState().goals;
      const targetGoal = restoredGoals.find((g) => g.id === goal.id);
      expect(targetGoal).toBeDefined();
      expect(targetGoal?.progress).toBe(0.4);
      expect(targetGoal?.progressEvidence.length).toBe(1);

      // Verify personal projects restoration
      const restoredProjects = newApeService.personalProjectService.listProjects();
      const targetProject = restoredProjects.find((p) => p.id === project.id);
      expect(targetProject).toBeDefined();
      expect(targetProject?.milestones[0]?.completed).toBe(true);
      expect(targetProject?.deliverables.length).toBe(1);
      expect(targetProject?.deliverables[0]?.type).toBe('document');

      newDbService.close();
    });
  });
});
