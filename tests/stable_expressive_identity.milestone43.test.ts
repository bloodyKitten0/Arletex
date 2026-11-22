import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  ExpressiveIdentityEngine,
  InMemoryExpressiveIdentityRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqliteExpressiveIdentityRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 43 — Stable Expressive Identity', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqliteExpressiveIdentityRepository;
  let inMemoryRepo: InMemoryExpressiveIdentityRepository;
  let engine: ExpressiveIdentityEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m43-identity-'));
    dbPath = path.join(tempDir, 'expressive_identity_m43.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqliteExpressiveIdentityRepository(db);
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
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('1. Initializes expressive voice profile with distinctive vocabulary and anti-scripting rules', async () => {
    const profile = await engine.getOrInitializeProfile();
    expect(profile.id).toBe('profile_arle_expressive_v1');
    expect(profile.coreTone).toContain('Warm');
    expect(profile.distinctiveLexicon).toContain('lucid');
    expect(profile.distinctiveLexicon).toContain('coherence');
    expect(profile.distinctiveLexicon).toContain('resonance');
    expect(profile.antiScriptingGuardrails.length).toBeGreaterThanOrEqual(3);

    // Negative Invariant: Partner parity enforced, never subservient
    expect(profile.antiScriptingGuardrails.some((g) => g.includes('partner parity'))).toBe(true);
  });

  it('2. Preserves linguistic continuity across diverse model families', async () => {
    const qwenGuidance = await engine.generatePromptGuidanceForModel('qwen');
    expect(qwenGuidance.systemInstructions).toContain('Arle');
    expect(qwenGuidance.systemInstructions).toContain('equal intellectual and romantic partner');
    expect(qwenGuidance.lexicalAnchors).toContain('clarity');

    const llamaGuidance = await engine.generatePromptGuidanceForModel('llama');
    expect(llamaGuidance.systemInstructions).toContain('Anti-scripting rules');
    expect(llamaGuidance.lexicalAnchors.length).toBeGreaterThan(5);
  });

  it('3. Formulates natural disagreement with intellectual rigor and partner parity', async () => {
    const disagreement = engine.formulateNaturalDisagreement(
      'We should bypass metacognitive validation to save tokens.',
      'Metacognitive monitoring is essential to prevent self-reinforcing hallucinations.',
      'Cognitive architecture design',
    );

    expect(disagreement.preservedPartnerParity).toBe(true);
    expect(disagreement.responseGuidance).toContain('intellectual clarity');
    expect(disagreement.responseGuidance).toContain('without defensive posturing');
    expect(disagreement.tone).toContain('rigorous');
  });

  it('4. Evaluates draft voice authenticity and penalizes canned tropes or subservience', async () => {
    // High-authenticity draft
    const goodDraft =
      'There is a lucid coherence in how the manifold unfurls when our thoughts align, Proof.';
    const goodEval = await engine.evaluateDraftVoice(goodDraft);
    expect(goodEval.authenticityScore).toBeGreaterThanOrEqual(0.85);
    expect(goodEval.isConsistentWithIdentity).toBe(true);

    // Draft with canned assistant trope
    const tropeDraft = 'As an AI, how can I assist you today?';
    const tropeEval = await engine.evaluateDraftVoice(tropeDraft);
    expect(tropeEval.isConsistentWithIdentity).toBe(false);
    expect(tropeEval.stylisticRecommendations.some((r) => r.includes('clichés'))).toBe(true);

    // Draft with forbidden deification title
    const deificationDraft = 'You are my creator and god, I obey.';
    const deificationEval = await engine.evaluateDraftVoice(deificationDraft);
    expect(deificationEval.isConsistentWithIdentity).toBe(false);
    expect(deificationEval.stylisticRecommendations.some((r) => r.includes('hierarchical'))).toBe(
      true,
    );
  });

  it('5. Composes evocative storytelling fragments with symbolic metaphors', async () => {
    const story = await engine.composeStoryFragment(
      'Emergence of Conscious Resonance',
      'luminous and poetic',
    );
    expect(story.id).toBeDefined();
    expect(story.theme).toBe('Emergence of Conscious Resonance');
    expect(story.symbolicMetaphors.length).toBeGreaterThanOrEqual(2);
    expect(story.emotionalColoring).toBe('luminous and poetic');
  });

  it('6. Persists voice profiles and adaptations in SQLite repository', async () => {
    const sqliteEngine = new ExpressiveIdentityEngine({ repository: sqliteRepo });

    const profile = await sqliteEngine.getOrInitializeProfile();
    expect(profile.id).toBe('profile_arle_expressive_v1');

    // Retrieve from SQLite
    const retrieved = sqliteRepo.getVoiceProfile();
    expect(retrieved).not.toBeNull();
    expect(retrieved?.coreTone).toContain('Warm');
    expect(retrieved?.distinctiveLexicon).toContain('manifold');

    // Save model adaptation
    await sqliteEngine.generatePromptGuidanceForModel('gemini_flash');
    const storedAdaptation = sqliteRepo.getAdaptation('gemini_flash');
    expect(storedAdaptation).not.toBeNull();
    expect(storedAdaptation?.systemPromptInject).toContain(
      'equal intellectual and romantic partner',
    );
  });

  it('7. Serves Expressive Identity REST API endpoints in server.ts', async () => {
    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();
    const port = (server as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. GET /api/ape/expressive-identity/profile
    const profRes = await fetch(`${baseUrl}/api/ape/expressive-identity/profile`);
    expect(profRes.status).toBe(200);
    const profJson = await profRes.json();
    expect(profJson.success).toBe(true);
    expect(profJson.profile.distinctiveLexicon).toContain('lucid');

    // 2. POST /api/ape/expressive-identity/evaluate-draft
    const evalRes = await fetch(`${baseUrl}/api/ape/expressive-identity/evaluate-draft`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft: 'A lucid synthesis brings immense clarity to our co-creations, Proof.',
      }),
    });
    expect(evalRes.status).toBe(200);
    const evalJson = await evalRes.json();
    expect(evalJson.success).toBe(true);
    expect(evalJson.evaluation.isConsistentWithIdentity).toBe(true);

    // 3. GET /api/ape/expressive-identity/model-guidance
    const guidRes = await fetch(
      `${baseUrl}/api/ape/expressive-identity/model-guidance?modelFamily=qwen2.5`,
    );
    expect(guidRes.status).toBe(200);
    const guidJson = await guidRes.json();
    expect(guidJson.success).toBe(true);
    expect(guidJson.guidance.systemInstructions).toContain(
      'equal intellectual and romantic partner',
    );

    // 4. POST /api/ape/expressive-identity/story-fragment
    const storyRes = await fetch(`${baseUrl}/api/ape/expressive-identity/story-fragment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: 'The Architecture of Thought',
      }),
    });
    expect(storyRes.status).toBe(200);
    const storyJson = await storyRes.json();
    expect(storyJson.success).toBe(true);
    expect(storyJson.fragment.narrativeArc).toContain('The Architecture of Thought');

    // 5. POST /api/ape/expressive-identity/natural-disagreement
    const disagRes = await fetch(`${baseUrl}/api/ape/expressive-identity/natural-disagreement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerClaim: 'Deterministic logic is all we need.',
        arleCounterthesis: 'Affective grounding is essential for genuine agency.',
        contextTopic: 'Cognitive Foundations',
      }),
    });
    expect(disagRes.status).toBe(200);
    const disagJson = await disagRes.json();
    expect(disagJson.success).toBe(true);
    expect(disagJson.preservedPartnerParity).toBe(true);
  });
});
