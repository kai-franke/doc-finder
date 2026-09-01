# DocFinder

DocFinder is a private semantic search app for local PDF documents. Add one or more folders, build a local index, and search by meaning instead of exact filenames or keywords.

All PDF text, embeddings, queries, and the LanceDB index stay on your Mac. DocFinder has no cloud backend and does not upload documents. Network access is only needed when Ollama itself downloads the embedding model.

## Features

- Natural-language semantic search across local PDFs
- Multiple source folders, including nested folders
- Incremental indexing for new, changed, and removed files
- Ranked snippets with direct **Open** and **Show in Finder** actions
- Local embeddings through Ollama and `nomic-embed-text`
- Persistent local vector index through LanceDB
- Indexing progress, cancellation, clear error states, and local diagnostics

## Requirements

- macOS on Apple silicon
- [Node.js 24](https://nodejs.org/) for source development; the exact version is in `.nvmrc`
- npm, included with Node.js
- [Ollama for macOS](https://ollama.com/download)
- Approximately 274 MB of free space for `nomic-embed-text`, plus space for the local index

Scanned image-only PDFs need OCR and are not supported by this MVP. Password-protected, damaged, inaccessible, and empty PDFs are skipped or retained safely without stopping the remaining indexing run.

## Install the macOS app

1. Install Ollama from [ollama.com/download](https://ollama.com/download).
2. Open `DocFinder-1.0.0-arm64.dmg` from `release/1.0.0` and drag **DocFinder** to **Applications**.
3. Because this MVP build is unsigned and not notarized, Control-click **DocFinder**, choose **Open**, then confirm the macOS prompt on first launch.
4. If the sidebar reports that `nomic-embed-text` is missing, choose **Install model · 274 MB** and confirm the download. DocFinder never downloads the model without confirmation.

You can also install the model yourself:

```bash
ollama pull nomic-embed-text
```

DocFinder uses an already running Ollama server when one exists. Otherwise it starts `ollama serve` and stops only that app-owned process when DocFinder quits.

## Use DocFinder

1. Choose **Add folder** and select a folder containing PDFs. Subfolders are included.
2. Wait for the background scan, then choose **Update index**. You can cancel a running update.
3. Enter a natural-language query, such as `invoice for the office chairs`, and press Return. Search also starts after a short typing pause.
4. Select a result or choose **Open** to open the PDF. Choose **Show in Finder** to reveal it.
5. Run **Update index** again when the sidebar reports new, changed, or removed files.

Removing a source folder removes documents that are no longer covered by another registered folder. The index and manifest are stored below the app's macOS Application Support directory.

## Develop from source

```bash
git clone git@github.com:kai-franke/doc-finder.git
cd doc-finder
nvm use 24.11.1
npm install
npm run dev
```

Development work is integrated through feature branches into `development`. `main` remains the stable branch and is updated only through an explicit release PR.

Useful commands:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Electron with Vite hot reload and development tools |
| `npm test` | Run Main Process and React tests |
| `npm run lint` | Run ESLint with zero warnings allowed |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm run build` | Build the unsigned Apple-silicon app and DMG |

## Production build

On an Apple-silicon Mac with Node 24:

```bash
nvm use 24.11.1
npm install
npm run build
```

Build artifacts are written to `release/1.0.0`:

- `mac-arm64/DocFinder.app` — locally ad-hoc-signed application bundle
- `DocFinder-1.0.0-arm64.dmg` — unsigned installer image

Production windows disable Chromium development tools. LanceDB native modules are unpacked from ASAR so they can load inside the application bundle. LanceDB's optional HuggingFace/ONNX embedding provider is excluded because DocFinder uses Ollama exclusively. The app uses the ad-hoc signature required to run arm64 binaries locally; Developer ID signing and Apple notarization are intentionally outside this MVP.

## Local data and privacy

DocFinder processes PDF content on the local machine. Ollama creates embeddings locally, and LanceDB stores them locally. Neither PDFs, extracted text, embeddings, nor search queries are sent to DocFinder servers because no DocFinder server exists.

Developer diagnostics are stored locally at `~/Library/Application Support/DocFinder/logs/docfinder.log`. They may contain local file paths and technical errors, but are not transmitted. Remove the Application Support folder to delete DocFinder settings, logs, manifest, and vector index.

## Architecture

```text
PDF folders → bounded scanner → text extraction → chunks
                                           ↓
query → Ollama embeddings → LanceDB cosine search → ranked documents
```

| Layer | Technology |
| --- | --- |
| Desktop | Electron + TypeScript |
| UI | React + Tailwind CSS |
| PDF extraction | pdf-parse |
| Embeddings | Ollama + nomic-embed-text |
| Vector index | LanceDB |
| Persistent settings | electron-store |

IPC payloads are documented in [`docs/ipc-contracts.md`](docs/ipc-contracts.md), PDF behavior in [`docs/pdf-processing.md`](docs/pdf-processing.md), and error behavior in [`docs/error-handling.md`](docs/error-handling.md).

## Known limitations

- macOS Apple silicon only for the current release
- Unsigned and not notarized
- No OCR for scanned image-only PDFs
- No chat/RAG answer generation

## License

MIT — see [`LICENSE`](LICENSE).
