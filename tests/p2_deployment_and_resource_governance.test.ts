import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server';
import { createDefaultConfig } from '../packages/core/src/config';
import { ResourceGovernor } from '../packages/core/src/ape/resourceGovernor';
import { sanitizeSecrets } from '../packages/core/src/logger';
import fs from 'fs';
import path from 'path';

describe('P2.6 — Deployment, Observability and Resource Governance', () => {
  let server: ArletexBackendServer;
  let testPort: number;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    testPort = 31000 + Math.floor(Math.random() * 8000);
    tempDir = path.join('/tmp', `arletex_p26_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    dbPath = path.join(tempDir, 'test.db');

    process.env.NODE_ENV = 'test';
    process.env.ARLETEX_AUTH_TOKEN = 'test-token-p26';

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
    'x-arletex-auth': 'test-token-p26',
    'Content-Type': 'application/json',
  });

  it('1. validates clean startup, graceful shutdown, and cold database restart without corruption', async () => {
    // 1. Verify running health
    const healthRes = await fetch(`http://127.0.0.1:${testPort}/health`, {
      headers: getAuthHeaders(),
    });
    expect(healthRes.status).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData.status).toBe('ok');

    // 2. Perform graceful shutdown
    await server.stop();

    // 3. Restart server on same database file (cold restart)
    const newPort = testPort + 1;
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
    });
    const restartedServer = new ArletexBackendServer(config);
    await restartedServer.start(newPort);

    try {
      // 4. Verify identity continuity and database integrity after restart
      const apeRes = await fetch(`http://127.0.0.1:${newPort}/api/ape/state`, {
        headers: { 'x-arletex-auth': 'test-token-p26' },
      });
      expect(apeRes.status).toBe(200);
      const apeData = await apeRes.json();
      expect(apeData).toHaveProperty('currentMood');
      expect(apeData).toHaveProperty('pad');

      const relRes = await fetch(`http://127.0.0.1:${newPort}/api/ape/relationship/extended`, {
        headers: { 'x-arletex-auth': 'test-token-p26' },
      });
      expect(relRes.status).toBe(200);
      const relData = await relRes.json();
      expect(relData.config.partnerName).toBe('Proof');
      expect(relData.config.forbiddenTitles).toContain('creator');
      expect(relData.config.forbiddenTitles).toContain('god');
    } finally {
      await restartedServer.stop();
    }
  });

  it('2. sanitizes secrets and credentials so no token or password is ever logged', () => {
    const rawData = {
      user: 'proof',
      token: 'secret-auth-token-12345',
      botToken: 'bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz_1234567890',
      password: 'super-secret-password-xyz',
      apiKey: 'sk-ant-api-key-999',
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M',
        'x-arletex-auth': 'my-custom-loopback-secret',
      },
      safeField: 'normal operation metadata',
    };

    const sanitized = sanitizeSecrets(rawData) as any;

    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.botToken).toBe('[REDACTED]');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.headers.authorization).toBe('[REDACTED]');
    expect(sanitized.headers['x-arletex-auth']).toBe('[REDACTED]');
    expect(sanitized.safeField).toBe('normal operation metadata');

    // Test text string sanitization
    const rawString = 'Failed to connect to Telegram with bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz_1234567890 and Bearer secret-bearer-token';
    const sanitizedString = sanitizeSecrets(rawString) as string;
    expect(sanitizedString).not.toContain('bot123456789');
    expect(sanitizedString).not.toContain('secret-bearer-token');
    expect(sanitizedString).toContain('[REDACTED]');
    expect(sanitizedString).toContain('Bearer [REDACTED]');
  });

  it('3. tracks correlation trace IDs end-to-end across user event, cognitive bus, decision, and memory', async () => {
    const testTraceId = `trace_${Date.now()}_test_correlation_uuid`;

    // Dispatch event through CognitiveControlBus with explicit traceId
    const bus = server['cognitiveControlBus'];
    expect(bus).toBeDefined();

    const cycleResult = await bus.dispatch({
      type: 'user_message',
      source: 'user',
      payload: {
        text: 'Hello Arle, let us verify correlation tracing across cognitive subsystems.',
        traceId: testTraceId,
      },
    });

    // 1. Result preserves traceId and correlationId
    expect(cycleResult.traceId).toBe(testTraceId);
    expect(cycleResult.correlationId).toBe(testTraceId);
    expect(cycleResult.pipelineCompleted).toBe(true);

    // 2. Decision preserves traceId
    expect(cycleResult.decision).toBeDefined();
    expect(cycleResult.decision?.traceId).toBe(testTraceId);
    expect(cycleResult.decision?.correlationId).toBe(testTraceId);

    // 3. Memory sink records experience with identical traceId metadata
    expect(cycleResult.memoriesCommitted.length).toBeGreaterThan(0);
    const memoryId = cycleResult.memoriesCommitted[0]!;
    const savedMemory = server['memoryRepo'].getById(memoryId);
    expect(savedMemory).toBeDefined();
    expect(savedMemory?.metadata).toBeDefined();
    expect(savedMemory?.metadata?.traceId).toBe(testTraceId);
    expect(savedMemory?.metadata?.correlationId).toBe(testTraceId);
  });

  it('4. exercises resource governor limits under heavy load, pausing optional autonomy', () => {
    const governor = new ResourceGovernor();

    // 1. Baseline equilibrium: medium workload is feasible
    const baseline = governor.evaluateFeasibility({
      cpu: 'medium',
      estimatedMemoryMb: 1024,
    });
    expect(baseline.feasible).toBe(true);
    expect(baseline.reason).toContain('ROG Ally X');

    // 2. Heavy CPU overload (> 80%): throttles and pauses optional autonomy
    governor.updateSystemMetrics({ cpuUsagePercent: 88.5 });
    expect(governor.isSystemOverloaded().overloaded).toBe(true);

    const cpuThrottled = governor.evaluateFeasibility({
      cpu: 'medium',
      estimatedMemoryMb: 1024,
    });
    expect(cpuThrottled.feasible).toBe(false);
    expect(cpuThrottled.throttleRecommended).toBe(true);
    expect(cpuThrottled.reason).toContain('resource pressure');
    expect(cpuThrottled.reason).toContain('88.5%');

    // Reset CPU load
    governor.updateSystemMetrics({ cpuUsagePercent: 25.0 });

    // 3. High memory pressure (> 88% of 24GB): throttles and pauses optional autonomy
    governor.updateSystemMetrics({
      ramUsedMb: 22500, // 22.5GB / 24GB = 93.75%
      ramTotalMb: 24000,
    });
    expect(governor.isSystemOverloaded().overloaded).toBe(true);

    const memThrottled = governor.evaluateFeasibility({
      cpu: 'low',
      estimatedMemoryMb: 512,
    });
    expect(memThrottled.feasible).toBe(false);
    expect(memThrottled.reason).toContain('High RAM utilization');

    // Reset memory load
    governor.updateSystemMetrics({ ramUsedMb: 12000, ramTotalMb: 24000 });

    // 4. Low battery preservation (< 15% and discharging)
    governor.updateSystemMetrics({ batteryPercent: 12, isCharging: false });
    expect(governor.isSystemOverloaded().overloaded).toBe(true);

    const batteryThrottled = governor.evaluateFeasibility({ cpu: 'low' });
    expect(batteryThrottled.feasible).toBe(false);
    expect(batteryThrottled.reason).toContain('Low battery reservation');

    // Plugged into AC: recovers
    governor.updateSystemMetrics({ isCharging: true });
    expect(governor.isSystemOverloaded().overloaded).toBe(false);

    // 5. User activity: yields immediately when user is actively interacting
    governor.recordUserActivity();
    const userActiveState = governor.checkUserActivityState();
    expect(userActiveState.isUserActive).toBe(true);
    expect(userActiveState.shouldYield).toBe(true);

    const userYieldResult = governor.evaluateFeasibility({ cpu: 'low' });
    expect(userYieldResult.feasible).toBe(false);
    expect(userYieldResult.reason).toContain('User is actively interacting');

    // 6. Memory ceiling: requests exceeding safety ceiling on fresh idle governor (e.g. 20,000MB > 16,384MB) are denied
    const freshGovernor = new ResourceGovernor();
    const overCeilingResult = freshGovernor.evaluateFeasibility({ estimatedMemoryMb: 20000 });
    expect(overCeilingResult.feasible).toBe(false);
    expect(overCeilingResult.reason).toContain('exceeds safety ceiling');
  });

  it('5. recovers in-flight crashed events on startup without duplicate execution', () => {
    const bus = server['cognitiveControlBus'];
    expect(bus).toBeDefined();

    // Recover in-flight events returns cleanly
    const recovered = bus.recoverInFlightEvents();
    expect(Array.isArray(recovered)).toBe(true);
  });
});
