import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizePath } from './folder-utils'
import { buildScanResult, scanPdfInventory } from './index-scanner'
import type { IndexedFile } from './index-manifest'

describe('index scanner', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-index-scan-'))
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('discovers metadata and derives folder counts in one traversal', async () => {
    const nested = path.join(root, 'nested')
    await fs.mkdir(nested)
    await fs.writeFile(path.join(root, 'first.pdf'), 'one')
    await fs.writeFile(path.join(nested, 'second.PDF'), 'two')
    await fs.writeFile(path.join(root, 'notes.txt'), 'ignore')

    const inventory = await scanPdfInventory([root])

    expect(inventory.files.size).toBe(2)
    expect(inventory.folderCounts.get(normalizePath(root))).toBe(2)
    expect(inventory.errors).toEqual([])
  })

  it('detects new, changed, and deleted files', () => {
    const indexed = {
      '/docs/changed.pdf': indexedFile('/docs/changed.pdf', 1),
      '/docs/deleted.pdf': indexedFile('/docs/deleted.pdf', 1),
    }
    const inventory = new Map([
      ['/docs/new.pdf', 2],
      ['/docs/changed.pdf', 2],
    ])

    expect(buildScanResult(inventory, indexed)).toEqual({
      newFiles: ['/docs/new.pdf'],
      changedFiles: ['/docs/changed.pdf'],
      deletedFiles: ['/docs/deleted.pdf'],
    })
  })
})

function indexedFile(filePath: string, modifiedAt: number): IndexedFile {
  return {
    filePath,
    fileName: path.basename(filePath),
    folderPath: path.dirname(filePath),
    modifiedAt,
    chunkCount: 1,
  }
}
