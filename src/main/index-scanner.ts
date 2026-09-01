import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ScanResult } from '../shared/types'
import { normalizePath } from './folder-utils'
import { canonicalizePath, deriveEffectiveScanRoots, discoverPdfFiles } from './pdf-discovery'
import type { IndexManifest, IndexedFile } from './index-manifest'

export type FileInventory = {
  files: Map<string, number>
  folderCounts: Map<string, number>
  errors: Array<{ filePath: string; message: string }>
}

function isInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath)
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  )
}

export async function scanPdfInventory(folderPaths: readonly string[]): Promise<FileInventory> {
  const errors: FileInventory['errors'] = []
  const canonicalFolders = new Map<string, string>()
  for (const folderPath of folderPaths) {
    canonicalFolders.set(normalizePath(folderPath), await canonicalizePath(folderPath))
  }
  const roots = await deriveEffectiveScanRoots(folderPaths)
  const pdfPaths = await discoverPdfFiles(roots, {
    onError: (error) => errors.push({ filePath: error.path, message: error.message }),
  })
  const files = new Map<string, number>()
  const concurrency = 16
  for (let start = 0; start < pdfPaths.length; start += concurrency) {
    await Promise.all(
      pdfPaths.slice(start, start + concurrency).map(async (filePath) => {
        try {
          files.set(filePath, (await fs.stat(filePath)).mtimeMs)
        } catch (error) {
          errors.push({
            filePath,
            message: error instanceof Error ? error.message : String(error),
          })
        }
      }),
    )
  }

  const folderCounts = new Map<string, number>()
  for (const [normalized, canonical] of canonicalFolders) {
    folderCounts.set(
      normalized,
      [...files.keys()].filter((filePath) => isInside(canonical, filePath)).length,
    )
  }
  return { files, folderCounts, errors }
}

export function buildScanResult(
  inventory: ReadonlyMap<string, number>,
  indexedFiles: Readonly<Record<string, IndexedFile>>,
): ScanResult {
  const newFiles: string[] = []
  const changedFiles: string[] = []
  for (const [filePath, modifiedAt] of inventory) {
    const indexed = indexedFiles[filePath]
    if (!indexed) newFiles.push(filePath)
    else if (indexed.modifiedAt !== modifiedAt) changedFiles.push(filePath)
  }
  const deletedFiles = Object.keys(indexedFiles).filter((filePath) => !inventory.has(filePath))
  return {
    newFiles: newFiles.sort(),
    changedFiles: changedFiles.sort(),
    deletedFiles: deletedFiles.sort(),
  }
}

export function scanResultFromManifest(
  inventory: ReadonlyMap<string, number>,
  manifest: IndexManifest,
): ScanResult {
  return buildScanResult(inventory, manifest.files)
}
