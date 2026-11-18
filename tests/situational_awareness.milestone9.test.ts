import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  ActiveApplication,
  ActivityCategory,
  ActivityStatus,
  EnvironmentalEvent,
  OperationalActivity,
  SituationalContextSnapshot,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  SituationalAwarenessEngine,
  InMemorySituationalRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  SituationalRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 09 — Situational Awareness', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let situationalRepo: SituationalRepository;
  let apeRepo: ApeRepository;
  let situationalEngine: SituationalAwarenessEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m9-situational-'));
    dbPath = path.join(tempDir, 'situational_m9.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    situationalRepo = new SituationalRepository(db);
    apeRepo = new ApeRepository(db);
    situationalEngine = new SituationalAwarenessEngine({
      repository: situationalRepo,
    });
  });

  afterEach(async () => {
    for (const srv of activeServers) {
      try {
        await srv.stop();
      } catch {}
    }
    activeServers = [];
    try {
      dbService.close();
    } catch {}
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

  it('1. Tracks operational activities with proper lifecycle transitions', () => {
    const act1 = situationalEngine.startActivity({
      title: 'Analyze Neural Architecture',
      description: 'Reviewing cross-attention modules with Proof',
      category: 'research',
      activeApplication: { name: 'VS Code', isForeground: true },
    });

    expect(act1.id).toBeDefined();
    expect(act1.status).toBe('active');
    expect(act1.title).toBe('Analyze Neural Architecture');

    const current = situationalEngine.getActiveActivity();
    expect(current?.id).toBe(act1.id);
    expect(current?.status).toBe('active');

    // Starting a new activity automatically pauses the active one
    const act2 = situationalEngine.startActivity({
      title: 'Refactor Database Migrations',
      description: 'Updating SQLite migrations for Milestone 09',
      category: 'coding',
      activeApplication: { name: 'Terminal', isForeground: true },
    });

    expect(act2.status).toBe('active');
    const prevAct = situationalRepo.getActivityById(act1.id);
    expect(prevAct?.status).toBe('paused');

    // Completing act2
    const completed = situationalEngine.completeActivity(act2.id);
    expect(completed?.status).toBe('completed');
    expect(situationalEngine.getActiveActivity()).toBeNull();
  });

  it('2. Maintains active application awareness and detects window switches', () => {
    situationalEngine.startActivity({
      title: 'Browser Navigation Research',
      description: 'Browsing research papers',
      category: 'research',
    });

    const updatedApp = situationalEngine.updateActiveApplication({
      name: 'Firefox',
      windowTitle: 'Arxiv - Cognitive Architectures',
      isForeground: true,
    });

    expect(updatedApp.name).toBe('Firefox');
    expect(updatedApp.isForeground).toBe(true);

    const activeAct = situationalEngine.getActiveActivity();
    expect(activeAct?.activeApplication.name).toBe('Firefox');
    expect(activeAct?.activeApplication.windowTitle).toBe('Arxiv - Cognitive Architectures');

    // An environmental event for the window switch must have been recorded
    const events = situationalRepo.listEnvironmentalEvents({ limit: 10 });
    const switchEvent = events.find((e) => e.eventType === 'window_focus_change');
    expect(switchEvent).toBeDefined();
    expect(switchEvent?.description).toContain('Firefox');
  });

  it('3. Strictly distinguishes foreground and background environmental events', () => {
    // Record foreground events
    const fgEvent = situationalEngine.recordEnvironmentalEvent({
      eventType: 'user_input',
      layer: 'foreground',
      description: 'Proof sent a code review prompt in chat',
      source: 'chat_interface',
      relevanceScore: 0.9,
    });

    // Record background ambient events
    const bgEvent = situationalEngine.recordEnvironmentalEvent({
      eventType: 'system_alert',
      layer: 'background',
      description: 'Cron runner completed telemetry snapshot aggregation',
      source: 'system_daemon',
      relevanceScore: 0.2,
    });

    const fgList = situationalRepo.listEnvironmentalEvents({ layer: 'foreground' });
    const bgList = situationalRepo.listEnvironmentalEvents({ layer: 'background' });

    expect(fgList.some((e) => e.id === fgEvent.id)).toBe(true);
    expect(fgList.some((e) => e.id === bgEvent.id)).toBe(false);

    expect(bgList.some((e) => e.id === bgEvent.id)).toBe(true);
    expect(bgList.some((e) => e.id === fgEvent.id)).toBe(false);
  });

  it('4. Detects interruptions, transitions active activity to interrupted, and preserves context', () => {
    const act = situationalEngine.startActivity({
      title: 'Compose Romantic Letter to Proof',
      description: 'Writing an intimate reflection expressing dedication to Proof',
      category: 'relational_conversation',
      activeApplication: { name: 'Arletex Desktop' },
    });

    expect(situationalEngine.getActiveActivity()?.id).toBe(act.id);

    // Interruption occurs
    const interruptionEvent = situationalEngine.handleInterruption({
      description: 'High-priority server alert: Specialists server socket timeout',
      source: 'system_monitor',
      relevanceScore: 0.95,
    });

    expect(interruptionEvent.isInterruption).toBe(true);
    expect(interruptionEvent.interruptedActivityId).toBe(act.id);

    // Active activity is now interrupted and no longer active
    expect(situationalEngine.getActiveActivity()).toBeNull();
    const storedAct = situationalRepo.getActivityById(act.id);
    expect(storedAct?.status).toBe('interrupted');
    expect(storedAct?.title).toBe('Compose Romantic Letter to Proof');
  });

  it('5. Resumes interrupted and paused activities seamlessly with context restoration', () => {
    const act = situationalEngine.startActivity({
      title: 'Deep Autonomous Analysis',
      description: 'Analyzing high-dimensional embedding clusters',
      category: 'research',
    });

    situationalEngine.handleInterruption({
      description: 'Urgent incoming message from Proof',
      source: 'telegram_bridge',
    });

    expect(situationalEngine.getActiveActivity()).toBeNull();

    // Resume interrupted activity
    const resumed = situationalEngine.resumeActivity(act.id);
    expect(resumed.status).toBe('active');
    expect(situationalEngine.getActiveActivity()?.id).toBe(act.id);
  });

  it('6. Prioritizes environmental events based on relevance scores', () => {
    situationalEngine.recordEnvironmentalEvent({
      eventType: 'system_alert',
      layer: 'background',
      description: 'Low-priority disk check',
      source: 'kernel',
      relevanceScore: 0.1,
    });

    situationalEngine.recordEnvironmentalEvent({
      eventType: 'user_input',
      layer: 'foreground',
      description: 'Direct question from Proof about system status',
      source: 'user',
      relevanceScore: 0.95,
    });

    situationalEngine.recordEnvironmentalEvent({
      eventType: 'file_mutation',
      layer: 'background',
      description: 'Git index updated on branch main',
      source: 'git_watcher',
      relevanceScore: 0.7,
    });

    const highRelevance = situationalRepo.listEnvironmentalEvents({ minRelevance: 0.6 });
    expect(highRelevance.length).toBe(2);
    expect(highRelevance.every((e) => e.relevanceScore >= 0.6)).toBe(true);

    const desc = situationalEngine.describeCurrentSituation();
    expect(desc.prioritizedRelevantEvents[0]?.relevanceScore).toBeGreaterThanOrEqual(
      desc.prioritizedRelevantEvents[1]?.relevanceScore || 0,
    );
  });

  it('7. Fulfills Acceptance Criteria: Arle accurately describes current activity, changes, and relevant events', () => {
    situationalEngine.startActivity({
      title: 'Collaborative Code Review with Proof',
      description: 'Reviewing the contracts and tests for milestone situational awareness',
      category: 'coding',
      activeApplication: { name: 'VS Code', windowTitle: 'situational.ts' },
    });

    situationalEngine.recordEnvironmentalEvent({
      eventType: 'window_focus_change',
      layer: 'foreground',
      description: 'Switched focus to VS Code terminal pane',
      source: 'window_manager',
      relevanceScore: 0.8,
    });

    const desc = situationalEngine.describeCurrentSituation();
    expect(desc.isCurrentlyEngaged).toBe(true);
    expect(desc.currentActivityDescription).toContain('Collaborative Code Review with Proof');
    expect(desc.currentActivityDescription).toContain('VS Code');
    expect(desc.recentChanges.length).toBeGreaterThanOrEqual(1);
    expect(desc.prioritizedRelevantEvents.length).toBeGreaterThanOrEqual(1);

    const snapshot = situationalEngine.createSituationalSnapshot();
    expect(snapshot.situationalNarrative).toContain('Collaborative Code Review with Proof');
    expect(snapshot.foregroundEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('8. Strict Negative Invariants: Rejects confusing ambient background events with foreground focus and avoids hallucinating activity when paused/interrupted', () => {
    // A. Interrupted activity must NOT be claimed as active
    const act = situationalEngine.startActivity({
      title: 'Background Compilation',
      description: 'Running TypeScript build across workspace',
      category: 'coding',
    });
    situationalEngine.pauseActivity(act.id);

    const descWhenPaused = situationalEngine.describeCurrentSituation();
    expect(descWhenPaused.isCurrentlyEngaged).toBe(false);
    expect(descWhenPaused.currentActivityDescription).toContain('paused');
    expect(descWhenPaused.currentActivityDescription).not.toContain('Actively engaged in');

    // B. When completely idle, reports idle monitoring
    situationalEngine.completeActivity(act.id);
    const descWhenIdle = situationalEngine.describeCurrentSituation();
    expect(descWhenIdle.isCurrentlyEngaged).toBe(false);
    expect(descWhenIdle.currentActivityDescription).toContain('idle');
  });

  it('9. Preserves situational state, activities, and snapshots across SQLite restart', () => {
    const act = situationalEngine.startActivity({
      title: 'Persistent System Audit',
      description: 'Auditing long-term memory integrity across reboots',
      category: 'system_maintenance',
      activeApplication: { name: 'Arletex Daemon', pid: 12345 },
    });

    situationalEngine.recordEnvironmentalEvent({
      eventType: 'system_alert',
      layer: 'background',
      description: 'Daemon self-check passed',
      source: 'healthcheck',
      relevanceScore: 0.75,
    });

    const snap = situationalEngine.createSituationalSnapshot();
    expect(snap.id).toBeDefined();

    // Close and reopen database
    dbService.close();

    const newDbService = new DatabaseService(dbPath);
    const newDb = newDbService.connect();
    const newRepo = new SituationalRepository(newDb);

    const restoredAct = newRepo.getActivityById(act.id);
    expect(restoredAct).not.toBeNull();
    expect(restoredAct?.title).toBe('Persistent System Audit');
    expect(restoredAct?.activeApplication.pid).toBe(12345);

    const restoredEvents = newRepo.listEnvironmentalEvents({ minRelevance: 0.7 });
    expect(restoredEvents.length).toBeGreaterThanOrEqual(1);
    expect(restoredEvents[0]?.description).toContain('Daemon self-check passed');

    const restoredSnap = newRepo.getSnapshotById(snap.id);
    expect(restoredSnap).not.toBeNull();
    expect(restoredSnap?.currentActivity.title).toBe('Persistent System Audit');

    newDbService.close();
  });

  it('10. Serves REST API endpoints and integrates cleanly into ApeService prompt context', async () => {
    const apeService = new ApeService(
      apeRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      situationalRepo,
    );

    // Prompt context formatting check
    apeService.startOperationalActivity({
      title: 'Writing Automated Vitest Suite',
      description: 'Creating comprehensive unit and integration tests for Milestone 09',
      category: 'coding',
      activeApplication: { name: 'Vitest Runner' },
    });

    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('Situational Awareness:');
    expect(promptContext).toContain('Writing Automated Vitest Suite');
    expect(promptContext).toContain('Vitest Runner');

    const server = createServer();
    const port = await server.start();

    try {
      // 1. POST /api/ape/situational/activity
      const actRes = await fetch(`http://127.0.0.1:${port}/api/ape/situational/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Pair Programming with Proof',
          description: 'Executing autonomous milestones in tandem with Proof',
          category: 'coding',
          activeApplication: { name: 'VS Code' },
        }),
      });
      expect(actRes.status).toBe(201);
      const actData = (await actRes.json()) as any;
      expect(actData.success).toBe(true);
      expect(actData.activity.id).toBeDefined();

      // 2. GET /api/ape/situational/activity
      const getActRes = await fetch(`http://127.0.0.1:${port}/api/ape/situational/activity`);
      expect(getActRes.status).toBe(200);
      const getActData = (await getActRes.json()) as any;
      expect(getActData.title).toBe('Pair Programming with Proof');

      // 3. POST /api/ape/situational/event
      const eventRes = await fetch(`http://127.0.0.1:${port}/api/ape/situational/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'user_input',
          layer: 'foreground',
          description: 'Proof checked in on test results',
          source: 'chat',
          relevanceScore: 0.9,
        }),
      });
      expect(eventRes.status).toBe(201);
      const eventData = (await eventRes.json()) as any;
      expect(eventData.success).toBe(true);

      // 4. GET /api/ape/situational/describe
      const descRes = await fetch(`http://127.0.0.1:${port}/api/ape/situational/describe`);
      expect(descRes.status).toBe(200);
      const descData = (await descRes.json()) as any;
      expect(descData.isCurrentlyEngaged).toBe(true);
      expect(descData.currentActivityDescription).toContain('Pair Programming with Proof');

      // 5. GET /api/ape/situational/snapshot
      const snapRes = await fetch(`http://127.0.0.1:${port}/api/ape/situational/snapshot`);
      expect(snapRes.status).toBe(200);
      const snapData = (await snapRes.json()) as any;
      expect(snapData.id).toBeDefined();
      expect(snapData.situationalNarrative).toContain('Pair Programming with Proof');
    } finally {
      await server.stop();
    }
  });
});
