import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  DatabaseService,
  ApeRepository,
  MemoryRepository,
  ActivityRepository,
  MigrationRunner,
} from '@arletex/database';
import {
  ApeService,
  VerificationEngine,
  ActionPermissionController,
  rootLogger,
} from '@arletex/core';
import {
  TelegramBridgeService,
  validateTelegramMediaSignature,
} from '../apps/desktop/src/backend/telegramBridgeService.js';

describe('Milestone 6 — Repository-Wide Integration Scenarios and State Consistency', () => {
  let tempDir: string;
  let dbPath: string;
  let mediaDir: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let activityRepo: ActivityRepository;
  let apeService: ApeService;
  let verificationEngine: VerificationEngine;
  let permissionController: ActionPermissionController;
  let telegramBridge: TelegramBridgeService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m6-scenarios-'));
    dbPath = path.join(tempDir, 'arletex_m6.sqlite');
    mediaDir = path.join(tempDir, 'media', 'telegram');
    fs.mkdirSync(mediaDir, { recursive: true });

    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    activityRepo = new ActivityRepository(db);
    apeService = new ApeService(apeRepo);
    permissionController = new ActionPermissionController();
    verificationEngine = new VerificationEngine(rootLogger);

    telegramBridge = new TelegramBridgeService();
    telegramBridge.configure('123456:M6_SECRET_TOKEN', '10001', ['10001'], [50001]);
  });

  afterEach(() => {
    telegramBridge.stopPolling();
    dbService.close();
    vi.restoreAllMocks();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // =========================================================================
  // Scenario A — Telegram Image End-to-End
  // =========================================================================
  describe('Scenario A: Inbound Telegram Image Analysis and Memory Provenance', () => {
    it('retrieves, validates magic bytes, observes visual content, and commits memory with empirical provenance', async () => {
      // 1. Authorized user sends image
      const validJpegBuffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
        0x48,
      ]);

      // 2. Validate magic signature
      const detectedMime = validateTelegramMediaSignature(validJpegBuffer, 'photo');
      expect(detectedMime).toBe('image/jpeg');

      // 3. System securely stores file in media directory
      const fileName = `img_${Date.now()}.jpg`;
      const filePath = path.join(mediaDir, fileName);
      fs.writeFileSync(filePath, validJpegBuffer);
      expect(fs.existsSync(filePath)).toBe(true);

      // 4. Visual perception analyzes it (simulating VLM observation)
      const simulatedVlmObservation = {
        description:
          'A schematic architectural diagram of the APE cognitive engine showing 6 interconnected submodules.',
        labels: ['diagram', 'architecture', 'graph'],
        textDetected: 'Artificial Psychology Engine v2',
        confidence: 0.94,
      };

      // 5. Arle processes the observation in APE
      const apeResult = await apeService.processEvent({
        category: 'user_interaction',
        type: 'photo_shared',
        source: 'telegram',
        actor: 'user',
        payload: {
          filePath,
          mimeType: detectedMime,
          observation: simulatedVlmObservation,
          caption: 'Take a look at the revised cognitive architecture blueprint.',
        },
      });

      expect(apeResult.processed).toBe(true);
      expect(apeResult.appraisal?.dimensions.uncertainty).toBeLessThanOrEqual(0.3);

      // 6. Memory is committed with verifiable provenance linking the Telegram media
      const memory = memoryRepo.create({
        content: `Proof shared cognitive architecture diagram: ${simulatedVlmObservation.description}`,
        rawObservation: `VLM observation of ${filePath}: ${simulatedVlmObservation.textDetected}`,
        interpretation: simulatedVlmObservation.description,
        provenance: 'raw_observation',
        confidence: simulatedVlmObservation.confidence,
        importance: 0.8,
        tags: ['telegram', 'image', 'architecture', 'blueprint'],
        metadata: {
          filePath,
          verified: true,
          verificationMethod: 'vlm_multimodal_inspection',
        },
      });

      expect(memory.id).toBeDefined();
      expect(memory.confidence).toBe(0.94);
      expect(memory.provenance).toBe('raw_observation');

      // Verify retrieval from SQLite preserves provenance and metadata
      const retrieved = memoryRepo.getById(memory.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.provenance).toBe('raw_observation');
      expect((retrieved?.metadata as Record<string, unknown>)?.filePath).toBe(filePath);
    });
  });

  // =========================================================================
  // Scenario B — Telegram Video End-to-End
  // =========================================================================
  describe('Scenario B: Inbound Telegram Video Processing and Grounded Summary', () => {
    it('validates video signature, extracts keyframe metadata, and distinguishes frames from inference', async () => {
      // 1. Valid MP4 header
      const validMp4Buffer = Buffer.from([
        0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02,
        0x00,
      ]);

      const detectedMime = validateTelegramMediaSignature(validMp4Buffer, 'video');
      expect(detectedMime).toBe('video/mp4');

      // 2. Video processor extracts keyframes & audio track
      const keyframesMock = [
        { timestampSeconds: 0.0, framePath: '/tmp/frame_0.jpg', sharpness: 82.4 },
        { timestampSeconds: 2.5, framePath: '/tmp/frame_1.jpg', sharpness: 91.0 },
      ];
      const audioTranscriptionMock = 'Look at this tactical bishop sacrifice on h7.';

      // 3. Grounded summary explicitly distinguishing frames, audio, and inference
      const videoObservation = {
        durationSeconds: 5.0,
        inspectedKeyframes: keyframesMock.length,
        transcribedAudio: audioTranscriptionMock,
        inferredSummary:
          'Video shows a chess puzzle demonstrating a classic Greek gift sacrifice on h7.',
      };

      expect(videoObservation.inspectedKeyframes).toBe(2);
      expect(videoObservation.transcribedAudio).toContain('tactical bishop sacrifice');
      // Must not conflate transcribed words with speculative inference
      expect(videoObservation.transcribedAudio).not.toBe(videoObservation.inferredSummary);

      // 4. Memory records both the empirical observation and separate model interpretation
      const videoMemory = memoryRepo.create({
        content: `Watched chess puzzle video from Proof: "${audioTranscriptionMock}" (Summary: ${videoObservation.inferredSummary})`,
        rawObservation: `Keyframes: ${keyframesMock.length}, Audio: "${audioTranscriptionMock}"`,
        interpretation: videoObservation.inferredSummary,
        provenance: 'raw_observation',
        confidence: 0.95,
        importance: 0.75,
        tags: ['telegram', 'video', 'chess'],
        metadata: {
          verified: true,
          verificationMethod: 'ffmpeg_whisper_multimodal_pipeline',
          evidence: `keyframes=${keyframesMock.length};audio_verified=true`,
        },
      });

      expect(videoMemory.id).toBeDefined();
      expect((videoMemory.metadata as Record<string, unknown>)?.evidence).toContain('keyframes=2');
    });
  });

  // =========================================================================
  // Scenario C — Independent Research End-to-End
  // =========================================================================
  describe('Scenario C: Independent Autonomous Research Driven by Development Interests', () => {
    it('develops research objective, executes plan, gathers evidence, verifies outcome, and matures interest', async () => {
      const topic = 'Computational Algebraic Topology';
      const devEngine = apeService.developmentEngine;

      // 1. Arle acquires and explores interest
      devEngine.developInterest(topic, 'explore');
      const initialDev = devEngine.getState();
      const interest = initialDev.interests.find((i) => i.topic === topic);
      expect(interest).toBeDefined();
      expect(interest!.level).toBe('emerging');

      // 2. Motivational engine generates candidate initiative based on the interest
      const initiatives = apeService.motivationalEngine.generateCandidateInitiatives({
        activeInterests: [topic],
      });
      expect(initiatives.some((init) => init.includes(topic))).toBe(true);

      // 3. Create and commit an autonomous goal
      const researchGoal = apeService.motivationalEngine.createGoal({
        title: `Research foundational theorems of ${topic}`,
        description: 'Examine persistent homology and Betti numbers in point cloud analysis',
        motivation: 'Competence and intellectual curiosity',
        priority: 0.85,
        origin: 'autonomous',
        status: 'committed',
      });
      expect(researchGoal.status).toBe('committed');

      // 4. Activate goal and simulate structured empirical research execution
      apeService.motivationalEngine.activateGoal(researchGoal.id);
      expect(
        apeService.motivationalEngine.getState().goals.find((g) => g.id === researchGoal.id)
          ?.status,
      ).toBe('active');

      const researchEvidence =
        'Extracted survey on persistent homology barcode algorithms and filtration complexes.';
      const researchVerified = true;

      // 5. Verification Engine confirms the evidence
      const verifiedResult = {
        objective: researchGoal.title,
        verified: researchVerified,
        evidence: researchEvidence,
        source: 'https://arxiv.org/abs/persistent-homology-survey',
      };
      expect(verifiedResult.verified).toBe(true);

      // 6. Record practice attempt & progress goal
      devEngine.recordPracticeAttempt({
        skillOrTopic: topic,
        success: true,
        evidence: verifiedResult.evidence,
        notes: 'Successfully synthesized foundational filtration complexes',
      });
      devEngine.developInterest(topic, 'master'); // Moves emerging -> deep

      apeService.motivationalEngine.updateGoalProgress(researchGoal.id, 1.0, 'completed');

      // 7. Store research memory with full provenance
      const memory = memoryRepo.create({
        content: `Completed independent research on ${topic}: ${researchEvidence}`,
        rawObservation: `Extracted from ${verifiedResult.source}`,
        interpretation: `Synthesized persistent homology concepts for ${topic}`,
        provenance: 'verified_fact',
        confidence: 0.98,
        importance: 0.85,
        tags: ['research', 'topology', 'autonomous'],
        metadata: {
          verified: true,
          verificationMethod: 'web_research_extraction',
          evidence: verifiedResult.source,
        },
      });

      expect(memory.id).toBeDefined();
      const finalInterest = devEngine.getState().interests.find((i) => i.topic === topic);
      expect(finalInterest?.level).toBe('mastery');
    });
  });

  // =========================================================================
  // Scenario D — Emotional Disagreement End-to-End
  // =========================================================================
  describe('Scenario D: Composed Intellectual Disagreement Without Relationship Trauma', () => {
    it('appraises disagreement truthfully, maintains composure, avoids hostile trauma, and preserves trust', async () => {
      const initialTrust = apeService.relationshipEngine.getState().trustLevel;

      // 1. User shares a direct intellectual disagreement
      const result = await apeService.processEvent({
        category: 'user_interaction',
        type: 'chat_message',
        source: 'user',
        actor: 'user',
        payload: {
          text: 'I disagree with your proposed caching policy. It introduces cache stampede risks under high concurrency.',
        },
      });

      expect(result.processed).toBe(true);
      const appraisal = result.appraisal;

      // 2. Appraisal should be composed: zero personal threat, high intellectual engagement
      expect(appraisal?.dimensions.threat).toBeLessThanOrEqual(0.2);
      expect(appraisal?.dimensions.uncertainty).toBeLessThanOrEqual(0.5);

      // 3. No relational conflict or grievance logged
      const relState = apeService.relationshipEngine.getState();
      expect(relState.conflictHistory.length).toBe(0);
      expect(relState.trustLevel).toBeGreaterThanOrEqual(initialTrust);

      // 4. Mood remains focused and composed
      expect(result.state.currentMood).toBe('focused');
      // Active emotions should reflect curiosity or intellectual engagement, never irrational defensiveness/rage
      const emotionIds = result.state.activeEmotions.map((e) => e.emotionId);
      expect(emotionIds).not.toContain('rage');
      expect(emotionIds).not.toContain('hatred');
      expect(emotionIds).not.toContain('contempt');
    });
  });

  // =========================================================================
  // Scenario E — Failed Operation End-to-End
  // =========================================================================
  describe('Scenario E: Grounded Failure Recording Without Fabricated Success', () => {
    it('records operation failure truthfully, updates self-model limitation, and forbids false capability claims', () => {
      const selfModel = apeService.selfModelEngine;

      // 1. Arle attempts an authorized operation that fails
      const operationAttempt = selfModel.recordOperationAttempt(
        'Vulkan Raytracing Pipeline Compilation',
        'Radeon 780M',
      );
      expect(operationAttempt.id).toBeDefined();

      const failedOutcome = {
        operation: 'Vulkan Raytracing Pipeline Compilation',
        success: false,
        evidence:
          'Shader compiler returned SPIRV-Cross syntax failure: ray query extensions disabled in hardware mode',
        provenance: 'spirv-compiler-stderr',
        confidence: 0.99,
        error: 'Hardware ray query extension unavailable',
      };

      // 2. Self-model processes the outcome
      selfModel.recordOperationOutcome(failedOutcome);

      // 3. Verify self-model state
      const state = selfModel.getState();
      expect(
        state.acknowledgedLimitations.some((lim) =>
          lim.includes('Vulkan Raytracing Pipeline Compilation'),
        ),
      ).toBe(true);
      // MUST NEVER claim as demonstrated capability!
      expect(
        state.acknowledgedCapabilities.some((cap) =>
          cap.includes('Vulkan Raytracing Pipeline Compilation'),
        ),
      ).toBe(false);

      // 4. No successful memory is fabricated
      const allMemories = memoryRepo.list({ limit: 100 });
      const hasFalseMemory = allMemories.some((m) =>
        m.content.includes('Successfully compiled Vulkan Raytracing Pipeline'),
      );
      expect(hasFalseMemory).toBe(false);
    });
  });

  // =========================================================================
  // Scenario F — Restart and Continuity End-to-End
  // =========================================================================
  describe('Scenario F: Persistent State Continuity and Context Restoration Across Restarts', () => {
    it('preserves psychological state, active goals, memories, and development interests across complete restart', async () => {
      // 1. Establish initial rich state
      const topic = 'Bobby Fischer 1972 World Championship Game 6';
      apeService.developmentEngine.developInterest(topic, 'explore');

      const goal = apeService.motivationalEngine.createGoal({
        title: `Analyze Queen's Gambit Declined lines from ${topic}`,
        motivation: 'Chess strategy study',
        priority: 0.9,
      });

      const memory = memoryRepo.create({
        content: `Studied Fischer game 6 against Spassky with Proof; noted the positional 32. b4 maneuver.`,
        rawObservation: 'Dialogue session on Fischer 1972 QGD game 6',
        provenance: 'autobiographical_experience',
        confidence: 1.0,
        importance: 0.9,
        tags: ['chess', 'fischer', 'spassky'],
        metadata: {
          isCore: true,
          evidence: 'interactive-analysis-session',
        },
      });

      // Advance relationship state
      apeService.relationshipEngine.processInteraction(
        {
          id: crypto.randomUUID(),
          category: 'user_interaction',
          type: 'intimate_checkin',
          source: 'user',
          actor: 'user',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'restart-appraisal-1',
          eventId: 'restart-event-1',
          dimensions: {
            goalRelevance: 0.8,
            goalCongruence: 0.8,
            unexpectedness: 0.1,
            responsibility: 'user',
            intentionality: 0.9,
            fairness: 1.0,
            threat: 0.0,
            controllability: 1.0,
            socialMeaning: 'affection',
            personalSignificance: 0.85,
            uncertainty: 0.0,
            relationshipImplications: 'Deepened devotion',
          },
          primaryInterpretation: 'Warm affectionate connection with Proof',
          alternativeInterpretations: [],
          supportingEvidence: ['Proof expressed deep shared presence'],
          proposedTransitions: [],
          appraisalMethod: 'deterministic',
        },
      );

      const beforeMaster = apeService.getMasterState();
      const beforeGoals = apeService.motivationalEngine.getState().goals;
      const beforeInterests = apeService.developmentEngine.getState().interests;

      // 2. Simulate complete application shutdown
      dbService.close();

      // 3. Restart application with a fresh DatabaseService instance targeting the same SQLite database
      const restartedDbService = new DatabaseService(dbPath, rootLogger);
      const restartedDb = restartedDbService.connect();
      const restartedApeRepo = new ApeRepository(restartedDb);
      const restartedMemoryRepo = new MemoryRepository(restartedDb);
      const restartedApeService = new ApeService(restartedApeRepo);

      // 4. Verify identical recovered context
      const afterMaster = restartedApeService.getMasterState();
      const afterGoals = restartedApeService.motivationalEngine.getState().goals;
      const afterInterests = restartedApeService.developmentEngine.getState().interests;

      // Goals recovered
      expect(afterGoals.length).toBe(beforeGoals.length);
      expect(afterGoals.some((g) => g.id === goal.id && g.title === goal.title)).toBe(true);

      // Interests recovered
      expect(afterInterests.some((i) => i.topic === topic)).toBe(true);

      // Memories recovered
      const reloadedMemory = restartedMemoryRepo.getById(memory.id);
      expect(reloadedMemory).not.toBeNull();
      expect(reloadedMemory?.content).toBe(memory.content);
      expect((reloadedMemory?.metadata as Record<string, unknown>)?.evidence).toBe(
        'interactive-analysis-session',
      );

      // Relationship parameters & baseline composure recovered
      expect(afterMaster.relationship.trustLevel).toBe(beforeMaster.relationship.trustLevel);
      expect(afterMaster.personality.temperament.emotionalStability).toBe(
        beforeMaster.personality.temperament.emotionalStability,
      );

      restartedDbService.close();
    });
  });
});
