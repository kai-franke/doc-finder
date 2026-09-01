import { EventEmitter } from 'node:events'
import path from 'node:path'
import type {
  IndexStatus,
  IndexingError,
  IndexingProgress,
  IndexingResult,
  ScanResult,
} from '../shared/types'
import type { DocumentIndexer } from './document-indexer'
import { scanPdfInventory, scanResultFromManifest, type FileInventory } from './index-scanner'
import type { IndexManifest } from './index-manifest'
import { processPdfFiles, type PdfProcessingEvent, type PdfProcessingOptions } from './pdf-processing'
import type { VectorIndex } from './vector-index'

type IndexBackend = Pick<VectorIndex, 'manifest' | 'removeFile'>
type FileIndexer = Pick<DocumentIndexer, 'indexFile'>
type ProcessFiles = (
  paths: readonly string[],
  options?: PdfProcessingOptions,
) => AsyncGenerator<PdfProcessingEvent>

export type IndexCoordinatorDependencies = {
  vectorIndex: IndexBackend
  documentIndexer: FileIndexer
  getFolderPaths: () => string[]
  scanInventory?: (folderPaths: readonly string[]) => Promise<FileInventory>
  updateFolderCounts: (counts: ReadonlyMap<string, number>) => Promise<void>
  processFiles?: ProcessFiles
}

type CoordinatorEvents = {
  status: [IndexStatus]
  scanResult: [ScanResult]
  progress: [IndexingProgress]
  complete: [IndexingResult]
  error: [IndexingError]
}

type CoordinatorListener =
  | ((value: IndexStatus) => void)
  | ((value: ScanResult) => void)
  | ((value: IndexingProgress) => void)
  | ((value: IndexingResult) => void)
  | ((value: IndexingError) => void)

const EMPTY_SCAN: ScanResult = { newFiles: [], changedFiles: [], deletedFiles: [] }

function cloneStatus(status: IndexStatus): IndexStatus {
  return {
    ...status,
    scanResult: {
      newFiles: [...status.scanResult.newFiles],
      changedFiles: [...status.scanResult.changedFiles],
      deletedFiles: [...status.scanResult.deletedFiles],
    },
    progress: status.progress ? { ...status.progress } : null,
  }
}

export class IndexCoordinator {
  private readonly events = new EventEmitter()
  private readonly vectorIndex: IndexBackend
  private readonly documentIndexer: FileIndexer
  private readonly getFolderPaths: () => string[]
  private readonly scanInventory: (folderPaths: readonly string[]) => Promise<FileInventory>
  private readonly updateFolderCounts: (counts: ReadonlyMap<string, number>) => Promise<void>
  private readonly processFiles: ProcessFiles
  private scanPromise?: Promise<ScanResult>
  private inventory?: FileInventory
  private indexingController?: AbortController
  private status: IndexStatus = {
    isScanning: false,
    isIndexing: false,
    scanResult: EMPTY_SCAN,
    indexedDocuments: 0,
    lastUpdated: null,
    progress: null,
  }

  constructor(dependencies: IndexCoordinatorDependencies) {
    this.vectorIndex = dependencies.vectorIndex
    this.documentIndexer = dependencies.documentIndexer
    this.getFolderPaths = dependencies.getFolderPaths
    this.scanInventory = dependencies.scanInventory ?? scanPdfInventory
    this.updateFolderCounts = dependencies.updateFolderCounts
    this.processFiles = dependencies.processFiles ?? processPdfFiles
  }

  on(event: 'status', listener: (value: IndexStatus) => void): () => void
  on(event: 'scanResult', listener: (value: ScanResult) => void): () => void
  on(event: 'progress', listener: (value: IndexingProgress) => void): () => void
  on(event: 'complete', listener: (value: IndexingResult) => void): () => void
  on(event: 'error', listener: (value: IndexingError) => void): () => void
  on(event: keyof CoordinatorEvents, listener: CoordinatorListener): () => void {
    this.events.on(event, listener)
    return () => this.events.off(event, listener)
  }

  private emitStatus(): void {
    this.events.emit('status', cloneStatus(this.status))
  }

  async getStatus(): Promise<IndexStatus> {
    const manifest = await this.vectorIndex.manifest()
    this.applyManifest(manifest)
    return cloneStatus(this.status)
  }

  private applyManifest(manifest: IndexManifest): void {
    this.status.indexedDocuments = Object.keys(manifest.files).length
    this.status.lastUpdated = manifest.lastUpdated
  }

  scan(): Promise<ScanResult> {
    this.scanPromise ??= this.runScan().finally(() => {
      this.scanPromise = undefined
    })
    return this.scanPromise
  }

  private async runScan(): Promise<ScanResult> {
    this.status.isScanning = true
    this.emitStatus()
    try {
      const inventory = await this.scanInventory(this.getFolderPaths())
      this.inventory = inventory
      await this.updateFolderCounts(inventory.folderCounts)
      const manifest = await this.vectorIndex.manifest()
      this.applyManifest(manifest)
      this.status.scanResult = scanResultFromManifest(inventory.files, manifest)
      for (const error of inventory.errors) this.events.emit('error', error)
      this.events.emit('scanResult', this.status.scanResult)
      return this.status.scanResult
    } finally {
      this.status.isScanning = false
      this.emitStatus()
    }
  }

  async start(): Promise<IndexingResult> {
    if (this.indexingController) throw new Error('Indexing is already running.')
    const controller = new AbortController()
    this.indexingController = controller
    await this.scan()
    const scanResult = this.status.scanResult
    const filesToProcess = [...scanResult.newFiles, ...scanResult.changedFiles]
    const total = filesToProcess.length + scanResult.deletedFiles.length
    const errors: IndexingError[] = []
    let current = 0
    let indexed = 0
    let deleted = 0
    let result: IndexingResult = { indexed: 0, deleted: 0, errors: [], aborted: false }

    this.status.isIndexing = true
    this.emitStatus()

    const report = (filePath: string): void => {
      current += 1
      const progress: IndexingProgress = {
        current,
        total,
        fileName: path.basename(filePath),
        percent: total === 0 ? 100 : Math.round((current / total) * 100),
      }
      this.status.progress = progress
      this.events.emit('progress', progress)
      this.emitStatus()
    }
    const recordError = (error: IndexingError): void => {
      errors.push(error)
      this.events.emit('error', error)
    }

    try {
      for (const filePath of scanResult.deletedFiles) {
        if (controller.signal.aborted) break
        try {
          await this.vectorIndex.removeFile(filePath)
          deleted += 1
        } catch (error) {
          recordError({ filePath, message: error instanceof Error ? error.message : String(error) })
        }
        report(filePath)
      }

      if (!controller.signal.aborted) {
        for await (const event of this.processFiles(filesToProcess, { signal: controller.signal })) {
          if (event.type === 'error') {
            recordError({ filePath: event.filePath, message: event.message })
            report(event.filePath)
            continue
          }
          try {
            const modifiedAt = this.inventory?.files.get(event.filePath)
            if (modifiedAt === undefined) throw new Error('File changed while the index was updating.')
            await this.documentIndexer.indexFile(
              event.filePath,
              modifiedAt,
              event.chunks,
              controller.signal,
            )
            indexed += 1
          } catch (error) {
            if (controller.signal.aborted) break
            recordError({
              filePath: event.filePath,
              message: error instanceof Error ? error.message : String(error),
            })
          }
          report(event.filePath)
        }
      }
    } finally {
      result = {
        indexed,
        deleted,
        errors,
        aborted: controller.signal.aborted,
      }
      this.indexingController = undefined
      this.status.isIndexing = false
      this.status.progress = null
      await this.scan()
      this.events.emit('complete', result)
      this.emitStatus()
    }
    return result
  }

  abort(): void {
    this.indexingController?.abort()
  }
}
