import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  ComputationalResourceMetrics,
  InteroceptiveSnapshot,
  OperationalMode,
  validateEpistemicInteroception,
  PROHIBITED_BIOLOGICAL_SENSATIONS,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  EmbodimentInteroceptionEngine,
  InMemoryEmbodimentRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  EmbodimentRepository,
  MigrationRunner,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 07 — Embodiment and Interoception', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let embodimentRepo: EmbodimentRepository;
  let apeRepo: ApeRepository;
  let embodimentEngine: EmbodimentInteroceptionEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m7-embodiment-'));
    dbPath = path.join(tempDir, 'embodiment_m7.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    embodimentRepo = new EmbodimentRepository(db);
    apeRepo = new ApeRepository(db);
    embodimentEngine = new EmbodimentInteroceptionEngine({
      repository: embodimentRepo,
    });
  });

  afterEach(async () => {
    for (const srv of activeServers) {
      try {
        await srv.stop();
      } catch {}
    }
    activeServers = [];
    try {
      dbService.close();
    } catch {}
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

  it('1. Validates strict negative invariant (rejection of fabricated human biological sensations)', () => {
    // Prohibited sensations must be rejected
    for (const term of PROHIBITED_BIOLOGICAL_SENSATIONS) {
      const fabricatedText = `I feel my ${term} reacting strongly right now.`;
      const validation = validateEpistemicInteroception(fabricatedText);
      expect(validation.valid).toBe(false);
      expect(validation.violation).toContain(
        `Prohibited biological sensation fabricated: "${term}"`,
      );
    }

    // Honest computational telemetry must be accepted
    const honestInteroception =
      'Compute load: CPU 34% @ 3.2 GHz (55°C) | RAM 8.4/22.0 GB (38%) | GPU 12% (58°C, Vulkan APU) | Mode: OPTIMAL';
    const validCheck = validateEpistemicInteroception(honestInteroception);
    expect(validCheck.valid).toBe(true);
    expect(validCheck.violation).toBeUndefined();
  });

  it('2. Probes digital physiology and gathers real hardware and compute telemetry', async () => {
    const telemetry = await embodimentEngine.probeDigitalPhysiology();

    expect(telemetry.timestamp).toBeDefined();
    expect(telemetry.cpu).toBeDefined();
    expect(telemetry.cpu.loadAverage).toHaveLength(3);
    expect(telemetry.memory.totalBytes).toBeGreaterThan(0);
    expect(telemetry.memory.usagePercent).toBeGreaterThanOrEqual(0);
    expect(telemetry.memory.usagePercent).toBeLessThanOrEqual(100);
    expect(telemetry.storage.totalBytes).toBeGreaterThan(0);
    expect(telemetry.storage.usagePercent).toBeGreaterThanOrEqual(0);
  });

  it('3. Probes model and tool availability without assuming hardcoded state', async () => {
    const models = await embodimentEngine.probeModelAvailability();
    expect(models.llamaServer.port).toBe(8080);
    expect(models.specialistsServer.port).toBe(39282);
    expect(typeof models.llamaServer.online).toBe('boolean');
    expect(typeof models.specialistsServer.online).toBe('boolean');

    const tools = embodimentEngine.probeToolAvailability();
    expect(tools.browserSandbox.available).toBe(true);
    expect(tools.filesystemSandbox.available).toBe(true);
    expect(tools.bashExecution.available).toBe(true);
    expect(tools.uiAutomation.mouseAvailable).toBe(true);
  });

  it('4. Evaluates cognitive workload dynamically from operational strain', () => {
    const nominal = embodimentEngine.assessCognitiveWorkload({
      activeInferenceStreams: 0,
      queuedTasks: 0,
      memoryLoadPercent: 20,
    });
    expect(nominal.perceivedStrain).toBe('nominal');

    const moderate = embodimentEngine.assessCognitiveWorkload({
      activeInferenceStreams: 1,
      queuedTasks: 0,
      memoryLoadPercent: 55,
    });
    expect(moderate.perceivedStrain).toBe('moderate');

    const elevated = embodimentEngine.assessCognitiveWorkload({
      activeInferenceStreams: 2,
      queuedTasks: 3,
      memoryLoadPercent: 75,
    });
    expect(elevated.perceivedStrain).toBe('elevated');

    const critical = embodimentEngine.assessCognitiveWorkload({
      activeInferenceStreams: 3,
      queuedTasks: 8,
      memoryLoadPercent: 92,
    });
    expect(critical.perceivedStrain).toBe('critical');
  });

  it('5. Evaluates operational constraints (thermal, memory, battery, service degradation)', () => {
    const baseResources: ComputationalResourceMetrics = {
      timestamp: new Date().toISOString(),
      cpu: { usagePercent: 20, frequencyMhz: 3000, temperatureC: 55, loadAverage: [0.5, 0.4, 0.3] },
      memory: {
        totalBytes: 24 * 1024 ** 3,
        usedBytes: 8 * 1024 ** 3,
        freeBytes: 16 * 1024 ** 3,
        availableBytes: 16 * 1024 ** 3,
        usagePercent: 33.3,
        swapTotalBytes: 8 * 1024 ** 3,
        swapUsedBytes: 0,
        swapUsagePercent: 0,
      },
      gpu: {
        available: true,
        name: 'AMD Radeon 780M',
        usagePercent: 10,
        temperatureC: 58,
        vramTotalBytes: null,
        vramUsedBytes: null,
        vramFreeBytes: null,
        powerWatts: null,
      },
      battery: { available: true, percent: 85, isCharging: true, powerWatts: 25 },
      storage: {
        totalBytes: 500 * 1024 ** 3,
        usedBytes: 150 * 1024 ** 3,
        freeBytes: 350 * 1024 ** 3,
        usagePercent: 30,
      },
    };

    const models = {
      llamaServer: {
        online: true,
        port: 8080,
        activeModel: 'Qwen2.5-14B',
        endpoint: 'http://127.0.0.1:8080',
      },
      specialistsServer: { online: true, port: 39282, endpoint: 'http://127.0.0.1:39282' },
      models: { embeddingGemma: true, whisper: true, kokoro: true, rvc: true },
    };

    const nominalWorkload = embodimentEngine.assessCognitiveWorkload();

    // 1. Optimal condition
    const optimalConstraints = embodimentEngine.evaluateOperationalConstraints(
      baseResources,
      models,
      nominalWorkload,
    );
    expect(optimalConstraints.mode).toBe('optimal');
    expect(optimalConstraints.isThrottled).toBe(false);

    // 2. Thermal pressure condition
    const hotResources: ComputationalResourceMetrics = {
      ...baseResources,
      cpu: { ...baseResources.cpu, temperatureC: 82 },
    };
    const throttledConstraints = embodimentEngine.evaluateOperationalConstraints(
      hotResources,
      models,
      nominalWorkload,
    );
    expect(throttledConstraints.mode).toBe('throttled');
    expect(throttledConstraints.thermalPressure).toBe(true);
    expect(throttledConstraints.constraints[0]).toContain('Thermal pressure');

    // 3. Low battery preservation condition
    const lowBatResources: ComputationalResourceMetrics = {
      ...baseResources,
      battery: { available: true, percent: 14, isCharging: false, powerWatts: 18 },
    };
    const conservativeConstraints = embodimentEngine.evaluateOperationalConstraints(
      lowBatResources,
      models,
      nominalWorkload,
    );
    expect(conservativeConstraints.mode).toBe('conservative');
    expect(conservativeConstraints.batteryPreservation).toBe(true);

    // 4. Critical emergency condition (thermal runaway or severe memory exhaustion)
    const emergencyResources: ComputationalResourceMetrics = {
      ...baseResources,
      cpu: { ...baseResources.cpu, temperatureC: 91 },
    };
    const emergencyConstraints = embodimentEngine.evaluateOperationalConstraints(
      emergencyResources,
      models,
      nominalWorkload,
    );
    expect(emergencyConstraints.mode).toBe('emergency');
  });

  it('6. Regulates internal resources and issues operational directives', () => {
    const inMemoryRepo = new InMemoryEmbodimentRepository();
    const engine = new EmbodimentInteroceptionEngine({ repository: inMemoryRepo });

    const baseResources: ComputationalResourceMetrics = {
      timestamp: new Date().toISOString(),
      cpu: { usagePercent: 75, frequencyMhz: 3000, temperatureC: 84, loadAverage: [2.5, 2.0, 1.8] },
      memory: {
        totalBytes: 24 * 1024 ** 3,
        usedBytes: 21 * 1024 ** 3,
        freeBytes: 3 * 1024 ** 3,
        availableBytes: 3 * 1024 ** 3,
        usagePercent: 87.5,
        swapTotalBytes: 8 * 1024 ** 3,
        swapUsedBytes: 5 * 1024 ** 3,
        swapUsagePercent: 62.5,
      },
      gpu: {
        available: true,
        name: 'AMD Radeon 780M',
        usagePercent: 88,
        temperatureC: 81,
        vramTotalBytes: null,
        vramUsedBytes: null,
        vramFreeBytes: null,
        powerWatts: null,
      },
      battery: { available: true, percent: 50, isCharging: false, powerWatts: 30 },
      storage: {
        totalBytes: 500 * 1024 ** 3,
        usedBytes: 200 * 1024 ** 3,
        freeBytes: 300 * 1024 ** 3,
        usagePercent: 40,
      },
    };

    const models = {
      llamaServer: {
        online: true,
        port: 8080,
        activeModel: 'Qwen2.5-14B',
        endpoint: 'http://127.0.0.1:8080',
      },
      specialistsServer: { online: true, port: 39282, endpoint: 'http://127.0.0.1:39282' },
      models: { embeddingGemma: true, whisper: true, kokoro: true, rvc: true },
    };

    const workload = engine.assessCognitiveWorkload({ activeInferenceStreams: 2, queuedTasks: 4 });
    const constraints = engine.evaluateOperationalConstraints(baseResources, models, workload);
    const directive = engine.regulateResources(constraints, baseResources);

    expect(directive.targetMode).toBe('throttled');
    expect(directive.throttleBackgroundTasks).toBe(true);
    expect(directive.maxContextTokensAdjustment).toBe(-512);
    expect(directive.suspendHeavyMultimodal).toBe(true);

    // Verify constraint event was recorded in repo
    const events = inMemoryRepo.listConstraintEvents();
    expect(events.length).toBe(1);
    expect(events[0].previousMode).toBe('optimal');
    expect(events[0].newMode).toBe('throttled');
  });

  it('7. Conducts complete interoceptive cycle and produces epistemically honest report', async () => {
    const snapshot = await embodimentEngine.conductInteroceptiveCycle();

    expect(snapshot.id).toBeDefined();
    expect(snapshot.timestamp).toBeDefined();
    expect(snapshot.resources).toBeDefined();
    expect(snapshot.models).toBeDefined();
    expect(snapshot.tools).toBeDefined();
    expect(snapshot.workload).toBeDefined();
    expect(snapshot.operationalMode).toBeDefined();
    expect(snapshot.directive).toBeDefined();
    expect(snapshot.digitalPhysiologicalReport).toContain('[Interoception Mode:');
    expect(snapshot.digitalPhysiologicalReport).toContain('CPU');
    expect(snapshot.digitalPhysiologicalReport).toContain('RAM');

    // Negative Invariant Check on the generated report
    const check = validateEpistemicInteroception(snapshot.digitalPhysiologicalReport);
    expect(check.valid).toBe(true);

    // Verify persistence in SQLite
    const retrieved = embodimentRepo.getSnapshotById(snapshot.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.id).toBe(snapshot.id);
    expect(retrieved?.operationalMode).toBe(snapshot.operationalMode);
  });

  it('8. Acceptance Criteria: Incorporates computational changes into planning and resource allocation', async () => {
    // Stage 1: Optimal environment
    await embodimentEngine.conductInteroceptiveCycle({
      modelsOverride: {
        llamaServer: {
          online: true,
          port: 8080,
          activeModel: 'Qwen2.5-14B',
          endpoint: 'http://127.0.0.1:8080',
        },
        specialistsServer: { online: true, port: 39282, endpoint: 'http://127.0.0.1:39282' },
        models: { embeddingGemma: true, whisper: true, kokoro: true, rvc: true },
      },
      telemetryOverride: {
        cpu: {
          usagePercent: 15,
          frequencyMhz: 3000,
          temperatureC: 50,
          loadAverage: [0.2, 0.2, 0.1],
        },
        memory: {
          totalBytes: 24 * 1024 ** 3,
          usedBytes: 6 * 1024 ** 3,
          freeBytes: 18 * 1024 ** 3,
          availableBytes: 18 * 1024 ** 3,
          usagePercent: 25.0,
          swapTotalBytes: 8 * 1024 ** 3,
          swapUsedBytes: 0,
          swapUsagePercent: 0,
        },
        gpu: {
          available: true,
          name: 'AMD Radeon 780M (Vulkan Unified)',
          usagePercent: 10,
          temperatureC: 48,
          vramTotalBytes: 8 * 1024 ** 3,
          vramUsedBytes: 1 * 1024 ** 3,
          vramFreeBytes: 7 * 1024 ** 3,
          powerWatts: 15,
        },
        battery: {
          available: true,
          percent: 95,
          isCharging: true,
          acConnected: true,
          healthPercent: 100,
          temperatureC: 32,
        },
      },
    });

    const optimalPlanAdjustment = embodimentEngine.incorporateIntoPlanning({
      parallelTasksRequested: 4,
      requiresHeavyMultimodal: true,
    });
    expect(optimalPlanAdjustment.allowedParallelSubtasks).toBe(4);
    expect(optimalPlanAdjustment.maxFrameRateOrFrames).toBe(12);
    expect(optimalPlanAdjustment.allowBackgroundSelfRefinement).toBe(true);
    expect(optimalPlanAdjustment.recommendedThinkingBudgetTokens).toBe(4096);
    expect(optimalPlanAdjustment.rationale).toContain('Optimal compute capacity');

    // Stage 2: Heavy computational thermal & memory pressure occurs
    await embodimentEngine.conductInteroceptiveCycle({
      telemetryOverride: {
        cpu: {
          usagePercent: 92,
          frequencyMhz: 3200,
          temperatureC: 86,
          loadAverage: [3.8, 3.2, 2.9],
        },
        memory: {
          totalBytes: 24 * 1024 ** 3,
          usedBytes: 22 * 1024 ** 3,
          freeBytes: 2 * 1024 ** 3,
          availableBytes: 2 * 1024 ** 3,
          usagePercent: 91.7,
          swapTotalBytes: 8 * 1024 ** 3,
          swapUsedBytes: 6 * 1024 ** 3,
          swapUsagePercent: 75.0,
        },
      },
      workloadOverride: {
        activeInferenceStreams: 3,
        queuedTasks: 6,
        memoryLoadPercent: 92,
      },
    });

    const throttledPlanAdjustment = embodimentEngine.incorporateIntoPlanning({
      parallelTasksRequested: 4,
      requiresHeavyMultimodal: true,
    });

    // Planning should automatically restrict concurrency and budget to adapt to computational reality
    expect(throttledPlanAdjustment.allowedParallelSubtasks).toBe(1);
    expect(throttledPlanAdjustment.maxFrameRateOrFrames).toBeLessThanOrEqual(4);
    expect(throttledPlanAdjustment.allowBackgroundSelfRefinement).toBe(false);
    expect(throttledPlanAdjustment.recommendedThinkingBudgetTokens).toBeLessThanOrEqual(2048);
    expect(throttledPlanAdjustment.rationale).toContain('Throttled mode');
  });

  it('9. Persists interoceptive snapshots and regulation directives across database reloads', async () => {
    const snapshot = await embodimentEngine.conductInteroceptiveCycle();

    // Close db connection and reopen
    dbService.close();
    const reopenedDbService = new DatabaseService(dbPath);
    const reopenedDb = reopenedDbService.connect();
    const newRepo = new EmbodimentRepository(reopenedDb);

    const latest = newRepo.getLatestSnapshot();
    expect(latest).not.toBeNull();
    expect(latest?.id).toBe(snapshot.id);
    expect(latest?.resources.memory.totalBytes).toBe(snapshot.resources.memory.totalBytes);

    const directive = newRepo.getLatestRegulationDirective();
    expect(directive).not.toBeNull();
    expect(directive?.targetMode).toBe(snapshot.directive.targetMode);

    reopenedDbService.close();
  });

  it('10. Synthesizes Embodiment & Interoception grounding in ApeService prompt context', async () => {
    const apeService = new ApeService(
      apeRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      embodimentRepo,
    );

    await apeService.conductInteroceptiveCycle();
    const promptContext = apeService.formatApePromptContext();

    expect(promptContext).toContain('Embodiment & Interoception:');
    expect(promptContext).toContain('Concurrency:');
    expect(promptContext).toContain(
      'Non-Biological Invariant: Interoception strictly computational',
    );

    // Epistemic check on entire prompt context
    const check = validateEpistemicInteroception(promptContext);
    expect(check.valid).toBe(true);
  });

  it('11. Mounts and serves REST API endpoints for Embodiment and Interoception', async () => {
    const server = createServer();
    const port = await server.start();

    try {
      // 1. POST /api/ape/embodiment/cycle
      const cycleRes = await fetch(`http://127.0.0.1:${port}/api/ape/embodiment/cycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workloadOverride: { activeInferenceStreams: 0, queuedTasks: 0 },
        }),
      });
      expect(cycleRes.status).toBe(201);
      const cycleData = (await cycleRes.json()) as any;
      expect(cycleData.success).toBe(true);
      expect(cycleData.snapshot.id).toBeDefined();

      // 2. GET /api/ape/embodiment/latest
      const latestRes = await fetch(`http://127.0.0.1:${port}/api/ape/embodiment/latest`);
      expect(latestRes.status).toBe(200);
      const latestData = (await latestRes.json()) as any;
      expect(latestData.id).toBe(cycleData.snapshot.id);

      // 3. GET /api/ape/embodiment/snapshots
      const listRes = await fetch(`http://127.0.0.1:${port}/api/ape/embodiment/snapshots?limit=5`);
      expect(listRes.status).toBe(200);
      const listData = (await listRes.json()) as any;
      expect(Array.isArray(listData)).toBe(true);
      expect(listData.length).toBeGreaterThanOrEqual(1);

      // 4. POST /api/ape/embodiment/plan-adjustment
      const planRes = await fetch(`http://127.0.0.1:${port}/api/ape/embodiment/plan-adjustment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parallelTasksRequested: 3 }),
      });
      expect(planRes.status).toBe(200);
      const planData = (await planRes.json()) as any;
      expect(planData.success).toBe(true);
      expect(planData.adjustment.allowedParallelSubtasks).toBeGreaterThanOrEqual(1);
    } finally {
      await server.stop();
    }
  });
});
