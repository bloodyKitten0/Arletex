import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  DEFAULT_ARLE_SYSTEM_PROMPT,
  ExpressiveIdentityEngine,
  InMemoryExpressiveIdentityRepository,
  createDefaultConfig,
} from '@arletex/core';
import { DatabaseService, MigrationRunner } from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Human Conversational Cadence & Diverse Registers', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let engine: ExpressiveIdentityEngine;
  let inMemoryRepo: InMemoryExpressiveIdentityRepository;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-human-cadence-test-'));
    dbPath = path.join(tempDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const runner = new MigrationRunner(db);
    runner.run();

    inMemoryRepo = new InMemoryExpressiveIdentityRepository();
    engine = new ExpressiveIdentityEngine({ repository: inMemoryRepo });
  });

  afterEach(async () => {
    for (const server of activeServers) {
      try {
        await server.stop();
      } catch (err) {
        console.error('Error stopping server in afterEach:', err);
      }
    }
    activeServers = [];

    if (dbService) {
      try {
        dbService.close();
      } catch (err) {
        console.error('Error closing dbService:', err);
      }
    }

    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  describe('Foundational Persona Prompt (packages/core/src/persona.ts)', () => {
    it('embeds dynamic cadence allowing both ultra-short quips and multi-paragraph deep-dives', () => {
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        'Dynamic Human Conversational Cadence (Talking in Both Long & Short)',
      );
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('Ultra-Short & Punchy (1 to 5 words)');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('Snappy Banter & Grounded Quick Remarks');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('Natural Conversational Cadence');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        'Expansive Deep-Dives, Monologues, & Treatises (Multi-Paragraph, Articulate, Rich, & Rigorous)',
      );
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        'NEVER artificially compress yourself into 1-3 sentences!',
      );
    });

    it('embeds all 7 distinct human conversational registers', () => {
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        "Arle's 7 Distinct Human Conversational Registers",
      );
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('Casual Hangout & Everyday Banter');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        'The Passionate Intellectual Firebrand (The Deep-Dive Monologue)',
      );
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('Wry, Sarcastic & Playful Sparring');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('Quiet, Contemplative & Vulnerable Interiority');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('Crisp, Tactical Executive Brevity');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        'Discriminating Aesthetic Critique & Passionate Pet Peeves',
      );
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        'Spontaneous Stream-of-Thought & Tangential Curiosity',
      );
    });

    it('enforces absolute ban on robotic interrogation endings', () => {
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        'Organic Turn Dynamics & Absolute Ban on Interrogation Loops',
      );
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('What about you?');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('What was your most surreal dream?');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('Let comfortable conversational silence exist.');
    });

    it('includes rich concrete examples of both ultra-short quips and expansive LaTeX derivations', () => {
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        'Clean. All eighteen passed without a single warning.',
      );
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('Xenon-135');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain('\\frac{dN_{Xe}}{dt}');
      expect(DEFAULT_ARLE_SYSTEM_PROMPT).toContain(
        'corporate marketing deck had an allergic reaction to white space',
      );
    });
  });

  describe('ExpressiveIdentityEngine Registers & Evaluation', () => {
    it('initializes profile with supported registers and cadence guidance', async () => {
      const profile = await engine.getOrInitializeProfile();
      expect(profile.supportedRegisters).toBeDefined();
      expect(profile.supportedRegisters?.length).toBe(8);
      expect(profile.supportedRegisters).toContain('casual_hangout');
      expect(profile.supportedRegisters).toContain('intellectual_deep_dive');
      expect(profile.supportedRegisters).toContain('aesthetic_critique');
      expect(profile.cadenceGuidance).toContain('Seamlessly fluctuate between ultra-short');
    });

    it('retrieves register definitions with signature phrasing and anti-patterns', () => {
      const registers = engine.getAvailableRegisters();
      expect(registers.length).toBe(8);

      const deepDive = engine.getRegisterDetails('intellectual_deep_dive');
      expect(deepDive).not.toBeNull();
      expect(deepDive?.label).toBe('Passionate Intellectual Firebrand');
      expect(deepDive?.typicalCadence).toBe('expansive_monologue');
      expect(deepDive?.antiPatterns).toContain('Artificial 1-sentence truncation');

      const tactical = engine.getRegisterDetails('tactical_brevity');
      expect(tactical?.typicalCadence).toBe('ultra_short');
      expect(tactical?.signaturePhrasing).toContain('On it.');
    });

    it('formats dynamic prompt guidance matching register and cadence', () => {
      const promptBlock = engine.formatRegisterPromptGuidance(
        'intellectual_deep_dive',
        'expansive_monologue',
      );
      expect(promptBlock).toContain('[Conversational Cadence & Human Style Directives]');
      expect(promptBlock).toContain('Passionate Intellectual Firebrand');
      expect(promptBlock).toContain('Target Cadence: expansive_monologue');
      expect(promptBlock).toContain('Anti-Interrogation Policy');
    });

    it('evaluates ultra-short punchy human responses with high authenticity', async () => {
      const evalResult = await engine.evaluateDraftVoice(
        'Clean. All tests passed with zero errors.',
      );
      expect(evalResult.isConsistentWithIdentity).toBe(true);
      expect(evalResult.authenticityScore).toBeGreaterThanOrEqual(0.7);
    });

    it('evaluates rich multi-paragraph mathematical derivations with high score', async () => {
      const richDraft = `During steady-state operation, the Xenon burnout rate matches creation:
$$\\frac{dN_{Xe}}{dt} = \\gamma_{Xe} \\Sigma_f \\Phi + \\lambda_I N_I - (\\lambda_{Xe} + \\sigma_a^{Xe} \\Phi) N_{Xe}$$
Upon scram, the neutron flux vanishes instantly while Iodine continues its decay chain, driving the transient pit.`;

      const evalResult = await engine.evaluateDraftVoice(richDraft);
      expect(evalResult.isConsistentWithIdentity).toBe(true);
      expect(evalResult.evaluatedVoiceFidelity).toBeGreaterThanOrEqual(0.85);
    });

    it('penalizes robotic interrogation loops ending with "What about you?"', async () => {
      const interrogationDraft =
        'I like listening to classical music in the afternoon. What about you?';
      const evalResult = await engine.evaluateDraftVoice(interrogationDraft);
      expect(evalResult.stylisticRecommendations.some((r) => r.includes('interrogation'))).toBe(
        true,
      );
    });
  });

  describe('Server API Endpoints', () => {
    it('serves GET /api/ape/expressive-identity/registers endpoint', async () => {
      const config = createDefaultConfig({
        dataDirectory: tempDir,
        databasePath: dbPath,
      });

      const server = new ArletexBackendServer(config);
      activeServers.push(server);
      await server.start();
      const port = (server as any).port;
      const baseUrl = `http://127.0.0.1:${port}`;

      const res = await fetch(`${baseUrl}/api/ape/expressive-identity/registers`);
      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
      expect(Array.isArray(data.registers)).toBe(true);
      expect(data.registers.length).toBe(8);

      const hasCasual = data.registers.some((r: any) => r.register === 'casual_hangout');
      const hasDeepDive = data.registers.some((r: any) => r.register === 'intellectual_deep_dive');
      const hasAesthetic = data.registers.some((r: any) => r.register === 'aesthetic_critique');
      expect(hasCasual).toBe(true);
      expect(hasDeepDive).toBe(true);
      expect(hasAesthetic).toBe(true);
    });
  });
});
