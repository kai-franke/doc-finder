import { describe, expect, it, vi } from 'vitest'
import type { Chunk } from '../shared/types'
import { IndexCoordinator } from './index-coordinator'
import type { FileInventory } from './index-scanner'
import type { IndexManifest, IndexedFile } from './index-manifest'
import type { PdfProcessingEvent } from './pdf-processing'

describe('IndexCoordinator', () => {
  it('indexes changes, deletes missing files, and reports progress', async () => {
    const manifest: IndexManifest = {
      schemaVersion: 1,
      model: 'nomic-embed-text',
      vectorDimension: null,
      lastUpdated: null,
      files: { '/docs/deleted.pdf': indexedFile('/docs/deleted.pdf', 1) },
    }
    const inventory: FileInventory = {
      files: new Map([['/docs/new.pdf', 2]]),
      folderCounts: new Map([['/docs', 1]]),
      errors: [],
    }
    const removeFile = vi.fn(async (filePath: string) => {
      delete manifest.files[filePath]
    })
    const indexFile = vi.fn(async (filePath: string, modifiedAt: number) => {
      manifest.files[filePath] = indexedFile(filePath, modifiedAt)
      manifest.lastUpdated = 10
      return true
    })
    async function* processFiles(paths: readonly string[]): AsyncGenerator<PdfProcessingEvent> {
      const chunks: Chunk[] = [{
        text: 'content',
        filePath: paths[0],
        fileName: 'new.pdf',
        modifiedAt: 2,
        chunkIndex: 0,
      }]
      yield { type: 'processed', filePath: paths[0], chunks }
    }
    const coordinator = new IndexCoordinator({
      vectorIndex: { manifest: async () => manifest, removeFile },
      documentIndexer: { indexFile },
      getFolderPaths: () => ['/docs'],
      scanInventory: async () => inventory,
      updateFolderCounts: async () => undefined,
      processFiles,
    })
    const progress: number[] = []
    coordinator.on('progress', (event) => progress.push(event.percent))

    await expect(coordinator.start()).resolves.toEqual({
      indexed: 1,
      deleted: 1,
      errors: [],
      aborted: false,
    })
    expect(removeFile).toHaveBeenCalledWith('/docs/deleted.pdf')
    expect(indexFile).toHaveBeenCalledOnce()
    expect(progress).toEqual([50, 100])
    expect((await coordinator.getStatus()).scanResult).toEqual({
      newFiles: [],
      changedFiles: [],
      deletedFiles: [],
    })
  })

  it('reports parser failures without exposing technical details', async () => {
    const manifest: IndexManifest = {
      schemaVersion: 1,
      model: 'nomic-embed-text',
      vectorDimension: null,
      lastUpdated: null,
      files: {},
    }
    const inventory: FileInventory = {
      files: new Map([['/docs/protected.pdf', 2]]),
      folderCounts: new Map([['/docs', 1]]),
      errors: [],
    }
    async function* processFiles(): AsyncGenerator<PdfProcessingEvent> {
      yield {
        type: 'error',
        filePath: '/docs/protected.pdf',
        stage: 'parse',
        message: 'PasswordException: owner password required',
      }
    }
    const coordinator = new IndexCoordinator({
      vectorIndex: { manifest: async () => manifest, removeFile: async () => undefined },
      documentIndexer: { indexFile: vi.fn() },
      getFolderPaths: () => ['/docs'],
      scanInventory: async () => inventory,
      updateFolderCounts: async () => undefined,
      processFiles,
    })

    const result = await coordinator.start()

    expect(result.errors).toEqual([{
      filePath: '/docs/protected.pdf',
      message: 'This PDF could not be read. It may be damaged or password-protected.',
    }])
  })
})

function indexedFile(filePath: string, modifiedAt: number): IndexedFile {
  return {
    filePath,
    fileName: filePath.split('/').pop() ?? filePath,
    folderPath: '/docs',
    modifiedAt,
    chunkCount: 1,
  }
}
