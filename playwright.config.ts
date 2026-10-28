import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const resultsDir = process.env.PLAYWRIGHT_RESULTS_DIR || 'test-results';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  outputDir: resultsDir + '/artifacts',
  reporter: [
    ['list'],
    ['html', { outputFolder: resultsDir + '/report', open: 'never' }],
    ['json', { outputFile: resultsDir + '/results.json' }],
  ],
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    reducedMotion: 'reduce',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
