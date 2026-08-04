import { promises as fs } from 'node:fs'
import path from 'node:path'

export type PdfDiscoveryError = {
  path: string
  message: string
}

type DiscoveryOptions = {
  /** Limits simultaneous directory reads so large trees do not flood the file system. */
  concurrency?: number
  onError?: (error: PdfDiscoveryError) => void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function assertConcurrency(concurrency: number): void {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('concurrency must be a positive integer')
  }
}

/**
 * Returns a stable absolute identity for a path.
 *
 * `realpath` resolves symbolic links and the actual spelling on disk. A path may
 * temporarily be inaccessible, though, so falling back to `resolve` lets change
 * detection still reason about it instead of failing the complete scan.
 */
export async function canonicalizePath(inputPath: string): Promise<string> {
  const resolved = path.resolve(inputPath)
  try {
    return await fs.realpath(resolved)
  } catch {
    return resolved
  }
}

/** True only for a real descendant, not for similarly prefixed sibling names. */
function isInside(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(parentPath, candidatePath)
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

/**
 * Derives the roots needed for one scan without modifying the registered list.
 * A child covered by another registered root is omitted only from this result.
 */
export async function deriveEffectiveScanRoots(
  registeredFolderPaths: readonly string[],
): Promise<string[]> {
  const canonicalRoots: string[] = []

  // Folder lists are small. Doing this step sequentially keeps the code easy to
  // follow and avoids creating an unbounded group of file-system operations.
  for (const folderPath of registeredFolderPaths) {
    const canonical = await canonicalizePath(folderPath)
    if (!canonicalRoots.includes(canonical)) canonicalRoots.push(canonical)
  }

  return canonicalRoots
    .filter(
      (candidate) =>
        !canonicalRoots.some(
          (possibleParent) => possibleParent !== candidate && isInside(possibleParent, candidate),
        ),
    )
    .sort((left, right) => left.localeCompare(right))
}

/**
 * Finds PDFs recursively and returns each physical file at most once.
 *
 * Symbolic links are followed deliberately. Real directory paths are remembered
 * so a symlink loop cannot make traversal run forever.
 */
export async function discoverPdfFiles(
  scanRoots: readonly string[],
  options: DiscoveryOptions = {},
): Promise<string[]> {
  const concurrency = options.concurrency ?? 8
  assertConcurrency(concurrency)

  const directoryQueue = [...scanRoots]
  const visitedDirectories = new Set<string>()
  const pdfPaths = new Set<string>()

  while (directoryQueue.length > 0) {
    const batch: string[] = []

    // Canonicalizing before adding a directory to the batch also prevents two
    // aliases of the same folder from being read concurrently.
    while (directoryQueue.length > 0 && batch.length < concurrency) {
      const queuedPath = directoryQueue.shift()
      if (!queuedPath) continue
      const canonicalDirectory = await canonicalizePath(queuedPath)
      if (visitedDirectories.has(canonicalDirectory)) continue
      visitedDirectories.add(canonicalDirectory)
      batch.push(canonicalDirectory)
    }

    const discoveredEntries = await Promise.all(
      batch.map(async (directory) => {
        try {
          const entries = await fs.readdir(directory, { withFileTypes: true })
          return { directory, entries }
        } catch (error) {
          options.onError?.({ path: directory, message: errorMessage(error) })
          return { directory, entries: [] }
        }
      }),
    )

    for (const { directory, entries } of discoveredEntries) {
      for (const entry of entries) {
        const entryPath = path.join(directory, entry.name)

        if (entry.isDirectory()) {
          directoryQueue.push(entryPath)
          continue
        }

        if (entry.isFile()) {
          if (entry.name.toLowerCase().endsWith('.pdf')) {
            pdfPaths.add(await canonicalizePath(entryPath))
          }
          continue
        }

        if (!entry.isSymbolicLink()) continue

        // `stat` follows the link. Broken links are reported but do not stop the
        // remainder of the scan.
        try {
          const target = await fs.stat(entryPath)
          if (target.isDirectory()) {
            directoryQueue.push(entryPath)
          } else if (target.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
            pdfPaths.add(await canonicalizePath(entryPath))
          }
        } catch (error) {
          options.onError?.({ path: entryPath, message: errorMessage(error) })
        }
      }
    }
  }

  return [...pdfPaths].sort((left, right) => left.localeCompare(right))
}
