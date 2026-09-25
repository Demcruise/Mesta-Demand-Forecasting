import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./support/session";

/**
 * FND-014 · visual regression. Snapshots must be deterministic, so the clock is frozen
 * and the timezone and locale are pinned: the mock backend anchors all data to "today"
 * and renders relative times, either of which would otherwise drift daily.
 *
 * Baselines are platform-specific. Generate or refresh them with:
 *   npm run test:e2e:update
 */

test.use({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Jakarta", locale: "en-GB", colorScheme: "light" });

const PUBLIC_PAGES = ["/sign-in"];
const AUTHENTICATED_PAGES = [
  "/overview",
  "/forecasting/insights",
  "/planning/exceptions",
  // 250 rows per page exercises the virtualised table at scale (PERF-001).
  "/forecasting/explorer?size=250",
];

const slug = (path: string) =>
  path
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "root";

test.describe("visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-25T09:00:00+07:00"));
  });

  for (const path of PUBLIC_PAGES) {
    test(`${path} matches its baseline`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${slug(path)}.png`, { fullPage: true, animations: "disabled" });
    });
  }

  for (const path of AUTHENTICATED_PAGES) {
    test(`${path} matches its baseline`, async ({ page }) => {
      await signIn(page, USERS.admin);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${slug(path)}.png`, { fullPage: true, animations: "disabled" });
    });
  }
});
