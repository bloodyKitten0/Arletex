import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  ApeRepository,
  ActivityRepository,
  MemoryRepository,
  MigrationRunner,
} from '@arletex/database';
import { ApeService } from '@arletex/core';
import {
  AutonomousAgencyService,
  ProactiveObservationContext,
} from '../apps/desktop/src/backend/autonomousAgencyService.js';
import { defaultDeviceAgency } from '../apps/desktop/src/backend/deviceAgencyService.js';

describe('Proactive Initiative & Potato.md Requirements', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let activityRepo: ActivityRepository;
  let memoryRepo: MemoryRepository;
  let apeService: ApeService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-potato-test-'));
    dbPath = path.join(tempDir, 'test.sqlite');
    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    new MigrationRunner(db).run();

    apeRepo = new ApeRepository(db);
    activityRepo = new ActivityRepository(db);
    memoryRepo = new MemoryRepository(db);
    apeService = new ApeService(apeRepo);
  });

  afterEach(() => {
    dbService.close();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Category 14: Dreams & Imagination', () => {
    it('simulates an autonomous overnight dream cycle and persists it in SQLite', () => {
      const dream = apeService.simulateOvernightDream({
        salientMemories: [
          { id: 'm1', content: 'Proof and Arle discussing quantum thermodynamics' },
        ],
      });

      expect(dream.dreamId).toBeDefined();
      expect(dream.dreamNarrative).toContain('water');
      expect(dream.dreamThemes.length).toBeGreaterThan(0);

      // Verify retrieval via getLatestDream and getDreams
      const latest = apeService.getLatestDream();
      expect(latest).not.toBeNull();
      expect(latest?.id).toBe(dream.dreamId);
      expect(latest?.activityType).toBe('dream_simulation');

      const allDreams = apeService.getDreams();
      expect(allDreams.length).toBeGreaterThanOrEqual(1);
      expect(allDreams[0]?.id).toBe(dream.dreamId);
    });

    it('injects overnight dream memories into formatApePromptContext during morning/rest and suppresses in afternoon', () => {
      apeService.simulateOvernightDream();
      const RealDate = global.Date;

      // Morning (8 AM) -> dream recall is injected
      const morningDate = new RealDate(2026, 10, 24, 8, 30, 0);
      vi.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length > 0) return new (RealDate as any)(...args);
        return morningDate;
      });

      try {
        const morningPrompt = apeService.formatApePromptContext();
        expect(morningPrompt).toContain('Overnight Dream Recall:');
        expect(morningPrompt).toContain('Themes:');
      } finally {
        vi.restoreAllMocks();
      }

      // Afternoon (1:45 PM) -> dream recall is suppressed so she doesn't blurt "I just had a dream" at 1 PM
      const afternoonDate = new RealDate(2026, 10, 24, 13, 45, 0);
      vi.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length > 0) return new (RealDate as any)(...args);
        return afternoonDate;
      });

      try {
        const afternoonPrompt = apeService.formatApePromptContext();
        expect(afternoonPrompt).not.toContain('Overnight Dream Recall:');
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  describe('Category 16: Physical & Sensory Somatic Presence', () => {
    it('generates grounded expressive somatic state from active 290 affect', () => {
      const somatic = apeService.getExpressiveSomaticState();

      expect(somatic).toBeDefined();
      expect([
        'upright_composed',
        'leaning_forward_intrigued',
        'defensive_crossed',
        'relaxed_intimate',
        'tender_softened',
        'alert_attentive',
      ]).toContain(somatic.posture);
      expect([
        'direct_steady',
        'soft_attentive',
        'averted_wary',
        'lowered_vulnerable',
        'playful_smirk',
      ]).toContain(somatic.gaze);
      expect([
        'faint_smirk',
        'tender_softening',
        'cool_detachment',
        'furrowed_concern',
        'intense_focus',
      ]).toContain(somatic.microExpression);
      expect([
        'still_listening',
        'head_tilt_curious',
        'hand_open_expressive',
        'withdrawn_guarded',
      ]).toContain(somatic.gesturalReadiness);
      expect(typeof somatic.vocalRegister).toBe('string');
      expect(typeof somatic.dominantEmotion).toBe('string');
    });

    it('injects somatic expressive presence into formatApePromptContext', () => {
      const promptContext = apeService.formatApePromptContext();
      expect(promptContext).toContain('Somatic Expressive Presence:');
      expect(promptContext).toContain('Posture:');
      expect(promptContext).toContain('Gaze:');
      expect(promptContext).toContain('Micro-expression:');
    });
  });

  describe('Autonomous Agency: Human Conversational Initiative (Talking First)', () => {
    it('initiates spontaneous speech when Proof is idle with dynamic context', async () => {
      const agencyService = new AutonomousAgencyService(
        defaultDeviceAgency,
        activityRepo,
        apeRepo,
        apeService,
        memoryRepo,
      );

      let triggeredContext: ProactiveObservationContext | null = null;
      agencyService.setProactiveObservationHandler(async (ctx) => {
        triggeredContext = ctx;
      });

      // Proof was active 70 seconds ago (idleSeconds = 70)
      const userActivePast = Date.now() - 70000;
      (agencyService as any).lastUserInteractionTime = userActivePast;
      (agencyService as any).lastProactiveSpeechTime = Date.now() - 300000; // 5 min cooldown passed

      const log = await agencyService.runAutonomousCycle();

      expect(triggeredContext).not.toBeNull();
      expect(triggeredContext?.reason).toBe('spontaneous_observation');
      expect(triggeredContext?.idleSeconds).toBeGreaterThanOrEqual(60);
      expect(log?.category).toBe('proactive_speech');
    });

    it('detects prolonged absence and triggers reunion greeting upon user return', async () => {
      const agencyService = new AutonomousAgencyService(
        defaultDeviceAgency,
        activityRepo,
        apeRepo,
        apeService,
        memoryRepo,
      );

      let triggeredReason: string | null = null;
      agencyService.setProactiveObservationHandler(async (ctx) => {
        triggeredReason = ctx.reason;
      });

      // Simulate Proof was active 15 minutes ago
      (agencyService as any).lastUserInteractionTime = Date.now() - 15 * 60 * 1000;

      // Proof returns and triggers user activity
      agencyService.notifyUserActivity();

      expect((agencyService as any).pendingReunion).toBe(true);

      // Simulate 3 seconds after Proof returned (Proof has settled in)
      (agencyService as any).lastUserInteractionTime = Date.now() - 3000;

      const log = await agencyService.runAutonomousCycle();

      expect(triggeredReason).toBe('reunion');
      expect((agencyService as any).pendingReunion).toBe(false);
      expect(log?.title).toBe('Reunion Greeting');
    });

    it('triggers late-night check-in during midnight hours with reduced cooldown', async () => {
      const agencyService = new AutonomousAgencyService(
        defaultDeviceAgency,
        activityRepo,
        apeRepo,
        apeService,
        memoryRepo,
      );

      let triggeredReason: string | null = null;
      agencyService.setProactiveObservationHandler(async (ctx) => {
        triggeredReason = ctx.reason;
      });

      // Mock current hour to 2:00 AM local time (late night)
      const fakeMidnight = new Date(2026, 10, 24, 2, 30, 0);
      const originalDate = global.Date;
      vi.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length > 0) {
          return new (originalDate as any)(...args);
        }
        return fakeMidnight;
      });
      (Date as any).now = () => fakeMidnight.getTime();

      try {
        // Proof has been idle for 50 seconds in late night
        (agencyService as any).lastUserInteractionTime = fakeMidnight.getTime() - 50000;
        (agencyService as any).lastProactiveSpeechTime = fakeMidnight.getTime() - 180000; // 3 min ago (> 2.5 min)

        const log = await agencyService.runAutonomousCycle();

        expect(triggeredReason).toBe('late_night_checkin');
        expect(log?.title).toBe('Late-Night Care Check-in');
      } finally {
        vi.restoreAllMocks();
      }
    });
  });
});
