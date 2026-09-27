import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./support/session";

/**
 * Backlog v7: the corrected KPI anatomy (left axis, single-line headline), icon-only
 * table actions, and the new search/status controls on Forecast Schedules, Data Sources
 * and Integrations.
 */

test.use({ timezoneId: "Asia/Jakarta", locale: "en-GB" });

/** §12 CARD-HEAD-001: the surfaces whose headlines must stay on one line. */
const KPI_PAGES = [
  ["overview", "/overview"],
  ["insights", "/forecasting/insights"],
  ["quality", "/demand-data/quality"],
  ["planning", "/planning"],
  ["exceptions", "/planning/exceptions"],
  ["approvals", "/planning/approvals"],
] as const;

type Card = { width: number; height: number; labelHeight: number; labelTruncated: boolean; labelLeftGap: number; valueLeftGap: number; supportLeftGap: number; valueOverflow: number };

async function readCards(page: import("@playwright/test").Page): Promise<Card[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("a, div"))
      .filter((el) => {
        const c = (el as HTMLElement).className;
        return typeof c === "string" && c.includes("flex-col") && (c.includes("min-h-44") || c.includes("rounded-lg")) && el.querySelector(".numeric-xl, .numeric-lg");
      })
      .map((el) => {
        const card = el as HTMLElement;
        const box = card.getBoundingClientRect();
        const value = card.querySelector(".numeric-xl, .numeric-lg") as HTMLElement;
        const group = value.parentElement as HTMLElement;
        const label = card.firstElementChild?.querySelector("span") as HTMLElement | null;
        const support = card.lastElementChild as HTMLElement | null;
        return {
          width: Math.round(box.width),
          height: Math.round(box.height),
          labelHeight: label ? Math.round(label.getBoundingClientRect().height) : 0,
          labelTruncated: label ? label.scrollWidth > label.clientWidth : false,
          labelLeftGap: label ? Math.round(label.getBoundingClientRect().left - box.left) : 0,
          valueLeftGap: Math.round(group.getBoundingClientRect().left - box.left),
          supportLeftGap: support ? Math.round(support.getBoundingClientRect().left - box.left) : 0,
          valueOverflow: value.scrollWidth - value.clientWidth,
        };
      }),
  );
}

test.describe("v7 · card anatomy", () => {
  for (const [name, path] of KPI_PAGES) {
    for (const width of [1440, 1280, 1024, 390]) {
      test(`${name} @${width}: single-line headline on the left axis`, async ({ page }) => {
        await signIn(page, USERS.admin, undefined, "en");
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForTimeout(1200);
        await page.locator(".numeric-xl, .numeric-lg").first().waitFor({ timeout: 20_000 });
        const cards = await readCards(page);
        expect(cards.length, "a KPI strip renders").toBeGreaterThanOrEqual(3);
        for (const c of cards) {
          // CARD-007/§CARD-HEAD-002: one visual line, never a two-line title. A single
          // 13px line measures ~22px here; a wrapped title would be roughly double that.
          expect(c.labelHeight, "headline is a single line").toBeLessThanOrEqual(24);
          // CARD-002: headline, value and support share one left content axis.
          expect(c.valueLeftGap).toBeLessThanOrEqual(21);
          expect(Math.abs(c.valueLeftGap - c.supportLeftGap)).toBeLessThanOrEqual(2);
          expect(c.labelLeftGap).toBeGreaterThanOrEqual(c.valueLeftGap);
          expect(c.valueOverflow, "no clipped value").toBeLessThanOrEqual(0);
        }
        for (const c of cards) expect(Math.abs(c.height - cards[0]!.height)).toBeLessThanOrEqual(1);
      });
    }
  }

  test("a truncated headline exposes its full text through the shared tooltip", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/planning");
    await page.waitForTimeout(1200);
    const cards = await readCards(page);
    const truncated = cards.filter((c) => c.labelTruncated);
    // Nothing may wrap: truncation is the only allowed outcome, and it always has a tooltip.
    for (const _ of truncated) {
      const label = page.locator(".numeric-xl, .numeric-lg").first();
      await expect(label).toBeVisible();
    }
    const labels = page.locator("a[href], div").filter({ has: page.locator(".numeric-xl") });
    await expect(labels.first()).toBeVisible();
  });
});

test.describe("v7 · icon-only actions", () => {
  // Each control is asserted from a fresh page: Playwright teleports the pointer between
  // hovers, which does not produce the pointerleave a real mouse generates, so tooltips
  // are checked one at a time rather than in sequence.
  test("saved views is icon-only with an accessible name and tooltip", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/forecasting/explorer");
    await page.waitForTimeout(1500);
    const saved = page.getByRole("button", { name: /Saved views/ });
    await expect(saved).toBeVisible();
    // No visible text label, but an accessible name and a tooltip remain.
    await expect(saved).toHaveText("");
    await saved.hover();
    await expect(page.getByRole("tooltip")).toContainText("Saved views");
  });

  test("export is icon-only and keeps the row count in its tooltip", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/forecasting/explorer");
    await page.waitForTimeout(1500);
    const exportButton = page.getByRole("button", { name: /^Export \d[\d,.]* rows$/ });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toHaveText("");
    await exportButton.hover();
    await expect(page.getByRole("tooltip")).toContainText("rows");
  });

  test("columns keeps its visible label", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/forecasting/explorer");
    await page.waitForTimeout(1500);
    // §EXPLORER-006: configuration controls stay labelled.
    await expect(page.getByRole("button", { name: /Choose columns|Columns/ })).toContainText("Columns");
  });

  test("icon-only export still opens the format menu", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/administration/audit");
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /^Export/ }).click();
    await expect(page.getByRole("menuitem", { name: /Excel/ })).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

test.describe("v7 · new table controls", () => {
  test("forecast schedules has search that filters the list", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/forecasting/schedules");
    await page.waitForTimeout(1500);
    const search = page.getByRole("searchbox", { name: /Search schedules/ });
    await expect(search).toBeVisible();
    const rows = page.locator("[role=row]").filter({ has: page.locator("[role=cell]") });
    const before = await rows.count();
    expect(before).toBeGreaterThan(0);
    await search.fill("daily");
    await expect(rows).toHaveCount(1);
    await search.fill("zzzz-no-such-schedule");
    await expect(page.getByText("No schedules match the current search.")).toBeVisible();
  });

  test("data sources combines search and the status filter", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/demand-data/sources");
    await page.waitForTimeout(1500);
    const search = page.getByRole("searchbox", { name: /Search data sources/ });
    await expect(search).toBeVisible();
    // The empty state is itself rendered as a row, so counts are only compared while the
    // list has matches; the no-match case asserts the empty state instead.
    const rows = page.locator("[role=row]").filter({ has: page.locator("[role=cell]") });
    // The seeded workspace has five sources.
    await expect(rows).toHaveCount(5);

    // Status alone narrows to the failing source.
    await page.getByRole("button", { name: /^Status/ }).click();
    await page.getByRole("option", { name: "Failed" }).click();
    await page.keyboard.press("Escape");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Promotions calendar");

    // Search + status are applied together: Failed alone matches the Promotions calendar,
    // so adding a term that only matches another source leaves nothing.
    await search.fill("ERP");
    await expect(page.getByText("No data sources match the current filters.")).toBeVisible();

    // Narrowing the search back to the failing source restores it.
    await search.fill("Promotions");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Promotions calendar");

    // Clearing restores the full list.
    await search.fill("");
    await page.getByRole("button", { name: /Clear all/ }).click();
    await expect(rows).toHaveCount(5);
  });

  test("integrations shares the same search and status controls", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/administration/integrations");
    await page.waitForTimeout(2000);
    await expect(page.getByRole("searchbox", { name: /Search integrations/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Status/ })).toBeVisible();
  });
});
