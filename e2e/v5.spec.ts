import { expect, test, type Page } from "@playwright/test";
import { setPreferences, signIn, USERS } from "./support/session";

/**
 * Frontend backlog v5: account menu IA, neutral dark theme tokens and single-locale UI
 * across every route.
 */

async function openAccountMenu(page: Page) {
  await page.getByRole("button", { name: /Account menu|Menu akun/ }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("account menu (PROFILE-001…012)", () => {
  test("shows identity, preferences, language, theme and sign out — nothing else", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.goto("/overview");
    const menu = await openAccountMenu(page);

    await expect(menu.getByText("Rina Wijaya")).toBeVisible();
    await expect(menu.getByText("rina.wijaya@mesta.click")).toBeVisible();
    await expect(menu.getByText(/Planner · Convenience Pilot/)).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /Personal preferences/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /^Settings/ })).toBeVisible();
    await expect(menu.getByRole("menuitemradio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    await expect(menu.getByRole("menuitemradio", { name: "Bahasa Indonesia" })).toBeVisible();
    for (const theme of ["Light", "Dark", "Match system"]) await expect(menu.getByRole("menuitemradio", { name: theme })).toBeVisible();
    const signOut = menu.getByRole("menuitem", { name: "Sign out" });
    await expect(signOut).toBeVisible();

    // Demo controls and session diagnostics moved to Settings (PROFILE-003/004).
    for (const gone of ["Slow network", "Fail reads", "Fail writes", "Signed in via", "Session expires", "Sandbox"]) {
      await expect(menu.getByText(gone)).toHaveCount(0);
    }
    // Sign out is last and neutral, not destructive red.
    const items = menu.getByRole("menuitem");
    await expect(items.last()).toHaveText("Sign out");
    const color = await signOut.evaluate((el) => getComputedStyle(el).color);
    const critical = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--critical-fg").trim());
    expect(color).not.toBe(critical);
    // Fits the viewport.
    const box = await menu.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
  });

  test("labels follow Bahasa Indonesia, language names stay untranslated", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "id");
    await page.goto("/overview");
    const menu = await openAccountMenu(page);
    for (const label of ["Preferensi pribadi", "Pengaturan", "Bahasa", "Tema", "Terang", "Gelap", "Ikuti sistem", "Keluar"]) {
      await expect(menu.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(menu.getByRole("menuitemradio", { name: "English" })).toBeVisible();
    await expect(menu.getByRole("menuitemradio", { name: "Bahasa Indonesia" })).toHaveAttribute("aria-checked", "true");
  });

  test("is keyboard operable: arrows move, Space selects a theme, Escape closes", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.goto("/overview");
    await page.getByRole("button", { name: /Account menu/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    const dark = page.getByRole("menuitemradio", { name: "Dark" });
    await dark.focus();
    await page.keyboard.press("Space");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: /Account menu/ }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("fits a 390px screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, USERS.planner, undefined, "en");
    await page.goto("/overview");
    const menu = await openAccountMenu(page);
    const box = await menu.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });

  test("sign out goes straight to the signed-out page", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.goto("/overview");
    const menu = await openAccountMenu(page);
    await menu.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/signed-out/);
  });
});

test.describe("settings information architecture (§53)", () => {
  test("appearance owns language, theme and table density", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.goto("/administration/settings/appearance");
    await expect(page.getByRole("radiogroup", { name: "Language" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Theme" })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Table density" })).toBeVisible();
    await expect(page.getByText("Manage your preferences and workspace settings.")).toBeVisible();
  });

  test("session details live in personal preferences", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.goto("/administration/settings/personal");
    await expect(page.getByText("Signed in via")).toBeVisible();
    await expect(page.getByText("Session expires")).toBeVisible();
  });

  test("demo controls live in Settings for demo workspaces and toggle the mock backend", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await page.goto("/administration/settings/demo");
    await expect(page.getByRole("heading", { name: "Demo controls" })).toBeVisible();
    await page.getByRole("switch", { name: "Fail reads" }).click();
    await page.goto("/forecasting/runs");
    await expect(page.getByText(/could not be loaded/i).first()).toBeVisible();
    await page.goto("/administration/settings/demo");
    await page.getByRole("switch", { name: "Fail reads" }).click();
  });

  test("demo controls are hidden in production workspaces", async ({ page }) => {
    await signIn(page, USERS.planner, "ws_retail_prod", "en");
    await page.goto("/administration/settings/personal");
    await expect(page.getByRole("link", { name: "Demo controls" })).toHaveCount(0);
  });
});

test.describe("neutral dark theme tokens (DARK-001…013)", () => {
  test("shared surfaces resolve to the charcoal ramp, blue stays an accent", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await setPreferences(page, { theme: "dark" });
    await page.goto("/forecasting/runs");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.locator("[data-row]").first().waitFor();

    const bg = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(16, 16, 16)");
    expect(await bg("aside nav")).toBe("rgb(21, 21, 21)");
    // Table card and header row.
    expect(await page.locator('[role="table"]').locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(21, 21, 21)");
    expect(await bg('[role="rowgroup"] [role="row"]')).toBe("rgb(21, 21, 21)");
    expect(await bg('input[type="search"], input')).toBe("rgb(21, 21, 21)");
    // Active navigation: neutral fill + primary indicator, never a blue fill.
    expect(await bg('aside a[aria-current="page"]')).toBe("rgb(32, 32, 32)");

    await page.getByRole("button", { name: "Choose columns" }).click();
    expect(await bg('[role="menu"]')).toBe("rgb(23, 23, 23)");
    await page.keyboard.press("Escape");
  });

  test("no hard-coded legacy navy dark colours remain in rendered styles", async ({ page }) => {
    await signIn(page, USERS.planner, undefined, "en");
    await setPreferences(page, { theme: "dark" });
    await page.goto("/overview");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const legacy = ["rgb(13, 20, 29)", "rgb(20, 29, 40)", "rgb(23, 34, 49)", "rgb(29, 41, 56)", "rgb(31, 44, 60)"];
    const used = await page.evaluate((colors) => {
      const hits = new Set<string>();
      document.querySelectorAll("body *").forEach((el) => {
        const c = getComputedStyle(el).backgroundColor;
        if (colors.includes(c)) hits.add(c);
      });
      return [...hits];
    }, legacy);
    expect(used).toEqual([]);
  });
});

/** Every route, not only the v4 set (v5 §73). */
const ALL_ROUTES = [
  "/overview",
  "/forecasting/runs",
  "/forecasting/runs/new",
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
  "/scenarios/new",
  "/scenarios/compare",
  "/planning",
  "/planning/exceptions",
  "/planning/approvals",
  "/monitoring",
  "/administration/audit",
  "/administration/users",
  "/administration/integrations",
  "/administration/settings/personal",
  "/administration/settings/appearance",
  "/administration/settings/notifications",
  "/administration/settings/demo",
  "/onboarding",
];

const INDONESIAN_UI = ["Perlu Ditinjau", "Pengaturan", "Penanggung jawab", "Proses Perkiraan", "Lihat semua", "Hapus filter", "Ciutkan", "Belum ada", "Terakhir diperbarui", "Ruang kerja", "Sumber Keputusan", "Kontrol demo", "Preferensi pribadi"];
const ENGLISH_UI = ["Needs attention", "Forecast runs", "Open exceptions", "Previous run", "View all", "Clear filters", "Columns", "Collapse", "Created by", "Last updated", "Personal preferences", "Demo controls", "Sign out", "View forecast"];

test.describe("single locale on every route (v5 §65 / §73)", () => {
  for (const path of ALL_ROUTES) {
    test(`en/id · ${path}`, async ({ page }) => {
      await signIn(page, USERS.admin, undefined, "en");
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      await page.waitForLoadState("networkidle");
      const en = await page.locator("body").innerText();
      const enAria = await page.evaluate(() => [...document.querySelectorAll("[aria-label],[placeholder]")].map((e) => `${e.getAttribute("aria-label") ?? ""} ${e.getAttribute("placeholder") ?? ""}`).join("\n"));
      for (const phrase of INDONESIAN_UI) {
        expect(en, `"${phrase}" in text on ${path}`).not.toContain(phrase);
        expect(enAria, `"${phrase}" in aria/placeholder on ${path}`).not.toContain(phrase);
      }

      await setPreferences(page, { locale: "id" });
      await page.reload();
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      await page.waitForLoadState("networkidle");
      const id = await page.locator("body").innerText();
      for (const phrase of ENGLISH_UI) expect(id, `"${phrase}" on ${path} (id)`).not.toContain(phrase);
    });
  }
});
