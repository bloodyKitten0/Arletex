import {
  InferenceConfig,
  InferenceConfigSchema,
  InferenceHealthResult,
  InferenceProviderType,
} from '@arletex/contracts';
import { ILogger, ModelUnavailableError, rootLogger } from '@arletex/core';
import { ChatStreamOptions, IInferenceProvider } from '../types.js';

function findRepetitionLoop(text: string): { isLoop: boolean; cleanText: string } {
  if (text.length < 80) return { isLoop: false, cleanText: text };

  for (let len = 30; len <= 120; len += 10) {
    if (text.length < len * 2) continue;
    const tail = text.slice(-len);
    const beforeTail = text.slice(0, -len);
    const matchIndex = beforeTail.lastIndexOf(tail);
    if (matchIndex !== -1) {
      const repeatStart = text.length - len;
      if (repeatStart > matchIndex) {
        const clean = text.slice(0, repeatStart).trim();
        return { isLoop: true, cleanText: clean };
      }
    }
  }
  return { isLoop: false, cleanText: text };
}

export class OllamaAdapter implements IInferenceProvider {
  public readonly providerType: InferenceProviderType = 'ollama';
  public readonly name = 'Ollama Engine';

  private config: InferenceConfig;
  private readonly logger: ILogger;

  constructor(config: Partial<InferenceConfig> = {}, logger: ILogger = rootLogger) {
    this.config = InferenceConfigSchema.parse({
      ...config,
      provider: 'ollama',
      serverUrl: config.serverUrl || 'http://127.0.0.1:11434',
      defaultModelId: config.defaultModelId || 'llama3:latest',
    });
    this.logger = logger.child('OllamaAdapter');
  }

  public updateConfig(newConfig: Partial<InferenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Updated Ollama adapter configuration', this.config);
  }

  public getConfig(): InferenceConfig {
    return { ...this.config };
  }

  public async checkHealth(): Promise<InferenceHealthResult> {
    const startTime = Date.now();
    const url = `${this.config.serverUrl}/api/tags`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'error',
          provider: 'ollama',
          url: this.config.serverUrl,
          latencyMs,
          modelLoaded: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
          isFallback: false,
        };
      }

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const modelLoaded = data.models && data.models.length > 0 ? data.models[0]?.name || null : null;

      return {
        status: 'connected',
        provider: 'ollama',
        url: this.config.serverUrl,
        latencyMs,
        modelLoaded: modelLoaded || this.config.defaultModelId,
        error: null,
        isFallback: false,
      };
    } catch (err: any) {
      return {
        status: 'disconnected',
        provider: 'ollama',
        url: this.config.serverUrl,
        latencyMs: null,
        modelLoaded: null,
        error: err.message || 'Cannot reach Ollama daemon',
        isFallback: false,
      };
    }
  }

  public async streamChat(options: ChatStreamOptions): Promise<string> {
    const { conversationId, requestId, messages, configOverride, signal, onChunk } = options;
    const effectiveConfig = { ...this.config, ...configOverride };
    const endpoint = `${effectiveConfig.serverUrl}/api/chat`;

    const formattedMessages = messages.map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content };
      }
      const textParts = m.content
        .filter((c) => c.type === 'text')
        .map((c: any) => c.text)
        .join('\n');
      const images = m.content
        .filter((c) => c.type === 'image_url')
        .map((c: any) => {
          const u = c.image_url.url;
          if (u.startsWith('data:') && u.includes('base64,')) {
            return u.split('base64,')[1];
          }
          return u;
        });
      return {
        role: m.role,
        content: textParts,
        ...(images.length > 0 ? { images } : {}),
      };
    });

    const payload = {
      model: effectiveConfig.defaultModelId,
      messages: formattedMessages,
      stream: true,
      options: {
        temperature: effectiveConfig.temperature ?? 0.7,
        top_p: effectiveConfig.topP ?? 0.9,
        num_predict: effectiveConfig.maxTokens ?? 2048,
        repeat_penalty: effectiveConfig.repeatPenalty ?? 1.18,
        stop: effectiveConfig.stopSequences,
      },
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        this.logger.info(`[Ollama] Inference request ${requestId} cancelled by caller.`);
        onChunk({
          requestId,
          conversationId,
          delta: '',
          fullContent: '',
          isDone: true,
          finishReason: 'cancelled',
          error: null,
        });
        return '';
      }
      this.logger.error(`[Ollama] Network error connecting to ${endpoint}`, err);
      throw new ModelUnavailableError(effectiveConfig.serverUrl, err);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown error');
      throw new ModelUnavailableError(
        effectiveConfig.serverUrl,
        new Error(`HTTP ${response.status}: ${errBody}`),
      );
    }

    if (!response.body) {
      throw new ModelUnavailableError(effectiveConfig.serverUrl, new Error('Response body is empty'));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) {
          reader.cancel().catch(() => {});
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as {
              message?: { content?: string };
              done?: boolean;
              done_reason?: string;
            };

            const delta = parsed.message?.content || '';
            if (delta) {
              fullContent += delta;
              const loopCheck = findRepetitionLoop(fullContent);
              if (loopCheck.isLoop) {
                fullContent = loopCheck.cleanText;
                onChunk({
                  requestId,
                  conversationId,
                  delta: '',
                  fullContent,
                  isDone: true,
                  finishReason: 'stop',
                  error: null,
                });
                reader.cancel().catch(() => {});
                return fullContent;
              }

              onChunk({
                requestId,
                conversationId,
                delta,
                fullContent,
                isDone: false,
                finishReason: null,
                error: null,
              });
            }

            if (parsed.done) {
              onChunk({
                requestId,
                conversationId,
                delta: '',
                fullContent,
                isDone: true,
                finishReason: (parsed.done_reason as any) || 'stop',
                error: null,
              });
              return fullContent;
            }
          } catch {
            // Ignore malformed intermediate JSON lines
          }
        }
      }

      onChunk({
        requestId,
        conversationId,
        delta: '',
        fullContent,
        isDone: true,
        finishReason: 'stop',
        error: null,
      });

      return fullContent;
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        onChunk({
          requestId,
          conversationId,
          delta: '',
          fullContent,
          isDone: true,
          finishReason: 'cancelled',
          error: null,
        });
        return fullContent;
      }
      throw err;
    }
  }
}
