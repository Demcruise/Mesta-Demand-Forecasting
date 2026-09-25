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
  demand_change: "Demand change",
  price: "Price / commercial",
  promotion: "Promotion uplift",
  seasonality: "Seasonality",
  external: "External factor",
  availability: "Availability",
  regional: "Regional adjustment",
  lifecycle: "Product lifecycle",
};

export const DRIVER_HELP: Record<ScenarioDriver, string> = {
  demand_change: "Direct change to expected demand, in percent.",
  price: `Change in shelf price, in percent. Converted to demand with an elasticity of ${PRICE_ELASTICITY}.`,
  promotion: "Additional uplift from promotions not in the promotions calendar, in percent.",
  seasonality: "Change to the seasonal peak, in percent.",
  external: "Weather, events or macro effects, in percent.",
  availability: "Change in on-shelf availability, in percentage points. Lower availability caps demand.",
  regional: "Change to demand in a region, in percent. Scaled by the region's share of volume.",
  lifecycle: "Ramp-up or phase-out effect, in percent.",
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
    if (simulate) scenario.result = simulateScenario(db, scenario);
    return scenario;
  };
  return [
    mk({
      id: "scn_holiday",
      name: "Year-end holiday uplift",
      description: "Holiday season uplift for Beverages and Snacks, with a softer Staples peak.",
      ownerId: "u_rina",
      status: "in_review",
      createdAt: iso(now - 4 * DAY_MS),
      modifiedAt: iso(now - 22 * HOUR_MS),
      simulate: true,
      assumptions: [
        { id: "a1", driver: "seasonality", scope: "Beverages", baselineValue: 0, value: 12, unit: "%", rationale: "Beverages grew 11–14% in the last two year-end periods." },
        { id: "a2", driver: "promotion", scope: "Snacks", baselineValue: 0, value: 8, unit: "%", rationale: "Gift-pack promotion agreed with two snack suppliers." },
        { id: "a3", driver: "seasonality", scope: "Staples", baselineValue: 0, value: -3, unit: "%", rationale: "Staples peak earlier in the month than last year." },
      ],
    }),
    mk({
      id: "scn_oil_price",
      name: "Cooking oil price increase",
      description: "Supplier price increase passed through to shelf price.",
      ownerId: "u_yoga",
      status: "simulated",
      createdAt: iso(now - 2 * DAY_MS),
      modifiedAt: iso(now - 5 * HOUR_MS),
      simulate: true,
      assumptions: [
        { id: "a1", driver: "price", scope: "Staples", baselineValue: 0, value: 8, unit: "%", rationale: "Supplier notice: +8% list price from next month." },
      ],
    }),
    mk({
      id: "scn_wj_supply",
      name: "West Java supply disruption",
      description: "Distribution centre maintenance reduces availability in West Java.",
      ownerId: "u_arif",
      status: "draft",
      createdAt: iso(now - 7 * HOUR_MS),
      modifiedAt: iso(now - 40 * MINUTE_MS),
      simulate: false,
      assumptions: [
        { id: "a1", driver: "availability", scope: `${REGION_SCOPE_PREFIX}West Java`, baselineValue: 97, value: 90, unit: "pp", rationale: "DC maintenance window of 10 days." },
      ],
    }),
    mk({
      id: "scn_frozen_heat",
      name: "Hot dry season · Frozen",
      description: "Above-average temperatures lift ice cream and frozen desserts.",
      ownerId: "u_dewi",
      status: "approved",
      createdAt: iso(now - 12 * DAY_MS),
      modifiedAt: iso(now - 10 * DAY_MS),
      simulate: true,
      assumptions: [
        { id: "a1", driver: "external", scope: "Frozen", baselineValue: 0, value: 15, unit: "%", rationale: "Weather service outlook: 1.5 °C above average." },
        { id: "a2", driver: "demand_change", scope: "Beverages", baselineValue: 0, value: 4, unit: "%", rationale: "Correlated uplift in cold beverages." },
      ],
    }),
    mk({
      id: "scn_new_range",
      name: "Private-label range launch",
      description: "Mesta Select launch cannibalises branded Household SKUs.",
      ownerId: "u_rina",
      status: "archived",
      createdAt: iso(now - 30 * DAY_MS),
      modifiedAt: iso(now - 21 * DAY_MS),
      simulate: true,
      assumptions: [
        { id: "a1", driver: "lifecycle", scope: "Household", baselineValue: 0, value: -6, unit: "%", rationale: "Cannibalisation observed in the pilot stores." },
      ],
    }),
  ];
}

