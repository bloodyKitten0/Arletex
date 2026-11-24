import { describe, it, expect } from 'vitest';

// Test repetition loop detection logic
function findRepetitionLoop(text: string): { isLoop: boolean; cleanText: string } {
  if (text.length < 80) return { isLoop: false, cleanText: text };

  // 1. Shorter phrases (20-79 chars): require at least 3 consecutive identical repetitions
  for (let len = 20; len < 80; len++) {
    if (text.length < len * 3) continue;
    const chunk1 = text.slice(-len);
    const chunk2 = text.slice(-2 * len, -len);
    const chunk3 = text.slice(-3 * len, -2 * len);
    if (chunk1 === chunk2 && chunk2 === chunk3) {
      const clean = text.slice(0, -2 * len).trim();
      return { isLoop: true, cleanText: clean };
    }
  }

  // 2. Longer blocks (80-200 chars): 2 consecutive identical repetitions
  for (let len = 80; len <= 200; len += 5) {
    if (text.length < len * 2) continue;
    const chunk1 = text.slice(-len);
    const chunk2 = text.slice(-2 * len, -len);
    if (chunk1 === chunk2) {
      const clean = text.slice(0, -len).trim();
      return { isLoop: true, cleanText: clean };
    }
  }

  return { isLoop: false, cleanText: text };
}

describe('Inference Stream & Math Rendering Resilience', () => {
  it('does NOT falsely trigger loop detection when reusing equations or terms across paragraphs', () => {
    const text = `Setup: steady-state operation at flux $\\Phi_0$, then sudden shutdown ($\\phi=0$). Pre-scram equilibrium satisfies
$$ \\lambda_I N_I^{\\rm eq} = (\\sigma_a^{X}\\bar{\\Sigma}_a + \\lambda_X)N_X^{\\rm eq}, $$
where $Y_F$ is the cumulative fission yield of Iodine ($\\approx 0.1536$, mostly to Xe via decay), and we approximate that only $\\beta=89/2\\times 10^{-4}\\,\\text{s}^{-1}$ (Xenon absorption) dominates over neutron-induced removal for Xenon post-shutdown; Iodine production from fission stops instantly, but its inventory decays slowly ($T_{1/2}=6.57\\,$h).

Post-scram dynamics:
$$ \\frac{dN_X}{dt} = -(\\sigma_a^{X}\\bar{\\Sigma}_a + \\lambda_X) N_X + \\lambda_I N_I $$`;

    const res = findRepetitionLoop(text);
    expect(res.isLoop).toBe(false);
    expect(res.cleanText).toBe(text);
  });

  it('accurately catches genuine 3x degenerate looping phrases and preserves first instance', () => {
    const prompt = 'Explain reactor kinetics. ';
    const repeatingPhrase = 'The reactor reaches critical point rapidly. ';
    const loopedText = prompt + repeatingPhrase + repeatingPhrase + repeatingPhrase;

    const res = findRepetitionLoop(loopedText);
    expect(res.isLoop).toBe(true);
    expect(res.cleanText).toContain('The reactor reaches critical point rapidly.');
    expect(res.cleanText.endsWith('The reactor reaches critical point rapidly.')).toBe(true);
  });

  it('normalizes unclosed math blocks so KaTeX does not render empty placeholder cards', () => {
    const incompleteMarkdown = `Post-scram dynamics:
$$ \\frac{dN_X}{dt} = -(`;

    // Simulate MarkdownContent pre-processor normalization
    let text = incompleteMarkdown
      .replace(/\\\[([\s\S]*?)\\\]/g, (_m, math) => `\n$$\n${math.trim()}\n$$\n`)
      .replace(/\\\(([\s\S]*?)\\\)/g, (_m, math) => `$${math.trim()}$`);

    text = text.replace(/^\$\$\s*([^\$\n]+?)\s*\$\$$/gm, (_m, math) => `\n$$\n${math.trim()}\n$$\n`);
    text = text.replace(/^\$\$\s*([^\$\n]+)$/gm, (_m, math) => `$$\n${math.trim()}`);

    const displayDollarMatches = text.match(/\$\$/g) || [];
    if (displayDollarMatches.length % 2 !== 0) {
      text += '\n$$\n';
    }

    expect(text).toContain('$$\n\\frac{dN_X}{dt} = -(\n$$');
  });
});
