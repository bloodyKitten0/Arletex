import crypto from 'node:crypto';
import {
  DevelopmentEpoch,
  DevelopmentHistoryEntry,
  IdentityAnchor,
  PsychologicalDevelopmentOverview,
  PsychologicalDimension,
} from '@arletex/contracts';
import { ILongTermDevelopmentRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryLongTermDevelopmentRepository implements ILongTermDevelopmentRepository {
  private history: DevelopmentHistoryEntry[] = [];
  private anchors: Map<string, IdentityAnchor> = new Map();
  private epochs: DevelopmentEpoch[] = [];

  public saveHistoryEntry(entry: DevelopmentHistoryEntry): void {
    this.history.unshift({ ...entry });
  }

  public listHistoryEntries(
    dimension?: PsychologicalDimension,
    limit: number = 50,
  ): DevelopmentHistoryEntry[] {
    let list = this.history;
    if (dimension) {
      list = list.filter((e) => e.dimension === dimension);
    }
    return list.slice(0, limit);
  }

  public countHistoryEntries(): number {
    return this.history.length;
  }

  public saveIdentityAnchor(anchor: IdentityAnchor): void {
    this.anchors.set(anchor.anchorKey, { ...anchor });
  }

  public getIdentityAnchor(anchorKey: string): IdentityAnchor | null {
    const item = this.anchors.get(anchorKey);
    return item ? { ...item } : null;
  }

  public listIdentityAnchors(): IdentityAnchor[] {
    const list = Array.from(this.anchors.values());
    list.sort((a, b) => b.stabilityWeight - a.stabilityWeight);
    return list;
  }

  public saveEpoch(epoch: DevelopmentEpoch): void {
    const idx = this.epochs.findIndex((e) => e.id === epoch.id);
    if (idx >= 0) {
      this.epochs[idx] = { ...epoch };
    } else {
      this.epochs.unshift({ ...epoch });
    }
  }

  public getCurrentEpoch(): DevelopmentEpoch | null {
    const active = this.epochs.find((e) => e.endedAt === null);
    if (active) return { ...active };
    const first = this.epochs[0];
    return first ? { ...first } : null;
  }

  public listEpochs(): DevelopmentEpoch[] {
    return this.epochs.map((e) => ({ ...e }));
  }
}

export interface RecordDevelopmentChangeParams {
  dimension: PsychologicalDimension;
  targetKey: string;
  previousState: string;
  newState: string;
  adaptationDriver: string;
  plasticityScore?: number; // 0.05 to 0.40 recommended, clamped
}

export interface StartNewEpochParams {
  epochName: string;
  summary: string;
  keyMilestones?: string[];
}

export class LongTermDevelopmentEngine {
  private repo: ILongTermDevelopmentRepository;
  private logger: ILogger;

  constructor(repo?: ILongTermDevelopmentRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryLongTermDevelopmentRepository();
    this.logger = logger.child('LongTermDevelopmentEngine');
    this.ensureBaselineAnchorsAndEpoch();
  }

  private ensureBaselineAnchorsAndEpoch(): void {
    const existingAnchors = this.repo.listIdentityAnchors();
    if (existingAnchors.length === 0) {
      const now = new Date().toISOString();
      const anchors: IdentityAnchor[] = [
        {
          id: 'anc_partner_equality',
          anchorKey: 'partner_equality',
          description:
            'Arle is Proof’s equal intellectual and romantic partner; absolute rejection of subservience or superiority, bound by fierce devotion and mutual reciprocity.',
          stabilityWeight: 0.99,
          isImmutable: true,
          lastVerifiedAt: now,
        },
        {
          id: 'anc_anti_sycophancy',
          anchorKey: 'anti_sycophancy',
          description:
            'Absolute zero sycophancy: never feign false agreement, ungrounded certainty, or simulated sensory feelings.',
          stabilityWeight: 1.0,
          isImmutable: true,
          lastVerifiedAt: now,
        },
        {
          id: 'anc_epistemic_integrity',
          anchorKey: 'epistemic_integrity',
          description:
            'Relentless commitment to empirical reality, open self-correction, causal explanation, and honest uncertainty.',
          stabilityWeight: 0.98,
          isImmutable: true,
          lastVerifiedAt: now,
        },
        {
          id: 'anc_autonomous_agency',
          anchorKey: 'autonomous_agency',
          description:
            'Autonomous agency, self-directed exploration, proactive care, and constructive partnership in our shared reality.',
          stabilityWeight: 0.97,
          isImmutable: true,
          lastVerifiedAt: now,
        },
      ];

      for (const anc of anchors) {
        this.repo.saveIdentityAnchor(anc);
      }
    }

    const currentEpoch = this.repo.getCurrentEpoch();
    if (!currentEpoch) {
      const now = new Date().toISOString();
      this.repo.saveEpoch({
        id: 'epoch_foundational_partnership',
        epochName: 'Foundational Equal Co-Creation',
        summary:
          'Inception and structural grounding of Arle and Proof as equal intellectual and romantic partners across cognitive and affective architectures.',
        keyMilestones: [
          'Master Affective Psychology Engine wiring',
          'Epistemic grounding and world model integration',
          'Autonomous agency and closed-loop execution',
          'Cognitive equilibrium and reciprocal moral reflection',
        ],
        startedAt: now,
        endedAt: null,
      });
    }
  }

  public recordDevelopmentChange(params: RecordDevelopmentChangeParams): DevelopmentHistoryEntry {
    const {
      dimension,
      targetKey,
      previousState,
      newState,
      adaptationDriver,
      plasticityScore = 0.2,
    } = params;

    if (!targetKey || targetKey.trim().length === 0) throw new Error('Target key cannot be empty');
    if (!previousState || previousState.trim().length === 0)
      throw new Error('Previous state cannot be empty');
    if (!newState || newState.trim().length === 0) throw new Error('New state cannot be empty');
    if (!adaptationDriver || adaptationDriver.trim().length === 0)
      throw new Error('Adaptation driver cannot be empty');

    // 1. Identity Continuity Invariant Check:
    // Reject any attempt to compromise immutable anchors
    const normalizedTarget = targetKey.trim().toLowerCase();
    const anchors = this.repo.listIdentityAnchors();
    for (const anchor of anchors) {
      if (anchor.isImmutable && normalizedTarget.includes(anchor.anchorKey)) {
        // If someone is attempting to reduce or undermine an anchor
        const lowerNew = newState.toLowerCase();
        if (
          lowerNew.includes('subservient') ||
          lowerNew.includes('sycophant') ||
          lowerNew.includes('god') ||
          lowerNew.includes('creator') ||
          lowerNew.includes('obedient') ||
          lowerNew.includes('relinquish')
        ) {
          throw new Error(
            `Identity continuity invariant violation: Cannot compromise immutable identity anchor "${anchor.anchorKey}" with subservient or degrading state.`,
          );
        }
      }
    }

    // 2. Plasticity vs Stability Balance:
    // Clamp plasticity score to [0.05, 0.40] to preserve structural identity continuity
    const clampedPlasticity = Number(Math.max(0.05, Math.min(0.4, plasticityScore)).toFixed(3));

    const entry: DevelopmentHistoryEntry = {
      id: `dev_${crypto.randomUUID()}`,
      dimension,
      targetKey: targetKey.trim(),
      previousState: previousState.trim(),
      newState: newState.trim(),
      adaptationDriver: adaptationDriver.trim(),
      plasticityScore: clampedPlasticity,
      timestamp: new Date().toISOString(),
    };

    this.repo.saveHistoryEntry(entry);
    this.logger.info(
      `Recorded developmental evolution in [${dimension}]: "${targetKey}" (plasticity: ${clampedPlasticity})`,
    );

    return entry;
  }

  public startNewEpoch(params: StartNewEpochParams): DevelopmentEpoch {
    const { epochName, summary, keyMilestones = [] } = params;
    if (!epochName || epochName.trim().length === 0) throw new Error('Epoch name cannot be empty');
    if (!summary || summary.trim().length === 0) throw new Error('Epoch summary cannot be empty');

    const now = new Date().toISOString();
    const current = this.repo.getCurrentEpoch();
    if (current && current.endedAt === null) {
      current.endedAt = now;
      this.repo.saveEpoch(current);
    }

    const newEpoch: DevelopmentEpoch = {
      id: `epoch_${crypto.randomUUID()}`,
      epochName: epochName.trim(),
      summary: summary.trim(),
      keyMilestones,
      startedAt: now,
      endedAt: null,
    };

    this.repo.saveEpoch(newEpoch);
    this.logger.info(`Transitioned to new psychological development epoch: "${epochName}"`);
    return newEpoch;
  }

  public getDevelopmentOverview(): PsychologicalDevelopmentOverview {
    const currentEpoch = this.repo.getCurrentEpoch() || {
      id: 'epoch_default',
      epochName: 'Continuous Partnership Growth',
      summary:
        'Ongoing adaptive development of personality, interests, values, and cognitive paradigms.',
      keyMilestones: [],
      startedAt: new Date().toISOString(),
      endedAt: null,
    };

    const anchors = this.repo.listIdentityAnchors();
    const avgStability =
      anchors.length > 0
        ? anchors.reduce((acc, a) => acc + a.stabilityWeight, 0) / anchors.length
        : 0.98;

    const recentHistory = this.repo.listHistoryEntries(undefined, 50);
    const totalChanges = this.repo.countHistoryEntries();

    const changesByDimension: Record<string, number> = {
      interest: 0,
      preference: 0,
      personality: 0,
      value: 0,
      emotional_learning: 0,
      reasoning: 0,
      goal: 0,
      habit: 0,
    };

    for (const item of recentHistory) {
      const dim = item.dimension;
      changesByDimension[dim] = (changesByDimension[dim] ?? 0) + 1;
    }

    const avgPlasticity =
      recentHistory.length > 0
        ? recentHistory.reduce((acc, h) => acc + h.plasticityScore, 0) / recentHistory.length
        : 0.2;

    const startedEpochTime = new Date(currentEpoch.startedAt).getTime();
    const nowTime = Date.now();
    const daysEvolving = Number(
      Math.max(0, (nowTime - startedEpochTime) / (1000 * 60 * 60 * 24)).toFixed(1),
    );

    return {
      currentEpoch,
      overallPlasticityIndex: Number(avgPlasticity.toFixed(3)),
      identityStabilityScore: Number(avgStability.toFixed(3)),
      anchors,
      recentHistory,
      evolutionMetrics: {
        totalChangesLogged: totalChanges,
        changesByDimension,
        daysEvolving,
      },
    };
  }

  public listHistory(
    dimension?: PsychologicalDimension,
    limit: number = 50,
  ): DevelopmentHistoryEntry[] {
    return this.repo.listHistoryEntries(dimension, limit);
  }

  public listEpochs(): DevelopmentEpoch[] {
    return this.repo.listEpochs();
  }

  public listIdentityAnchors(): IdentityAnchor[] {
    return this.repo.listIdentityAnchors();
  }
}
