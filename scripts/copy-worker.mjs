import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const source = resolve('.wrangler/functions-build/index.js')
const target = resolve('dist/_worker.js')

if (!existsSync(source)) throw new Error(`未找到 Pages Functions 构建结果：${source}`)
mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
