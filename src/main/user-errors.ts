export type ErrorOperation =
  | 'file'
  | 'folder'
  | 'index'
  | 'pdf-parse'
  | 'scan'
  | 'search'
  | 'ollama'

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

function technicalMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function userMessage(error: unknown, operation: ErrorOperation): string {
  const code = errorCode(error)
  if (code === 'EACCES' || code === 'EPERM') {
    return operation === 'folder' || operation === 'scan'
      ? 'DocFinder does not have permission to read this folder.'
      : 'DocFinder does not have permission to read this file.'
  }
  if (code === 'ENOENT') return 'The file or folder is no longer available.'

  const message = technicalMessage(error).toLowerCase()
  if (
    message.includes('eacces') ||
    message.includes('eperm') ||
    message.includes('permission denied') ||
    message.includes('operation not permitted')
  ) {
    return operation === 'folder' || operation === 'scan'
      ? 'DocFinder does not have permission to read this folder.'
      : 'DocFinder does not have permission to read this file.'
  }
  if (operation === 'pdf-parse') {
    return 'This PDF could not be read. It may be damaged or password-protected.'
  }
  if (operation === 'ollama' || message.includes('ollama') || message.includes('embedding')) {
    return 'Ollama is not responding. Check that Ollama is running and try again.'
  }
  if (operation === 'search') return 'Search is temporarily unavailable. Please try again.'
  if (operation === 'scan' || operation === 'folder') {
    return 'This folder could not be scanned. Check that it is still available.'
  }
  if (operation === 'file') {
    return 'This PDF could not be read. Check that it is still available.'
  }
  return 'This document could not be added to the index. Please try again.'
}
