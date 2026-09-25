import type { ForecastModel } from "@/types/domain";
import type { ModelProfile } from "./series";
import { addDays, DAY_MS, iso, isoDate } from "./time";

/**
 * Proposed model catalogue. Model families and metric values are illustrative until
 * the analytics owners confirm model types and accuracy definitions (backlog §93 items 9–11).
 */
export function seedModels(today: number, skuCount: number): ForecastModel[] {
  const evalStart = isoDate(addDays(today, -91));
  const evalEnd = isoDate(addDays(today, -1));
  const population = `${skuCount.toLocaleString("en-US")} SKUs, all locations, daily grain`;
  const metrics = (wape: number, bias: number, coverage80: number, mae: number) => ({
    wape,
    bias,
    coverage80,
    mae,
    rmse: Math.round(mae * 1.42 * 10) / 10,
    evaluationStart: evalStart,
    evaluationEnd: evalEnd,
    population,
  });
  return [
    {
      id: "mdl_gbm_24",
      name: "Gradient-boosted demand",
      family: "Gradient boosting (global model)",
      version: "2.4",
      status: "production",
      isDefault: true,
      lastTrainedAt: iso(today - 5 * DAY_MS + 2 * 3_600_000),
      trainingStart: isoDate(addDays(today, -735)),
      trainingEnd: isoDate(addDays(today, -6)),
      horizonDays: 90,
      frequency: "daily",
      owner: "u_sari",
      dataset: "Daily demand · 2 years · 48 locations",
      features: ["Lagged demand (7/14/28 days)", "Day of week", "Public holidays", "Promotions calendar", "Price index", "Store group"],
      limitations: [
        "Accuracy drops for SKUs with fewer than 60 days of history.",
        "Promotions not present in the promotions calendar are not anticipated.",
        "Intervals are calibrated at the SKU level; aggregate intervals are approximate.",
      ],
      metrics: metrics(0.214, 0.018, 0.78, 11.8),
      usage: { runs: 186, lastUsedAt: iso(today + 6 * 3_600_000) },
    },
    {
      id: "mdl_gbm_25",
      name: "Gradient-boosted demand",
      family: "Gradient boosting (global model)",
      version: "2.5",
      status: "candidate",
      isDefault: false,
      lastTrainedAt: iso(today - 2 * DAY_MS + 3 * 3_600_000),
      trainingStart: isoDate(addDays(today, -735)),
      trainingEnd: isoDate(addDays(today, -3)),
      horizonDays: 90,
      frequency: "daily",
      owner: "u_sari",
      dataset: "Daily demand · 2 years · 48 locations · weather index",
      features: ["Lagged demand (7/14/28 days)", "Day of week", "Public holidays", "Promotions calendar", "Price index", "Store group", "Regional weather index"],
      limitations: [
        "Weather index coverage is incomplete for Sulawesi locations.",
        "Not yet validated for horizons beyond 60 days.",
      ],
      metrics: metrics(0.197, -0.006, 0.81, 10.9),
      usage: { runs: 4, lastUsedAt: iso(today - DAY_MS + 9 * 3_600_000) },
    },
    {
      id: "mdl_ets_18",
      name: "Exponential smoothing",
      family: "Exponential smoothing (per series)",
      version: "1.8",
      status: "production",
      isDefault: false,
      lastTrainedAt: iso(today - 7 * DAY_MS),
      trainingStart: isoDate(addDays(today, -370)),
      trainingEnd: isoDate(addDays(today, -8)),
      horizonDays: 60,
      frequency: "daily",
      owner: "u_lina",
      dataset: "Daily demand · 1 year · per SKU-location",
      features: ["Level", "Trend", "Weekly seasonality"],
      limitations: ["Does not use promotions or price.", "Used as fallback when the global model is unavailable."],
      metrics: metrics(0.262, 0.031, 0.74, 14.2),
      usage: { runs: 41, lastUsedAt: iso(today - 9 * DAY_MS) },
    },
    {
      id: "mdl_tsb_12",
      name: "Intermittent demand",
      family: "Croston / TSB (per series)",
      version: "1.2",
      status: "candidate",
      isDefault: false,
      lastTrainedAt: iso(today - 12 * DAY_MS),
      trainingStart: isoDate(addDays(today, -370)),
      trainingEnd: isoDate(addDays(today, -13)),
      horizonDays: 60,
      frequency: "weekly",
      owner: "u_sari",
      dataset: "Weekly demand · slow movers only",
      features: ["Demand size", "Inter-demand interval"],
      limitations: ["Only suitable for slow-moving SKUs (fewer than 3 sales per week)."],
      metrics: { ...metrics(0.408, 0.044, 0.83, 3.1), population: "412 slow-moving SKUs, weekly grain" },
      usage: { runs: 7, lastUsedAt: iso(today - 16 * DAY_MS) },
    },
    {
      id: "mdl_gbm_23",
      name: "Gradient-boosted demand",
      family: "Gradient boosting (global model)",
      version: "2.3",
      status: "archived",
      isDefault: false,
      lastTrainedAt: iso(today - 48 * DAY_MS),
      trainingStart: isoDate(addDays(today, -780)),
      trainingEnd: isoDate(addDays(today, -49)),
      horizonDays: 60,
      frequency: "daily",
      owner: "u_sari",
      dataset: "Daily demand · 2 years · 48 locations",
      features: ["Lagged demand (7/14/28 days)", "Day of week", "Public holidays", "Promotions calendar"],
      limitations: ["Superseded by 2.4."],
      metrics: metrics(0.229, 0.027, 0.75, 12.6),
      usage: { runs: 212, lastUsedAt: iso(today - 44 * DAY_MS) },
    },
  ];
}

export function modelProfile(model: ForecastModel | undefined): ModelProfile {
  if (!model) return { bias: 0, intervalScale: 1, seed: 7 };
  const seed = Number.parseInt(model.id.replace(/\D/g, ""), 10) || 7;
  // Lower coverage → intervals too narrow; scale reflects the model's calibration.
  return { bias: model.metrics.bias, intervalScale: model.metrics.coverage80 / 0.8, seed };
}
