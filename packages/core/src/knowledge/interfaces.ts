import { KnowledgeDocument, KnowledgeChunk, LoRAAdapterRecord } from '@arletex/contracts';

export interface IKnowledgeRepository {
  saveDocument(doc: KnowledgeDocument): void;
  getDocument(id: string): KnowledgeDocument | null;
  listDocuments(domain?: string): KnowledgeDocument[];
  deleteDocument(id: string): void;
  saveChunk(chunk: KnowledgeChunk): void;
  getChunksByDocument(documentId: string): KnowledgeChunk[];
  getAllChunksWithDocs(
    domain?: string,
  ): Array<{ chunk: KnowledgeChunk; document: KnowledgeDocument }>;
  saveLoraAdapter(record: LoRAAdapterRecord): void;
  getLoraAdapter(id: string): LoRAAdapterRecord | null;
  listLoraAdapters(domain?: string): LoRAAdapterRecord[];
  updateLoraAdapter(record: Partial<LoRAAdapterRecord> & { id: string }): void;
}
