import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./support/session";

/**
 * The language preference: English is the default for new users, Bahasa Indonesia
 * is selectable in Settings and persists across reloads (user requirement).
 */
test("a fresh user sees English by default and can switch to Bahasa Indonesia", async ({ page }) => {
  await signIn(page, USERS.planner, undefined, null);
  await page.goto("/overview");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Overview");

  await page.goto("/administration/settings/personal");
  await page.getByRole("radio", { name: /Bahasa Indonesia/ }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pengaturan");

  await page.goto("/overview");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ringkasan");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ringkasan");
});

test("switching back to English restores English copy", async ({ page }) => {
  await signIn(page, USERS.planner, undefined, "id");
  await page.goto("/overview");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ringkasan");

  await page.goto("/administration/settings/personal");
  await page.getByRole("radio", { name: /English/ }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Settings");
});
