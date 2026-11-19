import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DocumentIngestionService,
  KnowledgeBaseService,
  ResearchEvaluationEngine,
  ModelCapabilityAssessmentEngine,
  TrainingDataEngine,
  AdapterEvaluationEngine,
  LoRATrainingEngine,
  AdapterLifecycleManager,
  rootLogger,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteKnowledgeRepository,
} from '@arletex/database';

describe('Phase 6: Knowledge Acquisition, RAG & Autonomous LoRA Specialization', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let repo: SqliteKnowledgeRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-phase6-knowledge-'));
    dbPath = path.join(tempDir, 'knowledge_test.sqlite');

    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    repo = new SqliteKnowledgeRepository(db);
  });

  afterEach(() => {
    try {
      dbService.close();
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Cleanup
    }
  });

  it('1. DocumentIngestionService cleanly splits technical documents preserving semantic boundaries', () => {
    const service = new DocumentIngestionService();
    const technicalDoc = `The hippocampus is a major component of the brains of humans and other vertebrates.
Humans and other mammals have two hippocampi, one in each side of the brain. The hippocampus is part of the limbic system, and plays important roles in the consolidation of information from short-term memory to long-term memory.

In Alzheimer's disease, the hippocampus is one of the first regions of the brain to suffer damage; memory loss and disorientation are among the early symptoms. Damage to the hippocampus can also result from oxygen starvation (hypoxia), encephalitis, or medial temporal lobe epilepsy.`;

    const { document, chunks } = service.ingestDocument({
      title: 'Neuroanatomy: Hippocampal Architecture',
      domain: 'medicine',
      sourceUri: 'https://med.mit.edu/neuro/hippocampus.pdf',
      author: 'Dr. Santiago',
      reliabilityScore: 0.95,
      content: technicalDoc,
      chunkSize: 200,
      chunkOverlap: 40,
    });

    expect(document.title).toBe('Neuroanatomy: Hippocampal Architecture');
    expect(document.domain).toBe('medicine');
    expect(document.reliabilityScore).toBe(0.95);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.content).toContain('hippocampus');
    expect(chunks[0]!.contentHash).toHaveLength(64);
  });

  it('2. KnowledgeBaseService indexes and retrieves relevant medical knowledge with provenance', async () => {
    const kb = new KnowledgeBaseService({ repo });

    await kb.ingestAndIndex({
      title: 'Principles of Internal Medicine',
      domain: 'medicine',
      sourceUri: 'https://harrison.med/ch3.html',
      author: 'Harrison',
      reliabilityScore: 0.98,
      content: 'Hypoglycemia is defined as a plasma glucose concentration low enough to cause symptoms, typically below 70 mg/dL. Symptoms include sweating, tremors, tachycardia, confusion, and dizziness.',
    });

    await kb.ingestAndIndex({
      title: 'Quantum Field Theory',
      domain: 'physics',
      sourceUri: 'https://arxiv.org/abs/hep-th/0001',
      author: 'Weinberg',
      reliabilityScore: 0.92,
      content: 'In quantum field theory, particle interactions are represented by Feynman diagrams and calculated using perturbation theory in Fock space.',
    });

    const searchResults = await kb.search('glucose plasma concentration symptoms', { domain: 'medicine' });

    expect(searchResults.length).toBeGreaterThan(0);
    const topResult = searchResults[0]!;
    expect(topResult.documentTitle).toBe('Principles of Internal Medicine');
    expect(topResult.domain).toBe('medicine');
    expect(topResult.reliabilityScore).toBe(0.98);
    expect(topResult.chunk.content).toContain('Hypoglycemia');
    expect(topResult.score).toBeGreaterThan(0.3);
  });

  it('3. ResearchEvaluationEngine detects contradictions and synthesizes evidence-weighted resolutions', () => {
    const engine = new ResearchEvaluationEngine();

    const academicEval = engine.evaluateSource('https://ncbi.nlm.nih.gov/pmc/articles/PMC1234567/', 'Dr. Alice Smith');
    expect(academicEval.recommendation).toBe('trust');
    expect(academicEval.credibilityScore).toBeGreaterThanOrEqual(0.85);

    const blogEval = engine.evaluateSource('http://miracle-cures-daily.xyz/page', 'Anonymous', 'CLICK HERE for 100% Guaranteed miracle remedy');
    expect(blogEval.recommendation).toBe('unreliable');
    expect(blogEval.credibilityScore).toBeLessThan(0.4);

    const mockSearchResults: any[] = [
      {
        documentTitle: 'Lancet Randomized Trial on Drug X',
        reliabilityScore: 0.95,
        chunk: { content: 'Drug X is effective and proven to significantly reduce inflammatory cytokines.' },
      },
      {
        documentTitle: 'Preliminary Anecdotal Blog',
        reliabilityScore: 0.40,
        chunk: { content: 'Drug X is ineffective and false claims have been made regarding its benefits.' },
      },
    ];

    const analysis = engine.analyzeContradictions('Drug X Efficacy', mockSearchResults);

    expect(analysis.hasContradiction).toBe(true);
    expect(analysis.conflictingClaims).toHaveLength(2);
    expect(analysis.synthesizedResolution).toContain('Lancet Randomized Trial');
    expect(analysis.synthesizedResolution).toContain('0.95');
  });

  it('4. CapabilityAssessment & TrainingDataEngine recommend LoRA and construct balanced datasets for PhD-level medicine', () => {
    const assessment = new ModelCapabilityAssessmentEngine();

    const metric = assessment.assessCapability('medicine', {
      recentQueries: 20,
      failedTasks: 8,
      averageConfidence: 0.55,
      terminologyComplexity: 'phd_level',
    });

    expect(metric.recommendedModality).toBe('lora');

    const dataEngine = new TrainingDataEngine();
    const mockChunks = [
      { id: 'c1', content: 'Cerebrospinal fluid is produced predominantly by the choroid plexus of the lateral, third, and fourth ventricles.' },
      { id: 'c2', content: 'Glomerular filtration rate is regulated by intrinsic autoregulation (myogenic mechanism and tubuloglomerular feedback).' },
      { id: 'c3', content: 'The Frank-Starling law of the heart states that the stroke volume increases in response to an increase in end-diastolic volume.' },
      { id: 'c4', content: 'Renin is an aspartic protease secreted by the juxtaglomerular cells of the kidney in response to low arterial pressure.' },
      { id: 'c5', content: 'Action potentials in cardiac myocytes exhibit a prolonged plateau phase mediated by L-type calcium channels.' },
    ];

    const { trainSet, evalSet } = dataEngine.generateTrainingData('medicine', mockChunks);

    expect(trainSet.length).toBe(4);
    expect(evalSet.length).toBe(1);
    expect(trainSet[0]!.instruction).toContain('Explain the mechanisms');
    expect(trainSet[0]!.response).toBeTruthy();
  });

  it('5. LoRATrainingEngine trains adapter, evaluates benchmark gain, and registers approved record', async () => {
    const mockDriver = {
      executeTraining: vi.fn().mockResolvedValue({
        success: true,
        weightsPath: '/models/lora/medicine_specialist.safetensors',
      }),
    };

    const trainer = new LoRATrainingEngine({
      repo,
      driver: mockDriver,
    });

    const mockDataset = [
      { instruction: 'What produces CSF?', response: 'Choroid plexus.' },
    ];

    const adapter = await trainer.trainAdapter({
      name: 'Arle Medical Specialist',
      domain: 'medicine',
      baseModelId: 'Qwen2.5-14B-Uncensored',
      dataset: mockDataset,
      evalSet: mockDataset,
      config: { rank: 16, alpha: 32, epochs: 3 },
      baselineAccuracy: 0.60,
    });

    expect(adapter.status).toBe('registered');
    expect(adapter.weightsPath).toBe('/models/lora/medicine_specialist.safetensors');
    expect(adapter.evaluationMetrics?.approvedForDeployment).toBe(true);
    expect(adapter.evaluationMetrics?.targetDomainScore).toBeGreaterThan(0.70);
    expect(adapter.evaluationMetrics?.generalKnowledgeRetention).toBeGreaterThanOrEqual(0.95);
    expect(mockDriver.executeTraining).toHaveBeenCalledTimes(1);

    const saved = repo.getLoraAdapter(adapter.id);
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe('Arle Medical Specialist');
  });

  it('6. AdapterLifecycleManager deploys approved adapter and performs automatic rollback upon regression', () => {
    const manager = new AdapterLifecycleManager(repo);

    const adapterRecord: any = {
      id: 'adapter-med-1',
      name: 'Clinical Diagnostics LoRA',
      domain: 'medicine',
      baseModelId: 'Qwen2.5-14B-Uncensored',
      status: 'registered',
      config: { rank: 16, alpha: 32, learningRate: 0.0002, epochs: 3, targetModules: ['q_proj'], batchSize: 4 },
      evaluationMetrics: {
        targetDomainScore: 0.88,
        generalKnowledgeRetention: 0.97,
        forgettingScore: 0.03,
        latencyP95Ms: 45,
        approvedForDeployment: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    repo.saveLoraAdapter(adapterRecord);

    // Deploy
    const deployed = manager.deployAdapter('adapter-med-1');
    expect(deployed.status).toBe('active');
    expect(manager.getActiveAdapter()?.id).toBe('adapter-med-1');

    // Rollback
    const rollbackRes = manager.rollbackActiveAdapter('Regression detected in conversational coherence');
    expect(rollbackRes.rolledBackId).toBe('adapter-med-1');
    expect(rollbackRes.newStatus).toBe('base_model');
    expect(manager.getActiveAdapter()).toBeNull();

    const rolledBackRecord = repo.getLoraAdapter('adapter-med-1');
    expect(rolledBackRecord?.status).toBe('rolled_back');
  });
});
