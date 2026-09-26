"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { FlaskConical, Play } from "lucide-react";
import * as React from "react";
import type { Backtest, Frequency } from "@/types/domain";
import { listBacktests, listModelOptions, runBacktest } from "@/lib/api/models";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { formatDateRange, formatDeltaPercent, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { SignedPercent } from "@/components/forecasting/metrics";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { StatusBadge } from "@/components/feedback/status";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { UserIdentity } from "@/components/entities/identity";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { ChartDataTable, ChartFrame } from "@/components/charts/chart-frame";
import { Histogram } from "@/components/charts/small-charts";
import { METRIC_DEFINITIONS, type MetricKey } from "./metric-definitions";
import { metricValue } from "./model-detail-view";
import { pick } from "@/lib/i18n";

/** PAGE-BACKTESTING: select model → window → frequency → run → review → compare versions. */
export function BacktestingView() {
  const { can } = useSession();
  const state = useListState({ filterKeys: [] });
  const selectedId = state.getParam("id");
  const compareId = state.getParam("compare");
  const models = useApiQuery(["model-options"], listModelOptions);
  const q = useApiQuery(["backtests"], listBacktests, {
    refetchInterval: (query) => (query.state.data?.some((b) => b.status === "queued" || b.status === "running") ? 1500 : false),
  });
  const [modelId, setModelId] = React.useState(state.getParam("model") ?? "mdl_gbm_25");
  const [windowDays, setWindowDays] = React.useState("91");
  const [frequency, setFrequency] = React.useState<Frequency>("daily");
  const run = useApiMutation((c, _v: void) => runBacktest(c, { modelId, windowDays: Number(windowDays), frequency }), {
    invalidate: [["backtests"]],
    success: (b) => pick(`Uji model ${b.id} dimulai`, `Backtest ${b.id} started`),
    successDescription: pick("Hasil muncul di bawah setelah selesai.", "Results appear below when it completes."),
    failure: pick("Uji model tidak dimulai.", "The backtest did not start."),
    onSuccess: (b) => {
      track("forecast_run_started", { kind: "backtest" });
      state.setParams({ id: b.id });
    },
  });
  const modelName = (id: string) => {
    const m = models.data?.find((x) => x.id === id);
    return m ? `${m.name} ${m.version}` : id;
  };
  const selected = q.data?.find((b) => b.id === selectedId) ?? q.data?.find((b) => b.status === "completed");
  const compare = q.data?.find((b) => b.id === compareId && b.id !== selected?.id);

  const columns = React.useMemo<ColumnDef<Backtest, unknown>[]>(
    () => [
      { id: "id", header: pick("Uji Model", "Backtest"), meta: { width: "110px", pinned: true, label: pick("Uji Model", "Backtest") } satisfies ColumnMeta, cell: ({ row }) => <span className="mono-id text-fg">{row.original.id}</span> },
      { id: "model", header: pick("Model", "Model"), meta: { width: "minmax(200px, 2fr)" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate font-semibold">{modelName(row.original.modelId)}</span> },
      { id: "window", header: pick("Periode", "Window"), meta: { width: "200px", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-xs tabular text-fg-secondary">{formatDateRange(row.original.windowStart, row.original.windowEnd)} · {row.original.frequency === "daily" ? "harian" : "mingguan"}</span> },
      { id: "status", header: "Status", meta: { width: "130px" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      { id: "wape", header: "WAPE", meta: { width: "90px", numeric: true } satisfies ColumnMeta, cell: ({ row }) => (row.original.metrics ? formatPercent(row.original.metrics.wape) : "—") },
      { id: "bias", header: "Bias", meta: { width: "90px", numeric: true, hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => (row.original.metrics ? <SignedPercent percent={row.original.metrics.bias} /> : "—") },
      { id: "coverage", header: pick("Cakupan", "Coverage"), meta: { width: "100px", numeric: true, hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => (row.original.metrics ? formatPercent(row.original.metrics.coverage80, 0) : "—") },
      { id: "by", header: pick("Dijalankan oleh", "Run by"), meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.createdBy} secondary={formatRelative(row.original.createdAt)} /> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [models.data],
  );

  return (
    <PageContainer>
      <PageHeader title={pick("Uji Model", "Backtesting")} description={pick("Bandingkan hasil model dengan data historis untuk melihat seberapa dekat perkiraannya.", "Replay a model over past periods and compare its forecasts with what actually happened.")} />
      <Panel title={pick("Jalankan Uji Model", "Run a backtest")}>
        {!can("backtest.run") ? (
          <PermissionNotice permission="backtest.run" compact />
        ) : (
          <div className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Field label={pick("Model", "Model")} htmlFor="bt-model">
              <Select id="bt-model" value={modelId} onValueChange={setModelId} options={(models.data ?? []).filter((m) => m.status !== "archived").map((m) => ({ value: m.id, label: `${m.name} ${m.version}`, description: m.status }))} />
            </Field>
            <Field label={pick("Periode historis", "Historical window")} htmlFor="bt-window">
              <Select id="bt-window" value={windowDays} onValueChange={setWindowDays} options={["28", "56", "91", "180"].map((d) => ({ value: d, label: pick(`${d} hari terakhir`, `Last ${d} days`) }))} />
            </Field>
            <Field label={pick("Frekuensi evaluasi", "Evaluation frequency")} htmlFor="bt-freq">
              <Select id="bt-freq" value={frequency} onValueChange={(v) => setFrequency(v as Frequency)} options={[{ value: "daily", label: pick("Harian", "Daily") }, { value: "weekly", label: pick("Mingguan", "Weekly") }]} />
            </Field>
            <Button variant="primary" loading={run.isPending} loadingText={pick("Memulai uji model", "Starting backtest")} onClick={() => run.mutate()}>
              <Play aria-hidden /> {pick("Jalankan uji model", "Run backtest")}
            </Button>
          </div>
        )}
      </Panel>
      <DataTable
        label={pick("Uji model", "Backtests")}
        columns={columns}
        data={q.data}
        getRowId={(b) => b.id}
        isLoading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Uji model tidak dapat dimuat.", "Backtests could not be loaded.")}
        activeRowId={selected?.id}
        onRowClick={(b) => state.setParams({ id: b.id })}
        empty={<EmptyState icon={FlaskConical} title={pick("Belum ada uji model di ruang kerja ini.", "No backtests have been run in this workspace.")} description={pick("Jalankan uji model untuk melihat performa sebuah model.", "Run a backtest to see how a model would have performed.")} />}
      />
      {selected && selected.status === "completed" && selected.metrics && (
        <PageSection
          title={pick(`Hasil · ${selected.id}`, `Results · ${selected.id}`)}
          description={`${modelName(selected.modelId)} · ${formatDateRange(selected.windowStart, selected.windowEnd)} · ${selected.metrics.population}`}
          actions={
            <Select
              size="sm"
              className="w-auto min-w-56"
              aria-label={pick("Bandingkan dengan", "Compare with")}
              prefix={pick("Bandingkan dengan:", "Compare with:")}
              value={compare?.id ?? "none"}
              onValueChange={(v) => state.setParams({ compare: v === "none" ? null : v })}
              options={[{ value: "none", label: pick("Tanpa pembanding", "No comparison") }, ...(q.data ?? []).filter((b) => b.id !== selected.id && b.status === "completed").map((b) => ({ value: b.id, label: pick(`${b.id} · ${modelName(b.modelId)}`, `${b.id} · ${modelName(b.modelId)}`) }))]}
            />
          }
        >
          <Panel flush>
            <div className="p-4">
              <ChartDataTable
                caption={pick("Metrik uji model", "Backtest metrics")}
                maxHeight="none"
                columns={[
                  { key: "metric", label: pick("Metrik", "Metric") },
                  { key: "a", label: selected.id, numeric: true },
                  ...(compare?.metrics ? [{ key: "b", label: compare.id, numeric: true }, { key: "diff", label: pick("Selisih", "Difference"), numeric: true }] : []),
                  { key: "def", label: pick("Penjelasan", "Definition") },
                ]}
                rows={(Object.keys(METRIC_DEFINITIONS) as MetricKey[]).map((k) => {
                  const a = selected.metrics!;
                  const b = compare?.metrics;
                  const raw = (m: NonNullable<Backtest["metrics"]>) => (k === "coverage" ? m.coverage80 : m[k]);
                  const diff = b ? raw(a) - raw(b) : null;
                  return {
                    metric: METRIC_DEFINITIONS[k].label,
                    a: <span className="font-semibold">{metricValue(a, k)}</span>,
                    ...(b ? { b: metricValue(b, k), diff: diff === null ? "—" : k === "mae" || k === "rmse" ? (diff >= 0 ? "+" : "−") + Math.abs(diff).toFixed(1) : `${diff >= 0 ? "+" : "−"}${Math.abs(diff * 100).toFixed(1)} ${pick("poin", "pp")}` } : {}),
                    def: <span className="whitespace-normal text-fg-secondary">{METRIC_DEFINITIONS[k].definition}</span>,
                  };
                })}
              />
              {compare && compare.windowStart !== selected.windowStart && (
                <p className="mt-2 text-xs font-semibold text-warning-fg">{pick("Kedua uji model memakai periode berbeda. Perbedaannya mungkin mencerminkan periode, bukan modelnya.", "The two backtests use different windows. Differences may reflect the period, not the model.")}</p>
              )}
            </div>
          </Panel>
          <ForecastChart
            title={pick("Perkiraan vs aktual", "Forecast vs actual")}
            question={pick("Di mana model meleset, dan apakah aktual tetap berada di dalam rentang?", "Where did the model miss, and did actuals stay inside the interval?")}
            points={selected.points}
            unit={pick(`unit per ${selected.frequency === "weekly" ? "minggu" : "hari"}`, `units per ${selected.frequency === "weekly" ? "week" : "day"}`)}
            source={pick(`Uji model ${selected.id}`, `Backtest ${selected.id}`)}
            summary={pick(`${formatPercent(selected.metrics.coverage80, 0)} ${selected.frequency === "weekly" ? "minggu" : "hari"} berada di dalam rentang 80% (target 80%). Bias ${formatDeltaPercent(selected.metrics.bias)}.`, `${formatPercent(selected.metrics.coverage80, 0)} of ${selected.frequency === "weekly" ? "weeks" : "days"} fell inside the 80% interval (target 80%). Bias ${formatDeltaPercent(selected.metrics.bias)}.`)}
            height={260}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <ChartFrame
              title={pick("Sebaran selisih", "Error distribution")}
              question={pick("Berapa banyak SKU dengan selisih besar?", "How many SKUs have large errors?")}
              unit="SKUs"
              timeframe={formatDateRange(selected.windowStart, selected.windowEnd)}
              summary={pick(`${formatNumber(selected.errorBuckets.filter((b) => ["40–50%", "50–60%", "60%+"].includes(b.bucket)).reduce((s, b) => s + b.count, 0))} SKU memiliki WAPE 40% atau lebih (ditandai).`, `${formatNumber(selected.errorBuckets.filter((b) => ["40–50%", "50–60%", "60%+"].includes(b.bucket)).reduce((s, b) => s + b.count, 0))} SKUs had WAPE of 40% or more (highlighted).`)}
              chart={<Histogram rows={selected.errorBuckets} label="SKUs" highlight={(b) => ["40–50%", "50–60%", "60%+"].includes(b)} />}
              table={<ChartDataTable caption={pick("SKU per kelompok WAPE", "SKUs by WAPE bucket")} columns={[{ key: "bucket", label: "WAPE" }, { key: "count", label: pick("SKU", "SKUs"), numeric: true }]} rows={selected.errorBuckets.map((b) => ({ bucket: b.bucket, count: formatNumber(b.count) }))} />}
            />
            <Panel title={pick("Performa per segmen", "Segment performance")} flush>
              <div className="p-4">
                <ChartDataTable
                  caption={pick("Performa per segmen", "Segment performance")}
                  maxHeight="none"
                  columns={[
                    { key: "s", label: pick("Kategori", "Category") },
                    { key: "v", label: "Volume", numeric: true },
                    { key: "w", label: "WAPE", numeric: true },
                    { key: "b", label: "Bias", numeric: true },
                  ]}
                  rows={[...selected.segments].sort((a, b) => b.wape - a.wape).map((s) => ({ s: s.segment, v: formatPercent(s.volumeShare, 0), w: formatPercent(s.wape), b: <SignedPercent percent={s.bias} /> }))}
                />
              </div>
            </Panel>
          </div>
        </PageSection>
      )}
      {selected && (selected.status === "queued" || selected.status === "running") && (
        <Panel>
          <p className="body-sm text-fg-secondary" role="status">
            {pick(`${selected.id} ${selected.status === "queued" ? "dalam antrean" : "sedang berjalan"}. Hasil muncul di sini setelah selesai.`, `${selected.id} is ${selected.status}. Results appear here when it completes.`)}
          </p>
        </Panel>
      )}
    </PageContainer>
  );
}
