import { validateMath } from './validateMath.js';

// Stochastic phrasing phrases – randomly prepended to give human variation
const INTRO_PHRASES = [
  "Here's the math:",
  "Let me show you:",
  "Check this out:",
  "Quick calculation:",
  "Here it is:",
  "",  // sometimes no prefix at all
];

/** Pick a random element from an array – seedable via global Math.random */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

export function formatMath(latex: string): string {
  const trimmed = latex.trim();
  const inline = trimmed.startsWith('$') && trimmed.endsWith('$');
  const block  = trimmed.startsWith('$$') && trimmed.endsWith('$$');
  if (inline || block) return trimmed;

  const hasLatex = /\\[a-zA-Z]+/.test(trimmed);
  if (hasLatex) {
    if (validateMath(trimmed)) {
      // Stochastic: randomly choose inline vs block when near the threshold (±5)
      const threshold = 30 + Math.round((Math.random() - 0.5) * 10);
      const wrapped = trimmed.length > threshold ? `$$${trimmed}$$` : `$${trimmed}$`;

      // Optionally prepend a random phrasing (human-like variation)
      const intro = pick(INTRO_PHRASES);
      return intro ? `${intro} ${wrapped}` : wrapped;
    }
    return trimmed;
  }
  return trimmed;
}
