# Error handling and logs

DocFinder keeps user-facing errors short and actionable. Technical details, stack traces, and affected file paths are written to `docfinder.log` below Electron's `userData/logs` directory instead of being shown in the interface.

The Main Process translates permission, missing-file, PDF parser, Ollama, search, and index failures at the IPC boundary. A failure for one PDF is isolated so indexing can continue with the remaining documents. Empty PDFs are retained in the manifest with zero chunks and do not fail an indexing run.

Production builds do not mirror logs to the console. Development builds do, which keeps local debugging convenient. Loading, result, and empty states use short transitions; the `prefers-reduced-motion` operating-system setting reduces them to effectively zero duration.

The automated large-folder regression test processes 500 PDFs with bounded concurrency to guard against unbounded memory growth and UI-blocking batch behavior.
