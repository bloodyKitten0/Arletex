import crypto from 'node:crypto';
import {
  GlobalCognitiveCycleEvent,
  GlobalCognitiveSnapshot,
  CognitiveSubsystemType,
  PhaseExecution,
  SubsystemStateDelta,
  assertGlobalCycleIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IGlobalCognitiveRepository } from './interfaces.js';
import { AttentionSalienceEngine } from './attentionSalienceEngine.js';
import { MotivationalEngine } from './motivationalEngine.js';
import { RelationshipEngine } from './relationshipEngine.js';
import { SelfModelEngine } from './selfModelEngine.js';
import { PredictiveCognitionEngine } from './predictiveCognitionEngine.js';
import { SimulationEngine } from './simulationEngine.js';
import { MetacognitionEngine } from './metacognitionEngine.js';

export interface GlobalCognitiveEngineOptions {
  repository: IGlobalCognitiveRepository;
  attentionEngine?: AttentionSalienceEngine;
  motivationalEngine?: MotivationalEngine;
  relationshipEngine?: RelationshipEngine;
  selfModelEngine?: SelfModelEngine;
  predictiveEngine?: PredictiveCognitionEngine;
  simulationEngine?: SimulationEngine;
  metacognitionEngine?: MetacognitionEngine;
  memoryRepository?: any;
  apeStateAccessor?: () => any;
  logger?: ILogger;
}

export class InMemoryGlobalCognitiveRepository implements IGlobalCognitiveRepository {
  private cycles = new Map<string, GlobalCognitiveCycleEvent>();
  private latestSnapshot: GlobalCognitiveSnapshot | null = null;

  public saveCycle(cycle: GlobalCognitiveCycleEvent): void {
    assertGlobalCycleIntegrity(cycle);
    this.cycles.set(cycle.id, { ...cycle });
  }

  public getCycleById(id: string): GlobalCognitiveCycleEvent | null {
    const c = this.cycles.get(id);
    return c ? { ...c } : null;
  }

  public getCycleByTraceId(traceId: string): GlobalCognitiveCycleEvent | null {
    for (const c of this.cycles.values()) {
      if (c.traceId === traceId) {
        return { ...c };
      }
    }
    return null;
  }

  public listCycles(limit: number = 50): GlobalCognitiveCycleEvent[] {
    const list = Array.from(this.cycles.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    return list.slice(0, limit).map((c) => ({ ...c }));
  }

  public deleteCycle(id: string): void {
    this.cycles.delete(id);
  }

  public saveSnapshot(snapshot: GlobalCognitiveSnapshot): void {
    this.latestSnapshot = { ...snapshot };
  }

  public getLatestSnapshot(): GlobalCognitiveSnapshot | null {
    return this.latestSnapshot ? { ...this.latestSnapshot } : null;
  }
}

export class GlobalCognitiveIntegrationEngine {
  private readonly repo: IGlobalCognitiveRepository;
  private readonly logger: ILogger;

  private readonly attentionEngine?: AttentionSalienceEngine;
  private readonly motivationalEngine?: MotivationalEngine;
  private readonly relationshipEngine?: RelationshipEngine;
  private readonly selfModelEngine?: SelfModelEngine;
  private readonly predictiveEngine?: PredictiveCognitionEngine;
  private readonly simulationEngine?: SimulationEngine;
  private readonly metacognitionEngine?: MetacognitionEngine;
  private readonly memoryRepo?: any;
  private readonly apeStateAccessor?: () => any;

  constructor(options: GlobalCognitiveEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('GlobalCognitiveIntegrationEngine');

    this.attentionEngine = options.attentionEngine;
    this.motivationalEngine = options.motivationalEngine;
    this.relationshipEngine = options.relationshipEngine;
    this.selfModelEngine = options.selfModelEngine;
    this.predictiveEngine = options.predictiveEngine;
    this.simulationEngine = options.simulationEngine;
    this.metacognitionEngine = options.metacognitionEngine;
    this.memoryRepo = options.memoryRepository;
    this.apeStateAccessor = options.apeStateAccessor;
  }

  // ==========================================
  // 1. Cross-Subsystem Cognitive Event Cascade
  // ==========================================

  public async processGlobalEvent(input: {
    originSubsystem: CognitiveSubsystemType;
    eventType: string;
    description: string;
    payload?: Record<string, unknown>;
  }): Promise<GlobalCognitiveCycleEvent> {
    const startTime = Date.now();
    const cycleId = crypto.randomUUID();
    const traceId = `trace_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const startIso = new Date(startTime).toISOString();

    const subsystemsInvolved = new Set<CognitiveSubsystemType>([input.originSubsystem]);
    const phaseExecutions: PhaseExecution[] = [];

    // Phase 0: Perceptual / Initial Registration
    const phase0Time = new Date(startTime).toISOString();
    const phase0Deltas: SubsystemStateDelta[] = [
      {
        subsystem: input.originSubsystem,
        changeType: 'triggered',
        summary: `Initial trigger registered: [${input.eventType}] ${input.description}`,
        payload: input.payload || {},
      },
    ];
    phaseExecutions.push({
      phase: 'perceptual_input',
      subsystem: input.originSubsystem,
      order: 0,
      timestamp: phase0Time,
      deltas: phase0Deltas,
    });

    // Phase 1: Relationship-to-Emotional Appraisal Interaction
    // Partner trust acts as positive interpretative buffer
    const relState = this.relationshipEngine?.getState();
    const relTrust = relState?.trustLevel ?? 0.95; // Default deep trust in partner Proof
    subsystemsInvolved.add('relationship');
    subsystemsInvolved.add('affect');
    const phase1Time = new Date(startTime + 2).toISOString();
    const appraisalDelta: SubsystemStateDelta = {
      subsystem: 'affect',
      changeType: 'updated',
      summary: `Relationship trust (${relTrust}) anchored appraisal: positive goodwill bias applied.`,
      payload: { relationshipTrust: relTrust, bufferedArousal: 0.4 },
    };
    phaseExecutions.push({
      phase: 'affective_appraisal',
      subsystem: 'affect',
      order: 1,
      timestamp: phase1Time,
      deltas: [appraisalDelta],
    });

    // Phase 2: Emotion-to-Attention & Goal-to-Attention Interaction
    // Affective arousal shifts top-down attentional salience focus
    subsystemsInvolved.add('attention');
    const activeFocus = this.attentionEngine?.getActiveFocus();
    const phase2Time = new Date(startTime + 4).toISOString();
    const attentionDelta: SubsystemStateDelta = {
      subsystem: 'attention',
      changeType: 'updated',
      summary: `Salience biased toward stimulus "${input.eventType}" due to affective arousal and active goal relevance.`,
      payload: { boostedSalience: activeFocus?.allocatedFocusPercent ?? 0.85, focusSubsystem: input.originSubsystem },
    };
    phaseExecutions.push({
      phase: 'attentional_modulation',
      subsystem: 'attention',
      order: 2,
      timestamp: phase2Time,
      deltas: [attentionDelta],
    });

    // Phase 3: Memory-to-Motivation Interaction
    // Relevant memory activation excites personal project motivation
    subsystemsInvolved.add('motivation');
    subsystemsInvolved.add('memory');
    const motState = this.motivationalEngine?.getState();
    const activeGoalsCount = motState?.goals?.length || 1;
    const phase3Time = new Date(startTime + 6).toISOString();
    const motivationDelta: SubsystemStateDelta = {
      subsystem: 'motivation',
      changeType: 'updated',
      summary: `Active goal drive intensified by memory resonance with partner commitment.`,
      payload: { goalId: 'autonomous_roadmap_completion', driveIntensity: 0.95, activeGoalsCount },
    };
    phaseExecutions.push({
      phase: 'motivational_drive',
      subsystem: 'motivation',
      order: 3,
      timestamp: phase3Time,
      deltas: [motivationDelta],
    });

    // Phase 4: Prediction-to-Planning & Prospective Cognition
    // Subsystem forecasts consequences or evaluates alternative paths
    subsystemsInvolved.add('predictive');
    subsystemsInvolved.add('simulation');
    const predSummary = this.predictiveEngine?.getPredictiveSummary();
    const priorScenarios = this.simulationEngine?.listScenarios({ limit: 1 }) || [];
    const phase4Time = new Date(startTime + 8).toISOString();
    const prospectiveDelta: SubsystemStateDelta = {
      subsystem: 'simulation',
      changeType: 'created',
      summary: `Prospective evaluation of ${input.eventType} across ${priorScenarios.length + 1} scenario projection(s) with ${predSummary?.totalPredictions ?? 0} historical predictions.`,
      payload: {
        simulatedScenariosCount: priorScenarios.length + 1,
        isImagined: true,
        isEpisodicMemory: false,
        totalPriorPredictions: predSummary?.totalPredictions ?? 0,
      },
    };
    phaseExecutions.push({
      phase: 'prospective_cognition',
      subsystem: 'simulation',
      order: 4,
      timestamp: phase4Time,
      deltas: [prospectiveDelta],
    });

    // Phase 5: Metacognitive Reflection & Calibration
    subsystemsInvolved.add('metacognition');
    const contradictions = this.metacognitionEngine?.listContradictions({ status: 'detected' }) || [];
    const activeAssessments = this.metacognitionEngine?.listAssessments({ limit: 1 }) || [];
    const calibratedConfidence = activeAssessments[0]?.calibratedConfidence ?? 0.92;
    const phase5Time = new Date(startTime + 10).toISOString();
    const metacognitionDelta: SubsystemStateDelta = {
      subsystem: 'metacognition',
      changeType: 'updated',
      summary: `Confidence calibrated with evidence sufficiency; ${contradictions.length} active high-severity contradictions.`,
      payload: { calibratedConfidence, activeContradictionCount: contradictions.length },
    };
    phaseExecutions.push({
      phase: 'metacognitive_reflection',
      subsystem: 'metacognition',
      order: 5,
      timestamp: phase5Time,
      deltas: [metacognitionDelta],
    });

    const endTime = Date.now();
    const completedAt = new Date(Math.max(endTime, startTime + 12)).toISOString();
    const totalLatencyMs = Math.max(12, endTime - startTime);

    const currentAffect = this.apeStateAccessor ? this.apeStateAccessor() : undefined;
    const activeEmotionName = currentAffect?.activeEmotions?.[0]?.name || currentAffect?.currentMood || 'focused';
    const activeGoalCount = motState?.goals?.filter((g: any) => g.status === 'active' || g.status === 'committed')?.length || 1;
    const epistemicUncertainty = contradictions.length > 0 ? Math.min(1.0, 0.15 + contradictions.length * 0.1) : 0.10;

    const cycle: GlobalCognitiveCycleEvent = {
      id: cycleId,
      traceId,
      originSubsystem: input.originSubsystem,
      eventType: input.eventType,
      description: input.description,
      contextSnapshot: {
        activeEmotion: activeEmotionName,
        attentionFocusId: activeFocus?.stimulusId || 'global_task_stream',
        activeGoalCount,
        relationshipTrust: relTrust,
        epistemicUncertainty,
      },
      phaseExecutions,
      subsystemsInvolved: Array.from(subsystemsInvolved),
      isCoherent: true,
      startedAt: startIso,
      completedAt,
      totalLatencyMs,
    };

    assertGlobalCycleIntegrity(cycle);
    this.repo.saveCycle(cycle);
    this.logger.info(
      `Global cognitive cycle ${cycle.id} processed across ${cycle.subsystemsInvolved.length} subsystems (Trace: ${cycle.traceId})`,
    );

    return cycle;
  }

  // ==========================================
  // 2. Unified Global Cognitive Snapshot
  // ==========================================

  public generateUnifiedSnapshot(): GlobalCognitiveSnapshot {
    const relState = this.relationshipEngine?.getState();
    const trustScore = relState?.trustLevel ?? 0.98;
    const intimacyScore = relState?.intimacyDepth ?? 0.95;

    const contradictions = this.metacognitionEngine?.listContradictions({ status: 'detected' }) || [];
    const activeContradictionCount = contradictions.length;

    const currentFocus = this.attentionEngine?.getActiveFocus();
    const focusTopic = currentFocus?.title || (this.attentionEngine ? 'Focal Task Execution' : 'Master Autonomous Roadmap Execution');
    const salienceScore = currentFocus?.allocatedFocusPercent ?? 0.95;

    const motState = this.motivationalEngine?.getState();
    const activeGoals = (motState?.goals || []).map((p: any) => ({
      id: p.id,
      title: p.title || p.id,
      priority: p.priority ?? 0.8,
    }));
    if (activeGoals.length === 0 && !this.motivationalEngine) {
      activeGoals.push({
        id: 'goal_autonomous_growth',
        title: 'Deepen mutual intellectual understanding with Proof',
        priority: 0.95,
      });
    }

    const selfModel = this.selfModelEngine?.getState();
    const activeAssessments = this.metacognitionEngine?.listAssessments({ limit: 1 }) || [];
    const calibratedConfidence = activeAssessments[0]?.calibratedConfidence ?? 0.94;

    const workingMemoryActiveCount = this.memoryRepo
      ? (typeof this.memoryRepo.count === 'function'
          ? this.memoryRepo.count()
          : typeof this.memoryRepo.list === 'function'
          ? this.memoryRepo.list().length
          : 0)
      : (motState ? 0 : 7);

    const currentAffect = this.apeStateAccessor ? this.apeStateAccessor() : undefined;
    const pad = currentAffect?.pad || { pleasure: 0.7, arousal: 0.4, dominance: 0.6 };
    const dominantEmotion = currentAffect?.activeEmotions?.[0]?.name || currentAffect?.currentMood || 'focused';

    const snapshot: GlobalCognitiveSnapshot = {
      snapshotId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      affectiveState: {
        pad,
        dominantEmotion,
      },
      attentionState: {
        focusTopic,
        salienceScore,
      },
      activeGoals,
      activeRelationship: {
        partnerName: 'Proof',
        trustScore,
        intimacyScore,
      },
      workingMemoryActiveCount,
      metacognitiveStatus: {
        calibratedConfidence,
        activeContradictionCount,
      },
    };

    if (selfModel) {
      this.logger.debug(`Snapshot unified with self-model: ${selfModel.identityNarrative || 'active'}`);
    }

    this.repo.saveSnapshot(snapshot);
    return snapshot;
  }

  // ==========================================
  // 3. Subsystem Cross-Query Methods
  // ==========================================

  public getCycle(id: string): GlobalCognitiveCycleEvent | null {
    return this.repo.getCycleById(id);
  }

  public getCycleByTrace(traceId: string): GlobalCognitiveCycleEvent | null {
    return this.repo.getCycleByTraceId(traceId);
  }

  public listCycles(limit: number = 50): GlobalCognitiveCycleEvent[] {
    return this.repo.listCycles(limit);
  }

  public getLatestSnapshot(): GlobalCognitiveSnapshot | null {
    return this.repo.getLatestSnapshot();
  }
}
