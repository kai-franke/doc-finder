import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Chunk } from '../shared/types'
import { DocumentIndexer } from './document-indexer'
import { IndexManifestStore } from './index-manifest'
import { OllamaClient } from './ollama-client'
import { VectorIndex } from './vector-index'

describe('DocumentIndexer', () => {
  let root: string
  let vectorIndex: VectorIndex

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-indexer-'))
    vectorIndex = new VectorIndex(
      path.join(root, 'index'),
      new IndexManifestStore(path.join(root, 'manifest.json'), 'nomic-embed-text'),
    )
  })

  afterEach(async () => {
    await vectorIndex.close()
    await fs.rm(root, { recursive: true, force: true })
  })

  it('embeds chunks in bounded batches and stores their metadata', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] }
      return new Response(
        JSON.stringify({ embeddings: body.input.map((_, index) => [index + 1, 0, 0]) }),
      )
    })
    const indexer = new DocumentIndexer(
      new OllamaClient({ fetchImpl }),
      vectorIndex,
      { embeddingBatchSize: 2 },
    )
    const chunks: Chunk[] = Array.from({ length: 3 }, (_, chunkIndex) => ({
      text: `content ${chunkIndex}`,
      filePath: '/docs/file.pdf',
      fileName: 'file.pdf',
      modifiedAt: 10,
      chunkIndex,
    }))

    await indexer.indexChunks(chunks)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body)).input[0]).toBe(
      'search_document: content 0',
    )
    expect(await vectorIndex.countRows()).toBe(3)

    await expect(indexer.indexChunks(chunks)).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
