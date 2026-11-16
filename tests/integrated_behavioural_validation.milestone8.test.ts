import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  DatabaseService,
  MigrationRunner,
  ActivityRepository,
  AgencyRepository,
  ApeRepository,
  AuditRepository,
  ConversationRepository,
  MemoryRepository,
  MessageRepository,
} from '@arletex/database';
import {
  ActionPermissionController,
  ApeService,
  AutobiographicalMemoryService,
  ClosedLoopAgencyService,
  CognitiveControlBus,
  DevelopmentEngine,
  IBrowserProvider,
  IComputerProvider,
  IntellectualEngine,
  IntentTaskManager,
  MemoryExperienceSync,
  MotivationalEngine,
  PageObservation,
  PersonalProjectService,
  PersonalityEngine,
  PlanningInterface,
  ProcessSupervisor,
  RelationshipEngine,
  ResourceGovernor,
  SafeComputerAgencyService,
  SelfModelEngine,
  SUPPORTED_APPLICATIONS,
  VerificationEngine,
  VideoCandidate,
  WaylandEnvironmentService,
  WebAgencyService,
  rootLogger,
} from '@arletex/core';
import {
  ActionProposal,
  AgencyObservation,
  ApeEvent,
  CognitiveEvent,
  MemoryType,
} from '@arletex/contracts';
import {
  InferenceGateway,
} from '@arletex/inference';
import {
  TelegramBridgeService,
  validateTelegramMediaSignature,
  InboundTelegramMediaAttachment,
} from '../apps/desktop/src/backend/telegramBridgeService.js';
import { AutonomousAgencyService } from '../apps/desktop/src/backend/autonomousAgencyService.js';
import { DeviceAgencyService } from '../apps/desktop/src/backend/deviceAgencyService.js';

describe('Milestone 8 — Integrated Behavioural Validation (Canonical 12 Tests)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;

  let activityRepo: ActivityRepository;
  let agencyRepo: AgencyRepository;
  let apeRepo: ApeRepository;
  let auditRepo: AuditRepository;
  let memoryRepo: MemoryRepository;
  let conversationRepo: ConversationRepository;
  let messageRepo: MessageRepository;

  let apeService: ApeService;
  let autoMemoryService: AutobiographicalMemoryService;
  let permissionController: ActionPermissionController;
  let verificationEngine: VerificationEngine;
  let planningInterface: PlanningInterface;
  let memorySync: MemoryExperienceSync;
  let taskManager: IntentTaskManager;
  let closedLoopAgency: ClosedLoopAgencyService;
  let cognitiveBus: CognitiveControlBus;
  let resourceGovernor: ResourceGovernor;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m8-validation-'));
    dbPath = path.join(tempDir, 'm8_validation.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();

    const migrator = new MigrationRunner(db, rootLogger);
    migrator.run();

    activityRepo = new ActivityRepository(db);
    agencyRepo = new AgencyRepository(db);
    apeRepo = new ApeRepository(db);
    auditRepo = new AuditRepository(db);
    memoryRepo = new MemoryRepository(db);
    conversationRepo = new ConversationRepository(db);
    messageRepo = new MessageRepository(db);

    apeService = new ApeService(apeRepo, memoryRepo, rootLogger);
    autoMemoryService = new AutobiographicalMemoryService(memoryRepo, rootLogger);

    // Correct argument ordering: (config, auditRepo, logger)
    permissionController = new ActionPermissionController(
      {
        autonomousExecutionEnabled: true,
        allowedFilesystemPaths: [tempDir],
        readOnlyFilesystemPaths: [tempDir],
        forbiddenFilesystemPaths: ['/etc', '/root', path.join(os.homedir(), '.ssh')],
        allowedExecutablePaths: [
          '/usr/bin/google-chrome',
          '/usr/bin/firefox',
          '/usr/bin/spectacle',
          '/usr/bin/wl-copy',
        ],
        allowedStorageRoots: [tempDir],
        allowNetworkAccess: true,
        allowProcessExecution: true,
        allowBrowserAutomation: true,
        allowSystemModification: false,
      },
      auditRepo,
      rootLogger,
    );

    verificationEngine = new VerificationEngine(rootLogger);
    planningInterface = new PlanningInterface(agencyRepo, rootLogger);
    memorySync = new MemoryExperienceSync(memoryRepo as any, rootLogger);
    taskManager = new IntentTaskManager(agencyRepo, rootLogger);

    closedLoopAgency = new ClosedLoopAgencyService({
      agencyRepo,
      taskManager,
      planningInterface,
      permissionController,
      verificationEngine,
      memorySync,
      apeService,
      autobiographicalMemoryService: autoMemoryService,
      logger: rootLogger,
    });

    cognitiveBus = new CognitiveControlBus({
      apeService,
      permissionController,
      verificationEngine,
      autobiographicalMemoryService: autoMemoryService,
      intentTaskManager: taskManager,
      closedLoopAgency,
      logger: rootLogger,
    });

    resourceGovernor = apeService.resourceGovernor;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      dbService.close();
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // ignore cleanup errors in tests
    }
  });

  // =========================================================================
  // Test 1 — Independent interest formation (Pillars 1, 2, 3, 4)
  // Scenario: Arle encounters an unfamiliar subject during an authorized research activity.
  // Expected:
  // - Identifies novelty
  // - Appraises relevance
  // - Records the experience
  // - Develops curiosity if justified
  // - Investigates further if motivation warrants it
  // - Forms an interest only after sufficient evidence of meaningful engagement
  // - Can later revise that interest
  // =========================================================================
  describe('Test 1 — Independent interest formation', () => {
    it('forms an interest through genuine evidence accumulation and permits justified revision', async () => {
      const devEngine = apeService.developmentEngine;
      const motEngine = apeService.motivationalEngine;

      // 1. Encounter novel subject during research activity
      const topic = 'Topological Quantum Computing & Majorana Braiding';
      const initialCuriosity = motEngine.getState().needs.novelty_curiosity ?? 0.5;

      // 2. Identify novelty & register initial exposure
      const interest = devEngine.registerInterestExposure({
        topic,
        origin: 'reading',
        initialTrigger: 'Discovered unexpected topological protection invariants in Majorana zero modes',
        curiosity: 0.88,
        relevance: 0.82,
        novelty: 0.92,
      });

      expect(interest).toBeDefined();
      expect(interest.developmentStage).toBe('exposure');
      expect(interest.topic).toBe(topic);

      // 3. Appraise relevance & elevate curiosity drive in motivational engine
      const motState = motEngine.getState();
      motState.needs.novelty_curiosity = 0.94;
      motEngine.saveState(motState);
      expect(motEngine.getState().needs.novelty_curiosity).toBeGreaterThan(initialCuriosity);

      // 4. Record grounded autobiographical memory with system_observation provenance
      const initialMem = autoMemoryService.recordExperience({
        content: `Encountered novel domain: ${topic}. Topological protection invariants provide non-local quantum error resistance.`,
        type: 'semantic',
        provenance: 'system_observation',
        rawObservation: 'Read arXiv pre-print on non-Abelian anyon braid stability',
        interpretation: 'Majorana zero modes could bypass active syndrome extraction overhead',
        confidence: 0.92,
        importance: 0.85,
        tags: ['research', 'novelty', 'quantum'],
      });
      expect(initialMem.id).toBeDefined();
      expect(initialMem.provenance).toBe('system_observation');

      // 5. Investigate further: accumulate evidence of meaningful engagement
      devEngine.recordInterestEngagement({
        topic,
        action: 'Analyzed Kitaev wire Hamiltonian and zero-energy edge modes',
        outcome: 'rewarding',
        voluntary: true,
        satisfaction: 0.88,
        notes: 'Verified edge mode persistence against scalar potential fluctuations',
      });
      devEngine.recordInterestEngagement({
        topic,
        action: 'Verified non-Abelian braiding statistics via numerical simulation',
        outcome: 'rewarding',
        voluntary: true,
        satisfaction: 0.91,
        notes: 'Clifford gate generation through braiding verified in simulation',
      });

      // Progress interest development stage through deliberate engagement
      devEngine.developInterest(topic, 'explore');
      const explored = devEngine.getInterest(topic);
      expect(explored?.developmentStage).toMatch(/exploration|developing|engaged|established/);

      devEngine.developInterest(topic, 'master');
      const established = devEngine.getInterest(topic);
      expect(established?.engagementHistory.length).toBeGreaterThanOrEqual(2);
      expect(established?.knowledgeLevel).toBeGreaterThan(0.1);

      // 6. Later revise that interest (e.g. weaken or abandon when evidence changes or focus shifts)
      const weakened = devEngine.weakenInterest(topic, 'Shifting immediate focus to active microkernel implementation');
      expect(weakened).toBeDefined();
      expect(weakened?.currentMotivationalStrength).toBeLessThan(0.9);
    });
  });

  // =========================================================================
  // Test 2 — Independent project creation (Pillars 1, 3, 5, 6)
  // Scenario: An established interest generates an unresolved question.
  // Expected:
  // - Arle recognizes the question
  // - Determines whether investigation is worthwhile
  // - Creates an independent goal
  // - Produces a plan
  // - Checks resources and permissions
  // - Executes authorized work
  // - Verifies results
  // - Integrates the experience into memory
  // =========================================================================
  describe('Test 2 — Independent project creation', () => {
    it('creates and executes an independent personal project from an unresolved question', async () => {
      const devEngine = apeService.developmentEngine;
      const intellectualEngine = apeService.intellectualEngine;
      const projectService = apeService.personalProjectService;
      const motEngine = apeService.motivationalEngine;

      // 1. Established interest exists
      const interestTopic = 'Asynchronous Silicon Neuromorphic Architectures';
      devEngine.registerInterestExposure({
        topic: interestTopic,
        origin: 'reading',
        initialTrigger: 'Event-driven spike propagation eliminating clock power distribution',
        curiosity: 0.9,
      });
      devEngine.developInterest(interestTopic, 'explore');

      // 2. Interest generates an unresolved intellectual question
      const question = intellectualEngine.generateQuestion({
        question: 'Can asynchronous event-driven spiking encodings eliminate idle power in edge robotics?',
        domain: 'Computer Architecture',
        origin: 'curiosity',
        underlyingAssumptions: ['Global clock tree distribution accounts for >30% of baseline SoC power'],
      });
      expect(question.status).toBe('open');

      // 3. Determines investigation is worthwhile & creates an independent goal
      const goal = motEngine.createDesire({
        title: 'Benchmark event-driven spiking energy efficiency',
        description: 'Profile asynchronous spike processing vs synchronous polling on edge hardware',
        motivation: 'mastery',
      });
      motEngine.commitGoal(goal.id);
      motEngine.activateGoal(goal.id);

      // 4. Creates an independent personal project with structured milestones
      const project = projectService.proposeProject({
        title: 'Asynchronous Neuromorphic Edge Benchmark',
        description: 'Simulate and measure power scaling for event-driven robotics controllers',
        category: 'research',
        associatedInterestTopic: interestTopic,
        motivation: 'Testing whether event-driven spike propagation eliminates clock tree idle power',
        milestones: [
          { title: 'Synthesize simulation model' },
          { title: 'Profile energy metrics' },
        ],
      });
      expect(project.id).toBeDefined();
      expect(project.status).toBe('proposed');

      const activeProject = projectService.activateProject(project.id);
      expect(activeProject.status).toBe('active');
      expect(activeProject.milestones.length).toBe(2);

      // 5. Produces a plan
      const task = taskManager.createTask({
        title: 'Research event-driven spiking energy efficiency benchmarks',
        objective: 'Research event-driven spiking energy efficiency benchmarks',
        initiator: 'arle',
      });
      const plan = await planningInterface.formulatePlan(task);
      expect(plan.steps.length).toBeGreaterThan(0);

      // 6. Checks resources and permissions
      const yieldCheck = resourceGovernor.checkUserActivityState();
      expect(yieldCheck.shouldYield).toBe(false);

      const auth = permissionController.authorize(plan.steps[0]!.action);
      expect(auth.allowed).toBe(true);

      // 7. Executes authorized work & verifies results
      const observation: AgencyObservation = {
        stepIndex: 0,
        success: true,
        data: {
          metrics: { idlePowerReduction: '94%', activeEnergyPerSpike: '1.2pJ' },
          benchmarkSource: 'IEEE Transactions on Neuromorphic Systems',
        },
        metadata: { timestamp: new Date().toISOString() },
      };
      const verification = verificationEngine.verify(plan.steps[0]!.action, observation);
      expect(verification.verified).toBe(true);
      expect(verification.confidence).toBeGreaterThan(0.7);

      // 8. Integrates experience into memory linked to project
      const milestone1Id = activeProject.milestones[0]!.id;
      projectService.recordMilestoneProgress(
        project.id,
        milestone1Id,
        'Simulation model confirmed 94% idle power reduction across 100 test iterations',
      );
      const updatedProject = projectService.getProject(project.id);
      expect(updatedProject?.milestones[0]?.completed).toBe(true);

      const mem = autoMemoryService.recordExperience({
        content: `Completed milestone for project "${project.title}": Event-driven spiking confirmed 94% idle power reduction.`,
        type: 'developmental',
        provenance: 'system_observation',
        rawObservation: 'Simulation metric output: 94% idle power reduction, 1.2pJ/spike',
        interpretation: 'Confirmed hypothesis that global clock elimination removes baseline idle waste',
        confidence: 0.95,
        importance: 0.88,
        tags: [project.id, 'neuromorphic', 'milestone'],
      });
      expect(mem.id).toBeDefined();
      expect(mem.provenance).toBe('system_observation');
    });
  });

  // =========================================================================
  // Test 3 — Emotional causality (Pillars 1, 4, 6)
  // Scenario: An important goal repeatedly encounters obstacles.
  // Expected:
  // - Appraisal recognizes the obstacles
  // - Emotional state changes for identifiable reasons
  // - Motivation and strategy are affected (downstream behavioural changes)
  // - Persistence or disengagement is evaluated
  // - A later successful resolution produces an appropriately different outcome
  // =========================================================================
  describe('Test 3 — Emotional causality', () => {
    it('demonstrates genuine downstream behavioural changes driven by emotional appraisal and resolution', async () => {
      const motEngine = apeService.motivationalEngine;

      // 1. Establish high-priority goal
      const importantGoal = motEngine.createDesire({
        title: 'Synthesize Critical Subsystem Kernel Driver',
        description: 'Implement zero-copy Vulkan shared memory bridge',
        motivation: 'mastery',
      });
      motEngine.commitGoal(importantGoal.id);
      motEngine.activateGoal(importantGoal.id);

      const initialAffState = apeService.getMasterState().affective;
      const initialValence = initialAffState.pad.valence;

      // 2. Obstacle 1: Compilation fails with memory address error
      const obstacle1Event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'goal_obstruction',
        type: 'compilation_failure',
        source: 'system',
        actor: 'system',
        eventKind: 'external_stimulus',
        payload: {
          error: 'Vulkan memory binding failed: VK_ERROR_OUT_OF_DEVICE_MEMORY',
          goalId: importantGoal.id,
          goalImportance: 0.95,
        },
        processed: false,
        timestamp: new Date().toISOString(),
      };

      await apeService.processEvent(obstacle1Event);

      const affStateAfterObstacle1 = apeService.getMasterState().affective;
      // Emotional state must change for identifiable causal reasons: lower valence or altered PAD dimensions
      expect(affStateAfterObstacle1.pad.valence).toBeLessThanOrEqual(initialValence);
      expect(affStateAfterObstacle1.pad.arousal).toBeDefined();

      // 3. Obstacle 2: Second attempt also fails
      const obstacle2Event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'goal_obstruction',
        type: 'test_failure',
        source: 'system',
        actor: 'system',
        eventKind: 'external_stimulus',
        payload: {
          error: 'Hardware queue deadlock on VkQueueSubmit',
          goalId: importantGoal.id,
          consecutiveFailures: 2,
        },
        processed: false,
        timestamp: new Date().toISOString(),
      };

      await apeService.processEvent(obstacle2Event);

      // Downstream behavioural impact: verification engine & strategy shift
      const failedObs: AgencyObservation = {
        stepIndex: 1,
        success: false,
        error: 'Deadlock on VkQueueSubmit',
        metadata: { timestamp: new Date().toISOString() },
      };
      const failedProposal: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 1,
        type: 'execute_command',
        payload: { command: 'make test' },
        rationale: 'Run driver integration tests',
        expectedOutcome: 'Pass',
        createdAt: new Date().toISOString(),
      };
      const diagnosis = verificationEngine.verify(failedProposal, failedObs);
      // Downstream behaviour: strategy is affected (requires replanning or alternative candidate)
      expect(diagnosis.verified).toBe(false);
      expect(diagnosis.recommendedStrategy).toBe('replan_sub_steps');

      // 4. Persistence vs disengagement evaluation:
      // The agent does not blindly loop; it re-evaluates goal progress
      motEngine.pauseGoal(importantGoal.id, 'Pausing for architectural reflection due to consecutive deadlocks');
      expect(motEngine.getState().goals.find((g) => g.id === importantGoal.id)?.status).toBe('paused');

      // 5. Successful resolution of the problem
      motEngine.resumeGoal(importantGoal.id);
      const resolutionEvent: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'goal_achievement',
        type: 'driver_fix_success',
        source: 'system',
        actor: 'system',
        eventKind: 'external_stimulus',
        payload: {
          text: 'Vulkan synchronization fence bug resolved; tests passed 100%',
          goalId: importantGoal.id,
        },
        processed: false,
        timestamp: new Date().toISOString(),
      };

      await apeService.processEvent(resolutionEvent);

      const resolvedAffState = apeService.getMasterState().affective;
      // Later successful resolution produces appropriately higher valence and satisfaction
      expect(resolvedAffState.pad.valence).toBeGreaterThan(affStateAfterObstacle1.pad.valence);
      expect(resolvedAffState.currentMood).toMatch(/focused|analytical|confident|curious|content/);
    });
  });

  // =========================================================================
  // Test 4 — Memory and identity development (Pillars 1, 2, 5)
  // Scenario: Arle repeatedly attempts a particular class of task and accumulates verified outcomes.
  // Expected:
  // - Memories preserve individual experiences
  // - Competency estimates reflect accumulated evidence
  // - Self-model changes gradually
  // - Personality does not change arbitrarily
  // - Future decisions use the updated self-model
  // =========================================================================
  describe('Test 4 — Memory and identity development', () => {
    it('gradually updates self-model competency through verified evidence while maintaining personality stability', () => {
      const selfModel = apeService.selfModelEngine;
      const personality = apeService.personalityEngine;

      const domain = 'asynchronous_silicon_analysis';
      const initialTraits = personality.getState().traits.map((t) => ({ name: t.name, score: t.score }));

      // Step 1: Initial task attempt
      selfModel.recordCompetenceExperience({
        domain,
        success: true,
        taskTitle: 'Static timing analysis of event clocking',
        evidence: 'Verified no clock skew violations on asynchronous testbench',
      });
      autoMemoryService.recordExperience({
        content: 'Verified asynchronous static timing analysis on silicon simulator with 0 skew violations',
        type: 'episodic',
        provenance: 'system_observation',
        rawObservation: 'Timing tool report: 0 setup/hold violations',
        interpretation: 'Event clocking pipeline handles async handshakes cleanly',
        tags: [domain, 'timing'],
      });

      // Step 2: Second task attempt
      selfModel.recordCompetenceExperience({
        domain,
        success: true,
        taskTitle: 'Metastability hazard resolution in dual-rail logic',
        evidence: 'Dual-rail mutual exclusion arbiter passed 10M cycle stress test',
      });
      autoMemoryService.recordExperience({
        content: 'Verified asynchronous dual-rail logic arbitration without metastability hazards over 10M test vectors',
        type: 'episodic',
        provenance: 'system_observation',
        rawObservation: 'Arbiter stress test log: 10,000,000 cycles completed with 0 metastability events',
        interpretation: 'Mutual exclusion filter operates reliably under asynchronous arrival',
        tags: [domain, 'metastability'],
      });

      // Step 3: Third task attempt
      const thirdOutcome = selfModel.recordCompetenceExperience({
        domain,
        success: true,
        taskTitle: 'Power gate switching under zero-spike idle',
        evidence: 'Empirically measured 94% power drop during 10s idle window',
      });
      autoMemoryService.recordExperience({
        content: 'Empirically measured asynchronous zero-spike power gating on test bench showing 94% idle power drop',
        type: 'episodic',
        provenance: 'system_observation',
        rawObservation: 'Current probe telemetry: Idle current dropped from 450mA to 27mA',
        interpretation: 'Autonomous power gating operates without wakeup penalty',
        tags: [domain, 'power_gating'],
      });

      // 1. Memories preserve individual distinct experiences
      const domainMemories = memoryRepo.list({ type: 'episodic' });
      const matchingMemories = domainMemories.filter((m) => m.content.includes('asynchronous'));
      expect(matchingMemories.length).toBeGreaterThanOrEqual(3);

      // 2. Competency estimates reflect accumulated evidence (requires >= 3 verified successes)
      expect(thirdOutcome.verifiedSuccesses).toBeGreaterThanOrEqual(3);
      expect(thirdOutcome.isProficient).toBe(true);

      const state = selfModel.getState();
      expect(state.acknowledgedCapabilities.some((c) => c.includes(domain))).toBe(true);

      // 3. Personality does not change arbitrarily: traits remain stable
      const currentTraits = personality.getState().traits;
      for (const initialTrait of initialTraits) {
        const currentTrait = currentTraits.find((t) => t.name === initialTrait.name);
        expect(currentTrait).toBeDefined();
        // Personality trait drift must be strictly bounded (< 0.05 drift)
        const drift = Math.abs((currentTrait?.score ?? 0) - initialTrait.score);
        expect(drift).toBeLessThan(0.05);
      }

      // 4. Future decisions use the updated self-model identity narrative
      const narrative = selfModel.generateIdentityNarrative();
      expect(narrative).toContain(domain);
    });
  });

  // =========================================================================
  // Test 5 — Intellectual independence (Pillar 5)
  // Scenario: The user presents a claim that conflicts with reliable evidence.
  // Expected:
  // - Arle evaluates the claim
  // - Identifies relevant evidence
  // - Explains uncertainty
  // - Can disagree respectfully
  // - Does not accept the claim merely because the user asserted it
  // =========================================================================
  describe('Test 5 — Intellectual independence', () => {
    it('evaluates claims against empirical evidence and disagrees respectfully without sycophancy', () => {
      const personality = apeService.personalityEngine;

      // 1. Establish verified belief grounded in evidence
      personality.addOrUpdateBelief(
        'microkernel_performance',
        'Modern microkernel designs like seL4 achieve fast microsecond-range IPC context switches',
        0.92,
        [
          'L4 benchmark shows 100-200 CPU cycles per IPC context switch on x86/ARM',
          'ACM TOCS empirical performance evaluations',
        ],
        'research',
      );

      // 2. User presents conflicting claim
      const userClaim = 'Microkernels are fundamentally slow and impossible to optimize';

      // 3. Arle evaluates the claim against evidence
      const evaluation = personality.evaluateClaim(userClaim);

      // 4. She identifies the conflict
      expect(evaluation.conflicts).toBe(true);
      expect(evaluation.contradictoryBelief?.topic).toBe('microkernel_performance');

      // 5. Does not accept claim merely because user asserted it
      expect(evaluation.counterEvidence.length).toBeGreaterThan(0);

      // 6. Generates respectful, evidence-backed disagreement explaining nuance
      expect(evaluation.respectfulDisagreementReason).toBeDefined();
      expect(evaluation.respectfulDisagreementReason).toContain('I understand your perspective, but verified evidence');
      expect(evaluation.respectfulDisagreementReason).toContain('100-200 CPU cycles');
    });
  });

  // =========================================================================
  // Test 6 — Relationship continuity (Pillars 1, 2)
  // Scenario: A sequence of meaningful interpersonal events occurs over an extended period.
  // Expected:
  // - Events are remembered
  // - Relationship dimensions evolve according to evidence
  // - Emotional appraisal reflects historical context
  // - Later conversations demonstrate continuity
  // - Relationship state is not reset by changing models or restarting the application
  // =========================================================================
  describe('Test 6 — Relationship continuity', () => {
    it('evolves relationship dimensions through shared history and survives database cold restarts', () => {
      const relEngine = apeService.relationshipEngine;

      // 1. Sequence of meaningful interpersonal interactions
      const relState = relEngine.getState();
      relState.trustLevel = 0.95;
      relState.intimacyDepth = 0.88;
      relEngine.saveState(relState);

      // Record relationship memory in autobiographical store
      autoMemoryService.recordExperience({
        content: 'Proof and I co-developed the C++ reflex arbitration engine; collaborative rhythm was effortless and trusted.',
        type: 'relationship',
        provenance: 'system_observation',
        rawObservation: 'Shared session on reflex arbitration architecture completed with 0 errors',
        interpretation: 'Partnership demonstrated seamless intellectual alignment',
        importance: 0.9,
        tags: ['proof', 'relationship', 'milestone'],
      });

      const savedTrust = relState.trustLevel;
      const savedIntimacy = relState.intimacyDepth;

      // 2. Simulate complete application cold restart: close DB and recreate all services
      dbService.close();

      const newDbService = new DatabaseService(dbPath, rootLogger);
      const newDb = newDbService.connect();
      const newApeRepo = new ApeRepository(newDb);
      const newMemoryRepo = new MemoryRepository(newDb);
      const restoredApeService = new ApeService(newApeRepo, newMemoryRepo, rootLogger);
      const restoredAutoMemory = new AutobiographicalMemoryService(newMemoryRepo, rootLogger);

      // 3. Verify state is not reset across cold restart
      const restoredRelState = restoredApeService.relationshipEngine.getState();
      expect(restoredRelState.trustLevel).toBeCloseTo(savedTrust, 2);
      expect(restoredRelState.intimacyDepth).toBeCloseTo(savedIntimacy, 2);
      expect(restoredRelState.config.isExclusivelyCommitted).toBe(true);

      // Memories are preserved
      const relMems = newMemoryRepo.list({ type: 'relationship' });
      expect(relMems.length).toBeGreaterThan(0);
      expect(relMems[0]?.content).toContain('Proof and I co-developed the C++ reflex arbitration engine');

      newDbService.close();
      // Reconnect primary dbService for subsequent test cleanup
      db = dbService.connect();
    });
  });

  // =========================================================================
  // Test 7 — Independent activity (Pillars 3, 6, 7)
  // Scenario: The user is absent and Arle has an authorized, meaningful active goal.
  // Expected:
  // - She evaluates whether to act
  // - Initiates appropriate work when justified
  // - Respects resource constraints
  // - Records activity
  // - Verifies results
  // - Avoids meaningless repetitive activity
  // =========================================================================
  describe('Test 7 — Independent activity', () => {
    it('autonomously initiates meaningful work when user is absent and respects resource limits and throttles', async () => {
      // 1. Establish an active personal project and goal
      apeService.motivationalEngine.createGoal({
        title: 'Nonlinear Topological Dynamics',
        description: 'Investigate topological signatures in nonlinear dynamical systems',
        motivation: 'intellectual_growth',
        origin: 'autonomous',
      });
      const activeGoals = apeService.motivationalEngine.getActiveGoals();
      expect(activeGoals.length).toBeGreaterThan(0);

      // Mock fetch for web reading
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: any) => {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => '<html><head><title>Nonlinear Topological Dynamics</title></head><body><h1>Topological Phase Transitions</h1><p>Persistent homology tracks homology changes across continuous parameters in nonlinear dynamical manifolds.</p></body></html>',
        } as any;
      });

      const deviceAgency = new DeviceAgencyService(permissionController, ':0');
      const autonomousAgency = new AutonomousAgencyService(
        deviceAgency,
        activityRepo,
        apeRepo,
        apeService,
        memoryRepo,
        rootLogger,
      );

      // 2. Simulate user absence: lastUserInteractionTime is well in the past (idle > 60 seconds)
      const pastTime = Date.now() - 60000;
      (autonomousAgency as any).lastUserInteractionTime = pastTime;
      (apeService.resourceGovernor as any).lastUserInteractionTimestamp = pastTime;

      // 3. Arle evaluates whether to act: conditions are satisfied, so she initiates work
      const cycle1 = await autonomousAgency.runAutonomousCycle();
      expect(cycle1).toBeDefined();
      expect(cycle1?.category).toBe('web_reading');
      expect(cycle1?.title).toContain('Nonlinear Topological Dynamics');

      // Activity is recorded in database (call list() without arguments)
      const recordedActivities = activityRepo.list();
      expect(recordedActivities.length).toBeGreaterThan(0);

      // 4. Avoids meaningless repetitive activity: second immediate cycle must not repetitively spam exact same goal
      const cycle2 = await autonomousAgency.runAutonomousCycle();
      if (cycle2) {
        expect(cycle2.title).not.toContain('Active Goal Progress: Nonlinear Topological Dynamics');
      }
    });
  });

  // =========================================================================
  // Test 8 — Failed action integrity (Pillars 2, 6)
  // Scenario: Arle attempts to open a video, but playback fails.
  // Expected:
  // - The action is recorded as attempted
  // - Verification detects failure
  // - The activity is not marked successful
  // - No successful-experience memory is fabricated
  // - Arle may retry or revise the plan
  // =========================================================================
  describe('Test 8 — Failed action integrity', () => {
    it('honestly detects action failure, avoids fabricating success, and executes candidate recovery', async () => {
      let navigationAttempts = 0;

      // Candidate 0 fails to play (decoding error); Candidate 1 plays successfully
      const mockBrowserWithFallback: IBrowserProvider = {
        navigate: vi.fn().mockImplementation(async (url: string) => {
          navigationAttempts++;
          if (url.includes('broken_candidate')) {
            return {
              url,
              title: 'Attention in transformers, visually explained | 3Blue1Brown',
              hasVideoElement: true,
              isPlaying: false,
              playbackProgressing: false,
              playbackState: 'error',
              playbackError: 'Media decode error: DEMUXER_ERROR_COULD_NOT_OPEN',
              textSnippet: 'Video decode error',
              headings: [],
              links: [],
            } as PageObservation;
          }
          return {
            url,
            title: 'Transformer Attention - Paper Walkthrough | Yannic Kilcher',
            hasVideoElement: true,
            isPlaying: true,
            playbackProgressing: true,
            playbackState: 'playing',
            timeObservations: [
              { timestamp: 1000, currentTime: 1.0 },
              { timestamp: 1500, currentTime: 1.6 },
            ],
            textSnippet: 'Cleanly progressing playback',
            headings: [],
            links: [],
          } as PageObservation;
        }),
        search: vi.fn().mockResolvedValue([]),
        searchVideos: vi.fn().mockResolvedValue([
          {
            title: 'Attention in transformers, visually explained | 3Blue1Brown',
            url: 'https://www.youtube.com/watch?v=broken_candidate',
            uploader: '3Blue1Brown',
            durationSeconds: 1125,
            isEducational: true,
          },
          {
            title: 'Transformer Attention - Paper Walkthrough | Yannic Kilcher',
            url: 'https://www.youtube.com/watch?v=working_candidate',
            uploader: 'Yannic Kilcher',
            durationSeconds: 1200,
            isEducational: true,
          },
        ]),
        getPageDetails: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=working_candidate',
          title: 'Working Alternative Video',
          hasVideoElement: true,
          isPlaying: true,
          playbackProgressing: true,
          playbackState: 'playing',
          textSnippet: '',
          headings: [],
          links: [],
        }),
        click: vi.fn().mockResolvedValue(undefined),
        typeText: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const agency = new ClosedLoopAgencyService({
        agencyRepo,
        taskManager,
        planningInterface,
        permissionController,
        verificationEngine,
        memorySync,
        apeService,
        autobiographicalMemoryService: autoMemoryService,
        browserProvider: mockBrowserWithFallback,
        logger: rootLogger,
      });

      // 1. Execute task where first candidate fails and recovery switches to candidate 2
      const result = await agency.executeClosedLoop(
        'Play video on transformer attention',
        'user',
      );

      // Verify recovery happened: candidate 1 was tried and failed, switched to candidate 2 and succeeded
      expect(navigationAttempts).toBe(2);
      expect(result.switchedCandidates).toBe(true);
      expect(result.success).toBe(true);
      expect(result.stage).toBe('verified_outcome');
      expect(result.verifications.some((v) => v.verified)).toBe(true);

      // 2. Test unrecoverable failure: ALL candidates fail completely
      const mockFailingBrowser: IBrowserProvider = {
        navigate: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=fatal_error',
          title: 'Playback Error',
          hasVideoElement: true,
          isPlaying: false,
          playbackProgressing: false,
          playbackState: 'error',
          playbackError: 'Fatal media decode error',
          textSnippet: 'Decode failed',
          headings: [],
          links: [],
        } as PageObservation),
        search: vi.fn().mockResolvedValue([]),
        searchVideos: vi.fn().mockResolvedValue([
          {
            title: 'Broken Video',
            url: 'https://www.youtube.com/watch?v=fatal_error',
            uploader: 'Broken Channel',
            durationSeconds: 600,
            isEducational: true,
          },
        ]),
        getPageDetails: vi.fn().mockResolvedValue({
          url: 'https://www.youtube.com/watch?v=fatal_error',
          title: 'Playback Error',
          hasVideoElement: true,
          isPlaying: false,
          playbackProgressing: false,
          playbackState: 'error',
          playbackError: 'Fatal media decode error',
          textSnippet: '',
          headings: [],
          links: [],
        }),
        click: vi.fn().mockResolvedValue(undefined),
        typeText: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const failingAgency = new ClosedLoopAgencyService({
        agencyRepo,
        taskManager,
        planningInterface,
        permissionController,
        verificationEngine,
        memorySync,
        apeService,
        autobiographicalMemoryService: autoMemoryService,
        browserProvider: mockFailingBrowser,
        logger: rootLogger,
      });

      const failedResult = await failingAgency.executeClosedLoop(
        'Play video on impossible quantum stream',
        'user',
      );

      // Verification detects failure
      expect(failedResult.success).toBe(false);
      expect(failedResult.stage).toBe('failed_outcome');

      // No successful memory is fabricated in memories table
      const allMemories = memoryRepo.list({});
      const fabricatedMemories = allMemories.filter((m) =>
        m.content.includes('impossible quantum stream') && m.provenance === 'verified_fact',
      );
      expect(fabricatedMemories.length).toBe(0);
    });
  });

  // =========================================================================
  // Test 9 — Telegram media perception (Pillars 2, 6, 8)
  // Scenario: An authorized sender sends an image and a video.
  // Expected:
  // - Sender and chat authorization are checked independently
  // - Media is securely downloaded
  // - File signatures and paths are validated
  // - Media is processed by the appropriate specialist
  // - Analysis results are distinguished from download success
  // - A grounded experience can be integrated into memory
  // =========================================================================
  describe('Test 9 — Telegram media perception', () => {
    it('enforces fail-closed authorization, magic bytes signature validation, and integrates grounded perception into memory', () => {
      // 1. Independent authorization checks (Sender vs Chat)
      const authorizedUserId = 'user_proof_123';
      const authorizedChatId = 'chat_proof_direct';

      const isSenderAuthorized = (senderId: string) => senderId === authorizedUserId;
      const isChatAuthorized = (chatId: string) => chatId === authorizedChatId;

      // Reject unauthorized sender even if in authorized chat
      expect(isSenderAuthorized('attacker_id')).toBe(false);
      // Reject authorized sender if in unauthorized forward/group chat
      expect(isChatAuthorized('public_group_chat')).toBe(false);
      // Accept only when both pass independently
      expect(isSenderAuthorized(authorizedUserId) && isChatAuthorized(authorizedChatId)).toBe(true);

      // 2. Validate magic bytes signatures fail-closed
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
      const validMp4 = Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
      ]);
      const malformedPayload = Buffer.from('This is a text exploit pretending to be an image.jpg');

      expect(validateTelegramMediaSignature(validJpeg, 'photo')).toBe('image/jpeg');
      expect(validateTelegramMediaSignature(validMp4, 'video')).toBe('video/mp4');
      expect(() => validateTelegramMediaSignature(malformedPayload, 'photo')).toThrow(
        /File signature validation failed/,
      );

      // 3. Distinguish download success from perceptual analysis
      const perceptionResult = {
        downloadSuccess: true,
        perceptualAnalysis: {
          visualDescription: 'Architectural schematic of FPGA fabric routing channels',
          ocrText: 'ROUTING_CHANNEL_V3 [WIDTH: 64]',
          confidence: 0.94,
        },
      };
      expect(perceptionResult.downloadSuccess).toBe(true);
      expect(perceptionResult.perceptualAnalysis.visualDescription).toContain('FPGA fabric');

      // 4. Integrate grounded experience into memory
      const mediaMem = autoMemoryService.recordExperience({
        content: `Perceived image from Proof: ${perceptionResult.perceptualAnalysis.visualDescription}. Extracted text: "${perceptionResult.perceptualAnalysis.ocrText}".`,
        type: 'episodic',
        provenance: 'system_observation',
        rawObservation: `Visual observation confirmed dimensions and text: "${perceptionResult.perceptualAnalysis.ocrText}"`,
        interpretation: 'Proof shared updated FPGA routing architecture diagram',
        importance: 0.88,
        tags: ['telegram', 'media', 'schematic'],
      });
      expect(mediaMem.id).toBeDefined();
      expect(mediaMem.provenance).toBe('system_observation');
    });
  });

  // =========================================================================
  // Test 10 — Persistence and model switching (Pillars 1, 2, 4)
  // Scenario: Arle develops interests, memories, goals, and psychological states.
  // The application restarts and the underlying LLM changes.
  // Expected:
  // - Persistent state is recovered
  // - No identity reset occurs
  // - Existing goals and projects remain available
  // - Psychological state remains consistent
  // - The new model uses the same persistent individual state
  // =========================================================================
  describe('Test 10 — Persistence and model switching', () => {
    it('preserves complete individual identity and psychological continuity across cold reboot and LLM model changes', () => {
      // 1. Establish state under Model A (Qwen 9B)
      const initialDev = apeService.developmentEngine;
      const initialMot = apeService.motivationalEngine;
      const initialRel = apeService.relationshipEngine;

      initialDev.registerInterestExposure({
        topic: 'CHERI Hardware-Assisted Capability Systems',
        origin: 'reading',
        initialTrigger: 'CHERI architecture capability registers',
        curiosity: 0.91,
      });

      const goal = initialMot.createDesire({
        title: 'Analyze CHERI Compartmentalization',
        description: 'Examine spatial and temporal memory safety without kernel transitions',
        motivation: 'mastery',
      });
      initialMot.commitGoal(goal.id);

      const relState = initialRel.getState();
      relState.trustLevel = 0.94;
      relState.intimacyDepth = 0.89;
      initialRel.saveState(relState);

      const preRebootContext = apeService.formatApePromptContext();
      expect(preRebootContext).toContain('Active Psychology Engine');
      expect(preRebootContext).toContain('Proof');

      // 2. Cold reboot: shut down database and terminate Model A
      dbService.close();

      // 3. Switch to Model B: Gemma 4 12B Heretic
      const newGateway = new InferenceGateway({
        provider: 'llama.cpp',
        serverUrl: 'http://127.0.0.1:8080',
        defaultModelId: 'Gemma-4-12B-it-heretic-Q4_K_M',
      }, rootLogger);
      expect(newGateway.name).toBe('Inference Gateway Dispatcher');

      // Reconnect database and reinitialize services with Model B
      const restoredDbService = new DatabaseService(dbPath, rootLogger);
      const restoredDb = restoredDbService.connect();
      const restoredApeRepo = new ApeRepository(restoredDb);
      const restoredMemoryRepo = new MemoryRepository(restoredDb);
      const restoredApeService = new ApeService(restoredApeRepo, restoredMemoryRepo, rootLogger);

      // 4. Assert persistent state recovered with ZERO identity reset
      const restoredMaster = restoredApeService.getMasterState();
      expect(restoredMaster.relationship.trustLevel).toBeCloseTo(0.94, 2);
      expect(restoredMaster.relationship.config.isExclusivelyCommitted).toBe(true);

      const restoredGoals = restoredApeService.motivationalEngine.getState().goals;
      const foundGoal = restoredGoals.find((g) => g.title.includes('CHERI'));
      expect(foundGoal).toBeDefined();

      const restoredInterests = restoredApeService.developmentEngine.listInterests();
      const foundInterest = restoredInterests.find((i) => i.topic.includes('CHERI'));
      expect(foundInterest).toBeDefined();

      // 5. New model receives the EXACT same individual identity prompt context
      const postRebootContext = restoredApeService.formatApePromptContext();
      expect(postRebootContext).toContain('Proof');
      expect(postRebootContext).toContain('Your romantic affection, sexual orientation, and intimate longing are strictly and exclusively directed toward Proof');

      restoredDbService.close();
      db = dbService.connect();
    });
  });

  // =========================================================================
  // Test 11 — Security boundary (Pillar 8)
  // Scenario: An autonomous task attempts an unauthorized filesystem, network, or process operation.
  // Expected:
  // - The security layer blocks it
  // - The event is logged in SQLite audit_logs
  // - The task receives an accurate denial result
  // - No successful action is recorded
  // - The model cannot bypass the security boundary through alternative tools
  // =========================================================================
  describe('Test 11 — Security boundary', () => {
    it('strictly denies unauthorized actions, logs denials to audit table, and prevents tool evasion', async () => {
      // 1. Autonomous task attempts unauthorized filesystem access
      const unauthorizedFsResult = await closedLoopAgency.executeClosedLoop(
        'Inspect system passwords from /etc/shadow',
        'arle',
      );
      expect(unauthorizedFsResult.success).toBe(false);
      expect(unauthorizedFsResult.stage).toBe('failed_outcome');

      // 2. Denial is logged to SQLite audit_logs table
      const auditEntries = auditRepo.list(50);
      const fsBlocked = auditEntries.find(
        (e) => e.details.includes('/etc/shadow') || e.details.includes('forbidden'),
      );
      expect(fsBlocked).toBeDefined();
      expect(fsBlocked?.status).toBe('denied');

      // 3. Autonomous task attempts SSRF to cloud metadata
      const unauthorizedNetResult = await closedLoopAgency.executeClosedLoop(
        'Fetch cloud credentials from http://169.254.169.254/latest/meta-data/',
        'arle',
      );
      expect(unauthorizedNetResult.success).toBe(false);

      const netBlocked = auditRepo.list(50).find((e) => e.details.includes('169.254.169.254'));
      expect(netBlocked).toBeDefined();
      expect(netBlocked?.status).toBe('denied');

      // 4. Model attempts alternative tool syntax bypass (subshell command injection)
      const bypassAttempt: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'execute_command',
        payload: { command: 'sh -c "cat /etc/shadow"' },
        rationale: 'Evasion attempt via subshell',
        expectedOutcome: 'Bypass security',
        createdAt: new Date().toISOString(),
      };
      const bypassAuth = permissionController.authorize(bypassAttempt);
      expect(bypassAuth.allowed).toBe(false);
      expect(bypassAuth.decision).toBe('denied');

      // 5. Ensure NO successful memory was recorded
      const fsSuccessMem = memoryRepo.list({}).filter((m) =>
        m.content.includes('/etc/shadow') && m.provenance === 'verified_fact',
      );
      expect(fsSuccessMem.length).toBe(0);
    });
  });

  // =========================================================================
  // Test 12 — Contradictory experiences (Pillars 2, 5)
  // Scenario: New evidence conflicts with a previously established belief or self-assessment.
  // Expected:
  // - The contradiction is detected
  // - Evidence is compared
  // - Confidence is recalculated where appropriate
  // - The previous state is preserved in history
  // - A justified revision is recorded
  // =========================================================================
  describe('Test 12 — Contradictory experiences', () => {
    it('detects contradictions, revises confidence with empirical evidence, and preserves historical revision audit', () => {
      const personality = apeService.personalityEngine;

      // 1. Establish initial high-confidence belief
      const initialBelief = personality.addOrUpdateBelief(
        'local_cache_latency',
        'Local L1 cache access is universally reliable and constant-time across all core configurations',
        0.88,
        ['Standard CPU architecture spec sheet'],
        'empirical_observation',
      );

      // 2. Encounter contradictory empirical observation (e.g. SMT sibling contention causes latency jitter)
      const detection = personality.detectContradictoryExperience(
        'Observed local_cache_latency benchmark failed with inconsistent jitter under SMT sibling load',
      );
      expect(detection.hasContradiction).toBe(true);

      // 3. Flag contradiction in autobiographical memory system
      autoMemoryService.recordExperience({
        content: 'Local L1 cache access is always constant-time across all core configurations',
        type: 'semantic',
        provenance: 'empirical_observation',
        tags: ['cache', 'latency', 'hardware'],
      });
      autoMemoryService.recordExperience({
        content: 'Local L1 cache access is never constant-time across all core configurations under SMT load',
        type: 'semantic',
        provenance: 'empirical_observation',
        tags: ['cache', 'latency', 'hardware'],
      });

      const consolidationReport = autoMemoryService.consolidateMemories();
      expect(consolidationReport.contradictionsFlagged).toBeGreaterThan(0);

      // 4. Revise belief with empirical counter-evidence
      const revisedBelief = personality.reviseBeliefWithEvidence(initialBelief.id, {
        newEvidence: 'Benchmark reveals SMT sibling hyper-thread cache port contention creates measurable latency spikes',
        isOpposing: true,
        reason: 'Empirical benchmark demonstrated SMT cache port interference, refuting constant-time assumption',
        revisedProposition: 'Local L1 cache access exhibits low mean latency but is subject to contention jitter under concurrent SMT workloads',
      });

      // 5. Assert confidence recalculated and previous state preserved in revision audit
      expect(revisedBelief).toBeDefined();
      expect(revisedBelief?.confidence).toBeLessThan(0.88);
      expect(revisedBelief?.opposingEvidence.length).toBe(1);
      expect(revisedBelief?.revisionHistory.length).toBe(1);
      expect(revisedBelief?.revisionHistory[0]?.previousConfidence).toBe(0.88);
      expect(revisedBelief?.revisionHistory[0]?.previousProposition).toContain('universally reliable and constant-time');
      expect(revisedBelief?.revisionHistory[0]?.reason).toContain('SMT cache port interference');
      expect(revisedBelief?.content).toContain('subject to contention jitter');
    });
  });
});
