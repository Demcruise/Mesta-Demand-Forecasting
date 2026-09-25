import type { Page } from "@playwright/test";

/**
 * Test sessions. The demo session is an unsigned base64url JSON cookie (see
 * src/lib/auth/session.ts), so tests can mint one directly instead of driving the IdP
 * for every case. The full sign-in UI is covered separately in auth.spec.ts.
 */

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? 3100}`;

export type TestUser = { id: string; name: string; email: string; role: "viewer" | "planner" | "manager" | "analyst" | "admin" };

export const USERS = {
  /** Planner in every workspace, including the seeded sandbox. */
  planner: { id: "u_rina", name: "Rina Wijaya", email: "rina.wijaya@mesta.click", role: "planner" },
  /** Analyst: owns models and data quality, can view the audit log. */
  analyst: { id: "u_sari", name: "Sari Halim", email: "sari.halim@mesta.click", role: "analyst" },
  /** Administrator: platform management only, cannot approve business changes. */
  admin: { id: "u_budi", name: "Budi Hartono", email: "budi.hartono@mesta.click", role: "admin" },
} as const satisfies Record<string, TestUser>;

/** Convenience Pilot · Sandbox · 360 products, fully seeded (runs, plan, exceptions). */
export const WORKSPACE = "ws_conv_pilot";
/** New Market Launch · Sandbox · empty workspace that demonstrates onboarding. */
export const FRESH_WORKSPACE = "ws_new_market";

export function sessionCookie(user: TestUser, workspaceId: string = WORKSPACE) {
  const now = Date.now();
  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    workspaceId,
    organization: "Mesta Retail Group",
    idp: "Mesta Demo IdP (OIDC)",
    issuedAt: now,
    expiresAt: now + 12 * 3_600_000,
  };
  return {
    name: "mdf_session",
    value: Buffer.from(JSON.stringify(session), "utf8").toString("base64url"),
    url: BASE_URL,
  };
}

/** Authenticates the browser context without exercising the IdP. */
export async function signIn(page: Page, user: TestUser = USERS.admin, workspaceId: string = WORKSPACE) {
  await page.context().addCookies([sessionCookie(user, workspaceId)]);
}
