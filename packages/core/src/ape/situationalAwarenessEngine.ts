import crypto from 'node:crypto';
import {
  ActiveApplication,
  ActivityCategory,
  ActivityStatus,
  EnvironmentalEvent,
  EventLayer,
  OperationalActivity,
  SituationalContextSnapshot,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ISituationalRepository } from './interfaces.js';

export interface SituationalAwarenessEngineOptions {
  repository: ISituationalRepository;
  logger?: ILogger;
}

export interface StartActivityOptions {
  id?: string;
  title: string;
  description: string;
  category: ActivityCategory;
  activeApplication?: Partial<ActiveApplication>;
  associatedGoalId?: string | null;
}

export interface SituationalDescription {
  currentActivityDescription: string;
  recentChanges: string[];
  prioritizedRelevantEvents: EnvironmentalEvent[];
  foregroundEvents: EnvironmentalEvent[];
  backgroundEvents: EnvironmentalEvent[];
  isCurrentlyEngaged: boolean;
  activeApplicationName: string;
}

export class SituationalAwarenessEngine {
  private readonly repo: ISituationalRepository;
  private readonly logger: ILogger;
  private currentActiveApp: ActiveApplication = {
    name: 'Arletex Desktop',
    windowTitle: 'Arletex Main Window',
    isForeground: true,
  };

  constructor(options: SituationalAwarenessEngineOptions) {
    this.repo = options.repository;
    this.logger = (options.logger || rootLogger).child('SituationalAwarenessEngine');
  }

  // ==========================================
  // 1. Operational Activity Management
  // ==========================================

  public startActivity(options: StartActivityOptions): OperationalActivity {
    const now = new Date().toISOString();

    // If there is currently an active activity, pause it before starting the new one
    const current = this.repo.getActiveActivity();
    if (current && current.status === 'active') {
      const paused: OperationalActivity = {
        ...current,
        status: 'paused',
        lastActiveAt: now,
      };
      this.repo.saveActivity(paused);
      this.logger.info(
        `Paused ongoing activity ${current.id} (${current.title}) to start new activity`,
      );
    }

    const activeApp: ActiveApplication = {
      name: options.activeApplication?.name ?? this.currentActiveApp.name,
      windowTitle: options.activeApplication?.windowTitle ?? this.currentActiveApp.windowTitle,
      pid: options.activeApplication?.pid ?? this.currentActiveApp.pid,
      isForeground: options.activeApplication?.isForeground ?? true,
    };

    const activity: OperationalActivity = {
      id: options.id || crypto.randomUUID(),
      title: options.title,
      description: options.description,
      category: options.category,
      status: 'active',
      startedAt: now,
      lastActiveAt: now,
      activeApplication: activeApp,
      associatedGoalId: options.associatedGoalId ?? undefined,
    };

    this.repo.saveActivity(activity);
    this.logger.info(`Started operational activity: ${activity.title} [${activity.id}]`);
    return activity;
  }

  public updateActiveApplication(
    app: Partial<ActiveApplication> & { name: string },
  ): ActiveApplication {
    const updated: ActiveApplication = {
      name: app.name,
      windowTitle: app.windowTitle ?? this.currentActiveApp.windowTitle,
      pid: app.pid ?? this.currentActiveApp.pid,
      isForeground: app.isForeground ?? true,
    };

    const prevApp = this.currentActiveApp;
    this.currentActiveApp = updated;

    // Check if the current activity's application needs updating
    const currentActivity = this.repo.getActiveActivity();
    if (currentActivity && currentActivity.status === 'active') {
      const updatedActivity: OperationalActivity = {
        ...currentActivity,
        activeApplication: updated,
        lastActiveAt: new Date().toISOString(),
      };
      this.repo.saveActivity(updatedActivity);
    }

    if (prevApp.name !== updated.name) {
      this.recordEnvironmentalEvent({
        eventType: 'window_focus_change',
        layer: updated.isForeground ? 'foreground' : 'background',
        description: `Active application switched from ${prevApp.name} to ${updated.name}`,
        source: 'window_manager',
        relevanceScore: 0.6,
        isInterruption: false,
      });
    }

    return updated;
  }

  public getActiveActivity(): OperationalActivity | null {
    return this.repo.getActiveActivity();
  }

  public completeActivity(activityId?: string): OperationalActivity | null {
    const activity = activityId
      ? this.repo.getActivityById(activityId)
      : this.repo.getActiveActivity();

    if (!activity) return null;

    const completed: OperationalActivity = {
      ...activity,
      status: 'completed',
      lastActiveAt: new Date().toISOString(),
    };
    this.repo.saveActivity(completed);
    this.logger.info(`Completed operational activity: ${completed.title} [${completed.id}]`);
    return completed;
  }

  public pauseActivity(activityId?: string): OperationalActivity | null {
    const activity = activityId
      ? this.repo.getActivityById(activityId)
      : this.repo.getActiveActivity();

    if (!activity) return null;

    const paused: OperationalActivity = {
      ...activity,
      status: 'paused',
      lastActiveAt: new Date().toISOString(),
    };
    this.repo.saveActivity(paused);
    this.logger.info(`Paused operational activity: ${paused.title} [${paused.id}]`);
    return paused;
  }

  public resumeActivity(activityId: string): OperationalActivity {
    const activity = this.repo.getActivityById(activityId);
    if (!activity) {
      throw new Error(`Operational activity ${activityId} not found`);
    }

    // Pause any other currently active activity
    const currentActive = this.repo.getActiveActivity();
    if (currentActive && currentActive.id !== activityId) {
      this.repo.saveActivity({
        ...currentActive,
        status: 'paused',
        lastActiveAt: new Date().toISOString(),
      });
    }

    const resumed: OperationalActivity = {
      ...activity,
      status: 'active',
      lastActiveAt: new Date().toISOString(),
    };
    this.repo.saveActivity(resumed);
    this.logger.info(`Resumed operational activity: ${resumed.title} [${resumed.id}]`);
    return resumed;
  }

  // ==========================================
  // 2. Environmental Events & Interruption Detection
  // ==========================================

  public recordEnvironmentalEvent(
    eventInput: Omit<EnvironmentalEvent, 'id' | 'timestamp'> & {
      id?: string;
      timestamp?: string;
    },
  ): EnvironmentalEvent {
    const event: EnvironmentalEvent = {
      id: eventInput.id || crypto.randomUUID(),
      timestamp: eventInput.timestamp || new Date().toISOString(),
      eventType: eventInput.eventType,
      layer: eventInput.layer,
      description: eventInput.description,
      source: eventInput.source,
      relevanceScore: Math.max(0, Math.min(1, eventInput.relevanceScore ?? 0.5)),
      isInterruption: eventInput.isInterruption ?? false,
      interruptedActivityId: eventInput.interruptedActivityId,
    };

    // If marked as an interruption or high-priority interruption event, handle active activity transition
    if (event.isInterruption) {
      const active = this.repo.getActiveActivity();
      if (active && active.status === 'active') {
        event.interruptedActivityId = active.id;
        const interrupted: OperationalActivity = {
          ...active,
          status: 'interrupted',
          lastActiveAt: event.timestamp,
        };
        this.repo.saveActivity(interrupted);
        this.logger.warn(
          `Operational activity ${active.id} interrupted by event: ${event.description}`,
        );
      }
    }

    this.repo.recordEnvironmentalEvent(event);
    return event;
  }

  public handleInterruption(interruption: {
    description: string;
    source: string;
    eventType?: EnvironmentalEvent['eventType'];
    relevanceScore?: number;
  }): EnvironmentalEvent {
    return this.recordEnvironmentalEvent({
      eventType: interruption.eventType || 'system_alert',
      layer: 'foreground',
      description: interruption.description,
      source: interruption.source,
      relevanceScore: interruption.relevanceScore ?? 0.85,
      isInterruption: true,
    });
  }

  // ==========================================
  // 3. Situational Description & Acceptance Criteria
  // ==========================================

  /**
   * Fulfills acceptance criteria:
   * Arle must be able to describe what she is currently doing,
   * what has changed, and which events are relevant to her active objectives.
   *
   * Negative invariant:
   * Do not confuse background ambient events with active foreground pursuits.
   * Do not claim an activity is active if it was interrupted/paused.
   */
  public describeCurrentSituation(): SituationalDescription {
    const currentActivity = this.repo.getActiveActivity();
    const recentEvents = this.repo.listEnvironmentalEvents({ limit: 15 });

    // Distinct separation: foreground vs background
    const foregroundEvents = recentEvents.filter((e) => e.layer === 'foreground');
    const backgroundEvents = recentEvents.filter((e) => e.layer === 'background');

    // Prioritized relevant events sorted by relevanceScore descending
    const prioritizedRelevantEvents = [...recentEvents]
      .filter((e) => e.relevanceScore >= 0.5)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);

    const recentChanges = recentEvents
      .filter(
        (e) =>
          e.eventType === 'window_focus_change' ||
          e.eventType === 'app_lifecycle' ||
          e.isInterruption,
      )
      .slice(0, 5)
      .map((e) => `${e.description} (${e.timestamp})`);

    let currentActivityDescription = '';
    let isCurrentlyEngaged = false;

    if (!currentActivity || currentActivity.status !== 'active') {
      const pausedOrInterrupted = this.repo.listActivities(undefined, 1)[0];
      if (
        pausedOrInterrupted &&
        (pausedOrInterrupted.status === 'interrupted' || pausedOrInterrupted.status === 'paused')
      ) {
        currentActivityDescription = `Currently inactive; last activity was '${pausedOrInterrupted.title}' which is currently ${pausedOrInterrupted.status}. Monitoring environment in idle state.`;
      } else {
        currentActivityDescription =
          'Currently idle; no active operational activity. Monitoring environment in background.';
      }
      isCurrentlyEngaged = false;
    } else {
      isCurrentlyEngaged = true;
      currentActivityDescription = `Actively engaged in: '${currentActivity.title}' (${currentActivity.category}) - ${currentActivity.description} in foreground app '${currentActivity.activeApplication.name}'.`;
    }

    return {
      currentActivityDescription,
      recentChanges,
      prioritizedRelevantEvents,
      foregroundEvents,
      backgroundEvents,
      isCurrentlyEngaged,
      activeApplicationName: this.currentActiveApp.name,
    };
  }

  public createSituationalSnapshot(): SituationalContextSnapshot {
    const now = new Date().toISOString();
    const active = this.repo.getActiveActivity();

    // Default fallback activity if none active
    const currentActivity: OperationalActivity = active ?? {
      id: crypto.randomUUID(),
      title: 'Idle Monitoring',
      description: 'Arle is observing ambient system events and maintaining readiness.',
      category: 'idle_monitoring',
      status: 'paused',
      startedAt: now,
      lastActiveAt: now,
      activeApplication: this.currentActiveApp,
    };

    const recentEvents = this.repo.listEnvironmentalEvents({ limit: 30 });
    const foregroundEvents = recentEvents.filter((e) => e.layer === 'foreground');
    const backgroundEvents = recentEvents.filter((e) => e.layer === 'background');
    const activeInterruptions = recentEvents.filter((e) => e.isInterruption);

    const desc = this.describeCurrentSituation();

    const narrative = [
      `[Situational Context at ${now}]`,
      `Activity: ${desc.currentActivityDescription}`,
      `Foreground Events (${foregroundEvents.length}): ${
        foregroundEvents
          .slice(0, 3)
          .map((e) => e.description)
          .join('; ') || 'None'
      }`,
      `Background Events (${backgroundEvents.length}): ${
        backgroundEvents
          .slice(0, 3)
          .map((e) => e.description)
          .join('; ') || 'None'
      }`,
      `Active Interruptions: ${activeInterruptions.length > 0 ? activeInterruptions.map((e) => e.description).join(', ') : 'None'}`,
    ].join(' | ');

    const snapshot: SituationalContextSnapshot = {
      id: crypto.randomUUID(),
      timestamp: now,
      currentActivity,
      activeApplications: [this.currentActiveApp],
      foregroundEvents,
      backgroundEvents,
      activeInterruptions,
      recentChanges: desc.recentChanges,
      situationalNarrative: narrative,
    };

    this.repo.saveSnapshot(snapshot);
    return snapshot;
  }
}

// ==========================================
// In-Memory Repository for Tests & Unit Isolation
// ==========================================

export class InMemorySituationalRepository implements ISituationalRepository {
  private activities: OperationalActivity[] = [];
  private events: EnvironmentalEvent[] = [];
  private snapshots: SituationalContextSnapshot[] = [];

  public saveActivity(activity: OperationalActivity): void {
    const idx = this.activities.findIndex((a) => a.id === activity.id);
    if (idx >= 0) {
      this.activities[idx] = activity;
    } else {
      this.activities.push(activity);
    }
  }

  public getActivityById(id: string): OperationalActivity | null {
    return this.activities.find((a) => a.id === id) || null;
  }

  public getActiveActivity(): OperationalActivity | null {
    return this.activities.find((a) => a.status === 'active') || null;
  }

  public listActivities(status?: ActivityStatus, limit = 50): OperationalActivity[] {
    let result = [...this.activities];
    if (status) {
      result = result.filter((a) => a.status === status);
    }
    result.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
    return result.slice(0, limit);
  }

  public recordEnvironmentalEvent(event: EnvironmentalEvent): void {
    const idx = this.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      this.events[idx] = event;
    } else {
      this.events.push(event);
    }
  }

  public getEnvironmentalEventById(id: string): EnvironmentalEvent | null {
    return this.events.find((e) => e.id === id) || null;
  }

  public listEnvironmentalEvents(filter?: {
    layer?: EventLayer;
    isInterruption?: boolean;
    minRelevance?: number;
    limit?: number;
  }): EnvironmentalEvent[] {
    let result = [...this.events];
    if (filter?.layer) {
      result = result.filter((e) => e.layer === filter.layer);
    }
    if (filter?.isInterruption !== undefined) {
      result = result.filter((e) => e.isInterruption === filter.isInterruption);
    }
    if (filter?.minRelevance !== undefined) {
      result = result.filter((e) => e.relevanceScore >= filter.minRelevance!);
    }
    result.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return result.slice(0, filter?.limit || 50);
  }

  public saveSnapshot(snapshot: SituationalContextSnapshot): void {
    const idx = this.snapshots.findIndex((s) => s.id === snapshot.id);
    if (idx >= 0) {
      this.snapshots[idx] = snapshot;
    } else {
      this.snapshots.push(snapshot);
    }
  }

  public getSnapshotById(id: string): SituationalContextSnapshot | null {
    return this.snapshots.find((s) => s.id === id) || null;
  }

  public getLatestSnapshot(): SituationalContextSnapshot | null {
    if (this.snapshots.length === 0) return null;
    return [...this.snapshots].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0] ?? null;
  }

  public listSnapshots(limit = 20): SituationalContextSnapshot[] {
    return [...this.snapshots]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }
}
