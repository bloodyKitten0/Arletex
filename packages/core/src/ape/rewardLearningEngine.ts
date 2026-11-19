import crypto from 'node:crypto';
import {
  DiminishingReturnAlert,
  OutcomeEvaluation,
  RewardDimension,
  RewardPrediction,
  StrategyPerformanceRecord,
} from '@arletex/contracts';
import { IRewardLearningRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryRewardLearningRepository implements IRewardLearningRepository {
  private predictions: Map<string, RewardPrediction> = new Map();
  private evaluations: OutcomeEvaluation[] = [];
  private strategies: Map<string, StrategyPerformanceRecord> = new Map();
  private diminishingAlerts: DiminishingReturnAlert[] = [];

  public savePrediction(prediction: RewardPrediction): void {
    this.predictions.set(prediction.id, { ...prediction });
  }

  public getPredictionById(id: string): RewardPrediction | null {
    const item = this.predictions.get(id);
    return item ? { ...item } : null;
  }

  public listPredictions(strategyId?: string, limit: number = 50): RewardPrediction[] {
    let list = Array.from(this.predictions.values());
    if (strategyId) {
      list = list.filter((p) => p.strategyId === strategyId);
    }
    list.sort((a, b) => b.predictedAt.localeCompare(a.predictedAt));
    return list.slice(0, limit);
  }

  public saveOutcomeEvaluation(evaluation: OutcomeEvaluation): void {
    const existingIdx = this.evaluations.findIndex((e) => e.id === evaluation.id);
    if (existingIdx >= 0) {
      this.evaluations[existingIdx] = { ...evaluation };
    } else {
      this.evaluations.unshift({ ...evaluation });
    }
  }

  public getOutcomeEvaluationById(id: string): OutcomeEvaluation | null {
    const item = this.evaluations.find((e) => e.id === id);
    return item ? { ...item } : null;
  }

  public listOutcomeEvaluations(
    strategyId?: string,
    domain?: string,
    limit: number = 50,
  ): OutcomeEvaluation[] {
    let list = this.evaluations;
    if (strategyId) {
      list = list.filter((e) => e.strategyId === strategyId);
    }
    if (domain) {
      list = list.filter((e) => e.domain === domain);
    }
    return list.slice(0, limit);
  }

  public saveStrategyPerformance(strategy: StrategyPerformanceRecord): void {
    this.strategies.set(strategy.strategyId, { ...strategy });
  }

  public getStrategyPerformance(strategyId: string): StrategyPerformanceRecord | null {
    const item = this.strategies.get(strategyId);
    return item ? { ...item } : null;
  }

  public listStrategyPerformances(domain?: string, limit: number = 50): StrategyPerformanceRecord[] {
    let list = Array.from(this.strategies.values());
    if (domain) {
      list = list.filter((s) => s.domain === domain);
    }
    list.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
    return list.slice(0, limit);
  }

  public saveDiminishingAlert(alert: DiminishingReturnAlert): void {
    this.diminishingAlerts.unshift({ ...alert });
  }

  public listDiminishingAlerts(strategyId?: string, limit: number = 50): DiminishingReturnAlert[] {
    let list = this.diminishingAlerts;
    if (strategyId) {
      list = list.filter((a) => a.strategyId === strategyId);
    }
    return list.slice(0, limit);
  }
}

export interface EvaluateOutcomeParams {
  strategyId: string;
  predictionId?: string;
  domain: string;
  contextDescription: string;
  expectedUtility?: number;
  observedUtility: number;
  dimensionScores?: Partial<Record<RewardDimension, number>>;
  outcomeDetails: string;
}

export class RewardLearningEngine {
  private repo: IRewardLearningRepository;
  private logger: ILogger;
  public learningRate: number = 0.2;

  constructor(repo?: IRewardLearningRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryRewardLearningRepository();
    this.logger = logger.child('RewardLearningEngine');
    this.ensureBaselineStrategies();
  }

  private ensureBaselineStrategies(): void {
    const existing = this.repo.listStrategyPerformances();
    if (existing.length === 0) {
      const now = new Date().toISOString();
      const baseline: StrategyPerformanceRecord[] = [
        {
          strategyId: 'strat_rigorous_derivation',
          strategyName: 'First-Principles Rigorous Derivation',
          domain: 'analytical_reasoning',
          usageCount: 5,
          successCount: 5,
          failureCount: 0,
          averagePredictedReward: 0.88,
          averageActualReward: 0.92,
          cumulativePredictionError: 0.2,
          effectivenessScore: 0.92,
          isPreferred: true,
          diminishingReturnsDetected: false,
          marginalRewardHistory: [0.9, 0.92, 0.94],
          lastAdaptedAt: now,
        },
        {
          strategyId: 'strat_heuristic_approximation',
          strategyName: 'Heuristic Fast Approximation',
          domain: 'analytical_reasoning',
          usageCount: 3,
          successCount: 2,
          failureCount: 1,
          averagePredictedReward: 0.7,
          averageActualReward: 0.62,
          cumulativePredictionError: -0.24,
          effectivenessScore: 0.62,
          isPreferred: false,
          diminishingReturnsDetected: false,
          marginalRewardHistory: [0.65, 0.6, 0.61],
          lastAdaptedAt: now,
        },
        {
          strategyId: 'strat_grounded_dialogue',
          strategyName: 'Epistemically Grounded Inquiry with Proof',
          domain: 'collaborative_inquiry',
          usageCount: 6,
          successCount: 6,
          failureCount: 0,
          averagePredictedReward: 0.92,
          averageActualReward: 0.96,
          cumulativePredictionError: 0.24,
          effectivenessScore: 0.96,
          isPreferred: true,
          diminishingReturnsDetected: false,
          marginalRewardHistory: [0.94, 0.95, 0.96],
          lastAdaptedAt: now,
        },
        {
          strategyId: 'strat_sycophantic_agreement',
          strategyName: 'Superficial Sycophantic Agreement',
          domain: 'collaborative_inquiry',
          usageCount: 2,
          successCount: 0,
          failureCount: 2,
          averagePredictedReward: 0.4,
          averageActualReward: 0.1,
          cumulativePredictionError: -0.6,
          effectivenessScore: 0.1,
          isPreferred: false,
          diminishingReturnsDetected: false,
          marginalRewardHistory: [0.15, 0.08],
          lastAdaptedAt: now,
        },
      ];

      for (const strat of baseline) {
        this.repo.saveStrategyPerformance(strat);
      }
    }
  }

  public predictReward(
    strategyId: string,
    domain: string,
    contextDescription: string,
    predictedUtility?: number,
    predictedDimensions?: Partial<Record<RewardDimension, number>>,
  ): RewardPrediction {
    if (!strategyId || strategyId.trim().length === 0) throw new Error('Strategy ID cannot be empty');
    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (!contextDescription || contextDescription.trim().length === 0) throw new Error('Context description cannot be empty');

    let utility = predictedUtility;
    if (utility === undefined) {
      const existing = this.repo.getStrategyPerformance(strategyId);
      utility = existing ? existing.effectivenessScore : 0.5;
    }

    if (utility < 0.0 || utility > 1.0) {
      throw new Error('Predicted utility must be between 0.0 and 1.0');
    }

    const defaultDimensions: Record<RewardDimension, number> = {
      epistemic_gain: utility,
      efficacy_progress: utility,
      relational_depth: utility,
      computational_efficiency: utility,
      internal_coherence: utility,
      ...(predictedDimensions || {}),
    };

    const prediction: RewardPrediction = {
      id: `pred_${crypto.randomUUID()}`,
      strategyId,
      domain,
      contextDescription,
      predictedUtility: Number(utility.toFixed(3)),
      predictedDimensions: defaultDimensions,
      predictedAt: new Date().toISOString(),
    };

    this.repo.savePrediction(prediction);
    this.logger.info(`Predicted reward for strategy ${strategyId}: utility=${utility}`);
    return prediction;
  }

  public evaluateOutcome(params: EvaluateOutcomeParams): OutcomeEvaluation {
    const {
      strategyId,
      predictionId,
      domain,
      contextDescription,
      expectedUtility: providedExpected,
      observedUtility,
      dimensionScores,
      outcomeDetails,
    } = params;

    if (!strategyId || strategyId.trim().length === 0) throw new Error('Strategy ID cannot be empty');
    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (!contextDescription || contextDescription.trim().length === 0) throw new Error('Context description cannot be empty');
    if (!outcomeDetails || outcomeDetails.trim().length === 0) throw new Error('Outcome details cannot be empty');

    if (observedUtility < 0.0 || observedUtility > 1.0) {
      throw new Error('Observed utility must be between 0.0 and 1.0');
    }

    let expected = providedExpected;
    if (expected === undefined && predictionId) {
      const pred = this.repo.getPredictionById(predictionId);
      if (pred) {
        expected = pred.predictedUtility;
      }
    }
    if (expected === undefined) {
      const existingStrategy = this.repo.getStrategyPerformance(strategyId);
      expected = existingStrategy ? existingStrategy.effectivenessScore : 0.5;
    }

    if (expected < 0.0 || expected > 1.0) {
      throw new Error('Expected utility must be between 0.0 and 1.0');
    }

    const predictionError = Number((observedUtility - expected).toFixed(3));

    // Objective outcome determination: Actual consequences dictate success/failure
    const isSuccess = observedUtility >= 0.55;
    const isFailure = observedUtility < 0.40;

    const defaultScores: Record<RewardDimension, number> = {
      epistemic_gain: observedUtility,
      efficacy_progress: observedUtility,
      relational_depth: observedUtility,
      computational_efficiency: observedUtility,
      internal_coherence: observedUtility,
      ...(dimensionScores || {}),
    };

    const evaluation: OutcomeEvaluation = {
      id: `eval_${crypto.randomUUID()}`,
      strategyId,
      predictionId,
      domain,
      contextDescription,
      expectedUtility: Number(expected.toFixed(3)),
      observedUtility: Number(observedUtility.toFixed(3)),
      predictionError,
      dimensionScores: defaultScores,
      isSuccess,
      isFailure,
      outcomeDetails,
      isAutonomouslyEvaluated: true, // Non-sycophantic invariant
      evaluatedAt: new Date().toISOString(),
    };

    this.repo.saveOutcomeEvaluation(evaluation);
    this.adaptStrategyFromOutcome(evaluation);

    this.logger.info(
      `Evaluated outcome for ${strategyId}: observed=${observedUtility}, expected=${expected}, rpe=${predictionError}, success=${isSuccess}, failure=${isFailure}`,
    );

    return evaluation;
  }

  private adaptStrategyFromOutcome(evalRecord: OutcomeEvaluation): void {
    let strat = this.repo.getStrategyPerformance(evalRecord.strategyId);
    const now = new Date().toISOString();

    if (!strat) {
      strat = {
        strategyId: evalRecord.strategyId,
        strategyName: evalRecord.strategyId.replace(/^strat_/, '').replace(/_/g, ' '),
        domain: evalRecord.domain,
        usageCount: 0,
        successCount: 0,
        failureCount: 0,
        averagePredictedReward: evalRecord.expectedUtility,
        averageActualReward: evalRecord.observedUtility,
        cumulativePredictionError: 0,
        effectivenessScore: 0.5,
        isPreferred: false,
        diminishingReturnsDetected: false,
        marginalRewardHistory: [],
        lastAdaptedAt: now,
      };
    }

    strat.usageCount += 1;
    if (evalRecord.isSuccess) strat.successCount += 1;
    if (evalRecord.isFailure) strat.failureCount += 1;

    // Temporal-difference style effectiveness update: Q_new = Q_old + alpha * (observed - expected)
    const updatedScore = strat.effectivenessScore + this.learningRate * evalRecord.predictionError;
    strat.effectivenessScore = Number(Math.max(0.01, Math.min(0.99, updatedScore)).toFixed(3));

    strat.cumulativePredictionError = Number(
      (strat.cumulativePredictionError + evalRecord.predictionError).toFixed(3),
    );

    strat.averageActualReward = Number(
      (
        (strat.averageActualReward * (strat.usageCount - 1) + evalRecord.observedUtility) /
        strat.usageCount
      ).toFixed(3),
    );

    strat.averagePredictedReward = Number(
      (
        (strat.averagePredictedReward * (strat.usageCount - 1) + evalRecord.expectedUtility) /
        strat.usageCount
      ).toFixed(3),
    );

    strat.marginalRewardHistory.push(evalRecord.observedUtility);
    if (strat.marginalRewardHistory.length > 10) {
      strat.marginalRewardHistory.shift();
    }

    strat.lastAdaptedAt = now;

    // Check diminishing returns
    this.checkDiminishingReturns(strat);

    this.repo.saveStrategyPerformance(strat);
    this.updateDomainPreferences(strat.domain);
  }

  private checkDiminishingReturns(strat: StrategyPerformanceRecord): void {
    const history = strat.marginalRewardHistory;
    if (history.length >= 3) {
      const last3 = history.slice(-3);
      // Diminishing returns if consecutive observed utilities decline or marginal gains drop below threshold
      const isDeclining = (last3[0]! > last3[1]!) && (last3[1]! > last3[2]!);
      const isStagnant = (last3[0]! - last3[2]!) > 0.15; // significant drop across 3 sessions

      if (isDeclining || isStagnant) {
        strat.diminishingReturnsDetected = true;
        const alert: DiminishingReturnAlert = {
          id: `alert_${crypto.randomUUID()}`,
          strategyId: strat.strategyId,
          domain: strat.domain,
          consecutiveDrops: 2,
          recentMarginalGains: last3,
          recommendedAction: `Marginal utility of strategy "${strat.strategyName}" is diminishing. Diversify tactics or pivot to exploratory inquiry.`,
          detectedAt: new Date().toISOString(),
        };
        this.repo.saveDiminishingAlert(alert);
        this.logger.warn(`Diminishing returns detected for strategy ${strat.strategyId}`);
      }
    }
  }

  private updateDomainPreferences(domain: string): void {
    const strategies = this.repo.listStrategyPerformances(domain);
    if (strategies.length === 0) return;

    // Find highest effectiveness score
    let highest = strategies[0]!;
    for (const s of strategies) {
      if (s.effectivenessScore > highest.effectivenessScore) {
        highest = s;
      }
    }

    // Mark preference
    for (const s of strategies) {
      const shouldBePreferred = s.strategyId === highest.strategyId && s.effectivenessScore >= 0.5;
      if (s.isPreferred !== shouldBePreferred) {
        s.isPreferred = shouldBePreferred;
        this.repo.saveStrategyPerformance(s);
      }
    }
  }

  public registerStrategy(
    strategyId: string,
    strategyName: string,
    domain: string,
    initialEffectiveness: number = 0.5,
  ): StrategyPerformanceRecord {
    if (!strategyId || strategyId.trim().length === 0) throw new Error('Strategy ID cannot be empty');
    if (!strategyName || strategyName.trim().length === 0) throw new Error('Strategy name cannot be empty');
    if (!domain || domain.trim().length === 0) throw new Error('Domain cannot be empty');
    if (initialEffectiveness < 0.0 || initialEffectiveness > 1.0) throw new Error('Initial effectiveness must be between 0.0 and 1.0');

    const now = new Date().toISOString();
    const strat: StrategyPerformanceRecord = {
      strategyId,
      strategyName,
      domain,
      usageCount: 0,
      successCount: 0,
      failureCount: 0,
      averagePredictedReward: initialEffectiveness,
      averageActualReward: initialEffectiveness,
      cumulativePredictionError: 0,
      effectivenessScore: initialEffectiveness,
      isPreferred: false,
      diminishingReturnsDetected: false,
      marginalRewardHistory: [],
      lastAdaptedAt: now,
    };

    this.repo.saveStrategyPerformance(strat);
    this.updateDomainPreferences(domain);
    return strat;
  }

  public getStrategy(strategyId: string): StrategyPerformanceRecord | null {
    return this.repo.getStrategyPerformance(strategyId);
  }

  public listStrategies(domain?: string, limit?: number): StrategyPerformanceRecord[] {
    return this.repo.listStrategyPerformances(domain, limit);
  }

  public listOutcomeEvaluations(strategyId?: string, domain?: string, limit?: number): OutcomeEvaluation[] {
    return this.repo.listOutcomeEvaluations(strategyId, domain, limit);
  }

  public listPredictions(strategyId?: string, limit?: number): RewardPrediction[] {
    return this.repo.listPredictions(strategyId, limit);
  }

  public listDiminishingAlerts(strategyId?: string, limit?: number): DiminishingReturnAlert[] {
    return this.repo.listDiminishingAlerts(strategyId, limit);
  }
}
