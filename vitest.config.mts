import { fileURLToPath } from 'node:url'

import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  // Mirrors the `@/*` path in tsconfig.json without pulling in a plugin for it.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    env: loadEnv(mode, process.cwd(), ''),
    // The DB tests hold row locks on shared fixtures; parallel files would race.
    fileParallelism: false,
  },
}))
