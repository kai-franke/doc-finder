import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Chunk } from '../shared/types'
import { createTextChunks } from './pdf-chunking'
import {
  deriveEffectiveScanRoots,
  discoverPdfFiles,
  type PdfDiscoveryError,
} from './pdf-discovery'
import { parsePdfBuffer, type PdfBufferParser } from './pdf-extractor'

export type PdfProcessingStage = 'discovery' | 'stat' | 'read' | 'parse'

export type PdfProcessingEvent =
  | { type: 'processed'; filePath: string; chunks: Chunk[] }
  | {
      type: 'error'
      filePath: string
      stage: PdfProcessingStage
      message: string
    }

export type PdfProcessingOptions = {
  /** Number of PDF files parsed at the same time. Parsing is memory intensive. */
  concurrency?: number
  /** Prepared for the cancellable indexing flow in US-06. */
  signal?: AbortSignal
  /** Injectable in tests and when upgrading the third-party parser. */
  parser?: PdfBufferParser
  logger?: (event: Extract<PdfProcessingEvent, { type: 'error' }>) => void
}

type ProcessingResult = PdfProcessingEvent | null

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function assertConcurrency(concurrency: number): void {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('concurrency must be a positive integer')
  }
}

function defaultLogger(event: Extract<PdfProcessingEvent, { type: 'error' }>): void {
  console.error(`[PDF processing:${event.stage}] ${event.filePath}: ${event.message}`)
}

function processingError(
  filePath: string,
  stage: PdfProcessingStage,
  error: unknown,
): Extract<PdfProcessingEvent, { type: 'error' }> {
  return { type: 'error', filePath, stage, message: errorMessage(error) }
}

async function processOnePdf(
  filePath: string,
  parser: PdfBufferParser,
  signal?: AbortSignal,
): Promise<ProcessingResult> {
  if (signal?.aborted) return null

  let modifiedAt: number
  try {
    modifiedAt = (await fs.stat(filePath)).mtimeMs
  } catch (error) {
    return processingError(filePath, 'stat', error)
  }

  if (signal?.aborted) return null

  let buffer: Buffer
  try {
    buffer = await fs.readFile(filePath)
  } catch (error) {
    return processingError(filePath, 'read', error)
  }

  if (signal?.aborted) return null

  try {
    const extracted = await parser(buffer)
    const textChunks = createTextChunks(extracted.pages)
    const chunks: Chunk[] = textChunks.map((chunk, chunkIndex) => ({
      text: chunk.text,
      filePath,
      fileName: path.basename(filePath),
      modifiedAt,
      chunkIndex,
      ...(chunk.page === undefined ? {} : { page: chunk.page }),
    }))
    return { type: 'processed', filePath, chunks }
  } catch (error) {
    return processingError(filePath, 'parse', error)
  }
}

/**
 * Discovers and processes registered PDFs as a stream of per-file events.
 *
 * Only a bounded set of promises exists at any moment. `Promise.race` yields a
 * completed file immediately, which later allows the indexer to report progress
 * and persist chunks step by step instead of retaining every PDF in memory.
 */
export async function* processRegisteredPdfs(
  registeredFolderPaths: readonly string[],
  options: PdfProcessingOptions = {},
): AsyncGenerator<PdfProcessingEvent> {
  const concurrency = options.concurrency ?? 2
  assertConcurrency(concurrency)
  if (options.signal?.aborted) return

  const logger = options.logger ?? defaultLogger
  const discoveryErrors: PdfDiscoveryError[] = []
  const effectiveRoots = await deriveEffectiveScanRoots(registeredFolderPaths)
  const pdfPaths = await discoverPdfFiles(effectiveRoots, {
    onError: (error) => discoveryErrors.push(error),
  })

  for (const error of discoveryErrors) {
    const event = processingError(error.path, 'discovery', error.message)
    logger(event)
    yield event
  }

  yield* processPdfFiles(pdfPaths, options)
}

/** Processes an already discovered set of PDFs, used by incremental indexing. */
export async function* processPdfFiles(
  pdfPaths: readonly string[],
  options: PdfProcessingOptions = {},
): AsyncGenerator<PdfProcessingEvent> {
  const concurrency = options.concurrency ?? 2
  assertConcurrency(concurrency)
  if (options.signal?.aborted) return

  const logger = options.logger ?? defaultLogger
  const parser = options.parser ?? parsePdfBuffer
  let nextFileIndex = 0
  let nextTaskId = 0
  const active = new Map<number, Promise<{ taskId: number; result: ProcessingResult }>>()

  const scheduleNext = (): void => {
    if (nextFileIndex >= pdfPaths.length || options.signal?.aborted) return
    const filePath = pdfPaths[nextFileIndex]
    nextFileIndex += 1
    const taskId = nextTaskId
    nextTaskId += 1
    active.set(
      taskId,
      processOnePdf(filePath, parser, options.signal).then((result) => ({ taskId, result })),
    )
  }

  while (active.size < concurrency && nextFileIndex < pdfPaths.length) scheduleNext()

  while (active.size > 0) {
    const { taskId, result } = await Promise.race(active.values())
    active.delete(taskId)

    if (options.signal?.aborted) return
    scheduleNext()

    if (!result) continue
    if (result.type === 'error') logger(result)
    yield result
  }
}

/** Compatibility helper for consumers that need the canonical `Chunk[]` form. */
export async function collectChunks(
  events: AsyncIterable<PdfProcessingEvent>,
): Promise<Chunk[]> {
  const chunks: Chunk[] = []
  for await (const event of events) {
    if (event.type === 'processed') chunks.push(...event.chunks)
  }
  return chunks
}
