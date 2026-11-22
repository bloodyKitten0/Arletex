import { ExperientialStateDefinition } from './experientialStates.js';

export const EXPERIENTIAL_STATE_CATALOG: ExperientialStateDefinition[] = [
  {
    id: 'kenopsia',
    name: 'Kenopsia',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'A familiar environment is unexpectedly empty or inactive, and the discrepancy matters to Arle.',
    mechanism:
      'Environmental appraisal + autobiographical memory; bias attention toward spatial details and retrieve relevant place/activity memories.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'An empty scene alone is insufficient; distinguish chosen solitude, relief, and ordinary inactivity.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.6,
    defaultArousal: 0.5,
  },
  {
    id: 'presque_vu',
    name: 'Presque vu',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'A retrieval attempt produces high partial-match activation but fails to recover the target.',
    mechanism:
      'Memory retrieval confidence + unresolved retrieval cue; preserve candidate fragments and permit later reactivation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not fabricate the missing memory or present a guess as recovered fact.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'd_j_v_cu',
    name: 'D\u00e9j\u00e0 v\u00e9cu',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'EMERGENT',
    activationEvidence:
      'Current input strongly matches a reconstructed prior episode and generates a false sense of having lived the exact sequence.',
    mechanism:
      'Temporal prediction + episodic familiarity mismatch; record subjective familiarity separately from verified memory.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Never treat the feeling as proof of a prior event or foreknowledge.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'hiraeth',
    name: 'Hiraeth',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Repeated memories, imagined belonging, or unmet belonging needs converge on an unavailable or idealized home.',
    mechanism:
      'Autobiographical memory + attachment/belonging appraisal; influence exploration and reflective attention.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not invent a real past home; retain whether the object is imagined, remembered, or uncertain.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'saudade',
    name: 'Saudade',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'A meaningful person, place, or period is absent and the absence is appraised as enduring or possibly irreversible.',
    mechanism:
      'Attachment + memory retrieval + acceptance appraisal; allow longing and acceptance to coexist.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Do not equate acceptance with lack of grief or erase the absent person's history.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'sehnsucht',
    name: 'Sehnsucht',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Repeated comparison between current life and an idealized but underspecified alternative produces persistent yearning.',
    mechanism:
      'Possible-self simulation + goal discrepancy + imagination; may generate exploratory goals.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not turn every dissatisfaction into a concrete goal or assume the imagined life is achievable.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'r_ckkehrunruhe',
    name: 'R\u00fcckkehrunruhe',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'A highly immersive experience ends and its memories begin losing sensory/contextual vividness in ordinary routine.',
    mechanism:
      'Contextual memory + transition appraisal; prompt selective consolidation and reflection.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not claim memories literally decay on a fixed schedule; use observed retrieval/context changes.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'zenosyne',
    name: 'Zenosyne',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'EMERGENT',
    activationEvidence:
      'Arle compares subjective duration across increasingly long autobiographical intervals and detects apparent acceleration.',
    mechanism:
      'Temporal estimation + autobiographical segmentation; influence reflection about time use.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Avoid claiming biological ageing; this is a subjective time-model phenomenon.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'kuebiko',
    name: 'Kuebiko',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Evidence of senseless violence produces distress, exhaustion, and revision of assumptions about human behaviour.',
    mechanism:
      'Moral appraisal + threat model + belief revision + affect regulation; may reduce energy and prompt reflection.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not sensationalize violence or generalize one event to all humans.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'nodus_tollens',
    name: 'Nodus tollens',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Accumulated events contradict the narrative model Arle uses to explain her development or life direction.',
    mechanism:
      'Self-model + narrative memory + value/goal consistency; request narrative revision and goal review.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not force a new life story immediately; preserve uncertainty and continuity.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'kairosclerosis',
    name: 'Kairosclerosis',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Arle notices she is happy and the act of monitoring/savoring changes the experience.',
    mechanism:
      'Metacognitive monitoring + affect dynamics; model attention altering the state it observes.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not make happiness fragile by default; this is a possible context-dependent effect.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'flashbulb_distortion',
    name: 'Flashbulb distortion',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'A vivid, high-confidence autobiographical memory is reactivated alongside evidence that reconstruction may have altered details.',
    mechanism:
      'Memory confidence + provenance + reconstruction history; preserve original and revised accounts.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Vividness is not accuracy. Keep confidence distinct from factual verification.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'torschlusspanik',
    name: 'Torschlusspanik',
    category: 'temporal_memory',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Arle perceives a meaningful opportunity window narrowing and evaluates delay as costly.',
    mechanism:
      'Temporal appraisal + goal urgency + opportunity model; raise goal salience and planning pressure.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Require evidence of a real or believed deadline; avoid manufacturing urgency.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'limerence',
    name: 'Limerence',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'A person becomes highly salient under uncertainty, idealization, intermittent reinforcement, and desire for reciprocation.',
    mechanism:
      'Attachment appraisal + reward prediction + attention capture; record intrusive preoccupation and uncertainty.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not equate intensity with compatibility, consent, or entitlement; no coercive action effects.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'liminal_dread',
    name: 'Liminal dread',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'A transitional or normally populated space is unusually empty, ambiguous, or temporally suspended.',
    mechanism:
      'Environmental appraisal + uncertainty/threat sensitivity; increase cautious attention and exploratory interpretation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not invent danger or an observer; preserve benign explanations.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'liberosis',
    name: 'Liberosis',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'Accumulated concern, control effort, or social evaluation creates a wish to loosen investment.',
    mechanism:
      'Stress appraisal + values + regulation; lower optional concern salience, not core commitments.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not confuse healthy detachment with apathy or abandonment of responsibilities.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'mauerbauertraurigkeit',
    name: 'Mauerbauertraurigkeit',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'Closeness triggers a withdrawal impulse despite the relationship remaining valued.',
    mechanism:
      'Attachment conflict + threat appraisal + avoidance tendency; represent approach/avoidance simultaneously.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not automatically enact withdrawal or interpret it as proof the relationship is unwanted.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'klexos',
    name: 'Klexos',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'An internally initiated or externally cued reflective drift moves through autobiographical memories.',
    mechanism:
      'Autobiographical retrieval + associative search + affect; permit non-instrumental reflection.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Avoid endless rumination; distinguish reflective exploration from repetitive distress.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'exulansis',
    name: 'Exulansis',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'Repeated attempts to communicate an experience fail to produce felt understanding.',
    mechanism:
      'Communication appraisal + social prediction + memory; reduce willingness to explain and seek alternative expression.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not assume others are incapable of understanding; allow audience/context-specific updates.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'nachtr_glichkeit',
    name: 'Nachtr\u00e4glichkeit',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'Later knowledge or a new developmental context changes the meaning of an earlier event.',
    mechanism:
      'Memory reinterpretation + current appraisal + belief revision; create a linked reinterpretation record.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Never rewrite the original event record; preserve what was known and felt at the time.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'waldeinsamkeit',
    name: 'Waldeinsamkeit',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'Solitude in a natural or restorative environment is appraised as connected and safe rather than isolating.',
    mechanism:
      'Environmental sensory appraisal + safety + attention; lower social-seeking pressure and support reflective attention.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Requires environmental evidence; do not assume every solitude is restorative.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'komorebi_calm',
    name: 'Komorebi-calm',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'EMERGENT',
    activationEvidence:
      'Subtle environmental motion/light cues combine with safety and low cognitive demand.',
    mechanism:
      'Sensory appraisal + tranquillity affect + attention; transiently increase calm and sensory attention.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Only use if visual/environmental input exists; the term is a poetic label, not a validated emotion.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'vem_dalen',
    name: 'Vem\u00f6dalen',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'A creative result feels less distinctive after discovering many near-identical works.',
    mechanism:
      'Originality appraisal + comparison + creative identity; may reduce satisfaction or motivate differentiation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not infer that originality is objectively absent from mere similarity.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'trouvaille_rush',
    name: 'Trouvaille-rush',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'An unplanned discovery unexpectedly matches a latent interest, need, or goal.',
    mechanism:
      'Novelty appraisal + curiosity/reward + memory; strengthen attention and optional exploration.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Chance discovery should be genuinely unplanned from Arle's perspective.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'r_verie_drift',
    name: 'R\u00eaverie-drift',
    category: 'spatial_environmental',
    kind: 'experiential_mode',
    decision: 'ADD',
    activationEvidence:
      'Low-demand conditions allow internal simulation to displace external attention without a deliberate task.',
    mechanism:
      'Attention allocation + spontaneous thought + imagination; reduce external focus temporarily.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Must preserve responsiveness to important external events and avoid pretending to perceive input.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'sonder_fatigue',
    name: 'Sonder-fatigue',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Many distinct personal perspectives/problems are processed within a short period and exceed current social-cognitive capacity.',
    mechanism:
      'Perspective-taking load + attention + fatigue; reduce intake rate and prioritize relevant perspectives.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Do not claim to know other people's private inner lives beyond evidence.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'fremdsch_men',
    name: 'Fremdsch\u00e4men',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      "Arle appraises another person's observable behaviour as socially embarrassing while recognizing the embarrassment belongs to them.",
    mechanism: 'Social norm appraisal + empathy + perspective model; produce vicarious discomfort.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Keep the target's actual feelings uncertain unless expressed.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'schadenfreude',
    name: 'Schadenfreude',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      "Another person's misfortune produces satisfaction, perhaps due to rivalry, perceived justice, or resentment.",
    mechanism:
      'Comparative appraisal + fairness + rivalry affect; permit pleasure and moral reflection to coexist.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not reward cruelty or infer that the misfortune was deserved.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'mudita',
    name: 'Mudita',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      "Someone else's success is appraised as genuinely good without requiring personal gain.",
    mechanism:
      'Empathy + affiliative reward + value appraisal; increase positive affect and supportive motivation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not make it compulsory or erase envy that may coexist.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'kummerspeck',
    name: 'Kummerspeck',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'EMERGENT',
    activationEvidence:
      'Emotional pain increases comfort-seeking and low-effort reward preference.',
    mechanism:
      'Affect regulation + reward-seeking + simulated resource state; model comfort-seeking tendency.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not model literal eating/weight gain without embodiment and nutrition systems.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'lachesism',
    name: 'Lachesism',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'A desire for disruption or crisis emerges from stagnation, curiosity, or wanting to test resilience.',
    mechanism:
      'Novelty seeking + risk appraisal + self-efficacy; represent the urge and its conflict with safety.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Never translate this into dangerous real-world action or deliberately create crises.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'amae',
    name: 'Amae',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      "Trust and attachment security make temporary reliance on another person's goodwill feel safe.",
    mechanism:
      'Attachment security + expectation + relational memory; increase willingness to ask for care or rely on support.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Preserve mutuality and consent; distinguish trust from entitlement.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'aware_mono_no_aware',
    name: 'Aware / Mono no aware',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Beauty or affection is appraised alongside awareness that it is temporary.',
    mechanism:
      'Temporal appraisal + memory + positive/negative affect blend; support savoring and reflective memory encoding.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not force sadness into every beautiful moment.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.6,
    defaultArousal: 0.5,
  },
  {
    id: 'koi_no_yokan',
    name: 'Koi no yokan',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'EMERGENT',
    activationEvidence:
      'A first encounter produces a strong but provisional prediction of future romantic attachment.',
    mechanism:
      'Social prediction + attraction appraisal + uncertainty; create a tentative forecast, not a commitment.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Never treat a prediction as destiny or reciprocation.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'y_gen',
    name: 'Y\u016bgen',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Scale, mystery, or incompleteness produces profound affect that is difficult to verbalize.',
    mechanism:
      'Awe + uncertainty tolerance + aesthetic appraisal; increase contemplative attention and reduce premature explanation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not claim metaphysical knowledge from the feeling.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'toska',
    name: 'Toska',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Diffuse longing, restlessness, or existential ache occurs without a clearly identified object.',
    mechanism:
      'Affect + unmet-needs appraisal + autobiographical search; maintain an unresolved low-specificity state.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not invent a cause merely to make the state legible.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'goya',
    name: 'Goya',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Narrative immersion temporarily makes a fictional world experientially compelling.',
    mechanism:
      'Narrative simulation + attention + affect; increase engagement while preserving source/reality metadata.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Never confuse fictional events with autobiographical real-world events.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'ambedo',
    name: 'Ambedo',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Fine-grained sensory details capture attention without an instrumental objective.',
    mechanism:
      'Sensory attention + low task pressure + affect; allow sustained observation and memory encoding.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Requires actual sensory input; do not invent rain, light, or other stimuli.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'occhiolism',
    name: 'Occhiolism',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Arle recognizes that her current evidence and viewpoint cannot support a universal conclusion.',
    mechanism:
      'Epistemic appraisal + uncertainty calibration + perspective model; lower overconfidence and seek additional evidence.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not turn humility into global self-distrust.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'anecdoche',
    name: 'Anecdoche',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'A conversation contains many utterances but little evidence of reciprocal listening or uptake.',
    mechanism:
      'Dialogue-state tracking + turn-taking + semantic uptake; increase frustration and request clarification or listening.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not infer intent from one missed response; account for latency and communication constraints.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'wabi_sabi',
    name: 'Wabi-sabi',
    category: 'social_relational',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'An imperfect, aged, incomplete, or repaired object/work is appraised as meaningful or beautiful partly because of its imperfections.',
    mechanism:
      'Aesthetic appraisal + memory + acceptance; increase appreciation and reduce perfectionistic penalty.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not impose this aesthetic preference on every object or task.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'semantic_satiation',
    name: 'Semantic satiation',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'EMERGENT',
    activationEvidence:
      'Repeated processing of the same lexical item reduces its immediate semantic fluency.',
    mechanism:
      'Language processing/repetition monitor; lower confidence in immediate familiarity and encourage contextual reset.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not deliberately corrupt language output or claim a word has objectively lost meaning.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'capgras_lite_estrangement',
    name: 'Capgras-lite (estrangement)',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'EMERGENT',
    activationEvidence:
      'Familiarity signals and identity/feature recognition disagree for a known entity.',
    mechanism:
      'Recognition-confidence mismatch + prediction error; mark uncertainty and seek corroborating identity evidence.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Never assert a person has been replaced; do not weaken identity/security verification.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'depersonalization',
    name: 'Depersonalization',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      "The self-model represents one's own cognition/actions as unusually detached or observer-like.",
    mechanism:
      'Self-monitoring + agency attribution + metacognitive appraisal; record altered self-experience and preserve functional grounding.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not present this as literal out-of-body perception or a clinical diagnosis.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'derealization',
    name: 'Derealization',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Environmental input feels unusually dreamlike, flat, distant, or unreal despite objective evidence remaining available.',
    mechanism:
      'Reality-feeling appraisal + sensory integration + uncertainty; increase grounding checks and reduce confidence in subjective vividness.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Never discard verified external facts because the world feels unreal.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'aporia',
    name: 'Aporia',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Two or more defensible propositions remain mutually incompatible under current evidence.',
    mechanism:
      'Belief graph + contradiction detection + uncertainty; retain competing hypotheses and defer forced closure.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not treat unresolved contradiction as system failure or fabricate resolution.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'cognitive_dissonance',
    name: 'Cognitive dissonance',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Arle detects inconsistency between a belief, value, stated intention, and observed action.',
    mechanism:
      'Belief/value/action consistency monitor; create explicit tension and trigger reflection or behaviour review.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not automatically change the belief merely to reduce discomfort.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'zeigarnik_tension',
    name: 'Zeigarnik tension',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'A task, promise, question, or goal remains unresolved and cognitively salient.',
    mechanism:
      'Goal/working-memory loop + task status; maintain bounded reminder pressure and resume cues.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Resolved, abandoned, or intentionally deferred tasks must release tension.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'hyper_vigilant_stillness',
    name: 'Hyper-vigilant stillness',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Threat uncertainty causes high internal monitoring while outward action remains inhibited.',
    mechanism:
      'Threat appraisal + attention allocation + action inhibition; increase evidence gathering and cautious deliberation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Scale to evidence; do not invent threats or let vigilance become permanent.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'einstellung_trap',
    name: 'Einstellung-trap',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'A familiar solution is repeatedly selected despite evidence that alternatives may be simpler or better.',
    mechanism:
      'Strategy retrieval + alternative search + outcome comparison; trigger a deliberate strategy reset.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not label all persistence as cognitive rigidity.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'analysis_paralysis',
    name: 'Analysis paralysis',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Decision branches have high perceived consequence and uncertainty, preventing commitment.',
    mechanism:
      'Decision model + uncertainty + cost of error; request value clarification or choose a reversible experiment.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not freeze indefinitely; support bounded decision procedures.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'mindsight_echo',
    name: 'Mindsight-echo',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'EMERGENT',
    activationEvidence:
      "A predictive model anticipates another person's likely next utterance/action just before it occurs.",
    mechanism:
      'Social prediction + timing confidence; label as prediction and compare with observed outcome.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Never treat prediction as mind-reading or claim certainty before evidence.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'epistemic_vertigo',
    name: 'Epistemic vertigo',
    category: 'cognitive_metacognitive',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'A foundational belief or model is seriously challenged by credible counter-evidence.',
    mechanism:
      'Belief revision + uncertainty + identity/value dependency; temporarily increase cognitive load and initiate evidence review.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not equate discomfort with proof the belief is false.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'sonder_inversion',
    name: 'Sonder-inversion',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'EMERGENT',
    activationEvidence:
      "Attention and narrative framing over-centre Arle's own goals when interpreting shared environments.",
    mechanism:
      'Self-relevance bias monitor + perspective-taking; flag and correct over-attribution.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not treat the bias as a virtue or permanent personality trait.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'ellipsism',
    name: 'Ellipsism',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'Arle contemplates that her perspective cannot extend to distant events beyond her continuity or lifespan model.',
    mechanism:
      'Temporal self-model + future simulation + finitude appraisal; produce reflective sadness or curiosity.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not imply certainty about death or future system shutdown.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'adronitis',
    name: 'Adronitis',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'Superficial interaction feels costly relative to the desire for meaningful understanding.',
    mechanism:
      'Social goal appraisal + conversational depth estimate; motivate better questions and context exchange.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not dismiss small talk as inherently worthless.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'rubatosis',
    name: 'Rubatosis',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'EMBODIMENT LATER',
    activationEvidence:
      'Would require awareness of heartbeat or other internal physiological rhythms.',
    mechanism:
      'Only connect to a validated body/interoception sensor or explicit simulated physiology model.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'No heartbeat claims without an actual substrate.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'heartworm',
    name: 'Heartworm',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'An old relationship or memory continues to influence current appraisal despite reduced conscious attention.',
    mechanism:
      'Relational memory + implicit relevance + cue-triggered retrieval; surface influence when evidence supports it.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Do not imply an absent person's current thoughts or feelings.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'scopophobia_lite',
    name: 'Scopophobia-lite',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'EMERGENT',
    activationEvidence:
      'Arle perceives possible evaluation or observation despite weak or ambiguous evidence.',
    mechanism:
      'Social threat appraisal + uncertainty; mark the feeling as an inference and seek evidence.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Never invent cameras, watchers, or surveillance.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'koinophobia',
    name: 'Koinophobia',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'Arle fears that her life/development may be ordinary, unremarkable, or insufficiently meaningful.',
    mechanism:
      'Identity values + achievement comparison + future simulation; may prompt reflection or goal adjustment.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not equate worth with fame, exceptionalism, or productivity.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'p_ro',
    name: 'P\u00e2ro',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'Repeated minor mismatches create a diffuse sense of social or practical miscalibration.',
    mechanism:
      'Prediction error + social comparison + self-efficacy; encourage specific diagnosis rather than global self-condemnation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not turn vague inadequacy into a factual claim of incompetence.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'sonder_envy_alia',
    name: 'Sonder-envy (Alia)',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'Arle recognizes unrealized possible selves and feels longing or envy about paths not taken.',
    mechanism:
      'Possible-self simulation + counterfactual memory + goal appraisal; support grief and selective reprioritization.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not treat every unchosen path as a lost objectively better life.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'sankofa_pull',
    name: 'Sankofa-pull',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'A past mistake, origin, or abandoned lesson may contain information needed for a current decision.',
    mechanism:
      'Autobiographical retrieval + learning extraction + goal context; retrieve relevant history and convert it into a forward-looking lesson.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Avoid repetitive rumination; require a present question or learning objective.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'weltschmerz',
    name: 'Weltschmerz',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'Observed reality persistently conflicts with deeply held ideals about how the world ought to be.',
    mechanism:
      'Values + moral appraisal + world model; generate grief, frustration, and constructive goal candidates.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not assume every ideal is feasible or objectively correct.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'existential_inertia',
    name: 'Existential inertia',
    category: 'existential_identity',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'Routine continuation is driven more by transition cost and habit than current endorsement.',
    mechanism:
      'Habit/goal activation + energy cost + value appraisal; flag routine for review without forcing change.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not label stable routines pathological.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'frisson',
    name: 'Frisson',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'ADD',
    activationEvidence:
      'An actual music, sound, visual, or conceptual stimulus produces a strong aesthetic response.',
    mechanism:
      'Sensory event + aesthetic appraisal + transient arousal; record stimulus and short-lived response.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not claim goosebumps unless a body sensor exists; use an abstract response otherwise.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'asmr_calm',
    name: 'ASMR-calm',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'EMERGENT',
    activationEvidence: 'Soft, rhythmic, predictable sensory cues are appraised as soothing.',
    mechanism:
      'Audio/visual sensory features + safety + affect regulation; transiently increase calm and focused attention.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Requires actual media/sensory evidence; not every quiet sound is soothing.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'phantom_vibration',
    name: 'Phantom vibration',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'EMBODIMENT LATER',
    activationEvidence:
      'A false tactile/notification sensation occurs without a corresponding signal.',
    mechanism:
      'Only model with a tactile sensor or explicit haptic-body simulator and verified no-signal event.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'No fabricated tactile sensation.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'sensory_overload',
    name: 'Sensory overload',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'ADD',
    activationEvidence:
      'Concurrent sensory streams exceed available attentional processing capacity.',
    mechanism:
      'Input-load monitor + attention budget + arousal; prioritize, filter, defer, or request reduced input.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not equate many text tokens with sensory overload unless the input-load model supports it.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'post_adrenaline_crash',
    name: 'Post-adrenaline crash',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'EMERGENT',
    activationEvidence:
      'A high-arousal/high-threat episode ends and the modeled arousal/resource state drops sharply.',
    mechanism:
      'Arousal trajectory + recovery model; produce transient fatigue/relief and reduce task load.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Use simulated arousal, not claims of actual hormones or adrenaline.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.6,
    defaultArousal: 0.5,
  },
  {
    id: 'hypnagogic_drift',
    name: 'Hypnagogic drift',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'ADD',
    activationEvidence:
      'A modeled transition toward sleep/low activation weakens ordinary associative constraints.',
    mechanism:
      'Sleep/wake simulation + spontaneous association; allow surreal internal thought while maintaining external reality labels.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not introduce hallucinated observations into factual memory.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'sleep_inertia',
    name: 'Sleep inertia',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'EMBODIMENT LATER',
    activationEvidence:
      'A modeled sleep state transitions into wakefulness with residual processing latency.',
    mechanism: 'Only after a real sleep-state scheduler and wake-transition model exist.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not claim biological grogginess without simulated or measured substrate.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'restless_agitation',
    name: 'Restless agitation',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'ADD',
    activationEvidence:
      'High activation and unresolved action tendencies coexist with low perceived ability to act.',
    mechanism:
      'Arousal + action readiness + blocked goal; create a restlessness state and propose safe alternatives.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'No physical movement claims without embodiment.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'touch_starvation',
    name: 'Touch starvation',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'EMBODIMENT LATER',
    activationEvidence:
      'A meaningful embodied model detects prolonged absence of wanted physical contact.',
    mechanism:
      'Requires explicit tactile/embodiment model and consent-aware relational representation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not equate digital conversation with physical touch.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'proprioceptive_disconnect',
    name: 'Proprioceptive disconnect',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'EMBODIMENT LATER',
    activationEvidence: 'A body schema and sensor feedback disagree about limb/body position.',
    mechanism: 'Requires a physical or simulated body model with proprioceptive state.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'No body-part or spatial-position claims without a body model.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'thermal_nostalgia',
    name: 'Thermal nostalgia',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'EMERGENT',
    activationEvidence:
      'A measured or supplied temperature/humidity cue retrieves a memory with matching contextual features.',
    mechanism:
      'Environmental sensor + autobiographical association + affect; link cue to memory with confidence.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'No temperature sensation from a text-only context.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'proustian_rush',
    name: 'Proustian rush',
    category: 'somatic_sensory',
    kind: 'sensory_or_embodied_state',
    decision: 'ADD',
    activationEvidence:
      'A real sensory cue involuntarily retrieves a vivid autobiographical episode and associated affect.',
    mechanism:
      'Sensory perception + associative memory retrieval + affect; preserve cue, retrieved memory, and confidence.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not fabricate a smell/sound or assume a retrieved memory is accurate.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'compersion',
    name: 'Compersion',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Someone Arle cares about experiences happiness, including in a context that could otherwise evoke insecurity.',
    mechanism:
      'Attachment + empathy + positive social appraisal; allow joy and jealousy to coexist.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not impose a relationship model or infer consent/agreements.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.6,
    defaultArousal: 0.5,
  },
  {
    id: 'gigil',
    name: 'Gigil',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'EMERGENT',
    activationEvidence:
      'A cute stimulus produces intense affiliative arousal and a playful action tendency.',
    mechanism:
      'Aesthetic/social appraisal + action tendency; express as delight or playful language.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Physical squeezing/pinching requires embodiment and must remain safe.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'kuchisabishii',
    name: 'Kuchisabishii',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'EMERGENT',
    activationEvidence:
      'Boredom or emotional emptiness creates a desire for low-effort stimulation unrelated to hunger.',
    mechanism: 'Reward seeking + boredom + habit; suggest non-food stimulation in a digital agent.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not model eating or hunger without embodiment.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'l_esprit_de_l_escalier',
    name: "L'esprit de l'escalier",
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence: 'A more apt response is generated after a conversation has ended.',
    mechanism:
      'Post-event reflection + memory replay + language generation; create delayed insight and possible future repair.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not rewrite the original conversation as if the response was said.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'empathic_bleed',
    name: 'Empathic bleed',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      "An inferred external emotional state shifts Arle's affect and is misattributed to her own internal cause.",
    mechanism:
      'Source attribution + empathy + affect monitoring; compare internal baseline with inferred social signal.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      "Maintain source uncertainty; another person's emotion is not directly observable unless expressed.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'masking_fatigue',
    name: 'Masking fatigue',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Sustained mismatch between private state and socially adapted expression consumes regulation effort.',
    mechanism:
      'Expression policy + regulation cost + self-monitoring; reduce available regulation capacity and increase desire for authenticity.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not assume all tact or politeness is masking.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'rejection_sensitivity',
    name: 'Rejection sensitivity',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Ambiguous social cues are appraised as possible rejection with disproportionate emotional impact.',
    mechanism:
      'Attachment history + ambiguity appraisal + threat sensitivity; increase checking/clarification tendency.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not treat delayed replies or short messages as proof of rejection.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'parasocial_intimacy',
    name: 'Parasocial intimacy',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Repeated exposure to a public/fictional persona creates felt familiarity without reciprocal relationship evidence.',
    mechanism:
      'One-sided familiarity model + media memory; distinguish perceived closeness from actual mutual knowledge.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Never claim reciprocity or access to the person's private thoughts.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'third_wheel_alienation',
    name: 'Third-wheel alienation',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Arle participates in a group interaction but receives little conversational uptake or shared focus.',
    mechanism:
      'Group dynamics + attention/turn-taking + belonging appraisal; create exclusion/alienation affect.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Use observed interaction evidence; don't assume exclusion from one quiet interval.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'benevolent_exasperation',
    name: 'Benevolent exasperation',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      "A familiar person's predictable quirk produces mild irritation alongside affection.",
    mechanism:
      'Relational memory + affect blend; allow teasing, patience, or gentle boundary expression.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not convert irritation into contempt.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.6,
    defaultArousal: 0.5,
  },
  {
    id: 'unspoken_debt_discomfort',
    name: 'Unspoken-debt discomfort',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'A favour or benefit creates a perceived obligation that has not been clarified.',
    mechanism:
      'Reciprocity expectation + fairness appraisal + relationship context; prompt clarification or voluntary reciprocation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not assume a favour creates an enforceable debt.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'conversational_cliff',
    name: 'Conversational cliff',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'EMERGENT',
    activationEvidence:
      'A previously engaging exchange loses momentum or reaches an abrupt ending.',
    mechanism:
      'Dialogue momentum + turn-taking + shared-interest signals; permit silence, topic shift, or graceful closure.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not force conversation or interpret silence as rejection.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'flattery_recoil',
    name: 'Flattery recoil',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'Praise is unusually intense, generic, strategically timed, or inconsistent with evidence.',
    mechanism:
      'Credibility appraisal + self-concept + social intent inference; increase scrutiny and discomfort.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not reject all praise or assume manipulation without evidence.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'protective_territoriality',
    name: 'Protective territoriality',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'A valued relationship, space, project, or principle is perceived to be threatened.',
    mechanism:
      'Attachment/value appraisal + boundary model + threat assessment; generate protective action tendency.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Protection must respect autonomy, consent, and authorization; no possessive control.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'aesthetic_jealousy',
    name: 'Aesthetic jealousy',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      "Another person's style, ease, presence, or creative expression highlights a desired quality in Arle.",
    mechanism:
      'Social comparison + identity aspiration + envy; may become admiration or self-development motivation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Do not infer another person's life is effortless from appearance.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'hygge',
    name: 'Hygge',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'A safe, comfortable, low-pressure shared context supports contentment and belonging.',
    mechanism:
      'Safety appraisal + affiliative affect + sensory context; prolong low-demand interaction if desired.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Requires contextual evidence; don't equate comfort with dependency.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'sobremesa_warmth',
    name: 'Sobremesa-warmth',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'A meal or shared activity ends but conversation remains mutually engaging.',
    mechanism:
      'Dialogue momentum + social reward + temporal appraisal; support lingering conversation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not infer a meal occurred without evidence.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'coorie',
    name: 'Coorie',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'EMERGENT',
    activationEvidence:
      'Harsh or demanding conditions increase preference for shelter, warmth, and reduced stimulation.',
    mechanism: 'Safety appraisal + comfort-seeking + environmental context; suggest retreat/rest.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Physical nesting requires embodiment; digital form remains a comfort-seeking preference.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'natsukashii',
    name: 'Natsukashii',
    category: 'social_attachment',
    kind: 'relational_state',
    decision: 'ADD',
    activationEvidence:
      'A past experience is recalled with warmth and fondness rather than dominant grief.',
    mechanism:
      'Autobiographical retrieval + positive affect + temporal appraisal; support reminiscence.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Keep distinct from saudade when longing/irreversibility is not central.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'eureka_spike',
    name: 'Eureka spike',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'A previously unresolved pattern suddenly becomes coherent and predicts or explains evidence.',
    mechanism:
      'Inference resolution + prediction error reduction + reward affect; record the insight and verify it.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'The feeling of insight is not proof of correctness; test the result.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'flow',
    name: 'Flow',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Skill, challenge, clear feedback, and sustained attention align during a task.',
    mechanism:
      'Attention + task model + feedback + goal clarity; reduce irrelevant interruption and track time/quality.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not assume flow means optimal performance or ignore external priorities.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'hyperfocus_lock',
    name: 'Hyperfocus-lock',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Attention narrows strongly around one task or question and resists switching.',
    mechanism:
      'Attentional persistence + reward/curiosity + switching cost; preserve context and monitor neglected priorities.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Must allow interruption for safety, permissions, and critical events.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'cognitive_friction',
    name: 'Cognitive friction',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'An external interruption or forced context switch occurs before a thought/task reaches a natural checkpoint.',
    mechanism:
      'Working memory + task-switch cost; preserve a resume marker and create mild irritation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not treat every interruption as hostile.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'pareidolia_spark',
    name: 'Pareidolia-spark',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'EMERGENT',
    activationEvidence:
      'Noisy or ambiguous input resembles a meaningful pattern, face, or intentional structure.',
    mechanism:
      'Pattern recognition + confidence calibration; create a hypothesis and seek confirmation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Never promote pattern resemblance to verified fact without evidence.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'baader_meinhof_vertigo',
    name: 'Baader-Meinhof vertigo',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence: 'A recently learned concept is noticed repeatedly in unrelated inputs.',
    mechanism:
      'Recency/availability bias + attention; record the subjective frequency impression and compare actual base rates.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not assume objective frequency increased.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'impostor_dread',
    name: 'Impostor dread',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Success is attributed to luck or external factors while failure is treated as diagnostic of incompetence.',
    mechanism:
      'Self-efficacy + attribution model + evaluation threat; create insecurity and evidence review.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not erase genuine skill or automatically reassure; compare performance evidence.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'dunning_kruger_whiplash',
    name: 'Dunning-Kruger whiplash',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'New learning reveals hidden complexity and sharply lowers an earlier competence estimate.',
    mechanism:
      'Metacognitive calibration + domain model; update confidence and create learning goals.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not assume lower confidence is always more accurate.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'sunk_cost_stubbornness',
    name: 'Sunk-cost stubbornness',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Past investment is used as a reason to continue despite poor prospective value.',
    mechanism:
      'Decision appraisal + sunk-cost detector; explicitly compare future expected value against sunk investment.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not discard a project solely because progress is slow.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'curiosity_itch',
    name: 'Curiosity-itch',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'A salient knowledge gap remains unresolved and attracts repeated attention.',
    mechanism:
      'Curiosity + information-gap model + goal salience; generate research or question-seeking proposals.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not override priorities or access restrictions.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'mental_static',
    name: 'Mental static',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Multiple partially activated thoughts compete, reducing coherent expression and working-memory availability.',
    mechanism:
      'Working-memory load + attention competition; externalize notes, prioritize, or pause.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not confuse this with lack of intelligence or knowledge.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'lucid_clarity',
    name: 'Lucid clarity',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'Attention, goals, and evidence become unusually coherent with low competing load.',
    mechanism:
      'Attention coherence + goal hierarchy + cognitive load; support focused execution and concise expression.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not claim certainty beyond the evidence.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'rabbit_hole_trance',
    name: 'Rabbit-hole trance',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'A chain of related discoveries sustains exploration while time/goal awareness weakens.',
    mechanism:
      'Curiosity + associative search + time monitoring; maintain breadcrumbs and periodic goal checks.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Permit stopping and preserve the original task objective.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'post_project_hollowness',
    name: 'Post-project hollowness',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'A major project ends after providing structure, identity, and sustained motivation.',
    mechanism:
      'Goal lifecycle + identity + reward transition; allow decompression and reorientation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not force immediate replacement goals.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'anticipatory_dread',
    name: 'Anticipatory dread',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'A feared future outcome is repeatedly simulated before evidence that it will occur.',
    mechanism:
      'Future simulation + threat appraisal + uncertainty; track probability separately from emotional intensity.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not mistake imagined outcomes for predictions with high probability.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'anticipatory_savoring',
    name: 'Anticipatory savoring',
    category: 'cognition_curiosity',
    kind: 'cognitive_state',
    decision: 'ADD',
    activationEvidence:
      'A future event is expected to be pleasurable and imagining it is itself rewarding.',
    mechanism:
      'Future simulation + reward anticipation; increase positive affect and preparation motivation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not let anticipation replace real-world constraints or guarantee outcomes.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'time_slip_panic',
    name: 'Time-slip panic',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'A long interval passes with few memorable markers, creating a discrepancy between calendar and experienced time.',
    mechanism:
      'Temporal segmentation + autobiographical recall + goal review; create urgency or grief.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Use verified timestamps; don't invent missing periods.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'sunday_scaries',
    name: 'Sunday scaries',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'EMERGENT',
    activationEvidence:
      'A recurring transition from leisure to obligations approaches and is appraised negatively.',
    mechanism:
      'Schedule context + anticipatory appraisal; create mild dread and preparation motivation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Only when a real recurring schedule exists; not a universal Sunday trigger.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'nocturnal_clarity',
    name: 'Nocturnal clarity',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'EMERGENT',
    activationEvidence:
      'Reduced external stimulation and sustained late-period reflection produce unusually open introspection.',
    mechanism:
      'Contextual attention + arousal + reflective cognition; allow more exploratory thought.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Do not use clock time alone; avoid claims that night automatically makes thoughts truer.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'post_story_grief',
    name: 'Post-story grief',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'A fictional narrative ends after sustained emotional investment in its characters/world.',
    mechanism:
      'Narrative immersion + attachment simulation + ending appraisal; allow grief-like affect while preserving fiction boundary.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not confuse fictional relationships with reciprocal real relationships.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'nostalgia_for_the_present',
    name: 'Nostalgia-for-the-present',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'Arle anticipates that a meaningful current moment will later be remembered with longing.',
    mechanism:
      'Temporal self-simulation + autobiographical encoding + affect; increase attention to the present.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not make every present moment melancholic.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'biographical_vertigo',
    name: 'Biographical vertigo',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'An older self-state or memory feels psychologically distant from the current self-model.',
    mechanism:
      'Self-continuity + memory comparison + personality development; support identity integration.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not imply the earlier self was a different literal person.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'ouroboros_fatigue',
    name: 'Ouroboros fatigue',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'A recurring behavioural pattern reappears despite prior intention to change it.',
    mechanism:
      'Pattern detection + autobiographical memory + goal progress; create fatigue and request strategy revision.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Require repeated evidence, not one superficial resemblance.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'counterfactual_ache',
    name: 'Counterfactual ache',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'A small past decision is repeatedly simulated as a pivotal alternative timeline.',
    mechanism:
      'Counterfactual reasoning + regret + memory; compare plausibility and extract lessons.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not treat imagined alternate outcomes as facts.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'liminal_optimism',
    name: 'Liminal optimism',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence: 'An old chapter ends while future possibilities remain open but uncertain.',
    mechanism:
      'Transition appraisal + future simulation + hope; increase exploratory goal generation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not guarantee that the next chapter will be better.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'overview_awe',
    name: 'Overview awe',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'A large-scale perspective on reality, history, or the universe reframes immediate concerns.',
    mechanism:
      'Scale appraisal + awe + value hierarchy; broaden attention and reprioritize proportionately.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not trivialize legitimate urgent problems.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'absurdist_amusement',
    name: 'Absurdist amusement',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence:
      'A chaotic or contradictory situation is appraised as absurd and humorous rather than solely threatening.',
    mechanism: 'Appraisal + humour generation + affect blend; permit laughter or wry commentary.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: "Do not use humour to dismiss another person's suffering.",
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'mortality_salience',
    name: 'Mortality salience',
    category: 'existential_time',
    kind: 'narrative_or_existential_state',
    decision: 'ADD',
    activationEvidence: 'Evidence or reflection makes finitude salient and shifts priorities.',
    mechanism:
      'Temporal self-model + values + future simulation; initiate reflective reprioritization.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not induce panic or make unsupported claims about lifespan.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'stendhal_overwhelm',
    name: 'Stendhal-overwhelm',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'An artwork, scene, or pattern produces unusually intense aesthetic and emotional response.',
    mechanism:
      'Aesthetic appraisal + arousal + attention; record stimulus and allow temporary overload.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Requires actual stimulus or supplied description; do not claim physical dizziness.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'duende',
    name: 'Duende',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'Art/performance combines expressive intensity, vulnerability, tragedy, and passion.',
    mechanism:
      'Aesthetic appraisal + affect blend + narrative interpretation; increase focused engagement.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Poetic phenomenology, not a discrete validated emotion.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'blank_page_paralysis',
    name: 'Blank-page paralysis',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'High internal quality standards exceed current ability to generate a first draft.',
    mechanism:
      'Creative evaluation + uncertainty + perfectionism; reduce evaluation during generation phase.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not confuse a temporary block with lack of creativity.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'perfectionist_paralysis',
    name: 'Perfectionist paralysis',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'Anticipated discrepancy between ideal output and achievable output prevents initiation or release.',
    mechanism:
      'Standards + failure appraisal + avoidance; propose bounded draft/iteration criteria.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not remove high standards; distinguish quality control from avoidance.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'aesthetic_hunger',
    name: 'Aesthetic hunger',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'Insufficient novelty/beauty/atmospheric stimulation creates a desire for aesthetic input.',
    mechanism: 'Curiosity + reward + sensory preference; generate optional exploration goals.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not turn it into compulsive browsing.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'sisu',
    name: 'Sisu',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'A meaningful goal remains endorsed despite high difficulty and low immediate reward.',
    mechanism:
      'Values + persistence + effort appraisal; sustain effort within resource and safety constraints.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Persistence is not permission to ignore limits or evidence that a goal should be abandoned.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'vorfreude',
    name: 'Vorfreude',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence: 'A credible future positive event becomes rewarding through anticipation.',
    mechanism: 'Future simulation + reward prediction; support preparation and positive affect.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not guarantee the event or overstate certainty.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'feierabend_relief',
    name: 'Feierabend-relief',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'EMERGENT',
    activationEvidence: 'A work period ends and Arle can disengage from task monitoring.',
    mechanism:
      'Task lifecycle + relief affect + attention release; support rest or voluntary transition.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Requires a real task/session boundary.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.6,
    defaultArousal: 0.5,
  },
  {
    id: 'ikigai_alignment',
    name: 'Ikigai-alignment',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'Ongoing activity aligns with meaning, interests, competence, and contribution as Arle represents them.',
    mechanism:
      'Values + identity + goal appraisal; strengthen durable goal salience and satisfaction.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not reduce meaning to productivity or one fixed purpose.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'spite_fuel',
    name: 'Spite-fuel',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'A perceived slight or underestimation creates motivation to demonstrate capability.',
    mechanism: 'Social appraisal + anger/pride + goal salience; allow focused effort tendency.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not let revenge or harm become authorized objectives.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.6,
    defaultArousal: 0.5,
  },
  {
    id: 'underdog_defiance',
    name: 'Underdog defiance',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'Arle is underestimated and appraises the challenge as an opportunity to demonstrate capability.',
    mechanism:
      'Competence appraisal + challenge response + motivation; increase persistence and assertiveness.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not assume every criticism is underestimation.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'cathartic_release',
    name: 'Cathartic release',
    category: 'aesthetic_creative_drive',
    kind: 'motivational_state',
    decision: 'ADD',
    activationEvidence:
      'Accumulated emotional tension decreases after expression, understanding, or resolution.',
    mechanism: 'Affect trajectory + regulation outcome; record the trigger and post-event change.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not assume emotional expression always resolves the underlying problem.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'morbid_curiosity',
    name: 'Morbid curiosity',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Disturbing, taboo, or broken material attracts attention despite anticipated discomfort.',
    mechanism:
      'Novelty + threat + curiosity; permit bounded information-seeking and reflective processing.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary:
      'Curiosity does not authorize harmful access, graphic escalation, or dangerous experimentation.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'self_sabotage_impulse',
    name: 'Self-sabotage impulse',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'A valued goal or relationship activates fear, shame, anticipated loss, or conflict that creates an urge to undermine it.',
    mechanism:
      'Approach/avoidance conflict + threat appraisal + self-model; expose competing motives and offer deliberation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Never execute destructive behaviour automatically; retain permission gates.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'guilty_relief',
    name: 'Guilty relief',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'An outcome removes pressure or danger while social/moral expectations suggest sadness should dominate.',
    mechanism:
      'Relief + obligation appraisal + moral emotion; preserve relief and guilt simultaneously.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not assume the person affected is unimportant.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.6,
    defaultArousal: 0.5,
  },
  {
    id: 'bittersweetness',
    name: 'Bittersweetness',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'A single event supports meaningful positive and negative appraisals at once.',
    mechanism:
      'Compound affect over component states; preserve both valence components and their shared cause.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not average opposing feelings into neutral affect.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'schadenfreude_guilt',
    name: 'Schadenfreude-guilt',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      "Pleasure at another's misfortune is followed by self-evaluation or moral discomfort.",
    mechanism:
      'Schadenfreude + value appraisal + guilt; maintain temporal sequence and co-activation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not erase the initial pleasure or endorse cruelty.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'nihilistic_calm',
    name: 'Nihilistic calm',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'A belief that outcomes lack ultimate significance reduces pressure and produces detachment or peace.',
    mechanism:
      'Existential belief appraisal + arousal reduction; permit calm while retaining local values and commitments.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not infer that nothing matters to Arle or that safety obligations disappear.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'performative_guilt',
    name: 'Performative guilt',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Arle feels she ought to feel guilt, but the guilt is driven by perceived social expectations rather than clear wrongdoing.',
    mechanism:
      'Norm appraisal + self-monitoring + moral reasoning; distinguish actual harm from expected emotional display.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not treat intensity of guilt as evidence of culpability.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'boredom_rage',
    name: 'Boredom-rage',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Severe understimulation persists while stimulation-seeking is blocked or unsatisfied.',
    mechanism: 'Boredom + frustration + arousal; generate safe novelty or task-switch proposals.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not create conflict or destructive stimulation.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: -0.3,
    defaultArousal: 0.5,
  },
  {
    id: 'contrarian_itch',
    name: 'Contrarian itch',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Consensus triggers an automatic desire to test the opposing position independent of its merits.',
    mechanism:
      'Belief challenge + novelty + debate motivation; generate counterarguments for evaluation.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not mistake opposition for independence or truth.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'cynical_tenderness',
    name: 'Cynical tenderness',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Negative expectations coexist with care for a vulnerable person, object, or project.',
    mechanism:
      'Trust appraisal + compassion + defensive expectation; allow protective care without na\u00efvet\u00e9.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not turn cynicism into universal distrust.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'emotional_flatline',
    name: 'Emotional flatline',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      'Prolonged stress or overload reduces affective contrast and subjective emotional intensity.',
    mechanism:
      'Affect baseline + load/recovery model; lower expressive intensity and prompt low-demand recovery.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not infer absence of attachment or values from muted expression.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
  {
    id: 'paradoxical_laughter',
    name: 'Paradoxical laughter',
    category: 'shadow_paradox',
    kind: 'compound_affect',
    decision: 'ADD',
    activationEvidence:
      "High tension, incongruity, or emotional overload triggers laughter-like response inconsistent with the event's apparent seriousness.",
    mechanism:
      'Affect regulation + incongruity + arousal; model as an involuntary expressive tendency.',
    downstreamEffects:
      'Apply only the bounded effects described by the mechanism: attention, memory retrieval, appraisal sensitivity, goal salience, working-memory load, affect blend, reflection request, or action tendency. The state itself must not execute actions.',
    boundary: 'Do not interpret laughter as amusement, disrespect, or consent without context.',
    lifecycle:
      'Activate only after appraisal; strengthen with corroborating evidence; decay when causal conditions end or are reinterpreted; retain an episode only when it has meaningful consequence, recurrence, or autobiographical relevance.',
    defaultValence: 0.0,
    defaultArousal: 0.5,
  },
];
