import {
  CreateMemoryInput,
  Memory,
  MemoryType,
  MemoryProvenance,
  ContextualRetrievalQuery,
  ContextualRetrievalResult,
  ContextualMemoryMatch,
  RetrievalMatchStatus,
  RetrievalMode,
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
  listForBackup?(): any[];
  upsertRestoredMemory?(memory: any): void;
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

export interface EpisodicConsolidationResult {
  consolidatedMemory: Memory;
  sourceMemories: Memory[];
  mergedIds: string[];
  rejectedIds: string[];
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
          a.metadata = {
            ...(a.metadata || {}),
            contradictedByMemoryId: b.id,
          };
          this.repo.update({
            id: a.id,
            provenance: 'conflicting_information',
            confidence: Math.min(a.confidence, 0.45),
            metadata: a.metadata,
          });

          b.metadata = {
            ...(b.metadata || {}),
            contradictedByMemoryId: a.id,
          };
          this.repo.update({
            id: b.id,
            provenance: 'conflicting_information',
            confidence: Math.min(b.confidence, 0.45),
            metadata: b.metadata,
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
   * Transforms a set of raw episodic memories into a cohesive autobiographical summary.
   * Retains full forward and backward source links (lineage) and preserves original
   * source records intact in storage without deleting them.
   */
  public consolidateEpisodicToAutobiographical(params: {
    sourceMemoryIds: string[];
    theme?: string;
    synthesizedContent?: string;
    importance?: number;
    metadata?: Record<string, unknown>;
  }): EpisodicConsolidationResult {
    const mergedIds: string[] = [];
    const rejectedIds: string[] = [];
    const validSources: Memory[] = [];

    for (const id of params.sourceMemoryIds) {
      const mem = this.repo.getById(id);
      if (mem && !mem.isDeleted) {
        mergedIds.push(id);
        validSources.push(mem);
      } else {
        rejectedIds.push(id);
      }
    }

    if (validSources.length === 0) {
      throw new Error('Cannot consolidate: zero valid source memories found.');
    }

    // Sort source memories chronologically
    validSources.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const theme = params.theme || 'Consolidated Experience';
    const synthesizedContent =
      params.synthesizedContent ||
      `Autobiographical Synthesis [${theme}]: ${validSources.map((s) => s.content).join(' -> ')}`;

    const maxImportance = Math.max(...validSources.map((s) => s.importance));
    const avgConfidence = validSources.reduce((sum, s) => sum + s.confidence, 0) / validSources.length;
    const allTags = Array.from(new Set(validSources.flatMap((s) => s.tags).concat(['consolidated', 'autobiographical'])));

    const now = new Date().toISOString();
    const derivedMemory = this.repo.create({
      type: 'autobiographical',
      content: synthesizedContent,
      importance: params.importance ?? Math.max(0.7, maxImportance),
      confidence: parseFloat(avgConfidence.toFixed(3)),
      provenance: 'historical_consolidation',
      tags: allTags,
      metadata: {
        ...(params.metadata || {}),
        sourceMemoryIds: mergedIds,
        theme,
        sourceCount: validSources.length,
        earliestSourceTimestamp: validSources[0]!.timestamp,
        latestSourceTimestamp: validSources[validSources.length - 1]!.timestamp,
        isConsolidatedSummary: true,
        consolidatedAt: now,
      },
    });

    // Bi-directionally link each source memory forward to the derived summary
    for (const source of validSources) {
      this.repo.update({
        id: source.id,
        metadata: {
          ...(source.metadata || {}),
          consolidatedIntoId: derivedMemory.id,
          consolidatedAt: now,
        },
      });
    }

    this.logger.info(
      `Consolidated ${validSources.length} episodic memories into autobiographical summary ${derivedMemory.id}`,
    );

    return {
      consolidatedMemory: derivedMemory,
      sourceMemories: validSources,
      mergedIds,
      rejectedIds,
    };
  }

  /**
   * Multi-factor contextual retrieval:
   * Combines semantic/lexical similarity, temporal recency, people, project, and source reliability.
   * Truthfully distinguishes "not found" (absent) from "known to be false" (refuted).
   * Strict invariant: zero invented recollections (hasInventedRecollection is false).
   */
  public queryContextual(
    options: ContextualRetrievalQuery & { queryVector?: Float32Array },
  ): ContextualRetrievalResult {
    const limit = options.limit ?? 10;
    const query = options.query;
    const queryLower = query.toLowerCase().trim();
    const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 2);

    let retrievalMode: RetrievalMode = 'contextual_multi_factor';
    if (options.embeddingFailed) {
      retrievalMode = 'lexical_fallback';
    } else if (options.queryVector && this.repo.searchSimilar) {
      retrievalMode = 'hybrid_vector';
    }

    // 1. Fetch candidate memories
    let candidates: Memory[] = [];
    if (retrievalMode === 'hybrid_vector' && options.queryVector && this.repo.searchSimilar) {
      try {
        candidates = this.repo.searchSimilar(options.queryVector, { limit: limit * 3 });
      } catch (err) {
        this.logger.warn('Vector search failed, falling back to multi-factor list', err);
        retrievalMode = 'lexical_fallback';
        candidates = this.repo.list({ limit: 200 });
      }
    } else {
      candidates = this.repo.list({ limit: 200 });
    }

    const now = Date.now();
    const scoredMatches: ContextualMemoryMatch[] = [];
    let hasRefutedMatch = false;
    let primaryRefutedReason: string | undefined;

    // Common semantic expansions for natural language queries
    const SYNONYM_MAP: Record<string, string[]> = {
      device: ['hardware', 'specs', 'machine', 'ally'],
      specs: ['hardware', 'memory', 'cpu', 'device', 'z1', 'lpddr5x'],
      sound: ['voice', 'speech', 'audio', 'kokoro', 'tts'],
      voice: ['sound', 'speech', 'audio', 'kokoro', 'tts'],
      os: ['operating', 'system', 'bazzite', 'linux', 'wayland', 'compositor'],
      operating: ['os', 'system', 'bazzite', 'linux', 'wayland'],
      display: ['wayland', 'compositor', 'screen', 'desktop'],
      browser: ['chrome', 'flatpak', 'navigation'],
      relationship: ['partner', 'equal', 'commitment', 'friend', 'respect'],
      database: ['sqlite', 'wal', 'storage'],
      plans: ['priority', 'roadmap', 'prospective', 'future'],
    };

    // Filter out stopwords
    const STOPWORDS = new Set(['what', 'which', 'where', 'when', 'how', 'does', 'with', 'from', 'that', 'this', 'have', 'been', 'will', 'were', 'the', 'and', 'for', 'are', 'many', 'did']);
    const meaningfulTokens = queryTokens.filter((t) => !STOPWORDS.has(t));

    // Entity tokens that are ubiquitous in Arletex
    const ENTITY_TOKENS = new Set(['arle', 'arles', 'proof', 'proofs', 'arletex']);
    const substantiveTokens = meaningfulTokens.filter((t) => !ENTITY_TOKENS.has(t));

    for (const mem of candidates) {
      if (mem.isDeleted || mem.isArchived) continue;
      if (options.category && mem.type !== options.category) continue;
      if (options.minImportance !== undefined && mem.importance < options.minImportance) continue;
      if (options.minConfidence !== undefined && mem.confidence < options.minConfidence) continue;

      const memTime = new Date(mem.timestamp).getTime();
      if (options.timeRange?.start && memTime < new Date(options.timeRange.start).getTime()) continue;
      if (options.timeRange?.end && memTime > new Date(options.timeRange.end).getTime()) continue;

      const memContentLower = mem.content.toLowerCase();
      const memTagsLower = mem.tags.map((t) => t.toLowerCase());

      // Check for refuted / contradicted match:
      let isRefuted = false;
      let contradictionReason: string | undefined;

      if (mem.correctionHistory && mem.correctionHistory.length > 0) {
        for (const correction of mem.correctionHistory) {
          const prevLower = correction.previousContent.toLowerCase();
          // Find distinctive words in previousContent that were replaced (splitting hyphens as well)
          const prevWords = prevLower
            .replace(/[.,!?;:()]/g, ' ')
            .split(/[\s\-_]+/)
            .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !memContentLower.includes(w));
          const matchesSupersededFact = prevWords.some((w) => queryLower.includes(w));

          if (matchesSupersededFact) {
            isRefuted = true;
            contradictionReason = `Superseded historical fact: was '${correction.previousContent}', corrected because: ${correction.reason || 'updated with verified evidence'}`;
            break;
          }
        }
      }

      if (!isRefuted && (mem.provenance === 'conflicting_information' || (mem.metadata as any)?.contradictedByMemoryId)) {
        isRefuted = true;
        contradictionReason = `Epistemic conflict: memory flagged as conflicting or contradicted by ${(mem.metadata as any)?.contradictedByMemoryId || 'another record'}.`;
      }

      // Compute similarity
      let similarity = 0.0;
      if (retrievalMode === 'hybrid_vector' && typeof mem.similarityScore === 'number') {
        similarity = mem.similarityScore;
      } else {
        const tokensToTest = substantiveTokens.length > 0 ? substantiveTokens : meaningfulTokens;
        if (tokensToTest.length > 0) {
          let tokenHits = 0;
          for (const token of tokensToTest) {
            let hit = memContentLower.includes(token) || memTagsLower.includes(token);
            if (!hit && SYNONYM_MAP[token]) {
              hit = SYNONYM_MAP[token]!.some((syn) => memContentLower.includes(syn) || memTagsLower.includes(syn));
            }
            if (hit) {
              tokenHits++;
            }
          }
          // If query has substantive tokens but ZERO of them hit, this memory does not answer the question!
          if (substantiveTokens.length > 0 && tokenHits === 0 && !isRefuted) {
            similarity = 0.0;
          } else {
            similarity = tokenHits / tokensToTest.length;
            if (memContentLower.includes(queryLower)) {
              similarity = 1.0;
            }
          }
        } else {
          similarity = 0.0;
        }
      }

      // If this memory is refuted and query explicitly asked about the superseded claim, grant match
      if (isRefuted && !similarity) {
        similarity = 0.8;
      }

      // Crucial: If similarity is 0, this memory has zero topical relevance to the query!
      if (similarity === 0.0) {
        continue;
      }

      // Temporal recency: 14-day exponential half-life
      const ageDays = Math.max(0, (now - memTime) / (24 * 3600 * 1000));
      const recency = Math.exp(-ageDays / 14);

      // People match
      let peopleMatch = 1.0;
      if (options.people && options.people.length > 0) {
        const memPeople = (((mem.metadata as any)?.people as string[]) || []).map((p) => p.toLowerCase());
        const matchedPeople = options.people.filter((p) => {
          const pl = p.toLowerCase();
          return memContentLower.includes(pl) || memTagsLower.includes(pl) || memPeople.includes(pl);
        });
        peopleMatch = matchedPeople.length / options.people.length;
      }

      // Project match
      let projectMatch = 1.0;
      if (options.project) {
        const projLower = options.project.toLowerCase();
        const memProj = String((mem.metadata as any)?.project || '').toLowerCase();
        projectMatch = memProj.includes(projLower) || memContentLower.includes(projLower) || memTagsLower.includes(projLower) ? 1.0 : 0.0;
      }

      // Source reliability
      let sourceReliability = 0.7;
      switch (mem.provenance) {
        case 'verified_fact':
        case 'direct_observation':
          sourceReliability = 1.0;
          break;
        case 'raw_observation':
          sourceReliability = 0.95;
          break;
        case 'retrieved_source':
          sourceReliability = 0.90;
          break;
        case 'user_statement':
        case 'user_reported':
          sourceReliability = 0.85;
          break;
        case 'autobiographical_experience':
        case 'historical_consolidation':
        case 'digital_agency':
          sourceReliability = 0.80;
          break;
        case 'interaction':
          sourceReliability = 0.70;
          break;
        case 'inferred_interpretation':
          sourceReliability = 0.60;
          break;
        case 'conflicting_information':
        case 'uncertain_information':
          sourceReliability = 0.35;
          break;
        case 'simulation':
          sourceReliability = 0.20;
          break;
      }

      const relevanceScore = parseFloat(
        (
          similarity * 0.45 +
          mem.importance * 0.20 +
          recency * 0.15 +
          peopleMatch * 0.10 +
          projectMatch * 0.05 +
          sourceReliability * 0.05
        ).toFixed(4),
      );

      // Include if relevant
      if (relevanceScore >= 0.20 || isRefuted) {
        if (isRefuted) {
          hasRefutedMatch = true;
          primaryRefutedReason = contradictionReason;
        }

        scoredMatches.push({
          memory: mem,
          relevanceScore,
          scoreBreakdown: {
            similarity: parseFloat(similarity.toFixed(4)),
            recency: parseFloat(recency.toFixed(4)),
            importance: mem.importance,
            peopleMatch: parseFloat(peopleMatch.toFixed(4)),
            projectMatch: parseFloat(projectMatch.toFixed(4)),
            sourceReliability,
          },
          isRefuted: isRefuted || undefined,
          contradictionReason,
        });
      }
    }

    scoredMatches.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const topEntries = scoredMatches.slice(0, limit);

    let status: RetrievalMatchStatus = 'found';
    let explanation = '';

    if (topEntries.length === 0) {
      status = 'absent';
      explanation = 'No memory found matching the query. (Negative result; fact is not recorded in autobiographical memory.)';
    } else if (hasRefutedMatch && topEntries.some((e) => e.isRefuted)) {
      status = 'refuted';
      explanation = primaryRefutedReason || 'The queried fact was contradicted, superseded, or refuted by verified records.';
    } else {
      status = 'found';
      explanation = `Retrieved ${topEntries.length} verified memories matching multi-factor context.`;
    }

    return {
      status,
      retrievalMode,
      entries: topEntries,
      explanation,
      hasInventedRecollection: false,
    };
  }

  /**
   * Corrects a memory with an immutable audit trail in correctionHistory.
   */
  public correctMemory(params: {
    id: string;
    newContent: string;
    reason: string;
    correctedBy?: string;
  }): Memory {
    const existing = this.repo.getById(params.id);
    if (!existing) {
      throw new Error(`Memory with ID ${params.id} not found for correction.`);
    }

    const now = new Date().toISOString();
    const updated = this.repo.update({
      id: params.id,
      content: params.newContent,
      provenance: 'corrected',
      reason: params.reason,
      metadata: {
        ...(existing.metadata || {}),
        lastCorrectedAt: now,
        correctedBy: params.correctedBy || 'arle',
      },
    });

    this.logger.info(`Corrected memory ${params.id}: "${existing.content}" -> "${params.newContent}" (reason: ${params.reason})`);
    return updated;
  }

  /**
   * Export all memories for backup, preserving IDs, timestamps, provenance, and source links.
   */
  public exportMemories(): any[] {
    if (typeof (this.repo as any).listForBackup === 'function') {
      return (this.repo as any).listForBackup();
    }
    return this.repo.list({ limit: 10000 });
  }

  /**
   * Restore memories from backup, preserving exact provenance and links.
   */
  public importMemories(records: any[]): void {
    if (typeof (this.repo as any).upsertRestoredMemory === 'function') {
      for (const rec of records) {
        (this.repo as any).upsertRestoredMemory(rec);
      }
    } else {
      for (const rec of records) {
        this.repo.create(rec);
      }
    }
  }

  /**
   * Helper to identify logical or semantic contradiction between two statements.
   */
  private detectContradiction(textA: string, textB: string): boolean {
    const negationPairs = [
      ['is true', 'is false'],
      ['likes', 'dislikes'],
      ['loves', 'hates'],
      ['prefers', 'dislikes'],
      ['prefers', 'rejects'],
      ['prefers', 'hates'],
      ['always', 'never'],
      ['succeeded', 'failed'],
      ['verified', 'unverified'],
      ['enabled', 'disabled'],
      ['allowed', 'blocked'],
      ['permitted', 'denied'],
      ['supports', 'opposes'],
    ];

    const cleanA = textA.toLowerCase();
    const cleanB = textB.toLowerCase();

    for (const [pos, neg] of negationPairs) {
      if ((cleanA.includes(pos!) && cleanB.includes(neg!)) || (cleanA.includes(neg!) && cleanB.includes(pos!))) {
        // Must share an entity subject
        const wordsA = new Set(
          cleanA
            .replace(/[.,!?;:()]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 4),
        );
        const sharedEntities = cleanB
          .replace(/[.,!?;:()]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 4 && wordsA.has(w));
        if (sharedEntities.length >= 1) {
          return true;
        }
      }
    }

    return false;
  }
}
