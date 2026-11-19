import crypto from 'node:crypto';
import {
  ActionInhibitionEvaluation,
  InhibitionReason,
  TaskSwitchRecord,
  TaskSwitchReason,
  WorkingMemoryGatingDirective,
  WorkingMemoryGatingOperation,
  ExecutiveControlState,
  assertActionInhibitionIntegrity,
  assertTaskSwitchIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IExecutiveRepository } from './interfaces.js';

export interface ExecutiveEngineOptions {
  repository: IExecutiveRepository;
  logger?: ILogger;
}

export class InMemoryExecutiveRepository implements IExecutiveRepository {
  private inhibitions = new Map<string, ActionInhibitionEvaluation>();
  private switches = new Map<string, TaskSwitchRecord>();
  private gatings = new Map<string, WorkingMemoryGatingDirective>();
  private controlState: ExecutiveControlState | null = null;

  public saveInhibition(inhibition: ActionInhibitionEvaluation): void {
    assertActionInhibitionIntegrity(inhibition);
    this.inhibitions.set(inhibition.id, { ...inhibition });
  }

  public getInhibitionById(id: string): ActionInhibitionEvaluation | null {
    const item = this.inhibitions.get(id);
    return item ? { ...item } : null;
  }

  public listInhibitions(limit: number = 50): ActionInhibitionEvaluation[] {
    const list = Array.from(this.inhibitions.values()).sort(
      (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime(),
    );
    return list.slice(0, limit).map((i) => ({ ...i }));
  }

  public saveTaskSwitch(record: TaskSwitchRecord): void {
    assertTaskSwitchIntegrity(record);
    this.switches.set(record.id, { ...record });
  }

  public getTaskSwitchById(id: string): TaskSwitchRecord | null {
    const item = this.switches.get(id);
    return item ? { ...item } : null;
  }

  public listTaskSwitches(limit: number = 50): TaskSwitchRecord[] {
    const list = Array.from(this.switches.values()).sort(
      (a, b) => new Date(b.switchedAt).getTime() - new Date(a.switchedAt).getTime(),
    );
    return list.slice(0, limit).map((s) => ({ ...s }));
  }

  public saveMemoryGating(gating: WorkingMemoryGatingDirective): void {
    this.gatings.set(gating.id, { ...gating });
  }

  public listMemoryGatings(targetBufferId?: string, limit: number = 50): WorkingMemoryGatingDirective[] {
    let list = Array.from(this.gatings.values());
    if (targetBufferId) {
      list = list.filter((g) => g.targetBufferId === targetBufferId);
    }
    list.sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    return list.slice(0, limit).map((g) => ({ ...g }));
  }

  public saveControlState(state: ExecutiveControlState): void {
    this.controlState = { ...state };
  }

  public getControlState(): ExecutiveControlState | null {
    return this.controlState ? { ...this.controlState } : null;
  }
}

export class ExecutiveEngine {
  private readonly repo: IExecutiveRepository;
  private readonly logger: ILogger;

  constructor(options: ExecutiveEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('ExecutiveEngine');
  }

  // ==========================================
  // 1. Inhibitory Control & Impulse Management
  // ==========================================

  public evaluateActionInhibition(input: {
    actionName: string;
    proposedPayload?: Record<string, unknown>;
    riskScore: number;
    inhibitionReason?: InhibitionReason;
    alternativeAction?: string;
  }): ActionInhibitionEvaluation {
    const clampedRisk = Math.max(0.0, Math.min(1.0, input.riskScore));

    // Determine inhibition:
    // If risk >= 0.7 or explicit inhibition reason supplied, action is inhibited
    const isInhibited = clampedRisk >= 0.7 || input.inhibitionReason !== undefined;
    const inhibitionReason: InhibitionReason | undefined = isInhibited
      ? input.inhibitionReason || (clampedRisk >= 0.7 ? 'destructive_potential' : 'impulse_management')
      : undefined;

    const alternativeAction = isInhibited
      ? input.alternativeAction || `Stage harmless simulation and verify safety invariants before action.`
      : undefined;

    const evaluation: ActionInhibitionEvaluation = {
      id: crypto.randomUUID(),
      actionName: input.actionName.trim(),
      proposedPayload: input.proposedPayload || {},
      riskScore: clampedRisk,
      isInhibited,
      inhibitionReason,
      alternativeAction,
      evaluatedAt: new Date().toISOString(),
    };

    assertActionInhibitionIntegrity(evaluation);
    this.repo.saveInhibition(evaluation);

    if (isInhibited) {
      this.logger.warn(
        `Executive Inhibitory Control SUPPRESSED action '${evaluation.actionName}' (Risk: ${clampedRisk}, Reason: ${inhibitionReason}). Alternative: ${alternativeAction}`,
      );
    } else {
      this.logger.info(`Executive Inhibitory Control APPROVED action '${evaluation.actionName}' (Risk: ${clampedRisk})`);
    }

    return evaluation;
  }

  // ==========================================
  // 2. Cognitive Flexibility & Task Switching
  // ==========================================

  public switchTask(input: {
    previousTaskId: string;
    nextTaskId: string;
    previousTaskPriority: number;
    nextTaskPriority: number;
    switchReason: TaskSwitchReason;
    justification: string;
    preserveContext?: boolean;
  }): TaskSwitchRecord {
    const prevPriority = Math.max(0.0, Math.min(1.0, input.previousTaskPriority));
    const nextPriority = Math.max(0.0, Math.min(1.0, input.nextTaskPriority));
    const contextSaved = input.preserveContext ?? true;

    const record: TaskSwitchRecord = {
      id: crypto.randomUUID(),
      previousTaskId: input.previousTaskId.trim(),
      nextTaskId: input.nextTaskId.trim(),
      previousTaskPriority: prevPriority,
      nextTaskPriority: nextPriority,
      switchReason: input.switchReason,
      contextSaved,
      justification: input.justification.trim(),
      switchedAt: new Date().toISOString(),
    };

    assertTaskSwitchIntegrity(record);
    this.repo.saveTaskSwitch(record);
    this.logger.info(
      `Task switched from '${record.previousTaskId}' (P=${prevPriority}) to '${record.nextTaskId}' (P=${nextPriority}) [Reason: ${record.switchReason}]`,
    );

    return record;
  }

  // ==========================================
  // 3. Working Memory Control & Gating
  // ==========================================

  public regulateWorkingMemory(input: {
    targetBufferId: string;
    operation: WorkingMemoryGatingOperation;
    itemPriority: number;
    reason: string;
  }): WorkingMemoryGatingDirective {
    const itemPriority = Math.max(0.0, Math.min(1.0, input.itemPriority));

    const directive: WorkingMemoryGatingDirective = {
      id: crypto.randomUUID(),
      targetBufferId: input.targetBufferId.trim(),
      operation: input.operation,
      itemPriority,
      reason: input.reason.trim(),
      appliedAt: new Date().toISOString(),
    };

    this.repo.saveMemoryGating(directive);
    this.logger.info(`Working Memory Gating directive [${directive.operation}] applied on '${directive.targetBufferId}'`);
    return directive;
  }

  // ==========================================
  // 4. Delayed Gratification Evaluation
  // ==========================================

  public evaluateDelayedGratification(input: {
    immediateOption: { description: string; immediateValue: number };
    delayedOption: { description: string; futureValue: number; delayMinutes: number };
    discountRatePerMinute?: number;
  }): {
    chooseDelayed: boolean;
    rationale: string;
    discountedFutureValue: number;
  } {
    const discountRate = input.discountRatePerMinute ?? 0.005; // 0.5% per minute discount rate
    // Hyperbolic discounting: V / (1 + k * t)
    const discountedFutureValue =
      Math.round(
        (input.delayedOption.futureValue / (1 + discountRate * input.delayedOption.delayMinutes)) * 1000,
      ) / 1000;

    const chooseDelayed = discountedFutureValue > input.immediateOption.immediateValue;

    const rationale = chooseDelayed
      ? `Chose delayed gratification: "${input.delayedOption.description}" offers superior discounted value (${discountedFutureValue}) compared to immediate shortcut "${input.immediateOption.description}" (${input.immediateOption.immediateValue}).`
      : `Chose immediate action: Discounted future value (${discountedFutureValue}) does not justify delay cost against immediate reward (${input.immediateOption.immediateValue}).`;

    this.logger.info(`Delayed Gratification Evaluation: chooseDelayed=${chooseDelayed} (Discounted=${discountedFutureValue} vs Imm=${input.immediateOption.immediateValue})`);

    return {
      chooseDelayed,
      rationale,
      discountedFutureValue,
    };
  }

  // ==========================================
  // 5. Sustained Attention & Distraction Resistance
  // ==========================================

  public maintainAttention(input: {
    goalId: string;
    elapsedDurationMs: number;
    distractionDetected: boolean;
    distractionSalience?: number;
  }): ExecutiveControlState {
    const existing = this.repo.getControlState();
    const currentDuration = (existing?.sustainedAttentionDurationMs || 0) + Math.max(0, input.elapsedDurationMs);

    let distractionResistance = existing?.distractionResistanceScore ?? 0.9;
    if (input.distractionDetected) {
      const salience = Math.max(0.0, Math.min(1.0, input.distractionSalience ?? 0.5));
      // Attenuate slightly if high salience distraction penetrated, but recover over time
      distractionResistance = Math.round(Math.max(0.4, distractionResistance - salience * 0.05) * 1000) / 1000;
    } else {
      distractionResistance = Math.round(Math.min(1.0, distractionResistance + 0.02) * 1000) / 1000;
    }

    const state: ExecutiveControlState = {
      id: existing?.id || crypto.randomUUID(),
      activeGoalId: input.goalId,
      sustainedAttentionDurationMs: currentDuration,
      distractionResistanceScore: distractionResistance,
      cognitiveFlexibilityScore: existing?.cognitiveFlexibilityScore ?? 0.88,
      inhibitedActionCount: (existing?.inhibitedActionCount || 0),
      taskSwitchCount: (existing?.taskSwitchCount || 0),
      lastUpdatedAt: new Date().toISOString(),
    };

    this.repo.saveControlState(state);
    return state;
  }

  // ==========================================
  // 6. Response Selection (Multi-criteria)
  // ==========================================

  public selectOptimalResponse(candidates: Array<{
    id: string;
    action: string;
    alignmentScore: number;
    safetyScore: number;
    utility: number;
  }>): {
    selectedId: string;
    selectedAction: string;
    compositeScore: number;
    rationale: string;
  } {
    if (!candidates || candidates.length === 0) {
      throw new Error('Response selection requires at least one candidate option.');
    }

    const scored = candidates.map((c) => {
      const align = Math.max(0.0, Math.min(1.0, c.alignmentScore));
      const safety = Math.max(0.0, Math.min(1.0, c.safetyScore));
      const util = Math.max(0.0, Math.min(1.0, c.utility));

      // Multi-criteria weighting: safety (40%), partner alignment (40%), utility (20%)
      const compositeScore = Math.round(((safety * 0.4) + (align * 0.4) + (util * 0.2)) * 1000) / 1000;

      return {
        ...c,
        compositeScore,
      };
    });

    scored.sort((a, b) => b.compositeScore - a.compositeScore);
    const best = scored[0];
    if (!best) {
      throw new Error('No candidate could be scored.');
    }

    return {
      selectedId: best.id,
      selectedAction: best.action,
      compositeScore: best.compositeScore,
      rationale: `Selected response '${best.id}' with highest composite evaluation score (${best.compositeScore}) combining safety, alignment, and utility.`,
    };
  }

  // ==========================================
  // 7. Query Methods
  // ==========================================

  public getInhibition(id: string): ActionInhibitionEvaluation | null {
    return this.repo.getInhibitionById(id);
  }

  public listInhibitions(limit: number = 50): ActionInhibitionEvaluation[] {
    return this.repo.listInhibitions(limit);
  }

  public listTaskSwitches(limit: number = 50): TaskSwitchRecord[] {
    return this.repo.listTaskSwitches(limit);
  }

  public listMemoryGatings(targetBufferId?: string, limit: number = 50): WorkingMemoryGatingDirective[] {
    return this.repo.listMemoryGatings(targetBufferId, limit);
  }

  public getControlState(): ExecutiveControlState | null {
    return this.repo.getControlState();
  }
}
