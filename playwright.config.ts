import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and accessibility suite (FND-013, FND-014).
 *
 * Runs against a production build so the suite exercises what ships. The demo has no
 * backend: every screen runs on the in-browser mock, which is deterministic per
 * workspace seed, and the visual suite freezes the clock to keep snapshots stable.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Capped rather than left to CPU count: running every spec in parallel starves the
  // axe scans, which then exceed the per-test timeout on a loaded machine.
  workers: process.env.CI ? 2 : 4,
  timeout: 45_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/sign-in`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
