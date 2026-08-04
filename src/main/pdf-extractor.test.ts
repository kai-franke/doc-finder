import { describe, expect, it } from 'vitest'
import { parsePdfBuffer } from './pdf-extractor'

describe('parsePdfBuffer', () => {
  it('reports corrupt PDF data as a rejected parse', async () => {
    await expect(parsePdfBuffer(Buffer.from('not a PDF'))).rejects.toBeDefined()
  })
})
