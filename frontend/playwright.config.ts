import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// The backend's E2E database. The delete and DATABASE_PATH must name the same file,
// so both use this absolute path. A relative path would resolve from each command's cwd.
const e2eDb = fileURLToPath(new URL('../backend/data/e2e.db', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 375, height: 667 },
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 375, height: 667 },
      },
    },
  ],
  webServer: [
    {
      // Start from an empty DB. This runs only when Playwright starts the server, not when it reuses one.
      command: `rm -f "${e2eDb}" "${e2eDb}-wal" "${e2eDb}-shm" && PORT=3100 DATABASE_PATH="${e2eDb}" npm run dev --prefix ../backend`,
      url: 'http://localhost:3100/api/auth/me', // Check if API is up
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'VITE_API_TARGET=http://localhost:3100 npm run dev --prefix .',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
