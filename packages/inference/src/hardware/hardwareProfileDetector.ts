import fs from 'node:fs';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { InferenceProviderType } from '@arletex/contracts';
import { ILogger, rootLogger } from '@arletex/core';

export interface HardwareProfile {
  deviceType: 'rog_ally_x' | 'nvidia_workstation' | 'apple_silicon' | 'generic_linux' | 'generic_cpu';
  cpuModel: string;
  totalRamGb: number;
  hasVulkan: boolean;
  hasCuda: boolean;
  gpuName: string;
  recommendedProvider: InferenceProviderType;
  recommendedGpuLayers: number;
  recommendedContextSize: number;
  activePorts: {
    llamaCpp: boolean;
    ollama: boolean;
    vllmOrColibri: boolean;
  };
}

export class HardwareProfileDetector {
  private readonly logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('HardwareProfileDetector');
  }

  /**
   * Detects current host hardware profile and acceleration capabilities.
   */
  public async detectProfile(): Promise<HardwareProfile> {
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0]!.model : 'Unknown CPU';
    const totalRamGb = Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10;

    let hasVulkan = false;
    let hasCuda = false;
    let gpuName = 'Unknown GPU';

    // 1. Check Vulkan support
    if (fs.existsSync('/dev/dri/renderD128') || fs.existsSync('/usr/bin/vulkaninfo')) {
      hasVulkan = true;
    }

    // 2. Check GPU via lspci or DRI
    try {
      const lspciOut = execSync('lspci 2>/dev/null', { encoding: 'utf-8', timeout: 1000 });
      if (lspciOut.toLowerCase().includes('radeon') || lspciOut.toLowerCase().includes('amd')) {
        hasVulkan = true;
        if (lspciOut.includes('780M') || lspciOut.includes('Phoenix')) {
          gpuName = 'AMD Radeon 780M (Phoenix / Z1 Extreme)';
        } else {
          gpuName = 'AMD Radeon GPU';
        }
      } else if (lspciOut.toLowerCase().includes('nvidia')) {
        hasCuda = true;
        gpuName = 'NVIDIA GPU';
      }
    } catch {
      // Fallback
    }

    // 3. Check NVIDIA CUDA via nvidia-smi
    if (!hasCuda) {
      try {
        execSync('which nvidia-smi 2>/dev/null', { timeout: 1000 });
        hasCuda = true;
        gpuName = 'NVIDIA GPU (CUDA)';
      } catch {
        // Not nvidia
      }
    }

    // 4. Identify Device Profile
    const isRogAlly =
      gpuName.includes('780M') ||
      cpuModel.toLowerCase().includes('z1 extreme') ||
      fs.existsSync('/sys/devices/virtual/dmi/id/product_name') &&
        fs.readFileSync('/sys/devices/virtual/dmi/id/product_name', 'utf-8').toLowerCase().includes('ally');

    let deviceType: HardwareProfile['deviceType'] = 'generic_cpu';
    let recommendedProvider: InferenceProviderType = 'llama.cpp';
    let recommendedGpuLayers = 0;
    let recommendedContextSize = 4096;

    if (isRogAlly) {
      deviceType = 'rog_ally_x';
      recommendedProvider = 'llama.cpp'; // Vulkan accelerated
      recommendedGpuLayers = 99; // Offload all layers to Radeon 780M Vulkan VRAM
      recommendedContextSize = 8192;
    } else if (hasCuda) {
      deviceType = 'nvidia_workstation';
      recommendedProvider = 'vllm';
      recommendedGpuLayers = 99;
      recommendedContextSize = 16384;
    } else if (hasVulkan) {
      deviceType = 'generic_linux';
      recommendedProvider = 'llama.cpp';
      recommendedGpuLayers = 33;
      recommendedContextSize = 8192;
    }

    // 5. Probe Active Inference Ports
    const activePorts = await this.probeLocalInferencePorts();

    // If an engine is actively running, prefer that running provider
    if (activePorts.llamaCpp) {
      recommendedProvider = 'llama.cpp';
    } else if (activePorts.ollama) {
      recommendedProvider = 'ollama';
    } else if (activePorts.vllmOrColibri) {
      recommendedProvider = 'vllm';
    }

    const profile: HardwareProfile = {
      deviceType,
      cpuModel,
      totalRamGb,
      hasVulkan,
      hasCuda,
      gpuName,
      recommendedProvider,
      recommendedGpuLayers,
      recommendedContextSize,
      activePorts,
    };

    this.logger.info(
      `Hardware detected: ${profile.deviceType} | ${profile.gpuName} | Recommended: ${profile.recommendedProvider}`,
    );

    return profile;
  }

  private async probePort(port: number): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(300),
      });
      return res.ok || res.status === 404 || res.status === 400 || res.status === 401;
    } catch {
      return false;
    }
  }

  public async probeLocalInferencePorts(): Promise<{
    llamaCpp: boolean;
    ollama: boolean;
    vllmOrColibri: boolean;
  }> {
    const [llamaCpp, ollama, vllmOrColibri] = await Promise.all([
      this.probePort(8080),
      this.probePort(11434),
      this.probePort(8000),
    ]);

    return { llamaCpp, ollama, vllmOrColibri };
  }
}
