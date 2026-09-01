import { describe, expect, it, vi } from 'vitest'
import { FileActions } from './file-actions'

describe('FileActions', () => {
  it('opens an existing PDF with the system application', async () => {
    const openPath = vi.fn(async () => '')
    const actions = new FileActions({ isFile: async () => true, openPath })

    await expect(actions.open('/docs/file.pdf')).resolves.toEqual({ ok: true })
    expect(openPath).toHaveBeenCalledWith('/docs/file.pdf')
  })

  it('reports a missing PDF without calling Electron shell', async () => {
    const openPath = vi.fn(async () => '')
    const actions = new FileActions({ isFile: async () => false, openPath })

    await expect(actions.open('/docs/missing.pdf')).resolves.toEqual({
      ok: false,
      message: 'This PDF is no longer available.',
    })
    expect(openPath).not.toHaveBeenCalled()
  })

  it('reveals an existing PDF in Finder', async () => {
    const showItemInFolder = vi.fn()
    const actions = new FileActions({ isFile: async () => true, showItemInFolder })

    await expect(actions.showInFinder('/docs/file.pdf')).resolves.toEqual({ ok: true })
    expect(showItemInFolder).toHaveBeenCalledWith('/docs/file.pdf')
  })
})
