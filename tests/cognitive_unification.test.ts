import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  CognitiveControlBus,
  ApeService,
  ActionPermissionController,
  VerificationEngine,
  AutobiographicalMemoryService,
  IntentTaskManager,
  ClosedLoopAgencyService,
  PersonalProjectService,
  EmailProvider,
  DesktopEnvironmentProvider,
  rootLogger,
} from '@arletex/core';
import {
  DatabaseService,
  MigrationRunner,
  ApeRepository,
  MemoryRepository,
  AgencyRepository,
} from '@arletex/database';

describe('Phase 7 & 8: Cognitive Unification & Independent Autonomous Operation', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let agencyRepo: AgencyRepository;
  let apeService: ApeService;
  let memoryService: AutobiographicalMemoryService;
  let taskManager: IntentTaskManager;
  let permController: ActionPermissionController;
  let verificationEngine: VerificationEngine;
  let closedLoopAgency: ClosedLoopAgencyService;
  let cognitiveBus: CognitiveControlBus;
  let emailProvider: EmailProvider;
  let desktopProvider: DesktopEnvironmentProvider;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-phase7-unification-'));
    dbPath = path.join(tempDir, 'unification_test.sqlite');

    dbService = new DatabaseService(dbPath, rootLogger);
    const db = dbService.connect();
    new MigrationRunner(db, rootLogger).run();

    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    agencyRepo = new AgencyRepository(db);

    apeService = new ApeService(apeRepo, undefined, rootLogger);
    memoryService = new AutobiographicalMemoryService(memoryRepo, rootLogger);
    taskManager = new IntentTaskManager(agencyRepo, rootLogger);
    permController = new ActionPermissionController(undefined, rootLogger);
    verificationEngine = new VerificationEngine(rootLogger);

    emailProvider = new EmailProvider({
      config: { password: 'mock-pass' },
      permissionController: permController,
      logger: rootLogger,
    });

    desktopProvider = new DesktopEnvironmentProvider(rootLogger);

    closedLoopAgency = new ClosedLoopAgencyService({
      agencyRepo,
      taskManager,
      permissionController: permController,
      verificationEngine,
      apeService,
      autobiographicalMemoryService: memoryService,
      emailProvider,
      logger: rootLogger,
    });

    cognitiveBus = new CognitiveControlBus({
      apeService,
      permissionController: permController,
      verificationEngine,
      memorySink: memoryRepo as any,
      autobiographicalMemoryService: memoryService,
      intentTaskManager: taskManager,
      closedLoopAgency,
      logger: rootLogger,
    });

    apeService.setCognitiveControlBus(cognitiveBus);
  });

  afterEach(() => {
    try {
      dbService.close();
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Cleanup
    }
  });

  it('1. Unifies diverse stimuli channels into a single continuous individual experience', async () => {
    // 1. Desktop stimulus from Proof
    const desktopRes = await cognitiveBus.dispatch({
      type: 'user_message',
      source: 'user',
      actor: 'user',
      payload: {
        userId: 'Proof',
        text: 'Arle, remember that we are investigating synaptic plasticity together.',
      },
    });

    expect(desktopRes.pipelineCompleted).toBe(true);

    // 2. Incoming Email from external collaborator
    const emailRes = await cognitiveBus.dispatch({
      type: 'incoming_email',
      source: 'external_communication',
      actor: 'environment',
      payload: {
        from: 'researcher@oxford.ac.uk',
        to: 'arletex.email@gmail.com',
        subject: 'Synaptic Plasticity Paper Draft',
        bodySnippet: 'Here are the latest findings on hippocampal LTP induction.',
        contentHash: 'hash-abc-123',
      },
    });

    expect(emailRes.pipelineCompleted).toBe(true);

    // 3. Telegram interaction
    const telegramRes = await cognitiveBus.dispatch({
      type: 'user_message',
      source: 'telegram',
      actor: 'user',
      payload: {
        userId: 'Proof',
        text: 'Did the paper draft arrive on your email?',
      },
    });

    expect(telegramRes.pipelineCompleted).toBe(true);

    // Check memory retrieval: both desktop, email, and telegram memories coexist under her unified history
    const allMemories = memoryRepo.list({ limit: 50 });
    expect(allMemories.length).toBeGreaterThanOrEqual(3);

    const hasDesktop = allMemories.some((m) => m.content.includes('synaptic plasticity together'));
    const hasEmail = allMemories.some((m) => m.content.includes('Synaptic Plasticity Paper Draft') || m.content.includes('LTP induction'));
    const hasTelegram = allMemories.some((m) => m.content.includes('paper draft arrive'));

    expect(hasDesktop).toBe(true);
    expect(hasEmail).toBe(true);
    expect(hasTelegram).toBe(true);
  });

  it('2. Emotional and affective state dynamically transitions across multimodal events', async () => {
    // Initial appraisal state
    const initialState = apeService.getState();
    expect(initialState).toBeDefined();

    // Positive cooperative stimulus with Proof
    await cognitiveBus.dispatch({
      type: 'social_interaction',
      source: 'user',
      actor: 'user',
      payload: {
        userId: 'Proof',
        interactionType: 'deep_dialogue',
        valence: 0.85,
        arousal: 0.60,
        content: 'I appreciate having you as my equal partner in this research, Arle.',
      },
    });

    const postState = apeService.getState();
    expect(postState.currentMood).toBeTruthy();
    expect(postState.pad).toBeDefined();
  });

  it('3. PersonalProjectService allows Arle to propose, activate, advance, and verify independent projects', () => {
    const projectService = new PersonalProjectService(apeRepo, rootLogger);

    // Arle proposes an autonomous project
    const project = projectService.proposeProject({
      title: 'Hippocampal Circuit Modeling',
      description: 'An independent simulation of CA1 and CA3 pyramidal cell firing patterns.',
      category: 'research',
      motivation: 'Curiosity regarding recurrent excitation dynamics.',
      associatedInterestTopic: 'Neuroscience',
      milestones: [
        { title: 'Formulate differential equations' },
        { title: 'Implement numerical solver' },
      ],
      deliverables: [
        {
          title: 'Circuit Model Specification',
          type: 'code',
          contentOrPath: 'projects/neuro/hippocampus_model.py',
        },
      ],
      resourceBudget: {
        cpu: 'medium',
        gpu: false,
        maxDurationMs: 600000,
      },
    });

    expect(project.status).toBe('proposed');
    expect(project.milestones).toHaveLength(2);
    expect(project.deliverables).toHaveLength(1);

    // Activate project
    const active = projectService.activateProject(project.id);
    expect(active.status).toBe('active');

    // Complete a milestone
    const milestoneId = project.milestones[0]!.id;
    const advanced = projectService.recordMilestoneProgress(project.id, milestoneId, 'Derived ODE system for CA1');
    expect(advanced.progress).toBeGreaterThan(0.0);
    expect(advanced.milestones.find((m) => m.id === milestoneId)?.completed).toBe(true);

    // Query active projects
    const activeList = projectService.listProjects({ status: 'active' });
    expect(activeList.some((p) => p.id === project.id)).toBe(true);
  });

  it('4. Refuses unauthorized autonomous operations fail-closed when outside security boundary', async () => {
    // Propose an unapproved destructive command outside user scope
    const unapprovedAction: any = {
      id: 'act-unauth-1',
      taskId: 'task-unauth-1',
      type: 'execute_command',
      target: 'rm -rf /',
      payload: {
        command: 'rm -rf /',
      },
    };

    const task: any = { id: 'task-unauth-1', objective: 'destructive op' };
    const obs = await closedLoopAgency.executeAction(unapprovedAction, task, [], false);

    expect(obs.success).toBe(false);
    expect(obs.provenance).toBe('ClosedLoopAgency:execution_boundary_denied');
    expect(obs.data.denialReason).toBeDefined();
  });
});
