import { connect, type Connection, type Table } from '@lancedb/lancedb'
import { Field, FixedSizeList, Float32, Float64, Int32, Schema, Utf8 } from 'apache-arrow'
import path from 'node:path'
import type { Chunk } from '../shared/types'
import { IndexManifestStore, type IndexManifest, type IndexedFile } from './index-manifest'

const TABLE_NAME = 'chunks'

export type IndexedChunk = Chunk & {
  vector: number[]
  folderPath: string
}

function sqlString(value: string): string {
  return `'${value.replace(/'/gu, "''")}'`
}

function isWithin(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath))
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
}

function schema(vectorDimension: number): Schema {
  return new Schema([
    new Field('vector', new FixedSizeList(vectorDimension, new Field('item', new Float32(), false)), false),
    new Field('filePath', new Utf8(), false),
    new Field('fileName', new Utf8(), false),
    new Field('folderPath', new Utf8(), false),
    new Field('modifiedAt', new Float64(), false),
    new Field('chunkIndex', new Int32(), false),
    new Field('text', new Utf8(), false),
    new Field('page', new Int32(), true),
  ])
}

export class VectorIndex {
  private connectionPromise?: Promise<Connection>

  constructor(
    readonly databasePath: string,
    readonly manifestStore: IndexManifestStore,
  ) {}

  private connection(): Promise<Connection> {
    this.connectionPromise ??= connect(this.databasePath)
    return this.connectionPromise
  }

  private async openTable(): Promise<Table | null> {
    const connection = await this.connection()
    const { tables } = await connection.listTables({ limit: 100 })
    return tables.includes(TABLE_NAME) ? connection.openTable(TABLE_NAME) : null
  }

  private async ensureTable(vectorDimension: number): Promise<Table> {
    const existing = await this.openTable()
    if (existing) return existing
    return (await this.connection()).createEmptyTable(TABLE_NAME, schema(vectorDimension), {
      mode: 'create',
      existOk: true,
    })
  }

  async manifest(): Promise<IndexManifest> {
    return this.manifestStore.load()
  }

  async replaceFile(file: IndexedFile, chunks: readonly IndexedChunk[]): Promise<void> {
    if (chunks.some((chunk) => chunk.filePath !== file.filePath)) {
      throw new Error('All chunks must belong to the file being replaced.')
    }

    const manifest = await this.manifestStore.load()
    const dimension = chunks[0]?.vector.length ?? manifest.vectorDimension
    if (chunks.length > 0 && (!dimension || chunks.some((chunk) => chunk.vector.length !== dimension))) {
      throw new Error('Embedding vectors must have one consistent, non-zero dimension.')
    }
    if (manifest.vectorDimension !== null && dimension !== null && manifest.vectorDimension !== dimension) {
      throw new Error('Embedding dimension changed. Rebuild the index before continuing.')
    }

    const table = await this.openTable()
    if (table) await table.delete(`filePath = ${sqlString(file.filePath)}`)
    if (chunks.length > 0 && dimension !== null) {
      const writableTable = table ?? (await this.ensureTable(dimension))
      await writableTable.add(
        chunks.map((chunk) => ({
          vector: chunk.vector,
          filePath: chunk.filePath,
          fileName: chunk.fileName,
          folderPath: chunk.folderPath,
          modifiedAt: chunk.modifiedAt,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          page: chunk.page ?? null,
        })),
      )
    }

    manifest.vectorDimension = dimension
    manifest.lastUpdated = Date.now()
    manifest.files[file.filePath] = { ...file, chunkCount: chunks.length }
    await this.manifestStore.save(manifest)
  }

  async removeFile(filePath: string): Promise<void> {
    const table = await this.openTable()
    if (table) await table.delete(`filePath = ${sqlString(filePath)}`)
    const manifest = await this.manifestStore.load()
    delete manifest.files[filePath]
    manifest.lastUpdated = Date.now()
    await this.manifestStore.save(manifest)
  }

  async removeFiles(filePaths: readonly string[]): Promise<void> {
    if (filePaths.length === 0) return
    const uniquePaths = [...new Set(filePaths)]
    const table = await this.openTable()
    if (table) {
      await table.delete(uniquePaths.map((filePath) => `filePath = ${sqlString(filePath)}`).join(' OR '))
    }
    const manifest = await this.manifestStore.load()
    for (const filePath of uniquePaths) delete manifest.files[filePath]
    manifest.lastUpdated = Date.now()
    await this.manifestStore.save(manifest)
  }

  async removeFilesBelowRoot(folderPath: string): Promise<string[]> {
    const manifest = await this.manifestStore.load()
    const removed = Object.keys(manifest.files).filter((filePath) => isWithin(folderPath, filePath))
    await this.removeFiles(removed)
    return removed
  }

  async removeDeletedFiles(existingFilePaths: ReadonlySet<string>): Promise<string[]> {
    const manifest = await this.manifestStore.load()
    const removed = Object.keys(manifest.files).filter((filePath) => !existingFilePaths.has(filePath))
    await this.removeFiles(removed)
    return removed
  }

  async countRows(): Promise<number> {
    return (await this.openTable())?.countRows() ?? 0
  }

  async rows(): Promise<Record<string, unknown>[]> {
    const table = await this.openTable()
    return table ? table.query().toArray() : []
  }

  async close(): Promise<void> {
    const connection = await this.connectionPromise
    connection?.close()
    this.connectionPromise = undefined
  }
}

export function toIndexedFile(filePath: string, modifiedAt: number, chunkCount: number): IndexedFile {
  return {
    filePath,
    fileName: path.basename(filePath),
    folderPath: path.dirname(filePath),
    modifiedAt,
    chunkCount,
  }
}
