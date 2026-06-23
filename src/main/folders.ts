import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import Store from 'electron-store'
import type { SourceFolder } from '../shared/types'
import { countPdfsRecursively, deriveLabel, normalizePath } from './folder-utils'

type StoredFolder = {
  path: string
  pdfCount: number
}

type FolderStore = {
  folders: StoredFolder[]
}

const store = new Store<FolderStore>({
  defaults: { folders: [] },
})

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

async function addFolder(folderPath: string): Promise<SourceFolder[]> {
  const folders = store.get('folders')
  const normalized = normalizePath(folderPath)
  const isDuplicate = folders.some((f) => normalizePath(f.path) === normalized)
  if (!isDuplicate) {
    const pdfCount = await countPdfsRecursively(folderPath)
    store.set('folders', [...folders, { path: folderPath, pdfCount }])
  }
  return listFolders()
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
