import type { Assumption, Scenario, ScenarioDriver, ScenarioResult } from "@/types/domain";
import { REGIONS } from "./catalog";
import { baselineRun, runResult, type WorkspaceDb } from "./db";
import { DAY_MS, HOUR_MS, iso, MINUTE_MS } from "./time";

export const SCENARIO_SIMULATION_MS = 2_500;

export const ALL_CATEGORIES_SCOPE = "All categories";
export const REGION_SCOPE_PREFIX = "Region · ";

/** Price elasticity used to translate a price assumption into demand. Placeholder. */
export const PRICE_ELASTICITY = -1.2;

export const DRIVER_LABELS: Record<ScenarioDriver, string> = {
  demand_change: "Perubahan permintaan",
  price: "Harga / komersial",
  promotion: "Kenaikan promosi",
  seasonality: "Musiman",
  external: "Faktor eksternal",
  availability: "Ketersediaan",
  regional: "Penyesuaian wilayah",
  lifecycle: "Siklus produk",
};

export const DRIVER_HELP: Record<ScenarioDriver, string> = {
  demand_change: "Perubahan langsung pada perkiraan permintaan, dalam persen.",
  price: `Perubahan harga jual, dalam persen. Dikonversi ke permintaan dengan elastisitas ${PRICE_ELASTICITY}.`,
  promotion: "Tambahan kenaikan dari promosi yang belum ada di kalender promosi, dalam persen.",
  seasonality: "Perubahan pada puncak musiman, dalam persen.",
  external: "Efek cuaca, acara, atau kondisi makro, dalam persen.",
  availability: "Perubahan ketersediaan di rak, dalam poin persentase. Ketersediaan rendah membatasi permintaan.",
  regional: "Perubahan permintaan di suatu wilayah, dalam persen. Diskalakan menurut porsi volume wilayah.",
  lifecycle: "Efek kenaikan awal atau penghentian produk, dalam persen.",
};

export const DRIVER_UNITS: Record<ScenarioDriver, Assumption["unit"]> = {
  demand_change: "%",
  price: "%",
  promotion: "%",
  seasonality: "%",
  external: "%",
  availability: "pp",
  regional: "%",
  lifecycle: "%",
};

/** Demand effect of one assumption, as a fraction. */
export function assumptionEffect(a: Assumption) {
  const change = (a.value - a.baselineValue) / 100;
  switch (a.driver) {
    case "price":
      return change * PRICE_ELASTICITY;
    case "regional":
      return change / REGIONS.length;
    default:
      return change;
  }
}

function appliesTo(a: Assumption, category: string) {
  if (a.scope === ALL_CATEGORIES_SCOPE || a.scope.startsWith(REGION_SCOPE_PREFIX)) return true;
  return a.scope === category;
}

export function simulateScenario(db: WorkspaceDb, scenario: Pick<Scenario, "baselineRunId" | "assumptions">): ScenarioResult | null {
  const run = db.runs.find((r) => r.id === scenario.baselineRunId) ?? baselineRun(db);
  if (!run) return null;
  const result = runResult(db, run);
  const byCategory = result.byCategory.map((c) => {
    let mult = 1;
    for (const a of scenario.assumptions) if (appliesTo(a, c.category)) mult *= 1 + assumptionEffect(a);
    return { category: c.category, baseline: Math.round(c.forecast), scenario: Math.round(c.forecast * mult) };
  });
  const baselineUnits = byCategory.reduce((s, c) => s + c.baseline, 0);
  const scenarioUnits = byCategory.reduce((s, c) => s + c.scenario, 0);
  const overall = baselineUnits > 0 ? scenarioUnits / baselineUnits : 1;
  const future = result.aggregate.filter((p) => p.forecast !== undefined);
  const lower = future.reduce((s, p) => s + (p.lowerBound ?? 0), 0);
  const upper = future.reduce((s, p) => s + (p.upperBound ?? 0), 0);
  const baseSum = future.reduce((s, p) => s + (p.forecast ?? 0), 0);
  // Aggregate interval is approximated by scaling the baseline interval width.
  const widthRatio = baseSum > 0 ? (upper - lower) / baseSum / Math.sqrt(future.length) : 0.2;
  return {
    simulatedAt: new Date().toISOString(),
    baselineUnits,
    scenarioUnits,
    deltaUnits: scenarioUnits - baselineUnits,
    deltaPercent: baselineUnits > 0 ? (scenarioUnits - baselineUnits) / baselineUnits : 0,
    lowerBound: Math.round(scenarioUnits * (1 - widthRatio)),
    upperBound: Math.round(scenarioUnits * (1 + widthRatio)),
    points: future.map((p) => ({ date: p.date, baseline: p.forecast ?? 0, scenario: Math.round((p.forecast ?? 0) * overall) })),
    byCategory,
  };
}

export function seedScenarios(db: WorkspaceDb, now: number): Scenario[] {
  const base = baselineRun(db);
  if (!base) return [];
  const mk = (s: Omit<Scenario, "result" | "baselineRunId"> & { simulate: boolean }): Scenario => {
    const { simulate, ...rest } = s;
    const scenario: Scenario = { ...rest, baselineRunId: base.id, result: null };
    if (simulate) {
      scenario.result = simulateScenario(db, scenario);
      if (scenario.result) scenario.result.simulatedAt = scenario.modifiedAt;
    }
    return scenario;
  };
  return [
    mk({
      id: "scn_holiday",
      name: "Kenaikan libur akhir tahun",
      description: "Kenaikan musim libur untuk Minuman dan Camilan, dengan puncak Sembako yang lebih rendah.",
      ownerId: "u_rina",
      status: "in_review",
      createdAt: iso(now - 4 * DAY_MS),
      modifiedAt: iso(now - 22 * HOUR_MS),
      simulate: true,
      assumptions: [
        { id: "a1", driver: "seasonality", scope: "Beverages", baselineValue: 0, value: 12, unit: "%", rationale: "Minuman tumbuh 11–14% pada dua periode akhir tahun terakhir." },
        { id: "a2", driver: "promotion", scope: "Snacks", baselineValue: 0, value: 8, unit: "%", rationale: "Promosi paket hadiah disepakati dengan dua pemasok camilan." },
        { id: "a3", driver: "seasonality", scope: "Staples", baselineValue: 0, value: -3, unit: "%", rationale: "Puncak Sembako terjadi lebih awal bulan ini dibanding tahun lalu." },
      ],
    }),
    mk({
      id: "scn_oil_price",
      name: "Kenaikan harga minyak goreng",
      description: "Kenaikan harga dari pemasok diteruskan ke harga jual.",
      ownerId: "u_yoga",
      status: "simulated",
      createdAt: iso(now - 2 * DAY_MS),
      modifiedAt: iso(now - 5 * HOUR_MS),
      simulate: true,
      assumptions: [
        { id: "a1", driver: "price", scope: "Staples", baselineValue: 0, value: 8, unit: "%", rationale: "Pemberitahuan pemasok: harga daftar naik 8% mulai bulan depan." },
      ],
    }),
    mk({
      id: "scn_wj_supply",
      name: "Gangguan pasokan Jawa Barat",
      description: "Pemeliharaan pusat distribusi menurunkan ketersediaan di Jawa Barat.",
      ownerId: "u_arif",
      status: "draft",
      createdAt: iso(now - 7 * HOUR_MS),
      modifiedAt: iso(now - 40 * MINUTE_MS),
      simulate: false,
      assumptions: [
        { id: "a1", driver: "availability", scope: `${REGION_SCOPE_PREFIX}West Java`, baselineValue: 97, value: 90, unit: "pp", rationale: "Jendela pemeliharaan pusat distribusi selama 10 hari." },
      ],
    }),
    mk({
      id: "scn_frozen_heat",
      name: "Musim kemarau panas · Beku",
      description: "Suhu di atas rata-rata menaikkan penjualan es krim dan makanan beku.",
      ownerId: "u_dewi",
      status: "approved",
      createdAt: iso(now - 12 * DAY_MS),
      modifiedAt: iso(now - 10 * DAY_MS),
      simulate: true,
      assumptions: [
        { id: "a1", driver: "external", scope: "Frozen", baselineValue: 0, value: 15, unit: "%", rationale: "Prakiraan layanan cuaca: 1,5 °C di atas rata-rata." },
        { id: "a2", driver: "demand_change", scope: "Beverages", baselineValue: 0, value: 4, unit: "%", rationale: "Kenaikan berkorelasi pada minuman dingin." },
      ],
    }),
    mk({
      id: "scn_new_range",
      name: "Peluncuran rangkaian label sendiri",
      description: "Peluncuran Mesta Select menggerus penjualan SKU Rumah Tangga bermerek.",
      ownerId: "u_rina",
      status: "archived",
      createdAt: iso(now - 30 * DAY_MS),
      modifiedAt: iso(now - 21 * DAY_MS),
      simulate: true,
      assumptions: [
        { id: "a1", driver: "lifecycle", scope: "Household", baselineValue: 0, value: -6, unit: "%", rationale: "Pergerakan penjualan terlihat di toko percontohan." },
      ],
    }),
  ];
}

