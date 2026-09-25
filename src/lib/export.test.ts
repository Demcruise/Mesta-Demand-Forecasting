import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { toCsv, toXlsx } from "./export";

describe("exports", () => {
  it("quotes CSV values and neutralises formulas", () => {
    const csv = toCsv(["Name", "Value"], [["=HYPERLINK(1)", 5], ['He said "hi", ok', -3], ["-12", null]]);
    expect(csv.split("\n")).toEqual(["Name,Value", "'=HYPERLINK(1),5", '"He said ""hi"", ok",-3', "-12,"]);
  });

  it("writes a valid workbook with numeric cells and escaped text", () => {
    const files = unzipSync(toXlsx(["SKU", "Units"], [["A&B <1>", 12440], ["@cmd", null]], "Forecast/Run"));
    expect(Object.keys(files)).toContain("xl/worksheets/sheet1.xml");
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"] as Uint8Array);
    expect(sheet).toContain("<v>12440</v>");
    expect(sheet).toContain("A&amp;B &lt;1&gt;");
    expect(sheet).toContain("'@cmd");
    const wb = strFromU8(files["xl/workbook.xml"] as Uint8Array);
    expect(wb).toContain('name="Forecast Run"');
  });
});
