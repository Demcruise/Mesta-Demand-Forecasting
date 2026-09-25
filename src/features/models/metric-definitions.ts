/**
 * Metric definitions (backlog §27): every metric shows definition, unit, period,
 * population and baseline. Definitions are proposals pending analytics sign-off
 * (backlog §93 item 10).
 */
export const METRIC_DEFINITIONS = {
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
} as const;

export type MetricKey = keyof typeof METRIC_DEFINITIONS;
