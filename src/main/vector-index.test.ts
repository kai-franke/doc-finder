import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { IndexManifestStore } from './index-manifest'
import { toIndexedFile, VectorIndex, type IndexedChunk } from './vector-index'

describe('VectorIndex', () => {
  let root: string
  let index: VectorIndex

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-lancedb-'))
    index = new VectorIndex(
      path.join(root, 'index'),
      new IndexManifestStore(path.join(root, 'manifest.json'), 'nomic-embed-text'),
    )
  })

  afterEach(async () => {
    await index.close()
    await fs.rm(root, { recursive: true, force: true })
  })

  function chunk(chunkIndex: number, vector: number[]): IndexedChunk {
    return {
      text: `chunk ${chunkIndex}`,
      filePath: '/docs/file.pdf',
      fileName: 'file.pdf',
      folderPath: '/docs',
      modifiedAt: 100,
      chunkIndex,
      page: 1,
      vector,
    }
  }

  it('replaces all chunks for a file and persists metadata', async () => {
    const file = toIndexedFile('/docs/file.pdf', 100, 2)
    await index.replaceFile(file, [chunk(0, [1, 0, 0]), chunk(1, [0, 1, 0])])
    expect(await index.countRows()).toBe(2)

    await index.replaceFile({ ...file, chunkCount: 1 }, [chunk(0, [0, 0, 1])])
    expect(await index.countRows()).toBe(1)
    await expect(index.manifest()).resolves.toMatchObject({
      model: 'nomic-embed-text',
      vectorDimension: 3,
      files: { '/docs/file.pdf': { chunkCount: 1 } },
    })
  })

  it('tracks empty PDFs and removes deleted files', async () => {
    await index.replaceFile(toIndexedFile('/docs/empty.pdf', 101, 0), [])
    expect((await index.manifest()).files['/docs/empty.pdf']).toMatchObject({ chunkCount: 0 })

    await index.removeFile('/docs/empty.pdf')
    expect((await index.manifest()).files).toEqual({})
  })

  it('removes entries below a removed source folder', async () => {
    await index.replaceFile(toIndexedFile('/docs/archive/a.pdf', 101, 0), [])
    await index.replaceFile(toIndexedFile('/other/b.pdf', 102, 0), [])

    await expect(index.removeFilesBelowRoot('/docs')).resolves.toEqual(['/docs/archive/a.pdf'])
    expect(Object.keys((await index.manifest()).files)).toEqual(['/other/b.pdf'])
  })

  it('rejects an embedding dimension change', async () => {
    const file = toIndexedFile('/docs/file.pdf', 100, 1)
    await index.replaceFile(file, [chunk(0, [1, 0, 0])])

    await expect(index.replaceFile(file, [chunk(0, [1, 0])])).rejects.toThrow(
      'Embedding dimension changed',
    )
  })
})
