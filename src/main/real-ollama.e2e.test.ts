import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Chunk } from '../shared/types'
import { DocumentIndexer } from './document-indexer'
import { IndexManifestStore } from './index-manifest'
import { OllamaClient } from './ollama-client'
import { SearchService } from './search-service'
import { VectorIndex } from './vector-index'

const runRealOllama = process.env.DOCFINDER_REAL_OLLAMA === '1'

describe.skipIf(!runRealOllama)('real Ollama and LanceDB integration', () => {
  it('indexes local embeddings and returns the semantically matching document', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-real-e2e-'))
    const ollama = new OllamaClient({ timeoutMs: 30_000 })
    const vectorIndex = new VectorIndex(
      path.join(root, 'lancedb'),
      new IndexManifestStore(path.join(root, 'manifest.json'), ollama.model),
    )

    try {
      expect(await ollama.listModels()).toContain('nomic-embed-text:latest')
      const chunks: Chunk[] = [
        {
          filePath: '/documents/office-invoice.pdf',
          fileName: 'office-invoice.pdf',
          modifiedAt: 1,
          chunkIndex: 0,
          text: 'Invoice for ergonomic office chairs and standing desks.',
        },
        {
          filePath: '/documents/garden-notes.pdf',
          fileName: 'garden-notes.pdf',
          modifiedAt: 1,
          chunkIndex: 0,
          text: 'Notes about planting tomatoes and watering the garden.',
        },
      ]
      await new DocumentIndexer(ollama, vectorIndex).indexChunks(chunks)

      const results = await new SearchService(ollama, vectorIndex).search(
        'bill for office furniture',
      )

      expect(results[0]?.fileName).toBe('office-invoice.pdf')
      expect(results[0]?.score).toBeGreaterThan(0.5)
    } finally {
      await vectorIndex.close()
      await fs.rm(root, { recursive: true, force: true })
    }
  }, 30_000)
})
