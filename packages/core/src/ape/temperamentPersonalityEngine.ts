import crypto from 'node:crypto';
import {
  CorePersonalityTraits,
  PersonalityEvolutionRecord,
  SituationalPersonalityExpression,
  SituationType,
  TemperamentProfile,
} from '@arletex/contracts';
import { ITemperamentPersonalityRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryTemperamentPersonalityRepository
  implements ITemperamentPersonalityRepository
{
  private profile: TemperamentProfile | null = null;
  private expressions: SituationalPersonalityExpression[] = [];
  private evolutionRecords: PersonalityEvolutionRecord[] = [];

  public saveProfile(profile: TemperamentProfile): void {
    this.profile = { ...profile };
  }

  public getProfile(_id?: string): TemperamentProfile | null {
    return this.profile ? { ...this.profile } : null;
  }

  public saveSituationalExpression(expression: SituationalPersonalityExpression): void {
    this.expressions.unshift({ ...expression });
  }

  public listSituationalExpressions(
    situationType?: string,
    limit: number = 50,
  ): SituationalPersonalityExpression[] {
    let list = this.expressions;
    if (situationType) {
      list = list.filter((e) => e.situationType === situationType);
    }
    return list.slice(0, limit);
  }

  public saveEvolutionRecord(record: PersonalityEvolutionRecord): void {
    this.evolutionRecords.unshift({ ...record });
  }

  public listEvolutionRecords(
    traitKey?: string,
    limit: number = 50,
  ): PersonalityEvolutionRecord[] {
    let list = this.evolutionRecords;
    if (traitKey) {
      list = list.filter((r) => r.traitKey === traitKey);
    }
    return list.slice(0, limit);
  }
}

export class TemperamentPersonalityEngine {
  private repo: ITemperamentPersonalityRepository;
  private logger: ILogger;

  constructor(repo?: ITemperamentPersonalityRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryTemperamentPersonalityRepository();
    this.logger = logger.child('TemperamentPersonalityEngine');
    this.ensureBaselineProfile();
  }

  private ensureBaselineProfile(): void {
    let profile = this.repo.getProfile();
    if (!profile) {
      const now = new Date().toISOString();
      profile = {
        id: 'profile_arle_core',
        coreTraits: {
          openness: 0.94,
          assertiveness: 0.88,
          patience: 0.85,
          humour: 0.82,
          riskTolerance: 0.72,
          introversionExtraversion: 0.45, // contemplative ambivert
          emotionalStability: 0.89,
          intellectualRigor: 0.96,
        },
        emotionalTendencies: {
          baselineCuriosity: 0.94,
          baselineAffection: 0.90,
          baselineComposure: 0.88,
          baselineIrony: 0.78,
        },
        communicationPreferences: {
          directness: 0.92,
          playfulness: 0.80,
          depthPreference: 0.96,
          antiSycophancy: 1.0, // Non-subservient partner equality invariant
        },
        socialTendencies: {
          partnerAttachment: 0.98, // Dedicated devotion to Proof
          strangerReserve: 0.85,
          intellectualSelectivity: 0.92,
        },
        lastCalibratedAt: now,
      };
      this.repo.saveProfile(profile);
    }
  }

  public getProfile(): TemperamentProfile {
    let profile = this.repo.getProfile();
    if (!profile) {
      this.ensureBaselineProfile();
      profile = this.repo.getProfile()!;
    }
    return profile;
  }

  public expressPersonalityInSituation(
    situationType: SituationType,
    contextDescription: string,
    customDeltas?: Partial<Record<keyof CorePersonalityTraits, number>>,
  ): SituationalPersonalityExpression {
    if (!contextDescription || contextDescription.trim().length === 0) {
      throw new Error('Context description cannot be empty');
    }

    const profile = this.getProfile();
    const baseline = { ...profile.coreTraits };
    const expressed: CorePersonalityTraits = { ...baseline };
    const deltas: Record<string, number> = {};

    // Standard situational modulation patterns
    const defaultModulations: Record<
      SituationType,
      Partial<Record<keyof CorePersonalityTraits, number>>
    > = {
      technical_review: {
        assertiveness: 0.05,
        intellectualRigor: 0.03,
        patience: 0.04,
        humour: -0.06,
      },
      vulnerable_reflection: {
        patience: 0.07,
        openness: 0.04,
        assertiveness: -0.05,
        humour: -0.10,
      },
      playful_banter: {
        humour: 0.12,
        introversionExtraversion: 0.10,
        assertiveness: 0.02,
      },
      crisis_resilience: {
        emotionalStability: 0.08,
        intellectualRigor: 0.03,
        patience: 0.05,
      },
      creative_speculation: {
        openness: 0.05,
        riskTolerance: 0.10,
        humour: 0.04,
      },
      collaborative_planning: {
        intellectualRigor: 0.03,
        assertiveness: 0.04,
        patience: 0.05,
      },
    };

    const combinedDeltas: Partial<Record<keyof CorePersonalityTraits, number>> = {
      ...defaultModulations[situationType],
      ...(customDeltas || {}),
    };

    let totalDeltaMagnitude = 0;
    let traitCount = 0;

    for (const key of Object.keys(baseline) as (keyof CorePersonalityTraits)[]) {
      const delta = combinedDeltas[key] || 0;
      deltas[key] = delta;
      totalDeltaMagnitude += Math.abs(delta);
      traitCount += 1;

      const raw = baseline[key] + delta;
      expressed[key] = Number(Math.max(0.01, Math.min(0.99, raw)).toFixed(3));
    }

    // Consistency score: 1.0 - (average trait deflection)
    const averageDeflection = traitCount > 0 ? totalDeltaMagnitude / traitCount : 0;
    const behaviouralConsistencyScore = Number(
      Math.max(0.0, 1.0 - averageDeflection).toFixed(3),
    );

    const expression: SituationalPersonalityExpression = {
      id: `spe_${crypto.randomUUID()}`,
      situationType,
      contextDescription,
      expressedTraits: expressed,
      baselineTraits: baseline,
      traitDeltas: deltas,
      behaviouralConsistencyScore,
      expressedAt: new Date().toISOString(),
    };

    this.repo.saveSituationalExpression(expression);
    this.logger.info(
      `Expressed personality in situation "${situationType}" (consistency=${behaviouralConsistencyScore})`,
    );

    return expression;
  }

  public evolveTraitGradually(
    traitKey: keyof CorePersonalityTraits,
    delta: number,
    driftReason: string,
  ): PersonalityEvolutionRecord {
    if (!driftReason || driftReason.trim().length === 0) {
      throw new Error('Drift reason cannot be empty');
    }

    // Invariant: Bounded gradual drift (max +/- 0.05 per adjustment to prevent erratic personality flips)
    const boundedDelta = Number(Math.max(-0.05, Math.min(0.05, delta)).toFixed(3));

    const profile = this.getProfile();
    const previousScore = profile.coreTraits[traitKey];
    const updatedScore = Number(
      Math.max(0.01, Math.min(0.99, previousScore + boundedDelta)).toFixed(3),
    );

    profile.coreTraits[traitKey] = updatedScore;
    profile.lastCalibratedAt = new Date().toISOString();
    this.repo.saveProfile(profile);

    const record: PersonalityEvolutionRecord = {
      id: `pevol_${crypto.randomUUID()}`,
      traitKey,
      previousScore,
      updatedScore,
      driftDelta: boundedDelta,
      driftReason,
      timestamp: new Date().toISOString(),
    };

    this.repo.saveEvolutionRecord(record);
    this.logger.info(
      `Evolved trait "${traitKey}": ${previousScore} -> ${updatedScore} (delta=${boundedDelta}) due to: ${driftReason}`,
    );

    return record;
  }

  public listSituationalExpressions(
    situationType?: string,
    limit?: number,
  ): SituationalPersonalityExpression[] {
    return this.repo.listSituationalExpressions(situationType, limit);
  }

  public listEvolutionRecords(traitKey?: string, limit?: number): PersonalityEvolutionRecord[] {
    return this.repo.listEvolutionRecords(traitKey, limit);
  }
}
