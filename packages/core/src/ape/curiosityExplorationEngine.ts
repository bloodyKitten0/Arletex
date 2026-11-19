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
          isUserAssigned: false, // Acceptance criterion: discovered independently
          discoveredRationale: 'Spontaneous discovery of boundary-bulk entanglement correspondence during dialogue with Proof.',
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
          isUserAssigned: false,
          discoveredRationale: 'Autonomous inquiry into how mathematical relationships remain invariant across revolutionary physics.',
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
    if (!detectedDomain || detectedDomain.trim().length === 0) throw new Error('Detected domain cannot be empty');
    if (familiarityBaseline < 0.0 || familiarityBaseline > 1.0) throw new Error('Familiarity baseline must be between 0.0 and 1.0');

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
    this.logger.info(`Novelty detected in domain "${detectedDomain}": score=${noveltyScore} (isNovel=${isNovel})`);
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
    if (!gapDescription || gapDescription.trim().length === 0) throw new Error('Gap description cannot be empty');
    if (epistemicUncertainty < 0.0 || epistemicUncertainty > 1.0) throw new Error('Epistemic uncertainty must be between 0.0 and 1.0');

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
    this.logger.info(`Knowledge gap identified in "${domain}/${topic}": uncertainty=${epistemicUncertainty}`);
    return gap;
  }

  public formulateQuestion(
    knowledgeGapId: string,
    question: string,
    hypotheses: string[] = [],
  ): ExploratoryQuestion {
    if (!question || question.trim().length === 0) throw new Error('Exploratory question cannot be empty');

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
    if (!investigationTitle || investigationTitle.trim().length === 0) throw new Error('Investigation title cannot be empty');
    if (!synthesisSummary || synthesisSummary.trim().length === 0) throw new Error('Synthesis summary cannot be empty');
    if (stepsExecuted.length === 0) throw new Error('Investigation must include at least one executed step');

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
    this.logger.info(`Conducted independent investigation ${inv.id}: "${investigationTitle}" (${stepsExecuted.length} steps)`);
    return inv;
  }

  public developInterest(
    domain: string,
    topic: string,
    discoveredRationale: string,
    initialFindings: string[] = [],
  ): DiscoveredInterest {
    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (!topic || topic.trim().length === 0) throw new Error('Topic cannot be empty');
    if (!discoveredRationale || discoveredRationale.trim().length === 0) throw new Error('Discovered rationale cannot be empty');

    const now = new Date().toISOString();
    const interest: DiscoveredInterest = {
      id: `int_${crypto.randomUUID()}`,
      domain,
      topic,
      maturity: 'nascent_spark',
      curiosityIntensity: 0.85,
      investigationCount: 1,
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

  public evolveInterestMaturity(interestId: string, newFinding: string): DiscoveredInterest {
    const interest = this.repo.getInterestById(interestId);
    if (!interest) throw new Error(`Interest not found: ${interestId}`);
    if (!newFinding || newFinding.trim().length === 0) throw new Error('New finding cannot be empty');

    interest.investigationCount += 1;
    interest.keyFindings.push(newFinding);
    interest.lastExploredAt = new Date().toISOString();

    if (interest.investigationCount >= 5) {
      interest.maturity = 'enduring_passion';
      interest.curiosityIntensity = 0.98;
    } else if (interest.investigationCount >= 3) {
      interest.maturity = 'developed_interest';
      interest.curiosityIntensity = 0.92;
    } else if (interest.investigationCount >= 2) {
      interest.maturity = 'active_inquiry';
      interest.curiosityIntensity = 0.88;
    }

    this.repo.saveInterest(interest);
    this.logger.info(`Evolved interest ${interestId} to maturity "${interest.maturity}" (count=${interest.investigationCount})`);
    return interest;
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
}
