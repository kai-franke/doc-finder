import { BrowserWindow, ipcMain } from 'electron'
import type { IndexCoordinator } from './index-coordinator'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerIndexHandlers(coordinator: IndexCoordinator): void {
  ipcMain.handle('index:status', () => coordinator.getStatus())
  ipcMain.handle('index:scan', () => coordinator.scan())
  ipcMain.handle('indexing:start', () => coordinator.start())
  ipcMain.handle('indexing:abort', () => coordinator.abort())

  coordinator.on('status', (status) => broadcast('index:statusChanged', status))
  coordinator.on('scanResult', (result) => broadcast('index:scanResult', result))
  coordinator.on('progress', (progress) => broadcast('indexing:progress', progress))
  coordinator.on('complete', (result) => broadcast('indexing:complete', result))
  coordinator.on('error', (error) => broadcast('indexing:error', error))
}
