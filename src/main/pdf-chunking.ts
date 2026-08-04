export type ExtractedPage = {
  page: number
  text: string
}

export type TextChunk = {
  text: string
  page?: number
}

export type ChunkingOptions = {
  chunkSize?: number
  overlap?: number
  minLastChunkSize?: number
}

type Word = {
  text: string
  page?: number
}

type WordWindow = {
  start: number
  end: number
}

function wordsFromText(text: string, page?: number): Word[] {
  const normalized = text.trim()
  if (!normalized) return []
  return normalized.split(/\s+/u).map((word) => ({ text: word, page }))
}

function validateOptions(chunkSize: number, overlap: number, minLastChunkSize: number): void {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError('chunkSize must be a positive integer')
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) {
    throw new RangeError('overlap must be an integer between 0 and chunkSize - 1')
  }
  if (!Number.isInteger(minLastChunkSize) || minLastChunkSize < 1) {
    throw new RangeError('minLastChunkSize must be a positive integer')
  }
}

/**
 * Splits extracted PDF text into overlapping word windows.
 *
 * If the final window would contain fewer than `minLastChunkSize` words, the
 * preceding window is extended to the document end. We rebuild that preceding
 * slice instead of appending the small window: its first words already belong
 * to the configured overlap and would otherwise occur twice inside one chunk.
 */
export function createTextChunks(
  pages: readonly ExtractedPage[],
  options: ChunkingOptions = {},
): TextChunk[] {
  const chunkSize = options.chunkSize ?? 500
  const overlap = options.overlap ?? 50
  const minLastChunkSize = options.minLastChunkSize ?? 100
  validateOptions(chunkSize, overlap, minLastChunkSize)

  const words = pages.flatMap(({ page, text }) => wordsFromText(text, page))
  if (words.length === 0) return []

  const step = chunkSize - overlap
  const windows: WordWindow[] = []

  for (let start = 0; start < words.length; start += step) {
    const remainingWords = words.length - start

    if (windows.length > 0 && remainingWords < minLastChunkSize) {
      // Extend the previous window in place. Its start stays unchanged, so the
      // overlap with the chunk before it also stays exactly as designed.
      windows[windows.length - 1].end = words.length
      break
    }

    windows.push({ start, end: Math.min(start + chunkSize, words.length) })
    if (start + chunkSize >= words.length) break
  }

  return windows.map(({ start, end }) => {
    const windowWords = words.slice(start, end)
    const firstPage = windowWords[0]?.page
    return {
      text: windowWords.map((word) => word.text).join(' '),
      ...(firstPage === undefined ? {} : { page: firstPage }),
    }
  })
}
