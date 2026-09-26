import { expect, test, type Page } from "@playwright/test";
import { signIn, USERS } from "./support/session";

/**
 * Frontend backlog v4 regressions: single-locale UI, global table density, column
 * checkbox state, column alignment contract, scenario step order and forecast lineage.
 */

const AFFECTED = [
  "/overview",
  "/forecasting/runs",
  "/forecasting/runs/new",
  "/forecasting/explorer",
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

/** Known UI phrases per language. Entity data (product, run, model, person names) is not UI copy. */
const INDONESIAN_UI = ["Perlu Ditinjau", "Kerapatan", "Nyaman", "Padat", "Penanggung jawab", "Proses Perkiraan", "Pengaturan", "Lihat semua", "Hapus filter", "Ciutkan", "Belum ada", "Terakhir diperbarui"];
const ENGLISH_UI = ["Needs attention", "Forecast runs", "Open exceptions", "Previous run", "View all", "Clear filters", "Columns", "Collapse", "Created by", "Last updated", "Forecast health", "Show details"];

async function visibleText(page: Page) {
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForLoadState("networkidle");
  return page.locator("body").innerText();
}

test.describe("single locale at a time (I18N §169)", () => {
  for (const path of AFFECTED) {
    test(`English UI has no Indonesian copy · ${path}`, async ({ page }) => {
      await signIn(page, USERS.planner, undefined, "en");
      await page.goto(path);
      const text = await visibleText(page);
      for (const phrase of INDONESIAN_UI) expect(text, `"${phrase}" on ${path}`).not.toContain(phrase);
    });

    test(`Indonesian UI has no English copy · ${path}`, async ({ page }) => {
      await signIn(page, USERS.planner, undefined, "id");
      await page.goto(path);
      const text = await visibleText(page);
      for (const phrase of ENGLISH_UI) expect(text, `"${phrase}" on ${path}`).not.toContain(phrase);
    });
  }
});

test.describe("table density is a global preference (DENSITY-001…004)", () => {
  test("tables default to compact rows and never offer their own density toggle", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.goto("/forecasting/runs");
    const row = page.locator('[role="rowgroup"] [role="row"][data-row]').first();
    await expect(row).toBeVisible();
    expect((await row.boundingBox())?.height).toBeCloseTo(42, 0);
    await expect(page.getByRole("group", { name: /row density/i })).toHaveCount(0);
    await expect(page.getByText(/^Comfortable$|^Compact$/)).toHaveCount(0);
  });

  test("Settings › Table density changes every table", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.goto("/administration/settings/appearance");
    await page.getByRole("radio", { name: /Comfortable/ }).click();
    await page.goto("/demand-data/quality");
    const row = page.locator('[role="rowgroup"] [role="row"][data-row]').first();
    await expect(row).toBeVisible();
    expect((await row.boundingBox())?.height).toBeCloseTo(54, 0);
  });
});

test("columns menu shows checked columns with a filled box and keeps the state (COLUMNS-CHECK-001)", async ({ page }) => {
  await signIn(page, USERS.admin, undefined, "en");
  await page.goto("/planning/exceptions");
  await page.getByRole("button", { name: "Choose columns" }).click();
  const item = page.getByRole("menuitemcheckbox").first();
  const box = item.locator("span[aria-hidden]").first();
  await expect(item).toHaveAttribute("aria-checked", "true");
  const checkedBg = await box.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(checkedBg).not.toBe("rgb(255, 255, 255)");

  await item.click();
  await expect(item).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => box.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Choose columns" }).click();
  await expect(page.getByRole("menuitemcheckbox").first()).toHaveAttribute("aria-checked", "false");
  await page.getByRole("menuitemcheckbox").first().press("Space");
  await expect(page.getByRole("menuitemcheckbox").first()).toHaveAttribute("aria-checked", "true");
});

test.describe("column alignment contract (TABLE-ALIGN-001)", () => {
  async function leftEdges(page: Page, header: string) {
    const headers = page.getByRole("columnheader");
    const count = await headers.count();
    for (let i = 0; i < count; i++) {
      if ((await headers.nth(i).innerText()).trim() === header) {
        const h = headers.nth(i);
        const cell = page.locator('[role="rowgroup"] [role="row"][data-row]').first().getByRole("cell").nth(i);
        const hText = await h.locator("span, button").first().boundingBox();
        const cText = await cell.evaluate((el) => {
          const r = document.createRange();
          r.selectNodeContents(el);
          return r.getBoundingClientRect().left;
        });
        return { header: hText?.x ?? -1, cell: cText };
      }
    }
    throw new Error(`column ${header} not found`);
  }

  test("Forecast runs · Horizon shares the left text axis", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/forecasting/runs");
    await page.locator('[role="rowgroup"] [role="row"][data-row]').first().waitFor();
    const e = await leftEdges(page, "Horizon");
    expect(Math.abs(e.header - e.cell)).toBeLessThanOrEqual(2);
  });

  test("Data quality · SKUs affected shares the left text axis", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demand-data/quality");
    await page.locator('[role="rowgroup"] [role="row"][data-row]').first().waitFor();
    const e = await leftEdges(page, "SKUs affected");
    expect(Math.abs(e.header - e.cell)).toBeLessThanOrEqual(2);
  });
});

test("scenario builder stacks Step 3 below Step 2 in one column (PAGE-SCENARIO-001)", async ({ page }) => {
  await signIn(page, USERS.planner, undefined, "en");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/scenarios/new");
  const s2 = await page.getByRole("heading", { name: "2. Assumptions" }).boundingBox();
  const s3 = await page.getByRole("heading", { name: "3. Simulate and review impact" }).boundingBox();
  expect(s2 && s3).toBeTruthy();
  expect(s3!.y).toBeGreaterThan(s2!.y);
  expect(Math.abs(s3!.x - s2!.x)).toBeLessThanOrEqual(2);
  await expect(page.getByRole("button", { name: "Run simulation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save scenario" })).toBeVisible();
});

test("forecast lineage is anchored to one forecast and names every stage (PAGE-LINEAGE-001)", async ({ page }) => {
  await signIn(page, USERS.planner, undefined, "en");
  await page.goto("/forecasting/lineage");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Forecast lineage");
  await expect(page.getByText("How this forecast was produced", { exact: false })).toBeVisible();
  for (const stage of ["Demand data", "Data readiness", "Forecast model", "Forecast run", "Forecast baseline", "Scenario", "Planning decision", "Approval", "Published plan", "Activity"]) {
    await expect(page.getByRole("list", { name: "Forecast lineage" }).getByText(stage, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /^FR-/ }).first()).toBeVisible();
});

test("overview forecast health uses four compact cards of equal height (PAGE-OVERVIEW-HEALTH-001)", async ({ page }) => {
  await signIn(page, USERS.planner, undefined, "en");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/overview");
  const section = page.locator("#health");
  await expect(section.getByRole("heading", { name: "Forecast health" })).toBeVisible();
  const cards = section.locator("a, div.min-h-44").filter({ has: page.locator(".numeric-xl") });
  await expect(cards).toHaveCount(4);
  const heights = await cards.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  // No inline CTA rows inside the cards: the whole card is the link.
  await expect(section.getByText(/→$/)).toHaveCount(0);
});
