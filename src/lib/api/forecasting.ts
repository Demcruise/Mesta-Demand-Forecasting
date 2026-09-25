import type {
  ForecastException,
  ForecastRow,
  ForecastRun,
  ForecastSummary,
  Frequency,
  ListQuery,
  Override,
  OverrideReason,
  Product,
} from "@/types/domain";
import { CATEGORIES, REGIONS } from "@/lib/mock/catalog";
import { audit, baselineRun, getDb, nextId, paramsFor, productsInScope, runResult, runScale, type WorkspaceDb } from "@/lib/mock/db";
import { actorName } from "@/lib/mock/directory";
import { modelProfile } from "@/lib/mock/models";
import { advanceRun, pendingSteps } from "@/lib/mock/runs";
import { aggregateInterval, simulate, summarise, toPoints } from "@/lib/mock/series";
import { addDays, DAY_MS, iso, isoDate } from "@/lib/mock/time";
import { applyAll, applyList, ApiError, read, write, type ApiContext, type ListSpec } from "./client";

/* ── Run lifecycle ─────────────────────────────────────────────────── */

/** Brings queued/running runs up to date with (mock) job time and emits completion events. */
export function syncRuns(db: WorkspaceDb) {
  const now = Date.now();
  db.runs = db.runs.map((run) => {
    const next = advanceRun(run, now);
    if (next.status === "completed" && run.status !== "completed") {
      db.notifications.unshift({
        id: nextId(db, "ntf"),
        category: "forecast_completed",
        title: `Forecast run completed: ${next.name}`,
        body: `${next.id} finished and is ready to review.`,
        href: `/forecasting/runs/${next.id}`,
        createdAt: next.completedAt ?? iso(now),
        read: false,
      });
      audit(db, {
        actorId: "system",
        action: "create_forecast_run",
        entityType: "forecast_run",
        entityId: next.id,
        entityLabel: next.name,
        previousState: "running",
        newState: "completed",
        reason: "Processing finished",
        source: "system",
        timestamp: next.completedAt ?? undefined,
      });
    }
    return next;
  });
}

const runSpec: ListSpec<ForecastRun> = {
  search: (r) => `${r.id} ${r.name} ${r.scope.categories.join(" ")} ${actorName(r.createdBy)}`,
  sorters: {
    id: (r) => r.id,
    name: (r) => r.name,
    status: (r) => r.status,
    createdAt: (r) => r.createdAt,
    completedAt: (r) => r.completedAt,
    horizon: (r) => r.horizonDays,
    skus: (r) => r.scope.skuCount,
  },
  filters: {
    status: (r, v) => v.includes(r.status),
    model: (r, v) => v.includes(r.modelId),
    createdBy: (r, v) => v.includes(r.createdBy),
    category: (r, v) => r.scope.categories.length === 0 || r.scope.categories.some((c) => v.includes(c)),
  },
};

export function listRuns(ctx: ApiContext, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    syncRuns(db);
    return applyList(db.runs, { sort: "createdAt", dir: "desc", ...query }, runSpec);
  });
}

export function getRun(ctx: ApiContext, runId: string) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    syncRuns(db);
    const run = db.runs.find((r) => r.id === runId);
    if (!run) throw new ApiError(`Forecast run ${runId} was not found in this workspace.`, "not_found");
    const model = db.models.find((m) => m.id === run.modelId) ?? null;
    return { run, model };
  });
}

export type RunInput = {
  name: string;
  businessUnit: string;
  regions: string[];
  categories: string[];
  historicalStart: string;
  historicalEnd: string;
  frequency: Frequency;
  horizonDays: number;
  modelId: string;
};

export type ValidationCheck = {
  key: string;
  label: string;
  result: "pass" | "warning" | "blocking";
  detail: string;
};

export function defaultRunInput(ctx: ApiContext): RunInput {
  const db = getDb(ctx.workspaceId);
  return {
    name: "",
    businessUnit: "Grocery Retail",
    regions: [],
    categories: [],
    historicalStart: isoDate(addDays(db.today, -db.settings.forecasting.historyWindowDays)),
    historicalEnd: isoDate(addDays(db.today, -1)),
    frequency: db.settings.forecasting.defaultFrequency,
    horizonDays: db.settings.forecasting.defaultHorizonDays,
    modelId: db.settings.forecasting.defaultModelId,
  };
}

/** Scope preview used by the create wizard (counts only, cheap). */
export function previewScope(ctx: ApiContext, input: Pick<RunInput, "regions" | "categories">) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const skus = productsInScope(db, { scope: { businessUnit: "", regions: input.regions, categories: input.categories, skuCount: 0, locationCount: 0 } });
    const locations = input.regions.length === 0 ? db.locations.length : db.locations.filter((l) => input.regions.includes(l.region)).length;
    return { skuCount: skus.length, locationCount: locations, seriesCount: skus.length * locations };
  });
}

function checksFor(db: WorkspaceDb, input: RunInput): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const start = new Date(input.historicalStart).getTime();
  const end = new Date(input.historicalEnd).getTime();
  const days = Math.round((end - start) / DAY_MS) + 1;
  const scoped = productsInScope(db, { scope: { businessUnit: "", regions: input.regions, categories: input.categories, skuCount: 0, locationCount: 0 } });
  const missing = db.dqIssues.find((i) => i.id === "dq_001" && i.status !== "resolved");
  const missingInScope = missing ? missing.sampleProductIds.filter((id) => scoped.some((p) => p.id === id)).length : 0;
  const windowCoversGap = end >= db.today - 9 * DAY_MS;
  checks.push({
    key: "availability",
    label: "Data availability",
    result: days < 90 ? "blocking" : days < 180 ? "warning" : "pass",
    detail:
      days < 90
        ? `Only ${days} days of history selected. At least 90 days are required.`
        : days < 180
          ? `${days} days of history. Seasonality is estimated less reliably below 180 days.`
          : `${days} days of history available for ${scoped.length.toLocaleString("en-US")} SKUs.`,
  });
  checks.push({
    key: "missing",
    label: "Missing records",
    result: missingInScope > 0 && windowCoversGap ? (input.horizonDays > 60 ? "blocking" : "warning") : "pass",
    detail:
      missingInScope > 0 && windowCoversGap
        ? `${missingInScope} SKUs are missing daily demand for 6 days (DQ-001).${input.horizonDays > 60 ? " Horizons over 60 days require complete recent history." : " They will use interpolated history."}`
        : "No missing records in the selected window.",
  });
  const dup = db.dqIssues.find((i) => i.type === "duplicate_records" && i.status !== "resolved");
  checks.push({
    key: "duplicates",
    label: "Duplicate records",
    result: dup ? "warning" : "pass",
    detail: dup ? `${dup.description} Duplicates are removed before modelling.` : "No duplicate records detected.",
  });
  const outliers = db.dqIssues.find((i) => i.type === "extreme_outlier" && i.status !== "resolved");
  checks.push({
    key: "outliers",
    label: "Outliers",
    result: "pass",
    detail: outliers ? `${outliers.affectedSkus} extreme values will be capped at the 99th percentile.` : "No extreme values detected.",
  });
  const promo = db.sources.find((s) => s.id === "src_promo");
  const promoAge = promo?.lastSuccessAt ? (Date.now() - new Date(promo.lastSuccessAt).getTime()) / DAY_MS : 0;
  checks.push({
    key: "freshness",
    label: "Freshness",
    result: promoAge > 1 ? "warning" : "pass",
    detail: promoAge > 1 ? `Promotions calendar is ${Math.floor(promoAge)} days old. Recent promotions will be missing.` : "All sources updated within 24 hours.",
  });
  checks.push({
    key: "fields",
    label: "Required fields",
    result: input.name.trim().length === 0 ? "blocking" : "pass",
    detail: input.name.trim().length === 0 ? "Give the run a name so it can be found later." : "Run name, scope, window, horizon and model are set.",
  });
  const model = db.models.find((m) => m.id === input.modelId);
  const compatible = model && model.status !== "archived" && input.horizonDays <= model.horizonDays && model.frequency === input.frequency;
  checks.push({
    key: "model",
    label: "Model compatibility",
    result: !model ? "blocking" : compatible ? (model.status === "candidate" ? "warning" : "pass") : "blocking",
    detail: !model
      ? "Select a model."
      : !compatible
        ? model.status === "archived"
          ? `${model.name} ${model.version} is archived.`
          : model.frequency !== input.frequency
            ? `${model.name} ${model.version} only supports ${model.frequency} forecasts.`
            : `${model.name} ${model.version} supports horizons up to ${model.horizonDays} days.`
        : model.status === "candidate"
          ? `${model.name} ${model.version} is a candidate. Results should not be published without review.`
          : `${model.name} ${model.version} is in production and supports this horizon.`,
  });
  return checks;
}

export function validateRun(ctx: ApiContext, input: RunInput) {
  return read(() => checksFor(getDb(ctx.workspaceId), input));
}

export function createRun(ctx: ApiContext, input: RunInput) {
  return write(ctx, "forecast.run.create", () => {
    const db = getDb(ctx.workspaceId);
    const checks = checksFor(db, input);
    const blocking = checks.filter((c) => c.result === "blocking");
    if (blocking.length > 0) {
      throw new ApiError("The run has blocking validation issues.", "validation", blocking.map((b) => b.detail).join(" "));
    }
    const model = db.models.find((m) => m.id === input.modelId);
    const now = Date.now();
    const todays = db.runs.filter((r) => r.id.includes(isoDate(db.today).replace(/-/g, ""))).length;
    const id = `FR-${isoDate(db.today).replace(/-/g, "")}-${String(todays + 1).padStart(2, "0")}`;
    const scoped = productsInScope(db, { scope: { businessUnit: "", regions: input.regions, categories: input.categories, skuCount: 0, locationCount: 0 } });
    const run: ForecastRun = {
      id,
      name: input.name.trim(),
      status: "queued",
      scope: {
        businessUnit: input.businessUnit,
        regions: input.regions,
        categories: input.categories,
        skuCount: scoped.length,
        locationCount: input.regions.length === 0 ? db.locations.length : db.locations.filter((l) => input.regions.includes(l.region)).length,
      },
      modelId: input.modelId,
      modelVersion: model?.version ?? "",
      historicalStart: input.historicalStart,
      historicalEnd: input.historicalEnd,
      horizonDays: input.horizonDays,
      frequency: input.frequency,
      createdAt: iso(now),
      startedAt: iso(now + 1500),
      completedAt: null,
      createdBy: ctx.userId,
      dataAsOf: db.sources.find((s) => s.id === "src_pos")?.lastSuccessAt ?? null,
      steps: pendingSteps(),
      warnings: checks.filter((c) => c.result === "warning").map((c) => c.detail),
      failureReason: null,
      publishedAt: null,
    };
    db.runs.unshift(run);
    audit(db, {
      actorId: ctx.userId,
      action: "create_forecast_run",
      entityType: "forecast_run",
      entityId: run.id,
      entityLabel: run.name,
      previousState: null,
      newState: "queued",
      reason: null,
      source: "web",
    });
    return run;
  });
}

function mutateRun(ctx: ApiContext, runId: string, fn: (run: ForecastRun, db: WorkspaceDb) => ForecastRun) {
  const db = getDb(ctx.workspaceId);
  syncRuns(db);
  const idx = db.runs.findIndex((r) => r.id === runId);
  const run = db.runs[idx];
  if (!run) throw new ApiError(`Forecast run ${runId} was not found.`, "not_found");
  const next = fn(run, db);
  db.runs[idx] = next;
  return next;
}

export function cancelRun(ctx: ApiContext, runId: string, reason: string) {
  return write(ctx, "forecast.run.cancel", () =>
    mutateRun(ctx, runId, (run, db) => {
      if (run.status !== "queued" && run.status !== "running") {
        throw new ApiError(`Only queued or running runs can be cancelled. This run is ${run.status}.`, "conflict");
      }
      const now = iso(Date.now());
      audit(db, { actorId: ctx.userId, action: "cancel_forecast_run", entityType: "forecast_run", entityId: run.id, entityLabel: run.name, previousState: run.status, newState: "cancelled", reason: reason || null, source: "web" });
      return {
        ...run,
        status: "cancelled",
        completedAt: now,
        steps: run.steps.map((s) => (s.status === "running" ? { ...s, status: "skipped", completedAt: now, detail: `Cancelled by ${actorName(ctx.userId)}.` } : s.status === "pending" ? { ...s, status: "skipped" } : s)),
      };
    }),
  );
}

export function retryRun(ctx: ApiContext, runId: string) {
  return write(ctx, "forecast.run.create", () =>
    mutateRun(ctx, runId, (run, db) => {
      if (run.status !== "failed" && run.status !== "cancelled") {
        throw new ApiError("Only failed or cancelled runs can be retried.", "conflict");
      }
      const input: RunInput = {
        name: run.name,
        businessUnit: run.scope.businessUnit,
        regions: run.scope.regions,
        categories: run.scope.categories,
        historicalStart: run.historicalStart,
        historicalEnd: run.historicalEnd,
        frequency: run.frequency,
        horizonDays: run.horizonDays,
        modelId: run.modelId,
      };
      const blocking = checksFor(db, input).filter((c) => c.result === "blocking");
      if (blocking.length > 0) {
        throw new ApiError("Validation still fails.", "validation", blocking.map((b) => b.detail).join(" "));
      }
      const now = Date.now();
      audit(db, { actorId: ctx.userId, action: "retry_forecast_run", entityType: "forecast_run", entityId: run.id, entityLabel: run.name, previousState: run.status, newState: "queued", reason: null, source: "web" });
      return { ...run, status: "queued", startedAt: iso(now + 1500), completedAt: null, failureReason: null, steps: pendingSteps() };
    }),
  );
}

export function publishRun(ctx: ApiContext, runId: string, reason: string) {
  return write(ctx, "forecast.run.publish", () =>
    mutateRun(ctx, runId, (run, db) => {
      if (run.status !== "completed") throw new ApiError("Only completed runs can be published.", "conflict");
      const previous = baselineRun(db);
      audit(db, { actorId: ctx.userId, action: "publish_forecast_run", entityType: "forecast_run", entityId: run.id, entityLabel: run.name, previousState: "completed", newState: "published", reason: reason || null, source: "web" });
      if (previous) {
        audit(db, { actorId: ctx.userId, action: "publish_forecast_run", entityType: "forecast_run", entityId: previous.id, entityLabel: previous.name, previousState: "baseline", newState: "superseded", reason: `Superseded by ${run.id}`, source: "web" });
      }
      return { ...run, status: "published", publishedAt: iso(Date.now()) };
    }),
  );
}

export function archiveRun(ctx: ApiContext, runId: string) {
  return write(ctx, "forecast.run.archive", () =>
    mutateRun(ctx, runId, (run, db) => {
      if (run.status === "queued" || run.status === "running") throw new ApiError("Cancel the run before archiving it.", "conflict");
      if (baselineRun(db)?.id === run.id) throw new ApiError("This run is the current planning baseline and cannot be archived.", "conflict", "Publish a newer run first.");
      audit(db, { actorId: ctx.userId, action: "archive_forecast_run", entityType: "forecast_run", entityId: run.id, entityLabel: run.name, previousState: run.status, newState: "archived", reason: null, source: "web" });
      return { ...run, status: "archived" };
    }),
  );
}

export function runToInput(run: ForecastRun): RunInput {
  return {
    name: `${run.name} (copy)`,
    businessUnit: run.scope.businessUnit,
    regions: run.scope.regions,
    categories: run.scope.categories,
    historicalStart: run.historicalStart,
    historicalEnd: run.historicalEnd,
    frequency: run.frequency,
    horizonDays: run.horizonDays,
    modelId: run.modelId,
  };
}

/* ── Results ───────────────────────────────────────────────────────── */

export type ExplorerRow = ForecastRow & { product: Product; exceptionIds: string[] };

function openException(e: ForecastException) {
  return e.status === "open" || e.status === "investigating" || e.status === "escalated";
}

function decorateRows(db: WorkspaceDb, runId: string, rows: ForecastRow[]): ExplorerRow[] {
  const exByProduct = new Map<string, string[]>();
  for (const e of db.exceptions) {
    if (e.runId !== runId || !openException(e)) continue;
    const list = exByProduct.get(e.productId) ?? [];
    list.push(e.id);
    exByProduct.set(e.productId, list);
  }
  const overrideRatio = new Map<string, number>();
  for (const o of db.overrides) {
    if (o.runId !== runId || o.status !== "applied") continue;
    for (const pid of o.productIds) overrideRatio.set(pid, o.newUnits / o.originalUnits);
  }
  return rows.map((row) => {
    const exceptionIds = exByProduct.get(row.productId) ?? [];
    const ratio = overrideRatio.get(row.productId);
    return {
      ...row,
      product: db.productById.get(row.productId) as Product,
      exceptionIds,
      exceptionCount: exceptionIds.length,
      overrideUnits: ratio ? Math.round(row.forecast * ratio) : null,
      status: exceptionIds.length > 0 ? "needs_review" : ratio ? "overridden" : row.status,
    };
  });
}

const rowSpec: ListSpec<ExplorerRow> = {
  search: (r) => `${r.product.name} ${r.product.sku} ${r.product.category} ${r.product.brand}`,
  sorters: {
    product: (r) => r.product.name,
    category: (r) => r.product.category,
    forecast: (r) => r.overrideUnits ?? r.forecast,
    previous: (r) => r.previousForecast,
    actual: (r) => r.actualLastPeriod,
    delta: (r) => r.delta,
    deltaPercent: (r) => r.deltaPercent,
    width: (r) => (r.forecast > 0 ? (r.upperBound - r.lowerBound) / r.forecast : 0),
    exceptions: (r) => r.exceptionCount,
    status: (r) => r.status,
  },
  filters: {
    category: (r, v) => v.includes(r.product.category),
    status: (r, v) => v.includes(r.status),
    lifecycle: (r, v) => v.includes(r.product.lifecycle),
    exceptions: (r, v) => (v.includes("with") && r.exceptionCount > 0) || (v.includes("without") && r.exceptionCount === 0),
    delta: (r, v) =>
      (v.includes("increase") && r.deltaPercent > 0.05) ||
      (v.includes("decrease") && r.deltaPercent < -0.05) ||
      (v.includes("stable") && Math.abs(r.deltaPercent) <= 0.05),
  },
};

function resolveRun(db: WorkspaceDb, runId?: string | null) {
  syncRuns(db);
  const run = runId ? db.runs.find((r) => r.id === runId) : baselineRun(db);
  if (!run) throw new ApiError(runId ? `Forecast run ${runId} was not found.` : "No published forecast run exists in this workspace yet.", "not_found");
  if (run.status !== "completed" && run.status !== "published" && run.status !== "archived") {
    throw new ApiError(`Results are not available: the run is ${run.status}.`, "conflict");
  }
  return run;
}

export function listForecastRows(ctx: ApiContext, runId: string | null, query: ListQuery) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const run = resolveRun(db, runId);
    const rows = decorateRows(db, run.id, runResult(db, run).rows);
    return { run, page: applyList(rows, { sort: "forecast", dir: "desc", ...query }, { ...rowSpec, asOf: run.completedAt }) };
  });
}

export function exportForecastRows(ctx: ApiContext, runId: string | null, query: ListQuery) {
  return write(ctx, "export", () => {
    const db = getDb(ctx.workspaceId);
    const run = resolveRun(db, runId);
    const rows = decorateRows(db, run.id, runResult(db, run).rows);
    return { run, rows: applyAll(rows, { sort: "forecast", dir: "desc", ...query }, rowSpec) };
  });
}

function summaryFrom(run: ForecastRun, totals: { forecast: number; previous: number; actualLast: number; lower: number; upper: number }): ForecastSummary {
  return {
    forecastValue: totals.forecast,
    previousForecast: totals.previous,
    actualLastPeriod: totals.actualLast,
    delta: totals.forecast - totals.previous,
    deltaPercent: totals.previous > 0 ? (totals.forecast - totals.previous) / totals.previous : 0,
    lowerBound: totals.lower,
    upperBound: totals.upper,
    coverage: 0.8,
    horizonDays: run.horizonDays,
    periodStart: isoDate(new Date(run.completedAt ?? run.createdAt).setHours(0, 0, 0, 0)),
    periodEnd: isoDate(addDays(new Date(run.completedAt ?? run.createdAt).setHours(0, 0, 0, 0), run.horizonDays - 1)),
  };
}

/** Scope-level result for a run: aggregate series, totals and category breakdown. */
export function getRunResult(ctx: ApiContext, runId: string | null) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const run = resolveRun(db, runId);
    const result = runResult(db, run);
    const rows = result.rows;
    const forecast = rows.reduce((s, r) => s + r.forecast, 0);
    const previous = rows.reduce((s, r) => s + r.previousForecast, 0);
    const actualLast = rows.reduce((s, r) => s + r.actualLastPeriod, 0);
    const interval = aggregateInterval(rows);
    const summary = summaryFrom(run, {
      forecast,
      previous,
      actualLast,
      lower: interval.lower,
      upper: interval.upper,
    });
    const decorated = decorateRows(db, run.id, rows);
    const model = db.models.find((m) => m.id === run.modelId) ?? null;
    return {
      run,
      model,
      summary,
      points: result.aggregate,
      byCategory: result.byCategory,
      counts: {
        skus: rows.length,
        needsReview: decorated.filter((r) => r.status === "needs_review").length,
        overridden: decorated.filter((r) => r.status === "overridden").length,
        increases: rows.filter((r) => r.deltaPercent > 0.05).length,
        decreases: rows.filter((r) => r.deltaPercent < -0.05).length,
      },
      topMovers: [...decorated].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 8),
    };
  });
}

export function getForecastDetail(ctx: ApiContext, productId: string, runId: string | null) {
  return read(() => {
    const db = getDb(ctx.workspaceId);
    const product = db.productById.get(productId);
    if (!product) throw new ApiError("This product does not exist in the current workspace.", "not_found", "It may belong to another workspace.");
    const run = resolveRun(db, runId);
    if (!productsInScope(db, run).some((p) => p.id === productId)) {
      throw new ApiError(`${product.name} is outside the scope of run ${run.id}.`, "not_found");
    }
    const model = db.models.find((m) => m.id === run.modelId) ?? null;
    const s = simulate(paramsFor(db, productId), { today: db.today, horizonDays: run.horizonDays, model: modelProfile(model ?? undefined), scale: runScale(run) });
    const totals = summarise(s, run.horizonDays);
    const [row] = decorateRows(db, run.id, runResult(db, run).rows.filter((r) => r.productId === productId));
    const exceptions = db.exceptions.filter((e) => e.productId === productId);
    const overrides = db.overrides.filter((o) => o.productIds.includes(productId));
    const overrideIds = new Set(overrides.map((o) => o.id));
    const auditEvents = db.audit.filter((e) => e.entityId === productId || overrideIds.has(e.entityId) || exceptions.some((x) => x.id === e.entityId)).slice(0, 20);
    const dqIssues = db.dqIssues.filter((i) => i.sampleProductIds.includes(productId));
    const scenarios = db.scenarios.filter((sc) => sc.assumptions.some((a) => a.scope === product.category || a.scope === "All categories"));
    return {
      product,
      run,
      model,
      row: row ?? null,
      points: toPoints(s),
      summary: summaryFrom(run, { forecast: totals.forecast, previous: totals.previous, actualLast: totals.actualLast, lower: totals.lower, upper: totals.upper }),
      exceptions,
      overrides,
      audit: auditEvents,
      dqIssues,
      scenarios,
      signals: signalsFor(db, product),
    };
  });
}

function signalsFor(db: WorkspaceDb, product: Product) {
  const p = paramsFor(db, product.id);
  const signals: { label: string; detail: string; effect: "up" | "down" | "neutral" }[] = [];
  const upcomingPromo = p.promoStarts.find((s) => s >= 0 && s < 28);
  if (upcomingPromo !== undefined) {
    signals.push({ label: "Planned promotion", detail: `Promotion starts in ${upcomingPromo} days (from promotions calendar, 4 days old).`, effect: "up" });
  }
  if (Math.abs(p.trend) > 0.0015) {
    signals.push({ label: p.trend > 0 ? "Rising trend" : "Declining trend", detail: `Underlying demand is ${p.trend > 0 ? "growing" : "declining"} about ${(Math.abs(p.trend) * 30 * 100).toFixed(1)}% per month.`, effect: p.trend > 0 ? "up" : "down" });
  }
  if (product.lifecycle === "new") signals.push({ label: "New listing", detail: "Less than 90 days of history; the interval is wider while demand stabilises.", effect: "neutral" });
  if (product.lifecycle === "end-of-life") signals.push({ label: "Phase-out", detail: "Marked end-of-life in the product master.", effect: "down" });
  signals.push({ label: "Weekly pattern", detail: "Demand peaks on Saturdays and is lowest mid-week.", effect: "neutral" });
  if (p.annualAmp > 0.12) signals.push({ label: "Seasonality", detail: `Strong annual seasonality (±${(p.annualAmp * 100).toFixed(0)}%).`, effect: "neutral" });
  return signals;
}

/* ── Overrides ─────────────────────────────────────────────────────── */

export type OverrideInput = {
  runId: string;
  productIds: string[];
  /** New total over the horizon for the selected products. */
  newUnits: number;
  reason: OverrideReason;
  evidence: string;
  comment: string;
};

export function previewOverride(ctx: ApiContext, input: Pick<OverrideInput, "runId" | "productIds" | "newUnits">) {
  const db = getDb(ctx.workspaceId);
  const run = resolveRun(db, input.runId);
  const rows = runResult(db, run).rows.filter((r) => input.productIds.includes(r.productId));
  const original = rows.reduce((s, r) => s + r.forecast, 0);
  const delta = input.newUnits - original;
  const pct = original > 0 ? delta / original : 0;
  const policy = db.settings.approvals;
  const needsApproval = Math.abs(pct) > policy.overrideDeltaThreshold || Math.abs(delta) > policy.overrideUnitsThreshold;
  return {
    original,
    delta,
    pct,
    needsApproval,
    policy: `Overrides that change a forecast by more than ${(policy.overrideDeltaThreshold * 100).toFixed(0)}% or ${policy.overrideUnitsThreshold.toLocaleString("en-US")} units need ${policy.approverRole === "manager" ? "Manager" : policy.approverRole} approval.`,
  };
}

export function applyOverride(ctx: ApiContext, input: OverrideInput) {
  return write(ctx, "forecast.override", () => {
    const db = getDb(ctx.workspaceId);
    if (input.productIds.length === 0) throw new ApiError("Select at least one product.", "validation");
    if (!Number.isFinite(input.newUnits) || input.newUnits < 0) throw new ApiError("The override value must be zero or more.", "validation");
    if (input.comment.trim().length < 10) throw new ApiError("Explain the override in at least 10 characters.", "validation");
    const preview = previewOverride(ctx, input);
    const now = iso(Date.now());
    const override: Override = {
      id: nextId(db, "ovr"),
      productIds: input.productIds,
      runId: input.runId,
      originalUnits: preview.original,
      newUnits: Math.round(input.newUnits),
      reason: input.reason,
      evidence: input.evidence,
      comment: input.comment,
      userId: ctx.userId,
      createdAt: now,
      status: preview.needsApproval ? "pending_approval" : "applied",
      approvalId: null,
    };
    db.overrides.unshift(override);
    audit(db, {
      actorId: ctx.userId,
      action: "override",
      entityType: "override",
      entityId: override.id,
      entityLabel: `${input.productIds.length} SKU${input.productIds.length === 1 ? "" : "s"}`,
      previousState: `${preview.original.toLocaleString("en-US")} units`,
      newState: `${override.newUnits.toLocaleString("en-US")} units`,
      reason: input.comment,
      source: "web",
    });
    if (preview.needsApproval) {
      const approvalId = nextId(db, "apr");
      override.approvalId = approvalId;
      const product = input.productIds.length === 1 ? db.productById.get(input.productIds[0] as string) : undefined;
      db.approvals.unshift({
        id: approvalId,
        type: "override",
        objectId: override.id,
        objectLabel: product ? `Override · ${product.name}` : `Override · ${input.productIds.length} SKUs`,
        requestedBy: ctx.userId,
        requestedAt: now,
        dueAt: iso(Date.now() + DAY_MS),
        status: "pending",
        impact: { units: preview.delta, percent: preview.pct, skuCount: input.productIds.length, summary: "Changes the planning baseline for the selected products." },
        changeSet: [{ field: `Forecast (${resolveRun(db, input.runId).horizonDays} days)`, from: `${preview.original.toLocaleString("en-US")} units`, to: `${override.newUnits.toLocaleString("en-US")} units` }],
        evidence: input.evidence ? [input.evidence] : [],
        assumptions: [input.comment],
        policy: { name: "Override approval", rule: preview.policy, requiredRole: db.settings.approvals.approverRole },
        afterApproval: "The override is applied to the planning baseline.",
        history: [{ id: `${approvalId}-h1`, at: now, actorId: ctx.userId, text: "Requested approval." }],
      });
      db.notifications.unshift({
        id: nextId(db, "ntf"),
        category: "approval_requested",
        title: `Approval requested: ${product ? product.name : `${input.productIds.length} SKUs`} override`,
        body: `${actorName(ctx.userId)} requested approval for ${preview.pct >= 0 ? "+" : "−"}${Math.abs(preview.pct * 100).toFixed(1)}%.`,
        href: `/planning/approvals?id=${approvalId}`,
        createdAt: now,
        read: false,
      });
    }
    return override;
  });
}

export const RUN_FORM_OPTIONS = {
  categories: CATEGORIES,
  regions: REGIONS,
  businessUnits: ["Grocery Retail", "Convenience Retail"],
  horizons: [7, 14, 28, 30, 60, 90],
};
