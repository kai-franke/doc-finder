import { promises as fs } from 'node:fs'
import path from 'node:path'

export type LoggerOptions = {
  mirrorToConsole?: boolean
}

function errorDetails(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`
  return typeof error === 'string' ? error : JSON.stringify(error)
}

function contextDetails(context?: Readonly<Record<string, unknown>>): string {
  if (!context || Object.keys(context).length === 0) return ''
  try {
    return ` ${JSON.stringify(context)}`
  } catch {
    return ' {"context":"unavailable"}'
  }
}

export class AppLogger {
  readonly filePath: string
  private pending: Promise<void> = Promise.resolve()

  constructor(logDirectory: string, private readonly options: LoggerOptions = {}) {
    this.filePath = path.join(logDirectory, 'docfinder.log')
  }

  private enqueue(level: 'INFO' | 'ERROR', scope: string, message: string): void {
    const line = `${new Date().toISOString()} ${level} [${scope}] ${message}\n`
    this.pending = this.pending
      .then(async () => {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true })
        await fs.appendFile(this.filePath, line, 'utf8')
      })
      .catch((writeError) => {
        if (this.options.mirrorToConsole) console.error('Could not write DocFinder log:', writeError)
      })
    if (this.options.mirrorToConsole) {
      const output = level === 'ERROR' ? console.error : console.info
      output(line.trimEnd())
    }
  }

  info(scope: string, message: string): void {
    this.enqueue('INFO', scope, message)
  }

  error(scope: string, error: unknown, context?: Readonly<Record<string, unknown>>): void {
    this.enqueue('ERROR', scope, `${errorDetails(error)}${contextDetails(context)}`)
  }

  flush(): Promise<void> {
    return this.pending
  }
}

let logger: AppLogger | undefined

export function configureLogger(logDirectory: string, options: LoggerOptions = {}): AppLogger {
  logger = new AppLogger(logDirectory, options)
  return logger
}

export function logInfo(scope: string, message: string): void {
  logger?.info(scope, message)
}

export function logError(
  scope: string,
  error: unknown,
  context?: Readonly<Record<string, unknown>>,
): void {
  logger?.error(scope, error, context)
}

export function flushLogs(): Promise<void> {
  return logger?.flush() ?? Promise.resolve()
}
