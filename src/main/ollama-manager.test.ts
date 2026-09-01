import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import type { ModelPullProgress } from '../shared/types'
import { OllamaManager } from './ollama-manager'

type FakeClient = {
  model: string
  listModels: ReturnType<typeof vi.fn<() => Promise<string[]>>>
  pullModel: ReturnType<typeof vi.fn<(listener: (progress: ModelPullProgress) => void) => Promise<void>>>
}

function createClient(models: string[] = []): FakeClient {
  return {
    model: 'nomic-embed-text',
    listModels: vi.fn(async () => models),
    pullModel: vi.fn(async () => undefined),
  }
}

function createChild(): ChildProcess & { kill: ReturnType<typeof vi.fn> } {
  const child = new EventEmitter() as ChildProcess & { kill: ReturnType<typeof vi.fn> }
  Object.assign(child, {
    stderr: new EventEmitter(),
    exitCode: null,
    killed: false,
  })
  child.kill = vi.fn(() => {
    queueMicrotask(() => child.emit('exit', 0, null))
    return true
  })
  return child
}

describe('OllamaManager', () => {
  it('uses an already running server and never stops it', async () => {
    const client = createClient(['nomic-embed-text:latest'])
    const spawnServer = vi.fn()
    const manager = new OllamaManager(client, { spawnServer })

    await expect(manager.initialize()).resolves.toMatchObject({
      state: 'running',
      modelAvailable: true,
    })
    await manager.stop()
    expect(spawnServer).not.toHaveBeenCalled()
  })

  it('reports a missing Ollama installation', async () => {
    const client = createClient()
    client.listModels.mockRejectedValue(new Error('offline'))
    const manager = new OllamaManager(client, { findExecutable: async () => null })

    await expect(manager.initialize()).resolves.toMatchObject({
      state: 'not-installed',
      running: false,
    })
  })

  it('starts and later stops only its own server', async () => {
    const client = createClient()
    client.listModels
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([])
    const child = createChild()
    const manager = new OllamaManager(client, {
      findExecutable: async () => '/opt/homebrew/bin/ollama',
      spawnServer: () => child,
      delay: async () => undefined,
      startupTimeoutMs: 10,
      pollIntervalMs: 10,
    })

    await expect(manager.initialize()).resolves.toMatchObject({
      state: 'model-missing',
      running: true,
    })
    await manager.stop()
    expect(child.kill).toHaveBeenCalledWith('SIGTERM')
  })

  it('publishes model progress and becomes ready after installation', async () => {
    const client = createClient([])
    client.pullModel.mockImplementation(async (listener) => {
      listener({ status: 'downloading', completed: 50, total: 100, percent: 50 })
    })
    client.listModels
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(['nomic-embed-text:latest'])
    const manager = new OllamaManager(client)
    const progress = vi.fn()
    manager.onPullProgress(progress)
    await manager.initialize()

    await expect(manager.installModel()).resolves.toMatchObject({ state: 'running' })
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ percent: 50 }))
  })
})
