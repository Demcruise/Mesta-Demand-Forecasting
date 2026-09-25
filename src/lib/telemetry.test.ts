import { beforeEach, describe, expect, it } from "vitest";
import { flushTelemetry, recentTelemetry, setTelemetryTransport, track, type TelemetryRecord } from "./telemetry";

beforeEach(async () => {
  // Drain anything queued by an earlier test, then detach the transport.
  setTelemetryTransport(() => {});
  await flushTelemetry();
  setTelemetryTransport(null);
});

describe("telemetry", () => {
  it("records events and redacts free-text properties", () => {
    track("override_applied", { pendingApproval: true, skus: 3, reason: "store opening", comment: "free text", email: "a@b.co" });
    const record = recentTelemetry().at(-1);
    expect(record?.event).toBe("override_applied");
    expect(record?.props).toEqual({ pendingApproval: true, skus: 3 });
  });

  it("truncates long string values", () => {
    track("page_view", { path: "/".padEnd(200, "x") });
    const record = recentTelemetry().at(-1);
    expect(typeof record?.props.path).toBe("string");
    expect((record?.props.path as string).length).toBeLessThanOrEqual(64);
  });

  it("delivers queued events in one batch, then nothing more", async () => {
    const delivered: TelemetryRecord[] = [];
    setTelemetryTransport((records) => {
      delivered.push(...records);
    });
    track("page_view", { path: "/overview" });
    track("export_requested", { surface: "explorer", format: "csv" });
    await flushTelemetry();
    expect(delivered.map((r) => r.event)).toEqual(["page_view", "export_requested"]);
    await flushTelemetry();
    expect(delivered).toHaveLength(2);
  });

  it("swallows transport failures so telemetry never breaks the product", async () => {
    setTelemetryTransport(() => {
      throw new Error("collector unavailable");
    });
    track("sign_in", {});
    await expect(flushTelemetry()).resolves.toBeUndefined();
  });

  it("caps the local buffer", () => {
    for (let i = 0; i < 250; i++) track("page_view", { path: `/p/${i}` });
    expect(recentTelemetry().length).toBe(200);
  });
});
