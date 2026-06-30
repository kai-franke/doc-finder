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