const { defineConfig } = require('@playwright/test');
const python = process.platform === 'win32' ? '.venv/Scripts/python' : '.venv/bin/python';
module.exports = defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8766',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `${python} tests/browser/serve.py`,
    url: 'http://127.0.0.1:8766/v1/products',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
