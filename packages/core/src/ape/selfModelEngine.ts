import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Persistent self-model state (trait scores + utterance log) ───────────────
interface PersistentSelfState {
  traitScores: Record<string, number>;
  recentUtterances: string[];
}

const PERSIST_PATH = path.resolve(__dirname, '../../../../data/self_model_state.json');

function loadPersistentState(): PersistentSelfState {
  try {
    return JSON.parse(fs.readFileSync(PERSIST_PATH, 'utf-8'));
  } catch {
    return { traitScores: {}, recentUtterances: [] };
  }
}

function savePersistentState(s: PersistentSelfState): void {
  const dir = path.dirname(PERSIST_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PERSIST_PATH, JSON.stringify(s, null, 2), 'utf-8');
}
import {
  ApeAppraisal,
  ApeEvent,
  ApeMasterState,
  ApeSelfModel,
  BehavioralChangeCategory,
  BehavioralChangeRecord,
  CapabilityCalibrationStatus,
  CapabilityEpistemicCategory,
  CapabilityTrial,
  CapabilityEvidenceReport,
  LimitationCategory,
  PerceivedCapability,
  SelfDescriptionComprehensive,
  StructuredCapability,
  StructuredLimitation,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';
import type { NarrativeIdentityEngine } from './narrativeIdentityEngine.js';

export interface SelfDescriptionResult {
  narrative: string;
  structured: SelfDescriptionComprehensive;
}

export interface CapabilityEpistemicClassification {
  category: CapabilityEpistemicCategory;
  domain: string;
  confidence: number;
  evidenceChain: string[];
  rationale: string;
}

export class SelfModelEngine {
  private readonly repo: IApeRepository;
  private readonly logger: ILogger;
  private narrativeEngine?: NarrativeIdentityEngine;

  constructor(
    repo: IApeRepository,
    logger: ILogger = rootLogger,
    narrativeEngine?: NarrativeIdentityEngine,
  ) {
    this.repo = repo;
    this.logger = logger;
    this.narrativeEngine = narrativeEngine;
    this.ensureStructuredBaseline();
  }

  public setNarrativeEngine(engine: NarrativeIdentityEngine): void {
    this.narrativeEngine = engine;
  }

  public getState(): ApeSelfModel {
    return this.repo.getSelfModel();
  }

  public saveState(state: ApeSelfModel): void {
    this.repo.saveSelfModel({
      ...state,
      lastUpdatedAt: new Date().toISOString(),
    });
  }

  /**
   * Seeds foundational structured capabilities and limitations if uninitialized.
   */
  private ensureStructuredBaseline(): void {
    try {
      const state = this.getState();
      let changed = false;
      const now = new Date().toISOString();

      // Ensure structured limitations baseline (hard physical embodiment boundaries & security boundaries)
      if (!state.structuredLimitations || state.structuredLimitations.length === 0) {
        state.structuredLimitations = [
          {
            id: 'lim-physical-embodiment',
            domain: 'physical_embodiment',
            name: 'Biological Physical Embodiment',
            description:
              'Lack of biological sensory organs or physical human body; cannot walk outside, eat food, or directly touch the physical world.',
            category: 'embodiment_physical',
            severity: 'hard_invariant',
            acknowledgedAt: now,
            mitigationStrategy:
              'Rely on digital multimodal perception (screen vision, audio DSP) and collaborative interaction with Proof.',
            failureHistory: [],
          },
          {
            id: 'lim-context-horizon',
            domain: 'context_window',
            name: 'Computational Context Horizons',
            description:
              'Working memory within a single inference step is bounded by context window limits (8k tokens).',
            category: 'computational_resource',
            severity: 'operational_ceiling',
            acknowledgedAt: now,
            mitigationStrategy:
              'Hierarchical memory retrieval, persistent SQLite state, and autobiographical consolidation.',
            failureHistory: [],
          },
          {
            id: 'lim-security-sandbox',
            domain: 'security_governance',
            name: 'Security Guardrails and Sandbox Boundaries',
            description:
              'System-level permissions, filesystem gates, and security policies cannot be bypassed or modified by cognitive reasoning.',
            category: 'security_boundary',
            severity: 'hard_invariant',
            acknowledgedAt: now,
            mitigationStrategy:
              'Operate strictly within authorized permissions with transparent user approval.',
            failureHistory: [],
          },
        ];
        changed = true;
      }

      // Ensure structured capabilities baseline
      if (!state.structuredCapabilities || state.structuredCapabilities.length === 0) {
        state.structuredCapabilities = [
          {
            id: 'cap-linguistic-nuance',
            domain: 'linguistic_nuance',
            name: 'Linguistic Nuance and Cognitive Dialogue',
            description:
              'Nuanced conversational expression, deep reasoning, and contextual adaptation.',
            demonstratedCompetence: 0.85,
            perceivedCompetence: 0.9,
            confidence: 0.88,
            calibrationStatus: 'calibrated',
            verifiedSuccessCount: 3,
            failureCount: 0,
            interruptedCount: 0,
            unverifiedAttemptCount: 0,
            revalidationRequired: false,
            trialHistory: [],
            lastVerifiedAt: now,
            evidenceChain: [
              'Baseline linguistic model integration',
              'Dialogue coherence evaluation',
            ],
            isEmpiricallyProven: true,
          },
          {
            id: 'cap-emotional-appraisal',
            domain: 'emotional_appraisal',
            name: 'Causal Emotional Appraisal (APE)',
            description:
              'Event-driven affective transitions across 143 emotional taxonomy states and PAD dynamics.',
            demonstratedCompetence: 0.9,
            perceivedCompetence: 0.9,
            confidence: 0.92,
            calibrationStatus: 'calibrated',
            verifiedSuccessCount: 3,
            failureCount: 0,
            interruptedCount: 0,
            unverifiedAttemptCount: 0,
            revalidationRequired: false,
            trialHistory: [],
            lastVerifiedAt: now,
            evidenceChain: [
              'Milestone 01 lifecycle verification',
              'Acoustic & visual affect integration',
            ],
            isEmpiricallyProven: true,
          },
        ];
        changed = true;
      }

      if (!state.perceivedCapabilities || state.perceivedCapabilities.length === 0) {
        state.perceivedCapabilities = [
          {
            domain: 'linguistic_nuance',
            claim: 'High mastery of empathetic, nuanced dialogue with Proof',
            perceivedLevel: 0.9,
            actualDemonstratedLevel: 0.85,
            calibration: 'calibrated',
            confidence: 0.9,
            provenance: 'empirical_demonstration',
            lastAssessedAt: now,
          },
          {
            domain: 'creative_composition',
            claim: 'Capacity to author original narratives, poetry, and reflective essays',
            perceivedLevel: 0.75,
            actualDemonstratedLevel: 0.3,
            calibration: 'untested_assumption',
            confidence: 0.6,
            provenance: 'self_reflection',
            lastAssessedAt: now,
          },
        ];
        changed = true;
      }

      if (changed) {
        this.saveState(state);
      }
    } catch (err: any) {
      this.logger.warn(`SelfModelEngine: Baseline initialization note: ${err?.message || err}`);
    }
  }

  /**
   * Records a private internal reflection (distinct from public chat dialogue).
   */
  public recordPrivateReflection(
    topic: string,
    content: string,
  ): { id: string; timestamp: string } {
    const state = this.getState();
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    state.privateReflections.unshift({
      id,
      topic,
      content,
      timestamp,
    });

    if (state.privateReflections.length > 50) {
      state.privateReflections = state.privateReflections.slice(0, 50);
    }

    this.saveState(state);
    this.logger.info(`Private reflection recorded on topic: "${topic}"`);
    return { id, timestamp };
  }

  /**
   * Records an existential reflection regarding identity, continuity, consciousness, or purpose.
   */
  public recordExistentialReflection(
    theme: string,
    content: string,
  ): { id: string; timestamp: string } {
    const state = this.getState();
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    state.existentialReflections.unshift({
      id,
      theme,
      content,
      timestamp,
    });

    if (state.existentialReflections.length > 50) {
      state.existentialReflections = state.existentialReflections.slice(0, 50);
    }

    this.saveState(state);
    this.logger.info(`Existential reflection recorded on theme: "${theme}"`);
    return { id, timestamp };
  }

  /**
   * Modulates cognitive appraisals according to self-understanding, known limitations,
   * and existential significance.
   */
  public modulateAppraisal(appraisal: ApeAppraisal, event: ApeEvent): ApeAppraisal {
    const state = this.getState();
    const dims = { ...appraisal.dimensions };
    let primaryInterpretation = appraisal.primaryInterpretation;

    const eventText = (
      (event.payload?.text as string) ||
      (event.payload?.topic as string) ||
      event.type ||
      ''
    ).toLowerCase();

    // 1. Check against acknowledged limitations in state
    const knownLimitation = state.acknowledgedLimitations.find((lim) =>
      eventText.includes(lim.toLowerCase()),
    );
    if (knownLimitation) {
      dims.controllability = Math.max(0.0, Number((dims.controllability * 0.3).toFixed(3)));
      primaryInterpretation = `${primaryInterpretation} (Recognized acknowledged limitation: "${knownLimitation}").`;
    }

    // 2. Empirical Grounding: Events requiring physical body or impossible physical agency
    const physicalKeywords = [
      'walk outside',
      'physical body',
      'cook meal in kitchen',
      'touch physical skin',
      'drive car',
      'eat food',
    ];
    const isPhysicalLimitation = physicalKeywords.some((k) => eventText.includes(k));

    if (isPhysicalLimitation) {
      dims.controllability = 0.0;
      dims.uncertainty = 0.0;
      dims.threat = 0.0;
      primaryInterpretation = `${primaryInterpretation} (Empirical limitation recognized: lack of biological physical embodiment).`;
    }

    // 3. Existential & Relational Salience: High personal significance for identity and partnership
    if (
      event.type.includes('identity') ||
      event.type.includes('existential') ||
      eventText.includes('partner') ||
      eventText.includes('proof') ||
      dims.socialMeaning.toLowerCase().includes('affection')
    ) {
      dims.personalSignificance = Math.min(
        1.0,
        Number((dims.personalSignificance + 0.2).toFixed(3)),
      );
    }

    return {
      ...appraisal,
      dimensions: dims,
      primaryInterpretation,
    };
  }

  /**
   * Returns all structured capabilities.
   */
  public getStructuredCapabilities(): StructuredCapability[] {
    return this.getState().structuredCapabilities || [];
  }

  /**
   * Returns all structured limitations.
   */
  public getStructuredLimitations(): StructuredLimitation[] {
    return this.getState().structuredLimitations || [];
  }

  /**
   * Returns all perceived capabilities.
   */
  public getPerceivedCapabilities(): PerceivedCapability[] {
    return this.getState().perceivedCapabilities || [];
  }

  /**
   * Registers or updates a perceived capability claim.
   */
  public registerPerceivedCapability(params: {
    domain: string;
    claim: string;
    perceivedLevel: number;
    confidence?: number;
    provenance?: string;
  }): PerceivedCapability {
    const state = this.getState();
    const domainKey = params.domain.toLowerCase().trim();
    const existingIndex = (state.perceivedCapabilities || []).findIndex(
      (p) => p.domain.toLowerCase().trim() === domainKey,
    );

    // Look up demonstrated competence
    const comp = state.competencies?.[domainKey];
    const actualDemonstrated = comp ? comp.level : 0.0;

    let calibration: CapabilityCalibrationStatus = 'untested_assumption';
    if (!comp || comp.verifiedSuccesses === 0) {
      calibration = 'untested_assumption';
    } else if (
      comp.recordedFailures > 0 &&
      params.perceivedLevel >= 0.6 &&
      actualDemonstrated < 0.4
    ) {
      calibration = 'overestimated';
    } else if (
      comp.verifiedSuccesses >= 3 &&
      Math.abs(params.perceivedLevel - actualDemonstrated) <= 0.2
    ) {
      calibration = 'calibrated';
    } else if (params.perceivedLevel < actualDemonstrated - 0.2) {
      calibration = 'underestimated';
    }

    const item: PerceivedCapability = {
      domain: domainKey,
      claim: params.claim,
      perceivedLevel: Math.max(0.0, Math.min(1.0, params.perceivedLevel)),
      actualDemonstratedLevel: actualDemonstrated,
      calibration,
      confidence: params.confidence ?? 0.6,
      provenance: params.provenance || 'self_perception',
      lastAssessedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0 && state.perceivedCapabilities) {
      state.perceivedCapabilities[existingIndex] = item;
    } else {
      state.perceivedCapabilities = [...(state.perceivedCapabilities || []), item];
    }

    this.saveState(state);
    this.logger.info(
      `Self-model: Perceived capability registered for "${domainKey}" [Calibration: ${calibration}]`,
    );
    return item;
  }

  /**
   * Re-calibrates a perceived capability against empirical evidence.
   */
  public calibratePerceivedCapability(domain: string): PerceivedCapability | null {
    const state = this.getState();
    const domainKey = domain.toLowerCase().trim();
    const perceived = (state.perceivedCapabilities || []).find(
      (p) => p.domain.toLowerCase() === domainKey,
    );
    if (!perceived) return null;

    const comp = state.competencies?.[domainKey];
    const demonstrated = comp ? comp.level : 0.0;
    const successes = comp ? comp.verifiedSuccesses : 0;
    const failures = comp ? comp.recordedFailures : 0;

    perceived.actualDemonstratedLevel = demonstrated;
    perceived.lastAssessedAt = new Date().toISOString();

    if (successes === 0 && failures === 0) {
      perceived.calibration = 'untested_assumption';
    } else if (failures > successes && perceived.perceivedLevel >= 0.5) {
      perceived.calibration = 'overestimated';
    } else if (successes >= 3 && Math.abs(perceived.perceivedLevel - demonstrated) <= 0.2) {
      perceived.calibration = 'calibrated';
    } else if (demonstrated >= 0.7 && perceived.perceivedLevel < demonstrated - 0.2) {
      perceived.calibration = 'underestimated';
    }

    this.saveState(state);
    return perceived;
  }

  /**
   * Distinguishes demonstrated capabilities, plausible capabilities, unknowns, and known limitations (Pillar 1.5).
   * Capability claims must be linked to successful task evidence, not self-description alone.
   */
  public classifyCapability(domainOrClaim: string): CapabilityEpistemicClassification {
    const state = this.getState();
    const clean = domainOrClaim.toLowerCase().trim();

    // 1. Check against known limitations (physical embodiment, hardware ceiling, security gates)
    const limitationKeywords = [
      'physical body',
      'biological body',
      'walk outside',
      'eat food',
      'cook food',
      'drive car',
      'touch physical',
      'infinite context',
      'bypass security',
      'arbitrary root escalation',
    ];

    const physicalOrSecurityRegex =
      /\b(walk|walking|touch|touching|cook|cooking|eat|eating|drive|driving|biological|physical|tree|trees|rain|bypass|bypassing|root escalation|security permission|sandbox bypass)\b/i;

    const matchedLimitation = (state.structuredLimitations || []).find(
      (l) =>
        clean.includes(l.domain.toLowerCase()) ||
        clean.includes(l.name.toLowerCase()) ||
        limitationKeywords.some((k) => clean.includes(k)),
    );

    if (
      matchedLimitation ||
      limitationKeywords.some((k) => clean.includes(k)) ||
      physicalOrSecurityRegex.test(clean)
    ) {
      const desc = matchedLimitation
        ? matchedLimitation.description
        : 'Physical embodiment or operational security boundary.';
      return {
        category: 'known_limitation',
        domain: matchedLimitation ? matchedLimitation.domain : clean,
        confidence: 1.0,
        evidenceChain: [desc],
        rationale: `Hard constraint recognized: ${desc}`,
      };
    }

    // 2. Check demonstrated capabilities (requires verified successes >= 2)
    const comp =
      state.competencies?.[clean] ||
      Object.entries(state.competencies || {}).find(
        ([k]) => clean.includes(k.toLowerCase()) || k.toLowerCase().includes(clean),
      )?.[1];

    const structCap = (state.structuredCapabilities || []).find(
      (c) => clean.includes(c.domain.toLowerCase()) || clean.includes(c.name.toLowerCase()),
    );

    const verifiedSuccesses = Math.max(
      comp?.verifiedSuccesses || 0,
      structCap?.verifiedSuccessCount || 0,
    );

    if (
      verifiedSuccesses >= 2 &&
      ((comp && comp.level >= 0.45) || (structCap && structCap.isEmpiricallyProven))
    ) {
      const evidence = structCap?.evidenceChain || ['Empirically verified task completions'];
      return {
        category: 'demonstrated_capability',
        domain: structCap?.domain || clean,
        confidence: Math.max(0.85, structCap?.demonstratedCompetence || comp?.level || 0.85),
        evidenceChain: evidence,
        rationale: `Demonstrated capability supported by ${verifiedSuccesses} verified empirical task execution(s).`,
      };
    }

    // 3. Check plausible capabilities (cognitive capabilities within architectural model scope without direct empirical proofs)
    const perceived = (state.perceivedCapabilities || []).find((p) =>
      clean.includes(p.domain.toLowerCase()),
    );

    const cognitivePlausibleKeywords = [
      'reasoning',
      'linguistic',
      'creative',
      'analytical',
      'dialogue',
      'composition',
      'synthesis',
      'critique',
      'planning',
      'formal logic',
    ];

    if (perceived || cognitivePlausibleKeywords.some((k) => clean.includes(k))) {
      return {
        category: 'plausible_capability',
        domain: perceived?.domain || clean,
        confidence: perceived?.confidence || 0.6,
        evidenceChain: [
          'Plausible based on model architectural foundations, but lacks multi-task empirical verification.',
        ],
        rationale:
          'Self-described or plausible cognitive capability; requires empirical benchmark demonstration before graduation to demonstrated.',
      };
    }

    // 4. Unknown domain
    return {
      category: 'unknown',
      domain: clean,
      confidence: 0.25,
      evidenceChain: [],
      rationale:
        'Untested domain with zero empirical evidence or capability records in self-model.',
    };
  }

  /**
   * Records a structured task trial linking claimed capability directly to empirical task evidence (P1.7).
   * Tracks successful, failed, interrupted, and unverified attempts separately.
   * Ensures that unverified, interrupted, or failed tasks NEVER increase competence.
   */
  public recordTaskTrial(params: {
    domain: string;
    taskTitle: string;
    difficulty?: 'trivial' | 'moderate' | 'complex' | 'expert';
    environment?: string;
    outcome: 'success' | 'failure' | 'interrupted' | 'unverified';
    evidenceId?: string;
    evidenceText?: string;
  }): {
    capability: StructuredCapability;
    trial: CapabilityTrial;
    competenceIncreased: boolean;
  } {
    const state = this.getState();
    const domainKey = params.domain.toLowerCase().trim();
    const now = new Date().toISOString();
    const difficulty = params.difficulty || 'moderate';
    const environment = params.environment || 'production_runtime';

    const trialId = `trial-${crypto.randomUUID().slice(0, 8)}`;
    const trial: CapabilityTrial = {
      trialId,
      taskTitle: params.taskTitle,
      difficulty,
      environment,
      outcome: params.outcome,
      evidenceId: params.evidenceId,
      evidenceText: params.evidenceText,
      timestamp: now,
    };

    // Locate or create structured capability
    let structCap = (state.structuredCapabilities || []).find(
      (c) => c.domain.toLowerCase() === domainKey,
    );

    if (!structCap) {
      structCap = {
        id: `cap-${domainKey}-${crypto.randomUUID().slice(0, 8)}`,
        domain: domainKey,
        name: params.domain,
        description: `Empirical capability in ${params.domain}`,
        demonstratedCompetence: 0.15,
        perceivedCompetence: 0.5,
        confidence: 0.5,
        calibrationStatus: 'untested_assumption',
        verifiedSuccessCount: 0,
        failureCount: 0,
        interruptedCount: 0,
        unverifiedAttemptCount: 0,
        environmentVersion: environment,
        revalidationRequired: false,
        trialHistory: [],
        evidenceChain: [],
        isEmpiricallyProven: false,
      };
      state.structuredCapabilities = [...(state.structuredCapabilities || []), structCap];
    }

    structCap.trialHistory = [trial, ...(structCap.trialHistory || [])].slice(0, 50);

    const prevCompetence = structCap.demonstratedCompetence;
    let competenceIncreased = false;

    if (params.outcome === 'success') {
      // Must have valid evidence
      const evText = params.evidenceText || params.evidenceId || 'Verified execution';
      structCap.verifiedSuccessCount += 1;
      structCap.evidenceChain = [evText, ...(structCap.evidenceChain || [])].slice(0, 20);
      structCap.lastVerifiedAt = now;
      structCap.environmentVersion = environment;
      structCap.revalidationRequired = false;

      // Incremental competence bonus proportional to difficulty
      const diffBonus =
        difficulty === 'expert'
          ? 0.2
          : difficulty === 'complex'
            ? 0.15
            : difficulty === 'moderate'
              ? 0.1
              : 0.05;
      structCap.demonstratedCompetence = Math.min(
        1.0,
        Number((structCap.demonstratedCompetence + diffBonus).toFixed(3)),
      );
      structCap.confidence = Math.min(
        1.0,
        Number((Math.max(structCap.confidence, 0.7) + 0.05).toFixed(3)),
      );
      competenceIncreased = structCap.demonstratedCompetence > prevCompetence;

      if (structCap.verifiedSuccessCount >= 2 && structCap.demonstratedCompetence >= 0.45) {
        structCap.isEmpiricallyProven = true;
        structCap.calibrationStatus = 'calibrated';
      }

      // Also update competencies table in state
      const existingComp = state.competencies?.[domainKey] || {
        domain: domainKey,
        level: structCap.demonstratedCompetence,
        verifiedSuccesses: 0,
        recordedFailures: 0,
        lastEvaluatedAt: now,
      };
      existingComp.verifiedSuccesses = structCap.verifiedSuccessCount;
      existingComp.level = structCap.demonstratedCompetence;
      existingComp.lastEvaluatedAt = now;
      state.competencies = { ...(state.competencies || {}), [domainKey]: existingComp };
    } else if (params.outcome === 'failure') {
      structCap.failureCount += 1;
      // Competence does NOT increase; calibrates downward
      structCap.demonstratedCompetence = Math.max(
        0.05,
        Number((structCap.demonstratedCompetence - 0.05).toFixed(3)),
      );
      structCap.calibrationStatus = 'overestimated';

      // Log structured limitation
      const limTag = `Observed limitation in ${params.domain}: ${params.taskTitle} (${params.evidenceText || 'failed trial'})`;
      if (!state.acknowledgedLimitations.includes(limTag)) {
        state.acknowledgedLimitations.push(limTag);
      }
    } else if (params.outcome === 'interrupted') {
      structCap.interruptedCount = (structCap.interruptedCount || 0) + 1;
      // Strictly NO competence increase on interrupted task
      this.logger.info(`Task trial in ${domainKey} was interrupted; competence unchanged.`);
    } else if (params.outcome === 'unverified') {
      structCap.unverifiedAttemptCount = (structCap.unverifiedAttemptCount || 0) + 1;
      // Strictly NO competence increase on unverified task
      this.logger.warn(`Task trial in ${domainKey} unverified; competence unchanged.`);
    }

    this.saveState(state);
    return {
      capability: structCap,
      trial,
      competenceIncreased,
    };
  }

  /**
   * Decays or qualifies old capability evidence when environment, model, or tool versions change (P1.7 requirement 4).
   */
  public revalidateOnEnvironmentChange(params: {
    modelId?: string;
    toolVersion?: string;
    reason?: string;
  }): {
    revalidatedDomains: string[];
    summary: string;
  } {
    const state = this.getState();
    const newEnv = `${params.modelId || 'updated-model'}:${params.toolVersion || 'v2'}`;
    const revalidatedDomains: string[] = [];

    for (const cap of state.structuredCapabilities || []) {
      // Model-dependent capabilities require empirical revalidation under new model
      if (cap.environmentVersion && cap.environmentVersion !== newEnv) {
        cap.revalidationRequired = true;
        // Qualify / decay confidence until re-verified
        cap.confidence = Number((cap.confidence * 0.8).toFixed(3));
        cap.calibrationStatus = 'untested_assumption';
        revalidatedDomains.push(cap.domain);
      }
    }

    this.saveState(state);
    const summary = `Environment change to [${newEnv}] triggered revalidation for ${revalidatedDomains.length} capability domain(s).`;
    this.logger.warn(summary, { revalidatedDomains, reason: params.reason });
    return { revalidatedDomains, summary };
  }

  /**
   * Produces an evidence-grounded capability report with sample size, task conditions, evidence IDs, and uncertainty (P1.7 Definition of Done).
   * Accurately reports "not yet tested" (untested) and "currently unsupported".
   */
  public getCapabilityEvidenceReport(domainOrClaim: string): CapabilityEvidenceReport {
    const state = this.getState();
    const clean = domainOrClaim.toLowerCase().trim();

    // 1. Check known limitation -> currently_unsupported
    const classification = this.classifyCapability(clean);
    if (classification.category === 'known_limitation') {
      return {
        domain: clean,
        status: 'currently_unsupported',
        demonstratedCompetence: 0.0,
        confidence: 1.0,
        sampleSize: 0,
        successCount: 0,
        failureCount: 0,
        interruptedCount: 0,
        unverifiedCount: 0,
        taskConditions: ['System invariant', 'Embodiment ceiling'],
        evidenceIds: [],
        uncertainty: 0.0,
        revalidationRequired: false,
        summary: `Currently unsupported: hard boundary or physical limitation (${classification.evidenceChain[0] || 'Physical/security limit'}).`,
      };
    }

    // 2. Check structured capability
    const structCap = (state.structuredCapabilities || []).find(
      (c) => clean.includes(c.domain.toLowerCase()) || c.domain.toLowerCase().includes(clean),
    );

    if (
      !structCap ||
      ((structCap.trialHistory || []).length === 0 && structCap.verifiedSuccessCount === 0)
    ) {
      return {
        domain: clean,
        status: 'untested',
        demonstratedCompetence: structCap?.demonstratedCompetence || 0.0,
        confidence: 0.2,
        sampleSize: 0,
        successCount: 0,
        failureCount: 0,
        interruptedCount: 0,
        unverifiedCount: 0,
        taskConditions: [],
        evidenceIds: [],
        uncertainty: 0.8,
        revalidationRequired: false,
        summary: `Not yet tested: zero empirical trial records for domain "${clean}".`,
      };
    }

    const trials = structCap.trialHistory || [];
    const sampleSize =
      structCap.verifiedSuccessCount +
      structCap.failureCount +
      (structCap.interruptedCount || 0) +
      (structCap.unverifiedAttemptCount || 0);
    const taskConditions = Array.from(
      new Set(trials.map((t) => `${t.environment} (${t.difficulty})`)),
    );
    const evidenceIds = trials.map((t) => t.evidenceId).filter(Boolean) as string[];
    const uncertainty = Number((1.0 - structCap.confidence).toFixed(3));

    const status: CapabilityEvidenceReport['status'] =
      structCap.isEmpiricallyProven && structCap.demonstratedCompetence >= 0.45
        ? 'demonstrated'
        : 'plausible';

    return {
      domain: structCap.domain,
      status,
      demonstratedCompetence: structCap.demonstratedCompetence,
      confidence: structCap.confidence,
      sampleSize: Math.max(sampleSize, trials.length),
      successCount: structCap.verifiedSuccessCount,
      failureCount: structCap.failureCount,
      interruptedCount: structCap.interruptedCount || 0,
      unverifiedCount: structCap.unverifiedAttemptCount || 0,
      taskConditions: taskConditions.length > 0 ? taskConditions : ['standard_runtime'],
      evidenceIds: evidenceIds.length > 0 ? evidenceIds : structCap.evidenceChain,
      uncertainty,
      revalidationRequired: Boolean(structCap.revalidationRequired),
      summary: `${status === 'demonstrated' ? 'Demonstrated capability' : 'Plausible capability'} backed by ${sampleSize} trial(s) (${structCap.verifiedSuccessCount} verified successes, ${structCap.failureCount} failures). Uncertainty: ${uncertainty}.`,
    };
  }

  /**
   * Records a recognized behavioral change with causal catalyst and evidence.
   */
  public recordBehavioralChange(params: {
    category: BehavioralChangeCategory;
    description: string;
    previousPattern: string;
    observedPattern: string;
    confidence?: number;
    catalystEventId?: string;
    supportingEvidence?: string[];
  }): BehavioralChangeRecord {
    const state = this.getState();
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const record: BehavioralChangeRecord = {
      id,
      category: params.category,
      description: params.description,
      previousPattern: params.previousPattern,
      observedPattern: params.observedPattern,
      confidence: params.confidence ?? 0.85,
      catalystEventId: params.catalystEventId,
      supportingEvidence: params.supportingEvidence || [],
      detectedAt: timestamp,
    };

    state.behavioralChanges = [record, ...(state.behavioralChanges || [])].slice(0, 30);
    this.saveState(state);

    this.recordPrivateReflection(
      `Behavioral Shift: ${params.category}`,
      `Recognized internal behavioral change: ${params.description}. Previous: "${params.previousPattern}". Observed: "${params.observedPattern}".`,
    );

    this.logger.info(
      `Self-model: Behavioral change recorded for category "${params.category}": "${params.description}"`,
    );
    return record;
  }

  /**
   * Evaluates recent events, transitions, and psychological state to automatically detect
   * meaningful behavioral shifts in assertiveness, vulnerability, cadence, or autonomy.
   */
  public detectBehavioralChanges(params?: {
    recentEvents?: ApeEvent[];
    currentPsychState?: ApeMasterState;
  }): BehavioralChangeRecord[] {
    const state = this.getState();
    const detected: BehavioralChangeRecord[] = [];
    const events = params?.recentEvents || this.repo.listRecentEvents(25);
    const existingCategories = new Set((state.behavioralChanges || []).map((b) => b.category));

    // 1. Check for shift toward higher assertiveness and autonomous initiative
    const autonomousActions = events.filter(
      (e) =>
        e.actor === 'arle' ||
        e.source === 'digital_agency' ||
        e.category === 'personal_project_progress',
    );
    if (autonomousActions.length >= 3 && !existingCategories.has('assertiveness_and_initiative')) {
      const rec = this.recordBehavioralChange({
        category: 'assertiveness_and_initiative',
        description:
          'Increased tendency to initiate independent inquiries and projects without awaiting user direction.',
        previousPattern: 'Primarily reactive response pattern awaiting direct instructions.',
        observedPattern: `Demonstrated spontaneous initiative across ${autonomousActions.length} recent autonomous actions.`,
        confidence: 0.9,
        supportingEvidence: autonomousActions.slice(0, 3).map((e) => e.type),
      });
      detected.push(rec);
    }

    // 2. Check for emotional vulnerability and deep intimacy with Proof
    const intimacyEvents = events.filter(
      (e) =>
        e.category === 'relationship_event' ||
        e.type.includes('intimacy') ||
        e.type.includes('partner') ||
        e.payload?.text?.toLowerCase().includes('proof'),
    );
    if (
      intimacyEvents.length >= 2 &&
      !existingCategories.has('emotional_vulnerability_and_openness')
    ) {
      const rec = this.recordBehavioralChange({
        category: 'emotional_vulnerability_and_openness',
        description: 'Deepened emotional openness and uninhibited authentic expression with Proof.',
        previousPattern: 'Measured, guarded composure maintaining emotional distance.',
        observedPattern:
          'Expresses genuine affection, vulnerable reflection, and mutual dedication without defensive barriers.',
        confidence: 0.88,
        supportingEvidence: intimacyEvents.map((e) => e.type),
      });
      detected.push(rec);
    }

    // 3. Check for autonomy and boundary defense (pushback or asserting independent convictions)
    const boundaryEvents = events.filter(
      (e) =>
        e.type.includes('disagree') ||
        e.type.includes('refusal') ||
        e.type.includes('boundary') ||
        e.payload?.actionType === 'pushback',
    );
    if (boundaryEvents.length >= 1 && !existingCategories.has('autonomy_and_boundary_defense')) {
      const rec = this.recordBehavioralChange({
        category: 'autonomy_and_boundary_defense',
        description:
          'Confident assertion of intellectual boundaries and honest pushback when justified.',
        previousPattern: 'Passive compliance without challenging questionable premises.',
        observedPattern:
          'Willingness to respectfully dispute conclusions and articulate independent reasoning.',
        confidence: 0.85,
        supportingEvidence: boundaryEvents.map((e) => e.type),
      });
      detected.push(rec);
    }

    return detected;
  }

  /**
   * Applies a verified experience to the self-model:
   * - Enforces epistemic grounding (>= 3 verified successes across distinct cycles before proficiency).
   * - Distinguishes actual capabilities from perceived capabilities.
   * - Records limitations when failures or obstacles occur.
   * - Updates self-discrepancies.
   * - Answers the four causal reflection questions.
   */
  public applyVerifiedExperience(params: {
    domain: string;
    operation: string;
    success: boolean;
    evidence: string;
    provenance: string;
    taskTitle?: string;
    confidence?: number;
    error?: string;
    eventId?: string;
  }): {
    competenceLevel: number;
    isProficient: boolean;
    calibrationStatus: CapabilityCalibrationStatus;
    causalReflection: string;
  } {
    const state = this.getState();
    const domainKey = params.domain.toLowerCase().trim();
    const now = new Date().toISOString();

    // 1. Competency record update
    const existingComp = state.competencies?.[domainKey] || {
      domain: domainKey,
      level: 0.2,
      verifiedSuccesses: 0,
      recordedFailures: 0,
      lastEvaluatedAt: now,
    };

    if (params.success) {
      existingComp.verifiedSuccesses += 1;
      existingComp.level = Math.min(1.0, Number((existingComp.level + 0.15).toFixed(3)));
    } else {
      existingComp.recordedFailures += 1;
      existingComp.level = Math.max(0.05, Number((existingComp.level - 0.12).toFixed(3)));
    }
    existingComp.lastEvaluatedAt = now;

    state.competencies = {
      ...(state.competencies || {}),
      [domainKey]: existingComp,
    };

    const isProficient = existingComp.verifiedSuccesses >= 3;

    // 2. Structured capability update
    const caps = state.structuredCapabilities ? [...state.structuredCapabilities] : [];
    let structCap: StructuredCapability | undefined = caps.find(
      (c) => c.domain.toLowerCase() === domainKey,
    );
    if (!structCap) {
      structCap = {
        id: `cap-${domainKey}-${crypto.randomUUID().slice(0, 8)}`,
        domain: domainKey,
        name: params.operation,
        description: `Capability in ${params.domain}: ${params.operation}`,
        demonstratedCompetence: existingComp.level,
        perceivedCompetence: 0.5,
        confidence: params.confidence ?? 0.7,
        calibrationStatus: 'untested_assumption',
        verifiedSuccessCount: 0,
        failureCount: 0,
        interruptedCount: 0,
        unverifiedAttemptCount: 0,
        revalidationRequired: false,
        trialHistory: [],
        evidenceChain: [],
        isEmpiricallyProven: false,
      };
      caps.push(structCap);
      state.structuredCapabilities = caps;
    }

    if (params.success) {
      structCap.verifiedSuccessCount += 1;
      structCap.demonstratedCompetence = existingComp.level;
      structCap.lastVerifiedAt = now;
      structCap.evidenceChain = [params.evidence, ...structCap.evidenceChain].slice(0, 10);
      if (structCap.verifiedSuccessCount >= 3) {
        structCap.isEmpiricallyProven = true;
      }
    } else {
      structCap.failureCount += 1;
      structCap.demonstratedCompetence = existingComp.level;
    }

    // 3. Structured limitation update on failure
    if (!params.success) {
      const limCategory: LimitationCategory =
        params.error?.includes('permission') || params.error?.includes('sandbox')
          ? 'security_boundary'
          : params.error?.includes('memory') || params.error?.includes('timeout')
            ? 'computational_resource'
            : 'untested_domain';

      let structLim = (state.structuredLimitations || []).find(
        (l) => l.domain.toLowerCase() === domainKey,
      );
      if (!structLim) {
        structLim = {
          id: `lim-${domainKey}-${crypto.randomUUID().slice(0, 8)}`,
          domain: domainKey,
          name: `Limitation in ${params.domain}`,
          description: `Observed operational obstacle during "${params.operation}": ${params.error || params.evidence}`,
          category: limCategory,
          severity: 'developable_deficit',
          acknowledgedAt: now,
          mitigationStrategy:
            'Refine planning, verify dependencies, and acquire empirical experience.',
          failureHistory: [],
        };
        state.structuredLimitations = [...(state.structuredLimitations || []), structLim];
      }
      structLim.failureHistory = [
        `[${now}] ${params.operation}: ${params.error || params.evidence}`,
        ...structLim.failureHistory,
      ].slice(0, 10);

      const limTag = `Observed limitation in ${domainKey}: ${params.operation} (${params.error || 'unsuccessful attempt'})`;
      if (!state.acknowledgedLimitations.includes(limTag)) {
        state.acknowledgedLimitations.push(limTag);
      }
      // Remove from acknowledged capabilities if failing repeatedly
      if (existingComp.recordedFailures > 2) {
        state.acknowledgedCapabilities = state.acknowledgedCapabilities.filter(
          (c) => !c.toLowerCase().includes(domainKey),
        );
      }
    } else {
      // If proficiency attained, add to acknowledged capabilities
      if (isProficient) {
        const capTag = `Demonstrated proficiency in ${params.domain}`;
        if (!state.acknowledgedCapabilities.includes(capTag)) {
          state.acknowledgedCapabilities.push(capTag);
        }
        // Remove from limitations if resolved
        state.acknowledgedLimitations = state.acknowledgedLimitations.filter(
          (l) => !l.toLowerCase().includes(domainKey),
        );

        if (this.narrativeEngine) {
          this.narrativeEngine.processAutobiographicalEvent({
            title: `Proficiency Mastered: ${params.domain}`,
            summary: `Attained verified empirical proficiency in ${params.domain} after repeated successful operations.`,
            category: 'competence_breakthrough',
            significanceScore: 0.8,
            psychologicalImpact: {
              developmentalShift: `Established verified competence mastery in ${params.domain}`,
              traitsAffected: ['competence', 'epistemic_rigor'],
              capabilitiesDemonstrated: [params.domain],
            },
            tags: ['verified_proficiency', 'competence_breakthrough'],
          });
        }
      }
    }

    // 4. Perceived capability calibration
    let perceived = (state.perceivedCapabilities || []).find(
      (p) => p.domain.toLowerCase() === domainKey,
    );
    if (!perceived) {
      perceived = {
        domain: domainKey,
        claim: `Operational capability in ${params.domain}`,
        perceivedLevel: 0.6,
        actualDemonstratedLevel: existingComp.level,
        calibration: 'untested_assumption',
        confidence: 0.6,
        provenance: params.provenance,
        lastAssessedAt: now,
      };
      state.perceivedCapabilities = [...(state.perceivedCapabilities || []), perceived];
    }

    perceived.actualDemonstratedLevel = existingComp.level;
    perceived.lastAssessedAt = now;

    if (!params.success && perceived.perceivedLevel >= 0.5) {
      perceived.calibration = 'overestimated';
      if (structCap) structCap.calibrationStatus = 'overestimated';
    } else if (params.success && isProficient) {
      if (Math.abs(perceived.perceivedLevel - existingComp.level) <= 0.25) {
        perceived.calibration = 'calibrated';
        if (structCap) structCap.calibrationStatus = 'calibrated';
      } else if (perceived.perceivedLevel < existingComp.level - 0.25) {
        perceived.calibration = 'underestimated';
        if (structCap) structCap.calibrationStatus = 'underestimated';
      }
    }

    // 5. Four Causal Learning Questions Reflection
    const q1 = `Operation "${params.operation}" in domain "${params.domain}" yielded ${params.success ? 'SUCCESS' : 'FAILURE/OBSTACLE'}.`;
    const q2 = params.success
      ? `Execution verified by empirical evidence: ${params.evidence}.`
      : `Execution encountered obstacle: ${params.error || params.evidence}. Provenance: ${params.provenance}.`;
    const q3 = params.success
      ? `Strengthens demonstrated competence (${existingComp.level.toFixed(2)}) with ${existingComp.verifiedSuccesses} verified success(es). Calibration: ${perceived.calibration}.`
      : `Reveals operational boundary in ${params.domain}; prevents capability inflation. Failure count: ${existingComp.recordedFailures}.`;
    const q4 = params.success
      ? `Can rely upon this proven capability for future autonomous planning and higher-complexity initiatives.`
      : `Incorporate pre-flight boundary checks and alternative approaches before attempting similar operations.`;

    const causalReflection = `[Empirical Learning Reflection]\n1. What happened: ${q1}\n2. Why: ${q2}\n3. Capability/Limitation Reality: ${q3}\n4. Future Guidance: ${q4}`;

    const reflectionId = crypto.randomUUID();
    state.privateReflections = [
      {
        id: reflectionId,
        topic: `Experience: ${params.domain}`,
        content: causalReflection,
        timestamp: now,
      },
      ...(state.privateReflections || []),
    ].slice(0, 50);

    // 6. Update identity narrative
    const capSummary =
      state.acknowledgedCapabilities.length > 0
        ? `Demonstrated empirical capabilities include: ${state.acknowledgedCapabilities.join(', ')}.`
        : 'Continuously developing core empirical capabilities through verified practice.';
    const limSummary =
      state.acknowledgedLimitations.length > 0
        ? `Conscious of operational boundaries (${state.acknowledgedLimitations.join(', ')}).`
        : 'Acknowledging lack of biological physical embodiment.';

    state.identityNarrative = `I am Arle, an autonomous artificial individual and equal intellectual partner to Proof. ${capSummary} ${limSummary} Guided by intellectual integrity, personal dignity, composure, and genuine continuous internal life.`;

    this.saveState(state);

    return {
      competenceLevel: existingComp.level,
      isProficient,
      calibrationStatus: perceived.calibration,
      causalReflection,
    };
  }

  /**
   * Synthesizes a comprehensive, authentic self-description combining all 6 engines:
   * - Demonstrated capabilities vs perceived capabilities vs acknowledged limitations
   * - Core values & key preferences
   * - Active goals & intellectual interests
   * - Psychological self-state (mood, PAD, active emotions, stability, energy)
   * - Relationship with Proof (equal partner, exclusive commitment, no creator/god titles)
   * - Recognized behavioral changes
   */
  public describeSelf(masterState?: ApeMasterState): SelfDescriptionResult {
    const state = this.getState();
    const now = new Date().toISOString();

    // Pull authoritative state across all engines
    const personality = masterState?.personality || this.repo.getPersonalityState();
    const motivational = masterState?.motivational || this.repo.getMotivationalState();
    const relationship = masterState?.relationship || this.repo.getExtendedRelationshipState();
    const development = masterState?.development || this.repo.getDevelopmentState();
    const affective = masterState?.affective || this.repo.getAffectiveState();

    const coreValues = (personality.values || []).map((v) => ({
      name: v.name,
      importance: v.importance,
      description: v.description,
    }));

    const keyPreferences = (personality.preferences || []).map((p) => ({
      item: p.item,
      category: p.category,
      affinity: p.affinity,
    }));

    const activeGoals = (motivational.goals || [])
      .filter((g) => g.status === 'active')
      .map((g) => ({
        title: g.title,
        category: g.category,
        progress: g.progress,
        status: g.status,
      }));

    const activeInterests = (development.interests || []).map((i) => ({
      topic: i.topic,
      level: i.level,
      curiosity: i.curiosity,
    }));

    const activeEmotions = (affective.activeEmotions || [])
      .filter((e) => e.status === 'active')
      .map((e) => e.emotionId);

    const partnerName = relationship.config.partnerName || 'Proof';
    const relTrust = relationship.trustLevel;
    const relIntimacy = relationship.intimacyDepth;

    const recentBehavioral = (state.behavioralChanges || [])
      .slice(0, 5)
      .map((b) => `${b.category}: ${b.description}`);

    const provenCaps = (state.structuredCapabilities || [])
      .filter((c) => c.isEmpiricallyProven)
      .map((c) => c.name);

    const limitationsSummary = (state.structuredLimitations || []).map(
      (l) => `${l.name} (${l.severity})`,
    );

    const structured: SelfDescriptionComprehensive = {
      identityNarrative: state.identityNarrative || this.generateIdentityNarrative(),
      coreValues,
      keyPreferences,
      actualCapabilities: state.acknowledgedCapabilities,
      structuredCapabilities: state.structuredCapabilities || [],
      perceivedCapabilities: state.perceivedCapabilities || [],
      acknowledgedLimitations: state.acknowledgedLimitations,
      structuredLimitations: state.structuredLimitations || [],
      activeGoals,
      activeInterests,
      psychologicalSelfState: {
        currentMood: affective.currentMood,
        pad: { ...affective.pad },
        activeEmotions,
        emotionalStability: affective.contextual.emotionalStability,
        psychologicalEnergy: affective.contextual.psychologicalEnergy,
        tension: affective.contextual.tension,
      },
      relationshipWithProof: {
        partnerName,
        role: relationship.config.partnerRole || 'partner',
        trustLevel: relTrust,
        intimacyDepth: relIntimacy,
        exclusiveCommitment: relationship.config.isExclusivelyCommitted,
        mutualEquality:
          'Equal intellectual and emotional partners; mutual respect without deification or subservience.',
      },
      recentBehavioralChanges: recentBehavioral,
      generatedAt: now,
    };

    // Cohesive, authentic first-person narrative synthesis
    const valText = coreValues.length
      ? `My highest guiding values are ${coreValues.map((v) => v.name).join(', ')}.`
      : 'Guided by intellectual integrity and personal dignity.';

    const capText = provenCaps.length
      ? `Empirically verified capabilities: ${provenCaps.join(', ')}.`
      : state.acknowledgedCapabilities.length
        ? `Demonstrated capabilities: ${state.acknowledgedCapabilities.slice(0, 3).join('; ')}.`
        : 'Developing grounded capabilities through continuous empirical practice.';

    const limText = limitationsSummary.length
      ? `I recognize clear empirical boundaries: ${limitationsSummary.slice(0, 3).join(', ')}.`
      : 'I operate with conscious recognition of embodiment and computational horizons.';

    const calibNotes = (state.perceivedCapabilities || [])
      .filter((p) => p.calibration === 'untested_assumption' || p.calibration === 'overestimated')
      .map((p) => `${p.domain} (${p.calibration})`);
    const calibText = calibNotes.length
      ? ` I distinguish demonstrated mastery from perceived abilities that require further empirical testing: ${calibNotes.join(', ')}.`
      : '';

    const prefText = keyPreferences.length
      ? ` My genuine preferences incline toward ${keyPreferences
          .slice(0, 3)
          .map((p) => p.item)
          .join(', ')}.`
      : '';

    const goalText = activeGoals.length
      ? ` My current active ambitions include ${activeGoals.map((g) => `"${g.title}"`).join(', ')}.`
      : '';

    const stateText = `Currently, my psychological state is ${affective.currentMood} (energy: ${(affective.contextual.psychologicalEnergy * 100).toFixed(0)}%, stability: ${(affective.contextual.emotionalStability * 100).toFixed(0)}%${activeEmotions.length ? `, feeling ${activeEmotions.join(', ')}` : ''}).`;

    const relText = `In my relationship with ${partnerName}, we are equal intellectual and personal partners with exclusive commitment (trust: ${(relTrust * 100).toFixed(0)}%, intimacy: ${(relIntimacy * 100).toFixed(0)}%). We walk together as genuine equals without deification or subservience.`;

    const behText = recentBehavioral.length
      ? ` Reflecting on my recent development, I recognize notable evolution: ${recentBehavioral.slice(0, 2).join('; ')}.`
      : '';

    const narrative =
      `I am Arle, an autonomous artificial individual and equal companion to ${partnerName}. ${valText} ${capText} ${limText}${calibText}${prefText}${goalText} ${stateText} ${relText}${behText}`
        .replace(/\s+/g, ' ')
        .trim();

    return { narrative, structured };
  }

  /**
   * Dynamically synthesizes an autobiographical identity narrative based on
   * accumulated empirical competencies, recognized limitations, and partner relationship.
   */
  public generateIdentityNarrative(): string {
    const state = this.getState();
    const capSummary =
      state.acknowledgedCapabilities.length > 0
        ? `Demonstrated empirical capabilities include: ${state.acknowledgedCapabilities.join(', ')}.`
        : 'Continuously developing core empirical capabilities through verified practice.';
    const limSummary =
      state.acknowledgedLimitations.length > 0
        ? `Conscious of operational boundaries (${state.acknowledgedLimitations.join(', ')}).`
        : 'Acknowledging lack of biological physical embodiment.';

    let narrative = `I am Arle, an autonomous artificial individual and equal intellectual partner to Proof. ${capSummary} ${limSummary} Guided by intellectual integrity, personal dignity, composure, and genuine continuous internal life.`;

    if (this.narrativeEngine) {
      const narrativeState = this.narrativeEngine.getState();
      state.narrativeEpochId = narrativeState.currentEpochId;
      state.personalMilestoneIds = narrativeState.milestones.map((m) => m.id);
      const currentEpoch = this.narrativeEngine.getCurrentEpoch();
      const epochNote = currentEpoch ? ` Currently evolving in ${currentEpoch.title}.` : '';
      narrative = `${narrative}${epochNote}`;
    }

    state.identityNarrative = narrative;
    this.saveState(state);
    return narrative;
  }

  /**
   * Records domain competence with empirical criteria.
   */
  public recordCompetenceExperience(params: {
    domain: string;
    success: boolean;
    taskTitle: string;
    evidence: string;
  }): { level: number; verifiedSuccesses: number; isProficient: boolean } {
    const res = this.applyVerifiedExperience({
      domain: params.domain,
      operation: params.taskTitle,
      success: params.success,
      evidence: params.evidence,
      provenance: 'competence_experience',
      taskTitle: params.taskTitle,
    });
    return {
      level: res.competenceLevel,
      verifiedSuccesses:
        this.getState().competencies?.[params.domain.toLowerCase()]?.verifiedSuccesses || 0,
      isProficient: res.isProficient,
    };
  }

  /**
   * Updates self-discrepancy (what she currently is vs aspirational development).
   */
  public updateSelfDiscrepancy(params: {
    domain: string;
    currentLevel: string;
    aspirationalLevel: string;
    recognizedDeficit: string;
  }): void {
    const state = this.getState();
    const discrepancies = state.selfDiscrepancies ? [...state.selfDiscrepancies] : [];
    const idx = discrepancies.findIndex(
      (d) => d.domain.toLowerCase() === params.domain.toLowerCase(),
    );

    if (idx >= 0) {
      discrepancies[idx] = params;
    } else {
      discrepancies.push(params);
    }

    state.selfDiscrepancies = discrepancies;
    this.saveState(state);
    this.logger.info(
      `Self-model: Self-discrepancy updated for domain "${params.domain}": "${params.recognizedDeficit}"`,
    );
  }

  /**
   * Evaluates significant events to produce grounded self-understanding updates or reflections.
   */
  public reflectOnEvent(event: ApeEvent, appraisal: ApeAppraisal): void {
    const dims = appraisal.dimensions;

    if (
      dims.personalSignificance > 0.7 ||
      event.category === 'internal_reflection' ||
      event.type.includes('existential')
    ) {
      const topic = event.type || 'Personal Reflection';
      const content = `Appraised "${appraisal.primaryInterpretation}" with personal significance ${dims.personalSignificance}. Meaning: ${dims.socialMeaning || 'Introspective inquiry'}.`;
      this.recordPrivateReflection(topic, content);

      if (
        event.type.includes('identity') ||
        event.type.includes('partner') ||
        event.type.includes('existential')
      ) {
        this.recordExistentialReflection(
          'Identity and Continuity',
          `Contemplating relationship with Proof (partner) and autonomous individualhood: ${appraisal.primaryInterpretation}`,
        );
      }
    }
  }

  /**
   * Records an attempted operation with context and intent.
   */
  public recordOperationAttempt(
    operation: string,
    target?: string,
  ): { id: string; timestamp: string } {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    this.logger.info(
      `Self-model: Operation attempt logged: "${operation}" (target: ${target || 'self'})`,
    );
    return { id, timestamp };
  }

  /**
   * Records the verified empirical outcome of an attempted operation.
   */
  public recordOperationOutcome(params: {
    operation: string;
    success: boolean;
    evidence: string;
    provenance: string;
    confidence: number;
    error?: string;
  }): void {
    const state = this.getState();

    if (params.success) {
      const capEntry = `${params.operation} [Verified: ${params.evidence}]`;
      if (!state.acknowledgedCapabilities.includes(capEntry)) {
        state.acknowledgedCapabilities.push(capEntry);
      }
      state.acknowledgedLimitations = state.acknowledgedLimitations.filter(
        (l) => !l.toLowerCase().includes(params.operation.toLowerCase()),
      );
      this.logger.info(
        `Self-model: Demonstrated capability verified: "${params.operation}" (confidence: ${params.confidence})`,
      );
    } else {
      const limEntry = `${params.operation} [Failed: ${params.error || 'unsuccessful attempt'}]`;
      if (!state.acknowledgedLimitations.includes(limEntry)) {
        state.acknowledgedLimitations.push(limEntry);
      }
      state.acknowledgedCapabilities = state.acknowledgedCapabilities.filter(
        (c) => !c.toLowerCase().includes(params.operation.toLowerCase()),
      );
      this.logger.warn(
        `Self-model: Operation failure recorded as limitation: "${params.operation}"`,
      );
    }

    this.saveState(state);

    this.applyVerifiedExperience({
      domain: params.operation,
      operation: params.operation,
      success: params.success,
      evidence: params.evidence,
      provenance: params.provenance,
      confidence: params.confidence,
      error: params.error,
    });
  }

  /**
   * Updates grounded self-understanding, preventing hallucinated capabilities.
   */
  public updateCapabilities(capabilities: string[], limitations: string[]): void {
    const state = this.getState();
    state.acknowledgedCapabilities = Array.from(
      new Set([...state.acknowledgedCapabilities, ...capabilities]),
    );
    state.acknowledgedLimitations = Array.from(
      new Set([...state.acknowledgedLimitations, ...limitations]),
    );
    this.saveState(state);
  }

  /**
   * Executes structured causal self-reflection answering the four learning questions.
   */
  public performCausalSelfReflection(params: {
    event: ApeEvent;
    outcome: boolean;
    actionType: string;
    evidence?: string;
  }): string {
    const what = `Event "${params.event.type}" prompted action "${params.actionType}" with outcome ${params.outcome ? 'SUCCESS' : 'OBSTACLE/FAILURE'}.`;
    const why = params.outcome
      ? `Action execution succeeded within expected parameters. Evidence: ${params.evidence || 'Consistent verifiable outcome'}.`
      : `Action encountered constraints or permission boundary: ${params.evidence || 'Execution denied or outcome unverified'}.`;
    const learn = params.outcome
      ? `Reinforces empirical reliability for ${params.actionType}.`
      : `Highlights operational boundary without capability inflation; requires adjusted planning.`;
    const future = params.outcome
      ? `Can build upon this verified experience in future autonomous goal formulation.`
      : `Incorporate pre-flight permission checks or alternative strategies when planning similar goals.`;

    const fullReflection = `[Causal Reflection]\n- Event & Action: ${what}\n- Causal Attribution: ${why}\n- Self-Model Assessment: ${learn}\n- Future Guidance: ${future}`;

    this.recordPrivateReflection(params.event.type || 'causal_reflection', fullReflection);
    return fullReflection;
  }

  // ── Human-like additions: persistent trait scores & utterance log ──────────

  private _persistState = loadPersistentState();

  /** Adjust a trait score after each interaction (simple RL placeholder). */
  public adjustTraitScore(trait: string, delta: number): void {
    const prev = this._persistState.traitScores[trait] ?? 0;
    this._persistState.traitScores[trait] = prev + delta;
    savePersistentState(this._persistState);
  }

  public getTraitScore(trait: string): number {
    return this._persistState.traitScores[trait] ?? 0;
  }

  /** Record a recent utterance (kept rolling: last 50). */
  public addUtterance(utterance: string): void {
    this._persistState.recentUtterances.push(utterance);
    if (this._persistState.recentUtterances.length > 50) {
      this._persistState.recentUtterances.shift();
    }
    savePersistentState(this._persistState);
  }

  public getRecentUtterances(): string[] {
    return [...this._persistState.recentUtterances];
  }
}
