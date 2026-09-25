import { beforeEach, describe, expect, it } from "vitest";
import { resetDbs } from "@/lib/mock/db";
import { ApiError, saveDemoControls, type ApiContext } from "./client";
import { getForecastInsights } from "./analytics";
import { createRun, defaultRunInput } from "./forecasting";

const planner: ApiContext = { workspaceId: "ws_conv_pilot", userId: "u_dewi", role: "planner" };

beforeEach(() => {
  resetDbs();
  saveDemoControls({ latency: "fast", failReads: false, failWrites: false });
});

describe("forecast insights (INT-008)", () => {
  it("reconciles segments and the summary with the run's rows", async () => {
    const insights = await getForecastInsights(planner, null);
    const segmentTotal = insights.changeByCategory.reduce((s, c) => s + c.forecast, 0);
    expect(segmentTotal).toBe(insights.summary.forecast);
    expect(insights.changeByCategory.reduce((s, c) => s + c.skuCount, 0)).toBe(insights.summary.skuCount);
    expect(insights.changeByLifecycle.reduce((s, c) => s + c.forecast, 0)).toBe(insights.summary.forecast);
    expect(insights.summary.lower).toBeLessThan(insights.summary.forecast);
    expect(insights.summary.upper).toBeGreaterThan(insights.summary.forecast);
  });

  it("ranks movers by absolute change and caps the list", async () => {
    const { movers } = await getForecastInsights(planner, null);
    expect(movers.length).toBeLessThanOrEqual(120);
    for (let i = 1; i < movers.length; i++) {
      expect(Math.abs(movers[i - 1]!.delta)).toBeGreaterThanOrEqual(Math.abs(movers[i]!.delta));
    }
    expect(movers.every((m) => m.intervalPercent >= 0 && m.deltaPercent !== undefined)).toBe(true);
  });

  it("reports a concentration between 0 and 1 that grows with the sample", async () => {
    const { concentration } = await getForecastInsights(planner, null);
    expect(concentration.totalAbsChange).toBeGreaterThan(0);
    expect(concentration.top10Share).toBeGreaterThan(0);
    expect(concentration.top10Share).toBeLessThanOrEqual(1);
    expect(concentration.top50Share).toBeGreaterThanOrEqual(concentration.top10Share);
  });

  it("ranks uncertainty from widest to narrowest", async () => {
    const { uncertainty } = await getForecastInsights(planner, null);
    for (let i = 1; i < uncertainty.length; i++) {
      expect(uncertainty[i - 1]!.intervalPercent).toBeGreaterThanOrEqual(uncertainty[i]!.intervalPercent);
    }
  });

  it("rejects unknown runs and runs without results", async () => {
    await expect(getForecastInsights(planner, "run_missing")).rejects.toBeInstanceOf(ApiError);
    const queued = await createRun(planner, { ...defaultRunInput(planner), name: "Insights pending run" });
    await expect(getForecastInsights(planner, queued.id)).rejects.toBeInstanceOf(ApiError);
  });
});
