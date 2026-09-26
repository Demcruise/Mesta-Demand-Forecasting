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
    definition: "Jumlah selisih absolut perkiraan dibagi jumlah permintaan aktual. Semakin kecil semakin baik.",
    unit: "% dari permintaan aktual",
    baseline: "Perkiraan naif musiman (hari yang sama minggu lalu): 34,0%",
  },
  bias: {
    label: "Bias",
    name: "Bias perkiraan",
    definition: "Rata-rata selisih bertanda dibagi rata-rata permintaan aktual. Positif berarti cenderung terlalu tinggi.",
    unit: "% dari permintaan aktual",
    baseline: "Target dalam ±3%",
  },
  mae: {
    label: "MAE",
    name: "Mean absolute error",
    definition: "Rata-rata selisih absolut antara perkiraan dan aktual, per SKU-hari.",
    unit: "unit per SKU-hari",
    baseline: "Naif musiman: 18,4",
  },
  rmse: {
    label: "RMSE",
    name: "Root mean squared error",
    definition: "Akar dari rata-rata kuadrat selisih per SKU-hari. Memberi bobot lebih pada kesalahan besar.",
    unit: "unit per SKU-hari",
    baseline: "Naif musiman: 27,1",
  },
  coverage: {
    label: "Cakupan",
    name: "Cakupan rentang 80%",
    definition: "Bagian aktual yang berada di dalam rentang perkiraan 80%. Kalibrasi yang baik mendekati 80%.",
    unit: "% dari SKU-hari",
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
} as const);

export type MetricKey = keyof typeof METRIC_DEFINITIONS;
