import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  ...(process.env.PLAYWRIGHT_BASE_URL ? {} : {
    webServer: {
      command: `npm run dev -- --port ${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
      url: `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3100"}`,
      reuseExistingServer: false,
      env: { LIFEPOT_E2E: "1" },
      timeout: 120_000,
    },
  }),
});
