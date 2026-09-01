import path from 'node:path'
import { DocumentIndexer } from './document-indexer'
import { IndexManifestStore } from './index-manifest'
import { OllamaClient, type OllamaClientOptions } from './ollama-client'
import { VectorIndex } from './vector-index'

export type IndexServices = {
  ollama: OllamaClient
  vectorIndex: VectorIndex
  documentIndexer: DocumentIndexer
  close: () => Promise<void>
}

/** Compose the indexing services after Electron's app is ready. */
export function createIndexServices(
  userDataPath: string,
  ollamaOptions: OllamaClientOptions = {},
): IndexServices {
  const ollama = new OllamaClient(ollamaOptions)
  const indexRoot = path.join(userDataPath, 'index')
  const vectorIndex = new VectorIndex(
    path.join(indexRoot, 'lancedb'),
    new IndexManifestStore(path.join(indexRoot, 'manifest.json'), ollama.model),
  )
  const documentIndexer = new DocumentIndexer(ollama, vectorIndex)
  return {
    ollama,
    vectorIndex,
    documentIndexer,
    close: () => vectorIndex.close(),
  }
}
