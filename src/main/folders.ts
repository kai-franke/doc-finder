import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'node:fs'
import Store from 'electron-store'
import type { SourceFolder } from '../shared/types'
import { countPdfsRecursively, deriveLabel, normalizePath } from './folder-utils'

type FolderStore = {
  folderPaths: string[]
}

const store = new Store<FolderStore>({
  defaults: { folderPaths: [] },
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

/** Builds the full SourceFolder list from stored paths, computing fresh metadata in parallel. */
async function listFolders(): Promise<SourceFolder[]> {
  const folderPaths = store.get('folderPaths')
  return Promise.all(
    folderPaths.map(async (folderPath) => {
      const accessible = await isAccessible(folderPath)
      return {
        path: folderPath,
        label: deriveLabel(folderPath),
        pdfCount: accessible ? await countPdfsRecursively(folderPath) : 0,
        accessible,
      }
    }),
  )
}

async function addFolder(folderPath: string): Promise<SourceFolder[]> {
  const folderPaths = store.get('folderPaths')
  const normalized = normalizePath(folderPath)
  const isDuplicate = folderPaths.some((p) => normalizePath(p) === normalized)
  if (!isDuplicate) {
    store.set('folderPaths', [...folderPaths, folderPath])
  }
  return listFolders()
}

async function removeFolder(folderPath: string): Promise<SourceFolder[]> {
  const folderPaths = store.get('folderPaths')
  store.set(
    'folderPaths',
    folderPaths.filter((p) => p !== folderPath),
  )
  return listFolders()
}

// --------- IPC registration ---------

export function registerFolderHandlers(win: BrowserWindow): void {
  ipcMain.handle('folders:add', async (): Promise<SourceFolder[]> => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
    })
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
