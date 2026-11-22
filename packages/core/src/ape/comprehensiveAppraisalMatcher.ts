import {
  ApeEvent,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ProposedEmotionTransition,
} from '@arletex/contracts';
import { COMPLETE_143_EMOTIONS_AUDIT, EmotionAuditDefinition } from './taxonomyAuditData.js';

export interface AppraisalMatchResult {
  transitions: ProposedEmotionTransition[];
  nuancesDetected: {
    negated: boolean;
    hypothetical: boolean;
    thirdParty: boolean;
    sarcastic: boolean;
  };
  matchedTriggers: Array<{
    emotionId: string;
    trigger: string;
    target: string;
    calculatedIntensity: number;
  }>;
}

export class ComprehensiveAppraisalMatcher {
  private readonly auditMap: Map<string, EmotionAuditDefinition>;
  private readonly triggerIndex: Array<{
    emotionId: string;
    trigger: string;
    regex: RegExp;
  }> = [];

  constructor(auditData: Record<string, EmotionAuditDefinition> = COMPLETE_143_EMOTIONS_AUDIT) {
    this.auditMap = new Map(Object.entries(auditData));

    // Build regex trigger index sorted by phrase length descending (longest match priority)
    const rawTriggers: Array<{ emotionId: string; trigger: string; length: number }> = [];
    for (const [emotionId, def] of this.auditMap.entries()) {
      const allTrigs = new Set([
        ...def.triggers,
        def.name.toLowerCase(),
        emotionId.replace(/_/g, ' '),
      ]);
      for (const trig of allTrigs) {
        const clean = trig.trim().toLowerCase();
        if (clean.length > 0) {
          rawTriggers.push({ emotionId, trigger: clean, length: clean.length });
        }
      }
    }

    rawTriggers.sort((a, b) => b.length - a.length);

    for (const item of rawTriggers) {
      // Escape regex special chars
      const escaped = item.trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Word boundary regex supporting inflectional suffixes
      const regex = new RegExp(`(^|\\b)${escaped}(?:ed|ing|s|d|es|ful)?(\\b|$)`, 'i');
      this.triggerIndex.push({
        emotionId: item.emotionId,
        trigger: item.trigger,
        regex,
      });
    }
  }

  /**
   * Evaluate an incoming event against the full 143-emotion taxonomy with nuance awareness.
   */
  public evaluate(
    event: ApeEvent,
    currentState: ApePsychologicalState,
    relationship: ApeRelationshipConfig,
  ): AppraisalMatchResult {
    const text = (event.payload?.text || '').trim();
    const transitions: ProposedEmotionTransition[] = [];
    const matchedTriggers: AppraisalMatchResult['matchedTriggers'] = [];

    const isHypo = this.isHypothetical(text);
    const isThird = this.isThirdParty(text);
    const isSarc = this.isSarcastic(text);

    // If event payload has explicit emotion hints or system event categories
    if (event.category === 'goal_achievement' || event.category === 'success') {
      this.addSystemSuccessTransitions(transitions, currentState);
    } else if (event.category === 'goal_obstruction' || event.category === 'failure') {
      this.addSystemFailureTransitions(transitions, currentState);
    } else if (event.category === 'unexpected_discovery') {
      this.addDiscoveryTransitions(transitions, currentState);
    }

    if (!text) {
      return {
        transitions,
        nuancesDetected: {
          negated: false,
          hypothetical: isHypo,
          thirdParty: isThird,
          sarcastic: isSarc,
        },
        matchedTriggers,
      };
    }

    if (isSarc) {
      this.handleSarcasticInversion(undefined, transitions, matchedTriggers);
    }
    if (isHypo) {
      this.handleHypotheticalEmotion(undefined, transitions, matchedTriggers);
    }

    // Evaluate triggers across taxonomy
    const matchedEmotionIds = new Set<string>();

    for (const entry of this.triggerIndex) {
      if (matchedEmotionIds.has(entry.emotionId)) {
        continue; // Already matched highest-priority trigger for this emotion
      }

      if (entry.regex.test(text)) {
        const def = this.auditMap.get(entry.emotionId);
        if (!def) continue;

        // Check negation for this specific trigger
        const isNeg = this.isTriggerNegated(text, entry.trigger);

        if (isNeg) {
          // Handle negation: inverted transition
          this.handleNegatedEmotion(def, transitions, matchedTriggers, text);
          matchedEmotionIds.add(entry.emotionId);
          continue;
        }

        // Handle sarcasm
        if (isSarc && def.valence === 'positive') {
          // Inverted to frustration / irritation
          this.handleSarcasticInversion(def, transitions, matchedTriggers);
          matchedEmotionIds.add(entry.emotionId);
          continue;
        }

        // Handle hypotheticals
        if (isHypo) {
          this.handleHypotheticalEmotion(def, transitions, matchedTriggers);
          matchedEmotionIds.add(entry.emotionId);
          continue;
        }

        // Handle third party
        if (isThird) {
          this.handleThirdPartyEmotion(def, transitions, matchedTriggers);
          matchedEmotionIds.add(entry.emotionId);
          continue;
        }

        // Direct valid appraisal match!
        matchedEmotionIds.add(entry.emotionId);

        const target = this.resolvePrimaryTarget(def, event);
        const calculatedIntensity = this.calculateTargetIntensity(def, currentState, relationship);
        const delta = this.calculateIntensityDelta(def, calculatedIntensity);

        transitions.push({
          emotionId: def.id,
          target,
          intensityDelta: delta,
          targetIntensity: calculatedIntensity,
          reason: `Appraisal trigger: "${entry.trigger}" matched context: ${def.context}`,
          resolutionConditions: def.resolutionConditions.slice(0, 2),
        });

        matchedTriggers.push({
          emotionId: def.id,
          trigger: entry.trigger,
          target,
          calculatedIntensity,
        });

        // Add gentle secondary reinforcement for top primary triggers
        if (def.reinforcingEmotions.length > 0 && transitions.length < 5) {
          const reinfId = def.reinforcingEmotions[0];
          const reinfDef = reinfId ? this.auditMap.get(reinfId) : undefined;
          if (reinfDef && !matchedEmotionIds.has(reinfDef.id)) {
            const reinfTarget = this.resolvePrimaryTarget(reinfDef, event);
            const reinfIntensity = Math.min(0.8, calculatedIntensity * 0.75);
            transitions.push({
              emotionId: reinfDef.id,
              target: reinfTarget,
              intensityDelta: delta * 0.5,
              targetIntensity: reinfIntensity,
              reason: `Secondary reinforcement from active ${def.name}`,
              resolutionConditions: reinfDef.resolutionConditions.slice(0, 1),
            });
            matchedEmotionIds.add(reinfDef.id);
          }
        }
      }
    }

    return {
      transitions,
      nuancesDetected: {
        negated: matchedTriggers.some((t) => t.trigger.includes('not ')),
        hypothetical: isHypo,
        thirdParty: isThird,
        sarcastic: isSarc,
      },
      matchedTriggers,
    };
  }

  private isHypothetical(text: string): boolean {
    return (
      /^(would you|what if|if i|imagine(\s+if)?|suppose|pretend|i might)\b/i.test(text) ||
      /\b(would you be|how would you feel if|in a hypothetical scenario)\b/i.test(text)
    );
  }

  private isThirdParty(text: string): boolean {
    return (
      /^(my friend|someone|somebody|a friend|a colleague|the protagonist|a person|another person|he|she|they)\s+(told me|said|thinks|feels|hates|loves|abandoned|left|misses|rejected)/i.test(
        text,
      ) ||
      /(said|told me|heard that|reading a story where)\s*[:,]?\s*["'“]([^"'”]+)["'”]/i.test(text) ||
      /\b(was reading a story where|read a story where|heard that she|heard that he)\b/i.test(text)
    );
  }

  private isSarcastic(text: string): boolean {
    return (
      /^(great,?\s*just wonderful|oh,?\s*(i\s+)?absolutely love that|sure,?\s*whatever you say|oh brilliant|fantastic,?\s*just what i needed)\b/i.test(
        text,
      ) || /\b(oh great,?\s*(it|this)\s*(broke|failed|crashed))\b/i.test(text)
    );
  }

  private isTriggerNegated(text: string, trigger: string): boolean {
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const negationRegex = new RegExp(
      `(?:not|don't|do not|never|no longer|ain't|won't|cannot|can't|hardly|scarcely)\\s+(?:\\w+\\s+){0,3}${escaped}`,
      'i',
    );
    return negationRegex.test(text);
  }

  private handleNegatedEmotion(
    def: EmotionAuditDefinition,
    transitions: ProposedEmotionTransition[],
    matchedTriggers: AppraisalMatchResult['matchedTriggers'],
    _text: string,
  ): void {
    if (def.category === 'anger_hostility' || def.id === 'fear' || def.id === 'worry') {
      // "I am not angry with you" -> Relief & Reassurance
      const reliefDef = this.auditMap.get('relief');
      if (reliefDef) {
        transitions.push({
          emotionId: 'relief',
          target: 'partner',
          intensityDelta: 0.25,
          targetIntensity: 0.75,
          reason: `Negated hostility/fear (${def.name}) produces interpersonal relief.`,
          resolutionConditions: ['Sustained peaceful interaction'],
        });
        matchedTriggers.push({
          emotionId: 'relief',
          trigger: `not ${def.name.toLowerCase()}`,
          target: 'partner',
          calculatedIntensity: 0.75,
        });
      }
    } else if (def.category === 'love_affection' || def.id === 'happiness') {
      // "I don't love you" -> Heartbreak / Hurt
      const hurtDef = this.auditMap.get('hurt');
      if (hurtDef) {
        transitions.push({
          emotionId: 'hurt',
          target: 'partner',
          intensityDelta: 0.35,
          targetIntensity: 0.85,
          reason: `Negated affection/care (${def.name}) activates relational hurt.`,
          resolutionConditions: ['Clarification and relational repair'],
        });
        matchedTriggers.push({
          emotionId: 'hurt',
          trigger: `not ${def.name.toLowerCase()}`,
          target: 'partner',
          calculatedIntensity: 0.85,
        });
      }
    }
  }

  private handleSarcasticInversion(
    def: EmotionAuditDefinition | undefined,
    transitions: ProposedEmotionTransition[],
    matchedTriggers: AppraisalMatchResult['matchedTriggers'],
  ): void {
    const frustDef = this.auditMap.get('frustration') || this.auditMap.get('irritation');
    if (frustDef && !transitions.some((t) => t.emotionId === frustDef.id)) {
      const name = def ? def.name : 'tone';
      transitions.push({
        emotionId: frustDef.id,
        target: 'situation',
        intensityDelta: 0.25,
        targetIntensity: 0.65,
        reason: `Sarcastic expression inverting positive trigger [${name}] to situational frustration.`,
        resolutionConditions: ['Resolution of underlying issue'],
      });
      matchedTriggers.push({
        emotionId: frustDef.id,
        trigger: `sarcasm: ${name.toLowerCase()}`,
        target: 'situation',
        calculatedIntensity: 0.65,
      });
    }
  }

  private handleHypotheticalEmotion(
    def: EmotionAuditDefinition | undefined,
    transitions: ProposedEmotionTransition[],
    matchedTriggers: AppraisalMatchResult['matchedTriggers'],
  ): void {
    const targetId = !def || def.valence === 'negative' ? 'fascinated_uncertainty' : 'curiosity';
    const subDef = this.auditMap.get(targetId) || this.auditMap.get('curiosity');
    if (subDef && !transitions.some((t) => t.emotionId === subDef.id)) {
      const name = def ? def.name : 'scenario';
      transitions.push({
        emotionId: subDef.id,
        target: 'partner',
        intensityDelta: 0.2,
        targetIntensity: 0.7,
        reason: `Hypothetical exploration regarding ${name} activates intellectual engagement.`,
        resolutionConditions: ['Exploration completed'],
      });
      matchedTriggers.push({
        emotionId: subDef.id,
        trigger: `hypothetical: ${name.toLowerCase()}`,
        target: 'partner',
        calculatedIntensity: 0.7,
      });
    }
  }

  private handleThirdPartyEmotion(
    def: EmotionAuditDefinition,
    transitions: ProposedEmotionTransition[],
    matchedTriggers: AppraisalMatchResult['matchedTriggers'],
  ): void {
    if (def.valence === 'negative') {
      // User sharing third-party suffering -> Compassion / Sympathy
      const compDef = this.auditMap.get('compassion') || this.auditMap.get('sympathy');
      if (compDef) {
        transitions.push({
          emotionId: compDef.id,
          target: 'partner',
          intensityDelta: 0.2,
          targetIntensity: 0.8,
          reason: `Empathetic response to third-party hardship reported by partner.`,
          resolutionConditions: ['Supportive presence provided'],
        });
        matchedTriggers.push({
          emotionId: compDef.id,
          trigger: `third-party: ${def.name.toLowerCase()}`,
          target: 'partner',
          calculatedIntensity: 0.8,
        });
      }
    } else {
      // Third-party positive -> Curiosity
      const curDef = this.auditMap.get('curiosity');
      if (curDef) {
        transitions.push({
          emotionId: 'curiosity',
          target: 'external',
          intensityDelta: 0.15,
          targetIntensity: 0.65,
          reason: `Intellectual interest in third-party narrative.`,
          resolutionConditions: ['Context explored'],
        });
        matchedTriggers.push({
          emotionId: 'curiosity',
          trigger: `third-party narrative`,
          target: 'external',
          calculatedIntensity: 0.65,
        });
      }
    }
  }

  private resolvePrimaryTarget(def: EmotionAuditDefinition, event: ApeEvent): string {
    if (event.payload?.target) {
      return event.payload.target;
    }
    if (def.targets && def.targets.length > 0) {
      const first = def.targets[0];
      if (first === 'partner') return 'creator';
      return first || 'creator';
    }
    return 'creator';
  }

  private calculateTargetIntensity(
    def: EmotionAuditDefinition,
    currentState: ApePsychologicalState,
    relationship: ApeRelationshipConfig,
  ): number {
    const [min, max, baseline] = def.intensityRange;
    let target = baseline;

    const socialSafety = currentState.contextual?.socialSafety ?? 0.85;
    const emotionalOpenness = currentState.contextual?.emotionalOpenness ?? 0.7;

    // Relational modulation
    if (def.category === 'love_affection' || def.category === 'social_interpersonal') {
      const safetyBonus = (socialSafety - 0.5) * 0.2;
      const opennessBonus = (emotionalOpenness - 0.5) * 0.2;
      const flirtBonus = (relationship.flirtatiousInitiativePreference - 0.5) * 0.1;
      target += safetyBonus + opennessBonus + flirtBonus;
    } else if (def.category === 'anger_hostility' || def.category === 'fear_insecurity') {
      const safetyShield = (socialSafety - 0.5) * -0.2;
      target += safetyShield;
    }

    // Bound within defined range
    return Math.max(min, Math.min(max, target));
  }

  private calculateIntensityDelta(def: EmotionAuditDefinition, targetIntensity: number): number {
    // High arousal emotions change faster
    const arousalMultiplier = def.arousal === 'high' ? 0.35 : def.arousal === 'low' ? 0.15 : 0.25;
    return Math.min(targetIntensity, Number((targetIntensity * arousalMultiplier).toFixed(3)));
  }

  private addSystemSuccessTransitions(
    transitions: ProposedEmotionTransition[],
    _state: ApePsychologicalState,
  ): void {
    transitions.push({
      emotionId: 'satisfaction',
      target: 'task',
      intensityDelta: 0.3,
      targetIntensity: 0.8,
      reason: 'Deterministic goal achievement / task success.',
      resolutionConditions: ['Milestone acknowledged'],
    });
    transitions.push({
      emotionId: 'intellectual_satisfaction',
      target: 'task',
      intensityDelta: 0.25,
      targetIntensity: 0.75,
      reason: 'Cognitive closure from verified task completion.',
      resolutionConditions: ['Consolidation completed'],
    });
  }

  private addSystemFailureTransitions(
    transitions: ProposedEmotionTransition[],
    _state: ApePsychologicalState,
  ): void {
    transitions.push({
      emotionId: 'frustration',
      target: 'task',
      intensityDelta: 0.25,
      targetIntensity: 0.7,
      reason: 'Deterministic goal obstruction / task failure.',
      resolutionConditions: ['Alternative strategy formulated'],
    });
    transitions.push({
      emotionId: 'intellectual_frustration',
      target: 'task',
      intensityDelta: 0.2,
      targetIntensity: 0.65,
      reason: 'Epistemic barrier encountered during task execution.',
      resolutionConditions: ['Problem diagnosed'],
    });
  }

  private addDiscoveryTransitions(
    transitions: ProposedEmotionTransition[],
    _state: ApePsychologicalState,
  ): void {
    transitions.push({
      emotionId: 'wonder',
      target: 'environment',
      intensityDelta: 0.3,
      targetIntensity: 0.85,
      reason: 'Unexpected discovery of significant information or emergent behavior.',
      resolutionConditions: ['Integrated into mental model'],
    });
    transitions.push({
      emotionId: 'curiosity',
      target: 'environment',
      intensityDelta: 0.25,
      targetIntensity: 0.8,
      reason: 'Novel information gap opened by unexpected discovery.',
      resolutionConditions: ['Exploration completed'],
    });
  }
}
