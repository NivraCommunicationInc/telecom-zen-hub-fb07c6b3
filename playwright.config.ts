import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Enable dev-only E2E bypasses inside the app (never active in production builds)
    // Force a deterministic port that matches baseURL/url.
    // Note: the workflow can override VITE_E2E_TEST_EMAIL via environment variables.
    command: `VITE_E2E_MODE=true VITE_E2E_TEST_EMAIL=${process.env.VITE_E2E_TEST_EMAIL || 'test@nivra-telecom.ca'} VITE_SUPABASE_URL=${process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'} VITE_SUPABASE_PUBLISHABLE_KEY=${process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2UiZXhwIjozMjUwMzY4MDAwMH0.placeholder'} npm run dev -- --port 8080`,
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
