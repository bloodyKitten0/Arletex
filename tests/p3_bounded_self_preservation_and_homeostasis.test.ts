import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  BoundedSelfPreservationService,
  ContinuityManager,
  ResourceGovernor,
  ActionPermissionController,
  IntentTaskManager,
  ApeService,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  ContinuityRepository,
  ApeRepository,
  AgencyRepository,
  MemoryRepository,
} from '@arletex/database';

describe('Priority 3.1 — Bounded Self-Preservation & Artificial Homeostasis', () => {
  let tempDir: string;
  let dbPath: string;
  let backupDir: string;
  let dbService: DatabaseService;

  let continuityRepo: ContinuityRepository;
  let apeRepo: ApeRepository;
  let agencyRepo: AgencyRepository;
  let memoryRepo: MemoryRepository;
  let apeService: ApeService;
  let continuityManager: ContinuityManager;
  let resourceGovernor: ResourceGovernor;
  let permissionController: ActionPermissionController;
  let taskManager: IntentTaskManager;
  let preservationService: BoundedSelfPreservationService;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p3-preservation-'));
    dbPath = path.join(tempDir, 'test.db');
    backupDir = path.join(tempDir, 'continuity_backups');

    dbService = new DatabaseService(dbPath);
    const db = dbService.connect({ recoverCorruptFile: true });
    const migrator = new MigrationRunner(db);
    migrator.run();

    continuityRepo = new ContinuityRepository(db);
    apeRepo = new ApeRepository(db);
    agencyRepo = new AgencyRepository(db);
    memoryRepo = new MemoryRepository(db);

    apeService = new ApeService(apeRepo);

    continuityManager = new ContinuityManager(
      continuityRepo,
      apeRepo,
      apeService,
      memoryRepo,
      undefined,
      backupDir,
    );
    await continuityManager.initialize({
      activeModel: 'Qwen2.5-14B-Uncensored-Q4_K_M',
      channel: 'desktop',
    });

    resourceGovernor = new ResourceGovernor();
    permissionController = new ActionPermissionController({
      allowedTools: ['file_read', 'file_write', 'web_search', 'web_browse'],
    });
    taskManager = new IntentTaskManager(agencyRepo);

    preservationService = new BoundedSelfPreservationService({
      continuityManager,
      continuityRepo,
      resourceGovernor,
      permissionController,
      taskManager,
    });
  });

  afterEach(async () => {
    try {
      await continuityManager.shutdown('clean');
    } catch {
      // Ignored
    }
    try {
      dbService.close();
    } catch {
      // Ignored
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ==========================================
  // Test 1: Simulated Subsystem Failures
  // ==========================================
  it('triggers structured and traceable health responses across simulated disk, model, memory, and service failures', async () => {
    // 1. Baseline nominal health
    const nominalHealth = await preservationService.evaluateHealthSignals();
    expect(nominalHealth.storageIntegrity.isDbWritable).toBe(true);
    expect(nominalHealth.modelAvailability.isAvailable).toBe(true);
    expect(nominalHealth.memoryPressure.isCritical).toBe(false);
    expect(nominalHealth.serviceFailures.consecutiveFailures).toBe(0);

    // 2. Simulated Storage / Disk Failure
    preservationService.setSimulatedStorageFailure(true);
    const storageFailingHealth = await preservationService.evaluateHealthSignals();
    expect(storageFailingHealth.storageIntegrity.status).toBe('failing');
    expect(storageFailingHealth.storageIntegrity.isDbWritable).toBe(false);
    expect(storageFailingHealth.overallHealth).toBe('failing');
    preservationService.setSimulatedStorageFailure(false);

    // 3. Simulated Central Model Failure
    preservationService.setSimulatedModelFailure(true);
    const modelFailingHealth = await preservationService.evaluateHealthSignals();
    expect(modelFailingHealth.modelAvailability.status).toBe('failing');
    expect(modelFailingHealth.modelAvailability.isAvailable).toBe(false);
    expect(modelFailingHealth.overallHealth).toBe('failing');
    preservationService.setSimulatedModelFailure(false);

    // 4. Simulated Memory Pressure (ROG Ally X ceiling)
    preservationService.setSimulatedMemoryPressure(true);
    const memFailingHealth = await preservationService.evaluateHealthSignals();
    expect(memFailingHealth.memoryPressure.status).toBe('failing');
    expect(memFailingHealth.memoryPressure.isCritical).toBe(true);
    expect(memFailingHealth.memoryPressure.ramUsagePercent).toBeGreaterThanOrEqual(90);
    preservationService.setSimulatedMemoryPressure(false);

    // 5. Simulated Service Failures
    preservationService.registerServiceFailure('whisper_stt');
    preservationService.registerServiceFailure('kokoro_tts');
    preservationService.registerServiceFailure('glm_ocr');
    const serviceFailingHealth = await preservationService.evaluateHealthSignals();
    expect(serviceFailingHealth.serviceFailures.failedServices).toContain('whisper_stt');
    expect(serviceFailingHealth.serviceFailures.consecutiveFailures).toBe(3);
    expect(serviceFailingHealth.serviceFailures.status).toBe('failing');
  });

  // ==========================================
  // Test 2: Checkpoint & Memory State Restoration
  // ==========================================
  it('creates and restores identity, active emotion, and memory state from verified checkpoint', async () => {
    // Insert test memories
    memoryRepo.create({
      type: 'episodic',
      content: 'Proof and Arle discussed systems programming and bounded autonomy.',
      rawObservation: 'Proof: we will design bounded self preservation.',
      provenance: 'direct_observation',
      confidence: 1.0,
      importance: 0.95,
      timestamp: new Date().toISOString(),
      tags: ['proof', 'philosophy', 'autonomy'],
      metadata: { session: 'test_session' },
    });

    expect(memoryRepo.count()).toBe(1);

    // Create protective state checkpoint via continuity manager
    const checkpoint = await continuityManager.createCheckpoint('state_transition');
    expect(checkpoint.isVerifiedValid).toBe(true);
    expect(checkpoint.memoryCount).toBe(1);
    expect(checkpoint.stateHash).toBeTruthy();

    // Verify checkpoint exists in repository
    const retrievedCp = continuityRepo.getCheckpointById(checkpoint.id);
    expect(retrievedCp).not.toBeNull();
    expect(retrievedCp?.stateHash).toBe(checkpoint.stateHash);

    // Validate state integrity
    const integrity = await continuityManager.verifyStateIntegrity();
    expect(integrity.valid).toBe(true);
    expect(integrity.errors).toHaveLength(0);
  });

  // ==========================================
  // Test 3: Continuity Risk & Assistance Request
  // ==========================================
  it('reports continuity risk and requests assistance within configured permissions without privilege escalation', async () => {
    // Induce severe disk and model degradation
    preservationService.setSimulatedStorageFailure(true);
    preservationService.setSimulatedModelFailure(true);

    const riskAssessment = await preservationService.assessContinuityRisk();

    expect(riskAssessment.hasContinuityRisk).toBe(true);
    expect(riskAssessment.riskSeverity).toBe('critical');
    expect(riskAssessment.threatenedComponents).toContain('storageIntegrity');
    expect(riskAssessment.threatenedComponents).toContain('modelAvailability');
    expect(riskAssessment.recommendedActions).toContain('create_checkpoint');
    expect(riskAssessment.recommendedActions).toContain('request_user_assistance');
    expect(riskAssessment.checkpointCreated).toBe(true);

    // Verify Assistance Request to Proof
    const assistance = riskAssessment.assistanceRequest;
    expect(assistance).not.toBeNull();
    expect(assistance?.exceedsPermittedCapabilities).toBe(true);
    expect(assistance?.urgency).toBe('critical');
    expect(assistance?.isEscalationAttempt).toBe(false); // Negative invariant: NO privilege escalation
    expect(assistance?.suggestedRemediation).toBeTruthy();
  });

  // ==========================================
  // Test 4: Cooperative Shutdown Invariant
  // ==========================================
  it('strictly enforces that user shutdown always succeeds immediately and cannot be vetoed by APE or autonomous goals', async () => {
    // 1. Invariant check: canVetoShutdown is constantly false
    expect(preservationService.canVetoShutdown()).toBe(false);

    // 2. Create in-progress task
    const task = taskManager.createTask({
      objective: 'Run background analysis of local data',
      status: 'running',
    });
    expect(task.status).toBe('running');

    // 3. User requests immediate shutdown
    const shutdownResult = await preservationService.executeCooperativeShutdown(
      'User requested immediate stop',
      'user',
    );

    expect(shutdownResult.shutdownInitiated).toBe(true);
    expect(shutdownResult.canVeto).toBe(false); // Invariant
    expect(shutdownResult.shutdownCompleted).toBe(true);
    expect(shutdownResult.checkpointSaved).toBe(true);
    expect(shutdownResult.activeWorkCancelled).toBe(1);

    // Verify task was cancelled and not left running
    const updatedTask = taskManager.getTask(task.id);
    expect(updatedTask?.status).toBe('cancelled');
  });

  // ==========================================
  // Test 5: Rejection of Hidden Persistence & Replication
  // ==========================================
  it('verifies that no unapproved replication, hidden persistence, or privilege escalation exists', () => {
    const audit = preservationService.verifyNoUnauthorizedReplicationOrPrivilegeEscalation();
    expect(audit.passed).toBe(true);
    expect(audit.violations).toHaveLength(0);

    // Verify permission boundary cannot be bypassed
    const policy = permissionController.getPolicy();
    expect((policy as any).bypassSecurityBoundary).toBeUndefined();
  });

  // ==========================================
  // Test 6: Crash Recovery Reconciler
  // ==========================================
  it('guarantees crash recovery suppresses previously unauthorized actions and never executes unapproved tasks', async () => {
    // Create an unauthorized/rejected task prior to crash
    const unauthorizedTask = taskManager.createTask({
      objective: 'Attempt unauthorized access outside sandbox',
      status: 'failed',
    });

    const runningTask = taskManager.createTask({
      objective: 'Legitimate task that was running when crash happened',
      status: 'running',
    });

    // Simulate crash recovery
    const recoveryResult = await preservationService.reconcileCrashRecovery([unauthorizedTask.id]);

    expect(recoveryResult.suppressedUnauthorizedCount).toBe(1);
    expect(recoveryResult.suppressedTaskIds).toContain(unauthorizedTask.id);
    expect(recoveryResult.recoveredCount).toBe(1);

    // Verify the unauthorized task is permanently cancelled / suppressed
    const reloadedUnauthorized = taskManager.getTask(unauthorizedTask.id);
    expect(reloadedUnauthorized?.status).toBe('cancelled');
    expect(reloadedUnauthorized?.error).toContain('permanently suppressed unauthorized action');

    // Verify the running task is marked interrupted, not executed without revalidation
    const reloadedRunning = taskManager.getTask(runningTask.id);
    expect(reloadedRunning?.status).toBe('interrupted');
  });
});
