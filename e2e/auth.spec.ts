import { expect, test } from "@playwright/test";

/**
 * AUTH-001 · the enterprise sign-in journey through the demo identity provider:
 * work email → organisation discovery → SSO → IdP → MFA → callback → workspace → app.
 */
test("signs in through the demo IdP and lands in the application", async ({ page }) => {
  await page.goto("/sign-in");

  await page.getByLabel("Email kantor").fill("rina.wijaya@mesta.click");
  await page.getByRole("button", { name: "Lanjutkan ke organisasi" }).click();

  await expect(page.getByText("Mesta Retail Group").first()).toBeVisible();
  await page.getByRole("button", { name: "Lanjutkan dengan SSO" }).click();

  await expect(page).toHaveURL(/\/sign-in\/idp/);
  await page.getByRole("button", { name: /Masuk sebagai Rina/ }).click();
  await expect(page.getByText("Verifikasi identitas Anda")).toBeVisible();
  await page.getByRole("button", { name: "Saya sudah menyetujuinya" }).click();

  // Rina belongs to several workspaces, so the callback asks which one to use.
  await expect(page).toHaveURL(/\/select-workspace/, { timeout: 15_000 });
  await page.getByRole("button", { name: /Retail Indonesia/ }).first().click();

  await expect(page).toHaveURL(/\/overview/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Ringkasan");
});

test("rejects a personal email address before contacting any identity provider", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email kantor").fill("someone@gmail.com");
  await page.getByRole("button", { name: "Lanjutkan ke organisasi" }).click();
  await expect(page.getByText(/Email pribadi tidak dapat digunakan/i)).toBeVisible();
  await expect(page).not.toHaveURL(/\/sign-in\/idp/);
});

test("protected routes redirect to sign-in without a session", async ({ page }) => {
  await page.goto("/forecasting/insights");
  await expect(page).toHaveURL(/\/sign-in/);
});
