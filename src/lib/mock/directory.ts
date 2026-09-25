import type { User, Workspace } from "@/types/domain";

/**
 * Fictional organisation directory used by the demo identity provider.
 * In production this comes from the IdP (OIDC/SAML) and SCIM provisioning.
 */

export const ORGANIZATION = {
  id: "org_mesta_retail",
  name: "Mesta Retail Group",
  domains: ["mesta.click", "mesta.co.id", "mestaretail.example"],
  idp: "Mesta Demo IdP (OIDC)",
};

export const PUBLIC_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "proton.me",
  "live.com",
];

export const WORKSPACES: Workspace[] = [
  {
    id: "ws_retail_prod",
    name: "Retail Indonesia",
    organization: ORGANIZATION.name,
    environment: "Production",
    region: "Jakarta (ap-southeast-3)",
    status: "active",
  },
  {
    id: "ws_retail_stg",
    name: "Retail Indonesia",
    organization: ORGANIZATION.name,
    environment: "Staging",
    region: "Jakarta (ap-southeast-3)",
    status: "active",
  },
  {
    id: "ws_conv_pilot",
    name: "Convenience Pilot",
    organization: ORGANIZATION.name,
    environment: "Sandbox",
    region: "Singapore (ap-southeast-1)",
    status: "degraded",
  },
];

/** Per-workspace catalogue size, so switching workspaces visibly changes scope. */
export const WORKSPACE_PROFILE: Record<string, { products: number; locations: number; seed: number }> = {
  ws_retail_prod: { products: 2480, locations: 48, seed: 1101 },
  ws_retail_stg: { products: 1240, locations: 24, seed: 2202 },
  ws_conv_pilot: { products: 360, locations: 12, seed: 3303 },
};

const ALL = WORKSPACES.map((w) => w.id);

export const USERS: User[] = [
  { id: "u_rina", name: "Rina Wijaya", email: "rina.wijaya@mesta.click", title: "Demand Planner", role: "planner", workspaceIds: ALL, status: "active", lastActiveAt: null },
  { id: "u_dimas", name: "Dimas Santoso", email: "dimas.santoso@mesta.click", title: "Category Manager, Beverages", role: "manager", workspaceIds: ["ws_retail_prod", "ws_retail_stg"], status: "active", lastActiveAt: null },
  { id: "u_sari", name: "Sari Halim", email: "sari.halim@mesta.click", title: "Forecast Analyst", role: "analyst", workspaceIds: ALL, status: "active", lastActiveAt: null },
  { id: "u_budi", name: "Budi Hartono", email: "budi.hartono@mesta.click", title: "Platform Administrator", role: "admin", workspaceIds: ALL, status: "active", lastActiveAt: null },
  { id: "u_maya", name: "Maya Lestari", email: "maya.lestari@mesta.click", title: "VP Supply Chain", role: "viewer", workspaceIds: ["ws_retail_prod"], status: "active", lastActiveAt: null },
  { id: "u_arif", name: "Arif Nugroho", email: "arif.nugroho@mesta.click", title: "Supply Planner", role: "planner", workspaceIds: ["ws_retail_prod"], status: "active", lastActiveAt: null },
  { id: "u_lina", name: "Lina Kusuma", email: "lina.kusuma@mesta.click", title: "Data Engineer", role: "analyst", workspaceIds: ["ws_retail_prod", "ws_retail_stg"], status: "active", lastActiveAt: null },
  { id: "u_yoga", name: "Yoga Pratama", email: "yoga.pratama@mesta.click", title: "Category Manager, Staples", role: "manager", workspaceIds: ["ws_retail_prod"], status: "active", lastActiveAt: null },
  { id: "u_dewi", name: "Dewi Anggraini", email: "dewi.anggraini@mesta.click", title: "Demand Planner", role: "planner", workspaceIds: ["ws_retail_prod", "ws_conv_pilot"], status: "active", lastActiveAt: null },
  { id: "u_hendra", name: "Hendra Gunawan", email: "hendra.gunawan@mesta.click", title: "Operations Planner", role: "planner", workspaceIds: ["ws_conv_pilot"], status: "active", lastActiveAt: null },
  { id: "u_putri", name: "Putri Ramadhani", email: "putri.ramadhani@mesta.click", title: "Commercial Analyst", role: "viewer", workspaceIds: ["ws_retail_prod"], status: "invited", lastActiveAt: null },
  { id: "u_eko", name: "Eko Saputra", email: "eko.saputra@mesta.click", title: "Demand Planner (former)", role: "planner", workspaceIds: ["ws_retail_prod"], status: "suspended", lastActiveAt: null },
];

export const SYSTEM_ACTOR = { id: "system", name: "Mesta scheduler", title: "Automated job" };

/** Identities offered by the demo IdP. One per role, plus a disabled account. */
export const DEMO_IDENTITIES = ["u_rina", "u_dimas", "u_sari", "u_budi", "u_maya", "u_eko"];

export function findUser(id: string) {
  return USERS.find((u) => u.id === id);
}

export function userByEmail(email: string) {
  return USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

export function actorName(id: string | null | undefined) {
  if (!id) return "Unassigned";
  if (id === SYSTEM_ACTOR.id) return SYSTEM_ACTOR.name;
  return findUser(id)?.name ?? "Unknown user";
}

export function workspaceById(id: string | null | undefined) {
  return WORKSPACES.find((w) => w.id === id);
}

export function workspaceLabel(w: Workspace) {
  return `${w.name} · ${w.environment}`;
}
