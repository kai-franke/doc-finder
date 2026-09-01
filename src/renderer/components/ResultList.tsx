import type { SearchResult } from '../../shared/types'
import ResultCard from './ResultCard'

type ResultListProps = {
  query: string
  results: SearchResult[]
  loading: boolean
  hasIndex: boolean
  error: string | null
}

function EmptyState({ title, description }: { title: string; description: string }): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-10 text-center">
      <div className="text-[#aeaeb2] opacity-60" aria-hidden="true">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path d="M12 8h17l7 7v21a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M29 8v7h7" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 23h16M16 29h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <h1 className="mt-3 text-[15px] font-semibold text-[#6e6e73]">{title}</h1>
      <p className="mt-2 max-w-[300px] text-[12.5px] leading-normal text-[#aeaeb2]">{description}</p>
    </div>
  )
}

function ResultList({ query, results, loading, hasIndex, error }: ResultListProps): React.JSX.Element {
  if (error) return <EmptyState title="Search unavailable" description={error} />
  if (!hasIndex) {
    return <EmptyState title="Index empty" description="Please index your folders first." />
  }
  if (loading && results.length === 0) {
    return <EmptyState title="Searching…" description="Finding the most relevant documents." />
  }
  if (query.trim() && results.length === 0) {
    return <EmptyState title="No documents found" description="Try a broader or differently worded search." />
  }
  if (results.length === 0) {
    return <EmptyState title="No search results yet" description="Describe the document you are looking for above." />
  }
  return (
    <div className="grid gap-2.5 p-5 pt-1" aria-label="Search results">
      {results.map((result) => <ResultCard key={result.filePath} result={result} />)}
    </div>
  )
}

export default ResultList
