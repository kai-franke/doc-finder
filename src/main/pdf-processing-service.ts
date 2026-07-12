import { getRegisteredFolderPaths } from './folders'
import {
  processPdfFolders,
  type ProcessPdfFoldersOptions,
  type ProcessingSummary,
} from './pdf-processing'

/**
 * Main-process entry point for Story 04. Keeping IPC out of this layer lets the
 * later indexing story decide how progress and errors are presented.
 */
export function processRegisteredPdfs(
  options: ProcessPdfFoldersOptions = {},
): Promise<ProcessingSummary> {
  return processPdfFolders(getRegisteredFolderPaths(), options)
}
