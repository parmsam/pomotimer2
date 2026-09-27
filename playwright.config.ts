import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;
/** Production build + preview, for things only the built app has (service worker). */
const PREVIEW_PORT = 4181;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/pomotimer2/`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /pwa\.spec/ },
    // WebKit catches Safari-only rendering issues (e.g. SVG transform quirks).
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /pwa\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /pwa\.spec/ },
    {
      name: 'pwa',
      testMatch: /pwa\.spec/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}/pomotimer2/` },
    },
  ],
  webServer: [
    {
      command: `npx vite --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/pomotimer2/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite build --logLevel warn && npx vite preview --port ${PREVIEW_PORT} --strictPort`,
      url: `http://localhost:${PREVIEW_PORT}/pomotimer2/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
