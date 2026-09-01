import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { PdfBufferParser } from './pdf-extractor'
import {
  collectChunks,
  processPdfFiles,
  processRegisteredPdfs,
  type PdfProcessingEvent,
} from './pdf-processing'

describe('PDF processing pipeline', () => {
  let root: string

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-pdf-processing-'))
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  async function addPdf(name: string, content = name): Promise<string> {
    const filePath = path.join(root, name)
    await fs.writeFile(filePath, content)
    return filePath
  }

  it('creates canonical Chunk metadata and resets chunkIndex for each PDF', async () => {
    const first = await addPdf('first.pdf')
    const second = await addPdf('second.pdf')
    const parser: PdfBufferParser = async (buffer) => ({
      pages: [{ page: 1, text: `${buffer.toString()} content` }],
    })

    const chunks = await collectChunks(processRegisteredPdfs([root], { parser }))

    expect(chunks).toHaveLength(2)
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 0])
    expect(chunks.map((chunk) => chunk.filePath).sort()).toEqual(
      [await fs.realpath(first), await fs.realpath(second)].sort(),
    )
    for (const chunk of chunks) {
      expect(chunk.fileName).toBe(path.basename(chunk.filePath))
      expect(chunk.modifiedAt).toBe((await fs.stat(chunk.filePath)).mtimeMs)
      expect(chunk.page).toBe(1)
    }
  })

  it('never exceeds the configured PDF parser concurrency', async () => {
    await Promise.all(Array.from({ length: 7 }, (_, index) => addPdf(`${index}.pdf`)))
    let active = 0
    let maximumActive = 0
    const parser: PdfBufferParser = async () => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active -= 1
      return { pages: [{ page: 1, text: 'content' }] }
    }

    await collectChunks(processRegisteredPdfs([root], { concurrency: 3, parser }))

    expect(maximumActive).toBe(3)
  })

  it('isolates parser failures and continues with the remaining PDFs', async () => {
    await addPdf('broken.pdf', 'broken')
    await addPdf('working.pdf', 'working')
    const logged: PdfProcessingEvent[] = []
    const parser: PdfBufferParser = async (buffer) => {
      if (buffer.toString() === 'broken') throw new Error('password required')
      return { pages: [{ page: 1, text: 'working content' }] }
    }
    const events: PdfProcessingEvent[] = []

    for await (const event of processRegisteredPdfs([root], {
      parser,
      logger: (error) => logged.push(error),
    })) {
      events.push(event)
    }

    expect(events.filter((event) => event.type === 'processed')).toHaveLength(1)
    expect(events.filter((event) => event.type === 'error')).toMatchObject([
      { type: 'error', stage: 'parse', message: 'password required' },
    ])
    expect(logged).toHaveLength(1)
  })

  it('treats a PDF without extractable text as a successful empty result', async () => {
    await addPdf('empty.pdf')
    const parser: PdfBufferParser = async () => ({ pages: [{ page: 1, text: '   ' }] })
    const events: PdfProcessingEvent[] = []

    for await (const event of processRegisteredPdfs([root], { parser })) events.push(event)

    expect(events).toMatchObject([{ type: 'processed', chunks: [] }])
  })

  it('stops scheduling new files after cancellation', async () => {
    await Promise.all(Array.from({ length: 5 }, (_, index) => addPdf(`${index}.pdf`)))
    const controller = new AbortController()
    let parserCalls = 0
    const parser: PdfBufferParser = async () => {
      parserCalls += 1
      controller.abort()
      return { pages: [{ page: 1, text: 'content' }] }
    }

    const chunks = await collectChunks(
      processRegisteredPdfs([root], { concurrency: 1, parser, signal: controller.signal }),
    )

    expect(parserCalls).toBe(1)
    expect(chunks).toEqual([])
  })

  it('validates the parser concurrency limit', async () => {
    const events = processRegisteredPdfs([root], { concurrency: 0 })
    await expect(events.next()).rejects.toThrow(RangeError)
  })

  it('processes a large folder with 500 PDFs without retaining file buffers', async () => {
    const paths = await Promise.all(
      Array.from({ length: 500 }, (_, index) => addPdf(`large-${index}.pdf`, `document ${index}`)),
    )
    const parser: PdfBufferParser = async (buffer) => ({
      pages: [{ page: 1, text: buffer.toString() }],
    })
    let processed = 0

    for await (const event of processPdfFiles(paths, { concurrency: 4, parser })) {
      if (event.type === 'processed') processed += 1
    }

    expect(processed).toBe(500)
  }, 10_000)
})
