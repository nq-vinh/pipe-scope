import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4300';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  passWithNoTests: true,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node serve-dist.mjs',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
