"use client";

import type { ScenarioResult } from "@/types/domain";
import { formatDeltaNumber, formatDeltaPercent, formatNumber } from "@/lib/format";
import { SignedPercent } from "@/components/forecasting/metrics";
import { ChartDataTable } from "@/components/charts/chart-frame";
import { PairedBars } from "@/components/charts/small-charts";
import { LegendItem } from "@/components/charts/chart-frame";
import { DescriptionList } from "@/components/page/page";
import { pick } from "@/lib/i18n";

/** Baseline vs scenario totals and category impact. */
export function ImpactPreview({ result, compact }: { result: ScenarioResult; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <DescriptionList
        columns={compact ? 2 : 3}
        items={[
          { label: pick("Permintaan acuan", "Baseline demand"), value: <span className="numeric-md">{formatNumber(result.baselineUnits)}</span> },
          { label: pick("Permintaan skenario", "Scenario demand"), value: <span className="numeric-md">{formatNumber(result.scenarioUnits)}</span> },
          { label: pick("Perubahan", "Change"), value: <SignedPercent percent={result.deltaPercent} className="numeric-md" />, hint: pick(`${formatDeltaNumber(result.deltaUnits)} unit`, `${formatDeltaNumber(result.deltaUnits)} units`) },
          { label: pick("Rentang skenario (80%)", "Scenario range (80%)"), value: <span className="tabular">{formatNumber(result.lowerBound)} – {formatNumber(result.upperBound)}</span>, hint: pick("Perkiraan; menskalakan rentang acuan", "Approximate; scales the baseline interval") },
        ]}
      />
      {compact ? (
        <ChartDataTable
          caption={pick("Dampak per kategori", "Impact by category")}
          maxHeight="16rem"
          columns={[
            { key: "c", label: pick("Kategori", "Category") },
            { key: "b", label: pick("Acuan", "Baseline"), numeric: true },
            { key: "s", label: pick("Skenario", "Scenario"), numeric: true },
            { key: "d", label: pick("Perubahan", "Change"), numeric: true },
          ]}
          rows={result.byCategory.map((c) => ({ c: c.category, b: formatNumber(c.baseline), s: formatNumber(c.scenario), d: <SignedPercent percent={c.baseline ? (c.scenario - c.baseline) / c.baseline : 0} /> }))}
        />
      ) : (
        <div>
          <div className="mb-2 flex gap-4">
            <LegendItem color="var(--chart-forecast)" label={pick("Acuan", "Baseline")} variant="bar" />
            <LegendItem color="var(--chart-scenario)" label={pick("Skenario", "Scenario")} variant="bar" />
          </div>
          <PairedBars rows={result.byCategory.map((c) => ({ label: c.category, a: c.baseline, b: c.scenario }))} aLabel={pick("Acuan", "Baseline")} bLabel={pick("Skenario", "Scenario")} aColor="var(--chart-forecast)" bColor="var(--chart-scenario)" />
        </div>
      )}
    </div>
  );
}
