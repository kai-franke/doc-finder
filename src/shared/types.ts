export type SourceFolder = {
  path: string;
  label: string;
  pdfCount: number;
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