import { BrowserWindow, ipcMain, shell } from 'electron'
import type { OllamaManager } from './ollama-manager'

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function registerOllamaHandlers(manager: OllamaManager): void {
  ipcMain.handle('ollama:status', () => manager.getStatus())
  ipcMain.handle('ollama:installModel', () => manager.installModel())
  ipcMain.handle('ollama:openDownload', async () => {
    await shell.openExternal('https://ollama.com/download')
  })
  manager.onStatus((status) => broadcast('ollama:statusChanged', status))
  manager.onPullProgress((progress) => broadcast('ollama:pullProgress', progress))
}
