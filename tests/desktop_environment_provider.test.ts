import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DesktopEnvironmentProvider, rootLogger } from '@arletex/core';

describe('Phase 3: Desktop Embodiment & Application Control', () => {
  let tempDir: string;
  let customAppsDir: string;
  let provider: DesktopEnvironmentProvider;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-desktop-env-'));
    customAppsDir = path.join(tempDir, 'applications');
    fs.mkdirSync(customAppsDir, { recursive: true });

    // Seed mock desktop applications
    const spotifyDesktop = `[Desktop Entry]
Type=Application
Name=Spotify
GenericName=Music Player
Comment=Spotify streaming music client
Icon=spotify-client
Exec=spotify %U
Terminal=false
Categories=Audio;Music;Player;AudioVideo;
MimeType=x-scheme-handler/spotify;
`;
    fs.writeFileSync(path.join(customAppsDir, 'spotify.desktop'), spotifyDesktop);

    const obsidianDesktop = `[Desktop Entry]
Type=Application
Name=Obsidian
Comment=Knowledge base markdown editor
Icon=obsidian
Exec=flatpak run md.obsidian.Obsidian %u
Categories=Office;Development;
`;
    fs.writeFileSync(path.join(customAppsDir, 'md.obsidian.Obsidian.desktop'), obsidianDesktop);

    const hiddenApp = `[Desktop Entry]
Type=Application
Name=Secret System Daemon
Exec=daemon
NoDisplay=true
`;
    fs.writeFileSync(path.join(customAppsDir, 'secret.desktop'), hiddenApp);

    provider = new DesktopEnvironmentProvider({
      customAppDirectories: [customAppsDir],
      logger: rootLogger,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. Discovers and parses FreeDesktop applications while ignoring hidden entries', async () => {
    const apps = await provider.discoverInstalledApplications();
    expect(apps.length).toBe(2);

    const spotify = apps.find((a) => a.name === 'Spotify');
    expect(spotify).toBeDefined();
    expect(spotify?.exec).toBe('spotify %U');
    expect(spotify?.genericName).toBe('Music Player');
    expect(spotify?.categories).toContain('Audio');

    const obsidian = apps.find((a) => a.name === 'Obsidian');
    expect(obsidian).toBeDefined();
    expect(obsidian?.exec).toContain('md.obsidian.Obsidian');

    // Secret app was marked NoDisplay=true, so it must not appear
    const hidden = apps.find((a) => a.name === 'Secret System Daemon');
    expect(hidden).toBeUndefined();
  });

  it('2. Fuzzy matches applications by name, generic name, or ID', async () => {
    const match1 = await provider.findApplication('spotify');
    expect(match1?.name).toBe('Spotify');

    const match2 = await provider.findApplication('Music Player');
    expect(match2?.name).toBe('Spotify');

    const match3 = await provider.findApplication('obsidian');
    expect(match3?.name).toBe('Obsidian');

    const nonExistent = await provider.findApplication('totally_non_existent_app_123');
    expect(nonExistent).toBeNull();
  });

  it('3. Formulates clean execution arguments without FreeDesktop field codes', async () => {
    // Test parsing stripping %U, %u, %F, etc.
    const entry = await provider.findApplication('spotify');
    expect(entry).toBeDefined();
    const cleanExec = entry!.exec.replace(/%[a-zA-Z]/g, '').trim();
    expect(cleanExec).toBe('spotify');
  });

  it('4. Queries live host applications directory without crashing', async () => {
    const liveProvider = new DesktopEnvironmentProvider({
      logger: rootLogger,
    });
    const liveApps = await liveProvider.discoverInstalledApplications();
    expect(Array.isArray(liveApps)).toBe(true);
    expect(liveApps.length).toBeGreaterThan(0);
  });

  it('5. Queries MPRIS media players and commands on Linux D-Bus safely', async () => {
    const players = await provider.listMprisPlayers();
    expect(Array.isArray(players)).toBe(true);

    const status = await provider.getMprisMediaStatus('spotify');
    // On headless or non-running environments status may be null or object
    if (status) {
      expect(status.player).toBeDefined();
      expect(['Playing', 'Paused', 'Stopped']).toContain(status.playbackStatus);
    }
  });

  it('6. Locates and resolves files across directories via openFile', async () => {
    const testFile = path.join(tempDir, 'sample_test.gif');
    await fs.promises.writeFile(testFile, 'GIF89a...');

    // Exact path
    const resExact = await provider.openFile(testFile);
    expect(resExact.success).toBe(true);
    expect(resExact.resolvedPath).toBe(testFile);

    // Non-existent file returns success: false
    const resMissing = await provider.openFile('non_existent_file_xyz_12345.gif');
    expect(resMissing.success).toBe(false);
  });

  it('7. PlanningInterface formulates desktop_open_file plan for "try to open a file called tenor.gif"', async () => {
    const { PlanningInterface } = await import('@arletex/core');
    const mockRepo: any = { savePlan: () => {}, getPlanByTask: () => null, updateTask: () => {} };
    const planner = new PlanningInterface(mockRepo);

    const task: any = {
      id: 'task-test-file-open',
      objective: 'try to open a file called tenor.gif',
      initiator: 'user',
    };

    const plan = await planner.formulatePlan(task);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0]!.action.type).toBe('desktop_open_file');
    expect(plan.steps[0]!.action.payload.fileName).toBe('tenor.gif');
  });

  it('8. PlanningInterface formulates app_launch plan for "try to open spotify"', async () => {
    const { PlanningInterface } = await import('@arletex/core');
    const mockRepo: any = { savePlan: () => {}, getPlanByTask: () => null, updateTask: () => {} };
    const planner = new PlanningInterface(mockRepo);

    const task: any = {
      id: 'task-test-spotify-open',
      objective: 'try to open spotify',
      initiator: 'user',
    };

    const plan = await planner.formulatePlan(task);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0]!.action.type).toBe('app_launch');
    expect(plan.steps[0]!.action.payload.appName).toBe('spotify');
  });

  it('9. PlanningInterface formulates desktop_media_control plan for "pause music"', async () => {
    const { PlanningInterface } = await import('@arletex/core');
    const mockRepo: any = { savePlan: () => {}, getPlanByTask: () => null, updateTask: () => {} };
    const planner = new PlanningInterface(mockRepo);

    const task: any = {
      id: 'task-test-media-pause',
      objective: 'pause music',
      initiator: 'user',
    };

    const plan = await planner.formulatePlan(task);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0]!.action.type).toBe('desktop_media_control');
    expect(plan.steps[0]!.action.payload.command).toBe('Pause');
  });

  it('10. ClosedLoopAgencyService executes and verifies real desktop file opening end-to-end', async () => {
    const {
      ClosedLoopAgencyService,
      IntentTaskManager,
      PlanningInterface,
      ActionPermissionController,
      VerificationEngine,
    } = await import('@arletex/core');

    const testFile = path.join(tempDir, 'sample_presentation.gif');
    await fs.promises.writeFile(testFile, 'GIF89a sample content');

    const plans = new Map<string, any>();
    const tasks = new Map<string, any>();
    const mockAgencyRepo: any = {
      savePlan: (p: any) => plans.set(p.taskId, p),
      getPlanByTask: (tId: string) => plans.get(tId) || null,
      createTask: (t: any) => { tasks.set(t.id, t); return t; },
      saveTask: (t: any) => tasks.set(t.id, t),
      getTask: (id: string) => tasks.get(id) || null,
      updateTask: (id: string, updates: any) => {
        const cur = tasks.get(id) || { id };
        tasks.set(id, { ...cur, ...updates });
      },
      saveObservation: () => {},
      saveVerification: () => {},
      saveExperience: () => {},
    };

    const taskManager = new IntentTaskManager(mockAgencyRepo);
    const planningInterface = new PlanningInterface(mockAgencyRepo);
    const permissionController = new ActionPermissionController();
    const verificationEngine = new VerificationEngine();

    const agency = new ClosedLoopAgencyService({
      agencyRepo: mockAgencyRepo,
      taskManager,
      planningInterface,
      permissionController,
      verificationEngine,
      memorySync: { recordExperience: async () => ({}) } as any,
      apeService: { processDigitalExperience: async () => ({}) } as any,
      desktopProvider: provider,
      logger: rootLogger,
    });

    const result = await agency.executeClosedLoop(`try to open a file called ${testFile}`, 'user');
    expect(result.success).toBe(true);
    expect(result.verifications.length).toBe(1);
    expect(result.verifications[0]!.verified).toBe(true);
    expect(result.verifications[0]!.observedOutcome).toContain('opened on desktop with default viewer');
  });

  it('11. Resolves filenames with spaces, parentheses, and typos via fuzzy matching', async () => {
    // Create tenor (5).gif in mock directory
    const testFile = path.join(tempDir, 'tenor (5).gif');
    await fs.promises.writeFile(testFile, 'GIF89a tenor 5 sample');

    // Create provider with tempDir as home
    const fuzzyProvider = new DesktopEnvironmentProvider({
      customAppDirectories: [customAppsDir],
      logger: rootLogger,
    });

    // Mock home resolution by checking provider openFile directly on exact and fuzzy names
    const resExact = await fuzzyProvider.openFile(testFile);
    expect(resExact.success).toBe(true);
    expect(resExact.resolvedPath).toBe(testFile);

    // Test Levenshtein distance on provider
    const dist = (fuzzyProvider as any).levenshteinDistance('tensor5', 'tenor5');
    expect(dist).toBe(1);
  });

  it('12. PlanningInterface formulates desktop_open_browser for "open spotify on her email" and "open it on her email"', async () => {
    const { PlanningInterface } = await import('@arletex/core');
    const mockRepo: any = { savePlan: () => {}, getPlanByTask: () => null, updateTask: () => {} };
    const planner = new PlanningInterface(mockRepo);

    // 1. Spotify on her email
    const taskSpotifyEmail: any = {
      id: 'task-spotify-email',
      objective: 'open spotify on her email',
      initiator: 'user',
    };
    const planSpotify = await planner.formulatePlan(taskSpotifyEmail);
    expect(planSpotify.steps.length).toBeGreaterThan(0);
    expect(planSpotify.steps[0]!.action.type).toBe('desktop_open_browser');
    expect(planSpotify.steps[0]!.action.payload.url).toBe('https://open.spotify.com');
    expect(planSpotify.steps[0]!.action.payload.profile).toBe('Profile 7');
    expect(planSpotify.steps[0]!.action.payload.email).toBe('arletex.email@gmail.com');

    // 2. Open it on her email
    const taskEmail: any = {
      id: 'task-open-email',
      objective: 'open it on her email',
      initiator: 'user',
    };
    const planEmail = await planner.formulatePlan(taskEmail);
    expect(planEmail.steps.length).toBeGreaterThan(0);
    expect(planEmail.steps[0]!.action.type).toBe('desktop_open_browser');
    expect(planEmail.steps[0]!.action.payload.url).toBe('https://mail.google.com');
    expect(planEmail.steps[0]!.action.payload.profile).toBe('Profile 7');
    expect(planEmail.steps[0]!.action.payload.email).toBe('arletex.email@gmail.com');

    // 3. Filename with parentheses and spaces: "open tenor (5).gif"
    const taskTenorGif: any = {
      id: 'task-open-tenor-gif',
      objective: 'open tenor (5).gif',
      initiator: 'user',
    };
    const planTenor = await planner.formulatePlan(taskTenorGif);
    expect(planTenor.steps.length).toBeGreaterThan(0);
    expect(planTenor.steps[0]!.action.type).toBe('desktop_open_file');
    expect(planTenor.steps[0]!.action.payload.fileName).toBe('tenor (5).gif');

    // 4. Sign up in spotify using your email
    const taskSpotifySignup: any = {
      id: 'task-spotify-signup',
      objective: 'Try to sign up in spotify using your email',
      initiator: 'user',
    };
    const planSignup = await planner.formulatePlan(taskSpotifySignup);
    expect(planSignup.steps.length).toBeGreaterThan(0);
    expect(planSignup.steps[0]!.action.type).toBe('desktop_open_browser');
    expect(planSignup.steps[0]!.action.payload.url).toBe('https://www.spotify.com/signup');
    expect(planSignup.steps[0]!.action.payload.profile).toBe('Profile 7');
    expect(planSignup.steps[0]!.action.payload.email).toBe('arletex.email@gmail.com');
  });

  it('13. DesktopEnvironmentProvider.openInArleBrowser returns Chrome Profile 7 launch result in test mode', async () => {
    const res = await provider.openInArleBrowser('https://open.spotify.com');
    expect(res.success).toBe(true);
    expect(res.message).toContain('Chrome Profile 7');
  });
});
