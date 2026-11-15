import {
  CreateMemoryInput,
  Memory,
  MemoryType,
  MemoryProvenance,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export interface IMemoryRepositorySink {
  create(input: CreateMemoryInput): Memory;
  getById(id: string, includeDeleted?: boolean): Memory | null;
  list(options?: any): Memory[];
  update(input: any): Memory;
  delete(id: string): boolean;
  merge(primaryId: string, secondaryId: string): Memory;
  searchSimilar?(queryVector: Float32Array, options?: { limit?: number; threshold?: number }): Memory[];
}

export interface AssociativeMemoryMatch {
  memory: Memory;
  relevanceScore: number;
  reason: string;
}

export interface MemoryConsolidationReport {
  duplicatesMerged: number;
  contradictionsFlagged: number;
  relationshipsFormed: number;
  memoriesArchived: number;
  timestamp: string;
}

export class AutobiographicalMemoryService {
  private readonly repo: IMemoryRepositorySink;
  private readonly logger: ILogger;

  constructor(repo: IMemoryRepositorySink, logger: ILogger = rootLogger) {
    this.repo = repo;
    this.logger = logger.child('AutobiographicalMemoryService');
  }

  /**
   * Records a grounded memory experience with strict epistemic provenance.
   * Strictly prevents fabricating success: unverified or failed operations
   * are logged truthfully with empirical limitations.
   */
  public recordExperience(params: {
    content: string;
    type?: MemoryType;
    provenance?: MemoryProvenance;
    rawObservation?: string;
    interpretation?: string;
    confidence?: number;
    importance?: number;
    tags?: string[];
    metadata?: Record<string, unknown>;
  }): Memory {
    let provenance = params.provenance || 'interaction';
    let confidence = params.confidence;

    // Strict Epistemic Integrity: Never allow "verified_fact" without direct raw physical observation!
    if (provenance === 'verified_fact' && !params.rawObservation) {
      this.logger.warn('Demoting ungrounded claim from verified_fact to inferred_interpretation');
      provenance = 'inferred_interpretation';
      confidence = Math.min(confidence ?? 0.65, 0.65);
    }

    // Default confidence calibration based on epistemic provenance
    if (confidence === undefined) {
      switch (provenance) {
        case 'verified_fact':
          confidence = 0.98;
          break;
        case 'raw_observation':
          confidence = 0.95;
          break;
        case 'user_statement':
        case 'user_reported':
          confidence = 0.85;
          break;
        case 'autobiographical_experience':
        case 'digital_agency':
        case 'historical_consolidation':
          confidence = 0.80;
          break;
        case 'inferred_interpretation':
          confidence = 0.60;
          break;
        case 'uncertain_information':
        case 'conflicting_information':
          confidence = 0.35;
          break;
        default:
          confidence = 0.70;
      }
    }

    const memory = this.repo.create({
      content: params.content,
      type: params.type || 'autobiographical',
      provenance,
      rawObservation: params.rawObservation,
      interpretation: params.interpretation,
      confidence,
      importance: params.importance ?? 0.5,
      tags: params.tags || [],
      metadata: {
        ...(params.metadata || {}),
        isAutobiographical: true,
        recordedAt: new Date().toISOString(),
      },
    });

    this.logger.info(
      `Recorded autobiographical memory [${memory.type}] id=${memory.id} (confidence=${memory.confidence}, provenance=${memory.provenance})`,
    );

    return memory;
  }

  /**
   * Retrieves associative memories dynamically triggered by a stimulus or event text.
   * Ranks by semantic similarity, importance, epistemic confidence, and recency.
   */
  public retrieveAssociativeContext(
    stimulus: string,
    options: {
      limit?: number;
      typeFilter?: MemoryType[];
      queryVector?: Float32Array;
      minRelevance?: number;
    } = {},
  ): AssociativeMemoryMatch[] {
    const limit = options.limit ?? 5;
    const minRelevance = options.minRelevance ?? 0.25;
    const tokens = stimulus.toLowerCase().split(/\s+/).filter((t) => t.length > 3);

    // 1. If vector search is available, leverage embedding similarity
    if (options.queryVector && this.repo.searchSimilar) {
      try {
        const vectorResults = this.repo.searchSimilar(options.queryVector, {
          limit: limit * 2,
          threshold: minRelevance,
        });

        return vectorResults
          .filter((m) => !options.typeFilter || options.typeFilter.includes(m.type))
          .slice(0, limit)
          .map((m) => {
            const score = (m.similarityScore ?? 0.5) * 0.5 + m.importance * 0.3 + m.confidence * 0.2;
            return {
              memory: m,
              relevanceScore: Number(score.toFixed(3)),
              reason: `Vector semantic resonance (${((m.similarityScore ?? 0) * 100).toFixed(0)}% match)`,
            };
          });
      } catch (err) {
        this.logger.warn('Vector similarity search failed; falling back to lexical associative retrieval', err);
      }
    }

    // 2. Lexical and entity keyword associative matching
    const allMemories = this.repo.list({ limit: 100 });
    const matches: AssociativeMemoryMatch[] = [];

    for (const mem of allMemories) {
      if (mem.isDeleted || mem.isArchived) continue;
      if (options.typeFilter && !options.typeFilter.includes(mem.type)) continue;

      const memContent = mem.content.toLowerCase();
      const memTags = mem.tags.map((t) => t.toLowerCase());

      let keywordHits = 0;
      for (const t of tokens) {
        if (memContent.includes(t) || memTags.includes(t)) {
          keywordHits++;
        }
      }

      if (keywordHits > 0) {
        const keywordScore = Math.min(1.0, keywordHits / Math.max(1, tokens.length));
        const finalScore = keywordScore * 0.5 + mem.importance * 0.3 + mem.confidence * 0.2;

        if (finalScore >= minRelevance) {
          matches.push({
            memory: mem,
            relevanceScore: Number(finalScore.toFixed(3)),
            reason: `Lexical resonance (${keywordHits} shared key concepts)`,
          });
        }
      }
    }

    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return matches.slice(0, limit);
  }

  /**
   * Consolidates memories:
   * 1. Detects and merges redundant duplicates.
   * 2. Detects contradictions and updates confidence/tags without erasing history.
   * 3. Forms associative relationship links between memories.
   * 4. Enforces preservation policy: never purges high-importance (>0.8) or core identity memories.
   */
  public consolidateMemories(): MemoryConsolidationReport {
    this.logger.info('Starting memory consolidation cycle...');
    const memories = this.repo.list({ limit: 200 }).filter((m) => !m.isDeleted && !m.isArchived);
    let duplicatesMerged = 0;
    let contradictionsFlagged = 0;
    let relationshipsFormed = 0;
    let memoriesArchived = 0;

    const visitedPairs = new Set<string>();

    for (let i = 0; i < memories.length; i++) {
      const a = memories[i]!;

      for (let j = i + 1; j < memories.length; j++) {
        const b = memories[j]!;
        const pairKey = `${a.id}:${b.id}`;
        if (visitedPairs.has(pairKey)) continue;
        visitedPairs.add(pairKey);

        // A. Duplicate Detection (Exact or near-identical text content)
        const aClean = a.content.trim().toLowerCase();
        const bClean = b.content.trim().toLowerCase();

        if (aClean === bClean || (aClean.length > 30 && bClean.includes(aClean)) || (bClean.length > 30 && aClean.includes(bClean))) {
          // Designate the earlier memory (or higher importance) as primary
          const [primary, secondary] =
            new Date(a.timestamp).getTime() <= new Date(b.timestamp).getTime() ? [a, b] : [b, a];
          this.logger.info(`Consolidation: Merging duplicate memories (${primary.id} <- ${secondary.id})`);
          this.repo.merge(primary.id, secondary.id);
          duplicatesMerged++;
          continue;
        }

        // B. Contradiction Detection
        // e.g., one states "Proof likes X" and another states "Proof dislikes X" or explicit contrary
        const isContradiction = this.detectContradiction(aClean, bClean);
        if (isContradiction) {
          this.logger.warn(`Consolidation: Contradiction detected between memory ${a.id} and ${b.id}`);
          this.repo.update({
            id: a.id,
            provenance: 'conflicting_information',
            confidence: Math.min(a.confidence, 0.45),
            metadata: {
              ...(a.metadata || {}),
              contradictedByMemoryId: b.id,
            },
          });
          this.repo.update({
            id: b.id,
            provenance: 'conflicting_information',
            confidence: Math.min(b.confidence, 0.45),
            metadata: {
              ...(b.metadata || {}),
              contradictedByMemoryId: a.id,
            },
          });
          contradictionsFlagged++;
        }

        // C. Associative Relationship Formation (Shared tags or domain entities)
        const sharedTags = a.tags.filter((t) => b.tags.includes(t));
        if (sharedTags.length >= 2) {
          let updated = false;
          const aRelated = ((a.metadata?.relatedMemoryIds as string[]) || []).slice();
          if (!aRelated.includes(b.id)) {
            aRelated.push(b.id);
            a.metadata = { ...(a.metadata || {}), relatedMemoryIds: aRelated };
            this.repo.update({
              id: a.id,
              metadata: a.metadata,
            });
            updated = true;
          }

          const bRelated = ((b.metadata?.relatedMemoryIds as string[]) || []).slice();
          if (!bRelated.includes(a.id)) {
            bRelated.push(a.id);
            b.metadata = { ...(b.metadata || {}), relatedMemoryIds: bRelated };
            this.repo.update({
              id: b.id,
              metadata: b.metadata,
            });
            updated = true;
          }

          if (updated) {
            relationshipsFormed++;
          }
        }
      }

      // D. Archival / Retention Policy
      // Protect high importance (>= 0.8) and core autobiographical identity memories!
      const isCoreIdentity = a.metadata?.isCoreIdentity === true || a.importance >= 0.8 || a.type === 'relationship';
      const ageMs = Date.now() - new Date(a.timestamp).getTime();
      const isOldAndLowImportance = ageMs > 30 * 24 * 60 * 60 * 1000 && a.importance < 0.2;

      if (!isCoreIdentity && isOldAndLowImportance) {
        this.repo.update({
          id: a.id,
          isArchived: true,
        });
        memoriesArchived++;
      }
    }

    const report: MemoryConsolidationReport = {
      duplicatesMerged,
      contradictionsFlagged,
      relationshipsFormed,
      memoriesArchived,
      timestamp: new Date().toISOString(),
    };

    this.logger.info('Memory consolidation finished', report);
    return report;
  }

  /**
   * Helper to identify logical or semantic contradiction between two statements.
   */
  private detectContradiction(textA: string, textB: string): boolean {
    const negationPairs = [
      ['is true', 'is false'],
      ['likes', 'dislikes'],
      ['loves', 'hates'],
      ['always', 'never'],
      ['succeeded', 'failed'],
      ['verified', 'unverified'],
      ['enabled', 'disabled'],
    ];

    for (const [pos, neg] of negationPairs) {
      if ((textA.includes(pos!) && textB.includes(neg!)) || (textA.includes(neg!) && textB.includes(pos!))) {
        // Must share an entity subject
        const wordsA = new Set(textA.split(/\s+/));
        const sharedEntities = textB.split(/\s+/).filter((w) => w.length > 4 && wordsA.has(w));
        if (sharedEntities.length >= 1) {
          return true;
        }
      }
    }

    return false;
  }
}
