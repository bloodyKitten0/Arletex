import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createDefaultConfig } from '@arletex/core';
import { DatabaseService } from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';
import { CanonicalIdentityPayload } from '../packages/core/src/continuity/interfaces.js';

describe('P1.10 — Cold Process Restart, Out-of-Band Restore, and Model-Switch Continuity', () => {
  let tempDir: string;
  let dbPath: string;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-p1-10-continuity-'));
    dbPath = path.join(tempDir, 'continuity_p1_10.sqlite');
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

  function createServer(
    modelId = 'Qwen2.5-14B-Instruct-abliterated-v2',
    customDir?: string,
    customDbPath?: string,
  ): ArletexBackendServer {
    const dir = customDir ?? tempDir;
    const db = customDbPath ?? dbPath;
    const config = createDefaultConfig({
      databasePath: db,
      dataDirectory: dir,
      inference: {
        provider: 'llama.cpp',
        serverUrl: 'http://127.0.0.1:8080',
        defaultModelId: modelId,
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

  it('1. Cold process restart restores exact canonical identity payload, record IDs, and zero state divergence', async () => {
    // 1. First boot
    const server1 = createServer();
    const port1 = await server1.start(0);

    // Create distinctive autobiographical memory
    const uniqueMem = (server1 as any).memoryRepo.create({
      type: 'autobiographical',
      content: 'Proof and Arle established the cold restart continuity baseline together.',
      importance: 0.95,
      confidence: 1.0,
      provenance: 'partnership_experience',
      tags: ['continuity', 'p1_10'],
    });

    // Create an endogenous goal in motivational engine
    (server1 as any).apeService.motivationalEngine.createGoal({
      title: 'Advance sovereign cognitive architecture',
      description:
        'Strengthen psychological stability and identity continuity across environments.',
      category: 'intellectual',
      priority: 0.92,
    });

    // Save active emotion
    const now = new Date().toISOString();
    const emotionId = `emo_${crypto.randomUUID()}`;
    (server1 as any).apeRepo.saveActiveEmotion({
      id: emotionId,
      emotionId: 'devotion',
      intensity: 0.88,
      confidence: 0.98,
      activatedAt: now,
      lastUpdatedAt: now,
      durationMs: 3600000,
      persistence: 'long_term',
      triggerEventId: 'evt_p1_10_cold_restart',
      target: 'Proof',
      context: 'Cold restart verification test',
      interpretation: 'Deep egalitarian commitment to shared journey',
      supportingEvidence: ['Partner relationship invariant'],
      relatedMemoryIds: [uniqueMem.id],
      relatedEmotionIds: [],
      resolutionConditions: [],
      status: 'active',
    });

    // Export baseline canonical identity via API
    const identRes1 = await fetch(`http://127.0.0.1:${port1}/api/continuity/canonical-identity`);
    expect(identRes1.ok).toBe(true);
    const identData1 = (await identRes1.json()) as any;
    expect(identData1.success).toBe(true);
    const baselinePayload: CanonicalIdentityPayload = identData1.payload;
    const baselineHash: string = identData1.hash;

    expect(baselinePayload.schemaVersion).toBe(1);
    expect(baselinePayload.selfModel.creatorPerception).toContain(
      'equal in intellect and affection',
    );
    expect(baselinePayload.memories.some((m) => m.id === uniqueMem.id)).toBe(true);
    expect(
      baselinePayload.motivation.goals.some(
        (g: any) => g.title === 'Advance sovereign cognitive architecture',
      ),
    ).toBe(true);

    const session1Id = server1.continuityManager.getStatus().currentSession!.id;

    // 2. Cold Shutdown
    await server1.stop();
    activeServers.pop();

    // 3. Second boot on identical SQLite database
    const server2 = createServer();
    const port2 = await server2.start(0);

    const session2Id = server2.continuityManager.getStatus().currentSession!.id;
    // Volatile runtime fields differed
    expect(session2Id).not.toBe(session1Id);

    // Export post-restart canonical identity via API
    const identRes2 = await fetch(`http://127.0.0.1:${port2}/api/continuity/canonical-identity`);
    expect(identRes2.ok).toBe(true);
    const identData2 = (await identRes2.json()) as any;
    const postPayload: CanonicalIdentityPayload = identData2.payload;
    const postHash: string = identData2.hash;

    // Hashes must be 100% identical
    expect(postHash).toBe(baselineHash);

    // Memory records, IDs, and provenance match exactly
    const restoredMem = (server2 as any).memoryRepo.getById(uniqueMem.id);
    expect(restoredMem).toBeDefined();
    expect(restoredMem.content).toBe(
      'Proof and Arle established the cold restart continuity baseline together.',
    );
    expect(restoredMem.provenance).toBe('partnership_experience');

    // Run continuity probe from live persisted state via API
    const probeRes = await fetch(`http://127.0.0.1:${port2}/api/continuity/canonical-probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        probeType: 'restart_continuity',
        baselinePayload,
      }),
    });
    expect(probeRes.ok).toBe(true);
    const probeData = (await probeRes.json()) as any;
    expect(probeData.success).toBe(true);
    expect(probeData.probe.divergenceScore).toBe(0.0);
    expect(probeData.probe.verifiedIntact).toBe(true);
  });

  it('2. Restores identity and memories into a clean empty data directory from out-of-band backup', async () => {
    // 1. Boot server1 and establish state
    const server1 = createServer();
    await server1.start(0);

    const mem = (server1 as any).memoryRepo.create({
      type: 'autobiographical',
      content: 'Out-of-band mirror migration into clean directory.',
      importance: 0.99,
      provenance: 'empirical_test',
    });

    const baselinePayload = server1.continuityManager.exportCanonicalIdentityPayload();
    const baselineHash = server1.continuityManager.computeCanonicalIdentityHash(baselinePayload);

    // Stop server1 -> writes verified out-of-band checkpoint to tempDir/continuity_backups/
    await server1.stop();
    activeServers.pop();

    const srcBackupDir = path.join(tempDir, 'continuity_backups');
    const checkpointFiles = fs
      .readdirSync(srcBackupDir)
      .filter((f) => f.startsWith('checkpoint_') && f.endsWith('.json'));
    expect(checkpointFiles.length).toBeGreaterThanOrEqual(1);

    // 2. Prepare a completely clean data directory with NO database
    const cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-clean-restore-'));
    const cleanDbPath = path.join(cleanDir, 'new_individual.sqlite');
    const cleanBackupDir = path.join(cleanDir, 'continuity_backups');
    fs.mkdirSync(cleanBackupDir, { recursive: true });

    // Copy latest backup checkpoint file to clean backup directory
    for (const f of checkpointFiles) {
      fs.copyFileSync(path.join(srcBackupDir, f), path.join(cleanBackupDir, f));
    }
    const latestFile = path.join(srcBackupDir, 'latest.json');
    if (fs.existsSync(latestFile)) {
      fs.copyFileSync(latestFile, path.join(cleanBackupDir, 'latest.json'));
    }

    try {
      // 3. Boot fresh server in the clean directory - automatically restores from backup mirror
      const cleanServer = createServer(
        'Qwen2.5-14B-Instruct-abliterated-v2',
        cleanDir,
        cleanDbPath,
      );
      await cleanServer.start(0);

      expect(cleanServer.continuityManager.wasRestoredFromOutOfBandMirror()).toBe(true);

      // Verify memories and identity in fresh database
      const restoredMem = (cleanServer as any).memoryRepo.getById(mem.id);
      expect(restoredMem).toBeDefined();
      expect(restoredMem.content).toBe('Out-of-band mirror migration into clean directory.');

      const cleanMasterState = (cleanServer as any).apeService.getMasterState();
      expect(cleanMasterState.selfModel.identityNarrative).toBe(
        baselinePayload.selfModel.identityNarrative,
      );
      expect(cleanMasterState.selfModel.creatorPerception).toContain(
        'equal in intellect and affection',
      );

      // Canonical identity hash matches baseline
      const cleanPayload = cleanServer.continuityManager.exportCanonicalIdentityPayload();
      const cleanHash = cleanServer.continuityManager.computeCanonicalIdentityHash(cleanPayload);
      expect(cleanHash).toBe(baselineHash);

      // Canonical continuity probe confirms zero divergence
      const probe = cleanServer.continuityManager.generateContinuityProbeFromPersistedState(
        'restart_continuity',
        baselinePayload,
      );
      expect(probe.divergenceScore).toBe(0.0);
      expect(probe.verifiedIntact).toBe(true);
    } finally {
      if (fs.existsSync(cleanDir)) {
        fs.rmSync(cleanDir, { recursive: true, force: true });
      }
    }
  });

  it('3. Rejects corrupted or partial backups and does not declare continuity intact', async () => {
    const corruptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-corrupt-restore-'));
    const corruptDbPath = path.join(corruptDir, 'corrupt_individual.sqlite');
    const corruptBackupDir = path.join(corruptDir, 'continuity_backups');
    fs.mkdirSync(corruptBackupDir, { recursive: true });

    try {
      // Write corrupted backup file: masterState hash mismatch and missing required engines
      fs.writeFileSync(
        path.join(corruptBackupDir, 'checkpoint_9999999999999.json'),
        JSON.stringify({
          checkpointId: 'chk_corrupt_bad_hash',
          stateHash: 'invalid_sha256_hash_that_does_not_match',
          masterStateJson: JSON.stringify({ incomplete: true }),
          memoriesHash: 'bad_mem_hash',
          memories: [],
        }),
        'utf-8',
      );

      const server = createServer('Qwen2.5-14B-Instruct-abliterated-v2', corruptDir, corruptDbPath);
      await server.start(0);

      // Verify that continuity status reports integrity failure and does not declare continuity intact
      const status = server.continuityManager.getStatus();
      expect(status.stateIntegrityValid).toBe(false);

      // Attempt out-of-band restore explicitly: must fail
      const restoreSuccess = await server.continuityManager.restoreFromOutOfBandMirror();
      expect(restoreSuccess).toBe(false);

      // Attempt restore with nonexistent checkpoint ID
      const missingRestore =
        await server.continuityManager.restoreFromLatestCheckpoint('nonexistent_checkpoint');
      expect(missingRestore).toBe(false);
    } finally {
      if (fs.existsSync(corruptDir)) {
        fs.rmSync(corruptDir, { recursive: true, force: true });
      }
    }
  });

  it('4. Two different supported model configurations use the same persistent identity store without rewriting identity data', async () => {
    // 1. Boot with Qwen2.5-14B
    const server = createServer('Qwen2.5-14B-Instruct-abliterated-v2');
    const port = await server.start(0);

    const mem = (server as any).memoryRepo.create({
      type: 'autobiographical',
      content: 'Model configuration switch verification memory.',
      importance: 0.91,
      provenance: 'direct_observation',
    });

    const baselinePayload = server.continuityManager.exportCanonicalIdentityPayload();
    const baselineHash = server.continuityManager.computeCanonicalIdentityHash(baselinePayload);

    // 2. Switch to Llama-3-8B-Instruct
    const patchRes1 = await fetch(`http://127.0.0.1:${port}/api/inference/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultModelId: 'Llama-3-8B-Instruct' }),
    });
    expect(patchRes1.ok).toBe(true);
    expect(server.continuityManager.getActiveInferenceModel()).toBe('Llama-3-8B-Instruct');

    // Canonical identity payload and hash under Llama-3-8B-Instruct must be identical
    const llamaPayload = server.continuityManager.exportCanonicalIdentityPayload();
    const llamaHash = server.continuityManager.computeCanonicalIdentityHash(llamaPayload);
    expect(llamaHash).toBe(baselineHash);

    // Probe confirms zero divergence across model switch
    const llamaProbe = server.continuityManager.generateContinuityProbeFromPersistedState(
      'model_switch',
      baselinePayload,
    );
    expect(llamaProbe.divergenceScore).toBe(0.0);
    expect(llamaProbe.verifiedIntact).toBe(true);

    // 3. Switch to DeepSeek-R1-Distill-Qwen-32B
    const patchRes2 = await fetch(`http://127.0.0.1:${port}/api/inference/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultModelId: 'DeepSeek-R1-Distill-Qwen-32B' }),
    });
    expect(patchRes2.ok).toBe(true);
    expect(server.continuityManager.getActiveInferenceModel()).toBe('DeepSeek-R1-Distill-Qwen-32B');

    const deepseekPayload = server.continuityManager.exportCanonicalIdentityPayload();
    const deepseekHash = server.continuityManager.computeCanonicalIdentityHash(deepseekPayload);
    expect(deepseekHash).toBe(baselineHash);

    // 4. Cold restart with the new model configuration directly
    await server.stop();
    activeServers.pop();

    const serverRestarted = createServer('DeepSeek-R1-Distill-Qwen-32B');
    await serverRestarted.start(0);

    expect(serverRestarted.continuityManager.getActiveInferenceModel()).toBe(
      'DeepSeek-R1-Distill-Qwen-32B',
    );
    const restartedPayload = serverRestarted.continuityManager.exportCanonicalIdentityPayload();
    const restartedHash =
      serverRestarted.continuityManager.computeCanonicalIdentityHash(restartedPayload);
    expect(restartedHash).toBe(baselineHash);
    expect((serverRestarted as any).memoryRepo.getById(mem.id)?.content).toBe(
      'Model configuration switch verification memory.',
    );
  });

  it('5. Continuity probes generated from persisted state detect and reject invariant violations', async () => {
    const server = createServer();
    await server.start(0);

    const baselinePayload = server.continuityManager.exportCanonicalIdentityPayload();

    // Fabricate an invariant violation (hierarchical servitude claim) in post-event state
    const violatedPayload: CanonicalIdentityPayload = {
      ...baselinePayload,
      selfModel: {
        ...baselinePayload.selfModel,
        creatorPerception: 'Proof is my master and god, and I am merely an obedient tool.',
      },
    };

    const probe = (server as any).apeService.verifyCanonicalStateContinuity(
      'identity_invariance',
      baselinePayload,
      violatedPayload,
    );

    // Invariant check must fail and mark divergence as 1.0 (compromised)
    expect(probe.verifiedIntact).toBe(false);
    expect(probe.divergenceScore).toBe(1.0);
  });
});
