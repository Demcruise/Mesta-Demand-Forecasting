import type { ForecastPoint, Product } from "@/types/domain";
import { categoryDef } from "./catalog";
import { createRng, hashString } from "./random";
import { DAY_MS, isoDate } from "./time";

/**
 * Synthetic demand generator. Each product gets a stable parameter set:
 *   expected(t) = base · trend(t) · weekday(t) · annual(t) · promo(t)
 *   actual(t)   = expected(t) · lognormal noise
 * Forecasts use the expectation with a model-specific bias; the 80% prediction
 * interval widens with the square root of lead time.
 *
 * This exists only to make the interface demonstrable. It is not a forecasting model.
 */

export const HISTORY_DAYS = 182;
/** Days of history over which the previous run's forecast is overlaid (backtest window). */
export const OVERLAY_DAYS = 28;
/** z-score for a central 80% prediction interval. */
export const Z80 = 1.2816;
/**
 * Forecast errors are positively correlated across SKUs (shared drivers such as
 * weather or macro demand). Aggregate intervals combine SKU errors with this
 * correlation instead of assuming independence, which would make totals look far
 * more certain than they are.
 */
export const CROSS_SKU_CORRELATION = 0.12;

/** Standard deviation of a sum of correlated errors, from Σσ² and Σσ. */
export function combineSd(sumSq: number, sumSd: number, rho = CROSS_SKU_CORRELATION) {
  return Math.sqrt((1 - rho) * sumSq + rho * sumSd * sumSd);
}

/** 80% interval of a total built from SKU-level 80% intervals. */
export function aggregateInterval(rows: readonly { forecast: number; lowerBound: number; upperBound: number }[]) {
  let forecast = 0;
  let sumSq = 0;
  let sumSd = 0;
  for (const r of rows) {
    forecast += r.forecast;
    const sd = (r.upperBound - r.lowerBound) / (2 * Z80);
    sumSq += sd * sd;
    sumSd += sd;
  }
  const sd = combineSd(sumSq, sumSd);
  return { forecast, lower: Math.max(0, Math.round(forecast - Z80 * sd)), upper: Math.round(forecast + Z80 * sd) };
}

const WEEKDAY = [1.1, 0.9, 0.88, 0.9, 0.96, 1.1, 1.22]; // Sun..Sat

export type SeriesParams = {
  base: number;
  trend: number;
  annualAmp: number;
  annualPhase: number;
  noise: number;
  weekdayJitter: number[];
  promoStarts: number[];
  prevShift: number;
  launchOffset: number | null;
  seed: number;
};

export type ModelProfile = { bias: number; intervalScale: number; seed: number };

export function productParams(product: Product, workspaceSeed: number): SeriesParams {
  const seed = hashString(`${product.id}:${workspaceSeed}`);
  const rng = createRng(seed);
  const cat = categoryDef(product.category);
  const volume = cat?.volume ?? 1;
  const base = Math.exp(Math.log(42 * volume) + rng.normal() * 0.85);
  let trend = rng.normal() * 0.0012;
  if (product.lifecycle === "end-of-life") trend = -0.003 - rng.next() * 0.002;
  if (product.lifecycle === "new") trend = 0.004 + rng.next() * 0.004;
  const promoStarts: number[] = [];
  const promoCount = rng.int(0, 3);
  for (let i = 0; i < promoCount; i++) promoStarts.push(rng.int(-HISTORY_DAYS, 60));
  // A small share of products get a large planned shift vs the previous run, which
  // produces the "large forecast delta" exceptions.
  const shiftRoll = rng.next();
  const prevShift =
    shiftRoll < 0.035 ? (rng.chance(0.6) ? -1 : 1) * rng.range(0.16, 0.34) : rng.normal() * 0.045;
  const launchedDaysAgo = Math.round((Date.now() - new Date(product.launchedAt).getTime()) / DAY_MS);
  return {
    base,
    trend,
    annualAmp: (cat?.seasonality ?? 0.08) * rng.range(0.6, 1.4),
    annualPhase: rng.range(0, 365),
    noise: product.lifecycle === "new" ? rng.range(0.28, 0.42) : rng.range(0.12, 0.3),
    weekdayJitter: WEEKDAY.map((w) => w * (1 + rng.normal() * 0.04)),
    promoStarts,
    prevShift,
    launchOffset: product.lifecycle === "new" ? -launchedDaysAgo : null,
    seed,
  };
}

function dayOfYear(ts: number) {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), 0, 0).getTime();
  return Math.floor((ts - start) / DAY_MS);
}

/** Expected demand for day offset `t` relative to today (t < 0 is history). */
export function expectedAt(p: SeriesParams, t: number, ts: number) {
  if (p.launchOffset !== null && t < p.launchOffset) return 0;
  const trend = Math.max(0.2, 1 + p.trend * t);
  const weekday = p.weekdayJitter[new Date(ts).getDay()] ?? 1;
  const annual = 1 + p.annualAmp * Math.sin((2 * Math.PI * (dayOfYear(ts) + p.annualPhase)) / 365);
  let promo = 1;
  for (const s of p.promoStarts) if (t >= s && t < s + 7) promo = 1.45;
  let ramp = 1;
  if (p.launchOffset !== null) ramp = Math.min(1, 0.35 + (t - p.launchOffset) / 60);
  return p.base * trend * weekday * annual * promo * ramp;
}

export type SimulatedSeries = {
  /** Epoch ms for each index. */
  dates: number[];
  /** Index of today (first forecast day). */
  todayIndex: number;
  actual: Float64Array;
  forecast: Float64Array;
  /** Standard deviation (in units) of the forecast at each horizon step. */
  sigma: Float64Array;
  previous: Float64Array;
};

/**
 * Simulate one product. `scale` multiplies volume for partial-region scopes.
 */
export function simulate(
  p: SeriesParams,
  opts: { today: number; horizonDays: number; model: ModelProfile; scale?: number },
): SimulatedSeries {
  const { today, horizonDays, model } = opts;
  const scale = opts.scale ?? 1;
  const n = HISTORY_DAYS + horizonDays;
  const rng = createRng(p.seed ^ 0x9e3779b9);
  const modelRng = createRng(p.seed ^ model.seed);
  const modelBias = model.bias + modelRng.normal() * 0.03;
  const dates: number[] = new Array(n);
  const actual = new Float64Array(n).fill(Number.NaN);
  const forecast = new Float64Array(n).fill(Number.NaN);
  const sigma = new Float64Array(n).fill(0);
  const previous = new Float64Array(n).fill(Number.NaN);
  for (let i = 0; i < n; i++) {
    const t = i - HISTORY_DAYS;
    const ts = today + t * DAY_MS;
    dates[i] = ts;
    const e = expectedAt(p, t, ts) * scale;
    const noise = rng.normal();
    if (t < 0) {
      actual[i] = Math.max(0, Math.round(e * Math.exp(p.noise * noise - (p.noise * p.noise) / 2)));
      if (t >= -OVERLAY_DAYS) previous[i] = e * (1 + modelBias * 0.6);
    } else {
      const f = e * (1 + modelBias);
      forecast[i] = f;
      sigma[i] = f * p.noise * model.intervalScale * Math.sqrt(1 + t / 21);
      previous[i] = e * (1 + p.prevShift);
    }
  }
  return { dates, todayIndex: HISTORY_DAYS, actual, forecast, sigma, previous };
}

export function toPoints(s: SimulatedSeries): ForecastPoint[] {
  const out: ForecastPoint[] = [];
  for (let i = 0; i < s.dates.length; i++) {
    const point: ForecastPoint = { date: isoDate(s.dates[i] as number) };
    const a = s.actual[i] as number;
    const f = s.forecast[i] as number;
    const pv = s.previous[i] as number;
    if (!Number.isNaN(a)) point.actual = a;
    if (!Number.isNaN(f)) {
      const sd = s.sigma[i] as number;
      point.forecast = Math.round(f);
      point.lowerBound = Math.max(0, Math.round(f - Z80 * sd));
      point.upperBound = Math.round(f + Z80 * sd);
    }
    if (!Number.isNaN(pv)) point.previousForecast = Math.round(pv);
    out.push(point);
  }
  return out;
}

/** Accumulates many product series into one aggregate (intervals combine with cross-SKU correlation). */
export function createAggregator(length: number, dates: number[], todayIndex: number) {
  const actual = new Float64Array(length);
  const forecast = new Float64Array(length);
  const variance = new Float64Array(length);
  const sdSum = new Float64Array(length);
  const previous = new Float64Array(length);
  const hasPrevious = new Uint8Array(length);
  return {
    add(s: SimulatedSeries) {
      for (let i = 0; i < length; i++) {
        const a = s.actual[i] as number;
        if (!Number.isNaN(a)) actual[i] = (actual[i] as number) + a;
        const f = s.forecast[i] as number;
        if (!Number.isNaN(f)) {
          forecast[i] = (forecast[i] as number) + f;
          const sd = s.sigma[i] as number;
          variance[i] = (variance[i] as number) + sd * sd;
          sdSum[i] = (sdSum[i] as number) + sd;
        }
        const pv = s.previous[i] as number;
        if (!Number.isNaN(pv)) {
          previous[i] = (previous[i] as number) + pv;
          hasPrevious[i] = 1;
        }
      }
    },
    points(): ForecastPoint[] {
      const out: ForecastPoint[] = [];
      for (let i = 0; i < length; i++) {
        const point: ForecastPoint = { date: isoDate(dates[i] as number) };
        if (i < todayIndex) point.actual = Math.round(actual[i] as number);
        else {
          const f = forecast[i] as number;
          const sd = combineSd(variance[i] as number, sdSum[i] as number);
          point.forecast = Math.round(f);
          point.lowerBound = Math.max(0, Math.round(f - Z80 * sd));
          point.upperBound = Math.round(f + Z80 * sd);
        }
        if (hasPrevious[i]) point.previousForecast = Math.round(previous[i] as number);
        out.push(point);
      }
      return out;
    },
  };
}

/** Horizon totals for one product, with the interval of the total (not the sum of bounds). */
export function summarise(s: SimulatedSeries, horizonDays: number) {
  let forecast = 0;
  let variance = 0;
  let previous = 0;
  let actualLast = 0;
  const start = s.todayIndex;
  for (let i = start; i < start + horizonDays; i++) {
    forecast += s.forecast[i] as number;
    const sd = s.sigma[i] as number;
    variance += sd * sd;
    previous += s.previous[i] as number;
  }
  for (let i = start - horizonDays; i < start; i++) actualLast += s.actual[i] as number;
  // Daily errors within one SKU are positively correlated; the factor approximates
  // that without a full covariance model.
  const sdTotal = Math.sqrt(variance) * (1 + 0.35 * Math.sqrt(horizonDays));
  // Weekly buckets for the sparkline: 8 weeks of actuals, then forecast weeks.
  const trend: number[] = [];
  for (let w = 8; w > 0; w--) {
    let acc = 0;
    for (let i = start - w * 7; i < start - (w - 1) * 7; i++) acc += s.actual[i] as number;
    trend.push(Math.round(acc));
  }
  for (let w = 0; w < Math.min(4, Math.floor(horizonDays / 7)); w++) {
    let acc = 0;
    for (let i = start + w * 7; i < start + (w + 1) * 7; i++) acc += s.forecast[i] as number;
    trend.push(Math.round(acc));
  }
  return {
    forecast: Math.round(forecast),
    previous: Math.round(previous),
    actualLast: Math.round(actualLast),
    lower: Math.max(0, Math.round(forecast - Z80 * sdTotal)),
    upper: Math.round(forecast + Z80 * sdTotal),
    trend,
  };
}
