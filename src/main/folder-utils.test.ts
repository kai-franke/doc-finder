import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { countPdfsRecursively, deriveLabel, normalizePath } from './folder-utils'

describe('deriveLabel', () => {
  it('returns the last path segment', () => {
    expect(deriveLabel('/Users/me/Documents/Invoices')).toBe('Invoices')
  })

  it('ignores a trailing slash', () => {
    expect(deriveLabel('/Users/me/Invoices/')).toBe('Invoices')
  })
})

describe('normalizePath', () => {
  it('lower-cases for case-insensitive duplicate detection', () => {
    expect(normalizePath('/Users/me/Docs')).toBe(normalizePath('/Users/me/docs'))
  })
})

describe('countPdfsRecursively', () => {
  let root: string

  // Fixture tree:
  //   root/a.pdf, root/b.PDF, root/notes.txt
  //   root/sub/c.pdf
  //   root/sub/deeper/d.pdf
  //   root/empty/   (no PDFs)
  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-test-'))
    await fs.mkdir(path.join(root, 'sub', 'deeper'), { recursive: true })
    await fs.mkdir(path.join(root, 'empty'), { recursive: true })
    await fs.writeFile(path.join(root, 'a.pdf'), '')
    await fs.writeFile(path.join(root, 'b.PDF'), '')
    await fs.writeFile(path.join(root, 'notes.txt'), '')
    await fs.writeFile(path.join(root, 'sub', 'c.pdf'), '')
    await fs.writeFile(path.join(root, 'sub', 'deeper', 'd.pdf'), '')
  })

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('counts PDFs recursively, case-insensitively, ignoring non-PDFs', async () => {
    expect(await countPdfsRecursively(root)).toBe(4)
  })

  it('returns 0 for an inaccessible / non-existent path', async () => {
    expect(await countPdfsRecursively(path.join(root, 'does-not-exist'))).toBe(0)
  })
})
