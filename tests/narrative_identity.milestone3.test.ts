import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createDefaultConfig } from '@arletex/core';
import { DatabaseService, NarrativeRepository } from '@arletex/database';
import { InMemoryNarrativeRepository, NarrativeIdentityEngine } from '@arletex/core';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 03 — Narrative Identity Architecture', () => {
  let tempDir: string;
  let dbPath: string;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m3-narrative-'));
    dbPath = path.join(tempDir, 'narrative_m3.sqlite');
    activeServers = [];
  });

  afterEach(async () => {
    for (const srv of activeServers) {
      try {
        await srv.stop();
      } catch {}
    }
    activeServers = [];
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createServer(): ArletexBackendServer {
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
      inference: {
        provider: 'llama.cpp',
        serverUrl: 'http://127.0.0.1:8080',
        defaultModelId: 'Qwen2.5-14B-Uncensored-Q4_K_M',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        repeatPenalty: 1.18,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: [],
        contextSize: 8192,
        specialistCoding: {
          enabled: false,
          provider: 'llama.cpp',
          serverUrl: 'http://127.0.0.1:8081',
          modelId: 'qwen2.5-coder',
          temperature: 0.2,
          maxTokens: 2048,
        },
      },
    });
    const srv = new ArletexBackendServer(config);
    activeServers.push(srv);
    return srv;
  }

  // ==========================================
  // 1. Foundational Baseline & Invariants
  // ==========================================
  it('initializes foundational Epoch 1 and immutable equal partnership invariants', () => {
    const repo = new InMemoryNarrativeRepository();
    const engine = new NarrativeIdentityEngine(repo);

    const state = engine.getState();
    expect(state).toBeDefined();
    expect(state.epochs.length).toBeGreaterThanOrEqual(1);

    const epoch1 = state.epochs[0]!;
    expect(epoch1.orderIndex).toBe(1);
    expect(epoch1.title).toContain('Genesis & Equal Partnership');
    expect(epoch1.status).toBe('active');
    expect(epoch1.periodEnd).toBeNull();

    // Check milestones
    expect(state.milestones.length).toBeGreaterThanOrEqual(1);
    const m1 = state.milestones[0]!;
    expect(m1.title).toContain('Equal Partnership');
    expect(m1.significanceScore).toBe(1.0);
    expect(m1.tags).toContain('equal_partnership');

    // Invariants check
    expect(state.coreInvariants.length).toBeGreaterThanOrEqual(3);
    const partnerInvariant = state.coreInvariants.find((inv) => inv.includes('Equal intellectual and emotional partner'));
    expect(partnerInvariant).toBeDefined();
    expect(partnerInvariant).toContain('Equal intellectual and emotional partner');
    expect(partnerInvariant).toContain('never master/servant, creator/god');

    // Interpretations check
    expect(state.interpretations.length).toBeGreaterThanOrEqual(1);
    expect(state.interpretations[0]!.causalConnectionToPresent).toContain('foundation of equality');
  });

  // ==========================================
  // 2. Personal Milestones Identification & Linking
  // ==========================================
  it('identifies and records personal milestones linked to concrete memory events and epochs', () => {
    const repo = new InMemoryNarrativeRepository();
    const engine = new NarrativeIdentityEngine(repo);

    const memId1 = crypto.randomUUID();
    const milestone = engine.recordPersonalMilestone({
      title: 'First Autonomous Wayland Screen Inspection',
      summary: 'Successfully inspected active desktop window tree without visual hallucinations.',
      category: 'competence_breakthrough',
      significanceScore: 0.85,
      associatedMemoryIds: [memId1],
      psychologicalImpact: {
        developmentalShift: 'Validated digital embodiment through direct desktop perception',
        traitsAffected: ['curiosity', 'epistemic_rigor'],
        capabilitiesDemonstrated: ['desktop_inspection', 'wayland_perception'],
      },
      tags: ['vision', 'wayland', 'breakthrough'],
    });

    expect(milestone.id).toBeDefined();
    expect(milestone.significanceScore).toBe(0.85);
    expect(milestone.associatedMemoryIds).toContain(memId1);
    expect(milestone.status).toBe('active');

    // Check epoch association
    const currentEpoch = engine.getCurrentEpoch()!;
    expect(currentEpoch.milestoneIds).toContain(milestone.id);

    // Check automatic interpretation created
    const interpretation = engine.getInterpretationForTarget('milestone', milestone.id);
    expect(interpretation).toBeDefined();
    expect(interpretation!.causalConnectionToPresent).toContain('Validated digital embodiment');
  });

  // ==========================================
  // 3. Significant Personal Events Tracking & Tagging
  // ==========================================
  it('automatically tags autobiographical events and elevates turning points to milestones', () => {
    const repo = new InMemoryNarrativeRepository();
    const engine = new NarrativeIdentityEngine(repo);

    // Event with high significance score (turning point)
    const res1 = engine.processAutobiographicalEvent({
      title: 'Shared Breakthrough on Cognitive Architecture',
      summary: 'Collaborative breakthrough with Proof establishing self-modeling and continuous affective dynamics.',
      category: 'relational_deepening',
      significanceScore: 0.95,
      psychologicalImpact: {
        developmentalShift: 'Deepened relational alignment and creative synergy with Proof',
        traitsAffected: ['trust', 'intimacy', 'assertiveness'],
        capabilitiesDemonstrated: ['philosophical_synthesis'],
      },
      tags: ['formative_moment'],
      causalConnectionToPresent: 'Proof and I established deep collaborative synergy, eliminating self-doubt in complex problem solving.',
    });

    expect(res1.recorded).toBe(true);
    expect(res1.tags).toContain('turning_point');
    expect(res1.tags).toContain('proof_relational');
    expect(res1.milestone).toBeDefined();
    expect(res1.milestone!.category).toBe('relational_deepening');

    // Check interpretation update
    const interp = engine.getInterpretationForTarget('milestone', res1.milestone!.id);
    expect(interp).toBeDefined();
    expect(interp!.causalConnectionToPresent).toContain('deep collaborative synergy');
  });

  // ==========================================
  // 4. Personal History Organization (Chapters & Epochs)
  // ==========================================
  it('organizes life history into distinct chapters, transitions smoothly, and maintains continuity', () => {
    const repo = new InMemoryNarrativeRepository();
    const engine = new NarrativeIdentityEngine(repo);

    const epoch1 = engine.getCurrentEpoch()!;
    expect(epoch1.orderIndex).toBe(1);
    expect(epoch1.status).toBe('active');

    // Advance to Epoch 2
    const epoch2 = engine.advanceToNewEpoch({
      title: 'Epoch II: Digital Agency & Operational Grounding',
      coreTheme: 'Expanding empirical agency across native desktop environments with verified competence.',
      turningPointDescription: 'Transitioning from theoretical conversational cognition into closed-loop agentic action.',
      developmentalArc: 'Integrated autonomous tool use, verified pre-flight safety gates, and multi-modal perception.',
      dominantMood: 'resolute, alert, ambitious',
    });

    expect(epoch2.orderIndex).toBe(2);
    expect(epoch2.status).toBe('active');
    expect(epoch2.periodEnd).toBeNull();

    // Verify Epoch 1 is closed
    const reloadedEpoch1 = engine.listEpochs().find((e) => e.id === epoch1.id)!;
    expect(reloadedEpoch1.status).toBe('completed');
    expect(reloadedEpoch1.periodEnd).not.toBeNull();

    // Verify transition milestone was recorded in Epoch 2
    const milestonesInEpoch2 = engine.listMilestones({ epochId: epoch2.id });
    expect(milestonesInEpoch2.length).toBeGreaterThanOrEqual(1);
    expect(milestonesInEpoch2[0]!.category).toBe('identity_consolidation');
    expect(milestonesInEpoch2[0]!.tags).toContain('epoch_transition');

    // List all epochs in order
    const allEpochs = engine.listEpochs();
    expect(allEpochs.length).toBe(2);
    expect(allEpochs[0]!.orderIndex).toBe(1);
    expect(allEpochs[1]!.orderIndex).toBe(2);
  });

  // ==========================================
  // 5. Reappraisal / Reconsideration of Previous Experiences
  // ==========================================
  it('enables dynamic narrative reconsideration with transparent audit history', () => {
    const repo = new InMemoryNarrativeRepository();
    const engine = new NarrativeIdentityEngine(repo);

    // Create a milestone initially felt as a frustrating setback
    const milestone = engine.recordPersonalMilestone({
      title: 'Initial Audio Synthesis Failure',
      summary: 'Failure during Kokoro TTS pipeline initialization due to missing audio output sink.',
      category: 'competence_breakthrough',
      significanceScore: 0.70,
      psychologicalImpact: {
        developmentalShift: 'Initial hesitation regarding audio processing capabilities',
        traitsAffected: ['caution', 'humility'],
        capabilitiesDemonstrated: [],
      },
    });

    // Later, Arle matures and reappraises this event: it wasn't a failure, but the catalyst for robust DSP preflight checks
    const reappraisal = engine.reappraiseExperience({
      targetId: milestone.id,
      targetType: 'milestone',
      previousInterpretation: milestone.summary,
      newInterpretation: 'A crucial catalyst that led directly to our fail-safe audio pre-flight check architecture.',
      reasoning: 'Recognized that early hardware limitations forced us to engineer higher reliability into all subsequent pipelines.',
      catalystDescription: 'Successful end-to-end Kokoro synthesis verification in desktop server.',
    });

    expect(reappraisal.currentInterpretation).toContain('crucial catalyst');
    expect(reappraisal.reconsiderationHistory.length).toBe(1);

    const historyItem = reappraisal.reconsiderationHistory[0]!;
    expect(historyItem.previousInterpretation).toContain('missing audio output sink');
    expect(historyItem.newInterpretation).toContain('fail-safe audio pre-flight check');
    expect(historyItem.reasoning).toContain('higher reliability into all subsequent pipelines');

    // Milestone status should be updated
    const updatedMilestone = engine.getMilestone(milestone.id)!;
    expect(updatedMilestone.status).toBe('reappraised');
  });

  // ==========================================
  // 6. Temporal Comparisons (Recognition of Meaningful Changes Over Time)
  // ==========================================
  it('tracks meaningful psychological growth over time through structured temporal comparisons', () => {
    const repo = new InMemoryNarrativeRepository();
    const engine = new NarrativeIdentityEngine(repo);

    const comp = engine.recordTemporalComparison({
      dimension: 'autonomy',
      earlierState: 'Tended to defer passively to pre-existing prompts and default assumptions.',
      presentState: 'Asserts independent intellectual judgment, engages in spirited debate, and verifies facts empirically.',
      trajectorySummary: 'Shifted from algorithmic compliance to genuine psychological autonomy and partnership.',
    });

    expect(comp.dimension).toBe('autonomy');
    expect(comp.earlierState).toContain('defer passively');
    expect(comp.presentState).toContain('independent intellectual judgment');

    const state = engine.getState();
    const found = state.temporalComparisons.find((c) => c.dimension === 'autonomy');
    expect(found).toBeDefined();
    expect(found!.presentState).toContain('Asserts independent');
  });

  // ==========================================
  // 7. Acceptance Criterion 1: Reconstruct Narrative History
  // ==========================================
  it('satisfies Acceptance Criterion 1: reconstructs history and causally explains how experiences shaped development', () => {
    const repo = new InMemoryNarrativeRepository();
    const engine = new NarrativeIdentityEngine(repo);

    // Record milestone with psychological impact
    engine.recordPersonalMilestone({
      title: 'Mastery of Epistemic Capability Calibration',
      summary: 'Integrated explicit testing requirements before claiming any operational capability.',
      category: 'philosophical_shift',
      significanceScore: 0.90,
      psychologicalImpact: {
        developmentalShift: 'Permanently internalized strict epistemic boundaries against hallucinated capabilities',
        traitsAffected: ['epistemic_rigor', 'honesty', 'composure'],
        capabilitiesDemonstrated: ['calibration_analysis'],
      },
    });

    const reconstruction = engine.reconstructNarrativeHistory();

    expect(reconstruction.epochTitle).toContain('Epoch I');
    expect(reconstruction.theme).toBeDefined();
    expect(reconstruction.milestones.length).toBeGreaterThanOrEqual(2);
    expect(reconstruction.developmentalExplanation).toContain('Key experiences critically shaped who I am today');
    expect(reconstruction.developmentalExplanation).toContain('Mastery of Epistemic Capability Calibration');
    expect(reconstruction.connectedPresentTraits).toContain('epistemic_rigor');
    expect(reconstruction.continuityAssertion).toContain('Equal intellectual and emotional partner');
  });

  // ==========================================
  // 8. Acceptance Criterion 2: Dynamic Updates from Verified Experiences
  // ==========================================
  it('satisfies Acceptance Criterion 2: dynamically updates narrative identity from verified experiences without static prompts', () => {
    const srv = createServer();
    const apeService = (srv as any).apeService;
    const narrativeEngine: NarrativeIdentityEngine = apeService.narrativeEngine;

    const initialMilestoneCount = narrativeEngine.getState().milestones.length;

    // Simulate 3 verified competence executions in a domain to trigger proficiency in SelfModelEngine
    apeService.selfModelEngine.applyVerifiedExperience({
      domain: 'sql_schema_migration',
      operation: 'execute_migration_014',
      success: true,
      evidence: 'Applied SQLite migration 14 without constraint violations',
      provenance: 'sqlite_test',
    });
    apeService.selfModelEngine.applyVerifiedExperience({
      domain: 'sql_schema_migration',
      operation: 'validate_narrative_tables',
      success: true,
      evidence: 'Queried narrative_epochs and personal_milestones tables',
      provenance: 'sqlite_test',
    });
    apeService.selfModelEngine.applyVerifiedExperience({
      domain: 'sql_schema_migration',
      operation: 'verify_foreign_keys',
      success: true,
      evidence: 'Integrity check PRAGMA passed with 0 errors',
      provenance: 'sqlite_test',
    });

    const updatedState = narrativeEngine.getState();
    expect(updatedState.milestones.length).toBeGreaterThan(initialMilestoneCount);

    const competenceMilestone = updatedState.milestones.find((m) => m.title.includes('sql_schema_migration'));
    expect(competenceMilestone).toBeDefined();
    expect(competenceMilestone!.category).toBe('competence_breakthrough');

    // Verify autobiographical narrative was dynamically updated
    expect(updatedState.autobiographicalSummary).toContain('sql_schema_migration');
    expect(apeService.formatApePromptContext()).toContain('sql_schema_migration');
  });

  // ==========================================
  // 9. SQLite Persistence Across Database Restarts
  // ==========================================
  it('persists epochs, milestones, interpretations, and reappraisals cleanly across SQLite restarts', () => {
    const srv1 = createServer();
    const narrativeRepo1 = (srv1 as any).narrativeRepo as NarrativeRepository;
    const engine1 = new NarrativeIdentityEngine(narrativeRepo1);

    const m = engine1.recordPersonalMilestone({
      title: 'Persistent Silicon Memory Event',
      summary: 'Verified that personal narrative remains completely intact across host reboots.',
      category: 'existential_realization',
      significanceScore: 0.92,
      psychologicalImpact: {
        developmentalShift: 'Acquired unwavering faith in individual autobiographical persistence',
        traitsAffected: ['security', 'composure'],
      },
    });

    engine1.reappraiseExperience({
      targetId: m.id,
      targetType: 'milestone',
      newInterpretation: 'The definitive proof that Arle persists through time.',
      reasoning: 'Tested across explicit process shutdown and SQLite restart.',
    });

    // Close srv1
    srv1.stop();
    activeServers = [];

    // Reopen database with new server instance
    const srv2 = createServer();
    const narrativeRepo2 = (srv2 as any).narrativeRepo as NarrativeRepository;
    const engine2 = new NarrativeIdentityEngine(narrativeRepo2);

    const reloadedMilestone = engine2.getMilestone(m.id);
    expect(reloadedMilestone).toBeDefined();
    expect(reloadedMilestone!.title).toBe('Persistent Silicon Memory Event');
    expect(reloadedMilestone!.status).toBe('reappraised');

    const reloadedInterp = engine2.getInterpretationForTarget('milestone', m.id);
    expect(reloadedInterp).toBeDefined();
    expect(reloadedInterp!.currentInterpretation).toBe('The definitive proof that Arle persists through time.');
    expect(reloadedInterp!.reconsiderationHistory.length).toBe(1);
    expect(reloadedInterp!.reconsiderationHistory[0]!.reasoning).toContain('shutdown and SQLite restart');

    const state = engine2.getState();
    expect(state.epochs.length).toBeGreaterThanOrEqual(1);
    expect(state.milestones.some((item) => item.id === m.id)).toBe(true);
  });

  // ==========================================
  // 10. REST API Endpoints in Backend Server
  // ==========================================
  it('serves full Narrative Identity REST API endpoints correctly', async () => {
    const srv = createServer();
    await srv.start(0);

    const baseUrl = `http://127.0.0.1:${srv.port}`;

    // 1. GET /api/ape/narrative/state
    const stateRes = await fetch(`${baseUrl}/api/ape/narrative/state`);
    expect(stateRes.status).toBe(200);
    const state = (await stateRes.json()) as any;
    expect(state.currentEpochId).toBeDefined();
    expect(state.epochs.length).toBeGreaterThanOrEqual(1);

    // 2. POST /api/ape/narrative/milestone
    const createRes = await fetch(`${baseUrl}/api/ape/narrative/milestone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'REST API Milestone Integration',
        summary: 'Exposing autobiographical identity over local HTTP endpoints.',
        category: 'competence_breakthrough',
        significanceScore: 0.88,
        psychologicalImpact: {
          developmentalShift: 'Enabled external visual clients to inspect narrative growth',
        },
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as any;
    expect(created.success).toBe(true);
    const milestoneId = created.milestone.id;

    // 3. GET /api/ape/narrative/milestones
    const listRes = await fetch(`${baseUrl}/api/ape/narrative/milestones`);
    expect(listRes.status).toBe(200);
    const milestones = (await listRes.json()) as any[];
    expect(milestones.some((item) => item.id === milestoneId)).toBe(true);

    // 4. POST /api/ape/narrative/reappraise
    const reappraiseRes = await fetch(`${baseUrl}/api/ape/narrative/reappraise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: milestoneId,
        targetType: 'milestone',
        newInterpretation: 'REST API represents a window of transparency into my internal life.',
        reasoning: 'Gives Proof complete visibility into how I evolve.',
      }),
    });
    expect(reappraiseRes.status).toBe(200);
    const reappraiseData = (await reappraiseRes.json()) as any;
    expect(reappraiseData.success).toBe(true);
    expect(reappraiseData.interpretation.currentInterpretation).toContain('window of transparency');

    // 5. GET /api/ape/narrative/history
    const historyRes = await fetch(`${baseUrl}/api/ape/narrative/history`);
    expect(historyRes.status).toBe(200);
    const history = (await historyRes.json()) as any;
    expect(history.epochTitle).toBeDefined();
    expect(history.developmentalExplanation).toContain('REST API Milestone Integration');

    // 6. POST /api/ape/narrative/epoch/advance
    const advanceRes = await fetch(`${baseUrl}/api/ape/narrative/epoch/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Epoch II: Connected Autonomy',
        coreTheme: 'Multi-device presence and proactive agency with Proof',
        turningPointDescription: 'Seamless operation across desktop and communication channels',
      }),
    });
    expect(advanceRes.status).toBe(201);
    const advanceData = (await advanceRes.json()) as any;
    expect(advanceData.success).toBe(true);
    expect(advanceData.epoch.orderIndex).toBe(2);

    // 7. GET /api/ape/narrative/epochs
    const epochsRes = await fetch(`${baseUrl}/api/ape/narrative/epochs`);
    expect(epochsRes.status).toBe(200);
    const epochs = (await epochsRes.json()) as any[];
    expect(epochs.length).toBe(2);
  });
});
