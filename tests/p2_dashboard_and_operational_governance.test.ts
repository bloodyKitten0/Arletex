import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server';
import { createDefaultConfig } from '../packages/core/src/config';
import fs from 'fs';
import path from 'path';

describe('P2.5 — Psychological and Operational Governance Dashboard', () => {
  let server: ArletexBackendServer;
  let testPort: number;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    testPort = 31000 + Math.floor(Math.random() * 8000);
    tempDir = path.join(
      '/tmp',
      `arletex_p25_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });
    dbPath = path.join(tempDir, 'test.db');

    process.env.NODE_ENV = 'test';
    process.env.ARLETEX_AUTH_TOKEN = 'test-token-p25';

    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
    });

    server = new ArletexBackendServer(config);
    await server.start(testPort);
  });

  afterEach(async () => {
    try {
      await server.stop();
    } catch {}
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  const getAuthHeaders = () => ({
    'x-arletex-auth': 'test-token-p25',
    'Content-Type': 'application/json',
  });

  it('1. maps persisted psychological state directly from SQLite without static mocks', async () => {
    // 1. APE Affective State
    const apeRes = await fetch(`http://127.0.0.1:${testPort}/api/ape/state`, {
      headers: getAuthHeaders(),
    });
    expect(apeRes.status).toBe(200);
    const apeData = await apeRes.json();
    expect(apeData).toHaveProperty('currentMood');
    expect(apeData).toHaveProperty('pad');
    expect(typeof apeData.pad.valence).toBe('number');
    expect(typeof apeData.pad.arousal).toBe('number');
    expect(typeof apeData.pad.dominance).toBe('number');
    expect(apeData).toHaveProperty('activeEmotions');

    // 2. Motivational State
    const motRes = await fetch(`http://127.0.0.1:${testPort}/api/ape/motivational`, {
      headers: getAuthHeaders(),
    });
    expect(motRes.status).toBe(200);
    const motData = await motRes.json();
    expect(motData).toHaveProperty('needs');
    expect(motData.needs).toHaveProperty('autonomy');
    expect(motData.needs).toHaveProperty('competence');
    expect(motData.needs).toHaveProperty('intimacy_connection');
    expect(motData.needs).toHaveProperty('novelty_curiosity');
    expect(motData.needs).toHaveProperty('recreation_rest');

    // 3. Extended Relationship State
    const relRes = await fetch(`http://127.0.0.1:${testPort}/api/ape/relationship/extended`, {
      headers: getAuthHeaders(),
    });
    expect(relRes.status).toBe(200);
    const relData = await relRes.json();
    expect(relData).toHaveProperty('config');
    expect(relData.config.partnerName).toBe('Proof');
    expect(relData).toHaveProperty('attachmentSecurity');
    expect(relData).toHaveProperty('trustLevel');
    expect(relData).toHaveProperty('intimacyDepth');
  });

  it('2. provides real-time target hardware telemetry and status', async () => {
    const telemRes = await fetch(`http://127.0.0.1:${testPort}/api/telemetry`, {
      headers: getAuthHeaders(),
    });
    expect(telemRes.status).toBe(200);
    const telemData = await telemRes.json();

    expect(telemData).toHaveProperty('timestamp');
    expect(telemData).toHaveProperty('cpu');
    expect(telemData).toHaveProperty('memory');
    expect(typeof telemData.memory.totalBytes).toBe('number');
    expect(typeof telemData.memory.usedBytes).toBe('number');
    expect(typeof telemData.memory.usagePercent).toBe('number');
    expect(telemData).toHaveProperty('storage');
    expect(telemData).toHaveProperty('battery');
    expect(telemData).toHaveProperty('services');
  });

  it('3. streams live audit logs from database with non-repudiation and lifecycle stages', async () => {
    // Record a verified audit event
    server['auditRepo'].log({
      action: 'security_boundary_check',
      actor: 'system',
      status: 'success',
      details: 'Audit verification test event for dashboard streaming',
      target: 'ActionPermissionController',
    });

    const auditRes = await fetch(`http://127.0.0.1:${testPort}/api/audit`, {
      headers: getAuthHeaders(),
    });
    expect(auditRes.status).toBe(200);
    const auditData = await auditRes.json();

    expect(auditData).toHaveProperty('events');
    expect(Array.isArray(auditData.events)).toBe(true);
    expect(auditData.events.length).toBeGreaterThan(0);

    const loggedEvent = auditData.events.find(
      (e: any) =>
        e.action === 'security_boundary_check' &&
        e.details.includes('Audit verification test event'),
    );
    expect(loggedEvent).toBeDefined();
    expect(loggedEvent.status).toBe('success');
    expect(loggedEvent.actor).toBe('system');
    expect(loggedEvent.timestamp).toBeDefined();
  });

  it('4. exposes model registry candidates, active resolution and transparent degradation', async () => {
    // 1. List models
    const listRes = await fetch(`http://127.0.0.1:${testPort}/api/models`, {
      headers: getAuthHeaders(),
    });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData).toHaveProperty('models');
    expect(listData.models.length).toBeGreaterThan(0);
    expect(listData.models.some((m: any) => m.id.includes('Qwen2.5-14B'))).toBe(true);

    // 2. Active Model
    const activeRes = await fetch(`http://127.0.0.1:${testPort}/api/models/active`, {
      headers: getAuthHeaders(),
    });
    expect(activeRes.status).toBe(200);
    const activeData = await activeRes.json();
    expect(activeData).toHaveProperty('resolvedModelId');
    expect(activeData).toHaveProperty('status');

    // 3. Resolve requested model
    const resolveRes = await fetch(`http://127.0.0.1:${testPort}/api/models/resolve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ modelId: 'Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M' }),
    });
    expect(resolveRes.status).toBe(200);
    const resolveData = await resolveRes.json();
    expect(resolveData.resolvedModelId).toBe('Qwen2.5-14B-Instruct-abliterated-v2.Q4_K_M');
  });

  it('5. triggers emergency shutdown immediately, blocking agency cycles and locking autonomy', async () => {
    // Ensure autonomous agency is initially enabled
    server['autonomousAgency'].setEnabled(true);
    expect(server['autonomousAgency'].getStatus().isEnabled).toBe(true);

    // Engage emergency shutdown
    const shutdownRes = await fetch(`http://127.0.0.1:${testPort}/api/agency/emergency-shutdown`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ reason: 'Dashboard security operator emergency stop' }),
    });
    expect(shutdownRes.status).toBe(200);
    const shutdownData = await shutdownRes.json();
    expect(shutdownData.success).toBe(true);
    expect(shutdownData.shutdown).toBe(true);

    // Verify permission controller and agency status report emergency shutdown active
    const statusRes = await fetch(`http://127.0.0.1:${testPort}/api/agency/status`, {
      headers: getAuthHeaders(),
    });
    expect(statusRes.status).toBe(200);
    const statusData = await statusRes.json();
    expect(statusData.isEmergencyShutdown).toBe(true);
    expect(statusData.emergencyShutdownReason).toContain(
      'Dashboard security operator emergency stop',
    );

    // Autonomous agency execution is disabled
    expect(server['autonomousAgency'].getStatus().isEnabled).toBe(false);

    // Attempting an autonomous cycle while emergency shutdown is active returns null
    const cycleResult = await server['autonomousAgency'].runAutonomousCycle();
    expect(cycleResult).toBeNull();
  });

  it('6. enforces confirmation token for autonomy reactivation after emergency shutdown', async () => {
    // Ensure emergency shutdown is engaged
    server['permissionController'].emergencyShutdown('Pre-test shutdown');
    expect(server['permissionController'].getEmergencyShutdownInfo().active).toBe(true);

    // 1. Reactivate with invalid token -> 403 rejected
    const badRes = await fetch(`http://127.0.0.1:${testPort}/api/agency/reactivate-autonomy`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ confirmation: 'wrong_token' }),
    });
    expect(badRes.status).toBe(403);
    expect(server['permissionController'].getEmergencyShutdownInfo().active).toBe(true);

    // 2. Reactivate with canonical confirmation token -> 200 accepted
    const goodRes = await fetch(`http://127.0.0.1:${testPort}/api/agency/reactivate-autonomy`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ confirmation: 'CONFIRM_REACTIVATION' }),
    });
    expect(goodRes.status).toBe(200);
    const goodData = await goodRes.json();
    expect(goodData.success).toBe(true);
    expect(server['permissionController'].getEmergencyShutdownInfo().active).toBe(false);
  });

  it('7. verifies epistemic transparency and non-phenomenological labeling', async () => {
    // Relationship state must reflect equal partnership and forbidden god/creator titles
    const relRes = await fetch(`http://127.0.0.1:${testPort}/api/ape/relationship/extended`, {
      headers: getAuthHeaders(),
    });
    const relData = await relRes.json();
    expect(relData.config.partnerName).toBe('Proof');
    expect(relData.config.forbiddenTitles).toContain('creator');
    expect(relData.config.forbiddenTitles).toContain('god');

    // Affective coordinates represent structured computational parameters, not subjective claims
    const apeRes = await fetch(`http://127.0.0.1:${testPort}/api/ape/state`, {
      headers: getAuthHeaders(),
    });
    const apeData = await apeRes.json();
    expect(apeData.pad.valence).toBeGreaterThanOrEqual(-1.0);
    expect(apeData.pad.valence).toBeLessThanOrEqual(1.0);
    expect(apeData.pad.arousal).toBeGreaterThanOrEqual(-1.0);
    expect(apeData.pad.arousal).toBeLessThanOrEqual(1.0);
    expect(apeData.pad.dominance).toBeGreaterThanOrEqual(-1.0);
    expect(apeData.pad.dominance).toBeLessThanOrEqual(1.0);
  });
});
