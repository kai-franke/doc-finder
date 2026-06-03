## 1. Branch Setup

- [x] 1.1 Create and check out feature branch `feature/02-sidebar-layout` from `main`

## 2. Electron Window Configuration

- [x] 2.1 Update `BrowserWindow` options in `src/main/index.ts` to use `titleBarStyle: 'hiddenInset'` and set a sensible default window size (e.g. 1280×800, min 1024×768)

## 3. AppShell & TitleBar Components

- [x] 3.1 Create `src/renderer/components/AppShell.tsx` — `flex flex-col h-screen overflow-hidden` wrapping TitleBar + Body (a `flex flex-1 overflow-hidden` row)
- [x] 3.2 Create `src/renderer/components/TitleBar.tsx` — 38px full-width bar with sidebar background color, `[app-region:drag]`, traffic light dots on the left, and centered "DocFinder" label

## 4. Sidebar Component

- [x] 4.1 Create `src/renderer/components/Sidebar.tsx` — fixed-width (`w-60`) left panel with `flex flex-col`
- [x] 4.2 Add a placeholder section for the folder list (labeled `"Folders"`)
- [x] 4.3 Add a placeholder section for index status (labeled `"Index Status"`)
- [x] 4.4 Add a placeholder section for Ollama status (labeled `"Ollama"`)

## 5. MainArea Component

- [x] 5.1 Create `src/renderer/components/MainArea.tsx` — `flex-1` right panel with `flex flex-col`
- [x] 5.2 Add a placeholder section for the search field (labeled `"Search"`)
- [x] 5.3 Add a placeholder section for search results (labeled `"Results"`)

## 6. Wire Up & Style

- [x] 6.1 Replace the current `App.tsx` content with `<AppShell />` containing `<Sidebar />` and `<MainArea />`
- [x] 6.2 Apply Tailwind styles to match the mockup (colors, sidebar background, borders, spacing) — note: mockup labels are in German; all rendered text must be in English
- [x] 6.3 Verify layout is stable at 1024×768 and at larger sizes (manual resize test)
- [x] 6.4 Verify traffic lights are visible and functional on macOS
- [x] 6.5 Verify the drag region allows repositioning the window

## 7. Merge

- [ ] 7.1 Open a PR from `feature/02-sidebar-layout` into `main` and request a review from `kai-franke` — merging will be done manually after code review
