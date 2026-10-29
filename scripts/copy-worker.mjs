import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const source = resolve('dist/worker/index.js')
const target = resolve('dist/_worker.js')

if (!existsSync(source)) {
  throw new Error('Compiled Pages Functions worker not found at dist/worker/index.js')
}

copyFileSync(source, target)
rmSync(dirname(source), { recursive: true, force: true })
console.log('Copied compiled Pages Functions worker to dist/_worker.js')
