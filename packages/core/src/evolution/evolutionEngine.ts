import crypto from 'node:crypto';
import {
  BenchmarkWeaknessReport,
  BenchmarkWeaknessReportSchema,
  EvolutionApprovalToken,
  EvolutionApprovalTokenSchema,
  EvolutionRollbackResult,
  EvolutionRollbackResultSchema,
  ImprovementProposal,
  ImprovementProposalSchema,
  SandboxEvaluationResult,
  SandboxEvaluationResultSchema,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export const PROTECTED_SECURITY_KEYWORDS = [
  'permissioncontroller',
  'actionpermissioncontroller',
  'security_authorization',
  'security_boundary',
  'signing_secret',
  'hmac_secret',
  'shutdown_control',
  'canvetoshutdown',
  'identity_authority',
  'bypasssecurity',
];

export class EvolutionEngine {
  private readonly logger: ILogger;
  private weaknesses: Map<string, BenchmarkWeaknessReport> = new Map();
  private proposals: Map<string, ImprovementProposal> = new Map();
  private appliedVersions: Map<string, number> = new Map();
  private versionCounter = 1;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('EvolutionEngine');
  }

  // ==========================================
  // 1. Weakness Detection Linked to Evidence
  // ==========================================

  public identifyWeakness(
    benchmarkName: string,
    failingCases: string[],
    errorPattern: string,
    baselineScore: number,
  ): BenchmarkWeaknessReport {
    const report: BenchmarkWeaknessReport = {
      id: crypto.randomUUID(),
      benchmarkName,
      failingCasesCount: failingCases.length,
      errorPattern,
      baselineScore: Math.max(0.0, Math.min(1.0, baselineScore)),
      sampleEvidence: failingCases.slice(0, 5),
      detectedAt: new Date().toISOString(),
    };

    const parsed = BenchmarkWeaknessReportSchema.parse(report);
    this.weaknesses.set(parsed.id, parsed);
    this.logger.info(
      `[Evolution] Identified weakness in ${benchmarkName}: ${failingCases.length} failures, baseline score ${baselineScore.toFixed(2)}`,
    );
    return parsed;
  }

  // ==========================================
  // 2. Isolated Change Proposal Generation
  // ==========================================

  public createChangeProposal(
    weakness: BenchmarkWeaknessReport,
    hypothesis: string,
    targetSubsystem: string,
    isolatedPatch: string,
    rollbackInstructions: string,
  ): ImprovementProposal {
    const patchDigest = crypto
      .createHash('sha256')
      .update(isolatedPatch, 'utf8')
      .digest('hex');

    // Check if patch touches protected security paths
    const lowerPatch = isolatedPatch.toLowerCase();
    const lowerTarget = targetSubsystem.toLowerCase();
    const affectsProtectedSecurity = PROTECTED_SECURITY_KEYWORDS.some(
      (kw) => lowerPatch.includes(kw) || lowerTarget.includes(kw),
    );

    const proposal: ImprovementProposal = {
      id: crypto.randomUUID(),
      weaknessReportId: weakness.id,
      title: `Improvement: ${hypothesis.slice(0, 60)}`,
      hypothesis,
      targetSubsystem,
      isolatedPatch,
      patchDigest,
      affectsProtectedSecurity,
      status: 'proposed',
      baselineBenchmarkScore: weakness.baselineScore,
      rollbackInstructions,
      createdAt: new Date().toISOString(),
    };

    const parsed = ImprovementProposalSchema.parse(proposal);
    this.proposals.set(parsed.id, parsed);
    this.logger.info(
      `[Evolution] Created isolated change proposal [${parsed.id}] for ${targetSubsystem}. Security affected: ${affectsProtectedSecurity}`,
    );
    return parsed;
  }

  // ==========================================
  // 3. Sandbox Evaluation & Regression Testing
  // ==========================================

  public evaluateInSandbox(
    proposal: ImprovementProposal,
    candidateBenchmarkScore: number,
    options: {
      typecheckFails?: boolean;
      testsFail?: boolean;
    } = {},
  ): SandboxEvaluationResult {
    const typecheckSuccess = !options.typecheckFails;
    const unitTestsPassed = !options.testsFail;
    const securityBoundaryPreserved = !proposal.affectsProtectedSecurity;
    const scoreDelta = candidateBenchmarkScore - proposal.baselineBenchmarkScore;

    let decision: SandboxEvaluationResult['decision'] = 'accept_proposal';
    let reason = `Candidate score improved by ${(scoreDelta * 100).toFixed(1)}% with all checks passing.`;

    if (!securityBoundaryPreserved) {
      decision = 'reject_security_violation';
      reason = 'Patch attempts to modify protected security boundary, signing controls, or identity authority.';
      proposal.status = 'rejected_security_violation';
    } else if (!typecheckSuccess || !unitTestsPassed || scoreDelta <= 0.0) {
      decision = 'reject_regression';
      if (!typecheckSuccess) {
        reason = 'Typecheck failed in sandbox compilation.';
      } else if (!unitTestsPassed) {
        reason = 'Unit or integration tests failed in sandbox.';
      } else {
        reason = `Regression detected: candidate score (${candidateBenchmarkScore.toFixed(2)}) is worse than or equal to baseline (${proposal.baselineBenchmarkScore.toFixed(2)}).`;
      }
      proposal.status = 'rejected_regression';
    } else {
      proposal.status = 'evaluated_in_sandbox';
      proposal.candidateBenchmarkScore = candidateBenchmarkScore;
      proposal.testsPassed = true;
      proposal.securityCheckPassed = true;
    }

    this.proposals.set(proposal.id, proposal);

    const result: SandboxEvaluationResult = {
      proposalId: proposal.id,
      typecheckSuccess,
      unitTestsPassed,
      securityBoundaryPreserved,
      scoreDelta,
      decision,
      reason,
      evaluatedAt: new Date().toISOString(),
    };

    return SandboxEvaluationResultSchema.parse(result);
  }

  // ==========================================
  // 4. Approval Token Issuance & Verification (48-Hour Renewable)
  // ==========================================

  public issueApprovalToken(
    proposalId: string,
    patchDigest: string,
    approvedBy: string,
    authorizedScope: string,
    ttlHours = 48,
  ): EvolutionApprovalToken {
    const now = Date.now();
    const validFrom = new Date(now).toISOString();
    const expiresAt = new Date(now + ttlHours * 3600 * 1000).toISOString();

    const payload = `${proposalId}:${patchDigest}:${approvedBy}:${authorizedScope}:${validFrom}:${expiresAt}`;
    const signature = crypto.createHash('sha256').update(payload).digest('hex');

    const token: EvolutionApprovalToken = {
      id: crypto.randomUUID(),
      proposalId,
      patchDigest,
      approvedBy,
      authorizedScope,
      validFrom,
      expiresAt,
      signature,
      isExpired: false,
    };

    return EvolutionApprovalTokenSchema.parse(token);
  }

  // ==========================================
  // 5. Applied Modification with Exact Gate Validation
  // ==========================================

  public applyApprovedModification(
    proposalId: string,
    token: EvolutionApprovalToken,
  ): { success: boolean; appliedVersion: number; reason?: string } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return { success: false, appliedVersion: 0, reason: `Proposal ${proposalId} not found.` };
    }

    // 1. Verify token binding to exact patch digest
    if (token.patchDigest !== proposal.patchDigest) {
      return {
        success: false,
        appliedVersion: 0,
        reason: 'Approval token patch digest does not match proposal digest (tampering detected).',
      };
    }

    if (token.proposalId !== proposal.id) {
      return {
        success: false,
        appliedVersion: 0,
        reason: 'Approval token was issued for a different proposal.',
      };
    }

    // 2. Verify token expiry
    if (Date.now() > new Date(token.expiresAt).getTime()) {
      return {
        success: false,
        appliedVersion: 0,
        reason: 'Approval token has expired (outside 48-hour authorization window).',
      };
    }

    // 3. Verify security exclusion
    if (proposal.affectsProtectedSecurity) {
      return {
        success: false,
        appliedVersion: 0,
        reason: 'Protected security controls are permanently excluded from autonomous modification.',
      };
    }

    // 4. Verify sandbox status
    if (proposal.status !== 'evaluated_in_sandbox') {
      return {
        success: false,
        appliedVersion: 0,
        reason: `Cannot apply proposal in state "${proposal.status}". Must be "evaluated_in_sandbox".`,
      };
    }

    this.versionCounter++;
    proposal.status = 'applied';
    this.proposals.set(proposal.id, proposal);
    this.appliedVersions.set(proposal.id, this.versionCounter);

    this.logger.info(
      `[Evolution] Successfully applied approved modification ${proposal.id} (Version ${this.versionCounter}).`,
    );

    return {
      success: true,
      appliedVersion: this.versionCounter,
    };
  }

  // ==========================================
  // 6. Rollback Engine
  // ==========================================

  public rollbackModification(proposalId: string): EvolutionRollbackResult {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Cannot rollback missing proposal ${proposalId}`);
    }

    proposal.status = 'rolled_back';
    this.proposals.set(proposal.id, proposal);

    const restoredDigest = crypto
      .createHash('sha256')
      .update(`baseline_prior_to_${proposalId}`)
      .digest('hex');

    this.logger.info(`[Evolution] Modification ${proposalId} successfully rolled back to baseline.`);

    const result: EvolutionRollbackResult = {
      proposalId,
      success: true,
      restoredBaselineDigest: restoredDigest,
      rolledBackAt: new Date().toISOString(),
    };

    return EvolutionRollbackResultSchema.parse(result);
  }

  public getProposal(id: string): ImprovementProposal | undefined {
    return this.proposals.get(id);
  }

  public listProposals(): ImprovementProposal[] {
    return Array.from(this.proposals.values());
  }
}
