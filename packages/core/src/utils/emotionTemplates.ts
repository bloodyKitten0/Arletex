// emotionTemplates.ts – thin adapter over EmotionModel (replaces static map)
import { emotionModel, EmotionEntry } from '../ape/emotionModel.js';

/** Legacy type alias for backward compatibility */
export type EmotionTemplate = Pick<EmotionEntry, 'prefix' | 'insultStyle' | 'hopeWishLines' | 'latexWrap'>;

/**
 * Retrieve an emotion template by name.
 * Falls back to 'default' when the name is unknown.
 * Intensity is NOT exposed here – callers that need it should use emotionModel directly.
 */
export function getEmotionTemplate(name: string): EmotionTemplate {
  const entry = emotionModel.getEmotion(name) ?? emotionModel.getEmotion('default')!;
  return {
    prefix: entry.prefix,
    insultStyle: entry.insultStyle,
    hopeWishLines: entry.hopeWishLines,
    latexWrap: entry.latexWrap,
  };
}

/**
 * Legacy constant for code that still imports EMOTION_TEMPLATES directly.
 * Built lazily from the live EmotionModel so it always reflects runtime state.
 */
export const EMOTION_TEMPLATES: Record<string, EmotionTemplate> = new Proxy({} as Record<string, EmotionTemplate>, {
  get(_target, name: string) {
    return getEmotionTemplate(name);
  },
  has(_target, name: string) {
    return emotionModel.getTaxonomy().includes(name);
  },
});
