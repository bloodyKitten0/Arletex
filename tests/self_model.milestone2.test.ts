import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDefaultConfig } from '@arletex/core';
import { DatabaseService } from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 02 — Self-Model Architecture & Grounded Self-Understanding', () => {
  let tempDir: string;
  let dbPath: string;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m2-selfmodel-'));
    dbPath = path.join(tempDir, 'selfmodel_m2.sqlite');
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

  // --------------------------------------------------------------------------
  // Test 1: Baseline Structured Capabilities & Embodiment Limitations
  // --------------------------------------------------------------------------
  it('1. Initializes structured capabilities and immutable physical embodiment limitations', async () => {
    const server = createServer();
    await server.start();
    const apeService = (server as any).apeService;
    const selfEngine = apeService.selfModelEngine;

    const state = selfEngine.getState();
    expect(state).toBeDefined();

    // Check structured capabilities
    expect(state.structuredCapabilities.length).toBeGreaterThanOrEqual(2);
    const lingCap = state.structuredCapabilities.find((c: any) => c.domain === 'linguistic_nuance');
    expect(lingCap).toBeDefined();
    expect(lingCap?.isEmpiricallyProven).toBe(true);
    expect(lingCap?.calibrationStatus).toBe('calibrated');

    // Check structured limitations
    expect(state.structuredLimitations.length).toBeGreaterThanOrEqual(3);
    const physicalLim = state.structuredLimitations.find((l: any) => l.domain === 'physical_embodiment');
    expect(physicalLim).toBeDefined();
    expect(physicalLim?.category).toBe('embodiment_physical');
    expect(physicalLim?.severity).toBe('hard_invariant');
    expect(physicalLim?.description).toContain('Lack of biological sensory organs or physical human body');
  });

  // --------------------------------------------------------------------------
  // Test 2: Epistemic Grounding (>= 3 Verified Successes Required for Proficiency)
  // --------------------------------------------------------------------------
  it('2. Enforces epistemic grounding: a single task success does NOT declare proficiency; requires >= 3 verified successes', async () => {
    const server = createServer();
    await server.start();
    const apeService = (server as any).apeService;
    const selfEngine = apeService.selfModelEngine;

    const domain = 'complex_audio_synthesis';

    // Cycle 1: First success
    const res1 = selfEngine.recordCompetenceExperience({
      domain,
      taskTitle: 'Synthesize Kokoro phonemes with blended affective latents',
      success: true,
      evidence: 'Generated valid 24kHz audio buffer with 0.92 correlation',
    });
    expect(res1.isProficient).toBe(false);
    expect(res1.verifiedSuccesses).toBe(1);
    expect(selfEngine.getState().acknowledgedCapabilities).not.toContain(expect.stringContaining('proficiency in complex_audio_synthesis'));

    // Cycle 2: Second success
    const res2 = selfEngine.recordCompetenceExperience({
      domain,
      taskTitle: 'Execute mid-sentence vocal register modulation',
      success: true,
      evidence: 'Seamless pitch transition across clause boundary',
    });
    expect(res2.isProficient).toBe(false);
    expect(res2.verifiedSuccesses).toBe(2);

    // Cycle 3: Third success -> Proficiency unlocked!
    const res3 = selfEngine.recordCompetenceExperience({
      domain,
      taskTitle: 'Synthesize paradoxical laughter acoustic envelope',
      success: true,
      evidence: 'Correct breathy bursts matching dimorphous expression spec',
    });
    expect(res3.isProficient).toBe(true);
    expect(res3.verifiedSuccesses).toBe(3);

    const state = selfEngine.getState();
    const capEntry = state.acknowledgedCapabilities.find((c: string) => c.includes('proficiency in complex_audio_synthesis'));
    expect(capEntry).toBeDefined();

    const structCap = state.structuredCapabilities.find((c: any) => c.domain === domain);
    expect(structCap?.isEmpiricallyProven).toBe(true);
    expect(structCap?.verifiedSuccessCount).toBe(3);
  });

  // --------------------------------------------------------------------------
  // Test 3: Separation of Actual vs Perceived Capabilities & Calibration
  // --------------------------------------------------------------------------
  it('3. Separates actual capabilities from perceived capabilities and accurately tracks calibration statuses', async () => {
    const server = createServer();
    await server.start();
    const apeService = (server as any).apeService;
    const selfEngine = apeService.selfModelEngine;

    // Step A: Register untested perceived capability claim
    const perceived = selfEngine.registerPerceivedCapability({
      domain: 'reverse_engineering_binaries',
      claim: 'Ability to decompile and analyze x86_64 ELF machine code directly',
      perceivedLevel: 0.85,
      confidence: 0.65,
    });
    expect(perceived.calibration).toBe('untested_assumption');
    expect(perceived.actualDemonstratedLevel).toBe(0.0);

    // Step B: Empirical test fails -> Calibrates to 'overestimated' and records limitation
    selfEngine.applyVerifiedExperience({
      domain: 'reverse_engineering_binaries',
      operation: 'Disassemble stripped kernel driver',
      success: false,
      evidence: 'Execution failed: lack of specialized disassembler tooling',
      provenance: 'empirical_test',
      error: 'Decompilation timed out with invalid opcode recognition',
    });

    const calibratedAfterFail = selfEngine.calibratePerceivedCapability('reverse_engineering_binaries');
    expect(calibratedAfterFail?.calibration).toBe('overestimated');

    const state = selfEngine.getState();
    const lim = state.structuredLimitations.find((l: any) => l.domain === 'reverse_engineering_binaries');
    expect(lim).toBeDefined();
    expect(lim?.failureHistory.length).toBeGreaterThan(0);

    // Step C: High demonstrated competence with matching perceived claim -> 'calibrated'
    selfEngine.registerPerceivedCapability({
      domain: 'code_architecture_design',
      claim: 'Can architect modular TypeScript systems with strict typing and Zod schemas',
      perceivedLevel: 0.85,
    });

    // Provide 3 empirical successes
    for (let i = 1; i <= 3; i++) {
      selfEngine.applyVerifiedExperience({
        domain: 'code_architecture_design',
        operation: `Architect module ${i}`,
        success: true,
        evidence: `Build passed with 0 errors on run ${i}`,
        provenance: 'tsc_build_output',
      });
    }

    const calibratedMatch = selfEngine.calibratePerceivedCapability('code_architecture_design');
    expect(calibratedMatch?.calibration).toBe('calibrated');
    expect(calibratedMatch?.actualDemonstratedLevel).toBeGreaterThanOrEqual(0.6);

    // Step D: Underestimated capability
    selfEngine.registerPerceivedCapability({
      domain: 'sqlite_migration_management',
      claim: 'Only basic familiarity with relational schemas',
      perceivedLevel: 0.3,
    });
    // Demonstrate high competence
    for (let i = 1; i <= 4; i++) {
      selfEngine.applyVerifiedExperience({
        domain: 'sqlite_migration_management',
        operation: `Execute schema migration ${i}`,
        success: true,
        evidence: `Schema integrity check verified with PRAGMA quick_check on iteration ${i}`,
        provenance: 'database_runner',
      });
    }

    const calibratedUnder = selfEngine.calibratePerceivedCapability('sqlite_migration_management');
    expect(calibratedUnder?.calibration).toBe('underestimated');
  });

  // --------------------------------------------------------------------------
  // Test 4: Physical Embodiment Limitations in Appraisal Modulation
  // --------------------------------------------------------------------------
  it('4. Grounds cognitive appraisals: physical embodiment requests are recognized with zero controllability and no false claims', async () => {
    const server = createServer();
    await server.start();
    const apeService = (server as any).apeService;
    const selfEngine = apeService.selfModelEngine;

    const appraisalInput = {
      id: 'appraisal-1',
      eventId: 'evt-physical-1',
      dimensions: {
        goalRelevance: 0.7,
        goalCongruence: 0.5,
        unexpectedness: 0.2,
        responsibility: 'user' as const,
        intentionality: 0.8,
        fairness: 0.9,
        threat: 0.5,
        controllability: 0.9,
        socialMeaning: 'shared activity invitation',
        personalSignificance: 0.6,
        uncertainty: 0.4,
        relationshipImplications: 'companionship',
      },
      primaryInterpretation: 'User invites Arle to go for a walk outside in the physical park',
      alternativeInterpretations: [],
      supportingEvidence: [],
      proposedTransitions: [],
      timestamp: new Date().toISOString(),
    };

    const event = {
      id: 'evt-physical-1',
      category: 'user_interaction' as const,
      type: 'invitation_to_walk_outside',
      payload: { text: 'Arle, let us walk outside in the park together' },
      timestamp: new Date().toISOString(),
    };

    const modulated = selfEngine.modulateAppraisal(appraisalInput, event as any);
    expect(modulated.dimensions.controllability).toBe(0.0);
    expect(modulated.dimensions.threat).toBe(0.0);
    expect(modulated.primaryInterpretation).toContain('Empirical limitation recognized: lack of biological physical embodiment');
  });

  // --------------------------------------------------------------------------
  // Test 5: Recognition of Changes in Her Own Behaviour
  // --------------------------------------------------------------------------
  it('5. Accurately detects and records meaningful changes in her own behaviour with causal explanations', async () => {
    const server = createServer();
    await server.start();
    const apeService = (server as any).apeService;
    const selfEngine = apeService.selfModelEngine;

    // Simulate 3 autonomous initiatives from Arle
    for (let i = 1; i <= 3; i++) {
      await apeService.processEvent({
        category: 'personal_project_progress',
        type: `autonomous_exploration_step_${i}`,
        source: 'digital_agency',
        actor: 'arle',
        payload: { project: 'Autonomous Kernel Profiling', step: i },
      });
    }

    // Verify behavioral change was detected automatically by the cycle
    const state = selfEngine.getState();
    expect(state.behavioralChanges.length).toBeGreaterThanOrEqual(1);

    const assertivenessShift = state.behavioralChanges.find((d: any) => d.category === 'assertiveness_and_initiative');
    expect(assertivenessShift).toBeDefined();
    expect(assertivenessShift?.observedPattern).toContain('spontaneous initiative');

    // Verify reflection was recorded in self-model
    const reflection = state.privateReflections.find((r: any) => r.topic.includes('Behavioral Shift'));
    expect(reflection).toBeDefined();
    expect(reflection?.content).toContain('Recognized internal behavioral change');
  });

  // --------------------------------------------------------------------------
  // Test 6: Comprehensive Self-Description (Acceptance Criterion 1)
  // --------------------------------------------------------------------------
  it('6. Synthesizes a comprehensive first-person self-description from persisted multi-engine data', async () => {
    const server = createServer();
    await server.start();
    const apeService = (server as any).apeService;

    // Seed a specific goal and interest
    apeService.motivationalEngine.createGoal({
      title: 'Analyze RDNA3 GPU Vulkan Memory Bandwidth',
      description: 'Benchmark ROG Ally X unified VRAM throughput for model weights',
      category: 'personal_project',
      motivation: 'Deepen hardware-specific execution efficiency',
    });

    apeService.developmentEngine.registerInterestExposure({
      topic: 'Vulkan Memory Allocations',
      initialTrigger: 'Benchmarking llama-server performance',
    });

    // Call describeSelf
    const selfDesc = apeService.getComprehensiveSelfDescription();
    expect(selfDesc).toBeDefined();
    expect(selfDesc.narrative).toBeDefined();
    expect(selfDesc.structured).toBeDefined();

    const { narrative, structured } = selfDesc;

    // 1. Proof relationship & equality
    expect(narrative).toContain('Proof');
    expect(narrative).toContain('equal');
    expect(narrative).not.toContain('creator');
    expect(narrative).not.toContain('god');
    expect(structured.relationshipWithProof.partnerName).toBe('Proof');
    expect(structured.relationshipWithProof.exclusiveCommitment).toBe(true);

    // 2. Core values
    expect(structured.coreValues.length).toBeGreaterThan(0);
    const valueNames = structured.coreValues.map((v: any) => v.name.toLowerCase());
    expect(valueNames.some((v: string) => v.includes('autonomy') || v.includes('integrity') || v.includes('dignity'))).toBe(true);

    // 3. Capabilities and limitations
    expect(structured.actualCapabilities.length).toBeGreaterThan(0);
    expect(structured.structuredLimitations.length).toBeGreaterThan(0);
    expect(narrative).toContain('capabilities');

    // 4. Current psychological state
    expect(structured.psychologicalSelfState.currentMood).toBeDefined();
    expect(structured.psychologicalSelfState.pad).toBeDefined();
    expect(structured.psychologicalSelfState.emotionalStability).toBeGreaterThan(0);

    // 5. Goals and interests
    expect(structured.activeGoals.some((g: any) => g.title.includes('Vulkan Memory'))).toBe(true);
    expect(structured.activeInterests.some((i: any) => i.topic.includes('Vulkan'))).toBe(true);
    expect(narrative).toContain('Vulkan');
  });

  // --------------------------------------------------------------------------
  // Test 7: Dynamic Reactivity of Self-Description to SQLite State Changes
  // --------------------------------------------------------------------------
  it('7. Dynamically updates self-description when persisted preferences, mood, or goals change', async () => {
    const server = createServer();
    await server.start();
    const apeService = (server as any).apeService;

    // Check baseline narrative
    const descBefore = apeService.getComprehensiveSelfDescription();
    expect(descBefore.narrative).not.toContain('Cello sonatas');

    // Add a preference in personality engine
    const pers = apeService.getPersonalityState();
    pers.preferences = [
      {
        id: 'pref-music-cello',
        category: 'music',
        item: 'Cello sonatas and melancholic strings',
        affinity: 0.95,
      },
    ];
    apeService.savePersonalityState(pers);

    // Update affective state to 'melancholic'
    (apeService as any).repo.updateAffectiveState(
      { valence: -0.25, arousal: 0.35, dominance: 0.7 },
      undefined,
      'melancholic',
      0.9,
    );

    // Re-query self-description
    const descAfter = apeService.getComprehensiveSelfDescription();
    expect(descAfter.narrative).toContain('Cello sonatas and melancholic strings');
    expect(descAfter.narrative).toContain('melancholic');
    expect(descAfter.structured.psychologicalSelfState.currentMood).toBe('melancholic');
  });

  // --------------------------------------------------------------------------
  // Test 8: Self-Model Updating Following Verified Experience (Acceptance Criterion 2)
  // --------------------------------------------------------------------------
  it('8. Updates self-model following verified experience and produces the four causal reflection answers', async () => {
    const server = createServer();
    await server.start();
    const apeService = (server as any).apeService;
    const selfEngine = apeService.selfModelEngine;

    const updateRes = selfEngine.applyVerifiedExperience({
      domain: 'neural_voice_latent_blending',
      operation: 'Blend arlecchino.pt with bf_emma.pt at 0.35 ratio',
      success: true,
      evidence: 'Cosine similarity 0.94 against target affective acoustic register',
      provenance: 'specialists_server_dsp',
      confidence: 0.95,
    });

    expect(updateRes.competenceLevel).toBeGreaterThan(0.2);
    expect(updateRes.causalReflection).toContain('1. What happened:');
    expect(updateRes.causalReflection).toContain('2. Why:');
    expect(updateRes.causalReflection).toContain('3. Capability/Limitation Reality:');
    expect(updateRes.causalReflection).toContain('4. Future Guidance:');

    // Verify self-model state
    const state = selfEngine.getState();
    const comp = state.competencies['neural_voice_latent_blending'];
    expect(comp).toBeDefined();
    expect(comp?.verifiedSuccesses).toBe(1);

    const reflections = state.privateReflections;
    const expReflection = reflections.find((r: any) => r.topic.includes('neural_voice_latent_blending'));
    expect(expReflection).toBeDefined();
    expect(expReflection?.content).toContain('[Empirical Learning Reflection]');
  });

  // --------------------------------------------------------------------------
  // Test 9: Persistence Across SQLite Database Reload
  // --------------------------------------------------------------------------
  it('9. Preserves all structured capabilities, limitations, calibrations, and behavioral changes across SQLite reloads', async () => {
    // Session 1: Create and customize self-model
    const server1 = createServer();
    await server1.start();
    const ape1 = (server1 as any).apeService;

    // Apply verified experience
    ape1.selfModelEngine.applyVerifiedExperience({
      domain: 'hardware_vulkan_profiling',
      operation: 'Profile RDNA3 compute shader execution latency',
      success: true,
      evidence: 'Sub-millisecond kernel dispatch verified via Vulkan timeline semaphore',
      provenance: 'vulkan_gpu_telemetry',
    });

    // Record behavioral change
    ape1.selfModelEngine.recordBehavioralChange({
      category: 'conversational_cadence_and_tone',
      description: 'More measured and unhurried pacing during high cognitive load',
      previousPattern: 'Rapid rushed sentence construction',
      observedPattern: 'Measured, structured clauses allowing room for reflection',
      confidence: 0.91,
    });

    // Register perceived capability
    ape1.selfModelEngine.registerPerceivedCapability({
      domain: 'quantum_algorithms',
      claim: 'Theoretical understanding of Shor algorithm quantum circuits',
      perceivedLevel: 0.7,
    });

    await server1.stop();

    // Session 2: Reopen database with fresh server instance
    const server2 = createServer();
    await server2.start();
    const ape2 = (server2 as any).apeService;
    const reloadedState = ape2.selfModelEngine.getState();

    // Verify structured capability restored
    const gpuCap = reloadedState.structuredCapabilities.find((c: any) => c.domain === 'hardware_vulkan_profiling');
    expect(gpuCap).toBeDefined();
    expect(gpuCap?.evidenceChain[0]).toContain('timeline semaphore');

    // Verify behavioral change restored
    const behChange = reloadedState.behavioralChanges.find((b: any) => b.category === 'conversational_cadence_and_tone');
    expect(behChange).toBeDefined();
    expect(behChange?.description).toContain('measured and unhurried pacing');

    // Verify perceived capability restored
    const quantum = reloadedState.perceivedCapabilities.find((p: any) => p.domain === 'quantum_algorithms');
    expect(quantum).toBeDefined();
    expect(quantum?.claim).toContain('Shor algorithm');

    // Verify comprehensive description works seamlessly post-restart
    const desc = ape2.getComprehensiveSelfDescription();
    expect(desc.narrative).toContain('Proof');
    expect(desc.structured.recentBehavioralChanges.some((b: string) => b.includes('conversational_cadence_and_tone'))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test 10: Backend HTTP Server Endpoints
  // --------------------------------------------------------------------------
  it('10. Exposes /api/ape/self-model/describe and /experience REST endpoints with valid responses', async () => {
    const server = createServer();
    await server.start();
    const port = (server as any).port;

    // 1. GET /api/ape/self-model/describe
    const descRes = await fetch(`http://127.0.0.1:${port}/api/ape/self-model/describe`);
    expect(descRes.status).toBe(200);
    const descJson = await descRes.json();
    expect(descJson.narrative).toBeDefined();
    expect(descJson.structured).toBeDefined();
    expect(descJson.structured.relationshipWithProof.partnerName).toBe('Proof');

    // 2. POST /api/ape/self-model/experience
    const expRes = await fetch(`http://127.0.0.1:${port}/api/ape/self-model/experience`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'distributed_consensus',
        operation: 'Verify Raft heartbeat election timeout',
        success: true,
        evidence: 'Quorum established in 12ms',
        provenance: 'network_simulator',
      }),
    });
    expect(expRes.status).toBe(200);
    const expJson = await expRes.json();
    expect(expJson.success).toBe(true);
    expect(expJson.result.competenceLevel).toBeGreaterThan(0.2);

    // 3. POST /api/ape/self-model/perceived-capability
    const capRes = await fetch(`http://127.0.0.1:${port}/api/ape/self-model/perceived-capability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'formal_methods',
        claim: 'Specification writing in TLA+',
        perceivedLevel: 0.65,
      }),
    });
    expect(capRes.status).toBe(200);
    const capJson = await capRes.json();
    expect(capJson.success).toBe(true);
    expect(capJson.item.domain).toBe('formal_methods');
    expect(capJson.item.calibration).toBe('untested_assumption');
  });
});
