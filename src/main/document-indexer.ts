import path from 'node:path'
import type { Chunk } from '../shared/types'
import { OllamaClient } from './ollama-client'
import { toIndexedFile, type IndexedChunk, VectorIndex } from './vector-index'

export type DocumentIndexerOptions = {
  embeddingBatchSize?: number
}

function assertBatchSize(batchSize: number): void {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError('embeddingBatchSize must be a positive integer')
  }
}

export class DocumentIndexer {
  private readonly embeddingBatchSize: number

  constructor(
    private readonly ollama: OllamaClient,
    private readonly index: VectorIndex,
    options: DocumentIndexerOptions = {},
  ) {
    this.embeddingBatchSize = options.embeddingBatchSize ?? 16
    assertBatchSize(this.embeddingBatchSize)
  }

  async indexFile(
    filePath: string,
    modifiedAt: number,
    chunks: readonly Chunk[],
    signal?: AbortSignal,
  ): Promise<boolean> {
    if (chunks.some((chunk) => chunk.filePath !== filePath || chunk.modifiedAt !== modifiedAt)) {
      throw new Error('Chunk metadata does not match the file being indexed.')
    }

    const current = (await this.index.manifest()).files[filePath]
    if (current?.modifiedAt === modifiedAt) return false

    const indexedChunks: IndexedChunk[] = []
    for (let start = 0; start < chunks.length; start += this.embeddingBatchSize) {
      if (signal?.aborted) throw new DOMException('Indexing was cancelled.', 'AbortError')
      const batch = chunks.slice(start, start + this.embeddingBatchSize)
      const vectors = await this.ollama.embed(
        batch.map((chunk) => `search_document: ${chunk.text}`),
        signal,
      )
      indexedChunks.push(
        ...batch.map((chunk, index) => ({
          ...chunk,
          vector: vectors[index],
          folderPath: path.dirname(chunk.filePath),
        })),
      )
    }

    await this.index.replaceFile(
      toIndexedFile(filePath, modifiedAt, indexedChunks.length),
      indexedChunks,
    )
    return true
  }

  async indexChunks(chunks: readonly Chunk[], signal?: AbortSignal): Promise<void> {
    const byFile = new Map<string, Chunk[]>()
    for (const chunk of chunks) {
      const fileChunks = byFile.get(chunk.filePath) ?? []
      fileChunks.push(chunk)
      byFile.set(chunk.filePath, fileChunks)
    }
    for (const [filePath, fileChunks] of byFile) {
      await this.indexFile(filePath, fileChunks[0].modifiedAt, fileChunks, signal)
    }
  }
}
