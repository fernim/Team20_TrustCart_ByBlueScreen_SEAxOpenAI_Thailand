const { defineConfig } = require('@playwright/test');
const path = require('node:path');
const python = path.resolve(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const hosted = Boolean(process.env.TRUSTCART_BASE_URL);
if (hosted && !process.env.TRUSTCART_DEMO_PASSWORD) throw new Error('TRUSTCART_DEMO_PASSWORD is required for hosted tests');
module.exports = defineConfig({
  testDir: './tests/browser',
  testMatch: hosted ? ['**/ui.spec.cjs', '**/hosted.spec.cjs'] : '**/ui.spec.cjs',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.TRUSTCART_BASE_URL || 'http://127.0.0.1:8766',
    httpCredentials: hosted ? { username: 'demo', password: process.env.TRUSTCART_DEMO_PASSWORD } : undefined,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
    trace: hosted ? 'off' : 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: hosted ? undefined : {
    command: `"${python}" tests/browser/serve.py`,
    url: 'http://127.0.0.1:8766/v1/products',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
