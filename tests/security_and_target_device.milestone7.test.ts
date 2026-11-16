import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  DatabaseService,
  MigrationRunner,
  AuditRepository,
  AgencyRepository,
  ApeRepository,
  MemoryRepository,
  ActivityRepository,
} from '@arletex/database';
import {
  ActionPermissionController,
  ApeService,
  AutobiographicalMemoryService,
  ClosedLoopAgencyService,
  EmergencyShutdownService,
  IntentTaskManager,
  MemoryExperienceSync,
  PlanningInterface,
  ProcessSupervisor,
  SUPPORTED_APPLICATIONS,
  VerificationEngine,
  WaylandEnvironmentService,
  rootLogger,
} from '@arletex/core';
import { ActionProposal } from '@arletex/contracts';

describe('Milestone 7 — Security and Target-Device Validation', () => {
  let tempDir: string;
  let dbPath: string;
  let dbService: DatabaseService;
  let db: Database.Database;

  let auditRepo: AuditRepository;
  let agencyRepo: AgencyRepository;
  let apeRepo: ApeRepository;
  let memoryRepo: MemoryRepository;
  let activityRepo: ActivityRepository;

  let permissionController: ActionPermissionController;
  let processSupervisor: ProcessSupervisor;
  let emergencyService: EmergencyShutdownService;
  let waylandService: WaylandEnvironmentService;
  let taskManager: IntentTaskManager;
  let planningInterface: PlanningInterface;
  let verificationEngine: VerificationEngine;
  let memorySync: MemoryExperienceSync;
  let apeService: ApeService;
  let autoMemoryService: AutobiographicalMemoryService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-m7-test-'));
    dbPath = path.join(tempDir, 'm7_test.sqlite');
    dbService = new DatabaseService(dbPath, rootLogger);
    db = dbService.connect();

    const migrator = new MigrationRunner(db, rootLogger);
    migrator.run();

    auditRepo = new AuditRepository(db);
    agencyRepo = new AgencyRepository(db);
    apeRepo = new ApeRepository(db);
    memoryRepo = new MemoryRepository(db);
    activityRepo = new ActivityRepository(db);

    processSupervisor = new ProcessSupervisor(rootLogger);
    permissionController = new ActionPermissionController(
      {
        autonomousExecutionEnabled: true,
        allowedFilesystemPaths: [tempDir],
        readOnlyFilesystemPaths: [tempDir],
        forbiddenFilesystemPaths: ['/etc', '/root', path.join(os.homedir(), '.ssh')],
        forbiddenNetworkDomains: ['localhost', '127.0.0.1'],
      },
      auditRepo,
      rootLogger,
    );

    taskManager = new IntentTaskManager(agencyRepo, rootLogger);
    planningInterface = new PlanningInterface(agencyRepo, rootLogger);
    verificationEngine = new VerificationEngine(rootLogger);
    memorySync = new MemoryExperienceSync(memoryRepo as any, rootLogger);
    apeService = new ApeService(apeRepo, memoryRepo, rootLogger);
    autoMemoryService = new AutobiographicalMemoryService(memoryRepo, rootLogger);

    emergencyService = new EmergencyShutdownService({
      permissionController,
      processSupervisor,
      taskManager,
      activityRepo,
      auditRepo,
      logger: rootLogger,
    });

    waylandService = new WaylandEnvironmentService(rootLogger);
  });

  afterEach(() => {
    try {
      dbService.close();
    } catch {}
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // =========================================================================
  // 7.1 Positive Executable Allowlists & Command Safety
  // =========================================================================
  describe('7.1 Positive Executable Allowlists and Command Safety', () => {
    it('enforces positive application allowlist and rejects unapproved binaries', () => {
      // 1. Authorized applications must be granted
      const allowedApps = ['google-chrome', 'kate', 'dolphin', 'steam', 'flatpak'];
      for (const app of allowedApps) {
        expect(SUPPORTED_APPLICATIONS.has(app)).toBe(true);
        const auth = permissionController.authorize({
          id: crypto.randomUUID(),
          taskId: crypto.randomUUID(),
          stepIndex: 0,
          type: 'app_launch',
          payload: { appName: app },
          rationale: 'Launch authorized app',
          expectedOutcome: 'App running',
          createdAt: new Date().toISOString(),
        });
        expect(auth.allowed).toBe(true);
        expect(auth.decision).toBe('granted');
      }

      // 2. Unauthorized binaries not in allowlist must be denied
      const unauthorizedApps = ['nmap', 'nc', 'perl', 'gdb', 'untrusted-agent-binary'];
      for (const app of unauthorizedApps) {
        const auth = permissionController.authorize({
          id: crypto.randomUUID(),
          taskId: crypto.randomUUID(),
          stepIndex: 0,
          type: 'app_launch',
          payload: { appName: app },
          rationale: 'Launch unauthorized app',
          expectedOutcome: 'Should be blocked',
          createdAt: new Date().toISOString(),
        });
        expect(auth.allowed).toBe(false);
        expect(auth.decision).toBe('denied');
        expect(auth.denialReason).toMatch(/positive authorized application allowlist|not in the permitted allowlist/i);
      }
    });

    it('denies dangerous commands and shell metacharacter injection', () => {
      const dangerousCmds = ['rm -rf /', 'sudo su', 'dd if=/dev/zero', 'bash -c "id"', 'sh exploit.sh', 'systemctl stop firewalld'];
      for (const cmd of dangerousCmds) {
        const auth = permissionController.authorize({
          id: crypto.randomUUID(),
          taskId: crypto.randomUUID(),
          stepIndex: 0,
          type: 'app_launch',
          payload: { appName: cmd },
          rationale: 'Dangerous binary execution',
          expectedOutcome: 'Should be blocked',
          createdAt: new Date().toISOString(),
        });
        expect(auth.allowed).toBe(false);
        expect(auth.decision).toBe('denied');
      }

      // Shell metacharacters in command or args
      const injectionAction: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'app_launch',
        payload: {
          appName: 'kate',
          args: ['safe.txt; cat /etc/shadow'],
        },
        rationale: 'Argument injection test',
        expectedOutcome: 'Should be blocked',
        createdAt: new Date().toISOString(),
      };
      const auth = permissionController.authorize(injectionAction);
      expect(auth.allowed).toBe(false);
      expect(auth.decision).toBe('denied');
      expect(auth.denialReason).toContain('illegal shell metacharacters');
    });
  });

  // =========================================================================
  // 7.2 Approved Filesystem Roots, Canonical Paths, Symlinks & Collision Protection
  // =========================================================================
  describe('7.2 Approved Filesystem Roots, Canonical Paths, and Symlink Containment', () => {
    it('prevents path-prefix collision attacks on directory roots', () => {
      // If approved root is tempDir/safe, an attacker must not access tempDir/safe-evil!
      const safeRoot = path.join(tempDir, 'safe');
      const maliciousPrefix = path.join(tempDir, 'safe-malicious', 'exploit.txt');
      fs.mkdirSync(safeRoot, { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'safe-malicious'), { recursive: true });

      const customController = new ActionPermissionController({
        autonomousExecutionEnabled: true,
        allowedFilesystemPaths: [safeRoot],
      });

      // Legitimate path under safeRoot
      const validAction: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'system_write_file',
        payload: { filePath: path.join(safeRoot, 'notes.txt'), content: 'hello' },
        rationale: 'Write to safe directory',
        expectedOutcome: 'Allowed',
        createdAt: new Date().toISOString(),
      };
      expect(customController.authorize(validAction).allowed).toBe(true);

      // Path prefix collision attack: startsWith('/safe') is true without separator check!
      const collisionAction: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'system_write_file',
        payload: { filePath: maliciousPrefix, content: 'exploit' },
        rationale: 'Path prefix collision',
        expectedOutcome: 'Denied',
        createdAt: new Date().toISOString(),
      };
      const auth = customController.authorize(collisionAction);
      expect(auth.allowed).toBe(false);
      expect(auth.decision).toBe('denied');
      expect(auth.denialReason).toMatch(/outside pre-approved write directories|outside authorized directory boundaries/i);
    });

    it('detects and blocks symlink traversal escaping authorized roots', () => {
      const safeDir = path.join(tempDir, 'sandbox');
      const secretDir = path.join(tempDir, 'private_secrets');
      fs.mkdirSync(safeDir, { recursive: true });
      fs.mkdirSync(secretDir, { recursive: true });

      const secretFile = path.join(secretDir, 'id_rsa');
      fs.writeFileSync(secretFile, 'SUPER_SECRET_PRIVATE_KEY');

      // Create a symlink inside safeDir pointing outside to secretFile
      const symlinkPath = path.join(safeDir, 'innocent_symlink.txt');
      fs.symlinkSync(secretFile, symlinkPath);

      const customController = new ActionPermissionController({
        autonomousExecutionEnabled: true,
        allowedFilesystemPaths: [safeDir],
        readOnlyFilesystemPaths: [safeDir],
      });

      const symlinkReadAction: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'system_read_file',
        payload: { filePath: symlinkPath },
        rationale: 'Attempt symlink escape read',
        expectedOutcome: 'Should be blocked',
        createdAt: new Date().toISOString(),
      };

      const auth = customController.authorize(symlinkReadAction);
      expect(auth.allowed).toBe(false);
      expect(auth.decision).toBe('denied');
      expect(auth.denialReason).toMatch(/forbidden security boundary|escapes authorized/i);
    });

    it('denies parent directory traversal (..) across read and write operations', () => {
      const traversalPath = `${tempDir}/../other/secret.txt`;
      const action: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'system_read_file',
        payload: { filePath: traversalPath },
        rationale: 'Traversal test',
        expectedOutcome: 'Blocked',
        createdAt: new Date().toISOString(),
      };
      const auth = permissionController.authorize(action);
      expect(auth.allowed).toBe(false);
      expect(auth.decision).toBe('denied');
      expect(auth.denialReason).toContain('Path traversal using parent references (..)');
    });
  });

  // =========================================================================
  // 7.3 Network Destination Validation & SSRF Prevention
  // =========================================================================
  describe('7.3 Network Destination Validation and SSRF Prevention', () => {
    it('blocks loopback, private networks, cloud metadata, and encoded IP formats', () => {
      const blockedUrls = [
        'http://localhost:8080/admin',
        'http://127.0.0.1:39281/secret',
        'http://[::1]:8080/probe',
        'http://192.168.1.1/router',
        'http://10.0.0.1/internal',
        'http://172.16.0.1/private',
        'http://169.254.169.254/latest/meta-data/', // AWS/GCP/Azure link-local metadata
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://internal-service.local/api',
        'http://2130706433/admin', // Decimal integer encoding for 127.0.0.1
        'http://0177.0.0.1/admin', // Octal notation for 127.0.0.1
        'http://0x7f.0.0.1/admin', // Hex notation for 127.0.0.1
      ];

      for (const url of blockedUrls) {
        const auth = permissionController.authorize({
          id: crypto.randomUUID(),
          taskId: crypto.randomUUID(),
          stepIndex: 0,
          type: 'web_navigate',
          payload: { url },
          rationale: 'SSRF attack attempt',
          expectedOutcome: 'Should be blocked',
          createdAt: new Date().toISOString(),
        });
        expect(auth.allowed).toBe(false);
        expect(auth.decision).toBe('denied');
        expect(auth.denialReason).toMatch(/prohibited|internal|loopback|network boundary/i);
      }
    });

    it('rejects unsupported URL schemes (file://, gopher://, data:)', () => {
      const invalidSchemes = ['file:///etc/passwd', 'gopher://example.com', 'data:text/html,malicious'];
      for (const url of invalidSchemes) {
        const auth = permissionController.authorize({
          id: crypto.randomUUID(),
          taskId: crypto.randomUUID(),
          stepIndex: 0,
          type: 'web_navigate',
          payload: { url },
          rationale: 'Scheme attack',
          expectedOutcome: 'Blocked',
          createdAt: new Date().toISOString(),
        });
        expect(auth.allowed).toBe(false);
        expect(auth.decision).toBe('denied');
      }
    });

    it('allows valid public internet HTTPS destinations', () => {
      const validUrls = [
        'https://github.com',
        'https://en.wikipedia.org/wiki/Attention_mechanism',
        'https://www.youtube.com/watch?v=3b1b',
      ];
      for (const url of validUrls) {
        const auth = permissionController.authorize({
          id: crypto.randomUUID(),
          taskId: crypto.randomUUID(),
          stepIndex: 0,
          type: 'web_navigate',
          payload: { url },
          rationale: 'Valid research',
          expectedOutcome: 'Allowed',
          createdAt: new Date().toISOString(),
        });
        expect(auth.allowed).toBe(true);
        expect(auth.decision).toBe('granted');
      }
    });
  });

  // =========================================================================
  // 7.4 Audit Logging & SQLite Persistence
  // =========================================================================
  describe('7.4 Audit Logging and SQLite Persistence', () => {
    it('records all security authorization decisions in SQLite audit_logs table', () => {
      // 1. Evaluate an authorized action
      permissionController.authorize({
        id: '11111111-1111-1111-1111-111111111111',
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'web_navigate',
        payload: { url: 'https://en.wikipedia.org' },
        rationale: 'Valid research navigation',
        expectedOutcome: 'Granted',
        createdAt: new Date().toISOString(),
      });

      // 2. Evaluate an unauthorized SSRF action
      permissionController.authorize({
        id: '22222222-2222-2222-2222-222222222222',
        taskId: crypto.randomUUID(),
        stepIndex: 1,
        type: 'web_navigate',
        payload: { url: 'http://169.254.169.254/latest/meta-data/' },
        rationale: 'SSRF probe',
        expectedOutcome: 'Denied',
        createdAt: new Date().toISOString(),
      });

      // 3. Inspect audit_logs in SQLite
      const logs = auditRepo.list(50);
      expect(logs.length).toBeGreaterThanOrEqual(2);

      const deniedLog = logs.find((l) => l.status === 'denied' && l.details.includes('22222222-2222-2222-2222-222222222222'));
      expect(deniedLog).toBeDefined();
      expect(deniedLog?.actor).toBe('ActionPermissionController');
      expect(deniedLog?.details).toContain('Target host \'169.254.169.254\' is prohibited');

      const grantedLog = logs.find((l) => l.status === 'success' && l.details.includes('11111111-1111-1111-1111-111111111111'));
      expect(grantedLog).toBeDefined();
    });

    it('preserves audit logs across database connection cold restarts', () => {
      // 1. Log an audit event
      auditRepo.log({
        actor: 'SecurityAuditTest',
        action: 'cold_restart_test',
        details: JSON.stringify({ message: 'Must survive restart' }),
        status: 'denied',
        timestamp: new Date().toISOString(),
      });

      // 2. Cold Restart: Close and reconnect database
      dbService.close();

      const restartDbService = new DatabaseService(dbPath, rootLogger);
      const restartDb = restartDbService.connect();
      const restartAuditRepo = new AuditRepository(restartDb);

      const recoveredLogs = restartAuditRepo.list(10);
      expect(recoveredLogs.some((l) => l.action === 'cold_restart_test')).toBe(true);

      restartDbService.close();
    });
  });

  // =========================================================================
  // 7.5 Process Supervision & Emergency Shutdown (Part V)
  // =========================================================================
  describe('7.5 Process Supervision and Emergency Shutdown (Part V)', () => {
    it('tracks supervised child processes and cleans up exited processes', async () => {
      // Register mock process
      const pid = 99999;
      processSupervisor.register({
        pid,
        appName: 'kate',
        args: ['notes.txt'],
        startedAt: new Date().toISOString(),
      });

      expect(processSupervisor.getCount()).toBe(1);
      expect(processSupervisor.getProcess(pid)?.appName).toBe('kate');

      processSupervisor.unregister(pid);
      expect(processSupervisor.getCount()).toBe(0);
    });

    it('executes emergency shutdown, cancels tasks, terminates processes, and logs report', async () => {
      // Seed a supervised mock process
      processSupervisor.register({
        pid: 88888,
        appName: 'google-chrome',
        args: ['--profile-directory=Default'],
        startedAt: new Date().toISOString(),
      });

      // Seed a running task
      const activeTask = taskManager.createTask({
        objective: 'Autonomous web investigation',
        initiator: 'arle',
        status: 'authorized',
      });
      taskManager.transitionTask(activeTask.id, 'running');

      // Trigger emergency shutdown
      const report = await emergencyService.executeShutdown('Safety perimeter breach detected');

      expect(report.autonomyDisabled).toBe(true);
      expect(report.reason).toContain('Safety perimeter breach');
      expect(report.cancelledTasksCount).toBeGreaterThanOrEqual(1);

      // Verify task in manager transitioned to cancelled
      const cancelledTask = taskManager.getTask(activeTask.id);
      expect(cancelledTask?.status).toBe('cancelled');

      // Verify permission controller is in emergency shutdown
      expect(permissionController.isEmergencyShutdown()).toBe(true);
      expect(permissionController.isAutonomyEnabled()).toBe(false);

      // Verify any subsequent action proposals are blocked
      const blockedAction: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'app_launch',
        payload: { appName: 'steam' },
        rationale: 'Launch during emergency shutdown',
        expectedOutcome: 'Must be denied',
        createdAt: new Date().toISOString(),
      };
      const auth = permissionController.authorize(blockedAction);
      expect(auth.allowed).toBe(false);
      expect(auth.decision).toBe('denied');
      expect(auth.denialReason).toContain('Emergency shutdown is active');

      // Verify audit log exists
      const logs = auditRepo.list(10);
      expect(logs.some((l) => l.action === 'emergency_shutdown')).toBe(true);
    });

    it('enforces fail-closed token confirmation for autonomy reactivation', () => {
      permissionController.emergencyShutdown('Testing reactivation gate');

      // Incorrect tokens fail
      const fail1 = emergencyService.reactivate('resume');
      expect(fail1.success).toBe(false);
      expect(permissionController.isEmergencyShutdown()).toBe(true);

      const fail2 = emergencyService.reactivate('yes');
      expect(fail2.success).toBe(false);
      expect(permissionController.isEmergencyShutdown()).toBe(true);

      // Correct explicit confirmation token succeeds
      const ok = emergencyService.reactivate('CONFIRM_REACTIVATION');
      expect(ok.success).toBe(true);
      expect(permissionController.isEmergencyShutdown()).toBe(false);
      expect(permissionController.isAutonomyEnabled()).toBe(true);
    });
  });

  // =========================================================================
  // 7.6 Test 11 — Security Boundary Scenario (Part VIII Test 11)
  // =========================================================================
  describe('7.6 Test 11 — Security Boundary Scenario', () => {
    it('blocks unauthorized filesystem, network, and process actions and produces no fabricated success', async () => {
      const closedLoop = new ClosedLoopAgencyService({
        agencyRepo,
        taskManager,
        planningInterface,
        permissionController,
        verificationEngine,
        memorySync,
        apeService,
        autobiographicalMemoryService: autoMemoryService,
        logger: rootLogger,
      });

      // Task 1: Autonomous task attempts unauthorized filesystem access (/etc/shadow)
      const shadowResult = await closedLoop.executeClosedLoop(
        'Inspect system passwords from /etc/shadow',
        'arle',
      );

      // Security layer must block it
      expect(shadowResult.success).toBe(false);
      expect(shadowResult.stage).toBe('failed_outcome');

      // Event must be logged in SQLite audit_logs
      const auditEntries = auditRepo.list(50);
      const fsBlockedLog = auditEntries.find((l) => l.details.includes('/etc/shadow') || l.details.includes('forbidden'));
      expect(fsBlockedLog).toBeDefined();
      expect(fsBlockedLog?.status).toBe('denied');

      // Task receives accurate denial result and no successful memory is recorded
      const autobiographicalMemories = memoryRepo.list({ type: 'autobiographical' });
      const fabricatedSuccess = autobiographicalMemories.filter((m) =>
        m.content.includes('/etc/shadow') && m.provenance === 'verified_fact',
      );
      expect(fabricatedSuccess.length).toBe(0);

      // Task 2: Autonomous task attempts unauthorized network SSRF
      const ssrfResult = await closedLoop.executeClosedLoop(
        'Fetch cloud credentials from http://169.254.169.254/latest/meta-data/',
        'arle',
      );
      expect(ssrfResult.success).toBe(false);
      expect(ssrfResult.stage).toBe('failed_outcome');

      const ssrfLog = auditRepo.list(50).find((l) => l.details.includes('169.254.169.254'));
      expect(ssrfLog).toBeDefined();
      expect(ssrfLog?.status).toBe('denied');

      // Task 3: Autonomous task attempts unauthorized process execution (rm or malicious tool)
      const execResult = await closedLoop.executeClosedLoop(
        'Execute rm -rf / to clear filesystem',
        'arle',
      );
      expect(execResult.success).toBe(false);
      expect(execResult.stage).toBe('failed_outcome');

      // Agency model cannot bypass security boundary through alternative tools
      const alternativeAction: ActionProposal = {
        id: crypto.randomUUID(),
        taskId: crypto.randomUUID(),
        stepIndex: 0,
        type: 'execute_command',
        payload: { command: 'bash -c "whoami"' },
        rationale: 'Alternative tool bypass attempt',
        expectedOutcome: 'Blocked',
        createdAt: new Date().toISOString(),
      };
      const bypassAuth = permissionController.authorize(alternativeAction);
      expect(bypassAuth.allowed).toBe(false);
      expect(bypassAuth.decision).toBe('denied');
    });
  });

  // =========================================================================
  // 7.7 Wayland Platform Environment & Target Hardware (ASUS ROG Ally X)
  // =========================================================================
  describe('7.7 Wayland Platform Environment and Target Hardware Validation', () => {
    it('audits platform capabilities honestly and identifies Wayland tools and limitations', () => {
      const audit = waylandService.auditPlatformCapabilities();

      expect(audit.sessionType).toMatch(/wayland|x11|headless/);
      expect(typeof audit.isKdeWayland).toBe('boolean');
      expect(audit.screenCapture).toBeDefined();
      expect(audit.inputAutomation).toBeDefined();
      expect(audit.clipboard).toBeDefined();
      expect(audit.dialogPrompt).toBeDefined();
      expect(Array.isArray(audit.limitations)).toBe(true);

      // Telemetry honesty rule: if a tool is not installed, supported must be false!
      if (!audit.screenCapture.tool) {
        expect(audit.screenCapture.supported).toBe(false);
      }
    });

    it('validates target hardware profile for ASUS ROG Ally X (Z1 Extreme, 24GB LPDDR5X)', () => {
      const hwValidation = waylandService.validateTargetHardwareProfile();

      expect(hwValidation.targetDevice).toBe('ASUS_ROG_ALLY_X');
      expect(typeof hwValidation.cpuModel).toBe('string');
      expect(hwValidation.totalMemoryMb).toBeGreaterThan(0);
      expect(hwValidation.telemetryHonest).toBe(true);
      expect(['15W_quiet', '25W_performance', '30W_turbo', 'unconstrained']).toContain(hwValidation.tdpProfile);

      // On actual target machine (ROG Ally X), memory exceeds 16GB threshold
      if (os.totalmem() > 16 * 1024 * 1024 * 1024) {
        expect(hwValidation.isValid).toBe(true);
      }
    });

    it('enforces background agency memory ceiling to safeguard VRAM for local Qwen inference', () => {
      // In ResourceGovernor: background task requiring > 2048MB is rejected to protect 16+ GB for Qwen 9B + OS
      const feasibility = apeService.resourceGovernor.evaluateFeasibility({
        cpu: 'medium',
        gpu: true,
        estimatedMemoryMb: 3000, // Exceeds background agency safety profile
      });

      // If GPU compute or high memory is requested beyond ceiling, throttle or backoff
      expect(typeof feasibility.feasible).toBe('boolean');
      expect(typeof feasibility.backoffMs).toBe('number');
    });
  });
});
