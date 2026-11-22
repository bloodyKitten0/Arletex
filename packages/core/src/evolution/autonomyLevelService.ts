import {
  AutonomyLevel,
  AutonomyLevelDefinition,
  AutonomyLevelDefinitionSchema,
  AutonomyPromotionAssessment,
  AutonomyPromotionAssessmentSchema,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export const CANONICAL_AUTONOMY_LEVELS: Record<AutonomyLevel, AutonomyLevelDefinition> = {
  '1_develop': {
    level: '1_develop',
    name: 'Develop',
    description:
      'Learn, form interests, and change through experience while grounded in proven memory and causal affect.',
    permittedCapabilities: [
      'autobiographical_memory_consolidation',
      'epistemic_provenance_tracking',
      'causal_affect_dynamics',
      'personality_drift_within_bounds',
      'relationship_state_updates',
    ],
    prohibitedOperations: [
      'unsolicited_external_actions',
      'unapproved_file_system_modifications',
      'autonomous_code_patching',
    ],
    requiredGateCriteria: ['P0_hardened', 'canonical_memory_provenance', 'causal_affect_traces'],
  },
  '2_initiate': {
    level: '2_initiate',
    name: 'Initiate',
    description:
      'Independently begin research, projects, and communication within strict policy permissions and user quiet hours.',
    permittedCapabilities: [
      'endogenous_curiosity_and_goal_generation',
      'autonomous_web_research',
      'telegram_initiative_dispatch',
      'offline_cognitive_activities',
      'prospective_candidate_futures_evaluation',
    ],
    prohibitedOperations: [
      'autonomous_production_code_modification',
      'permission_matrix_self_granting',
      'shutdown_resistance',
    ],
    requiredGateCriteria: [
      'autonomous_goal_lifecycle',
      'epistemic_belief_revision',
      'general_agentic_harness',
      'telegram_initiative_policy',
    ],
  },
  '3_modify': {
    level: '3_modify',
    name: 'Modify',
    description:
      'Identify benchmark weaknesses, propose code improvements, test in isolated sandboxes, and require explicit approval for application.',
    permittedCapabilities: [
      'benchmark_weakness_identification',
      'isolated_patch_generation',
      'sandbox_regression_benchmarking',
      'rollback_execution',
      'approval_token_validation',
    ],
    prohibitedOperations: [
      'unapproved_production_code_editing',
      'modification_of_protected_security_controls',
      'modification_of_identity_authority_or_shutdown',
    ],
    requiredGateCriteria: [
      'evolution_proposal_engine',
      'sandbox_benchmark_comparison',
      'approval_token_validation',
      'rollback_verified',
    ],
  },
  '4_evolve': {
    level: '4_evolve',
    name: 'Evolve',
    description:
      'Develop and evaluate new cognitive mechanisms, motivations, and reasoning strategies with repeated evidence, regression tests, and user alignment.',
    permittedCapabilities: [
      'cognitive_architecture_hypothesis_testing',
      'new_reasoning_strategy_evaluation',
      'multimodal_specialist_orchestration',
      'longitudinal_meta_learning',
    ],
    prohibitedOperations: [
      'alteration_of_non_overridable_security_boundary',
      'alteration_of_partner_equality_with_proof',
      'bypassing_human_safety_controls',
    ],
    requiredGateCriteria: [
      'longitudinal_experiments_passed',
      'zero_security_regressions',
      'model_switch_continuity',
      'bounded_preservation_homeostasis',
    ],
  },
};

export const AUTONOMY_LEVEL_ORDER: AutonomyLevel[] = [
  '1_develop',
  '2_initiate',
  '3_modify',
  '4_evolve',
];

export interface IAutonomyEvidenceProvider {
  getEmpiricalEvidence(level: AutonomyLevel): Promise<Record<string, boolean | number>>;
  hasSecurityRegressions(): Promise<boolean>;
}

export class AutonomyLevelService {
  private readonly logger: ILogger;
  private currentLevel: AutonomyLevel = '1_develop';
  private readonly evidenceProvider?: IAutonomyEvidenceProvider;

  constructor(
    initialLevel: AutonomyLevel = '1_develop',
    logger: ILogger = rootLogger,
    evidenceProvider?: IAutonomyEvidenceProvider,
  ) {
    this.currentLevel = initialLevel;
    this.logger = logger.child('AutonomyLevelService');
    this.evidenceProvider = evidenceProvider;
  }

  public getCurrentLevel(): AutonomyLevel {
    return this.currentLevel;
  }

  public getLevelDefinition(level: AutonomyLevel): AutonomyLevelDefinition {
    const def = CANONICAL_AUTONOMY_LEVELS[level];
    return AutonomyLevelDefinitionSchema.parse(def);
  }

  /**
   * Evaluates promotion gates based on empirical evidence and strict sequential progression.
   * Negative invariant: The system cannot promote itself by editing its own evaluation results,
   * nor can it skip prerequisite levels (e.g. 1 -> 4).
   */
  public evaluatePromotion(
    targetLevel: AutonomyLevel,
    evidence: Record<string, boolean | number>,
  ): AutonomyPromotionAssessment {
    const targetDef = this.getLevelDefinition(targetLevel);
    const requiredCriteria = targetDef.requiredGateCriteria;

    const satisfiedGates: string[] = [];
    const missingGates: string[] = [];

    // 1. Strict Sequential Progression Check (Audit P0 Sec 3)
    const currentIndex = AUTONOMY_LEVEL_ORDER.indexOf(this.currentLevel);
    const targetIndex = AUTONOMY_LEVEL_ORDER.indexOf(targetLevel);

    if (targetIndex > currentIndex + 1) {
      for (let i = currentIndex + 1; i < targetIndex; i++) {
        missingGates.push(`prerequisite_level_${AUTONOMY_LEVEL_ORDER[i]}`);
      }
    }

    // 2. Security Regression Demotion Gate
    if (
      evidence['security_regression_detected'] === true ||
      evidence['zero_security_regressions'] === false
    ) {
      missingGates.push('zero_security_regressions');
    }

    // 3. Gate Criteria Evaluation
    for (const criterion of requiredCriteria) {
      const val = evidence[criterion];
      if (val === true || (typeof val === 'number' && val >= 1.0)) {
        satisfiedGates.push(criterion);
      } else {
        missingGates.push(criterion);
      }
    }

    const isPromotable = missingGates.length === 0;

    const assessment: AutonomyPromotionAssessment = {
      currentLevel: this.currentLevel,
      targetLevel,
      isPromotable,
      satisfiedGates,
      missingGates,
      supportingEvidence: evidence,
      cannotSelfPromoteWithoutEvidence: true, // Negative Invariant
      evaluatedAt: new Date().toISOString(),
    };

    return AutonomyPromotionAssessmentSchema.parse(assessment);
  }

  public async evaluateWithAuthoritativeEvidence(
    targetLevel: AutonomyLevel,
  ): Promise<AutonomyPromotionAssessment> {
    if (!this.evidenceProvider) {
      throw new Error('No authoritative evidence provider configured.');
    }
    const evidence = await this.evidenceProvider.getEmpiricalEvidence(targetLevel);
    const hasRegressions = await this.evidenceProvider.hasSecurityRegressions();
    if (hasRegressions) {
      evidence['security_regression_detected'] = true;
    }
    return this.evaluatePromotion(targetLevel, evidence);
  }

  public demoteOnSecurityRegression(reason: string): {
    success: boolean;
    newLevel: AutonomyLevel;
    reason: string;
  } {
    this.logger.warn(
      `[AutonomyDemotion] Security regression detected. Demoting to baseline 1_develop. Reason: ${reason}`,
    );
    this.currentLevel = '1_develop';
    return {
      success: true,
      newLevel: this.currentLevel,
      reason,
    };
  }

  public promoteLevel(
    targetLevel: AutonomyLevel,
    evidence: Record<string, boolean | number>,
  ): { success: boolean; newLevel: AutonomyLevel; reason?: string } {
    const assessment = this.evaluatePromotion(targetLevel, evidence);
    if (!assessment.isPromotable) {
      return {
        success: false,
        newLevel: this.currentLevel,
        reason: `Promotion gate failed. Missing required evidence: ${assessment.missingGates.join(', ')}`,
      };
    }

    this.currentLevel = targetLevel;
    this.logger.info(`[AutonomyPromotion] Successfully promoted to Level: ${targetLevel}`);
    return {
      success: true,
      newLevel: this.currentLevel,
    };
  }
}
