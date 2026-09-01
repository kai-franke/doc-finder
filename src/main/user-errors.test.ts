import { describe, expect, it } from 'vitest'
import { userMessage } from './user-errors'

describe('userMessage', () => {
  it('turns permission errors into plain folder guidance', () => {
    const error = Object.assign(new Error('EACCES: operation not permitted'), { code: 'EACCES' })
    expect(userMessage(error, 'scan')).toBe(
      'DocFinder does not have permission to read this folder.',
    )
  })

  it('does not expose parser details for protected or damaged PDFs', () => {
    expect(userMessage(new Error('Invalid password'), 'pdf-parse')).toBe(
      'This PDF could not be read. It may be damaged or password-protected.',
    )
  })

  it('provides actionable Ollama guidance', () => {
    expect(userMessage(new Error('Could not reach Ollama.'), 'search')).toBe(
      'Ollama is not responding. Check that Ollama is running and try again.',
    )
  })
})
