import type { ForecastModel } from "@/types/domain";
import type { ModelProfile } from "./series";
import { addDays, DAY_MS, iso, isoDate } from "./time";
import { pick } from "@/lib/i18n/core";

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
      family: pick("Gradient boosting (model global)", "Gradient boosting (global model)"),
      version: "2.4",
      status: "production",
      isDefault: true,
      lastTrainedAt: iso(today - 5 * DAY_MS + 2 * 3_600_000),
      trainingStart: isoDate(addDays(today, -735)),
      trainingEnd: isoDate(addDays(today, -6)),
      horizonDays: 90,
      frequency: "daily",
      owner: "u_sari",
      dataset: pick("Permintaan harian · 2 tahun · 48 lokasi", "Daily demand · 2 years · 48 locations"),
      features: [pick("Permintaan tertunda (7/14/28 hari)", "Lagged demand (7/14/28 days)"), pick("Hari dalam minggu", "Day of week"), pick("Hari libur nasional", "Public holidays"), pick("Kalender promosi", "Promotions calendar"), pick("Indeks harga", "Price index"), pick("Grup toko", "Store group")],
      limitations: [
        pick("Akurasi menurun untuk SKU dengan riwayat kurang dari 60 hari.", "Accuracy drops for SKUs with fewer than 60 days of history."),
        pick("Promosi yang belum ada di kalender promosi tidak diperhitungkan.", "Promotions not present in the promotions calendar are not anticipated."),
        pick("Rentang dikalibrasi pada tingkat SKU; rentang agregat bersifat perkiraan.", "Intervals are calibrated at the SKU level; aggregate intervals are approximate."),
      ],
      metrics: metrics(0.214, 0.018, 0.78, 11.8),
      usage: { runs: 186, lastUsedAt: iso(today + 6 * 3_600_000) },
    },
    {
      id: "mdl_gbm_25",
      name: "Gradient-boosted demand",
      family: pick("Gradient boosting (model global)", "Gradient boosting (global model)"),
      version: "2.5",
      status: "candidate",
      isDefault: false,
      lastTrainedAt: iso(today - 2 * DAY_MS + 3 * 3_600_000),
      trainingStart: isoDate(addDays(today, -735)),
      trainingEnd: isoDate(addDays(today, -3)),
      horizonDays: 90,
      frequency: "daily",
      owner: "u_sari",
      dataset: pick("Permintaan harian · 2 tahun · 48 lokasi · indeks cuaca", "Daily demand · 2 years · 48 locations · weather index"),
      features: [pick("Permintaan tertunda (7/14/28 hari)", "Lagged demand (7/14/28 days)"), pick("Hari dalam minggu", "Day of week"), pick("Hari libur nasional", "Public holidays"), pick("Kalender promosi", "Promotions calendar"), pick("Indeks harga", "Price index"), pick("Grup toko", "Store group"), pick("Indeks cuaca wilayah", "Regional weather index")],
      limitations: [
        pick("Cakupan indeks cuaca belum lengkap untuk lokasi di Sulawesi.", "Weather index coverage is incomplete for Sulawesi locations."),
        pick("Belum divalidasi untuk rentang di atas 60 hari.", "Not yet validated for horizons beyond 60 days."),
      ],
      metrics: metrics(0.197, -0.006, 0.81, 10.9),
      usage: { runs: 4, lastUsedAt: iso(today - DAY_MS + 9 * 3_600_000) },
    },
    {
      id: "mdl_ets_18",
      name: "Exponential smoothing",
      family: pick("Exponential smoothing (per seri)", "Exponential smoothing (per series)"),
      version: "1.8",
      status: "production",
      isDefault: false,
      lastTrainedAt: iso(today - 7 * DAY_MS),
      trainingStart: isoDate(addDays(today, -370)),
      trainingEnd: isoDate(addDays(today, -8)),
      horizonDays: 60,
      frequency: "daily",
      owner: "u_lina",
      dataset: pick("Permintaan harian · 1 tahun · per SKU-lokasi", "Daily demand · 1 year · per SKU-location"),
      features: ["Level", pick("Tren", "Trend"), pick("Musiman mingguan", "Weekly seasonality")],
      limitations: [pick("Tidak memakai data promosi atau harga.", "Does not use promotions or price."), pick("Dipakai sebagai cadangan bila model global tidak tersedia.", pick("Dipakai sebagai cadangan saat model global tidak tersedia.", "Used as fallback when the global model is unavailable."))],
      metrics: metrics(0.262, 0.031, 0.74, 14.2),
      usage: { runs: 41, lastUsedAt: iso(today - 9 * DAY_MS) },
    },
    {
      id: "mdl_tsb_12",
      name: "Intermittent demand",
      family: pick("Croston / TSB (per seri)", "Croston / TSB (per series)"),
      version: "1.2",
      status: "candidate",
      isDefault: false,
      lastTrainedAt: iso(today - 12 * DAY_MS),
      trainingStart: isoDate(addDays(today, -370)),
      trainingEnd: isoDate(addDays(today, -13)),
      horizonDays: 60,
      frequency: "weekly",
      owner: "u_sari",
      dataset: pick("Permintaan mingguan · hanya produk lambat laku", "Weekly demand · slow movers only"),
      features: [pick("Ukuran permintaan", "Demand size"), pick("Jarak antar-permintaan", "Inter-demand interval")],
      limitations: [pick("Hanya cocok untuk SKU lambat laku (kurang dari 3 penjualan per minggu).", "Only suitable for slow-moving SKUs (fewer than 3 sales per week).")],
      metrics: { ...metrics(0.408, 0.044, 0.83, 3.1), population: pick("412 SKU lambat laku, granularitas mingguan", "412 slow-moving SKUs, weekly grain") },
      usage: { runs: 7, lastUsedAt: iso(today - 16 * DAY_MS) },
    },
    {
      id: "mdl_gbm_23",
      name: "Gradient-boosted demand",
      family: pick("Gradient boosting (model global)", "Gradient boosting (global model)"),
      version: "2.3",
      status: "archived",
      isDefault: false,
      lastTrainedAt: iso(today - 48 * DAY_MS),
      trainingStart: isoDate(addDays(today, -780)),
      trainingEnd: isoDate(addDays(today, -49)),
      horizonDays: 60,
      frequency: "daily",
      owner: "u_sari",
      dataset: pick("Permintaan harian · 2 tahun · 48 lokasi", "Daily demand · 2 years · 48 locations"),
      features: [pick("Permintaan tertunda (7/14/28 hari)", "Lagged demand (7/14/28 days)"), pick("Hari dalam minggu", "Day of week"), pick("Hari libur nasional", "Public holidays"), pick("Kalender promosi", "Promotions calendar")],
      limitations: [pick("Sudah digantikan versi 2.4.", "Superseded by 2.4.")],
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
