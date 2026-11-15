import crypto from 'node:crypto';
import {
  ApePersonalProject,
  ApeProjectCategory,
  ApeProjectDeliverable,
  ApeProjectMilestone,
  ApeProjectResourceBudget,
  ApeProjectStatus,
} from '@arletex/contracts';
import { IApeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export interface ProposeProjectInput {
  title: string;
  description: string;
  category: ApeProjectCategory;
  motivation: string;
  associatedInterestTopic?: string;
  milestones?: Array<{ title: string }>;
  deliverables?: Array<Omit<ApeProjectDeliverable, 'id' | 'verifiedAt'>>;
  relatedGoalIds?: string[];
  resourceBudget?: Partial<ApeProjectResourceBudget>;
  status?: ApeProjectStatus;
}

export class PersonalProjectService {
  private readonly repo: IApeRepository;
  private readonly logger: ILogger;

  constructor(repo: IApeRepository, logger: ILogger = rootLogger) {
    this.repo = repo;
    this.logger = logger.child('PersonalProjectService');
  }

  /**
   * Proposes a new personal project (Pillar 4).
   */
  public proposeProject(input: ProposeProjectInput): ApePersonalProject {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const milestones: ApeProjectMilestone[] = (input.milestones || []).map((m) => ({
      id: crypto.randomUUID(),
      title: m.title,
      completed: false,
    }));

    const deliverables: ApeProjectDeliverable[] = (input.deliverables || []).map((d) => ({
      id: crypto.randomUUID(),
      title: d.title,
      type: d.type,
      contentOrPath: d.contentOrPath,
      verifiedAt: now,
    }));

    const resourceBudget: ApeProjectResourceBudget = {
      cpu: input.resourceBudget?.cpu ?? 'medium',
      gpu: input.resourceBudget?.gpu ?? false,
      maxDurationMs: input.resourceBudget?.maxDurationMs ?? 300000,
    };

    const project: ApePersonalProject = {
      id,
      title: input.title,
      description: input.description,
      category: input.category,
      status: input.status ?? 'proposed',
      progress: 0.0,
      motivation: input.motivation,
      associatedInterestTopic: input.associatedInterestTopic,
      milestones,
      deliverables,
      relatedGoalIds: input.relatedGoalIds ?? [],
      resourceBudget,
      createdAt: now,
      updatedAt: now,
    };

    const saved = this.repo.createPersonalProject(project);
    this.logger.info(
      `Personal project proposed [${saved.category}, status=${saved.status}]: "${saved.title}" (ID: ${saved.id})`,
    );
    return saved;
  }

  /**
   * Activates a proposed or paused project into active execution.
   */
  public activateProject(projectId: string): ApePersonalProject {
    const project = this.repo.getPersonalProjectById(projectId);
    if (!project) {
      throw new Error(`Personal project with id ${projectId} not found`);
    }

    const updated = this.repo.updatePersonalProject({
      id: projectId,
      status: 'active',
      abandonmentReason: undefined,
    });
    this.logger.info(`Personal project activated: "${updated.title}"`);
    return updated;
  }

  /**
   * Records verifiable progress on a specific project milestone.
   */
  public recordMilestoneProgress(projectId: string, milestoneId: string, evidence: string): ApePersonalProject {
    const project = this.repo.getPersonalProjectById(projectId);
    if (!project) {
      throw new Error(`Personal project with id ${projectId} not found`);
    }

    const milestones = project.milestones.map((m) => {
      if (m.id === milestoneId) {
        return {
          ...m,
          completed: true,
          evidence,
          completedAt: new Date().toISOString(),
        };
      }
      return m;
    });

    const completedCount = milestones.filter((m) => m.completed).length;
    const progress = milestones.length > 0 ? Number((completedCount / milestones.length).toFixed(3)) : 1.0;
    const status: ApeProjectStatus = progress >= 1.0 ? 'completed' : project.status;

    const updated = this.repo.updatePersonalProject({
      id: projectId,
      milestones,
      progress,
      status,
    });
    this.logger.info(
      `Milestone completed for project "${updated.title}": "${evidence}" (Progress: ${(progress * 100).toFixed(1)}%)`,
    );
    return updated;
  }

  /**
   * Records a tangible project deliverable with verification timestamp.
   */
  public recordDeliverable(
    projectId: string,
    deliverable: Omit<ApeProjectDeliverable, 'id' | 'verifiedAt'>,
  ): ApePersonalProject {
    const project = this.repo.getPersonalProjectById(projectId);
    if (!project) {
      throw new Error(`Personal project with id ${projectId} not found`);
    }

    const newDeliverable: ApeProjectDeliverable = {
      id: crypto.randomUUID(),
      title: deliverable.title,
      type: deliverable.type,
      contentOrPath: deliverable.contentOrPath,
      verifiedAt: new Date().toISOString(),
    };

    const deliverables = [...project.deliverables, newDeliverable];
    // Deliverables contribute to tangible outcome progress
    const progress = Math.min(1.0, Number((project.progress + 0.25).toFixed(3)));
    const status: ApeProjectStatus = progress >= 1.0 ? 'completed' : project.status;

    const updated = this.repo.updatePersonalProject({
      id: projectId,
      deliverables,
      progress,
      status,
    });
    this.logger.info(
      `Deliverable recorded for project "${updated.title}": [${newDeliverable.type}] ${newDeliverable.title}`,
    );
    return updated;
  }

  /**
   * Pauses an active project when higher priorities emerge.
   */
  public pauseProject(projectId: string, reason: string): ApePersonalProject {
    const project = this.repo.getPersonalProjectById(projectId);
    if (!project) {
      throw new Error(`Personal project with id ${projectId} not found`);
    }

    const updated = this.repo.updatePersonalProject({
      id: projectId,
      status: 'paused',
    });
    this.logger.info(`Personal project paused: "${updated.title}" (Reason: ${reason})`);
    return updated;
  }

  /**
   * Resumes a paused project.
   */
  public resumeProject(projectId: string): ApePersonalProject {
    return this.activateProject(projectId);
  }

  /**
   * Abandons a project with truthful justification.
   */
  public abandonProject(projectId: string, justification: string): ApePersonalProject {
    const project = this.repo.getPersonalProjectById(projectId);
    if (!project) {
      throw new Error(`Personal project with id ${projectId} not found`);
    }

    const updated = this.repo.updatePersonalProject({
      id: projectId,
      status: 'abandoned',
      abandonmentReason: justification,
    });
    this.logger.info(`Personal project abandoned: "${updated.title}" (Justification: ${justification})`);
    return updated;
  }

  /**
   * Marks a project completed.
   */
  public completeProject(projectId: string): ApePersonalProject {
    const project = this.repo.getPersonalProjectById(projectId);
    if (!project) {
      throw new Error(`Personal project with id ${projectId} not found`);
    }

    const updated = this.repo.updatePersonalProject({
      id: projectId,
      status: 'completed',
      progress: 1.0,
    });
    this.logger.info(`Personal project completed: "${updated.title}"`);
    return updated;
  }

  public getProject(projectId: string): ApePersonalProject | null {
    return this.repo.getPersonalProjectById(projectId);
  }

  public listProjects(filter?: { status?: ApeProjectStatus; category?: ApeProjectCategory }): ApePersonalProject[] {
    return this.repo.listPersonalProjects(filter);
  }

  /**
   * Manages multiple concurrent projects, ranking active projects by importance and progress,
   * without treating them as homogeneous or equally urgent.
   */
  public rankActiveProjects(): {
    primaryFocus: ApePersonalProject | null;
    secondaryProjects: ApePersonalProject[];
    deferredProjects: ApePersonalProject[];
  } {
    const active = this.repo.listPersonalProjects({ status: 'active' });
    if (active.length === 0) {
      return { primaryFocus: null, secondaryProjects: [], deferredProjects: [] };
    }

    // Rank projects by category weight and milestone completion momentum
    const categoryWeights: Record<ApeProjectCategory, number> = {
      research: 0.9,
      learning: 0.85,
      software: 0.8,
      creative: 0.75,
      philosophical: 0.7,
      system: 0.65,
      worldbuilding: 0.6,
    };

    const scored = active.map((p) => {
      const weight = categoryWeights[p.category] ?? 0.5;
      const momentumScore = p.progress * 0.4 + weight * 0.6;
      return { project: p, score: momentumScore };
    });

    scored.sort((a, b) => b.score - a.score);

    const primaryFocus = scored[0]?.project ?? null;
    const secondaryProjects = scored.slice(1, 3).map((s) => s.project);
    const deferredProjects = scored.slice(3).map((s) => s.project);

    return { primaryFocus, secondaryProjects, deferredProjects };
  }
}
