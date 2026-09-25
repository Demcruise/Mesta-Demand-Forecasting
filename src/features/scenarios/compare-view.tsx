"use client";

import { GitCompareArrows } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { Scenario } from "@/types/domain";
import { compareScenarios, listScenarios } from "@/lib/api/planning";
import { useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { assumptionEffect, DRIVER_LABELS } from "@/lib/mock/scenarios";
import { formatDate, formatDateTime, formatDeltaNumber, formatDeltaPercent, formatNumber } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { buttonVariants } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { ChartDataTable, ChartFrame, LegendItem } from "@/components/charts/chart-frame";
import { ScenarioChart, SCENARIO_COLORS } from "@/components/charts/scenario-chart";
import { EmptyState, ErrorState, InlineAlert, PageSkeleton } from "@/components/feedback/states";
import { StatusBadge } from "@/components/feedback/status";
import { ExportMenu } from "@/components/tables/export-menu";
import { downloadExport, type ExportFormat } from "@/lib/export";

/**
 * PAGE-SCENARIO-COMPARISON: what changes between the baseline and each scenario?
 * Shared scope and timeframe, labelled assumptions, uncertainty and a data timestamp.
 */
export function CompareView() {
  const { can } = useSession();
  const state = useListState({ filterKeys: [] });
  const ids = (state.getParam("ids") ?? "").split(",").filter(Boolean);
  const all = useApiQuery(["scenarios", "all-simulated"], (c) => listScenarios(c, { pageSize: 100 }));
  const q = useApiQuery(["scenario-compare", ids], (c) => compareScenarios(c, ids), { enabled: ids.length > 0, keepPrevious: true });
  const options = (all.data?.items ?? []).filter((s) => !!s.result).map((s) => ({ value: s.id, label: s.name, hint: s.status.replace("_", " ") }));
  const scenarios = q.data?.scenarios ?? [];

  const picker = (
    <div className="w-[min(28rem,90vw)]">
      <MultiSelect value={ids} onChange={(v) => state.setParams({ ids: v.length ? v.slice(0, 4).join(",") : null })} allLabel="Pilih maksimal 4 skenario" options={options} placeholder="Cari skenario tersimulasi" />
    </div>
  );

  if (ids.length === 0) {
    return (
      <PageContainer>
        <PageHeader title="Bandingkan Skenario" description="Bandingkan skenario tersimulasi terhadap acuan yang sama." actions={picker} />
        <Panel>
          <EmptyState icon={GitCompareArrows} title="Pilih skenario untuk dibandingkan." description="Hanya skenario yang sudah disimulasikan yang dapat dibandingkan. Pilih maksimal empat lewat pemilih di atas." action={<Link href="/scenarios" className={buttonVariants({ variant: "secondary" })}>Buka Skenario</Link>} />
        </Panel>
      </PageContainer>
    );
  }
  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title="Bandingkan Skenario" actions={picker} />
        <Panel><ErrorState what="Perbandingan tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} /></Panel>
      </PageContainer>
    );
  }
  const first = scenarios[0];
  const base = first?.result;
  if (!first || !base) {
    return (
      <PageContainer>
        <PageHeader title="Bandingkan Skenario" actions={picker} />
        <Panel><EmptyState title="Tidak ada skenario terpilih yang punya hasil simulasi." description="Jalankan simulasi pada tiap skenario lebih dulu." /></Panel>
      </PageContainer>
    );
  }

  const chartRows = base.points.map((p, i) => ({
    date: p.date,
    baseline: p.baseline,
    ...Object.fromEntries(scenarios.map((s) => [s.id, s.result?.points[i]?.scenario ?? 0])),
  }));
  const metricRows: { metric: string; baseline: number; values: number[] }[] = [
    { metric: "Total permintaan", baseline: base.baselineUnits, values: scenarios.map((s) => s.result?.scenarioUnits ?? 0) },
    ...base.byCategory.map((c) => ({ metric: c.category, baseline: c.baseline, values: scenarios.map((s) => s.result?.byCategory.find((x) => x.category === c.category)?.scenario ?? 0) })),
  ];

  const exportFile = (format: ExportFormat) => {
    track("export_requested", { surface: "scenario_compare", format });
    downloadExport(
      format,
      `scenario-comparison-${formatDate(new Date()).replace(/ /g, "-")}`,
      ["Ukuran", "Acuan", ...scenarios.flatMap((s) => [s.name, `${s.name} selisih`, `${s.name} selisih %`])],
      metricRows.map((r) => [r.metric, r.baseline, ...r.values.flatMap((v) => [v, v - r.baseline, r.baseline ? Number((((v - r.baseline) / r.baseline) * 100).toFixed(1)) : null])]),
      "Bandingkan Skenario",
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Bandingkan Skenario"
        description={`Baseline ${q.data.baseline?.id ?? first.baselineRunId} · ${q.data.baseline ? `${q.data.baseline.horizonDays}-day horizon from ${formatDate(base.points[0]?.date)}` : ""} · all categories, all regions`}
        actions={
          <>
            {picker}
            {can("export") && <ExportMenu label="Ekspor perbandingan" note="Total per kategori untuk skenario terpilih." onExport={exportFile} />}
          </>
        }
      />
      {!q.data.sameBaseline && (
        <InlineAlert tone="warning" title="Skenario ini memakai acuan yang berbeda.">
          Deltas are shown against each scenario's own baseline. For a like-for-like comparison, rebuild them on the same published run.
        </InlineAlert>
      )}
      <ChartFrame
        title="Permintaan harian: acuan vs skenario"
        question="Bagaimana tiap skenario mengubah permintaan selama periode perkiraan?"
        unit="units per day"
        timeframe={`${formatDate(base.points[0]?.date)} – ${formatDate(base.points[base.points.length - 1]?.date)}`}
        source={`Baseline ${first.baselineRunId}`}
        asOf={base.simulatedAt}
        legend={
          <>
            <LegendItem color="var(--chart-forecast)" label="Acuan" />
            {scenarios.map((s, i) => (
              <LegendItem key={s.id} color={SCENARIO_COLORS[i % SCENARIO_COLORS.length] as string} label={s.name} variant={i === 0 ? "line" : "dashed"} />
            ))}
          </>
        }
        chart={<ScenarioChart rows={chartRows} scenarios={scenarios.map((s) => ({ key: s.id, label: s.name }))} />}
        table={
          <ChartDataTable
            caption="Permintaan harian per skenario"
            columns={[{ key: "date", label: "Tanggal" }, { key: "baseline", label: "Acuan", numeric: true }, ...scenarios.map((s) => ({ key: s.id, label: s.name, numeric: true }))]}
            rows={chartRows.map((r) => ({ ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? formatNumber(v) : v])), date: formatDate(r.date) }))}
          />
        }
      />
      <PageSection title="Perbandingan" description="Total selama periode perkiraan. Selisih dihitung terhadap acuan.">
        <Panel flush>
          <div className="p-4">
            <ChartDataTable
              caption="Perbandingan skenario"
              maxHeight="none"
              columns={[
                { key: "metric", label: "Ukuran" },
                { key: "baseline", label: "Acuan", numeric: true },
                ...scenarios.flatMap((s) => [
                  { key: `${s.id}:v`, label: s.name, numeric: true },
                  { key: `${s.id}:d`, label: "Selisih", numeric: true },
                  { key: `${s.id}:p`, label: "Selisih %", numeric: true },
                ]),
              ]}
              rows={metricRows.map((r) => ({
                metric: r.metric,
                baseline: formatNumber(r.baseline),
                ...Object.fromEntries(
                  scenarios.flatMap((s, i) => {
                    const v = r.values[i] ?? 0;
                    return [
                      [`${s.id}:v`, formatNumber(v)],
                      [`${s.id}:d`, formatDeltaNumber(v - r.baseline)],
                      [`${s.id}:p`, formatDeltaPercent(r.baseline ? (v - r.baseline) / r.baseline : 0)],
                    ];
                  }),
                ),
              }))}
            />
          </div>
        </Panel>
      </PageSection>
      <PageSection title="Asumsi dan rentang">
        <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 2xl:grid-cols-4">
          {scenarios.map((s, i) => (
            <ScenarioCard key={s.id} scenario={s} color={SCENARIO_COLORS[i % SCENARIO_COLORS.length] as string} />
          ))}
        </div>
      </PageSection>
    </PageContainer>
  );
}

function ScenarioCard({ scenario: s, color }: { scenario: Scenario; color: string }) {
  const r = s.result;
  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full" style={{ background: color }} aria-hidden />
          <Link href={`/scenarios/${s.id}`} className="hover:text-primary hover:underline">
            {s.name}
          </Link>
        </span>
      }
      actions={<StatusBadge status={s.status} size="sm" />}
      footer={r ? <span className="caption">Simulated {formatDateTime(r.simulatedAt)}</span> : undefined}
    >
      {r && (
        <p className="body-sm">
          <span className="font-semibold">{formatDeltaPercent(r.deltaPercent)}</span> <span className="text-fg-secondary">({formatDeltaNumber(r.deltaUnits)} units). Range {formatNumber(r.lowerBound)} – {formatNumber(r.upperBound)}.</span>
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-2">
        {s.assumptions.map((a) => (
          <li key={a.id} className="body-sm">
            <span className="font-semibold">{DRIVER_LABELS[a.driver]}</span> · {a.scope}: {a.baselineValue}→{a.value}
            {a.unit === "pp" ? "%" : a.unit} <span className="text-fg-tertiary">(demand {formatDeltaPercent(assumptionEffect(a))})</span>
            <span className="block caption">{a.rationale}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
