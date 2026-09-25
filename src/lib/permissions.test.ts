import { describe, expect, it } from "vitest";
import { can, rolesWith } from "./permissions";

describe("permissions", () => {
  it("keeps approvals with managers only (segregation of duties)", () => {
    expect(rolesWith("approval.decide")).toEqual(["manager"]);
    expect(can("admin", "approval.decide")).toBe(false);
    expect(can("admin", "forecast.override")).toBe(false);
  });

  it("gives viewers read-only access", () => {
    expect(can("viewer", "forecast.run.create")).toBe(false);
    expect(can("viewer", "plan.edit")).toBe(false);
    expect(can("viewer", "export")).toBe(true);
  });

  it("restricts platform administration to administrators", () => {
    expect(rolesWith("users.manage")).toEqual(["admin"]);
    expect(rolesWith("integration.manage")).toEqual(["admin"]);
    expect(rolesWith("settings.workspace")).toEqual(["admin"]);
  });

  it("denies everything without a role", () => {
    expect(can(null, "export")).toBe(false);
  });
});
