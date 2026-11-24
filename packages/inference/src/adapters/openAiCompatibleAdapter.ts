import {
  InferenceConfig,
  InferenceConfigSchema,
  InferenceHealthResult,
  InferenceProviderType,
} from '@arletex/contracts';
import { ILogger, ModelUnavailableError, rootLogger } from '@arletex/core';
import { createParser, EventSourceMessage } from 'eventsource-parser';
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

export class OpenAICompatibleAdapter implements IInferenceProvider {
  public readonly providerType: InferenceProviderType;
  public readonly name: string;

  private config: InferenceConfig;
  private readonly logger: ILogger;
  private apiKey?: string;

  constructor(
    config: Partial<InferenceConfig> = {},
    options: {
      providerType?: InferenceProviderType;
      name?: string;
      apiKey?: string;
      logger?: ILogger;
    } = {},
  ) {
    this.providerType = options.providerType || 'openai_compatible';
    this.name =
      options.name || (this.providerType === 'vllm' ? 'vLLM Engine' : 'OpenAI-Compatible Engine');
    this.apiKey = options.apiKey || process.env['OPENAI_API_KEY'];

    this.config = InferenceConfigSchema.parse({
      ...config,
      provider: this.providerType,
      serverUrl: config.serverUrl || 'http://127.0.0.1:8000',
      defaultModelId: config.defaultModelId || 'meta-llama/Meta-Llama-3-8B-Instruct',
    });
    this.logger = (options.logger || rootLogger).child('OpenAICompatibleAdapter');
  }

  public setApiKey(key: string): void {
    this.apiKey = key;
  }

  public updateConfig(newConfig: Partial<InferenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info(`Updated ${this.name} adapter configuration`, this.config);
  }

  public getConfig(): InferenceConfig {
    return { ...this.config };
  }

  public async checkHealth(): Promise<InferenceHealthResult> {
    const startTime = Date.now();
    const url = `${this.config.serverUrl}/v1/models`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          status: 'error',
          provider: this.providerType,
          url: this.config.serverUrl,
          latencyMs,
          modelLoaded: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
          isFallback: false,
        };
      }

      const data = (await response.json()) as { data?: Array<{ id: string }> };
      let modelLoaded: string | null = null;
      if (data.data && data.data.length > 0 && data.data[0]) {
        modelLoaded = data.data[0].id;
      }

      return {
        status: 'connected',
        provider: this.providerType,
        url: this.config.serverUrl,
        latencyMs,
        modelLoaded: modelLoaded || this.config.defaultModelId,
        error: null,
        isFallback: false,
      };
    } catch (err: any) {
      return {
        status: 'disconnected',
        provider: this.providerType,
        url: this.config.serverUrl,
        latencyMs: null,
        modelLoaded: null,
        error: err.message || `Cannot connect to ${this.name} endpoint`,
        isFallback: false,
      };
    }
  }

  public async streamChat(options: ChatStreamOptions): Promise<string> {
    const { conversationId, requestId, messages, configOverride, signal, onChunk } = options;
    const safeOnChunk = typeof onChunk === 'function' ? onChunk : () => {};
    const effectiveConfig = { ...this.config, ...configOverride };
    const endpoint = `${effectiveConfig.serverUrl}/v1/chat/completions`;

    const payload = {
      model: effectiveConfig.defaultModelId,
      messages,
      temperature: effectiveConfig.temperature ?? 0.7,
      top_p: effectiveConfig.topP ?? 0.9,
      max_tokens: effectiveConfig.maxTokens ?? 2048,
      stream: true,
      stop:
        effectiveConfig.stopSequences && effectiveConfig.stopSequences.length > 0
          ? effectiveConfig.stopSequences
          : undefined,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        this.logger.info(`[${this.name}] Request ${requestId} was cancelled.`);
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
      this.logger.error(`[${this.name}] Network error connecting to ${endpoint}`, err);
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

    let fullContent = '';
    let fullReasoning = '';
    let inThinkTag = false;
    const decoder = new TextDecoder();
    let streamDone = false;

    return new Promise<string>((resolve, reject) => {
      const parser = createParser({
        onEvent: (event: EventSourceMessage) => {
          if (event.data === '[DONE]') {
            streamDone = true;
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
            resolve(fullContent || fullReasoning);
            return;
          }

          try {
            const parsed = JSON.parse(event.data);
            let delta = parsed.choices?.[0]?.delta?.content || '';
            let reasoningDelta = parsed.choices?.[0]?.delta?.reasoning_content || '';
            const finishReason = parsed.choices?.[0]?.finish_reason || null;

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
              if (hesitationMatch && hesitationMatch.index !== undefined && hesitationMatch.index > 50) {
                this.logger.warn(
                  `[OpenAI] Second-guessing / backtracking spiral detected at index ${hesitationMatch.index}. Truncating turn with composure.`,
                );
                fullContent = fullContent.slice(0, hesitationMatch.index).trim();
                const mathDollars = (fullContent.match(/\$\$/g) || []).length;
                if (mathDollars % 2 !== 0) {
                  fullContent += '\n$$';
                }
                streamDone = true;
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
                resolve(fullContent || fullReasoning);
                return;
              }

              const loop = findRepetitionLoop(fullContent);
              if (loop.isLoop) {
                fullContent = loop.cleanText;
                const mathDollars = (fullContent.match(/\$\$/g) || []).length;
                if (mathDollars % 2 !== 0) {
                  fullContent += '\n$$';
                }
                streamDone = true;
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
                resolve(fullContent || fullReasoning);
                return;
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
                isDone: Boolean(finishReason),
                finishReason,
                error: null,
              });
            }

            if (finishReason && !streamDone) {
              streamDone = true;
              safeOnChunk({
                requestId,
                conversationId,
                delta: '',
                fullContent,
                isDone: true,
                finishReason,
                error: null,
              });
              resolve(fullContent);
            }
          } catch {
            // Ignore malformed chunk lines
          }
        },
      });

      const reader = response.body!.getReader();
      const read = async () => {
        try {
          while (true) {
            if (signal?.aborted) {
              await reader.cancel().catch(() => {});
              safeOnChunk({
                requestId,
                conversationId,
                delta: '',
                fullContent,
                isDone: true,
                finishReason: 'cancelled',
                error: null,
              });
              resolve(fullContent);
              return;
            }

            const { done, value } = await reader.read();
            if (done) {
              if (!streamDone) {
                safeOnChunk({
                  requestId,
                  conversationId,
                  delta: '',
                  fullContent,
                  isDone: true,
                  finishReason: 'stop',
                  error: null,
                });
              }
              resolve(fullContent);
              return;
            }

            parser.feed(decoder.decode(value, { stream: true }));
          }
        } catch (err: any) {
          if (err.name === 'AbortError' || signal?.aborted) {
            resolve(fullContent);
            return;
          }
          reject(err);
        }
      };

      read();
    });
  }
}
