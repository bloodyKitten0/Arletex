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

  // 1. Shorter phrases (20-79 chars): require at least 3 consecutive identical repetitions
  for (let len = 20; len < 80; len++) {
    if (text.length < len * 3) continue;
    const chunk1 = text.slice(-len);
    const chunk2 = text.slice(-2 * len, -len);
    const chunk3 = text.slice(-3 * len, -2 * len);
    if (chunk1 === chunk2 && chunk2 === chunk3) {
      const clean = text.slice(0, -2 * len).trim();
      return { isLoop: true, cleanText: clean };
    }
  }

  // 2. Longer blocks (80-200 chars): 2 consecutive identical repetitions
  for (let len = 80; len <= 200; len += 5) {
    if (text.length < len * 2) continue;
    const chunk1 = text.slice(-len);
    const chunk2 = text.slice(-2 * len, -len);
    if (chunk1 === chunk2) {
      const clean = text.slice(0, -len).trim();
      return { isLoop: true, cleanText: clean };
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
      const modelLoaded =
        data.models && data.models.length > 0 ? data.models[0]?.name || null : null;

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
    const safeOnChunk = typeof onChunk === 'function' ? onChunk : () => {};
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
        safeOnChunk({
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
      throw new ModelUnavailableError(
        effectiveConfig.serverUrl,
        new Error('Response body is empty'),
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let fullReasoning = '';
    let inThinkTag = false;
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
              message?: { content?: string; thinking?: string };
              done?: boolean;
              done_reason?: string;
            };

            let delta = parsed.message?.content || '';
            let reasoningDelta = parsed.message?.thinking || '';

            if (delta) {
              let dialoguePiece = '';
              let thinkPiece = '';
              let cursor = 0;

              while (cursor < delta.length) {
                if (!inThinkTag) {
                  const openIdx = delta.indexOf('<think>', cursor);
                  if (openIdx !== -1) {
                    dialoguePiece += delta.slice(cursor, openIdx);
                    cursor = openIdx + '<think>'.length;
                    inThinkTag = true;
                  } else {
                    dialoguePiece += delta.slice(cursor);
                    cursor = delta.length;
                  }
                } else {
                  const closeIdx = delta.indexOf('</think>', cursor);
                  if (closeIdx !== -1) {
                    thinkPiece += delta.slice(cursor, closeIdx);
                    cursor = closeIdx + '</think>'.length;
                    inThinkTag = false;
                  } else {
                    thinkPiece += delta.slice(cursor);
                    cursor = delta.length;
                  }
                }
              }

              delta = dialoguePiece;
              if (thinkPiece) {
                reasoningDelta += thinkPiece;
              }
            }

            if (reasoningDelta) {
              fullReasoning += reasoningDelta;
            }

            if (delta) {
              fullContent += delta;

              const hesitationMatch = fullContent.match(
                /(?:(?:\n|^)\s*|\s*[.?!]\s*|\s*—\s*|\s*,\s*|\.\.\.\s*)(?:Wait,?\s+(?:I'll|let's|let\s+me|I\s+need|I\s+should)|No\s+wait,?\s+(?:we|I|let)|Wait\s+I'll\s+just|\?\s*No\.?\s*Actually|Actually\s+I'll\s+stop\s+second-guessing|\?\s*No\.?\s*Let's\s+just|\?\s*No\s+I'll\s+just|No\s+keep\s+simple|No\.?\s*Let's\s+write\s+final|\?\s*No\s+I'll\s+give|\?\s*No\.?\s*Let's\s+stick|\?\s*No\.?\s*Okay\s+here\s+is)\b/i,
              );
              if (
                hesitationMatch &&
                hesitationMatch.index !== undefined &&
                hesitationMatch.index > 50
              ) {
                this.logger.warn(
                  `[Ollama] Second-guessing / backtracking spiral detected at index ${hesitationMatch.index}. Truncating turn with composure.`,
                );
                fullContent = fullContent.slice(0, hesitationMatch.index).trim();
                const mathDollars = (fullContent.match(/\$\$/g) || []).length;
                if (mathDollars % 2 !== 0) {
                  fullContent += '\n$$';
                }
                safeOnChunk({
                  requestId,
                  conversationId,
                  delta: '',
                  fullContent: fullContent || fullReasoning,
                  fullReasoning,
                  isDone: true,
                  finishReason: 'stop',
                  error: null,
                });
                reader.cancel().catch(() => {});
                return fullContent;
              }

              const loopCheck = findRepetitionLoop(fullContent);
              if (loopCheck.isLoop) {
                fullContent = loopCheck.cleanText;
                const mathDollars = (fullContent.match(/\$\$/g) || []).length;
                if (mathDollars % 2 !== 0) {
                  fullContent += '\n$$';
                }
                safeOnChunk({
                  requestId,
                  conversationId,
                  delta: '',
                  fullContent: fullContent || fullReasoning,
                  fullReasoning,
                  isDone: true,
                  finishReason: 'stop',
                  error: null,
                });
                reader.cancel().catch(() => {});
                return fullContent;
              }
            }

            if (delta || reasoningDelta) {
              safeOnChunk({
                requestId,
                conversationId,
                delta,
                reasoningDelta,
                fullContent: fullContent || fullReasoning,
                fullReasoning,
                isDone: false,
                finishReason: null,
                error: null,
              });
            }

            if (parsed.done) {
              safeOnChunk({
                requestId,
                conversationId,
                delta: '',
                fullContent: fullContent || fullReasoning,
                fullReasoning,
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

      safeOnChunk({
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
        safeOnChunk({
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
