import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppLogger } from './logger'

describe('AppLogger', () => {
  let directory: string

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'docfinder-logs-'))
  })

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('persists developer details below the configured log directory', async () => {
    const logger = new AppLogger(directory)
    logger.error('index', new Error('database unavailable'), { filePath: '/docs/file.pdf' })
    await logger.flush()

    const contents = await fs.readFile(path.join(directory, 'docfinder.log'), 'utf8')
    expect(contents).toContain('ERROR [index] Error: database unavailable')
    expect(contents).toContain('"filePath":"/docs/file.pdf"')
  })
})
