import type { ModelPullProgress } from '../shared/types'

export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434'
export const EMBEDDING_MODEL = 'nomic-embed-text'

export type OllamaClientOptions = {
  baseUrl?: string
  model?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

type EmbedResponse = {
  embeddings?: unknown
  error?: unknown
}

type TagsResponse = {
  models?: Array<{ name?: unknown; model?: unknown }>
  error?: unknown
}

export class OllamaError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'OllamaError'
    this.status = status
  }
}

function asErrorMessage(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function validateEmbeddings(value: unknown, expected: number): number[][] {
  if (!Array.isArray(value) || value.length !== expected) {
    throw new OllamaError('Ollama returned an unexpected number of embeddings.')
  }

  const embeddings = value.map((vector) => {
    if (!Array.isArray(vector) || vector.length === 0 || !vector.every(Number.isFinite)) {
      throw new OllamaError('Ollama returned an invalid embedding vector.')
    }
    return vector as number[]
  })

  const dimension = embeddings[0].length
  if (!embeddings.every((vector) => vector.length === dimension)) {
    throw new OllamaError('Ollama returned embedding vectors with different dimensions.')
  }
  return embeddings
}

/** Small HTTP adapter around Ollama's local API. */
export class OllamaClient {
  readonly model: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: OllamaClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_OLLAMA_URL).replace(/\/$/u, '')
    this.model = options.model ?? EMBEDDING_MODEL
    this.timeoutMs = options.timeoutMs ?? 30_000
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async embed(input: string | readonly string[], signal?: AbortSignal): Promise<number[][]> {
    const values = typeof input === 'string' ? [input] : [...input]
    if (values.length === 0) return []
    if (values.some((value) => !value.trim())) {
      throw new OllamaError('Cannot create an embedding for empty text.')
    }

    const timeoutController = new AbortController()
    const timeout = setTimeout(() => timeoutController.abort(), this.timeoutMs)
    const abort = (): void => timeoutController.abort()
    signal?.addEventListener('abort', abort, { once: true })

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/embed`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, input: values }),
        signal: timeoutController.signal,
      })
      const payload = (await response.json().catch(() => ({}))) as EmbedResponse
      if (!response.ok) {
        throw new OllamaError(
          asErrorMessage(payload.error) ?? `Ollama request failed with status ${response.status}.`,
          response.status,
        )
      }
      return validateEmbeddings(payload.embeddings, values.length)
    } catch (error) {
      if (error instanceof OllamaError) throw error
      if (signal?.aborted) throw new DOMException('The embedding request was cancelled.', 'AbortError')
      if (timeoutController.signal.aborted) {
        throw new OllamaError('Ollama did not respond in time.')
      }
      throw new OllamaError('Could not reach Ollama.')
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }

  async getEmbedding(text: string, signal?: AbortSignal): Promise<number[]> {
    const [embedding] = await this.embed(text, signal)
    return embedding
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 2_000))
    const abort = (): void => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      })
      const payload = (await response.json().catch(() => ({}))) as TagsResponse
      if (!response.ok) {
        throw new OllamaError(
          asErrorMessage(payload.error) ?? `Ollama request failed with status ${response.status}.`,
          response.status,
        )
      }
      if (!Array.isArray(payload.models)) throw new OllamaError('Ollama returned an invalid model list.')
      return payload.models.flatMap((model) => {
        const value = typeof model.model === 'string' ? model.model : model.name
        return typeof value === 'string' ? [value] : []
      })
    } catch (error) {
      if (error instanceof OllamaError) throw error
      if (signal?.aborted) throw new DOMException('The Ollama request was cancelled.', 'AbortError')
      throw new OllamaError('Could not reach Ollama.')
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }

  async pullModel(
    onProgress: (progress: ModelPullProgress) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: this.model, stream: true }),
        signal,
      })
    } catch (error) {
      if (signal?.aborted) throw new DOMException('The model download was cancelled.', 'AbortError')
      throw new OllamaError('Could not start the model download.')
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: unknown }
      throw new OllamaError(
        asErrorMessage(payload.error) ?? `Model download failed with status ${response.status}.`,
        response.status,
      )
    }
    if (!response.body) throw new OllamaError('Ollama did not provide download progress.')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffered = ''
    const parseLine = (line: string): void => {
      if (!line.trim()) return
      const value = JSON.parse(line) as {
        status?: unknown
        completed?: unknown
        total?: unknown
        error?: unknown
      }
      const error = asErrorMessage(value.error)
      if (error) throw new OllamaError(error)
      const status = asErrorMessage(value.status) ?? 'Downloading model…'
      const completed = typeof value.completed === 'number' ? value.completed : undefined
      const total = typeof value.total === 'number' ? value.total : undefined
      onProgress({
        status,
        ...(completed === undefined ? {} : { completed }),
        ...(total === undefined ? {} : { total }),
        ...(completed === undefined || total === undefined || total === 0
          ? {}
          : { percent: Math.round((completed / total) * 100) }),
      })
    }

    let streamFinished = false
    while (!streamFinished) {
      const { done, value } = await reader.read()
      buffered += decoder.decode(value, { stream: !done })
      const lines = buffered.split('\n')
      buffered = lines.pop() ?? ''
      for (const line of lines) parseLine(line)
      streamFinished = done
    }
    parseLine(buffered)
  }
}
