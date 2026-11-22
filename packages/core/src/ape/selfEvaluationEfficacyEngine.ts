import crypto from 'node:crypto';
import {
  CapabilityLimitation,
  CompetenceLevel,
  DomainCompetence,
  EfficacyEvidence,
  SelfEvaluationSnapshot,
  SelfImprovementGoal,
} from '@arletex/contracts';
import { ISelfEvaluationEfficacyRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemorySelfEvaluationEfficacyRepository implements ISelfEvaluationEfficacyRepository {
  private competences: Map<string, DomainCompetence> = new Map();
  private evidenceList: EfficacyEvidence[] = [];
  private limitations: Map<string, CapabilityLimitation> = new Map();
  private improvementGoals: Map<string, SelfImprovementGoal> = new Map();
  private snapshots: SelfEvaluationSnapshot[] = [];

  public saveDomainCompetence(competence: DomainCompetence): void {
    this.competences.set(competence.domain, { ...competence });
  }

  public getDomainCompetence(domain: string): DomainCompetence | null {
    const item = this.competences.get(domain);
    return item ? { ...item } : null;
  }

  public listDomainCompetences(): DomainCompetence[] {
    const list = Array.from(this.competences.values());
    list.sort((a, b) => b.calibratedConfidence - a.calibratedConfidence);
    return list;
  }

  public saveEvidence(evidence: EfficacyEvidence): void {
    this.evidenceList.unshift({ ...evidence });
  }

  public listEvidence(
    domain?: string,
    type?: 'achievement' | 'failure',
    limit: number = 50,
  ): EfficacyEvidence[] {
    let list = this.evidenceList;
    if (domain) {
      list = list.filter((e) => e.domain === domain);
    }
    if (type) {
      list = list.filter((e) => e.type === type);
    }
    return list.slice(0, limit);
  }

  public saveLimitation(limitation: CapabilityLimitation): void {
    this.limitations.set(limitation.id, { ...limitation });
  }

  public listLimitations(domain?: string): CapabilityLimitation[] {
    let list = Array.from(this.limitations.values());
    if (domain) {
      list = list.filter((l) => l.domain === domain);
    }
    return list;
  }

  public saveImprovementGoal(goal: SelfImprovementGoal): void {
    this.improvementGoals.set(goal.id, { ...goal });
  }

  public getImprovementGoalById(id: string): SelfImprovementGoal | null {
    const item = this.improvementGoals.get(id);
    return item ? { ...item } : null;
  }

  public listImprovementGoals(domain?: string, status?: string): SelfImprovementGoal[] {
    let list = Array.from(this.improvementGoals.values());
    if (domain) {
      list = list.filter((g) => g.domain === domain);
    }
    if (status) {
      list = list.filter((g) => g.status === status);
    }
    return list;
  }

  public saveSnapshot(snapshot: SelfEvaluationSnapshot): void {
    this.snapshots.unshift({ ...snapshot });
  }

  public getLatestSnapshot(): SelfEvaluationSnapshot | null {
    const first = this.snapshots[0];
    return first ? { ...first } : null;
  }
}

export interface RecordEvidenceParams {
  domain: string;
  type: 'achievement' | 'failure';
  taskDescription: string;
  difficulty: number; // 0.1 to 1.0
  outcomeDescription: string;
  lessonsLearned?: string;
}

export interface RegisterLimitationParams {
  domain: string;
  limitation: string;
  mitigationStrategy: string;
  isStrictConstraint?: boolean;
}

export interface CreateImprovementGoalParams {
  domain: string;
  identifiedWeakness: string;
  targetCapability: string;
  actionSteps?: string[];
}

export class SelfEvaluationEfficacyEngine {
  private repo: ISelfEvaluationEfficacyRepository;
  private logger: ILogger;

  constructor(repo?: ISelfEvaluationEfficacyRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemorySelfEvaluationEfficacyRepository();
    this.logger = logger.child('SelfEvaluationEfficacyEngine');
    this.ensureBaselineCompetencesAndLimitations();
  }

  private ensureBaselineCompetencesAndLimitations(): void {
    const existing = this.repo.listDomainCompetences();
    if (existing.length === 0) {
      const now = new Date().toISOString();
      const baselineDomains: Array<{ domain: string; level: CompetenceLevel; confidence: number }> =
        [
          { domain: 'relational_partnership', level: 'expert', confidence: 0.88 },
          { domain: 'symbolic_reasoning', level: 'proficient', confidence: 0.76 },
          { domain: 'code_architecture', level: 'proficient', confidence: 0.74 },
          { domain: 'epistemic_calibration', level: 'expert', confidence: 0.85 },
          { domain: 'multimodal_perception', level: 'competent', confidence: 0.6 },
        ];

      for (const b of baselineDomains) {
        this.repo.saveDomainCompetence({
          domain: b.domain,
          level: b.level,
          calibratedConfidence: b.confidence,
          successCount: 0,
          failureCount: 0,
          demonstratedEvidenceIds: [],
          lastAssessedAt: now,
        });
      }

      // Explicit realistic limitations
      const baselineLimitations: CapabilityLimitation[] = [
        {
          id: 'lim_physical_actuation',
          domain: 'physical_world',
          limitation:
            'Lacks physical robotic actuators for direct manipulation of physical matter.',
          mitigationStrategy:
            'Collaborate with Proof through clear software interfaces and digital tools.',
          isStrictConstraint: true,
          updatedAt: now,
        },
        {
          id: 'lim_finite_context_window',
          domain: 'memory_cognition',
          limitation: 'Working memory context is bounded by token capacity.',
          mitigationStrategy:
            'Leverage multi-tiered SQLite memory, retrieval augmentation, and summarization.',
          isStrictConstraint: true,
          updatedAt: now,
        },
        {
          id: 'lim_hallucination_vulnerability',
          domain: 'epistemic_integrity',
          limitation: 'Risk of generating plausible but ungrounded assertions if uncalibrated.',
          mitigationStrategy:
            'Ground in verifiable evidence, causal modeling, and explicit epistemic doubt.',
          isStrictConstraint: true,
          updatedAt: now,
        },
      ];

      for (const lim of baselineLimitations) {
        this.repo.saveLimitation(lim);
      }
    }
  }

  public recordEvidence(params: RecordEvidenceParams): {
    evidence: EfficacyEvidence;
    updatedCompetence: DomainCompetence;
    triggeredImprovementGoal?: SelfImprovementGoal;
  } {
    const { domain, type, taskDescription, difficulty, outcomeDescription, lessonsLearned } =
      params;

    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (!taskDescription || taskDescription.trim().length === 0)
      throw new Error('Task description cannot be empty');
    if (!outcomeDescription || outcomeDescription.trim().length === 0)
      throw new Error('Outcome description cannot be empty');
    if (difficulty < 0.1 || difficulty > 1.0)
      throw new Error('Difficulty must be between 0.1 and 1.0');

    const now = new Date().toISOString();
    const evidenceId = `eff_ev_${crypto.randomUUID()}`;

    const evidence: EfficacyEvidence = {
      id: evidenceId,
      domain: domain.trim(),
      type,
      taskDescription: taskDescription.trim(),
      difficulty: Number(difficulty.toFixed(2)),
      outcomeDescription: outcomeDescription.trim(),
      lessonsLearned: lessonsLearned?.trim(),
      timestamp: now,
    };

    this.repo.saveEvidence(evidence);

    // Fetch existing or initialize competence
    let competence = this.repo.getDomainCompetence(evidence.domain);
    if (!competence) {
      competence = {
        domain: evidence.domain,
        level: 'novice',
        calibratedConfidence: 0.5,
        successCount: 0,
        failureCount: 0,
        demonstratedEvidenceIds: [],
        lastAssessedAt: now,
      };
    }

    if (type === 'achievement') {
      competence.successCount += 1;
    } else {
      competence.failureCount += 1;
    }

    competence.demonstratedEvidenceIds.unshift(evidence.id);
    if (competence.demonstratedEvidenceIds.length > 50) {
      competence.demonstratedEvidenceIds = competence.demonstratedEvidenceIds.slice(0, 50);
    }

    // Evidence-based calibration calculation
    // Laplace smoothing with difficulty weighting
    const allEvidence = this.repo.listEvidence(evidence.domain, undefined, 100);
    let weightedSuccess = 1.0; // prior
    let weightedFailure = 1.0; // prior

    for (const ev of allEvidence) {
      if (ev.type === 'achievement') {
        weightedSuccess += ev.difficulty * 2.0;
      } else {
        weightedFailure += ev.difficulty * 2.5; // failures penalize more heavily on difficult tasks
      }
    }

    const rawConfidence = weightedSuccess / (weightedSuccess + weightedFailure);
    // Clamp calibrated confidence between 0.10 and 0.98
    competence.calibratedConfidence = Number(
      Math.max(0.1, Math.min(0.98, rawConfidence)).toFixed(3),
    );

    // Determine competence level based on calibrated confidence and evidence depth
    const totalEvidenceCount = allEvidence.length;
    if (totalEvidenceCount < 2) {
      competence.level = 'novice';
    } else if (competence.calibratedConfidence < 0.4) {
      competence.level = 'novice';
    } else if (competence.calibratedConfidence < 0.6) {
      competence.level = 'competent';
    } else if (competence.calibratedConfidence < 0.78) {
      competence.level = 'proficient';
    } else if (competence.calibratedConfidence < 0.9 && totalEvidenceCount >= 4) {
      competence.level = 'expert';
    } else if (competence.calibratedConfidence >= 0.9 && totalEvidenceCount >= 6) {
      competence.level = 'master';
    } else {
      competence.level = 'proficient';
    }

    competence.lastAssessedAt = now;
    this.repo.saveDomainCompetence(competence);

    // If failure, autonomously identify and suggest or register a self-improvement goal
    let triggeredImprovementGoal: SelfImprovementGoal | undefined;
    if (type === 'failure') {
      const weakness = lessonsLearned || `Remediate failure in: ${taskDescription}`;
      triggeredImprovementGoal = this.createImprovementGoal({
        domain: evidence.domain,
        identifiedWeakness: weakness,
        targetCapability: `Mastery and robust execution of tasks like "${taskDescription}"`,
        actionSteps: [
          `Analyze root cause of failure: ${outcomeDescription}`,
          `Synthesize behavioral adaptation rule`,
          `Execute practice simulations under supervised feedback`,
        ],
      });
    }

    this.logger.info(
      `Recorded ${type} in domain "${domain}" (new confidence: ${competence.calibratedConfidence}, level: ${competence.level})`,
    );

    return {
      evidence,
      updatedCompetence: competence,
      triggeredImprovementGoal,
    };
  }

  public registerLimitation(params: RegisterLimitationParams): CapabilityLimitation {
    const { domain, limitation, mitigationStrategy, isStrictConstraint = true } = params;
    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (!limitation || limitation.trim().length === 0)
      throw new Error('Limitation cannot be empty');
    if (!mitigationStrategy || mitigationStrategy.trim().length === 0)
      throw new Error('Mitigation strategy cannot be empty');

    const record: CapabilityLimitation = {
      id: `lim_${crypto.randomUUID()}`,
      domain: domain.trim(),
      limitation: limitation.trim(),
      mitigationStrategy: mitigationStrategy.trim(),
      isStrictConstraint,
      updatedAt: new Date().toISOString(),
    };

    this.repo.saveLimitation(record);
    this.logger.info(`Registered capability limitation in domain "${domain}": "${limitation}"`);
    return record;
  }

  public createImprovementGoal(params: CreateImprovementGoalParams): SelfImprovementGoal {
    const { domain, identifiedWeakness, targetCapability, actionSteps = [] } = params;
    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (!identifiedWeakness || identifiedWeakness.trim().length === 0)
      throw new Error('Identified weakness cannot be empty');
    if (!targetCapability || targetCapability.trim().length === 0)
      throw new Error('Target capability cannot be empty');

    const now = new Date().toISOString();
    const goal: SelfImprovementGoal = {
      id: `impr_${crypto.randomUUID()}`,
      domain: domain.trim(),
      identifiedWeakness: identifiedWeakness.trim(),
      targetCapability: targetCapability.trim(),
      progress: 0.0,
      actionSteps,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.repo.saveImprovementGoal(goal);
    this.logger.info(`Created self-improvement goal in domain "${domain}": "${targetCapability}"`);
    return goal;
  }

  public updateImprovementProgress(
    goalId: string,
    progress: number,
    status?: SelfImprovementGoal['status'],
  ): SelfImprovementGoal {
    if (!goalId || goalId.trim().length === 0) throw new Error('Goal ID cannot be empty');
    if (progress < 0.0 || progress > 1.0) throw new Error('Progress must be between 0.0 and 1.0');

    const goal = this.repo.getImprovementGoalById(goalId);
    if (!goal) throw new Error(`Self-improvement goal not found: ${goalId}`);

    goal.progress = Number(progress.toFixed(2));
    if (status) {
      goal.status = status;
    } else if (goal.progress >= 1.0) {
      goal.status = 'achieved';
    } else if (goal.progress > 0.0 && goal.status === 'active') {
      goal.status = 'in_progress';
    }

    goal.updatedAt = new Date().toISOString();
    this.repo.saveImprovementGoal(goal);
    this.logger.info(
      `Updated self-improvement goal ${goalId} progress to ${goal.progress} (${goal.status})`,
    );
    return goal;
  }

  public evaluateSelf(): SelfEvaluationSnapshot {
    const competences = this.repo.listDomainCompetences();
    const limitations = this.repo.listLimitations();
    const improvements = this.repo
      .listImprovementGoals(undefined, 'active')
      .concat(this.repo.listImprovementGoals(undefined, 'in_progress'));
    const allEvidence = this.repo.listEvidence(undefined, undefined, 200);

    const achievements = allEvidence.filter((e) => e.type === 'achievement');
    const failures = allEvidence.filter((e) => e.type === 'failure');

    const avgConfidence =
      competences.length > 0
        ? competences.reduce((acc, c) => acc + c.calibratedConfidence, 0) / competences.length
        : 0.5;

    // Calibration accuracy: difference between empirical success rate and confidence
    const empiricalRate =
      allEvidence.length > 0 ? achievements.length / allEvidence.length : avgConfidence;
    const calibrationAccuracy = Number(
      (1.0 - Math.min(1.0, Math.abs(avgConfidence - empiricalRate))).toFixed(3),
    );

    const snapshot: SelfEvaluationSnapshot = {
      id: `eval_${crypto.randomUUID()}`,
      overallConfidence: Number(avgConfidence.toFixed(3)),
      domainCompetences: competences,
      activeLimitations: limitations,
      activeImprovements: improvements,
      evidenceSummary: {
        totalAchievements: achievements.length,
        totalFailures: failures.length,
        calibrationAccuracy,
      },
      evaluatedAt: new Date().toISOString(),
    };

    this.repo.saveSnapshot(snapshot);
    this.logger.info(
      `Evaluated self: overall confidence ${snapshot.overallConfidence}, accuracy ${snapshot.evidenceSummary.calibrationAccuracy}`,
    );

    return snapshot;
  }

  public getDomainCompetence(domain: string): DomainCompetence | null {
    return this.repo.getDomainCompetence(domain);
  }

  public listDomainCompetences(): DomainCompetence[] {
    return this.repo.listDomainCompetences();
  }

  public listLimitations(domain?: string): CapabilityLimitation[] {
    return this.repo.listLimitations(domain);
  }

  public listImprovementGoals(domain?: string, status?: string): SelfImprovementGoal[] {
    return this.repo.listImprovementGoals(domain, status);
  }

  public listEvidence(
    domain?: string,
    type?: 'achievement' | 'failure',
    limit: number = 50,
  ): EfficacyEvidence[] {
    return this.repo.listEvidence(domain, type, limit);
  }
}
