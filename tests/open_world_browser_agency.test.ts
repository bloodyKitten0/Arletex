import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  OpenWorldBrowserAgency,
  ActionPermissionController,
  AutobiographicalMemoryService,
  rootLogger,
  IBrowserProvider,
  PageObservation,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  MemoryRepository,
} from '@arletex/database';

describe('Phase 2: Open-World Browser Agency (General-Purpose Internet Operator)', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let memoryRepo: MemoryRepository;
  let memoryService: AutobiographicalMemoryService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-openworld-browser-'));
    dbPath = path.join(tempDir, 'browser_test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();
    memoryRepo = new MemoryRepository(db);
    memoryService = new AutobiographicalMemoryService(memoryRepo, rootLogger);
  });

  it('1. Understands varied intents across arbitrary platforms without website-specific restriction', () => {
    const agency = new OpenWorldBrowserAgency({
      browserProvider: {} as any,
    });

    // 1a. Spotify music playback
    const spotifyIntent = agency.understandIntent('Play Beethoven Moonlight Sonata on Spotify');
    expect(spotifyIntent.category).toBe('media_playback');
    expect(spotifyIntent.targetPlatform).toBe('spotify');
    expect(spotifyIntent.expectedMediaState).toBe('playing');
    expect(spotifyIntent.searchQuery).toContain('Beethoven Moonlight Sonata');

    // 1b. PubMed medical research
    const pubmedIntent = agency.understandIntent('Look up mRNA vaccine clinical trials on PubMed');
    expect(pubmedIntent.category).toBe('document_reading');
    expect(pubmedIntent.targetPlatform).toBe('pubmed');
    expect(pubmedIntent.searchQuery).toContain('mRNA vaccine clinical trials');

    // 1c. arXiv scientific paper
    const arxivIntent = agency.understandIntent('Find recent papers on transformer architecture on arXiv');
    expect(arxivIntent.category).toBe('document_reading');
    expect(arxivIntent.targetPlatform).toBe('arxiv');

    // 1d. Direct URL navigation
    const directIntent = agency.understandIntent('Go to https://github.com/trending and see top projects');
    expect(directIntent.category).toBe('direct_navigation');
    expect(directIntent.targetUrl).toBe('https://github.com/trending');
  });

  it('2. Resolves canonical URLs across arbitrary domains dynamically', () => {
    const agency = new OpenWorldBrowserAgency({
      browserProvider: {} as any,
    });

    const spotifyUrl = agency.resolveInitialUrl({
      rawObjective: 'play music',
      category: 'media_playback',
      targetPlatform: 'spotify',
      searchQuery: 'Chopin Nocturne',
    });
    expect(spotifyUrl).toBe('https://open.spotify.com/search/Chopin%20Nocturne');

    const pubmedUrl = agency.resolveInitialUrl({
      rawObjective: 'medical study',
      category: 'document_reading',
      targetPlatform: 'pubmed',
      searchQuery: 'glioblastoma immunotherapy',
    });
    expect(pubmedUrl).toBe('https://pubmed.ncbi.nlm.nih.gov/?term=glioblastoma%20immunotherapy');

    const genericUrl = agency.resolveInitialUrl({
      rawObjective: 'general query',
      category: 'information_research',
      targetPlatform: 'generic',
      searchQuery: 'quantum computing coherence time',
    });
    expect(genericUrl).toBe('https://html.duckduckgo.com/html/?q=quantum%20computing%20coherence%20time');
  });

  it('3. Rejects SSRF, internal metadata, and private IP URLs fail-closed', async () => {
    const agency = new OpenWorldBrowserAgency({
      browserProvider: {
        navigate: async () => ({}) as any,
      } as any,
    });

    await expect(agency.executeBrowserObjective('https://127.0.0.1:8080/admin')).rejects.toThrow(
      /Security policy blocked URL/,
    );
    await expect(agency.executeBrowserObjective('https://169.254.169.254/latest/meta-data')).rejects.toThrow(
      /Security policy blocked URL/,
    );
    await expect(agency.executeBrowserObjective('https://localhost:3000')).rejects.toThrow(
      /Security policy blocked URL/,
    );
  });

  it('4. Executes full 8-phase cycle: navigates, dismisses modals, verifies media playback, records memory', async () => {
    let clickedSelectors: string[] = [];
    let dialogsDismissed = false;

    const mockProvider: IBrowserProvider = {
      navigate: async (url: string): Promise<PageObservation> => ({
        url,
        title: 'Spotify - Chopin Nocturne Op. 9 No. 2',
        hasVideoElement: false,
        hasAudioElement: true,
        hasMediaElement: true,
        isPlaying: false, // Initially paused before interaction
        playbackProgressing: false,
        playbackState: 'paused',
        textSnippet: 'Chopin Nocturne Op. 9 No. 2 by Arthur Rubinstein. Classical Piano.',
        headings: ['Chopin: Nocturnes'],
        links: [],
        statusCode: 200,
      }),
      getPageDetails: async (): Promise<PageObservation> => ({
        url: 'https://open.spotify.com/track/12345',
        title: 'Spotify - Chopin Nocturne Op. 9 No. 2',
        hasVideoElement: false,
        hasAudioElement: true,
        hasMediaElement: true,
        isPlaying: true, // Now playing after play button click
        playbackProgressing: true,
        playbackState: 'playing',
        textSnippet: 'Now playing Chopin Nocturne Op. 9 No. 2',
        headings: [],
        links: [],
        statusCode: 200,
      }),
      click: async (selector: string): Promise<void> => {
        clickedSelectors.push(selector);
      },
      dismissDialogsAndModals: async (): Promise<boolean> => {
        dialogsDismissed = true;
        return true;
      },
      search: async () => [],
      searchVideos: async () => [],
      typeText: async () => {},
      close: async () => {},
    };

    const agency = new OpenWorldBrowserAgency({
      browserProvider: mockProvider,
      autobiographicalMemory: memoryService,
      logger: rootLogger,
    });

    const result = await agency.executeBrowserObjective('Play Chopin Nocturne on Spotify');

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);
    expect(result.verificationEvidence.mediaPlaying).toBe(true);
    expect(dialogsDismissed).toBe(true);
    expect(clickedSelectors.length).toBeGreaterThan(0);
    expect(result.memoryCommitted).toBeDefined();

    // Verify autobiographical memory entry was persisted
    const memories = memoryService.retrieveAssociativeContext('Chopin');
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0]?.memory.content).toContain('Chopin');
  });

  it('5. Fails verification honestly when media playback cannot be achieved', async () => {
    const mockStalledProvider: IBrowserProvider = {
      navigate: async (url: string): Promise<PageObservation> => ({
        url,
        title: 'Music Site - Blocked Player',
        hasVideoElement: true,
        isPlaying: false,
        playbackProgressing: false,
        playbackState: 'stalled',
        textSnippet: 'Media playback blocked by browser permissions',
        headings: [],
        links: [],
        statusCode: 200,
        playbackError: 'Autoplay policy blocked playback',
      }),
      getPageDetails: async (): Promise<PageObservation> => ({
        url: 'https://stalled.example.com',
        title: 'Music Site - Blocked Player',
        hasVideoElement: true,
        isPlaying: false,
        playbackProgressing: false,
        playbackState: 'stalled',
        textSnippet: 'Media playback blocked',
        headings: [],
        links: [],
        statusCode: 200,
        playbackError: 'Autoplay policy blocked playback',
      }),
      click: async () => {
        throw new Error('Play button not found');
      },
      search: async () => [],
      searchVideos: async () => [],
      typeText: async () => {},
      close: async () => {},
    };

    const agency = new OpenWorldBrowserAgency({
      browserProvider: mockStalledProvider,
      autobiographicalMemory: memoryService,
      logger: rootLogger,
    });

    const result = await agency.executeBrowserObjective('Play Beethoven Symphony on Spotify');

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.verificationEvidence.error).toContain('Autoplay policy blocked playback');
    expect(result.memoryCommitted).toBeUndefined(); // Never fabricate success memories for failed executions
  });
});
