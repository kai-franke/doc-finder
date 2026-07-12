import { promises as fs } from "node:fs";
import path from "node:path";

export type PdfDiscoveryError = {
  path: string;
  message: string;
};

export type PdfDiscoveryOptions = {
  signal?: AbortSignal;
  onDirectoryScanned?: (pdfsFound: number) => void;
  onError?: (error: PdfDiscoveryError) => void;
};

// Pure, electron-free folder helpers. Kept separate from folders.ts so they can be
// unit-tested in a plain Node environment without loading electron / electron-store.

/** Folder label = last path segment, e.g. "/Users/me/Invoices" -> "Invoices". */
export function deriveLabel(folderPath: string): string {
  return path.basename(folderPath) || folderPath;
}

/**
 * Normalized form used only for duplicate detection. macOS is case-insensitive,
 * so we lower-case the resolved path. The original path is what gets stored.
 */
export function normalizePath(folderPath: string): string {
  return path.resolve(folderPath).toLowerCase();
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("PDF discovery was aborted", "AbortError");
  }
}

/**
 * Removes duplicate and nested roots. If both `/Docs` and `/Docs/PDFs` are
 * registered, traversing `/Docs` already covers the latter. This prevents
 * duplicate work without retaining every discovered file path in memory.
 */
export function minimizeRootPaths(rootPaths: string[]): string[] {
  const unique = new Map<string, string>();
  for (const root of rootPaths) {
    unique.set(normalizePath(root), path.resolve(root));
  }

  return [...unique.entries()]
    .sort(([a], [b]) => a.length - b.length)
    .filter(([candidate], index, entries) =>
      !entries.slice(0, index).some(([parent]) => {
        const relative = path.relative(parent, candidate);
        return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
      }),
    )
    .map(([, original]) => original);
}

/**
 * Discovers PDFs lazily and iteratively. Directories are read one at a time to
 * keep filesystem pressure predictable even when a user selects a disk root.
 * Symbolic links are deliberately not followed, avoiding cycles and scans that
 * unexpectedly leave the selected tree.
 */
export async function* discoverPdfsRecursively(
  rootPaths: string[],
  options: PdfDiscoveryOptions = {},
): AsyncGenerator<string> {
  const directories = minimizeRootPaths(rootPaths).reverse();
  let pdfsFound = 0;

  while (directories.length > 0) {
    throwIfAborted(options.signal);
    const current = directories.pop();
    if (!current) continue;

    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch (error) {
      options.onError?.({
        path: current,
        message: error instanceof Error ? error.message : "Directory could not be read",
      });
      continue;
    }

    for (const entry of entries) {
      throwIfAborted(options.signal);
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        directories.push(entryPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        pdfsFound += 1;
        yield entryPath;
      }
    }
    options.onDirectoryScanned?.(pdfsFound);
  }
}

/**
 * Zählt alle PDF-Dateien in einem Ordner und in allen darin enthaltenen
 * Unterordnern. Ordner, die sich nicht öffnen lassen, werden einfach als 0
 * gezählt (statt einen Fehler auszulösen) – ein einzelner gesperrter Ordner
 * bringt also nie die gesamte Zählung zum Absturz.
 *
 * Wir gehen die Ordner Ebene für Ebene durch und lesen dabei immer nur eine
 * begrenzte Anzahl gleichzeitig (`concurrency`). Würden wir stattdessen alle
 * Ordner auf einmal anstoßen, würde das die App komplett mit Lese-Aufträgen
 * verstopfen: Der Rechner kann nur einige wenige Datei-Zugriffe gleichzeitig
 * abarbeiten, alles Weitere landet in einer langen Warteschlange. Andere
 * Aufgaben – etwa die Prüfung, ob ein gerade hinzugefügter Ordner noch existiert
 * – müssten dann warten, bis die komplette Zählung fertig ist, und die
 * Oberfläche würde so lange hängen. Indem wir die Warteschlange kurz halten,
 * kommen andere Aufgaben zwischendurch dran und die App bleibt bedienbar,
 * während im Hintergrund ein großer Ordner gezählt wird.
 */
export async function countPdfsRecursively(
  dir: string,
  concurrency = 8,
): Promise<number> {
  let count = 0;
  const queue = [dir];

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const subdirLists = await Promise.all(
      batch.map(async (current) => {
        let entries;
        try {
          entries = await fs.readdir(current, { withFileTypes: true });
        } catch {
          return [];
        }
        const subdirs: string[] = [];
        for (const entry of entries) {
          if (entry.isDirectory()) {
            subdirs.push(path.join(current, entry.name));
          } else if (
            entry.isFile() &&
            entry.name.toLowerCase().endsWith(".pdf")
          ) {
            count += 1;
          }
        }
        return subdirs;
      }),
    );
    for (const subdirs of subdirLists) {
      queue.push(...subdirs);
    }
  }

  return count;
}
