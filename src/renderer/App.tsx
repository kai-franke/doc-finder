import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  IndexStatus,
  IndexingError,
  IndexingResult,
  SearchResult,
  SourceFolder,
} from '../shared/types'
import FolderList from './components/FolderList'
import IndexStatusPanel from './components/IndexStatusPanel'
import ResultList from './components/ResultList'
import SearchBar from './components/SearchBar'

function App(): React.JSX.Element {
  const [folders, setFolders] = useState<SourceFolder[]>([])
  const [indexStatus, setIndexStatus] = useState<IndexStatus | null>(null)
  const [indexResult, setIndexResult] = useState<IndexingResult | null>(null)
  const [indexErrors, setIndexErrors] = useState<IndexingError[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchRequest = useRef(0)

  // Beim Start der App die gespeicherten Ordner laden und zusätzlich auf
  // Hintergrund-Aktualisierungen horchen (z. B. wenn eine PDF-Zählung im
  // Hauptprozess fertig geworden ist).
  useEffect(() => {
    window.api.folders.list().then(setFolders)
    const unsubscribe = window.api.folders.onChanged(setFolders)
    return unsubscribe
  }, [])

  useEffect(() => {
    window.api.index.getStatus().then(setIndexStatus)
    const unsubscribers = [
      window.api.index.onStatus(setIndexStatus),
      window.api.index.onComplete(setIndexResult),
      window.api.index.onError((error) => setIndexErrors((current) => [...current, error])),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [])

  async function handleAddFolder() {
    setFolders(await window.api.folders.add())
  }

  async function handleRemoveFolder(folderPath: string) {
    setFolders(await window.api.folders.remove(folderPath))
  }

  async function handleStartIndexing() {
    setIndexResult(null)
    setIndexErrors([])
    await window.api.index.start()
  }

  function handleAbortIndexing() {
    void window.api.index.abort()
  }

  const handleSearch = useCallback(async (searchQuery: string) => {
    const request = searchRequest.current + 1
    searchRequest.current = request
    setSearching(true)
    setSearchError(null)
    try {
      const nextResults = await window.api.search.query(searchQuery)
      if (request === searchRequest.current) setResults(nextResults)
    } catch (error) {
      if (request === searchRequest.current) {
        setResults([])
        setSearchError(error instanceof Error ? error.message : 'Search could not be completed.')
      }
    } finally {
      if (request === searchRequest.current) setSearching(false)
    }
  }, [])

  return (
    <div className="flex h-full min-h-[520px] min-w-[760px] flex-col overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      <header
        className="app-drag relative flex h-[38px] shrink-0 items-center border-b border-black/8 bg-[#ececec]"
        aria-label="Window title bar"
      >
        <div className="w-[76px] shrink-0" aria-hidden="true" />
        <div className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium text-[#6e6e73]">
          DocFinder
        </div>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="flex w-[240px] shrink-0 flex-col overflow-hidden border-r border-black/14 bg-[#ececec]"
          aria-label="Source folders and status"
        >
          <section className="px-3 pb-2 pt-4">
            <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#aeaeb2]">
              Source Folders
            </h2>
            <FolderList folders={folders} onRemove={handleRemoveFolder} />
            <button
              onClick={handleAddFolder}
              className="app-no-drag mt-2 flex w-full cursor-default items-center justify-center gap-1.5 rounded-md border border-dashed border-black/14 bg-transparent px-2 py-1.5 text-[12.5px] text-[#0071e3] transition hover:border-[#0071e3] hover:bg-[#0071e3]/8"
              type="button"
            >
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[17px] leading-none" aria-hidden="true">
                +
              </span>
              Add folder
            </button>
          </section>

          <section className="mt-auto border-t border-black/8 p-3" aria-label="Index and Ollama status">
            <IndexStatusPanel
              status={indexStatus}
              lastResult={indexResult}
              transientErrors={indexErrors}
              onStart={handleStartIndexing}
              onAbort={handleAbortIndexing}
            />
            <div className="mt-2 flex items-center gap-[5px] text-[11px] text-[#aeaeb2]">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#aeaeb2]" aria-hidden="true" />
              <span>Ollama status pending</span>
            </div>
          </section>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f5f5f7]" aria-label="Search">
          <div className="shrink-0 px-5 pb-3 pt-4">
            <SearchBar
              value={query}
              disabled={indexStatus?.isIndexing ?? false}
              loading={searching}
              onChange={setQuery}
              onSearch={handleSearch}
            />
            <div className="mt-2 px-0.5 text-xs text-[#aeaeb2]">
              <span>{results.length > 0 ? `${results.length} ${results.length === 1 ? 'result' : 'results'}` : 'Search results will appear below'}</span>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <ResultList
              query={query}
              results={results}
              loading={searching}
              hasIndex={(indexStatus?.indexedDocuments ?? 0) > 0}
              error={searchError}
              onOpen={window.api.files.open}
              onShowInFinder={window.api.files.showInFinder}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
