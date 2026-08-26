import { defineConfig, devices } from '@playwright/test';

// Runs against real backend + frontend dev servers (see webServer below),
// not mocks — these are the flows that survive a full page reload, a real
// JWT round-trip, and a real SQLite DB, none of which Vitest's mocked
// component tests exercise. Chat is deliberately out of scope: every path
// through it calls embed_query()/embed_texts() (see app/ml.py), which
// requires a real HF_TOKEN — something CI doesn't have and shouldn't need
// just to prove the rest of the app works.
export default defineConfig({
  testDir: './e2e',
  // Tests share the seeded demo accounts (see backend/seed.py) and a
  // single SQLite file — running them concurrently would race on that
  // shared state (two tests logging in/out of the same account, etc.).
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'flask db upgrade && python seed.py && python run.py',
      cwd: '../backend',
      env: { FLASK_APP: 'run.py', RATELIMIT_ENABLED: 'false' },
      url: 'http://localhost:5101/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
