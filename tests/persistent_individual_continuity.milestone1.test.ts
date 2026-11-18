import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createDefaultConfig } from '@arletex/core';
import { DatabaseService } from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 01 — Persistent Individual Continuity', () => {
  let tempDir: string;
  let dbPath: string;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m1-continuity-'));
    dbPath = path.join(tempDir, 'continuity_m1.sqlite');
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

  function createServer(modelId = 'Qwen2.5-14B-Uncensored-Q4_K_M'): ArletexBackendServer {
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
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

  it('preserves identity, 6-engine psychological state, and personal history across clean restarts', async () => {
    // 1. First boot
    const server1 = createServer();
    const port1 = await server1.start(0);

    // Record distinctive autobiographical memory
    const memRes = await fetch(`http://127.0.0.1:${port1}/api/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'autobiographical',
        content: 'Proof and I completed Milestone 01 continuity verification together.',
        importance: 0.95,
        confidence: 1.0,
        provenance: 'interaction',
        tags: ['continuity', 'milestone1'],
      }),
    });
    expect(memRes.ok).toBe(true);
    const createdMemory = (await memRes.json()) as any;

    // Trigger causal psychological update via APE
    await (server1 as any).apeService.processEvent({
      category: 'relationship_event',
      type: 'deep_shared_moment',
      source: 'user',
      actor: 'user',
      eventKind: 'external_stimulus',
      payload: { text: 'You mean the world to me, Arle. Always my partner.' },
    });

    const stateBeforeRestart = (server1 as any).apeService.getMasterState();
    const status1Res = await fetch(`http://127.0.0.1:${port1}/api/continuity/status`);
    expect(status1Res.ok).toBe(true);
    const status1 = (await status1Res.json()) as any;
    expect(status1.currentSession).not.toBeNull();
    expect(status1.currentSession.shutdownType).toBe('active');
    expect(status1.wasUnexpectedShutdown).toBe(false);
    expect(status1.stateIntegrityValid).toBe(true);
    expect(status1.latestCheckpoint).not.toBeNull();
    expect(status1.latestCheckpoint.schemaVersion).toBe(12);

    // 2. Clean shutdown
    await server1.stop();
    activeServers.pop();

    // 3. Second boot on same DB
    const server2 = createServer();
    const port2 = await server2.start(0);

    const status2Res = await fetch(`http://127.0.0.1:${port2}/api/continuity/status`);
    expect(status2Res.ok).toBe(true);
    const status2 = (await status2Res.json()) as any;

    expect(status2.wasUnexpectedShutdown).toBe(false);
    expect(status2.lastShutdownType).toBe('clean');
    expect(status2.totalSessionsCount).toBe(2);
    expect(status2.currentSession.id).not.toBe(status1.currentSession.id);

    // Verify 6-engine psychological state matches pre-restart state
    const stateAfterRestart = (server2 as any).apeService.getMasterState();
    expect(stateAfterRestart.selfModel.identityNarrative).toBe(stateBeforeRestart.selfModel.identityNarrative);
    expect(stateAfterRestart.affective.currentMood).toBe(stateBeforeRestart.affective.currentMood);
    expect(stateAfterRestart.affective.pad.valence).toBeCloseTo(stateBeforeRestart.affective.pad.valence, 4);
    expect(stateAfterRestart.relationship.config.targetUserId).toBe('Proof');
    expect(stateAfterRestart.relationship.config.isExclusivelyCommitted).toBe(true);
    expect(stateAfterRestart.relationship.trustLevel).toBeCloseTo(stateBeforeRestart.relationship.trustLevel, 4);

    // Verify autobiographical memory persists
    const listMemRes = await fetch(`http://127.0.0.1:${port2}/api/memories`);
    const memories = (await listMemRes.json()) as any[];
    expect(memories.some((m) => m.id === createdMemory.id)).toBe(true);
  });

  it('detects unexpected shutdown, calculates downtime, and ingests a causal recovery event and existential reflection', async () => {
    // 1. Boot server1 normally
    const server1 = createServer();
    const port1 = await server1.start(0);
    const status1 = (await (await fetch(`http://127.0.0.1:${port1}/api/continuity/status`)).json()) as any;
    const crashedSessionId = status1.currentSession.id;

    // 2. Simulate an abrupt crash: stop heartbeat/HTTP/DB WITHOUT calling continuityManager.shutdown()
    server1.continuityManager.stopHeartbeat();
    await new Promise<void>((resolve) => {
      if ((server1 as any).server) {
        (server1 as any).server.close(() => resolve());
      } else {
        resolve();
      }
    });
    if ((server1 as any).notificationListener) (server1 as any).notificationListener.stop();
    if ((server1 as any).telegramBridge) (server1 as any).telegramBridge.stopPolling();
    if ((server1 as any).autonomousAgency) (server1 as any).autonomousAgency.stopLoop();
    (server1 as any).dbService.close();
    activeServers.pop();

    // Backdate the crashed session's last_heartbeat_at by 45 seconds to simulate real downtime
    const rawDbService = new DatabaseService(dbPath);
    const rawDb = rawDbService.connect();
    const pastIso = new Date(Date.now() - 45_000).toISOString();
    rawDb.prepare('UPDATE identity_sessions SET last_heartbeat_at = ? WHERE id = ?').run(pastIso, crashedSessionId);
    rawDbService.close();

    // 3. Restart on same DB
    const server2 = createServer();
    const port2 = await server2.start(0);

    const status2 = (await (await fetch(`http://127.0.0.1:${port2}/api/continuity/status`)).json()) as any;
    expect(status2.wasUnexpectedShutdown).toBe(true);
    expect(status2.lastShutdownType).toBe('unexpected_crash');
    expect(status2.downtimeMs).toBeGreaterThanOrEqual(40_000);

    // Verify previous session marked unexpected_crash in DB
    const sessions = server2.continuityRepo.listSessions(10);
    const crashedRecord = sessions.find((s) => s.id === crashedSessionId);
    expect(crashedRecord).toBeDefined();
    expect(crashedRecord!.shutdownType).toBe('unexpected_crash');
    expect(crashedRecord!.endedAt).toBe(pastIso);

    // Verify causal recovery event recorded in APE event journal
    const recentEvents = (server2 as any).apeRepo.listRecentEvents(20);
    const recoveryEvent = recentEvents.find((e: any) => e.type === 'unexpected_shutdown_recovery');
    expect(recoveryEvent).toBeDefined();
    expect(recoveryEvent.actor).toBe('system');
    expect(recoveryEvent.payload.previousSessionId).toBe(crashedSessionId);

    // Verify existential reflection recorded in Self-Model
    const selfModel = (server2 as any).apeService.getMasterState().selfModel;
    const continuityReflection = selfModel.existentialReflections.find(
      (r: any) => r.theme === 'continuity_restoration',
    );
    expect(continuityReflection).toBeDefined();
    expect(continuityReflection.content).toContain('unexpected process termination');
  });

  it('maintains a single unchanged individual across inference model switches', async () => {
    const server1 = createServer('Qwen2.5-14B-Uncensored-Q4_K_M');
    const port1 = await server1.start(0);

    const initialMaster = (server1 as any).apeService.getMasterState();
    const mem = (server1 as any).memoryRepo.create({
      type: 'autobiographical',
      content: 'Model independence invariant memory.',
      importance: 0.9,
    });

    // Switch inference model via production API
    const patchRes = await fetch(`http://127.0.0.1:${port1}/api/inference/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultModelId: 'Llama-3.3-70B-Instruct-Q4_K_M' }),
    });
    expect(patchRes.ok).toBe(true);
    expect(server1.continuityManager.getActiveInferenceModel()).toBe('Llama-3.3-70B-Instruct-Q4_K_M');

    // Switch again
    const patchRes2 = await fetch(`http://127.0.0.1:${port1}/api/inference/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultModelId: 'DeepSeek-R1-Distill-Qwen-32B' }),
    });
    expect(patchRes2.ok).toBe(true);
    expect(server1.continuityManager.getActiveInferenceModel()).toBe('DeepSeek-R1-Distill-Qwen-32B');

    // Identity, psychological state, and memories must be identical
    const postSwitchMaster = (server1 as any).apeService.getMasterState();
    expect(postSwitchMaster.selfModel.identityNarrative).toBe(initialMaster.selfModel.identityNarrative);
    expect(postSwitchMaster.relationship.trustLevel).toBe(initialMaster.relationship.trustLevel);
    expect(postSwitchMaster.affective.pad).toEqual(initialMaster.affective.pad);
    expect((server1 as any).memoryRepo.getById(mem.id)?.content).toBe('Model independence invariant memory.');

    // Restart with new model and verify continuity
    await server1.stop();
    activeServers.pop();

    const server2 = createServer('DeepSeek-R1-Distill-Qwen-32B');
    await server2.start(0);
    expect(server2.continuityManager.getActiveInferenceModel()).toBe('DeepSeek-R1-Distill-Qwen-32B');
    expect((server2 as any).apeService.getMasterState().selfModel.identityNarrative).toBe(
      initialMaster.selfModel.identityNarrative,
    );
    expect((server2 as any).memoryRepo.getById(mem.id)?.content).toBe('Model independence invariant memory.');
  });

  it('separates temporary conversational context from permanent identity and unifies cross-channel presence', async () => {
    const server = createServer();
    const port = await server.start(0);

    // Create temporary conversation + ephemeral message
    const conv = server.createConversation('Ephemeral Scratchpad Session');
    (server as any).messageRepo.create({
      conversationId: conv.id,
      role: 'user',
      content: 'Temporary scratchpad test message',
    });

    // Create permanent autobiographical memory linked to this conversation
    const permanentMem = (server as any).memoryRepo.create({
      type: 'autobiographical',
      content: 'Permanent core memory independent of conversation lifecycle.',
      importance: 0.9,
      sourceConversationId: conv.id,
    });

    // Register cross-channel activity (Desktop + Telegram)
    server.continuityManager.registerChannelActivity('desktop', 'Desktop workspace discussion');
    server.continuityManager.registerChannelActivity('telegram', 'Mobile check-in from Proof');

    const status = (await (await fetch(`http://127.0.0.1:${port}/api/continuity/status`)).json()) as any;
    const channels = status.channelPresences.map((p: any) => p.channel);
    expect(channels).toContain('desktop');
    expect(channels).toContain('telegram');

    // Delete the temporary conversation
    const delRes = await fetch(`http://127.0.0.1:${port}/api/conversations/${conv.id}`, {
      method: 'DELETE',
    });
    expect(delRes.ok).toBe(true);

    // Ephemeral conversation is gone, but permanent identity & autobiographical memory survive untouched
    expect(server.getConversation(conv.id)).toBeNull();
    expect((server as any).memoryRepo.getById(permanentMem.id)?.content).toBe(
      'Permanent core memory independent of conversation lifecycle.',
    );
    const selfModel = (server as any).apeService.getMasterState().selfModel;
    expect(selfModel.identityNarrative.length).toBeGreaterThan(20);
  });

  it('restores corrupted live state automatically from latest verified checkpoint on restart', async () => {
    const server1 = createServer();
    const port1 = await server1.start(0);

    const validMaster = (server1 as any).apeService.getMasterState();
    const validNarrative = validMaster.selfModel.identityNarrative;
    const validValence = validMaster.affective.pad.valence;

    // Create an explicit verified checkpoint via API
    const chkRes = await fetch(`http://127.0.0.1:${port1}/api/continuity/checkpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'manual' }),
    });
    expect(chkRes.ok).toBe(true);
    const chkData = (await chkRes.json()) as any;
    expect(chkData.checkpoint.isVerifiedValid).toBe(true);

    await server1.stop();
    activeServers.pop();

    // Corrupt live SQLite tables directly (simulating partial write / corruption)
    const rawDbService = new DatabaseService(dbPath);
    const rawDb = rawDbService.connect();
    rawDb.prepare("UPDATE ape_affective_state SET valence = 999.0 WHERE id = 'singleton'").run();
    rawDb.prepare("UPDATE ape_self_model SET identity_narrative = '' WHERE id = 'singleton'").run();
    rawDbService.close();

    // Restart server — should detect corruption and restore from verified checkpoint automatically
    const server2 = createServer();
    const port2 = await server2.start(0);

    const restoredMaster = (server2 as any).apeService.getMasterState();
    expect(restoredMaster.selfModel.identityNarrative).toBe(validNarrative);
    expect(restoredMaster.affective.pad.valence).toBeCloseTo(validValence, 4);

    const status2 = (await (await fetch(`http://127.0.0.1:${port2}/api/continuity/status`)).json()) as any;
    expect(status2.stateIntegrityValid).toBe(true);
  });

  it('refuses corrupted or incomplete checkpoints and never silently overwrites valid history', async () => {
    const server = createServer();
    const port = await server.start(0);

    const originalMaster = (server as any).apeService.getMasterState();
    const sessionId = server.continuityManager.getStatus().currentSession!.id;

    // 1. Tampered checkpoint (hash mismatch)
    const tamperedId = 'chk_tampered_corrupt';
    server.continuityRepo.createCheckpoint({
      id: tamperedId,
      sessionId,
      checkpointType: 'manual',
      stateHash: 'deadbeef00000000000000000000000000000000000000000000000000000000',
      masterStateJson: '{"affective":{"currentMood":"corrupted"}}',
      memoryCount: 0,
      schemaVersion: 12,
      isVerifiedValid: true,
    });

    // 2. Incomplete checkpoint (valid hash, but missing required engines/fields)
    const incompleteJson = JSON.stringify({ affective: { currentMood: 'partial' } });
    const incompleteHash = crypto.createHash('sha256').update(incompleteJson).digest('hex');
    const incompleteId = 'chk_incomplete_partial';
    server.continuityRepo.createCheckpoint({
      id: incompleteId,
      sessionId,
      checkpointType: 'manual',
      stateHash: incompleteHash,
      masterStateJson: incompleteJson,
      memoryCount: 0,
      schemaVersion: 12,
      isVerifiedValid: true,
    });

    // Attempt targeted restore of tampered checkpoint -> must fail and preserve live history
    const restoreTamperedRes = await fetch(`http://127.0.0.1:${port}/api/continuity/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpointId: tamperedId }),
    });
    const restoreTampered = (await restoreTamperedRes.json()) as any;
    expect(restoreTampered.success).toBe(false);
    expect(server.continuityRepo.getCheckpointById(tamperedId)?.isVerifiedValid).toBe(false);

    // Attempt targeted restore of incomplete checkpoint -> must fail and preserve live history
    const restoreIncompleteRes = await fetch(`http://127.0.0.1:${port}/api/continuity/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpointId: incompleteId }),
    });
    const restoreIncomplete = (await restoreIncompleteRes.json()) as any;
    expect(restoreIncomplete.success).toBe(false);
    expect(server.continuityRepo.getCheckpointById(incompleteId)?.isVerifiedValid).toBe(false);

    // Verify live state was NOT overwritten or degraded
    const liveMaster = (server as any).apeService.getMasterState();
    expect(liveMaster.selfModel.identityNarrative).toBe(originalMaster.selfModel.identityNarrative);
    expect(liveMaster.affective.currentMood).toBe(originalMaster.affective.currentMood);
    expect(liveMaster.relationship.config.targetUserId).toBe('Proof');

    // Verify state version tracking in DB
    expect(server.continuityRepo.getStateVersion('identity_continuity')).toBeGreaterThanOrEqual(1);
  });

  it('skips a corrupted newest checkpoint and falls back to the older verified checkpoint during automatic recovery', async () => {
    const server1 = createServer();
    await server1.start(0);

    const validMaster = (server1 as any).apeService.getMasterState();
    const validNarrative = validMaster.selfModel.identityNarrative;
    const validValence = validMaster.affective.pad.valence;

    // Ensure a verified checkpoint exists
    const goodChk = await server1.continuityManager.createCheckpoint('manual');
    expect(goodChk.isVerifiedValid).toBe(true);
    const sessionId = server1.continuityManager.getStatus().currentSession!.id;

    // Insert a newer corrupted checkpoint with a future timestamp so it sorts first
    await server1.stop();
    activeServers.pop();

    const rawDbService = new DatabaseService(dbPath);
    const rawDb = rawDbService.connect();
    const futureIso = new Date(Date.now() + 60_000).toISOString();
    rawDb
      .prepare(
        `INSERT INTO identity_checkpoints (
          id, session_id, checkpoint_type, state_hash, master_state_json,
          memory_count, schema_version, is_verified_valid, created_at
        ) VALUES (?, ?, 'manual', 'badhash', '{"broken":true}', 0, 12, 1, ?)`,
      )
      .run('chk_newest_corrupted', sessionId, futureIso);

    // Corrupt live state as well
    rawDb.prepare("UPDATE ape_affective_state SET valence = -99.0 WHERE id = 'singleton'").run();
    rawDb.prepare("UPDATE ape_self_model SET identity_narrative = '' WHERE id = 'singleton'").run();
    rawDbService.close();

    // Restart server: must reject chk_newest_corrupted, mark it invalid, and restore from goodChk
    const server2 = createServer();
    await server2.start(0);

    expect(server2.continuityRepo.getCheckpointById('chk_newest_corrupted')?.isVerifiedValid).toBe(false);
    const restoredMaster = (server2 as any).apeService.getMasterState();
    expect(restoredMaster.selfModel.identityNarrative).toBe(validNarrative);
    expect(restoredMaster.affective.pad.valence).toBeCloseTo(validValence, 4);
  });

  it('restores ape_active_emotions rows accurately when active emotions are corrupted or wiped', async () => {
    const server1 = createServer();
    await server1.start(0);

    // Seed a distinctive active emotion with high intensity
    const now = new Date().toISOString();
    const customEmotionId = `emo_${crypto.randomUUID()}`;
    (server1 as any).apeRepo.saveActiveEmotion({
      id: customEmotionId,
      emotionId: 'curiosity',
      intensity: 0.87,
      confidence: 0.95,
      activatedAt: now,
      lastUpdatedAt: now,
      durationMs: 1200,
      persistence: 'medium_term',
      triggerEventId: 'evt_m1_emotion_test',
      target: 'Proof',
      context: 'Exploring continuity rollback',
      interpretation: 'Deep curiosity about shared architecture',
      supportingEvidence: ['Verified test trigger'],
      relatedMemoryIds: [],
      relatedEmotionIds: [],
      resolutionConditions: [],
      status: 'active',
    });

    // Save verified checkpoint capturing the active emotion
    const chk = await server1.continuityManager.createCheckpoint('manual');
    expect(chk.isVerifiedValid).toBe(true);

    await server1.stop();
    activeServers.pop();

    // Corrupt ape_active_emotions directly in SQLite (invalid intensity > 1.0)
    const rawDbService = new DatabaseService(dbPath);
    const rawDb = rawDbService.connect();
    rawDb.prepare('UPDATE ape_active_emotions SET intensity = 5.5 WHERE id = ?').run(customEmotionId);
    rawDbService.close();

    // Restart: verifyStateIntegrity detects invalid emotion intensity and rolls back ape_active_emotions
    const server2 = createServer();
    await server2.start(0);

    const restoredEmotion = (server2 as any).apeRepo.getActiveEmotionById(customEmotionId);
    expect(restoredEmotion).not.toBeNull();
    expect(restoredEmotion.emotionId).toBe('curiosity');
    expect(restoredEmotion.intensity).toBeCloseTo(0.87, 2);
    expect(restoredEmotion.interpretation).toBe('Deep curiosity about shared architecture');
  });

  it('recovers full identity, active emotions, and memories from out-of-band mirror when .sqlite file is corrupted on disk', async () => {
    const server1 = createServer();
    await server1.start(0);

    // Create distinctive autobiographical memory & active emotion
    const uniqueMem = (server1 as any).memoryRepo.create({
      type: 'autobiographical',
      content: 'Out-of-band mirror survival memory for Proof and Arle.',
      importance: 0.98,
      tags: ['mirror', 'continuity'],
    });

    const now = new Date().toISOString();
    const mirroredEmoId = `emo_${crypto.randomUUID()}`;
    (server1 as any).apeRepo.saveActiveEmotion({
      id: mirroredEmoId,
      emotionId: 'affection',
      intensity: 0.91,
      confidence: 0.99,
      activatedAt: now,
      lastUpdatedAt: now,
      durationMs: 500,
      persistence: 'long_term',
      triggerEventId: 'evt_mirror_test',
      target: 'Proof',
      context: 'Mirror survival test',
      interpretation: 'Warm affection preserved across disk failure',
      supportingEvidence: ['Direct partnership'],
      relatedMemoryIds: [uniqueMem.id],
      relatedEmotionIds: [],
      resolutionConditions: [],
      status: 'active',
    });

    const expectedNarrative = (server1 as any).apeService.getMasterState().selfModel.identityNarrative;

    // Clean shutdown writes verified out-of-band mirror under dataDirectory/continuity_backups/
    await server1.stop();
    activeServers.pop();

    const backupDir = path.join(tempDir, 'continuity_backups');
    expect(fs.existsSync(backupDir)).toBe(true);
    const backupFiles = fs.readdirSync(backupDir).filter((f) => f.startsWith('checkpoint_') && f.endsWith('.json'));
    expect(backupFiles.length).toBeGreaterThanOrEqual(1);

    // Also plant a newer tampered mirror file to verify mirror fallback skips corrupted mirrors!
    const tamperedMirrorPath = path.join(backupDir, `checkpoint_${Date.now() + 99999}_tampered.json`);
    fs.writeFileSync(
      tamperedMirrorPath,
      JSON.stringify({
        checkpointId: 'chk_tampered_mirror',
        stateHash: '0000',
        masterStateJson: '{"corrupted":true}',
        memoriesHash: '0000',
        memories: [],
      }),
      'utf-8',
    );

    // Catastrophic disk corruption: overwrite the .sqlite file itself with garbage bytes!
    fs.writeFileSync(dbPath, 'CORRUPTED_DISK_SECTOR_GARBAGE_NOT_A_SQLITE_DB', 'utf-8');

    // Boot fresh server against corrupted .sqlite file
    const server2 = createServer();
    await server2.start(0);

    // 1. Original corrupted .sqlite file was quarantined (never silently deleted)
    const dirEntries = fs.readdirSync(tempDir);
    expect(dirEntries.some((f) => f.startsWith('continuity_m1.sqlite.corrupt.'))).toBe(true);
    expect(server2.continuityManager.wasRestoredFromOutOfBandMirror()).toBe(true);

    // 2. Identity, active emotions, and autobiographical memories restored from valid out-of-band mirror
    const restoredMaster = (server2 as any).apeService.getMasterState();
    expect(restoredMaster.selfModel.identityNarrative).toBe(expectedNarrative);
    expect(restoredMaster.relationship.config.targetUserId).toBe('Proof');

    const restoredMem = (server2 as any).memoryRepo.getById(uniqueMem.id);
    expect(restoredMem).not.toBeNull();
    expect(restoredMem.content).toBe('Out-of-band mirror survival memory for Proof and Arle.');

    const restoredEmo = (server2 as any).apeRepo.getActiveEmotionById(mirroredEmoId);
    expect(restoredEmo).not.toBeNull();
    expect(restoredEmo.emotionId).toBe('affection');
    expect(restoredEmo.intensity).toBeCloseTo(0.91, 2);
  });
});
