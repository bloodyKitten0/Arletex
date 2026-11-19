import crypto from 'node:crypto';
import {
  KnowledgeDocument,
  SemanticSearchResult,
} from '@arletex/contracts';
import { IKnowledgeRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';
import { DocumentIngestionService, IngestDocumentInput } from './documentIngestionService.js';

export interface IEmbeddingProvider {
  embedText(text: string): Promise<number[]>;
}

/**
 * Deterministic bag-of-words / hashed n-gram embedding fallback when
 * external embedding endpoint is not configured or offline.
 */
export class DeterministicSemanticEmbedder implements IEmbeddingProvider {
  private readonly dimensions: number;

  constructor(dimensions = 128) {
    this.dimensions = dimensions;
  }

  public async embedText(text: string): Promise<number[]> {
    const vector = new Array(this.dimensions).fill(0);
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);

    if (tokens.length === 0) return vector;

    for (const token of tokens) {
      const hash = crypto.createHash('md5').update(token).digest();
      const idx = hash.readUInt16BE(0) % this.dimensions;
      const weight = (hash.readUInt8(2) / 255) * 2 - 1;
      vector[idx] += weight;
    }

    // Normalize to unit vector
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) norm += vector[i] * vector[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) vector[i] /= norm;
    }

    return vector;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export class KnowledgeBaseService {
  private readonly repo: IKnowledgeRepository;
  private readonly ingestionService: DocumentIngestionService;
  private readonly embedder: IEmbeddingProvider;
  private readonly logger: ILogger;

  constructor(options: {
    repo: IKnowledgeRepository;
    ingestionService?: DocumentIngestionService;
    embedder?: IEmbeddingProvider;
    logger?: ILogger;
  }) {
    this.repo = options.repo;
    this.ingestionService = options.ingestionService || new DocumentIngestionService(options.logger);
    this.embedder = options.embedder || new DeterministicSemanticEmbedder();
    this.logger = (options.logger || rootLogger).child('KnowledgeBaseService');
  }

  /**
   * Ingests, chunks, embeds, and saves document to the external knowledge repository.
   */
  public async ingestAndIndex(input: IngestDocumentInput): Promise<{
    document: KnowledgeDocument;
    chunksCount: number;
  }> {
    const { document, chunks } = this.ingestionService.ingestDocument(input);
    this.repo.saveDocument(document);

    for (const chunk of chunks) {
      const embedding = await this.embedder.embedText(chunk.content);
      chunk.embedding = embedding;
      this.repo.saveChunk(chunk);
    }

    this.logger.info(`Document "${document.title}" fully indexed with ${chunks.length} chunks.`);
    return { document, chunksCount: chunks.length };
  }

  /**
   * Performs hybrid semantic and keyword search across external knowledge chunks.
   */
  public async search(
    query: string,
    options: {
      domain?: string;
      limit?: number;
      minScore?: number;
    } = {},
  ): Promise<SemanticSearchResult[]> {
    const limit = options.limit ?? 5;
    const minScore = options.minScore ?? 0.25;
    const queryEmbedding = await this.embedder.embedText(query);
    const queryTokens = new Set(
      query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );

    const candidates = this.repo.getAllChunksWithDocs(options.domain);
    const scoredResults: SemanticSearchResult[] = [];

    for (const item of candidates) {
      const { chunk, document } = item;
      let score = 0;

      // 1. Vector cosine similarity
      if (chunk.embedding && chunk.embedding.length > 0) {
        const cosSim = cosineSimilarity(queryEmbedding, chunk.embedding);
        score += Math.max(0, cosSim) * 0.65;
      }

      // 2. Lexical keyword overlap
      const chunkTokens = chunk.content
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t: string) => t.length > 2);

      let matchedTokens = 0;
      for (const tok of chunkTokens) {
        if (queryTokens.has(tok)) matchedTokens++;
      }
      const lexicalScore = queryTokens.size > 0 ? Math.min(1.0, matchedTokens / queryTokens.size) : 0;
      score += lexicalScore * 0.35;

      // 3. Weight by source reliability
      const finalScore = score * (document.reliabilityScore || 0.8);

      if (finalScore >= minScore) {
        scoredResults.push({
          chunk,
          score: Math.round(finalScore * 1000) / 1000,
          documentTitle: document.title,
          domain: document.domain,
          sourceUri: document.sourceUri,
          reliabilityScore: document.reliabilityScore,
        });
      }
    }

    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, limit);
  }

  public getDocument(id: string): KnowledgeDocument | null {
    return this.repo.getDocument(id);
  }

  public listDocuments(domain?: string): KnowledgeDocument[] {
    return this.repo.listDocuments(domain);
  }
}
