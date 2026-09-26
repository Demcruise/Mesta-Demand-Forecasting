import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./support/session";

/**
 * FND-014 · visual regression. Snapshots must be deterministic, so the clock is frozen
 * and the timezone and locale are pinned: the mock backend anchors all data to "today"
 * and renders relative times, either of which would otherwise drift daily.
 *
 * Backlog v4 §170: every affected page at desktop width in English, the densest pages
 * across the responsive breakpoints, and a Bahasa Indonesia pass to catch layout breaks
 * caused by longer copy. The matrix is deliberately not the full cross product so the
 * baselines stay reviewable.
 *
 * Baselines are platform-specific. Generate or refresh them with:
 *   npm run test:e2e:update
 */

test.use({ timezoneId: "Asia/Jakarta", locale: "en-GB", colorScheme: "light" });

const PUBLIC_PAGES = ["/sign-in"];

/** Every page touched by backlog v4, at 1440 × 900 in English. */
const AFFECTED_PAGES = [
  "/overview",
  "/forecasting/runs",
  "/forecasting/runs/new",
  // 250 rows per page exercises the virtualised table at scale (PERF-001).
  "/forecasting/explorer?size=250",
  "/forecasting/insights",
  "/demand-data/quality",
  "/planning",
  "/scenarios/new",
  "/planning/exceptions",
  "/planning/approvals",
  "/monitoring",
  "/administration/audit",
  "/administration/users",
  "/forecasting/lineage",
  "/administration/settings/personal",
];

/** Metric-card and table-heavy pages across the responsive breakpoints. */
const RESPONSIVE_PAGES = ["/overview", "/forecasting/runs", "/demand-data/quality", "/planning", "/scenarios/new", "/forecasting/lineage"];
const RESPONSIVE_SIZES = [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

/** Longer Indonesian copy must not break card heights, badges or table headers. */
const INDONESIAN_PAGES = ["/overview", "/forecasting/insights", "/demand-data/quality", "/planning", "/planning/exceptions", "/forecasting/lineage"];

/** The audit log grows with events written during the session, so only the viewport is compared. */
const fullPageFor = (path: string) => path !== "/administration/audit";

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
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${slug(path)}.png`, { fullPage: true, animations: "disabled" });
    });
  }

  for (const path of AFFECTED_PAGES) {
    test(`${path} · 1440 · en matches its baseline`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await signIn(page, USERS.admin, undefined, "en");
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${slug(path)}-1440-en.png`, { fullPage: fullPageFor(path), animations: "disabled" });
    });
  }

  for (const size of RESPONSIVE_SIZES) {
    for (const path of RESPONSIVE_PAGES) {
      test(`${path} · ${size.width} · en matches its baseline`, async ({ page }) => {
        await page.setViewportSize(size);
        await signIn(page, USERS.admin, undefined, "en");
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.waitForLoadState("networkidle");
        await expect(page).toHaveScreenshot(`${slug(path)}-${size.width}-en.png`, { fullPage: true, animations: "disabled" });
      });
    }
  }

  for (const path of INDONESIAN_PAGES) {
    test(`${path} · 1440 · id matches its baseline`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await signIn(page, USERS.admin, undefined, "id");
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveScreenshot(`${slug(path)}-1440-id.png`, { fullPage: true, animations: "disabled" });
    });
  }
});
