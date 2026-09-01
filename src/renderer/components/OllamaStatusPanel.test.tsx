// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { OllamaStatus } from '../../shared/types'
import type { Api } from '../../main/preload'
import OllamaStatusPanel from './OllamaStatusPanel'

const modelMissing: OllamaStatus = {
  state: 'model-missing',
  running: true,
  modelAvailable: false,
  message: 'nomic-embed-text is not installed',
}

function installApi(status: OllamaStatus): { api: Api; installModel: ReturnType<typeof vi.fn> } {
  const installModel = vi.fn(async () => ({
    state: 'running' as const,
    running: true,
    modelAvailable: true,
    message: 'Ollama is ready',
  }))
  const noop = (): (() => void) => () => undefined
  const api = {
    ollama: {
      getStatus: vi.fn(async () => status),
      installModel,
      openDownloadPage: vi.fn(async () => undefined),
      onStatus: vi.fn(noop),
      onPullProgress: vi.fn(noop),
    },
  } as unknown as Api
  window.api = api
  return { api, installModel }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('OllamaStatusPanel', () => {
  it('does not install the model without explicit confirmation', async () => {
    const { installModel } = installApi(modelMissing)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<OllamaStatusPanel />)
    const button = await screen.findByRole('button', { name: 'Install model · 274 MB' })

    fireEvent.click(button)

    expect(window.confirm).toHaveBeenCalledOnce()
    expect(installModel).not.toHaveBeenCalled()
  })

  it('starts an explicitly confirmed model installation', async () => {
    const { installModel } = installApi(modelMissing)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<OllamaStatusPanel />)

    fireEvent.click(await screen.findByRole('button', { name: 'Install model · 274 MB' }))

    await waitFor(() => expect(installModel).toHaveBeenCalledOnce())
    expect(await screen.findByText('Ollama is ready')).toBeTruthy()
  })
})
