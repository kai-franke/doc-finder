import { describe, expect, it } from "vitest";
import { chunkPages } from "./pdf-chunking";

const words = (count: number, prefix = "word"): string =>
  Array.from({ length: count }, (_, index) => `${prefix}${index}`).join(" ");

describe("chunkPages", () => {
  it("keeps chunks within their page and numbers pages", () => {
    const chunks = chunkPages([
      { page: 1, text: words(600, "a") },
      { page: 2, text: words(10, "b") },
    ]);

    expect(chunks.map(({ page }) => page)).toEqual([1, 1, 2]);
    expect(chunks[0].text.split(" ")).toHaveLength(500);
    expect(chunks[1].text.split(" ")).toHaveLength(150);
    expect(chunks[2].text.split(" ")).toHaveLength(10);
  });

  it("overlaps adjacent chunks by 50 words", () => {
    const chunks = chunkPages([{ page: 3, text: words(951) }]);
    const first = chunks[0].text.split(" ");
    const second = chunks[1].text.split(" ");
    expect(first.slice(-50)).toEqual(second.slice(0, 50));
    expect(chunks).toHaveLength(3);
  });

  it("normalizes whitespace and ignores empty pages", () => {
    expect(chunkPages([
      { page: 1, text: "  hello\n\tworld  " },
      { page: 2, text: " \n " },
    ])).toEqual([{ page: 1, text: "hello world" }]);
  });

  it("rejects configurations that cannot advance", () => {
    expect(() => chunkPages([], { chunkSize: 50, overlap: 50 })).toThrow(RangeError);
  });
});
