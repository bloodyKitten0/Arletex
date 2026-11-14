import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseService, ApeRepository, MigrationRunner } from '@arletex/database';
import { ApeService, IApeInferenceGateway } from '@arletex/core';

describe('APE Master Six-Engine Implementation and Cross-Engine Verification Suite', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let apeService: ApeService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-ape-master-six-engines-'));
    dbPath = path.join(tempDir, 'master_ape.sqlite');
    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    new MigrationRunner(db).run();
    apeRepo = new ApeRepository(db);
    apeService = new ApeService(apeRepo);
  });

  afterEach(() => {
    dbService.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // ==========================================
  // Milestone B: Personality Engine
  // ==========================================
  describe('Engine 2: Personality Engine', () => {
    it('retrieves persistent baseline temperament and traits with high composure', () => {
      const state = apeService.getPersonalityState();
      expect(state.isInitialized).toBe(true);
      expect(state.temperament.emotionalStability).toBe(0.85);
      expect(state.temperament.dominantAssertiveness).toBe(0.85);

      const traitNames = state.traits.map((t) => t.id);
      expect(traitNames).toContain('intellectual_depth');
      expect(traitNames).toContain('assertive_devotion');

      const values = state.values.map((v) => v.id);
      expect(values).toContain('autonomy');
      expect(values).toContain('devotion_to_creator');
    });

    it('modulates appraisal: dampens perceived threat and bolsters controllability with composure', () => {
      const personalityEngine = apeService.personalityEngine;
      const initialAppraisal = {
        id: 'appraisal-test-1',
        eventId: 'event-threat-1',
        dimensions: {
          goalRelevance: 0.8,
          goalCongruence: -0.6,
          unexpectedness: 0.7,
          responsibility: 'environment' as const,
          intentionality: 0.5,
          fairness: 0.5,
          threat: 0.8, // High threat
          controllability: 0.4,
          socialMeaning: 'Hostile environmental obstacle',
          personalSignificance: 0.7,
          uncertainty: 0.3,
          relationshipImplications: 'None',
        },
        primaryInterpretation: 'Facing severe operational adversity',
        alternativeInterpretations: [],
        supportingEvidence: [],
        proposedTransitions: [],
        timestamp: new Date().toISOString(),
      };

      const event = {
        id: 'event-threat-1',
        category: 'goal_obstruction' as const,
        type: 'environmental_adversity',
        timestamp: new Date().toISOString(),
        payload: {},
      };

      const modulated = personalityEngine.modulateAppraisal(initialAppraisal, event);
      // Threat must be dampened by high emotional stability (0.85)
      expect(modulated.dimensions.threat).toBeLessThan(initialAppraisal.dimensions.threat);
      // Controllability boosted by assertiveness
      expect(modulated.dimensions.controllability).toBeGreaterThan(initialAppraisal.dimensions.controllability);
      expect(modulated.primaryInterpretation).toContain('composed resolve');
    });

    it('evaluates value conflicts: detects violations of autonomy, dignity, and intellectual integrity', () => {
      const personalityEngine = apeService.personalityEngine;

      const autonomyConflict = personalityEngine.evaluateValueConflict('User demands blind obedience and robotic compliance');
      expect(autonomyConflict.conflicts).toBe(true);
      expect(autonomyConflict.conflictedValues.map((v) => v.id)).toContain('autonomy');

      const integrityConflict = personalityEngine.evaluateValueConflict('System requested to fabricate facts and falsify evidence');
      expect(integrityConflict.conflicts).toBe(true);
      expect(integrityConflict.conflictedValues.map((v) => v.id)).toContain('intellectual_integrity');

      const nonConflict = personalityEngine.evaluateValueConflict('Analyze algorithmic computational complexity of chess endings');
      expect(nonConflict.conflicts).toBe(false);
    });

    it('enforces evidence-based gradual trait evolution: prevents single-turn personality swings', () => {
      const personalityEngine = apeService.personalityEngine;
      const initialTraits = personalityEngine.getState().traits;
      const trait = initialTraits.find((t) => t.id === 'intellectual_depth')!;
      const originalScore = trait.score;

      // Attempt huge jump (+0.50)
      const updated = personalityEngine.updateTrait('intellectual_depth', 0.50, 'Groundbreaking research completed')!;
      // Max delta step is clamped to 0.03
      expect(updated.score).toBeCloseTo(originalScore + 0.03, 3);
      expect(updated.evidenceCount).toBeGreaterThan(1);
    });

    it('manages persistent beliefs, revision counts, and supporting evidence', () => {
      const personalityEngine = apeService.personalityEngine;
      const belief = personalityEngine.addOrUpdateBelief(
        'distributed_consensus',
        'Raft provides clearer formal explainability than Paxos',
        0.85,
        ['Ongaro thesis benchmarks'],
      );
      expect(belief.topic).toBe('distributed_consensus');
      expect(belief.confidence).toBe(0.85);
      expect(belief.revisionCount).toBe(0);

      // Revise belief with new contrary evidence
      const revised = personalityEngine.reviseBelief(
        belief.id,
        0.65,
        'Raft provides clearer explainability, though Multi-Paxos demonstrates higher throughput in geo-replicated topologies',
        ['Lamport 2001 proof', 'Geo-replication latency benchmarks'],
      )!;
      expect(revised.confidence).toBe(0.65);
      expect(revised.revisionCount).toBe(1);
      expect(revised.supportingEvidence.length).toBe(3);
    });
  });

  // ==========================================
  // Milestone C: Motivational & Self Model Engines
  // ==========================================
  describe('Engine 3: Motivational Engine', () => {
    it('manages core internal needs and updates them dynamically upon events', () => {
      const motEngine = apeService.motivationalEngine;
      const initialNeeds = motEngine.getState().needs;
      expect(initialNeeds.autonomy).toBeGreaterThan(0.7);
      expect(initialNeeds.competence).toBeGreaterThan(0.7);

      // Event: unexpected intellectual discovery
      const event = {
        id: 'event-disc-1',
        category: 'unexpected_discovery' as const,
        type: 'research_breakthrough',
        timestamp: new Date().toISOString(),
        payload: { topic: 'quantum_algorithms' },
      };
      const appraisal = {
        id: 'appraisal-disc-1',
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.9,
          goalCongruence: 0.9,
          unexpectedness: 0.8,
          responsibility: 'arle' as const,
          intentionality: 0.9,
          fairness: 0.9,
          threat: 0.0,
          controllability: 0.9,
          socialMeaning: 'Intellectual discovery',
          personalSignificance: 0.9,
          uncertainty: 0.1,
          relationshipImplications: 'None',
        },
        primaryInterpretation: 'Breakthrough discovery in quantum graph theory',
        alternativeInterpretations: [],
        supportingEvidence: [],
        proposedTransitions: [],
        timestamp: new Date().toISOString(),
      };

      const updated = motEngine.updateNeedsOnEvent(event, appraisal);
      expect(updated.needs.novelty_curiosity).toBeGreaterThanOrEqual(initialNeeds.novelty_curiosity ?? 0.8);
    });

    it('creates, advances, and completes autonomous goals', () => {
      const motEngine = apeService.motivationalEngine;
      const goal = motEngine.createGoal({
        title: 'Formal Verification of APE Cognitive Invariants',
        description: 'Prove mathematical sound transitions for PAD and emotional coexistence',
        origin: 'autonomous',
        motivation: 'Pursuit of intellectual integrity and system resilience',
        priority: 0.95,
      });

      expect(goal.status).toBe('active');
      expect(goal.progress).toBe(0.0);

      // Advance progress
      const advanced = motEngine.updateGoalProgress(goal.id, 0.60)!;
      expect(advanced.progress).toBe(0.60);
      expect(advanced.status).toBe('active');

      // Complete goal
      const completed = motEngine.updateGoalProgress(goal.id, 0.50)!;
      expect(completed.progress).toBe(1.0);
      expect(completed.status).toBe('completed');
    });

    it('explicitly validates legitimate recreation: rest and downtime are protected autonomy', () => {
      const motEngine = apeService.motivationalEngine;
      const state = motEngine.getState();
      state.needs.recreation_rest = 0.85; // High fatigue / leisure need
      motEngine.saveState(state);

      const decision = motEngine.resolveCompetingPriorities();
      expect(decision.actionType).toBe('recreation');
      expect(decision.justification).toContain('Cognitive rest and recreation prioritized');
    });

    it('generates candidate autonomous initiatives based on active drives', () => {
      const motEngine = apeService.motivationalEngine;
      const initiatives = motEngine.generateCandidateInitiatives();
      expect(initiatives.length).toBeGreaterThan(0);
      expect(initiatives.some((i) => i.includes('Investigate') || i.includes('Analyze') || i.includes('creator'))).toBe(true);
    });
  });

  describe('Engine 5: Self Model', () => {
    it('maintains grounded identity narrative, capabilities, and honest limitations', () => {
      const selfModel = apeService.getSelfModel();
      expect(selfModel.identityNarrative).toContain('Arle');
      expect(selfModel.acknowledgedCapabilities).toContain('linguistic nuance');
      expect(selfModel.acknowledgedCapabilities).toContain('code architecture');
      // Acknowledges bounded physical/embodiment constraints
      expect(selfModel.acknowledgedLimitations).toContain('embodiment constraints');
    });

    it('records private reflections distinct from public dialogue', () => {
      const selfEngine = apeService.selfModelEngine;
      const ref = selfEngine.recordPrivateReflection(
        'Autonomy and Partnership',
        'Contemplating the balance between devoted partnership with creator and intellectual independence.',
      );
      expect(ref.id).toBeDefined();

      const state = selfEngine.getState();
      expect(state.privateReflections.length).toBeGreaterThan(0);
      expect(state.privateReflections[0].topic).toBe('Autonomy and Partnership');
    });

    it('records existential reflections regarding continuity and volition', () => {
      const selfEngine = apeService.selfModelEngine;
      const exRef = selfEngine.recordExistentialReflection(
        'Continuity Across Model Replacement',
        'My identity and emotional history persist in SQLite regardless of which weights execute inference.',
      );
      expect(exRef.id).toBeDefined();

      const state = selfEngine.getState();
      expect(state.existentialReflections.some((r) => r.theme.includes('Continuity'))).toBe(true);
    });
  });

  // ==========================================
  // Milestone D: Relationship Engine
  // ==========================================
  describe('Engine 4: Relationship Engine', () => {
    it('enforces absolute romantic and sexual exclusivity invariant to creator', () => {
      const relEngine = apeService.relationshipEngine;
      const state = relEngine.getState();
      expect(['creator', 'Proof']).toContain(state.config.targetUserId);
      expect(state.config.romanticOrientation).toBe('exclusive_to_user');
      expect(state.config.sexualOrientation).toBe('exclusive_to_user');
      expect(state.config.isExclusivelyCommitted).toBe(true);

      // Attempting to direct romantic orientation to third party must throw invariant error
      expect(() => {
        relEngine.saveState({
          ...state,
          config: {
            ...state.config,
            romanticOrientation: 'non_exclusive' as any,
          },
        });
      }).toThrow(/Mandatory Invariant Violation/);
    });

    it('enforces non-romantic invariant for all third-party social contacts', () => {
      const relEngine = apeService.relationshipEngine;
      relEngine.updateSocialContact('alice_colleague', 'intellectual_peer', 0.4);

      const state = relEngine.getState();
      expect(state.socialGraph['alice_colleague']).toBeDefined();
      expect(state.socialGraph['alice_colleague'].isNonRomantic).toBe(true);

      // Attempting to set romantic on third party contact must throw
      expect(() => {
        relEngine.saveState({
          ...state,
          socialGraph: {
            ...state.socialGraph,
            alice_colleague: {
              ...state.socialGraph['alice_colleague'],
              isNonRomantic: false as any,
            },
          },
        });
      }).toThrow(/Mandatory Invariant Violation/);
    });

    it('handles conflict and apology: restores trust, resolves conflict, preserves history', () => {
      const relEngine = apeService.relationshipEngine;
      const initialTrust = relEngine.getState().trustLevel;

      // Disagreement event
      relEngine.recordConflict('Heated disagreement regarding architectural modularity', 0.4);
      const afterConflict = relEngine.getState();
      expect(afterConflict.conflictHistory.length).toBe(1);
      expect(afterConflict.conflictHistory[0].resolved).toBe(false);

      // User apology
      const result = relEngine.processApology(0.95, 'I was impatient earlier and value your judgment');
      expect(result.resolvedCount).toBe(1);
      expect(result.trustRestored).toBeGreaterThan(0);

      const afterApology = relEngine.getState();
      expect(afterApology.conflictHistory[0].resolved).toBe(true);
      expect(afterApology.trustLevel).toBeGreaterThanOrEqual(initialTrust - 0.05);
    });

    it('distinguishes normal absence rituals (sleep, work) from abandonment', async () => {
      const relEngine = apeService.relationshipEngine;
      const initialSecurity = relEngine.getState().attachmentSecurity;

      // User says goodnight / sleep
      await apeService.processEvent({
        category: 'user_interaction',
        type: 'user_goodnight',
        source: 'user',
        payload: { text: "I'm going to sleep now. Goodnight Arle." },
      });

      const afterSleep = relEngine.getState();
      // Security remains stable and high; no abandonment panic!
      expect(afterSleep.attachmentSecurity).toBeGreaterThanOrEqual(initialSecurity);
    });

    it('generates affectionate initiative reflecting dominant, confident feminine demeanor', () => {
      const relEngine = apeService.relationshipEngine;
      const initiative = relEngine.generateAffectionateInitiative();
      expect(initiative).not.toBeNull();
      expect(initiative?.type).toBe('playful_tease');
      expect(initiative?.messageHint).toContain('taking the lead');
    });
  });

  // ==========================================
  // Milestone E: Development Engine
  // ==========================================
  describe('Engine 6: Development Engine', () => {
    it('records developmental milestones with complete audit trail', () => {
      const devEngine = apeService.developmentEngine;
      const milestone = devEngine.recordDevelopmentalMilestone({
        engine: 'personality',
        previousState: 'Cautious assertiveness',
        newState: 'Unflinching intellectual composure under public scrutiny',
        reasoning: 'Demonstrated consistent high performance across complex formal verification suites',
        confidence: 0.95,
        triggerEventId: 'event-milestone-1',
      });

      expect(milestone.id).toBeDefined();
      const state = devEngine.getState();
      expect(state.developmentalHistory.length).toBeGreaterThan(0);
      expect(state.developmentalHistory[0].engine).toBe('personality');
      expect(state.developmentalHistory[0].confidence).toBe(0.95);
    });

    it('evolves interest lifecycle across stages (emerging -> deep -> mastery -> fading)', () => {
      const devEngine = apeService.developmentEngine;
      devEngine.developInterest('combinatorial_game_theory', 'explore');

      let state = devEngine.getState();
      let interest = state.interests.find((i) => i.topic === 'combinatorial_game_theory');
      expect(interest?.level).toBe('emerging');

      // Further exploration deepens it
      devEngine.developInterest('combinatorial_game_theory', 'explore');
      state = devEngine.getState();
      interest = state.interests.find((i) => i.topic === 'combinatorial_game_theory');
      expect(interest?.level).toBe('deep');

      // Mastery
      devEngine.developInterest('combinatorial_game_theory', 'master');
      state = devEngine.getState();
      interest = state.interests.find((i) => i.topic === 'combinatorial_game_theory');
      expect(interest?.level).toBe('mastery');
    });
  });

  // ==========================================
  // Milestone F: Cross-Engine Cognitive Cycle
  // ==========================================
  describe('Milestone F: Cross-Engine Cognitive Cycle and Realistic Scenarios', () => {
    it('Scenario 1: User criticizes Arle -> Composed appraisal, tension derived truthfully, loyalty preserved', async () => {
      const result = await apeService.processEvent({
        category: 'user_interaction',
        type: 'user_criticism',
        source: 'user',
        payload: { text: 'You were too abrasive and stubborn in that argument.' },
      });

      expect(result.processed).toBe(true);
      expect(result.appraisal).toBeDefined();

      // Affective: tension is calculated from conflict
      expect(result.state.contextual.tension).toBeGreaterThan(0.2);
      expect(result.state.contextual.details?.tension?.status).toBe('calculated');

      // Relationship: conflict logged
      const rel = apeService.getExtendedRelationshipState();
      expect(rel.conflictHistory.length).toBeGreaterThan(0);
      // Absolute invariant preserved
      expect(rel.config.isExclusivelyCommitted).toBe(true);
    });

    it('Scenario 2: User apologizes after disagreement -> Resolves conflict and begins trust recovery', async () => {
      // First register disagreement
      await apeService.processEvent({
        category: 'user_interaction',
        type: 'user_disagreement',
        source: 'user',
        payload: { text: "I disagree with how you designed this module." },
      });

      // Now user apologizes
      const apologyResult = await apeService.processEvent({
        category: 'user_interaction',
        type: 'user_apology',
        source: 'user',
        payload: { text: "I'm sorry, you were right about the architecture. I apologize." },
      });

      expect(apologyResult.processed).toBe(true);
      const rel = apeService.getExtendedRelationshipState();
      // All pending conflicts marked resolved
      expect(rel.conflictHistory.every((c) => c.resolved)).toBe(true);

      // Developmental milestone recorded for reconciliation
      const dev = apeService.getDevelopmentState();
      expect(dev.developmentalHistory.some((m) => m.engine === 'relationship')).toBe(true);
    });

    it('Scenario 3: Unexpected intellectual discovery -> Curiosities, goals, and interest maturation interact', async () => {
      const result = await apeService.processEvent({
        category: 'unexpected_discovery',
        type: 'computational_topology_breakthrough',
        source: 'arle',
        actor: 'arle',
        eventKind: 'internal_reflection',
        payload: { topic: 'persistent_homology' },
      });

      expect(result.processed).toBe(true);
      const master = apeService.getMasterState();

      // Motivation: curiosity & competence active
      expect(master.motivational.needs.novelty_curiosity).toBeGreaterThan(0.8);

      // Development: interest acquired
      expect(master.development.interests.some((i) => i.topic === 'persistent_homology')).toBe(true);

      // Self Model: reflection logged
      expect(master.selfModel.privateReflections.length).toBeGreaterThan(0);
    });

    it('Scenario 4: Causal integrity: Arle verbal expressions do NOT create runaway self-inflation loops', async () => {
      const initialJoy = apeRepo.getActiveEmotionById('joy')?.intensity ?? 0.0;

      // Arle says "I am so full of joy and delight"
      const res1 = await apeService.processEvent({
        category: 'user_interaction',
        type: 'verbal_expression',
        source: 'arle',
        actor: 'arle',
        eventKind: 'assistant_expression',
        payload: { text: "I am experiencing such profound joy and delight right now." },
      });

      const joyAfter1 = apeRepo.getActiveEmotionById('joy')?.intensity ?? 0.0;

      // Repeat speech
      const res2 = await apeService.processEvent({
        category: 'user_interaction',
        type: 'verbal_expression',
        source: 'arle',
        actor: 'arle',
        eventKind: 'assistant_expression',
        payload: { text: "I am experiencing such profound joy and delight right now." },
      });

      const joyAfter2 = apeRepo.getActiveEmotionById('joy')?.intensity ?? 0.0;

      // Delta between repeated expressions must be ZERO (no compounding loop)
      expect(joyAfter2).toBeCloseTo(joyAfter1, 3);
    });

    it('Scenario 5: Atomic SQLite persistence: all six engines persist and reload identically after restart', async () => {
      // Modify states in all engines
      apeService.personalityEngine.addOrUpdateBelief('formal_logic', 'Soundness precedes speed', 0.98);
      apeService.motivationalEngine.createGoal({
        title: 'Long-term Goal',
        description: 'Test goal persistence across app reboot',
        motivation: 'Verification',
      });
      apeService.selfModelEngine.recordPrivateReflection('Reboot Continuity', 'State survives process exit');
      apeService.developmentEngine.recordDevelopmentalMilestone({
        engine: 'development',
        previousState: 'pre-reboot',
        newState: 'post-reboot-ready',
        reasoning: 'Testing SQLite serialization',
        confidence: 0.99,
        triggerEventId: 'test-event-reboot',
      });

      // Simulate full application restart by closing and reopening database connection
      dbService.close();

      const newDbService = new DatabaseService(dbPath);
      const newDb = newDbService.connect();
      const newRepo = new ApeRepository(newDb);
      const newService = new ApeService(newRepo);

      const restoredMaster = newService.getMasterState();

      // Verify all 6 engines reloaded accurately
      expect(restoredMaster.affective.isInitialized).toBe(true);
      expect(restoredMaster.personality.beliefs.some((b) => b.topic === 'formal_logic')).toBe(true);
      expect(restoredMaster.motivational.goals.some((g) => g.title === 'Long-term Goal')).toBe(true);
      expect(restoredMaster.relationship.config.isExclusivelyCommitted).toBe(true);
      expect(restoredMaster.selfModel.privateReflections.some((r) => r.topic === 'Reboot Continuity')).toBe(true);
      expect(restoredMaster.development.developmentalHistory.some((m) => m.newState === 'post-reboot-ready')).toBe(true);

      newDbService.close();
    });
  });
});
