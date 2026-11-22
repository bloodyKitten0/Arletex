import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { CausalLink, CausalNode, assertCausalIntegrity } from '@arletex/contracts';
import {
  createDefaultConfig,
  ApeService,
  CausalReasoningEngine,
  InMemoryCausalRepository,
} from '@arletex/core';
import {
  ApeRepository,
  DatabaseService,
  MigrationRunner,
  SqliteCausalRepository,
} from '@arletex/database';
import { ArletexBackendServer } from '../apps/desktop/src/backend/server.js';

describe('Milestone 15 — Causal Reasoning', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let causalRepo: SqliteCausalRepository;
  let apeRepo: ApeRepository;
  let causalEngine: CausalReasoningEngine;
  let activeServers: ArletexBackendServer[] = [];

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m15-causal-'));
    dbPath = path.join(tempDir, 'causal_m15.sqlite');
    activeServers = [];

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect();
    const migrator = new MigrationRunner(db);
    migrator.run();

    causalRepo = new SqliteCausalRepository(db);
    apeRepo = new ApeRepository(db);
    causalEngine = new CausalReasoningEngine({
      repository: causalRepo,
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
  // Test 1: Cause-and-Effect Representation
  // -------------------------------------------------------------
  it('constructs and persists structured causal graph models', () => {
    const nodes: CausalNode[] = [
      {
        id: 'node_oom',
        name: 'Out Of Memory Condition',
        domain: 'systems',
        variableType: 'binary',
        description: 'Process exceeds RAM quota',
      },
      {
        id: 'node_restart',
        name: 'Service Process Restart',
        domain: 'systems',
        variableType: 'binary',
        description: 'Process killed and respawned',
      },
      {
        id: 'node_drop_req',
        name: 'Dropped Inflight Requests',
        domain: 'systems',
        variableType: 'continuous',
        description: 'Rate of 502 Bad Gateway responses',
      },
    ];

    const links: CausalLink[] = [
      {
        id: 'link_oom_restart',
        sourceNodeId: 'node_oom',
        targetNodeId: 'node_restart',
        relationType: 'direct_cause',
        strength: 0.95,
        confidence: 0.9,
        isInterventionVerified: true,
        confoundingFactors: [],
        mechanismDescription: 'Linux OOM-killer sends SIGKILL to process',
      },
      {
        id: 'link_restart_drop',
        sourceNodeId: 'node_restart',
        targetNodeId: 'node_drop_req',
        relationType: 'direct_cause',
        strength: 0.85,
        confidence: 0.88,
        isInterventionVerified: true,
        confoundingFactors: [],
        mechanismDescription: 'TCP connection severed during sudden process exit',
      },
    ];

    const graph = causalEngine.createOrUpdateGraph('systems', nodes, links);
    expect(graph.id).toBeDefined();
    expect(graph.domain).toBe('systems');
    expect(graph.nodes.length).toBe(3);
    expect(graph.links.length).toBe(2);

    const retrieved = causalRepo.getGraphById(graph.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.nodes.find((n) => n.id === 'node_oom')).toBeDefined();
  });

  // -------------------------------------------------------------
  // Test 2: Correlation vs Causation Distinction
  // -------------------------------------------------------------
  it('strictly distinguishes statistical correlation from causation and identifies third-variable confounders', () => {
    // Case A: High correlation with known confounder (ice cream sales vs drowning deaths confounded by hot summer weather)
    const confounded = causalEngine.distinguishCorrelationFromCausation(
      'ice_cream_consumption',
      'drowning_incidents',
      0.82,
      ['ambient_summer_temperature', 'beach_attendance'],
    );
    expect(confounded.isDirectCausationPlausible).toBe(false);
    expect(confounded.relationType).toBe('common_cause_confounder');
    expect(confounded.rationale).toContain('third variables');
    expect(confounded.uncertainty).toBeGreaterThanOrEqual(0.6);

    // Case B: Negligible correlation
    const negligible = causalEngine.distinguishCorrelationFromCausation(
      'shoe_size',
      'server_latency_ms',
      0.04,
    );
    expect(negligible.isDirectCausationPlausible).toBe(false);
    expect(negligible.relationType).toBe('spurious_correlation');

    // Case C: Strong correlation without known confounders (plausible contributing factor, requires interventional testing)
    const plausible = causalEngine.distinguishCorrelationFromCausation(
      'unindexed_database_scan',
      'high_cpu_utilization',
      0.91,
    );
    expect(plausible.isDirectCausationPlausible).toBe(true);
    expect(plausible.relationType).toBe('contributing_factor');
    expect(plausible.rationale).toContain('interventional testing');
  });

  // -------------------------------------------------------------
  // Test 3: Plausible Cause Inference & Alternative Explanations
  // -------------------------------------------------------------
  it('infers plausible upstream causes and surfaces alternative explanations for an effect', () => {
    const nodes: CausalNode[] = [
      {
        id: 'node_db_lock',
        name: 'Database Row Lock Contention',
        domain: 'performance',
        variableType: 'continuous',
        description: '',
      },
      {
        id: 'node_slow_network',
        name: 'Upstream Network Latency',
        domain: 'performance',
        variableType: 'continuous',
        description: '',
      },
      {
        id: 'node_request_timeout',
        name: 'API Request Timeout',
        domain: 'performance',
        variableType: 'binary',
        description: '',
      },
    ];

    const links: CausalLink[] = [
      {
        id: 'link_lock_timeout',
        sourceNodeId: 'node_db_lock',
        targetNodeId: 'node_request_timeout',
        relationType: 'contributing_factor',
        strength: 0.8,
        confidence: 0.75,
        isInterventionVerified: false,
        confoundingFactors: ['concurrent_heavy_reporting_batch'],
        mechanismDescription: 'Transaction waits on row locks beyond 30s timeout',
      },
      {
        id: 'link_net_timeout',
        sourceNodeId: 'node_slow_network',
        targetNodeId: 'node_request_timeout',
        relationType: 'contributing_factor',
        strength: 0.7,
        confidence: 0.65,
        isInterventionVerified: false,
        confoundingFactors: ['cloud_provider_transit_congestion'],
        mechanismDescription: 'Packet loss extends round trip time',
      },
    ];

    const graph = causalEngine.createOrUpdateGraph('performance', nodes, links);
    const result = causalEngine.inferCauses(graph.id, 'node_request_timeout');

    expect(result.targetEffectId).toBe('node_request_timeout');
    expect(result.plausibleCauses.length).toBe(2);
    expect(result.alternativeExplanations.length).toBe(2);
    expect(result.alternativeExplanations[0]).toContain('concurrent_heavy_reporting_batch');
    expect(result.uncertaintyLevel).toBeGreaterThan(0.2); // Elevated due to lack of intervention verification
  });

  // -------------------------------------------------------------
  // Test 4: Interventional Reasoning (Do-Calculus Verification)
  // -------------------------------------------------------------
  it('empirically verifies causal efficacy through controlled intervention testing', () => {
    const nodes: CausalNode[] = [
      {
        id: 'node_cache_enabled',
        name: 'Cache Enabled Flag',
        domain: 'caching',
        variableType: 'binary',
        description: '',
      },
      {
        id: 'node_db_qps',
        name: 'Database Query QPS',
        domain: 'caching',
        variableType: 'continuous',
        description: '',
      },
    ];

    const links: CausalLink[] = [
      {
        id: 'link_cache_qps',
        sourceNodeId: 'node_cache_enabled',
        targetNodeId: 'node_db_qps',
        relationType: 'inhibitor',
        strength: -0.9,
        confidence: 0.6,
        isInterventionVerified: false,
        confoundingFactors: [],
        mechanismDescription: 'Cached responses bypass database layer',
      },
    ];

    const graph = causalEngine.createOrUpdateGraph('caching', nodes, links);

    // Baseline: cache disabled, db_qps = 1000
    // Intervention: do(node_cache_enabled = true), db_qps drops to 50
    const intervention = causalEngine.testIntervention(
      graph.id,
      'node_cache_enabled',
      true,
      'node_db_qps',
      50, // observed value after intervention
      1000, // baseline value before intervention
    );

    expect(intervention.didEffectChange).toBe(true);
    expect(intervention.inferredCausalLink).toBe(true);
    expect(intervention.notes).toContain('empirically verified');

    // Verify graph link updated to verified
    const updatedGraph = causalRepo.getGraphById(graph.id)!;
    const link = updatedGraph.links.find((l) => l.sourceNodeId === 'node_cache_enabled')!;
    expect(link.isInterventionVerified).toBe(true);
    expect(link.confidence).toBeGreaterThanOrEqual(0.9);
  });

  // -------------------------------------------------------------
  // Test 5: Refutation by Intervention (Spurious Causal Hypothesis)
  // -------------------------------------------------------------
  it('refutes candidate causal links when an intervention fails to perturb the effect', () => {
    const nodes: CausalNode[] = [
      {
        id: 'node_button_color',
        name: 'UI Button Color',
        domain: 'frontend',
        variableType: 'categorical',
        description: '',
      },
      {
        id: 'node_api_latency',
        name: 'Backend API Latency',
        domain: 'frontend',
        variableType: 'continuous',
        description: '',
      },
    ];

    const links: CausalLink[] = [
      {
        id: 'link_color_latency',
        sourceNodeId: 'node_button_color',
        targetNodeId: 'node_api_latency',
        relationType: 'direct_cause',
        strength: 0.5,
        confidence: 0.5,
        isInterventionVerified: false,
        confoundingFactors: [],
        mechanismDescription: 'Suspected link between CSS theme and backend latency',
      },
    ];

    const graph = causalEngine.createOrUpdateGraph('frontend', nodes, links);

    // Intervention: do(button_color = 'green')
    // Result: latency remains identical (120ms before and after)
    const intervention = causalEngine.testIntervention(
      graph.id,
      'node_button_color',
      'green',
      'node_api_latency',
      120, // observed value
      120, // baseline value (no change!)
    );

    expect(intervention.didEffectChange).toBe(false);
    expect(intervention.inferredCausalLink).toBe(false);
    expect(intervention.notes).toContain('refuted or blocked');

    // Link should be downgraded to spurious_correlation
    const updatedGraph = causalRepo.getGraphById(graph.id)!;
    const link = updatedGraph.links.find((l) => l.sourceNodeId === 'node_button_color')!;
    expect(link.relationType).toBe('spurious_correlation');
    expect(link.strength).toBe(0.0);
  });

  // -------------------------------------------------------------
  // Test 6: Causal Model Updating and Belief Revision
  // -------------------------------------------------------------
  it('revises causal beliefs when observational or alternative evidence is discovered', () => {
    const nodes: CausalNode[] = [
      {
        id: 'node_sleep',
        name: 'System Idle Standby',
        domain: 'power',
        variableType: 'binary',
        description: '',
      },
      {
        id: 'node_disconnect',
        name: 'WebSocket Disconnect',
        domain: 'power',
        variableType: 'binary',
        description: '',
      },
    ];

    const links: CausalLink[] = [
      {
        id: 'link_sleep_disconnect',
        sourceNodeId: 'node_sleep',
        targetNodeId: 'node_disconnect',
        relationType: 'direct_cause',
        strength: 0.9,
        confidence: 0.75,
        isInterventionVerified: false,
        confoundingFactors: [],
        mechanismDescription: 'System sleep stops network adapter',
      },
    ];

    const graph = causalEngine.createOrUpdateGraph('power', nodes, links);

    // Discovery of an alternative cause / confounder (e.g. WiFi router DHCP lease expiration)
    const revisedGraph = causalEngine.reviseCausalBelief(
      graph.id,
      'node_sleep',
      'node_disconnect',
      {
        alternativeCauseDiscovered: 'wifi_router_dhcp_lease_renewal_drop',
        newStrength: 0.6,
      },
    );

    const link = revisedGraph.links.find((l) => l.sourceNodeId === 'node_sleep')!;
    expect(link.relationType).toBe('contributing_factor'); // Downgraded from direct_cause!
    expect(link.confoundingFactors).toContain('wifi_router_dhcp_lease_renewal_drop');
    expect(link.strength).toBe(0.6);
  });

  // -------------------------------------------------------------
  // Test 7: Consequence Evaluation and Downstream Impact
  // -------------------------------------------------------------
  it('computes overall causal model metrics and relationship summaries', () => {
    const nodes: CausalNode[] = [
      { id: 'a', name: 'Node A', domain: 'net', variableType: 'binary', description: '' },
      { id: 'b', name: 'Node B', domain: 'net', variableType: 'binary', description: '' },
      { id: 'c', name: 'Node C', domain: 'net', variableType: 'binary', description: '' },
    ];

    const links: CausalLink[] = [
      {
        id: 'l1',
        sourceNodeId: 'a',
        targetNodeId: 'b',
        relationType: 'direct_cause',
        strength: 0.8,
        confidence: 0.85,
        isInterventionVerified: true,
        confoundingFactors: [],
        mechanismDescription: 'Direct trigger',
      },
      {
        id: 'l2',
        sourceNodeId: 'b',
        targetNodeId: 'c',
        relationType: 'inhibitor',
        strength: -0.7,
        confidence: 0.8,
        isInterventionVerified: true,
        confoundingFactors: [],
        mechanismDescription: 'Inhibitory feedback',
      },
    ];

    causalEngine.createOrUpdateGraph('net', nodes, links);
    const summary = causalEngine.getCausalSummary();

    expect(summary.totalGraphs).toBeGreaterThanOrEqual(1);
    expect(summary.totalNodes).toBeGreaterThanOrEqual(3);
    expect(summary.totalLinks).toBeGreaterThanOrEqual(2);
    expect(summary.relationBreakdown['direct_cause']).toBeGreaterThanOrEqual(1);
    expect(summary.relationBreakdown['inhibitor']).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------
  // Test 8: Negative Invariant — Prevention of Unverified Confounded Direct Cause
  // -------------------------------------------------------------
  it('strictly rejects asserting unverified direct causes when known confounders exist and confidence is high', () => {
    expect(() => {
      assertCausalIntegrity({
        id: 'invalid_link',
        sourceNodeId: 'source',
        targetNodeId: 'target',
        relationType: 'direct_cause', // Cannot assert direct cause...
        strength: 0.8,
        confidence: 0.85, // ...with high confidence...
        isInterventionVerified: false, // ...without intervention verification...
        confoundingFactors: ['hidden_confounder_z'], // ...when confounders exist!
        mechanismDescription: '',
      });
    }).toThrow(/cannot be asserted as high-confidence 'direct_cause'/);

    expect(() => {
      assertCausalIntegrity({
        id: 'bad_strength',
        sourceNodeId: 's',
        targetNodeId: 't',
        relationType: 'contributing_factor',
        strength: 1.5, // VIOLATION: > 1.0
        confidence: 0.5,
        isInterventionVerified: false,
        confoundingFactors: [],
        mechanismDescription: '',
      });
    }).toThrow(/Invalid causal link strength/);
  });

  // -------------------------------------------------------------
  // Test 9: SQLite Repository Persistence and Restart Recovery
  // -------------------------------------------------------------
  it('persists causal graphs and interventions across SQLite restarts', () => {
    const nodes: CausalNode[] = [
      {
        id: 'db_conn_pool',
        name: 'Connection Pool Saturation',
        domain: 'infra',
        variableType: 'continuous',
        description: '',
      },
      {
        id: 'db_latency',
        name: 'Database Latency',
        domain: 'infra',
        variableType: 'continuous',
        description: '',
      },
    ];

    const links: CausalLink[] = [
      {
        id: 'link_pool_lat',
        sourceNodeId: 'db_conn_pool',
        targetNodeId: 'db_latency',
        relationType: 'direct_cause',
        strength: 0.9,
        confidence: 0.95,
        isInterventionVerified: true,
        confoundingFactors: [],
        mechanismDescription: 'Queued connection acquire waits inflate latency',
      },
    ];

    const graph = causalEngine.createOrUpdateGraph('infra', nodes, links);
    causalEngine.testIntervention(
      graph.id,
      'db_conn_pool',
      100, // max pool
      'db_latency',
      2, // 2ms
      800, // 800ms
    );

    // Close db connection
    dbService.close();

    // Reopen and check persistence
    const dbService2 = new DatabaseService(dbPath);
    const db2 = dbService2.connect();
    const repo2 = new SqliteCausalRepository(db2);

    const loadedGraph = repo2.getGraphById(graph.id);
    expect(loadedGraph).not.toBeNull();
    expect(loadedGraph!.domain).toBe('infra');
    expect(loadedGraph!.links[0]!.isInterventionVerified).toBe(true);

    const interventions = repo2.listInterventions(graph.id);
    expect(interventions.length).toBe(1);
    expect(interventions[0]!.inferredCausalLink).toBe(true);

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

    // Test POST /api/ape/causal/graph
    const graphRes = await fetch(`${baseUrl}/api/ape/causal/graph`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: 'rest_causal_test',
        nodes: [
          {
            id: 'code_bug',
            name: 'Syntax Bug',
            domain: 'rest_causal_test',
            variableType: 'binary',
            description: '',
          },
          {
            id: 'build_fail',
            name: 'Build Failure',
            domain: 'rest_causal_test',
            variableType: 'binary',
            description: '',
          },
        ],
        links: [
          {
            id: 'l_bug_fail',
            sourceNodeId: 'code_bug',
            targetNodeId: 'build_fail',
            relationType: 'direct_cause',
            strength: 0.99,
            confidence: 0.95,
            isInterventionVerified: true,
            confoundingFactors: [],
            mechanismDescription: 'Parser error halts compiler',
          },
        ],
      }),
    });
    expect(graphRes.status).toBe(201);
    const graphJson = (await graphRes.json()) as any;
    expect(graphJson.success).toBe(true);
    const graphId = graphJson.graph.id;

    // Test POST /api/ape/causal/infer
    const inferRes = await fetch(`${baseUrl}/api/ape/causal/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graphId,
        effectNodeId: 'build_fail',
      }),
    });
    expect(inferRes.status).toBe(200);
    const inferJson = (await inferRes.json()) as any;
    expect(inferJson.targetEffectId).toBe('build_fail');
    expect(inferJson.plausibleCauses.length).toBe(1);

    // Test POST /api/ape/causal/distinguish-correlation
    const distRes = await fetch(`${baseUrl}/api/ape/causal/distinguish-correlation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nodeAId: 'wet_lawn',
        nodeBId: 'wet_street',
        correlationCoefficient: 0.85,
        potentialConfounders: ['morning_rain'],
      }),
    });
    expect(distRes.status).toBe(200);
    const distJson = (await distRes.json()) as any;
    expect(distJson.relationType).toBe('common_cause_confounder');

    // Test GET /api/ape/causal/summary
    const summaryRes = await fetch(`${baseUrl}/api/ape/causal/summary`);
    expect(summaryRes.status).toBe(200);
    const summaryJson = (await summaryRes.json()) as any;
    expect(summaryJson.totalGraphs).toBeGreaterThanOrEqual(1);

    // Verify ApeService prompt context includes causal reasoning line
    const apeService = (server as any).apeService as ApeService;
    const promptContext = apeService.formatApePromptContext();
    expect(promptContext).toContain('Causal Reasoning:');
    expect(promptContext).toContain(
      'Correlation strictly distinguished from causation; alternative confounders evaluated',
    );
  });
});
