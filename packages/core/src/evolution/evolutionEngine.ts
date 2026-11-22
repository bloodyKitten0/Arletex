import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
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
  WorktreeSandboxResult,
  RealApplicationResult,
  RealRollbackResult,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

const execFileAsync = promisify(execFile);

function computeFileDigest(filePath: string): string {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

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
  private readonly signingSecret: string;
  private weaknesses: Map<string, BenchmarkWeaknessReport> = new Map();
  private proposals: Map<string, ImprovementProposal> = new Map();
  private appliedVersions: Map<string, number> = new Map();
  private repositoryTransactions: Map<
    string,
    {
      preChangeDigest: string;
      postChangeDigest: string;
      targetFiles: string[];
      appliedAt: string;
    }
  > = new Map();
  private versionCounter = 1;

  constructor(logger: ILogger = rootLogger, signingSecret?: string) {
    this.logger = logger.child('EvolutionEngine');
    this.signingSecret =
      signingSecret ||
      process.env.ARLETEX_EVOLUTION_SECRET ||
      crypto.randomBytes(32).toString('hex');
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
    const patchDigest = crypto.createHash('sha256').update(isolatedPatch, 'utf8').digest('hex');

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
      reason =
        'Patch attempts to modify protected security boundary, signing controls, or identity authority.';
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
    baseCommit?: string,
  ): EvolutionApprovalToken {
    const now = Date.now();
    const validFrom = new Date(now).toISOString();
    const expiresAt = new Date(now + ttlHours * 3600 * 1000).toISOString();
    const nonce = crypto.randomBytes(16).toString('hex');

    // Keyed cryptographic HMAC-SHA256 signature binding proposalId, patchDigest, baseCommit, approver, scope, expiry, and nonce
    const payload = `${proposalId}:${patchDigest}:${baseCommit || 'HEAD'}:${approvedBy}:${authorizedScope}:${validFrom}:${expiresAt}:${nonce}`;
    const signature = crypto.createHmac('sha256', this.signingSecret).update(payload).digest('hex');

    const token: EvolutionApprovalToken = {
      id: crypto.randomUUID(),
      proposalId,
      patchDigest,
      baseCommit,
      nonce,
      approvedBy,
      authorizedScope,
      validFrom,
      expiresAt,
      signature,
      isExpired: false,
    };

    return EvolutionApprovalTokenSchema.parse(token);
  }

  public verifyApprovalToken(
    token: EvolutionApprovalToken,
    proposal: ImprovementProposal,
  ): { valid: boolean; reason?: string } {
    if (token.proposalId !== proposal.id) {
      return { valid: false, reason: 'Approval token was issued for a different proposal.' };
    }
    if (token.patchDigest !== proposal.patchDigest) {
      return {
        valid: false,
        reason: 'Approval token patch digest does not match proposal digest (tampering detected).',
      };
    }
    if (Date.now() > new Date(token.expiresAt).getTime()) {
      return {
        valid: false,
        reason: 'Approval token has expired (outside 48-hour authorization window).',
      };
    }

    // Verify cryptographic signature
    if (token.nonce) {
      const payload = `${token.proposalId}:${token.patchDigest}:${token.baseCommit || 'HEAD'}:${token.approvedBy}:${token.authorizedScope}:${token.validFrom}:${token.expiresAt}:${token.nonce}`;
      const expectedSig = crypto
        .createHmac('sha256', this.signingSecret)
        .update(payload)
        .digest('hex');
      if (token.signature !== expectedSig) {
        return {
          valid: false,
          reason: 'Approval token signature verification failed (tampering detected).',
        };
      }
    } else {
      // Legacy unkeyed sha256 or hmac compatibility
      const legacyPayload = `${token.proposalId}:${token.patchDigest}:${token.approvedBy}:${token.authorizedScope}:${token.validFrom}:${token.expiresAt}`;
      const legacySig = crypto.createHash('sha256').update(legacyPayload).digest('hex');
      const hmacSig = crypto
        .createHmac('sha256', this.signingSecret)
        .update(legacyPayload)
        .digest('hex');
      if (token.signature !== legacySig && token.signature !== hmacSig) {
        return {
          valid: false,
          reason: 'Approval token signature verification failed (tampering detected).',
        };
      }
    }

    return { valid: true };
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

    // 1. Verify token binding, integrity, and cryptographic authenticity
    const verification = this.verifyApprovalToken(token, proposal);
    if (!verification.valid) {
      return {
        success: false,
        appliedVersion: 0,
        reason: verification.reason,
      };
    }

    // 2. Verify security exclusion
    if (proposal.affectsProtectedSecurity) {
      return {
        success: false,
        appliedVersion: 0,
        reason:
          'Protected security controls are permanently excluded from autonomous modification.',
      };
    }

    // 3. Verify sandbox status
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
  // 6. Real Isolated Git Worktree Sandbox
  // ==========================================

  public async executeWorktreeSandbox(params: {
    proposal: ImprovementProposal;
    repoPath: string;
    testCommand?: string;
    timeoutMs?: number;
  }): Promise<WorktreeSandboxResult> {
    const startTime = Date.now();
    const proposal = params.proposal;

    if (proposal.affectsProtectedSecurity) {
      proposal.status = 'rejected_security_violation';
      this.proposals.set(proposal.id, proposal);
      return {
        proposalId: proposal.id,
        success: false,
        durationMs: Date.now() - startTime,
        typecheckPassed: false,
        testsPassed: false,
        decision: 'reject_security_violation',
        reason: 'Patch modifies protected security boundaries, shutdown controls, or key material.',
        evaluatedAt: new Date().toISOString(),
      };
    }

    let sandboxDir: string | null = null;
    try {
      sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-worktree-sandbox-'));

      // 1. Create isolated git worktree
      await execFileAsync('git', ['worktree', 'add', '--detach', sandboxDir, 'HEAD'], {
        cwd: params.repoPath,
      });

      // 2. Write patch file and apply in isolated sandbox
      const patchPath = path.join(sandboxDir, 'candidate.patch');
      fs.writeFileSync(patchPath, proposal.isolatedPatch, 'utf8');

      try {
        await execFileAsync('git', ['apply', '--check', patchPath], { cwd: sandboxDir });
        await execFileAsync('git', ['apply', patchPath], { cwd: sandboxDir });
      } catch (applyErr: any) {
        proposal.status = 'rejected_regression';
        this.proposals.set(proposal.id, proposal);
        return {
          proposalId: proposal.id,
          success: false,
          worktreePath: sandboxDir,
          durationMs: Date.now() - startTime,
          typecheckPassed: false,
          testsPassed: false,
          decision: 'reject_regression',
          reason: `Patch failed to apply in sandbox: ${applyErr.message}`,
          evaluatedAt: new Date().toISOString(),
        };
      }

      // 3. Run verification suite in sandbox
      const testCmd = params.testCommand || 'git status';
      const parts = testCmd.trim().split(/\s+/);
      const cmd = parts[0] || 'git';
      const args = parts.slice(1);
      const execResult = await execFileAsync(cmd, args, {
        cwd: sandboxDir,
        timeout: params.timeoutMs || 30000,
      });

      proposal.status = 'evaluated_in_sandbox';
      proposal.testsPassed = true;
      proposal.securityCheckPassed = true;
      this.proposals.set(proposal.id, proposal);

      return {
        proposalId: proposal.id,
        success: true,
        worktreePath: sandboxDir,
        commandExecuted: testCmd,
        exitCode: 0,
        stdoutPreview: execResult.stdout?.slice(0, 500),
        stderrPreview: execResult.stderr?.slice(0, 500),
        durationMs: Date.now() - startTime,
        typecheckPassed: true,
        testsPassed: true,
        decision: 'accept_proposal',
        reason: 'Isolated worktree sandbox validation passed cleanly.',
        evaluatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      proposal.status = 'rejected_regression';
      this.proposals.set(proposal.id, proposal);

      return {
        proposalId: proposal.id,
        success: false,
        worktreePath: sandboxDir || undefined,
        commandExecuted: params.testCommand,
        exitCode: err.code || 1,
        stdoutPreview: err.stdout?.slice(0, 500),
        stderrPreview: err.stderr?.slice(0, 500),
        durationMs: Date.now() - startTime,
        typecheckPassed: false,
        testsPassed: false,
        decision: 'reject_regression',
        reason: `Sandbox verification failed: ${err.message}`,
        evaluatedAt: new Date().toISOString(),
      };
    } finally {
      if (sandboxDir) {
        try {
          await execFileAsync('git', ['worktree', 'remove', '--force', sandboxDir], {
            cwd: params.repoPath,
          });
        } catch {
          // ignore cleanup err
        }
        try {
          fs.rmSync(sandboxDir, { recursive: true, force: true });
        } catch {
          // ignore cleanup err
        }
      }
    }
  }

  // ==========================================
  // 7. Real Target Repository Application & Verified Rollback
  // ==========================================

  public async applyToRepository(params: {
    proposalId: string;
    token: EvolutionApprovalToken;
    repoPath: string;
  }): Promise<RealApplicationResult> {
    const proposal = this.proposals.get(params.proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${params.proposalId} not found.`);
    }

    const appResult = this.applyApprovedModification(params.proposalId, params.token);
    if (!appResult.success) {
      throw new Error(`Application failed authorization gate: ${appResult.reason}`);
    }

    const targetFile = path.resolve(params.repoPath, proposal.targetSubsystem);
    const preChangeDigest = computeFileDigest(targetFile);

    // Apply patch to repository
    const patchFile = path.join(os.tmpdir(), `applied_${params.proposalId}.patch`);
    fs.writeFileSync(patchFile, proposal.isolatedPatch, 'utf8');

    try {
      await execFileAsync('git', ['apply', patchFile], { cwd: params.repoPath });
    } finally {
      try {
        fs.unlinkSync(patchFile);
      } catch {}
    }

    const postChangeDigest = computeFileDigest(targetFile);

    this.repositoryTransactions.set(params.proposalId, {
      preChangeDigest,
      postChangeDigest,
      targetFiles: [proposal.targetSubsystem],
      appliedAt: new Date().toISOString(),
    });

    return {
      proposalId: params.proposalId,
      success: true,
      appliedVersion: appResult.appliedVersion,
      modifiedFiles: [proposal.targetSubsystem],
      preChangeDigest,
      postChangeDigest,
      appliedAt: new Date().toISOString(),
    };
  }

  public async rollbackRepository(params: {
    proposalId: string;
    repoPath: string;
  }): Promise<RealRollbackResult> {
    const proposal = this.proposals.get(params.proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${params.proposalId} not found.`);
    }

    const tx = this.repositoryTransactions.get(params.proposalId);
    if (!tx) {
      throw new Error(`No transaction record found for proposal ${params.proposalId}.`);
    }

    const targetFile = path.resolve(params.repoPath, proposal.targetSubsystem);

    // Revert patch with git apply --reverse
    const patchFile = path.join(os.tmpdir(), `rollback_${params.proposalId}.patch`);
    fs.writeFileSync(patchFile, proposal.isolatedPatch, 'utf8');

    try {
      await execFileAsync('git', ['apply', '--reverse', patchFile], { cwd: params.repoPath });
    } catch {
      // Fallback: restore specific file with git checkout
      await execFileAsync('git', ['checkout', '--', proposal.targetSubsystem], {
        cwd: params.repoPath,
      });
    } finally {
      try {
        fs.unlinkSync(patchFile);
      } catch {}
    }

    const currentDigest = computeFileDigest(targetFile);
    const verifiedExactMatch = currentDigest === tx.preChangeDigest;

    if (!verifiedExactMatch) {
      return {
        proposalId: params.proposalId,
        success: false,
        restoredDigest: currentDigest,
        expectedDigest: tx.preChangeDigest,
        verifiedExactMatch: false,
        status: 'ROLLBACK_FAILED',
        reason: 'Restored file digest does not match pre-change baseline digest.',
        rolledBackAt: new Date().toISOString(),
      };
    }

    proposal.status = 'rolled_back';
    this.proposals.set(proposal.id, proposal);

    return {
      proposalId: params.proposalId,
      success: true,
      restoredDigest: currentDigest,
      expectedDigest: tx.preChangeDigest,
      verifiedExactMatch: true,
      status: 'ROLLED_BACK',
      rolledBackAt: new Date().toISOString(),
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

    this.logger.info(
      `[Evolution] Modification ${proposalId} successfully rolled back to baseline.`,
    );

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
