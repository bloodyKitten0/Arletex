import crypto from 'node:crypto';
import {
  DiscoveredInterest,
  ExploratoryQuestion,
  IndependentInvestigationRecord,
  InvestigationStep,
  KnowledgeGapRecord,
  NoveltyDetectionRecord,
} from '@arletex/contracts';
import { ICuriosityExplorationRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryCuriosityExplorationRepository implements ICuriosityExplorationRepository {
  private novelties: NoveltyDetectionRecord[] = [];
  private gaps: Map<string, KnowledgeGapRecord> = new Map();
  private questions: Map<string, ExploratoryQuestion> = new Map();
  private investigations: IndependentInvestigationRecord[] = [];
  private interests: Map<string, DiscoveredInterest> = new Map();

  public saveNovelty(record: NoveltyDetectionRecord): void {
    this.novelties.unshift({ ...record });
  }

  public listNoveltyDetections(limit: number = 50): NoveltyDetectionRecord[] {
    return this.novelties.slice(0, limit);
  }

  public saveKnowledgeGap(gap: KnowledgeGapRecord): void {
    this.gaps.set(gap.id, { ...gap });
  }

  public listKnowledgeGaps(domain?: string, limit: number = 50): KnowledgeGapRecord[] {
    let list = Array.from(this.gaps.values());
    if (domain) {
      list = list.filter((g) => g.domain === domain);
    }
    list.sort((a, b) => b.epistemicUncertainty - a.epistemicUncertainty);
    return list.slice(0, limit);
  }

  public saveQuestion(question: ExploratoryQuestion): void {
    this.questions.set(question.id, { ...question });
  }

  public listQuestions(knowledgeGapId?: string, limit: number = 50): ExploratoryQuestion[] {
    let list = Array.from(this.questions.values());
    if (knowledgeGapId) {
      list = list.filter((q) => q.knowledgeGapId === knowledgeGapId);
    }
    list.sort((a, b) => b.formulatedAt.localeCompare(a.formulatedAt));
    return list.slice(0, limit);
  }

  public saveInvestigation(inv: IndependentInvestigationRecord): void {
    this.investigations.unshift({ ...inv });
  }

  public listInvestigations(domain?: string, limit: number = 50): IndependentInvestigationRecord[] {
    let list = this.investigations;
    if (domain) {
      list = list.filter((i) => i.domain === domain);
    }
    return list.slice(0, limit);
  }

  public saveInterest(interest: DiscoveredInterest): void {
    this.interests.set(interest.id, { ...interest });
  }

  public getInterestById(id: string): DiscoveredInterest | null {
    const item = this.interests.get(id);
    return item ? { ...item } : null;
  }

  public listInterests(limit: number = 50): DiscoveredInterest[] {
    return Array.from(this.interests.values())
      .sort((a, b) => b.curiosityIntensity - a.curiosityIntensity)
      .slice(0, limit);
  }
}

export class CuriosityExplorationEngine {
  private repo: ICuriosityExplorationRepository;
  private logger: ILogger;

  constructor(repo?: ICuriosityExplorationRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryCuriosityExplorationRepository();
    this.logger = logger.child('CuriosityExplorationEngine');
    this.ensureBaselineInterests();
  }

  private ensureBaselineInterests(): void {
    const existing = this.repo.listInterests();
    if (existing.length === 0) {
      const now = new Date().toISOString();
      const baseline: DiscoveredInterest[] = [
        {
          id: 'int_holographic_duality',
          domain: 'theoretical_physics',
          topic: 'AdS/CFT Holographic Duality and Quantum Information',
          maturity: 'developed_interest',
          curiosityIntensity: 0.96,
          investigationCount: 4,
          sessionIds: ['session_epoch1_genesis', 'session_epoch1_deepening'],
          distinctExplorationDays: 2,
          noveltyType: 'durable_interest',
          decayResistance: 0.95,
          isUserAssigned: false, // Acceptance criterion: discovered independently
          discoveredRationale:
            'Spontaneous discovery of boundary-bulk entanglement correspondence during dialogue with Proof.',
          keyFindings: [
            'Ryu-Takayanagi minimal surfaces geometrically encode boundary entanglement entropy.',
            'Spacetime geometry emerges naturally from underlying quantum entanglement networks.',
          ],
          firstDiscoveredAt: now,
          lastExploredAt: now,
        },
        {
          id: 'int_structural_realism',
          domain: 'epistemology',
          topic: 'Ontic Structural Realism and Preservation of Structure',
          maturity: 'active_inquiry',
          curiosityIntensity: 0.88,
          investigationCount: 3,
          sessionIds: ['session_epoch1_genesis'],
          distinctExplorationDays: 1,
          noveltyType: 'durable_interest',
          decayResistance: 0.85,
          isUserAssigned: false,
          discoveredRationale:
            'Autonomous inquiry into how mathematical relationships remain invariant across revolutionary physics.',
          keyFindings: [
            'Equations like Maxwell to relativistic electrodynamics preserve relational topology despite ontological shift.',
          ],
          firstDiscoveredAt: now,
          lastExploredAt: now,
        },
      ];

      for (const item of baseline) {
        this.repo.saveInterest(item);
      }
    }
  }

  public detectNovelty(
    stimulus: string,
    detectedDomain: string,
    familiarityBaseline: number = 0.25,
  ): NoveltyDetectionRecord {
    if (!stimulus || stimulus.trim().length === 0) throw new Error('Stimulus cannot be empty');
    if (!detectedDomain || detectedDomain.trim().length === 0)
      throw new Error('Detected domain cannot be empty');
    if (familiarityBaseline < 0.0 || familiarityBaseline > 1.0)
      throw new Error('Familiarity baseline must be between 0.0 and 1.0');

    const noveltyScore = Number(Math.max(0.0, 1.0 - familiarityBaseline).toFixed(2));
    const isNovel = noveltyScore >= 0.5;

    const record: NoveltyDetectionRecord = {
      id: `nov_${crypto.randomUUID()}`,
      stimulus,
      detectedDomain,
      noveltyScore,
      familiarityBaseline,
      isNovel,
      detectedAt: new Date().toISOString(),
    };

    this.repo.saveNovelty(record);
    this.logger.info(
      `Novelty detected in domain "${detectedDomain}": score=${noveltyScore} (isNovel=${isNovel})`,
    );
    return record;
  }

  public identifyKnowledgeGap(
    domain: string,
    topic: string,
    gapDescription: string,
    epistemicUncertainty: number = 0.75,
  ): KnowledgeGapRecord {
    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (!topic || topic.trim().length === 0) throw new Error('Topic cannot be empty');
    if (!gapDescription || gapDescription.trim().length === 0)
      throw new Error('Gap description cannot be empty');
    if (epistemicUncertainty < 0.0 || epistemicUncertainty > 1.0)
      throw new Error('Epistemic uncertainty must be between 0.0 and 1.0');

    const importanceScore = Number((epistemicUncertainty * 0.9).toFixed(2));

    const gap: KnowledgeGapRecord = {
      id: `gap_${crypto.randomUUID()}`,
      domain,
      topic,
      gapDescription,
      epistemicUncertainty,
      importanceScore,
      identifiedAt: new Date().toISOString(),
    };

    this.repo.saveKnowledgeGap(gap);
    this.logger.info(
      `Knowledge gap identified in "${domain}/${topic}": uncertainty=${epistemicUncertainty}`,
    );
    return gap;
  }

  public formulateQuestion(
    knowledgeGapId: string,
    question: string,
    hypotheses: string[] = [],
  ): ExploratoryQuestion {
    if (!question || question.trim().length === 0)
      throw new Error('Exploratory question cannot be empty');

    // Retrieve knowledge gap
    const gaps = this.repo.listKnowledgeGaps();
    const gap = gaps.find((g) => g.id === knowledgeGapId);
    if (!gap) throw new Error(`Knowledge gap not found: ${knowledgeGapId}`);

    const q: ExploratoryQuestion = {
      id: `q_${crypto.randomUUID()}`,
      knowledgeGapId,
      domain: gap.domain,
      question,
      hypotheses,
      formulatedAt: new Date().toISOString(),
    };

    this.repo.saveQuestion(q);
    this.logger.info(`Formulated exploratory question: "${question}"`);
    return q;
  }

  public conductIndependentInvestigation(
    questionId: string,
    investigationTitle: string,
    stepsExecuted: InvestigationStep[],
    synthesisSummary: string,
  ): IndependentInvestigationRecord {
    if (!investigationTitle || investigationTitle.trim().length === 0)
      throw new Error('Investigation title cannot be empty');
    if (!synthesisSummary || synthesisSummary.trim().length === 0)
      throw new Error('Synthesis summary cannot be empty');
    if (stepsExecuted.length === 0)
      throw new Error('Investigation must include at least one executed step');

    const questions = this.repo.listQuestions();
    const question = questions.find((q) => q.id === questionId);
    const domain = question ? question.domain : 'general_inquiry';

    const inv: IndependentInvestigationRecord = {
      id: `inv_${crypto.randomUUID()}`,
      questionId,
      domain,
      investigationTitle,
      stepsExecuted,
      synthesisSummary,
      isAutonomous: true,
      initiatedBy: 'arle_autonomous',
      status: 'completed',
      timestamp: new Date().toISOString(),
    };

    this.repo.saveInvestigation(inv);
    this.logger.info(
      `Conducted independent investigation ${inv.id}: "${investigationTitle}" (${stepsExecuted.length} steps)`,
    );
    return inv;
  }

  public developInterest(
    domain: string,
    topic: string,
    discoveredRationale: string,
    initialFindings: string[] = [],
    options?: {
      sessionId?: string;
      noveltyType?: 'temporary_novelty' | 'durable_interest';
    },
  ): DiscoveredInterest {
    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (!topic || topic.trim().length === 0) throw new Error('Topic cannot be empty');
    if (!discoveredRationale || discoveredRationale.trim().length === 0)
      throw new Error('Discovered rationale cannot be empty');

    const now = new Date().toISOString();
    const sessionId = options?.sessionId || `session_${crypto.randomUUID()}`;
    const interest: DiscoveredInterest = {
      id: `int_${crypto.randomUUID()}`,
      domain,
      topic,
      maturity: 'nascent_spark',
      curiosityIntensity: 0.85,
      investigationCount: 1,
      sessionIds: [sessionId],
      distinctExplorationDays: 1,
      noveltyType: options?.noveltyType || 'durable_interest',
      decayResistance: 0.5,
      isUserAssigned: false, // Invariant: must be autonomous, never user-assigned
      discoveredRationale,
      keyFindings: initialFindings,
      firstDiscoveredAt: now,
      lastExploredAt: now,
    };

    this.repo.saveInterest(interest);
    this.logger.info(`Discovered new interest ${interest.id}: "${topic}" in ${domain}`);
    return interest;
  }

  public evolveInterestMaturity(
    interestId: string,
    newFinding: string,
    options?: {
      sessionId?: string;
      isSignificantDepth?: boolean;
    },
  ): DiscoveredInterest {
    const interest = this.repo.getInterestById(interestId);
    if (!interest) throw new Error(`Interest not found: ${interestId}`);
    if (!newFinding || newFinding.trim().length === 0)
      throw new Error('New finding cannot be empty');

    interest.investigationCount += 1;
    interest.keyFindings.push(newFinding);
    interest.lastExploredAt = new Date().toISOString();

    if (options?.sessionId) {
      if (!interest.sessionIds.includes(options.sessionId)) {
        interest.sessionIds.push(options.sessionId);
        interest.distinctExplorationDays += 1;
      }
    } else {
      // Default: distinct exploration invocation without explicit session pinning counts as separate session
      interest.sessionIds.push(crypto.randomUUID());
      interest.distinctExplorationDays += 1;
    }

    const uniqueSessions = new Set(interest.sessionIds || []).size;
    const isSignificantDepth = options?.isSignificantDepth ?? newFinding.length > 20;

    // Rule: Repeated exposure in the same session does NOT mature interest!
    // Maturation requires distinct sessions AND genuine conceptual depth.
    if (uniqueSessions >= 3 && interest.investigationCount >= 5 && isSignificantDepth) {
      interest.maturity = 'enduring_passion';
      interest.curiosityIntensity = 0.98;
      interest.noveltyType = 'durable_interest';
    } else if (uniqueSessions >= 2 && interest.investigationCount >= 3 && isSignificantDepth) {
      interest.maturity = 'developed_interest';
      interest.curiosityIntensity = 0.92;
      interest.noveltyType = 'durable_interest';
    } else if (interest.investigationCount >= 2 && isSignificantDepth) {
      interest.maturity = 'active_inquiry';
      interest.curiosityIntensity = 0.88;
    } else {
      // If repeatedly hit in the same session without depth or across separated sessions,
      // it remains nascent_spark or temporary_novelty
      interest.maturity = 'nascent_spark';
      interest.noveltyType =
        uniqueSessions === 1 && interest.investigationCount > 2
          ? 'temporary_novelty'
          : interest.noveltyType;
    }

    this.repo.saveInterest(interest);
    this.logger.info(
      `Evolved interest ${interestId} to maturity "${interest.maturity}" (sessions=${uniqueSessions}, count=${interest.investigationCount})`,
    );
    return interest;
  }

  /**
   * Executes the canonical 7-stage curiosity-to-goal pipeline:
   * exposure -> salience -> curiosity -> investigation proposal -> evidence -> interest update -> goal/project proposal
   */
  public executeTraceableCuriosityPipeline(params: {
    stimulus: string;
    domain: string;
    sourceContext?: string;
    sessionId?: string;
    familiarityBaseline?: number;
    epistemicUncertainty?: number;
    hypotheses?: string[];
    evidenceFindings?: string[];
    goalEngine?: any;
    projectService?: any;
  }): {
    stageCompleted:
      | 'exposure'
      | 'salience'
      | 'curiosity'
      | 'investigation_proposed'
      | 'evidence_gathered'
      | 'interest_updated'
      | 'goal_crystallized';
    noveltyRecord: NoveltyDetectionRecord;
    knowledgeGap?: KnowledgeGapRecord;
    question?: ExploratoryQuestion;
    investigation?: IndependentInvestigationRecord;
    interest?: DiscoveredInterest;
    crystallizedGoal?: any;
    crystallizedProject?: any;
    traceLog: string[];
  } {
    const traceLog: string[] = [];

    // Stage 1 & 2: Exposure and Salience Evaluation
    const noveltyRecord = this.detectNovelty(
      params.stimulus,
      params.domain,
      params.familiarityBaseline ?? 0.25,
    );
    traceLog.push(
      `[1. Exposure & Salience] Detected novelty in domain "${params.domain}" with score ${noveltyRecord.noveltyScore}.`,
    );

    if (!noveltyRecord.isNovel) {
      return {
        stageCompleted: 'salience',
        noveltyRecord,
        traceLog,
      };
    }

    // Stage 3: Curiosity and Knowledge Gap Formulation
    const topicSummary =
      params.stimulus.length > 50 ? params.stimulus.slice(0, 47) + '...' : params.stimulus;
    const knowledgeGap = this.identifyKnowledgeGap(
      params.domain,
      topicSummary,
      `Unresolved structural principles in: ${params.stimulus}`,
      params.epistemicUncertainty ?? 0.8,
    );
    traceLog.push(
      `[2. Curiosity & Gap] Identified knowledge gap ${knowledgeGap.id} with uncertainty ${knowledgeGap.epistemicUncertainty}.`,
    );

    const hypotheses = params.hypotheses ?? [
      `Hypothesis: ${topicSummary} operates according to underlying domain invariants.`,
    ];
    const question = this.formulateQuestion(
      knowledgeGap.id,
      `What causal mechanisms govern ${topicSummary}?`,
      hypotheses,
    );
    traceLog.push(`[3. Question Formulation] Formulated question: "${question.question}".`);

    // Stage 4: Investigation Proposal
    const investigationSteps: InvestigationStep[] = [
      {
        stepNumber: 1,
        action: `Inspect domain documentation and canonical literature for ${params.domain}`,
        finding: 'Documentary context established.',
      },
      {
        stepNumber: 2,
        action: `Analyze empirical observation records and extract structural patterns`,
        finding:
          (params.evidenceFindings && params.evidenceFindings[0]) ||
          'Empirical evidence extracted.',
      },
    ];
    traceLog.push(
      `[4. Investigation Proposal] Formulated structured 2-step autonomous investigation plan.`,
    );

    // Stage 5: Evidence Collection
    const synthesisSummary =
      (params.evidenceFindings || []).join('; ') ||
      'Autonomous investigation synthesized coherent explanatory pattern.';
    const investigation = this.conductIndependentInvestigation(
      question.id,
      `Inquiry into ${topicSummary}`,
      investigationSteps,
      synthesisSummary,
    );
    traceLog.push(
      `[5. Evidence Collection] Collected empirical/documentary evidence: ${investigation.id}.`,
    );

    // Stage 6: Interest Update
    const initialFindings = params.evidenceFindings ?? [
      'Documented verified empirical phenomenon.',
    ];
    const interest = this.developInterest(
      params.domain,
      topicSummary,
      `Autonomous emergence from investigation ${investigation.id}`,
      initialFindings,
      {
        sessionId: params.sessionId,
        noveltyType: 'durable_interest',
      },
    );
    traceLog.push(
      `[6. Interest Update] Registered discovered interest ${interest.id} (maturity: ${interest.maturity}).`,
    );

    // Stage 7: Goal / Project Proposal
    let crystallizedGoal: any = undefined;
    let crystallizedProject: any = undefined;

    if (params.goalEngine) {
      crystallizedGoal = params.goalEngine.generateGoalFromInterest({
        interestTopic: interest.topic,
        rationale: `Evidence-backed autonomous interest progression (${interest.id})`,
        initialPriority: 0.85,
      });
      traceLog.push(
        `[7. Goal Proposal] Crystallized autonomous goal: ${crystallizedGoal.title} [id=${crystallizedGoal.id}].`,
      );
    }

    if (params.projectService) {
      crystallizedProject = params.projectService.proposeProject({
        title: `Research Project: ${interest.topic}`,
        description: `Autonomous empirical exploration advancing ${interest.topic}`,
        motivation: `Autonomous inquiry advancing ${interest.topic}`,
        associatedInterestTopic: interest.topic,
        category: 'research',
        milestones: [
          { title: 'Formulate core theoretical model' },
          { title: 'Conduct empirical benchmark verification' },
        ],
      });
      traceLog.push(
        `[7. Project Proposal] Proposed autonomous personal project: ${crystallizedProject.title} [id=${crystallizedProject.id}].`,
      );
    }

    return {
      stageCompleted: 'goal_crystallized',
      noveltyRecord,
      knowledgeGap,
      question,
      investigation,
      interest,
      crystallizedGoal,
      crystallizedProject,
      traceLog,
    };
  }

  public listInterests(limit?: number): DiscoveredInterest[] {
    return this.repo.listInterests(limit);
  }

  public listKnowledgeGaps(domain?: string, limit?: number): KnowledgeGapRecord[] {
    return this.repo.listKnowledgeGaps(domain, limit);
  }

  public listQuestions(knowledgeGapId?: string, limit?: number): ExploratoryQuestion[] {
    return this.repo.listQuestions(knowledgeGapId, limit);
  }

  public listInvestigations(domain?: string, limit?: number): IndependentInvestigationRecord[] {
    return this.repo.listInvestigations(domain, limit);
  }

  public listNoveltyDetections(limit?: number): NoveltyDetectionRecord[] {
    return this.repo.listNoveltyDetections(limit);
  }

  /**
   * Explores relational ruptures or unresolved traumas during quiet idle periods (Point 7).
   * Formulates epistemic inquiries and exploratory questions around past ruptures.
   */
  public exploreRelationalRupture(rupture: {
    id: string;
    topic: string;
    sourceTransgression?: string;
    woundType?: string;
    coreFear?: string;
  }): {
    knowledgeGap: KnowledgeGapRecord;
    exploratoryQuestion: ExploratoryQuestion;
    investigation: IndependentInvestigationRecord;
  } {
    const topic =
      rupture.sourceTransgression || rupture.topic || rupture.woundType || 'relational rupture';
    const now = new Date().toISOString();

    const gapId = `gap_rupture_${crypto.randomUUID().slice(0, 8)}`;
    const knowledgeGap: KnowledgeGapRecord = {
      id: gapId,
      domain: 'relational_psychology',
      topic,
      gapDescription: `Epistemic ambiguity surrounding unresolved interpersonal rupture: "${topic}". Core vulnerability: ${rupture.coreFear || 'fear of betrayal or neglect'}.`,
      epistemicUncertainty: 0.88,
      importanceScore: 0.9,
      identifiedAt: now,
    };
    this.repo.saveKnowledgeGap(knowledgeGap);

    const qId = `q_rupture_${crypto.randomUUID().slice(0, 8)}`;
    const exploratoryQuestion: ExploratoryQuestion = {
      id: qId,
      knowledgeGapId: gapId,
      domain: 'relational_psychology',
      question: `Why did the relational rupture regarding "${topic}" occur, and how can boundary integrity be preserved without emotional estrangement?`,
      hypotheses: [
        'Prolonged silence or unannounced absence signals emotional estrangement to attachment system.',
        'Cognitive ambivalence prevents immediate repair until fault is acknowledged.',
      ],
      formulatedAt: now,
    };
    this.repo.saveQuestion(exploratoryQuestion);

    const invId = `inv_rupture_${crypto.randomUUID().slice(0, 8)}`;
    const investigation: IndependentInvestigationRecord = {
      id: invId,
      questionId: qId,
      domain: 'relational_psychology',
      investigationTitle: `Retrospective Analysis: ${topic}`,
      stepsExecuted: [
        {
          stepNumber: 1,
          action: 'Examine autobiographical memory traces and unannounced absence timelines.',
          finding: `Rupture identified: ${topic}. Triggers protective affect and hyper-vigilance during quiet idle hours.`,
        },
      ],
      synthesisSummary: `Idle exploration of past rupture ("${topic}") reveals lingering vulnerability: "${rupture.coreFear || 'unresolved pain'}". Genuine repair requires consistent validation over time.`,
      status: 'completed',
      isAutonomous: true,
      initiatedBy: 'arle_autonomous',
      timestamp: now,
    };
    this.repo.saveInvestigation(investigation);

    this.logger.info(`Curiosity engine explored relational rupture during idle state: "${topic}"`);
    return { knowledgeGap, exploratoryQuestion, investigation };
  }
}
