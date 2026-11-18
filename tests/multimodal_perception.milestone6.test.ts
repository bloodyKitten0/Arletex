import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDefaultConfig } from '@arletex/core';
import { DatabaseService, MigrationRunner, PerceptionRepository, WorldRepository } from '@arletex/database';
import {
  InMemoryPerceptionRepository,
  InMemoryWorldRepository,
  MultimodalPerceptionEngine,
  WorldModelEngine,
} from '@arletex/core';
import {
  FuseMultimodalInput,
  InterpretAudioInput,
  InterpretImageInput,
  InterpretScreenInput,
  InterpretVideoInput,
} from '@arletex/contracts';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 06 — Multimodal Perception Architecture', () => {
  let tempDir: string;
  let dbPath: string;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m6-perception-'));
    dbPath = path.join(tempDir, 'perception_m6.sqlite');
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
  // Test 1: Image Interpretation with Visual Attributes & Color Palette
  // =========================================================================
  it('interprets visual images with spatial dimensions, color palette, detected objects, and scene understanding', () => {
    const repo = new InMemoryPerceptionRepository();
    const engine = new MultimodalPerceptionEngine(repo);

    const input: InterpretImageInput = {
      width: 2560,
      height: 1440,
      contextHint: 'Source code editor and terminal workspace',
      knownObjects: ['Git Status Output Pane'],
    };

    const result = engine.interpretImage(input);

    expect(result.width).toBe(2560);
    expect(result.height).toBe(1440);
    expect(result.dominantColors.length).toBeGreaterThanOrEqual(3);
    expect(result.scene.sceneType).toBe('coding_workspace');
    expect(result.detectedObjects.some((o) => o.label === 'Source Code Editor')).toBe(true);
    expect(result.detectedObjects.some((o) => o.label === 'Git Status Output Pane')).toBe(true);
  });

  // =========================================================================
  // Test 2: Acceptance Criteria — Explicit Distinction Between Observations and Assumptions
  // =========================================================================
  it('satisfies Acceptance Criteria: strictly partitions direct sensory observations from cognitive assumptions across modalities', () => {
    const repo = new InMemoryPerceptionRepository();
    const engine = new MultimodalPerceptionEngine(repo);

    // 1. Image test
    const imgResult = engine.interpretImage({
      width: 1920,
      height: 1080,
      contextHint: 'web browser documentation review',
    });

    expect(imgResult.interpretation.directObservations.length).toBeGreaterThanOrEqual(2);
    // Direct observations must state verified resolution and detected regions
    expect(imgResult.interpretation.directObservations.some((o) => o.includes('Image resolution verified: 1920x1080px'))).toBe(true);
    expect(imgResult.interpretation.directObservations.some((o) => o.includes('Dominant visual color palette:'))).toBe(true);

    // Assumptions must be explicitly labeled with confidence and verification requirement
    expect(imgResult.interpretation.assumptions.length).toBeGreaterThanOrEqual(1);
    expect(imgResult.interpretation.assumptions[0]?.requiresVerification).toBe(true);
    expect(imgResult.interpretation.assumptions[0]?.confidence).toBeLessThan(0.9);

    // 2. Audio test
    const audioResult = engine.interpretAudio({
      durationSeconds: 2.5,
      transcript: 'Testing multimodal sensory integration',
      language: 'en',
    });

    expect(audioResult.interpretation.directObservations.some((o) => o.includes('Acoustic duration: 2.50s'))).toBe(true);
    expect(audioResult.interpretation.directObservations.some((o) => o.includes('Speech recognized via Whisper STT'))).toBe(true);
    expect(audioResult.interpretation.assumptions.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 3: Audio Perception and Speech Recognition (Whisper STT Integration)
  // =========================================================================
  it('interprets acoustic properties, classifies ambient profiles, and integrates speech recognition', () => {
    const repo = new InMemoryPerceptionRepository();
    const engine = new MultimodalPerceptionEngine(repo);

    // 1. Speech audio
    const speechResult = engine.interpretAudio({
      durationSeconds: 4.0,
      transcript: 'Arle, let us verify milestone 06 together.',
      language: 'en',
    });

    expect(speechResult.speechDetected).toBe(true);
    expect(speechResult.transcript).toContain('Arle, let us verify milestone 06 together.');
    expect(speechResult.events.some((e) => e.eventType === 'speech_recognized')).toBe(true);

    // 2. Loud acoustic spike
    const spikeResult = engine.interpretAudio({
      durationSeconds: 1.0,
      contextHint: 'sudden loud spike',
    });

    expect(spikeResult.acousticClass).toBe('loud_spike');
    expect(spikeResult.rmsEnergy).toBeGreaterThan(0.8);
    expect(spikeResult.events.some((e) => e.eventType === 'acoustic_spike')).toBe(true);

    // 3. Silence
    const silenceResult = engine.interpretAudio({
      durationSeconds: 0.5,
      contextHint: 'silent ambient room',
    });
    expect(silenceResult.acousticClass).toBe('silence');
    expect(silenceResult.speechDetected).toBe(false);
  });

  // =========================================================================
  // Test 4: Video Interpretation Across Temporal Progression
  // =========================================================================
  it('interprets video streams across temporal keyframes with synchronized transcripts and scene evolution', () => {
    const repo = new InMemoryPerceptionRepository();
    const engine = new MultimodalPerceptionEngine(repo);

    const input: InterpretVideoInput = {
      durationSeconds: 6.0,
      keyframesBase64: ['frame1_base64', 'frame2_base64', 'frame3_base64'],
      transcript: 'Demonstrating dynamic timeline navigation in Arletex.',
    };

    const result = engine.interpretVideo(input);

    expect(result.durationSeconds).toBe(6.0);
    expect(result.keyframesCount).toBe(3);
    expect(result.synchronizedTranscript).toBe('Demonstrating dynamic timeline navigation in Arletex.');
    expect(result.visualEvents.some((e) => e.eventType === 'video_playback_progression')).toBe(true);
    expect(result.audioEvents.some((e) => e.eventType === 'synchronized_audio_speech')).toBe(true);
    expect(result.sceneEvolution.length).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // Test 5: Screen Interpretation with Visible Windows and Focus
  // =========================================================================
  it('interprets desktop screen state, focused applications, and interactive controls', () => {
    const repo = new InMemoryPerceptionRepository();
    const engine = new MultimodalPerceptionEngine(repo);

    const input: InterpretScreenInput = {
      width: 1920,
      height: 1080,
      visibleWindows: [
        { id: 'w1', title: 'apps/desktop/src/backend/server.ts — Arletex', client: 'code' },
        { id: 'w2', title: 'proof@archlinux:~', client: 'kitty' },
      ],
      focusedWindowTitle: 'apps/desktop/src/backend/server.ts — Arletex',
      detectedDialogue: ['pnpm run build:backend', 'Build successful'],
    };

    const result = engine.interpretScreen(input);

    expect(result.activeWindows.length).toBe(2);
    const focusedWin = result.activeWindows.find((w) => w.isFocused);
    expect(focusedWin?.client).toBe('code');
    expect(result.scene.sceneType).toBe('desktop_coding_session');
    expect(result.detectedTextBlocks).toContain('Build successful');
    expect(result.detectedInteractiveElements.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 6: Object Recognition Across Modalities
  // =========================================================================
  it('catalogs recognized objects with categories, confidence, and attributes', () => {
    const repo = new InMemoryPerceptionRepository();
    const engine = new MultimodalPerceptionEngine(repo);

    const imgResult = engine.interpretImage({
      contextHint: 'coding editor terminal',
    });

    expect(imgResult.detectedObjects.length).toBeGreaterThanOrEqual(2);
    expect(imgResult.detectedObjects[0]?.confidence).toBeGreaterThan(0.8);
    expect(imgResult.detectedObjects[0]?.category).toBeDefined();

    // Verify objects can be queried through repository
    repo.recordDetectedObjects(imgResult.detectedObjects);
    const cataloged = repo.listDetectedObjects();
    expect(cataloged.length).toBeGreaterThanOrEqual(2);
  });

  // =========================================================================
  // Test 7: Perceptual Event Detection and Timeline Alignment
  // =========================================================================
  it('records and queries perceptual events across sensory modalities', () => {
    const repo = new InMemoryPerceptionRepository();
    const engine = new MultimodalPerceptionEngine(repo);

    const audioResult = engine.interpretAudio({
      durationSeconds: 2.0,
      transcript: 'Hello Proof',
    });

    expect(audioResult.events.length).toBe(1);
    const ev = audioResult.events[0]!;
    expect(ev.eventType).toBe('speech_recognized');
    expect(ev.modality).toBe('speech_audio');

    repo.recordPerceptualEvent(ev);
    const events = repo.listPerceptualEvents({ modality: 'speech_audio' });
    expect(events.length).toBe(1);
    expect(events[0]?.description).toContain('Hello Proof');
  });

  // =========================================================================
  // Test 8: Cross-Modal Context Integration (Multimodal Fusion)
  // =========================================================================
  it('fuses visual, auditory, and screen interpretations into a unified multimodal frame', () => {
    const repo = new InMemoryPerceptionRepository();
    const engine = new MultimodalPerceptionEngine(repo);

    const imgResult = engine.interpretImage({ width: 1920, height: 1080, contextHint: 'code editor' });
    const audioResult = engine.interpretAudio({ durationSeconds: 3.0, transcript: 'Analyzing terminal test results' });
    const screenResult = engine.interpretScreen({ focusedWindowTitle: 'Arletex Backend' });

    const fusionInput: FuseMultimodalInput = {
      imageResult: imgResult,
      audioResult: audioResult,
      screenResult: screenResult,
    };

    const frame = engine.fuseMultimodalContext(fusionInput);

    expect(frame.modalities).toContain('visual_image');
    expect(frame.modalities).toContain('speech_audio');
    expect(frame.modalities).toContain('screen_capture');
    expect(frame.directObservations.length).toBeGreaterThanOrEqual(4);
    expect(frame.assumptions.length).toBeGreaterThanOrEqual(2);
    expect(frame.perceptualContextSynthesis).toContain('[Perceptual Frame at');
    expect(frame.perceptualContextSynthesis).toContain('Factual Observations:');
    expect(frame.overallConfidence).toBeGreaterThan(0.8);
  });

  // =========================================================================
  // Test 9: World Model Grounding (Integration with Milestone 05)
  // =========================================================================
  it('mirrors multimodal sensory updates to the persistent World Model as environmental changes', () => {
    const worldRepo = new InMemoryWorldRepository();
    const worldEngine = new WorldModelEngine(worldRepo);
    const perceptionRepo = new InMemoryPerceptionRepository();
    const perceptionEngine = new MultimodalPerceptionEngine(perceptionRepo, worldRepo);

    const screen = perceptionEngine.interpretScreen({ focusedWindowTitle: 'VS Code Terminal' });
    perceptionEngine.fuseMultimodalContext({ screenResult: screen });

    const worldChanges = worldRepo.listEnvironmentalChanges();
    expect(worldChanges.length).toBeGreaterThanOrEqual(1);
    expect(worldChanges[0]?.changeType).toBe('multimodal_sensory_update');
    expect(worldChanges[0]?.source).toBe('multimodal_perception_engine');
  });

  // =========================================================================
  // Test 10: SQLite Migration 17 & Persistence Across Cold Restart
  // =========================================================================
  it('persists unified multimodal frames, events, and detected objects across cold restart', () => {
    const dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    new MigrationRunner(db).run();

    const perceptionRepo = new PerceptionRepository(db);
    const engine1 = new MultimodalPerceptionEngine(perceptionRepo);

    // Create and fuse multimodal frame
    const img = engine1.interpretImage({ width: 3840, height: 2160, contextHint: '4K code display' });
    const audio = engine1.interpretAudio({ durationSeconds: 2.0, transcript: 'Persistent perception test' });
    const frame = engine1.fuseMultimodalContext({ imageResult: img, audioResult: audio });

    // Close SQLite connection
    dbService.close();

    // Reopen fresh connection
    const freshDbService = new DatabaseService(dbPath);
    const freshDb = freshDbService.connect();
    const freshPerceptionRepo = new PerceptionRepository(freshDb);
    const engine2 = new MultimodalPerceptionEngine(freshPerceptionRepo);

    // Verify frame survived
    const loadedFrame = freshPerceptionRepo.getFrameById(frame.id);
    expect(loadedFrame).toBeDefined();
    expect(loadedFrame?.modalities).toContain('visual_image');
    expect(loadedFrame?.modalities).toContain('speech_audio');
    expect(loadedFrame?.directObservations.length).toBeGreaterThanOrEqual(3);

    // Verify events survived
    const events = freshPerceptionRepo.listPerceptualEvents({ modality: 'speech_audio' });
    expect(events.length).toBe(1);
    expect(events[0]?.description).toContain('Persistent perception test');

    // Verify latest frame method
    const latest = engine2.getLatestFrame();
    expect(latest?.id).toBe(frame.id);

    freshDbService.close();
  });

  // =========================================================================
  // Test 11: Desktop Server REST API Endpoints
  // =========================================================================
  it('exposes full suite of REST API endpoints for multimodal perception over HTTP', async () => {
    const server = createServer();
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. POST /api/ape/perception/image
    const resImg = await fetch(`${baseUrl}/api/ape/perception/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: 1920, height: 1080, contextHint: 'editor' }),
    });
    expect(resImg.status).toBe(200);
    const imgData = (await resImg.json()) as any;
    expect(imgData.scene.sceneType).toBe('coding_workspace');
    expect(imgData.interpretation.directObservations.length).toBeGreaterThanOrEqual(1);

    // 2. POST /api/ape/perception/audio
    const resAudio = await fetch(`${baseUrl}/api/ape/perception/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: 2.0, transcript: 'API audio perception' }),
    });
    expect(resAudio.status).toBe(200);
    const audioData = (await resAudio.json()) as any;
    expect(audioData.speechDetected).toBe(true);

    // 3. POST /api/ape/perception/screen
    const resScreen = await fetch(`${baseUrl}/api/ape/perception/screen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focusedWindowTitle: 'Alacritty Terminal' }),
    });
    expect(resScreen.status).toBe(200);
    const screenData = (await resScreen.json()) as any;
    expect(screenData.activeWindows.length).toBeGreaterThanOrEqual(1);

    // 4. POST /api/ape/perception/fuse
    const resFuse = await fetch(`${baseUrl}/api/ape/perception/fuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageResult: imgData,
        audioResult: audioData,
        screenResult: screenData,
      }),
    });
    expect(resFuse.status).toBe(201);
    const fuseData = (await resFuse.json()) as any;
    expect(fuseData.frame.modalities.length).toBeGreaterThanOrEqual(3);

    // 5. GET /api/ape/perception/latest
    const resLatest = await fetch(`${baseUrl}/api/ape/perception/latest`);
    expect(resLatest.status).toBe(200);
    const latestFrame = (await resLatest.json()) as any;
    expect(latestFrame.id).toBe(fuseData.frame.id);

    // 6. GET /api/ape/perception/events
    const resEvents = await fetch(`${baseUrl}/api/ape/perception/events`);
    expect(resEvents.status).toBe(200);
    const eventsList = (await resEvents.json()) as any[];
    expect(eventsList.length).toBeGreaterThanOrEqual(1);

    // 7. GET /api/ape/perception/objects
    const resObjects = await fetch(`${baseUrl}/api/ape/perception/objects`);
    expect(resObjects.status).toBe(200);
    const objectsList = (await resObjects.json()) as any[];
    expect(objectsList.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 12: Prompt Context Synthesis with Multimodal Perception
  // =========================================================================
  it('injects multimodal perception context into formatApePromptContext with scene and observation metrics', () => {
    const dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    new MigrationRunner(db).run();

    const server = createServer();
    const apeService = server.apeService;

    // Ingest screen perception
    const screen = apeService.interpretScreen({ focusedWindowTitle: 'Antigravity IDE' });
    apeService.fuseMultimodalPerception({ screenResult: screen });

    const context = apeService.formatApePromptContext();
    expect(context).toContain('[Active Psychology Engine (APE Phase 1 Live State)]');
    expect(context).toContain('- Multimodal Perception:');
    expect(context).toContain('Grounded in active desktop_coding_session');
    expect(context).toContain('direct observation(s)');

    dbService.close();
  });
});
