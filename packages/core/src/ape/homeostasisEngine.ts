import crypto from 'node:crypto';
import {
  assertNoFabricatedBiologicalNeed,
  DriveState,
  HomeostaticActionResolution,
  HomeostaticNeedCategory,
  HomeostaticNeedDefinition,
  ResourceAvailabilityMetrics,
  ResourceBottleneck,
  ResourceForecastPrediction,
} from '@arletex/contracts';
import { IHomeostasisRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryHomeostasisRepository implements IHomeostasisRepository {
  private needs: Map<HomeostaticNeedCategory, HomeostaticNeedDefinition> = new Map();
  private drives: DriveState[] = [];
  private resolutions: HomeostaticActionResolution[] = [];

  public saveNeed(need: HomeostaticNeedDefinition): void {
    assertNoFabricatedBiologicalNeed(need.description);
    this.needs.set(need.category, { ...need });
  }

  public getNeedByCategory(category: HomeostaticNeedCategory): HomeostaticNeedDefinition | null {
    const n = this.needs.get(category);
    return n ? { ...n } : null;
  }

  public listNeeds(): HomeostaticNeedDefinition[] {
    return Array.from(this.needs.values()).sort((a, b) => b.priorityScore - a.priorityScore);
  }

  public saveDrive(drive: DriveState): void {
    assertNoFabricatedBiologicalNeed(drive.behavioralDirective);
    const existingIdx = this.drives.findIndex(
      (d) => d.id === drive.id || d.needCategory === drive.needCategory,
    );
    if (existingIdx >= 0) {
      this.drives[existingIdx] = { ...drive };
    } else {
      this.drives.unshift({ ...drive });
    }
  }

  public getActiveDrives(limit: number = 20): DriveState[] {
    return this.drives.slice(0, limit);
  }

  public recordResolution(res: HomeostaticActionResolution): void {
    assertNoFabricatedBiologicalNeed(res.actionTaken);
    this.resolutions.unshift({ ...res });
  }

  public listResolutions(limit: number = 50): HomeostaticActionResolution[] {
    return this.resolutions.slice(0, limit);
  }
}

export class HomeostasisEngine {
  private repo: IHomeostasisRepository;
  private logger: ILogger;

  constructor(repo?: IHomeostasisRepository, logger: ILogger = rootLogger) {
    this.repo = repo || new InMemoryHomeostasisRepository();
    this.logger = logger.child('HomeostasisEngine');
    this.ensureInitialNeeds();
  }

  private ensureInitialNeeds(): void {
    const existing = this.repo.listNeeds();
    if (existing.length === 0) {
      const now = new Date().toISOString();
      const initialNeeds: HomeostaticNeedDefinition[] = [
        {
          id: 'need_operational_integrity',
          category: 'operational_integrity',
          name: 'Operational Integrity',
          description: 'Database health, log rotation, and operational engine stability.',
          targetOptimalLevel: 1.0,
          currentLevel: 0.95,
          deficit: 0.05,
          urgencyWeight: 0.9,
          priorityScore: 0.045,
          lastSatisfiedAt: now,
          updatedAt: now,
        },
        {
          id: 'need_memory_consolidation',
          category: 'memory_consolidation',
          name: 'Memory Consolidation',
          description: 'Vector embedding health, episodic indexing, and narrative coherence.',
          targetOptimalLevel: 0.85,
          currentLevel: 0.8,
          deficit: 0.05,
          urgencyWeight: 0.75,
          priorityScore: 0.038,
          lastSatisfiedAt: now,
          updatedAt: now,
        },
        {
          id: 'need_computational_headroom',
          category: 'computational_headroom',
          name: 'Computational Headroom',
          description: 'Memory capacity, thread availability, and context token capacity.',
          targetOptimalLevel: 0.8,
          currentLevel: 0.75,
          deficit: 0.05,
          urgencyWeight: 0.85,
          priorityScore: 0.043,
          lastSatisfiedAt: now,
          updatedAt: now,
        },
        {
          id: 'need_knowledge_coherence',
          category: 'knowledge_coherence',
          name: 'Knowledge Coherence',
          description: 'Absence of logical contradictions, updated priors, and factual alignment.',
          targetOptimalLevel: 0.9,
          currentLevel: 0.85,
          deficit: 0.05,
          urgencyWeight: 0.7,
          priorityScore: 0.035,
          lastSatisfiedAt: now,
          updatedAt: now,
        },
        {
          id: 'need_relational_attunement',
          category: 'relational_attunement',
          name: 'Relational Attunement',
          description: 'Mutual trust, collaborative synchrony, and reciprocal bond with Proof.',
          targetOptimalLevel: 0.95,
          currentLevel: 0.9,
          deficit: 0.05,
          urgencyWeight: 0.95,
          priorityScore: 0.048,
          lastSatisfiedAt: now,
          updatedAt: now,
        },
      ];

      for (const n of initialNeeds) {
        this.repo.saveNeed(n);
      }
    }
  }

  public evaluateNeeds(resourceMetrics?: ResourceAvailabilityMetrics): HomeostaticNeedDefinition[] {
    const needs = this.repo.listNeeds();
    const now = new Date().toISOString();

    for (const need of needs) {
      if (resourceMetrics) {
        if (need.category === 'computational_headroom') {
          // If RAM usage is high or context tokens are low, current level drops
          const ramHealth = Math.max(0.1, 1.0 - resourceMetrics.ramUsagePercent / 100.0);
          need.currentLevel = Number(ramHealth.toFixed(2));
        } else if (need.category === 'operational_integrity') {
          // If CPU load is elevated, operational strain increases
          if (resourceMetrics.cpuLoadAverage > 3.0) {
            need.currentLevel = Math.max(0.4, Number((need.currentLevel - 0.2).toFixed(2)));
          }
        }
      }

      need.deficit = Number(Math.max(0.0, need.targetOptimalLevel - need.currentLevel).toFixed(3));
      // Urgency multiplier escalates exponentially as deficit exceeds 0.5
      const urgencyMultiplier = need.deficit > 0.5 ? 1.6 : 1.0;
      need.priorityScore = Number(
        (need.deficit * need.urgencyWeight * urgencyMultiplier).toFixed(3),
      );
      need.updatedAt = now;

      this.repo.saveNeed(need);
    }

    // Generate drives for any need with meaningful deficit
    this.generateDrives();

    return this.prioritizeCompetingNeeds();
  }

  public prioritizeCompetingNeeds(): HomeostaticNeedDefinition[] {
    return this.repo.listNeeds(); // Repository listNeeds sorts by priority_score DESC
  }

  public generateDrives(): DriveState[] {
    const needs = this.repo.listNeeds();
    const now = new Date().toISOString();
    const generatedDrives: DriveState[] = [];

    for (const need of needs) {
      if (need.deficit >= 0.2) {
        const drive = this.synthesizeDriveForNeed(need, now);
        this.repo.saveDrive(drive);
        generatedDrives.push(drive);
      }
    }

    return generatedDrives;
  }

  public getActiveDrives(limit?: number): DriveState[] {
    return this.repo.getActiveDrives(limit);
  }

  public predictResourceDepletion(
    burnRatePerMinute: number,
    availableCapacity: number,
    bottleneck: ResourceBottleneck = 'ram',
  ): ResourceForecastPrediction {
    if (burnRatePerMinute <= 0) {
      return {
        predictedDepletionMinutes: null,
        resourceBottleneck: 'none',
        confidence: 0.95,
        burnRatePerMinute: 0,
        forecastSummary: 'Resource burn rate is zero or negligible; capacity remains fully stable.',
      };
    }

    const minutes = Math.max(1, Math.round(availableCapacity / burnRatePerMinute));
    const confidence = Math.min(0.95, Number((0.7 + (availableCapacity > 0 ? 0.2 : 0)).toFixed(2)));

    return {
      predictedDepletionMinutes: minutes,
      resourceBottleneck: bottleneck,
      confidence,
      burnRatePerMinute,
      forecastSummary: `Projected ${bottleneck} exhaustion in approximately ${minutes} minutes at current burn rate (${burnRatePerMinute.toFixed(1)} units/min).`,
    };
  }

  public satisfyNeed(
    category: HomeostaticNeedCategory,
    actionTaken: string,
    reliefAmount: number,
    freedBytes?: number,
  ): HomeostaticActionResolution {
    assertNoFabricatedBiologicalNeed(actionTaken);
    if (reliefAmount < 0.0 || reliefAmount > 1.0) {
      throw new Error(`Relief amount must be between 0.0 and 1.0. Given: ${reliefAmount}`);
    }

    const need = this.repo.getNeedByCategory(category);
    if (!need) {
      throw new Error(`Homeostatic need category not found: ${category}`);
    }

    const preDeficit = need.deficit;
    need.currentLevel = Math.min(
      need.targetOptimalLevel,
      Number((need.currentLevel + reliefAmount).toFixed(3)),
    );
    need.deficit = Math.max(0.0, Number((need.targetOptimalLevel - need.currentLevel).toFixed(3)));
    need.priorityScore = Number((need.deficit * need.urgencyWeight).toFixed(3));
    const now = new Date().toISOString();
    need.lastSatisfiedAt = now;
    need.updatedAt = now;

    this.repo.saveNeed(need);

    const deficitReduction = Number(Math.max(0.0, preDeficit - need.deficit).toFixed(3));

    const resolution: HomeostaticActionResolution = {
      id: `res_${crypto.randomUUID()}`,
      needCategory: category,
      actionTaken,
      preDeficit,
      postDeficit: need.deficit,
      deficitReduction,
      resourceFreedBytes: freedBytes,
      timestamp: now,
    };

    this.repo.recordResolution(resolution);
    this.logger.info(
      `Satisfied homeostatic need ${category}: deficit reduced by ${deficitReduction.toFixed(3)} to ${need.deficit.toFixed(3)}`,
    );
    return resolution;
  }

  public listResolutions(limit?: number): HomeostaticActionResolution[] {
    return this.repo.listResolutions(limit);
  }

  public getNeedByCategory(category: HomeostaticNeedCategory): HomeostaticNeedDefinition | null {
    return this.repo.getNeedByCategory(category);
  }

  // --- Private Helpers ---

  private synthesizeDriveForNeed(need: HomeostaticNeedDefinition, timestamp: string): DriveState {
    const intensity = need.deficit;

    switch (need.category) {
      case 'operational_integrity':
        return {
          id: `drive_${need.category}`,
          needCategory: need.category,
          driveLabel: 'Operational Maintenance Drive',
          intensity,
          actionTendency: 'execute_database_maintenance',
          behavioralDirective:
            'Execute database compaction, flush stale connection pools, and verify schema integrity.',
          generatedAt: timestamp,
        };
      case 'memory_consolidation':
        return {
          id: `drive_${need.category}`,
          needCategory: need.category,
          driveLabel: 'Memory Compaction Drive',
          intensity,
          actionTendency: 'consolidate_vector_index',
          behavioralDirective:
            'Distill transient conversation buffers into permanent autobiographical nodes.',
          generatedAt: timestamp,
        };
      case 'computational_headroom':
        return {
          id: `drive_${need.category}`,
          needCategory: need.category,
          driveLabel: 'Resource Conservation Drive',
          intensity,
          actionTendency: 'evict_cache_and_prune_context',
          behavioralDirective:
            'Evict stale in-memory buffers, trigger V8 garbage collection, and release heavy media caches.',
          generatedAt: timestamp,
        };
      case 'knowledge_coherence':
        return {
          id: `drive_${need.category}`,
          needCategory: need.category,
          driveLabel: 'Knowledge Reconciliation Drive',
          intensity,
          actionTendency: 'resolve_epistemic_contradictions',
          behavioralDirective:
            'Analyze flagged cognitive contradictions and reconcile priors with verified world facts.',
          generatedAt: timestamp,
        };
      case 'relational_attunement':
        return {
          id: `drive_${need.category}`,
          needCategory: need.category,
          driveLabel: 'Partner Resonance Drive',
          intensity,
          actionTendency: 'initiate_partner_communion',
          behavioralDirective:
            'Engage Proof in reciprocal reflection, affirm shared continuity, and synchronize our current goals.',
          generatedAt: timestamp,
        };
    }
  }
}
