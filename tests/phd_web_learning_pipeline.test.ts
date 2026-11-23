import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MigrationRunner,
  SqliteKnowledgeRepository,
  MemoryRepository,
} from '@arletex/database';
import {
  KnowledgeBaseService,
  CurriculumDecomposer,
  WebResearchEngine,
  PhdKnowledgeAcquisitionService,
} from '@arletex/core';
import { LearnProgressChunk } from '@arletex/contracts';

describe('PhD Autonomous Web Research & Knowledge Assimilation Pipeline', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let knowledgeRepo: SqliteKnowledgeRepository;
  let memoryRepo: MemoryRepository;
  let knowledgeBaseService: KnowledgeBaseService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-phd-test-'));
    const dbPath = path.join(tempDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    knowledgeRepo = new SqliteKnowledgeRepository(db);
    memoryRepo = new MemoryRepository(db);
    knowledgeBaseService = new KnowledgeBaseService({ repo: knowledgeRepo });
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('CurriculumDecomposer decomposes Nuclear Engineering into 6 PhD modules with exact invariants', async () => {
    const decomposer = new CurriculumDecomposer();
    const modules = await decomposer.decomposeCurriculum('Nuclear Engineering', 'physics', 'phd');

    expect(modules.length).toBe(6);
    expect(modules[0]?.title).toContain('Neutron Transport');
    expect(modules[0]?.governingPrinciples).toContain('Boltzmann transport equation');
    expect(modules[1]?.title).toContain('Reactor Core Kinetics');
    expect(modules[1]?.governingPrinciples).toContain('Point Kinetics Equations');
    expect(modules[2]?.title).toContain('DNBR');
    expect(modules[2]?.governingPrinciples).toContain('Departure from Nucleate Boiling Ratio');
    expect(modules[3]?.title).toContain('Xenon');
    expect(modules[3]?.governingPrinciples).toContain('Xenon-135');
    expect(modules[4]?.title).toContain('Shielding');
    expect(modules[5]?.title).toContain('Generation IV');
  });

  it('CurriculumDecomposer correctly defines Hematology niches without reversing roles', async () => {
    const decomposer = new CurriculumDecomposer();
    const modules = await decomposer.decomposeCurriculum('Hematology HSC Niches', 'medicine', 'phd');

    expect(modules.length).toBeGreaterThanOrEqual(4);
    const nicheModule = modules.find((m) => m.title.includes('Niches'));
    expect(nicheModule).toBeDefined();

    // Verify arteriolar = quiescence, sinusoidal = activation/proliferation (correct PhD science)
    expect(nicheModule?.governingPrinciples).toContain('Arteriolar niches');
    expect(nicheModule?.governingPrinciples).toContain('quiescence');
    expect(nicheModule?.governingPrinciples).toContain('Sinusoidal');
    expect(nicheModule?.governingPrinciples).toContain('proliferation');
  });

  it('WebResearchEngine cleans academic text and searches Wikipedia API', async () => {
    const webEngine = new WebResearchEngine();
    const cleaned = webEngine.cleanAcademicText('Neutron transport equation [1][23] is fundamental.[edit]');
    expect(cleaned).toBe('Neutron transport equation  is fundamental.');

    // Test live Wikipedia API search
    const results = await webEngine.searchWikipedia('Neutron transport', 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.title).toBeDefined();
  });

  it('PhdKnowledgeAcquisitionService assimilates Nuclear Engineering end-to-end with live SSE chunks and vector RAG', async () => {
    const phdService = new PhdKnowledgeAcquisitionService({
      knowledgeBaseService,
      memoryRepo,
      llmEndpoint: 'http://127.0.0.1:8080',
      skipLlmSynthesis: true,
    });

    const progressEvents: LearnProgressChunk[] = [];
    const result = await phdService.learnPhdTopic(
      {
        topic: 'Nuclear Engineering',
        domain: 'physics',
        depth: 'phd',
        autonomousWebResearch: true,
      },
      (chunk) => {
        progressEvents.push(chunk);
      },
    );

    expect(result.success).toBe(true);
    expect(result.documents.length).toBe(6);
    expect(result.totalChunksCount).toBeGreaterThan(10);

    // Verify progress sequence
    expect(progressEvents.some((e) => e.stage === 'decomposing')).toBe(true);
    expect(progressEvents.some((e) => e.stage === 'searching_web')).toBe(true);
    expect(progressEvents.some((e) => e.stage === 'synthesizing')).toBe(true);
    expect(progressEvents.some((e) => e.stage === 'embedding')).toBe(true);
    expect(progressEvents.some((e) => e.stage === 'completed' && e.progress === 100)).toBe(true);

    // Verify documents and chunks stored in SQLite
    const docs = knowledgeRepo.listDocuments('physics');
    expect(docs.length).toBe(6);

    // Verify hybrid vector search retrieves exact governing equations
    const searchRes = await knowledgeBaseService.search(
      'What is the governing equation for neutron transport and angular flux?',
      { limit: 3, minScore: 0.15 },
    );

    expect(searchRes.length).toBeGreaterThan(0);
    const hasNeutronMatch = searchRes.some(
      (r) =>
        r.documentTitle.toLowerCase().includes('neutron transport') ||
        r.chunk.content.toLowerCase().includes('boltzmann'),
    );
    expect(hasNeutronMatch).toBe(true);

    // Verify semantic memories created
    const memories = memoryRepo.list({ limit: 10 });
    expect(memories.length).toBeGreaterThanOrEqual(6);
    const phdMemories = memories.filter((m) => m.content.includes('[PhD Mastery'));
    expect(phdMemories.length).toBe(6);
  });

  it('verifies live Vulkan llama-server LLM synthesis on port 8080', async () => {
    const res = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are an authoritative nuclear engineering professor.' },
          {
            role: 'user',
            content: 'State the linear Boltzmann neutron transport equation and define angular flux psi.',
          },
        ],
        max_tokens: 120,
        temperature: 0.2,
      }),
    });

    expect(res.ok).toBe(true);
    const data: any = await res.json();
    const msg = data.choices?.[0]?.message;
    const reply = (msg?.content || msg?.reasoning_content || '').trim();
    expect(reply.length).toBeGreaterThan(20);
    expect(reply.toLowerCase()).toMatch(/neutron|transport|flux/);
  });
});
