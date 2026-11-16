import crypto from 'node:crypto';
import {
  IntellectualQuestion,
  IntellectualQuestionOrigin,
  ResearchSource,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { PersonalityEngine } from './personalityEngine.js';
import { DevelopmentEngine } from './developmentEngine.js';
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

export class IntellectualEngine {
  private readonly repo: IApeRepository;
  private readonly personalityEngine: PersonalityEngine;
  private readonly developmentEngine: DevelopmentEngine;
  private readonly logger: ILogger;

  constructor(
    repo: IApeRepository,
    personalityEngine: PersonalityEngine,
    developmentEngine: DevelopmentEngine,
    logger: ILogger = rootLogger,
  ) {
    this.repo = repo;
    this.personalityEngine = personalityEngine;
    this.developmentEngine = developmentEngine;
    this.logger = logger.child('IntellectualEngine');
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
    this.logger.info(`Independent intellectual question formulated [${saved.origin}]: "${saved.question}"`);
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

    this.logger.info(`Hypotheses formulated for question "${q.question}": ${competing.length} competing paths`);
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

    // Critical evaluation safeguard: snippet-only secondary sources receive lower reliability
    const effectiveReliability = source.sourceType === 'snippet'
      ? Math.min(source.reliabilityScore, 0.4)
      : source.sourceType === 'primary' || source.sourceType === 'empirical'
      ? Math.max(source.reliabilityScore, 0.85)
      : source.reliabilityScore;

    const hypotheses = q.competingHypotheses.map((h, idx) => {
      const relatedFindings = findings.filter((f) => f.hypothesisIndex === idx);
      const supporting = [...h.supportingEvidence];
      const opposing = [...h.opposingEvidence];
      let plausibilityDelta = 0;

      for (const f of relatedFindings) {
        const evidenceStr = `[Source: ${source.title} (${source.sourceType}, rel=${effectiveReliability})] ${f.evidence}`;
        if (f.supports) {
          supporting.push(evidenceStr);
          plausibilityDelta += 0.15 * effectiveReliability;
        } else {
          opposing.push(evidenceStr);
          plausibilityDelta -= 0.15 * effectiveReliability;
        }
      }

      const updatedPlausibility = Math.max(0.05, Math.min(0.95, Number((h.plausibility + plausibilityDelta).toFixed(3))));

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

    this.logger.info(`Source critically evaluated: "${source.title}" (type=${source.sourceType}, rel=${effectiveReliability})`);
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
    },
  ): { question: IntellectualQuestion; beliefTopic: string } {
    const q = this.repo.getIntellectualQuestionById(questionId);
    if (!q) {
      throw new Error(`Intellectual question with id ${questionId} not found`);
    }

    // Accumulate all verified supporting evidence from the investigation
    const dominant = typeof params.dominantHypothesisIndex === 'number'
      ? q.competingHypotheses[params.dominantHypothesisIndex]
      : q.competingHypotheses.sort((a, b) => b.plausibility - a.plausibility)[0];

    const evidenceList = dominant ? dominant.supportingEvidence : [`Investigated and resolved question "${q.question}"`];

    // Form or update persistent belief
    this.personalityEngine.addOrUpdateBelief(
      q.domain,
      params.conclusionProposition,
      params.confidence,
      evidenceList,
      'research',
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
      status: 'resolved',
      resolutionSummary: params.conclusionProposition,
    });

    this.logger.info(`Intellectual question resolved: "${q.question}" -> Belief formed in domain "${q.domain}"`);
    return { question: updated, beliefTopic: q.domain };
  }

  /**
   * Automatically discovers candidate intellectual questions from knowledge gaps or low-confidence beliefs.
   */
  public discoverKnowledgeGapQuestions(): IntellectualQuestion[] {
    const interests = this.developmentEngine.listInterests();
    const generated: IntellectualQuestion[] = [];

    for (const interest of interests) {
      // Knowledge gap: high curiosity (> 0.75) but low knowledge (< 0.4)
      if (interest.curiosity > 0.75 && interest.knowledgeLevel < 0.4) {
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

    return generated;
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
