// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SearchResult } from '../../shared/types'
import ResultList from './ResultList'

afterEach(cleanup)

const result: SearchResult = {
  filePath: '/docs/invoice.pdf',
  fileName: 'invoice.pdf',
  folderPath: '/docs',
  snippet: 'An invoice for the vehicle repair.',
  score: 0.91,
}

describe('ResultList', () => {
  it('explains that folders must be indexed first', () => {
    render(<ResultList query="" results={[]} loading={false} hasIndex={false} error={null} />)
    expect(screen.getByText('Index empty')).toBeTruthy()
    expect(screen.getByText('Please index your folders first.')).toBeTruthy()
  })

  it('shows the no-results state for a completed query', () => {
    render(<ResultList query="missing" results={[]} loading={false} hasIndex error={null} />)
    expect(screen.getByText('No documents found')).toBeTruthy()
  })

  it('renders result metadata and relevance', () => {
    render(<ResultList query="invoice" results={[result]} loading={false} hasIndex error={null} />)
    expect(screen.getByText('invoice.pdf')).toBeTruthy()
    expect(screen.getByText('An invoice for the vehicle repair.')).toBeTruthy()
    expect(screen.getByLabelText('91% relevance')).toBeTruthy()
  })
})
