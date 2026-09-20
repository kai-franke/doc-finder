import { describe, expect, it } from 'vitest'
import { parsePdfBuffer } from './pdf-extractor'

function createTextPdf(text: string): Buffer {
  const escapedText = text.replace(/([\\()])/g, '\\$1')
  const stream = `BT /F1 12 Tf 72 720 Td (${escapedText}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]

  let body = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body))
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n`
  body += '0000000000 65535 f \n'
  body += offsets
    .slice(1)
    .map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`)
    .join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  body += `startxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(body)
}

describe('parsePdfBuffer', () => {
  it('extracts text and page metadata from a valid PDF', async () => {
    const result = await parsePdfBuffer(createTextPdf('DocFinder worker regression'))

    expect(result.pages).toEqual([
      expect.objectContaining({ page: 1, text: expect.stringContaining('DocFinder worker regression') }),
    ])
  })

  it('reports corrupt PDF data as a rejected parse', async () => {
    await expect(parsePdfBuffer(Buffer.from('not a PDF'))).rejects.toBeDefined()
  })
})
