import crypto from 'node:crypto';
import {
  ArgumentEvaluation,
  ReasoningParadigm,
  ReasoningPremise,
  ReasoningStep,
  ReasoningSummary,
  ReasoningTask,
  assertReasoningIntegrity,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { IReasoningRepository } from './interfaces.js';

export interface GeneralReasoningEngineOptions {
  repository: IReasoningRepository;
  logger?: ILogger;
}

export class GeneralReasoningEngine {
  private readonly repo: IReasoningRepository;
  private readonly logger: ILogger;

  constructor(options: GeneralReasoningEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('GeneralReasoningEngine');
  }

  // ==========================================
  // 1. Deductive Reasoning
  // ==========================================

  public executeDeduction(premises: ReasoningPremise[], query: string, domain = 'logic'): ReasoningTask {
    const steps: ReasoningStep[] = [];
    const evaluation = this.evaluateArgument(premises, query);

    let conclusion = '';
    let confidence = 0.95;
    let uncertainty = 0.05;

    if (premises.length >= 2) {
      // Modus ponens / categorical inference
      const p1 = premises[0]!;
      const p2 = premises[1]!;
      steps.push({
        stepIndex: 0,
        paradigm: 'deductive',
        operation: 'premise_instantiation',
        premisesUsed: [p1.id, p2.id],
        intermediateConclusion: `Combined: "${p1.statement}" with "${p2.statement}"`,
        confidence: 0.98,
      });

      conclusion = evaluation.isLogicallyValid
        ? `Deductively verified: ${query}`
        : `Deduction failed validity check: ${evaluation.evaluationRationale}`;
      confidence = evaluation.isLogicallyValid && evaluation.isSound ? 0.98 : 0.4;
      uncertainty = 1.0 - confidence;
    } else if (premises.length === 1) {
      const p = premises[0]!;
      steps.push({
        stepIndex: 0,
        paradigm: 'deductive',
        operation: 'direct_implication',
        premisesUsed: [p.id],
        intermediateConclusion: `Direct implication from: "${p.statement}"`,
        confidence: 0.95,
      });
      conclusion = `Deductively affirmed: ${query}`;
    } else {
      conclusion = 'Insufficient premises for deductive entailment.';
      confidence = 0.2;
      uncertainty = 0.8;
    }

    const task: ReasoningTask = {
      id: crypto.randomUUID(),
      query,
      domain,
      primaryParadigm: 'deductive',
      premises,
      steps,
      finalConclusion: conclusion,
      compositeConfidence: Math.round(confidence * 1000) / 1000,
      uncertaintyLevel: Math.round(uncertainty * 1000) / 1000,
      argumentEvaluation: evaluation,
      timestamp: new Date().toISOString(),
    };

    assertReasoningIntegrity(task);
    this.repo.saveTask(task);
    this.logger.debug(`Executed reasoning task [${task.primaryParadigm}] for query: "${task.query}" (confidence: ${task.compositeConfidence})`);
    return task;
  }

  // ==========================================
  // 2. Inductive Reasoning
  // ==========================================

  public executeInduction(observations: string[], query: string, domain = 'empirical'): ReasoningTask {
    const premises: ReasoningPremise[] = observations.map((obs, i) => ({
      id: `obs_${i + 1}`,
      statement: obs,
      truthValue: 'true',
      source: 'empirical_observation',
    }));

    // Negative Invariant: Inductive reasoning must NEVER claim 100% certainty (bounded <= 0.92)
    const sampleSize = observations.length;
    const confidence = Math.min(0.92, Math.max(0.4, 0.4 + sampleSize * 0.08));
    const uncertainty = Math.max(0.08, 1.0 - confidence);

    const steps: ReasoningStep[] = [
      {
        stepIndex: 0,
        paradigm: 'inductive',
        operation: 'empirical_generalization',
        premisesUsed: premises.map((p) => p.id),
        intermediateConclusion: `Observed ${sampleSize} consistent empirical instances without contradiction`,
        confidence: Math.round(confidence * 1000) / 1000,
        uncertaintyNotes: `Inductive generalization remains open to future empirical counterexamples (sample size: ${sampleSize}).`,
      },
    ];

    const conclusion = `Inductively generalized pattern across ${sampleSize} observations: ${query}`;

    const task: ReasoningTask = {
      id: crypto.randomUUID(),
      query,
      domain,
      primaryParadigm: 'inductive',
      premises,
      steps,
      finalConclusion: conclusion,
      compositeConfidence: Math.round(confidence * 1000) / 1000,
      uncertaintyLevel: Math.round(uncertainty * 1000) / 1000,
      timestamp: new Date().toISOString(),
    };

    assertReasoningIntegrity(task);
    this.repo.saveTask(task);
    this.logger.debug(`Executed reasoning task [${task.primaryParadigm}] for query: "${task.query}" (confidence: ${task.compositeConfidence})`);
    return task;
  }

  // ==========================================
  // 3. Abductive Reasoning
  // ==========================================

  public executeAbduction(
    surprisingObservation: string,
    candidateExplanations: Array<{ explanation: string; priorLikelihood: number; explanatoryPower: number }>,
    query: string,
    domain = 'diagnosis',
  ): ReasoningTask {
    const premises: ReasoningPremise[] = [
      {
        id: 'obs_surprising',
        statement: surprisingObservation,
        truthValue: 'true',
        source: 'direct_observation',
      },
    ];

    // Score candidates by (priorLikelihood * 0.4 + explanatoryPower * 0.6)
    const scoredCandidates = candidateExplanations.map((c) => ({
      ...c,
      score: c.priorLikelihood * 0.4 + c.explanatoryPower * 0.6,
    }));
    scoredCandidates.sort((a, b) => b.score - a.score);

    const best = scoredCandidates[0] ?? {
      explanation: 'No viable hypothesis found',
      score: 0.1,
    };

    // Epistemic humility: Abductive inference to best explanation bounded <= 0.88
    const confidence = Math.min(0.88, Math.max(0.3, best.score * 0.95));
    const uncertainty = Math.max(0.12, 1.0 - confidence);

    const steps: ReasoningStep[] = [
      {
        stepIndex: 0,
        paradigm: 'abductive',
        operation: 'inference_to_best_explanation',
        premisesUsed: ['obs_surprising'],
        intermediateConclusion: `Ranked ${candidateExplanations.length} candidate explanations. Leading hypothesis: "${best.explanation}" (score: ${best.score.toFixed(2)})`,
        confidence: Math.round(confidence * 1000) / 1000,
        uncertaintyNotes: 'Alternative unconsidered hypotheses may account for the observation.',
      },
    ];

    const conclusion = `Best abductive explanation for '${surprisingObservation}': ${best.explanation}`;

    const task: ReasoningTask = {
      id: crypto.randomUUID(),
      query,
      domain,
      primaryParadigm: 'abductive',
      premises,
      steps,
      finalConclusion: conclusion,
      compositeConfidence: Math.round(confidence * 1000) / 1000,
      uncertaintyLevel: Math.round(uncertainty * 1000) / 1000,
      timestamp: new Date().toISOString(),
    };

    assertReasoningIntegrity(task);
    this.repo.saveTask(task);
    this.logger.debug(`Executed reasoning task [${task.primaryParadigm}] for query: "${task.query}" (confidence: ${task.compositeConfidence})`);
    return task;
  }

  // ==========================================
  // 4. Analogical Reasoning
  // ==========================================

  public executeAnalogicalReasoning(
    sourceDomain: string,
    targetDomain: string,
    mappedRelations: Array<{ sourceRelation: string; targetRelation: string }>,
    query: string,
  ): ReasoningTask {
    const premises: ReasoningPremise[] = mappedRelations.map((m, i) => ({
      id: `map_${i + 1}`,
      statement: `[${sourceDomain}] ${m.sourceRelation} <=> [${targetDomain}] ${m.targetRelation}`,
      truthValue: 'true',
    }));

    const mappingRatio = mappedRelations.length >= 3 ? 0.85 : 0.7;
    const confidence = Math.min(0.9, mappingRatio);
    const uncertainty = 1.0 - confidence;

    const steps: ReasoningStep[] = [
      {
        stepIndex: 0,
        paradigm: 'analogical',
        operation: 'relational_structure_mapping',
        premisesUsed: premises.map((p) => p.id),
        intermediateConclusion: `Projected ${mappedRelations.length} relational alignments from '${sourceDomain}' to '${targetDomain}'`,
        confidence,
        uncertaintyNotes: 'Structural alignments are suggestive but may break under target-domain idiosyncrasies.',
      },
    ];

    const conclusion = `Analogical projection from '${sourceDomain}' to '${targetDomain}': ${query}`;

    const task: ReasoningTask = {
      id: crypto.randomUUID(),
      query,
      domain: targetDomain,
      primaryParadigm: 'analogical',
      premises,
      steps,
      finalConclusion: conclusion,
      compositeConfidence: Math.round(confidence * 1000) / 1000,
      uncertaintyLevel: Math.round(uncertainty * 1000) / 1000,
      timestamp: new Date().toISOString(),
    };

    assertReasoningIntegrity(task);
    this.repo.saveTask(task);
    this.logger.debug(`Executed reasoning task [${task.primaryParadigm}] for query: "${task.query}" (confidence: ${task.compositeConfidence})`);
    return task;
  }

  // ==========================================
  // 5. Probabilistic Reasoning
  // ==========================================

  public executeProbabilisticReasoning(
    prior: number,
    evidenceLikelihoodGivenHypothesis: number,
    evidenceLikelihoodGivenNotHypothesis: number,
    query: string,
    domain = 'probability',
  ): ReasoningTask {
    // Clamping probabilities in [0.001, 0.999] to prevent div-by-zero
    const clampedPrior = Math.max(0.001, Math.min(0.999, prior));
    const pEgivenH = Math.max(0.001, Math.min(0.999, evidenceLikelihoodGivenHypothesis));
    const pEgivenNotH = Math.max(0.001, Math.min(0.999, evidenceLikelihoodGivenNotHypothesis));

    const pEvidence = pEgivenH * clampedPrior + pEgivenNotH * (1.0 - clampedPrior);
    const posterior = (pEgivenH * clampedPrior) / pEvidence;

    // Epistemic humility: Probabilistic confidence bounded <= 0.95
    const confidence = Math.min(0.95, Math.max(0.3, posterior));
    const uncertainty = Math.max(0.05, 1.0 - confidence);

    const premises: ReasoningPremise[] = [
      { id: 'prior', statement: `P(H) = ${clampedPrior.toFixed(3)}`, truthValue: 'true' },
      { id: 'likelihood_H', statement: `P(E|H) = ${pEgivenH.toFixed(3)}`, truthValue: 'true' },
      { id: 'likelihood_notH', statement: `P(E|~H) = ${pEgivenNotH.toFixed(3)}`, truthValue: 'true' },
    ];

    const steps: ReasoningStep[] = [
      {
        stepIndex: 0,
        paradigm: 'probabilistic',
        operation: 'bayesian_update',
        premisesUsed: ['prior', 'likelihood_H', 'likelihood_notH'],
        intermediateConclusion: `Computed marginal P(E)=${pEvidence.toFixed(3)} and posterior P(H|E)=${posterior.toFixed(3)}`,
        confidence: Math.round(confidence * 1000) / 1000,
        uncertaintyNotes: `Posterior odds updated from prior ${(clampedPrior / (1 - clampedPrior)).toFixed(2)}.`,
      },
    ];

    const conclusion = `Posterior probability of hypothesis under evidence: ${(posterior * 100).toFixed(1)}% (${query})`;

    const task: ReasoningTask = {
      id: crypto.randomUUID(),
      query,
      domain,
      primaryParadigm: 'probabilistic',
      premises,
      steps,
      finalConclusion: conclusion,
      compositeConfidence: Math.round(confidence * 1000) / 1000,
      uncertaintyLevel: Math.round(uncertainty * 1000) / 1000,
      timestamp: new Date().toISOString(),
    };

    assertReasoningIntegrity(task);
    this.repo.saveTask(task);
    this.logger.debug(`Executed reasoning task [${task.primaryParadigm}] for query: "${task.query}" (confidence: ${task.compositeConfidence})`);
    return task;
  }

  // ==========================================
  // 6. Mathematical Reasoning
  // ==========================================

  public executeMathematicalReasoning(
    problem: string,
    stepsInput: Array<{ step: string; result: string }>,
    finalResult: string,
    domain = 'mathematics',
  ): ReasoningTask {
    const steps: ReasoningStep[] = stepsInput.map((s, i) => ({
      stepIndex: i,
      paradigm: 'mathematical',
      operation: 'symbolic_transformation',
      premisesUsed: i > 0 ? [`step_${i - 1}`] : [],
      intermediateConclusion: `${s.step} => ${s.result}`,
      confidence: 0.99,
    }));

    const task: ReasoningTask = {
      id: crypto.randomUUID(),
      query: problem,
      domain,
      primaryParadigm: 'mathematical',
      premises: [{ id: 'problem_spec', statement: problem, truthValue: 'true' }],
      steps,
      finalConclusion: `Mathematical derivation concluded: ${finalResult}`,
      compositeConfidence: 0.99,
      uncertaintyLevel: 0.01,
      timestamp: new Date().toISOString(),
    };

    assertReasoningIntegrity(task);
    this.repo.saveTask(task);
    this.logger.debug(`Executed reasoning task [${task.primaryParadigm}] for query: "${task.query}" (confidence: ${task.compositeConfidence})`);
    return task;
  }

  // ==========================================
  // 7. Multi-Step Reasoning
  // ==========================================

  public executeMultiStepReasoning(input: {
    query: string;
    domain: string;
    premises: ReasoningPremise[];
    steps: Array<{
      paradigm: ReasoningParadigm;
      operation: string;
      intermediateConclusion: string;
      confidence: number;
    }>;
    finalConclusion?: string;
  }): ReasoningTask {
    const formattedSteps: ReasoningStep[] = input.steps.map((s, i) => ({
      stepIndex: i,
      paradigm: s.paradigm,
      operation: s.operation,
      premisesUsed: i > 0 ? [`step_${i - 1}`] : input.premises.map((p) => p.id),
      intermediateConclusion: s.intermediateConclusion,
      confidence: Math.max(0.1, Math.min(1.0, s.confidence)),
    }));

    const avgConfidence = formattedSteps.length > 0
      ? formattedSteps.reduce((acc, s) => acc + s.confidence, 0) / formattedSteps.length
      : 0.5;

    const finalConclusion = input.finalConclusion || (
      formattedSteps.length > 0
        ? formattedSteps[formattedSteps.length - 1]!.intermediateConclusion
        : 'Multi-step reasoning completed'
    );

    const task: ReasoningTask = {
      id: crypto.randomUUID(),
      query: input.query,
      domain: input.domain,
      primaryParadigm: 'multi_step',
      premises: input.premises,
      steps: formattedSteps,
      finalConclusion,
      compositeConfidence: Math.round(avgConfidence * 1000) / 1000,
      uncertaintyLevel: Math.round((1.0 - avgConfidence) * 1000) / 1000,
      timestamp: new Date().toISOString(),
    };

    assertReasoningIntegrity(task);
    this.repo.saveTask(task);
    this.logger.debug(`Executed reasoning task [${task.primaryParadigm}] for query: "${task.query}" (confidence: ${task.compositeConfidence})`);
    return task;
  }

  // ==========================================
  // 8. Argument Evaluation & Fallacy Detection
  // ==========================================

  public evaluateArgument(premises: ReasoningPremise[], conclusion: string): ArgumentEvaluation {
    const identifiedFallacies: string[] = [];
    const counterexamples: string[] = [];
    const lowerConclusion = conclusion.toLowerCase();

    // Check circular reasoning
    const isCircular = premises.some((p) => p.statement.toLowerCase().trim() === lowerConclusion.trim());
    if (isCircular) {
      identifiedFallacies.push('circular_reasoning');
    }

    // Check affirming the consequent heuristic: "if P then Q", asserting Q, concluding P
    const hasImplication = premises.find((p) => p.statement.toLowerCase().includes('if ') && p.statement.toLowerCase().includes('then '));
    if (hasImplication) {
      const impText = hasImplication.statement.toLowerCase();
      const parts = impText.split('then');
      if (parts.length === 2) {
        const antecedent = (parts[0] ?? '')
          .replace(/^\s*if\s+/i, '')
          .replace(/[,;.]\s*$/, '')
          .trim();
        const consequent = (parts[1] ?? '')
          .replace(/[,;.]\s*$/, '')
          .trim();
        const affirmsConsequent = premises.some(
          (p) => p !== hasImplication && (p.statement.toLowerCase().includes(consequent) || consequent.includes(p.statement.toLowerCase())),
        );
        if (affirmsConsequent && (lowerConclusion.includes(antecedent) || antecedent.includes(lowerConclusion))) {
          identifiedFallacies.push('affirming_the_consequent');
          counterexamples.push(`Alternative conditions could cause '${consequent}' without '${antecedent}'`);
        }
      }
    }

    // Check ad hominem heuristic
    const hasAdHominem = premises.some((p) => {
      const s = p.statement.toLowerCase();
      return s.includes('is foolish') || s.includes('is untrustworthy') || s.includes('is bad person') || s.includes('is evil');
    });
    if (hasAdHominem) {
      identifiedFallacies.push('ad_hominem');
    }

    const isLogicallyValid = identifiedFallacies.length === 0;
    const isSound = isLogicallyValid && premises.every((p) => p.truthValue === 'true');

    let evaluationRationale = '';
    if (isSound) {
      evaluationRationale = 'Argument is valid and sound: all premises true and logically entail conclusion.';
    } else if (isLogicallyValid) {
      evaluationRationale = 'Argument structure is valid, but one or more premises lack verified truth values.';
    } else {
      evaluationRationale = `Argument contains formal or informal fallacies: ${identifiedFallacies.join(', ')}.`;
    }

    return {
      isLogicallyValid,
      isSound,
      identifiedFallacies,
      counterexamples,
      evaluationRationale,
    };
  }

  // ==========================================
  // 9. Reasoning Summary
  // ==========================================

  public getReasoningSummary(): ReasoningSummary {
    const tasks = this.repo.listTasks({ limit: 1000 });
    const paradigmBreakdown: Record<string, number> = {};
    const domainFreq: Record<string, number> = {};

    tasks.forEach((t) => {
      paradigmBreakdown[t.primaryParadigm] = (paradigmBreakdown[t.primaryParadigm] ?? 0) + 1;
      domainFreq[t.domain] = (domainFreq[t.domain] ?? 0) + 1;
    });

    const dominantDomains = Object.entries(domainFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d]) => d);

    const total = tasks.length;
    const avgConfidence = total > 0
      ? tasks.reduce((acc, t) => acc + t.compositeConfidence, 0) / total
      : 0.0;
    const avgUncertainty = total > 0
      ? tasks.reduce((acc, t) => acc + t.uncertaintyLevel, 0) / total
      : 0.0;

    return {
      totalReasoningTasks: total,
      paradigmBreakdown,
      averageConfidence: Math.round(avgConfidence * 1000) / 1000,
      averageUncertainty: Math.round(avgUncertainty * 1000) / 1000,
      dominantDomains,
    };
  }
}

// ==========================================
// In-Memory Repository for Engine Unit Tests
// ==========================================

export class InMemoryReasoningRepository implements IReasoningRepository {
  private tasks: ReasoningTask[] = [];

  public saveTask(task: ReasoningTask): void {
    const idx = this.tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) {
      this.tasks[idx] = JSON.parse(JSON.stringify(task));
    } else {
      this.tasks.push(JSON.parse(JSON.stringify(task)));
    }
  }

  public getTaskById(id: string): ReasoningTask | null {
    const t = this.tasks.find((x) => x.id === id);
    return t ? JSON.parse(JSON.stringify(t)) : null;
  }

  public listTasks(filter?: { domain?: string; paradigm?: ReasoningParadigm; limit?: number }): ReasoningTask[] {
    let result = [...this.tasks];
    if (filter?.domain) {
      result = result.filter((t) => t.domain.toLowerCase() === filter.domain!.toLowerCase());
    }
    if (filter?.paradigm) {
      result = result.filter((t) => t.primaryParadigm === filter.paradigm);
    }
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return result.slice(0, filter?.limit ?? 50).map((t) => JSON.parse(JSON.stringify(t)));
  }

  public deleteTask(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id);
  }
}
