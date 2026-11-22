import fs from 'node:fs';
import os from 'node:os';
import {
  BatteryMetrics,
  CognitiveStrain,
  CognitiveWorkload,
  ComputationalResourceMetrics,
  CpuMetrics,
  GpuMetrics,
  InteroceptiveSnapshot,
  MemoryMetrics,
  ModelAvailabilityState,
  OperationalConstraintState,
  OperationalMode,
  PlanningResourceAllocationAdjustment,
  ResourceRegulationDirective,
  StorageMetrics,
  ToolAvailabilityState,
  validateEpistemicInteroception,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IEmbodimentRepository } from './interfaces.js';

export interface EmbodimentEngineOptions {
  repository: IEmbodimentRepository;
  logger?: ILogger;
  llamaServerUrl?: string;
  specialistsServerUrl?: string;
}

export class EmbodimentInteroceptionEngine {
  private readonly repo: IEmbodimentRepository;
  private readonly logger: ILogger;
  private readonly llamaServerUrl: string;
  private readonly specialistsServerUrl: string;

  private currentMode: OperationalMode = 'optimal';
  private lastCpuSample: { idle: number; total: number } | null = null;

  constructor(options: EmbodimentEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('EmbodimentInteroceptionEngine');
    this.llamaServerUrl = options.llamaServerUrl || 'http://127.0.0.1:8080';
    this.specialistsServerUrl = options.specialistsServerUrl || 'http://127.0.0.1:39282';
  }

  // ==========================================
  // 1. Digital Physiology Probing
  // ==========================================

  public async probeDigitalPhysiology(
    telemetryOverride?: Partial<ComputationalResourceMetrics>,
  ): Promise<ComputationalResourceMetrics> {
    const timestamp = new Date().toISOString();
    const cpu = telemetryOverride?.cpu ?? this.readCpuMetrics();
    const memory = telemetryOverride?.memory ?? this.readMemoryMetrics();
    const gpu = telemetryOverride?.gpu ?? this.readGpuMetrics();
    const battery = telemetryOverride?.battery ?? this.readBatteryMetrics();
    const storage = telemetryOverride?.storage ?? this.readStorageMetrics();

    return {
      timestamp,
      cpu,
      memory,
      gpu,
      battery,
      storage,
    };
  }

  public async probeModelAvailability(): Promise<ModelAvailabilityState> {
    let llamaOnline = false;
    let llamaModel: string | null = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${this.llamaServerUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        llamaOnline = true;
        llamaModel = 'Qwen2.5-14B-Uncensored-Q4_K_M';
      }
    } catch {
      llamaOnline = false;
    }

    let specialistsOnline = false;
    let models = {
      embeddingGemma: false,
      whisper: false,
      kokoro: false,
      rvc: false,
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`${this.specialistsServerUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        specialistsOnline = true;
        const data = (await res.json()) as any;
        models = {
          embeddingGemma: Boolean(
            data.embeddingGemma ??
            data.modelsInstalled?.embeddingGemma ??
            data.modelsLoaded?.embeddingGemma,
          ),
          whisper: Boolean(
            data.whisper ?? data.modelsInstalled?.whisper ?? data.modelsLoaded?.whisper,
          ),
          kokoro: Boolean(data.kokoro ?? data.modelsInstalled?.kokoro ?? data.modelsLoaded?.kokoro),
          rvc: Boolean(data.rvc ?? data.modelsInstalled?.rvc ?? data.modelsLoaded?.rvc),
        };
      }
    } catch {
      specialistsOnline = false;
    }

    const llamaPort = parseInt(new URL(this.llamaServerUrl).port || '8080', 10);
    const specPort = parseInt(new URL(this.specialistsServerUrl).port || '39282', 10);

    return {
      llamaServer: {
        online: llamaOnline,
        port: llamaPort,
        activeModel: llamaModel,
        endpoint: this.llamaServerUrl,
      },
      specialistsServer: {
        online: specialistsOnline,
        port: specPort,
        endpoint: this.specialistsServerUrl,
      },
      models,
    };
  }

  public probeToolAvailability(): ToolAvailabilityState {
    const sandboxDir = os.homedir();
    return {
      browserSandbox: {
        available: true,
        allowedOrigins: ['localhost', '127.0.0.1', 'github.com', 'wikipedia.org', 'arxiv.org'],
      },
      filesystemSandbox: {
        available: true,
        baseDir: sandboxDir,
        readOnly: false,
      },
      bashExecution: {
        available: true,
        sandboxed: true,
      },
      uiAutomation: {
        mouseAvailable: true,
        keyboardAvailable: true,
      },
    };
  }

  // ==========================================
  // 2. Cognitive Workload Assessment
  // ==========================================

  public assessCognitiveWorkload(input?: {
    activeInferenceStreams?: number;
    queuedTasks?: number;
    memoryLoadPercent?: number;
    activePerceptionStreams?: number;
    recentTps?: number | null;
    recentTtftMs?: number | null;
  }): CognitiveWorkload {
    const activeStreams = input?.activeInferenceStreams ?? 0;
    const queued = input?.queuedTasks ?? 0;
    const memoryLoad = input?.memoryLoadPercent ?? 20;
    const perceptionStreams = input?.activePerceptionStreams ?? 0;

    let perceivedStrain: CognitiveStrain = 'nominal';
    if (activeStreams > 2 || queued > 5 || memoryLoad > 85) {
      perceivedStrain = 'critical';
    } else if (activeStreams > 1 || queued > 2 || memoryLoad > 70) {
      perceivedStrain = 'elevated';
    } else if (activeStreams > 0 || queued > 0 || memoryLoad > 50) {
      perceivedStrain = 'moderate';
    }

    return {
      activeInferenceStreams: activeStreams,
      queuedTasks: queued,
      memoryLoadPercent: memoryLoad,
      activePerceptionStreams: perceptionStreams,
      perceivedStrain,
      recentTps: input?.recentTps ?? null,
      recentTtftMs: input?.recentTtftMs ?? null,
    };
  }

  // ==========================================
  // 3. Operational Constraint Evaluation
  // ==========================================

  public evaluateOperationalConstraints(
    resources: ComputationalResourceMetrics,
    models: ModelAvailabilityState,
    workload: CognitiveWorkload,
  ): OperationalConstraintState {
    const constraints: string[] = [];
    let thermalPressure = false;
    let memoryPressure = false;
    let batteryPreservation = false;
    let serviceDegradation = false;

    // A. Thermal threshold checks
    const cpuTemp = resources.cpu.temperatureC;
    const gpuTemp = resources.gpu.temperatureC;
    if ((cpuTemp !== null && cpuTemp >= 80) || (gpuTemp !== null && gpuTemp >= 80)) {
      thermalPressure = true;
      constraints.push(
        `Thermal pressure detected: CPU ${cpuTemp ?? '--'}°C, GPU ${gpuTemp ?? '--'}°C (threshold: 80°C)`,
      );
    }

    // B. Memory threshold checks
    if (resources.memory.usagePercent >= 85 || resources.memory.swapUsagePercent >= 60) {
      memoryPressure = true;
      constraints.push(
        `Memory pressure: RAM ${resources.memory.usagePercent}% used, Swap ${resources.memory.swapUsagePercent}% used`,
      );
    }

    // C. Battery preservation checks
    if (
      resources.battery.available &&
      resources.battery.percent !== null &&
      resources.battery.percent <= 20 &&
      !resources.battery.isCharging
    ) {
      batteryPreservation = true;
      constraints.push(`Low battery state: ${resources.battery.percent}% remaining, discharging`);
    }

    // D. Service availability degradation
    if (!models.llamaServer.online) {
      serviceDegradation = true;
      constraints.push(
        `Primary cognitive engine (llama-server port ${models.llamaServer.port}) is offline`,
      );
    }
    if (!models.specialistsServer.online) {
      serviceDegradation = true;
      constraints.push(
        `Specialist microservice (port ${models.specialistsServer.port}) is offline`,
      );
    }

    // Determine operational mode
    let mode: OperationalMode = 'optimal';
    const isCriticalThermal =
      (cpuTemp !== null && cpuTemp >= 88) || (gpuTemp !== null && gpuTemp >= 88);
    const isCriticalMemory = resources.memory.usagePercent >= 95;

    if (isCriticalThermal || isCriticalMemory) {
      mode = 'emergency';
    } else if (thermalPressure || memoryPressure || workload.perceivedStrain === 'critical') {
      mode = 'throttled';
    } else if (
      batteryPreservation ||
      serviceDegradation ||
      workload.perceivedStrain === 'elevated'
    ) {
      mode = 'conservative';
    }

    return {
      mode,
      isThrottled: mode === 'throttled' || mode === 'emergency',
      thermalPressure,
      memoryPressure,
      batteryPreservation,
      serviceDegradation,
      constraints,
    };
  }

  // ==========================================
  // 4. Resource Self-Regulation Directive
  // ==========================================

  public regulateResources(
    constraintState: OperationalConstraintState,
    resources: ComputationalResourceMetrics,
  ): ResourceRegulationDirective {
    const previousMode = this.currentMode;
    const targetMode = constraintState.mode;
    const now = new Date().toISOString();

    let throttleBackgroundTasks = false;
    let maxContextTokensAdjustment = 0;
    let suspendHeavyMultimodal = false;
    let reason = 'Computational parameters within nominal operating bounds';

    switch (targetMode) {
      case 'emergency':
        throttleBackgroundTasks = true;
        maxContextTokensAdjustment = -1024;
        suspendHeavyMultimodal = true;
        reason = `EMERGENCY THROTTLE: Critical system threshold breached (${constraintState.constraints.join('; ')})`;
        break;
      case 'throttled':
        throttleBackgroundTasks = true;
        maxContextTokensAdjustment = -512;
        suspendHeavyMultimodal = constraintState.thermalPressure || constraintState.memoryPressure;
        reason = `Resource pressure mitigation active: ${constraintState.constraints.join('; ')}`;
        break;
      case 'conservative':
        throttleBackgroundTasks = true;
        maxContextTokensAdjustment = -256;
        suspendHeavyMultimodal = false;
        reason = `Conservative operation engaged for sustainability: ${constraintState.constraints.join('; ')}`;
        break;
      case 'optimal':
      default:
        throttleBackgroundTasks = false;
        maxContextTokensAdjustment = 0;
        suspendHeavyMultimodal = false;
        reason = 'All systems nominal; full operational capacity authorized.';
        break;
    }

    const directive: ResourceRegulationDirective = {
      targetMode,
      throttleBackgroundTasks,
      maxContextTokensAdjustment,
      suspendHeavyMultimodal,
      appliedAt: now,
      reason,
    };

    // If mode transitioned, record an operational constraint event
    if (previousMode !== targetMode) {
      this.logger.info(`Operational mode transition: ${previousMode} -> ${targetMode} (${reason})`);
      this.repo.recordConstraintEvent({
        id: crypto.randomUUID(),
        timestamp: now,
        previousMode,
        newMode: targetMode,
        triggerReason: reason,
        resourceState: resources,
        directiveIssued: directive,
      });
      this.currentMode = targetMode;
    }

    this.repo.recordRegulationDirective(directive);
    return directive;
  }

  // ==========================================
  // 5. Epistemically Honest Interoceptive Report
  // Negative Invariant: Reject biological metaphors
  // ==========================================

  public synthesizeDigitalPhysiologicalReport(
    resources: ComputationalResourceMetrics,
    models: ModelAvailabilityState,
    workload: CognitiveWorkload,
    constraintState: OperationalConstraintState,
    directive: ResourceRegulationDirective,
  ): string {
    const ramGbUsed = (resources.memory.usedBytes / 1024 ** 3).toFixed(1);
    const ramGbTotal = (resources.memory.totalBytes / 1024 ** 3).toFixed(1);
    const cpuGhz = resources.cpu.frequencyMhz
      ? `${(resources.cpu.frequencyMhz / 1000).toFixed(2)} GHz`
      : '--';
    const cpuTemp = resources.cpu.temperatureC !== null ? `${resources.cpu.temperatureC}°C` : 'N/A';
    const gpuTemp = resources.gpu.temperatureC !== null ? `${resources.gpu.temperatureC}°C` : 'N/A';
    const gpuLoad = resources.gpu.usagePercent !== null ? `${resources.gpu.usagePercent}%` : 'N/A';
    const batteryStatus = resources.battery.available
      ? `${resources.battery.percent}% (${resources.battery.isCharging ? 'AC charging' : 'battery discharging'})`
      : 'AC mains';

    const llamaStatus = models.llamaServer.online
      ? `ONLINE (port ${models.llamaServer.port})`
      : 'OFFLINE';
    const specStatus = models.specialistsServer.online
      ? `ONLINE (port ${models.specialistsServer.port})`
      : 'OFFLINE';

    const report = [
      `[Interoception Mode: ${constraintState.mode.toUpperCase()}]`,
      `Compute: CPU ${resources.cpu.usagePercent ?? 0}% @ ${cpuGhz} (Temp: ${cpuTemp}) | GPU: ${gpuLoad} (Temp: ${gpuTemp}, ${resources.gpu.name || 'Vulkan APU'})`,
      `Memory: RAM ${ramGbUsed}/${ramGbTotal} GB (${resources.memory.usagePercent}%), Swap: ${resources.memory.swapUsagePercent}%`,
      `Power: ${batteryStatus}`,
      `Cognitive Infrastructure: llama-server ${llamaStatus} | Specialists ${specStatus} (Gemma:${models.models.embeddingGemma ? 'Y' : 'N'}, Whisper:${models.models.whisper ? 'Y' : 'N'}, Kokoro:${models.models.kokoro ? 'Y' : 'N'})`,
      `Workload: ${workload.perceivedStrain} (${workload.activeInferenceStreams} active inferences, ${workload.queuedTasks} queued tasks)`,
      `Regulation Directive: ${directive.reason}${directive.throttleBackgroundTasks ? ' [Background tasks throttled]' : ''}${directive.suspendHeavyMultimodal ? ' [Dense multimodal suspended]' : ''}`,
    ].join('\n');

    // Strict invariant check
    const validation = validateEpistemicInteroception(report);
    if (!validation.valid) {
      throw new Error(
        `Epistemic integrity violation in digital physiological report: ${validation.violation}`,
      );
    }

    return report;
  }

  // ==========================================
  // 6. Full Interoceptive Cycle
  // ==========================================

  public async conductInteroceptiveCycle(options?: {
    telemetryOverride?: Partial<ComputationalResourceMetrics>;
    modelsOverride?: Partial<ModelAvailabilityState>;
    workloadOverride?: {
      activeInferenceStreams?: number;
      queuedTasks?: number;
      memoryLoadPercent?: number;
      activePerceptionStreams?: number;
    };
  }): Promise<InteroceptiveSnapshot> {
    const resources = await this.probeDigitalPhysiology(options?.telemetryOverride);
    const probedModels = await this.probeModelAvailability();
    const models: ModelAvailabilityState = {
      ...probedModels,
      ...options?.modelsOverride,
      llamaServer: {
        ...probedModels.llamaServer,
        ...(options?.modelsOverride?.llamaServer || {}),
      },
      specialistsServer: {
        ...probedModels.specialistsServer,
        ...(options?.modelsOverride?.specialistsServer || {}),
      },
      models: {
        ...probedModels.models,
        ...(options?.modelsOverride?.models || {}),
      },
    };
    const tools = this.probeToolAvailability();
    const workload = this.assessCognitiveWorkload(options?.workloadOverride);

    const constraints = this.evaluateOperationalConstraints(resources, models, workload);
    const directive = this.regulateResources(constraints, resources);
    const digitalPhysiologicalReport = this.synthesizeDigitalPhysiologicalReport(
      resources,
      models,
      workload,
      constraints,
      directive,
    );

    const snapshot: InteroceptiveSnapshot = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      resources,
      models,
      tools,
      workload,
      operationalMode: constraints.mode,
      constraints: constraints.constraints,
      directive,
      digitalPhysiologicalReport,
    };

    this.repo.saveSnapshot(snapshot);
    return snapshot;
  }

  // ==========================================
  // 7. Planning & Resource Allocation Incorporation
  // Acceptance Criteria: Arle must recognize changes in computational environment
  // and incorporate them into planning and resource allocation.
  // ==========================================

  public incorporateIntoPlanning(planRequirements?: {
    parallelTasksRequested?: number;
    requiresHeavyMultimodal?: boolean;
    demandedContextTokens?: number;
  }): PlanningResourceAllocationAdjustment {
    const latestSnapshot = this.repo.getLatestSnapshot();
    const mode = latestSnapshot?.operationalMode ?? this.currentMode;
    const isThermal =
      latestSnapshot?.resources.cpu.temperatureC !== null &&
      (latestSnapshot?.resources.cpu.temperatureC ?? 0) >= 78;
    const isMemoryConstrained = (latestSnapshot?.resources.memory.usagePercent ?? 0) >= 80;

    let allowedParallelSubtasks = 4;
    let maxFrameRateOrFrames = 12;
    let allowBackgroundSelfRefinement = true;
    let recommendedThinkingBudgetTokens = 4096;
    const reasons: string[] = [];

    switch (mode) {
      case 'emergency':
        allowedParallelSubtasks = 1;
        maxFrameRateOrFrames = 2;
        allowBackgroundSelfRefinement = false;
        recommendedThinkingBudgetTokens = 1024;
        reasons.push(
          'Emergency mode: serial execution strictly enforced to prevent device crashes',
        );
        break;
      case 'throttled':
        allowedParallelSubtasks = 1;
        maxFrameRateOrFrames = 4;
        allowBackgroundSelfRefinement = false;
        recommendedThinkingBudgetTokens = 2048;
        reasons.push(
          'Throttled mode: single subtask execution to dissipate thermal and memory load',
        );
        break;
      case 'conservative':
        allowedParallelSubtasks = 2;
        maxFrameRateOrFrames = 6;
        allowBackgroundSelfRefinement = true;
        recommendedThinkingBudgetTokens = 3072;
        reasons.push('Conservative mode: moderate concurrency to sustain operational endurance');
        break;
      case 'optimal':
      default:
        allowedParallelSubtasks = Math.min(planRequirements?.parallelTasksRequested ?? 4, 4);
        maxFrameRateOrFrames = 12;
        allowBackgroundSelfRefinement = true;
        recommendedThinkingBudgetTokens = 4096;
        reasons.push(
          'Optimal compute capacity: nominal parallel execution and full cognitive budget permitted',
        );
        break;
    }

    if (isThermal) {
      maxFrameRateOrFrames = Math.min(maxFrameRateOrFrames, 4);
      reasons.push('Thermal elevation requires capping visual sampling rate');
    }
    if (isMemoryConstrained) {
      recommendedThinkingBudgetTokens = Math.min(recommendedThinkingBudgetTokens, 2048);
      reasons.push('High memory occupancy requires restricting thought context token expansion');
    }

    return {
      allowedParallelSubtasks,
      maxFrameRateOrFrames,
      allowBackgroundSelfRefinement,
      recommendedThinkingBudgetTokens,
      rationale: reasons.join('; '),
    };
  }

  // ==========================================
  // Internal Hardware Telemetry Probers
  // ==========================================

  private readCpuMetrics(): CpuMetrics {
    let usagePercent: number | null = null;
    let frequencyMhz: number | null = null;
    let temperatureC: number | null = null;

    try {
      const cpus = os.cpus();
      if (cpus.length > 0) {
        frequencyMhz = cpus[0]?.speed ?? null;
        let totalIdle = 0;
        let totalTick = 0;
        for (const cpu of cpus) {
          for (const type of Object.keys(cpu.times)) {
            totalTick += (cpu.times as any)[type];
          }
          totalIdle += cpu.times.idle;
        }

        if (this.lastCpuSample) {
          const idleDelta = totalIdle - this.lastCpuSample.idle;
          const totalDelta = totalTick - this.lastCpuSample.total;
          if (totalDelta > 0) {
            usagePercent = parseFloat((((totalDelta - idleDelta) / totalDelta) * 100).toFixed(1));
          }
        }
        this.lastCpuSample = { idle: totalIdle, total: totalTick };
      }

      // Check hwmon thermal sensors for CPU
      const hwmonDirs = [
        '/sys/class/thermal/thermal_zone0/temp',
        '/sys/class/hwmon/hwmon1/temp1_input',
      ];
      for (const p of hwmonDirs) {
        if (fs.existsSync(p)) {
          const milli = parseInt(fs.readFileSync(p, 'utf8').trim(), 10);
          temperatureC = parseFloat((milli / 1000).toFixed(1));
          break;
        }
      }
    } catch {}

    const loadavg = os.loadavg();
    return {
      usagePercent,
      frequencyMhz,
      temperatureC,
      loadAverage: [
        parseFloat(loadavg[0]?.toFixed(2) || '0'),
        parseFloat(loadavg[1]?.toFixed(2) || '0'),
        parseFloat(loadavg[2]?.toFixed(2) || '0'),
      ],
      model: os.cpus()[0]?.model || null,
    };
  }

  private readMemoryMetrics(): MemoryMetrics {
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    let availableBytes = freeBytes;
    let swapTotalBytes = 0;
    let swapUsedBytes = 0;

    try {
      if (fs.existsSync('/proc/meminfo')) {
        const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
        const getKb = (k: string) => {
          const m = meminfo.match(new RegExp(`^${k}:\\s+(\\d+)\\s+kB`, 'm'));
          return m && m[1] ? parseInt(m[1], 10) * 1024 : 0;
        };
        availableBytes = getKb('MemAvailable') || freeBytes;
        swapTotalBytes = getKb('SwapTotal');
        const swapFree = getKb('SwapFree');
        swapUsedBytes = Math.max(0, swapTotalBytes - swapFree);
      }
    } catch {}

    const usedBytes = Math.max(0, totalBytes - availableBytes);
    const usagePercent =
      totalBytes > 0 ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;
    const swapUsagePercent =
      swapTotalBytes > 0 ? parseFloat(((swapUsedBytes / swapTotalBytes) * 100).toFixed(1)) : 0;

    return {
      totalBytes,
      usedBytes,
      freeBytes,
      availableBytes,
      usagePercent,
      swapTotalBytes,
      swapUsedBytes,
      swapUsagePercent,
    };
  }

  private readGpuMetrics(): GpuMetrics {
    let available = false;
    let name: string | null = null;
    let usagePercent: number | null = null;
    let temperatureC: number | null = null;

    try {
      const gpuBusyPath = '/sys/class/drm/card1/device/gpu_busy_percent';
      if (fs.existsSync(gpuBusyPath)) {
        available = true;
        name = 'AMD Radeon 780M (Vulkan Unified)';
        usagePercent = parseInt(fs.readFileSync(gpuBusyPath, 'utf8').trim(), 10);

        const tempPath = '/sys/class/drm/card1/device/hwmon/hwmon7/temp1_input';
        if (fs.existsSync(tempPath)) {
          const milli = parseInt(fs.readFileSync(tempPath, 'utf8').trim(), 10);
          temperatureC = parseFloat((milli / 1000).toFixed(1));
        }
      }
    } catch {}

    return {
      available,
      name,
      usagePercent,
      temperatureC,
      vramTotalBytes: null,
      vramUsedBytes: null,
      vramFreeBytes: null,
      powerWatts: null,
    };
  }

  private readBatteryMetrics(): BatteryMetrics {
    let available = false;
    let percent: number | null = null;
    let isCharging: boolean | null = null;
    let powerWatts: number | null = null;

    try {
      const batDir = '/sys/class/power_supply/BAT0';
      if (fs.existsSync(batDir)) {
        available = true;
        const capPath = `${batDir}/capacity`;
        if (fs.existsSync(capPath)) {
          percent = parseInt(fs.readFileSync(capPath, 'utf8').trim(), 10);
        }
        const statusPath = `${batDir}/status`;
        if (fs.existsSync(statusPath)) {
          const s = fs.readFileSync(statusPath, 'utf8').trim();
          isCharging = s === 'Charging';
        }
        const powerPath = `${batDir}/power_now`;
        if (fs.existsSync(powerPath)) {
          const microWatts = parseInt(fs.readFileSync(powerPath, 'utf8').trim(), 10);
          powerWatts = parseFloat((microWatts / 1_000_000).toFixed(1));
        }
      }
    } catch {}

    return {
      available,
      percent,
      isCharging,
      powerWatts,
    };
  }

  private readStorageMetrics(): StorageMetrics {
    let totalBytes = 0;
    let freeBytes = 0;
    let usedBytes = 0;
    let usagePercent = 0;

    try {
      const targetPath = fs.existsSync(os.homedir()) ? os.homedir() : '/';
      const stats = fs.statfsSync(targetPath);
      totalBytes = stats.blocks * stats.bsize;
      freeBytes = stats.bfree * stats.bsize;
      usedBytes = Math.max(0, totalBytes - freeBytes);
      usagePercent = totalBytes > 0 ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;
    } catch {}

    return { totalBytes, usedBytes, freeBytes, usagePercent };
  }
}

// ==========================================
// In-Memory Repository for Tests & Mocking
// ==========================================

export class InMemoryEmbodimentRepository implements IEmbodimentRepository {
  private snapshots: InteroceptiveSnapshot[] = [];
  private constraintEvents: Array<{
    id: string;
    timestamp: string;
    previousMode: OperationalMode;
    newMode: OperationalMode;
    triggerReason: string;
    resourceState: ComputationalResourceMetrics;
    directiveIssued: ResourceRegulationDirective;
    createdAt: string;
  }> = [];
  private directives: Array<ResourceRegulationDirective & { id: string }> = [];

  public saveSnapshot(snapshot: InteroceptiveSnapshot): void {
    const idx = this.snapshots.findIndex((s) => s.id === snapshot.id);
    if (idx >= 0) {
      this.snapshots[idx] = snapshot;
    } else {
      this.snapshots.push(snapshot);
    }
  }

  public getSnapshotById(id: string): InteroceptiveSnapshot | null {
    return this.snapshots.find((s) => s.id === id) || null;
  }

  public getLatestSnapshot(): InteroceptiveSnapshot | null {
    if (this.snapshots.length === 0) return null;
    return [...this.snapshots].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] || null;
  }

  public listSnapshots(limit: number = 50): InteroceptiveSnapshot[] {
    return [...this.snapshots]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  public recordConstraintEvent(event: {
    id: string;
    timestamp: string;
    previousMode: OperationalMode;
    newMode: OperationalMode;
    triggerReason: string;
    resourceState: ComputationalResourceMetrics;
    directiveIssued: ResourceRegulationDirective;
  }): void {
    this.constraintEvents.push({
      ...event,
      createdAt: new Date().toISOString(),
    });
  }

  public listConstraintEvents(limit: number = 50): Array<{
    id: string;
    timestamp: string;
    previousMode: OperationalMode;
    newMode: OperationalMode;
    triggerReason: string;
    resourceState: ComputationalResourceMetrics;
    directiveIssued: ResourceRegulationDirective;
    createdAt: string;
  }> {
    return [...this.constraintEvents]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  public recordRegulationDirective(directive: ResourceRegulationDirective & { id?: string }): void {
    this.directives.push({
      ...directive,
      id: directive.id || crypto.randomUUID(),
    });
  }

  public getLatestRegulationDirective(): ResourceRegulationDirective | null {
    if (this.directives.length === 0) return null;
    const sorted = [...this.directives].sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
    return sorted[0] || null;
  }
}
