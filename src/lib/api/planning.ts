import type {
  Approval,
  Assumption,
  ForecastException,
  ListQuery,
  PlanDecision,
  Product,
  Scenario,
} from "@/types/domain";
import { audit, baselineRun, getDb, nextId, runResult, type WorkspaceDb } from "@/lib/mock/db";
import { actorName } from "@/lib/mock/directory";
import { simulateScenario } from "@/lib/mock/scenarios";
import { iso } from "@/lib/mock/time";
import { applyAll, applyList, ApiError, read, write, type ApiContext, type ListSpec } from "./client";
import { pick } from "@/lib/i18n/core";

/* ── Exceptions ────────────────────────────────────────────────────── */

export type ExceptionRow = ForecastException & { product: Product };

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;

const exceptionSpec: ListSpec<ExceptionRow> = {
  search: (e) => `${e.id} ${e.product.name} ${e.product.sku} ${e.reason}`,
  sorters: {
    severity: (e) => SEVERITY_RANK[e.severity],
    detectedAt: (e) => e.detectedAt,
    value: (e) => Math.abs(e.value),
    product: (e) => e.product.name,
    status: (e) => e.status,
  },
  filters: {
    severity: (e, v) => v.includes(e.severity),
    status: (e, v) => v.includes(e.status),
    type: (e, v) => v.includes(e.type),
    category: (e, v) => v.includes(e.product.category),
    owner: (e, v) => v.includes(e.ownerId ?? "unassigned"),
  },
};

function exceptionRows(db: WorkspaceDb): ExceptionRow[] {
  return db.exceptions
    .map((e) => ({ ...e, product: db.productById.get(e.productId) as Product }))
    .filter((e) => !!e.product);
}

export function listExceptions(ctx: ApiContext, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const rows = exceptionRows(db);
    const open = rows.filter((e) => e.status === "open" || e.status === "investigating" || e.status === "escalated");
    return {
      page: applyList(rows, { sort: "severity", dir: "asc", ...query }, { ...exceptionSpec, asOf: baselineRun(db)?.completedAt ?? null }),
      summary: {
        open: open.length,
        critical: open.filter((e) => e.severity === "critical").length,
        unassigned: open.filter((e) => !e.ownerId).length,
        mine: open.filter((e) => e.ownerId === ctx.userId).length,
      },
    };
  });
}

export function matchingExceptionIds(ctx: ApiContext, query: ListQuery) {
  return read(() => applyAll(exceptionRows(getDb(ctx.workspaceId)), query, exceptionSpec).map((e) => e.id));
}

export function getException(ctx: ApiContext, id: string) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const ex = db.exceptions.find((e) => e.id === id);
    if (!ex) throw new ApiError(pick("Item ini tidak ditemukan di ruang kerja saat ini.", "This exception was not found in the current workspace."), "not_found");
    const product = db.productById.get(ex.productId) as Product;
    const run = db.runs.find((r) => r.id === ex.runId) ?? null;
    const row = run ? runResult(db, run).rows.find((r) => r.productId === ex.productId) ?? null : null;
    const related = db.exceptions.filter((e) => e.productId === ex.productId && e.id !== ex.id);
    const dqIssues = db.dqIssues.filter((i) => i.sampleProductIds.includes(ex.productId) && i.status !== "resolved");
    return { exception: ex, product, run, row, related, dqIssues };
  });
}

export function updateExceptions(
  ctx: ApiContext,
  ids: string[],
  change: { status?: ForecastException["status"]; ownerId?: string | null; note?: string },
) {
  return write(ctx, "exception.update", () => {
    const db = getDb(ctx.workspaceId);
    if ((change.status === "resolved" || change.status === "dismissed") && !change.note?.trim()) {
      throw new ApiError(pick("Tambahkan catatan yang menjelaskan penyelesaiannya.", "Add a note explaining the resolution."), "validation");
    }
    const updated: ForecastException[] = [];
    for (const id of ids) {
      const ex = db.exceptions.find((e) => e.id === id);
      if (!ex) continue;
      const prev = ex.status;
      if (change.status) ex.status = change.status;
      if (change.ownerId !== undefined) ex.ownerId = change.ownerId;
      const text = [
        change.status && change.status !== prev ? `Status changed to ${change.status.replace("_", " ")}.` : null,
        change.ownerId !== undefined ? `Assigned to ${actorName(change.ownerId)}.` : null,
        change.note?.trim() || null,
      ]
        .filter(Boolean)
        .join(" ");
      ex.activity.push({ id: nextId(db, "act"), at: iso(Date.now()), actorId: ctx.userId, text });
      audit(db, {
        actorId: ctx.userId,
        action: change.status === "resolved" ? "resolve_exception" : "update_exception",
        entityType: "exception",
        entityId: ex.id,
        entityLabel: db.productById.get(ex.productId)?.name ?? ex.id,
        previousState: prev,
        newState: ex.status,
        reason: change.note?.trim() || null,
        source: "web",
      });
      updated.push(ex);
    }
    return updated;
  });
}

/* ── Approvals ─────────────────────────────────────────────────────── */

const approvalSpec: ListSpec<Approval> = {
  search: (a) => `${a.id} ${a.objectLabel} ${actorName(a.requestedBy)}`,
  sorters: {
    requestedAt: (a) => a.requestedAt,
    dueAt: (a) => a.dueAt,
    impact: (a) => Math.abs(a.impact.percent),
    type: (a) => a.type,
  },
  filters: {
    status: (a, v) => v.includes(a.status),
    type: (a, v) => v.includes(a.type),
  },
};

export function listApprovals(ctx: ApiContext, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const pending = db.approvals.filter((a) => a.status === "pending");
    return {
      page: applyList(db.approvals, { sort: "dueAt", dir: "asc", ...query }, approvalSpec),
      summary: {
        pending: pending.length,
        overdue: pending.filter((a) => new Date(a.dueAt).getTime() < Date.now()).length,
        dueToday: pending.filter((a) => new Date(a.dueAt).getTime() - Date.now() < 86_400_000).length,
      },
    };
  });
}

export function getApproval(ctx: ApiContext, id: string) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const approval = db.approvals.find((a) => a.id === id);
    if (!approval) throw new ApiError(pick("Permintaan persetujuan ini tidak ditemukan di ruang kerja saat ini.", "This approval request was not found in the current workspace."), "not_found");
    return approval;
  });
}

export function decideApproval(
  ctx: ApiContext,
  id: string,
  decision: "approved" | "rejected" | "revision_requested",
  comment: string,
) {
  return write(ctx, "approval.decide", () => {
    const db = getDb(ctx.workspaceId);
    const a = db.approvals.find((x) => x.id === id);
    if (!a) throw new ApiError(pick("Permintaan persetujuan tidak ditemukan.", "Approval request not found."), "not_found");
    if (a.status !== "pending") throw new ApiError(pick(`Permintaan ini sudah diputuskan (${a.status.replace("_", " ")}).`, `This request was already ${a.status.replace("_", " ")}.`), "conflict");
    if (a.requestedBy === ctx.userId) {
      throw new ApiError(pick("Anda tidak dapat memutuskan permintaan Anda sendiri.", "You cannot decide on your own request."), "permission", pick("Pemisahan tugas mengharuskan penyetuju yang berbeda.", "Segregation of duties requires a different approver."));
    }
    if (decision !== "approved" && comment.trim().length < 5) throw new ApiError(pick("Jelaskan keputusan agar pengaju dapat menindaklanjutinya.", "Explain the decision so the requester can act on it."), "validation");
    const now = iso(Date.now());
    a.status = decision;
    a.history.push({
      id: nextId(db, "h"),
      at: now,
      actorId: ctx.userId,
      text: decision === "approved" ? pick(`Disetujui.${comment.trim() ? ` ${comment.trim()}` : ""}`, `Approved.${comment.trim() ? ` ${comment.trim()}` : ""}`) : decision === "rejected" ? pick(`Ditolak: ${comment.trim()}`, `Rejected: ${comment.trim()}`) : pick(`Meminta revisi: ${comment.trim()}`, `Requested revision: ${comment.trim()}`),
    });
    applyDecision(db, a, decision);
    audit(db, {
      actorId: ctx.userId,
      action: decision === "approved" ? "approve" : decision === "rejected" ? "reject" : "request_revision",
      entityType: "approval",
      entityId: a.id,
      entityLabel: a.objectLabel,
      previousState: "pending",
      newState: decision,
      reason: comment.trim() || null,
      source: "web",
    });
    db.notifications.unshift({
      id: nextId(db, "ntf"),
      category: "approval_completed",
      title: `${decision === "approved" ? pick("Disetujui", "Approved") : decision === "rejected" ? pick("Ditolak", "Rejected") : pick("Perlu revisi", "Revision requested")}: ${a.objectLabel}`,
      body: pick(
        `${actorName(ctx.userId)} ${decision === "approved" ? "menyetujui" : decision === "rejected" ? "menolak" : "meminta revisi atas"} permintaan ini.`,
        `${actorName(ctx.userId)} ${decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "requested a revision of"} the request.`,
      ),
      href: `/planning/approvals?id=${a.id}`,
      createdAt: now,
      read: false,
    });
    return a;
  });
}

function applyDecision(db: WorkspaceDb, a: Approval, decision: "approved" | "rejected" | "revision_requested") {
  switch (a.type) {
    case "override": {
      const o = db.overrides.find((x) => x.id === a.objectId);
      if (o) o.status = decision === "approved" ? "applied" : decision === "rejected" ? "rejected" : "pending_approval";
      break;
    }
    case "scenario": {
      const s = db.scenarios.find((x) => x.id === a.objectId);
      if (s) s.status = decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "draft";
      break;
    }
    case "plan_publish": {
      if (db.plan.id === a.objectId) db.plan.status = decision === "approved" ? "published" : "draft";
      if (decision === "approved") {
        audit(db, { actorId: "system", action: "publish_plan", entityType: "plan", entityId: db.plan.id, entityLabel: db.plan.name, previousState: "in_review", newState: "published", reason: `Approval ${a.id}`, source: "system" });
      }
      break;
    }
    case "model_default": {
      if (decision === "approved") {
        for (const m of db.models) m.isDefault = m.id === a.objectId;
        const m = db.models.find((x) => x.id === a.objectId);
        if (m) m.status = "production";
        db.settings.forecasting.defaultModelId = a.objectId;
      }
      break;
    }
  }
}

/* ── Scenarios ─────────────────────────────────────────────────────── */

export function listScenarios(ctx: ApiContext, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    return applyList(
      db.scenarios,
      { sort: "modifiedAt", dir: "desc", ...query },
      {
        search: (s) => `${s.name} ${s.description} ${actorName(s.ownerId)}`,
        sorters: {
          name: (s) => s.name,
          modifiedAt: (s) => s.modifiedAt,
          status: (s) => s.status,
          impact: (s) => s.result?.deltaPercent ?? null,
        },
        filters: {
          status: (s, v) => v.includes(s.status),
          owner: (s, v) => v.includes(s.ownerId),
        },
      },
    );
  });
}

export function getScenario(ctx: ApiContext, id: string) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const scenario = db.scenarios.find((s) => s.id === id);
    if (!scenario) throw new ApiError(pick("Skenario ini tidak ditemukan di ruang kerja saat ini.", "This scenario was not found in the current workspace."), "not_found");
    const baseline = db.runs.find((r) => r.id === scenario.baselineRunId) ?? null;
    const approval = db.approvals.find((a) => a.type === "scenario" && a.objectId === id) ?? null;
    return { scenario, baseline, approval, audit: db.audit.filter((e) => e.entityId === id) };
  });
}

export function scenarioBaselines(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    return db.runs.filter((r) => r.status === "published").slice(0, 6);
  });
}

export type ScenarioInput = { name: string; description: string; baselineRunId: string; assumptions: Assumption[] };

function validateScenario(input: ScenarioInput) {
  if (input.name.trim().length < 3) throw new ApiError(pick("Beri nama skenario minimal 3 karakter.", "Give the scenario a name of at least 3 characters."), "validation");
  const missing = input.assumptions.filter((a) => a.rationale.trim().length === 0);
  if (missing.length > 0) throw new ApiError(pick(`${missing.length} asumsi belum punya alasan.`, `${missing.length} assumption${missing.length === 1 ? " has" : "s have"} no rationale.`), "validation", pick("Setiap asumsi yang diubah perlu sumber atau alasan.", "Every changed assumption needs a source or rationale."));
}

export function saveScenario(ctx: ApiContext, id: string | null, input: ScenarioInput) {
  return write(ctx, "scenario.create", () => {
    const db = getDb(ctx.workspaceId);
    validateScenario(input);
    const now = iso(Date.now());
    if (id) {
      const s = db.scenarios.find((x) => x.id === id);
      if (!s) throw new ApiError(pick("Skenario tidak ditemukan.", "Scenario not found."), "not_found");
      if (s.status === "in_review" || s.status === "approved") throw new ApiError(pick(`Skenario berstatus ${s.status.replace("_", " ")} tidak dapat diubah.`, `A scenario that is ${s.status.replace("_", " ")} cannot be edited.`), "conflict", pick("Duplikat untuk membuat perubahan.", "Duplicate it to make changes."));
      Object.assign(s, { ...input, modifiedAt: now, status: "draft", result: null });
      audit(db, { actorId: ctx.userId, action: "edit_scenario", entityType: "scenario", entityId: s.id, entityLabel: s.name, previousState: null, newState: "draft", reason: null, source: "web" });
      return s;
    }
    const s: Scenario = { id: nextId(db, "scn"), ...input, ownerId: ctx.userId, status: "draft", createdAt: now, modifiedAt: now, result: null };
    db.scenarios.unshift(s);
    audit(db, { actorId: ctx.userId, action: "create_scenario", entityType: "scenario", entityId: s.id, entityLabel: s.name, previousState: null, newState: "draft", reason: null, source: "web" });
    return s;
  });
}

/** Preview simulation for unsaved assumptions (read-only). */
export function previewScenario(ctx: ApiContext, input: Pick<ScenarioInput, "baselineRunId" | "assumptions">) {
  return read(() => simulateScenario(getDb(ctx.workspaceId), input));
}

export function simulateSavedScenario(ctx: ApiContext, id: string) {
  return write(ctx, "scenario.create", () => {
    const db = getDb(ctx.workspaceId);
    const s = db.scenarios.find((x) => x.id === id);
    if (!s) throw new ApiError(pick("Skenario tidak ditemukan.", "Scenario not found."), "not_found");
    s.result = simulateScenario(db, s);
    if (s.status === "draft") s.status = "simulated";
    s.modifiedAt = iso(Date.now());
    audit(db, { actorId: ctx.userId, action: "simulate_scenario", entityType: "scenario", entityId: s.id, entityLabel: s.name, previousState: "draft", newState: "simulated", reason: null, source: "web" });
    return s;
  });
}

export function submitScenario(ctx: ApiContext, id: string, note: string) {
  return write(ctx, "scenario.submit", () => {
    const db = getDb(ctx.workspaceId);
    const s = db.scenarios.find((x) => x.id === id);
    if (!s) throw new ApiError(pick("Skenario tidak ditemukan.", "Scenario not found."), "not_found");
    if (!s.result) throw new ApiError(pick("Jalankan simulasi sebelum mengirim untuk ditinjau.", "Run the simulation before submitting for review."), "conflict");
    if (s.status === "in_review") throw new ApiError(pick("Skenario ini sudah dalam tinjauan.", "This scenario is already in review."), "conflict");
    s.status = "in_review";
    s.modifiedAt = iso(Date.now());
    const approvalId = nextId(db, "apr");
    db.approvals.unshift({
      id: approvalId,
      type: "scenario",
      objectId: s.id,
      objectLabel: s.name,
      requestedBy: ctx.userId,
      requestedAt: s.modifiedAt,
      dueAt: iso(Date.now() + 2 * 86_400_000),
      status: "pending",
      impact: { units: s.result.deltaUnits, percent: s.result.deltaPercent, skuCount: db.products.length, summary: pick("Memakai skenario ini mengganti acuan untuk kategori terdampak di rencana berikutnya.", "Adopting this scenario replaces the baseline for affected categories in the next plan.") },
      changeSet: s.assumptions.map((a) => ({ field: a.scope, from: `${a.baselineValue}${a.unit}`, to: `${a.value}${a.unit}` })),
      evidence: note ? [note] : [],
      assumptions: s.assumptions.map((a) => a.rationale),
      policy: { name: pick("Pemakaian skenario", "Scenario adoption"), rule: pick("Skenario yang dipakai dalam rencana perlu persetujuan Manajer.", "Scenarios adopted into a plan need Manager approval."), requiredRole: "manager" },
      afterApproval: pick("Skenario dapat dipakai sebagai acuan saat menyusun rencana berikutnya.", "The scenario becomes available as the baseline when building the next plan."),
      history: [{ id: `${approvalId}-h1`, at: s.modifiedAt, actorId: ctx.userId, text: pick(`Dikirim untuk ditinjau.${note ? ` ${note}` : ""}`, `Submitted for review.${note ? ` ${note}` : ""}`) }],
    });
    audit(db, { actorId: ctx.userId, action: "submit_scenario", entityType: "scenario", entityId: s.id, entityLabel: s.name, previousState: "simulated", newState: "in_review", reason: note || null, source: "web" });
    return { scenario: s, approvalId };
  });
}

export function duplicateScenario(ctx: ApiContext, id: string) {
  return write(ctx, "scenario.create", () => {
    const db = getDb(ctx.workspaceId);
    const s = db.scenarios.find((x) => x.id === id);
    if (!s) throw new ApiError(pick("Skenario tidak ditemukan.", "Scenario not found."), "not_found");
    const now = iso(Date.now());
    const copy: Scenario = {
      ...structuredClone(s),
      id: nextId(db, "scn"),
      name: `${s.name} (copy)`,
      ownerId: ctx.userId,
      status: "draft",
      createdAt: now,
      modifiedAt: now,
      result: null,
    };
    db.scenarios.unshift(copy);
    audit(db, { actorId: ctx.userId, action: "create_scenario", entityType: "scenario", entityId: copy.id, entityLabel: copy.name, previousState: null, newState: "draft", reason: pick(`Diduplikasi dari ${s.name}`, `Duplicated from ${s.name}`), source: "web" });
    return copy;
  });
}

export function archiveScenario(ctx: ApiContext, id: string) {
  return write(ctx, "scenario.create", () => {
    const db = getDb(ctx.workspaceId);
    const s = db.scenarios.find((x) => x.id === id);
    if (!s) throw new ApiError(pick("Skenario tidak ditemukan.", "Scenario not found."), "not_found");
    if (s.status === "in_review") throw new ApiError(pick("Tarik permintaan tinjauan sebelum mengarsipkan.", "Withdraw the review request before archiving."), "conflict");
    const prev = s.status;
    s.status = "archived";
    audit(db, { actorId: ctx.userId, action: "edit_scenario", entityType: "scenario", entityId: s.id, entityLabel: s.name, previousState: prev, newState: "archived", reason: null, source: "web" });
    return s;
  });
}

export function compareScenarios(ctx: ApiContext, ids: string[]) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const scenarios = ids.map((id) => db.scenarios.find((s) => s.id === id)).filter((s): s is Scenario => !!s && !!s.result);
    const baselineId = scenarios[0]?.baselineRunId;
    const sameBaseline = scenarios.every((s) => s.baselineRunId === baselineId);
    const baseline = db.runs.find((r) => r.id === baselineId) ?? baselineRun(db) ?? null;
    return { scenarios, baseline, sameBaseline };
  });
}

/* ── Plan ──────────────────────────────────────────────────────────── */

export type PlanRow = ReturnType<typeof planRows>[number];

function planRows(db: WorkspaceDb) {
  return db.plan.lines.map((l) => ({ ...l, product: db.productById.get(l.productId) as Product }));
}

export function getPlan(ctx: ApiContext, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const rows = planRows(db);
    const baseline = db.runs.find((r) => r.id === db.plan.baselineRunId) ?? null;
    const forecast = rows.reduce((s, r) => s + r.forecast, 0);
    const proposed = rows.reduce((s, r) => s + r.proposed, 0);
    const counts = rows.reduce<Record<PlanDecision, number>>((acc, r) => ({ ...acc, [r.decision]: (acc[r.decision] ?? 0) + 1 }), { pending: 0, accepted: 0, adjusted: 0, rejected: 0, flagged: 0 });
    return {
      plan: db.plan,
      baseline,
      totals: { forecast, proposed, delta: proposed - forecast, deltaPercent: forecast ? (proposed - forecast) / forecast : 0 },
      counts,
      approval: db.approvals.find((a) => a.type === "plan_publish" && a.objectId === db.plan.id && a.status === "pending") ?? null,
      page: applyList(rows, { sort: "exceptions", dir: "desc", ...query }, {
        search: (r) => `${r.product.name} ${r.product.sku}`,
        sorters: {
          product: (r) => r.product.name,
          forecast: (r) => r.forecast,
          proposed: (r) => r.proposed,
          delta: (r) => r.proposed - r.forecast,
          exceptions: (r) => r.exceptionCount * 1e9 + r.forecast,
          decision: (r) => r.decision,
        },
        filters: {
          decision: (r, v) => v.includes(r.decision),
          category: (r, v) => v.includes(r.product.category),
          exceptions: (r, v) => (v.includes("with") && r.exceptionCount > 0) || (v.includes("without") && r.exceptionCount === 0),
        },
      }),
    };
  });
}

export function updatePlanLines(ctx: ApiContext, ids: string[], change: { decision: PlanDecision; proposed?: number; note?: string }) {
  return write(ctx, "plan.edit", () => {
    const db = getDb(ctx.workspaceId);
    if (db.plan.status !== "draft") throw new ApiError(pick(`Rencana berstatus ${db.plan.status.replace("_", " ")} dan tidak dapat diubah.`, `The plan is ${db.plan.status.replace("_", " ")} and cannot be edited.`), "conflict");
    if (change.decision === "adjusted" && (change.proposed == null || change.proposed < 0)) throw new ApiError(pick("Masukkan jumlah yang disesuaikan.", "Enter the adjusted quantity."), "validation");
    if ((change.decision === "adjusted" || change.decision === "rejected" || change.decision === "flagged") && !change.note?.trim()) {
      throw new ApiError(pick("Tambahkan catatan untuk baris yang disesuaikan, ditolak, atau ditandai.", "Add a note for adjusted, rejected or flagged lines."), "validation");
    }
    let n = 0;
    for (const id of ids) {
      const line = db.plan.lines.find((l) => l.id === id);
      if (!line) continue;
      line.decision = change.decision;
      line.proposed = change.decision === "adjusted" ? Math.round(change.proposed ?? line.forecast) : change.decision === "rejected" ? 0 : line.forecast;
      line.note = change.note?.trim() || null;
      n++;
    }
    db.plan.updatedAt = iso(Date.now());
    audit(db, { actorId: ctx.userId, action: "update_plan", entityType: "plan", entityId: db.plan.id, entityLabel: db.plan.name, previousState: null, newState: `${n} line${n === 1 ? "" : "s"} ${change.decision}`, reason: change.note?.trim() || null, source: "web" });
    return n;
  });
}

export function submitPlan(ctx: ApiContext, note: string) {
  return write(ctx, "plan.edit", () => {
    const db = getDb(ctx.workspaceId);
    if (db.plan.status !== "draft") throw new ApiError(pick(`Rencana sudah berstatus ${db.plan.status.replace("_", " ")}.`, `The plan is already ${db.plan.status.replace("_", " ")}.`), "conflict");
    const pending = db.plan.lines.filter((l) => l.decision === "pending" || l.decision === "flagged").length;
    if (pending > 0) throw new ApiError(pick(`${pending} baris masih menunggu atau ditandai.`, `${pending} line${pending === 1 ? " is" : "s are"} still pending or flagged.`), "validation", pick("Terima, sesuaikan, atau tolak setiap baris sebelum mengirim.", "Accept, adjust or reject every line before submitting."));
    db.plan.status = "in_review";
    const forecast = db.plan.lines.reduce((s, l) => s + l.forecast, 0);
    const proposed = db.plan.lines.reduce((s, l) => s + l.proposed, 0);
    const approvalId = nextId(db, "apr");
    const now = iso(Date.now());
    db.approvals.unshift({
      id: approvalId,
      type: "plan_publish",
      objectId: db.plan.id,
      objectLabel: db.plan.name,
      requestedBy: ctx.userId,
      requestedAt: now,
      dueAt: iso(Date.now() + 86_400_000),
      status: "pending",
      impact: { units: proposed - forecast, percent: forecast ? (proposed - forecast) / forecast : 0, skuCount: db.plan.lines.length, summary: pick("Penerbitan mengirim jumlah yang direncanakan ke pengisian ulang.", "Publishing sends planned quantities to replenishment.") },
      changeSet: [{ field: pick("Status rencana", "Plan status"), from: pick("Draf", "Draft"), to: pick("Diterbitkan", "Published") }],
      evidence: note ? [note] : [],
      assumptions: [pick("Acuan adalah proses perkiraan terbit terakhir.", "Baseline is the latest published forecast run.")],
      policy: { name: pick("Penerbitan rencana", "Plan publication"), rule: pick("Penerbitan rencana perlu persetujuan Manajer.", "Publishing a plan needs Manager approval."), requiredRole: "manager" },
      afterApproval: pick("Rencana diterbitkan dan menjadi hanya baca. Pengisian ulang menerima jumlah yang direncanakan.", "The plan is published and becomes read-only. Replenishment receives the planned quantities."),
      history: [{ id: `${approvalId}-h1`, at: now, actorId: ctx.userId, text: pick(`Meminta penerbitan.${note ? ` ${note}` : ""}`, `Requested publication.${note ? ` ${note}` : ""}`) }],
    });
    for (const a of db.approvals) {
      if (a.type === "plan_publish" && a.objectId === db.plan.id && a.status === "pending" && a.id !== approvalId) {
        a.status = "revision_requested";
        a.history.push({ id: nextId(db, "h"), at: now, actorId: "system", text: pick(`Digantikan oleh ${approvalId}.`, `Superseded by ${approvalId}.`) });
      }
    }
    audit(db, { actorId: ctx.userId, action: "update_plan", entityType: "plan", entityId: db.plan.id, entityLabel: db.plan.name, previousState: "draft", newState: "in_review", reason: note || null, source: "web" });
    return approvalId;
  });
}
