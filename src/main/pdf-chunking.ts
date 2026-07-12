export type TextChunk = {
  text: string;
  page: number;
};

export type ChunkingOptions = {
  chunkSize?: number;
  overlap?: number;
};

/** Splits one page at a time so a chunk can never cross a page boundary. */
export function chunkPages(
  pages: ReadonlyArray<{ page: number; text: string }>,
  options: ChunkingOptions = {},
): TextChunk[] {
  const chunkSize = options.chunkSize ?? 500;
  const overlap = options.overlap ?? 50;
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new RangeError("chunkSize must be a positive integer");
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) {
    throw new RangeError("overlap must be an integer between 0 and chunkSize - 1");
  }

  const chunks: TextChunk[] = [];
  const step = chunkSize - overlap;

  for (const page of pages) {
    const words = page.text.trim().split(/\s+/u).filter(Boolean);
    for (let start = 0; start < words.length; start += step) {
      const wordsInChunk = words.slice(start, start + chunkSize);
      if (wordsInChunk.length === 0) break;
      chunks.push({ text: wordsInChunk.join(" "), page: page.page });
      if (start + chunkSize >= words.length) break;
    }
  }

  return chunks;
}
