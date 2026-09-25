import type { ApiKey, ForecastSchedule, NotificationCategory, NotificationRules, SavedView, Webhook, WebhookDelivery, WebhookEvent } from "@/types/domain";
import type { WorkspaceDb } from "./db";
import { createRng } from "./random";
import { addDays, DAY_MS, HOUR_MS, iso, MINUTE_MS } from "./time";

export type PlatformState = {
  schedules: ForecastSchedule[];
  apiKeys: ApiKey[];
  webhooks: Webhook[];
  savedViews: SavedView[];
  /** Per-user notification delivery rules. */
  notificationRules: Record<string, NotificationRules>;
};

const CATEGORIES: NotificationCategory[] = [
  "forecast_completed",
  "forecast_failed",
  "data_quality",
  "data_freshness",
  "approval_requested",
  "approval_completed",
  "exception_opened",
  "scenario_completed",
  "model_issue",
];

export function defaultNotificationRules(): NotificationRules {
  return {
    channels: Object.fromEntries(
      CATEGORIES.map((c) => [c, c === "exception_opened" ? [] : c === "approval_requested" || c === "forecast_failed" || c === "data_quality" ? ["in_app", "email"] : ["in_app"]]),
    ) as NotificationRules["channels"],
    quietHours: { enabled: false, start: "20:00", end: "07:00" },
    minExceptionSeverity: "critical",
    digest: "daily",
  };
}

function deliveries(seed: number, events: WebhookEvent[], now: number, failing: boolean): WebhookDelivery[] {
  const rng = createRng(seed);
  return Array.from({ length: 12 }, (_, i) => {
    const fail = failing && i < 3;
    return {
      id: `dlv_${seed}_${i}`,
      event: rng.pick(events),
      at: iso(now - (i * 3 + rng.int(0, 2)) * HOUR_MS - rng.int(0, 50) * MINUTE_MS),
      status: fail ? (i === 0 ? 503 : 500) : 200,
      durationMs: fail ? 10_000 : rng.int(80, 420),
      attempt: fail ? 3 : 1,
    };
  });
}

export function seedPlatform(db: WorkspaceDb, now: number, fresh: boolean): PlatformState {
  if (fresh) return { schedules: [], apiKeys: [], webhooks: [], savedViews: [], notificationRules: {} };
  const daily = db.runs.find((r) => r.name.startsWith("Daily refresh") && r.status === "published");
  return {
    schedules: [
      {
        id: "sch_daily",
        name: "Penyegaran harian · Semua kategori",
        cadence: { type: "daily" },
        time: "05:30",
        categories: [],
        regions: [],
        horizonDays: 28,
        modelId: null,
        autoPublish: false,
        enabled: true,
        ownerId: "u_sari",
        createdAt: iso(now - 120 * DAY_MS),
        lastRunId: daily?.id ?? null,
        lastRunAt: daily?.createdAt ?? null,
      },
      {
        id: "sch_weekly_90",
        name: "Perkiraan mingguan 90 hari",
        cadence: { type: "weekly", weekday: 1 },
        time: "06:00",
        categories: [],
        regions: [],
        horizonDays: 90,
        modelId: "mdl_gbm_24",
        autoPublish: false,
        enabled: false,
        ownerId: "u_yoga",
        createdAt: iso(now - 60 * DAY_MS),
        lastRunId: null,
        lastRunAt: iso(addDays(db.today, -11) + 6 * HOUR_MS),
      },
    ],
    apiKeys: [
      { id: "key_1", name: "Sistem pengisian ulang (baca perkiraan)", prefix: "mdf_live_7Kq2", scopes: ["forecasts:read", "plans:read"], createdBy: "u_budi", createdAt: iso(now - 90 * DAY_MS), expiresAt: iso(now + 275 * DAY_MS), lastUsedAt: iso(now - 12 * MINUTE_MS), status: "active" },
      { id: "key_2", name: "Pemuatan gudang data", prefix: "mdf_live_P9xa", scopes: ["demand:write"], createdBy: "u_lina", createdAt: iso(now - 200 * DAY_MS), expiresAt: iso(now + 20 * DAY_MS), lastUsedAt: iso(now - 9 * HOUR_MS), status: "active" },
      { id: "key_3", name: "Ekspor BI lama", prefix: "mdf_live_m1Tz", scopes: ["forecasts:read", "audit:read"], createdBy: "u_budi", createdAt: iso(now - 400 * DAY_MS), expiresAt: iso(now - 35 * DAY_MS), lastUsedAt: iso(now - 40 * DAY_MS), status: "expired" },
    ],
    webhooks: [
      {
        id: "whk_1",
        url: "https://replenishment.mestaretail.example/hooks/forecast",
        description: "Beri tahu pengisian ulang saat acuan diterbitkan",
        events: ["forecast_run.published", "plan.published"],
        enabled: true,
        createdBy: "u_budi",
        createdAt: iso(now - 80 * DAY_MS),
        deliveries: deliveries(11, ["forecast_run.published", "plan.published"], now, false),
      },
      {
        id: "whk_2",
        url: "https://alerts.mestaretail.example/mesta",
        description: "Peringatan operasional",
        events: ["forecast_run.failed", "data_quality.blocking"],
        enabled: true,
        createdBy: "u_lina",
        createdAt: iso(now - 30 * DAY_MS),
        deliveries: deliveries(22, ["forecast_run.failed", "data_quality.blocking"], now, true),
      },
    ],
    savedViews: [
      { id: "view_1", name: "Minuman perlu ditinjau", surface: "explorer", query: "category=Beverages&status=needs_review", ownerId: "u_rina", shared: true, createdAt: iso(now - 10 * DAY_MS) },
      { id: "view_2", name: "Penurunan terbesar", surface: "explorer", query: "sort=deltaPercent&dir=asc&delta=decrease", ownerId: "u_dimas", shared: true, createdAt: iso(now - 4 * DAY_MS) },
      { id: "view_3", name: "Item kritis saya yang terbuka", surface: "exceptions", query: "severity=critical&status=open,investigating", ownerId: "u_rina", shared: false, createdAt: iso(now - 2 * DAY_MS) },
    ],
    notificationRules: {},
  };
}

export const WEEKDAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** Next execution time for a schedule, in local time. */
export function nextRunAt(s: Pick<ForecastSchedule, "cadence" | "time" | "enabled">, now = Date.now()): string | null {
  if (!s.enabled) return null;
  const [h, m] = s.time.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  if (s.cadence.type === "daily") {
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.toISOString();
  }
  const diff = (s.cadence.weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  if (d.getTime() <= now) d.setDate(d.getDate() + 7);
  return d.toISOString();
}
