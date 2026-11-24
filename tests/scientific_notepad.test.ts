import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ScientificNotepadService } from '../apps/desktop/src/backend/scientificNotepadService.js';

describe('ScientificNotepadService', () => {
  let tempDir: string;
  let service: ScientificNotepadService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-notepad-test-'));
    service = new ScientificNotepadService(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('executes Python and SymPy calculations with exact symbolic output', async () => {
    const pythonCode = `
import sympy as sp
t, l_I, l_X = sp.symbols('t lambda_I lambda_X', positive=True)
# Derivative of Xenon concentration post-scram set to 0
# dN_X/dt = l_I * N_I0 * exp(-l_I * t) - l_X * N_X0 * exp(-l_X * t)
# When N_X0 = 0 (high flux approximation):
peak_time = sp.solve(l_I * sp.exp(-l_I * t) - l_X * sp.exp(-l_X * t), t)[0]
print("PeakTimeFormula:", peak_time)
`;

    const result = await service.executePython(pythonCode);
    expect(result.success).toBe(true);
    expect(result.output).toContain('PeakTimeFormula: -log(lambda_X/lambda_I)/(lambda_I - lambda_X)');
    expect(result.executionTimeMs).toBeGreaterThan(0);
  });

  it('handles syntax errors gracefully without throwing an uncaught exception', async () => {
    const brokenCode = `
def broken_syntax(
`;
    const result = await service.executePython(brokenCode);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/SyntaxError/);
  });

  it('persists notes and calculations to markdown notepad', async () => {
    await service.writeNote(
      'Bateman Decay Chain Truth',
      'Iodine-135 beta-decays to Xenon-135 with half-life 6.57h. Xenon-135 beta-decays to Cesium-135 with half-life 9.14h.',
    );

    const full = await service.getFullNotepad();
    expect(full).toContain('## [');
    expect(full).toContain('Bateman Decay Chain Truth');
    expect(full).toContain('Iodine-135 beta-decays to Xenon-135');

    const recent = await service.readRecentNotes(5);
    expect(recent).toContain('Bateman Decay Chain Truth');
  });
});
