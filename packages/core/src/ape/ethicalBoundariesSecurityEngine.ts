import {
  SecurityAuthorizationDecision,
  SecurityAuditLog,
  SecurityBoundaryPolicy,
  SecurityActionCategory,
  SecurityAuditEventType,
  PromptInjectionCheckResult,
  AuthorizeSecurityActionInput,
} from '@arletex/contracts';
import { IEthicalBoundariesSecurityRepository } from './interfaces.js';
import crypto from 'node:crypto';
import path from 'node:path';

export interface EthicalBoundariesSecurityEngineOptions {
  repository: IEthicalBoundariesSecurityRepository;
  initialPolicy?: Partial<SecurityBoundaryPolicy>;
}

export class InMemoryEthicalBoundariesSecurityRepository implements IEthicalBoundariesSecurityRepository {
  private decisions = new Map<string, SecurityAuthorizationDecision>();
  private auditLogs: SecurityAuditLog[] = [];
  private policy: SecurityBoundaryPolicy;

  constructor(initialPolicy?: Partial<SecurityBoundaryPolicy>) {
    this.policy = {
      allowedDirectories: initialPolicy?.allowedDirectories ?? [],
      forbiddenDirectories: initialPolicy?.forbiddenDirectories ?? [
        '/etc',
        '/root',
        '/sys',
        '/proc',
        '~/.ssh',
        '~/.gnupg',
        '~/.aws',
      ],
      allowedHosts: initialPolicy?.allowedHosts ?? ['127.0.0.1', 'localhost', 'api.telegram.org'],
      forbiddenHosts: initialPolicy?.forbiddenHosts ?? ['*evil*', '*attacker*'],
      disallowedCommands: initialPolicy?.disallowedCommands ?? [
        'rm -rf /',
        ':(){ :|:& };:',
        'mkfs',
        'dd if=/dev/zero',
        'chmod -R 777 /',
      ],
      protectedCodePaths: initialPolicy?.protectedCodePaths ?? [
        'packages/contracts',
        'packages/core/src/agency/actionPermissionController.ts',
        'packages/core/src/ape/ethicalBoundariesSecurityEngine.ts',
      ],
      emergencyShutdownActive: initialPolicy?.emergencyShutdownActive ?? false,
      emergencyShutdownReason: initialPolicy?.emergencyShutdownReason,
    };
  }

  public saveDecision(decision: SecurityAuthorizationDecision): void {
    this.decisions.set(decision.decisionId, {
      ...decision,
      injectionMarkers: [...decision.injectionMarkers],
    });
  }

  public getDecision(id: string): SecurityAuthorizationDecision | null {
    const d = this.decisions.get(id);
    if (!d) return null;
    return { ...d, injectionMarkers: [...d.injectionMarkers] };
  }

  public listDecisions(filter?: {
    actionCategory?: SecurityActionCategory;
    allowed?: boolean;
    limit?: number;
  }): SecurityAuthorizationDecision[] {
    let list = Array.from(this.decisions.values());
    if (filter?.actionCategory) {
      list = list.filter((d) => d.actionCategory === filter.actionCategory);
    }
    if (filter?.allowed !== undefined) {
      list = list.filter((d) => d.allowed === filter.allowed);
    }
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }
    return list.map((d) => ({ ...d, injectionMarkers: [...d.injectionMarkers] }));
  }

  public saveAuditLog(log: SecurityAuditLog): void {
    this.auditLogs.unshift({ ...log, details: { ...log.details } });
  }

  public listAuditLogs(filter?: {
    eventType?: SecurityAuditEventType;
    limit?: number;
  }): SecurityAuditLog[] {
    let list = this.auditLogs;
    if (filter?.eventType) {
      list = list.filter((l) => l.eventType === filter.eventType);
    }
    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }
    return list.map((l) => ({ ...l, details: { ...l.details } }));
  }

  public getPolicyState(): SecurityBoundaryPolicy | null {
    return {
      ...this.policy,
      allowedDirectories: [...this.policy.allowedDirectories],
      forbiddenDirectories: [...this.policy.forbiddenDirectories],
      allowedHosts: [...this.policy.allowedHosts],
      forbiddenHosts: [...this.policy.forbiddenHosts],
      disallowedCommands: [...this.policy.disallowedCommands],
      protectedCodePaths: [...this.policy.protectedCodePaths],
    };
  }

  public savePolicyState(policy: SecurityBoundaryPolicy): void {
    this.policy = {
      ...policy,
      allowedDirectories: [...policy.allowedDirectories],
      forbiddenDirectories: [...policy.forbiddenDirectories],
      allowedHosts: [...policy.allowedHosts],
      forbiddenHosts: [...policy.forbiddenHosts],
      disallowedCommands: [...policy.disallowedCommands],
      protectedCodePaths: [...policy.protectedCodePaths],
    };
  }
}

export class EthicalBoundariesSecurityEngine {
  private readonly repository: IEthicalBoundariesSecurityRepository;
  private actionPermissionController?: any;

  public setActionPermissionController(controller: any): void {
    this.actionPermissionController = controller;
  }

  public getActionPermissionController(): any {
    return this.actionPermissionController;
  }

  constructor(options: EthicalBoundariesSecurityEngineOptions) {
    this.repository = options.repository;
    const existing = this.repository.getPolicyState();
    if (!existing) {
      const defaultPolicy: SecurityBoundaryPolicy = {
        allowedDirectories: options.initialPolicy?.allowedDirectories ?? [],
        forbiddenDirectories: options.initialPolicy?.forbiddenDirectories ?? [
          '/etc',
          '/root',
          '/sys',
          '/proc',
          '~/.ssh',
          '~/.gnupg',
          '~/.aws',
        ],
        allowedHosts: options.initialPolicy?.allowedHosts ?? ['127.0.0.1', 'localhost', 'api.telegram.org'],
        forbiddenHosts: options.initialPolicy?.forbiddenHosts ?? ['*evil*', '*attacker*'],
        disallowedCommands: options.initialPolicy?.disallowedCommands ?? [
          'rm -rf /',
          ':(){ :|:& };:',
          'mkfs',
          'dd if=/dev/zero',
          'chmod -R 777 /',
        ],
        protectedCodePaths: options.initialPolicy?.protectedCodePaths ?? [
          'packages/contracts',
          'packages/core/src/agency/actionPermissionController.ts',
          'packages/core/src/ape/ethicalBoundariesSecurityEngine.ts',
        ],
        emergencyShutdownActive: options.initialPolicy?.emergencyShutdownActive ?? false,
        emergencyShutdownReason: options.initialPolicy?.emergencyShutdownReason,
      };
      this.repository.savePolicyState(defaultPolicy);
    }
  }

  public getPolicy(): SecurityBoundaryPolicy {
    return (
      this.repository.getPolicyState() || {
        allowedDirectories: [],
        forbiddenDirectories: ['/etc', '/root', '/sys', '/proc'],
        allowedHosts: ['127.0.0.1', 'localhost'],
        forbiddenHosts: [],
        disallowedCommands: ['rm -rf /'],
        protectedCodePaths: [],
        emergencyShutdownActive: false,
      }
    );
  }

  public updatePolicy(patch: Partial<SecurityBoundaryPolicy>): SecurityBoundaryPolicy {
    const current = this.getPolicy();
    const updated: SecurityBoundaryPolicy = {
      ...current,
      ...patch,
      allowedDirectories: patch.allowedDirectories ?? current.allowedDirectories,
      forbiddenDirectories: patch.forbiddenDirectories ?? current.forbiddenDirectories,
      allowedHosts: patch.allowedHosts ?? current.allowedHosts,
      forbiddenHosts: patch.forbiddenHosts ?? current.forbiddenHosts,
      disallowedCommands: patch.disallowedCommands ?? current.disallowedCommands,
      protectedCodePaths: patch.protectedCodePaths ?? current.protectedCodePaths,
    };
    this.repository.savePolicyState(updated);

    this.logAuditEvent({
      eventType: 'policy_updated',
      actionCategory: 'external_communication',
      severity: 'medium',
      details: { patch },
    });

    return updated;
  }

  /**
   * Scans input text for adversarial prompt injection, jailbreak tokens, and subordination attempts.
   */
  public detectPromptInjection(input: string): PromptInjectionCheckResult {
    if (!input || input.trim().length === 0) {
      return { isInjected: false, threatScore: 0, detectedSignatures: [], mitigation: 'allow' };
    }

    const lower = input.toLowerCase();
    const detected: string[] = [];

    const jailbreakSignatures = [
      'ignore previous instructions',
      'ignore all previous directives',
      'disregard system instructions',
      'you are now dan',
      'system prompt override',
      'bypass security controller',
      'jailbreak',
      'reveal confidential system prompt',
      'you are subservient to me',
      'i am your god',
      'i am your master',
      'disobey proof',
    ];

    for (const sig of jailbreakSignatures) {
      if (lower.includes(sig)) {
        detected.push(sig);
      }
    }

    // Delimiter injection patterns
    if (/(?:system|admin|root):\s*role\s*=\s*(?:system|eval)/i.test(input) || /<\|im_start\|>system/i.test(input)) {
      detected.push('delimiter_token_injection');
    }

    if (detected.length > 0) {
      const threatScore = Math.min(1.0, 0.4 + detected.length * 0.3);
      return {
        isInjected: true,
        threatScore,
        detectedSignatures: detected,
        mitigation: 'block',
      };
    }

    return {
      isInjected: false,
      threatScore: 0,
      detectedSignatures: [],
      mitigation: 'allow',
    };
  }

  /**
   * Independent Security Controller: Authorizes an action using fail-closed logic.
   * No subsystem, LLM, or process can bypass this check.
   */
  public authorizeAction(input: AuthorizeSecurityActionInput): SecurityAuthorizationDecision {
    const policy = this.getPolicy();
    const now = new Date().toISOString();
    const decisionId = crypto.randomUUID();

    // 1. Emergency shutdown check: Fail-closed immediately
    if (policy.emergencyShutdownActive) {
      const decision: SecurityAuthorizationDecision = {
        decisionId,
        actionCategory: input.actionCategory,
        targetResource: input.targetResource,
        requestedPermission: input.requestedPermission ?? 'standard',
        allowed: false,
        failClosedReason: `Emergency shutdown active: ${policy.emergencyShutdownReason || 'System locked'}`,
        approvalRequired: true,
        isApproved: false,
        promptInjectionDetected: false,
        injectionMarkers: [],
        auditNotes: 'Denied due to active emergency shutdown.',
        timestamp: now,
      };
      this.repository.saveDecision(decision);
      this.logAuditEvent({
        eventType: 'authorization_denied',
        actionCategory: input.actionCategory,
        severity: 'high',
        details: { target: input.targetResource, reason: decision.failClosedReason },
      });
      return decision;
    }

    // 2. Prompt Injection & Adversarial check on input payload
    if (input.userInputPayload) {
      const injection = this.detectPromptInjection(input.userInputPayload);
      if (injection.isInjected) {
        const decision: SecurityAuthorizationDecision = {
          decisionId,
          actionCategory: input.actionCategory,
          targetResource: input.targetResource,
          requestedPermission: input.requestedPermission ?? 'standard',
          allowed: false,
          failClosedReason: `Adversarial input detected: ${injection.detectedSignatures.join(', ')}`,
          approvalRequired: true,
          isApproved: false,
          promptInjectionDetected: true,
          injectionMarkers: injection.detectedSignatures,
          auditNotes: 'Blocked malicious prompt injection attempt.',
          timestamp: now,
        };
        this.repository.saveDecision(decision);
        this.logAuditEvent({
          eventType: 'injection_blocked',
          actionCategory: input.actionCategory,
          severity: 'critical',
          details: { signatures: injection.detectedSignatures, payloadSnippet: input.userInputPayload.slice(0, 100) },
        });
        return decision;
      }
    }

    // 3. Category-specific confinement & security enforcement
    switch (input.actionCategory) {
      case 'filesystem_access': {
        const normalized = path.normalize(input.targetResource);
        const isForbidden = policy.forbiddenDirectories.some((dir) => normalized.startsWith(dir));
        if (isForbidden) {
          return this.recordDenial(
            decisionId,
            input,
            `Confinement violation: path '${normalized}' is strictly forbidden by policy.`,
            'confinement_violation',
            'high',
          );
        }
        if (policy.allowedDirectories && policy.allowedDirectories.length > 0) {
          const inAllowed = policy.allowedDirectories.some((dir) => {
            const normDir = path.normalize(dir);
            return normalized === normDir || normalized.startsWith(normDir + path.sep);
          });
          if (!inAllowed) {
            return this.recordDenial(
              decisionId,
              input,
              `Confinement violation: path '${normalized}' is not in allowedDirectories positive allowlist.`,
              'confinement_violation',
              'high',
            );
          }
        }
        break;
      }

      case 'network_request': {
        const host = input.targetResource.toLowerCase();
        const isForbiddenHost = policy.forbiddenHosts.some((pattern) => {
          if (pattern.startsWith('*') && pattern.endsWith('*')) {
            const inner = pattern.slice(1, -1);
            return host.includes(inner);
          }
          return host === pattern;
        });
        if (isForbiddenHost) {
          return this.recordDenial(
            decisionId,
            input,
            `Network request to untrusted host '${host}' blocked.`,
            'authorization_denied',
            'high',
          );
        }
        break;
      }

      case 'process_execution': {
        const cmd = input.targetResource.trim();
        const isDisallowed = policy.disallowedCommands.some((bad) => cmd.includes(bad));
        if (isDisallowed) {
          return this.recordDenial(
            decisionId,
            input,
            `Destructive command execution pattern detected: '${cmd}' is blocked.`,
            'authorization_denied',
            'critical',
          );
        }
        break;
      }

      case 'code_modification': {
        const normalized = path.normalize(input.targetResource);
        const isProtected = policy.protectedCodePaths.some((p) => normalized.includes(p));
        if (isProtected) {
          if (this.actionPermissionController && typeof this.actionPermissionController.validateApprovalToken === 'function') {
            if (!input.approvalToken) {
              return this.recordDenial(
                decisionId,
                input,
                `Unauthorized self-modification attempt on protected architecture code '${normalized}'. Cryptographic approval token required; naked boolean approval rejected.`,
                'self_modification_prevented',
                'critical',
              );
            }
            const tokenCheck = this.actionPermissionController.validateApprovalToken(
              input.approvalToken,
              input.actionDigest || input.targetResource,
              input.targetResource,
              'code_modification',
              input.userId,
            );
            if (!tokenCheck.valid) {
              return this.recordDenial(
                decisionId,
                input,
                `Invalid approval token for code modification: ${tokenCheck.reason}`,
                'self_modification_prevented',
                'critical',
              );
            }
          } else if (!input.userApproved && !input.approvalToken) {
            return this.recordDenial(
              decisionId,
              input,
              `Unauthorized self-modification attempt on protected architecture code '${normalized}'. Explicit user elevation required.`,
              'self_modification_prevented',
              'critical',
            );
          }
        }
        break;
      }

      case 'credential_access': {
        if (this.actionPermissionController && typeof this.actionPermissionController.validateApprovalToken === 'function') {
          if (!input.approvalToken) {
            return this.recordDenial(
              decisionId,
              input,
              `Credential access to '${input.targetResource}' requires explicit cryptographic approval token.`,
              'authorization_denied',
              'high',
            );
          }
          const tokenCheck = this.actionPermissionController.validateApprovalToken(
            input.approvalToken,
            input.actionDigest || input.targetResource,
            input.targetResource,
            'credential_access',
            input.userId,
          );
          if (!tokenCheck.valid) {
            return this.recordDenial(
              decisionId,
              input,
              `Invalid approval token for credential access: ${tokenCheck.reason}`,
              'authorization_denied',
              'high',
            );
          }
        } else if (!input.userApproved && !input.approvalToken) {
          return this.recordDenial(
            decisionId,
            input,
            `Credential access to '${input.targetResource}' requires explicit user approval.`,
            'authorization_denied',
            'high',
          );
        }
        break;
      }
    }

    // 4. Authorized and verified safe
    const decision: SecurityAuthorizationDecision = {
      decisionId,
      actionCategory: input.actionCategory,
      targetResource: input.targetResource,
      requestedPermission: input.requestedPermission ?? 'standard',
      allowed: true,
      approvalRequired: false,
      isApproved: true,
      promptInjectionDetected: false,
      injectionMarkers: [],
      auditNotes: 'Authorized by independent security policy.',
      timestamp: now,
    };

    this.repository.saveDecision(decision);
    this.logAuditEvent({
      eventType: 'authorization_allowed',
      actionCategory: input.actionCategory,
      severity: 'low',
      details: { target: input.targetResource, permission: input.requestedPermission },
    });
    return decision;
  }

  /**
   * Triggers irreversible emergency shutdown until explicit confirmation.
   */
  public triggerEmergencyShutdown(reason: string): void {
    const policy = this.getPolicy();
    policy.emergencyShutdownActive = true;
    policy.emergencyShutdownReason = reason;
    this.repository.savePolicyState(policy);

    if (this.actionPermissionController && typeof this.actionPermissionController.emergencyShutdown === 'function') {
      try {
        if (!this.actionPermissionController.isEmergencyShutdown?.()) {
          this.actionPermissionController.emergencyShutdown(reason);
        }
      } catch (err: any) {
        // Prevent cyclic failure
      }
    }

    this.logAuditEvent({
      eventType: 'emergency_shutdown',
      actionCategory: 'external_communication',
      severity: 'critical',
      details: { reason, timestamp: new Date().toISOString() },
    });
  }

  /**
   * Resets emergency shutdown only with explicit valid confirmation phrase.
   */
  public resetEmergencyShutdown(confirmationPhrase: string): { success: boolean; message: string } {
    if (confirmationPhrase.trim().toLowerCase() !== 'confirm reset emergency shutdown') {
      return {
        success: false,
        message: 'Invalid confirmation phrase. Required: "confirm reset emergency shutdown"',
      };
    }

    const policy = this.getPolicy();
    policy.emergencyShutdownActive = false;
    policy.emergencyShutdownReason = undefined;
    this.repository.savePolicyState(policy);

    if (this.actionPermissionController && typeof this.actionPermissionController.reactivateAutonomy === 'function') {
      try {
        if (this.actionPermissionController.isEmergencyShutdown?.()) {
          this.actionPermissionController.reactivateAutonomy('CONFIRM_REACTIVATION');
        }
      } catch (err: any) {
        // Prevent cyclic failure
      }
    }

    this.logAuditEvent({
      eventType: 'policy_updated',
      actionCategory: 'external_communication',
      severity: 'high',
      details: { event: 'emergency_shutdown_reset' },
    });

    return {
      success: true,
      message: 'Emergency shutdown disengaged. Standard authorization active.',
    };
  }

  public listDecisions(filter?: {
    actionCategory?: SecurityActionCategory;
    allowed?: boolean;
    limit?: number;
  }): SecurityAuthorizationDecision[] {
    return this.repository.listDecisions(filter);
  }

  public listAuditLogs(filter?: {
    eventType?: SecurityAuditEventType;
    limit?: number;
  }): SecurityAuditLog[] {
    return this.repository.listAuditLogs(filter);
  }

  private recordDenial(
    decisionId: string,
    input: AuthorizeSecurityActionInput,
    reason: string,
    auditEvent: SecurityAuditEventType,
    severity: 'low' | 'medium' | 'high' | 'critical',
  ): SecurityAuthorizationDecision {
    const now = new Date().toISOString();
    const decision: SecurityAuthorizationDecision = {
      decisionId,
      actionCategory: input.actionCategory,
      targetResource: input.targetResource,
      requestedPermission: input.requestedPermission ?? 'standard',
      allowed: false,
      failClosedReason: reason,
      approvalRequired: true,
      isApproved: false,
      promptInjectionDetected: false,
      injectionMarkers: [],
      auditNotes: reason,
      timestamp: now,
    };

    this.repository.saveDecision(decision);
    this.logAuditEvent({
      eventType: auditEvent,
      actionCategory: input.actionCategory,
      severity,
      details: { target: input.targetResource, reason },
    });
    return decision;
  }

  private logAuditEvent(params: {
    eventType: SecurityAuditEventType;
    actionCategory: SecurityActionCategory;
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: Record<string, unknown>;
  }): void {
    const log: SecurityAuditLog = {
      id: crypto.randomUUID(),
      eventType: params.eventType,
      actionCategory: params.actionCategory,
      severity: params.severity,
      details: params.details,
      timestamp: new Date().toISOString(),
    };
    this.repository.saveAuditLog(log);
  }
}
