import crypto from 'node:crypto';
import {
  CognitiveAssessment,
  MetacognitiveCorrection,
  MetacognitiveContradictionItem,
  ReasoningErrorItem,
  assertMetacognitiveIntegrity,
  assertCorrectionIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IMetacognitionRepository } from './interfaces.js';

export interface MetacognitionEngineOptions {
  repository: IMetacognitionRepository;
  logger?: ILogger;
}

export class InMemoryMetacognitionRepository implements IMetacognitionRepository {
  private assessments = new Map<string, CognitiveAssessment>();
  private corrections = new Map<string, MetacognitiveCorrection>();
  private contradictions = new Map<string, MetacognitiveContradictionItem>();

  public saveAssessment(assessment: CognitiveAssessment): void {
    assertMetacognitiveIntegrity(assessment);
    this.assessments.set(assessment.id, { ...assessment });
  }

  public getAssessmentById(id: string): CognitiveAssessment | null {
    const a = this.assessments.get(id);
    return a ? { ...a } : null;
  }

  public listAssessments(filter?: {
    targetDomain?: string;
    limit?: number;
  }): CognitiveAssessment[] {
    let list = Array.from(this.assessments.values());
    if (filter?.targetDomain) {
      list = list.filter((a) => a.targetDomain === filter.targetDomain);
    }
    list.sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());
    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }
    return list.map((a) => ({ ...a }));
  }

  public deleteAssessment(id: string): void {
    this.assessments.delete(id);
  }

  public saveCorrection(correction: MetacognitiveCorrection): void {
    assertCorrectionIntegrity(correction);
    this.corrections.set(correction.id, { ...correction });
  }

  public getCorrectionById(id: string): MetacognitiveCorrection | null {
    const c = this.corrections.get(id);
    return c ? { ...c } : null;
  }

  public listCorrections(filter?: {
    assessmentId?: string;
    limit?: number;
  }): MetacognitiveCorrection[] {
    let list = Array.from(this.corrections.values());
    if (filter?.assessmentId) {
      list = list.filter((c) => c.assessmentId === filter.assessmentId);
    }
    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }
    return list.map((c) => ({ ...c }));
  }

  public saveContradiction(contradiction: MetacognitiveContradictionItem): void {
    this.contradictions.set(contradiction.id, { ...contradiction });
  }

  public getContradictionById(id: string): MetacognitiveContradictionItem | null {
    const item = this.contradictions.get(id);
    return item ? { ...item } : null;
  }

  public listContradictions(filter?: {
    status?: MetacognitiveContradictionItem['status'];
    limit?: number;
  }): MetacognitiveContradictionItem[] {
    let list = Array.from(this.contradictions.values());
    if (filter?.status) {
      list = list.filter((c) => c.status === filter.status);
    }
    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }
    return list.map((c) => ({ ...c }));
  }

  public updateContradictionStatus(
    id: string,
    status: MetacognitiveContradictionItem['status'],
    notes?: string,
  ): void {
    const existing = this.contradictions.get(id);
    if (existing) {
      existing.status = status;
      if (notes !== undefined) {
        existing.notes = notes;
      }
      this.contradictions.set(id, existing);
    }
  }
}

export class MetacognitionEngine {
  private readonly repo: IMetacognitionRepository;
  private readonly logger: ILogger;

  constructor(options: MetacognitionEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('MetacognitionEngine');
  }

  // ==========================================
  // 1. Confidence Calibration
  // ==========================================

  public calibrateConfidence(
    statedConfidence: number,
    evidenceSufficiency: number,
    hasContradictions: boolean = false,
  ): {
    calibratedConfidence: number;
    calibrationDelta: number;
    isOverconfident: boolean;
    rationale: string;
  } {
    const clampedStated = Math.max(0.0, Math.min(1.0, statedConfidence));
    const clampedSufficiency = Math.max(0.0, Math.min(1.0, evidenceSufficiency));

    // Base calibrated confidence is weighted harmonic mean of stated confidence and evidence sufficiency
    let calibrated = clampedStated * (0.3 + 0.7 * clampedSufficiency);

    // If contradictions exist, penalize calibrated confidence by 25%
    if (hasContradictions) {
      calibrated *= 0.75;
    }

    // Negative Invariant Hard Ceiling:
    // If evidence sufficiency is low (< 0.4), calibrated confidence MUST NEVER exceed 0.6
    if (clampedSufficiency < 0.4) {
      calibrated = Math.min(0.6, calibrated);
    }

    calibrated = Math.round(Math.max(0.05, Math.min(1.0, calibrated)) * 1000) / 1000;
    const calibrationDelta = Math.round((clampedStated - calibrated) * 1000) / 1000;
    const isOverconfident = calibrationDelta > 0.15;

    let rationale = `Confidence calibrated from ${clampedStated} to ${calibrated} (Evidence sufficiency: ${clampedSufficiency}).`;
    if (isOverconfident) {
      rationale += ` Overconfidence mitigated due to evidence constraints.`;
    }
    if (hasContradictions) {
      rationale += ` Penalty applied for active contradictions.`;
    }

    return {
      calibratedConfidence: calibrated,
      calibrationDelta,
      isOverconfident,
      rationale,
    };
  }

  // ==========================================
  // 2. Contradiction Detection
  // ==========================================

  public detectContradictions(statements: string[]): MetacognitiveContradictionItem[] {
    const detected: MetacognitiveContradictionItem[] = [];

    // Semantic contradiction pairs patterns (negations, opposing absolutes)
    for (let i = 0; i < statements.length; i++) {
      const stmtI = statements[i];
      if (!stmtI) continue;
      for (let j = i + 1; j < statements.length; j++) {
        const stmtJ = statements[j];
        if (!stmtJ) continue;
        const a = stmtI.trim();
        const b = stmtJ.trim();
        const lowerA = a.toLowerCase();
        const lowerB = b.toLowerCase();

        // Direct negation check
        const isDirectNegation =
          (lowerA.startsWith('not ') && lowerA.slice(4) === lowerB) ||
          (lowerB.startsWith('not ') && lowerB.slice(4) === lowerA) ||
          (lowerA.includes(' is ') &&
            lowerB.includes(' is not ') &&
            lowerA.replace(' is ', ' ') === lowerB.replace(' is not ', ' ')) ||
          (lowerB.includes(' is ') &&
            lowerA.includes(' is not ') &&
            lowerB.replace(' is ', ' ') === lowerA.replace(' is not ', ' ')) ||
          (lowerA.includes('enabled') && lowerB.includes('disabled')) ||
          (lowerA.includes('true') &&
            lowerB.includes('false') &&
            lowerA.replace('true', '') === lowerB.replace('false', '')) ||
          (lowerA.includes('always') && lowerB.includes('never'));

        if (isDirectNegation) {
          const item: MetacognitiveContradictionItem = {
            id: crypto.randomUUID(),
            statementA: a,
            statementB: b,
            severity: 'high',
            status: 'detected',
            notes: 'Direct propositional or state contradiction detected between statements.',
          };
          detected.push(item);
          this.repo.saveContradiction(item);
          this.logger.warn(`Contradiction detected: "${a}" vs "${b}"`);
        }
      }
    }

    return detected;
  }

  // ==========================================
  // 3. Evidence Sufficiency Assessment
  // ==========================================

  public assessEvidenceSufficiency(input: {
    claim: string;
    evidenceItems: Array<{ statement: string; reliability: number; isDirect: boolean }>;
  }): {
    sufficiencyScore: number;
    isSufficient: boolean;
    missingAspects: string[];
  } {
    if (!input.evidenceItems || input.evidenceItems.length === 0) {
      return {
        sufficiencyScore: 0.1,
        isSufficient: false,
        missingAspects: ['Direct empirical observation', 'Reproducible validation data'],
      };
    }

    let directWeight = 0;
    let indirectWeight = 0;

    for (const ev of input.evidenceItems) {
      const rel = Math.max(0.0, Math.min(1.0, ev.reliability));
      if (ev.isDirect) {
        directWeight += rel * 1.0;
      } else {
        indirectWeight += rel * 0.4;
      }
    }

    // Direct evidence counts heavily; indirect evidence caps contribution
    const totalEvidence = directWeight + Math.min(0.6, indirectWeight);
    const sufficiencyScore = Math.round(Math.min(1.0, totalEvidence / 2.0) * 1000) / 1000;
    const isSufficient = sufficiencyScore >= 0.6;

    const missingAspects: string[] = [];
    if (directWeight < 1.0) {
      missingAspects.push('Corroborating direct evidence');
    }
    if (input.evidenceItems.length < 2) {
      missingAspects.push('Multi-source cross-verification');
    }

    return {
      sufficiencyScore,
      isSufficient,
      missingAspects,
    };
  }

  // ==========================================
  // 4. Assumption Identification
  // ==========================================

  public identifyAssumptions(text: string): string[] {
    const assumptions: string[] = [];
    const lower = text.toLowerCase();

    const indicatorPatterns = [
      /assuming (that )?([^,.;]+)/gi,
      /presumes? (that )?([^,.;]+)/gi,
      /obviously,? ([^,.;]+)/gi,
      /clearly,? ([^,.;]+)/gi,
      /must be (that )?([^,.;]+)/gi,
      /it is expected that ([^,.;]+)/gi,
      /by default,? ([^,.;]+)/gi,
    ];

    for (const pat of indicatorPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pat.exec(text)) !== null) {
        const assumption = match[2]?.trim() || match[1]?.trim() || match[0].trim();
        if (assumption && !assumptions.includes(assumption)) {
          assumptions.push(assumption);
        }
      }
    }

    // Structural default assumption checks
    if (lower.includes('always') || lower.includes('never')) {
      assumptions.push('Absoluteness invariant across unobserved edge conditions');
    }
    if (lower.includes('will succeed') || lower.includes('zero failure')) {
      assumptions.push('Ideal operational conditions without external disruptions');
    }

    return assumptions;
  }

  // ==========================================
  // 5. Reasoning Quality Assessment
  // ==========================================

  public assessReasoningQuality(input: {
    premises: string[];
    conclusion: string;
    identifiedAssumptions?: string[];
  }): {
    score: number;
    recognizedErrors: ReasoningErrorItem[];
  } {
    const errors: ReasoningErrorItem[] = [];
    let deductionPenalty = 0;

    const premisesText = input.premises.join(' ').toLowerCase();
    const conclusionText = input.conclusion.toLowerCase();

    // 1. Circular reasoning check
    for (const p of input.premises) {
      if (p.toLowerCase().trim() === conclusionText.trim()) {
        errors.push({
          type: 'logical_fallacy',
          description: `Circular reasoning (petitio principii): conclusion restates premise "${p}".`,
          impact: 0.5,
        });
        deductionPenalty += 0.4;
      }
    }

    // 2. Unsupported assumptions check
    const assumptions =
      input.identifiedAssumptions || this.identifyAssumptions(premisesText + ' ' + conclusionText);
    if (assumptions.length >= 2) {
      errors.push({
        type: 'unsupported_assumption',
        description: `Reasoning relies heavily on ${assumptions.length} unverified assumptions.`,
        impact: 0.25,
      });
      deductionPenalty += 0.2;
    }

    // 3. Overgeneralization check
    if (
      conclusionText.includes('always') ||
      conclusionText.includes('never') ||
      conclusionText.includes('all')
    ) {
      if (!premisesText.includes('universal') && !premisesText.includes('every')) {
        errors.push({
          type: 'overgeneralization',
          description: 'Universal conclusion drawn without exhaustive universal premise.',
          impact: 0.3,
        });
        deductionPenalty += 0.25;
      }
    }

    const rawScore = 1.0 - deductionPenalty;
    const score = Math.round(Math.max(0.1, Math.min(1.0, rawScore)) * 1000) / 1000;

    return {
      score,
      recognizedErrors: errors,
    };
  }

  // ==========================================
  // 6. Comprehensive Cognitive Assessment
  // ==========================================

  public evaluateCognitiveProcess(input: {
    targetCognitionId: string;
    targetDomain: string;
    claim: string;
    statedConfidence: number;
    evidenceItems: Array<{ statement: string; reliability: number; isDirect: boolean }>;
    associatedStatements?: string[];
    premises?: string[];
  }): CognitiveAssessment {
    // 1. Assess evidence sufficiency
    const evidenceAssessment = this.assessEvidenceSufficiency({
      claim: input.claim,
      evidenceItems: input.evidenceItems,
    });

    // 2. Detect contradictions
    const statementsToScan = [input.claim, ...(input.associatedStatements || [])];
    const contradictions = this.detectContradictions(statementsToScan);
    const hasContradictions = contradictions.length > 0;

    // 3. Calibrate confidence
    const calibration = this.calibrateConfidence(
      input.statedConfidence,
      evidenceAssessment.sufficiencyScore,
      hasContradictions,
    );

    // 4. Identify assumptions
    const assumptions = this.identifyAssumptions(
      [input.claim, ...(input.premises || [])].join(' '),
    );

    // 5. Reasoning quality
    const reasoningQuality = this.assessReasoningQuality({
      premises: input.premises || [input.claim],
      conclusion: input.claim,
      identifiedAssumptions: assumptions,
    });

    // 6. Epistemic vs Aleatoric Uncertainty
    // Low evidence increases epistemic uncertainty (which is reducible by investigation)
    const epistemicUncertainty =
      Math.round((1.0 - evidenceAssessment.sufficiencyScore) * 1000) / 1000;
    const aleatoricUncertainty = Math.round(0.2 * 1000) / 1000;

    // 7. Decide investigation and self-correction
    const hasHighSeverityContradiction = contradictions.some(
      (c) => c.severity === 'high' && c.status === 'detected',
    );
    const needsInvestigation =
      !evidenceAssessment.isSufficient ||
      epistemicUncertainty > 0.5 ||
      hasHighSeverityContradiction;

    const selfCorrectionInitiated =
      calibration.isOverconfident || reasoningQuality.score < 0.6 || hasHighSeverityContradiction;

    const correctiveActions: string[] = [];
    if (calibration.isOverconfident) {
      correctiveActions.push(
        `Attenuate confidence from ${input.statedConfidence} to ${calibration.calibratedConfidence} due to evidentiary bounds.`,
      );
    }
    if (reasoningQuality.recognizedErrors.length > 0) {
      correctiveActions.push(
        `Address reasoning flaws: ${reasoningQuality.recognizedErrors.map((e) => e.description).join('; ')}`,
      );
    }
    if (hasHighSeverityContradiction) {
      correctiveActions.push(`Initiate inquiry to reconcile contradictory assertions.`);
    }

    const investigationFocus = needsInvestigation
      ? `Investigate evidentiary gap for claim "${input.claim.slice(0, 80)}": focus on ${evidenceAssessment.missingAspects.join(', ')}`
      : undefined;

    const assessment: CognitiveAssessment = {
      id: crypto.randomUUID(),
      targetCognitionId: input.targetCognitionId,
      targetDomain: input.targetDomain,
      statedConfidence: input.statedConfidence,
      calibratedConfidence: calibration.calibratedConfidence,
      epistemicUncertainty,
      aleatoricUncertainty,
      evidenceSufficiency: evidenceAssessment.sufficiencyScore,
      isEvidenceSufficient: evidenceAssessment.isSufficient,
      identifiedAssumptions: assumptions,
      detectedContradictions: contradictions,
      reasoningQualityScore: reasoningQuality.score,
      recognizedErrors: reasoningQuality.recognizedErrors,
      needsInvestigation,
      investigationFocus,
      selfCorrectionInitiated,
      correctiveActions,
      assessedAt: new Date().toISOString(),
    };

    assertMetacognitiveIntegrity(assessment);
    this.repo.saveAssessment(assessment);
    this.logger.info(
      `Metacognitive assessment completed for [${assessment.targetDomain}]: Calibrated Conf=${assessment.calibratedConfidence}, Evidence=${assessment.evidenceSufficiency}, Errors=${assessment.recognizedErrors.length}`,
    );

    return assessment;
  }

  // ==========================================
  // 7. Self-Correction Initiation
  // ==========================================

  public initiateSelfCorrection(input: {
    assessmentId: string;
    originalClaim: string;
    correctedClaim: string;
    confidenceAdjustment: number;
    rationale: string;
  }): MetacognitiveCorrection {
    const correction: MetacognitiveCorrection = {
      id: crypto.randomUUID(),
      assessmentId: input.assessmentId,
      originalClaim: input.originalClaim.trim(),
      correctedClaim: input.correctedClaim.trim(),
      confidenceAdjustment: Math.round(input.confidenceAdjustment * 1000) / 1000,
      rationale: input.rationale.trim(),
      status: 'applied',
      appliedAt: new Date().toISOString(),
    };

    assertCorrectionIntegrity(correction);
    this.repo.saveCorrection(correction);
    this.logger.info(
      `Self-correction applied for assessment ${correction.assessmentId}: "${correction.correctedClaim}" (Adj: ${correction.confidenceAdjustment})`,
    );
    return correction;
  }

  // ==========================================
  // 8. Investigation Decisions
  // ==========================================

  public decideInvestigation(assessmentId: string): {
    shouldInvestigate: boolean;
    inquiryPrompt?: string;
    priority: number;
  } {
    const assessment = this.repo.getAssessmentById(assessmentId);
    if (!assessment) {
      return { shouldInvestigate: false, priority: 0 };
    }

    if (!assessment.needsInvestigation) {
      return { shouldInvestigate: false, priority: 0.1 };
    }

    const priority =
      Math.round(
        Math.min(
          1.0,
          assessment.epistemicUncertainty * 0.6 + (1.0 - assessment.evidenceSufficiency) * 0.4,
        ) * 1000,
      ) / 1000;

    const inquiryPrompt =
      assessment.investigationFocus ||
      `Conduct targeted epistemic probe into ${assessment.targetDomain} to gather corroborating evidence.`;

    return {
      shouldInvestigate: true,
      inquiryPrompt,
      priority,
    };
  }

  // ==========================================
  // 9. Query & Management Methods
  // ==========================================

  public getAssessment(id: string): CognitiveAssessment | null {
    return this.repo.getAssessmentById(id);
  }

  public listAssessments(filter?: {
    targetDomain?: string;
    limit?: number;
  }): CognitiveAssessment[] {
    return this.repo.listAssessments(filter);
  }

  public getCorrection(id: string): MetacognitiveCorrection | null {
    return this.repo.getCorrectionById(id);
  }

  public listCorrections(filter?: {
    assessmentId?: string;
    limit?: number;
  }): MetacognitiveCorrection[] {
    return this.repo.listCorrections(filter);
  }

  public listContradictions(filter?: {
    status?: MetacognitiveContradictionItem['status'];
    limit?: number;
  }): MetacognitiveContradictionItem[] {
    return this.repo.listContradictions(filter);
  }

  public resolveContradiction(id: string, resolutionNotes: string): void {
    this.repo.updateContradictionStatus(id, 'resolved', resolutionNotes);
    this.logger.info(`Resolved contradiction ${id}: ${resolutionNotes}`);
  }
}
