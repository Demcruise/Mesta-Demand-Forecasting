import { describe, expect, it } from "vitest";
import { getColumnAlignment } from "./column-alignment";

describe("getColumnAlignment (TABLE-ALIGN-001)", () => {
  it("defaults text columns to the left axis", () => {
    expect(getColumnAlignment(undefined)).toBe("left");
    expect(getColumnAlignment({})).toBe("left");
  });

  it("right-aligns numeric columns unless told otherwise", () => {
    expect(getColumnAlignment({ numeric: true })).toBe("right");
  });

  it("lets an explicit align win over numeric (e.g. SKUs affected, Actual prior)", () => {
    expect(getColumnAlignment({ numeric: true, align: "left" })).toBe("left");
    expect(getColumnAlignment({ align: "center" })).toBe("center");
  });
});
