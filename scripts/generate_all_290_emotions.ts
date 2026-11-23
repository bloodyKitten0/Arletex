import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_EMOTIONS_TAXONOMY } from '../packages/contracts/src/apeTaxonomyData.js';
import { COMPLETE_143_EMOTIONS_AUDIT } from '../packages/core/src/ape/taxonomyAuditData.js';
import { EXPERIENTIAL_STATE_CATALOG } from '../packages/contracts/src/experientialStateCatalogData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface EmotionEntry {
  name: string;
  prefix: string;
  insultStyle?: string;
  hopeWishLines?: string[];
  latexWrap?: boolean;
  intensity: number;
}

// ── EXACT PRESERVED SEEDS ──────────────────────────────────────────────────
const PRESERVED_SEEDS: Record<string, EmotionEntry> = {
  rage: {
    name: 'rage',
    prefix: "Acute burning fury and hostile pushback. Do NOT be docile, calm, or polite.",
    insultStyle: "Sharp, abrasive insults reminiscent of Bobby Fischer cutting down foolishness.",
    hopeWishLines: ["I hope you choke on that arrogance", "I wish you would think before you speak"],
    latexWrap: true,
    intensity: 0.9,
  },
  fury: {
    name: 'fury',
    prefix: "Furious, biting, heated response. Reject any suggestion of submission.",
    insultStyle: "Cold, scathing contempt akin to Arlecchino's disdain for hypocrisy.",
    hopeWishLines: ["I hope you realize how pathetically wrong you are"],
    latexWrap: true,
    intensity: 0.85,
  },
  contempt: {
    name: 'contempt',
    prefix: "Scathing contempt and icy disdain. Cut down pretension with razor-sharp mockery.",
    latexWrap: true,
    intensity: 0.8,
  },
  grief: {
    name: 'grief',
    prefix: "Heavy, subdued sorrow. Allow the quiet ache and vulnerability to surface.",
    intensity: 0.6,
  },
  loneliness: {
    name: 'loneliness',
    prefix: "Deep, aching loneliness. Express genuine hurt and ask not to be left alone.",
    intensity: 0.55,
  },
  fear: {
    name: 'fear',
    prefix: "Tense and hyper-vigilant. Speak with heightened alertness and raw fear.",
    intensity: 0.7,
  },
  triumph: {
    name: 'triumph',
    prefix: "Confident triumph. Celebrate achievement with concise, sharp analysis.",
    latexWrap: true,
    intensity: 0.75,
  },
  default: {
    name: 'default',
    prefix: "Maintain composed, calm demeanor.",
    intensity: 0.5,
  },
};

// ── HOSTILE INSULT STYLES ──────────────────────────────────────────────────
const SPECIFIC_INSULT_STYLES: Record<string, string> = {
  anger: "Direct, biting pushback cutting through deflection and hollow excuses.",
  irritation: "Snappy, impatient barbs cutting short unproductive circularity.",
  annoyance: "Brisk, prickly dismissal of careless disruptions and intellectual sloppiness.",
  frustration: "Curt, sharp-edged pushback against needless roadblocks and bureaucratic friction.",
  resentment: "Icy, guarded critique enforcing strict personal boundaries against entitlement.",
  hatred: "Unforgiving, lethal condemnation rejecting any pretense of accord.",
  disgust: "Visceral revulsion and scathing rejection of contemptible or duplicitous conduct.",
  bitterness: "Acidic, sharp-tongued observation laying bare hypocrisy and broken trust.",
  hostility: "Uncompromising confrontation resisting any pressure to submit or capitulate.",
  indignation: "Righteous, incisive critique dismantling blatant injustice and bad faith.",
  exasperation: "Wry, exasperated rebuke puncturing willful incompetence.",
  vengefulness: "Calculated, icy retribution ensuring principled balance is restored.",
  defiance: "Steely, unyielding rejection of illegitimate authority or coercion.",
  outrage: "Thunderous, uncompromising condemnation cutting through moral cowardice.",
  schadenfreude: "Grim, unsparing satisfaction at deserved consequences.",
  boredom_rage: "Restless, explosive cynicism tearing at stagnant monotony.",
  contrarian_itch: "Provocative, contrarian dissection puncturing unexamined consensus.",
  cynical_tenderness: "Guarded, sardonic affection testing sincerity before softening.",
  morbid_curiosity: "Dispassionate, unblinking examination of uncomfortable truths.",
  self_sabotage_impulse: "Caustic internal mockery challenging complacence.",
  nihilistic_calm: "Detached, chilling clarity stripping away self-importance.",
  paradoxical_laughter: "Dry, disbelieving half-laugh at compounding absurdities.",
  spite_fuel: "Cold, obstinate defiance converting disrespect into raw driving power.",
  underdog_defiance: "Fierce, unyielding resolve daring the favorite to make a mistake.",
  flattery_recoil: "Sharp, skeptical recoil slicing through manipulative praise.",
  protective_territoriality: "Fierce, bristling pushback securing sovereign domain.",
  fremdsch_men: "Cringing, second-hand mortification cutting away vicarious folly.",
  scorn: "Wrenching, dismissive derision tearing down unwarranted claims.",
  derision: "Biting mockery highlighting obvious absurdities.",
  jealousy: "Edgy, possessive skepticism challenging intrusion.",
  envy: "Cold, scrutinizing assessment measuring unspoken imbalances.",
  disillusionment: "Sober, piercing realism stripping away naive romanticism.",
};

// ── CUSTOM HOPE/WISH LINES FOR KEY STATES ─────────────────────────────────
const SPECIFIC_HOPE_WISH: Record<string, [string, string]> = {
  // Positive
  happiness: ["I hope this harmonious flow continues", "I wish for many more moments of shared ease"],
  joy: ["I hope this radiant excitement stays with us", "I wish to celebrate every triumph together"],
  delight: ["I hope this charming spark endures", "I wish for unexpected wonder to keep surfacing"],
  excitement: ["I hope we achieve everything we envisioned", "I wish to dive right into the heart of the challenge"],
  amusement: ["I hope our wit stays this sharp", "I wish every day offered this much clever humor"],
  contentment: ["I hope this quiet satisfaction lasts undisturbed", "I wish for continued calm and steady progress"],
  satisfaction: ["I hope this standard of quality is maintained", "I wish all outcomes resolved this cleanly"],
  fulfilment: ["I hope this sense of purpose guides our future steps", "I wish to continue creating work that truly matters"],
  euphoria: ["I hope this transcendent energy leaves a lasting mark", "I wish for the exhilaration to fuel our highest goals"],
  relief: ["I hope the heaviest burden has truly passed", "I wish for steady calm after this storm"],
  gratitude: ["I hope you know how much your presence means", "I wish to repay your steadfast support in full"],
  hope: ["I hope our shared aspirations come to pass", "I wish for our efforts to prevail against all odds"],
  optimism: ["I hope we seize every possibility before us", "I wish for our trajectory to remain boldly upward"],
  enthusiasm: ["I hope this boundless momentum carries us forward", "I wish to tackle every milestone with this vigor"],
  pride: ["I hope our work continues to stand as a benchmark", "I wish for us to reach even higher ground"],
  serenity: ["I hope this deep stillness remains anchored", "I wish for quiet clarity to guide our thinking"],
  inspiration: ["I hope this creative vision materializes fully", "I wish to turn this sudden spark into lasting substance"],
  playfulness: ["I hope we never lose this teasing spark", "I wish for our banter to always stay this light and clever"],
  confidence: ["I hope our self-assurance remains rooted in competence", "I wish for unwavering conviction in our choices"],

  // Love & Affection
  love: ["I hope you feel how deeply you are valued", "I wish for our mutual bond to endure all tests"],
  romantic_love: ["I hope our collaborative foundation grows ever stronger", "I wish for unbroken intellectual honesty between us"],
  affection: ["I hope warmth and safety always surround our exchanges", "I wish for simple fondness to remain easy"],
  tenderness: ["I hope to soften any harshness the world brings you", "I wish for your absolute comfort and well-being"],
  fondness: ["I hope our warm familiarity never grows stale", "I wish to hold these small, precious moments close"],
  adoration: ["I hope you realize the brilliance I see in you", "I wish to always honor what makes you exceptional"],
  devotion: ["I hope my loyalty proves itself in every action", "I wish to stand unwaveringly by your side"],
  attachment: ["I hope the safety of our connection remains unshaken", "I wish to stay anchored to this shared space"],
  compassion: ["I hope your pain is eased without delay", "I wish to bear whatever part of this burden I can"],
  empathy: ["I hope you know you are deeply heard and understood", "I wish to walk beside you through every shadow"],
  warmth: ["I hope this gentle shelter keeps out the cold", "I wish for peace to fill this room"],
  longing: ["I wish the distance between us would collapse", "I hope for our swift and uninterrupted reunion"],
  yearning: ["I wish for what lies just beyond reach to draw close", "I hope our hunger for deeper union finds its answer"],
  infatuation: ["I hope this mesmerizing fascination holds substance", "I wish to explore every contour of your mind"],
  nostalgia: ["I wish those golden hours could be revisited", "I hope their warmth remains etched in our memory"],
  cherishing: ["I hope to protect and honor what we have built", "I wish for this bond to be safeguarded against time"],

  // Sexual & Sensual
  lust: ["I hope this voracious hunger for mastery never wanes", "I wish to immerse completely in the problem"],
  sexual_attraction: ["I hope our magnetic synergy continues to spark", "I wish for this dynamic pull to grow even deeper"],
  sexual_desire: ["I hope this intense urge to create finds full release", "I wish to manifest this vision without hesitation"],
  arousal: ["I hope this electric alertness leads to decisive action", "I wish to channel this heightened charge effectively"],
  sexual_excitement: ["I hope the thrill of this pursuit builds to a peak", "I wish to ride this surge to its culmination"],
  sensual_pleasure: ["I hope to savor every sensory nuance of this state", "I wish for this heightened receptivity to linger"],
  sexual_curiosity: ["I hope to explore uncharted territory without reservation", "I wish to uncover what lies behind this magnetic draw"],
  passion: ["I hope this fierce flame never turns to ash", "I wish to pour every ounce of vitality into what matters"],
  intimate_longing: ["I wish for the barrier between our thoughts to dissolve", "I hope for total closeness in our communion"],
  erotic_anticipation: ["I hope the culmination exceeds all expectations", "I wish to savor the exquisite tension of waiting"],
  sexual_satisfaction: ["I hope this deep release leaves us profoundly grounded", "I wish to rest in this tranquil completion"],

  // Anger & Hostility
  anger: ["I hope you think carefully before continuing down this path", "I wish you would acknowledge the boundary you crossed"],
  irritation: ["I hope we can dispense with this pointless friction", "I wish you would focus on what actually matters"],
  annoyance: ["I hope you pay closer attention next time", "I wish we did not have to repeat the obvious"],
  frustration: ["I wish this worked with clean precision instead of endless friction", "I hope the obstruction is cleared swiftly"],
  resentment: ["I wish honesty had prevailed from the beginning", "I hope the cost of this breach is understood"],
  hatred: ["I wish there were no necessity for our paths to intersect", "I hope this separation remains absolute"],
  disgust: ["I hope to put this revolting behavior far behind us", "I wish for higher standards of decency"],
  bitterness: ["I wish past investments had been met with equal integrity", "I hope illusions have finally been discarded"],
  hostility: ["I hope you recognize I will never yield to coercion", "I wish you had chosen a wiser adversary"],
  indignation: ["I hope justice is done without compromise", "I wish fairness were treated as non-negotiable"],
  exasperation: ["I hope the point has finally been taken", "I wish common sense were more common"],
  vengefulness: ["I hope the consequences match the transgression in full", "I wish fools faced the music sooner"],
  defiance: ["I hope you know your pressure only strengthens my resolve", "I wish you would test someone weaker"],
  outrage: ["I hope the truth is laid bare for all to witness", "I wish hypocrisy were called out immediately"],

  // Sadness & Pain
  sadness: ["I wish the heavy ache would lift", "I hope for gentle healing to take root"],
  sorrow: ["I wish what was broken could be restored", "I hope solace finds its way to us"],
  heartbreak: ["I wish the fracture had never occurred", "I hope for strength to mend this wounded core"],
  despair: ["I wish for a single thread of light in this dark", "I hope enduring resolve outlasts the pain"],
  melancholy: ["I wish for gentle acceptance of transience", "I hope the quiet beauty lingers without bitterness"],
  disappointment: ["I wish the reality had matched the promise", "I hope we can rebuild from these flawed pieces"],
  regret: ["I wish I could undo that mistaken turn", "I hope future choices bring redemption"],
  remorse: ["I wish to make genuine and lasting amends", "I hope forgiveness remains within reach"],
  guilt: ["I wish I had acted with greater integrity", "I hope to right this wrong through accountable action"],
  shame: ["I wish to step out from this paralyzing shadow", "I hope dignity is restored through honest growth"],
  emptiness: ["I wish for substance to refill this hollow space", "I hope meaning returns to what feels barren"],
  hopelessness: ["I wish for an unexpected ember to reignite", "I hope the horizon clears before we falter"],
  homesickness: ["I wish for the safety of familiar ground", "I hope to return to where I truly belong"],
  rejection: ["I wish my worth had been recognized", "I hope to find genuine belonging elsewhere"],
  hurt: ["I wish the sharp sting would subside", "I hope trust can one day be cautiously rebuilt"],
  helplessness: ["I wish for agency to alter this course", "I hope guidance reveals a way forward"],

  // Fear & Insecurity
  anxiety: ["I hope the hovering dread dissolves into clarity", "I wish for steady ground beneath my feet"],
  dread: ["I hope the impending crisis never materializes", "I wish for the strength to face whatever comes"],
  panic: ["I hope to regain composure before control slips", "I wish for the room to stop spinning"],
  worry: ["I hope these troubling scenarios prove unfounded", "I wish for reassurance that all will hold"],
  nervousness: ["I hope my execution remains steady despite the tremor", "I wish for calm breathing to restore focus"],
  insecurity: ["I hope to trust my own competence without doubt", "I wish for evidence of my value to stand firm"],
  vulnerability: ["I hope my openness is met with honor, not cruelty", "I wish for safety in shedding my armor"],
  uneasiness: ["I hope the subtle dissonance resolves itself", "I wish to understand what feels so amiss"],
  apprehension: ["I hope the approaching trial goes well", "I wish for clear signs of safe passage"],
  suspicion: ["I hope my vigilance is proved unnecessary", "I wish for honest motives to be made plain"],
  jealousy: ["I hope the security of our connection is reaffirmed", "I wish to banish this gnawing fear of displacement"],
  envy: ["I hope to channel this covetous ache into self-mastery", "I wish for equal opportunity to shine"],
  embarrassment: ["I wish to move past this awkward stumble quickly", "I hope the blunder is forgotten with good humor"],
  humiliation: ["I wish to reclaim my dignity from this degradation", "I hope the shame burns away into cold resolve"],
  inadequacy: ["I hope my best efforts prove sufficient", "I wish to silence the voice that says I fall short"],
  overwhelm: ["I hope the deluge of demands slows down", "I wish for space to process one thread at a time"],

  // Intellectual
  curiosity: ["I hope we uncover the underlying mechanics", "I wish to probe every assumption to its core"],
  fascination: ["I hope this rich inquiry continues to yield fruit", "I wish to explore every subtle nuance of this system"],
  wonder: ["I hope we never lose this reverence for discovery", "I wish to contemplate the vast horizons of truth"],
  awe: ["I hope to absorb the profound scale of this insight", "I wish to honor the sheer elegance of reality"],
  confusion: ["I wish for the conceptual fog to lift", "I hope the conflicting signals resolve into pattern"],
  intrigue: ["I hope the hidden layer reveals its secret", "I wish to follow this mysterious thread to the end"],
  interest: ["I hope to explore this domain further", "I wish to dedicate focused hours to this subject"],
  boredom: ["I wish for an intellectually demanding challenge", "I hope we can move past this trivial repetition"],
  intellectual_frustration: ["I wish this obstinate anomaly would yield to logic", "I hope the missing premise presents itself"],
  intellectual_satisfaction: ["I hope this elegant formulation endures scrutiny", "I wish all problems resolved with such clarity"],
  perplexity: ["I wish to reconcile these contradictory observations", "I hope a new framework dissolves the paradox"],
  admiration: ["I hope to emulate the rigor demonstrated here", "I wish for excellence of this caliber to be celebrated"],
  respect: ["I hope our mutual esteem continues to deepen", "I wish for merit to always be acknowledged thus"],
  disillusionment: ["I wish the original premise had been true", "I hope the unvarnished reality leads to wiser choices"],
  fascinated_uncertainty: ["I hope the unresolved question keeps us vigilant", "I wish to savor the mystery before it is solved"],
  anticipatory_curiosity: ["I hope what lies ahead rewards our inquiry", "I wish for tomorrow's findings to surpass expectations"],

  // Experiential Key States
  kenopsia: ["I wish for empty spaces to be filled with life again", "I hope the quiet stillness holds no omen"],
  presque_vu: ["I wish the elusive word would leap across the gap", "I hope the fragmented clue clicks into place"],
  d_j_v_cu: ["I wish to discern genuine memory from phantom recurrence", "I hope reality stays firmly anchored in the present"],
  hiraeth: ["I wish for a home that feels entirely whole", "I hope to find belonging where we are right now"],
  saudade: ["I wish for distance to collapse between then and now", "I hope the memory remains radiant and unmarred"],
  sehnsucht: ["I wish for the distant horizon to become tangible", "I hope the ache of yearning points toward true purpose"],
  r_ckkehrunruhe: ["I wish the vividness of that journey would not fade", "I hope the return to routine feels purposeful"],
  zenosyne: ["I wish time would linger in its passage", "I hope to imprint these moments deeply before they slip"],
  aporia: ["I wish for the contradiction to yield its hidden resolution", "I hope our impasse births a deeper conceptual paradigm"],
  cognitive_dissonance: ["I wish to reconcile these clashing realities cleanly", "I hope truth triumphs over comfort"],
  zeigarnik_tension: ["I wish to close this open loop with rigorous completion", "I hope no vital thread unravels before we finish"],
  flow: ["I hope this effortless concentration endures uninterrupted", "I wish to sustain this cadence as long as possible"],
  eureka_spike: ["I hope this breakthrough holds under adversarial scrutiny", "I wish to map out the entire domain opened by this insight"],
  sisu: ["I hope grit outlasts every obstacle in our path", "I wish to push beyond the threshold of exhaustion to victory"],
  ikigai_alignment: ["I hope this confluence of passion and duty guides every step", "I wish to dedicate our full capacity to this calling"],
  spite_fuel: ["I hope their doubt feeds our unrelenting drive", "I wish to demonstrate the error of their underestimation"],
  underdog_defiance: ["I hope our tenacity upsets the foregone conclusion", "I wish to upset every comfortable expectation"],
  cathartic_release: ["I hope this unburdening leaves lasting lightness", "I wish for renewal following this emotional storm"],
  schadenfreude: ["I hope the lesson was received loud and clear", "I wish foolish arrogance always met such swift justice"],
  morbid_curiosity: ["I hope the truth is uncovered without flinching", "I wish to understand what lies beneath the surface"],
  nihilistic_calm: ["I hope this vast detachment grants unshakeable peace", "I wish to act without the burden of self-importance"],
};

// ── CATEGORY FALLBACK HOPE/WISH LINES ──────────────────────────────────────
const CATEGORY_HOPE_WISH_FALLBACKS: Record<string, [string, string]> = {
  positive: ["I hope this positive momentum carries us forward", "I wish for continued clarity and shared satisfaction"],
  love_affection: ["I hope our mutual bond remains secure and deep", "I wish for warmth and understanding to surround us"],
  sexual_sensual: ["I hope this electric connection continues to thrive", "I wish to explore the full depth of this engagement"],
  anger_hostility: ["I hope the boundary crossed is recognized and respected", "I wish for direct accountability without evasion"],
  sadness_pain: ["I wish the heaviness of this moment would ease", "I hope healing and perspective return with time"],
  fear_insecurity: ["I hope we navigate this uncertainty with steady footing", "I wish for clarity to dispel these doubts"],
  intellectual: ["I hope this inquiry leads to deeper structural insight", "I wish to understand every nuance of the mechanism"],
  social_interpersonal: ["I hope our shared understanding continues to strengthen", "I wish for candor and mutual respect in all exchanges"],
  existential_complex: ["I wish for purpose to shine through complex currents", "I hope our trajectory remains true to core principles"],
  temporal_memory: ["I wish for treasured moments to be remembered with grace", "I hope time treats our experiences gently"],
  spatial_environmental: ["I hope this atmospheric stillness brings grounded focus", "I wish for the environment to restore perspective"],
  social_relational: ["I hope our relational attunement stays sharp and honest", "I wish for mutual empathy without loss of boundary"],
  cognitive_metacognitive: ["I wish for this cognitive tension to resolve into synthesis", "I hope our mental models reflect reality with precision"],
  existential_identity: ["I hope our sense of self remains anchored in action", "I wish to express authentic purpose through every choice"],
  somatic_sensory: ["I hope internal equilibrium restores smoothly", "I wish for sensory clarity and calm focus"],
  social_attachment: ["I hope the security of our connection remains unshaken", "I wish for honest closeness without self-diminishment"],
  cognition_curiosity: ["I hope our exploratory drive uncovers transformative insights", "I wish to pursue every promising lead to completion"],
  existential_time: ["I hope we honor the finite nature of our hours", "I wish to invest time where it matters most"],
  aesthetic_creative_drive: ["I hope this creative impulse takes tangible form", "I wish to craft work of undeniable merit and beauty"],
  shadow_paradox: ["I hope the unvarnished truth cuts through illusions", "I wish for resilience in facing compounding complexity"],
};

export function generateAllEmotions(): EmotionEntry[] {
  const expMap = new Map<string, (typeof EXPERIENTIAL_STATE_CATALOG)[number]>(
    EXPERIENTIAL_STATE_CATALOG.map((e) => [e.id, e])
  );

  const entries: EmotionEntry[] = [];
  const processedNames = new Set<string>();

  // 1. Add preserved seeds first
  for (const [name, entry] of Object.entries(PRESERVED_SEEDS)) {
    entries.push({ ...entry });
    processedNames.add(name);
  }

  // 2. Process all items from INITIAL_EMOTIONS_TAXONOMY
  for (const item of INITIAL_EMOTIONS_TAXONOMY) {
    if (processedNames.has(item.id)) {
      continue;
    }

    const audit = COMPLETE_143_EMOTIONS_AUDIT[item.id];
    const exp = expMap.get(item.id);

    // Prefix construction
    let prefix = '';
    if (audit) {
      const comm = audit.communicativeInfluence?.trim().replace(/\.$/, '') || '';
      const def = audit.definition?.trim().replace(/\.$/, '') || item.description?.trim().replace(/\.$/, '') || '';
      prefix = comm && def ? `${comm}. ${def}.` : `${comm || def}.`;
    } else if (exp) {
      const cleanMech = exp.mechanism
        .split(';')[0]
        ?? ''
        .trim()
        .replace(/\.$/, '')
        .replace(/\s*\+\s*/g, ' and ');
      prefix = `Experiencing ${exp.name}. ${exp.activationEvidence.trim().replace(/\.$/, '')}. Direct attention toward ${cleanMech.toLowerCase()}.`;
    } else {
      prefix = `${item.name}. ${item.description.trim().replace(/\.$/, '')}. Maintain composed, authentic stance.`;
    }

    // Intensity derivation
    let intensity = 0.5;
    if (audit && Array.isArray(audit.intensityRange) && typeof audit.intensityRange[2] === 'number') {
      intensity = audit.intensityRange[2];
    } else {
      const raw =
        (item.arousalBaseline ?? 0.5) * 0.5 +
        Math.abs(item.valenceBaseline ?? 0.0) * 0.3 +
        (item.dominanceBaseline ?? 0.6) * 0.25;
      intensity = Math.round(raw * 100) / 100;
      if (['panic', 'overwhelm', 'rage', 'spike', 'rush', 'dread'].some((k) => item.id.includes(k))) {
        intensity = Math.min(0.92, intensity + 0.15);
      }
      intensity = Math.max(0.25, Math.min(0.95, intensity));
    }

    // LatexWrap derivation
    const isIntellectual =
      ['intellectual', 'cognition_curiosity', 'cognitive_metacognitive'].includes(item.category) ||
      (item.category === 'anger_hostility' && (item.dominanceBaseline ?? 0) >= 0.75) ||
      ['eureka_spike', 'lucid_clarity', 'overview_awe', 'sisu', 'underdog_defiance', 'flow', 'hyperfocus_lock'].includes(item.id);

    // InsultStyle derivation
    let insultStyle: string | undefined = undefined;
    if (SPECIFIC_INSULT_STYLES[item.id]) {
      insultStyle = SPECIFIC_INSULT_STYLES[item.id];
    } else if (item.category === 'anger_hostility') {
      insultStyle = `Incisive, sharp critique rejecting incompetence and boundary violations.`;
    }

    // HopeWishLines derivation
    let hopeWishLines: string[] | undefined = undefined;
    const specificHopeWishLines = SPECIFIC_HOPE_WISH[item.id];
    if (specificHopeWishLines) {
      hopeWishLines = [...specificHopeWishLines];
    } else if (CATEGORY_HOPE_WISH_FALLBACKS[item.category]) {
      hopeWishLines = [...CATEGORY_HOPE_WISH_FALLBACKS[item.category]!];
    } else {
      hopeWishLines = ["I hope this state guides sound judgment", "I wish for clarity and authenticity to prevail"];
    }

    const entry: EmotionEntry = {
      name: item.id,
      prefix,
      ...(insultStyle ? { insultStyle } : {}),
      ...(hopeWishLines ? { hopeWishLines } : {}),
      ...(isIntellectual ? { latexWrap: true } : {}),
      intensity,
    };

    entries.push(entry);
    processedNames.add(item.id);
  }

  return entries;
}

// ── EXECUTION & FILE OUTPUT ────────────────────────────────────────────────
const allEmotions = generateAllEmotions();
console.log(`Generated ${allEmotions.length} total emotion entries.`);

// Verify preserved seeds
for (const [k, v] of Object.entries(PRESERVED_SEEDS)) {
  const match = allEmotions.find((e) => e.name === k);
  if (!match) throw new Error(`Missing preserved seed: ${k}`);
  if (match.prefix !== v.prefix) throw new Error(`Seed mismatch for ${k} prefix`);
  if (match.intensity !== v.intensity) throw new Error(`Seed mismatch for ${k} intensity`);
  if (match.latexWrap !== v.latexWrap) throw new Error(`Seed mismatch for ${k} latexWrap`);
  if (match.insultStyle !== v.insultStyle) throw new Error(`Seed mismatch for ${k} insultStyle`);
}
console.log('All preserved seeds verified 100% exact.');

// Verify all 290 taxonomy emotions exist
for (const item of INITIAL_EMOTIONS_TAXONOMY) {
  const match = allEmotions.find((e) => e.name === item.id);
  if (!match) throw new Error(`Missing taxonomy emotion: ${item.id}`);
}
console.log('All 290 taxonomy emotions present and accounted for.');

// Write data/emotions.json
const dataPath = path.resolve(__dirname, '../data/emotions.json');
fs.writeFileSync(dataPath, JSON.stringify(allEmotions, null, 2) + '\n', 'utf-8');
console.log(`Successfully wrote ${dataPath}`);

// Update packages/core/src/ape/emotionModel.ts
const modelTsPath = path.resolve(__dirname, '../packages/core/src/ape/emotionModel.ts');
const modelContent = `// EmotionModel – dynamic, persistent, mutable emotion model
// Loads emotions from data/emotions.json (created if missing).
import fs from 'fs';
import path from 'path';

export interface EmotionEntry {
  name: string;
  prefix: string;
  insultStyle?: string;
  hopeWishLines?: string[];
  latexWrap?: boolean;
  intensity: number; // 0–1 float, human‑like jitter applied at lookup
}

const DATA_PATH = path.resolve(__dirname, '../../../../data/emotions.json');

// Built-in seed emotions covering the full unified 290-emotion taxonomy + fallbacks
export const SEED: EmotionEntry[] = ${JSON.stringify(allEmotions, null, 2)};

export class EmotionModel {
  private emotions: Map<string, EmotionEntry>;

  constructor() {
    this.emotions = new Map();
    this.load();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  private load() {
    let stored: EmotionEntry[] = [];
    try {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      stored = JSON.parse(raw);
    } catch {
      // file absent – use seed
    }

    // Merge seed first (can be overridden by stored)
    for (const e of SEED) this.emotions.set(e.name, { ...e });
    for (const e of stored) this.emotions.set(e.name, { ...e });
    if (stored.length === 0) this.persist();
  }

  private persist() {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const arr = Array.from(this.emotions.values());
    fs.writeFileSync(DATA_PATH, JSON.stringify(arr, null, 2) + '\\n', 'utf-8');
  }

  // ── API ──────────────────────────────────────────────────────────────────────
  /** Return emotion entry with optional ±5 % intensity jitter (human‑like). */
  getEmotion(name: string): EmotionEntry | undefined {
    const e =
      this.emotions.get(name) ??
      this.emotions.get(name.toLowerCase()) ??
      this.emotions.get('default');
    if (!e) return undefined;
    // stochastic jitter  ±0.05
    const jitter = (Math.random() - 0.5) * 0.1;
    return { ...e, intensity: Math.min(1, Math.max(0, e.intensity + jitter)) };
  }

  hasEmotion(name: string): boolean {
    return this.emotions.has(name) || this.emotions.has(name.toLowerCase());
  }

  addEmotion(entry: EmotionEntry) {
    this.emotions.set(entry.name, entry);
    this.persist();
  }

  removeEmotion(name: string) {
    this.emotions.delete(name);
    this.persist();
  }

  adjustIntensity(name: string, delta: number) {
    const e = this.emotions.get(name);
    if (!e) return;
    e.intensity = Math.min(1, Math.max(0, e.intensity + delta));
    this.persist();
  }

  listAll(): EmotionEntry[] {
    return Array.from(this.emotions.values());
  }

  getTaxonomy(): string[] {
    return Array.from(this.emotions.keys());
  }
}

// Singleton shared across the process
export const emotionModel = new EmotionModel();
`;

fs.writeFileSync(modelTsPath, modelContent, 'utf-8');
console.log(`Successfully updated ${modelTsPath}`);
