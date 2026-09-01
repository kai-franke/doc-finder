import { promises as fs } from 'node:fs'
import path from 'node:path'
import { logError } from './logger'

export type IndexedFile = {
  filePath: string
  fileName: string
  folderPath: string
  modifiedAt: number
  chunkCount: number
}

export type IndexManifest = {
  schemaVersion: 1
  model: string
  vectorDimension: number | null
  lastUpdated: number | null
  files: Record<string, IndexedFile>
}

function emptyManifest(model: string): IndexManifest {
  return {
    schemaVersion: 1,
    model,
    vectorDimension: null,
    lastUpdated: null,
    files: {},
  }
}

function isIndexedFile(value: unknown): value is IndexedFile {
  if (!value || typeof value !== 'object') return false
  const file = value as Partial<IndexedFile>
  return (
    typeof file.filePath === 'string' &&
    typeof file.fileName === 'string' &&
    typeof file.folderPath === 'string' &&
    typeof file.modifiedAt === 'number' &&
    typeof file.chunkCount === 'number'
  )
}

function parseManifest(value: unknown, model: string): IndexManifest {
  if (!value || typeof value !== 'object') return emptyManifest(model)
  const candidate = value as Partial<IndexManifest>
  if (
    candidate.schemaVersion !== 1 ||
    candidate.model !== model ||
    (candidate.vectorDimension !== null && typeof candidate.vectorDimension !== 'number') ||
    (candidate.lastUpdated !== null && typeof candidate.lastUpdated !== 'number') ||
    !candidate.files ||
    typeof candidate.files !== 'object' ||
    !Object.values(candidate.files).every(isIndexedFile)
  ) {
    return emptyManifest(model)
  }
  return candidate as IndexManifest
}

/** Crash-resistant JSON metadata for file-level change detection. */
export class IndexManifestStore {
  constructor(
    readonly filePath: string,
    readonly model: string,
  ) {}

  async load(): Promise<IndexManifest> {
    try {
      const value: unknown = JSON.parse(await fs.readFile(this.filePath, 'utf8'))
      return parseManifest(value, this.model)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logError('manifest-read', error, { filePath: this.filePath })
      }
      return emptyManifest(this.model)
    }
  }

  async save(manifest: IndexManifest): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    const temporaryPath = `${this.filePath}.tmp`
    await fs.writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    await fs.rename(temporaryPath, this.filePath)
  }
}
