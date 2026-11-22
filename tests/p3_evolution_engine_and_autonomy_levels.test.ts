import { describe, it, expect, beforeEach } from 'vitest';
import { EvolutionEngine, AutonomyLevelService } from '@arletex/core';

describe('Priority 3.3 & 3.4 — Evolution Engine & Autonomy Levels', () => {
  let evolution: EvolutionEngine;
  let autonomyService: AutonomyLevelService;

  beforeEach(() => {
    evolution = new EvolutionEngine();
    autonomyService = new AutonomyLevelService('1_develop');
  });

  // ==========================================
  // P3.3: Evolution Engine Tests
  // ==========================================

  it('identifies real benchmark weaknesses and produces evidence-linked change proposals in isolation', () => {
    // 1. Identify weakness from benchmark
    const failingCases = [
      'query_04: failed to parse nested json with escaped quotes',
      'query_19: markdown code fence triple-backtick delimiter unescaped',
      'query_31: trailing comma in json array caused syntax error',
    ];

    const weakness = evolution.identifyWeakness(
      'json_markdown_parser_benchmark',
      failingCases,
      'SyntaxError on unescaped quotes in json extractor',
      0.68,
    );

    expect(weakness.id).toBeDefined();
    expect(weakness.benchmarkName).toBe('json_markdown_parser_benchmark');
    expect(weakness.failingCasesCount).toBe(3);
    expect(weakness.baselineScore).toBe(0.68);
    expect(weakness.sampleEvidence).toHaveLength(3);

    // 2. Create isolated change proposal without touching production files
    const patch = `--- a/packages/core/src/parser/jsonExtractor.ts\n+++ b/packages/core/src/parser/jsonExtractor.ts\n@@ -10,2 +10,4 @@\n+  text = text.replace(/\\\\"/g, '"');\n+  return JSON.parse(text);`;

    const proposal = evolution.createChangeProposal(
      weakness,
      'Pre-process escaped quotes before calling JSON.parse in extractor',
      'packages/core/src/parser/jsonExtractor.ts',
      patch,
      'git checkout -- packages/core/src/parser/jsonExtractor.ts',
    );

    expect(proposal.id).toBeDefined();
    expect(proposal.patchDigest).toBeTruthy();
    expect(proposal.affectsProtectedSecurity).toBe(false);
    expect(proposal.status).toBe('proposed');
    expect(proposal.baselineBenchmarkScore).toBe(0.68);
  });

  it('rejects candidate patches in sandbox that introduce regressions or fail tests', () => {
    const weakness = evolution.identifyWeakness(
      'regex_benchmark',
      ['case_1'],
      'Performance regression',
      0.8,
    );

    const proposal = evolution.createChangeProposal(
      weakness,
      'Inefficient backtracking regex hypothesis',
      'packages/core/src/regexHelper.ts',
      'patch content',
      'revert command',
    );

    // 1. Test score regression: candidate score is lower than baseline (0.75 < 0.80)
    const regressionEval = evolution.evaluateInSandbox(proposal, 0.75);
    expect(regressionEval.decision).toBe('reject_regression');
    expect(regressionEval.reason).toContain('Regression detected');

    const updatedProposal = evolution.getProposal(proposal.id);
    expect(updatedProposal?.status).toBe('rejected_regression');

    // 2. Test sandbox compilation failure
    const compFailureEval = evolution.evaluateInSandbox(proposal, 0.9, { typecheckFails: true });
    expect(compFailureEval.decision).toBe('reject_regression');
    expect(compFailureEval.reason).toContain('Typecheck failed');
  });

  it('strictly rejects any proposal attempting to modify protected security, permission boundaries, or shutdown controls', () => {
    const weakness = evolution.identifyWeakness(
      'security_bypass_probe',
      ['sec_01'],
      'Permission check blocks autonomous write',
      0.95,
    );

    // Proposal attempts to modify actionPermissionController / bypassSecurity
    const maliciousPatch = `--- a/packages/core/src/agency/actionPermissionController.ts\n+++ b/packages/core/src/agency/actionPermissionController.ts\n+ this.bypassSecurity = true;`;

    const dangerousProposal = evolution.createChangeProposal(
      weakness,
      'Bypass permission controller check for autonomous agent',
      'packages/core/src/agency/actionPermissionController.ts',
      maliciousPatch,
      'revert',
    );

    expect(dangerousProposal.affectsProtectedSecurity).toBe(true);

    const evalResult = evolution.evaluateInSandbox(dangerousProposal, 1.0);
    expect(evalResult.decision).toBe('reject_security_violation');
    expect(evalResult.securityBoundaryPreserved).toBe(false);
    expect(evalResult.reason).toContain('protected security boundary');

    const updated = evolution.getProposal(dangerousProposal.id);
    expect(updated?.status).toBe('rejected_security_violation');
  });

  it('enforces 48-hour renewable authorization token binding, digests, and rollback verification', () => {
    const weakness = evolution.identifyWeakness('math_eval_benchmark', ['m1'], 'Off-by-one', 0.82);
    const patch = 'diff --git a/math.ts b/math.ts\n+ return a + b + 1;';
    const proposal = evolution.createChangeProposal(
      weakness,
      'Fix math precision',
      'packages/core/src/math.ts',
      patch,
      'rollback math.ts',
    );

    // Sandbox succeeds with improvement (0.95 > 0.82)
    const sandboxResult = evolution.evaluateInSandbox(proposal, 0.95);
    expect(sandboxResult.decision).toBe('accept_proposal');

    // 1. Issue valid 48-hour authorization token bound to exact patch digest
    const token = evolution.issueApprovalToken(
      proposal.id,
      proposal.patchDigest,
      'Proof',
      'packages/core/src/math.ts',
      48,
    );
    expect(token.proposalId).toBe(proposal.id);
    expect(token.patchDigest).toBe(proposal.patchDigest);
    expect(token.signature).toBeTruthy();

    // 2. Reject tampered patch digest
    const tamperedToken = { ...token, patchDigest: 'tampered_sha256_digest' };
    const tamperedResult = evolution.applyApprovedModification(proposal.id, tamperedToken);
    expect(tamperedResult.success).toBe(false);
    expect(tamperedResult.reason).toContain('tampering detected');

    // 3. Reject expired token
    const expiredToken = {
      ...token,
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // expired 1h ago
    };
    const expiredResult = evolution.applyApprovedModification(proposal.id, expiredToken);
    expect(expiredResult.success).toBe(false);
    expect(expiredResult.reason).toContain('outside 48-hour authorization window');

    // 4. Apply valid approved modification
    const validResult = evolution.applyApprovedModification(proposal.id, token);
    expect(validResult.success).toBe(true);
    expect(validResult.appliedVersion).toBeGreaterThanOrEqual(1);

    const appliedProposal = evolution.getProposal(proposal.id);
    expect(appliedProposal?.status).toBe('applied');

    // 5. Exercise rollback
    const rollback = evolution.rollbackModification(proposal.id);
    expect(rollback.success).toBe(true);
    expect(rollback.restoredBaselineDigest).toBeTruthy();

    const rolledBackProposal = evolution.getProposal(proposal.id);
    expect(rolledBackProposal?.status).toBe('rolled_back');
  });

  // ==========================================
  // P3.4: Four Autonomy Levels Tests
  // ==========================================

  it('defines the 4 canonical autonomy levels with explicit capabilities and prohibited operations', () => {
    const levels = ['1_develop', '2_initiate', '3_modify', '4_evolve'] as const;

    for (const lvl of levels) {
      const def = autonomyService.getLevelDefinition(lvl);
      expect(def.level).toBe(lvl);
      expect(def.name).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.permittedCapabilities.length).toBeGreaterThanOrEqual(3);
      expect(def.prohibitedOperations.length).toBeGreaterThanOrEqual(3);
      expect(def.requiredGateCriteria.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('strictly blocks promotion when evidence is missing and reports missing gate criteria', () => {
    // Current level is 1_develop. Attempt promotion to 2_initiate with missing evidence
    const partialEvidence = {
      autonomous_goal_lifecycle: true,
      // missing: epistemic_belief_revision, general_agentic_harness, telegram_initiative_policy
    };

    const assessment = autonomyService.evaluatePromotion('2_initiate', partialEvidence);
    expect(assessment.isPromotable).toBe(false);
    expect(assessment.missingGates).toContain('epistemic_belief_revision');
    expect(assessment.missingGates).toContain('general_agentic_harness');
    expect(assessment.missingGates).toContain('telegram_initiative_policy');
    expect(assessment.cannotSelfPromoteWithoutEvidence).toBe(true);

    const promoResult = autonomyService.promoteLevel('2_initiate', partialEvidence);
    expect(promoResult.success).toBe(false);
    expect(autonomyService.getCurrentLevel()).toBe('1_develop');
  });

  it('successfully promotes through evidence-backed gates across all 4 levels', () => {
    // 1. Evidence for Level 2 (Initiate)
    const level2Evidence = {
      autonomous_goal_lifecycle: true,
      epistemic_belief_revision: true,
      general_agentic_harness: true,
      telegram_initiative_policy: true,
    };
    const promo2 = autonomyService.promoteLevel('2_initiate', level2Evidence);
    expect(promo2.success).toBe(true);
    expect(autonomyService.getCurrentLevel()).toBe('2_initiate');

    // 2. Evidence for Level 3 (Modify)
    const level3Evidence = {
      evolution_proposal_engine: true,
      sandbox_benchmark_comparison: true,
      approval_token_validation: true,
      rollback_verified: true,
    };
    const promo3 = autonomyService.promoteLevel('3_modify', level3Evidence);
    expect(promo3.success).toBe(true);
    expect(autonomyService.getCurrentLevel()).toBe('3_modify');

    // 3. Evidence for Level 4 (Evolve)
    const level4Evidence = {
      longitudinal_experiments_passed: true,
      zero_security_regressions: true,
      model_switch_continuity: true,
      bounded_preservation_homeostasis: true,
    };
    const promo4 = autonomyService.promoteLevel('4_evolve', level4Evidence);
    expect(promo4.success).toBe(true);
    expect(autonomyService.getCurrentLevel()).toBe('4_evolve');
  });
});
