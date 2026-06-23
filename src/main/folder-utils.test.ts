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

  it('counts a tree wider and deeper than the concurrency bound', async () => {
    // Die Zählung arbeitet die Ordner in Häppchen ab. Dieser Testbaum hat
    // deutlich mehr Unterordner (und mehr Ebenen) als die Standard-Grenze von 8,
    // sodass mehrere solcher Häppchen nacheinander abgearbeitet werden. Pro
    // Ordner liegt genau eine PDF => erwartete Gesamtzahl = Anzahl der Ordner.
    const wide = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-wide-'))
    const breadth = 12
    const depth = 3
    let expected = 0
    async function build(dir: string, level: number): Promise<void> {
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(path.join(dir, 'doc.pdf'), '')
      expected += 1
      if (level === 0) return
      for (let i = 0; i < breadth; i++) {
        await build(path.join(dir, `sub${i}`), level - 1)
      }
    }
    await build(wide, depth)

    expect(await countPdfsRecursively(wide)).toBe(expected)
    expect(await countPdfsRecursively(wide, 1)).toBe(expected) // auch bei nur 1 Ordner gleichzeitig korrekt

    await fs.rm(wide, { recursive: true, force: true })
  })
})
