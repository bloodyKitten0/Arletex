import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createDefaultConfig } from '@arletex/core';
import { DatabaseService, MigrationRunner, WorldRepository } from '@arletex/database';
import { InMemoryWorldRepository, WorldModelEngine } from '@arletex/core';
import { WorldObservationInput } from '@arletex/contracts';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 05 — World Model Architecture', () => {
  let tempDir: string;
  let dbPath: string;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m5-world-'));
    dbPath = path.join(tempDir, 'world_m5.sqlite');
    activeServers = [];
  });

  afterEach(async () => {
    for (const srv of activeServers) {
      try {
        await srv.stop();
      } catch {}
    }
    activeServers = [];
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createServer(): ArletexBackendServer {
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
      inference: {
        provider: 'llama.cpp',
        serverUrl: 'http://127.0.0.1:8080',
        defaultModelId: 'Qwen2.5-14B-Uncensored-Q4_K_M',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        repeatPenalty: 1.18,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: [],
        contextSize: 8192,
        specialistCoding: {
          enabled: false,
          provider: 'llama.cpp',
          serverUrl: 'http://127.0.0.1:8081',
          modelId: 'qwen2.5-coder',
          temperature: 0.2,
          maxTokens: 2048,
        },
      },
    });
    const srv = new ArletexBackendServer(config);
    activeServers.push(srv);
    return srv;
  }

  // =========================================================================
  // Test 1: Foundational Entity & Invariant Seeding
  // =========================================================================
  it('initializes foundational entities (Proof, Arle, Linux Workstation) and reciprocal relational invariants', () => {
    const repo = new InMemoryWorldRepository();
    const engine = new WorldModelEngine(repo);

    const proof = repo.getEntityByName('Proof');
    const arle = repo.getEntityByName('Arle');
    const host = repo.getEntityByName('Linux Workstation');

    expect(proof).toBeDefined();
    expect(proof?.entityType).toBe('person');
    expect(proof?.certainty).toBe('verified_fact');
    expect(proof?.confidence).toBe(1.0);

    expect(arle).toBeDefined();
    expect(arle?.entityType).toBe('agent');
    expect(arle?.properties['partner']).toBe('Proof');

    expect(host).toBeDefined();
    expect(host?.entityType).toBe('system');

    // Verify reciprocal partner relationship
    const partnerRels = repo.listRelations({
      sourceEntityId: proof!.id,
      targetEntityId: arle!.id,
      relationType: 'partner_of',
    });
    expect(partnerRels.length).toBeGreaterThanOrEqual(1);
    expect(partnerRels[0]?.isBidirectional).toBe(true);

    // Verify execution relation
    const execRels = repo.listRelations({
      sourceEntityId: arle!.id,
      targetEntityId: host!.id,
      relationType: 'executes_on',
    });
    expect(execRels.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 2: Acceptance Criteria — Maintain and Update World Representation from Observations
  // =========================================================================
  it('satisfies Acceptance Criteria: maintains and updates a persistent world representation based on actual observations', () => {
    const repo = new InMemoryWorldRepository();
    const engine = new WorldModelEngine(repo);

    // 1. Ingest initial observation: Kokoro Voice Specialist service
    const obs1: WorldObservationInput = {
      entityName: 'Kokoro TTS Service',
      entityType: 'service',
      category: 'neural_specialist',
      properties: { port: 39282, status: 'online', voiceModel: 'af_heart' },
      locationName: 'Linux Workstation',
      sourceProvenance: 'specialists_server_telemetry',
      confidence: 0.95,
      certainty: 'empirical_observation',
    };

    const res1 = engine.observe(obs1);
    expect(res1.entity.name).toBe('Kokoro TTS Service');
    expect(res1.entity.properties['status']).toBe('online');
    expect(res1.change).toBeDefined();
    expect(res1.change?.changeType).toBe('entity_discovery');

    // Verify location was automatically linked
    const kokoroDetails = engine.getEntity('Kokoro TTS Service');
    expect(kokoroDetails).toBeDefined();
    expect(kokoroDetails?.location?.name).toBe('Linux Workstation');

    // 2. Ingest state mutation observation: Kokoro voice changes active synthesis profile
    const obs2: WorldObservationInput = {
      entityName: 'Kokoro TTS Service',
      entityType: 'service',
      properties: {
        port: 39282,
        status: 'online',
        voiceModel: 'af_heart',
        currentVoicePitch: 'gentle_intimate',
      },
      sourceProvenance: 'telemetry_probe',
      confidence: 0.98,
    };

    const res2 = engine.observe(obs2);
    expect(res2.entity.properties['currentVoicePitch']).toBe('gentle_intimate');
    expect(res2.change).toBeDefined();
    expect(res2.change?.changeType).toBe('state_mutation');
    expect(res2.change?.previousState?.['currentVoicePitch']).toBeUndefined();
    expect(res2.change?.newState['currentVoicePitch']).toBe('gentle_intimate');

    // Verify environmental change history is preserved
    const changes = engine.listEnvironmentalChanges({ entityId: res1.entity.id });
    expect(changes.length).toBe(2);
    expect(changes[0]?.changeType).toBe('state_mutation');
    expect(changes[1]?.changeType).toBe('entity_discovery');
  });

  // =========================================================================
  // Test 3: Object and Digital Artifact Representation
  // =========================================================================
  it('represents physical and digital objects with properties, states, and containment relations', () => {
    const repo = new InMemoryWorldRepository();
    const engine = new WorldModelEngine(repo);

    // Create an object: Microphone device
    const mic = engine.addEntity({
      name: 'Host Audio Microphone',
      entityType: 'object',
      category: 'audio_hardware',
      properties: { sampleRate: 16000, channels: 1, driver: 'ALSA/PulseAudio' },
      confidence: 0.9,
      certainty: 'empirical_observation',
    });

    // Create a digital artifact: Recorded WAV file
    const wavFile = engine.addEntity({
      name: 'sample_audio_capture.wav',
      entityType: 'digital_artifact',
      category: 'audio_recording',
      properties: { path: '/tmp/sample_audio_capture.wav', durationSec: 4.2 },
      confidence: 1.0,
      certainty: 'verified_fact',
    });

    // Establish causal / creation relation
    engine.addRelation({
      sourceEntityId: mic.id,
      targetEntityId: wavFile.id,
      relationType: 'created_by',
      confidence: 0.95,
    });

    const relations = engine.listRelations({ sourceEntityId: mic.id });
    expect(relations.length).toBe(1);
    expect(relations[0]?.relationType).toBe('created_by');
  });

  // =========================================================================
  // Test 4: Location Representation and Hierarchical Spatial Nesting
  // =========================================================================
  it('represents physical and digital locations with spatial containment', () => {
    const repo = new InMemoryWorldRepository();
    const engine = new WorldModelEngine(repo);

    // Physical workspace location
    const room = engine.addEntity({
      name: 'Proof Work Desk',
      entityType: 'location',
      category: 'physical_space',
      properties: { ambientNoise: 'quiet', lighting: 'natural' },
    });

    // Digital workspace location
    const arletexDir = engine.addEntity({
      name: 'Arletex Project Workspace',
      entityType: 'location',
      category: 'filesystem_directory',
      properties: { path: "/home/proof/Documents/A man's dream will never die/projects/Arletex" },
    });

    // Link digital directory to host system
    const host = repo.getEntityByName('Linux Workstation');
    expect(host).toBeDefined();

    engine.addRelation({
      sourceEntityId: arletexDir.id,
      targetEntityId: host!.id,
      relationType: 'located_at',
    });

    const rels = engine.listRelations({ sourceEntityId: arletexDir.id });
    expect(rels.some((r) => r.targetEntityId === host!.id && r.relationType === 'located_at')).toBe(
      true,
    );
  });

  // =========================================================================
  // Test 5: Causal Relationships and Mechanism Modeling
  // =========================================================================
  it('registers causal relationships with condition, mechanism, and empirical reliability', () => {
    const repo = new InMemoryWorldRepository();
    const engine = new WorldModelEngine(repo);

    const llamaServer = engine.addEntity({
      name: 'llama-server Vulkan',
      entityType: 'service',
      properties: { port: 8080 },
    });

    const inferenceGateway = engine.addEntity({
      name: 'InferenceGateway',
      entityType: 'system',
      properties: { client: 'Arletex Core' },
    });

    // Register causal link: llamaServer online -> enables InferenceGateway generation
    const causal = engine.registerCausalRelationship({
      causeEntityId: llamaServer.id,
      effectEntityId: inferenceGateway.id,
      condition: 'llama-server /health returns 200 OK',
      mechanism: 'HTTP POST /completion over localhost:8080',
      empiricalReliability: 0.99,
      confidence: 0.95,
    });

    expect(causal.mechanism).toContain('HTTP POST /completion');
    expect(causal.empiricalReliability).toBe(0.99);

    const listed = engine.listCausalRelationships({ causeEntityId: llamaServer.id });
    expect(listed.length).toBe(1);
    expect(listed[0]?.effectEntityId).toBe(inferenceGateway.id);
  });

  // =========================================================================
  // Test 6: Uncertainty Representation & Epistemic Certainty Levels
  // =========================================================================
  it('differentiates epistemic certainty levels (verified_fact, empirical_observation, inferred_hypothesis, unverified_claim)', () => {
    const repo = new InMemoryWorldRepository();
    const engine = new WorldModelEngine(repo);

    // 1. Verified fact
    engine.addEntity({
      name: 'SQLite WAL Database',
      entityType: 'object',
      certainty: 'verified_fact',
      confidence: 1.0,
      sourceProvenance: 'verified_file_descriptor',
    });

    // 2. Inferred hypothesis
    engine.addEntity({
      name: 'Telegram Bot User Persona',
      entityType: 'person',
      certainty: 'inferred_hypothesis',
      confidence: 0.6,
      sourceProvenance: 'dialogue_style_inference',
    });

    // 3. Unverified claim
    engine.addEntity({
      name: 'External Cloud API Endpoint',
      entityType: 'service',
      certainty: 'unverified_claim',
      confidence: 0.3,
      sourceProvenance: 'unverified_user_prompt',
    });

    const analysis = engine.getKnownVsUnknownAnalysis();
    expect(analysis.totalKnownFacts).toBeGreaterThanOrEqual(3); // Proof, Arle, Linux Workstation + SQLite
    expect(analysis.totalHypotheses).toBe(1);
    expect(analysis.totalUnverifiedClaims).toBe(1);
  });

  // =========================================================================
  // Test 7: Distinction Between Known and Unknown Information (Epistemic Frontier)
  // =========================================================================
  it('tracks open inquiries vs known facts and resolves unknowns with empirical evidence', () => {
    const repo = new InMemoryWorldRepository();
    const engine = new WorldModelEngine(repo);

    // Record an unknown question
    const unknown1 = engine.recordUnknown({
      topic: 'RVC Voice Conversion Port Availability',
      question: 'Is RVC server active on port 39282 alongside Kokoro?',
      domain: 'voice_infrastructure',
      priority: 0.8,
    });

    expect(unknown1.status).toBe('open');

    // Inspect analysis before resolution
    let analysis = engine.getKnownVsUnknownAnalysis();
    expect(analysis.openInquiriesCount).toBe(1);
    expect(analysis.resolvedInquiriesCount).toBe(0);
    expect(analysis.epistemicFrontierDescription).toContain('Is RVC server active on port 39282');

    // Resolve unknown with evidence
    const resolved = engine.resolveUnknown(
      unknown1.id,
      'Probed http://127.0.0.1:39282/health and received {"rvc": true} with 200 OK.',
    );
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolutionEvidence).toContain('Probed http://127.0.0.1:39282/health');
    expect(resolved.resolvedAt).toBeDefined();

    // Inspect analysis after resolution
    analysis = engine.getKnownVsUnknownAnalysis();
    expect(analysis.openInquiriesCount).toBe(0);
    expect(analysis.resolvedInquiriesCount).toBe(1);
    expect(analysis.epistemicFrontierDescription).toContain('Epistemic frontier is clear');
  });

  // =========================================================================
  // Test 8: Contextual Knowledge Querying & World Overview Synthesis
  // =========================================================================
  it('provides rich contextual summaries and queries across domains', () => {
    const repo = new InMemoryWorldRepository();
    const engine = new WorldModelEngine(repo);

    // Register entities in different categories
    engine.addEntity({
      name: 'Web Agency Browser',
      entityType: 'service',
      category: 'digital_agency',
    });
    engine.addEntity({
      name: 'Safe Computer CLI',
      entityType: 'service',
      category: 'digital_agency',
    });

    const agencyEntities = engine.listEntities({ category: 'digital_agency' });
    expect(agencyEntities.length).toBe(2);

    const overview = engine.getWorldOverview();
    expect(overview.totalEntities).toBeGreaterThanOrEqual(5);
    expect(overview.worldSummary).toContain('Persistent world model holds');
  });

  // =========================================================================
  // Test 9: SQLite Migration 16 & Cold Restart Persistence
  // =========================================================================
  it('persists entities, relations, changes, causal links, and unknowns to SQLite across cold restart', () => {
    const dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    new MigrationRunner(db).run();

    const worldRepo = new WorldRepository(db);
    const engine1 = new WorldModelEngine(worldRepo);

    // 1. Observe new entity
    engine1.observe({
      entityName: 'Local Whisper Small STT',
      entityType: 'service',
      properties: { model: 'whisper-small-int8', port: 39282 },
      locationName: 'Linux Workstation',
      sourceProvenance: 'initial_benchmark',
    });

    // 2. Add causal link
    const whisper = worldRepo.getEntityByName('Local Whisper Small STT');
    const host = worldRepo.getEntityByName('Linux Workstation');
    expect(whisper).toBeDefined();
    expect(host).toBeDefined();

    engine1.registerCausalRelationship({
      causeEntityId: host!.id,
      effectEntityId: whisper!.id,
      mechanism: 'Spawns Python specialist subprocess with pywhispercpp',
    });

    // 3. Record unknown
    engine1.recordUnknown({
      topic: 'Audio Latency',
      question: 'What is the end-to-end Whisper STT transcription latency on device?',
    });

    // Close SQLite connection
    dbService.close();

    // Reopen fresh connection
    const freshDbService = new DatabaseService(dbPath);
    const freshDb = freshDbService.connect();
    const freshWorldRepo = new WorldRepository(freshDb);
    const engine2 = new WorldModelEngine(freshWorldRepo);

    // Verify entity survived
    const loadedWhisper = freshWorldRepo.getEntityByName('Local Whisper Small STT');
    expect(loadedWhisper).toBeDefined();
    expect(loadedWhisper?.properties['model']).toBe('whisper-small-int8');

    // Verify relations survived
    const relations = freshWorldRepo.listRelations({ sourceEntityId: loadedWhisper!.id });
    expect(relations.some((r) => r.relationType === 'located_at')).toBe(true);

    // Verify causal relationship survived
    const causal = freshWorldRepo.listCausalRelationships({ effectEntityId: loadedWhisper!.id });
    expect(causal.length).toBe(1);
    expect(causal[0]?.mechanism).toContain('Spawns Python specialist subprocess');

    // Verify unknown survived
    const unknowns = freshWorldRepo.listUnknowns({ status: 'open' });
    expect(unknowns.some((u) => u.topic === 'Audio Latency')).toBe(true);

    // Check world overview from fresh engine
    const overview = engine2.getWorldOverview();
    expect(overview.totalEntities).toBeGreaterThanOrEqual(4);
    expect(overview.epistemicAnalysis.openInquiriesCount).toBe(1);

    freshDbService.close();
  });

  // =========================================================================
  // Test 10: Desktop Backend REST API Endpoints
  // =========================================================================
  it('exposes full suite of REST API endpoints for the world model over HTTP', async () => {
    const server = createServer();
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. GET /api/ape/world/overview
    const resOverview = await fetch(`${baseUrl}/api/ape/world/overview`);
    expect(resOverview.status).toBe(200);
    const overview = (await resOverview.json()) as any;
    expect(overview.totalEntities).toBeGreaterThanOrEqual(3);

    // 2. POST /api/ape/world/observe
    const resObserve = await fetch(`${baseUrl}/api/ape/world/observe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityName: 'EmbeddingGemma 300M Model',
        entityType: 'service',
        category: 'vector_indexing',
        properties: { dimension: 768, quant: 'fp16' },
        locationName: 'Linux Workstation',
      }),
    });
    expect(resObserve.status).toBe(200);
    const observeData = (await resObserve.json()) as any;
    expect(observeData.entity.name).toBe('EmbeddingGemma 300M Model');
    expect(observeData.change).toBeDefined();

    // 3. GET /api/ape/world/entities
    const resEntities = await fetch(`${baseUrl}/api/ape/world/entities?type=service`);
    expect(resEntities.status).toBe(200);
    const services = (await resEntities.json()) as any[];
    expect(services.some((s) => s.name === 'EmbeddingGemma 300M Model')).toBe(true);

    // 4. GET /api/ape/world/entity/:idOrName
    const resEntity = await fetch(`${baseUrl}/api/ape/world/entity/Proof`);
    expect(resEntity.status).toBe(200);
    const proofData = (await resEntity.json()) as any;
    expect(proofData.entity.name).toBe('Proof');
    expect(proofData.relations.length).toBeGreaterThanOrEqual(1);

    // 5. POST /api/ape/world/relation
    const resRelation = await fetch(`${baseUrl}/api/ape/world/relation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceEntityId: observeData.entity.id,
        targetEntityId: proofData.entity.id,
        relationType: 'interacts_with',
      }),
    });
    expect(resRelation.status).toBe(201);

    // 6. POST /api/ape/world/unknown
    const resUnknown = await fetch(`${baseUrl}/api/ape/world/unknown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: 'Semantic Memory Precision',
        question: 'Does EmbeddingGemma score above 0.85 cosine similarity on test queries?',
        domain: 'memory_evaluation',
      }),
    });
    expect(resUnknown.status).toBe(201);
    const unknownData = (await resUnknown.json()) as any;
    const unknownId = unknownData.unknown.id;

    // 7. GET /api/ape/world/unknowns
    const resGetUnknowns = await fetch(`${baseUrl}/api/ape/world/unknowns?status=open`);
    expect(resGetUnknowns.status).toBe(200);
    const unknownsList = (await resGetUnknowns.json()) as any[];
    expect(unknownsList.some((u) => u.id === unknownId)).toBe(true);

    // 8. POST /api/ape/world/unknown/:id/resolve
    const resResolve = await fetch(`${baseUrl}/api/ape/world/unknown/${unknownId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resolutionEvidence: 'Empirical benchmark achieved 0.91 cosine similarity.',
      }),
    });
    expect(resResolve.status).toBe(200);
    const resolveData = (await resResolve.json()) as any;
    expect(resolveData.unknown.status).toBe('resolved');

    // 9. GET /api/ape/world/epistemic-analysis
    const resAnalysis = await fetch(`${baseUrl}/api/ape/world/epistemic-analysis`);
    expect(resAnalysis.status).toBe(200);
    const analysis = (await resAnalysis.json()) as any;
    expect(analysis.resolvedInquiriesCount).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 11: Prompt Context Synthesis with World Model Grounding
  // =========================================================================
  it('injects world model grounding into formatApePromptContext with entity counts and epistemic frontier', () => {
    const dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    new MigrationRunner(db).run();

    const server = createServer();
    const apeService = server.apeService;

    // Ingest specific observation
    apeService.observeWorld({
      entityName: 'Vulkan Graphic Pipeline',
      entityType: 'system',
      properties: { backend: 'RADV', device: 'AMD Radeon Graphics' },
    });

    // Record an active unknown inquiry
    apeService.recordWorldUnknown({
      topic: 'Frame Buffer Contention',
      question: 'Is desktop UI compositing affected by inference compute spikes?',
    });

    const context = apeService.formatApePromptContext();
    expect(context).toContain('[Active Psychology Engine (APE Phase 1 Live State)]');
    expect(context).toContain('- World Grounding:');
    expect(context).toContain('Persistent world model holds');
    expect(context).toContain('Actively tracking 1 open questions at the epistemic frontier:');
    expect(context).toContain('Is desktop UI compositing affected by inference compute spikes?');

    dbService.close();
  });
});
