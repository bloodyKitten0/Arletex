import crypto from 'node:crypto';
import {
  BehavioralAdaptationRule,
  LearningChannel,
  LearningExperience,
  LearningExperienceFilter,
  LearningOutcomeType,
  LearningSummary,
  PatternRecognition,
  StrategyRecommendation,
  assertLearningIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ILearningRepository } from './interfaces.js';

export interface LearningAdaptationEngineOptions {
  repository: ILearningRepository;
  logger?: ILogger;
}

export class LearningAdaptationEngine {
  private readonly repo: ILearningRepository;
  private readonly logger: ILogger;

  constructor(options: LearningAdaptationEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('LearningAdaptationEngine');
  }

  // ==========================================
  // 1. Record Learning Experience
  // ==========================================

  public recordExperience(input: {
    channel: LearningChannel;
    domain: string;
    context: string;
    actionTaken: string;
    outcome: LearningOutcomeType;
    outcomeDetails: string;
    rewardScore: number;
    lessonsLearned?: string[];
    metadata?: Record<string, unknown>;
  }): LearningExperience {
    const clampedReward = Math.max(-1.0, Math.min(1.0, input.rewardScore));
    const experience: LearningExperience = {
      id: crypto.randomUUID(),
      channel: input.channel,
      domain: input.domain.trim(),
      context: input.context.trim(),
      actionTaken: input.actionTaken.trim(),
      outcome: input.outcome,
      outcomeDetails: input.outcomeDetails.trim(),
      rewardScore: clampedReward,
      lessonsLearned: input.lessonsLearned ?? [],
      metadata: input.metadata,
      timestamp: new Date().toISOString(),
    };

    this.repo.recordExperience(experience);
    this.logger.debug(
      `Recorded learning experience [${experience.channel}]: ${experience.context} -> ${experience.outcome} (reward: ${experience.rewardScore})`,
    );

    // Automatically derive or update rule if significant outcome
    this.autoDeriveOrUpdateRule(experience);

    return experience;
  }

  // ==========================================
  // 2. Behavioral Adaptation Rules
  // ==========================================

  public createAdaptationRule(input: {
    sourceExperienceIds: string[];
    domain: string;
    condition: string;
    recommendedStrategy: string;
    avoidStrategy?: string;
    confidence?: number;
    successRate?: number;
    sampleCount?: number;
    isGeneralization?: boolean;
    transferDomains?: string[];
  }): BehavioralAdaptationRule {
    const rule: BehavioralAdaptationRule = {
      id: crypto.randomUUID(),
      sourceExperienceIds: input.sourceExperienceIds,
      domain: input.domain.trim(),
      condition: input.condition.trim(),
      recommendedStrategy: input.recommendedStrategy.trim(),
      avoidStrategy: input.avoidStrategy?.trim(),
      confidence: Math.max(0.0, Math.min(1.0, input.confidence ?? 0.7)),
      successRate: Math.max(0.0, Math.min(1.0, input.successRate ?? 0.75)),
      sampleCount: Math.max(1, input.sampleCount ?? input.sourceExperienceIds.length),
      isGeneralization: input.isGeneralization ?? false,
      transferDomains: input.transferDomains ?? [],
      updatedAt: new Date().toISOString(),
    };

    // Enforce negative invariant: no artificial insertion without empirical sources
    assertLearningIntegrity(rule);

    this.repo.saveRule(rule);
    this.logger.info(`Synthesized adaptation rule [${rule.domain}]: ${rule.condition} -> ${rule.recommendedStrategy}`);
    return rule;
  }

  // ==========================================
  // 3. Strategy Recommendations & Improvement
  // ==========================================

  public getRecommendations(context: string, domain: string): StrategyRecommendation {
    const normContext = context.toLowerCase();
    const allRules = this.repo.listRules({ domain });

    const matchedRules = allRules.filter((r) => {
      if (r.domain.toLowerCase() === domain.toLowerCase()) return true;
      if (r.transferDomains.some((d: string) => d.toLowerCase() === domain.toLowerCase())) return true;
      return false;
    }).filter((r) => {
      const cond = r.condition.toLowerCase();
      return normContext.includes(cond) || cond.includes(normContext) || cond === 'default' || cond === '*';
    });

    matchedRules.sort((a, b) => b.confidence * b.successRate - a.confidence * a.successRate);

    const avoidStrategies: string[] = [];
    matchedRules.forEach((r) => {
      if (r.avoidStrategy && !avoidStrategies.includes(r.avoidStrategy)) {
        avoidStrategies.push(r.avoidStrategy);
      }
    });

    const confidenceScore = matchedRules.length > 0
      ? matchedRules.reduce((acc, r) => acc + r.confidence, 0) / matchedRules.length
      : 0.5;

    const avgSuccess = matchedRules.length > 0
      ? matchedRules.reduce((acc, r) => acc + r.successRate, 0) / matchedRules.length
      : 0.5;

    // Expected improvement relative to baseline 0.50
    const expectedSuccessImprovement = Math.max(0.0, avgSuccess - 0.50);

    return {
      context,
      domain,
      recommendedRules: matchedRules,
      avoidStrategies,
      confidenceScore: Math.round(confidenceScore * 1000) / 1000,
      expectedSuccessImprovement: Math.round(expectedSuccessImprovement * 1000) / 1000,
    };
  }

  // ==========================================
  // 4. Feedback & Continuous Adaptation
  // ==========================================

  public applyFeedback(ruleId: string, outcome: 'success' | 'failure'): BehavioralAdaptationRule {
    const rule = this.repo.getRuleById(ruleId);
    if (!rule) {
      throw new Error(`Adaptation rule not found: ${ruleId}`);
    }

    const currentSamples = rule.sampleCount;
    const nextSamples = currentSamples + 1;

    let nextSuccessRate: number;
    let nextConfidence: number;

    if (outcome === 'success') {
      nextSuccessRate = (rule.successRate * currentSamples + 1.0) / nextSamples;
      nextConfidence = Math.min(1.0, rule.confidence + 0.05);
    } else {
      nextSuccessRate = (rule.successRate * currentSamples + 0.0) / nextSamples;
      nextConfidence = Math.max(0.1, rule.confidence - 0.10);
    }

    const updatedRule: BehavioralAdaptationRule = {
      ...rule,
      successRate: Math.round(nextSuccessRate * 1000) / 1000,
      confidence: Math.round(nextConfidence * 1000) / 1000,
      sampleCount: nextSamples,
      updatedAt: new Date().toISOString(),
    };

    this.repo.updateRule(updatedRule);
    this.logger.debug(
      `Applied feedback (${outcome}) to rule [${rule.id}]: successRate=${updatedRule.successRate}, confidence=${updatedRule.confidence}`,
    );

    return updatedRule;
  }

  // ==========================================
  // 5. Pattern Recognition
  // ==========================================

  public recognizePatterns(domain?: string): PatternRecognition[] {
    const experiences = this.repo.listExperiences({ domain, limit: 100 });
    const patterns: PatternRecognition[] = [];

    // Group experiences by domain and recurring context keywords
    const clusters: Map<string, LearningExperience[]> = new Map();
    experiences.forEach((exp) => {
      const key = `${exp.domain}::${exp.outcome}`;
      const list = clusters.get(key) ?? [];
      list.push(exp);
      clusters.set(key, list);
    });

    clusters.forEach((items, clusterKey) => {
      if (items.length >= 2) {
        const [clusterDomain, clusterOutcome] = clusterKey.split('::');
        const patternId = crypto.randomUUID();
        const confidence = Math.min(1.0, 0.4 + items.length * 0.15);

        const implications: string[] = [];
        if (clusterOutcome === 'failure') {
          implications.push(`High failure frequency in domain '${clusterDomain}'. Recommend evasive strategy adjustment.`);
        } else if (clusterOutcome === 'success') {
          implications.push(`Consistent success patterns observed in domain '${clusterDomain}'. Good candidate for cross-domain generalization.`);
        }

        patterns.push({
          patternId,
          domain: clusterDomain ?? 'general',
          description: `Identified cluster of ${items.length} ${clusterOutcome} experiences in domain '${clusterDomain}'.`,
          occurrences: items.length,
          confidence: Math.round(confidence * 100) / 100,
          relatedExperienceIds: items.map((x) => x.id),
          implications,
        });
      }
    });

    return patterns;
  }

  // ==========================================
  // 6. Generalization & Transfer Learning
  // ==========================================

  public generalizeRule(ruleId: string, targetDomains: string[]): BehavioralAdaptationRule {
    const rule = this.repo.getRuleById(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found for generalization`);
    }

    const mergedTransfer = Array.from(new Set([...rule.transferDomains, ...targetDomains]));

    const generalizedRule: BehavioralAdaptationRule = {
      ...rule,
      isGeneralization: true,
      transferDomains: mergedTransfer,
      // Modulate confidence slightly for cross-domain transfer uncertainty
      confidence: Math.round(Math.max(0.2, rule.confidence * 0.95) * 1000) / 1000,
      updatedAt: new Date().toISOString(),
    };

    this.repo.updateRule(generalizedRule);
    this.logger.info(`Generalized rule ${rule.id} to domains: ${targetDomains.join(', ')}`);
    return generalizedRule;
  }

  // ==========================================
  // 7. Learning Summary
  // ==========================================

  public getLearningSummary(): LearningSummary {
    const experiences = this.repo.listExperiences({ limit: 1000 });
    const rules = this.repo.listRules();

    const channelCounts: Record<string, number> = {};
    experiences.forEach((e) => {
      channelCounts[e.channel] = (channelCounts[e.channel] ?? 0) + 1;
    });

    const domainFreq: Record<string, number> = {};
    experiences.forEach((e) => {
      domainFreq[e.domain] = (domainFreq[e.domain] ?? 0) + 1;
    });
    rules.forEach((r) => {
      domainFreq[r.domain] = (domainFreq[r.domain] ?? 0) + 1;
    });

    const dominantDomains = Object.entries(domainFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d]) => d);

    const totalRules = rules.length;
    const generalizationCount = rules.filter((r) => r.isGeneralization).length;
    const avgConfidence = totalRules > 0
      ? rules.reduce((acc, r) => acc + r.confidence, 0) / totalRules
      : 0.0;
    const avgSuccessRate = totalRules > 0
      ? rules.reduce((acc, r) => acc + r.successRate, 0) / totalRules
      : 0.0;

    return {
      totalExperiences: experiences.length,
      channelCounts,
      totalRules,
      generalizationCount,
      averageRuleConfidence: Math.round(avgConfidence * 1000) / 1000,
      averageRuleSuccessRate: Math.round(avgSuccessRate * 1000) / 1000,
      dominantDomains,
    };
  }

  // ==========================================
  // Internal Helpers
  // ==========================================

  private autoDeriveOrUpdateRule(exp: LearningExperience): void {
    // Only auto-derive if there are lessons learned or clear positive/negative outcome
    if (exp.outcome === 'failure' || exp.channel === 'mistake') {
      const condition = exp.context;
      const avoidStrategy = exp.actionTaken;
      const recommendedStrategy = exp.lessonsLearned.length > 0
        ? exp.lessonsLearned.join('; ')
        : `Avoid repeating '${exp.actionTaken}' under '${exp.context}'`;

      this.createAdaptationRule({
        sourceExperienceIds: [exp.id],
        domain: exp.domain,
        condition,
        recommendedStrategy,
        avoidStrategy,
        confidence: 0.65,
        successRate: 0.3, // Initially low until verified
      });
    } else if (exp.outcome === 'success' || exp.channel === 'success') {
      const condition = exp.context;
      const recommendedStrategy = exp.lessonsLearned.length > 0
        ? exp.lessonsLearned.join('; ')
        : exp.actionTaken;

      this.createAdaptationRule({
        sourceExperienceIds: [exp.id],
        domain: exp.domain,
        condition,
        recommendedStrategy,
        confidence: 0.75,
        successRate: 0.85,
      });
    }
  }
}

// ==========================================
// In-Memory Repository for Engine Unit Tests
// ==========================================

export class InMemoryLearningRepository implements ILearningRepository {
  private experiences: LearningExperience[] = [];
  private rules: BehavioralAdaptationRule[] = [];

  public recordExperience(experience: LearningExperience): void {
    const idx = this.experiences.findIndex((e) => e.id === experience.id);
    if (idx >= 0) {
      this.experiences[idx] = JSON.parse(JSON.stringify(experience));
    } else {
      this.experiences.push(JSON.parse(JSON.stringify(experience)));
    }
  }

  public getExperienceById(id: string): LearningExperience | null {
    const exp = this.experiences.find((e) => e.id === id);
    return exp ? JSON.parse(JSON.stringify(exp)) : null;
  }

  public listExperiences(filter?: LearningExperienceFilter): LearningExperience[] {
    let result = [...this.experiences];
    if (filter?.channel) {
      result = result.filter((e) => e.channel === filter.channel);
    }
    if (filter?.domain) {
      result = result.filter((e) => e.domain === filter.domain);
    }
    if (filter?.outcome) {
      result = result.filter((e) => e.outcome === filter.outcome);
    }
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return result.slice(0, filter?.limit ?? 50).map((e) => JSON.parse(JSON.stringify(e)));
  }

  public saveRule(rule: BehavioralAdaptationRule): void {
    const idx = this.rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) {
      this.rules[idx] = JSON.parse(JSON.stringify(rule));
    } else {
      this.rules.push(JSON.parse(JSON.stringify(rule)));
    }
  }

  public getRuleById(id: string): BehavioralAdaptationRule | null {
    const rule = this.rules.find((r) => r.id === id);
    return rule ? JSON.parse(JSON.stringify(rule)) : null;
  }

  public listRules(filter?: { domain?: string; minConfidence?: number }): BehavioralAdaptationRule[] {
    let result = [...this.rules];
    if (filter?.domain) {
      const d = filter.domain.toLowerCase();
      result = result.filter(
        (r) => r.domain.toLowerCase() === d || r.transferDomains.some((td: string) => td.toLowerCase() === d),
      );
    }
    if (filter?.minConfidence !== undefined) {
      result = result.filter((r) => r.confidence >= filter.minConfidence!);
    }
    result.sort((a, b) => b.confidence - a.confidence);
    return result.map((r) => JSON.parse(JSON.stringify(r)));
  }

  public updateRule(rule: BehavioralAdaptationRule): void {
    this.saveRule(rule);
  }

  public deleteRule(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id);
  }
}
