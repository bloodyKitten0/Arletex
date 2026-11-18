import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  BehavioralAdaptationRule,
  LearningExperience,
  assertLearningIntegrity,
} from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  LearningAdaptationEngine,
  InMemoryLearningRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  SqliteLearningRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 13 — Learning and Adaptation', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let learningRepo: SqliteLearningRepository;
  let apeRepo: ApeRepository;
  let learningEngine: LearningAdaptationEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m13-learning-'));
    dbPath = path.join(tempDir, 'learning_m13.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    learningRepo = new SqliteLearningRepository(db);
    apeRepo = new ApeRepository(db);
    learningEngine = new LearningAdaptationEngine({
      repository: learningRepo,
    });
  });

  afterEach(async () => {
    for (const srv of activeServers) {
      try {
        await srv.stop();
      } catch {}
    }
    activeServers = [];
    try {
      dbService.close();
    } catch {}
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------
  // Test 1: Direct Experience Learning
  // -------------------------------------------------------------
  it('records direct experience and automatically synthesizes adaptation rule for significant outcomes', () => {
    const exp = learningEngine.recordExperience({
      channel: 'direct_experience',
      domain: 'typescript_compilation',
      context: 'strict null checks enabled with noUncheckedIndexedAccess',
      actionTaken: 'use explicit nullish coalescing on array index lookup',
      outcome: 'success',
      outcomeDetails: 'Code compiled with zero errors across all workspaces',
      rewardScore: 0.85,
      lessonsLearned: ['Always use nullish coalescing (??) fallback when indexing arrays under noUncheckedIndexedAccess'],
    });

    expect(exp.id).toBeDefined();
    expect(exp.channel).toBe('direct_experience');
    expect(exp.rewardScore).toBe(0.85);

    const rules = learningRepo.listRules({ domain: 'typescript_compilation' });
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const rule = rules[0]!;
    expect(rule.sourceExperienceIds).toContain(exp.id);
    expect(rule.recommendedStrategy).toContain('nullish coalescing');
    expect(rule.confidence).toBeGreaterThanOrEqual(0.7);
  });

  // -------------------------------------------------------------
  // Test 2: Observational and Instructional Learning
  // -------------------------------------------------------------
  it('supports learning through observation and instruction across channels', () => {
    // Observational learning
    const obsExp = learningEngine.recordExperience({
      channel: 'observation',
      domain: 'partner_workflow',
      context: 'Proof debugging complex asynchronous pipelines',
      actionTaken: 'observed Proof checking step-by-step trace timestamps',
      outcome: 'success',
      outcomeDetails: 'Issue quickly localized to concurrent race condition',
      rewardScore: 0.75,
      lessonsLearned: ['Correlating trace timestamps across distributed processes accelerates triage'],
    });
    expect(obsExp.channel).toBe('observation');

    // Instructional learning
    const instExp = learningEngine.recordExperience({
      channel: 'instruction',
      domain: 'relationship_protocol',
      context: 'Proof communicating communication preference',
      actionTaken: 'Proof instructed: provide concise technical decisions first, elaboration only on request',
      outcome: 'success',
      outcomeDetails: 'Communication was aligned and direct',
      rewardScore: 0.9,
      lessonsLearned: ['Lead with executive conclusions and crisp findings'],
    });
    expect(instExp.channel).toBe('instruction');

    const experiences = learningRepo.listExperiences({ limit: 10 });
    expect(experiences.some((e) => e.channel === 'observation')).toBe(true);
    expect(experiences.some((e) => e.channel === 'instruction')).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 3: Learning from Mistakes (Failure & Avoid Strategy)
  // -------------------------------------------------------------
  it('learns from mistakes by synthesizing avoid strategies and negative rewards', () => {
    const mistakeExp = learningEngine.recordExperience({
      channel: 'mistake',
      domain: 'database_migration',
      context: 'running migration without transaction guard',
      actionTaken: 'executed raw batch script without begin transaction',
      outcome: 'failure',
      outcomeDetails: 'Partial schema migration left database in intermediate locked state',
      rewardScore: -0.9,
      lessonsLearned: ['Wrap multi-table schema alterations in explicit transactional boundaries'],
    });

    const rules = learningRepo.listRules({ domain: 'database_migration' });
    expect(rules.length).toBeGreaterThanOrEqual(1);
    const failureRule = rules.find((r) => r.sourceExperienceIds.includes(mistakeExp.id));
    expect(failureRule).toBeDefined();
    expect(failureRule!.avoidStrategy).toBe('executed raw batch script without begin transaction');
    expect(failureRule!.recommendedStrategy).toContain('transactional boundaries');
  });

  // -------------------------------------------------------------
  // Test 4: Strategy Recommendations and Expected Improvement
  // -------------------------------------------------------------
  it('provides context-aware strategy recommendations and calculates measurable improvement', () => {
    const exp = learningEngine.recordExperience({
      channel: 'direct_experience',
      domain: 'code_refactoring',
      context: 'large legacy module decomposition',
      actionTaken: 'extract cohesive domain interfaces before splitting implementations',
      outcome: 'success',
      outcomeDetails: 'Zero regression during refactor',
      rewardScore: 0.8,
      lessonsLearned: ['Define explicit TypeScript interface boundaries first'],
    });

    const recommendation = learningEngine.getRecommendations(
      'large legacy module decomposition and restructuring',
      'code_refactoring',
    );

    expect(recommendation.recommendedRules.length).toBeGreaterThanOrEqual(1);
    expect(recommendation.confidenceScore).toBeGreaterThan(0.5);
    expect(recommendation.expectedSuccessImprovement).toBeGreaterThan(0.0);
  });

  // -------------------------------------------------------------
  // Test 5: Continuous Behavioral Adaptation via Feedback Loop
  // -------------------------------------------------------------
  it('demonstrates measurable continuous improvement through successive feedback adjustments', () => {
    const exp = learningEngine.recordExperience({
      channel: 'direct_experience',
      domain: 'api_design',
      context: 'idempotent endpoint creation',
      actionTaken: 'generate idempotency keys for mutate calls',
      outcome: 'success',
      outcomeDetails: 'Duplicate calls safely handled',
      rewardScore: 0.7,
      lessonsLearned: ['Use client-provided UUID idempotency tokens'],
    });

    const initialRules = learningRepo.listRules({ domain: 'api_design' });
    const rule = initialRules[0]!;
    const initialSuccessRate = rule.successRate;
    const initialConfidence = rule.confidence;

    // Apply positive feedback
    const improvedRule1 = learningEngine.applyFeedback(rule.id, 'success');
    expect(improvedRule1.sampleCount).toBe(rule.sampleCount + 1);
    expect(improvedRule1.confidence).toBeGreaterThanOrEqual(initialConfidence);

    const improvedRule2 = learningEngine.applyFeedback(rule.id, 'success');
    expect(improvedRule2.sampleCount).toBe(improvedRule1.sampleCount + 1);
    expect(improvedRule2.successRate).toBeGreaterThanOrEqual(improvedRule1.successRate);

    // Now test failure feedback dampening
    const dampened = learningEngine.applyFeedback(rule.id, 'failure');
    expect(dampened.confidence).toBeLessThan(improvedRule2.confidence);
  });

  // -------------------------------------------------------------
  // Test 6: Pattern Recognition across Experiences
  // -------------------------------------------------------------
  it('recognizes empirical patterns across recurring experiences', () => {
    for (let i = 0; i < 3; i++) {
      learningEngine.recordExperience({
        channel: 'direct_experience',
        domain: 'network_resilience',
        context: 'http socket timeout under heavy load',
        actionTaken: `retry with exponential jitter backoff attempt ${i}`,
        outcome: 'success',
        outcomeDetails: 'Request recovered successfully',
        rewardScore: 0.8,
        lessonsLearned: ['Exponential backoff with full jitter resolves transient congestion'],
      });
    }

    const patterns = learningEngine.recognizePatterns('network_resilience');
    expect(patterns.length).toBeGreaterThanOrEqual(1);
    const netPattern = patterns[0]!;
    expect(netPattern.occurrences).toBeGreaterThanOrEqual(3);
    expect(netPattern.confidence).toBeGreaterThanOrEqual(0.7);
    expect(netPattern.implications.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------
  // Test 7: Generalization and Cross-Domain Transfer Learning
  // -------------------------------------------------------------
  it('generalizes adaptation rules and enables transfer learning to target domains', () => {
    const exp = learningEngine.recordExperience({
      channel: 'direct_experience',
      domain: 'database_tuning',
      context: 'slow query latency',
      actionTaken: 'introduce covering index on filtered and joined columns',
      outcome: 'success',
      outcomeDetails: 'Query time dropped from 400ms to 2ms',
      rewardScore: 0.95,
      lessonsLearned: ['Index high-cardinality predicate keys to avoid full table scans'],
    });

    const rules = learningRepo.listRules({ domain: 'database_tuning' });
    const baseRule = rules[0]!;

    const generalized = learningEngine.generalizeRule(baseRule.id, ['in_memory_cache', 'search_engine']);
    expect(generalized.isGeneralization).toBe(true);
    expect(generalized.transferDomains).toContain('in_memory_cache');
    expect(generalized.transferDomains).toContain('search_engine');

    // Query recommendation in transferred domain
    const transferRec = learningEngine.getRecommendations('slow query latency', 'in_memory_cache');
    expect(transferRec.recommendedRules.some((r) => r.id === baseRule.id)).toBe(true);
  });

  // -------------------------------------------------------------
  // Test 8: Negative Invariant — Rejection of Ungrounded Artificial Synthesis
  // -------------------------------------------------------------
  it('strictly rejects artificial rule synthesis lacking empirical source experiences', () => {
    expect(() => {
      learningEngine.createAdaptationRule({
        sourceExperienceIds: [], // Empty source violates empirical integrity!
        domain: 'artificial_magic',
        condition: 'when facing unknown problem',
        recommendedStrategy: 'artificially guess desired result without evidence',
      });
    }).toThrow(/Negative Invariant Violation/);

    expect(() => {
      assertLearningIntegrity({
        id: crypto.randomUUID(),
        sourceExperienceIds: ['real_id_1'],
        domain: 'test',
        condition: 'cond',
        recommendedStrategy: 'strat',
        confidence: 1.5, // Invalid confidence > 1
        successRate: 0.5,
        sampleCount: 1,
        isGeneralization: false,
        transferDomains: [],
        updatedAt: new Date().toISOString(),
      });
    }).toThrow(/Invalid confidence value/);
  });

  // -------------------------------------------------------------
  // Test 9: SQLite Repository Persistence and Restart Recovery
  // -------------------------------------------------------------
  it('persists experiences and behavioral rules across database restarts', () => {
    const exp = learningEngine.recordExperience({
      channel: 'direct_experience',
      domain: 'sqlite_persistence',
      context: 'system restart simulation',
      actionTaken: 'store state in sqlite disk tables',
      outcome: 'success',
      outcomeDetails: 'All rows verified intact',
      rewardScore: 0.9,
      lessonsLearned: ['Disk-backed SQLite preserves durable cognitive state'],
    });

    const rule = learningEngine.createAdaptationRule({
      sourceExperienceIds: [exp.id],
      domain: 'sqlite_persistence',
      condition: 'system restart simulation',
      recommendedStrategy: 'Verify table schema version on connect',
      confidence: 0.88,
      successRate: 0.92,
    });

    // Close database connection
    dbService.close();

    // Reopen from disk
    const dbService2 = new DatabaseService(dbPath);
    const db2 = dbService2.connect();
    const repo2 = new SqliteLearningRepository(db2);

    const loadedExp = repo2.getExperienceById(exp.id);
    expect(loadedExp).not.toBeNull();
    expect(loadedExp!.domain).toBe('sqlite_persistence');
    expect(loadedExp!.rewardScore).toBe(0.9);

    const loadedRule = repo2.getRuleById(rule.id);
    expect(loadedRule).not.toBeNull();
    expect(loadedRule!.recommendedStrategy).toBe('Verify table schema version on connect');
    expect(loadedRule!.confidence).toBe(0.88);

    dbService2.close();
  });

  // -------------------------------------------------------------
  // Test 10: ApeService Integration and REST API Endpoints
  // -------------------------------------------------------------
  it('integrates into ApeService prompt context and serves REST endpoints', async () => {
    const config = createDefaultConfig();
    config.databasePath = dbPath;
    const server = new ArletexBackendServer(config);
    activeServers.push(server);
    await server.start(0);

    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // Test POST /api/ape/learning/experience
    const expRes = await fetch(`${baseUrl}/api/ape/learning/experience`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'direct_experience',
        domain: 'rest_integration',
        context: 'http endpoint test',
        actionTaken: 'send post request',
        outcome: 'success',
        outcomeDetails: 'Received 201 Created',
        rewardScore: 0.8,
        lessonsLearned: ['REST endpoints respond with structured json'],
      }),
    });
    expect(expRes.status).toBe(201);
    const expJson = (await expRes.json()) as any;
    expect(expJson.success).toBe(true);
    expect(expJson.experience.domain).toBe('rest_integration');

    // Test GET /api/ape/learning/experiences
    const listRes = await fetch(`${baseUrl}/api/ape/learning/experiences?domain=rest_integration`);
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as any[];
    expect(listJson.length).toBeGreaterThanOrEqual(1);

    // Test POST /api/ape/learning/recommend
    const recRes = await fetch(`${baseUrl}/api/ape/learning/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: 'http endpoint test',
        domain: 'rest_integration',
      }),
    });
    expect(recRes.status).toBe(200);
    const recJson = (await recRes.json()) as any;
    expect(recJson.domain).toBe('rest_integration');
    expect(recJson.confidenceScore).toBeGreaterThanOrEqual(0.5);

    // Test GET /api/ape/learning/summary
    const summaryRes = await fetch(`${baseUrl}/api/ape/learning/summary`);
    expect(summaryRes.status).toBe(200);
    const summaryJson = (await summaryRes.json()) as any;
    expect(summaryJson.totalExperiences).toBeGreaterThanOrEqual(1);
    expect(summaryJson.channelCounts.direct_experience).toBeGreaterThanOrEqual(1);

    // Verify ApeService prompt context includes learning line
    const apeService = (server as any).apeService as ApeService;
    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('Learning & Continuous Adaptation:');
    expect(promptContext).toContain('Continuous behavioral adaptation grounded in direct experience and feedback');
  });
});
