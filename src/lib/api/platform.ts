import type { ApiKey, ApiScope, ForecastSchedule, NotificationRules, SavedView, Webhook, WebhookEvent } from "@/types/domain";
import { audit, getDb, nextId } from "@/lib/mock/db";
import { defaultNotificationRules, nextRunAt } from "@/lib/mock/platform";
import { addDays, iso, isoDate } from "@/lib/mock/time";
import { authorize, ApiError, read, write, type ApiContext } from "./client";
import { createRun, syncRuns } from "./forecasting";
import { localized, pick } from "@/lib/i18n/core";

/* ── Forecast schedules (PLAT-007) ─────────────────────────────────── */

export type ScheduleRow = ForecastSchedule & { nextRunAt: string | null; lastRunStatus: string | null };

export function listSchedules(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    syncRuns(db);
    return db.platform.schedules.map<ScheduleRow>((s) => ({
      ...s,
      nextRunAt: nextRunAt(s),
      lastRunStatus: s.lastRunId ? (db.runs.find((r) => r.id === s.lastRunId)?.status ?? null) : null,
    }));
  });
}

export type ScheduleInput = Omit<ForecastSchedule, "id" | "ownerId" | "createdAt" | "lastRunId" | "lastRunAt">;

function validateSchedule(input: ScheduleInput) {
  if (input.name.trim().length < 3) throw new ApiError(pick("Beri nama jadwal (minimal 3 karakter).", "Name the schedule (at least 3 characters)."), "validation");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new ApiError(pick("Masukkan waktu sebagai JJ:MM (24 jam).", "Enter the time as HH:MM (24-hour)."), "validation");
  if (input.horizonDays < 1 || input.horizonDays > 180) throw new ApiError(pick("Periode harus antara 1 dan 180 hari.", "The horizon must be between 1 and 180 days."), "validation");
}

export function saveSchedule(ctx: ApiContext, id: string | null, input: ScheduleInput) {
  return write(ctx, "forecast.run.create", () => {
    const db = getDb(ctx.workspaceId);
    validateSchedule(input);
    // Automatic publication replaces the planning baseline without review, so it needs publish rights.
    if (input.autoPublish) authorize(ctx, "forecast.run.publish");
    if (id) {
      const s = db.platform.schedules.find((x) => x.id === id);
      if (!s) throw new ApiError(pick("Jadwal tidak ditemukan.", "Schedule not found."), "not_found");
      const prev = `${s.enabled ? "enabled" : "paused"}${s.autoPublish ? ", auto-publish" : ""}`;
      Object.assign(s, input);
      audit(db, { actorId: ctx.userId, action: "change_settings", entityType: "settings", entityId: s.id, entityLabel: pick(`Jadwal · ${s.name}`, `Schedule · ${s.name}`), previousState: prev, newState: `${s.enabled ? "enabled" : "paused"}${s.autoPublish ? ", auto-publish" : ""}`, reason: null, source: "web" });
      return s;
    }
    const s: ForecastSchedule = { id: nextId(db, "sch"), ...input, ownerId: ctx.userId, createdAt: iso(Date.now()), lastRunId: null, lastRunAt: null };
    db.platform.schedules.push(s);
    audit(db, { actorId: ctx.userId, action: "change_settings", entityType: "settings", entityId: s.id, entityLabel: pick(`Jadwal · ${s.name}`, `Schedule · ${s.name}`), previousState: null, newState: "created", reason: null, source: "web" });
    return s;
  });
}

export function setScheduleEnabled(ctx: ApiContext, id: string, enabled: boolean) {
  return write(ctx, "forecast.run.create", () => {
    const db = getDb(ctx.workspaceId);
    const s = db.platform.schedules.find((x) => x.id === id);
    if (!s) throw new ApiError(pick("Jadwal tidak ditemukan.", "Schedule not found."), "not_found");
    s.enabled = enabled;
    audit(db, { actorId: ctx.userId, action: "change_settings", entityType: "settings", entityId: s.id, entityLabel: pick(`Jadwal · ${s.name}`, `Schedule · ${s.name}`), previousState: enabled ? "paused" : "enabled", newState: enabled ? "enabled" : "paused", reason: null, source: "web" });
    return s;
  });
}

export function deleteSchedule(ctx: ApiContext, id: string) {
  return write(ctx, "forecast.run.create", () => {
    const db = getDb(ctx.workspaceId);
    const s = db.platform.schedules.find((x) => x.id === id);
    if (!s) throw new ApiError(pick("Jadwal tidak ditemukan.", "Schedule not found."), "not_found");
    db.platform.schedules = db.platform.schedules.filter((x) => x.id !== id);
    audit(db, { actorId: ctx.userId, action: "change_settings", entityType: "settings", entityId: id, entityLabel: pick(`Jadwal · ${s.name}`, `Schedule · ${s.name}`), previousState: "active", newState: "deleted", reason: null, source: "web" });
    return true;
  });
}

/** Starts the scheduled configuration now, as a normal (validated, audited) run. */
export async function runScheduleNow(ctx: ApiContext, id: string) {
  const db = getDb(ctx.workspaceId);
  const s = db.platform.schedules.find((x) => x.id === id);
  if (!s) throw new ApiError(pick("Jadwal tidak ditemukan.", "Schedule not found."), "not_found");
  const run = await createRun(ctx, {
    name: `${s.name} (manual)`,
    businessUnit: "Grocery Retail",
    regions: s.regions,
    categories: s.categories,
    historicalStart: isoDate(addDays(db.today, -db.settings.forecasting.historyWindowDays)),
    historicalEnd: isoDate(addDays(db.today, -1)),
    frequency: "daily",
    horizonDays: s.horizonDays,
    modelId: s.modelId ?? db.settings.forecasting.defaultModelId,
  });
  s.lastRunId = run.id;
  s.lastRunAt = run.createdAt;
  return run;
}

/* ── API keys (PLAT-001) ───────────────────────────────────────────── */

function secret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 57]).join("");
}

export function listApiKeys(ctx: ApiContext) {
  return read(() => {
    authorize(ctx, "api.manage");
    const db = getDb(ctx.workspaceId);
    const now = Date.now();
    for (const k of db.platform.apiKeys) if (k.status === "active" && k.expiresAt && new Date(k.expiresAt).getTime() < now) k.status = "expired";
    return [...db.platform.apiKeys].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

/** Returns the full secret exactly once; only the prefix is stored. */
export function createApiKey(ctx: ApiContext, input: { name: string; scopes: ApiScope[]; expiresInDays: number | null }) {
  return write(ctx, "api.manage", () => {
    const db = getDb(ctx.workspaceId);
    if (input.name.trim().length < 3) throw new ApiError(pick("Beri nama key sesuai sistem yang akan memakainya.", "Name the key after the system that will use it."), "validation");
    if (input.scopes.length === 0) throw new ApiError(pick("Pilih minimal satu cakupan.", "Choose at least one scope."), "validation");
    const value = `mdf_live_${secret()}`;
    const key: ApiKey = {
      id: nextId(db, "key"),
      name: input.name.trim(),
      prefix: value.slice(0, 13),
      scopes: input.scopes,
      createdBy: ctx.userId,
      createdAt: iso(Date.now()),
      expiresAt: input.expiresInDays ? iso(Date.now() + input.expiresInDays * 86_400_000) : null,
      lastUsedAt: null,
      status: "active",
    };
    db.platform.apiKeys.push(key);
    audit(db, { actorId: ctx.userId, action: "change_permissions", entityType: "settings", entityId: key.id, entityLabel: pick(`API key · ${key.name}`, `API key · ${key.name}`), previousState: null, newState: `created (${key.scopes.join(", ")})`, reason: null, source: "web" });
    return { key, secret: value };
  });
}

export function rotateApiKey(ctx: ApiContext, id: string) {
  return write(ctx, "api.manage", () => {
    const db = getDb(ctx.workspaceId);
    const key = db.platform.apiKeys.find((k) => k.id === id);
    if (!key) throw new ApiError(pick("API key tidak ditemukan.", "API key not found."), "not_found");
    if (key.status !== "active") throw new ApiError(pick("Hanya key aktif yang dapat diputar.", "Only active keys can be rotated."), "conflict");
    const value = `mdf_live_${secret()}`;
    const old = key.prefix;
    key.prefix = value.slice(0, 13);
    key.createdAt = iso(Date.now());
    key.lastUsedAt = null;
    audit(db, { actorId: ctx.userId, action: "change_permissions", entityType: "settings", entityId: key.id, entityLabel: pick(`API key · ${key.name}`, `API key · ${key.name}`), previousState: `${old}…`, newState: `${key.prefix}… (rotated)`, reason: null, source: "web" });
    return { key, secret: value };
  });
}

export function revokeApiKey(ctx: ApiContext, id: string) {
  return write(ctx, "api.manage", () => {
    const db = getDb(ctx.workspaceId);
    const key = db.platform.apiKeys.find((k) => k.id === id);
    if (!key) throw new ApiError(pick("API key tidak ditemukan.", "API key not found."), "not_found");
    const prev = key.status;
    key.status = "revoked";
    audit(db, { actorId: ctx.userId, action: "change_permissions", entityType: "settings", entityId: key.id, entityLabel: pick(`API key · ${key.name}`, `API key · ${key.name}`), previousState: prev, newState: "revoked", reason: null, source: "web" });
    return key;
  });
}

/* ── Webhooks (PLAT-002) ───────────────────────────────────────────── */

export function listWebhooks(ctx: ApiContext) {
  return read(() => {
    authorize(ctx, "api.manage");
    return getDb(ctx.workspaceId).platform.webhooks;
  });
}

export function createWebhook(ctx: ApiContext, input: { url: string; description: string; events: WebhookEvent[] }) {
  return write(ctx, "api.manage", () => {
    const db = getDb(ctx.workspaceId);
    let url: URL;
    try {
      url = new URL(input.url.trim());
    } catch {
      throw new ApiError(pick("Masukkan URL lengkap, misalnya https://example.com/hooks/mesta.", "Enter a full URL, for example https://example.com/hooks/mesta."), "validation");
    }
    if (url.protocol !== "https:") throw new ApiError(pick("Endpoint webhook harus memakai HTTPS.", "Webhook endpoints must use HTTPS."), "validation");
    if (input.events.length === 0) throw new ApiError(pick("Pilih minimal satu kejadian.", "Choose at least one event."), "validation");
    const hook: Webhook = { id: nextId(db, "whk"), url: url.toString(), description: input.description.trim(), events: input.events, enabled: true, createdBy: ctx.userId, createdAt: iso(Date.now()), deliveries: [] };
    db.platform.webhooks.push(hook);
    audit(db, { actorId: ctx.userId, action: "integration_update", entityType: "settings", entityId: hook.id, entityLabel: `Webhook · ${url.host}`, previousState: null, newState: pick(`dibuat (${hook.events.length} kejadian)`, `created (${hook.events.length} events)`), reason: null, source: "web" });
    return hook;
  });
}

export function setWebhookEnabled(ctx: ApiContext, id: string, enabled: boolean) {
  return write(ctx, "api.manage", () => {
    const db = getDb(ctx.workspaceId);
    const hook = db.platform.webhooks.find((w) => w.id === id);
    if (!hook) throw new ApiError(pick("Webhook tidak ditemukan.", "Webhook not found."), "not_found");
    hook.enabled = enabled;
    audit(db, { actorId: ctx.userId, action: "integration_update", entityType: "settings", entityId: id, entityLabel: `Webhook · ${new URL(hook.url).host}`, previousState: enabled ? "disabled" : "enabled", newState: enabled ? "enabled" : "disabled", reason: null, source: "web" });
    return hook;
  });
}

export function deleteWebhook(ctx: ApiContext, id: string) {
  return write(ctx, "api.manage", () => {
    const db = getDb(ctx.workspaceId);
    const hook = db.platform.webhooks.find((w) => w.id === id);
    if (!hook) throw new ApiError(pick("Webhook tidak ditemukan.", "Webhook not found."), "not_found");
    db.platform.webhooks = db.platform.webhooks.filter((w) => w.id !== id);
    audit(db, { actorId: ctx.userId, action: "integration_update", entityType: "settings", entityId: id, entityLabel: `Webhook · ${new URL(hook.url).host}`, previousState: "enabled", newState: "deleted", reason: null, source: "web" });
    return true;
  });
}

/** Sends a signed test event. Mock: endpoints on the "alerts" host are currently failing. */
export function testWebhook(ctx: ApiContext, id: string) {
  return write(ctx, "api.manage", () => {
    const db = getDb(ctx.workspaceId);
    const hook = db.platform.webhooks.find((w) => w.id === id);
    if (!hook) throw new ApiError(pick("Webhook tidak ditemukan.", "Webhook not found."), "not_found");
    const failing = new URL(hook.url).host.startsWith("alerts.");
    const delivery = { id: nextId(db, "dlv"), event: hook.events[0] as WebhookEvent, at: iso(Date.now()), status: failing ? 503 : 200, durationMs: failing ? 10_000 : 140 + Math.round(Math.random() * 200), attempt: 1 };
    hook.deliveries.unshift(delivery);
    return delivery;
  });
}

export const WEBHOOK_EVENTS: { value: WebhookEvent; label: string }[] = localized(
  [
    { value: "forecast_run.completed", label: "Proses perkiraan selesai" },
    { value: "forecast_run.failed", label: "Proses perkiraan gagal" },
    { value: "forecast_run.published", label: "Proses perkiraan diterbitkan" },
    { value: "approval.decided", label: "Persetujuan diputuskan" },
    { value: "plan.published", label: "Rencana diterbitkan" },
    { value: "data_quality.blocking", label: "Masalah data yang menghambat" },
  ],
  [
    { value: "forecast_run.completed", label: "Forecast run completed" },
    { value: "forecast_run.failed", label: "Forecast run failed" },
    { value: "forecast_run.published", label: "Forecast run published" },
    { value: "approval.decided", label: "Approval decided" },
    { value: "plan.published", label: "Plan published" },
    { value: "data_quality.blocking", label: "Blocking data issue" },
  ],
);

export const API_SCOPES: { value: ApiScope; label: string; description: string }[] = localized(
  [
    { value: "forecasts:read", label: "Baca perkiraan", description: "Proses terbit, baris perkiraan, dan rentangnya." },
    { value: "plans:read", label: "Baca rencana", description: "Rencana terbit dan jumlah yang direncanakan." },
    { value: "runs:write", label: "Buat proses perkiraan", description: "Memulai proses dengan pengaturan yang sudah divalidasi." },
    { value: "demand:write", label: "Muat data permintaan", description: "Mengirim data permintaan historis." },
    { value: "audit:read", label: "Baca riwayat aktivitas", description: "Mengekspor kejadian audit untuk alat kepatuhan." },
  ],
  [
    { value: "forecasts:read", label: "Read forecasts", description: "Published runs, forecast rows and intervals." },
    { value: "plans:read", label: "Read plans", description: "Published plans and planned quantities." },
    { value: "runs:write", label: "Create forecast runs", description: "Start runs with validated configuration." },
    { value: "demand:write", label: "Load demand data", description: "Push historical demand records." },
    { value: "audit:read", label: "Read audit log", description: "Export audit events for compliance tools." },
  ],
);

/* ── Saved views (PLAT-004) ────────────────────────────────────────── */

export function listSavedViews(ctx: ApiContext, surface: SavedView["surface"]) {
  return read(() => getDb(ctx.workspaceId).platform.savedViews.filter((v) => v.surface === surface && (v.shared || v.ownerId === ctx.userId)));
}

export function saveView(ctx: ApiContext, input: { name: string; surface: SavedView["surface"]; query: string; shared: boolean }) {
  return write(ctx, null, () => {
    const db = getDb(ctx.workspaceId);
    if (input.name.trim().length < 2) throw new ApiError(pick("Beri nama tampilan.", "Name the view."), "validation");
    if (db.platform.savedViews.some((v) => v.surface === input.surface && v.ownerId === ctx.userId && v.name.toLowerCase() === input.name.trim().toLowerCase())) {
      throw new ApiError(pick("Anda sudah punya tampilan dengan nama ini.", "You already have a view with this name."), "conflict");
    }
    const view: SavedView = { id: nextId(db, "view"), name: input.name.trim(), surface: input.surface, query: input.query, ownerId: ctx.userId, shared: input.shared, createdAt: iso(Date.now()) };
    db.platform.savedViews.push(view);
    return view;
  });
}

export function deleteView(ctx: ApiContext, id: string) {
  return write(ctx, null, () => {
    const db = getDb(ctx.workspaceId);
    const view = db.platform.savedViews.find((v) => v.id === id);
    if (!view) throw new ApiError(pick("Tampilan tidak ditemukan.", "View not found."), "not_found");
    if (view.ownerId !== ctx.userId) throw new ApiError(pick("Hanya pemilik yang dapat menghapus tampilan.", "Only the owner can delete a view."), "permission");
    db.platform.savedViews = db.platform.savedViews.filter((v) => v.id !== id);
    return true;
  });
}

/* ── Notification rules (PLAT-006) ─────────────────────────────────── */

export function getNotificationRules(ctx: ApiContext) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    return structuredClone(db.platform.notificationRules[ctx.userId] ?? defaultNotificationRules());
  });
}

export function updateNotificationRules(ctx: ApiContext, rules: NotificationRules) {
  return write(ctx, null, () => {
    const db = getDb(ctx.workspaceId);
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (rules.quietHours.enabled && (!hhmm.test(rules.quietHours.start) || !hhmm.test(rules.quietHours.end))) {
      throw new ApiError(pick("Masukkan jam tenang sebagai JJ:MM (24 jam).", "Enter quiet hours as HH:MM (24-hour)."), "validation");
    }
    // Approval requests addressed to you cannot be switched off in-app.
    const next = structuredClone(rules);
    if (!next.channels.approval_requested.includes("in_app")) next.channels.approval_requested.unshift("in_app");
    db.platform.notificationRules[ctx.userId] = next;
    return next;
  });
}
