import type {
  Approval,
  AppNotification,
  AuditEvent,
  Backtest,
  DataQualityIssue,
  DataSource,
  ForecastException,
  ForecastModel,
  ForecastPoint,
  ForecastRow,
  ForecastRun,
  Location,
  Override,
  Plan,
  PlanLine,
  Product,
  Role,
  Scenario,
  Workspace,
} from "@/types/domain";
import { CATEGORIES, generateLocations, generateProducts, REGIONS } from "./catalog";
import { USERS, WORKSPACE_PROFILE, WORKSPACES } from "./directory";
import { modelProfile, seedModels } from "./models";
import { createRng } from "./random";
import { completedSteps, failedSteps, pendingSteps } from "./runs";
import { createAggregator, HISTORY_DAYS, productParams, simulate, summarise, type SeriesParams } from "./series";
import { addDays, DAY_MS, HOUR_MS, iso, isoDate, MINUTE_MS, startOfToday } from "./time";
import { seedScenarios } from "./scenarios";
import { seedBacktests } from "./backtests";
import { seedPlatform, type PlatformState } from "./platform";
import { pick } from "@/lib/i18n/core";

export type WorkspaceSettings = {
  forecasting: {
    defaultHorizonDays: number;
    defaultFrequency: "daily" | "weekly";
    defaultModelId: string;
    historyWindowDays: number;
  };
  exceptions: {
    deltaThreshold: number;
    intervalWidthThreshold: number;
    freshnessHours: number;
  };
  approvals: {
    overrideDeltaThreshold: number;
    overrideUnitsThreshold: number;
    planPublishRequiresApproval: boolean;
    approverRole: Role;
  };
  notifications: Record<string, boolean>;
  audit: { retentionDays: number; exportEnabled: boolean };
  security: { sessionHours: number; enforceSso: boolean; allowedDomains: string[] };
};

export type RunResult = {
  rows: ForecastRow[];
  aggregate: ForecastPoint[];
  byCategory: { category: string; forecast: number; previous: number; actualLast: number }[];
};

export type WorkspaceDb = {
  workspace: Workspace;
  seed: number;
  today: number;
  products: Product[];
  productById: Map<string, Product>;
  locations: Location[];
  params: Map<string, SeriesParams>;
  models: ForecastModel[];
  runs: ForecastRun[];
  runResults: Map<string, RunResult>;
  sources: DataSource[];
  dqIssues: DataQualityIssue[];
  exceptions: ForecastException[];
  overrides: Override[];
  approvals: Approval[];
  scenarios: Scenario[];
  plan: Plan;
  notifications: AppNotification[];
  audit: AuditEvent[];
  backtests: Backtest[];
  settings: WorkspaceSettings;
  members: { userId: string; role: Role; status: "active" | "invited" | "suspended"; lastActiveAt: string | null }[];
  counter: number;
  onboarding: { dismissed: boolean; workspaceConfirmed: boolean; readinessChecked: boolean; notificationsReviewed: boolean };
  platform: PlatformState;
};

const dbs = new Map<string, WorkspaceDb>();

export function getDb(workspaceId: string): WorkspaceDb {
  let db = dbs.get(workspaceId);
  if (!db) {
    db = createDb(workspaceId);
    dbs.set(workspaceId, db);
  }
  return db;
}

/** Test helper: drop all in-memory state. */
export function resetDbs() {
  dbs.clear();
}

export function nextId(db: WorkspaceDb, prefix: string) {
  db.counter += 1;
  return `${prefix}_${db.counter.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function requestId() {
  return `req_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-4)}`;
}

export function paramsFor(db: WorkspaceDb, productId: string) {
  let p = db.params.get(productId);
  if (!p) {
    const product = db.productById.get(productId);
    if (!product) throw new Error(`Unknown product ${productId}`);
    p = productParams(product, db.seed);
    db.params.set(productId, p);
  }
  return p;
}

export function runScale(run: ForecastRun) {
  return run.scope.regions.length === 0 ? 1 : run.scope.regions.length / REGIONS.length;
}

export function productsInScope(db: WorkspaceDb, run: Pick<ForecastRun, "scope">) {
  const cats = run.scope.categories;
  return cats.length === 0 ? db.products : db.products.filter((p) => cats.includes(p.category));
}

/** Computes (and caches) the rows and aggregate series for a completed run. */
export function runResult(db: WorkspaceDb, run: ForecastRun): RunResult {
  const cached = db.runResults.get(run.id);
  if (cached) return cached;
  const model = db.models.find((m) => m.id === run.modelId);
  const profile = modelProfile(model);
  const scale = runScale(run);
  const products = productsInScope(db, run);
  const length = HISTORY_DAYS + run.horizonDays;
  const dates = Array.from({ length }, (_, i) => db.today + (i - HISTORY_DAYS) * DAY_MS);
  const agg = createAggregator(length, dates, HISTORY_DAYS);
  const byCat = new Map<string, { forecast: number; previous: number; actualLast: number }>();
  const rows: ForecastRow[] = [];
  const updatedAt = run.completedAt ?? iso(db.today);
  for (const product of products) {
    const s = simulate(paramsFor(db, product.id), { today: db.today, horizonDays: run.horizonDays, model: profile, scale });
    agg.add(s);
    const sum = summarise(s, run.horizonDays);
    const c = byCat.get(product.category) ?? { forecast: 0, previous: 0, actualLast: 0 };
    c.forecast += sum.forecast;
    c.previous += sum.previous;
    c.actualLast += sum.actualLast;
    byCat.set(product.category, c);
    const delta = sum.forecast - sum.previous;
    rows.push({
      id: `${run.id}:${product.id}`,
      runId: run.id,
      productId: product.id,
      forecast: sum.forecast,
      previousForecast: sum.previous,
      actualLastPeriod: sum.actualLast,
      delta,
      deltaPercent: sum.previous > 0 ? delta / sum.previous : 0,
      lowerBound: sum.lower,
      upperBound: sum.upper,
      coverage: 0.8,
      trend: sum.trend,
      status: "normal",
      exceptionCount: 0,
      overrideUnits: null,
      updatedAt,
    });
  }
  const result: RunResult = {
    rows,
    aggregate: agg.points(),
    byCategory: CATEGORIES.filter((c) => byCat.has(c)).map((category) => ({ category, ...(byCat.get(category) as { forecast: number; previous: number; actualLast: number }) })),
  };
  db.runResults.set(run.id, result);
  return result;
}

/** The run used as the planning baseline: the most recently published one. */
export function baselineRun(db: WorkspaceDb) {
  return [...db.runs]
    .filter((r) => r.status === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))[0];
}

export function audit(
  db: WorkspaceDb,
  event: Omit<AuditEvent, "eventId" | "workspaceId" | "requestId" | "timestamp"> & { timestamp?: string },
) {
  const e: AuditEvent = {
    eventId: nextId(db, "evt"),
    workspaceId: db.workspace.id,
    requestId: requestId(),
    timestamp: event.timestamp ?? new Date().toISOString(),
    ...event,
  };
  db.audit.unshift(e);
  return e;
}

/* ───────────────────────────────────────────────────────────────────── */

function createDb(workspaceId: string): WorkspaceDb {
  const workspace = WORKSPACES.find((w) => w.id === workspaceId);
  if (!workspace) throw new Error(`Unknown workspace ${workspaceId}`);
  const profile = WORKSPACE_PROFILE[workspaceId] ?? { products: 360, locations: 12, seed: 9 };
  const today = startOfToday();
  const now = Date.now();
  const rng = createRng(profile.seed);
  const products = generateProducts(profile.products, profile.seed);
  const locations = generateLocations(profile.locations, profile.seed + 1);
  const models = seedModels(today, products.length);
  const members = USERS.filter((u) => u.workspaceIds.includes(workspaceId)).map((u) => ({
    userId: u.id,
    role: u.role,
    status: u.status,
    lastActiveAt: u.status === "active" ? iso(now - rng.int(5, 60 * 30) * MINUTE_MS) : null,
  }));

  const db: WorkspaceDb = {
    workspace,
    seed: profile.seed,
    today,
    products,
    productById: new Map(products.map((p) => [p.id, p])),
    locations,
    params: new Map(),
    models,
    runs: [],
    runResults: new Map(),
    sources: [],
    dqIssues: [],
    exceptions: [],
    overrides: [],
    approvals: [],
    scenarios: [],
    plan: undefined as unknown as Plan,
    notifications: [],
    audit: [],
    backtests: [],
    settings: {
      forecasting: { defaultHorizonDays: 28, defaultFrequency: "daily", defaultModelId: "mdl_gbm_24", historyWindowDays: 365 },
      exceptions: { deltaThreshold: 0.15, intervalWidthThreshold: 0.9, freshnessHours: 24 },
      approvals: { overrideDeltaThreshold: 0.05, overrideUnitsThreshold: 5000, planPublishRequiresApproval: true, approverRole: "manager" },
      notifications: {
        forecast_completed: true,
        forecast_failed: true,
        data_quality: true,
        data_freshness: true,
        approval_requested: true,
        approval_completed: true,
        exception_opened: false,
        scenario_completed: true,
        model_issue: true,
      },
      audit: { retentionDays: 365, exportEnabled: true },
      security: { sessionHours: 12, enforceSso: true, allowedDomains: ["mesta.click", "mesta.co.id"] },
    },
    members,
    counter: 100,
    platform: { schedules: [], apiKeys: [], webhooks: [], savedViews: [], notificationRules: {} },
    onboarding: { dismissed: !profile.fresh, workspaceConfirmed: !profile.fresh, readinessChecked: !profile.fresh, notificationsReviewed: !profile.fresh },
  };

  if (profile.fresh) {
    seedFreshWorkspace(db, now);
    return db;
  }

  seedSources(db, now);
  seedRuns(db, now);
  seedDataQuality(db, now);
  seedExceptionsAndOverrides(db, now);
  db.scenarios = seedScenarios(db, now);
  seedPlan(db, now);
  seedApprovals(db, now);
  db.backtests = seedBacktests(db, now);
  seedNotifications(db, now);
  seedAudit(db, now);
  db.platform = seedPlatform(db, now, false);
  return db;
}

/** A new workspace: catalogue loaded from the warehouse, nothing else configured yet. */
function seedFreshWorkspace(db: WorkspaceDb, now: number) {
  seedSources(db, now);
  db.sources = db.sources.map((s) =>
    s.id === "src_dwh"
      ? { ...s, status: "connected", lastSyncAt: iso(now - 50 * MINUTE_MS), lastSuccessAt: iso(now - 50 * MINUTE_MS), lastFailureAt: null, lastError: null }
      : { ...s, status: "disconnected", lastSyncAt: null, lastSuccessAt: null, lastFailureAt: null, lastError: null, records: 0 },
  );
  db.plan = {
    id: "plan_first",
    name: "First replenishment plan",
    periodStart: isoDate(db.today),
    periodEnd: isoDate(addDays(db.today, 27)),
    baselineRunId: "",
    status: "draft",
    ownerId: "u_rina",
    updatedAt: iso(now),
    lines: [],
  };
  db.notifications = [
    {
      id: "ntf_welcome",
      category: "approval_completed",
      title: pick("Ruang kerja dibuat: New Market Launch", "Workspace created: New Market Launch"),
      body: pick("Selesaikan persiapan untuk memuat data permintaan dan menjalankan perkiraan pertama.", "Finish setup to load demand data and run the first forecast."),
      href: "/onboarding",
      createdAt: iso(now - 2 * HOUR_MS),
      read: false,
    },
  ];
  db.audit = [
    {
      eventId: "evt_seed_fresh_1",
      workspaceId: db.workspace.id,
      requestId: requestId(),
      timestamp: iso(now - 2 * HOUR_MS),
      actorId: "u_budi",
      action: "change_settings",
      entityType: "workspace",
      entityId: db.workspace.id,
      entityLabel: `${db.workspace.name} · ${db.workspace.environment}`,
      previousState: null,
      newState: "created",
      reason: pick("Percontohan pasar baru", "New market pilot"),
      source: "web",
    },
  ];
}

function seedSources(db: WorkspaceDb, now: number) {
  const skus = db.products.length;
  const locs = db.locations.length;
  db.sources = [
    {
      id: "src_pos",
      name: "POS transactions",
      type: "POS",
      status: "connected",
      schedule: "Every hour",
      lastSyncAt: iso(now - 14 * MINUTE_MS),
      lastSuccessAt: iso(now - 14 * MINUTE_MS),
      lastFailureAt: iso(now - 3 * DAY_MS - 2 * HOUR_MS),
      lastError: null,
      records: skus * locs * 182,
      owner: "u_lina",
      mapping: [
        { source: "txn_date", target: "date" },
        { source: "article_no", target: "sku" },
        { source: "store_code", target: "location_id" },
        { source: "qty_sold", target: "units" },
      ],
      description: pick("Baris penjualan kasir yang digabung menjadi SKU × toko × hari.", "Point-of-sale sales lines aggregated to SKU × store × day."),
    },
    {
      id: "src_erp",
      name: "ERP sales orders",
      type: "ERP",
      status: "warning",
      schedule: "Daily at 02:00",
      lastSyncAt: iso(db.today + 2 * HOUR_MS + 11 * MINUTE_MS),
      lastSuccessAt: iso(db.today + 2 * HOUR_MS + 11 * MINUTE_MS),
      lastFailureAt: null,
      lastError: "38 order lines reference SKUs that are not in the product master.",
      records: Math.round(skus * 410),
      owner: "u_lina",
      mapping: [
        { source: "order_date", target: "date" },
        { source: "material", target: "sku" },
        { source: "plant", target: "location_id" },
        { source: "order_qty", target: "units" },
      ],
      description: pick("Pesanan grosir dan B2B dari ERP, dipakai untuk permintaan non-POS.", "Wholesale and B2B orders from the ERP, used for non-POS demand."),
    },
    {
      id: "src_dwh",
      name: pick("Gudang data perusahaan", "Enterprise data warehouse"),
      type: "Data warehouse",
      status: "connected",
      schedule: "Daily at 04:30",
      lastSyncAt: iso(db.today + 4 * HOUR_MS + 42 * MINUTE_MS),
      lastSuccessAt: iso(db.today + 4 * HOUR_MS + 42 * MINUTE_MS),
      lastFailureAt: null,
      lastError: null,
      records: skus + locs,
      owner: "u_budi",
      mapping: [
        { source: "dim_product", target: "product master" },
        { source: "dim_store", target: "location master" },
      ],
      description: pick("Master data produk dan toko, hierarki, dan atributnya.", pick("Data master produk dan toko, hierarki, dan atribut.", "Product and store master data, hierarchy and attributes.")),
    },
    {
      id: "src_promo",
      name: "Promotions calendar",
      type: "Promotions calendar",
      status: "failed",
      schedule: "Daily at 05:00",
      lastSyncAt: iso(now - 2 * DAY_MS - 3 * HOUR_MS),
      lastSuccessAt: iso(now - 4 * DAY_MS - 5 * HOUR_MS),
      lastFailureAt: iso(db.today + 5 * HOUR_MS + 2 * MINUTE_MS),
      lastError: "Authentication to the promotions API failed (HTTP 401). The service credential may have expired.",
      records: 1_184,
      owner: "u_lina",
      mapping: [
        { source: "promo_id", target: "promotion_id" },
        { source: "start_date", target: "start" },
        { source: "end_date", target: "end" },
        { source: "mechanic", target: "mechanic" },
      ],
      description: pick("Promosi dan mekanisme yang direncanakan, dipakai sebagai fitur model.", pick("Promosi dan mekanik terencana, dipakai sebagai fitur model.", "Planned promotions and mechanics, used as a model feature.")),
    },
    {
      id: "src_upload",
      name: "New listings upload",
      type: "File upload",
      status: "disconnected",
      schedule: "Manual",
      lastSyncAt: iso(now - 19 * DAY_MS),
      lastSuccessAt: iso(now - 19 * DAY_MS),
      lastFailureAt: null,
      lastError: null,
      records: 64,
      owner: "u_rina",
      mapping: [
        { source: "sku", target: "sku" },
        { source: "like_sku", target: "analogue_sku" },
      ],
      description: pick("CSV manual berisi SKU baru dan produk pembandingnya.", "Manual CSV of new SKUs and their analogue products."),
    },
  ];
}

function makeRun(db: WorkspaceDb, partial: Partial<ForecastRun> & Pick<ForecastRun, "id" | "name" | "status">): ForecastRun {
  const model = db.models.find((m) => m.id === (partial.modelId ?? "mdl_gbm_24"));
  const run: ForecastRun = {
    scope: {
      businessUnit: "Grocery Retail",
      regions: [],
      categories: [],
      skuCount: db.products.length,
      locationCount: db.locations.length,
    },
    modelId: model?.id ?? "mdl_gbm_24",
    modelVersion: model?.version ?? "2.4",
    historicalStart: isoDate(addDays(db.today, -365)),
    historicalEnd: isoDate(addDays(db.today, -1)),
    horizonDays: 28,
    frequency: "daily",
    createdAt: iso(db.today),
    startedAt: null,
    completedAt: null,
    createdBy: "system",
    dataAsOf: iso(db.today + 4 * HOUR_MS + 42 * MINUTE_MS),
    steps: pendingSteps(),
    warnings: [],
    failureReason: null,
    publishedAt: null,
    ...partial,
  };
  if (partial.scope) {
    const scoped = productsInScope(db, run).length;
    run.scope = {
      ...partial.scope,
      skuCount: scoped,
      locationCount: partial.scope.regions.length === 0 ? db.locations.length : db.locations.filter((l) => partial.scope?.regions.includes(l.region)).length,
    };
  }
  return run;
}

function runCode(ts: number, n: number) {
  return `FR-${isoDate(ts).replace(/-/g, "")}-${String(n).padStart(2, "0")}`;
}

function seedRuns(db: WorkspaceDb, now: number) {
  const t = db.today;
  const runs: ForecastRun[] = [];

  // Today's scheduled refresh: published this morning. This is the planning baseline.
  const baseline = makeRun(db, {
    id: runCode(t, 1),
    name: "Daily refresh · All categories",
    status: "published",
    createdAt: iso(t + 5 * HOUR_MS + 30 * MINUTE_MS),
    startedAt: iso(t + 5 * HOUR_MS + 31 * MINUTE_MS),
    completedAt: iso(t + 5 * HOUR_MS + 54 * MINUTE_MS),
    publishedAt: iso(t + 6 * HOUR_MS + 20 * MINUTE_MS),
    warnings: ["12 SKUs have incomplete historical demand.", "Promotions calendar is 4 days old."],
  });
  baseline.steps = completedSteps(baseline);
  runs.push(baseline);

  // A manager-requested run currently processing (progress is derived from job time).
  const running = makeRun(db, {
    id: runCode(t, 3),
    name: "Beverages · 60-day promo horizon",
    status: "running",
    createdBy: "u_dimas",
    horizonDays: 60,
    scope: { businessUnit: "Grocery Retail", regions: [], categories: ["Beverages"], skuCount: 0, locationCount: 0 },
    createdAt: iso(now - 70_000),
    startedAt: iso(now - 65_000),
  });
  runs.push(running);

  const queued = makeRun(db, {
    id: runCode(t, 4),
    name: "Frozen · Java regions",
    status: "queued",
    createdBy: "u_rina",
    scope: { businessUnit: "Grocery Retail", regions: ["Jabodetabek", "West Java", "Central Java", "East Java"], categories: ["Frozen"], skuCount: 0, locationCount: 0 },
    createdAt: iso(now - 40_000),
    startedAt: iso(now + 25_000),
  });
  runs.push(queued);

  // Candidate model evaluation run: completed, awaiting review (not published).
  const candidate = makeRun(db, {
    id: runCode(t, 2),
    name: pick("Model kandidat 2.5 · Semua kategori", "Candidate model 2.5 · All categories"),
    status: "completed",
    modelId: "mdl_gbm_25",
    modelVersion: "2.5",
    createdBy: "u_sari",
    createdAt: iso(t + 7 * HOUR_MS + 5 * MINUTE_MS),
    startedAt: iso(t + 7 * HOUR_MS + 6 * MINUTE_MS),
    completedAt: iso(t + 7 * HOUR_MS + 31 * MINUTE_MS),
    warnings: ["12 SKUs have incomplete historical demand."],
  });
  candidate.steps = completedSteps(candidate);
  runs.push(candidate);

  // Failed during validation.
  const y = addDays(t, -1);
  const failed = makeRun(db, {
    id: runCode(y, 3),
    name: "Staples · 90-day horizon",
    status: "failed",
    createdBy: "u_arif",
    horizonDays: 90,
    scope: { businessUnit: "Grocery Retail", regions: [], categories: ["Staples"], skuCount: 0, locationCount: 0 },
    createdAt: iso(y + 14 * HOUR_MS + 2 * MINUTE_MS),
    startedAt: iso(y + 14 * HOUR_MS + 3 * MINUTE_MS),
    completedAt: iso(y + 14 * HOUR_MS + 6 * MINUTE_MS),
    failureReason: "12 SKUs are missing historical demand records for the selected window.",
  });
  failed.steps = failedSteps(failed, "validating", "Blocking: 12 SKUs are missing historical demand records.");
  failed.historicalEnd = isoDate(addDays(y, -1));
  runs.push(failed);

  const cancelled = makeRun(db, {
    id: runCode(y, 2),
    name: "Snacks · East Java",
    status: "cancelled",
    createdBy: "u_rina",
    scope: { businessUnit: "Grocery Retail", regions: ["East Java"], categories: ["Snacks"], skuCount: 0, locationCount: 0 },
    createdAt: iso(y + 10 * HOUR_MS),
    startedAt: iso(y + 10 * HOUR_MS + MINUTE_MS),
    completedAt: iso(y + 10 * HOUR_MS + 3 * MINUTE_MS),
  });
  cancelled.steps = failedSteps(cancelled, "modelling", "Cancelled by Rina Wijaya.").map((s) =>
    s.status === "failed" ? { ...s, status: "skipped" as const } : s,
  );
  runs.push(cancelled);

  // Previous daily refreshes.
  for (let d = 1; d <= 9; d++) {
    const day = addDays(t, -d);
    const r = makeRun(db, {
      id: runCode(day, 1),
      name: "Daily refresh · All categories",
      status: d <= 6 ? "published" : "archived",
      createdAt: iso(day + 5 * HOUR_MS + 30 * MINUTE_MS),
      startedAt: iso(day + 5 * HOUR_MS + 31 * MINUTE_MS),
      completedAt: iso(day + 5 * HOUR_MS + (50 + (d % 4) * 3) * MINUTE_MS),
      publishedAt: iso(day + 6 * HOUR_MS + (10 + d) * MINUTE_MS),
      historicalEnd: isoDate(addDays(day, -1)),
      dataAsOf: iso(day + 4 * HOUR_MS + 40 * MINUTE_MS),
    });
    r.steps = completedSteps(r);
    runs.push(r);
  }

  const draft = makeRun(db, {
    id: runCode(t, 5),
    name: "Year-end build · All categories (draft)",
    status: "draft",
    createdBy: "u_rina",
    horizonDays: 90,
    createdAt: iso(now - 3 * HOUR_MS),
  });
  runs.push(draft);

  db.runs = runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function seedDataQuality(db: WorkspaceDb, now: number) {
  const rng = createRng(db.seed + 77);
  const sample = (n: number) => rng.shuffle(db.products).slice(0, n).map((p) => p.id);
  db.dqIssues = [
    {
      id: "dq_001",
      type: "missing_records",
      severity: "blocking",
      sourceId: "src_pos",
      title: pick("Permintaan harian hilang untuk 12 SKU", "Missing daily demand for 12 SKUs"),
      description: pick("Tidak ada data POS untuk 12 SKU di 3 toko Sulawesi antara 9 sampai 3 hari lalu.", "No POS records were received for 12 SKUs at 3 Sulawesi stores between 9 and 3 days ago."),
      affectedSkus: 12,
      affectedLocations: 3,
      detectedAt: iso(now - 26 * HOUR_MS),
      status: "investigating",
      ownerId: "u_lina",
      forecastImpact: "Runs that include these SKUs over this window fail validation. The published baseline excludes them.",
      recommendedAction: "Confirm whether the stores were closed. If not, request a POS backfill for the missing dates.",
      sampleProductIds: sample(12),
    },
    {
      id: "dq_002",
      type: "late_data",
      severity: "warning",
      sourceId: "src_promo",
      title: pick("Kalender promosi belum diperbarui 4 hari", "Promotions calendar has not updated for 4 days"),
      description: pick("Sinkronisasi kalender promosi terakhir yang berhasil terjadi 4 hari lalu. Percobaan terbaru gagal dengan HTTP 401.", "The last successful sync of the promotions calendar was 4 days ago. The latest attempt failed with HTTP 401."),
      affectedSkus: Math.round(db.products.length * 0.18),
      affectedLocations: db.locations.length,
      detectedAt: iso(now - 2 * DAY_MS),
      status: "open",
      ownerId: null,
      forecastImpact: "Promotions planned in the last 4 days are not reflected in forecasts. Promoted SKUs may be under-forecast.",
      recommendedAction: "Rotate the promotions API credential in Integrations, then run Sync now.",
      sampleProductIds: sample(8),
    },
    {
      id: "dq_003",
      type: "duplicate_records",
      severity: "warning",
      sourceId: "src_erp",
      title: pick("Baris pesanan duplikat pada ekstrak ERP", "Duplicate order lines in ERP extract"),
      description: pick("214 baris pesanan muncul dua kali di ekstrak ERP dengan nomor pesanan, SKU, dan jumlah yang sama.", "214 order lines appear twice in the ERP extract with identical order number, SKU and quantity."),
      affectedSkus: 57,
      affectedLocations: 6,
      detectedAt: iso(now - 9 * HOUR_MS),
      status: "open",
      ownerId: "u_lina",
      forecastImpact: "Demand for affected SKUs is overstated by up to 4% for the last 7 days of history.",
      recommendedAction: "Deduplicate on order number and line number before loading.",
      sampleProductIds: sample(6),
    },
    {
      id: "dq_004",
      type: "unexpected_zero",
      severity: "warning",
      sourceId: "src_pos",
      title: pick("Permintaan nol tidak wajar untuk SKU volume tinggi", "Unexpected zero demand for high-volume SKUs"),
      description: pick("9 SKU yang biasanya terjual lebih dari 200 unit sehari tercatat nol kemarin.", "9 SKUs that normally sell more than 200 units a day recorded zero sales yesterday."),
      affectedSkus: 9,
      affectedLocations: 48,
      detectedAt: iso(now - 5 * HOUR_MS),
      status: "open",
      ownerId: null,
      forecastImpact: pick("Jika angka nol benar-benar kehabisan stok, permintaan sebenarnya tersensor dan model akan memperkirakan terlalu rendah.", "If the zeros are genuine out-of-stocks, true demand is censored and the model will under-forecast."),
      recommendedAction: "Check availability for these SKUs yesterday. Mark the days as out-of-stock if confirmed.",
      sampleProductIds: sample(9),
    },
    {
      id: "dq_005",
      type: "extreme_outlier",
      severity: "info",
      sourceId: "src_pos",
      title: pick("Lonjakan penjualan ekstrem pada 3 SKU", "Extreme sales spike for 3 SKUs"),
      description: pick("3 SKU terjual lebih dari 8× rata-rata 28 harinya dalam satu hari.", "3 SKUs sold more than 8× their 28-day average on a single day."),
      affectedSkus: 3,
      affectedLocations: 2,
      detectedAt: iso(now - 3 * DAY_MS),
      status: "open",
      ownerId: "u_rina",
      forecastImpact: "Outliers are capped at the 99th percentile during training; no forecast impact expected.",
      recommendedAction: "Confirm whether this was a bulk B2B sale that should be excluded from retail demand.",
      sampleProductIds: sample(3),
    },
    {
      id: "dq_006",
      type: "missing_dimensions",
      severity: "warning",
      sourceId: "src_erp",
      title: pick("Baris pesanan merujuk SKU yang tidak dikenal", "Order lines reference unknown SKUs"),
      description: pick("38 baris pesanan merujuk SKU yang tidak ada di master produk.", "38 order lines reference SKUs that are not in the product master."),
      affectedSkus: 38,
      affectedLocations: 4,
      detectedAt: iso(db.today + 2 * HOUR_MS + 12 * MINUTE_MS),
      status: "open",
      ownerId: null,
      forecastImpact: "These lines are excluded from demand history until the SKUs are mapped.",
      recommendedAction: "Add the SKUs to the product master or map them to existing SKUs.",
      sampleProductIds: [],
    },
    {
      id: "dq_007",
      type: "schema_mismatch",
      severity: "info",
      sourceId: "src_dwh",
      title: pick("Kolom baru pada dimensi toko", "New column in store dimension"),
      description: pick("Dimensi toko kini memuat kolom `store_format_v2` yang belum dipetakan.", "The store dimension now includes a column `store_format_v2` that is not mapped."),
      affectedSkus: 0,
      affectedLocations: 0,
      detectedAt: iso(now - 6 * DAY_MS),
      status: "resolved",
      ownerId: "u_budi",
      forecastImpact: "None. The column is ignored until mapped.",
      recommendedAction: "Decide whether the new store format should replace the current store group.",
      sampleProductIds: [],
    },
  ];
}

const EXCEPTION_OWNERS = ["u_rina", "u_arif", "u_dewi", null, null];

function seedExceptionsAndOverrides(db: WorkspaceDb, now: number) {
  const base = baselineRun(db);
  if (!base) return;
  const { rows } = runResult(db, base);
  const rng = createRng(db.seed + 13);
  const exceptions: ForecastException[] = [];
  const t = db.settings.exceptions;
  let n = 0;
  const statusRoll = (): ForecastException["status"] => {
    const r = rng.next();
    return r < 0.62 ? "open" : r < 0.78 ? "investigating" : r < 0.88 ? "resolved" : r < 0.95 ? "dismissed" : "escalated";
  };
  const detected = () => iso(now - rng.int(20, 60 * 60) * MINUTE_MS);
  for (const row of rows) {
    const product = db.productById.get(row.productId);
    if (!product) continue;
    const abs = Math.abs(row.deltaPercent);
    if (abs >= t.deltaThreshold && row.forecast > 50) {
      n++;
      const dir = row.deltaPercent > 0 ? "increased" : "decreased";
      exceptions.push({
        id: `EX-${String(1000 + n)}`,
        type: "large_delta",
        severity: abs >= 0.25 ? "critical" : "warning",
        productId: row.productId,
        runId: base.id,
        value: row.deltaPercent,
        threshold: t.deltaThreshold,
        valueUnit: "%",
        detectedAt: detected(),
        ownerId: rng.pick(EXCEPTION_OWNERS),
        status: statusRoll(),
        reason: `Forecast ${dir} ${(abs * 100).toFixed(1)}% versus the previous run. The review threshold is ${(t.deltaThreshold * 100).toFixed(0)}%.`,
        affectedSkus: 1,
        activity: [],
      });
      continue;
    }
    const width = row.forecast > 0 ? (row.upperBound - row.lowerBound) / row.forecast : 0;
    if (width >= t.intervalWidthThreshold && row.forecast > 30 && rng.chance(0.5)) {
      n++;
      exceptions.push({
        id: `EX-${String(1000 + n)}`,
        type: "low_confidence",
        severity: "warning",
        productId: row.productId,
        runId: base.id,
        value: width,
        threshold: t.intervalWidthThreshold,
        valueUnit: "%",
        detectedAt: detected(),
        ownerId: rng.pick(EXCEPTION_OWNERS),
        status: statusRoll(),
        reason: `The 80% prediction interval spans ${(width * 100).toFixed(0)}% of the forecast. The review threshold is ${(t.intervalWidthThreshold * 100).toFixed(0)}%.`,
        affectedSkus: 1,
        activity: [],
      });
    }
  }
  // Data-driven exceptions.
  for (const issue of db.dqIssues.filter((i) => i.status !== "resolved" && i.sampleProductIds.length > 0).slice(0, 3)) {
    const pid = issue.sampleProductIds[0] as string;
    n++;
    exceptions.push({
      id: `EX-${String(1000 + n)}`,
      type: issue.type === "late_data" ? "data_freshness" : "data_quality",
      severity: issue.severity === "blocking" ? "critical" : "warning",
      productId: pid,
      runId: base.id,
      value: issue.affectedSkus,
      threshold: 0,
      valueUnit: "units",
      detectedAt: issue.detectedAt,
      ownerId: issue.ownerId,
      status: "open",
      reason: `${issue.title}. ${issue.forecastImpact}`,
      affectedSkus: issue.affectedSkus,
      activity: [],
    });
  }
  // A handful of high-error SKUs from the last backtest window.
  for (const row of rng.shuffle(rows).slice(0, 6)) {
    n++;
    const wape = rng.range(0.46, 0.72);
    exceptions.push({
      id: `EX-${String(1000 + n)}`,
      type: "high_error",
      severity: "warning",
      productId: row.productId,
      runId: base.id,
      value: wape,
      threshold: 0.45,
      valueUnit: "%",
      detectedAt: detected(),
      ownerId: rng.pick(EXCEPTION_OWNERS),
      status: statusRoll(),
      reason: `Forecast error (WAPE) over the last 28 days was ${(wape * 100).toFixed(0)}%. The review threshold is 45%.`,
      affectedSkus: 1,
      activity: [],
    });
  }
  // Seed some activity so detail drawers are not empty.
  for (const ex of exceptions) {
    ex.activity.push({ id: `${ex.id}-a1`, at: ex.detectedAt, actorId: "system", text: "Exception opened by the daily refresh." });
    if (ex.status !== "open" && ex.ownerId) {
      ex.activity.push({
        id: `${ex.id}-a2`,
        at: iso(new Date(ex.detectedAt).getTime() + 40 * MINUTE_MS),
        actorId: ex.ownerId,
        text:
          ex.status === "resolved"
            ? "Resolved: confirmed with category team, no change required."
            : ex.status === "dismissed"
              ? "Dismissed: expected change after range review."
              : ex.status === "escalated"
                ? "Escalated to category manager."
                : "Started investigation.",
      });
    }
  }
  db.exceptions = exceptions.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));

  // Seeded overrides: one applied, one waiting for approval.
  const bev = rows.filter((r) => db.productById.get(r.productId)?.category === "Beverages").slice(0, 124);
  const bevUnits = bev.reduce((s, r) => s + r.forecast, 0);
  const snack = rows.filter((r) => db.productById.get(r.productId)?.category === "Snacks").slice(0, 3);
  const snackUnits = snack.reduce((s, r) => s + r.forecast, 0);
  db.overrides = [
    {
      id: "ovr_001",
      productIds: snack.map((r) => r.productId),
      runId: base.id,
      originalUnits: snackUnits,
      newUnits: Math.round(snackUnits * 0.92),
      reason: "supply_constraint",
      evidence: pick("Surat alokasi pemasok, referensi ALC-0921.", "Supplier allocation letter, reference ALC-0921."),
      comment: pick("Alokasi pemasok dikurangi selama 4 minggu.", "Supplier allocation reduced for 4 weeks."),
      userId: "u_arif",
      createdAt: iso(now - 3 * HOUR_MS),
      status: "applied",
      approvalId: null,
    },
    {
      id: "ovr_002",
      productIds: bev.map((r) => r.productId),
      runId: base.id,
      originalUnits: bevUnits,
      newUnits: Math.round(bevUnits * 1.06),
      reason: "promotion_not_in_model",
      evidence: pick("Ringkasan promosi dagang TPB-1142 (beli 2 gratis 1, minggu 1–2).", "Trade promotion brief TPB-1142 (buy 2 get 1, weeks 1–2)."),
      comment: pick("Promosi disepakati setelah kalender promosi berhenti tersinkron.", "Promotion was agreed after the promotions calendar stopped syncing."),
      userId: "u_rina",
      createdAt: iso(now - 95 * MINUTE_MS),
      status: "pending_approval",
      approvalId: "apr_001",
    },
  ];
}

function seedPlan(db: WorkspaceDb, now: number) {
  const base = baselineRun(db);
  const rows = base ? runResult(db, base).rows : [];
  const rng = createRng(db.seed + 29);
  const openEx = new Map<string, number>();
  for (const e of db.exceptions) {
    if (e.status === "open" || e.status === "investigating" || e.status === "escalated") {
      openEx.set(e.productId, (openEx.get(e.productId) ?? 0) + 1);
    }
  }
  const top = [...rows].sort((a, b) => b.forecast - a.forecast).slice(0, 60);
  const flagged = rows.filter((r) => openEx.has(r.productId) && !top.includes(r)).slice(0, 40);
  const lines: PlanLine[] = [...top, ...flagged].map((r, i) => {
    const roll = rng.next();
    const decision: PlanLine["decision"] =
      openEx.has(r.productId) ? (roll < 0.3 ? "flagged" : "pending") : roll < 0.5 ? "accepted" : roll < 0.62 ? "adjusted" : "pending";
    const proposed = decision === "adjusted" ? Math.round(r.forecast * (1 + rng.normal() * 0.06)) : r.forecast;
    return {
      id: `pl_${i + 1}`,
      productId: r.productId,
      forecast: r.forecast,
      proposed,
      decision,
      note: decision === "adjusted" ? "Aligned to confirmed store allocation." : decision === "flagged" ? "Waiting on exception review." : null,
      exceptionCount: openEx.get(r.productId) ?? 0,
    };
  });
  db.plan = {
    id: "plan_oct",
    name: "Replenishment plan · next 4 weeks",
    periodStart: isoDate(db.today),
    periodEnd: isoDate(addDays(db.today, 27)),
    baselineRunId: base?.id ?? "",
    status: "draft",
    ownerId: "u_rina",
    updatedAt: iso(now - 50 * MINUTE_MS),
    lines,
  };
}

function seedApprovals(db: WorkspaceDb, now: number) {
  const ovr = db.overrides.find((o) => o.id === "ovr_002");
  const holiday = db.scenarios.find((s) => s.status === "in_review");
  const planUnits = db.plan.lines.reduce((s, l) => s + l.proposed, 0);
  const planForecast = db.plan.lines.reduce((s, l) => s + l.forecast, 0);
  const approvals: Approval[] = [];
  if (ovr) {
    approvals.push({
      id: "apr_001",
      type: "override",
      objectId: ovr.id,
      objectLabel: `Beverages promotion uplift · ${ovr.productIds.length} SKUs`,
      requestedBy: ovr.userId,
      requestedAt: ovr.createdAt,
      dueAt: iso(now + 5 * HOUR_MS),
      status: "pending",
      impact: {
        units: ovr.newUnits - ovr.originalUnits,
        percent: (ovr.newUnits - ovr.originalUnits) / ovr.originalUnits,
        skuCount: ovr.productIds.length,
        summary: pick("Menaikkan acuan perencanaan untuk minuman yang dipromosikan selama 4 minggu ke depan.", "Raises the planning baseline for promoted beverages over the next 4 weeks."),
      },
      changeSet: [{ field: pick("Perkiraan (28 hari)", "Forecast (28 days)"), from: pick(`${ovr.originalUnits.toLocaleString("id-ID")} unit`, `${ovr.originalUnits.toLocaleString("en-US")} units`), to: pick(`${ovr.newUnits.toLocaleString("id-ID")} unit`, `${ovr.newUnits.toLocaleString("en-US")} units`) }],
      evidence: [ovr.evidence, "Promotions calendar sync failing since 4 days ago (DQ-002)."],
      assumptions: ["Promotion runs for the first 2 weeks of the horizon.", "Uplift based on the last comparable promotion (+18% on promoted SKUs)."],
      policy: {
        name: "Override approval",
        rule: `Overrides that change a forecast by more than ${(db.settings.approvals.overrideDeltaThreshold * 100).toFixed(0)}% or ${db.settings.approvals.overrideUnitsThreshold.toLocaleString("en-US")} units need Manager approval.`,
        requiredRole: "manager",
      },
      afterApproval: "The override is applied to the planning baseline and replenishment quantities are recalculated.",
      history: [{ id: "apr_001-h1", at: ovr.createdAt, actorId: ovr.userId, text: "Requested approval." }],
    });
  }
  if (holiday && holiday.result) {
    approvals.push({
      id: "apr_002",
      type: "scenario",
      objectId: holiday.id,
      objectLabel: holiday.name,
      requestedBy: holiday.ownerId,
      requestedAt: holiday.modifiedAt,
      dueAt: iso(now + 2 * DAY_MS),
      status: "pending",
      impact: {
        units: holiday.result.deltaUnits,
        percent: holiday.result.deltaPercent,
        skuCount: db.products.length,
        summary: pick("Memakai skenario ini menggantikan acuan untuk kategori terdampak pada rencana berikutnya.", "Adopting this scenario replaces the baseline for the affected categories in the next plan."),
      },
      changeSet: holiday.assumptions.map((a) => ({ field: a.scope, from: `${a.baselineValue}${a.unit}`, to: `${a.value}${a.unit}` })),
      evidence: ["Year-end sales for the last two years.", "Category plans from Beverages and Snacks."],
      assumptions: holiday.assumptions.map((a) => a.rationale),
      policy: { name: "Scenario adoption", rule: "Scenarios adopted into a plan need Manager approval.", requiredRole: "manager" },
      afterApproval: "The scenario becomes available as the baseline when building the next plan.",
      history: [{ id: "apr_002-h1", at: holiday.modifiedAt, actorId: holiday.ownerId, text: "Submitted for review." }],
    });
  }
  approvals.push({
    id: "apr_003",
    type: "plan_publish",
    objectId: db.plan.id,
    objectLabel: db.plan.name,
    requestedBy: "u_arif",
    requestedAt: iso(now - 30 * MINUTE_MS),
    dueAt: iso(now + 20 * HOUR_MS),
    status: "pending",
    impact: {
      units: planUnits - planForecast,
      percent: planForecast > 0 ? (planUnits - planForecast) / planForecast : 0,
      skuCount: db.plan.lines.length,
      summary: pick("Menerbitkan mengirim jumlah yang direncanakan ke pengisian ulang untuk 4 minggu ke depan.", "Publishing sends planned quantities to replenishment for the next 4 weeks."),
    },
    changeSet: [{ field: pick("Status rencana", "Plan status"), from: pick("Draf", "Draft"), to: pick("Diterbitkan", "Published") }],
    evidence: ["Plan reviewed in the weekly S&OP meeting."],
    assumptions: ["Baseline is today's published daily refresh."],
    policy: { name: "Plan publication", rule: "Publishing a plan needs Manager approval.", requiredRole: "manager" },
    afterApproval: "The plan is published and becomes read-only. Replenishment receives the planned quantities.",
    history: [{ id: "apr_003-h1", at: iso(now - 30 * MINUTE_MS), actorId: "u_arif", text: "Requested publication." }],
  });
  approvals.push({
    id: "apr_004",
    type: "model_default",
    objectId: "mdl_gbm_25",
    objectLabel: pick("Jadikan Gradient-boosted demand 2.5 model bawaan", "Make Gradient-boosted demand 2.5 the default model"),
    requestedBy: "u_sari",
    requestedAt: iso(now - 20 * HOUR_MS),
    dueAt: iso(now + 3 * DAY_MS),
    status: "pending",
    impact: { units: 0, percent: -0.017, skuCount: db.products.length, summary: pick("WAPE membaik dari 21,4% menjadi 19,7% pada uji model 90 hari terakhir.", "WAPE improves from 21.4% to 19.7% in the last 90-day backtest.") },
    changeSet: [{ field: pick("Model bawaan", "Default model"), from: "Gradient-boosted demand 2.4", to: "Gradient-boosted demand 2.5" }],
    evidence: [pick("Uji model BT-0412 (90 hari terakhir).", "Backtest BT-0412 (last 90 days)."), pick("Proses kandidat hari ini dengan model 2.5.", "Candidate run today with model 2.5.")],
    assumptions: ["Weather index coverage gaps in Sulawesi are acceptable."],
    policy: { name: pick("Promosi model", "Model promotion"), rule: pick("Mengubah model bawaan memerlukan persetujuan Manajer.", "Changing the default model needs Manager approval."), requiredRole: "manager" },
    afterApproval: pick("Proses perkiraan baru memakai model 2.5 sebagai bawaan. Proses yang ada tidak berubah.", "New forecast runs use model 2.5 by default. Existing runs are unchanged."),
    history: [{ id: "apr_004-h1", at: iso(now - 20 * HOUR_MS), actorId: "u_sari", text: pick("Mengajukan promosi model.", "Requested model promotion.") }],
  });
  approvals.push({
    id: "apr_005",
    type: "override",
    objectId: "ovr_legacy_1",
    objectLabel: "Rice 5 kg · supply allocation · 14 SKUs",
    requestedBy: "u_dewi",
    requestedAt: iso(now - 3 * DAY_MS),
    dueAt: iso(now - 2 * DAY_MS),
    status: "approved",
    impact: { units: -4210, percent: -0.07, skuCount: 14, summary: pick("Acuan diturunkan agar sesuai alokasi pemasok.", "Reduced baseline to match supplier allocation.") },
    changeSet: [{ field: pick("Perkiraan (28 hari)", "Forecast (28 days)"), from: pick("60.140 unit", "60,140 units"), to: pick("55.930 unit", "55,930 units") }],
    evidence: [pick("Surat alokasi pemasok ALC-0917.", "Supplier allocation letter ALC-0917.")],
    assumptions: ["Allocation holds for 4 weeks."],
    policy: { name: "Override approval", rule: "Overrides above 5% need Manager approval.", requiredRole: "manager" },
    afterApproval: "Applied to the planning baseline.",
    history: [
      { id: "apr_005-h1", at: iso(now - 3 * DAY_MS), actorId: "u_dewi", text: "Requested approval." },
      { id: "apr_005-h2", at: iso(now - 3 * DAY_MS + 2 * HOUR_MS), actorId: "u_yoga", text: "Approved." },
    ],
  });
  approvals.push({
    id: "apr_006",
    type: "scenario",
    objectId: "scn_legacy_1",
    objectLabel: "Competitor store opening · Surabaya",
    requestedBy: "u_rina",
    requestedAt: iso(now - 6 * DAY_MS),
    dueAt: iso(now - 4 * DAY_MS),
    status: "rejected",
    impact: { units: -12_400, percent: -0.03, skuCount: 380, summary: pick("Akan menurunkan acuan Jawa Timur.", "Would reduce East Java baseline.") },
    changeSet: [{ field: pick("Permintaan Jawa Timur", "East Java demand"), from: "0%", to: "−8%" }],
    evidence: [pick("Laporan berita lokal.", "Local news report.")],
    assumptions: ["Store opens within the horizon."],
    policy: { name: "Scenario adoption", rule: "Scenarios adopted into a plan need Manager approval.", requiredRole: "manager" },
    afterApproval: "—",
    history: [
      { id: "apr_006-h1", at: iso(now - 6 * DAY_MS), actorId: "u_rina", text: "Submitted for review." },
      { id: "apr_006-h2", at: iso(now - 5 * DAY_MS), actorId: "u_dimas", text: "Rejected: opening date not confirmed." },
    ],
  });
  db.approvals = approvals;
}

function seedNotifications(db: WorkspaceDb, now: number) {
  const base = baselineRun(db);
  const failed = db.runs.find((r) => r.status === "failed");
  const critical = db.exceptions.find((e) => e.severity === "critical" && e.status === "open");
  db.notifications = [
    {
      id: "ntf_1",
      category: "approval_requested",
      title: pick("Perlu persetujuan: kenaikan promosi Minuman", "Approval requested: Beverages promotion uplift"),
      body: pick("Rina Wijaya mengajukan persetujuan perubahan +6,0% untuk 124 SKU.", "Rina Wijaya requested approval for an override of +6.0% on 124 SKUs."),
      href: "/planning/approvals?id=apr_001",
      createdAt: iso(now - 95 * MINUTE_MS),
      read: false,
    },
    {
      id: "ntf_2",
      category: "data_freshness",
      title: pick("Sinkronisasi kalender promosi gagal", "Promotions calendar sync failed"),
      body: pick("Autentikasi gagal (HTTP 401). Data promosi berumur 4 hari.", "Authentication failed (HTTP 401). Promotions are 4 days old."),
      href: "/demand-data/sources?id=src_promo",
      createdAt: iso(db.today + 5 * HOUR_MS + 2 * MINUTE_MS),
      read: false,
    },
    ...(base
      ? [
          {
            id: "ntf_3",
            category: "forecast_completed" as const,
            title: pick("Penyegaran harian diterbitkan", "Daily refresh published"),
            body: pick(`${base.id} diterbitkan sebagai acuan perencanaan hari ini.`, `${base.id} was published as today's planning baseline.`),
            href: `/forecasting/runs/${base.id}`,
            createdAt: base.publishedAt ?? iso(now),
            read: false,
          },
        ]
      : []),
    ...(critical
      ? [
          {
            id: "ntf_4",
            category: "exception_opened" as const,
            title: pick("Item kritis terbuka", "Critical exception opened"),
            body: critical.reason,
            href: `/planning/exceptions?id=${critical.id}`,
            createdAt: critical.detectedAt,
            read: true,
          },
        ]
      : []),
    ...(failed
      ? [
          {
            id: "ntf_5",
            category: "forecast_failed" as const,
            title: `Forecast run failed: ${failed.name}`,
            body: failed.failureReason ?? "The run failed.",
            href: `/forecasting/runs/${failed.id}`,
            createdAt: failed.completedAt ?? iso(now),
            read: true,
          },
        ]
      : []),
    {
      id: "ntf_6",
      category: "data_quality",
      title: pick("Masalah data menghambat: permintaan harian hilang", "Blocking data issue: missing daily demand"),
      body: pick("12 SKU di 3 toko Sulawesi tidak punya data POS selama 6 hari.", "12 SKUs at 3 Sulawesi stores have no POS records for 6 days."),
      href: "/demand-data/quality?id=dq_001",
      createdAt: iso(now - 26 * HOUR_MS),
      read: true,
    },
    {
      id: "ntf_7",
      category: "approval_completed",
      title: pick("Disetujui: alokasi pasokan Beras 5 kg", "Approved: Rice 5 kg supply allocation"),
      body: pick("Yoga Pratama menyetujui perubahan manual tersebut.", "Yoga Pratama approved the override."),
      href: "/planning/approvals?id=apr_005",
      createdAt: iso(now - 3 * DAY_MS + 2 * HOUR_MS),
      read: true,
    },
    {
      id: "ntf_8",
      category: "model_issue",
      title: pick("Bias model 2.4 cenderung naik", pick("Bias model 2.4 naik", "Model 2.4 bias drifting upward")),
      body: pick("Bias pada kategori Beku naik ke +6,1% dalam 14 hari terakhir.", "Bias on Frozen rose to +6.1% over the last 14 days."),
      href: "/models/performance",
      createdAt: iso(now - 2 * DAY_MS),
      read: true,
    },
  ];
}

function seedAudit(db: WorkspaceDb, now: number) {
  const events: AuditEvent[] = [];
  const push = (e: Omit<AuditEvent, "eventId" | "workspaceId" | "requestId">) =>
    events.push({ eventId: `evt_seed_${events.length + 1}`, workspaceId: db.workspace.id, requestId: requestId(), ...e });
  for (const run of db.runs) {
    push({
      timestamp: run.createdAt,
      actorId: run.createdBy,
      action: "create_forecast_run",
      entityType: "forecast_run",
      entityId: run.id,
      entityLabel: run.name,
      previousState: null,
      newState: "queued",
      reason: run.createdBy === "system" ? "Scheduled daily refresh" : null,
      source: run.createdBy === "system" ? "system" : "web",
    });
    if (run.publishedAt) {
      push({
        timestamp: run.publishedAt,
        actorId: run.createdBy === "system" ? "u_yoga" : run.createdBy,
        action: "publish_forecast_run",
        entityType: "forecast_run",
        entityId: run.id,
        entityLabel: run.name,
        previousState: "completed",
        newState: "published",
        reason: pick("Sudah divalidasi dengan aktual kemarin", "Validated against yesterday's actuals"),
        source: "web",
      });
    }
    if (run.status === "cancelled") {
      push({
        timestamp: run.completedAt ?? run.createdAt,
        actorId: run.createdBy,
        action: "cancel_forecast_run",
        entityType: "forecast_run",
        entityId: run.id,
        entityLabel: run.name,
        previousState: "running",
        newState: "cancelled",
        reason: pick("Wilayah yang dipilih salah", "Wrong region selected"),
        source: "web",
      });
    }
  }
  for (const o of db.overrides) {
    push({
      timestamp: o.createdAt,
      actorId: o.userId,
      action: "override",
      entityType: "override",
      entityId: o.id,
      entityLabel: `${o.productIds.length} SKUs`,
      previousState: `${o.originalUnits.toLocaleString("en-US")} units`,
      newState: `${o.newUnits.toLocaleString("en-US")} units`,
      reason: o.comment,
      source: "web",
    });
  }
  for (const a of db.approvals.filter((x) => x.status !== "pending")) {
    const last = a.history[a.history.length - 1];
    if (!last) continue;
    push({
      timestamp: last.at,
      actorId: last.actorId,
      action: a.status === "approved" ? "approve" : "reject",
      entityType: "approval",
      entityId: a.id,
      entityLabel: a.objectLabel,
      previousState: "pending",
      newState: a.status,
      reason: last.text,
      source: "web",
    });
  }
  for (const s of db.scenarios) {
    push({
      timestamp: s.createdAt,
      actorId: s.ownerId,
      action: "create_scenario",
      entityType: "scenario",
      entityId: s.id,
      entityLabel: s.name,
      previousState: null,
      newState: "draft",
      reason: null,
      source: "web",
    });
  }
  const signIns = ["u_rina", "u_dimas", "u_sari", "u_arif", "u_yoga", "u_budi"];
  signIns.forEach((u, i) =>
    push({
      timestamp: iso(now - (i * 47 + 12) * MINUTE_MS),
      actorId: u,
      action: "sign_in",
      entityType: "session",
      entityId: `ses_${u}`,
      entityLabel: "Web session",
      previousState: null,
      newState: "active",
      reason: null,
      source: "web",
    }),
  );
  push({
    timestamp: iso(now - 4 * DAY_MS),
    actorId: "u_budi",
    action: "change_settings",
    entityType: "settings",
    entityId: "exceptions.deltaThreshold",
    entityLabel: "Exception threshold: forecast delta",
    previousState: "20%",
    newState: "15%",
    reason: pick("Disepakati dalam tinjauan S&OP agar lebih banyak perubahan penting terdeteksi.", "Agreed in S&OP review to catch more material changes."),
    source: "web",
  });
  push({
    timestamp: iso(now - 5 * DAY_MS),
    actorId: "u_budi",
    action: "change_permissions",
    entityType: "user",
    entityId: "u_eko",
    entityLabel: "Eko Saputra",
    previousState: "active",
    newState: "suspended",
    reason: pick("Sudah tidak bekerja di organisasi ini.", "Left the organisation."),
    source: "web",
  });
  push({
    timestamp: iso(db.today + 5 * HOUR_MS + 2 * MINUTE_MS),
    actorId: "system",
    action: "integration_update",
    entityType: "data_source",
    entityId: "src_promo",
    entityLabel: "Promotions calendar",
    previousState: "connected",
    newState: "failed",
    reason: pick("HTTP 401 dari API promosi", "HTTP 401 from promotions API"),
    source: "system",
  });
  db.audit = events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
