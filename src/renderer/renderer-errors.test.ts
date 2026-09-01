import { describe, expect, it } from 'vitest'
import { friendlyRendererError } from './renderer-errors'

describe('friendlyRendererError', () => {
  it('removes Electron IPC boilerplate from user-facing messages', () => {
    const error = new Error(
      "Error invoking remote method 'search:query': Error: Search is temporarily unavailable. Please try again.",
    )
    expect(friendlyRendererError(error, 'Search failed.')).toBe(
      'Search is temporarily unavailable. Please try again.',
    )
  })

  it('uses a plain fallback for unknown failures', () => {
    expect(friendlyRendererError('failed', 'Please try again.')).toBe('Please try again.')
  })
})
