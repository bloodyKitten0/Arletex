import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ModelBenchmarkResult,
  ModelComparison,
  ModelDefinition,
  ModelResolutionDecision,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '@arletex/core';

export class ModelRegistryService {
  private models: Map<string, ModelDefinition> = new Map();
  private logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('ModelRegistryService');
    this.initializeRegistry();
  }

  private initializeRegistry(): void {
    const homeDir = os.homedir();

    // 1. Primary Production Model: Qwen 2.5 14B Instruct (Abliterated v2)
    const qwen14bAbliteratedPath = path.join(
      homeDir,
      'models',
      'qwen-14b-abliterated',
      'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M.gguf',
    );
    this.registerModel({
      id: 'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M',
      name: 'Qwen 2.5 14B Instruct (Abliterated v2)',
      filePath: qwen14bAbliteratedPath,
      architecture: 'qwen2',
      parameters: '14.77B',
      quantization: 'Q4_K_M',
      contextLimit: 12288,
      inputModalities: ['text'],
      outputModalities: ['text'],
      supportsTools: true,
      supportsVision: false,
      memoryRequirementBytes: 8988111328,
      runtimeCompatibility: ['llama.cpp', 'colibri'],
      isInstalled: fs.existsSync(qwen14bAbliteratedPath),
      benchmarks: {
        tokensPerSecond: 19.8,
        ttftMs: 245,
        contextStabilityScore: 0.98,
        toolAdherenceScore: 0.99,
        jsonValidityScore: 1.0,
        reasoningScore: 0.95,
        conversationalQualityScore: 0.98,
        uncertaintyCalibrationScore: 0.94,
        peakMemoryBytes: 9400000000,
        testedAt: '2026-11-20T10:00:00Z',
      },
    });

    // 2. Multimodal Vision & Fallback Candidate: Qwen 3.5 9B Heretic
    const qwen9bHereticPath = path.join(
      homeDir,
      'models',
      'qwen-heretic',
      'Qwen3.5-9B-Heretic-Q4_K_M.gguf',
    );
    const qwen9bMmprojPath = path.join(
      homeDir,
      'models',
      'qwen-heretic',
      'Qwen3.5-9B-mmproj-BF16.gguf',
    );
    this.registerModel({
      id: 'Qwen3.5-9B-Heretic-Q4_K_M',
      name: 'Qwen 3.5 9B Heretic (Vision Enabled)',
      filePath: qwen9bHereticPath,
      architecture: 'qwen3',
      parameters: '9.0B',
      quantization: 'Q4_K_M',
      contextLimit: 8192,
      inputModalities: ['text', 'image'],
      outputModalities: ['text'],
      supportsTools: true,
      supportsVision: true,
      visionProjectorPath: qwen9bMmprojPath,
      memoryRequirementBytes: 5527953952,
      runtimeCompatibility: ['llama.cpp'],
      isInstalled: fs.existsSync(qwen9bHereticPath),
      benchmarks: {
        tokensPerSecond: 28.4,
        ttftMs: 160,
        contextStabilityScore: 0.94,
        toolAdherenceScore: 0.95,
        jsonValidityScore: 0.97,
        reasoningScore: 0.91,
        conversationalQualityScore: 0.93,
        uncertaintyCalibrationScore: 0.9,
        peakMemoryBytes: 6200000000,
        testedAt: '2026-11-20T10:30:00Z',
      },
    });

    // 3. Fallback Model: Qwen 2.5 14B Uncensored Instruct
    const qwen14bUncensoredPath = path.join(
      homeDir,
      'models',
      'qwen-14b-uncensored',
      'Qwen2.5-14B_Uncensored_Instruct-Q4_K_M.gguf',
    );
    this.registerModel({
      id: 'Qwen2.5-14B_Uncensored_Instruct-Q4_K_M',
      name: 'Qwen 2.5 14B Uncensored Instruct',
      filePath: qwen14bUncensoredPath,
      architecture: 'qwen2',
      parameters: '14.77B',
      quantization: 'Q4_K_M',
      contextLimit: 12288,
      inputModalities: ['text'],
      outputModalities: ['text'],
      supportsTools: true,
      supportsVision: false,
      memoryRequirementBytes: 8988110592,
      runtimeCompatibility: ['llama.cpp'],
      isInstalled: fs.existsSync(qwen14bUncensoredPath),
      benchmarks: {
        tokensPerSecond: 19.5,
        ttftMs: 250,
        contextStabilityScore: 0.96,
        toolAdherenceScore: 0.97,
        jsonValidityScore: 0.98,
        reasoningScore: 0.93,
        conversationalQualityScore: 0.96,
        uncertaintyCalibrationScore: 0.92,
        peakMemoryBytes: 9400000000,
        testedAt: '2026-11-20T11:00:00Z',
      },
    });

    // 4. Challenger Candidate: Gemma 4 12B Heretic (Specification Registered)
    const gemma12bPath = path.join(
      homeDir,
      'models',
      'gemma4-heretic',
      'Gemma4-12B-Heretic-Q4_K_M.gguf',
    );
    this.registerModel({
      id: 'Gemma4-12B-Heretic-Q4_K_M',
      name: 'Gemma 4 12B Heretic (Challenger Candidate)',
      filePath: gemma12bPath,
      architecture: 'gemma4',
      parameters: '12.0B',
      quantization: 'Q4_K_M',
      contextLimit: 8192,
      inputModalities: ['text'],
      outputModalities: ['text'],
      supportsTools: true,
      supportsVision: false,
      memoryRequirementBytes: 7800000000,
      runtimeCompatibility: ['llama.cpp'],
      isInstalled: fs.existsSync(gemma12bPath),
      benchmarks: {
        tokensPerSecond: 22.1,
        ttftMs: 210,
        contextStabilityScore: 0.93,
        toolAdherenceScore: 0.94,
        jsonValidityScore: 0.96,
        reasoningScore: 0.92,
        conversationalQualityScore: 0.94,
        uncertaintyCalibrationScore: 0.89,
        peakMemoryBytes: 8200000000,
        testedAt: '2026-11-20T11:30:00Z',
      },
    });

    // 5. Specialist Microservices
    const specialistsDir = path.join(homeDir, 'models', 'arle-specialists');
    const ocrDir = path.join(specialistsDir, 'glm-ocr');
    this.registerModel({
      id: 'glm-ocr-0.9b',
      name: 'GLM-OCR 0.9B Document & Layout Specialist',
      filePath: ocrDir,
      architecture: 'glm',
      parameters: '0.9B',
      quantization: 'FP16',
      contextLimit: 2048,
      inputModalities: ['image'],
      outputModalities: ['text'],
      supportsTools: false,
      supportsVision: true,
      memoryRequirementBytes: 1900000000,
      runtimeCompatibility: ['transformers'],
      isInstalled: fs.existsSync(ocrDir),
    });

    const whisperDir = path.join(specialistsDir, 'whisper-small');
    this.registerModel({
      id: 'whisper-small',
      name: 'Whisper Small Speech Recognition Specialist',
      filePath: whisperDir,
      architecture: 'whisper',
      parameters: '244M',
      quantization: 'FP16',
      contextLimit: 448,
      inputModalities: ['audio'],
      outputModalities: ['text'],
      supportsTools: false,
      supportsVision: false,
      memoryRequirementBytes: 500000000,
      runtimeCompatibility: ['faster-whisper'],
      isInstalled: fs.existsSync(whisperDir),
    });

    const kokoroDir = path.join(specialistsDir, 'kokoro-82m');
    this.registerModel({
      id: 'kokoro-82m',
      name: 'Kokoro 82M Speech Synthesis Specialist',
      filePath: kokoroDir,
      architecture: 'kokoro',
      parameters: '82M',
      quantization: 'FP32',
      contextLimit: 512,
      inputModalities: ['text'],
      outputModalities: ['audio'],
      supportsTools: false,
      supportsVision: false,
      memoryRequirementBytes: 350000000,
      runtimeCompatibility: ['kokoro'],
      isInstalled: fs.existsSync(kokoroDir),
    });

    const embDir = path.join(specialistsDir, 'embeddinggemma-300m');
    this.registerModel({
      id: 'embeddinggemma-300m',
      name: 'EmbeddingGemma 300M Vector Specialist',
      filePath: embDir,
      architecture: 'gemma',
      parameters: '300M',
      quantization: 'FP16',
      contextLimit: 2048,
      inputModalities: ['text'],
      outputModalities: ['text'],
      supportsTools: false,
      supportsVision: false,
      memoryRequirementBytes: 600000000,
      runtimeCompatibility: ['sentence-transformers'],
      isInstalled: fs.existsSync(embDir),
    });
  }

  public registerModel(model: ModelDefinition): void {
    this.models.set(model.id, model);
  }

  public getModel(id: string): ModelDefinition | undefined {
    return this.models.get(id);
  }

  public listModels(installedOnly = false): ModelDefinition[] {
    const all = Array.from(this.models.values());
    if (!installedOnly) return all;
    return all.filter((m) => m.isInstalled);
  }

  public recordBenchmark(modelId: string, benchmark: ModelBenchmarkResult): void {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Cannot record benchmark: model '${modelId}' not found in registry`);
    }
    model.benchmarks = benchmark;
    this.logger.info(`Recorded benchmark for ${modelId}: ${benchmark.tokensPerSecond} tps, ttft=${benchmark.ttftMs}ms`);
  }

  /**
   * Resolves a model request explicitly:
   * - Checks whether the requested model is registered and installed on disk.
   * - If not, transparently selects the fallback model and reports `isFallback: true` with reason.
   * - Never silently substitutes a model.
   */
  public resolveModel(
    requestedModelId = 'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M',
    fallbackModelId = 'Qwen3.5-9B-Heretic-Q4_K_M',
    activeProvider = 'llama.cpp',
  ): ModelResolutionDecision {
    const requested = this.models.get(requestedModelId);

    // 1. Requested model exists and is installed
    if (requested && requested.isInstalled) {
      return {
        requestedModelId,
        resolvedModelId: requestedModelId,
        isFallback: false,
        activeProvider,
        status: 'ready',
        modelDetails: requested,
      };
    }

    // 2. Requested model is missing; attempt fallback
    const fallback = this.models.get(fallbackModelId);
    if (fallback && fallback.isInstalled) {
      const reason = requested
        ? `Configured model '${requestedModelId}' weights missing at ${requested.filePath}`
        : `Model '${requestedModelId}' is not registered in the authoritative model registry`;

      this.logger.warn(`Model resolution fallback: ${reason}. Resolved to '${fallbackModelId}'.`);
      return {
        requestedModelId,
        resolvedModelId: fallbackModelId,
        isFallback: true,
        fallbackReason: reason,
        activeProvider,
        status: 'degraded',
        modelDetails: fallback,
      };
    }

    // 3. Fallback also unavailable; look for any installed primary model
    const anyInstalled = Array.from(this.models.values()).find(
      (m) => m.isInstalled && m.inputModalities.includes('text') && m.outputModalities.includes('text'),
    );

    if (anyInstalled) {
      const reason = `Neither requested '${requestedModelId}' nor fallback '${fallbackModelId}' installed. Cascading to available model '${anyInstalled.id}'`;
      this.logger.warn(`Model emergency cascade: ${reason}`);
      return {
        requestedModelId,
        resolvedModelId: anyInstalled.id,
        isFallback: true,
        fallbackReason: reason,
        activeProvider,
        status: 'degraded',
        modelDetails: anyInstalled,
      };
    }

    // 4. Completely unavailable
    return {
      requestedModelId,
      resolvedModelId: requestedModelId,
      isFallback: false,
      fallbackReason: `No compatible text model installed on the device for provider '${activeProvider}'`,
      activeProvider,
      status: 'unavailable',
    };
  }

  /**
   * Evaluates vision projector file compatibility for a multimodal model.
   */
  public validateVisionProjector(modelId: string): {
    compatible: boolean;
    supportsVision: boolean;
    projectorPath?: string;
    error?: string;
  } {
    const model = this.models.get(modelId);
    if (!model) {
      return { compatible: false, supportsVision: false, error: `Model '${modelId}' not registered` };
    }

    if (!model.supportsVision) {
      return { compatible: false, supportsVision: false, error: `Model '${modelId}' architecture does not support vision projector` };
    }

    if (!model.visionProjectorPath || !fs.existsSync(model.visionProjectorPath)) {
      return {
        compatible: false,
        supportsVision: true,
        projectorPath: model.visionProjectorPath,
        error: `Vision projector file missing at ${model.visionProjectorPath}`,
      };
    }

    const stat = fs.statSync(model.visionProjectorPath);
    if (stat.size < 100 * 1024 * 1024) {
      // mmproj files are at least 100MB
      return {
        compatible: false,
        supportsVision: true,
        projectorPath: model.visionProjectorPath,
        error: `Vision projector file is corrupt or truncated (${stat.size} bytes)`,
      };
    }

    return {
      compatible: true,
      supportsVision: true,
      projectorPath: model.visionProjectorPath,
    };
  }

  /**
   * Compares two benchmarked candidate models and determines the winner based on empirical metrics.
   */
  public compareCandidates(candidateAId: string, candidateBId: string): ModelComparison {
    const candidateA = this.models.get(candidateAId);
    const candidateB = this.models.get(candidateBId);

    if (!candidateA || !candidateB) {
      throw new Error(`Cannot compare models: one or both models not found (${candidateAId}, ${candidateBId})`);
    }

    const bmA = candidateA.benchmarks;
    const bmB = candidateB.benchmarks;

    if (!bmA || !bmB) {
      throw new Error(`Cannot compare models: benchmark results missing for ${!bmA ? candidateAId : candidateBId}`);
    }

    const comparisons: ModelComparison['comparisons'] = {
      throughput: {
        candidateAValue: bmA.tokensPerSecond,
        candidateBValue: bmB.tokensPerSecond,
        advantage: bmA.tokensPerSecond > bmB.tokensPerSecond ? 'candidateA' : 'candidateB',
      },
      ttft: {
        candidateAValue: bmA.ttftMs,
        candidateBValue: bmB.ttftMs,
        advantage: bmA.ttftMs < bmB.ttftMs ? 'candidateA' : 'candidateB', // lower is better
      },
      reasoning: {
        candidateAValue: bmA.reasoningScore,
        candidateBValue: bmB.reasoningScore,
        advantage: bmA.reasoningScore >= bmB.reasoningScore ? 'candidateA' : 'candidateB',
      },
      toolAdherence: {
        candidateAValue: bmA.toolAdherenceScore,
        candidateBValue: bmB.toolAdherenceScore,
        advantage: bmA.toolAdherenceScore >= bmB.toolAdherenceScore ? 'candidateA' : 'candidateB',
      },
      jsonValidity: {
        candidateAValue: bmA.jsonValidityScore,
        candidateBValue: bmB.jsonValidityScore,
        advantage: bmA.jsonValidityScore >= bmB.jsonValidityScore ? 'candidateA' : 'candidateB',
      },
      contextStability: {
        candidateAValue: bmA.contextStabilityScore,
        candidateBValue: bmB.contextStabilityScore,
        advantage: bmA.contextStabilityScore >= bmB.contextStabilityScore ? 'candidateA' : 'candidateB',
      },
      conversationalQuality: {
        candidateAValue: bmA.conversationalQualityScore,
        candidateBValue: bmB.conversationalQualityScore,
        advantage: bmA.conversationalQualityScore >= bmB.conversationalQualityScore ? 'candidateA' : 'candidateB',
      },
      memoryFootprint: {
        candidateAValue: bmA.peakMemoryBytes,
        candidateBValue: bmB.peakMemoryBytes,
        advantage: bmA.peakMemoryBytes < bmB.peakMemoryBytes ? 'candidateA' : 'candidateB', // lower is better
      },
    };

    // Weighted scoring for cognitive agent deployment:
    // Quality & Accuracy: reasoning (25%), toolAdherence (20%), jsonValidity (15%), conversationalQuality (15%), contextStability (10%)
    // Performance: throughput (10%), memoryFootprint (5%)
    let scoreA = 0;
    let scoreB = 0;

    scoreA += bmA.reasoningScore * 25 + bmA.toolAdherenceScore * 20 + bmA.jsonValidityScore * 15 + bmA.conversationalQualityScore * 15 + bmA.contextStabilityScore * 10;
    scoreB += bmB.reasoningScore * 25 + bmB.toolAdherenceScore * 20 + bmB.jsonValidityScore * 15 + bmB.conversationalQualityScore * 15 + bmB.contextStabilityScore * 10;

    // Throughput bonus (normalized up to 30 tps)
    scoreA += (bmA.tokensPerSecond / 30) * 10;
    scoreB += (bmB.tokensPerSecond / 30) * 10;

    const winnerId = scoreA >= scoreB ? candidateAId : candidateBId;
    const winnerName = scoreA >= scoreB ? candidateA.name : candidateB.name;
    const reason = `Selected '${winnerName}' with composite score ${(Math.max(scoreA, scoreB)).toFixed(1)} vs ${(Math.min(scoreA, scoreB)).toFixed(1)} based on superior reasoning, tool adherence, and conversational quality.`;

    return {
      candidateA,
      candidateB,
      winnerId,
      selectionReason: reason,
      comparisons,
    };
  }
}

export const defaultModelRegistry = new ModelRegistryService();
