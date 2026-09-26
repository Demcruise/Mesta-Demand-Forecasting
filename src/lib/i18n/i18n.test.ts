import { afterEach, describe, expect, it } from "vitest";
import { en } from "./en";
import { id } from "./id";
import { localized, localizedRecord, pick, setActiveLocale } from "./core";

/** Every leaf path in a translation tree, e.g. "nav.overview". Functions count as leaves. */
function paths(tree: unknown, prefix = ""): string[] {
  if (tree === null || typeof tree !== "object") return [prefix];
  return Object.keys(tree as Record<string, unknown>)
    .sort()
    .flatMap((k) => paths((tree as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k));
}

describe("dictionaries (I18N §168)", () => {
  it("English and Indonesian have identical key structures", () => {
    expect(paths(id)).toEqual(paths(en));
  });

  it("no Indonesian entry is left empty", () => {
    const empty = paths(id).filter((p) => {
      const v = p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], id);
      return typeof v === "string" && v.trim() === "";
    });
    expect(empty).toEqual([]);
  });
});

describe("locale-live helpers", () => {
  afterEach(() => setActiveLocale("en"));

  it("pick() follows the active locale at call time", () => {
    setActiveLocale("id");
    expect(pick("Ringkasan", "Overview")).toBe("Ringkasan");
    setActiveLocale("en");
    expect(pick("Ringkasan", "Overview")).toBe("Overview");
  });

  it("localized() arrays and localizedRecord() maps switch without re-import", () => {
    const rows = localized([{ label: "Terbuka" }], [{ label: "Open" }]);
    const labels = localizedRecord({ a: "Kritis" }, { a: "Critical" });
    setActiveLocale("id");
    expect(rows.map((r) => r.label)).toEqual(["Terbuka"]);
    expect(labels.a).toBe("Kritis");
    setActiveLocale("en");
    expect(rows.map((r) => r.label)).toEqual(["Open"]);
    expect(labels.a).toBe("Critical");
  });
});
