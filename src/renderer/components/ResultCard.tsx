import { useState } from 'react'
import type { FileActionResult, SearchResult } from '../../shared/types'

type ResultCardProps = {
  result: SearchResult
  onOpen: (filePath: string) => Promise<FileActionResult>
  onShowInFinder: (filePath: string) => Promise<FileActionResult>
}

function ResultCard({ result, onOpen, onShowInFinder }: ResultCardProps): React.JSX.Element {
  const percent = Math.round(result.score * 100)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'open' | 'finder' | null>(null)

  const run = async (
    action: 'open' | 'finder',
    callback: (filePath: string) => Promise<FileActionResult>,
  ): Promise<void> => {
    if (pending) return
    setPending(action)
    setError(null)
    const response = await callback(result.filePath).catch(() => ({
      ok: false,
      message: 'The file action could not be completed.',
    }))
    if (!response.ok) setError(response.message ?? 'The file action could not be completed.')
    setPending(null)
  }

  return (
    <article
      className="result-card group rounded-xl border border-black/8 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-black/14 hover:shadow-[0_5px_16px_rgba(0,0,0,0.08)]"
      onClick={() => void run('open', onOpen)}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md bg-[#ff3b30]/10 text-[#ff3b30]" aria-hidden="true">
          <svg width="19" height="22" viewBox="0 0 19 22" fill="none">
            <path d="M3 1h8l5 5v13a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 1v5h5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M4.5 15.5h9M4.5 12h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[13.5px] font-semibold text-[#1d1d1f]" title={result.fileName}>{result.fileName}</h2>
              <p className="mt-0.5 truncate text-[11px] text-[#8e8e93]" title={result.folderPath}>{result.folderPath}</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#34c759]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#248a3d]" aria-label={`${percent}% relevance`}>
              {percent}%
            </span>
          </div>
          <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-[#6e6e73]">{result.snippet}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="app-no-drag rounded-md bg-[#0071e3] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#0068d1] disabled:opacity-50"
              disabled={pending !== null}
              onClick={(event) => {
                event.stopPropagation()
                void run('open', onOpen)
              }}
            >
              {pending === 'open' ? 'Opening…' : 'Open'}
            </button>
            <button
              type="button"
              className="app-no-drag rounded-md bg-black/5 px-2.5 py-1 text-[11px] font-medium text-[#6e6e73] transition hover:bg-black/10 disabled:opacity-50"
              disabled={pending !== null}
              onClick={(event) => {
                event.stopPropagation()
                void run('finder', onShowInFinder)
              }}
            >
              {pending === 'finder' ? 'Revealing…' : 'Show in Finder'}
            </button>
          </div>
          {error ? <p className="mt-2 text-[11px] text-[#ff3b30]" role="alert">{error}</p> : null}
        </div>
      </div>
    </article>
  )
}

export default ResultCard
