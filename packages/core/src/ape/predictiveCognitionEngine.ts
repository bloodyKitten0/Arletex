import crypto from 'node:crypto';
import {
  CognitivePrediction,
  PredictionAccuracyMetrics,
  PredictionStatus,
  PredictionType,
  PredictiveSummary,
  assertPredictionIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IPredictiveRepository } from './interfaces.js';

export interface PredictiveCognitionEngineOptions {
  repository: IPredictiveRepository;
  logger?: ILogger;
}

export class PredictiveCognitionEngine {
  private readonly repo: IPredictiveRepository;
  private readonly logger: ILogger;

  constructor(options: PredictiveCognitionEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('PredictiveCognitionEngine');
  }

  // ==========================================
  // 1. Prediction Generation
  // ==========================================

  public makePrediction(input: {
    domain: string;
    predictionType: PredictionType;
    targetStatement: string;
    predictedProbability: number;
    confidence: number;
    rationale: string;
    horizonDeadline: string;
    createdAt?: string;
  }): CognitivePrediction {
    const clampedProb = Math.max(0.0, Math.min(1.0, input.predictedProbability));
    const clampedConf = Math.max(0.0, Math.min(1.0, input.confidence));

    const prediction: CognitivePrediction = {
      id: crypto.randomUUID(),
      domain: input.domain.trim(),
      predictionType: input.predictionType,
      targetStatement: input.targetStatement.trim(),
      predictedProbability: Math.round(clampedProb * 1000) / 1000,
      confidence: Math.round(clampedConf * 1000) / 1000,
      rationale: input.rationale.trim(),
      horizonDeadline: input.horizonDeadline,
      createdAt: input.createdAt || new Date().toISOString(),
      status: 'pending',
    };

    assertPredictionIntegrity(prediction);
    this.repo.createPrediction(prediction);
    this.logger.info(
      `Generated cognitive prediction [${prediction.predictionType}:${prediction.domain}]: "${prediction.targetStatement}" (P=${prediction.predictedProbability}, Conf=${prediction.confidence})`,
    );

    return prediction;
  }

  // ==========================================
  // 2. Prediction Outcome Resolution & Error Tracking
  // ==========================================

  public resolvePrediction(
    id: string,
    actualOutcome: boolean,
    notes?: string,
    resolvedAt?: string,
  ): CognitivePrediction {
    const prediction = this.repo.getPredictionById(id);
    if (!prediction) {
      throw new Error(`Cognitive prediction not found: ${id}`);
    }

    const actualVal = actualOutcome ? 1.0 : 0.0;
    const predictionError = Math.abs(actualVal - prediction.predictedProbability);
    const brierScore = Math.pow(prediction.predictedProbability - actualVal, 2);

    // Accurate if error <= 0.40 (or if high prob matched true, low prob matched false)
    const isAccurate =
      (actualOutcome && prediction.predictedProbability >= 0.5) ||
      (!actualOutcome && prediction.predictedProbability < 0.5);

    const status: PredictionStatus = isAccurate ? 'resolved_accurate' : 'resolved_inaccurate';
    const resolutionTimestamp = resolvedAt || new Date().toISOString();

    const resolved: CognitivePrediction = {
      ...prediction,
      status,
      actualOutcome,
      actualOutcomeNotes: notes,
      resolvedAt: resolutionTimestamp,
      predictionError: Math.round(predictionError * 1000) / 1000,
      brierScore: Math.round(brierScore * 1000) / 1000,
    };

    // Verify negative invariant: createdAt <= resolvedAt
    assertPredictionIntegrity(resolved);

    this.repo.updatePrediction(resolved);
    this.logger.info(
      `Resolved prediction [${prediction.id}] -> ${status} (error: ${resolved.predictionError}, Brier: ${resolved.brierScore})`,
    );

    return resolved;
  }

  // ==========================================
  // 3. Obstacle Anticipation
  // ==========================================

  public predictObstacles(
    taskOrPlanDescription: string,
    domain = 'operations',
  ): CognitivePrediction[] {
    const lower = taskOrPlanDescription.toLowerCase();
    const predictions: CognitivePrediction[] = [];
    const now = new Date();
    const horizon = new Date(now.getTime() + 3600 * 1000).toISOString();

    if (lower.includes('rate limit') || lower.includes('api') || lower.includes('http')) {
      predictions.push(
        this.makePrediction({
          domain,
          predictionType: 'obstacle',
          targetStatement:
            'Downstream HTTP endpoint may trigger 429 rate limiting under sustained burst concurrency',
          predictedProbability: 0.65,
          confidence: 0.75,
          rationale:
            'API endpoints without client-side request throttling historically encounter burst throttles.',
          horizonDeadline: horizon,
        }),
      );
    }

    if (lower.includes('migration') || lower.includes('schema') || lower.includes('database')) {
      predictions.push(
        this.makePrediction({
          domain,
          predictionType: 'obstacle',
          targetStatement:
            'Database table lock or transaction timeout may occur during structural DDL execution',
          predictedProbability: 0.35,
          confidence: 0.8,
          rationale: 'Concurrent write connections during DDL alter locks can stall execution.',
          horizonDeadline: horizon,
        }),
      );
    }

    if (lower.includes('large') || lower.includes('stream') || lower.includes('file')) {
      predictions.push(
        this.makePrediction({
          domain,
          predictionType: 'obstacle',
          targetStatement:
            'Memory buffer allocation may approach quota threshold during heavy I/O ingest',
          predictedProbability: 0.45,
          confidence: 0.7,
          rationale:
            'Buffering uncompressed chunks in working memory incurs temporary memory pressure.',
          horizonDeadline: horizon,
        }),
      );
    }

    if (predictions.length === 0) {
      predictions.push(
        this.makePrediction({
          domain,
          predictionType: 'obstacle',
          targetStatement: 'Nominal operational execution with standard non-blocking overhead',
          predictedProbability: 0.85,
          confidence: 0.8,
          rationale:
            'No prominent high-risk operational obstacle signatures detected in task description.',
          horizonDeadline: horizon,
        }),
      );
    }

    return predictions;
  }

  // ==========================================
  // 4. Consequence Prediction
  // ==========================================

  public predictConsequences(
    intendedAction: string,
    context: string,
    domain = 'action_planning',
  ): CognitivePrediction[] {
    const now = new Date();
    const horizon = new Date(now.getTime() + 7200 * 1000).toISOString();

    const pred1 = this.makePrediction({
      domain,
      predictionType: 'consequence',
      targetStatement: `Intended action "${intendedAction}" will produce expected primary outcome under context "${context}"`,
      predictedProbability: 0.88,
      confidence: 0.85,
      rationale: 'Action matches grounded capability domain and validated tool specifications.',
      horizonDeadline: horizon,
    });

    const pred2 = this.makePrediction({
      domain,
      predictionType: 'consequence',
      targetStatement: `Secondary side effects from "${intendedAction}" will remain contained within nominal resource boundaries`,
      predictedProbability: 0.92,
      confidence: 0.8,
      rationale:
        'State mutations are bounded to transactional database rows and sandboxed processes.',
      horizonDeadline: horizon,
    });

    return [pred1, pred2];
  }

  // ==========================================
  // 5. Behavior Prediction
  // ==========================================

  public predictBehavior(
    agentOrEntity: string,
    context: string,
    likelyActions: string[],
    domain = 'behavioral',
  ): CognitivePrediction[] {
    const now = new Date();
    const horizon = new Date(now.getTime() + 86400 * 1000).toISOString();

    return likelyActions.map((action, i) => {
      const prob = Math.max(0.1, 0.8 - i * 0.2);
      return this.makePrediction({
        domain,
        predictionType: 'behavior',
        targetStatement: `${agentOrEntity} will execute action "${action}" given context "${context}"`,
        predictedProbability: prob,
        confidence: 0.75,
        rationale: `Historical behavior patterns and contextual cues favor "${action}" as rank #${i + 1} alternative.`,
        horizonDeadline: horizon,
      });
    });
  }

  // ==========================================
  // 6. Accuracy Metrics & Brier Score
  // ==========================================

  public getAccuracyMetrics(domain?: string): PredictionAccuracyMetrics {
    const predictions = this.repo.listPredictions({ domain, limit: 1000 });
    const resolved = predictions.filter(
      (p) => p.status === 'resolved_accurate' || p.status === 'resolved_inaccurate',
    );

    const total = predictions.length;
    const resolvedCount = resolved.length;
    const accurateCount = resolved.filter((p) => p.status === 'resolved_accurate').length;
    const accuracyRate = resolvedCount > 0 ? accurateCount / resolvedCount : 0.0;

    let totalError = 0;
    let totalBrier = 0;

    for (const p of resolved) {
      if (p.predictionError !== undefined) totalError += p.predictionError;
      if (p.brierScore !== undefined) totalBrier += p.brierScore;
    }

    const meanAbsoluteError = resolvedCount > 0 ? totalError / resolvedCount : 0.0;
    const brierScore = resolvedCount > 0 ? totalBrier / resolvedCount : 0.0;

    return {
      domain,
      totalPredictions: total,
      resolvedPredictions: resolvedCount,
      accurateCount,
      accuracyRate: Math.round(accuracyRate * 1000) / 1000,
      meanAbsoluteError: Math.round(meanAbsoluteError * 1000) / 1000,
      brierScore: Math.round(brierScore * 1000) / 1000,
    };
  }

  // ==========================================
  // 7. Predictive Summary
  // ==========================================

  public getPredictiveSummary(): PredictiveSummary {
    const predictions = this.repo.listPredictions({ limit: 1000 });
    const pending = predictions.filter((p) => p.status === 'pending');
    const resolved = predictions.filter(
      (p) => p.status === 'resolved_accurate' || p.status === 'resolved_inaccurate',
    );

    const accurateCount = resolved.filter((p) => p.status === 'resolved_accurate').length;
    const overallAccuracyRate = resolved.length > 0 ? accurateCount / resolved.length : 0.0;

    let totalBrier = 0;
    resolved.forEach((p) => {
      if (p.brierScore !== undefined) totalBrier += p.brierScore;
    });
    const meanBrierScore = resolved.length > 0 ? totalBrier / resolved.length : 0.0;

    const typeBreakdown: Record<string, number> = {};
    const domainFreq: Record<string, number> = {};

    predictions.forEach((p) => {
      typeBreakdown[p.predictionType] = (typeBreakdown[p.predictionType] ?? 0) + 1;
      domainFreq[p.domain] = (domainFreq[p.domain] ?? 0) + 1;
    });

    const dominantDomains = Object.entries(domainFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d]) => d);

    return {
      totalPredictions: predictions.length,
      pendingCount: pending.length,
      resolvedCount: resolved.length,
      overallAccuracyRate: Math.round(overallAccuracyRate * 1000) / 1000,
      meanBrierScore: Math.round(meanBrierScore * 1000) / 1000,
      typeBreakdown,
      dominantDomains,
    };
  }
}

// ==========================================
// In-Memory Repository for Engine Unit Tests
// ==========================================

export class InMemoryPredictiveRepository implements IPredictiveRepository {
  private predictions: CognitivePrediction[] = [];

  public createPrediction(prediction: CognitivePrediction): void {
    const idx = this.predictions.findIndex((p) => p.id === prediction.id);
    if (idx >= 0) {
      this.predictions[idx] = JSON.parse(JSON.stringify(prediction));
    } else {
      this.predictions.push(JSON.parse(JSON.stringify(prediction)));
    }
  }

  public getPredictionById(id: string): CognitivePrediction | null {
    const p = this.predictions.find((x) => x.id === id);
    return p ? JSON.parse(JSON.stringify(p)) : null;
  }

  public updatePrediction(prediction: CognitivePrediction): void {
    this.createPrediction(prediction);
  }

  public listPredictions(filter?: {
    domain?: string;
    status?: PredictionStatus;
    predictionType?: PredictionType;
    limit?: number;
  }): CognitivePrediction[] {
    let result = [...this.predictions];
    if (filter?.domain) {
      result = result.filter((p) => p.domain.toLowerCase() === filter.domain!.toLowerCase());
    }
    if (filter?.status) {
      result = result.filter((p) => p.status === filter.status);
    }
    if (filter?.predictionType) {
      result = result.filter((p) => p.predictionType === filter.predictionType);
    }
    result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return result.slice(0, filter?.limit ?? 100).map((p) => JSON.parse(JSON.stringify(p)));
  }

  public deletePrediction(id: string): void {
    this.predictions = this.predictions.filter((p) => p.id !== id);
  }
}
