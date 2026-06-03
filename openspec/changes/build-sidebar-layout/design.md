## Context

The app is an Electron + React + Tailwind CSS project. The current window is created with default `BrowserWindow` options — it has a standard OS title bar and no layout components. This change introduces the visual shell all future features will inhabit.

The target look is macOS-native: traffic lights visible, no default title bar chrome, window draggable from a custom header region.

## Goals / Non-Goals

**Goals:**
- Frameless Electron window with macOS traffic lights integrated via `titleBarStyle: 'hiddenInset'`
- Two-panel layout (sidebar left, main content right) via Tailwind flex
- Window drag region covering the top strip of the app
- Placeholder sections in sidebar and main area so future features have a clear slot to fill
- Stable layout across typical desktop window sizes (1024×768 and up)

**Non-Goals:**
- Any interactive functionality (clicks, navigation, state)
- Actual folder list, search results, or status data
- Custom traffic light positioning or custom close/minimize/zoom buttons
- Responsive/mobile breakpoints

## Decisions

### Use `titleBarStyle: 'hiddenInset'` (not `frame: false`)

`hiddenInset` keeps macOS traffic lights visible and correctly positioned in the top-left, while hiding the OS title bar text and chrome. `frame: false` would remove traffic lights entirely, requiring us to reimplement them — unnecessary complexity.

**Alternative considered:** `titleBarStyle: 'hidden'` — traffic lights overlap content without inset; harder to position sidebar content around them.

### Drag region via CSS `-webkit-app-region: drag`

The mockup shows a **full-width title bar** (38px, `background: #ececec`) spanning both sidebar and main columns, above the two-panel body. This bar carries `-webkit-app-region: drag` and renders the traffic lights (left) and centered "DocFinder" label. It is NOT part of the sidebar column. Interactive children explicitly set `app-region: no-drag`.

In React + Tailwind: use the arbitrary value `[app-region:drag]` on the title bar div. For the `no-drag` children: `[app-region:no-drag]`.

**Alternative considered:** Electron's `setTitleBarOverlay` — only relevant for Windows; macOS handles this via CSS.

### Layout: Tailwind CSS flex, no grid

The two-panel layout (`flex h-screen`) is straightforward with Tailwind. The sidebar has a fixed width (`w-60`); the main area grows to fill (`flex-1`). No CSS grid needed for this static shell.

### Component structure

```
App
└── AppShell  (flex-col, h-screen)
    ├── TitleBar  (38px, full-width, drag region, sidebar-bg color, traffic lights + centered title)
    └── Body  (flex, flex-1, overflow-hidden)
        ├── Sidebar  (w-60, flex-col)
        │   ├── FolderListPlaceholder
        │   ├── IndexStatusPlaceholder
        │   └── OllamaStatusPlaceholder
        └── MainArea  (flex-1, flex-col)
            ├── SearchFieldPlaceholder
            └── SearchResultsPlaceholder
```

Each placeholder is a simple `<div>` with a label — no props, no state.

## Risks / Trade-offs

- **`titleBarStyle` on non-macOS**: `hiddenInset` is macOS-specific. On Windows/Linux the window will fall back to a standard title bar. Acceptable since the app targets macOS. → No mitigation needed for now; issue #13 (production build) can address cross-platform polish.
- **Drag region swallowing clicks**: Any interactive element inside a drag-marked ancestor must explicitly set `app-region: no-drag` or it won't respond to clicks. → Each placeholder section that will later contain interactive content must remember to add this. Document in code comments on the drag div.
