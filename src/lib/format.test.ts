import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatDeltaNumber, formatDeltaPercent, formatDuration, formatNumber, formatPercent, formatRelative, formatShortDate, pluralize } from "./format";

describe("format (Indonesian conventions)", () => {
  it("groups integers with a dot and handles missing values", () => {
    expect(formatNumber(12440)).toBe("12.440");
    expect(formatNumber(2480)).toBe("2.480");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(Number.NaN)).toBe("—");
  });

  it("formats percentages with a comma", () => {
    expect(formatPercent(0.045)).toBe("4,5%");
    expect(formatPercent(0.8, 0)).toBe("80%");
  });

  it("signs deltas with a true minus sign and no signed zero", () => {
    expect(formatDeltaPercent(0.045)).toBe("+4,5%");
    expect(formatDeltaPercent(-0.032)).toBe("−3,2%");
    expect(formatDeltaPercent(-0.0001)).toBe("0,0%");
    expect(formatDeltaNumber(-1204)).toBe("−1.204");
    expect(formatDeltaNumber(0.2)).toBe("0");
  });

  it("uses fixed three-letter Indonesian months", () => {
    expect(formatDate("2026-09-25T10:00:00")).toBe("25 Sep 2026");
    expect(formatShortDate("2026-06-01T10:00:00")).toBe("1 Jun");
    expect(formatDate("2026-05-02T10:00:00")).toBe("2 Mei 2026");
    expect(formatDate("2026-08-17T10:00:00")).toBe("17 Agu 2026");
  });

  it("formats date-times on a 24-hour clock", () => {
    expect(formatDateTime("2026-09-25T14:05:00")).toBe("25 Sep 2026, 14:05");
  });

  it("formats relative times in Indonesian", () => {
    const now = new Date("2026-09-25T10:00:00").getTime();
    expect(formatRelative(new Date("2026-09-25T09:55:00"), now)).toContain("menit");
    expect(formatRelative(new Date("2026-09-22T10:00:00"), now)).toContain("hari");
    expect(formatRelative(new Date("2026-09-24T10:00:00"), now)).toBe("kemarin");
  });

  it("formats durations", () => {
    expect(formatDuration(14_000)).toBe("14 dtk");
    expect(formatDuration(125_000)).toBe("2 mnt 5 dtk");
    expect(formatDuration(3_900_000)).toBe("1 j 5 mnt");
  });

  it("counts without plural inflection", () => {
    expect(pluralize(1, "SKU")).toBe("1 SKU");
    expect(pluralize(2480, "SKU")).toBe("2.480 SKU");
    expect(pluralize(12, "produk")).toBe("12 produk");
  });
});
