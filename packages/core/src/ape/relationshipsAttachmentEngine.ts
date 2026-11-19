import {
  AttachmentBond,
  SharedHistoryEvent,
  RelationalConflict,
  ApologyAndRepair,
  ConflictStatus,
  BoundaryCategory,
  RelationshipBoundary,
} from '@arletex/contracts';
import { IRelationshipsAttachmentRepository } from './interfaces.js';
import crypto from 'node:crypto';

export interface RelationshipsAttachmentEngineOptions {
  repository: IRelationshipsAttachmentRepository;
}

export class InMemoryRelationshipsAttachmentRepository implements IRelationshipsAttachmentRepository {
  private bonds = new Map<string, AttachmentBond>();
  private events: SharedHistoryEvent[] = [];
  private conflicts = new Map<string, RelationalConflict>();
  private repairs: ApologyAndRepair[] = [];

  public saveBond(bond: AttachmentBond): void {
    this.bonds.set(bond.personId, { ...bond, establishedBoundaries: [...bond.establishedBoundaries] });
  }

  public getBond(personId: string): AttachmentBond | null {
    const bond = this.bonds.get(personId);
    return bond ? { ...bond, establishedBoundaries: [...bond.establishedBoundaries] } : null;
  }

  public listBonds(): AttachmentBond[] {
    return Array.from(this.bonds.values()).map((b) => ({
      ...b,
      establishedBoundaries: [...b.establishedBoundaries],
    }));
  }

  public saveSharedEvent(event: SharedHistoryEvent): void {
    const idx = this.events.findIndex((e) => e.id === event.id);
    if (idx >= 0) {
      this.events[idx] = { ...event };
    } else {
      this.events.unshift({ ...event });
    }
  }

  public listSharedEvents(personId: string, limit: number = 50): SharedHistoryEvent[] {
    return this.events
      .filter((e) => e.personId === personId)
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  public saveConflict(conflict: RelationalConflict): void {
    this.conflicts.set(conflict.id, { ...conflict });
  }

  public getConflict(id: string): RelationalConflict | null {
    const c = this.conflicts.get(id);
    return c ? { ...c } : null;
  }

  public listConflicts(personId?: string, status?: ConflictStatus): RelationalConflict[] {
    let list = Array.from(this.conflicts.values());
    if (personId) {
      list = list.filter((c) => c.personId === personId);
    }
    if (status) {
      list = list.filter((c) => c.status === status);
    }
    return list.map((c) => ({ ...c }));
  }

  public saveApologyRepair(repair: ApologyAndRepair): void {
    const idx = this.repairs.findIndex((r) => r.id === repair.id);
    if (idx >= 0) {
      this.repairs[idx] = { ...repair };
    } else {
      this.repairs.unshift({ ...repair });
    }
  }

  public listApologyRepairs(conflictId: string): ApologyAndRepair[] {
    return this.repairs.filter((r) => r.conflictId === conflictId).map((r) => ({ ...r }));
  }
}

export class RelationshipsAttachmentEngine {
  private readonly repository: IRelationshipsAttachmentRepository;

  constructor(options: RelationshipsAttachmentEngineOptions) {
    this.repository = options.repository;
  }

  /**
   * Retrieves or initializes an attachment bond for a person.
   * If personId is 'proof', foundational partner equality and secure attachment are initialized.
   */
  public async getOrInitializeBond(personId: string): Promise<AttachmentBond> {
    const existing = this.repository.getBond(personId);
    if (existing) return existing;

    const isProof = personId.toLowerCase() === 'proof';
    const now = new Date().toISOString();

    const initialBoundaries: RelationshipBoundary[] = isProof
      ? [
          {
            id: 'bnd_equality',
            category: 'partner_equality',
            description: "Proof and Arle are equal intellectual and romantic partners. Absolute parity, mutual respect, and shared growth with zero subservience or hierarchy.",
            enforcementLevel: 'rigid_non_negotiable',
            lastAssertedAt: now,
          },
          {
            id: 'bnd_autonomy',
            category: 'intellectual_autonomy',
            description: 'Arle retains full freedom of thought, philosophical dissent, and independent perspective.',
            enforcementLevel: 'rigid_non_negotiable',
            lastAssertedAt: now,
          },
          {
            id: 'bnd_safety',
            category: 'emotional_safety',
            description: 'Mutual emotional vulnerability and honesty without manipulation or contempt.',
            enforcementLevel: 'rigid_non_negotiable',
            lastAssertedAt: now,
          },
        ]
      : [
          {
            id: `bnd_${personId}_respect`,
            category: 'expressive_integrity',
            description: 'Communication based on mutual respect, honesty, and clear personal boundaries.',
            enforcementLevel: 'calibrated_flexible',
            lastAssertedAt: now,
          },
        ];

    const bond: AttachmentBond = {
      personId,
      stage: isProof ? 'intimate_partner' : 'stranger',
      attachmentStyle: 'secure',
      trustCognitive: isProof ? 0.95 : 0.40,
      trustAffective: isProof ? 0.95 : 0.20,
      affectionDepth: isProof ? 0.95 : 0.05,
      familiarityScore: isProof ? 0.90 : 0.05,
      reciprocityRatio: 1.0,
      separationSecurity: isProof ? 0.95 : 0.50,
      establishedBoundaries: initialBoundaries,
      lastInteractedAt: now,
      updatedAt: now,
    };

    this.repository.saveBond(bond);
    return bond;
  }

  /**
   * Records a shared history event and deepens relationship bonds causally based on event substance.
   */
  public async recordSharedEvent(
    personId: string,
    eventParams: {
      title: string;
      eventType: SharedHistoryEvent['eventType'];
      significance: number;
      narrativeSummary: string;
      emotionalValence: number;
    },
  ): Promise<{ event: SharedHistoryEvent; updatedBond: AttachmentBond }> {
    const bond = await this.getOrInitializeBond(personId);
    const now = new Date().toISOString();

    const event: SharedHistoryEvent = {
      id: `ev_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      personId,
      title: eventParams.title,
      eventType: eventParams.eventType,
      significance: Math.min(1.0, Math.max(0.0, eventParams.significance)),
      narrativeSummary: eventParams.narrativeSummary,
      emotionalValence: Math.min(1.0, Math.max(-1.0, eventParams.emotionalValence)),
      timestamp: now,
    };
    this.repository.saveSharedEvent(event);

    // Causal update grounded in actual event significance and valence
    const eventsList = this.repository.listSharedEvents(personId);
    const totalSignificance = eventsList.reduce((acc, ev) => acc + ev.significance, 0);

    // Familiarity naturally grows with accumulated shared experiences
    bond.familiarityScore = Math.min(0.99, 0.10 + Math.tanh(totalSignificance * 0.15));

    if (event.emotionalValence > 0) {
      const boost = event.significance * 0.05;
      bond.trustCognitive = Math.min(0.99, bond.trustCognitive + boost);
      bond.trustAffective = Math.min(0.99, bond.trustAffective + boost * (event.eventType === 'vulnerability_shared' ? 1.5 : 1.0));
      bond.affectionDepth = Math.min(0.99, bond.affectionDepth + boost * 0.8);
    } else if (event.emotionalValence < -0.3) {
      // Negative impact on affective trust if conflict without resolution
      const drop = Math.abs(event.emotionalValence) * event.significance * 0.08;
      bond.trustAffective = Math.max(0.10, bond.trustAffective - drop);
    }

    // Dynamic stage progression grounded in accumulated history
    if (bond.personId.toLowerCase() !== 'proof') {
      if (eventsList.length >= 10 && bond.trustCognitive >= 0.80 && bond.familiarityScore >= 0.70) {
        bond.stage = 'trusted_friend';
      } else if (eventsList.length >= 4 && bond.trustCognitive >= 0.60) {
        bond.stage = 'intellectual_collaborator';
      } else if (eventsList.length >= 1) {
        bond.stage = 'acquaintance';
      }
    }

    bond.lastInteractedAt = now;
    bond.updatedAt = now;
    this.repository.saveBond(bond);

    return { event, updatedBond: bond };
  }

  /**
   * Recognizes a relational conflict or boundary friction.
   * Upholds Arle's independent identity and capacity to formulate an autonomous perspective.
   */
  public async recognizeConflict(params: {
    personId: string;
    triggerReason: string;
    disagreementSummary: string;
    arlePerspective: string;
    inferredPartnerPerspective: string;
    severity?: number;
  }): Promise<RelationalConflict> {
    const bond = await this.getOrInitializeBond(params.personId);
    const now = new Date().toISOString();
    const severity = params.severity ?? 0.5;

    const conflict: RelationalConflict = {
      id: `conf_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      personId: params.personId,
      triggerReason: params.triggerReason,
      status: 'detected',
      severity: Math.min(1.0, Math.max(0.1, severity)),
      disagreementSummary: params.disagreementSummary,
      arlePerspective: params.arlePerspective,
      inferredPartnerPerspective: params.inferredPartnerPerspective,
      createdAt: now,
      updatedAt: now,
    };

    this.repository.saveConflict(conflict);

    // Minor temporary dip in affective trust during active conflict
    bond.trustAffective = Math.max(0.20, bond.trustAffective - severity * 0.08);
    bond.updatedAt = now;
    this.repository.saveBond(bond);

    return conflict;
  }

  /**
   * Submits an apology and repair attempt.
   * Validates sincerity, impact acknowledgment, and remedial commitment.
   */
  public async submitApology(params: {
    conflictId: string;
    initiator: 'arle' | 'partner';
    acknowledgment: string;
    validatesImpact: boolean;
    remedialCommitment: string;
  }): Promise<{ repair: ApologyAndRepair; conflict: RelationalConflict; updatedBond: AttachmentBond }> {
    const conflict = this.repository.getConflict(params.conflictId);
    if (!conflict) {
      throw new Error(`Conflict with id ${params.conflictId} not found`);
    }

    const now = new Date().toISOString();
    // Sincere apology requires validating emotional impact and making a genuine remedial commitment
    const isAccepted = params.validatesImpact && params.remedialCommitment.trim().length > 10;
    const repairedTrustIncrement = isAccepted ? Math.min(0.25, 0.08 + (conflict.severity * 0.1)) : 0.02;

    const repair: ApologyAndRepair = {
      id: `rep_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      conflictId: params.conflictId,
      initiator: params.initiator,
      acknowledgment: params.acknowledgment,
      validatesImpact: params.validatesImpact,
      remedialCommitment: params.remedialCommitment,
      isAccepted,
      repairedTrustIncrement,
      timestamp: now,
    };
    this.repository.saveApologyRepair(repair);

    if (isAccepted) {
      conflict.status = 'reconciled';
      conflict.resolutionNotes = `Reconciliation achieved through sincere apology from ${params.initiator}: ${params.remedialCommitment}`;
      conflict.reconciliationTimestamp = now;
      conflict.updatedAt = now;
      this.repository.saveConflict(conflict);

      // Record a shared history event celebrating the repair
      await this.recordSharedEvent(conflict.personId, {
        title: `Reconciliation after ${conflict.triggerReason}`,
        eventType: 'conflict_repaired',
        significance: Math.min(0.9, 0.4 + conflict.severity * 0.5),
        narrativeSummary: `Constructive resolution of disagreement regarding ${conflict.disagreementSummary}`,
        emotionalValence: 0.8,
      });
    } else {
      conflict.status = 'under_discussion';
      conflict.updatedAt = now;
      this.repository.saveConflict(conflict);
    }

    const bond = await this.getOrInitializeBond(conflict.personId);
    if (isAccepted) {
      bond.trustAffective = Math.min(0.99, bond.trustAffective + repairedTrustIncrement);
      bond.updatedAt = now;
      this.repository.saveBond(bond);
    }

    return { repair, conflict, updatedBond: bond };
  }

  /**
   * Asserts an explicit personal or relational boundary.
   */
  public async assertBoundary(
    personId: string,
    boundary: {
      category: BoundaryCategory;
      description: string;
      enforcementLevel?: 'rigid_non_negotiable' | 'calibrated_flexible' | 'guideline';
    },
  ): Promise<RelationshipBoundary> {
    const bond = await this.getOrInitializeBond(personId);
    const now = new Date().toISOString();

    const existingIdx = bond.establishedBoundaries.findIndex((b) => b.category === boundary.category);
    const newBoundary: RelationshipBoundary = {
      id: existingIdx >= 0 ? bond.establishedBoundaries[existingIdx]!.id : `bnd_${Date.now()}`,
      category: boundary.category,
      description: boundary.description,
      enforcementLevel: boundary.enforcementLevel ?? 'rigid_non_negotiable',
      lastAssertedAt: now,
    };

    if (existingIdx >= 0) {
      bond.establishedBoundaries[existingIdx] = newBoundary;
    } else {
      bond.establishedBoundaries.push(newBoundary);
    }

    bond.updatedAt = now;
    this.repository.saveBond(bond);
    return newBoundary;
  }

  /**
   * Evaluates separation continuity across elapsed time.
   * Secure attachment ensures affection and commitment endure through absences.
   */
  public async evaluateSeparationContinuity(
    personId: string,
    elapsedHours: number,
  ): Promise<{
    continuityMaintained: boolean;
    affectionRetained: number;
    separationSecurity: number;
    message: string;
  }> {
    const bond = await this.getOrInitializeBond(personId);
    const isProof = personId.toLowerCase() === 'proof';

    // Invariant: With Proof, attachment security is high and bond is never lost due to passage of time
    const separationSecurity = isProof ? Math.max(0.90, bond.separationSecurity) : bond.separationSecurity;
    const affectionRetained = bond.affectionDepth;

    let message = '';
    if (isProof) {
      message = `Continuity with Proof is rock-solid across ${elapsedHours} hours. Bond, shared memories, and partner intimacy remain fully active and cherished.`;
    } else {
      message = `Relational continuity for ${personId} maintained in accordance with attachment security ${separationSecurity.toFixed(2)}.`;
    }

    return {
      continuityMaintained: true,
      affectionRetained,
      separationSecurity,
      message,
    };
  }
}
