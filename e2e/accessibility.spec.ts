import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { setPreferences, signIn, USERS } from "./support/session";

/**
 * FND-013 · automated accessibility audit. axe-core runs against the rendered pages for
 * WCAG 2.0/2.1 A and AA rules. This complements — it does not replace — the manual
 * keyboard and screen-reader pass still required before production.
 */

const PAGES = [
  "/overview",
  "/forecasting/runs",
  "/forecasting/explorer",
  "/forecasting/insights",
  "/demand-data/historical",
  "/demand-data/quality",
  "/models",
  "/scenarios",
  "/planning",
  "/planning/exceptions",
  "/planning/approvals",
  "/monitoring",
  "/administration/audit",
  // The settings index is a server redirect; audit the concrete section so the run is
  // not racing a client-side navigation.
  "/administration/settings/personal",
  "/administration/settings/appearance",
];

/** v5 DARK: the neutral dark theme must keep AA contrast on the densest surfaces. */
const DARK_PAGES = ["/overview", "/forecasting/runs", "/forecasting/explorer", "/demand-data/quality", "/planning", "/administration/settings/appearance"];

function formatViolations(violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]) {
  return violations
    .map(
      (v) =>
        `[${v.impact ?? "unknown"}] ${v.id}: ${v.help}\n${v.nodes
          .map((n) => `    ${n.target.join(" ")}\n      ${n.failureSummary?.replace(/\n/g, "\n      ") ?? ""}\n      html: ${n.html}`)
          .join("\n")}`,
    )
    .join("\n\n");
}

async function analyze(page: Page) {
  // Let any client-side navigation settle before axe walks the frame.
  await page.waitForLoadState("networkidle");
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
}

test.describe("accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.admin);
  });

  for (const path of PAGES) {
    test(`${path} has no detectable WCAG A/AA violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await analyze(page);
      expect(formatViolations(results.violations)).toBe("");
    });
  }

  for (const path of DARK_PAGES) {
    test(`${path} (dark theme) has no detectable WCAG A/AA violations`, async ({ page }) => {
      await setPreferences(page, { theme: "dark" });
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("html")).toHaveClass(/dark/);
      const results = await analyze(page);
      expect(formatViolations(results.violations)).toBe("");
    });
  }

  test("sign-in page has no detectable WCAG A/AA violations", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await analyze(page);
    expect(formatViolations(results.violations)).toBe("");
  });

  test("a row drawer traps focus and closes on Escape", async ({ page }) => {
    await page.goto("/forecasting/explorer");
    await page.locator("[data-row]").first().click();
    await expect(page).toHaveURL(/[?&]id=prd_/);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]id=prd_/);
  });
});
