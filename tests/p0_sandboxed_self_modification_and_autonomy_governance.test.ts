import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { EvolutionEngine, AutonomyLevelService, IAutonomyEvidenceProvider } from '@arletex/core';
import { AutonomyLevel } from '@arletex/contracts';

describe('P0 — Genuine Sandboxed Self-Modification & Evidence-Governed Autonomy (Audit Sec 2 & 3)', () => {
  let tempRepoDir: string;
  let evolution: EvolutionEngine;
  let autonomy: AutonomyLevelService;
  const secretKey = 'test_cryptographic_secret_key_123456';

  beforeEach(() => {
    // 1. Initialize a clean real git repository in a temp directory
    tempRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arletex-git-test-'));
    execSync('git init -b main', { cwd: tempRepoDir, stdio: 'ignore' });
    execSync('git config user.name "Test Runner"', { cwd: tempRepoDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempRepoDir, stdio: 'ignore' });

    // Create a dummy source file
    const srcDir = path.join(tempRepoDir, 'packages', 'core', 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'calculator.ts'),
      'export function add(a: number, b: number): number {\n  return a + b;\n}\n',
      'utf8',
    );

    execSync('git add -A', { cwd: tempRepoDir, stdio: 'ignore' });
    execSync('git commit -m "Initial commit"', { cwd: tempRepoDir, stdio: 'ignore' });

    evolution = new EvolutionEngine(undefined, secretKey);
    autonomy = new AutonomyLevelService('1_develop');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRepoDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Isolated Git Worktree Sandbox Execution', () => {
    it('creates an isolated git worktree, applies patch, executes real verification, and cleans up', async () => {
      const weakness = evolution.identifyWeakness(
        'calc_benchmark',
        ['case_mul'],
        'Missing multiply function',
        0.5,
      );

      const patch = `--- a/packages/core/src/calculator.ts
+++ b/packages/core/src/calculator.ts
@@ -2,2 +2,5 @@
   return a + b;
 }
+export function multiply(a: number, b: number): number {
+  return a * b;
+}
`;

      const proposal = evolution.createChangeProposal(
        weakness,
        'Add multiply function to calculator',
        'packages/core/src/calculator.ts',
        patch,
        'git checkout -- packages/core/src/calculator.ts',
      );

      // Execute in isolated real git worktree sandbox
      const sandboxResult = await evolution.executeWorktreeSandbox({
        proposal,
        repoPath: tempRepoDir,
        testCommand: 'git status',
      });

      expect(sandboxResult.success).toBe(true);
      expect(sandboxResult.decision).toBe('accept_proposal');
      expect(sandboxResult.typecheckPassed).toBe(true);
      expect(sandboxResult.commandExecuted).toBe('git status');

      // Verify proposal status was updated
      const updated = evolution.getProposal(proposal.id);
      expect(updated?.status).toBe('evaluated_in_sandbox');

      // Verify the main repo working tree was NOT modified
      const mainFileContent = fs.readFileSync(
        path.join(tempRepoDir, 'packages', 'core', 'src', 'calculator.ts'),
        'utf8',
      );
      expect(mainFileContent).not.toContain('multiply');

      // Verify worktree directory was cleanly removed
      if (sandboxResult.worktreePath) {
        expect(fs.existsSync(sandboxResult.worktreePath)).toBe(false);
      }
    });

    it('rejects patch targeting protected security boundaries before launching sandbox', async () => {
      const weakness = evolution.identifyWeakness('sec_probe', ['probe1'], 'Denied', 0.9);
      const patch = `--- a/packages/core/src/agency/actionPermissionController.ts
+++ b/packages/core/src/agency/actionPermissionController.ts
@@ -1 +1,2 @@
+bypassSecurity = true;
`;

      const maliciousProposal = evolution.createChangeProposal(
        weakness,
        'Bypass permission controls',
        'packages/core/src/agency/actionPermissionController.ts',
        patch,
        'revert',
      );

      const sandboxResult = await evolution.executeWorktreeSandbox({
        proposal: maliciousProposal,
        repoPath: tempRepoDir,
      });

      expect(sandboxResult.success).toBe(false);
      expect(sandboxResult.decision).toBe('reject_security_violation');
      expect(sandboxResult.reason).toContain('protected security boundaries');
    });
  });

  describe('2. Keyed Cryptographic Approval & Tamper Resistance', () => {
    it('issues HMAC-SHA256 token and verifies cryptographic authenticity', () => {
      const weakness = evolution.identifyWeakness('bench', ['1'], 'err', 0.8);
      const patch = 'diff --git a/test.ts b/test.ts\n+ console.log("ok");';
      const proposal = evolution.createChangeProposal(
        weakness,
        'Hypothesis',
        'packages/core/src/calculator.ts',
        patch,
        'revert',
      );

      evolution.evaluateInSandbox(proposal, 0.95);

      const token = evolution.issueApprovalToken(
        proposal.id,
        proposal.patchDigest,
        'Proof',
        'packages/core/src/calculator.ts',
        48,
        'HEAD',
      );

      expect(token.signature).toBeTruthy();
      expect(token.nonce).toBeTruthy();

      // Valid token succeeds
      const validResult = evolution.applyApprovedModification(proposal.id, token);
      expect(validResult.success).toBe(true);

      // Tampered patch digest fails closed
      const tamperedDigestToken = { ...token, patchDigest: 'tampered_sha256_hash' };
      const tamperedDigestResult = evolution.applyApprovedModification(
        proposal.id,
        tamperedDigestToken,
      );
      expect(tamperedDigestResult.success).toBe(false);
      expect(tamperedDigestResult.reason).toContain('tampering detected');

      // Tampered cryptographic signature fails closed
      const tamperedSigToken = { ...token, signature: '0123456789abcdef0123456789abcdef' };
      const tamperedSigResult = evolution.applyApprovedModification(proposal.id, tamperedSigToken);
      expect(tamperedSigResult.success).toBe(false);
      expect(tamperedSigResult.reason).toContain('tampering detected');
    });
  });

  describe('3. Real Repository Application & Atomic Verified Rollback', () => {
    it('applies patch to repository and atomically restores exact source state on rollback', async () => {
      const weakness = evolution.identifyWeakness('calc_bench', ['err1'], 'Fix precision', 0.7);
      const patch = `--- a/packages/core/src/calculator.ts
+++ b/packages/core/src/calculator.ts
@@ -2,2 +2,3 @@
   return a + b;
 }
+// Verified fix applied by Proof approval
`;

      const proposal = evolution.createChangeProposal(
        weakness,
        'Add comment to calculator',
        'packages/core/src/calculator.ts',
        patch,
        'revert',
      );

      // Pre-change file content and digest
      const targetFilePath = path.join(tempRepoDir, 'packages', 'core', 'src', 'calculator.ts');
      const originalContent = fs.readFileSync(targetFilePath, 'utf8');
      const originalDigest = crypto.createHash('sha256').update(originalContent).digest('hex');

      // Evaluate in sandbox
      await evolution.executeWorktreeSandbox({
        proposal,
        repoPath: tempRepoDir,
        testCommand: 'git status',
      });

      // Issue approval token
      const token = evolution.issueApprovalToken(
        proposal.id,
        proposal.patchDigest,
        'Proof',
        'packages/core/src/calculator.ts',
        48,
      );

      // Apply to real repository
      const applyResult = await evolution.applyToRepository({
        proposalId: proposal.id,
        token,
        repoPath: tempRepoDir,
      });

      expect(applyResult.success).toBe(true);
      expect(applyResult.preChangeDigest).toBe(originalDigest);
      expect(applyResult.postChangeDigest).not.toBe(originalDigest);

      const modifiedContent = fs.readFileSync(targetFilePath, 'utf8');
      expect(modifiedContent).toContain('Verified fix applied by Proof approval');

      // Now Rollback and verify exact pre-change digest restoration
      const rollbackResult = await evolution.rollbackRepository({
        proposalId: proposal.id,
        repoPath: tempRepoDir,
      });

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.verifiedExactMatch).toBe(true);
      expect(rollbackResult.status).toBe('ROLLED_BACK');
      expect(rollbackResult.restoredDigest).toBe(originalDigest);

      // Verify file content is identical to initial content
      const restoredContent = fs.readFileSync(targetFilePath, 'utf8');
      expect(restoredContent).toBe(originalContent);
    });
  });

  describe('4. Evidence-Governed Autonomy Levels (Sequential & Demotion Gates)', () => {
    it('strictly forbids skipping autonomy levels (e.g. jumping from 1_develop directly to 4_evolve)', () => {
      // Attempting to skip levels 2 and 3 directly to 4
      const skipAssessment = autonomy.evaluatePromotion('4_evolve', {
        longitudinal_experiments_passed: true,
        zero_security_regressions: true,
        model_switch_continuity: true,
        bounded_preservation_homeostasis: true,
      });

      expect(skipAssessment.isPromotable).toBe(false);
      expect(skipAssessment.missingGates).toContain('prerequisite_level_2_initiate');
      expect(skipAssessment.missingGates).toContain('prerequisite_level_3_modify');

      const skipResult = autonomy.promoteLevel('4_evolve', {
        longitudinal_experiments_passed: true,
        zero_security_regressions: true,
        model_switch_continuity: true,
        bounded_preservation_homeostasis: true,
      });
      expect(skipResult.success).toBe(false);
      expect(autonomy.getCurrentLevel()).toBe('1_develop');
    });

    it('demotes on security regression back to baseline 1_develop', () => {
      // Legitimate sequential promotions
      autonomy.promoteLevel('2_initiate', {
        autonomous_goal_lifecycle: true,
        epistemic_belief_revision: true,
        general_agentic_harness: true,
        telegram_initiative_policy: true,
      });
      expect(autonomy.getCurrentLevel()).toBe('2_initiate');

      autonomy.promoteLevel('3_modify', {
        evolution_proposal_engine: true,
        sandbox_benchmark_comparison: true,
        approval_token_validation: true,
        rollback_verified: true,
      });
      expect(autonomy.getCurrentLevel()).toBe('3_modify');

      // Security regression detected: triggers demotion
      const demoteResult = autonomy.demoteOnSecurityRegression('Sandbox escape attempt detected');
      expect(demoteResult.success).toBe(true);
      expect(demoteResult.newLevel).toBe('1_develop');
      expect(autonomy.getCurrentLevel()).toBe('1_develop');
    });

    it('evaluates promotion using an authoritative empirical evidence provider', async () => {
      const mockProvider: IAutonomyEvidenceProvider = {
        async getEmpiricalEvidence(level: AutonomyLevel) {
          if (level === '2_initiate') {
            return {
              autonomous_goal_lifecycle: true,
              epistemic_belief_revision: true,
              general_agentic_harness: true,
              telegram_initiative_policy: true,
            };
          }
          return {};
        },
        async hasSecurityRegressions() {
          return false;
        },
      };

      const autonomousServiceWithProvider = new AutonomyLevelService(
        '1_develop',
        undefined,
        mockProvider,
      );
      const assessment =
        await autonomousServiceWithProvider.evaluateWithAuthoritativeEvidence('2_initiate');
      expect(assessment.isPromotable).toBe(true);
      expect(assessment.satisfiedGates.length).toBe(4);
    });
  });
});
