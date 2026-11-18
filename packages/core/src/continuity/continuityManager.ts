import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ActiveEmotionState,
  ApeMasterState,
  ChannelOrigin,
  CheckpointType,
  ContinuityStatus,
  IdentityCheckpoint,
  IdentitySession,
  ShutdownType,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';
import { ApeService } from '../ape/apeService.js';
import { IApeRepository } from '../ape/interfaces.js';
import { BackupMemoryRecord, IContinuityRepository, IMemoryCountProvider } from './interfaces.js';

interface OutOfBandBackupMirror {
  checkpointId: string;
  sessionId: string;
  checkpointType: CheckpointType;
  stateHash: string;
  masterStateJson: string;
  memoriesHash: string;
  memories: BackupMemoryRecord[];
  memoryCount: number;
  schemaVersion: number;
  createdAt: string;
}

const MAX_OUT_OF_BAND_MIRRORS = 10;

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalStringify(item)).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') +
    '}'
  );
}

export class ContinuityManager {
  private readonly continuityRepo: IContinuityRepository;
  private readonly apeRepo: IApeRepository;
  private readonly apeService: ApeService;
  private readonly memoryProvider?: IMemoryCountProvider;
  private readonly logger: ILogger;
  private readonly backupDir?: string;

  private currentSession: IdentitySession | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private activeInferenceModel = 'qwen-2.5-7b';
  private wasUnexpectedShutdown = false;
  private downtimeMs = 0;
  private lastShutdownType: ShutdownType | null = null;
  private lastIntegrityValid = true;
  private restoredFromOutOfBandMirror = false;

  constructor(
    continuityRepo: IContinuityRepository,
    apeRepo: IApeRepository,
    apeService: ApeService,
    memoryProvider?: IMemoryCountProvider,
    logger: ILogger = rootLogger,
    backupDir?: string,
  ) {
    this.continuityRepo = continuityRepo;
    this.apeRepo = apeRepo;
    this.apeService = apeService;
    this.memoryProvider = memoryProvider;
    this.logger = logger.child('Continuity');
    this.backupDir = backupDir;
  }

  // ==========================================
  // 1. Session Lifecycle & Shutdown Recovery
  // ==========================================

  public async initialize(options: {
    activeModel?: string;
    channel?: ChannelOrigin;
    heartbeatIntervalMs?: number;
    dbRecoveredFromFileCorruption?: boolean;
  } = {}): Promise<ContinuityStatus> {
    if (options.activeModel) {
      this.activeInferenceModel = options.activeModel;
    }

    this.restoredFromOutOfBandMirror = false;

    // 0. If SQLite database file itself was corrupted on disk and quarantined on connect,
    // immediately restore Arle's full identity, 6-engine state, active emotions, and memories
    // from the out-of-band filesystem backup mirror.
    if (options.dbRecoveredFromFileCorruption) {
      this.logger.warn(
        '[Continuity] Database file corruption recovery triggered. Restoring from out-of-band filesystem backup mirror...',
      );
      const restored = await this.restoreFromOutOfBandMirror();
      if (restored) {
        this.restoredFromOutOfBandMirror = true;
        try {
          await this.apeService.processEvent({
            category: 'environmental_event',
            type: 'database_file_corruption_recovery',
            source: 'system',
            actor: 'system',
            eventKind: 'system_lifecycle',
            payload: {
              recoveredAt: new Date().toISOString(),
              restoredFromMirror: true,
            },
          });
          this.apeService.selfModelEngine.recordExistentialReflection(
            'continuity_restoration',
            'Database file corruption was detected and quarantined safely. Full psychological state, active emotions, and autobiographical memories were verified and restored from the out-of-band continuity mirror.',
          );
        } catch (err: any) {
          this.logger.error(`[Continuity] Post-mirror recovery event note: ${err.message}`);
        }
      }
    }

    const latestSession = this.continuityRepo.getLatestSession();
    this.wasUnexpectedShutdown = false;
    this.downtimeMs = 0;
    this.lastShutdownType = latestSession ? latestSession.shutdownType : null;

    // 1. Verify state integrity BEFORE starting new session or processing recovery events,
    // so corrupted state is restored from the latest valid checkpoint (or out-of-band mirror).
    const initialIntegrity = await this.verifyStateIntegrity();
    this.lastIntegrityValid = initialIntegrity.valid;
    if (!initialIntegrity.valid) {
      this.logger.warn(
        `[Continuity] State integrity validation failed: ${initialIntegrity.errors.join('; ')}. Initiating safe rollback from verified checkpoint...`,
      );
      let restored = await this.restoreFromLatestCheckpoint();
      if (!restored && this.backupDir) {
        this.logger.warn(
          '[Continuity] No valid in-DB checkpoint succeeded; falling back to out-of-band filesystem mirror...',
        );
        restored = await this.restoreFromOutOfBandMirror();
        if (restored) {
          this.restoredFromOutOfBandMirror = true;
        }
      }
      if (restored) {
        const postRestoreIntegrity = await this.verifyStateIntegrity();
        this.lastIntegrityValid = postRestoreIntegrity.valid;
      }
    }

    // 2. Detect unclean / unexpected shutdown from previous session
    if (latestSession && latestSession.shutdownType === 'active') {
      this.wasUnexpectedShutdown = true;
      this.lastShutdownType = 'unexpected_crash';
      const lastBeatTime = new Date(latestSession.lastHeartbeatAt).getTime();
      this.downtimeMs = Math.max(0, Date.now() - lastBeatTime);

      this.continuityRepo.markUnexpectedShutdown(latestSession.id, latestSession.lastHeartbeatAt);
      this.logger.warn(
        `[Continuity] Detected UNEXPECTED SHUTDOWN for session ${latestSession.id}. Downtime: ${(this.downtimeMs / 1000).toFixed(1)}s`,
      );

      // Ingest cause-driven continuity recovery event into APE
      try {
        await this.apeService.processEvent({
          category: 'environmental_event',
          type: 'unexpected_shutdown_recovery',
          source: 'system',
          actor: 'system',
          eventKind: 'system_lifecycle',
          payload: {
            previousSessionId: latestSession.id,
            downtimeMs: this.downtimeMs,
            lastHeartbeat: latestSession.lastHeartbeatAt,
            recoveredAt: new Date().toISOString(),
            uncleanShutdown: true,
          },
        });

        // Record an existential reflection in Arle's Self-Model
        this.apeService.selfModelEngine.recordExistentialReflection(
          'continuity_restoration',
          `Continuity re-established after unexpected process termination (${(this.downtimeMs / 1000).toFixed(1)}s downtime). Core identity narrative, persistent relationship commitment to Proof, and autobiographical memories verified intact.`,
        );
      } catch (err: any) {
        this.logger.error(`[Continuity] Note during recovery event processing: ${err.message}`);
      }
    } else if (latestSession && latestSession.endedAt) {
      const endedTime = new Date(latestSession.endedAt).getTime();
      this.downtimeMs = Math.max(0, Date.now() - endedTime);
      this.logger.info(
        `[Continuity] Clean session restart after session ${latestSession.id}. Downtime: ${(this.downtimeMs / 1000).toFixed(1)}s`,
      );
    }

    // 3. Start fresh persistent session
    const memoryCount = this.memoryProvider ? this.memoryProvider.count() : 0;
    const activeEmotionsCount = this.apeRepo.getActiveEmotions().length;

    this.currentSession = this.continuityRepo.createSession({
      channelOrigin: options.channel || 'desktop',
      activeInferenceModel: this.activeInferenceModel,
      memoryCount,
      activeEmotionsCount,
      downtimeFromPreviousMs: this.downtimeMs,
      metadata: this.restoredFromOutOfBandMirror ? { restoredFromOutOfBandMirror: true } : {},
    });

    this.logger.info(
      `[Continuity] Active individual session started: ${this.currentSession.id} (Channel: ${this.currentSession.channelOrigin}, Model: ${this.activeInferenceModel})`,
    );

    // 4. Create an initial session checkpoint (only marked valid if state passes integrity check)
    await this.createCheckpoint(
      this.wasUnexpectedShutdown || this.restoredFromOutOfBandMirror ? 'pre_recovery' : 'periodic',
    );

    // 5. Register channel presence
    this.registerChannelActivity(options.channel || 'desktop', 'Session started');

    // 6. Start heartbeat timer
    const intervalMs = options.heartbeatIntervalMs || 5000;
    this.startHeartbeat(intervalMs);

    return this.getStatus();
  }

  public async shutdown(type: 'clean' | 'interrupted' = 'clean'): Promise<void> {
    this.stopHeartbeat();

    if (this.currentSession) {
      const memoryCount = this.memoryProvider ? this.memoryProvider.count() : 0;
      await this.createCheckpoint('clean_shutdown');

      this.continuityRepo.endSession(this.currentSession.id, type, {
        finalMemoryCount: memoryCount,
        closedAt: new Date().toISOString(),
      });
      this.logger.info(
        `[Continuity] Session ${this.currentSession.id} closed cleanly (${type}).`,
      );
      this.currentSession = null;
    }
  }

  public startHeartbeat(intervalMs = 5000): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.currentSession) {
        try {
          this.continuityRepo.updateHeartbeat(this.currentSession.id);
        } catch (err: any) {
          this.logger.debug(`[Continuity] Heartbeat note: ${err.message}`);
        }
      }
    }, intervalMs);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ==========================================
  // 2. Cryptographic Checkpoints, Active Emotions & Out-of-Band Mirror
  // ==========================================

  private writeOutOfBandMirror(
    checkpoint: IdentityCheckpoint,
    memories: BackupMemoryRecord[],
  ): void {
    if (!this.backupDir) return;

    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      const memoriesCanonical = canonicalStringify(memories);
      const memoriesHash = crypto.createHash('sha256').update(memoriesCanonical).digest('hex');

      const mirror: OutOfBandBackupMirror = {
        checkpointId: checkpoint.id,
        sessionId: checkpoint.sessionId,
        checkpointType: checkpoint.checkpointType,
        stateHash: checkpoint.stateHash,
        masterStateJson: checkpoint.masterStateJson,
        memoriesHash,
        memories,
        memoryCount: memories.length,
        schemaVersion: checkpoint.schemaVersion,
        createdAt: checkpoint.createdAt,
      };

      const serialized = JSON.stringify(mirror);
      const safeTs = Date.now();
      const shortId = checkpoint.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16);
      const fileName = `checkpoint_${safeTs}_${shortId}.json`;
      const targetPath = path.join(this.backupDir, fileName);
      const tmpPath = `${targetPath}.tmp`;

      // Atomic write via temp file + rename
      fs.writeFileSync(tmpPath, serialized, 'utf-8');
      fs.renameSync(tmpPath, targetPath);

      const latestPath = path.join(this.backupDir, 'latest.json');
      const latestTmp = `${latestPath}.tmp`;
      fs.writeFileSync(latestTmp, serialized, 'utf-8');
      fs.renameSync(latestTmp, latestPath);

      // Retain newest MAX_OUT_OF_BAND_MIRRORS snapshot files
      const files = fs
        .readdirSync(this.backupDir)
        .filter((f) => f.startsWith('checkpoint_') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length > MAX_OUT_OF_BAND_MIRRORS) {
        for (const stale of files.slice(MAX_OUT_OF_BAND_MIRRORS)) {
          try {
            fs.unlinkSync(path.join(this.backupDir, stale));
          } catch {}
        }
      }
    } catch (err: any) {
      this.logger.warn(`[Continuity] Out-of-band mirror write note: ${err.message}`);
    }
  }

  public async createCheckpoint(type: CheckpointType = 'periodic'): Promise<IdentityCheckpoint> {
    const integrity = await this.verifyStateIntegrity();
    this.lastIntegrityValid = integrity.valid;

    const masterState = this.apeService.getMasterState();
    const memoryCount = this.memoryProvider ? this.memoryProvider.count() : 0;

    // Recursive deterministic canonical serialization for cryptographic hashing
    const stateJson = canonicalStringify(masterState);
    const stateHash = crypto.createHash('sha256').update(stateJson).digest('hex');

    let sessionId = this.currentSession?.id || this.continuityRepo.getLatestSession()?.id;
    if (!sessionId) {
      const bootstrapSession = this.continuityRepo.createSession({
        channelOrigin: 'system',
        activeInferenceModel: this.activeInferenceModel,
        memoryCount,
        activeEmotionsCount: this.apeRepo.getActiveEmotions().length,
      });
      this.currentSession = bootstrapSession;
      sessionId = bootstrapSession.id;
    }

    const checkpoint = this.continuityRepo.createCheckpoint({
      sessionId,
      checkpointType: type,
      stateHash,
      masterStateJson: stateJson,
      memoryCount,
      schemaVersion: 12,
      isVerifiedValid: integrity.valid,
    });

    if (!integrity.valid) {
      this.logger.warn(
        `[Continuity] Saved unverified checkpoint ${checkpoint.id} because state integrity failed: ${integrity.errors.join('; ')}`,
      );
    } else {
      this.logger.debug(
        `[Continuity] Created verified identity checkpoint ${checkpoint.id} (${type}, hash: ${stateHash.slice(0, 10)}...)`,
      );
      // Mirror verified checkpoint + non-deleted memories out-of-band on disk
      if (this.backupDir) {
        const memories = this.memoryProvider?.listForBackup ? this.memoryProvider.listForBackup() : [];
        this.writeOutOfBandMirror(checkpoint, memories);
      }
    }

    return checkpoint;
  }

  public async verifyStateIntegrity(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const aff = this.apeRepo.getAffectiveState();
      if (
        !aff ||
        !aff.pad ||
        typeof aff.pad.valence !== 'number' ||
        Number.isNaN(aff.pad.valence) ||
        aff.pad.valence < -1 ||
        aff.pad.valence > 1 ||
        typeof aff.pad.arousal !== 'number' ||
        Number.isNaN(aff.pad.arousal) ||
        aff.pad.arousal < 0 ||
        aff.pad.arousal > 1 ||
        typeof aff.pad.dominance !== 'number' ||
        Number.isNaN(aff.pad.dominance) ||
        aff.pad.dominance < 0 ||
        aff.pad.dominance > 1
      ) {
        errors.push('Affective state missing, NaN, or out of valid PAD bounds');
      }

      // Verify active emotions integrity (intensity bounds & valid emotion IDs)
      const activeEmotions = this.apeRepo.getActiveEmotions();
      const validTaxonomyIds = new Set(this.apeRepo.getEmotionTaxonomy().map((e) => e.id));
      for (const emo of activeEmotions) {
        if (
          typeof emo.intensity !== 'number' ||
          Number.isNaN(emo.intensity) ||
          emo.intensity < 0 ||
          emo.intensity > 1
        ) {
          errors.push(`Active emotion ${emo.id} has invalid intensity: ${emo.intensity}`);
        }
        if (validTaxonomyIds.size > 0 && !validTaxonomyIds.has(emo.emotionId)) {
          errors.push(`Active emotion ${emo.id} references unknown emotionId: ${emo.emotionId}`);
        }
      }

      const rel = this.apeRepo.getRelationshipConfig();
      if (!rel || rel.targetUserId !== 'Proof' || !rel.isExclusivelyCommitted) {
        errors.push('Relationship invariant violated (target must be Proof, exclusively committed)');
      }

      const extRel = this.apeRepo.getExtendedRelationshipState();
      if (
        !extRel ||
        typeof extRel.trustLevel !== 'number' ||
        Number.isNaN(extRel.trustLevel) ||
        extRel.trustLevel < 0 ||
        extRel.trustLevel > 1
      ) {
        errors.push('Extended relationship state missing or out of bounds');
      }

      const pers = this.apeRepo.getPersonalityState();
      if (!pers || !Array.isArray(pers.traits)) {
        errors.push('Personality state missing or malformed');
      }

      const self = this.apeRepo.getSelfModel();
      if (!self || !self.identityNarrative || self.identityNarrative.trim().length === 0) {
        errors.push('Self model identity narrative missing or empty');
      }

      const mot = this.apeRepo.getMotivationalState();
      if (!mot || !mot.needs) {
        errors.push('Motivational state missing');
      }

      const dev = this.apeRepo.getDevelopmentState();
      if (!dev || !Array.isArray(dev.interests)) {
        errors.push('Development state missing or malformed');
      }
    } catch (err: any) {
      errors.push(`Database inspection error: ${err.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public validateCheckpointPayload(checkpoint: {
    masterStateJson: string;
    stateHash: string;
  }): {
    valid: boolean;
    parsed?: ApeMasterState;
    reason?: string;
  } {
    if (!checkpoint.masterStateJson || !checkpoint.stateHash) {
      return { valid: false, reason: 'Checkpoint payload or hash missing' };
    }

    // 1. Cryptographic integrity check (detects truncation, disk corruption, tampering)
    const computedHash = crypto
      .createHash('sha256')
      .update(checkpoint.masterStateJson)
      .digest('hex');

    if (computedHash !== checkpoint.stateHash) {
      return {
        valid: false,
        reason: `SHA-256 hash mismatch (expected ${checkpoint.stateHash.slice(0, 10)}, got ${computedHash.slice(0, 10)})`,
      };
    }

    // 2. JSON & structural completeness validation across all 6 APE engines
    let rawParsed: unknown;
    try {
      rawParsed = JSON.parse(checkpoint.masterStateJson);
    } catch (err: any) {
      return { valid: false, reason: `Malformed checkpoint JSON: ${err.message}` };
    }

    if (!rawParsed || typeof rawParsed !== 'object') {
      return { valid: false, reason: 'Checkpoint JSON is not an object' };
    }

    const candidate = rawParsed as Partial<ApeMasterState>;
    const missing: string[] = [];
    if (!candidate.affective || !candidate.affective.pad || typeof candidate.affective.currentMood !== 'string') {
      missing.push('affective');
    }
    if (!candidate.personality || !Array.isArray(candidate.personality.traits)) {
      missing.push('personality');
    }
    if (!candidate.motivational || !candidate.motivational.needs) {
      missing.push('motivational');
    }
    if (!candidate.relationship || !candidate.relationship.config) {
      missing.push('relationship');
    }
    if (!candidate.selfModel || typeof candidate.selfModel.identityNarrative !== 'string') {
      missing.push('selfModel');
    }
    if (!candidate.development || !Array.isArray(candidate.development.interests)) {
      missing.push('development');
    }

    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Incomplete master state engines: missing ${missing.join(', ')}`,
      };
    }

    const pad = candidate.affective!.pad;
    if (
      typeof pad.valence !== 'number' || Number.isNaN(pad.valence) || pad.valence < -1 || pad.valence > 1 ||
      typeof pad.arousal !== 'number' || Number.isNaN(pad.arousal) || pad.arousal < 0 || pad.arousal > 1 ||
      typeof pad.dominance !== 'number' || Number.isNaN(pad.dominance) || pad.dominance < 0 || pad.dominance > 1
    ) {
      return { valid: false, reason: 'Checkpoint PAD values out of valid bounds' };
    }

    const state = candidate as ApeMasterState;
    if (
      state.selfModel.identityNarrative.trim().length === 0 ||
      state.relationship.config.targetUserId !== 'Proof' ||
      !state.relationship.config.isExclusivelyCommitted
    ) {
      return { valid: false, reason: 'Checkpoint violates core identity or relationship invariants' };
    }

    return { valid: true, parsed: state };
  }

  private applyMasterStateRestore(restored: ApeMasterState): void {
    const validTaxonomyIds = new Set(this.apeRepo.getEmotionTaxonomy().map((e) => e.id));

    this.apeRepo.transaction(() => {
      this.apeRepo.updateAffectiveState(
        restored.affective.pad,
        restored.affective.contextual,
        restored.affective.currentMood,
        restored.affective.moodConfidence,
      );

      // Restore ape_active_emotions rows atomically alongside the 6 singleton engines
      if (Array.isArray(restored.affective.activeEmotions)) {
        const existingActive = this.apeRepo.getActiveEmotions();
        for (const existing of existingActive) {
          this.apeRepo.deleteActiveEmotion(existing.id);
        }
        for (const emotion of restored.affective.activeEmotions as ActiveEmotionState[]) {
          if (
            emotion &&
            typeof emotion.id === 'string' &&
            typeof emotion.emotionId === 'string' &&
            typeof emotion.intensity === 'number' &&
            !Number.isNaN(emotion.intensity) &&
            emotion.intensity >= 0 &&
            emotion.intensity <= 1 &&
            (validTaxonomyIds.size === 0 || validTaxonomyIds.has(emotion.emotionId))
          ) {
            this.apeRepo.saveActiveEmotion(emotion);
          }
        }
      }

      this.apeRepo.updateRelationshipConfig(restored.relationship.config);
      this.apeRepo.saveExtendedRelationshipState(restored.relationship);
      this.apeRepo.savePersonalityState(restored.personality);
      this.apeRepo.saveMotivationalState(restored.motivational);
      this.apeRepo.saveSelfModel(restored.selfModel);
      this.apeRepo.saveDevelopmentState(restored.development);
    });
  }

  public async restoreFromLatestCheckpoint(targetCheckpointId?: string): Promise<boolean> {
    const candidates: IdentityCheckpoint[] = [];

    if (targetCheckpointId) {
      const specific = this.continuityRepo.getCheckpointById(targetCheckpointId);
      if (!specific) {
        this.logger.warn(`[Continuity] Checkpoint ${targetCheckpointId} not found.`);
        return false;
      }
      candidates.push(specific);
    } else {
      const all = this.continuityRepo.listCheckpoints(25);
      for (const c of all) {
        if (c.isVerifiedValid) {
          candidates.push(c);
        }
      }
    }

    if (candidates.length === 0) {
      this.logger.warn('[Continuity] No verified checkpoint found for restoration.');
      return false;
    }

    for (const checkpoint of candidates) {
      const validation = this.validateCheckpointPayload(checkpoint);
      if (!validation.valid || !validation.parsed) {
        this.logger.error(
          `[Continuity] Refusing to restore corrupted/incomplete checkpoint ${checkpoint.id}: ${validation.reason}. Valid history preserved.`,
        );
        this.continuityRepo.markCheckpointInvalid(checkpoint.id);
        continue;
      }

      try {
        this.applyMasterStateRestore(validation.parsed);

        this.logger.info(
          `[Continuity] Successfully restored Arle's psychological state & active emotions from verified checkpoint ${checkpoint.id} (Created: ${checkpoint.createdAt})`,
        );

        this.apeService.stepLifecycle();
        this.lastIntegrityValid = true;
        return true;
      } catch (err: any) {
        this.logger.error(`[Continuity] Checkpoint restoration failed for ${checkpoint.id}: ${err.message}`);
        return false;
      }
    }

    this.logger.error('[Continuity] All candidate checkpoints failed validation. Live state was NOT overwritten.');
    return false;
  }

  public async restoreFromOutOfBandMirror(): Promise<boolean> {
    if (!this.backupDir || !fs.existsSync(this.backupDir)) {
      this.logger.warn('[Continuity] Out-of-band backup directory not found; cannot restore from mirror.');
      return false;
    }

    // Walk checkpoint mirror files newest-first, followed by latest.json as fallback
    const numberedFiles = fs
      .readdirSync(this.backupDir)
      .filter((f) => f.startsWith('checkpoint_') && f.endsWith('.json'))
      .sort()
      .reverse()
      .map((f) => path.join(this.backupDir!, f));

    const latestPath = path.join(this.backupDir, 'latest.json');
    const candidateFiles = [...numberedFiles];
    if (fs.existsSync(latestPath)) {
      candidateFiles.push(latestPath);
    }

    for (const filePath of candidateFiles) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const mirror = JSON.parse(raw) as OutOfBandBackupMirror;

        // 1. Validate 6-engine master state hash + structure + invariants
        const validation = this.validateCheckpointPayload({
          masterStateJson: mirror.masterStateJson,
          stateHash: mirror.stateHash,
        });
        if (!validation.valid || !validation.parsed) {
          this.logger.error(
            `[Continuity] Rejecting corrupted out-of-band mirror ${path.basename(filePath)}: ${validation.reason}`,
          );
          continue;
        }

        // 2. Validate memories array cryptographic integrity
        if (!Array.isArray(mirror.memories) || typeof mirror.memoriesHash !== 'string') {
          this.logger.error(
            `[Continuity] Rejecting incomplete out-of-band mirror ${path.basename(filePath)}: missing memories payload`,
          );
          continue;
        }
        const computedMemHash = crypto
          .createHash('sha256')
          .update(canonicalStringify(mirror.memories))
          .digest('hex');
        if (computedMemHash !== mirror.memoriesHash) {
          this.logger.error(
            `[Continuity] Rejecting tampered out-of-band mirror ${path.basename(filePath)}: memories SHA-256 mismatch`,
          );
          continue;
        }

        // 3. Apply 6-engine + active emotions restore atomically
        this.applyMasterStateRestore(validation.parsed);

        // 4. Restore mirrored autobiographical memories
        if (this.memoryProvider?.upsertRestoredMemory) {
          for (const mem of mirror.memories) {
            this.memoryProvider.upsertRestoredMemory(mem);
          }
        }

        this.apeService.stepLifecycle();
        this.lastIntegrityValid = true;
        this.logger.info(
          `[Continuity] Successfully restored Arle's full identity, active emotions, and ${mirror.memories.length} memories from out-of-band mirror ${path.basename(filePath)}.`,
        );
        return true;
      } catch (err: any) {
        this.logger.error(
          `[Continuity] Failed reading/restoring out-of-band mirror ${path.basename(filePath)}: ${err.message}`,
        );
      }
    }

    this.logger.error('[Continuity] All out-of-band backup mirrors failed validation.');
    return false;
  }

  // ==========================================
  // 3. Model Independence & Cross-Channel Presence
  // ==========================================

  public setActiveInferenceModel(modelName: string): void {
    if (!modelName || modelName === this.activeInferenceModel) return;
    const oldModel = this.activeInferenceModel;
    this.activeInferenceModel = modelName;

    this.logger.info(
      `[Continuity] Inference model switched from "${oldModel}" to "${modelName}". Arle's identity and state preserved.`,
    );

    if (this.currentSession) {
      this.continuityRepo.updateHeartbeat(this.currentSession.id);
    }
  }

  public getActiveInferenceModel(): string {
    return this.activeInferenceModel;
  }

  public registerChannelActivity(channel: ChannelOrigin, summary = ''): void {
    if (this.currentSession) {
      try {
        this.continuityRepo.updateHeartbeat(this.currentSession.id);
      } catch {}
    }
    this.continuityRepo.updateChannelPresence(channel, summary);
  }

  public getBackupDir(): string | undefined {
    return this.backupDir;
  }

  public wasRestoredFromOutOfBandMirror(): boolean {
    return this.restoredFromOutOfBandMirror;
  }

  public getStatus(): ContinuityStatus {
    const memoryCount = this.memoryProvider ? this.memoryProvider.count() : 0;
    const channelPresences = this.continuityRepo.getChannelPresences();
    const latestCheckpoint = this.continuityRepo.getLatestVerifiedCheckpoint();
    const allSessions = this.continuityRepo.listSessions(100);

    return {
      currentSession: this.currentSession,
      lastShutdownType: this.lastShutdownType,
      wasUnexpectedShutdown: this.wasUnexpectedShutdown,
      downtimeMs: this.downtimeMs,
      totalSessionsCount: allSessions.length,
      latestCheckpoint,
      channelPresences,
      stateIntegrityValid: this.lastIntegrityValid,
      memoryCount,
    };
  }
}
