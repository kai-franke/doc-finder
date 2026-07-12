import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { processPdfFolders } from './pdf-processing'

function createPdf(pageTexts: string[]): Buffer {
  const objects: string[] = []
  const pageObjectNumbers = pageTexts.map((_, index) => 4 + index * 2)
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push(`<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`)
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  for (let index = 0; index < pageTexts.length; index += 1) {
    const pageNumber = 4 + index * 2
    const contentNumber = pageNumber + 1
    const escapedText = pageTexts[index].replace(/([\\()])/g, '\\$1')
    const stream = `BT /F1 12 Tf 72 720 Td (${escapedText}) Tj ET`
    objects.push(`<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 3 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentNumber} 0 R >>`)
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
  }

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf)
}

describe('pdf-parse integration', () => {
  let root: string

  beforeAll(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-real-pdf-'))
    await fs.writeFile(path.join(root, 'two-pages.pdf'), createPdf([
      'Text from the first page',
      'Text from the second page',
    ]))
  })

  afterAll(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('extracts real PDF text page by page', async () => {
    const result = await processPdfFolders([root], { logger: { error: () => undefined, warn: () => undefined } })
    expect(result.errors).toEqual([])
    expect(result.chunks.map(({ page, text }) => ({ page, text }))).toEqual([
      { page: 1, text: 'Text from the first page' },
      { page: 2, text: 'Text from the second page' },
    ])
  })
})
