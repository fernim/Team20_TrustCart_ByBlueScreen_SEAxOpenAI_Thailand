const { defineConfig } = require("@playwright/test");
const { randomBytes } = require("node:crypto");
const hosted = Boolean(process.env.TRUSTCART_BASE_URL);
for (const role of ["BUYER", "SELLER1", "SELLER2", "REVIEWER"]) {
  const key = "TRUSTCART_" + role + "_PASSWORD";
  if (hosted && !process.env[key])
    throw Error(key + " is required for hosted role tests");
  if (!hosted) process.env[key] ||= randomBytes(24).toString("hex");
}
module.exports = defineConfig({
  testDir: "./tests/browser",
  testMatch: ["connected.spec.cjs", "ui.spec.cjs", "hosted.spec.cjs"],
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
      },
});
