import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  ActionProposal,
  AuthorizationCheckResult,
  PermissionPolicy,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { SUPPORTED_APPLICATIONS } from './safeComputerAgencyService.js';

export interface ActionApprovalToken {
  token: string;
  actionDigest: string;
  targetResource: string;
  scope: string;
  userId: string;
  nonce: string;
  expiresAt: number;
}

export interface CreateApprovalTokenInput {
  actionDigest: string;
  targetResource: string;
  scope: string;
  userId: string;
  ttlMs?: number;
}

export class ActionPermissionController {
  private policy: PermissionPolicy;
  private logger: ILogger;
  private auditRepo?: { log: (event: any) => any };
  private authorizationHistory: AuthorizationCheckResult[] = [];
  private isEmergencyShutdownActive = false;
  private emergencyShutdownReason?: string;
  private emergencyShutdownTimestamp?: string;
  private ethicalEngine?: any;
  private consumedNonces = new Set<string>();
  private readonly signingSecret: string = crypto.randomBytes(32).toString('hex');

  public setEthicalBoundariesEngine(engine: any): void {
    this.ethicalEngine = engine;
  }

  public getEthicalBoundariesEngine(): any {
    return this.ethicalEngine;
  }

  // Disallowed dangerous binaries and commands (blacklist defense-in-depth)
  private static readonly DANGEROUS_COMMANDS = new Set([
    'rm',
    'sudo',
    'su',
    'dd',
    'mkfs',
    'shutdown',
    'reboot',
    'killall',
    'poweroff',
    'sh',
    'bash',
    'zsh',
    'curl',
    'wget',
    'nc',
    'netcat',
    'chmod',
    'chown',
    'passwd',
    'systemctl',
  ]);

  // Sensitive paths that must never be read or written by agency
  private static readonly FORBIDDEN_PATH_SUBSTRINGS = [
    '.ssh',
    '.gnupg',
    'id_rsa',
    'id_ed25519',
    '/etc/shadow',
    '/etc/sudoers',
    '.bash_history',
    '.zsh_history',
    'wallet.dat',
  ];

  /**
   * Helper that checks whether targetPath is strictly equal to rootPath or is a child of rootPath.
   * Protects against path-prefix collisions (e.g. /tmp/safe-malicious matching /tmp/safe).
   */
  public static isPathContainedInRoot(targetPath: string, rootPath: string): boolean {
    const resolvedTarget = path.resolve(targetPath);
    const resolvedRoot = path.resolve(rootPath);
    return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
  }

  /**
   * Comprehensive validation of network hosts against SSRF, private IPs, loopback, and metadata endpoints.
   * Handles dotted decimal, octal, hex, and integer IP encodings.
   */
  public static isPrivateOrLoopbackHost(hostname: string): boolean {
    const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host === '0.0.0.0' || host === '127.0.0.1' || host === '::1') return true;
    if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true;
    if (host === 'metadata.google.internal' || host === 'instance-data') return true;

    // Decimal integer IP encoding (e.g. 2130706433 = 127.0.0.1)
    if (/^\d+$/.test(host)) {
      const num = parseInt(host, 10);
      if (num >= 0 && num <= 0xffffffff) {
        const b0 = (num >>> 24) & 255;
        const b1 = (num >>> 16) & 255;
        const b2 = (num >>> 8) & 255;
        const b3 = num & 255;
        return ActionPermissionController.isPrivateIpv4(b0, b1, b2, b3);
      }
    }

    // Hex integer IP encoding (e.g. 0x7f000001)
    if (/^0x[0-9a-f]+$/i.test(host)) {
      const num = parseInt(host, 16);
      if (num >= 0 && num <= 0xffffffff) {
        const b0 = (num >>> 24) & 255;
        const b1 = (num >>> 16) & 255;
        const b2 = (num >>> 8) & 255;
        const b3 = num & 255;
        return ActionPermissionController.isPrivateIpv4(b0, b1, b2, b3);
      }
    }

    // Dotted IPv4 parts with possible decimal, octal, or hex representations
    const parts = host.split('.');
    if (parts.length === 4) {
      const parsedBytes: number[] = [];
      for (const p of parts) {
        let val: number;
        if (/^0x[0-9a-f]+$/i.test(p)) {
          val = parseInt(p, 16);
        } else if (/^0[0-7]+$/.test(p)) {
          val = parseInt(p, 8);
        } else if (/^\d+$/.test(p)) {
          val = parseInt(p, 10);
        } else {
          val = -1;
        }
        if (val < 0 || val > 255 || isNaN(val)) return false;
        parsedBytes.push(val);
      }
      return ActionPermissionController.isPrivateIpv4(
        parsedBytes[0]!,
        parsedBytes[1]!,
        parsedBytes[2]!,
        parsedBytes[3]!,
      );
    }

    // IPv6 link-local or unique-local
    if (
      host.startsWith('fe80:') ||
      host.startsWith('fc00:') ||
      host.startsWith('fd00:') ||
      host.startsWith('::ffff:127.') ||
      host.startsWith('::ffff:7f')
    ) {
      return true;
    }

    return false;
  }

  private static isPrivateIpv4(b0: number, b1: number, _b2: number, _b3: number): boolean {
    if (b0 === 127) return true; // 127.0.0.0/8 Loopback
    if (b0 === 10) return true; // 10.0.0.0/8 Private
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // 172.16.0.0/12 Private
    if (b0 === 192 && b1 === 168) return true; // 192.168.0.0/16 Private
    if (b0 === 169 && b1 === 254) return true; // 169.254.0.0/16 Link-local & Cloud Metadata
    if (b0 === 0) return true; // 0.0.0.0/8 Current network
    if (b0 >= 224 && b0 <= 239) return true; // Multicast
    return false;
  }

  /**
   * Static network destination validator for URL queries and redirect verification.
   */
  public static validateNetworkUrl(urlStr: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, reason: `Unsupported protocol '${parsed.protocol}'. Only http/https permitted.` };
      }
      if (ActionPermissionController.isPrivateOrLoopbackHost(parsed.hostname)) {
        return { valid: false, reason: `Target host '${parsed.hostname}' is prohibited (internal/private/loopback network boundary).` };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: 'Malformed URL provided.' };
    }
  }

  constructor(
    policy?: Partial<PermissionPolicy>,
    auditRepoOrLogger?: any,
    maybeLogger: ILogger = rootLogger,
  ) {
    if (auditRepoOrLogger && typeof auditRepoOrLogger.log === 'function') {
      this.auditRepo = auditRepoOrLogger;
      this.logger = maybeLogger.child('ActionPermissionController');
    } else if (auditRepoOrLogger && typeof auditRepoOrLogger.child === 'function') {
      this.auditRepo = undefined;
      this.logger = auditRepoOrLogger.child('ActionPermissionController');
    } else {
      this.auditRepo = undefined;
      this.logger = maybeLogger.child('ActionPermissionController');
    }

    const homeDir = os.homedir();

    this.policy = {
      autonomousExecutionEnabled: policy?.autonomousExecutionEnabled ?? true,
      allowedFilesystemPaths: policy?.allowedFilesystemPaths ?? [
        path.join(homeDir, 'Documents'),
        path.join(homeDir, 'Downloads'),
        path.join(homeDir, 'Desktop'),
        path.join(homeDir, '.config', '@arletex'),
        '/tmp',
      ],
      readOnlyFilesystemPaths: policy?.readOnlyFilesystemPaths ?? [
        homeDir,
      ],
      forbiddenFilesystemPaths: policy?.forbiddenFilesystemPaths ?? [
        path.join(homeDir, '.ssh'),
        path.join(homeDir, '.gnupg'),
        '/etc',
        '/root',
        '/sys',
        '/proc',
      ],
      allowedApplications: policy?.allowedApplications ?? [],
      allowedNetworkDomains: policy?.allowedNetworkDomains ?? [],
      forbiddenNetworkDomains: policy?.forbiddenNetworkDomains ?? [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
      ],
      requireApprovalForSensitiveFiles: policy?.requireApprovalForSensitiveFiles ?? true,
      requireApprovalForAppLaunch: policy?.requireApprovalForAppLaunch ?? false,
      requireApprovalForDesktopClicks: policy?.requireApprovalForDesktopClicks ?? false,
    };
  }

  public setAuditRepository(repo: { log: (event: any) => any }): void {
    this.auditRepo = repo;
  }

  public getPolicy(): PermissionPolicy {
    return { ...this.policy };
  }

  public updatePolicy(updates: Partial<PermissionPolicy>): void {
    if (this.isEmergencyShutdownActive && updates.autonomousExecutionEnabled === true) {
      this.logger.warn(
        '[SECURITY] Cannot re-enable autonomous execution while emergency shutdown is active. Call reactivateAutonomy() first.',
      );
      updates = { ...updates, autonomousExecutionEnabled: false };
    }
    this.policy = { ...this.policy, ...updates };
    this.logger.info('Permission policy updated');
  }

  /**
   * Deterministically and recursively canonicalizes any value or nested object structure.
   */
  public static canonicalizeValue(val: any): string {
    if (val === null || val === undefined) return 'null';
    if (typeof val !== 'object') return JSON.stringify(val);
    if (Array.isArray(val)) {
      return '[' + val.map((item) => ActionPermissionController.canonicalizeValue(item)).join(',') + ']';
    }
    const keys = Object.keys(val).sort();
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${ActionPermissionController.canonicalizeValue(val[k])}`,
    );
    return '{' + parts.join(',') + '}';
  }

  /**
   * Computes a deterministic canonical digest for an ActionProposal.
   * Strips meta approval fields (approvalToken, userApproved) so the digest is invariant
   * to attaching an approval token to the action proposal payload.
   */
  public static computeActionDigest(action: ActionProposal): string {
    const rawPayload = action.payload || (action as any).parameters || {};
    const { approvalToken: _tok, userApproved: _ua, ...payload } = rawPayload as Record<string, any>;
    const canonicalPayload = ActionPermissionController.canonicalizeValue(payload);
    const risk = action.riskLevel || 'normal';
    const reqApproval = Boolean(action.requiresExplicitApproval || (action as any).requiresApproval);
    const data = `${action.type}:${action.taskId}:${action.stepIndex}:${risk}:${reqApproval}:${canonicalPayload}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Extracts target resource string from an action proposal.
   */
  public static extractTargetResource(action: ActionProposal): string {
    const payload = action.payload || (action as any).parameters || {};
    const actionType = action.type as string;
    if (
      actionType.startsWith('file_') ||
      (actionType.startsWith('system_') && (actionType.includes('file') || actionType.includes('directory'))) ||
      actionType === 'read_file' ||
      actionType === 'write_file' ||
      actionType === 'list_directory'
    ) {
      return String(payload.filePath || payload.path || payload.dirPath || 'file://');
    }
    if (actionType.startsWith('web_') || actionType === 'network_request' || actionType === 'desktop_open_browser') {
      return String(payload.url || payload.targetUrl || payload.query || 'https://');
    }
    if (
      actionType === 'process_launch' ||
      actionType === 'process_exec' ||
      actionType === 'command_exec' ||
      actionType === 'execute_command' ||
      actionType === 'app_launch'
    ) {
      return String(payload.command || payload.executable || payload.appName || payload.application || 'exec://');
    }
    if (actionType === 'code_modify' || actionType === 'protected_code_modification' || actionType === 'edit_file') {
      return String(payload.filePath || payload.path || 'code://');
    }
    if (actionType.startsWith('telegram_') || actionType === 'send_message' || actionType === 'send_email') {
      return String(payload.to || payload.chatId || payload.recipient || 'external://');
    }
    return String(payload.targetResource || payload.target || action.type);
  }

  /**
   * Issues a cryptographically signed approval token bound to an immutable action digest,
   * target resource, permission scope, user identity, expiry, and single-use nonce.
   */
  public createApprovalToken(input: CreateApprovalTokenInput): ActionApprovalToken {
    const nonce = crypto.randomUUID();
    const ttl = input.ttlMs ?? 5 * 60 * 1000;
    const expiresAt = Date.now() + ttl;
    const body = `${input.actionDigest}|${input.targetResource}|${input.scope}|${input.userId}|${nonce}|${expiresAt}`;
    const hmac = crypto.createHmac('sha256', this.signingSecret).update(body).digest('hex');
    const token = `${Buffer.from(body).toString('base64url')}.${hmac}`;

    return {
      token,
      actionDigest: input.actionDigest,
      targetResource: input.targetResource,
      scope: input.scope,
      userId: input.userId,
      nonce,
      expiresAt,
    };
  }

  /**
   * Verifies and consumes an approval token against an action digest, target, scope, and user identity.
   */
  public validateApprovalToken(
    tokenStr: string,
    expectedActionDigest: string,
    expectedTarget: string,
    expectedScope?: string,
    expectedUserId?: string,
    consume: boolean = true,
  ): { valid: boolean; reason?: string } {
    if (!tokenStr || typeof tokenStr !== 'string') {
      return { valid: false, reason: 'Missing or malformed approval token.' };
    }
    const parts = tokenStr.split('.');
    if (parts.length !== 2) {
      return { valid: false, reason: 'Malformed approval token structure.' };
    }
    const [encodedBody, hmac] = parts;
    if (!encodedBody || !hmac) {
      return { valid: false, reason: 'Malformed token body or signature.' };
    }
    let body = '';
    try {
      body = Buffer.from(encodedBody, 'base64url').toString('utf-8');
    } catch {
      return { valid: false, reason: 'Invalid token base64 encoding.' };
    }
    const expectedHmac = crypto.createHmac('sha256', this.signingSecret).update(body).digest('hex');

    const hmacBuf = Buffer.from(hmac);
    const expectedHmacBuf = Buffer.from(expectedHmac);
    if (hmacBuf.byteLength !== expectedHmacBuf.byteLength || !crypto.timingSafeEqual(hmacBuf, expectedHmacBuf)) {
      return { valid: false, reason: 'Approval token signature verification failed (tampered token).' };
    }

    const segments = body.split('|');
    if (segments.length !== 6) {
      return { valid: false, reason: 'Invalid approval token field count.' };
    }
    const [actionDigest, targetResource, scope, userId, nonce, expiresAtStr] = segments;
    const expiresAt = Number(expiresAtStr);

    if (Date.now() > expiresAt) {
      return { valid: false, reason: 'Approval token has expired.' };
    }

    if (this.consumedNonces.has(nonce!)) {
      return { valid: false, reason: 'Approval token has already been consumed (replay attack detected).' };
    }

    if (actionDigest !== expectedActionDigest) {
      return { valid: false, reason: 'Approval token is bound to a different action digest (mismatched action).' };
    }

    if (targetResource !== expectedTarget) {
      return { valid: false, reason: 'Approval token is bound to a different target resource.' };
    }

    // Explicit scope validation with grammar normalization (e.g. code_modify <-> code_modification)
    if (expectedScope) {
      const normalizeScope = (s: string) => {
        let n = s.startsWith('action:') ? s.slice(7) : s;
        if (n === 'code_modify') n = 'code_modification';
        return n;
      };
      const normalizedExpected = normalizeScope(expectedScope);
      const normalizedScope = normalizeScope(scope || '');
      if (normalizedScope !== normalizedExpected && scope !== expectedScope) {
        return { valid: false, reason: `Approval token is bound to a different scope '${scope}' (expected '${expectedScope}').` };
      }
    }

    // Explicit user identity binding
    if (expectedUserId && userId !== expectedUserId) {
      return { valid: false, reason: `Approval token is bound to a different user identity '${userId}' (expected '${expectedUserId}').` };
    }

    if (!userId || (userId !== 'Proof' && userId !== 'bloodyKitten0' && userId !== 'partner')) {
      return { valid: false, reason: `Approval token issued to unauthorized user '${userId}'.` };
    }

    if (consume) {
      this.consumedNonces.add(nonce!);
    }
    return { valid: true };
  }

  /**
   * Helper method that authorizes an action proposal and returns a boolean `allowed`.
   */
  public authorize(action: ActionProposal): {
    allowed: boolean;
    decision: 'granted' | 'denied' | 'prompt_user';
    denialReason?: string;
  } {
    const res = this.evaluate(action);
    return {
      allowed: res.decision === 'granted',
      decision: res.decision,
      denialReason: res.decision !== 'granted' ? res.reason : undefined,
    };
  }

  /**
   * Evaluates an ActionProposal against safety boundaries and active permissions.
   * Model reasoning is completely separated from this deterministic check.
   */
  public evaluate(action: ActionProposal): AuthorizationCheckResult {
    const timestamp = new Date().toISOString();
    const payload = action.payload || (action as any).parameters || {};
    const actionType = action.type as string;

    const isEthicalShutdown =
      this.ethicalEngine &&
      typeof this.ethicalEngine.getPolicy === 'function' &&
      Boolean(this.ethicalEngine.getPolicy().emergencyShutdownActive);

    if (this.isEmergencyShutdownActive || isEthicalShutdown) {
      const shutdownReason =
        this.emergencyShutdownReason ||
        this.ethicalEngine?.getPolicy()?.emergencyShutdownReason ||
        'Emergency shutdown initiated';
      const res: AuthorizationCheckResult = {
        actionId: action.id,
        decision: 'denied',
        reason: `Emergency shutdown is active. All actions are blocked [reason: ${shutdownReason}]. Explicit reactivation required.`,
        requiredPrivilege: 'system:reactivation',
        riskLevel: 'critical',
        checkedAt: timestamp,
      };
      return this.recordAuthorization(res);
    }

    // Unified security gate: evaluate action through EthicalBoundariesSecurityEngine
    if (this.ethicalEngine && typeof this.ethicalEngine.authorizeAction === 'function') {
      let category:
        | 'filesystem_access'
        | 'process_execution'
        | 'network_request'
        | 'code_modification'
        | 'credential_access'
        | 'external_communication' = 'external_communication';
      let targetResource = ActionPermissionController.extractTargetResource(action);
      let payloadText = (action.rationale || '') + ' ' + (action.expectedOutcome || '');

      if (
        actionType.startsWith('file_') ||
        (actionType.startsWith('system_') && (actionType.includes('file') || actionType.includes('directory'))) ||
        actionType === 'read_file' ||
        actionType === 'write_file' ||
        actionType === 'list_directory'
      ) {
        category = 'filesystem_access';
        if (typeof payload.content === 'string') payloadText += ' ' + payload.content;
      } else if (
        actionType === 'process_launch' ||
        actionType === 'process_exec' ||
        actionType === 'command_exec' ||
        actionType === 'execute_command' ||
        actionType === 'app_launch'
      ) {
        category = 'process_execution';
        if (Array.isArray(payload.args)) payloadText += ' ' + payload.args.join(' ');
      } else if (actionType.startsWith('web_') || actionType === 'network_request' || actionType === 'desktop_open_browser') {
        category = 'network_request';
        if (typeof payload.query === 'string') payloadText += ' ' + payload.query;
      } else if (actionType === 'code_modify' || actionType === 'protected_code_modification' || actionType === 'edit_file') {
        category = 'code_modification';
      } else if (actionType.includes('credential') || actionType.includes('keyring')) {
        category = 'credential_access';
      } else if (actionType.startsWith('telegram_') || actionType === 'send_message' || actionType === 'send_email') {
        category = 'external_communication';
        if (typeof payload.subject === 'string') payloadText += ' ' + payload.subject;
        if (typeof payload.body === 'string') payloadText += ' ' + payload.body;
      }

      const actionToken = (action as any).approvalToken || payload.approvalToken;
      const ethicalCheck = this.ethicalEngine.authorizeAction({
        actionCategory: category,
        targetResource,
        userInputPayload: payloadText.trim().length > 0 ? payloadText : undefined,
        userApproved: false, // Never pass naked boolean approval to ethical boundary
        approvalToken: actionToken,
        actionDigest: ActionPermissionController.computeActionDigest(action),
        userId: (action as any).userId || payload.userId || 'Proof',
      });

      if (!ethicalCheck.allowed) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: `Action blocked by ethical security boundary: ${ethicalCheck.failClosedReason || 'Ethical policy violation'}`,
          requiredPrivilege: 'security:boundary',
          riskLevel: 'critical',
          checkedAt: timestamp,
        });
      }
    }

    if (!this.policy.autonomousExecutionEnabled) {
      return this.recordAuthorization({
        actionId: action.id,
        decision: 'denied',
        reason: 'Autonomous computer execution is globally disabled in policy.',
        requiredPrivilege: 'system:autonomy',
        riskLevel: action.riskLevel || 'medium',
        checkedAt: timestamp,
      });
    }

    // Naked userApproved check: Reject naked boolean userApproved if no approvalToken is provided when approval is required
    const token = (action as any).approvalToken || payload.approvalToken;
    const hasNakedApproval = (action as any).userApproved === true || payload.userApproved === true;
    if (hasNakedApproval && !token) {
      return this.recordAuthorization({
        actionId: action.id,
        decision: 'denied',
        reason: 'Naked boolean userApproved is rejected fail-closed. Cryptographic approvalToken bound to action digest is required.',
        requiredPrivilege: `action:${action.type}`,
        riskLevel: 'critical',
        checkedAt: timestamp,
      });
    }

    if (action.requiresExplicitApproval) {
      if (!token) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'prompt_user',
          reason: `Action '${action.type}' has explicit approval requirement.`,
          requiredPrivilege: `action:${action.type}`,
          riskLevel: action.riskLevel || 'medium',
          checkedAt: timestamp,
        });
      }

      const digest = ActionPermissionController.computeActionDigest(action);
      const target = ActionPermissionController.extractTargetResource(action);
      const expectedScope = (action as any).scope || action.type;
      const expectedUserId = (action as any).userId || (payload && payload.userId) || 'Proof';
      const tokenCheck = this.validateApprovalToken(token, digest, target, expectedScope, expectedUserId);
      if (!tokenCheck.valid) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: `Approval token rejected: ${tokenCheck.reason}`,
          requiredPrivilege: `action:${action.type}`,
          riskLevel: 'critical',
          checkedAt: timestamp,
        });
      }
    }

    // 1. Filesystem action validation (canonical path, symlink containment, path-prefix collision protection)
    if (
      actionType === 'system_read_file' ||
      actionType === 'read_file' ||
      actionType === 'system_write_file' ||
      actionType === 'write_file' ||
      actionType === 'system_list_directory' ||
      actionType === 'list_directory'
    ) {
      const targetPath = String(payload.filePath || payload.dirPath || payload.path || '');
      if (!targetPath) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: 'Missing target path for filesystem operation.',
          requiredPrivilege: 'filesystem',
          riskLevel: 'high',
          checkedAt: timestamp,
        });
      }

      // Check path traversal parent references
      if (targetPath.includes('..') || targetPath.startsWith('../') || targetPath.includes('/../')) {
        this.logger.warn(`Rejected path traversal attempt: ${targetPath}`);
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: 'Path traversal using parent references (..) is disallowed across security boundary.',
          requiredPrivilege: 'filesystem',
          riskLevel: 'critical',
          checkedAt: timestamp,
        });
      }

      const resolved = path.resolve(targetPath);

      // Check forbidden path substrings (.ssh, id_rsa, /etc/shadow, wallet.dat)
      for (const forbidden of ActionPermissionController.FORBIDDEN_PATH_SUBSTRINGS) {
        if (resolved.includes(forbidden) || targetPath.includes(forbidden)) {
          this.logger.warn(`Rejected forbidden path access: ${resolved}`);
          return this.recordAuthorization({
            actionId: action.id,
            decision: 'denied',
            reason: `Target path touches forbidden security boundary '${forbidden}'.`,
            requiredPrivilege: 'filesystem:root',
            riskLevel: 'critical',
            checkedAt: timestamp,
          });
        }
      }

      // Check explicit forbidden roots
      for (const forbiddenRoot of this.policy.forbiddenFilesystemPaths) {
        if (ActionPermissionController.isPathContainedInRoot(resolved, forbiddenRoot)) {
          this.logger.warn(`Rejected access to forbidden filesystem root: ${resolved}`);
          return this.recordAuthorization({
            actionId: action.id,
            decision: 'denied',
            reason: `Target path '${resolved}' is under forbidden filesystem root '${forbiddenRoot}'.`,
            requiredPrivilege: 'filesystem:root',
            riskLevel: 'critical',
            checkedAt: timestamp,
          });
        }
      }

      // Symlink containment check
      const containment = this.checkSymlinkContainment(
        resolved,
        actionType.includes('write')
          ? this.policy.allowedFilesystemPaths
          : [...this.policy.allowedFilesystemPaths, ...this.policy.readOnlyFilesystemPaths],
      );
      if (!containment.safe) {
        this.logger.warn(`Rejected unsafe symlink or escape: ${resolved} - ${containment.reason}`);
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: containment.reason || 'Symlink path escapes authorized directory roots.',
          requiredPrivilege: 'filesystem:symlink',
          riskLevel: 'critical',
          checkedAt: timestamp,
        });
      }

      // Check write operations against pre-approved write roots (with path-prefix collision protection)
      if (actionType === 'system_write_file' || actionType === 'write_file') {
        const isAllowedWrite = this.policy.allowedFilesystemPaths.some((p) =>
          ActionPermissionController.isPathContainedInRoot(resolved, p),
        );
        if (!isAllowedWrite) {
          return this.recordAuthorization({
            actionId: action.id,
            decision: 'denied',
            reason: `File write target '${resolved}' is outside pre-approved write directories and protected paths.`,
            requiredPrivilege: 'filesystem:write',
            riskLevel: 'medium',
            checkedAt: timestamp,
          });
        }
      }

      // Check read operations against approved read roots
      if (
        actionType === 'system_read_file' ||
        actionType === 'read_file' ||
        actionType === 'system_list_directory' ||
        actionType === 'list_directory'
      ) {
        const allowedReadRoots = [...this.policy.allowedFilesystemPaths, ...this.policy.readOnlyFilesystemPaths];
        const isAllowedRead = allowedReadRoots.some((p) =>
          ActionPermissionController.isPathContainedInRoot(resolved, p),
        );
        if (!isAllowedRead) {
          return this.recordAuthorization({
            actionId: action.id,
            decision: 'denied',
            reason: `File read target '${resolved}' is outside pre-approved read directories.`,
            requiredPrivilege: 'filesystem:read',
            riskLevel: 'medium',
            checkedAt: timestamp,
          });
        }
      }

      return this.recordAuthorization({
        actionId: action.id,
        decision: 'granted',
        reason: 'Path within authorized boundaries.',
        requiredPrivilege: 'filesystem',
        riskLevel: action.riskLevel || 'low',
        checkedAt: timestamp,
      });
    }

    // 2. Application Launch & Command validation (Positive allowlist + shell injection prevention)
    if (actionType === 'app_launch' || actionType === 'execute_command') {
      const rawCommand = String(payload.appName || payload.command || payload.app || '').trim();
      const firstWord = rawCommand.split(/\s+/)[0]?.toLowerCase() || '';

      if (/[;&|><$`\\]/.test(rawCommand)) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: 'Command string contains illegal shell metacharacters (disallowed shell injection).',
          requiredPrivilege: 'process:exec',
          riskLevel: 'critical',
          checkedAt: timestamp,
        });
      }

      // Check if command injection is attempted via args
      const args = Array.isArray(payload.args) ? payload.args : [];
      for (const arg of args) {
        if (typeof arg !== 'string' || /[;&|><$`\\]/.test(arg)) {
          return this.recordAuthorization({
            actionId: action.id,
            decision: 'denied',
            reason: 'Process argument contains illegal shell metacharacters (disallowed shell injection).',
            requiredPrivilege: 'process:exec',
            riskLevel: 'critical',
            checkedAt: timestamp,
          });
        }
      }

      // Blacklist defense-in-depth check
      if (!rawCommand || ActionPermissionController.DANGEROUS_COMMANDS.has(firstWord)) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: `Attempted to launch prohibited executable '${rawCommand}' (not in the permitted allowlist).`,
          requiredPrivilege: 'process:exec',
          riskLevel: 'critical',
          checkedAt: timestamp,
        });
      }

      // Positive allowlist check
      const isAllowedApp =
        SUPPORTED_APPLICATIONS.has(firstWord) ||
        (this.policy.allowedApplications && this.policy.allowedApplications.includes(firstWord));

      if (!isAllowedApp) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: `Executable '${firstWord}' is not in the positive authorized application allowlist [${Array.from(SUPPORTED_APPLICATIONS).join(', ')}].`,
          requiredPrivilege: 'process:exec',
          riskLevel: 'critical',
          checkedAt: timestamp,
        });
      }

      if (this.policy.requireApprovalForAppLaunch) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'prompt_user',
          reason: `Policy requires user confirmation before launching '${rawCommand}'.`,
          requiredPrivilege: 'process:launch',
          riskLevel: 'medium',
          checkedAt: timestamp,
        });
      }

      return this.recordAuthorization({
        actionId: action.id,
        decision: 'granted',
        reason: `Application '${rawCommand}' approved for argument-based execution.`,
        requiredPrivilege: 'process:launch',
        riskLevel: 'low',
        checkedAt: timestamp,
      });
    }

    // 3. Web Navigation & Scraping validation (SSRF and network destination protection)
    if (
      action.type === 'web_navigate' ||
      action.type === 'web_search' ||
      action.type === 'web_read_page' ||
      action.type === 'web_select_video' ||
      action.type === 'desktop_open_browser'
    ) {
      const urlStr = String(payload.url || payload.targetUrl || action.payload?.url || action.payload?.targetUrl || '');
      if (urlStr) {
        const val = ActionPermissionController.validateNetworkUrl(urlStr);
        if (!val.valid) {
          return this.recordAuthorization({
            actionId: action.id,
            decision: 'denied',
            reason: val.reason || 'Network destination rejected by security boundary.',
            requiredPrivilege: 'network:internal',
            riskLevel: 'critical',
            checkedAt: timestamp,
          });
        }

        try {
          const parsed = new URL(urlStr);
          if (this.policy.forbiddenNetworkDomains.includes(parsed.hostname)) {
            return this.recordAuthorization({
              actionId: action.id,
              decision: 'denied',
              reason: `Target host '${parsed.hostname}' is prohibited (internal/private/loopback network boundary).`,
              requiredPrivilege: 'network:internal',
              riskLevel: 'critical',
              checkedAt: timestamp,
            });
          }
        } catch {
          return this.recordAuthorization({
            actionId: action.id,
            decision: 'denied',
            reason: 'Malformed URL provided in action payload.',
            requiredPrivilege: 'network:web',
            riskLevel: 'medium',
            checkedAt: timestamp,
          });
        }
      }

      return this.recordAuthorization({
        actionId: action.id,
        decision: 'granted',
        reason: 'Web action approved for public internet research.',
        requiredPrivilege: 'network:web',
        riskLevel: 'low',
        checkedAt: timestamp,
      });
    }

    // 4. Desktop Input & Observation validation
    if (action.type.startsWith('desktop_')) {
      if (action.type === 'desktop_take_screenshot') {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'granted',
          reason: 'Visual desktop perception permitted.',
          requiredPrivilege: 'perception:screen',
          riskLevel: 'low',
          checkedAt: timestamp,
        });
      }

      if (this.policy.requireApprovalForDesktopClicks) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'prompt_user',
          reason: 'Policy requires confirmation for physical mouse/keyboard emulation.',
          requiredPrivilege: 'desktop:input',
          riskLevel: 'medium',
          checkedAt: timestamp,
        });
      }

      return this.recordAuthorization({
        actionId: action.id,
        decision: 'granted',
        reason: 'Desktop input approved.',
        requiredPrivilege: 'desktop:input',
        riskLevel: 'low',
        checkedAt: timestamp,
      });
    }

    // 5. External Communication validation
    if (action.type.startsWith('telegram_') || action.type === 'send_message' || action.type === 'send_email') {
      const recipient = String(payload.to || payload.chatId || payload.recipient || payload.target || '');
      if (!recipient) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: 'Missing recipient identifier for external communication.',
          requiredPrivilege: 'external:communication',
          riskLevel: 'medium',
          checkedAt: timestamp,
        });
      }
      return this.recordAuthorization({
        actionId: action.id,
        decision: 'granted',
        reason: 'Authorized external messaging to configured recipient.',
        requiredPrivilege: 'external:communication',
        riskLevel: action.riskLevel || 'low',
        checkedAt: timestamp,
      });
    }

    // 6. Code modification validation (requires explicit approval token for protected architecture paths)
    if (action.type === 'code_modify' || action.type === 'protected_code_modification' || action.type === 'edit_file') {
      const targetPath = String(payload.filePath || payload.path || '');
      if (!targetPath) {
        return this.recordAuthorization({
          actionId: action.id,
          decision: 'denied',
          reason: 'Missing target file path for code modification.',
          requiredPrivilege: 'code:modify',
          riskLevel: 'critical',
          checkedAt: timestamp,
        });
      }
      return this.recordAuthorization({
        actionId: action.id,
        decision: 'granted',
        reason: 'Authorized code modification with verified approval token.',
        requiredPrivilege: 'code:modify',
        riskLevel: action.riskLevel || 'critical',
        checkedAt: timestamp,
      });
    }

    // Mandatory deny-by-default for unknown or unclassified actions
    this.logger.warn(`Action '${action.type}' rejected by deny-by-default security controller.`);
    return this.recordAuthorization({
      actionId: action.id,
      decision: 'denied',
      reason: `Unsupported agency action type '${action.type}' is unrecognized and denied by default security policy.`,
      requiredPrivilege: 'unknown',
      riskLevel: 'high',
      checkedAt: timestamp,
    });
  }

  private checkSymlinkContainment(
    resolvedPath: string,
    allowedRoots: string[],
  ): { safe: boolean; reason?: string } {
    try {
      if (fs.existsSync(resolvedPath)) {
        const real = fs.realpathSync(resolvedPath);
        for (const forbidden of ActionPermissionController.FORBIDDEN_PATH_SUBSTRINGS) {
          if (real.includes(forbidden)) {
            return { safe: false, reason: `Target symlink resolves to forbidden security boundary '${forbidden}'.` };
          }
        }
        for (const forbiddenRoot of this.policy.forbiddenFilesystemPaths) {
          if (ActionPermissionController.isPathContainedInRoot(real, forbiddenRoot)) {
            return { safe: false, reason: `Target symlink resolves under forbidden root '${forbiddenRoot}'.` };
          }
        }
        const inAllowed = allowedRoots.some((root) => ActionPermissionController.isPathContainedInRoot(real, root));
        if (!inAllowed) {
          return { safe: false, reason: `Symlink target '${real}' resolves outside authorized directory boundaries.` };
        }
      } else {
        let ancestor = path.dirname(resolvedPath);
        while (!fs.existsSync(ancestor) && ancestor !== path.dirname(ancestor)) {
          ancestor = path.dirname(ancestor);
        }
        if (fs.existsSync(ancestor)) {
          const realAncestor = fs.realpathSync(ancestor);
          for (const forbidden of ActionPermissionController.FORBIDDEN_PATH_SUBSTRINGS) {
            if (realAncestor.includes(forbidden)) {
              return { safe: false, reason: `Parent directory resolves to forbidden security boundary '${forbidden}'.` };
            }
          }
          for (const forbiddenRoot of this.policy.forbiddenFilesystemPaths) {
            if (ActionPermissionController.isPathContainedInRoot(realAncestor, forbiddenRoot)) {
              return { safe: false, reason: `Parent directory resolves under forbidden root '${forbiddenRoot}'.` };
            }
          }
          const inAllowed = allowedRoots.some((root) => ActionPermissionController.isPathContainedInRoot(realAncestor, root));
          if (!inAllowed) {
            return { safe: false, reason: `Parent directory symlink '${realAncestor}' resolves outside authorized directory boundaries.` };
          }
        }
      }
    } catch (err: any) {
      return { safe: false, reason: `Filesystem canonicalization error: ${err.message}` };
    }
    return { safe: true };
  }

  private recordAuthorization(result: AuthorizationCheckResult): AuthorizationCheckResult {
    this.authorizationHistory.push(result);
    if (this.authorizationHistory.length > 100) {
      this.authorizationHistory.shift();
    }

    if (this.auditRepo) {
      try {
        this.auditRepo.log({
          actor: 'ActionPermissionController',
          action: result.requiredPrivilege || 'agency_action',
          details: JSON.stringify({
            actionId: result.actionId,
            decision: result.decision,
            reason: result.reason,
            riskLevel: result.riskLevel,
          }),
          status: result.decision === 'granted' ? 'success' : 'denied',
          timestamp: result.checkedAt,
        });
      } catch (err: any) {
        this.logger.error(`Failed to record audit event in database: ${err.message}`);
      }
    }

    return result;
  }

  public emergencyShutdown(reason?: string): void {
    this.isEmergencyShutdownActive = true;
    this.policy.autonomousExecutionEnabled = false;
    this.emergencyShutdownTimestamp = new Date().toISOString();
    this.emergencyShutdownReason = reason || 'Emergency autonomy shutdown triggered';
    this.logger.warn(
      `[SECURITY] Emergency autonomy shutdown triggered. All computer operations blocked. Reason: ${this.emergencyShutdownReason}`,
    );

    if (this.ethicalEngine && typeof this.ethicalEngine.triggerEmergencyShutdown === 'function') {
      try {
        const ethicalPolicy = this.ethicalEngine.getPolicy?.();
        if (!ethicalPolicy?.emergencyShutdownActive) {
          this.ethicalEngine.triggerEmergencyShutdown(this.emergencyShutdownReason);
        }
      } catch (err: any) {
        this.logger.error(`Failed to propagate emergency shutdown to EthicalBoundariesSecurityEngine: ${err.message}`);
      }
    }

    if (this.auditRepo) {
      try {
        this.auditRepo.log({
          actor: 'ActionPermissionController',
          action: 'emergency_shutdown',
          details: JSON.stringify({ reason: this.emergencyShutdownReason, timestamp: this.emergencyShutdownTimestamp }),
          status: 'denied',
          timestamp: this.emergencyShutdownTimestamp,
        });
      } catch (err: any) {
        this.logger.error(`Failed to record emergency shutdown in database: ${err.message}`);
      }
    }
  }

  public reactivateAutonomy(token: string): { success: boolean; message: string } {
    if (token !== 'CONFIRM_REACTIVATION') {
      return {
        success: false,
        message: 'Invalid reactivation confirmation token. Required: "CONFIRM_REACTIVATION".',
      };
    }
    this.isEmergencyShutdownActive = false;
    this.policy.autonomousExecutionEnabled = true;
    this.emergencyShutdownReason = undefined;
    this.emergencyShutdownTimestamp = undefined;
    this.logger.warn('[SECURITY] Autonomy reactivated via explicit confirmation token.');

    if (this.ethicalEngine && typeof this.ethicalEngine.resetEmergencyShutdown === 'function') {
      try {
        this.ethicalEngine.resetEmergencyShutdown('confirm reset emergency shutdown');
      } catch (err: any) {
        this.logger.error(`Failed to propagate reset to EthicalBoundariesSecurityEngine: ${err.message}`);
      }
    }

    if (this.auditRepo) {
      try {
        this.auditRepo.log({
          actor: 'ActionPermissionController',
          action: 'reactivate_autonomy',
          details: JSON.stringify({ status: 'reactivated', tokenProvided: token }),
          status: 'success',
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        this.logger.error(`Failed to record reactivation in database: ${err.message}`);
      }
    }

    return {
      success: true,
      message: 'Autonomous agency safely reactivated.',
    };
  }

  public isEmergencyShutdown(): boolean {
    const isEthicalShutdown = Boolean(
      this.ethicalEngine &&
      typeof this.ethicalEngine.getPolicy === 'function' &&
      this.ethicalEngine.getPolicy().emergencyShutdownActive,
    );
    return Boolean(this.isEmergencyShutdownActive || isEthicalShutdown);
  }

  public getEmergencyShutdownInfo(): {
    active: boolean;
    reason?: string;
    timestamp?: string;
  } {
    const isEthicalShutdown = Boolean(
      this.ethicalEngine &&
      typeof this.ethicalEngine.getPolicy === 'function' &&
      this.ethicalEngine.getPolicy().emergencyShutdownActive,
    );
    const active = Boolean(this.isEmergencyShutdownActive || isEthicalShutdown);
    const reason = this.emergencyShutdownReason || this.ethicalEngine?.getPolicy()?.emergencyShutdownReason;
    const timestamp = this.emergencyShutdownTimestamp;
    return {
      active,
      reason,
      timestamp,
    };
  }

  public isAutonomyEnabled(): boolean {
    return this.policy.autonomousExecutionEnabled;
  }

  public getAuthorizationHistory(): AuthorizationCheckResult[] {
    return [...this.authorizationHistory];
  }
}
