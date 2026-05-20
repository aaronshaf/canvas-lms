import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', {outputFolder: 'playwright-report'}],
    ['junit', {outputFile: 'playwright-junit.xml'}],
  ],
  use: {
    baseURL: 'http://localhost:4444',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
  ],
  webServer: {
    command: 'yarn harness:dev',
    url: 'http://localhost:4444',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
