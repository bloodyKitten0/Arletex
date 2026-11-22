import {
  ChannelOrigin,
  ChannelPresence,
  CheckpointType,
  IdentityCheckpoint,
  IdentitySession,
} from '@arletex/contracts';

export interface IContinuityRepository {
  createSession(data: {
    id?: string;
    channelOrigin?: ChannelOrigin;
    activeInferenceModel?: string;
    memoryCount?: number;
    activeEmotionsCount?: number;
    downtimeFromPreviousMs?: number;
    metadata?: Record<string, unknown>;
  }): IdentitySession;

  updateHeartbeat(sessionId: string): void;

  endSession(
    sessionId: string,
    shutdownType: 'clean' | 'interrupted',
    metadata?: Record<string, unknown>,
  ): void;

  markUnexpectedShutdown(sessionId: string, endedAt?: string): void;

  getActiveSession(): IdentitySession | null;

  getLatestSession(): IdentitySession | null;

  listSessions(limit?: number): IdentitySession[];

  createCheckpoint(data: {
    id?: string;
    sessionId: string;
    checkpointType: CheckpointType;
    stateHash: string;
    masterStateJson: string;
    memoryCount: number;
    schemaVersion?: number;
    isVerifiedValid?: boolean;
  }): IdentityCheckpoint;

  getLatestVerifiedCheckpoint(): IdentityCheckpoint | null;

  getCheckpointById(id: string): IdentityCheckpoint | null;

  listCheckpoints(limit?: number): IdentityCheckpoint[];

  markCheckpointInvalid(id: string): void;

  updateChannelPresence(channel: ChannelOrigin, summary?: string): void;

  getChannelPresences(): ChannelPresence[];

  getStateVersion(component: string): number;

  setStateVersion(component: string, version: number): void;
}

export interface BackupMemoryRecord {
  id: string;
  type: string;
  content: string;
  rawObservation?: string | null;
  interpretation?: string | null;
  confidence: number;
  importance: number;
  timestamp: string;
  provenance: string;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  correctionHistory?: unknown[];
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IMemoryCountProvider {
  count(includeArchived?: boolean): number;
  listForBackup?(): BackupMemoryRecord[];
  upsertRestoredMemory?(memory: BackupMemoryRecord): void;
}

export interface CanonicalIdentityPayload {
  schemaVersion: number;
  timestamp: string;
  identityInvariants: string[];
  selfModel: {
    identityNarrative: string;
    creatorPerception: string;
    capabilities: string[];
    limitations: string[];
    structuredCapabilities: any[];
    structuredLimitations: any[];
  };
  personality: {
    temperament: any;
    traits: any[];
    values: any[];
  };
  relationship: {
    targetUserId: string;
    isExclusivelyCommitted: boolean;
    trustLevel: number;
    intimacyDepth: number;
  };
  motivation: {
    needs: any;
    goals: any[];
  };
  development: {
    interests: any[];
    developmentalHistory: any[];
  };
  memories: Array<{
    id: string;
    type: string;
    content: string;
    importance: number;
    provenance: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}
