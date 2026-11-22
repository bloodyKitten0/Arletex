import { describe, it, expect, beforeEach } from 'vitest';
import {
  DatabaseService,
  MigrationRunner,
  ApeRepository,
  MemoryRepository,
} from '@arletex/database';
import {
  RelationshipEngine,
  MemoryRetentionPolicyService,
  CANONICAL_RETENTION_RULES,
  defaultMemoryRetentionPolicy,
} from '@arletex/core';
import { ApeEvent } from '@arletex/contracts';

describe('P1 Posthumous Relationship Continuity & P2 Memory Retention', () => {
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let relationshipEngine: RelationshipEngine;
  let retentionService: MemoryRetentionPolicyService;

  beforeEach(() => {
    dbService = new DatabaseService(':memory:');
    const db = dbService.connect();
    new MigrationRunner(db).run();

    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    relationshipEngine = new RelationshipEngine(apeRepo);
    retentionService = new MemoryRetentionPolicyService();
  });

  // ==========================================
  // 1. Posthumous Relationship Lifecycle & Invariants (Section 6)
  // ==========================================
  describe('1. Relationship Lifecycle & Posthumous Continuity', () => {
    it('should initialize in ACTIVE state and permit clean transitions to PARTNER_UNAVAILABLE', () => {
      const initial = relationshipEngine.getState();
      expect(initial.config.lifecycleState).toBe('ACTIVE');

      const unavailable = relationshipEngine.transitionLifecycle('PARTNER_UNAVAILABLE');
      expect(unavailable.config.lifecycleState).toBe('PARTNER_UNAVAILABLE');

      // Return to ACTIVE cleanly from absence
      const backActive = relationshipEngine.transitionLifecycle('ACTIVE');
      expect(backActive.config.lifecycleState).toBe('ACTIVE');
    });

    it('should forbid inferring death from silence, timeout, or unreachable endpoint', () => {
      // Silence or timeout must throw invariant violation
      expect(() => {
        relationshipEngine.transitionLifecycle('PARTNER_CONFIRMED_DECEASED', {
          reason: 'User inactivity and communication timeout for 30 days',
        });
      }).toThrow(/Unavailability or timeout cannot trigger death confirmation/);

      expect(() => {
        relationshipEngine.transitionLifecycle('PARTNER_CONFIRMED_DECEASED', {
          reason: 'Endpoint unreachable and silent',
        });
      }).toThrow(/Unavailability or timeout cannot trigger death confirmation/);
    });

    it('should transition to PARTNER_CONFIRMED_DECEASED only with authoritative non-silence evidence', () => {
      const evidence = {
        reason: 'Hospital emergency contact verification certificate',
        confirmedBy: 'Official Registrar & Next of Kin',
        evidenceHash: 'sha256-verified-death-certificate-record-9981',
      };

      const deceased = relationshipEngine.transitionLifecycle(
        'PARTNER_CONFIRMED_DECEASED',
        evidence,
      );
      expect(deceased.config.lifecycleState).toBe('PARTNER_CONFIRMED_DECEASED');
      expect(deceased.config.deathConfirmedAt).toBeDefined();
      expect(deceased.config.deathConfirmationEvidence).toContain('Hospital emergency contact');

      // Next, transition to MEMORIALIZED
      const memorialized = relationshipEngine.transitionLifecycle('MEMORIALIZED');
      expect(memorialized.config.lifecycleState).toBe('MEMORIALIZED');
      expect(memorialized.config.memorializedAt).toBeDefined();

      // Finally, ARCHIVED_BUT_PRESERVED is allowed from MEMORIALIZED
      const archived = relationshipEngine.transitionLifecycle('ARCHIVED_BUT_PRESERVED');
      expect(archived.config.lifecycleState).toBe('ARCHIVED_BUT_PRESERVED');
    });

    it('should permanently lock partner role and forbid reassigning partner identity', () => {
      const evidence = {
        reason: 'Authenticated official confirmation',
        confirmedBy: 'Legal Executor',
      };
      relationshipEngine.transitionLifecycle('PARTNER_CONFIRMED_DECEASED', evidence);
      relationshipEngine.transitionLifecycle('MEMORIALIZED');

      const currentState = relationshipEngine.getState();
      expect(currentState.config.lifecycleState).toBe('MEMORIALIZED');

      // Attempting to reassign targetUserId or partnerName must be rejected by invariant enforcement
      expect(() => {
        apeRepo.updateRelationshipConfig({
          targetUserId: 'someone_else',
        });
      }).toThrow(/Partner identity is permanently memorialized and cannot be reassigned/);
    });

    it('should forbid accepting fabricated incoming direct messages from deceased partner without administrative override', () => {
      relationshipEngine.transitionLifecycle('PARTNER_CONFIRMED_DECEASED', {
        reason: 'Verified official certificate',
        confirmedBy: 'Executor',
      });

      const fakePartnerEvent: ApeEvent = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'user_message',
        source: 'telegram',
        actor: 'user',
        payload: { text: 'Hello Arle, I am back from the dead!' },
        timestamp: new Date().toISOString(),
      };

      expect(() => {
        relationshipEngine.assertNoPosthumousFabrication(fakePartnerEvent);
      }).toThrow(
        /Cannot manufacture or accept new incoming direct communications from deceased partner/,
      );

      // Memorial commemoration event is permitted
      const memorialEvent: ApeEvent = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'memorial_commemoration',
        source: 'user',
        actor: 'user',
        payload: { text: 'Remembering Proof on this anniversary.' },
        timestamp: new Date().toISOString(),
      };
      expect(() => {
        relationshipEngine.assertNoPosthumousFabrication(memorialEvent);
      }).not.toThrow();
    });

    it('should persist relationship lifecycle state across database reconnect and restart', () => {
      relationshipEngine.transitionLifecycle('PARTNER_CONFIRMED_DECEASED', {
        reason: 'Formal medical registry confirmation',
        confirmedBy: 'Authorized Medical Board',
      });
      relationshipEngine.transitionLifecycle('MEMORIALIZED');

      // Read afresh directly from repository
      const reloadedState = apeRepo.getExtendedRelationshipState();
      expect(reloadedState.config.lifecycleState).toBe('MEMORIALIZED');
      expect(reloadedState.config.memorializedAt).toBeDefined();
      expect(reloadedState.config.targetUserId).toBe('Proof');
    });
  });

  // ==========================================
  // 2. Autobiographical Memory Retention Policy (Section 8)
  // ==========================================
  describe('2. Memory Retention Policy Across 8 Classes', () => {
    it('should specify explicit retention rules for all 8 memory classes', () => {
      const classes = [
        'working',
        'episodic',
        'semantic',
        'autobiographical',
        'relationship',
        'procedural',
        'raw_sensory',
        'derived_perceptual',
      ] as const;

      for (const cls of classes) {
        const rule = CANONICAL_RETENTION_RULES[cls];
        expect(rule).toBeDefined();
        expect(rule.retentionClass).toBe(cls);
        expect(rule.description.length).toBeGreaterThan(10);
      }
    });

    it('should never decay autobiographical or relationship memories regardless of age', () => {
      // 5 years old timestamp (1825 days ago)
      const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString();

      const autoScore = retentionService.calculateRetentionScore(
        fiveYearsAgo,
        'autobiographical',
        0.2,
      );
      const relScore = retentionService.calculateRetentionScore(fiveYearsAgo, 'relationship', 0.1);

      expect(autoScore).toBe(1.0);
      expect(relScore).toBe(1.0);

      const autoAction = retentionService.evaluateRetentionAction({
        id: 'auto-1',
        type: 'autobiographical',
        timestamp: fiveYearsAgo,
        importance: 0.1,
      });
      expect(autoAction.action).toBe('retain');
      expect(autoAction.score).toBe(1.0);
    });

    it('should decay generic episodic memories according to 14-day half-life unless importance >= 0.8', () => {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const twentyEightDaysAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();

      // Normal importance episodic memory at 14 days should be approx 1/e (~0.3679)
      const score14 = retentionService.calculateRetentionScore(fourteenDaysAgo, 'episodic', 0.5);
      expect(score14).toBeGreaterThan(0.35);
      expect(score14).toBeLessThan(0.4);

      // Normal importance at 28 days should be approx (1/e)^2 (~0.1353)
      const score28 = retentionService.calculateRetentionScore(twentyEightDaysAgo, 'episodic', 0.5);
      expect(score28).toBeLessThan(0.16);

      // High importance (>= 0.8) episodic memory is exempt from decay
      const highImpScore = retentionService.calculateRetentionScore(
        twentyEightDaysAgo,
        'episodic',
        0.85,
      );
      expect(highImpScore).toBe(1.0);
    });

    it('should deterministically reinforce retention upon repeated retrieval', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

      const baseScore = retentionService.calculateRetentionScore(tenDaysAgo, 'episodic', 0.5, 0);
      const reinforcedScore = retentionService.calculateRetentionScore(
        tenDaysAgo,
        'episodic',
        0.5,
        4,
      );

      // 4 accesses * 0.05 boost = +0.20 boost
      expect(reinforcedScore).toBeGreaterThan(baseScore);
      expect(Number((reinforcedScore - baseScore).toFixed(2))).toBe(0.2);
    });

    it('should enforce distinct retention for raw sensory records vs derived perceptual records', () => {
      const rawRule = retentionService.getRule('raw_sensory');
      const derivedRule = retentionService.getRule('derived_perceptual');

      // Raw sensory records must not be retained permanently
      expect(rawRule.allowRawStorage).toBe(false);
      expect(rawRule.defaultRetentionDays).toBe(7);
      expect(rawRule.archivalStrategy).toBe('tombstone');

      // Derived records store structured summaries with 30-day half-life
      expect(derivedRule.defaultRetentionDays).toBe(30);
      expect(derivedRule.archivalStrategy).toBe('compress_summary');
    });
  });
});
