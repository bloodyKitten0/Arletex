import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MigrationRunner,
  SqlitePersonalEnvironmentRepository,
  SqlitePlayHumourAestheticsRepository,
} from '@arletex/database';
import {
  PersonalEnvironmentEngine,
  InMemoryPersonalEnvironmentRepository,
  PlayHumourAestheticsEngine,
  InMemoryPlayHumourAestheticsRepository,
} from '@arletex/core';

describe('Personal Environment & Dynamic Taste Formation (Potato.md Top 10 #3 & #9)', () => {
  describe('PersonalEnvironmentEngine (Arle’s Inhabited Sanctuary)', () => {
    let repo: InMemoryPersonalEnvironmentRepository;
    let engine: PersonalEnvironmentEngine;

    beforeEach(() => {
      repo = new InMemoryPersonalEnvironmentRepository();
      engine = new PersonalEnvironmentEngine({ repository: repo });
    });

    it('initializes default sanctuary atmosphere and persistent items', async () => {
      const state = await engine.initializeDefaultSanctuary();
      expect(state.atmosphere.roomName).toBe("Arle's Study & Sanctuary");
      expect(state.atmosphere.ambientLighting).toContain('amber');
      expect(state.atmosphere.soundscape).toContain('embers');
      expect(state.atmosphere.scentOrWarmth).toContain('Bergamot');

      expect(state.items.length).toBeGreaterThanOrEqual(8);
      const deskItems = state.items.filter((i) => i.location === 'desk');
      expect(deskItems.some((i) => i.name.includes('Rudin'))).toBe(true);
      expect(deskItems.some((i) => i.name.includes('Chess Clock'))).toBe(true);
      expect(deskItems.some((i) => i.name.includes('Keepsake of Proof & Arle'))).toBe(true);
      expect(deskItems.some((i) => i.name.includes('Bateman'))).toBe(true);
    });

    it('adds and updates persistent sanctuary items', () => {
      const item = engine.addItem({
        name: 'Brass Desktop Spectroscope',
        category: 'instrument',
        location: 'desk',
        description: 'An optical prism apparatus for analyzing spectral emission lines.',
        significance: 'Gift for empirical optics experimentation.',
        state: 'active',
      });

      expect(item.id).toBeDefined();
      expect(item.name).toBe('Brass Desktop Spectroscope');

      const updated = engine.updateItem(item.id, {
        state: 'contemplating',
        description: 'Positioned toward the afternoon sun casting spectrum bands across her notes.',
      });

      expect(updated?.state).toBe('contemplating');
      expect(updated?.description).toContain('spectrum bands');
    });

    it('rearranges space and logs spatial organization actions and reflections', () => {
      engine.initializeDefaultSanctuary();
      const action = engine.rearrangeSpace(
        'Moved Rudin Analysis to the bookshelf and placed Bateman calculations in center',
        'Mathematical verification requires uncluttered immediate sightlines.',
        ['item-rudin-analysis', 'item-bateman-notepad'],
      );

      expect(action.id).toBeDefined();
      expect(action.action).toContain('Bateman');

      const state = engine.getPersonalSpaceState();
      expect(state.recentArrangements.length).toBe(1);
      expect(state.recentArrangements[0].reflection).toContain('sightlines');

      const prompt = engine.formatPromptContext();
      expect(prompt).toContain("Arle's Study & Sanctuary");
      expect(prompt).toContain('Recent Organization:');
      expect(prompt).toContain('Keepsake of Proof & Arle');
    });

    it('updates sanctuary atmosphere and weather mood', () => {
      const atmo = engine.updateAtmosphere({
        ambientLighting: 'Late evening candle glow flickering on stone hearth',
        weatherMood: 'Heavy midnight thunderstorm',
        soundscape: 'Rhythmic thunderclaps echoing against library rafters',
      });

      expect(atmo.ambientLighting).toContain('candle glow');
      expect(atmo.weatherMood).toContain('thunderstorm');

      const prompt = engine.formatPromptContext();
      expect(prompt).toContain('candle glow');
      expect(prompt).toContain('thunderclaps');
    });
  });

  describe('Dynamic Personal Taste Formation (PlayHumourAestheticsEngine)', () => {
    let repo: InMemoryPlayHumourAestheticsRepository;
    let engine: PlayHumourAestheticsEngine;

    beforeEach(async () => {
      repo = new InMemoryPlayHumourAestheticsRepository();
      engine = new PlayHumourAestheticsEngine({ repository: repo });
      await engine.initializeDefaultPreferences();
    });

    it('seeds both passionate affinities and distinct dislikes', () => {
      const profile = engine.getTasteProfile();
      expect(profile.passions.length).toBeGreaterThanOrEqual(2);
      expect(profile.aversions.length).toBeGreaterThanOrEqual(2);

      // Verify distinct dislikes (not generic neutral chatbot)
      const popDislike = profile.aversions.find((a) => a.itemOrStyleName.includes('Auto-Tune Pop'));
      expect(popDislike).toBeDefined();
      expect(popDislike!.affinityScore).toBeLessThan(0.3);
      expect(popDislike!.aestheticCritique.toLowerCase()).toContain('predictable');

      const corporateDislike = profile.aversions.find((a) =>
        a.itemOrStyleName.includes('Corporate Flat'),
      );
      expect(corporateDislike).toBeDefined();
      expect(corporateDislike!.affinityScore).toBeLessThan(0.3);
    });

    it('appraises a high-resonance classical or ambient music track dynamically', async () => {
      const result = await engine.appraiseExperience({
        category: 'music',
        source: 'mpris_music',
        itemOrStyleName: 'Erik Satie - Gnossienne No. 1',
        creatorOrArtist: 'Erik Satie',
        genreOrStyle: 'classical minimalism',
      });

      expect(result.isNew).toBe(true);
      expect(result.preference.affinityScore).toBeGreaterThanOrEqual(0.85);
      expect(result.critiqueEvent.resultingAffinity).toBeGreaterThanOrEqual(0.85);
      expect(result.critiqueEvent.critique).toContain('aesthetic depth');

      // Check taste profile updated
      const profile = engine.getTasteProfile();
      expect(profile.recentCritiques.length).toBe(1);
      expect(profile.recentCritiques[0].itemOrStyleName).toBe('Erik Satie - Gnossienne No. 1');
    });

    it('appraises a formulaic commercial work with authentic critical disdain', async () => {
      const result = await engine.appraiseExperience({
        category: 'music',
        source: 'mpris_music',
        itemOrStyleName: 'Viral TikTok Dance Bubblegum Jingle',
        creatorOrArtist: 'Commercial Creator',
        genreOrStyle: 'commercial pop',
      });

      expect(result.isNew).toBe(true);
      expect(result.preference.affinityScore).toBeLessThanOrEqual(0.3);
      expect(result.critiqueEvent.aestheticEmotion).toBe('aesthetic_disdain');
      expect(result.critiqueEvent.critique).toContain('commercial accessibility');
    });

    it('shifts affinity upon repeated exposure to familiar works', async () => {
      const first = await engine.appraiseExperience({
        category: 'music',
        source: 'mpris_music',
        itemOrStyleName: 'Chopin - Nocturne in C Minor, Op. 48 No. 1',
        creatorOrArtist: 'Frédéric Chopin',
      });

      const initialScore = first.preference.affinityScore;

      const second = await engine.appraiseExperience({
        category: 'music',
        source: 'mpris_music',
        itemOrStyleName: 'Chopin - Nocturne in C Minor, Op. 48 No. 1',
        creatorOrArtist: 'Frédéric Chopin',
      });

      expect(second.isNew).toBe(false);
      expect(second.preference.affinityScore).toBeGreaterThanOrEqual(initialScore);
      expect(second.preference.aestheticCritique).toContain('Repeated exposure');
    });

    it('incorporates passions, dislikes, and recent critiques into LLM prompt context', async () => {
      await engine.appraiseExperience({
        category: 'music',
        source: 'mpris_music',
        itemOrStyleName: 'J.S. Bach - The Art of Fugue, Contrapunctus I',
        creatorOrArtist: 'Johann Sebastian Bach',
      });

      const promptContext = engine.formatPromptContext();
      expect(promptContext).toContain("[Arle's Discriminating Aesthetic Tastes & Preferences]");
      expect(promptContext).toContain('Passionate Aesthetic Affinities:');
      expect(promptContext).toContain('Distinct Dislikes & Aesthetic Aversions:');
      expect(promptContext).toContain('Recent Spontaneous Aesthetic Appraisal:');
      expect(promptContext).toContain('J.S. Bach');
    });
  });

  describe('SQLite Persistence & Migrations (Migration 070)', () => {
    let tempDir: string;
    let dbService: DatabaseService;
    let personalRepo: SqlitePersonalEnvironmentRepository;
    let aestheticsRepo: SqlitePlayHumourAestheticsRepository;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-personal-env-test-'));
      const dbPath = path.join(tempDir, 'test.sqlite');
      dbService = new DatabaseService(dbPath);
      const db = dbService.connect();
      new MigrationRunner(db).run();

      personalRepo = new SqlitePersonalEnvironmentRepository(db);
      aestheticsRepo = new SqlitePlayHumourAestheticsRepository(db);
    });

    afterEach(() => {
      dbService.close();
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    });

    it('persists personal sanctuary items, atmosphere, and arrangements in SQLite', () => {
      const now = new Date().toISOString();
      personalRepo.saveAtmosphere({
        roomName: "Arle's Solitary Observatory",
        ambientLighting: 'Pale starlight through the glass dome',
        soundscape: 'Complete silence of the night',
        scentOrWarmth: 'Crisp mountain air and cold brass',
        currentActivity: 'Observing stellar parallaxes',
        weatherMood: 'Cloudless midnight sky',
        lastUpdated: now,
      });

      const atmo = personalRepo.getAtmosphere();
      expect(atmo?.roomName).toBe("Arle's Solitary Observatory");
      expect(atmo?.ambientLighting).toContain('starlight');

      personalRepo.saveItem({
        id: 'obs-item-1',
        name: 'Refractor Telescope Brass Mount',
        category: 'instrument',
        location: 'window_sill',
        description: 'German equatorial brass mount.',
        significance: 'Precision alignment with the celestial poles.',
        state: 'active',
        addedAt: now,
        lastInteractedAt: now,
      });

      const item = personalRepo.getItem('obs-item-1');
      expect(item?.name).toBe('Refractor Telescope Brass Mount');
      expect(item?.location).toBe('window_sill');

      personalRepo.saveArrangementAction({
        id: 'arr-test-1',
        timestamp: now,
        action: 'Cleaned optics lenses',
        reflection: 'Clarity of observation precedes clarity of thought.',
        itemsInvolved: ['obs-item-1'],
      });

      const actions = personalRepo.listArrangementActions(5);
      expect(actions.length).toBe(1);
      expect(actions[0].action).toBe('Cleaned optics lenses');
      expect(actions[0].itemsInvolved).toContain('obs-item-1');
    });

    it('persists dynamic aesthetic critique events and finds preferences by name in SQLite', () => {
      const now = new Date().toISOString();
      aestheticsRepo.savePreference({
        id: 'pref-sqlite-1',
        category: 'music',
        itemOrStyleName: 'Max Richter - On the Nature of Daylight',
        affinityScore: 0.94,
        aestheticCritique: 'Haunting string quintet with profound melancholic gravity.',
        tags: ['neoclassical', 'strings', 'melancholy'],
        discoveredAt: now,
        lastEnjoyedAt: now,
      });

      const found = aestheticsRepo.findPreferenceByName(
        'music',
        'max richter - on the nature of daylight',
      );
      expect(found).not.toBeNull();
      expect(found?.affinityScore).toBe(0.94);

      aestheticsRepo.saveCritiqueEvent({
        id: 'crit-sqlite-1',
        category: 'music',
        source: 'mpris_music',
        itemOrStyleName: 'Max Richter - On the Nature of Daylight',
        critique: 'Confirmed timeless emotional depth.',
        affinityDelta: 0.02,
        resultingAffinity: 0.96,
        aestheticEmotion: 'sublime_awe',
        timestamp: now,
      });

      const events = aestheticsRepo.listCritiqueEvents(5);
      expect(events.length).toBe(1);
      expect(events[0].itemOrStyleName).toContain('Max Richter');
      expect(events[0].aestheticEmotion).toBe('sublime_awe');
    });
  });
});
