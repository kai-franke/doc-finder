# PDF processing architecture

Feature 04 is split into small modules so each step can be understood and
tested without starting Electron.

The development environment is standardized on Node 24.11.1 through `.nvmrc`.
PDF extraction uses `pdf-parse` 2.4.5, whose built-in TypeScript declarations
replace the separate `@types/pdf-parse` package.

## Processing flow

1. `pdf-processing-service.ts` reads the unchanged registered folder paths from
   electron-store.
2. `pdf-discovery.ts` canonicalizes those paths and derives temporary effective
   scan roots. A registered child covered by a parent is skipped for this scan,
   but remains stored.
3. The same module traverses the effective roots and deduplicates PDFs by their
   resolved, preferably real, absolute path.
4. `pdf-extractor.ts` uses `pdf-parse` to extract page text.
5. `pdf-chunking.ts` creates overlapping word chunks.
6. `pdf-processing.ts` coordinates these steps with bounded PDF concurrency and
   yields one processed file or one error at a time.

No PDF chunks are sent through IPC in this feature. The later indexing flow can
consume the async event stream directly in the main process and expose only
progress information to the renderer.

## Chunking rule

The MVP uses a target size of 500 words and an overlap of 50 words. Therefore,
normal chunk starts are 450 words apart.

If the last prospective chunk has fewer than 100 words, it is not emitted as a
separate mini-chunk. Instead, the preceding chunk is rebuilt from its original
start through the document end. Rebuilding is important: appending the mini-
chunk would duplicate the overlap words inside the preceding chunk.

A whole document shorter than 100 words still produces one chunk because there
is no preceding chunk to extend.

## Error handling

Unreadable directories and PDFs, corrupt PDFs, and password-protected PDFs do
not stop the complete run. The pipeline yields a typed error event containing
the path and processing stage. Empty PDFs yield a successful processed event
with an empty chunk list.

## Future integration

- US-05 can store each processed event immediately in LanceDB.
- US-06 can use the existing `AbortSignal` option and convert events into
  progress updates.
- Folder removal must trigger a new change-detection scan, not immediate broad
  LanceDB deletion.
- US-07 can apply `selectedFolderPaths` only as a search-time path filter. It
  must not feed selected folders back into this processing pipeline.
