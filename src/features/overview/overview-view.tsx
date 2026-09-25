"use client";

import { AlertOctagon, AlertTriangle, ArrowRight, Info, Plus } from "lucide-react";
import Link from "next/link";
import { getOverview } from "@/lib/api/governance";
import { useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDate, formatDateRange, formatDeltaPercent, formatNumber, formatPercent } from "@/lib/format";
import { addDays } from "@/lib/mock/time";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { MetaItem, PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { ForecastDelta, MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { ChartDataTable, ChartFrame, LegendItem } from "@/components/charts/chart-frame";
import { PairedBars } from "@/components/charts/small-charts";
import { StatusBadge, SeverityBadge } from "@/components/feedback/status";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { ModelIdentity, ProductIdentity, RunIdentity, scopeLabel } from "@/components/entities/identity";
import { AuditTimeline } from "@/components/governance/audit";
import { getSeverityLabel } from "@/components/feedback/status";
import { EXCEPTION_TYPE_LABELS } from "@/features/exceptions/exceptions-view";
import { pick } from "@/lib/i18n";

/**
 * PAGE-OVERVIEW: understand the current forecast state within 5 seconds.
 *   Header → scope/date context → needs attention → forecast health → demand outlook
 *   → accuracy → exception queue → recent runs → activity
 */
export function OverviewView() {
  const { workspace, can } = useSession();
  const q = useApiQuery(["overview"], getOverview, { refetchInterval: 30_000 });

  if (q.isPending) {
    return (
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    );
  }
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title={pick("Ringkasan", "Overview")} />
        <Panel>
          <ErrorState what={pick("Ringkasan tidak dapat dimuat.", "The overview could not be loaded.")} error={q.error} onRetry={() => q.refetch()} retryLabel={pick("Coba muat ulang ringkasan", "Retry loading overview")} />
        </Panel>
      </PageContainer>
    );
  }
  const d = q.data;
  const base = d.baseline;
  const pos = d.dataHealth.sources.find((s) => s.id === "src_pos");

  if (!base || !d.summary) {
    return (
      <PageContainer>
        <PageHeader title={pick("Ringkasan", "Overview")} description={`${workspace.name} · ${workspace.environment}`} />
        <Panel>
          <EmptyState
            title={pick("Belum ada perkiraan yang diterbitkan di ruang kerja ini.", "No forecast has been published in this workspace yet.")}
            description={pick("Ringkasan menampilkan proses perkiraan terbit terakhir. Ikuti panduan persiapan untuk menyambungkan data, menjalankan perkiraan pertama, lalu menerbitkannya.", "The overview summarises the latest published forecast run. Follow the setup guide to connect data, run the first forecast and publish it.")}
            action={
              <Link href="/onboarding" className={buttonVariants({ variant: "primary" })}>
                {pick("Lanjutkan persiapan ruang kerja", "Continue workspace setup")}
              </Link>
            }
            secondaryAction={
              can("forecast.run.create") ? (
                <Link href="/forecasting/runs/new" className={buttonVariants({ variant: "secondary" })}>
                  <Plus aria-hidden /> Buat Perkiraan
                </Link>
              ) : undefined
            }
          />
        </Panel>
      </PageContainer>
    );
  }

  const periodStart = new Date(base.completedAt ?? base.createdAt).setHours(0, 0, 0, 0);
  const periodEnd = addDays(periodStart, base.horizonDays - 1);
  const s = d.summary;

  return (
    <PageContainer>
      <PageHeader
        title={pick("Ringkasan", "Overview")}
        description={pick("Lihat kondisi permintaan, keandalan perkiraan, dan hal yang perlu diperhatikan.", "Current demand outlook, forecast reliability and what needs your attention.")}
        actions={
          can("forecast.run.create") ? (
            <Link href="/forecasting/runs/new" className={buttonVariants({ variant: "primary" })}>
              <Plus aria-hidden /> Buat Perkiraan
            </Link>
          ) : undefined
        }
        meta={
          <>
            <MetaItem>
              Cakupan: {scopeLabel(base)} · {formatNumber(base.scope.skuCount)} SKU · {base.scope.locationCount} lokasi
            </MetaItem>
            <MetaItem>Periode perkiraan: {formatDateRange(new Date(periodStart), new Date(periodEnd))} ({base.horizonDays} hari)</MetaItem>
            <MetaItem>
              Acuan:{" "}
              <Link href={`/forecasting/runs/${base.id}`} className="mono-id text-primary hover:underline">
                {base.id}
              </Link>
            </MetaItem>
            <FreshnessIndicator timestamp={pos?.lastSuccessAt} label={pick("Data POS diperbarui", "POS data updated")} source={pick("Transaksi POS", "POS transactions")} />
          </>
        }
      />

      {/* Needs attention */}
      <PageSection title={pick("Perlu Ditinjau", "Needs attention")} description={pick("Diurutkan berdasarkan tingkat kepentingan. Setiap item tertaut ke tindakannya.", "Ordered by severity. Each item links to where you can act on it.")} id="attention">
        {d.attention.length === 0 ? (
          <Panel>
            <EmptyState compact title={pick("Tidak ada yang perlu ditinjau saat ini.", "Nothing needs your attention right now.")} description={pick("Tidak ada masalah data yang menghambat, perubahan besar, proses gagal, atau persetujuan tertunda.", "No blocking data issues, critical exceptions, failed runs or pending approvals.")} />
          </Panel>
        ) : (
          <ul className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
            {d.attention.map((a) => {
              const Icon = a.severity === "critical" ? AlertOctagon : a.severity === "warning" ? AlertTriangle : Info;
              return (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className={cn(
                      "group flex h-full flex-col rounded-lg border bg-surface p-4 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      a.severity === "critical" ? "border-critical/30" : "border-border",
                    )}
                  >
                    <span className="flex items-start gap-2.5">
                      <Icon className={cn("mt-0.5 size-4 shrink-0", a.severity === "critical" ? "text-critical" : a.severity === "warning" ? "text-warning" : "text-info")} aria-hidden />
                      <span className="min-w-0">
                        <span className="sr-only">{getSeverityLabel(a.severity)}: </span>
                        <span className="block body-sm font-semibold text-fg">{a.title}</span>
                        <span className="mt-0.5 line-clamp-2 block caption">{a.detail}</span>
                      </span>
                    </span>
                    <span className="mt-auto inline-flex items-center gap-1 pl-6 pt-3 text-xs font-semibold text-primary group-hover:underline">
                      {a.cta} <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PageSection>

      {/* Forecast health */}
      <PageSection title={pick("Kesehatan Perkiraan", "Forecast health")} description={pick(`Dari acuan terbit ${base.id}, periode ${base.horizonDays} hari.`, `From the published baseline ${base.id}, ${base.horizonDays}-day horizon.`)} id="health">
        <MetricStrip>
          <MetricCard
            label={pick(`Total Permintaan · ${base.horizonDays} hari ke depan`, `Forecasted demand · next ${base.horizonDays} days`)}
            value={formatNumber(s.forecast)}
            unit={pick("unit", "units")}
            delta={<ForecastDelta percent={s.deltaPercent} size="sm" />}
            context={pick(`Rentang 80% ${formatNumber(s.lower)} – ${formatNumber(s.upper)} · ${formatDeltaPercent(s.deltaPercent)} dibanding perkiraan sebelumnya`, `80% interval ${formatNumber(s.lower)} – ${formatNumber(s.upper)} · ${formatDeltaPercent(s.deltaPercent)} vs previous run`)}
            href="/forecasting/explorer"
            hrefLabel={pick("Buka Perkiraan Permintaan", "Open forecast explorer")}
            tooltip={pick("Jumlah perkiraan harian untuk semua SKU dalam cakupan selama periode perkiraan. Rentangnya menggabungkan rentang tiap SKU.", "Sum of daily forecasts for all SKUs in scope over the horizon. The interval combines SKU-level intervals.")}
          />
          <MetricCard
            label={pick("Akurasi Perkiraan (WAPE)", "Forecast accuracy (WAPE)")}
            value={d.accuracy ? formatPercent(d.accuracy.wape) : "—"}
            context={
              d.accuracyWindow
                ? pick(`Uji model ${d.accuracyWindow.id}, ${formatDate(d.accuracyWindow.start)} – ${formatDate(d.accuracyWindow.end)}. Semakin kecil semakin baik.`, `Backtest ${d.accuracyWindow.id}, ${formatDate(d.accuracyWindow.start)} – ${formatDate(d.accuracyWindow.end)}. Lower is better.`)
                : pick("Belum ada uji model untuk model ini.", "No backtest available for this model.")
            }
            href="/models/performance"
            hrefLabel={pick("Lihat performa model", "View model performance")}
            tooltip={pick("Weighted absolute percentage error: total selisih absolut dibagi total permintaan aktual.", "Weighted absolute percentage error: total absolute error divided by total actual demand.")}
          />
          <MetricCard
            label={pick("Bias Perkiraan", "Forecast bias")}
            value={d.accuracy ? formatDeltaPercent(d.accuracy.bias) : "—"}
            context={pick("Nilai positif berarti model cenderung memperkirakan terlalu tinggi. Target dalam ±3%.", "Positive means the model over-forecasts on average. Target within ±3%.")}
            href="/models/performance"
            hrefLabel={pick("Lihat bias per kategori", "View bias by category")}
            tooltip={pick("Rata-rata selisih bertanda dibagi rata-rata permintaan aktual selama periode uji model.", "Mean signed error divided by mean actual demand over the backtest window.")}
          />
          <MetricCard
            label={pick("Perlu Ditinjau", "Open exceptions")}
            value={formatNumber(d.exceptions.open)}
            context={pick(`${d.exceptions.critical} kritis · ${d.exceptions.warning} peringatan`, `${d.exceptions.critical} critical · ${d.exceptions.warning} warning`)}
            href="/planning/exceptions?status=open,investigating,escalated"
            hrefLabel={pick("Tinjau item", "Review exceptions")}
          />
        </MetricStrip>
      </PageSection>

      {/* Demand outlook */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ForecastChart
          title={pick("Tren Permintaan", "Demand outlook")}
          points={d.points}
          unit={pick("unit per hari", "units per day")}
          source={pick("Transaksi POS, pesanan penjualan ERP", "POS transactions, ERP sales orders")}
          asOf={base.dataAsOf}
          summary={pick(`Permintaan yang diperkirakan untuk ${base.horizonDays} hari ke depan adalah ${formatNumber(s.forecast)} unit (rentang 80% ${formatNumber(s.lower)}–${formatNumber(s.upper)}), ${formatDeltaPercent(s.vsActualPercent)} dibanding permintaan aktual ${base.horizonDays} hari sebelumnya.`, `Expected demand over the next ${base.horizonDays} days is ${formatNumber(s.forecast)} units (80% interval ${formatNumber(s.lower)}–${formatNumber(s.upper)}), ${formatDeltaPercent(s.vsActualPercent)} versus actual demand in the previous ${base.horizonDays} days.`)}
          height={300}
        />
        <ChartFrame
          title={pick("Perkiraan per kategori", "Outlook by category")}
          question={pick("Kategori mana yang menyebabkan perubahan dibanding perkiraan sebelumnya?", "Which categories drive the change versus the previous run?")}
          unit={pick("unit", "units")}
          timeframe={pick(`${base.horizonDays} hari ke depan`, `Next ${base.horizonDays} days`)}
          legend={
            <>
              <LegendItem color="var(--chart-previous)" label={pick("Perkiraan sebelumnya", "Previous run")} variant="bar" />
              <LegendItem color="var(--chart-forecast)" label={pick("Perkiraan saat ini", "Current forecast")} variant="bar" />
            </>
          }
          chart={<PairedBars rows={d.byCategory.map((c) => ({ label: c.category, a: c.previous, b: c.forecast }))} aLabel={pick("Perkiraan sebelumnya", "Previous run")} bLabel={pick("Perkiraan saat ini", "Current forecast")} />}
          table={
            <ChartDataTable
              caption={pick("Perkiraan per kategori", "Forecast by category")}
              columns={[
                { key: "c", label: pick("Kategori", "Category") },
                { key: "p", label: pick("Sebelumnya", "Previous"), numeric: true },
                { key: "f", label: pick("Perkiraan", "Forecast"), numeric: true },
                { key: "d", label: pick("Perubahan", "Change"), numeric: true },
              ]}
              rows={d.byCategory.map((c) => ({ c: c.category, p: formatNumber(c.previous), f: formatNumber(c.forecast), d: formatDeltaPercent(c.previous ? (c.forecast - c.previous) / c.previous : 0) }))}
            />
          }
        />
      </div>

      {/* Exception queue + runs */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title={pick("Perubahan terbesar untuk ditinjau", "Largest forecast changes to review")}
          description={pick("Item terbuka dengan perubahan terbesar dibanding perkiraan sebelumnya.", "Open exceptions with the biggest change versus the previous run.")}
          flush
          actions={
            <Link href="/planning/exceptions" className="text-xs font-semibold text-primary hover:underline">
              Semua item
            </Link>
          }
        >
          {d.exceptions.top.length === 0 ? (
            <EmptyState compact title={pick("Tidak ada perubahan besar yang perlu ditinjau.", "No large changes need review.")} description={pick("Semua perubahan perkiraan masih dalam batas tinjauan.", "All forecast changes are within the review threshold.")} />
          ) : (
            <ul>
              {d.exceptions.top.map((e) => (
                <li key={e.id} className="border-b border-border-subtle last:border-b-0">
                  <Link href={`/planning/exceptions?id=${e.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-2.5 hover:bg-hover focus-visible:bg-hover focus-visible:outline-none">
                    <ProductIdentity product={e.product} />
                    <SeverityBadge severity={e.severity} size="sm" />
                    <span className="w-20 text-right">
                      {e.valueUnit === "%" && e.type === "large_delta" ? <ForecastDelta percent={e.value} size="sm" /> : <span className="text-xs text-fg-secondary">{EXCEPTION_TYPE_LABELS[e.type] ?? e.type}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title={pick("Proses Perkiraan Terbaru", "Recent Forecast Runs")}
          flush
          actions={
            <Link href="/forecasting/runs" className="text-xs font-semibold text-primary hover:underline">
              Semua proses
            </Link>
          }
        >
          <ul>
            {d.runs.recent.map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border-subtle px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                <RunIdentity run={r} />
                <span className="hidden truncate text-xs text-fg-secondary sm:block">{scopeLabel(r)}</span>
                <StatusBadge status={r.status} size="sm" />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title={pick("Model yang digunakan", pick("Model sedang dipakai", "Model in use"))}>
          <div className="flex flex-col gap-3">
            <ModelIdentity model={d.model} showStatus />
            <p className="caption">
              Menghasilkan {base.id}. Terakhir dilatih {d.model ? formatDate(d.model.lastTrainedAt) : "—"}. {d.model?.limitations[0]}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={d.model ? `/models/${d.model.id}` : "/models"} className={buttonVariants({ size: "sm" })}>
                Lihat detail model
              </Link>
              <Link href="/forecasting/lineage" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                Telusuri sumber keputusan
              </Link>
            </div>
          </div>
        </Panel>
        <Panel
          title={pick("Aktivitas Terbaru", "Recent activity")}
          actions={
            can("audit.view") ? (
              <Link href="/administration/audit" className="text-xs font-semibold text-primary hover:underline">
                Riwayat Aktivitas
              </Link>
            ) : undefined
          }
        >
          <AuditTimeline events={d.activity.slice(0, 5)} />
        </Panel>
      </div>
    </PageContainer>
  );
}
