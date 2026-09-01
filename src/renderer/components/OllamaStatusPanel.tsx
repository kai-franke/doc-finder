import { useEffect, useState } from 'react'
import type { ModelPullProgress, OllamaStatus } from '../../shared/types'

function dotColor(status: OllamaStatus | null): string {
  if (status?.state === 'running') return 'bg-[#34c759]'
  if (status?.state === 'not-installed' || status?.state === 'error') return 'bg-[#ff3b30]'
  if (status?.state === 'model-missing' || status?.state === 'starting' || status?.state === 'pulling') {
    return 'bg-[#ff9500]'
  }
  return 'bg-[#aeaeb2]'
}

function OllamaStatusPanel(): React.JSX.Element {
  const [status, setStatus] = useState<OllamaStatus | null>(null)
  const [progress, setProgress] = useState<ModelPullProgress | null>(null)

  useEffect(() => {
    void window.api.ollama.getStatus().then(setStatus).catch(() => {
      setStatus({
        state: 'error',
        running: false,
        modelAvailable: false,
        message: 'Ollama status could not be loaded',
      })
    })
    const unsubscribers = [
      window.api.ollama.onStatus((nextStatus) => {
        setStatus(nextStatus)
        if (nextStatus.state !== 'pulling') setProgress(null)
      }),
      window.api.ollama.onPullProgress(setProgress),
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [])

  async function installModel(): Promise<void> {
    const confirmed = window.confirm(
      'Download nomic-embed-text now? The model is approximately 274 MB and is stored locally by Ollama.',
    )
    if (!confirmed) return
    setProgress({ status: 'Preparing download…', percent: 0 })
    try {
      setStatus(await window.api.ollama.installModel())
    } catch (error) {
      setStatus({
        state: 'error',
        running: true,
        modelAvailable: false,
        message: error instanceof Error ? error.message : 'The model could not be installed',
      })
    }
  }

  const label = status?.message ?? 'Checking Ollama…'

  return (
    <div className="mt-2 border-t border-black/8 pt-2" aria-label="Ollama status">
      <div className="flex items-start gap-[7px] text-[11px] leading-snug text-[#6e6e73]" role="status">
        <span className={`mt-1 h-[7px] w-[7px] shrink-0 rounded-full ${dotColor(status)}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 break-words">{label}</span>
      </div>

      {status?.state === 'pulling' && progress ? (
        <div className="mt-2" aria-label="Model download progress">
          <div className="mb-1 flex justify-between gap-2 text-[10.5px] text-[#6e6e73]">
            <span className="truncate">{progress.status}</span>
            {progress.percent === undefined ? null : <span>{progress.percent}%</span>}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[#0071e3] transition-[width] duration-300"
              style={{ width: `${progress.percent ?? 0}%` }}
            />
          </div>
        </div>
      ) : null}

      {status?.state === 'not-installed' ? (
        <button
          className="app-no-drag mt-2 w-full cursor-default rounded-md border border-black/12 bg-white/60 px-2 py-1.5 text-[11.5px] font-medium text-[#0071e3] hover:bg-white"
          type="button"
          onClick={() => void window.api.ollama.openDownloadPage()}
        >
          Install Ollama
        </button>
      ) : null}

      {status?.state === 'model-missing' ? (
        <button
          className="app-no-drag mt-2 w-full cursor-default rounded-md border border-black/12 bg-white/60 px-2 py-1.5 text-[11.5px] font-medium text-[#0071e3] hover:bg-white"
          type="button"
          onClick={() => void installModel()}
        >
          Install model · 274 MB
        </button>
      ) : null}
    </div>
  )
}

export default OllamaStatusPanel
