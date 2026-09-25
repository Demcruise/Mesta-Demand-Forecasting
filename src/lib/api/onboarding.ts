import type { Permission } from "@/lib/permissions";
import { audit, getDb, nextId } from "@/lib/mock/db";
import { iso } from "@/lib/mock/time";
import { ApiError, read, write, type ApiContext } from "./client";
import { syncRuns } from "./forecasting";
import { pick } from "@/lib/i18n/core";

/**
 * ONBOARDING-001: Welcome → Workspace → Data source → Data readiness → First forecast.
 * Step state is derived from the workspace itself, so the checklist cannot drift from
 * reality (e.g. a source connected in Integrations completes the data step).
 */

export type OnboardingStepKey = "workspace" | "source" | "readiness" | "forecast" | "publish" | "team";

export type OnboardingStep = {
  key: OnboardingStepKey;
  title: string;
  description: string;
  done: boolean;
  optional: boolean;
  /** Permission needed to complete the step; the UI explains who can. */
  permission: Permission | null;
  detail: string | null;
};

export function getOnboarding(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    syncRuns(db);
    const demand = db.sources.filter((s) => (s.type === "POS" || s.type === "ERP") && s.status !== "disconnected");
    const blocking = db.dqIssues.filter((i) => i.severity === "blocking" && i.status !== "resolved" && i.status !== "dismissed");
    const anyRun = db.runs.find((r) => r.status === "completed" || r.status === "published");
    const activeRun = db.runs.find((r) => r.status === "queued" || r.status === "running");
    const published = db.runs.find((r) => r.status === "published");
    const members = db.members.filter((m) => m.status !== "suspended").length;
    const steps: OnboardingStep[] = [
      {
        key: "workspace",
        title: "Confirm workspace details",
        description: "Check the workspace name, environment and region everyone will see.",
        done: db.onboarding.workspaceConfirmed,
        optional: false,
        permission: "settings.workspace",
        detail: `${db.workspace.name} · ${db.workspace.environment} · ${db.workspace.region}`,
      },
      {
        key: "source",
        title: "Connect a demand data source",
        description: "Forecasts need daily demand from POS or ERP. The product master is already loaded from the data warehouse.",
        done: demand.length > 0,
        optional: false,
        permission: "integration.manage",
        detail: demand.length ? `Connected: ${demand.map((s) => s.name).join(", ")}` : null,
      },
      {
        key: "readiness",
        title: "Check data readiness",
        description: "Run the data quality checks and resolve anything blocking before the first forecast.",
        done: db.onboarding.readinessChecked && blocking.length === 0 && demand.length > 0,
        optional: false,
        permission: "data.manage",
        detail: db.onboarding.readinessChecked ? (blocking.length ? `${blocking.length} blocking issue${blocking.length === 1 ? "" : "s"} to resolve` : "No blocking issues") : null,
      },
      {
        key: "forecast",
        title: "Run the first forecast",
        description: pick("Buat proses perkiraan untuk seluruh katalog dengan model bawaan.", "Create a forecast run for the whole catalogue with the default model."),
        done: !!anyRun,
        optional: false,
        permission: "forecast.run.create",
        detail: anyRun ? `${anyRun.id} ${anyRun.status}` : activeRun ? `${activeRun.id} is ${activeRun.status}` : null,
      },
      {
        key: "publish",
        title: "Publish a planning baseline",
        description: "Review the results and publish the run so overview, exceptions and plans use it.",
        done: !!published,
        optional: false,
        permission: "forecast.run.publish",
        detail: published ? `${published.id} is the baseline` : null,
      },
      {
        key: "team",
        title: "Invite your team",
        description: "Add planners and a manager to review exceptions and approve changes.",
        done: members >= 3,
        optional: true,
        permission: "users.manage",
        detail: `${members} member${members === 1 ? "" : "s"}`,
      },
    ];
    const required = steps.filter((s) => !s.optional);
    return {
      workspace: db.workspace,
      steps,
      complete: required.every((s) => s.done),
      doneCount: steps.filter((s) => s.done).length,
      dismissed: db.onboarding.dismissed,
      nextRunId: activeRun?.id ?? anyRun?.id ?? null,
    };
  });
}

export function confirmWorkspace(ctx: ApiContext) {
  return write(ctx, "settings.workspace", () => {
    const db = getDb(ctx.workspaceId);
    db.onboarding.workspaceConfirmed = true;
    audit(db, { actorId: ctx.userId, action: "change_settings", entityType: "workspace", entityId: db.workspace.id, entityLabel: `${db.workspace.name} · ${db.workspace.environment}`, previousState: "draft", newState: "confirmed", reason: "Onboarding", source: "web" });
    return true;
  });
}

/** Runs the initial data checks for a new workspace (mock: finds one warning). */
export function runReadinessChecks(ctx: ApiContext) {
  return write(ctx, "data.manage", () => {
    const db = getDb(ctx.workspaceId);
    const demand = db.sources.filter((s) => (s.type === "POS" || s.type === "ERP") && s.status !== "disconnected");
    if (demand.length === 0) throw new ApiError("Connect a demand source before running data checks.", "conflict");
    db.onboarding.readinessChecked = true;
    if (!db.dqIssues.some((i) => i.id === "dq_onb_1")) {
      db.dqIssues.push({
        id: "dq_onb_1",
        type: "missing_dimensions",
        severity: "warning",
        sourceId: demand[0]?.id ?? "src_pos",
        title: "7 SKUs have no category mapping",
        description: "7 SKUs in the demand history are not assigned to a category in the product master.",
        affectedSkus: 7,
        affectedLocations: db.locations.length,
        detectedAt: iso(Date.now()),
        status: "open",
        ownerId: null,
        forecastImpact: "These SKUs are forecast but excluded from category totals until mapped.",
        recommendedAction: "Map the SKUs to categories in the product master.",
        sampleProductIds: db.products.slice(0, 7).map((p) => p.id),
      });
    }
    audit(db, { actorId: ctx.userId, action: "update_exception", entityType: "data_source", entityId: "dq_onb_1", entityLabel: "Initial data checks", previousState: null, newState: "checked", reason: "Onboarding readiness check", source: "web" });
    return { blocking: 0, warnings: 1, checkedAt: iso(Date.now()), id: nextId(db, "chk") };
  });
}

export function setOnboardingDismissed(ctx: ApiContext, dismissed: boolean) {
  return write(ctx, null, () => {
    const db = getDb(ctx.workspaceId);
    db.onboarding.dismissed = dismissed;
    return dismissed;
  });
}

