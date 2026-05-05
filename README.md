# DocFinder
 
> Semantic search for your local PDF documents — fully private, no cloud, no costs.
 
DocFinder is a macOS desktop app that makes all your PDFs searchable using AI. Instead of searching for exact keywords, you can describe what you are looking for in natural language — DocFinder finds the right documents based on meaning.
 
---
 
## Features
 
- **Natural language search** — Search for "invoices related to my car" instead of exact filenames
- **Multiple source folders** — Add as many folders as you want, including all subfolders
- **Fully local & private** — No data ever leaves your machine. No cloud, no API costs
- **Persistent index** — Index your documents once, search anytime
- **Open directly** — Open found PDFs in Preview or reveal them in Finder

---
 
## How it works
 
DocFinder uses **semantic embeddings** to understand the meaning of your documents. Each PDF is split into chunks of text, which are converted into mathematical vectors by a local AI model. When you search, your query is converted into the same kind of vector and compared against all stored vectors — the closest matches are your results.
 
```
Indexing:   PDF → extract text → split into chunks → generate embeddings → store in LanceDB
Searching:  query → generate embedding → find similar vectors → return ranked results
```
 
Everything runs locally using [Ollama](https://ollama.com) and [LanceDB](https://lancedb.github.io/lancedb/).
 
---
 
## Prerequisites
 
Before running DocFinder, make sure you have the following installed:
 
- **Node.js** v18 or higher — [nodejs.org](https://nodejs.org)
- **Ollama** — [ollama.com](https://ollama.com)
After installing Ollama, pull the embedding model:
 
```bash
ollama pull nomic-embed-text
```
 
> DocFinder starts Ollama automatically when the app launches. You do not need to run `ollama serve` manually.
 
---
 
## Installation
 
### Run from source
 
```bash
# Clone the repository
git clone https://github.com/your-username/docfinder.git
cd docfinder
 
# Install dependencies
npm install
 
# Start the app in development mode
npm run dev
```
 
### Build for macOS
 
```bash
npm run build
```
 
The built `.app` file will be located in the `dist/` folder.
 
---
 
## Usage
 
1. **Add folders** — Click "Add folder" in the sidebar and select a folder containing PDFs. Repeat for as many folders as you want.
2. **Index your documents** — Click "Update index". DocFinder will process all PDFs and build the search index. This may take a few minutes depending on the number of documents.
3. **Search** — Type a natural language query in the search field and press Enter. DocFinder will return the most relevant documents.
4. **Open documents** — Click "Open" to open a PDF in Preview, or "Show in Finder" to reveal it in Finder.
> **Re-indexing:** When you add new documents to your folders, click "Update index" again. DocFinder only processes new or changed files — existing entries are kept.
 
---
 
## Tech Stack
 
| Layer | Technology |
|---|---|
| Desktop app | [Electron](https://www.electronjs.org) via [electron-vite](https://electron-vite.org) |
| UI | [React](https://react.dev) + [Tailwind CSS](https://tailwindcss.com) + TypeScript |
| PDF text extraction | [pdf-parse](https://www.npmjs.com/package/pdf-parse) |
| Embeddings | [Ollama](https://ollama.com) + [nomic-embed-text](https://huggingface.co/nomic-ai/nomic-embed-text-v1) |
| Vector database | [LanceDB](https://lancedb.github.io/lancedb/) |
| Settings persistence | [electron-store](https://github.com/sindresorhus/electron-store) |
 
---
 
## Project Structure
 
```
docfinder/
├── src/
│   ├── main/              # Electron Main Process (Node.js)
│   │   └── index.ts       # App lifecycle, IPC handlers, file system access
│   ├── renderer/          # React UI (Renderer Process)
│   │   ├── App.tsx
│   │   └── index.tsx
│   └── shared/            # Shared types used by both processes
│       └── types.ts
├── docs/                  # Screenshots and documentation assets
├── package.json
├── tsconfig.json
└── tailwind.config.js
```
 
---
 
## Development
 
### Branching strategy
 
Each user story is developed in its own feature branch:
 
```bash
git checkout -b feature/us-01-setup
```
 
Branches are merged into `main` via pull requests once all acceptance criteria are met.
 
### Available scripts
 
| Script | Description |
|---|---|
| `npm run dev` | Start app in development mode with hot reload |
| `npm run build` | Build production `.app` for macOS |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checker |
 
---
 
## Roadmap
 
### Version 1 – MVP (current)
- [x] Folder management with persistent storage
- [x] PDF indexing with progress tracking
- [x] Semantic search with result cards
- [x] Open documents directly from results
### Version 2 – Chat / RAG
- [ ] Ask questions in natural language about your documents
- [ ] AI answers based on document content (RAG pipeline)
- [ ] Source references in answers ("from document X, page 3")
---
 
## Known limitations
 
- **Scanned PDFs** — DocFinder can only search PDFs that contain embedded text. Scanned image-only PDFs are not supported in the current version (OCR support planned).
- **macOS only** — The current build targets macOS. Windows and Linux support is not planned at this time.
- **Ollama required** — DocFinder requires Ollama to be installed. The app will guide you through installation if it is not detected.
---
 
## Contributing
 
This is a learning project. Contributions, suggestions and feedback are welcome.
 
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Open a pull request
---
 
## License
 
MIT License — see [LICENSE](LICENSE) for details.
