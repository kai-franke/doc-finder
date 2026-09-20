import assert from 'node:assert/strict'
import path from 'node:path'
import { listPackage, statFile } from '@electron/asar'

const archivePath = path.resolve(
  'release/1.0.0/mac-arm64/DocFinder.app/Contents/Resources/app.asar',
)
const workerPath = 'dist-electron/pdf.worker.mjs'
const entries = listPackage(archivePath)

assert(
  entries.includes(`/${workerPath}`),
  `Production bundle is missing ${workerPath}`,
)

const worker = statFile(archivePath, workerPath)
assert(worker.size > 1_000_000, `Production PDF worker is unexpectedly small: ${worker.size} bytes`)

console.log(`Verified packaged PDF worker (${worker.size} bytes)`)
