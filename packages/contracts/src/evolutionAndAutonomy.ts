import { z } from 'zod';

export const AutonomyLevelSchema = z.enum(['1_develop', '2_initiate', '3_modify', '4_evolve']);
export type AutonomyLevel = z.infer<typeof AutonomyLevelSchema>;

export const AutonomyLevelDefinitionSchema = z.object({
  level: AutonomyLevelSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  permittedCapabilities: z.array(z.string()),
  prohibitedOperations: z.array(z.string()),
  requiredGateCriteria: z.array(z.string()),
});
export type AutonomyLevelDefinition = z.infer<typeof AutonomyLevelDefinitionSchema>;

export const AutonomyPromotionAssessmentSchema = z.object({
  currentLevel: AutonomyLevelSchema,
  targetLevel: AutonomyLevelSchema,
  isPromotable: z.boolean(),
  satisfiedGates: z.array(z.string()),
  missingGates: z.array(z.string()),
  supportingEvidence: z.record(z.unknown()),
  cannotSelfPromoteWithoutEvidence: z.literal(true), // Invariant: system cannot promote itself by editing its own score
  evaluatedAt: z.string(),
});
export type AutonomyPromotionAssessment = z.infer<typeof AutonomyPromotionAssessmentSchema>;

export const BenchmarkWeaknessReportSchema = z.object({
  id: z.string(),
  benchmarkName: z.string().min(1),
  failingCasesCount: z.number().int().nonnegative(),
  errorPattern: z.string().min(1),
  baselineScore: z.number().min(0.0).max(1.0),
  sampleEvidence: z.array(z.string()),
  detectedAt: z.string(),
});
export type BenchmarkWeaknessReport = z.infer<typeof BenchmarkWeaknessReportSchema>;

export const ImprovementProposalStatusSchema = z.enum([
  'proposed',
  'evaluated_in_sandbox',
  'rejected_regression',
  'rejected_security_violation',
  'approved_pending',
  'applied',
  'rolled_back',
]);
export type ImprovementProposalStatus = z.infer<typeof ImprovementProposalStatusSchema>;

export const ImprovementProposalSchema = z.object({
  id: z.string(),
  weaknessReportId: z.string(),
  title: z.string().min(1),
  hypothesis: z.string().min(1),
  targetSubsystem: z.string().min(1),
  isolatedPatch: z.string().min(1),
  patchDigest: z.string().min(1),
  affectsProtectedSecurity: z.boolean(),
  status: ImprovementProposalStatusSchema.default('proposed'),
  baselineBenchmarkScore: z.number().min(0.0).max(1.0),
  candidateBenchmarkScore: z.number().min(0.0).max(1.0).optional(),
  testsPassed: z.boolean().optional(),
  securityCheckPassed: z.boolean().optional(),
  rollbackInstructions: z.string().min(1),
  createdAt: z.string(),
});
export type ImprovementProposal = z.infer<typeof ImprovementProposalSchema>;

export const EvolutionApprovalTokenSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  patchDigest: z.string(),
  baseCommit: z.string().optional(),
  nonce: z.string().optional(),
  approvedBy: z.string(),
  authorizedScope: z.string(),
  validFrom: z.string(),
  expiresAt: z.string(),
  signature: z.string(),
  isExpired: z.boolean().default(false),
});
export type EvolutionApprovalToken = z.infer<typeof EvolutionApprovalTokenSchema>;

export const SandboxEvaluationResultSchema = z.object({
  proposalId: z.string(),
  typecheckSuccess: z.boolean(),
  unitTestsPassed: z.boolean(),
  securityBoundaryPreserved: z.boolean(),
  scoreDelta: z.number(),
  decision: z.enum(['accept_proposal', 'reject_regression', 'reject_security_violation']),
  reason: z.string(),
  evaluatedAt: z.string(),
});
export type SandboxEvaluationResult = z.infer<typeof SandboxEvaluationResultSchema>;

export const WorktreeSandboxResultSchema = z.object({
  proposalId: z.string(),
  success: z.boolean(),
  worktreePath: z.string().optional(),
  commandExecuted: z.string().optional(),
  exitCode: z.number().optional(),
  stdoutPreview: z.string().optional(),
  stderrPreview: z.string().optional(),
  durationMs: z.number(),
  typecheckPassed: z.boolean(),
  testsPassed: z.boolean(),
  decision: z.enum([
    'accept_proposal',
    'reject_regression',
    'reject_security_violation',
    'sandbox_error',
  ]),
  reason: z.string(),
  evaluatedAt: z.string(),
});
export type WorktreeSandboxResult = z.infer<typeof WorktreeSandboxResultSchema>;

export const RealApplicationResultSchema = z.object({
  proposalId: z.string(),
  success: z.boolean(),
  appliedVersion: z.number(),
  baseCommit: z.string().optional(),
  modifiedFiles: z.array(z.string()).default([]),
  preChangeDigest: z.string(),
  postChangeDigest: z.string(),
  reason: z.string().optional(),
  appliedAt: z.string(),
});
export type RealApplicationResult = z.infer<typeof RealApplicationResultSchema>;

export const RealRollbackResultSchema = z.object({
  proposalId: z.string(),
  success: z.boolean(),
  restoredDigest: z.string(),
  expectedDigest: z.string(),
  verifiedExactMatch: z.boolean(),
  status: z.enum(['ROLLED_BACK', 'ROLLBACK_FAILED']),
  reason: z.string().optional(),
  rolledBackAt: z.string(),
});
export type RealRollbackResult = z.infer<typeof RealRollbackResultSchema>;

export const EvolutionRollbackResultSchema = z.object({
  proposalId: z.string(),
  success: z.boolean(),
  restoredBaselineDigest: z.string(),
  rolledBackAt: z.string(),
});
export type EvolutionRollbackResult = z.infer<typeof EvolutionRollbackResultSchema>;
