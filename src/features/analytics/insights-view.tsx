"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ChartSpline } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Product } from "@/types/domain";
import { getForecastInsights, type InsightMover, type InsightSegment } from "@/lib/api/analytics";
import { listRuns } from "@/lib/api/forecasting";
import { useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { formatCompact, formatDate, formatDateTime, formatDeltaNumber, formatDeltaPercent, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { track } from "@/lib/telemetry";
import { PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { deltaToneClass, ForecastDelta, MetricCard, MetricStrip, SignedPercent } from "@/components/forecasting/metrics";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { ChartDataTable, ChartFrame, LegendItem } from "@/components/charts/chart-frame";
import { ProductIdentity, scopeLabel } from "@/components/entities/identity";
import { StatusBadge, Tag } from "@/components/feedback/status";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { Select } from "@/components/ui/select";
import { METRIC_DEFINITIONS } from "@/features/models/metric-definitions";

const LIFECYCLE_LABELS: Record<Product["lifecycle"], string> = {
  new: "Produk baru",
  core: "Rangkaian inti",
  seasonal: "Musiman",
  "end-of-life": "Akhir masa",
};

const chartTooltip = { background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 6, fontSize: 12 } as const;

/**
 * INT-008 · Forecast insights. Decision-oriented analysis of a single completed run:
 * why the outlook moved, where it is least certain, which items moved most, and where
 * the model is weakest. Every figure is derived from the run's own rows and the model's
 * latest backtest — no invented KPIs (backlog §18, §86).
 */
export function ForecastInsightsView() {
  const router = useRouter();
  const state = useListState({ filterKeys: [] });
  const runParam = state.getParam("run");

  const runs = useApiQuery(["runs", "with-results"], (c) => listRuns(c, { pageSize: 50, filters: { status: ["published", "completed"] } }));
  const q = useApiQuery(["insights", runParam], (c) => getForecastInsights(c, runParam));

  const moverColumns = React.useMemo<ColumnDef<InsightMover, unknown>[]>(
    () => [
      {
        id: "product",
        header: "Produk",
        meta: { width: "minmax(240px, 2.2fr)", pinned: true, label: "Produk" } satisfies ColumnMeta,
        cell: ({ row }) => {
          const m = row.original;
          return <ProductIdentity product={{ id: m.productId, name: m.name, sku: m.sku, category: m.category }} />;
        },
      },
      { id: "category", header: "Kategori", meta: { width: "140px", hideBelow: "lg", label: "Kategori" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-fg-secondary">{row.original.category}</span> },
      { id: "lifecycle", header: "Siklus produk", meta: { width: "130px", hideBelow: "xl", label: "Siklus produk" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{LIFECYCLE_LABELS[row.original.lifecycle]}</span> },
      {
        id: "forecast",
        header: "Perkiraan",
        meta: { width: "110px", numeric: true, description: "Total perkiraan selama periode perkiraan." } satisfies ColumnMeta,
        cell: ({ row }) => <span className="font-semibold">{formatNumber(row.original.forecast)}</span>,
      },
      { id: "previous", header: "Sebelumnya", meta: { width: "110px", numeric: true, hideBelow: "md", description: "Perkiraan dari proses terbit sebelumnya." } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{formatNumber(row.original.previousForecast)}</span> },
      {
        id: "change",
        header: "Perubahan",
        meta: { width: "100px", numeric: true, description: "Perubahan dibanding proses sebelumnya. Ditandai bila melewati batas tinjauan 15%." } satisfies ColumnMeta,
        cell: ({ row }) => <ForecastDelta percent={row.original.deltaPercent} size="sm" />,
      },
      {
        id: "interval",
        header: "Rentang",
        meta: { width: "110px", numeric: true, description: "Lebar rentang perkiraan 80% sebagai bagian dari perkiraan. Semakin lebar semakin tidak pasti." } satisfies ColumnMeta,
        cell: ({ row }) => <span className="tabular text-fg-secondary">{formatPercent(row.original.intervalPercent)}</span>,
      },
      {
        id: "exceptions",
        header: "Perlu Ditinjau",
        meta: { width: "110px", label: "Perlu ditinjau", description: "Item terbuka untuk produk ini pada proses ini." } satisfies ColumnMeta,
        cell: ({ row }) => (row.original.exceptions > 0 ? <Tag tone="warning">{row.original.exceptions} open</Tag> : <span className="text-xs text-fg-tertiary">None</span>),
      },
    ],
    [],
  );

  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title="Wawasan Perkiraan" />
        <Panel>
          <ErrorState what="Wawasan perkiraan tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      </PageContainer>
    );
  }

  const { run, model, summary, changeByCategory, changeByLifecycle, uncertainty, movers, accuracyBySegment, accuracyWindow, concentration } = q.data;
  const maxInterval = Math.max(...uncertainty.map((u) => u.intervalPercent), 0.0001);

  return (
    <PageContainer>
      <PageHeader
        title="Wawasan Perkiraan"
        description="Mengapa perkiraan berubah, di mana paling tidak pasti, dan di mana model paling lemah — untuk satu proses perkiraan."
        meta={
          <>
            <StatusBadge status={run.status} size="sm" />
            <span className="text-xs font-medium text-fg-secondary">
              {scopeLabel(run)} · {run.horizonDays}-day horizon from {formatDate(summary.periodStart)}
            </span>
            <FreshnessIndicator timestamp={run.completedAt} label="Dibuat" />
          </>
        }
        actions={
          <Select
            className="w-[min(26rem,90vw)]"
            aria-label="Proses perkiraan"
            prefix="Run:"
            value={run.id}
            onValueChange={(v) => state.setParams({ run: v })}
            placeholder="Perkiraan terbit terakhir"
            options={(runs.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.id} · ${r.name}`, description: `${r.status === "published" ? "Diterbitkan" : "Selesai, belum diterbitkan"} · ${formatDateTime(r.completedAt)}` }))}
          />
        }
      />

      <MetricStrip>
        <MetricCard
          label="Perkiraan · total periode"
          value={formatNumber(summary.forecast)}
          unit="units"
          context={`${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)}`}
          delta={<ForecastDelta percent={summary.deltaPercent} />}
          footnote={`${formatNumber(summary.skuCount)} SKUs in scope`}
        />
        <MetricCard
          label="Perubahan vs proses sebelumnya"
          value={formatDeltaNumber(summary.delta)}
          unit="units"
          context={<span>{formatDeltaPercent(summary.deltaPercent)} versus the previous published run</span>}
          footnote="Batas tinjauan 15%"
        />
        <MetricCard
          label="80% prediction interval"
          value={`${formatNumber(summary.lower)} – ${formatNumber(summary.upper)}`}
          context={`${formatPercent(summary.intervalPercent)} of the forecast`}
          footnote="Melebar seiring horizon dan korelasi antar-SKU"
        />
        <MetricCard
          label="Konsentrasi perubahan"
          value={formatPercent(concentration.top10Share)}
          context="of total movement comes from the 10 largest SKUs"
          footnote={`50 largest: ${formatPercent(concentration.top50Share)}`}
          href={`/forecasting/explorer?sort=deltaPercent&dir=desc&run=${run.id}`}
          hrefLabel="Buka di Perkiraan Permintaan"
        />
      </MetricStrip>

      <PageSection title="Mengapa perkiraan berubah" description="Perubahan dibanding proses terbit sebelumnya, dipecah per kategori dan siklus produk.">
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartFrame
            title="Perubahan per kategori"
            question="Kategori mana yang menyebabkan pergerakan perkiraan?"
            unit="units (change vs previous run)"
            timeframe={`${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)}`}
            source={`Run ${run.id}`}
            asOf={run.completedAt}
            legend={
              <>
                <LegendItem color="var(--chart-series-1)" label="Naik" variant="bar" />
                <LegendItem color="var(--chart-series-5)" label="Turun" variant="bar" />
              </>
            }
            summary={`Total change ${formatDeltaNumber(summary.delta)} units (${formatDeltaPercent(summary.deltaPercent)}). ${changeByCategory[0] ? `${changeByCategory[0].label} moves the most at ${formatDeltaNumber(changeByCategory[0].delta)} units.` : ""}`}
            chart={
              <div style={{ height: Math.max(200, changeByCategory.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={changeByCategory} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} />
                    <YAxis type="category" dataKey="label" width={104} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "var(--bg-hover)" }} contentStyle={chartTooltip} formatter={(v) => [formatDeltaNumber(v as number), "Change"]} />
                    <Bar dataKey="delta" isAnimationActive={false} radius={[0, 2, 2, 0]}>
                      {changeByCategory.map((c) => (
                        <Cell key={c.key} fill={c.delta >= 0 ? "var(--chart-series-1)" : "var(--chart-series-5)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            }
            table={
              <ChartDataTable
                caption="Perubahan perkiraan per kategori"
                columns={[{ key: "c", label: "Kategori" }, { key: "f", label: "Perkiraan", numeric: true }, { key: "p", label: "Sebelumnya", numeric: true }, { key: "d", label: "Perubahan", numeric: true }, { key: "dp", label: "Perubahan %", numeric: true }]}
                rows={changeByCategory.map((c) => ({ c: c.label, f: formatNumber(c.forecast), p: formatNumber(c.previous), d: <SignedPercent percent={c.deltaPercent} />, dp: formatDeltaPercent(c.deltaPercent) }))}
              />
            }
          />
          <Panel title="Perubahan per siklus produk" description="Produk baru dan produk akhir masa memiliki risiko berbeda dari rangkaian inti." flush>
            <ul>
              {changeByLifecycle.map((s) => (
                <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0">
                  <span className="min-w-0">
                    <span className="block body-sm font-semibold">{s.label}</span>
                    <span className="block caption">{formatNumber(s.skuCount)} SKUs · {formatNumber(s.forecast)} units forecast</span>
                  </span>
                  <span className="text-right tabular body-sm text-fg-secondary">{formatDeltaNumber(s.delta)}</span>
                  <ForecastDelta percent={s.deltaPercent} size="sm" className="w-20" />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </PageSection>

      <PageSection title="Fokus tinjauan" description="Kategori dengan rentang 80% paling lebar dibanding perkiraannya. Tinjau ini sebelum rencana diterbitkan.">
        <Panel
          flush
          actions={
            <Link href={`/forecasting/explorer?sort=width&dir=desc&run=${run.id}`} className="text-xs font-semibold text-primary hover:underline">
              Telusuri menurut lebar rentang
            </Link>
          }
        >
          <ul>
            {uncertainty.map((s: InsightSegment) => (
              <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-center gap-3 border-b border-border-subtle px-4 py-2.5 last:border-b-0">
                <span className="min-w-0">
                  <span className="block truncate body-sm font-semibold">{s.label}</span>
                  <span className="block caption">{formatNumber(s.skuCount)} SKUs · {formatNumber(s.forecast)} units</span>
                </span>
                <span className="h-2 rounded-full bg-muted" aria-hidden>
                  <span className="block h-2 rounded-full" style={{ width: `${Math.max(4, (s.intervalPercent / maxInterval) * 100)}%`, background: "var(--chart-series-1)" }} />
                </span>
                <span className="w-16 text-right tabular body-sm text-fg-secondary" title="Lebar rentang sebagai bagian dari perkiraan">
                  {formatPercent(s.intervalPercent)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </PageSection>

      <PageSection title="Perubahan terbesar" description="Produk dengan perubahan terbesar dibanding proses sebelumnya. Buka produk untuk menelusuri penyebabnya.">
        <DataTable
          label="Perubahan perkiraan terbesar"
          columns={moverColumns}
          data={movers}
          getRowId={(m) => m.productId}
          storageKey="insights-movers"
          maxHeight="28rem"
          onRowClick={(m) => {
            track("forecast_opened", { from: "insights" });
            router.push(`/forecasting/detail/${m.productId}?run=${run.id}`);
          }}
          empty={
            <EmptyState
              icon={ChartSpline}
              title="Tidak ada perubahan untuk ditampilkan pada proses ini."
              description="Proses ini tidak mencakup produk, atau semua produk berada dalam ±0,1% dari proses sebelumnya."
            />
          }
        />
      </PageSection>

      <PageSection title="Titik terlemah model" description="Uji model terakhir untuk model yang menghasilkan proses ini, per segmen.">
        <Panel
          flush
          actions={
            <Link href="/models/backtesting" className="text-xs font-semibold text-primary hover:underline">
              Buka Uji Model
            </Link>
          }
        >
          {accuracyBySegment.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ChartSpline}
                title="Belum ada uji model yang selesai untuk model ini."
                description="Jalankan uji model untuk melihat di mana performanya paling lemah sebelum memercayai perkiraan per segmen."
                action={
                  <Link href="/models/backtesting" className="text-xs font-semibold text-primary hover:underline">
                    Jalankan uji model
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[0.8125rem]">
                  <caption className="sr-only">Backtest accuracy by segment{accuracyWindow ? `, window ${formatDate(accuracyWindow.start)} to ${formatDate(accuracyWindow.end)}` : ""}</caption>
                  <thead>
                    <tr className="border-b border-border bg-subtle text-xs text-fg-secondary">
                      <th scope="col" className="px-4 py-2 text-left font-semibold">Segmen</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">WAPE</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Bias</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Bagian volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accuracyBySegment.map((s) => (
                      <tr key={s.segment} className="border-b border-border-subtle last:border-b-0">
                        <th scope="row" className="px-4 py-2 text-left font-medium text-fg">{s.segment}</th>
                        <td className="px-4 py-2 text-right tabular text-fg">{formatPercent(s.wape)}</td>
                        <td className={cn("px-4 py-2 text-right tabular", deltaToneClass(s.bias))}>{formatDeltaPercent(s.bias)}</td>
                        <td className="px-4 py-2 text-right tabular text-fg-secondary">{formatPercent(s.volumeShare)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-border-subtle px-4 py-3 caption">
                WAPE: {METRIC_DEFINITIONS.wape.definition} Bias: {METRIC_DEFINITIONS.bias.definition}
                {accuracyWindow && ` Window ${formatDate(accuracyWindow.start)} – ${formatDate(accuracyWindow.end)}.`}
                {model && ` Population: all SKUs forecast by ${model.name} v${model.version}.`}
              </p>
            </>
          )}
        </Panel>
      </PageSection>
    </PageContainer>
  );
}
