"use client";

import Link from "next/link";
import * as React from "react";
import { getModelPerformance, listModelOptions } from "@/lib/api/models";
import { useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { formatDate, formatDateRange, formatDeltaPercent, formatPercent } from "@/lib/format";
import { SignedPercent } from "@/components/forecasting/metrics";
import { Segmented } from "@/components/ui/controls";
import { MultiSelect } from "@/components/ui/multi-select";
import { PageContainer, PageHeader, Panel } from "@/components/page/page";
import { ChartDataTable, ChartFrame, LegendItem } from "@/components/charts/chart-frame";
import { MetricTrend, ShareBar } from "@/components/charts/small-charts";
import { EmptyState, ErrorState, InlineAlert, PageSkeleton } from "@/components/feedback/states";
import { METRIC_DEFINITIONS, type MetricKey } from "./metric-definitions";
import { metricValue } from "./model-detail-view";
import { pick } from "@/lib/i18n";

const COLORS = ["var(--chart-series-1)", "var(--chart-series-3)", "var(--chart-series-2)", "var(--chart-series-4)", "var(--chart-series-5)"];

/** PAGE-MODEL-PERFORMANCE: accuracy and bias over time, compared on the same population. */
export function PerformanceView() {
  const state = useListState({ filterKeys: [] });
  const selected = (state.getParam("models") ?? "mdl_gbm_24,mdl_gbm_25").split(",").filter(Boolean);
  const metric = (state.getParam("metric") as "wape" | "bias" | null) ?? "wape";
  const options = useApiQuery(["model-options"], listModelOptions);
  const q = useApiQuery(["model-performance", selected], (c) => getModelPerformance(c, selected), { keepPrevious: true });

  if (q.isPending || options.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title={pick("Performa Model", pick("Performa model", "Model performance"))} />
        <Panel><ErrorState what={pick("Performa model tidak dapat dimuat.", "Model performance could not be loaded.")} error={q.error} onRetry={() => q.refetch()} /></Panel>
      </PageContainer>
    );
  }
  const models = q.data.models;
  const series = models.map((m, i) => ({ key: `${m.id}:${metric}`, label: `${m.name} ${m.version}`, color: COLORS[i % COLORS.length] as string }));
  const def = METRIC_DEFINITIONS[metric];
  const firstWeek = q.data.series[0]?.week as string | undefined;
  const lastWeek = q.data.series[q.data.series.length - 1]?.week as string | undefined;

  return (
    <PageContainer>
      <PageHeader
        title={pick("Performa Model", pick("Performa model", "Model performance"))}
        description={pick("Seberapa akurat dan seberapa bias tiap model dari minggu ke minggu, pada populasi yang sama.", pick("Seberapa akurat dan seberapa bias tiap model, minggu demi minggu, pada populasi yang sama.", "How accurate and how biased each model has been, week by week, on the same population."))}
        actions={
          <div className="w-[min(24rem,90vw)]">
            <MultiSelect
              value={selected}
              onChange={(v) => state.setParams({ models: v.length ? v.join(",") : null })}
              allLabel={pick("Pilih model untuk dibandingkan", "Choose models to compare")}
              options={(options.data ?? []).map((m) => ({ value: m.id, label: `${m.name} ${m.version}`, hint: m.status }))}
            />
          </div>
        }
      />
      {models.length === 0 ? (
        <Panel>
          <EmptyState title={pick("Pilih minimal satu model untuk dibandingkan.", "Choose at least one model to compare.")} description={pick("Gunakan pemilih model di atas.", "Use the model picker above.")} />
        </Panel>
      ) : (
        <>
          <InlineAlert tone="info" title={pick("Definisi metrik masih perlu disepakati dengan pemilik analitik.", "Metric definitions need agreement with analytics owners.")}>
            Values below use the proposed definitions shown next to each metric. Compare models over identical windows; different windows can create false precision.
          </InlineAlert>
          <ChartFrame
            title={`${def.name} by week`}
            question={metric === "wape" ? pick("Apakah selisih perkiraan membaik atau memburuk?", "Is forecast error improving or drifting?") : pick("Apakah ada model yang konsisten terlalu tinggi atau terlalu rendah?", pick("Adakah model yang konsisten memperkirakan terlalu tinggi atau rendah?", "Is any model consistently over- or under-forecasting?"))}
            unit={def.unit}
            timeframe={firstWeek && lastWeek ? `Weeks of ${formatDate(firstWeek)} – ${formatDate(lastWeek)}` : ""}
            source={pick("Proses evaluasi mingguan", "Weekly evaluation job")}
            actions={
              <Segmented
                size="sm"
                aria-label={pick("Metrik", "Metric")}
                value={metric}
                onValueChange={(v) => state.setParams({ metric: v })}
                options={[
                  { value: "wape", label: "WAPE" },
                  { value: "bias", label: "Bias" },
                ]}
              />
            }
            legend={series.map((s) => <LegendItem key={s.key} color={s.color} label={s.label} />)}
            summary={models
              .map((m) => {
                const vals = q.data.series.map((r) => r[`${m.id}:${metric}`] as number);
                const last = vals[vals.length - 1] ?? 0;
                const first = vals[0] ?? 0;
                return `${m.name} ${m.version}: ${metric === "wape" ? formatPercent(last) : formatDeltaPercent(last)} last week (${metric === "wape" ? formatPercent(first) : formatDeltaPercent(first)} 12 weeks ago).`;
              })
              .join(" ")}
            chart={<MetricTrend rows={q.data.series} series={series} xKey="week" format={(v) => (metric === "wape" ? formatPercent(v) : formatDeltaPercent(v))} />}
            table={
              <ChartDataTable
                caption={`${def.name} by week`}
                columns={[{ key: "week", label: pick("Minggu", "Week of") }, ...series.map((s) => ({ key: s.key, label: s.label, numeric: true }))]}
                rows={q.data.series.map((r) => ({
                  week: formatDate(r.week as string),
                  ...Object.fromEntries(series.map((s) => [s.key, metric === "wape" ? formatPercent(r[s.key] as number) : <SignedPercent key={s.key} percent={r[s.key] as number} />])),
                }))}
              />
            }
          />
          <Panel title={pick("Evaluasi terakhir", "Latest evaluation")} description={pick("Uji model terakhir yang selesai untuk tiap model. Pastikan periodenya sama sebelum membandingkan.", "Each model's latest completed backtest. Check that the windows match before comparing.")} flush>
            <div className="p-4">
              <ChartDataTable
                caption={pick("Evaluasi terakhir per model", "Latest evaluation by model")}
                maxHeight="none"
                columns={[
                  { key: "model", label: pick("Model", "Model") },
                  { key: "window", label: pick("Periode", "Window") },
                  ...(Object.keys(METRIC_DEFINITIONS) as MetricKey[]).map((k) => ({ key: k, label: METRIC_DEFINITIONS[k].label, numeric: true })),
                  { key: "link", label: "" },
                ]}
                rows={models.map((m) => {
                  const bt = q.data.backtests[m.id];
                  const metrics = bt?.metrics ?? m.metrics;
                  return {
                    model: `${m.name} ${m.version}`,
                    window: bt ? formatDateRange(bt.windowStart, bt.windowEnd) : `${formatDateRange(m.metrics.evaluationStart, m.metrics.evaluationEnd)} (catalogue)`,
                    ...Object.fromEntries((Object.keys(METRIC_DEFINITIONS) as MetricKey[]).map((k) => [k, metricValue(metrics, k)])),
                    link: bt ? (
                      <Link href={`/models/backtesting?id=${bt.id}`} className="text-xs font-semibold text-primary hover:underline">
                        {bt.id}
                      </Link>
                    ) : null,
                  };
                })}
              />
            </div>
          </Panel>
          <Panel title={pick("Performa per kategori", "Performance by category")} description={pick("Dari uji model terakhir tiap model. Bagian volume adalah porsi kategori terhadap permintaan aktual.", "From each model's latest backtest. Volume share is the category's share of actual demand.")} flush>
            <div className="p-4">
              <ChartDataTable
                caption={pick("Performa per kategori", "Performance by category")}
                maxHeight="none"
                columns={[
                  { key: "segment", label: pick("Kategori", "Category") },
                  { key: "share", label: pick("Bagian volume", "Volume share"), numeric: true },
                  ...models.flatMap((m) => [
                    { key: `${m.id}:wape`, label: `WAPE · ${m.version}`, numeric: true },
                    { key: `${m.id}:bias`, label: `Bias · ${m.version}`, numeric: true },
                  ]),
                ]}
                rows={(q.data.backtests[models[0]?.id ?? ""]?.segments ?? []).map((seg) => ({
                  segment: seg.segment,
                  share: (
                    <span className="inline-flex items-center justify-end gap-2">
                      <ShareBar value={seg.volumeShare} />
                      {formatPercent(seg.volumeShare, 0)}
                    </span>
                  ),
                  ...Object.fromEntries(
                    models.flatMap((m) => {
                      const s = q.data.backtests[m.id]?.segments.find((x) => x.segment === seg.segment);
                      return [
                        [`${m.id}:wape`, s ? formatPercent(s.wape) : "—"],
                        [`${m.id}:bias`, s ? <SignedPercent key="b" percent={s.bias} /> : "—"],
                      ];
                    }),
                  ),
                }))}
              />
            </div>
          </Panel>
        </>
      )}
    </PageContainer>
  );
}
