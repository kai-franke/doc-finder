# IPC overview

```ts
// Indexing
'indexing:start'      → void
'indexing:progress'   → { current: number; total: number; fileName: string }
'indexing:complete'   → { indexed: number; errors: string[] }
'indexing:error'      → { filePath: string; message: string }
'indexing:abort'      → void

// Change detection
'index:scan'          → void
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
