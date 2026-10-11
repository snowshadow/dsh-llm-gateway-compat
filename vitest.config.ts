import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = dirname(fileURLToPath(import.meta.url))
const harness = process.env.DSH_HARNESS ?? resolve(root, '../deepseek-harness')

function runtime(path: string): string {
  const bundled = resolve(harness, path, 'lib/index.js')
  return existsSync(bundled) ? bundled : resolve(harness, path, 'lib/types/index.js')
}

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/cordis': runtime('vendor/cordis'),
      '@deepseek-ai/cosmokit': runtime('vendor/cosmokit'),
      '@deepseek-ai/schemastery': runtime('vendor/schemastery'),
      '@deepseek-ai/dsh-llm': resolve(harness, 'packages/llm/llm/src/index.ts'),
      '@deepseek-ai/dsh-brand': runtime('packages/util/brand'),
      '@deepseek-ai/dsh-util-values': runtime('packages/util/values'),
      '@deepseek-ai/dsh-util-crypto': runtime('packages/util/crypto'),
      '@deepseek-ai/dsh-timeout': runtime('packages/util/timeout'),
      '@deepseek-ai/dsh-typert-protocol': runtime('packages/typert/protocol'),
      '@deepseek-ai/dsh-attachment': runtime('packages/attachment/attachment'),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
  },
})
