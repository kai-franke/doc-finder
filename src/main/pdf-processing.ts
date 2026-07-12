import { promises as fs } from "node:fs";
import path from "node:path";
import {
  InvalidPDFException,
  PasswordException,
  PDFParse,
  type PageTextResult,
} from "pdf-parse";
import type { Chunk } from "../shared/types";
import { discoverPdfsRecursively } from "./folder-utils";
import { chunkPages } from "./pdf-chunking";

export type PdfProcessingErrorCode =
  | "directory-unreadable"
  | "file-unreadable"
  | "pdf-corrupted"
  | "pdf-password-protected"
  | "pdf-empty"
  | "unknown";

export type PdfProcessingError = {
  filePath: string;
  code: PdfProcessingErrorCode;
  message: string;
};

export type ProcessingProgress = {
  phase: "discovering" | "processing" | "complete";
  discoveredFiles: number;
  processedFiles: number;
  successfulFiles: number;
  skippedFiles: number;
  currentFile?: string;
};

export type ProcessingLogger = {
  error(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
};

export type ProcessPdfFoldersOptions = {
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: ProcessingProgress) => void;
  onError?: (error: PdfProcessingError) => void;
  logger?: ProcessingLogger;
};

export type ProcessingSummary = {
  chunks: Chunk[];
  errors: PdfProcessingError[];
  discoveredFiles: number;
  processedFiles: number;
  successfulFiles: number;
  skippedFiles: number;
};

const consoleLogger: ProcessingLogger = {
  error: (message, context) => console.error(message, context),
  warn: (message, context) => console.warn(message, context),
};

function classifyError(filePath: string, error: unknown): PdfProcessingError {
  if (error instanceof PasswordException) {
    return { filePath, code: "pdf-password-protected", message: "This PDF is password-protected and was skipped." };
  }
  if (error instanceof InvalidPDFException) {
    return { filePath, code: "pdf-corrupted", message: "This PDF is damaged or invalid and was skipped." };
  }
  const nodeError = error as NodeJS.ErrnoException;
  if (["EACCES", "EPERM", "ENOENT", "EISDIR"].includes(nodeError?.code ?? "")) {
    return { filePath, code: "file-unreadable", message: "This PDF could not be read and was skipped." };
  }
  return { filePath, code: "unknown", message: "This PDF could not be processed and was skipped." };
}

function validateConcurrency(concurrency: number): void {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
    throw new RangeError("concurrency must be an integer between 1 and 8");
  }
}

async function extractPdf(filePath: string, signal?: AbortSignal): Promise<Chunk[]> {
  signal?.throwIfAborted();
  const [data, stats] = await Promise.all([fs.readFile(filePath), fs.stat(filePath)]);
  signal?.throwIfAborted();
  const parser = new PDFParse({ data: new Uint8Array(data), stopAtErrors: true });
  try {
    const result = await parser.getText();
    signal?.throwIfAborted();
    const pages = result.pages.map((page: PageTextResult) => ({
      page: page.num,
      text: page.text,
    }));
    return chunkPages(pages).map((chunk, chunkIndex) => ({
      text: chunk.text,
      filePath,
      fileName: path.basename(filePath),
      modifiedAt: stats.mtimeMs,
      chunkIndex,
      page: chunk.page,
    }));
  } finally {
    await parser.destroy();
  }
}

export async function processPdfFolders(
  folderPaths: string[],
  options: ProcessPdfFoldersOptions = {},
): Promise<ProcessingSummary> {
  const concurrency = options.concurrency ?? 2;
  validateConcurrency(concurrency);
  const logger = options.logger ?? consoleLogger;
  const chunks: Chunk[] = [];
  const errors: PdfProcessingError[] = [];
  const active = new Set<Promise<void>>();
  const progress: ProcessingProgress = {
    phase: "discovering",
    discoveredFiles: 0,
    processedFiles: 0,
    successfulFiles: 0,
    skippedFiles: 0,
  };

  const reportProgress = (update: Partial<ProcessingProgress> = {}): void => {
    Object.assign(progress, update);
    options.onProgress?.({ ...progress });
  };
  const reportError = (processingError: PdfProcessingError, technicalError?: unknown): void => {
    errors.push(processingError);
    options.onError?.(processingError);
    const context = { filePath: processingError.filePath, code: processingError.code, error: technicalError };
    if (processingError.code === "pdf-empty") logger.warn(processingError.message, context);
    else logger.error(processingError.message, context);
  };

  reportProgress();
  const discovery = discoverPdfsRecursively(folderPaths, {
    signal: options.signal,
    onDirectoryScanned: (pdfsFound) => reportProgress({ discoveredFiles: pdfsFound }),
    onError: (error) => reportError({
      filePath: error.path,
      code: "directory-unreadable",
      message: "A folder could not be read and was skipped.",
    }, error.message),
  });

  try {
    for await (const filePath of discovery) {
      progress.discoveredFiles += 1;
      reportProgress({ phase: "processing", currentFile: filePath });
      const task = (async (): Promise<void> => {
        try {
          const fileChunks = await extractPdf(filePath, options.signal);
          if (fileChunks.length === 0) {
            progress.skippedFiles += 1;
            reportError({ filePath, code: "pdf-empty", message: "This PDF contains no extractable text and was skipped." });
          } else {
            chunks.push(...fileChunks);
            progress.successfulFiles += 1;
          }
        } catch (error) {
          if (options.signal?.aborted) throw error;
          progress.skippedFiles += 1;
          reportError(classifyError(filePath, error), error);
        } finally {
          progress.processedFiles += 1;
          reportProgress({ currentFile: filePath });
        }
      })();
      active.add(task);
      void task.then(() => active.delete(task), () => active.delete(task));
      if (active.size >= concurrency) await Promise.race(active);
    }
  } finally {
    await Promise.allSettled(active);
  }

  reportProgress({ phase: "complete", currentFile: undefined });
  return {
    chunks,
    errors,
    discoveredFiles: progress.discoveredFiles,
    processedFiles: progress.processedFiles,
    successfulFiles: progress.successfulFiles,
    skippedFiles: progress.skippedFiles,
  };
}
