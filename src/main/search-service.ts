import type { SearchResult } from '../shared/types'
import type { OllamaClient } from './ollama-client'
import type { VectorIndex } from './vector-index'

type SearchIndex = Pick<VectorIndex, 'manifest' | 'search'>
type QueryEmbedder = Pick<OllamaClient, 'getEmbedding'>

function stringField(row: Record<string, unknown>, field: string): string | null {
  return typeof row[field] === 'string' ? row[field] : null
}

export function normalizeCosineDistance(distance: number): number {
  if (!Number.isFinite(distance)) return 0
  return Math.min(1, Math.max(0, 1 - distance / 2))
}

export function groupSearchRows(rows: readonly Record<string, unknown>[]): SearchResult[] {
  const byDocument = new Map<string, SearchResult>()
  for (const row of rows) {
    const filePath = stringField(row, 'filePath')
    const fileName = stringField(row, 'fileName')
    const folderPath = stringField(row, 'folderPath')
    const snippet = stringField(row, 'text')
    const distance = typeof row._distance === 'number' ? row._distance : Number.NaN
    if (!filePath || !fileName || !folderPath || !snippet || !Number.isFinite(distance)) continue
    const result = {
      filePath,
      fileName,
      folderPath,
      snippet,
      score: normalizeCosineDistance(distance),
    }
    const current = byDocument.get(filePath)
    if (!current || result.score > current.score) byDocument.set(filePath, result)
  }
  return [...byDocument.values()].sort((left, right) => right.score - left.score)
}

export class SearchService {
  constructor(
    private readonly ollama: QueryEmbedder,
    private readonly index: SearchIndex,
  ) {}

  async search(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const normalizedQuery = query.trim()
    if (!normalizedQuery) return []
    const manifest = await this.index.manifest()
    if (Object.keys(manifest.files).length === 0 || manifest.vectorDimension === null) return []
    const vector = await this.ollama.getEmbedding(`search_query: ${normalizedQuery}`, signal)
    return groupSearchRows(await this.index.search(vector, 10))
  }
}
