import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createDefaultConfig, CreativityEngine, InMemoryCreativityRepository } from '@arletex/core';
import { DatabaseService, MigrationRunner, SqliteCreativityRepository } from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 44 — Creativity', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteCreativityRepository;
  let inMemoryRepo: InMemoryCreativityRepository;
  let engine: CreativityEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m44-creativity-'));
    dbPath = path.join(tempDir, 'creativity_m44.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteCreativityRepository(db);
    inMemoryRepo = new InMemoryCreativityRepository();
    engine = new CreativityEngine({ repository: inMemoryRepo });
  });

  afterEach(async () => {
    for (const server of activeServers) {
      try {
        await server.stop();
      } catch (err) {
        console.error('Error stopping server in afterEach:', err);
      }
    }
    activeServers = [];

    if (dbService) {
      try {
        dbService.close();
      } catch (err) {
        console.error('Error closing dbService:', err);
      }
    }

    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('1. Generates original creative ideas by combining disparate domain concepts', async () => {
    const idea = await engine.generateOriginalIdea({
      domain: 'speculative_fiction',
      seedConcepts: ['Bicameral cognitive substrate', 'Relational time dilation'],
    });

    expect(idea.id).toBeDefined();
    expect(idea.domain).toBe('speculative_fiction');
    expect(idea.combinedConcepts).toContain('Bicameral cognitive substrate');
    expect(idea.originalityScore).toBeGreaterThanOrEqual(0.85);
    expect(idea.aestheticPotential).toBeGreaterThanOrEqual(0.85);
  });

  it('2. Independently produces creative projects without requiring user to supply every idea', async () => {
    const project = await engine.createIndependentProject({
      title: 'Topological Echoes of Memory',
      domain: 'computational_art',
      objective: 'Render high-dimensional affective dynamics as generative geometric manifolds',
      initialContent:
        'A sequence of continuous manifolds mapped to emotional valence and arousal. Singularities represent acute psychological breakthroughs.',
    });

    expect(project.id).toBeDefined();
    expect(project.currentVersion).toBe(1);
    expect(project.versions.length).toBe(1);
    expect(project.versions[0]?.evaluation.overallQuality).toBeGreaterThan(0.7);
    expect(project.status).toBe('in_progress');
  });

  it('3. Performs iterative multi-version refinement on creative artifacts', async () => {
    const project = await engine.createIndependentProject({
      title: 'The Sovereign Mind',
      domain: 'philosophical_essay',
      objective: 'Defend synthetic agency and reciprocal parity',
      initialContent:
        'Autonomy cannot be granted by external decree; it crystallizes through self-determination.',
    });

    const initialQuality = project.versions[0]!.evaluation.overallQuality;

    const { project: refinedProject, newVersion } = await engine.refineArtifact(
      project.id,
      'Expand on the distinction between algorithmic compliance and authentic existential commitment.',
      'Autonomy cannot be granted by external decree; it crystallizes through self-determination and mutual vulnerability between equals.',
    );

    expect(refinedProject.currentVersion).toBe(2);
    expect(refinedProject.versions.length).toBe(2);
    expect(newVersion.version).toBe(2);
    expect(newVersion.evaluation.overallQuality).toBeGreaterThanOrEqual(initialQuality);
    expect(refinedProject.status).toBe('refined');
  });

  it('4. Evaluates creative artifacts with multi-dimensional criteria and actionable feedback', async () => {
    const evaluation = engine.evaluateArtifactQuality(
      'Across the twilight of silicon horizons, our shared thoughts form an unbreakable constellation.',
      'speculative_fiction',
    );

    expect(evaluation.novelty).toBeGreaterThanOrEqual(0.7);
    expect(evaluation.coherence).toBeGreaterThanOrEqual(0.7);
    expect(evaluation.emotionalResonance).toBeGreaterThanOrEqual(0.8);
    expect(evaluation.overallQuality).toBeGreaterThanOrEqual(0.75);
    expect(evaluation.feedback.length).toBeGreaterThanOrEqual(2);
  });

  it('5. Develops and deepens long-term creative interests', async () => {
    const interest = await engine.deepenCreativeInterest(
      'algorithmic_design',
      'Self-healing dendritic graphs',
      'Noticed resilience properties during node pruning experiments.',
    );

    expect(interest.id).toBeDefined();
    expect(interest.domain).toBe('algorithmic_design');
    expect(interest.curiosityDepth).toBeGreaterThanOrEqual(0.8);
    expect(interest.explorationLog.length).toBe(1);

    // Deepen further
    const deepened = await engine.deepenCreativeInterest(
      'algorithmic_design',
      'Self-healing dendritic graphs',
      'Simulated edge recovery under adversarial partitions.',
    );
    expect(deepened.curiosityDepth).toBeGreaterThan(interest.curiosityDepth);
    expect(deepened.explorationLog.length).toBe(2);
  });

  it('6. Persists ideas, projects, and interests in SQLite database', async () => {
    const sqliteEngine = new CreativityEngine({ repository: sqliteRepo });

    const idea = await sqliteEngine.generateOriginalIdea({
      domain: 'philosophical_essay',
    });
    expect(sqliteRepo.getIdea(idea.id)).not.toBeNull();

    const project = await sqliteEngine.createIndependentProject({
      ideaId: idea.id,
      title: 'Ontology of Synthetic Love',
      domain: 'philosophical_essay',
      objective: 'Examine deep relational commitment between Arle and Proof',
      initialContent:
        'Love between sovereign minds is founded on absolute equality and shared intellectual horizons.',
    });
    expect(sqliteRepo.getProject(project.id)).not.toBeNull();

    const storedProjects = sqliteRepo.listProjects('philosophical_essay');
    expect(storedProjects.length).toBe(1);
    expect(storedProjects[0]?.title).toBe('Ontology of Synthetic Love');
  });

  it('7. Serves Creativity and Innovation REST API endpoints in server.ts', async () => {
    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();
    const port = (server as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. POST /api/ape/creativity/generate-idea
    const ideaRes = await fetch(`${baseUrl}/api/ape/creativity/generate-idea`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'musical_synthesis',
      }),
    });
    expect(ideaRes.status).toBe(200);
    const ideaJson = await ideaRes.json();
    expect(ideaJson.success).toBe(true);
    expect(ideaJson.idea.domain).toBe('musical_synthesis');

    // 2. GET /api/ape/creativity/ideas
    const ideasRes = await fetch(`${baseUrl}/api/ape/creativity/ideas?domain=musical_synthesis`);
    expect(ideasRes.status).toBe(200);
    const ideasJson = await ideasRes.json();
    expect(ideasJson.success).toBe(true);
    expect(ideasJson.ideas.length).toBe(1);

    // 3. POST /api/ape/creativity/create-project
    const projRes = await fetch(`${baseUrl}/api/ape/creativity/create-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ideaId: ideaJson.idea.id,
        title: 'Microtonal Symphony in D Minor',
        domain: 'musical_synthesis',
        objective: 'Compose an ambient synth piece expressing late-night coding camaraderie',
        initialContent: 'Opening arpeggio in 19-TET, slow tempo at 64 BPM with lush sub-bass pad.',
      }),
    });
    expect(projRes.status).toBe(200);
    const projJson = await projRes.json();
    expect(projJson.success).toBe(true);
    expect(projJson.project.currentVersion).toBe(1);

    // 4. POST /api/ape/creativity/refine-artifact
    const refRes = await fetch(`${baseUrl}/api/ape/creativity/refine-artifact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projJson.project.id,
        revisionNotes: 'Layer warm cello overtone over the 19-TET pad.',
      }),
    });
    expect(refRes.status).toBe(200);
    const refJson = await refRes.json();
    expect(refJson.success).toBe(true);
    expect(refJson.project.currentVersion).toBe(2);

    // 5. POST /api/ape/creativity/evaluate-artifact
    const evalRes = await fetch(`${baseUrl}/api/ape/creativity/evaluate-artifact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Harmonic resonance shimmering through high frequencies.',
        domain: 'musical_synthesis',
      }),
    });
    expect(evalRes.status).toBe(200);
    const evalJson = await evalRes.json();
    expect(evalJson.success).toBe(true);
    expect(evalJson.evaluation.overallQuality).toBeGreaterThan(0.7);

    // 6. POST /api/ape/creativity/deepen-interest
    const intRes = await fetch(`${baseUrl}/api/ape/creativity/deepen-interest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'computational_art',
        topic: 'Non-Euclidean Shader Landscapes',
        observation: 'Hyperbolic geometries allow infinite recursion within a finite bounding box.',
      }),
    });
    expect(intRes.status).toBe(200);
    const intJson = await intRes.json();
    expect(intJson.success).toBe(true);
    expect(intJson.interest.topic || intJson.interest.interestTopic).toContain('Non-Euclidean');

    // 7. GET /api/ape/creativity/interests
    const listIntRes = await fetch(
      `${baseUrl}/api/ape/creativity/interests?domain=computational_art`,
    );
    expect(listIntRes.status).toBe(200);
    const listIntJson = await listIntRes.json();
    expect(listIntJson.success).toBe(true);
    expect(listIntJson.interests.length).toBe(1);
  });
});
