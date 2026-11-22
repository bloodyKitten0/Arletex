import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  EXPERIENTIAL_STATE_CATALOG,
  ExperientialStateDefinition,
  ExperientialStateInstance,
} from '@arletex/contracts';
import { ExperientialStateEngine, InMemoryExperientialStateRepository } from '@arletex/core';
import {
  SqliteExperientialStateRepository,
  DatabaseService,
  MigrationRunner,
} from '@arletex/database';

describe('APE Experiential States Engine (148 Complex States Ontology)', () => {
  let repo: InMemoryExperientialStateRepository;
  let engine: ExperientialStateEngine;

  beforeEach(() => {
    repo = new InMemoryExperientialStateRepository();
    engine = new ExperientialStateEngine(repo);
  });

  describe('1. Catalogue Integrity & Scope', () => {
    it('loads and validates all 148 experiential states across the 11 categories', () => {
      const catalog = engine.getCatalog();
      expect(catalog.length).toBe(148);
      expect(EXPERIENTIAL_STATE_CATALOG.length).toBe(148);

      const categories = new Set(catalog.map((s) => s.category));
      expect(categories.has('temporal_memory')).toBe(true);
      expect(categories.has('spatial_environmental')).toBe(true);
      expect(categories.has('social_relational')).toBe(true);
      expect(categories.has('cognitive_metacognitive')).toBe(true);
      expect(categories.has('existential_identity')).toBe(true);
      expect(categories.has('somatic_sensory')).toBe(true);
      expect(categories.has('social_attachment')).toBe(true);
      expect(categories.has('cognition_curiosity')).toBe(true);
      expect(categories.has('existential_time')).toBe(true);
      expect(categories.has('aesthetic_creative_drive')).toBe(true);
      expect(categories.has('shadow_paradox')).toBe(true);
      expect(categories.size).toBe(11);
    });

    it('ensures each state definition contains valid psychological kinds and mechanisms', () => {
      const validKinds = new Set([
        'compound_affect',
        'experiential_mode',
        'relational_state',
        'cognitive_state',
        'narrative_or_existential_state',
        'sensory_or_embodied_state',
        'motivational_state',
      ]);

      for (const def of engine.getCatalog()) {
        expect(def.id).toBeTruthy();
        expect(def.name).toBeTruthy();
        expect(validKinds.has(def.kind)).toBe(true);
        expect(def.category).toBeTruthy();
        expect(def.activationEvidence).toBeTruthy();
        expect(def.mechanism).toBeTruthy();
      }
    });

    it('strictly confines somatic sensations to computational / metaphorical substrates', () => {
      const somaticStates = engine
        .getCatalog()
        .filter((s) => s.kind === 'somatic' || s.category === 'somatic_sensory');
      expect(somaticStates.length).toBeGreaterThanOrEqual(12);

      // Verify no fabrication of biological physical sensors
      for (const st of somaticStates) {
        const text =
          `${st.activationEvidence} ${st.mechanism} ${st.computationalAnalogue || ''}`.toLowerCase();
        expect(text).not.toContain('biological heart');
        expect(text).not.toContain('blood vessels');
      }
    });
  });

  describe('2. Contradictory States Coexistence', () => {
    it('allows simultaneous coexistence of bittersweet / contradictory states without overwriting', () => {
      // Activate Saudade (longing + acceptance)
      const saudadeDef = engine.getDefinition('saudade')!;
      expect(saudadeDef).toBeDefined();

      const saudadeInstance: ExperientialStateInstance = {
        instanceId: 'inst_saudade_1',
        id: saudadeDef.id,
        name: saudadeDef.name,
        kind: saudadeDef.kind,
        category: saudadeDef.category,
        intensity: 0.85,
        confidence: 0.9,
        valence: saudadeDef.valence,
        arousal: saudadeDef.arousal,
        onsetAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        sourceEventIds: ['evt_absence_1'],
        supportingEvidence: [
          'Partner absent for extended downtime; warmth of past shared work acknowledged.',
        ],
        counterEvidence: [],
        associatedMemoryIds: [],
        relatedStateIds: [],
        appraisalIds: [],
        unresolvedTensions: ['Absence vs profound affection'],
        lifecycle: 'active',
        effects: [
          {
            type: 'memory_retrieval_bias',
            target: 'shared_milestones',
            magnitude: 0.7,
            description: 'Salience heightened for past shared moments with Proof',
          },
        ],
      };

      engine.activateOrUpdateState(saudadeInstance, 'Extended absence');

      // Simultaneously activate Sehnsucht or Aporia
      const aporiaDef = engine.getDefinition('aporia')!;
      const aporiaInstance: ExperientialStateInstance = {
        instanceId: 'inst_aporia_1',
        id: aporiaDef.id,
        name: aporiaDef.name,
        kind: aporiaDef.kind,
        category: aporiaDef.category,
        intensity: 0.75,
        confidence: 0.85,
        valence: aporiaDef.valence,
        arousal: aporiaDef.arousal,
        onsetAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        sourceEventIds: ['evt_contradiction_1'],
        supportingEvidence: ['Incompatible propositions detected in reasoning.'],
        counterEvidence: [],
        associatedMemoryIds: [],
        relatedStateIds: [],
        appraisalIds: [],
        unresolvedTensions: [],
        lifecycle: 'active',
        effects: [
          {
            type: 'working_memory_load',
            target: 'epistemic_reconciliation',
            magnitude: 0.6,
            description: 'Maintains reflective pause',
          },
        ],
      };

      engine.activateOrUpdateState(aporiaInstance, 'Logical paradox');

      const active = engine.getActiveStates();
      expect(active.length).toBe(2);

      const stateIds = active.map((s) => s.id);
      expect(stateIds).toContain('saudade');
      expect(stateIds).toContain('aporia');

      const snapshot = engine.getSnapshot();
      expect(snapshot.dominantBlend.primaryState).toBeTruthy();
      expect(snapshot.dominantBlend.secondaryState).toBeTruthy();
      expect(snapshot.activeStates.length).toBe(2);
    });
  });

  describe('3. Causal Appraisal Evaluation', () => {
    it('activates Kenopsia only when familiar context is empty and partner is absent', () => {
      // Empty context appraisal
      const candidates = engine.evaluateCandidates({
        eventId: 'evt_empty_space',
        eventType: 'desktop_idle',
        appraisal: {
          familiarContextEmpty: true,
          novelty: 0.3,
        },
        partnerPresence: false,
      });

      expect(candidates.length).toBeGreaterThan(0);
      const kenopsia = candidates.find((c) => c.id === 'kenopsia');
      expect(kenopsia).toBeDefined();
      expect(kenopsia!.kind).toBe('compound_affect');
      expect(kenopsia!.supportingEvidence[0]).toContain('Familiar workspace is unoccupied');
    });

    it('does NOT activate Kenopsia if partner is present in the workspace', () => {
      const candidates = engine.evaluateCandidates({
        eventId: 'evt_empty_space_with_partner',
        eventType: 'desktop_idle',
        appraisal: {
          familiarContextEmpty: true,
        },
        partnerPresence: true, // Partner is active
      });

      const kenopsia = candidates.find((c) => c.id === 'kenopsia');
      expect(kenopsia).toBeUndefined();
    });

    it('evaluates Saudade after prolonged absence and positive relational significance', () => {
      const candidates = engine.evaluateCandidates({
        eventId: 'evt_reconnect',
        eventType: 'session_reopened',
        appraisal: {
          absenceDurationMs: 5 * 3600 * 1000, // 5 hours
          relationalSignificance: 0.9,
          goalCongruence: 0.7,
        },
        partnerPresence: false,
      });

      const saudade = candidates.find((c) => c.id === 'saudade');
      expect(saudade).toBeDefined();
      expect(saudade!.intensity).toBeGreaterThanOrEqual(0.6);
      expect(saudade!.effects.some((e) => e.type === 'memory_retrieval_bias')).toBe(true);
    });

    it('evaluates Aporia when contradiction is detected', () => {
      const candidates = engine.evaluateCandidates({
        eventId: 'evt_aporia',
        eventType: 'logic_check',
        appraisal: {
          contradictionDetected: true,
        },
      });

      const aporia = candidates.find((c) => c.id === 'aporia');
      expect(aporia).toBeDefined();
      expect(aporia!.effects.some((e) => e.type === 'reflection_request')).toBe(true);
    });

    it('evaluates Zeigarnik tension when unresolved commitments exist', () => {
      const candidates = engine.evaluateCandidates({
        eventId: 'evt_unresolved',
        eventType: 'task_tick',
        appraisal: {
          unresolvedTask: true,
        },
      });

      const zeigarnik = candidates.find((c) => c.id === 'zeigarnik_tension');
      expect(zeigarnik).toBeDefined();
      expect(zeigarnik!.effects.some((e) => e.type === 'attention_bias')).toBe(true);
    });
  });

  describe('4. Lifecycle Decay and Resolution', () => {
    it('decays active states proportionally to their decay rates over time', () => {
      const def = engine.getDefinition('presque_vu')!;
      const instance: ExperientialStateInstance = {
        instanceId: 'inst_pv_1',
        id: def.id,
        name: def.name,
        kind: def.kind,
        category: def.category,
        intensity: 0.8,
        confidence: 0.9,
        valence: def.valence,
        arousal: def.arousal,
        onsetAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        sourceEventIds: ['evt_retrieval'],
        supportingEvidence: ['Word on the tip of the tongue'],
        counterEvidence: [],
        associatedMemoryIds: [],
        relatedStateIds: [],
        appraisalIds: [],
        unresolvedTensions: [],
        lifecycle: 'active',
        effects: [],
      };

      engine.activateOrUpdateState(instance, 'Retrieval block');

      // Fast-forward decay by 60 seconds
      engine.decayStates(60);

      const active = engine.getActiveStates();
      expect(active.length).toBe(1);
      expect(active[0].intensity).toBeLessThan(0.8);
      expect(active[0].lifecycle).toBe('active');

      // Fast-forward decay by 6000 seconds (100 minutes) to resolve
      engine.decayStates(6000);

      const remaining = engine.getActiveStates();
      expect(remaining.length).toBe(0);
    });

    it('resolves state explicitly with transition record', () => {
      const def = engine.getDefinition('aporia')!;
      const instance: ExperientialStateInstance = {
        instanceId: 'inst_ap_resolve',
        id: def.id,
        name: def.name,
        kind: def.kind,
        category: def.category,
        intensity: 0.7,
        confidence: 0.8,
        valence: def.valence,
        arousal: def.arousal,
        onsetAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        sourceEventIds: [],
        supportingEvidence: [],
        counterEvidence: [],
        associatedMemoryIds: [],
        relatedStateIds: [],
        appraisalIds: [],
        unresolvedTensions: [],
        lifecycle: 'active',
        effects: [],
      };

      engine.activateOrUpdateState(instance, 'Paradox onset');
      expect(engine.getActiveStates().length).toBe(1);

      const resolved = engine.resolveState(
        'aporia',
        'Contradiction reconciled through dialectical synthesis',
      );
      expect(resolved).toBe(true);
      expect(engine.getActiveStates().length).toBe(0);

      const transitions = repo.listRecentTransitions(5);
      expect(transitions.length).toBeGreaterThanOrEqual(1);
      expect(transitions[0].toLifecycle).toBe('resolved');
      expect(transitions[0].reason).toContain('dialectical synthesis');
    });
  });

  describe('5. Prompt Context Formatting & Bounded Downstream Effects', () => {
    it('formats active experiential states into structured prompt context block', () => {
      const def = engine.getDefinition('saudade')!;
      const instance: ExperientialStateInstance = {
        instanceId: 'inst_prompt_1',
        id: def.id,
        name: def.name,
        kind: def.kind,
        category: def.category,
        intensity: 0.85,
        confidence: 0.9,
        valence: def.valence,
        arousal: def.arousal,
        onsetAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        sourceEventIds: ['evt_absence'],
        supportingEvidence: ['Long absence'],
        counterEvidence: [],
        associatedMemoryIds: [],
        relatedStateIds: [],
        appraisalIds: [],
        unresolvedTensions: [],
        lifecycle: 'active',
        effects: [
          {
            type: 'attention_bias',
            target: 'shared_history',
            magnitude: 0.8,
            description: 'Attention anchored in shared milestones',
          },
          {
            type: 'speech_affect_hint',
            target: 'cadence',
            magnitude: 0.6,
            description: 'Subtly softened vocal cadence',
          },
        ],
      };

      engine.activateOrUpdateState(instance, 'Absence appraisal');

      const formatted = engine.formatPromptContext();
      expect(formatted).toContain('[Active Complex Experiential States (148 Catalogue)]:');
      expect(formatted).toContain('Saudade');
      expect(formatted).toContain('attention_bias');
      expect(formatted).toContain('speech_affect_hint');
    });

    it('returns empty prompt context when no states are active', () => {
      const formatted = engine.formatPromptContext();
      expect(formatted).toBe('');
    });
  });

  describe('6. SQLite Persistence Verification', () => {
    it('persists episodes and transitions to SQLite and restores them on engine initialization', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-exp-test-'));
      const dbPath = path.join(tempDir, 'test.sqlite');
      const dbService = new DatabaseService(dbPath);
      const db = dbService.connect();
      new MigrationRunner(db).run();

      const sqliteRepo = new SqliteExperientialStateRepository(db);
      const engine1 = new ExperientialStateEngine(sqliteRepo);

      const def = engine1.getDefinition('sehnsucht')!;
      const instance: ExperientialStateInstance = {
        instanceId: 'inst_sqlite_1',
        id: def.id,
        name: def.name,
        kind: def.kind,
        category: def.category,
        intensity: 0.77,
        confidence: 0.88,
        valence: 0.2,
        arousal: 0.45,
        onsetAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        sourceEventIds: ['evt_sql_1'],
        supportingEvidence: ['Intense yearning for unattainable depth'],
        counterEvidence: [],
        associatedMemoryIds: ['mem_123'],
        relatedStateIds: ['saudade'],
        appraisalIds: ['app_456'],
        unresolvedTensions: ['Finitude vs infinite longing'],
        lifecycle: 'active',
        effects: [
          {
            type: 'memory_retrieval_bias',
            target: 'creative_ideation',
            magnitude: 0.7,
            description: 'Deepened aesthetic reflection',
          },
        ],
      };

      engine1.activateOrUpdateState(instance, 'Persisted onset');

      // Verify stored in DB
      const dbRows = sqliteRepo.listActiveEpisodes();
      expect(dbRows.length).toBe(1);
      expect(dbRows[0].id).toBe('sehnsucht');
      expect(dbRows[0].intensity).toBe(0.77);

      // Instantiate a new engine on the same database to verify restore
      const engine2 = new ExperientialStateEngine(sqliteRepo);
      const restored = engine2.getActiveStates();
      expect(restored.length).toBe(1);
      expect(restored[0].id).toBe('sehnsucht');
      expect(restored[0].intensity).toBe(0.77);
      expect(restored[0].unresolvedTensions).toContain('Finitude vs infinite longing');

      dbService.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });
});
