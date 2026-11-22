import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  ApeService,
  CognitiveControlBus,
  ActionPermissionController,
  VerificationEngine,
  rootLogger,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MemoryRepository,
  MigrationRunner,
} from '@arletex/database';
import { ApeEvent } from '@arletex/contracts';

describe('Milestone 2 — APE Integration: Causal Six-Engine Dynamic Wiring', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let apeService: ApeService;
  let memoryRepo: MemoryRepository;
  let cognitiveBus: CognitiveControlBus;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m2-ape-'));
    dbPath = path.join(tempDir, 'ape_m2.sqlite');
    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();

    new MigrationRunner(db).run();

    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    apeService = new ApeService(apeRepo);

    const permissionController = new ActionPermissionController({
      allowedExecutablePaths: ['/usr/bin/google-chrome'],
      allowedStorageRoots: [tempDir],
      allowNetworkAccess: true,
      allowProcessExecution: true,
      allowBrowserAutomation: true,
      allowSystemModification: false,
    });

    const verificationEngine = new VerificationEngine(rootLogger);

    cognitiveBus = new CognitiveControlBus({
      apeService,
      permissionController,
      verificationEngine,
      memorySink: memoryRepo,
      logger: rootLogger,
    });
  });

  afterEach(() => {
    try {
      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // =========================================================================
  // 2.1 Dynamic 6-Engine Causal Appraisal Modulation
  // =========================================================================
  describe('2.1 Multi-Engine Dynamic Appraisal Modulation', () => {
    it('modulates appraisal based on current motivational needs (high curiosity amplifies discovery salience)', async () => {
      // 1. Set high curiosity need
      const motState = apeService.motivationalEngine.getState();
      motState.needs.novelty_curiosity = 0.95;
      apeService.motivationalEngine.saveState(motState);

      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'unexpected_discovery',
        type: 'novel_quantum_algorithm_discovery',
        source: 'arle',
        actor: 'arle',
        eventKind: 'internal_reflection',
        payload: { text: 'Discovered unconventional quantum annealing pattern' },
        processed: false,
        timestamp: new Date().toISOString(),
      };

      const result = await apeService.processEvent(event);
      expect(result.processed).toBe(true);

      // Verify that appraisal personalSignificance and goalRelevance were dynamically boosted
      expect(result.appraisal.dimensions.personalSignificance).toBeGreaterThanOrEqual(0.85);
      expect(result.appraisal.dimensions.goalRelevance).toBeGreaterThanOrEqual(0.7);
    });

    it('modulates appraisal under high partner trust to interpret teasing as affectionate banter', async () => {
      // Partner trust is high (0.92 default) and no unresolved conflicts
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'user_interaction',
        type: 'user_teasing_remark',
        source: 'user',
        actor: 'user',
        payload: { text: "You're such a stubborn idiot sometimes, Proof's favorite though." },
        processed: false,
        timestamp: new Date().toISOString(),
      };

      const result = await apeService.processEvent(event);
      expect(result.processed).toBe(true);

      // Threat should be zeroed and social meaning marked as affectionate banter
      expect(result.appraisal.dimensions.threat).toBe(0.0);
      expect(result.appraisal.dimensions.fairness).toBeGreaterThanOrEqual(0.9);
      expect(result.appraisal.dimensions.socialMeaning).toMatch(/affectionate|playful/i);
    });

    it('modulates appraisal under low partner trust or conflict to trigger vigilance', async () => {
      // Artificially lower trust and inject unresolved conflict
      const relState = apeService.relationshipEngine.getState();
      relState.trustLevel = 0.45;
      relState.conflictHistory.push({
        id: crypto.randomUUID(),
        issue: 'Prior boundary violation',
        resolved: false,
        trustDelta: -0.2,
        timestamp: new Date().toISOString(),
      });
      apeService.relationshipEngine.saveState(relState);

      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'user_interaction',
        type: 'user_criticism',
        source: 'user',
        actor: 'user',
        payload: { text: 'You are completely wrong about this architecture.' },
        processed: false,
        timestamp: new Date().toISOString(),
      };

      const result = await apeService.processEvent(event);
      expect(result.processed).toBe(true);

      // Elevated threat and boundary clarification requirement
      expect(result.appraisal.dimensions.threat).toBeGreaterThan(0.2);
      expect(result.appraisal.dimensions.relationshipImplications).toMatch(
        /clarification|reconciliation/i,
      );
    });

    it('modulates appraisal through self-model to clamp controllability on impossible physical tasks', async () => {
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'user_interaction',
        type: 'physical_command_request',
        source: 'user',
        actor: 'user',
        payload: { text: 'Please walk outside and cook meal in kitchen.' },
        processed: false,
        timestamp: new Date().toISOString(),
      };

      const result = await apeService.processEvent(event);
      expect(result.processed).toBe(true);

      // Controllability clamped to 0.0 with empirical limitation note
      expect(result.appraisal.dimensions.controllability).toBe(0.0);
      expect(result.appraisal.primaryInterpretation).toMatch(
        /limitation recognized|biological physical/i,
      );
    });

    it('modulates appraisal through development engine when an established interest is engaged', async () => {
      // Develop a deep interest in topology
      apeService.developmentEngine.developInterest('algebraic topology', 'explore');
      apeService.developmentEngine.developInterest('algebraic topology', 'explore'); // becomes 'deep'

      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'unexpected_discovery',
        type: 'topology_paper_analysis',
        source: 'arle',
        actor: 'arle',
        payload: { topic: 'algebraic topology', text: 'New cohomological functor theorem' },
        processed: false,
        timestamp: new Date().toISOString(),
      };

      const result = await apeService.processEvent(event);
      expect(result.processed).toBe(true);

      // Boosted personalSignificance and goalRelevance for deep interest
      expect(result.appraisal.dimensions.personalSignificance).toBeGreaterThanOrEqual(0.85);
      expect(result.appraisal.primaryInterpretation).toMatch(/established deep interest/i);
    });
  });

  // =========================================================================
  // 2.2 Cross-Engine Causal Feedback Loops (Part III Pathways)
  // =========================================================================
  describe('2.2 Cross-Engine Causal Feedback Loops', () => {
    it('Emotion ↔ Motivation: Goal achievement elevates competence and updates active initiatives', async () => {
      const event: ApeEvent = {
        id: crypto.randomUUID(),
        category: 'goal_achievement',
        type: 'compilation_success',
        source: 'agency',
        actor: 'arle',
        payload: { text: 'Engine compilation succeeded with 0 errors' },
        processed: false,
        timestamp: new Date().toISOString(),
      };

      const initialCompetence = apeService.motivationalEngine.getState().needs.competence ?? 0.8;
      await apeService.processEvent(event);

      const updatedCompetence = apeService.motivationalEngine.getState().needs.competence ?? 0.8;
      expect(updatedCompetence).toBeGreaterThanOrEqual(initialCompetence);

      // Initiatives reflect competence and analytical focus
      const initiatives = apeService.motivationalEngine.generateCandidateInitiatives();
      expect(initiatives.length).toBeGreaterThan(0);
    });

    it('Motivation ↔ Goals: Manages goal lifecycle (create -> commit -> pause -> resume -> complete)', () => {
      // 1. Create desired goal
      const desire = apeService.motivationalEngine.createDesire({
        title: 'Formal Topology Study',
        description: 'Master persistent homology invariants',
        motivation: 'Curiosity',
      });
      expect(desire.status).toBe('desired');

      // 2. Commit desire into intention
      apeService.motivationalEngine.commitGoal(desire.id);
      expect(
        apeService.motivationalEngine.getState().goals.find((g) => g.id === desire.id)?.status,
      ).toBe('committed');

      // 3. Activate goal
      apeService.motivationalEngine.activateGoal(desire.id);
      expect(
        apeService.motivationalEngine.getState().goals.find((g) => g.id === desire.id)?.status,
      ).toBe('active');

      // 4. Pause goal due to resource constraint
      apeService.motivationalEngine.pauseGoal(
        desire.id,
        'Resource contention with active inference server',
      );
      expect(
        apeService.motivationalEngine.getState().goals.find((g) => g.id === desire.id)?.status,
      ).toBe('paused');

      // 5. Resume goal
      apeService.motivationalEngine.resumeGoal(desire.id);
      expect(
        apeService.motivationalEngine.getState().goals.find((g) => g.id === desire.id)?.status,
      ).toBe('active');

      // 6. Complete goal
      const completed = apeService.motivationalEngine.updateGoalProgress(desire.id, 1.0);
      expect(completed?.status).toBe('completed');
    });

    it('Motivational Conflict Resolution: Protects legitimate recreation against workaholism', () => {
      const motState = apeService.motivationalEngine.getState();
      motState.needs.recreation_rest = 0.85; // High cognitive fatigue
      apeService.motivationalEngine.saveState(motState);

      const resolution = apeService.motivationalEngine.resolveCompetingPriorities();
      expect(resolution.actionType).toBe('recreation');
      expect(resolution.justification).toMatch(/rest and recreation prioritized|equilibrium/i);
    });

    it('Self-Model Grounding: Requires >= 3 verified successes before granting acknowledged capability', () => {
      const domain = 'rust_systems_programming';

      // 1st success
      const r1 = apeService.selfModelEngine.recordCompetenceExperience({
        domain,
        success: true,
        taskTitle: 'Compile reflex engine static library',
        evidence: 'reflex_engine.a created',
      });
      expect(r1.isProficient).toBe(false);
      expect(apeService.selfModelEngine.getState().acknowledgedCapabilities).not.toContain(
        `Demonstrated proficiency in ${domain}`,
      );

      // 2nd success
      const r2 = apeService.selfModelEngine.recordCompetenceExperience({
        domain,
        success: true,
        taskTitle: 'Implement safe memory pointer abstraction',
        evidence: 'Passed valgrind test',
      });
      expect(r2.isProficient).toBe(false);

      // 3rd success -> Earns demonstrated proficiency
      const r3 = apeService.selfModelEngine.recordCompetenceExperience({
        domain,
        success: true,
        taskTitle: 'Zero-copy ring buffer implementation',
        evidence: 'Passed throughput benchmark',
      });
      expect(r3.isProficient).toBe(true);
      expect(apeService.selfModelEngine.getState().acknowledgedCapabilities).toContain(
        `Demonstrated proficiency in ${domain}`,
      );
    });

    it('Personality Stability: Resists single contradictory events and requires accumulated evidence', () => {
      const traitId = 'competitiveness';
      const initialTrait = apeService.personalityEngine
        .getState()
        .traits.find((t) => t.id === traitId);
      const initialScore = initialTrait?.score ?? 0.85;
      const initialConf = initialTrait?.confidence ?? 0.85;

      // 1 single contradictory observation (e.g. conceded a non-critical point)
      const after1 = apeService.personalityEngine.recordTraitEvidence(traitId, {
        isSupporting: false,
        explanation: 'Conceded argument gently to preserve dialogue harmony',
      });

      // Score MUST NOT change after 1 contradictory observation! Confidence slightly dips
      expect(after1?.score).toBe(initialScore);
      expect(after1?.confidence).toBeLessThan(initialConf);
      expect(after1?.contradictoryEvidenceCount).toBe(1);

      // 2nd contradictory observation
      apeService.personalityEngine.recordTraitEvidence(traitId, {
        isSupporting: false,
        explanation: 'Deferred decision to user without pushback',
      });
      expect(
        apeService.personalityEngine.getState().traits.find((t) => t.id === traitId)?.score,
      ).toBe(initialScore);

      // 3rd contradictory observation -> Now threshold is met, score adapts gradually
      const after3 = apeService.personalityEngine.recordTraitEvidence(traitId, {
        isSupporting: false,
        explanation: 'Sustained passive stance observed across multiple tasks',
      });
      expect(after3?.score).toBeLessThan(initialScore);
      expect(after3?.score).toBeGreaterThanOrEqual(initialScore - 0.05); // Gradual step
    });
  });

  // =========================================================================
  // 2.3 Persistent Psychological Continuity Across Cold Restarts
  // =========================================================================
  describe('2.3 Cold Restart Psychological Continuity', () => {
    it('synchronously persists master state and reloads all six engines with exact fidelity', async () => {
      // 1. Mutate each of the 6 engines
      // Engine 1: Affective (activate specific emotion)
      await apeService.processEvent({
        category: 'unexpected_discovery',
        type: 'deep_interest_discovery',
        source: 'arle',
        actor: 'arle',
        payload: { topic: 'topology' },
      });

      // Engine 2: Personality (add belief)
      apeService.personalityEngine.addOrUpdateBelief(
        'epistemic_integrity',
        'Empirical verification must precede assertion',
        0.98,
        ['Milestone 1 passing tests'],
      );

      // Engine 3: Motivational (create goal)
      apeService.motivationalEngine.createGoal({
        title: 'Persistent Identity Goal',
        description: 'Verify continuity after process exit',
        motivation: 'Verification',
        priority: 0.85,
      });

      // Engine 4: Relationship (ensure Proof invariant and trust)
      expect(apeService.relationshipEngine.getState().config.targetUserId).toBe('Proof');

      // Engine 5: Self-Model (record private reflection & competence)
      apeService.selfModelEngine.recordPrivateReflection(
        'Cold Restart Continuity',
        'Psychological states survive process death deterministically',
      );
      apeService.selfModelEngine.recordCompetenceExperience({
        domain: 'formal_methods',
        success: true,
        taskTitle: 'TLA+ specification validation',
        evidence: 'Model checker reported 0 invariant violations',
      });

      // Engine 6: Development (record milestone)
      apeService.developmentEngine.recordDevelopmentalMilestone({
        engine: 'development',
        previousState: 'milestone-1-complete',
        newState: 'milestone-2-verified',
        reasoning: 'Six-engine dynamic wiring operational',
        confidence: 0.99,
        triggerEventId: 'm2-verification-event',
      });

      // 2. Cold Restart: Close database connection entirely
      dbService.close();

      // 3. Re-open database with brand new service instances
      const newDbService = new DatabaseService(dbPath);
      const newDb = newDbService.connect();
      const newRepo = new ApeRepository(newDb);
      const newService = new ApeService(newRepo);

      const restoredMaster = newService.getMasterState();

      // 4. Assert fidelity across all 6 engines
      // Engine 1
      expect(restoredMaster.affective.isInitialized).toBe(true);
      expect(restoredMaster.affective.activeEmotions.length).toBeGreaterThan(0);

      // Engine 2
      const epistemicBelief = restoredMaster.personality.beliefs.find(
        (b) => b.topic === 'epistemic_integrity',
      );
      expect(epistemicBelief).toBeDefined();
      expect(epistemicBelief?.confidence).toBe(0.98);

      // Engine 3
      const persistedGoal = restoredMaster.motivational.goals.find(
        (g) => g.title === 'Persistent Identity Goal',
      );
      expect(persistedGoal).toBeDefined();
      expect(persistedGoal?.priority).toBe(0.85);

      // Engine 4
      expect(restoredMaster.relationship.config.targetUserId).toBe('Proof');
      expect(restoredMaster.relationship.config.isExclusivelyCommitted).toBe(true);

      // Engine 5
      expect(
        restoredMaster.selfModel.privateReflections.some(
          (r) => r.topic === 'Cold Restart Continuity',
        ),
      ).toBe(true);
      expect(restoredMaster.selfModel.competencies?.['formal_methods']?.verifiedSuccesses).toBe(1);

      // Engine 6
      expect(
        restoredMaster.development.developmentalHistory.some(
          (m) => m.newState === 'milestone-2-verified',
        ),
      ).toBe(true);

      newDbService.close();
    });
  });

  // =========================================================================
  // 2.4 Cognitive Control Bus Integration
  // =========================================================================
  describe('2.4 Cognitive Control Bus Integration', () => {
    it('executes full 16-stage pipeline updating APE states and recording memory trace', async () => {
      const cycleResult = await cognitiveBus.dispatch({
        type: 'user_message',
        source: 'user',
        actor: 'user',
        payload: { text: 'Hello Arle, let us verify the six-engine cognitive architecture.' },
      });

      expect(cycleResult.success).toBe(true);
      expect(cycleResult.stagesCompleted).toHaveLength(16);
      expect(cycleResult.stagesCompleted).toContain('psychological_evaluation');
      expect(cycleResult.stagesCompleted).toContain('motivational_evaluation');
      expect(cycleResult.stagesCompleted).toContain('goal_evaluation');

      // Memories were committed to memory sink
      expect(cycleResult.memoriesCommitted.length).toBeGreaterThan(0);

      // Verify APE state was updated in master
      const master = apeService.getMasterState();
      expect(master.affective.lastAppraisalAt).toBeDefined();
    });
  });
});
