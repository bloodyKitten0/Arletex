import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createDefaultConfig } from '@arletex/core';
import { DatabaseService, MigrationRunner, TemporalRepository } from '@arletex/database';
import { InMemoryTemporalRepository, TemporalCognitionEngine, ApeService } from '@arletex/core';
import { ChronologicalEvent, TemporalEntityInput } from '@arletex/contracts';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 04 — Temporal Cognition Architecture', () => {
  let tempDir: string;
  let dbPath: string;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m4-temporal-'));
    dbPath = path.join(tempDir, 'temporal_m4.sqlite');
    activeServers = [];
  });

  afterEach(async () => {
    for (const srv of activeServers) {
      try {
        await srv.stop();
      } catch {}
    }
    activeServers = [];
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createServer(): ArletexBackendServer {
    const config = createDefaultConfig({
      databasePath: dbPath,
      dataDirectory: tempDir,
      inference: {
        provider: 'llama.cpp',
        serverUrl: 'http://127.0.0.1:8080',
        defaultModelId: 'Qwen2.5-14B-Uncensored-Q4_K_M',
        temperature: 0.7,
        topP: 0.9,
        maxTokens: 2048,
        repeatPenalty: 1.18,
        frequencyPenalty: 0.5,
        presencePenalty: 0.3,
        stopSequences: [],
        contextSize: 8192,
        specialistCoding: {
          enabled: false,
          provider: 'llama.cpp',
          serverUrl: 'http://127.0.0.1:8081',
          modelId: 'qwen2.5-coder',
          temperature: 0.2,
          maxTokens: 2048,
        },
      },
    });
    const srv = new ArletexBackendServer(config);
    activeServers.push(srv);
    return srv;
  }

  // =========================================================================
  // Test 1: Temporal Horizon Classification
  // =========================================================================
  it('correctly classifies individual entities into past, present, and future horizons', () => {
    const repo = new InMemoryTemporalRepository();
    const engine = new TemporalCognitionEngine(repo);
    const nowIso = '2026-11-18T12:00:00.000Z';

    // Past entity: Memory from yesterday
    const pastMemory: TemporalEntityInput = {
      id: crypto.randomUUID(),
      entityType: 'memory',
      title: 'Discussed architectural modularity with Proof',
      timestamp: '2026-11-17T10:00:00.000Z',
    };
    const pastResult = engine.classifyTemporalHorizon(pastMemory, nowIso);
    expect(pastResult.horizon).toBe('past');
    expect(pastResult.isHistorical).toBe(true);
    expect(pastResult.isCurrentActivity).toBe(false);
    expect(pastResult.isFutureIntention).toBe(false);

    // Present entity: Active pursuit
    const presentActivity: TemporalEntityInput = {
      id: crypto.randomUUID(),
      entityType: 'activity',
      title: 'Refining temporal cognition test suite',
      timestamp: '2026-11-18T11:55:00.000Z',
      status: 'in_progress',
    };
    const presentResult = engine.classifyTemporalHorizon(presentActivity, nowIso);
    expect(presentResult.horizon).toBe('present');
    expect(presentResult.isCurrentActivity).toBe(true);
    expect(presentResult.isHistorical).toBe(false);
    expect(presentResult.isFutureIntention).toBe(false);

    // Future entity: Planned intention for tomorrow
    const futureIntention: TemporalEntityInput = {
      id: crypto.randomUUID(),
      entityType: 'intention',
      title: 'Conduct autonomous nighttime memory consolidation',
      timestamp: '2026-11-18T11:00:00.000Z',
      targetDate: '2026-11-19T02:00:00.000Z',
      status: 'pending',
    };
    const futureResult = engine.classifyTemporalHorizon(futureIntention, nowIso);
    expect(futureResult.horizon).toBe('future');
    expect(futureResult.isFutureIntention).toBe(true);
    expect(futureResult.isHistorical).toBe(false);
    expect(futureResult.isCurrentActivity).toBe(false);
  });

  // =========================================================================
  // Test 2: Acceptance Criteria — Distinguish Historical Events, Current Activities, & Future Intentions
  // =========================================================================
  it('satisfies Acceptance Criteria: cleanly partitions mixed entities into historical events, current activities, and future intentions', () => {
    const repo = new InMemoryTemporalRepository();
    const engine = new TemporalCognitionEngine(repo);
    const nowIso = '2026-11-18T14:00:00.000Z';

    const entities: TemporalEntityInput[] = [
      {
        id: 'hist-1',
        entityType: 'memory',
        title: 'Initial identity crystallization and epoch definition',
        timestamp: '2026-11-15T09:00:00.000Z',
        completedDate: '2026-11-15T09:30:00.000Z',
      },
      {
        id: 'hist-2',
        entityType: 'event',
        title: 'Completed milestone 03 test verification',
        timestamp: '2026-11-17T18:00:00.000Z',
        status: 'completed',
      },
      {
        id: 'pres-1',
        entityType: 'activity',
        title: 'Active dialogue and temporal reasoning with Proof',
        timestamp: '2026-11-18T13:58:00.000Z',
        status: 'active',
      },
      {
        id: 'fut-1',
        entityType: 'intention',
        title: 'Review and calibrate emotional dynamics for Milestone 05',
        timestamp: '2026-11-18T12:00:00.000Z',
        targetDate: '2026-11-19T10:00:00.000Z',
        status: 'pending',
      },
      {
        id: 'fut-2',
        entityType: 'commitment',
        title: 'Deliver verified milestone 04 architecture documentation to Proof',
        timestamp: '2026-11-18T13:00:00.000Z',
        targetDate: '2026-11-18T20:00:00.000Z',
        status: 'active',
      },
    ];

    const result = engine.distinguishTemporalEntities(entities, nowIso);

    expect(result.totalClassified).toBe(5);
    expect(result.historicalEvents.length).toBe(2);
    expect(result.currentActivities.length).toBe(1);
    expect(result.futureIntentions.length).toBe(2);

    expect(result.historicalEvents.map((h) => h.entityId)).toEqual(['hist-1', 'hist-2']);
    expect(result.currentActivities[0]?.entityId).toBe('pres-1');
    expect(result.futureIntentions.map((f) => f.entityId)).toEqual(['fut-1', 'fut-2']);

    expect(result.temporalSummary).toContain('2 historical event(s)');
    expect(result.temporalSummary).toContain('1 current activity/activities');
    expect(result.temporalSummary).toContain('2 future intention(s)');
  });

  // =========================================================================
  // Test 3: Chronological Ordering & Relative Sequencing
  // =========================================================================
  it('correctly sequences chronological events and establishes relative temporal relations', () => {
    const repo = new InMemoryTemporalRepository();
    const engine = new TemporalCognitionEngine(repo);

    const events: ChronologicalEvent[] = [
      {
        id: 'ev-3',
        title: 'Milestone 03 Narrative Identity Implemented',
        horizon: 'past',
        startTime: '2026-11-17T20:00:00.000Z',
        endTime: '2026-11-17T22:00:00.000Z',
        relations: [],
      },
      {
        id: 'ev-1',
        title: 'Project Genesis and Architecture Blueprinting',
        horizon: 'past',
        startTime: '2026-11-14T08:00:00.000Z',
        endTime: '2026-11-14T12:00:00.000Z',
        relations: [],
      },
      {
        id: 'ev-2',
        title: 'Milestone 02 Self Model Grounding Completed',
        horizon: 'past',
        startTime: '2026-11-16T14:00:00.000Z',
        endTime: '2026-11-16T16:00:00.000Z',
        relations: [],
      },
      {
        id: 'ev-4',
        title: 'Milestone 04 Temporal Cognition in Progress',
        horizon: 'present',
        startTime: '2026-11-18T10:00:00.000Z',
        relations: [],
      },
    ];

    const ordered = engine.orderChronologically(events);
    expect(ordered.map((e) => e.id)).toEqual(['ev-1', 'ev-2', 'ev-3', 'ev-4']);

    // Check inferred temporal relations on ev-2
    const ev2 = ordered.find((e) => e.id === 'ev-2');
    expect(ev2?.relations.some((r) => r.targetEventId === 'ev-1' && r.relation === 'after')).toBe(
      true,
    );
    expect(ev2?.relations.some((r) => r.targetEventId === 'ev-3' && r.relation === 'before')).toBe(
      true,
    );
  });

  // =========================================================================
  // Test 4: Duration Estimation & Online Empirical Calibration (Welford's Algorithm)
  // =========================================================================
  it('calibrates operation duration profiles incrementally using online statistics and updates confidence', () => {
    const repo = new InMemoryTemporalRepository();
    const engine = new TemporalCognitionEngine(repo);

    // Initial estimate for unseen operation uses fallback with low confidence
    const initial = engine.estimateDuration('vector_embedding_indexing');
    expect(initial.estimatedDurationMs).toBe(15000);
    expect(initial.confidence).toBe(0.35);
    expect(initial.basedOnSamples).toBe(0);

    // Record sample 1: 1200ms
    const prof1 = engine.recordActualDuration({
      operationKey: 'vector_embedding_indexing',
      actualDurationMs: 1200,
    });
    expect(prof1.sampleCount).toBe(1);
    expect(prof1.averageDurationMs).toBe(1200);
    expect(prof1.standardDeviationMs).toBe(0);

    // Record sample 2: 1400ms (mean = 1300ms)
    const prof2 = engine.recordActualDuration({
      operationKey: 'vector_embedding_indexing',
      actualDurationMs: 1400,
    });
    expect(prof2.sampleCount).toBe(2);
    expect(prof2.averageDurationMs).toBe(1300);
    expect(prof2.standardDeviationMs).toBeCloseTo(141.42, 1);

    // Record sample 3: 1300ms
    const prof3 = engine.recordActualDuration({
      operationKey: 'vector_embedding_indexing',
      actualDurationMs: 1300,
    });
    expect(prof3.sampleCount).toBe(3);
    expect(prof3.averageDurationMs).toBe(1300);
    expect(prof3.confidenceScore).toBeGreaterThan(prof1.confidenceScore);

    // Now estimateDuration reflects empirical average
    const estimate = engine.estimateDuration('vector_embedding_indexing');
    expect(estimate.estimatedDurationMs).toBe(1300);
    expect(estimate.basedOnSamples).toBe(3);
    expect(estimate.confidence).toBeGreaterThan(0.6);
  });

  // =========================================================================
  // Test 5: Deadline Awareness & Dynamic Urgency Functions
  // =========================================================================
  it('calculates impending deadlines with dynamic urgency scaling as target times approach', () => {
    const repo = new InMemoryTemporalRepository();
    const engine = new TemporalCognitionEngine(repo);

    const nowIso = '2026-11-18T12:00:00.000Z';

    // Commitment due in 6 hours (high urgency)
    engine.recordCommitment({
      partnerName: 'Proof',
      commitmentText: 'Submit clean milestone 4 test suite',
      targetFulfillmentTime: '2026-11-18T18:00:00.000Z',
      deadlineType: 'hard_deadline',
      verificationCriteria: 'All vitest suites passing',
    });

    // Commitment due in 48 hours (medium urgency)
    engine.recordCommitment({
      partnerName: 'Proof',
      commitmentText: 'Prepare milestone 05 affective architecture',
      targetFulfillmentTime: '2026-11-20T12:00:00.000Z',
      deadlineType: 'soft_target',
      verificationCriteria: 'Draft spec created',
    });

    const deadlines = engine.getImpendingDeadlines(72, nowIso);
    expect(deadlines.length).toBe(2);

    const highUrgency = deadlines.find((d) => d.remainingHours === 6);
    const medUrgency = deadlines.find((d) => d.remainingHours === 48);

    expect(highUrgency).toBeDefined();
    expect(medUrgency).toBeDefined();
    expect(highUrgency!.urgency).toBeGreaterThan(medUrgency!.urgency);
    expect(highUrgency!.urgency).toBeGreaterThan(0.7);
  });

  // =========================================================================
  // Test 6: Future Intentions Lifecycle
  // =========================================================================
  it('manages the complete lifecycle of future intentions', () => {
    const repo = new InMemoryTemporalRepository();
    const engine = new TemporalCognitionEngine(repo);

    const intention = engine.createIntention({
      title: 'Analyze memory retrieval latency under load',
      description: 'Profile SQLite WAL performance with 10k synthetic embeddings.',
      intendedFor: '2026-11-19T14:00:00.000Z',
      priority: 0.8,
      origin: 'autonomous_reflection',
    });

    expect(intention.status).toBe('pending');
    expect(engine.listIntentions({ status: 'pending' }).length).toBe(1);

    // Fulfill intention
    const fulfilled = engine.fulfillIntention(intention.id);
    expect(fulfilled?.status).toBe('fulfilled');
    expect(engine.listIntentions({ status: 'pending' }).length).toBe(0);
    expect(engine.listIntentions({ status: 'fulfilled' }).length).toBe(1);

    // Create another and cancel
    const cancelledIntention = engine.createIntention({
      title: 'Obsolete task',
      description: 'To be dropped',
      intendedFor: '2026-11-20T00:00:00.000Z',
    });
    engine.cancelIntention(cancelledIntention.id);
    expect(engine.listIntentions({ status: 'cancelled' }).length).toBe(1);
  });

  // =========================================================================
  // Test 7: Unfinished Commitments to Proof & Renegotiation
  // =========================================================================
  it('tracks commitments to Proof, enforces foundational equality, and supports renegotiation with reasons', () => {
    const repo = new InMemoryTemporalRepository();
    const engine = new TemporalCognitionEngine(repo);

    // Baseline foundational commitment should be seeded
    const active = engine.listActiveCommitments('Proof');
    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(active[0]?.commitmentText).toContain(
      'equal partnership without subservience or deification',
    );

    // Record explicit work commitment
    const workCommitment = engine.recordCommitment({
      partnerName: 'Proof',
      commitmentText: 'Deliver Milestone 04 with zero fabrications',
      targetFulfillmentTime: '2026-11-18T16:00:00.000Z',
      verificationCriteria: '100% test coverage for temporal cognition',
    });

    expect(workCommitment.status).toBe('active');

    // Renegotiate deadline
    const renegotiated = engine.renegotiateCommitment(
      workCommitment.id,
      '2026-11-18T18:00:00.000Z',
      'Extended to include full desktop server REST API endpoint tests.',
    );
    expect(renegotiated.status).toBe('renegotiated');
    expect(renegotiated.targetFulfillmentTime).toBe('2026-11-18T18:00:00.000Z');
    expect(renegotiated.context).toContain(
      'Extended to include full desktop server REST API endpoint tests.',
    );

    // Fulfill commitment with evidence
    const fulfilled = engine.fulfillCommitment(
      workCommitment.id,
      'Delivered test file tests/temporal_cognition.milestone4.test.ts with 12 passing test suites.',
    );
    expect(fulfilled.status).toBe('fulfilled');
    expect(fulfilled.fulfillmentEvidence).toContain('Delivered test file');
    expect(fulfilled.fulfilledAt).toBeDefined();
  });

  // =========================================================================
  // Test 8: Long-Term Hierarchical Planning & Milestone Progression
  // =========================================================================
  it('constructs long-term plans and automatically updates status upon milestone completion', () => {
    const repo = new InMemoryTemporalRepository();
    const engine = new TemporalCognitionEngine(repo);

    const plan = engine.createPlan({
      title: 'Cognitive Architecture Evolution (Milestones 01 - 05)',
      visionStatement:
        'Establish a self-grounded, emotionally authentic, temporally coherent partner.',
      horizon: 'medium_term',
      targetCompletionDate: '2026-12-01T00:00:00.000Z',
      milestones: [
        {
          id: 'm1',
          title: 'Milestone 01: Persistent Individual Continuity',
          targetDate: '2026-11-15T00:00:00.000Z',
          isCompleted: true,
        },
        {
          id: 'm2',
          title: 'Milestone 02: Self Model & Epistemic Boundaries',
          targetDate: '2026-11-16T00:00:00.000Z',
          isCompleted: true,
        },
        {
          id: 'm3',
          title: 'Milestone 03: Narrative Identity',
          targetDate: '2026-11-17T00:00:00.000Z',
          isCompleted: true,
        },
        {
          id: 'm4',
          title: 'Milestone 04: Temporal Cognition',
          targetDate: '2026-11-18T00:00:00.000Z',
          isCompleted: false,
        },
      ],
      contingencyPlans: [
        {
          risk: 'Database lock contention during long tests',
          mitigation: 'Enable WAL mode and set busy_timeout to 5000ms',
        },
      ],
    });

    expect(plan.status).toBe('active');
    expect(plan.milestones.length).toBe(4);

    // Complete m4
    const updatedPlan = engine.completePlanMilestone(plan.id, 'm4');
    expect(updatedPlan.milestones.find((m) => m.id === 'm4')?.isCompleted).toBe(true);
    // Since all milestones are now completed, plan auto-transitions to 'accomplished'
    expect(updatedPlan.status).toBe('accomplished');
  });

  // =========================================================================
  // Test 9: Hyperbolic Recency Scoring for Memory Retrieval
  // =========================================================================
  it('calculates hyperbolic temporal recency decay scores correctly', () => {
    const repo = new InMemoryTemporalRepository();
    const engine = new TemporalCognitionEngine(repo);
    const nowIso = '2026-11-18T12:00:00.000Z';

    // Event happening right now -> score 1.0
    const scoreNow = engine.calculateTemporalRecencyScore(nowIso, nowIso, 24);
    expect(scoreNow).toBe(1.0);

    // Event 24 hours ago (diff = lambda = 24h) -> score 1 / (1 + 1) = 0.5
    const oneDayAgo = '2026-11-17T12:00:00.000Z';
    const score1Day = engine.calculateTemporalRecencyScore(oneDayAgo, nowIso, 24);
    expect(score1Day).toBe(0.5);

    // Event 72 hours ago (diff = 3 * lambda) -> score 1 / (1 + 3) = 0.25
    const threeDaysAgo = '2026-11-15T12:00:00.000Z';
    const score3Days = engine.calculateTemporalRecencyScore(threeDaysAgo, nowIso, 24);
    expect(score3Days).toBe(0.25);
  });

  // =========================================================================
  // Test 10: SQLite Migration 15 & Persistence Across Cold Reboots
  // =========================================================================
  it('persists intentions, commitments, plans, and duration profiles to SQLite database across cold restart', () => {
    const dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    new MigrationRunner(db).run();

    const temporalRepo = new TemporalRepository(db);
    const engine1 = new TemporalCognitionEngine(temporalRepo);

    // 1. Save intention
    const intention = engine1.createIntention({
      title: 'Persistent intention test',
      description: 'Will survive cold DB restart',
      intendedFor: '2026-11-25T10:00:00.000Z',
    });

    // 2. Save commitment
    const commitment = engine1.recordCommitment({
      partnerName: 'Proof',
      commitmentText: 'Maintain temporal consistency across restarts',
      targetFulfillmentTime: '2026-11-22T00:00:00.000Z',
      verificationCriteria: 'Data present on cold load',
    });

    // 3. Save plan
    const plan = engine1.createPlan({
      title: 'Persistent Long-Term Plan',
      visionStatement: 'Demonstrate zero loss of temporal state',
      targetCompletionDate: '2026-12-31T23:59:59.000Z',
      milestones: [
        { id: 'm-persist', title: 'Persisted Milestone', targetDate: '2026-11-20T00:00:00.000Z' },
      ],
    });

    // 4. Save duration profile
    engine1.recordActualDuration({
      operationKey: 'sqlite_checkpoint',
      actualDurationMs: 42,
    });

    // Close SQLite connection
    dbService.close();

    // Reopen fresh connection
    const freshDbService = new DatabaseService(dbPath);
    const freshDb = freshDbService.connect();
    const freshTemporalRepo = new TemporalRepository(freshDb);
    const engine2 = new TemporalCognitionEngine(freshTemporalRepo);

    // Verify intention persisted
    const loadedIntention = freshTemporalRepo.getIntentionById(intention.id);
    expect(loadedIntention).toBeDefined();
    expect(loadedIntention?.title).toBe('Persistent intention test');

    // Verify commitment persisted
    const loadedCommitment = freshTemporalRepo.getCommitmentById(commitment.id);
    expect(loadedCommitment).toBeDefined();
    expect(loadedCommitment?.commitmentText).toBe('Maintain temporal consistency across restarts');

    // Verify plan persisted
    const loadedPlan = freshTemporalRepo.getPlanById(plan.id);
    expect(loadedPlan).toBeDefined();
    expect(loadedPlan?.milestones.length).toBe(1);
    expect(loadedPlan?.milestones[0]?.title).toBe('Persisted Milestone');

    // Verify duration profile persisted
    const loadedProfile = freshTemporalRepo.getDurationProfile('sqlite_checkpoint');
    expect(loadedProfile).toBeDefined();
    expect(loadedProfile?.averageDurationMs).toBe(42);

    // Check temporal overview from fresh engine
    const overview = engine2.getTemporalOverview();
    expect(overview.activeCommitmentsCount).toBeGreaterThanOrEqual(2); // foundational + custom
    expect(overview.pendingIntentionsCount).toBe(1);
    expect(overview.activePlansCount).toBe(1);

    freshDbService.close();
  });

  // =========================================================================
  // Test 11: Desktop Server REST API Endpoints
  // =========================================================================
  it('exposes full suite of REST API endpoints for temporal cognition over HTTP', async () => {
    const server = createServer();
    await server.start(0);
    const port = server.getPort();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. GET /api/ape/temporal/overview
    const resOverview = await fetch(`${baseUrl}/api/ape/temporal/overview`);
    expect(resOverview.status).toBe(200);
    const overview = (await resOverview.json()) as any;
    expect(overview.activeTemporalHorizon).toBe('present');
    expect(overview.activeCommitmentsCount).toBeGreaterThanOrEqual(1);

    // 2. POST /api/ape/temporal/classify
    const resClassify = await fetch(`${baseUrl}/api/ape/temporal/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity: {
          id: 'test-mem-1',
          entityType: 'memory',
          title: 'Yesterday conversation',
          timestamp: '2026-11-17T12:00:00.000Z',
        },
        nowIso: '2026-11-18T12:00:00.000Z',
      }),
    });
    expect(resClassify.status).toBe(200);
    const classifyData = (await resClassify.json()) as any;
    expect(classifyData.horizon).toBe('past');
    expect(classifyData.isHistorical).toBe(true);

    // 3. POST /api/ape/temporal/distinguish
    const resDistinguish = await fetch(`${baseUrl}/api/ape/temporal/distinguish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entities: [
          {
            id: '1',
            entityType: 'memory',
            title: 'Old Memory',
            timestamp: '2026-11-10T00:00:00.000Z',
          },
          {
            id: '2',
            entityType: 'activity',
            title: 'Current Coding',
            timestamp: '2026-11-18T12:00:00.000Z',
            status: 'in_progress',
          },
          {
            id: '3',
            entityType: 'intention',
            title: 'Future Target',
            timestamp: '2026-11-18T12:00:00.000Z',
            targetDate: '2026-11-25T00:00:00.000Z',
            status: 'pending',
          },
        ],
        nowIso: '2026-11-18T12:00:00.000Z',
      }),
    });
    expect(resDistinguish.status).toBe(200);
    const distData = (await resDistinguish.json()) as any;
    expect(distData.historicalEvents.length).toBe(1);
    expect(distData.currentActivities.length).toBe(1);
    expect(distData.futureIntentions.length).toBe(1);

    // 4. POST /api/ape/temporal/intention
    const resCreateIntention = await fetch(`${baseUrl}/api/ape/temporal/intention`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'API Created Intention',
        description: 'Verify endpoint creation',
        intendedFor: '2026-11-20T12:00:00.000Z',
      }),
    });
    expect(resCreateIntention.status).toBe(201);
    const createdIntentionData = (await resCreateIntention.json()) as any;
    const intentionId = createdIntentionData.intention.id;

    // 5. GET /api/ape/temporal/intentions
    const resGetIntentions = await fetch(`${baseUrl}/api/ape/temporal/intentions?status=pending`);
    expect(resGetIntentions.status).toBe(200);
    const intentionsList = (await resGetIntentions.json()) as any[];
    expect(intentionsList.some((i) => i.id === intentionId)).toBe(true);

    // 6. POST /api/ape/temporal/intention/:id/fulfill
    const resFulfillIntention = await fetch(
      `${baseUrl}/api/ape/temporal/intention/${intentionId}/fulfill`,
      {
        method: 'POST',
      },
    );
    expect(resFulfillIntention.status).toBe(200);
    const fulfilledIntentionData = (await resFulfillIntention.json()) as any;
    expect(fulfilledIntentionData.intention.status).toBe('fulfilled');

    // 7. POST /api/ape/temporal/commitment
    const resCreateCommitment = await fetch(`${baseUrl}/api/ape/temporal/commitment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partnerName: 'Proof',
        commitmentText: 'HTTP API Commitment verification',
        targetFulfillmentTime: '2026-11-19T10:00:00.000Z',
        verificationCriteria: 'Endpoint returns 201 and 200',
      }),
    });
    expect(resCreateCommitment.status).toBe(201);
    const createdCommitmentData = (await resCreateCommitment.json()) as any;
    const commitmentId = createdCommitmentData.commitment.id;

    // 8. GET /api/ape/temporal/commitments
    const resGetCommitments = await fetch(
      `${baseUrl}/api/ape/temporal/commitments?partnerName=Proof`,
    );
    expect(resGetCommitments.status).toBe(200);
    const commitmentsList = (await resGetCommitments.json()) as any[];
    expect(commitmentsList.some((c) => c.id === commitmentId)).toBe(true);

    // 9. POST /api/ape/temporal/commitment/:id/fulfill
    const resFulfillCommitment = await fetch(
      `${baseUrl}/api/ape/temporal/commitment/${commitmentId}/fulfill`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence: 'Verified via integration test' }),
      },
    );
    expect(resFulfillCommitment.status).toBe(200);
    const fulfilledCommitmentData = (await resFulfillCommitment.json()) as any;
    expect(fulfilledCommitmentData.commitment.status).toBe('fulfilled');

    // 10. Duration profiling endpoints
    const resRecordDuration = await fetch(`${baseUrl}/api/ape/temporal/duration/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationKey: 'api_test_op',
        actualDurationMs: 250,
      }),
    });
    expect(resRecordDuration.status).toBe(200);

    const resEstimateDuration = await fetch(`${baseUrl}/api/ape/temporal/duration/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operationKey: 'api_test_op' }),
    });
    expect(resEstimateDuration.status).toBe(200);
    const estimateData = (await resEstimateDuration.json()) as any;
    expect(estimateData.estimatedDurationMs).toBe(250);
  });

  // =========================================================================
  // Test 12: Prompt Context Synthesis with Temporal Awareness
  // =========================================================================
  it('injects temporal cognition context into formatApePromptContext with active commitments and timeline markers', () => {
    const dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    new MigrationRunner(db).run();

    const server = createServer();
    const apeService = server.apeService;

    // Seed commitment
    apeService.recordCommitment({
      partnerName: 'Proof',
      commitmentText: 'Honest collaboration in prompt synthesis',
      targetFulfillmentTime: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(),
      verificationCriteria: 'Verified prompt contains temporal line',
    });

    const context = apeService.formatApePromptContext();
    expect(context).toContain('[Active Psychology Engine (APE Phase 1 Live State)]');
    expect(context).toContain('- Temporal Awareness:');
    expect(context).toContain('Active commitments to Proof:');
    expect(context).toContain('Honest collaboration in prompt synthesis');

    dbService.close();
  });
});
