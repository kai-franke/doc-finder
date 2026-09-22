import { describe, expect, it, vi } from 'vitest'
import type { IndexManifest } from './index-manifest'
import {
  groupSearchRows,
  normalizeCosineDistance,
  SEARCH_CANDIDATE_LIMIT,
  SEARCH_RESULT_LIMIT,
  SearchService,
} from './search-service'

const manifest: IndexManifest = {
  schemaVersion: 1,
  model: 'nomic-embed-text',
  vectorDimension: 3,
  lastUpdated: 1,
  files: {
    '/docs/a.pdf': {
      filePath: '/docs/a.pdf',
      fileName: 'a.pdf',
      folderPath: '/docs',
      modifiedAt: 1,
      chunkCount: 2,
    },
  },
}

describe('semantic search', () => {
  it('normalizes the full cosine distance range', () => {
    expect(normalizeCosineDistance(0)).toBe(1)
    expect(normalizeCosineDistance(1)).toBe(0.5)
    expect(normalizeCosineDistance(2)).toBe(0)
  })

  it('returns only the best chunk for each document', () => {
    const results = groupSearchRows([
      row('/docs/a.pdf', 'a.pdf', 'weaker', 0.4),
      row('/docs/b.pdf', 'b.pdf', 'second', 0.2),
      row('/docs/a.pdf', 'a.pdf', 'best', 0.1),
    ])

    expect(results.map((result) => result.fileName)).toEqual(['a.pdf', 'b.pdf'])
    expect(results[0].snippet).toBe('best')
  })

  it('embeds a prefixed query and requests enough candidate chunks', async () => {
    const getEmbedding = vi.fn(async () => [1, 0, 0])
    const search = vi.fn(async () => [row('/docs/a.pdf', 'a.pdf', 'match', 0.1)])
    const service = new SearchService(
      { getEmbedding },
      { manifest: async () => manifest, search },
    )

    await expect(service.search(' invoice ')).resolves.toMatchObject([{ fileName: 'a.pdf' }])
    expect(getEmbedding).toHaveBeenCalledWith('search_query: invoice', undefined)
    expect(search).toHaveBeenCalledWith([1, 0, 0], SEARCH_CANDIDATE_LIMIT)
  })

  it('returns up to fifty distinct documents after grouping candidate chunks', async () => {
    const candidates = Array.from({ length: 60 }, (_, index) =>
      row(
        `/docs/document-${index}.pdf`,
        `document-${index}.pdf`,
        `match ${index}`,
        index / 100,
      ),
    )
    candidates.push(row('/docs/document-0.pdf', 'document-0.pdf', 'weaker duplicate', 0.9))
    const service = new SearchService(
      { getEmbedding: async () => [1, 0, 0] },
      { manifest: async () => manifest, search: async () => candidates },
    )

    const results = await service.search('query')

    expect(results).toHaveLength(SEARCH_RESULT_LIMIT)
    expect(results[0]).toMatchObject({ fileName: 'document-0.pdf', snippet: 'match 0' })
    expect(results[results.length - 1]?.fileName).toBe('document-49.pdf')
    expect(results.some((result) => result.fileName === 'document-50.pdf')).toBe(false)
  })

  it('returns an empty result without calling Ollama for an empty index', async () => {
    const getEmbedding = vi.fn(async () => [1])
    const search = vi.fn(async () => [])
    const service = new SearchService(
      { getEmbedding },
      { manifest: async () => ({ ...manifest, vectorDimension: null, files: {} }), search },
    )

    await expect(service.search('query')).resolves.toEqual([])
    expect(getEmbedding).not.toHaveBeenCalled()
  })
})

function row(filePath: string, fileName: string, text: string, distance: number) {
  return { filePath, fileName, folderPath: '/docs', text, _distance: distance }
}
