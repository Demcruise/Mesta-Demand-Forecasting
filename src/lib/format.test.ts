import { describe, expect, it } from "vitest";
import { formatDate, formatDeltaNumber, formatDeltaPercent, formatDuration, formatNumber, formatPercent, formatShortDate, pluralize } from "./format";

describe("format", () => {
  it("groups integers and handles missing values", () => {
    expect(formatNumber(12440)).toBe("12,440");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
  });

  it("formats percentages with one decimal", () => {
    expect(formatPercent(0.045)).toBe("4.5%");
    expect(formatPercent(0.8, 0)).toBe("80%");
  });

  it("signs deltas with a true minus sign and no signed zero", () => {
    expect(formatDeltaPercent(0.045)).toBe("+4.5%");
    expect(formatDeltaPercent(-0.032)).toBe("−3.2%");
    expect(formatDeltaPercent(-0.0001)).toBe("0.0%");
    expect(formatDeltaNumber(-1204)).toBe("−1,204");
    expect(formatDeltaNumber(0.2)).toBe("0");
  });

  it("uses fixed three-letter months regardless of locale data", () => {
    expect(formatDate("2026-09-25T10:00:00")).toBe("25 Sep 2026");
    expect(formatShortDate("2026-06-01T10:00:00")).toBe("1 Jun");
  });

  it("formats durations", () => {
    expect(formatDuration(14_000)).toBe("14s");
    expect(formatDuration(125_000)).toBe("2m 5s");
    expect(formatDuration(3_900_000)).toBe("1h 5m");
  });

  it("pluralises", () => {
    expect(pluralize(1, "SKU")).toBe("1 SKU");
    expect(pluralize(2480, "SKU")).toBe("2,480 SKUs");
  });
});
