import type { Role } from "@/types/domain";
import { getActiveLocale, getTranslations, localizedRecord, pick } from "./i18n/core";

/**
 * Proposed RBAC model (backlog §44). Roles and grants require stakeholder approval
 * (backlog §93 items 2 and 18). Authorization is enforced again in the API layer;
 * UI checks only decide what to render.
 *
 * Segregation of duties: administrators manage the platform but do not approve
 * business changes or apply forecast overrides.
 */
export type Permission =
  | "forecast.run.create"
  | "forecast.run.cancel"
  | "forecast.run.publish"
  | "forecast.run.archive"
  | "forecast.override"
  | "scenario.create"
  | "scenario.submit"
  | "plan.edit"
  | "plan.publish"
  | "exception.update"
  | "approval.decide"
  | "model.manage"
  | "backtest.run"
  | "data.manage"
  | "integration.manage"
  | "users.manage"
  | "settings.workspace"
  | "audit.view"
  | "api.manage"
  | "export";

const GRANTS: Record<Role, readonly Permission[]> = {
  viewer: ["export"],
  planner: [
    "forecast.run.create",
    "forecast.run.cancel",
    "forecast.override",
    "scenario.create",
    "scenario.submit",
    "plan.edit",
    "exception.update",
    "export",
  ],
  manager: [
    "forecast.run.create",
    "forecast.run.cancel",
    "forecast.run.publish",
    "forecast.run.archive",
    "forecast.override",
    "scenario.create",
    "scenario.submit",
    "plan.edit",
    "plan.publish",
    "exception.update",
    "approval.decide",
    "audit.view",
    "export",
  ],
  analyst: [
    "forecast.run.create",
    "forecast.run.cancel",
    "scenario.create",
    "exception.update",
    "model.manage",
    "backtest.run",
    "data.manage",
    "audit.view",
    "export",
  ],
  admin: [
    "forecast.run.create",
    "forecast.run.cancel",
    "forecast.run.publish",
    "forecast.run.archive",
    "model.manage",
    "backtest.run",
    "data.manage",
    "integration.manage",
    "users.manage",
    "settings.workspace",
    "audit.view",
    "api.manage",
    "export",
  ],
};

export function can(role: Role | null | undefined, permission: Permission) {
  if (!role) return false;
  return GRANTS[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = new Proxy({} as Record<Role, string>, {
  get(_t, role: Role) {
    return getTranslations(getActiveLocale()).roles[role]?.label ?? role;
  },
  has(_t, role: Role) {
    return role in getTranslations(getActiveLocale()).roles;
  },
  ownKeys() {
    return Object.keys(getTranslations(getActiveLocale()).roles);
  },
  getOwnPropertyDescriptor(_t, role: Role) {
    return {
      value: getTranslations(getActiveLocale()).roles[role]?.label ?? role,
      enumerable: true,
      configurable: true,
    };
  },
});

export const ROLE_DESCRIPTIONS: Record<Role, string> = new Proxy({} as Record<Role, string>, {
  get(_t, role: Role) {
    return getTranslations(getActiveLocale()).roles[role]?.description ?? "";
  },
  has(_t, role: Role) {
    return role in getTranslations(getActiveLocale()).roles;
  },
  ownKeys() {
    return Object.keys(getTranslations(getActiveLocale()).roles);
  },
  getOwnPropertyDescriptor(_t, role: Role) {
    return {
      value: getTranslations(getActiveLocale()).roles[role]?.description ?? "",
      enumerable: true,
      configurable: true,
    };
  },
});

/** Which role must hold a permission for the UI to explain who can act. */
export function rolesWith(permission: Permission): Role[] {
  return (Object.keys(GRANTS) as Role[]).filter((r) => GRANTS[r].includes(permission));
}

export const PERMISSION_LABELS: Record<Permission, string> = localizedRecord<Permission>(
  {
    "forecast.run.create": "membuat proses perkiraan",
    "forecast.run.cancel": "membatalkan proses perkiraan",
    "forecast.run.publish": "menerbitkan proses perkiraan",
    "forecast.run.archive": "mengarsipkan proses perkiraan",
    "forecast.override": "mengubah perkiraan",
    "scenario.create": "membuat dan mengubah skenario",
    "scenario.submit": "mengirim skenario untuk ditinjau",
    "plan.edit": "mengubah keputusan perencanaan",
    "plan.publish": "menerbitkan rencana",
    "exception.update": "memperbarui item yang perlu ditinjau",
    "approval.decide": "menyetujui atau menolak permintaan",
    "model.manage": "mengelola model",
    "backtest.run": "menjalankan uji model",
    "data.manage": "menyelesaikan masalah kualitas data",
    "integration.manage": "mengelola integrasi",
    "users.manage": "mengelola pengguna dan akses",
    "settings.workspace": "mengubah pengaturan ruang kerja",
    "audit.view": "melihat riwayat aktivitas",
    "api.manage": "mengelola API key dan webhook",
    export: "mengekspor data",
  },
  {
    "forecast.run.create": "create forecast runs",
    "forecast.run.cancel": "cancel forecast runs",
    "forecast.run.publish": "publish forecast runs",
    "forecast.run.archive": "archive forecast runs",
    "forecast.override": "apply forecast overrides",
    "scenario.create": "create and edit scenarios",
    "scenario.submit": "submit scenarios for review",
    "plan.edit": "edit planning decisions",
    "plan.publish": "publish plans",
    "exception.update": "update exceptions",
    "approval.decide": "approve or reject requests",
    "model.manage": "manage models",
    "backtest.run": "run backtests",
    "data.manage": "resolve data quality issues",
    "integration.manage": "manage integrations",
    "users.manage": "manage users and roles",
    "settings.workspace": "change workspace settings",
    "audit.view": "view the audit log",
    "api.manage": "manage API keys and webhooks",
    export: "export data",
  },
);

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

export class PermissionError extends Error {
  constructor(public permission: Permission) {
    super(pick(`Anda tidak memiliki izin untuk ${PERMISSION_LABELS[permission]}.`, `You do not have permission to ${PERMISSION_LABELS[permission]}.`));
    this.name = "PermissionError";
  }
}
