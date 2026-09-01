import { EventEmitter } from 'node:events'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { constants, promises as fs } from 'node:fs'
import { promisify } from 'node:util'
import type { ModelPullProgress, OllamaStatus } from '../shared/types'
import type { OllamaClient } from './ollama-client'
import { logError, logInfo } from './logger'
import { userMessage } from './user-errors'

const execFileAsync = promisify(execFile)

type RuntimeClient = Pick<OllamaClient, 'model' | 'listModels' | 'pullModel'>

export type OllamaManagerDependencies = {
  findExecutable?: () => Promise<string | null>
  spawnServer?: (executable: string) => ChildProcess
  delay?: (milliseconds: number) => Promise<void>
  startupTimeoutMs?: number
  pollIntervalMs?: number
}

const CHECKING: OllamaStatus = {
  state: 'checking',
  running: false,
  modelAvailable: false,
  message: 'Checking Ollama…',
}

function modelMatches(installed: string, requested: string): boolean {
  return installed === requested || installed === `${requested}:latest`
}

export async function findOllamaExecutable(): Promise<string | null> {
  const candidates = [
    '/opt/homebrew/bin/ollama',
    '/usr/local/bin/ollama',
    '/Applications/Ollama.app/Contents/Resources/ollama',
  ]
  for (const candidate of candidates) {
    try {
      await fs.access(candidate, constants.X_OK)
      return candidate
    } catch {
      // Try the next known installation path.
    }
  }
  try {
    await execFileAsync('ollama', ['--version'])
    return 'ollama'
  } catch {
    return null
  }
}

function defaultSpawnServer(executable: string): ChildProcess {
  return spawn(executable, ['serve'], {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  })
}

export class OllamaManager {
  private readonly events = new EventEmitter()
  private readonly findExecutable: () => Promise<string | null>
  private readonly spawnServer: (executable: string) => ChildProcess
  private readonly delay: (milliseconds: number) => Promise<void>
  private readonly startupTimeoutMs: number
  private readonly pollIntervalMs: number
  private status: OllamaStatus = CHECKING
  private child?: ChildProcess
  private startedByApp = false
  private pullController?: AbortController

  constructor(
    private readonly client: RuntimeClient,
    dependencies: OllamaManagerDependencies = {},
  ) {
    this.findExecutable = dependencies.findExecutable ?? findOllamaExecutable
    this.spawnServer = dependencies.spawnServer ?? defaultSpawnServer
    this.delay = dependencies.delay ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)))
    this.startupTimeoutMs = dependencies.startupTimeoutMs ?? 10_000
    this.pollIntervalMs = dependencies.pollIntervalMs ?? 250
  }

  onStatus(listener: (status: OllamaStatus) => void): () => void {
    this.events.on('status', listener)
    return () => this.events.off('status', listener)
  }

  onPullProgress(listener: (progress: ModelPullProgress) => void): () => void {
    this.events.on('pullProgress', listener)
    return () => this.events.off('pullProgress', listener)
  }

  getStatus(): OllamaStatus {
    return { ...this.status }
  }

  private setStatus(status: OllamaStatus): void {
    this.status = status
    this.events.emit('status', this.getStatus())
  }

  private async modelsOrNull(): Promise<string[] | null> {
    try {
      return await this.client.listModels()
    } catch {
      return null
    }
  }

  private applyModels(models: string[]): OllamaStatus {
    const modelAvailable = models.some((model) => modelMatches(model, this.client.model))
    return modelAvailable
      ? { state: 'running', running: true, modelAvailable: true, message: 'Ollama is ready' }
      : {
          state: 'model-missing',
          running: true,
          modelAvailable: false,
          message: `${this.client.model} is not installed`,
        }
  }

  async initialize(): Promise<OllamaStatus> {
    this.setStatus(CHECKING)
    const existingModels = await this.modelsOrNull()
    if (existingModels) {
      this.startedByApp = false
      const status = this.applyModels(existingModels)
      this.setStatus(status)
      return status
    }

    const executable = await this.findExecutable()
    if (!executable) {
      const status: OllamaStatus = {
        state: 'not-installed',
        running: false,
        modelAvailable: false,
        message: 'Ollama is not installed',
      }
      this.setStatus(status)
      return status
    }

    this.setStatus({
      state: 'starting',
      running: false,
      modelAvailable: false,
      message: 'Starting Ollama…',
    })
    try {
      this.child = this.spawnServer(executable)
      this.startedByApp = true
      let spawnError: Error | undefined
      this.child.once('error', (error) => {
        spawnError = error
      })
      this.child.stderr?.on('data', (data) => logInfo('ollama', String(data).trim()))
      const attempts = Math.max(1, Math.ceil(this.startupTimeoutMs / this.pollIntervalMs))
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        if (spawnError) throw spawnError
        const models = await this.modelsOrNull()
        if (models) {
          const status = this.applyModels(models)
          this.setStatus(status)
          return status
        }
        await this.delay(this.pollIntervalMs)
      }
      if (spawnError) throw spawnError
      throw new Error('Ollama did not become ready within 10 seconds.')
    } catch (error) {
      logError('ollama-start', error)
      await this.stop()
      const status: OllamaStatus = {
        state: 'error',
        running: false,
        modelAvailable: false,
        message: userMessage(error, 'ollama'),
      }
      this.setStatus(status)
      return status
    }
  }

  async installModel(): Promise<OllamaStatus> {
    if (!this.status.running) throw new Error('Ollama must be running before installing the model.')
    if (this.pullController) throw new Error('The model is already downloading.')
    const controller = new AbortController()
    this.pullController = controller
    this.setStatus({
      state: 'pulling',
      running: true,
      modelAvailable: false,
      message: `Downloading ${this.client.model}…`,
    })
    try {
      await this.client.pullModel(
        (progress) => this.events.emit('pullProgress', progress),
        controller.signal,
      )
      const status = this.applyModels(await this.client.listModels())
      this.setStatus(status)
      return status
    } catch (error) {
      logError('ollama-model', error, { model: this.client.model })
      const status: OllamaStatus = {
        state: 'error',
        running: true,
        modelAvailable: false,
        message: userMessage(error, 'ollama'),
      }
      this.setStatus(status)
      return status
    } finally {
      this.pullController = undefined
    }
  }

  async stop(): Promise<void> {
    this.pullController?.abort()
    if (!this.startedByApp || !this.child) return
    const child = this.child
    this.child = undefined
    this.startedByApp = false
    if (child.exitCode !== null || child.killed) return
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL')
        resolve()
      }, 2_000)
      child.once('exit', () => {
        clearTimeout(timeout)
        resolve()
      })
      child.kill('SIGTERM')
    })
  }
}
