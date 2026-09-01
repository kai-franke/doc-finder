import type { SearchResult } from '../../shared/types'

type ResultCardProps = {
  result: SearchResult
}

function ResultCard({ result }: ResultCardProps): React.JSX.Element {
  const percent = Math.round(result.score * 100)
  return (
    <article className="group rounded-xl border border-black/8 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-black/14 hover:shadow-[0_5px_16px_rgba(0,0,0,0.08)]">
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
        </div>
      </div>
    </article>
  )
}

export default ResultCard
