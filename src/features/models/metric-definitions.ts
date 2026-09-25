/**
 * Metric definitions (backlog §27): every metric shows definition, unit, period,
 * population and baseline. Definitions are proposals pending analytics sign-off
 * (backlog §93 item 10).
 */
export const METRIC_DEFINITIONS = {
  wape: {
    label: "WAPE",
    name: "Weighted absolute percentage error",
    definition: "Sum of absolute forecast errors divided by sum of actual demand. Lower is better.",
    unit: "% of actual demand",
    baseline: "Seasonal naive forecast (same weekday last week): 34.0%",
  },
  bias: {
    label: "Bias",
    name: "Forecast bias",
    definition: "Mean signed error divided by mean actual demand. Positive means over-forecasting.",
    unit: "% of actual demand",
    baseline: "Target within ±3%",
  },
  mae: {
    label: "MAE",
    name: "Mean absolute error",
    definition: "Average absolute difference between forecast and actual, per SKU-day.",
    unit: "units per SKU-day",
    baseline: "Seasonal naive: 18.4",
  },
  rmse: {
    label: "RMSE",
    name: "Root mean squared error",
    definition: "Square root of the mean squared error per SKU-day. Penalises large misses.",
    unit: "units per SKU-day",
    baseline: "Seasonal naive: 27.1",
  },
  coverage: {
    label: "Coverage",
    name: "80% interval coverage",
    definition: "Share of actuals that fell inside the 80% prediction interval. Well calibrated is close to 80%.",
    unit: "% of SKU-days",
    baseline: "Target 80%",
  },
} as const;

export type MetricKey = keyof typeof METRIC_DEFINITIONS;
