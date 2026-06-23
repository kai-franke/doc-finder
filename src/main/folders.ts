import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import Store from 'electron-store'
import type { SourceFolder } from '../shared/types'
import { countPdfsRecursively, deriveLabel, normalizePath } from './folder-utils'

type StoredFolder = {
  path: string
  pdfCount: number | null
}

type FolderStore = {
  folders: StoredFolder[]
}

const store = new Store<FolderStore>({
  defaults: { folders: [] },
})

// Hier merken wir uns, für welche Ordner gerade im Hintergrund gezählt wird.
// Diese Merkliste lebt nur im Arbeitsspeicher (wird nicht dauerhaft gespeichert)
// und verhindert, dass derselbe Ordner versehentlich zweimal gleichzeitig
// gezählt wird.
const counting = new Set<string>()

// --------- Store-backed operations ---------

async function isAccessible(folderPath: string): Promise<boolean> {
  try {
    await fs.access(folderPath)
    return true
  } catch {
    return false
  }
}

/**
 * Builds the SourceFolder list from the store. The PDF count is read from the
 * store (computed once on add), so this only refreshes the cheap `accessible`
 * flag instead of re-scanning every folder on disk.
 */
async function listFolders(): Promise<SourceFolder[]> {
  const folders = store.get('folders')
  return Promise.all(
    folders.map(async ({ path: folderPath, pdfCount }) => ({
      path: folderPath,
      label: deriveLabel(folderPath),
      pdfCount,
      accessible: await isAccessible(folderPath),
    })),
  )
}

/** Schickt die aktuelle Ordnerliste an alle geöffneten Fenster. */
async function broadcastFolders(): Promise<void> {
  const list = await listFolders()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('folders:changed', list)
    }
  }
}

/**
 * Zählt die PDFs eines Ordners im Hintergrund, ohne dass der Rest der App darauf
 * warten muss. Sobald die Zählung fertig ist, wird das Ergebnis gespeichert und
 * die aktualisierte Liste an die Oberfläche geschickt. Ordner, für die bereits
 * gezählt wird, werden übersprungen.
 */
async function countInBackground(folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath)
  if (counting.has(normalized)) return
  counting.add(normalized)
  try {
    const pdfCount = await countPdfsRecursively(folderPath)
    // Liste neu einlesen: Der Ordner könnte während des Zählens entfernt worden
    // sein – dann findet die Aktualisierung ihn nicht mehr und es passiert nichts.
    const folders = store.get('folders')
    store.set(
      'folders',
      folders.map((f) => (normalizePath(f.path) === normalized ? { ...f, pdfCount } : f)),
    )
  } catch {
    // countPdfsRecursively fängt eigene Fehler bereits selbst ab. Dieses catch
    // ist nur zur Sicherheit da, damit eine spätere Änderung an der Zählung nicht
    // unbemerkt zu einem abstürzenden Hintergrund-Vorgang führen kann.
  } finally {
    counting.delete(normalized)
    await broadcastFolders()
  }
}

async function addFolder(folderPath: string): Promise<SourceFolder[]> {
  const folders = store.get('folders')
  const normalized = normalizePath(folderPath)
  const isDuplicate = folders.some((f) => normalizePath(f.path) === normalized)
  if (!isDuplicate) {
    // Den Ordner sofort mit pdfCount: null speichern, damit er ohne Verzögerung
    // (mit Lade-Anzeige) in der Liste erscheint. Das eigentliche Zählen läuft
    // danach im Hintergrund.
    store.set('folders', [...folders, { path: folderPath, pdfCount: null }])
    void countInBackground(folderPath)
  }
  return listFolders()
}

/** Zählt Ordner erneut, deren Zählung nie fertig wurde (z. B. weil die App vorher beendet wurde). */
export function recountPendingFolders(): void {
  for (const folder of store.get('folders')) {
    if (folder.pdfCount === null) {
      void countInBackground(folder.path)
    }
  }
}

async function removeFolder(folderPath: string): Promise<SourceFolder[]> {
  const folders = store.get('folders')
  store.set(
    'folders',
    folders.filter((f) => f.path !== folderPath),
  )
  return listFolders()
}

// --------- IPC registration ---------

export function registerFolderHandlers(): void {
  ipcMain.handle('folders:add', async (event): Promise<SourceFolder[]> => {
    // Attach the dialog to the window that made the request (sheet on macOS).
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return listFolders()
    }
    return addFolder(result.filePaths[0])
  })

  ipcMain.handle('folders:list', (): Promise<SourceFolder[]> => listFolders())

  ipcMain.handle(
    'folders:remove',
    (_event, { folderPath }: { folderPath: string }): Promise<SourceFolder[]> =>
      removeFolder(folderPath),
  )
}
