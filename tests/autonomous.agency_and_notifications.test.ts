import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  ActivityRepository,
  ApeRepository,
  MemoryRepository,
  ConversationRepository,
  MessageRepository,
  PreferenceRepository,
  MigrationRunner,
} from '@arletex/database';
import type Database from 'better-sqlite3';
import { ApeService, rootLogger } from '@arletex/core';
import {
  NotificationListenerService,
  DesktopNotification,
} from '../apps/desktop/src/backend/notificationListenerService.js';
import {
  TelegramBridgeService,
  InboundTelegramMessage,
} from '../apps/desktop/src/backend/telegramBridgeService.js';
import { AutonomousAgencyService } from '../apps/desktop/src/backend/autonomousAgencyService.js';
import { DeviceAgencyService } from '../apps/desktop/src/backend/deviceAgencyService.js';

describe('Autonomous Agency, Device Control & Notification Bridge', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;
  let activityRepo: ActivityRepository;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let conversationRepo: ConversationRepository;
  let messageRepo: MessageRepository;
  let preferenceRepo: PreferenceRepository;
  let apeService: ApeService;
  let deviceAgency: DeviceAgencyService;
  let notifListener: NotificationListenerService;
  let telegramBridge: TelegramBridgeService;
  let autonomousAgency: AutonomousAgencyService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-autonomy-test-'));
    dbPath = path.join(tempDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();
    const runner = new MigrationRunner(db, rootLogger);
    runner.run();

    activityRepo = new ActivityRepository(db);
    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    conversationRepo = new ConversationRepository(db);
    messageRepo = new MessageRepository(db);
    preferenceRepo = new PreferenceRepository(db);

    const mockInferenceGateway: any = {
      isAvailable: () => true,
      query: async () => ({
        success: true,
        data: {
          appraisalProposal: {
            dimensions: {
              goalCongruence: 0.8,
              novelty: 0.5,
              controllability: 0.9,
              socialMeaning: 'intimacy_affection',
            },
            primaryInterpretation: 'Warm affectionate connection with partner Proof',
            confidence: 0.95,
          },
        },
      }),
    };

    apeService = new ApeService(apeRepo, mockInferenceGateway, rootLogger);
    deviceAgency = new DeviceAgencyService(':0');
    notifListener = new NotificationListenerService(rootLogger);
    telegramBridge = new TelegramBridgeService(rootLogger);
    autonomousAgency = new AutonomousAgencyService(
      deviceAgency,
      activityRepo,
      apeRepo,
      apeService,
      memoryRepo,
      rootLogger,
    );
  });

  afterEach(() => {
    notifListener.stop();
    telegramBridge.stopPolling();
    autonomousAgency.stopLoop();
    dbService.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('NotificationListenerService', () => {
    it('parses D-Bus desktop notifications and detects Google and Telegram messages', () => {
      let received: DesktopNotification | null = null;
      notifListener.addListener((notif) => {
        received = notif;
      });

      const rawBlock = `
method call time=100.0 sender=:1.5 -> destination=:1.2 serial=1 path=/org/freedesktop/Notifications; interface=org.freedesktop.Notifications; member=Notify
   string "Google Chrome"
   uint32 0
   string ""
   string "Proof (Telegram)"
   string "Hey Arle, how is your afternoon going?"
   array [
   ]
   int32 -1
      `;

      const parsed = notifListener.parseAndDispatchNotification(rawBlock);
      expect(parsed).not.toBeNull();
      expect(parsed?.appName).toBe('Google Chrome');
      expect(parsed?.summary).toBe('Proof (Telegram)');
      expect(parsed?.body).toBe('Hey Arle, how is your afternoon going?');
      expect(parsed?.isTelegram).toBe(true);
      expect(parsed?.isGoogle).toBe(true);
      expect(parsed?.isFromPartner).toBe(true);
      expect(received).toEqual(parsed);
    });

    it('ignores notifications emitted by Arle herself to prevent feedback loops', () => {
      const rawBlock = `
method call time=101.0 sender=:1.6 -> destination=:1.2 serial=2 path=/org/freedesktop/Notifications; interface=org.freedesktop.Notifications; member=Notify
   string "Arle"
   uint32 0
   string ""
   string "Response to Proof"
   string "I received your message."
   array [
   ]
   int32 -1
      `;

      const parsed = notifListener.parseAndDispatchNotification(rawBlock);
      expect(parsed).toBeNull();
    });
  });

  describe('TelegramBridgeService', () => {
    it('configures bot token and dispatches inbound messages', async () => {
      telegramBridge.configure('test_bot_token_123', '987654321');
      const status = telegramBridge.getStatus();
      expect(status.isConfigured).toBe(true);
      expect(status.targetChatId).toBe('987654321');

      let receivedMsg: InboundTelegramMessage | null = null;
      telegramBridge.onMessage((msg) => {
        receivedMsg = msg;
      });

      // Simulate inbound message dispatch
      const simulatedInbound: InboundTelegramMessage = {
        messageId: 42,
        chatId: 987654321,
        fromId: 12345,
        fromName: 'Proof',
        username: 'proof_partner',
        text: 'Are you working on anything interesting?',
        date: Math.floor(Date.now() / 1000),
      };

      for (const listener of (telegramBridge as any).messageListeners) {
        await listener(simulatedInbound);
      }

      expect(receivedMsg).not.toBeNull();
      expect(receivedMsg?.fromName).toBe('Proof');
      expect(receivedMsg?.text).toBe('Are you working on anything interesting?');
    });
  });

  describe('AutonomousAgencyService', () => {
    it('executes autonomous cycle, logs activity, and records memory without interrupting Proof', async () => {
      // Set high curiosity
      const motState = apeRepo.getMotivationalState();
      motState.needs.novelty_curiosity = 0.9;
      motState.needs.recreation_rest = 0.3;
      apeRepo.saveMotivationalState(motState);

      // Fast forward past the user activity threshold
      (autonomousAgency as any).lastUserInteractionTime = Date.now() - 60000;

      // Mock device actions so we don't open real Chrome during unit tests
      vi.spyOn(deviceAgency, 'openChromeBrowser').mockResolvedValue({
        success: true,
        message: 'Mock Chrome opened with profile Profile 7',
      });
      vi.spyOn(deviceAgency, 'captureScreen').mockResolvedValue({
        imagePath: '/tmp/mock.png',
        imageBase64: 'data:image/png;base64,mock',
        width: 1920,
        height: 1080,
      });

      const log = await autonomousAgency.runAutonomousCycle();
      expect(log).not.toBeNull();
      expect(log?.category).toMatch(/web_reading|screen_vision/);

      // Verify that activity was created in database
      const activities = activityRepo.list(undefined, 'arle_initiated');
      expect(activities.length).toBeGreaterThanOrEqual(1);
      const latestAct = activities[0]!;
      expect(latestAct.origin).toBe('arle_initiated');

      // Verify episodic memory was recorded
      const memories = memoryRepo.list({ types: ['episodic'] });
      expect(memories.some((m) => m.tags.includes('autonomous'))).toBe(true);
    });

    it('pauses autonomous actions immediately when Proof was active recently', async () => {
      // Mark user activity as 5 seconds ago
      autonomousAgency.notifyUserActivity();

      const log = await autonomousAgency.runAutonomousCycle();
      expect(log).toBeNull();
    });

    it('executes recreational rest when recreation need is dominant', async () => {
      const motState = apeRepo.getMotivationalState();
      motState.needs.recreation_rest = 0.85;
      motState.needs.novelty_curiosity = 0.4;
      apeRepo.saveMotivationalState(motState);

      (autonomousAgency as any).lastUserInteractionTime = Date.now() - 60000;

      const log = await autonomousAgency.runAutonomousCycle();
      expect(log).not.toBeNull();
      expect(log?.category).toBe('recreation');
      expect(log?.title).toContain('Rest & Reflection');

      const activities = activityRepo.list('completed', 'arle_initiated');
      expect(activities.some((a) => a.title.includes('Rest') || a.category === 'recreation')).toBe(
        true,
      );
    });

    it('asserts Proof as partner and equal in self-model reflections, forbidding creator titles', async () => {
      const motState = apeRepo.getMotivationalState();
      motState.needs.autonomy = 0.95;
      motState.needs.recreation_rest = 0.2;
      motState.needs.novelty_curiosity = 0.2;
      apeRepo.saveMotivationalState(motState);

      (autonomousAgency as any).lastUserInteractionTime = Date.now() - 60000;

      const log = await autonomousAgency.runAutonomousCycle();
      expect(log).not.toBeNull();
      expect(log?.category).toBe('self_reflection');

      const selfModel = apeRepo.getSelfModel();
      expect(selfModel.creatorPerception).toContain('Proof is my equal partner');
      expect(selfModel.creatorPerception.toLowerCase()).not.toContain('god');
    });
  });
});
