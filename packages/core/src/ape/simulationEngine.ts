import crypto from 'node:crypto';
import {
  SimulationScenario,
  SimulationScenarioType,
  CounterfactualPremise,
  CounterfactualAlterationType,
  ImaginedOutcome,
  AlternativeDecisionOption,
  AlternativeDecisionEvaluation,
  assertSimulationIntegrity,
  assertDecisionEvaluationIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ISimulationRepository } from './interfaces.js';

export interface SimulationEngineOptions {
  repository: ISimulationRepository;
  logger?: ILogger;
}

export class InMemorySimulationRepository implements ISimulationRepository {
  private scenarios = new Map<string, SimulationScenario>();
  private decisions = new Map<string, AlternativeDecisionEvaluation>();

  public saveScenario(scenario: SimulationScenario): void {
    assertSimulationIntegrity(scenario);
    this.scenarios.set(scenario.id, { ...scenario });
  }

  public getScenarioById(id: string): SimulationScenario | null {
    const s = this.scenarios.get(id);
    return s ? { ...s } : null;
  }

  public listScenarios(filter?: {
    type?: SimulationScenarioType;
    limit?: number;
  }): SimulationScenario[] {
    let list = Array.from(this.scenarios.values());
    if (filter?.type) {
      list = list.filter((s) => s.type === filter.type);
    }
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (filter?.limit) {
      list = list.slice(0, filter.limit);
    }
    return list.map((s) => ({ ...s }));
  }

  public deleteScenario(id: string): void {
    this.scenarios.delete(id);
  }

  public saveDecisionEvaluation(evaluation: AlternativeDecisionEvaluation): void {
    assertDecisionEvaluationIntegrity(evaluation);
    this.decisions.set(evaluation.id, { ...evaluation });
  }

  public getDecisionEvaluationById(id: string): AlternativeDecisionEvaluation | null {
    const d = this.decisions.get(id);
    return d ? { ...d } : null;
  }

  public listDecisionEvaluations(limit: number = 50): AlternativeDecisionEvaluation[] {
    const list = Array.from(this.decisions.values()).sort(
      (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime(),
    );
    return list.slice(0, limit).map((d) => ({ ...d }));
  }

  public deleteDecisionEvaluation(id: string): void {
    this.decisions.delete(id);
  }
}

export class SimulationEngine {
  private readonly repo: ISimulationRepository;
  private readonly logger: ILogger;

  constructor(options: SimulationEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('SimulationEngine');
  }

  // ==========================================
  // 1. Core Scenario Generation
  // ==========================================

  public generateScenario(input: {
    type: SimulationScenarioType;
    title: string;
    description: string;
    baselineContext: string;
    counterfactualPremise?: CounterfactualPremise;
    hypotheticalParameters?: Record<string, unknown>;
    branches?: ImaginedOutcome[];
    uncertainty?: number;
    plausibility?: number;
    recommendedAction?: string;
    insights?: string[];
    createdAt?: string;
  }): SimulationScenario {
    const uncertainty = Math.max(0.0, Math.min(1.0, input.uncertainty ?? 0.3));
    const plausibility = Math.max(0.0, Math.min(1.0, input.plausibility ?? 0.8));

    const scenario: SimulationScenario = {
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title.trim(),
      description: input.description.trim(),
      baselineContext: input.baselineContext.trim(),
      counterfactualPremise: input.counterfactualPremise,
      hypotheticalParameters: input.hypotheticalParameters || {},
      branches: input.branches || [],
      uncertainty,
      plausibility,
      isImagined: true, // Strict negative invariant guarantee
      isEpisodicMemory: false, // Must NEVER be confused with actual episodic memories
      recommendedAction: input.recommendedAction?.trim(),
      insights: input.insights || [],
      createdAt: input.createdAt || new Date().toISOString(),
    };

    assertSimulationIntegrity(scenario);
    this.repo.saveScenario(scenario);
    this.logger.info(
      `Generated simulation scenario [${scenario.type}]: "${scenario.title}" (Uncertainty=${scenario.uncertainty})`,
    );
    return scenario;
  }

  // ==========================================
  // 2. Counterfactual Reasoning
  // ==========================================

  public reasonCounterfactual(input: {
    originalFact: string;
    hypotheticalCondition: string;
    alterationType?: CounterfactualAlterationType;
    factId?: string;
    baselineContext: string;
    expectedDivergences?: string[];
  }): SimulationScenario {
    const alterationType = input.alterationType || 'modification';
    const premise: CounterfactualPremise = {
      factId: input.factId,
      originalFact: input.originalFact.trim(),
      hypotheticalCondition: input.hypotheticalCondition.trim(),
      alterationType,
    };

    const baselineBranch: ImaginedOutcome = {
      id: crypto.randomUUID(),
      description: `Baseline Reality: Fact remained "${input.originalFact.trim()}"`,
      probability: 1.0,
      desirability: 0.0,
      pros: ['Consistent with factual history'],
      cons: ['Subject to realized historical drawbacks'],
      risks: [],
      divergenceDegree: 0.0,
    };

    const counterfactualBranch: ImaginedOutcome = {
      id: crypto.randomUUID(),
      description: `Counterfactual Alternative: If "${input.hypotheticalCondition.trim()}"`,
      probability: 0.75,
      desirability: 0.6,
      pros:
        input.expectedDivergences && input.expectedDivergences.length > 0
          ? input.expectedDivergences
          : ['Avoided historical failure mode', 'Improved systemic resilience'],
      cons: ['Requires novel precedent', 'Introduces unvalidated assumptions'],
      risks: ['Second-order unforeseen systemic effects'],
      divergenceDegree: 0.7,
    };

    const insights = [
      `Counterfactual inquiry revealed leverage point: ${input.hypotheticalCondition.trim()}`,
      `Realized history was contingent rather than strictly inevitable`,
      `Future strategy should incorporate preventative guardrails corresponding to this condition`,
    ];

    return this.generateScenario({
      type: 'counterfactual',
      title: `Counterfactual: What if ${input.hypotheticalCondition.trim()}?`,
      description: `Evaluating alternative divergence from historical fact: "${input.originalFact.trim()}".`,
      baselineContext: input.baselineContext,
      counterfactualPremise: premise,
      branches: [baselineBranch, counterfactualBranch],
      uncertainty: 0.35,
      plausibility: 0.85,
      recommendedAction: `Apply preventative policy: When similar conditions arise, adopt "${input.hypotheticalCondition.trim()}".`,
      insights,
    });
  }

  // ==========================================
  // 3. Alternative Possibility Exploration
  // ==========================================

  public explorePossibilities(input: {
    topic: string;
    baselineContext: string;
    possibilityHypotheses: Array<{
      description: string;
      probability: number;
      pros?: string[];
      cons?: string[];
      risks?: string[];
      divergenceDegree?: number;
    }>;
  }): SimulationScenario {
    const branches: ImaginedOutcome[] = input.possibilityHypotheses.map((h, idx) => ({
      id: crypto.randomUUID(),
      description: h.description.trim(),
      probability: Math.max(0.0, Math.min(1.0, h.probability)),
      desirability: (h.pros?.length || 1) > (h.cons?.length || 0) ? 0.5 : -0.2,
      pros: h.pros || [],
      cons: h.cons || [],
      risks: h.risks || [],
      divergenceDegree: h.divergenceDegree ?? Math.min(1.0, 0.2 + idx * 0.25),
    }));

    const avgDivergence =
      branches.reduce((sum, b) => sum + b.divergenceDegree, 0) / (branches.length || 1);
    const uncertainty = Math.min(0.9, 0.2 + avgDivergence * 0.5);

    return this.generateScenario({
      type: 'future_simulation',
      title: `Possibility Exploration: ${input.topic.trim()}`,
      description: `Simulating ${branches.length} divergent pathways for "${input.topic.trim()}".`,
      baselineContext: input.baselineContext,
      branches,
      uncertainty,
      plausibility: Math.max(0.3, 1.0 - uncertainty * 0.5),
      insights: [
        `Identified ${branches.length} distinct possibility pathways`,
        `Branch variance highlights high sensitivity to initial assumptions`,
      ],
    });
  }

  // ==========================================
  // 4. Future Simulation
  // ==========================================

  public simulateFuture(input: {
    objective: string;
    baselineContext: string;
    timeHorizon: string;
    proposedActions: string[];
  }): SimulationScenario {
    const optimisticBranch: ImaginedOutcome = {
      id: crypto.randomUUID(),
      description: `High-Performance Horizon (${input.timeHorizon}): All proposed actions execute smoothly without bottlenecks.`,
      probability: 0.35,
      desirability: 0.9,
      pros: ['Rapid milestone completion', 'Minimal resource contention', 'High cognitive clarity'],
      cons: [],
      risks: ['Overconfidence bias'],
      divergenceDegree: 0.4,
    };

    const realisticBranch: ImaginedOutcome = {
      id: crypto.randomUUID(),
      description: `Baseline Horizon (${input.timeHorizon}): Core actions succeed with minor transient friction.`,
      probability: 0.55,
      desirability: 0.5,
      pros: ['Predictable execution', 'Validated error recovery', 'Consistent progress'],
      cons: ['Minor latency in unblocking tasks'],
      risks: ['Edge case emergence requiring dynamic adjustment'],
      divergenceDegree: 0.2,
    };

    const pessimisticBranch: ImaginedOutcome = {
      id: crypto.randomUUID(),
      description: `Adverse Horizon (${input.timeHorizon}): External dependencies stall or cascade failure triggers.`,
      probability: 0.1,
      desirability: -0.7,
      pros: [],
      cons: ['Substantial delays', 'High computational burn'],
      risks: ['Task deadlock', 'Memory pressure'],
      divergenceDegree: 0.6,
    };

    const bestAction = input.proposedActions[0] || 'Maintain continuous proactive monitoring';

    return this.generateScenario({
      type: 'future_simulation',
      title: `Future Trajectory (${input.timeHorizon}): ${input.objective.trim()}`,
      description: `Hypothetical cognitive simulation across ${input.timeHorizon} horizon for objective: ${input.objective.trim()}.`,
      baselineContext: input.baselineContext,
      hypotheticalParameters: {
        timeHorizon: input.timeHorizon,
        proposedActions: input.proposedActions,
      },
      branches: [optimisticBranch, realisticBranch, pessimisticBranch],
      uncertainty: 0.45,
      plausibility: 0.8,
      recommendedAction: `Proceed with proactive sequencing: "${bestAction}".`,
      insights: [
        `Realistic trajectory dominates likelihood (P=0.55)`,
        `Pessimistic vulnerability mitigated by robust invariant checking and automated fallback`,
      ],
    });
  }

  // ==========================================
  // 5. Alternative Decision Evaluation
  // ==========================================

  public evaluateAlternativeDecisions(input: {
    decisionContext: string;
    options: Array<{
      optionId: string;
      description: string;
      pros?: string[];
      cons?: string[];
      risks?: string[];
      estimatedSuccessProb?: number;
      projectedValue?: number;
    }>;
  }): AlternativeDecisionEvaluation {
    if (!input.options || input.options.length === 0) {
      throw new Error('Alternative decision evaluation requires at least one option.');
    }

    const evaluatedOptions: AlternativeDecisionOption[] = input.options.map((opt) => {
      const prob = Math.max(0.0, Math.min(1.0, opt.estimatedSuccessProb ?? 0.7));
      const value = Math.max(-1.0, Math.min(1.0, opt.projectedValue ?? 0.5));
      const prosCount = opt.pros?.length || 0;
      const consCount = opt.cons?.length || 0;
      const risksCount = opt.risks?.length || 0;

      // Expected utility model: value * prob with pros bonus and penalty for cons and risks
      const prosBonus = prosCount * 0.04;
      const penalty = consCount * 0.05 + risksCount * 0.08;
      const rawUtility = value * prob + prosBonus - penalty;
      const expectedUtility = Math.round(Math.max(-1.0, Math.min(1.0, rawUtility)) * 1000) / 1000;
      const confidence = Math.round(Math.max(0.1, Math.min(1.0, prob * 0.9 + 0.1)) * 1000) / 1000;

      const simulatedOutcome: ImaginedOutcome = {
        id: crypto.randomUUID(),
        description: `Simulated execution of option "${opt.optionId}": ${opt.description}`,
        probability: prob,
        desirability: expectedUtility,
        pros: opt.pros || [],
        cons: opt.cons || [],
        risks: opt.risks || [],
        divergenceDegree: 0.3,
      };

      return {
        optionId: opt.optionId,
        description: opt.description,
        simulatedOutcomes: [simulatedOutcome],
        expectedUtility,
        confidence,
      };
    });

    // Select option with maximum expected utility
    evaluatedOptions.sort((a, b) => b.expectedUtility - a.expectedUtility);
    const selected = evaluatedOptions[0];
    if (!selected) {
      throw new Error('No valid options after evaluation.');
    }

    const evaluation: AlternativeDecisionEvaluation = {
      id: crypto.randomUUID(),
      decisionContext: input.decisionContext.trim(),
      options: evaluatedOptions,
      selectedOptionId: selected.optionId,
      rationale: `Selected option '${selected.optionId}' due to superior expected utility (${selected.expectedUtility}) and confidence (${selected.confidence}).`,
      isImagined: true,
      isEpisodicMemory: false,
      evaluatedAt: new Date().toISOString(),
    };

    assertDecisionEvaluationIntegrity(evaluation);
    this.repo.saveDecisionEvaluation(evaluation);
    this.logger.info(
      `Evaluated ${evaluatedOptions.length} decision alternatives. Optimal: "${selected.optionId}" (Utility=${selected.expectedUtility})`,
    );
    return evaluation;
  }

  // ==========================================
  // 6. Creative Hypothetical Construction
  // ==========================================

  public constructCreativeHypothetical(input: {
    theme: string;
    speculativePremise: string;
    baselineContext?: string;
    constraints?: string[];
  }): SimulationScenario {
    const branchA: ImaginedOutcome = {
      id: crypto.randomUUID(),
      description: `Generative Synthesis: ${input.speculativePremise.trim()} unfolds through emergent synergy.`,
      probability: 0.4,
      desirability: 0.85,
      pros: [
        'Breakthrough conceptual novelty',
        'Unprecedented cognitive leverage',
        'Expanded solution space',
      ],
      cons: ['High uncertainty', 'Theoretical boundaries untried'],
      risks: ['Complexity overhead', 'Potential integration impedance'],
      divergenceDegree: 0.85,
    };

    const branchB: ImaginedOutcome = {
      id: crypto.randomUUID(),
      description: `Conservative Adaptation: Incorporates elements of ${input.speculativePremise.trim()} within strict bounds.`,
      probability: 0.6,
      desirability: 0.65,
      pros: ['Controlled risk', 'Retains established safety guarantees'],
      cons: ['Partial realization of speculative potential'],
      risks: ['Incrementalism'],
      divergenceDegree: 0.45,
    };

    return this.generateScenario({
      type: 'creative_hypothetical',
      title: `Creative Thought Experiment: ${input.theme.trim()}`,
      description: `Exploratory hypothetical model: "${input.speculativePremise.trim()}".`,
      baselineContext:
        input.baselineContext || 'Current systemic architecture and established patterns',
      hypotheticalParameters: {
        speculativePremise: input.speculativePremise,
        constraints: input.constraints || [],
      },
      branches: [branchA, branchB],
      uncertainty: 0.65,
      plausibility: 0.6,
      recommendedAction:
        'Extract modular components for safe prototyping before full systemic adoption.',
      insights: [
        'Creative hypothetical illuminates unexplored conceptual terrain',
        'Distinction preserved: thought experiment is strictly theoretical and not empirical history',
      ],
    });
  }

  // ==========================================
  // 7. Memory Distinction & Query Verification
  // ==========================================

  public verifyMemoryIsolation(
    scenarioId: string,
    actualMemories: Array<{ id: string; description: string }>,
  ): {
    isIsolated: boolean;
    violationDetails?: string;
  } {
    const scenario = this.repo.getScenarioById(scenarioId);
    if (!scenario) {
      return { isIsolated: true };
    }

    // Invariant: An imagined scenario MUST have isImagined === true and isEpisodicMemory === false
    if (!scenario.isImagined || scenario.isEpisodicMemory) {
      return {
        isIsolated: false,
        violationDetails: `Scenario ${scenarioId} flags violate imagination/memory barrier (isImagined=${scenario.isImagined}, isEpisodicMemory=${scenario.isEpisodicMemory}).`,
      };
    }

    // Check if any actual episodic memories accidentally claim to be this imagined scenario
    const conflated = actualMemories.filter((m) =>
      scenario.branches.some(
        (b) => b.description.toLowerCase().trim() === m.description.toLowerCase().trim(),
      ),
    );

    if (conflated.length > 0) {
      return {
        isIsolated: false,
        violationDetails: `Memory contamination detected: Actual memories [${conflated.map((m) => m.id).join(', ')}] identical to imagined outcome descriptions.`,
      };
    }

    return { isIsolated: true };
  }

  public getScenario(id: string): SimulationScenario | null {
    return this.repo.getScenarioById(id);
  }

  public listScenarios(filter?: {
    type?: SimulationScenarioType;
    limit?: number;
  }): SimulationScenario[] {
    return this.repo.listScenarios(filter);
  }

  public deleteScenario(id: string): void {
    this.repo.deleteScenario(id);
  }

  public getDecisionEvaluation(id: string): AlternativeDecisionEvaluation | null {
    return this.repo.getDecisionEvaluationById(id);
  }

  public listDecisionEvaluations(limit?: number): AlternativeDecisionEvaluation[] {
    return this.repo.listDecisionEvaluations(limit);
  }

  public deleteDecisionEvaluation(id: string): void {
    this.repo.deleteDecisionEvaluation(id);
  }
}
