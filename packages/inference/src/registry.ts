import {
  InferenceConfig,
  InferenceConfigSchema,
  InferenceHealthResult,
  InferenceProviderType,
} from '@arletex/contracts';
import { ILogger, ModelUnavailableError, rootLogger } from '@arletex/core';
import { ChatStreamOptions, IInferenceProvider } from './types.js';
import { LlamaServerAdapter } from './adapters/llamaServerAdapter.js';
import { ColibriAdapter } from './adapters/colibriAdapter.js';
import { OllamaAdapter } from './adapters/ollamaAdapter.js';
import { OpenAICompatibleAdapter } from './adapters/openAiCompatibleAdapter.js';
import { HardwareProfile, HardwareProfileDetector } from './hardware/hardwareProfileDetector.js';

export class InferenceProviderRegistry implements IInferenceProvider {
  public readonly providerType: InferenceProviderType;
  public readonly name = 'Multi-Engine Inference Registry';

  private providers: Map<InferenceProviderType, IInferenceProvider> = new Map();
  private activeType: InferenceProviderType;
  private fallbackOrder: InferenceProviderType[];
  private hardwareDetector: HardwareProfileDetector;
  private currentProfile?: HardwareProfile;
  private config: InferenceConfig;
  private readonly logger: ILogger;

  constructor(
    config: Partial<InferenceConfig> = {},
    options: {
      providers?: Map<InferenceProviderType, IInferenceProvider>;
      hardwareDetector?: HardwareProfileDetector;
      logger?: ILogger;
    } = {},
  ) {
    this.config = InferenceConfigSchema.parse(config);
    this.logger = (options.logger || rootLogger).child('InferenceProviderRegistry');
    this.activeType = this.config.provider;
    this.providerType = this.activeType;
    this.hardwareDetector = options.hardwareDetector || new HardwareProfileDetector(this.logger);

    // Default fallback order
    this.fallbackOrder = ['llama.cpp', 'ollama', 'openai_compatible', 'vllm', 'colibri'];

    if (options.providers) {
      this.providers = options.providers;
    } else {
      // Initialize standard adapter instances
      this.registerProvider(
        'llama.cpp',
        new LlamaServerAdapter(
          {
            ...this.config,
            provider: 'llama.cpp',
            serverUrl:
              this.config.provider === 'llama.cpp'
                ? this.config.serverUrl
                : 'http://127.0.0.1:8080',
          },
          this.logger,
        ),
      );

      this.registerProvider(
        'ollama',
        new OllamaAdapter(
          {
            ...this.config,
            provider: 'ollama',
            serverUrl:
              this.config.provider === 'ollama' ? this.config.serverUrl : 'http://127.0.0.1:11434',
          },
          this.logger,
        ),
      );

      this.registerProvider(
        'openai_compatible',
        new OpenAICompatibleAdapter(
          {
            ...this.config,
            provider: 'openai_compatible',
            serverUrl:
              this.config.provider === 'openai_compatible'
                ? this.config.serverUrl
                : 'http://127.0.0.1:8000',
          },
          { providerType: 'openai_compatible', logger: this.logger },
        ),
      );

      this.registerProvider(
        'vllm',
        new OpenAICompatibleAdapter(
          {
            ...this.config,
            provider: 'vllm',
            serverUrl:
              this.config.provider === 'vllm' ? this.config.serverUrl : 'http://127.0.0.1:8000',
          },
          { providerType: 'vllm', name: 'vLLM Engine', logger: this.logger },
        ),
      );

      this.registerProvider(
        'colibri',
        new ColibriAdapter(
          {
            ...this.config,
            provider: 'colibri',
            serverUrl:
              this.config.provider === 'colibri' ? this.config.serverUrl : 'http://127.0.0.1:8000',
          },
          this.logger,
        ),
      );
    }
  }

  public getHardwareProfile(): HardwareProfile | undefined {
    return this.currentProfile;
  }

  public registerProvider(type: InferenceProviderType, provider: IInferenceProvider): void {
    this.providers.set(type, provider);
    this.logger.debug(`Registered inference provider: ${type} (${provider.name})`);
  }

  public getProvider(type: InferenceProviderType): IInferenceProvider | undefined {
    return this.providers.get(type);
  }

  public listProviders(): Array<{ type: InferenceProviderType; name: string }> {
    return Array.from(this.providers.entries()).map(([type, p]) => ({
      type,
      name: p.name,
    }));
  }

  public getActiveProvider(): IInferenceProvider {
    const p = this.providers.get(this.activeType);
    if (!p) {
      throw new ModelUnavailableError(
        this.config.serverUrl,
        new Error(`No provider registered for active type: ${this.activeType}`),
      );
    }
    return p;
  }

  public setActiveProvider(type: InferenceProviderType): IInferenceProvider {
    const p = this.providers.get(type);
    if (!p) {
      throw new Error(`Cannot switch to unregistered inference provider: ${type}`);
    }
    this.activeType = type;
    this.config.provider = type;
    this.logger.info(`Switched active inference provider to: ${type} (${p.name})`);
    return p;
  }

  public setFallbackOrder(order: InferenceProviderType[]): void {
    this.fallbackOrder = order;
  }

  public async checkHealth(): Promise<InferenceHealthResult> {
    return this.getActiveProvider().checkHealth();
  }

  public async checkAllHealth(): Promise<Record<string, InferenceHealthResult>> {
    const results: Record<string, InferenceHealthResult> = {};
    for (const [type, p] of this.providers.entries()) {
      results[type] = await p.checkHealth();
    }
    return results;
  }

  /**
   * Automatically discovers local hardware, running ports, and healthy backends,
   * selecting the optimal inference provider.
   */
  public async autoConfigure(
    preferredType?: InferenceProviderType,
  ): Promise<{ activeProvider: IInferenceProvider; hardwareProfile: HardwareProfile }> {
    const profile = await this.hardwareDetector.detectProfile();
    this.currentProfile = profile;

    let targetType = preferredType || profile.recommendedProvider;

    // Check if preferred/target is healthy; if not, cascade through fallbacks
    const targetProvider = this.providers.get(targetType);
    let isTargetHealthy = false;
    if (targetProvider) {
      const h = await targetProvider.checkHealth();
      if (h.status === 'connected') {
        isTargetHealthy = true;
      }
    }

    if (!isTargetHealthy) {
      this.logger.warn(`Primary provider '${targetType}' is not reachable. Testing fallbacks...`);
      for (const fallbackType of this.fallbackOrder) {
        if (fallbackType === targetType) continue;
        const p = this.providers.get(fallbackType);
        if (!p) continue;
        const fh = await p.checkHealth();
        if (fh.status === 'connected') {
          this.logger.info(`Found healthy fallback provider: ${fallbackType} (${p.name})`);
          targetType = fallbackType;
          break;
        }
      }
    }

    const selected = this.setActiveProvider(targetType);
    return { activeProvider: selected, hardwareProfile: profile };
  }

  public updateConfig(newConfig: Partial<InferenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.provider) {
      this.setActiveProvider(newConfig.provider);
    }
    for (const p of this.providers.values()) {
      p.updateConfig(newConfig);
    }
  }

  public getConfig(): InferenceConfig {
    return { ...this.config, provider: this.activeType };
  }

  /**
   * Discovers available models from the active provider or target provider endpoint.
   */
  public async discoverAvailableModels(type?: InferenceProviderType): Promise<string[]> {
    const target = type ? this.providers.get(type) : this.getActiveProvider();
    if (!target) return [];

    const cfg = target.getConfig();
    const url = cfg.serverUrl;

    try {
      // 1. Try /v1/models (llama.cpp, OpenAI, vLLM)
      const res = await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((m) => m.id);
        }
      }
    } catch {
      // Try next
    }

    try {
      // 2. Try Ollama /api/tags
      const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = (await res.json()) as { models?: Array<{ name: string }> };
        if (data.models && Array.isArray(data.models)) {
          return data.models.map((m) => m.name);
        }
      }
    } catch {
      // Default to configured model
    }

    return [cfg.defaultModelId];
  }

  /**
   * Streams chat with failover cascade: if the active provider fails to connect,
   * it tries healthy fallback providers before throwing.
   */
  public async streamChat(options: ChatStreamOptions): Promise<string> {
    const primary = this.getActiveProvider();
    try {
      return await primary.streamChat(options);
    } catch (err: any) {
      // Do not cascade on cancellation
      if (options.signal?.aborted || err.name === 'AbortError') {
        throw err;
      }

      this.logger.warn(
        `Primary provider '${this.activeType}' failed: ${err.message}. Cascading to fallbacks...`,
      );

      for (const fallbackType of this.fallbackOrder) {
        if (fallbackType === this.activeType) continue;
        const fallback = this.providers.get(fallbackType);
        if (!fallback) continue;

        try {
          const health = await fallback.checkHealth();
          if (health.status === 'connected') {
            this.logger.info(`Failing over to ${fallbackType} (${fallback.name})`);
            return await fallback.streamChat(options);
          }
        } catch {
          // Continue to next fallback
        }
      }

      throw err;
    }
  }
}
