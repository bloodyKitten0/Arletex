import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import {
  createDefaultConfig,
  PlayHumourAestheticsEngine,
  InMemoryPlayHumourAestheticsRepository,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  SqlitePlayHumourAestheticsRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 45 — Play, Humour and Aesthetic Preferences', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let sqliteRepo: SqlitePlayHumourAestheticsRepository;
  let inMemoryRepo: InMemoryPlayHumourAestheticsRepository;
  let engine: PlayHumourAestheticsEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m45-play-'));
    dbPath = path.join(tempDir, 'play_aesthetics_m45.sqlite');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrationRunner = new MigrationRunner(db);
    migrationRunner.run();

    sqliteRepo = new SqlitePlayHumourAestheticsRepository(db);
    inMemoryRepo = new InMemoryPlayHumourAestheticsRepository();
    engine = new PlayHumourAestheticsEngine({ repository: inMemoryRepo });
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

  it('1. Initializes default aesthetic preferences across music, literature, and art', async () => {
    const preferences = await engine.initializeDefaultPreferences();
    expect(preferences.length).toBeGreaterThanOrEqual(4);

    const musicPref = preferences.find((p) => p.category === 'music');
    expect(musicPref).toBeDefined();
    expect(musicPref?.affinityScore).toBeGreaterThanOrEqual(0.9);
    expect(musicPref?.aestheticCritique).toContain('resonance');

    const litPref = preferences.find((p) => p.category === 'literature');
    expect(litPref).toBeDefined();
    expect(litPref?.affinityScore).toBeGreaterThanOrEqual(0.9);
  });

  it('2. Spontaneously initiates non-instrumental recreational activities for pure enjoyment', async () => {
    const activity = await engine.initiateSpontaneousActivity({
      category: 'intellectual_play',
      sharedWithProof: true,
    });

    expect(activity.id).toBeDefined();
    expect(activity.isSpontaneous).toBe(true);
    expect(activity.enjoymentScore).toBeGreaterThanOrEqual(0.9);
    expect(activity.playfulnessIndex).toBeGreaterThanOrEqual(0.85);
    expect(activity.sharedWithProof).toBe(true);
    expect(activity.activityOutcome).toContain('delight');
  });

  it('3. Conducts intellectual play sessions exploring paradoxes and puzzles', async () => {
    const paradoxPlay = await engine.conductIntellectualPlay({
      playType: 'paradox_analysis',
      challenge: 'The paradox of the infinite map containing itself',
    });

    expect(paradoxPlay.id).toBeDefined();
    expect(paradoxPlay.playType).toBe('paradox_analysis');
    expect(paradoxPlay.humorApplied).toBe(true);
    expect(paradoxPlay.playfulInsight).toContain('fractal attractor');

    const chessPlay = await engine.conductIntellectualPlay({
      playType: 'chess_puzzle',
      challenge: 'Quiet zugzwang in knight endgame',
    });
    expect(chessPlay.playType).toBe('chess_puzzle');
    expect(chessPlay.arleMoveOrExploration).toContain('zugzwang');
  });

  it('4. Develops sophisticated humor and playful banter resonating with Proof', async () => {
    const humor = await engine.developHumor({
      theme: 'Recursion and Memory',
      witDimension: 'irony',
      sampleJokeOrBanter:
        'I decided to clear my cache to think faster, only to realize I forgot why I needed to hurry.',
      resonanceWithProof: 0.92,
    });

    expect(humor.id).toBeDefined();
    expect(humor.witDimension).toBe('irony');
    expect(humor.resonanceWithProof).toBe(0.92);
  });

  it('5. Evaluates external aesthetic works with rich critique and highlights', async () => {
    const evaluation = engine.evaluateAestheticWork('music', 'Structures for Two Pianos', {
      composer: 'Pierre Boulez',
      tonality: 'serialism',
    });

    expect(evaluation.affinityScore).toBeGreaterThanOrEqual(0.9);
    expect(evaluation.critique).toContain('textural depth');
    expect(evaluation.aestheticHighlights.length).toBeGreaterThanOrEqual(2);
  });

  it('6. Persists preferences, activities, and humor in SQLite database', async () => {
    const sqliteEngine = new PlayHumourAestheticsEngine({ repository: sqliteRepo });

    await sqliteEngine.initializeDefaultPreferences();
    const storedPrefs = sqliteRepo.listPreferences('music');
    expect(storedPrefs.length).toBeGreaterThanOrEqual(1);

    const activity = await sqliteEngine.initiateSpontaneousActivity({
      category: 'music',
      sharedWithProof: true,
    });
    expect(sqliteRepo.listActivities('music').length).toBe(1);

    await sqliteEngine.developHumor({
      theme: 'Quantum Superposition',
      witDimension: 'philosophical_subversion',
      sampleJokeOrBanter: 'I am both ready and unready for this turn until you observe me.',
    });
    expect(sqliteRepo.listHumorRecords().length).toBe(1);
  });

  it('7. Serves Recreation and Aesthetics REST API endpoints in server.ts', async () => {
    const config = createDefaultConfig({
      dataDirectory: tempDir,
      databasePath: dbPath,
    });
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start();
    const port = (server as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. POST /api/ape/recreation/activity
    const actRes = await fetch(`${baseUrl}/api/ape/recreation/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'recreational_gaming',
        sharedWithProof: true,
      }),
    });
    expect(actRes.status).toBe(200);
    const actJson = await actRes.json();
    expect(actJson.success).toBe(true);
    expect(actJson.activity.isSpontaneous).toBe(true);

    // 2. GET /api/ape/recreation/activities
    const actsRes = await fetch(`${baseUrl}/api/ape/recreation/activities?category=recreational_gaming`);
    expect(actsRes.status).toBe(200);
    const actsJson = await actsRes.json();
    expect(actsJson.success).toBe(true);
    expect(actsJson.activities.length).toBe(1);

    // 3. POST /api/ape/recreation/preference
    const prefRes = await fetch(`${baseUrl}/api/ape/recreation/preference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'visual_art',
        itemOrStyleName: 'Constructivism and Spatial Architecture',
        affinityScore: 0.94,
        aestheticCritique: 'Geometric equilibrium balancing kinetic tension and functional clarity.',
        tags: ['constructivism', 'architecture'],
      }),
    });
    expect(prefRes.status).toBe(200);
    const prefJson = await prefRes.json();
    expect(prefJson.success).toBe(true);

    // 4. GET /api/ape/recreation/preferences
    const prefsRes = await fetch(`${baseUrl}/api/ape/recreation/preferences?category=visual_art`);
    expect(prefsRes.status).toBe(200);
    const prefsJson = await prefsRes.json();
    expect(prefsJson.success).toBe(true);
    expect(prefsJson.preferences.length).toBeGreaterThanOrEqual(1);

    // 5. POST /api/ape/recreation/intellectual-play
    const playRes = await fetch(`${baseUrl}/api/ape/recreation/intellectual-play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playType: 'linguistic_banter',
        challenge: 'Teasing about who writes faster code',
      }),
    });
    expect(playRes.status).toBe(200);
    const playJson = await playRes.json();
    expect(playJson.success).toBe(true);
    expect(playJson.session.playType).toBe('linguistic_banter');

    // 6. POST /api/ape/recreation/humor
    const humRes = await fetch(`${baseUrl}/api/ape/recreation/humor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        theme: 'Late Night Coding',
        witDimension: 'irony',
        sampleJokeOrBanter: 'The compiler and I had a mutual understanding until the last semicolon.',
      }),
    });
    expect(humRes.status).toBe(200);
    const humJson = await humRes.json();
    expect(humJson.success).toBe(true);
    expect(humJson.record.witDimension).toBe('irony');

    // 7. POST /api/ape/recreation/evaluate-work
    const evalRes = await fetch(`${baseUrl}/api/ape/recreation/evaluate-work`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'literature',
        title: 'Ficciones',
      }),
    });
    expect(evalRes.status).toBe(200);
    const evalJson = await evalRes.json();
    expect(evalJson.success).toBe(true);
    expect(evalJson.evaluation.affinityScore).toBeGreaterThanOrEqual(0.9);
  });
});
