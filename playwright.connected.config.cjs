const { defineConfig } = require("@playwright/test");
const { randomBytes } = require("node:crypto");
const hosted = Boolean(process.env.TRUSTCART_BASE_URL);
if (!hosted) process.env.TRUSTCART_DEMO_PASSWORD = randomBytes(24).toString("hex");
module.exports = defineConfig({
  testDir: "./tests/browser",
  testMatch: ["connected.spec.cjs", "ui.spec.cjs", "hosted.spec.cjs", "agency.spec.cjs", "workspace.spec.cjs", "seller-refresh.spec.cjs", "submit-review.spec.cjs"],
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.TRUSTCART_BASE_URL || "http://127.0.0.1:8768",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: hosted
    ? undefined
    : {
        command:
          (process.platform === "win32"
            ? ".venv/Scripts/python.exe"
            : ".venv/bin/python") + " tests/browser/serve_connected.py",
        url: "http://127.0.0.1:8768/",
        reuseExistingServer: false,
        env: { TRUSTCART_DATABASE_URL: "", SUPABASE_URL: "", TRUSTCART_AI_TRANSFER_APPROVED: "" },
      },
});
