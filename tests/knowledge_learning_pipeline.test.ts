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
import { KnowledgeBaseService } from '@arletex/core';
import { LearnTopicInputSchema, LearnProgressChunkSchema } from '@arletex/contracts';

describe('Knowledge Learning Pipeline & UI Hub', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let knowledgeRepo: SqliteKnowledgeRepository;
  let memoryRepo: MemoryRepository;
  let knowledgeBaseService: KnowledgeBaseService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-learn-test-'));
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

  it('validates LearnTopicInputSchema and LearnProgressChunkSchema', () => {
    const valid = LearnTopicInputSchema.parse({
      topic: 'Quantum Error Correction',
      domain: 'tech',
      content: 'Surface codes and stabilizer formalisms enable fault-tolerant quantum computing.',
    });
    expect(valid.topic).toBe('Quantum Error Correction');
    expect(valid.domain).toBe('tech');

    const progressChunk = LearnProgressChunkSchema.parse({
      topic: 'Quantum Error Correction',
      stage: 'embedding',
      progress: 65,
      message: 'Computing vector embeddings via EmbeddingGemma...',
    });
    expect(progressChunk.progress).toBe(65);
    expect(progressChunk.stage).toBe('embedding');
  });

  it('ingests, chunks, embeds, and indexes document into SQLite', async () => {
    const topic = 'Epigenetics and Chromatin Remodeling';
    const content = `# ${topic}
## Overview
Epigenetics is the study of heritable phenotype changes that do not involve alterations in the DNA sequence.
## Mechanisms
Key mechanisms include DNA methylation, histone modification, and non-coding RNA regulation.
## Biological Function
It controls cellular differentiation and developmental gene expression.`;

    const res = await knowledgeBaseService.ingestAndIndex({
      title: topic,
      domain: 'medicine',
      content,
      sourceUri: 'user://study/epigenetics',
      author: 'User / Arle Learning Hub',
      reliabilityScore: 0.95,
    });

    expect(res.chunksCount).toBeGreaterThan(0);
    expect(res.document.title).toBe(topic);

    // Verify document was persisted in repository
    const retrieved = knowledgeRepo.getDocument(res.document.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.title).toBe(topic);
    expect(retrieved?.domain).toBe('medicine');

    // Verify listed documents
    const list = knowledgeRepo.listDocuments('medicine');
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]?.title).toBe(topic);
  });

  it('creates semantic autobiographical memory linking the learned knowledge', async () => {
    const topic = 'Rust Async Concurrency';
    const memory = memoryRepo.create({
      type: 'semantic',
      content: `Assimilated in-depth knowledge on "${topic}" (tech domain). Indexed 3 chunks into long-term knowledge repository.`,
      rawObservation:
        'Tokio event loop, epoll/kqueue multiplexing, pin projection, and waker mechanics.',
      tags: ['learned_knowledge', 'tech', 'study', 'rust'],
      importance: 0.9,
      confidence: 0.95,
      provenance: 'self_reflection',
      metadata: {
        topic,
        chunksCount: 3,
        sourceUri: 'user://study/rust',
      },
    });

    expect(memory.id).toBeDefined();
    expect(memory.type).toBe('semantic');
    expect(memory.tags).toContain('learned_knowledge');

    const retrievedMem = memoryRepo.getById(memory.id, false);
    expect(retrievedMem?.content).toContain(topic);
  });

  it('correctly matches natural conversational learning commands in chat', () => {
    const regex =
      /^\s*(?:arle[,.]?\s*)?(?:please\s+)?(?:go\s+)?(?:learn|study|research|assimilate|read up on|ingest)\s+(?:about\s+)?(.+)/i;

    const testPhrases = [
      { input: 'Arle, go learn about Quantum Computing', expected: 'Quantum Computing' },
      { input: 'arle please learn about astrophysics.', expected: 'astrophysics' },
      { input: 'go learn about General Relativity', expected: 'General Relativity' },
      { input: 'study Rust Memory Safety', expected: 'Rust Memory Safety' },
      { input: 'research CRISPR gene editing', expected: 'CRISPR gene editing' },
      { input: 'assimilate French Impressionism', expected: 'French Impressionism' },
      { input: 'read up on ancient Roman architecture', expected: 'ancient Roman architecture' },
      { input: 'ingest about neural radiance fields', expected: 'neural radiance fields' },
    ];

    for (const { input, expected } of testPhrases) {
      const match = input.match(regex);
      expect(match).not.toBeNull();
      const extracted = match![1]!.trim().replace(/[.!?]+$/, '');
      expect(extracted.toLowerCase()).toBe(expected.toLowerCase());
    }
  });
});
