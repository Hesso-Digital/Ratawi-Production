import { defineConfig, devices } from '@playwright/test';

/**
 * Visual smoke tests for the reveal beats, using the venue-style approach from
 * design-3d/render.mjs: headless Chrome through ANGLE/SwiftShader so this runs
 * without a GPU. Uses the system Chrome already on this machine/CI image
 * (`channel: 'chrome'`) instead of downloading Playwright's own browsers, so
 * it works offline.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
    },
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1920, height: 1080 } } },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
