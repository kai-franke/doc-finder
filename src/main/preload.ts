import { ipcRenderer, contextBridge } from 'electron'
import type { SourceFolder } from '../shared/types'

// Scoped, typed API bridge. The renderer can only trigger these exact actions —
// no arbitrary IPC channels are exposed.
const api = {
  folders: {
    add: (): Promise<SourceFolder[]> => ipcRenderer.invoke('folders:add'),
    list: (): Promise<SourceFolder[]> => ipcRenderer.invoke('folders:list'),
    remove: (folderPath: string): Promise<SourceFolder[]> =>
      ipcRenderer.invoke('folders:remove', { folderPath }),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
