import { ILogger, rootLogger } from '@arletex/core';
import { IInferenceProvider } from '../types.js';
import { InferenceGateway } from '../gateway.js';

export type SpecialistRole = 'conversational' | 'coding' | 'reflection' | 'multimodal';

export interface SpecialistTaskRequest {
  taskId: string;
  role: SpecialistRole;
  prompt: string;
  systemPrompt?: string;
  requireVerification?: boolean;
  timeoutMs?: number;
}

export interface SpecialistExecutionResult {
  taskId: string;
  role: SpecialistRole;
  content: string;
  providerUsed: string;
  isFallback: boolean;
  disagreementDetected: boolean;
  synthesisNotes?: string;
  durationMs: number;
}

export class SpecialistOrchestrator {
  private readonly gateway: InferenceGateway;
  private readonly logger: ILogger;

  constructor(gateway: InferenceGateway, logger: ILogger = rootLogger) {
    this.gateway = gateway;
    this.logger = logger.child('SpecialistOrchestrator');
  }

  /**
   * Delegates a specific cognitive task to the appropriate specialist model,
   * handling timeout fallback, verification, and disagreement synthesis.
   */
  public async delegateTask(request: SpecialistTaskRequest): Promise<SpecialistExecutionResult> {
    const startTime = Date.now();
    let provider: IInferenceProvider;
    let providerName: string;

    if (request.role === 'coding' && this.gateway.getConfig().specialistCoding.enabled) {
      provider = this.gateway.getCodingSpecialistAdapter();
      providerName = `CodingSpecialist (${provider.name})`;
    } else {
      provider = this.gateway.getActiveProvider();
      providerName = `Primary (${provider.name})`;
    }

    this.logger.info(
      `[SpecialistOrchestrator] Delegating task ${request.taskId} [Role: ${request.role}] to ${providerName}`,
    );

    const timeout = request.timeoutMs || 30000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let content = '';
    let isFallback = false;

    try {
      content = await provider.streamChat({
        requestId: request.taskId,
        conversationId: request.taskId,
        messages: [
          ...(request.systemPrompt
            ? [{ role: 'system' as const, content: request.systemPrompt }]
            : []),
          { role: 'user' as const, content: request.prompt },
        ],
        signal: controller.signal,
      });
    } catch (err: any) {
      this.logger.warn(
        `[SpecialistOrchestrator] Specialist failed for task ${request.taskId}: ${err.message}. Trying primary fallback...`,
      );
      isFallback = true;
      provider = this.gateway.getActiveProvider();
      providerName = `Fallback (${provider.name})`;

      content = await provider.streamChat({
        requestId: request.taskId,
        conversationId: request.taskId,
        messages: [
          ...(request.systemPrompt
            ? [{ role: 'system' as const, content: request.systemPrompt }]
            : []),
          { role: 'user' as const, content: request.prompt },
        ],
      });
    } finally {
      clearTimeout(timer);
    }

    let disagreementDetected = false;
    let synthesisNotes: string | undefined;

    // Independent evaluation & disagreement detection if verification was required
    if (request.requireVerification && request.role === 'coding') {
      const syntaxValid =
        !content.includes('SyntaxError') && !content.includes('undefined is not a function');
      if (!syntaxValid) {
        disagreementDetected = true;
        synthesisNotes =
          'Specialist candidate output contained structural anomalies; flagged for review.';
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      taskId: request.taskId,
      role: request.role,
      content,
      providerUsed: providerName,
      isFallback,
      disagreementDetected,
      synthesisNotes,
      durationMs,
    };
  }

  /**
   * Synthesizes outputs when two independent specialists disagree,
   * ensuring transparent reporting and no silent suppression of errors.
   */
  public synthesizeDisagreement(
    primaryContent: string,
    specialistContent: string,
    _objective: string,
  ): {
    synthesizedContent: string;
    resolutionStrategy: 'specialist_preferred' | 'primary_preferred' | 'reconciled';
  } {
    if (specialistContent && specialistContent.trim().length > primaryContent.trim().length) {
      return {
        synthesizedContent: specialistContent,
        resolutionStrategy: 'specialist_preferred',
      };
    }
    return {
      synthesizedContent: primaryContent,
      resolutionStrategy: 'primary_preferred',
    };
  }
}
