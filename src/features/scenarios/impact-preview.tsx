"use client";

import type { ScenarioResult } from "@/types/domain";
import { formatDeltaNumber, formatDeltaPercent, formatNumber } from "@/lib/format";
import { ChartDataTable } from "@/components/charts/chart-frame";
import { PairedBars } from "@/components/charts/small-charts";
import { LegendItem } from "@/components/charts/chart-frame";
import { DescriptionList } from "@/components/page/page";

/** Baseline vs scenario totals and category impact. */
export function ImpactPreview({ result, compact }: { result: ScenarioResult; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <DescriptionList
        columns={compact ? 2 : 3}
        items={[
          { label: "Permintaan acuan", value: <span className="numeric-md">{formatNumber(result.baselineUnits)}</span> },
          { label: "Permintaan skenario", value: <span className="numeric-md">{formatNumber(result.scenarioUnits)}</span> },
          { label: "Perubahan", value: <span className="numeric-md">{formatDeltaPercent(result.deltaPercent)}</span>, hint: `${formatDeltaNumber(result.deltaUnits)} unit` },
          { label: "Rentang skenario (80%)", value: <span className="tabular">{formatNumber(result.lowerBound)} – {formatNumber(result.upperBound)}</span>, hint: "Perkiraan; menskalakan rentang acuan" },
        ]}
      />
      {compact ? (
        <ChartDataTable
          caption="Dampak per kategori"
          maxHeight="16rem"
          columns={[
            { key: "c", label: "Kategori" },
            { key: "b", label: "Acuan", numeric: true },
            { key: "s", label: "Skenario", numeric: true },
            { key: "d", label: "Perubahan", numeric: true },
          ]}
          rows={result.byCategory.map((c) => ({ c: c.category, b: formatNumber(c.baseline), s: formatNumber(c.scenario), d: formatDeltaPercent(c.baseline ? (c.scenario - c.baseline) / c.baseline : 0) }))}
        />
      ) : (
        <div>
          <div className="mb-2 flex gap-4">
            <LegendItem color="var(--chart-forecast)" label="Acuan" variant="bar" />
            <LegendItem color="var(--chart-scenario)" label="Skenario" variant="bar" />
          </div>
          <PairedBars rows={result.byCategory.map((c) => ({ label: c.category, a: c.baseline, b: c.scenario }))} aLabel="Acuan" bLabel="Skenario" aColor="var(--chart-forecast)" bColor="var(--chart-scenario)" />
        </div>
      )}
    </div>
  );
}
