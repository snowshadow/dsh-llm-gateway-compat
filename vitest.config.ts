import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = dirname(fileURLToPath(import.meta.url))
const harness = resolve(root, '../deepseek-harness')

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-llm': resolve(harness, 'packages/llm/llm/lib/index.js'),
      '@deepseek-ai/dsh-settings': resolve(harness, 'packages/settings/settings/lib/index.js'),
    },
  },
  test: {
    include: ['tests/**/*.spec.ts'],
  },
})
