import { promises as fs } from 'node:fs'
import { shell } from 'electron'
import type { FileActionResult } from '../shared/types'
import { logError } from './logger'

export type FileActionDependencies = {
  isFile?: (filePath: string) => Promise<boolean>
  openPath?: (filePath: string) => Promise<string>
  showItemInFolder?: (filePath: string) => void
}

async function defaultIsFile(filePath: string): Promise<boolean> {
  return (await fs.stat(filePath)).isFile()
}

export class FileActions {
  private readonly isFile: (filePath: string) => Promise<boolean>
  private readonly openPath: (filePath: string) => Promise<string>
  private readonly showItemInFolder: (filePath: string) => void

  constructor(dependencies: FileActionDependencies = {}) {
    this.isFile = dependencies.isFile ?? defaultIsFile
    this.openPath = dependencies.openPath ?? ((filePath) => shell.openPath(filePath))
    this.showItemInFolder = dependencies.showItemInFolder ?? ((filePath) => shell.showItemInFolder(filePath))
  }

  private async validate(filePath: string): Promise<FileActionResult | null> {
    if (!filePath.trim()) return { ok: false, message: 'The PDF path is missing.' }
    try {
      if (!(await this.isFile(filePath))) {
        return { ok: false, message: 'This PDF is no longer available.' }
      }
      return null
    } catch (error) {
      logError('file-access', error, { filePath })
      return { ok: false, message: 'This PDF is no longer available.' }
    }
  }

  async open(filePath: string): Promise<FileActionResult> {
    const invalid = await this.validate(filePath)
    if (invalid) return invalid
    try {
      const errorMessage = await this.openPath(filePath)
      if (errorMessage) {
        logError('file-open', errorMessage, { filePath })
        return { ok: false, message: 'The PDF could not be opened.' }
      }
      return { ok: true }
    } catch (error) {
      logError('file-open', error, { filePath })
      return { ok: false, message: 'The PDF could not be opened.' }
    }
  }

  async showInFinder(filePath: string): Promise<FileActionResult> {
    const invalid = await this.validate(filePath)
    if (invalid) return invalid
    try {
      this.showItemInFolder(filePath)
      return { ok: true }
    } catch (error) {
      logError('file-reveal', error, { filePath })
      return { ok: false, message: 'The PDF could not be shown in Finder.' }
    }
  }
}
