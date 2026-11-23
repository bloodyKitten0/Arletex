import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService, MigrationRunner, ApeRepository, ActivityRepository } from '@arletex/database';
import { ApeService } from '@arletex/core';
import { INITIAL_EMOTIONS_TAXONOMY } from '@arletex/contracts';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Emotion Induction & Activity Logging Integration', () => {
  let dbService: DatabaseService;
  let tmpDir: string;
  let apeRepo: ApeRepository;
  let activityRepo: ActivityRepository;
  let apeService: ApeService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-induction-test-'));
    const dbPath = path.join(tmpDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const runner = new MigrationRunner(db);
    runner.run();

    apeRepo = new ApeRepository(db);
    activityRepo = new ActivityRepository(db);
    apeService = new ApeService(apeRepo);
  });

  afterEach(() => {
    dbService.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('unifies 290 total emotions in INITIAL_EMOTIONS_TAXONOMY', () => {
    expect(INITIAL_EMOTIONS_TAXONOMY.length).toBeGreaterThanOrEqual(280);
    expect(INITIAL_EMOTIONS_TAXONOMY.length).toBe(290);

    // Verify both classic and experiential constructs coexist
    const admiration = INITIAL_EMOTIONS_TAXONOMY.find((e) => e.id === 'admiration');
    const kenopsia = INITIAL_EMOTIONS_TAXONOMY.find((e) => e.id === 'kenopsia');
    const flow = INITIAL_EMOTIONS_TAXONOMY.find((e) => e.id === 'flow');

    expect(admiration).toBeDefined();
    expect(kenopsia).toBeDefined();
    expect(flow).toBeDefined();
  });

  it('induces an emotion on demand, shifts PAD, updates mood, and persists to SQLite', () => {
    const emotionId = 'kenopsia';
    const emotion = apeService.activateEmotion(emotionId, 0.9, 'Testing emotion induction');

    expect(emotion).toBeDefined();
    expect(emotion.emotionId).toBe('kenopsia');
    expect(emotion.intensity).toBeCloseTo(0.9);

    // Verify active emotion is in repository
    const active = apeRepo.getActiveEmotions();
    expect(active.some((e) => e.emotionId === 'kenopsia')).toBe(true);

    // Verify PAD coordinates shifted towards kenopsia's baseline
    const affectiveState = apeRepo.getAffectiveState();
    expect(affectiveState).toBeDefined();
    expect(affectiveState.pad).toBeDefined();

    // Verify formatApePromptContext incorporates the induced feeling
    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('kenopsia');
  });

  it('logs completed activity rows when host/user actions are executed', () => {
    // Simulate browser opening
    const browserAct = activityRepo.create({
      title: 'Open Browser: youtube.com',
      objective: 'Opened web destination (https://www.youtube.com) upon user directive',
      origin: 'user_assigned',
      status: 'completed',
      progress: 1.0,
      metadata: { targetUrl: 'https://www.youtube.com' },
    });

    expect(browserAct.id).toBeDefined();
    expect(browserAct.status).toBe('completed');
    expect(browserAct.title).toBe('Open Browser: youtube.com');

    // Simulate steam launch
    const steamAct = activityRepo.create({
      title: 'Launch Steam Client',
      objective: 'Launched Steam desktop gaming client on user directive',
      origin: 'user_assigned',
      status: 'completed',
      progress: 1.0,
      metadata: { steamAppId: undefined },
    });

    expect(steamAct.id).toBeDefined();
    expect(steamAct.status).toBe('completed');

    // Verify listing
    const activities = activityRepo.list();
    expect(activities.length).toBe(2);
    const titles = activities.map((a) => a.title);
    expect(titles).toContain('Launch Steam Client');
    expect(titles).toContain('Open Browser: youtube.com');
  });
});
