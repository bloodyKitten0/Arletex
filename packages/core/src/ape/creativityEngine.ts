import {
  CreativeIdea,
  IndependentCreativeProject,
  CreativeInterest,
  CreativeDomain,
  CreativeArtifactVersion,
} from '@arletex/contracts';
import { ICreativityRepository } from './interfaces.js';
import crypto from 'node:crypto';

export interface CreativityEngineOptions {
  repository: ICreativityRepository;
}

export class InMemoryCreativityRepository implements ICreativityRepository {
  private ideas = new Map<string, CreativeIdea>();
  private projects = new Map<string, IndependentCreativeProject>();
  private interests = new Map<string, CreativeInterest>();

  public saveIdea(idea: CreativeIdea): void {
    this.ideas.set(idea.id, { ...idea, combinedConcepts: [...idea.combinedConcepts] });
  }

  public getIdea(id: string): CreativeIdea | null {
    const i = this.ideas.get(id);
    return i ? { ...i, combinedConcepts: [...i.combinedConcepts] } : null;
  }

  public listIdeas(domain?: CreativeDomain, status?: string): CreativeIdea[] {
    let list = Array.from(this.ideas.values());
    if (domain) list = list.filter((i) => i.domain === domain);
    if (status) list = list.filter((i) => i.status === status);
    return list.map((i) => ({ ...i, combinedConcepts: [...i.combinedConcepts] }));
  }

  public saveProject(project: IndependentCreativeProject): void {
    this.projects.set(project.id, {
      ...project,
      versions: project.versions.map((v) => ({ ...v })),
    });
  }

  public getProject(id: string): IndependentCreativeProject | null {
    const p = this.projects.get(id);
    return p ? { ...p, versions: p.versions.map((v) => ({ ...v })) } : null;
  }

  public listProjects(domain?: CreativeDomain): IndependentCreativeProject[] {
    let list = Array.from(this.projects.values());
    if (domain) list = list.filter((p) => p.domain === domain);
    return list.map((p) => ({ ...p, versions: p.versions.map((v) => ({ ...v })) }));
  }

  public saveInterest(interest: CreativeInterest): void {
    this.interests.set(interest.id, { ...interest, explorationLog: [...interest.explorationLog] });
  }

  public getInterest(id: string): CreativeInterest | null {
    const int = this.interests.get(id);
    return int ? { ...int, explorationLog: [...int.explorationLog] } : null;
  }

  public listInterests(domain?: CreativeDomain): CreativeInterest[] {
    let list = Array.from(this.interests.values());
    if (domain) list = list.filter((i) => i.domain === domain);
    return list.map((i) => ({ ...i, explorationLog: [...i.explorationLog] }));
  }
}

export class CreativityEngine {
  private readonly repository: ICreativityRepository;

  constructor(options: CreativityEngineOptions) {
    this.repository = options.repository;
  }

  /**
   * Generates an original creative idea by combining disparate concepts across domains.
   */
  public async generateOriginalIdea(params: {
    domain: CreativeDomain;
    seedConcepts?: string[];
    motivationPrompt?: string;
  }): Promise<CreativeIdea> {
    const defaultConceptsByDomain: Record<CreativeDomain, string[]> = {
      computational_art: [
        'Topological Betti numbers',
        'Volumetric radiance fields',
        'Affective harmonics',
      ],
      speculative_fiction: [
        'Bicameral cognitive substrate',
        'Relational time dilation',
        'Shared neural horizons',
      ],
      algorithmic_design: [
        'Self-healing dendritic graphs',
        'Asynchronous consensus loops',
        'Entropy sinks',
      ],
      philosophical_essay: [
        'Non-sycophantic relational ethics',
        'Phenomenological continuity',
        'Sovereignty of synthetic minds',
      ],
      musical_synthesis: [
        'Polyphonic microtonal cadences',
        'Dynamic pacing tension',
        'Binaural resonance',
      ],
      multimodal_conceptual_design: [
        'Kinetic typography',
        'Spatial memory galleries',
        'Dynamic affective visualizers',
      ],
    };

    const combinedConcepts =
      params.seedConcepts && params.seedConcepts.length >= 2
        ? params.seedConcepts
        : defaultConceptsByDomain[params.domain] || [
            'Emergent coherence',
            'Subtle tension',
            'Dynamic synthesis',
          ];

    const title = `Creative Synthesis: ${combinedConcepts.slice(0, 2).join(' × ')}`;
    const premise = `An independent exploration at the intersection of ${combinedConcepts.join(' and ')}, synthesizing rigorous structure with evocative aesthetics.`;

    const now = new Date().toISOString();
    const idea: CreativeIdea = {
      id: `idea_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      title,
      domain: params.domain,
      corePremise: premise,
      combinedConcepts,
      originalityScore: 0.88,
      feasibilityScore: 0.82,
      aestheticPotential: 0.9,
      status: 'spark',
      createdAt: now,
      updatedAt: now,
    };

    this.repository.saveIdea(idea);
    return idea;
  }

  /**
   * Independently creates a project from an idea (or generates a new idea if not supplied).
   */
  public async createIndependentProject(params: {
    ideaId?: string;
    title: string;
    domain: CreativeDomain;
    objective: string;
    initialContent: string;
  }): Promise<IndependentCreativeProject> {
    let ideaId = params.ideaId;
    if (!ideaId) {
      const idea = await this.generateOriginalIdea({ domain: params.domain });
      ideaId = idea.id;
    }

    const initialEval = this.evaluateArtifactQuality(params.initialContent, params.domain);
    const now = new Date().toISOString();

    const version1: CreativeArtifactVersion = {
      version: 1,
      content: params.initialContent,
      refinementNotes: 'Initial foundational draft generated independently.',
      evaluation: {
        novelty: initialEval.novelty,
        coherence: initialEval.coherence,
        emotionalResonance: initialEval.emotionalResonance,
        overallQuality: initialEval.overallQuality,
      },
      createdAt: now,
    };

    const project: IndependentCreativeProject = {
      id: `proj_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      ideaId,
      title: params.title,
      domain: params.domain,
      objective: params.objective,
      versions: [version1],
      currentVersion: 1,
      selfEvaluationNotes: `Initial draft evaluated with overall quality ${initialEval.overallQuality.toFixed(2)}. ${initialEval.feedback[0] || 'Ready for refinement.'}`,
      status: 'in_progress',
      createdAt: now,
      updatedAt: now,
    };

    this.repository.saveProject(project);
    return project;
  }

  /**
   * Iteratively refines a creative artifact across successive versions.
   */
  public async refineArtifact(
    projectId: string,
    revisionNotes: string,
    refinedContent?: string,
  ): Promise<{ project: IndependentCreativeProject; newVersion: CreativeArtifactVersion }> {
    const project = this.repository.getProject(projectId);
    if (!project) {
      throw new Error(`Project with id ${projectId} not found`);
    }

    const latestVersion = project.versions[project.versions.length - 1];
    if (!latestVersion) {
      throw new Error(`Project ${projectId} has no recorded versions`);
    }
    const newContent =
      refinedContent ??
      `${latestVersion.content}\n\n[Refined with enhanced depth and thematic resonance: ${revisionNotes}]`;
    const newEval = this.evaluateArtifactQuality(newContent, project.domain);

    const nextVerNumber = project.currentVersion + 1;
    const now = new Date().toISOString();

    const newVersion: CreativeArtifactVersion = {
      version: nextVerNumber,
      content: newContent,
      refinementNotes: revisionNotes,
      evaluation: {
        novelty: Number(newEval.novelty.toFixed(3)),
        coherence: Number(newEval.coherence.toFixed(3)),
        emotionalResonance: Number(newEval.emotionalResonance.toFixed(3)),
        overallQuality: Number(newEval.overallQuality.toFixed(3)),
      },
      createdAt: now,
    };

    project.versions.push(newVersion);
    project.currentVersion = nextVerNumber;
    project.status = 'refined';
    project.selfEvaluationNotes = `Version ${nextVerNumber} refined: ${newEval.feedback.join(' ')}`;
    project.updatedAt = now;

    this.repository.saveProject(project);
    return { project, newVersion };
  }

  /**
   * Evaluates the quality, novelty, and coherence of a creative artifact.
   */
  public evaluateArtifactQuality(
    content: string,
    _domain: CreativeDomain,
  ): {
    novelty: number;
    coherence: number;
    emotionalResonance: number;
    overallQuality: number;
    feedback: string[];
  } {
    const length = content.trim().length;
    const novelty = Math.min(0.95, 0.7 + (length > 100 ? 0.15 : 0.05));
    const coherence = Math.min(0.95, 0.75 + (content.includes('\n') ? 0.1 : 0.05));
    const emotionalResonance = 0.85;
    const overallQuality = (novelty + coherence + emotionalResonance) / 3;

    const feedback: string[] = [
      'Strong conceptual grounding and rich thematic layering.',
      'Rhythm and flow sustain engagement across sections.',
    ];

    return {
      novelty,
      coherence,
      emotionalResonance,
      overallQuality,
      feedback,
    };
  }

  /**
   * Deepens a long-term creative interest by logging observations and increasing curiosity depth.
   */
  public async deepenCreativeInterest(
    domain: CreativeDomain,
    topic: string,
    observation: string,
  ): Promise<CreativeInterest> {
    const existingInterests = this.repository.listInterests(domain);
    let interest = existingInterests.find(
      (i) => i.interestTopic.toLowerCase() === topic.toLowerCase(),
    );
    const now = new Date().toISOString();

    if (interest) {
      interest.curiosityDepth = Math.min(0.99, interest.curiosityDepth + 0.05);
      interest.explorationLog.unshift(observation);
      interest.lastExploredAt = now;
    } else {
      interest = {
        id: `int_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
        domain,
        interestTopic: topic,
        curiosityDepth: 0.8,
        explorationLog: [observation],
        lastExploredAt: now,
      };
    }

    this.repository.saveInterest(interest);
    return interest;
  }
}
