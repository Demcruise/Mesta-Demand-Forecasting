import { expect, test } from "@playwright/test";
import { setPreferences, signIn, USERS } from "./support/session";

/**
 * Backlog v6 (METRIC-ALIGN, EXPLORER-TREND, HIST-TOOLBAR, AUDIT-TOOLBAR).
 *
 * The requirements are geometric — equal card heights, a left-axis value, a toolbar that
 * fits one row — so the assertions measure the rendered layout rather than class names.
 * That way a future refactor can change the CSS and still be held to the visual contract.
 */

test.use({ timezoneId: "Asia/Jakarta", locale: "en-GB" });

/** §103–§111: every KPI strip the backlog touches. */
const KPI_PAGES = [
  ["overview", "/overview"],
  ["insights", "/forecasting/insights"],
  ["quality", "/demand-data/quality"],
  ["planning", "/planning"],
  ["exceptions", "/planning/exceptions"],
  ["approvals", "/planning/approvals"],
  ["run detail", "/forecasting/runs"],
] as const;

/** §97/§98: dense toolbars, plus the other tables the search width change could disturb. */
const TOOLBAR_PAGES = [
  ["historical", "/demand-data/historical", 240],
  ["audit", "/administration/audit", 200],
  ["runs", "/forecasting/runs", 240],
  ["models", "/models", 240],
  ["scenarios", "/scenarios", 240],
  ["users", "/administration/users", 240],
  ["products", "/demand-data/products", 240],
] as const;

type Card = {
  width: number;
  height: number;
  valueOverflow: number;
  groupLeftGap: number;
  groupRightGap: number;
  labelLeftGap: number;
  labelHeight: number;
  labelTruncated: boolean;
  supportLeftGap: number;
  fontSize: number;
  sparklines: number;
};

/** Measures every compact KPI card in the strip. */
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
        const gb = group.getBoundingClientRect();
        const label = card.firstElementChild?.querySelector("span") as HTMLElement | null;
        const support = card.lastElementChild as HTMLElement | null;
        return {
          width: Math.round(box.width),
          height: Math.round(box.height),
          valueOverflow: value.scrollWidth - value.clientWidth,
          groupLeftGap: Math.round(gb.left - box.left),
          groupRightGap: Math.round(box.right - gb.right),
          labelLeftGap: label ? Math.round(label.getBoundingClientRect().left - box.left) : 0,
          labelHeight: label ? Math.round(label.getBoundingClientRect().height) : 0,
          labelTruncated: label ? label.scrollWidth > label.clientWidth : false,
          supportLeftGap: support ? Math.round(support.getBoundingClientRect().left - box.left) : 0,
          fontSize: Number.parseFloat(getComputedStyle(value).fontSize),
          sparklines: card.querySelectorAll("svg[width='64']").length,
        };
      }),
  );
}

test.describe("v6 · KPI cards", () => {
  for (const [name, path] of KPI_PAGES) {
    for (const width of [1440, 1280, 390]) {
      test(`${name} @${width}: left-axis value, equal heights, no clipping`, async ({ page }) => {
        await signIn(page, USERS.admin, undefined, "en");
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        // The runs list is a table; open a published run so its KPI strip is on screen.
        if (path === "/forecasting/runs") {
          await page.goto("/forecasting/runs?status=published");
          const link = page.locator('a[href^="/forecasting/runs/FR-"]').first();
          await link.waitFor({ timeout: 20_000 });
          await link.click();
          await page.waitForURL(/\/forecasting\/runs\/FR-/, { timeout: 20_000 });
        }
        await page.waitForTimeout(1200);
        // Run detail resolves its results query after navigation, so wait for the strip.
        await page.locator(".numeric-xl, .numeric-lg").first().waitFor({ timeout: 20_000 });
        const cards = await readCards(page);
        expect(cards.length, "a KPI strip renders").toBeGreaterThanOrEqual(3);

        // §METRIC-ALIGN-007/§95: one value size for every card, and the number is never clipped.
        for (const c of cards) {
          expect(c.valueOverflow).toBeLessThanOrEqual(0);
          expect(c.fontSize).toBeCloseTo(cards[0]!.fontSize, 1);
        }
        // §17/§30/§43/§67: equal heights across the strip.
        for (const c of cards) expect(Math.abs(c.height - cards[0]!.height)).toBeLessThanOrEqual(1);
        // v7 CARD-002/003: the value sits on the card's left content axis — the same axis
        // as the supporting copy — and is only centred vertically. A centred value would
        // start well inside the padding box, so the padding bound catches a regression.
        for (const c of cards) {
          expect(c.groupLeftGap, "value on the left content axis").toBeLessThanOrEqual(21);
          expect(Math.abs(c.groupLeftGap - c.supportLeftGap), "value and support share the axis").toBeLessThanOrEqual(2);
        }
      });
    }
  }

  test("overview: the first card carries no sparkline (§91)", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/overview");
    await page.waitForTimeout(1200);
    const cards = await readCards(page);
    expect(cards).toHaveLength(4);
    for (const c of cards) expect(c.sparklines, "no micro trend in the four-card group").toBe(0);
  });

  test("dark theme and Bahasa Indonesia keep the same card geometry", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "id");
    await setPreferences(page, { theme: "dark" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/forecasting/insights");
    await page.waitForTimeout(1200);
    const cards = await readCards(page);
    expect(cards.length).toBeGreaterThanOrEqual(4);
    for (const c of cards) {
      expect(c.valueOverflow).toBeLessThanOrEqual(0);
      expect(Math.abs(c.height - cards[0]!.height)).toBeLessThanOrEqual(1);
      expect(c.groupLeftGap, "value on the left content axis").toBeLessThanOrEqual(21);
    }
  });
});

test.describe("v6 · toolbars", () => {
  for (const [name, path, expectedSearch] of TOOLBAR_PAGES) {
    for (const width of [1440, 1280]) {
      test(`${name} @${width}: one row, no overflow, search follows the width contract`, async ({ page }) => {
        await signIn(page, USERS.admin, undefined, "en");
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForTimeout(1200);
        const bar = page.locator("input[type=search]").first().locator("xpath=ancestor::div[contains(@class,'border-b')][1]");
        const info = await bar.evaluate((el) => {
          const tops = new Set<number>();
          el.querySelectorAll("input[type=search], button").forEach((c) => tops.add(Math.round(c.getBoundingClientRect().top)));
          const search = el.querySelector("input[type=search]") as HTMLInputElement;
          const focusables = el.querySelectorAll("input[type=search], button, a[href]");
          return {
            rows: tops.size,
            overflow: el.scrollWidth - el.clientWidth,
            searchWidth: Math.round(search.getBoundingClientRect().width),
            firstFocusable: focusables[0]?.tagName,
            firstIsSearch: focusables[0] === search,
          };
        });
        expect(info.rows, "toolbar fits one row (§97)").toBe(1);
        expect(info.overflow, "no horizontal overflow").toBeLessThanOrEqual(0);
        expect(info.searchWidth).toBe(expectedSearch);
        // §120: search stays first in the tab order.
        expect(info.firstIsSearch).toBe(true);
      });
    }
  }

  test("explorer fits one row at desktop widths and wraps between groups when narrow (§80)", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    const read = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/forecasting/explorer");
      await page.waitForTimeout(1500);
      return page.evaluate(() => {
        const bar = document.querySelector("input[type=search]")!.closest("div.border-b") as HTMLElement;
        const [left, right] = Array.from(bar.children) as HTMLElement[];
        const tops = new Set<number>();
        bar.querySelectorAll("input[type=search], button").forEach((c) => tops.add(Math.round((c as HTMLElement).getBoundingClientRect().top)));
        return {
          rows: tops.size,
          overflow: bar.scrollWidth - bar.clientWidth,
          leftTop: Math.round(left!.getBoundingClientRect().top),
          rightTop: Math.round(right!.getBoundingClientRect().top),
          rightChildren: Array.from(right!.children).length,
        };
      });
    };

    // v7 §EXPLORER-007: icon-only actions keep the whole toolbar on one row at 1440 and 1280.
    for (const width of [1440, 1280]) {
      const info = await read(width);
      expect(info.rows, `one row at ${width}`).toBe(1);
      expect(info.overflow, `no overflow at ${width}`).toBeLessThanOrEqual(0);
      expect(info.rightTop).toBe(info.leftTop);
    }

    // When the viewport forces a wrap, the action group moves as one unit — never a single
    // stranded control (§TABLE-TOOLBAR-004).
    const narrow = await read(1024);
    expect(narrow.overflow).toBeLessThanOrEqual(0);
    expect(narrow.rightTop).toBeGreaterThan(narrow.leftTop);
    expect(narrow.rightChildren).toBeGreaterThanOrEqual(3);
  });

  test("explorer has no Trend column (§19)", async ({ page }) => {
    await signIn(page, USERS.admin, undefined, "en");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/forecasting/explorer");
    await page.waitForTimeout(2000);
    const headers = await page.locator("[role=columnheader]").allInnerTexts();
    expect(headers.length, "the table renders its headers").toBeGreaterThan(4);
    expect(headers.join(" ")).not.toMatch(/\bTrend\b/);
    // Every remaining header still lines up with a data cell in the row grid.
    const firstDataRow = page.locator("[role=row]").filter({ has: page.locator("[role=cell]") }).first();
    expect(await firstDataRow.locator("[role=cell]").count()).toBe(headers.length);
  });
});
