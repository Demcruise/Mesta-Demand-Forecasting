import type { Role } from "@/types/domain";

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

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Pengamat",
  planner: "Perencana",
  manager: "Manajer",
  analyst: "Analis",
  admin: "Administrator",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  viewer: "Melihat perkiraan, rencana, dan laporan. Tidak dapat mengubah data.",
  planner: "Menjalankan perkiraan, mengubah perkiraan, dan menyusun skenario serta rencana.",
  manager: "Semua yang dapat dilakukan perencana, ditambah persetujuan dan penerbitan.",
  analyst: "Bertanggung jawab atas model, uji model, dan kualitas data. Tidak dapat menyetujui rencana.",
  admin: "Mengelola pengguna, integrasi, dan pengaturan ruang kerja. Tidak dapat menyetujui perubahan bisnis.",
};

/** Which role must hold a permission for the UI to explain who can act. */
export function rolesWith(permission: Permission): Role[] {
  return (Object.keys(GRANTS) as Role[]).filter((r) => GRANTS[r].includes(permission));
}

export const PERMISSION_LABELS: Record<Permission, string> = {
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
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

export class PermissionError extends Error {
  constructor(public permission: Permission) {
    super(`Anda tidak memiliki izin untuk ${PERMISSION_LABELS[permission]}.`);
    this.name = "PermissionError";
  }
}
