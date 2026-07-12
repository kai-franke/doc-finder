import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import { rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const parserState = vi.hoisted(() => ({ active: 0, maxActive: 0, destroyed: 0 }));

vi.mock("pdf-parse", () => {
  class InvalidPDFException extends Error {}
  class PasswordException extends Error {}
  class PDFParse {
    private marker: string;

    constructor({ data }: { data: Uint8Array }) {
      this.marker = new TextDecoder().decode(data);
    }

    async getText(): Promise<{ pages: Array<{ num: number; text: string }> }> {
      parserState.active += 1;
      parserState.maxActive = Math.max(parserState.maxActive, parserState.active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      parserState.active -= 1;
      if (this.marker === "password") throw new PasswordException("Password required");
      if (this.marker === "corrupt") throw new InvalidPDFException("Invalid PDF");
      if (this.marker === "empty") return { pages: [{ num: 1, text: "" }] };
      return {
        pages: [
          { num: 1, text: Array.from({ length: 510 }, (_, index) => `word${index}`).join(" ") },
          { num: 2, text: "second page" },
        ],
      };
    }

    async destroy(): Promise<void> {
      parserState.destroyed += 1;
    }
  }
  return { InvalidPDFException, PasswordException, PDFParse };
});

import { processPdfFolders } from "./pdf-processing";

const temporaryRoots: string[] = [];

async function makeRoot(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "docfinder-processing-"));
  temporaryRoots.push(root);
  await Promise.all(Object.entries(files).map(([name, contents]) => fs.writeFile(path.join(root, name), contents)));
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
  parserState.active = 0;
  parserState.maxActive = 0;
  parserState.destroyed = 0;
});

describe("processPdfFolders", () => {
  it("preserves metadata and assigns global per-file chunk indexes", async () => {
    const root = await makeRoot({ "document.pdf": "valid" });
    const filePath = path.join(root, "document.pdf");
    const summary = await processPdfFolders([root]);

    expect(summary.chunks.map(({ page, chunkIndex }) => ({ page, chunkIndex }))).toEqual([
      { page: 1, chunkIndex: 0 },
      { page: 1, chunkIndex: 1 },
      { page: 2, chunkIndex: 2 },
    ]);
    expect(summary.chunks[0]).toMatchObject({ filePath, fileName: "document.pdf" });
    expect(summary.chunks[0].modifiedAt).toBe((await fs.stat(filePath)).mtimeMs);
    expect(summary).toMatchObject({ discoveredFiles: 1, processedFiles: 1, successfulFiles: 1, skippedFiles: 0 });
  });

  it("skips empty, corrupted, and password-protected PDFs without stopping", async () => {
    const root = await makeRoot({
      "valid.pdf": "valid",
      "empty.pdf": "empty",
      "corrupt.pdf": "corrupt",
      "password.pdf": "password",
    });
    const onError = vi.fn();
    const logger = { error: vi.fn(), warn: vi.fn() };
    const summary = await processPdfFolders([root], { onError, logger });

    expect(summary.successfulFiles).toBe(1);
    expect(summary.skippedFiles).toBe(3);
    expect(summary.errors.map(({ code }) => code).sort()).toEqual([
      "pdf-corrupted",
      "pdf-empty",
      "pdf-password-protected",
    ]);
    expect(onError).toHaveBeenCalledTimes(3);
    expect(parserState.destroyed).toBe(4);
  });

  it("honors the processing concurrency limit", async () => {
    const root = await makeRoot(Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => [`${index}.pdf`, "valid"]),
    ));
    await processPdfFolders([root], { concurrency: 2 });
    expect(parserState.maxActive).toBe(2);
  });

  it("reports progress through completion", async () => {
    const root = await makeRoot({ "document.pdf": "valid" });
    const phases: string[] = [];
    await processPdfFolders([root], { onProgress: ({ phase }) => phases.push(phase) });
    expect(phases[0]).toBe("discovering");
    expect(phases).toContain("processing");
    expect(phases[phases.length - 1]).toBe("complete");
  });

  it("reports a PDF that becomes unreadable and continues", async () => {
    const root = await makeRoot({ "vanished.pdf": "valid" });
    const filePath = path.join(root, "vanished.pdf");
    let removed = false;
    const summary = await processPdfFolders([root], {
      logger: { error: vi.fn(), warn: vi.fn() },
      onProgress: ({ phase }) => {
        if (phase === "processing" && !removed) {
          removed = true;
          rmSync(filePath);
        }
      },
    });

    expect(summary.chunks).toEqual([]);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0].code).toBe("file-unreadable");
  });

  it("stops cleanly when aborted", async () => {
    const root = await makeRoot({ "document.pdf": "valid" });
    const controller = new AbortController();
    controller.abort();
    await expect(processPdfFolders([root], { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
