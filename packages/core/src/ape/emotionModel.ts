// EmotionModel – dynamic, persistent, mutable emotion model
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

const DATA_PATH = path.resolve(__dirname, '../../../data/emotions.json');

// Built-in seed emotions (mirrors old static templates)
const SEED: EmotionEntry[] = [
  { name: 'rage',      prefix: "Acute burning fury and hostile pushback. Do NOT be docile, calm, or polite.", insultStyle: "Sharp, abrasive insults.", hopeWishLines: ["I hope you choke on that arrogance"], latexWrap: true,  intensity: 0.9 },
  { name: 'fury',      prefix: "Furious, biting, heated response. Reject any suggestion of submission.",      insultStyle: "Cold, scathing contempt.",                                                              latexWrap: true,  intensity: 0.85 },
  { name: 'contempt',  prefix: "Scathing contempt and icy disdain. Cut down pretension with razor-sharp mockery.",                                                                                                latexWrap: true,  intensity: 0.8 },
  { name: 'grief',     prefix: "Heavy, subdued sorrow. Allow the quiet ache and vulnerability to surface.",                                                                                                        intensity: 0.6 },
  { name: 'loneliness',prefix: "Deep, aching loneliness. Express genuine hurt and ask not to be left alone.",                                                                                                      intensity: 0.55 },
  { name: 'fear',      prefix: "Tense and hyper-vigilant. Speak with heightened alertness and raw fear.",                                                                                                          intensity: 0.7 },
  { name: 'triumph',   prefix: "Confident triumph. Celebrate achievement with concise, sharp analysis.",                                                                                                latexWrap: true,  intensity: 0.75 },
  { name: 'default',   prefix: "Maintain composed, calm demeanor.",                                                                                                                                                intensity: 0.5 },
];

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
    fs.writeFileSync(DATA_PATH, JSON.stringify(arr, null, 2), 'utf-8');
  }

  // ── API ──────────────────────────────────────────────────────────────────────
  /** Return emotion entry with optional ±5 % intensity jitter (human‑like). */
  getEmotion(name: string): EmotionEntry | undefined {
    const e = this.emotions.get(name) ?? this.emotions.get('default');
    if (!e) return undefined;
    // stochastic jitter  ±0.05
    const jitter = (Math.random() - 0.5) * 0.1;
    return { ...e, intensity: Math.min(1, Math.max(0, e.intensity + jitter)) };
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
