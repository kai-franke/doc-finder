export function friendlyRendererError(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message.trim()) return fallback
  const remoteMarker = ': Error: '
  const remoteErrorIndex = error.message.lastIndexOf(remoteMarker)
  if (remoteErrorIndex >= 0) return error.message.slice(remoteErrorIndex + remoteMarker.length)
  return error.message
}
