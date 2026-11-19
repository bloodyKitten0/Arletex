import { describe, it, expect, vi } from 'vitest';
import {
  HardwareProfileDetector,
  InferenceProviderRegistry,
  OllamaAdapter,
  OpenAICompatibleAdapter,
  IInferenceProvider,
} from '@arletex/inference';

describe('Phase 5: Multi-Engine Inference & Hardware Portability', () => {
  it('1. Detects host hardware capabilities and optimizes configuration for AMD/ROG Ally X', async () => {
    const detector = new HardwareProfileDetector();
    const profile = await detector.detectProfile();

    expect(profile.cpuModel).toBeTruthy();
    expect(profile.totalRamGb).toBeGreaterThan(0);
    expect(typeof profile.hasVulkan).toBe('boolean');
    expect(typeof profile.hasCuda).toBe('boolean');
    expect(profile.recommendedProvider).toBeDefined();
    expect(profile.recommendedGpuLayers).toBeGreaterThanOrEqual(0);
    expect(profile.recommendedContextSize).toBeGreaterThan(0);
  });

  it('2. OllamaAdapter performs health checks and streams responses via NDJSON protocol', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/tags')) {
        return new Response(JSON.stringify({
          models: [{ name: 'qwen2.5:14b-instruct' }, { name: 'llama3:8b' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('/api/chat')) {
        const stream = new ReadableStream({
          start(controller) {
            const chunks = [
              JSON.stringify({ message: { content: 'Arle ' }, done: false }) + '\n',
              JSON.stringify({ message: { content: 'is here.' }, done: true, done_reason: 'stop' }) + '\n',
            ];
            for (const chunk of chunks) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      }

      return new Response('Not found', { status: 404 });
    });

    globalThis.fetch = mockFetch;
    try {
      const adapter = new OllamaAdapter({
        serverUrl: 'http://127.0.0.1:11434',
        defaultModelId: 'qwen2.5:14b-instruct',
      });

      const health = await adapter.checkHealth();
      expect(health.status).toBe('connected');
      expect(health.provider).toBe('ollama');
      expect(health.modelLoaded).toBe('qwen2.5:14b-instruct');

      const receivedChunks: string[] = [];
      const result = await adapter.streamChat({
        conversationId: 'c1',
        requestId: 'r1',
        messages: [{ role: 'user', content: 'Who are you?' }],
        onChunk: (c) => {
          if (c.delta) receivedChunks.push(c.delta);
        },
      });

      expect(result).toBe('Arle is here.');
      expect(receivedChunks).toEqual(['Arle ', 'is here.']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('3. OpenAICompatibleAdapter performs health checks and streams responses via SSE protocol', async () => {
    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/v1/models')) {
        return new Response(JSON.stringify({
          data: [{ id: 'Qwen/Qwen2.5-14B-Instruct' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (url.includes('/v1/chat/completions')) {
        const authHeader = (init?.headers as any)?.['Authorization'];
        if (!authHeader || !authHeader.includes('mock-key')) {
          return new Response('Unauthorized', { status: 401 });
        }

        const stream = new ReadableStream({
          start(controller) {
            const sseLines = [
              'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Cognition ' } }] }) + '\n\n',
              'data: ' + JSON.stringify({ choices: [{ delta: { content: 'online.' }, finish_reason: 'stop' }] }) + '\n\n',
              'data: [DONE]\n\n',
            ];
            for (const line of sseLines) {
              controller.enqueue(new TextEncoder().encode(line));
            }
            controller.close();
          },
        });
        return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }

      return new Response('Not found', { status: 404 });
    });

    globalThis.fetch = mockFetch;
    try {
      const adapter = new OpenAICompatibleAdapter(
        {
          serverUrl: 'http://127.0.0.1:8000',
          defaultModelId: 'Qwen/Qwen2.5-14B-Instruct',
        },
        { apiKey: 'mock-key' },
      );

      const health = await adapter.checkHealth();
      expect(health.status).toBe('connected');
      expect(health.modelLoaded).toBe('Qwen/Qwen2.5-14B-Instruct');

      const receivedChunks: string[] = [];
      const result = await adapter.streamChat({
        conversationId: 'c2',
        requestId: 'r2',
        messages: [{ role: 'user', content: 'Ping' }],
        onChunk: (c) => {
          if (c.delta) receivedChunks.push(c.delta);
        },
      });

      expect(result).toBe('Cognition online.');
      expect(receivedChunks).toEqual(['Cognition ', 'online.']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('4. InferenceProviderRegistry supports hot-swapping providers without state loss', () => {
    const registry = new InferenceProviderRegistry();
    const initial = registry.getActiveProvider();
    expect(initial.providerType).toBe('llama.cpp');

    registry.setActiveProvider('ollama');
    expect(registry.getActiveProvider().providerType).toBe('ollama');

    registry.setActiveProvider('openai_compatible');
    expect(registry.getActiveProvider().providerType).toBe('openai_compatible');

    registry.setActiveProvider('vllm');
    expect(registry.getActiveProvider().providerType).toBe('vllm');
  });

  it('5. InferenceProviderRegistry cascades to healthy fallback provider when primary fails', async () => {
    const failingPrimary: IInferenceProvider = {
      providerType: 'llama.cpp',
      name: 'Failing llama.cpp',
      checkHealth: vi.fn().mockResolvedValue({ status: 'disconnected', provider: 'llama.cpp' }),
      streamChat: vi.fn().mockRejectedValue(new Error('Connection refused')),
      updateConfig: vi.fn(),
      getConfig: vi.fn().mockReturnValue({}),
    };

    const healthyFallback: IInferenceProvider = {
      providerType: 'ollama',
      name: 'Backup Ollama',
      checkHealth: vi.fn().mockResolvedValue({ status: 'connected', provider: 'ollama' }),
      streamChat: vi.fn().mockResolvedValue('Recovered through Ollama fallback.'),
      updateConfig: vi.fn(),
      getConfig: vi.fn().mockReturnValue({}),
    };

    const mockProviders = new Map<any, IInferenceProvider>([
      ['llama.cpp', failingPrimary],
      ['ollama', healthyFallback],
    ]);

    const registry = new InferenceProviderRegistry({}, { providers: mockProviders });
    registry.setFallbackOrder(['llama.cpp', 'ollama']);

    const output = await registry.streamChat({
      conversationId: 'c-fall',
      requestId: 'r-fall',
      messages: [{ role: 'user', content: 'Test cascade' }],
      onChunk: vi.fn(),
    });

    expect(output).toBe('Recovered through Ollama fallback.');
    expect(failingPrimary.streamChat).toHaveBeenCalled();
    expect(healthyFallback.streamChat).toHaveBeenCalled();
  });

  it('6. InferenceProviderRegistry auto-configures according to detected hardware profile', async () => {
    const mockDetector: any = {
      detectProfile: vi.fn().mockResolvedValue({
        deviceType: 'rog_ally_x',
        cpuModel: 'AMD Ryzen Z1 Extreme',
        totalRamGb: 24,
        hasVulkan: true,
        hasCuda: false,
        gpuName: 'AMD Radeon 780M',
        recommendedProvider: 'llama.cpp',
        recommendedGpuLayers: 99,
        recommendedContextSize: 8192,
        activePorts: { llamaCpp: true, ollama: false, vllmOrColibri: false },
      }),
    };

    const mockLlama: IInferenceProvider = {
      providerType: 'llama.cpp',
      name: 'llama.cpp (Vulkan)',
      checkHealth: vi.fn().mockResolvedValue({ status: 'connected', provider: 'llama.cpp' }),
      streamChat: vi.fn().mockResolvedValue('OK'),
      updateConfig: vi.fn(),
      getConfig: vi.fn().mockReturnValue({}),
    };

    const mockProviders = new Map<any, IInferenceProvider>([
      ['llama.cpp', mockLlama],
    ]);

    const registry = new InferenceProviderRegistry({}, {
      providers: mockProviders,
      hardwareDetector: mockDetector,
    });

    const result = await registry.autoConfigure();

    expect(result.hardwareProfile.deviceType).toBe('rog_ally_x');
    expect(result.hardwareProfile.recommendedGpuLayers).toBe(99);
    expect(result.activeProvider.providerType).toBe('llama.cpp');
    expect(registry.getHardwareProfile()?.gpuName).toBe('AMD Radeon 780M');
  });
});
