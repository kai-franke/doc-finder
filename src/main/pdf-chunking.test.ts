import { describe, expect, it } from 'vitest'
import { createTextChunks, type ExtractedPage } from './pdf-chunking'

function pageWithWords(count: number, page = 1, offset = 0): ExtractedPage {
  return {
    page,
    text: Array.from({ length: count }, (_, index) => `word-${offset + index}`).join(' '),
  }
}

function chunkWords(text: string): string[] {
  return text.split(' ')
}

describe('createTextChunks', () => {
  it('creates approximately 500 word chunks with a 50 word overlap', () => {
    const chunks = createTextChunks([pageWithWords(1_000)])

    expect(chunks).toHaveLength(3)
    expect(chunkWords(chunks[0].text)).toHaveLength(500)
    expect(chunkWords(chunks[1].text)).toHaveLength(500)
    expect(chunkWords(chunks[2].text)).toHaveLength(100)
    expect(chunkWords(chunks[0].text).slice(-50)).toEqual(chunkWords(chunks[1].text).slice(0, 50))
  })

  it('keeps a final chunk containing exactly 100 words', () => {
    const chunks = createTextChunks([pageWithWords(550)])

    expect(chunks).toHaveLength(2)
    expect(chunkWords(chunks[1].text)).toHaveLength(100)
  })

  it('extends the previous chunk when the final chunk has only 99 words', () => {
    const chunks = createTextChunks([pageWithWords(999)])

    expect(chunks).toHaveLength(2)
    expect(chunkWords(chunks[0].text)).toHaveLength(500)
    expect(chunkWords(chunks[1].text)).toHaveLength(549)
    const lastWords = chunkWords(chunks[1].text)
    expect(lastWords[lastWords.length - 1]).toBe('word-998')
  })

  it('does not duplicate overlap words when extending the previous chunk', () => {
    const chunks = createTextChunks([pageWithWords(960)])
    const lastWords = chunkWords(chunks[1].text)

    expect(lastWords).toHaveLength(510)
    expect(new Set(lastWords).size).toBe(lastWords.length)
    expect(lastWords[0]).toBe('word-450')
    expect(lastWords[lastWords.length - 1]).toBe('word-959')
  })

  it('keeps a short document as its one useful chunk', () => {
    const chunks = createTextChunks([pageWithWords(99)])

    expect(chunks).toHaveLength(1)
    expect(chunkWords(chunks[0].text)).toHaveLength(99)
  })

  it('returns no chunks for pages without extractable text', () => {
    expect(createTextChunks([{ page: 1, text: '  \n\t ' }])).toEqual([])
  })

  it('records the page on which a chunk starts', () => {
    const chunks = createTextChunks([
      pageWithWords(450, 1),
      pageWithWords(150, 2, 450),
    ])

    expect(chunks.map((chunk) => chunk.page)).toEqual([1, 2])
  })

  it('rejects options that could create an endless loop', () => {
    expect(() => createTextChunks([pageWithWords(10)], { chunkSize: 50, overlap: 50 })).toThrow(
      RangeError,
    )
  })
})
