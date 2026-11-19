import crypto from 'node:crypto';
import { KnowledgeDocument, KnowledgeChunk } from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export interface IngestDocumentInput {
  title: string;
  domain: string;
  sourceUri: string;
  content: string;
  author?: string;
  reliabilityScore?: number;
  metadata?: Record<string, unknown>;
  chunkSize?: number;
  chunkOverlap?: number;
}

export class DocumentIngestionService {
  private readonly logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('DocumentIngestionService');
  }

  /**
   * Ingests a document, creates a KnowledgeDocument entity, and divides the content
   * into semantically coherent overlapping chunks.
   */
  public ingestDocument(input: IngestDocumentInput): {
    document: KnowledgeDocument;
    chunks: KnowledgeChunk[];
  } {
    const docId = crypto.randomUUID();
    const now = new Date().toISOString();

    const document: KnowledgeDocument = {
      id: docId,
      title: input.title,
      domain: input.domain,
      sourceUri: input.sourceUri,
      author: input.author,
      reliabilityScore: input.reliabilityScore ?? 0.85,
      metadata: input.metadata || {},
      createdAt: now,
    };

    const chunkSize = input.chunkSize ?? 600;
    const chunkOverlap = input.chunkOverlap ?? 100;
    const rawChunks = this.splitIntoSemanticChunks(input.content, chunkSize, chunkOverlap);

    const chunks: KnowledgeChunk[] = rawChunks.map((content, idx) => ({
      id: crypto.randomUUID(),
      documentId: docId,
      chunkIndex: idx,
      content,
      contentHash: crypto.createHash('sha256').update(content).digest('hex'),
      createdAt: now,
    }));

    this.logger.info(
      `Ingested document "${document.title}" (${document.domain}) -> ${chunks.length} chunks.`,
    );

    return { document, chunks };
  }

  /**
   * Splits text respecting paragraph and sentence boundaries.
   */
  public splitIntoSemanticChunks(text: string, maxChunkLength: number, overlap: number): string[] {
    const cleaned = text.replace(/\r\n/g, '\n').trim();
    if (!cleaned) return [];
    if (cleaned.length <= maxChunkLength) return [cleaned];

    // Split by paragraphs first
    const paragraphs = cleaned.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const p = paragraph.trim();
      if (!p) continue;

      if ((currentChunk + '\n\n' + p).length <= maxChunkLength) {
        currentChunk = currentChunk ? currentChunk + '\n\n' + p : p;
      } else {
        // If currentChunk has content, push it
        if (currentChunk) {
          chunks.push(currentChunk);
          // Overlap tail
          const tail = currentChunk.slice(-overlap);
          currentChunk = tail + '\n\n' + p;
        } else {
          // Paragraph itself is larger than maxChunkLength: split by sentences
          const sentences = p.split(/(?<=[.?!])\s+/);
          let sentenceChunk = '';
          for (const s of sentences) {
            if ((sentenceChunk + ' ' + s).length <= maxChunkLength) {
              sentenceChunk = sentenceChunk ? sentenceChunk + ' ' + s : s;
            } else {
              if (sentenceChunk) chunks.push(sentenceChunk);
              sentenceChunk = s;
            }
          }
          if (sentenceChunk) currentChunk = sentenceChunk;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}
