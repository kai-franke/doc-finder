import { ipcRenderer, contextBridge, type IpcRendererEvent } from 'electron'
import type {
  IndexStatus,
  IndexingError,
  IndexingProgress,
  IndexingResult,
  ScanResult,
  SourceFolder,
} from '../shared/types'

function subscribe<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, value: T): void => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// Scoped, typed API bridge. The renderer can only trigger these exact actions —
// no arbitrary IPC channels are exposed.
const api = {
  folders: {
    add: (): Promise<SourceFolder[]> => ipcRenderer.invoke('folders:add'),
    list: (): Promise<SourceFolder[]> => ipcRenderer.invoke('folders:list'),
    remove: (folderPath: string): Promise<SourceFolder[]> =>
      ipcRenderer.invoke('folders:remove', { folderPath }),
    // Auf Aktualisierungen der Ordnerliste horchen, die der Hauptprozess von
    // sich aus schickt (z. B. wenn eine Zählung im Hintergrund fertig ist). Gibt
    // eine Funktion zurück, mit der man das Horchen wieder beenden kann.
    onChanged: (callback: (folders: SourceFolder[]) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, folders: SourceFolder[]): void =>
        callback(folders)
      ipcRenderer.on('folders:changed', listener)
      return () => ipcRenderer.removeListener('folders:changed', listener)
    },
  },
  index: {
    getStatus: (): Promise<IndexStatus> => ipcRenderer.invoke('index:status'),
    scan: (): Promise<ScanResult> => ipcRenderer.invoke('index:scan'),
    start: (): Promise<IndexingResult> => ipcRenderer.invoke('indexing:start'),
    abort: (): Promise<void> => ipcRenderer.invoke('indexing:abort'),
    onStatus: (callback: (status: IndexStatus) => void): (() => void) =>
      subscribe('index:statusChanged', callback),
    onScanResult: (callback: (result: ScanResult) => void): (() => void) =>
      subscribe('index:scanResult', callback),
    onProgress: (callback: (progress: IndexingProgress) => void): (() => void) =>
      subscribe('indexing:progress', callback),
    onComplete: (callback: (result: IndexingResult) => void): (() => void) =>
      subscribe('indexing:complete', callback),
    onError: (callback: (error: IndexingError) => void): (() => void) =>
      subscribe('indexing:error', callback),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
