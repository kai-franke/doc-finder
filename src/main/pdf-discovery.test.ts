import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  canonicalizePath,
  deriveEffectiveScanRoots,
  discoverPdfFiles,
  type PdfDiscoveryError,
} from './pdf-discovery'

describe('PDF discovery', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-pdf-discovery-'))
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('temporarily removes covered child folders without changing the registered list', async () => {
    const child = path.join(root, 'child')
    await fs.mkdir(child)
    const registered = [child, root]

    expect(await deriveEffectiveScanRoots(registered)).toEqual([await canonicalizePath(root)])
    expect(registered).toEqual([child, root])
  })

  it('makes a stored child effective again after its parent is removed', async () => {
    const child = path.join(root, 'child')
    await fs.mkdir(child)

    expect(await deriveEffectiveScanRoots([root, child])).toEqual([await canonicalizePath(root)])
    expect(await deriveEffectiveScanRoots([child])).toEqual([await canonicalizePath(child)])
  })

  it('does not confuse similarly prefixed sibling folders with children', async () => {
    const docs = path.join(root, 'docs')
    const docsOld = path.join(root, 'docs-old')
    await fs.mkdir(docs)
    await fs.mkdir(docsOld)

    const effective = await deriveEffectiveScanRoots([docs, docsOld])
    expect(effective).toHaveLength(2)
  })

  it('finds PDFs recursively, ignores other files, and normalizes paths', async () => {
    const nested = path.join(root, 'nested')
    await fs.mkdir(nested)
    await fs.writeFile(path.join(root, 'first.pdf'), '')
    await fs.writeFile(path.join(nested, 'second.PDF'), '')
    await fs.writeFile(path.join(nested, 'notes.txt'), '')

    const files = await discoverPdfFiles([root])

    expect(files).toEqual(
      [
        await fs.realpath(path.join(root, 'first.pdf')),
        await fs.realpath(path.join(nested, 'second.PDF')),
      ].sort((left, right) => left.localeCompare(right)),
    )
  })

  it('deduplicates the same PDF reached through overlapping roots and a symlink', async () => {
    const child = path.join(root, 'child')
    const pdf = path.join(child, 'document.pdf')
    await fs.mkdir(child)
    await fs.writeFile(pdf, '')
    await fs.symlink(pdf, path.join(root, 'alias.pdf'))

    const files = await discoverPdfFiles([root, child])

    expect(files).toEqual([await fs.realpath(pdf)])
  })

  it('follows directory symlinks without getting trapped in loops', async () => {
    const child = path.join(root, 'child')
    await fs.mkdir(child)
    await fs.writeFile(path.join(child, 'document.pdf'), '')
    await fs.symlink(root, path.join(child, 'back-to-root'))

    expect(await discoverPdfFiles([root])).toEqual([
      await fs.realpath(path.join(child, 'document.pdf')),
    ])
  })

  it('reports broken symlinks and continues scanning', async () => {
    const errors: PdfDiscoveryError[] = []
    await fs.writeFile(path.join(root, 'document.pdf'), '')
    await fs.symlink(path.join(root, 'missing.pdf'), path.join(root, 'broken.pdf'))

    const files = await discoverPdfFiles([root], { onError: (error) => errors.push(error) })

    expect(files).toEqual([await fs.realpath(path.join(root, 'document.pdf'))])
    expect(errors).toHaveLength(1)
    expect(errors[0].path).toBe(path.join(await fs.realpath(root), 'broken.pdf'))
  })

  it('validates the directory concurrency limit', async () => {
    await expect(discoverPdfFiles([root], { concurrency: 0 })).rejects.toThrow(RangeError)
  })
})
