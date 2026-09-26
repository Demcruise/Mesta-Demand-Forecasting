import type { Permission } from "@/lib/permissions";
import { audit, getDb, nextId } from "@/lib/mock/db";
import { iso } from "@/lib/mock/time";
import { ApiError, read, write, type ApiContext } from "./client";
import { syncRuns } from "./forecasting";
import { getActiveLocale, getTranslations, pick } from "@/lib/i18n/core";
import type { StatusKey } from "@/types/domain";

const STATUS_TEXT = (s: string) => getTranslations(getActiveLocale()).statuses[s as StatusKey]?.label ?? s;

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
        title: pick("Konfirmasi detail ruang kerja", "Confirm workspace details"),
        description: pick("Periksa nama ruang kerja, lingkungan, dan wilayah yang dilihat semua orang.", "Check the workspace name, environment and region everyone will see."),
        done: db.onboarding.workspaceConfirmed,
        optional: false,
        permission: "settings.workspace",
        detail: `${db.workspace.name} · ${db.workspace.environment} · ${db.workspace.region}`,
      },
      {
        key: "source",
        title: pick("Sambungkan sumber data permintaan", "Connect a demand data source"),
        description: pick("Perkiraan butuh permintaan harian dari POS atau ERP. Data induk produk sudah dimuat dari gudang data.", "Forecasts need daily demand from POS or ERP. The product master is already loaded from the data warehouse."),
        done: demand.length > 0,
        optional: false,
        permission: "integration.manage",
        detail: demand.length ? pick(`Tersambung: ${demand.map((s) => s.name).join(", ")}`, `Connected: ${demand.map((s) => s.name).join(", ")}`) : null,
      },
      {
        key: "readiness",
        title: pick("Periksa kesiapan data", "Check data readiness"),
        description: pick("Jalankan pemeriksaan kualitas data dan selesaikan yang menghambat sebelum perkiraan pertama.", "Run the data quality checks and resolve anything blocking before the first forecast."),
        done: db.onboarding.readinessChecked && blocking.length === 0 && demand.length > 0,
        optional: false,
        permission: "data.manage",
        detail: db.onboarding.readinessChecked ? (blocking.length ? pick(`${blocking.length} masalah menghambat perlu diselesaikan`, `${blocking.length} blocking issue${blocking.length === 1 ? "" : "s"} to resolve`) : pick("Tidak ada masalah yang menghambat", "No blocking issues")) : null,
      },
      {
        key: "forecast",
        title: pick("Jalankan perkiraan pertama", "Run the first forecast"),
        description: pick("Buat proses perkiraan untuk seluruh katalog dengan model bawaan.", "Create a forecast run for the whole catalogue with the default model."),
        done: !!anyRun,
        optional: false,
        permission: "forecast.run.create",
        detail: anyRun ? `${anyRun.id} · ${STATUS_TEXT(anyRun.status)}` : activeRun ? pick(`${activeRun.id} berstatus ${STATUS_TEXT(activeRun.status)}`, `${activeRun.id} is ${STATUS_TEXT(activeRun.status)}`) : null,
      },
      {
        key: "publish",
        title: pick("Terbitkan acuan perencanaan", "Publish a planning baseline"),
        description: pick("Tinjau hasilnya lalu terbitkan proses agar Ringkasan, item tinjauan, dan rencana memakainya.", "Review the results and publish the run so overview, exceptions and plans use it."),
        done: !!published,
        optional: false,
        permission: "forecast.run.publish",
        detail: published ? pick(`${published.id} menjadi acuan`, `${published.id} is the baseline`) : null,
      },
      {
        key: "team",
        title: pick("Undang tim Anda", "Invite your team"),
        description: pick("Tambahkan perencana dan manajer untuk meninjau item dan menyetujui perubahan.", "Add planners and a manager to review exceptions and approve changes."),
        done: members >= 3,
        optional: true,
        permission: "users.manage",
        detail: pick(`${members} anggota`, `${members} member${members === 1 ? "" : "s"}`),
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
    if (demand.length === 0) throw new ApiError(pick("Sambungkan sumber permintaan sebelum menjalankan pemeriksaan data.", "Connect a demand source before running data checks."), "conflict");
    db.onboarding.readinessChecked = true;
    if (!db.dqIssues.some((i) => i.id === "dq_onb_1")) {
      db.dqIssues.push({
        id: "dq_onb_1",
        type: "missing_dimensions",
        severity: "warning",
        sourceId: demand[0]?.id ?? "src_pos",
        title: pick("7 SKU belum punya pemetaan kategori", "7 SKUs have no category mapping"),
        description: pick("7 SKU di riwayat permintaan belum masuk kategori di data induk produk.", "7 SKUs in the demand history are not assigned to a category in the product master."),
        affectedSkus: 7,
        affectedLocations: db.locations.length,
        detectedAt: iso(Date.now()),
        status: "open",
        ownerId: null,
        forecastImpact: pick("SKU ini tetap diperkirakan tetapi tidak dihitung di total kategori sampai dipetakan.", "These SKUs are forecast but excluded from category totals until mapped."),
        recommendedAction: pick("Petakan SKU ke kategori di data induk produk.", "Map the SKUs to categories in the product master."),
        sampleProductIds: db.products.slice(0, 7).map((p) => p.id),
      });
    }
    audit(db, { actorId: ctx.userId, action: "update_exception", entityType: "data_source", entityId: "dq_onb_1", entityLabel: pick("Pemeriksaan data awal", "Initial data checks"), previousState: null, newState: "checked", reason: pick("Pemeriksaan kesiapan persiapan", "Onboarding readiness check"), source: "web" });
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

