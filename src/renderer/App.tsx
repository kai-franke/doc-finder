function App(): React.JSX.Element {
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
            <div className="flex flex-col gap-1" aria-label="Folder list placeholder">
              <div className="rounded-md px-2 py-[7px] text-xs leading-snug text-[#aeaeb2]">
                No folders added yet
              </div>
            </div>
            <button
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
            <div className="mb-2.5 flex items-start gap-[7px]">
              <span className="mt-1 h-[7px] w-[7px] shrink-0 rounded-full bg-[#ff9500]" aria-hidden="true" />
              <p className="m-0 flex flex-1 flex-col gap-0.5 text-[11.5px] leading-snug text-[#6e6e73]">
                No documents indexed
                <span className="text-[#aeaeb2]">Index your folders to enable search</span>
              </p>
            </div>
            <button
              className="app-no-drag flex w-full cursor-default items-center justify-center rounded-md border-0 bg-[#0071e3] px-3 py-[7px] text-[12.5px] font-semibold text-white"
              type="button"
            >
              Update index
            </button>
            <div className="mt-2 flex items-center gap-[5px] text-[11px] text-[#aeaeb2]">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#aeaeb2]" aria-hidden="true" />
              <span>Ollama status pending</span>
            </div>
          </section>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f5f5f7]" aria-label="Search">
          <div className="shrink-0 px-5 pb-3 pt-4">
            <label className="relative flex items-center">
              <span className="pointer-events-none absolute left-3 text-[#aeaeb2]" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.6" />
                  <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <span className="sr-only">Search query</span>
              <input
                className="app-no-drag w-full rounded-[10px] border border-black/14 bg-white py-[9px] pl-9 pr-3 text-sm text-[#1d1d1f] opacity-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] outline-none placeholder:text-[#aeaeb2] disabled:opacity-100"
                type="search"
                placeholder="Search your PDFs"
                disabled
              />
            </label>
            <div className="mt-2 px-0.5 text-xs text-[#aeaeb2]">
              <span>Search results will appear below</span>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-10 text-center">
            <div className="text-[#aeaeb2] opacity-60" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M12 8h17l7 7v21a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" />
                <path d="M29 8v7h7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 23h16M16 29h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="mt-3 text-[15px] font-semibold text-[#6e6e73]">No search results yet</h1>
            <p className="mt-2 max-w-[280px] text-[12.5px] leading-normal text-[#aeaeb2]">
              Add source folders and update the index to start searching local PDFs.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
