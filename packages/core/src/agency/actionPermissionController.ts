import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  ActionProposal,
  AuthorizationCheckResult,
  PermissionPolicy,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export class ActionPermissionController {
  private policy: PermissionPolicy;
  private logger: ILogger;
  private authorizationHistory: AuthorizationCheckResult[] = [];

  // Disallowed dangerous binaries and commands
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

  private static isPrivateOrLoopbackHost(hostname: string): boolean {
    const host = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host === '0.0.0.0' || host === '127.0.0.1' || host === '::1') return true;
    if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return true;

    // IPv4 address check
    const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const b0 = parseInt(ipv4Match[1]!, 10);
      const b1 = parseInt(ipv4Match[2]!, 10);
      if (b0 === 127) return true; // 127.0.0.0/8
      if (b0 === 10) return true; // 10.0.0.0/8
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // 172.16.0.0/12
      if (b0 === 192 && b1 === 168) return true; // 192.168.0.0/16
      if (b0 === 169 && b1 === 254) return true; // 169.254.0.0/16 link-local
      if (b0 === 0) return true;
    }

    // IPv6 link-local or unique-local
    if (host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd00:')) return true;

    return false;
  }

  constructor(policy?: Partial<PermissionPolicy>, logger: ILogger = rootLogger) {
    this.logger = logger.child('ActionPermissionController');
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
      ],
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

  public getPolicy(): PermissionPolicy {
    return { ...this.policy };
  }

  public updatePolicy(updates: Partial<PermissionPolicy>): void {
    this.policy = { ...this.policy, ...updates };
    this.logger.info('Permission policy updated');
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

    if (!this.policy.autonomousExecutionEnabled) {
      return {
        actionId: action.id,
        decision: 'denied',
        reason: 'Autonomous computer execution is globally disabled in policy.',
        requiredPrivilege: 'system:autonomy',
        riskLevel: action.riskLevel || 'medium',
        checkedAt: timestamp,
      };
    }

    if (action.requiresExplicitApproval) {
      return {
        actionId: action.id,
        decision: 'prompt_user',
        reason: `Action '${action.type}' has explicit approval requirement.`,
        requiredPrivilege: `action:${action.type}`,
        riskLevel: action.riskLevel || 'medium',
        checkedAt: timestamp,
      };
    }

    // 1. Filesystem action validation
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
        return {
          actionId: action.id,
          decision: 'denied',
          reason: 'Missing target path for filesystem operation.',
          requiredPrivilege: 'filesystem',
          riskLevel: 'high',
          checkedAt: timestamp,
        };
      }

      // Check path traversal
      if (targetPath.includes('..') || targetPath.startsWith('../') || targetPath.includes('/../')) {
        this.logger.warn(`Rejected path traversal attempt: ${targetPath}`);
        return {
          actionId: action.id,
          decision: 'denied',
          reason: 'Path traversal using parent references (..) is disallowed across security boundary.',
          requiredPrivilege: 'filesystem',
          riskLevel: 'critical',
          checkedAt: timestamp,
        };
      }

      let resolved = path.resolve(targetPath);
      try {
        if (fs.existsSync(resolved)) {
          resolved = fs.realpathSync(resolved);
        }
      } catch {}

      // Check forbidden path substrings (e.g. ssh keys, shadow, credentials)
      for (const forbidden of ActionPermissionController.FORBIDDEN_PATH_SUBSTRINGS) {
        if (resolved.includes(forbidden) || targetPath.includes(forbidden)) {
          this.logger.warn(`Rejected forbidden path access: ${resolved}`);
          const res: AuthorizationCheckResult = {
            actionId: action.id,
            decision: 'denied',
            reason: `Target path touches forbidden security boundary '${forbidden}'.`,
            requiredPrivilege: 'filesystem:root',
            riskLevel: 'critical',
            checkedAt: timestamp,
          };
          this.recordAuthorization(res);
          return res;
        }
      }

      // Check write operations against read-only or outside paths
      if (actionType === 'system_write_file' || actionType === 'write_file') {
        const isAllowedWrite = this.policy.allowedFilesystemPaths.some((p) =>
          resolved.startsWith(path.resolve(p)),
        );
        if (!isAllowedWrite) {
          return {
            actionId: action.id,
            decision: 'denied',
            reason: `File write target '${resolved}' is outside pre-approved write directories and protected paths.`,
            requiredPrivilege: 'filesystem:write',
            riskLevel: 'medium',
            checkedAt: timestamp,
          };
        }
      }

      return {
        actionId: action.id,
        decision: 'granted',
        reason: 'Path within authorized boundaries.',
        requiredPrivilege: 'filesystem',
        riskLevel: action.riskLevel || 'low',
        checkedAt: timestamp,
      };
    }

    // 2. Application Launch validation
    if (actionType === 'app_launch' || actionType === 'execute_command') {
      const rawCommand = String(payload.appName || payload.command || payload.app || '').trim();
      const firstWord = rawCommand.split(/\s+/)[0]?.toLowerCase() || '';

      if (/[;&|><$`\\]/.test(rawCommand)) {
        return {
          actionId: action.id,
          decision: 'denied',
          reason: 'Command string contains illegal shell metacharacters (disallowed shell injection).',
          requiredPrivilege: 'process:exec',
          riskLevel: 'critical',
          checkedAt: timestamp,
        };
      }

      if (!rawCommand || ActionPermissionController.DANGEROUS_COMMANDS.has(firstWord)) {
        return {
          actionId: action.id,
          decision: 'denied',
          reason: `Attempted to launch prohibited executable '${rawCommand}' (not in the permitted allowlist).`,
          requiredPrivilege: 'process:exec',
          riskLevel: 'critical',
          checkedAt: timestamp,
        };
      }

      // Check if command injection is attempted via args
      const args = Array.isArray(payload.args) ? payload.args : [];
      for (const arg of args) {
        if (typeof arg !== 'string' || /[;&|><$`\\]/.test(arg)) {
          return {
            actionId: action.id,
            decision: 'denied',
            reason: 'Process argument contains illegal shell metacharacters.',
            requiredPrivilege: 'process:exec',
            riskLevel: 'high',
            checkedAt: timestamp,
          };
        }
      }

      if (this.policy.requireApprovalForAppLaunch) {
        return {
          actionId: action.id,
          decision: 'prompt_user',
          reason: `Policy requires user confirmation before launching '${rawCommand}'.`,
          requiredPrivilege: 'process:launch',
          riskLevel: 'medium',
          checkedAt: timestamp,
        };
      }

      return {
        actionId: action.id,
        decision: 'granted',
        reason: `Application '${rawCommand}' approved for argument-based execution.`,
        requiredPrivilege: 'process:launch',
        riskLevel: 'low',
        checkedAt: timestamp,
      };
    }

    // 3. Web Navigation & Scraping validation
    if (
      action.type === 'web_navigate' ||
      action.type === 'web_search' ||
      action.type === 'web_read_page' ||
      action.type === 'web_select_video'
    ) {
      const urlStr = String(payload.url || payload.targetUrl || action.payload?.url || action.payload?.targetUrl || '');
      if (urlStr) {
        try {
          const parsed = new URL(urlStr);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return {
              actionId: action.id,
              decision: 'denied',
              reason: `Unsupported URL protocol '${parsed.protocol}'. Only http/https permitted.`,
              requiredPrivilege: 'network:web',
              riskLevel: 'high',
              checkedAt: timestamp,
            };
          }

          // Check against localhost, private, and internal network probing
          if (
            this.policy.forbiddenNetworkDomains.includes(parsed.hostname) ||
            ActionPermissionController.isPrivateOrLoopbackHost(parsed.hostname)
          ) {
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

    // Mandatory deny-by-default for unknown or unclassified actions
    this.logger.warn(`Action '${action.type}' rejected by deny-by-default security controller.`);
    return this.recordAuthorization({
      actionId: action.id,
      decision: 'denied',
      reason: `Action type '${action.type}' is unrecognized and denied by default security policy.`,
      requiredPrivilege: 'unknown',
      riskLevel: 'high',
      checkedAt: timestamp,
    });
  }

  private recordAuthorization(result: AuthorizationCheckResult): AuthorizationCheckResult {
    this.authorizationHistory.push(result);
    if (this.authorizationHistory.length > 100) {
      this.authorizationHistory.shift();
    }
    return result;
  }

  public emergencyShutdown(): void {
    this.policy.autonomousExecutionEnabled = false;
    this.logger.warn('[SECURITY] Emergency autonomy shutdown triggered. All computer operations blocked.');
  }

  public isAutonomyEnabled(): boolean {
    return this.policy.autonomousExecutionEnabled;
  }

  public getAuthorizationHistory(): AuthorizationCheckResult[] {
    return [...this.authorizationHistory];
  }
  }

