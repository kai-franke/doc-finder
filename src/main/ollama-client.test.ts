import { describe, expect, it, vi } from 'vitest'
import { OllamaClient } from './ollama-client'

describe('OllamaClient', () => {
  it('generates a batch of embeddings through the local API', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        model: 'nomic-embed-text',
        input: ['first', 'second'],
      })
      return new Response(JSON.stringify({ embeddings: [[1, 0], [0, 1]] }))
    })
    const client = new OllamaClient({ fetchImpl })

    await expect(client.embed(['first', 'second'])).resolves.toEqual([[1, 0], [0, 1]])
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('reports the Ollama response instead of failing silently', async () => {
    const client = new OllamaClient({
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'model not found' }), { status: 404 }),
    })

    await expect(client.getEmbedding('query')).rejects.toMatchObject({
      message: 'model not found',
      status: 404,
    })
  })

  it('rejects malformed vectors', async () => {
    const client = new OllamaClient({
      fetchImpl: async () => new Response(JSON.stringify({ embeddings: [[1], []] })),
    })

    await expect(client.embed(['first', 'second'])).rejects.toThrow('invalid embedding vector')
  })

  it('lists locally installed models', async () => {
    const client = new OllamaClient({
      fetchImpl: async () =>
        new Response(JSON.stringify({
          models: [{ name: 'llama3.2:latest' }, { model: 'nomic-embed-text:latest' }],
        })),
    })

    await expect(client.listModels()).resolves.toEqual([
      'llama3.2:latest',
      'nomic-embed-text:latest',
    ])
  })

  it('streams model download progress', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        model: 'nomic-embed-text',
        stream: true,
      })
      return new Response([
        JSON.stringify({ status: 'pulling manifest' }),
        JSON.stringify({ status: 'downloading', completed: 50, total: 100 }),
        JSON.stringify({ status: 'success', completed: 100, total: 100 }),
      ].join('\n'))
    })
    const client = new OllamaClient({ fetchImpl })
    const updates: Array<{ status: string; percent?: number }> = []

    await client.pullModel((progress) => updates.push(progress))

    expect(updates).toEqual([
      { status: 'pulling manifest' },
      { status: 'downloading', completed: 50, total: 100, percent: 50 },
      { status: 'success', completed: 100, total: 100, percent: 100 },
    ])
  })
})
