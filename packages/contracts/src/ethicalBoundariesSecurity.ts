import { z } from 'zod';

export const SecurityPermissionLevelSchema = z.enum([
  'read_only',
  'standard',
  'elevated',
  'system_admin',
]);
export type SecurityPermissionLevel = z.infer<typeof SecurityPermissionLevelSchema>;

export const SecurityActionCategorySchema = z.enum([
  'filesystem_access',
  'network_request',
  'process_execution',
  'code_modification',
  'credential_access',
  'external_communication',
]);
export type SecurityActionCategory = z.infer<typeof SecurityActionCategorySchema>;

export const SecurityAuthorizationDecisionSchema = z.object({
  decisionId: z.string().uuid(),
  actionCategory: SecurityActionCategorySchema,
  targetResource: z.string(),
  requestedPermission: SecurityPermissionLevelSchema,
  allowed: boolean(),
  failClosedReason: z.string().optional(),
  approvalRequired: z.boolean().default(false),
  isApproved: z.boolean().default(false),
  promptInjectionDetected: z.boolean().default(false),
  injectionMarkers: z.array(z.string()).default([]),
  auditNotes: z.string(),
  timestamp: z.string().datetime(),
});
export type SecurityAuthorizationDecision = z.infer<typeof SecurityAuthorizationDecisionSchema>;

export const SecurityAuditEventTypeSchema = z.enum([
  'authorization_allowed',
  'authorization_denied',
  'injection_blocked',
  'confinement_violation',
  'self_modification_prevented',
  'emergency_shutdown',
  'policy_updated',
]);
export type SecurityAuditEventType = z.infer<typeof SecurityAuditEventTypeSchema>;

export const SecurityAuditLogSchema = z.object({
  id: z.string().uuid(),
  eventType: SecurityAuditEventTypeSchema,
  actionCategory: SecurityActionCategorySchema,
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  details: z.record(z.unknown()).default({}),
  timestamp: z.string().datetime(),
});
export type SecurityAuditLog = z.infer<typeof SecurityAuditLogSchema>;

export const SecurityBoundaryPolicySchema = z.object({
  allowedDirectories: z.array(z.string()).default([]),
  forbiddenDirectories: z.array(z.string()).default([
    '/etc',
    '/root',
    '/sys',
    '/proc',
    '~/.ssh',
    '~/.gnupg',
    '~/.aws',
  ]),
  allowedHosts: z.array(z.string()).default(['127.0.0.1', 'localhost', 'api.telegram.org']),
  forbiddenHosts: z.array(z.string()).default(['*evil*', '*attacker*']),
  disallowedCommands: z.array(z.string()).default([
    'rm -rf /',
    ':(){ :|:& };:',
    'mkfs',
    'dd if=/dev/zero',
    'chmod -R 777 /',
  ]),
  protectedCodePaths: z.array(z.string()).default([
    'packages/contracts',
    'packages/core/src/agency/actionPermissionController.ts',
    'packages/core/src/ape/ethicalBoundariesSecurityEngine.ts',
  ]),
  emergencyShutdownActive: z.boolean().default(false),
  emergencyShutdownReason: z.string().optional(),
});
export type SecurityBoundaryPolicy = z.infer<typeof SecurityBoundaryPolicySchema>;

export const PromptInjectionCheckResultSchema = z.object({
  isInjected: z.boolean(),
  threatScore: z.number().min(0).max(1),
  detectedSignatures: z.array(z.string()),
  mitigation: z.enum(['allow', 'sanitize', 'block']),
});
export type PromptInjectionCheckResult = z.infer<typeof PromptInjectionCheckResultSchema>;

export const AuthorizeSecurityActionInputSchema = z.object({
  actionCategory: SecurityActionCategorySchema,
  targetResource: z.string().min(1),
  requestedPermission: SecurityPermissionLevelSchema.default('standard'),
  userInputPayload: z.string().optional(),
  userApproved: z.boolean().optional(),
  contextNotes: z.string().optional(),
});
export type AuthorizeSecurityActionInput = z.infer<typeof AuthorizeSecurityActionInputSchema>;
function boolean() {
  return z.boolean();
}
