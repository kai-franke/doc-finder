import { PDFParse } from 'pdf-parse'
import type { ExtractedPage } from './pdf-chunking'

export type ExtractedPdf = {
  pages: ExtractedPage[]
}

export type PdfBufferParser = (buffer: Buffer) => Promise<ExtractedPdf>

/**
 * Parser adapter used by the processing pipeline.
 *
 * Keeping the third-party library behind this small function makes it possible
 * to test the rest of the application with simple fakes and to upgrade the
 * parser later without changing discovery, chunking, or indexing code.
 */
export const parsePdfBuffer: PdfBufferParser = async (buffer) => {
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()
    return {
      pages: result.pages.map(({ num, text }): ExtractedPage => ({ page: num, text })),
    }
  } finally {
    // pdf-parse owns worker/document resources. Releasing them for every file is
    // especially important because the pipeline processes many PDFs over time.
    await parser.destroy()
  }
}
