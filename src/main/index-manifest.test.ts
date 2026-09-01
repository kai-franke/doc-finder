import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { IndexManifestStore } from './index-manifest'

describe('IndexManifestStore', () => {
  let root: string
  let filePath: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-manifest-'))
    filePath = path.join(root, 'state', 'manifest.json')
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('creates, saves, and reloads a manifest', async () => {
    const store = new IndexManifestStore(filePath, 'model')
    const manifest = await store.load()
    manifest.vectorDimension = 3
    manifest.files['/docs/a.pdf'] = {
      filePath: '/docs/a.pdf',
      fileName: 'a.pdf',
      folderPath: '/docs',
      modifiedAt: 42,
      chunkCount: 2,
    }
    await store.save(manifest)

    await expect(store.load()).resolves.toEqual(manifest)
  })

  it('recovers safely from invalid metadata', async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, '{broken')
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(new IndexManifestStore(filePath, 'model').load()).resolves.toMatchObject({
      model: 'model',
      vectorDimension: null,
      files: {},
    })
    error.mockRestore()
  })
})
