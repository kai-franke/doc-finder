## ADDED Requirements

### Requirement: Two-panel layout
The app SHALL render a two-panel layout with a fixed-width sidebar on the left and a flexible main content area on the right. The layout SHALL fill the entire window without scrollbars at the top level.

#### Scenario: Sidebar and main area are both visible
- **WHEN** the app window opens
- **THEN** a sidebar panel is visible on the left and a main content panel is visible on the right

#### Scenario: Main area fills remaining width
- **WHEN** the window is resized to any standard desktop size (≥1024px wide)
- **THEN** the sidebar retains its fixed width and the main area expands or contracts to fill the remaining space

### Requirement: macOS frameless window with traffic lights
The Electron window SHALL use `titleBarStyle: 'hiddenInset'` so that macOS traffic light buttons (close, minimize, zoom) are displayed in their native position without a visible OS title bar.

#### Scenario: Traffic lights visible on launch
- **WHEN** the app launches on macOS
- **THEN** the red/yellow/green traffic light buttons are visible in the top-left corner of the window

#### Scenario: Traffic lights functional
- **WHEN** the user clicks a traffic light button
- **THEN** the corresponding window action (close / minimize / zoom) is performed

### Requirement: Draggable title bar region
The top area of the app (spanning the width of the sidebar at minimum) SHALL be marked as a window drag region so the user can reposition the window by dragging that area.

#### Scenario: Window can be dragged from the top strip
- **WHEN** the user clicks and drags the top area of the sidebar
- **THEN** the window moves with the pointer

#### Scenario: Interactive elements inside drag region are still clickable
- **WHEN** an interactive element (button, link) is placed inside the drag region
- **THEN** clicking that element triggers its action and does not drag the window

### Requirement: Sidebar placeholder sections
The sidebar SHALL contain three labeled placeholder sections for future features: folder list, index status, and Ollama status indicator.

#### Scenario: Folder list placeholder is visible
- **WHEN** the app renders
- **THEN** a placeholder area for the folder list is visible in the sidebar

#### Scenario: Index status placeholder is visible
- **WHEN** the app renders
- **THEN** a placeholder area for index status is visible in the sidebar

#### Scenario: Ollama status placeholder is visible
- **WHEN** the app renders
- **THEN** a placeholder area for the Ollama status indicator is visible in the sidebar

### Requirement: Main area placeholder sections
The main content area SHALL contain two labeled placeholder sections for future features: search field and search results.

#### Scenario: Search field placeholder is visible
- **WHEN** the app renders
- **THEN** a placeholder area for the search field is visible in the main area

#### Scenario: Search results placeholder is visible
- **WHEN** the app renders
- **THEN** a placeholder area for search results is visible in the main area

### Requirement: Layout stability
The two-panel layout SHALL remain stable (no overflow, no collapsed panels, no layout shift) across typical desktop window sizes.

#### Scenario: Layout holds at minimum window size
- **WHEN** the window is resized to 1024×768
- **THEN** both panels are still fully visible and no content overflows the window
