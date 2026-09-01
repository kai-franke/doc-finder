import { BrowserWindow, ipcMain } from 'electron'
import type { SearchResult } from '../shared/types'
import type { SearchService } from './search-service'
import { logError } from './logger'
import { userMessage } from './user-errors'

function broadcastResults(results: SearchResult[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('search:result', results)
  }
}

export function registerSearchHandlers(searchService: SearchService): void {
  ipcMain.handle('search:query', async (_event, payload: { query: string }): Promise<SearchResult[]> => {
    if (!payload || typeof payload.query !== 'string') throw new TypeError('A search query is required.')
    try {
      const results = await searchService.search(payload.query)
      broadcastResults(results)
      return results
    } catch (error) {
      logError('search', error)
      throw new Error(userMessage(error, 'search'))
    }
  })
}
