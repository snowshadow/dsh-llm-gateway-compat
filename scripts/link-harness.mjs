#!/usr/bin/env node
/**
 * Point this plugin's @deepseek-ai packages at a sibling deepseek-harness
 * checkout so typecheck/tests see 0.2.1-alpha.2 APIs. `DSH_HARNESS` overrides
 * the sibling path. No-op when that checkout is absent.
 */
import { lstat, mkdir, rm, symlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const harness = process.env.DSH_HARNESS ?? join(root, '..', 'deepseek-harness')
const destDir = join(root, 'node_modules', '@deepseek-ai')

const links = {
  cordis: join(harness, 'vendor', 'cordis'),
  schemastery: join(harness, 'vendor', 'schemastery'),
  'dsh-llm': join(harness, 'packages', 'llm', 'llm'),
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
