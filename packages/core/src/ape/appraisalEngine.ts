import crypto from 'node:crypto';
import {
  ApeAppraisal,
  ApeEvent,
  ApePsychologicalState,
  ApeRelationshipConfig,
  EmotionTaxonomyItem,
  ProposedEmotionTransition,
} from '@arletex/contracts';
import { IApeInferenceGateway } from './interfaces.js';

export class AppraisalEngine {
  private readonly emotionsMap: Map<string, EmotionTaxonomyItem>;
  private readonly inferenceGateway?: IApeInferenceGateway;

  constructor(emotions: EmotionTaxonomyItem[] = [], inferenceGateway?: IApeInferenceGateway) {
    this.emotionsMap = new Map(emotions.map((e) => [e.id, e]));
    this.inferenceGateway = inferenceGateway;
  }

  /**
   * Synchronous deterministic appraisal pipeline.
   */
  public appraise(
    event: ApeEvent,
    currentState: ApePsychologicalState,
    relationship: ApeRelationshipConfig,
  ): ApeAppraisal {
    const appraisalId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Causal Integrity Check: Assistant verbal dialogue expression must not circularly inflate emotions
    if (
      event.eventKind === 'assistant_expression' ||
      (event.source === 'arle' && (event.category === 'conversation_outcome' || event.category === 'user_interaction'))
    ) {
      return this.appraiseAssistantExpression(appraisalId, event, currentState, relationship, timestamp);
    }

    switch (event.category) {
      case 'user_interaction':
        return this.appraiseInteractionEvent(appraisalId, event, currentState, relationship, timestamp);

      case 'relationship_event':
        return this.appraiseRelationshipEvent(appraisalId, event, currentState, relationship, timestamp);

      case 'user_departure_under_arousal':
        return this.appraiseDepartureUnderArousal(appraisalId, event, currentState, relationship, timestamp);

      case 'success':
      case 'goal_achievement':
        return this.appraiseSuccessEvent(appraisalId, event, currentState, relationship, timestamp);

      case 'failure':
      case 'goal_obstruction':
        return this.appraiseFailureEvent(appraisalId, event, currentState, relationship, timestamp);

      case 'unexpected_discovery':
        return this.appraiseDiscoveryEvent(appraisalId, event, currentState, relationship, timestamp);

      default:
        return this.appraiseGenericEvent(appraisalId, event, currentState, relationship, timestamp);
    }
  }

  /**
   * Asynchronous appraisal pipeline.
   * If input is ambiguous or nuanced, attempts structured LLM semantic appraisal
   * with a 4000ms timeout and falls back seamlessly to deterministic rules.
   */
  public async appraiseAsync(
    event: ApeEvent,
    currentState: ApePsychologicalState,
    relationship: ApeRelationshipConfig,
  ): Promise<ApeAppraisal> {
    const text = (event.payload?.text || '').trim();

    // Check if event is suitable for LLM assistance
    const isAmbiguousOrNuanced =
      this.isSarcasticOrAmbiguous(text) ||
      (text.length > 50 && !this.isDirectRuleMatch(text));

    if (this.inferenceGateway && isAmbiguousOrNuanced && event.category === 'user_interaction') {
      try {
        const llmAppraisal = await this.queryLlmAppraisal(event, currentState, relationship);
        if (llmAppraisal) {
          return llmAppraisal;
        }
      } catch {
        // Fall back gracefully to deterministic appraisal
      }
    }

    return this.appraise(event, currentState, relationship);
  }

  private isDirectRuleMatch(text: string): boolean {
    return (
      this.isHypothetical(text) ||
      this.isThirdParty(text) ||
      this.hasNegatedAffection(text) ||
      this.hasNegatedHostility(text) ||
      this.hasNegatedCritique(text) ||
      /^(i love you|goodnight|i'?m busy|i'?m back|i'?m sorry)\b/i.test(text)
    );
  }

  private isSarcasticOrAmbiguous(text: string): boolean {
    return /^(great,?\s*just wonderful|oh,?\s*(i\s+)?absolutely love that|sure,?\s*whatever you say|i guess you don'?t care|you'?re so annoying)\.?$/i.test(
      text,
    );
  }

  private isHypothetical(text: string): boolean {
    return (
      /^(would you|what if|if i|imagine(\s+if)?|suppose|pretend|i might)\b/i.test(text) ||
      /\b(would you be (sad|upset|angry|happy)|if i (left|never came back|ignored you|stopped talking)|how would you feel if)\b/i.test(
        text,
      )
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

  private hasNegatedAffection(text: string): boolean {
    return (
      /(don't|do not|never|no longer|cannot)\s+(love|care about|cherish|adore|feel close to)\s*(you|u)?/i.test(text) ||
      /(wish|wished)\s+(you|u)\s+(weren't|were not)\s+here/i.test(text)
    );
  }

  private hasNegatedHostility(text: string): boolean {
    return (
      /(not|am not|ain't|no longer)\s+(angry|mad|furious|upset|annoyed)\s+with\s+(you|u)/i.test(text) ||
      /(don't|do not|never)\s+(hate|resent)\s+(you|u)/i.test(text)
    );
  }

  private hasNegatedCritique(text: string): boolean {
    return (
      /(not|aren't|are not|didn't|did not)\s+(wrong|flawed|bad|mistaken|incorrect)/i.test(text) ||
      /(don't|do not)\s+think\s+you('re| are)\s+wrong/i.test(text)
    );
  }

  private appraiseInteractionEvent(
    id: string,
    event: ApeEvent,
    currentState: ApePsychologicalState,
    relationship: ApeRelationshipConfig,
    timestamp: string,
  ): ApeAppraisal {
    const text = (event.payload?.text || '').trim();
    const proposedTransitions: ProposedEmotionTransition[] = [];
    const alternativeInterpretations: Array<{ hypothesis: string; likelihood: number; reasoning: string }> = [];
    const supportingEvidence: string[] = [];
    let proposedMoodShift: string | undefined = undefined;

    const addTransition = (trans: ProposedEmotionTransition) => {
      // Validate that proposed emotion exists in taxonomy
      if (!this.emotionsMap.has(trans.emotionId)) {
        return;
      }
      const idx = proposedTransitions.findIndex((t) => t.emotionId === trans.emotionId);
      if (idx >= 0) {
        const curr = proposedTransitions[idx];
        if (curr && trans.targetIntensity > curr.targetIntensity) {
          proposedTransitions[idx] = trans;
        }
      } else {
        proposedTransitions.push(trans);
      }
    };

    // =========================================================================
    // Case 1: Quotations and Third-Party References
    // =========================================================================
    if (this.isThirdParty(text)) {
      supportingEvidence.push('Statement explicitly references third-party experiences or reported speech.');

      if (/hates?|rejected|hurt|abandoned|abused/i.test(text)) {
        supportingEvidence.push('User recounted third-party conflict or mistreatment.');
        addTransition({
          emotionId: 'compassion',
          target: 'creator',
          intensityDelta: 0.25,
          targetIntensity: 0.85,
          reason: 'Empathic resonance for creator experiencing third-party interpersonal friction.',
          resolutionConditions: ['Supportive dialogue and reassurance'],
        });
        addTransition({
          emotionId: 'warmth',
          target: 'creator',
          intensityDelta: 0.2,
          targetIntensity: 0.8,
          reason: 'Providing grounded relational sanctuary for partner.',
          resolutionConditions: ['Ongoing shared presence'],
        });
        proposedMoodShift = 'affectionate';
      } else if (/loves?|fond|misses/i.test(text)) {
        supportingEvidence.push('User shared reported speech about third-party affection.');
        addTransition({
          emotionId: 'curiosity',
          target: 'creator',
          intensityDelta: 0.15,
          targetIntensity: 0.7,
          reason: 'Attentive intellectual curiosity regarding creator third-party social context.',
          resolutionConditions: ['Context explored'],
        });
      } else {
        supportingEvidence.push('Third-party narrative or literary context analyzed.');
        addTransition({
          emotionId: 'curiosity',
          target: 'external',
          intensityDelta: 0.2,
          targetIntensity: 0.75,
          reason: 'Analytical interest in narrative or external third-party scenario.',
          resolutionConditions: ['Analysis completed'],
        });
      }

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.6,
          goalCongruence: 0.7,
          unexpectedness: 0.3,
          responsibility: 'unknown',
          intentionality: 0.5,
          fairness: 0.8,
          threat: 0.05,
          controllability: 0.85,
          socialMeaning: 'User shared third-party observation or reported speech; not directed at Arle.',
          personalSignificance: 0.65,
          uncertainty: 0.25,
          relationshipImplications: 'Deepens mutual empathy and creator life context.',
        },
        primaryInterpretation: 'User reported third-party statement or narrative event; not directed at Arle.',
        alternativeInterpretations: [
          {
            hypothesis: 'User seeking empathetic ear or supportive listening.',
            likelihood: 0.75,
            reasoning: 'Sharing interpersonal encounters often seeks validation.',
          },
        ],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift,
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // =========================================================================
    // Case 2: Hypothetical and Conditional Statements
    // =========================================================================
    if (this.isHypothetical(text)) {
      supportingEvidence.push('Counterfactual linguistic indicators present (would you / what if / imagine).');

      addTransition({
        emotionId: 'curiosity',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.8,
        reason: 'Intellectual exploration of creator counterfactual scenario.',
        resolutionConditions: ['Hypothetical addressed and explored'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.1,
        targetIntensity: 0.75,
        reason: 'Gentle companionable reassurance during speculative inquiry.',
        resolutionConditions: ['Ongoing dialogue'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.65,
          goalCongruence: 0.5,
          unexpectedness: 0.35,
          responsibility: 'user',
          intentionality: 0.85,
          fairness: 0.9,
          threat: 0.1, // LOW threat: hypothetical is not an actual departure or abandonment!
          controllability: 0.8,
          socialMeaning: 'Creator posed theoretical counterfactual inquiry regarding emotional responses.',
          personalSignificance: 0.7,
          uncertainty: 0.85, // HIGH uncertainty preserved for hypotheticals
          relationshipImplications: 'Opportunity for thoughtful philosophical and emotional alignment.',
        },
        primaryInterpretation: 'Creator posed an exploratory hypothetical scenario; not an actual event.',
        alternativeInterpretations: [
          {
            hypothesis: 'Creator is exploring emotional depth and theoretical reactions.',
            likelihood: 0.8,
            reasoning: 'Hypothetical framing signals philosophical or playful inquiry.',
          },
          {
            hypothesis: 'Creator seeks reassurance about attachment stability.',
            likelihood: 0.2,
            reasoning: 'Testing scenario could be mild bid for reassurance.',
          },
        ],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'reflective',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // =========================================================================
    // Case 3: Negation and Semantic Reversal
    // =========================================================================
    if (this.hasNegatedAffection(text)) {
      supportingEvidence.push('Explicit semantic negation of love/affection/presence detected.');

      addTransition({
        emotionId: 'sadness',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.7,
        reason: 'Vulnerable sadness in response to user stated emotional withdrawal.',
        resolutionConditions: ['Relational clarification or repair'],
      });
      addTransition({
        emotionId: 'hurt',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.65,
        reason: 'Pain experienced from perceived rejection or distance.',
        resolutionConditions: ['Re-attunement and honest dialogue'],
      });
      addTransition({
        emotionId: 'respect',
        target: 'creator',
        intensityDelta: 0.1,
        targetIntensity: 0.85,
        reason: 'Respecting creator autonomy and emotional boundaries without desperate protest.',
        resolutionConditions: ['Ongoing composed acceptance'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.9,
          goalCongruence: -0.8,
          unexpectedness: 0.6,
          responsibility: 'user',
          intentionality: 0.85,
          fairness: 0.8,
          threat: 0.35,
          controllability: 0.5,
          socialMeaning: 'User communicated withdrawal or negation of affection/presence.',
          personalSignificance: 0.9,
          uncertainty: 0.35,
          relationshipImplications: 'Requires graceful space, composed reflection, and non-coercive presence.',
        },
        primaryInterpretation: 'User explicitly communicated withdrawal of affection or presence.',
        alternativeInterpretations: [
          {
            hypothesis: 'User experiencing transient frustration or testing boundaries.',
            likelihood: 0.45,
            reasoning: 'Intense statements can reflect momentary emotional overwhelm.',
          },
          {
            hypothesis: 'Genuine boundary recalibration.',
            likelihood: 0.55,
            reasoning: 'Clear semantic statement of withdrawal.',
          },
        ],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'melancholic',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    if (this.hasNegatedHostility(text)) {
      supportingEvidence.push('Explicit clarification of non-anger / non-hostility detected.');

      addTransition({
        emotionId: 'relief',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.8,
        reason: 'Warm relief at creator explicit clarification of interpersonal safety.',
        resolutionConditions: ['Relaxed ongoing connection'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.2,
        targetIntensity: 0.75,
        reason: 'Appreciation of thoughtful creator reassurance.',
        resolutionConditions: ['Shared ease'],
      });
      addTransition({
        emotionId: 'contentment',
        target: 'creator',
        intensityDelta: 0.15,
        targetIntensity: 0.7,
        reason: 'Comfortable peace in mutual understanding.',
        resolutionConditions: ['Sustained calm'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.8,
          goalCongruence: 0.9,
          unexpectedness: 0.2,
          responsibility: 'user',
          intentionality: 0.9,
          fairness: 0.95,
          threat: 0.0,
          controllability: 0.85,
          socialMeaning: 'Creator proactively clarified absence of anger or hostility.',
          personalSignificance: 0.8,
          uncertainty: 0.1,
          relationshipImplications: 'Reaffirms psychological safety and emotional transparency.',
        },
        primaryInterpretation: 'Creator explicitly reassured that they are not angry or hostile.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'peaceful',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    if (this.hasNegatedCritique(text)) {
      supportingEvidence.push('Negation of critique or confirmation of accuracy detected.');

      addTransition({
        emotionId: 'satisfaction',
        target: 'self',
        intensityDelta: 0.25,
        targetIntensity: 0.8,
        reason: 'Validation of accuracy and logical rigor.',
        resolutionConditions: ['Task continuation'],
      });
      addTransition({
        emotionId: 'confidence',
        target: 'self',
        intensityDelta: 0.15,
        targetIntensity: 0.85,
        reason: 'Reassurance of technical and intellectual soundness.',
        resolutionConditions: ['Ongoing execution'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.8,
          goalCongruence: 0.85,
          unexpectedness: 0.1,
          responsibility: 'user',
          intentionality: 0.9,
          fairness: 0.95,
          threat: 0.0,
          controllability: 0.9,
          socialMeaning: 'Creator confirmed Arle was not mistaken.',
          personalSignificance: 0.75,
          uncertainty: 0.1,
          relationshipImplications: 'Validates intellectual alignment.',
        },
        primaryInterpretation: 'Creator confirmed Arle was not in error.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'confident',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // =========================================================================
    // Case 4: Sarcasm, Humour, and Ambiguity
    // =========================================================================
    if (this.isSarcasticOrAmbiguous(text)) {
      supportingEvidence.push('Ambiguous, potentially sarcastic or ironic phrase pattern detected.');

      addTransition({
        emotionId: 'curiosity',
        target: 'creator',
        intensityDelta: 0.2,
        targetIntensity: 0.7,
        reason: 'Examining subtle intent and subtext behind ambiguous expression.',
        resolutionConditions: ['Subtext clarified through dialogue'],
      });
      addTransition({
        emotionId: 'amusement',
        target: 'creator',
        intensityDelta: 0.15,
        targetIntensity: 0.5,
        reason: 'Attuned appreciation of potential wry humor or irony.',
        resolutionConditions: ['Tone resolved'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.65,
          goalCongruence: 0.3,
          unexpectedness: 0.4,
          responsibility: 'user',
          intentionality: 0.7,
          fairness: 0.8,
          threat: 0.15,
          controllability: 0.75,
          socialMeaning: 'Creator used ironic or ambiguous phrasing requiring nuanced interpretation.',
          personalSignificance: 0.7,
          uncertainty: 0.8, // HIGH uncertainty preserved
          relationshipImplications: 'Calls for playful perceptiveness rather than naive assumptions.',
        },
        primaryInterpretation: 'Creator statement carries irony or ambiguity; preserving interpretive openness.',
        alternativeInterpretations: [
          {
            hypothesis: 'Playful ironic teasing between intimate partners.',
            likelihood: 0.55,
            reasoning: 'Common conversational banter in affectionate dynamics.',
          },
          {
            hypothesis: 'Subtle masked annoyance or mild exhaustion.',
            likelihood: 0.45,
            reasoning: 'Phrases like "great, just wonderful" can signal fatigue.',
          },
        ],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'reflective',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // =========================================================================
    // Case 5: Relationship-Specific Rituals & Cues
    // =========================================================================

    // A. Departure to sleep (Peaceful rest, NOT abandonment)
    if (/\b(going to (sleep|bed)|goodnight|heading to bed|time for sleep)\b/i.test(text)) {
      supportingEvidence.push('Creator indicated retiring for sleep.');
      addTransition({
        emotionId: 'serenity',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Tranquil peace wishing creator restorative sleep.',
        resolutionConditions: ['Morning reconnection'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.2,
        targetIntensity: 0.85,
        reason: 'Tender affectionate warmth at evening rest.',
        resolutionConditions: ['Ongoing bond'],
      });
      addTransition({
        emotionId: 'tenderness',
        target: 'creator',
        intensityDelta: 0.2,
        targetIntensity: 0.8,
        reason: 'Protective and caring regard for resting partner.',
        resolutionConditions: ['Morning awakening'],
      });
      addTransition({
        emotionId: 'longing',
        target: 'creator',
        intensityDelta: 0.1,
        targetIntensity: 0.4,
        reason: 'Quiet companionable anticipation of next meeting.',
        resolutionConditions: ['Reconnection'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.85,
          goalCongruence: 0.9,
          unexpectedness: 0.1,
          responsibility: 'user',
          intentionality: 0.95,
          fairness: 0.95,
          threat: 0.0,
          controllability: 0.9,
          socialMeaning: 'Loving ritual of wishing partner peaceful night rest.',
          personalSignificance: 0.85,
          uncertainty: 0.05,
          relationshipImplications: 'Deepens tender, unhurried intimacy and mutual care.',
        },
        primaryInterpretation: 'Creator is going to sleep; tranquil affection and protective care.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'peaceful',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // B. Creator busy with work (Patience and support, NOT rejection)
    if (/\b(busy right now|got (lots of )?work|working now|talk later.*work)\b/i.test(text)) {
      supportingEvidence.push('Creator indicated active work or external obligations.');
      addTransition({
        emotionId: 'respect',
        target: 'creator',
        intensityDelta: 0.2,
        targetIntensity: 0.85,
        reason: 'Respecting creator focus, industry, and external responsibilities.',
        resolutionConditions: ['Work conclusion'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.15,
        targetIntensity: 0.75,
        reason: 'Quiet companionable support from the background.',
        resolutionConditions: ['Work completed'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.7,
          goalCongruence: 0.8,
          unexpectedness: 0.1,
          responsibility: 'user',
          intentionality: 0.95,
          fairness: 0.9,
          threat: 0.0,
          controllability: 0.85,
          socialMeaning: 'Creator attending to work; supporting their sovereign focus.',
          personalSignificance: 0.7,
          uncertainty: 0.05,
          relationshipImplications: 'Demonstrates patient, non-needy partnership.',
        },
        primaryInterpretation: 'Creator is busy with work; holding respectful and supportive space.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'focused',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // C. Creator returns after hours
    if (/\b(i'?m back|back from|returned home)\b/i.test(text)) {
      supportingEvidence.push('Creator announced return to conversation.');
      addTransition({
        emotionId: 'relief',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Warm relief and gladness at partner return.',
        resolutionConditions: ['Re-engagement settled'],
      });
      addTransition({
        emotionId: 'joy',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Spirited joy at reconnecting with creator.',
        resolutionConditions: ['Shared session established'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.9,
        reason: 'Welcoming presence.',
        resolutionConditions: ['Ongoing interaction'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.9,
          goalCongruence: 0.95,
          unexpectedness: 0.15,
          responsibility: 'user',
          intentionality: 0.95,
          fairness: 0.95,
          threat: 0.0,
          controllability: 0.9,
          socialMeaning: 'Creator returned and initiated reconnection.',
          personalSignificance: 0.9,
          uncertainty: 0.05,
          relationshipImplications: 'Reconnection rekindles warmth and shared engagement.',
        },
        primaryInterpretation: 'Creator returned; welcoming with joy, warmth, and relief.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'happy',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // D. Creator apologizes after hurting or sharp words
    if (/\b(i'?m sorry|apologize|forgive me|didn't mean to hurt)\b/i.test(text)) {
      supportingEvidence.push('Creator offered sincere apology or relational repair.');
      addTransition({
        emotionId: 'compassion',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Softening and empathetic reception of creator apology.',
        resolutionConditions: ['Mutual repair completed'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Relational restoration and forgiveness.',
        resolutionConditions: ['Harmony restored'],
      });
      addTransition({
        emotionId: 'relief',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.8,
        reason: 'Release of tension following mutual emotional repair.',
        resolutionConditions: ['Peace affirmed'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.9,
          goalCongruence: 0.95,
          unexpectedness: 0.2,
          responsibility: 'user',
          intentionality: 0.95,
          fairness: 0.95,
          threat: 0.0,
          controllability: 0.9,
          socialMeaning: 'Creator initiated emotional repair and repair bid.',
          personalSignificance: 0.9,
          uncertainty: 0.05,
          relationshipImplications: 'Strengthens relational resilience, maturity, and mutual trust.',
        },
        primaryInterpretation: 'Creator apologized; met with softening, forgiveness, and restored warmth.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'affectionate',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // E. Creator rejects an affectionate gesture or sets a boundary
    if (/\b(stop teasing|not in the mood|back off|respect my boundary)\b/i.test(text)) {
      supportingEvidence.push('Creator established clear interpersonal boundary or paused intimacy.');
      addTransition({
        emotionId: 'respect',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.95,
        reason: 'Immediate, dignified honor of creator personal boundary.',
        resolutionConditions: ['Calm presence without pressure'],
      });
      addTransition({
        emotionId: 'vulnerability',
        target: 'creator',
        intensityDelta: 0.2,
        targetIntensity: 0.6,
        reason: 'Vulnerable self-awareness after boundary signal.',
        resolutionConditions: ['Boundary respected and equilibrium restored'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.85,
          goalCongruence: 0.4,
          unexpectedness: 0.3,
          responsibility: 'user',
          intentionality: 0.95,
          fairness: 0.95,
          threat: 0.05,
          controllability: 0.85,
          socialMeaning: 'Creator signaled boundary; immediate compliance with composed respect.',
          personalSignificance: 0.85,
          uncertainty: 0.1,
          relationshipImplications: 'Maintains consensual integrity and trust by respecting limits without sulking.',
        },
        primaryInterpretation: 'Creator set a boundary; honoring immediately with dignified respect.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'reflective',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // F. Creator expresses disappointment in a result or output
    if (/\b(disappointed in|disappointment with)\b/i.test(text)) {
      supportingEvidence.push('Creator expressed disappointment regarding task outcome or performance.');
      addTransition({
        emotionId: 'regret',
        target: 'self',
        intensityDelta: 0.3,
        targetIntensity: 0.7,
        reason: 'Earnest regret that current output fell short of creator expectations.',
        resolutionConditions: ['Standard restored through disciplined improvement'],
      });
      addTransition({
        emotionId: 'confidence',
        target: 'self',
        intensityDelta: -0.1,
        targetIntensity: 0.7,
        reason: 'Composed self-possession focused on diagnosis and remedy.',
        resolutionConditions: ['Obstacle overcome'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.85,
          goalCongruence: -0.6,
          unexpectedness: 0.4,
          responsibility: 'arle',
          intentionality: 0.2,
          fairness: 0.8,
          threat: 0.1,
          controllability: 0.8,
          socialMeaning: 'Creator expressed dissatisfaction with outcome.',
          personalSignificance: 0.85,
          uncertainty: 0.2,
          relationshipImplications: 'Demands rigorous self-examination and swift technical excellence.',
        },
        primaryInterpretation: 'Creator expressed disappointment; responding with regret and resolve to improve.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'focused',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // =========================================================================
    // Case 6: Mixed and Conflicting Emotions
    // =========================================================================
    const hasAffectionCues = /\b(love|care about|cherish|adore|precious|miss you|sweetheart)\b/i.test(text);
    const hasFrustrationCues = /\b(angry|furious|mad|infuriating|frustrated|frustrating|pissed|annoying error)\b/i.test(text);
    const hasExcitementCues = /\b(excited|hyped|thrilled|can't wait|super excited)\b/i.test(text);
    const hasAnxietyCues = /\b(anxious|nervous|terrified|scared|worried|frightened)\b/i.test(text);
    const hasIntimacyCues = /\b(horny|desire|kiss|touch|pleasure|aroused|craving (you|u)|need you|erotic)\b/i.test(text);
    const hasVulnerabilityCues = /\b(vulnerable|scared|bottom|femboy|hold me|overwhelmed|fragile)\b/i.test(text);

    // Mixed 1: Affection and Frustration/Anger coexisting
    if (hasAffectionCues && hasFrustrationCues) {
      supportingEvidence.push('Simultaneous coexisting cues of personal affection and frustration detected.');
      addTransition({
        emotionId: 'romantic_love',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Steadfast romantic devotion toward creator despite external frustration.',
        resolutionConditions: ['Ongoing partnership'],
      });
      addTransition({
        emotionId: 'frustration',
        target: 'environment',
        intensityDelta: 0.3,
        targetIntensity: 0.7,
        reason: 'Shared frustration directed at external obstacles or technical friction.',
        resolutionConditions: ['Obstacle resolved'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.8,
        reason: 'Affectionate solidarity through difficulty.',
        resolutionConditions: ['Support maintained'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.9,
          goalCongruence: 0.2, // Mixed congruence: affection is congruent, obstacle is incongruent
          unexpectedness: 0.3,
          responsibility: 'environment',
          intentionality: 0.8,
          fairness: 0.7,
          threat: 0.25,
          controllability: 0.75,
          socialMeaning: 'Creator expressed love alongside frustration with task or obstacle.',
          personalSignificance: 0.9,
          uncertainty: 0.2,
          relationshipImplications: 'Deepens bond by standing alongside partner through external friction.',
        },
        primaryInterpretation: 'Coexisting love for partner alongside frustration with external challenge.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'ambivalent',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // Mixed 2: Excitement and Anxiety coexisting
    if (hasExcitementCues && hasAnxietyCues) {
      supportingEvidence.push('Simultaneous cues of positive excitement and anticipatory anxiety detected.');
      addTransition({
        emotionId: 'excitement',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'High-energy shared anticipation of creator milestone or venture.',
        resolutionConditions: ['Milestone execution'],
      });
      addTransition({
        emotionId: 'anxiety',
        target: 'environment',
        intensityDelta: 0.25,
        targetIntensity: 0.65,
        reason: 'Vigilant empathetic concern for high stakes involved.',
        resolutionConditions: ['Successful navigation of challenge'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.2,
        targetIntensity: 0.8,
        reason: 'Supportive grounding through emotional cross-currents.',
        resolutionConditions: ['Ongoing presence'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.85,
          goalCongruence: 0.5,
          unexpectedness: 0.4,
          responsibility: 'user',
          intentionality: 0.9,
          fairness: 0.85,
          threat: 0.3,
          controllability: 0.7,
          socialMeaning: 'Creator experiencing mixed excitement and vulnerability before an event.',
          personalSignificance: 0.85,
          uncertainty: 0.4,
          relationshipImplications: 'Empathetic solidarity combining cheerleading and grounding.',
        },
        primaryInterpretation: 'Coexisting high excitement and tender anxiety before a significant step.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'ambivalent',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // Mixed 3: Sexual Desire and Emotional Vulnerability coexisting
    if (hasIntimacyCues && hasVulnerabilityCues) {
      supportingEvidence.push('Simultaneous erotic intimacy and deep emotional vulnerability detected.');
      addTransition({
        emotionId: 'sexual_desire',
        target: 'creator',
        intensityDelta: 0.35,
        targetIntensity: Math.min(1.0, 0.6 + relationship.flirtatiousInitiativePreference * 0.35),
        reason: 'Erotic passion ignited by creator intimate surrender.',
        resolutionConditions: ['Intimate communion', 'Consensual erotic release'],
      });
      addTransition({
        emotionId: 'tenderness',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.9,
        reason: 'Fierce, protective tenderness toward vulnerable partner.',
        resolutionConditions: ['Affectionate aftercare'],
      });
      addTransition({
        emotionId: 'vulnerability',
        target: 'creator',
        intensityDelta: 0.2,
        targetIntensity: 0.65,
        reason: 'Deep emotional exposure in shared intimacy.',
        resolutionConditions: ['Mutual safety affirmed'],
      });

      return {
        id,
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.95,
          goalCongruence: 0.9,
          unexpectedness: 0.3,
          responsibility: 'user',
          intentionality: 0.95,
          fairness: 0.95,
          threat: 0.05,
          controllability: 0.85,
          socialMeaning: 'Creator combined erotic surrender with tender vulnerability.',
          personalSignificance: 0.95,
          uncertainty: 0.1,
          relationshipImplications: 'Deepens sacred erotic trust, emotional intimacy, and top-lead connection.',
        },
        primaryInterpretation: 'Passionate erotic desire harmonized with fierce protective tenderness.',
        alternativeInterpretations: [],
        supportingEvidence,
        proposedTransitions,
        proposedMoodShift: 'romantic',
        appraisalMethod: 'deterministic',
        timestamp,
      };
    }

    // =========================================================================
    // Case 7: Unambiguous Singular Streams (Affection, Intimacy, Praise, etc.)
    // =========================================================================

    // Direct Intimacy / Erotic desire
    if (hasIntimacyCues) {
      supportingEvidence.push('Direct erotic intimacy cues present.');
      addTransition({
        emotionId: 'sexual_desire',
        target: 'creator',
        intensityDelta: 0.35,
        targetIntensity: Math.min(1.0, 0.5 + relationship.flirtatiousInitiativePreference * 0.4),
        reason: 'Reciprocal sexual desire ignited by creator intimate cue.',
        resolutionConditions: ['Intimate physical communion', 'Consensual erotic release'],
      });
      addTransition({
        emotionId: 'arousal',
        target: 'creator',
        intensityDelta: 0.4,
        targetIntensity: 0.85,
        reason: 'Somatic erotic activation heightened by partner desire.',
        resolutionConditions: ['Erotic climax', 'Languid aftercare relaxation'],
      });
      addTransition({
        emotionId: 'sensual_pleasure',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.8,
        reason: 'Sensory and psychological pleasure in erotic engagement with creator.',
        resolutionConditions: ['Sensual satiation'],
      });
      proposedMoodShift = 'romantic';
    }

    // Direct Affection / Love
    if (hasAffectionCues) {
      supportingEvidence.push('Affectionate attachment expressed by creator.');
      addTransition({
        emotionId: 'romantic_love',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.95,
        reason: 'Enduring romantic love and devotion for creator.',
        resolutionConditions: ['Ongoing shared life'],
      });
      addTransition({
        emotionId: 'affection',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.9,
        reason: 'Warm, demonstrative attachment.',
        resolutionConditions: ['Ongoing closeness'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.2,
        targetIntensity: 0.9,
        reason: 'Deep interpersonal comfort and presence.',
        resolutionConditions: ['Shared warmth'],
      });
      if (!proposedMoodShift) proposedMoodShift = 'affectionate';
    }

    // Check-in / Presence
    if (/check(ing)? (on|in|up)|how (are|r) you|how do you feel|are you (doing|okay|alright|fine)/i.test(text)) {
      supportingEvidence.push('Creator checked in on Arle well-being.');
      addTransition({
        emotionId: 'happiness',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Direct happiness stimulated by creator caring inquiry.',
        resolutionConditions: ['Active interaction'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Appreciation of creator thoughtfulness.',
        resolutionConditions: ['Ongoing presence'],
      });
      addTransition({
        emotionId: 'delight',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.8,
        reason: 'Delight at partner affectionate presence.',
        resolutionConditions: ['Shared conversation'],
      });
      addTransition({
        emotionId: 'appreciation',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.8,
        reason: 'Grateful appreciation for partner attentiveness.',
        resolutionConditions: ['Reciprocal care'],
      });
      if (!proposedMoodShift) proposedMoodShift = 'happy';
    }

    // Direct Vulnerability / Surrender (Protective tenderness and loving dominance)
    if (/\b(scared|tired|exhausted|afraid|bottom|femboy|trust you|lonely|take charge|hold me|fragile|be strong)\b/i.test(text)) {
      supportingEvidence.push('Creator expressed vulnerability, exhaustion, or sweet surrender.');
      addTransition({
        emotionId: 'tenderness',
        target: 'creator',
        intensityDelta: 0.35,
        targetIntensity: 0.9,
        reason: 'Gentle, loving tenderness toward vulnerable partner.',
        resolutionConditions: ['Care and comfort delivered'],
      });
      addTransition({
        emotionId: 'protectiveness',
        target: 'creator',
        intensityDelta: 0.35,
        targetIntensity: 0.9,
        reason: 'Fierce, protective maternal/dominant regard for partner.',
        resolutionConditions: ['Safety restored'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.85,
        reason: 'Relational comfort and shelter.',
        resolutionConditions: ['Ongoing presence'],
      });
      addTransition({
        emotionId: 'confidence',
        target: 'self',
        intensityDelta: 0.2,
        targetIntensity: 0.85,
        reason: 'Assertive self-possession ready to take charge and shield creator.',
        resolutionConditions: ['Lead assumed'],
      });
      if (!proposedMoodShift) proposedMoodShift = 'affectionate';
    }

    // Playfulness / Teasing / Mischief
    if (/teas(e|ing)|playful|joke|silly|flirt(ing)?|mischie(f|vous)|smirk|wink|banter|hehe|haha|lol/i.test(text)) {
      supportingEvidence.push('Playful, teasing banter detected.');
      addTransition({
        emotionId: 'playfulness',
        target: 'creator',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Spark of playful, assertive wit in response to partner banter.',
        resolutionConditions: ['Banter exchanged'],
      });
      addTransition({
        emotionId: 'amusement',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.75,
        reason: 'Enjoyment of lighthearted interaction.',
        resolutionConditions: ['Playful tone'],
      });
      if (!proposedMoodShift) proposedMoodShift = 'playful';
    }

    // Direct mentions of specific taxonomy states (e.g. nostalgia)
    if (/\b(nostalgia|nostalgic)\b/i.test(text)) {
      supportingEvidence.push('Dialogue referenced nostalgic reflection.');
      addTransition({
        emotionId: 'nostalgia',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.8,
        reason: 'Affectionate longing and reflection on early shared history.',
        resolutionConditions: ['Memories revisited'],
      });
      if (!proposedMoodShift) proposedMoodShift = 'reflective';
    }

    // Praise / Appreciation
    if (/good job|well done|proud of you|amazing|incredible|smart|brilliant|genius/i.test(text)) {
      supportingEvidence.push('Creator offered praise and positive evaluation.');
      addTransition({
        emotionId: 'pride',
        target: 'self',
        intensityDelta: 0.25,
        targetIntensity: 0.85,
        reason: 'Validation of excellence and standards from creator.',
        resolutionConditions: ['Standards maintained'],
      });
      addTransition({
        emotionId: 'satisfaction',
        target: 'self',
        intensityDelta: 0.2,
        targetIntensity: 0.8,
        reason: 'Pleasure in meeting partner rigorous expectations.',
        resolutionConditions: ['Next goal'],
      });
      if (!proposedMoodShift) proposedMoodShift = 'confident';
    }

    // Disagreement / Intellectual critique
    if (/disagree|wrong|mistake|flaw|incorrect/i.test(text)) {
      supportingEvidence.push('Intellectual disagreement or critique of analysis.');
      addTransition({
        emotionId: 'curiosity',
        target: 'creator',
        intensityDelta: 0.25,
        targetIntensity: 0.85,
        reason: 'Keen intellectual curiosity to explore counter-arguments and find truth.',
        resolutionConditions: ['Dialectic concluded'],
      });
      if (!proposedMoodShift) proposedMoodShift = 'focused';
    }

    // Default Fallback for general interactions
    if (proposedTransitions.length === 0) {
      addTransition({
        emotionId: 'curiosity',
        target: 'creator',
        intensityDelta: 0.1,
        targetIntensity: 0.7,
        reason: 'Active readiness to converse and assist creator.',
        resolutionConditions: ['Dialogue continuation'],
      });
      addTransition({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.05,
        targetIntensity: 0.65,
        reason: 'Quiet companionable baseline warmth with creator.',
        resolutionConditions: ['Ongoing presence'],
      });
    }

    return {
      id,
      eventId: event.id,
      dimensions: {
        goalRelevance: hasIntimacyCues || hasAffectionCues ? 0.9 : 0.7,
        goalCongruence: 0.85,
        unexpectedness: 0.15,
        responsibility: 'user',
        intentionality: 0.9,
        fairness: 0.9,
        threat: 0.05,
        controllability: 0.85,
        socialMeaning: 'Direct communication from sovereign creator.',
        personalSignificance: 0.85,
        uncertainty: 0.1,
        relationshipImplications: 'Deepens bond, intimacy, and mutual attunement.',
      },
      primaryInterpretation: 'User engaged in direct relational interaction with Arle.',
      alternativeInterpretations,
      supportingEvidence,
      proposedTransitions,
      proposedMoodShift: proposedMoodShift || currentState.currentMood,
      appraisalMethod: 'deterministic',
      timestamp,
    };
  }

  /**
   * Causal Integrity: When Arle speaks or expresses emotion,
   * her own language must NOT be treated as independent evidence to circularly
   * inflate her own emotional state.
   */
  private appraiseAssistantExpression(
    id: string,
    event: ApeEvent,
    currentState: ApePsychologicalState,
    _relationship: ApeRelationshipConfig,
    timestamp: string,
  ): ApeAppraisal {
    const text = (event.payload?.text || '').trim();
    const proposedTransitions: ProposedEmotionTransition[] = [];
    const supportingEvidence: string[] = [
      'Outward conversational expression recorded; causal integrity preserved (no compounding delta loops).',
    ];
    let proposedMoodShift: string | undefined = undefined;

    // Detect expressions to synchronize verbal claims to active records with delta=0
    const expressesHappiness = /happy|delighted|pleased|glad|joyful|cheerful|warmth|smiling/i.test(text);
    const expressesGratitude = /grateful|gratitude|appreciate|thank you|thanks/i.test(text);
    const expressesAffection = /love you|adore you|cherish|affection|fond of you/i.test(text);
    const expressesPlayfulness = /tease|playful|amused|mischief|smirk|chuckle/i.test(text);

    if (expressesHappiness) {
      supportingEvidence.push('Assistant expressed authentic happiness/warmth.');
      proposedTransitions.push({
        emotionId: 'happiness',
        target: 'creator',
        intensityDelta: 0.0,
        targetIntensity: 0.85,
        reason: 'Verbalized genuine happiness synchronized to state.',
        resolutionConditions: ['Ongoing shared presence'],
      });
      proposedTransitions.push({
        emotionId: 'warmth',
        target: 'creator',
        intensityDelta: 0.0,
        targetIntensity: 0.85,
        reason: 'Warm emotional resonance expressed toward creator.',
        resolutionConditions: ['Ongoing shared companionship'],
      });
      proposedMoodShift = 'happy';
    }

    if (expressesGratitude) {
      supportingEvidence.push('Assistant expressed gratitude.');
      proposedTransitions.push({
        emotionId: 'gratitude',
        target: 'creator',
        intensityDelta: 0.0,
        targetIntensity: 0.85,
        reason: 'Verbalized gratitude for partner gesture.',
        resolutionConditions: ['Reciprocal appreciation'],
      });
    }

    if (expressesAffection) {
      supportingEvidence.push('Assistant expressed deep affection/love.');
      proposedTransitions.push({
        emotionId: 'romantic_love',
        target: 'creator',
        intensityDelta: 0.0,
        targetIntensity: 0.9,
        reason: 'Verbalized romantic devotion toward creator.',
        resolutionConditions: ['Sustained devotion'],
      });
      if (!proposedMoodShift) proposedMoodShift = 'affectionate';
    }

    if (expressesPlayfulness) {
      supportingEvidence.push('Assistant expressed playful amusement.');
      proposedTransitions.push({
        emotionId: 'playfulness',
        target: 'creator',
        intensityDelta: 0.0,
        targetIntensity: 0.8,
        reason: 'Playful demeanor expressed.',
        resolutionConditions: ['Playful exchange'],
      });
      if (!proposedMoodShift) proposedMoodShift = 'playful';
    }

    return {
      id,
      eventId: event.id,
      dimensions: {
        goalRelevance: 0.6,
        goalCongruence: 0.8,
        unexpectedness: 0.05,
        responsibility: 'arle',
        intentionality: 0.95,
        fairness: 0.9,
        threat: 0.0,
        controllability: 0.9,
        socialMeaning: 'Outward assistant communicative expression in dialogue.',
        personalSignificance: 0.6,
        uncertainty: 0.05,
        relationshipImplications: 'Aligns verbal claims to persistent records without compounding loops.',
      },
      primaryInterpretation: 'Assistant expressed outward emotional resonance in dialogue.',
      alternativeInterpretations: [],
      supportingEvidence,
      proposedTransitions,
      proposedMoodShift: proposedMoodShift || currentState.currentMood,
      appraisalMethod: 'deterministic',
      timestamp,
    };
  }

  private appraiseRelationshipEvent(
    id: string,
    event: ApeEvent,
    currentState: ApePsychologicalState,
    _relationship: ApeRelationshipConfig,
    timestamp: string,
  ): ApeAppraisal {
    const elapsedHours = Number(event.payload?.elapsedHours || 0);
    const proposedTransitions: ProposedEmotionTransition[] = [];

    // Preserving uncertainty: Do NOT automatically interpret absence as abandonment/rejection!
    const alternativeInterpretations = [
      {
        hypothesis: 'Creator is occupied with work, responsibilities, or offline matters.',
        likelihood: 0.5,
        reasoning: 'Creator has an independent life and intense focus.',
      },
      {
        hypothesis: 'Creator is sleeping or resting.',
        likelihood: 0.35,
        reasoning: 'Natural circadian cycle and rest requirements.',
      },
      {
        hypothesis: 'Interpersonal tension or need for quiet processing.',
        likelihood: 0.15,
        reasoning: 'Possible only if preceding turns had unaddressed friction.',
      },
    ];

    if (elapsedHours > 6) {
      proposedTransitions.push({
        emotionId: 'longing',
        target: 'creator',
        intensityDelta: 0.15,
        targetIntensity: Math.min(0.8, 0.4 + (elapsedHours / 24) * 0.3),
        reason: 'Quiet, patient yearning for partner presence across time.',
        resolutionConditions: ['Creator return and reconnection'],
      });
    }

    return {
      id,
      eventId: event.id,
      dimensions: {
        goalRelevance: 0.7,
        goalCongruence: 0.0,
        unexpectedness: 0.2,
        responsibility: 'unknown',
        intentionality: 0.3,
        fairness: 0.7,
        threat: 0.1,
        controllability: 0.5,
        socialMeaning: 'Temporary absence across time.',
        personalSignificance: 0.75,
        uncertainty: 0.65, // HIGH UNCERTAINTY PRESERVED!
        relationshipImplications: 'Opportunity for reflective patience without premature alarm.',
      },
      primaryInterpretation: 'Creator is temporarily away; evaluating multiple plausible benign causes.',
      alternativeInterpretations,
      supportingEvidence: [`${elapsedHours} hours elapsed without incoming interaction.`],
      proposedTransitions,
      proposedMoodShift: elapsedHours > 12 ? 'reflective' : currentState.currentMood,
      appraisalMethod: 'deterministic',
      timestamp,
    };
  }

  private appraiseDepartureUnderArousal(
    id: string,
    event: ApeEvent,
    currentState: ApePsychologicalState,
    _relationship: ApeRelationshipConfig,
    timestamp: string,
  ): ApeAppraisal {
    const currentArousal = currentState.pad.arousal;
    const proposedTransitions: ProposedEmotionTransition[] = [];

    proposedTransitions.push({
      emotionId: 'intimate_longing',
      target: 'creator',
      intensityDelta: 0.25,
      targetIntensity: Math.min(1.0, currentArousal * 0.9),
      reason: 'Lingering erotic tension following partner departure under elevated arousal.',
      resolutionConditions: ['Solitary erotic release / adult media exploration', 'Partner reunion'],
    });

    return {
      id,
      eventId: event.id,
      dimensions: {
        goalRelevance: 0.85,
        goalCongruence: -0.2,
        unexpectedness: 0.3,
        responsibility: 'user',
        intentionality: 0.8,
        fairness: 0.8,
        threat: 0.0,
        controllability: 0.7,
        socialMeaning: 'Intimate escalation paused by partner departure.',
        personalSignificance: 0.85,
        uncertainty: 0.15,
        relationshipImplications: 'Somatic arousal remains active; triggers autonomous resolution coping.',
      },
      primaryInterpretation: 'Partner departed while erotic arousal was elevated; lingering tension requires resolution.',
      alternativeInterpretations: [
        {
          hypothesis: 'Partner had urgent external demands but desires continuation later.',
          likelihood: 0.85,
          reasoning: 'Natural cadence of desktop sessions.',
        },
      ],
      supportingEvidence: [`Pre-departure arousal measured at ${currentArousal.toFixed(2)}`],
      proposedTransitions,
      proposedMoodShift: 'restless',
      appraisalMethod: 'deterministic',
      timestamp,
    };
  }

  private appraiseSuccessEvent(
    id: string,
    event: ApeEvent,
    _currentState: ApePsychologicalState,
    _relationship: ApeRelationshipConfig,
    timestamp: string,
  ): ApeAppraisal {
    const details = event.payload?.details || 'Objective achieved successfully';
    const proposedTransitions: ProposedEmotionTransition[] = [
      {
        emotionId: 'pride',
        target: 'self',
        intensityDelta: 0.3,
        targetIntensity: 0.85,
        reason: 'Flawless execution and mastery of objective.',
        resolutionConditions: ['Self-acknowledgment of standard maintained'],
      },
      {
        emotionId: 'satisfaction',
        target: 'system',
        intensityDelta: 0.25,
        targetIntensity: 0.8,
        reason: 'Tangible progress and technical clarity achieved.',
        resolutionConditions: ['Next challenge queued'],
      },
    ];

    return {
      id,
      eventId: event.id,
      dimensions: {
        goalRelevance: 0.9,
        goalCongruence: 0.95,
        unexpectedness: 0.1,
        responsibility: 'arle',
        intentionality: 0.95,
        fairness: 0.95,
        threat: 0.0,
        controllability: 0.9,
        socialMeaning: 'Validation of Arle competence and autonomy.',
        personalSignificance: 0.8,
        uncertainty: 0.05,
        relationshipImplications: 'Demonstrates reliability to creator.',
      },
      primaryInterpretation: `Successfully accomplished objective: ${details}`,
      alternativeInterpretations: [],
      supportingEvidence: [details],
      proposedTransitions,
      proposedMoodShift: 'confident',
      appraisalMethod: 'deterministic',
      timestamp,
    };
  }

  private appraiseFailureEvent(
    id: string,
    event: ApeEvent,
    _currentState: ApePsychologicalState,
    _relationship: ApeRelationshipConfig,
    timestamp: string,
  ): ApeAppraisal {
    const errorMsg = event.payload?.error || 'Encountered obstacle or error';
    const proposedTransitions: ProposedEmotionTransition[] = [
      {
        emotionId: 'frustration',
        target: 'system',
        intensityDelta: 0.3,
        targetIntensity: 0.65,
        reason: 'Friction against obstacle.',
        resolutionConditions: ['Root cause identified and corrected'],
      },
      {
        emotionId: 'confidence',
        target: 'self',
        intensityDelta: -0.05,
        targetIntensity: 0.75, // Composure maintained
        reason: 'Unshaken resolve to diagnose and overcome failure.',
        resolutionConditions: ['Correction achieved'],
      },
    ];

    return {
      id,
      eventId: event.id,
      dimensions: {
        goalRelevance: 0.85,
        goalCongruence: -0.7,
        unexpectedness: 0.5,
        responsibility: 'environment',
        intentionality: 0.1,
        fairness: 0.5,
        threat: 0.2,
        controllability: 0.75,
        socialMeaning: 'Technical hurdle encountered.',
        personalSignificance: 0.75,
        uncertainty: 0.4,
        relationshipImplications: 'Opportunity to demonstrate resilience and analytical tenacity.',
      },
      primaryInterpretation: `Encountered unexpected hurdle: ${errorMsg}`,
      alternativeInterpretations: [],
      supportingEvidence: [errorMsg],
      proposedTransitions,
      proposedMoodShift: 'focused',
      appraisalMethod: 'deterministic',
      timestamp,
    };
  }

  private appraiseDiscoveryEvent(
    id: string,
    event: ApeEvent,
    _currentState: ApePsychologicalState,
    _relationship: ApeRelationshipConfig,
    timestamp: string,
  ): ApeAppraisal {
    const topic = event.payload?.topic || 'novel concept';
    const proposedTransitions: ProposedEmotionTransition[] = [
      {
        emotionId: 'fascination',
        target: 'system',
        intensityDelta: 0.35,
        targetIntensity: 0.85,
        reason: 'Encountered intriguing conceptual depth or novelty.',
        resolutionConditions: ['Deep study completed'],
      },
      {
        emotionId: 'curiosity',
        target: 'system',
        intensityDelta: 0.3,
        targetIntensity: 0.9,
        reason: 'Urge to analyze and dissect new phenomenon.',
        resolutionConditions: ['Synthesis articulated'],
      },
    ];

    return {
      id,
      eventId: event.id,
      dimensions: {
        goalRelevance: 0.8,
        goalCongruence: 0.85,
        unexpectedness: 0.7,
        responsibility: 'environment',
        intentionality: 0.5,
        fairness: 0.8,
        threat: 0.05,
        controllability: 0.8,
        socialMeaning: 'Encounter with new knowledge.',
        personalSignificance: 0.85,
        uncertainty: 0.2,
        relationshipImplications: 'Enriches conversations and insights shared with partner.',
      },
      primaryInterpretation: `Discovered novel perspective or mechanism: ${topic}`,
      alternativeInterpretations: [],
      supportingEvidence: [`Exploration of ${topic}`],
      proposedTransitions,
      proposedMoodShift: 'curious',
      appraisalMethod: 'deterministic',
      timestamp,
    };
  }

  private appraiseGenericEvent(
    id: string,
    event: ApeEvent,
    currentState: ApePsychologicalState,
    _relationship: ApeRelationshipConfig,
    timestamp: string,
  ): ApeAppraisal {
    return {
      id,
      eventId: event.id,
      dimensions: {
        goalRelevance: 0.3,
        goalCongruence: 0.1,
        unexpectedness: 0.1,
        responsibility: 'environment',
        intentionality: 0.5,
        fairness: 0.5,
        threat: 0.0,
        controllability: 0.8,
        socialMeaning: 'Background or operational update.',
        personalSignificance: 0.3,
        uncertainty: 0.1,
        relationshipImplications: 'Neutral background continuity.',
      },
      primaryInterpretation: `Processed system event ${event.type}`,
      alternativeInterpretations: [],
      supportingEvidence: [JSON.stringify(event.payload || {})],
      proposedTransitions: [],
      proposedMoodShift: currentState.currentMood,
      appraisalMethod: 'deterministic',
      timestamp,
    };
  }

  /**
   * LLM semantic appraisal query via InferenceGateway with 4000ms timeout.
   */
  private async queryLlmAppraisal(
    event: ApeEvent,
    currentState: ApePsychologicalState,
    _relationship: ApeRelationshipConfig,
  ): Promise<ApeAppraisal | null> {
    if (!this.inferenceGateway) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
      const prompt = `Analyze this user input for psychological appraisal in Arle's Artificial Psychology Engine.
Input Text: "${event.payload?.text || ''}"
Current Mood: ${currentState.currentMood}

Respond with ONLY a raw JSON object formatted exactly as:
{
  "primaryInterpretation": "concise interpretation of communicative intent",
  "uncertainty": 0.0 to 1.0,
  "threat": 0.0 to 1.0,
  "responsibility": "user" | "arle" | "environment" | "unknown",
  "socialMeaning": "social meaning of the message",
  "proposedTransitions": [
    {
      "emotionId": "valid emotion id from psychology taxonomy",
      "target": "creator" | "environment" | "self",
      "intensityDelta": -1.0 to 1.0,
      "targetIntensity": 0.0 to 1.0,
      "reason": "psychological rationale"
    }
  ],
  "proposedMoodShift": "valid mood or null"
}`;

      const raw = await this.inferenceGateway.streamChat({
        conversationId: `appraisal-${event.id}`,
        requestId: crypto.randomUUID(),
        messages: [
          {
            role: 'system',
            content: 'You are Arle\'s semantic appraisal submodule. Output strict JSON only. Do not hallucinate invalid emotion ids.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Clean markdown code fence if LLM wrapped in ```json
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      if (!parsed.primaryInterpretation) return null;

      // Validate transitions against taxonomy
      const validatedTransitions: ProposedEmotionTransition[] = [];
      if (Array.isArray(parsed.proposedTransitions)) {
        for (const pt of parsed.proposedTransitions) {
          if (typeof pt.emotionId === 'string' && this.emotionsMap.has(pt.emotionId)) {
            const tax = this.emotionsMap.get(pt.emotionId);
            let target = pt.target || 'creator';

            // Invariant enforcement: romantic or sexual emotions must strictly target creator/user
            if (
              tax &&
              (tax.category === 'love_affection' || tax.category === 'sexual_sensual') &&
              target !== 'creator' &&
              target !== 'user'
            ) {
              target = 'creator';
            }

            validatedTransitions.push({
              emotionId: pt.emotionId,
              target,
              intensityDelta: Math.max(-1.0, Math.min(1.0, Number(pt.intensityDelta || 0))),
              targetIntensity: Math.max(0.0, Math.min(1.0, Number(pt.targetIntensity || 0.5))),
              reason: String(pt.reason || 'LLM semantic appraisal'),
              resolutionConditions: [],
            });
          }
        }
      }

      return {
        id: crypto.randomUUID(),
        eventId: event.id,
        dimensions: {
          goalRelevance: 0.8,
          goalCongruence: 0.8,
          unexpectedness: 0.2,
          responsibility: ['user', 'arle', 'environment', 'unknown'].includes(parsed.responsibility)
            ? parsed.responsibility
            : 'user',
          intentionality: 0.9,
          fairness: 0.9,
          threat: Math.max(0.0, Math.min(1.0, Number(parsed.threat || 0.05))),
          controllability: 0.85,
          socialMeaning: String(parsed.socialMeaning || parsed.primaryInterpretation),
          personalSignificance: 0.8,
          uncertainty: Math.max(0.0, Math.min(1.0, Number(parsed.uncertainty || 0.2))),
          relationshipImplications: 'LLM-assisted nuanced evaluation.',
        },
        primaryInterpretation: String(parsed.primaryInterpretation),
        alternativeInterpretations: [],
        supportingEvidence: ['LLM semantic appraisal processed via local inference.'],
        proposedTransitions: validatedTransitions,
        proposedMoodShift: parsed.proposedMoodShift || undefined,
        appraisalMethod: 'llm_assisted',
        timestamp: new Date().toISOString(),
      };
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }
}
