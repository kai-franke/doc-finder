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
})
