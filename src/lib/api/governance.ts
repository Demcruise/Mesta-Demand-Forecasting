import type { Alert, AuditEvent, ListQuery, Role, ServiceHealth } from "@/types/domain";
import { audit, baselineRun, getDb, nextId, runResult, type WorkspaceSettings } from "@/lib/mock/db";
import { actorName, findUser, USERS } from "@/lib/mock/directory";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { aggregateInterval } from "@/lib/mock/series";
import { DAY_MS, HOUR_MS, iso, MINUTE_MS } from "@/lib/mock/time";
import { applyAll, applyList, ApiError, read, write, type ApiContext, type ListSpec } from "./client";
import { syncRuns } from "./forecasting";

/* ── Session events ────────────────────────────────────────────────── */

export function recordSessionEvent(ctx: ApiContext, action: "sign_in" | "sign_out" | "workspace_switch", detail?: { from?: string; to?: string }) {
  const db = getDb(ctx.workspaceId);
  audit(db, {
    actorId: ctx.userId,
    action,
    entityType: action === "workspace_switch" ? "workspace" : "session",
    entityId: action === "workspace_switch" ? ctx.workspaceId : `ses_${ctx.userId}`,
    entityLabel: action === "workspace_switch" ? `${db.workspace.name} · ${db.workspace.environment}` : "Web session",
    previousState: detail?.from ?? null,
    newState: detail?.to ?? (action === "sign_out" ? "ended" : "active"),
    reason: null,
    source: "web",
  });
}

/* ── Overview ──────────────────────────────────────────────────────── */

export type AttentionItem = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  href: string;
  cta: string;
};

export function getOverview(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    syncRuns(db);
    const base = baselineRun(db);
    const result = base ? runResult(db, base) : null;
    const rows = result?.rows ?? [];
    const forecast = rows.reduce((s, r) => s + r.forecast, 0);
    const previous = rows.reduce((s, r) => s + r.previousForecast, 0);
    const actualLast = rows.reduce((s, r) => s + r.actualLastPeriod, 0);
    const interval = aggregateInterval(rows);
    const model = base ? db.models.find((m) => m.id === base.modelId) ?? null : null;
    const openEx = db.exceptions.filter((e) => e.status === "open" || e.status === "investigating" || e.status === "escalated");
    const pendingApprovals = db.approvals.filter((a) => a.status === "pending");
    const failedRuns = db.runs.filter((r) => r.status === "failed" && Date.now() - new Date(r.createdAt).getTime() < 3 * DAY_MS);
    const activeRuns = db.runs.filter((r) => r.status === "running" || r.status === "queued");
    const openDq = db.dqIssues.filter((i) => i.status === "open" || i.status === "investigating");
    const staleSources = db.sources.filter((s) => s.status === "failed" || s.status === "warning");

    const attention: AttentionItem[] = [];
    for (const i of openDq.filter((x) => x.severity === "blocking")) {
      attention.push({ id: i.id, severity: "critical", title: i.title, detail: i.forecastImpact, href: `/demand-data/quality?id=${i.id}`, cta: "Review data issue" });
    }
    const critical = openEx.filter((e) => e.severity === "critical");
    if (critical.length > 0) {
      attention.push({
        id: "ex-critical",
        severity: "critical",
        title: `${critical.length} critical forecast exception${critical.length === 1 ? "" : "s"}`,
        detail: `Forecasts moved more than 25% versus the previous run and are not yet reviewed.`,
        href: "/planning/exceptions?severity=critical&status=open,investigating,escalated",
        cta: "Review exceptions",
      });
    }
    const canDecide = ctx.role === "manager";
    if (pendingApprovals.length > 0) {
      const overdue = pendingApprovals.filter((a) => new Date(a.dueAt).getTime() < Date.now()).length;
      attention.push({
        id: "approvals",
        severity: overdue > 0 ? "warning" : "info",
        title: `${pendingApprovals.length} approval${pendingApprovals.length === 1 ? "" : "s"} pending`,
        detail: canDecide ? "Requests waiting for a Manager decision." : "Requests waiting for a Manager. You can follow their status.",
        href: "/planning/approvals?status=pending",
        cta: canDecide ? "Open approval queue" : "View approvals",
      });
    }
    for (const r of failedRuns) {
      attention.push({ id: r.id, severity: "warning", title: `Forecast run failed: ${r.name}`, detail: r.failureReason ?? "The run failed.", href: `/forecasting/runs/${r.id}`, cta: "View failed run" });
    }
    for (const s of staleSources.filter((x) => x.status === "failed")) {
      attention.push({ id: s.id, severity: "warning", title: `${s.name} sync failing`, detail: s.lastError ?? "", href: `/demand-data/sources?id=${s.id}`, cta: "View source" });
    }

    const latestBacktest = db.backtests.find((b) => b.modelId === base?.modelId && b.status === "completed");
    return {
      baseline: base ?? null,
      model,
      summary: base
        ? {
            forecast,
            previous,
            actualLast,
            deltaPercent: previous ? (forecast - previous) / previous : 0,
            vsActualPercent: actualLast ? (forecast - actualLast) / actualLast : 0,
            lower: interval.lower,
            upper: interval.upper,
            horizonDays: base.horizonDays,
          }
        : null,
      accuracy: latestBacktest?.metrics ?? model?.metrics ?? null,
      accuracyWindow: latestBacktest ? { id: latestBacktest.id, start: latestBacktest.windowStart, end: latestBacktest.windowEnd } : null,
      points: result?.aggregate.slice(-(91 + (base?.horizonDays ?? 28))) ?? [],
      byCategory: result?.byCategory ?? [],
      exceptions: {
        open: openEx.length,
        critical: critical.length,
        warning: openEx.filter((e) => e.severity === "warning").length,
        top: openEx
          .filter((e) => e.type === "large_delta" || e.severity === "critical")
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
          .slice(0, 6)
          .map((e) => ({ ...e, product: db.productById.get(e.productId) })),
      },
      approvals: { pending: pendingApprovals.length },
      runs: { active: activeRuns, recent: db.runs.slice(0, 6) },
      dataHealth: {
        blocking: openDq.filter((i) => i.severity === "blocking").length,
        warnings: openDq.filter((i) => i.severity === "warning").length,
        sources: db.sources,
      },
      attention,
      activity: db.audit.slice(0, 8),
    };
  });
}

/** Counts shown next to navigation items. */
export function getNavCounts(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    return {
      exceptions: db.exceptions.filter((e) => e.status === "open" || e.status === "escalated").length,
      approvals: db.approvals.filter((a) => a.status === "pending").length,
      dataIssues: db.dqIssues.filter((i) => (i.status === "open" || i.status === "investigating") && i.severity !== "info").length,
    };
  });
}

/* ── Notifications ─────────────────────────────────────────────────── */

export function listNotifications(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    syncRuns(db);
    const prefs = db.settings.notifications;
    return db.notifications.filter((n) => prefs[n.category] !== false || n.category === "approval_requested");
  });
}

export function markNotificationsRead(ctx: ApiContext, ids: string[] | "all") {
  return write(ctx, null, () => {
    const db = getDb(ctx.workspaceId);
    for (const n of db.notifications) if (ids === "all" || ids.includes(n.id)) n.read = true;
    return true;
  });
}

/* ── Audit ─────────────────────────────────────────────────────────── */

const auditSpec: ListSpec<AuditEvent> = {
  search: (e) => `${e.eventId} ${e.entityLabel} ${e.entityId} ${actorName(e.actorId)} ${e.reason ?? ""} ${e.requestId}`,
  sorters: { timestamp: (e) => e.timestamp, action: (e) => e.action, actor: (e) => actorName(e.actorId) },
  filters: {
    action: (e, v) => v.includes(e.action),
    actor: (e, v) => v.includes(e.actorId),
    entityType: (e, v) => v.includes(e.entityType),
    source: (e, v) => v.includes(e.source),
  },
};

type AuditQuery = ListQuery & { from?: string; to?: string };

function inRange(events: AuditEvent[], query: AuditQuery) {
  const from = query.from ? new Date(query.from).setHours(0, 0, 0, 0) : null;
  const to = query.to ? new Date(query.to).setHours(23, 59, 59, 999) : null;
  return events.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return (from === null || t >= from) && (to === null || t <= to);
  });
}

export function listAudit(ctx: ApiContext, query: AuditQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    if (!can(ctx.role, "audit.view")) {
      throw new ApiError("The audit log is restricted.", "permission", "Managers, analysts and administrators can view it.");
    }
    return applyList(inRange(db.audit, query), { sort: "timestamp", dir: "desc", ...query }, auditSpec);
  });
}

/** Export respects the active filters and date range (EXPORT-001). */
export function exportAudit(ctx: ApiContext, query: AuditQuery) {
  return write(ctx, "audit.view", () => {
    const db = getDb(ctx.workspaceId);
    if (!db.settings.audit.exportEnabled) throw new ApiError("Audit export is disabled for this workspace.", "permission", "An administrator can enable it in Settings › Audit and retention.");
    return applyAll(inRange(db.audit, query), { sort: "timestamp", dir: "desc", ...query }, auditSpec);
  });
}

/** Events that reference any of the given entity ids. */
export function auditFor(ctx: ApiContext, entityIds: string[]) {
  return read(() => getDb(ctx.workspaceId).audit.filter((e) => entityIds.includes(e.entityId)));
}

/* ── Users & roles ─────────────────────────────────────────────────── */

export type MemberRow = {
  userId: string;
  name: string;
  email: string;
  title: string;
  role: Role;
  status: "active" | "invited" | "suspended";
  lastActiveAt: string | null;
  workspaces: number;
};

export function listMembers(ctx: ApiContext, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const rows: MemberRow[] = db.members.map((m) => {
      const u = findUser(m.userId);
      return {
        userId: m.userId,
        name: u?.name ?? m.userId,
        email: u?.email ?? "",
        title: u?.title ?? "",
        role: m.role,
        status: m.status,
        lastActiveAt: m.userId === ctx.userId ? iso(Date.now()) : m.lastActiveAt,
        workspaces: u?.workspaceIds.length ?? 1,
      };
    });
    return applyList(rows, { sort: "name", dir: "asc", ...query }, {
      search: (r) => `${r.name} ${r.email} ${r.title}`,
      sorters: { name: (r) => r.name, role: (r) => r.role, status: (r) => r.status, lastActiveAt: (r) => r.lastActiveAt },
      filters: { role: (r, v) => v.includes(r.role), status: (r, v) => v.includes(r.status) },
    });
  });
}

export function inviteMember(ctx: ApiContext, input: { email: string; role: Role }) {
  return write(ctx, "users.manage", () => {
    const db = getDb(ctx.workspaceId);
    const email = input.email.trim().toLowerCase();
    const domain = email.split("@")[1] ?? "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError("Enter a valid work email address.", "validation");
    if (!db.settings.security.allowedDomains.includes(domain)) {
      throw new ApiError(`${domain} is not an allowed domain for this workspace.`, "validation", `Allowed: ${db.settings.security.allowedDomains.join(", ")}.`);
    }
    const existing = USERS.find((u) => u.email === email);
    if (existing && db.members.some((m) => m.userId === existing.id)) throw new ApiError("This person is already a member of the workspace.", "conflict");
    const userId = existing?.id ?? nextId(db, "u");
    if (!existing) {
      const name = email.split("@")[0]?.split(/[._-]/).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ") ?? email;
      USERS.push({ id: userId, name, email, title: "Invited user", role: input.role, workspaceIds: [ctx.workspaceId], status: "invited", lastActiveAt: null });
    }
    db.members.push({ userId, role: input.role, status: "invited", lastActiveAt: null });
    audit(db, { actorId: ctx.userId, action: "change_permissions", entityType: "user", entityId: userId, entityLabel: email, previousState: null, newState: `invited as ${ROLE_LABELS[input.role]}`, reason: null, source: "web" });
    return userId;
  });
}

export function updateMember(ctx: ApiContext, userId: string, change: { role?: Role; status?: "active" | "suspended"; remove?: boolean; reason: string }) {
  return write(ctx, "users.manage", () => {
    const db = getDb(ctx.workspaceId);
    if (userId === ctx.userId) throw new ApiError("You cannot change your own access.", "permission", "Ask another administrator.");
    const idx = db.members.findIndex((m) => m.userId === userId);
    const m = db.members[idx];
    if (!m) throw new ApiError("Member not found.", "not_found");
    if (m.role === "admin" && (change.remove || change.status === "suspended" || (change.role && change.role !== "admin"))) {
      const admins = db.members.filter((x) => x.role === "admin" && x.status === "active");
      if (admins.length <= 1) throw new ApiError("The workspace must keep at least one active administrator.", "conflict");
    }
    const label = findUser(userId)?.name ?? userId;
    if (change.remove) {
      db.members.splice(idx, 1);
      audit(db, { actorId: ctx.userId, action: "change_permissions", entityType: "user", entityId: userId, entityLabel: label, previousState: ROLE_LABELS[m.role], newState: "removed", reason: change.reason || null, source: "web" });
      return null;
    }
    const prev = `${ROLE_LABELS[m.role]} · ${m.status}`;
    if (change.role) m.role = change.role;
    if (change.status) m.status = change.status;
    audit(db, { actorId: ctx.userId, action: "change_permissions", entityType: "user", entityId: userId, entityLabel: label, previousState: prev, newState: `${ROLE_LABELS[m.role]} · ${m.status}`, reason: change.reason || null, source: "web" });
    return m;
  });
}

/* ── Settings ──────────────────────────────────────────────────────── */

export function getSettings(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    return { settings: structuredClone(db.settings), models: db.models.filter((m) => m.status !== "archived") };
  });
}

type SettingsSection = keyof WorkspaceSettings;

const SETTING_PERMISSION: Record<SettingsSection, "settings.workspace" | null> = {
  forecasting: "settings.workspace",
  exceptions: "settings.workspace",
  approvals: "settings.workspace",
  notifications: null,
  audit: "settings.workspace",
  security: "settings.workspace",
};

function describe(value: unknown) {
  if (typeof value === "number" && value > 0 && value < 1) return `${(value * 100).toFixed(0)}%`;
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export function updateSettings<S extends SettingsSection>(ctx: ApiContext, section: S, next: WorkspaceSettings[S], reason: string) {
  return write(ctx, SETTING_PERMISSION[section], () => {
    const db = getDb(ctx.workspaceId);
    const prev = db.settings[section] as Record<string, unknown>;
    const changes = Object.entries(next as Record<string, unknown>).filter(([k, v]) => JSON.stringify(prev[k]) !== JSON.stringify(v));
    if (changes.length === 0) return db.settings[section];
    for (const [key, value] of changes) {
      audit(db, {
        actorId: ctx.userId,
        action: "change_settings",
        entityType: "settings",
        entityId: `${section}.${key}`,
        entityLabel: `${section.charAt(0).toUpperCase()}${section.slice(1)} · ${key}`,
        previousState: describe(prev[key]),
        newState: describe(value),
        reason: reason || null,
        source: "web",
      });
    }
    db.settings[section] = structuredClone(next);
    return db.settings[section];
  });
}

/* ── Monitoring ────────────────────────────────────────────────────── */

export function getMonitoring(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    syncRuns(db);
    const now = Date.now();
    const services: ServiceHealth[] = [
      { id: "svc_api", name: "Forecast API", kind: "service", status: "operational", detail: "p95 latency 184 ms over the last hour.", checkedAt: iso(now - 40_000), latencyMs: 184 },
      { id: "svc_workers", name: "Forecast workers", kind: "pipeline", status: "operational", detail: `${db.runs.filter((r) => r.status === "running").length} running, ${db.runs.filter((r) => r.status === "queued").length} queued. Capacity 4 concurrent runs.`, checkedAt: iso(now - 20_000), latencyMs: null },
      { id: "svc_scheduler", name: "Scheduler", kind: "service", status: "operational", detail: "Next daily refresh at 05:30.", checkedAt: iso(now - 60_000), latencyMs: null },
      { id: "svc_store", name: "Forecast store", kind: "service", status: "operational", detail: "Last write 18 minutes ago.", checkedAt: iso(now - 90_000), latencyMs: 42 },
      ...db.sources.map((s): ServiceHealth => ({
        id: s.id,
        name: s.name,
        kind: "source",
        status: s.status === "failed" ? "down" : s.status === "warning" ? "degraded" : s.status === "disconnected" ? "degraded" : "operational",
        detail: s.lastError ?? (s.status === "disconnected" ? "Disconnected." : `Last successful sync ${s.lastSuccessAt ? formatDateTime(s.lastSuccessAt) : "never"}.`),
        checkedAt: s.lastSyncAt ?? iso(now),
        latencyMs: null,
      })),
      ...db.models.filter((m) => m.status === "production").map((m): ServiceHealth => ({
        id: m.id,
        name: `${m.name} ${m.version}`,
        kind: "model",
        status: m.id === "mdl_gbm_24" ? "degraded" : "operational",
        detail: m.id === "mdl_gbm_24" ? "Bias on Frozen rose to +6.1% over the last 14 days." : "Metrics within expected range.",
        checkedAt: iso(now - 2 * HOUR_MS),
        latencyMs: null,
      })),
    ];
    const alerts: Alert[] = [
      { id: "al_1", severity: "critical", title: "Promotions calendar sync failing", detail: "3 consecutive failures (HTTP 401).", href: "/demand-data/sources?id=src_promo", raisedAt: iso(db.today + 5 * HOUR_MS + 2 * MINUTE_MS), acknowledged: false },
      { id: "al_2", severity: "warning", title: "Model bias drift · Frozen", detail: "Bias above +5% for 14 days on model 2.4.", href: "/models/performance", raisedAt: iso(now - 2 * DAY_MS), acknowledged: true },
      { id: "al_3", severity: "warning", title: "Missing POS data · Sulawesi", detail: "No records for 3 stores for 6 days.", href: "/demand-data/quality?id=dq_001", raisedAt: iso(now - 26 * HOUR_MS), acknowledged: true },
    ];
    const jobs = db.runs.slice(0, 10);
    const history = Array.from({ length: 14 }, (_, i) => {
      const day = db.today - (13 - i) * DAY_MS;
      const failed = i === 12 ? 1 : i === 5 ? 1 : 0;
      return { day: iso(day), succeeded: 3 + ((i * 7) % 4), failed, durationMin: 21 + ((i * 5) % 9) };
    });
    return { services, alerts, jobs, history };
  });
}

/* ── Global search ─────────────────────────────────────────────────── */

export type SearchResult = {
  id: string;
  type: "Product" | "Forecast run" | "Scenario" | "Model" | "Exception" | "Approval";
  title: string;
  subtitle: string;
  status: string | null;
  href: string;
  updatedAt: string | null;
};

export function search(ctx: ApiContext, q: string) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const out: SearchResult[] = [];
    const push = (r: SearchResult) => out.length < 40 && out.push(r);
    for (const p of db.products) {
      if (`${p.name} ${p.sku}`.toLowerCase().includes(needle)) {
        push({ id: p.id, type: "Product", title: p.name, subtitle: `${p.category} · ${p.sku}`, status: null, href: `/forecasting/detail/${p.id}`, updatedAt: null });
      }
      if (out.length >= 12) break;
    }
    for (const r of db.runs) {
      if (`${r.id} ${r.name}`.toLowerCase().includes(needle)) push({ id: r.id, type: "Forecast run", title: r.name, subtitle: r.id, status: r.status, href: `/forecasting/runs/${r.id}`, updatedAt: r.completedAt ?? r.createdAt });
    }
    for (const s of db.scenarios) {
      if (s.name.toLowerCase().includes(needle)) push({ id: s.id, type: "Scenario", title: s.name, subtitle: `Owner ${actorName(s.ownerId)}`, status: s.status, href: `/scenarios/${s.id}`, updatedAt: s.modifiedAt });
    }
    for (const m of db.models) {
      if (`${m.name} ${m.version}`.toLowerCase().includes(needle)) push({ id: m.id, type: "Model", title: `${m.name} ${m.version}`, subtitle: m.family, status: m.status, href: `/models/${m.id}`, updatedAt: m.lastTrainedAt });
    }
    for (const e of db.exceptions) {
      const p = db.productById.get(e.productId);
      if (`${e.id} ${p?.name ?? ""}`.toLowerCase().includes(needle)) push({ id: e.id, type: "Exception", title: `${e.id} · ${p?.name ?? ""}`, subtitle: e.reason, status: e.status, href: `/planning/exceptions?id=${e.id}`, updatedAt: e.detectedAt });
    }
    for (const a of db.approvals) {
      if (`${a.id} ${a.objectLabel}`.toLowerCase().includes(needle)) push({ id: a.id, type: "Approval", title: a.objectLabel, subtitle: `Requested by ${actorName(a.requestedBy)}`, status: a.status, href: `/planning/approvals?id=${a.id}`, updatedAt: a.requestedAt });
    }
    return out;
  });
}

/* ── Lineage ───────────────────────────────────────────────────────── */

export type LineageNode = { key: string; label: string; title: string; detail: string; href: string | null; state: "ok" | "warning" | "critical" | "pending" | "none" };

/** Data → quality → model → run → forecast → scenario → plan → approval → published plan → audit. */
export function getLineage(ctx: ApiContext, productId: string | null) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const run = baselineRun(db);
    const model = run ? db.models.find((m) => m.id === run.modelId) : undefined;
    const product = productId ? db.productById.get(productId) : undefined;
    const openDq = db.dqIssues.filter((i) => i.status !== "resolved" && i.status !== "dismissed" && (!productId || i.sampleProductIds.includes(productId)));
    const scenario = db.scenarios.find((s) => s.status === "approved" || s.status === "in_review");
    const approval = db.approvals.find((a) => a.type === "plan_publish") ?? null;
    const pos = db.sources.find((s) => s.id === "src_pos");
    const nodes: LineageNode[] = [
      { key: "data", label: "Data", title: `${db.sources.filter((s) => s.status !== "disconnected").length} sources`, detail: `POS as of ${pos?.lastSuccessAt ? formatDateTime(pos.lastSuccessAt) : "unknown"}`, href: "/demand-data/sources", state: db.sources.some((s) => s.status === "failed") ? "warning" : "ok" },
      { key: "quality", label: "Quality", title: openDq.length ? `${openDq.length} open issue${openDq.length === 1 ? "" : "s"}` : "No open issues", detail: openDq.some((i) => i.severity === "blocking") ? "Blocking issue present" : "No blocking issues", href: "/demand-data/quality", state: openDq.some((i) => i.severity === "blocking") ? "critical" : openDq.length ? "warning" : "ok" },
      { key: "model", label: "Model", title: model ? `${model.name} ${model.version}` : "—", detail: model ? `WAPE ${(model.metrics.wape * 100).toFixed(1)}%` : "", href: model ? `/models/${model.id}` : null, state: model ? "ok" : "none" },
      { key: "run", label: "Forecast run", title: run?.id ?? "—", detail: run ? run.name : "No published run", href: run ? `/forecasting/runs/${run.id}` : null, state: run ? "ok" : "none" },
      { key: "forecast", label: "Forecast", title: product ? product.name : "All products", detail: product ? product.sku : `${db.products.length.toLocaleString("en-US")} SKUs`, href: product ? `/forecasting/detail/${product.id}` : "/forecasting/explorer", state: "ok" },
      { key: "scenario", label: "Scenario", title: scenario?.name ?? "None applied", detail: scenario ? scenario.status.replace("_", " ") : "Baseline only", href: scenario ? `/scenarios/${scenario.id}` : "/scenarios", state: scenario ? (scenario.status === "approved" ? "ok" : "pending") : "none" },
      { key: "plan", label: "Planning decision", title: db.plan.name, detail: `${db.plan.lines.length} lines · ${db.plan.status.replace("_", " ")}`, href: "/planning", state: db.plan.status === "published" ? "ok" : "pending" },
      { key: "approval", label: "Approval", title: approval ? approval.status.replace("_", " ") : "Not requested", detail: approval ? `Requested by ${actorName(approval.requestedBy)}` : "", href: approval ? `/planning/approvals?id=${approval.id}` : "/planning/approvals", state: approval?.status === "approved" ? "ok" : approval ? "pending" : "none" },
      { key: "published", label: "Published plan", title: db.plan.status === "published" ? "Published" : "Not published", detail: db.plan.status === "published" ? "Sent to replenishment" : "Waiting for approval", href: "/planning", state: db.plan.status === "published" ? "ok" : "none" },
      { key: "audit", label: "Audit", title: `${db.audit.length} events`, detail: "Every step above is recorded", href: "/administration/audit", state: "ok" },
    ];
    return nodes;
  });
}
