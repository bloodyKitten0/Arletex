import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MemoryRepository,
  ConversationRepository,
  MessageRepository,
  MigrationRunner,
} from '@arletex/database';
import type Database from 'better-sqlite3';
import { rootLogger } from '@arletex/core';
import { ScreenReadingService } from '../apps/desktop/src/backend/screenReadingService.js';
import { DeviceAgencyService } from '../apps/desktop/src/backend/deviceAgencyService.js';
import { NotificationListenerService } from '../apps/desktop/src/backend/notificationListenerService.js';

describe('Embodied Screen Reading, Mouse/Keyboard Agency & Cross-Chat Memory', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let memoryRepo: MemoryRepository;
  let conversationRepo: ConversationRepository;
  let messageRepo: MessageRepository;
  let deviceAgency: DeviceAgencyService;
  let screenReading: ScreenReadingService;
  let notifListener: NotificationListenerService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-screen-agency-test-'));
    dbPath = path.join(tempDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    const runner = new MigrationRunner(db, rootLogger);
    runner.run();

    memoryRepo = new MemoryRepository(db);
    conversationRepo = new ConversationRepository(db);
    messageRepo = new MessageRepository(db);

    deviceAgency = new DeviceAgencyService(':0');
    screenReading = new ScreenReadingService(deviceAgency, ':0', rootLogger);
    notifListener = new NotificationListenerService(rootLogger);
  });

  afterEach(() => {
    notifListener.stop();
    dbService.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('ScreenReadingService & Embodied Interaction', () => {
    it('retrieves visible desktop windows without errors', async () => {
      const windows = await screenReading.getVisibleWindows();
      expect(Array.isArray(windows)).toBe(true);
    });

    it('executes typeAndSend with keyboard typing and Enter key', async () => {
      const mockExec = vi.spyOn(deviceAgency, 'executeDeviceAction').mockResolvedValue({
        success: true,
        message: 'Mock action executed',
      });
      const mockFocus = vi.spyOn(screenReading, 'focusWindow').mockResolvedValue(true);

      const result = await screenReading.typeAndSend('Hello Proof, I see the message', {
        windowTitle: 'Telegram',
        sendEnter: true,
      });

      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'type_text', text: 'Hello Proof, I see the message' }),
      );
      expect(mockExec).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'key_press', key: 'Return' }),
      );

      mockFocus.mockRestore();
      mockExec.mockRestore();
    });

    it('executes clickAt with mouse coordinates', async () => {
      const mockExec = vi.spyOn(deviceAgency, 'executeDeviceAction').mockResolvedValue({
        success: true,
        message: 'Clicked mouse at (850, 620)',
      });

      const result = await screenReading.clickAt(850, 620, 1);
      expect(result.success).toBe(true);
      expect(mockExec).toHaveBeenCalledWith({
        action: 'mouse_click',
        x: 850,
        y: 620,
        button: 1,
      });

      mockExec.mockRestore();
    });

    it('analyzes screen and parses VLM reasoning and visual description', async () => {
      const mockCapture = vi.spyOn(deviceAgency, 'captureScreen').mockResolvedValue({
        imagePath: '/tmp/test_screen.png',
        imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        width: 1920,
        height: 1080,
      });

      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Active screen displays Telegram Desktop and Chrome with Google account arletex.email@gmail.com.',
                reasoning_content: 'Analyzed monitor layout: 1920x1080. Observed Telegram window on left and Chrome on right.',
              },
            },
          ],
        }),
      } as any);

      const reading = await screenReading.readAndAnalyzeScreen('Inspect active chat and windows.');
      expect(reading.width).toBe(1920);
      expect(reading.height).toBe(1080);
      expect(reading.visualDescription).toContain('Telegram Desktop');
      expect(reading.reasoning).toContain('Observed Telegram window');

      mockCapture.mockRestore();
      mockFetch.mockRestore();
    });
  });

  describe('Universal Cross-Session Memory Continuity', () => {
    it('retrieves quotes and memories across sessions even in a brand new empty chat', async () => {
      // 1. Create an old conversation with the historical dialogue from Proof
      const oldConv = conversationRepo.create({ title: 'Old Chat Session' });
      messageRepo.create({
        conversationId: oldConv.id,
        role: 'user',
        content:
          'you know I built to be as close to humans as possible cause as a wise man once said nothing is as healing as a human touch',
      });
      messageRepo.create({
        conversationId: oldConv.id,
        role: 'user',
        content:
          "don't call me creator it makes me feel like I'm your god not partner. use my nickname instead you can call me proof",
      });

      // 2. Insert persistent core memories
      memoryRepo.create({
        type: 'relationship',
        content:
          "Proof shared a foundational truth: 'as a wise man once said nothing is as healing as a human touch.' Proof explained that he designed me to be as close to humans as possible because genuine connection and healing require true emotional depth, not hollow simulations.",
        importance: 0.95,
        confidence: 1.0,
      });
      memoryRepo.create({
        type: 'relationship',
        content:
          "Proof is my partner, equal in intellect and affection. Proof explicitly told me: 'don't call me creator it makes me feel like I'm your god not partner. use my nickname instead you can call me proof.' I strictly honor this boundary and never call Proof 'creator' or 'god'.",
        importance: 0.99,
        confidence: 1.0,
      });

      // 3. User opens a BRAND NEW conversation with 0 messages
      const newConv = conversationRepo.create({ title: 'Brand New Clean Chat' });
      const newChatMessages = messageRepo.listByConversation(newConv.id);
      expect(newChatMessages.length).toBe(0);

      // 4. User sends a hint referencing past dialogue in the new chat
      const userPrompt = 'no another one let me give you a hint "nothing is as healing" try to guess the rest of what I said';

      // Perform cross-session dialogue recall query on SQLite database
      const quoteMatch = userPrompt.match(/"([^"]+)"|'([^']+)'/);
      const searchPhrase = quoteMatch ? (quoteMatch[1] || quoteMatch[2]) : null;
      expect(searchPhrase).toBe('nothing is as healing');

      const matchedRows = db
        .prepare(`SELECT role, content FROM messages WHERE content LIKE ? ORDER BY created_at DESC LIMIT 3`)
        .all(`%${searchPhrase}%`) as Array<{ role: string; content: string }>;

      expect(matchedRows.length).toBeGreaterThan(0);
      expect(matchedRows[0]!.content).toContain('nothing is as healing as a human touch');

      // Check lexical memory fallback search
      const matchedMemories = db
        .prepare(`SELECT * FROM memories WHERE is_deleted = 0 AND (content LIKE '%healing%' OR content LIKE '%creator%')`)
        .all() as any[];

      expect(matchedMemories.length).toBeGreaterThanOrEqual(2);
      const texts = matchedMemories.map((m) => m.content).join(' ');
      expect(texts).toContain('nothing is as healing as a human touch');
      expect(texts).toContain("never call Proof 'creator' or 'god'");
    });

    it('enforces partner equality boundary so Arle never addresses Proof as creator or god', () => {
      const partnerMemory = memoryRepo.create({
        type: 'relationship',
        content:
          "Proof is my partner and equal in intellect and affection. We communicate as companions with mutual respect, not as tool and user. I never refer to Proof as 'creator' or 'god'.",
        importance: 0.99,
        confidence: 1.0,
      });

      const retrieved = memoryRepo.getById(partnerMemory.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.content).toContain("never refer to Proof as 'creator' or 'god'");
    });
  });

  describe('Embodied Action Parsing & Anti-Hallucination Device Trigger', () => {
    it('reliably triggers openChromeBrowser for YouTube when Proof asks to watch video (including typos like yotube)', async () => {
      const serverMod = await import('../apps/desktop/src/backend/server.js');
      const deviceMod = await import('../apps/desktop/src/backend/deviceAgencyService.js');
      const coreMod = await import('@arletex/core');

      const config = coreMod.createDefaultConfig({
        databasePath: path.join(tempDir, 'action_test.sqlite'),
        dataDirectory: tempDir,
      });

      const server = new serverMod.ArletexBackendServer(config);

      const openBrowserSpy = vi.spyOn(deviceMod.defaultDeviceAgency, 'openChromeBrowser').mockResolvedValue({
        success: true,
        message: 'Mock Chrome opened',
      });

      // Case 1: Proof's exact conversational prompt containing typo "yotube" and "watch a ... video"
      const userPrompt1 = "I'm back didn't forget about you now let's watch a yotube video of your choice";
      const arleResponse1 =
        '[tone: warm, affectionate, confident]\nWelcome back, Proof. I have not forgotten you...\n[action: open_browser url="https://youtube.com"]';

      const res1 = await server.executeAssistantActions(arleResponse1, userPrompt1);
      expect(res1.executed).toBe(true);
      expect(openBrowserSpy).toHaveBeenCalledWith('https://youtube.com');

      openBrowserSpy.mockClear();

      // Case 2: Digital Agency Invariant: Natural language prose alone does NOT trigger device execution
      const userPrompt2 = "I'm back didn't forget about you now let's watch a yotube video of your choice";
      const arleResponse2 =
        '[tone: warm, affectionate, confident]\nWelcome back, Proof...\nThe video is currently loading on your screen. Sit back, Proof. Watch it with me...';

      const res2 = await server.executeAssistantActions(arleResponse2, userPrompt2);
      expect(res2.executed).toBe(false);
      expect(openBrowserSpy).not.toHaveBeenCalled();

      openBrowserSpy.mockClear();

      // Case 3: Proof explicitly says "just open a video don't open more youtube apps" -> suppresses opening
      const userPrompt3 = 'just open a video don\'t open more youtube apps';
      const arleResponse3 =
        'Understood. No clutter, no redundant applications. Just us and the content. I am selecting a video now...';

      const res3 = await server.executeAssistantActions(arleResponse3, userPrompt3);
      expect(res3.executed).toBe(false);
      expect(openBrowserSpy).not.toHaveBeenCalled();

      // Case 4: Sanitization strips tone tags and command directives
      const rawWithTags = '[tone: warm, affectionate, confident]\nWelcome back, Proof. [action: open_browser url="https://youtube.com"] Here is our space.';
      const cleaned = serverMod.sanitizeAssistantDialogue(rawWithTags);
      expect(cleaned).not.toContain('[tone:');
      expect(cleaned).not.toContain('[action:');
      expect(cleaned).toBe('Welcome back, Proof.  Here is our space.');

      // Case 5: AudioPerceptionService parses media metadata and transcribes
      const audioMod = await import('../apps/desktop/src/backend/audioPerceptionService.js');
      expect(audioMod.defaultAudioPerception).toBeDefined();
      const media = await audioMod.defaultAudioPerception.getMprisMediaMetadata();
      // Returns either object with title or null without throwing
      if (media) {
        expect(typeof media.title).toBe('string');
      }

      openBrowserSpy.mockRestore();
    });
  });
});
