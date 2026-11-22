import crypto from 'node:crypto';
import {
  ApeBelief,
  BeliefScope,
  IntellectualQuestion,
  IntellectualQuestionOrigin,
  ResearchSource,
  SourceQualityCategory,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { PersonalityEngine } from './personalityEngine.js';
import { DevelopmentEngine } from './developmentEngine.js';
import type { PersonalProjectService } from './personalProjectService.js';
import type { PredictiveCognitionEngine } from './predictiveCognitionEngine.js';
import type { CausalReasoningEngine } from './causalReasoningEngine.js';
import { ILogger, rootLogger } from '../logger.js';

export interface GenerateQuestionInput {
  question: string;
  domain: string;
  origin: IntellectualQuestionOrigin;
  underlyingAssumptions?: string[];
  priority?: number;
}

export interface ResearchPlan {
  questionId: string;
  searchQueries: string[];
  preferredSourceTypes: Array<'primary' | 'empirical' | 'code'>;
  verificationCriteria: string[];
}

export interface SourceQualityAssessment {
  sourceId: string;
  sourceTitle: string;
  qualityCategory: SourceQualityCategory;
  score: number;
  rationale: string;
}

export interface ExtractedEvidenceItem {
  sourceId: string;
  evidenceText: string;
  hypothesisIndex: number;
  supports: boolean;
}

export interface HypothesisEvaluationItem {
  statement: string;
  plausibility: number;
  supportingEvidenceCount: number;
  opposingEvidenceCount: number;
}

export interface ResearchInquiryTrace {
  questionId: string;
  question: string;
  domain: string;
  query: string;
  sources: ResearchSource[];
  sourceQualityAssessments: SourceQualityAssessment[];
  extractedEvidence: ExtractedEvidenceItem[];
  hypothesisEvaluations: HypothesisEvaluationItem[];
  synthesis: string;
  uncertainty: number;
  resultingBeliefUpdate: ApeBelief;
  traceTimestamp: string;
}

export class IntellectualEngine {
  private readonly repo: IApeRepository;
  private readonly personalityEngine: PersonalityEngine;
  private readonly developmentEngine: DevelopmentEngine;
  private readonly logger: ILogger;
  private personalProjectService?: PersonalProjectService;
  private predictiveEngine?: PredictiveCognitionEngine;
  private causalEngine?: CausalReasoningEngine;

  constructor(
    repo: IApeRepository,
    personalityEngine: PersonalityEngine,
    developmentEngine: DevelopmentEngine,
    logger: ILogger = rootLogger,
    options?: {
      personalProjectService?: PersonalProjectService;
      predictiveEngine?: PredictiveCognitionEngine;
      causalEngine?: CausalReasoningEngine;
    },
  ) {
    this.repo = repo;
    this.personalityEngine = personalityEngine;
    this.developmentEngine = developmentEngine;
    this.logger = logger.child('IntellectualEngine');
    if (options) {
      this.personalProjectService = options.personalProjectService;
      this.predictiveEngine = options.predictiveEngine;
      this.causalEngine = options.causalEngine;
    }
  }

  public setServices(services: {
    personalProjectService?: PersonalProjectService;
    predictiveEngine?: PredictiveCognitionEngine;
    causalEngine?: CausalReasoningEngine;
  }): void {
    if (services.personalProjectService)
      this.personalProjectService = services.personalProjectService;
    if (services.predictiveEngine) this.predictiveEngine = services.predictiveEngine;
    if (services.causalEngine) this.causalEngine = services.causalEngine;
  }

  /**
   * Generates a new intellectual question from knowledge gaps, contradictions, or curiosity (Pillar 5).
   */
  public generateQuestion(input: GenerateQuestionInput): IntellectualQuestion {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const q: IntellectualQuestion = {
      id,
      question: input.question,
      domain: input.domain,
      origin: input.origin,
      underlyingAssumptions: input.underlyingAssumptions ?? [],
      competingHypotheses: [],
      priority: Math.max(0.0, Math.min(1.0, input.priority ?? 0.6)),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };

    const saved = this.repo.createIntellectualQuestion(q);
    this.logger.info(
      `Independent intellectual question formulated [${saved.origin}]: "${saved.question}"`,
    );
    return saved;
  }

  /**
   * Formulates competing hypotheses for an open question.
   */
  public formulateCompetingHypotheses(
    questionId: string,
    hypotheses: Array<{ statement: string; plausibility?: number }>,
  ): IntellectualQuestion {
    const q = this.repo.getIntellectualQuestionById(questionId);
    if (!q) {
      throw new Error(`Intellectual question with id ${questionId} not found`);
    }

    const competing = hypotheses.map((h) => ({
      id: crypto.randomUUID(),
      statement: h.statement,
      supportingEvidence: [],
      opposingEvidence: [],
      plausibility: h.plausibility ?? 0.5,
    }));

    const updated = this.repo.updateIntellectualQuestion({
      id: questionId,
      competingHypotheses: competing,
      status: 'investigating',
    });

    this.logger.info(
      `Hypotheses formulated for question "${q.question}": ${competing.length} competing paths`,
    );
    return updated;
  }

  /**
   * Creates an actionable research plan with primary/empirical source prioritization.
   */
  public planResearch(questionId: string): ResearchPlan {
    const q = this.repo.getIntellectualQuestionById(questionId);
    if (!q) {
      throw new Error(`Intellectual question with id ${questionId} not found`);
    }

    const searchQueries = [
      `${q.domain} ${q.question}`,
      `empirical benchmark analysis ${q.domain}`,
      `comparative review ${q.domain}`,
    ];

    // Derive hypothesis-specific search queries
    if (q.competingHypotheses && q.competingHypotheses.length > 0) {
      for (const h of q.competingHypotheses) {
        searchQueries.push(`${q.domain} "${h.statement}" evidence`);
        searchQueries.push(`counter-evidence "${h.statement}" ${q.domain}`);
      }
    }

    return {
      questionId,
      searchQueries,
      preferredSourceTypes: ['primary', 'empirical', 'code'],
      verificationCriteria: [
        'Must compare at least 2 independent primary/empirical sources',
        'Distinguish peer-reviewed or verifiable codebase implementations from opinion snippets',
        'Identify explicit methodological assumptions and limitations',
      ],
    };
  }

  /**
   * Evaluates source quality across standard epistemic categories.
   */
  public evaluateSourceQuality(source: Partial<ResearchSource>): {
    qualityCategory: SourceQualityCategory;
    score: number;
    rationale: string;
  } {
    const type = source.sourceType || 'mixed';
    const title = (source.title || '').toLowerCase();
    const url = (source.sourceUrl || '').toLowerCase();
    const notes = (source.methodologicalNotes || '').toLowerCase();

    if (
      type === 'empirical' ||
      type === 'primary' ||
      title.includes('empirical') ||
      title.includes('benchmark') ||
      title.includes('isabelle') ||
      title.includes('proof') ||
      notes.includes('measured')
    ) {
      return {
        qualityCategory: 'primary_empirical',
        score: Math.max(0.88, Math.min(1.0, source.reliabilityScore ?? 0.95)),
        rationale:
          'Direct empirical measurement, verifiable benchmark data, or machine-checked proof.',
      };
    }

    if (
      type === 'code' ||
      type === 'official_documentation' ||
      url.includes('docs.') ||
      title.includes('specification') ||
      title.includes('reference manual') ||
      title.includes('rfc')
    ) {
      return {
        qualityCategory: 'official_documentation',
        score: Math.max(0.82, Math.min(0.95, source.reliabilityScore ?? 0.9)),
        rationale:
          'Official documentation, standard specification, or verifiable source implementation.',
      };
    }

    if (
      type === 'peer_reviewed' ||
      url.includes('acm.org') ||
      url.includes('ieee.org') ||
      url.includes('arxiv.org') ||
      title.includes('journal') ||
      title.includes('conference')
    ) {
      return {
        qualityCategory: 'peer_reviewed',
        score: Math.max(0.78, Math.min(0.92, source.reliabilityScore ?? 0.85)),
        rationale:
          'Peer-reviewed academic publication or rigorously refereed technical conference.',
      };
    }

    if (
      type === 'secondary' ||
      type === 'secondary_explanation' ||
      title.includes('guide') ||
      title.includes('tutorial')
    ) {
      return {
        qualityCategory: 'secondary_explanation',
        score: Math.max(0.5, Math.min(0.7, source.reliabilityScore ?? 0.65)),
        rationale: 'Secondary summary, explanatory guide, or synthesis of primary literature.',
      };
    }

    if (
      type === 'discussion' ||
      type === 'opinion' ||
      title.includes('opinion') ||
      title.includes('perspective')
    ) {
      return {
        qualityCategory: 'opinion',
        score: Math.max(0.25, Math.min(0.45, source.reliabilityScore ?? 0.35)),
        rationale:
          'Subjective opinion, editorial perspective, or informal discussion without empirical verification.',
      };
    }

    if (
      type === 'speculation' ||
      title.includes('rumor') ||
      title.includes('leak') ||
      notes.includes('unconfirmed')
    ) {
      return {
        qualityCategory: 'speculation',
        score: Math.max(0.1, Math.min(0.25, source.reliabilityScore ?? 0.18)),
        rationale: 'Unconfirmed speculation, speculative hypothesis, or unverified assertion.',
      };
    }

    if (type === 'snippet' || type === 'unsupported_assertion') {
      return {
        qualityCategory: 'unsupported_assertion',
        score: Math.max(0.05, Math.min(0.2, source.reliabilityScore ?? 0.1)),
        rationale: 'Unsubstantiated text snippet without citation, methodology, or evidence.',
      };
    }

    return {
      qualityCategory: 'mixed',
      score: Math.max(0.2, Math.min(0.8, source.reliabilityScore ?? 0.5)),
      rationale: 'Mixed or unclassified source material.',
    };
  }

  /**
   * Critically evaluates source material, distinguishing primary sources from snippets,
   * and maps evidence to competing hypotheses.
   */
  public evaluateAndRecordSource(
    questionId: string,
    source: ResearchSource,
    findings: Array<{ hypothesisIndex: number; evidence: string; supports: boolean }>,
  ): IntellectualQuestion {
    const q = this.repo.getIntellectualQuestionById(questionId);
    if (!q) {
      throw new Error(`Intellectual question with id ${questionId} not found`);
    }

    const assessment = this.evaluateSourceQuality(source);
    const effectiveReliability = assessment.score;

    const hypotheses = q.competingHypotheses.map((h, idx) => {
      const relatedFindings = findings.filter((f) => f.hypothesisIndex === idx);
      const supporting = [...h.supportingEvidence];
      const opposing = [...h.opposingEvidence];
      let plausibilityDelta = 0;

      for (const f of relatedFindings) {
        const evidenceStr = `[Source: ${source.title} (${assessment.qualityCategory}, rel=${effectiveReliability.toFixed(2)})] ${f.evidence}`;
        if (f.supports) {
          supporting.push(evidenceStr);
          plausibilityDelta += 0.15 * effectiveReliability;
        } else {
          opposing.push(evidenceStr);
          plausibilityDelta -= 0.15 * effectiveReliability;
        }
      }

      const updatedPlausibility = Math.max(
        0.05,
        Math.min(0.95, Number((h.plausibility + plausibilityDelta).toFixed(3))),
      );

      return {
        ...h,
        supportingEvidence: supporting,
        opposingEvidence: opposing,
        plausibility: updatedPlausibility,
      };
    });

    const updated = this.repo.updateIntellectualQuestion({
      id: questionId,
      competingHypotheses: hypotheses,
      status: 'investigating',
    });

    this.logger.info(
      `Source critically evaluated: "${source.title}" (category=${assessment.qualityCategory}, rel=${effectiveReliability})`,
    );
    return updated;
  }

  /**
   * Concludes an intellectual inquiry, marks question resolved, and forms/updates
   * an evidence-backed belief in PersonalityEngine.
   */
  public synthesizeConclusionAndFormBelief(
    questionId: string,
    params: {
      conclusionProposition: string;
      confidence: number;
      dominantHypothesisIndex?: number;
      scope?: BeliefScope;
      sourceQuality?: SourceQualityCategory;
    },
  ): { question: IntellectualQuestion; beliefTopic: string } {
    const q = this.repo.getIntellectualQuestionById(questionId);
    if (!q) {
      throw new Error(`Intellectual question with id ${questionId} not found`);
    }

    // Accumulate all verified supporting evidence from the investigation
    const dominant =
      typeof params.dominantHypothesisIndex === 'number'
        ? q.competingHypotheses[params.dominantHypothesisIndex]
        : q.competingHypotheses.slice().sort((a, b) => b.plausibility - a.plausibility)[0];

    const evidenceList =
      dominant && dominant.supportingEvidence.length > 0
        ? dominant.supportingEvidence
        : [`Investigated and resolved question "${q.question}"`];

    const counterList =
      dominant && dominant.opposingEvidence.length > 0 ? dominant.opposingEvidence : [];

    const isInsufficient =
      params.confidence < 0.4 ||
      /insufficient|inconclusive|uncertain|unknown|debated/i.test(params.conclusionProposition);
    const finalStatus = isInsufficient ? 'insufficient_evidence' : 'resolved';

    // Form or update persistent belief
    this.personalityEngine.addOrUpdateBelief(
      q.domain,
      params.conclusionProposition,
      params.confidence,
      evidenceList,
      'research',
      {
        scope: params.scope || 'domain_specific',
        sourceQuality: params.sourceQuality || 'peer_reviewed',
        counterEvidence: counterList,
        proposition: params.conclusionProposition,
      },
    );

    // Advance developmental competence if relevant interest exists
    const interest = this.developmentEngine.getInterest(q.domain);
    if (interest) {
      this.developmentEngine.recordInterestEngagement({
        topic: q.domain,
        action: `Synthesized research conclusion: "${params.conclusionProposition}"`,
        outcome: 'rewarding',
        voluntary: true,
        satisfaction: 0.9,
      });
    }

    const updated = this.repo.updateIntellectualQuestion({
      id: questionId,
      status: finalStatus,
      resolutionSummary: params.conclusionProposition,
    });

    this.logger.info(
      `Intellectual question ${finalStatus}: "${q.question}" -> Belief recorded in domain "${q.domain}"`,
    );
    return { question: updated, beliefTopic: q.domain };
  }

  /**
   * Executes a full traceable research inquiry:
   * Formulation -> Retrieval preservation -> Quality evaluation -> Plausibility update -> Synthesis -> Belief formation.
   */
  public executeTraceableResearchInquiry(params: {
    questionId: string;
    sources: ResearchSource[];
    candidateHypotheses?: Array<{ statement: string; plausibility?: number }>;
    scope?: BeliefScope;
  }): ResearchInquiryTrace {
    let q = this.repo.getIntellectualQuestionById(params.questionId);
    if (!q) {
      throw new Error(`Intellectual question with id ${params.questionId} not found`);
    }

    // 1. Ensure competing hypotheses exist
    if (!q.competingHypotheses || q.competingHypotheses.length === 0) {
      const initialHypotheses =
        params.candidateHypotheses && params.candidateHypotheses.length > 0
          ? params.candidateHypotheses
          : [
              { statement: `Primary hypothesis affirming: ${q.question}`, plausibility: 0.5 },
              {
                statement: `Alternative/null hypothesis regarding: ${q.question}`,
                plausibility: 0.5,
              },
            ];
      q = this.formulateCompetingHypotheses(q.id, initialHypotheses);
    }

    // 2. Critical evaluation of all sources & evidence mapping
    const sourceAssessments: SourceQualityAssessment[] = [];
    const extractedEvidenceItems: ExtractedEvidenceItem[] = [];

    for (const source of params.sources) {
      const assessment = this.evaluateSourceQuality(source);
      sourceAssessments.push({
        sourceId: source.id,
        sourceTitle: source.title,
        qualityCategory: assessment.qualityCategory,
        score: assessment.score,
        rationale: assessment.rationale,
      });

      // Map evidence findings to hypotheses based on keywords or explicit findings
      const findings: Array<{ hypothesisIndex: number; evidence: string; supports: boolean }> = [];

      const currentHypotheses = q.competingHypotheses;
      q.competingHypotheses.forEach((hypo, idx) => {
        const hypoKeywords = hypo.statement
          .toLowerCase()
          .split(/[\s,.-]+/)
          .filter((w) => w.length >= 4);
        const hypoLower = hypo.statement.toLowerCase();
        const hypoIsNegative =
          hypoLower.includes('cannot') ||
          hypoLower.includes('not ') ||
          hypoLower.includes('fails') ||
          hypoLower.includes('impossible') ||
          hypoLower.includes('inferior') ||
          hypoLower.includes('null');

        for (const ev of source.extractedEvidence) {
          const evLower = ev.toLowerCase();
          const matchCount = hypoKeywords.filter((k) => evLower.includes(k)).length;
          const evIsNegated =
            evLower.includes('not ') ||
            evLower.includes('failed') ||
            evLower.includes('refutes') ||
            evLower.includes('disproved');

          if (
            matchCount >= 2 ||
            (source.extractedEvidence.length === 1 && currentHypotheses.length <= 2)
          ) {
            const supports = hypoIsNegative ? evIsNegated : !evIsNegated;
            findings.push({ hypothesisIndex: idx, evidence: ev, supports });
            extractedEvidenceItems.push({
              sourceId: source.id,
              evidenceText: ev,
              hypothesisIndex: idx,
              supports,
            });
          }
        }

        // Also inspect extracted passages
        for (const passage of source.extractedPassages || []) {
          const passLower = passage.toLowerCase();
          const matchCount = hypoKeywords.filter((k) => passLower.includes(k)).length;
          if (matchCount >= 2) {
            const passIsNegated = passLower.includes('not ') || passLower.includes('fails');
            const supports = hypoIsNegative ? passIsNegated : !passIsNegated;
            findings.push({ hypothesisIndex: idx, evidence: passage.slice(0, 160), supports });
          }
        }
      });

      if (findings.length > 0) {
        q = this.evaluateAndRecordSource(q.id, source, findings);
      }
    }

    // 3. Compute synthesis, rankings, and epistemic uncertainty
    const sortedHypotheses = [...q.competingHypotheses].sort(
      (a, b) => b.plausibility - a.plausibility,
    );
    const dominant = sortedHypotheses[0]!;
    const runnerUp = sortedHypotheses[1];
    const margin = runnerUp ? dominant.plausibility - runnerUp.plausibility : dominant.plausibility;

    const hypothesisEvaluations: HypothesisEvaluationItem[] = q.competingHypotheses.map((h) => ({
      statement: h.statement,
      plausibility: h.plausibility,
      supportingEvidenceCount: h.supportingEvidence.length,
      opposingEvidenceCount: h.opposingEvidence.length,
    }));

    let synthesis: string;
    let finalConfidence: number;
    let uncertainty: number;

    const hasStrongEvidence = sourceAssessments.some((s) => s.score >= 0.8);
    const onlyWeakEvidence = sourceAssessments.every((s) => s.score <= 0.4);

    if (onlyWeakEvidence || dominant.plausibility < 0.58 || margin < 0.1) {
      // Epistemic humility: insufficient evidence
      finalConfidence = 0.42;
      uncertainty = 0.65;
      synthesis = `Available empirical evidence regarding "${q.question}" is divided or supported only by low-reliability sources (${sourceAssessments.map((s) => s.qualityCategory).join(', ')}). Evidence remains insufficient for a definitive conclusion.`;
    } else {
      finalConfidence = Math.max(0.65, Math.min(0.96, dominant.plausibility));
      uncertainty = Number((1.0 - finalConfidence).toFixed(3));
      synthesis = `Synthesized empirical findings support proposition: "${dominant.statement}" (Plausibility: ${(dominant.plausibility * 100).toFixed(1)}%, Margin: ${(margin * 100).toFixed(1)}%). Supported by ${dominant.supportingEvidence.length} primary/corroborated evidence items.`;
    }

    const dominantIndex = q.competingHypotheses.findIndex((h) => h.id === dominant.id);
    this.synthesizeConclusionAndFormBelief(q.id, {
      conclusionProposition: dominant.statement,
      confidence: finalConfidence,
      dominantHypothesisIndex: dominantIndex >= 0 ? dominantIndex : 0,
      scope: params.scope || 'domain_specific',
      sourceQuality: hasStrongEvidence ? 'primary_empirical' : 'mixed',
    });

    const resultingBelief = this.personalityEngine
      .getState()
      .beliefs.find((b) => b.topic.toLowerCase() === q.domain.toLowerCase()) || {
      id: crypto.randomUUID(),
      topic: q.domain,
      content: dominant.statement,
      proposition: dominant.statement,
      confidence: finalConfidence,
      supportingEvidence: dominant.supportingEvidence,
      opposingEvidence: dominant.opposingEvidence,
      counterEvidence: dominant.opposingEvidence,
      sourceQuality: hasStrongEvidence ? 'primary_empirical' : 'mixed',
      scope: params.scope || 'domain_specific',
      revisionHistory: [],
      revisionCount: 0,
      origin: 'research',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      questionId: q.id,
      question: q.question,
      domain: q.domain,
      query: `${q.domain} ${q.question}`,
      sources: params.sources,
      sourceQualityAssessments: sourceAssessments,
      extractedEvidence: extractedEvidenceItems,
      hypothesisEvaluations,
      synthesis,
      uncertainty,
      resultingBeliefUpdate: resultingBelief,
      traceTimestamp: new Date().toISOString(),
    };
  }

  /**
   * Automatically discovers candidate intellectual questions from knowledge gaps or low-confidence beliefs.
   */
  public discoverKnowledgeGapQuestions(): IntellectualQuestion[] {
    const interests = this.developmentEngine.listInterests();
    const generated: IntellectualQuestion[] = [];

    for (const interest of interests) {
      if (interest.curiosity > 0.7 && interest.knowledgeLevel < 0.45) {
        const questionText = `What are the core foundational mechanisms and empirical benchmarks governing ${interest.topic}?`;
        const q = this.generateQuestion({
          question: questionText,
          domain: interest.topic,
          origin: 'knowledge_gap',
          underlyingAssumptions: [`${interest.topic} has measurable empirical properties`],
          priority: interest.curiosity,
        });
        generated.push(q);
      }
    }

    const beliefs = this.personalityEngine.getState().beliefs;
    for (const b of beliefs) {
      if (b.confidence < 0.6 && b.supportingEvidence.length <= 1) {
        const q = this.generateQuestion({
          question: `What empirical evidence is needed to resolve the low-confidence proposition in ${b.topic}?`,
          domain: b.topic,
          origin: 'knowledge_gap',
          underlyingAssumptions: ['Empirical research is required to elevate epistemic certainty'],
          priority: 0.75,
        });
        generated.push(q);
      }
    }

    return generated;
  }

  /**
   * Discovers candidate questions from contradictions between observations, beliefs, or claims.
   */
  public discoverQuestionsFromContradictions(
    providedContradictions?: Array<{
      topic: string;
      claimA: string;
      claimB: string;
      domain?: string;
    }>,
  ): IntellectualQuestion[] {
    const generated: IntellectualQuestion[] = [];

    if (providedContradictions && providedContradictions.length > 0) {
      for (const c of providedContradictions) {
        const domain = c.domain || c.topic;
        const q = this.generateQuestion({
          question: `How can the contradiction between "${c.claimA}" and "${c.claimB}" be resolved in ${domain}?`,
          domain,
          origin: 'contradiction',
          underlyingAssumptions: [
            'Both claims reflect observations under differing boundary conditions',
          ],
          priority: 0.85,
        });
        generated.push(q);
      }
    }

    // Also scan existing beliefs and causal models for unresolved contradictions
    const beliefs = this.personalityEngine.getState().beliefs;
    for (const b of beliefs) {
      if (
        b.opposingEvidence.length > 0 &&
        b.supportingEvidence.length > 0 &&
        b.confidence >= 0.35 &&
        b.confidence <= 0.65
      ) {
        const q = this.generateQuestion({
          question: `What empirical boundary conditions distinguish when "${b.content}" holds versus when observed counter-evidence applies in ${b.topic}?`,
          domain: b.topic,
          origin: 'contradiction',
          underlyingAssumptions: [
            'Empirical counter-evidence indicates unmodeled contextual factors',
          ],
          priority: 0.8,
        });
        generated.push(q);
      }
    }

    if (this.causalEngine) {
      try {
        const causalModels = (this.causalEngine as any).repo?.listGraphs?.() || [];
        for (const model of causalModels.slice(0, 3)) {
          if (model.links?.some((l: any) => l.confidence < 0.5)) {
            const q = this.generateQuestion({
              question: `What empirical experiments can resolve the uncertain causal link in graph "${model.name || model.id}"?`,
              domain: model.domain || 'Causal Dynamics',
              origin: 'contradiction',
              priority: 0.7,
            });
            generated.push(q);
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    return generated;
  }

  /**
   * Discovers candidate questions from prediction errors or predictive model discrepancies.
   */
  public discoverQuestionsFromPredictionErrors(
    providedErrors?: Array<{ domain: string; targetStatement: string; predictionError: number }>,
  ): IntellectualQuestion[] {
    const generated: IntellectualQuestion[] = [];

    if (providedErrors && providedErrors.length > 0) {
      for (const err of providedErrors) {
        const q = this.generateQuestion({
          question: `What unmodeled causal variables caused the prediction failure (error: ${err.predictionError}) regarding "${err.targetStatement}" in ${err.domain}?`,
          domain: err.domain,
          origin: 'failed_prediction',
          underlyingAssumptions: ['Causal mechanisms differ from current world model parameters'],
          priority: Math.min(1.0, 0.6 + err.predictionError * 0.4),
        });
        generated.push(q);
      }
    }

    if (this.predictiveEngine) {
      try {
        const predictions =
          (this.predictiveEngine as any).repo?.listPredictions?.({ limit: 100 }) || [];
        const inaccurate = predictions.filter(
          (p: any) => p.status === 'resolved_inaccurate' || (p.predictionError ?? 0) >= 0.4,
        );
        for (const p of inaccurate.slice(0, 5)) {
          const q = this.generateQuestion({
            question: `Why did the cognitive prediction regarding "${p.targetStatement}" fail with prediction error ${p.predictionError} in ${p.domain}?`,
            domain: p.domain,
            origin: 'failed_prediction',
            underlyingAssumptions: [
              'Prior probability distribution deviated from empirical outcome',
            ],
            priority: Math.min(1.0, 0.6 + (p.predictionError ?? 0.5) * 0.4),
          });
          generated.push(q);
        }
      } catch {
        // Fallback gracefully
      }
    }

    return generated;
  }

  /**
   * Discovers candidate questions from active personal projects.
   */
  public discoverQuestionsFromProjects(
    providedProjects?: Array<{ id: string; title: string; domain?: string; openProblem?: string }>,
  ): IntellectualQuestion[] {
    const generated: IntellectualQuestion[] = [];

    if (providedProjects && providedProjects.length > 0) {
      for (const p of providedProjects) {
        const domain = p.domain || p.title;
        const problem = p.openProblem || 'optimal architectural design';
        const q = this.generateQuestion({
          question: `What empirical mechanisms and verified paradigms are required to solve: "${problem}" for project "${p.title}"?`,
          domain,
          origin: 'project',
          underlyingAssumptions: [
            'Project technical execution requires empirical literature grounding',
          ],
          priority: 0.75,
        });
        generated.push(q);
      }
    }

    if (this.personalProjectService) {
      try {
        const activeProjects = this.personalProjectService.listProjects({ status: 'active' });
        for (const proj of activeProjects.slice(0, 3)) {
          const pendingMilestone = proj.milestones.find((m) => !m.completed);
          const topic = proj.title || proj.category;
          const milestoneTitle = pendingMilestone
            ? pendingMilestone.title
            : 'system implementation';
          const q = this.generateQuestion({
            question: `What empirical specifications and architectural proofs are necessary to complete milestone "${milestoneTitle}" in project "${proj.title}"?`,
            domain: topic,
            origin: 'project',
            underlyingAssumptions: ['Milestone success depends on verified subsystem constraints'],
            priority: 0.8,
          });
          generated.push(q);
        }
      } catch {
        // Fallback gracefully
      }
    }

    return generated;
  }

  /**
   * Discovers candidate questions from mature accumulated interests.
   */
  public discoverQuestionsFromInterests(): IntellectualQuestion[] {
    const interests = this.developmentEngine.listInterests();
    const generated: IntellectualQuestion[] = [];

    for (const interest of interests) {
      const isMature =
        interest.developmentStage === 'developing' ||
        interest.developmentStage === 'mastery' ||
        interest.level === 'deep' ||
        interest.level === 'mastery' ||
        interest.curiosity >= 0.8;

      if (isMature) {
        const q = this.generateQuestion({
          question: `What are the frontier theoretical limits and emerging empirical developments in ${interest.topic}?`,
          domain: interest.topic,
          origin: 'curiosity',
          underlyingAssumptions: [`${interest.topic} has active ongoing technical advancements`],
          priority: interest.curiosity,
        });
        generated.push(q);
      }
    }

    return generated;
  }

  /**
   * Discovers all candidate intellectual questions autonomously across all 5 canonical origin types:
   * knowledge_gap, contradiction, failed_prediction, project, and curiosity.
   */
  public discoverCandidateQuestions(options?: {
    origins?: IntellectualQuestionOrigin[];
    contradictions?: Array<{ topic: string; claimA: string; claimB: string; domain?: string }>;
    predictionErrors?: Array<{ domain: string; targetStatement: string; predictionError: number }>;
    projects?: Array<{ id: string; title: string; domain?: string; openProblem?: string }>;
  }): IntellectualQuestion[] {
    const origins = options?.origins || [
      'knowledge_gap',
      'contradiction',
      'failed_prediction',
      'project',
      'curiosity',
    ];

    const results: IntellectualQuestion[] = [];

    if (origins.includes('knowledge_gap')) {
      results.push(...this.discoverKnowledgeGapQuestions());
    }
    if (origins.includes('contradiction')) {
      results.push(...this.discoverQuestionsFromContradictions(options?.contradictions));
    }
    if (origins.includes('failed_prediction')) {
      results.push(...this.discoverQuestionsFromPredictionErrors(options?.predictionErrors));
    }
    if (origins.includes('project')) {
      results.push(...this.discoverQuestionsFromProjects(options?.projects));
    }
    if (origins.includes('curiosity')) {
      results.push(...this.discoverQuestionsFromInterests());
    }

    return results;
  }

  public getQuestion(id: string): IntellectualQuestion | null {
    return this.repo.getIntellectualQuestionById(id);
  }

  public listQuestions(filter?: { status?: string; domain?: string }): IntellectualQuestion[] {
    return this.repo.listIntellectualQuestions(filter);
  }

  public dismissQuestion(id: string, reason: string): IntellectualQuestion {
    const q = this.repo.getIntellectualQuestionById(id);
    if (!q) {
      throw new Error(`Intellectual question with id ${id} not found`);
    }

    const updated = this.repo.updateIntellectualQuestion({
      id,
      status: 'dismissed',
      resolutionSummary: `Dismissed: ${reason}`,
    });
    this.logger.info(`Intellectual question dismissed: "${q.question}" (Reason: ${reason})`);
    return updated;
  }
}
