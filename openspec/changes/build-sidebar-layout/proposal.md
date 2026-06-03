## Why

The app currently has no shell UI — users have no visual structure to orient themselves within. The sidebar layout is the foundational chrome that all other features (folder management, search, status indicators) will live inside.

## What Changes

- Add a two-panel Electron window: fixed-width sidebar on the left, flexible main content area on the right
- Configure a frameless Electron window with a custom draggable title bar region to achieve macOS-native look (traffic lights integrated)
- Sidebar contains placeholder sections for: folder list, index status, and Ollama status indicator
- Main area contains placeholder sections for: search field and search results
- No interactive functionality — static layout only

## Capabilities

### New Capabilities

- `app-shell`: Top-level two-panel layout with frameless window, custom title bar, sidebar, and main content area

### Modified Capabilities

<!-- None — this is the first UI feature; no existing specs to update -->

## Impact

- `electron/main.ts` (or equivalent): window creation options (frameless, size, title bar style)
- New React components: `AppShell`, `Sidebar`, `MainArea`
- Tailwind CSS used for layout and styling
- No new npm dependencies expected
