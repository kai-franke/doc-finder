import { useEffect, useRef } from 'react'

type SearchBarProps = {
  value: string
  disabled: boolean
  loading: boolean
  onChange: (value: string) => void
  onSearch: (query: string) => void
}

function SearchBar({ value, disabled, loading, onChange, onSearch }: SearchBarProps): React.JSX.Element {
  const lastSubmitted = useRef('')

  useEffect(() => {
    const query = value.trim()
    if (!query || disabled || query === lastSubmitted.current) return
    const timeout = window.setTimeout(() => {
      if (query === lastSubmitted.current) return
      lastSubmitted.current = query
      onSearch(query)
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [disabled, onSearch, value])

  const submit = (): void => {
    const query = value.trim()
    if (!query || disabled) return
    lastSubmitted.current = query
    onSearch(query)
  }

  return (
    <label className="relative flex items-center">
      <span className="pointer-events-none absolute left-3 text-[#aeaeb2]" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.6" />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
      <span className="sr-only">Search query</span>
      <input
        className="app-no-drag w-full rounded-[10px] border border-black/14 bg-white py-[9px] pl-9 pr-10 text-sm text-[#1d1d1f] shadow-[0_1px_3px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-[#aeaeb2] focus:border-[#0071e3]/60 focus:ring-2 focus:ring-[#0071e3]/15 disabled:bg-black/5 disabled:text-[#8e8e93]"
        type="search"
        placeholder={disabled ? 'Search is unavailable while indexing' : 'Search your PDFs'}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
        }}
      />
      {loading ? (
        <span className="absolute right-3 h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0071e3]/25 border-t-[#0071e3]" aria-label="Searching" />
      ) : null}
    </label>
  )
}

export default SearchBar
