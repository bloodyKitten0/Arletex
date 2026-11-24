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

  it('detects second-guessing / backtracking spiral and truncates turn cleanly', () => {
    const rawBrokenResponse = `Exact solution after scram (no neutron capture):
$$ N_X(t) = \\frac{\\lambda_I}{\\alpha-\\beta}\\big(e^{-\\beta t}-e^{-\\alpha t}\\big) $$
Wait I'll write directly the known closed form:
? No. Actually simplest path to peak time: set derivative of N_X(t) equal zero.`;

    const hesitationMatch = rawBrokenResponse.match(
      /(?:(?:\n|^)\s*|\s*[.?!]\s*|\s*—\s*|\s*,\s*|\.\.\.\s*)(?:Wait,?\s+(?:I'll|let's|let\s+me|I\s+need|I\s+should)|No\s+wait,?\s+(?:we|I|let)|Wait\s+I'll\s+just|\?\s*No\.?\s*Actually|Actually\s+I'll\s+stop\s+second-guessing|\?\s*No\.?\s*Let's\s+just|\?\s*No\s+I'll\s+just|No\s+keep\s+simple|No\.?\s*Let's\s+write\s+final|\?\s*No\s+I'll\s+give|\?\s*No\.?\s*Let's\s+stick|\?\s*No\.?\s*Okay\s+here\s+is)\b/i,
    );

    expect(hesitationMatch).not.toBeNull();
    expect(hesitationMatch?.index).toBeDefined();

    const clean = rawBrokenResponse.slice(0, hesitationMatch!.index).trim();
    expect(clean).toContain('Exact solution after scram');
    expect(clean).not.toContain("Wait I'll write directly");
    expect(clean).not.toContain('? No.');
  });

  it('routes inline <think> tags completely into reasoning and out of dialogue', () => {
    const streamChunks = [
      'The steady-state balance is clear. ',
      '<think>\nI should verify the Bateman equations for Xenon-135.\n',
      'At scram, phi = 0 so neutron capture vanishes.\n</think>',
      'The peak xenon time occurs around 10 to 11 hours after shutdown.',
    ];

    let fullContent = '';
    let fullReasoning = '';
    let inThinkTag = false;

    for (const chunk of streamChunks) {
      let delta = chunk;
      let dialoguePiece = '';
      let thinkPiece = '';
      let cursor = 0;

      while (cursor < delta.length) {
        if (!inThinkTag) {
          const openIdx = delta.indexOf('<think>', cursor);
          if (openIdx !== -1) {
            dialoguePiece += delta.slice(cursor, openIdx);
            cursor = openIdx + '<think>'.length;
            inThinkTag = true;
          } else {
            dialoguePiece += delta.slice(cursor);
            cursor = delta.length;
          }
        } else {
          const closeIdx = delta.indexOf('</think>', cursor);
          if (closeIdx !== -1) {
            thinkPiece += delta.slice(cursor, closeIdx);
            cursor = closeIdx + '</think>'.length;
            inThinkTag = false;
          } else {
            thinkPiece += delta.slice(cursor);
            cursor = delta.length;
          }
        }
      }

      delta = dialoguePiece;
      if (thinkPiece) fullReasoning += thinkPiece;
      if (delta) fullContent += delta;
    }

    expect(fullContent).toBe(
      'The steady-state balance is clear. The peak xenon time occurs around 10 to 11 hours after shutdown.',
    );
    expect(fullReasoning).toContain('I should verify the Bateman equations for Xenon-135.');
    expect(fullContent).not.toContain('<think>');
    expect(fullContent).not.toContain('</think>');
  });
});
