import type { Backtest, ForecastPoint, Frequency } from "@/types/domain";
import { CATEGORIES } from "./catalog";
import { baselineRun, runResult, type WorkspaceDb } from "./db";
import { createRng, hashString } from "./random";
import { addDays, DAY_MS, HOUR_MS, iso, isoDate } from "./time";

const BUCKETS = ["0–10%", "10–20%", "20–30%", "30–40%", "40–50%", "50–60%", "60%+"];

/**
 * Builds a synthetic backtest: the model's historical forecasts replayed against
 * actuals over the chosen window. Metric values track the model's catalogue metrics
 * with window-specific noise.
 */
export function buildBacktestResult(
  db: WorkspaceDb,
  modelId: string,
  windowDays: number,
  frequency: Frequency,
): Pick<Backtest, "metrics" | "segments" | "points" | "errorBuckets"> {
  const model = db.models.find((m) => m.id === modelId) ?? db.models[0];
  const run = baselineRun(db);
  if (!model || !run) return { metrics: null, segments: [], points: [], errorBuckets: [] };
  const rng = createRng(hashString(`${modelId}:${windowDays}:${frequency}:${db.seed}`));
  const history = runResult(db, run).aggregate.filter((p) => p.actual !== undefined).slice(-windowDays);
  const m = model.metrics;
  const wape = Math.max(0.05, m.wape * (1 + rng.normal() * 0.05));
  const bias = m.bias + rng.normal() * 0.006;

  let points: ForecastPoint[] = history.map((p) => {
    const actual = p.actual ?? 0;
    const err = rng.normal() * wape * 0.55;
    const f = Math.max(0, actual * (1 + bias + err));
    const band = f * wape * 1.15 * (m.coverage80 / 0.8);
    return { date: p.date, actual, forecast: Math.round(f), lowerBound: Math.round(Math.max(0, f - band)), upperBound: Math.round(f + band) };
  });
  if (frequency === "weekly") {
    const weeks: ForecastPoint[] = [];
    for (let i = 0; i + 7 <= points.length; i += 7) {
      const chunk = points.slice(i, i + 7);
      const s = (k: keyof ForecastPoint) => chunk.reduce((acc, p) => acc + ((p[k] as number | undefined) ?? 0), 0);
      weeks.push({ date: chunk[0]?.date ?? "", actual: s("actual"), forecast: s("forecast"), lowerBound: s("lowerBound"), upperBound: s("upperBound") });
    }
    points = weeks;
  }
  const absErr = points.reduce((s, p) => s + Math.abs((p.forecast ?? 0) - (p.actual ?? 0)), 0);
  const sqErr = points.reduce((s, p) => s + ((p.forecast ?? 0) - (p.actual ?? 0)) ** 2, 0);
  const inside = points.filter((p) => (p.actual ?? 0) >= (p.lowerBound ?? 0) && (p.actual ?? 0) <= (p.upperBound ?? 0)).length;
  const skus = db.products.length;
  const errorBuckets = BUCKETS.map((bucket, i) => {
    const center = (i + 0.5) * 0.1;
    const density = Math.exp(-((center - wape) ** 2) / (2 * 0.12 ** 2));
    return { bucket, count: Math.round(density * skus * 0.38 * (1 + rng.normal() * 0.08)) };
  });
  const segments = CATEGORIES.map((segment) => ({
    segment,
    wape: Math.max(0.06, wape * (1 + rng.normal() * 0.22)),
    bias: bias + rng.normal() * 0.025,
    volumeShare: 0,
  }));
  const shares = segments.map(() => rng.range(0.5, 1.8));
  const shareSum = shares.reduce((a, b) => a + b, 0);
  segments.forEach((s, i) => (s.volumeShare = (shares[i] ?? 1) / shareSum));
  return {
    metrics: {
      wape,
      bias,
      mae: points.length ? absErr / points.length / Math.max(1, skus / 40) : 0,
      rmse: points.length ? Math.sqrt(sqErr / points.length) / Math.max(1, skus / 40) : 0,
      coverage80: points.length ? inside / points.length : 0,
      evaluationStart: points[0]?.date ?? isoDate(db.today),
      evaluationEnd: points[points.length - 1]?.date ?? isoDate(db.today),
      population: `${skus.toLocaleString("en-US")} SKUs, all locations, ${frequency} grain`,
    },
    segments,
    points,
    errorBuckets,
  };
}

export function seedBacktests(db: WorkspaceDb, now: number): Backtest[] {
  const mk = (id: string, modelId: string, windowDays: number, frequency: Frequency, createdAt: number, createdBy: string): Backtest => {
    const model = db.models.find((m) => m.id === modelId);
    return {
      id,
      modelId,
      modelVersion: model?.version ?? "",
      windowStart: isoDate(addDays(db.today, -windowDays)),
      windowEnd: isoDate(addDays(db.today, -1)),
      frequency,
      status: "completed",
      createdAt: iso(createdAt),
      createdBy,
      ...buildBacktestResult(db, modelId, windowDays, frequency),
    };
  };
  return [
    mk("BT-0412", "mdl_gbm_25", 91, "daily", now - 20 * HOUR_MS - 40 * 60_000, "u_sari"),
    mk("BT-0411", "mdl_gbm_24", 91, "daily", now - 21 * HOUR_MS, "u_sari"),
    mk("BT-0398", "mdl_ets_18", 91, "daily", now - 8 * DAY_MS, "u_lina"),
    mk("BT-0391", "mdl_tsb_12", 84, "weekly", now - 12 * DAY_MS, "u_sari"),
  ];
}
