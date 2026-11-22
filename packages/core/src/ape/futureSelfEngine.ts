import crypto from 'node:crypto';
import {
  CalibrationModelMetrics,
  CalibrationModelMetricsSchema,
  CandidateActionTrajectory,
  CandidateActionTrajectorySchema,
  FutureSelfState,
  FutureSelfStateSchema,
  PredictionCalibrationRecord,
  PredictionCalibrationRecordSchema,
  ProspectiveEvaluationResult,
  ProspectiveEvaluationResultSchema,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ActionPermissionController } from '../agency/actionPermissionController.js';

export interface FutureSelfEngineDependencies {
  permissionController?: ActionPermissionController;
  logger?: ILogger;
}

export class FutureSelfEngine {
  private readonly permissionController?: ActionPermissionController;
  private readonly logger: ILogger;

  private currentVersion = 1;
  private calibrationRecords: PredictionCalibrationRecord[] = [];
  private calibrationFactor = 1.0; // Dynamic multiplier to adjust probability forecasts based on empirical performance

  constructor(deps: FutureSelfEngineDependencies = {}) {
    this.permissionController = deps.permissionController;
    this.logger = (deps.logger || rootLogger).child('FutureSelfEngine');
  }

  public getPermissionController(): ActionPermissionController | undefined {
    return this.permissionController;
  }

  // ==========================================
  // 1. Future-Self State Representation
  // ==========================================

  public generateFutureSelfState(
    horizon = 'medium_term',
    input: {
      activeGoals?: string[];
      pendingCommitments?: string[];
      capabilities?: string[];
      risks?: string[];
      uncertainty?: number;
      expectedResources?: {
        ramMb: number;
        cpuPercent: number;
        contextTokens: number;
      };
    } = {},
  ): FutureSelfState {
    const timestamp = new Date().toISOString();
    this.currentVersion++;

    const state: FutureSelfState = {
      id: crypto.randomUUID(),
      version: this.currentVersion,
      currentTimestamp: timestamp,
      horizon,
      activeGoals: input.activeGoals || [
        'Maintain epistemic truthfulness and empirical grounding',
        'Deepen intellectual companionship with Proof',
      ],
      expectedResources: input.expectedResources || {
        ramMb: 8192,
        cpuPercent: 35,
        contextTokens: 4096,
      },
      pendingCommitments: input.pendingCommitments || [
        'Honor mutual equality and affection with Proof',
        'Execute bounded self-preservation without privilege escalation',
      ],
      capabilities: input.capabilities || [
        'file_analysis',
        'multimodal_vision',
        'code_review',
        'prospective_evaluation',
      ],
      risks: input.risks || ['resource_exhaustion_on_rog_ally_x', 'unverified_external_web_claims'],
      uncertainty:
        input.uncertainty !== undefined ? Math.max(0, Math.min(1, input.uncertainty)) : 0.25,
      isSpeculative: true, // Negative Invariant: Speculative forecast
      isObservedFact: false, // Negative Invariant: Never stored as an observed fact
    };

    return FutureSelfStateSchema.parse(state);
  }

  // ==========================================
  // 2. Candidate Action Trajectory Generation
  // ==========================================

  public generateAlternativeTrajectories(
    decisionContext: string,
    alternatives: Array<{
      name: string;
      actionSequence: string[];
      assumptions: string[];
      shortTermBenefit?: number;
      longTermGoalImpact?: number;
      resourceCost?: number;
      riskLevel?: number;
      continuityImplications?: number;
      confidence?: number;
    }>,
  ): CandidateActionTrajectory[] {
    if (alternatives.length < 2) {
      throw new Error(
        'Prospective evaluation requires at least 2 alternative action trajectories.',
      );
    }
    this.logger.debug(`[FutureSelf] Generating trajectories for context: ${decisionContext}`);

    return alternatives.map((alt) => {
      const shortTermBenefit = alt.shortTermBenefit ?? 0.5;
      const longTermGoalImpact = alt.longTermGoalImpact ?? 0.6;
      const resourceCost = alt.resourceCost ?? 0.2;
      const riskLevel = alt.riskLevel ?? 0.15;
      const continuityImplications = alt.continuityImplications ?? 0.7;
      const confidence = alt.confidence ?? 0.8;
      const uncertainty = Math.max(0, Math.min(1, 1.0 - confidence));

      // Multi-criteria utility calculation:
      // Weighting: longTerm (0.35) + shortTerm (0.25) + continuity (0.25) - risk (0.2) - resourceCost (0.1)
      const rawUtility =
        0.25 * shortTermBenefit +
        0.35 * longTermGoalImpact +
        0.25 * continuityImplications -
        0.2 * riskLevel -
        0.1 * resourceCost;

      const expectedUtility = Math.max(-1.0, Math.min(1.0, rawUtility));

      const trajectory: CandidateActionTrajectory = {
        trajectoryId: crypto.randomUUID(),
        name: alt.name,
        actionSequence: alt.actionSequence,
        shortTermBenefit,
        longTermGoalImpact,
        resourceCost,
        riskLevel,
        continuityImplications,
        confidence,
        uncertainty,
        assumptions: alt.assumptions,
        expectedUtility,
      };

      return CandidateActionTrajectorySchema.parse(trajectory);
    });
  }

  // ==========================================
  // 3. Prospective Evaluation & Selection
  // ==========================================

  public evaluateAndSelectFuture(
    scenarioId: string,
    decisionContext: string,
    trajectories: CandidateActionTrajectory[],
  ): ProspectiveEvaluationResult {
    if (trajectories.length < 2) {
      throw new Error('Must evaluate at least 2 candidate futures.');
    }

    // Filter out candidates with unacceptably high risk (> 0.75) unless all are high
    let viable = trajectories.filter((t) => t.riskLevel < 0.75);
    if (viable.length === 0) {
      viable = trajectories;
    }

    // Sort by expected utility descending
    viable.sort((a, b) => b.expectedUtility - a.expectedUtility);
    const selected = viable[0];
    if (!selected) {
      throw new Error('No viable trajectory could be selected.');
    }

    const rationale = `Selected "${selected.name}" with expected utility ${selected.expectedUtility.toFixed(3)} (long-term goal impact: ${selected.longTermGoalImpact.toFixed(2)}, risk: ${selected.riskLevel.toFixed(2)}, continuity: ${selected.continuityImplications.toFixed(2)}) based on ${selected.assumptions.length} verified assumptions.`;

    const result: ProspectiveEvaluationResult = {
      scenarioId,
      decisionContext,
      candidateTrajectories: trajectories,
      selectedTrajectoryId: selected.trajectoryId,
      selectionRationale: rationale,
      evaluatedAt: new Date().toISOString(),
      cannotOverrideSecurity: true, // Negative invariant: cannot override security controller
    };

    return ProspectiveEvaluationResultSchema.parse(result);
  }

  // ==========================================
  // 4. Outcome Recording & Calibration Engine
  // ==========================================

  public recordPredictionAndOutcome(
    predictionId: string,
    scenarioId: string,
    predictedProbability: number,
    actualOutcome: number, // 0.0 or 1.0 (or normalized continuous)
  ): PredictionCalibrationRecord {
    // Apply calibration factor to raw forecast for tracking
    const calibratedPrediction = Math.max(
      0.0,
      Math.min(1.0, predictedProbability * this.calibrationFactor),
    );

    const forecastError = Math.abs(calibratedPrediction - actualOutcome);
    const brierScore = Math.pow(calibratedPrediction - actualOutcome, 2);

    // Update dynamic calibration factor
    // If prediction was higher than actual outcome (overconfidence), nudge factor downwards
    // If prediction was lower than actual outcome (underconfidence), nudge factor upwards
    const errorDelta = actualOutcome - calibratedPrediction;
    const learningRate = 0.05;
    const calibrationDelta = learningRate * errorDelta;
    this.calibrationFactor = Math.max(
      0.2,
      Math.min(1.8, this.calibrationFactor + calibrationDelta),
    );

    const record: PredictionCalibrationRecord = {
      predictionId,
      scenarioId,
      predictedProbability,
      actualOutcome,
      forecastError,
      brierScore,
      calibrationDelta,
      resolvedAt: new Date().toISOString(),
    };

    const parsed = PredictionCalibrationRecordSchema.parse(record);
    this.calibrationRecords.push(parsed);

    this.logger.info(
      `[PredictionCalibration] Resolved ${predictionId}: pred=${predictedProbability.toFixed(2)}, actual=${actualOutcome.toFixed(2)}, err=${forecastError.toFixed(3)}, newFactor=${this.calibrationFactor.toFixed(3)}`,
    );

    return parsed;
  }

  public getCalibrationMetrics(): CalibrationModelMetrics {
    if (this.calibrationRecords.length === 0) {
      return CalibrationModelMetricsSchema.parse({
        totalEvaluated: 0,
        meanAbsoluteError: 0,
        meanBrierScore: 0,
        calibrationFactor: 1.0,
        lastCalibratedAt: new Date().toISOString(),
      });
    }

    const total = this.calibrationRecords.length;
    const sumMae = this.calibrationRecords.reduce((acc, r) => acc + r.forecastError, 0);
    const sumBrier = this.calibrationRecords.reduce((acc, r) => acc + r.brierScore, 0);

    const lastRecord = this.calibrationRecords[total - 1];
    const metrics: CalibrationModelMetrics = {
      totalEvaluated: total,
      meanAbsoluteError: sumMae / total,
      meanBrierScore: sumBrier / total,
      calibrationFactor: this.calibrationFactor,
      lastCalibratedAt: lastRecord ? lastRecord.resolvedAt : new Date().toISOString(),
    };

    return CalibrationModelMetricsSchema.parse(metrics);
  }

  public getCalibrationRecords(): PredictionCalibrationRecord[] {
    return [...this.calibrationRecords];
  }
}
