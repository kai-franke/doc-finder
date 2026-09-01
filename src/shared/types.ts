export type SourceFolder = {
  path: string;
  /**
   * Anzahl der PDFs, die im Hintergrund (inklusive aller Unterordner) gezählt
   * wird. `null` bedeutet: Die Zählung läuft noch – dann zeigt die Oberfläche
   * eine Lade-Anzeige. Der Wert wird gespeichert; eine unterbrochene Zählung
   * übersteht so einen Neustart und wird beim nächsten Start erneut durchgeführt.
   */
  pdfCount: number | null;
  label: string;
  /** Whether the folder is currently readable on disk. Computed on each list, never persisted. */
  accessible: boolean;
};

export type Chunk = {
  text: string;
  filePath: string;
  fileName: string;
  modifiedAt: number;
  chunkIndex: number;
  page?: number;
};

export type SearchResult = {
  filePath: string;
  fileName: string;
  folderPath: string;
  snippet: string;
  score: number;
};

export type ScanResult = {
  newFiles: string[];
  changedFiles: string[];
  deletedFiles: string[];
};

export type IndexingProgress = {
  current: number;
  total: number;
  fileName: string;
  percent: number;
};

export type IndexingError = {
  filePath: string;
  message: string;
};

export type IndexingResult = {
  indexed: number;
  deleted: number;
  errors: IndexingError[];
  aborted: boolean;
};

export type IndexStatus = {
  isScanning: boolean;
  isIndexing: boolean;
  scanResult: ScanResult;
  indexedDocuments: number;
  lastUpdated: number | null;
  progress: IndexingProgress | null;
};
