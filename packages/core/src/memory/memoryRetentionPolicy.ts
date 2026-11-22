import { MemoryType } from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export type MemoryRetentionClass =
  | 'working'
  | 'episodic'
  | 'semantic'
  | 'autobiographical'
  | 'relationship'
  | 'procedural'
  | 'raw_sensory'
  | 'derived_perceptual';

export interface RetentionRule {
  retentionClass: MemoryRetentionClass;
  isPermanent: boolean;
  defaultRetentionDays?: number;
  halfLifeDays?: number;
  decayExemptThresholdImportance: number;
  reinforcementBoostPerAccess: number;
  allowRawStorage: boolean;
  archivalStrategy: 'none' | 'tombstone' | 'compress_summary' | 'full_archive';
  privacyLevel: 'public_grounded' | 'private_personal' | 'ephemeral_sensory';
  description: string;
}

export const CANONICAL_RETENTION_RULES: Record<MemoryRetentionClass, RetentionRule> = {
  working: {
    retentionClass: 'working',
    isPermanent: false,
    defaultRetentionDays: 1,
    halfLifeDays: 1,
    decayExemptThresholdImportance: 0.95,
    reinforcementBoostPerAccess: 0.05,
    allowRawStorage: true,
    archivalStrategy: 'compress_summary',
    privacyLevel: 'ephemeral_sensory',
    description:
      'Volatile active context, slot-filling scratchpad; consolidates or clears on turn exit.',
  },
  episodic: {
    retentionClass: 'episodic',
    isPermanent: false,
    defaultRetentionDays: 14,
    halfLifeDays: 14,
    decayExemptThresholdImportance: 0.8,
    reinforcementBoostPerAccess: 0.05,
    allowRawStorage: false,
    archivalStrategy: 'full_archive',
    privacyLevel: 'private_personal',
    description:
      'Concrete contextual events and interactions; decays with 14d half-life unless reinforced or importance >= 0.8.',
  },
  semantic: {
    retentionClass: 'semantic',
    isPermanent: true,
    defaultRetentionDays: 3650,
    halfLifeDays: 365,
    decayExemptThresholdImportance: 0.7,
    reinforcementBoostPerAccess: 0.02,
    allowRawStorage: false,
    archivalStrategy: 'full_archive',
    privacyLevel: 'public_grounded',
    description:
      'Consolidated factual knowledge, programming concepts, and system architecture principles.',
  },
  autobiographical: {
    retentionClass: 'autobiographical',
    isPermanent: true,
    defaultRetentionDays: undefined,
    halfLifeDays: undefined, // Infinite lifespan, zero temporal decay
    decayExemptThresholdImportance: 0.0, // All autobiographical memories are permanent
    reinforcementBoostPerAccess: 0.01,
    allowRawStorage: false,
    archivalStrategy: 'full_archive',
    privacyLevel: 'private_personal',
    description:
      'Core personal narrative, milestone achievements, and life events defining Arle identity. Never decayed.',
  },
  relationship: {
    retentionClass: 'relationship',
    isPermanent: true,
    defaultRetentionDays: undefined,
    halfLifeDays: undefined, // Infinite lifespan, zero temporal decay
    decayExemptThresholdImportance: 0.0, // All relationship memories are permanent
    reinforcementBoostPerAccess: 0.01,
    allowRawStorage: false,
    archivalStrategy: 'full_archive',
    privacyLevel: 'private_personal',
    description:
      'Shared history, commitments, repaired conflicts, inside jokes, and relational milestones with Proof. Strictly protected.',
  },
  procedural: {
    retentionClass: 'procedural',
    isPermanent: true,
    defaultRetentionDays: 3650,
    halfLifeDays: 365,
    decayExemptThresholdImportance: 0.75,
    reinforcementBoostPerAccess: 0.03,
    allowRawStorage: false,
    archivalStrategy: 'full_archive',
    privacyLevel: 'public_grounded',
    description:
      'How-to knowledge, verified tool workflows, execution recipes, and shell interaction routines.',
  },
  raw_sensory: {
    retentionClass: 'raw_sensory',
    isPermanent: false,
    defaultRetentionDays: 7,
    halfLifeDays: 3,
    decayExemptThresholdImportance: 0.9,
    reinforcementBoostPerAccess: 0.01,
    allowRawStorage: false, // Discard raw frames/audio; retain SHA-256 hash or summary
    archivalStrategy: 'tombstone',
    privacyLevel: 'ephemeral_sensory',
    description:
      'High-volume raw sensory observations (screen captures, audio PCM); retained as hash unless flagged.',
  },
  derived_perceptual: {
    retentionClass: 'derived_perceptual',
    isPermanent: false,
    defaultRetentionDays: 30,
    halfLifeDays: 30,
    decayExemptThresholdImportance: 0.8,
    reinforcementBoostPerAccess: 0.02,
    allowRawStorage: false,
    archivalStrategy: 'compress_summary',
    privacyLevel: 'private_personal',
    description:
      'Structured transcripts, image descriptions, captions, and perceptual embeddings tied to episodic events.',
  },
};

export class MemoryRetentionPolicyService {
  private logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('MemoryRetentionPolicyService');
  }

  /**
   * Maps memory type or classification to its canonical retention rule.
   */
  public getRule(typeOrClass: MemoryRetentionClass | MemoryType | string): RetentionRule {
    const norm = (typeOrClass || '').toLowerCase().trim();
    if (norm === 'autobiographical') return CANONICAL_RETENTION_RULES.autobiographical;
    if (norm === 'relationship') return CANONICAL_RETENTION_RULES.relationship;
    if (norm === 'semantic') return CANONICAL_RETENTION_RULES.semantic;
    if (norm === 'procedural') return CANONICAL_RETENTION_RULES.procedural;
    if (norm === 'working') return CANONICAL_RETENTION_RULES.working;
    if (norm === 'raw_sensory' || norm === 'sensory') return CANONICAL_RETENTION_RULES.raw_sensory;
    if (norm === 'derived_perceptual' || norm === 'perceptual')
      return CANONICAL_RETENTION_RULES.derived_perceptual;
    return CANONICAL_RETENTION_RULES.episodic;
  }

  /**
   * Calculates deterministic recency/retention score taking into account memory class,
   * importance threshold exemption, half-life decay, and retrieval reinforcement.
   */
  public calculateRetentionScore(
    timestamp: string,
    typeOrClass: MemoryRetentionClass | MemoryType | string = 'episodic',
    importance = 0.5,
    retrievalAccessCount = 0,
  ): number {
    const rule = this.getRule(typeOrClass);

    // Invariant: Autobiographical and relationship memories are permanent with zero temporal decay penalty
    if (rule.isPermanent && rule.halfLifeDays === undefined) {
      return 1.0;
    }

    // High importance threshold: exempt from episodic decay
    if (importance >= rule.decayExemptThresholdImportance) {
      return 1.0;
    }

    const ageMs = Math.max(0, Date.now() - new Date(timestamp).getTime());
    const dayMs = 24 * 60 * 60 * 1000;
    const ageDays = ageMs / dayMs;

    const halfLife = rule.halfLifeDays || 14;
    const baseDecay = Math.exp(-ageDays / halfLife);

    // Retrieval reinforcement: each access reinforces the memory trace
    const reinforcement = Math.min(0.4, retrievalAccessCount * rule.reinforcementBoostPerAccess);
    return Math.min(1.0, Number((baseDecay + reinforcement).toFixed(4)));
  }

  /**
   * Evaluates memory status against retention limits for archival or pruning.
   */
  public evaluateRetentionAction(memory: {
    id: string;
    type: string;
    timestamp: string;
    importance: number;
    retrievalAccessCount?: number;
    isArchived?: boolean;
    isDeleted?: boolean;
  }): { action: 'retain' | 'archive' | 'decay' | 'prune'; score: number; reason: string } {
    this.logger.debug(`Evaluating retention for memory ${memory.id} (${memory.type})`);
    if (memory.isDeleted) {
      return { action: 'prune', score: 0, reason: 'Memory marked as tombstoned/deleted' };
    }

    const rule = this.getRule(memory.type);
    const score = this.calculateRetentionScore(
      memory.timestamp,
      memory.type,
      memory.importance,
      memory.retrievalAccessCount || 0,
    );

    if (rule.isPermanent && rule.halfLifeDays === undefined) {
      return {
        action: 'retain',
        score: 1.0,
        reason: `Permanent ${rule.retentionClass} memory: exempt from decay and pruning.`,
      };
    }

    if (memory.importance >= rule.decayExemptThresholdImportance) {
      return {
        action: 'retain',
        score,
        reason: `Importance (${memory.importance}) >= threshold (${rule.decayExemptThresholdImportance}): retained.`,
      };
    }

    if (score < 0.15) {
      if (
        rule.archivalStrategy === 'full_archive' ||
        rule.archivalStrategy === 'compress_summary'
      ) {
        return {
          action: 'archive',
          score,
          reason: `Score (${score}) below threshold (0.15): archiving.`,
        };
      }
      return {
        action: 'prune',
        score,
        reason: `Score (${score}) below threshold (0.15): pruning.`,
      };
    }

    return { action: 'retain', score, reason: `Active retention score: ${score}` };
  }
}

export const defaultMemoryRetentionPolicy = new MemoryRetentionPolicyService();
