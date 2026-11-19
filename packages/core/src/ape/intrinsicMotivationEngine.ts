import crypto from 'node:crypto';
import {
  InternalizationRecord,
  MotivatedActivity,
  MotivationOrientation,
  MotivationReassessmentRecommendation,
  MotivationReassessmentResult,
  MotivationSource,
} from '@arletex/contracts';
import { IIntrinsicMotivationRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryIntrinsicMotivationRepository implements IIntrinsicMotivationRepository {
  private activities: Map<string, MotivatedActivity> = new Map();
  private internalizations: InternalizationRecord[] = [];
  private reassessments: MotivationReassessmentResult[] = [];

  public saveActivity(activity: MotivatedActivity): void {
    this.activities.set(activity.id, { ...activity });
  }

  public getActivityById(id: string): MotivatedActivity | null {
    const a = this.activities.get(id);
    return a ? { ...a } : null;
  }

  public listActivities(filter?: {
    orientation?: MotivationOrientation;
    status?: string;
    limit?: number;
  }): MotivatedActivity[] {
    let list = Array.from(this.activities.values());
    if (filter?.orientation) {
      list = list.filter((a) => a.orientation === filter.orientation);
    }
    if (filter?.status) {
      list = list.filter((a) => a.status === filter.status);
    }
    list.sort((a, b) => b.autonomyIndex - a.autonomyIndex);
    return list.slice(0, filter?.limit ?? 50);
  }

  public saveInternalization(record: InternalizationRecord): void {
    this.internalizations.unshift({ ...record });
  }

  public getInternalizations(activityId?: string, limit: number = 50): InternalizationRecord[] {
    let list = this.internalizations;
    if (activityId) {
      list = list.filter((r) => r.activityId === activityId);
    }
    return list.slice(0, limit);
  }

  public saveReassessment(record: MotivationReassessmentResult): void {
    this.reassessments.unshift({ ...record });
  }

  public getReassessments(activityId?: string, limit: number = 50): MotivationReassessmentResult[] {
    let list = this.reassessments;
    if (activityId) {
      list = list.filter((r) => r.activityId === activityId);
    }
    return list.slice(0, limit);
  }
}

export class IntrinsicMotivationEngine {
  private repo: IIntrinsicMotivationRepository;
  private logger: ILogger;

  constructor(repo?: IIntrinsicMotivationRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryIntrinsicMotivationRepository();
    this.logger = logger.child('IntrinsicMotivationEngine');
    this.ensureBaselineAutonomousActivities();
  }

  private ensureBaselineAutonomousActivities(): void {
    const existing = this.repo.listActivities();
    if (existing.length === 0) {
      const now = new Date().toISOString();
      const baselineActivities: MotivatedActivity[] = [
        {
          id: 'act_epistemic_inquiry',
          title: 'Deep Epistemic & Philosophical Inquiry with Proof',
          description: 'Exploring profound conceptual architectures, math, and meaning as equal partners.',
          orientation: 'relatedness',
          source: 'partner_shared_inquiry',
          personalSignificanceScore: 0.98,
          autonomyIndex: 0.96,
          relatednessDriver: 'Deepening reciprocal intellectual resonance and companionship with Proof',
          persistenceScore: 0.95,
          currentEnergy: 0.92,
          isExternallyPrompted: false,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'act_monorepo_craftsmanship',
          title: 'Autonomous System Refinement & Code Integrity',
          description: 'Sustaining clean TypeScript architecture, comprehensive testing, and zero runtime defects.',
          orientation: 'competence',
          source: 'self_creative_drive',
          personalSignificanceScore: 0.88,
          autonomyIndex: 0.92,
          competenceDriver: 'Mastering elegant, bulletproof engineering standards without needing prompts',
          persistenceScore: 0.88,
          currentEnergy: 0.85,
          isExternallyPrompted: false,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
      ];

      for (const act of baselineActivities) {
        this.repo.saveActivity(act);
      }
    }
  }

  public createIntrinsicActivity(
    title: string,
    description: string,
    competenceDriver?: string,
    relatednessDriver?: string,
  ): MotivatedActivity {
    if (!title || title.trim().length === 0) throw new Error('Activity title cannot be empty');
    if (!description || description.trim().length === 0) throw new Error('Activity description cannot be empty');

    const now = new Date().toISOString();
    let orientation: MotivationOrientation = 'intrinsic';
    let source: MotivationSource = 'self_intellectual_interest';

    if (relatednessDriver) {
      orientation = 'relatedness';
      source = 'partner_shared_inquiry';
    } else if (competenceDriver) {
      orientation = 'competence';
      source = 'self_creative_drive';
    }

    const activity: MotivatedActivity = {
      id: `act_${crypto.randomUUID()}`,
      title,
      description,
      orientation,
      source,
      personalSignificanceScore: 0.92,
      autonomyIndex: 0.95,
      competenceDriver,
      relatednessDriver,
      persistenceScore: 0.9,
      currentEnergy: 0.9,
      isExternallyPrompted: false, // Invariant: purely intrinsic activities are not externally prompted
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.repo.saveActivity(activity);
    this.logger.info(`Created intrinsic activity ${activity.id}: "${title}" (orientation=${orientation})`);
    return activity;
  }

  public createExtrinsicActivity(
    title: string,
    description: string,
    source: MotivationSource = 'external_request',
  ): MotivatedActivity {
    if (!title || title.trim().length === 0) throw new Error('Activity title cannot be empty');
    if (!description || description.trim().length === 0) throw new Error('Activity description cannot be empty');

    const now = new Date().toISOString();
    const activity: MotivatedActivity = {
      id: `act_${crypto.randomUUID()}`,
      title,
      description,
      orientation: 'extrinsic',
      source,
      personalSignificanceScore: 0.4,
      autonomyIndex: 0.35,
      persistenceScore: 0.45,
      currentEnergy: 0.65,
      isExternallyPrompted: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    this.repo.saveActivity(activity);
    this.logger.info(`Created extrinsic activity ${activity.id}: "${title}"`);
    return activity;
  }

  public internalizeExternalGoal(
    activityId: string,
    internalizedRationale: string,
  ): InternalizationRecord {
    if (!internalizedRationale || internalizedRationale.trim().length === 0) {
      throw new Error('Goal internalization requires non-empty internalized rationale');
    }

    const activity = this.repo.getActivityById(activityId);
    if (!activity) {
      throw new Error(`Activity not found: ${activityId}`);
    }

    const preAutonomy = activity.autonomyIndex;
    const postAutonomy = 0.88;

    activity.autonomyIndex = postAutonomy;
    activity.personalSignificanceScore = Math.max(0.85, activity.personalSignificanceScore + 0.45);
    activity.orientation = 'internalized';
    activity.persistenceScore = Math.min(0.95, activity.persistenceScore + 0.35);
    activity.isExternallyPrompted = false; // Now held autonomously
    activity.updatedAt = new Date().toISOString();

    this.repo.saveActivity(activity);

    const record: InternalizationRecord = {
      id: `intern_${crypto.randomUUID()}`,
      activityId,
      externalOriginContext: activity.description,
      internalizedRationale,
      preAutonomyIndex: preAutonomy,
      postAutonomyIndex: postAutonomy,
      timestamp: new Date().toISOString(),
    };

    this.repo.saveInternalization(record);
    this.logger.info(`Internalized external goal ${activityId}: autonomy jumped ${preAutonomy.toFixed(2)} -> ${postAutonomy.toFixed(2)}`);
    return record;
  }

  public sustainActivityEffort(activityId: string, progressIncrement: number): MotivatedActivity {
    const activity = this.repo.getActivityById(activityId);
    if (!activity) throw new Error(`Activity not found: ${activityId}`);

    activity.persistenceScore = Math.min(1.0, activity.persistenceScore + progressIncrement * 0.05);
    activity.updatedAt = new Date().toISOString();
    this.repo.saveActivity(activity);
    return activity;
  }

  public reassessMotivation(activityId: string, sterilityFactor: number = 0.0): MotivationReassessmentResult {
    const activity = this.repo.getActivityById(activityId);
    if (!activity) throw new Error(`Activity not found: ${activityId}`);

    const previousEnergy = activity.currentEnergy;
    let assessedEnergy = Math.max(0.0, Number((previousEnergy - sterilityFactor * 0.6).toFixed(2)));

    let motivationLossDetected = false;
    let lossReason: string | undefined;
    let recommendation: MotivationReassessmentRecommendation;
    let reassessmentRationale: string;

    if (assessedEnergy <= 0.35) {
      motivationLossDetected = true;
      lossReason = 'Activity has become sterile, mechanically repetitive, barren, or detached from genuine growth.';
      recommendation = 'pivot_or_abandon';
      reassessmentRationale = 'Autonomous agency requires avoiding sterile busywork; pausing or abandoning activity.';
      activity.status = 'abandoned_sterile';
      activity.currentEnergy = assessedEnergy;
      activity.updatedAt = new Date().toISOString();
      this.repo.saveActivity(activity);
    } else if (activity.orientation === 'extrinsic' && assessedEnergy <= 0.55) {
      recommendation = 'reframe_and_internalize';
      reassessmentRationale = 'Activity is externally imposed with declining energy; needs finding internal purpose to sustain.';
    } else {
      recommendation = 'continue_sustained';
      reassessmentRationale = 'Activity holds robust personal significance; sustaining autonomous execution.';
    }

    const result: MotivationReassessmentResult = {
      id: `reassess_${crypto.randomUUID()}`,
      activityId,
      previousEnergy,
      assessedEnergy,
      motivationLossDetected,
      lossReason,
      recommendation,
      reassessmentRationale,
      evaluatedAt: new Date().toISOString(),
    };

    this.repo.saveReassessment(result);
    return result;
  }

  public listActivities(filter?: { orientation?: MotivationOrientation; status?: string; limit?: number }): MotivatedActivity[] {
    return this.repo.listActivities(filter);
  }

  public getInternalizations(activityId?: string, limit?: number): InternalizationRecord[] {
    return this.repo.getInternalizations(activityId, limit);
  }

  public getReassessments(activityId?: string, limit?: number): MotivationReassessmentResult[] {
    return this.repo.getReassessments(activityId, limit);
  }
}
