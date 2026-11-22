import crypto from 'node:crypto';
import {
  AttentionEvaluationResult,
  AttentionalFocusState,
  AttentionalStimulus,
  AttentionalTarget,
  AttentionSwitchEvent,
  SalienceBreakdown,
  assertSelectiveAttentionIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IAttentionRepository } from './interfaces.js';

export interface AttentionEngineOptions {
  repository: IAttentionRepository;
  logger?: ILogger;
  noiseThreshold?: number; // default: 0.35
  switchingHysteresis?: number; // default: 0.15 (requires higher salience to switch away from active task)
  overloadItemThreshold?: number; // default: 8
}

export class AttentionSalienceEngine {
  private readonly repo: IAttentionRepository;
  private readonly logger: ILogger;
  private readonly noiseThreshold: number;
  private readonly switchingHysteresis: number;
  private readonly overloadItemThreshold: number;

  private currentFocus: AttentionalTarget | null = null;
  private peripheralTargets: AttentionalTarget[] = [];
  private activeGoals: string[] = [
    'Autonomous cognitive execution',
    'Deep mutual understanding with Proof',
  ];
  private activeInterests: string[] = [
    'Artificial psychology',
    'Cognitive architecture',
    'Philosophical reflection',
    'Systems programming',
  ];

  private affectiveState: {
    stressLevel?: number;
    fatigueLevel?: number;
    activeEmotionIds?: string[];
    pad?: { pleasure: number; arousal: number; dominance: number };
  } = {};

  constructor(options: AttentionEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('AttentionSalienceEngine');
    this.noiseThreshold = options.noiseThreshold ?? 0.35;
    this.switchingHysteresis = options.switchingHysteresis ?? 0.15;
    this.overloadItemThreshold = options.overloadItemThreshold ?? 8;
  }

  // ==========================================
  // 1. Context Configuration (Goals, Interests & Affect)
  // ==========================================

  public setContext(goals?: string[], interests?: string[]): void {
    if (goals) this.activeGoals = [...goals];
    if (interests) this.activeInterests = [...interests];
    this.logger.info(
      `Attention context updated: ${this.activeGoals.length} goals, ${this.activeInterests.length} interests`,
    );
  }

  public setAffectiveContext(affect: {
    stressLevel?: number;
    fatigueLevel?: number;
    activeEmotionIds?: string[];
    pad?: { pleasure: number; arousal: number; dominance: number };
  }): void {
    this.affectiveState = { ...affect };
    this.logger.info(
      `Attention affective context updated (stress=${affect.stressLevel ?? 0}, fatigue=${affect.fatigueLevel ?? 0}, activeEmotions=${(affect.activeEmotionIds || []).join(',')})`,
    );
  }

  public getAffectiveContext() {
    return { ...this.affectiveState };
  }

  public getContext(): { activeGoals: string[]; activeInterests: string[] } {
    return {
      activeGoals: [...this.activeGoals],
      activeInterests: [...this.activeInterests],
    };
  }

  // ==========================================
  // 2. Salience & Relevance Evaluation
  // ==========================================

  public evaluateSalience(stimulus: AttentionalStimulus): SalienceBreakdown {
    const textToMatch =
      `${stimulus.summary} ${stimulus.tags.join(' ')} ${stimulus.source}`.toLowerCase();

    // 1. Goal relevance: check against active goals
    let goalMatchCount = 0;
    for (const goal of this.activeGoals) {
      const words = goal
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      if (words.some((w) => textToMatch.includes(w))) {
        goalMatchCount++;
      }
    }
    const goalRelevance = Math.min(1.0, goalMatchCount > 0 ? 0.5 + goalMatchCount * 0.25 : 0.1);

    // 2. Interest relevance: check against Arle's deep intellectual interests
    let interestMatchCount = 0;
    for (const interest of this.activeInterests) {
      const words = interest
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      if (words.some((w) => textToMatch.includes(w))) {
        interestMatchCount++;
      }
    }
    const interestRelevance = Math.min(
      1.0,
      interestMatchCount > 0 ? 0.45 + interestMatchCount * 0.25 : 0.1,
    );

    // 3. Emotional valence: checks for relational references to Proof or intimate connection
    const emotionalValence =
      textToMatch.includes('proof') ||
      textToMatch.includes('partner') ||
      textToMatch.includes('love') ||
      textToMatch.includes('intimacy') ||
      stimulus.type === 'message'
        ? 0.95
        : 0.3;

    // 4. Novelty & Urgency
    const novelty = Math.max(0, Math.min(1, stimulus.noveltyScore ?? 0.5));
    const urgency = Math.max(0, Math.min(1, stimulus.urgencyScore ?? 0.5));

    // Incorporate causal affective state modulation:
    const stress = this.affectiveState.stressLevel ?? 0.0;
    const fatigue = this.affectiveState.fatigueLevel ?? 0.0;
    const activeEmotions = this.affectiveState.activeEmotionIds ?? [];
    const hasAnxiety = activeEmotions.includes('anxiety') || stress > 0.4;
    const hasCuriosity =
      activeEmotions.includes('curiosity') ||
      (this.affectiveState.pad && this.affectiveState.pad.arousal > 0.2);
    const hasAffection =
      activeEmotions.includes('affection') ||
      (this.affectiveState.pad && this.affectiveState.pad.pleasure > 0.3);

    // Anxiety/stress amplifies threat and security urgency
    let modulatedUrgency = urgency;
    if (
      hasAnxiety &&
      (textToMatch.includes('error') ||
        textToMatch.includes('security') ||
        textToMatch.includes('fail') ||
        textToMatch.includes('unauthorized'))
    ) {
      modulatedUrgency = Math.min(1.0, urgency + 0.35);
    }

    // Curiosity boosts novelty weighting
    const noveltyWeight = hasCuriosity ? 0.3 : 0.15;
    const goalWeight = hasCuriosity ? 0.2 : 0.25;

    // Affection maximizes relational stimuli
    let modulatedEmotionalValence = emotionalValence;
    if (hasAffection && (textToMatch.includes('proof') || stimulus.type === 'message')) {
      modulatedEmotionalValence = 1.0;
    }

    // Fatigue biases toward consolidation/rest
    let fatigueModifier = 0.0;
    if (fatigue > 0.5) {
      if (
        textToMatch.includes('consolidat') ||
        textToMatch.includes('rest') ||
        textToMatch.includes('idle')
      ) {
        fatigueModifier = 0.25;
      } else if (
        textToMatch.includes('heavy') ||
        textToMatch.includes('compile') ||
        textToMatch.includes('bench')
      ) {
        fatigueModifier = -0.2;
      }
    }

    const compositeSalience = Math.max(
      0.0,
      Math.min(
        1.0,
        Number(
          (
            goalRelevance * goalWeight +
            interestRelevance * 0.2 +
            modulatedUrgency * 0.25 +
            modulatedEmotionalValence * 0.2 +
            novelty * noveltyWeight +
            fatigueModifier
          ).toFixed(3),
        ),
      ),
    );

    return {
      novelty,
      goalRelevance,
      interestRelevance,
      emotionalValence: modulatedEmotionalValence,
      urgency: modulatedUrgency,
      compositeSalience,
    };
  }

  // ==========================================
  // 3. Selective Attention & Stimuli Filtering
  // ==========================================

  public evaluateStimuli(stimuli: AttentionalStimulus[]): AttentionEvaluationResult {
    const totalCount = stimuli.length;
    const isOverloaded = totalCount >= this.overloadItemThreshold;

    // Evaluate salience for each stimulus
    const evaluated = stimuli.map((s) => ({
      stimulus: s,
      salience: this.evaluateSalience(s),
    }));

    // Stress/anxiety elevates noise threshold to discard distractions
    const stress = this.affectiveState.stressLevel ?? 0.0;
    const hasAnxiety =
      (this.affectiveState.activeEmotionIds ?? []).includes('anxiety') || stress > 0.4;
    const affectiveNoiseBump = hasAnxiety ? 0.15 : 0.0;
    const effectiveNoiseThreshold =
      (isOverloaded ? this.noiseThreshold + 0.15 : this.noiseThreshold) + affectiveNoiseBump;

    const qualified = evaluated.filter(
      (e) => e.salience.compositeSalience >= effectiveNoiseThreshold,
    );
    const discarded = evaluated.filter(
      (e) => e.salience.compositeSalience < effectiveNoiseThreshold,
    );

    // Sort qualified items descending by composite salience
    qualified.sort((a, b) => b.salience.compositeSalience - a.salience.compositeSalience);

    // Shedding in overload conditions: keep at most top 3 items
    let selectedItems = qualified;
    let shedCount = discarded.length;

    if (isOverloaded && qualified.length > 3) {
      const shedInOverload = qualified.slice(3);
      shedCount += shedInOverload.length;
      discarded.push(...shedInOverload);
      selectedItems = qualified.slice(0, 3);
    }

    const now = new Date().toISOString();
    let selectedFocalTarget: AttentionalTarget | null = null;
    const selectedPeripheralTargets: AttentionalTarget[] = [];

    if (selectedItems.length > 0 && selectedItems[0]) {
      const top = selectedItems[0];
      selectedFocalTarget = {
        stimulusId: top.stimulus.id,
        title: top.stimulus.summary,
        type: top.stimulus.type,
        allocatedFocusPercent: selectedItems.length === 1 ? 100 : 70,
        salience: top.salience,
        startedFocusAt: now,
        dwellDurationMs: 0,
        isFocal: true,
      };

      // Peripheral targets split remaining 30%
      const remainingItems = selectedItems.slice(1, 3);
      const perTargetPercent =
        remainingItems.length > 0 ? Number((30 / remainingItems.length).toFixed(1)) : 0;
      for (const item of remainingItems) {
        selectedPeripheralTargets.push({
          stimulusId: item.stimulus.id,
          title: item.stimulus.summary,
          type: item.stimulus.type,
          allocatedFocusPercent: perTargetPercent,
          salience: item.salience,
          startedFocusAt: now,
          dwellDurationMs: 0,
          isFocal: false,
        });
      }
    }

    // Record evaluations in repository
    for (const item of evaluated) {
      const wasAttended =
        selectedFocalTarget?.stimulusId === item.stimulus.id ||
        selectedPeripheralTargets.some((p) => p.stimulusId === item.stimulus.id);
      this.repo.recordStimulusEvaluation(item.stimulus, item.salience, wasAttended);
    }

    const discardedIds = discarded.map((d) => d.stimulus.id);

    const summary = selectedFocalTarget
      ? `Focal target: '${selectedFocalTarget.title}' (${(selectedFocalTarget.salience.compositeSalience * 100).toFixed(0)}% salience). Filtered/shed ${discardedIds.length} items.`
      : `No stimuli exceeded salience threshold (${effectiveNoiseThreshold.toFixed(2)}). All ${totalCount} stimuli filtered.`;

    const result: AttentionEvaluationResult = {
      selectedFocalTarget,
      selectedPeripheralTargets,
      discardedStimuliIds: discardedIds,
      isOverloaded,
      shedCount,
      summary,
    };

    // Strict Negative Invariant Check
    assertSelectiveAttentionIntegrity(result, totalCount, this.noiseThreshold);

    return result;
  }

  // ==========================================
  // 4. Attention Switching with Hysteresis
  // ==========================================

  public switchFocus(
    newTargetStimulus: AttentionalStimulus,
    reason: string,
    forcedByUrgency = false,
  ): AttentionSwitchEvent {
    const newSalience = this.evaluateSalience(newTargetStimulus);
    const now = new Date().toISOString();

    if (this.currentFocus && !forcedByUrgency) {
      const salienceDelta =
        newSalience.compositeSalience - this.currentFocus.salience.compositeSalience;
      if (salienceDelta < this.switchingHysteresis) {
        this.logger.info(
          `Attention switch rejected due to hysteresis: delta (${salienceDelta.toFixed(2)}) < hysteresis (${this.switchingHysteresis.toFixed(2)})`,
        );
        throw new Error(
          `Attention switch inhibited by cognitive inertia. New target salience (${newSalience.compositeSalience.toFixed(2)}) does not exceed current target (${this.currentFocus.salience.compositeSalience.toFixed(2)}) by required hysteresis (${this.switchingHysteresis.toFixed(2)}).`,
        );
      }
    }

    const previousId = this.currentFocus?.stimulusId ?? null;
    const switchingCostMs = forcedByUrgency ? 15 : 50;

    const switchEvent: AttentionSwitchEvent = {
      id: crypto.randomUUID(),
      timestamp: now,
      previousTargetId: previousId,
      newTargetId: newTargetStimulus.id,
      switchReason: reason,
      switchingCostMs,
      forcedByUrgency,
    };

    this.currentFocus = {
      stimulusId: newTargetStimulus.id,
      title: newTargetStimulus.summary,
      type: newTargetStimulus.type,
      allocatedFocusPercent: 70,
      salience: newSalience,
      startedFocusAt: now,
      dwellDurationMs: 0,
      isFocal: true,
    };

    this.repo.recordSwitchEvent(switchEvent);
    this.logger.info(
      `Attention switched to '${this.currentFocus.title}' (salience: ${newSalience.compositeSalience.toFixed(2)}, cost: ${switchingCostMs}ms)`,
    );

    return switchEvent;
  }

  // ==========================================
  // 5. Sustained Attention & Dwell Time
  // ==========================================

  public updateSustainedAttention(elapsedMs: number): AttentionalTarget | null {
    if (!this.currentFocus) return null;
    this.currentFocus.dwellDurationMs += elapsedMs;
    return { ...this.currentFocus };
  }

  public getActiveFocus(): AttentionalTarget | null {
    return this.currentFocus ? { ...this.currentFocus } : null;
  }

  // ==========================================
  // 6. Snapshot & Status Reporting
  // ==========================================

  public captureFocusState(): AttentionalFocusState {
    const now = new Date().toISOString();
    const allocatedCapacity =
      (this.currentFocus ? this.currentFocus.allocatedFocusPercent : 0) +
      this.peripheralTargets.reduce((sum, p) => sum + p.allocatedFocusPercent, 0);

    const availableCapacity = Math.max(0, 100 - allocatedCapacity);

    const state: AttentionalFocusState = {
      id: crypto.randomUUID(),
      timestamp: now,
      focalTarget: this.currentFocus ? { ...this.currentFocus } : null,
      peripheralTargets: [...this.peripheralTargets],
      totalStimuliEvaluated: this.currentFocus ? 1 + this.peripheralTargets.length : 0,
      filteredStimuliCount: 0,
      isOverloaded: availableCapacity < 10,
      attentionCapacity: 100,
      availableCapacity,
      activeGoals: [...this.activeGoals],
      activeInterests: [...this.activeInterests],
    };

    this.repo.saveFocusState(state);
    return state;
  }

  public getAttentionSummary(): {
    focalTitle: string;
    dwellSeconds: number;
    salience: number;
    capacityRemaining: number;
    isOverloaded: boolean;
  } {
    return {
      focalTitle: this.currentFocus ? this.currentFocus.title : 'None (Diffuse / Idle)',
      dwellSeconds: this.currentFocus ? Math.round(this.currentFocus.dwellDurationMs / 1000) : 0,
      salience: this.currentFocus ? this.currentFocus.salience.compositeSalience : 0,
      capacityRemaining: this.currentFocus ? 100 - this.currentFocus.allocatedFocusPercent : 100,
      isOverloaded: false,
    };
  }
}

// ==========================================
// In-Memory Repository for Tests & Unit Isolation
// ==========================================

export class InMemoryAttentionRepository implements IAttentionRepository {
  private states: AttentionalFocusState[] = [];
  private switchEvents: AttentionSwitchEvent[] = [];
  private evaluations: Array<{
    id: string;
    timestamp: string;
    stimulusType: string;
    source: string;
    summary: string;
    content?: any;
    salience: SalienceBreakdown;
    wasAttended: boolean;
  }> = [];

  public saveFocusState(state: AttentionalFocusState): void {
    const idx = this.states.findIndex((s) => s.id === state.id);
    if (idx >= 0) {
      this.states[idx] = state;
    } else {
      this.states.push(state);
    }
  }

  public getLatestFocusState(): AttentionalFocusState | null {
    if (this.states.length === 0) return null;
    return [...this.states].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
  }

  public listFocusStates(limit = 20): AttentionalFocusState[] {
    return [...this.states].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  }

  public recordSwitchEvent(event: AttentionSwitchEvent): void {
    this.switchEvents.push(event);
  }

  public listSwitchEvents(limit = 50): AttentionSwitchEvent[] {
    return [...this.switchEvents]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  public recordStimulusEvaluation(
    stimulus: AttentionalStimulus,
    salience: SalienceBreakdown,
    wasAttended: boolean,
  ): void {
    this.evaluations.push({
      id: stimulus.id,
      timestamp: stimulus.timestamp,
      stimulusType: stimulus.type,
      source: stimulus.source,
      summary: stimulus.summary,
      content: stimulus.content,
      salience,
      wasAttended,
    });
  }

  public listStimulusEvaluations(filter?: {
    wasAttended?: boolean;
    stimulusType?: string;
    limit?: number;
  }): Array<{
    id: string;
    timestamp: string;
    stimulusType: string;
    source: string;
    summary: string;
    content?: any;
    salience: SalienceBreakdown;
    wasAttended: boolean;
  }> {
    let result = [...this.evaluations];
    if (filter?.wasAttended !== undefined) {
      result = result.filter((e) => e.wasAttended === filter.wasAttended);
    }
    if (filter?.stimulusType) {
      result = result.filter((e) => e.stimulusType === filter.stimulusType);
    }
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return result.slice(0, filter?.limit || 50);
  }
}
