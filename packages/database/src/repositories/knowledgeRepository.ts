import Database from 'better-sqlite3';
import { KnowledgeDocument, KnowledgeChunk, LoRAAdapterRecord } from '@arletex/contracts';
import { IKnowledgeRepository } from '@arletex/core';

export { IKnowledgeRepository };

export class SqliteKnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly db: Database.Database) {}

  public saveDocument(doc: KnowledgeDocument): void {
    const stmt = this.db.prepare(`
      INSERT INTO external_knowledge_documents (
        id, title, domain, source_uri, author, reliability_score, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        domain = excluded.domain,
        source_uri = excluded.source_uri,
        author = excluded.author,
        reliability_score = excluded.reliability_score,
        metadata_json = excluded.metadata_json
    `);

    stmt.run(
      doc.id,
      doc.title,
      doc.domain,
      doc.sourceUri,
      doc.author || null,
      doc.reliabilityScore,
      JSON.stringify(doc.metadata || {}),
      doc.createdAt,
    );
  }

  public getDocument(id: string): KnowledgeDocument | null {
    const row = this.db
      .prepare(`SELECT * FROM external_knowledge_documents WHERE id = ?`)
      .get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      domain: row.domain,
      sourceUri: row.source_uri,
      author: row.author || undefined,
      reliabilityScore: row.reliability_score,
      metadata: JSON.parse(row.metadata_json || '{}'),
      createdAt: row.created_at,
    };
  }

  public listDocuments(domain?: string): KnowledgeDocument[] {
    const query = domain
      ? `SELECT * FROM external_knowledge_documents WHERE domain = ? ORDER BY created_at DESC`
      : `SELECT * FROM external_knowledge_documents ORDER BY created_at DESC`;
    const rows = (
      domain ? this.db.prepare(query).all(domain) : this.db.prepare(query).all()
    ) as any[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      domain: row.domain,
      sourceUri: row.source_uri,
      author: row.author || undefined,
      reliabilityScore: row.reliability_score,
      metadata: JSON.parse(row.metadata_json || '{}'),
      createdAt: row.created_at,
    }));
  }

  public deleteDocument(id: string): void {
    this.db.prepare(`DELETE FROM external_knowledge_documents WHERE id = ?`).run(id);
  }

  public saveChunk(chunk: KnowledgeChunk): void {
    const stmt = this.db.prepare(`
      INSERT INTO external_knowledge_chunks (
        id, document_id, chunk_index, content, content_hash, embedding_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        content = excluded.content,
        content_hash = excluded.content_hash,
        embedding_json = excluded.embedding_json
    `);

    stmt.run(
      chunk.id,
      chunk.documentId,
      chunk.chunkIndex,
      chunk.content,
      chunk.contentHash,
      chunk.embedding ? JSON.stringify(chunk.embedding) : null,
      chunk.createdAt,
    );
  }

  public getChunksByDocument(documentId: string): KnowledgeChunk[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM external_knowledge_chunks WHERE document_id = ? ORDER BY chunk_index ASC`,
      )
      .all(documentId) as any[];

    return rows.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      chunkIndex: r.chunk_index,
      content: r.content,
      contentHash: r.content_hash,
      embedding: r.embedding_json ? JSON.parse(r.embedding_json) : undefined,
      createdAt: r.created_at,
    }));
  }

  public getAllChunksWithDocs(
    domain?: string,
  ): Array<{ chunk: KnowledgeChunk; document: KnowledgeDocument }> {
    const query = domain
      ? `
        SELECT c.*, d.title as doc_title, d.domain as doc_domain, d.source_uri, d.author, d.reliability_score, d.metadata_json, d.created_at as doc_created_at
        FROM external_knowledge_chunks c
        JOIN external_knowledge_documents d ON c.document_id = d.id
        WHERE d.domain = ?
      `
      : `
        SELECT c.*, d.title as doc_title, d.domain as doc_domain, d.source_uri, d.author, d.reliability_score, d.metadata_json, d.created_at as doc_created_at
        FROM external_knowledge_chunks c
        JOIN external_knowledge_documents d ON c.document_id = d.id
      `;

    const rows = (
      domain ? this.db.prepare(query).all(domain) : this.db.prepare(query).all()
    ) as any[];

    return rows.map((r) => ({
      chunk: {
        id: r.id,
        documentId: r.document_id,
        chunkIndex: r.chunk_index,
        content: r.content,
        contentHash: r.content_hash,
        embedding: r.embedding_json ? JSON.parse(r.embedding_json) : undefined,
        createdAt: r.created_at,
      },
      document: {
        id: r.document_id,
        title: r.doc_title,
        domain: r.doc_domain,
        sourceUri: r.source_uri,
        author: r.author || undefined,
        reliabilityScore: r.reliability_score,
        metadata: JSON.parse(r.metadata_json || '{}'),
        createdAt: r.doc_created_at,
      },
    }));
  }

  public saveLoraAdapter(record: LoRAAdapterRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO lora_adapters (
        id, name, domain, base_model_id, status, config_json, evaluation_json, weights_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        domain = excluded.domain,
        base_model_id = excluded.base_model_id,
        status = excluded.status,
        config_json = excluded.config_json,
        evaluation_json = excluded.evaluation_json,
        weights_path = excluded.weights_path,
        updated_at = excluded.updated_at
    `);

    stmt.run(
      record.id,
      record.name,
      record.domain,
      record.baseModelId,
      record.status,
      JSON.stringify(record.config),
      record.evaluationMetrics ? JSON.stringify(record.evaluationMetrics) : null,
      record.weightsPath || null,
      record.createdAt,
      record.updatedAt,
    );
  }

  public getLoraAdapter(id: string): LoRAAdapterRecord | null {
    const row = this.db.prepare(`SELECT * FROM lora_adapters WHERE id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      domain: row.domain,
      baseModelId: row.base_model_id,
      status: row.status,
      config: JSON.parse(row.config_json),
      evaluationMetrics: row.evaluation_json ? JSON.parse(row.evaluation_json) : undefined,
      weightsPath: row.weights_path || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  public listLoraAdapters(domain?: string): LoRAAdapterRecord[] {
    const query = domain
      ? `SELECT * FROM lora_adapters WHERE domain = ? ORDER BY created_at DESC`
      : `SELECT * FROM lora_adapters ORDER BY created_at DESC`;
    const rows = (
      domain ? this.db.prepare(query).all(domain) : this.db.prepare(query).all()
    ) as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      domain: r.domain,
      baseModelId: r.base_model_id,
      status: r.status,
      config: JSON.parse(r.config_json),
      evaluationMetrics: r.evaluation_json ? JSON.parse(r.evaluation_json) : undefined,
      weightsPath: r.weights_path || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  public updateLoraAdapter(record: Partial<LoRAAdapterRecord> & { id: string }): void {
    const existing = this.getLoraAdapter(record.id);
    if (!existing) throw new Error(`LoRA adapter ${record.id} not found`);

    const updated: LoRAAdapterRecord = {
      ...existing,
      ...record,
      updatedAt: new Date().toISOString(),
    };
    this.saveLoraAdapter(updated);
  }
}
