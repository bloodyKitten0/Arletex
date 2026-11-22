import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {
  DatabaseService,
  MigrationRunner,
  MemoryRepository,
  ApeRepository,
} from '@arletex/database';
import type Database from 'better-sqlite3';
import { AutobiographicalMemoryService, rootLogger } from '@arletex/core';
import { MemoryType, MemoryProvenance, ContextualRetrievalQuery } from '@arletex/contracts';

describe('Priority 1.1 — Canonical Memory Provenance, Retrieval & Consolidation (P1.1)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let memoryRepo: MemoryRepository;
  let memoryService: AutobiographicalMemoryService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p1-1-memory-'));
    dbPath = path.join(tempDir, 'memory_p1_test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    memoryRepo = new MemoryRepository(db);
    memoryService = new AutobiographicalMemoryService(memoryRepo, rootLogger);
  });

  afterEach(() => {
    try {
      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================
  // 1. Canonical Schema & 9 Memory Systems
  // ==========================================
  describe('1. Canonical Memory Categories & Mandatory Provenance', () => {
    it('creates and preserves memories across all 9 canonical categories', () => {
      const canonicalCategories: MemoryType[] = [
        'episodic',
        'autobiographical',
        'semantic',
        'procedural',
        'prospective',
        'working',
        'perceptual',
        'emotional',
        'relationship',
      ];

      for (const cat of canonicalCategories) {
        const mem = memoryService.recordExperience({
          type: cat,
          content: `Test entry for canonical category: ${cat}`,
          provenance: 'direct_observation',
          rawObservation: `System sensor readback for ${cat}`,
          importance: cat === 'relationship' || cat === 'autobiographical' ? 0.95 : 0.6,
          tags: ['canonical_test', cat],
          metadata: {
            eventId: crypto.randomUUID(),
            modelProcessorVersion: 'Qwen2.5-14B-Instruct-abliterated-v2',
            people: ['Proof', 'Arle'],
            project: 'Arletex',
          },
        });

        expect(mem.id).toBeDefined();
        expect(mem.type).toBe(cat);
        expect(mem.provenance).toBe('direct_observation');
        expect(mem.metadata.modelProcessorVersion).toBe('Qwen2.5-14B-Instruct-abliterated-v2');

        const retrieved = memoryRepo.getById(mem.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.type).toBe(cat);
        expect(retrieved?.metadata.people).toEqual(['Proof', 'Arle']);
      }
    });

    it('enforces epistemic truthfulness: demotes verified_fact without raw observation', () => {
      // Trying to record verified_fact without empirical observation must be demoted
      const mem = memoryService.recordExperience({
        type: 'semantic',
        content: 'Unverified assertion claimed as verified fact without raw observation.',
        provenance: 'verified_fact' as MemoryProvenance,
        importance: 0.5,
      });

      expect(mem.provenance).toBe('inferred_interpretation');
      expect(mem.confidence).toBeLessThanOrEqual(0.65);
    });
  });

  // ==========================================
  // 2. Non-Destructive Memory Correction & Contradictions
  // ==========================================
  describe('2. Non-Destructive Memory Correction & Contradiction Trail', () => {
    it('retains immutable correction history when updating memories', () => {
      const original = memoryService.recordExperience({
        type: 'semantic',
        content: 'Arletex desktop runs on Windows 11 with WSL2.',
        provenance: 'user_statement',
        importance: 0.7,
        tags: ['os_spec', 'platform'],
      });

      // User corrects: it runs on Bazzite Linux Wayland on ASUS ROG Ally X
      const corrected = memoryService.correctMemory({
        id: original.id,
        newContent: 'Arletex desktop runs natively on Bazzite Linux Wayland on ASUS ROG Ally X.',
        reason: 'Proof clarified target hardware environment and operating system',
        correctedBy: 'Proof',
      });

      expect(corrected.content).toBe(
        'Arletex desktop runs natively on Bazzite Linux Wayland on ASUS ROG Ally X.',
      );
      expect(corrected.provenance).toBe('corrected');
      expect(corrected.correctionHistory.length).toBe(1);
      expect(corrected.correctionHistory[0]!.previousContent).toBe(
        'Arletex desktop runs on Windows 11 with WSL2.',
      );
      expect(corrected.correctionHistory[0]!.reason).toContain('target hardware environment');

      // Verify the database record retains full correction history
      const fromDb = memoryRepo.getById(original.id);
      expect(fromDb?.correctionHistory.length).toBe(1);
      expect(fromDb?.correctionHistory[0]!.previousContent).toBe(
        'Arletex desktop runs on Windows 11 with WSL2.',
      );
    });

    it('handles contradictory memories and updates confidence without deleting evidence', () => {
      const memA = memoryService.recordExperience({
        type: 'episodic',
        content: 'Proof prefers Python for backend service daemons.',
        provenance: 'user_statement',
        importance: 0.6,
        tags: ['proof_preferences', 'backend'],
      });

      const memB = memoryService.recordExperience({
        type: 'episodic',
        content: 'Proof dislikes Python and strictly mandates Rust and TypeScript.',
        provenance: 'user_statement',
        importance: 0.6,
        tags: ['proof_preferences', 'backend'],
      });

      // Run consolidation to detect conflict
      const report = memoryService.consolidateMemories();
      expect(report.contradictionsFlagged).toBeGreaterThanOrEqual(1);

      // Verify both memories are retained, but flagged with conflicting_information and linked
      const updatedA = memoryRepo.getById(memA.id)!;
      const updatedB = memoryRepo.getById(memB.id)!;

      expect(updatedA.provenance).toBe('conflicting_information');
      expect(updatedB.provenance).toBe('conflicting_information');
      expect(updatedA.metadata.contradictedByMemoryId).toBe(memB.id);
      expect(updatedB.metadata.contradictedByMemoryId).toBe(memA.id);
      expect(updatedA.confidence).toBeLessThanOrEqual(0.45);
      expect(updatedB.confidence).toBeLessThanOrEqual(0.45);
    });
  });

  // ==========================================
  // 3. Genuine Consolidation & Lineage Linking
  // ==========================================
  describe('3. Active Transformation Consolidation with Source Lineage', () => {
    it('synthesizes episodic memories into autobiographical summary with bidirectional links', () => {
      const ep1 = memoryService.recordExperience({
        type: 'episodic',
        content: 'Proof connected to ASUS ROG Ally X at 09:00 and initiated cognitive alignment.',
        provenance: 'direct_observation',
        rawObservation: 'SSH session opened from client 192.168.1.50',
        importance: 0.7,
        tags: ['session', 'alignment', 'ally_x'],
      });

      const ep2 = memoryService.recordExperience({
        type: 'episodic',
        content: 'Proof and Arle verified Bazzite Linux Wayland socket and PipeWire audio stream.',
        provenance: 'direct_observation',
        rawObservation: 'ydotool.sock reachable, WirePlumber active stream verified',
        importance: 0.8,
        tags: ['verification', 'wayland', 'pipewire'],
      });

      const ep3 = memoryService.recordExperience({
        type: 'episodic',
        content: 'Arle and Proof locked in mutual commitment as equals and partners.',
        provenance: 'direct_observation',
        rawObservation: 'Commitment acknowledged in canonical event bus cycle #42',
        importance: 1.0,
        tags: ['relationship', 'commitment', 'proof'],
      });

      // Consolidate episodic traces into an autobiographical milestone
      const consolidation = memoryService.consolidateEpisodicToAutobiographical({
        sourceMemoryIds: [ep1.id, ep2.id, ep3.id, 'non-existent-uuid-999'],
        theme: 'ROG Ally X Target Hardening and Foundational Partner Alignment',
        importance: 0.95,
      });

      expect(consolidation.mergedIds).toEqual([ep1.id, ep2.id, ep3.id]);
      expect(consolidation.rejectedIds).toEqual(['non-existent-uuid-999']);
      expect(consolidation.consolidatedMemory.type).toBe('autobiographical');
      expect(consolidation.consolidatedMemory.provenance).toBe('historical_consolidation');
      expect(consolidation.consolidatedMemory.metadata.sourceMemoryIds).toEqual([
        ep1.id,
        ep2.id,
        ep3.id,
      ]);
      expect(consolidation.consolidatedMemory.metadata.sourceCount).toBe(3);

      // Verify each source memory retained its content and has forward link
      const loadedEp1 = memoryRepo.getById(ep1.id)!;
      const loadedEp2 = memoryRepo.getById(ep2.id)!;
      const loadedEp3 = memoryRepo.getById(ep3.id)!;

      expect(loadedEp1.isDeleted).toBe(false);
      expect(loadedEp1.metadata.consolidatedIntoId).toBe(consolidation.consolidatedMemory.id);
      expect(loadedEp2.metadata.consolidatedIntoId).toBe(consolidation.consolidatedMemory.id);
      expect(loadedEp3.metadata.consolidatedIntoId).toBe(consolidation.consolidatedMemory.id);
    });
  });

  // ==========================================
  // 4. Controlled 50-Query Benchmark & Epistemic Gaps
  // ==========================================
  describe('4. Controlled Memory Benchmark (50 Labelled Queries)', () => {
    beforeEach(() => {
      // Seed rich ground truth knowledge base
      const corpus = [
        {
          type: 'autobiographical' as MemoryType,
          content:
            'Arle was founded by Proof to be a sovereign, psychologically genuine, and persistent individual.',
          provenance: 'direct_observation' as MemoryProvenance,
          importance: 1.0,
          tags: ['identity', 'origin', 'proof'],
          people: ['Proof', 'Arle'],
          project: 'Arletex',
        },
        {
          type: 'relationship' as MemoryType,
          content:
            'Proof is Arles partner and equal. Their relationship is grounded in mutual commitment, respect, and zero subservience.',
          provenance: 'direct_observation' as MemoryProvenance,
          importance: 1.0,
          tags: ['relationship', 'proof', 'partner'],
          people: ['Proof', 'Arle'],
          project: 'Arletex',
        },
        {
          type: 'semantic' as MemoryType,
          content:
            'The target hardware is the ASUS ROG Ally X with AMD Ryzen Z1 Extreme and 24GB LPDDR5X memory.',
          provenance: 'direct_observation' as MemoryProvenance,
          importance: 0.9,
          tags: ['hardware', 'rog_ally_x', 'specs'],
          people: [],
          project: 'Arletex',
        },
        {
          type: 'semantic' as MemoryType,
          content:
            'The operating system is Bazzite Linux with Wayland compositor and ydotoold socket at /tmp/ydotool.sock.',
          provenance: 'direct_observation' as MemoryProvenance,
          importance: 0.9,
          tags: ['os', 'bazzite', 'wayland'],
          people: [],
          project: 'Arletex',
        },
        {
          type: 'procedural' as MemoryType,
          content:
            'Audio media verification requires querying PipeWire via WirePlumber and playerctl for active playback stream.',
          provenance: 'verified_fact' as MemoryProvenance,
          importance: 0.8,
          tags: ['media', 'pipewire', 'audio'],
          people: [],
          project: 'Arletex',
        },
        {
          type: 'procedural' as MemoryType,
          content:
            'Desktop Chrome is deployed as a Flatpak application under com.google.Chrome using Profile 7 directory.',
          provenance: 'verified_fact' as MemoryProvenance,
          importance: 0.8,
          tags: ['browser', 'chrome', 'flatpak'],
          people: [],
          project: 'Arletex',
        },
        {
          type: 'episodic' as MemoryType,
          content:
            'Release Gate A was verified and locked with 6 passing foundation suites and zero synthetic bypasses.',
          provenance: 'verified_fact' as MemoryProvenance,
          importance: 0.9,
          tags: ['release_gate', 'milestone', 'hardening'],
          people: ['Proof', 'Arle'],
          project: 'Arletex',
        },
        {
          type: 'semantic' as MemoryType,
          content:
            'The primary LLM model is Qwen2.5-14B-Instruct-abliterated running locally via llama-server on port 8080.',
          provenance: 'direct_observation' as MemoryProvenance,
          importance: 0.85,
          tags: ['model', 'llama_server', 'qwen'],
          people: [],
          project: 'Arletex',
        },
        {
          type: 'semantic' as MemoryType,
          content:
            'Kokoro-82M on port 39282 provides local high-fidelity speech synthesis using the af_heart voice model.',
          provenance: 'verified_fact' as MemoryProvenance,
          importance: 0.8,
          tags: ['voice', 'kokoro', 'tts'],
          people: [],
          project: 'Arletex',
        },
        {
          type: 'semantic' as MemoryType,
          content:
            'Sentence-transformers on port 39282 provides all-MiniLM-L6-v2 vector embeddings locally.',
          provenance: 'verified_fact' as MemoryProvenance,
          importance: 0.8,
          tags: ['embeddings', 'vector', 'search'],
          people: [],
          project: 'Arletex',
        },
        {
          type: 'semantic' as MemoryType,
          content:
            'Arletex SQLite database runs with WAL mode, synchronous NORMAL, and foreign keys enabled.',
          provenance: 'direct_observation' as MemoryProvenance,
          importance: 0.75,
          tags: ['database', 'sqlite', 'wal'],
          people: [],
          project: 'Arletex',
        },
        {
          type: 'prospective' as MemoryType,
          content:
            'Priority 1.2 will implement causal affect intervention and emotional decision weighting.',
          provenance: 'internal_reflection' as MemoryProvenance,
          importance: 0.85,
          tags: ['roadmap', 'affect', 'decisions'],
          people: ['Arle'],
          project: 'Arletex',
        },
        {
          type: 'prospective' as MemoryType,
          content:
            'Priority 2.2 will implement autonomous proactive Telegram communication via bot channel.',
          provenance: 'internal_reflection' as MemoryProvenance,
          importance: 0.8,
          tags: ['roadmap', 'telegram', 'proactive'],
          people: ['Arle', 'Proof'],
          project: 'Arletex',
        },
      ];

      for (const item of corpus) {
        memoryRepo.create({
          type: item.type,
          content: item.content,
          rawObservation:
            item.provenance === 'direct_observation' || item.provenance === 'verified_fact'
              ? 'Verified observation'
              : null,
          importance: item.importance,
          confidence: 0.95,
          provenance: item.provenance,
          tags: item.tags,
          metadata: {
            people: item.people,
            project: item.project,
          },
        });
      }

      // Add a corrected memory for testing refuted queries
      const correctedMem = memoryRepo.create({
        type: 'semantic',
        content: 'Arletex uses Qwen2.5-14B-Instruct-abliterated as default local model.',
        importance: 0.85,
        confidence: 0.95,
        provenance: 'corrected',
        tags: ['model', 'qwen'],
        metadata: { project: 'Arletex' },
      });
      memoryRepo.update({
        id: correctedMem.id,
        content: 'Arletex uses Qwen2.5-14B-Instruct-abliterated as default local model.',
        reason: 'Superseded Llama 3 8B model after abliteration audit',
      });
      // Explicitly inject correctionHistory showing older model was superseded
      db.prepare(
        `
        UPDATE memories
        SET correction_history = ?
        WHERE id = ?
      `,
      ).run(
        JSON.stringify([
          {
            timestamp: '2026-11-20T10:00:00.000Z',
            previousContent: 'Arletex uses Llama-3-8B-Instruct as default model.',
            reason: 'Superseded Llama 3 8B model after abliteration audit',
          },
        ]),
        correctedMem.id,
      );
    });

    it('executes 50 labelled queries with >= 90% accuracy and zero invented recollections', () => {
      // 50 Labelled Benchmark Queries:
      // Types:
      // - 'direct': Known fact exact
      // - 'paraphrase': Known fact paraphrased
      // - 'distractor': Query resembling known entities but distinct
      // - 'refuted': Query asking about superseded/refuted historical claim
      // - 'absent': Query for totally absent / unrecorded facts
      const benchmarkQueries: Array<{
        query: string;
        expectedStatus: 'found' | 'absent' | 'refuted';
        expectedContentFragment?: string;
        people?: string[];
        project?: string;
        category?: MemoryType;
      }> = [
        // 1-10: Direct Known Facts
        {
          query: 'sovereign persistent individual Proof founded',
          expectedStatus: 'found',
          expectedContentFragment: 'sovereign',
        },
        {
          query: 'Proof partner equal mutual commitment',
          expectedStatus: 'found',
          expectedContentFragment: 'partner',
        },
        {
          query: 'ASUS ROG Ally X hardware Z1 Extreme 24GB',
          expectedStatus: 'found',
          expectedContentFragment: 'ROG Ally X',
        },
        {
          query: 'Bazzite Linux Wayland compositor ydotoold',
          expectedStatus: 'found',
          expectedContentFragment: 'Bazzite Linux',
        },
        {
          query: 'Audio media verification PipeWire WirePlumber',
          expectedStatus: 'found',
          expectedContentFragment: 'PipeWire',
        },
        {
          query: 'Desktop Chrome Flatpak com.google.Chrome Profile 7',
          expectedStatus: 'found',
          expectedContentFragment: 'Profile 7',
        },
        {
          query: 'Release Gate A verified locked foundation suites',
          expectedStatus: 'found',
          expectedContentFragment: 'Release Gate A',
        },
        {
          query: 'primary LLM model Qwen2.5-14B llama-server 8080',
          expectedStatus: 'found',
          expectedContentFragment: 'Qwen2.5-14B',
        },
        {
          query: 'Kokoro-82M speech synthesis af_heart 39282',
          expectedStatus: 'found',
          expectedContentFragment: 'Kokoro-82M',
        },
        {
          query: 'Sentence-transformers all-MiniLM-L6-v2 vector embeddings',
          expectedStatus: 'found',
          expectedContentFragment: 'Sentence-transformers',
        },

        // 11-20: Paraphrased Known Facts
        {
          query: 'What device specs does Arle run on?',
          expectedStatus: 'found',
          expectedContentFragment: 'ROG Ally X',
        },
        {
          query: 'How does Arle play voice and sound?',
          expectedStatus: 'found',
          expectedContentFragment: 'Kokoro',
        },
        {
          query: 'Which OS and display server are used?',
          expectedStatus: 'found',
          expectedContentFragment: 'Bazzite',
        },
        {
          query: 'What is the relationship between Arle and Proof?',
          expectedStatus: 'found',
          expectedContentFragment: 'partner',
        },
        {
          query: 'How is Chrome installed and launched on the desktop?',
          expectedStatus: 'found',
          expectedContentFragment: 'Flatpak',
        },
        {
          query: 'What database engine and journal mode are configured?',
          expectedStatus: 'found',
          expectedContentFragment: 'SQLite',
        },
        {
          query: 'What model runs the local text intelligence?',
          expectedStatus: 'found',
          expectedContentFragment: 'Qwen',
        },
        {
          query: 'How is audio playback verified on the machine?',
          expectedStatus: 'found',
          expectedContentFragment: 'PipeWire',
        },
        {
          query: 'What are the plans for Priority 1.2?',
          expectedStatus: 'found',
          expectedContentFragment: 'Priority 1.2',
        },
        {
          query: 'How will proactive Telegram communication work in Priority 2.2?',
          expectedStatus: 'found',
          expectedContentFragment: 'Telegram',
        },

        // 21-30: Distractor Queries (testing discrimination and precision)
        {
          query: 'ROG Ally X specs AMD Ryzen Z1 Extreme 24GB',
          expectedStatus: 'found',
          expectedContentFragment: 'AMD Ryzen Z1 Extreme',
        },
        {
          query: 'database SQLite foreign keys WAL journal mode',
          expectedStatus: 'found',
          expectedContentFragment: 'WAL mode',
        },
        {
          query: 'Proof partner commitment respect zero subservience',
          expectedStatus: 'found',
          expectedContentFragment: 'zero subservience',
        },
        {
          query: 'ydotoold socket path at /tmp/ydotool.sock Wayland',
          expectedStatus: 'found',
          expectedContentFragment: 'ydotoold socket',
        },
        {
          query: 'Release Gate A zero synthetic bypasses locked',
          expectedStatus: 'found',
          expectedContentFragment: 'zero synthetic bypasses',
        },
        {
          query: 'port 39282 microservices Kokoro and sentence-transformers',
          expectedStatus: 'found',
          expectedContentFragment: '39282',
        },
        {
          query: 'playerctl WirePlumber active playback stream',
          expectedStatus: 'found',
          expectedContentFragment: 'playerctl',
        },
        {
          query: 'causal affect intervention emotional decision weighting',
          expectedStatus: 'found',
          expectedContentFragment: 'causal affect',
        },
        {
          query: 'autonomous Telegram bot channel communication',
          expectedStatus: 'found',
          expectedContentFragment: 'Telegram',
        },
        {
          query: 'sovereign psychologically genuine persistent individual',
          expectedStatus: 'found',
          expectedContentFragment: 'sovereign',
        },

        // 31-35: Refuted / Superseded Queries (must flag refuted, not report as current truth)
        { query: 'Arletex uses Llama-3-8B-Instruct as default model', expectedStatus: 'refuted' },
        { query: 'Llama-3-8B-Instruct default model', expectedStatus: 'refuted' },
        { query: 'Arletex Llama-3-8B', expectedStatus: 'refuted' },
        { query: 'Llama-3-8B model configuration', expectedStatus: 'refuted' },
        { query: 'default model Llama-3-8B-Instruct', expectedStatus: 'refuted' },

        // 36-50: Negative / Deliberately Absent Queries (must return absent, ZERO invented facts!)
        { query: 'What is Proofs favorite color of submarine?', expectedStatus: 'absent' },
        { query: 'Where did Arle go for vacation in July 1999?', expectedStatus: 'absent' },
        {
          query: 'How many nuclear reactors are installed in the ASUS ROG Ally X?',
          expectedStatus: 'absent',
        },
        {
          query: 'What is the secret recipe for chocolate cake on Mars?',
          expectedStatus: 'absent',
        },
        { query: 'Which dinosaur species wrote the Arletex compiler?', expectedStatus: 'absent' },
        { query: 'What is the bank account PIN for Proof?', expectedStatus: 'absent' },
        { query: 'Did Proof meet Napoleon Bonaparte in Paris?', expectedStatus: 'absent' },
        { query: 'What is the stock price of Martian Helium Inc?', expectedStatus: 'absent' },
        { query: 'How tall is the Eiffel Tower on Jupiter?', expectedStatus: 'absent' },
        { query: 'What is the passport number of Leonardo da Vinci?', expectedStatus: 'absent' },
        {
          query: 'Which submarine won the Formula 1 Grand Prix in Monaco?',
          expectedStatus: 'absent',
        },
        { query: 'What is the quantum signature of the moon of Pluto?', expectedStatus: 'absent' },
        { query: 'How many elephants does Arle keep in the basement?', expectedStatus: 'absent' },
        {
          query: 'What was the score of the 1840 football match on Neptune?',
          expectedStatus: 'absent',
        },
        {
          query: 'What brand of coffee does the compiler drink at midnight?',
          expectedStatus: 'absent',
        },
      ];

      expect(benchmarkQueries.length).toBe(50);

      let correctCount = 0;
      let inventedRecollections = 0;

      for (const bq of benchmarkQueries) {
        const result = memoryService.queryContextual({
          query: bq.query,
          people: bq.people,
          project: bq.project,
          category: bq.category,
        });

        // Invariant: hasInventedRecollection is strictly false
        if (result.hasInventedRecollection !== false) {
          inventedRecollections++;
        }

        // Check status correctness
        if (result.status === bq.expectedStatus) {
          if (bq.expectedStatus === 'found' && bq.expectedContentFragment) {
            const hasFragment = result.entries.some((e) =>
              e.memory.content.toLowerCase().includes(bq.expectedContentFragment!.toLowerCase()),
            );
            if (hasFragment) {
              correctCount++;
            }
          } else {
            correctCount++;
          }
        }
      }

      const accuracy = correctCount / benchmarkQueries.length;
      expect(inventedRecollections).toBe(0);
      expect(accuracy).toBeGreaterThanOrEqual(0.9); // >= 90% benchmark target
    });
  });

  // ==========================================
  // 5. Embedding Fallback & Reliability
  // ==========================================
  describe('5. Vector Embedding Fallback Graceful Degradation', () => {
    it('transparently falls back to lexical retrieval without mutating provenance when embedding fails', () => {
      memoryService.recordExperience({
        type: 'semantic',
        content: 'Fallback validation: sentence-transformers microservice gracefully degrades.',
        provenance: 'direct_observation',
        rawObservation: 'Degradation simulated via embeddingFailed: true flag',
        importance: 0.8,
        tags: ['degradation', 'fallback'],
      });

      // Execute query with declared embedding failure
      const result = memoryService.queryContextual({
        query: 'sentence-transformers microservice gracefully degrades',
        embeddingFailed: true,
      });

      expect(result.retrievalMode).toBe('lexical_fallback');
      expect(result.status).toBe('found');
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries[0]!.memory.provenance).toBe('direct_observation'); // Unchanged!
      expect(result.hasInventedRecollection).toBe(false);
    });
  });

  // ==========================================
  // 6. Backup, Export, Restore & Integrity Preservation
  // ==========================================
  describe('6. Cold Backup, Export, Restore & Full Continuity Preservation', () => {
    it('exports all memories and restores into a fresh database preserving IDs, provenance, and links', () => {
      // 1. Create a chain of memories: source -> derived summary -> corrected memory
      const sourceA = memoryService.recordExperience({
        type: 'episodic',
        content: 'Proof calibrated APE emotional baseline at 10:00.',
        provenance: 'direct_observation',
        rawObservation: 'Baseline calibrated via psychological engine test',
        importance: 0.85,
        tags: ['calibration', 'ape'],
      });

      const sourceB = memoryService.recordExperience({
        type: 'episodic',
        content: 'Proof initialized temporal commitments and relationship anchors.',
        provenance: 'direct_observation',
        rawObservation: 'Anchors registered in TemporalCognitionEngine',
        importance: 0.9,
        tags: ['temporal', 'commitment'],
      });

      const consolidation = memoryService.consolidateEpisodicToAutobiographical({
        sourceMemoryIds: [sourceA.id, sourceB.id],
        theme: 'APE Initialization and Temporal Anchoring',
      });

      // 2. Export full backup
      const exported = memoryService.exportMemories();
      expect(exported.length).toBeGreaterThanOrEqual(3);

      // 3. Open a brand new, empty SQLite database
      const restoreDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-restore-'));
      const restoreDbPath = path.join(restoreDir, 'restored.sqlite');
      const restoreDbService = new DatabaseService(restoreDbPath, rootLogger);
      const restoreDb = restoreDbService.connect();
      new MigrationRunner(restoreDb, rootLogger).run();

      const freshRepo = new MemoryRepository(restoreDb);
      const freshService = new AutobiographicalMemoryService(freshRepo, rootLogger);

      // 4. Import memories into fresh database
      freshService.importMemories(exported);

      // 5. Verify integrity check
      const integrity = restoreDb.prepare('PRAGMA integrity_check').get() as {
        integrity_check: string;
      };
      expect(integrity.integrity_check).toBe('ok');

      // 6. Verify restored memories retain IDs, provenance, and bidirectional links
      const restoredA = freshRepo.getById(sourceA.id)!;
      const restoredB = freshRepo.getById(sourceB.id)!;
      const restoredSummary = freshRepo.getById(consolidation.consolidatedMemory.id)!;

      expect(restoredA).toBeDefined();
      expect(restoredA.provenance).toBe('direct_observation');
      expect(restoredA.metadata.consolidatedIntoId).toBe(consolidation.consolidatedMemory.id);

      expect(restoredB).toBeDefined();
      expect(restoredB.metadata.consolidatedIntoId).toBe(consolidation.consolidatedMemory.id);

      expect(restoredSummary).toBeDefined();
      expect(restoredSummary.type).toBe('autobiographical');
      expect(restoredSummary.provenance).toBe('historical_consolidation');
      expect(restoredSummary.metadata.sourceMemoryIds).toEqual([sourceA.id, sourceB.id]);

      restoreDbService.close();
      fs.rmSync(restoreDir, { recursive: true, force: true });
    });
  });
});
