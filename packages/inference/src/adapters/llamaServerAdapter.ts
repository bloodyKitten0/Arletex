import {
  InferenceConfig,
  InferenceConfigSchema,
  InferenceHealthResult,
  InferenceProviderType,
} from '@arletex/contracts';
import { ILogger, InferenceError, ModelUnavailableError, rootLogger } from '@arletex/core';
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

export class LlamaServerAdapter implements IInferenceProvider {
  public readonly providerType: InferenceProviderType = 'llama.cpp';
  public readonly name = 'llama.cpp (Vulkan)';

  private config: InferenceConfig;
  private readonly logger: ILogger;

  constructor(config: Partial<InferenceConfig> = {}, logger: ILogger = rootLogger) {
    this.config = InferenceConfigSchema.parse({
      ...config,
      provider: 'llama.cpp',
    });
    this.logger = logger.child('LlamaServerAdapter');
  }

  public updateConfig(newConfig: Partial<InferenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Updated llama.cpp adapter configuration', this.config);
  }

  public getConfig(): InferenceConfig {
    return { ...this.config };
  }

  public async checkHealth(): Promise<InferenceHealthResult> {
    const startTime = Date.now();
    const url = `${this.config.serverUrl}/health`;

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
          provider: 'llama.cpp',
          url: this.config.serverUrl,
          latencyMs,
          modelLoaded: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
          isFallback: false,
        };
      }

      // Check loaded models from /v1/models
      let modelLoaded: string | null = null;
      try {
        const modelsRes = await fetch(`${this.config.serverUrl}/v1/models`, {
          signal: AbortSignal.timeout(2000),
        });
        if (modelsRes.ok) {
          const data = (await modelsRes.json()) as { data?: Array<{ id: string }> };
          if (data.data && data.data.length > 0 && data.data[0]) {
            modelLoaded = data.data[0].id;
          }
        }
      } catch {
        // Optional
      }

      return {
        status: 'connected',
        provider: 'llama.cpp',
        url: this.config.serverUrl,
        latencyMs,
        modelLoaded,
        error: null,
        isFallback: false,
      };
    } catch (err: any) {
      return {
        status: 'disconnected',
        provider: 'llama.cpp',
        url: this.config.serverUrl,
        latencyMs: null,
        modelLoaded: null,
        error: err.name === 'AbortError' ? 'llama-server health check timed out' : err.message,
        isFallback: false,
      };
    }
  }

  public async getLoraAdapters(): Promise<Array<{ id: number; path?: string; scale: number }>> {
    try {
      const res = await fetch(`${this.config.serverUrl}/lora-adapters`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        return (await res.json()) as Array<{ id: number; path?: string; scale: number }>;
      }
    } catch (err: any) {
      this.logger.debug(`Failed to fetch lora-adapters from llama-server: ${err.message}`);
    }
    return [];
  }

  public async setLoraAdapters(adapters: Array<{ id: number; scale: number }>): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.serverUrl}/lora-adapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adapters),
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch (err: any) {
      this.logger.warn(`Failed to set lora-adapters on llama-server: ${err.message}`);
      return false;
    }
  }

  public async streamChat(options: ChatStreamOptions): Promise<string> {
    const { conversationId, requestId, messages, configOverride, signal, onChunk } = options;
    const safeOnChunk = typeof onChunk === 'function' ? onChunk : () => {};
    const effectiveConfig = { ...this.config, ...configOverride };
    const endpoint = `${effectiveConfig.serverUrl}/v1/chat/completions`;

    this.logger.info(`[Llama] Starting stream inference request ${requestId} to ${endpoint}`);

    const defaultStopSequences = [
      '<|im_end|>',
      '<|endoftext|>',
      '<|im_start|>',
      '濩',
      '㈑',
      '\nUser:',
      '\nProof:',
      'User:',
      'Proof:',
      '\nuser:',
      '\nassistant:',
      'GetResponse(',
      'getResponse(',
      '.GetResponse',
      '._getResponse',
      'getResponse(Proof',
      'getResponse(proof',
      'GetResponse(Proof',
      'GetResponse(Arle',
      'getResponse(Arle',
      'Arle:',
      '\nArle:',
      'You:',
      '\nYou:',
      ':\n- Current Persistent Mood',
      'Current Persistent Mood:',
      'Action completed successfully!',
      'Ambient audio stream captured',
      'Visual frame or environmental state verified',
      '[Active Psychology Engine',
      '[Digital Agency Reality Grounding]',
      '\n```json',
      'Track is playing now',
      'System audio volume:',
      'Ambient desktop audio stream captured',
      'Your response must be in this format',
      'A new message arrived',
      '\n: ',
      '\n:\n',
      '\n- [',
      ': The Spotify Web Player',
      'The Spotify Web Player is active',
      '- Conversation Partner:',
      'Conversation Partner:',
      'Identity & Email:',
      '- Identity & Email:',
      '[Direct Dialogue Context',
      'Do not output',
      'Do not output any of these:',
      'NEVER output',
      'Do not write',
      '\nDo not output',
      '\nNEVER output',
      'Chrome Profile',
      'within Chrome Profile',
    ];
    const stopList = Array.from(
      new Set([
        ...defaultStopSequences,
        ...(effectiveConfig.stopSequences && effectiveConfig.stopSequences.length > 0
          ? effectiveConfig.stopSequences
          : []),
      ]),
    );

    const payload = {
      model: effectiveConfig.defaultModelId,
      messages,
      temperature: effectiveConfig.temperature ?? 0.7,
      top_p: effectiveConfig.topP ?? 0.9,
      min_p: 0.05,
      max_tokens: effectiveConfig.maxTokens ?? 2048,
      repeat_penalty: (effectiveConfig as any).repeatPenalty ?? 1.05,
      frequency_penalty: (effectiveConfig as any).frequencyPenalty ?? 0.0,
      presence_penalty: (effectiveConfig as any).presencePenalty ?? 0.0,
      repeat_last_n: 64,
      stream: true,
      stop: stopList,
      chat_template_kwargs: { enable_thinking: false },
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        this.logger.info(`[Llama] Inference request ${requestId} was cancelled by user.`);
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
      this.logger.error(`[Llama] Network error connecting to llama-server at ${endpoint}`, err);
      throw new ModelUnavailableError(effectiveConfig.serverUrl, err);
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown error');
      const isContextExceeded =
        errBody.includes('exceed_context_size_error') ||
        errBody.toLowerCase().includes('context size has been exceeded') ||
        errBody.toLowerCase().includes('failed to find free space in the kv cache');
      if ((response.status === 400 || response.status === 500) && isContextExceeded) {
        this.logger.warn(
          `[Llama] Request exceeded context size. Attempting automatic context pruning and retry.`,
        );
        const prunedMessages = this.pruneMessagesForContext(messages);
        if (prunedMessages && prunedMessages.length > 0) {
          return this.streamChat({
            ...options,
            messages: prunedMessages,
          });
        }
      }
      this.logger.error(`[Llama] llama-server responded with HTTP ${response.status}`, errBody);
      const errMsg = `llama-server error (${response.status}): ${errBody}`;
      safeOnChunk({
        requestId,
        conversationId,
        delta: '',
        fullContent: '',
        isDone: true,
        finishReason: 'error',
        error: errMsg,
      });
      throw new InferenceError(errMsg);
    }

    if (!response.body) {
      throw new InferenceError('Response body is null from llama-server');
    }

    let fullContent = '';
    let fullReasoning = '';
    let inThinkTag = false;
    let isDoneEmitted = false;
    let lastFinishReason: string | null = null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const emitDone = (finishReason = 'stop') => {
      if (!isDoneEmitted) {
        isDoneEmitted = true;
        const text = fullContent || fullReasoning;
        safeOnChunk({
          requestId,
          conversationId,
          delta: '',
          fullContent: text,
          fullReasoning,
          isDone: true,
          finishReason: lastFinishReason || finishReason,
          error: null,
        });
      }
    };

    const parser = createParser({
      onEvent: (event: EventSourceMessage) => {
        if (event.data === '[DONE]') {
          emitDone();
          return;
        }

        try {
          const parsed = JSON.parse(event.data);
          let delta = parsed.choices?.[0]?.delta?.content || '';
          let reasoningDelta = parsed.choices?.[0]?.delta?.reasoning_content || '';
          const finishReason = parsed.choices?.[0]?.finish_reason || null;
          if (finishReason) {
            lastFinishReason = finishReason;
          }

          // Route inline <think>...</think> tokens into reasoning if emitted in content delta
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
            const scriptMatch = fullContent.match(
              /(\.?[_gG]etResponse\s*\(|\n?Proof:|\n?User:|\n?You:|<\/?user|<\/?assistant|<\|im_start\||<\|im_end\||[㈑濩]|\n\s*(user|assistant)\s*[\n:]|:\s*\n-\s*Current Persistent Mood|Action completed successfully!|Ambient audio stream captured|Visual frame or environmental state verified|\n```json|Track is playing now|System audio volume:|Your response must be in this format|A new message arrived|\n-\s*\[(?:Active Psychology|Digital Agency|Direct Dialogue|Homeostasis|Unified Taxonomy)|The Spotify Web Player|Conversation Partner:|Identity & Email:|\[Direct Dialogue Context|Do not output|NEVER output|Do not write|Chrome Profile)/i,
            );
            if (scriptMatch && scriptMatch.index !== undefined) {
              this.logger.warn(
                `[Llama] Scriptwriter/speaker leak detected at index ${scriptMatch.index}. Truncating turn.`,
              );
              fullContent = fullContent.slice(0, scriptMatch.index).trim();
              void reader.cancel().catch(() => {});
              emitDone('stop');
              return;
            }

            const hesitationMatch = fullContent.match(
              /(?:(?:\n|^)\s*|\s*[.?!]\s*|\s*—\s*|\s*,\s*|\.\.\.\s*)(?:Wait,?\s+(?:I'll|let's|let\s+me|I\s+need|I\s+should)|No\s+wait,?\s+(?:we|I|let)|Wait\s+I'll\s+just|\?\s*No\.?\s*Actually|Actually\s+I'll\s+stop\s+second-guessing|\?\s*No\.?\s*Let's\s+just|\?\s*No\s+I'll\s+just|No\s+keep\s+simple|No\.?\s*Let's\s+write\s+final|\?\s*No\s+I'll\s+give|\?\s*No\.?\s*Let's\s+stick|\?\s*No\.?\s*Okay\s+here\s+is)\b/i,
            );
            if (hesitationMatch && hesitationMatch.index !== undefined && hesitationMatch.index > 50) {
              this.logger.warn(
                `[Llama] Second-guessing / backtracking spiral detected at index ${hesitationMatch.index}. Truncating turn with composure.`,
              );
              fullContent = fullContent.slice(0, hesitationMatch.index).trim();
              const mathDollars = (fullContent.match(/\$\$/g) || []).length;
              if (mathDollars % 2 !== 0) {
                fullContent += '\n$$';
              }
              void reader.cancel().catch(() => {});
              emitDone('stop');
              return;
            }

            const loopCheck = findRepetitionLoop(fullContent);
            if (loopCheck.isLoop) {
              this.logger.warn(
                `[Llama] Repetition loop detected at ${fullContent.length} chars. Truncating loop and terminating inference stream.`,
              );
              fullContent = loopCheck.cleanText;
              const mathDollars = (fullContent.match(/\$\$/g) || []).length;
              if (mathDollars % 2 !== 0) {
                fullContent += '\n$$';
              }
              void reader.cancel().catch(() => {});
              emitDone('stop');
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
              isDone: false,
              finishReason: null,
              error: null,
            });
          }
        } catch (parseErr) {
          this.logger.warn('[Llama] Failed to parse SSE JSON chunk', {
            data: event.data,
            error: parseErr,
          });
        }
      },
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
      // Ensure completion chunk is emitted even if server closed without [DONE]
      emitDone();
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) {
        this.logger.info(`[Llama] Stream reading aborted for request ${requestId}`);
        void reader.cancel().catch(() => {});
        if (!isDoneEmitted) {
          isDoneEmitted = true;
          safeOnChunk({
            requestId,
            conversationId,
            delta: '',
            fullContent: fullContent || fullReasoning,
            fullReasoning,
            isDone: true,
            finishReason: 'cancelled',
            error: null,
          });
        }
        return fullContent || fullReasoning;
      }
      this.logger.error('[Llama] Error while reading stream chunks', err);
      if (!isDoneEmitted) {
        isDoneEmitted = true;
        safeOnChunk({
          requestId,
          conversationId,
          delta: '',
          fullContent: fullContent || fullReasoning,
          fullReasoning,
          isDone: true,
          finishReason: 'error',
          error: err.message,
        });
      }
      throw err;
    }

    return fullContent || fullReasoning;
  }

  private pruneMessagesForContext(messages: any[]): any[] | null {
    if (!messages || messages.length === 0) return null;

    const systemMsg = messages.find((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');
    if (nonSystem.length === 0) return messages;

    // Prune excessive images from older messages, preserving at most 1 representative frame in recent history
    let imagePreserved = false;
    const sanitizedNonSystem = nonSystem.map((msg, idx) => {
      const isLatest = idx >= nonSystem.length - 2;
      if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter((p: any) => p.type === 'text');
        const imageParts = msg.content.filter((p: any) => p.type === 'image_url');
        if (isLatest && !imagePreserved && imageParts.length > 0) {
          imagePreserved = true;
          return { ...msg, content: [...textParts, imageParts[0]] };
        }
        return { ...msg, content: textParts };
      }
      return msg;
    });

    // Priority-based compaction: preserve recent dialogue turns rather than dropping intervening history
    const maxRecentTurns = 10;
    const recentHistory = sanitizedNonSystem.slice(-maxRecentTurns);

    let prunedSystemContent = systemMsg?.content;
    if (typeof prunedSystemContent === 'string' && prunedSystemContent.length > 6000) {
      prunedSystemContent =
        prunedSystemContent.slice(0, 6000) +
        '\n[Context trimmed for token budget while preserving core identity]';
    }

    const compacted: any[] = [];
    if (prunedSystemContent) {
      compacted.push({ role: 'system', content: prunedSystemContent });
    }
    compacted.push(...recentHistory);

    return compacted;
  }
}
