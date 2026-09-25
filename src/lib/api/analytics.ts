import type { ForecastModel, ForecastRow, ForecastRun, Product } from "@/types/domain";
import { baselineRun, getDb, runResult } from "@/lib/mock/db";
import { aggregateInterval } from "@/lib/mock/series";
import { addDays, iso } from "@/lib/mock/time";
import { ApiError, read, type ApiContext } from "./client";
import { syncRuns } from "./forecasting";

/**
 * Forecast insights (INT-008). Read-only analysis of one completed run that answers
 * planning questions the tables alone do not: why the outlook moved, where it is
 * least certain, which items moved most, and where the model is weakest.
 *
 * Scope is deliberately narrow — every figure is derived from the run's own rows and
 * the model's latest backtest, so nothing here implies a business rule that has not
 * been validated (backlog §93).
 */

export type InsightSegment = {
  key: string;
  label: string;
  forecast: number;
  previous: number;
  delta: number;
  deltaPercent: number;
  skuCount: number;
  /** Width of the segment's 80% interval as a share of its forecast. */
  intervalPercent: number;
};

export type InsightMover = {
  productId: string;
  sku: string;
  name: string;
  category: string;
  lifecycle: Product["lifecycle"];
  forecast: number;
  previousForecast: number;
  delta: number;
  deltaPercent: number;
  intervalPercent: number;
  exceptions: number;
};

export type SegmentAccuracy = { segment: string; wape: number; bias: number; volumeShare: number };

export type ForecastInsights = {
  run: ForecastRun;
  model: ForecastModel | null;
  summary: {
    forecast: number;
    previous: number;
    actualLast: number;
    delta: number;
    deltaPercent: number;
    lower: number;
    upper: number;
    intervalPercent: number;
    horizonDays: number;
    skuCount: number;
    periodStart: string;
    periodEnd: string;
  };
  changeByCategory: InsightSegment[];
  changeByLifecycle: InsightSegment[];
  /** Categories ranked by how wide their interval is relative to their forecast. */
  uncertainty: InsightSegment[];
  movers: InsightMover[];
  accuracyBySegment: SegmentAccuracy[];
  accuracyWindow: { id: string; start: string; end: string } | null;
  concentration: { top10Share: number; top50Share: number; totalAbsChange: number };
};

const LIFECYCLE_ORDER: Product["lifecycle"][] = ["new", "core", "seasonal", "end-of-life"];
const LIFECYCLE_LABELS: Record<Product["lifecycle"], string> = {
  new: "New listings",
  core: "Core range",
  seasonal: "Seasonal",
  "end-of-life": "End of life",
};

function segment(rows: ForecastRow[], keyOf: (p: Product) => string, labelOf: (key: string) => string, products: Map<string, Product>): InsightSegment[] {
  const groups = new Map<string, ForecastRow[]>();
  for (const row of rows) {
    const product = products.get(row.productId);
    if (!product) continue;
    const key = keyOf(product);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()].map(([key, bucket]) => {
    const forecast = bucket.reduce((s, r) => s + r.forecast, 0);
    const previous = bucket.reduce((s, r) => s + r.previousForecast, 0);
    const interval = aggregateInterval(bucket);
    return {
      key,
      label: labelOf(key),
      forecast,
      previous,
      delta: forecast - previous,
      deltaPercent: previous > 0 ? (forecast - previous) / previous : 0,
      skuCount: bucket.length,
      intervalPercent: forecast > 0 ? (interval.upper - interval.lower) / forecast : 0,
    };
  });
}

function byAbsDelta(a: { delta: number }, b: { delta: number }) {
  return Math.abs(b.delta) - Math.abs(a.delta);
}

export function getForecastInsights(ctx: ApiContext, runId?: string | null) {
  return read((): ForecastInsights => {
    const db = getDb(ctx.workspaceId);
    syncRuns(db);
    const run = runId ? db.runs.find((r) => r.id === runId) : baselineRun(db);
    if (runId && !run) throw new ApiError(`Forecast run ${runId} was not found in this workspace.`, "not_found");
    if (!run) throw new ApiError("No completed forecast run is available yet.", "not_found", "Create and complete a forecast run first.");
    if (run.status !== "completed" && run.status !== "published") {
      throw new ApiError(`Run ${run.id} has no results yet.`, "conflict", "Insights are available once a run completes.");
    }

    const { rows } = runResult(db, run);
    const model = db.models.find((m) => m.id === run.modelId) ?? null;

    const openExceptions = new Map<string, number>();
    for (const e of db.exceptions) {
      if (e.runId !== run.id || e.status === "resolved" || e.status === "dismissed") continue;
      openExceptions.set(e.productId, (openExceptions.get(e.productId) ?? 0) + 1);
    }

    const forecast = rows.reduce((s, r) => s + r.forecast, 0);
    const previous = rows.reduce((s, r) => s + r.previousForecast, 0);
    const actualLast = rows.reduce((s, r) => s + r.actualLastPeriod, 0);
    const interval = aggregateInterval(rows);

    const changeByCategory = segment(rows, (p) => p.category, (k) => k, db.productById).sort(byAbsDelta);
    const changeByLifecycle = segment(rows, (p) => p.lifecycle, (k) => LIFECYCLE_LABELS[k as Product["lifecycle"]] ?? k, db.productById).sort(
      (a, b) => LIFECYCLE_ORDER.indexOf(a.key as Product["lifecycle"]) - LIFECYCLE_ORDER.indexOf(b.key as Product["lifecycle"]),
    );
    const uncertainty = segment(rows, (p) => p.category, (k) => k, db.productById).sort((a, b) => b.intervalPercent - a.intervalPercent);

    const movers: InsightMover[] = rows
      .map((r) => {
        const product = db.productById.get(r.productId);
        if (!product) return null;
        return {
          productId: r.productId,
          sku: product.sku,
          name: product.name,
          category: product.category,
          lifecycle: product.lifecycle,
          forecast: r.forecast,
          previousForecast: r.previousForecast,
          delta: r.delta,
          deltaPercent: r.deltaPercent,
          intervalPercent: r.forecast > 0 ? (r.upperBound - r.lowerBound) / r.forecast : 0,
          exceptions: openExceptions.get(r.productId) ?? 0,
        } satisfies InsightMover;
      })
      .filter((m): m is InsightMover => m !== null)
      .sort(byAbsDelta)
      .slice(0, 120);

    const absSorted = [...rows].sort(byAbsDelta);
    const totalAbsChange = absSorted.reduce((s, r) => s + Math.abs(r.delta), 0);
    const share = (n: number) => (totalAbsChange > 0 ? absSorted.slice(0, n).reduce((s, r) => s + Math.abs(r.delta), 0) / totalAbsChange : 0);

    const backtest = db.backtests
      .filter((b) => b.modelId === run.modelId && b.status === "completed")
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];

    const periodStart = run.completedAt ?? run.createdAt;

    return {
      run,
      model,
      summary: {
        forecast,
        previous,
        actualLast,
        delta: forecast - previous,
        deltaPercent: previous > 0 ? (forecast - previous) / previous : 0,
        lower: interval.lower,
        upper: interval.upper,
        intervalPercent: forecast > 0 ? (interval.upper - interval.lower) / forecast : 0,
        horizonDays: run.horizonDays,
        skuCount: rows.length,
        periodStart,
        periodEnd: iso(addDays(new Date(periodStart).getTime(), run.horizonDays)),
      },
      changeByCategory,
      changeByLifecycle,
      uncertainty,
      movers,
      accuracyBySegment: backtest?.segments ?? [],
      accuracyWindow: backtest ? { id: backtest.id, start: backtest.windowStart, end: backtest.windowEnd } : null,
      concentration: { top10Share: share(10), top50Share: share(50), totalAbsChange },
    };
  });
}
