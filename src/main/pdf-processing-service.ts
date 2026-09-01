import { getRegisteredFolderPaths } from './folders'
import {
  processRegisteredPdfs,
  type PdfProcessingEvent,
  type PdfProcessingOptions,
} from './pdf-processing'

/**
 * Main-process entry point that connects the pure PDF pipeline to electron-store.
 * Keeping this tiny adapter separate lets the pipeline tests run without loading
 * Electron and makes the stored folder list visibly the source of truth.
 */
export function processAllRegisteredPdfs(
  options: PdfProcessingOptions = {},
): AsyncGenerator<PdfProcessingEvent> {
  return processRegisteredPdfs(getRegisteredFolderPaths(), options)
}
