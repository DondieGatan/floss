import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    // e2e/ holds Playwright specs (playwright.config.js), not Vitest ones
    // — same *.spec.js naming, different test runner/API, so Vitest must
    // not try to pick them up too. Keep Vitest's own defaults (node_modules,
    // dist, etc.) rather than replacing them outright.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
