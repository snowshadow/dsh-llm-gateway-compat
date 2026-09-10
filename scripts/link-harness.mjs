#!/usr/bin/env node
/**
 * Point this plugin's @deepseek-ai packages at a sibling deepseek-harness
 * checkout so typecheck/tests see 0.1.5-rc.1 APIs. No-op when the sibling
 * is absent (GitHub consumers use the committed lib/).
 */
import { lstat, mkdir, rm, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const harness = join(root, '..', 'deepseek-harness')
const destDir = join(root, 'node_modules', '@deepseek-ai')

const links = {
  cordis: join(harness, 'vendor', 'cordis'),
  'dsh-llm': join(harness, 'packages', 'llm', 'llm'),
  'dsh-settings': join(harness, 'packages', 'settings', 'settings'),
}

try {
  await lstat(join(harness, 'package.json'))
} catch {
  process.exit(0)
}

await mkdir(destDir, { recursive: true })
for (const [name, target] of Object.entries(links)) {
  const dest = join(destDir, name)
  await rm(dest, { recursive: true, force: true })
  await symlink(target, dest)
}
