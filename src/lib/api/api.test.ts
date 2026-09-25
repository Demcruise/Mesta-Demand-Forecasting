import { beforeEach, describe, expect, it } from "vitest";
import { resetDbs } from "@/lib/mock/db";
import { PermissionError } from "@/lib/permissions";
import { applyList, ApiError, saveDemoControls, type ApiContext } from "./client";
import { applyOverride, createRun, defaultRunInput, getRunResult, listForecastRows, validateRun } from "./forecasting";
import { decideApproval, listApprovals, updateExceptions } from "./planning";
import { listAudit } from "./governance";

const planner: ApiContext = { workspaceId: "ws_conv_pilot", userId: "u_dewi", role: "planner" };
const manager: ApiContext = { workspaceId: "ws_conv_pilot", userId: "u_dimas", role: "manager" };
const viewer: ApiContext = { workspaceId: "ws_conv_pilot", userId: "u_maya", role: "viewer" };

beforeEach(() => {
  resetDbs();
  saveDemoControls({ latency: "fast", failReads: false, failWrites: false });
});

describe("list helper", () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `Item ${i}`, group: i % 2 ? "odd" : "even" }));
  it("searches, filters, sorts and pages", () => {
    const page = applyList(items, { q: "item 1", filters: { group: ["odd"] }, sort: "id", dir: "desc", page: 1, pageSize: 3 }, {
      search: (x) => x.name,
      filters: { group: (x, v) => v.includes(x.group) },
      sorters: { id: (x) => x.id },
    });
    expect(page.total).toBe(6); // 1, 11, 13, 15, 17, 19
    expect(page.items.map((x) => x.id)).toEqual([19, 17, 15]);
  });
  it("clamps out-of-range pages", () => {
    expect(applyList(items, { page: 99, pageSize: 10 }, {}).page).toBe(3);
  });
});

describe("forecasting API (mock backend)", () => {
  it("returns deterministic results with an interval around the forecast", async () => {
    const a = await getRunResult(planner, null);
    resetDbs();
    const b = await getRunResult(planner, null);
    expect(a.summary.forecastValue).toBe(b.summary.forecastValue);
    expect(a.summary.lowerBound).toBeLessThan(a.summary.forecastValue);
    expect(a.summary.upperBound).toBeGreaterThan(a.summary.forecastValue);
  });

  it("blocks runs without a name and records created runs in the audit log", async () => {
    const input = defaultRunInput(planner);
    const checks = await validateRun(planner, input);
    expect(checks.find((c) => c.key === "fields")?.result).toBe("blocking");
    await expect(createRun(planner, input)).rejects.toBeInstanceOf(ApiError);
    const run = await createRun(planner, { ...input, name: "Test run" });
    expect(run.status).toBe("queued");
    const audit = await listAudit(manager, { q: run.id });
    expect(audit.items.some((e) => e.action === "create_forecast_run" && e.entityId === run.id)).toBe(true);
  });

  it("enforces permissions server-side", async () => {
    await expect(createRun(viewer, { ...defaultRunInput(viewer), name: "x" })).rejects.toBeInstanceOf(PermissionError);
  });

  it("routes large overrides to approval and applies them once approved", async () => {
    const { run, page } = await listForecastRows(planner, null, { pageSize: 1 });
    const row = page.items[0];
    expect(row).toBeDefined();
    const override = await applyOverride(planner, { runId: run.id, productIds: [row!.productId], newUnits: Math.round(row!.forecast * 1.3), reason: "known_event", evidence: "", comment: "Store opening event next week" });
    expect(override.status).toBe("pending_approval");
    expect(override.approvalId).toBeTruthy();

    await expect(decideApproval(planner, override.approvalId!, "approved", "")).rejects.toBeInstanceOf(PermissionError);
    const decided = await decideApproval(manager, override.approvalId!, "approved", "");
    expect(decided.status).toBe("approved");
    const after = await listForecastRows(planner, null, { q: row!.product.sku });
    expect(after.page.items[0]?.overrideUnits).toBe(override.newUnits);
  });

  it("prevents self-approval", async () => {
    const { page } = await listApprovals(manager, { filters: { status: ["pending"] } });
    const own = page.items.find((a) => a.requestedBy === manager.userId);
    if (own) await expect(decideApproval(manager, own.id, "approved", "")).rejects.toBeInstanceOf(ApiError);
  });

  it("requires a note to resolve exceptions", async () => {
    await expect(updateExceptions(planner, ["EX-1001"], { status: "resolved" })).rejects.toBeInstanceOf(ApiError);
  });
});
