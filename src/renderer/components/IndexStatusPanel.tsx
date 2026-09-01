import type { IndexStatus, IndexingError, IndexingResult } from '../../shared/types'

type IndexStatusPanelProps = {
  status: IndexStatus | null
  lastResult: IndexingResult | null
  transientErrors: IndexingError[]
  onStart: () => void
  onAbort: () => void
}

function changeCount(status: IndexStatus): number {
  return (
    status.scanResult.newFiles.length +
    status.scanResult.changedFiles.length +
    status.scanResult.deletedFiles.length
  )
}

function updatedLabel(timestamp: number | null): string {
  if (timestamp === null) return 'No documents indexed'
  return `Last updated ${new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)}`
}

function IndexStatusPanel({
  status,
  lastResult,
  transientErrors,
  onStart,
  onAbort,
}: IndexStatusPanelProps): React.JSX.Element {
  const changes = status ? changeCount(status) : 0
  const errors = lastResult?.errors ?? transientErrors
  const isBusy = status?.isIndexing ?? false
  const buttonDisabled = !status || status.isScanning || (!isBusy && changes === 0)
  const buttonLabel = !status || status.isScanning
    ? 'Scanning folders…'
    : isBusy
      ? 'Abort'
      : changes === 0
        ? 'Index up to date'
        : `Update index · ${changes} ${changes === 1 ? 'change' : 'changes'}`

  return (
    <div aria-label="Index status">
      <div className="mb-2.5 flex items-start gap-[7px]">
        <span
          className={`mt-1 h-[7px] w-[7px] shrink-0 rounded-full ${
            status?.indexedDocuments ? 'bg-[#34c759]' : 'bg-[#ff9500]'
          }`}
          aria-hidden="true"
        />
        <p className="m-0 flex min-w-0 flex-1 flex-col gap-0.5 text-[11.5px] leading-snug text-[#6e6e73]">
          <span>{status ? `${status.indexedDocuments} documents indexed` : 'Loading index…'}</span>
          <span className="truncate text-[#aeaeb2]">{updatedLabel(status?.lastUpdated ?? null)}</span>
        </p>
      </div>

      {status?.progress ? (
        <div className="mb-2" role="status" aria-live="polite">
          <div className="mb-1 flex justify-between gap-2 text-[10.5px] text-[#6e6e73]">
            <span className="truncate" title={status.progress.fileName}>{status.progress.fileName}</span>
            <span className="shrink-0">{status.progress.current}/{status.progress.total}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
            <div
              className="progress-fill h-full rounded-full bg-[#0071e3] transition-[width] duration-300"
              style={{ width: `${status.progress.percent}%` }}
            />
          </div>
        </div>
      ) : null}

      <button
        className={`app-no-drag flex w-full cursor-default items-center justify-center rounded-md border-0 px-3 py-[7px] text-[12.5px] font-semibold transition ${
          buttonDisabled
            ? 'bg-black/8 text-[#8e8e93]'
            : isBusy
              ? 'bg-[#ff3b30] text-white hover:bg-[#e9342b]'
              : 'bg-[#0071e3] text-white hover:bg-[#0068d1]'
        }`}
        type="button"
        disabled={buttonDisabled}
        onClick={isBusy ? onAbort : onStart}
      >
        {buttonLabel}
      </button>

      {errors.length > 0 ? (
        <details className="mt-2 text-[10.5px] text-[#ff3b30]">
          <summary>{errors.length} {errors.length === 1 ? 'file failed' : 'files failed'}</summary>
          <ul className="mt-1 max-h-20 overflow-auto pl-4">
            {errors.map((error) => (
              <li key={`${error.filePath}:${error.message}`} title={error.message} className="truncate">
                {error.filePath}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

export default IndexStatusPanel
