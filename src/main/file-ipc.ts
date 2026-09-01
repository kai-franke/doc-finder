import { ipcMain } from 'electron'
import type { FileActionResult } from '../shared/types'
import { FileActions } from './file-actions'

export function registerFileHandlers(fileActions = new FileActions()): void {
  ipcMain.handle(
    'file:open',
    (_event, payload: { filePath: string }): Promise<FileActionResult> =>
      fileActions.open(payload?.filePath ?? ''),
  )
  ipcMain.handle(
    'file:showInFinder',
    (_event, payload: { filePath: string }): Promise<FileActionResult> =>
      fileActions.showInFinder(payload?.filePath ?? ''),
  )
}
