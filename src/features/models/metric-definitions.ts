/**
 * Metric definitions (backlog §27): every metric shows definition, unit, period,
 * population and baseline. Definitions are proposals pending analytics sign-off
 * (backlog §93 item 10).
 */
import { localized, pick } from "@/lib/i18n/core";

export const METRIC_DEFINITIONS = localized({
  wape: {
    label: "WAPE",
    name: "Weighted absolute percentage error",
    definition: pick("Jumlah selisih absolut perkiraan dibagi jumlah permintaan aktual. Semakin kecil semakin baik.", "Sum of absolute forecast errors divided by sum of actual demand. Lower is better."),
    unit: pick("% dari permintaan aktual", "% of actual demand"),
    baseline: pick("Perkiraan naif musiman (hari yang sama minggu lalu): 34,0%", "Seasonal naive forecast (same weekday last week): 34.0%"),
  },
  bias: {
    label: "Bias",
    name: pick("Bias perkiraan", "Forecast bias"),
    definition: pick("Rata-rata selisih bertanda dibagi rata-rata permintaan aktual. Positif berarti cenderung terlalu tinggi.", "Mean signed error divided by mean actual demand. Positive means over-forecasting."),
    unit: pick("% dari permintaan aktual", "% of actual demand"),
    baseline: pick("Target dalam ±3%", "Target within ±3%"),
  },
  mae: {
    label: "MAE",
    name: "Mean absolute error",
    definition: pick("Rata-rata selisih absolut antara perkiraan dan aktual, per SKU-hari.", "Average absolute difference between forecast and actual, per SKU-day."),
    unit: pick("unit per SKU-hari", "units per SKU-day"),
    baseline: "Naif musiman: 18,4",
  },
  rmse: {
    label: "RMSE",
    name: "Root mean squared error",
    definition: pick("Akar dari rata-rata kuadrat selisih per SKU-hari. Memberi bobot lebih pada kesalahan besar.", pick("Akar kuadrat dari rata-rata selisih kuadrat per SKU-hari. Menghukum selisih besar.", "Square root of the mean squared error per SKU-day. Penalises large misses.")),
    unit: pick("unit per SKU-hari", "units per SKU-day"),
    baseline: "Naif musiman: 27,1",
  },
  coverage: {
    label: "Cakupan",
    name: "Cakupan rentang 80%",
    definition: pick("Bagian aktual yang berada di dalam rentang perkiraan 80%. Kalibrasi yang baik mendekati 80%.", "Share of actuals that fell inside the 80% prediction interval. Well calibrated is close to 80%."),
    unit: pick("% dari SKU-hari", "% of SKU-days"),
    baseline: "Target 80%",
  },
} as const, {
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
    definition: pick("Rata-rata selisih absolut antara perkiraan dan aktual, per SKU-hari.", "Average absolute difference between forecast and actual, per SKU-day."),
    unit: pick("unit per SKU-hari", "units per SKU-day"),
    baseline: "Seasonal naive: 18.4",
  },
  rmse: {
    label: "RMSE",
    name: "Root mean squared error",
    definition: pick("Akar kuadrat dari rata-rata selisih kuadrat per SKU-hari. Menghukum selisih besar.", "Square root of the mean squared error per SKU-day. Penalises large misses."),
    unit: pick("unit per SKU-hari", "units per SKU-day"),
    baseline: "Seasonal naive: 27.1",
  },
  coverage: {
    label: "Coverage",
    name: "80% interval coverage",
    definition: "Share of actuals that fell inside the 80% prediction interval. Well calibrated is close to 80%.",
    unit: "% of SKU-days",
    baseline: "Target 80%",
  },
} as const);

export type MetricKey = keyof typeof METRIC_DEFINITIONS;
