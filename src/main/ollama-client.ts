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
}
