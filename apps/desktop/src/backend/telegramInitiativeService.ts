import * as crypto from 'node:crypto';
import { rootLogger, ILogger } from '@arletex/core';
import {
  ProactiveNotificationProposal,
  ProactiveUrgency,
  ProactiveProposalOrigin,
  ProactiveProposalStatus,
  ProactiveProposalDeliveryResult,
  ProactiveDeliveryPolicy,
} from '@arletex/contracts';
import { TelegramBridgeService, TelegramSendResult } from './telegramBridgeService.js';

export interface TelegramInitiativeConfig {
  quietHoursStart?: number; // 23 (11 PM)
  quietHoursEnd?: number;   // 8 (8 AM)
  rateLimitMaxPerHour?: number; // 5
  cooldownMinutes?: number; // 10
  duplicateSuppressionWindowMinutes?: number; // 60
  allowOutboundInitiative?: boolean; // true
}

export interface CreateProactiveProposalInput {
  topic: string;
  message: string;
  reasoning: string;
  urgency?: ProactiveUrgency;
  evidence?: string[];
  origin?: ProactiveProposalOrigin;
  recipientChatId?: string | number;
  deliveryPolicy?: Partial<ProactiveDeliveryPolicy>;
  shouldDeliverImmediately?: boolean;
}

export interface ProposalPolicyEvaluation {
  allowed: boolean;
  reason?: string;
  action: 'deliver' | 'hold' | 'delay' | 'reject' | 'cancel' | 'suppress';
}

export interface DeliveredRecord {
  proposalId: string;
  chatId: string;
  messageHash: string;
  deliveredAt: number;
}

export class TelegramInitiativeService {
  private bridge: TelegramBridgeService;
  private config: Required<TelegramInitiativeConfig>;
  private proposals: Map<string, ProactiveNotificationProposal> = new Map();
  private deliveryHistory: DeliveredRecord[] = [];
  private isEmergencyShutdownActive = false;
  private logger: ILogger;

  constructor(
    bridge: TelegramBridgeService,
    config: TelegramInitiativeConfig = {},
    logger: ILogger = rootLogger,
  ) {
    this.bridge = bridge;
    this.config = {
      quietHoursStart: config.quietHoursStart ?? 23,
      quietHoursEnd: config.quietHoursEnd ?? 8,
      rateLimitMaxPerHour: config.rateLimitMaxPerHour ?? 5,
      cooldownMinutes: config.cooldownMinutes ?? 10,
      duplicateSuppressionWindowMinutes: config.duplicateSuppressionWindowMinutes ?? 60,
      allowOutboundInitiative: config.allowOutboundInitiative ?? true,
    };
    this.logger = logger.child('TelegramInitiativeService');
  }

  /**
   * Generates a new proactive message proposal.
   * Crucial invariant: The proposal is created in 'generated' state with delivered = false.
   * It is NEVER marked delivered at creation time.
   */
  public createProposal(input: CreateProactiveProposalInput): ProactiveNotificationProposal {
    const id = crypto.randomUUID();
    const recipient = String(
      input.recipientChatId || this.bridge.getStatus().targetChatId || '',
    ).trim();

    const policy: ProactiveDeliveryPolicy = {
      quietHoursStart: input.deliveryPolicy?.quietHoursStart ?? this.config.quietHoursStart,
      quietHoursEnd: input.deliveryPolicy?.quietHoursEnd ?? this.config.quietHoursEnd,
      allowQuietHoursOverride: input.deliveryPolicy?.allowQuietHoursOverride ?? false,
      rateLimitMaxPerHour: input.deliveryPolicy?.rateLimitMaxPerHour ?? this.config.rateLimitMaxPerHour,
      cooldownMinutes: input.deliveryPolicy?.cooldownMinutes ?? this.config.cooldownMinutes,
      batchingDelayMinutes: input.deliveryPolicy?.batchingDelayMinutes ?? 0,
      duplicateSuppressionWindowMinutes:
        input.deliveryPolicy?.duplicateSuppressionWindowMinutes ??
        this.config.duplicateSuppressionWindowMinutes,
    };

    const proposal: ProactiveNotificationProposal = {
      id,
      topic: input.topic.trim(),
      message: input.message.trim(),
      reasoning: input.reasoning.trim(),
      evidence: input.evidence || [],
      origin: input.origin || 'direct_initiative',
      urgency: input.urgency || 'medium',
      recipientChatId: recipient,
      deliveryPolicy: policy,
      cooldownStatus: 'ready',
      status: 'generated',
      delivered: false,
      shouldDeliverImmediately: input.shouldDeliverImmediately ?? false,
      createdAt: new Date().toISOString(),
    };

    this.proposals.set(id, proposal);
    this.logger.info(
      `Created proactive initiative proposal ${id} (origin: ${proposal.origin}, urgency: ${proposal.urgency}, recipient: ${proposal.recipientChatId})`,
    );
    return proposal;
  }

  /**
   * Evaluates delivery policy against the proposal, emergency shutdown, quiet hours,
   * rate limits, cooldown, allowlists, and duplicate suppression.
   */
  public evaluatePolicy(
    proposalId: string,
    currentTime: Date = new Date(),
  ): ProposalPolicyEvaluation {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return { allowed: false, reason: `Proposal not found: ${proposalId}`, action: 'reject' };
    }

    // 1. Emergency shutdown check
    if (this.isEmergencyShutdownActive) {
      return {
        allowed: false,
        reason: 'Emergency shutdown active; all outbound proactive messages cancelled',
        action: 'cancel',
      };
    }

    // 2. Telegram bridge configuration check
    if (!this.bridge.getStatus().isConfigured) {
      return {
        allowed: false,
        reason: 'Telegram bot not configured; holding proposal until configured',
        action: 'hold',
      };
    }

    // 3. Recipient allowlist check (Fail-Closed)
    if (!proposal.recipientChatId || !this.bridge.isChatAuthorized(proposal.recipientChatId)) {
      return {
        allowed: false,
        reason: `Recipient chat ID "${proposal.recipientChatId}" is not in the configured allowlist`,
        action: 'reject',
      };
    }

    // 4. Outbound proactive messaging permission check
    if (!this.config.allowOutboundInitiative) {
      return {
        allowed: false,
        reason: 'Outbound proactive messaging disabled by policy',
        action: 'hold',
      };
    }

    const currentMs = currentTime.getTime();
    const chatHistory = this.deliveryHistory.filter((r) => r.chatId === proposal.recipientChatId);

    // 5. Duplicate suppression check
    const normalizedText = proposal.message.trim().toLowerCase();
    const messageHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
    const suppressionWindowMs =
      (proposal.deliveryPolicy?.duplicateSuppressionWindowMinutes ??
        this.config.duplicateSuppressionWindowMinutes) *
      60 *
      1000;

    const recentDuplicate = chatHistory.find(
      (r) => r.messageHash === messageHash && currentMs - r.deliveredAt < suppressionWindowMs,
    );
    if (recentDuplicate) {
      return {
        allowed: false,
        reason: `Duplicate message suppressed (identical content delivered within suppression window)`,
        action: 'suppress',
      };
    }

    // 6. Hourly rate limit check
    const oneHourAgo = currentMs - 60 * 60 * 1000;
    const deliveredInPastHour = chatHistory.filter((r) => r.deliveredAt >= oneHourAgo).length;
    const maxPerHour =
      proposal.deliveryPolicy?.rateLimitMaxPerHour ?? this.config.rateLimitMaxPerHour;

    if (deliveredInPastHour >= maxPerHour) {
      return {
        allowed: false,
        reason: `Hourly proactive message rate limit exceeded (maximum ${maxPerHour}/hour)`,
        action: 'delay',
      };
    }

    // 7. Cooldown check (minimum interval between spontaneous messages)
    const isUrgent =
      proposal.urgency === 'high' ||
      proposal.urgency === 'emergency' ||
      proposal.deliveryPolicy?.allowQuietHoursOverride;

    const cooldownMs =
      (proposal.deliveryPolicy?.cooldownMinutes ?? this.config.cooldownMinutes) * 60 * 1000;
    const lastDelivery = chatHistory[chatHistory.length - 1];

    if (lastDelivery && currentMs - lastDelivery.deliveredAt < cooldownMs) {
      if (!isUrgent) {
        proposal.cooldownStatus = 'active';
        return {
          allowed: false,
          reason: `Proactive cooldown in effect (minimum ${this.config.cooldownMinutes}m between spontaneous messages)`,
          action: 'delay',
        };
      } else {
        proposal.cooldownStatus = 'bypassed';
      }
    } else {
      proposal.cooldownStatus = 'ready';
    }

    // 8. Quiet hours check
    const quietStart = proposal.deliveryPolicy?.quietHoursStart ?? this.config.quietHoursStart;
    const quietEnd = proposal.deliveryPolicy?.quietHoursEnd ?? this.config.quietHoursEnd;
    const currentHour = currentTime.getHours();

    const isQuietTime =
      quietStart > quietEnd
        ? currentHour >= quietStart || currentHour < quietEnd
        : currentHour >= quietStart && currentHour < quietEnd;

    if (isQuietTime) {
      if (!isUrgent) {
        return {
          allowed: false,
          reason: `Quiet hours active (${quietStart}:00-${quietEnd}:00); non-urgent message withheld until morning`,
          action: 'hold',
        };
      }
    }

    // All policy conditions satisfied
    return {
      allowed: true,
      action: 'deliver',
    };
  }

  /**
   * Delivers a proactive proposal to Telegram.
   * - Idempotent: If already delivered, returns cached delivery result without re-transmitting.
   * - Evaluates policy: If held, delayed, rejected, or suppressed, records failure honestly.
   * - Transmits: Marks delivered = true ONLY when Telegram API returns verified message ID.
   */
  public async deliverProposal(
    proposalId: string,
    currentTime: Date = new Date(),
  ): Promise<ProactiveProposalDeliveryResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Cannot deliver unknown proposal ID: ${proposalId}`);
    }

    // Idempotency check: Already delivered proposals are not re-sent
    if (proposal.status === 'delivered' && proposal.deliveryResult?.success) {
      this.logger.debug(
        `Proposal ${proposalId} already delivered (idempotency preserved; no duplicate send)`,
      );
      return proposal.deliveryResult;
    }

    const evaluation = this.evaluatePolicy(proposalId, currentTime);
    const attemptedAt = currentTime.toISOString();

    if (!evaluation.allowed) {
      this.logger.info(
        `Proposal ${proposalId} delivery withheld by policy: [${evaluation.action}] ${evaluation.reason}`,
      );

      let newStatus: ProactiveProposalStatus = 'pending';
      if (evaluation.action === 'cancel') {
        newStatus = 'cancelled';
      } else if (evaluation.action === 'reject' || evaluation.action === 'suppress') {
        newStatus = 'failed';
      } else {
        newStatus = 'pending';
      }

      proposal.status = newStatus;
      const failureResult: ProactiveProposalDeliveryResult = {
        attemptedAt,
        chatId: proposal.recipientChatId || '',
        success: false,
        error: evaluation.reason,
        idempotencyKey: proposal.id,
      };
      proposal.deliveryResult = failureResult;
      return failureResult;
    }

    // Attempt Telegram transmission
    const sendResult = await this.bridge.sendMessageWithResult(
      proposal.recipientChatId!,
      proposal.message,
    );

    if (sendResult.ok && sendResult.messageId) {
      proposal.status = 'delivered';
      proposal.delivered = true;

      const successResult: ProactiveProposalDeliveryResult = {
        attemptedAt,
        telegramMessageId: sendResult.messageId,
        chatId: proposal.recipientChatId!,
        success: true,
        idempotencyKey: proposal.id,
      };

      proposal.deliveryResult = successResult;

      // Update delivery history
      const normalizedText = proposal.message.trim().toLowerCase();
      const messageHash = crypto.createHash('sha256').update(normalizedText).digest('hex');
      this.deliveryHistory.push({
        proposalId: proposal.id,
        chatId: proposal.recipientChatId!,
        messageHash,
        deliveredAt: currentTime.getTime(),
      });

      this.logger.info(
        `Proactive proposal ${proposalId} successfully delivered to chat ${proposal.recipientChatId} (Telegram Msg ID: ${sendResult.messageId})`,
      );
      return successResult;
    } else {
      // Transmission failed: Record honest failure without pretending success
      proposal.status = 'failed';
      proposal.delivered = false;

      const failureResult: ProactiveProposalDeliveryResult = {
        attemptedAt,
        chatId: proposal.recipientChatId!,
        success: false,
        error: sendResult.error || 'Telegram transmission failed',
        idempotencyKey: proposal.id,
      };

      proposal.deliveryResult = failureResult;
      this.logger.warn(
        `Proactive proposal ${proposalId} transmission failed: ${sendResult.error}`,
      );
      return failureResult;
    }
  }

  /**
   * Retries delivery of a failed or pending proposal.
   * If already delivered, returns cached result idempotently.
   */
  public async retryProposal(
    proposalId: string,
    currentTime: Date = new Date(),
  ): Promise<ProactiveProposalDeliveryResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Cannot retry unknown proposal ID: ${proposalId}`);
    }

    if (proposal.status === 'delivered') {
      return proposal.deliveryResult!;
    }

    return this.deliverProposal(proposalId, currentTime);
  }

  /**
   * Emergency shutdown: Cancels all pending and generated proposals and prevents any outbound delivery.
   */
  public triggerEmergencyShutdown(): void {
    this.isEmergencyShutdownActive = true;
    for (const proposal of this.proposals.values()) {
      if (proposal.status === 'pending' || proposal.status === 'generated') {
        proposal.status = 'cancelled';
        if (proposal.deliveryResult) {
          proposal.deliveryResult.error = 'Cancelled by emergency shutdown';
        }
      }
    }
    this.logger.warn(
      'Emergency shutdown triggered: all pending proactive Telegram proposals cancelled.',
    );
  }

  /**
   * Resets emergency shutdown state.
   */
  public resetEmergencyShutdown(): void {
    this.isEmergencyShutdownActive = false;
    this.logger.info('Emergency shutdown reset: proactive initiative enabled.');
  }

  public getEmergencyShutdownStatus(): boolean {
    return this.isEmergencyShutdownActive;
  }

  /**
   * Batches multiple pending proposals for a chat into a single consolidated digest message.
   */
  public async batchPendingProposals(
    chatId: string | number,
    currentTime: Date = new Date(),
  ): Promise<ProactiveProposalDeliveryResult | null> {
    const chatIdStr = String(chatId).trim();
    const pending = Array.from(this.proposals.values()).filter(
      (p) => p.recipientChatId === chatIdStr && p.status === 'pending',
    );

    if (pending.length === 0) {
      return null;
    }

    const batchDigest =
      `*[Arletex Batched Reflections (${pending.length})]*\n\n` +
      pending.map((p, i) => `*${i + 1}. ${p.topic}*\n${p.message}`).join('\n\n');

    // Create consolidated proposal
    const batchProposal = this.createProposal({
      topic: `Batched Digest (${pending.length} items)`,
      message: batchDigest,
      reasoning: `Consolidated delivery of ${pending.length} pending proposals after queue or quiet hours`,
      urgency: 'medium',
      origin: 'direct_initiative',
      recipientChatId: chatIdStr,
    });

    const result = await this.deliverProposal(batchProposal.id, currentTime);
    if (result.success) {
      for (const item of pending) {
        item.status = 'delivered';
        item.delivered = true;
        item.deliveryResult = {
          attemptedAt: result.attemptedAt,
          telegramMessageId: result.telegramMessageId,
          chatId: chatIdStr,
          success: true,
          idempotencyKey: item.id,
        };
      }
    }

    return result;
  }

  public getProposal(id: string): ProactiveNotificationProposal | null {
    return this.proposals.get(id) || null;
  }

  public listProposals(filter?: {
    status?: ProactiveProposalStatus;
    chatId?: string;
  }): ProactiveNotificationProposal[] {
    let list = Array.from(this.proposals.values());
    if (filter?.status) {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.chatId) {
      list = list.filter((p) => p.recipientChatId === filter.chatId);
    }
    return list;
  }

  public getDeliveryStats(): {
    totalProposals: number;
    deliveredCount: number;
    pendingCount: number;
    failedCount: number;
    cancelledCount: number;
  } {
    let delivered = 0;
    let pending = 0;
    let failed = 0;
    let cancelled = 0;

    for (const p of this.proposals.values()) {
      if (p.status === 'delivered') delivered++;
      else if (p.status === 'pending') pending++;
      else if (p.status === 'failed') failed++;
      else if (p.status === 'cancelled') cancelled++;
    }

    return {
      totalProposals: this.proposals.size,
      deliveredCount: delivered,
      pendingCount: pending,
      failedCount: failed,
      cancelledCount: cancelled,
    };
  }
}
