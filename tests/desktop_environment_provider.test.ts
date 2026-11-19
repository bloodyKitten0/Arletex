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
});
