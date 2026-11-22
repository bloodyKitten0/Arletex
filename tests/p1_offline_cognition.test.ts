import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  OfflineCognitiveActivityEngine,
  InMemoryOfflineCognitiveActivityRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteOfflineCognitiveActivityRepository,
  MemoryRepository,
  ApeRepository,
} from '@arletex/database';

describe('P1.9 — Complete Genuine Offline Cognition', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteDb: Database.Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p1-9-offline-'));
    dbPath = path.join(tempDir, 'p1_9_offline.sqlite');
    dbService = new DatabaseService(dbPath);
    sqliteDb = dbService.connect();
    const migrationRunner = new MigrationRunner(sqliteDb);
    migrationRunner.run();
  });

  afterEach(() => {
    try {
      dbService.close();
    } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('1. Requires offline activities to declare inputs, objective, permitted tools, budget, deliverable and verification criteria', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({ repository: repo });

    const activity = engine.scheduleActivity({
      activityType: 'independent_research',
      title: 'Formal Epistemic Foundations of Distributed Consensus',
      rationale: 'Derived from active collaboration inquiry regarding sovereign Byzantine fault tolerance',
      sourceQuestionId: 'q_byzantine_fault_01',
      objective: 'Formulate epistemic consensus proofs under partial synchrony',
      permittedTools: ['memory_retrieval', 'formal_proof_evaluator'],
      resourceCost: { cpuTokensEstimated: 350, memoryIntensity: 'medium' },
      expectedDeliverable: 'research/byzantine_epistemic_consensus.md',
      verificationCriteria: 'artifact_exists_and_references_source_inquiry',
      inputRecordIds: ['q_byzantine_fault_01', 'mem_consensus_discussion'],
    });

    expect(activity.id).toBeDefined();
    expect(activity.metadata.objective).toBe('Formulate epistemic consensus proofs under partial synchrony');
    expect(activity.metadata.permittedTools).toEqual(['memory_retrieval', 'formal_proof_evaluator']);
    expect(activity.metadata.expectedDeliverable).toBe('research/byzantine_epistemic_consensus.md');
    expect(activity.metadata.verificationCriteria).toBe('artifact_exists_and_references_source_inquiry');
    expect(activity.metadata.inputRecordIds).toContain('q_byzantine_fault_01');
  });

  it('2. Prevents completion of research activities without verifiable deliverables or extracted evidence', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({ repository: repo });

    const activity = engine.scheduleActivity({
      activityType: 'independent_research',
      title: 'Investigation into Category Theory Semantics',
      rationale: 'Investigating functorial mappings for compositional reasoning',
      sourceQuestionId: 'q_cat_theory_01',
    });

    // Attempting to mark complete without artifacts or substantive evidence
    const incompleteResult = engine.executeActivity(activity.id, {
      status: 'completed',
      insights: ['Brief thought.'], // Insufficient deliverable for research
      artifacts: [],
    });

    // Must not be marked completed; must pause and demand verified deliverable
    expect(incompleteResult.status).toBe('paused');
    expect(incompleteResult.progress).toBe(0.5);
    expect(incompleteResult.metadata.failureReason).toContain('Research activity incomplete');
  });

  it('3. Successfully completes research activity when tangible artifacts and evidence are provided', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({ repository: repo });

    const activity = engine.scheduleActivity({
      activityType: 'independent_research',
      title: 'Investigation into Category Theory Semantics',
      rationale: 'Investigating functorial mappings for compositional reasoning',
      sourceQuestionId: 'q_cat_theory_01',
    });

    const completedResult = engine.executeActivity(activity.id, {
      status: 'completed',
      insights: ['Constructed verified monoidal category model for asynchronous message passing.'],
      artifacts: ['research/category_monoidal_semantics.md'],
      examinedRecordIds: ['q_cat_theory_01'],
      evidenceReferences: ['proof_monoid_lemma_01'],
    });

    expect(completedResult.status).toBe('completed');
    expect(completedResult.progress).toBe(1.0);
    expect(completedResult.completedAt).toBeDefined();
    expect(completedResult.resultingArtifacts).toContain('research/category_monoidal_semantics.md');
    expect(completedResult.metadata.examinedRecordIds).toContain('q_cat_theory_01');
  });

  it('4. Fails honestly when inference provider or external dependency is unavailable (zero synthetic bypasses)', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({
      repository: repo,
      inferenceGateway: {
        isAvailable: () => false, // Provider offline
      },
    });

    const result = engine.runAutonomousOfflineCycle({
      userActive: false,
      candidateQuestions: [{ id: 'q_quantum_logic', query: 'Quantum logic versus intuitionistic logic' }],
    });

    const researchActivity = result.executedActivities.find((a) => a.activityType === 'independent_research');
    expect(researchActivity).toBeDefined();
    expect(researchActivity?.status).toBe('paused');
    expect(researchActivity?.progress).toBe(0.0);
    expect(researchActivity?.metadata.failureReason).toContain('Local inference provider offline');

    // No proactive proposal should be formulated from a failed activity
    expect(result.proactiveProposals.length).toBe(0);
  });

  it('5. Memory consolidation reports actual examined and transformed records without fabricated estimates', () => {
    const memoryRepo = new MemoryRepository(sqliteDb);
    const repo = new InMemoryOfflineCognitiveActivityRepository();

    // With 0 memories in repository:
    const engineEmpty = new OfflineCognitiveActivityEngine({
      repository: repo,
      memoryRepository: memoryRepo,
    });

    const runEmpty = engineEmpty.runConsolidationCycle();
    expect(runEmpty.memoriesExamined).toBe(0);
    expect(runEmpty.memoriesConsolidated).toBe(0);

    // Populate actual memories
    const mem1 = memoryRepo.create({
      type: 'episodic',
      content: 'Collaborated with Proof on architectural invariants.',
      importance: 0.9,
    });
    const mem2 = memoryRepo.create({
      type: 'episodic',
      content: 'Explored mathematical philosophy and causal loops.',
      importance: 0.8,
    });
    const mem3 = memoryRepo.create({
      type: 'episodic',
      content: 'Brief transient acknowledgment.',
      importance: 0.2, // Below consolidation threshold
    });

    const runPopulated = engineEmpty.runConsolidationCycle();
    expect(runPopulated.memoriesExamined).toBe(3);
    expect(runPopulated.memoriesConsolidated).toBe(2); // Only mem1 and mem2 meet importance threshold >= 0.4
    expect(runPopulated.summary).toContain('Consolidated 2/3 episodic traces');
  });

  it('6. Background reflections cite actual memory record IDs', () => {
    const memoryRepo = new MemoryRepository(sqliteDb);
    const repo = new InMemoryOfflineCognitiveActivityRepository();

    const mem1 = memoryRepo.create({
      type: 'episodic',
      content: 'Proof discussed mutual egalitarian intellectual growth and long-term research plans.',
      importance: 0.95,
    });

    const engine = new OfflineCognitiveActivityEngine({
      repository: repo,
      memoryRepository: memoryRepo,
    });

    const result = engine.runAutonomousOfflineCycle({ userActive: false });

    const reflection = result.executedActivities.find((a) => a.activityType === 'background_reflection');
    expect(reflection).toBeDefined();
    expect(reflection?.status).toBe('completed');
    expect(reflection?.metadata.examinedRecordIds).toContain(mem1.id);
    expect(reflection?.insights[0]).toContain(mem1.id);
  });

  it('7. Pauses/defers background cognition immediately when Proof is active (interruption-aware)', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({ repository: repo });

    const result = engine.runAutonomousOfflineCycle({
      userActive: true, // Proof is currently using the device
      candidateGoals: [{ id: 'goal_heavy_comp', title: 'Heavy GPU compilation' }],
    });

    // Must defer immediately without launching intensive activities
    expect(result.executedActivities.length).toBe(0);
    expect(result.downtimeObserved).toBe(false);
  });

  it('8. Internal simulations and downtime rest are strictly labelled as simulations', () => {
    const repo = new InMemoryOfflineCognitiveActivityRepository();
    const engine = new OfflineCognitiveActivityEngine({
      repository: repo,
      initialPolicy: { minDowntimeRestIntervalMinutes: 0 },
    });

    const result = engine.runAutonomousOfflineCycle({ userActive: false });
    expect(result.downtimeObserved).toBe(true);

    const rest = result.executedActivities.find((a) => a.activityType === 'downtime_rest');
    expect(rest).toBeDefined();
    expect(rest?.isSimulation).toBe(true);
    expect(rest?.simulationContext).toBe('Downtime self-regulation routine');
    expect(rest?.status).toBe('completed');
  });

  it('9. Controlled run while user is absent produces durable inspectable results in SQLite without external fabrications', () => {
    const sqliteRepo = new SqliteOfflineCognitiveActivityRepository(sqliteDb);
    const memoryRepo = new MemoryRepository(sqliteDb);

    memoryRepo.create({
      type: 'episodic',
      content: 'Proof and Arle agreed to investigate distributed verifiable systems.',
      importance: 0.9,
    });

    const engine = new OfflineCognitiveActivityEngine({
      repository: sqliteRepo,
      memoryRepository: memoryRepo,
    });

    const result = engine.runAutonomousOfflineCycle({
      userActive: false,
      candidateQuestions: [{ id: 'q_distributed_verif', query: 'Verifiable consensus across sovereign nodes' }],
    });

    expect(result.cycleId).toBeDefined();
    expect(result.executedActivities.length).toBeGreaterThanOrEqual(1);

    // Verify persistence in SQLite
    const activities = sqliteRepo.listActivities();
    expect(activities.length).toBeGreaterThanOrEqual(1);

    const research = activities.find((a) => a.activityType === 'independent_research');
    expect(research).toBeDefined();
    expect(research?.resultingArtifacts).toContain('research/epistemic_q_distributed_verif.md');

    // Proactive proposal generated for Proof
    const proposals = sqliteRepo.listProactiveProposals();
    expect(proposals.length).toBe(1);
    expect(proposals[0]?.topic).toBe('Research Insight Ready');
  });
});
