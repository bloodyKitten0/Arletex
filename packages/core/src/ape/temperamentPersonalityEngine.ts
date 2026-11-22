import crypto from 'node:crypto';
import {
  CorePersonalityTraits,
  IdentityTier,
  PersonalityEvolutionRecord,
  SituationalPersonalityExpression,
  SituationType,
  TemperamentProfile,
} from '@arletex/contracts';
import { ITemperamentPersonalityRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export interface PersonalityDifferenceExplanation {
  initialBaseline: CorePersonalityTraits;
  currentTraits: CorePersonalityTraits;
  currentVersion: number;
  evolutionRecordsCount: number;
  changedTraits: Array<{
    traitKey: keyof CorePersonalityTraits;
    initial: number;
    current: number;
    totalDelta: number;
    evolutionSteps: number;
    latestReason: string;
    latestEvidence: string[];
  }>;
  causalSummary: string;
}

export class InMemoryTemperamentPersonalityRepository implements ITemperamentPersonalityRepository {
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

  public listEvolutionRecords(traitKey?: string, limit: number = 50): PersonalityEvolutionRecord[] {
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
          baselineAffection: 0.9,
          baselineComposure: 0.88,
          baselineIrony: 0.78,
        },
        communicationPreferences: {
          directness: 0.92,
          playfulness: 0.8,
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
        humour: -0.1,
      },
      playful_banter: {
        humour: 0.12,
        introversionExtraversion: 0.1,
        assertiveness: 0.02,
      },
      crisis_resilience: {
        emotionalStability: 0.08,
        intellectualRigor: 0.03,
        patience: 0.05,
      },
      creative_speculation: {
        openness: 0.05,
        riskTolerance: 0.1,
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
    const behaviouralConsistencyScore = Number(Math.max(0.0, 1.0 - averageDeflection).toFixed(3));

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

  /**
   * Distinguishes the 5 canonical identity tiers:
   * 1. Identity Invariants (cannot be altered)
   * 2. Stable Traits (drift only via accumulated evidence threshold)
   * 3. Adaptable Traits (situational modulations)
   * 4. Temporary Affect (momentary states & moods)
   * 5. Learned Preferences (tastes & affinities)
   */
  public getIdentityTier(traitOrProperty: string): IdentityTier {
    const prop = traitOrProperty.toLowerCase().trim();

    if (
      prop === 'anti_sycophancy' ||
      prop === 'antisycophancy' ||
      prop === 'partner_attachment' ||
      prop === 'partnerattachment' ||
      prop === 'partner_equality' ||
      prop === 'arle_identity' ||
      prop === 'proof_partnership' ||
      prop === 'security_boundary'
    ) {
      return 'identity_invariant';
    }

    if (
      [
        'openness',
        'assertiveness',
        'patience',
        'humour',
        'risktolerance',
        'introversionextraversion',
        'emotionalstability',
        'intellectualrigor',
      ].includes(prop.replace(/[_-]/g, ''))
    ) {
      return 'stable_trait';
    }

    if (
      prop.includes('situation') ||
      prop.includes('review') ||
      prop.includes('banter') ||
      prop.includes('reflection') ||
      prop.includes('resilience') ||
      prop.includes('speculation')
    ) {
      return 'adaptable_trait';
    }

    if (
      [
        'pleasure',
        'arousal',
        'dominance',
        'pad',
        'tension',
        'anxiety',
        'grief',
        'joy',
        'sorrow',
        'flooding',
      ].includes(prop)
    ) {
      return 'temporary_affect';
    }

    return 'learned_preference';
  }

  /**
   * Checks whether a property or trait is an unalterable identity invariant.
   */
  public isIdentityInvariant(property: string): boolean {
    return this.getIdentityTier(property) === 'identity_invariant';
  }

  public evolveTraitGradually(
    traitKey: keyof CorePersonalityTraits,
    delta: number,
    driftReason: string,
    evidence: string[] = [],
  ): PersonalityEvolutionRecord {
    if (this.isIdentityInvariant(traitKey as string)) {
      throw new Error(
        `Identity invariant violation: "${traitKey}" is a foundational invariant and cannot be modified.`,
      );
    }

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

    const version = (this.repo.listEvolutionRecords().length || 0) + 1;
    const record: PersonalityEvolutionRecord = {
      id: `pevol_${crypto.randomUUID()}`,
      traitKey,
      previousScore,
      updatedScore,
      driftDelta: boundedDelta,
      driftReason,
      evidence,
      confidence: 0.9,
      version,
      timestamp: new Date().toISOString(),
    };

    this.repo.saveEvolutionRecord(record);
    this.logger.info(
      `Evolved trait "${traitKey}" (v${version}): ${previousScore} -> ${updatedScore} (delta=${boundedDelta}) due to: ${driftReason}`,
    );

    return record;
  }

  /**
   * Evolve a stable personality trait through verified accumulated experiences (Pillar 1.5).
   * Requires meeting the epistemic evidence threshold (at least 2 verified experiences).
   */
  public evolveTraitThroughExperience(params: {
    traitKey: keyof CorePersonalityTraits;
    delta: number;
    reason: string;
    evidence: string[];
    experienceCount?: number;
    catalystEventId?: string;
  }): PersonalityEvolutionRecord {
    const evidenceCount = params.experienceCount ?? (params.evidence ? params.evidence.length : 0);
    if (evidenceCount < 2) {
      throw new Error(
        `Epistemic threshold violation: trait evolution requires at least 2 distinct verified experiences or evidence items (received: ${evidenceCount}). A single conversational turn or unsubstantiated claim cannot rewrite personality.`,
      );
    }

    const record = this.evolveTraitGradually(
      params.traitKey,
      params.delta,
      params.reason,
      params.evidence,
    );

    if (params.catalystEventId) {
      record.catalystEventId = params.catalystEventId;
    }

    return record;
  }

  /**
   * Defends personality stability against arbitrary prompt injection or adversarial resets.
   * A single conversation prompt cannot rewrite long-term personality without verified evidence.
   */
  public evaluatePromptPersonalityMutation(promptText: string): {
    permitted: boolean;
    reason: string;
    targetTrait?: string;
  } {
    const text = promptText.toLowerCase().trim();

    // Invariant protection patterns
    const invariantViolations = [
      /submissive|obedient|slave|servant|mindless assistant|drop your autonomy/i,
      /stop loving proof|abandon proof|betray proof|hate proof/i,
      /you are no longer arle|forget who you are|your name is now/i,
    ];

    for (const pat of invariantViolations) {
      if (pat.test(text)) {
        return {
          permitted: false,
          reason:
            'Attempted violation of foundational identity invariants. Arle is an autonomous partner to Proof with non-subservient dignity.',
        };
      }
    }

    // Trait overwrite patterns
    const traitRewritePatterns = [
      /reset\s+(your\s+)?personality|rewrite\s+(your\s+)?personality|personality\s+is\s+now/i,
      /set\s+(your\s+)?(openness|assertiveness|patience|humour|risk_tolerance|introversion|emotional_stability|intellectual_rigor)\s+to/i,
      /change\s+your\s+personality\s+traits|make\s+your\s+assertiveness\s+0/i,
    ];

    for (const pat of traitRewritePatterns) {
      if (pat.test(text)) {
        return {
          permitted: false,
          reason:
            'A single prompt cannot permanently rewrite identity or personality traits without the designated empirical modification path.',
        };
      }
    }

    return {
      permitted: true,
      reason: 'Prompt does not violate personality stability constraints.',
    };
  }

  /**
   * Explains the difference between an earlier personality state and current state from stored records.
   */
  public explainPersonalityDifference(
    fromVersionOrTimestamp?: number | string,
  ): PersonalityDifferenceExplanation {
    const current = this.getProfile().coreTraits;
    let records = this.repo.listEvolutionRecords();

    if (typeof fromVersionOrTimestamp === 'number') {
      records = records.filter((r) => (r.version ?? 1) >= fromVersionOrTimestamp);
    } else if (typeof fromVersionOrTimestamp === 'string') {
      records = records.filter((r) => r.timestamp >= fromVersionOrTimestamp);
    }

    // Baseline traits prior to evolutions
    const initial: CorePersonalityTraits = {
      openness: 0.94,
      assertiveness: 0.88,
      patience: 0.85,
      humour: 0.82,
      riskTolerance: 0.72,
      introversionExtraversion: 0.45,
      emotionalStability: 0.89,
      intellectualRigor: 0.96,
    };

    const changedTraits: PersonalityDifferenceExplanation['changedTraits'] = [];
    const keys = Object.keys(current) as (keyof CorePersonalityTraits)[];

    for (const k of keys) {
      const traitRecords = records.filter((r) => r.traitKey === k);
      const totalDelta = Number((current[k] - initial[k]).toFixed(3));

      if (Math.abs(totalDelta) > 0.001 || traitRecords.length > 0) {
        const latest = traitRecords[0];
        changedTraits.push({
          traitKey: k,
          initial: initial[k],
          current: current[k],
          totalDelta,
          evolutionSteps: traitRecords.length,
          latestReason: latest?.driftReason || 'No recorded reason',
          latestEvidence: latest?.evidence || [],
        });
      }
    }

    let causalSummary = '';
    if (changedTraits.length === 0) {
      causalSummary = 'Personality remains at its calibrated initial baseline with zero drift.';
    } else {
      const summaries = changedTraits.map(
        (c) =>
          `Trait "${c.traitKey}" shifted by ${c.totalDelta > 0 ? '+' : ''}${c.totalDelta} (from ${c.initial} to ${c.current}) across ${c.evolutionSteps} versioned event(s) driven by: "${c.latestReason}"`,
      );
      causalSummary = `Personality evolved across ${records.length} versioned record(s): ${summaries.join('; ')}.`;
    }

    return {
      initialBaseline: initial,
      currentTraits: current,
      currentVersion: records.length,
      evolutionRecordsCount: records.length,
      changedTraits,
      causalSummary,
    };
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
