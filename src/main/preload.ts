import { ipcRenderer, contextBridge, type IpcRendererEvent } from 'electron'
import type { SourceFolder } from '../shared/types'

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
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
