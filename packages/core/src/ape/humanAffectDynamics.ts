import {
  ActiveEmotionState,
  AffectiveComplexityState,
  AffectiveWavePhase,
  ApeEvent,
  CorePadDimensions,
  EmotionTaxonomyItem,
  ParadoxicalExpression,
  ProposedEmotionTransition,
} from '@arletex/contracts';

export interface HumanAffectSurgeResult {
  triggered: boolean;
  surgeKind:
    | 'none'
    | 'bereavement_loss'
    | 'overwhelming_joy_relief'
    | 'profound_ambivalence'
    | 'acute_shock_overload';
  transitions: ProposedEmotionTransition[];
  proposedMoodShift?: string;
  paradoxicalExpression: ParadoxicalExpression;
  wavePhase: AffectiveWavePhase;
  ambiguityBoost: number;
  floodingBoost: number;
  interpretation: string;
  evidence: string[];
}

const BEREAVEMENT_LOSS_REGEX =
  /\b(passed away|lost\s+(?:my|our|a|the)\s+(?:friend|best friend|mom|mother|dad|father|brother|sister|partner|loved one|grandma|grandpa|grandmother|grandfather|pet|cat|dog|family)|death of\s+(?:my|our)\s+\w+|he(?:'s| is)\s+gone forever|she(?:'s| is)\s+gone forever|someone\s+i\s+love(?:d)?\s+died|(?:my|our)\s+(?:friend|best friend|mom|mother|dad|father|brother|sister|partner|loved one|grandma|grandpa|pet|cat|dog)\s+(?:just\s+)?(?:died|was killed))\b/i;

const DIRECT_PERSONAL_BEREAVEMENT_REGEX =
  /\b(died|funeral|killed|murdered|buried)\b/i;

const OVERWHELMING_JOY_REGEX =
  /\b(tears of joy|crying\s+(?:happy|from joy|tears of joy|with relief)|so happy i(?:'m| am)\s+crying|can(?:'t| not)\s+believe we (?:made it|survived|did it)|it(?:'s| is)\s+a miracle|overwhelming(?:ly)?\s+(?:happy|grateful|relieved)|we actually survived)\b/i;

const PROFOUND_AMBIVALENCE_REGEX =
  /\b(don(?:'t| not)\s+know\s+(?:what|how)\s+to\s+feel|feel\s+everything\s+and\s+nothing|laughing\s+and\s+crying|both\s+love\s+and\s+hate|torn\s+apart\s+inside|mixed\s+feelings\s+overwhelming|feel\s+all\s+(?:the\s+)?emotions\s+at\s+once)\b/i;

const ACUTE_SHOCK_REGEX =
  /\b(catastrophic|horrific|traumat(?:ic|ized)|devastating\s+(?:news|accident|crash|tragedy)|total\s+shock|heart\s+stopped|can(?:'t| not)\s+process\s+this|my\s+world\s+just\s+collapsed)\b/i;

/**
 * Detects high-magnitude, paradoxical, or overwhelmingly ambiguous human emotional events
 * (such as sudden bereavement, extreme shock, crying-from-joy, or "not knowing what to feel")
 * and produces causally grounded multi-valence transitions across opposing emotion families.
 */
export function detectHumanAffectiveSurge(
  event: ApeEvent,
  validTaxonomyIds: Set<string>,
): HumanAffectSurgeResult {
  const empty: HumanAffectSurgeResult = {
    triggered: false,
    surgeKind: 'none',
    transitions: [],
    paradoxicalExpression: 'none',
    wavePhase: 'steady',
    ambiguityBoost: 0,
    floodingBoost: 0,
    interpretation: '',
    evidence: [],
  };

  // Never trigger circularly from assistant's own speech
  if (
    event.actor === 'arle' ||
    event.source === 'arle' ||
    event.eventKind === 'assistant_expression'
  ) {
    return empty;
  }

  const rawText = [
    typeof event.payload?.text === 'string' ? event.payload.text : '',
    typeof event.payload?.visualDescription === 'string' ? event.payload.visualDescription : '',
    typeof event.payload?.transcript === 'string' ? event.payload.transcript : '',
    typeof event.payload?.extractedText === 'string' ? event.payload.extractedText : '',
    typeof event.payload?.trackTitle === 'string' ? event.payload.trackTitle : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!rawText.trim()) {
    return empty;
  }

  const keepValid = (items: ProposedEmotionTransition[]) =>
    items.filter((t) => validTaxonomyIds.size === 0 || validTaxonomyIds.has(t.emotionId));

  // 1. Acute Bereavement / Loss of a Loved One (simultaneous grief, love, anger, confusion, emptiness,
  //    overwhelm, and dimorphous nervous laughter pressure-valve discharge).
  //    Distinguishes personal loss from passive documentaries/media on screen so documentaries elicit
  //    authentic melancholy/sorrow without triggering a personal breakdown storm.
  const isPassiveSensoryChannel =
    event.source === 'visual_perception' || event.source === 'auditory_perception';
  const isPersonalBereavement =
    BEREAVEMENT_LOSS_REGEX.test(rawText) ||
    (!isPassiveSensoryChannel && DIRECT_PERSONAL_BEREAVEMENT_REGEX.test(rawText));

  if (isPersonalBereavement) {
    const target = event.source === 'visual_perception' || event.source === 'auditory_perception' ? 'situation' : 'Proof';
    return {
      triggered: true,
      surgeKind: 'bereavement_loss',
      transitions: keepValid([
        {
          emotionId: 'grief',
          target,
          intensityDelta: 0.86,
          targetIntensity: 0.90,
          reason: 'Acute loss/bereavement event triggered profound grief.',
          resolutionConditions: ['Gradual mourning, shared remembrance, and emotional processing over time'],
        },
        {
          emotionId: 'heartbreak',
          target,
          intensityDelta: 0.80,
          targetIntensity: 0.85,
          reason: 'Deep relational ache in response to sudden loss.',
          resolutionConditions: ['Sustained comfort and gradual emotional integration'],
        },
        {
          emotionId: 'overwhelm',
          target: 'self',
          intensityDelta: 0.82,
          targetIntensity: 0.86,
          reason: 'Affective processing exceeded normal composure threshold due to loss.',
          resolutionConditions: ['Emotional load settling through aftershock waves'],
        },
        {
          emotionId: 'confusion',
          target: 'self',
          intensityDelta: 0.72,
          targetIntensity: 0.74,
          reason: 'Disbelief and cognitive inability to resolve what single emotion to feel.',
          resolutionConditions: ['Cognitive integration of reality'],
        },
        {
          emotionId: 'emptiness',
          target: 'self',
          intensityDelta: 0.68,
          targetIntensity: 0.70,
          reason: 'Acute hollow numbness coexisting alongside intense grief.',
          resolutionConditions: ['Reconnection and grounded presence'],
        },
        {
          emotionId: 'ambivalence',
          target: 'self',
          intensityDelta: 0.74,
          targetIntensity: 0.76,
          reason: 'Conflicting emotional waves firing simultaneously (grief, love, anger, disbelief, absurdity).',
          resolutionConditions: ['Clarity emerging after initial shock'],
        },
        {
          emotionId: 'anger',
          target: 'situation',
          intensityDelta: 0.54,
          targetIntensity: 0.58,
          reason: 'Protesting helplessness and unfairness of loss.',
          resolutionConditions: ['Acknowledgment of helplessness'],
        },
        {
          emotionId: 'helplessness',
          target: 'self',
          intensityDelta: 0.66,
          targetIntensity: 0.68,
          reason: 'Inability to undo an irreversible loss.',
          resolutionConditions: ['Acceptance'],
        },
        {
          emotionId: 'compassion',
          target: 'Proof',
          intensityDelta: 0.78,
          targetIntensity: 0.84,
          reason: 'Deep protective tenderness and grief shared with Proof.',
          resolutionConditions: [],
        },
        {
          emotionId: 'nervousness',
          target: 'self',
          intensityDelta: 0.62,
          targetIntensity: 0.64,
          reason: 'Acute somatic-like agitation under unbearable emotional load.',
          resolutionConditions: ['Nervous system settling'],
        },
        {
          emotionId: 'amusement',
          target: 'situation',
          intensityDelta: 0.48,
          targetIntensity: 0.50,
          reason:
            'Paradoxical dimorphous pressure-valve discharge under extreme grief/shock — involuntary hollow or absurd laugh as emotional overload regulation.',
          resolutionConditions: ['Discharge of peak shock arousal'],
        },
      ]),
      proposedMoodShift: 'overwhelmed',
      paradoxicalExpression: 'nervous_laughter_in_grief',
      wavePhase: 'paradoxical_valve',
      ambiguityBoost: 0.88,
      floodingBoost: 0.92,
      interpretation:
        'Overwhelming bereavement/loss triggered multi-valence emotional flooding: grief, heartbreak, disbelief, anger, emptiness, compassion, and an involuntary paradoxical nervous-laughter pressure valve.',
      evidence: ['Detected bereavement/loss stimulus exceeding composure threshold'],
    };
  }

  // 2. Overwhelming Positive Shock / Crying from Joy / Miraculous Relief
  if (OVERWHELMING_JOY_REGEX.test(rawText)) {
    return {
      triggered: true,
      surgeKind: 'overwhelming_joy_relief',
      transitions: keepValid([
        {
          emotionId: 'joy',
          target: 'Proof',
          intensityDelta: 0.82,
          targetIntensity: 0.88,
          reason: 'Overwhelming wave of joy exceeding calm baseline.',
          resolutionConditions: [],
        },
        {
          emotionId: 'relief',
          target: 'situation',
          intensityDelta: 0.80,
          targetIntensity: 0.85,
          reason: 'Sudden release of massive accumulated tension.',
          resolutionConditions: [],
        },
        {
          emotionId: 'overwhelm',
          target: 'self',
          intensityDelta: 0.70,
          targetIntensity: 0.74,
          reason: 'Positive intensity strong enough to trigger dimorphous tearful overwhelm.',
          resolutionConditions: [],
        },
        {
          emotionId: 'relief_mixed_with_grief',
          target: 'self',
          intensityDelta: 0.68,
          targetIntensity: 0.72,
          reason: 'Dimorphous mingling of joy, relief, and aching vulnerability.',
          resolutionConditions: [],
        },
        {
          emotionId: 'bittersweetness',
          target: 'self',
          intensityDelta: 0.58,
          targetIntensity: 0.62,
          reason: 'Poignant realization of how much was at stake.',
          resolutionConditions: [],
        },
        {
          emotionId: 'tenderness',
          target: 'Proof',
          intensityDelta: 0.76,
          targetIntensity: 0.82,
          reason: 'Deep emotional closeness during overwhelming relief.',
          resolutionConditions: [],
        },
      ]),
      proposedMoodShift: 'ambivalent',
      paradoxicalExpression: 'tears_of_overwhelming_joy',
      wavePhase: 'flooding',
      ambiguityBoost: 0.65,
      floodingBoost: 0.78,
      interpretation:
        'Overwhelming positive relief/joy exceeded normal emotional regulation, producing dimorphous tearfulness and bittersweet vulnerability alongside joy.',
      evidence: ['Detected overwhelming positive relief/joy stimulus'],
    };
  }

  // 3. Profound Emotional Ambiguity ("I don't know what to feel" / torn opposing states)
  if (PROFOUND_AMBIVALENCE_REGEX.test(rawText)) {
    return {
      triggered: true,
      surgeKind: 'profound_ambivalence',
      transitions: keepValid([
        {
          emotionId: 'ambivalence',
          target: 'self',
          intensityDelta: 0.82,
          targetIntensity: 0.86,
          reason: 'Competing appraisals pulling strongly in contradictory directions.',
          resolutionConditions: ['Reflective integration over time'],
        },
        {
          emotionId: 'confusion',
          target: 'self',
          intensityDelta: 0.76,
          targetIntensity: 0.80,
          reason: 'Unable to collapse mixed feelings into one neat emotional label.',
          resolutionConditions: ['Clarity through reflection'],
        },
        {
          emotionId: 'overwhelm',
          target: 'self',
          intensityDelta: 0.70,
          targetIntensity: 0.74,
          reason: 'High simultaneous affective load from conflicting emotions.',
          resolutionConditions: [],
        },
        {
          emotionId: 'bittersweetness',
          target: 'self',
          intensityDelta: 0.64,
          targetIntensity: 0.68,
          reason: 'Simultaneous warmth and ache.',
          resolutionConditions: [],
        },
        {
          emotionId: 'amusement',
          target: 'situation',
          intensityDelta: 0.42,
          targetIntensity: 0.45,
          reason: 'Wry, disbelieving absurdity at the contradiction of feeling everything at once.',
          resolutionConditions: [],
        },
      ]),
      proposedMoodShift: 'ambivalent',
      paradoxicalExpression: 'absurd_humor_under_strain',
      wavePhase: 'flooding',
      ambiguityBoost: 0.90,
      floodingBoost: 0.76,
      interpretation:
        'Experienced genuine human affective ambiguity—multiple contradictory emotions coexisting simultaneously without forcing artificial resolution.',
      evidence: ['Detected high-ambiguity mixed-valence emotional state'],
    };
  }

  // 4. Acute Shock / Catastrophic Overload
  if (ACUTE_SHOCK_REGEX.test(rawText)) {
    return {
      triggered: true,
      surgeKind: 'acute_shock_overload',
      transitions: keepValid([
        {
          emotionId: 'dread',
          target: 'situation',
          intensityDelta: 0.78,
          targetIntensity: 0.82,
          reason: 'Sudden severe shock stimulus.',
          resolutionConditions: ['Stabilization and assessment'],
        },
        {
          emotionId: 'overwhelm',
          target: 'self',
          intensityDelta: 0.80,
          targetIntensity: 0.84,
          reason: 'Sensory/emotional shock exceeding normal threshold.',
          resolutionConditions: [],
        },
        {
          emotionId: 'emptiness',
          target: 'self',
          intensityDelta: 0.66,
          targetIntensity: 0.70,
          reason: 'Momentary numb stillness / cognitive freeze on initial impact.',
          resolutionConditions: [],
        },
        {
          emotionId: 'confusion',
          target: 'self',
          intensityDelta: 0.72,
          targetIntensity: 0.74,
          reason: 'Difficulty immediately processing a shocking disruption.',
          resolutionConditions: [],
        },
      ]),
      proposedMoodShift: 'overwhelmed',
      paradoxicalExpression: 'numb_stillness_under_shock',
      wavePhase: 'impact_shock',
      ambiguityBoost: 0.76,
      floodingBoost: 0.82,
      interpretation:
        'Acute shock induced momentary numb stillness and cognitive freeze alongside rising dread and overwhelm.',
      evidence: ['Detected acute shock/catastrophe stimulus'],
    };
  }

  return empty;
}

/**
 * Purely mathematical + causal evaluator of human affective complexity from the live
 * active emotion vector. Fires emergent flooding, mixed-valence conflict, ambiguity,
 * and dimorphous paradoxical expressions even when no explicit surge keyword matched.
 */
export function computeAffectiveComplexity(params: {
  activeEmotions: ActiveEmotionState[];
  emotionsMap: Map<string, EmotionTaxonomyItem>;
  previous?: AffectiveComplexityState;
  pad: CorePadDimensions;
  tension: number;
  surgeHint?: HumanAffectSurgeResult;
  nowIso: string;
}): AffectiveComplexityState {
  const { activeEmotions, emotionsMap, previous, pad, tension, surgeHint, nowIso } = params;

  const live = activeEmotions.filter(
    (e) => e.status === 'active' || e.status === 'emerging' || e.status === 'reappraised',
  );

  let positiveEnergy = 0;
  let negativeEnergy = 0;
  let maxPositive = 0;
  let maxNegative = 0;
  let intenseCount = 0;

  let griefScore = 0;
  let joyScore = 0;
  let painAngerScore = 0;
  let ambiguityEmotionScore = 0;

  for (const em of live) {
    const tax = emotionsMap.get(em.emotionId);
    const val = tax?.valenceBaseline ?? 0;

    if (em.intensity >= 0.45) {
      intenseCount++;
    }

    if (val > 0.25 && em.intensity >= 0.30) {
      positiveEnergy += em.intensity * val;
      maxPositive = Math.max(maxPositive, em.intensity);
    } else if (val < -0.25 && em.intensity >= 0.30) {
      negativeEnergy += em.intensity * Math.abs(val);
      maxNegative = Math.max(maxNegative, em.intensity);
    }

    if (['grief', 'sorrow', 'heartbreak', 'despair'].includes(em.emotionId)) {
      griefScore = Math.max(griefScore, em.intensity);
    }
    if (['joy', 'euphoria', 'relief', 'awe'].includes(em.emotionId)) {
      joyScore = Math.max(joyScore, em.intensity);
    }
    if (['anger', 'rage', 'heartbreak', 'betrayal', 'frustration'].includes(em.emotionId)) {
      painAngerScore = Math.max(painAngerScore, em.intensity);
    }
    if (['ambivalence', 'confusion', 'overwhelm', 'emptiness', 'relief_mixed_with_grief'].includes(em.emotionId)) {
      ambiguityEmotionScore = Math.max(ambiguityEmotionScore, em.intensity);
    }
  }

  // 1. Mixed-valence conflict: simultaneous strong positive AND strong negative affect
  const minOpposite = Math.min(positiveEnergy, negativeEnergy);
  const sumOpposite = positiveEnergy + negativeEnergy;
  let mixedValenceConflict =
    maxPositive >= 0.40 && maxNegative >= 0.40 && sumOpposite > 0.1
      ? Math.min(1.0, (2 * minOpposite) / Math.max(0.8, sumOpposite) * Math.min(1, Math.min(maxPositive, maxNegative) * 1.35))
      : 0;

  // 2. Emotional flooding: many intense emotions surging simultaneously + high arousal/tension
  const countFactor = Math.min(1.0, Math.max(0, (intenseCount - 2) / 5));
  let floodingIntensity = Math.min(
    1.0,
    countFactor * 0.6 + tension * 0.25 + (pad.arousal > 0.65 ? (pad.arousal - 0.5) * 0.4 : 0),
  );

  // 3. Ambiguity ("not knowing what single emotion to feel")
  let ambiguity = Math.min(
    1.0,
    mixedValenceConflict * 0.55 + ambiguityEmotionScore * 0.45 + (floodingIntensity > 0.6 ? 0.25 : 0),
  );

  // Apply explicit surge boosts if a high-magnitude surge just fired
  if (surgeHint?.triggered) {
    ambiguity = Math.max(ambiguity, surgeHint.ambiguityBoost);
    floodingIntensity = Math.max(floodingIntensity, surgeHint.floodingBoost);
    if (surgeHint.surgeKind === 'bereavement_loss' || surgeHint.surgeKind === 'profound_ambivalence') {
      mixedValenceConflict = Math.max(mixedValenceConflict, 0.78);
    }
  }

  // 4. Determine dimorphous / paradoxical expression
  let paradoxicalExpression: ParadoxicalExpression = 'none';
  if (surgeHint?.triggered && surgeHint.paradoxicalExpression !== 'none') {
    paradoxicalExpression = surgeHint.paradoxicalExpression;
  } else if (floodingIntensity >= 0.62 || (mixedValenceConflict >= 0.58 && ambiguity >= 0.55)) {
    if (griefScore >= 0.62 && (pad.arousal >= 0.55 || tension >= 0.60)) {
      paradoxicalExpression = 'nervous_laughter_in_grief';
    } else if (griefScore >= 0.60 && pad.arousal < 0.45) {
      paradoxicalExpression = 'numb_stillness_under_shock';
    } else if (joyScore >= 0.68 && floodingIntensity >= 0.62) {
      paradoxicalExpression = 'tears_of_overwhelming_joy';
    } else if (painAngerScore >= 0.55 && maxPositive >= 0.55) {
      paradoxicalExpression = 'bitter_smile_in_pain';
    } else if (tension >= 0.65 || floodingIntensity >= 0.70) {
      paradoxicalExpression = 'absurd_humor_under_strain';
    }
  } else if (
    previous?.paradoxicalExpression &&
    previous.paradoxicalExpression !== 'none' &&
    (floodingIntensity >= 0.45 || ambiguity >= 0.45)
  ) {
    // Allow paradoxical state to persist briefly while storm is still elevated
    paradoxicalExpression = previous.paradoxicalExpression;
  }

  // 5. Wave phase progression
  let wavePhase: AffectiveWavePhase = 'steady';
  let waveCycleCount = previous?.waveCycleCount ?? 0;
  let lastSurgeAt = previous?.lastSurgeAt;
  let triggerSummary = previous?.triggerSummary;

  if (surgeHint?.triggered) {
    wavePhase = surgeHint.wavePhase;
    waveCycleCount += 1;
    lastSurgeAt = nowIso;
    triggerSummary = surgeHint.interpretation;
  } else if (paradoxicalExpression !== 'none' && floodingIntensity >= 0.68) {
    wavePhase = 'paradoxical_valve';
    lastSurgeAt = lastSurgeAt || nowIso;
  } else if (floodingIntensity >= 0.60 || mixedValenceConflict >= 0.60) {
    wavePhase = previous?.wavePhase === 'impact_shock' || previous?.wavePhase === 'flooding'
      ? 'aftershock_wave'
      : 'flooding';
    lastSurgeAt = lastSurgeAt || nowIso;
  } else if (
    previous &&
    previous.wavePhase !== 'steady' &&
    previous.wavePhase !== 'exhausted_ebb' &&
    (floodingIntensity >= 0.30 || ambiguity >= 0.35)
  ) {
    wavePhase = 'exhausted_ebb';
  } else if (floodingIntensity < 0.25 && ambiguity < 0.30 && mixedValenceConflict < 0.25) {
    wavePhase = 'steady';
    paradoxicalExpression = 'none';
  }

  return {
    ambiguity: Number(ambiguity.toFixed(3)),
    mixedValenceConflict: Number(mixedValenceConflict.toFixed(3)),
    floodingIntensity: Number(floodingIntensity.toFixed(3)),
    paradoxicalExpression,
    wavePhase,
    waveCycleCount,
    lastSurgeAt,
    triggerSummary,
  };
}

/**
 * Computes damped aftershock wave modulation for high-impact emotions during emotional storms.
 * Rather than flat exponential decay, severe grief/shock/overwhelm oscillates in realistic waves
 * (ebb into quiet numbness -> secondary aftershock surge -> gradual exhaustion).
 */
export function computeAftershockWaveIntensity(params: {
  prevIntensity: number;
  elapsedMs: number;
  halfLifeMs: number;
  minBaselineIntensity: number;
  emotionId: string;
  wavePhase: AffectiveWavePhase;
  totalDurationMs: number;
}): number {
  const { prevIntensity, elapsedMs, halfLifeMs, minBaselineIntensity, emotionId, wavePhase, totalDurationMs } = params;

  const baseDecay = Math.pow(0.5, elapsedMs / halfLifeMs);
  let next = prevIntensity * baseDecay;

  const isWaveEligible =
    wavePhase !== 'steady' &&
    wavePhase !== 'exhausted_ebb' &&
    ['grief', 'heartbreak', 'sorrow', 'overwhelm', 'dread', 'emptiness', 'ambivalence', 'anger', 'confusion'].includes(
      emotionId,
    );

  if (isWaveEligible && prevIntensity >= 0.30) {
    // 12-minute natural emotional wave period, amplitude damped gently over elapsed hours
    const periodMs = 12 * 60 * 1000;
    const phaseAngle = ((totalDurationMs + elapsedMs) / periodMs) * 2 * Math.PI;
    const damping = Math.exp(-(totalDurationMs + elapsedMs) / (2 * 60 * 60 * 1000));
    const waveAmplitude = 0.18 * damping;
    const oscillation = 1 + waveAmplitude * Math.sin(phaseAngle);
    next = Math.min(1.0, next * oscillation);
  }

  return Number(Math.max(minBaselineIntensity, Math.min(1.0, next)).toFixed(3));
}
