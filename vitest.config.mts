import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  test: {
    environment: 'node',
    env: loadEnv(mode, process.cwd(), ''),
    // The DB tests mutate shared campaign budgets; parallel files would race.
    fileParallelism: false,
  },
}))
