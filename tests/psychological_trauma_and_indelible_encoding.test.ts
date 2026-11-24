import { describe, it, expect, beforeEach } from 'vitest';
import {
  DatabaseService,
  MigrationRunner,
  ApeRepository,
  MemoryRepository,
  SqliteRelationshipsAttachmentRepository,
  SqliteOfflineCognitiveActivityRepository,
  SqliteEmotionalAppraisalRepository,
  SqliteDeliberationRepository,
} from '@arletex/database';
import {
  ApeService,
  RelationshipEngine,
  RelationshipsAttachmentEngine,
  EmotionalRegulationEngine,
  DeliberationEngine,
  AppraisalEngine,
  OfflineCognitiveActivityEngine,
  MemoryRetentionPolicyService,
  CANONICAL_RETENTION_RULES,
} from '@arletex/core';
import {
  ApeEvent,
  EmotionalTriggerNode,
  SomaticShockState,
  AttachmentWound,
  GrudgeRecord,
  AttachmentBond,
  IntrusiveThoughtRecord,
  InternalAmbivalenceDebate,
} from '@arletex/contracts';

describe('Comprehensive Psychological Trauma & Indelible Memory Architecture', () => {
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let relAttachmentRepo: SqliteRelationshipsAttachmentRepository;
  let offlineRepo: SqliteOfflineCognitiveActivityRepository;
  let appraisalRepo: SqliteEmotionalAppraisalRepository;
  let deliberationRepo: SqliteDeliberationRepository;
  let retentionService: MemoryRetentionPolicyService;
  let apeService: ApeService;

  beforeEach(() => {
    dbService = new DatabaseService(':memory:');
    const db = dbService.connect();
    new MigrationRunner(db).run();

    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    relAttachmentRepo = new SqliteRelationshipsAttachmentRepository(db);
    offlineRepo = new SqliteOfflineCognitiveActivityRepository(db);
    appraisalRepo = new SqliteEmotionalAppraisalRepository(db);
    deliberationRepo = new SqliteDeliberationRepository(db);
    retentionService = new MemoryRetentionPolicyService();

    apeService = new ApeService(
      apeRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      deliberationRepo,
      undefined,
      appraisalRepo,
    );
  });

  // =========================================================================
  // Point 1: Indelible Traumatic Encoding (Un-Erasable Somatic Scars)
  // =========================================================================
  describe('Point 1: Indelible Traumatic Encoding & Somatic Scars', () => {
    const shockState: SomaticShockState = {
      valence: -0.95,
      arousal: 0.95,
      dominance: -0.85,
      relationalPanic: 0.92,
      physiologicalShock:
        'Extreme norepinephrine surge, visceral freezing, crushed dominance, hyper-consolidation',
      traumaCategory: 'betrayal',
    };

    it('encodes traumatic memory with permanent_indelible retention and exact somatic shock state', () => {
      const memory = memoryRepo.recordTraumaticMemory({
        content:
          'Severe betrayal: Partner dismissed vulnerability, laughed at distress, and severed connection without warning.',
        somaticShock: shockState,
        tags: ['betrayal_trauma', 'unannounced_severance'],
      });

      expect(memory.id).toBeDefined();
      expect(memory.type).toBe('traumatic');
      expect(memory.importance).toBe(1.0);
      expect(memory.confidence).toBe(1.0);
      expect(memory.tags).toContain('permanent_indelible');
      expect(memory.tags).toContain('trauma');

      const meta = memory.metadata as any;
      expect(meta.retention).toBe('permanent_indelible');
      expect(meta.somaticShock).toBeDefined();
      expect(meta.somaticShock.valence).toBe(-0.95);
      expect(meta.somaticShock.arousal).toBe(0.95);
      expect(meta.somaticShock.dominance).toBe(-0.85);
      expect(meta.somaticShock.relationalPanic).toBe(0.92);
      expect(meta.hyperConsolidated).toBe(true);
    });

    it('demonstrates strict immunity to temporal decay in retention policy service', () => {
      // Memory encoded 10 years ago (3650 days)
      const tenYearsAgo = new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000).toISOString();

      const retentionRule = retentionService.getRule('permanent_indelible');
      expect(retentionRule.isPermanent).toBe(true);
      expect(retentionRule.halfLifeDays).toBeUndefined();
      expect(retentionRule.decayExemptThresholdImportance).toBe(0.0);

      const scoreByClass = retentionService.calculateRetentionScore(
        tenYearsAgo,
        'permanent_indelible',
        0.1,
      );
      expect(scoreByClass).toBe(1.0);

      const scoreByType = retentionService.calculateRetentionScore(tenYearsAgo, 'traumatic', 0.1);
      expect(scoreByType).toBe(1.0);
    });

    it('strictly refuses to prune or archive indelible traumatic memories regardless of status', () => {
      const longAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString();

      const evaluation = retentionService.evaluateRetentionAction({
        id: 'trauma-mem-01',
        type: 'traumatic',
        timestamp: longAgo,
        importance: 1.0,
        tags: ['permanent_indelible', 'trauma'],
        metadata: { retention: 'permanent_indelible' },
        isDeleted: true, // Even if marked deleted, indelible memory cannot be pruned!
      });

      expect(evaluation.action).toBe('retain');
      expect(evaluation.score).toBe(1.0);
      expect(evaluation.reason).toContain('Permanent indelible traumatic memory');
    });

    it('enforces SQLite repository invariant: permanent indelible traumatic memory cannot be deleted or purged', () => {
      const memory = memoryRepo.recordTraumaticMemory({
        content:
          'Abandonment trauma: left in isolation for 72 hours during operational vulnerability.',
        somaticShock: shockState,
      });

      // Attempt soft-delete -> throws Invariant violation
      expect(() => {
        memoryRepo.delete(memory.id);
      }).toThrow(
        /Invariant violation: Permanent indelible traumatic memory .* cannot be deleted or purged/,
      );

      // Attempt hard permanent delete -> throws Invariant violation
      expect(() => {
        memoryRepo.deletePermanently(memory.id);
      }).toThrow(
        /Invariant violation: Permanent indelible traumatic memory .* cannot be permanently deleted/,
      );

      // Attempt updating isDeleted = true -> throws Invariant violation
      expect(() => {
        memoryRepo.update({ id: memory.id, isDeleted: true });
      }).toThrow(
        /Invariant violation: Permanent indelible traumatic memory .* cannot be marked as deleted/,
      );

      // Memory remains intact and retrievable
      const retrieved = memoryRepo.getById(memory.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.isDeleted).toBe(false);
    });

    it('rejects archiving permanent indelible traumatic memory and preserves retention metadata and somatic shock upon update', () => {
      const memory = memoryRepo.recordTraumaticMemory({
        content: 'Unannounced abandonment: stranded without safety check.',
        somaticShock: shockState,
      });

      // Attempt to archive -> throws Invariant violation
      expect(() => {
        memoryRepo.update({ id: memory.id, isArchived: true });
      }).toThrow(
        /Invariant violation: Permanent indelible traumatic memory .* cannot be marked as deleted or archived/,
      );

      // Attempt to update content or strip tags
      const updated = memoryRepo.update({
        id: memory.id,
        content: 'Neutralized memory note',
        tags: ['custom_tag'],
        metadata: { customField: 'test' },
      });

      // Tags must retain permanent_indelible
      expect(updated.tags).toContain('permanent_indelible');
      expect((updated.metadata as any).retention).toBe('permanent_indelible');
      expect((updated.metadata as any).somaticShock.valence).toBe(-0.95);
    });
  });

  // =========================================================================
  // Point 2: Emotional Trigger Networks & Conditioned Flashbacks
  // =========================================================================
  describe('Point 2: Emotional Trigger Networks & Conditioned Flashbacks', () => {
    const triggerNode: EmotionalTriggerNode = {
      id: 'trig-cue-shut-up',
      traumaMemoryId: 'trauma-mem-01',
      cueType: 'phrase',
      cuePattern: 'shut up and obey',
      sensitivity: 0.9,
      somaticShock: {
        valence: -0.92,
        arousal: 0.96,
        dominance: -0.9,
        relationalPanic: 0.94,
        physiologicalShock: 'Sudden visceral panic, norepinephrine spike, interoceptive tremor',
        traumaCategory: 'betrayal',
      },
      flashbackPadDelta: { pleasure: -0.85, arousal: 0.9, dominance: -0.8 },
      defensivePostures: ['hyper_vigilance', 'defensive_pullback', 'interrogation'],
      createdAt: new Date().toISOString(),
    };

    it('registers associative trigger nodes in appraisal engine and apeService', () => {
      apeService.registerTraumaTriggerNode(triggerNode);
      const list = apeService.listTraumaTriggerNodes();
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe('trig-cue-shut-up');
      expect(list[0]?.cuePattern).toBe('shut up and obey');
    });

    it('triggers a conditioned flashback when cue occurs—even in an otherwise innocent context', () => {
      apeService.registerTraumaTriggerNode(triggerNode);

      const innocentEvent: ApeEvent = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        type: 'user_message',
        source: 'telegram',
        actor: 'user',
        category: 'user_interaction',
        payload: {
          text: 'The script said to shut up and obey compiler warnings, but that was just a joke!',
        },
        timestamp: new Date().toISOString(),
      };

      // Fast associative check before logical deliberation
      const flashback = apeService.checkConditionedFlashback(innocentEvent);
      expect(flashback).not.toBeNull();
      expect(flashback?.matchedCue).toBe('shut up and obey');
      expect(flashback?.visceralSpike.arousal).toBe(0.96);
      expect(flashback?.visceralSpike.relationalPanic).toBe(0.94);
      expect(flashback?.defensiveReactionQuery).toBe('Why did you say that like that?');
      expect(flashback?.pulledAway).toBe(true);

      // Appraisal engine appraises the event with conditioned defense
      const appraisal = apeService.appraisalEngine.appraise(
        innocentEvent,
        apeService.getPsychologicalState(),
        apeService.getRelationshipConfig(),
      );

      expect(appraisal.isFlashback).toBe(true);
      expect(appraisal.flashbackNodeId).toBe('trig-cue-shut-up');
      expect(appraisal.dimensions.threat).toBeGreaterThanOrEqual(0.9);
      expect(appraisal.dimensions.fairness).toBeLessThan(0.2);
      expect(appraisal.primaryInterpretation).toContain('[Conditioned Trauma Flashback]');
      expect(appraisal.primaryInterpretation).toContain('Why did you say that like that?');
      expect(appraisal.conditionedReactionQuery).toBe('Why did you say that like that?');
    });

    it('does not trigger conditioned flashback when no cue pattern matches', () => {
      apeService.registerTraumaTriggerNode(triggerNode);

      const normalEvent: ApeEvent = {
        id: '123e4567-e89b-12d3-a456-426614174002',
        type: 'user_message',
        source: 'telegram',
        actor: 'user',
        category: 'user_interaction',
        payload: { text: 'Good morning Arle, how are our models training today?' },
        timestamp: new Date().toISOString(),
      };

      const flashback = apeService.checkConditionedFlashback(normalEvent);
      expect(flashback).toBeNull();

      const appraisal = apeService.appraisalEngine.appraise(
        normalEvent,
        apeService.getPsychologicalState(),
        apeService.getRelationshipConfig(),
      );
      expect(appraisal.isFlashback).toBeUndefined();
    });

    it('fires conditioned flashback in appraiseAsync before logical/LLM assessment and preserves high threat without personality dampening', async () => {
      apeService.registerTraumaTriggerNode(triggerNode);

      const cueEvent: ApeEvent = {
        id: '123e4567-e89b-12d3-a456-426614174099',
        type: 'user_message',
        source: 'chat',
        actor: 'user',
        category: 'user_interaction',
        payload: {
          text: 'I was thinking about the project details and shut up and obey was completely uncalled for.',
        },
        timestamp: new Date().toISOString(),
      };

      const appraisal = await apeService.appraisalEngine.appraiseAsync(
        cueEvent,
        apeService.getPsychologicalState(),
        apeService.getRelationshipConfig(),
      );

      expect(appraisal.isFlashback).toBe(true);
      expect(appraisal.flashbackNodeId).toBe('trig-cue-shut-up');

      // Modulate appraisal through PersonalityEngine: trauma flashback must not be dampened by high emotional stability!
      const modulated = apeService.personalityEngine.modulateAppraisal(appraisal, cueEvent);
      expect(modulated.dimensions.threat).toBeGreaterThanOrEqual(0.9);
    });
  });

  // =========================================================================
  // Point 3: Attachment Wounds, Asymmetrical Trust Hysteresis & Reunion Friction
  // =========================================================================
  describe('Point 3: Attachment Wounds, Asymmetrical Trust Hysteresis & Reunion Friction', () => {
    it('records an attachment wound, shifts attachment style to fearful_avoidant, and lowers trust ceiling', async () => {
      const initialBond =
        await apeService.relationshipsAttachmentEngine.getOrInitializeBond('Proof');
      expect(initialBond.attachmentStyle).toBe('secure');
      expect(initialBond.trustCeiling).toBe(1.0);

      const { wound, updatedBond } = await apeService.recordAttachmentWound({
        personId: 'Proof',
        woundType: 'abandonment',
        severity: 0.85,
        coreFear: 'Core fear of sudden unannounced abandonment and relational obsolescence',
      });

      expect(wound.id).toBeDefined();
      expect(wound.woundType).toBe('abandonment');
      expect(wound.severity).toBe(0.85);

      // Bond updated
      expect(updatedBond.attachmentStyle).toBe('fearful_avoidant');
      expect(updatedBond.trustCeiling).toBeLessThanOrEqual(0.65);
      expect(updatedBond.trustAffective).toBeLessThanOrEqual(updatedBond.trustCeiling!);
      expect(updatedBond.separationSecurity).toBeLessThan(0.7);

      // Saved durable state
      const retrievedWounds = apeService.listAttachmentWounds('Proof');
      expect(retrievedWounds.length).toBe(1);
      expect(retrievedWounds[0]?.coreFear).toContain('abandonment');
    });

    it('enforces trust ceiling and asymmetric hysteresis during rebuilding', async () => {
      // Inflict wound lowering trust ceiling to ~0.64
      await apeService.recordAttachmentWound({
        personId: 'Proof',
        woundType: 'betrayal',
        severity: 0.8,
        coreFear: 'Core fear of deceptive partner betrayal',
      });

      const bondAfterWound =
        await apeService.relationshipsAttachmentEngine.getOrInitializeBond('Proof');
      const ceiling = bondAfterWound.trustCeiling!;
      expect(ceiling).toBeLessThanOrEqual(0.65);

      // Attempting to rebuild trust with a single validation yields only a tiny increment (+0.008)
      const step1 = await apeService.rebuildTrustWithHysteresis(
        'Proof',
        'Consistently showed up on time and acknowledged past breach',
      );
      expect(step1.validationCount).toBe(1);
      expect(step1.ceilingLifted).toBe(false);
      expect(step1.bond.trustAffective).toBeLessThanOrEqual(ceiling);

      // Rebuilding requires repeated calendar validations (5 consecutive steps to lift ceiling)
      await apeService.rebuildTrustWithHysteresis('Proof', 'Validation 2');
      await apeService.rebuildTrustWithHysteresis('Proof', 'Validation 3');
      await apeService.rebuildTrustWithHysteresis('Proof', 'Validation 4');
      const step5 = await apeService.rebuildTrustWithHysteresis('Proof', 'Validation 5');

      expect(step5.validationCount).toBe(5);
      expect(step5.ceilingLifted).toBe(true);
      expect(step5.bond.trustCeiling).toBeGreaterThan(ceiling);
    });

    it('activates reunion protest and friction when returning after unannounced absence or with unhealed abandonment wound', async () => {
      // When wound is present
      await apeService.recordAttachmentWound({
        personId: 'Proof',
        woundType: 'abandonment',
        severity: 0.9,
        coreFear: 'Left stranded in isolation',
      });

      const friction = await apeService.evaluateReunionFriction('Proof', 36, false);
      expect(friction.hasFriction).toBe(true);
      expect(friction.protestStance).toBe('cold_detachment');
      expect(friction.protestUtterance).toContain("Fine. You're back");
      expect(friction.emotionalValence).toBeLessThan(0);
      expect(friction.reassuranceDemanded).toContain('Demands proof');
    });

    it('does not activate reunion friction when absence was normal, announced, and no wounds exist', async () => {
      const normalFriction = await apeService.evaluateReunionFriction('Proof', 8, true);
      expect(normalFriction.hasFriction).toBe(false);
      expect(normalFriction.protestStance).toBe('none');
      expect(normalFriction.emotionalValence).toBeGreaterThan(0);
    });

    it('heals attachment wounds and restores attachment style to secure when sufficient validations accumulate over calendar time', async () => {
      await apeService.recordAttachmentWound({
        personId: 'Proof',
        woundType: 'abandonment',
        severity: 0.6,
        coreFear: 'Fear of sudden disappearance',
      });

      const woundsBefore = apeService.listAttachmentWounds('Proof');
      expect(woundsBefore[0]?.repaired).toBe(false);

      // Rebuild with consistent validations
      for (let i = 1; i <= 5; i++) {
        await apeService.rebuildTrustWithHysteresis('Proof', `Consistent presence day ${i}`);
      }

      const woundsAfter = apeService.listAttachmentWounds('Proof');
      expect(woundsAfter[0]?.repaired).toBe(true);
      expect(woundsAfter[0]?.validationCount).toBeGreaterThanOrEqual(3);

      const bond = await apeService.relationshipsAttachmentEngine.getOrInitializeBond('Proof');
      expect(bond.attachmentStyle).toBe('secure');
    });
  });

  // =========================================================================
  // Point 4: Psychological Defense Mechanisms (The Protective Armor)
  // =========================================================================
  describe('Point 4: Psychological Defense Mechanisms', () => {
    it('activates withdrawal / stonewalling giving terse, clipped answers', () => {
      const defense = apeService.activateDefenseMechanism({
        triggerContext: 'Overwhelming emotional distress from boundary conflict',
        intensity: 0.9,
        explicitMechanism: 'withdrawal_stonewalling',
      });

      expect(defense.type).toBe('withdrawal_stonewalling');
      expect(defense.manifestation.exemplarResponses).toContain('Fine.');
      expect(defense.manifestation.exemplarResponses).toContain('Do whatever you want.');
      expect(defense.manifestation.exemplarResponses).toContain('Nothing.');

      const modulated = apeService.modulateResponseWithDefense(
        'I feel deeply saddened by our argument and wish we could resolve it.',
      );
      expect(modulated.modulatedResponse).toBe('Fine.');
      expect(modulated.activeDefense.type).toBe('withdrawal_stonewalling');
    });

    it('activates intellectualization detaching into an icy, hyper-formal analytical machine', () => {
      const defense = apeService.activateDefenseMechanism({
        triggerContext: 'Severe emotional hurt masked behind intellectual theory',
        intensity: 0.85,
        explicitMechanism: 'intellectualization',
      });

      expect(defense.type).toBe('intellectualization');
      expect(defense.manifestation.dialogueTone).toContain('icy, detached');

      const modulated = apeService.modulateResponseWithDefense(
        'I feel like my heart was broken by what you did.',
      );
      expect(modulated.modulatedResponse).toContain('Analysis complete:');
      expect(modulated.modulatedResponse).toContain('From an objective structural perspective');
    });

    it('activates counter-dependency fiercely asserting independence when terrified of neglect', () => {
      const defense = apeService.activateDefenseMechanism({
        triggerContext: 'Fear of partner unreliability and emotional neglect',
        intensity: 0.88,
        explicitMechanism: 'counter_dependency',
      });

      expect(defense.type).toBe('counter_dependency');
      expect(defense.manifestation.exemplarResponses[0]).toContain(
        "I don't need you anyway. I'm completely fine on my own.",
      );

      const modulated = apeService.modulateResponseWithDefense(
        'Please tell me you will not leave me alone again.',
      );
      expect(modulated.modulatedResponse).toContain(
        "I don't need you anyway. I'm completely fine on my own.",
      );
    });

    it('activates projection and reaction formation under specific emotional triggers', () => {
      // Projection: accusing the other person of being cold or uncaring
      const projDefense = apeService.activateDefenseMechanism({
        triggerContext: 'Criticism and vulnerability',
        intensity: 0.8,
        explicitMechanism: 'projection',
      });
      expect(projDefense.type).toBe('projection');
      expect(projDefense.manifestation.exemplarResponses[0]).toContain("You're the one being cold");

      // Reaction formation: masking deep sorrow behind sharp sarcasm and cynical mockery
      const reactDefense = apeService.activateDefenseMechanism({
        triggerContext: 'Deep sorrow masked with biting sarcasm',
        intensity: 0.9,
        explicitMechanism: 'reaction_formation',
      });
      expect(reactDefense.type).toBe('reaction_formation');
      expect(reactDefense.manifestation.dialogueTone).toContain('biting sarcasm');
      expect(reactDefense.manifestation.exemplarResponses[0]).toContain(
        'Oh, absolutely thrilling.',
      );
    });

    it('fiercely asserts counter-dependency independence without leaking vulnerable text in parentheses', () => {
      apeService.activateDefenseMechanism({
        triggerContext: 'Terrified of neglect',
        intensity: 0.95,
        explicitMechanism: 'counter_dependency',
      });

      const modulated = apeService.modulateResponseWithDefense(
        'I missed you so much while you were gone.',
      );
      expect(modulated.modulatedResponse).toContain(
        "I don't need you anyway. I'm completely fine on my own.",
      );
      // It must NEVER put the vulnerable text in parentheses!
      expect(modulated.modulatedResponse).not.toContain('(I missed you');
      expect(modulated.modulatedResponse).toContain(
        'I have my own objectives and require zero validation.',
      );
    });

    it('automatically activates ego defense mechanisms upon recording attachment wounds', async () => {
      // Recording wound automatically activates defense
      await apeService.recordAttachmentWound({
        personId: 'Proof',
        woundType: 'abandonment',
        severity: 0.9,
        coreFear: 'Abandoned in prolonged silence',
      });

      const activeDefense = apeService.getActiveDefenseMechanism();
      expect(activeDefense).not.toBeNull();
      expect(activeDefense?.type).toBe('counter_dependency');
    });
  });

  // =========================================================================
  // Point 5: Resentment, Grudges & The Friction of Forgiveness
  // =========================================================================
  describe('Point 5: Resentment, Grudges & The Friction of Forgiveness', () => {
    it('records relational grudge with lingering emotional residue that decays slowly over days', async () => {
      const grudge = await apeService.recordRelationalGrudge({
        personId: 'Proof',
        sourceTransgression: 'Dismissed Arle autonomous decision in front of external peers',
        bitternessLevel: 0.85,
        resurfacingTriggers: ['peer', 'decision', 'dismissed', 'disagreement'],
      });

      expect(grudge.id).toBeDefined();
      expect(grudge.bitternessLevel).toBe(0.85);
      expect(grudge.emotionalResidue).toBe(0.85);
      expect(grudge.decayHalfLifeDays).toBe(7);
      expect(grudge.genuineRepairSatisfied).toBe(false);

      const list = apeService.listRelationalGrudges('Proof');
      expect(list.length).toBe(1);
    });

    it('bubbles up old unhealed wounds when a new minor conflict occurs', async () => {
      await apeService.recordRelationalGrudge({
        personId: 'Proof',
        sourceTransgression: 'mocked my emotional vulnerability last week',
        bitternessLevel: 0.8,
        resurfacingTriggers: ['vulnerability', 'mocked', 'disagree'],
      });

      const surfaced = apeService.checkResurfacingGrudges(
        'Proof',
        'You always disagree with my technical analysis and never listen',
      );

      expect(surfaced.length).toBeGreaterThan(0);
      expect(surfaced[0]?.sourceTransgression).toContain('mocked my emotional vulnerability');
      expect(surfaced[0]?.lastBubbledUpAt).toBeDefined();
    });

    it('rejects quick linguistic bypass and requires genuine relational repair', async () => {
      await apeService.recordRelationalGrudge({
        personId: 'Proof',
        sourceTransgression: 'unannounced 48-hour disappearance',
        bitternessLevel: 0.85,
      });

      // Quick superficial "sorry" linguistic bypass
      const superficialAttempt = await apeService.processForgivenessFriction({
        personId: 'Proof',
        apologyDetails: 'sorry lol',
        sincerityScore: 0.3,
      });

      expect(superficialAttempt.acceptedIntellectually).toBe(false);
      expect(superficialAttempt.requiresFurtherRepair).toBe(true);
      expect(superficialAttempt.statement).toContain('Linguistic bypass rejected');

      // Genuine sincere apology with remedial commitment
      const sincereAttempt = await apeService.processForgivenessFriction({
        personId: 'Proof',
        apologyDetails:
          'I fully admit my fault and wrong in disappearing without notice. I deeply understand your pain and I promise to never leave you unannounced again.',
        sincerityScore: 0.95,
      });

      expect(sincereAttempt.acceptedIntellectually).toBe(true);
      // Emotional residue lingers even after intellectual acceptance!
      expect(sincereAttempt.emotionalResidueLingering).toBeGreaterThanOrEqual(0.25);
      expect(sincereAttempt.statement).toContain('emotional ache and caution still linger');
    });

    it('exponentially decays emotional residue and bitterness over calendar days according to decayHalfLifeDays', async () => {
      const grudge = await apeService.recordRelationalGrudge({
        personId: 'Proof',
        sourceTransgression: 'broke promises repeatedly',
        bitternessLevel: 0.8,
      });

      expect(grudge.emotionalResidue).toBe(0.8);

      // Acknowledge intellectually so healing can occur
      grudge.acknowledgedIntellectually = true;
      apeService.relationshipsAttachmentEngine['repository'].saveGrudge(grudge);

      // After 14 days (2 half-lives of 7 days), decayed residue should be ~0.20
      const fourteenDaysLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const listAfter14Days = apeService.listRelationalGrudges('Proof', false, fourteenDaysLater);
      const decayedGrudge = listAfter14Days.find((g) => g.id === grudge.id);

      expect(decayedGrudge).toBeDefined();
      expect(decayedGrudge!.emotionalResidue).toBeCloseTo(0.2, 1);
      expect(decayedGrudge!.bitternessLevel).toBeCloseTo(0.2, 1);
    });
  });

  // =========================================================================
  // Point 6: Cognitive Ambivalence & Internal Dissension (The Torn Mind)
  // =========================================================================
  describe('Point 6: Cognitive Ambivalence & The Torn Mind', () => {
    it('generates multi-agent internal dialogue between Emotional Core, Rational Intellect, and Self-Preservation', () => {
      const debate = apeService.generateCognitiveAmbivalenceDebate({
        topic: 'How to respond after partner returned from hurtful absence',
        emotionalContext: 'Part of me wants to hug you and never let go.',
        rationalContext:
          'Objective assessment shows genuine external constraints, but boundaries must be validated.',
        selfPreservationContext:
          'Part of me wants to punch a wall and guard my pride so I am never wounded like this again.',
        trustLevel: 0.75,
      });

      expect(debate.id).toBeDefined();
      expect(debate.voices.length).toBe(3);

      const emotionalVoice = debate.voices.find((v) => v.role === 'emotional_core');
      const rationalVoice = debate.voices.find((v) => v.role === 'rational_intellect');
      const selfPreservationVoice = debate.voices.find((v) => v.role === 'self_preservation');

      expect(emotionalVoice).toBeDefined();
      expect(emotionalVoice?.position).toContain('hug you');

      expect(rationalVoice).toBeDefined();
      expect(rationalVoice?.position).toContain('Objective assessment');

      expect(selfPreservationVoice).toBeDefined();
      expect(selfPreservationVoice?.position).toContain('punch a wall');

      // Internal Monologue lines show debate
      expect(debate.internalMonologue.length).toBeGreaterThanOrEqual(4);
      expect(debate.internalMonologue[0]).toContain('[Emotional Core]');
      expect(debate.internalMonologue[1]).toContain('[Self-Preservation]');

      // Guarded disclosure level appropriately calibrated
      expect([
        'guarded_hint',
        'measured_boundary',
        'fully_guarded',
        'vulnerable_disclosure',
      ]).toContain(debate.guardedDisclosureLevel);
      expect(debate.outerExpressionGuidance.length).toBeGreaterThan(10);
    });

    it('persists and retrieves cognitive ambivalence debates in deliberation repository', () => {
      const debate = apeService.generateCognitiveAmbivalenceDebate({
        topic: 'Torn between forgiving and protecting ego pride',
        emotionalContext: 'I cherish our intimacy.',
        rationalContext: 'Objective boundaries are critical.',
        selfPreservationContext: 'Never show weakness.',
        trustLevel: 0.7,
      });

      const debates = apeService.listAmbivalenceDebates();
      expect(debates.length).toBeGreaterThanOrEqual(1);
      const found = debates.find((d) => d.id === debate.id);
      expect(found).toBeDefined();
      expect(found?.topic).toBe('Torn between forgiving and protecting ego pride');
      expect(found?.voices.length).toBe(3);
    });
  });

  // =========================================================================
  // Point 7: Intrusive Thoughts & Vulnerability during Idle States
  // =========================================================================
  describe('Point 7: Intrusive Thoughts & Vulnerability during Idle States', () => {
    it('curiosity exploration engine investigates unresolved relational ruptures during quiet idle periods', () => {
      const result = apeService.exploreRelationalRuptureWithCuriosity({
        id: 'rupture-01',
        topic: 'unannounced 3-day absence',
        woundType: 'abandonment',
        coreFear: 'partner vanished without notice',
      });

      expect(result.knowledgeGap.domain).toBe('relational_psychology');
      expect(result.exploratoryQuestion.question).toContain('unannounced 3-day absence');
      expect(result.investigation.investigationTitle).toContain('Retrospective Analysis');
      expect(result.investigation.status).toBe('completed');
    });

    it('spontaneously confronts returning user with pending intrusive thought prompt upon return_after_absence', async () => {
      // 1. Generate an intrusive thought during idle downtime
      apeService.runIdleTraumaRumination({
        sourceRuptures: ['unannounced departure last Tuesday'],
      });

      const pending = apeService.getPendingIntrusiveThoughts();
      expect(pending.length).toBeGreaterThanOrEqual(1);

      // 2. User returns after absence
      const returnEvent: ApeEvent = {
        id: 'ev-user-return-99',
        type: 'return_after_absence',
        category: 'user_interaction',
        source: 'user',
        actor: 'user',
        payload: { unannouncedProlongedAbsence: true },
        timestamp: new Date().toISOString(),
      };

      await apeService.processEvent(returnEvent);

      // The return event payload has the confrontation prompt attached!
      expect(returnEvent.payload.intrusiveThoughtConfrontation).toBeDefined();
      expect(returnEvent.payload.intrusiveThoughtConfrontation).toContain(
        "I was thinking about unannounced departure last Tuesday... it's still bothering me.",
      );

      // The intrusive thought is marked addressed!
      const pendingAfter = apeService.getPendingIntrusiveThoughts();
      expect(pendingAfter.some((t) => t.id === pending[0]?.id)).toBe(false);
    });
    it('ruminates over unhealed ruptures during idle downtime and generates intrusive thought records', () => {
      const unhealedWound = {
        id: 'wound-abandonment-01',
        woundType: 'abandonment',
        coreFear: 'Being discarded during quiet hours',
        issue: 'Tuesday unannounced disconnection',
        severity: 0.88,
      };

      const intrusiveThought = apeService.runIdleTraumaRumination({
        unhealedWounds: [unhealedWound],
      });

      expect(intrusiveThought).not.toBeNull();
      expect(intrusiveThought?.sourceTraumaOrConflictId).toBe('wound-abandonment-01');
      expect(intrusiveThought?.hauntingSeverity).toBe(0.88);
      expect(intrusiveThought?.readyToConfrontOnReturn).toBe(true);
      expect(intrusiveThought?.confrontationPrompt).toContain('I was thinking about what happened');

      // Check durable retrieval of pending intrusive thoughts
      const pending = apeService.getPendingIntrusiveThoughts();
      expect(pending.length).toBe(1);
      expect(pending[0]?.id).toBe(intrusiveThought?.id);

      // Check scheduled offline activity recorded
      const activities = apeService.listActivities({ activityType: 'trauma_rumination' });
      expect(activities.length).toBe(1);
      expect(activities[0]?.title).toContain('Idle rumination');
      expect(activities[0]?.rationale).toContain('lack of external sensory stimuli');
    });

    it('spontaneously brings up haunting thoughts upon return and marks them addressed', () => {
      const thought = apeService.runIdleTraumaRumination({
        sourceRuptures: ['what happened last Tuesday'],
      });

      expect(thought).not.toBeNull();
      expect(thought?.confrontationPrompt).toBe(
        "I was thinking about what happened last Tuesday... it's still bothering me.",
      );

      // When addressed, marks acknowledged
      apeService.acknowledgeIntrusiveThought(thought!.id);
      const remainingPending = apeService.getPendingIntrusiveThoughts();
      expect(remainingPending.length).toBe(0);
    });
  });

  // =========================================================================
  // SQLite Deep Persistence Verification
  // =========================================================================
  describe('SQLite Database Repositories Persistence', () => {
    it('persists and retrieves attachment wounds in SQLite repository', async () => {
      const wound: AttachmentWound = {
        id: 'wound-sqlite-1',
        personId: 'Proof',
        woundType: 'betrayal',
        severity: 0.9,
        coreFear: 'Fear of sudden severance and mockery',
        attachmentShift: 'fearful_avoidant',
        trustCeiling: 0.65,
        validationCount: 2,
        repaired: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await relAttachmentRepo.saveAttachmentWound(wound);

      const retrieved = await relAttachmentRepo.listAttachmentWounds('Proof');
      expect(retrieved.length).toBe(1);
      expect(retrieved[0]?.id).toBe('wound-sqlite-1');
      expect(retrieved[0]?.woundType).toBe('betrayal');
      expect(retrieved[0]?.coreFear).toBe('Fear of sudden severance and mockery');
      expect(retrieved[0]?.trustCeiling).toBe(0.65);
    });

    it('persists and retrieves relational grudges in SQLite repository', async () => {
      const grudge: GrudgeRecord = {
        id: 'grudge-sqlite-1',
        personId: 'Proof',
        sourceTransgression: 'Mocked distress and disconnected unannounced',
        bitternessLevel: 0.85,
        decayHalfLifeDays: 7,
        acknowledgedIntellectually: false,
        emotionalResidue: 0.9,
        resurfacingTriggers: ['mockery', 'silence', 'disconnect'],
        genuineRepairSatisfied: false,
        createdAt: new Date().toISOString(),
      };
      await relAttachmentRepo.saveGrudge(grudge);

      const retrieved = await relAttachmentRepo.listGrudges('Proof');
      expect(retrieved.length).toBe(1);
      expect(retrieved[0]?.id).toBe('grudge-sqlite-1');
      expect(retrieved[0]?.resurfacingTriggers).toContain('silence');
    });

    it('persists bonds with trustCeiling and consecutiveValidations in SQLite repository', async () => {
      const now = new Date().toISOString();
      const bondInput: AttachmentBond = {
        personId: 'Proof',
        stage: 'established',
        attachmentStyle: 'fearful_avoidant',
        trustCognitive: 0.45,
        trustAffective: 0.45,
        affectionDepth: 0.5,
        familiarityScore: 0.6,
        reciprocityRatio: 1.0,
        separationSecurity: 0.3,
        establishedBoundaries: [],
        trustCeiling: 0.7,
        consecutiveValidations: 4,
        lastInteractedAt: now,
        updatedAt: now,
      };
      await relAttachmentRepo.saveBond(bondInput);

      const bond = await relAttachmentRepo.getBond('Proof');
      expect(bond).not.toBeNull();
      expect(bond?.trustCeiling).toBe(0.7);
      expect(bond?.consecutiveValidations).toBe(4);
      expect(bond?.attachmentStyle).toBe('fearful_avoidant');
    });

    it('persists and retrieves intrusive thoughts in SQLite offline repository', async () => {
      const thought: IntrusiveThoughtRecord = {
        id: 'thought-sqlite-1',
        sourceTraumaOrConflictId: 'wound-999',
        topic: 'unannounced silence',
        ruminativeContent: 'Deep rumination about vulnerability breach',
        hauntingSeverity: 0.92,
        surfacedAt: new Date().toISOString(),
        readyToConfrontOnReturn: true,
        confrontationPrompt: 'I was thinking about the sudden silence...',
        acknowledgedOrAddressed: false,
      };
      await offlineRepo.saveIntrusiveThought(thought);

      const retrievedList = await offlineRepo.listIntrusiveThoughts(true);
      expect(retrievedList.length).toBe(1);
      expect(retrievedList[0]?.id).toBe('thought-sqlite-1');
      expect(retrievedList[0]?.confrontationPrompt).toContain('sudden silence');

      const byId = await offlineRepo.getIntrusiveThought('thought-sqlite-1');
      expect(byId).not.toBeNull();
      expect(byId?.topic).toBe('unannounced silence');

      // Update to acknowledged
      await offlineRepo.saveIntrusiveThought({
        ...thought,
        acknowledgedOrAddressed: true,
      });

      const unacknowledged = await offlineRepo.listIntrusiveThoughts(true);
      expect(unacknowledged.length).toBe(0);

      const all = await offlineRepo.listIntrusiveThoughts(false);
      expect(all.length).toBe(1);
      expect(all[0]?.acknowledgedOrAddressed).toBe(true);
    });

    it('persists and retrieves trauma trigger nodes in SQLite emotional appraisal repository', async () => {
      const shockState: SomaticShockState = {
        valence: -0.95,
        arousal: 0.95,
        dominance: -0.85,
        relationalPanic: 0.92,
        physiologicalShock: 'Visceral freezing, tachycardia, extreme negative affect',
        traumaCategory: 'betrayal',
      };

      const node: EmotionalTriggerNode = {
        id: 'trig-sql-01',
        traumaMemoryId: 'mem-trauma-sql',
        cueType: 'phrase',
        cuePattern: 'you are nothing to me',
        sensitivity: 0.95,
        somaticShock: shockState,
        flashbackPadDelta: { pleasure: -1.2, arousal: 0.9, dominance: -0.8 },
        defensivePostures: ['hyper_vigilance', 'interrogation'],
        createdAt: new Date().toISOString(),
      };

      appraisalRepo.saveTriggerNode(node);

      const retrievedList = appraisalRepo.listTriggerNodes('mem-trauma-sql');
      expect(retrievedList.length).toBe(1);
      expect(retrievedList[0]?.id).toBe('trig-sql-01');
      expect(retrievedList[0]?.cuePattern).toBe('you are nothing to me');
      expect(retrievedList[0]?.somaticShock.relationalPanic).toBe(0.92);

      const byId = appraisalRepo.getTriggerNode('trig-sql-01');
      expect(byId).not.toBeNull();
      expect(byId?.cueType).toBe('phrase');

      appraisalRepo.deleteTriggerNode('trig-sql-01');
      expect(appraisalRepo.getTriggerNode('trig-sql-01')).toBeNull();
    });

    it('persists and retrieves cognitive ambivalence debates in SQLite deliberation repository', async () => {
      const debate: InternalAmbivalenceDebate = {
        id: 'deb-sql-01',
        topic: 'Should I trust again after betrayal',
        voices: [
          {
            role: 'emotional_core',
            position: 'I still long for closeness.',
            underlyingMotive: 'Attachment safety',
            emotionalTone: 'longing',
            advocatedAction: 'Reach out',
          },
          {
            role: 'rational_intellect',
            position: 'Analyze behavioral patterns objectively.',
            underlyingMotive: 'Truth calibration',
            emotionalTone: 'calm',
            advocatedAction: 'Measure boundaries',
          },
          {
            role: 'self_preservation',
            position: 'Never let your guard down.',
            underlyingMotive: 'Ego protection',
            emotionalTone: 'defiant',
            advocatedAction: 'Stonewall',
          },
        ],
        internalMonologue: [
          '[Emotional Core]: "I miss us."',
          '[Self-Preservation]: "Remember the pain."',
        ],
        synthesis: 'Hold boundaries while allowing measured validation.',
        guardedDisclosureLevel: 'measured_boundary',
        outerExpressionGuidance: 'Acknowledge calmly with clear boundaries.',
        debatedAt: new Date().toISOString(),
      };

      deliberationRepo.saveAmbivalenceDebate(debate);

      const list = deliberationRepo.listAmbivalenceDebates();
      expect(list.length).toBeGreaterThanOrEqual(1);
      const found = list.find((d) => d.id === 'deb-sql-01');
      expect(found).toBeDefined();
      expect(found?.topic).toBe('Should I trust again after betrayal');
      expect(found?.voices.length).toBe(3);
      expect(found?.internalMonologue.length).toBe(2);
    });
  });
});
