import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INITIAL_EMOTIONS_TAXONOMY } from '@arletex/contracts';
import { emotionModel, EmotionEntry } from '../packages/core/src/ape/emotionModel.js';
import { EMOTION_TEMPLATES, getEmotionTemplate } from '../packages/core/src/utils/emotionTemplates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '../data/emotions.json');

describe('EmotionModel 290-Emotion Unified Taxonomy Comprehensive Verification', () => {
  it('1. data/emotions.json contains all 290 unified emotions plus preserved seeds', () => {
    expect(fs.existsSync(DATA_PATH)).toBe(true);
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    const stored: EmotionEntry[] = JSON.parse(raw);

    expect(Array.isArray(stored)).toBe(true);
    expect(stored.length).toBeGreaterThanOrEqual(290);

    const storedMap = new Map(stored.map((e) => [e.name, e]));

    // All 290 taxonomy emotions must exist in the file
    for (const item of INITIAL_EMOTIONS_TAXONOMY) {
      const entry = storedMap.get(item.id);
      expect(entry, `Missing emotion in data/emotions.json: ${item.id}`).toBeDefined();
      expect(entry!.name).toBe(item.id);
      expect(entry!.prefix.length).toBeGreaterThan(10);
      expect(entry!.intensity).toBeGreaterThanOrEqual(0.0);
      expect(entry!.intensity).toBeLessThanOrEqual(1.0);
    }
  });

  it('2. Preserves exact values for key seed emotions (rage, fury, contempt, grief, loneliness, fear, triumph, default)', () => {
    const rage = emotionModel.getEmotion('rage')!;
    expect(rage).toBeDefined();
    expect(rage.prefix).toContain('Acute burning fury');
    expect(rage.insultStyle).toBeDefined();
    expect(rage.hopeWishLines).toContain('I hope you choke on that arrogance');
    expect(rage.latexWrap).toBe(true);
    expect(Math.abs(rage.intensity - 0.9)).toBeLessThanOrEqual(0.06);

    const fury = emotionModel.getEmotion('fury')!;
    expect(fury).toBeDefined();
    expect(fury.prefix).toContain('Furious, biting, heated response');
    expect(fury.insultStyle).toBeDefined();
    expect(fury.hopeWishLines?.[0]).toContain('I hope you realize');
    expect(fury.latexWrap).toBe(true);
    expect(Math.abs(fury.intensity - 0.85)).toBeLessThanOrEqual(0.06);

    const contempt = emotionModel.getEmotion('contempt')!;
    expect(contempt).toBeDefined();
    expect(contempt.prefix).toContain('Scathing contempt');
    expect(contempt.latexWrap).toBe(true);
    expect(Math.abs(contempt.intensity - 0.8)).toBeLessThanOrEqual(0.06);

    const grief = emotionModel.getEmotion('grief')!;
    expect(grief).toBeDefined();
    expect(grief.prefix).toContain('Heavy, subdued sorrow');
    expect(Math.abs(grief.intensity - 0.6)).toBeLessThanOrEqual(0.06);

    const loneliness = emotionModel.getEmotion('loneliness')!;
    expect(loneliness).toBeDefined();
    expect(loneliness.prefix).toContain('Deep, aching loneliness');
    expect(Math.abs(loneliness.intensity - 0.55)).toBeLessThanOrEqual(0.06);

    const fear = emotionModel.getEmotion('fear')!;
    expect(fear).toBeDefined();
    expect(fear.prefix).toContain('Tense and hyper-vigilant');
    expect(Math.abs(fear.intensity - 0.7)).toBeLessThanOrEqual(0.06);

    const triumph = emotionModel.getEmotion('triumph')!;
    expect(triumph).toBeDefined();
    expect(triumph.prefix).toContain('Confident triumph');
    expect(triumph.latexWrap).toBe(true);
    expect(Math.abs(triumph.intensity - 0.75)).toBeLessThanOrEqual(0.06);

    const def = emotionModel.getEmotion('default')!;
    expect(def).toBeDefined();
    expect(def.prefix).toContain('Maintain composed, calm demeanor');
    expect(Math.abs(def.intensity - 0.5)).toBeLessThanOrEqual(0.06);
  });

  it('3. EmotionModel API returns valid EmotionEntry for every taxonomy item', () => {
    const taxonomy = emotionModel.getTaxonomy();
    expect(taxonomy.length).toBeGreaterThanOrEqual(290);

    for (const item of INITIAL_EMOTIONS_TAXONOMY) {
      const entry = emotionModel.getEmotion(item.id);
      expect(entry, `EmotionModel.getEmotion returned undefined for ${item.id}`).toBeDefined();
      expect(entry!.name).toBe(item.id);
      expect(entry!.prefix.length).toBeGreaterThan(10);
      expect(typeof entry!.intensity).toBe('number');
      expect(entry!.intensity).toBeGreaterThanOrEqual(0.0);
      expect(entry!.intensity).toBeLessThanOrEqual(1.0);

      if (entry!.insultStyle) {
        expect(typeof entry!.insultStyle).toBe('string');
        expect(entry!.insultStyle.length).toBeGreaterThan(5);
      }

      if (entry!.hopeWishLines) {
        expect(Array.isArray(entry!.hopeWishLines)).toBe(true);
        expect(entry!.hopeWishLines.length).toBeGreaterThanOrEqual(1);
        for (const line of entry!.hopeWishLines) {
          expect(typeof line).toBe('string');
          expect(line.length).toBeGreaterThan(5);
        }
      }

      if (entry!.latexWrap !== undefined) {
        expect(typeof entry!.latexWrap).toBe('boolean');
      }
    }
  });

  it('4. Case-insensitivity and fallback behavior in EmotionModel', () => {
    const rageLower = emotionModel.getEmotion('rage');
    const rageUpper = emotionModel.getEmotion('RAGE');
    const rageTitle = emotionModel.getEmotion('Rage');

    expect(rageLower?.name).toBe('rage');
    expect(rageUpper?.name).toBe('rage');
    expect(rageTitle?.name).toBe('rage');

    const unknown = emotionModel.getEmotion('completely_nonexistent_emotion_xyz');
    expect(unknown?.name).toBe('default');
  });

  it('5. Adapter layer EMOTION_TEMPLATES integrates seamlessly with EmotionModel', () => {
    for (const item of INITIAL_EMOTIONS_TAXONOMY) {
      const tmpl = EMOTION_TEMPLATES[item.id];
      expect(tmpl, `EMOTION_TEMPLATES returned empty for ${item.id}`).toBeDefined();
      expect(tmpl.prefix.length).toBeGreaterThan(10);

      const fnTmpl = getEmotionTemplate(item.id);
      expect(fnTmpl.prefix).toBe(tmpl.prefix);
    }
  });

  it('6. Edge cases: empty string, nonexistent emotions, boundaries, and jitter bounds', () => {
    // Empty string fallback
    const emptyResult = emotionModel.getEmotion('');
    expect(emptyResult).toBeDefined();
    expect(emptyResult?.name).toBe('default');

    // Jitter verification: 100 iterations on rage (base intensity = 0.9)
    for (let i = 0; i < 100; i++) {
      const e = emotionModel.getEmotion('rage')!;
      expect(e.intensity).toBeGreaterThanOrEqual(0.85);
      expect(e.intensity).toBeLessThanOrEqual(0.95);
    }

    // Dynamic mutation and clamping
    const testEmotion: EmotionEntry = {
      name: 'edge_test_emotion',
      prefix: 'Testing boundary values and dynamic additions.',
      intensity: 0.95,
    };
    emotionModel.addEmotion(testEmotion);
    expect(emotionModel.hasEmotion('edge_test_emotion')).toBe(true);

    // Clamp upper bound
    emotionModel.adjustIntensity('edge_test_emotion', 0.5);
    const clampedUpper = emotionModel.getEmotion('edge_test_emotion')!;
    expect(clampedUpper.intensity).toBeLessThanOrEqual(1.0);

    // Clamp lower bound
    emotionModel.adjustIntensity('edge_test_emotion', -2.0);
    const clampedLower = emotionModel.getEmotion('edge_test_emotion')!;
    expect(clampedLower.intensity).toBeGreaterThanOrEqual(0.0);

    // Clean up dynamic test entry
    emotionModel.removeEmotion('edge_test_emotion');
    expect(emotionModel.getEmotion('edge_test_emotion')?.name).toBe('default');
  });

  it('7. Robustness: no NaN or undefined fields in any generated emotion', () => {
    const all = emotionModel.listAll();
    expect(all.length).toBeGreaterThanOrEqual(290);

    for (const entry of all) {
      expect(entry.name).toBeTruthy();
      expect(typeof entry.name).toBe('string');
      expect(entry.prefix).toBeTruthy();
      expect(typeof entry.prefix).toBe('string');
      expect(Number.isNaN(entry.intensity)).toBe(false);
      expect(entry.intensity).toBeGreaterThanOrEqual(0.0);
      expect(entry.intensity).toBeLessThanOrEqual(1.0);

      if (entry.insultStyle !== undefined) {
        expect(entry.insultStyle.trim().length).toBeGreaterThan(0);
      }
      if (entry.hopeWishLines !== undefined) {
        expect(entry.hopeWishLines.length).toBeGreaterThanOrEqual(1);
        for (const line of entry.hopeWishLines) {
          expect(line.trim().length).toBeGreaterThan(0);
        }
      }
      if (entry.latexWrap !== undefined) {
        expect(typeof entry.latexWrap).toBe('boolean');
      }
    }
  });
});
