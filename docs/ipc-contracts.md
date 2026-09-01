# IPC overview

```ts
// Indexing (invoke)
'index:status'        → IndexStatus
'indexing:start'      → IndexingResult
'indexing:abort'      → void

// Indexing (Main → Renderer events)
'index:statusChanged' → IndexStatus
'indexing:progress'   → IndexingProgress
'indexing:complete'   → IndexingResult
'indexing:error'      → IndexingError

// Change detection
'index:scan'          → ScanResult
'index:scanResult'    → ScanResult

// Search
'search:query'        → { query: string }
'search:result'       → SearchResult[]

// Folder management
'folders:add'         → void
'folders:list'        → SourceFolder[]
'folders:remove'      → { folderPath: string }

// File actions
'file:open'           → { filePath: string }
'file:showInFinder'   → { filePath: string }

// Ollama
'ollama:status'       → { running: boolean; message?: string }
```

All payload types are exported from `src/shared/types.ts`. `IndexingProgress`
contains `current`, `total`, `fileName`, and a rounded `percent`. An
`IndexingResult` reports indexed and deleted document counts, per-file errors,
and whether the operation was aborted.
