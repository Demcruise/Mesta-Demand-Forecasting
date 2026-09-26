"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, ChartSpline, Crosshair, MoveVertical, Package, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Product } from "@/types/domain";
import { getForecastInsights, type InsightMover, type InsightSegment } from "@/lib/api/analytics";
import { listRuns } from "@/lib/api/forecasting";
import { useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { formatCompact, formatDate, formatDateTime, formatDeltaCompact, formatDeltaNumber, formatDeltaPercent, formatMetric, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { track } from "@/lib/telemetry";
import { PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { deltaToneClass, ForecastDelta, MetricCard, MetricDelta, MetricStrip, SignedPercent } from "@/components/forecasting/metrics";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { ChartDataTable, ChartFrame, LegendItem } from "@/components/charts/chart-frame";
import { ProductIdentity, scopeLabel } from "@/components/entities/identity";
import { StatusBadge, Tag } from "@/components/feedback/status";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { Select } from "@/components/ui/select";
import { METRIC_DEFINITIONS } from "@/features/models/metric-definitions";
import { pick, localized } from "@/lib/i18n";

const LIFECYCLE_LABELS: Record<Product["lifecycle"], string> = localized({
  new: "Produk baru",
  core: "Rangkaian inti",
  seasonal: "Musiman",
  "end-of-life": "Akhir masa",
}, {
  new: "New listings",
  core: "Core range",
  seasonal: "Seasonal",
  "end-of-life": "End of life",
});

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
        header: pick("Produk", "Product"),
        meta: { width: "minmax(240px, 2.2fr)", pinned: true, label: pick("Produk", "Product") } satisfies ColumnMeta,
        cell: ({ row }) => {
          const m = row.original;
          return <ProductIdentity product={{ id: m.productId, name: m.name, sku: m.sku, category: m.category }} />;
        },
      },
      { id: "category", header: pick("Kategori", "Category"), meta: { width: "140px", hideBelow: "lg", label: pick("Kategori", "Category") } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-fg-secondary">{row.original.category}</span> },
      { id: "lifecycle", header: pick("Siklus produk", "Lifecycle"), meta: { width: "130px", hideBelow: "xl", label: pick("Siklus produk", "Lifecycle") } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{LIFECYCLE_LABELS[row.original.lifecycle]}</span> },
      {
        id: "forecast",
        header: pick("Perkiraan", "Forecast"),
        meta: { width: "110px", numeric: true, description: pick("Total perkiraan selama periode perkiraan.", "Total forecast over the run horizon.") } satisfies ColumnMeta,
        cell: ({ row }) => <span className="font-semibold">{formatNumber(row.original.forecast)}</span>,
      },
      { id: "previous", header: pick("Sebelumnya", "Previous"), meta: { width: "110px", numeric: true, hideBelow: "md", description: pick("Perkiraan dari proses terbit sebelumnya.", "Forecast from the previous published run.") } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{formatNumber(row.original.previousForecast)}</span> },
      {
        id: "change",
        header: pick("Perubahan", "Change"),
        meta: { width: "100px", numeric: true, description: pick("Perubahan dibanding proses sebelumnya. Ditandai bila melewati batas tinjauan 15%.", "Change versus the previous run. Flagged when it crosses the 15% review threshold.") } satisfies ColumnMeta,
        cell: ({ row }) => <ForecastDelta percent={row.original.deltaPercent} size="sm" />,
      },
      {
        id: "interval",
        header: pick("Rentang", "Range"),
        meta: { width: "110px", numeric: true, description: pick("Lebar rentang perkiraan 80% sebagai bagian dari perkiraan. Semakin lebar semakin tidak pasti.", "Width of the 80% forecast interval as a share of the forecast. Wider means less certain.") } satisfies ColumnMeta,
        cell: ({ row }) => <span className="tabular text-fg-secondary">{formatPercent(row.original.intervalPercent)}</span>,
      },
      {
        id: "exceptions",
        header: pick("Perlu Ditinjau", "Exceptions"),
        meta: { width: "110px", label: pick("Perlu Ditinjau", "Exceptions"), description: pick("Item terbuka untuk produk ini pada proses ini.", "Open items for this product on this run.") } satisfies ColumnMeta,
        cell: ({ row }) => (row.original.exceptions > 0 ? <Tag tone="warning">{pick(`${row.original.exceptions} terbuka`, `${row.original.exceptions} open`)}</Tag> : <span className="text-xs text-fg-tertiary">{pick("Tidak ada", "None")}</span>),
      },
    ],
    [],
  );

  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title={pick("Wawasan Perkiraan", "Forecast insights")} />
        <Panel>
          <ErrorState what={pick("Wawasan perkiraan tidak dapat dimuat.", "Forecast insights could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      </PageContainer>
    );
  }

  const { run, model, summary, changeByCategory, changeByLifecycle, uncertainty, movers, accuracyBySegment, accuracyWindow, concentration } = q.data;
  const maxInterval = Math.max(...uncertainty.map((u) => u.intervalPercent), 0.0001);

  return (
    <PageContainer>
      <PageHeader
        title={pick("Wawasan Perkiraan", "Forecast insights")}
        description={pick("Mengapa perkiraan berubah, di mana paling tidak pasti, dan di mana model paling lemah — untuk satu proses perkiraan.", "Why the outlook moved, where it is least certain and where the model is weakest — for one forecast run.")}
        meta={
          <>
            <StatusBadge status={run.status} size="sm" />
            <span className="text-xs font-medium text-fg-secondary">
              {scopeLabel(run)} · {pick(`${run.horizonDays} hari sejak ${formatDate(summary.periodStart)}`, `${run.horizonDays}-day horizon from ${formatDate(summary.periodStart)}`)}
            </span>
            <FreshnessIndicator timestamp={run.completedAt} label={pick("Dibuat", "Created")} />
          </>
        }
        actions={
          <Select
            className="w-[min(26rem,90vw)]"
            aria-label={pick("Proses perkiraan", "Forecast run")}
            prefix={pick("Proses:", "Run:")}
            value={run.id}
            onValueChange={(v) => state.setParams({ run: v })}
            placeholder={pick("Perkiraan terbit terakhir", "Latest published run")}
            options={(runs.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.id} · ${r.name}`, description: pick(`${r.status === "published" ? "Diterbitkan" : "Selesai, belum diterbitkan"} · ${formatDateTime(r.completedAt)}`, `${r.status === "published" ? "Published" : "Completed, not published"} · ${formatDateTime(r.completedAt)}`) }))}
          />
        }
      />

      {/* PAGE-INSIGHTS-CARDS-001: four compact signals; the explanation lives in the charts below. */}
      <PageSection
        title={pick("Ringkasan proses", "Run summary")}
        actions={
          <Link href={`/forecasting/explorer?sort=deltaPercent&dir=desc&run=${run.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            {pick("Lihat di Perkiraan Permintaan", "View in Forecast Explorer")} <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      >
        <MetricStrip>
          <MetricCard
            variant="compact"
            icon={Package}
            label={pick("Total perkiraan", "Total forecast")}
            value={formatMetric(summary.forecast)}
            exactValue={`${formatNumber(summary.forecast)} ${pick("unit", "units")}`}
            unit={pick("unit", "units")}
            delta={<MetricDelta value={summary.deltaPercent} />}
            comparison={pick("vs perkiraan sebelumnya", "vs previous run")}
            tooltip={pick(
              `${formatNumber(summary.skuCount)} SKU, ${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)}.`,
              `${formatNumber(summary.skuCount)} SKUs, ${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)}.`,
            )}
          />
          <MetricCard
            variant="compact"
            icon={TrendingUp}
            label={pick("Perubahan vs sebelumnya", "Change vs previous run")}
            value={formatDeltaCompact(summary.delta)}
            exactValue={`${formatDeltaNumber(summary.delta)} ${pick("unit", "units")}`}
            unit={pick("unit", "units")}
            delta={<MetricDelta value={summary.deltaPercent} />}
          />
          <MetricCard
            variant="compact"
            icon={MoveVertical}
            label={pick("Rentang perkiraan 80%", "80% forecast range")}
            value={`${formatMetric(summary.lower)}–${formatMetric(summary.upper)}`}
            exactValue={`${formatNumber(summary.lower)} – ${formatNumber(summary.upper)} ${pick("unit", "units")}`}
            meta={pick(`Lebar rentang ${formatPercent(summary.intervalPercent)}`, `Range width ${formatPercent(summary.intervalPercent)}`)}
            tooltip={pick(
              "Permintaan aktual diperkirakan berada di dalam rentang ini 80% dari waktu. Melebar seiring horizon.",
              "Actual demand is expected to fall inside this range 80% of the time. It widens with the horizon.",
            )}
          />
          <MetricCard
            variant="compact"
            icon={Crosshair}
            label={pick("Konsentrasi perubahan", "Change concentration")}
            value={formatPercent(concentration.top10Share)}
            meta={pick("dari 10 SKU teratas", "from top 10 SKUs")}
            tooltip={pick(`50 SKU teratas: ${formatPercent(concentration.top50Share)} dari total pergerakan.`, `Top 50 SKUs: ${formatPercent(concentration.top50Share)} of total movement.`)}
            href={`/forecasting/explorer?sort=deltaPercent&dir=desc&run=${run.id}`}
            destination={pick("buka Perkiraan Permintaan", "opens Forecast Explorer")}
          />
        </MetricStrip>
      </PageSection>

      <PageSection title={pick("Mengapa perkiraan berubah", "Why the forecast changed")} description={pick("Perubahan dibanding proses terbit sebelumnya, dipecah per kategori dan siklus produk.", "Change versus the previous published run, split by category and lifecycle.")}>
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartFrame
            title={pick("Perubahan per kategori", "Change by category")}
            question={pick("Kategori mana yang menyebabkan pergerakan perkiraan?", "Which categories drive the forecast movement?")}
            unit={pick("unit (perubahan vs perkiraan sebelumnya)", "units (change vs previous run)")}
            timeframe={`${formatDate(summary.periodStart)} – ${formatDate(summary.periodEnd)}`}
            source={pick(`Proses ${run.id}`, `Run ${run.id}`)}
            asOf={run.completedAt}
            legend={
              <>
                <LegendItem color="var(--chart-series-1)" label={pick("Naik", "Up")} variant="bar" />
                <LegendItem color="var(--chart-series-5)" label={pick("Turun", "Down")} variant="bar" />
              </>
            }
            summary={pick(`Total perubahan ${formatDeltaNumber(summary.delta)} unit (${formatDeltaPercent(summary.deltaPercent)}). ${changeByCategory[0] ? `${changeByCategory[0].label} bergerak paling besar, ${formatDeltaNumber(changeByCategory[0].delta)} unit.` : ""}`, `Total change ${formatDeltaNumber(summary.delta)} units (${formatDeltaPercent(summary.deltaPercent)}). ${changeByCategory[0] ? `${changeByCategory[0].label} moves the most at ${formatDeltaNumber(changeByCategory[0].delta)} units.` : ""}`)}
            chart={
              <div style={{ height: Math.max(200, changeByCategory.length * 34) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={changeByCategory} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} />
                    <YAxis type="category" dataKey="label" width={104} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "var(--bg-hover)" }} contentStyle={chartTooltip} formatter={(v) => [formatDeltaNumber(v as number), pick("Perubahan", "Change")]} />
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
                caption={pick("Perubahan perkiraan per kategori", "Forecast change by category")}
                columns={[{ key: "c", label: pick("Kategori", "Category") }, { key: "f", label: pick("Perkiraan", "Forecast"), numeric: true }, { key: "p", label: pick("Sebelumnya", "Previous"), numeric: true }, { key: "d", label: pick("Perubahan", "Change"), numeric: true }, { key: "dp", label: pick("Perubahan %", "Change %"), numeric: true }]}
                rows={changeByCategory.map((c) => ({ c: c.label, f: formatNumber(c.forecast), p: formatNumber(c.previous), d: <SignedPercent percent={c.deltaPercent} />, dp: formatDeltaPercent(c.deltaPercent) }))}
              />
            }
          />
          <Panel title={pick("Perubahan per siklus produk", "Change by lifecycle")} description={pick("Produk baru dan produk akhir masa memiliki risiko berbeda dari rangkaian inti.", "New listings and end-of-life range carry different risk from the core range.")} flush>
            <ul>
              {changeByLifecycle.map((s) => (
                <li key={s.key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0">
                  <span className="min-w-0">
                    <span className="block body-sm font-semibold">{s.label}</span>
                    <span className="block caption">{pick(`${formatNumber(s.skuCount)} SKU · perkiraan ${formatNumber(s.forecast)} unit`, `${formatNumber(s.skuCount)} SKUs · ${formatNumber(s.forecast)} units forecast`)}</span>
                  </span>
                  <span className="text-right tabular body-sm text-fg-secondary">{formatDeltaNumber(s.delta)}</span>
                  <ForecastDelta percent={s.deltaPercent} size="sm" className="w-20" />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </PageSection>

      <PageSection title={pick("Fokus tinjauan", "Where to focus review")} description={pick("Kategori dengan rentang 80% paling lebar dibanding perkiraannya. Tinjau ini sebelum rencana diterbitkan.", "Categories whose 80% interval is widest relative to their forecast. Review these before the plan is published.")}>
        <Panel
          flush
          actions={
            <Link href={`/forecasting/explorer?sort=width&dir=desc&run=${run.id}`} className="text-xs font-semibold text-primary hover:underline">
              {pick("Telusuri menurut lebar rentang", "Explore by range width")}
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
                <span className="w-16 text-right tabular body-sm text-fg-secondary" title={pick("Lebar rentang sebagai bagian dari perkiraan", "Interval width as a share of the forecast")}>
                  {formatPercent(s.intervalPercent)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </PageSection>

      <PageSection title={pick("Perubahan terbesar", "Largest movers")} description={pick("Produk dengan perubahan terbesar dibanding proses sebelumnya. Buka produk untuk menelusuri penyebabnya.", "Products with the biggest change versus the previous run. Open a product to investigate the driver.")}>
        <DataTable
          label={pick("Perubahan perkiraan terbesar", "Largest forecast movers")}
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
              title={pick("Tidak ada perubahan untuk ditampilkan pada proses ini.", "No movers to show for this run.")}
              description={pick("Proses ini tidak mencakup produk, atau semua produk berada dalam ±0,1% dari proses sebelumnya.", "The run has no products in scope, or every product is within ±0.1% of the previous run.")}
            />
          }
        />
      </PageSection>

      <PageSection title={pick("Titik terlemah model", "Where the model is weakest")} description={pick("Uji model terakhir untuk model yang menghasilkan proses ini, per segmen.", "Latest backtest for the model that produced this run, by segment.")}>
        <Panel
          flush
          actions={
            <Link href="/models/backtesting" className="text-xs font-semibold text-primary hover:underline">
              {pick("Buka Uji Model", "Open backtesting")}
            </Link>
          }
        >
          {accuracyBySegment.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={ChartSpline}
                title={pick("Belum ada uji model yang selesai untuk model ini.", "No completed backtest is available for this model.")}
                description={pick("Jalankan uji model untuk melihat di mana performanya paling lemah sebelum memercayai perkiraan per segmen.", "Run a backtest to see where the model performs worst before trusting segment-level forecasts.")}
                action={
                  <Link href="/models/backtesting" className="text-xs font-semibold text-primary hover:underline">
                    {pick("Jalankan uji model", "Run backtest")}
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[0.8125rem]">
                  <caption className="sr-only">{pick("Akurasi uji model per segmen", "Backtest accuracy by segment")}{accuracyWindow ? pick(`, periode ${formatDate(accuracyWindow.start)} sampai ${formatDate(accuracyWindow.end)}`, `, window ${formatDate(accuracyWindow.start)} to ${formatDate(accuracyWindow.end)}`) : ""}</caption>
                  <thead>
                    <tr className="border-b border-border bg-subtle text-xs text-fg-secondary">
                      <th scope="col" className="px-4 py-2 text-left font-semibold">{pick("Segmen", "Segment")}</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">WAPE</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">Bias</th>
                      <th scope="col" className="px-4 py-2 text-right font-semibold">{pick("Bagian volume", "Volume share")}</th>
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
                {`WAPE: ${METRIC_DEFINITIONS.wape.definition} Bias: ${METRIC_DEFINITIONS.bias.definition}`}
                {accuracyWindow && pick(` Periode ${formatDate(accuracyWindow.start)} – ${formatDate(accuracyWindow.end)}.`, ` Window ${formatDate(accuracyWindow.start)} – ${formatDate(accuracyWindow.end)}.`)}
                {model && pick(` Populasi: semua SKU yang diperkirakan ${model.name} v${model.version}.`, ` Population: all SKUs forecast by ${model.name} v${model.version}.`)}
              </p>
            </>
          )}
        </Panel>
      </PageSection>
    </PageContainer>
  );
}
