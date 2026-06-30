import { promises as fs } from "node:fs";
import path from "node:path";

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
