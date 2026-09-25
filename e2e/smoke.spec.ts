import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./support/session";

/** Every route in the information architecture (backlog §7) must render for an admin. */
const PAGES = [
  "/overview",
  "/forecasting/runs",
  "/forecasting/explorer",
  "/forecasting/insights",
  "/forecasting/schedules",
  "/forecasting/lineage",
  "/demand-data/products",
  "/demand-data/historical",
  "/demand-data/quality",
  "/demand-data/sources",
  "/models",
  "/models/performance",
  "/models/backtesting",
  "/scenarios",
  "/scenarios/compare",
  "/planning",
  "/planning/exceptions",
  "/planning/approvals",
  "/monitoring",
  "/administration/audit",
  "/administration/users",
  "/administration/settings",
  "/onboarding",
];

test.describe("authenticated routes", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.admin);
  });

  for (const path of PAGES) {
    test(`${path} renders without an error state`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status() ?? 0).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(/could not be loaded/i)).toHaveCount(0);
    });
  }
});

test.describe("key workflows", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.admin);
  });

  test("forecast explorer opens a product without losing list context", async ({ page }) => {
    await page.goto("/forecasting/explorer");
    await expect(page.getByRole("heading", { name: "Perkiraan Permintaan" })).toBeVisible();
    await page.locator("[data-row]").first().click();
    // The selected entity is deep-linkable state, so the drawer survives a reload.
    await expect(page).toHaveURL(/[?&]id=prd_/);
  });

  test("forecast insights virtualises the movers table", async ({ page }) => {
    await page.goto("/forecasting/insights");
    await expect(page.getByRole("heading", { name: "Forecast insights" })).toBeVisible();
    const table = page.getByRole("table", { name: "Largest forecast movers" });
    await expect(table).toBeVisible();
    const rowCount = Number(await table.getAttribute("aria-rowcount"));
    expect(rowCount).toBeGreaterThan(60);
    // Only the visible window is mounted, so the DOM holds far fewer rows than the data.
    const mounted = await page.locator("[data-row]").count();
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(rowCount);
  });

  test("forecast run wizard starts on the scope step", async ({ page }) => {
    await page.goto("/forecasting/runs/new");
    await expect(page.getByRole("heading", { name: "Create forecast run" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Define scope" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Progress" })).toBeVisible();
  });
});
