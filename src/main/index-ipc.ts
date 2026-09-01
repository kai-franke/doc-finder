import { BrowserWindow, ipcMain } from 'electron'
import type { IndexCoordinator } from './index-coordinator'
import { logError } from './logger'
import { userMessage } from './user-errors'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerIndexHandlers(coordinator: IndexCoordinator): void {
  const safely = async <T>(operation: 'scan' | 'index', callback: () => Promise<T>): Promise<T> => {
    try {
      return await callback()
    } catch (error) {
      logError(`index-${operation}`, error)
      throw new Error(userMessage(error, operation))
    }
  }
  ipcMain.handle('index:status', () => safely('index', () => coordinator.getStatus()))
  ipcMain.handle('index:scan', () => safely('scan', () => coordinator.scan()))
  ipcMain.handle('indexing:start', () => safely('index', () => coordinator.start()))
  ipcMain.handle('indexing:abort', () => coordinator.abort())

  coordinator.on('status', (status) => broadcast('index:statusChanged', status))
  coordinator.on('scanResult', (result) => broadcast('index:scanResult', result))
  coordinator.on('progress', (progress) => broadcast('indexing:progress', progress))
  coordinator.on('complete', (result) => broadcast('indexing:complete', result))
  coordinator.on('error', (error) => broadcast('indexing:error', error))
}
