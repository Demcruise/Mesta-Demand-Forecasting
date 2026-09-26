import type { Alert, AuditEvent, ListQuery, Role, ServiceHealth } from "@/types/domain";
import { audit, baselineRun, getDb, nextId, runResult, type WorkspaceSettings } from "@/lib/mock/db";
import { actorName, findUser, USERS } from "@/lib/mock/directory";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { formatDate, formatDateRange, formatDateTime, formatDeltaPercent, formatMetric, formatNumber, formatPercent } from "@/lib/format";
import { aggregateInterval } from "@/lib/mock/series";
import { REGIONS } from "@/lib/mock/catalog";
import { DAY_MS, HOUR_MS, iso, MINUTE_MS } from "@/lib/mock/time";
import { applyAll, applyList, ApiError, read, write, type ApiContext, type ListSpec } from "./client";
import { syncRuns } from "./forecasting";
import { pick } from "@/lib/i18n/core";

/* ── Session events ────────────────────────────────────────────────── */

export function recordSessionEvent(ctx: ApiContext, action: "sign_in" | "sign_out" | "workspace_switch", detail?: { from?: string; to?: string }) {
  const db = getDb(ctx.workspaceId);
  audit(db, {
    actorId: ctx.userId,
    action,
    entityType: action === "workspace_switch" ? "workspace" : "session",
    entityId: action === "workspace_switch" ? ctx.workspaceId : `ses_${ctx.userId}`,
    entityLabel: action === "workspace_switch" ? `${db.workspace.name} · ${db.workspace.environment}` : pick("Sesi web", "Web session"),
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
      attention.push({ id: i.id, severity: "critical", title: i.title, detail: i.forecastImpact, href: `/demand-data/quality?id=${i.id}`, cta: pick("Tinjau masalah data", "Review data issue") });
    }
    const critical = openEx.filter((e) => e.severity === "critical");
    if (critical.length > 0) {
      attention.push({
        id: "ex-critical",
        severity: "critical",
        title: pick(`${critical.length} perubahan perkiraan kritis`, `${critical.length} critical forecast exception${critical.length === 1 ? "" : "s"}`),
        detail: pick("Perkiraan berubah lebih dari 25% dibanding perkiraan sebelumnya dan belum ditinjau.", "Forecasts moved more than 25% versus the previous run and are not yet reviewed."),
        href: "/planning/exceptions?severity=critical&status=open,investigating,escalated",
        cta: pick("Tinjau perubahan", "Review exceptions"),
      });
    }
    const canDecide = ctx.role === "manager";
    if (pendingApprovals.length > 0) {
      const overdue = pendingApprovals.filter((a) => new Date(a.dueAt).getTime() < Date.now()).length;
      attention.push({
        id: "approvals",
        severity: overdue > 0 ? "warning" : "info",
        title: pick(`${pendingApprovals.length} persetujuan menunggu`, `${pendingApprovals.length} approval${pendingApprovals.length === 1 ? "" : "s"} pending`),
        detail: canDecide
          ? pick("Permintaan menunggu keputusan Manajer.", "Requests waiting for a Manager decision.")
          : pick("Permintaan menunggu Manajer. Anda dapat memantau statusnya.", "Requests waiting for a Manager. You can follow their status."),
        href: "/planning/approvals?status=pending",
        cta: canDecide ? pick("Buka antrean persetujuan", "Open approval queue") : pick("Lihat persetujuan", "View approvals"),
      });
    }
    for (const r of failedRuns) {
      attention.push({ id: r.id, severity: "warning", title: pick(`Proses perkiraan gagal: ${r.name}`, `Forecast run failed: ${r.name}`), detail: r.failureReason ?? pick("Proses gagal.", "The run failed."), href: `/forecasting/runs/${r.id}`, cta: pick("Lihat proses gagal", "View failed run") });
    }
    for (const s of staleSources.filter((x) => x.status === "failed")) {
      attention.push({ id: s.id, severity: "warning", title: pick(`Sinkronisasi ${s.name} gagal`, `${s.name} sync failing`), detail: s.lastError ?? "", href: `/demand-data/sources?id=${s.id}`, cta: pick("Lihat sumber", "View source") });
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
    // Per-user rules (PLAT-006) decide which categories reach the in-app feed.
    const rules = db.platform.notificationRules[ctx.userId];
    const inApp = (category: string) => (rules ? (rules.channels[category as keyof typeof rules.channels] ?? []).includes("in_app") : db.settings.notifications[category] !== false);
    return db.notifications.filter((n) => n.category === "approval_requested" || inApp(n.category));
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
      throw new ApiError(pick("Riwayat aktivitas dibatasi.", "The audit log is restricted."), "permission", pick("Manajer, analis, dan administrator dapat melihatnya.", "Managers, analysts and administrators can view it."));
    }
    return applyList(inRange(db.audit, query), { sort: "timestamp", dir: "desc", ...query }, auditSpec);
  });
}

/** Export respects the active filters and date range (EXPORT-001). */
export function exportAudit(ctx: ApiContext, query: AuditQuery) {
  return write(ctx, "audit.view", () => {
    const db = getDb(ctx.workspaceId);
    if (!db.settings.audit.exportEnabled) throw new ApiError(pick("Ekspor audit dinonaktifkan untuk ruang kerja ini.", "Audit export is disabled for this workspace."), "permission", pick("Administrator dapat mengaktifkannya di Pengaturan › Audit & Retensi.", "An administrator can enable it in Settings › Audit and retention."));
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
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(pick("Masukkan email kantor yang valid.", "Enter a valid work email address."), "validation");
    if (!db.settings.security.allowedDomains.includes(domain)) {
      throw new ApiError(pick(`${domain} bukan domain yang diizinkan untuk ruang kerja ini.`, `${domain} is not an allowed domain for this workspace.`), "validation", pick(`Diizinkan: ${db.settings.security.allowedDomains.join(", ")}.`, `Allowed: ${db.settings.security.allowedDomains.join(", ")}.`));
    }
    const existing = USERS.find((u) => u.email === email);
    if (existing && db.members.some((m) => m.userId === existing.id)) throw new ApiError(pick("Orang ini sudah menjadi anggota ruang kerja.", "This person is already a member of the workspace."), "conflict");
    const userId = existing?.id ?? nextId(db, "u");
    if (!existing) {
      const name = email.split("@")[0]?.split(/[._-]/).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ") ?? email;
      USERS.push({ id: userId, name, email, title: pick("Pengguna diundang", "Invited user"), role: input.role, workspaceIds: [ctx.workspaceId], status: "invited", lastActiveAt: null });
    }
    db.members.push({ userId, role: input.role, status: "invited", lastActiveAt: null });
    audit(db, { actorId: ctx.userId, action: "change_permissions", entityType: "user", entityId: userId, entityLabel: email, previousState: null, newState: pick(`diundang sebagai ${ROLE_LABELS[input.role]}`, `invited as ${ROLE_LABELS[input.role]}`), reason: null, source: "web" });
    return userId;
  });
}

export function updateMember(ctx: ApiContext, userId: string, change: { role?: Role; status?: "active" | "suspended"; remove?: boolean; reason: string }) {
  return write(ctx, "users.manage", () => {
    const db = getDb(ctx.workspaceId);
    if (userId === ctx.userId) throw new ApiError(pick("Anda tidak dapat mengubah akses Anda sendiri.", "You cannot change your own access."), "permission", pick("Minta administrator lain.", "Ask another administrator."));
    const idx = db.members.findIndex((m) => m.userId === userId);
    const m = db.members[idx];
    if (!m) throw new ApiError(pick("Anggota tidak ditemukan.", "Member not found."), "not_found");
    if (m.role === "admin" && (change.remove || change.status === "suspended" || (change.role && change.role !== "admin"))) {
      const admins = db.members.filter((x) => x.role === "admin" && x.status === "active");
      if (admins.length <= 1) throw new ApiError(pick("Ruang kerja harus memiliki minimal satu administrator aktif.", "The workspace must keep at least one active administrator."), "conflict");
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
      { id: "svc_api", name: "Forecast API", kind: "service", status: "operational", detail: pick("Latensi p95 184 md dalam satu jam terakhir.", "p95 latency 184 ms over the last hour."), checkedAt: iso(now - 40_000), latencyMs: 184 },
      { id: "svc_workers", name: "Forecast workers", kind: "pipeline", status: "operational", detail: pick(`${db.runs.filter((r) => r.status === "running").length} berjalan, ${db.runs.filter((r) => r.status === "queued").length} antre. Kapasitas 4 proses bersamaan.`, `${db.runs.filter((r) => r.status === "running").length} running, ${db.runs.filter((r) => r.status === "queued").length} queued. Capacity 4 concurrent runs.`), checkedAt: iso(now - 20_000), latencyMs: null },
      { id: "svc_scheduler", name: "Scheduler", kind: "service", status: "operational", detail: pick("Pembaruan harian berikutnya pukul 05:30.", "Next daily refresh at 05:30."), checkedAt: iso(now - 60_000), latencyMs: null },
      { id: "svc_store", name: "Forecast store", kind: "service", status: "operational", detail: pick("Penulisan terakhir 18 menit lalu.", "Last write 18 minutes ago."), checkedAt: iso(now - 90_000), latencyMs: 42 },
      ...db.sources.map((s): ServiceHealth => ({
        id: s.id,
        name: s.name,
        kind: "source",
        status: s.status === "failed" ? "down" : s.status === "warning" ? "degraded" : s.status === "disconnected" ? "degraded" : "operational",
        detail: s.lastError ?? (s.status === "disconnected" ? pick("Terputus.", "Disconnected.") : pick(`Sinkronisasi terakhir berhasil ${s.lastSuccessAt ? formatDateTime(s.lastSuccessAt) : "belum pernah"}.`, `Last successful sync ${s.lastSuccessAt ? formatDateTime(s.lastSuccessAt) : "never"}.`)),
        checkedAt: s.lastSyncAt ?? iso(now),
        latencyMs: null,
      })),
      ...db.models.filter((m) => m.status === "production").map((m): ServiceHealth => ({
        id: m.id,
        name: `${m.name} ${m.version}`,
        kind: "model",
        status: m.id === "mdl_gbm_24" ? "degraded" : "operational",
        detail: m.id === "mdl_gbm_24" ? pick("Bias pada Beku naik ke +6,1% dalam 14 hari terakhir.", "Bias on Frozen rose to +6.1% over the last 14 days.") : pick("Metrik dalam rentang wajar.", "Metrics within expected range."),
        checkedAt: iso(now - 2 * HOUR_MS),
        latencyMs: null,
      })),
    ];
    const alerts: Alert[] = [
      { id: "al_1", severity: "critical", title: pick("Sinkronisasi kalender promosi gagal", "Promotions calendar sync failing"), detail: pick("3 kali gagal berturut-turut (HTTP 401).", "3 consecutive failures (HTTP 401)."), href: "/demand-data/sources?id=src_promo", raisedAt: iso(db.today + 5 * HOUR_MS + 2 * MINUTE_MS), acknowledged: false },
      { id: "al_2", severity: "warning", title: pick("Penyimpangan bias model · Beku", "Model bias drift · Frozen"), detail: pick("Bias di atas +5% selama 14 hari pada model 2.4.", "Bias above +5% for 14 days on model 2.4."), href: "/models/performance", raisedAt: iso(now - 2 * DAY_MS), acknowledged: true },
      { id: "al_3", severity: "warning", title: pick("Data POS hilang · Sulawesi", "Missing POS data · Sulawesi"), detail: pick("Tidak ada data dari 3 toko selama 6 hari.", "No records for 3 stores for 6 days."), href: "/demand-data/quality?id=dq_001", raisedAt: iso(now - 26 * HOUR_MS), acknowledged: true },
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
      if (s.name.toLowerCase().includes(needle)) push({ id: s.id, type: "Scenario", title: s.name, subtitle: pick(`Penanggung jawab ${actorName(s.ownerId)}`, `Owner ${actorName(s.ownerId)}`), status: s.status, href: `/scenarios/${s.id}`, updatedAt: s.modifiedAt });
    }
    for (const m of db.models) {
      if (`${m.name} ${m.version}`.toLowerCase().includes(needle)) push({ id: m.id, type: "Model", title: `${m.name} ${m.version}`, subtitle: m.family, status: m.status, href: `/models/${m.id}`, updatedAt: m.lastTrainedAt });
    }
    for (const e of db.exceptions) {
      const p = db.productById.get(e.productId);
      if (`${e.id} ${p?.name ?? ""}`.toLowerCase().includes(needle)) push({ id: e.id, type: "Exception", title: `${e.id} · ${p?.name ?? ""}`, subtitle: e.reason, status: e.status, href: `/planning/exceptions?id=${e.id}`, updatedAt: e.detectedAt });
    }
    for (const a of db.approvals) {
      if (`${a.id} ${a.objectLabel}`.toLowerCase().includes(needle)) push({ id: a.id, type: "Approval", title: a.objectLabel, subtitle: pick(`Diminta oleh ${actorName(a.requestedBy)}`, `Requested by ${actorName(a.requestedBy)}`), status: a.status, href: `/planning/approvals?id=${a.id}`, updatedAt: a.requestedAt });
    }
    return out;
  });
}

/* ── Lineage ───────────────────────────────────────────────────────── */

export type LineageStatus = "ready" | "attention" | "blocking" | "pending" | "not_started";

export type ForecastLineageNode = {
  key: "data" | "readiness" | "model" | "run" | "baseline" | "scenario" | "plan" | "approval" | "published" | "activity";
  /** Primary, forecast-specific value (e.g. "4.77M units", "FR-…"). */
  title: string;
  /** Short line under the title. */
  subtitle?: string;
  /** Secondary metadata shown as label/value pairs. */
  facts: { label: string; value: string }[];
  status: LineageStatus;
  href: string | null;
  cta?: string;
  /** Expandable detail (§165): what happened, scope, time, current/previous value. */
  details: { label: string; value: string }[];
};

export type ForecastLineage = {
  context: {
    product: { id: string; name: string; sku: string; category: string } | null;
    runId: string | null;
    runName: string | null;
    horizonDays: number | null;
    generatedAt: string | null;
    scope: string;
    locations: string;
  };
  nodes: ForecastLineageNode[];
};

/**
 * Forecast lineage (PAGE-LINEAGE-001): how one forecast moved from source data to a
 * planning decision. Every node speaks about the same context — the whole published
 * baseline, or one product when `productId` is given (§161).
 */
export function getForecastLineage(ctx: ApiContext, productId: string | null) {
  return read((): ForecastLineage => {
    const db = getDb(ctx.workspaceId);
    syncRuns(db);
    const run = baselineRun(db);
    const model = run ? db.models.find((m) => m.id === run.modelId) : undefined;
    const product = productId ? db.productById.get(productId) : undefined;
    const result = run ? runResult(db, run) : null;
    const rows = result ? (product ? result.rows.filter((r) => r.productId === product.id) : result.rows) : [];
    const forecast = rows.reduce((s, r) => s + (r.overrideUnits ?? r.forecast), 0);
    const previous = rows.reduce((s, r) => s + r.previousForecast, 0);
    const interval = product && rows[0] ? { lower: rows[0].lowerBound, upper: rows[0].upperBound } : aggregateInterval(rows);
    const units = pick("unit", "units");
    // An empty region list means every region is in scope.
    const regionCount = run ? run.scope.regions.length || REGIONS.length : REGIONS.length;
    const skus = product ? 1 : run?.scope.skuCount ?? db.products.length;
    const scopeText = product
      ? `${product.name} · ${product.sku}`
      : run
        ? pick(`${formatNumber(skus)} SKU · ${regionCount} wilayah`, `${formatNumber(skus)} SKUs · ${regionCount} regions`)
        : pick("Semua produk", "All products");

    // Demand data
    const connected = db.sources.filter((s) => s.status !== "disconnected");
    const failing = connected.filter((s) => s.status === "failed");
    const pos = db.sources.find((s) => s.id === "src_pos");
    const demandSources = connected.filter((s) => s.id === "src_pos" || s.id === "src_erp");
    // Data readiness
    const openDq = db.dqIssues.filter((i) => (i.status === "open" || i.status === "investigating") && (!productId || i.sampleProductIds.includes(productId)));
    const blocking = openDq.filter((i) => i.severity === "blocking").length;
    const coverage = Math.max(0, Math.min(1, 1 - openDq.filter((i) => i.severity !== "info").reduce((s, i) => s + i.affectedSkus, 0) / Math.max(1, db.products.length * 4)));
    // Model
    const backtest = model ? db.backtests.find((b) => b.modelId === model.id && b.status === "completed") : undefined;
    // Scenario — only a real one, never a placeholder (§88).
    const scenario = db.scenarios.find((s) => (s.status === "approved" || s.status === "in_review") && s.baselineRunId === run?.id) ?? null;
    // Planning
    const lines = product ? db.plan.lines.filter((l) => l.productId === product.id) : db.plan.lines;
    const undecided = lines.filter((l) => l.decision === "pending" || l.decision === "flagged").length;
    const planned = lines.reduce((s, l) => s + l.proposed, 0);
    const approval = db.approvals.find((a) => a.type === "plan_publish" && a.objectId === db.plan.id) ?? db.approvals.find((a) => a.type === "plan_publish") ?? null;
    const published = db.plan.status === "published";
    const planPublish = db.audit.find((e) => e.entityId === db.plan.id && e.newState === "published");
    // Activity: latest event on this forecast's objects, else the workspace.
    const related = new Set([run?.id, db.plan.id, product?.id, approval?.id, scenario?.id].filter(Boolean) as string[]);
    const activity = db.audit.find((e) => related.has(e.entityId)) ?? db.audit[0] ?? null;

    const approvalLabel = approval
      ? pick({ pending: "Menunggu", approved: "Disetujui", rejected: "Ditolak", revision_requested: "Perlu revisi" }[approval.status], { pending: "Pending", approved: "Approved", rejected: "Rejected", revision_requested: "Revision requested" }[approval.status])
      : pick("Belum diminta", "Not requested");

    const nodes: ForecastLineageNode[] = [
      {
        key: "data",
        title: demandSources.length ? demandSources.map((s) => s.name).join(" + ") : pick("Tidak ada sumber permintaan", "No demand source"),
        facts: [
          { label: pick("Terakhir diperbarui", "Last updated"), value: pos?.lastSuccessAt ? formatDateTime(pos.lastSuccessAt) : "—" },
          { label: pick("Cakupan", "Scope"), value: scopeText },
        ],
        status: connected.length === 0 ? "blocking" : failing.length ? "attention" : "ready",
        href: "/demand-data/sources",
        cta: pick("Lihat sumber data", "View data sources"),
        details: [
          { label: pick("Sumber tersambung", "Connected sources"), value: String(connected.length) },
          { label: pick("Sumber gagal", "Failing sources"), value: failing.length ? failing.map((s) => s.name).join(", ") : pick("Tidak ada", "None") },
        ],
      },
      {
        key: "readiness",
        title: pick(`Cakupan ${formatPercent(coverage)}`, `${formatPercent(coverage)} coverage`),
        facts: [
          { label: pick("Masalah", "Issues"), value: pick(`${openDq.length} terbuka · ${blocking} menghambat`, `${openDq.length} open · ${blocking} blocking`) },
        ],
        status: blocking ? "blocking" : openDq.length ? "attention" : "ready",
        href: "/demand-data/quality",
        cta: pick("Lihat kualitas data", "View data quality"),
        details: openDq.slice(0, 3).map((i) => ({ label: i.id.toUpperCase().replace("_", "-"), value: i.title })),
      },
      {
        key: "model",
        title: model ? model.name : "—",
        subtitle: model ? `v${model.version}` : undefined,
        facts: model
          ? [
              { label: "WAPE", value: formatPercent(backtest?.metrics?.wape ?? model.metrics.wape) },
              { label: pick("Terakhir dievaluasi", "Last evaluated"), value: formatDate(backtest?.createdAt ?? model.lastTrainedAt) },
            ]
          : [],
        status: model ? "ready" : "not_started",
        href: model ? `/models/${model.id}` : "/models",
        cta: pick("Lihat model", "View model"),
        details: model ? [{ label: pick("Terakhir dilatih", "Last trained"), value: formatDate(model.lastTrainedAt) }] : [],
      },
      {
        key: "run",
        title: run?.id ?? pick("Belum ada proses terbit", "No published run"),
        subtitle: run?.name,
        facts: run
          ? [
              { label: pick("Periode", "Horizon"), value: pick(`${run.horizonDays} hari`, `${run.horizonDays}-day horizon`) },
              { label: "SKU", value: formatNumber(run.scope.skuCount) },
            ]
          : [],
        status: run ? "ready" : "not_started",
        href: run ? `/forecasting/runs/${run.id}` : "/forecasting/runs",
        cta: pick("Lihat proses", "View run"),
        details: run
          ? [
              { label: pick("Dibuat", "Created"), value: formatDateTime(run.createdAt) },
              { label: pick("Selesai", "Completed"), value: formatDateTime(run.completedAt) },
            ]
          : [],
      },
      {
        key: "baseline",
        title: run ? `${formatMetric(forecast)} ${units}` : "—",
        subtitle: run && previous ? pick(`${formatDeltaPercent((forecast - previous) / previous)} vs perkiraan sebelumnya`, `${formatDeltaPercent((forecast - previous) / previous)} vs previous run`) : undefined,
        facts: run ? [{ label: pick("Rentang 80%", "80% range"), value: `${formatMetric(interval.lower)}–${formatMetric(interval.upper)}` }] : [],
        status: run ? "ready" : "not_started",
        href: product ? `/forecasting/detail/${product.id}` : "/forecasting/explorer",
        cta: product ? pick("Lihat detail perkiraan", "View forecast detail") : pick("Buka Perkiraan Permintaan", "Open Forecast Explorer"),
        details: run
          ? [
              { label: pick("Nilai saat ini", "Current value"), value: `${formatNumber(forecast)} ${units}` },
              { label: pick("Nilai sebelumnya", "Previous value"), value: `${formatNumber(previous)} ${units}` },
            ]
          : [],
      },
      scenario
        ? {
            key: "scenario",
            title: scenario.name,
            subtitle: scenario.result ? pick(`${formatDeltaPercent(scenario.result.deltaPercent)} permintaan`, `${formatDeltaPercent(scenario.result.deltaPercent)} demand`) : undefined,
            facts: [{ label: "Status", value: pick({ draft: "Draf", in_review: "Menunggu tinjauan", simulated: "Disimulasikan", approved: "Disetujui", rejected: "Ditolak", archived: "Diarsipkan" }[scenario.status] ?? scenario.status, { draft: "Draft", in_review: "Pending review", simulated: "Simulated", approved: "Approved", rejected: "Rejected", archived: "Archived" }[scenario.status] ?? scenario.status) }],
            status: scenario.status === "approved" ? "ready" : "pending",
            href: `/scenarios/${scenario.id}`,
            cta: pick("Lihat skenario", "View scenario"),
            details: scenario.assumptions.slice(0, 3).map((a) => ({ label: a.scope, value: a.rationale })),
          }
        : {
            key: "scenario",
            title: pick("Tidak ada skenario yang diterapkan", "No scenario applied"),
            facts: [],
            status: "not_started",
            href: "/scenarios",
            cta: pick("Lihat skenario", "View scenarios"),
            details: [],
          },
      {
        key: "plan",
        title: pick(`${formatMetric(planned)} unit direncanakan`, `${formatMetric(planned)} planned units`),
        facts: [
          { label: pick("Perlu keputusan", "Need a decision"), value: pick(`${undecided} baris`, `${undecided} lines`) },
          { label: pick("Sudah diputuskan", "Decided"), value: pick(`${lines.length - undecided} baris`, `${lines.length - undecided} lines`) },
        ],
        status: undecided > 0 ? "pending" : "ready",
        href: product ? `/planning?q=${encodeURIComponent(product.sku)}` : "/planning",
        cta: pick("Lihat rencana", "View plan"),
        details: [{ label: pick("Rencana", "Plan"), value: `${db.plan.name} · ${formatDateRange(db.plan.periodStart, db.plan.periodEnd)}` }],
      },
      {
        key: "approval",
        title: approvalLabel,
        facts: approval
          ? [
              { label: pick("Diminta oleh", "Requested by"), value: actorName(approval.requestedBy) },
              { label: pick("Perubahan", "Changes"), value: formatNumber(approval.changeSet.length) },
            ]
          : [],
        status: approval?.status === "approved" ? "ready" : approval?.status === "rejected" ? "blocking" : approval ? "pending" : "not_started",
        href: approval ? `/planning/approvals?id=${approval.id}` : "/planning/approvals",
        cta: pick("Lihat persetujuan", "View approval"),
        details: approval ? [{ label: pick("Diminta", "Requested"), value: formatDateTime(approval.requestedAt) }] : [],
      },
      {
        key: "published",
        title: formatDateRange(db.plan.periodStart, db.plan.periodEnd),
        facts: [{ label: published ? pick("Diterbitkan", "Published") : "Status", value: published ? formatDateTime(planPublish?.timestamp ?? db.plan.updatedAt) : pick("Belum diterbitkan", "Not published") }],
        status: published ? "ready" : "not_started",
        href: "/planning",
        cta: pick("Lihat rencana", "View plan"),
        details: [],
      },
      {
        key: "activity",
        title: activity ? `${actorName(activity.actorId)} · ${activity.entityLabel}` : pick("Belum ada aktivitas", "No activity yet"),
        facts: activity ? [{ label: pick("Waktu", "When"), value: formatDateTime(activity.timestamp) }] : [],
        status: activity ? "ready" : "not_started",
        href: "/administration/audit",
        cta: pick("Lihat riwayat aktivitas", "View audit log"),
        details: [],
      },
    ];

    return {
      context: {
        product: product ? { id: product.id, name: product.name, sku: product.sku, category: product.category } : null,
        runId: run?.id ?? null,
        runName: run?.name ?? null,
        horizonDays: run?.horizonDays ?? null,
        generatedAt: run?.completedAt ?? null,
        scope: product ? product.category : run ? run.scope.categories.join(", ") || pick("Semua kategori", "All categories") : "—",
        locations: run ? pick(`${run.scope.locationCount} lokasi · ${regionCount} wilayah`, `${run.scope.locationCount} locations · ${regionCount} regions`) : "—",
      },
      nodes,
    };
  });
}
