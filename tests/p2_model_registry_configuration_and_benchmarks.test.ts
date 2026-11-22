import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createDefaultConfig } from '@arletex/core';
import {
  defaultModelRegistry,
  ModelRegistryService,
} from '@arletex/inference';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('P2.4 — Authoritative Model Registry, Inference Configuration & Benchmarks', () => {
  let tempDir: string;
  let dbPath: string;
  let registry: ModelRegistryService;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'arletex-p24-model-'));
    dbPath = path.join(tempDir, 'p24_test.sqlite');
    registry = new ModelRegistryService();
    activeServers = [];
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const srv of activeServers) {
      try {
        await srv.stop();
      } catch {}
    }
    activeServers = [];
    if (existsSync(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  function createServer(): ArletexBackendServer {
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
    });
    const srv = new ArletexBackendServer(config);
    activeServers.push(srv);
    return srv;
  }

  // =========================================================================
  // 1. Authoritative Model Registry Schema & Registered Models
  // =========================================================================
  describe('1. Authoritative Model Registry Schema & Registered Models', () => {
    it('contains all required fields across all registered models', () => {
      const models = registry.listModels();
      expect(models.length).toBeGreaterThanOrEqual(4);

      for (const model of models) {
        expect(model.id).toBeTruthy();
        expect(model.name).toBeTruthy();
        expect(model.filePath).toBeTruthy();
        expect(model.architecture).toBeTruthy();
        expect(model.parameters).toBeTruthy();
        expect(model.quantization).toBeTruthy();
        expect(model.contextLimit).toBeGreaterThan(0);
        expect(model.inputModalities.length).toBeGreaterThanOrEqual(1);
        expect(model.outputModalities.length).toBeGreaterThanOrEqual(1);
        expect(typeof model.supportsTools).toBe('boolean');
        expect(typeof model.supportsVision).toBe('boolean');
        expect(model.memoryRequirementBytes).toBeGreaterThan(0);
        expect(model.runtimeCompatibility.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('registers the primary candidate Qwen2.5 14B Instruct (Abliterated v2)', () => {
      const primary = registry.getModel('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M');
      expect(primary).toBeDefined();
      expect(primary?.architecture).toBe('qwen2');
      expect(primary?.parameters).toBe('14.77B');
      expect(primary?.quantization).toBe('Q4_K_M');
      expect(primary?.contextLimit).toBe(12288);
      expect(primary?.supportsTools).toBe(true);
      expect(primary?.supportsVision).toBe(false);
      expect(primary?.runtimeCompatibility).toContain('llama.cpp');
    });

    it('registers the multimodal fallback candidate Qwen3.5 9B Heretic with vision support', () => {
      const heretic = registry.getModel('Qwen3.5-9B-Heretic-Q4_K_M');
      expect(heretic).toBeDefined();
      expect(heretic?.architecture).toBe('qwen3');
      expect(heretic?.parameters).toBe('9.0B');
      expect(heretic?.quantization).toBe('Q4_K_M');
      expect(heretic?.supportsTools).toBe(true);
      expect(heretic?.supportsVision).toBe(true);
      expect(heretic?.visionProjectorPath).toBeTruthy();
      expect(heretic?.inputModalities).toContain('image');
    });

    it('registers the challenger candidate Gemma 4 12B Heretic specification', () => {
      const gemma = registry.getModel('Gemma4-12B-Heretic-Q4_K_M');
      expect(gemma).toBeDefined();
      expect(gemma?.architecture).toBe('gemma4');
      expect(gemma?.parameters).toBe('12.0B');
      expect(gemma?.quantization).toBe('Q4_K_M');
    });

    it('registers all required specialist microservice models', () => {
      const specialists = ['glm-ocr-0.9b', 'whisper-small', 'kokoro-82m', 'embeddinggemma-300m'];
      for (const id of specialists) {
        const spec = registry.getModel(id);
        expect(spec).toBeDefined();
        expect(spec?.memoryRequirementBytes).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // 2. Configuration Reconciliation & Drift Elimination
  // =========================================================================
  describe('2. Configuration Reconciliation & Drift Elimination', () => {
    it('resolves default config to canonical primary model ID and fallback model ID', () => {
      const config = createDefaultConfig();
      expect(config.inference.defaultModelId).toBe(
        'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M',
      );
      expect(config.inference.fallbackModelId).toBe('Qwen3.5-9B-Heretic-Q4_K_M');
      expect(config.inference.serverUrl).toBe('http://127.0.0.1:8080');
      expect(config.inference.provider).toBe('llama.cpp');
    });

    it('disables specialist coding by default until a dedicated model is installed and benchmarked', () => {
      const config = createDefaultConfig();
      expect(config.inference.specialistCoding?.enabled).toBe(false);
    });

    it('allows explicit enablement of specialist coding when environment variable is set to true', () => {
      const prevEnv = process.env['SPECIALIST_CODING_ENABLED'];
      try {
        process.env['SPECIALIST_CODING_ENABLED'] = 'true';
        const config = createDefaultConfig();
        expect(config.inference.specialistCoding?.enabled).toBe(true);
      } finally {
        if (prevEnv === undefined) {
          delete process.env['SPECIALIST_CODING_ENABLED'];
        } else {
          process.env['SPECIALIST_CODING_ENABLED'] = prevEnv;
        }
      }
    });
  });

  // =========================================================================
  // 3. Explicit Model Resolution & Fallback Reporting (No Silent Substitution)
  // =========================================================================
  describe('3. Explicit Model Resolution & Fallback Reporting', () => {
    it('reports ready status with isFallback: false when requested model is installed and healthy', () => {
      // Mock model as installed
      const mockReg = new ModelRegistryService();
      const primary = mockReg.getModel('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M')!;
      primary.isInstalled = true;

      const decision = mockReg.resolveModel('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M');
      expect(decision.status).toBe('ready');
      expect(decision.isFallback).toBe(false);
      expect(decision.resolvedModelId).toBe('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M');
      expect(decision.fallbackReason).toBeUndefined();
    });

    it('reports degraded status with isFallback: true and explicit reason when requested model is missing', () => {
      const mockReg = new ModelRegistryService();
      // Ensure requested is not installed, but fallback is installed
      const requested = mockReg.getModel('Gemma4-12B-Heretic-Q4_K_M')!;
      requested.isInstalled = false;

      const fallback = mockReg.getModel('Qwen3.5-9B-Heretic-Q4_K_M')!;
      fallback.isInstalled = true;

      const decision = mockReg.resolveModel(
        'Gemma4-12B-Heretic-Q4_K_M',
        'Qwen3.5-9B-Heretic-Q4_K_M',
      );

      expect(decision.status).toBe('degraded');
      expect(decision.isFallback).toBe(true);
      expect(decision.resolvedModelId).toBe('Qwen3.5-9B-Heretic-Q4_K_M');
      expect(decision.fallbackReason).toContain('weights missing');
    });

    it('reports unavailable status with actionable error when no compatible text models exist', () => {
      const mockReg = new ModelRegistryService();
      for (const m of mockReg.listModels()) {
        m.isInstalled = false;
      }

      const decision = mockReg.resolveModel(
        'NonExistentModel',
        'AlsoNonExistent',
      );

      expect(decision.status).toBe('unavailable');
      expect(decision.isFallback).toBe(false);
      expect(decision.fallbackReason).toContain('No compatible text model installed');
    });
  });

  // =========================================================================
  // 4. Empirical Benchmark Comparison & Winner Determination
  // =========================================================================
  describe('4. Empirical Benchmark Comparison & Winner Determination', () => {
    it('compares candidate models across all required empirical performance dimensions', () => {
      const comparison = registry.compareCandidates(
        'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M',
        'Qwen3.5-9B-Heretic-Q4_K_M',
      );

      expect(comparison.candidateA.id).toBe('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M');
      expect(comparison.candidateB.id).toBe('Qwen3.5-9B-Heretic-Q4_K_M');
      expect(comparison.comparisons.throughput).toBeDefined();
      expect(comparison.comparisons.ttft).toBeDefined();
      expect(comparison.comparisons.reasoning).toBeDefined();
      expect(comparison.comparisons.toolAdherence).toBeDefined();
      expect(comparison.comparisons.jsonValidity).toBeDefined();
      expect(comparison.comparisons.contextStability).toBeDefined();
      expect(comparison.comparisons.conversationalQuality).toBeDefined();
      expect(comparison.comparisons.memoryFootprint).toBeDefined();
    });

    it('selects the winner objectively based on empirical benchmark scores, not intuition', () => {
      const comparison = registry.compareCandidates(
        'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M',
        'Qwen3.5-9B-Heretic-Q4_K_M',
      );

      // Qwen 2.5 14B wins on reasoning (0.95 vs 0.91), tool adherence (0.99 vs 0.95), JSON (1.0 vs 0.97)
      expect(comparison.winnerId).toBe('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M');
      expect(comparison.selectionReason).toContain('Selected');
      expect(comparison.selectionReason).toContain('superior reasoning, tool adherence');
    });

    it('records new benchmark results accurately', () => {
      const newBm = {
        tokensPerSecond: 25.5,
        ttftMs: 180,
        contextStabilityScore: 0.97,
        toolAdherenceScore: 0.98,
        jsonValidityScore: 1.0,
        reasoningScore: 0.94,
        conversationalQualityScore: 0.97,
        uncertaintyCalibrationScore: 0.93,
        peakMemoryBytes: 9200000000,
        testedAt: new Date().toISOString(),
      };

      registry.recordBenchmark('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M', newBm);
      const updated = registry.getModel('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M');
      expect(updated?.benchmarks?.tokensPerSecond).toBe(25.5);
      expect(updated?.benchmarks?.ttftMs).toBe(180);
    });
  });

  // =========================================================================
  // 5. Vision Projector Compatibility & Multimodal Path Validation
  // =========================================================================
  describe('5. Vision Projector Compatibility & Multimodal Path Validation', () => {
    it('validates vision projector compatibility for Qwen3.5-9B-Heretic', () => {
      const validation = registry.validateVisionProjector('Qwen3.5-9B-Heretic-Q4_K_M');
      expect(validation.supportsVision).toBe(true);

      // If the mmproj file is installed on this device, it should be compatible
      if (validation.projectorPath && existsSync(validation.projectorPath)) {
        expect(validation.compatible).toBe(true);
      } else {
        expect(validation.compatible).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });

    it('correctly rejects non-multimodal models without vision architecture', () => {
      const validation = registry.validateVisionProjector(
        'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M',
      );
      expect(validation.supportsVision).toBe(false);
      expect(validation.compatible).toBe(false);
      expect(validation.error).toContain('does not support vision projector');
    });
  });

  // =========================================================================
  // 6. Identity Independence (Durable Identity Separate from LoRA Adapters)
  // =========================================================================
  describe('6. Identity Independence (No Identity Stored in Model Weights)', () => {
    it('preserves psychological identity and memories completely independent of model changes', async () => {
      const server = createServer();
      const port = await server.start(0);

      // Verify that changing active model preference does not alter autobiographical memories
      await server.memoryRepo.create({
        content: 'Proof and Arle agreed on the core developmental invariants.',
        category: 'episodic',
        tags: ['identity', 'partner', 'invariant'],
        significanceScore: 0.9,
      });

      // Switch active model to fallback model
      server.preferenceRepo.set('active_model_name', 'Qwen3.5-9B-Heretic-Q4_K_M');

      const memories = server.memoryRepo.list({ limit: 5 });
      const found = memories.find((m) => m.content.includes('core developmental invariants'));
      expect(found).toBeDefined();
      expect(found?.tags).toContain('identity');

      // Check active model endpoint reports the change cleanly
      const activeRes = await fetch(`http://127.0.0.1:${port}/api/models/active`);
      expect(activeRes.ok).toBe(true);
      const activeData = (await activeRes.json()) as any;
      expect(activeData.resolvedModelId).toBe('Qwen3.5-9B-Heretic-Q4_K_M');
    });
  });

  // =========================================================================
  // 7. Server REST API Integration
  // =========================================================================
  describe('7. Server REST API Integration', () => {
    it('returns all registered models via GET /api/models', async () => {
      const server = createServer();
      const port = await server.start(0);

      const res = await fetch(`http://127.0.0.1:${port}/api/models`);
      expect(res.ok).toBe(true);
      const data = (await res.json()) as any;
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models.length).toBeGreaterThanOrEqual(4);
    });

    it('resolves model requests via POST /api/models/resolve', async () => {
      const server = createServer();
      const port = await server.start(0);

      const res = await fetch(`http://127.0.0.1:${port}/api/models/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M',
        }),
      });

      expect(res.ok).toBe(true);
      const data = (await res.json()) as any;
      expect(data.requestedModelId).toBe('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M');
      expect(data.activeProvider).toBe('llama.cpp');
    });

    it('returns benchmark comparisons via GET /api/models/benchmarks', async () => {
      const server = createServer();
      const port = await server.start(0);

      const res = await fetch(
        `http://127.0.0.1:${port}/api/models/benchmarks?candidateA=Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M&candidateB=Qwen3.5-9B-Heretic-Q4_K_M`,
      );

      expect(res.ok).toBe(true);
      const data = (await res.json()) as any;
      expect(data.winnerId).toBe('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M');
      expect(data.selectionReason).toBeTruthy();
    });

    it('validates vision projector via POST /api/models/validate-vision', async () => {
      const server = createServer();
      const port = await server.start(0);

      const res = await fetch(`http://127.0.0.1:${port}/api/models/validate-vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'Qwen3.5-9B-Heretic-Q4_K_M',
        }),
      });

      expect(res.ok).toBe(true);
      const data = (await res.json()) as any;
      expect(data.supportsVision).toBe(true);
    });
  });
});
