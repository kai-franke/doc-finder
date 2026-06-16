import { promises as fs } from 'node:fs'
import path from 'node:path'

// Pure, electron-free folder helpers. Kept separate from folders.ts so they can be
// unit-tested in a plain Node environment without loading electron / electron-store.

/** Folder label = last path segment, e.g. "/Users/me/Invoices" -> "Invoices". */
export function deriveLabel(folderPath: string): string {
  return path.basename(folderPath) || folderPath
}

/**
 * Normalized form used only for duplicate detection. macOS is case-insensitive,
 * so we lower-case the resolved path. The original path is what gets stored.
 */
export function normalizePath(folderPath: string): string {
  return path.resolve(folderPath).toLowerCase()
}

/**
 * Recursively counts PDF files in a directory and all of its subfolders.
 * Inaccessible subtrees are skipped (counted as 0) instead of throwing,
 * so a single unreadable folder never breaks the whole count.
 */
export async function countPdfsRecursively(dir: string): Promise<number> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }

  const counts = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        return countPdfsRecursively(fullPath)
      }
      return entry.isFile() && entry.name.toLowerCase().endsWith('.pdf') ? 1 : 0
    }),
  )

  return counts.reduce((sum, n) => sum + n, 0)
}
