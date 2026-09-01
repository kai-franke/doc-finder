// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SearchBar from './SearchBar'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SearchBar', () => {
  it('submits a query after the debounce interval', () => {
    vi.useFakeTimers()
    const onSearch = vi.fn()
    const onChange = vi.fn()
    const { rerender } = render(
      <SearchBar value="" disabled={false} loading={false} onChange={onChange} onSearch={onSearch} />,
    )
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'invoice' } })
    expect(onChange).toHaveBeenCalledWith('invoice')
    rerender(
      <SearchBar value="invoice" disabled={false} loading={false} onChange={onChange} onSearch={onSearch} />,
    )

    act(() => vi.advanceTimersByTime(349))
    expect(onSearch).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onSearch).toHaveBeenCalledWith('invoice')
  })

  it('submits immediately on Enter and does not repeat through debounce', () => {
    vi.useFakeTimers()
    const onSearch = vi.fn()
    render(
      <SearchBar value="invoice" disabled={false} loading={false} onChange={vi.fn()} onSearch={onSearch} />,
    )

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' })
    act(() => vi.advanceTimersByTime(400))
    expect(onSearch).toHaveBeenCalledTimes(1)
    expect(onSearch).toHaveBeenCalledWith('invoice')
  })

  it('disables input while indexing', () => {
    render(
      <SearchBar value="" disabled loading={false} onChange={vi.fn()} onSearch={vi.fn()} />,
    )
    expect((screen.getByRole('searchbox') as HTMLInputElement).disabled).toBe(true)
  })
})
