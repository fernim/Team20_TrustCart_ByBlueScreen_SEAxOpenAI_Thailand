const { defineConfig } = require('@playwright/test');
const path = require('node:path');
const python = path.resolve(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const hosted = Boolean(process.env.TRUSTCART_BASE_URL);
const localPassword = hosted ? undefined : (process.env.TRUSTCART_LOCAL_TEST_PASSWORD ||= require('node:crypto').randomBytes(24).toString('hex'));
const reviewerPassword = process.env.TRUSTCART_REVIEWER_PASSWORD;
const hostedPassword = reviewerPassword || process.env.TRUSTCART_DEMO_PASSWORD;
if (hosted && !hostedPassword) throw new Error('A demo or reviewer password is required for hosted tests');
module.exports = defineConfig({
  testDir: './tests/browser',
  testMatch: hosted ? ['**/ui.spec.cjs', '**/hosted.spec.cjs'] : '**/ui.spec.cjs',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.TRUSTCART_BASE_URL || 'http://127.0.0.1:8766',
    httpCredentials: hosted ? { username: reviewerPassword ? 'reviewer' : 'demo', password: hostedPassword } : { username: 'demo', password: localPassword },
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
    url: 'http://127.0.0.1:8766/version',
    env: { TRUSTCART_DATABASE_URL: '', SUPABASE_URL: '', TRUSTCART_AI_TRANSFER_APPROVED: '', TRUSTCART_REVIEWER_PASSWORD: '', TRUSTCART_DEMO_PASSWORD: localPassword },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
