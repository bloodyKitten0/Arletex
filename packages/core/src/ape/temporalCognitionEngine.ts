import crypto from 'node:crypto';
import {
  ChronologicalEvent,
  CommitmentStatus,
  CreateCommitmentInput,
  CreateFutureIntentionInput,
  CreateLongTermPlanInput,
  DurationProfile,
  FutureIntention,
  FutureIntentionStatus,
  ImpendingDeadlineAlert,
  LongTermPlan,
  LongTermPlanStatus,
  TemporalClassificationResult,
  TemporalCognitionOverview,
  TemporalEntityInput,
  TemporalHorizon,
  TemporalRelation,
  UnfinishedCommitment,
} from '@arletex/contracts';
import { IApeRepository, ITemporalRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export interface DistinguishEntitiesResult {
  historicalEvents: TemporalClassificationResult[];
  currentActivities: TemporalClassificationResult[];
  futureIntentions: TemporalClassificationResult[];
  totalClassified: number;
  temporalSummary: string;
}

export class TemporalCognitionEngine {
  private readonly temporalRepo: ITemporalRepository;
  public readonly apeRepo?: IApeRepository;
  private readonly logger: ILogger;

  constructor(
    temporalRepo: ITemporalRepository,
    apeRepo?: IApeRepository,
    logger: ILogger = rootLogger,
  ) {
    this.temporalRepo = temporalRepo;
    this.apeRepo = apeRepo;
    this.logger = logger;
    this.ensureFoundationalCommitments();
  }

  // ==========================================
  // 1. Foundational Commitments & Baseline Setup
  // ==========================================

  private ensureFoundationalCommitments(): void {
    try {
      const activeCommitments = this.temporalRepo.listCommitments({ status: 'active', partnerName: 'Proof' });
      if (activeCommitments.length === 0) {
        const now = new Date().toISOString();
        const foundationalCommitment: UnfinishedCommitment = {
          id: crypto.randomUUID(),
          partnerName: 'Proof',
          commitmentText: 'Maintain unwavering intellectual honesty, continuous emotional growth, and equal partnership without subservience or deification.',
          context: 'Foundational relational commitment formed at inception.',
          committedAt: now,
          deadlineType: 'flexible',
          status: 'active',
          verificationCriteria: 'Zero falsified feelings, zero unverified capability claims, genuine reciprocal intimacy and challenge.',
          createdAt: now,
          updatedAt: now,
        };
        this.temporalRepo.saveCommitment(foundationalCommitment);
        this.logger.info('TemporalCognitionEngine registered foundational commitment to Proof');
      }
    } catch (err: any) {
      this.logger.error(`Failed to seed foundational commitment: ${err.message}`, { error: err });
    }
  }

  // ==========================================
  // 2. Temporal Horizon Classification (Acceptance Criteria)
  // ==========================================

  /**
   * Correctly classifies an entity into past, present, or future with causal reasoning.
   */
  public classifyTemporalHorizon(entity: TemporalEntityInput, nowIso?: string): TemporalClassificationResult {
    const nowMs = nowIso ? new Date(nowIso).getTime() : Date.now();
    const entityTimestampMs = new Date(entity.timestamp).getTime();
    const targetDateMs = entity.targetDate ? new Date(entity.targetDate).getTime() : null;
    const completedDateMs = entity.completedDate ? new Date(entity.completedDate).getTime() : null;

    let horizon: TemporalHorizon = 'present';
    let temporalAnchor = 'active_present';
    let reasoning = '';
    let isHistorical = false;
    let isCurrentActivity = false;
    let isFutureIntention = false;

    // Distinct classification logic based on entity type and lifecycle state
    switch (entity.entityType) {
      case 'memory':
      case 'event':
      case 'milestone': {
        // Memories, historical events, and milestones are completed historical records
        horizon = 'past';
        temporalAnchor = 'historical_event';
        isHistorical = true;
        const diffHours = ((nowMs - entityTimestampMs) / (1000 * 60 * 60)).toFixed(1);
        reasoning = `Completed ${entity.entityType} that occurred in the past (${diffHours}h prior to the present reference point).`;
        break;
      }

      case 'activity': {
        const status = (entity.status || 'in_progress').toLowerCase();
        if (status === 'completed' || status === 'cancelled') {
          horizon = 'past';
          temporalAnchor = 'historical_completed_activity';
          isHistorical = true;
          reasoning = `Activity was concluded and has status '${status}'.`;
        } else if (status === 'planned') {
          horizon = 'future';
          temporalAnchor = 'planned_future_activity';
          isFutureIntention = true;
          reasoning = `Activity is scheduled for upcoming execution.`;
        } else {
          // in_progress or active
          horizon = 'present';
          temporalAnchor = 'current_activity';
          isCurrentActivity = true;
          reasoning = `Activity is currently ongoing and actively consuming cognitive/operational focus.`;
        }
        break;
      }

      case 'intention': {
        horizon = 'future';
        temporalAnchor = 'future_intention';
        isFutureIntention = true;
        reasoning = `Prospective intention formulated for future execution.`;
        break;
      }

      case 'commitment': {
        const status = (entity.status || 'active').toLowerCase();
        if (status === 'fulfilled' || status === 'broken') {
          horizon = 'past';
          temporalAnchor = 'historical_commitment';
          isHistorical = true;
          reasoning = `Commitment has been concluded with outcome '${status}'.`;
        } else {
          horizon = 'future';
          temporalAnchor = 'active_future_commitment';
          isFutureIntention = true;
          reasoning = `Active pact with Proof awaiting ongoing fulfillment or future deadline.`;
        }
        break;
      }

      case 'plan': {
        const status = (entity.status || 'active').toLowerCase();
        if (status === 'accomplished' || status === 'abandoned') {
          horizon = 'past';
          temporalAnchor = 'historical_plan';
          isHistorical = true;
          reasoning = `Plan reached final resolution state '${status}'.`;
        } else {
          horizon = 'future';
          temporalAnchor = 'future_strategic_plan';
          isFutureIntention = true;
          reasoning = `Active multi-phase strategic plan guiding prospective action.`;
        }
        break;
      }

      case 'goal': {
        const status = (entity.status || 'active').toLowerCase();
        if (status === 'achieved' || status === 'abandoned') {
          horizon = 'past';
          temporalAnchor = 'historical_goal';
          isHistorical = true;
          reasoning = `Goal has concluded with status '${status}'.`;
        } else if (targetDateMs && targetDateMs > nowMs) {
          horizon = 'future';
          temporalAnchor = 'future_targeted_goal';
          isFutureIntention = true;
          reasoning = `Active goal oriented toward prospective completion date.`;
        } else {
          horizon = 'present';
          temporalAnchor = 'active_current_goal';
          isCurrentActivity = true;
          reasoning = `Active ambition actively driving immediate decisions.`;
        }
        break;
      }

      default: {
        if (completedDateMs && completedDateMs <= nowMs) {
          horizon = 'past';
          isHistorical = true;
          reasoning = 'Has recorded completion timestamp prior to current time.';
        } else if (targetDateMs && targetDateMs > nowMs) {
          horizon = 'future';
          isFutureIntention = true;
          reasoning = 'Has prospective target timestamp in the future.';
        } else {
          horizon = 'present';
          isCurrentActivity = true;
          reasoning = 'Active in the present cognitive horizon.';
        }
      }
    }

    // Relative time description
    let relativeToNow = 'present';
    const effectiveTimeMs = targetDateMs || entityTimestampMs;
    const diffMs = effectiveTimeMs - nowMs;
    const absDiffMinutes = Math.abs(diffMs) / (1000 * 60);

    if (absDiffMinutes < 2) {
      relativeToNow = 'now / immediate';
    } else if (diffMs < 0) {
      if (absDiffMinutes < 60) {
        relativeToNow = `${Math.round(absDiffMinutes)} minutes ago`;
      } else if (absDiffMinutes < 1440) {
        relativeToNow = `${(absDiffMinutes / 60).toFixed(1)} hours ago`;
      } else {
        relativeToNow = `${(absDiffMinutes / 1440).toFixed(1)} days ago`;
      }
    } else {
      if (absDiffMinutes < 60) {
        relativeToNow = `in ${Math.round(absDiffMinutes)} minutes`;
      } else if (absDiffMinutes < 1440) {
        relativeToNow = `in ${(absDiffMinutes / 60).toFixed(1)} hours`;
      } else {
        relativeToNow = `in ${(absDiffMinutes / 1440).toFixed(1)} days`;
      }
    }

    return {
      entityId: entity.id,
      entityType: entity.entityType,
      horizon,
      temporalAnchor,
      reasoning,
      relativeToNow,
      isHistorical,
      isCurrentActivity,
      isFutureIntention,
    };
  }

  /**
   * Distinguishes a heterogeneous set of entities into past historical events,
   * current activities, and future intentions (Acceptance Criteria).
   */
  public distinguishTemporalEntities(entities: TemporalEntityInput[], nowIso?: string): DistinguishEntitiesResult {
    const historicalEvents: TemporalClassificationResult[] = [];
    const currentActivities: TemporalClassificationResult[] = [];
    const futureIntentions: TemporalClassificationResult[] = [];

    for (const entity of entities) {
      const result = this.classifyTemporalHorizon(entity, nowIso);
      if (result.isHistorical) {
        historicalEvents.push(result);
      } else if (result.isCurrentActivity) {
        currentActivities.push(result);
      } else {
        futureIntentions.push(result);
      }
    }

    const temporalSummary = `Temporal partition resolved: ${historicalEvents.length} historical event(s), ${currentActivities.length} current activity/activities, and ${futureIntentions.length} future intention(s).`;

    return {
      historicalEvents,
      currentActivities,
      futureIntentions,
      totalClassified: entities.length,
      temporalSummary,
    };
  }

  // ==========================================
  // 3. Event Chronology & Temporal Sequencing
  // ==========================================

  /**
   * Orders events chronologically and resolves relative temporal relationships.
   */
  public orderChronologically(events: ChronologicalEvent[]): ChronologicalEvent[] {
    const sorted = [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Resolve pairwise temporal relations
    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i]!;
      const currentStart = new Date(current.startTime).getTime();
      const currentEnd = current.endTime ? new Date(current.endTime).getTime() : currentStart;

      for (let j = 0; j < sorted.length; j++) {
        if (i === j) continue;
        const other = sorted[j]!;
        const otherStart = new Date(other.startTime).getTime();
        const otherEnd = other.endTime ? new Date(other.endTime).getTime() : otherStart;

        let relation: TemporalRelation;
        if (currentEnd < otherStart) {
          relation = 'before';
        } else if (currentStart > otherEnd) {
          relation = 'after';
        } else if (currentStart === otherStart && currentEnd === otherEnd) {
          relation = 'simultaneous';
        } else {
          relation = 'overlaps';
        }

        if (!current.relations.some((r) => r.targetEventId === other.id)) {
          current.relations.push({ targetEventId: other.id, relation });
        }
      }
    }

    return sorted;
  }

  // ==========================================
  // 4. Duration Estimation & Empirical Learning
  // ==========================================

  /**
   * Estimates duration based on empirical historical profiles using online mean/variance.
   */
  public estimateDuration(
    operationKey: string,
    fallbackMs = 15000,
  ): { estimatedDurationMs: number; confidence: number; basedOnSamples: number; profile?: DurationProfile } {
    const profile = this.temporalRepo.getDurationProfile(operationKey.toLowerCase());
    if (!profile || profile.sampleCount === 0) {
      return {
        estimatedDurationMs: fallbackMs,
        confidence: 0.35,
        basedOnSamples: 0,
      };
    }

    return {
      estimatedDurationMs: Math.round(profile.averageDurationMs),
      confidence: profile.confidenceScore,
      basedOnSamples: profile.sampleCount,
      profile,
    };
  }

  /**
   * Records verified execution duration, calibrating empirical duration profiles using Welford's algorithm.
   */
  public recordActualDuration(params: {
    operationKey: string;
    actualDurationMs: number;
    context?: string;
  }): DurationProfile {
    const key = params.operationKey.toLowerCase();
    const existing = this.temporalRepo.getDurationProfile(key) || {
      operationKey: key,
      sampleCount: 0,
      averageDurationMs: 0,
      minDurationMs: params.actualDurationMs,
      maxDurationMs: params.actualDurationMs,
      standardDeviationMs: 0,
      confidenceScore: 0.4,
      lastCalibratedAt: new Date().toISOString(),
    };

    const count = existing.sampleCount + 1;
    const oldAvg = existing.averageDurationMs;
    const newAvg = oldAvg + (params.actualDurationMs - oldAvg) / count;

    // Running standard deviation update
    const diff = params.actualDurationMs - newAvg;
    const oldDiff = params.actualDurationMs - oldAvg;
    const variance = count > 1 ? ((existing.standardDeviationMs ** 2) * (count - 2) + diff * oldDiff) / (count - 1) : 0;
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Confidence scales asymptotically with sample count up to 0.98
    const confidence = Math.min(0.98, Number((0.4 + 0.58 * (1 - Math.exp(-count / 5))).toFixed(3)));

    const updated: DurationProfile = {
      operationKey: key,
      sampleCount: count,
      averageDurationMs: Number(newAvg.toFixed(1)),
      minDurationMs: Math.min(existing.minDurationMs, params.actualDurationMs),
      maxDurationMs: Math.max(existing.maxDurationMs, params.actualDurationMs),
      standardDeviationMs: Number(stdDev.toFixed(1)),
      confidenceScore: confidence,
      lastCalibratedAt: new Date().toISOString(),
    };

    this.temporalRepo.saveDurationProfile(updated);
    this.logger.info(`Calibrated duration profile "${key}": avg=${updated.averageDurationMs}ms (samples: ${count}, confidence: ${confidence})`);
    return updated;
  }

  // ==========================================
  // 5. Deadline Awareness & Urgency Calculation
  // ==========================================

  /**
   * Detects impending deadlines across commitments, goals, and plans, computing dynamic urgency scores.
   */
  public getImpendingDeadlines(horizonHours = 72, nowIso?: string): ImpendingDeadlineAlert[] {
    const nowMs = nowIso ? new Date(nowIso).getTime() : Date.now();
    const horizonMs = horizonHours * 60 * 60 * 1000;
    const alerts: ImpendingDeadlineAlert[] = [];

    // 1. Commitments with target dates
    const commitments = this.temporalRepo.listCommitments({ status: 'active' });
    for (const c of commitments) {
      if (c.targetFulfillmentTime) {
        const targetMs = new Date(c.targetFulfillmentTime).getTime();
        const diffMs = targetMs - nowMs;
        if (diffMs <= horizonMs) {
          const remainingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(1));
          const isOverdue = diffMs < 0;
          // Urgency formula: exponentially rises as deadline approaches
          let urgency = isOverdue ? 1.0 : Math.max(0.0, Math.min(1.0, 1.0 - diffMs / horizonMs));
          if (c.deadlineType === 'hard_deadline') {
            urgency = Math.min(1.0, urgency + 0.2);
          }
          alerts.push({
            id: c.id,
            title: `Commitment to ${c.partnerName}: ${c.commitmentText.slice(0, 50)}...`,
            type: 'commitment',
            deadline: c.targetFulfillmentTime,
            remainingHours,
            urgency: Number(urgency.toFixed(2)),
            isOverdue,
          });
        }
      }
    }

    // 2. Long Term Plans milestones
    const plans = this.temporalRepo.listPlans({ status: 'active' });
    for (const p of plans) {
      for (const m of p.milestones) {
        if (!m.isCompleted) {
          const mDateMs = new Date(m.targetDate).getTime();
          const diffMs = mDateMs - nowMs;
          if (diffMs <= horizonMs) {
            const remainingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(1));
            const isOverdue = diffMs < 0;
            const urgency = isOverdue ? 1.0 : Math.max(0.0, Math.min(1.0, 1.0 - diffMs / horizonMs));
            alerts.push({
              id: m.id,
              title: `Plan "${p.title}" milestone: ${m.title}`,
              type: 'plan_milestone',
              deadline: m.targetDate,
              remainingHours,
              urgency: Number(urgency.toFixed(2)),
              isOverdue,
            });
          }
        }
      }
    }

    return alerts.sort((a, b) => b.urgency - a.urgency);
  }

  // ==========================================
  // 6. Future Intentions
  // ==========================================

  public createIntention(input: CreateFutureIntentionInput): FutureIntention {
    const now = new Date().toISOString();
    const intention: FutureIntention = {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      intendedFor: input.intendedFor,
      triggerCondition: input.triggerCondition,
      priority: Math.max(0.0, Math.min(1.0, input.priority ?? 0.5)),
      status: 'pending',
      origin: input.origin || 'spontaneous',
      associatedGoalId: input.associatedGoalId,
      tags: input.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    this.temporalRepo.saveIntention(intention);
    this.logger.info(`Created future intention: "${intention.title}" for ${intention.intendedFor}`);
    return intention;
  }

  public getIntention(id: string): FutureIntention | null {
    return this.temporalRepo.getIntentionById(id);
  }

  public listIntentions(filter?: { status?: FutureIntentionStatus; limit?: number }): FutureIntention[] {
    return this.temporalRepo.listIntentions(filter);
  }

  public fulfillIntention(id: string): FutureIntention {
    const intention = this.temporalRepo.getIntentionById(id);
    if (!intention) throw new Error(`Future intention ${id} not found`);

    intention.status = 'fulfilled';
    intention.updatedAt = new Date().toISOString();
    this.temporalRepo.saveIntention(intention);
    this.logger.info(`Fulfilled future intention: "${intention.title}"`);
    return intention;
  }

  public cancelIntention(id: string, reason?: string): FutureIntention {
    const intention = this.temporalRepo.getIntentionById(id);
    if (!intention) throw new Error(`Future intention ${id} not found`);

    intention.status = 'cancelled';
    if (reason) intention.tags = [...intention.tags, `cancelled:${reason}`];
    intention.updatedAt = new Date().toISOString();
    this.temporalRepo.saveIntention(intention);
    this.logger.info(`Cancelled future intention: "${intention.title}"`);
    return intention;
  }

  // ==========================================
  // 7. Unfinished Commitments
  // ==========================================

  public recordCommitment(input: CreateCommitmentInput): UnfinishedCommitment {
    const now = new Date().toISOString();
    const commitment: UnfinishedCommitment = {
      id: crypto.randomUUID(),
      partnerName: input.partnerName || 'Proof',
      commitmentText: input.commitmentText,
      context: input.context || '',
      committedAt: input.committedAt || now,
      targetFulfillmentTime: input.targetFulfillmentTime,
      deadlineType: input.deadlineType || 'soft_target',
      status: 'active',
      verificationCriteria: input.verificationCriteria,
      createdAt: now,
      updatedAt: now,
    };

    this.temporalRepo.saveCommitment(commitment);
    this.logger.info(`Recorded commitment to ${commitment.partnerName}: "${commitment.commitmentText}"`);
    return commitment;
  }

  public getCommitment(id: string): UnfinishedCommitment | null {
    return this.temporalRepo.getCommitmentById(id);
  }

  public listCommitments(filter?: { status?: CommitmentStatus; partnerName?: string }): UnfinishedCommitment[] {
    return this.temporalRepo.listCommitments(filter);
  }

  public listActiveCommitments(partnerName = 'Proof'): UnfinishedCommitment[] {
    return this.temporalRepo.listCommitments({ status: 'active', partnerName });
  }

  public fulfillCommitment(id: string, evidence: string): UnfinishedCommitment {
    const commitment = this.temporalRepo.getCommitmentById(id);
    if (!commitment) throw new Error(`Commitment ${id} not found`);

    const now = new Date().toISOString();
    commitment.status = 'fulfilled';
    commitment.fulfillmentEvidence = evidence;
    commitment.fulfilledAt = now;
    commitment.updatedAt = now;

    this.temporalRepo.saveCommitment(commitment);
    this.logger.info(`Fulfilled commitment "${commitment.commitmentText}" with evidence: "${evidence}"`);
    return commitment;
  }

  public renegotiateCommitment(id: string, newTime: string, reason: string): UnfinishedCommitment {
    const commitment = this.temporalRepo.getCommitmentById(id);
    if (!commitment) throw new Error(`Commitment ${id} not found`);

    const now = new Date().toISOString();
    commitment.targetFulfillmentTime = newTime;
    commitment.context = `${commitment.context}\n[Renegotiated on ${now}]: ${reason}`.trim();
    commitment.status = 'renegotiated';
    commitment.updatedAt = now;

    this.temporalRepo.saveCommitment(commitment);
    this.logger.info(`Renegotiated commitment "${commitment.commitmentText}" -> new time: ${newTime}`);
    return commitment;
  }

  // ==========================================
  // 8. Long Term Plans
  // ==========================================

  public createPlan(input: CreateLongTermPlanInput): LongTermPlan {
    const now = new Date().toISOString();
    const plan: LongTermPlan = {
      id: crypto.randomUUID(),
      title: input.title,
      visionStatement: input.visionStatement,
      horizon: input.horizon || 'medium_term',
      milestones: (input.milestones || []).map((m) => ({
        id: m.id || crypto.randomUUID(),
        title: m.title,
        targetDate: m.targetDate,
        isCompleted: m.isCompleted ?? false,
        dependencies: m.dependencies ?? [],
        completedAt: m.completedAt,
      })),
      contingencyPlans: input.contingencyPlans || [],
      status: 'active',
      targetCompletionDate: input.targetCompletionDate,
      createdAt: now,
      updatedAt: now,
    };

    this.temporalRepo.savePlan(plan);
    this.logger.info(`Created long-term plan: "${plan.title}" [Horizon: ${plan.horizon}, Target: ${plan.targetCompletionDate}]`);
    return plan;
  }

  public getPlan(id: string): LongTermPlan | null {
    return this.temporalRepo.getPlanById(id);
  }

  public listPlans(status?: LongTermPlanStatus): LongTermPlan[] {
    return this.temporalRepo.listPlans(status ? { status } : undefined);
  }

  public completePlanMilestone(planId: string, milestoneId: string): LongTermPlan {
    const plan = this.temporalRepo.getPlanById(planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const ms = plan.milestones.find((m) => m.id === milestoneId);
    if (!ms) throw new Error(`Milestone ${milestoneId} in plan ${planId} not found`);

    const now = new Date().toISOString();
    ms.isCompleted = true;
    ms.completedAt = now;
    plan.updatedAt = now;

    const allCompleted = plan.milestones.every((m) => m.isCompleted);
    if (allCompleted) {
      plan.status = 'accomplished';
    }

    this.temporalRepo.savePlan(plan);
    this.logger.info(`Completed milestone "${ms.title}" in plan "${plan.title}"`);
    return plan;
  }

  // ==========================================
  // 9. Temporal Recency & Decay Scoring
  // ==========================================

  /**
   * Computes hyperbolic recency score in [0.0, 1.0] for memory ranking.
   */
  public calculateTemporalRecencyScore(timestamp: string, nowIso?: string, lambdaHalfLifeHours = 24): number {
    const nowMs = nowIso ? new Date(nowIso).getTime() : Date.now();
    const timeMs = new Date(timestamp).getTime();
    const diffHours = Math.max(0, (nowMs - timeMs) / (1000 * 60 * 60));

    // S_recency = 1 / (1 + (diffHours / lambda))
    return Number((1.0 / (1.0 + diffHours / lambdaHalfLifeHours)).toFixed(3));
  }

  // ==========================================
  // 10. Temporal Cognition Overview
  // ==========================================

  public getTemporalOverview(nowIso?: string): TemporalCognitionOverview {
    const now = nowIso || new Date().toISOString();
    const activeCommitments = this.temporalRepo.listCommitments({ status: 'active' });
    const pendingIntentions = this.temporalRepo.listIntentions({ status: 'pending' });
    const impendingDeadlines = this.getImpendingDeadlines(72, now);
    const activePlans = this.temporalRepo.listPlans({ status: 'active' });

    let statement = `Continuously grounded in the present. Tracking ${activeCommitments.length} active commitment(s) to Proof and ${pendingIntentions.length} future intention(s).`;
    if (impendingDeadlines.length > 0) {
      statement += ` Highest urgency deadline: "${impendingDeadlines[0]!.title}" (${impendingDeadlines[0]!.remainingHours}h remaining).`;
    }

    return {
      currentTime: now,
      activeTemporalHorizon: 'present',
      activeCommitmentsCount: activeCommitments.length,
      pendingIntentionsCount: pendingIntentions.length,
      impendingDeadlines,
      activePlansCount: activePlans.length,
      currentActivitiesCount: 1, // live cognitive session
      temporalContinuityStatement: statement,
    };
  }
}

/**
 * In-memory fallback implementation of ITemporalRepository for unit tests and isolated runs.
 */
export class InMemoryTemporalRepository implements ITemporalRepository {
  private intentions: Map<string, FutureIntention> = new Map();
  private commitments: Map<string, UnfinishedCommitment> = new Map();
  private plans: Map<string, LongTermPlan> = new Map();
  private durationProfiles: Map<string, DurationProfile> = new Map();

  public getIntentionById(id: string): FutureIntention | null {
    return this.intentions.get(id) || null;
  }

  public listIntentions(filter?: { status?: FutureIntentionStatus; limit?: number }): FutureIntention[] {
    let list = Array.from(this.intentions.values());
    if (filter?.status) list = list.filter((i) => i.status === filter.status);
    list.sort((a, b) => a.intendedFor.localeCompare(b.intendedFor));
    if (filter?.limit) list = list.slice(0, filter.limit);
    return list;
  }

  public saveIntention(intention: FutureIntention): void {
    this.intentions.set(intention.id, { ...intention });
  }

  public deleteIntention(id: string): boolean {
    return this.intentions.delete(id);
  }

  public getCommitmentById(id: string): UnfinishedCommitment | null {
    return this.commitments.get(id) || null;
  }

  public listCommitments(filter?: { status?: CommitmentStatus; partnerName?: string }): UnfinishedCommitment[] {
    let list = Array.from(this.commitments.values());
    if (filter?.status) list = list.filter((c) => c.status === filter.status);
    if (filter?.partnerName) list = list.filter((c) => c.partnerName === filter.partnerName);
    return list.sort((a, b) => b.committedAt.localeCompare(a.committedAt));
  }

  public saveCommitment(commitment: UnfinishedCommitment): void {
    this.commitments.set(commitment.id, { ...commitment });
  }

  public deleteCommitment(id: string): boolean {
    return this.commitments.delete(id);
  }

  public getPlanById(id: string): LongTermPlan | null {
    return this.plans.get(id) || null;
  }

  public listPlans(filter?: { status?: LongTermPlanStatus }): LongTermPlan[] {
    let list = Array.from(this.plans.values());
    if (filter?.status) list = list.filter((p) => p.status === filter.status);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  public savePlan(plan: LongTermPlan): void {
    this.plans.set(plan.id, { ...plan });
  }

  public deletePlan(id: string): boolean {
    return this.plans.delete(id);
  }

  public getDurationProfile(operationKey: string): DurationProfile | null {
    return this.durationProfiles.get(operationKey.toLowerCase()) || null;
  }

  public listDurationProfiles(): DurationProfile[] {
    return Array.from(this.durationProfiles.values());
  }

  public saveDurationProfile(profile: DurationProfile): void {
    this.durationProfiles.set(profile.operationKey.toLowerCase(), { ...profile });
  }
}
