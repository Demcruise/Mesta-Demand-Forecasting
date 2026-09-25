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
    "export",
  ],
};

export function can(role: Role | null | undefined, permission: Permission) {
  if (!role) return false;
  return GRANTS[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  viewer: "Viewer",
  planner: "Planner",
  manager: "Manager",
  analyst: "Analyst",
  admin: "Administrator",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  viewer: "Reads forecasts, plans and reports. Cannot change data.",
  planner: "Runs forecasts, applies overrides, builds scenarios and plans.",
  manager: "Everything a planner can do, plus approvals and publishing.",
  analyst: "Owns models, backtests and data quality. Cannot approve plans.",
  admin: "Manages users, integrations and workspace settings. Cannot approve business changes.",
};

/** Which role must hold a permission for the UI to explain who can act. */
export function rolesWith(permission: Permission): Role[] {
  return (Object.keys(GRANTS) as Role[]).filter((r) => GRANTS[r].includes(permission));
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  "forecast.run.create": "Create forecast runs",
  "forecast.run.cancel": "Cancel forecast runs",
  "forecast.run.publish": "Publish forecast runs",
  "forecast.run.archive": "Archive forecast runs",
  "forecast.override": "Apply forecast overrides",
  "scenario.create": "Create and edit scenarios",
  "scenario.submit": "Submit scenarios for review",
  "plan.edit": "Edit planning decisions",
  "plan.publish": "Publish plans",
  "exception.update": "Update exceptions",
  "approval.decide": "Approve or reject requests",
  "model.manage": "Manage models",
  "backtest.run": "Run backtests",
  "data.manage": "Resolve data quality issues",
  "integration.manage": "Manage integrations",
  "users.manage": "Manage users and roles",
  "settings.workspace": "Change workspace settings",
  "audit.view": "View the audit log",
  export: "Export data",
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[];

export class PermissionError extends Error {
  constructor(public permission: Permission) {
    super(`You do not have permission to ${PERMISSION_LABELS[permission].toLowerCase()}.`);
    this.name = "PermissionError";
  }
}
